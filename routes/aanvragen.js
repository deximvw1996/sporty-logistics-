// routes/aanvragen.js — uit server.js geknipt (F1 deel 1). Gedrag ongewijzigd.
// Kopjes: S3.3 AANVRAGEN
'use strict';
module.exports = function(ctx){
  const fotos=require('../lib/fotos')(ctx.UPLOADS_DIR); // V3c
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
    let f={pad:'',url:''};
    if(foto_data){try{f=fotos.verwerkWaarde(foto_data,'','aanvraag');}catch(e){return res.status(e.status||500).json({error:e.status?e.message:'Foto opslaan mislukt'});}}
    const id=insMetLog(req,'INSERT INTO aanvragen (kampmoment_id,persoon_id,soort,tekst,foto_data,foto_path,status,created_at) VALUES (?,?,?,?,?,?,?,?)',
      [kampmoment_id||null,persoon_id||null,soort||'materiaal',tekst.trim(),f.url,f.pad,'nieuw',now()]);
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
  // CH1 punt 4: chauffeur meldt een probleem bij een stop (rit-link, geen sessie) → aanvraag voor kantoor
  // én zichtbaar in de kv-data van dat kampmoment (meldingen_chauffeur).
  app.post('/api/rit-token/:token/taken/:taakId/probleem',(req,res)=>{
    const rit=get('SELECT * FROM transport_ritten WHERE rit_token=?',[req.params.token]);
    if(!rit)return res.status(403).json({error:'Ongeldig of verlopen token'});
    const taak=get('SELECT * FROM transport_taken WHERE id=?',[req.params.taakId]);
    if(!taak||taak.rit_id!==rit.id)return res.status(403).json({error:'Deze stop hoort niet bij deze rit'});
    const soort=req.body?.soort;
    const soortTekst={gesloten:'locatie gesloten',past_niet_lokaal:'past niet in het lokaal',anders:'ander probleem'}[soort];
    if(!soortTekst)return res.status(400).json({error:"soort moet 'gesloten', 'past_niet_lokaal' of 'anders' zijn"});
    const tekst=(req.body?.tekst||'').toString().trim().slice(0,1000);
    if(soort==='anders'&&!tekst)return res.status(400).json({error:'Beschrijf kort wat er mis is'});
    const locId=taak.type==='ophaling'?(taak.van_locatie_id||taak.naar_locatie_id):(taak.naar_locatie_id||taak.van_locatie_id);
    const loc=locId?get('SELECT name FROM locaties WHERE id=?',[locId]):null;
    let f={pad:'',url:''};
    try{ if(req.body?.foto_data) f=fotos.verwerkWaarde(req.body.foto_data,'','aanvraag'); }
    catch(e){ return res.status(e.status||400).json({error:e.message||'Foto kon niet bewaard worden'}); }
    const volledig=`Chauffeur ${rit.chauffeur||'?'} bij ${loc?loc.name:'?'}: ${soortTekst}${tekst?' — '+tekst:''}`;
    const id=insMetLog(req,'INSERT INTO aanvragen (kampmoment_id,persoon_id,soort,tekst,foto_data,foto_path,status,created_at) VALUES (?,?,?,?,?,?,?,?)',
      [taak.kampmoment_id||null,rit.personeel_id||null,'probleem_chauffeur',volledig,f.url,f.pad,'nieuw',now()],'rit-link');
    logAct('aanvraag','aangemaakt',`⚠️ ${volledig}`,locId,loc?loc.name:null);
    if(ctx.melding)ctx.melding(req,{voor_rol:'kantoor',van_naam:rit.chauffeur||'Chauffeur',tekst:volledig,link:'/vandaag?tab=beslissen'}); // ME1
    res.json(get('SELECT * FROM aanvragen WHERE id=?',[id]));
  });
  // ── TF6 (T2-G7, besluit Maxim): een goedgekeurde materiaalaanvraag van een KV wordt echt werk ──
  // Voorraad genoeg → handeling op de aanvullijst (uit voorraad); te weinig → Tekorten (bestellen), en na "binnen" op de aanvullijst.
  // In beide gevallen een transporttaak Rozenweg → locatie van de KV. Artikel: kantoor kiest (item_type_id/artikel in de body) of het wordt
  // uit de tekst van de KV herkend; lukt dat niet, dan is er wel een taak en een vraag aan kantoor (Tekorten › "Aanvragen zonder artikel").
  const _zh=require('../lib/tijd').zonderHaakjes;
  const _nrm=s=>_zh(String(s||'')).toLowerCase().replace(/\s+/g,' ').trim();
  const _isoNu=()=>{const d=new Date();const z=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())+' '+z(d.getHours())+':'+z(d.getMinutes());};
  const _markeer=a=>'aanvraag #'+a.id+' van KV';
  function _artikelVan(a,body){
    if(body&&body.item_type_id){const t=get('SELECT * FROM item_types WHERE id=?',[body.item_type_id]);if(t)return t;}
    const naam=String(body&&body.artikel||'').trim()||String(a.tekst||'').replace(/^\s*\d+\s*[×x]\s*/i,'').trim();
    const k=_nrm(naam);if(!k)return null;
    const types=all('SELECT * FROM item_types');
    const exact=types.find(t=>_nrm(t.naam)===k);
    if(exact)return exact;
    const bevat=k.length>=5?types.filter(t=>_nrm(t.naam).includes(k)):[]; // alleen als het er precies één is, anders kiest kantoor
    return bevat.length===1?bevat[0]:null;
  }
  const _aantalVan=(a,body)=>{const n=parseInt(body&&body.aantal);if(n>0)return n;const m=/^\s*(\d{1,4})\s*[×x]/i.exec(a.tekst||'');return m&&parseInt(m[1])>0?parseInt(m[1]):1;};
  function _voorraad(typeId){
    return all("SELECT s.qty FROM item_type_stock s JOIN locaties l ON l.id=s.locatie_id WHERE s.item_type_id=? AND l.name IN ('Rozenweg','Kantoor') AND (l.parent_id IS NULL OR l.parent_id=0)",[typeId]).reduce((x,r)=>x+(r.qty||0),0);
  }
  // Maakt de nakijk-regel (kantoor-sessie, al nagekeken) die Tekorten en de aanvullijst voeden. Geeft {regel_id,actie} of null als er al een is.
  function _aanvraagRegel(req,a,t,aantal){
    if(get('SELECT id FROM nakijk_regels WHERE kantoor_notitie LIKE ?',['%'+_markeer(a)+'%']))return null;
    const km=a.kampmoment_id?get('SELECT * FROM kampmomenten WHERE id=?',[a.kampmoment_id]):null;
    const actie=_voorraad(t.id)>=aantal?'uit_pool':'bestellen';
    const wie=(req.persoon&&req.persoon.naam)||'kantoor';
    const sid=insMetLog(req,'nakijk_sessies',['bak_type','locatie_id','week','datum','kv_wie','kv_tijdstip','kv_status','kantoor_wie','kantoor_tijdstip','kantoor_status','kantoor_afgerond_op','kantoor_door','kampmoment_id','notities'],
      ['melding',km?km.locatie_id:null,km?km.week:null,isoDate(new Date()),(km&&_kvNaam(km))||wie,now(),'ingediend',wie,now(),'nagekeken',_isoNu(),wie,km?km.id:null,'aanvraag'],'aanvraag goedgekeurd'); // TF8 G15: de KV is wie het vroeg, kantoor wie het goedkeurde
    const rid=insMetLog(req,'nakijk_regels',['sessie_id','item_naam','item_id','verwacht','aangetroffen','ontbreekt','notitie','kantoor_actie','kantoor_aantal','kantoor_notitie','tekort_status'],
      [sid,t.naam,null,aantal,0,aantal,'aangevraagd door de KV','uit_pool'===actie?'uit_pool':'bestellen',aantal,'gevraagd door KV · '+_markeer(a),'open'],'aanvraag goedgekeurd');
    return {regel_id:rid,actie};
  }
  function _aanvraagTaak(req,a,naam,aantal){
    const km=a.kampmoment_id?get('SELECT * FROM kampmomenten WHERE id=?',[a.kampmoment_id]):null;
    if(!km)return null;
    const datum=_spoedDatum(km,new Date()),ts=now();
    const taakId=insMetLog(req,'INSERT INTO transport_taken (type,datum,tijd,van_locatie_id,naar_locatie_id,opmerking,wie,status,created_at,spoed_kind,spoed_ref_id,spoed_effect_toegepast,kampmoment_id,aanvraag_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      ['extra',datum,'09:00',_rozenwegId(),km.locatie_id,'📩 Aanvraag #'+a.id+': '+naam,'','gepland',ts,'',0,0,km.id,a.id],'aanvraag goedgekeurd');
    ins('INSERT INTO transport_regels (taak_id,naam,qty,soort,item_type_id) VALUES (?,?,?,?,?)',[taakId,naam,aantal,'spoed',resolveItemTypeId(naam,undefined,false)]);
    return taakId;
  }
  // Zonder artikel: een vraag aan kantoor + (na koppelen) dezelfde regel als hierboven.
  app.get('/api/aanvragen/zonder-artikel',(req,res)=>{
    const rij=all("SELECT a.*,l.name AS km_locatie FROM aanvragen a LEFT JOIN kampmomenten km ON km.id=a.kampmoment_id LEFT JOIN locaties l ON l.id=km.locatie_id WHERE a.status='goedgekeurd' AND a.soort='materiaal' AND a.kampmoment_id IS NOT NULL ORDER BY a.id DESC")
      .filter(a=>a.reden==='Goedgekeurd — kantoor regelt het stuk en de levering.'&&!get('SELECT id FROM nakijk_regels WHERE kantoor_notitie LIKE ?',['%'+_markeer(a)+'%']));
    res.json(rij.map(a=>({id:a.id,tekst:a.tekst,locatie:a.km_locatie||'',created_at:a.created_at})));
  });
  app.put('/api/aanvragen/:id/artikel',(req,res)=>{
    if(!req.persoon||req.persoon.rol!=='kantoor')return res.status(403).json({error:'Alleen kantoor kiest het artikel.'});
    const a=get('SELECT * FROM aanvragen WHERE id=?',[req.params.id]);
    if(!a)return res.status(404).json({error:'Aanvraag niet gevonden'});
    if(a.status!=='goedgekeurd')return res.status(409).json({error:'Deze aanvraag is niet goedgekeurd.'});
    const t=_artikelVan(a,req.body||{});
    if(!t)return res.status(400).json({error:'Kies een artikel uit de catalogus.'});
    const r=_aanvraagRegel(req,a,t,_aantalVan(a,req.body||{}));
    if(!r)return res.status(409).json({error:'Voor deze aanvraag staat al een handeling klaar.'});
    logAct('aanvraag','artikel gekozen','Aanvraag #'+a.id+' → '+t.naam+' ('+(r.actie==='uit_pool'?'uit voorraad':'te bestellen')+')',null,null);
    res.json({ok:true,...r,artikel:t.naam});
  });

  app.put('/api/aanvragen/:id/status',(req,res)=>{
    const{status,reden,maak_spoedtransport,spoedtransport}=req.body;
    const a=get('SELECT * FROM aanvragen WHERE id=?',[req.params.id]);
    if(!a)return res.status(404).json({error:'Aanvraag niet gevonden'});
    if(!['nieuw','goedgekeurd','afgewezen','afgehandeld'].includes(status))return res.status(400).json({error:'Ongeldige status'});
    const behandeld_door=(req.persoon&&req.persoon.naam)||'';
    let spoed_taak_id=a.spoed_taak_id,rit_zonder_chauffeur=false;
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
      ins('INSERT INTO transport_regels (taak_id,naam,qty,soort,item_type_id) VALUES (?,?,?,?,?)',[taakId,naam,aantal,'spoed',resolveItemTypeId(naam,undefined,false)]);
      spoed_taak_id=taakId;
      // RP2 (rest TF1): zonder bestuurder in de body → rit zonder chauffeur; het antwoord zegt het (Vandaag/ritplanning waarschuwen).
      const pid=st.personeel_id||null,ch=st.chauffeur||(pid?(get('SELECT naam FROM personeel WHERE id=?',[pid])||{}).naam:'')||'';
      if(ch||pid)updateMetLog(req,'UPDATE transport_ritten SET chauffeur=?,personeel_id=?,voertuig=? WHERE id=?',[ch,pid,st.voertuig||'',ritId]);
      else {rit_zonder_chauffeur=true;logAct('transport','spoedrit zonder chauffeur',`Spoedrit #${ritId} (${spoedDatum}) heeft nog geen chauffeur — kies er een in de Ritplanning`,null,null);}
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
    // TF6: goedkeuren van een materiaalaanvraag maakt echt werk (zie boven).
    let redenNieuw=reden||'',_onbekend=false; // TF9: één melding per beslissing
    if(status==='goedgekeurd'&&a.status!=='goedgekeurd'&&a.soort==='materiaal'&&a.kampmoment_id){
      const b=req.body||{},t=_artikelVan(a,b),aantal=_aantalVan(a,b);
      const naam=t?t.naam:String(b.artikel||a.tekst||'').replace(/^\s*\d+\s*[×x]\s*/i,'').trim();
      let r=null;
      if(t)r=_aanvraagRegel(req,a,t,aantal);
      if(!spoed_taak_id){spoed_taak_id=_aanvraagTaak(req,a,naam,aantal)||null;}
      if(!redenNieuw)redenNieuw=!t?'Goedgekeurd — kantoor regelt het stuk en de levering.':(r&&r.actie==='bestellen'?'Goedgekeurd — het stuk wordt besteld en daarna geleverd.':'Goedgekeurd — het stuk komt uit voorraad en wordt geleverd.');
      if(!t)_onbekend=true;
      if(!t&&ctx.melding)ctx.melding(req,{voor_rol:'kantoor',van_naam:behandeld_door||'Kantoor',tekst:'Aanvraag "'+a.tekst+'" is goedgekeurd, maar het artikel is onbekend. Kies het in Tekorten onder "Aanvragen zonder artikel".',link:'/tekorten'});
      logAct('aanvraag','goedgekeurd','Aanvraag #'+a.id+' goedgekeurd → '+(t?naam+' ('+(r?(r.actie==='uit_pool'?'uit voorraad':'te bestellen'):'al klaar')+')':'artikel nog te kiezen')+(spoed_taak_id?' · transporttaak #'+spoed_taak_id:' · geen transporttaak (geen kampmoment)'),null,null);
    }
    // ME1: een beslissing op een aanvraag gaat naar kantoor (de KV heeft geen account); niet voor chauffeursmeldingen.
    if(ctx.melding&&!_onbekend&&(status==='goedgekeurd'||status==='afgewezen')&&a.status!==status&&a.soort!=='probleem_chauffeur')ctx.melding(req,{voor_rol:'kantoor',van_naam:behandeld_door||'Kantoor',tekst:`Aanvraag "${a.tekst}" ${status}`,link:'/vandaag'});
    updateMetLog(req,'UPDATE aanvragen SET status=?,reden=?,spoed_taak_id=?,behandeld_door=?,behandeld_op=? WHERE id=?',
      [status,redenNieuw,spoed_taak_id||null,behandeld_door,now(),req.params.id]);
    logAct('aanvraag',status,`Aanvraag #${a.id} → ${status}`+(reden?` (${reden})`:''),null,null);
    res.json({...get('SELECT * FROM aanvragen WHERE id=?',[req.params.id]),...(rit_zonder_chauffeur?{rit_zonder_chauffeur:true}:{})});
  });

};
