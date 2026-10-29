// routes/personeel-overzicht.js — BH1: Beheer › Personeel (design/mockup-beheer.html) + Beheer › Logboek, op het patroon.
// Lezen: GET /api/personeel-overzicht (lijst + tellers), GET /api/personeel/:id/detail, GET /api/logboek.
// Schrijven (alleen kantoor, alles gelogd in `wijzigingen`): velden, pincode-reset, (de)activeren, rol, uitnodiging.
// Pincode-hash komt NOOIT in een antwoord of in het logboek: personeel-rijen worden vóór het loggen gemaskeerd
// (pincode → '[gezet]' of ''), en het logboek maskeert oud/nieuw nog eens bij het lezen (ook voor oude regels).
// Data en weergave gescheiden (MOBIEL-REGEL): de pagina's /personeel en /logboek tekenen enkel wat deze API geeft.
'use strict';
module.exports = function(ctx){
  const {app,get,all,run,logWijziging,alleenKantoor,path,ROOT_DIR} = ctx;
  const vergeet = (id)=>{ if(typeof ctx.vergeetSessiesVan==='function') ctx.vergeetSessiesVan(id); };

  const ROLLEN=['kantoor','chauffeur','coordinator','monitor'];
  const ROL_TEKST={kantoor:'kantoor',chauffeur:'chauffeur',coordinator:'coördinator',monitor:'monitor',kv:'kv'};
  // Eén tabel: wat elke rol mag (getoond in het detail onder "Gegevens & rechten").
  const RECHTEN={
    kantoor:['alles beheren','planning','transport','materiaal','nakijken','personeel & logboek'],
    chauffeur:['eigen ritten rijden','laden en lossen afvinken','problemen melden','stockage bekijken'],
    coordinator:['ritten rijden','stockage','tellen','meldingen'],
    monitor:['eigen kamp bekijken','meldingen doen'],
    kv:['tellen via de kv-link','aanvragen doen via de kv-link'],
  };
  const TABEL_TEKST={personeel:'personeel',bakken:'bakken',transport_taken:'taken',transport_ritten:'ritten',aanvragen:'aanvragen',
    kampmomenten:'kampmomenten',nakijk_regels:'tellingen',nakijk_sessies:'tellingen',verhuis_checks:'laden/lossen',activiteiten_log:'activiteit'};
  const ACTIE_TEKST={insert:'aangemaakt',update:'gewijzigd',delete:'verwijderd'};
  const VELD_TEKST={naam:'naam',rol:'rol',telefoon:'telefoon',email:'e-mail',notities:'notities',pincode:'pincode',actief:'stand',
    rijbewijs:'rijbewijs',eigen_wagen_capaciteit:'eigen wagen',meldingen_aan:'meldingen',uitnodiging_op:'uitnodiging',laatst_actief:'laatst actief',pincode_gewijzigd_op:'pincode'};

  const DAG=['zo','ma','di','wo','do','vr','za'], MND=['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
  const p2=n=>String(n).padStart(2,'0');
  // now() ("29/10/2026, 16:54") of ISO → Date
  function alsDatum(s){
    if(!s)return null;let m=/(\d{1,2})\/(\d{1,2})\/(\d{4})\D+(\d{1,2}):(\d{2})/.exec(s);
    if(m)return new Date(+m[3],+m[2]-1,+m[1],+m[4],+m[5]);
    const d=new Date(s);return isNaN(d)?null:d;
  }
  const dagSleutel=d=>`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
  // "vandaag 09:12" / "gisteren" / "ma" (deze week) / "12 okt" / "—"
  function laatstTekst(s,nu=new Date()){
    const d=alsDatum(s);if(!d)return '—';
    const vd=new Date(nu.getFullYear(),nu.getMonth(),nu.getDate()), dd=new Date(d.getFullYear(),d.getMonth(),d.getDate());
    const dagen=Math.round((vd-dd)/864e5);
    if(dagen<=0)return `vandaag ${p2(d.getHours())}:${p2(d.getMinutes())}`;
    if(dagen===1)return 'gisteren';
    if(dagen<7)return DAG[d.getDay()];
    return `${d.getDate()} ${MND[d.getMonth()]}`;
  }
  function tijdTekst(s,nu=new Date()){
    const d=alsDatum(s);if(!d)return s||'';
    const hm=`${p2(d.getHours())}:${p2(d.getMinutes())}`;
    if(dagSleutel(d)===dagSleutel(nu))return 'vandaag '+hm;
    return `${DAG[d.getDay()]} ${d.getDate()} ${MND[d.getMonth()]} ${hm}`;
  }
  const isoNu=()=>new Date().toISOString();
  const stand=p=>p.actief===0?'inactief':(p.pincode?'actief':'geen_pincode');
  // Pincode-hash nooit doorgeven: vervangen door een masker.
  function maskeer(r){ if(!r||typeof r!=='object'||!('pincode' in r))return r; return {...r,pincode:r.pincode?'[gezet]':''}; }
  const persoon=id=>get('SELECT * FROM personeel WHERE id=?',[id]);

  // Gelogde update op personeel met gemaskeerde rijen (updateMetLog zou de volledige rij met hash loggen).
  function updatePersoon(req,id,velden,context){
    const oud=persoon(id);if(!oud)return null;
    const k=Object.keys(velden);if(!k.length)return oud;
    run(`UPDATE personeel SET ${k.map(c=>c+'=?').join(',')} WHERE id=?`,[...k.map(c=>velden[c]),id]);
    const nieuw=persoon(id);
    logWijziging(req,'personeel',+id,'update',maskeer(oud),maskeer(nieuw),context);
    return nieuw;
  }

  // ── lijst ──
  function overzicht(){
    const ps=all('SELECT * FROM personeel ORDER BY CASE rol WHEN \'kantoor\' THEN 1 WHEN \'chauffeur\' THEN 2 WHEN \'coordinator\' THEN 3 WHEN \'monitor\' THEN 4 ELSE 5 END,naam');
    const nu=new Date();
    const tellers={alle:ps.length,kantoor:0,chauffeur:0,coordinator:0,monitor:0,zonder_pincode:0};
    ps.forEach(p=>{ if(p.rol in tellers&&p.rol!=='alle')tellers[p.rol]++; if(!p.pincode&&p.actief!==0)tellers.zonder_pincode++; });
    return {tellers,personeel:ps.map(p=>({id:p.id,naam:p.naam,rol:p.rol,rol_tekst:ROL_TEKST[p.rol]||p.rol,telefoon:p.telefoon||'',
      laatst_actief:p.laatst_actief||'',laatst_actief_tekst:laatstTekst(p.laatst_actief,nu),stand:stand(p),uitnodiging_op:p.uitnodiging_op||''}))};
  }
  app.get('/api/personeel-overzicht',alleenKantoor,(req,res)=>res.json(overzicht()));

  // ── logboek (gedeeld door detail en /api/logboek) ──
  const parse=s=>{ if(s==null)return null; try{return JSON.parse(s);}catch(e){return s;} };
  function watTekst(w,oud,nieuw){
    const t=TABEL_TEKST[w.tabel]||w.tabel, naam=(nieuw&&(nieuw.naam||nieuw.code||nieuw.label))||(oud&&(oud.naam||oud.code||oud.label))||'';
    let s=`${t}${w.rij_id!=null?' #'+w.rij_id:''}${naam?' ('+naam+')':''} ${ACTIE_TEKST[w.actie]||w.actie}`;
    if(w.actie==='update'&&oud&&nieuw&&typeof oud==='object'){
      const v=Object.keys(nieuw).filter(k=>JSON.stringify(oud[k])!==JSON.stringify(nieuw[k]));
      if(v.length)s+=': '+v.map(k=>VELD_TEKST[k]||k.replace(/_/g,' ')).join(', ');
    }
    return s;
  }
  function wRij(w,nu){
    const oud=maskeer(parse(w.oud)),nieuw=maskeer(parse(w.nieuw));
    return {id:'w'+w.id,bron:'wijzigingen',wijziging_id:w.id,tijdstip:w.tijdstip,tijd_tekst:tijdTekst(w.tijdstip,nu),wie:w.persoon_naam||(w.context==='systeem'?'systeem':'—'),
      persoon_id:w.persoon_id,wat:watTekst(w,oud,nieuw),actie:w.actie,tabel:w.tabel,tabel_tekst:TABEL_TEKST[w.tabel]||w.tabel,rij_id:w.rij_id,context:w.context||'',
      oud,nieuw,terugdraaibaar:(w.actie==='update'||w.actie==='delete')&&w.rij_id!=null&&!!w.tabel,terug_route:null};
  }
  function aRij(a,nu){
    const d=alsDatum(a.tijdstip);
    return {id:'a'+a.id,bron:'activiteiten_log',wijziging_id:null,tijdstip:d?d.toISOString():a.tijdstip,tijd_tekst:tijdTekst(a.tijdstip,nu),wie:'—',persoon_id:null,
      wat:a.beschrijving,actie:a.actie,tabel:'activiteiten_log',tabel_tekst:'activiteit',rij_id:null,context:[a.type,a.locatie_naam].filter(Boolean).join(' · '),
      oud:null,nieuw:null,terugdraaibaar:false,terug_route:null};
  }
  function logboek({van,tot,wie,tabel,zoek,max=500}={}){
    const nu=new Date();
    const wieP=wie?persoon(+wie):null;
    const wc=[],wp=[];
    if(wie){wc.push("(persoon_id=? OR (tabel='personeel' AND rij_id=?))");wp.push(+wie,+wie);}
    if(tabel&&tabel!=='activiteiten_log'){wc.push('tabel=?');wp.push(String(tabel));}
    let rijen=[];
    if(tabel!=='activiteiten_log')
      rijen=all(`SELECT * FROM wijzigingen${wc.length?' WHERE '+wc.join(' AND '):''} ORDER BY id DESC LIMIT 5000`,wp).map(w=>wRij(w,nu));
    if(!tabel||tabel==='activiteiten_log'){
      if(!wie||wieP){
        const ac=wieP?all('SELECT * FROM activiteiten_log WHERE beschrijving LIKE ? ORDER BY id DESC LIMIT 2000',['%'+wieP.naam+'%'])
          :all('SELECT * FROM activiteiten_log ORDER BY id DESC LIMIT 2000');
        rijen=rijen.concat(ac.map(a=>aRij(a,nu)));
      }
    }
    const dag=r=>{const d=alsDatum(r.tijdstip);return d?dagSleutel(d):'';};
    if(van)rijen=rijen.filter(r=>dag(r)>=van);
    if(tot)rijen=rijen.filter(r=>dag(r)<=tot);
    if(zoek){const z=String(zoek).toLowerCase();rijen=rijen.filter(r=>[r.wat,r.wie,r.context,r.tabel_tekst,JSON.stringify(r.oud||''),JSON.stringify(r.nieuw||'')].join(' ').toLowerCase().includes(z));}
    rijen.sort((a,b)=>(b.tijdstip||'').localeCompare(a.tijdstip||''));
    return rijen.slice(0,max);
  }
  app.get('/api/logboek',alleenKantoor,(req,res)=>{
    const {van,tot,wie,tabel,zoek}=req.query;
    const regels=logboek({van,tot,wie,tabel,zoek});
    const tabellen=all('SELECT DISTINCT tabel FROM wijzigingen WHERE tabel IS NOT NULL ORDER BY tabel').map(r=>({tabel:r.tabel,tekst:TABEL_TEKST[r.tabel]||r.tabel}));
    tabellen.push({tabel:'activiteiten_log',tekst:'activiteit'});
    const personen=all('SELECT id,naam FROM personeel ORDER BY naam');
    res.json({regels,aantal:regels.length,max:500,tabellen,personen,terugdraaien_beschikbaar:false});
  });

  // ── detail ──
  function inzet(p){
    const per=get('SELECT * FROM vakantieperiodes WHERE actief=1')||get('SELECT * FROM vakantieperiodes ORDER BY id DESC LIMIT 1');
    const uit=[];
    if(per){
      all(`SELECT km.id,km.week,l.name AS locatie,(SELECT GROUP_CONCAT(DISTINCT t.name) FROM kampmoment_themas kt JOIN themas t ON t.id=kt.thema_id WHERE kt.kampmoment_id=km.id) AS thema
        FROM kampmomenten km LEFT JOIN locaties l ON l.id=km.locatie_id WHERE km.kv_persoon_id=? AND km.periode_id=? ORDER BY km.week`,[p.id,per.id]).forEach(k=>{
        let tel='';try{const s=get('SELECT kv_status FROM nakijk_sessies WHERE kampmoment_id=? ORDER BY id DESC',[k.id]);if(s)tel=s.kv_status==='open'?'telling open':'telling ingediend';}catch(e){}
        uit.push({soort:'kv',id:k.id,titel:`KV ${k.locatie||'—'} · wk ${k.week}`,sub:[k.thema,tel].filter(Boolean).join(' · ')||'kampverantwoordelijke',link:`/kampmomenten?id=${k.id}`});
      });
      all(`SELECT * FROM transport_ritten WHERE personeel_id=? AND datum>=? AND datum<=? ORDER BY datum,id`,[p.id,per.start_datum,per.eind_datum]).forEach(r=>{
        const d=alsDatum(r.datum);
        const stops=all(`SELECT l.name FROM transport_taken t LEFT JOIN locaties l ON l.id=t.naar_locatie_id WHERE t.rit_id=? ORDER BY t.tijd,t.id`,[r.id]).map(x=>x.name).filter(Boolean);
        const wagen={pool:'',eigen:'eigen wagen',huur:'huurwagen'}[r.voertuig_soort]??'';
        uit.push({soort:'rit',id:r.id,titel:[`Rit #${r.id}`,d?`${DAG[d.getDay()]} ${d.getDate()} ${MND[d.getMonth()]}`:'',wagen||r.voertuig||''].filter(Boolean).join(' · '),
          sub:[`${ROL_TEKST[r.bestuurder_rol]||r.bestuurder_rol||'chauffeur'} rijdt`,stops.length?stops.join(' → '):''].filter(Boolean).join(' · '),link:`/ritplanning?week=${r.datum}&rit=${r.id}`});
      });
      const per0=per.start_datum, per1=per.eind_datum+'T99';
      const aanv={};
      all("SELECT aangevuld_op FROM nakijk_regels WHERE aangevuld_door=? AND aangevuld_op<>''",[p.naam]).forEach(r=>{
        const k=String(r.aangevuld_op).slice(0,10);if(k>=per0&&k<=per1)aanv[k]=(aanv[k]||0)+1;});
      Object.keys(aanv).sort().forEach(k=>{const d=alsDatum(k);
        uit.push({soort:'aanvullen',id:null,titel:`Aanvullen Rozenweg · ${DAG[d.getDay()]} ${d.getDate()} ${MND[d.getMonth()]}`,sub:`${aanv[k]} handeling${aanv[k]===1?'':'en'} afgevinkt`,link:'/nakijken'});});
    }
    return {periode:per?per.naam:null,inzet:uit};
  }
  app.get('/api/personeel/:id/detail',alleenKantoor,(req,res)=>{
    const p=persoon(req.params.id);if(!p)return res.status(404).json({error:'Persoon niet gevonden'});
    const {periode,inzet:inz}=inzet(p);
    res.json({
      persoon:{id:p.id,naam:p.naam,rol:p.rol,rol_tekst:ROL_TEKST[p.rol]||p.rol,telefoon:p.telefoon||'',email:p.email||'',notities:p.notities||'',
        stand:stand(p),actief:p.actief!==0,laatst_actief:p.laatst_actief||'',laatst_actief_tekst:laatstTekst(p.laatst_actief),uitnodiging_op:p.uitnodiging_op||''},
      rechten:RECHTEN[p.rol]||[],
      pincode:{gezet:!!p.pincode,gewijzigd_op:p.pincode_gewijzigd_op||'',gewijzigd_tekst:p.pincode_gewijzigd_op?tijdTekst(p.pincode_gewijzigd_op):''},
      rijbewijs:p.rijbewijs||'',eigen_wagen_capaciteit:p.eigen_wagen_capaciteit==null?null:p.eigen_wagen_capaciteit,meldingen_aan:p.meldingen_aan!==0,
      periode,inzet:inz,logboek:logboek({wie:p.id,max:50}),
    });
  });

  // ── schrijven ──
  app.put('/api/personeel/:id/velden',alleenKantoor,(req,res)=>{
    const p=persoon(req.params.id);if(!p)return res.status(404).json({error:'Persoon niet gevonden'});
    const b=req.body||{},v={};
    if('naam' in b){if(!String(b.naam||'').trim())return res.status(400).json({error:'Naam mag niet leeg zijn'});v.naam=String(b.naam).trim();}
    ['telefoon','email','rijbewijs','notities'].forEach(k=>{if(k in b)v[k]=String(b[k]==null?'':b[k]).trim();});
    if('eigen_wagen_capaciteit' in b){const n=b.eigen_wagen_capaciteit;if(n===''||n==null)v.eigen_wagen_capaciteit=null;
      else{const x=parseInt(n);if(isNaN(x)||x<0||x>99)return res.status(400).json({error:'Eigen wagen: geef een aantal bakken tussen 0 en 99'});v.eigen_wagen_capaciteit=x;}}
    if('meldingen_aan' in b)v.meldingen_aan=b.meldingen_aan?1:0;
    updatePersoon(req,p.id,v,'beheer: gegevens');
    res.json({ok:true});
  });
  app.post('/api/personeel/:id/pincode-reset',alleenKantoor,(req,res)=>{
    const p=persoon(req.params.id);if(!p)return res.status(404).json({error:'Persoon niet gevonden'});
    updatePersoon(req,p.id,{pincode:null,pincode_gewijzigd_op:isoNu()},'beheer: pincode gewist');
    run('DELETE FROM sessies WHERE persoon_id=?',[p.id]);vergeet(p.id);
    res.json({ok:true});
  });
  app.post('/api/personeel/:id/deactiveer',alleenKantoor,(req,res)=>{
    const p=persoon(req.params.id);if(!p)return res.status(404).json({error:'Persoon niet gevonden'});
    if(req.persoon&&String(req.persoon.persoon_id)===String(p.id))return res.status(400).json({error:'Je kan jezelf niet deactiveren'});
    updatePersoon(req,p.id,{actief:0},'beheer: gedeactiveerd');
    run('DELETE FROM sessies WHERE persoon_id=?',[p.id]);vergeet(p.id);
    res.json({ok:true});
  });
  app.post('/api/personeel/:id/activeer',alleenKantoor,(req,res)=>{
    const p=persoon(req.params.id);if(!p)return res.status(404).json({error:'Persoon niet gevonden'});
    updatePersoon(req,p.id,{actief:1},'beheer: geactiveerd');
    res.json({ok:true});
  });
  app.put('/api/personeel/:id/rol',alleenKantoor,(req,res)=>{
    const p=persoon(req.params.id);if(!p)return res.status(404).json({error:'Persoon niet gevonden'});
    const rol=String((req.body||{}).rol||'');
    if(!ROLLEN.includes(rol))return res.status(400).json({error:'Kies een rol: kantoor, chauffeur, coördinator of monitor'});
    if(req.persoon&&String(req.persoon.persoon_id)===String(p.id)&&rol!=='kantoor')return res.status(400).json({error:'Je kan je eigen kantoorrol niet afnemen'});
    updatePersoon(req,p.id,{rol},'beheer: rol');
    vergeet(p.id);
    res.json({ok:true});
  });
  app.post('/api/personeel/uitnodiging',alleenKantoor,(req,res)=>{
    const ids=Array.isArray((req.body||{}).ids)?req.body.ids.map(Number).filter(Boolean):[];
    if(!ids.length)return res.status(400).json({error:'Kies minstens één persoon'});
    const adres=`${req.protocol}://${req.get('host')}/`, op=isoNu(), personen=[];
    ids.forEach(id=>{
      const p=persoon(id);if(!p)return;
      updatePersoon(req,id,{uitnodiging_op:op},'beheer: uitnodiging');
      personen.push({id:p.id,naam:p.naam,rol:p.rol,telefoon:p.telefoon||'',
        instructie:`Dag ${p.naam}, je kan inloggen in de Sporty-app op ${adres} . Kies daar je naam en kies je pincode bij de eerste keer.`});
    });
    res.json({ok:true,app_adres:adres,uitnodiging_op:op,personen});
  });

  // ── pagina's (zelfde aanpak als /bakken: Basic-muur ervoor, de pagina-js vraagt het token en stuurt zonder login terug) ──
  app.get('/personeel',(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','personeel.html')));
  app.get('/logboek',(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','logboek.html')));

};
