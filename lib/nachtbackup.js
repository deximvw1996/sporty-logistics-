// lib/nachtbackup.js — BH2 punt 1: automatische nachtback-up.
// Elke nacht op het uur uit app_vlaggen 'tijd_nachtbackup' (standaard 03:00, Europe/Brussels via TZ) een kopie van de database naar
// DATA_DIR/backups/sporty-JJJJ-MM-DD.db, via dezelfde veilige weg als backupDb (eerst saveDb, dan kopiëren). De laatste 14 blijven.
// Bij opstart: is de laatste nachtback-up ouder dan 24 u (of is er geen), dan meteen één. Gelogd in het Logboek; mislukt het, dan
// een logregel + vlag 'nachtbackup_fout' (rood op /backup). Gooit nooit: de server mag hierdoor niet crashen.
// Handmatige back-ups ("Download nu") komen in dezelfde map als sporty-JJJJ-MM-DD-UUMM.db; wie ze maakte staat in app_vlaggen.
'use strict';
const fs = require('fs');
const path = require('path');

const PATROON = /^sporty-(\d{4})-(\d{2})-(\d{2})(?:-(\d{2})(\d{2}))?\.db$/;
const BEWAAR = 14;
const pad = (n) => String(n).padStart(2, '0');
const dag = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

module.exports = function (ctx) {
  const { db, get, run, saveDb, logAct, DATA_DIR } = ctx;
  const map = () => path.join(DATA_DIR, 'backups');
  const vlag = (n) => (get('SELECT waarde FROM app_vlaggen WHERE naam=?', [n]) || {}).waarde || '';
  const zetVlag = (n, w) => run('INSERT OR REPLACE INTO app_vlaggen (naam,waarde) VALUES (?,?)', [n, w]);

  function lijst() {
    if (!fs.existsSync(map())) return [];
    return fs.readdirSync(map()).filter((f) => PATROON.test(f)).map((f) => {
      const m = PATROON.exec(f), st = fs.statSync(path.join(map(), f));
      const wie = vlag('backup_wie:' + f);
      return { naam: f, datum: `${m[1]}-${m[2]}-${m[3]}`, uur: m[4] ? `${m[4]}:${m[5]}` : '', grootte: st.size, gewijzigd: st.mtime.toISOString(),
        soort: m[4] ? 'handmatig' : 'automatisch', wie: wie || (m[4] ? '' : 'automatisch') };
    }).sort((a, b) => (b.datum + (b.uur || '99')).localeCompare(a.datum + (a.uur || '99')) || b.gewijzigd.localeCompare(a.gewijzigd));
  }
  function opruimen() {
    const l = lijst();
    for (const x of l.slice(BEWAAR)) {
      try { fs.unlinkSync(path.join(map(), x.naam)); run('DELETE FROM app_vlaggen WHERE naam=?', ['backup_wie:' + x.naam]); } catch (e) { /* volgende keer opnieuw */ }
    }
  }
  // Schrijft de huidige database naar backups/<naam> (eerst saveDb, dan kopiëren via .tmp).
  function schrijf(naam) {
    if (!fs.existsSync(map())) fs.mkdirSync(map(), { recursive: true });
    saveDb();
    const data = Buffer.from(db.export());
    const doel = path.join(map(), naam), tmp = doel + '.tmp';
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, doel);
    return data.length;
  }
  const mb = (n) => (n / 1048576).toFixed(1).replace('.', ',') + ' MB';

  function nacht(reden) {
    try {
      const naam = `sporty-${dag(new Date())}.db`;
      const n = schrijf(naam);
      zetVlag('nachtbackup_laatst', new Date().toISOString());
      run("DELETE FROM app_vlaggen WHERE naam='nachtbackup_fout'");
      opruimen();
      logAct('beheer', 'backup', `Nachtback-up gemaakt (${reden}): ${naam} · ${mb(n)}`, null, null);
      saveDb();
      return { ok: true, naam, grootte: n };
    } catch (e) {
      try { zetVlag('nachtbackup_fout', new Date().toISOString() + ' · ' + e.message); logAct('beheer', 'backup', `Nachtback-up MISLUKT: ${e.message}`, null, null); saveDb(); } catch (_) { /* niets */ }
      console.error('Nachtback-up mislukt:', e.message);
      return { ok: false, fout: e.message };
    }
  }
  function handmatig(wie) {
    const d = new Date();
    const naam = `sporty-${dag(d)}-${pad(d.getHours())}${pad(d.getMinutes())}.db`;
    const n = schrijf(naam);
    zetVlag('backup_wie:' + naam, wie || '?');
    opruimen();
    logAct('beheer', 'backup', `Handmatige back-up: ${naam} · ${mb(n)} (door ${wie || '?'})`, null, null);
    saveDb();
    return { naam, grootte: n };
  }
  function uurInstelling() {
    const m = /^(\d{1,2}):(\d{2})$/.exec(vlag('tijd_nachtbackup') || '03:00');
    return m ? [Math.min(23, +m[1]), Math.min(59, +m[2])] : [3, 0];
  }
  function volgende() {
    const [u, mi] = uurInstelling(), nu = new Date(), t = new Date(nu);
    t.setHours(u, mi, 0, 0);
    if (t <= nu) t.setDate(t.getDate() + 1);
    return t;
  }
  let timer = null;
  function plan() {
    try {
      if (timer) clearTimeout(timer);
      const ms = Math.max(1000, volgende() - new Date());
      timer = setTimeout(() => { nacht('nacht'); plan(); }, Math.min(ms, 2147000000));
      if (timer.unref) timer.unref();
    } catch (e) { console.error('Nachtback-up plannen mislukt:', e.message); }
  }
  // Logregel die een herstart moet overleven (terugzetten vervangt de database, dus de regel gaat via een bestand naar de nieuwe db).
  const notitie = () => path.join(map(), 'na-herstart.json');
  function noteerNaHerstart(tekst) {
    try { if (!fs.existsSync(map())) fs.mkdirSync(map(), { recursive: true }); fs.writeFileSync(notitie(), JSON.stringify({ tekst, op: new Date().toISOString() })); } catch (e) { console.error('Notitie na herstart mislukt:', e.message); }
  }
  function start() {
    try {
      if (fs.existsSync(notitie())) { const n = JSON.parse(fs.readFileSync(notitie(), 'utf8')); logAct('beheer', 'terugzetten', n.tekst, null, null); saveDb(); fs.unlinkSync(notitie()); }
    } catch (e) { console.error('Notitie na herstart lezen mislukt:', e.message); }
    try {
      const laatst = Date.parse(vlag('nachtbackup_laatst') || '') || 0;
      if (Date.now() - laatst > 24 * 3600 * 1000) nacht('opstart: laatste ouder dan 24 u');
      else opruimen();
    } catch (e) { console.error('Nachtback-up bij opstart mislukt:', e.message); }
    plan();
  }
  return { start, plan, noteerNaHerstart, nacht, handmatig, lijst, map, PATROON, volgende, uurInstelling };
};
