// Reset themas/items + import kampmomenten vanuit Excel
// node scripts/reset_en_import.js
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_PATH = path.join(__dirname, '..', 'sporty.db');

async function main() {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buf);

  const run = (sql, params=[]) => db.run(sql, params);
  const ins = (sql, params=[]) => { db.run(sql,params); return db.exec('SELECT last_insert_rowid() as id')[0].values[0][0]; };
  const all = (sql, params=[]) => { const r=db.exec(sql,params); return r.length?r[0].values.map(row=>{const o={};r[0].columns.forEach((c,i)=>o[c]=row[i]);return o;}):[];};
  const get = (sql, params=[]) => all(sql,params)[0];

  // ── 1. THEMAS & ITEMS WISSEN ──
  console.log('\n=== STAP 1: themas en items wissen ===');
  const tabellen = [
    'bak_fotos','bak_nakijk_log','bak_items','thema_bakken',
    'kampmoment_themas','kampmomenten',
    'thema_materiaal','themas','thema_categorieen',
    'standaard_materiaal',
    'gedeeld_gebruik','gedeeld_stock','gedeeld_items',
    'verplaatsingen','materiaal_eenheden','materiaal_items',
    'verhuis_checks','transport_taken','transport_ritten',
    'terugkomst_regels','terugkomst_rapporten',
    'spoedmeldingen','activiteiten_log',
    'set_planning','sport_planning','sport_sets',
    'verbruik_log','verbruik_stock',
  ];
  for (const t of tabellen) {
    try { run(`DELETE FROM ${t}`); console.log(`  ✅ ${t} leeggemaakt`); }
    catch(e) { console.log(`  ⚠️  ${t}: ${e.message}`); }
  }

  // ── 2. ONTBREKENDE LOCATIES TOEVOEGEN ──
  console.log('\n=== STAP 2: ontbrekende locaties toevoegen ===');

  function upsertLoc(name, addr='') {
    const bestaand = get('SELECT id FROM locaties WHERE name=? AND (parent_id IS NULL OR parent_id=0)', [name]);
    if (bestaand) { console.log(`  ℹ️  ${name} bestaat al (id=${bestaand.id})`); return bestaand.id; }
    const id = ins('INSERT INTO locaties (name,addr,type,stockage_rol) VALUES (?,?,?,?)', [name, addr, 'kamp', 'beide']);
    console.log(`  ✅ ${name} aangemaakt (id=${id})`);
    return id;
  }

  upsertLoc('Woudlucht', 'Woudluchtdreef, 3001 Heverlee');
  upsertLoc('Rotselaar', 'Rotselaar');
  upsertLoc('Betekom', 'Betekom');
  upsertLoc('Grasmus', 'Grasmus, Leuven');
  upsertLoc('Boutersem', 'Boutersem');
  upsertLoc('Gemeenteschool Bertem', 'Bertem');

  // ── 3. KAMPMOMENTEN IMPORTEREN ──
  console.log('\n=== STAP 3: kampmomenten importeren ===');

  // Naam in Excel → naam in DB
  const locMapping = {
    'K-Lo':               'Sporthal Kessel-Lo',
    'Abdijschool':        'Abdijschool',
    'Syntra':             'Syntra',
    'Woudlucht':          'Woudlucht',
    'sporthal Heverlee':  'Sporthal Heverlee',
    'Scoutslokalen':      'Scoutslokalen Vlierbeek',
    'Bosstraat':          'De Bosstraat',
    'De Waaier':          'De Waaier',
    'Kring':              'De Kring',
    'De Ark':             'De Ark 3',
    'De Kraal':           'De Kraal',
    'Rotselaar':          'Rotselaar',
    'Betekom':            'Betekom',
    'De Wijzer / OH':     'De Wijzer Oud-Heverlee',
    'Mozaïek':            'De Mozaiek',
    'Moza�ek':       'De Mozaiek',  // encoding variant
    'Sportschuur':        'Sportschuur',
    'Grasmus':            'Grasmus',
    'UZ Terbank':         'Terbank',
    'Fablab':             'Fablab KUL',
    'GroepT':             'Campus GroepT',
    'Boutersem':          'Boutersem',
    'Gemeente bertem':    'Gemeenteschool Bertem',
    'Klare bron':         'Klare Bron',
  };

  // Parse weken uit header tekst (bv "1-2-8-9" of "1 tem 9" of "2-3")
  function parseWeken(tekst) {
    const ws = tekst.replace(/\n/g,' ').split(/\s{2,}/).pop().trim() || tekst.split(/\s+/).slice(-1)[0];
    // zoek laatste segment na naam
    const m = tekst.match(/[\d][\d\s\-tme]+$/);
    if (!m) return [];
    const s = m[0].trim();
    if (/tem/.test(s)) {
      const nums = s.match(/\d+/g);
      if (nums && nums.length >= 2) {
        const result = [];
        for (let w = +nums[0]; w <= +nums[nums.length-1]; w++) result.push(w);
        return result;
      }
    }
    return [...new Set(s.match(/\d+/g)||[])].map(Number).sort((a,b)=>a-b);
  }

  // Bouw weken-mapping: { exacteNaamUitExcel: [1,2,3,...] }
  const wekenPerLoc = {
    'K-Lo':              [1,2,3,4,5,6,7,8,9],
    'Abdijschool':       [1,2,3,4,5,6,7,8],
    'Syntra':            [1,2,8,9],
    'Woudlucht':         [2,3],
    'sporthal Heverlee': [8,9],
    'Scoutslokalen':     [1,2,3,8,9],
    'Bosstraat':         [1,2,6,7,8],
    'De Waaier':         [4,5,6,7,8],
    'Kring':             [1,2,7,8,9],
    'De Ark':            [3,4,5,6],
    'De Kraal':          [1,2,3,6,8],
    'Rotselaar':         [1,2,7,8,9],
    'Betekom':           [2,9],
    'De Wijzer / OH':    [1,2,7,8],
    'Mozaïek':           [1,2,3,4,5,6,7,8,9],
    'Sportschuur':       [8,9],
    'Grasmus':           [1,2,3,4,5,6,7,8],
    'UZ Terbank':        [2,3,4,5,6,7,8],
    'Fablab':            [2,3,9],
    'GroepT':            [1],
    'Boutersem':         [2,3,6,7,8],
    'Gemeente bertem':   [9],
    'Klare bron':        [1,2,3,4,5,6,7,8],
  };

  let aangemaaktTotaal = 0;
  const periodeId = (get('SELECT id FROM vakantieperiodes LIMIT 1')||{}).id || 1;

  for (const [excelNaam, weken] of Object.entries(wekenPerLoc)) {
    const dbNaam = locMapping[excelNaam];
    if (!dbNaam) { console.log(`  ⚠️  Geen mapping voor "${excelNaam}"`); continue; }
    const loc = get('SELECT id FROM locaties WHERE name=? AND (parent_id IS NULL OR parent_id=0)', [dbNaam]);
    if (!loc) { console.log(`  ⚠️  Locatie "${dbNaam}" niet gevonden`); continue; }

    for (const week of weken) {
      const bestaand = get('SELECT id FROM kampmomenten WHERE locatie_id=? AND week=? AND periode_id=?', [loc.id, week, periodeId]);
      if (!bestaand) {
        ins('INSERT INTO kampmomenten (locatie_id, week, type, periode_id) VALUES (?,?,?,?)', [loc.id, week, 'kamp', periodeId]);
        aangemaaktTotaal++;
      }
    }
    console.log(`  ✅ ${dbNaam}: ${weken.length} weken (${weken.join(',')})`);
  }

  console.log(`\n  Totaal kampmomenten aangemaakt: ${aangemaaktTotaal}`);

  // ── OPSLAAN ──
  const data = Buffer.from(db.export());
  fs.writeFileSync(DB_PATH, data);
  console.log('\n✅ DB opgeslagen.');
  db.close();
}

main().catch(err => { console.error('FOUT:', err); process.exit(1); });
