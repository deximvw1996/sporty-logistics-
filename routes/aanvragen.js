// routes/aanvragen.js — uit server.js geknipt (F1 deel 1). Gedrag ongewijzigd.
// Kopjes: S3.3 AANVRAGEN
'use strict';
module.exports = function(ctx){
  const {app,db,get,all,run,ins,saveDb,backupDb,now,isoDate,_genToken,resolveItemTypeId,logAct,logWijziging,insMetLog,updateMetLog,delMetLog,vereisRol,alleenKantoor,hashPin,checkSessie,_actieveLocatieConfig,_kvVerwacht,_kvKampmoment,_kvNaam,_bakItems,effectiefMateriaal,ensureGedeeldStock,DATA_DIR,DB_PATH,UPLOADS_DIR,BUNDELS_DIR,FRONTEND_PATH,ROOT_DIR,APP_PASSWORD,PORT,path,fs,express,crypto} = ctx;
  // ── S3.3: AANVRAGEN (vervangt de oude losse spoedmeldingen, zie Migratie 55) ──
  // Publiek bereikbaar in principe (komt straks van de KV-link, S3.4/S3.5), maar ligt hier
  // achter de S3.2-auth-poort omdat de KV-link zelf nog niet bestaat in deze taak — kantoor/
  // chauffeur kunnen nu al aanvragen aanmaken en behandelen.
  app.get('/api/aanvragen',(req,res)=>{
    const {status,soort,kampmoment_id}=req.query;
    let sql='SELECT a.*, p.naam AS persoon_naam, km.week AS km_week, l.name AS km_locatie FROM aanvragen a '
      +'LEFT JOIN personeel p ON p.id=a.persoon_id '
      +'LEFT JOIN kampmomenten km ON km.id=a.kampmoment_id '
      +'LEFT JOIN locaties l ON l.id=km.locatie_id WHERE 1=1';
    const params=[];
    if(status){sql+=' AND a.status=?';params.push(status);}
    if(soort){sql+=' AND a.soort=?';params.push(soort);}
    if(kampmoment_id){sql+=' AND a.kampmoment_id=?';params.push(kampmoment_id);}
    sql+=' ORDER BY a.id DESC';
    res.json(all(sql,params));
  });
  app.post('/api/aanvragen',(req,res)=>{
    const{kampmoment_id,persoon_id,soort,tekst,foto_data}=req.body;
    if(!tekst||!tekst.trim())return res.status(400).json({error:'Tekst is verplicht'});
    const id=insMetLog(req,'INSERT INTO aanvragen (kampmoment_id,persoon_id,soort,tekst,foto_data,status,created_at) VALUES (?,?,?,?,?,?,?)',
      [kampmoment_id||null,persoon_id||null,soort||'materiaal',tekst.trim(),foto_data||'','nieuw',now()]);
    logAct('aanvraag','aangemaakt',`📨 Nieuwe aanvraag (${soort||'materiaal'}): ${tekst.trim()}`,null,null);
    res.json(get('SELECT * FROM aanvragen WHERE id=?',[id]));
  });
  app.put('/api/aanvragen/:id/status',(req,res)=>{
    const{status,reden,maak_spoedtransport,spoedtransport}=req.body;
    const a=get('SELECT * FROM aanvragen WHERE id=?',[req.params.id]);
    if(!a)return res.status(404).json({error:'Aanvraag niet gevonden'});
    if(!['nieuw','goedgekeurd','afgewezen','afgehandeld'].includes(status))return res.status(400).json({error:'Ongeldige status'});
    const behandeld_door=(req.persoon&&req.persoon.naam)||'';
    let spoed_taak_id=a.spoed_taak_id;
    if(status==='goedgekeurd'&&maak_spoedtransport&&!spoed_taak_id){
      const st=spoedtransport||{};
      const naam=(st.item||a.tekst||'').trim();
      const aantal=Math.max(1,parseInt(st.qty)||1);
      const ts=now();
      const spoedDatum=st.datum||isoDate(new Date());
      const ritId=insMetLog(req,'INSERT INTO transport_ritten (datum,chauffeur,opmerking,status,created_at) VALUES (?,?,?,?,?)',
        [spoedDatum,'','Spoedtransport (aanvraag #'+a.id+')','gepland',ts]);
      const taakId=insMetLog(req,'INSERT INTO transport_taken (type,datum,tijd,van_locatie_id,naar_locatie_id,opmerking,wie,status,created_at,spoed_kind,spoed_ref_id,spoed_effect_toegepast,rit_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
        ['extra',spoedDatum,st.tijd||'09:00',st.van_locatie_id||null,st.naar_locatie_id||null,'🚨 Spoed (aanvraag #'+a.id+'): '+naam,'','gepland',ts,st.kind||'',st.ref_id||0,0,ritId]);
      ins('INSERT INTO transport_regels (taak_id,naam,qty,soort,item_type_id) VALUES (?,?,?,?,?)',[taakId,naam,aantal,'spoed',resolveItemTypeId(naam)]);
      spoed_taak_id=taakId;
    }
    updateMetLog(req,'UPDATE aanvragen SET status=?,reden=?,spoed_taak_id=?,behandeld_door=?,behandeld_op=? WHERE id=?',
      [status,reden||'',spoed_taak_id||null,behandeld_door,now(),req.params.id]);
    logAct('aanvraag',status,`Aanvraag #${a.id} → ${status}`+(reden?` (${reden})`:''),null,null);
    res.json(get('SELECT * FROM aanvragen WHERE id=?',[req.params.id]));
  });

};
