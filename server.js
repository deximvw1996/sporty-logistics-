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
  `);

  // Migrations for existing DBs
  try { db.run("ALTER TABLE locaties ADD COLUMN type TEXT DEFAULT 'kamp'"); } catch(e){}
  saveDb();



  // ── LOCATIES ──
  app.get('/api/locaties',(req,res)=>res.json(all('SELECT * FROM locaties ORDER BY type,name')));
  app.post('/api/locaties',(req,res)=>{
    const{name,addr,type,contact_naam,contact_tel,notities,lat,lng}=req.body;
    if(!name||!name.trim())return res.status(400).json({error:'Naam is verplicht'});
    const id=ins('INSERT INTO locaties (name,addr,type,contact_naam,contact_tel,notities,lat,lng) VALUES (?,?,?,?,?,?,?,?)',
      [name.trim(),addr||'',type||'kamp',contact_naam||'',contact_tel||'',notities||'',lat||null,lng||null]);
    const loc=get('SELECT * FROM locaties WHERE id=?',[id]);
    logAct('locatie','aangemaakt',`Locatie "${loc.name}" aangemaakt`+(addr?` (${addr})`:''),id,loc.name);
    res.json(loc);
  });
  app.put('/api/locaties/:id',(req,res)=>{
    const{name,addr,type,contact_naam,contact_tel,notities,lat,lng}=req.body;
    run('UPDATE locaties SET name=?,addr=?,type=?,contact_naam=?,contact_tel=?,notities=?,lat=?,lng=? WHERE id=?',
      [name,addr||'',type||'kamp',contact_naam||'',contact_tel||'',notities||'',lat||null,lng||null,req.params.id]);
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

  // ── THEMAS ──
  app.get('/api/themas',(req,res)=>{const t=all('SELECT * FROM themas ORDER BY name');const m=all('SELECT * FROM thema_materiaal');res.json(t.map(x=>({...x,materiaal:m.filter(y=>y.thema_id===x.id)})));});
  app.post('/api/themas',(req,res)=>{const{name,color,categorie}=req.body;if(!name||!name.trim())return res.status(400).json({error:'Naam is verplicht'});const id=ins('INSERT INTO themas (name,color,categorie) VALUES (?,?,?)',[name.trim(),color||'#1D9E75',categorie||'']);res.json({...get('SELECT * FROM themas WHERE id=?',[id]),materiaal:[]});});
  app.put('/api/themas/:id',(req,res)=>{const{name,color,categorie}=req.body;if(!name||!name.trim())return res.status(400).json({error:'Naam is verplicht'});run('UPDATE themas SET name=?,color=?,categorie=? WHERE id=?',[name.trim(),color||'#1D9E75',categorie||'',req.params.id]);res.json(get('SELECT * FROM themas WHERE id=?',[req.params.id]));});
  app.delete('/api/themas/:id',(req,res)=>{run('DELETE FROM thema_materiaal WHERE thema_id=?',[req.params.id]);run('DELETE FROM themas WHERE id=?',[req.params.id]);res.json({ok:true});});
  app.post('/api/themas/:id/materiaal',(req,res)=>{const{name,qty}=req.body;const id=ins('INSERT INTO thema_materiaal (thema_id,name,qty) VALUES (?,?,?)',[req.params.id,name,qty||1]);res.json(get('SELECT * FROM thema_materiaal WHERE id=?',[id]));});
  app.put('/api/themas/:tid/materiaal/:mid',(req,res)=>{const{name,qty}=req.body;run('UPDATE thema_materiaal SET name=?,qty=? WHERE id=? AND thema_id=?',[name,qty,req.params.mid,req.params.tid]);res.json(get('SELECT * FROM thema_materiaal WHERE id=?',[req.params.mid]));});
  app.delete('/api/themas/:tid/materiaal/:mid',(req,res)=>{run('DELETE FROM thema_materiaal WHERE id=? AND thema_id=?',[req.params.mid,req.params.tid]);res.json({ok:true});});

  // ── STANDAARD MATERIAAL (globale template) ──
  app.get('/api/standaard',(req,res)=>res.json(all('SELECT * FROM standaard_materiaal ORDER BY cat,name')));
  app.post('/api/standaard',(req,res)=>{const{name,qty,cat}=req.body;const id=ins('INSERT INTO standaard_materiaal (name,qty,cat) VALUES (?,?,?)',[name,qty||1,cat||'andere']);res.json(get('SELECT * FROM standaard_materiaal WHERE id=?',[id]));});
  app.put('/api/standaard/:id',(req,res)=>{const{name,qty,cat}=req.body;run('UPDATE standaard_materiaal SET name=?,qty=?,cat=? WHERE id=?',[name,qty,cat,req.params.id]);res.json(get('SELECT * FROM standaard_materiaal WHERE id=?',[req.params.id]));});
  app.delete('/api/standaard/:id',(req,res)=>{run('DELETE FROM standaard_materiaal WHERE id=?',[req.params.id]);res.json({ok:true});});

  // ── LOCATIE MATERIAAL (basismateriaal per locatie) ──
  app.get('/api/locaties/:id/materiaal',(req,res)=>res.json(all('SELECT * FROM locatie_materiaal WHERE locatie_id=? ORDER BY cat,name',[req.params.id])));
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
  function getKampmoment(id) {
    const km = get('SELECT * FROM kampmomenten WHERE id=?',[id]);
    if (!km) return null;
    const loc = get('SELECT * FROM locaties WHERE id=?',[km.locatie_id]);
    const kts = all('SELECT * FROM kampmoment_themas WHERE kampmoment_id=?',[id]);
    const themas = kts.map(kt=>{
      const th = get('SELECT * FROM themas WHERE id=?',[kt.thema_id]);
      const mat = all('SELECT * FROM thema_materiaal WHERE thema_id=?',[kt.thema_id]);
      return {...th, mat, kt_id: kt.id};
    });
    // Open dagen voor deze locatie in deze week
    const jul1=new Date(2026,6,1); const dow=jul1.getDay();
    const mnd=new Date(jul1); mnd.setDate(jul1.getDate()-(dow===0?6:dow-1));
    const ws=new Date(mnd); ws.setDate(mnd.getDate()+(km.week-1)*7);
    const locMat=all('SELECT * FROM locatie_materiaal WHERE locatie_id=?',[km.locatie_id]);
    const openDagen=[];
    const gelotenSet=new Set(all('SELECT datum FROM gesloten_dagen').map(g=>g.datum));
    for(let i=0;i<5;i++){
      const d=new Date(ws); d.setDate(ws.getDate()+i);
      if(d.getMonth()!==6&&d.getMonth()!==7) continue;
      const iso=isoDate(d);
      if(gelotenSet.has(iso)) continue;
      const dagRec=get('SELECT * FROM kalender_dagen WHERE locatie_id=? AND datum=?',[km.locatie_id,iso]);
      if(dagRec?dagRec.open==1:true) openDagen.push(iso);
    }
    return {...km, locatie:loc, themas, open_dagen:openDagen, locatie_materiaal:locMat};
  }

  app.get('/api/kampmomenten',(req,res)=>{
    const kms=all('SELECT * FROM kampmomenten ORDER BY week,locatie_id');
    res.json(kms.map(km=>getKampmoment(km.id)).filter(Boolean));
  });

  app.post('/api/kampmomenten',(req,res)=>{
    const{locatie_id,week}=req.body;
    try {
      const id=ins('INSERT INTO kampmomenten (locatie_id,week) VALUES (?,?)',[locatie_id,week]);
      const loc=get('SELECT * FROM locaties WHERE id=?',[locatie_id]);
      logAct('kampmoment','aangemaakt',`Week ${week} — ${loc?.name||'?'} (nieuw kampmoment)`,locatie_id,loc?.name);
      // Auto-open alle weekdagen voor deze locatie
      const jul1=new Date(2026,6,1);const dow=jul1.getDay();
      const mnd=new Date(jul1);mnd.setDate(jul1.getDate()-(dow===0?6:dow-1));
      const ws=new Date(mnd);ws.setDate(mnd.getDate()+(week-1)*7);
      const gelotenSet=new Set(all('SELECT datum FROM gesloten_dagen').map(g=>g.datum));
      for(let i=0;i<5;i++){
        const d=new Date(ws);d.setDate(ws.getDate()+i);
        if(d.getMonth()!==6&&d.getMonth()!==7)continue;
        const iso=isoDate(d);
        if(gelotenSet.has(iso))continue;
        const ex=get('SELECT * FROM kalender_dagen WHERE locatie_id=? AND datum=?',[locatie_id,iso]);
        if(!ex)ins('INSERT INTO kalender_dagen (locatie_id,datum,open) VALUES (?,?,?)',[locatie_id,iso,1]);
      }
      res.json(getKampmoment(id));
    } catch(e){res.status(400).json({error:'Dit kampmoment bestaat al voor deze locatie en week.'});}
  });

  app.put('/api/kampmomenten/:id',(req,res)=>{
    const{week}=req.body;
    const old=get('SELECT k.*,l.name as loc_naam FROM kampmomenten k LEFT JOIN locaties l ON l.id=k.locatie_id WHERE k.id=?',[req.params.id]);
    run('UPDATE kampmomenten SET week=? WHERE id=?',[week,req.params.id]);
    if(old) logAct('kampmoment','verplaatst',`${old.loc_naam||'?'}: week ${old.week} → week ${week}`,old.locatie_id,old.loc_naam);
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
    const{thema_id}=req.body;
    try{const id=ins('INSERT INTO kampmoment_themas (kampmoment_id,thema_id) VALUES (?,?)',[req.params.id,thema_id]);res.json(getKampmoment(req.params.id));}
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
    const jul1=new Date(2026,6,1);const dow=jul1.getDay();
    const mnd=new Date(jul1);mnd.setDate(jul1.getDate()-(dow===0?6:dow-1));
    const voorstellen=[];

    function getOpenDagen(km){
      const ws=new Date(mnd);ws.setDate(mnd.getDate()+(km.week-1)*7);
      const days=[];
      for(let i=0;i<5;i++){const d=new Date(ws);d.setDate(ws.getDate()+i);if(d.getMonth()!==6&&d.getMonth()!==7)continue;const iso=isoDate(d);if(gelotenDagen.includes(iso))continue;const dr=kalDagen.find(k=>k.locatie_id===km.locatie_id&&k.datum===iso);if(dr?dr.open==1:true)days.push(iso);}
      return days;
    }

    function prevWorkday(iso){const d=new Date(iso);d.setDate(d.getDate()-1);if(d.getDay()===0)d.setDate(d.getDate()-2);if(d.getDay()===6)d.setDate(d.getDate()-1);return isoDate(d);}
    function nextWorkday(iso){const d=new Date(iso);d.setDate(d.getDate()+1);if(d.getDay()===0)d.setDate(d.getDate()+1);if(d.getDay()===6)d.setDate(d.getDate()+2);return isoDate(d);}

    // Group kampmomenten per locatie, sorted by week
    const perLocatie={};
    kms.forEach(km=>{if(!perLocatie[km.locatie_id])perLocatie[km.locatie_id]=[];perLocatie[km.locatie_id].push(km);});

    Object.entries(perLocatie).forEach(([locId,kmList])=>{
      const loc=locs.find(l=>l.id==locId);if(!loc)return;
      const vanId=stockage.length?stockage[0].id:null;
      const locMat=(allLocMat.filter(m=>m.locatie_id==locId).length?allLocMat.filter(m=>m.locatie_id==locId):standaard);

      kmList.sort((a,b)=>a.week-b.week).forEach((km,idx)=>{
        const openDagen=getOpenDagen(km);
        if(!openDagen.length)return;
        const kmThemas=kts.filter(kt=>kt.kampmoment_id===km.id);
        const thNamen=kmThemas.map(kt=>themas.find(t=>t.id===kt.thema_id)?.name||'?').join(', ');
        const prevKm=kmList[idx-1];
        const nextKm=kmList[idx+1];
        const isOpvolgend=prevKm&&prevKm.week===km.week-1;
        const heeftOpvolger=nextKm&&nextKm.week===km.week+1;

        // Thema materiaal voor dit kampmoment
        const themaMatRegels=kmThemas.flatMap(kt=>{
          const th=themas.find(t=>t.id===kt.thema_id);
          return thema_mat.filter(m=>m.thema_id===kt.thema_id).map(m=>({naam:'['+( th?.name||'?')+'] '+m.name,qty:m.qty,soort:'thema'}));
        });

        if(!isOpvolgend){
          // Eerste week op deze locatie (of na een pauze): lever alles
          const matRegels=[...locMat.map(m=>({naam:m.name,qty:m.qty,soort:'basis'})),...themaMatRegels];
          voorstellen.push({type:'levering',kampmoment_id:km.id,locatie:loc.name,locatie_id:loc.id,van_locatie_id:vanId,datum:prevWorkday(openDagen[0]),tijd:'09:00',open_dagen:openDagen,materiaal:matRegels,opmerking:'Levering week '+km.week+' — '+loc.name+' ('+thNamen+')'});
        } else {
          // Opvolgende week: alleen thema's wisselen
          // Thema's die vertrekken vs aankomen
          const prevKmThemas=kts.filter(kt=>kt.kampmoment_id===prevKm.id);
          const prevThIds=new Set(prevKmThemas.map(kt=>kt.thema_id));
          const newThIds=new Set(kmThemas.map(kt=>kt.thema_id));
          const vertrekkende=prevKmThemas.filter(kt=>!newThIds.has(kt.thema_id));
          const aankomende=kmThemas.filter(kt=>!prevThIds.has(kt.thema_id));

          if(vertrekkende.length||aankomende.length){
            // Wissel transport: haal oud thema materiaal op, breng nieuw
            const ophaalMat=vertrekkende.flatMap(kt=>{const th=themas.find(t=>t.id===kt.thema_id);return thema_mat.filter(m=>m.thema_id===kt.thema_id).map(m=>({naam:'['+( th?.name||'?')+'] '+m.name,qty:m.qty,soort:'thema'}));});
            const leverMat=aankomende.flatMap(kt=>{const th=themas.find(t=>t.id===kt.thema_id);return thema_mat.filter(m=>m.thema_id===kt.thema_id).map(m=>({naam:'['+( th?.name||'?')+'] '+m.name,qty:m.qty,soort:'thema'}));});
            const prevOpen=getOpenDagen(prevKm);
            const wisseldatum=prevOpen.length?nextWorkday(prevOpen[prevOpen.length-1]):prevWorkday(openDagen[0]);
            if(ophaalMat.length) voorstellen.push({type:'ophaling',kampmoment_id:km.id,locatie:loc.name,locatie_id:loc.id,naar_locatie_id:vanId,datum:wisseldatum,tijd:'09:00',open_dagen:openDagen,materiaal:ophaalMat,opmerking:'Thema-wissel ophaling week '+km.week+' — '+loc.name});
            if(leverMat.length) voorstellen.push({type:'levering',kampmoment_id:km.id,locatie:loc.name,locatie_id:loc.id,van_locatie_id:vanId,datum:wisseldatum,tijd:'11:00',open_dagen:openDagen,materiaal:leverMat,opmerking:'Thema-wissel levering week '+km.week+' — '+loc.name});
          }
          // Basismateriaal blijft — geen transport nodig
        }

        if(!heeftOpvolger){
          // Laatste week op deze locatie: haal alles op
          const matRegels=[...locMat.map(m=>({naam:m.name,qty:m.qty,soort:'basis'})),...themaMatRegels];
          voorstellen.push({type:'ophaling',kampmoment_id:km.id,locatie:loc.name,locatie_id:loc.id,naar_locatie_id:vanId,datum:nextWorkday(openDagen[openDagen.length-1]),tijd:'17:00',open_dagen:openDagen,materiaal:matRegels,opmerking:'Ophaling week '+km.week+' — '+loc.name+' ('+thNamen+')'});
        }
      });
    });

        // Cross-locatie thema verplaatsing
    // Als een thema van locatie A naar locatie B gaat volgende week,
    // genereer een direct transport A->B als stockage leeg is
    const allThemaIds=[...new Set(kts.map(kt=>kt.thema_id))];
    allThemaIds.forEach(thId=>{
      // Find all kampmomenten with this thema, sorted by week
      const kmsMetThema=kts.filter(kt=>kt.thema_id===thId)
        .map(kt=>kms.find(km=>km.id===kt.kampmoment_id)).filter(Boolean)
        .sort((a,b)=>a.week-b.week);
      for(let i=0;i<kmsMetThema.length-1;i++){
        const kmA=kmsMetThema[i],kmB=kmsMetThema[i+1];
        if(kmA.locatie_id===kmB.locatie_id)continue; // zelfde locatie
        if(kmB.week!==kmA.week+1)continue; // niet aaneensluitend
        const locA=locs.find(l=>l.id===kmA.locatie_id);
        const locB=locs.find(l=>l.id===kmB.locatie_id);
        if(!locA||!locB)continue;
        const openA=getOpenDagen(kmA);
        const openB=getOpenDagen(kmB);
        if(!openA.length||!openB.length)continue;
        const th=themas.find(t=>t.id===thId);
        const thMat=thema_mat.filter(m=>m.thema_id===thId).map(m=>({naam:'['+( th?.name||'?')+'] '+m.name,qty:m.qty,soort:'thema'}));
        if(!thMat.length)continue;
        // Direct transport: laatste dag A (of dag erna) naar locatie B
        const transferDatum=nextWorkday(openA[openA.length-1]);
        voorstellen.push({
          type:'levering',
          kampmoment_id:kmB.id,
          locatie:locB.name,
          locatie_id:locB.id,
          van_locatie_id:locA.id,
          datum:transferDatum,
          tijd:'10:00',
          materiaal:thMat,
          opmerking:'Thema-transfer: '+(th?.name||'?')+' van '+locA.name+' naar '+locB.name
        });
      }
    });

    // Sort by datum, tijd
    voorstellen.sort((a,b)=>a.datum.localeCompare(b.datum)||a.tijd.localeCompare(b.tijd));
    res.json(voorstellen);
  });
  app.post('/api/transport-taken',(req,res)=>{const{type,datum,tijd,van_locatie_id,naar_locatie_id,opmerking,wie,kampmoment_id,regels}=req.body;const id=ins('INSERT INTO transport_taken (type,datum,tijd,van_locatie_id,naar_locatie_id,opmerking,wie,kampmoment_id,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',[type,datum,tijd||'09:00',van_locatie_id||null,naar_locatie_id||null,opmerking||'',wie||'',kampmoment_id||null,'gepland',now()]);if(regels&&regels.length)regels.forEach(r=>ins('INSERT INTO transport_regels (taak_id,naam,qty,soort) VALUES (?,?,?,?)',[id,r.naam,r.qty||1,r.soort||'andere']));const taak=get('SELECT * FROM transport_taken WHERE id=?',[id]);const tr=all('SELECT * FROM transport_regels WHERE taak_id=?',[id]);res.json({...taak,regels:tr});});
  app.put('/api/transport-taken/:id',(req,res)=>{const{type,datum,tijd,van_locatie_id,naar_locatie_id,opmerking,wie,status}=req.body;run('UPDATE transport_taken SET type=?,datum=?,tijd=?,van_locatie_id=?,naar_locatie_id=?,opmerking=?,wie=?,status=? WHERE id=?',[type,datum,tijd||'09:00',van_locatie_id||null,naar_locatie_id||null,opmerking||'',wie||'',status||'gepland',req.params.id]);res.json(get('SELECT * FROM transport_taken WHERE id=?',[req.params.id]));});
  app.delete('/api/transport-taken/:id',(req,res)=>{run('DELETE FROM transport_regels WHERE taak_id=?',[req.params.id]);run('DELETE FROM transport_taken WHERE id=?',[req.params.id]);res.json({ok:true});});
  app.put('/api/transport-taken/:id/status',(req,res)=>{run('UPDATE transport_taken SET status=? WHERE id=?',[req.body.status,req.params.id]);res.json(get('SELECT * FROM transport_taken WHERE id=?',[req.params.id]));});
  app.post('/api/transport-regels',(req,res)=>{const{taak_id,naam,qty,soort}=req.body;const id=ins('INSERT INTO transport_regels (taak_id,naam,qty,soort) VALUES (?,?,?,?)',[taak_id,naam,qty||1,soort||'andere']);res.json(get('SELECT * FROM transport_regels WHERE id=?',[id]));});
  app.delete('/api/transport-regels/:id',(req,res)=>{run('DELETE FROM transport_regels WHERE id=?',[req.params.id]);res.json({ok:true});});



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
      chauffeurs: all('SELECT * FROM chauffeurs'),
      ploeg_shifts: all('SELECT * FROM ploeg_shifts'),
    };
    res.setHeader('Content-Disposition', 'attachment; filename="sporty-backup-' + new Date().toISOString().split('T')[0] + '.json"');
    res.setHeader('Content-Type', 'application/json');
    res.json(data);
  });

  // Reset: wis alle data voor import
  app.post('/api/import/reset', (req, res) => {
    try {
      const tables = ['ploeg_shifts','transport_regels','transport_taken','verbruik_log',
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
      transport_taken: ['id','type','datum','tijd','van_locatie_id','naar_locatie_id','opmerking','wie','kampmoment_id','status','created_at'],
      transport_regels: ['id','taak_id','naam','qty','soort'],
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
    const items = all('SELECT * FROM sport_items ORDER BY cat, name');
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
    const {name, cat, notities} = req.body;
    if (!name) return res.status(400).json({error: 'Naam vereist'});
    const id = ins('INSERT INTO sport_items (name,cat,notities) VALUES (?,?,?)', [name, cat||'sport', notities||'']);
    res.json({...get('SELECT * FROM sport_items WHERE id=?', [id]), sets: []});
  });
  app.put('/api/sport/:id', (req,res) => {
    const {name,cat,notities} = req.body;
    run('UPDATE sport_items SET name=?,cat=?,notities=? WHERE id=?', [name,cat||'sport',notities||'',req.params.id]);
    res.json(get('SELECT * FROM sport_items WHERE id=?', [req.params.id]));
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
  app.get('/api/gedeeld', (req,res) => {
    const items = all('SELECT * FROM gedeeld_items ORDER BY cat, name');
    const gebruik = all('SELECT gg.*, t.name as thema_name FROM gedeeld_gebruik gg LEFT JOIN themas t ON t.id=gg.thema_id');
    // Calculate conflicts per week: for each week, sum qty needed across all themas active that week
    const kts = all('SELECT * FROM kampmoment_themas');
    const kms = all('SELECT * FROM kampmomenten');
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
      return {...item, gebruik: g, weekConflicts};
    }));
  });

  app.post('/api/gedeeld', (req,res) => {
    const {name, cat, totaal, notities} = req.body;
    if (!name) return res.status(400).json({error: 'Naam vereist'});
    const id = ins('INSERT INTO gedeeld_items (name,cat,totaal,notities) VALUES (?,?,?,?)', [name, cat||'gedeeld', totaal||1, notities||'']);
    res.json({...get('SELECT * FROM gedeeld_items WHERE id=?', [id]), gebruik: [], weekConflicts: {}});
  });
  app.put('/api/gedeeld/:id', (req,res) => {
    const {name,cat,totaal,notities} = req.body;
    run('UPDATE gedeeld_items SET name=?,cat=?,totaal=?,notities=? WHERE id=?', [name,cat||'gedeeld',totaal||1,notities||'',req.params.id]);
    saveDb(); res.json(get('SELECT * FROM gedeeld_items WHERE id=?', [req.params.id]));
  });
  app.delete('/api/gedeeld/:id', (req,res) => {
    run('DELETE FROM gedeeld_gebruik WHERE item_id=?', [req.params.id]);
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
