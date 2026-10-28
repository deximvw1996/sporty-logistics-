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
  // ── V3a punt 3 (werklijst 11; B-F8): spoedtaak uit een aanvraag krijgt van/naar/datum/aantal ──
  function _rozenwegId(){
    const r=get("SELECT id FROM locaties WHERE type='stockage' AND name LIKE '%Rozenweg%' ORDER BY (parent_id IS NULL) DESC,id LIMIT 1");
    return r?r.id:null;
  }
  function _spoedVan(st,naam){
    if(st.van_locatie_id)return st.van_locatie_id;
    // Thuis-stockage van het gevraagde item: een bak/attribuut met die naam of code (code tussen haakjes of los).
    const code=(naam.match(/\b([A-Z]{1,2}\d{1,3})\b/)||[])[1];
    const b=(code&&get('SELECT thuislocatie_id FROM bakken WHERE UPPER(code)=? AND thuislocatie_id IS NOT NULL',[code]))
      ||get('SELECT thuislocatie_id FROM bakken WHERE LOWER(naam)=LOWER(?) AND thuislocatie_id IS NOT NULL',[naam])
      ||(code&&get('SELECT thuislocatie_id FROM attributen WHERE UPPER(code)=? AND thuislocatie_id IS NOT NULL',[code]));
    return (b&&b.thuislocatie_id)||_rozenwegId();
  }
  function _spoedAantal(st,tekst){
    if(parseInt(st.qty)>0)return parseInt(st.qty);
    const m=(tekst||'').match(/\b(\d{1,4})\b/);
    return m&&parseInt(m[1])>0?parseInt(m[1]):1;
  }
  // Eerstvolgende werkdag (ma-vr) binnen de kampweek, vanaf vandaag; geen zaterdag/zondag.
  // Ligt de kampweek al helemaal achter ons: de eerstvolgende werkdag vanaf vandaag.
  function _spoedDatum(km,vandaag){
    const isWerkdag=d=>d.getDay()!==0&&d.getDay()!==6;
    const p=km?get('SELECT * FROM vakantieperiodes WHERE id=?',[km.periode_id||1]):null;
    const kandidaten=[];
    if(p&&p.start_datum&&km.week){
      const ws=new Date(p.start_datum+'T12:00:00');ws.setDate(ws.getDate()+(km.week-1)*7);
      const eind=p.eind_datum?new Date(p.eind_datum+'T23:59:59'):null;
      for(let i=0;i<7;i++){const d=new Date(ws);d.setDate(ws.getDate()+i);if(eind&&d>eind)continue;if(isWerkdag(d))kandidaten.push(isoDate(d));}
    }
    const vandaagIso=isoDate(vandaag);
    const inWeek=kandidaten.find(d=>d>=vandaagIso);
    if(inWeek)return inWeek;
    const d=new Date(vandaag);d.setHours(12);while(!isWerkdag(d))d.setDate(d.getDate()+1);
    return isoDate(d);
  }
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
      const aantal=_spoedAantal(st,naam);
      const km=a.kampmoment_id?get('SELECT * FROM kampmomenten WHERE id=?',[a.kampmoment_id]):null;
      const van=_spoedVan(st,naam);
      const naar=st.naar_locatie_id||(km&&km.locatie_id)||null;
      const ts=now();
      // Een expliciete datum in de body (ook een weekenddag) wordt gerespecteerd; anders werkdag in de kampweek.
      const spoedDatum=st.datum||_spoedDatum(km,new Date());
      const ritId=insMetLog(req,'INSERT INTO transport_ritten (datum,chauffeur,opmerking,status,created_at) VALUES (?,?,?,?,?)',
        [spoedDatum,'','Spoedtransport (aanvraag #'+a.id+')','gepland',ts]);
      const taakId=insMetLog(req,'INSERT INTO transport_taken (type,datum,tijd,van_locatie_id,naar_locatie_id,opmerking,wie,status,created_at,spoed_kind,spoed_ref_id,spoed_effect_toegepast,rit_id,kampmoment_id,aanvraag_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        ['extra',spoedDatum,st.tijd||'09:00',van,naar,'🚨 Spoed (aanvraag #'+a.id+'): '+naam,'','gepland',ts,st.kind||'',st.ref_id||0,0,ritId,a.kampmoment_id||null,a.id]);
      ins('INSERT INTO transport_regels (taak_id,naam,qty,soort,item_type_id) VALUES (?,?,?,?,?)',[taakId,naam,aantal,'spoed',resolveItemTypeId(naam)]);
      spoed_taak_id=taakId;
    }
    // Afwijzen annuleert de gekoppelde spoedtaak (status 'geannuleerd', spoor blijft bewaard) — tenzij
    // er al iets geladen is of de taak onderweg/afgerond is: dan 409.
    if(status==='afgewezen'&&spoed_taak_id){
      const t=get('SELECT * FROM transport_taken WHERE id=?',[spoed_taak_id]);
      if(t&&t.status!=='geannuleerd'){
        const geladen=get('SELECT COUNT(*) AS n FROM verhuis_checks WHERE taak_id=? AND (geladen=1 OR gelost=1)',[t.id]).n;
        if(geladen||['aangekomen','gedaan'].includes(t.status))
          return res.status(409).json({error:'De spoedlevering voor deze aanvraag is al geladen of onderweg — afwijzen kan niet meer. Bel de chauffeur of zet de taak eerst zelf terug.'});
        updateMetLog(req,"UPDATE transport_taken SET status='geannuleerd' WHERE id=?",[t.id],'aanvraag afgewezen');
        if(t.rit_id){const rest=get("SELECT COUNT(*) AS n FROM transport_taken WHERE rit_id=? AND status<>'geannuleerd'",[t.rit_id]).n;
          if(!rest)updateMetLog(req,"UPDATE transport_ritten SET status='geannuleerd' WHERE id=?",[t.rit_id],'aanvraag afgewezen');}
      }
    }
    updateMetLog(req,'UPDATE aanvragen SET status=?,reden=?,spoed_taak_id=?,behandeld_door=?,behandeld_op=? WHERE id=?',
      [status,reden||'',spoed_taak_id||null,behandeld_door,now(),req.params.id]);
    logAct('aanvraag',status,`Aanvraag #${a.id} → ${status}`+(reden?` (${reden})`:''),null,null);
    res.json(get('SELECT * FROM aanvragen WHERE id=?',[req.params.id]));
  });

};
