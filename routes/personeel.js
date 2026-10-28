// routes/personeel.js — uit server.js geknipt (F1 deel 1). Gedrag ongewijzigd.
// Kopjes: PERSONEEL
'use strict';
module.exports = function(ctx){
  const {app,db,get,all,run,ins,saveDb,backupDb,now,isoDate,_genToken,resolveItemTypeId,logAct,logWijziging,insMetLog,updateMetLog,delMetLog,vereisRol,alleenKantoor,hashPin,checkSessie,_actieveLocatieConfig,_kvVerwacht,_kvKampmoment,_kvNaam,_bakItems,effectiefMateriaal,ensureGedeeldStock,DATA_DIR,DB_PATH,UPLOADS_DIR,BUNDELS_DIR,FRONTEND_PATH,ROOT_DIR,APP_PASSWORD,PORT,path,fs,express,crypto} = ctx;
  // ── PERSONEEL ──
  app.get('/api/personeel',(req,res)=>{
    const personen=all('SELECT * FROM personeel ORDER BY rol,naam');
    const shifts=all(`SELECT ps.*, km.week, km.locatie_id, l.name as locatie_naam
      FROM personeel_shifts ps
      LEFT JOIN kampmomenten km ON km.id=ps.kampmoment_id
      LEFT JOIN locaties l ON l.id=COALESCE(ps.locatie_id,km.locatie_id)
      ORDER BY ps.datum,ps.van_uur`);
    // pincode is een hash, maar wordt hier toch nooit meegestuurd — enkel of iemand er al één heeft.
    res.json(personen.map(p=>{const{pincode,...rest}=p;return{...rest,heeft_pincode:!!pincode,shifts:shifts.filter(s=>s.persoon_id===p.id)};}));
  });
  // Veiligheidsronde (DOORLICHTING-c #9): pincode-hash nooit teruggeven, enkel heeft_pincode.
  function _persoonZonderPin(p){ if(!p) return p; const{pincode,...rest}=p; return {...rest,heeft_pincode:!!pincode}; }
  app.post('/api/personeel', alleenKantoor, (req,res)=>{
    const{naam,rol,telefoon,email,notities}=req.body;
    if(!naam?.trim())return res.status(400).json({error:'Naam vereist'});
    const id=ins('INSERT INTO personeel (naam,rol,telefoon,email,notities) VALUES (?,?,?,?,?)',
      [naam.trim(),rol||'kv',telefoon||'',email||'',notities||'']);
    res.json(_persoonZonderPin(get('SELECT * FROM personeel WHERE id=?',[id])));
  });
  app.put('/api/personeel/:id', alleenKantoor, (req,res)=>{
    const{naam,rol,telefoon,email,notities}=req.body;
    run('UPDATE personeel SET naam=?,rol=?,telefoon=?,email=?,notities=? WHERE id=?',
      [naam,rol||'kv',telefoon||'',email||'',notities||'',req.params.id]);
    res.json(_persoonZonderPin(get('SELECT * FROM personeel WHERE id=?',[req.params.id])));
  });
  app.delete('/api/personeel/:id', alleenKantoor, (req,res)=>{run('DELETE FROM personeel WHERE id=?',[req.params.id]);res.json({ok:true});});
  app.post('/api/personeel/:id/shifts',(req,res)=>{
    const{kampmoment_id,locatie_id,datum,van_uur,tot_uur,rol_dag,notities}=req.body;
    const id=ins('INSERT INTO personeel_shifts (persoon_id,kampmoment_id,locatie_id,datum,van_uur,tot_uur,rol_dag,notities) VALUES (?,?,?,?,?,?,?,?)',
      [req.params.id,kampmoment_id||null,locatie_id||null,datum||'',van_uur||'',tot_uur||'',rol_dag||'',notities||'']);
    res.json(get('SELECT * FROM personeel_shifts WHERE id=?',[id]));
  });
  app.put('/api/personeel-shifts/:id',(req,res)=>{
    const{kampmoment_id,locatie_id,datum,van_uur,tot_uur,rol_dag,notities}=req.body;
    run('UPDATE personeel_shifts SET kampmoment_id=?,locatie_id=?,datum=?,van_uur=?,tot_uur=?,rol_dag=?,notities=? WHERE id=?',
      [kampmoment_id||null,locatie_id||null,datum||'',van_uur||'',tot_uur||'',rol_dag||'',notities||'',req.params.id]);
    res.json(get('SELECT * FROM personeel_shifts WHERE id=?',[req.params.id]));
  });
  app.delete('/api/personeel-shifts/:id',(req,res)=>{run('DELETE FROM personeel_shifts WHERE id=?',[req.params.id]);res.json({ok:true});});
  // Wie werkt waar welke week
  app.get('/api/personeel/week/:week',(req,res)=>{
    const week=parseInt(req.params.week);
    const rows=all(`SELECT ps.*, p.naam, p.rol, p.telefoon, l.name as locatie_naam, km.week
      FROM personeel_shifts ps
      JOIN personeel p ON p.id=ps.persoon_id
      LEFT JOIN kampmomenten km ON km.id=ps.kampmoment_id
      LEFT JOIN locaties l ON l.id=COALESCE(ps.locatie_id,km.locatie_id)
      WHERE km.week=? OR ps.datum LIKE ?`,[week,'%-W'+String(week).padStart(2,'0')+'-%']);
    res.json(rows);
  });

};
