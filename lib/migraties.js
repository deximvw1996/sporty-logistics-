// lib/migraties.js — SCHEMA MIGRATIONS uit server.js geknipt (F1 deel 1). Volgorde en inhoud letterlijk gelijk.
'use strict';
const path = require('path');
const fs = require('fs');
module.exports = function(dbx, ctx){
  const {db,get,all,run,ins,saveDb,now,isoDate,_genToken,resolveItemTypeId,logAct} = dbx;
  const __dirname = ctx.ROOT_DIR;
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
  // T4-G1: de oude backfill (elke taak zonder rit krijgt een eigen rit) draaide bij elke start en is weggehaald: taken zonder rit blijven zonder rit.

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
  }
  // Walkthrough Maxim 2026-08-04: "zelf kuisen"-eigenschap per locatie (zoals de oven-vlag),
  // bruikbaar als voorwaarde voor kuisbak/borstel/aftrekker in de locatieconfig. Buiten de
  // migratie-38-gate zodat hij ook op bestaande databases bijkomt.
  addColumnIfMissing('locaties','zelf_kuisen',"INTEGER DEFAULT 0");
  {
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

  // ── Migratie 62 — S4.5: Themabehoefte aan pool-materiaal ──
  // (a) thema_behoefte: "N stuks van vast_type X nodig" per thema (zoals locatie_config, maar
  // thema-gedreven i.p.v. locatie-gedreven). (b) blazers_nodig op bakken: enkel relevant voor
  // vast_type springkasteel/waterstructuur, default 1. (c) frame-herstructurering (L31): de losse
  // "alleen frame"-attributen worden pool-eenheden (vast_type='themaframe') + een thema_behoefte-
  // regel "1×themaframe"; combinatie-attributen ("Frame en doek X") blijven ONGEMOEID staan — dat
  // zijn thema-eigen fysieke stukken, geen generiek pool-frame (documentatie in eindrapport S4.5c).
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS thema_behoefte (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thema_id INTEGER NOT NULL,
    vast_type TEXT NOT NULL DEFAULT '',
    aantal INTEGER DEFAULT 1,
    notitie TEXT DEFAULT ''
  )`);
  addColumnIfMissing('bakken','blazers_nodig','INTEGER DEFAULT 1');
  addColumnIfMissing('bakken','notitie',"TEXT DEFAULT ''");
  addColumnIfMissing('thema_behoefte','bak_id','INTEGER');
  // Migratie 64 (walkthrough Maxim 2026-08-04): springkasteel-behoeften wijzen een SPECIFIEK
  // kasteel aan (naam in de regel, niet in een notitie) + standaardmateriaal-pool + escape-koppeling.
  {
    const _vlag64=get("SELECT naam FROM app_vlaggen WHERE naam='migratie64_klaar'");
    if(!_vlag64){
      try{
        const kasteel=n=>get("SELECT id FROM bakken WHERE soort='vast' AND vast_type='springkasteel' AND naam LIKE ?",[n]);
        const zet=(themaNaam,kasteelNamen)=>{
          const th=get('SELECT id FROM themas WHERE name=?',[themaNaam]); if(!th)return;
          run("DELETE FROM thema_behoefte WHERE thema_id=? AND vast_type='springkasteel' AND (bak_id IS NULL OR bak_id='')",[th.id]);
          kasteelNamen.forEach(kn=>{const k=kasteel(kn); if(k&&!get('SELECT id FROM thema_behoefte WHERE thema_id=? AND bak_id=?',[th.id,k.id]))
            ins('INSERT INTO thema_behoefte (thema_id,vast_type,aantal,notitie,bak_id) VALUES (?,?,1,?,?)',[th.id,'springkasteel','Migratie 64: specifiek exemplaar (Maxim: naam in de regel)',k.id]);});
        };
        zet('Holderdebolder',['Klein springkasteel - jungle','Groot springkasteel - kasteel','Kleuterhindernisbaan']);
        zet('Holderdebolder (themadag)',['Klein springkasteel - jungle','Groot springkasteel - kasteel','Kleuterhindernisbaan']);
        zet('Alles op wieltjes',['Opblaasbaar fietsparcours']);
        zet('Jumpen!',['Klein springkasteel - jungle']);
        zet('Jumpen (themadag)',['Klein springkasteel - jungle']);
        // Standaardmateriaal-pool (aantallen nog in te vullen door Maxim)
        const roz=get("SELECT id FROM locaties WHERE name LIKE '%Rozenweg%'");
        [['Muziekbox','muziekbox'],['Programmabord','programmabord'],['Creakoffer','creakoffer'],
         ['Sportkoffer lagere school','sportkoffer_ls'],['Sportkoffer kleuters','sportkoffer_kl'],
         ['Adminkastje','adminkastje'],['Vlagvoet','vlagvoet'],['Vlag','vlag']].forEach(([naam,vt])=>{
          if(!get("SELECT id FROM bakken WHERE soort='vast' AND vast_type=?",[vt])){
            const id=ins("INSERT INTO bakken (naam,code,soort,vast_type,thuislocatie_id,huidige_locatie_id,status,aantal,is_bulk,notitie) VALUES (?,?,?,?,?,?,?,?,?,?)",
              [naam,'','vast',vt,roz?roz.id:null,roz?roz.id:null,'thuis',1,1,'standaardmateriaal (Maxim 2026-08-04) — totaal aantal nog invullen']);
            if(roz)ins('INSERT OR IGNORE INTO bulk_spreiding (bak_id,locatie_id,aantal) VALUES (?,?,1)',[id,roz.id]);
          }
        });
        // Escape-curvers ook aan TD "Spionnen gezocht" koppelen
        const tdSpion=get("SELECT id FROM themas WHERE name='Spionnen gezocht' AND categorie='themadag'");
        if(tdSpion){
          all("SELECT id FROM bakken WHERE naam LIKE '%Ontmantel de bom%' OR naam LIKE '%V-express%'").forEach(b=>{
            if(!get('SELECT id FROM thema_bak WHERE thema_id=? AND bak_id=?',[tdSpion.id,b.id]))
              ins('INSERT INTO thema_bak (thema_id,bak_id) VALUES (?,?)',[tdSpion.id,b.id]);
          });
        }
        ins("INSERT INTO app_vlaggen (naam) VALUES ('migratie64_klaar')");saveDb();
        console.log('  Migratie 64: specifieke kasteel-behoeften + standaardmateriaal + escape-TD-koppeling');
      }catch(e){console.error('  Migratie 64 FOUT:',e.message);}
    }
  }
  {
    const _vlag62=get("SELECT naam FROM app_vlaggen WHERE naam='migratie62_klaar'");
    if(!_vlag62){
      try{
        // (b) blazerbehoefte per springkasteel/waterstructuur-exemplaar
        run("UPDATE bakken SET blazers_nodig=2 WHERE naam='Kleuterhindernisbaan' AND vast_type='springkasteel'");
        run("UPDATE bakken SET blazers_nodig=2, notitie='aanname Maxim 2026-08-04: 2 blazers voor 2 delen — verifiëren' WHERE naam='Hindernisbaan lagere school (2 delen)' AND vast_type='springkasteel'");
        run("UPDATE bakken SET blazers_nodig=1 WHERE naam LIKE 'Waterglijbaan%' AND vast_type IN ('springkasteel','waterstructuur')");
        run("UPDATE bakken SET blazers_nodig=1 WHERE vast_type IN ('springkasteel','waterstructuur') AND blazers_nodig IS NULL");

        // (c) frame-pool: 3 themaframe-exemplaren, aantal onbekend (voorlopig)
        const _thuisId62=(get("SELECT id FROM locaties WHERE name LIKE '%Rozenweg%' LIMIT 1")||{}).id||null;
        for(let i=1;i<=3;i++){
          ins('INSERT INTO bakken (naam,code,soort,vast_type,thuislocatie_id,huidige_locatie_id,status,notitie) VALUES (?,?,?,?,?,?,?,?)',
            ['Themaframe #'+i,'','vast','themaframe',_thuisId62,_thuisId62,'thuis','aantal frames verifiëren (Maxim) — voorlopig 3 aangemaakt, S4.5c']);
        }
        // "Alleen frame"-attributen → 1×themaframe-behoefte, attribuut + themakoppeling weg.
        // Combinatie-attributen ("Frame en/met doek...") blijven bestaan — zie migratieopmerking hierboven.
        const _alleenFrameNamen=[
          'Frame (Circus Krokofant themadag)',
          'Frame (Op avontuur in de ruimte themadag)',
          'Frame grote piratenboot (themadag)',
          'Frame (School voor hekserij themadag)',
          'Frame (Sprookjesland themadag)'
        ];
        let _framesGeconverteerd=0;
        _alleenFrameNamen.forEach(naam=>{
          const attr=get('SELECT * FROM attributen WHERE naam=?',[naam]);
          if(!attr)return;
          const koppelingen=all('SELECT thema_id FROM thema_attribuut WHERE attribuut_id=?',[attr.id]);
          koppelingen.forEach(k=>{
            const bestaat=get("SELECT id FROM thema_behoefte WHERE thema_id=? AND vast_type='themaframe'",[k.thema_id]);
            if(!bestaat) ins("INSERT INTO thema_behoefte (thema_id,vast_type,aantal,notitie) VALUES (?,?,1,?)",
              [k.thema_id,'themaframe','omgezet uit attribuut "'+naam+'" (S4.5c, 2026-08-04)']);
          });
          run('DELETE FROM thema_attribuut WHERE attribuut_id=?',[attr.id]);
          run('DELETE FROM attributen WHERE id=?',[attr.id]);
          _framesGeconverteerd++;
        });

        // (f) eerste themabehoefte-data uit de bestaande INFO-regels (thema-namen exact zoals in db)
        function _behoefteVoorNaam(naam,regels){
          const th=get('SELECT id FROM themas WHERE name=?',[naam]);
          if(!th){ console.error('  Migratie 62: thema "'+naam+'" niet gevonden — behoefte-regels overgeslagen'); return; }
          regels.forEach(r=>{
            const bestaat=get('SELECT id FROM thema_behoefte WHERE thema_id=? AND vast_type=?',[th.id,r.vt]);
            if(!bestaat) ins('INSERT INTO thema_behoefte (thema_id,vast_type,aantal,notitie) VALUES (?,?,?,?)',
              [th.id,r.vt,r.aantal||1,r.notitie||'']);
          });
        }
        _behoefteVoorNaam('Alles op wieltjes',[
          {vt:'verkeerskoffer',aantal:1},
          {vt:'kleuterfiets',aantal:17},
          {vt:'loopfiets',aantal:4},
          {vt:'loopwagen',aantal:5},
          {vt:'zitfiets',aantal:2},
          {vt:'easy_roller',aantal:3},
          {vt:'springkasteel',aantal:1,notitie:'fietsparcours'}
        ]);
        // Holderdebolder: 2 springkastelen (jungle+kasteel) + kleuterhindernisbaan (apart geteld,
        // want eigen blazers_nodig=2) + 4 wesco — thema_behoefte heeft geen UNIQUE op (thema,vast_type),
        // dus één samengevoegde regel aantal=3 met notitie die het opsplitst (i.p.v. 2 losse rijen
        // die niet te onderscheiden zouden zijn).
        _behoefteVoorNaam('Holderdebolder',[
          {vt:'springkasteel',aantal:3,notitie:'2× jungle/kasteel (1 blazer elk) + 1× kleuterhindernisbaan (2 blazers) — piekbehoefte via dagplanning, zie S4.5e'},
          {vt:'wesco_pakket',aantal:4}
        ]);
        _behoefteVoorNaam('Jumpen!',[
          {vt:'springkasteel',aantal:3,notitie:'klein (jungle) + groot (kasteel) ma-do, kleuterhindernisbaan vrijdag — piek per dag is lager dan de som, zie S4.5e; mapping verifiëren'}
        ]);
        _behoefteVoorNaam('Jumpen (themadag)',[
          {vt:'springkasteel',aantal:2,notitie:'2 kleine springkastelen 3x3m; mapping verifiëren'},
          {vt:'compressor',aantal:1,notitie:'aantal compressors bij Sporty onbekend'}
        ]);
        _behoefteVoorNaam('Jumpen XL',[
          {vt:'springkasteel',aantal:2,notitie:'aanname Maxim: zelfde pool als kampversie, geen materiaalfiche — verifiëren'}
        ]);
        _behoefteVoorNaam('Jump around',[
          {vt:'springkasteel',aantal:4,notitie:'4 opblaasstructuren (Colorslide, Swing him off, Levende tafelvoetbal, Hindernisbaan LS) — blazer-behoefte per structuur verifiëren'}
        ]);
        _behoefteVoorNaam('CLIC IT',[
          {vt:'clics_bak',aantal:2,notitie:'fiche: bouwsteentjes in 12 dozen/grote plox — mapping op 4 geregistreerde clics-bakken verifiëren'}
        ]);
        _behoefteVoorNaam('Clic-it (themadag)',[
          {vt:'clics_bak',aantal:2,notitie:'fiche: 2 bakken Clics + 1 bak wieltjes — zelfde pool als CLIC IT'}
        ]);
        _behoefteVoorNaam('Blokkenbouwdoos',[
          {vt:'houtenblokken_koffer',aantal:2},
          {vt:'duplo_bak',aantal:7},
          {vt:'kruiwagen',aantal:16},
          {vt:'softlego_bak',aantal:2},
          {vt:'bouwhelm',aantal:20}
        ]);
        // Kookthema's: kookvuur/oven/afwasbak/kookbak/verlengdraadkoffer uit hun INFO-regels
        _behoefteVoorNaam('De vloek van de farao',[{vt:'oven',aantal:1,notitie:'verifiëren'},{vt:'afwasbak',aantal:1,notitie:'verifiëren'}]);
        _behoefteVoorNaam('Feestje bouwen!',[{vt:'kookbak',aantal:1,notitie:'verifiëren'},{vt:'afwasbak',aantal:1,notitie:'verifiëren'}]);
        _behoefteVoorNaam('Koekjesfabriek',[{vt:'kookbak',aantal:1,notitie:'verifiëren'},{vt:'afwasbak',aantal:1,notitie:'verifiëren'},{vt:'oven',aantal:2}]);
        _behoefteVoorNaam('Later als ik groot ben',[{vt:'verkeerskoffer',aantal:1,notitie:'verifiëren'},{vt:'kookbak',aantal:1,notitie:'verifiëren'},{vt:'afwasbak',aantal:1,notitie:'verifiëren'}]);
        _behoefteVoorNaam('Sprookjesland',[{vt:'kookbak',aantal:1,notitie:'verifiëren, alleen 5-daagse fiche'},{vt:'afwasbak',aantal:1,notitie:'verifiëren, alleen 5-daagse fiche'}]);
        _behoefteVoorNaam('Ambachtenacademie',[{vt:'kookvuur',aantal:1,notitie:'verifiëren'},{vt:'kookbak',aantal:1,notitie:'verifiëren'},{vt:'afwasbak',aantal:1,notitie:'verifiëren'},{vt:'oven',aantal:2}]);
        _behoefteVoorNaam('Dagelijkse Sportykost',[{vt:'kookbak',aantal:1,notitie:'verifiëren'},{vt:'kookvuur',aantal:2},{vt:'oven',aantal:2},{vt:'afwasbak',aantal:1,notitie:'verifiëren'}]);
        _behoefteVoorNaam('Experimenteerfabriek',[{vt:'kookvuur',aantal:1,notitie:'verifiëren'}]);
        _behoefteVoorNaam('Festivalfood',[{vt:'kookbak',aantal:1,notitie:'verifiëren'},{vt:'afwasbak',aantal:1,notitie:'verifiëren'},{vt:'oven',aantal:1,notitie:'verifiëren'}]);
        _behoefteVoorNaam('Koekiemonsters',[{vt:'afwasbak',aantal:1,notitie:'verifiëren'},{vt:'oven',aantal:2}]);
        _behoefteVoorNaam('Wereldkeuken',[{vt:'afwasbak',aantal:1,notitie:'verifiëren'}]);
        _behoefteVoorNaam('Zoete toetjes',[{vt:'oven',aantal:2},{vt:'kookvuur',aantal:1,notitie:'verifiëren'},{vt:'afwasbak',aantal:2},{vt:'verlengdraadkoffer',aantal:1,notitie:'verifiëren'}]);
        _behoefteVoorNaam('Koekiemonstertjes',[{vt:'oven',aantal:1,notitie:'"oventjes", exact aantal verifiëren'},{vt:'afwasbak',aantal:1,notitie:'verifiëren'}]);
        _behoefteVoorNaam('Pizza pronto',[{vt:'kookbak',aantal:1,notitie:'verifiëren'},{vt:'afwasbak',aantal:1,notitie:'verifiëren'},{vt:'oven',aantal:2}]);
        _behoefteVoorNaam('Wij worden kleuterchefs',[{vt:'oven',aantal:2},{vt:'kookbak',aantal:1,notitie:'verifiëren'},{vt:'afwasbak',aantal:1,notitie:'verifiëren'}]);
        _behoefteVoorNaam('Apenstreken',[{vt:'kookvuur',aantal:1,notitie:'verifiëren'}]);
        _behoefteVoorNaam('Apero go',[{vt:'kookbak',aantal:1,notitie:'verifiëren'},{vt:'afwasbak',aantal:1,notitie:'verifiëren'}]);
        _behoefteVoorNaam('Bake off',[{vt:'oven',aantal:2},{vt:'afwasbak',aantal:1,notitie:'verifiëren'},{vt:'kookbak',aantal:1,notitie:'verifiëren'}]);
        _behoefteVoorNaam('De bakkerij (themadag)',[{vt:'kookbak',aantal:1,notitie:'verifiëren'},{vt:'afwasbak',aantal:1,notitie:'verifiëren'},{vt:'oven',aantal:2}]);
        _behoefteVoorNaam('Koekjesfabriek (themadag)',[{vt:'oven',aantal:1,notitie:'"oventjes", exact aantal verifiëren'},{vt:'afwasbak',aantal:1,notitie:'verifiëren'}]);
        _behoefteVoorNaam('Wafels en pannenkoeken',[{vt:'afwasbak',aantal:1,notitie:'verifiëren'}]);
        _behoefteVoorNaam('Wereldkeuken (themadag)',[{vt:'kookbak',aantal:1,notitie:'verifiëren'},{vt:'afwasbak',aantal:1,notitie:'verifiëren'},{vt:'kookvuur',aantal:1,notitie:'verifiëren'}]);
        _behoefteVoorNaam('Zoete toetjes (themadag)',[{vt:'kookvuur',aantal:1,notitie:'verifiëren'}]);

        const _nBehoefte62=(get('SELECT COUNT(*) AS n FROM thema_behoefte')||{}).n||0;
        console.log(`  Migratie 62: S4.5 themabehoefte gebouwd — ${_nBehoefte62} regels, ${_framesGeconverteerd} frame-attributen omgezet, 3 themaframe-exemplaren aangemaakt`);
        ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie62_klaar','1')");
      }catch(e){ console.error('  Migratie 62 fout — vlag NIET gezet, probeert opnieuw bij volgende start:',e.message); }
    }
  }

  // ── Migratie 63 — S4.5g: BULK-POOL ──
  // Bulk-materiaal (enkel het aantal telt, geen individuele identiteit: kleuterfietsen,
  // loopfietsen, loopwagens, zitfietsen, easy rollers, rolplanken+stokken, bouwhelmen,
  // kruiwagens, verlengdraadkoffers, WESCO-pakketten, blazers, duplo-/softlego-/clics-bakken,
  // compressors, iglo-blokken) vs UNIEKE pool-exemplaren (springkastelen, verkeerskoffers,
  // kookuitrusting, EHBO-koffers, GPS-bak, themaframes — S4.5d-gedrag, NIET aangeraakt).
  // Onderscheid via een expliciete `is_bulk`-kolom op `bakken` (i.p.v. een impliciete
  // vast_type-conventie): duidelijker leesbaar/query'baar, en een toekomstig nieuw vast_type
  // kan per stuk bewust bulk of uniek gezet worden zonder een aparte lijst te moeten bijhouden.
  // `aantal` = totaal in bezit (default 1; voor unieke rijen altijd 1). Spreiding per locatie in
  // de nieuwe tabel bulk_spreiding(bak_id, locatie_id, aantal) — startstand: alles thuis.
  addColumnIfMissing('bakken','aantal','INTEGER DEFAULT 1');
  addColumnIfMissing('bakken','is_bulk','INTEGER DEFAULT 0');
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS bulk_spreiding (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bak_id INTEGER NOT NULL,
    locatie_id INTEGER NOT NULL,
    aantal INTEGER DEFAULT 0,
    UNIQUE(bak_id, locatie_id)
  )`);
  {
    const _vlag63=get("SELECT naam FROM app_vlaggen WHERE naam='migratie63_klaar'");
    if(!_vlag63){
      try{
        let _nSamengevouwen=0,_nRijenVoor=0,_nRijenNa=0;
        // Reeksen "Naam N" (trailing nummer, zelfde vast_type) samenvouwen tot 1 bulk-rij met
        // aantal=aantal_rijen. Enkel samenvouwen als alle rijen dezelfde basisnaam (zonder
        // trailing nummer) delen — anders NIET aanraken en loggen (twijfelgeval, VRAGENLOG).
        function _vouwSamen(vastType,matchFn,groepLabel){
          const rijen=all("SELECT * FROM bakken WHERE soort='vast' AND vast_type=?",[vastType]).filter(matchFn||(()=>true));
          _nRijenVoor+=rijen.length;
          if(rijen.length<2){ _nRijenNa+=rijen.length; return; }
          const basisNamen=new Set(rijen.map(r=>r.naam.replace(/\s+\d+$/,'').trim()));
          if(basisNamen.size!==1){
            console.error(`  Migratie 63: "${groepLabel||vastType}" heeft verschillende basisnamen (${[...basisNamen].join(' | ')}) — NIET samengevouwen (zie VRAGENLOG)`);
            _nRijenNa+=rijen.length;
            return;
          }
          const basisNaam=[...basisNamen][0];
          rijen.sort((a,b)=>a.id-b.id);
          const houder=rijen[0],rest=rijen.slice(1),totaal=rijen.length;
          run('UPDATE bakken SET naam=?,aantal=?,is_bulk=1 WHERE id=?',[basisNaam,totaal,houder.id]);
          run('INSERT OR IGNORE INTO bulk_spreiding (bak_id,locatie_id,aantal) VALUES (?,?,?)',
            [houder.id,houder.thuislocatie_id,totaal]);
          rest.forEach(r=>run('DELETE FROM bakken WHERE id=?',[r.id]));
          _nSamengevouwen++;_nRijenNa+=1;
          console.log(`  Migratie 63: ${groepLabel||vastType} ${totaal}→1 (aantal=${totaal})`);
        }
        const _bulkTypes=['kleuterfiets','loopfiets','loopwagen','zitfiets','easy_roller','rolplank','rolplank_stok',
          'bouwhelm','kruiwagen','verlengdraadkoffer','wesco_pakket','duplo_bak','softlego_bak','clics_bak','compressor','iglo_blok'];
        _bulkTypes.forEach(vt=>{ if(vt!=='blazer') _vouwSamen(vt,null,vt); });
        // Blazer: 2 wattage-groepen i.p.v. 1 grote groep (generator maakt zwaarste — 1500W —
        // eerst op, zie _themaBehoefteRegels/_blazerRegels).
        _vouwSamen('blazer',r=>r.naam.includes('1500W'),'blazer 1500W');
        _vouwSamen('blazer',r=>r.naam.includes('1000W'),'blazer 1000W');
        console.log(`  Migratie 63: BULK-POOL — ${_nSamengevouwen} reeksen samengevouwen, rijen ${_nRijenVoor}→${_nRijenNa}`);
        ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie63_klaar','1')");
      }catch(e){ console.error('  Migratie 63 fout — vlag NIET gezet, probeert opnieuw bij volgende start:',e.message); }
    }
  }

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

  // Migratie 56 (veiligheidsronde, DOORLICHTING-c #4): pincode-opslag gaat van ongezouten SHA-256
  // naar scrypt met een salt per persoon. Een bestaande SHA-256-hash kan niet herrekend worden
  // zonder de pincode zelf; daarom krijgt elke kale 64-hex-hash hier enkel het expliciete label
  // 'sha256$…' (geen dataverlies, blijft werken) en wordt hij bij de eerstvolgende GESLAAGDE login
  // door verifieerPin/login naar 'scrypt$salt$hash' omgezet. Vlag ALLEEN bij succes (patroon 52).
  {
    const _vlag56=get("SELECT naam FROM app_vlaggen WHERE naam='migratie56_klaar'");
    if(!_vlag56){
      try{
        const _rijen56=all("SELECT id,pincode FROM personeel WHERE pincode IS NOT NULL AND pincode<>''");
        let _n56=0;
        _rijen56.forEach(r=>{ if(/^[0-9a-f]{64}$/i.test(r.pincode)){ db.run('UPDATE personeel SET pincode=? WHERE id=?',['sha256$'+r.pincode.toLowerCase(),r.id]); _n56++; } });
        console.log(`  Migratie 56: ${_n56} SHA-256-pincodes gelabeld (worden scrypt bij volgende geslaagde login)`);
        ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie56_klaar','1')");
      }catch(e){ console.error('  Migratie 56 fout — vlag NIET gezet, probeert opnieuw bij volgende start:',e.message); }
    }
  }

  // Migratie 65 (F1 deel 3): wijzigingslog — elke INSERT/UPDATE/DELETE op de logistieke kern
  // (bakken, transport_taken, transport_ritten, aanvragen, kampmomenten) schrijft de hele oude en
  // nieuwe rij als JSON. Gegate op app_vlaggen; vlag ALLEEN bij succes (patroon 56).
  {
    const _vlag65=get("SELECT naam FROM app_vlaggen WHERE naam='migratie65_klaar'");
    if(!_vlag65){
      try{
        db.run(`CREATE TABLE IF NOT EXISTS wijzigingen (
          id INTEGER PRIMARY KEY,
          tijdstip TEXT,
          persoon_id INTEGER,
          persoon_naam TEXT,
          tabel TEXT,
          rij_id INTEGER,
          actie TEXT CHECK(actie IN ('insert','update','delete')),
          oud TEXT,
          nieuw TEXT,
          context TEXT
        )`);
        db.run('CREATE INDEX IF NOT EXISTS idx_wijzigingen_tabel_rij ON wijzigingen (tabel, rij_id)');
        ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie65_klaar','1')");
        console.log('  Migratie 65: tabel wijzigingen + index (tabel, rij_id) aangemaakt');
      }catch(e){ console.error('  Migratie 65 fout — vlag NIET gezet, probeert opnieuw bij volgende start:',e.message); }
    }
  }

  // V3a: koppeling aanvraag↔spoedtaak + idempotentie-vlag per transportregel (bak/bulk al verplaatst).
  addColumnIfMissing('transport_taken','aanvraag_id','INTEGER DEFAULT NULL');
  addColumnIfMissing('transport_regels','verplaatsing_uitgevoerd','INTEGER DEFAULT 0');
  // Migratie 70 (V3c): foto's van base64-in-sqlite naar bestanden in uploads/. Voegt foto_path-kolommen toe en schrijft
  // bestaande data:-/base64-foto's éénmalig weg (bakken.foto_opgeplooid/opgezet, bak_fotos, attributen, aanvragen).
  // De legacy-kolom krijgt de URL '/uploads/<pad>'. Een rij waarvan de decodering faalt wordt overgeslagen en gelogd
  // (base64 blijft staan). Gegate: vlag alleen bij succes; herstart doet niets meer (rijen met URL worden niet aangeraakt).
  {
    const _vlag70=get("SELECT naam FROM app_vlaggen WHERE naam='migratie70_klaar'");
    if(!_vlag70){
      try{
        addColumnIfMissing('bakken','foto_opgeplooid_path',"TEXT DEFAULT ''");
        addColumnIfMissing('bakken','foto_opgezet_path',"TEXT DEFAULT ''");
        addColumnIfMissing('bak_fotos','foto_path',"TEXT DEFAULT ''");
        addColumnIfMissing('attributen','foto_path',"TEXT DEFAULT ''");
        addColumnIfMissing('aanvragen','foto_path',"TEXT DEFAULT ''");
        const fotoLib=require('./fotos')(ctx.UPLOADS_DIR);
        let gelukt=0,overgeslagen=0;
        const doe=(tabel,kolom,padKolom)=>{
          for(const r of all(`SELECT id,${kolom} AS d FROM ${tabel} WHERE ${kolom}<>'' AND ${kolom} IS NOT NULL AND ${kolom} NOT LIKE '/uploads/%'`)){
            try{
              const rel=fotoLib.bewaarFoto(r.d,tabel==='bakken'?'bak':tabel==='bak_fotos'?'bakfoto':tabel==='attributen'?'attribuut':'aanvraag');
              run(`UPDATE ${tabel} SET ${kolom}=?,${padKolom}=? WHERE id=?`,[fotoLib.url(rel),rel,r.id]);gelukt++;
            }catch(e){overgeslagen++;console.warn(`  Migratie 70: ${tabel}#${r.id}.${kolom} overgeslagen (${e.message})`);}
          }
        };
        doe('bakken','foto_opgeplooid','foto_opgeplooid_path');
        doe('bakken','foto_opgezet','foto_opgezet_path');
        doe('bak_fotos','foto_data','foto_path');
        doe('attributen','foto_data','foto_path');
        doe('aanvragen','foto_data','foto_path');
        // Weggeschreven base64 laat lege pagina's achter in het db-bestand; VACUUM geeft ze terug (anders blijft het bestand even groot).
        if(gelukt>0){ try{ db.run('VACUUM'); }catch(e){ console.warn('  Migratie 70: VACUUM mislukt (niet erg, bestand blijft groter):',e.message); } }
        ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie70_klaar','1')");
        console.log(`  Migratie 70: ${gelukt} foto's naar uploads/ geschreven, ${overgeslagen} overgeslagen`);
      }catch(e){ console.error('  Migratie 70 fout — vlag NIET gezet, probeert opnieuw bij volgende start:',e.message); }
    }
  }

  // ── Migratie 71 — V2: dynamische periodes ──
  // (a) vakantieperiodes.actief: precies één actieve periode in de server (niet meer "de eerste met
  //     kampmomenten" in de browser). Startwaarde: de periode met de meeste kampmomenten, anders de laatst aangemaakte.
  // (b) sport_planning + locatie_kleuren krijgen periode_id (backfill: periode van het kampmoment op
  //     dezelfde locatie+week, bij meerdere de actieve, anders de actieve periode).
  // (c) UNIQUE-sleutels krijgen de periode erbij: kampmomenten(locatie_id,week,periode_id),
  //     sport_planning(set_id,week,periode_id), locatie_kleuren(locatie_id,week,kleur,periode_id).
  //     SQLite kan een constraint niet wijzigen → tabel herbouwen met de eigen CREATE-tekst (alle
  //     kolommen, FK's en defaults blijven), foreign_keys tijdelijk UIT zodat DROP geen
  //     kampmoment_themas/personeel_shifts meesleurt (ON DELETE CASCADE / SET NULL).
  addColumnIfMissing('vakantieperiodes','actief','INTEGER DEFAULT 0');
  addColumnIfMissing('sport_planning','periode_id','INTEGER');
  addColumnIfMissing('locatie_kleuren','periode_id','INTEGER');
  {
    const _vlag71=get("SELECT naam FROM app_vlaggen WHERE naam='migratie71_klaar'");
    if(!_vlag71){
      try{
        if(!get('SELECT id FROM vakantieperiodes WHERE actief=1')){
          const kies=get('SELECT p.id FROM vakantieperiodes p LEFT JOIN kampmomenten k ON k.periode_id=p.id GROUP BY p.id HAVING COUNT(k.id)>0 ORDER BY COUNT(k.id) DESC, p.id DESC LIMIT 1')
            || get('SELECT id FROM vakantieperiodes ORDER BY id DESC LIMIT 1');
          if(kies){ run('UPDATE vakantieperiodes SET actief=0'); run('UPDATE vakantieperiodes SET actief=1 WHERE id=?',[kies.id]); }
        }
        const actiefId=(get('SELECT id FROM vakantieperiodes WHERE actief=1')||{}).id||null;
        const periodeVoor=(loc,week)=>{
          const kms=all('SELECT periode_id FROM kampmomenten WHERE locatie_id=? AND week=?',[loc,week]);
          if(kms.length===1)return kms[0].periode_id;
          if(kms.some(k=>k.periode_id===actiefId))return actiefId;
          return kms[0]?.periode_id||actiefId;
        };
        let nSp=0,nKl=0;
        for(const r of all('SELECT id,locatie_id,week FROM sport_planning WHERE periode_id IS NULL')){ run('UPDATE sport_planning SET periode_id=? WHERE id=?',[periodeVoor(r.locatie_id,r.week),r.id]); nSp++; }
        for(const r of all('SELECT id,locatie_id,week FROM locatie_kleuren WHERE periode_id IS NULL')){ run('UPDATE locatie_kleuren SET periode_id=? WHERE id=?',[periodeVoor(r.locatie_id,r.week),r.id]); nKl++; }
        const herbouw=(tabel,oud,nieuw)=>{
          const rij=get("SELECT sql FROM sqlite_master WHERE type='table' AND name=?",[tabel]);
          if(!rij)return 'ontbreekt';
          const norm=rij.sql.replace(/\s+/g,' ');
          if(norm.includes(nieuw))return 'al ok';
          if(!norm.includes(oud))throw new Error(`${tabel}: verwachte sleutel "${oud}" niet gevonden`);
          const nieuweSql=norm.replace(oud,nieuw).replace(/^CREATE TABLE\s+"?\w+"?/i,`CREATE TABLE ${tabel}_v71`);
          const kolommen=all(`PRAGMA table_info(${tabel})`).map(c=>c.name).join(',');
          const voor=get(`SELECT COUNT(*) AS n FROM ${tabel}`).n;
          // AUTOINCREMENT-teller bewaren: anders krijgt een nieuw kampmoment het id van een ooit
          // verwijderd kampmoment, en hangen oude taken/aanvragen/sessies met dat id er plots aan.
          const seq=(get('SELECT seq FROM sqlite_sequence WHERE name=?',[tabel])||{}).seq||0;
          db.run(nieuweSql);
          db.run(`INSERT INTO ${tabel}_v71 (${kolommen}) SELECT ${kolommen} FROM ${tabel}`);
          db.run(`DROP TABLE ${tabel}`);
          db.run(`ALTER TABLE ${tabel}_v71 RENAME TO ${tabel}`);
          const seqNa=(get('SELECT seq FROM sqlite_sequence WHERE name=?',[tabel])||{}).seq;
          if(seqNa==null) db.run('INSERT INTO sqlite_sequence (name,seq) VALUES (?,?)',[tabel,seq]);
          else if(seqNa<seq) db.run('UPDATE sqlite_sequence SET seq=? WHERE name=?',[seq,tabel]);
          const na=get(`SELECT COUNT(*) AS n FROM ${tabel}`).n;
          if(na!==voor)throw new Error(`${tabel}: ${voor} rijen vóór, ${na} na herbouw`);
          return `${na} rijen herbouwd`;
        };
        const kt0=get('SELECT COUNT(*) AS n FROM kampmoment_themas').n;
        const fkVoor=all('PRAGMA foreign_key_check').length;
        db.run('PRAGMA foreign_keys = OFF'); // moet BUITEN de transactie (SQLite negeert het erbinnen)
        let uit;
        try{
          db.run('BEGIN');
          try{
            uit=[herbouw('kampmomenten','UNIQUE(locatie_id, week)','UNIQUE(locatie_id, week, periode_id)'),
                 herbouw('sport_planning','UNIQUE(set_id, week)','UNIQUE(set_id, week, periode_id)'),
                 herbouw('locatie_kleuren','UNIQUE(locatie_id, week, kleur)','UNIQUE(locatie_id, week, kleur, periode_id)')];
            // De db heeft al wezen van vóór deze migratie (bv. nakijk_regels zonder sessie); de herbouw
            // mag er geen NIEUWE bijmaken — dus vergelijken met de stand van vóór de herbouw.
            const fkNa=all('PRAGMA foreign_key_check').length;
            if(fkNa>fkVoor)throw new Error(`foreign_key_check: ${fkVoor} → ${fkNa} problemen na herbouw`);
            db.run('COMMIT');
          }catch(e){ try{db.run('ROLLBACK');}catch(_){} throw e; }
        } finally { db.run('PRAGMA foreign_keys = ON'); }
        const kt1=get('SELECT COUNT(*) AS n FROM kampmoment_themas').n;
        if(kt1!==kt0)throw new Error(`kampmoment_themas ${kt0} → ${kt1} (mag niet veranderen)`);
        ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie71_klaar','1')");
        console.log(`  Migratie 71: actieve periode ${actiefId}; periode_id ingevuld op ${nSp} sport- en ${nKl} kleurenbordrijen; kampmomenten ${uit[0]}, sport_planning ${uit[1]}, locatie_kleuren ${uit[2]}`);
      }catch(e){ console.error('  Migratie 71 fout — vlag NIET gezet, probeert opnieuw bij volgende start:',e.message); }
    }
  }

  // ── Migratie 72 — V2b: nakijk_sessies hangen aan een kampmoment (B-R11, werklijst 64) ──
  // Vroeger enkel locatie_id+week → een herfst-KV zag/overschreef de zomer-sessie van dezelfde
  // locatie+week. Backfill: het kampmoment met die locatie+week in de actieve periode; anders,
  // als er in alle periodes samen precies één is, dat ene; anders NULL (blijft zichtbaar onder
  // "zonder kampmoment" in de tekortenlijst — er verdwijnt niets).
  addColumnIfMissing('nakijk_sessies','kampmoment_id','INTEGER');
  try{ db.run('CREATE INDEX IF NOT EXISTS idx_nakijk_sessies_km ON nakijk_sessies(kampmoment_id)'); }catch(e){ console.warn('  Migratie 72: index niet aangemaakt:',e.message); }
  {
    const _vlag72=get("SELECT naam FROM app_vlaggen WHERE naam='migratie72_klaar'");
    if(!_vlag72){
      try{
        const actiefId=(get('SELECT id FROM vakantieperiodes WHERE actief=1')||{}).id||null;
        let nActief=0,nEnig=0,nNull=0;
        for(const s of all('SELECT id,locatie_id,week FROM nakijk_sessies WHERE kampmoment_id IS NULL')){
          let km=(s.locatie_id&&s.week)?get('SELECT id FROM kampmomenten WHERE locatie_id=? AND week=? AND periode_id=?',[s.locatie_id,s.week,actiefId]):null;
          if(km){nActief++;}
          else{
            const kms=(s.locatie_id&&s.week)?all('SELECT id FROM kampmomenten WHERE locatie_id=? AND week=?',[s.locatie_id,s.week]):[];
            if(kms.length===1){km=kms[0];nEnig++;} else nNull++;
          }
          if(km)run('UPDATE nakijk_sessies SET kampmoment_id=? WHERE id=?',[km.id,s.id]);
        }
        ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie72_klaar','1')");
        console.log(`  Migratie 72: nakijk_sessies.kampmoment_id — ${nActief} via de actieve periode, ${nEnig} via het enige kampmoment, ${nNull} zonder kampmoment (NULL)`);
      }catch(e){ console.error('  Migratie 72 fout — vlag NIET gezet, probeert opnieuw bij volgende start:',e.message); }
    }
  }

  // Migratie 73 (CH1, chauffeursscherm): stop-slot vast/vrij + volgorde binnen de rit, sleutel-info per
  // locatie, "niet mee" per check (rest-taak). Kolommen idempotent; backfill van volgorde exact één keer.
  addColumnIfMissing('transport_taken','slot',"TEXT DEFAULT 'vast'");
  addColumnIfMissing('transport_taken','volgorde','INTEGER DEFAULT NULL');
  addColumnIfMissing('transport_taken','rest_van_rit_id','INTEGER DEFAULT NULL');
  addColumnIfMissing('locaties','sleutel_info',"TEXT DEFAULT ''");
  addColumnIfMissing('verhuis_checks','niet_mee_reden','TEXT DEFAULT NULL');
  addColumnIfMissing('verhuis_checks','niet_mee_opmerking',"TEXT DEFAULT ''");
  addColumnIfMissing('verhuis_checks','niet_mee_aantal','INTEGER DEFAULT 0');
  addColumnIfMissing('verhuis_checks','rest_regel_id','INTEGER DEFAULT NULL');
  addColumnIfMissing('verhuis_checks','rest_gesplitst','INTEGER DEFAULT 0');
  {
    const _vlag73=get("SELECT naam FROM app_vlaggen WHERE naam='migratie73_klaar'");
    if(!_vlag73){
      try{
        run("UPDATE transport_taken SET slot='vast' WHERE slot IS NULL OR slot=''");
        let n=0;
        all('SELECT DISTINCT rit_id FROM transport_taken WHERE rit_id IS NOT NULL').forEach(r=>{
          all("SELECT id FROM transport_taken WHERE rit_id=? ORDER BY COALESCE(tijd,''),id",[r.rit_id])
            .forEach((t,i)=>{run('UPDATE transport_taken SET volgorde=? WHERE id=?',[i+1,t.id]);n++;});
        });
        ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie73_klaar','1')");
        console.log(`  Migratie 73: slot vast/vrij + volgorde (${n} taken genummerd per rit)`);
      }catch(e){ console.error('  Migratie 73 fout — vlag NIET gezet, probeert opnieuw bij volgende start:',e.message); }
    }
  }

  // Migratie 74 (KO1): voorkeuren per gebruiker als JSON (o.a. vandaag_weergave groot|compact). Enkel een kolom
  // met default '{}' — geen backfill nodig, dus geen app_vlaggen-poort.
  addColumnIfMissing('personeel','voorkeuren',"TEXT DEFAULT '{}'");

  // Migratie 75 (KV1): telscherm "✓ klopt / anders" (te veel, kapot per stuk, notitie, foto) + monitor-link per kampmoment.
  // Enkel kolommen met defaults — geen backfill nodig, dus geen app_vlaggen-poort.
  addColumnIfMissing('nakijk_regels','te_veel','REAL DEFAULT 0');
  addColumnIfMissing('nakijk_regels','kapot_aantal','REAL DEFAULT 0');
  addColumnIfMissing('nakijk_regels','notitie',"TEXT DEFAULT ''");
  addColumnIfMissing('nakijk_regels','foto_path',"TEXT DEFAULT ''");
  addColumnIfMissing('kampmomenten','monitor_token',"TEXT DEFAULT ''");

  // Migratie 77 (VC1): kantoor-beslissing per afwijking (nakijken) + aanvullen in de Rozenweg. Enkel kolommen met defaults.
  addColumnIfMissing('nakijk_regels','kantoor_actie',"TEXT DEFAULT ''");
  addColumnIfMissing('nakijk_regels','kantoor_aantal','REAL DEFAULT 0');
  addColumnIfMissing('nakijk_regels','kantoor_notitie',"TEXT DEFAULT ''");
  addColumnIfMissing('nakijk_regels','aangevuld','INTEGER DEFAULT 0');
  addColumnIfMissing('nakijk_regels','aangevuld_door',"TEXT DEFAULT ''");
  addColumnIfMissing('nakijk_regels','aangevuld_op',"TEXT DEFAULT ''");
  addColumnIfMissing('nakijk_sessies','kantoor_afgerond_op',"TEXT DEFAULT ''");
  addColumnIfMissing('nakijk_sessies','kantoor_door',"TEXT DEFAULT ''");

  // Migratie 78 (PL1): groepsgrootte, kookdagen en 'KV-link gestuurd' per kampmoment (de opmerking gebruikt de bestaande kolom notities). Enkel kolommen met defaults.
  addColumnIfMissing('kampmomenten','aantal_kinderen','INTEGER');
  addColumnIfMissing('kampmomenten','aantal_kleuters','INTEGER');
  addColumnIfMissing('kampmomenten','aantal_monitoren','INTEGER');
  addColumnIfMissing('kampmomenten','kookdagen',"TEXT DEFAULT ''");
  addColumnIfMissing('kampmomenten','kv_link_gestuurd','INTEGER DEFAULT 0');

  // Migratie 80 (GF1): bevestiging van weekendtaken bewaren + rest-taken zonder datum/week herstellen.
  addColumnIfMissing('transport_taken','weekend_bevestigd_door',"TEXT DEFAULT ''");
  addColumnIfMissing('transport_taken','weekend_bevestigd_op',"TEXT DEFAULT ''");
  {
    const _vlag78=get("SELECT naam FROM app_vlaggen WHERE naam='migratie78_klaar'");
    if(!_vlag78){
      try{
        // Rest-taken ("past niet") kregen een lege datum: ze nemen de datum van hun rit, en de week van hun kampmoment.
        const rest=all("SELECT id,rest_van_rit_id,kampmoment_id,week FROM transport_taken WHERE rest_van_rit_id IS NOT NULL AND (datum IS NULL OR datum='')");
        let n=0;
        rest.forEach(t=>{
          const rit=get('SELECT datum FROM transport_ritten WHERE id=?',[t.rest_van_rit_id]);
          const km=t.kampmoment_id?get('SELECT week FROM kampmomenten WHERE id=?',[t.kampmoment_id]):null;
          if(rit&&rit.datum){run('UPDATE transport_taken SET datum=?,week=COALESCE(week,?) WHERE id=?',[rit.datum,km?km.week:null,t.id]);n++;}
        });
        ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie78_klaar','1')");
        console.log(`  Migratie 80: weekend-bevestiging + ${n} rest-taken kregen een datum`);
      }catch(e){ console.error('  Migratie 78 fout — vlag NIET gezet, probeert opnieuw bij volgende start:',e.message); }
    }
  }

  // Migratie 76 (RP1, ritplanning): bestuurder = elke medewerker (rol op de rit), voertuig vrij (pool/eigen/huur
  // met eigen capaciteit), vertrektijd per rit. Kolommen idempotent; backfill van vertrek exact één keer.
  addColumnIfMissing('transport_ritten','bestuurder_rol',"TEXT DEFAULT 'chauffeur'");
  addColumnIfMissing('transport_ritten','voertuig_soort',"TEXT DEFAULT 'pool'");
  addColumnIfMissing('transport_ritten','voertuig_capaciteit','INTEGER DEFAULT NULL');
  addColumnIfMissing('transport_ritten','vertrek',"TEXT DEFAULT ''");
  {
    const _vlag75=get("SELECT naam FROM app_vlaggen WHERE naam='migratie76_klaar'");
    if(!_vlag75){
      try{
        let n=0;
        all("SELECT id FROM transport_ritten WHERE vertrek IS NULL OR vertrek=''").forEach(r=>{
          const t=get("SELECT MIN(tijd) AS t FROM transport_taken WHERE rit_id=? AND tijd<>''",[r.id]);
          if(t&&t.t){run('UPDATE transport_ritten SET vertrek=? WHERE id=?',[t.t,r.id]);n++;}
        });
        // Pool-capaciteit voor bestaande ritten met een gekend voertuigtype.
        all("SELECT r.id,v.capaciteit_bakken FROM transport_ritten r JOIN voertuig_types v ON v.naam=r.voertuig WHERE r.voertuig_capaciteit IS NULL")
          .forEach(r=>run('UPDATE transport_ritten SET voertuig_capaciteit=? WHERE id=?',[r.capaciteit_bakken,r.id]));
        ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie76_klaar','1')");
        console.log(`  Migratie 76: bestuurder_rol/voertuig_soort/voertuig_capaciteit/vertrek (${n} ritten kregen een vertrektijd)`);
      }catch(e){ console.error('  Migratie 76 fout — vlag NIET gezet, probeert opnieuw bij volgende start:',e.message); }
    }
  }

  // Migratie 79 (MA1, werklijst 82): vaste plaats per bak (rek + plank) en per poolstuk (pool_plaats). De thuisplaats
  // bestond al als bakken.thuislocatie_id (geen tweede kolom). Backfill exact één keer: rek = eerste letter van de code
  // (A–Z), thuis = Rozenweg voor thema- en vaste bakken zonder thuis.
  addColumnIfMissing('bakken','rek',"TEXT DEFAULT ''");
  addColumnIfMissing('bakken','plank',"TEXT DEFAULT ''");
  addColumnIfMissing('item_types','pool_plaats',"TEXT DEFAULT ''");
  {
    const _vlag79=get("SELECT naam FROM app_vlaggen WHERE naam='migratie79_klaar'");
    if(!_vlag79){
      try{
        let nRek=0,nThuis=0;
        all("SELECT id,code FROM bakken WHERE (rek IS NULL OR rek='') AND code<>''").forEach(b=>{
          const m=/^([A-Za-z])/.exec(b.code||'');if(m){run('UPDATE bakken SET rek=? WHERE id=?',[m[1].toUpperCase(),b.id]);nRek++;}
        });
        const roz=get("SELECT id FROM locaties WHERE type='stockage' AND name LIKE '%Rozenweg%' ORDER BY id LIMIT 1");
        if(roz)all("SELECT id FROM bakken WHERE soort IN ('thema','vast') AND thuislocatie_id IS NULL").forEach(b=>{run('UPDATE bakken SET thuislocatie_id=? WHERE id=?',[roz.id,b.id]);nThuis++;});
        ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie79_klaar','1')");
        console.log(`  Migratie 79: rek/plank per bak + pool_plaats per stuk (${nRek} bakken kregen een rek, ${nThuis} een thuis)`);
      }catch(e){ console.error('  Migratie 79 fout — vlag NIET gezet, probeert opnieuw bij volgende start:',e.message); }
    }
  }

  // Migratie 81 (BH1, Beheer › Personeel): actief/inactief, rijbewijs, eigen wagen, laatst actief, uitnodiging,
  // meldingen en wanneer de pincode het laatst wijzigde. Enkel kolommen met een default — geen backfill nodig.
  addColumnIfMissing('personeel','actief','INTEGER DEFAULT 1');
  addColumnIfMissing('personeel','rijbewijs',"TEXT DEFAULT ''");
  addColumnIfMissing('personeel','eigen_wagen_capaciteit','INTEGER DEFAULT NULL');
  addColumnIfMissing('personeel','laatst_actief',"TEXT DEFAULT ''");
  addColumnIfMissing('personeel','uitnodiging_op',"TEXT DEFAULT ''");
  addColumnIfMissing('personeel','meldingen_aan','INTEGER DEFAULT 1');
  addColumnIfMissing('personeel','pincode_gewijzigd_op',"TEXT DEFAULT ''");

  // Migratie 82 (LO1, Locaties op het patroon): wifi en gemeente per locatie + foto's per locatie (er bestond geen
  // foto-veld of -tabel voor locaties). Backfill exact één keer: gemeente = het deel na de postcode in addr.
  addColumnIfMissing('locaties','wifi',"TEXT DEFAULT ''");
  addColumnIfMissing('locaties','gemeente',"TEXT DEFAULT ''");
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS locatie_fotos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    locatie_id INTEGER NOT NULL REFERENCES locaties(id) ON DELETE CASCADE,
    tijdstip TEXT DEFAULT '', wie TEXT DEFAULT '', beschrijving TEXT DEFAULT '', foto_path TEXT DEFAULT ''
  )`);
  {
    const _vlag82=get("SELECT naam FROM app_vlaggen WHERE naam='migratie82_klaar'");
    if(!_vlag82){
      try{
        let n=0;
        all("SELECT id,addr FROM locaties WHERE (gemeente IS NULL OR gemeente='') AND addr<>''").forEach(l=>{
          const m=/\b\d{4}\s+([^,\d][^,]*)\s*$/.exec(l.addr||'');
          if(m){run('UPDATE locaties SET gemeente=? WHERE id=?',[m[1].trim(),l.id]);n++;}
        });
        ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie82_klaar','1')");
        console.log(`  Migratie 82: wifi/gemeente + locatie_fotos (${n} locaties kregen een gemeente uit het adres)`);
      }catch(e){ console.error('  Migratie 82 fout — vlag NIET gezet, probeert opnieuw bij volgende start:',e.message); }
    }
  }

  // Migratie 83 (VT1, Transport › Voertuigen): echte voertuigen i.p.v. soorten, onderhoudsperiodes en transport_ritten.voertuig_id.
  // Backfill exact één keer: per voertuig_types-rij één voertuig ("Camionette 1"); ritten waarvan de vrije tekst gelijk is aan een type
  // krijgen het eerste voertuig van dat type. voertuig_types blijft bestaan (niet meer gebruikt in de nieuwe schermen).
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS voertuigen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naam TEXT NOT NULL, soort TEXT DEFAULT 'eigen', nummerplaat TEXT DEFAULT '', plaatsen INTEGER DEFAULT NULL, rijbewijs TEXT DEFAULT 'B',
    standplaats_locatie_id INTEGER, sleutel_info TEXT DEFAULT '', keuring_tot TEXT DEFAULT '', huur_van TEXT DEFAULT '', huur_tot TEXT DEFAULT '',
    notitie TEXT DEFAULT '', actief INTEGER DEFAULT 1, created_at TEXT DEFAULT ''
  )`);
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS voertuig_onderhoud (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voertuig_id INTEGER NOT NULL REFERENCES voertuigen(id) ON DELETE CASCADE,
    datum_van TEXT NOT NULL, datum_tot TEXT NOT NULL, reden TEXT DEFAULT ''
  )`);
  addColumnIfMissing('transport_ritten','voertuig_id','INTEGER DEFAULT NULL');
  {
    const _vlag83=get("SELECT naam FROM app_vlaggen WHERE naam='migratie83_klaar'");
    if(!_vlag83){
      try{
        const rozenweg=get("SELECT id FROM locaties WHERE name='Rozenweg' AND (parent_id IS NULL OR parent_id=0)")||get("SELECT id FROM locaties WHERE type='stockage' AND (parent_id IS NULL OR parent_id=0) ORDER BY id LIMIT 1");
        const eerste={};
        all('SELECT * FROM voertuig_types ORDER BY id').forEach(t=>{
          const id=ins('INSERT INTO voertuigen (naam,soort,plaatsen,rijbewijs,standplaats_locatie_id,actief,created_at) VALUES (?,?,?,?,?,1,?)',
            [t.naam+' 1','eigen',t.capaciteit_bakken,'B',rozenweg?rozenweg.id:null,new Date().toISOString()]);
          eerste[t.naam]=id;
        });
        let n=0;
        all("SELECT id,voertuig FROM transport_ritten WHERE voertuig_id IS NULL AND voertuig<>''").forEach(r=>{
          if(eerste[r.voertuig]){run('UPDATE transport_ritten SET voertuig_id=? WHERE id=?',[eerste[r.voertuig],r.id]);n++;}
        });
        ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie83_klaar','1')");
        console.log(`  Migratie 83: voertuigen (${Object.keys(eerste).length} uit voertuig_types, ${n} ritten gekoppeld)`);
      }catch(e){ console.error('  Migratie 83 fout — vlag NIET gezet, probeert opnieuw bij volgende start:',e.message); }
    }
  }

  // Migratie 84 (TB2, Tekorten & bestellingen): er was geen plek voor een bestelling per artikel (aantal, waar kopen, besteld/binnen)
  // noch voor de keuze van kantoor die afwijkt van het voorstel (uit voorraad ↔ te bestellen). los=1: bestelling zonder tekort;
  // extra=1: aankoop bovenop een tekort dat uit voorraad wordt aangevuld. Geen backfill nodig (nieuwe tabel).
  createTableIfMissing(`CREATE TABLE IF NOT EXISTS tekort_bestellingen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artikel_sleutel TEXT NOT NULL, periode_id INTEGER DEFAULT 0, naam TEXT DEFAULT '', item_type_id INTEGER,
    stand_kantoor TEXT DEFAULT '', aantal REAL DEFAULT 0, waar_kopen TEXT DEFAULT '', leveren_aan_id INTEGER, reden TEXT DEFAULT '',
    besteld_op TEXT DEFAULT '', besteld_door TEXT DEFAULT '', binnen_op TEXT DEFAULT '', binnen_door TEXT DEFAULT '',
    los INTEGER DEFAULT 0, extra INTEGER DEFAULT 0, created_at TEXT DEFAULT ''
  )`);
  {
    const _vlag84=get("SELECT naam FROM app_vlaggen WHERE naam='migratie84_klaar'");
    if(!_vlag84){ ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie84_klaar','1')"); console.log('  Migratie 84: tekort_bestellingen'); }
  }

  // Migration 85 (PL3): sportrooster per dag. sport_planning krijgt dag_van/dag_tot (1=ma … 5=vr) en soort;
  // UNIQUE wordt (set_id, week, periode_id, dag_van, locatie_id) zodat een set in één week op twee plekken kan staan (verhuis midden in de week).
  {
    const _vlag85=get("SELECT naam FROM app_vlaggen WHERE naam='migratie85_klaar'");
    if(!_vlag85){
      try{
        addColumnIfMissing('sport_planning','dag_van','INTEGER DEFAULT 1');
        addColumnIfMissing('sport_planning','dag_tot','INTEGER DEFAULT 5');
        addColumnIfMissing('sport_planning','soort',"TEXT DEFAULT ''");
        run('UPDATE sport_planning SET dag_van=1 WHERE dag_van IS NULL');
        run('UPDATE sport_planning SET dag_tot=5 WHERE dag_tot IS NULL');
        // Soort = itemnaam zonder de laatste letter/cijfer-aanduiding ("Archery tag A" → "Archery tag", "Hockey 3" → "Hockey").
        const soortVan=n=>String(n||'').replace(/ +([A-Za-z]|[0-9]+)$/,'').trim()||String(n||'');
        let nS=0;
        for(const r of all('SELECT sp.id,si.name FROM sport_planning sp JOIN sport_sets ss ON ss.id=sp.set_id JOIN sport_items si ON si.id=ss.item_id')){ run('UPDATE sport_planning SET soort=? WHERE id=?',[soortVan(r.name),r.id]); nS++; }
        const voor=get('SELECT COUNT(*) AS n FROM sport_planning').n;
        const seq=(get("SELECT seq FROM sqlite_sequence WHERE name='sport_planning'")||{}).seq||0;
        db.run('PRAGMA foreign_keys = OFF');
        try{
          db.run('BEGIN');
          try{
            db.run('DROP TABLE IF EXISTS sport_planning_v85');
            db.run("CREATE TABLE sport_planning_v85 (id INTEGER PRIMARY KEY AUTOINCREMENT, set_id INTEGER NOT NULL, locatie_id INTEGER NOT NULL, week INTEGER NOT NULL, periode_id INTEGER, dag_van INTEGER DEFAULT 1, dag_tot INTEGER DEFAULT 5, soort TEXT DEFAULT '', UNIQUE(set_id, week, periode_id, dag_van, locatie_id), FOREIGN KEY(set_id) REFERENCES sport_sets(id) ON DELETE CASCADE)");
            db.run("INSERT INTO sport_planning_v85 (id,set_id,locatie_id,week,periode_id,dag_van,dag_tot,soort) SELECT id,set_id,locatie_id,week,periode_id,COALESCE(dag_van,1),COALESCE(dag_tot,5),COALESCE(soort,'') FROM sport_planning");
            db.run('DROP TABLE sport_planning');
            db.run('ALTER TABLE sport_planning_v85 RENAME TO sport_planning');
            const na=get('SELECT COUNT(*) AS n FROM sport_planning').n;
            if(na!==voor)throw new Error('sport_planning '+voor+' rijen vóór, '+na+' na herbouw');
            db.run('COMMIT');
          }catch(e){ try{db.run('ROLLBACK');}catch(_){} throw e; }
        } finally { db.run('PRAGMA foreign_keys = ON'); }
        const seqNa=(get("SELECT seq FROM sqlite_sequence WHERE name='sport_planning'")||{}).seq;
        if(seqNa==null)db.run("INSERT INTO sqlite_sequence (name,seq) VALUES ('sport_planning',?)",[seq]);
        else if(seqNa<seq)db.run("UPDATE sqlite_sequence SET seq=? WHERE name='sport_planning'",[seq]);
        ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie85_klaar','1')");
        console.log('  Migratie 85: sport_planning per dag ('+voor+' rijen, '+nS+' met soort)');
      }catch(e){ console.error('  Migratie 85 fout — vlag NIET gezet:',e.message); }
    }
  }

  // Migratie 86 (BH2, gesloten dagen per locatie): gesloten_dagen krijgt locatie_id (NULL = heel Sporty); UNIQUE wordt (datum, locatie_id).
  // Bestaande rijen blijven NULL. Tabel herbouwd (SQLite kan een UNIQUE niet wijzigen); id's en sqlite_sequence blijven.
  {
    const _vlag86=get("SELECT waarde FROM app_vlaggen WHERE naam='migratie86_klaar'");
    if(!_vlag86){
      try{
        const voor=get('SELECT COUNT(*) AS n FROM gesloten_dagen').n;
        db.run('BEGIN');
        try{
          db.run('DROP TABLE IF EXISTS gesloten_dagen_v86');
          db.run("CREATE TABLE gesloten_dagen_v86 (id INTEGER PRIMARY KEY AUTOINCREMENT, datum TEXT NOT NULL, reden TEXT DEFAULT '', locatie_id INTEGER, UNIQUE(datum, locatie_id))");
          db.run('INSERT INTO gesloten_dagen_v86 (id,datum,reden,locatie_id) SELECT id,datum,reden,NULL FROM gesloten_dagen');
          db.run('DROP TABLE gesloten_dagen');
          db.run('ALTER TABLE gesloten_dagen_v86 RENAME TO gesloten_dagen');
          const na=get('SELECT COUNT(*) AS n FROM gesloten_dagen').n;
          if(na!==voor)throw new Error('gesloten_dagen '+voor+' rijen vóór, '+na+' na herbouw');
          db.run('COMMIT');
        }catch(e){ try{db.run('ROLLBACK');}catch(_){} throw e; }
        ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie86_klaar','1')");
        console.log('  Migratie 86: gesloten_dagen per locatie ('+voor+' rijen)');
      }catch(e){ console.error('  Migratie 86 fout — vlag NIET gezet:',e.message); }
    }
  }

  // Migratie 87 (ME1, meldingen met echte bronnen): meldingen (voor_persoon_id leeg = iedereen met die rol) + per persoon gelezen bij rol-meldingen.
  {
    if(!get("SELECT waarde FROM app_vlaggen WHERE naam='migratie87_klaar'")){
      createTableIfMissing("CREATE TABLE IF NOT EXISTS meldingen (id INTEGER PRIMARY KEY AUTOINCREMENT, voor_rol TEXT DEFAULT '', voor_persoon_id INTEGER, van_naam TEXT DEFAULT '', tekst TEXT NOT NULL, link TEXT DEFAULT '', gelezen_op TEXT, created_at TEXT DEFAULT '')");
      createTableIfMissing("CREATE TABLE IF NOT EXISTS meldingen_gelezen (id INTEGER PRIMARY KEY AUTOINCREMENT, melding_id INTEGER NOT NULL, persoon_id INTEGER NOT NULL, gelezen_op TEXT DEFAULT '', UNIQUE(melding_id, persoon_id))");
      ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie87_klaar','1')");console.log('  Migratie 87: meldingen');
    }
  }

  // Migratie 88 (AV2): door de aanvuller gemelde regels (gemeld_soort kapot|weg, gemeld_door) + hoeveel er al gedaan is van een deels afgevinkte regel.
  {
    if(!get("SELECT waarde FROM app_vlaggen WHERE naam='migratie88_klaar'")){
      addColumnIfMissing('nakijk_regels','gemeld_soort',"TEXT DEFAULT ''");
      addColumnIfMissing('nakijk_regels','gemeld_door',"TEXT DEFAULT ''");
      addColumnIfMissing('nakijk_regels','gedaan_aantal','REAL DEFAULT 0');
      ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie88_klaar','1')");console.log('  Migratie 88: gemelde regels');
    }
  }

  // Migratie 89 (TF5): elke KV-telling is een eigen, onwisbare rij; elke keer versturen ook. Triggers weigeren wijzigen en wissen. Bestaande tellingen worden de eerste versie.
  {
    if(!get("SELECT waarde FROM app_vlaggen WHERE naam='migratie89_klaar'")){
      createTableIfMissing("CREATE TABLE IF NOT EXISTS kv_telling_versies (id INTEGER PRIMARY KEY AUTOINCREMENT, kampmoment_id INTEGER, sessie_id INTEGER, item_id INTEGER, attribuut_id INTEGER, code TEXT DEFAULT '', item_naam TEXT DEFAULT '', verwacht REAL, geteld REAL, kapot REAL DEFAULT 0, te_veel REAL DEFAULT 0, status TEXT DEFAULT '', notitie TEXT DEFAULT '', foto_path TEXT DEFAULT '', wie TEXT DEFAULT '', via TEXT DEFAULT '', op TEXT DEFAULT '')");
      createTableIfMissing("CREATE TABLE IF NOT EXISTS kv_verstuurd (id INTEGER PRIMARY KEY AUTOINCREMENT, kampmoment_id INTEGER, op TEXT DEFAULT '', wie TEXT DEFAULT '', aantal INTEGER DEFAULT 0, samenvatting TEXT DEFAULT '', tot_versie INTEGER DEFAULT 0)");
      const code=s=>{const b=s.thema_bak_id||s.vaste_bak_id?get('SELECT code FROM bakken WHERE id=?',[s.thema_bak_id||s.vaste_bak_id]):null;return (b&&b.code)||'';};
      all("SELECT * FROM nakijk_sessies WHERE kampmoment_id IS NOT NULL AND kv_status IN ('bezig','ingediend')").forEach(s=>{
        if(s.bak_type==='attribuut'){
          if(s.notities){const a=get('SELECT naam,code FROM attributen WHERE id=?',[s.attribuut_id])||{};
            ins("INSERT INTO kv_telling_versies (kampmoment_id,sessie_id,attribuut_id,code,item_naam,verwacht,geteld,kapot,status,wie,via,op) VALUES (?,?,?,?,?,1,1,?,?,?,'migratie',?)",[s.kampmoment_id,s.id,s.attribuut_id,a.code||'',a.naam||'',s.notities==='beschadigd'?1:0,s.notities,s.kv_wie||'',s.kv_tijdstip||s.datum||'']);}
          return;
        }
        all("SELECT * FROM nakijk_regels WHERE sessie_id=? AND aangetroffen IS NOT NULL AND COALESCE(gemeld_soort,'')=''",[s.id]).forEach(r=>
          ins("INSERT INTO kv_telling_versies (kampmoment_id,sessie_id,item_id,code,item_naam,verwacht,geteld,kapot,te_veel,notitie,foto_path,wie,via,op) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'migratie',?)",[s.kampmoment_id,s.id,r.item_id,code(s),r.item_naam||'',r.verwacht,r.aangetroffen,r.kapot_aantal||0,r.te_veel||0,r.notitie||'',r.foto_path||'',s.kv_wie||'',s.kv_tijdstip||s.datum||'']));
      });
      all("SELECT kampmoment_id,MAX(kv_tijdstip) AS op,MAX(kv_wie) AS wie FROM nakijk_sessies WHERE kampmoment_id IS NOT NULL AND kv_status='ingediend' GROUP BY kampmoment_id").forEach(k=>{
        const m=get('SELECT MAX(id) AS m FROM kv_telling_versies WHERE kampmoment_id=?',[k.kampmoment_id]).m||0;
        ins("INSERT INTO kv_verstuurd (kampmoment_id,op,wie,samenvatting,tot_versie) VALUES (?,?,?,'bestaande telling (migratie)',?)",[k.kampmoment_id,k.op||'',k.wie||'',m]);
      });
      ['kv_telling_versies','kv_verstuurd'].forEach(t=>['UPDATE','DELETE'].forEach(w=>run(`CREATE TRIGGER IF NOT EXISTS ${t}_geen_${w.toLowerCase()} BEFORE ${w} ON ${t} BEGIN SELECT RAISE(ABORT,'Tellingen zijn onwisbaar'); END`)));
      ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie89_klaar','1')");console.log('  Migratie 89: onwisbare KV-tellingen');
    }
  }

  // Migratie 90 (TF6): bestelling deels binnen — hoeveel er al binnen is (bestelling) en aan welke regel toegewezen (nakijk_regels).
  {
    if(!get("SELECT waarde FROM app_vlaggen WHERE naam='migratie90_klaar'")){
      addColumnIfMissing('tekort_bestellingen','binnen_aantal','REAL DEFAULT 0');
      addColumnIfMissing('nakijk_regels','binnen_aantal','REAL DEFAULT 0');
      ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie90_klaar','1')");console.log('  Migratie 90: bestelling deels binnen');
    }
  }

  // Migratie 91 (TF8): een regel met tekort én kapot krijgt voor het kapotte deel een eigen regel (deel_van = de oorspronkelijke regel),
  // zodat elk deel zijn eigen actie en aantal heeft.
  {
    if(!get("SELECT waarde FROM app_vlaggen WHERE naam='migratie91_klaar'")){
      addColumnIfMissing('nakijk_regels','deel_van','INTEGER');
      addColumnIfMissing('nakijk_sessies','aanvulling_klaar_door',"TEXT DEFAULT ''");   // TF8: Bak klaar bewaard (wie en wanneer)
      addColumnIfMissing('nakijk_sessies','aanvulling_klaar_op',"TEXT DEFAULT ''");
      ins("INSERT OR IGNORE INTO app_vlaggen (naam,waarde) VALUES ('migratie91_klaar','1')");console.log('  Migratie 91: kapot-deel als eigen regel');
    }
  }

  saveDb();
};
