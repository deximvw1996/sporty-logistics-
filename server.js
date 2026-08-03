const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;
// Railway: gebruik DATA_DIR env var voor persistent volume, anders lokaal
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR || __dirname;
const DB_PATH = path.join(DATA_DIR, 'sporty.db');
console.log('Database pad:', DB_PATH);
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
try { if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch(e) { console.warn('Uploads map aanmaken mislukt:', e.message); }
app.use('/uploads', express.static(UPLOADS_DIR));
// S4.7: themabundel-PDF's staan IN de repo (__dirname, niet het DATA_DIR-volume) zodat ze
// gewoon meegedeployed worden bij een git push — dit is geen runtime-upload-map.
const BUNDELS_DIR = path.join(__dirname, 'bundels');
try { if (!fs.existsSync(BUNDELS_DIR)) fs.mkdirSync(BUNDELS_DIR, { recursive: true }); } catch(e) { console.warn('Bundels-map aanmaken mislukt:', e.message); }
// Reviewfix Fable: /bundels wordt pas NA de Basic-auth-muur gemount (zie verderop) — anders
// staan alle themabundel-PDF's op productie zonder wachtwoord open.

// ── PROCES-FOUTAFHANDELING ──
// Vangt onverwachte fouten op zodat de server niet stil crasht.
process.on('uncaughtException', (err) => {
  console.error('Onverwachte fout (uncaughtException):', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Onafgehandelde promise-fout (unhandledRejection):', reason);
});

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// ── BEVEILIGING: wachtwoord via HTTP Basic Auth ──
// Stel APP_PASSWORD in als omgevingsvariabele in Railway om de app te beveiligen.
// Niet ingesteld = app blijft open (handig voor lokaal testen).
const APP_PASSWORD = process.env.APP_PASSWORD || '';
if (!APP_PASSWORD) {
  console.warn('WAARSCHUWING: APP_PASSWORD is niet ingesteld - de app is NIET beveiligd. Stel APP_PASSWORD in bij Railway > Variables.');
}
app.use((req, res, next) => {
  if (!APP_PASSWORD) return next();              // geen wachtwoord ingesteld = open
  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    let decoded = '';
    try { decoded = Buffer.from(encoded, 'base64').toString('utf8'); } catch (e) {}
    const pwd = decoded.includes(':') ? decoded.slice(decoded.indexOf(':') + 1) : decoded;
    if (pwd === APP_PASSWORD) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Sporty Logistiek"');
  return res.status(401).send('Wachtwoord vereist');
});
// Reviewfix Fable (S4.7): bundel-PDF's achter de Basic-auth-buitenmuur serveren.
app.use('/bundels', express.static(BUNDELS_DIR));
// Zoek frontend: eerst ../frontend (lokaal), dan zelfde map (Railway flat deploy)
let FRONTEND_PATH = path.join(__dirname, '../frontend');
if (!fs.existsSync(path.join(FRONTEND_PATH, 'index.html'))) {
  FRONTEND_PATH = __dirname;
}
console.log('Frontend pad:', FRONTEND_PATH);
app.use(express.static(FRONTEND_PATH));

let db;

function saveDb() {
  const data = Buffer.from(db.export());
  fs.writeFileSync(DB_PATH, data);
  try { backupDb(data); } catch (e) { console.error('Backup mislukt:', e.message); }
}

// Maakt 1 backup per dag in de map "backups/" en bewaart de laatste 14 dagen.
let lastBackupDay = '';
function backupDb(data) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  if (today === lastBackupDay) return;                  // al een backup vandaag
  const backupDir = path.join(DATA_DIR, 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, `sporty-${today}.db`), data);
  lastBackupDay = today;
  // Oude backups opruimen: hou alleen de laatste 14 dagen
  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('sporty-') && f.endsWith('.db'))
    .sort();
  while (files.length > 14) {
    const oud = files.shift();
    try { fs.unlinkSync(path.join(backupDir, oud)); } catch (e) {}
  }
}
function run(sql, p=[]) { db.run(sql, p); saveDb(); }
function get(sql, p=[]) { const s=db.prepare(sql); s.bind(p); const r=s.step()?s.getAsObject():null; s.free(); return r; }
function all(sql, p=[]) { const s=db.prepare(sql); s.bind(p); const r=[]; while(s.step())r.push(s.getAsObject()); s.free(); return r; }
function ins(sql, p=[]) { db.run(sql,p); const id=get('SELECT last_insert_rowid() as id').id; saveDb(); return id; }
function now() { return new Date().toLocaleString('nl-BE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
function isoDate(d) { return d.toISOString().split('T')[0]; }
function _genToken(len=10){const c='abcdefghijklmnopqrstuvwxyz0123456789';return Array.from({length:len},()=>c[Math.floor(Math.random()*c.length)]).join('');}
// Centrale materiaalcatalogus: geeft altijd een item_types.id terug voor een naam.
// Bestaat de naam nog niet (case-insensitive), dan wordt ze aangemaakt i.p.v. overgeslagen —
// zo blijft élk materiaal-item, ook nieuwe spellingen, gekoppeld aan de catalogus.
function resolveItemTypeId(naam, categorieHint) {
  const schoon = (naam || '').toString().trim();
  if (!schoon) return null;
  const bestaand = get('SELECT id FROM item_types WHERE LOWER(naam)=LOWER(?)', [schoon]);
  if (bestaand) return bestaand.id;
  return ins('INSERT INTO item_types (naam,eenheid,categorie) VALUES (?,?,?)', [schoon, 'stuk', categorieHint || 'materiaal']);
}
function logAct(type, actie, beschrijving, locatie_id=null, locatie_naam=null) {
  try { run('INSERT INTO activiteiten_log (tijdstip,type,actie,beschrijving,locatie_id,locatie_naam) VALUES (?,?,?,?,?,?)',
    [now(),type,actie,beschrijving,locatie_id||null,locatie_naam||null]); }
  catch(e) { console.error('Log fout:', e.message); }
}

async function startServer() {
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_PATH) ? new SQL.Database(fs.readFileSync(DB_PATH)) : new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');

  // ── SCHEMA MIGRATIONS ──
  // Get current schema version
  const schemaVersion = db.exec('PRAGMA user_version')[0]?.values[0][0] || 0;
  console.log(`DB schema versie: ${schemaVersion}`);

  function addColumnIfMissing(table, column, definition) {
    try {
      const cols = db.exec(`PRAGMA table_info(${table})`)[0];
      if (!cols) return; // table doesn't exist yet
      const exists = cols.values.some(r => r[1] === column);
      if (!exists) {
        db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        console.log(`  + ${table}.${column} toegevoegd`);
      }
    } catch(e) { console.error(`Migratie-fout bij ${table}.${column}:`, e.message); }
  }

  function createTableIfMissing(createSql) {
    try { db.run(createSql); } catch(e) { console.error('Migratie-fout (createTable):', e.message); }
  }

  // Migration 1: base schema (always runs via CREATE TABLE IF NOT EXISTS)
  // Migration 2: add sort_order to thema_materiaal and standaard_materiaal
  if (schemaVersion < 2) {
    addColumnIfMissing('thema_materiaal', 'sort_order', 'INTEGER DEFAULT 0');
    addColumnIfMissing('standaard_materiaal', 'sort_order', 'INTEGER DEFAULT 0');
    addColumnIfMissing('locatie_materiaal', 'sort_order', 'INTEGER DEFAULT 0');
    db.run('PRAGMA user_version = 2');
    if (schemaVersion > 0) console.log('  Migratie 2 uitgevoerd');
  }

  // Migration 3: add color to transport categories, notes to locaties
  try {
    if (schemaVersion < 6) {
      createTableIfMissing('CREATE TABLE IF NOT EXISTS sport_items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, cat TEXT DEFAULT \'sport\', notities TEXT DEFAULT \'\')');
      createTableIfMissing('CREATE TABLE IF NOT EXISTS sport_sets (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL, label TEXT NOT NULL, locatie_id INTEGER)');
      createTableIfMissing('CREATE TABLE IF NOT EXISTS sport_planning (id INTEGER PRIMARY KEY AUTOINCREMENT, set_id INTEGER NOT NULL, locatie_id INTEGER NOT NULL, week INTEGER NOT NULL, UNIQUE(set_id, week))');
      createTableIfMissing('CREATE TABLE IF NOT EXISTS gedeeld_items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, cat TEXT DEFAULT \'gedeeld\', totaal INTEGER DEFAULT 1, notities TEXT DEFAULT \'\')');
      createTableIfMissing('CREATE TABLE IF NOT EXISTS gedeeld_gebruik (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL, thema_id INTEGER NOT NULL, qty INTEGER DEFAULT 1, UNIQUE(item_id, thema_id))');
      db.run('PRAGMA user_version = 6');
      if (schemaVersion > 0) console.log('  Migratie 6: sport + gedeeld materiaal');
    }
  } catch(e) { console.log('Migratie 6 error (niet fataal):', e.message); }

  if (schemaVersion < 5) {
    createTableIfMissing(`CREATE TABLE IF NOT EXISTS set_planning (id INTEGER PRIMARY KEY AUTOINCREMENT, eenheid_id INTEGER NOT NULL, locatie_id INTEGER NOT NULL, week INTEGER NOT NULL, UNIQUE(eenheid_id,week), FOREIGN KEY(eenheid_id) REFERENCES materiaal_eenheden(id) ON DELETE CASCADE)`);
    createTableIfMissing(`CREATE TABLE IF NOT EXISTS verbruik_stock (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL, locatie_id INTEGER NOT NULL, qty REAL NOT NULL DEFAULT 0, minimum REAL DEFAULT 0, eenheid TEXT DEFAULT 'stuks', UNIQUE(item_id,locatie_id), FOREIGN KEY(item_id) REFERENCES materiaal_items(id) ON DELETE CASCADE)`);
    createTableIfMissing(`CREATE TABLE IF NOT EXISTS verbruik_log (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL, locatie_id INTEGER NOT NULL, delta REAL NOT NULL, reden TEXT DEFAULT '', wie TEXT DEFAULT '', transport_id INTEGER, datum TEXT DEFAULT '', created_at TEXT DEFAULT '')`);
    addColumnIfMissing('materiaal_items', 'minimum', "REAL DEFAULT 0");
    db.run('PRAGMA user_version = 5');
    if (schemaVersion > 0) console.log('  Migratie 5 uitgevoerd: inventaris tabellen');
  }

  if (schemaVersion < 4) {
    addColumnIfMissing('themas', 'categorie', "TEXT DEFAULT ''");
    createTableIfMissing('CREATE TABLE IF NOT EXISTS thema_categorieen (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE)');
    db.run('PRAGMA user_version = 4');
    if (schemaVersion > 0) console.log('  Migratie 4 uitgevoerd');
  }

  if (schemaVersion < 3) {
    addColumnIfMissing('locaties', 'contact_naam', "TEXT DEFAULT ''");
    addColumnIfMissing('locaties', 'contact_tel', "TEXT DEFAULT ''");
    addColumnIfMissing('locaties', 'notities', "TEXT DEFAULT ''");
    addColumnIfMissing('kampmomenten', 'notities', "TEXT DEFAULT ''");
    addColumnIfMissing('transport_taken', 'categorie', "TEXT DEFAULT ''");
    db.run('PRAGMA user_version = 3');
    if (schemaVersion > 0) console.log('  Migratie 3 uitgevoerd');
  }

  // Migration 5: lat/lng voor kaart view
  addColumnIfMissing('locaties', 'lat', 'REAL');
  addColumnIfMissing('locaties', 'lng', 'REAL');

  // Migration 7: foto per sportartikel
  addColumnIfMissing('sport_items', 'foto_path', 'TEXT');

  // Migration 8: stockage_rol voor locaties (sport / thema / beide)
  addColumnIfMissing('locaties', 'stockage_rol', "TEXT DEFAULT 'beide'");

  // Migration 9: per-item thuis-stockage (sport_items, thema_materiaal, standaard_materiaal, gedeeld_items)
  addColumnIfMissing('sport_items', 'stockage_locatie_id', 'INTEGER');
  addColumnIfMissing('thema_materiaal', 'stockage_locatie_id', 'INTEGER');
  addColumnIfMissing('standaard_materiaal', 'stockage_locatie_id', 'INTEGER');
  addColumnIfMissing('gedeeld_items', 'stockage_locatie_id', 'INTEGER');

  db.run(`
    CREATE TABLE IF NOT EXISTS locaties (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, addr TEXT DEFAULT '', type TEXT DEFAULT 'kamp', contact_naam TEXT DEFAULT '', contact_tel TEXT DEFAULT '', notities TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS themas (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, color TEXT DEFAULT '#1D9E75', categorie TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS thema_categorieen (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);
    CREATE TABLE IF NOT EXISTS thema_materiaal (id INTEGER PRIMARY KEY AUTOINCREMENT, thema_id INTEGER NOT NULL, name TEXT NOT NULL, qty INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS standaard_materiaal (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, qty INTEGER DEFAULT 1, cat TEXT DEFAULT 'andere');
    CREATE TABLE IF NOT EXISTS kampmomenten (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      locatie_id INTEGER NOT NULL,
      week INTEGER NOT NULL,
      UNIQUE(locatie_id, week),
      FOREIGN KEY(locatie_id) REFERENCES locaties(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS kampmoment_themas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kampmoment_id INTEGER NOT NULL,
      thema_id INTEGER NOT NULL,
      UNIQUE(kampmoment_id, thema_id),
      FOREIGN KEY(kampmoment_id) REFERENCES kampmomenten(id) ON DELETE CASCADE,
      FOREIGN KEY(thema_id) REFERENCES themas(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS kalender_dagen (id INTEGER PRIMARY KEY AUTOINCREMENT, locatie_id INTEGER NOT NULL, datum TEXT NOT NULL, open INTEGER DEFAULT 1, UNIQUE(locatie_id, datum));
    CREATE TABLE IF NOT EXISTS gesloten_dagen (id INTEGER PRIMARY KEY AUTOINCREMENT, datum TEXT NOT NULL UNIQUE, reden TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS spoedmeldingen (id INTEGER PRIMARY KEY AUTOINCREMENT, item TEXT NOT NULL, qty INTEGER DEFAULT 1, locatie_id INTEGER, prio TEXT DEFAULT 'midden', note TEXT DEFAULT '', done INTEGER DEFAULT 0, done_time TEXT DEFAULT '', created_at TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS materiaal_items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, tracking TEXT DEFAULT 'per_type', cat TEXT DEFAULT 'andere', created_at TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS materiaal_eenheden (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL, label TEXT DEFAULT '', qty INTEGER DEFAULT 1, locatie_id INTEGER);
    CREATE TABLE IF NOT EXISTS verplaatsingen (id INTEGER PRIMARY KEY AUTOINCREMENT, eenheid_id INTEGER NOT NULL, van_locatie_id INTEGER, naar_locatie_id INTEGER NOT NULL, qty INTEGER DEFAULT 1, reden TEXT DEFAULT '', datum TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS transport_taken (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT DEFAULT 'levering', datum TEXT DEFAULT '', tijd TEXT DEFAULT '09:00', van_locatie_id INTEGER, naar_locatie_id INTEGER, opmerking TEXT DEFAULT '', wie TEXT DEFAULT '', kampmoment_id INTEGER, status TEXT DEFAULT 'gepland', created_at TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS locatie_materiaal (id INTEGER PRIMARY KEY AUTOINCREMENT, locatie_id INTEGER NOT NULL, name TEXT NOT NULL, qty INTEGER DEFAULT 1, cat TEXT DEFAULT 'andere', FOREIGN KEY(locatie_id) REFERENCES locaties(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS kamp_basis_afwijking (id INTEGER PRIMARY KEY AUTOINCREMENT, locatie_id INTEGER NOT NULL, standaard_id INTEGER NOT NULL, verborgen INTEGER DEFAULT 0, qty INTEGER, UNIQUE(locatie_id, standaard_id), FOREIGN KEY(locatie_id) REFERENCES locaties(id) ON DELETE CASCADE, FOREIGN KEY(standaard_id) REFERENCES standaard_materiaal(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS chauffeurs (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);
    CREATE TABLE IF NOT EXISTS ploeg_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chauffeur_id INTEGER NOT NULL,
      datum TEXT NOT NULL,
      start_tijd TEXT NOT NULL DEFAULT '08:00',
      eind_tijd TEXT NOT NULL DEFAULT '17:00',
      type TEXT DEFAULT 'vol',
      opmerking TEXT DEFAULT '',
      FOREIGN KEY(chauffeur_id) REFERENCES chauffeurs(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS transport_regels (id INTEGER PRIMARY KEY AUTOINCREMENT, taak_id INTEGER NOT NULL, naam TEXT NOT NULL, qty INTEGER DEFAULT 1, soort TEXT DEFAULT 'andere');
    CREATE TABLE IF NOT EXISTS set_planning (id INTEGER PRIMARY KEY AUTOINCREMENT, eenheid_id INTEGER NOT NULL, locatie_id INTEGER NOT NULL, week INTEGER NOT NULL, UNIQUE(eenheid_id,week), FOREIGN KEY(eenheid_id) REFERENCES materiaal_eenheden(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS verbruik_stock (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL, locatie_id INTEGER NOT NULL, qty REAL NOT NULL DEFAULT 0, minimum REAL DEFAULT 0, eenheid TEXT DEFAULT 'stuks', UNIQUE(item_id,locatie_id), FOREIGN KEY(item_id) REFERENCES materiaal_items(id) ON DELETE CASCADE);

    -- SPORT MATERIAAL
    CREATE TABLE IF NOT EXISTS sport_items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, cat TEXT DEFAULT 'sport', notities TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS sport_sets (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL, label TEXT NOT NULL, locatie_id INTEGER, FOREIGN KEY(item_id) REFERENCES sport_items(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS sport_planning (id INTEGER PRIMARY KEY AUTOINCREMENT, set_id INTEGER NOT NULL, locatie_id INTEGER NOT NULL, week INTEGER NOT NULL, UNIQUE(set_id, week), FOREIGN KEY(set_id) REFERENCES sport_sets(id) ON DELETE CASCADE);
    -- GEDEELD MATERIAAL (blazers, ovens, frames...)
    CREATE TABLE IF NOT EXISTS gedeeld_items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, cat TEXT DEFAULT 'gedeeld', totaal INTEGER DEFAULT 1, notities TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS gedeeld_gebruik (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL, thema_id INTEGER NOT NULL, qty INTEGER DEFAULT 1, UNIQUE(item_id, thema_id), FOREIGN KEY(item_id) REFERENCES gedeeld_items(id) ON DELETE CASCADE);

    CREATE TABLE IF NOT EXISTS verbruik_log (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL, locatie_id INTEGER NOT NULL, delta REAL NOT NULL, reden TEXT DEFAULT '', wie TEXT DEFAULT '', transport_id INTEGER, datum TEXT DEFAULT '', created_at TEXT DEFAULT '');

    -- Migration 6: activiteitenlog
    CREATE TABLE IF NOT EXISTS activiteiten_log (id INTEGER PRIMARY KEY AUTOINCREMENT, tijdstip TEXT NOT NULL, type TEXT NOT NULL, actie TEXT NOT NULL, beschrijving TEXT NOT NULL, locatie_id INTEGER, locatie_naam TEXT);

    -- Migration 8: terugkomst flow
    CREATE TABLE IF NOT EXISTS terugkomst_rapporten (id INTEGER PRIMARY KEY AUTOINCREMENT, kampmoment_id INTEGER NOT NULL, datum TEXT NOT NULL, notities TEXT DEFAULT '', created_at TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS terugkomst_regels (id INTEGER PRIMARY KEY AUTOINCREMENT, rapport_id INTEGER NOT NULL, item_naam TEXT NOT NULL, set_id INTEGER, status TEXT DEFAULT 'ok', opmerking TEXT DEFAULT '');

    -- Migration 10: per-locatie telling voor gedeeld materiaal (uitrusting zoals ovens)
    CREATE TABLE IF NOT EXISTS gedeeld_stock (id INTEGER PRIMARY KEY AUTOINCREMENT, gedeeld_id INTEGER NOT NULL, locatie_id INTEGER NOT NULL, qty INTEGER NOT NULL DEFAULT 0, UNIQUE(gedeeld_id,locatie_id), FOREIGN KEY(gedeeld_id) REFERENCES gedeeld_items(id) ON DELETE CASCADE);
  `);

  // Migrations for existing DBs
  try { db.run("ALTER TABLE locaties ADD COLUMN type TEXT DEFAULT 'kamp'"); } catch(e){}

  // Migration 11: spoed-effect uitgesteld tot status "gedaan"
  // spoed_effect_toegepast=1 als default zodat bestaande records niet dubbel worden verwerkt
  addColumnIfMissing('transport_taken', 'spoed_kind', "TEXT DEFAULT ''");
  addColumnIfMissing('transport_taken', 'spoed_ref_id', "INTEGER DEFAULT 0");
  addColumnIfMissing('transport_taken', 'spoed_effect_toegepast', "INTEGER DEFAULT 1");

  // Migration 12: vakantieperiodes
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS vakantieperiodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naam TEXT NOT NULL,
    start_datum TEXT NOT NULL,
    eind_datum TEXT NOT NULL,
    max_weken INTEGER DEFAULT 9
  )`);
  // Seed default periode Zomer 2026 als die nog niet bestaat
  const bestaandePeriodes = all('SELECT id FROM vakantieperiodes');
  if (!bestaandePeriodes.length) {
    ins("INSERT INTO vakantieperiodes (naam,start_datum,eind_datum,max_weken) VALUES ('Zomer 2026','2026-06-29','2026-09-06',9)");
    console.log('  Standaardperiode "Zomer 2026" aangemaakt');
  }
  addColumnIfMissing('kampmomenten', 'periode_id', 'INTEGER DEFAULT 1');
  // Koppel bestaande kampmomenten aan periode 1 als ze nog niet gekoppeld zijn
  try { db.run("UPDATE kampmomenten SET periode_id=1 WHERE periode_id IS NULL OR periode_id=0"); } catch(e){}

  // Migration 13: locatie_id direct op sport_items
  addColumnIfMissing('sport_items', 'locatie_id', 'INTEGER');

  // Migration 14: transport ritten (groepering van transporten)
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS transport_ritten (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    datum TEXT NOT NULL,
    chauffeur TEXT DEFAULT '',
    opmerking TEXT DEFAULT '',
    status TEXT DEFAULT 'gepland',
    created_at TEXT DEFAULT ''
  )`);
  addColumnIfMissing('transport_taken', 'rit_id', 'INTEGER');
  // Backfill: elke gedateerde taak zonder rit krijgt een eigen 1-op-1 rit.
  // Idempotent: na de backfill heeft de taak een rit_id en matcht de WHERE niets meer.
  const _teBackfillen = all("SELECT * FROM transport_taken WHERE (rit_id IS NULL OR rit_id=0) AND datum IS NOT NULL AND datum<>''");
  _teBackfillen.forEach(t => {
    const ritId = ins('INSERT INTO transport_ritten (datum,chauffeur,opmerking,status,created_at) VALUES (?,?,?,?,?)',
      [t.datum, t.wie||'', '', t.status||'gepland', t.created_at||now()]);
    db.run('UPDATE transport_taken SET rit_id=? WHERE id=?', [ritId, t.id]);
  });
  if (_teBackfillen.length) console.log(`  Migratie 14: ${_teBackfillen.length} ritten aangemaakt (backfill)`);

  // Migration 15: themadagen
  // type='kamp' (themakamp, default - 1+ thema's draaien hele week)
  // type='themadag' (verschillend thema per weekdag)
  // kampmoment_themas.dag: NULL=hele week (themakamp), 0-4=ma..vr (themadag)
  // NB: UNIQUE(kampmoment_id, thema_id) blijft staan - een thema kan dus per
  // kampmoment maar één keer voorkomen, ook in themadag-modus (acceptabel
  // want themadag draait om afwisseling).
  addColumnIfMissing('kampmomenten', 'type', "TEXT DEFAULT 'kamp'");
  addColumnIfMissing('kampmoment_themas', 'dag', 'INTEGER');
  try { db.run("UPDATE kampmomenten SET type='kamp' WHERE type IS NULL OR type=''"); } catch(e){}

  // Migration 16: leeftijdsgroep op themas (KL=kleuters / LS=lagere school /
  // KLS=beide / 12+ / 10+) + stockage_code op thema_materiaal. stockage_code is
  // de vrije papieren magazijncode (H26, kantoor, Beneden...) en bewaart die bij
  // de planning-import zonder dat er een echte locaties-rij voor moet bestaan.
  addColumnIfMissing('themas', 'leeftijdsgroep', "TEXT DEFAULT ''");
  addColumnIfMissing('thema_materiaal', 'stockage_code', "TEXT DEFAULT ''");

  // Migration 17: vangnet voor kolommen die op een VERSE/lege DB ontbreken.
  // Sommige addColumnIfMissing-migraties hierboven (mig. 2, 3, 5, 8, 9) draaien
  // VOORDAT hun tabel via het grote CREATE TABLE IF NOT EXISTS-blok bestaat. Op een
  // verse DB (user_version=0) wordt de kolom dan stil overgeslagen ("tabel bestaat
  // nog niet") en daarna maakt het CREATE-blok de tabel zonder die kolom. Gevolg:
  // /api/import-themas crasht op de ontbrekende kolom stockage_locatie_id, en
  // sort_order/notities/categorie ontbreken blijvend (mig. 2/3 zijn version-gated,
  // dus ze worden nooit opnieuw geprobeerd). Door ze hier — NA het CREATE-blok en
  // ongegate — opnieuw te asserten krijgen zowel verse als reeds bestaande DB's
  // alle kolommen. Idempotent: op een DB die ze al heeft is dit een no-op.
  addColumnIfMissing('thema_materiaal', 'sort_order', 'INTEGER DEFAULT 0');
  addColumnIfMissing('thema_materiaal', 'stockage_locatie_id', 'INTEGER');
  addColumnIfMissing('standaard_materiaal', 'sort_order', 'INTEGER DEFAULT 0');
  addColumnIfMissing('standaard_materiaal', 'stockage_locatie_id', 'INTEGER');
  addColumnIfMissing('locatie_materiaal', 'sort_order', 'INTEGER DEFAULT 0');
  addColumnIfMissing('materiaal_items', 'minimum', 'REAL DEFAULT 0');
  addColumnIfMissing('kampmomenten', 'notities', "TEXT DEFAULT ''");
  addColumnIfMissing('transport_taken', 'categorie', "TEXT DEFAULT ''");
  addColumnIfMissing('locaties', 'lat', 'REAL');
  addColumnIfMissing('locaties', 'lng', 'REAL');
  addColumnIfMissing('locaties', 'stockage_rol', "TEXT DEFAULT 'beide'");

  // Migration 18: voertuig op ritten, verhuis_checks, kleurenborden, week op transport_taken, thema bakken
  addColumnIfMissing('transport_ritten', 'voertuig', "TEXT DEFAULT ''");
  addColumnIfMissing('transport_ritten', 'klaarzet_status', "TEXT DEFAULT ''");
  addColumnIfMissing('transport_ritten', 'klaarzet_door', "TEXT DEFAULT ''");
  addColumnIfMissing('transport_ritten', 'klaarzet_op', "TEXT DEFAULT ''");
  addColumnIfMissing('transport_taken', 'week', 'INTEGER');
  addColumnIfMissing('kampmoment_themas', 'leeftijdsgroep', "TEXT DEFAULT ''");
  // Voertuigtypes met capaciteit
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS voertuig_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naam TEXT NOT NULL UNIQUE,
    capaciteit_bakken INTEGER DEFAULT 0,
    capaciteit_label TEXT DEFAULT ''
  )`);
  // Seed standaardvoertuigen als ze nog niet bestaan
  if(!get('SELECT id FROM voertuig_types WHERE naam=?',['Camionette'])){
    ins('INSERT INTO voertuig_types (naam,capaciteit_bakken,capaciteit_label) VALUES (?,?,?)',['Camionette',20,'20 bakken']);
  }
  if(!get('SELECT id FROM voertuig_types WHERE naam=?',['Camion'])){
    ins('INSERT INTO voertuig_types (naam,capaciteit_bakken,capaciteit_label) VALUES (?,?,?)',['Camion',40,'40 bakken']);
  }
  // Thema bakken (dozen die meereizen) + hun inhoud
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS thema_bakken (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thema_id INTEGER NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    code TEXT DEFAULT '',
    leeftijdsgroep TEXT DEFAULT '',
    volgorde INTEGER DEFAULT 0,
    FOREIGN KEY(thema_id) REFERENCES themas(id) ON DELETE CASCADE
  )`);
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS bak_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bak_id INTEGER NOT NULL,
    naam TEXT NOT NULL,
    qty REAL DEFAULT 1,
    verbruik INTEGER DEFAULT 0,
    qty_per_gebruik REAL DEFAULT 1,
    eenheid TEXT DEFAULT 'stuks',
    qty_stock REAL DEFAULT 0,
    qty_minimum REAL DEFAULT 0,
    notitie TEXT DEFAULT '',
    FOREIGN KEY(bak_id) REFERENCES thema_bakken(id) ON DELETE CASCADE
  )`);
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS bak_nakijk_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bak_id INTEGER NOT NULL,
    tijdstip TEXT NOT NULL,
    wie TEXT DEFAULT '',
    resultaat TEXT DEFAULT 'ok',
    notitie TEXT DEFAULT '',
    FOREIGN KEY(bak_id) REFERENCES thema_bakken(id) ON DELETE CASCADE
  )`);
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS verhuis_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rit_id INTEGER NOT NULL,
    item_naam TEXT NOT NULL,
    item_soort TEXT DEFAULT 'andere',
    qty INTEGER DEFAULT 1,
    status TEXT DEFAULT 'wacht',
    notitie TEXT DEFAULT '',
    aangevinkt_door TEXT DEFAULT '',
    aangevinkt_op TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY(rit_id) REFERENCES transport_ritten(id) ON DELETE CASCADE
  )`);
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS locatie_kleuren (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    locatie_id INTEGER NOT NULL,
    week INTEGER NOT NULL,
    kleur TEXT NOT NULL,
    aantal INTEGER DEFAULT 1,
    UNIQUE(locatie_id, week, kleur),
    FOREIGN KEY(locatie_id) REFERENCES locaties(id) ON DELETE CASCADE
  )`);

  // Migration 19: chauffeur-link, retour-status, foto's, stock-deplétie
  addColumnIfMissing('transport_ritten', 'rit_token', "TEXT DEFAULT ''");
  addColumnIfMissing('kampmoment_themas', 'retour_status', "TEXT DEFAULT ''");
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS bak_fotos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bak_id INTEGER NOT NULL,
    tijdstip TEXT NOT NULL,
    wie TEXT DEFAULT '',
    beschrijving TEXT DEFAULT '',
    foto_data TEXT DEFAULT '',
    FOREIGN KEY(bak_id) REFERENCES thema_bakken(id) ON DELETE CASCADE
  )`);

  // Migration 20: sub-locaties + correcte sport_items import
  addColumnIfMissing('locaties', 'parent_id', 'INTEGER DEFAULT NULL');

  // Sub-locaties aanmaken als ze nog niet bestaan
  const _kantoor = get("SELECT id FROM locaties WHERE name='Kantoor' AND (parent_id IS NULL OR parent_id=0)");
  const _rozenweg = get("SELECT id FROM locaties WHERE name='Rozenweg' AND (parent_id IS NULL OR parent_id=0)");
  if (_kantoor) {
    const _subK = [['Boven',_kantoor.id],['Naschoolse',_kantoor.id],['Sport',_kantoor.id],['Beneden',_kantoor.id]];
    _subK.forEach(([n,pid]) => {
      if (!get('SELECT id FROM locaties WHERE name=? AND parent_id=?',[n,pid]))
        ins('INSERT INTO locaties (name,type,stockage_rol,parent_id) VALUES (?,?,?,?)',[n,'stockage','beide',pid]);
    });
  }
  if (_rozenweg) {
    const _subR = [['Boven',_rozenweg.id],['RGA',_rozenweg.id],['RGB',_rozenweg.id],['RGC',_rozenweg.id],['RGD',_rozenweg.id],['RGE',_rozenweg.id],['RGF',_rozenweg.id]];
    _subR.forEach(([n,pid]) => {
      if (!get('SELECT id FROM locaties WHERE name=? AND parent_id=?',[n,pid]))
        ins('INSERT INTO locaties (name,type,stockage_rol,parent_id) VALUES (?,?,?,?)',[n,'stockage','beide',pid]);
    });
  }

  // Sport_items seeding: vervang oude foutieve data (≤15 items of verouderde namen)
  // Gegate via app_vlaggen 'migratie20_klaar' — de seed is al lang gebeurd en mag nooit meer
  // draaien (was een tijdbom: draaide destructief telkens de tabel toevallig ≤15 rijen had).
  createTableIfMissing('CREATE TABLE IF NOT EXISTS app_vlaggen (naam TEXT PRIMARY KEY, waarde TEXT)');
  const _mig20Vlag=get("SELECT naam FROM app_vlaggen WHERE naam='migratie20_klaar'");
  const _sportCount = (get('SELECT COUNT(*) as n FROM sport_items') || {}).n || 0;
  const _heeftOud = get("SELECT id FROM sport_items WHERE name='Cirkus A' OR name='Basket A'");
  if (!_mig20Vlag) try{ins('INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES (\'migratie20_klaar\',\'1\')');}catch(e){}
  if (!_mig20Vlag && _kantoor && _rozenweg && (_sportCount <= 15 || _heeftOud)) {
    run('DELETE FROM sport_sets'); run('DELETE FROM sport_planning'); run('DELETE FROM sport_items');
    const _rw = [
      'Sportkoffer LS','Archery tag A','Archery tag B','Baseball variaties','Bumperball',
      'Cirkelvoetbal en handvoetbal','Gaelic football en goalbal','Geksentriek balspel',
      'Guldensporenslag','Homeball','Kanjamm A','Kanjamm B','Kubb','Levende risk',
      'Levende stratego','Mölkky','Spikeball A','Spikeball B','Tchoukbal',
      'Ultimate frisbee A','Ultimate frisbee B','Verrekijker voetbal','Watch and go','You fo','Zwerkbal'
    ];
    const _kt = [
      'Sportkoffer KLS','Atletiek KLS A','Atletiek KLS B','Atletiek LS B','Atletiek LS C','Atletiek LS D',
      'Badminton A','Badminton B','Base hockey A',
      'Basket A','Basket B','Basket C','Basket D',
      'Bonkerbal A','Bounceball A','Bounceball B','Bounceball C',
      'Bumball A','Bumball B','Bumball C',
      'Circus A','Circus B','Circus C',
      'Fling it A','Fling it B','Fling it C',
      'Frisbee A','Frisbee B','Goubak A','Gouret A','Gouret B',
      'Handbal A','Handbal B','Handbal C','Handbal D',
      'Hockey A','Hockey B','Hockey C','Hockey D',
      'Kinball A','Kinball B','Kinball C','Kinball D','Kinball E','Kinball Abdij',
      'Lacrosse A','Lacrosse B',
      'Mini basket A','Mini basket B','Mini basket C','Mini basket D',
      'Mini rugby A','Mini rugby Abdij',
      'Mini tennis A','Mini tennis B',
      'New games A','New games B',
      'Poulball A','Poulball B','Poulball C',
      'Ringstick A',
      'Rope skipping A','Rope skipping B','Rope skipping Abdij',
      'Rugby A','Rugby B','Rugby Abdij',
      'Scoop A','Scoop B','Scratchball A','Scratchball B',
      'Speedminton A','Springy rackets A','Tag rugby A',
      'Voetbal A','Voetbal B','Voetbal C','Voetbal D',
      'Volleybal A','Volleybal B','Volleybal C','Volleybal D',
      'Wereldbal A','Wereldbal B','Wereldbal C',
      'Zweefbal A','Zweefbal B'
    ];
    _rw.forEach(n => ins('INSERT INTO sport_items (name,cat,stockage_locatie_id) VALUES (?,?,?)',[n,'sport',_rozenweg.id]));
    _kt.forEach(n => ins('INSERT INTO sport_items (name,cat,stockage_locatie_id) VALUES (?,?,?)',[n,'sport',_kantoor.id]));
    console.log(`  Migratie 20: ${_rw.length + _kt.length} sport_items opnieuw ingevoerd`);
  }

  // Migration 21: frisse start data + kampmomenten Zomer 2026
  // Migration 21+22: frisse start data + kampmomenten + Verkeerspark=Woudlucht
  // Gebruik een blijvende vlag zodat dit maar 1x ooit uitvoert — ook als de kampplanner
  // later bewust leeggemaakt wordt (Migratie 45), mag dit NIET opnieuw vullen.
  createTableIfMissing('CREATE TABLE IF NOT EXISTS app_vlaggen (naam TEXT PRIMARY KEY, waarde TEXT)');
  // Migratie 49 (thema's+materiaal bewust leeggemaakt) mag NIET stilzwijgend ongedaan gemaakt
  // worden door oudere seed-migraties (26/44) die "voeg dit thema toe als het nog niet bestaat"
  // doen — die zouden anders bij elke herstart de net gewiste thema's terug aanmaken.
  const _migratie49AlKlaar=!!get("SELECT naam FROM app_vlaggen WHERE naam='migratie49_klaar'");
  const _mig21Vlag=get("SELECT naam FROM app_vlaggen WHERE naam='migratie21_klaar'");
  const _mig21Done=get("SELECT id FROM kampmomenten WHERE type='kamp' LIMIT 1");
  const _kmCount21=(get('SELECT COUNT(*) as n FROM kampmomenten')||{}).n||0;
  if(!_mig21Vlag && (!_mig21Done || _kmCount21<50)){
    // Migratie 21/22: body verwijderd, zie git-historie; vlag migratie21_klaar blijft als guard
  }
  if(!_mig21Vlag) try{ins('INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES (\'migratie21_klaar\',\'1\')');}catch(e){}

  // Migration 24: kampmomenten fix — Abdijschool Vlierbeek krijgt weken 1-8 (was verkeerd op Abdijschool id=6)
  // Skip volledig als de kampplanner bewust leeggemaakt is (Migratie 45) — anders vult dit week 1 telkens weer aan.
  const _kp45Vlag24=get("SELECT naam FROM app_vlaggen WHERE naam='kampplanner_leeggemaakt'");
  if(!_kp45Vlag24){
    const _avl=get("SELECT id FROM locaties WHERE name='Abdijschool Vlierbeek'");
    const _abd=get("SELECT id FROM locaties WHERE name='Abdijschool'");
    if(_avl){
      const _avlKm=(get('SELECT COUNT(*) as n FROM kampmomenten WHERE locatie_id=?',[_avl.id])||{}).n||0;
      if(_avlKm<8){
        const _pid24=(get('SELECT id FROM vakantieperiodes LIMIT 1')||{}).id||1;
        [1,2,3,4,5,6,7,8].forEach(w=>{
          try{run('INSERT OR IGNORE INTO kampmomenten (locatie_id,week,type,periode_id) VALUES (?,?,?,?)',[_avl.id,w,'kamp',_pid24]);}catch(e){}
        });
        // Verwijder de verkeerde kampmomenten op 'Abdijschool' als die locatie puur een naamsduplicated is
        if(_abd) try{run('DELETE FROM kampmomenten WHERE locatie_id=?',[_abd.id]);}catch(e){}
        console.log('  Migratie 24: Abdijschool Vlierbeek weken 1-8 gezet');
      }
    }
  }

  // Migration 25: 4 thema's week 1 Abdijschool toevoegen
  // Guard: sla over als de 4 themas al correct gekoppeld zijn (was vroeger zonder guard → groeiende duplicaten)
  if(!_migratie49AlKlaar) {
    // Migratie 25: body verwijderd, zie git-historie; vlag migratie49_klaar blijft als guard
  }

  // Migration 40: opruimen kampmoment_themas
  // (a) wees orphaned rows kwijt (thema werd verwijderd maar FK CASCADE werkte niet)
  // (b) verwijder exacte duplicaten (zelfde kampmoment_id+thema_id)
  {
    try{
      const _before40=(get('SELECT COUNT(*) as n FROM kampmoment_themas')||{}).n||0;
      // Orphaned rows: thema_id bestaat niet meer in themas
      db.run(`DELETE FROM kampmoment_themas WHERE thema_id NOT IN (SELECT id FROM themas)`);
      // Echte duplicaten: hou laagste id per paar
      db.run(`DELETE FROM kampmoment_themas WHERE id NOT IN (
        SELECT MIN(id) FROM kampmoment_themas GROUP BY kampmoment_id, thema_id
      )`);
      const _after40=(get('SELECT COUNT(*) as n FROM kampmoment_themas')||{}).n||0;
      if(_before40!==_after40) console.log(`  Migratie 40: ${_before40-_after40} ongeldige/dubbele kampmoment_themas verwijderd`);
    }catch(e){console.error('  Migratie 40 fout:',e.message);}
  }

  // Migration 26: thema_type + is_verbruik + parent_id + 1001BB + Alice themas volledig
  addColumnIfMissing('themas','thema_type',"TEXT DEFAULT 'eigen_materiaal'");
  addColumnIfMissing('thema_materiaal','is_verbruik','INTEGER DEFAULT 0');
  addColumnIfMissing('thema_materiaal','parent_id','INTEGER');
  // Bestaande week-1 themas updaten naar correct type (geen eigen themabundel = eigen_standaard)
  run("UPDATE themas SET thema_type='eigen_standaard' WHERE name IN ('Op schattenjacht met Zino Balino','We slaan in het rond','Lego Legends','Modemakers') AND thema_type='eigen_materiaal'");
  if(!_migratie49AlKlaar) {
    // Migratie 26: body verwijderd (incl. 1001BB/Alice-seeddata), zie git-historie;
    // vlag migratie49_klaar blijft als guard
  }

  // Migration 27: item_types (centrale catalogus) + vaste_bakken + vaste_bak_items
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS item_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naam TEXT NOT NULL,
    eenheid TEXT DEFAULT 'stuk',
    categorie TEXT DEFAULT '',
    notities TEXT DEFAULT ''
  )`);
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS vaste_bakken (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naam TEXT NOT NULL,
    code TEXT DEFAULT '',
    type TEXT DEFAULT 'vast',
    notities TEXT DEFAULT '',
    volgorde INTEGER DEFAULT 0
  )`);
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS vaste_bak_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bak_id INTEGER NOT NULL REFERENCES vaste_bakken(id) ON DELETE CASCADE,
    item_type_id INTEGER REFERENCES item_types(id) ON DELETE SET NULL,
    naam TEXT NOT NULL,
    qty REAL DEFAULT 1,
    eenheid TEXT DEFAULT 'stuk',
    is_verbruik INTEGER DEFAULT 0,
    qty_stock REAL DEFAULT 0,
    qty_minimum REAL DEFAULT 0,
    notitie TEXT DEFAULT '',
    volgorde INTEGER DEFAULT 0
  )`);
  // Seed standaard vaste bakken als ze nog niet bestaan
  // Gegate op _migratie49AlKlaar (S0.1): anders herseedt dit de vaste_bakken die Migratie 49/51
  // bewust gewist heeft, telkens de tabel na het wissen leeg is.
  if(!_migratie49AlKlaar && !(get('SELECT id FROM vaste_bakken LIMIT 1'))){
    const _vb=[
      ['EHBO koffer','EHBO','vast'],
      ['Sportkoffer KLS','SPORT-KLS','vast'],
      ['Sportkoffer LS','SPORT-LS','vast'],
      ['Creabak kampen','CREA','verbruik'],
    ];
    _vb.forEach(([naam,code,type])=>ins('INSERT INTO vaste_bakken (naam,code,type) VALUES (?,?,?)',[naam,code,type]));
    console.log('  Migratie 27: vaste bakken + item_types aangemaakt');
  }

  // Migration 28: nakijk_sessies + nakijk_regels (twee stappen: KV + kantoor)
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS nakijk_sessies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bak_type TEXT NOT NULL DEFAULT 'thema',
    thema_bak_id INTEGER,
    vaste_bak_id INTEGER,
    sport_item_id INTEGER,
    locatie_id INTEGER,
    week INTEGER,
    datum TEXT NOT NULL,
    kv_wie TEXT DEFAULT '',
    kv_tijdstip TEXT DEFAULT '',
    kv_status TEXT DEFAULT 'open',
    kantoor_wie TEXT DEFAULT '',
    kantoor_tijdstip TEXT DEFAULT '',
    kantoor_status TEXT DEFAULT 'open',
    notities TEXT DEFAULT ''
  )`);
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS nakijk_regels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessie_id INTEGER NOT NULL REFERENCES nakijk_sessies(id) ON DELETE CASCADE,
    item_naam TEXT NOT NULL,
    item_id INTEGER,
    verwacht REAL DEFAULT 0,
    aangetroffen REAL DEFAULT 0,
    ontbreekt REAL DEFAULT 0,
    is_kapot INTEGER DEFAULT 0,
    besteld INTEGER DEFAULT 0,
    opmerking TEXT DEFAULT ''
  )`);

  // Migration 29: migreer thema_materiaal (parent_id hiërarchie) → thema_bakken + bak_items
  // Eenmalig: alleen uitvoeren als thema_bakken leeg is maar thema_materiaal niet
  {
    const _tbCount=(get('SELECT COUNT(*) as n FROM thema_bakken')||{}).n||0;
    const _tmCount=(get('SELECT COUNT(*) as n FROM thema_materiaal WHERE parent_id IS NULL')||{}).n||0;
    if(_tbCount===0&&_tmCount>0){
      // Migratie 29: body verwijderd, zie git-historie; guard (thema_bakken leeg + thema_materiaal
      // niet leeg) blijft staan — thema_materiaal wordt sinds Migratie 49 altijd leeg gehouden
    }
  }

  // Migration 30: item_types catalogus seeden + item_type_id FK aan bak_items
  addColumnIfMissing('bak_items','item_type_id','INTEGER');
  addColumnIfMissing('vaste_bak_items','item_type_id','INTEGER'); // al aanwezig maar voor zekerheid
  {
    // Gegate op _migratie49AlKlaar (S0.1): anders herseedt dit de ±95 generieke item_types
    // die Migratie 49/51 bewust gewist heeft, telkens de tabel na het wissen leeg is.
    const _itCount=(get('SELECT COUNT(*) as n FROM item_types')||{}).n||0;
    if(!_migratie49AlKlaar && _itCount===0){
      const _seed=[
        // [categorie, naam, eenheid]
        // ── Sport ──
        ['sport','Bal (generiek)','stuk'],['sport','Zachte bal','stuk'],['sport','Tennisbal','stuk'],
        ['sport','Voetbal','stuk'],['sport','Basketbal','stuk'],['sport','Rugbybal','stuk'],
        ['sport','Waterballon','stuk'],['sport','Ballon','stuk'],['sport','Frisbee','stuk'],
        ['sport','Hoepel','stuk'],['sport','Springtouw','stuk'],['sport','Touw','meter'],
        ['sport','Net','stuk'],['sport','Badmintonracket','stuk'],['sport','Tennisracket','stuk'],
        ['sport','Fluitje','stuk'],['sport','Stok','stuk'],['sport','Bamboestok','stuk'],
        ['sport','Houten rolstok','stuk'],['sport','Mat','stuk'],['sport','Pion','stuk'],
        ['sport','Hindernis','stuk'],['sport','Hesje','stuk'],['sport','Vlag','stuk'],
        ['sport','Stopwatch','stuk'],['sport','Medaille','stuk'],
        // ── Knutsel ──
        ['knutsel','Papier','vel'],['knutsel','Gekleurd papier','vel'],['knutsel','Crepepapier','rol'],
        ['knutsel','Karton','stuk'],['knutsel','Kartonnen doos','stuk'],
        ['knutsel','Lijm','stuk'],['knutsel','Lijmstift','stuk'],['knutsel','Lijmpistool','stuk'],
        ['knutsel','Schaar','stuk'],['knutsel','Tape','rol'],['knutsel','Plakband','rol'],
        ['knutsel','Isolatietape','rol'],['knutsel','Verf','pot'],['knutsel','Penseel','stuk'],
        ['knutsel','Kwast','stuk'],['knutsel','Stempel','stuk'],['knutsel','Wol','bol'],
        ['knutsel','Draad','meter'],['knutsel','Garen','bol'],['knutsel','Elastiek','stuk'],
        ['knutsel','Naald','stuk'],['knutsel','Stof','stuk'],['knutsel','Spons','stuk'],
        ['knutsel','Wasknijper','stuk'],
        // ── Bakken & koken ──
        ['bakken','Bloem','kg'],['bakken','Ei','stuk'],['bakken','Boter','g'],
        ['bakken','Suiker','kg'],['bakken','Melk','liter'],['bakken','Bakpapier','rol'],
        ['bakken','Ingrediënten (algemeen)','set'],
        // ── Spel ──
        ['spel','Dobbelsteen','stuk'],['spel','Kaartje','stuk'],['spel','Speelkaarten','spel'],
        ['spel','Puzzel','stuk'],['spel','Lego','set'],['spel','Blok','stuk'],
        // ── Rekwisieten ──
        ['rekwisiet','Schmink','stuk'],['rekwisiet','Masker','stuk'],['rekwisiet','Cape','stuk'],
        ['rekwisiet','Pruik','stuk'],['rekwisiet','Sjaal','stuk'],['rekwisiet','Decoratie','set'],
        ['rekwisiet','Confetti','pak'],['rekwisiet','Versiering','set'],
        ['rekwisiet','Nummerlabel','stuk'],['rekwisiet','Foto (afdruk)','stuk'],
        ['rekwisiet','Zaklamp','stuk'],['rekwisiet','Waterpistool','stuk'],
        // ── Containers ──
        ['container','Emmer','stuk'],['container','Beker','stuk'],['container','Bord','stuk'],
        ['container','Pot / bakje','stuk'],['container','Mand','stuk'],
        ['container','Fles / petfles','stuk'],['container','Buis','stuk'],
        // ── Gereedschap ──
        ['gereedschap','Schroef','stuk'],['gereedschap','Spijker','stuk'],['gereedschap','Zaag','stuk'],
        // ── Diversen ──
        ['diversen','Magneet','stuk'],['diversen','Krijt','stuk'],['diversen','Stoepkrijt','stuk'],
        ['diversen','Zand','kg'],
      ];
      _seed.forEach(([cat,naam,eenheid])=>ins('INSERT INTO item_types (naam,eenheid,categorie) VALUES (?,?,?)',[naam,eenheid,cat]));
      console.log(`  Migratie 30: ${_seed.length} item_types gezaaid`);
    }
    // Auto-koppel bak_items aan item_types via naam-aliassen (NL enkelvoud/meervoud)
    const _aliases={
      // sport
      'bal':['bal (generiek)'],'ballen':['bal (generiek)'],
      'zachte bal':['zachte bal'],'zachte ballen':['zachte bal'],
      'tennisbal':['tennisbal'],'tennisballen':['tennisbal'],
      'voetbal':['voetbal'],'voetballen':['voetbal'],
      'basketbal':['basketbal'],'basketballen':['basketbal'],
      'rugbybal':['rugbybal'],'rugbyballen':['rugbybal'],
      'waterballon':['waterballon'],'waterballonnen':['waterballon'],
      'ballon':['ballon'],'ballonnen':['ballon'],
      'frisbee':['frisbee'],'frisbees':['frisbee'],
      'hoepel':['hoepel'],'hoepels':['hoepel'],
      'springtouw':['springtouw'],'springtouwen':['springtouw'],
      'touw':['touw'],'touwen':['touw'],'touwtje':['touw'],'touwtjes':['touw'],
      'net':['net'],'netten':['net'],
      'badmintonracket':['badmintonracket'],'badmintonrackets':['badmintonracket'],
      'tennisracket':['tennisracket'],'tennisrackets':['tennisracket'],
      'fluitje':['fluitje'],'fluit':['fluitje'],
      'stok':['stok'],'stokken':['stok'],
      'bamboestok':['bamboestok'],'bamboestokken':['bamboestok'],'bamboe':['bamboestok'],
      'houten':['houten rolstok'],'houten rolstok':['houten rolstok'],
      'mat':['mat'],'matten':['mat'],
      'pion':['pion'],'pionnen':['pion'],
      'hindernis':['hindernis'],'hindernissen':['hindernis'],
      'hesje':['hesje'],'hesjes':['hesje'],
      'vlag':['vlag'],'vlaggen':['vlag'],
      'stopwatch':['stopwatch'],'medaille':['medaille'],'medailles':['medaille'],
      // knutsel
      'papier':['papier'],'gekleurd papier':['gekleurd papier'],
      'crepepapier':['crepepapier'],
      'karton':['karton'],'kartonnen':['karton'],
      'kartonnen doos':['kartonnen doos'],'dozen':['kartonnen doos'],
      'lijm':['lijm'],'lijmstift':['lijmstift'],'lijmstiften':['lijmstift'],
      'lijmpistool':['lijmpistool'],
      'schaar':['schaar'],'scharen':['schaar'],
      'tape':['tape'],'plakband':['plakband'],
      'isolatietape':['isolatietape'],
      'verf':['verf'],
      'penseel':['penseel'],'penselen':['penseel'],
      'kwast':['kwast'],'kwasten':['kwast'],
      'stempel':['stempel'],'stempels':['stempel'],
      'wol':['wol'],'wollen':['wol'],
      'draad':['draad'],
      'garen':['garen'],
      'elastiek':['elastiek'],'elastieken':['elastiek'],
      'naald':['naald'],'naalden':['naald'],
      'stof':['stof'],'stoffen':['stof'],
      'spons':['spons'],'sponsjes':['spons'],
      'wasknijper':['wasknijper'],'wasknijpers':['wasknijper'],
      'knijper':['wasknijper'],'knijpers':['wasknijper'],
      // bakken
      'bloem':['bloem'],'ei':['ei'],'eieren':['ei'],
      'boter':['boter'],'suiker':['suiker'],'melk':['melk'],
      'bakpapier':['bakpapier'],
      'ingrediënten':['ingrediënten (algemeen)'],
      // spel
      'dobbelsteen':['dobbelsteen'],'dobbelstenen':['dobbelsteen'],
      'kaartje':['kaartje'],'kaartjes':['kaartje'],
      'speelkaarten':['speelkaarten'],
      'puzzel':['puzzel'],
      'lego':['lego'],'legoblokjes':['lego'],
      'blok':['blok'],'blokken':['blok'],
      // rekwisieten
      'schmink':['schmink'],'masker':['masker'],'maskers':['masker'],
      'cape':['cape'],'capes':['cape'],
      'pruik':['pruik'],'sjaal':['sjaal'],
      'decoratie':['decoratie'],'confetti':['confetti'],
      'versiering':['versiering'],'versieringen':['versiering'],
      'nummer':['nummerlabel'],'nummers':['nummerlabel'],
      'foto':['foto (afdruk)'],
      'zaklamp':['zaklamp'],'zaklampen':['zaklamp'],
      'waterpistool':['waterpistool'],'waterpistolen':['waterpistool'],
      // containers
      'emmer':['emmer'],'emmers':['emmer'],
      'beker':['beker'],'bekers':['beker'],
      'bord':['bord'],'borden':['bord'],'bordje':['bord'],'bordjes':['bord'],
      'pot':['pot / bakje'],'potje':['pot / bakje'],'potjes':['pot / bakje'],'potten':['pot / bakje'],
      'mand':['mand'],'mandje':['mand'],'mandjes':['mand'],
      'fles':['fles / petfles'],'flessen':['fles / petfles'],'petfles':['fles / petfles'],'petflessen':['fles / petfles'],'lege flessen':['fles / petfles'],
      'buis':['buis'],'buizen':['buis'],'buisje':['buis'],'buisjes':['buis'],
      // gereedschap
      'schroef':['schroef'],'schroeven':['schroef'],
      'spijker':['spijker'],'spijkers':['spijker'],
      'zaag':['zaag'],'zaagje':['zaag'],
      // diversen
      'magneet':['magneet'],'magneten':['magneet'],
      'krijt':['krijt'],'krijtje':['krijt'],'krijtjes':['krijt'],
      'stoepkrijt':['stoepkrijt'],
      'zand':['zand'],
    };
    const _typesByNaam={};
    all('SELECT id,naam FROM item_types').forEach(t=>{_typesByNaam[t.naam.toLowerCase()]=t.id;});
    const _unmatched=all('SELECT id,naam FROM bak_items WHERE item_type_id IS NULL');
    let _linked=0;
    _unmatched.forEach(bi=>{
      const sleutel=(bi.naam||'').toLowerCase().trim();
      const doelNamen=_aliases[sleutel];
      if(!doelNamen)return;
      const typeId=_typesByNaam[doelNamen[0]];
      if(typeId){run('UPDATE bak_items SET item_type_id=? WHERE id=?',[typeId,bi.id]);_linked++;}
    });
    if(_linked>0)console.log(`  Migratie 30: ${_linked} bak_items automatisch gekoppeld aan item_types`);
  }

  // Migration 31: item_type_id aan verbruik_stock + personeel tabellen
  addColumnIfMissing('verbruik_stock','item_type_id','INTEGER');
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS personeel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naam TEXT NOT NULL,
    rol TEXT DEFAULT 'kv',
    telefoon TEXT DEFAULT '',
    email TEXT DEFAULT '',
    notities TEXT DEFAULT ''
  )`);
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS personeel_shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    persoon_id INTEGER NOT NULL REFERENCES personeel(id) ON DELETE CASCADE,
    kampmoment_id INTEGER REFERENCES kampmomenten(id) ON DELETE SET NULL,
    locatie_id INTEGER REFERENCES locaties(id) ON DELETE SET NULL,
    datum TEXT,
    van_uur TEXT DEFAULT '',
    tot_uur TEXT DEFAULT '',
    rol_dag TEXT DEFAULT '',
    notities TEXT DEFAULT ''
  )`);
  // Auto-koppel verbruik_stock aan item_types via naam van materiaal_items
  {
    const _vsAliassen={
      'crepepapier':['crepepapier'],'papier':['papier'],'gekleurd papier':['gekleurd papier'],
      'karton':['karton'],'lijm':['lijm'],'verf':['verf'],'schaar':['schaar'],
      'tape':['tape'],'plakband':['plakband'],'wol':['wol'],'ballonnen':['ballon'],
      'ballon':['ballon'],'touw':['touw'],'hoepel':['hoepel'],'hoepels':['hoepel'],
      'wasknijpers':['wasknijper'],'wasknijper':['wasknijper'],
      'voetbal':['voetbal'],'tennisbal':['tennisbal'],'basketbal':['basketbal'],
      'krijt':['krijt'],'stoepkrijt':['stoepkrijt'],'stempel':['stempel'],
      'penseel':['penseel'],'penselen':['penseel'],'kwast':['kwast'],
      'elastiek':['elastiek'],'spons':['spons'],
    };
    const _itMap={};
    all('SELECT id,naam FROM item_types').forEach(t=>{_itMap[t.naam.toLowerCase()]=t.id;});
    const _vsItems=all(`SELECT vs.id, mi.name FROM verbruik_stock vs
      JOIN materiaal_items mi ON mi.id=vs.item_id WHERE vs.item_type_id IS NULL`);
    let _vsLinked=0;
    _vsItems.forEach(vs=>{
      const sleutel=(vs.name||'').toLowerCase().trim();
      const doelNamen=_vsAliassen[sleutel];
      if(!doelNamen)return;
      const typeId=_itMap[doelNamen[0]];
      if(typeId){run('UPDATE verbruik_stock SET item_type_id=? WHERE id=?',[typeId,vs.id]);_vsLinked++;}
    });
    if(_vsLinked>0)console.log(`  Migratie 31: ${_vsLinked} verbruik_stock gekoppeld aan item_types`);
  }

  // Migration 32: themas extra kolommen + seeden vanuit data/themas-seed.json
  addColumnIfMissing('themas','leeftijdsgroep','TEXT DEFAULT \'\'');
  addColumnIfMissing('themas','thema_type','TEXT DEFAULT \'eigen\'');
  if(!_migratie49AlKlaar) {
    // Migratie 32: body verwijderd, zie git-historie; vlag migratie49_klaar blijft als guard
  }

  // Migration 33: verwijder nep-themas (thema_type 'eigen'/'eigen_standaard' van de oude seed),
  // voeg echte themas toe vanuit data/themas-seed.json (opnieuw seeden met echte namen)
  {
    const _vlag33=get("SELECT naam FROM app_vlaggen WHERE naam='migratie33_klaar'");
    if(_vlag33){console.log('  Migratie 33: al uitgevoerd, overgeslagen');}
    else{
    // Migratie 33: body verwijderd, zie git-historie; vlag migratie33_klaar blijft als guard
    try{ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie33_klaar','1')");}catch(e){}
    } // end if(!_vlag33)
  }

  // Migration 34: ontbrekende item_types toevoegen
  {
    const _extra34=[
      ['sport','Helm','stuk'],
      ['sport','Trampoline','stuk'],
      ['sport','Lasso','stuk'],
      ['knutsel','Krijt (knutsel)','stuk'],
      ['rekwisiet','Ballon','stuk'],
    ];
    for(const [cat,naam,eenheid] of _extra34){
      if(!get('SELECT id FROM item_types WHERE naam=?',[naam])){
        ins('INSERT INTO item_types (naam,eenheid,categorie) VALUES (?,?,?)',[naam,eenheid,cat]);
      }
    }
  }

  // Migration 35: body verwijderd, zie git-historie (was ongegate maar effectief een no-op
  // sinds Migratie 49 themas altijd leeg houdt)
  {}

  // Migration 36: echte bakken + items uit PDF-bundels zaaien (vervangt nep-items)
  {
    const _vlag36=get("SELECT naam FROM app_vlaggen WHERE naam='migratie36_klaar'");
    if(_vlag36){console.log('  Migratie 36: al uitgevoerd, overgeslagen');}
    else{
    // Migratie 36: body verwijderd, zie git-historie; vlag migratie36_klaar blijft als guard
    try{ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie36_klaar','1')");}catch(e){}
    } // end if(!_vlag36)
  }

  // Migration 37: themedagen zaaien uit PDF-bundels (thema_type='themadag')
  {
    const _vlag37=get("SELECT naam FROM app_vlaggen WHERE naam='migratie37_klaar'");
    if(_vlag37){console.log('  Migratie 37: al uitgevoerd, overgeslagen');}
    else{
    // Migratie 37: body verwijderd, zie git-historie; vlag migratie37_klaar blijft als guard
    try{ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie37_klaar','1')");}catch(e){}
    } // end if(!_vlag37)
  }

  // Migration 39: heeft_kookactiviteit op themas
  addColumnIfMissing('themas','heeft_kookactiviteit',"INTEGER DEFAULT 0");

  // Migration 41: sport_items zonder sets krijgen automatisch 1 set
  // (de letter/code in de naam IS de set-identifier, bv. "Archery tag A" = set "A" van "Archery tag")
  {
    const _itemsZonderSet=all(`SELECT si.id,si.name,si.stockage_locatie_id FROM sport_items si
      WHERE NOT EXISTS (SELECT 1 FROM sport_sets ss WHERE ss.item_id=si.id)`);
    if(_itemsZonderSet.length>0){
      _itemsZonderSet.forEach(si=>{
        // Label = laatste woord als het 1-3 letters/cijfers is, anders "1"
        const parts=si.name.trim().split(/\s+/);
        const lastWord=parts[parts.length-1];
        const label=/^[A-Z0-9]{1,3}$/.test(lastWord)?lastWord:'1';
        ins('INSERT INTO sport_sets (item_id,label,locatie_id) VALUES (?,?,?)',[si.id,label,si.stockage_locatie_id||null]);
      });
      console.log(`  Migratie 41: ${_itemsZonderSet.length} sport_sets aangemaakt`);
    }
  }

  // Migration 42: sport_planning seeden vanuit data/sport-planning-seed.json
  // Gegate via app_vlaggen 'migratie42_klaar' — was een tijdbom (herseedde telkens de tabel
  // toevallig <100 rijen had, bv. na een bewuste opkuis). Draait nooit meer na de eerste keer.
  {
    const _mig42Vlag=get("SELECT naam FROM app_vlaggen WHERE naam='migratie42_klaar'");
    const _sp42=path.join(__dirname,'data','sport-planning-seed.json');
    if(!_mig42Vlag) try{ins('INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES (\'migratie42_klaar\',\'1\')');}catch(e){}
    if(!_mig42Vlag && fs.existsSync(_sp42)){
      const _bestaand=(get('SELECT COUNT(*) as n FROM sport_planning')||{}).n||0;
      if(_bestaand<100){
        let _seed42=[];
        try{_seed42=JSON.parse(fs.readFileSync(_sp42,'utf8'));}catch(e){console.error('  Migratie 42: JSON onleesbaar:',e.message);}
        // Bouw caches voor snelheid
        const _siCache={};
        all('SELECT id,name FROM sport_items').forEach(si=>{_siCache[si.name.toLowerCase().trim()]=si.id;});
        const _ssCache={};
        all('SELECT id,item_id FROM sport_sets').forEach(ss=>{if(!_ssCache[ss.item_id])_ssCache[ss.item_id]=ss.id;});
        const _locCache={};
        all('SELECT id,name FROM locaties').forEach(l=>{_locCache[l.name.toLowerCase().trim()]=l.id;});
        let _added42=0,_skip42=0;
        const _skip42Items=new Set();
        for(const entry of _seed42){
          if(!entry.pakket||entry.pakket==='en 10+ spelen'){continue;}
          const locId=_locCache[(entry.locatie||'').toLowerCase().trim()];
          if(!locId){_skip42++;continue;}
          const siId=_siCache[entry.pakket.toLowerCase().trim()];
          if(!siId){_skip42Items.add(entry.pakket);_skip42++;continue;}
          const ssId=_ssCache[siId];
          if(!ssId){_skip42++;continue;}
          try{run('INSERT OR IGNORE INTO sport_planning (set_id,locatie_id,week) VALUES (?,?,?)',[ssId,locId,entry.week]);_added42++;}catch(e){}
        }
        if(_added42>0)console.log(`  Migratie 42: ${_added42} sport_planning entries gezaaid (${_skip42} overgeslagen)`);
        if(_skip42Items.size>0)console.log('  Migratie 42: niet-gematchte pakketten:',JSON.stringify([..._skip42Items]));
      }
    }
  }

  // Migration 44: ontbrekende themas aanmaken + koppelen aan week 1
  if(!_migratie49AlKlaar) {
    // Migratie 44: body verwijderd, zie git-historie; vlag migratie49_klaar blijft als guard
  }

  // Migration 45: kampplanner volledig leegmaken op uitdrukkelijk verzoek (eenmalig!)
  // Themas, locaties, sportplanning en materiaal-catalogus blijven ongemoeid.
  // Loopt maar 1x — anders zou elke herstart later manueel toegevoegde kampen weer wissen.
  {
    const _vlag45=get("SELECT naam FROM app_vlaggen WHERE naam='kampplanner_leeggemaakt'");
    if(!_vlag45){
      // Migratie 45: body verwijderd, zie git-historie; vlag kampplanner_leeggemaakt blijft als guard
      try{ins('INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES (\'kampplanner_leeggemaakt\',\'1\')');}catch(e){}
    }
  }

  // Migration 43: body verwijderd, zie git-historie (was ongegate maar effectief een no-op
  // sinds Migratie 49 themas altijd leeg houdt)
  {}

  // Migration 38: standaarddozen + locatie-eigenschappen
  {
    createTableIfMissing(`CREATE TABLE IF NOT EXISTS standaard_dozen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      naam TEXT NOT NULL UNIQUE,
      opslagcode TEXT DEFAULT '',
      conditie_type TEXT DEFAULT 'altijd',
      conditie_waarde TEXT DEFAULT '',
      qty_default INTEGER DEFAULT 1,
      volgorde INTEGER DEFAULT 0
    )`);
    createTableIfMissing(`CREATE TABLE IF NOT EXISTS standaard_doos_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doos_id INTEGER NOT NULL,
      naam TEXT NOT NULL,
      qty INTEGER DEFAULT 1,
      eenheid TEXT DEFAULT 'stuk',
      verbruik INTEGER DEFAULT 0,
      was_item INTEGER DEFAULT 0,
      FOREIGN KEY(doos_id) REFERENCES standaard_dozen(id) ON DELETE CASCADE
    )`);
    createTableIfMissing(`CREATE TABLE IF NOT EXISTS locatie_doos_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      locatie_id INTEGER NOT NULL,
      doos_id INTEGER NOT NULL,
      qty INTEGER,
      actief INTEGER DEFAULT 1,
      UNIQUE(locatie_id, doos_id),
      FOREIGN KEY(locatie_id) REFERENCES locaties(id) ON DELETE CASCADE,
      FOREIGN KEY(doos_id) REFERENCES standaard_dozen(id) ON DELETE CASCADE
    )`);
    addColumnIfMissing('locaties','heeft_eigen_sportmateriaal',"INTEGER DEFAULT 0");
    addColumnIfMissing('locaties','heeft_eigen_oven',"INTEGER DEFAULT 0");
    // Zaai de 7 standaarddozen
    const _dozen38=[
      {naam:'EHBO Koffer',opslagcode:'',conditie_type:'altijd',conditie_waarde:'',qty_default:1,volgorde:1,items:[
        {naam:'Ontsmettingsmiddel',qty:1,eenheid:'set',verbruik:1,was_item:0},
        {naam:'Kompressen',qty:1,eenheid:'set',verbruik:1,was_item:0},
        {naam:'Pleisters',qty:1,eenheid:'set',verbruik:1,was_item:0},
        {naam:'Windel',qty:1,eenheid:'stuk',verbruik:1,was_item:0},
        {naam:'Slotjes',qty:1,eenheid:'stuk',verbruik:1,was_item:0},
        {naam:'Tape',qty:1,eenheid:'rol',verbruik:1,was_item:0},
        {naam:'Brandwondenzalf',qty:1,eenheid:'tube',verbruik:1,was_item:0},
        {naam:'Zalf tegen insectenbeten',qty:1,eenheid:'tube',verbruik:1,was_item:0},
        {naam:'Coldpacks',qty:2,eenheid:'stuk',verbruik:1,was_item:0},
        {naam:'Schaartje',qty:1,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Pincet',qty:1,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Thermometer',qty:1,eenheid:'stuk',verbruik:0,was_item:0},
      ]},
      {naam:'Kuisbak',opslagcode:'',conditie_type:'locatie',conditie_waarde:'kuisbak',qty_default:1,volgorde:2,items:[
        {naam:'Allesreiniger',qty:1,eenheid:'bus',verbruik:1,was_item:0},
        {naam:'Keukenhanddoeken',qty:2,eenheid:'stuk',verbruik:1,was_item:0},
        {naam:'Afwasproduct',qty:1,eenheid:'bus',verbruik:1,was_item:0},
        {naam:'Emmer',qty:1,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'WC-product',qty:1,eenheid:'bus',verbruik:1,was_item:0},
        {naam:'Keukenrol',qty:1,eenheid:'rol',verbruik:1,was_item:0},
        {naam:'WC-papier',qty:1,eenheid:'rol',verbruik:1,was_item:0},
        {naam:'Borstels',qty:2,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'WC-borstel',qty:1,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Aftrekkers',qty:2,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Handzeep (klein)',qty:6,eenheid:'busje',verbruik:1,was_item:0},
        {naam:'Vuilblik',qty:1,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Refill handzeep (groot)',qty:1,eenheid:'bus',verbruik:1,was_item:0},
        {naam:'Handdoekjes',qty:2,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Dweilen',qty:4,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Allesreiniger spray',qty:1,eenheid:'bus',verbruik:1,was_item:0},
        {naam:'Schotelvodden',qty:2,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Blauwe vuilniszakken',qty:1,eenheid:'rol',verbruik:1,was_item:0},
        {naam:'Doorzichtige vuilzakken',qty:1,eenheid:'rol',verbruik:1,was_item:0},
      ]},
      {naam:'Afwasbak',opslagcode:'',conditie_type:'thema',conditie_waarde:'kookactiviteit',qty_default:1,volgorde:3,items:[
        {naam:'Afwasmiddel',qty:1,eenheid:'bus',verbruik:1,was_item:0},
        {naam:'Vodden',qty:6,eenheid:'stuk',verbruik:0,was_item:1},
        {naam:'Sponsjes',qty:6,eenheid:'stuk',verbruik:1,was_item:0},
        {naam:'Keukenhanddoeken (afwas)',qty:10,eenheid:'stuk',verbruik:0,was_item:1},
        {naam:'Kookschorten',qty:20,eenheid:'stuk',verbruik:0,was_item:1},
      ]},
      {naam:'Sportkoffer Kleuters',opslagcode:'',conditie_type:'leeftijdsgroep',conditie_waarde:'kleuters',qty_default:1,volgorde:4,items:[]},
      {naam:'Sportkoffer Lagere School',opslagcode:'',conditie_type:'leeftijdsgroep',conditie_waarde:'lagere school',qty_default:1,volgorde:5,items:[
        {naam:'Potjes',qty:40,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Kegels',qty:10,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Partijvesten',qty:10,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Pittenzakken',qty:20,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Kleine hoepels',qty:20,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Tennisballen',qty:20,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Kleine mousseballen',qty:20,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Gekleurde touwtjes',qty:20,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Frisbees',qty:10,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Dik trektouw',qty:1,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Toversnoer',qty:1,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Baseballbat',qty:1,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Tennisracket',qty:1,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Voetbal',qty:1,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Mousse bal',qty:1,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Rugby bal',qty:1,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Dobbelstenen',qty:2,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Verlengkabel',qty:1,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Parachute',qty:1,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Ballonnen',qty:1,eenheid:'zakje',verbruik:1,was_item:0},
        {naam:'Fit-o-meter (map sportoefeningen)',qty:1,eenheid:'stuk',verbruik:0,was_item:0},
      ]},
      {naam:'Creakoffer Kampen',opslagcode:'',conditie_type:'locatie',conditie_waarde:'creakoffer',qty_default:1,volgorde:6,items:[
        {naam:'Vloeibare lijm',qty:1,eenheid:'fles',verbruik:1,was_item:0},
        {naam:'Lijmstiften',qty:1,eenheid:'set',verbruik:1,was_item:0},
        {naam:'Behangerslijm',qty:1,eenheid:'pot',verbruik:1,was_item:0},
        {naam:'Stiften',qty:1,eenheid:'set',verbruik:1,was_item:0},
        {naam:'Penselen',qty:1,eenheid:'set',verbruik:0,was_item:0},
        {naam:'Touw',qty:1,eenheid:'bol',verbruik:1,was_item:0},
        {naam:'Nietjesmachine',qty:1,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Perforator',qty:1,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Nietjes',qty:1,eenheid:'doos',verbruik:1,was_item:0},
        {naam:'Scharen',qty:16,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Gommen',qty:1,eenheid:'set',verbruik:1,was_item:0},
        {naam:'Slijpers',qty:1,eenheid:'set',verbruik:0,was_item:0},
        {naam:'Plakband',qty:1,eenheid:'rol',verbruik:1,was_item:0},
        {naam:'WC-rolletjes',qty:1,eenheid:'set',verbruik:1,was_item:0},
        {naam:'Wasco\'s',qty:1,eenheid:'set',verbruik:1,was_item:0},
        {naam:'Plastic tafeldoeken',qty:1,eenheid:'set',verbruik:1,was_item:0},
        {naam:'Kleurpotloden',qty:1,eenheid:'set',verbruik:1,was_item:0},
        {naam:'Plastic potjes voor verf',qty:1,eenheid:'set',verbruik:0,was_item:0},
        {naam:'Verf T-shirts',qty:20,eenheid:'stuk',verbruik:0,was_item:1},
        {naam:'Wit en gekleurd papier',qty:1,eenheid:'pak',verbruik:1,was_item:0},
      ]},
      {naam:'Kleuterkriebels',opslagcode:'',conditie_type:'programma',conditie_waarde:'kleuterkriebels',qty_default:1,volgorde:7,items:[
        {naam:'Houten puzzels',qty:5,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Mand met boeken',qty:1,eenheid:'mand',verbruik:0,was_item:0},
        {naam:'Grote kartonnen buizen',qty:1,eenheid:'set',verbruik:0,was_item:0},
        {naam:'Plastic bekers',qty:1,eenheid:'set',verbruik:0,was_item:0},
        {naam:'Schoendozen',qty:1,eenheid:'set',verbruik:0,was_item:0},
        {naam:'Eierdozen',qty:1,eenheid:'set',verbruik:0,was_item:0},
        {naam:'Bak met bonen',qty:1,eenheid:'bak',verbruik:0,was_item:0},
        {naam:'Bak met schelpen/flessendoppen/veters/glazen steentjes',qty:1,eenheid:'bak',verbruik:0,was_item:0},
        {naam:'Ondiepe plastic bakken',qty:2,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Automat',qty:1,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Invitations to play (gelamineerd)',qty:3,eenheid:'stuk',verbruik:0,was_item:0},
        {naam:'Bak houten ringen/stokjes/poppetjes/regenboog',qty:1,eenheid:'bak',verbruik:0,was_item:0},
        {naam:'Houten reuzedomino',qty:1,eenheid:'set',verbruik:0,was_item:0},
        {naam:'Emmer noppers',qty:1,eenheid:'emmer',verbruik:0,was_item:0},
        {naam:'Emmer houten blokken',qty:1,eenheid:'emmer',verbruik:0,was_item:0},
        {naam:'Emmer natuurblokken',qty:1,eenheid:'emmer',verbruik:0,was_item:0},
        {naam:'Emmer autootjes',qty:1,eenheid:'emmer',verbruik:0,was_item:0},
        {naam:'Emmer dieren',qty:1,eenheid:'emmer',verbruik:0,was_item:0},
        {naam:'Emmer wc-rollen',qty:1,eenheid:'emmer',verbruik:0,was_item:0},
        {naam:'Emmer pingpongballetjes',qty:1,eenheid:'emmer',verbruik:0,was_item:0},
        {naam:'Emmer stukken stof',qty:1,eenheid:'emmer',verbruik:0,was_item:0},
        {naam:'Emmer wasknijpers/bekers/schepjes',qty:1,eenheid:'emmer',verbruik:0,was_item:0},
        {naam:'Emmer keukenspulletjes',qty:1,eenheid:'emmer',verbruik:0,was_item:0},
        {naam:'Emmer dennenappels',qty:1,eenheid:'emmer',verbruik:0,was_item:0},
        {naam:'Emmer plasticine',qty:1,eenheid:'emmer',verbruik:0,was_item:0},
      ]},
    ];
    // Gegate op _migratie49AlKlaar (S0.1): anders herseedt dit de 7 standaarddozen die
    // Migratie 49/51 bewust gewist heeft, telkens een doos-naam toevallig niet meer bestaat.
    for(const doos of (_migratie49AlKlaar?[]:_dozen38)){
      let doosRow=get('SELECT id FROM standaard_dozen WHERE naam=?',[doos.naam]);
      if(!doosRow){
        const doosId=ins('INSERT INTO standaard_dozen (naam,opslagcode,conditie_type,conditie_waarde,qty_default,volgorde) VALUES (?,?,?,?,?,?)',
          [doos.naam,doos.opslagcode||'',doos.conditie_type,doos.conditie_waarde,doos.qty_default,doos.volgorde]);
        doosRow={id:doosId};
        for(const item of doos.items){
          ins('INSERT INTO standaard_doos_items (doos_id,naam,qty,eenheid,verbruik,was_item) VALUES (?,?,?,?,?,?)',
            [doosRow.id,item.naam,item.qty,item.eenheid,item.verbruik,item.was_item]);
        }
      }
    }
    console.log('  Migratie 38: standaarddozen + locatie-eigenschappen klaar');
  }

  // Migration 23: transporten uit oude database wissen (eenmalig, gated)
  {
    const _vlag23=get("SELECT naam FROM app_vlaggen WHERE naam='migratie23_klaar'");
    if(!_vlag23){
      // Migratie 23: body verwijderd, zie git-historie; vlag migratie23_klaar blijft als guard
      try{ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie23_klaar','1')");}catch(e){}
    }
  }

  // Migration 46: kleurenborden_stock — voorraad per kleur per stockagelocatie
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS kleurenborden_stock (
    locatie_id INTEGER NOT NULL,
    kleur TEXT NOT NULL,
    aantal INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (locatie_id, kleur)
  )`);

  // Migration 47: consolidatie — item_types wordt de verplichte centrale materiaalcatalogus.
  // Alle losse "naam"-tekstvelden in bak_items, vaste_bak_items, sport_items, gedeeld_items,
  // materiaal_items, thema_materiaal, standaard_materiaal, locatie_materiaal, transport_regels
  // en standaard_doos_items krijgen een item_type_id die verplicht naar item_types wijst.
  // In tegenstelling tot de oude alias-only matching (migratie 30/31, die onbekende
  // spellingen stilzwijgend oversloeg) wordt hier voor élke naam die nog niet in item_types
  // bestaat automatisch een nieuwe catalogusrij aangemaakt — dus 100% dekking, geen weesitems.
  {
    const _koppelTabellen47 = [
      ['bak_items','naam',undefined],
      ['vaste_bak_items','naam',undefined],
      ['sport_items','name','sport'],
      ['gedeeld_items','name','gedeeld'],
      ['materiaal_items','name',undefined],
      ['thema_materiaal','name',undefined],
      ['standaard_materiaal','name',undefined],
      ['locatie_materiaal','name',undefined],
      ['transport_regels','naam',undefined],
      ['standaard_doos_items','naam',undefined],
    ];
    let _totaalGekoppeld47 = 0;
    _koppelTabellen47.forEach(([tabel,kolom,categorieHint])=>{
      addColumnIfMissing(tabel,'item_type_id','INTEGER');
      let rijen;
      try { rijen = all(`SELECT id,${kolom} as naam FROM ${tabel} WHERE item_type_id IS NULL`); }
      catch(e){ console.error(`  Migratie 47 fout bij lezen ${tabel} (niet-fataal):`,e.message); return; }
      rijen.forEach(r=>{
        const typeId = resolveItemTypeId(r.naam, categorieHint);
        if (typeId) { run(`UPDATE ${tabel} SET item_type_id=? WHERE id=?`,[typeId,r.id]); _totaalGekoppeld47++; }
      });
    });
    if (_totaalGekoppeld47>0) console.log(`  Migratie 47: ${_totaalGekoppeld47} materiaalrijen gekoppeld aan item_types (centrale catalogus)`);
  }

  // Migration 48: chauffeurs → personeel consolidatie (twee losse "wie is chauffeur"-bronnen).
  // chauffeurs blijft bestaan (ploeg_shifts verwijst er nog naar), maar elke chauffeur krijgt nu
  // ook een gekoppelde personeel-rij zodat personeel dé volledige, centrale personen-catalogus is.
  {
    addColumnIfMissing('chauffeurs','personeel_id','INTEGER');
    addColumnIfMissing('transport_ritten','personeel_id','INTEGER');
    const _chauffeursZonderPersoneel = all('SELECT id,name FROM chauffeurs WHERE personeel_id IS NULL');
    _chauffeursZonderPersoneel.forEach(c=>{
      let p = get('SELECT id FROM personeel WHERE LOWER(naam)=LOWER(?) AND rol=?',[c.name,'chauffeur']);
      if(!p) p = { id: ins('INSERT INTO personeel (naam,rol) VALUES (?,?)',[c.name,'chauffeur']) };
      run('UPDATE chauffeurs SET personeel_id=? WHERE id=?',[p.id,c.id]);
    });
    if(_chauffeursZonderPersoneel.length>0) console.log(`  Migratie 48: ${_chauffeursZonderPersoneel.length} chauffeurs gekoppeld aan personeel`);
    // transport_ritten.chauffeur is vrije tekst (naam) — koppel achteraf aan personeel via naam-match
    const _ritten48 = all('SELECT id,chauffeur FROM transport_ritten WHERE personeel_id IS NULL AND chauffeur IS NOT NULL AND chauffeur<>\'\'');
    let _rittenGekoppeld=0;
    _ritten48.forEach(r=>{
      const p = get('SELECT id FROM personeel WHERE LOWER(naam)=LOWER(?)',[r.chauffeur]);
      if(p){ run('UPDATE transport_ritten SET personeel_id=? WHERE id=?',[p.id,r.id]); _rittenGekoppeld++; }
    });
    if(_rittenGekoppeld>0) console.log(`  Migratie 48: ${_rittenGekoppeld} transport_ritten gekoppeld aan personeel`);
  }

  // Migration 49: EENMALIGE opkuis op vraag van Maxim — thema's en al het materiaal volledig
  // gewist, zodat alles samen stuk per stuk proper opnieuw opgebouwd kan worden. Sportpakketten
  // (sport_items/sport_sets/sport_planning), locaties en personeel blijven ongemoeid.
  // Gegated via app_vlaggen: dit mag maar 1 keer gebeuren, anders wist elke herstart opnieuw
  // alle nieuw ingevoerde thema's/materiaal.
  {
    const _vlag49=get("SELECT naam FROM app_vlaggen WHERE naam='migratie49_klaar'");
    if(!_vlag49){
      const _wisTabellen49=[
        'kampmoment_themas','bak_fotos','bak_nakijk_log','bak_items','thema_bakken',
        'thema_materiaal','thema_categorieen','themas',
        'nakijk_regels','nakijk_sessies',
        'terugkomst_regels','terugkomst_rapporten',
        'gedeeld_gebruik','gedeeld_stock','gedeeld_items',
        'vaste_bak_items','vaste_bakken',
        'standaard_doos_items','locatie_doos_config','standaard_dozen',
        'kamp_basis_afwijking','standaard_materiaal',
        'locatie_materiaal',
        'kleurenborden_stock','locatie_kleuren',
        'verbruik_log','verbruik_stock','materiaal_eenheden','verplaatsingen','materiaal_items',
        'spoedmeldingen',
        'item_types',
      ];
      _wisTabellen49.forEach(t=>{
        try{ db.run(`DELETE FROM ${t}`); }
        catch(e){ console.error(`  Migratie 49 fout bij wissen ${t} (niet-fataal):`,e.message); }
      });
      console.log(`  Migratie 49: thema's en materiaal volledig gewist (${_wisTabellen49.length} tabellen) — sportpakketten, locaties, personeel blijven behouden`);
      try{ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie49_klaar','1')");}catch(e){}
    }
  }

  // Migration 50: EENMALIGE correctie — tijdens het testen van Migratie 49 werden themas
  // per ongeluk 1x teruggezaaid door migraties 25/26/32/44 (nu allemaal gegate op
  // _migratie49AlKlaar, zie hierboven), vóór die gates er stonden. Ruimt dat resultaat nog
  // eens op. Enkel thema-tabellen; sport/personeel/locaties blijven ongemoeid.
  {
    const _vlag50=get("SELECT naam FROM app_vlaggen WHERE naam='migratie50_klaar'");
    if(!_vlag50){
      const _wisTabellen50=['kampmoment_themas','bak_fotos','bak_nakijk_log','bak_items','thema_bakken','thema_materiaal','thema_categorieen','themas'];
      _wisTabellen50.forEach(t=>{ try{ db.run(`DELETE FROM ${t}`); }catch(e){console.error(`  Migratie 50 fout bij wissen ${t} (niet-fataal):`,e.message);} });
      console.log('  Migratie 50: resterende thema-data na Migratie 49 nogmaals opgeruimd');
      try{ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie50_klaar','1')");}catch(e){}
    }
  }

  // verhuis_checks.item_type_id: kolom ontbrak (de checks-init-INSERT en Migratie 51 verwezen
  // ernaar zonder dat ze ooit was aangemaakt → beide crashten). Moet vóór Migratie 51/52 staan.
  addColumnIfMissing('verhuis_checks','item_type_id','INTEGER');

  // Migration 51: EENMALIGE opruimmigratie (S0.1) — wist de door de herseed-lekken (Mig 27/30/38,
  // nu gegate) per ongeluk teruggezaaide standaarddozen/vaste_bakken/item_types opnieuw, en ruimt
  // item_types op tot enkel nog levend gerefereerde rijen. Gegate: draait maar 1 keer.
  {
    const _vlag51=get("SELECT naam FROM app_vlaggen WHERE naam='migratie51_klaar'");
    if(!_vlag51){
      try{
        // Children eerst, dan parents
        run('DELETE FROM standaard_doos_items');
        run('DELETE FROM locatie_doos_config');
        run('DELETE FROM standaard_dozen');
        run('DELETE FROM vaste_bak_items');
        run('DELETE FROM vaste_bakken');
        // item_types: enkel rijen zonder enige levende verwijzing verwijderen.
        // vaste_bak_items telt hier NIET mee — die tabel is hierboven al leeggemaakt.
        db.run(`DELETE FROM item_types WHERE id NOT IN (
          SELECT item_type_id FROM bak_items WHERE item_type_id IS NOT NULL
          UNION SELECT item_type_id FROM sport_items WHERE item_type_id IS NOT NULL
          UNION SELECT item_type_id FROM transport_regels WHERE item_type_id IS NOT NULL
          UNION SELECT item_type_id FROM verhuis_checks WHERE item_type_id IS NOT NULL
        )`);
        console.log('  Migratie 51: herseedde standaarddozen/vaste_bakken gewist, ongerefereerde item_types opgeruimd');
      }catch(e){ console.error('  Migratie 51 fout (niet-fataal):',e.message); }
      try{ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie51_klaar','1')");}catch(e){}
    }
  }

  // Migration 52: herstel van Migratie 51 — die crashte op de toen nog ontbrekende kolom
  // verhuis_checks.item_type_id maar zette zijn vlag toch, waardoor de item_types-opruiming
  // nooit gebeurde. Zelfde opruiming, maar de vlag wordt ALLEEN bij succes gezet.
  {
    const _vlag52=get("SELECT naam FROM app_vlaggen WHERE naam='migratie52_klaar'");
    if(!_vlag52){
      try{
        const _voor52=(get('SELECT COUNT(*) as n FROM item_types')||{}).n||0;
        db.run(`DELETE FROM item_types WHERE id NOT IN (
          SELECT item_type_id FROM bak_items WHERE item_type_id IS NOT NULL
          UNION SELECT item_type_id FROM sport_items WHERE item_type_id IS NOT NULL
          UNION SELECT item_type_id FROM transport_regels WHERE item_type_id IS NOT NULL
          UNION SELECT item_type_id FROM verhuis_checks WHERE item_type_id IS NOT NULL
        )`);
        const _na52=(get('SELECT COUNT(*) as n FROM item_types')||{}).n||0;
        console.log(`  Migratie 52: item_types opgeruimd ${_voor52} → ${_na52}`);
        ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie52_klaar','1')");
      }catch(e){ console.error('  Migratie 52 fout — vlag NIET gezet, probeert opnieuw bij volgende start:',e.message); }
    }
  }

  // ── S2.1: uniforme bakken-tabel + thema_bak koppeltabel ──
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS bakken (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naam TEXT NOT NULL DEFAULT '',
    code TEXT DEFAULT '',
    soort TEXT NOT NULL DEFAULT 'thema',
    vast_type TEXT DEFAULT '',
    thuislocatie_id INTEGER,
    huidige_locatie_id INTEGER,
    status TEXT DEFAULT 'thuis',
    volgorde INTEGER DEFAULT 0
  )`);
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS thema_bak (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thema_id INTEGER NOT NULL,
    bak_id INTEGER NOT NULL,
    UNIQUE(thema_id, bak_id)
  )`);
  addColumnIfMissing('bakken','naam',"TEXT DEFAULT ''");

  // ── S2.2: attributen + thema_attribuut koppeltabel ──
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS attributen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naam TEXT NOT NULL DEFAULT '',
    code TEXT DEFAULT '',
    thuislocatie_id INTEGER,
    huidige_locatie_id INTEGER,
    status TEXT DEFAULT 'thuis',
    foto_data TEXT DEFAULT '',
    notitie TEXT DEFAULT ''
  )`);
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS thema_attribuut (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thema_id INTEGER NOT NULL,
    attribuut_id INTEGER NOT NULL,
    UNIQUE(thema_id, attribuut_id)
  )`);

  // ── S2.3: voorraad per item_type per stockagelocatie ──
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS item_type_stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_type_id INTEGER NOT NULL,
    locatie_id INTEGER NOT NULL,
    qty REAL DEFAULT 0,
    minimum REAL DEFAULT 0,
    UNIQUE(item_type_id, locatie_id)
  )`);

  // ── S2.5: locatieconfig (vaste_type per kamplocatie) ──
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS locatie_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kamplocatie_id INTEGER NOT NULL,
    vast_type TEXT NOT NULL DEFAULT '',
    aantal INTEGER DEFAULT 1,
    conditie_type TEXT DEFAULT 'altijd',
    conditie_waarde TEXT DEFAULT '',
    UNIQUE(kamplocatie_id, vast_type)
  )`);
  addColumnIfMissing('transport_regels','bak_id','INTEGER');
  addColumnIfMissing('transport_regels','attribuut_id','INTEGER');
  addColumnIfMissing('verhuis_checks','bak_id','INTEGER');
  addColumnIfMissing('verhuis_checks','attribuut_id','INTEGER');

  // Migratie 53: thema_bakken → bakken (soort='thema', id hergebruikt) + thema_bak-koppeling.
  // bak_items.bak_id blijft ongewijzigd geldig omdat de id's hergebruikt worden.
  // Gate: enkel draaien als bakken nog leeg is maar thema_bakken data heeft — idempotent zonder vlag nodig,
  // maar we gebruiken toch een expliciete vlag zodat handmatig aangemaakte nieuwe bakken (na migratie,
  // met een lege thema_bakken) deze migratie niet per ongeluk opnieuw triggeren.
  {
    const _vlag53=get("SELECT naam FROM app_vlaggen WHERE naam='migratie53_klaar'");
    if(!_vlag53){
      try{
        const _rzw=get("SELECT id FROM locaties WHERE name='Rozenweg' AND (parent_id IS NULL OR parent_id=0)")
          || get("SELECT id FROM locaties WHERE type='stockage' AND (parent_id IS NULL OR parent_id=0) ORDER BY id LIMIT 1");
        const _thuisId=_rzw?_rzw.id:null;
        const _oudeBakken=all('SELECT * FROM thema_bakken');
        let _gemigreerd=0;
        _oudeBakken.forEach(b=>{
          const _bestaat=get('SELECT id FROM bakken WHERE id=?',[b.id]);
          if(!_bestaat){
            db.run('INSERT INTO bakken (id,naam,code,soort,vast_type,thuislocatie_id,huidige_locatie_id,status,volgorde) VALUES (?,?,?,?,?,?,?,?,?)',
              [b.id, b.label||'', b.code||'', 'thema', '', _thuisId, _thuisId, 'thuis', b.volgorde||0]);
          }
          const _gekoppeld=get('SELECT id FROM thema_bak WHERE thema_id=? AND bak_id=?',[b.thema_id,b.id]);
          if(!_gekoppeld) ins('INSERT INTO thema_bak (thema_id,bak_id) VALUES (?,?)',[b.thema_id,b.id]);
          _gemigreerd++;
        });
        // bak_items had een FK naar thema_bakken(id); met foreign_keys=ON zou een insert voor een
        // NIEUWE (vast/thema) bak die niet in thema_bakken bestaat falen. Tabel herbouwen met FK naar bakken(id).
        db.run(`CREATE TABLE bak_items_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bak_id INTEGER NOT NULL,
          naam TEXT NOT NULL,
          qty REAL DEFAULT 1,
          verbruik INTEGER DEFAULT 0,
          qty_per_gebruik REAL DEFAULT 1,
          eenheid TEXT DEFAULT 'stuks',
          qty_stock REAL DEFAULT 0,
          qty_minimum REAL DEFAULT 0,
          notitie TEXT DEFAULT '',
          item_type_id INTEGER,
          FOREIGN KEY(bak_id) REFERENCES bakken(id) ON DELETE CASCADE
        )`);
        db.run(`INSERT INTO bak_items_new (id,bak_id,naam,qty,verbruik,qty_per_gebruik,eenheid,qty_stock,qty_minimum,notitie,item_type_id)
          SELECT id,bak_id,naam,qty,verbruik,qty_per_gebruik,eenheid,qty_stock,qty_minimum,notitie,item_type_id FROM bak_items`);
        db.run('DROP TABLE bak_items');
        db.run('ALTER TABLE bak_items_new RENAME TO bak_items');
        // Zelfde probleem voor bak_nakijk_log (FK naar thema_bakken(id))
        db.run(`CREATE TABLE bak_nakijk_log_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bak_id INTEGER NOT NULL,
          tijdstip TEXT NOT NULL,
          wie TEXT DEFAULT '',
          resultaat TEXT DEFAULT 'ok',
          notitie TEXT DEFAULT '',
          FOREIGN KEY(bak_id) REFERENCES bakken(id) ON DELETE CASCADE
        )`);
        db.run(`INSERT INTO bak_nakijk_log_new (id,bak_id,tijdstip,wie,resultaat,notitie)
          SELECT id,bak_id,tijdstip,wie,resultaat,notitie FROM bak_nakijk_log`);
        db.run('DROP TABLE bak_nakijk_log');
        db.run('ALTER TABLE bak_nakijk_log_new RENAME TO bak_nakijk_log');
        // Zelfde probleem voor bak_fotos (FK naar thema_bakken(id))
        db.run(`CREATE TABLE bak_fotos_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bak_id INTEGER NOT NULL,
          tijdstip TEXT NOT NULL,
          wie TEXT DEFAULT '',
          beschrijving TEXT DEFAULT '',
          foto_data TEXT DEFAULT '',
          FOREIGN KEY(bak_id) REFERENCES bakken(id) ON DELETE CASCADE
        )`);
        db.run(`INSERT INTO bak_fotos_new (id,bak_id,tijdstip,wie,beschrijving,foto_data)
          SELECT id,bak_id,tijdstip,wie,beschrijving,foto_data FROM bak_fotos`);
        db.run('DROP TABLE bak_fotos');
        db.run('ALTER TABLE bak_fotos_new RENAME TO bak_fotos');
        console.log(`  Migratie 53: ${_gemigreerd} thema_bakken-rijen gemigreerd naar bakken (soort=thema) + thema_bak-koppeling; thuislocatie=${_thuisId}; bak_items FK herbouwd naar bakken(id)`);
        ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie53_klaar','1')");
      }catch(e){ console.error('  Migratie 53 fout — vlag NIET gezet, probeert opnieuw bij volgende start:',e.message); }
    }
  }

  // ── S3.1/S3.2/S3.3: schema voor personen-consolidatie, login en aanvraagflow ──
  addColumnIfMissing('personeel','pincode',"TEXT DEFAULT ''");
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS sessies (
    token TEXT PRIMARY KEY,
    persoon_id INTEGER NOT NULL,
    created_at TEXT DEFAULT ''
  )`);
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS aanvragen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kampmoment_id INTEGER,
    persoon_id INTEGER,
    soort TEXT DEFAULT 'materiaal',
    tekst TEXT DEFAULT '',
    foto_data TEXT DEFAULT '',
    status TEXT DEFAULT 'nieuw',
    reden TEXT DEFAULT '',
    spoed_taak_id INTEGER,
    created_at TEXT DEFAULT '',
    behandeld_door TEXT DEFAULT '',
    behandeld_op TEXT DEFAULT ''
  )`);

  // ── Migratie 56 — S3.4: KV-koppeling per kampmoment (persoonlijke link, geen login) ──
  addColumnIfMissing('kampmomenten','kv_persoon_id','INTEGER');
  addColumnIfMissing('kampmomenten','kv_token',"TEXT DEFAULT ''");

  // ── Migratie 56 — S3.6: chauffeurspagina interactief, twee vink-fases per bak/attribuut ──
  // Het oude 'status'-veld op verhuis_checks blijft ongewijzigd staan voor compatibiliteit.
  addColumnIfMissing('verhuis_checks','geladen','INTEGER DEFAULT 0');
  addColumnIfMissing('verhuis_checks','geladen_door',"TEXT DEFAULT ''");
  addColumnIfMissing('verhuis_checks','geladen_op',"TEXT DEFAULT ''");
  addColumnIfMissing('verhuis_checks','gelost','INTEGER DEFAULT 0');
  addColumnIfMissing('verhuis_checks','gelost_door',"TEXT DEFAULT ''");
  addColumnIfMissing('verhuis_checks','gelost_op',"TEXT DEFAULT ''");
  addColumnIfMissing('verhuis_checks','taak_id','INTEGER');

  // ── Migratie 59 — VERSE START 2 (Maxim 2026-08-02): alle thema's en materialen opnieuw gewist
  // voor een foutloze heropbouw waarbij Maxim élk onderdeel uit de themabundels zelf valideert.
  // Blijft: sportpakketten (sport_items/sets/planning), locaties, personeel, kampmomenten
  // (enkel de thema-koppelingen gaan eruit), locatie_config-structuur. Gegate: draait 1×.
  {
    const _vlag59=get("SELECT naam FROM app_vlaggen WHERE naam='migratie59_klaar'");
    if(!_vlag59){
      try{
        ['kampmoment_themas','thema_bak','thema_attribuut','bak_items','bak_fotos','bak_nakijk_log',
         'bakken','attributen','item_type_stock','nakijk_regels','nakijk_sessies',
         'locatie_kleuren','kleurenborden_stock','verhuis_checks','transport_regels',
         'transport_taken','transport_ritten','aanvragen','themas'
        ].forEach(t=>{ db.run('DELETE FROM '+t); });
        // Catalogus: enkel item_types behouden waar sport nog naar verwijst
        db.run(`DELETE FROM item_types WHERE id NOT IN (
          SELECT item_type_id FROM sport_items WHERE item_type_id IS NOT NULL
        )`);
        const _n59=get('SELECT COUNT(*) as n FROM item_types').n;
        console.log(`  Migratie 59: verse start — thema's/materialen gewist; item_types over: ${_n59} (enkel sport)`);
        ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie59_klaar','1')");
      }catch(e){ console.error('  Migratie 59 fout — vlag NIET gezet, probeert opnieuw bij volgende start:',e.message); }
    }
  }

  // ── Migratie 58 — S5-uitbreiding (Maxim 2026-08-02): pauze-gedrag per locatieconfig-regel.
  // 'blijven' (default, bindende regel: standaardmateriaal blijft staan bij tijdelijke sluiting)
  // of 'ophalen' (dit type gaat wél mee terug tijdens een pauze en wordt herleverd bij heropening).
  addColumnIfMissing('locatie_config','pauze_gedrag',"TEXT DEFAULT 'blijven'");

  // ── Migratie 60 — S6.1: kantoor-verwerkstap per tekortregel (open→besteld/aangevuld/genegeerd).
  // 'besteld' bestond al als 0/1-vlag die "aangevuld" betekende (verwarrend); tekort_status is de
  // nieuwe, expliciete status. Backfill: regels met besteld=1 (= al aangevuld via de oude route)
  // krijgen tekort_status='aangevuld' zodat bestaande data niet plots weer als open tekort telt.
  addColumnIfMissing('nakijk_regels','tekort_status',"TEXT DEFAULT 'open'");
  {
    const _vlag60=get("SELECT naam FROM app_vlaggen WHERE naam='migratie60_klaar'");
    if(!_vlag60){
      try{
        run("UPDATE nakijk_regels SET tekort_status='aangevuld' WHERE besteld=1 AND tekort_status='open'");
        console.log('  Migratie 60: tekort_status gebackfilld vanuit besteld-vlag');
        ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie60_klaar','1')");
      }catch(e){ console.error('  Migratie 60 fout — vlag NIET gezet, probeert opnieuw bij volgende start:',e.message); }
    }
  }

  // ── Migratie 61 — S4.6/S4.7: foto's op pool-eenheden (springkasteel/waterstructuur) +
  // themabundel-PDF-koppeling. Kolomtoevoegingen/nieuwe tabel, geen datamigratie nodig.
  addColumnIfMissing('bakken','foto_opgeplooid',"TEXT DEFAULT ''");
  addColumnIfMissing('bakken','foto_opgezet',"TEXT DEFAULT ''");
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS thema_bundels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thema_id INTEGER NOT NULL,
    bestand TEXT NOT NULL,
    label TEXT DEFAULT '',
    volgorde INTEGER DEFAULT 0
  )`);

  // ── Migratie 57 — S3.5: KV-scherm telt ook attributen aanwezig/beschadigd ──
  // nakijk_sessies kende al bak_type 'thema'/'vast' met thema_bak_id/vaste_bak_id; 'attribuut'
  // is een derde bak_type met een eigen FK-kolom. kv_status krijgt een nieuwe tussenwaarde
  // 'bezig' (per-bak/attribuut opgeslagen, nog niet globaal verstuurd) naast 'open'/'ingediend'.
  addColumnIfMissing('nakijk_sessies','attribuut_id','INTEGER');

  // Migratie 54: ploeg_shifts → personeel_shifts. Vanaf nu wordt chauffeurs/ploeg_shifts niet
  // meer beschreven vanuit code (S3.1 personen-consolidatie); de tabellen blijven puur als
  // historisch archief staan zodat er geen dataverlies is.
  {
    const _vlag54=get("SELECT naam FROM app_vlaggen WHERE naam='migratie54_klaar'");
    if(!_vlag54){
      try{
        const _oudeShifts=all(`SELECT ps.*, c.personeel_id AS pid FROM ploeg_shifts ps JOIN chauffeurs c ON c.id=ps.chauffeur_id`);
        let _gemigreerd54=0;
        _oudeShifts.forEach(sh=>{
          if(!sh.pid) return; // chauffeur zonder gekoppeld personeel (zou niet mogen na Migratie 48) — overslaan
          ins(`INSERT INTO personeel_shifts (persoon_id,kampmoment_id,locatie_id,datum,van_uur,tot_uur,rol_dag,notities)
            VALUES (?,?,?,?,?,?,?,?)`,
            [sh.pid, null, null, sh.datum, sh.start_tijd||'', sh.eind_tijd||'', sh.type||'', sh.opmerking||'']);
          _gemigreerd54++;
        });
        console.log(`  Migratie 54: ${_gemigreerd54} ploeg_shifts-rijen gemigreerd naar personeel_shifts`);
        ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie54_klaar','1')");
      }catch(e){ console.error('  Migratie 54 fout — vlag NIET gezet, probeert opnieuw bij volgende start:',e.message); }
    }
  }

  // Migratie 55: oude spoedmeldingen → aanvragen (soort='materiaal'), zodat S1.5/S3.3-consolidatie
  // geen bestaande data verliest. spoedmeldingen zelf blijft ongemoeid staan als archief.
  {
    const _vlag55=get("SELECT naam FROM app_vlaggen WHERE naam='migratie55_klaar'");
    if(!_vlag55){
      try{
        const _oudeSpoed=all('SELECT * FROM spoedmeldingen');
        let _gemigreerd55=0;
        _oudeSpoed.forEach(s=>{
          const tekst=(s.item||'')+(s.qty&&s.qty!==1?` (${s.qty}x)`:'')+(s.note?` — ${s.note}`:'');
          ins(`INSERT INTO aanvragen (kampmoment_id,persoon_id,soort,tekst,status,created_at,behandeld_door,behandeld_op)
            VALUES (?,?,?,?,?,?,?,?)`,
            [null, null, 'materiaal', tekst, s.done?'afgehandeld':'nieuw', s.created_at||now(), s.done?'(migratie 55)':'', s.done_time||'']);
          _gemigreerd55++;
        });
        console.log(`  Migratie 55: ${_gemigreerd55} spoedmeldingen gemigreerd naar aanvragen`);
        ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie55_klaar','1')");
      }catch(e){ console.error('  Migratie 55 fout — vlag NIET gezet, probeert opnieuw bij volgende start:',e.message); }
    }
  }

  saveDb();

  // ── S3.2: LOGIN / SESSIES ──
  function hashPin(pin){ return crypto.createHash('sha256').update(String(pin)).digest('hex'); }
  function genSessieToken(){ return crypto.randomBytes(24).toString('hex'); }
  const _sessieCache = new Map(); // token -> {token,persoon_id,naam,rol}  (snelheid; bron van waarheid is de sessies-tabel)
  function checkSessie(token){
    if(!token) return null;
    if(_sessieCache.has(token)) return _sessieCache.get(token);
    const s = get('SELECT s.token,s.persoon_id,p.naam,p.rol FROM sessies s JOIN personeel p ON p.id=s.persoon_id WHERE s.token=?',[token]);
    if(s) _sessieCache.set(token,s);
    return s||null;
  }

  // PUBLIEK (geen sessietoken vereist): login zelf, login-status/setup-vangnet, de personeelslijst
  // om het loginscherm te vullen, en /rit/:token + /kv/:token (die staan sowieso niet onder
  // /api/*, dus zijn vanzelf publiek). Hun onderliggende schrijf-/data-calls ONDER /api/ staan
  // wél achter deze poort en krijgen daarom een expliciete prefix-uitzondering hieronder — de
  // routes zelf doen daarna hun EIGEN validatie op het token (rit_token resp. kv_token), dus
  // "publiek bereikbaar" betekent hier niet "toegang tot alles", enkel "geen sessietoken nodig".
  const PUBLIEKE_API_PADEN = new Set(['/api/login','/api/login-status','/api/setup-eerste-pincode','/api/personeel-lijst-login']);
  const PUBLIEKE_API_PREFIXEN = ['/api/rit-token/','/api/kv/'];

  app.post('/api/login',(req,res)=>{
    const {persoon_id,pincode}=req.body;
    if(!persoon_id||!pincode) return res.status(400).json({error:'persoon_id en pincode zijn vereist'});
    const p=get('SELECT * FROM personeel WHERE id=?',[persoon_id]);
    if(!p||!p.pincode) return res.status(401).json({error:'Ongeldige login'});
    if(p.pincode!==hashPin(pincode)) return res.status(401).json({error:'Ongeldige pincode'});
    const token=genSessieToken();
    ins('INSERT INTO sessies (token,persoon_id,created_at) VALUES (?,?,?)',[token,p.id,now()]);
    saveDb();
    const sessie={token,persoon_id:p.id,naam:p.naam,rol:p.rol};
    _sessieCache.set(token,sessie);
    res.json({token,id:p.id,naam:p.naam,rol:p.rol});
  });
  app.get('/api/login-status',(req,res)=>{
    const n=get("SELECT COUNT(*) as n FROM personeel WHERE pincode IS NOT NULL AND pincode<>''").n;
    res.json({setup_nodig: n===0});
  });
  app.post('/api/setup-eerste-pincode',(req,res)=>{
    const n=get("SELECT COUNT(*) as n FROM personeel WHERE pincode IS NOT NULL AND pincode<>''").n;
    if(n>0) return res.status(400).json({error:'Setup is al voltooid — log in via het gewone loginscherm.'});
    const {persoon_id,pincode,naam}=req.body;
    if(!pincode||String(pincode).length<4) return res.status(400).json({error:'Een pincode van minstens 4 tekens is vereist'});
    // Bootstrap-gat gedicht (reviewfix): op een lege personeelstabel kan je anders nooit
    // binnenraken (personeel aanmaken vereist een token, een token vereist een persoon).
    // Is personeel leeg, dan mag de setup zelf de eerste kantoor-persoon aanmaken via `naam`.
    let p = persoon_id ? get('SELECT * FROM personeel WHERE id=?',[persoon_id]) : null;
    if(!p){
      const totaal=get('SELECT COUNT(*) as n FROM personeel').n;
      if(totaal===0 && naam && naam.trim()){
        const nieuwId=ins('INSERT INTO personeel (naam,rol) VALUES (?,?)',[naam.trim(),'kantoor']);
        p=get('SELECT * FROM personeel WHERE id=?',[nieuwId]);
      }
    }
    if(!p) return res.status(404).json({error:'Persoon niet gevonden (of geef bij een lege personeelslijst een naam op)'});
    run('UPDATE personeel SET rol=?, pincode=? WHERE id=?',['kantoor',hashPin(pincode),p.id]);
    saveDb();
    res.json({ok:true,persoon_id:p.id});
  });
  app.get('/api/personeel-lijst-login',(req,res)=>{
    res.json(all("SELECT id,naam,rol FROM personeel ORDER BY rol,naam"));
  });

  // Auth-poort voor alle overige /api/*-routes. Zonder geldig token → 401. De bestaande
  // APP_PASSWORD-basic-auth (bovenaan dit bestand) blijft daarbuiten als buitenmuur staan.
  app.use((req,res,next)=>{
    if(!req.path.startsWith('/api/')) return next();
    if(PUBLIEKE_API_PADEN.has(req.path)) return next();
    if(PUBLIEKE_API_PREFIXEN.some(p=>req.path.startsWith(p))) return next();
    const token = req.headers['x-auth-token'] || (req.headers['authorization']||'').replace(/^Bearer\s+/i,'');
    const sessie = checkSessie(token);
    if(!sessie) return res.status(401).json({error:'Niet ingelogd'});
    req.persoon = sessie;
    next();
  });

  app.get('/api/wie-ben-ik',(req,res)=>{
    res.json({id:req.persoon.persoon_id,naam:req.persoon.naam,rol:req.persoon.rol});
  });
  app.post('/api/personeel/:id/pincode',(req,res)=>{
    const {pincode}=req.body;
    if(!pincode||String(pincode).length<4) return res.status(400).json({error:'Pincode van minstens 4 tekens vereist'});
    const p=get('SELECT * FROM personeel WHERE id=?',[req.params.id]);
    if(!p) return res.status(404).json({error:'Persoon niet gevonden'});
    run('UPDATE personeel SET pincode=? WHERE id=?',[hashPin(pincode),p.id]);
    saveDb();
    res.json({ok:true});
  });
  app.post('/api/logout',(req,res)=>{
    const token = req.headers['x-auth-token'] || (req.headers['authorization']||'').replace(/^Bearer\s+/i,'');
    if(token){ run('DELETE FROM sessies WHERE token=?',[token]); _sessieCache.delete(token); saveDb(); }
    res.json({ok:true});
  });

  // ── LOCATIES ──
  app.get('/api/locaties',(req,res)=>res.json(all('SELECT * FROM locaties ORDER BY type,name')));
  app.post('/api/locaties',(req,res)=>{
    const{name,addr,type,contact_naam,contact_tel,notities,lat,lng,stockage_rol,parent_id}=req.body;
    if(!name||!name.trim())return res.status(400).json({error:'Naam is verplicht'});
    const id=ins('INSERT INTO locaties (name,addr,type,contact_naam,contact_tel,notities,lat,lng,stockage_rol,parent_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [name.trim(),addr||'',type||'kamp',contact_naam||'',contact_tel||'',notities||'',lat||null,lng||null,stockage_rol||'beide',parent_id||null]);
    const loc=get('SELECT * FROM locaties WHERE id=?',[id]);
    logAct('locatie','aangemaakt',`Locatie "${loc.name}" aangemaakt`+(addr?` (${addr})`:''),id,loc.name);
    res.json(loc);
  });
  app.put('/api/locaties/:id',(req,res)=>{
    const{name,addr,type,contact_naam,contact_tel,notities,lat,lng,stockage_rol,parent_id,heeft_eigen_sportmateriaal,heeft_eigen_oven}=req.body;
    run('UPDATE locaties SET name=?,addr=?,type=?,contact_naam=?,contact_tel=?,notities=?,lat=?,lng=?,stockage_rol=?,parent_id=?,heeft_eigen_sportmateriaal=?,heeft_eigen_oven=? WHERE id=?',
      [name,addr||'',type||'kamp',contact_naam||'',contact_tel||'',notities||'',lat||null,lng||null,stockage_rol||'beide',parent_id||null,heeft_eigen_sportmateriaal?1:0,heeft_eigen_oven?1:0,req.params.id]);
    const loc=get('SELECT * FROM locaties WHERE id=?',[req.params.id]);
    logAct('locatie','bewerkt',`Locatie "${loc.name}" bewerkt`,loc.id,loc.name);
    res.json(loc);
  });

  // ── S2.5: LOCATIECONFIG (vaste exemplaren per kamplocatie, vervangt standaard_dozen/locatie_doos_config/kampmoment-dozen) ──
  app.get('/api/vast-types',(req,res)=>{
    res.json(all("SELECT DISTINCT vast_type FROM bakken WHERE soort='vast' AND vast_type!='' ORDER BY vast_type").map(r=>r.vast_type));
  });
  app.get('/api/locatie-config/:locatie_id',(req,res)=>{
    res.json(all('SELECT * FROM locatie_config WHERE kamplocatie_id=? ORDER BY vast_type',[req.params.locatie_id]));
  });
  app.post('/api/locatie-config',(req,res)=>{
    const{kamplocatie_id,vast_type,aantal,conditie_type,conditie_waarde,pauze_gedrag}=req.body;
    if(!kamplocatie_id||!vast_type)return res.status(400).json({error:'kamplocatie_id en vast_type verplicht'});
    const pg=(pauze_gedrag==='ophalen')?'ophalen':'blijven';
    const bestaat=get('SELECT id FROM locatie_config WHERE kamplocatie_id=? AND vast_type=?',[kamplocatie_id,vast_type]);
    if(bestaat){
      run('UPDATE locatie_config SET aantal=?,conditie_type=?,conditie_waarde=?,pauze_gedrag=? WHERE id=?',
        [aantal||1,conditie_type||'altijd',conditie_waarde||'',pg,bestaat.id]);
    } else {
      ins('INSERT INTO locatie_config (kamplocatie_id,vast_type,aantal,conditie_type,conditie_waarde,pauze_gedrag) VALUES (?,?,?,?,?,?)',
        [kamplocatie_id,vast_type,aantal||1,conditie_type||'altijd',conditie_waarde||'',pg]);
    }
    saveDb();
    res.json(all('SELECT * FROM locatie_config WHERE kamplocatie_id=? ORDER BY vast_type',[kamplocatie_id]));
  });
  app.delete('/api/locatie-config/:id',(req,res)=>{
    run('DELETE FROM locatie_config WHERE id=?',[req.params.id]);
    saveDb();res.json({ok:true});
  });
  // Bepaalt welke locatie_config-rijen actief zijn voor een kampmoment (conditie: altijd/leeftijdsgroep/kookthema)
  function _actieveLocatieConfig(km){
    if(!km)return[];
    const cfgs=all('SELECT * FROM locatie_config WHERE kamplocatie_id=?',[km.locatie_id]);
    const themas=all('SELECT t.* FROM themas t JOIN kampmoment_themas kt ON kt.thema_id=t.id WHERE kt.kampmoment_id=?',[km.id]);
    const heeftKoken=themas.some(t=>t.heeft_kookactiviteit);
    const leeftijden=new Set(themas.map(t=>t.leeftijdsgroep).filter(Boolean));
    return cfgs.filter(c=>{
      if(c.conditie_type==='leeftijdsgroep') return leeftijden.has(c.conditie_waarde);
      if(c.conditie_type==='kookthema') return heeftKoken;
      return true; // 'altijd'
    });
  }

  // ── S3.5: KV-scherm — wat hoort er te staan (zelfde logica als transport-genereer:
  // thema_bak/thema_attribuut van de kampmoment-thema's + actieve locatie_config-exemplaren,
  // maar hier enkel exemplaren die ECHT op deze locatie staan — de KV kan geen bak tellen
  // die nog in het magazijn ligt).
  function _kvVerwacht(km){
    const kts=all('SELECT thema_id FROM kampmoment_themas WHERE kampmoment_id=?',[km.id]);
    const themaIds=[...new Set(kts.map(k=>k.thema_id))];
    let themaBakken=[], themaAttrs=[];
    if(themaIds.length){
      const ph=themaIds.map(()=>'?').join(',');
      themaBakken=all(`SELECT DISTINCT b.* FROM bakken b JOIN thema_bak tb ON tb.bak_id=b.id WHERE tb.thema_id IN (${ph}) AND b.soort='thema'`,themaIds);
      themaAttrs=all(`SELECT DISTINCT a.* FROM attributen a JOIN thema_attribuut ta ON ta.attribuut_id=a.id WHERE ta.thema_id IN (${ph})`,themaIds);
    }
    const vastBakken=_actieveLocatieConfig(km).flatMap(cfg=>
      all("SELECT * FROM bakken WHERE soort='vast' AND vast_type=? AND huidige_locatie_id=? LIMIT ?",[cfg.vast_type,km.locatie_id,cfg.aantal||1]));
    return {bakken:[...themaBakken,...vastBakken], attributen:themaAttrs};
  }
  function _kvKampmoment(token){ return get('SELECT * FROM kampmomenten WHERE kv_token=?',[token]); }
  function _kvNaam(km){ const p=km.kv_persoon_id?get('SELECT naam FROM personeel WHERE id=?',[km.kv_persoon_id]):null; return p?p.naam:''; }
  function _bakItems(bak){
    return bak.soort==='thema'
      ? all('SELECT * FROM bak_items WHERE bak_id=? ORDER BY id',[bak.id])
      : all('SELECT * FROM vaste_bak_items WHERE bak_id=? ORDER BY volgorde,id',[bak.id]);
  }

  app.get('/api/kv/:token/data',(req,res)=>{
    const km=_kvKampmoment(req.params.token);
    if(!km)return res.status(403).json({error:'Ongeldige of verlopen link'});
    const loc=get('SELECT * FROM locaties WHERE id=?',[km.locatie_id]);
    const {bakken,attributen}=_kvVerwacht(km);
    const sessies=all("SELECT * FROM nakijk_sessies WHERE locatie_id=? AND week=? AND kv_status IN ('bezig','ingediend')",[km.locatie_id,km.week]);
    const regelsAll=all('SELECT * FROM nakijk_regels');
    const bakkenOut=bakken.map(b=>{
      const items=_bakItems(b);
      const sessie=sessies.find(s=>s.bak_type===b.soort&&(b.soort==='thema'?s.thema_bak_id===b.id:s.vaste_bak_id===b.id));
      const regels=sessie?regelsAll.filter(r=>r.sessie_id===sessie.id):[];
      return {
        id:b.id, soort:b.soort, code:b.code, naam:b.naam,
        ingediend:sessie?sessie.kv_status==='ingediend':false,
        items:items.map(it=>{
          const r=regels.find(r=>r.item_id===it.id);
          return {id:it.id, naam:it.naam, gewenst:it.qty, aangetroffen:(r&&r.aangetroffen!=null)?r.aangetroffen:null};
        })
      };
    });
    const attrSessies=sessies.filter(s=>s.bak_type==='attribuut');
    const attributenOut=attributen.map(a=>{
      const s=attrSessies.find(s=>s.attribuut_id===a.id);
      return {id:a.id, code:a.code, naam:a.naam, status:s?(s.notities||null):null};
    });
    const aanvragen=all("SELECT * FROM aanvragen WHERE kampmoment_id=? AND soort='materiaal' ORDER BY id DESC",[km.id]);
    // S4.8: KV-boodschappenlijst — "KV: "-regels van de gekoppelde thema's (verse waren die
    // de kampverantwoordelijke zelf koopt, interim opgeslagen in thema_materiaal met prefix).
    const ktsKm=all('SELECT thema_id FROM kampmoment_themas WHERE kampmoment_id=?',[km.id]);
    const themaIdsKm=[...new Set(ktsKm.map(k=>k.thema_id))];
    let boodschappen=[];
    if(themaIdsKm.length){
      const ph=themaIdsKm.map(()=>'?').join(',');
      boodschappen=all(`SELECT id,name,qty FROM thema_materiaal WHERE thema_id IN (${ph}) AND name LIKE 'KV:%'`,themaIdsKm)
        .map(r=>({id:r.id,naam:r.name.replace(/^KV:\s*/,''),qty:r.qty}));
    }
    res.json({
      kampNaam:(loc?loc.name:'?')+' — week '+km.week,
      kvNaam:_kvNaam(km),
      bakken:bakkenOut, attributen:attributenOut, aanvragen, boodschappen
    });
  });

  app.post('/api/kv/:token/bakken/:bakId/tellen',(req,res)=>{
    const km=_kvKampmoment(req.params.token);
    if(!km)return res.status(403).json({error:'Ongeldige of verlopen link'});
    const {bakken}=_kvVerwacht(km);
    const bak=bakken.find(b=>b.id===parseInt(req.params.bakId));
    if(!bak)return res.status(403).json({error:'Deze bak hoort niet bij dit kampmoment'});
    // S5.4b: weiger lege/misvormde payload i.p.v. stil ok:true teruggeven.
    const regelsIn=Array.isArray(req.body?.regels)?req.body.regels:null;
    if(!regelsIn||!regelsIn.length)return res.status(400).json({error:'regels is verplicht en mag niet leeg zijn'});
    const items0=_bakItems(bak);
    const ongeldig=regelsIn.some(rin=>{
      const itemIdOk=rin&&rin.item_id!=null&&items0.some(i=>i.id===rin.item_id);
      const aangetroffenOk=rin&&rin.aangetroffen!=null&&!isNaN(parseFloat(rin.aangetroffen))&&parseFloat(rin.aangetroffen)>=0;
      return !itemIdOk||!aangetroffenOk;
    });
    if(ongeldig)return res.status(400).json({error:'Elke regel heeft een geldig item_id en aangetroffen (≥0) nodig'});
    const kvNaam=_kvNaam(km);
    const veldNaam=bak.soort==='thema'?'thema_bak_id':'vaste_bak_id';
    let sessie=get(`SELECT * FROM nakijk_sessies WHERE bak_type=? AND ${veldNaam}=? AND locatie_id=? AND week=? AND kv_status IN ('bezig','ingediend')`,
      [bak.soort,bak.id,km.locatie_id,km.week]);
    let sessieId;
    if(sessie){ sessieId=sessie.id; run('UPDATE nakijk_sessies SET kv_wie=?,kv_tijdstip=? WHERE id=?',[kvNaam,now(),sessieId]); }
    else {
      sessieId=ins(`INSERT INTO nakijk_sessies (bak_type,thema_bak_id,vaste_bak_id,locatie_id,week,datum,kv_wie,kv_status,kantoor_status) VALUES (?,?,?,?,?,?,?,?,?)`,
        [bak.soort, bak.soort==='thema'?bak.id:null, bak.soort==='vast'?bak.id:null, km.locatie_id, km.week, now(), kvNaam, 'bezig', 'open']);
    }
    const items=_bakItems(bak);
    regelsIn.forEach(rin=>{
      const item=items.find(i=>i.id===rin.item_id);
      if(!item)return;
      const aangetroffen=Math.max(0,parseFloat(rin.aangetroffen)||0);
      const ontbreekt=Math.max(0,(item.qty||0)-aangetroffen);
      const bestaand=get('SELECT * FROM nakijk_regels WHERE sessie_id=? AND item_id=?',[sessieId,item.id]);
      if(bestaand) run('UPDATE nakijk_regels SET aangetroffen=?,ontbreekt=?,verwacht=? WHERE id=?',[aangetroffen,ontbreekt,item.qty,bestaand.id]);
      else ins('INSERT INTO nakijk_regels (sessie_id,item_naam,item_id,verwacht,aangetroffen,ontbreekt) VALUES (?,?,?,?,?,?)',[sessieId,item.naam,item.id,item.qty,aangetroffen,ontbreekt]);
    });
    saveDb();
    res.json({ok:true});
  });

  app.post('/api/kv/:token/attributen/:attrId/status',(req,res)=>{
    const km=_kvKampmoment(req.params.token);
    if(!km)return res.status(403).json({error:'Ongeldige of verlopen link'});
    const {attributen}=_kvVerwacht(km);
    const attr=attributen.find(a=>a.id===parseInt(req.params.attrId));
    if(!attr)return res.status(403).json({error:'Dit attribuut hoort niet bij dit kampmoment'});
    // S5.4b: weiger een ongeldige status i.p.v. ze stil te vervangen door ''.
    if(!['aanwezig','beschadigd'].includes(req.body?.status))
      return res.status(400).json({error:"status moet 'aanwezig' of 'beschadigd' zijn"});
    const status=req.body.status;
    const kvNaam=_kvNaam(km);
    let sessie=get("SELECT * FROM nakijk_sessies WHERE bak_type='attribuut' AND attribuut_id=? AND locatie_id=? AND week=? AND kv_status IN ('bezig','ingediend')",
      [attr.id,km.locatie_id,km.week]);
    if(sessie) run('UPDATE nakijk_sessies SET notities=?,kv_wie=?,kv_tijdstip=? WHERE id=?',[status,kvNaam,now(),sessie.id]);
    else ins("INSERT INTO nakijk_sessies (bak_type,attribuut_id,locatie_id,week,datum,kv_wie,kv_status,kantoor_status,notities) VALUES ('attribuut',?,?,?,?,?,?,?,?)",
      [attr.id,km.locatie_id,km.week,now(),kvNaam,'bezig','open',status]);
    saveDb();
    res.json({ok:true,status});
  });

  app.post('/api/kv/:token/versturen',(req,res)=>{
    const km=_kvKampmoment(req.params.token);
    if(!km)return res.status(403).json({error:'Ongeldige of verlopen link'});
    const kvNaam=_kvNaam(km);
    run("UPDATE nakijk_sessies SET kv_status='ingediend',kv_wie=?,kv_tijdstip=? WHERE locatie_id=? AND week=? AND kv_status='bezig'",
      [kvNaam,now(),km.locatie_id,km.week]);
    saveDb();
    res.json({ok:true});
  });

  app.post('/api/kv/:token/aanvraag',(req,res)=>{
    const km=_kvKampmoment(req.params.token);
    if(!km)return res.status(403).json({error:'Ongeldige of verlopen link'});
    const tekst=(req.body?.tekst||'').trim();
    if(!tekst)return res.status(400).json({error:'Tekst is verplicht'});
    const id=ins('INSERT INTO aanvragen (kampmoment_id,persoon_id,soort,tekst,status,created_at) VALUES (?,?,?,?,?,?)',
      [km.id,km.kv_persoon_id||null,'materiaal',tekst,'nieuw',now()]);
    saveDb();
    res.json(get('SELECT * FROM aanvragen WHERE id=?',[id]));
  });

  app.post('/api/kv/:token/kapot',(req,res)=>{
    const km=_kvKampmoment(req.params.token);
    if(!km)return res.status(403).json({error:'Ongeldige of verlopen link'});
    const tekst=(req.body?.tekst||'').trim();
    if(!tekst)return res.status(400).json({error:'Omschrijving is verplicht'});
    const id=ins('INSERT INTO aanvragen (kampmoment_id,persoon_id,soort,tekst,foto_data,status,created_at) VALUES (?,?,?,?,?,?,?)',
      [km.id,km.kv_persoon_id||null,'kapot',tekst,req.body?.foto_data||'','nieuw',now()]);
    saveDb();
    res.json(get('SELECT * FROM aanvragen WHERE id=?',[id]));
  });

  app.delete('/api/locaties/:id',(req,res)=>{
    const loc=get('SELECT * FROM locaties WHERE id=?',[req.params.id]);
    run('DELETE FROM locaties WHERE id=?',[req.params.id]);
    if(loc) logAct('locatie','verwijderd',`Locatie "${loc.name}" verwijderd`,null,loc.name);
    res.json({ok:true});
  });
  // Geocodeer adressen -> lat/lng via OpenStreetMap Nominatim (gratis, geen sleutel).
  // Standaard enkel locaties zonder coordinaten; ?force=1 hergeocodeert alles.
  app.post('/api/locaties/geocode', async (req,res)=>{
    const force = req.query.force==='1' || req.body?.force===true;
    const todo = all(force
      ? "SELECT * FROM locaties WHERE addr IS NOT NULL AND TRIM(addr)<>''"
      : "SELECT * FROM locaties WHERE addr IS NOT NULL AND TRIM(addr)<>'' AND (lat IS NULL OR lng IS NULL)");
    const sleep = ms => new Promise(r=>setTimeout(r,ms));
    const gedaan=[], mislukt=[];
    for(const loc of todo){
      try{
        let q = String(loc.addr).trim();
        if(!/belgi|belgium/i.test(q)) q += ', België';
        const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=be&q=' + encodeURIComponent(q);
        const resp = await fetch(url, { headers: { 'User-Agent': 'sporty-logistics/1.0 (logistiek app)', 'Accept-Language': 'nl' } });
        const arr = await resp.json();
        if(Array.isArray(arr) && arr.length){
          const lat = parseFloat(arr[0].lat), lng = parseFloat(arr[0].lon);
          run('UPDATE locaties SET lat=?,lng=? WHERE id=?',[lat,lng,loc.id]);
          gedaan.push({ id:loc.id, name:loc.name, lat, lng });
        } else {
          mislukt.push({ id:loc.id, name:loc.name, reden:'geen resultaat' });
        }
      }catch(e){ mislukt.push({ id:loc.id, name:loc.name, reden:e.message }); }
      await sleep(1100); // Nominatim policy: max 1 verzoek/seconde
    }
    res.json({ gevraagd:todo.length, gelukt:gedaan.length, mislukt:mislukt.length, details:{ gedaan, mislukt } });
  });

  // ── THEMAS ──
  app.get('/api/themas',(req,res)=>{const t=all('SELECT * FROM themas ORDER BY name');const m=all('SELECT * FROM thema_materiaal');res.json(t.map(x=>({...x,materiaal:m.filter(y=>y.thema_id===x.id)})));});
  app.post('/api/themas',(req,res)=>{const{name,color,categorie,leeftijdsgroep,thema_type}=req.body;if(!name||!name.trim())return res.status(400).json({error:'Naam is verplicht'});const id=ins('INSERT INTO themas (name,color,categorie,leeftijdsgroep,thema_type) VALUES (?,?,?,?,?)',[name.trim(),color||'#1D9E75',categorie||'',leeftijdsgroep||'',thema_type||'eigen_materiaal']);res.json({...get('SELECT * FROM themas WHERE id=?',[id]),materiaal:[]});});
  app.put('/api/themas/:id',(req,res)=>{const cur=get('SELECT * FROM themas WHERE id=?',[req.params.id]);if(!cur)return res.status(404).json({error:'Thema niet gevonden'});const{name,color,categorie,leeftijdsgroep,thema_type}=req.body;const nm=(name!==undefined&&name!==null)?name:cur.name;if(!nm||!nm.trim())return res.status(400).json({error:'Naam is verplicht'});run('UPDATE themas SET name=?,color=?,categorie=?,leeftijdsgroep=?,thema_type=? WHERE id=?',[nm.trim(),color||cur.color||'#1D9E75',categorie!==undefined?categorie:(cur.categorie||''),leeftijdsgroep!==undefined?leeftijdsgroep:(cur.leeftijdsgroep||''),thema_type||cur.thema_type||'eigen_materiaal',req.params.id]);res.json(get('SELECT * FROM themas WHERE id=?',[req.params.id]));});
  app.delete('/api/themas/:id',(req,res)=>{run('DELETE FROM thema_materiaal WHERE thema_id=?',[req.params.id]);run('DELETE FROM thema_bundels WHERE thema_id=?',[req.params.id]);run('DELETE FROM themas WHERE id=?',[req.params.id]);res.json({ok:true});});
  app.post('/api/themas/:id/materiaal',(req,res)=>{const{name,qty,stockage_locatie_id,stockage_code}=req.body;const item_type_id=resolveItemTypeId(name);const id=ins('INSERT INTO thema_materiaal (thema_id,name,qty,stockage_locatie_id,stockage_code,item_type_id) VALUES (?,?,?,?,?,?)',[req.params.id,name,qty||1,stockage_locatie_id||null,stockage_code||'',item_type_id]);res.json(get('SELECT * FROM thema_materiaal WHERE id=?',[id]));});
  app.put('/api/themas/:tid/materiaal/:mid',(req,res)=>{const{name,qty,stockage_locatie_id,stockage_code}=req.body;const cur=get('SELECT * FROM thema_materiaal WHERE id=?',[req.params.mid]);run('UPDATE thema_materiaal SET name=?,qty=?,stockage_locatie_id=?,stockage_code=? WHERE id=? AND thema_id=?',[name,qty,stockage_locatie_id||null,stockage_code!==undefined?stockage_code:(cur?cur.stockage_code||'':''),req.params.mid,req.params.tid]);res.json(get('SELECT * FROM thema_materiaal WHERE id=?',[req.params.mid]));});
  app.delete('/api/themas/:tid/materiaal/:mid',(req,res)=>{run('DELETE FROM thema_materiaal WHERE id=? AND thema_id=?',[req.params.mid,req.params.tid]);res.json({ok:true});});

  // ── S4.7: THEMABUNDEL-PDF'S ──
  // Bestandsnamen komen letterlijk uit bundels/ (repo-map, meegedeployed) — geen upload-flow,
  // enkel koppelen aan wat daar al staat (dropdown, zie GET /api/bundels/bestanden).
  app.get('/api/bundels/bestanden',(req,res)=>{
    let bestanden=[];
    try{ bestanden=fs.readdirSync(BUNDELS_DIR).filter(f=>f.toLowerCase().endsWith('.pdf')).sort((a,b)=>a.localeCompare(b,'nl')); }
    catch(e){ bestanden=[]; }
    res.json(bestanden);
  });
  app.get('/api/themas/:id/bundels',(req,res)=>{
    res.json(all('SELECT * FROM thema_bundels WHERE thema_id=? ORDER BY volgorde,id',[req.params.id]));
  });
  app.post('/api/themas/:id/bundels',(req,res)=>{
    const{bestand,label}=req.body;
    if(!bestand||!bestand.trim())return res.status(400).json({error:'bestand is verplicht'});
    // Reviewfix Fable: alleen kale bestandsnamen uit de bundels-map zelf — geen padscheiders of
    // '..' (path-traversal: '..\\server.js' werd anders gewoon gekoppeld).
    if(bestand!==path.basename(bestand)||bestand.includes('..'))return res.status(400).json({error:'Ongeldige bestandsnaam'});
    if(!fs.existsSync(path.join(BUNDELS_DIR,bestand)))return res.status(400).json({error:'Dit bestand staat niet (meer) in de bundels-map'});
    const maxOrd=(get('SELECT MAX(volgorde) as m FROM thema_bundels WHERE thema_id=?',[req.params.id])||{}).m||0;
    const id=ins('INSERT INTO thema_bundels (thema_id,bestand,label,volgorde) VALUES (?,?,?,?)',[req.params.id,bestand,label||'',maxOrd+10]);
    res.json(get('SELECT * FROM thema_bundels WHERE id=?',[id]));
  });
  app.delete('/api/thema-bundels/:id',(req,res)=>{
    run('DELETE FROM thema_bundels WHERE id=?',[req.params.id]);
    res.json({ok:true});
  });

  // ── PLANNING-IMPORT (materiaallijst uit de foto's) ──
  // Leest data/materiaallijst_foto1..10.json server-side, voegt thema's met
  // exact dezelfde naam samen (ook die over 2 fotos lopen) en ontdubbelt
  // materiaal op naam+locatie. Idempotent: bestaande thema's (zelfde naam,
  // hoofdletterongevoelig) worden overgeslagen, dus herhaald importeren
  // dupliceert niets. Kleur: kamp=groen, themadag=blauw. Magazijncode -> stockage_code.
  function _laadImportThemas(){
    const fsx=require('fs'); const px=require('path');
    const dir=px.join(__dirname,'data');
    const map=new Map(); const order=[];
    for(let i=1;i<=10;i++){
      const f=px.join(dir,'materiaallijst_foto'+i+'.json');
      if(!fsx.existsSync(f)) continue;
      let j; try{ j=JSON.parse(fsx.readFileSync(f,'utf8')); }catch(e){ continue; }
      for(const t of (j.themas||[])){
        const key=(t.naam||'').trim(); if(!key) continue;
        if(!map.has(key)){ map.set(key,{naam:key,type:t.type||'kamp',leeftijdsgroep:t.leeftijdsgroep||'',materiaal:[]}); order.push(key); }
        const dst=map.get(key);
        if(!dst.leeftijdsgroep && t.leeftijdsgroep) dst.leeftijdsgroep=t.leeftijdsgroep;
        for(const m of (t.materiaal||[])){
          const dup=dst.materiaal.some(x=>x.naam===m.naam && (x.locatie||'')===(m.locatie||''));
          if(!dup) dst.materiaal.push({naam:m.naam,locatie:m.locatie||''});
        }
      }
    }
    return order.map(k=>map.get(k));
  }
  app.get('/api/import-themas/preview',(req,res)=>{
    return res.status(410).json({error:'Uitgeschakeld — wordt vervangen door de nieuwe thema-invoerflow (zie MASTERPLAN S4)'});
    try{
      const lijst=_laadImportThemas();
      const bestaand=new Set(all('SELECT name FROM themas').map(t=>(t.name||'').trim().toLowerCase()));
      let nieuw=0, bestaat=0, items=0;
      lijst.forEach(t=>{ if(bestaand.has(t.naam.toLowerCase())) bestaat++; else { nieuw++; items+=t.materiaal.length; } });
      res.json({totaal:lijst.length, nieuw, bestaat, materiaalitems:items});
    }catch(e){ res.status(500).json({error:e.message}); }
  });
  app.post('/api/import-themas',(req,res)=>{
    return res.status(410).json({error:'Uitgeschakeld — wordt vervangen door de nieuwe thema-invoerflow (zie MASTERPLAN S4)'});
    try{
      const lijst=_laadImportThemas();
      const bestaand=new Set(all('SELECT name FROM themas').map(t=>(t.name||'').trim().toLowerCase()));
      let aangemaakt=0, overgeslagen=0, items=0;
      lijst.forEach(t=>{
        if(bestaand.has(t.naam.toLowerCase())){ overgeslagen++; return; }
        const color=(t.type==='themadag')?'#2563EB':'#1D9E75';
        const tid=ins('INSERT INTO themas (name,color,categorie,leeftijdsgroep) VALUES (?,?,?,?)',[t.naam,color,'',t.leeftijdsgroep||'']);
        t.materiaal.forEach(m=>{ ins('INSERT INTO thema_materiaal (thema_id,name,qty,stockage_locatie_id,stockage_code) VALUES (?,?,?,?,?)',[tid,m.naam,1,null,m.locatie||'']); items++; });
        bestaand.add(t.naam.toLowerCase());
        aangemaakt++;
      });
      saveDb();
      logAct('thema','import',`Planning-import: ${aangemaakt} thema's, ${items} materiaalitems (${overgeslagen} bestonden al)`,null,'');
      res.json({ok:true, aangemaakt, overgeslagen, materiaalitems:items});
    }catch(e){ res.status(500).json({error:e.message}); }
  });
  // Import uit een geupload bestand: body = {themas:[...]} (of een kale array).
  // Accepteert zowel het foto-formaat (naam/locatie) als app-export (name/stockage_code).
  function _mergeThemaLijst(raw){
    const map=new Map(); const order=[];
    for(const t of (raw||[])){
      const key=((t.naam||t.name||'')+'').trim(); if(!key) continue;
      if(!map.has(key)){ map.set(key,{naam:key,type:t.type||'kamp',leeftijdsgroep:t.leeftijdsgroep||'',materiaal:[]}); order.push(key); }
      const dst=map.get(key);
      if(!dst.leeftijdsgroep && t.leeftijdsgroep) dst.leeftijdsgroep=t.leeftijdsgroep;
      for(const m of (t.materiaal||[])){
        const mn=((m.naam||m.name||'')+'').trim(); if(!mn) continue;
        const loc=((m.locatie||m.stockage_code||'')+'').trim();
        if(!dst.materiaal.some(x=>x.naam===mn && x.locatie===loc)) dst.materiaal.push({naam:mn,locatie:loc});
      }
    }
    return order.map(k=>map.get(k));
  }
  app.post('/api/import-themas/data',(req,res)=>{
    return res.status(410).json({error:'Uitgeschakeld — wordt vervangen door de nieuwe thema-invoerflow (zie MASTERPLAN S4)'});
    try{
      const body=req.body||{};
      const raw=Array.isArray(body)?body:(body.themas||body.lijst||[]);
      const lijst=_mergeThemaLijst(raw);
      if(!lijst.length) return res.status(400).json({error:"Geen thema's in het bestand gevonden"});
      const bestaand=new Set(all('SELECT name FROM themas').map(t=>(t.name||'').trim().toLowerCase()));
      let aangemaakt=0, overgeslagen=0, items=0;
      lijst.forEach(t=>{
        if(bestaand.has(t.naam.toLowerCase())){ overgeslagen++; return; }
        const color=(t.type==='themadag')?'#2563EB':'#1D9E75';
        const tid=ins('INSERT INTO themas (name,color,categorie,leeftijdsgroep) VALUES (?,?,?,?)',[t.naam,color,'',t.leeftijdsgroep||'']);
        t.materiaal.forEach(m=>{ ins('INSERT INTO thema_materiaal (thema_id,name,qty,stockage_locatie_id,stockage_code) VALUES (?,?,?,?,?)',[tid,m.naam,1,null,m.locatie||'']); items++; });
        bestaand.add(t.naam.toLowerCase());
        aangemaakt++;
      });
      saveDb();
      logAct('thema','import',`Bestand-import: ${aangemaakt} thema's, ${items} materiaalitems (${overgeslagen} bestonden al)`,null,'');
      res.json({ok:true, aangemaakt, overgeslagen, materiaalitems:items});
    }catch(e){ res.status(500).json({error:e.message}); }
  });

  // ── STANDAARD MATERIAAL (globale template) ──
  app.get('/api/standaard',(req,res)=>res.json(all('SELECT * FROM standaard_materiaal ORDER BY cat,name')));
  app.post('/api/standaard',(req,res)=>{const{name,qty,cat,stockage_locatie_id}=req.body;const item_type_id=resolveItemTypeId(name);const id=ins('INSERT INTO standaard_materiaal (name,qty,cat,stockage_locatie_id,item_type_id) VALUES (?,?,?,?,?)',[name,qty||1,cat||'andere',stockage_locatie_id||null,item_type_id]);res.json(get('SELECT * FROM standaard_materiaal WHERE id=?',[id]));});
  app.put('/api/standaard/:id',(req,res)=>{const{name,qty,cat,stockage_locatie_id}=req.body;run('UPDATE standaard_materiaal SET name=?,qty=?,cat=?,stockage_locatie_id=? WHERE id=?',[name,qty,cat,stockage_locatie_id||null,req.params.id]);res.json(get('SELECT * FROM standaard_materiaal WHERE id=?',[req.params.id]));});
  app.delete('/api/standaard/:id',(req,res)=>{run('DELETE FROM standaard_materiaal WHERE id=?',[req.params.id]);res.json({ok:true});});

  // ── LOCATIE MATERIAAL: basis (standaard, geldt voor elk kamp) + per-kamp afwijkingen + extra's ──
  // Effectieve lijst = basisitems (verborgen eruit, met evt. qty-override) + kamp-eigen extra's.
  function effectiefMateriaal(locatie_id){
    const basis = all('SELECT * FROM standaard_materiaal ORDER BY cat,name');
    const afw = {}; all('SELECT * FROM kamp_basis_afwijking WHERE locatie_id=?',[locatie_id]).forEach(a=>afw[a.standaard_id]=a);
    const out = basis.map(b=>{ const a=afw[b.id]; return {bron:'basis', standaard_id:b.id, name:b.name, cat:b.cat||'andere', qty:(a&&a.qty!=null)?a.qty:b.qty, qty_basis:b.qty, verborgen:(a&&a.verborgen)?1:0}; });
    all('SELECT * FROM locatie_materiaal WHERE locatie_id=? ORDER BY cat,name',[locatie_id]).forEach(e=>out.push({bron:'extra', id:e.id, name:e.name, cat:e.cat||'andere', qty:e.qty, verborgen:0}));
    return out;
  }
  // Volledige lijst incl. verborgen basisitems (gemarkeerd) zodat de editor alles toont; voor weergave filter je verborgen eruit.
  app.get('/api/locaties/:id/materiaal',(req,res)=>res.json(effectiefMateriaal(req.params.id)));
  // Per-kamp afwijking op een basisitem: verbergen en/of aantal overschrijven (qty=null => terug naar basis-aantal).
  app.post('/api/locaties/:id/basis/:sid',(req,res)=>{
    const {verborgen, qty} = req.body;
    const cur = get('SELECT * FROM kamp_basis_afwijking WHERE locatie_id=? AND standaard_id=?',[req.params.id, req.params.sid]);
    const v = (verborgen===undefined||verborgen===null) ? (cur?cur.verborgen:0) : (verborgen?1:0);
    const q = (qty===undefined) ? (cur?cur.qty:null) : (qty===null?null:Math.max(1,parseInt(qty)||1));
    if(cur){ run('UPDATE kamp_basis_afwijking SET verborgen=?, qty=? WHERE id=?',[v,q,cur.id]); }
    else { ins('INSERT INTO kamp_basis_afwijking (locatie_id,standaard_id,verborgen,qty) VALUES (?,?,?,?)',[req.params.id,req.params.sid,v,q]); }
    res.json({ok:true, verborgen:v, qty:q});
  });
  app.post('/api/locaties/:id/materiaal',(req,res)=>{
    const{name,qty,cat}=req.body;
    const item_type_id=resolveItemTypeId(name);
    const id=ins('INSERT INTO locatie_materiaal (locatie_id,name,qty,cat,item_type_id) VALUES (?,?,?,?,?)',[req.params.id,name,qty||1,cat||'andere',item_type_id]);
    res.json(get('SELECT * FROM locatie_materiaal WHERE id=?',[id]));
  });
  app.put('/api/locatie-materiaal/:id',(req,res)=>{
    const{name,qty,cat}=req.body;
    const cur=get('SELECT * FROM locatie_materiaal WHERE id=?',[req.params.id]);
    const item_type_id=name&&name!==cur?.name?resolveItemTypeId(name):cur?.item_type_id;
    run('UPDATE locatie_materiaal SET name=?,qty=?,cat=?,item_type_id=? WHERE id=?',[name,qty||1,cat||'andere',item_type_id,req.params.id]);
    res.json(get('SELECT * FROM locatie_materiaal WHERE id=?',[req.params.id]));
  });
  app.delete('/api/locatie-materiaal/:id',(req,res)=>{
    run('DELETE FROM locatie_materiaal WHERE id=?',[req.params.id]);
    res.json({ok:true});
  });
  // Kopieer template naar locatie (vanuit standaard_materiaal)
  app.post('/api/locaties/:id/materiaal-van-template',(req,res)=>{
    const std=all('SELECT * FROM standaard_materiaal');
    const existing=all('SELECT name FROM locatie_materiaal WHERE locatie_id=?',[req.params.id]).map(r=>r.name);
    const added=[];
    std.forEach(s=>{
      if(!existing.includes(s.name)){
        const item_type_id=s.item_type_id||resolveItemTypeId(s.name);
        const id=ins('INSERT INTO locatie_materiaal (locatie_id,name,qty,cat,item_type_id) VALUES (?,?,?,?,?)',[req.params.id,s.name,s.qty,s.cat||'andere',item_type_id]);
        added.push(get('SELECT * FROM locatie_materiaal WHERE id=?',[id]));
      }
    });
    res.json(added);
  });

  // ── KAMPMOMENTEN ──
  // Hulpfunctie: geef de maandagdatum van week w in een periode
  function periodeWeekMaandag(week, periode_id) {
    const p = get('SELECT * FROM vakantieperiodes WHERE id=?', [periode_id||1]) ||
              get('SELECT * FROM vakantieperiodes ORDER BY id LIMIT 1') ||
              {start_datum:'2026-06-29', eind_datum:'2026-09-06'};
    const start = new Date(p.start_datum+'T12:00:00');
    const r = new Date(start); r.setDate(start.getDate()+(week-1)*7);
    return {maandag:r, periode:p};
  }

  function getKampmoment(id) {
    const km = get('SELECT * FROM kampmomenten WHERE id=?',[id]);
    if (!km) return null;
    const loc = get('SELECT * FROM locaties WHERE id=?',[km.locatie_id]);
    const kts = all('SELECT * FROM kampmoment_themas WHERE kampmoment_id=?',[id]);
    const themas = kts.map(kt=>{
      const th = get('SELECT * FROM themas WHERE id=?',[kt.thema_id]);
      const mat = all('SELECT * FROM thema_materiaal WHERE thema_id=?',[kt.thema_id]);
      return {...th, mat, kt_id: kt.id, dag: kt.dag};
    });
    const {maandag:ws, periode} = periodeWeekMaandag(km.week, km.periode_id);
    const eind = new Date(periode.eind_datum+'T23:59:59');
    const locMat=effectiefMateriaal(km.locatie_id).filter(m=>!m.verborgen);
    const openDagen=[];
    const gelotenSet=new Set(all('SELECT datum FROM gesloten_dagen').map(g=>g.datum));
    for(let i=0;i<5;i++){
      const d=new Date(ws); d.setDate(ws.getDate()+i);
      if(d>eind) continue;
      const iso=isoDate(d);
      if(gelotenSet.has(iso)) continue;
      const dagRec=get('SELECT * FROM kalender_dagen WHERE locatie_id=? AND datum=?',[km.locatie_id,iso]);
      if(dagRec?dagRec.open==1:true) openDagen.push(iso);
    }
    const sportSets=all(`SELECT sp.set_id, ss.label, ss.item_id, ss.locatie_id as thuis_locatie_id, si.name as item_naam, si.stockage_locatie_id
      FROM sport_planning sp
      JOIN sport_sets ss ON ss.id=sp.set_id
      JOIN sport_items si ON si.id=ss.item_id
      WHERE sp.locatie_id=? AND sp.week=?
      ORDER BY si.name, ss.label`,[km.locatie_id, km.week]);
    const kvPersoon = km.kv_persoon_id ? get('SELECT id,naam FROM personeel WHERE id=?',[km.kv_persoon_id]) : null;
    return {...km, locatie:loc, themas, sport_sets:sportSets, open_dagen:openDagen, locatie_materiaal:locMat, periode, kv_persoon:kvPersoon};
  }

  app.get('/api/kampmomenten',(req,res)=>{
    const kms=all('SELECT * FROM kampmomenten ORDER BY periode_id,week,locatie_id');
    res.json(kms.map(km=>getKampmoment(km.id)).filter(Boolean));
  });

  app.post('/api/kampmomenten',(req,res)=>{
    const{locatie_id,week,periode_id,type,kv_persoon_id}=req.body;
    const periodeIdToUse=periode_id||1;
    const typeVal=(type==='themadag'?'themadag':'kamp');
    try {
      const id=ins('INSERT INTO kampmomenten (locatie_id,week,periode_id,type,kv_persoon_id) VALUES (?,?,?,?,?)',[locatie_id,week,periodeIdToUse,typeVal,kv_persoon_id||null]);
      const loc=get('SELECT * FROM locaties WHERE id=?',[locatie_id]);
      logAct('kampmoment','aangemaakt',`Week ${week} — ${loc?.name||'?'} (nieuw kampmoment)`,locatie_id,loc?.name);
      // Auto-open alle weekdagen voor deze locatie
      const {maandag:ws, periode} = periodeWeekMaandag(week, periodeIdToUse);
      const eind = new Date(periode.eind_datum+'T23:59:59');
      const gelotenSet=new Set(all('SELECT datum FROM gesloten_dagen').map(g=>g.datum));
      for(let i=0;i<5;i++){
        const d=new Date(ws);d.setDate(ws.getDate()+i);
        if(d>eind)continue;
        const iso=isoDate(d);
        if(gelotenSet.has(iso))continue;
        const ex=get('SELECT * FROM kalender_dagen WHERE locatie_id=? AND datum=?',[locatie_id,iso]);
        if(!ex)ins('INSERT INTO kalender_dagen (locatie_id,datum,open) VALUES (?,?,?)',[locatie_id,iso,1]);
      }
      res.json(getKampmoment(id));
    } catch(e){res.status(400).json({error:'Dit kampmoment bestaat al voor deze locatie en week.'});}
  });

  app.put('/api/kampmomenten/:id',(req,res)=>{
    const{week,type,kv_persoon_id}=req.body;
    const old=get('SELECT k.*,l.name as loc_naam FROM kampmomenten k LEFT JOIN locaties l ON l.id=k.locatie_id WHERE k.id=?',[req.params.id]);
    if(week!==undefined) run('UPDATE kampmomenten SET week=? WHERE id=?',[week,req.params.id]);
    if(type!==undefined && (type==='kamp'||type==='themadag')) run('UPDATE kampmomenten SET type=? WHERE id=?',[type,req.params.id]);
    // S3.4: KV-koppeling is persoonsgebonden (ontwerpbeslissing 1) — wijzigt de gekoppelde
    // persoon, dan is een eerder uitgegeven link niet meer geldig voor de juiste naam:
    // bestaand kv_token wissen zodat een volgende link-aanvraag een verse token genereert.
    if(kv_persoon_id!==undefined && kv_persoon_id!==old?.kv_persoon_id){
      run('UPDATE kampmomenten SET kv_persoon_id=?,kv_token=? WHERE id=?',[kv_persoon_id||null,'',req.params.id]);
      if(old) logAct('kampmoment','kv-koppeling',`${old.loc_naam||'?'} week ${old.week}: KV-koppeling gewijzigd`,old.locatie_id,old.loc_naam);
    }
    if(old && week!==undefined && week!==old.week) logAct('kampmoment','verplaatst',`${old.loc_naam||'?'}: week ${old.week} → week ${week}`,old.locatie_id,old.loc_naam);
    if(old && type!==undefined && type!==(old.type||'kamp')) logAct('kampmoment','bewerkt',`${old.loc_naam||'?'} week ${old.week}: ${old.type||'kamp'} → ${type}`,old.locatie_id,old.loc_naam);
    saveDb();
    res.json(getKampmoment(req.params.id));
  });
  // S3.4: KV-link genereren (persoonsgebonden — zonder gekoppelde KV geen link mogelijk)
  app.post('/api/kampmomenten/:id/kv-token',(req,res)=>{
    const km=get('SELECT * FROM kampmomenten WHERE id=?',[req.params.id]);
    if(!km)return res.status(404).json({error:'Kampmoment niet gevonden'});
    if(!km.kv_persoon_id)return res.status(400).json({error:'Koppel eerst een kampverantwoordelijke aan dit kampmoment.'});
    let tok=km.kv_token;
    if(!tok){tok=_genToken(12);run('UPDATE kampmomenten SET kv_token=? WHERE id=?',[tok,req.params.id]);saveDb();}
    res.json({token:tok,url:'/kv/'+tok});
  });

  app.delete('/api/kampmomenten/:id',(req,res)=>{
    const old=get('SELECT k.*,l.name as loc_naam FROM kampmomenten k LEFT JOIN locaties l ON l.id=k.locatie_id WHERE k.id=?',[req.params.id]);
    run('DELETE FROM kampmoment_themas WHERE kampmoment_id=?',[req.params.id]);
    run('DELETE FROM transport_taken WHERE kampmoment_id=?',[req.params.id]);
    run('DELETE FROM kampmomenten WHERE id=?',[req.params.id]);
    if(old) logAct('kampmoment','verwijderd',`Week ${old.week} — ${old.loc_naam||'?'} verwijderd`,old.locatie_id,old.loc_naam);
    res.json({ok:true});
  });

  // ── THEMAS AAN KAMPMOMENT KOPPELEN ──
  app.post('/api/kampmomenten/:id/themas',(req,res)=>{
    const{thema_id,dag,leeftijdsgroep}=req.body;
    const dagVal=(dag===null||dag===undefined)?null:(Number.isInteger(dag)&&dag>=0&&dag<=4?dag:null);
    try{ins('INSERT INTO kampmoment_themas (kampmoment_id,thema_id,dag,leeftijdsgroep) VALUES (?,?,?,?)',[req.params.id,thema_id,dagVal,leeftijdsgroep||'']);res.json(getKampmoment(req.params.id));}
    catch(e){res.status(400).json({error:'Thema al gekoppeld aan dit kampmoment.'});}
  });
  app.delete('/api/kampmomenten/:id/themas/:ktid',(req,res)=>{
    run('DELETE FROM kampmoment_themas WHERE id=?',[req.params.ktid]);
    res.json(getKampmoment(req.params.id));
  });

  // ── KALENDER ──
  app.get('/api/kalender',(req,res)=>{
    const jaar=2026; const werkdagen=[];
    const gesloten=all('SELECT datum FROM gesloten_dagen').map(r=>r.datum);
    for(let m=7;m<=8;m++){for(let d=1;d<=31;d++){const date=new Date(jaar,m-1,d);if(date.getMonth()!==m-1)break;const dow=date.getDay();if(dow===0||dow===6)continue;const iso=isoDate(date);if(gesloten.includes(iso))continue;werkdagen.push(iso);}}
    res.json({werkdagen,locaties:all('SELECT * FROM locaties WHERE type=?',['kamp']),dagen:all('SELECT * FROM kalender_dagen'),gesloten_dagen:all('SELECT * FROM gesloten_dagen')});
  });
  app.post('/api/kalender/toggle',(req,res)=>{const{locatie_id,datum}=req.body;const b=get('SELECT * FROM kalender_dagen WHERE locatie_id=? AND datum=?',[locatie_id,datum]);if(b){run('UPDATE kalender_dagen SET open=? WHERE id=?',[b.open?0:1,b.id]);}else{ins('INSERT INTO kalender_dagen (locatie_id,datum,open) VALUES (?,?,?)',[locatie_id,datum,0]);}res.json(get('SELECT * FROM kalender_dagen WHERE locatie_id=? AND datum=?',[locatie_id,datum]));});
  app.post('/api/kalender/bulk',(req,res)=>{const{locatie_id,datums,open}=req.body;datums.forEach(datum=>{const b=get('SELECT * FROM kalender_dagen WHERE locatie_id=? AND datum=?',[locatie_id,datum]);if(b){run('UPDATE kalender_dagen SET open=? WHERE id=?',[open?1:0,b.id]);}else if(!open){ins('INSERT INTO kalender_dagen (locatie_id,datum,open) VALUES (?,?,?)',[locatie_id,datum,0]);}});res.json({ok:true});});
  app.get('/api/gesloten',(req,res)=>res.json(all('SELECT * FROM gesloten_dagen ORDER BY datum')));
  app.post('/api/gesloten',(req,res)=>{const{datum,reden}=req.body;try{const id=ins('INSERT INTO gesloten_dagen (datum,reden) VALUES (?,?)',[datum,reden||'']);res.json(get('SELECT * FROM gesloten_dagen WHERE id=?',[id]));}catch(e){res.status(400).json({error:'Datum bestaat al'});}});
  app.delete('/api/gesloten/:id',(req,res)=>{run('DELETE FROM gesloten_dagen WHERE id=?',[req.params.id]);res.json({ok:true});});

  // ── S3.3: AANVRAGEN (vervangt de oude losse spoedmeldingen, zie Migratie 55) ──
  // Publiek bereikbaar in principe (komt straks van de KV-link, S3.4/S3.5), maar ligt hier
  // achter de S3.2-auth-poort omdat de KV-link zelf nog niet bestaat in deze taak — kantoor/
  // chauffeur kunnen nu al aanvragen aanmaken en behandelen.
  app.get('/api/aanvragen',(req,res)=>{
    const {status,soort,kampmoment_id}=req.query;
    let sql='SELECT a.*, p.naam AS persoon_naam, km.week AS km_week, l.name AS km_locatie FROM aanvragen a '
      +'LEFT JOIN personeel p ON p.id=a.persoon_id '
      +'LEFT JOIN kampmomenten km ON km.id=a.kampmoment_id '
      +'LEFT JOIN locaties l ON l.id=km.locatie_id WHERE 1=1';
    const params=[];
    if(status){sql+=' AND a.status=?';params.push(status);}
    if(soort){sql+=' AND a.soort=?';params.push(soort);}
    if(kampmoment_id){sql+=' AND a.kampmoment_id=?';params.push(kampmoment_id);}
    sql+=' ORDER BY a.id DESC';
    res.json(all(sql,params));
  });
  app.post('/api/aanvragen',(req,res)=>{
    const{kampmoment_id,persoon_id,soort,tekst,foto_data}=req.body;
    if(!tekst||!tekst.trim())return res.status(400).json({error:'Tekst is verplicht'});
    const id=ins('INSERT INTO aanvragen (kampmoment_id,persoon_id,soort,tekst,foto_data,status,created_at) VALUES (?,?,?,?,?,?,?)',
      [kampmoment_id||null,persoon_id||null,soort||'materiaal',tekst.trim(),foto_data||'','nieuw',now()]);
    logAct('aanvraag','aangemaakt',`📨 Nieuwe aanvraag (${soort||'materiaal'}): ${tekst.trim()}`,null,null);
    res.json(get('SELECT * FROM aanvragen WHERE id=?',[id]));
  });
  app.put('/api/aanvragen/:id/status',(req,res)=>{
    const{status,reden,maak_spoedtransport,spoedtransport}=req.body;
    const a=get('SELECT * FROM aanvragen WHERE id=?',[req.params.id]);
    if(!a)return res.status(404).json({error:'Aanvraag niet gevonden'});
    if(!['nieuw','goedgekeurd','afgewezen','afgehandeld'].includes(status))return res.status(400).json({error:'Ongeldige status'});
    const behandeld_door=(req.persoon&&req.persoon.naam)||'';
    let spoed_taak_id=a.spoed_taak_id;
    if(status==='goedgekeurd'&&maak_spoedtransport&&!spoed_taak_id){
      const st=spoedtransport||{};
      const naam=(st.item||a.tekst||'').trim();
      const aantal=Math.max(1,parseInt(st.qty)||1);
      const ts=now();
      const spoedDatum=st.datum||isoDate(new Date());
      const ritId=ins('INSERT INTO transport_ritten (datum,chauffeur,opmerking,status,created_at) VALUES (?,?,?,?,?)',
        [spoedDatum,'','Spoedtransport (aanvraag #'+a.id+')','gepland',ts]);
      const taakId=ins(
        'INSERT INTO transport_taken (type,datum,tijd,van_locatie_id,naar_locatie_id,opmerking,wie,status,created_at,spoed_kind,spoed_ref_id,spoed_effect_toegepast,rit_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
        ['extra',spoedDatum,st.tijd||'09:00',st.van_locatie_id||null,st.naar_locatie_id||null,'🚨 Spoed (aanvraag #'+a.id+'): '+naam,'','gepland',ts,st.kind||'',st.ref_id||0,0,ritId]);
      ins('INSERT INTO transport_regels (taak_id,naam,qty,soort,item_type_id) VALUES (?,?,?,?,?)',[taakId,naam,aantal,'spoed',resolveItemTypeId(naam)]);
      spoed_taak_id=taakId;
    }
    run('UPDATE aanvragen SET status=?,reden=?,spoed_taak_id=?,behandeld_door=?,behandeld_op=? WHERE id=?',
      [status,reden||'',spoed_taak_id||null,behandeld_door,now(),req.params.id]);
    saveDb();
    logAct('aanvraag',status,`Aanvraag #${a.id} → ${status}`+(reden?` (${reden})`:''),null,null);
    res.json(get('SELECT * FROM aanvragen WHERE id=?',[req.params.id]));
  });

  // ── MATERIAAL ──
  app.get('/api/materiaal',(req,res)=>{const items=all('SELECT * FROM materiaal_items ORDER BY cat,name');const eenheden=all('SELECT * FROM materiaal_eenheden');res.json(items.map(i=>({...i,eenheden:eenheden.filter(e=>e.item_id===i.id)})));});
  app.post('/api/materiaal',(req,res)=>{const{name,tracking,cat}=req.body;const item_type_id=resolveItemTypeId(name);const id=ins('INSERT INTO materiaal_items (name,tracking,cat,created_at,item_type_id) VALUES (?,?,?,?,?)',[name,tracking||'per_type',cat||'andere',now(),item_type_id]);res.json({...get('SELECT * FROM materiaal_items WHERE id=?',[id]),eenheden:[]});});
  app.put('/api/materiaal/:id',(req,res)=>{const{name,tracking,cat}=req.body;const cur=get('SELECT * FROM materiaal_items WHERE id=?',[req.params.id]);const item_type_id=name&&name!==cur?.name?resolveItemTypeId(name):cur?.item_type_id;run('UPDATE materiaal_items SET name=?,tracking=?,cat=?,item_type_id=? WHERE id=?',[name,tracking,cat,item_type_id,req.params.id]);res.json(get('SELECT * FROM materiaal_items WHERE id=?',[req.params.id]));});
  app.delete('/api/materiaal/:id',(req,res)=>{const ee=all('SELECT id FROM materiaal_eenheden WHERE item_id=?',[req.params.id]);ee.forEach(e=>run('DELETE FROM verplaatsingen WHERE eenheid_id=?',[e.id]));run('DELETE FROM materiaal_eenheden WHERE item_id=?',[req.params.id]);run('DELETE FROM materiaal_items WHERE id=?',[req.params.id]);res.json({ok:true});});
  app.get('/api/overzicht',(req,res)=>{const locs=all('SELECT * FROM locaties ORDER BY type,name');const items=all('SELECT * FROM materiaal_items');const eenheden=all('SELECT * FROM materiaal_eenheden');res.json(locs.map(l=>({...l,eenheden:eenheden.filter(e=>e.locatie_id===l.id).map(e=>({...e,item:items.find(i=>i.id===e.item_id)||{}}))})));});

  // ── THEMA CATEGORIEËN ──
  app.get('/api/thema-categorieen',(req,res)=>res.json(all('SELECT * FROM thema_categorieen ORDER BY name')));
  app.post('/api/thema-categorieen',(req,res)=>{
    const{name}=req.body;if(!name||!name.trim())return res.status(400).json({error:'Naam vereist'});
    try{const id=ins('INSERT INTO thema_categorieen(name)VALUES(?)',[name.trim()]);res.json(get('SELECT * FROM thema_categorieen WHERE id=?',[id]));}
    catch(e){res.status(400).json({error:'Categorie bestaat al'});}
  });
  app.delete('/api/thema-categorieen/:id',(req,res)=>{
    run('DELETE FROM thema_categorieen WHERE id=?',[req.params.id]);res.json({ok:true});
  });

  // ── CHAUFFEURS/PLOEGPLANNING: S3.1 verwijderd, opgegaan in /api/personeel (rol='chauffeur')
  // + /api/personeel/:id/shifts + personeel_shifts. Zie Migratie 54 voor de datamigratie en
  // MASTERPLAN FASE S3 voor de achtergrond. De oude tabellen chauffeurs/ploeg_shifts blijven
  // in de database staan als archief maar worden vanuit code niet meer beschreven.

  // ── VERBRUIKSSTOCK ──
  app.get('/api/verbruik', (req,res)=>{
    const items = all("SELECT * FROM materiaal_items WHERE tracking='verbruik' ORDER BY cat,name");
    const stock = all('SELECT vs.*, l.name as locatie_name FROM verbruik_stock vs LEFT JOIN locaties l ON l.id=vs.locatie_id');
    const logs = all('SELECT vl.*, l.name as locatie_name FROM verbruik_log vl LEFT JOIN locaties l ON l.id=vl.locatie_id ORDER BY vl.created_at DESC LIMIT 500');
    res.json(items.map(item=>({
      ...item,
      stock: stock.filter(s=>s.item_id===item.id),
      totaal: stock.filter(s=>s.item_id===item.id).reduce((sum,s)=>sum+s.qty,0),
      alarm: stock.filter(s=>s.item_id===item.id).some(s=>s.qty<=s.minimum&&s.minimum>0),
      log: logs.filter(l=>l.item_id===item.id).slice(0,20)
    })));
  });

  // Set/update stock for item at location
  app.post('/api/verbruik/:id/stock', (req,res)=>{
    const{locatie_id,qty,minimum,eenheid}=req.body;
    run('INSERT OR REPLACE INTO verbruik_stock(item_id,locatie_id,qty,minimum,eenheid) VALUES(?,?,?,?,?)',
      [req.params.id,locatie_id,qty??0,minimum??0,eenheid||'stuks']);
    saveDb();
    res.json(get('SELECT vs.*,l.name as locatie_name FROM verbruik_stock vs LEFT JOIN locaties l ON l.id=vs.locatie_id WHERE vs.item_id=? AND vs.locatie_id=?',[req.params.id,locatie_id]));
  });


  // ── TRANSPORT ──
  app.get('/api/transport-taken',(req,res)=>{const taken=all('SELECT * FROM transport_taken ORDER BY datum,tijd');const regels=all('SELECT * FROM transport_regels');res.json(taken.map(t=>({...t,regels:regels.filter(r=>r.taak_id===t.id)})));});
  app.post('/api/transport-genereer',(req,res)=>{
    // v1: themadag-kampmomenten worden door deze generator overgeslagen voor
    // basis/thema-materiaal. Hun transport gaat handmatig via de transport-planner.
    // Sport-sets blijven wel werken (per locatie+week, niet per kampmoment-type).
    const kms=all('SELECT * FROM kampmomenten ORDER BY locatie_id, week');
    const locs=all('SELECT * FROM locaties');
    const themas=all('SELECT * FROM themas');
    // S2.6: chauffeur ziet bakken, geen inhoud. Eén transport_regel per BAK of ATTRIBUUT
    // die aan het thema gekoppeld is (niet meer per item). Van-locatie = de eigen
    // thuislocatie_id van de bak/het attribuut (niet meer hardcoded op naam).
    const themaBakken=all(`SELECT b.id AS bak_id, b.naam, b.code, b.thuislocatie_id, tb.thema_id
      FROM bakken b JOIN thema_bak tb ON tb.bak_id=b.id WHERE b.soort='thema'`);
    const themaAttrRegels=all(`SELECT a.id AS attr_id, a.naam, a.code, a.thuislocatie_id, ta.thema_id
      FROM attributen a JOIN thema_attribuut ta ON ta.attribuut_id=a.id`);
    const allLocMat=all('SELECT * FROM locatie_materiaal');
    const standaard=all('SELECT * FROM standaard_materiaal');
    const kts=all('SELECT * FROM kampmoment_themas');
    const kalDagen=all('SELECT * FROM kalender_dagen');
    const gelotenDagen=all('SELECT * FROM gesloten_dagen').map(g=>g.datum);
    const allKleuren=all('SELECT * FROM locatie_kleuren');
    const stockage=locs.filter(l=>l.type==='stockage');
    // Enkel top-level stockageplaatsen komen in aanmerking (sub-locaties zoals RGA-RGF,
    // Boven/Beneden/Naschoolse zijn kamers/codes BINNEN Kantoor of Rozenweg, geen aparte
    // ophaal-/leverbestemming op zich).
    const stockageTopLevel=stockage.filter(l=>!l.parent_id);

    // Typed stockage: basis/sport → Kantoor, alles met een code (themabakken/attributen) → Rozenweg.
    // Naam-match eerst (expliciete regel), stockage_rol als terugval voor toekomstige locaties.
    const sportStockageId=stockageTopLevel.find(l=>l.name==='Kantoor')?.id
      ||stockageTopLevel.find(l=>l.stockage_rol==='sport'||l.stockage_rol==='beide')?.id||stockageTopLevel[0]?.id||null;
    const themaStockageId=stockageTopLevel.find(l=>l.name==='Rozenweg')?.id
      ||stockageTopLevel.find(l=>l.stockage_rol==='thema'||l.stockage_rol==='beide')?.id||stockageTopLevel[0]?.id||null;

    const allPeriodes=all('SELECT * FROM vakantieperiodes');
    const defaultPeriode=allPeriodes[0]||{id:1,start_datum:'2026-06-29',eind_datum:'2026-09-06'};
    const voorstellen=[];

    function getOpenDagen(km){
      const periode=allPeriodes.find(p=>p.id===(km.periode_id||1))||defaultPeriode;
      const ws=new Date(periode.start_datum+'T12:00:00');ws.setDate(ws.getDate()+(km.week-1)*7);
      const eind=new Date(periode.eind_datum+'T23:59:59');
      const days=[];
      for(let i=0;i<5;i++){const d=new Date(ws);d.setDate(ws.getDate()+i);if(d>eind)continue;const iso=isoDate(d);if(gelotenDagen.includes(iso))continue;const dr=kalDagen.find(k=>k.locatie_id===km.locatie_id&&k.datum===iso);if(dr?dr.open==1:true)days.push(iso);}
      return days;
    }
    function prevWorkday(iso){const d=new Date(iso);d.setDate(d.getDate()-1);if(d.getDay()===0)d.setDate(d.getDate()-2);if(d.getDay()===6)d.setDate(d.getDate()-1);return isoDate(d);}
    function nextWorkday(iso){const d=new Date(iso);d.setDate(d.getDate()+1);if(d.getDay()===0)d.setDate(d.getDate()+1);if(d.getDay()===6)d.setDate(d.getDate()+2);return isoDate(d);}

    // ── PER LOCATIE: basis + thema transport ──
    const perLocatie={};
    kms.forEach(km=>{if(!perLocatie[km.locatie_id])perLocatie[km.locatie_id]=[];perLocatie[km.locatie_id].push(km);});

    Object.entries(perLocatie).forEach(([locId,kmListAll])=>{
      const loc=locs.find(l=>l.id==locId);if(!loc)return;
      const locMat=(allLocMat.filter(m=>m.locatie_id==locId).length?allLocMat.filter(m=>m.locatie_id==locId):standaard);

      // Filter themadag-kampmomenten weg vóór het itereren — anders breken
      // de prevKm/nextKm contiguïteits-checks (de themadag staat tussen 2 themakampen).
      const kmList=kmListAll.filter(k=>k.type!=='themadag').sort((a,b)=>a.week-b.week);
      // S5.2: basis-materiaal en kleurenborden volgen "periode-bereik per locatie" i.p.v.
      // "aansluitende weken" — enkel de EERSTE open week van de locatie in de periode levert,
      // enkel de LAATSTE haalt op; gap-weken (locatie tijdelijk dicht, later weer open) krijgen
      // GEEN ophaal-/herlevervoorstel — dat materiaal blijft gewoon staan. kleurenStand houdt per
      // kleur bij hoeveel er (cumulatief, enkel toenames) al effectief op de locatie staat, zodat
      // een latere open week alleen het positieve verschil bijgeleverd krijgt (nooit terugname).
      const kleurenOpenWeken=kmList.filter(km=>getOpenDagen(km).length);
      const kleurenStand={};
      kmList.forEach((km,idx)=>{
        const openDagen=getOpenDagen(km);
        if(!openDagen.length)return;
        const kmThemas=kts.filter(kt=>kt.kampmoment_id===km.id);
        const thNamen=kmThemas.map(kt=>themas.find(t=>t.id===kt.thema_id)?.name||'?').join(', ');
        const prevKm=kmList[idx-1];
        const nextKm=kmList[idx+1];
        const isOpvolgend=prevKm&&prevKm.week===km.week-1;
        const heeftOpvolger=nextKm&&nextKm.week===km.week+1;
        // S5.2: periode-bereik i.p.v. aansluitende weken — enkel voor basis/kleurenborden/locatieconfig.
        const idxOpen=kleurenOpenWeken.indexOf(km);
        const isEersteVanPeriode=idxOpen===0;
        const isLaatsteVanPeriode=idxOpen===kleurenOpenWeken.length-1;

        // S2.6: Thema-materiaal = één regel per BAK of ATTRIBUUT (chauffeur ziet bakken, geen inhoud).
        // Van-locatie = de eigen thuislocatie_id van de bak/het attribuut (fallback: themaStockageId).
        const themaMatRegels=kmThemas.flatMap(kt=>{
          const bakRegels=themaBakken.filter(b=>b.thema_id===kt.thema_id).map(b=>({naam:'Bak '+b.naam+(b.code?' ('+b.code+')':''),qty:1,soort:'thema',stockage_id:b.thuislocatie_id||themaStockageId,bak_id:b.bak_id}));
          const attrRegels=themaAttrRegels.filter(a=>a.thema_id===kt.thema_id).map(a=>({naam:'Attribuut '+a.naam+(a.code?' ('+a.code+')':''),qty:1,soort:'attribuut',stockage_id:a.thuislocatie_id||themaStockageId,attribuut_id:a.attr_id}));
          return [...bakRegels,...attrRegels];
        });
        // S5.1 (uitbreiding): een thema dat deze week op deze locatie START doordat het via een
        // directe transfer van een andere locatie komt (vorige week elders) wordt door het
        // "DIRECT THEMA-TRANSFER"-blok geleverd — hier NIET nog eens meesturen als "eerste
        // levering", anders krijg je zowel de transfer als een volledige stockage-levering voor
        // dezelfde bakken bij een locatie die voor het eerst in de kmList opduikt.
        const kmThemasNietViaDirecteTransfer=kmThemas.filter(kt=>{
          const komtDirectVanAndereLocatie=kts.some(kt2=>kt2.thema_id===kt.thema_id&&kt2.kampmoment_id!==km.id&&
            (()=>{const km2=kms.find(k=>k.id===kt2.kampmoment_id);return km2&&km2.week===km.week-1&&km2.locatie_id!==km.locatie_id;})());
          return !komtDirectVanAndereLocatie;
        });
        const themaMatRegelsEersteLevering=kmThemasNietViaDirecteTransfer.flatMap(kt=>{
          const bakRegels=themaBakken.filter(b=>b.thema_id===kt.thema_id).map(b=>({naam:'Bak '+b.naam+(b.code?' ('+b.code+')':''),qty:1,soort:'thema',stockage_id:b.thuislocatie_id||themaStockageId,bak_id:b.bak_id}));
          const attrRegels=themaAttrRegels.filter(a=>a.thema_id===kt.thema_id).map(a=>({naam:'Attribuut '+a.naam+(a.code?' ('+a.code+')':''),qty:1,soort:'attribuut',stockage_id:a.thuislocatie_id||themaStockageId,attribuut_id:a.attr_id}));
          return [...bakRegels,...attrRegels];
        });
        // Locatieconfig-exemplaren (S2.5/S2.6): bij de eerste levering van dit kampmoment de
        // vereiste vaste exemplaren (EHBO-koffer, adminkast...) meenemen als eigen transport_regel.
        const locConfigRegels=(isEersteVanPeriode)?_actieveLocatieConfig(km).flatMap(cfg=>{
          const vrij=all("SELECT * FROM bakken WHERE soort='vast' AND vast_type=? AND status='thuis' ORDER BY volgorde,id LIMIT ?",[cfg.vast_type,cfg.aantal||1]);
          return vrij.map(b=>({naam:'Bak '+b.naam+(b.code?' ('+b.code+')':''),qty:1,soort:'vast',stockage_id:b.thuislocatie_id||sportStockageId,bak_id:b.id}));
        }):[];
        // Basis-materiaal met per-item stockage (fallback: sportStockageId)
        const basisRegels=locMat.map(m=>({naam:m.name,qty:m.qty,soort:'basis',stockage_id:m.stockage_locatie_id||sportStockageId}));

        // Groepeer regels per stockage-locatie en push één transport per groep
        function byStockage(regels){const g={};regels.forEach(r=>{if(!r.stockage_id)return;const k=r.stockage_id;if(!g[k])g[k]=[];g[k].push(r);});return g;}

        const prevD=prevWorkday(openDagen[0]);
        // Kleurenborden voor deze locatie+week: eerste open week van de periode = volledige
        // levering; latere open weken (aansluitend of na een gap) = enkel het positieve verschil
        // t.o.v. wat al staat (kleurenStand); nooit tussentijds terughalen.
        const kleurenHuidig=allKleuren.filter(k=>k.locatie_id==loc.id&&k.week===km.week);
        let kleurenRegels=[];
        if(isEersteVanPeriode){
          kleurenRegels=kleurenHuidig.map(k=>({naam:`Kleurenbord ${k.kleur} ×${k.aantal}`,qty:k.aantal,soort:'basis',stockage_id:sportStockageId}));
          kleurenHuidig.forEach(k=>{kleurenStand[k.kleur]=k.aantal;});
        } else {
          kleurenHuidig.forEach(k=>{
            const stand=kleurenStand[k.kleur]||0;
            const extra=k.aantal-stand;
            if(extra>0){
              kleurenRegels.push({naam:`Kleurenbord ${k.kleur} ×${extra} (bijlevering, staat al ${stand})`,qty:extra,soort:'basis',stockage_id:sportStockageId});
              kleurenStand[k.kleur]=k.aantal;
            }
          });
        }
        if(isEersteVanPeriode){
          // Eerste open week van de locatie in de periode: lever basis-materiaal + locatieconfig per stockage-groep
          const basisPlusKleuren=[...basisRegels,...kleurenRegels];
          Object.entries(byStockage(basisPlusKleuren)).forEach(([sid,mat])=>{
            const sLoc=locs.find(l=>l.id==sid);
            voorstellen.push({type:'levering',kampmoment_id:km.id,week:km.week,locatie:loc.name,locatie_id:loc.id,van_locatie_id:parseInt(sid),datum:prevD,tijd:'08:00',open_dagen:openDagen,materiaal:mat,opmerking:'Levering basis week '+km.week+' — '+loc.name+(sLoc?' (van '+sLoc.name+')':'')});
          });
        } else if(kleurenRegels.length){
          // Gap-week/latere open week: enkel het kleurenverschil bijleveren, geen basis-materiaal.
          Object.entries(byStockage(kleurenRegels)).forEach(([sid,mat])=>{
            const sLoc=locs.find(l=>l.id==sid);
            voorstellen.push({type:'levering',kampmoment_id:km.id,week:km.week,locatie:loc.name,locatie_id:loc.id,van_locatie_id:parseInt(sid),datum:prevD,tijd:'08:00',open_dagen:openDagen,materiaal:mat,opmerking:'Bijlevering kleurenverschil week '+km.week+' — '+loc.name});
          });
        }
        if(!isOpvolgend){
          Object.entries(byStockage([...themaMatRegelsEersteLevering,...locConfigRegels])).forEach(([sid,mat])=>{
            const sLoc=locs.find(l=>l.id==sid);
            voorstellen.push({type:'levering',kampmoment_id:km.id,week:km.week,locatie:loc.name,locatie_id:loc.id,van_locatie_id:parseInt(sid),datum:prevD,tijd:'09:00',open_dagen:openDagen,materiaal:mat,opmerking:'Levering thema week '+km.week+' — '+loc.name+' ('+thNamen+(sLoc?', van '+sLoc.name:'')+')'});
          });
        } else {
          // Opvolgende week: thema-wissel per stockage-groep
          const prevKmThemas=kts.filter(kt=>kt.kampmoment_id===prevKm.id);
          const prevThIds=new Set(prevKmThemas.map(kt=>kt.thema_id));
          const newThIds=new Set(kmThemas.map(kt=>kt.thema_id));
          const vertrekkendeAll=prevKmThemas.filter(kt=>!newThIds.has(kt.thema_id));
          const aankomende=kmThemas.filter(kt=>!prevThIds.has(kt.thema_id));

          // Aankomende thema's die direct van een andere locatie komen (A→B consecutive)
          // worden afgehandeld door het "DIRECT THEMA-TRANSFER" blok → hier overslaan.
          const aankomendeViaStockage=aankomende.filter(kt=>{
            const kwamVanAndereLocatie=kts.some(kt2=>kt2.thema_id===kt.thema_id&&kt2.kampmoment_id!==km.id&&
              (()=>{const km2=kms.find(k=>k.id===kt2.kampmoment_id);return km2&&km2.week===km.week-1&&km2.locatie_id!==km.locatie_id;})());
            return !kwamVanAndereLocatie;
          });
          // S5.1: symmetrische fix — een VERTREKKEND thema waarvoor een directe transfer bestaat
          // (zelfde thema, volgende week km.week, andere locatie) wordt hier NIET meer als
          // wissel-ophaling opgevoerd — dat wordt al door het "DIRECT THEMA-TRANSFER" blok gedaan.
          // Zonder deze filter kreeg je zowel de directe transfer als deze ophaling voor
          // dezelfde bakken (simulatie-bevinding 1). Eén thema-verplaatsing = precies één voorstel.
          const vertrekkende=vertrekkendeAll.filter(kt=>{
            const gaatDirectNaarAndereLocatie=kts.some(kt2=>kt2.thema_id===kt.thema_id&&kt2.kampmoment_id!==prevKm.id&&
              (()=>{const km2=kms.find(k=>k.id===kt2.kampmoment_id);return km2&&km2.week===prevKm.week+1&&km2.locatie_id!==prevKm.locatie_id;})());
            return !gaatDirectNaarAndereLocatie;
          });
          if(vertrekkende.length||aankomendeViaStockage.length){
            const ophaalMat=vertrekkende.flatMap(kt=>[
              ...themaBakken.filter(b=>b.thema_id===kt.thema_id).map(b=>({naam:'Bak '+b.naam+(b.code?' ('+b.code+')':''),qty:1,soort:'thema',stockage_id:b.thuislocatie_id||themaStockageId,bak_id:b.bak_id})),
              ...themaAttrRegels.filter(a=>a.thema_id===kt.thema_id).map(a=>({naam:'Attribuut '+a.naam+(a.code?' ('+a.code+')':''),qty:1,soort:'attribuut',stockage_id:a.thuislocatie_id||themaStockageId,attribuut_id:a.attr_id}))
            ]);
            const leverMat=aankomendeViaStockage.flatMap(kt=>[
              ...themaBakken.filter(b=>b.thema_id===kt.thema_id).map(b=>({naam:'Bak '+b.naam+(b.code?' ('+b.code+')':''),qty:1,soort:'thema',stockage_id:b.thuislocatie_id||themaStockageId,bak_id:b.bak_id})),
              ...themaAttrRegels.filter(a=>a.thema_id===kt.thema_id).map(a=>({naam:'Attribuut '+a.naam+(a.code?' ('+a.code+')':''),qty:1,soort:'attribuut',stockage_id:a.thuislocatie_id||themaStockageId,attribuut_id:a.attr_id}))
            ]);
            const prevOpen=getOpenDagen(prevKm);
            const wisseldatum=prevOpen.length?nextWorkday(prevOpen[prevOpen.length-1]):prevWorkday(openDagen[0]);
            Object.entries(byStockage(ophaalMat)).forEach(([sid,mat])=>{
              voorstellen.push({type:'ophaling',kampmoment_id:km.id,week:km.week,locatie:loc.name,locatie_id:loc.id,naar_locatie_id:parseInt(sid),datum:wisseldatum,tijd:'09:00',open_dagen:openDagen,materiaal:mat,opmerking:'Thema-wissel ophaling week '+km.week+' — '+loc.name});
            });
            Object.entries(byStockage(leverMat)).forEach(([sid,mat])=>{
              voorstellen.push({type:'levering',kampmoment_id:km.id,week:km.week,locatie:loc.name,locatie_id:loc.id,van_locatie_id:parseInt(sid),datum:wisseldatum,tijd:'11:00',open_dagen:openDagen,materiaal:mat,opmerking:'Thema-wissel levering week '+km.week+' — '+loc.name});
            });
          }
        }

        if(isLaatsteVanPeriode){
          // Laatste OPEN week van de locatie binnen de periode (definitief dicht daarna, of
          // laatste week van de vakantie): haal basis-materiaal, kleurenborden (alles wat
          // cumulatief effectief staat volgens kleurenStand) en locatieconfig-exemplaren op.
          const nextD=nextWorkday(openDagen[openDagen.length-1]);
          const kleurenOphaalRegels=Object.entries(kleurenStand).filter(([,q])=>q>0)
            .map(([kleur,aantal])=>({naam:`Kleurenbord ${kleur} ×${aantal}`,qty:aantal,soort:'basis',stockage_id:sportStockageId}));
          const basisPlusKleuren=[...basisRegels,...kleurenOphaalRegels];
          Object.entries(byStockage(basisPlusKleuren)).forEach(([sid,mat])=>{
            const sLoc=locs.find(l=>l.id==sid);
            voorstellen.push({type:'ophaling',kampmoment_id:km.id,week:km.week,locatie:loc.name,locatie_id:loc.id,naar_locatie_id:parseInt(sid),datum:nextD,tijd:'17:00',open_dagen:openDagen,materiaal:mat,opmerking:'Ophaling basis week '+km.week+' — '+loc.name+(sLoc?' (naar '+sLoc.name+')':'')});
          });
          // Locatieconfig-exemplaren gaan terug mee naar hun thuislocatie.
          // Reviewfix: bij vooraf plannen (alles in één keer genereren) staan de exemplaren nog
          // 'thuis' — val dan terug op dezelfde vrije exemplaren die de levering zou kiezen,
          // anders ontbreekt de eind-ophaling bij definitieve sluiting (bindende regel 1).
          const locConfigTerug=(_actieveLocatieConfig(km)).flatMap(cfg=>{
            let exemplaren=all("SELECT * FROM bakken WHERE soort='vast' AND vast_type=? AND status='op_locatie' AND huidige_locatie_id=? LIMIT ?",[cfg.vast_type,loc.id,cfg.aantal||1]);
            if(!exemplaren.length)
              exemplaren=all("SELECT * FROM bakken WHERE soort='vast' AND vast_type=? AND status='thuis' LIMIT ?",[cfg.vast_type,cfg.aantal||1]);
            return exemplaren.map(b=>({naam:'Bak '+b.naam+(b.code?' ('+b.code+')':''),qty:1,soort:'vast',stockage_id:b.thuislocatie_id||sportStockageId,bak_id:b.id}));
          });
          Object.entries(byStockage(locConfigTerug)).forEach(([sid,mat])=>{
            voorstellen.push({type:'ophaling',kampmoment_id:km.id,week:km.week,locatie:loc.name,locatie_id:loc.id,naar_locatie_id:parseInt(sid),datum:nextD,tijd:'17:00',open_dagen:openDagen,materiaal:mat,opmerking:'Ophaling vast materiaal week '+km.week+' — '+loc.name});
          });
        }

        // Pauze-gedrag (Migratie 58, Maxim): config-regels met pauze_gedrag='ophalen' gaan wél
        // tijdelijk mee terug bij een pauze en worden herleverd bij heropening. Alles met
        // 'blijven' (default) volgt de bindende regel: laten staan tijdens tijdelijke sluiting.
        if(!heeftOpvolger && !isLaatsteVanPeriode){
          // Laatste open week vóór een pauze → ophaal van de 'ophalen'-types
          const nextD=nextWorkday(openDagen[openDagen.length-1]);
          const pauzeTerug=_actieveLocatieConfig(km).filter(cfg=>cfg.pauze_gedrag==='ophalen').flatMap(cfg=>{
            let exemplaren=all("SELECT * FROM bakken WHERE soort='vast' AND vast_type=? AND status='op_locatie' AND huidige_locatie_id=? LIMIT ?",[cfg.vast_type,loc.id,cfg.aantal||1]);
            if(!exemplaren.length)
              exemplaren=all("SELECT * FROM bakken WHERE soort='vast' AND vast_type=? AND status='thuis' ORDER BY volgorde,id LIMIT ?",[cfg.vast_type,cfg.aantal||1]);
            return exemplaren.map(b=>({naam:'Bak '+b.naam+(b.code?' ('+b.code+')':''),qty:1,soort:'vast',stockage_id:b.thuislocatie_id||sportStockageId,bak_id:b.id}));
          });
          Object.entries(byStockage(pauzeTerug)).forEach(([sid,mat])=>{
            voorstellen.push({type:'ophaling',kampmoment_id:km.id,week:km.week,locatie:loc.name,locatie_id:loc.id,naar_locatie_id:parseInt(sid),datum:nextD,tijd:'17:00',open_dagen:openDagen,materiaal:mat,opmerking:'Pauze-ophaling vast materiaal na week '+km.week+' — '+loc.name+' (heropent later)'});
          });
        }
        if(!isOpvolgend && !isEersteVanPeriode){
          // Eerste open week ná een pauze → herlevering van de 'ophalen'-types
          const pauzeLever=_actieveLocatieConfig(km).filter(cfg=>cfg.pauze_gedrag==='ophalen').flatMap(cfg=>{
            const vrij=all("SELECT * FROM bakken WHERE soort='vast' AND vast_type=? AND status='thuis' ORDER BY volgorde,id LIMIT ?",[cfg.vast_type,cfg.aantal||1]);
            return vrij.map(b=>({naam:'Bak '+b.naam+(b.code?' ('+b.code+')':''),qty:1,soort:'vast',stockage_id:b.thuislocatie_id||sportStockageId,bak_id:b.id}));
          });
          Object.entries(byStockage(pauzeLever)).forEach(([sid,mat])=>{
            voorstellen.push({type:'levering',kampmoment_id:km.id,week:km.week,locatie:loc.name,locatie_id:loc.id,van_locatie_id:parseInt(sid),datum:prevD,tijd:'08:30',open_dagen:openDagen,materiaal:mat,opmerking:'Herlevering vast materiaal week '+km.week+' — '+loc.name+' (na pauze)'});
          });
        }
        if(!heeftOpvolger){
          // Laatste week van deze aaneensluitende reeks (kan een gap-week zijn): thema volgt
          // zijn eigen gap-gedrag (via stockage) — niet aanraken, blijft ongewijzigd.
          const nextD=nextWorkday(openDagen[openDagen.length-1]);
          Object.entries(byStockage(themaMatRegels)).forEach(([sid,mat])=>{
            const sLoc=locs.find(l=>l.id==sid);
            voorstellen.push({type:'ophaling',kampmoment_id:km.id,week:km.week,locatie:loc.name,locatie_id:loc.id,naar_locatie_id:parseInt(sid),datum:nextD,tijd:'17:00',open_dagen:openDagen,materiaal:mat,opmerking:'Ophaling thema week '+km.week+' — '+loc.name+' ('+thNamen+(sLoc?', naar '+sLoc.name:'')+')'});
          });
        }
      });
    });

    // ── DIRECT THEMA-TRANSFER (A → B aaneensluitend) ──
    const allThemaIds=[...new Set(kts.map(kt=>kt.thema_id))];
    allThemaIds.forEach(thId=>{
      const kmsMetThema=kts.filter(kt=>kt.thema_id===thId)
        .map(kt=>kms.find(km=>km.id===kt.kampmoment_id))
        .filter(km=>km && km.type!=='themadag')
        .sort((a,b)=>a.week-b.week);
      for(let i=0;i<kmsMetThema.length-1;i++){
        const kmA=kmsMetThema[i],kmB=kmsMetThema[i+1];
        if(kmA.locatie_id===kmB.locatie_id)continue;
        if(kmB.week!==kmA.week+1)continue;
        const locA=locs.find(l=>l.id===kmA.locatie_id);
        const locB=locs.find(l=>l.id===kmB.locatie_id);
        if(!locA||!locB)continue;
        const openA=getOpenDagen(kmA);
        const openB=getOpenDagen(kmB);
        if(!openA.length||!openB.length)continue;
        const th=themas.find(t=>t.id===thId);
        const thMat=[
          ...themaBakken.filter(b=>b.thema_id===thId).map(b=>({naam:'Bak '+b.naam+(b.code?' ('+b.code+')':''),qty:1,soort:'thema',bak_id:b.bak_id})),
          ...themaAttrRegels.filter(a=>a.thema_id===thId).map(a=>({naam:'Attribuut '+a.naam+(a.code?' ('+a.code+')':''),qty:1,soort:'attribuut',attribuut_id:a.attr_id}))
        ];
        if(!thMat.length)continue;
        voorstellen.push({type:'levering',kampmoment_id:kmB.id,week:kmB.week,locatie:locB.name,locatie_id:locB.id,van_locatie_id:locA.id,datum:nextWorkday(openA[openA.length-1]),tijd:'10:00',materiaal:thMat,opmerking:'Thema-transfer: '+(th?.name||'?')+' van '+locA.name+' → '+locB.name});
      }
    });

    // ── SPORT SETS TRANSPORT ──
    // Gebruik per-item stockage_locatie_id; fallback naar sportStockageId
    const allSportSets=all('SELECT ss.*,si.name as item_naam,si.stockage_locatie_id as item_stockage_id FROM sport_sets ss LEFT JOIN sport_items si ON si.id=ss.item_id');
    const allSportPlanning=all('SELECT * FROM sport_planning ORDER BY set_id,week');

    allSportSets.forEach(set=>{
      const setPlanning=allSportPlanning.filter(p=>p.set_id===set.id).sort((a,b)=>a.week-b.week);
      if(!setPlanning.length)return;
      const homeStockageId=set.item_stockage_id||sportStockageId;
      if(!homeStockageId)return;
      const setNaam=(set.item_naam||'?')+' — '+set.label;

      // Levering vanuit home-stockage voor eerste geplande week
      const fp=setPlanning[0];
      const fKm=kms.find(km=>km.locatie_id===fp.locatie_id&&km.week===fp.week);
      if(fKm){const fo=getOpenDagen(fKm);if(fo.length){const fLoc=locs.find(l=>l.id===fp.locatie_id);voorstellen.push({type:'levering',locatie:fLoc?.name||'?',locatie_id:fp.locatie_id,van_locatie_id:homeStockageId,datum:prevWorkday(fo[0]),tijd:'08:30',materiaal:[{naam:setNaam,qty:1,soort:'sport'}],opmerking:'Sport levering: '+setNaam+' → '+(fLoc?.name||'?')+' (week '+fp.week+')'});}}

      // Transities tussen opeenvolgende geplande weken
      for(let i=0;i<setPlanning.length-1;i++){
        const pA=setPlanning[i],pB=setPlanning[i+1];
        if(pA.locatie_id===pB.locatie_id)continue; // zelfde locatie → geen transport
        const kmA=kms.find(km=>km.locatie_id===pA.locatie_id&&km.week===pA.week);
        if(!kmA)continue;
        const openA=getOpenDagen(kmA);if(!openA.length)continue;
        const locA=locs.find(l=>l.id===pA.locatie_id);
        const locB=locs.find(l=>l.id===pB.locatie_id);
        const transferDatum=nextWorkday(openA[openA.length-1]);

        if(pB.week===pA.week+1){
          // Aaneensluitend → directe transfer A→B (geen stockage tussenin)
          voorstellen.push({type:'levering',locatie:locB?.name||'?',locatie_id:pB.locatie_id,van_locatie_id:pA.locatie_id,datum:transferDatum,tijd:'10:00',materiaal:[{naam:setNaam,qty:1,soort:'sport'}],opmerking:'Sport direct: '+setNaam+' van '+(locA?.name||'?')+' → '+(locB?.name||'?')});
        } else {
          // Gap → via home-stockage: ophaling na week A, levering voor week B
          voorstellen.push({type:'ophaling',locatie:locA?.name||'?',locatie_id:pA.locatie_id,naar_locatie_id:homeStockageId,datum:transferDatum,tijd:'17:00',materiaal:[{naam:setNaam,qty:1,soort:'sport'}],opmerking:'Sport ophaling: '+setNaam+' ← '+(locA?.name||'?')});
          const kmB=kms.find(km=>km.locatie_id===pB.locatie_id&&km.week===pB.week);
          if(kmB){const openB=getOpenDagen(kmB);if(openB.length){voorstellen.push({type:'levering',locatie:locB?.name||'?',locatie_id:pB.locatie_id,van_locatie_id:homeStockageId,datum:prevWorkday(openB[0]),tijd:'08:30',materiaal:[{naam:setNaam,qty:1,soort:'sport'}],opmerking:'Sport levering: '+setNaam+' → '+(locB?.name||'?')+' (week '+pB.week+')'});}}
        }
      }

      // Ophaling naar home-stockage na laatste geplande week
      const lp=setPlanning[setPlanning.length-1];
      const lKm=kms.find(km=>km.locatie_id===lp.locatie_id&&km.week===lp.week);
      if(lKm){const lo=getOpenDagen(lKm);if(lo.length){const lLoc=locs.find(l=>l.id===lp.locatie_id);voorstellen.push({type:'ophaling',locatie:lLoc?.name||'?',locatie_id:lp.locatie_id,naar_locatie_id:homeStockageId,datum:nextWorkday(lo[lo.length-1]),tijd:'17:00',materiaal:[{naam:setNaam,qty:1,soort:'sport'}],opmerking:'Sport ophaling (einde): '+setNaam+' ← '+(lLoc?.name||'?')});}}
    });

    // Bundeling (Maxim 2026-08-02): voorstellen met hetzelfde type, dezelfde datum en dezelfde
    // route (locatie + van/naar) worden één voorstel met meerdere regels — anders krijg je bv.
    // 8 losse "Sport ophaling"-kaarten voor 2 locaties op dezelfde dag.
    const _gebundeld={};
    voorstellen.forEach(p=>{
      const sleutel=[p.type,p.datum,p.locatie_id||'',p.van_locatie_id||'',p.naar_locatie_id||''].join('|');
      if(!_gebundeld[sleutel]){ _gebundeld[sleutel]={...p,materiaal:[...(p.materiaal||[])],_bundelAantal:1,_bundelOpmerkingen:[p.opmerking]}; }
      else {
        const g=_gebundeld[sleutel];
        g.materiaal.push(...(p.materiaal||[]));
        g._bundelAantal++;
        g._bundelOpmerkingen.push(p.opmerking);
        if(p.tijd<g.tijd)g.tijd=p.tijd; // vroegste tijdstip wint
        if(!g.kampmoment_id&&p.kampmoment_id)g.kampmoment_id=p.kampmoment_id;
      }
    });
    const gebundeldeVoorstellen=Object.values(_gebundeld).map(g=>{
      if(g._bundelAantal>1){
        const alleSport=g._bundelOpmerkingen.every(o=>(o||'').startsWith('Sport '));
        g.opmerking=alleSport
          ? `Sport ${g.type==='ophaling'?'ophaling':'levering'} — ${g._bundelAantal} sets — ${g.locatie}`
          : `${g._bundelOpmerkingen[0]} (+${g._bundelAantal-1} gebundeld)`;
      }
      delete g._bundelAantal; delete g._bundelOpmerkingen;
      return g;
    });
    gebundeldeVoorstellen.sort((a,b)=>a.datum.localeCompare(b.datum)||a.tijd.localeCompare(b.tijd));
    res.json(gebundeldeVoorstellen);
  });
  // Bulk: ontkoppel van rit (zet rit_id=NULL)
  app.post('/api/transport-taken/bulk-ontkoppel',(req,res)=>{
    const{ids}=req.body;
    if(!Array.isArray(ids)||!ids.length)return res.status(400).json({error:'ids vereist'});
    ids.forEach(id=>run("UPDATE transport_taken SET rit_id=NULL,datum='',wie='' WHERE id=? AND COALESCE((SELECT spoed_kind FROM transport_taken WHERE id=?),'') != '1'",[id,id]));
    saveDb();res.json({ok:true,count:ids.length});
  });
  // Bulk: verplaats naar andere rit
  app.post('/api/transport-taken/bulk-move',(req,res)=>{
    const{ids,rit_id}=req.body;
    if(!Array.isArray(ids)||!ids.length)return res.status(400).json({error:'ids vereist'});
    const rit=rit_id?get('SELECT * FROM transport_ritten WHERE id=?',[rit_id]):null;
    if(rit_id&&!rit)return res.status(404).json({error:'Rit niet gevonden'});
    ids.forEach(id=>{
      run('UPDATE transport_taken SET rit_id=?,datum=?,wie=? WHERE id=?',
        [rit_id||null,rit?rit.datum:'',rit?rit.chauffeur:'',id]);
    });
    saveDb();res.json({ok:true,count:ids.length});
  });
  // Bulk: verwijder
  app.post('/api/transport-taken/bulk-delete',(req,res)=>{
    const{ids}=req.body;
    if(!Array.isArray(ids)||!ids.length)return res.status(400).json({error:'ids vereist'});
    ids.forEach(id=>{run('DELETE FROM transport_regels WHERE taak_id=?',[id]);run('DELETE FROM transport_taken WHERE id=?',[id]);});
    saveDb();res.json({ok:true});
  });
  // Splitsen (Maxim 2026-08-02): een deel van de regels (bakken/attributen) van een taak
  // verhuist naar een NIEUWE taak op een andere dag — bv. donderdag al de helft ophalen,
  // vrijdag de rest. Zo wordt het werk over meerdere dagen gespreid.
  app.post('/api/transport-taken/:id/splits',(req,res)=>{
    const{regel_ids,datum,tijd}=req.body;
    const taak=get('SELECT * FROM transport_taken WHERE id=?',[req.params.id]);
    if(!taak)return res.status(404).json({error:'Taak niet gevonden'});
    if(!Array.isArray(regel_ids)||!regel_ids.length)return res.status(400).json({error:'Kies minstens één regel om af te splitsen'});
    const alleRegels=all('SELECT * FROM transport_regels WHERE taak_id=?',[taak.id]);
    const teVerhuizen=alleRegels.filter(r=>regel_ids.includes(r.id));
    if(!teVerhuizen.length)return res.status(400).json({error:'Geen van de gekozen regels hoort bij deze taak'});
    if(teVerhuizen.length===alleRegels.length)return res.status(400).json({error:'Je kan niet álle regels afsplitsen — dan verplaats je beter de hele taak'});
    const nieuwId=ins(`INSERT INTO transport_taken (type,datum,tijd,van_locatie_id,naar_locatie_id,opmerking,wie,kampmoment_id,status,created_at,rit_id,week)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [taak.type,datum||'',tijd||taak.tijd||'09:00',taak.van_locatie_id,taak.naar_locatie_id,
       (taak.opmerking||'')+' — afgesplitst deel',taak.wie||'',taak.kampmoment_id,'gepland',now(),null,taak.week]);
    teVerhuizen.forEach(r=>run('UPDATE transport_regels SET taak_id=? WHERE id=?',[nieuwId,r.id]));
    saveDb();
    logAct('transport','gesplitst',`Taak #${taak.id}: ${teVerhuizen.length} regel(s) afgesplitst naar taak #${nieuwId}${datum?' ('+datum+')':''}`,taak.naar_locatie_id||taak.van_locatie_id,null);
    res.json({ok:true,nieuwe_taak_id:nieuwId,verplaatst:teVerhuizen.length});
  });
  app.post('/api/transport-taken',(req,res)=>{const{type,datum,tijd,van_locatie_id,naar_locatie_id,opmerking,wie,kampmoment_id,regels,rit_id,week}=req.body;const id=ins('INSERT INTO transport_taken (type,datum,tijd,van_locatie_id,naar_locatie_id,opmerking,wie,kampmoment_id,status,created_at,rit_id,week) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',[type,datum||'',tijd||'09:00',van_locatie_id||null,naar_locatie_id||null,opmerking||'',wie||'',kampmoment_id||null,'gepland',now(),rit_id||null,week||null]);if(regels&&regels.length)regels.forEach(r=>ins('INSERT INTO transport_regels (taak_id,naam,qty,soort,item_type_id,bak_id,attribuut_id) VALUES (?,?,?,?,?,?,?)',[id,r.naam,r.qty||1,r.soort||'andere',resolveItemTypeId(r.naam),r.bak_id||null,r.attribuut_id||null]));const taak=get('SELECT * FROM transport_taken WHERE id=?',[id]);const tr=all('SELECT * FROM transport_regels WHERE taak_id=?',[id]);res.json({...taak,regels:tr});});
  app.put('/api/transport-taken/:id',(req,res)=>{const{type,datum,tijd,van_locatie_id,naar_locatie_id,opmerking,wie,status}=req.body;const bestaand=get('SELECT * FROM transport_taken WHERE id=?',[req.params.id]);if(!bestaand)return res.status(404).json({error:'Transport niet gevonden'});const nieuweDatum=bestaand.rit_id?bestaand.datum:(datum!==undefined?datum||'':bestaand.datum||'');const nieuweWie=bestaand.rit_id?bestaand.wie:(wie!==undefined?wie||'':bestaand.wie||'');run('UPDATE transport_taken SET type=?,datum=?,tijd=?,van_locatie_id=?,naar_locatie_id=?,opmerking=?,wie=?,status=? WHERE id=?',[type,nieuweDatum,tijd||'09:00',van_locatie_id||null,naar_locatie_id||null,opmerking||'',nieuweWie,status||'gepland',req.params.id]);res.json(get('SELECT * FROM transport_taken WHERE id=?',[req.params.id]));});
  app.delete('/api/transport-taken/:id',(req,res)=>{const t=get('SELECT rit_id FROM transport_taken WHERE id=?',[req.params.id]);run('DELETE FROM transport_regels WHERE taak_id=?',[req.params.id]);run('DELETE FROM transport_taken WHERE id=?',[req.params.id]);if(t&&t.rit_id){const rest=get('SELECT COUNT(*) as n FROM transport_taken WHERE rit_id=?',[t.rit_id]);if(rest&&rest.n===0)run('DELETE FROM transport_ritten WHERE id=?',[t.rit_id]);}res.json({ok:true});});
  app.put('/api/transport-taken/:id/status',(req,res)=>{
    const oudStatus=get('SELECT status FROM transport_taken WHERE id=?',[req.params.id])?.status;
    run('UPDATE transport_taken SET status=? WHERE id=?',[req.body.status,req.params.id]);
    // Als status → "gedaan": spoed-voorraadeffect toepassen als dat nog niet gebeurd is
    if(req.body.status==='gedaan'){
      const taak=get('SELECT * FROM transport_taken WHERE id=?',[req.params.id]);
      if(taak)_pasSpoedEffectToe(taak);
      // Stock-deplétie: trek verbruiksartikelen af bij levering
      if(taak&&taak.type==='levering'&&taak.kampmoment_id&&oudStatus!=='gedaan'){
        const kts=all('SELECT thema_id FROM kampmoment_themas WHERE kampmoment_id=?',[taak.kampmoment_id]);
        kts.forEach(kt=>{
          const bakken=all('SELECT id FROM thema_bakken WHERE thema_id=?',[kt.thema_id]);
          bakken.forEach(b=>{
            const items=all('SELECT * FROM bak_items WHERE bak_id=? AND verbruik=1',[b.id]);
            items.forEach(item=>{
              const nieuw=Math.max(0,(item.qty_stock||0)-(item.qty_per_gebruik||1));
              run('UPDATE bak_items SET qty_stock=? WHERE id=?',[nieuw,item.id]);
            });
          });
        });
        saveDb();
      }
      // S2.4: bakken/attributen in deze taak (via transport_regels.bak_id/attribuut_id) volgen
      // automatisch mee naar naar_locatie_id; status 'thuis' als dat hun thuislocatie is.
      if(taak&&taak.naar_locatie_id&&oudStatus!=='gedaan'){
        const regels=all('SELECT bak_id,attribuut_id FROM transport_regels WHERE taak_id=?',[req.params.id]);
        const ritRow=taak.rit_id?get('SELECT * FROM transport_ritten WHERE id=?',[taak.rit_id]):null;
        const chauffeurNaam=(ritRow&&ritRow.chauffeur)||taak.wie||'onbekende chauffeur';
        const loc=get('SELECT name FROM locaties WHERE id=?',[taak.naar_locatie_id]);
        regels.forEach(r=>{
          if(r.bak_id){
            const b=get('SELECT * FROM bakken WHERE id=?',[r.bak_id]);
            if(b){const st=taak.naar_locatie_id==b.thuislocatie_id?'thuis':'op_locatie';
              run('UPDATE bakken SET huidige_locatie_id=?,status=? WHERE id=?',[taak.naar_locatie_id,st,r.bak_id]);
              logAct('bak','gelost',`Bak "${b.naam}" (${b.code||'-'}) gelost op ${loc?.name||'?'} (taak #${taak.id}) door ${chauffeurNaam}`,taak.naar_locatie_id,loc?.name);}
          }
          if(r.attribuut_id){
            const a=get('SELECT * FROM attributen WHERE id=?',[r.attribuut_id]);
            if(a){const st=taak.naar_locatie_id==a.thuislocatie_id?'thuis':'op_locatie';
              run('UPDATE attributen SET huidige_locatie_id=?,status=? WHERE id=?',[taak.naar_locatie_id,st,r.attribuut_id]);
              logAct('attribuut','gelost',`Attribuut "${a.naam}" (${a.code||'-'}) gelost op ${loc?.name||'?'} (taak #${taak.id}) door ${chauffeurNaam}`,taak.naar_locatie_id,loc?.name);}
          }
        });
      }
    }
    res.json(get('SELECT * FROM transport_taken WHERE id=?',[req.params.id]));
  });
  app.put('/api/transport-taken/:id/move',(req,res)=>{const{datum,tijd}=req.body;const t=get('SELECT * FROM transport_taken WHERE id=?',[req.params.id]);if(!t)return res.status(404).json({error:'Transport niet gevonden'});
    if(t.rit_id){
      // Verplaats de hele rit (datum + cascade naar alle leden)
      if(datum){run('UPDATE transport_ritten SET datum=? WHERE id=?',[datum,t.rit_id]);run('UPDATE transport_taken SET datum=? WHERE rit_id=?',[datum,t.rit_id]);}
      if(tijd)run('UPDATE transport_taken SET tijd=? WHERE id=?',[tijd,req.params.id]);
    } else {
      // Losse taak (nood) op een dag gesleept → maak een 1-op-1 rit
      const d=datum||t.datum||'';
      if(d){const nid=ins('INSERT INTO transport_ritten (datum,chauffeur,opmerking,status,created_at) VALUES (?,?,?,?,?)',[d,t.wie||'','','gepland',now()]);run('UPDATE transport_taken SET rit_id=?,datum=?,tijd=? WHERE id=?',[nid,d,tijd||t.tijd,req.params.id]);}
      else run('UPDATE transport_taken SET tijd=? WHERE id=?',[tijd||t.tijd,req.params.id]);
    }
    res.json(get('SELECT * FROM transport_taken WHERE id=?',[req.params.id]));});
  app.post('/api/transport-regels',(req,res)=>{const{taak_id,naam,qty,soort}=req.body;const item_type_id=resolveItemTypeId(naam);const id=ins('INSERT INTO transport_regels (taak_id,naam,qty,soort,item_type_id) VALUES (?,?,?,?,?)',[taak_id,naam,qty||1,soort||'andere',item_type_id]);res.json(get('SELECT * FROM transport_regels WHERE id=?',[id]));});
  app.delete('/api/transport-regels/:id',(req,res)=>{run('DELETE FROM transport_regels WHERE id=?',[req.params.id]);res.json({ok:true});});

  // ── TRANSPORT RITTEN ──
  function _bakkenVoorTaak(taak){
    // Tel het totaal aantal bakken voor een transport_taken op basis van gekoppelde thema's
    if(!taak.kampmoment_id) return 0;
    const kts=all('SELECT thema_id FROM kampmoment_themas WHERE kampmoment_id=?',[taak.kampmoment_id]);
    let tot=0;
    kts.forEach(kt=>{
      tot+=get('SELECT COUNT(*) as n FROM thema_bakken WHERE thema_id=?',[kt.thema_id])?.n||0;
    });
    return tot;
  }
  function _ritMetTaken(rit){
    if(!rit) return null;
    const taken=all('SELECT * FROM transport_taken WHERE rit_id=? ORDER BY tijd',[rit.id]);
    const regels=all('SELECT * FROM transport_regels');
    const takenMet=taken.map(t=>({...t, regels: regels.filter(r=>r.taak_id===t.id)}));
    const bakken_totaal=takenMet.reduce((s,t)=>s+_bakkenVoorTaak(t),0);
    return {...rit, taken: takenMet, bakken_totaal};
  }
  app.get('/api/ritten',(req,res)=>{
    const ritten=all('SELECT * FROM transport_ritten ORDER BY datum');
    res.json(ritten.map(_ritMetTaken));
  });
  app.post('/api/ritten',(req,res)=>{
    let {datum,chauffeur,personeel_id,opmerking,status,taak_ids}=req.body;
    if(!datum) return res.status(400).json({error:'Datum is verplicht'});
    // S3.1: UI kiest chauffeur voortaan uit personeel (rol='chauffeur'). We slaan personeel_id
    // op ÉN blijven de naam in het bestaande vrije-tekstveld chauffeur zetten, zodat alles wat
    // de naam toont (rit-kaartjes, /rit/:token, filters) blijft werken zonder aan te passen.
    if(personeel_id&&!chauffeur){const p=get('SELECT naam FROM personeel WHERE id=?',[personeel_id]);if(p)chauffeur=p.naam;}
    const id=ins('INSERT INTO transport_ritten (datum,chauffeur,personeel_id,opmerking,status,created_at) VALUES (?,?,?,?,?,?)',
      [datum,chauffeur||'',personeel_id||null,opmerking||'',status||'gepland',now()]);
    if(Array.isArray(taak_ids)) taak_ids.forEach(tid=>{
      run('UPDATE transport_taken SET rit_id=?,datum=?,wie=? WHERE id=?',[id,datum,chauffeur||'',tid]);
    });
    res.json(_ritMetTaken(get('SELECT * FROM transport_ritten WHERE id=?',[id])));
  });
  app.put('/api/ritten/:id',(req,res)=>{
    let {datum,chauffeur,personeel_id,opmerking,status,voertuig}=req.body;
    const rit=get('SELECT * FROM transport_ritten WHERE id=?',[req.params.id]);
    if(!rit) return res.status(404).json({error:'Rit niet gevonden'});
    if(personeel_id&&!chauffeur){const p=get('SELECT naam FROM personeel WHERE id=?',[personeel_id]);if(p)chauffeur=p.naam;}
    run('UPDATE transport_ritten SET datum=?,chauffeur=?,personeel_id=?,opmerking=?,status=?,voertuig=? WHERE id=?',
      [datum||rit.datum,
       chauffeur!==undefined?chauffeur:rit.chauffeur,
       personeel_id!==undefined?(personeel_id||null):rit.personeel_id,
       opmerking!==undefined?opmerking:rit.opmerking,
       status||rit.status,
       voertuig!==undefined?voertuig:(rit.voertuig||''),
       req.params.id]);
    if(datum&&datum!==rit.datum) run('UPDATE transport_taken SET datum=? WHERE rit_id=?',[datum,req.params.id]);
    if(chauffeur!==undefined&&chauffeur!==rit.chauffeur) run('UPDATE transport_taken SET wie=? WHERE rit_id=?',[chauffeur,req.params.id]);
    res.json(_ritMetTaken(get('SELECT * FROM transport_ritten WHERE id=?',[req.params.id])));
  });
  app.delete('/api/ritten/:id',(req,res)=>{
    const leden=all('SELECT * FROM transport_taken WHERE rit_id=?',[req.params.id]);
    leden.forEach(t=>{
      if(t.spoed_kind){
        // Spoedtransport mag geen datum verliezen → eigen verse rit
        const nid=ins('INSERT INTO transport_ritten (datum,chauffeur,opmerking,status,created_at) VALUES (?,?,?,?,?)',
          [t.datum,t.wie||'','Spoedtransport','gepland',now()]);
        run('UPDATE transport_taken SET rit_id=? WHERE id=?',[nid,t.id]);
      } else {
        run("UPDATE transport_taken SET rit_id=NULL,datum='',wie='' WHERE id=?",[t.id]);
      }
    });
    run('DELETE FROM transport_ritten WHERE id=?',[req.params.id]);
    res.json({ok:true});
  });
  // ── VOORRAAD NAKIJKEN ──
  app.get('/api/voorraad/nakijken',(req,res)=>{
    const items=all(`
      SELECT bi.*,
        tb.label AS bak_label, tb.code AS bak_code, tb.leeftijdsgroep AS bak_lg,
        t.id AS thema_id, t.name AS thema_naam, t.color AS thema_color,
        (SELECT tijdstip FROM bak_nakijk_log WHERE bak_id=bi.bak_id ORDER BY tijdstip DESC LIMIT 1) AS laatste_nakijk
      FROM bak_items bi
      JOIN thema_bakken tb ON bi.bak_id=tb.id
      JOIN themas t ON tb.thema_id=t.id
      WHERE bi.verbruik=1
      ORDER BY t.name, tb.volgorde, tb.id, bi.id
    `);
    res.json(items);
  });

  // ── VOERTUIGTYPES ──
  app.get('/api/voertuig-types',(req,res)=>res.json(all('SELECT * FROM voertuig_types ORDER BY capaciteit_bakken')));
  app.post('/api/voertuig-types',(req,res)=>{
    const{naam,capaciteit_bakken,capaciteit_label}=req.body;
    if(!naam)return res.status(400).json({error:'Naam is verplicht'});
    const id=ins('INSERT OR IGNORE INTO voertuig_types (naam,capaciteit_bakken,capaciteit_label) VALUES (?,?,?)',
      [naam,capaciteit_bakken||0,capaciteit_label||naam]);
    res.json(get('SELECT * FROM voertuig_types WHERE naam=?',[naam]));
  });
  app.put('/api/voertuig-types/:id',(req,res)=>{
    const{naam,capaciteit_bakken,capaciteit_label}=req.body;
    const vt=get('SELECT * FROM voertuig_types WHERE id=?',[req.params.id]);
    if(!vt)return res.status(404).json({error:'Niet gevonden'});
    run('UPDATE voertuig_types SET naam=?,capaciteit_bakken=?,capaciteit_label=? WHERE id=?',
      [naam||vt.naam,capaciteit_bakken!=null?capaciteit_bakken:vt.capaciteit_bakken,
       capaciteit_label||vt.capaciteit_label,req.params.id]);
    res.json(get('SELECT * FROM voertuig_types WHERE id=?',[req.params.id]));
  });
  app.delete('/api/voertuig-types/:id',(req,res)=>{run('DELETE FROM voertuig_types WHERE id=?',[req.params.id]);res.json({ok:true});});

  // ── THEMA BAKKEN (S2.1: uniforme bakken-tabel, deelbaar via thema_bak) ──
  function _rozenwegId(){
    const r=get("SELECT id FROM locaties WHERE name='Rozenweg' AND (parent_id IS NULL OR parent_id=0)")
      || get("SELECT id FROM locaties WHERE type='stockage' AND (parent_id IS NULL OR parent_id=0) ORDER BY id LIMIT 1");
    return r?r.id:null;
  }
  function _bakkenVanThema(thema_id){
    const bakken=all(`SELECT b.* FROM bakken b JOIN thema_bak tb ON tb.bak_id=b.id
      WHERE tb.thema_id=? AND b.soort='thema' ORDER BY b.volgorde,b.id`,[thema_id]);
    return bakken.map(b=>{
      const andereThemas=all(`SELECT t.id,t.name FROM thema_bak tb2 JOIN themas t ON t.id=tb2.thema_id
        WHERE tb2.bak_id=? AND tb2.thema_id!=?`,[b.id,thema_id]);
      return {...b,label:b.naam,items:all('SELECT * FROM bak_items WHERE bak_id=? ORDER BY verbruik,id',[b.id]),
        log:all('SELECT * FROM bak_nakijk_log WHERE bak_id=? ORDER BY tijdstip DESC LIMIT 5',[b.id]),
        gedeeld_met:andereThemas};
    });
  }
  app.get('/api/themas/:id/bakken',(req,res)=>res.json(_bakkenVanThema(req.params.id)));
  // Alle bakken van alle themas in één call (voor Themabakken-tab)
  app.get('/api/alle-bakken',(req,res)=>{
    const themas=all('SELECT * FROM themas ORDER BY name');
    res.json(themas.map(t=>({...t,bakken:_bakkenVanThema(t.id),attributen:_attributenVanThema(t.id)})));
  });
  // POST: koppel een bestaande bak (bak_id) OF maak een nieuwe bak+koppel (label/code/...)
  app.post('/api/themas/:id/bakken',(req,res)=>{
    const{bak_id,label,code,leeftijdsgroep,volgorde}=req.body;
    let id=bak_id;
    if(!id){
      const dubbeleCode=code&&get('SELECT id FROM bakken WHERE code=? AND code!=\'\'',[code]);
      id=ins('INSERT INTO bakken (naam,code,soort,thuislocatie_id,huidige_locatie_id,status,volgorde) VALUES (?,?,?,?,?,?,?)',
        [label||'',code||'','thema',_rozenwegId(),_rozenwegId(),'thuis',volgorde||0]);
      if(dubbeleCode) console.warn(`  Waarschuwing: code "${code}" bestaat al op een andere bak/attribuut (niet-blokkerend)`);
    }
    const bestaat=get('SELECT id FROM thema_bak WHERE thema_id=? AND bak_id=?',[req.params.id,id]);
    if(!bestaat) ins('INSERT INTO thema_bak (thema_id,bak_id) VALUES (?,?)',[req.params.id,id]);
    const b=get('SELECT * FROM bakken WHERE id=?',[id]);
    res.json({...b,label:b.naam,items:[],log:[]});
  });
  // Ontkoppel een bak van een thema (bak zelf blijft bestaan, kan aan andere thema's hangen)
  app.delete('/api/themas/:themaId/bakken/:bakId',(req,res)=>{
    run('DELETE FROM thema_bak WHERE thema_id=? AND bak_id=?',[req.params.themaId,req.params.bakId]);
    res.json({ok:true});
  });
  app.put('/api/bakken/:id',(req,res)=>{
    const{label,naam,code,volgorde,vast_type,thuislocatie_id,status}=req.body;
    const cur=get('SELECT * FROM bakken WHERE id=?',[req.params.id]);
    if(!cur)return res.status(404).json({error:'Bak niet gevonden'});
    const nieuweNaam=(naam??label)??cur.naam;
    run('UPDATE bakken SET naam=?,code=?,volgorde=?,vast_type=?,thuislocatie_id=?,status=? WHERE id=?',
      [nieuweNaam,code??cur.code,volgorde??cur.volgorde,vast_type??cur.vast_type,thuislocatie_id??cur.thuislocatie_id,status??cur.status,req.params.id]);
    const b=get('SELECT * FROM bakken WHERE id=?',[req.params.id]);
    res.json({...b,label:b.naam});
  });
  app.delete('/api/bakken/:id',(req,res)=>{
    run('DELETE FROM bak_items WHERE bak_id=?',[req.params.id]);
    run('DELETE FROM bak_nakijk_log WHERE bak_id=?',[req.params.id]);
    run('DELETE FROM thema_bak WHERE bak_id=?',[req.params.id]);
    run('DELETE FROM bakken WHERE id=?',[req.params.id]);
    res.json({ok:true});
  });
  // Bak-items CRUD
  app.post('/api/bakken/:id/items',(req,res)=>{
    const{naam,qty,verbruik,qty_per_gebruik,eenheid,qty_stock,qty_minimum,notitie}=req.body;
    const item_type_id=resolveItemTypeId(naam);
    const id=ins('INSERT INTO bak_items (bak_id,naam,qty,verbruik,qty_per_gebruik,eenheid,qty_stock,qty_minimum,notitie,item_type_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [req.params.id,naam,qty||1,verbruik?1:0,qty_per_gebruik||1,eenheid||'stuks',qty_stock||0,qty_minimum||0,notitie||'',item_type_id]);
    res.json(get('SELECT * FROM bak_items WHERE id=?',[id]));
  });
  app.put('/api/bak-items/:id',(req,res)=>{
    const{naam,qty,verbruik,qty_per_gebruik,eenheid,qty_stock,qty_minimum,notitie}=req.body;
    const cur=get('SELECT * FROM bak_items WHERE id=?',[req.params.id]);
    if(!cur)return res.status(404).json({error:'Item niet gevonden'});
    const nieuweNaam=naam??cur.naam;
    const item_type_id=nieuweNaam!==cur.naam?resolveItemTypeId(nieuweNaam):cur.item_type_id;
    run('UPDATE bak_items SET naam=?,qty=?,verbruik=?,qty_per_gebruik=?,eenheid=?,qty_stock=?,qty_minimum=?,notitie=?,item_type_id=? WHERE id=?',
      [nieuweNaam,qty??cur.qty,verbruik!==undefined?(verbruik?1:0):cur.verbruik,
       qty_per_gebruik??cur.qty_per_gebruik,eenheid??cur.eenheid,
       qty_stock??cur.qty_stock,qty_minimum??cur.qty_minimum,notitie??cur.notitie,item_type_id,req.params.id]);
    res.json(get('SELECT * FROM bak_items WHERE id=?',[req.params.id]));
  });
  app.delete('/api/bak-items/:id',(req,res)=>{run('DELETE FROM bak_items WHERE id=?',[req.params.id]);res.json({ok:true});});
  // S5.4a: dit veld `id` = bak.id uit de `bakken`-tabel (zelfde als de thema-bakkenlijst
  // /api/themas/:id/bakken teruggeeft) — niet meer de legacy thema_bakken-tabel, die na
  // Migratie 53 niet meer bijgewerkt wordt zodra nieuwe bakken via /api/themas/:id/bakken ontstaan.
  app.get('/api/bakken/:id/items-detail',(req,res)=>{
    const b=get('SELECT * FROM bakken WHERE id=?',[req.params.id]);
    if(!b)return res.status(404).json({error:'Bak niet gevonden'});
    res.json(all('SELECT * FROM bak_items WHERE bak_id=? ORDER BY verbruik,id',[req.params.id]));
  });
  // Nakijk log
  app.post('/api/bakken/:id/nakijk',(req,res)=>{
    const b=get('SELECT * FROM bakken WHERE id=?',[req.params.id]);
    if(!b)return res.status(404).json({error:'Bak niet gevonden'});
    const{wie,resultaat,notitie,stock_updates}=req.body;
    const tid=ins('INSERT INTO bak_nakijk_log (bak_id,tijdstip,wie,resultaat,notitie) VALUES (?,?,?,?,?)',
      [req.params.id,now(),wie||'',resultaat||'ok',notitie||'']);
    // Stock updates: [{item_id, qty_stock}]
    if(Array.isArray(stock_updates)){
      stock_updates.forEach(u=>{
        if(u.item_id!=null&&u.qty_stock!=null)
          run('UPDATE bak_items SET qty_stock=? WHERE id=? AND bak_id=?',[u.qty_stock,u.item_id,req.params.id]);
      });
    }
    saveDb();
    const themaId=get('SELECT thema_id FROM thema_bak WHERE bak_id=? LIMIT 1',[req.params.id])?.thema_id;
    res.json({ok:true,log_id:tid,bakken:themaId?_bakkenVanThema(themaId):[]});
  });

  // ── VERHUIS CHECKS (persistente klaarzet-checklist per rit) ──
  app.get('/api/ritten/:id/checks',(req,res)=>{
    const checks=all('SELECT * FROM verhuis_checks WHERE rit_id=? ORDER BY item_soort,sort_order,id',[req.params.id]);
    const rit=get('SELECT klaarzet_status,klaarzet_door,klaarzet_op,voertuig FROM transport_ritten WHERE id=?',[req.params.id]);
    res.json({checks,klaarzet:rit||{}});
  });
  // Initialiseer checks vanuit de transport_regels van de rit
  app.post('/api/ritten/:id/checks/init',(req,res)=>{
    const rit_id=parseInt(req.params.id);
    const rit=get('SELECT * FROM transport_ritten WHERE id=?',[rit_id]);
    if(!rit)return res.status(404).json({error:'Rit niet gevonden'});
    const taken=all('SELECT * FROM transport_taken WHERE rit_id=?',[rit_id]);
    const alle_regels=[];
    taken.forEach(t=>{
      all('SELECT * FROM transport_regels WHERE taak_id=?',[t.id]).forEach(r=>alle_regels.push({...r,_taak_id:t.id,_taak_opmerking:t.opmerking,_taak_type:t.type}));
    });
    if(!alle_regels.length)return res.status(400).json({error:'Geen materiaalregels gevonden in deze rit'});
    run('DELETE FROM verhuis_checks WHERE rit_id=?',[rit_id]);
    alle_regels.forEach((r,i)=>{
      ins('INSERT INTO verhuis_checks (rit_id,item_naam,item_soort,qty,status,sort_order,item_type_id,bak_id,attribuut_id,taak_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [rit_id,r.naam,r.soort||'andere',r.qty||1,'wacht',i,r.item_type_id||resolveItemTypeId(r.naam),r.bak_id||null,r.attribuut_id||null,r._taak_id||null]);
    });
    const checks=all('SELECT * FROM verhuis_checks WHERE rit_id=? ORDER BY item_soort,sort_order',[rit_id]);
    res.json({ok:true,aangemaakt:checks.length,checks});
  });
  // Update één check (status, notitie, naam)
  app.get('/api/checks/item-historie',(req,res)=>{
    const naam=req.query.naam||'';
    if(!naam)return res.json([]);
    // Zoek alle checks met deze naam, joined met rit en locatie
    const rows=all(`
      SELECT vc.*,
        r.datum AS rit_datum, r.chauffeur, r.voertuig,
        GROUP_CONCAT(DISTINCT l.name) AS locaties
      FROM verhuis_checks vc
      JOIN transport_ritten r ON vc.rit_id=r.id
      LEFT JOIN transport_taken tt ON tt.rit_id=r.id
      LEFT JOIN locaties l ON (tt.van_locatie_id=l.id OR tt.naar_locatie_id=l.id)
      WHERE LOWER(vc.item_naam)=LOWER(?)
      GROUP BY vc.id
      ORDER BY r.datum DESC, vc.id DESC
      LIMIT 50
    `,[naam]);
    res.json(rows);
  });
  app.put('/api/checks/:id',(req,res)=>{
    const cur=get('SELECT * FROM verhuis_checks WHERE id=?',[req.params.id]);
    if(!cur)return res.status(404).json({error:'Check niet gevonden'});
    const status=req.body.status!==undefined?req.body.status:cur.status;
    const notitie=req.body.notitie!==undefined?req.body.notitie:cur.notitie;
    const door=req.body.aangevinkt_door!==undefined?req.body.aangevinkt_door:cur.aangevinkt_door;
    const op=(status!==cur.status)?now():cur.aangevinkt_op;
    run('UPDATE verhuis_checks SET status=?,notitie=?,aangevinkt_door=?,aangevinkt_op=? WHERE id=?',[status,notitie,door,op,req.params.id]);
    res.json(get('SELECT * FROM verhuis_checks WHERE id=?',[req.params.id]));
  });
  // Markeer rit als klaargezet
  app.post('/api/ritten/:id/klaarzet',(req,res)=>{
    const{naam}=req.body;
    if(!naam)return res.status(400).json({error:'Naam is verplicht'});
    const tijdstip=now();
    run('UPDATE transport_ritten SET klaarzet_status=?,klaarzet_door=?,klaarzet_op=? WHERE id=?',['klaar',naam,tijdstip,req.params.id]);
    res.json({ok:true,klaarzet_door:naam,klaarzet_op:tijdstip});
  });

  // ── S3.6: chauffeurspagina interactief — twee vink-fases per bak/attribuut ──
  // Werkt UITSLUITEND op het rit-token (publiek pad, geen sessietoken), en enkel op checks
  // die bij die specifieke rit horen — zie de auth-poort-uitzondering /api/rit-token/.
  function _pasBakAttribuutStatusToe(regels, veld, rit){
    // veld: 'onderweg' bij volledig geladen, of {naar_locatie_id} bij volledig gelost
    // S5.3: elke statuswijziging via transport wordt ook naar activiteiten_log geschreven,
    // zodat /api/waar-is de volledige reis toont (niet enkel handmatige verplaatsingen).
    const chauffeur=(rit&&rit.chauffeur)||'onbekende chauffeur';
    const ritNr=rit?rit.id:'?';
    regels.forEach(c=>{
      if(c.bak_id){
        if(veld==='onderweg'){
          run("UPDATE bakken SET status='onderweg' WHERE id=?",[c.bak_id]);
          const b=get('SELECT * FROM bakken WHERE id=?',[c.bak_id]);
          if(b)logAct('bak','geladen',`Bak "${b.naam}" (${b.code||'-'}) geladen voor rit #${ritNr} door ${chauffeur}`,null,null);
        }else{
          const b=get('SELECT * FROM bakken WHERE id=?',[c.bak_id]);
          if(b){const st=veld.naar_locatie_id==b.thuislocatie_id?'thuis':'op_locatie';
            run('UPDATE bakken SET huidige_locatie_id=?,status=? WHERE id=?',[veld.naar_locatie_id,st,c.bak_id]);
            const loc=get('SELECT name FROM locaties WHERE id=?',[veld.naar_locatie_id]);
            logAct('bak','gelost',`Bak "${b.naam}" (${b.code||'-'}) gelost op ${loc?.name||'?'} (rit #${ritNr}) door ${chauffeur}`,veld.naar_locatie_id,loc?.name);}
        }
      }
      if(c.attribuut_id){
        if(veld==='onderweg'){
          run("UPDATE attributen SET status='onderweg' WHERE id=?",[c.attribuut_id]);
          const a=get('SELECT * FROM attributen WHERE id=?',[c.attribuut_id]);
          if(a)logAct('attribuut','geladen',`Attribuut "${a.naam}" (${a.code||'-'}) geladen voor rit #${ritNr} door ${chauffeur}`,null,null);
        }else{
          const a=get('SELECT * FROM attributen WHERE id=?',[c.attribuut_id]);
          if(a){const st=veld.naar_locatie_id==a.thuislocatie_id?'thuis':'op_locatie';
            run('UPDATE attributen SET huidige_locatie_id=?,status=? WHERE id=?',[veld.naar_locatie_id,st,c.attribuut_id]);
            const loc=get('SELECT name FROM locaties WHERE id=?',[veld.naar_locatie_id]);
            logAct('attribuut','gelost',`Attribuut "${a.naam}" (${a.code||'-'}) gelost op ${loc?.name||'?'} (rit #${ritNr}) door ${chauffeur}`,veld.naar_locatie_id,loc?.name);}
        }
      }
    });
  }
  app.post('/api/rit-token/:token/checks/:checkId/laden',(req,res)=>{
    const rit=get('SELECT * FROM transport_ritten WHERE rit_token=?',[req.params.token]);
    if(!rit)return res.status(403).json({error:'Ongeldig of verlopen token'});
    const check=get('SELECT * FROM verhuis_checks WHERE id=?',[req.params.checkId]);
    if(!check||check.rit_id!==rit.id)return res.status(403).json({error:'Deze regel hoort niet bij deze rit'});
    const nieuw=check.geladen?0:1;
    run('UPDATE verhuis_checks SET geladen=?,geladen_door=?,geladen_op=? WHERE id=?',
      [nieuw,nieuw?(rit.chauffeur||''):'',nieuw?now():'',check.id]);
    if(check.taak_id){
      const groep=all('SELECT * FROM verhuis_checks WHERE taak_id=?',[check.taak_id]);
      const alleGeladen=groep.length>0 && groep.every(c=>c.id===check.id?nieuw:c.geladen);
      if(alleGeladen)_pasBakAttribuutStatusToe(groep,'onderweg',rit);
    }
    saveDb();
    res.json(get('SELECT * FROM verhuis_checks WHERE id=?',[check.id]));
  });
  app.post('/api/rit-token/:token/checks/:checkId/lossen',(req,res)=>{
    const rit=get('SELECT * FROM transport_ritten WHERE rit_token=?',[req.params.token]);
    if(!rit)return res.status(403).json({error:'Ongeldig of verlopen token'});
    const check=get('SELECT * FROM verhuis_checks WHERE id=?',[req.params.checkId]);
    if(!check||check.rit_id!==rit.id)return res.status(403).json({error:'Deze regel hoort niet bij deze rit'});
    const nieuw=check.gelost?0:1;
    run('UPDATE verhuis_checks SET gelost=?,gelost_door=?,gelost_op=? WHERE id=?',
      [nieuw,nieuw?(rit.chauffeur||''):'',nieuw?now():'',check.id]);
    if(check.taak_id){
      const taak=get('SELECT * FROM transport_taken WHERE id=?',[check.taak_id]);
      const groep=all('SELECT * FROM verhuis_checks WHERE taak_id=?',[check.taak_id]);
      const alleGelost=groep.length>0 && groep.every(c=>c.id===check.id?nieuw:c.gelost);
      if(alleGelost && taak && taak.naar_locatie_id)_pasBakAttribuutStatusToe(groep,{naar_locatie_id:taak.naar_locatie_id},rit);
    }
    saveDb();
    res.json(get('SELECT * FROM verhuis_checks WHERE id=?',[check.id]));
  });

  // ── KLEURENBORDEN PER LOCATIE EN WEEK ──
  app.get('/api/kleurenborden',(req,res)=>{
    res.json(all('SELECT kb.*,l.name as locatie_naam FROM locatie_kleuren kb LEFT JOIN locaties l ON l.id=kb.locatie_id ORDER BY kb.locatie_id,kb.week,kb.kleur'));
  });
  app.post('/api/kleurenborden',(req,res)=>{
    const{locatie_id,week,kleur,aantal}=req.body;
    if(!locatie_id||!week||!kleur)return res.status(400).json({error:'locatie_id, week en kleur zijn verplicht'});
    try{const id=ins('INSERT INTO locatie_kleuren (locatie_id,week,kleur,aantal) VALUES (?,?,?,?)',[locatie_id,week,(kleur+'').toUpperCase(),aantal||1]);res.json(get('SELECT * FROM locatie_kleuren WHERE id=?',[id]));}
    catch(e){res.status(400).json({error:'Combinatie bestaat al'});}
  });
  app.put('/api/kleurenborden/:id',(req,res)=>{
    run('UPDATE locatie_kleuren SET aantal=? WHERE id=?',[req.body.aantal||1,req.params.id]);
    res.json(get('SELECT * FROM locatie_kleuren WHERE id=?',[req.params.id]));
  });
  app.delete('/api/kleurenborden/:id',(req,res)=>{
    run('DELETE FROM locatie_kleuren WHERE id=?',[req.params.id]);
    res.json({ok:true});
  });
  // Bulk upsert: vervang de hele set voor locatie × week in één call
  app.post('/api/kleurenborden/bulk',(req,res)=>{
    const{locatie_id,week,kleuren}=req.body;
    if(!locatie_id||!week||!Array.isArray(kleuren))return res.status(400).json({error:'locatie_id, week en kleuren[] zijn verplicht'});
    run('DELETE FROM locatie_kleuren WHERE locatie_id=? AND week=?',[locatie_id,week]);
    kleuren.filter(k=>k.kleur&&k.aantal>0).forEach(k=>{
      ins('INSERT INTO locatie_kleuren (locatie_id,week,kleur,aantal) VALUES (?,?,?,?)',[locatie_id,week,(k.kleur+'').toUpperCase(),k.aantal]);
    });
    res.json({ok:true,opgeslagen:kleuren.length});
  });

  // Kleurenborden stock per stockagelocatie
  app.get('/api/kleurenborden-stock/:locatie_id',(req,res)=>{
    res.json(all('SELECT * FROM kleurenborden_stock WHERE locatie_id=? ORDER BY kleur',[req.params.locatie_id]));
  });
  app.post('/api/kleurenborden-stock/:locatie_id',(req,res)=>{
    const{kleuren}=req.body;
    if(!Array.isArray(kleuren))return res.status(400).json({error:'kleuren[] vereist'});
    run('DELETE FROM kleurenborden_stock WHERE locatie_id=?',[req.params.locatie_id]);
    kleuren.filter(k=>k.kleur&&k.aantal>0).forEach(k=>{
      ins('INSERT INTO kleurenborden_stock (locatie_id,kleur,aantal) VALUES (?,?,?)',[req.params.locatie_id,(k.kleur+'').toUpperCase(),k.aantal]);
    });
    saveDb();
    res.json({ok:true});
  });

  // Koppel een taak aan een rit (getal), of ontkoppel → nood (null)
  app.put('/api/transport-taken/:id/rit',(req,res)=>{
    const {rit_id}=req.body;
    const t=get('SELECT * FROM transport_taken WHERE id=?',[req.params.id]);
    if(!t) return res.status(404).json({error:'Transport niet gevonden'});
    if(rit_id===null||rit_id===undefined||rit_id===''){
      run("UPDATE transport_taken SET rit_id=NULL,datum='',wie='' WHERE id=?",[req.params.id]);
    } else {
      const rit=get('SELECT * FROM transport_ritten WHERE id=?',[rit_id]);
      if(!rit) return res.status(404).json({error:'Rit niet gevonden'});
      run('UPDATE transport_taken SET rit_id=?,datum=?,wie=? WHERE id=?',[rit_id,rit.datum,rit.chauffeur||'',req.params.id]);
    }
    const taak=get('SELECT * FROM transport_taken WHERE id=?',[req.params.id]);
    const regels=all('SELECT * FROM transport_regels WHERE taak_id=?',[req.params.id]);
    res.json({...taak,regels});
  });

  // ── VAKANTIEPERIODES ──
  app.get('/api/periodes', (req,res) => res.json(all('SELECT * FROM vakantieperiodes ORDER BY start_datum')));
  app.post('/api/periodes', (req,res) => {
    const {naam, start_datum, eind_datum} = req.body;
    if(!naam||!start_datum||!eind_datum) return res.status(400).json({error:'Naam, startdatum en einddatum zijn verplicht'});
    // Bereken max_weken uit het aantal kalenderdagen
    const diffMs=new Date(eind_datum+'T12:00:00')-new Date(start_datum+'T12:00:00');
    const max_weken=Math.max(1,Math.ceil((diffMs/86400000+1)/7));
    const id=ins('INSERT INTO vakantieperiodes (naam,start_datum,eind_datum,max_weken) VALUES (?,?,?,?)',[naam,start_datum,eind_datum,max_weken]);
    res.json(get('SELECT * FROM vakantieperiodes WHERE id=?',[id]));
  });
  app.put('/api/periodes/:id', (req,res) => {
    const {naam, start_datum, eind_datum} = req.body;
    if(!naam||!start_datum||!eind_datum) return res.status(400).json({error:'Naam, startdatum en einddatum zijn verplicht'});
    const diffMs=new Date(eind_datum+'T12:00:00')-new Date(start_datum+'T12:00:00');
    const max_weken=Math.max(1,Math.ceil((diffMs/86400000+1)/7));
    run('UPDATE vakantieperiodes SET naam=?,start_datum=?,eind_datum=?,max_weken=? WHERE id=?',[naam,start_datum,eind_datum,max_weken,req.params.id]);
    res.json(get('SELECT * FROM vakantieperiodes WHERE id=?',[req.params.id]));
  });
  app.delete('/api/periodes/:id', (req,res) => {
    const kms=all('SELECT COUNT(*) as n FROM kampmomenten WHERE periode_id=?',[req.params.id]);
    if(kms[0]?.n>0) return res.status(400).json({error:'Periode heeft nog kampmomenten. Verplaats of verwijder ze eerst.'});
    run('DELETE FROM vakantieperiodes WHERE id=?',[req.params.id]);
    res.json({ok:true});
  });

  // ── S3.8: DATA EXPORT / IMPORT — dynamisch over ALLE tabellen ──
  // Loopt over sqlite_master i.p.v. een hardcoded (en dus steeds verouderende) tabellenlijst.
  // sqlite_-interne tabellen worden overgeslagen.
  function _alleTabellen(){
    return all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").map(r=>r.name);
  }
  function _kolommenVan(tabel){
    const info=db.exec(`PRAGMA table_info(${tabel})`)[0];
    return info?info.values.map(r=>r[1]):[];
  }
  app.get('/api/export', (req, res) => {
    const data = { versie: 3, datum: new Date().toISOString() };
    _alleTabellen().forEach(t=>{ try{ data[t]=all(`SELECT * FROM ${t}`); }catch(e){ data[t]=[]; } });
    res.setHeader('Content-Disposition', 'attachment; filename="sporty-backup-' + new Date().toISOString().split('T')[0] + '.json"');
    res.setHeader('Content-Type', 'application/json');
    res.json(data);
  });

  // Volledige backup: download de hele SQLite-database als bestand (alle data, gegarandeerd compleet)
  app.get('/api/backup-db', (req, res) => {
    try {
      const data = Buffer.from(db.export());
      const ts = new Date().toISOString().replace('T','_').replace(/:/g,'-').slice(0,16);
      res.setHeader('Content-Disposition', 'attachment; filename="sporty-backup-' + ts + '.db"');
      res.setHeader('Content-Type', 'application/octet-stream');
      res.send(data);
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // Diagnose: waar staat de database echt? (volume vs tijdelijk)
  app.get('/api/dbinfo', (req, res) => {
    let themas=0; try{ themas=get('SELECT count(*) as n FROM themas').n; }catch(e){}
    res.json({ db_path: DB_PATH, data_dir: DATA_DIR, railway_volume_env: process.env.RAILWAY_VOLUME_MOUNT_PATH || null, dirname: __dirname, themas });
  });
  // Reset: wis alle data voor import (dynamisch, alle levende tabellen behalve app_vlaggen/sessies
  // — die twee moeten een reset overleven zodat migratievlaggen en ingelogde sessies niet
  // per ongeluk verdwijnen bij een import-rondje).
  app.post('/api/import/reset', (req, res) => {
    try {
      const tables = _alleTabellen().filter(t=>t!=='app_vlaggen'&&t!=='sessies');
      tables.forEach(t => { try { db.run('DELETE FROM ' + t); } catch(e) {} });
      saveDb();
      res.json({ ok: true, tables });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // Importeer één tabel per keer — kolommen worden afgeleid uit de data zelf, gefilterd op
  // kolommen die écht in de tabel bestaan (dynamisch i.p.v. hardcoded, S3.8).
  app.post('/api/import/tabel', (req, res) => {
    const { table, rows } = req.body;
    if (!table || !rows) return res.status(400).json({ error: 'Tabel of rijen ontbreken' });
    const bestaandeKolommen = _kolommenVan(table);
    if (!bestaandeKolommen.length) return res.status(400).json({ error: 'Onbekende tabel: ' + table });
    if (!rows.length) return res.json({ ok: true, count: 0 });
    // Kolommen afleiden uit de union van sleutels in de data, beperkt tot wat de tabel heeft.
    const dataKolommen = new Set();
    rows.forEach(r => Object.keys(r).forEach(k => dataKolommen.add(k)));
    const cols = bestaandeKolommen.filter(c => dataKolommen.has(c));
    if (!cols.length) return res.status(400).json({ error: 'Geen overeenkomende kolommen voor tabel: ' + table });
    try {
      let count=0;
      rows.forEach(r => {
        const vals = cols.map(c => r[c] !== undefined ? r[c] : null);
        const ph = cols.map(() => '?').join(',');
        try { db.run('INSERT OR IGNORE INTO ' + table + ' (' + cols.join(',') + ') VALUES (' + ph + ')', vals); count++; } catch(e) {}
      });
      saveDb();
      res.json({ ok: true, count });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });


  // ── ITEM TYPES (centrale materiaalkatalogus) ──
  app.get('/api/item-types',(req,res)=>res.json(all('SELECT * FROM item_types ORDER BY categorie,naam')));
  app.post('/api/item-types',(req,res)=>{
    const{naam,eenheid,categorie,notities}=req.body;
    if(!naam?.trim())return res.status(400).json({error:'Naam vereist'});
    const id=ins('INSERT INTO item_types (naam,eenheid,categorie,notities) VALUES (?,?,?,?)',[naam.trim(),eenheid||'stuk',categorie||'',notities||'']);
    res.json(get('SELECT * FROM item_types WHERE id=?',[id]));
  });
  app.put('/api/item-types/:id',(req,res)=>{
    const{naam,eenheid,categorie,notities}=req.body;
    run('UPDATE item_types SET naam=?,eenheid=?,categorie=?,notities=? WHERE id=?',[naam,eenheid||'stuk',categorie||'',notities||'',req.params.id]);
    res.json(get('SELECT * FROM item_types WHERE id=?',[req.params.id]));
  });
  app.delete('/api/item-types/:id',(req,res)=>{
    run('DELETE FROM item_types WHERE id=?',[req.params.id]);
    res.json({ok:true});
  });

  // ── STOCK OVERZICHT (per item_type: bakken + voorraad) ──
  app.get('/api/stock-overzicht',(req,res)=>{
    const types=all('SELECT * FROM item_types ORDER BY categorie,naam');
    const bakItems=all(`SELECT bi.item_type_id, bi.naam, bi.qty, bi.verbruik, bi.qty_stock, bi.qty_minimum,
      b.naam as bak_label, b.code as bak_code, t.name as thema_naam, t.color as thema_color, t.id as thema_id
      FROM bak_items bi
      JOIN bakken b ON b.id=bi.bak_id
      JOIN thema_bak tb ON tb.bak_id=b.id
      JOIN themas t ON t.id=tb.thema_id
      WHERE bi.item_type_id IS NOT NULL`);
    const stockRows=all(`SELECT s.item_type_id, s.qty, s.minimum, it.eenheid,
      l.name as locatie_naam, l.id as locatie_id
      FROM item_type_stock s JOIN locaties l ON l.id=s.locatie_id JOIN item_types it ON it.id=s.item_type_id
      WHERE s.item_type_id IS NOT NULL`);
    res.json(types.map(t=>{
      const allBakken=[...bakItems].filter(b=>b.item_type_id===t.id);
      const stock=stockRows.filter(s=>s.item_type_id===t.id);
      const totaalStock=stock.reduce((s,r)=>s+r.qty,0);
      const totaalNodig=allBakken.reduce((s,b)=>s+b.qty,0);
      return {...t,bakken:allBakken,stock,totaal_stock:totaalStock,totaal_nodig:totaalNodig,tekort:totaalStock<totaalNodig};
    }));
  });

  // ── PERSONEEL ──
  app.get('/api/personeel',(req,res)=>{
    const personen=all('SELECT * FROM personeel ORDER BY rol,naam');
    const shifts=all(`SELECT ps.*, km.week, km.locatie_id, l.name as locatie_naam
      FROM personeel_shifts ps
      LEFT JOIN kampmomenten km ON km.id=ps.kampmoment_id
      LEFT JOIN locaties l ON l.id=COALESCE(ps.locatie_id,km.locatie_id)
      ORDER BY ps.datum,ps.van_uur`);
    // pincode is een hash, maar wordt hier toch nooit meegestuurd — enkel of iemand er al één heeft.
    res.json(personen.map(p=>{const{pincode,...rest}=p;return{...rest,heeft_pincode:!!pincode,shifts:shifts.filter(s=>s.persoon_id===p.id)};}));
  });
  app.post('/api/personeel',(req,res)=>{
    const{naam,rol,telefoon,email,notities}=req.body;
    if(!naam?.trim())return res.status(400).json({error:'Naam vereist'});
    const id=ins('INSERT INTO personeel (naam,rol,telefoon,email,notities) VALUES (?,?,?,?,?)',
      [naam.trim(),rol||'kv',telefoon||'',email||'',notities||'']);
    res.json(get('SELECT * FROM personeel WHERE id=?',[id]));
  });
  app.put('/api/personeel/:id',(req,res)=>{
    const{naam,rol,telefoon,email,notities}=req.body;
    run('UPDATE personeel SET naam=?,rol=?,telefoon=?,email=?,notities=? WHERE id=?',
      [naam,rol||'kv',telefoon||'',email||'',notities||'',req.params.id]);
    res.json(get('SELECT * FROM personeel WHERE id=?',[req.params.id]));
  });
  app.delete('/api/personeel/:id',(req,res)=>{run('DELETE FROM personeel WHERE id=?',[req.params.id]);res.json({ok:true});});
  app.post('/api/personeel/:id/shifts',(req,res)=>{
    const{kampmoment_id,locatie_id,datum,van_uur,tot_uur,rol_dag,notities}=req.body;
    const id=ins('INSERT INTO personeel_shifts (persoon_id,kampmoment_id,locatie_id,datum,van_uur,tot_uur,rol_dag,notities) VALUES (?,?,?,?,?,?,?,?)',
      [req.params.id,kampmoment_id||null,locatie_id||null,datum||'',van_uur||'',tot_uur||'',rol_dag||'',notities||'']);
    res.json(get('SELECT * FROM personeel_shifts WHERE id=?',[id]));
  });
  app.put('/api/personeel-shifts/:id',(req,res)=>{
    const{kampmoment_id,locatie_id,datum,van_uur,tot_uur,rol_dag,notities}=req.body;
    run('UPDATE personeel_shifts SET kampmoment_id=?,locatie_id=?,datum=?,van_uur=?,tot_uur=?,rol_dag=?,notities=? WHERE id=?',
      [kampmoment_id||null,locatie_id||null,datum||'',van_uur||'',tot_uur||'',rol_dag||'',notities||'',req.params.id]);
    res.json(get('SELECT * FROM personeel_shifts WHERE id=?',[req.params.id]));
  });
  app.delete('/api/personeel-shifts/:id',(req,res)=>{run('DELETE FROM personeel_shifts WHERE id=?',[req.params.id]);res.json({ok:true});});
  // Wie werkt waar welke week
  app.get('/api/personeel/week/:week',(req,res)=>{
    const week=parseInt(req.params.week);
    const rows=all(`SELECT ps.*, p.naam, p.rol, p.telefoon, l.name as locatie_naam, km.week
      FROM personeel_shifts ps
      JOIN personeel p ON p.id=ps.persoon_id
      LEFT JOIN kampmomenten km ON km.id=ps.kampmoment_id
      LEFT JOIN locaties l ON l.id=COALESCE(ps.locatie_id,km.locatie_id)
      WHERE km.week=? OR ps.datum LIKE ?`,[week,'%-W'+String(week).padStart(2,'0')+'-%']);
    res.json(rows);
  });

  // ── VASTE BAKKEN (S2.1: nu backed door de uniforme bakken-tabel, soort='vast') ──
  // Fysieke exemplaren (EHBO-koffer #1, #2...) gegroepeerd per vast_type. Geen itemlijst
  // (de oude vaste_bak_items-tabel/route blijft bestaan maar wordt hier niet meer gevoed).
  app.get('/api/vaste-bakken',(req,res)=>{
    res.json(all("SELECT * FROM bakken WHERE soort='vast' ORDER BY vast_type,volgorde,naam"));
  });
  // S4.6: foto's op pool-eenheden (o.a. springkasteel/waterstructuur) — opgeplooid + opgezet,
  // zelfde base64-in-SQLite-patroon als attributen.foto_data / bak_fotos.
  app.post('/api/vaste-bakken/:id/foto-slot',(req,res)=>{
    const{slot,foto_data}=req.body;
    if(!['opgeplooid','opgezet'].includes(slot))return res.status(400).json({error:"slot moet 'opgeplooid' of 'opgezet' zijn"});
    if(!foto_data)return res.status(400).json({error:'Geen foto data'});
    const cur=get("SELECT * FROM bakken WHERE id=? AND soort='vast'",[req.params.id]);
    if(!cur)return res.status(404).json({error:'Vaste bak niet gevonden'});
    const kolom=slot==='opgeplooid'?'foto_opgeplooid':'foto_opgezet';
    run(`UPDATE bakken SET ${kolom}=? WHERE id=?`,[foto_data,req.params.id]);
    saveDb();
    res.json(get('SELECT * FROM bakken WHERE id=?',[req.params.id]));
  });
  app.delete('/api/vaste-bakken/:id/foto-slot/:slot',(req,res)=>{
    if(!['opgeplooid','opgezet'].includes(req.params.slot))return res.status(400).json({error:"ongeldig slot"});
    const kolom=req.params.slot==='opgeplooid'?'foto_opgeplooid':'foto_opgezet';
    run(`UPDATE bakken SET ${kolom}='' WHERE id=?`,[req.params.id]);
    saveDb();
    res.json(get('SELECT * FROM bakken WHERE id=?',[req.params.id]));
  });
  app.post('/api/vaste-bakken',(req,res)=>{
    const{naam,code,vast_type,thuislocatie_id}=req.body;
    if(!naam?.trim())return res.status(400).json({error:'Naam vereist'});
    const thuis=thuislocatie_id||_rozenwegId();
    const id=ins('INSERT INTO bakken (naam,code,soort,vast_type,thuislocatie_id,huidige_locatie_id,status) VALUES (?,?,?,?,?,?,?)',
      [naam.trim(),code||'','vast',vast_type||'',thuis,thuis,'thuis']);
    res.json(get('SELECT * FROM bakken WHERE id=?',[id]));
  });
  app.put('/api/vaste-bakken/:id',(req,res)=>{
    const{naam,code,vast_type,thuislocatie_id,status}=req.body;
    const cur=get('SELECT * FROM bakken WHERE id=?',[req.params.id]);
    if(!cur)return res.status(404).json({error:'Niet gevonden'});
    run('UPDATE bakken SET naam=?,code=?,vast_type=?,thuislocatie_id=?,status=? WHERE id=?',
      [naam??cur.naam,code??cur.code,vast_type??cur.vast_type,thuislocatie_id??cur.thuislocatie_id,status??cur.status,req.params.id]);
    res.json(get('SELECT * FROM bakken WHERE id=?',[req.params.id]));
  });
  app.delete('/api/vaste-bakken/:id',(req,res)=>{
    run('DELETE FROM bakken WHERE id=?',[req.params.id]);
    res.json({ok:true});
  });
  app.post('/api/vaste-bakken/:id/items',(req,res)=>{
    const{naam,qty,eenheid,is_verbruik,qty_minimum,notitie,item_type_id}=req.body;
    if(!naam?.trim())return res.status(400).json({error:'Naam vereist'});
    const maxOrd=(get('SELECT MAX(volgorde) as m FROM vaste_bak_items WHERE bak_id=?',[req.params.id])||{}).m||0;
    const resolvedTypeId=item_type_id||resolveItemTypeId(naam);
    const id=ins('INSERT INTO vaste_bak_items (bak_id,naam,qty,eenheid,is_verbruik,qty_minimum,notitie,item_type_id,volgorde) VALUES (?,?,?,?,?,?,?,?,?)',
      [req.params.id,naam.trim(),qty||1,eenheid||'stuk',is_verbruik?1:0,qty_minimum||0,notitie||'',resolvedTypeId,maxOrd+10]);
    res.json(get('SELECT * FROM vaste_bak_items WHERE id=?',[id]));
  });
  app.put('/api/vaste-bak-items/:id',(req,res)=>{
    const{naam,qty,eenheid,is_verbruik,qty_stock,qty_minimum,notitie}=req.body;
    const cur=get('SELECT * FROM vaste_bak_items WHERE id=?',[req.params.id]);
    if(!cur)return res.status(404).json({error:'Item niet gevonden'});
    const item_type_id=naam&&naam!==cur.naam?resolveItemTypeId(naam):cur.item_type_id;
    run('UPDATE vaste_bak_items SET naam=?,qty=?,eenheid=?,is_verbruik=?,qty_stock=?,qty_minimum=?,notitie=?,item_type_id=? WHERE id=?',
      [naam,qty||1,eenheid||'stuk',is_verbruik?1:0,qty_stock||0,qty_minimum||0,notitie||'',item_type_id,req.params.id]);
    res.json(get('SELECT * FROM vaste_bak_items WHERE id=?',[req.params.id]));
  });
  app.delete('/api/vaste-bak-items/:id',(req,res)=>{
    run('DELETE FROM vaste_bak_items WHERE id=?',[req.params.id]);
    res.json({ok:true});
  });

  // ── ATTRIBUTEN (S2.2: los concept naast bakken, geen itemlijst, deelbaar over thema's) ──
  function _attributenVanThema(thema_id){
    const attrs=all(`SELECT a.* FROM attributen a JOIN thema_attribuut ta ON ta.attribuut_id=a.id
      WHERE ta.thema_id=? ORDER BY a.naam`,[thema_id]);
    return attrs.map(a=>{
      const andereThemas=all(`SELECT t.id,t.name FROM thema_attribuut ta2 JOIN themas t ON t.id=ta2.thema_id
        WHERE ta2.attribuut_id=? AND ta2.thema_id!=?`,[a.id,thema_id]);
      return {...a,gedeeld_met:andereThemas};
    });
  }
  app.get('/api/attributen',(req,res)=>res.json(all('SELECT * FROM attributen ORDER BY naam')));
  app.get('/api/themas/:id/attributen',(req,res)=>res.json(_attributenVanThema(req.params.id)));
  app.post('/api/attributen',(req,res)=>{
    const{naam,code,thuislocatie_id,notitie,foto_data}=req.body;
    if(!naam?.trim())return res.status(400).json({error:'Naam vereist'});
    const dubbeleCode=code&&get('SELECT id FROM bakken WHERE code=? AND code!=\'\' UNION SELECT id FROM attributen WHERE code=? AND code!=\'\'',[code,code]);
    const thuis=thuislocatie_id||_rozenwegId();
    const id=ins('INSERT INTO attributen (naam,code,thuislocatie_id,huidige_locatie_id,status,foto_data,notitie) VALUES (?,?,?,?,?,?,?)',
      [naam.trim(),code||'',thuis,thuis,'thuis',foto_data||'',notitie||'']);
    if(dubbeleCode) console.warn(`  Waarschuwing: code "${code}" bestaat al op een andere bak/attribuut (niet-blokkerend)`);
    res.json(get('SELECT * FROM attributen WHERE id=?',[id]));
  });
  app.put('/api/attributen/:id',(req,res)=>{
    const{naam,code,thuislocatie_id,status,notitie,foto_data}=req.body;
    const cur=get('SELECT * FROM attributen WHERE id=?',[req.params.id]);
    if(!cur)return res.status(404).json({error:'Niet gevonden'});
    run('UPDATE attributen SET naam=?,code=?,thuislocatie_id=?,status=?,notitie=?,foto_data=? WHERE id=?',
      [naam??cur.naam,code??cur.code,thuislocatie_id??cur.thuislocatie_id,status??cur.status,notitie??cur.notitie,foto_data??cur.foto_data,req.params.id]);
    res.json(get('SELECT * FROM attributen WHERE id=?',[req.params.id]));
  });
  app.delete('/api/attributen/:id',(req,res)=>{
    run('DELETE FROM thema_attribuut WHERE attribuut_id=?',[req.params.id]);
    run('DELETE FROM attributen WHERE id=?',[req.params.id]);
    res.json({ok:true});
  });
  app.post('/api/themas/:id/attributen',(req,res)=>{
    const{attribuut_id}=req.body;
    if(!attribuut_id)return res.status(400).json({error:'attribuut_id vereist'});
    const bestaat=get('SELECT id FROM thema_attribuut WHERE thema_id=? AND attribuut_id=?',[req.params.id,attribuut_id]);
    if(!bestaat) ins('INSERT INTO thema_attribuut (thema_id,attribuut_id) VALUES (?,?)',[req.params.id,attribuut_id]);
    res.json({ok:true});
  });
  app.delete('/api/themas/:themaId/attributen/:attrId',(req,res)=>{
    run('DELETE FROM thema_attribuut WHERE thema_id=? AND attribuut_id=?',[req.params.themaId,req.params.attrId]);
    res.json({ok:true});
  });

  // ── VOORRAAD / BESTELLIJST (S2.3) ──
  app.get('/api/voorraad',(req,res)=>{
    const rows=all(`SELECT s.*, it.naam as item_naam, it.eenheid, it.categorie, l.name as locatie_naam
      FROM item_type_stock s JOIN item_types it ON it.id=s.item_type_id JOIN locaties l ON l.id=s.locatie_id
      ORDER BY l.name, it.categorie, it.naam`);
    res.json(rows);
  });
  app.post('/api/voorraad',(req,res)=>{
    const{item_type_id,locatie_id,qty,minimum}=req.body;
    if(!item_type_id||!locatie_id)return res.status(400).json({error:'item_type_id en locatie_id vereist'});
    const cur=get('SELECT * FROM item_type_stock WHERE item_type_id=? AND locatie_id=?',[item_type_id,locatie_id]);
    if(cur){
      run('UPDATE item_type_stock SET qty=?,minimum=? WHERE id=?',[qty??cur.qty,minimum??cur.minimum,cur.id]);
    } else {
      ins('INSERT INTO item_type_stock (item_type_id,locatie_id,qty,minimum) VALUES (?,?,?,?)',[item_type_id,locatie_id,qty||0,minimum||0]);
    }
    res.json(get('SELECT * FROM item_type_stock WHERE item_type_id=? AND locatie_id=?',[item_type_id,locatie_id]));
  });
  app.get('/api/bestellijst',(req,res)=>{
    const rows=all(`SELECT s.*, it.naam as item_naam, it.eenheid, it.categorie, l.name as locatie_naam
      FROM item_type_stock s JOIN item_types it ON it.id=s.item_type_id JOIN locaties l ON l.id=s.locatie_id
      WHERE s.qty < s.minimum ORDER BY l.name, it.naam`);
    res.json(rows);
  });

  // ── S2.4: BAK/ATTRIBUUT-STATUS, HANDMATIGE VERPLAATSING, ZOEKEN ──
  app.post('/api/bakken/:id/verplaats',(req,res)=>{
    const{naar_locatie_id,reden}=req.body;
    if(!naar_locatie_id||!reden?.trim())return res.status(400).json({error:'naar_locatie_id en reden zijn verplicht'});
    const b=get('SELECT * FROM bakken WHERE id=?',[req.params.id]);
    if(!b)return res.status(404).json({error:'Bak niet gevonden'});
    const nieuweStatus=naar_locatie_id==b.thuislocatie_id?'thuis':'op_locatie';
    run('UPDATE bakken SET huidige_locatie_id=?,status=? WHERE id=?',[naar_locatie_id,nieuweStatus,req.params.id]);
    const loc=get('SELECT name FROM locaties WHERE id=?',[naar_locatie_id]);
    logAct('bak','verplaatst',`Bak "${b.naam}" (${b.code||'-'}) handmatig verplaatst naar ${loc?.name||naar_locatie_id} — reden: ${reden.trim()}`,naar_locatie_id,loc?.name);
    res.json(get('SELECT * FROM bakken WHERE id=?',[req.params.id]));
  });
  app.post('/api/attributen/:id/verplaats',(req,res)=>{
    const{naar_locatie_id,reden}=req.body;
    if(!naar_locatie_id||!reden?.trim())return res.status(400).json({error:'naar_locatie_id en reden zijn verplicht'});
    const a=get('SELECT * FROM attributen WHERE id=?',[req.params.id]);
    if(!a)return res.status(404).json({error:'Attribuut niet gevonden'});
    const nieuweStatus=naar_locatie_id==a.thuislocatie_id?'thuis':'op_locatie';
    run('UPDATE attributen SET huidige_locatie_id=?,status=? WHERE id=?',[naar_locatie_id,nieuweStatus,req.params.id]);
    const loc=get('SELECT name FROM locaties WHERE id=?',[naar_locatie_id]);
    logAct('attribuut','verplaatst',`Attribuut "${a.naam}" (${a.code||'-'}) handmatig verplaatst naar ${loc?.name||naar_locatie_id} — reden: ${reden.trim()}`,naar_locatie_id,loc?.name);
    res.json(get('SELECT * FROM attributen WHERE id=?',[req.params.id]));
  });
  app.get('/api/waar-is',(req,res)=>{
    const q='%'+(req.query.q||'')+'%';
    const bakken=all("SELECT id,naam,code,'bak' as soort,huidige_locatie_id,status FROM bakken WHERE naam LIKE ? OR code LIKE ?",[q,q]);
    const attrs=all("SELECT id,naam,code,'attribuut' as soort,huidige_locatie_id,status FROM attributen WHERE naam LIKE ? OR code LIKE ?",[q,q]);
    const resultaten=[...bakken,...attrs].map(r=>{
      const loc=get('SELECT name FROM locaties WHERE id=?',[r.huidige_locatie_id]);
      const bewegingen=all(`SELECT * FROM activiteiten_log WHERE (type=? AND beschrijving LIKE ?) ORDER BY id DESC LIMIT 5`,
        [r.soort,'%"'+r.naam+'"%']);
      return {...r,huidige_locatie_naam:loc?.name||null,laatste_bewegingen:bewegingen};
    });
    res.json(resultaten);
  });

  // ── NAKIJKEN ──
  // Haal alle open/recente sessies op met bak-info
  app.get('/api/nakijk',(req,res)=>{
    const sessies=all(`SELECT ns.*,
      tb.label as bak_label, tb.code as bak_code, t.name as thema_naam, t.color as thema_color, t.id as thema_id,
      vb.naam as vaste_bak_naam, vb.code as vaste_code,
      l.name as locatie_naam
      FROM nakijk_sessies ns
      LEFT JOIN thema_bakken tb ON tb.id=ns.thema_bak_id
      LEFT JOIN themas t ON t.id=tb.thema_id
      LEFT JOIN vaste_bakken vb ON vb.id=ns.vaste_bak_id
      LEFT JOIN locaties l ON l.id=ns.locatie_id
      ORDER BY ns.id DESC`);
    const regels=all('SELECT * FROM nakijk_regels ORDER BY sessie_id,id');
    res.json(sessies.map(s=>({...s,regels:regels.filter(r=>r.sessie_id===s.id)})));
  });
  // Urgentie: per thema_bak — wanneer is dit thema de komende weken gepland?
  app.get('/api/nakijk/urgentie',(req,res)=>{
    const bakken=all(`SELECT tb.id as bak_id, tb.label, tb.code, t.id as thema_id, t.name as thema_naam, t.color as thema_color,
      tb.leeftijdsgroep,
      MAX(ns.kv_tijdstip) as laatste_check,
      MAX(CASE WHEN ns.kv_status='ingediend' AND ns.kantoor_status='open' THEN 1 ELSE 0 END) as wacht_kantoor
      FROM thema_bakken tb
      JOIN themas t ON t.id=tb.thema_id
      LEFT JOIN nakijk_sessies ns ON ns.thema_bak_id=tb.id
      GROUP BY tb.id ORDER BY t.name,tb.volgorde`);
    const geplande=all(`SELECT DISTINCT kt.thema_id, km.week FROM kampmoment_themas kt JOIN kampmomenten km ON km.id=kt.kampmoment_id WHERE km.week IS NOT NULL ORDER BY km.week`);
    const huidigWeek=(get('SELECT MIN(week) as w FROM kampmomenten WHERE week IS NOT NULL')||{}).w||1;
    const themaBakken=bakken.map(b=>{
      const weken=geplande.filter(g=>g.thema_id===b.thema_id).map(g=>g.week).sort((a,z)=>a-z);
      const eersteVolgendeWeek=weken.find(w=>w>=huidigWeek)||null;
      return {...b,bak_soort:'thema',geplande_weken:weken,eerste_week:eersteVolgendeWeek,is_dringend:eersteVolgendeWeek!=null&&eersteVolgendeWeek<=huidigWeek+1};
    });
    // Vaste bakken: geen urgentie berekening, altijd zichtbaar
    const vasteBakken=all(`SELECT vb.id as bak_id, vb.naam as label, vb.code, vb.type, vb.notities,
      MAX(ns.kv_tijdstip) as laatste_check,
      MAX(CASE WHEN ns.kv_status='ingediend' AND ns.kantoor_status='open' THEN 1 ELSE 0 END) as wacht_kantoor
      FROM vaste_bakken vb
      LEFT JOIN nakijk_sessies ns ON ns.vaste_bak_id=vb.id
      GROUP BY vb.id ORDER BY vb.volgorde,vb.id`).map(b=>({...b,bak_soort:'vast',thema_naam:'Vaste bakken',thema_color:'#6B7280',is_dringend:false,geplande_weken:[],eerste_week:null}));
    res.json([...themaBakken,...vasteBakken]);
  });
  // Start een nieuwe nakijksessie voor een thema-bak
  app.post('/api/nakijk/start',(req,res)=>{
    const{bak_type,thema_bak_id,vaste_bak_id,sport_item_id,locatie_id,week,kv_wie}=req.body;
    const sessieId=ins(`INSERT INTO nakijk_sessies (bak_type,thema_bak_id,vaste_bak_id,sport_item_id,locatie_id,week,datum,kv_wie,kv_status,kantoor_status)
      VALUES (?,?,?,?,?,?,?,?,'open','open')`,[bak_type||'thema',thema_bak_id||null,vaste_bak_id||null,sport_item_id||null,locatie_id||null,week||null,now(),kv_wie||'']);
    // Auto-vul regels vanuit bak_items of vaste_bak_items
    if(thema_bak_id){
      const items=all('SELECT * FROM bak_items WHERE bak_id=? ORDER BY verbruik,id',[thema_bak_id]);
      items.forEach(i=>ins('INSERT INTO nakijk_regels (sessie_id,item_naam,item_id,verwacht) VALUES (?,?,?,?)',[sessieId,i.naam,i.id,i.qty]));
    } else if(vaste_bak_id){
      const items=all('SELECT * FROM vaste_bak_items WHERE bak_id=? ORDER BY volgorde,id',[vaste_bak_id]);
      items.forEach(i=>ins('INSERT INTO nakijk_regels (sessie_id,item_naam,item_id,verwacht) VALUES (?,?,?,?)',[sessieId,i.naam,i.id,i.qty]));
    }
    res.json({sessie_id:sessieId,regels:all('SELECT * FROM nakijk_regels WHERE sessie_id=?',[sessieId])});
  });
  // KV dient nakijk in
  app.put('/api/nakijk/:id/kv',(req,res)=>{
    const{kv_wie,regels,notities}=req.body;
    run('UPDATE nakijk_sessies SET kv_wie=?,kv_tijdstip=?,kv_status=?,notities=? WHERE id=?',[kv_wie||'',now(),'ingediend',notities||'',req.params.id]);
    if(Array.isArray(regels)){
      regels.forEach(r=>{
        const ontbreekt=Math.max(0,(r.verwacht||0)-(r.aangetroffen||0));
        run('UPDATE nakijk_regels SET aangetroffen=?,ontbreekt=?,is_kapot=?,opmerking=? WHERE id=? AND sessie_id=?',
          [r.aangetroffen||0,ontbreekt,r.is_kapot?1:0,r.opmerking||'',r.id,req.params.id]);
      });
      // Update qty_stock in bak_items voor thema-bak items
      regels.forEach(r=>{if(r.item_id&&r.aangetroffen!=null)run('UPDATE bak_items SET qty_stock=? WHERE id=?',[r.aangetroffen,r.item_id]);});
    }
    saveDb();
    res.json({ok:true});
  });
  // Kantoor verwerkt nakijk
  app.put('/api/nakijk/:id/kantoor',(req,res)=>{
    const{kantoor_wie,regels,kantoor_status}=req.body;
    run('UPDATE nakijk_sessies SET kantoor_wie=?,kantoor_tijdstip=?,kantoor_status=? WHERE id=?',[kantoor_wie||'',now(),kantoor_status||'nagekeken',req.params.id]);
    if(Array.isArray(regels)){
      regels.forEach(r=>{run('UPDATE nakijk_regels SET besteld=?,opmerking=? WHERE id=? AND sessie_id=?',[r.besteld?1:0,r.opmerking||'',r.id,req.params.id]);});
    }
    saveDb();
    res.json({ok:true});
  });
  app.delete('/api/nakijk/:id',(req,res)=>{
    run('DELETE FROM nakijk_sessies WHERE id=?',[req.params.id]);
    res.json({ok:true});
  });

  // ── S3.7: KANTOOR — TEKORTEN PER BAK ──
  // Werkscherm op ingediende KV-controles (kv_status='ingediend'): per bak de tekorten
  // (aangetroffen < verwacht) en kapot-markeringen, gegroepeerd zoals in het magazijn.
  // nakijk_sessies heeft geen kampmoment_id (ouder ontwerp, denormaliseert locatie_id+week
  // rechtstreeks) — kampmoment wordt hier afgeleid via de UNIQUE(locatie_id,week)-combinatie.
  app.get('/api/nakijk-tekorten',(req,res)=>{
    const sessies=all("SELECT * FROM nakijk_sessies WHERE kv_status='ingediend' ORDER BY kv_tijdstip DESC");
    const regels=all('SELECT * FROM nakijk_regels');
    const out=sessies.map(s=>{
      const bak=s.thema_bak_id?get('SELECT * FROM bakken WHERE id=?',[s.thema_bak_id]):null;
      const km=(s.locatie_id&&s.week)?get('SELECT * FROM kampmomenten WHERE locatie_id=? AND week=?',[s.locatie_id,s.week]):null;
      const loc=s.locatie_id?get('SELECT name FROM locaties WHERE id=?',[s.locatie_id]):null;
      const sRegels=regels.filter(r=>r.sessie_id===s.id).map(r=>{
        const bakItem=r.item_id?get('SELECT item_type_id FROM bak_items WHERE id=?',[r.item_id]):null;
        return {...r,item_type_id:bakItem?bakItem.item_type_id:null};
      });
      // S6.1: een tekortregel telt als "open" zolang hij niet aangevuld of genegeerd is —
      // 'besteld' (wacht op levering) blijft dus zichtbaar in tekorten, met tekort_status erbij
      // zodat de UI het onderscheid kan tonen.
      const tekorten=sRegels.filter(r=>(r.aangetroffen||0)<(r.verwacht||0)&&!['aangevuld','genegeerd'].includes(r.tekort_status));
      const kapotMeldingen=sRegels.filter(r=>r.is_kapot);
      return {
        ...s,
        bak_naam:bak?bak.naam:'',
        bak_code:bak?bak.code:'',
        bak_thuislocatie_id:bak?bak.thuislocatie_id:null,
        kampmoment_id:km?km.id:null,
        kampmoment_week:km?km.week:s.week,
        locatie_naam:loc?loc.name:'',
        regels:sRegels,
        tekorten,
        kapot_meldingen:kapotMeldingen,
      };
    });
    res.json(out);
  });
  // Aantal open controles voor de Materiaal-navbadge (ingediend, nog niet kantoor_status='verwerkt')
  app.get('/api/nakijk-tekorten/aantal-open',(req,res)=>{
    const n=get("SELECT COUNT(*) as n FROM nakijk_sessies WHERE kv_status='ingediend' AND kantoor_status!='verwerkt'").n;
    res.json({aantal:n});
  });
  // "✔ Aangevuld": vinkt de regel af EN boekt de aangevulde hoeveelheid af van item_type_stock
  // op de thuislocatie van de bak. Bestaat er geen voorraadrij, dan meldt dit dat expliciet
  // i.p.v. stil niets te doen (zie MASTERPLAN S3.7) — de UI biedt dan de knop hieronder aan.
  app.post('/api/nakijk-regels/:id/aanvullen',(req,res)=>{
    const aangevuld=Math.max(0,parseFloat(req.body?.aangevuld)||0);
    const regel=get('SELECT * FROM nakijk_regels WHERE id=?',[req.params.id]);
    if(!regel)return res.status(404).json({error:'Regel niet gevonden'});
    const sessie=get('SELECT * FROM nakijk_sessies WHERE id=?',[regel.sessie_id]);
    const bak=sessie&&sessie.thema_bak_id?get('SELECT * FROM bakken WHERE id=?',[sessie.thema_bak_id]):null;
    const bakItem=regel.item_id?get('SELECT * FROM bak_items WHERE id=?',[regel.item_id]):null;
    const itemTypeId=bakItem?bakItem.item_type_id:null;
    if(!itemTypeId)return res.status(400).json({error:'Geen catalogus-item gekoppeld aan dit item — kan voorraad niet afboeken.'});
    if(!bak||!bak.thuislocatie_id)return res.status(400).json({error:'Deze bak heeft geen thuislocatie ingesteld — kan voorraad niet afboeken.'});
    const stockRow=get('SELECT * FROM item_type_stock WHERE item_type_id=? AND locatie_id=?',[itemTypeId,bak.thuislocatie_id]);
    if(!stockRow)return res.status(400).json({error:`Geen voorraadrij voor "${bakItem.naam}" op de thuislocatie van deze bak — maak eerst een voorraadregel aan in Materiaal › Voorraad.`,item_type_id:itemTypeId,locatie_id:bak.thuislocatie_id,kan_aanmaken:true});
    const voorraad_voor=stockRow.qty;
    const voorraad_na=Math.max(0,voorraad_voor-aangevuld);
    run('UPDATE item_type_stock SET qty=? WHERE id=?',[voorraad_na,stockRow.id]);
    run("UPDATE nakijk_regels SET besteld=1,tekort_status='aangevuld' WHERE id=?",[regel.id]);
    saveDb();
    res.json({ok:true,voorraad_voor,voorraad_na,regel:get('SELECT * FROM nakijk_regels WHERE id=?',[regel.id])});
  });
  // S6.1(b): maak de ontbrekende voorraadrij aan (qty 0, minimum 0) zodat de UI meteen daarna
  // opnieuw "aanvullen" kan proberen — voorkomt de omweg via Materiaal › Voorraad.
  app.post('/api/nakijk-regels/:id/voorraadrij-aanmaken',(req,res)=>{
    const regel=get('SELECT * FROM nakijk_regels WHERE id=?',[req.params.id]);
    if(!regel)return res.status(404).json({error:'Regel niet gevonden'});
    const sessie=get('SELECT * FROM nakijk_sessies WHERE id=?',[regel.sessie_id]);
    const bak=sessie&&sessie.thema_bak_id?get('SELECT * FROM bakken WHERE id=?',[sessie.thema_bak_id]):null;
    const bakItem=regel.item_id?get('SELECT * FROM bak_items WHERE id=?',[regel.item_id]):null;
    const itemTypeId=bakItem?bakItem.item_type_id:null;
    if(!itemTypeId)return res.status(400).json({error:'Geen catalogus-item gekoppeld aan dit item.'});
    if(!bak||!bak.thuislocatie_id)return res.status(400).json({error:'Deze bak heeft geen thuislocatie ingesteld.'});
    const bestaand=get('SELECT * FROM item_type_stock WHERE item_type_id=? AND locatie_id=?',[itemTypeId,bak.thuislocatie_id]);
    if(bestaand)return res.json(bestaand);
    const id=ins('INSERT INTO item_type_stock (item_type_id,locatie_id,qty,minimum) VALUES (?,?,0,0)',[itemTypeId,bak.thuislocatie_id]);
    saveDb();
    res.json(get('SELECT * FROM item_type_stock WHERE id=?',[id]));
  });
  // S6.1(a): kantoor markeert een tekortregel als "besteld, wacht op levering" — nog niet
  // aangevuld/afgeboekt, maar wel uit de "nog te behandelen"-lijst zodra de sessie afgesloten wordt.
  app.post('/api/nakijk-regels/:id/besteld',(req,res)=>{
    const regel=get('SELECT * FROM nakijk_regels WHERE id=?',[req.params.id]);
    if(!regel)return res.status(404).json({error:'Regel niet gevonden'});
    run("UPDATE nakijk_regels SET tekort_status='besteld' WHERE id=?",[regel.id]);
    saveDb();
    res.json(get('SELECT * FROM nakijk_regels WHERE id=?',[regel.id]));
  });
  // Negeren: kantoor beslist bewust dit tekort niet aan te vullen (bv. item vervalt).
  app.post('/api/nakijk-regels/:id/genegeerd',(req,res)=>{
    const regel=get('SELECT * FROM nakijk_regels WHERE id=?',[req.params.id]);
    if(!regel)return res.status(404).json({error:'Regel niet gevonden'});
    run("UPDATE nakijk_regels SET tekort_status='genegeerd' WHERE id=?",[regel.id]);
    saveDb();
    res.json(get('SELECT * FROM nakijk_regels WHERE id=?',[regel.id]));
  });
  // Markeer een controle als volledig verwerkt (alle tekorten aangevuld / kapot-meldingen bekeken).
  // S6.1(c): mag pas als élke tekortregel aangevuld OF expliciet besteld/genegeerd is.
  app.put('/api/nakijk-sessies/:id/verwerkt',(req,res)=>{
    const sessie=get('SELECT * FROM nakijk_sessies WHERE id=?',[req.params.id]);
    if(!sessie)return res.status(404).json({error:'Sessie niet gevonden'});
    const regels=all('SELECT * FROM nakijk_regels WHERE sessie_id=?',[req.params.id]);
    const openTekorten=regels.filter(r=>(r.aangetroffen||0)<(r.verwacht||0)&&!['aangevuld','genegeerd','besteld'].includes(r.tekort_status));
    if(openTekorten.length)return res.status(400).json({error:`Nog ${openTekorten.length} tekortregel(s) niet aangevuld, besteld of genegeerd: ${openTekorten.map(r=>r.item_naam).join(', ')}`});
    const behandelaar=(req.persoon&&req.persoon.naam)||'';
    run("UPDATE nakijk_sessies SET kantoor_status='verwerkt',kantoor_wie=?,kantoor_tijdstip=? WHERE id=?",[behandelaar,now(),req.params.id]);
    saveDb();
    res.json(get('SELECT * FROM nakijk_sessies WHERE id=?',[req.params.id]));
  });

  // ── S6.2: KANTOOR-TEKORTENDASHBOARD — alle open tekorten geaggregeerd per item_type,
  // over alle ingediende sessies (ongeacht kantoor_status), met voorraadstand/minimum en
  // per-bak/locatie-herkomst uitklapbaar. "Thema al gebruikt" = er bestaat al een nakijk_sessie
  // voor een thema_bak van dat thema (los van de huidige sessie) → KV-data is startpunt.
  app.get('/api/tekorten-dashboard',(req,res)=>{
    const sessies=all("SELECT * FROM nakijk_sessies WHERE kv_status='ingediend'");
    const regels=all('SELECT * FROM nakijk_regels');
    const perType={};
    sessies.forEach(s=>{
      const bak=s.thema_bak_id?get('SELECT * FROM bakken WHERE id=?',[s.thema_bak_id]):null;
      const loc=s.locatie_id?get('SELECT name FROM locaties WHERE id=?',[s.locatie_id]):null;
      const themaId=bak?(get('SELECT thema_id FROM thema_bak WHERE bak_id=?',[bak.id])||{}).thema_id:null;
      const thema=themaId?get('SELECT * FROM themas WHERE id=?',[themaId]):null;
      regels.filter(r=>r.sessie_id===s.id).forEach(r=>{
        const tekort=(r.verwacht||0)-(r.aangetroffen||0);
        if(tekort<=0)return;
        if(['aangevuld','genegeerd'].includes(r.tekort_status))return;
        const bakItem=r.item_id?get('SELECT item_type_id FROM bak_items WHERE id=?',[r.item_id]):null;
        const itemTypeId=bakItem?bakItem.item_type_id:null;
        const key=itemTypeId||('naam:'+r.item_naam);
        if(!perType[key]){
          const it=itemTypeId?get('SELECT * FROM item_types WHERE id=?',[itemTypeId]):null;
          perType[key]={
            item_type_id:itemTypeId, item_naam:it?it.naam:r.item_naam,
            totaal_tekort:0, bestel_status:'open', herkomst:[], thema_signalen:new Set(),
          };
        }
        perType[key].totaal_tekort+=tekort;
        if(r.tekort_status==='besteld'&&perType[key].bestel_status==='open')perType[key].bestel_status='besteld';
        perType[key].herkomst.push({
          sessie_id:s.id, regel_id:r.id, bak_naam:bak?bak.naam:'', bak_code:bak?bak.code:'',
          locatie_naam:loc?loc.name:'', week:s.week, tekort, tekort_status:r.tekort_status,
        });
        if(thema){
          // "thema al gebruikt": bestaan er nog andere (afgeronde) sessies voor ditzelfde thema?
          const anderTellingen=(get(`SELECT COUNT(*) as n FROM nakijk_sessies ns2 JOIN thema_bak tb2 ON tb2.bak_id=ns2.thema_bak_id
            WHERE tb2.thema_id=? AND ns2.id!=?`,[themaId,s.id])||{}).n||0;
          if(anderTellingen>0)perType[key].thema_signalen.add(thema.name);
        }
      });
    });
    const stockPerType={};
    all('SELECT item_type_id,SUM(qty) AS qty,SUM(minimum) AS minimum FROM item_type_stock GROUP BY item_type_id')
      .forEach(r=>{stockPerType[r.item_type_id]={qty:r.qty||0,minimum:r.minimum||0};});
    const out=Object.values(perType).map(v=>({
      item_type_id:v.item_type_id,
      item_naam:v.item_naam,
      totaal_tekort:v.totaal_tekort,
      voorraadstand:v.item_type_id?(stockPerType[v.item_type_id]?.qty||0):null,
      minimum:v.item_type_id?(stockPerType[v.item_type_id]?.minimum||0):null,
      bestel_status:v.bestel_status,
      herkomst:v.herkomst,
      thema_al_gebruikt:[...v.thema_signalen],
    })).sort((a,b)=>b.totaal_tekort-a.totaal_tekort);
    res.json(out);
  });

  // ── SPORT MATERIAAL ──
  app.get('/api/sport', (req,res) => {
    const items = all('SELECT si.*, l.name as locatie_name FROM sport_items si LEFT JOIN locaties l ON l.id=si.locatie_id ORDER BY si.cat, si.name');
    const sets = all('SELECT ss.*, l.name as locatie_name FROM sport_sets ss LEFT JOIN locaties l ON l.id=ss.locatie_id ORDER BY ss.item_id, ss.label');
    const planning = all('SELECT sp.*, l.name as locatie_name FROM sport_planning sp LEFT JOIN locaties l ON l.id=sp.locatie_id');
    res.json(items.map(item => ({
      ...item,
      sets: sets.filter(s => s.item_id === item.id).map(s => ({
        ...s,
        planning: planning.filter(p => p.set_id === s.id)
      }))
    })));
  });

  app.post('/api/sport', (req,res) => {
    const {name, cat, notities, stockage_locatie_id, locatie_id} = req.body;
    if (!name) return res.status(400).json({error: 'Naam vereist'});
    const item_type_id=resolveItemTypeId(name,'sport');
    const id = ins('INSERT INTO sport_items (name,cat,notities,stockage_locatie_id,locatie_id,item_type_id) VALUES (?,?,?,?,?,?)', [name, cat||'sport', notities||'', stockage_locatie_id||null, locatie_id||null, item_type_id]);
    res.json({...get('SELECT si.*, l.name as locatie_name FROM sport_items si LEFT JOIN locaties l ON l.id=si.locatie_id WHERE si.id=?', [id]), sets: []});
  });
  app.put('/api/sport/:id', (req,res) => {
    const {name,cat,notities,stockage_locatie_id,locatie_id} = req.body;
    const cur=get('SELECT * FROM sport_items WHERE id=?',[req.params.id]);
    const item_type_id=name&&name!==cur?.name?resolveItemTypeId(name,'sport'):cur?.item_type_id;
    run('UPDATE sport_items SET name=?,cat=?,notities=?,stockage_locatie_id=?,locatie_id=?,item_type_id=? WHERE id=?', [name,cat||'sport',notities||'',stockage_locatie_id||null,locatie_id||null,item_type_id,req.params.id]);
    res.json(get('SELECT si.*, l.name as locatie_name FROM sport_items si LEFT JOIN locaties l ON l.id=si.locatie_id WHERE si.id=?', [req.params.id]));
  });
  app.delete('/api/sport/:id', (req,res) => {
    const sets = all('SELECT id FROM sport_sets WHERE item_id=?', [req.params.id]);
    sets.forEach(s => run('DELETE FROM sport_planning WHERE set_id=?', [s.id]));
    run('DELETE FROM sport_sets WHERE item_id=?', [req.params.id]);
    run('DELETE FROM sport_items WHERE id=?', [req.params.id]);
    saveDb(); res.json({ok:true});
  });

  // Sport sets
  app.post('/api/sport/:id/sets', (req,res) => {
    const {label, locatie_id} = req.body;
    if (!label) return res.status(400).json({error: 'Label vereist'});
    const id = ins('INSERT INTO sport_sets (item_id,label,locatie_id) VALUES (?,?,?)', [req.params.id, label, locatie_id||null]);
    saveDb();
    res.json({...get('SELECT ss.*, l.name as locatie_name FROM sport_sets ss LEFT JOIN locaties l ON l.id=ss.locatie_id WHERE ss.id=?', [id]), planning:[]});
  });
  app.put('/api/sport/sets/:id', (req,res) => {
    const {label, locatie_id} = req.body;
    run('UPDATE sport_sets SET label=?,locatie_id=? WHERE id=?', [label, locatie_id||null, req.params.id]);
    saveDb();
    res.json(get('SELECT ss.*, l.name as locatie_name FROM sport_sets ss LEFT JOIN locaties l ON l.id=ss.locatie_id WHERE ss.id=?', [req.params.id]));
  });
  app.delete('/api/sport/sets/:id', (req,res) => {
    run('DELETE FROM sport_planning WHERE set_id=?', [req.params.id]);
    run('DELETE FROM sport_sets WHERE id=?', [req.params.id]);
    saveDb(); res.json({ok:true});
  });

  // Sport planning (which set is where which week)
  app.post('/api/sport/sets/:id/plan', (req,res) => {
    const {week, locatie_id} = req.body;
    const setInfo=get('SELECT ss.*,si.name as item_naam FROM sport_sets ss LEFT JOIN sport_items si ON si.id=ss.item_id WHERE ss.id=?',[req.params.id]);
    if (locatie_id === null || locatie_id === undefined || locatie_id === '') {
      run('DELETE FROM sport_planning WHERE set_id=? AND week=?', [req.params.id, week]);
      if(setInfo) logAct('sport','verplaatst',`${setInfo.item_naam||'Set'} "${setInfo.label}" — week ${week}: locatie vrijgemaakt`,null,null);
    } else {
      run('INSERT OR REPLACE INTO sport_planning (set_id,locatie_id,week) VALUES (?,?,?)', [req.params.id, locatie_id, week]);
      const loc=get('SELECT name FROM locaties WHERE id=?',[locatie_id]);
      if(setInfo) logAct('sport','verplaatst',`${setInfo.item_naam||'Set'} "${setInfo.label}" → ${loc?.name||'?'} (week ${week})`,locatie_id,loc?.name);
    }
    saveDb(); res.json({ok:true});
  });

  // ── FOTO PER SPORT ITEM ──
  app.post('/api/sport/:id/foto',(req,res)=>{
    const{data,ext}=req.body;
    if(!data)return res.status(400).json({error:'Geen afbeeldingsdata'});
    const item=get('SELECT * FROM sport_items WHERE id=?',[req.params.id]);
    if(!item)return res.status(404).json({error:'Artikel niet gevonden'});
    // Verwijder oude foto
    if(item.foto_path){try{fs.unlinkSync(path.join(UPLOADS_DIR,item.foto_path));}catch(e){}}
    const filename=`sport-${req.params.id}-${Date.now()}.${ext||'jpg'}`;
    try{fs.writeFileSync(path.join(UPLOADS_DIR,filename),Buffer.from(data,'base64'));}
    catch(e){return res.status(500).json({error:'Opslaan mislukt: '+e.message});}
    run('UPDATE sport_items SET foto_path=? WHERE id=?',[filename,req.params.id]);
    logAct('sport','foto',`Foto toegevoegd aan "${item.name}"`,null,null);
    res.json({foto_path:filename});
  });
  app.delete('/api/sport/:id/foto',(req,res)=>{
    const item=get('SELECT * FROM sport_items WHERE id=?',[req.params.id]);
    if(item?.foto_path){try{fs.unlinkSync(path.join(UPLOADS_DIR,item.foto_path));}catch(e){}}
    run('UPDATE sport_items SET foto_path=? WHERE id=?',['',req.params.id]);
    res.json({ok:true});
  });

  // ── TERUGKOMST ──
  app.post('/api/terugkomst',(req,res)=>{
    const{kampmoment_id,datum,notities,regels}=req.body;
    if(!kampmoment_id)return res.status(400).json({error:'kampmoment_id vereist'});
    const rid=ins('INSERT INTO terugkomst_rapporten (kampmoment_id,datum,notities,created_at) VALUES (?,?,?,?)',
      [kampmoment_id,datum||isoDate(new Date()),notities||'',now()]);
    (regels||[]).forEach(r=>{
      db.run('INSERT INTO terugkomst_regels (rapport_id,item_naam,set_id,status,opmerking) VALUES (?,?,?,?,?)',
        [rid,r.item_naam,r.set_id||null,r.status||'ok',r.opmerking||'']);
    });
    // Update sportset-locatie naar eigen stockage_locatie_id (of globale sport-stockage als fallback)
    const defaultSportStockage=get("SELECT id FROM locaties WHERE type='stockage' AND (stockage_rol='sport' OR stockage_rol='beide') ORDER BY id LIMIT 1");
    (regels||[]).filter(r=>r.set_id).forEach(r=>{
      // Gebruik de stockage_locatie_id van het sport_item; fallback naar globale sport-stockage
      const setItem=get('SELECT si.stockage_locatie_id FROM sport_sets ss LEFT JOIN sport_items si ON si.id=ss.item_id WHERE ss.id=?',[r.set_id]);
      const homeId=(setItem&&setItem.stockage_locatie_id)||defaultSportStockage?.id;
      if(homeId) run('UPDATE sport_sets SET locatie_id=? WHERE id=?',[homeId,r.set_id]);
    });
    saveDb();
    const km=get('SELECT k.*,l.name as loc_naam FROM kampmomenten k LEFT JOIN locaties l ON l.id=k.locatie_id WHERE k.id=?',[kampmoment_id]);
    const schade=(regels||[]).filter(r=>r.status==='schade').length;
    const vermist=(regels||[]).filter(r=>r.status==='vermist').length;
    const extra=[schade?`${schade} beschadigd`:'',vermist?`${vermist} vermist`:''].filter(Boolean).join(', ');
    logAct('terugkomst','aangemaakt',
      `Terugkomst ${km?.loc_naam||'?'} week ${km?.week||'?'}`+(extra?` — ${extra}`:''),
      km?.locatie_id,km?.loc_naam);
    res.json(get('SELECT * FROM terugkomst_rapporten WHERE id=?',[rid]));
  });
  app.get('/api/terugkomst',(req,res)=>{
    const rapp=all('SELECT r.*,l.name as loc_naam FROM terugkomst_rapporten r LEFT JOIN kampmomenten k ON k.id=r.kampmoment_id LEFT JOIN locaties l ON l.id=k.locatie_id ORDER BY r.id DESC');
    res.json(rapp.map(r=>({...r,regels:all('SELECT * FROM terugkomst_regels WHERE rapport_id=?',[r.id])})));
  });

  // ── ACTIVITEITENLOG ──
  app.get('/api/log',(req,res)=>{
    const {locatie_id, type, limit=200}=req.query;
    const conditions=[];const params=[];
    if(locatie_id){conditions.push('locatie_id=?');params.push(parseInt(locatie_id));}
    if(type&&type!=='alle'){conditions.push('type=?');params.push(type);}
    let sql='SELECT * FROM activiteiten_log';
    if(conditions.length) sql+=' WHERE '+conditions.join(' AND ');
    sql+=' ORDER BY id DESC LIMIT ?';
    params.push(Math.min(parseInt(limit)||200,500));
    res.json(all(sql,params));
  });

  // ── GEDEELD MATERIAAL ──
  // Zorg dat een gedeeld item per-locatie voorraad heeft; bij ontbreken staat alles op thuis-stockage
  function ensureGedeeldStock(item){
    const rows=all('SELECT * FROM gedeeld_stock WHERE gedeeld_id=?',[item.id]);
    if(!rows.length && item.stockage_locatie_id && (item.totaal||0)>0){
      run('INSERT OR IGNORE INTO gedeeld_stock(gedeeld_id,locatie_id,qty) VALUES(?,?,?)',[item.id,item.stockage_locatie_id,item.totaal]);
      return all('SELECT * FROM gedeeld_stock WHERE gedeeld_id=?',[item.id]);
    }
    return rows;
  }
  app.get('/api/gedeeld', (req,res) => {
    const items = all('SELECT * FROM gedeeld_items ORDER BY cat, name');
    const gebruik = all('SELECT gg.*, t.name as thema_name FROM gedeeld_gebruik gg LEFT JOIN themas t ON t.id=gg.thema_id');
    // Calculate conflicts per week: for each week, sum qty needed across all themas active that week
    const kts = all('SELECT * FROM kampmoment_themas');
    const kms = all('SELECT * FROM kampmomenten');
    const locs = all('SELECT id,name,type FROM locaties');
    res.json(items.map(item => {
      const g = gebruik.filter(u => u.item_id === item.id);
      // Per week: which themas are active, how many of this item needed
      const weekConflicts = {};
      for (let week = 1; week <= 9; week++) {
        const activeKms = kms.filter(km => km.week === week);
        const activeThemas = new Set(kts.filter(kt => activeKms.some(km => km.id === kt.kampmoment_id)).map(kt => kt.thema_id));
        const needed = g.filter(u => activeThemas.has(u.thema_id)).reduce((sum, u) => sum + u.qty, 0);
        if (needed > 0) weekConflicts[week] = {needed, alarm: needed > item.totaal};
      }
      const stock = ensureGedeeldStock(item).map(s=>({...s,locatie_name:(locs.find(l=>l.id===s.locatie_id)||{}).name||'?'}));
      return {...item, gebruik: g, weekConflicts, stock};
    }));
  });
  // Voorraad per locatie zetten voor een gedeeld item
  app.post('/api/gedeeld/:id/stock', (req,res) => {
    const {locatie_id, qty} = req.body;
    if(!locatie_id) return res.status(400).json({error:'Locatie vereist'});
    run('INSERT OR REPLACE INTO gedeeld_stock(gedeeld_id,locatie_id,qty) VALUES(?,?,?)',[req.params.id,locatie_id,Math.max(0,qty||0)]);
    saveDb();
    res.json(get('SELECT * FROM gedeeld_stock WHERE gedeeld_id=? AND locatie_id=?',[req.params.id,locatie_id]));
  });

  app.post('/api/gedeeld', (req,res) => {
    const {name, cat, totaal, notities, stockage_locatie_id} = req.body;
    if (!name) return res.status(400).json({error: 'Naam vereist'});
    const item_type_id=resolveItemTypeId(name,'gedeeld');
    const id = ins('INSERT INTO gedeeld_items (name,cat,totaal,notities,stockage_locatie_id,item_type_id) VALUES (?,?,?,?,?,?)', [name, cat||'gedeeld', totaal||1, notities||'', stockage_locatie_id||null, item_type_id]);
    res.json({...get('SELECT * FROM gedeeld_items WHERE id=?', [id]), gebruik: [], weekConflicts: {}});
  });
  app.put('/api/gedeeld/:id', (req,res) => {
    const {name,cat,totaal,notities,stockage_locatie_id} = req.body;
    const cur=get('SELECT * FROM gedeeld_items WHERE id=?',[req.params.id]);
    const item_type_id=name&&name!==cur?.name?resolveItemTypeId(name,'gedeeld'):cur?.item_type_id;
    run('UPDATE gedeeld_items SET name=?,cat=?,totaal=?,notities=?,stockage_locatie_id=?,item_type_id=? WHERE id=?', [name,cat||'gedeeld',totaal||1,notities||'',stockage_locatie_id||null,item_type_id,req.params.id]);
    saveDb(); res.json(get('SELECT * FROM gedeeld_items WHERE id=?', [req.params.id]));
  });
  app.delete('/api/gedeeld/:id', (req,res) => {
    run('DELETE FROM gedeeld_gebruik WHERE item_id=?', [req.params.id]);
    run('DELETE FROM gedeeld_stock WHERE gedeeld_id=?', [req.params.id]);
    run('DELETE FROM gedeeld_items WHERE id=?', [req.params.id]);
    saveDb(); res.json({ok:true});
  });

  // Gedeeld gebruik per thema
  app.post('/api/gedeeld/:id/gebruik', (req,res) => {
    const {thema_id, qty} = req.body;
    run('INSERT OR REPLACE INTO gedeeld_gebruik (item_id,thema_id,qty) VALUES (?,?,?)', [req.params.id, thema_id, qty||1]);
    saveDb();
    res.json(get('SELECT gg.*, t.name as thema_name FROM gedeeld_gebruik gg LEFT JOIN themas t ON t.id=gg.thema_id WHERE gg.item_id=? AND gg.thema_id=?', [req.params.id, thema_id]));
  });
  app.delete('/api/gedeeld/:id/gebruik/:thema_id', (req,res) => {
    run('DELETE FROM gedeeld_gebruik WHERE item_id=? AND thema_id=?', [req.params.id, req.params.thema_id]);
    saveDb(); res.json({ok:true});
  });

  // ── SPOEDTRANSPORT ──
  // Maakt een dringend transport. Voorraad wordt pas aangepast bij status "gedaan".
  app.post('/api/spoedtransport',(req,res)=>{
    const {datum,tijd,van_locatie_id,naar_locatie_id,item,qty,kind,ref_id} = req.body;
    const naam=(item||'').trim();
    if(!naam) return res.status(400).json({error:'Item is verplicht'});
    const aantal=Math.max(1,parseInt(qty)||1);
    const ts=now();
    const spoedDatum=datum||isoDate(new Date());
    // Eigen 1-op-1 rit zodat spoed uniform op de weekplanner verschijnt
    const ritId=ins('INSERT INTO transport_ritten (datum,chauffeur,opmerking,status,created_at) VALUES (?,?,?,?,?)',
      [spoedDatum,'','Spoedtransport','gepland',ts]);
    // spoed_effect_toegepast=0: wordt pas verwerkt wanneer status → "gedaan"
    const taakId=ins(
      'INSERT INTO transport_taken (type,datum,tijd,van_locatie_id,naar_locatie_id,opmerking,wie,status,created_at,spoed_kind,spoed_ref_id,spoed_effect_toegepast,rit_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      ['extra',spoedDatum,tijd||'09:00',van_locatie_id||null,naar_locatie_id||null,'🚨 Spoed: '+naam,'','gepland',ts,kind||'',ref_id||0,0,ritId]);
    ins('INSERT INTO transport_regels (taak_id,naam,qty,soort,item_type_id) VALUES (?,?,?,?,?)',[taakId,naam,aantal,'spoed',resolveItemTypeId(naam)]);
    saveDb();
    res.json(get('SELECT * FROM transport_taken WHERE id=?',[taakId]));
  });

  // Helper: pas spoed-voorraadeffect toe voor één transport
  function _pasSpoedEffectToe(taak) {
    if(!taak||taak.spoed_effect_toegepast||!taak.spoed_kind)return;
    const kind=taak.spoed_kind;
    const ref_id=taak.spoed_ref_id;
    const van=taak.van_locatie_id;
    const naar=taak.naar_locatie_id;
    const regels=all('SELECT * FROM transport_regels WHERE taak_id=? AND soort=\'spoed\'',[taak.id]);
    const aantal=regels.reduce((s,r)=>s+(parseInt(r.qty)||1),0)||1;
    if(kind==='verbruik'&&ref_id&&van){
      run('INSERT OR IGNORE INTO verbruik_stock(item_id,locatie_id,qty,minimum,eenheid) VALUES(?,?,0,0,\'stuks\')',[ref_id,van]);
      run('UPDATE verbruik_stock SET qty=MAX(0,qty-?) WHERE item_id=? AND locatie_id=?',[aantal,ref_id,van]);
      ins('INSERT INTO verbruik_log(item_id,locatie_id,delta,reden,wie,transport_id,datum,created_at) VALUES(?,?,?,?,?,?,?,?)',
        [ref_id,van,-aantal,'Spoedtransport (gedaan)','',taak.id,isoDate(new Date()),new Date().toISOString()]);
    } else if(kind==='gedeeld'&&ref_id){
      const gi=get('SELECT * FROM gedeeld_items WHERE id=?',[ref_id]);
      if(gi) ensureGedeeldStock(gi);
      if(van){
        run('INSERT OR IGNORE INTO gedeeld_stock(gedeeld_id,locatie_id,qty) VALUES(?,?,0)',[ref_id,van]);
        run('UPDATE gedeeld_stock SET qty=MAX(0,qty-?) WHERE gedeeld_id=? AND locatie_id=?',[aantal,ref_id,van]);
      }
      if(naar){
        run('INSERT OR IGNORE INTO gedeeld_stock(gedeeld_id,locatie_id,qty) VALUES(?,?,0)',[ref_id,naar]);
        run('UPDATE gedeeld_stock SET qty=qty+? WHERE gedeeld_id=? AND locatie_id=?',[aantal,ref_id,naar]);
      }
    }
    run('UPDATE transport_taken SET spoed_effect_toegepast=1 WHERE id=?',[taak.id]);
  }

  // ── CATALOGUS ITEM DETAIL ──
  app.get('/api/catalogus-item/:type/:id',(req,res)=>{
    const{type,id}=req.params;
    let item=null,extra={};
    if(type==='sport'){
      item=get('SELECT * FROM sport_items WHERE id=?',[id]);
      if(item){
        extra.sets=all('SELECT ss.*,l.name AS loc_naam FROM sport_sets ss LEFT JOIN locaties l ON ss.locatie_id=l.id WHERE ss.item_id=? ORDER BY ss.label',[id]);
      }
    } else if(type==='gedeeld'){
      item=get('SELECT * FROM gedeeld_items WHERE id=?',[id]);
      if(item){
        extra.stock=all('SELECT gs.*,l.name AS locatie_name FROM gedeeld_stock gs JOIN locaties l ON gs.locatie_id=l.id WHERE gs.gedeeld_id=? ORDER BY l.name',[id]);
      }
    } else if(type==='verbruik'){
      item=get('SELECT * FROM materiaal_items WHERE id=? AND tracking=?',[id,'verbruik']);
      if(item){
        extra.stock=all('SELECT vs.*,l.name AS locatie_name FROM verbruik_stock vs JOIN locaties l ON vs.locatie_id=l.id WHERE vs.item_id=? ORDER BY l.name',[id]);
        extra.log=all('SELECT vl.*,l.name AS loc_naam FROM verbruik_log vl LEFT JOIN locaties l ON vl.locatie_id=l.id WHERE vl.item_id=? ORDER BY vl.created_at DESC LIMIT 20',[id]);
      }
    }
    if(!item)return res.status(404).json({error:'Item niet gevonden'});
    // Transport check historiek op naam
    const naam=item.name||item.naam||'';
    extra.checks=naam?all(`
      SELECT vc.*,r.datum AS rit_datum,r.chauffeur,r.voertuig,
        GROUP_CONCAT(DISTINCT l.name) AS locaties
      FROM verhuis_checks vc
      JOIN transport_ritten r ON vc.rit_id=r.id
      LEFT JOIN transport_taken tt ON tt.rit_id=r.id
      LEFT JOIN locaties l ON (tt.van_locatie_id=l.id OR tt.naar_locatie_id=l.id)
      WHERE LOWER(vc.item_naam)=LOWER(?)
      GROUP BY vc.id ORDER BY r.datum DESC LIMIT 30
    `,[naam]):[];
    // Activiteiten log
    extra.activiteit=all(`SELECT * FROM activiteiten_log WHERE beschrijving LIKE ? ORDER BY id DESC LIMIT 10`,['%'+naam+'%']);
    res.json({...item,type,...extra});
  });

  // ── PWA ──
  app.get('/sw.js',(req,res)=>{
    res.setHeader('Content-Type','application/javascript');
    res.send(`const CACHE='sporty-v3';const SHELL=['/'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  if(e.request.url.includes('/api/')||e.request.url.includes('/rit/')){
    e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
  } else {
    e.respondWith(fetch(e.request).then(res=>{const clone=res.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));return res;}).catch(()=>caches.match(e.request)));
  }
});`);
  });
  app.get('/manifest.json',(req,res)=>{res.json({name:'Sporty Logistics',short_name:'Sporty',start_url:'/',display:'standalone',background_color:'#ffffff',theme_color:'#2563eb',icons:[{src:'/favicon.ico',sizes:'64x64',type:'image/x-icon'}]});});

  // ── CHAUFFEUR-VIEW ──
  app.post('/api/ritten/:id/token',(req,res)=>{
    const rit=get('SELECT * FROM transport_ritten WHERE id=?',[req.params.id]);
    if(!rit)return res.status(404).json({error:'Rit niet gevonden'});
    let tok=rit.rit_token;
    if(!tok){tok=_genToken(10);run('UPDATE transport_ritten SET rit_token=? WHERE id=?',[tok,req.params.id]);saveDb();}
    res.json({token:tok,url:'/rit/'+tok});
  });
  app.get('/rit/:token',(req,res)=>{
    const rit=get('SELECT * FROM transport_ritten WHERE rit_token=?',[req.params.token]);
    if(!rit)return res.status(404).send('<h2 style="font-family:system-ui;padding:2rem">Rit niet gevonden of link verlopen.</h2>');
    const taken=all(`SELECT tt.*,fl.name AS van_naam,tl.name AS naar_naam,km.week AS km_week
      FROM transport_taken tt
      LEFT JOIN locaties fl ON tt.van_locatie_id=fl.id
      LEFT JOIN locaties tl ON tt.naar_locatie_id=tl.id
      LEFT JOIN kampmomenten km ON tt.kampmoment_id=km.id
      WHERE tt.rit_id=? ORDER BY tt.tijd`,[rit.id]);
    const checks=all('SELECT * FROM verhuis_checks WHERE rit_id=? ORDER BY sort_order',[rit.id]);
    const typeIcon={levering:'📦',ophaling:'📤',transfer:'🔄'};
    const stops=taken.map(t=>`<div class="stop">
      <div class="type">${typeIcon[t.type]||'🚚'} ${t.type==='levering'?'Levering':t.type==='ophaling'?'Ophaling':'Transfer'}${t.km_week?' (week '+t.km_week+')':''}</div>
      <div class="nm">${t.opmerking||'(zonder naam)'}</div>
      <div class="rt">${t.van_naam||'Stockage'} → ${t.naar_naam||'Stockage'}</div>
      ${t.tijd?'<div class="ti">⏰ '+t.tijd+'</div>':''}</div>`).join('');
    // Chauffeur ziet bakken, geen inhoud: groepeer per rek (eerste letter van de code in de naam)
    // zodat rek per rek gelopen kan worden.
    function _rekVan(c){const m=(c.item_naam||'').match(/\(([A-Za-z])[0-9]*\)/);return m?m[1].toUpperCase():null;}
    const chkByRek={};
    checks.forEach(c=>{const r=(c.item_soort==='thema'||c.item_soort==='attribuut'||c.item_soort==='vast')?(_rekVan(c)||'Overig'):'Overig';(chkByRek[r]=chkByRek[r]||[]).push(c);});
    const rekKeys=Object.keys(chkByRek).sort((a,b)=>a==='Overig'?1:b==='Overig'?-1:a.localeCompare(b));
    // S3.6: twee vink-fases per bak/attribuut (laden bij vertrek, lossen bij aankomst).
    // Alleen thema/attribuut/vast-regels (= bakken/attributen, geen basis-materiaal) krijgen
    // de fase-knoppen — basis-materiaal blijft de oude eenvoudige status-weergave.
    const chkRows=rekKeys.map(rek=>{
      const rows=chkByRek[rek].map(c=>{
        const isBak=c.item_soort==='thema'||c.item_soort==='attribuut'||c.item_soort==='vast';
        if(!isBak){
          return `<div class="chk ${c.status}">
            <span class="ico">${c.status==='ok'?'✅':c.status==='ontbreekt'?'❌':c.status==='deels'?'⚠️':'⬜'}</span>
            <span class="nm">${c.item_naam||''}</span>
            <span class="qty">×${c.qty}</span>
            ${c.notitie?'<div class="nt">'+c.notitie+'</div>':''}</div>`;
        }
        return `<div class="chk fase" id="chk-${c.id}">
          <span class="nm">${c.item_naam||''}</span>
          <span class="qty">×${c.qty}</span>
          <div class="fasebtns">
            <button type="button" class="fbtn b-laden ${c.geladen?'done':''}" onclick="tog(${c.id},'laden')">${c.geladen?'✅ Geladen':'⬆️ Laden'}</button>
            <button type="button" class="fbtn b-lossen ${c.gelost?'done':''}" onclick="tog(${c.id},'lossen')">${c.gelost?'✅ Gelost':'⬇️ Lossen'}</button>
          </div></div>`;
      }).join('');
      return (rek!=='Overig'?`<div class="rek">📍 Rek ${rek}</div>`:'')+rows;
    }).join('');
    res.send(`<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rit ${rit.datum}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;background:#f5f5f5;color:#1a1a1a}
.hdr{background:#2563eb;color:#fff;padding:14px 16px}.hdr h1{font-size:18px;font-weight:700}.hdr .sub{font-size:13px;opacity:.8;margin-top:2px}
.sec{padding:10px 16px 4px;font-size:11px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #e5e5e5;margin-top:8px}
.stop{background:#fff;border-left:4px solid #2563eb;margin:8px 10px;border-radius:6px;padding:12px 14px}
.stop .type{font-size:11px;color:#2563eb;font-weight:700;margin-bottom:2px}
.stop .nm{font-size:15px;font-weight:600}.stop .rt{font-size:12px;color:#666;margin-top:2px}.stop .ti{font-size:12px;color:#2563eb;margin-top:4px}
.chk{background:#fff;margin:6px 10px;border-radius:6px;padding:10px 12px;display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.chk.ok{background:#f0fff4;border-left:3px solid #22c55e}.chk.ontbreekt{background:#fff1f1;border-left:3px solid #ef4444}.chk.deels{background:#fffbeb;border-left:3px solid #f59e0b}
.chk .ico{font-size:18px;flex-shrink:0}.chk .nm{flex:1;font-size:14px}.chk .qty{font-size:12px;color:#888}.chk .nt{width:100%;font-size:11px;color:#888;font-style:italic}
.chk.fase{flex-direction:column;align-items:stretch}
.chk.fase .nm{flex:none}
.fasebtns{display:flex;gap:8px;margin-top:6px;width:100%}
.fbtn{flex:1;min-height:48px;border-radius:8px;border:1.5px solid #cbd5e1;background:#fff;color:#334155;font-size:14px;font-weight:600;font-family:inherit}
.fbtn.done{background:#dcfce7;border-color:#22c55e;color:#166534}
.rek{margin:10px 10px 2px;font-size:12px;font-weight:700;color:#2563eb}
.footer{padding:20px 16px;text-align:center;font-size:12px;color:#aaa}</style></head><body>
<div class="hdr"><h1>🚚 Rit ${rit.datum}</h1>
<div class="sub">${rit.chauffeur?'👤 '+rit.chauffeur:''}${rit.voertuig?' · 🚐 '+rit.voertuig:''} · ${taken.length} stop${taken.length!==1?'s':''}</div></div>
<div class="sec">Stops</div>${stops||'<div style="padding:16px;color:#888">Geen stops gepland.</div>'}
${checks.length?'<div class="sec">Materiaallijst ('+checks.length+' items)</div>'+chkRows:''}
<div class="footer">Sporty Logistics</div>
<script>
const TOKEN=${JSON.stringify(req.params.token)};
async function tog(id,kind){
  const row=document.getElementById('chk-'+id);
  const btns=row.querySelectorAll('.fbtn');
  btns.forEach(b=>b.disabled=true);
  try{
    const r=await fetch('/api/rit-token/'+TOKEN+'/checks/'+id+'/'+kind,{method:'POST'});
    const c=await r.json();
    if(!r.ok){alert(c.error||'Fout bij opslaan');return;}
    const bl=row.querySelector('.b-laden'), bg=row.querySelector('.b-lossen');
    bl.textContent=c.geladen?'✅ Geladen':'⬆️ Laden'; bl.classList.toggle('done',!!c.geladen);
    bg.textContent=c.gelost?'✅ Gelost':'⬇️ Lossen'; bg.classList.toggle('done',!!c.gelost);
  }catch(e){alert('Netwerkfout — probeer opnieuw.');}
  finally{btns.forEach(b=>b.disabled=false);}
}
</script>
</body></html>`);
  });

  // ── S3.5: KV-SCHERM ── (bindende UI-spec: design-mockups/kv-scherm/KV-scherm.dc.html)
  // Zelfstandige mobiel-eerste pagina, geen deel van de admin-SPA — zelfde patroon als
  // /rit/:token. Alle data komt via /api/kv/:token/* (publiek, gevalideerd op kv_token).
  app.get('/kv/:token',(req,res)=>{
    const km=_kvKampmoment(req.params.token);
    if(!km)return res.status(404).send('<h2 style="font-family:system-ui;padding:2rem">Link niet gevonden of verlopen.</h2>');
    res.send(`<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>KV-scherm</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#f5f5f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a18;-webkit-font-smoothing:antialiased;padding-bottom:4px}
input,textarea,button{font-family:inherit}
input::placeholder,textarea::placeholder{color:#9a9a95}
.code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;font-weight:600;background:#f5f5f3;border:.5px solid rgba(0,0,0,.2);border-radius:5px;padding:3px 7px;flex-shrink:0}
.card{background:#fff;border:.5px solid rgba(0,0,0,.11);border-radius:12px}
.pill{font-size:11px;font-weight:600;padding:4px 9px;border-radius:999px;flex-shrink:0}
.tabpill{flex-shrink:0;font-size:12px;font-weight:500;padding:7px 12px;border-radius:999px;background:#f5f5f3;color:#6b6b67;text-decoration:none;border:none;cursor:pointer}
.tabpill.actief{background:#E1F5EE;color:#085041;font-weight:600}
.bloktitel{font-size:20px;font-weight:600;letter-spacing:-.01em}
.blokintro{font-size:13px;color:#6b6b67;margin-top:4px;line-height:1.45}
.seclabel{font-size:11px;font-weight:700;color:#6b6b67;text-transform:uppercase;letter-spacing:.06em}
.rowbtn{display:flex;align-items:center;flex-shrink:0;border:1.5px solid rgba(0,0,0,.2);border-radius:10px;background:#fff;overflow:hidden}
.rowbtn button{width:44px;height:46px;border:none;background:transparent;font-size:22px;line-height:1;color:#1a1a18;cursor:pointer}
.rowbtn input{width:46px;height:46px;border:none;background:transparent;text-align:center;font-size:17px;font-weight:600;color:#1a1a18;outline:none;padding:0}
.bigbtn{width:100%;height:50px;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer}
.textarea{width:100%;border:.5px solid rgba(0,0,0,.2);border-radius:10px;padding:12px;font-size:15px;line-height:1.45;color:#1a1a18;background:#fff;resize:none;outline:none}
</style></head><body>

<div style="position:sticky;top:0;z-index:20;background:#fff;border-bottom:.5px solid rgba(0,0,0,.11)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px">
    <div style="width:30px;height:30px;background:#1D9E75;border-radius:8px;flex-shrink:0"></div>
    <div style="flex:1;min-width:0">
      <div id="kv-kampnaam" style="font-size:15px;font-weight:600;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Laden…</div>
      <div id="kv-kvregel" style="font-size:12px;color:#6b6b67;margin-top:1px"></div>
    </div>
  </div>
  <div id="kv-tabs" style="display:flex;gap:6px;padding:0 16px 10px;overflow-x:auto"></div>
</div>

<div id="kv-blok1" style="padding:20px 16px 0"></div>
<div id="kv-blok2" style="padding:28px 16px 0;display:none"></div>
<div id="kv-blok3" style="padding:28px 16px 0;display:none"></div>
<div id="kv-blok4" style="padding:28px 16px 0;display:none"></div>
<div id="kv-blok5" style="padding:28px 16px 0;display:none"></div>
<div style="height:24px"></div>

<div id="kv-footer" style="display:none;position:sticky;bottom:0;z-index:20;background:#fff;border-top:.5px solid rgba(0,0,0,.11);padding:12px 16px calc(12px + env(safe-area-inset-bottom))">
  <div style="display:flex;align-items:center;gap:10px">
    <div style="flex:1;min-width:0">
      <div id="kv-voortgang-tekst" style="font-size:14px;font-weight:600;line-height:1.2"></div>
      <div id="kv-balk-subtekst" style="font-size:12px;color:#6b6b67;margin-top:2px"></div>
    </div>
    <button id="kv-versturen-btn" class="bigbtn" style="flex-shrink:0;width:auto;height:52px;padding:0 22px;color:#fff" onclick="verstuurControle()">Versturen</button>
  </div>
</div>

<script>
const TOKEN=${JSON.stringify(req.params.token)};
let DATA=null, ACTIEF='blok1', OPEN_BAK=null, LOCAL={}, ATTR_LOCAL={}, KAPOT_OPEN=false, KAPOT_FOTO=null, BOODSCHAP_VINK={};
let TABS=[['blok1','Wat moet er staan'],['blok2','Vrijdagcontrole'],['blok3','Iets nodig?'],['blok4','Iets kapot?']];

function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
async function kvApi(method,path,body){
  const r=await fetch('/api/kv/'+TOKEN+path,{method,headers:body!==undefined?{'Content-Type':'application/json'}:{},body:body!==undefined?JSON.stringify(body):undefined});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||'Er ging iets mis');
  return d;
}

async function init(){
  try{ DATA=await kvApi('GET','/data'); }
  catch(e){ document.body.innerHTML='<div style="padding:2rem;font-family:system-ui"><h2>Link niet gevonden of verlopen.</h2></div>'; return; }
  // S4.8: enkel een 5de tabblad "Boodschappen" tonen als dit kampmoment KV-boodschappen heeft.
  if((DATA.boodschappen||[]).length)TABS=[...TABS,['blok5','Boodschappen']];
  renderHeader();
  renderTabs();
  renderAll();
}
function renderHeader(){
  document.getElementById('kv-kampnaam').textContent=DATA.kampNaam;
  document.getElementById('kv-kvregel').textContent=(DATA.kvNaam||'—')+' · kampverantwoordelijke';
}
function renderTabs(){
  const el=document.getElementById('kv-tabs');
  el.innerHTML=TABS.map(([id,label])=>'<button class="tabpill'+(ACTIEF===id?' actief':'')+'" onclick="gaNaar(\\''+id+'\\')">'+label+'</button>').join('');
}
function gaNaar(blok){
  ACTIEF=blok;
  TABS.forEach(([id])=>{document.getElementById('kv-'+id).style.display=(id===blok)?'':'none';});
  document.getElementById('kv-footer').style.display=(blok==='blok2')?'flex':'none';
  renderTabs();
  window.scrollTo({top:0});
  renderAll();
}

// ── Voortgangsberekening (merged: lokale bewerking > laatst opgeslagen serverwaarde) ──
function waardeVan(bakId,itemId,serverVal){
  const lok=LOCAL[bakId];
  if(lok&&Object.prototype.hasOwnProperty.call(lok,itemId))return lok[itemId];
  return serverVal;
}
function attrStatusVan(attrId,serverStatus){
  return Object.prototype.hasOwnProperty.call(ATTR_LOCAL,attrId)?ATTR_LOCAL[attrId]:serverStatus;
}
function voortgang(){
  let geteld=0,tekortTotaal=0;
  (DATA.bakken||[]).forEach(b=>{
    const compleet=b.items.every(it=>typeof waardeVan(b.id,it.id,it.aangetroffen)==='number');
    if(compleet)geteld++;
    b.items.forEach(it=>{const v=waardeVan(b.id,it.id,it.aangetroffen);if(typeof v==='number'&&v<it.gewenst)tekortTotaal++;});
  });
  const attrGedaan=(DATA.attributen||[]).filter(a=>attrStatusVan(a.id,a.status)).length;
  const totBakken=(DATA.bakken||[]).length||1;
  return {geteld,tekortTotaal,attrGedaan,totAttr:(DATA.attributen||[]).length,totBakken,
    klaar:geteld===(DATA.bakken||[]).length&&attrGedaan===(DATA.attributen||[]).length};
}

function renderAll(){
  if(ACTIEF==='blok1')renderBlok1();
  if(ACTIEF==='blok2')renderBlok2();
  if(ACTIEF==='blok3')renderBlok3();
  if(ACTIEF==='blok4')renderBlok4();
  if(ACTIEF==='blok5')renderBlok5();
  if(ACTIEF==='blok2')renderFooter();
}

function renderBlok1(){
  const el=document.getElementById('kv-blok1');
  const bakRows=(DATA.bakken||[]).map(b=>'<div style="display:flex;align-items:center;gap:10px;padding:11px 14px;border-top:.5px solid rgba(0,0,0,.11)">'
    +'<span class="code">'+esc(b.code||'—')+'</span>'
    +'<div style="flex:1;min-width:0;font-size:14px">'+esc(b.naam)+'</div>'
    +'<div style="font-size:12px;color:#9a9a95;flex-shrink:0">'+b.items.length+' items</div></div>').join('');
  const attrRows=(DATA.attributen||[]).map(a=>'<div style="display:flex;align-items:center;gap:10px;padding:11px 14px;border-top:.5px solid rgba(0,0,0,.11)">'
    +'<span class="code">'+esc(a.code||'—')+'</span>'
    +'<div style="flex:1;min-width:0;font-size:14px">'+esc(a.naam)+'</div></div>').join('');
  el.innerHTML=
    '<div class="seclabel" style="margin-bottom:6px">Blok 1</div>'
    +'<div class="bloktitel">Wat moet er staan</div>'
    +'<div class="blokintro">Dit is wat de chauffeur lost op de locatie. Even nakijken of alles er staat — je hoeft hier niets in te vullen.</div>'
    +'<div class="card" style="margin-top:12px;overflow:hidden">'
    +'<div style="font-size:11px;font-weight:600;color:#6b6b67;text-transform:uppercase;letter-spacing:.05em;padding:12px 14px 8px">'+(DATA.bakken||[]).length+' bakken</div>'
    +(bakRows||'<div style="padding:11px 14px;color:#9a9a95;font-size:13px;border-top:.5px solid rgba(0,0,0,.11)">Nog geen bakken gekoppeld.</div>')
    +'</div>'
    +'<div class="card" style="margin-top:10px;overflow:hidden">'
    +'<div style="font-size:11px;font-weight:600;color:#6b6b67;text-transform:uppercase;letter-spacing:.05em;padding:12px 14px 8px">'+(DATA.attributen||[]).length+' attributen</div>'
    +(attrRows||'<div style="padding:11px 14px;color:#9a9a95;font-size:13px;border-top:.5px solid rgba(0,0,0,.11)">Geen attributen.</div>')
    +'</div>'
    +'<div style="font-size:12px;color:#6b6b67;margin-top:10px;line-height:1.5">Staat er iets niet? Meld het onderaan bij <strong style="font-weight:600;color:#1a1a18">Iets nodig?</strong></div>';
}

function renderBlok2(){
  const el=document.getElementById('kv-blok2');
  const v=voortgang();
  const bakHtml=(DATA.bakken||[]).map(b=>{
    const open=OPEN_BAK===b.id;
    const compleet=b.items.every(it=>typeof waardeVan(b.id,it.id,it.aangetroffen)==='number');
    const tekorten=b.items.filter(it=>{const val=waardeVan(b.id,it.id,it.aangetroffen);return typeof val==='number'&&val<it.gewenst;}).length;
    const geteldAantal=b.items.filter(it=>typeof waardeVan(b.id,it.id,it.aangetroffen)==='number').length;
    let pilTekst='Nog te tellen',pilBg='#f5f5f3',pilKleur='#6b6b67';
    if(compleet&&tekorten>0){pilTekst=tekorten+' te weinig';pilBg='#FAEEDA';pilKleur='#633806';}
    else if(compleet){pilTekst='Geteld';pilBg='#E1F5EE';pilKleur='#085041';}
    else if(geteldAantal>0){pilTekst=geteldAantal+'/'+b.items.length;pilBg='#E6F1FB';pilKleur='#0C447C';}
    const itemsHtml=open?b.items.map(it=>{
      const val=waardeVan(b.id,it.id,it.aangetroffen);
      const heeft=typeof val==='number';
      const tekort=heeft&&val<it.gewenst, teveel=heeft&&val>it.gewenst;
      let sub=it.gewenst+' gewenst',subKleur='#6b6b67';
      if(tekort){sub=(it.gewenst-val)+' te weinig · '+it.gewenst+' gewenst';subKleur='#633806';}
      else if(teveel){sub=(val-it.gewenst)+' te veel · '+it.gewenst+' gewenst';subKleur='#0C447C';}
      else if(heeft){sub='Klopt · '+it.gewenst+' gewenst';subKleur='#085041';}
      const rand=tekort?'#EF9F27':(heeft?'#5DCAA5':'rgba(0,0,0,.2)');
      const veldBg=tekort?'#FAEEDA':(heeft?'#E1F5EE':'#fff');
      return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:.5px solid rgba(0,0,0,.08)">'
        +'<div style="flex:1;min-width:0"><div style="font-size:15px;line-height:1.3">'+esc(it.naam)+'</div>'
        +'<div style="font-size:12px;margin-top:3px;color:'+subKleur+'">'+esc(sub)+'</div></div>'
        +'<div class="rowbtn" style="border-color:'+rand+';background:'+veldBg+'">'
        +'<button onclick="stel('+b.id+','+it.id+',Math.max(0,('+(heeft?val:0)+')-1))">−</button>'
        +'<input value="'+(heeft?val:'')+'" inputmode="numeric" placeholder="—" onchange="stelUitInput('+b.id+','+it.id+',this.value)">'
        +'<button onclick="stel('+b.id+','+it.id+',('+(heeft?val:0)+')+1)">+</button></div></div>';
    }).join('')+'<button class="bigbtn" style="margin-top:12px;border:.5px solid rgba(0,0,0,.2);background:#fff;color:#1a1a18" onclick="bakAfsluiten('+b.id+')">Bak afsluiten</button>':'';
    return '<div class="card" style="margin-top:10px;overflow:hidden">'
      +'<button onclick="toggleBak('+b.id+')" style="display:flex;align-items:center;gap:10px;width:100%;padding:14px;background:#fff;border:none;cursor:pointer;text-align:left;min-height:60px">'
      +'<span class="code">'+esc(b.code||'—')+'</span>'
      +'<span style="flex:1;min-width:0"><span style="display:block;font-size:15px;font-weight:500;line-height:1.25">'+esc(b.naam)+'</span>'
      +'<span style="display:block;font-size:12px;color:#6b6b67;margin-top:2px">'+b.items.length+' items</span></span>'
      +'<span class="pill" style="background:'+pilBg+';color:'+pilKleur+'">'+pilTekst+'</span>'
      +'<span style="font-size:11px;color:#9a9a95;flex-shrink:0;width:12px;text-align:center">'+(open?'▲':'▼')+'</span></button>'
      +(open?'<div style="padding:0 14px 14px;border-top:.5px solid rgba(0,0,0,.11)">'+itemsHtml+'</div>':'')
      +'</div>';
  }).join('');
  const attrHtml=(DATA.attributen||[]).map(a=>{
    const st=attrStatusVan(a.id,a.status);
    const aRand=st==='aanwezig'?'#1D9E75':'rgba(0,0,0,.15)', aBg=st==='aanwezig'?'#E1F5EE':'#fff', aKleur=st==='aanwezig'?'#085041':'#6b6b67';
    const bRand=st==='beschadigd'?'#E24B4A':'rgba(0,0,0,.15)', bBg=st==='beschadigd'?'#FCEBEB':'#fff', bKleur=st==='beschadigd'?'#791F1F':'#6b6b67';
    return '<div style="padding:12px 14px;border-bottom:.5px solid rgba(0,0,0,.08)">'
      +'<div style="display:flex;align-items:center;gap:10px"><span class="code">'+esc(a.code||'—')+'</span>'
      +'<div style="flex:1;min-width:0;font-size:15px;line-height:1.3">'+esc(a.naam)+'</div></div>'
      +'<div style="display:flex;gap:8px;margin-top:10px">'
      +'<button onclick="zetAttr('+a.id+',\\'aanwezig\\')" style="flex:1;height:46px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;border:1.5px solid '+aRand+';background:'+aBg+';color:'+aKleur+'">Aanwezig</button>'
      +'<button onclick="zetAttr('+a.id+',\\'beschadigd\\')" style="flex:1;height:46px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;border:1.5px solid '+bRand+';background:'+bBg+';color:'+bKleur+'">Beschadigd</button></div></div>';
  }).join('');
  el.innerHTML=
    '<div class="seclabel" style="margin-bottom:6px">Blok 2</div>'
    +'<div class="bloktitel">Vrijdagcontrole</div>'
    +'<div class="blokintro">Tel op vrijdag alles na wat er staat. Eén bak per keer — je werk blijft bewaard, ook als je tussendoor stopt.</div>'
    +'<div class="card" style="padding:14px;margin-top:12px">'
    +'<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">'
    +'<div style="font-size:15px;font-weight:600">'+v.geteld+' van '+v.totBakken+' bakken geteld</div>'
    +'<div style="font-size:12px;color:#6b6b67">'+(v.tekortTotaal===0?'Geen tekorten':v.tekortTotaal+(v.tekortTotaal===1?' tekort':' tekorten'))+'</div></div>'
    +'<div style="height:8px;border-radius:999px;background:#eceae4;margin-top:10px;overflow:hidden">'
    +'<div style="height:8px;border-radius:999px;background:#1D9E75;width:'+Math.round(v.geteld/v.totBakken*100)+'%"></div></div></div>'
    +bakHtml
    +'<div class="seclabel" style="margin:22px 0 8px">Attributen</div>'
    +'<div class="card" style="overflow:hidden">'+(attrHtml||'<div style="padding:12px 14px;color:#9a9a95;font-size:13px">Geen attributen.</div>')+'</div>';
}
function toggleBak(id){ OPEN_BAK=(OPEN_BAK===id)?null:id; renderBlok2(); renderFooter(); }
function stel(bakId,itemId,val){
  if(!LOCAL[bakId])LOCAL[bakId]={};
  LOCAL[bakId][itemId]=Math.max(0,val);
  renderBlok2(); renderFooter();
}
function stelUitInput(bakId,itemId,raw){
  const digits=(raw||'').replace(/[^0-9]/g,'');
  if(!LOCAL[bakId])LOCAL[bakId]={};
  if(digits==='')delete LOCAL[bakId][itemId]; else LOCAL[bakId][itemId]=Math.min(999,parseInt(digits,10));
  renderBlok2(); renderFooter();
}
async function bakAfsluiten(bakId){
  const bak=(DATA.bakken||[]).find(b=>b.id===bakId); if(!bak)return;
  const regels=bak.items.filter(it=>typeof waardeVan(bakId,it.id,it.aangetroffen)==='number')
    .map(it=>({item_id:it.id,aangetroffen:waardeVan(bakId,it.id,it.aangetroffen)}));
  try{
    await kvApi('POST','/bakken/'+bakId+'/tellen',{regels});
    bak.items.forEach(it=>{const v=waardeVan(bakId,it.id,it.aangetroffen);if(typeof v==='number')it.aangetroffen=v;});
    delete LOCAL[bakId];
    OPEN_BAK=null;
    renderBlok2(); renderFooter();
  }catch(e){ alert(e.message); }
}
async function zetAttr(attrId,klik){
  const attr=(DATA.attributen||[]).find(a=>a.id===attrId); if(!attr)return;
  const huidig=attrStatusVan(attrId,attr.status);
  const nieuw=huidig===klik?null:klik;
  ATTR_LOCAL[attrId]=nieuw;
  renderBlok2(); renderFooter();
  try{ await kvApi('POST','/attributen/'+attrId+'/status',{status:nieuw}); attr.status=nieuw; delete ATTR_LOCAL[attrId]; }
  catch(e){ alert(e.message); delete ATTR_LOCAL[attrId]; renderBlok2(); renderFooter(); }
}
function renderFooter(){
  const v=voortgang();
  document.getElementById('kv-voortgang-tekst').textContent=v.geteld+' van '+v.totBakken+' bakken geteld';
  document.getElementById('kv-balk-subtekst').textContent=v.klaar?'Alles nagekeken — klaar om te versturen':(v.attrGedaan+' van '+v.totAttr+' attributen afgevinkt');
  document.getElementById('kv-versturen-btn').style.background=v.klaar?'#1D9E75':'#9a9a95';
}
async function verstuurControle(){
  try{ await kvApi('POST','/versturen',{}); alert('Controle verstuurd. Bedankt!'); }
  catch(e){ alert(e.message); }
}

function renderBlok3(){
  const el=document.getElementById('kv-blok3');
  const rows=(DATA.aanvragen||[]).map(a=>{
    const map={nieuw:['#E6F1FB','#0C447C','Nieuw'],goedgekeurd:['#E1F5EE','#085041','Goedgekeurd'],afgewezen:['#FCEBEB','#791F1F','Afgewezen'],afgehandeld:['#f5f5f3','#6b6b67','Afgehandeld']};
    const c=map[a.status]||map.nieuw;
    return '<div class="card" style="padding:13px 14px;margin-bottom:8px">'
      +'<div style="display:flex;align-items:flex-start;gap:10px">'
      +'<div style="flex:1;min-width:0;font-size:15px;line-height:1.35">'+esc(a.tekst)+'</div>'
      +'<span class="pill" style="background:'+c[0]+';color:'+c[1]+'">'+c[2]+'</span></div>'
      +'<div style="font-size:12px;color:#9a9a95;margin-top:5px">'+esc((a.created_at||'').split(',')[0]||a.created_at||'')+'</div>'
      +(a.reden?'<div style="font-size:13px;line-height:1.45;color:#791F1F;background:#FCEBEB;border-radius:8px;padding:9px 11px;margin-top:9px">'+esc(a.reden)+'</div>':'')
      +'</div>';
  }).join('');
  el.innerHTML=
    '<div class="seclabel" style="margin-bottom:6px">Blok 3</div>'
    +'<div class="bloktitel">Iets nodig?</div>'
    +'<div class="blokintro">Vraag materiaal aan tijdens de week. Het kantoor ziet je aanvraag meteen.</div>'
    +'<div class="card" style="padding:14px;margin-top:12px">'
    +'<textarea id="kv-aanvraag-tekst" class="textarea" rows="3" placeholder="Wat heb je nodig? Bv. 10 hesjes maat S — de onze zijn te groot voor de kleuters."></textarea>'
    +'<button class="bigbtn" style="margin-top:10px;background:#1D9E75;color:#fff" onclick="verstuurAanvraag()">Aanvraag versturen</button></div>'
    +'<div class="seclabel" style="margin:20px 0 8px">Eerdere aanvragen</div>'
    +(rows||'<div style="color:#9a9a95;font-size:13px">Nog geen aanvragen.</div>');
}
async function verstuurAanvraag(){
  const ta=document.getElementById('kv-aanvraag-tekst');
  const tekst=(ta.value||'').trim(); if(!tekst)return;
  try{
    const a=await kvApi('POST','/aanvraag',{tekst});
    DATA.aanvragen.unshift(a);
    renderBlok3();
  }catch(e){ alert(e.message); }
}

function renderBlok4(){
  const el=document.getElementById('kv-blok4');
  el.innerHTML=
    '<div class="seclabel" style="margin-bottom:6px">Blok 4</div>'
    +'<div class="bloktitel">Iets kapot?</div>'
    +'<div class="blokintro">Los van de vrijdagcontrole. Meld het meteen, dan kan het kantoor vervanging klaarzetten.</div>'
    +(!KAPOT_OPEN
      ? '<button class="bigbtn" style="margin-top:12px;border:1.5px solid #F09595;background:#fff;color:#791F1F" onclick="KAPOT_OPEN=true;renderBlok4()">Kapot materiaal melden</button>'
      : '<div class="card" style="border-left:3px solid #E24B4A;padding:14px;margin-top:12px">'
        +'<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px">'
        +'<div style="font-size:15px;font-weight:600">Kapotmelding</div>'
        +'<button onclick="KAPOT_OPEN=false;renderBlok4()" style="border:none;background:transparent;font-size:20px;line-height:1;color:#6b6b67;cursor:pointer;padding:6px 8px">×</button></div>'
        +'<label style="display:block;font-size:12px;font-weight:600;color:#6b6b67;margin-bottom:6px">Wat is er kapot?</label>'
        +'<textarea id="kv-kapot-tekst" class="textarea" rows="3" placeholder="Bv. Muziekbox A01 — luidspreker kraakt, doet het niet meer op batterij."></textarea>'
        +'<label style="display:block;font-size:12px;font-weight:600;color:#6b6b67;margin:14px 0 6px">Foto</label>'
        +'<input type="file" accept="image/*" capture="environment" id="kv-kapot-file" style="display:none" onchange="kvKapotFotoGekozen(this)">'
        +'<button type="button" style="width:100%;min-height:88px;border:1.5px dashed rgba(0,0,0,.2);border-radius:10px;background:#f5f5f3;color:#6b6b67;font-size:14px;font-weight:500;cursor:pointer;padding:14px" onclick="document.getElementById(\\'kv-kapot-file\\').click()">'
        +(KAPOT_FOTO?'Foto toegevoegd — tik om een andere te nemen':'Tik om een foto te nemen')+'</button>'
        +'<button class="bigbtn" style="margin-top:12px;background:#E24B4A;color:#fff" onclick="verstuurKapot()">Melding versturen</button></div>');
}
function kvKapotFotoGekozen(inp){
  const f=inp.files&&inp.files[0]; if(!f)return;
  const reader=new FileReader();
  reader.onload=e=>{ KAPOT_FOTO=e.target.result; renderBlok4(); };
  reader.readAsDataURL(f);
}
async function verstuurKapot(){
  const ta=document.getElementById('kv-kapot-tekst');
  const tekst=(ta.value||'').trim();
  if(!tekst){alert('Vul eerst in wat er kapot is.');return;}
  try{
    await kvApi('POST','/kapot',{tekst,foto_data:KAPOT_FOTO||''});
    KAPOT_OPEN=false; KAPOT_FOTO=null;
    renderBlok4();
    alert('Kapotmelding verstuurd.');
  }catch(e){ alert(e.message); }
}

// S4.8: KV-boodschappenlijst — enkel lokaal in de sessie afvinkbaar (geen persistentie nodig).
function renderBlok5(){
  const el=document.getElementById('kv-blok5');
  const lijst=DATA.boodschappen||[];
  const gevinkt=lijst.filter(b=>BOODSCHAP_VINK[b.id]).length;
  const rijen=lijst.map(b=>{
    const aan=!!BOODSCHAP_VINK[b.id];
    return '<label style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:.5px solid rgba(0,0,0,.08);cursor:pointer">'
      +'<input type="checkbox" '+(aan?'checked':'')+' onchange="toggleBoodschap('+b.id+')" style="width:22px;height:22px;flex-shrink:0">'
      +'<span style="flex:1;font-size:15px;line-height:1.35;'+(aan?'text-decoration:line-through;color:#9a9a95':'')+'">'+esc(b.naam)+(b.qty>1?' <span style="color:#6b6b67">×'+b.qty+'</span>':'')+'</span>'
      +'</label>';
  }).join('');
  el.innerHTML=
    '<div class="seclabel" style="margin-bottom:6px">Blok 5</div>'
    +'<div class="bloktitel">Boodschappen</div>'
    +'<div class="blokintro">Verse waren die je zelf koopt voor dit thema. Afvinken helpt tijdens het winkelen — dit wordt niet bewaard.</div>'
    +'<div class="card" style="padding:14px;margin-top:12px">'
    +'<div style="font-size:13px;font-weight:600;color:#6b6b67;margin-bottom:4px">'+gevinkt+' van '+lijst.length+' afgevinkt</div>'
    +'<div>'+(rijen||'<div style="color:#9a9a95;font-size:13px">Geen boodschappen.</div>')+'</div></div>'
    +'<div style="font-size:12px;color:#6b6b67;margin-top:16px;line-height:1.5;text-align:center">Vraag een factuur: Sporty Creactief, E. Solvaystraat 2, 3010 Kessel-Lo (geen BTW-nummer)</div>';
}
function toggleBoodschap(id){ BOODSCHAP_VINK[id]=!BOODSCHAP_VINK[id]; renderBlok5(); }

init();
</script>
</body></html>`);
  });

  // ── CONFLICTENDETECTOR ──
  app.get('/api/conflicten',(req,res)=>{
    const conflicten=[];
    const locs=all('SELECT * FROM locaties');
    // 1. Zelfde thema op overlappende weken (op 2 locaties tegelijk)
    const kts=all(`SELECT kt.thema_id,kt.id AS kt_id,km.week,l.name AS loc_nm
      FROM kampmoment_themas kt JOIN kampmomenten km ON kt.kampmoment_id=km.id JOIN locaties l ON km.locatie_id=l.id`);
    const byThema={};
    kts.forEach(r=>{(byThema[r.thema_id]=byThema[r.thema_id]||[]).push(r);});
    Object.entries(byThema).forEach(([tid,rows])=>{
      for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
        if(rows[i].week===rows[j].week){
          const th=get('SELECT name FROM themas WHERE id=?',[tid]);
          conflicten.push({type:'dubbel_thema',ernst:'hoog',bericht:`Thema "${th?.name||'#'+tid}" is in week ${rows[i].week} ingepland op 2 locaties: ${rows[i].loc_nm} & ${rows[j].loc_nm}`});
        }
      }
    });
    // 2. Kampmoment zonder levering of ophaling
    const kampen=all('SELECT km.*,l.name AS loc_nm FROM kampmomenten km JOIN locaties l ON km.locatie_id=l.id');
    kampen.forEach(km=>{
      const heeftLev=get('SELECT id FROM transport_taken WHERE kampmoment_id=? AND type=?',[km.id,'levering']);
      if(!heeftLev)conflicten.push({type:'geen_levering',ernst:'midden',bericht:`Week ${km.week} — ${km.loc_nm}: nog geen levering gepland`});
      const heeftOph=get('SELECT id FROM transport_taken WHERE kampmoment_id=? AND type=?',[km.id,'ophaling']);
      if(!heeftOph)conflicten.push({type:'geen_ophaling',ernst:'laag',bericht:`Week ${km.week} — ${km.loc_nm}: nog geen ophaling gepland`});
    });
    // 3. Materiaaltekort: als 2+ themas met dezelfde item_type_id-behoefte in dezelfde week
    // draaien, kan de totale vraag de beschikbare voorraad overschrijden (via item_types-koppeling,
    // nu mogelijk dankzij Migratie 47's consolidatie van bak_items/verbruik_stock naar item_types).
    {
      const bakBehoefte=all(`SELECT tb2.thema_id, bi.item_type_id, bi.qty, it.naam AS item_naam
        FROM bak_items bi JOIN bakken b ON b.id=bi.bak_id JOIN thema_bak tb2 ON tb2.bak_id=b.id JOIN item_types it ON it.id=bi.item_type_id
        WHERE bi.item_type_id IS NOT NULL`);
      const stockPerType={};
      all(`SELECT item_type_id, SUM(qty) AS totaal FROM item_type_stock WHERE item_type_id IS NOT NULL GROUP BY item_type_id`)
        .forEach(r=>{stockPerType[r.item_type_id]=r.totaal;});
      const maxWeek48=kampen.reduce((m,k)=>Math.max(m,k.week||0),0)||0;
      for(let week=1;week<=maxWeek48;week++){
        const kmsWeek=kampen.filter(k=>k.week===week);
        if(kmsWeek.length<2)continue; // tekort kan enkel ontstaan bij overlap van 2+ locaties/thema's
        const themaIdsWeek=new Set(kts.filter(r=>kmsWeek.some(km=>km.week===r.week)).map(r=>r.thema_id));
        const perType={};
        bakBehoefte.forEach(b=>{
          if(!themaIdsWeek.has(b.thema_id))return;
          perType[b.item_type_id]=perType[b.item_type_id]||{qty:0,naam:b.item_naam};
          perType[b.item_type_id].qty+=b.qty||0;
        });
        Object.entries(perType).forEach(([typeId,info])=>{
          const stock=stockPerType[typeId]||0;
          if(stock>0&&info.qty>stock){
            conflicten.push({type:'materiaal_tekort',ernst:'hoog',
              bericht:`Week ${week}: "${info.naam}" — ${info.qty} nodig over alle kampen samen, maar ${stock} op voorraad`});
          }
        });
      }
    }
    // 4. Dubbelboeking bak/attribuut: bak/attribuut nodig voor 2 kampen in dezelfde week
    // (via thema_bak/thema_attribuut + kampmoment_themas — een bak/attribuut kan bij meerdere
    // thema's horen, dus dit is onafhankelijk van conflict #1 "dubbel thema").
    {
      const bakLinks=all(`SELECT b.id AS bak_id, b.naam, b.code, tb.thema_id FROM bakken b JOIN thema_bak tb ON tb.bak_id=b.id WHERE b.soort='thema'`);
      const attrLinks=all(`SELECT a.id AS attr_id, a.naam, a.code, ta.thema_id FROM attributen a JOIN thema_attribuut ta ON ta.attribuut_id=a.id`);
      function weekBoekingen(links, idField){
        const perWeek={};
        links.forEach(l=>{
          kts.filter(kt=>kt.thema_id===l.thema_id).forEach(kt=>{
            const key=l[idField]+'|'+kt.week;
            (perWeek[key]=perWeek[key]||{item:l,weeks:new Set()}).weeks.add(kt.loc_nm+'@'+kt.week);
          });
        });
        return perWeek;
      }
      const bakWeek=weekBoekingen(bakLinks,'bak_id');
      Object.values(bakWeek).forEach(v=>{
        if(v.weeks.size>1){
          conflicten.push({type:'dubbelboeking_bak',ernst:'hoog',
            bericht:`Bak "${v.item.naam}" (${v.item.code||'-'}) is in dezelfde week nodig op meerdere plekken: ${[...v.weeks].join(', ')}`});
        }
      });
      const attrWeek=weekBoekingen(attrLinks,'attr_id');
      Object.values(attrWeek).forEach(v=>{
        if(v.weeks.size>1){
          conflicten.push({type:'dubbelboeking_attribuut',ernst:'hoog',
            bericht:`Attribuut "${v.item.naam}" (${v.item.code||'-'}) is in dezelfde week nodig op meerdere plekken: ${[...v.weeks].join(', ')}`});
        }
      });
    }
    // 5. S5.2b "elders nodig": per week heeft een locatie volgens haar locatie_config N
    // exemplaren van vast_type T nodig, maar er zijn onvoldoende VRIJE exemplaren (status=thuis,
    // dus niet geparkeerd op een andere — al dan niet tijdelijk gesloten — locatie). Enkel
    // waarschuwen, nooit automatisch weghalen (bindende regel S5).
    {
      const weken=[...new Set(kampen.map(k=>k.week).filter(w=>w!=null))].sort((a,b)=>a-b);
      const alleVastTypes=[...new Set(all("SELECT DISTINCT vast_type FROM bakken WHERE soort='vast' AND vast_type!=''").map(r=>r.vast_type))];
      weken.forEach(week=>{
        const kmsWeek=kampen.filter(k=>k.week===week);
        alleVastTypes.forEach(vt=>{
          let nodig=0;
          kmsWeek.forEach(km=>{ nodig+=_actieveLocatieConfig(km).filter(c=>c.vast_type===vt).reduce((s,c)=>s+(c.aantal||1),0); });
          if(!nodig)return;
          const alleExemplaren=all("SELECT * FROM bakken WHERE soort='vast' AND vast_type=?",[vt]);
          const vrij=alleExemplaren.filter(b=>b.status==='thuis').length;
          if(nodig>vrij){
            const bezet=alleExemplaren.filter(b=>b.status!=='thuis');
            const waar=bezet.map(b=>{const l=locs.find(l2=>l2.id===b.huidige_locatie_id);return `${b.naam} @ ${l?.name||'onbekende locatie'}`;}).join(', ')||'-';
            conflicten.push({type:'elders_nodig_vast',ernst:'hoog',
              bericht:`Week ${week}: ${nodig}× "${vt}" nodig, maar ${vrij} vrij (van ${alleExemplaren.length} totaal) — bezet: ${waar}`});
          }
        });
      });
    }
    // 6. S5.2b "elders nodig" voor kleurenborden: totale kleurbehoefte van alle open locaties
    // die week > voorraad (kleurenborden_stock) — enkel waarschuwen.
    {
      const weken=[...new Set(kampen.map(k=>k.week).filter(w=>w!=null))].sort((a,b)=>a-b);
      const kbStockTotaal={};
      all('SELECT kleur,SUM(aantal) AS totaal FROM kleurenborden_stock GROUP BY kleur').forEach(r=>{kbStockTotaal[r.kleur]=r.totaal||0;});
      const allKleurenConflict=all('SELECT * FROM locatie_kleuren');
      weken.forEach(week=>{
        const kmsWeek=kampen.filter(k=>k.week===week);
        const behoefte={};
        kmsWeek.forEach(km=>{
          allKleurenConflict.filter(k=>k.locatie_id===km.locatie_id&&k.week===week).forEach(k=>{
            behoefte[k.kleur]=(behoefte[k.kleur]||0)+(k.aantal||0);
          });
        });
        Object.entries(behoefte).forEach(([kleur,nodig])=>{
          const voorraad=kbStockTotaal[kleur]||0;
          if(nodig>voorraad){
            conflicten.push({type:'elders_nodig_kleur',ernst:'midden',
              bericht:`Week ${week}: kleurenbord ${kleur} — ${nodig} nodig over alle open locaties samen, maar ${voorraad} op voorraad`});
          }
        });
      });
    }
    // 7. S6.3(a) "ontbrekend transport": kampmoment met thema (kampmoment_themas) of sport
    // (sport_planning op locatie+week) gepland, maar helemaal geen transporttaak (levering NÓCH
    // ophaling) aangemaakt. Los van de bestaande #2 (die ook op lege kampmomenten vuurt) — dit
    // signaal geldt enkel als er ook echt iets moet vervoerd worden.
    {
      const sportWeken=all('SELECT DISTINCT locatie_id,week FROM sport_planning');
      const kmThemaIds=all('SELECT DISTINCT kampmoment_id,thema_id FROM kampmoment_themas');
      const themaKmIds=new Set(kmThemaIds.map(r=>r.kampmoment_id));
      kampen.forEach(km=>{
        const heeftThema=themaKmIds.has(km.id);
        const heeftSport=sportWeken.some(sp=>sp.locatie_id===km.locatie_id&&sp.week===km.week);
        if(!heeftThema&&!heeftSport)return;
        // S6.3(a) uitzondering: materiaalloze thema's (uitstapkampen zoals "Op stap met Sporty",
        // "Beestenbende") hebben 0 bakken én 0 attributen — logischerwijs ook geen transport nodig.
        // Enkel skippen als ELK gekoppeld thema materiaalloos is en er ook geen sport gepland is.
        if(heeftThema&&!heeftSport){
          const themaIds=kmThemaIds.filter(r=>r.kampmoment_id===km.id).map(r=>r.thema_id);
          const alleMateriaalloos=themaIds.every(tid=>{
            const nBak=get('SELECT COUNT(*) AS n FROM thema_bak WHERE thema_id=?',[tid]).n;
            const nAttr=get('SELECT COUNT(*) AS n FROM thema_attribuut WHERE thema_id=?',[tid]).n;
            return (nBak+nAttr)===0;
          });
          if(alleMateriaalloos)return;
        }
        const heeftLev=get('SELECT id FROM transport_taken WHERE kampmoment_id=? AND type=?',[km.id,'levering']);
        const heeftOph=get('SELECT id FROM transport_taken WHERE kampmoment_id=? AND type=?',[km.id,'ophaling']);
        if(!heeftLev&&!heeftOph){
          conflicten.push({type:'ontbrekend_transport',ernst:'hoog',
            bericht:`Week ${km.week} — ${km.loc_nm}: thema/sport gepland maar geen enkele transporttaak (levering of ophaling) aangemaakt`});
        }
      });
    }
    // 8. S6.3(b) "locatieconfig onvolledig": een locatie heeft deze week een kampmoment met
    // locatieconfig-regels (bv. 2× EHBO), maar er zijn niet genoeg vrije (status='thuis')
    // exemplaren van dat vast_type om aan déze locatie te leveren.
    {
      kampen.forEach(km=>{
        _actieveLocatieConfig(km).forEach(cfg=>{
          const alleExemplaren=all("SELECT * FROM bakken WHERE soort='vast' AND vast_type=?",[cfg.vast_type]);
          const vrij=alleExemplaren.filter(b=>b.status==='thuis').length;
          if(vrij<(cfg.aantal||1)){
            conflicten.push({type:'locatieconfig_onvolledig',ernst:'hoog',
              bericht:`Week ${km.week} — ${km.loc_nm}: locatieconfig vraagt ${cfg.aantal||1}× "${cfg.vast_type}", maar slechts ${vrij} vrij exemplaar/exemplaren beschikbaar (van ${alleExemplaren.length} totaal)`});
          }
        });
      });
    }
    res.json(conflicten);
  });

  // ── SEIZOENSOVERZICHT ──
  app.get('/api/seizoensoverzicht',(req,res)=>{
    const kampen=all(`SELECT km.*,l.name AS loc_nm FROM kampmomenten km JOIN locaties l ON km.locatie_id=l.id ORDER BY km.week,l.name`);
    const themaLinks=all(`SELECT kt.kampmoment_id,t.name AS thema_nm,t.color FROM kampmoment_themas kt JOIN themas t ON kt.thema_id=t.id`);
    const themaByKm={};
    themaLinks.forEach(r=>(themaByKm[r.kampmoment_id]=themaByKm[r.kampmoment_id]||[]).push(r));
    const maxWeek=kampen.reduce((m,k)=>Math.max(m,k.week||0),0)||8;
    const locs=[...new Set(kampen.map(k=>k.loc_nm))].sort();
    const grid=locs.map(loc=>{
      const weken=[];
      for(let w=1;w<=maxWeek;w++){
        const km=kampen.find(k=>k.loc_nm===loc&&k.week===w);
        weken.push(km?{week:w,km_id:km.id,themas:themaByKm[km.id]||[]}:null);
      }
      return{loc,weken};
    });
    res.json({maxWeek,locs,grid});
  });

  // ── VOERTUIGBEZETTING ──
  app.get('/api/voertuig-bezetting',(req,res)=>{
    const ritten=all('SELECT r.*,(SELECT COUNT(*) FROM transport_taken t WHERE t.rit_id=r.id) AS tak_count FROM transport_ritten r ORDER BY r.datum');
    const byWeek={};
    ritten.forEach(r=>{
      const d=r.datum?new Date(r.datum+'T12:00:00'):null;
      const key=d?`Week ${Math.ceil((d-new Date(d.getFullYear(),0,1))/(7*24*3600*1000))} (${r.datum.substring(0,7)})`:(r.datum||'Geen datum');
      if(!byWeek[key])byWeek[key]={label:key,ritten:[]};
      byWeek[key].ritten.push(r);
    });
    res.json(Object.values(byWeek));
  });

  // ── RETOUR STATUS ──
  app.put('/api/kampmoment-themas/:id/retour',(req,res)=>{
    const{retour_status}=req.body;
    run('UPDATE kampmoment_themas SET retour_status=? WHERE id=?',[retour_status||'',req.params.id]);
    res.json(get('SELECT * FROM kampmoment_themas WHERE id=?',[req.params.id]));
  });

  // ── BAK FOTO'S ──
  app.get('/api/bakken/:id/fotos',(req,res)=>{
    res.json(all('SELECT id,bak_id,tijdstip,wie,beschrijving FROM bak_fotos WHERE bak_id=? ORDER BY id DESC LIMIT 20',[req.params.id]));
  });
  app.post('/api/bakken/:id/foto',(req,res)=>{
    const{wie,beschrijving,foto_data}=req.body;
    if(!foto_data)return res.status(400).json({error:'Geen foto data'});
    const id=ins('INSERT INTO bak_fotos (bak_id,tijdstip,wie,beschrijving,foto_data) VALUES (?,?,?,?,?)',
      [req.params.id,now(),wie||'',beschrijving||'',foto_data]);
    saveDb();res.json({ok:true,id});
  });
  app.get('/api/bak-fotos/:id',(req,res)=>{
    const f=get('SELECT * FROM bak_fotos WHERE id=?',[req.params.id]);
    if(!f)return res.status(404).json({error:'Niet gevonden'});
    res.json(f);
  });
  app.delete('/api/bak-fotos/:id',(req,res)=>{
    run('DELETE FROM bak_fotos WHERE id=?',[req.params.id]);
    saveDb();res.json({ok:true});
  });

  app.get('*',(req,res)=>res.sendFile(path.join(FRONTEND_PATH,'index.html')));

  // ── GLOBALE FOUTAFHANDELING ──
  // Vangt fouten op die in een API-route gegooid worden, zodat 1 fout
  // niet de hele server of het verzoek laat vastlopen.
  app.use((err, req, res, next) => {
    console.error('API-fout:', req.method, req.path, '-', err && err.message ? err.message : err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: 'Er ging iets mis op de server. Probeer het opnieuw.' });
  });

  app.listen(PORT,()=>console.log(`Sporty vzw logistiek draait op http://localhost:${PORT}`));
}
startServer().catch(err=>{console.error('Fatal startup error:',err);process.exit(1);});
