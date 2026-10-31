// routes/beheer.js — uit server.js geknipt (F1 deel 1). Gedrag ongewijzigd.
// Kopjes: DATA EXPORT/IMPORT (incl. herstel-db), ACTIVITEITENLOG, PWA
'use strict';
module.exports = function(ctx){
  const {app,db,get,all,run,ins,saveDb,backupDb,now,isoDate,_genToken,resolveItemTypeId,logAct,logWijziging,insMetLog,updateMetLog,delMetLog,vereisRol,alleenKantoor,hashPin,checkSessie,_actieveLocatieConfig,_kvVerwacht,_kvKampmoment,_kvNaam,_bakItems,effectiefMateriaal,ensureGedeeldStock,DATA_DIR,DB_PATH,UPLOADS_DIR,BUNDELS_DIR,FRONTEND_PATH,ROOT_DIR,APP_PASSWORD,PORT,path,fs,express,crypto} = ctx;
  const __dirname = ROOT_DIR;
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
  // Veiligheidsronde (DOORLICHTING-c #3): tabelnaam alleen geldig als hij letterlijk in sqlite_master staat.
  function _tabelBestaat(tabel){ return typeof tabel==='string' && _alleTabellen().includes(tabel); }
  app.get('/api/export', alleenKantoor, (req, res) => {
    const data = { versie: 3, datum: new Date().toISOString() };
    // Veiligheidsronde (DOORLICHTING-c #3): sessietokens nooit exporteren; pincode-hashes strippen.
    _alleTabellen().filter(t=>t!=='sessies').forEach(t=>{ try{ data[t]=all(`SELECT * FROM ${t}`); }catch(e){ data[t]=[]; } });
    if(Array.isArray(data.personeel)) data.personeel=data.personeel.map(p=>{const{pincode,...rest}=p;return rest;});
    // CH1 (DRAAIBOEK 3.7): telefoon van locatiecontacten en sleutel-info nooit in een export.
    if(Array.isArray(data.locaties)) data.locaties=data.locaties.map(l=>{const{contact_tel,contact_telefoon,sleutel_info,...rest}=l;return rest;});
    res.setHeader('Content-Disposition', 'attachment; filename="sporty-backup-' + new (require('../lib/testklok').EchteDate)().toISOString().split('T')[0] + '.json"');
    res.setHeader('Content-Type', 'application/json');
    res.json(data);
  });

  // Volledige backup: download de hele SQLite-database als bestand (alle data, gegarandeerd compleet)
  // Herstel-endpoint (prod-zetronde 2026-08-04): vervangt de volledige database door een
  // geüpload sqlite-bestand. Achter Basic-auth ÉN sessietoken. Maakt eerst een veiligheidskopie
  // in DATA_DIR/backups, schrijft dan het nieuwe bestand en herstart het proces (Railway start
  // de service automatisch opnieuw; de nieuwe db wordt dan vers ingeladen, migraties zijn gegate).
  app.post('/api/herstel-db', alleenKantoor, express.raw({ type: 'application/octet-stream', limit: '60mb' }), (req, res) => {
    try {
      const buf = req.body;
      if (!buf || buf.length < 100 || buf.slice(0, 15).toString() !== 'SQLite format 3')
        return res.status(400).json({ error: 'Geen geldig SQLite-bestand' });
      // BH2: alleen na het getypte woord TERUGZETTEN (header x-bevestig), en eerst een back-up van de huidige toestand (in de lijst op /backup).
      if (String(req.headers['x-bevestig'] || '') !== 'TERUGZETTEN')
        return res.status(400).json({ error: 'Typ TERUGZETTEN om te bevestigen' });
      const wie = req.persoon ? req.persoon.naam : '?';
      const voor = ctx.nachtbackup.handmatig('voor terugzetten · ' + wie);
      logAct('beheer', 'terugzetten', `Back-up teruggezet (${buf.length} bytes) door ${wie}; vooraf bewaard als ${voor.naam}`, null, null);
      saveDb();
      fs.writeFileSync(DB_PATH, buf);
      ctx.nachtbackup.noteerNaHerstart(`Back-up teruggezet (${buf.length} bytes) door ${wie}; de toestand ervoor staat in ${voor.naam}`);
      res.json({ ok: true, bytes: buf.length, melding: 'Database vervangen — server herstart nu' });
      // Hoofdchat 29/10: exit 0 wordt door Railway (restart policy on-failure) NIET herstart → prod lag 10 min plat. Exit 1 wél.
      setTimeout(() => process.exit(1), 500);
    } catch(e) { res.status(500).json({ error: e.message }); }
  });
  app.get('/api/backup-db', alleenKantoor, (req, res) => {
    try {
      const data = Buffer.from(db.export());
      const ts = new (require('../lib/testklok').EchteDate)().toISOString().replace('T','_').replace(/:/g,'-').slice(0,16);
      res.setHeader('Content-Disposition', 'attachment; filename="sporty-backup-' + ts + '.db"');
      res.setHeader('Content-Type', 'application/octet-stream');
      res.send(data);
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // Diagnose: waar staat de database echt? (volume vs tijdelijk)
  app.get('/api/dbinfo', alleenKantoor, (req, res) => {
    let themas=0; try{ themas=get('SELECT count(*) as n FROM themas').n; }catch(e){}
    res.json({ db_path: DB_PATH, data_dir: DATA_DIR, railway_volume_env: process.env.RAILWAY_VOLUME_MOUNT_PATH || null, dirname: __dirname, themas });
  });
  // Reset: wis alle data voor import (dynamisch, alle levende tabellen behalve app_vlaggen/sessies
  // — die twee moeten een reset overleven zodat migratievlaggen en ingelogde sessies niet
  // per ongeluk verdwijnen bij een import-rondje).
  app.post('/api/import/reset', alleenKantoor, (req, res) => {
    try {
      const tables = _alleTabellen().filter(t=>t!=='app_vlaggen'&&t!=='sessies');
      tables.forEach(t => { try { db.run('DELETE FROM ' + t); } catch(e) {} });
      saveDb();
      res.json({ ok: true, tables });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // Importeer één tabel per keer — kolommen worden afgeleid uit de data zelf, gefilterd op
  // kolommen die écht in de tabel bestaan (dynamisch i.p.v. hardcoded, S3.8).
  app.post('/api/import/tabel', alleenKantoor, (req, res) => {
    const { table, rows } = req.body;
    if (!table || !rows) return res.status(400).json({ error: 'Tabel of rijen ontbreken' });
    // Veiligheidsronde (DOORLICHTING-c #6): whitelist vóór PRAGMA/INSERT — de naam komt uit het request.
    if (!_tabelBestaat(table)) return res.status(400).json({ error: 'Onbekende tabel: ' + String(table).slice(0,80) });
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


  // ── BH2: back-ups (lijst, download, handmatig, inhoud) ──
  const _mb = (n) => (n / 1048576).toFixed(1).replace('.', ',') + ' MB';
  app.get('/api/backups', alleenKantoor, (req, res) => {
    const nb = ctx.nachtbackup, l = nb.lijst();
    const v = (n) => (get('SELECT waarde FROM app_vlaggen WHERE naam=?', [n]) || {}).waarde || '';
    res.json({ backups: l.map((b) => ({ ...b, grootte_tekst: _mb(b.grootte) })), bewaard: 14, uur: nb.uurInstelling().map((x) => String(x).padStart(2, '0')).join(':'),
      laatst_nacht: v('nachtbackup_laatst') || null, fout: v('nachtbackup_fout') || null, volgende: nb.volgende().toISOString() });
  });
  app.post('/api/backups/nu', alleenKantoor, (req, res) => {
    try { const b = ctx.nachtbackup.handmatig(req.persoon ? req.persoon.naam : '?'); res.json({ ok: true, ...b, grootte_tekst: _mb(b.grootte) }); }
    catch (e) { res.status(500).json({ error: 'Back-up mislukt: ' + e.message }); }
  });
  app.get('/api/backups/:naam', alleenKantoor, (req, res) => {
    const naam = String(req.params.naam || '');
    if (!ctx.nachtbackup.PATROON.test(naam) || naam.includes('..') || naam.includes('/') || naam.includes(String.fromCharCode(92))) return res.status(400).json({ error: 'Ongeldige naam' });
    const p = path.join(ctx.nachtbackup.map(), naam);
    if (!fs.existsSync(p)) return res.status(404).json({ error: 'Back-up niet gevonden' });
    logAct('beheer', 'download', `Back-up gedownload: ${naam} (door ${req.persoon ? req.persoon.naam : '?'})`, null, null);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="' + naam + '"');
    res.send(fs.readFileSync(p));
  });
  app.get('/api/backup-inhoud', alleenKantoor, (req, res) => {
    const n = (sql) => { try { return get(sql).n; } catch (e) { return 0; } };
    let grootte = 0, gewijzigd = null; try { const st = fs.statSync(DB_PATH); grootte = st.size; gewijzigd = st.mtime.toISOString(); } catch (e) {}
    res.json({ locaties: n('SELECT COUNT(*) AS n FROM locaties'), themas: n('SELECT COUNT(*) AS n FROM themas'), bakken: n('SELECT COUNT(*) AS n FROM bakken'),
      ritten: n('SELECT COUNT(*) AS n FROM transport_ritten'), personeel: n('SELECT COUNT(*) AS n FROM personeel'), wijzigingen: n('SELECT COUNT(*) AS n FROM wijzigingen'),
      db_grootte: grootte, db_grootte_tekst: _mb(grootte), laatste_wijziging: gewijzigd, railway: !!process.env.RAILWAY_VOLUME_MOUNT_PATH,
      laatste_import: (get("SELECT tijdstip FROM activiteiten_log WHERE type='import' OR actie LIKE 'import%' ORDER BY id DESC LIMIT 1") || {}).tijdstip || null,
      laatste_terugzetten: (get("SELECT tijdstip FROM activiteiten_log WHERE actie='terugzetten' ORDER BY id DESC LIMIT 1") || {}).tijdstip || null });
  });
  const _paginaRol = (req, res, next) => { const tk = req.headers['x-auth-token'] || ''; if (!tk) return next(); req.persoon = checkSessie(tk); if (!req.persoon) return res.status(401).send('Niet ingelogd'); return alleenKantoor(req, res, next); };
  app.get('/backup', _paginaRol, (req, res) => res.sendFile(path.join(ROOT_DIR, 'public', 'backup.html')));

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

  // ── F1 deel 3: WIJZIGINGSLOG (hele oude/nieuwe rij per INSERT/UPDATE/DELETE op de logistieke kern) ──
  // Alleen kantoor; nieuwste eerst; oud/nieuw komen als geparseerde objecten terug.
  app.get('/api/wijzigingen', alleenKantoor, (req,res)=>{
    const {tabel, rij_id, limit=100}=req.query;
    const conditions=[];const params=[];
    if(tabel){conditions.push('tabel=?');params.push(String(tabel));}
    if(rij_id){conditions.push('rij_id=?');params.push(parseInt(rij_id));}
    let sql='SELECT * FROM wijzigingen';
    if(conditions.length) sql+=' WHERE '+conditions.join(' AND ');
    sql+=' ORDER BY id DESC LIMIT ?';
    params.push(Math.min(parseInt(limit)||100,1000));
    const parse=(s)=>{ if(s==null) return null; try{ return JSON.parse(s); }catch(e){ return s; } };
    res.json(all(sql,params).map(w=>({...w,oud:parse(w.oud),nieuw:parse(w.nieuw)})));
  });

  // PWA: /sw.js en /manifest.json staan in routes/live.js (RT1)

};
