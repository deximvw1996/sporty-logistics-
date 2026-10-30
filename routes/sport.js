// routes/sport.js — uit server.js geknipt (F1 deel 1). Gedrag ongewijzigd.
// Kopjes: SPORT MATERIAAL, FOTO PER SPORT ITEM
'use strict';
module.exports = function(ctx){
  const {app,db,get,all,run,ins,saveDb,backupDb,now,isoDate,_genToken,resolveItemTypeId,logAct,logWijziging,insMetLog,updateMetLog,delMetLog,vereisRol,alleenKantoor,hashPin,checkSessie,_actieveLocatieConfig,_kvVerwacht,_kvKampmoment,_kvNaam,_bakItems,effectiefMateriaal,ensureGedeeldStock,DATA_DIR,DB_PATH,UPLOADS_DIR,BUNDELS_DIR,FRONTEND_PATH,ROOT_DIR,APP_PASSWORD,PORT,path,fs,express,crypto} = ctx;
  // ── SPORT MATERIAAL ──
  const _periodeId=(v)=>parseInt(v)||(get('SELECT id FROM vakantieperiodes WHERE actief=1')||{}).id||null;
  app.get('/api/sport', (req,res) => {
    const items = all('SELECT si.*, l.name as locatie_name FROM sport_items si LEFT JOIN locaties l ON l.id=si.locatie_id ORDER BY si.cat, si.name');
    const sets = all('SELECT ss.*, l.name as locatie_name FROM sport_sets ss LEFT JOIN locaties l ON l.id=ss.locatie_id ORDER BY ss.item_id, ss.label');
    // V2: enkel de planning van de gevraagde periode (?periode_id=, standaard de actieve).
    const pid=_periodeId(req.query.periode_id);
    const planning = all('SELECT sp.*, l.name as locatie_name FROM sport_planning sp LEFT JOIN locaties l ON l.id=sp.locatie_id WHERE sp.periode_id=?',[pid]);
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
    res.json({ok:true});
  });

  // Sport sets
  app.post('/api/sport/:id/sets', (req,res) => {
    const {label, locatie_id} = req.body;
    if (!label) return res.status(400).json({error: 'Label vereist'});
    const id = ins('INSERT INTO sport_sets (item_id,label,locatie_id) VALUES (?,?,?)', [req.params.id, label, locatie_id||null]);
    res.json({...get('SELECT ss.*, l.name as locatie_name FROM sport_sets ss LEFT JOIN locaties l ON l.id=ss.locatie_id WHERE ss.id=?', [id]), planning:[]});
  });
  app.put('/api/sport/sets/:id', (req,res) => {
    const {label, locatie_id} = req.body;
    run('UPDATE sport_sets SET label=?,locatie_id=? WHERE id=?', [label, locatie_id||null, req.params.id]);
    res.json(get('SELECT ss.*, l.name as locatie_name FROM sport_sets ss LEFT JOIN locaties l ON l.id=ss.locatie_id WHERE ss.id=?', [req.params.id]));
  });
  app.delete('/api/sport/sets/:id', (req,res) => {
    run('DELETE FROM sport_planning WHERE set_id=?', [req.params.id]);
    run('DELETE FROM sport_sets WHERE id=?', [req.params.id]);
    res.json({ok:true});
  });

  // Sport planning (which set is where which week)
  app.post('/api/sport/sets/:id/plan', (req,res) => {
    const {week, locatie_id} = req.body;
    const pid=_periodeId(req.body.periode_id);
    const setInfo=get('SELECT ss.*,si.name as item_naam FROM sport_sets ss LEFT JOIN sport_items si ON si.id=ss.item_id WHERE ss.id=?',[req.params.id]);
    if (locatie_id === null || locatie_id === undefined || locatie_id === '') {
      run('DELETE FROM sport_planning WHERE set_id=? AND week=? AND periode_id=?', [req.params.id, week, pid]);
      if(setInfo) logAct('sport','verplaatst',`${setInfo.item_naam||'Set'} "${setInfo.label}" — week ${week}: locatie vrijgemaakt`,null,null);
    } else {
      // PL3: weekplanning vervangt alle dagrijen van die set in die week; hele week = ma–vr.
      run('DELETE FROM sport_planning WHERE set_id=? AND week=? AND periode_id=?', [req.params.id, week, pid]);
      const _soort=String((setInfo&&setInfo.item_naam)||'').replace(/ +([A-Za-z]|[0-9]+)$/,'').trim();
      run('INSERT INTO sport_planning (set_id,locatie_id,week,periode_id,dag_van,dag_tot,soort) VALUES (?,?,?,?,1,5,?)', [req.params.id, locatie_id, week, pid, _soort]);
      const loc=get('SELECT name FROM locaties WHERE id=?',[locatie_id]);
      if(setInfo) logAct('sport','verplaatst',`${setInfo.item_naam||'Set'} "${setInfo.label}" → ${loc?.name||'?'} (week ${week})`,locatie_id,loc?.name);
    }
    res.json({ok:true});
  });

  // ── FOTO PER SPORT ITEM ──
  // Veiligheidsronde (DOORLICHTING-c #1): extensie uit een vaste lijst, bestaandsnaam volledig
  // server-side, pad-check binnen UPLOADS_DIR, max 2 MB gedecodeerd.
  const fotoLib=require('../lib/fotos')(UPLOADS_DIR); // V3c: één waarheid voor limiet + magic bytes
  const FOTO_EXTENSIES=new Set(['jpg','jpeg','png','webp']);
  const FOTO_MAX_BYTES=fotoLib.FOTO_MAX_BYTES;
  app.post('/api/sport/:id/foto',(req,res)=>{
    const{data,ext}=req.body;
    if(!data||typeof data!=='string')return res.status(400).json({error:'Geen afbeeldingsdata'});
    const extNorm=String(ext||'jpg').trim().toLowerCase().replace(/^\./,'');
    if(!FOTO_EXTENSIES.has(extNorm))return res.status(400).json({error:'Ongeldig bestandstype — alleen jpg, jpeg, png of webp'});
    const itemId=parseInt(req.params.id,10);
    if(!Number.isInteger(itemId)||itemId<=0)return res.status(400).json({error:'Ongeldig artikel-id'});
    const item=get('SELECT * FROM sport_items WHERE id=?',[itemId]);
    if(!item)return res.status(404).json({error:'Artikel niet gevonden'});
    let buf;
    try{ buf=Buffer.from(data.replace(/^data:[^;]+;base64,/,''),'base64'); }catch(e){ buf=null; }
    if(!buf||!buf.length)return res.status(400).json({error:'Afbeeldingsdata is geen geldige base64'});
    if(buf.length>FOTO_MAX_BYTES)return res.status(400).json({error:`Foto te groot (max ${FOTO_MAX_BYTES/1024/1024} MB)`});
    if(!fotoLib.detecteer(buf))return res.status(400).json({error:'Ongeldig bestandstype — alleen jpg, png of webp'});
    const filename=`sport-${itemId}-${Date.now()}.${extNorm}`;
    const doel=path.resolve(UPLOADS_DIR,filename);
    if(!doel.startsWith(path.resolve(UPLOADS_DIR)+path.sep))return res.status(400).json({error:'Ongeldige bestandsnaam'});
    // Verwijder oude foto (enkel als die zelf netjes binnen de uploads-map ligt)
    if(item.foto_path){
      const oud=path.resolve(UPLOADS_DIR,path.basename(String(item.foto_path)));
      if(oud.startsWith(path.resolve(UPLOADS_DIR)+path.sep)){try{fs.unlinkSync(oud);}catch(e){}}
    }
    try{fs.writeFileSync(doel,buf);}
    catch(e){return res.status(500).json({error:'Opslaan mislukt: '+e.message});}
    run('UPDATE sport_items SET foto_path=? WHERE id=?',[filename,itemId]);
    logAct('sport','foto',`Foto toegevoegd aan "${item.name}"`,null,null);
    res.json({foto_path:filename});
  });
  app.delete('/api/sport/:id/foto',(req,res)=>{
    const item=get('SELECT * FROM sport_items WHERE id=?',[req.params.id]);
    if(item?.foto_path){try{fs.unlinkSync(path.join(UPLOADS_DIR,item.foto_path));}catch(e){}}
    run('UPDATE sport_items SET foto_path=? WHERE id=?',['',req.params.id]);
    res.json({ok:true});
  });

};
