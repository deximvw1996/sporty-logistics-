// Import sportpakketten + sub-locaties in sporty.db
// Gebruik: node scripts/import_sport.js
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_PATH = path.join(__dirname, '..', 'sporty.db');

async function main() {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buf);

  const run = (sql, params = []) => db.run(sql, params);
  const all = (sql, params = []) => {
    const r = db.exec(sql, params);
    return r.length ? r[0].values.map(row => {
      const obj = {};
      r[0].columns.forEach((c, i) => obj[c] = row[i]);
      return obj;
    }) : [];
  };
  const get = (sql, params = []) => all(sql, params)[0];

  // 1. parent_id kolom toevoegen aan locaties
  const cols = all("PRAGMA table_info(locaties)").map(c => c.name);
  if (!cols.includes('parent_id')) {
    run("ALTER TABLE locaties ADD COLUMN parent_id INTEGER DEFAULT NULL");
    console.log('✅ parent_id kolom toegevoegd aan locaties');
  } else {
    console.log('ℹ️  parent_id bestaat al');
  }

  // 2. Sub-locaties aanmaken
  const KANTOOR_ID = 4;
  const ROZENWEG_ID = 7;

  const subLocaties = [
    // Kantoor
    { name: 'Boven', parent_id: KANTOOR_ID, type: 'stockage' },
    { name: 'Naschoolse', parent_id: KANTOOR_ID, type: 'stockage' },
    { name: 'Sport', parent_id: KANTOOR_ID, type: 'stockage' },
    { name: 'Beneden', parent_id: KANTOOR_ID, type: 'stockage' },
    // Rozenweg
    { name: 'Boven', parent_id: ROZENWEG_ID, type: 'stockage' },
    { name: 'RGA', parent_id: ROZENWEG_ID, type: 'stockage' },
    { name: 'RGB', parent_id: ROZENWEG_ID, type: 'stockage' },
    { name: 'RGC', parent_id: ROZENWEG_ID, type: 'stockage' },
    { name: 'RGD', parent_id: ROZENWEG_ID, type: 'stockage' },
    { name: 'RGE', parent_id: ROZENWEG_ID, type: 'stockage' },
    { name: 'RGF', parent_id: ROZENWEG_ID, type: 'stockage' },
  ];

  const subLocIds = {};
  for (const sl of subLocaties) {
    const existing = get(
      'SELECT id FROM locaties WHERE name=? AND parent_id=?',
      [sl.name, sl.parent_id]
    );
    if (existing) {
      subLocIds[`${sl.parent_id}-${sl.name}`] = existing.id;
      console.log(`ℹ️  Sub-locatie "${sl.name}" (parent=${sl.parent_id}) bestaat al (id=${existing.id})`);
    } else {
      run(
        "INSERT INTO locaties (name, type, stockage_rol, parent_id) VALUES (?,?,?,?)",
        [sl.name, sl.type, 'beide', sl.parent_id]
      );
      const newId = all("SELECT last_insert_rowid() as id")[0].id;
      subLocIds[`${sl.parent_id}-${sl.name}`] = newId;
      console.log(`✅ Sub-locatie "${sl.name}" aangemaakt (id=${newId})`);
    }
  }

  // 3. Alle bestaande sport_items verwijderen
  run("DELETE FROM sport_sets");
  run("DELETE FROM sport_planning");
  run("DELETE FROM sport_items");
  console.log('✅ Oude sport_items gewist');

  // 4. Alle sport_items importeren
  // ROZENWEG (id=7): inhoud Sportpakketten-tab + Sportkoffer LS
  const rozenweg = [
    'Sportkoffer LS',
    'Archery tag A',
    'Archery tag B',
    'Baseball variaties',
    'Bumperball',
    'Cirkelvoetbal en handvoetbal',
    'Gaelic football en goalbal',
    'Geksentriek balspel',
    'Guldensporenslag',
    'Homeball',
    'Kanjamm A',
    'Kanjamm B',
    'Kubb',
    'Levende risk',
    'Levende stratego',
    'Mölkky',
    'Spikeball A',
    'Spikeball B',
    'Tchoukbal',
    'Ultimate frisbee A',
    'Ultimate frisbee B',
    'Verrekijker voetbal',
    'Watch and go',
    'You fo',
    'Zwerkbal',
  ];

  // KANTOOR (id=4): alle andere pakketten + Sportkoffer KLS
  const kantoor = [
    'Sportkoffer KLS',
    'Atletiek KLS A',
    'Atletiek KLS B',
    'Atletiek LS B',
    'Atletiek LS C',
    'Atletiek LS D',
    'Badminton A',
    'Badminton B',
    'Base hockey A',
    'Basket A',
    'Basket B',
    'Basket C',
    'Basket D',
    'Bonkerbal A',
    'Bounceball A',
    'Bounceball B',
    'Bounceball C',
    'Bumball A',
    'Bumball B',
    'Bumball C',
    'Circus A',
    'Circus B',
    'Circus C',
    'Fling it A',
    'Fling it B',
    'Fling it C',
    'Frisbee A',
    'Frisbee B',
    'Goubak A',
    'Gouret A',
    'Gouret B',
    'Handbal A',
    'Handbal B',
    'Handbal C',
    'Handbal D',
    'Hockey A',
    'Hockey B',
    'Hockey C',
    'Hockey D',
    'Kinball A',
    'Kinball B',
    'Kinball C',
    'Kinball D',
    'Kinball E',
    'Kinball Abdij',
    'Lacrosse A',
    'Lacrosse B',
    'Mini basket A',
    'Mini basket B',
    'Mini basket C',
    'Mini basket D',
    'Mini rugby A',
    'Mini rugby Abdij',
    'Mini tennis A',
    'Mini tennis B',
    'New games A',
    'New games B',
    'Poulball A',
    'Poulball B',
    'Poulball C',
    'Ringstick A',
    'Rope skipping A',
    'Rope skipping B',
    'Rope skipping Abdij',
    'Rugby A',
    'Rugby B',
    'Rugby Abdij',
    'Scoop A',
    'Scoop B',
    'Scratchball A',
    'Scratchball B',
    'Speedminton A',
    'Springy rackets A',
    'Tag rugby A',
    'Voetbal A',
    'Voetbal B',
    'Voetbal C',
    'Voetbal D',
    'Volleybal A',
    'Volleybal B',
    'Volleybal C',
    'Volleybal D',
    'Wereldbal A',
    'Wereldbal B',
    'Wereldbal C',
    'Zweefval A',
    'Zweefval B',
  ];

  for (const name of rozenweg) {
    run("INSERT INTO sport_items (name, cat, stockage_locatie_id) VALUES (?,?,?)", [name, 'sport', ROZENWEG_ID]);
  }
  console.log(`✅ ${rozenweg.length} Rozenweg-items ingevoegd`);

  for (const name of kantoor) {
    run("INSERT INTO sport_items (name, cat, stockage_locatie_id) VALUES (?,?,?)", [name, 'sport', KANTOOR_ID]);
  }
  console.log(`✅ ${kantoor.length} Kantoor-items ingevoegd`);

  // 5. Opslaan
  const data = Buffer.from(db.export());
  fs.writeFileSync(DB_PATH, data);
  console.log(`\n✅ DB opgeslagen: ${DB_PATH}`);
  console.log(`   Totaal sport_items: ${rozenweg.length + kantoor.length}`);
  console.log(`   Sub-locaties aangemaakt: ${subLocaties.length}`);

  db.close();
}

main().catch(err => { console.error('FOUT:', err); process.exit(1); });
