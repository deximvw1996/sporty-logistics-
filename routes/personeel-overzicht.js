// routes/personeel-overzicht.js — BH1: Beheer › Personeel + Logboek op het standaardpagina-patroon (design/mockup-beheer.html).
// Lijst en detail van het personeel, beheeracties (velden, rol, pincode-reset, (de)activeren, uitnodiging) en één
// logboek over wijzigingen + activiteiten_log. Alles alleen voor kantoor en gelogd. Data en weergave gescheiden (MOBIEL-REGEL).
'use strict';
module.exports = function(ctx){
  const {kvL}=require('../lib/tijd');
  const {app,get,all,run,logWijziging,logAct,alleenKantoor,vergeetSessiesVan,path,ROOT_DIR} = ctx;
  // Wijziging op personeel: zelf loggen zonder de pincode-hash (updateMetLog zou de volledige rij met hash in wijzigingen zetten).
  const zonderPin=r=>{if(!r)return r;const{pincode,...rest}=r;return {...rest,pincode_gezet:!!pincode};};
  function wijzigPersoon(req,id,v,context){
    const oud=get('SELECT * FROM personeel WHERE id=?',[id]);const k=Object.keys(v);
    run(`UPDATE personeel SET ${k.map(x=>x+'=?').join(',')} WHERE id=?`,[...k.map(x=>v[x]),id]);
    logWijziging(req,'personeel',id,'update',zonderPin(oud),zonderPin(get('SELECT * FROM personeel WHERE id=?',[id])),context);
  }

  const ROLLEN=['kantoor','chauffeur','coordinator','monitor'];
  // Wat elke rol mag (één tabel; de app-schil en dit scherm lezen dezelfde lijst). kv/animator = oude namen.
  const RECHTEN={
    kantoor:['alles beheren: planning, transport, materiaal, personeel','keuren en beslissen (aanvragen, tellingen)','export en back-up'],
    chauffeur:['eigen ritten rijden (laden, lossen, stops wisselen als ze vrij zijn)','problemen melden','lezen (geen beheer)'],
    coordinator:['ritten rijden (eigen of huurwagen)','stockage: aanvullen en klaarzetten','tellen bij ophaling','meldingen lezen en doen'],
    monitor:['enkel het telscherm (monitor-link)'],
    kv:['KV-link: tellen, aanvragen, meldingen (geen login op de app-API)'],
    animator:['geen toegang tot de app (enkel in de planning)']
  };
  const rolGroep=r=>r==='kv'?'coordinator':r==='animator'?'monitor':r;
  const DAG=['zo','ma','di','wo','do','vr','za'],MND=['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const isoNu=()=>{const d=new Date();return `${iso(d)} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;};
  // Alle tijdformaten in de db (ISO met T, "YYYY-MM-DD HH:MM", now() "29/10/2026, 16:54") → Date.
  function alsDatum(s){
    let m=/(\d{1,2})\/(\d{1,2})\/(\d{4})\D+(\d{1,2}):(\d{2})/.exec(s||'');
    if(m)return new Date(+m[3],+m[2]-1,+m[1],+m[4],+m[5]);
    if(/^\d{4}-\d{2}-\d{2}T/.test(s||''))return new Date(s);
    m=/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/.exec(s||'');
    return m?new Date(+m[1],+m[2]-1,+m[3],+(m[4]||0),+(m[5]||0)):null;
  }
  const uur=d=>`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  // "vandaag 09:12" / "gisteren" / "ma" (deze week) / "12 okt" / "—"
  function relatief(s){
    const d=alsDatum(s);if(!d||isNaN(d))return '—';
    const vandaag=new Date();vandaag.setHours(0,0,0,0);const dag=new Date(d);dag.setHours(0,0,0,0);
    const verschil=Math.round((vandaag-dag)/864e5);
    if(verschil===0)return 'vandaag '+uur(d);if(verschil===1)return 'gisteren';
    if(verschil>1&&verschil<7)return DAG[d.getDay()];
    return `${d.getDate()} ${MND[d.getMonth()]}`;
  }
  const tijdTekst=s=>{const d=alsDatum(s);return d&&!isNaN(d)?`${DAG[d.getDay()]} ${d.getDate()} ${MND[d.getMonth()]} ${uur(d)}`:(s||'');};
  const stand=p=>p.actief===0?'inactief':!p.pincode&&['kantoor','chauffeur','coordinator'].includes(p.rol)?'geen_pincode':'actief';

  app.get('/api/personeel-overzicht',alleenKantoor,(req,res)=>{
    const lijst=all('SELECT * FROM personeel ORDER BY COALESCE(actief,1) DESC,rol,naam').map(p=>({id:p.id,naam:p.naam,rol:p.rol,rol_groep:rolGroep(p.rol),telefoon:p.telefoon||'',
      email:p.email||'',laatst_actief_tekst:relatief(p.laatst_actief),stand:stand(p),heeft_pincode:!!p.pincode,uitnodiging_op:p.uitnodiging_op||''}));
    const n=f=>lijst.filter(f).length;
    res.json({tellers:{alle:lijst.length,kantoor:n(p=>p.rol_groep==='kantoor'),chauffeur:n(p=>p.rol_groep==='chauffeur'),coordinator:n(p=>p.rol_groep==='coordinator'),
      monitor:n(p=>p.rol_groep==='monitor'),zonder_pincode:n(p=>p.stand==='geen_pincode')},personeel:lijst});
  });

  // Logregels over één persoon: wat die persoon deed (wijzigingen.persoon_id), wijzigingen op de persoon zelf, en het
  // activiteitenlog dat de naam noemt. Nieuwste eerst.
  function logboekVan(p,max){
    const uit=[];
    all(`SELECT * FROM wijzigingen WHERE persoon_id=? OR (tabel='personeel' AND rij_id=?) ORDER BY id DESC LIMIT ?`,[p.id,p.id,max]).forEach(w=>uit.push(_wRegel(w)));
    all('SELECT * FROM activiteiten_log WHERE beschrijving LIKE ? ORDER BY id DESC LIMIT ?',[`%${p.naam}%`,max]).forEach(a=>uit.push(_aRegel(a)));
    return uit.sort((a,b)=>b.sort-a.sort).slice(0,max).map(({sort,...r})=>r);
  }
  const _parse=s=>{if(s==null)return null;try{return JSON.parse(s);}catch(e){return s;}};
  function _wTekst(w){
    const o=_parse(w.oud)||{},n=_parse(w.nieuw)||{};
    if(w.actie==='insert')return `${w.tabel} #${w.rij_id} aangemaakt`;
    if(w.actie==='delete')return `${w.tabel} #${w.rij_id} verwijderd`;
    const k=Object.keys(n).filter(x=>String(o[x]??'')!==String(n[x]??'')&&x!=='pincode');
    const v=x=>x===null||x===undefined||x===''?'—':x;
    return `${w.tabel} #${w.rij_id}: `+(k.length?k.map(x=>`${x} ${v(o[x])} → ${v(n[x])}`).join(', '):'gewijzigd');
  }
  // Terugdraaien: er bestaat (nog) geen route die één wijziging terugzet (GEVONDEN TR1 #1) → overal false met reden.
  const _wRegel=w=>{const d=alsDatum(w.tijdstip);return {bron:'wijziging',id:'w'+w.id,wijziging_id:w.id,t:w.tijdstip,tijd_tekst:tijdTekst(w.tijdstip),sort:d?+d:0,
    wie:w.persoon_naam||'',wat:_wTekst(w),tabel:w.tabel,actie:w.actie,context:w.context||'',terugdraaibaar:false,reden_niet_terug:'er bestaat nog geen terugdraai-route'};};
  const _aRegel=a=>{const d=alsDatum(a.tijdstip);return {bron:'activiteit',id:'a'+a.id,wijziging_id:null,t:a.tijdstip,tijd_tekst:tijdTekst(a.tijdstip),sort:d?+d:0,
    wie:'',wat:a.beschrijving,tabel:a.type,actie:a.actie,context:a.locatie_naam||'',terugdraaibaar:false,reden_niet_terug:'activiteitenlog (geen oud/nieuw bewaard)'};};

  app.get('/api/personeel/:id/detail',alleenKantoor,(req,res)=>{
    const p=get('SELECT * FROM personeel WHERE id=?',[req.params.id]);
    if(!p)return res.status(404).json({error:'Persoon niet gevonden'});
    const per=get('SELECT * FROM vakantieperiodes WHERE actief=1');
    const inzet=[];
    if(per){
      all('SELECT km.id,km.week,l.name FROM kampmomenten km JOIN locaties l ON l.id=km.locatie_id WHERE km.kv_persoon_id=? AND km.periode_id=? ORDER BY km.week',[p.id,per.id]).forEach(k=>{
        const th=all('SELECT DISTINCT t.name FROM kampmoment_themas kt JOIN themas t ON t.id=kt.thema_id WHERE kt.kampmoment_id=?',[k.id]).map(x=>x.name).join(', ');
        const s=get("SELECT kv_status FROM nakijk_sessies WHERE kampmoment_id=? ORDER BY id DESC",[k.id]);
        inzet.push({soort:'kv',titel:`${kvL(k.name)} · wk ${k.week}`,sub:[th,s?`telling ${s.kv_status}`:'nog niet geteld'].filter(Boolean).join(' · '),link:'/nakijken',kampmoment_id:k.id});
      });
      all(`SELECT * FROM transport_ritten WHERE (personeel_id=? OR (personeel_id IS NULL AND chauffeur<>'' AND chauffeur=?)) AND datum>=? AND datum<=? AND status<>'geannuleerd' ORDER BY datum,id`,
        [p.id,p.naam,iso(new Date(new Date(per.start_datum+'T12:00:00').getTime()-14*864e5)),per.eind_datum]).forEach(r=>{
        const d=alsDatum(r.datum);
        inzet.push({soort:'rit',titel:`Rit #${r.id} · ${d?`${DAG[d.getDay()]} ${d.getDate()} ${MND[d.getMonth()]}`:r.datum}${r.voertuig?' · '+r.voertuig:''}`,
          sub:[r.bestuurder_rol&&r.bestuurder_rol!=='chauffeur'?'coördinator rijdt mee':'chauffeur',r.status].join(' · '),link:`/ritplanning?rit=${r.id}`,rit_id:r.id});
      });
    }
    const aanv=get("SELECT COUNT(*) AS n,MAX(aangevuld_op) AS laatst FROM nakijk_regels WHERE aangevuld=1 AND aangevuld_door=?",[p.naam]);
    if(aanv&&aanv.n)inzet.push({soort:'aanvullen',titel:`${aanv.n} aanvul-handeling${aanv.n===1?'':'en'} afgevinkt`,sub:'laatst '+relatief(aanv.laatst),link:'/nakijken'});
    const log=logboekVan(p,50);
    res.json({persoon:{id:p.id,naam:p.naam,rol:p.rol,rol_groep:rolGroep(p.rol),telefoon:p.telefoon||'',email:p.email||'',notities:p.notities||'',
        actief:p.actief!==0,stand:stand(p),laatst_actief:p.laatst_actief||'',laatst_actief_tekst:relatief(p.laatst_actief),uitnodiging_op:p.uitnodiging_op||''},
      rechten:RECHTEN[p.rol]||[],pincode:{gezet:!!p.pincode,gewijzigd_op:p.pincode_gewijzigd_op||'',gewijzigd_tekst:p.pincode_gewijzigd_op?tijdTekst(p.pincode_gewijzigd_op):''},
      rijbewijs:p.rijbewijs||'',eigen_wagen_capaciteit:p.eigen_wagen_capaciteit??null,meldingen_aan:p.meldingen_aan!==0,inzet,logboek:log});
  });

  // ── beheeracties ──
  const persoon=(req,res)=>{const p=get('SELECT * FROM personeel WHERE id=?',[req.params.id]);if(!p)res.status(404).json({error:'Persoon niet gevonden'});return p;};
  const terug=id=>{const{pincode,...r}=get('SELECT * FROM personeel WHERE id=?',[id]);return {...r,heeft_pincode:!!pincode};};
  app.put('/api/personeel/:id/velden',alleenKantoor,(req,res)=>{
    const p=persoon(req,res);if(!p)return;
    const b=req.body||{},v={};
    for(const k of ['naam','telefoon','email','rijbewijs','notities'])if(b[k]!==undefined)v[k]=String(b[k]||'').trim().slice(0,500);
    if(v.naam==='')return res.status(400).json({error:'Naam mag niet leeg zijn'});
    if(b.eigen_wagen_capaciteit!==undefined){const c=b.eigen_wagen_capaciteit===null||b.eigen_wagen_capaciteit===''?null:parseInt(b.eigen_wagen_capaciteit);
      if(c!==null&&!(c>0))return res.status(400).json({error:'Capaciteit eigen wagen moet een positief aantal bakken zijn'});v.eigen_wagen_capaciteit=c;}
    if(b.meldingen_aan!==undefined)v.meldingen_aan=b.meldingen_aan?1:0;
    if(!Object.keys(v).length)return res.status(400).json({error:'Niets om te bewaren'});
    wijzigPersoon(req,p.id,v,'beheer');
    res.json(terug(p.id));
  });
  app.put('/api/personeel/:id/rol',alleenKantoor,(req,res)=>{
    const p=persoon(req,res);if(!p)return;
    const rol=req.body?.rol;
    if(!ROLLEN.includes(rol))return res.status(400).json({error:`Rol moet ${ROLLEN.join(', ')} zijn`});
    if(p.id===req.persoon.persoon_id&&rol!=='kantoor')return res.status(409).json({error:'Je kan je eigen kantoorrol niet afnemen'});
    wijzigPersoon(req,p.id,{rol},'beheer: rol');
    vergeetSessiesVan(p.id); // rol zit in de sessie: opnieuw inloggen
    logAct('personeel','rol',`${p.naam}: rol ${p.rol} → ${rol} (door ${req.persoon.naam})`,null,null);
    res.json(terug(p.id));
  });
  app.post('/api/personeel/:id/pincode-reset',alleenKantoor,(req,res)=>{
    const p=persoon(req,res);if(!p)return;
    if(p.id===req.persoon.persoon_id)return res.status(409).json({error:'Je eigen pincode wijzig je via "pincode wijzigen", niet via een reset'});
    wijzigPersoon(req,p.id,{pincode:'',pincode_gewijzigd_op:isoNu(),uitnodiging_op:isoNu()},'beheer: pincode-reset');
    vergeetSessiesVan(p.id);
    logAct('personeel','pincode-reset',`${p.naam}: pincode gewist door ${req.persoon.naam} — kiest een nieuwe bij de volgende login`,null,null);
    res.json({ok:true,...terug(p.id)});
  });
  function zetActief(req,res,aan){
    const p=persoon(req,res);if(!p)return;
    if(!aan&&p.id===req.persoon.persoon_id)return res.status(409).json({error:'Je kan jezelf niet deactiveren'});
    wijzigPersoon(req,p.id,{actief:aan?1:0},aan?'beheer: activeren':'beheer: deactiveren');
    if(!aan)vergeetSessiesVan(p.id);
    logAct('personeel',aan?'geactiveerd':'gedeactiveerd',`${p.naam} ${aan?'weer geactiveerd':'gedeactiveerd'} door ${req.persoon.naam}`,null,null);
    res.json(terug(p.id));
  }
  app.post('/api/personeel/:id/deactiveer',alleenKantoor,(req,res)=>zetActief(req,res,false));
  app.post('/api/personeel/:id/activeer',alleenKantoor,(req,res)=>zetActief(req,res,true));
  // Uitnodiging: geen mail of sms — kantoor kopieert de instructie en stuurt ze zelf door.
  app.post('/api/personeel/uitnodiging',alleenKantoor,(req,res)=>{
    const ids=Array.isArray(req.body?.ids)?req.body.ids.map(Number).filter(Boolean):[];
    if(!ids.length)return res.status(400).json({error:'Kies eerst een of meer personen'});
    const adres=(req.headers['x-forwarded-proto']||req.protocol)+'://'+req.get('host')+'/';
    const uit=[],fouten=[];
    ids.forEach(id=>{
      const p=get('SELECT * FROM personeel WHERE id=?',[id]);
      if(!p){fouten.push({id,reden:'bestaat niet'});return;}
      if(p.actief===0){fouten.push({id,naam:p.naam,reden:'gedeactiveerd'});return;}
      if(!['kantoor','chauffeur','coordinator','monitor'].includes(p.rol)){fouten.push({id,naam:p.naam,reden:`rol ${p.rol} logt niet in (KV werkt met de KV-link)`});return;}
      wijzigPersoon(req,p.id,{uitnodiging_op:isoNu()},'beheer: uitnodiging');
      uit.push({id:p.id,naam:p.naam,telefoon:p.telefoon||'',heeft_pincode:!!p.pincode,
        instructie:`Hallo ${p.naam}, open ${adres} op je gsm, kies je naam "${p.naam}" en ${p.pincode?'log in met je pincode':'kies je pincode bij de eerste keer (minstens 4 cijfers)'}. Groeten, kantoor Sporty`});
    });
    res.json({adres,uitnodigingen:uit,fouten});
  });

  // ── logboek ──
  app.get('/api/logboek',alleenKantoor,(req,res)=>{
    const {van,tot,wie,tabel,zoek}=req.query;
    const max=Math.min(parseInt(req.query.max)||500,500);
    const w=[],wp=[];
    if(tabel){w.push('tabel=?');wp.push(String(tabel));}
    if(wie){w.push('persoon_naam LIKE ?');wp.push(`%${wie}%`);}
    if(zoek){w.push('(oud LIKE ? OR nieuw LIKE ? OR context LIKE ? OR tabel LIKE ?)');wp.push(...Array(4).fill(`%${zoek}%`));}
    const a=[],ap=[];
    if(tabel){a.push('type=?');ap.push(String(tabel));}
    if(wie){a.push('beschrijving LIKE ?');ap.push(`%${wie}%`);}
    if(zoek){a.push('(beschrijving LIKE ? OR type LIKE ? OR actie LIKE ?)');ap.push(...Array(3).fill(`%${zoek}%`));}
    // Ruim ophalen (datumfilter gebeurt na het omzetten: twee tijdformaten in de db), dan sorteren en knippen.
    let regels=[...all(`SELECT * FROM wijzigingen${w.length?' WHERE '+w.join(' AND '):''} ORDER BY id DESC LIMIT 3000`,wp).map(_wRegel),
      ...all(`SELECT * FROM activiteiten_log${a.length?' WHERE '+a.join(' AND '):''} ORDER BY id DESC LIMIT 3000`,ap).map(_aRegel)];
    const vanD=/^\d{4}-\d{2}-\d{2}$/.test(van||'')?+new Date(van+'T00:00:00'):null, totD=/^\d{4}-\d{2}-\d{2}$/.test(tot||'')?+new Date(tot+'T23:59:59'):null;
    if(vanD)regels=regels.filter(r=>r.sort>=vanD);if(totD)regels=regels.filter(r=>r.sort<=totD);
    regels.sort((x,y)=>y.sort-x.sort);
    const tabellen=[...new Set([...all('SELECT DISTINCT tabel FROM wijzigingen').map(r=>r.tabel),...all('SELECT DISTINCT type FROM activiteiten_log').map(r=>r.type)])].filter(Boolean).sort();
    res.json({filters:{van:van||'',tot:tot||'',wie:wie||'',tabel:tabel||'',zoek:zoek||''},totaal:regels.length,afgekapt:regels.length>max,tabellen,
      regels:regels.slice(0,max).map(({sort,...r})=>r)});
  });
  app.get('/api/logboek/wijziging/:id',alleenKantoor,(req,res)=>{
    const w=get('SELECT * FROM wijzigingen WHERE id=?',[req.params.id]);
    if(!w)return res.status(404).json({error:'Wijziging niet gevonden'});
    const o=_parse(w.oud),n=_parse(w.nieuw);
    if(o&&typeof o==='object')delete o.pincode;if(n&&typeof n==='object')delete n.pincode;
    res.json({..._wRegel(w),oud:o,nieuw:n});
  });

  app.get('/personeel',(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','personeel.html')));
  app.get('/logboek',(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','logboek.html')));
};
