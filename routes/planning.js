// routes/planning.js — uit server.js geknipt (F1 deel 1). Gedrag ongewijzigd.
// Kopjes: KAMPMOMENTEN, THEMAS AAN KAMPMOMENT, KALENDER, VAKANTIEPERIODES, SEIZOENSOVERZICHT
'use strict';
module.exports = function(ctx){
  const {app,db,get,all,run,ins,saveDb,backupDb,now,isoDate,_genToken,resolveItemTypeId,logAct,logWijziging,insMetLog,updateMetLog,delMetLog,vereisRol,alleenKantoor,hashPin,checkSessie,_actieveLocatieConfig,_kvVerwacht,_kvKampmoment,_kvNaam,_bakItems,effectiefMateriaal,ensureGedeeldStock,DATA_DIR,DB_PATH,UPLOADS_DIR,BUNDELS_DIR,FRONTEND_PATH,ROOT_DIR,APP_PASSWORD,PORT,path,fs,express,crypto} = ctx;
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
    const kvPersoon = km.kv_persoon_id ? get('SELECT id,naam FROM personeel WHERE id=?',[km.kv_persoon_id]) : null;
    return {...km, locatie:loc, themas, sport_sets:sportSets, open_dagen:openDagen, locatie_materiaal:locMat, periode, kv_persoon:kvPersoon};
  }

  app.get('/api/kampmomenten',(req,res)=>{
    const kms=all('SELECT * FROM kampmomenten ORDER BY periode_id,week,locatie_id');
    res.json(kms.map(km=>getKampmoment(km.id)).filter(Boolean));
  });

  app.post('/api/kampmomenten',(req,res)=>{
    const{locatie_id,week,periode_id,type,kv_persoon_id}=req.body;
    const periodeIdToUse=periode_id||1;
    const typeVal=(type==='themadag'?'themadag':'kamp');
    try {
      const id=insMetLog(req,'INSERT INTO kampmomenten (locatie_id,week,periode_id,type,kv_persoon_id) VALUES (?,?,?,?,?)',[locatie_id,week,periodeIdToUse,typeVal,kv_persoon_id||null]);
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
    const{week,type,kv_persoon_id}=req.body;
    const old=get('SELECT k.*,l.name as loc_naam FROM kampmomenten k LEFT JOIN locaties l ON l.id=k.locatie_id WHERE k.id=?',[req.params.id]);
    if(week!==undefined) updateMetLog(req,'UPDATE kampmomenten SET week=? WHERE id=?',[week,req.params.id]);
    if(type!==undefined && (type==='kamp'||type==='themadag')) updateMetLog(req,'UPDATE kampmomenten SET type=? WHERE id=?',[type,req.params.id]);
    // S3.4: KV-koppeling is persoonsgebonden (ontwerpbeslissing 1) — wijzigt de gekoppelde
    // persoon, dan is een eerder uitgegeven link niet meer geldig voor de juiste naam:
    // bestaand kv_token wissen zodat een volgende link-aanvraag een verse token genereert.
    if(kv_persoon_id!==undefined && kv_persoon_id!==old?.kv_persoon_id){
      updateMetLog(req,'UPDATE kampmomenten SET kv_persoon_id=?,kv_token=? WHERE id=?',[kv_persoon_id||null,'',req.params.id]);
      if(old) logAct('kampmoment','kv-koppeling',`${old.loc_naam||'?'} week ${old.week}: KV-koppeling gewijzigd`,old.locatie_id,old.loc_naam);
    }
    if(old && week!==undefined && week!==old.week) logAct('kampmoment','verplaatst',`${old.loc_naam||'?'}: week ${old.week} → week ${week}`,old.locatie_id,old.loc_naam);
    if(old && type!==undefined && type!==(old.type||'kamp')) logAct('kampmoment','bewerkt',`${old.loc_naam||'?'} week ${old.week}: ${old.type||'kamp'} → ${type}`,old.locatie_id,old.loc_naam);
    res.json(getKampmoment(req.params.id));
  });
  // S3.4: KV-link genereren (persoonsgebonden — zonder gekoppelde KV geen link mogelijk)
  app.post('/api/kampmomenten/:id/kv-token',(req,res)=>{
    const km=get('SELECT * FROM kampmomenten WHERE id=?',[req.params.id]);
    if(!km)return res.status(404).json({error:'Kampmoment niet gevonden'});
    if(!km.kv_persoon_id)return res.status(400).json({error:'Koppel eerst een kampverantwoordelijke aan dit kampmoment.'});
    let tok=km.kv_token;
    if(!tok){tok=_genToken(12);updateMetLog(req,'UPDATE kampmomenten SET kv_token=? WHERE id=?',[tok,req.params.id]); }
    res.json({token:tok,url:'/kv/'+tok});
  });

  app.delete('/api/kampmomenten/:id',(req,res)=>{
    const old=get('SELECT k.*,l.name as loc_naam FROM kampmomenten k LEFT JOIN locaties l ON l.id=k.locatie_id WHERE k.id=?',[req.params.id]);
    run('DELETE FROM kampmoment_themas WHERE kampmoment_id=?',[req.params.id]);
    delMetLog(req,'DELETE FROM transport_taken WHERE kampmoment_id=?',[req.params.id]);
    delMetLog(req,'DELETE FROM kampmomenten WHERE id=?',[req.params.id]);
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

};
