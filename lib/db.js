// lib/db.js — sql.js-laag uit server.js geknipt (F1 deel 1). Gedrag ongewijzigd.
'use strict';
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

module.exports = function(DATA_DIR, DB_PATH){
let db;

// F1 deel 2 — schrijf-batching + atomaire schrijving.
// run/ins schrijven NIET meer zelf naar schijf; ze zetten `vuil`. flush() schrijft alleen als vuil:
// eerst naar sporty.db.tmp (zelfde map), dan renameSync over sporty.db — een crash midden in het
// schrijven laat nooit een half bestand achter. flush wordt aangeroepen na elk request (res 'finish'
// in server.js), elke 5 s door een timer, bij SIGTERM/SIGINT en bij uncaughtException.
// saveDb() = GEFORCEERDE flush (zet vuil en schrijft): bedoeld voor code die rechtstreeks db.run
// gebruikt (migraties, herstel/import in beheer) en zo buiten run/ins om wijzigt.
let vuil = false;
let schrijfacties = 0;
function markeerVuil() { vuil = true; }
function flush() {
  if (!vuil || !db) return false;
  const data = Buffer.from(db.export());
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, DB_PATH);
  vuil = false;
  schrijfacties++;
  try { backupDb(data); } catch (e) { console.error('Backup mislukt:', e.message); }
  return true;
}
function saveDb() { vuil = true; return flush(); }

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
    .filter(f => /^sporty-\d{4}-\d{2}-\d{2}\.db$/.test(f)) // ME1: alleen automatische; handmatige (sporty-hand-*) tellen niet mee
    .sort();
  while (files.length > 14) {
    const oud = files.shift();
    try { fs.unlinkSync(path.join(backupDir, oud)); } catch (e) {}
  }
}
function run(sql, p=[]) { db.run(sql, p); vuil = true; }
function get(sql, p=[]) { const s=db.prepare(sql); s.bind(p); const r=s.step()?s.getAsObject():null; s.free(); return r; }
function all(sql, p=[]) { const s=db.prepare(sql); s.bind(p); const r=[]; while(s.step())r.push(s.getAsObject()); s.free(); return r; }
function ins(sql, p=[]) { db.run(sql,p); const id=get('SELECT last_insert_rowid() as id').id; vuil = true; return id; }
function now() { return new Date().toLocaleString('nl-BE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
function isoDate(d) { return d.toISOString().split('T')[0]; }
function _genToken(len=10){const c='abcdefghijklmnopqrstuvwxyz0123456789';return Array.from({length:len},()=>c[Math.floor(Math.random()*c.length)]).join('');}
// Centrale materiaalcatalogus: geeft altijd een item_types.id terug voor een naam.
// Bestaat de naam nog niet (case-insensitive), dan wordt ze aangemaakt i.p.v. overgeslagen —
// zo blijft élk materiaal-item, ook nieuwe spellingen, gekoppeld aan de catalogus.
// Derde parameter maakAan (standaard true): false = alleen opzoeken, nooit aanmaken.
function resolveItemTypeId(naam, categorieHint, maakAan = true) {
  const schoon = (naam || '').toString().trim();
  if (!schoon) return null;
  const bestaand = get('SELECT id FROM item_types WHERE LOWER(naam)=LOWER(?)', [schoon]);
  if (bestaand) return bestaand.id;
  // V3c: transportregels (vrije tekst als '17 × Kleuterfiets rood') mogen de catalogus niet vullen.
  // Vangnet voor aanroepen die nog maakAan=true meegeven: '17 × …' (aantal-prefix met ×) is nooit een materiaalnaam.
  if (!maakAan || /^\d+\s*×\s/.test(schoon)) return null;
  return ins('INSERT INTO item_types (naam,eenheid,categorie) VALUES (?,?,?)', [schoon, 'stuk', categorieHint || 'materiaal']);
}
function logAct(type, actie, beschrijving, locatie_id=null, locatie_naam=null) {
  try { run('INSERT INTO activiteiten_log (tijdstip,type,actie,beschrijving,locatie_id,locatie_naam) VALUES (?,?,?,?,?,?)',
    [now(),type,actie,beschrijving,locatie_id||null,locatie_naam||null]); }
  catch(e) { console.error('Log fout:', e.message); }
}

// ── F1 deel 3: wijzigingslog ──
// Elke INSERT/UPDATE/DELETE op de logistieke kern (bakken, transport_taken, transport_ritten, aanvragen,
// kampmomenten) loopt via deze helpers; ze schrijven de hele oude en nieuwe rij als JSON in `wijzigingen`.
// persoon komt uit req.persoon (sessie); zonder sessie (kv-link, rit-link, systeem) blijft persoon_id null
// en zegt `context` waar de wijziging vandaan kwam. Log-fouten blokkeren de echte schrijving nooit.
function logWijziging(req, tabel, rijId, actie, oud, nieuw, context) {
  try {
    let p = req && req.persoon ? req.persoon : null;
    // TF1 G16: acties via de rit-link (geen sessie) krijgen de chauffeur van die rit als naam (en persoon_id als gekend).
    if (!p && req && req.params && req.params.token && /^\/api\/rit-token\//.test(req.originalUrl || req.url || '')) {
      const r = get('SELECT r.chauffeur, r.personeel_id, pe.naam FROM transport_ritten r LEFT JOIN personeel pe ON pe.id=r.personeel_id WHERE r.rit_token=?', [req.params.token]);
      if (r) p = { persoon_id: r.personeel_id || null, naam: r.naam || r.chauffeur || 'chauffeur (rit-link)' };
    }
    const ctxt = context || (p ? 'api' : 'systeem');
    db.run('INSERT INTO wijzigingen (tijdstip,persoon_id,persoon_naam,tabel,rij_id,actie,oud,nieuw,context) VALUES (?,?,?,?,?,?,?,?,?)',
      [new Date().toISOString(), p ? p.persoon_id : null, p ? p.naam : null, tabel, rijId, actie,
       oud == null ? null : JSON.stringify(oud), nieuw == null ? null : JSON.stringify(nieuw), ctxt]);
    vuil = true;
  } catch (e) { console.error('Wijzigingslog fout:', e.message); }
}
const _telVragen = (sql) => (sql.match(/\?/g) || []).length;
// insMetLog(req, tabel, kolommen[], waarden[], context)  óf  insMetLog(req, 'INSERT INTO t (...) VALUES (...)', params, context)
function insMetLog(req, tabel, kolommen, waarden, context) {
  let sql, params, t;
  if (/^\s*INSERT/i.test(tabel)) { sql = tabel; params = kolommen || []; context = waarden; t = /INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i.exec(sql)[1]; }
  else { t = tabel; sql = `INSERT INTO ${t} (${kolommen.join(',')}) VALUES (${kolommen.map(() => '?').join(',')})`; params = waarden; }
  db.run(sql, params); vuil = true;
  const id = get('SELECT last_insert_rowid() as id').id;
  logWijziging(req, t, id, 'insert', null, get(`SELECT * FROM ${t} WHERE id=?`, [id]), context);
  return id;
}
// updateMetLog(req, tabel, id | {waar, params}, velden{kol:waarde} | {set, params}, context)
//   óf updateMetLog(req, 'UPDATE t SET ... WHERE ...', params, context)
// Berekende SET-expressies en WHERE op niet-id worden ondersteund: eerst de getroffen rijen selecteren,
// dan per rij UPDATE ... WHERE id=? en oud+nieuw loggen.
function updateMetLog(req, tabel, waar, velden, context) {
  let t, setSql, setParams, waarSql, waarParams;
  if (/^\s*UPDATE/i.test(tabel)) {
    const m = /^\s*UPDATE\s+(\w+)\s+SET\s+([\s\S]*?)\s+WHERE\s+([\s\S]*)$/i.exec(tabel);
    if (!m) throw new Error('updateMetLog: kan UPDATE niet ontleden: ' + tabel);
    const params = waar || []; context = velden;
    t = m[1]; setSql = m[2]; waarSql = m[3];
    const n = _telVragen(setSql); setParams = params.slice(0, n); waarParams = params.slice(n);
  } else {
    t = tabel;
    if (waar && typeof waar === 'object') { waarSql = waar.waar; waarParams = waar.params || []; } else { waarSql = 'id=?'; waarParams = [waar]; }
    if (velden && velden.set) { setSql = velden.set; setParams = velden.params || []; }
    else { const k = Object.keys(velden); setSql = k.map((c) => c + '=?').join(','); setParams = k.map((c) => velden[c]); }
  }
  const rijen = all(`SELECT * FROM ${t} WHERE ${waarSql}`, waarParams);
  for (const oud of rijen) {
    db.run(`UPDATE ${t} SET ${setSql} WHERE id=?`, [...setParams, oud.id]); vuil = true;
    logWijziging(req, t, oud.id, 'update', oud, get(`SELECT * FROM ${t} WHERE id=?`, [oud.id]), context);
  }
  return rijen.length;
}
// delMetLog(req, tabel, id | {waar, params}, context)  óf  delMetLog(req, 'DELETE FROM t WHERE ...', params, context)
// Bulk-DELETE wordt per rij gelogd.
function delMetLog(req, tabel, waar, context) {
  let t, waarSql, waarParams;
  if (/^\s*DELETE/i.test(tabel)) {
    const m = /^\s*DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+([\s\S]*))?$/i.exec(tabel);
    if (!m) throw new Error('delMetLog: kan DELETE niet ontleden: ' + tabel);
    const params = waar || []; t = m[1]; waarSql = m[2] || '1=1'; waarParams = params;
  } else {
    t = tabel;
    if (waar && typeof waar === 'object') { waarSql = waar.waar; waarParams = waar.params || []; } else { waarSql = 'id=?'; waarParams = [waar]; }
  }
  const rijen = all(`SELECT * FROM ${t} WHERE ${waarSql}`, waarParams);
  for (const oud of rijen) {
    db.run(`DELETE FROM ${t} WHERE id=?`, [oud.id]); vuil = true;
    logWijziging(req, t, oud.id, 'delete', oud, null, context);
  }
  return rijen.length;
}

async function open(){
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_PATH) ? new SQL.Database(fs.readFileSync(DB_PATH)) : new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');
  return db;
}

return {
  get db(){ return db; }, set db(v){ db = v; },
  open, saveDb, flush, markeerVuil, isVuil: () => vuil, aantalSchrijfacties: () => schrijfacties, backupDb, run, get, all, ins, now, isoDate, _genToken, resolveItemTypeId, logAct,
  logWijziging, insMetLog, updateMetLog, delMetLog,
};
};
