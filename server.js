const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const app = express();
const PORT = process.env.PORT || 3001;
// Railway: gebruik DATA_DIR env var voor persistent volume, anders lokaal
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR || __dirname;
const DB_PATH = path.join(DATA_DIR, 'sporty.db');
console.log('Database pad:', DB_PATH);
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
try { if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch(e) { console.warn('Uploads map aanmaken mislukt:', e.message); }
app.use('/uploads', express.static(UPLOADS_DIR));

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
  const _sportCount = (get('SELECT COUNT(*) as n FROM sport_items') || {}).n || 0;
  const _heeftOud = get("SELECT id FROM sport_items WHERE name='Cirkus A' OR name='Basket A'");
  if (_kantoor && _rozenweg && (_sportCount <= 15 || _heeftOud)) {
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
  const _mig21Vlag=get("SELECT naam FROM app_vlaggen WHERE naam='migratie21_klaar'");
  const _mig21Done=get("SELECT id FROM kampmomenten WHERE type='kamp' LIMIT 1");
  const _kmCount21=(get('SELECT COUNT(*) as n FROM kampmomenten')||{}).n||0;
  if(!_mig21Vlag && (!_mig21Done || _kmCount21<50)){
    try {
      // Alle afhankelijke data wissen (volgorde: children eerst)
      const _tClear=['kampmoment_themas','kampmoment_themas',
        'thema_materiaal','themas','thema_categorieen',
        'standaard_materiaal','gedeeld_gebruik','gedeeld_stock','gedeeld_items',
        'verplaatsingen','materiaal_eenheden','materiaal_items',
        'terugkomst_regels','terugkomst_rapporten','spoedmeldingen','activiteiten_log',
        'set_planning','sport_planning','sport_sets','verbruik_log','verbruik_stock'];
      _tClear.forEach(t=>{try{run(`DELETE FROM ${t}`);}catch(e){}});
      // Kampmomenten apart (na kampmoment_themas)
      try{run('DELETE FROM kampmomenten');}catch(e){}

      // Ontbrekende locaties
      const _uL=(n,a)=>{if(!get('SELECT id FROM locaties WHERE name=? AND (parent_id IS NULL OR parent_id=0)',[n]))ins('INSERT INTO locaties (name,addr,type,stockage_rol) VALUES (?,?,?,?)',[n,a||'','kamp','beide']);};
      _uL('Rotselaar','Rotselaar');_uL('Betekom','Betekom');
      _uL('Grasmus','Grasmus, Leuven');_uL('Boutersem','Boutersem');
      _uL('Gemeenteschool Bertem','Bertem');

      // Mig22 alvast hier: Verkeerspark hernomen naar Woudlucht (voor de locatie-lookup hieronder)
      const _vp22=get("SELECT id FROM locaties WHERE name='Verkeerspark Heverlee'");
      if(_vp22) run("UPDATE locaties SET name='Woudlucht' WHERE id=?",[_vp22.id]);
      // Verwijder eventueel los Woudlucht duplicaat
      const _wlDup=get("SELECT id FROM locaties WHERE name='Woudlucht' AND id!=? AND (parent_id IS NULL OR parent_id=0)",[(_vp22||{}).id||0]);
      if(_wlDup) try{run('DELETE FROM locaties WHERE id=?',[_wlDup.id]);}catch(e){}

      // Kampmomenten per locatie per week (Woudlucht = hernoemde Verkeerspark)
      const _lkm={
        'Sporthal Kessel-Lo':[1,2,3,4,5,6,7,8,9],'Abdijschool Vlierbeek':[1,2,3,4,5,6,7,8],
        'Syntra':[1,2,8,9],'Woudlucht':[2,3],'Sporthal Heverlee':[8,9],
        'Scoutslokalen Vlierbeek':[1,2,3,8,9],'De Bosstraat':[1,2,6,7,8],
        'De Waaier':[4,5,6,7,8],'De Kring':[1,2,7,8,9],'De Ark 3':[3,4,5,6],
        'De Kraal':[1,2,3,6,8],'Rotselaar':[1,2,7,8,9],'Betekom':[2,9],
        'De Wijzer Oud-Heverlee':[1,2,7,8],'De Mozaiek':[1,2,3,4,5,6,7,8,9],
        'Sportschuur':[8,9],'Grasmus':[1,2,3,4,5,6,7,8],'Terbank':[2,3,4,5,6,7,8],
        'Fablab KUL':[2,3,9],'Campus GroepT':[1],'Boutersem':[2,3,6,7,8],
        'Gemeenteschool Bertem':[9],'Klare Bron':[1,2,3,4,5,6,7,8],
      };
      const _pid21=(get('SELECT id FROM vakantieperiodes LIMIT 1')||{}).id||1;
      let _kmAan=0;
      Object.entries(_lkm).forEach(([naam,weken])=>{
        const _l=get('SELECT id FROM locaties WHERE name=? AND (parent_id IS NULL OR parent_id=0)',[naam]);
        if(!_l) return;
        weken.forEach(w=>{
          try{
            run('INSERT OR IGNORE INTO kampmomenten (locatie_id,week,type,periode_id) VALUES (?,?,?,?)',[_l.id,w,'kamp',_pid21]);
            _kmAan++;
          }catch(e){}
        });
      });
      console.log(`  Migratie 21+22: ${_kmAan} kampmomenten aangemaakt`);
    } catch(e) { console.error('  Migratie 21+22 fout (niet-fataal):', e.message); }
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
  {
    const _themas25=[
      {name:'Op schattenjacht met Zino Balino',color:'#F59E0B',leeftijdsgroep:'kleuters'},
      {name:'We slaan in het rond',color:'#EF4444',leeftijdsgroep:'kleuters'},
      {name:'Lego Legends',color:'#3B82F6',leeftijdsgroep:'lagere school'},
      {name:'Modemakers',color:'#EC4899',leeftijdsgroep:'lagere school'},
    ];
    const _upsertThema=(t)=>{
      const ex=get('SELECT id FROM themas WHERE name=?',[t.name]);
      if(ex) return ex.id;
      return ins('INSERT INTO themas (name,color,leeftijdsgroep) VALUES (?,?,?)',[t.name,t.color,t.leeftijdsgroep]);
    };
    const _abdLoc=get("SELECT id FROM locaties WHERE name='Abdijschool Vlierbeek'")||get("SELECT id FROM locaties WHERE name='Abdijschool'");
    const _km25=_abdLoc?get('SELECT id FROM kampmomenten WHERE locatie_id=? AND week=1',[_abdLoc.id]):null;
    if(_km25){
      // Eerst: verwijder duplicaten (rijen met zelfde kampmoment_id+thema_id, hou laagste id)
      try{
        db.run(`DELETE FROM kampmoment_themas WHERE id NOT IN (
          SELECT MIN(id) FROM kampmoment_themas GROUP BY kampmoment_id, thema_id
        )`);
      }catch(e){}
      // Dan: zorg dat de 4 correcte themas gekoppeld zijn
      const _kt25count=(get('SELECT COUNT(*) as n FROM kampmoment_themas WHERE kampmoment_id=?',[_km25.id])||{}).n||0;
      if(_kt25count<4){
        _themas25.forEach(t=>{
          const tid=_upsertThema(t);
          try{run('INSERT OR IGNORE INTO kampmoment_themas (kampmoment_id,thema_id) VALUES (?,?)',[_km25.id,tid]);}catch(e){}
        });
        console.log('  Migratie 25: 4 themas week 1 Abdijschool aangemaakt');
      }
    }
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
  {
    // Helper: thema ophalen of aanmaken
    const _uT=(name,kleur,lgr,type)=>{
      const ex=get('SELECT id FROM themas WHERE name=?',[name]);
      if(ex) return ex.id;
      return ins('INSERT INTO themas (name,color,leeftijdsgroep,thema_type) VALUES (?,?,?,?)',[name,kleur,lgr,type]);
    };
    // Helper: bak aanmaken (parent_id=null)
    const _uBak=(tid,label,code,locId,so)=>{
      const ex=get('SELECT id FROM thema_materiaal WHERE thema_id=? AND name=? AND parent_id IS NULL',[tid,label]);
      if(ex) return ex.id;
      return ins('INSERT INTO thema_materiaal (thema_id,name,qty,stockage_code,stockage_locatie_id,sort_order,is_verbruik) VALUES (?,?,1,?,?,?,0)',[tid,label,code||'',locId||null,so||0]);
    };
    // Helper: item in bak aanmaken (parent_id=bakId)
    const _uItem=(tid,bakId,name,qty,verbruik,so)=>{
      const ex=get('SELECT id FROM thema_materiaal WHERE thema_id=? AND parent_id=? AND name=?',[tid,bakId,name]);
      if(ex) return ex.id;
      return ins('INSERT INTO thema_materiaal (thema_id,parent_id,name,qty,sort_order,is_verbruik) VALUES (?,?,?,?,?,?)',[tid,bakId,name,qty||1,so||0,verbruik?1:0]);
    };

    const KT=4; // Kantoor id
    const RW=7; // Rozenweg id

    // ── 1001 BALLEN EN BELLEN ──
    const _bb=_uT('1001 Ballen en Bellen','#10B981','kleuters','eigen_materiaal');
    // Themabak 1/4 – N20
    const _bb1=_uBak(_bb,'Themabak 1/4','N20',KT,10);
    _uItem(_bb,_bb1,'Voetballen',10,false,1);
    _uItem(_bb,_bb1,'Basketballen',10,false,2);
    _uItem(_bb,_bb1,'Mousse balletjes',20,false,3);
    // Themabak 2/4 – H53
    const _bb2=_uBak(_bb,'Themabak 2/4','H53',KT,20);
    _uItem(_bb,_bb2,'Bubble rocket',6,false,1);
    _uItem(_bb,_bb2,'Geplastificeerde handleiding bubble rocket',2,false,2);
    _uItem(_bb,_bb2,'Kleine bellenblazers',20,false,3);
    _uItem(_bb,_bb2,'Wasteilen',3,false,4);
    _uItem(_bb,_bb2,'Waterpistolen',6,false,5);
    _uItem(_bb,_bb2,'Mouse watershooter',8,false,6);
    _uItem(_bb,_bb2,'Multiblaasring',3,false,7);
    _uItem(_bb,_bb2,'Windmolen met bellenblaas',5,false,8);
    // Themabak 3/4 – H55 (vast materiaal)
    const _bb3=_uBak(_bb,'Themabak 3/4 (vast)','H55',KT,30);
    _uItem(_bb,_bb3,'Trechters',2,false,1);
    _uItem(_bb,_bb3,'Vierkant stuk stof',1,false,2);
    _uItem(_bb,_bb3,'Plastic borden',5,false,3);
    _uItem(_bb,_bb3,'Plastic kommetjes',8,false,4);
    _uItem(_bb,_bb3,'Handleiding Bubble tennis',1,false,5);
    // Themabak 3/4 – H55 (verbruiksmateriaal)
    const _bb3v=_uBak(_bb,'Themabak 3/4 (verbruik)','H55',KT,35);
    _uItem(_bb,_bb3v,'Afwasmiddel',1,true,1);
    _uItem(_bb,_bb3v,'Glycerine',1,true,2);
    _uItem(_bb,_bb3v,'Bellenblaasmiddel (Action, 4 liter)',1,true,3);
    _uItem(_bb,_bb3v,'Rietjes',1,true,4);
    _uItem(_bb,_bb3v,'Pijpenragers (1/kind)',1,true,5);
    _uItem(_bb,_bb3v,'Kralen',1,true,6);
    _uItem(_bb,_bb3v,'Ballonnen met stokje',1,true,7);
    _uItem(_bb,_bb3v,'Papiersnippers',1,true,8);
    _uItem(_bb,_bb3v,'Pompons',1,true,9);
    _uItem(_bb,_bb3v,'Crêpepapier',1,true,10);
    // Themabak 4/4 – H57
    const _bb4=_uBak(_bb,'Themabak 4/4','H57',KT,40);
    _uItem(_bb,_bb4,'PET-fles met rietjes',3,false,1);
    _uItem(_bb,_bb4,'PET-fles met sok',3,false,2);
    _uItem(_bb,_bb4,'PET-fles (afgesneden)',3,false,3);
    _uItem(_bb,_bb4,'Katapult voor waterballonnen + waterballonnen',5,false,4);
    _uItem(_bb,_bb4,'Bubble wand',6,false,5);
    _uItem(_bb,_bb4,'Bubble tennis set',1,false,6);
    _uItem(_bb,_bb4,'Bellenblaas hout en touw',5,false,7);
    // Sportmateriaal (aparte items/zakken)
    const _bbs=_uBak(_bb,'Sportmateriaal','',KT,50);
    _uItem(_bb,_bbs,'Handbalpakket – 10 ballen (Gele zak H70)',1,false,1);
    _uItem(_bb,_bbs,'Kinball – 1 bal + pomp (LS Bak H70)',1,false,2);
    _uItem(_bb,_bbs,'Zweefbal – 3 zeefballen + pomp (LS Bak H70)',1,false,3);
    _uItem(_bb,_bbs,'Minitennis – 20 racketjes + 20 balletjes (Zwarte curver H26)',1,false,4);
    _uItem(_bb,_bbs,'Mini rugby – 10 ballen (Gele zak H70)',1,false,5);

    // ── ALICE IN WONDERLAND ──
    const _aw=_uT('Alice in Wonderland','#8B5CF6','kleuters','eigen_materiaal');
    // Decor/los
    const _awLos=_uBak(_aw,'Los decor','',KT,0);
    _uItem(_aw,_awLos,'Decor Alice in Wonderland',1,false,1);
    _uItem(_aw,_awLos,'Croquet doelen',1,false,2);
    _uItem(_aw,_awLos,'Verkleedkledij (set)',1,false,3);
    // Themabak 1/2 – N08
    const _aw1=_uBak(_aw,'Themabak 1/2','N08',KT,10);
    _uItem(_aw,_aw1,'Verkleedkledij Alice (kleedje)',1,false,1);
    _uItem(_aw,_aw1,'Verkleedkledij Konijn (broek, vest, hoed, handschoenen, horloge)',1,false,2);
    _uItem(_aw,_aw1,'Breekmes',1,false,3);
    _uItem(_aw,_aw1,'Taartstandaard',2,false,4);
    _uItem(_aw,_aw1,'Theekopjes',16,false,5);
    _uItem(_aw,_aw1,'Kleine bordjes',16,false,6);
    _uItem(_aw,_aw1,'Lepels',16,false,7);
    _uItem(_aw,_aw1,'Kannetjes',4,false,8);
    _uItem(_aw,_aw1,'Theepotten',4,false,9);
    _uItem(_aw,_aw1,'Taartschep',2,false,10);
    _uItem(_aw,_aw1,'Voorbeelden sponstaartjes',1,false,11);
    _uItem(_aw,_aw1,'Plantenspuit',6,false,12);
    _uItem(_aw,_aw1,'Kaartjes theebingo',15,false,13);
    _uItem(_aw,_aw1,'Bingokaarten theebingo',16,false,14);
    _uItem(_aw,_aw1,'Puzzels de gekke hoedenmaker',5,false,15);
    _uItem(_aw,_aw1,'Aanwijzingen de gekke hoedenmaker (10/set)',5,false,16);
    _uItem(_aw,_aw1,'Hoeden',16,false,17);
    _uItem(_aw,_aw1,'Memory kaartjes',24,false,18);
    _uItem(_aw,_aw1,'Croquet sticks',8,false,19);
    _uItem(_aw,_aw1,'Moppenkat',4,false,20);
    _uItem(_aw,_aw1,'Dierenafbeeldingen (Dieren naar de overkant)',11,false,21);
    _uItem(_aw,_aw1,'Kaartjes Wit zoekt rood',18,false,22);
    _uItem(_aw,_aw1,'Pittenzak werpspel',1,false,23);
    _uItem(_aw,_aw1,'Ringenwerpspel',1,false,24);
    _uItem(_aw,_aw1,'Blinddoeken',2,false,25);
    _uItem(_aw,_aw1,'Blikkenspel (6 blikken + 3 balletjes)',1,false,26);
    _uItem(_aw,_aw1,'Yogakaarten dobbelsteen',1,false,27);
    _uItem(_aw,_aw1,'Creatieve dobbelsteen',1,false,28);
    _uItem(_aw,_aw1,'A3 kaart yoga (Gooi en beweeg)',1,false,29);
    _uItem(_aw,_aw1,'Glimlach moppenkat',4,false,30);
    _uItem(_aw,_aw1,'Kaartjes dierengeluiden klein',18,false,31);
    _uItem(_aw,_aw1,'Kaartjes dierengeluiden groot',9,false,32);
    _uItem(_aw,_aw1,'Boekje Alice in Wonderland',1,false,33);
    _uItem(_aw,_aw1,'Flesje Drink mij',1,false,34);
    _uItem(_aw,_aw1,'Voorbeelden gekke hoeden',1,false,35);
    _uItem(_aw,_aw1,'Doos PlayMais',1,false,36);
    // Themabak 2/2 – E26 (verbruik)
    const _aw2=_uBak(_aw,'Themabak 2/2 (verbruik)','E26',KT,20);
    _uItem(_aw,_aw2,'Sponsen in verschillende kleuren/vormen (±2/kind)',1,true,1);
    _uItem(_aw,_aw2,'Foampapier in verschillende kleuren (±20 vellen)',1,true,2);
    _uItem(_aw,_aw2,'Pompons (8 zakjes)',1,true,3);
    _uItem(_aw,_aw2,'Potje glitter',1,true,4);
    _uItem(_aw,_aw2,'Knutsellijm (4 flesjes)',1,true,5);
    _uItem(_aw,_aw2,'Appelsap (4 liter)',1,true,6);
    _uItem(_aw,_aw2,'Aquarelpapier (1/kind)',1,true,7);
    _uItem(_aw,_aw2,'Theezakjes in verschillende kleuren (±70)',1,true,8);
    _uItem(_aw,_aw2,'Whiteboardstiften',10,true,9);
    _uItem(_aw,_aw2,'Wit A3 papier',32,true,10);
    _uItem(_aw,_aw2,'Doorzichtige plakband/tape',1,true,11);
    _uItem(_aw,_aw2,'Pijpenragers (±160)',1,true,12);
    _uItem(_aw,_aw2,'Stroken gekleurd papier breed (±2-3 cm)',1,true,13);
    _uItem(_aw,_aw2,'Stroken gekleurd papier smal (±1 cm)',1,true,14);
    _uItem(_aw,_aw2,'Grote kartonnen bordjes met gat',16,true,15);
    _uItem(_aw,_aw2,'Kleine kartonnen bordjes met gat',32,true,16);
    _uItem(_aw,_aw2,'Lint',1,true,17);
    _uItem(_aw,_aw2,'Wattenstaafjes',60,true,18);
    _uItem(_aw,_aw2,'Print witte rozen (1/kind)',1,true,19);
    _uItem(_aw,_aw2,'Groene velcro',1,true,20);
    _uItem(_aw,_aw2,'Rode verf (bus)',1,true,21);
    _uItem(_aw,_aw2,'Roze verf (bus)',1,true,22);
    _uItem(_aw,_aw2,'Pluimen (2 zakjes)',1,true,23);
    _uItem(_aw,_aw2,'Crêpepapier (1 pak)',1,true,24);
    _uItem(_aw,_aw2,'Wol in verschillende kleuren (5 bollen)',1,true,25);
    _uItem(_aw,_aw2,'Kralen (1 doos)',1,true,26);
    _uItem(_aw,_aw2,'Ballonnen (1 zakje)',1,true,27);

    console.log('  Migratie 26: 1001BB + Alice volledig ingevoegd');
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
  if(!(get('SELECT id FROM vaste_bakken LIMIT 1'))){
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
      try{
        // Haal alle top-level thema_materiaal rijen op (= bakken)
        const _bakRows=all('SELECT * FROM thema_materiaal WHERE parent_id IS NULL ORDER BY thema_id,sort_order,id');
        // Map: thema_materiaal.id → thema_bakken.id
        const _bakMap={};
        _bakRows.forEach(bak=>{
          const newId=ins(`INSERT INTO thema_bakken (thema_id,label,code,leeftijdsgroep,volgorde)
            VALUES (?,?,?,?,?)`,[bak.thema_id,bak.name||'',bak.stockage_code||'','',bak.sort_order||0]);
          _bakMap[bak.id]=newId;
        });
        // Haal alle kind-rijen op (= items in bakken)
        const _itemRows=all('SELECT * FROM thema_materiaal WHERE parent_id IS NOT NULL ORDER BY thema_id,sort_order,id');
        _itemRows.forEach(item=>{
          const bakId=_bakMap[item.parent_id];
          if(!bakId)return;
          ins(`INSERT INTO bak_items (bak_id,naam,qty,verbruik,qty_per_gebruik,eenheid,qty_stock,qty_minimum)
            VALUES (?,?,?,?,1,'stuks',0,?)`,[bakId,item.name||'',item.qty||1,item.is_verbruik?1:0,item.is_verbruik?(item.qty||1):0]);
        });
        console.log(`  Migratie 29: ${Object.keys(_bakMap).length} bakken + ${_itemRows.length} items gemigreerd naar thema_bakken`);
      }catch(e){console.error('  Migratie 29 fout (niet-fataal):',e.message);}
    }
  }

  // Migration 30: item_types catalogus seeden + item_type_id FK aan bak_items
  addColumnIfMissing('bak_items','item_type_id','INTEGER');
  addColumnIfMissing('vaste_bak_items','item_type_id','INTEGER'); // al aanwezig maar voor zekerheid
  {
    const _itCount=(get('SELECT COUNT(*) as n FROM item_types')||{}).n||0;
    if(_itCount===0){
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
  {
    const _seedPath=path.join(__dirname,'data','themas-seed.json');
    if(fs.existsSync(_seedPath)){
      let _tSeed=[];
      try{_tSeed=JSON.parse(fs.readFileSync(_seedPath,'utf8'));}catch(e){console.error('  Migratie 32: seed JSON onleesbaar:',e.message);}
      const _itMap2={};
      all('SELECT id,naam FROM item_types').forEach(t=>{_itMap2[t.naam.toLowerCase()]=t.id;});
      let _tAdded=0,_tSkipped=0,_biAdded=0;
      for(const t of _tSeed){
        const bestaand=get('SELECT id FROM themas WHERE name=?',[t.naam]);
        let tId,bakId;
        if(bestaand){
          tId=bestaand.id;
          // Zoek bestaande Materiaallijst-bak
          const bestaandeBak=get('SELECT id FROM thema_bakken WHERE thema_id=? AND label=?',[tId,'Materiaallijst']);
          if(bestaandeBak){
            bakId=bestaandeBak.id;
            // Alleen items toevoegen als de bak leeg is
            const aantalItems=(get('SELECT COUNT(*) as n FROM bak_items WHERE bak_id=?',[bakId])||{}).n||0;
            if(aantalItems>0){_tSkipped++;continue;}
          } else {
            bakId=ins('INSERT INTO thema_bakken (thema_id,label,code,leeftijdsgroep,volgorde) VALUES (?,?,?,?,?)',
              [tId,'Materiaallijst','',t.leeftijdsgroep||'',0]);
          }
        } else {
          tId=ins('INSERT INTO themas (name,color,leeftijdsgroep,thema_type) VALUES (?,?,?,?)',
            [t.naam,t.color||'#3498DB',t.leeftijdsgroep||'',t.thema_type||'eigen']);
          bakId=ins('INSERT INTO thema_bakken (thema_id,label,code,leeftijdsgroep,volgorde) VALUES (?,?,?,?,?)',
            [tId,'Materiaallijst','',t.leeftijdsgroep||'',0]);
          _tAdded++;
        }
        if(Array.isArray(t.items)){
          t.items.forEach((itNaam)=>{
            const typeId=_itMap2[itNaam.toLowerCase()]||null;
            ins('INSERT INTO bak_items (bak_id,naam,qty,eenheid,item_type_id,verbruik,qty_per_gebruik,qty_stock,qty_minimum) VALUES (?,?,?,?,?,0,1,0,0)',
              [bakId,itNaam,1,'stuk',typeId]);
            _biAdded++;
          });
        }
      }
      if(_tAdded>0||_biAdded>0)
        console.log(`  Migratie 32: ${_tAdded} themas gezaaid (${_tSkipped} al aanwezig), ${_biAdded} items ingevoegd`);
    }
  }

  // Migration 33: verwijder nep-themas (thema_type 'eigen'/'eigen_standaard' van de oude seed),
  // voeg echte themas toe vanuit data/themas-seed.json (opnieuw seeden met echte namen)
  {
    const _vlag33=get("SELECT naam FROM app_vlaggen WHERE naam='migratie33_klaar'");
    if(_vlag33){console.log('  Migratie 33: al uitgevoerd, overgeslagen');}
    else{
    // Stap 1: verwijder alle themas die door de nep-seed zijn aangemaakt
    // Originele 5 themas hebben thema_type='' (lege string, voor de kolom bestond)
    // Nep-seed heeft thema_type='eigen' of 'eigen_standaard'
    const _nepIds=all("SELECT id FROM themas WHERE thema_type IN ('eigen','eigen_standaard')").map(r=>r.id);
    if(_nepIds.length>0){
      const _placeholders=_nepIds.map(()=>'?').join(',');
      // Verwijder bak_items voor deze themas
      const _bakIds=all(`SELECT id FROM thema_bakken WHERE thema_id IN (${_placeholders})`,_nepIds).map(r=>r.id);
      if(_bakIds.length>0){
        const _bp=_bakIds.map(()=>'?').join(',');
        run(`DELETE FROM bak_items WHERE bak_id IN (${_bp})`,_bakIds);
      }
      run(`DELETE FROM thema_bakken WHERE thema_id IN (${_placeholders})`,_nepIds);
      run(`DELETE FROM themas WHERE id IN (${_placeholders})`,_nepIds);
      console.log(`  Migratie 33: ${_nepIds.length} nep-themas verwijderd`);
    }
    // Stap 2: voeg echte themas toe (zelfde seed-logica als migration 32)
    const _seedPath33=path.join(__dirname,'data','themas-seed.json');
    if(fs.existsSync(_seedPath33)){
      let _tSeed33=[];
      try{_tSeed33=JSON.parse(fs.readFileSync(_seedPath33,'utf8'));}catch(e){console.error('  Migratie 33: seed JSON onleesbaar:',e.message);}
      const _itMap33={};
      all('SELECT id,naam FROM item_types').forEach(t=>{_itMap33[t.naam.toLowerCase()]=t.id;});
      let _tAdded33=0,_biAdded33=0;
      for(const t of _tSeed33){
        const bestaand33=get('SELECT id FROM themas WHERE name=?',[t.naam]);
        if(bestaand33) continue;
        const tId33=ins('INSERT INTO themas (name,color,leeftijdsgroep,thema_type) VALUES (?,?,?,?)',
          [t.naam,t.color||'#3498DB',t.leeftijdsgroep||'',t.thema_type||'eigen']);
        const bakId33=ins('INSERT INTO thema_bakken (thema_id,label,code,leeftijdsgroep,volgorde) VALUES (?,?,?,?,?)',
          [tId33,'Materiaallijst','',t.leeftijdsgroep||'',0]);
        _tAdded33++;
        if(Array.isArray(t.items)){
          t.items.forEach((itNaam)=>{
            const typeId33=_itMap33[itNaam.toLowerCase()]||null;
            ins('INSERT INTO bak_items (bak_id,naam,qty,eenheid,item_type_id,verbruik,qty_per_gebruik,qty_stock,qty_minimum) VALUES (?,?,?,?,?,0,1,0,0)',
              [bakId33,itNaam,1,'stuk',typeId33]);
            _biAdded33++;
          });
        }
      }
      if(_tAdded33>0)console.log(`  Migratie 33: ${_tAdded33} echte themas gezaaid, ${_biAdded33} items ingevoegd`);
    }
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

  // Migration 35: update leeftijdsgroep + thema_type voor alle themas uit de seed (ook bestaande)
  {
    const _seedPath35=path.join(__dirname,'data','themas-seed.json');
    if(fs.existsSync(_seedPath35)){
      let _tSeed35=[];
      try{_tSeed35=JSON.parse(fs.readFileSync(_seedPath35,'utf8'));}catch(e){}
      let _upd35=0;
      for(const t of _tSeed35){
        const res=get('SELECT id,leeftijdsgroep,thema_type FROM themas WHERE name=?',[t.naam]);
        if(res){
          const needsUpdate=(res.leeftijdsgroep!==t.leeftijdsgroep)||(res.thema_type!==t.thema_type);
          if(needsUpdate){
            run('UPDATE themas SET leeftijdsgroep=?,thema_type=? WHERE id=?',[t.leeftijdsgroep||'',t.thema_type||'eigen',res.id]);
            _upd35++;
          }
        }
      }
      if(_upd35>0)console.log(`  Migratie 35: ${_upd35} themas bijgewerkt (leeftijdsgroep/thema_type)`);
    }
  }

  // Migration 36: echte bakken + items uit PDF-bundels zaaien (vervangt nep-items)
  {
    const _vlag36=get("SELECT naam FROM app_vlaggen WHERE naam='migratie36_klaar'");
    if(_vlag36){console.log('  Migratie 36: al uitgevoerd, overgeslagen');}
    else{
    const _sp36=path.join(__dirname,'data','thema-bakken-seed.json');
    if(fs.existsSync(_sp36)){
      let _seed36=[];
      try{_seed36=JSON.parse(fs.readFileSync(_sp36,'utf8'));}catch(e){console.error('  Migratie 36: JSON onleesbaar:',e.message);}
      let _tUpd36=0,_bAdded36=0,_iAdded36=0;
      for(const t of _seed36){
        const tRow=get('SELECT id FROM themas WHERE name=?',[t.naam]);
        if(!tRow) continue;
        // Wis altijd bestaande bakken + items voor dit thema (ook als geen PDF bestaat)
        const _bestaandeBakken=all('SELECT id FROM thema_bakken WHERE thema_id=?',[tRow.id]);
        if(_bestaandeBakken.length>0){
          const _bIds=_bestaandeBakken.map(r=>r.id);
          const _bPh=_bIds.map(()=>'?').join(',');
          run(`DELETE FROM bak_items WHERE bak_id IN (${_bPh})`,_bIds);
          run(`DELETE FROM thema_bakken WHERE thema_id=?`,[tRow.id]);
        }
        if(!Array.isArray(t.bakken)||t.bakken.length===0){_tUpd36++;continue;}
        // Voeg echte bakken in
        t.bakken.forEach((bak,idx)=>{
          const bakId=ins('INSERT INTO thema_bakken (thema_id,label,code,leeftijdsgroep,volgorde) VALUES (?,?,?,?,?)',
            [tRow.id,bak.label||'',bak.code||'',t.leeftijdsgroep||'',idx]);
          _bAdded36++;
          (bak.items||[]).forEach(itNaam=>{
            if(!itNaam||!itNaam.trim()) return;
            ins('INSERT INTO bak_items (bak_id,naam,qty,eenheid,item_type_id,verbruik,qty_per_gebruik,qty_stock,qty_minimum) VALUES (?,?,1,\'stuk\',null,0,1,0,0)',
              [bakId,itNaam.trim()]);
            _iAdded36++;
          });
        });
        _tUpd36++;
      }
      if(_tUpd36>0)console.log(`  Migratie 36: ${_tUpd36} themas bijgewerkt met echte bakken (${_bAdded36} bakken, ${_iAdded36} items)`);
    }
    try{ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie36_klaar','1')");}catch(e){}
    } // end if(!_vlag36)
  }

  // Migration 37: themedagen zaaien uit PDF-bundels (thema_type='themadag')
  {
    const _vlag37=get("SELECT naam FROM app_vlaggen WHERE naam='migratie37_klaar'");
    if(_vlag37){console.log('  Migratie 37: al uitgevoerd, overgeslagen');}
    else{
    const _sp37=path.join(__dirname,'data','themedagen-bakken-seed.json');
    if(fs.existsSync(_sp37)){
      let _seed37=[];
      try{_seed37=JSON.parse(fs.readFileSync(_sp37,'utf8'));}catch(e){console.error('  Migratie 37: JSON onleesbaar:',e.message);}
      let _tAdded37=0,_bAdded37=0,_iAdded37=0;
      for(const t of _seed37){
        if(!t.thema_naam||!t.thema_naam.trim()) continue;
        let tRow=get('SELECT id FROM themas WHERE name=? AND thema_type=?',[t.thema_naam,'themadag']);
        if(!tRow){
          const tId=ins('INSERT INTO themas (name,color,leeftijdsgroep,thema_type) VALUES (?,?,?,?)',
            [t.thema_naam,'#8E44AD',t.leeftijdsgroep||'','themadag']);
          tRow={id:tId};
          _tAdded37++;
        }
        // Wis bestaande bakken
        const _bb37=all('SELECT id FROM thema_bakken WHERE thema_id=?',[tRow.id]);
        if(_bb37.length>0){
          const _bIds=_bb37.map(r=>r.id);
          run(`DELETE FROM bak_items WHERE bak_id IN (${_bIds.map(()=>'?').join(',')})`,_bIds);
          run('DELETE FROM thema_bakken WHERE thema_id=?',[tRow.id]);
        }
        (t.bakken||[]).forEach((bak,idx)=>{
          const bakId=ins('INSERT INTO thema_bakken (thema_id,label,code,leeftijdsgroep,volgorde) VALUES (?,?,?,?,?)',
            [tRow.id,bak.label||'',bak.code||'',t.leeftijdsgroep||'',idx]);
          _bAdded37++;
          (bak.items||[]).forEach(itNaam=>{
            if(!itNaam||!itNaam.trim()) return;
            ins('INSERT INTO bak_items (bak_id,naam,qty,eenheid,item_type_id,verbruik,qty_per_gebruik,qty_stock,qty_minimum) VALUES (?,?,1,\'stuk\',null,0,1,0,0)',
              [bakId,itNaam.trim()]);
            _iAdded37++;
          });
        });
      }
      if(_tAdded37>0)console.log(`  Migratie 37: ${_tAdded37} themadagen gezaaid (${_bAdded37} bakken, ${_iAdded37} items)`);
    }
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
  {
    const _sp42=path.join(__dirname,'data','sport-planning-seed.json');
    if(fs.existsSync(_sp42)){
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
  {
    const _nieuwW1=[
      {name:'Ingenieus Zomerkamp',             leeftijdsgroep:'tieners',    color:'#8E44AD', loc:'Campus GroepT'},
      {name:'Meisjes en Wetenschap',           leeftijdsgroep:'tieners',    color:'#E91E63', loc:'Campus GroepT'},
      {name:'Beestige Natuur 3-daagse',        leeftijdsgroep:'kleuters',   color:'#27AE60', loc:'De Wijzer Oud-Heverlee'},
      {name:'Ervaring met Zwemmen',            leeftijdsgroep:'lagere school',color:'#2980B9',loc:'Sporthal Kessel-Lo'},
      {name:'Ropeskipping Kamp',               leeftijdsgroep:'lagere school',color:'#E67E22',loc:'Sporthal Kessel-Lo'},
      {name:'Sportkamp Water & Balsport',      leeftijdsgroep:'lagere school',color:'#16A085',loc:'Sporthal Kessel-Lo'},
      {name:'Play a Game',                     leeftijdsgroep:'lagere school',color:'#F39C12',loc:'Scoutslokalen Vlierbeek'},
      {name:'Kickx 3-daagse',                  leeftijdsgroep:'tieners',    color:'#C0392B', loc:'Scoutslokalen Vlierbeek'},
    ];
    for(const entry of _nieuwW1){
      const exists=get('SELECT id FROM themas WHERE LOWER(name)=LOWER(?)',[entry.name]);
      if(!exists) ins('INSERT INTO themas (name,leeftijdsgroep,color,thema_type) VALUES (?,?,?,?)',[entry.name,entry.leeftijdsgroep,entry.color,'eigen']);
      const th=get('SELECT id FROM themas WHERE LOWER(name)=LOWER(?)',[entry.name]);
      if(!th) continue;
      const loc=get('SELECT id FROM locaties WHERE name=?',[entry.loc]);
      if(!loc) continue;
      const km=get('SELECT id FROM kampmomenten WHERE locatie_id=? AND week=1',[loc.id]);
      if(!km) continue;
      try{run('INSERT OR IGNORE INTO kampmoment_themas (kampmoment_id,thema_id) VALUES (?,?)',[km.id,th.id]);}catch(e){}
    }
    const _n44=(get('SELECT COUNT(*) as n FROM themas WHERE name IN (\'Ingenieus Zomerkamp\',\'Meisjes en Wetenschap\',\'Beestige Natuur 3-daagse\')')||{}).n||0;
    if(_n44>0)console.log(`  Migratie 44: ${_n44} nieuwe themas aangemaakt + gekoppeld aan week 1`);
  }

  // Migration 45: kampplanner volledig leegmaken op uitdrukkelijk verzoek (eenmalig!)
  // Themas, locaties, sportplanning en materiaal-catalogus blijven ongemoeid.
  // Loopt maar 1x — anders zou elke herstart later manueel toegevoegde kampen weer wissen.
  {
    const _vlag45=get("SELECT naam FROM app_vlaggen WHERE naam='kampplanner_leeggemaakt'");
    if(!_vlag45){
      const _kmAantal45=(get('SELECT COUNT(*) as n FROM kampmomenten')||{}).n||0;
      if(_kmAantal45>0){
        const _tIds45=all('SELECT id FROM transport_taken WHERE kampmoment_id IS NOT NULL').map(t=>t.id);
        _tIds45.forEach(id=>{try{run('DELETE FROM transport_regels WHERE taak_id=?',[id]);}catch(e){}});
        try{run('DELETE FROM transport_taken WHERE kampmoment_id IS NOT NULL');}catch(e){}
        try{run('DELETE FROM kampmoment_themas');}catch(e){}
        try{run('DELETE FROM kampmomenten');}catch(e){}
        console.log(`  Migratie 45: kampplanner leeggemaakt (${_kmAantal45} kampmomenten, ${_tIds45.length} gekoppelde transporten verwijderd) — themas/locaties/sportplanning ongemoeid`);
      }
      try{ins('INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES (\'kampplanner_leeggemaakt\',\'1\')');}catch(e){}
    }
  }

  // Migration 43: themas koppelen aan kampmomenten week 1
  {
    {
      const _planW1=[
        {loc:'Abdijschool Vlierbeek',    th:['Op Schattenjacht met Zino Balino','We slaan in het rond','LegoLegends','Modemakers']},
        {loc:'De Bosstraat',             th:['Reis rond de Wereld','Ambachtenacademie','Geef Acht!']},
        {loc:'De Wijzer Oud-Heverlee',   th:['1001 Ballen en Bellen']},
        {loc:'Grasmus',                  th:['Sprookjesland','Wie Wordt Homo Universalis']},
        {loc:'Klare Bron',               th:['Alle Kleuren van de Regenboog']},
        {loc:'De Kraal',                 th:['Feestje Bouwen','Fit & Fun Kamp']},
        {loc:'De Mozaiek',               th:['Kriebelbeestjes','Atleet voor een Dag']},
        {loc:'Rotselaar',                th:['Later als ik Groot Ben','Expeditie Survival']},
        {loc:'Scoutslokalen Vlierbeek',  th:['Zeepkistenrace','Zoete Toetjes']},
        {loc:'Sporthal Kessel-Lo',       th:['Mini Splash','De Beweegplaneet']},
        {loc:'Syntra',                   th:['Hoera \'t is Feest','Koekjesatelier']},
      ];
      // Rotselaar: 'Balanceren op één been' heeft speciale tekens → zoek met LIKE
      const _rotBal=get("SELECT id FROM themas WHERE name LIKE '%alanceren%been%'");
      if(_rotBal) _planW1.find(p=>p.loc==='Rotselaar').th.push('__id:'+_rotBal.id);
      let _add43=0,_skip43=new Set();
      for(const entry of _planW1){
        const _loc=get('SELECT id FROM locaties WHERE name=?',[entry.loc]);
        if(!_loc){_skip43.add('LOC:'+entry.loc);continue;}
        const _km=get('SELECT id FROM kampmomenten WHERE locatie_id=? AND week=1',[_loc.id]);
        if(!_km){_skip43.add('KM:'+entry.loc);continue;}
        for(const tRef of entry.th){
          let thId;
          if(tRef.startsWith('__id:')){thId=parseInt(tRef.slice(5));}
          else{const th=get('SELECT id FROM themas WHERE LOWER(name)=LOWER(?)',[tRef]);thId=th?.id;}
          if(!thId){_skip43.add('T:'+tRef);continue;}
          try{run('INSERT OR IGNORE INTO kampmoment_themas (kampmoment_id,thema_id) VALUES (?,?)',[_km.id,thId]);_add43++;}catch(e){}
        }
      }
      if(_add43>0)console.log(`  Migratie 43: ${_add43} thema-koppelingen week 1`);
      if(_skip43.size>0)console.log('  Migratie 43 overgeslagen:',JSON.stringify([..._skip43]));
    }
  }

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
    for(const doos of _dozen38){
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
      const _trCount=(get('SELECT COUNT(*) as n FROM transport_ritten')||{}).n||0;
      const _ttCount=(get('SELECT COUNT(*) as n FROM transport_taken')||{}).n||0;
      if(_trCount>0||_ttCount>0){
        try{
          ['verhuis_checks','transport_regels','transport_taken','transport_ritten','verplaatsingen']
            .forEach(t=>{try{run(`DELETE FROM ${t}`);}catch(e){}});
          console.log('  Migratie 23: transport- en verplaatsingsdata gewist');
        }catch(e){console.error('  Migratie 23 fout (niet-fataal):',e.message);}
      }
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

  saveDb();



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

  // ── STANDAARD DOZEN ──
  app.get('/api/standaard-dozen',(req,res)=>{
    const dozen=all('SELECT * FROM standaard_dozen ORDER BY volgorde');
    dozen.forEach(d=>{d.items=all('SELECT * FROM standaard_doos_items WHERE doos_id=? ORDER BY id',[ d.id]);});
    res.json(dozen);
  });
  app.put('/api/standaard-dozen/:id',(req,res)=>{
    const{opslagcode}=req.body;
    run('UPDATE standaard_dozen SET opslagcode=? WHERE id=?',[opslagcode||'',req.params.id]);
    res.json(get('SELECT * FROM standaard_dozen WHERE id=?',[req.params.id]));
  });

  // ── LOCATIE DOOS CONFIG ──
  app.get('/api/locatie-doos-config/:locatie_id',(req,res)=>{
    res.json(all('SELECT * FROM locatie_doos_config WHERE locatie_id=?',[req.params.locatie_id]));
  });
  app.post('/api/locatie-doos-config',(req,res)=>{
    const{locatie_id,doos_id,qty,actief}=req.body;
    run('INSERT OR REPLACE INTO locatie_doos_config (locatie_id,doos_id,qty,actief) VALUES (?,?,?,?)',
      [locatie_id,doos_id,qty||null,actief===false?0:1]);
    res.json({ok:true});
  });

  // ── KAMPMOMENT STANDAARD DOZEN (welke dozen gaan mee) ──
  app.get('/api/kampmoment-dozen/:km_id',(req,res)=>{
    const km=get('SELECT * FROM kampmomenten WHERE id=?',[req.params.km_id]);
    if(!km)return res.json([]);
    const loc=get('SELECT * FROM locaties WHERE id=?',[km.locatie_id]);
    const themas=all('SELECT t.* FROM themas t JOIN kampmoment_themas kt ON kt.thema_id=t.id WHERE kt.kampmoment_id=?',[km.id]);
    const heeftKoken=themas.some(t=>t.heeft_kookactiviteit);
    const leeftijden=new Set(themas.map(t=>t.leeftijdsgroep).filter(Boolean));
    const heeftKleuters=leeftijden.has('kleuters');
    const heeftLS=leeftijden.has('lagere school');
    // Laad alle dozen
    const dozen=all('SELECT * FROM standaard_dozen ORDER BY volgorde');
    const locConfig=all('SELECT * FROM locatie_doos_config WHERE locatie_id=?',[km.locatie_id]);
    const configByDoos={};
    locConfig.forEach(c=>{configByDoos[c.doos_id]=c;});
    const result=dozen.map(doos=>{
      const cfg=configByDoos[doos.id];
      let actief=true;
      let qty=cfg?.qty||doos.qty_default;
      // Conditie-logica
      if(doos.conditie_type==='leeftijdsgroep'){
        if(doos.conditie_waarde==='kleuters') actief=heeftKleuters&&!loc?.heeft_eigen_sportmateriaal;
        else if(doos.conditie_waarde==='lagere school') actief=heeftLS&&!loc?.heeft_eigen_sportmateriaal;
      } else if(doos.conditie_type==='thema'){
        if(doos.conditie_waarde==='kookactiviteit') actief=heeftKoken;
      } else if(doos.conditie_type==='programma'){
        actief=false; // handmatig activeren
      }
      // Locatie-override overschrijft alles
      if(cfg) actief=cfg.actief===1;
      doos.items=all('SELECT * FROM standaard_doos_items WHERE doos_id=? ORDER BY id',[doos.id]);
      return {...doos,actief,qty_effectief:qty,heeft_override:!!cfg};
    });
    res.json(result);
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
  app.delete('/api/themas/:id',(req,res)=>{run('DELETE FROM thema_materiaal WHERE thema_id=?',[req.params.id]);run('DELETE FROM themas WHERE id=?',[req.params.id]);res.json({ok:true});});
  app.post('/api/themas/:id/materiaal',(req,res)=>{const{name,qty,stockage_locatie_id,stockage_code}=req.body;const item_type_id=resolveItemTypeId(name);const id=ins('INSERT INTO thema_materiaal (thema_id,name,qty,stockage_locatie_id,stockage_code,item_type_id) VALUES (?,?,?,?,?,?)',[req.params.id,name,qty||1,stockage_locatie_id||null,stockage_code||'',item_type_id]);res.json(get('SELECT * FROM thema_materiaal WHERE id=?',[id]));});
  app.put('/api/themas/:tid/materiaal/:mid',(req,res)=>{const{name,qty,stockage_locatie_id,stockage_code}=req.body;const cur=get('SELECT * FROM thema_materiaal WHERE id=?',[req.params.mid]);run('UPDATE thema_materiaal SET name=?,qty=?,stockage_locatie_id=?,stockage_code=? WHERE id=? AND thema_id=?',[name,qty,stockage_locatie_id||null,stockage_code!==undefined?stockage_code:(cur?cur.stockage_code||'':''),req.params.mid,req.params.tid]);res.json(get('SELECT * FROM thema_materiaal WHERE id=?',[req.params.mid]));});
  app.delete('/api/themas/:tid/materiaal/:mid',(req,res)=>{run('DELETE FROM thema_materiaal WHERE id=? AND thema_id=?',[req.params.mid,req.params.tid]);res.json({ok:true});});

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
    try{
      const lijst=_laadImportThemas();
      const bestaand=new Set(all('SELECT name FROM themas').map(t=>(t.name||'').trim().toLowerCase()));
      let nieuw=0, bestaat=0, items=0;
      lijst.forEach(t=>{ if(bestaand.has(t.naam.toLowerCase())) bestaat++; else { nieuw++; items+=t.materiaal.length; } });
      res.json({totaal:lijst.length, nieuw, bestaat, materiaalitems:items});
    }catch(e){ res.status(500).json({error:e.message}); }
  });
  app.post('/api/import-themas',(req,res)=>{
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
    return {...km, locatie:loc, themas, sport_sets:sportSets, open_dagen:openDagen, locatie_materiaal:locMat, periode};
  }

  app.get('/api/kampmomenten',(req,res)=>{
    const kms=all('SELECT * FROM kampmomenten ORDER BY periode_id,week,locatie_id');
    res.json(kms.map(km=>getKampmoment(km.id)).filter(Boolean));
  });

  app.post('/api/kampmomenten',(req,res)=>{
    const{locatie_id,week,periode_id,type}=req.body;
    const periodeIdToUse=periode_id||1;
    const typeVal=(type==='themadag'?'themadag':'kamp');
    try {
      const id=ins('INSERT INTO kampmomenten (locatie_id,week,periode_id,type) VALUES (?,?,?,?)',[locatie_id,week,periodeIdToUse,typeVal]);
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
    const{week,type}=req.body;
    const old=get('SELECT k.*,l.name as loc_naam FROM kampmomenten k LEFT JOIN locaties l ON l.id=k.locatie_id WHERE k.id=?',[req.params.id]);
    if(week!==undefined) run('UPDATE kampmomenten SET week=? WHERE id=?',[week,req.params.id]);
    if(type!==undefined && (type==='kamp'||type==='themadag')) run('UPDATE kampmomenten SET type=? WHERE id=?',[type,req.params.id]);
    if(old && week!==undefined && week!==old.week) logAct('kampmoment','verplaatst',`${old.loc_naam||'?'}: week ${old.week} → week ${week}`,old.locatie_id,old.loc_naam);
    if(old && type!==undefined && type!==(old.type||'kamp')) logAct('kampmoment','bewerkt',`${old.loc_naam||'?'} week ${old.week}: ${old.type||'kamp'} → ${type}`,old.locatie_id,old.loc_naam);
    res.json(getKampmoment(req.params.id));
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

  // ── SPOED ──
  app.get('/api/spoed',(req,res)=>res.json(all('SELECT * FROM spoedmeldingen ORDER BY done ASC,id DESC')));
  app.post('/api/spoed',(req,res)=>{
    const{item,qty,locatie_id,prio,note}=req.body;
    const id=ins('INSERT INTO spoedmeldingen (item,qty,locatie_id,prio,note,created_at) VALUES (?,?,?,?,?,?)',[item,qty||1,locatie_id,prio||'midden',note||'',now()]);
    const loc=locatie_id?get('SELECT name FROM locaties WHERE id=?',[locatie_id]):null;
    logAct('spoed','aangemaakt',`🚨 ${item} (${qty||1}x) — prioriteit: ${prio||'midden'}`,locatie_id||null,loc?.name||null);
    res.json(get('SELECT * FROM spoedmeldingen WHERE id=?',[id]));
  });
  app.put('/api/spoed/:id/toggle',(req,res)=>{
    const s=get('SELECT * FROM spoedmeldingen WHERE id=?',[req.params.id]);
    const nd=s.done?0:1;
    const t=new Date().toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'});
    run('UPDATE spoedmeldingen SET done=?,done_time=? WHERE id=?',[nd,nd?t:'',req.params.id]);
    const loc=s.locatie_id?get('SELECT name FROM locaties WHERE id=?',[s.locatie_id]):null;
    logAct('spoed',nd?'opgelost':'heropend',`${nd?'✅':'🔁'} Spoedmelding "${s.item}" ${nd?'opgelost':'heropend'}`,s.locatie_id||null,loc?.name||null);
    res.json(get('SELECT * FROM spoedmeldingen WHERE id=?',[req.params.id]));
  });
  app.delete('/api/spoed/:id',(req,res)=>{run('DELETE FROM spoedmeldingen WHERE id=?',[req.params.id]);res.json({ok:true});});

  // ── MATERIAAL ──
  app.get('/api/materiaal',(req,res)=>{const items=all('SELECT * FROM materiaal_items ORDER BY cat,name');const eenheden=all('SELECT * FROM materiaal_eenheden');res.json(items.map(i=>({...i,eenheden:eenheden.filter(e=>e.item_id===i.id)})));});
  app.post('/api/materiaal',(req,res)=>{const{name,tracking,cat}=req.body;const item_type_id=resolveItemTypeId(name);const id=ins('INSERT INTO materiaal_items (name,tracking,cat,created_at,item_type_id) VALUES (?,?,?,?,?)',[name,tracking||'per_type',cat||'andere',now(),item_type_id]);res.json({...get('SELECT * FROM materiaal_items WHERE id=?',[id]),eenheden:[]});});
  app.put('/api/materiaal/:id',(req,res)=>{const{name,tracking,cat}=req.body;const cur=get('SELECT * FROM materiaal_items WHERE id=?',[req.params.id]);const item_type_id=name&&name!==cur?.name?resolveItemTypeId(name):cur?.item_type_id;run('UPDATE materiaal_items SET name=?,tracking=?,cat=?,item_type_id=? WHERE id=?',[name,tracking,cat,item_type_id,req.params.id]);res.json(get('SELECT * FROM materiaal_items WHERE id=?',[req.params.id]));});
  app.delete('/api/materiaal/:id',(req,res)=>{const ee=all('SELECT id FROM materiaal_eenheden WHERE item_id=?',[req.params.id]);ee.forEach(e=>run('DELETE FROM verplaatsingen WHERE eenheid_id=?',[e.id]));run('DELETE FROM materiaal_eenheden WHERE item_id=?',[req.params.id]);run('DELETE FROM materiaal_items WHERE id=?',[req.params.id]);res.json({ok:true});});
  app.post('/api/materiaal/:id/eenheden',(req,res)=>{const{label,qty,locatie_id}=req.body;const eid=ins('INSERT INTO materiaal_eenheden (item_id,label,qty,locatie_id) VALUES (?,?,?,?)',[req.params.id,label||'',qty||1,locatie_id]);ins('INSERT INTO verplaatsingen (eenheid_id,van_locatie_id,naar_locatie_id,qty,reden,datum) VALUES (?,?,?,?,?,?)',[eid,null,locatie_id,qty||1,'Initieel ingevoerd',now()]);res.json(get('SELECT * FROM materiaal_eenheden WHERE id=?',[eid]));});
  app.put('/api/eenheden/:id',(req,res)=>{const{label,qty}=req.body;run('UPDATE materiaal_eenheden SET label=?,qty=? WHERE id=?',[label,qty,req.params.id]);res.json(get('SELECT * FROM materiaal_eenheden WHERE id=?',[req.params.id]));});
  app.delete('/api/eenheden/:id',(req,res)=>{run('DELETE FROM verplaatsingen WHERE eenheid_id=?',[req.params.id]);run('DELETE FROM materiaal_eenheden WHERE id=?',[req.params.id]);res.json({ok:true});});
  app.get('/api/eenheden/:id/verplaatsingen',(req,res)=>res.json(all('SELECT * FROM verplaatsingen WHERE eenheid_id=? ORDER BY id DESC',[req.params.id])));
  app.post('/api/eenheden/:id/verplaats',(req,res)=>{const{naar_locatie_id,qty,reden}=req.body;const e=get('SELECT * FROM materiaal_eenheden WHERE id=?',[req.params.id]);if(!e)return res.status(404).json({error:'Niet gevonden'});ins('INSERT INTO verplaatsingen (eenheid_id,van_locatie_id,naar_locatie_id,qty,reden,datum) VALUES (?,?,?,?,?,?)',[req.params.id,e.locatie_id,naar_locatie_id,qty||e.qty,reden||'',now()]);run('UPDATE materiaal_eenheden SET locatie_id=? WHERE id=?',[naar_locatie_id,req.params.id]);res.json(get('SELECT * FROM materiaal_eenheden WHERE id=?',[req.params.id]));});
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

  // ── CHAUFFEURS ──
  app.get('/api/chauffeurs',(req,res)=>res.json(all('SELECT * FROM chauffeurs ORDER BY name')));
  app.post('/api/chauffeurs',(req,res)=>{
    const{name}=req.body;if(!name)return res.status(400).json({error:'Naam vereist'});
    try{
      let p=get('SELECT id FROM personeel WHERE LOWER(naam)=LOWER(?) AND rol=?',[name,'chauffeur']);
      if(!p) p={id:ins('INSERT INTO personeel (naam,rol) VALUES (?,?)',[name,'chauffeur'])};
      const id=ins('INSERT INTO chauffeurs (name,personeel_id) VALUES (?,?)',[name,p.id]);
      res.json(get('SELECT * FROM chauffeurs WHERE id=?',[id]));
    }
    catch(e){res.status(400).json({error:'Naam bestaat al'});}
  });
  app.delete('/api/chauffeurs/:id',(req,res)=>{run('DELETE FROM chauffeurs WHERE id=?',[req.params.id]);res.json({ok:true});});

  // ── PLOEGPLANNING ──
  app.get('/api/ploeg',(req,res)=>{
    const shifts=all('SELECT ps.*,c.name as chauffeur_name FROM ploeg_shifts ps JOIN chauffeurs c ON c.id=ps.chauffeur_id ORDER BY ps.datum,ps.start_tijd');
    res.json(shifts);
  });
  app.get('/api/ploeg/week',(req,res)=>{
    const{van,tot}=req.query;
    const shifts=all('SELECT ps.*,c.name as chauffeur_name FROM ploeg_shifts ps JOIN chauffeurs c ON c.id=ps.chauffeur_id WHERE ps.datum>=? AND ps.datum<=? ORDER BY ps.datum,ps.start_tijd',[van||'2026-01-01',tot||'2026-12-31']);
    res.json(shifts);
  });
  app.post('/api/ploeg',(req,res)=>{
    const{chauffeur_id,datum,start_tijd,eind_tijd,type,opmerking}=req.body;
    if(!chauffeur_id||!datum)return res.status(400).json({error:'chauffeur_id en datum zijn vereist'});
    const id=ins('INSERT INTO ploeg_shifts (chauffeur_id,datum,start_tijd,eind_tijd,type,opmerking) VALUES (?,?,?,?,?,?)',[chauffeur_id,datum,start_tijd||'08:00',eind_tijd||'17:00',type||'vol',opmerking||'']);
    const shift=get('SELECT ps.*,c.name as chauffeur_name FROM ploeg_shifts ps JOIN chauffeurs c ON c.id=ps.chauffeur_id WHERE ps.id=?',[id]);
    res.json(shift);
  });
  app.put('/api/ploeg/:id',(req,res)=>{
    const{chauffeur_id,datum,start_tijd,eind_tijd,type,opmerking}=req.body;
    run('UPDATE ploeg_shifts SET chauffeur_id=?,datum=?,start_tijd=?,eind_tijd=?,type=?,opmerking=? WHERE id=?',[chauffeur_id,datum,start_tijd||'08:00',eind_tijd||'17:00',type||'vol',opmerking||'',req.params.id]);
    const shift=get('SELECT ps.*,c.name as chauffeur_name FROM ploeg_shifts ps JOIN chauffeurs c ON c.id=ps.chauffeur_id WHERE ps.id=?',[req.params.id]);
    res.json(shift);
  });
  app.delete('/api/ploeg/:id',(req,res)=>{
    run('DELETE FROM ploeg_shifts WHERE id=?',[req.params.id]);
    res.json({ok:true});
  });

  // ── THEMA-SETS INVENTARIS ──
  // Get full inventaris: all items with tracking='per_stuk', with their sets and current locations
  app.get('/api/inventaris/sets', (req,res)=>{
    const items = all("SELECT * FROM materiaal_items WHERE tracking='per_stuk' ORDER BY cat,name");
    const eenheden = all('SELECT me.*, l.name as locatie_name FROM materiaal_eenheden me LEFT JOIN locaties l ON l.id=me.locatie_id ORDER BY me.item_id, me.label');
    const planning = all('SELECT sp.*, l.name as locatie_name FROM set_planning sp LEFT JOIN locaties l ON l.id=sp.locatie_id ORDER BY sp.week');
    const verpl = all('SELECT v.*, vl.name as van_naam, nl.name as naar_naam FROM verplaatsingen v LEFT JOIN locaties vl ON vl.id=v.van_locatie_id LEFT JOIN locaties nl ON nl.id=v.naar_locatie_id ORDER BY v.datum DESC LIMIT 200');
    res.json(items.map(item=>({
      ...item,
      sets: eenheden.filter(e=>e.item_id===item.id).map(e=>({
        ...e,
        planning: planning.filter(p=>p.eenheid_id===e.id),
        verplaatsingen: verpl.filter(v=>v.eenheid_id===e.id)
      }))
    })));
  });

  // Move a set to a new location
  app.post('/api/inventaris/sets/:id/verplaats', (req,res)=>{
    const {naar_locatie_id, reden, datum} = req.body;
    const eenheid = get('SELECT * FROM materiaal_eenheden WHERE id=?',[req.params.id]);
    if(!eenheid) return res.status(404).json({error:'Set niet gevonden'});
    const van = eenheid.locatie_id;
    run('UPDATE materiaal_eenheden SET locatie_id=? WHERE id=?',[naar_locatie_id, req.params.id]);
    ins('INSERT INTO verplaatsingen(eenheid_id,van_locatie_id,naar_locatie_id,qty,reden,datum) VALUES(?,?,?,1,?,?)',
      [req.params.id, van, naar_locatie_id, reden||'', datum||isoDate(new Date())]);
    saveDb();
    res.json(get('SELECT me.*, l.name as locatie_name FROM materiaal_eenheden me LEFT JOIN locaties l ON l.id=me.locatie_id WHERE me.id=?',[req.params.id]));
  });

  // Add/update set planning (which week should this set be where)
  app.post('/api/inventaris/sets/:id/plan', (req,res)=>{
    const {week, locatie_id} = req.body;
    if(locatie_id===null||locatie_id===undefined){
      run('DELETE FROM set_planning WHERE eenheid_id=? AND week=?',[req.params.id,week]);
    } else {
      run('INSERT OR REPLACE INTO set_planning(eenheid_id,locatie_id,week) VALUES(?,?,?)',[req.params.id,locatie_id,week]);
    }
    saveDb();
    res.json({ok:true});
  });

  // CRUD for sets (eenheden)
  app.post('/api/materiaal/:id/eenheden', (req,res)=>{
    const{label,locatie_id}=req.body;
    const id=ins('INSERT INTO materiaal_eenheden(item_id,label,qty,locatie_id)VALUES(?,?,1,?)',[req.params.id,label||'',locatie_id||null]);
    res.json(get('SELECT me.*,l.name as locatie_name FROM materiaal_eenheden me LEFT JOIN locaties l ON l.id=me.locatie_id WHERE me.id=?',[id]));
  });
  app.put('/api/eenheden/:id', (req,res)=>{
    const{label,locatie_id,qty}=req.body;
    run('UPDATE materiaal_eenheden SET label=?,locatie_id=?,qty=? WHERE id=?',[label,locatie_id||null,qty||1,req.params.id]);
    res.json(get('SELECT me.*,l.name as locatie_name FROM materiaal_eenheden me LEFT JOIN locaties l ON l.id=me.locatie_id WHERE me.id=?',[req.params.id]));
  });
  app.delete('/api/eenheden/:id',(req,res)=>{
    run('DELETE FROM set_planning WHERE eenheid_id=?',[req.params.id]);
    run('DELETE FROM verplaatsingen WHERE eenheid_id=?',[req.params.id]);
    run('DELETE FROM materiaal_eenheden WHERE id=?',[req.params.id]);
    saveDb();res.json({ok:true});
  });

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

  // Mutatie: verbruik of aanvulling
  app.post('/api/verbruik/:id/mutatie', (req,res)=>{
    const{locatie_id,delta,reden,wie,transport_id}=req.body;
    const datum=isoDate(new Date());
    const created_at=new Date().toISOString();
    // Update stock
    run('INSERT OR IGNORE INTO verbruik_stock(item_id,locatie_id,qty,minimum,eenheid) VALUES(?,?,0,0,\'stuks\')',[req.params.id,locatie_id]);
    run('UPDATE verbruik_stock SET qty=MAX(0,qty+?) WHERE item_id=? AND locatie_id=?',[delta,req.params.id,locatie_id]);
    // Log
    ins('INSERT INTO verbruik_log(item_id,locatie_id,delta,reden,wie,transport_id,datum,created_at) VALUES(?,?,?,?,?,?,?,?)',
      [req.params.id,locatie_id,delta,reden||'',wie||'',transport_id||null,datum,created_at]);
    saveDb();
    const newStock=get('SELECT * FROM verbruik_stock WHERE item_id=? AND locatie_id=?',[req.params.id,locatie_id]);
    // Check alarm
    if(newStock&&newStock.minimum>0&&newStock.qty<=newStock.minimum){
      const item=get('SELECT name FROM materiaal_items WHERE id=?',[req.params.id]);
      console.log(`ALARM: ${item?.name} op ${locatie_id} onder minimum (${newStock.qty} <= ${newStock.minimum})`);
    }
    res.json({ok:true,stock:newStock});
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
    const thema_mat=all('SELECT * FROM thema_materiaal');
    const allLocMat=all('SELECT * FROM locatie_materiaal');
    const standaard=all('SELECT * FROM standaard_materiaal');
    const kts=all('SELECT * FROM kampmoment_themas');
    const kalDagen=all('SELECT * FROM kalender_dagen');
    const gelotenDagen=all('SELECT * FROM gesloten_dagen').map(g=>g.datum);
    const allKleuren=all('SELECT * FROM locatie_kleuren');
    const stockage=locs.filter(l=>l.type==='stockage');

    // Typed stockage: basis/sport → Kantoor, thema → Rozenweg
    const sportStockageId=locs.find(l=>l.type==='stockage'&&(l.stockage_rol==='sport'||l.stockage_rol==='beide'))?.id||stockage[0]?.id||null;
    const themaStockageId=locs.find(l=>l.type==='stockage'&&(l.stockage_rol==='thema'||l.stockage_rol==='beide'))?.id||stockage[0]?.id||null;

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
      kmList.forEach((km,idx)=>{
        const openDagen=getOpenDagen(km);
        if(!openDagen.length)return;
        const kmThemas=kts.filter(kt=>kt.kampmoment_id===km.id);
        const thNamen=kmThemas.map(kt=>themas.find(t=>t.id===kt.thema_id)?.name||'?').join(', ');
        const prevKm=kmList[idx-1];
        const nextKm=kmList[idx+1];
        const isOpvolgend=prevKm&&prevKm.week===km.week-1;
        const heeftOpvolger=nextKm&&nextKm.week===km.week+1;

        // Thema-materiaal met per-item stockage (fallback: themaStockageId)
        const themaMatRegels=kmThemas.flatMap(kt=>{
          const th=themas.find(t=>t.id===kt.thema_id);
          return thema_mat.filter(m=>m.thema_id===kt.thema_id).map(m=>({naam:'['+(th?.name||'?')+'] '+m.name,qty:m.qty,soort:'thema',stockage_id:m.stockage_locatie_id||themaStockageId}));
        });
        // Basis-materiaal met per-item stockage (fallback: sportStockageId)
        const basisRegels=locMat.map(m=>({naam:m.name,qty:m.qty,soort:'basis',stockage_id:m.stockage_locatie_id||sportStockageId}));

        // Groepeer regels per stockage-locatie en push één transport per groep
        function byStockage(regels){const g={};regels.forEach(r=>{if(!r.stockage_id)return;const k=r.stockage_id;if(!g[k])g[k]=[];g[k].push(r);});return g;}

        if(!isOpvolgend){
          // Eerste week: lever per stockage-groep
          const prevD=prevWorkday(openDagen[0]);
          // Kleurenborden voor deze locatie+week meesturen met basislevering
          const kleuren=allKleuren.filter(k=>k.locatie_id==loc.id&&k.week===km.week);
          const kleurenRegels=kleuren.map(k=>({naam:`Kleurenbord ${k.kleur} ×${k.aantal}`,qty:k.aantal,soort:'basis',stockage_id:sportStockageId}));
          const basisPlusKleuren=[...basisRegels,...kleurenRegels];
          Object.entries(byStockage(basisPlusKleuren)).forEach(([sid,mat])=>{
            const sLoc=locs.find(l=>l.id==sid);
            voorstellen.push({type:'levering',kampmoment_id:km.id,week:km.week,locatie:loc.name,locatie_id:loc.id,van_locatie_id:parseInt(sid),datum:prevD,tijd:'08:00',open_dagen:openDagen,materiaal:mat,opmerking:'Levering basis week '+km.week+' — '+loc.name+(sLoc?' (van '+sLoc.name+')':'')});
          });
          Object.entries(byStockage(themaMatRegels)).forEach(([sid,mat])=>{
            const sLoc=locs.find(l=>l.id==sid);
            voorstellen.push({type:'levering',kampmoment_id:km.id,week:km.week,locatie:loc.name,locatie_id:loc.id,van_locatie_id:parseInt(sid),datum:prevD,tijd:'09:00',open_dagen:openDagen,materiaal:mat,opmerking:'Levering thema week '+km.week+' — '+loc.name+' ('+thNamen+(sLoc?', van '+sLoc.name:'')+')'});
          });
        } else {
          // Opvolgende week: thema-wissel per stockage-groep
          const prevKmThemas=kts.filter(kt=>kt.kampmoment_id===prevKm.id);
          const prevThIds=new Set(prevKmThemas.map(kt=>kt.thema_id));
          const newThIds=new Set(kmThemas.map(kt=>kt.thema_id));
          const vertrekkende=prevKmThemas.filter(kt=>!newThIds.has(kt.thema_id));
          const aankomende=kmThemas.filter(kt=>!prevThIds.has(kt.thema_id));

          // Aankomende thema's die direct van een andere locatie komen (A→B consecutive)
          // worden afgehandeld door het "DIRECT THEMA-TRANSFER" blok → hier overslaan.
          const aankomendeViaStockage=aankomende.filter(kt=>{
            const kwamVanAndereLocatie=kts.some(kt2=>kt2.thema_id===kt.thema_id&&kt2.kampmoment_id!==km.id&&
              (()=>{const km2=kms.find(k=>k.id===kt2.kampmoment_id);return km2&&km2.week===km.week-1&&km2.locatie_id!==km.locatie_id;})());
            return !kwamVanAndereLocatie;
          });
          if(vertrekkende.length||aankomendeViaStockage.length){
            const ophaalMat=vertrekkende.flatMap(kt=>{const th=themas.find(t=>t.id===kt.thema_id);return thema_mat.filter(m=>m.thema_id===kt.thema_id).map(m=>({naam:'['+(th?.name||'?')+'] '+m.name,qty:m.qty,soort:'thema',stockage_id:m.stockage_locatie_id||themaStockageId}));});
            const leverMat=aankomendeViaStockage.flatMap(kt=>{const th=themas.find(t=>t.id===kt.thema_id);return thema_mat.filter(m=>m.thema_id===kt.thema_id).map(m=>({naam:'['+(th?.name||'?')+'] '+m.name,qty:m.qty,soort:'thema',stockage_id:m.stockage_locatie_id||themaStockageId}));});
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

        if(!heeftOpvolger){
          // Laatste week: haal op per stockage-groep
          const nextD=nextWorkday(openDagen[openDagen.length-1]);
          // Kleurenborden meeophalend na de laatste week
          const kleuren=allKleuren.filter(k=>k.locatie_id==loc.id&&k.week===km.week);
          const kleurenRegels=kleuren.map(k=>({naam:`Kleurenbord ${k.kleur} ×${k.aantal}`,qty:k.aantal,soort:'basis',stockage_id:sportStockageId}));
          const basisPlusKleuren=[...basisRegels,...kleurenRegels];
          Object.entries(byStockage(basisPlusKleuren)).forEach(([sid,mat])=>{
            const sLoc=locs.find(l=>l.id==sid);
            voorstellen.push({type:'ophaling',kampmoment_id:km.id,week:km.week,locatie:loc.name,locatie_id:loc.id,naar_locatie_id:parseInt(sid),datum:nextD,tijd:'17:00',open_dagen:openDagen,materiaal:mat,opmerking:'Ophaling basis week '+km.week+' — '+loc.name+(sLoc?' (naar '+sLoc.name+')':'')});
          });
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
        const thMat=thema_mat.filter(m=>m.thema_id===thId).map(m=>({naam:'['+(th?.name||'?')+'] '+m.name,qty:m.qty,soort:'thema'}));
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

    voorstellen.sort((a,b)=>a.datum.localeCompare(b.datum)||a.tijd.localeCompare(b.tijd));
    res.json(voorstellen);
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
  app.post('/api/transport-taken',(req,res)=>{const{type,datum,tijd,van_locatie_id,naar_locatie_id,opmerking,wie,kampmoment_id,regels,rit_id,week}=req.body;const id=ins('INSERT INTO transport_taken (type,datum,tijd,van_locatie_id,naar_locatie_id,opmerking,wie,kampmoment_id,status,created_at,rit_id,week) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',[type,datum||'',tijd||'09:00',van_locatie_id||null,naar_locatie_id||null,opmerking||'',wie||'',kampmoment_id||null,'gepland',now(),rit_id||null,week||null]);if(regels&&regels.length)regels.forEach(r=>ins('INSERT INTO transport_regels (taak_id,naam,qty,soort,item_type_id) VALUES (?,?,?,?,?)',[id,r.naam,r.qty||1,r.soort||'andere',resolveItemTypeId(r.naam)]));const taak=get('SELECT * FROM transport_taken WHERE id=?',[id]);const tr=all('SELECT * FROM transport_regels WHERE taak_id=?',[id]);res.json({...taak,regels:tr});});
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
    const {datum,chauffeur,opmerking,status,taak_ids}=req.body;
    if(!datum) return res.status(400).json({error:'Datum is verplicht'});
    const id=ins('INSERT INTO transport_ritten (datum,chauffeur,opmerking,status,created_at) VALUES (?,?,?,?,?)',
      [datum,chauffeur||'',opmerking||'',status||'gepland',now()]);
    if(Array.isArray(taak_ids)) taak_ids.forEach(tid=>{
      run('UPDATE transport_taken SET rit_id=?,datum=?,wie=? WHERE id=?',[id,datum,chauffeur||'',tid]);
    });
    res.json(_ritMetTaken(get('SELECT * FROM transport_ritten WHERE id=?',[id])));
  });
  app.put('/api/ritten/:id',(req,res)=>{
    const {datum,chauffeur,opmerking,status,voertuig}=req.body;
    const rit=get('SELECT * FROM transport_ritten WHERE id=?',[req.params.id]);
    if(!rit) return res.status(404).json({error:'Rit niet gevonden'});
    run('UPDATE transport_ritten SET datum=?,chauffeur=?,opmerking=?,status=?,voertuig=? WHERE id=?',
      [datum||rit.datum,
       chauffeur!==undefined?chauffeur:rit.chauffeur,
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

  // ── THEMA BAKKEN ──
  function _bakkenVanThema(thema_id){
    const bakken=all('SELECT * FROM thema_bakken WHERE thema_id=? ORDER BY volgorde,id',[thema_id]);
    return bakken.map(b=>({...b,items:all('SELECT * FROM bak_items WHERE bak_id=? ORDER BY verbruik,id',[b.id]),log:all('SELECT * FROM bak_nakijk_log WHERE bak_id=? ORDER BY tijdstip DESC LIMIT 5',[b.id])}));
  }
  app.get('/api/themas/:id/bakken',(req,res)=>res.json(_bakkenVanThema(req.params.id)));
  // Alle bakken van alle themas in één call (voor Themabakken-tab)
  app.get('/api/alle-bakken',(req,res)=>{
    const themas=all('SELECT * FROM themas ORDER BY name');
    res.json(themas.map(t=>({...t,bakken:_bakkenVanThema(t.id)})));
  });
  app.post('/api/themas/:id/bakken',(req,res)=>{
    const{label,code,leeftijdsgroep,volgorde}=req.body;
    const id=ins('INSERT INTO thema_bakken (thema_id,label,code,leeftijdsgroep,volgorde) VALUES (?,?,?,?,?)',
      [req.params.id,label||'',code||'',leeftijdsgroep||'',volgorde||0]);
    res.json({...get('SELECT * FROM thema_bakken WHERE id=?',[id]),items:[],log:[]});
  });
  app.put('/api/bakken/:id',(req,res)=>{
    const{label,code,leeftijdsgroep,volgorde}=req.body;
    run('UPDATE thema_bakken SET label=?,code=?,leeftijdsgroep=?,volgorde=? WHERE id=?',
      [label||'',code||'',leeftijdsgroep||'',volgorde||0,req.params.id]);
    res.json(get('SELECT * FROM thema_bakken WHERE id=?',[req.params.id]));
  });
  app.delete('/api/bakken/:id',(req,res)=>{
    run('DELETE FROM bak_items WHERE bak_id=?',[req.params.id]);
    run('DELETE FROM bak_nakijk_log WHERE bak_id=?',[req.params.id]);
    run('DELETE FROM thema_bakken WHERE id=?',[req.params.id]);
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
  app.get('/api/bakken/:id/items-detail',(req,res)=>{
    const b=get('SELECT * FROM thema_bakken WHERE id=?',[req.params.id]);
    if(!b)return res.status(404).json({error:'Bak niet gevonden'});
    res.json(all('SELECT * FROM bak_items WHERE bak_id=? ORDER BY verbruik,id',[req.params.id]));
  });
  // Nakijk log
  app.post('/api/bakken/:id/nakijk',(req,res)=>{
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
    res.json({ok:true,log_id:tid,bakken:_bakkenVanThema(get('SELECT thema_id FROM thema_bakken WHERE id=?',[req.params.id])?.thema_id)});
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
      all('SELECT * FROM transport_regels WHERE taak_id=?',[t.id]).forEach(r=>alle_regels.push({...r,_taak_opmerking:t.opmerking,_taak_type:t.type}));
    });
    if(!alle_regels.length)return res.status(400).json({error:'Geen materiaalregels gevonden in deze rit'});
    run('DELETE FROM verhuis_checks WHERE rit_id=?',[rit_id]);
    alle_regels.forEach((r,i)=>{
      ins('INSERT INTO verhuis_checks (rit_id,item_naam,item_soort,qty,status,sort_order,item_type_id) VALUES (?,?,?,?,?,?,?)',
        [rit_id,r.naam,r.soort||'andere',r.qty||1,'wacht',i,r.item_type_id||resolveItemTypeId(r.naam)]);
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

  // ── DATA EXPORT / IMPORT ──
  app.get('/api/export', (req, res) => {
    const data = {
      versie: 2,
      datum: new Date().toISOString(),
      locaties: all('SELECT * FROM locaties'),
      themas: all('SELECT * FROM themas'),
      thema_categorieen: all('SELECT * FROM thema_categorieen'),
      thema_materiaal: all('SELECT * FROM thema_materiaal'),
      standaard_materiaal: all('SELECT * FROM standaard_materiaal'),
      kampmomenten: all('SELECT * FROM kampmomenten'),
      kampmoment_themas: all('SELECT * FROM kampmoment_themas'),
      kalender_dagen: all('SELECT * FROM kalender_dagen'),
      gesloten_dagen: all('SELECT * FROM gesloten_dagen'),
      spoedmeldingen: all('SELECT * FROM spoedmeldingen'),
      locatie_materiaal: all('SELECT * FROM locatie_materiaal'),
      materiaal_items: all('SELECT * FROM materiaal_items'),
      materiaal_eenheden: all('SELECT * FROM materiaal_eenheden'),
      verplaatsingen: all('SELECT * FROM verplaatsingen'),
      set_planning: all('SELECT * FROM set_planning'),
      verbruik_stock: all('SELECT * FROM verbruik_stock'),
      verbruik_log: all('SELECT * FROM verbruik_log'),
      transport_taken: all('SELECT * FROM transport_taken'),
      transport_regels: all('SELECT * FROM transport_regels'),
      transport_ritten: all('SELECT * FROM transport_ritten'),
      chauffeurs: all('SELECT * FROM chauffeurs'),
      ploeg_shifts: all('SELECT * FROM ploeg_shifts'),
      verhuis_checks: all('SELECT * FROM verhuis_checks'),
      locatie_kleuren: all('SELECT * FROM locatie_kleuren'),
      thema_bakken: all('SELECT * FROM thema_bakken'),
      bak_items: all('SELECT * FROM bak_items'),
      voertuig_types: all('SELECT * FROM voertuig_types'),
    };
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
  // Reset: wis alle data voor import
  app.post('/api/import/reset', (req, res) => {
    try {
      const tables = ['ploeg_shifts','transport_regels','transport_taken','transport_ritten','verbruik_log',
        'verbruik_stock','set_planning','verplaatsingen','materiaal_eenheden','materiaal_items',
        'locatie_materiaal','spoedmeldingen','gesloten_dagen','kalender_dagen',
        'kampmoment_themas','kampmomenten','standaard_materiaal','thema_materiaal',
        'thema_categorieen','themas','locaties','chauffeurs'];
      tables.forEach(t => { try { db.run('DELETE FROM ' + t); } catch(e) {} });
      saveDb();
      res.json({ ok: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // Importeer één tabel per keer
  app.post('/api/import/tabel', (req, res) => {
    const { table, rows } = req.body;
    if (!table || !rows) return res.status(400).json({ error: 'Tabel of rijen ontbreken' });
    const colMap = {
      locaties: ['id','name','addr','type','contact_naam','contact_tel','notities'],
      thema_categorieen: ['id','name'],
      themas: ['id','name','color','categorie'],
      thema_materiaal: ['id','thema_id','name','qty'],
      standaard_materiaal: ['id','name','qty','cat'],
      kampmomenten: ['id','locatie_id','week'],
      kampmoment_themas: ['id','kampmoment_id','thema_id'],
      kalender_dagen: ['id','locatie_id','datum','open'],
      gesloten_dagen: ['id','datum','reden'],
      spoedmeldingen: ['id','item','qty','locatie_id','prio','note','done','done_time','created_at'],
      locatie_materiaal: ['id','locatie_id','name','qty','cat'],
      materiaal_items: ['id','name','tracking','cat','created_at'],
      materiaal_eenheden: ['id','item_id','label','qty','locatie_id'],
      verplaatsingen: ['id','eenheid_id','van_locatie_id','naar_locatie_id','qty','reden','datum'],
      set_planning: ['id','eenheid_id','locatie_id','week'],
      verbruik_stock: ['id','item_id','locatie_id','qty','minimum','eenheid'],
      verbruik_log: ['id','item_id','locatie_id','delta','reden','wie','transport_id','datum','created_at'],
      transport_taken: ['id','type','datum','tijd','van_locatie_id','naar_locatie_id','opmerking','wie','kampmoment_id','status','created_at','rit_id'],
      transport_regels: ['id','taak_id','naam','qty','soort'],
      transport_ritten: ['id','datum','chauffeur','opmerking','status','created_at'],
      chauffeurs: ['id','name'],
      ploeg_shifts: ['id','chauffeur_id','datum','start_tijd','eind_tijd','type','opmerking'],
    };
    const cols = colMap[table];
    if (!cols) return res.status(400).json({ error: 'Onbekende tabel: ' + table });
    try {
      rows.forEach(r => {
        const vals = cols.map(c => r[c] !== undefined ? r[c] : null);
        const ph = cols.map(() => '?').join(',');
        try { db.run('INSERT OR IGNORE INTO ' + table + ' (' + cols.join(',') + ') VALUES (' + ph + ')', vals); } catch(e) {}
      });
      saveDb();
      res.json({ ok: true, count: rows.length });
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
      tb.label as bak_label, tb.code as bak_code, t.name as thema_naam, t.color as thema_color, t.id as thema_id
      FROM bak_items bi
      JOIN thema_bakken tb ON tb.id=bi.bak_id
      JOIN themas t ON t.id=tb.thema_id
      WHERE bi.item_type_id IS NOT NULL`);
    const vasteBakItems=all(`SELECT vbi.item_type_id, vbi.naam, vbi.qty, vbi.is_verbruik as verbruik,
      vbi.qty_stock, vbi.qty_minimum, vb.naam as bak_label, vb.code as bak_code, 'Vaste bak' as thema_naam, '#6B7280' as thema_color, NULL as thema_id
      FROM vaste_bak_items vbi JOIN vaste_bakken vb ON vb.id=vbi.bak_id
      WHERE vbi.item_type_id IS NOT NULL`);
    const stockRows=all(`SELECT vs.item_type_id, vs.qty, vs.minimum, vs.eenheid,
      l.name as locatie_naam, l.id as locatie_id
      FROM verbruik_stock vs JOIN locaties l ON l.id=vs.locatie_id
      WHERE vs.item_type_id IS NOT NULL`);
    res.json(types.map(t=>{
      const allBakken=[...bakItems,...vasteBakItems].filter(b=>b.item_type_id===t.id);
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
    res.json(personen.map(p=>({...p,shifts:shifts.filter(s=>s.persoon_id===p.id)})));
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

  // ── VASTE BAKKEN ──
  app.get('/api/vaste-bakken',(req,res)=>{
    const bakken=all('SELECT * FROM vaste_bakken ORDER BY volgorde,naam');
    const items=all('SELECT vbi.*, it.eenheid as it_eenheid FROM vaste_bak_items vbi LEFT JOIN item_types it ON it.id=vbi.item_type_id ORDER BY vbi.bak_id,vbi.volgorde,vbi.id');
    res.json(bakken.map(b=>({...b,items:items.filter(i=>i.bak_id===b.id)})));
  });
  app.post('/api/vaste-bakken',(req,res)=>{
    const{naam,code,type,notities}=req.body;
    if(!naam?.trim())return res.status(400).json({error:'Naam vereist'});
    const id=ins('INSERT INTO vaste_bakken (naam,code,type,notities) VALUES (?,?,?,?)',[naam.trim(),code||'',type||'vast',notities||'']);
    res.json({...get('SELECT * FROM vaste_bakken WHERE id=?',[id]),items:[]});
  });
  app.put('/api/vaste-bakken/:id',(req,res)=>{
    const{naam,code,type,notities}=req.body;
    run('UPDATE vaste_bakken SET naam=?,code=?,type=?,notities=? WHERE id=?',[naam,code||'',type||'vast',notities||'',req.params.id]);
    res.json(get('SELECT * FROM vaste_bakken WHERE id=?',[req.params.id]));
  });
  app.delete('/api/vaste-bakken/:id',(req,res)=>{
    run('DELETE FROM vaste_bakken WHERE id=?',[req.params.id]);
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

  // ── CONVERSIE: losse thema-materialen -> gedeelde items ──
  // Leest data/gedeeld_items.json: lijst van {naam, totaal, cat, aliassen}.
  // Voor elk item: maak/vind het gedeeld_item, koppel elk thema dat een
  // materiaalregel met een matchende (hoofdletterongevoelige) alias heeft,
  // en verwijder daarna die losse thema_materiaal-regels.
  // - Twee passes: eerst alles koppelen, dan pas verwijderen. Zo kan één
  //   bronregel (bv. "Lasershoot en obstakels") naar meerdere gedeelde items
  //   gekoppeld worden voordat ze weg is.
  // - Idempotent: meermaals draaien is veilig (al gekoppelde regels zijn weg).
  // - Dry-run: POST /api/gedeeld/converteer?dryrun=1  toont enkel wat er ZOU
  //   gebeuren, zonder iets te wijzigen.
  function _laadGedeeldConfig(){
    const fsx=require('fs'); const px=require('path');
    const f=px.join(__dirname,'data','gedeeld_items.json');
    if(!fsx.existsSync(f)) return null;
    try { return JSON.parse(fsx.readFileSync(f,'utf8')); } catch(e){ return null; }
  }
  app.post('/api/gedeeld/converteer',(req,res)=>{
    try{
      const config=_laadGedeeldConfig();
      if(!config||!config.length) return res.status(400).json({error:'data/gedeeld_items.json ontbreekt of is leeg'});
      const dryRun = req.query.dryrun==='1' || (req.body && req.body.dryRun===true);
      const norm=s=>String(s==null?'':s).trim().toLowerCase();
      const matRows=all('SELECT id,thema_id,name FROM thema_materiaal');
      const teVerwijderen=new Set();
      const rapport=[];
      // Pass 1: items aanmaken/bijwerken + thema's koppelen (nog niet verwijderen)
      for(const def of config){
        const naam=(def.naam||'').trim(); if(!naam) continue;
        const aliassen=new Set((def.aliassen && def.aliassen.length ? def.aliassen : [naam]).map(norm));
        let item=get('SELECT * FROM gedeeld_items WHERE LOWER(name)=?',[norm(naam)]);
        let aangemaakt=false, itemId=item?item.id:null;
        if(!dryRun){
          if(!item){
            db.run('INSERT INTO gedeeld_items (name,cat,totaal,notities) VALUES (?,?,?,?)',[naam,def.cat||'gedeeld',def.totaal||1,'']);
            itemId=get('SELECT last_insert_rowid() as id').id; aangemaakt=true;
          } else if(def.totaal && item.totaal!==def.totaal){
            db.run('UPDATE gedeeld_items SET totaal=? WHERE id=?',[def.totaal,item.id]);
          }
        } else { aangemaakt=!item; }
        const matches=matRows.filter(m=>aliassen.has(norm(m.name)));
        const themas=new Set();
        for(const m of matches){ themas.add(m.thema_id); teVerwijderen.add(m.id); }
        if(!dryRun && itemId){
          for(const tid of themas){ db.run('INSERT OR REPLACE INTO gedeeld_gebruik (item_id,thema_id,qty) VALUES (?,?,1)',[itemId,tid]); }
        }
        rapport.push({item:naam, totaal:def.totaal||1, aangemaakt, themas_gekoppeld:themas.size, regels:matches.length});
      }
      // Pass 2: de losse thema_materiaal-regels verwijderen
      let verwijderd=teVerwijderen.size;
      if(!dryRun){
        for(const id of teVerwijderen){ db.run('DELETE FROM thema_materiaal WHERE id=?',[id]); }
        saveDb();
        logAct('thema','gedeeld-conversie',`Conversie: ${rapport.length} gedeelde items, ${verwijderd} losse regels omgezet`,null,'');
      }
      res.json({ok:true, dryRun, gedeelde_items:rapport.length, regels_omgezet:verwijderd, detail:rapport});
    }catch(e){ res.status(500).json({error:e.message}); }
  });

  // ── MIGRATIE: stockage_code splitsen in gebouw (Locatie) + code (Opslag) ──
  // Regel (gekozen door gebruiker): "kantoor" -> Kantoor; "rozenweg" -> Rozenweg;
  // elke andere (rek)code -> Rozenweg, met de code bewaard als Opslag-plek.
  // Alleen thema_materiaal-regels die nog GEEN gebouw (stockage_locatie_id) hebben.
  // ?dryrun=1 toont enkel wat er zou gebeuren.
  app.post('/api/migratie/stockage',(req,res)=>{
    try{
      const dryRun = req.query.dryrun==='1' || (req.body && req.body.dryRun===true);
      const stk = all("SELECT id,name FROM locaties WHERE type='stockage'");
      const findLoc = naam => { const x=stk.find(l=>(l.name||'').trim().toLowerCase()===naam); return x?x.id:null; };
      const kantoorId=findLoc('kantoor'), rozenwegId=findLoc('rozenweg');
      if(!rozenwegId) return res.status(400).json({error:'Stockage-locatie "Rozenweg" niet gevonden'});
      const rows = all('SELECT id,stockage_code,stockage_locatie_id FROM thema_materiaal');
      let naarKantoor=0, naarRozenweg=0, overgeslagen=0;
      for(const r of rows){
        if(r.stockage_locatie_id){ overgeslagen++; continue; }
        const code=(r.stockage_code||'').trim();
        if(!code){ overgeslagen++; continue; }
        const cl=code.toLowerCase();
        let locId, newCode;
        if(cl==='kantoor'){ locId=kantoorId||rozenwegId; newCode=''; naarKantoor++; }
        else if(cl==='rozenweg'){ locId=rozenwegId; newCode=''; naarRozenweg++; }
        else { locId=rozenwegId; newCode=code; naarRozenweg++; }
        if(!dryRun) db.run('UPDATE thema_materiaal SET stockage_locatie_id=?,stockage_code=? WHERE id=?',[locId,newCode,r.id]);
      }
      if(!dryRun){ saveDb(); logAct('thema','stockage-migratie',`Stockage gesplitst: ${naarKantoor} naar Kantoor, ${naarRozenweg} naar Rozenweg`,null,''); }
      res.json({ok:true, dryRun, naarKantoor, naarRozenweg, overgeslagen});
    }catch(e){ res.status(500).json({error:e.message}); }
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
    } else if(type==='thema'){
      item=get('SELECT mi.*,t.name AS thema_naam,t.color AS thema_color FROM materiaal_items mi JOIN themas t ON mi.thema_id=t.id WHERE mi.id=? AND mi.tracking=?',[id,'thema']);
    } else if(type==='standaard'){
      item=get('SELECT mi.*,l.name AS loc_naam FROM materiaal_items mi LEFT JOIN locaties l ON mi.locatie_id=l.id WHERE mi.id=? AND mi.tracking=?',[id,'standaard']);
    } else if(type==='gedeeld'){
      item=get('SELECT * FROM gedeeld_items WHERE id=?',[id]);
      if(item){
        extra.stock=all('SELECT gs.*,l.name AS locatie_name FROM gedeeld_stock gs JOIN locaties l ON gs.locatie_id=l.id WHERE gs.gedeeld_id=? ORDER BY l.name',[id]);
        extra.gebruik=all('SELECT gg.*,t.name AS thema_name,t.color FROM gedeeld_gebruik gg JOIN themas t ON gg.thema_id=t.id WHERE gg.gedeeld_id=?',[id]);
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
    const chkRows=checks.map(c=>`<div class="chk ${c.status}">
      <span class="ico">${c.status==='ok'?'✅':c.status==='ontbreekt'?'❌':c.status==='deels'?'⚠️':'⬜'}</span>
      <span class="nm">${c.item_naam||''}</span>
      <span class="qty">×${c.qty}</span>
      ${c.notitie?'<div class="nt">'+c.notitie+'</div>':''}</div>`).join('');
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
.footer{padding:20px 16px;text-align:center;font-size:12px;color:#aaa}</style></head><body>
<div class="hdr"><h1>🚚 Rit ${rit.datum}</h1>
<div class="sub">${rit.chauffeur?'👤 '+rit.chauffeur:''}${rit.voertuig?' · 🚐 '+rit.voertuig:''} · ${taken.length} stop${taken.length!==1?'s':''}</div></div>
<div class="sec">Stops</div>${stops||'<div style="padding:16px;color:#888">Geen stops gepland.</div>'}
${checks.length?'<div class="sec">Materiaallijst ('+checks.length+' items)</div>'+chkRows:''}
<div class="footer">Sporty Logistics</div></body></html>`);
  });

  // ── CONFLICTENDETECTOR ──
  app.get('/api/conflicten',(req,res)=>{
    const conflicten=[];
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
      const bakBehoefte=all(`SELECT tb.thema_id, bi.item_type_id, bi.qty, it.naam AS item_naam
        FROM bak_items bi JOIN thema_bakken tb ON tb.id=bi.bak_id JOIN item_types it ON it.id=bi.item_type_id
        WHERE bi.item_type_id IS NOT NULL`);
      const stockPerType={};
      all(`SELECT item_type_id, SUM(qty) AS totaal FROM verbruik_stock WHERE item_type_id IS NOT NULL GROUP BY item_type_id`)
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
