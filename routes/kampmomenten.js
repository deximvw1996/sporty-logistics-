// routes/kampmomenten.js — PL1: Planning › Kampmomenten op het standaardpagina-patroon (design/mockup-planning.html).
// Lezen: GET /api/kampmomenten-overzicht en GET /api/kampmomenten/:id/detail. Schrijven via de bestaande routes (routes/planning.js);
// nieuw: PUT /api/kampmomenten/:id/velden, POST /api/kampmomenten/kv-links, POST /api/kampmomenten/genereer-transport en
// POST /api/kampmomenten/verwijderen (met 409-bewaking voor al geladen transport). Data en weergave gescheiden (MOBIEL-REGEL).
'use strict';
module.exports = function(ctx){
  const {app,get,all,run,ins,now,logAct,updateMetLog,delMetLog,_genToken,alleenKantoor,path,ROOT_DIR} = ctx;

  const KORT=['zo','ma','di','wo','do','vr','za'];
  const MND=['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
  const d0=s=>new Date(s+'T12:00:00');
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const plus=(s,n)=>{const d=d0(s);d.setDate(d.getDate()+n);return iso(d);};
  const kort=s=>{const d=d0(s);return `${KORT[d.getDay()]} ${d.getDate()} ${MND[d.getMonth()]}`;};
  const wie=req=>(req.persoon&&req.persoon.naam)||'';
  const locNaam=id=>id?((get('SELECT name FROM locaties WHERE id=?',[id])||{}).name||'?'):'?';
  const actievePeriode=()=>get('SELECT * FROM vakantieperiodes WHERE actief=1')||get('SELECT * FROM vakantieperiodes ORDER BY id DESC LIMIT 1');
  const KOOK=['ma','di','wo','do','vr'];

  // Handler van een bestaande route aanroepen zonder netwerk (zelfde persoon), zoals routes/vandaag.js.
  function _roep(methode,pad,{query={},body={}}={},req){
    const laag=(app._router?.stack||[]).find(l=>l.route&&l.route.path===pad&&l.route.methods[methode]);
    if(!laag)return {status:404,json:null};
    const h=laag.route.stack[laag.route.stack.length-1].handle;
    let uit=null;
    const res={statusCode:200,status(c){this.statusCode=c;return this;},json(o){uit=o;return this;},set(){return this;},send(o){uit=o;return this;}};
    try{h({query,params:{},body,persoon:req.persoon,headers:req.headers},res,()=>{});}catch(e){console.error('kampmomenten: '+pad+' faalde:',e.message);return {status:500,json:null};}
    return {status:res.statusCode,json:uit};
  }

  // De zeven dagen (ma..zo) van de kampweek: open of niet. Werkdagen zijn standaard open, weekend standaard dicht.
  function _dagen(km,periode){
    if(!periode||!km.week)return {maandag:null,dagen:[false,false,false,false,false,false,false],datums:[]};
    const ma=plus(periode.start_datum,(km.week-1)*7);
    const gesloten=new Set(all('SELECT datum FROM gesloten_dagen').map(g=>g.datum));
    const datums=[0,1,2,3,4,5,6].map(i=>plus(ma,i));
    const dagen=datums.map((dt,i)=>{
      if(gesloten.has(dt))return false;
      if(dt>periode.eind_datum||dt<periode.start_datum)return false;
      const r=get('SELECT open FROM kalender_dagen WHERE locatie_id=? AND datum=?',[km.locatie_id,dt]);
      return r?r.open==1:i<5;
    });
    return {maandag:ma,dagen,datums};
  }
  function _dagenTekst(week,dagen,datums){
    const open=datums.filter((_,i)=>dagen[i]);
    if(!open.length)return `wk ${week} · geen open dagen`;
    const a=d0(open[0]),b=d0(open[open.length-1]);
    const am=a.getMonth()===b.getMonth()?'':' '+MND[a.getMonth()];
    return `wk ${week} · ${KORT[a.getDay()]} ${a.getDate()}${am} – ${KORT[b.getDay()]} ${b.getDate()} ${MND[b.getMonth()]}`;
  }
  const kookLijst=km=>(km.kookdagen||'').split(',').map(s=>s.trim()).filter(x=>KOOK.includes(x));

  function _themas(km){
    return all(`SELECT kt.id AS kt_id,kt.dag,kt.leeftijdsgroep AS kt_lg,t.id,t.name,t.leeftijdsgroep FROM kampmoment_themas kt JOIN themas t ON t.id=kt.thema_id WHERE kt.kampmoment_id=? ORDER BY kt.dag,t.name`,[km.id])
      .map(t=>({id:t.id,kt_id:t.kt_id,naam:t.name,leeftijdsgroep:t.kt_lg||t.leeftijdsgroep||'',dag:t.dag==null?null:t.dag}));
  }
  function _themaTekst(km,themas){
    if(!themas.length)return '— geen thema';
    return require('../lib/tijd').namenKort(themas.map(t=>t.naam));
  }
  function _kv(km){
    const p=km.kv_persoon_id?get('SELECT id,naam,telefoon FROM personeel WHERE id=?',[km.kv_persoon_id]):null;
    return p?{id:p.id,naam:p.naam,telefoon:p.telefoon||'',link_gestuurd:!!km.kv_link_gestuurd}:null;
  }
  function _taken(km){
    return all("SELECT * FROM transport_taken WHERE kampmoment_id=? AND status<>'geannuleerd' ORDER BY datum,COALESCE(tijd,''),id",[km.id]);
  }
  function _transportTekst(km,taken){
    const delen=[];
    const beschrijf=(label,t)=>{
      const rit=t.rit_id?get('SELECT id,status FROM transport_ritten WHERE id=?',[t.rit_id]):null;
      let s=`${label} ${t.datum?kort(t.datum):'zonder datum'}`;
      if(t.status==='gedaan')s+=' ✓';
      else if(!rit)s+=' zonder rit';
      else s+=` · rit #${rit.id}`;
      return s;
    };
    const lev=taken.find(t=>t.type==='levering'),oph=taken.slice().reverse().find(t=>t.type==='ophaling');
    if(lev)delen.push(beschrijf('levering',lev));
    if(oph)delen.push(beschrijf('ophaling',oph));
    const k=kookLijst(km);
    if(k.length)delen.push('kookdagen '+k.join('/'));
    return delen.length?delen.join(' · '):'—';
  }

  // Conflicten uit de bestaande detector aan een kampmoment koppelen (de detector geeft enkel tekst: locatienaam + week).
  function _conflictenVan(km,locnaam,alle){
    return (alle||[]).filter(c=>{
      const b=String(c.bericht||'');
      if(!b.includes(locnaam))return false;
      const m=/[Ww]eek\s*(\d+)/.exec(b);
      return (m&&+m[1]===km.week)||b.includes('@'+km.week);
    });
  }

  function _rijen(periode,req){
    const kms=all('SELECT * FROM kampmomenten WHERE periode_id=? ORDER BY week,locatie_id',[periode.id]);
    const conf=(_roep('get','/api/conflicten',{},req).json)||[];
    const perThemaWeek={};
    const themasPer=new Map();
    kms.forEach(km=>{const th=_themas(km);themasPer.set(km.id,th);th.forEach(t=>{const k=km.week+':'+t.id;(perThemaWeek[k]=perThemaWeek[k]||[]).push(km);});});
    return kms.map(km=>{
      const loc=get('SELECT id,name FROM locaties WHERE id=?',[km.locatie_id])||{id:km.locatie_id,name:'?'};
      const themas=themasPer.get(km.id),kv=_kv(km),taken=_taken(km);
      const {maandag,dagen,datums}=_dagen(km,periode);
      const aandacht=[];
      if(!themas.length)aandacht.push('geen thema');
      if(!kv)aandacht.push('geen KV');
      const dubbel=new Set();
      themas.forEach(t=>(perThemaWeek[km.week+':'+t.id]||[]).filter(o=>o.id!==km.id).forEach(o=>dubbel.add(`${t.naam} (met ${locNaam(o.locatie_id)} wk ${o.week})`)));
      dubbel.forEach(d=>aandacht.push('thema dubbel: '+d));
      taken.filter(t=>t.type==='levering'&&!t.rit_id&&t.status==='gepland').slice(0,1).forEach(t=>aandacht.push('levering zonder rit'));
      // Alleen echte conflicten (ernst 'hoog': dubbel thema/bak, tekorten) tellen als aandacht; "nog geen levering" is geen conflict maar transportstand.
      const conflicten=_conflictenVan(km,loc.name,conf).filter(c=>c.ernst==='hoog');
      conflicten.filter(c=>c.type!=='dubbel_thema').forEach(c=>{if(!aandacht.some(a=>a===c.bericht))aandacht.push(c.bericht);});
      const themaTekst=_themaTekst(km,themas);
      return {id:km.id,locatie:{id:loc.id,naam:loc.name},week:km.week,periode_id:km.periode_id,maandag,
        dagen_tekst:_dagenTekst(km.week,dagen,datums),dagen,type:km.type||'kamp',themas,thema_tekst:themaTekst,kv,
        transport_tekst:_transportTekst(km,taken),status:aandacht.length?'let':'ok',aandacht,conflict:conflicten.length>0,
        zoek:[loc.name,themaTekst,kv?kv.naam:'',km.week].join(' ').toLowerCase()};
    });
  }

  app.get('/api/kampmomenten-overzicht',alleenKantoor,(req,res)=>{
    const periode=(parseInt(req.query.periode_id)&&get('SELECT * FROM vakantieperiodes WHERE id=?',[parseInt(req.query.periode_id)]))||actievePeriode();
    if(!periode)return res.json({periode:null,tellers:{totaal:0,per_week:{},zonder_thema:0,zonder_kv:0,conflict:0},kampmomenten:[]});
    const alle=_rijen(periode,req);
    const perWeek={};alle.forEach(r=>{perWeek[r.week]=(perWeek[r.week]||0)+1;});
    const tellers={totaal:alle.length,per_week:perWeek,zonder_thema:alle.filter(r=>!r.themas.length).length,zonder_kv:alle.filter(r=>!r.kv).length,conflict:alle.filter(r=>r.conflict||r.aandacht.some(a=>/^thema dubbel/.test(a))).length};
    const wk=parseInt(req.query.week);
    res.json({periode:{id:periode.id,naam:periode.naam,start_datum:periode.start_datum,eind_datum:periode.eind_datum,max_weken:periode.max_weken},tellers,kampmomenten:wk?alle.filter(r=>r.week===wk):alle});
  });

  app.get('/api/kampmomenten/:id/detail',alleenKantoor,(req,res)=>{
    const km=get('SELECT * FROM kampmomenten WHERE id=?',[req.params.id]);
    if(!km)return res.status(404).json({error:'Dit kampmoment bestaat niet (meer).'});
    const periode=get('SELECT * FROM vakantieperiodes WHERE id=?',[km.periode_id])||actievePeriode();
    const rij=_rijen(periode,req).find(r=>r.id===km.id);
    const loc=get('SELECT * FROM locaties WHERE id=?',[km.locatie_id])||{};
    const kook=kookLijst(km);
    const kinderen=km.aantal_kinderen==null?null:km.aantal_kinderen,kleuters=km.aantal_kleuters==null?null:km.aantal_kleuters;
    // Thema's die in deze week nergens anders gepland zijn (het eigen thema van dit kampmoment telt niet als "elders").
    const elders=new Set(all('SELECT kt.thema_id FROM kampmoment_themas kt JOIN kampmomenten k ON k.id=kt.kampmoment_id WHERE k.periode_id=? AND k.week=? AND k.id<>?',[km.periode_id,km.week,km.id]).map(r=>r.thema_id));
    const gekozen=new Set(rij.themas.map(t=>t.id));
    const bezet=all('SELECT kt.thema_id,l.name FROM kampmoment_themas kt JOIN kampmomenten k ON k.id=kt.kampmoment_id JOIN locaties l ON l.id=k.locatie_id WHERE k.periode_id=? AND k.week=? AND k.id<>?',[km.periode_id,km.week,km.id]);
    const themasBeschikbaar=all('SELECT id,name,leeftijdsgroep FROM themas ORDER BY leeftijdsgroep,name').filter(t=>!elders.has(t.id)).map(t=>({id:t.id,naam:t.name,leeftijdsgroep:t.leeftijdsgroep||'',gekozen:gekozen.has(t.id)}));
    const themasBezet=[...new Map(bezet.map(b=>[b.thema_id,b])).values()].map(b=>({id:b.thema_id,naam:(get('SELECT name FROM themas WHERE id=?',[b.thema_id])||{}).name||'?',bij:b.name}));
    const materiaal=rij.themas.map(t=>({thema_id:t.id,thema:t.naam,items:[
      ...all("SELECT b.naam,b.code FROM bakken b JOIN thema_bak tb ON tb.bak_id=b.id WHERE tb.thema_id=? AND b.soort='thema' ORDER BY b.code",[t.id]).map(b=>({naam:b.naam,code:b.code||'',soort:'bak'})),
      ...all('SELECT a.naam,a.code FROM attributen a JOIN thema_attribuut ta ON ta.attribuut_id=a.id WHERE ta.thema_id=? ORDER BY a.code',[t.id]).map(a=>({naam:a.naam,code:a.code||'',soort:'attribuut'}))]}));
    const taken=_taken(km).map(t=>{
      const rit=t.rit_id?get('SELECT id,chauffeur,status,datum FROM transport_ritten WHERE id=?',[t.rit_id]):null;
      const regels=all('SELECT naam,qty FROM transport_regels WHERE taak_id=?',[t.id]);
      return {id:t.id,type:t.type,datum:t.datum||'',tijd:t.tijd||'',wanneer_tekst:`${t.datum?kort(t.datum):'zonder datum'}${t.tijd?' '+t.tijd:''}`,status:t.status,
        rit:rit?{id:rit.id,chauffeur:rit.chauffeur||'',status:rit.status}:null,
        wat:regels.length?`${regels.reduce((s,r)=>s+(r.qty||1),0)} stuks`:'—',regels:regels.map(r=>r.naam)};
    });
    const aanvragen=all("SELECT id,soort,tekst,status,created_at FROM aanvragen WHERE kampmoment_id=? AND status='nieuw' AND soort IN ('materiaal','kapot','probleem_chauffeur') ORDER BY id DESC",[km.id]);
    const conf=(_roep('get','/api/conflicten',{},req).json)||[];
    const conflicten=_conflictenVan(km,loc.name||'',conf);
    const hist=[];
    all("SELECT * FROM wijzigingen WHERE tabel='kampmomenten' AND rij_id=? ORDER BY id DESC LIMIT 30",[km.id]).forEach(w=>{
      let o=null,n=null;try{o=JSON.parse(w.oud||'null');n=JSON.parse(w.nieuw||'null');}catch(e){}
      let tekst=w.actie==='insert'?'kampmoment aangemaakt':w.actie==='delete'?'kampmoment verwijderd':'gegevens gewijzigd';
      if(w.actie==='update'&&o&&n){
        const v=[];
        if(o.kv_persoon_id!==n.kv_persoon_id)v.push(n.kv_persoon_id?'KV gekoppeld':'KV losgekoppeld');
        if(o.week!==n.week)v.push(`week ${o.week} → ${n.week}`);
        if((o.kookdagen||'')!==(n.kookdagen||''))v.push('kookdagen '+(n.kookdagen?n.kookdagen.split(',').join('/'):'leeg')+' gezet');
        if((o.notities||'')!==(n.notities||''))v.push('opmerking gewijzigd');
        if(o.aantal_kinderen!==n.aantal_kinderen||o.aantal_kleuters!==n.aantal_kleuters||o.aantal_monitoren!==n.aantal_monitoren)v.push('groep gewijzigd');
        if(o.kv_link_gestuurd!==n.kv_link_gestuurd&&n.kv_link_gestuurd)v.push('KV-link gestuurd');
        if(o.type!==n.type)v.push(`${o.type} → ${n.type}`);
        if(v.length)tekst=v.join(' · ');
      }
      hist.push({tekst,wie:w.persoon_naam||(w.context||''),tijd:w.tijdstip,sorteer:w.tijdstip});
    });
    all("SELECT * FROM activiteiten_log WHERE locatie_id=? AND (beschrijving LIKE ? OR beschrijving LIKE ?) ORDER BY id DESC LIMIT 20",[km.locatie_id,`%eek ${km.week}%`,`%week ${km.week}%`]).forEach(a=>{
      const m=/(\d{1,2})\/(\d{1,2})\/(\d{4})\D+(\d{1,2}):(\d{2})/.exec(a.tijdstip||'');
      hist.push({tekst:a.beschrijving,wie:'',tijd:a.tijdstip,sorteer:m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}T${m[4].padStart(2,'0')}:${m[5]}`:''});
    });
    hist.sort((a,b)=>String(b.sorteer).localeCompare(String(a.sorteer)));
    res.json({...rij,
      groep:{kinderen,kleuters,lager:kinderen==null||kleuters==null?null:Math.max(0,kinderen-kleuters),monitoren:km.aantal_monitoren==null?null:km.aantal_monitoren},
      kookdagen:kook,oven_mee:kook.length>0&&!loc.heeft_eigen_oven,heeft_eigen_oven:!!loc.heeft_eigen_oven,opmerking:km.notities||'',
      locatie_adres:loc.addr||'',themas_beschikbaar:themasBeschikbaar,themas_bezet:themasBezet,materiaal,transport:taken,aanvragen_open:aanvragen,
      conflicten:conflicten.map(c=>({type:c.type,ernst:c.ernst,bericht:c.bericht})),
      historiek:hist.map(({sorteer,...h})=>h),dagen_datums:_dagen(km,periode).datums});
  });

  // Dagen, kookdagen, groep en opmerking in één keer (gelogd).
  app.put('/api/kampmomenten/:id/velden',alleenKantoor,(req,res)=>{
    const km=get('SELECT * FROM kampmomenten WHERE id=?',[req.params.id]);
    if(!km)return res.status(404).json({error:'Dit kampmoment bestaat niet (meer).'});
    const b=req.body||{};
    const velden={};
    if(b.kookdagen!==undefined){
      if(!Array.isArray(b.kookdagen)||b.kookdagen.some(d=>!KOOK.includes(d)))return res.status(400).json({error:'Kookdagen zijn ma, di, wo, do of vr.'});
      velden.kookdagen=KOOK.filter(d=>b.kookdagen.includes(d)).join(',');
    }
    for(const k of ['aantal_kinderen','aantal_kleuters','aantal_monitoren']){
      if(b[k]===undefined)continue;
      if(b[k]===null||b[k]===''){velden[k]=null;continue;}
      const n=parseInt(b[k],10);
      if(isNaN(n)||n<0||n>999)return res.status(400).json({error:'Aantallen moeten tussen 0 en 999 liggen.'});
      velden[k]=n;
    }
    const kin=velden.aantal_kinderen!==undefined?velden.aantal_kinderen:km.aantal_kinderen,kle=velden.aantal_kleuters!==undefined?velden.aantal_kleuters:km.aantal_kleuters;
    if(kin!=null&&kle!=null&&kle>kin)return res.status(400).json({error:'Er kunnen niet meer kleuters zijn dan kinderen.'});
    if(b.opmerking!==undefined)velden.notities=String(b.opmerking||'').slice(0,500);
    const periode=get('SELECT * FROM vakantieperiodes WHERE id=?',[km.periode_id])||actievePeriode();
    let dagenGewijzigd=0;
    if(b.dagen!==undefined){
      if(!Array.isArray(b.dagen)||b.dagen.length!==7)return res.status(400).json({error:'dagen moet 7 waarden bevatten (ma t/m zo).'});
      const {datums,dagen:huidig}=_dagen(km,periode);
      datums.forEach((dt,i)=>{
        const wil=!!b.dagen[i];
        if(wil===huidig[i])return;
        const r=get('SELECT * FROM kalender_dagen WHERE locatie_id=? AND datum=?',[km.locatie_id,dt]);
        if(r)run('UPDATE kalender_dagen SET open=? WHERE id=?',[wil?1:0,r.id]);
        else ins('INSERT INTO kalender_dagen (locatie_id,datum,open) VALUES (?,?,?)',[km.locatie_id,dt,wil?1:0]);
        dagenGewijzigd++;
      });
    }
    if(Object.keys(velden).length)updateMetLog(req,'kampmomenten',km.id,velden,'planning');
    const L=locNaam(km.locatie_id);
    if(dagenGewijzigd)logAct('kampmoment','dagen',`${L} week ${km.week}: open dagen aangepast (${dagenGewijzigd} dag${dagenGewijzigd===1?'':'en'}) door ${wie(req)||'kantoor'}`,km.locatie_id,L);
    res.json({ok:true,dagen_gewijzigd:dagenGewijzigd,velden:Object.keys(velden)});
  });

  // KV-links in bulk: maakt ontbrekende tokens, markeert "link gestuurd", geeft de links terug (kantoor stuurt ze zelf door).
  app.post('/api/kampmomenten/kv-links',alleenKantoor,(req,res)=>{
    const ids=(Array.isArray(req.body?.ids)?req.body.ids:[]).map(Number).filter(Boolean);
    if(!ids.length)return res.status(400).json({error:'Kies eerst een of meer kampmomenten.'});
    const host=(req.headers['x-forwarded-proto']||req.protocol||'http')+'://'+(req.headers['x-forwarded-host']||req.headers.host||'');
    const links=[],fouten=[];
    ids.forEach(id=>{
      const km=get('SELECT * FROM kampmomenten WHERE id=?',[id]);
      if(!km){fouten.push({id,reden:'bestaat niet (meer)'});return;}
      const kv=_kv(km),naam=locNaam(km.locatie_id);
      if(!kv){fouten.push({id,locatie:naam,week:km.week,reden:'er is nog geen KV gekoppeld'});return;}
      let tok=km.kv_token;
      if(!tok){tok=_genToken(12);updateMetLog(req,'kampmomenten',km.id,{kv_token:tok},'kv-links');}
      if(!km.kv_link_gestuurd)updateMetLog(req,'kampmomenten',km.id,{kv_link_gestuurd:1},'kv-links');
      links.push({id,locatie:naam,week:km.week,kv_naam:kv.naam,telefoon:kv.telefoon,url:'/kv/'+tok,volledig:host+'/kv/'+tok});
    });
    if(links.length)logAct('kampmoment','kv-links',`${links.length} KV-link${links.length===1?'':'s'} klaargezet door ${wie(req)||'kantoor'}`,null,null);
    res.json({ok:true,links,fouten});
  });

  // Genereer transport voor een selectie (of alle kampmomenten van de periode): de bestaande generator levert voorstellen,
  // die hier als taken (met datum, nog zonder rit) worden aangemaakt; wat er al is, wordt niet dubbel gemaakt.
  app.post('/api/kampmomenten/genereer-transport',alleenKantoor,(req,res)=>{
    const ids=(Array.isArray(req.body?.ids)?req.body.ids:[]).map(Number).filter(Boolean);
    const periode=(parseInt(req.body?.periode_id)&&get('SELECT * FROM vakantieperiodes WHERE id=?',[parseInt(req.body.periode_id)]))||actievePeriode();
    const doel=new Set(ids.length?ids:all('SELECT id FROM kampmomenten WHERE periode_id=?',[periode?periode.id:0]).map(r=>r.id));
    const g=_roep('post','/api/transport-genereer',{body:{}},req);
    if(g.status!==200||!Array.isArray(g.json))return res.status(500).json({error:'De generator gaf geen voorstellen terug.'});
    const gemaakt=[],overgeslagen=[];
    g.json.filter(v=>doel.has(v.kampmoment_id)).forEach(v=>{
      const bestaat=get("SELECT id FROM transport_taken WHERE kampmoment_id=? AND type=? AND opmerking=? AND status<>'geannuleerd'",[v.kampmoment_id,v.type,v.opmerking||'']);
      if(bestaat){overgeslagen.push({kampmoment_id:v.kampmoment_id,type:v.type,taak_id:bestaat.id});return;}
      const isOph=v.type==='ophaling';
      const r=_roep('post','/api/transport-taken',{body:{type:v.type,datum:v.datum,tijd:v.tijd,opmerking:v.opmerking,kampmoment_id:v.kampmoment_id,week:v.week,
        van_locatie_id:isOph?v.locatie_id:v.van_locatie_id,naar_locatie_id:isOph?v.naar_locatie_id:v.locatie_id,
        regels:(v.materiaal||[]).map(m=>({naam:m.naam,qty:m.qty,soort:m.soort,bak_id:m.bak_id,attribuut_id:m.attribuut_id}))}},req);
      if(r.status===200&&r.json&&r.json.id)gemaakt.push({kampmoment_id:v.kampmoment_id,type:v.type,taak_id:r.json.id,datum:v.datum});
    });
    if(gemaakt.length)logAct('transport','gegenereerd',`${gemaakt.length} taak${gemaakt.length===1?'':'en'} gegenereerd uit de planning door ${wie(req)||'kantoor'}`,null,null);
    res.json({ok:true,aangemaakt:gemaakt.length,gemaakt,overgeslagen:overgeslagen.length,kampmomenten:[...new Set(gemaakt.map(x=>x.kampmoment_id))].length});
  });

  // Verwijderen met bewaking: staat er al iets geladen, dan 409 en blijft alles staan (de oude DELETE-route kent die bewaking niet).
  app.post('/api/kampmomenten/verwijderen',alleenKantoor,(req,res)=>{
    const ids=(Array.isArray(req.body?.ids)?req.body.ids:[]).map(Number).filter(Boolean);
    if(!ids.length)return res.status(400).json({error:'Kies eerst een of meer kampmomenten.'});
    const kms=ids.map(id=>get('SELECT * FROM kampmomenten WHERE id=?',[id])).filter(Boolean);
    for(const km of kms){
      const n=get('SELECT COUNT(*) AS n FROM verhuis_checks vc JOIN transport_taken t ON t.id=vc.taak_id WHERE t.kampmoment_id=? AND vc.geladen=1',[km.id]).n;
      if(n)return res.status(409).json({error:`${locNaam(km.locatie_id)} week ${km.week}: ${n} stuk${n===1?' is':'ken zijn'} al geladen — verwijderen kan pas als dat teruggedraaid is. Er is niets verwijderd.`});
    }
    kms.forEach(km=>{
      run('DELETE FROM kampmoment_themas WHERE kampmoment_id=?',[km.id]);
      delMetLog(req,'DELETE FROM transport_taken WHERE kampmoment_id=?',[km.id],'planning');
      delMetLog(req,'DELETE FROM kampmomenten WHERE id=?',[km.id],'planning');
      logAct('kampmoment','verwijderd',`Week ${km.week} — ${locNaam(km.locatie_id)} verwijderd door ${wie(req)||'kantoor'}`,km.locatie_id,locNaam(km.locatie_id));
    });
    res.json({ok:true,verwijderd:kms.length});
  });

  app.get('/kampmomenten',(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','kampmomenten.html')));
};
