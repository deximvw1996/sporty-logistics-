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
    .filter(f => f.startsWith('sporty-') && f.endsWith('.db'))
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

async function open(){
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_PATH) ? new SQL.Database(fs.readFileSync(DB_PATH)) : new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');
  return db;
}

return {
  get db(){ return db; }, set db(v){ db = v; },
  open, saveDb, flush, markeerVuil, isVuil: () => vuil, aantalSchrijfacties: () => schrijfacties, backupDb, run, get, all, ins, now, isoDate, _genToken, resolveItemTypeId, logAct,
};
};
