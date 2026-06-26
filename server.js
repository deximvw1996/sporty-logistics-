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
function logAct(type, actie, beschrijving, locatie_id=null, locatie_naam=null) {
  try { run('INSERT INTO activiteiten_log (tijdstip,type,actie,beschrijving,locatie_id,locatie_naam) VALUES (?,?,?,?,?,?)',
    [now(),type,actie,beschrijving,locatie_id||null,locatie_naam||null]); }
  catch(e) { console.error('Log fout:', e.message); }
}

async function startServer() {
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_PATH) ? new SQL.Database(fs.readFileSync(DB_PATH)) : new SQL.Database();

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
  // Gebruik een marker-vlag zodat dit maar 1x uitvoert en nooit crasht
  const _mig21Done=get("SELECT id FROM kampmomenten WHERE type='kamp' LIMIT 1");
  const _kmCount21=(get('SELECT COUNT(*) as n FROM kampmomenten')||{}).n||0;
  if(!_mig21Done || _kmCount21<50){
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

  // Migration 24: kampmomenten fix — Abdijschool Vlierbeek krijgt weken 1-8 (was verkeerd op Abdijschool id=6)
  {
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
    // Zoek kampmoment Abdijschool (Vlierbeek of gewone) week 1
    const _abdLoc=get("SELECT id FROM locaties WHERE name='Abdijschool Vlierbeek'")||get("SELECT id FROM locaties WHERE name='Abdijschool'");
    const _km25=_abdLoc?get('SELECT id FROM kampmomenten WHERE locatie_id=? AND week=1',[_abdLoc.id]):null;
    _themas25.forEach(t=>{
      const tid=_upsertThema(t);
      if(_km25) try{run('INSERT OR IGNORE INTO kampmoment_themas (kampmoment_id,thema_id) VALUES (?,?)',[_km25.id,tid]);}catch(e){}
    });
    console.log('  Migratie 25: 4 themas week 1 Abdijschool aangemaakt');
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

  // Migration 23: transporten uit oude database wissen (eenmalig)
  const _trCount=(get('SELECT COUNT(*) as n FROM transport_ritten')||{}).n||0;
  const _ttCount=(get('SELECT COUNT(*) as n FROM transport_taken')||{}).n||0;
  if(_trCount>0||_ttCount>0){
    try{
      ['verhuis_checks','transport_regels','transport_taken','transport_ritten','verplaatsingen']
        .forEach(t=>{try{run(`DELETE FROM ${t}`);}catch(e){}});
      console.log('  Migratie 23: transport- en verplaatsingsdata gewist');
    }catch(e){console.error('  Migratie 23 fout (niet-fataal):',e.message);}
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
    const{name,addr,type,contact_naam,contact_tel,notities,lat,lng,stockage_rol,parent_id}=req.body;
    run('UPDATE locaties SET name=?,addr=?,type=?,contact_naam=?,contact_tel=?,notities=?,lat=?,lng=?,stockage_rol=?,parent_id=? WHERE id=?',
      [name,addr||'',type||'kamp',contact_naam||'',contact_tel||'',notities||'',lat||null,lng||null,stockage_rol||'beide',parent_id||null,req.params.id]);
    const loc=get('SELECT * FROM locaties WHERE id=?',[req.params.id]);
    logAct('locatie','bewerkt',`Locatie "${loc.name}" bewerkt`,loc.id,loc.name);
    res.json(loc);
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
  app.post('/api/themas',(req,res)=>{const{name,color,categorie,leeftijdsgroep}=req.body;if(!name||!name.trim())return res.status(400).json({error:'Naam is verplicht'});const id=ins('INSERT INTO themas (name,color,categorie,leeftijdsgroep) VALUES (?,?,?,?)',[name.trim(),color||'#1D9E75',categorie||'',leeftijdsgroep||'']);res.json({...get('SELECT * FROM themas WHERE id=?',[id]),materiaal:[]});});
  app.put('/api/themas/:id',(req,res)=>{const cur=get('SELECT * FROM themas WHERE id=?',[req.params.id]);if(!cur)return res.status(404).json({error:'Thema niet gevonden'});const{name,color,categorie,leeftijdsgroep}=req.body;const nm=(name!==undefined&&name!==null)?name:cur.name;if(!nm||!nm.trim())return res.status(400).json({error:'Naam is verplicht'});run('UPDATE themas SET name=?,color=?,categorie=?,leeftijdsgroep=? WHERE id=?',[nm.trim(),color||cur.color||'#1D9E75',categorie!==undefined?categorie:(cur.categorie||''),leeftijdsgroep!==undefined?leeftijdsgroep:(cur.leeftijdsgroep||''),req.params.id]);res.json(get('SELECT * FROM themas WHERE id=?',[req.params.id]));});
  app.delete('/api/themas/:id',(req,res)=>{run('DELETE FROM thema_materiaal WHERE thema_id=?',[req.params.id]);run('DELETE FROM themas WHERE id=?',[req.params.id]);res.json({ok:true});});
  app.post('/api/themas/:id/materiaal',(req,res)=>{const{name,qty,stockage_locatie_id,stockage_code}=req.body;const id=ins('INSERT INTO thema_materiaal (thema_id,name,qty,stockage_locatie_id,stockage_code) VALUES (?,?,?,?,?)',[req.params.id,name,qty||1,stockage_locatie_id||null,stockage_code||'']);res.json(get('SELECT * FROM thema_materiaal WHERE id=?',[id]));});
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
  app.post('/api/standaard',(req,res)=>{const{name,qty,cat,stockage_locatie_id}=req.body;const id=ins('INSERT INTO standaard_materiaal (name,qty,cat,stockage_locatie_id) VALUES (?,?,?,?)',[name,qty||1,cat||'andere',stockage_locatie_id||null]);res.json(get('SELECT * FROM standaard_materiaal WHERE id=?',[id]));});
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
    const id=ins('INSERT INTO locatie_materiaal (locatie_id,name,qty,cat) VALUES (?,?,?,?)',[req.params.id,name,qty||1,cat||'andere']);
    res.json(get('SELECT * FROM locatie_materiaal WHERE id=?',[id]));
  });
  app.put('/api/locatie-materiaal/:id',(req,res)=>{
    const{name,qty,cat}=req.body;
    run('UPDATE locatie_materiaal SET name=?,qty=?,cat=? WHERE id=?',[name,qty||1,cat||'andere',req.params.id]);
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
        const id=ins('INSERT INTO locatie_materiaal (locatie_id,name,qty,cat) VALUES (?,?,?,?)',[req.params.id,s.name,s.qty,s.cat||'andere']);
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
  app.post('/api/materiaal',(req,res)=>{const{name,tracking,cat}=req.body;const id=ins('INSERT INTO materiaal_items (name,tracking,cat,created_at) VALUES (?,?,?,?)',[name,tracking||'per_type',cat||'andere',now()]);res.json({...get('SELECT * FROM materiaal_items WHERE id=?',[id]),eenheden:[]});});
  app.put('/api/materiaal/:id',(req,res)=>{const{name,tracking,cat}=req.body;run('UPDATE materiaal_items SET name=?,tracking=?,cat=? WHERE id=?',[name,tracking,cat,req.params.id]);res.json(get('SELECT * FROM materiaal_items WHERE id=?',[req.params.id]));});
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
    try{const id=ins('INSERT INTO chauffeurs (name) VALUES (?)',[name]);res.json(get('SELECT * FROM chauffeurs WHERE id=?',[id]));}
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
          Object.entries(byStockage(basisRegels)).forEach(([sid,mat])=>{
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

          if(vertrekkende.length||aankomende.length){
            const ophaalMat=vertrekkende.flatMap(kt=>{const th=themas.find(t=>t.id===kt.thema_id);return thema_mat.filter(m=>m.thema_id===kt.thema_id).map(m=>({naam:'['+(th?.name||'?')+'] '+m.name,qty:m.qty,soort:'thema',stockage_id:m.stockage_locatie_id||themaStockageId}));});
            const leverMat=aankomende.flatMap(kt=>{const th=themas.find(t=>t.id===kt.thema_id);return thema_mat.filter(m=>m.thema_id===kt.thema_id).map(m=>({naam:'['+(th?.name||'?')+'] '+m.name,qty:m.qty,soort:'thema',stockage_id:m.stockage_locatie_id||themaStockageId}));});
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
          Object.entries(byStockage(basisRegels)).forEach(([sid,mat])=>{
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
    ids.forEach(id=>run("UPDATE transport_taken SET rit_id=NULL,datum='',wie='' WHERE id=? AND COALESCE((SELECT spoed_kind FROM transport_taken WHERE id=?),'') != 1",[id,id]));
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
  app.post('/api/transport-taken',(req,res)=>{const{type,datum,tijd,van_locatie_id,naar_locatie_id,opmerking,wie,kampmoment_id,regels,rit_id,week}=req.body;const id=ins('INSERT INTO transport_taken (type,datum,tijd,van_locatie_id,naar_locatie_id,opmerking,wie,kampmoment_id,status,created_at,rit_id,week) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',[type,datum||'',tijd||'09:00',van_locatie_id||null,naar_locatie_id||null,opmerking||'',wie||'',kampmoment_id||null,'gepland',now(),rit_id||null,week||null]);if(regels&&regels.length)regels.forEach(r=>ins('INSERT INTO transport_regels (taak_id,naam,qty,soort) VALUES (?,?,?,?)',[id,r.naam,r.qty||1,r.soort||'andere']));const taak=get('SELECT * FROM transport_taken WHERE id=?',[id]);const tr=all('SELECT * FROM transport_regels WHERE taak_id=?',[id]);res.json({...taak,regels:tr});});
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
  app.post('/api/transport-regels',(req,res)=>{const{taak_id,naam,qty,soort}=req.body;const id=ins('INSERT INTO transport_regels (taak_id,naam,qty,soort) VALUES (?,?,?,?)',[taak_id,naam,qty||1,soort||'andere']);res.json(get('SELECT * FROM transport_regels WHERE id=?',[id]));});
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
    const id=ins('INSERT INTO bak_items (bak_id,naam,qty,verbruik,qty_per_gebruik,eenheid,qty_stock,qty_minimum,notitie) VALUES (?,?,?,?,?,?,?,?,?)',
      [req.params.id,naam,qty||1,verbruik?1:0,qty_per_gebruik||1,eenheid||'stuks',qty_stock||0,qty_minimum||0,notitie||'']);
    res.json(get('SELECT * FROM bak_items WHERE id=?',[id]));
  });
  app.put('/api/bak-items/:id',(req,res)=>{
    const{naam,qty,verbruik,qty_per_gebruik,eenheid,qty_stock,qty_minimum,notitie}=req.body;
    const cur=get('SELECT * FROM bak_items WHERE id=?',[req.params.id]);
    if(!cur)return res.status(404).json({error:'Item niet gevonden'});
    run('UPDATE bak_items SET naam=?,qty=?,verbruik=?,qty_per_gebruik=?,eenheid=?,qty_stock=?,qty_minimum=?,notitie=? WHERE id=?',
      [naam??cur.naam,qty??cur.qty,verbruik!==undefined?(verbruik?1:0):cur.verbruik,
       qty_per_gebruik??cur.qty_per_gebruik,eenheid??cur.eenheid,
       qty_stock??cur.qty_stock,qty_minimum??cur.qty_minimum,notitie??cur.notitie,req.params.id]);
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
      ins('INSERT INTO verhuis_checks (rit_id,item_naam,item_soort,qty,status,sort_order) VALUES (?,?,?,?,?,?)',
        [rit_id,r.naam,r.soort||'andere',r.qty||1,'wacht',i]);
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
    const id = ins('INSERT INTO sport_items (name,cat,notities,stockage_locatie_id,locatie_id) VALUES (?,?,?,?,?)', [name, cat||'sport', notities||'', stockage_locatie_id||null, locatie_id||null]);
    res.json({...get('SELECT si.*, l.name as locatie_name FROM sport_items si LEFT JOIN locaties l ON l.id=si.locatie_id WHERE si.id=?', [id]), sets: []});
  });
  app.put('/api/sport/:id', (req,res) => {
    const {name,cat,notities,stockage_locatie_id,locatie_id} = req.body;
    run('UPDATE sport_items SET name=?,cat=?,notities=?,stockage_locatie_id=?,locatie_id=? WHERE id=?', [name,cat||'sport',notities||'',stockage_locatie_id||null,locatie_id||null,req.params.id]);
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
    const id = ins('INSERT INTO gedeeld_items (name,cat,totaal,notities,stockage_locatie_id) VALUES (?,?,?,?,?)', [name, cat||'gedeeld', totaal||1, notities||'', stockage_locatie_id||null]);
    res.json({...get('SELECT * FROM gedeeld_items WHERE id=?', [id]), gebruik: [], weekConflicts: {}});
  });
  app.put('/api/gedeeld/:id', (req,res) => {
    const {name,cat,totaal,notities,stockage_locatie_id} = req.body;
    run('UPDATE gedeeld_items SET name=?,cat=?,totaal=?,notities=?,stockage_locatie_id=? WHERE id=?', [name,cat||'gedeeld',totaal||1,notities||'',stockage_locatie_id||null,req.params.id]);
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
    ins('INSERT INTO transport_regels (taak_id,naam,qty,soort) VALUES (?,?,?,?)',[taakId,naam,aantal,'spoed']);
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
        extra.sets=all('SELECT ss.*,l.name AS loc_naam FROM sport_sets ss LEFT JOIN locaties l ON ss.locatie_id=l.id WHERE ss.sport_id=? ORDER BY ss.label',[id]);
        extra.fotos=all('SELECT id,tijdstip,wie FROM sport_fotos WHERE sport_id=? ORDER BY id DESC LIMIT 10',[id]);
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
    res.send(`const CACHE='sporty-v2';const SHELL=['/'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL))));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  if(e.request.url.includes('/api/')||e.request.url.includes('/rit/')){
    e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
  } else {
    e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{const clone=res.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));return res;})));
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
