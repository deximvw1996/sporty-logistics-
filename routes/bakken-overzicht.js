// routes/bakken-overzicht.js — MA1: Materiaal › Bakken op het standaardpagina-patroon (design/mockup-materiaal.html).
// Lezen: GET /api/bakken-overzicht (lijst + tellers) en GET /api/bakken/:id/detail (?soort=attribuut voor attributen).
// Verwijderen met controle (409 als onderweg of met open telling) en daarna de bestaande DELETE-route.
// Etiketten: printbare pagina /etiketten?ids= (er bestond geen etiketroute). Data en weergave gescheiden (MOBIEL-REGEL).
'use strict';
module.exports = function(ctx){
  const {app,get,all,alleenKantoor,path,ROOT_DIR} = ctx;

  const DAG=['zo','ma','di','wo','do','vr','za'], MND=['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
  // now() ("29/10/2026, 16:54"), ISO of "YYYY-MM-DD HH:MM" → "vr 30 okt 08:15".
  function tijdTekst(s){
    let m=/(\d{1,2})\/(\d{1,2})\/(\d{4})\D+(\d{1,2}):(\d{2})/.exec(s||''),d=null;
    if(m)d=new Date(+m[3],+m[2]-1,+m[1],+m[4],+m[5]);
    else if((m=/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(s||'')))d=new Date(+m[1],+m[2]-1,+m[3],+(m[4]||0),+(m[5]||0));
    if(!d||isNaN(d))return s||'';
    return `${DAG[d.getDay()]} ${d.getDate()} ${MND[d.getMonth()]}${m[4]!==undefined&&m[4]!==null?' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'):''}`;
  }
  const locs=()=>new Map(all('SELECT id,name,type FROM locaties').map(l=>[l.id,l]));
  // Thema-bakken bewaren hun stukken in bak_items, vaste bakken (en pool) in vaste_bak_items.
  const itemTabel=soort=>soort==='thema'?'bak_items':'vaste_bak_items';
  const plaatsTekst=b=>[b.rek?'rek '+b.rek:'',b.plank?'plank '+b.plank:''].filter(Boolean).join(' ');

  // Stand uit de laatste telling van deze bak.
  function stand(sessie,regels){
    if(!sessie)return {tekst:'niet geteld',status:'ok',incompleet:false};
    const geteld=regels.filter(r=>r.aangetroffen!=null);
    if(!geteld.length)return {tekst:'niet geteld',status:'ok',incompleet:false};
    const tekort=geteld.reduce((s,r)=>s+Math.max(0,(r.verwacht||0)-r.aangetroffen),0);
    const teVeel=geteld.reduce((s,r)=>s+Math.max(0,r.aangetroffen-(r.verwacht||0)),0);
    const kapot=geteld.reduce((s,r)=>s+(r.kapot_aantal||0),0);
    const besteld=geteld.some(r=>r.tekort_status==='besteld'||r.besteld);
    const delen=[];
    if(kapot)delen.push(`kapot ${kapot}`);if(tekort)delen.push(`tekort ${tekort}`);if(teVeel)delen.push(`te veel ${teVeel}`);
    if(!delen.length)return {tekst:'ok',status:'ok',incompleet:false};
    return {tekst:delen.join(' · ')+(besteld?' · besteld':''),status:'let',incompleet:!!(tekort||kapot)};
  }
  const sessieVeld={thema:'thema_bak_id',vast:'vaste_bak_id',attribuut:'attribuut_id'};
  function laatsteSessie(soort,id){
    const s=get(`SELECT * FROM nakijk_sessies WHERE ${sessieVeld[soort]}=? ORDER BY id DESC`,[id]);
    return {s,regels:s?all('SELECT * FROM nakijk_regels WHERE sessie_id=?',[s.id]):[]};
  }
  function onderweg(soort,id){
    return get(`SELECT c.rit_id FROM verhuis_checks c WHERE ${soort==='attribuut'?'c.attribuut_id':'c.bak_id'}=? AND c.geladen=1 AND COALESCE(c.gelost,0)=0 ORDER BY c.id DESC`,[id]);
  }
  // "Abdijschool Vlierbeek wk 1": kampmoment van de actieve periode op die locatie.
  function kampWeek(locId){
    const per=get('SELECT id FROM vakantieperiodes WHERE actief=1');
    const km=per?get('SELECT week FROM kampmomenten WHERE locatie_id=? AND periode_id=? ORDER BY week',[locId,per.id]):null;
    return km?` wk ${km.week}`:'';
  }
  function waarNu(b,soort,L){
    const ow=onderweg(soort,b.id);
    if(ow)return {tekst:`onderweg rit #${ow.rit_id}`,locatie_id:null,rit_id:ow.rit_id};
    const l=L.get(b.huidige_locatie_id)||L.get(b.thuislocatie_id);
    if(!l)return {tekst:'—',locatie_id:null,rit_id:null};
    if(l.type==='stockage'){const p=l.id===b.thuislocatie_id?plaatsTekst(b):'';return {tekst:l.name+(p?' · '+p:''),locatie_id:l.id,rit_id:null};}
    return {tekst:l.name+kampWeek(l.id),locatie_id:l.id,rit_id:null};
  }
  function rij(b,soort,L,themaVan){
    const th=themaVan.get(b.id)||null;
    const w=waarNu(b,soort,L);
    let inhoud='1';
    if(soort==='pool')inhoud=`${b.aantal||0} stuks`;
    else if(soort!=='attribuut'){const n=get(`SELECT COUNT(*) AS s,COALESCE(SUM(qty),0) AS q FROM ${itemTabel(soort)} WHERE bak_id=?`,[b.id]);inhoud=n.s?`${n.s} soorten · ${n.q} stuks`:'leeg';}
    const ls=laatsteSessie(soort==='pool'?'vast':soort,b.id), st=stand(ls.s,ls.regels);
    return {id:b.id,soort,code:b.code||'',naam:b.naam||'',thema:th,waar_nu_tekst:w.tekst,waar_nu:{locatie_id:w.locatie_id,rit_id:w.rit_id},
      inhoud_tekst:inhoud,stand_tekst:st.tekst,status:st.status,incompleet:st.incompleet,rek:b.rek||'',plank:b.plank||'',thuis_locatie_id:b.thuislocatie_id||null};
  }
  function lijst(){
    const L=locs();
    const tb=new Map(),ta=new Map();
    all('SELECT tb.bak_id,t.id,t.name FROM thema_bak tb JOIN themas t ON t.id=tb.thema_id ORDER BY t.name').forEach(r=>{if(!tb.has(r.bak_id))tb.set(r.bak_id,{id:r.id,naam:r.name});});
    all('SELECT ta.attribuut_id,t.id,t.name FROM thema_attribuut ta JOIN themas t ON t.id=ta.thema_id ORDER BY t.name').forEach(r=>{if(!ta.has(r.attribuut_id))ta.set(r.attribuut_id,{id:r.id,naam:r.name});});
    const bakken=[
      ...all('SELECT * FROM bakken ORDER BY soort,(COALESCE(LENGTH(code),0)=0),code,naam').map(b=>rij(b,b.soort==='thema'?'thema':b.is_bulk?'pool':'vast',L,tb)),
      ...all('SELECT * FROM attributen ORDER BY (COALESCE(LENGTH(code),0)=0),code,naam').map(a=>rij(a,'attribuut',L,ta))];
    const per_stockage={};
    bakken.forEach(b=>{const l=L.get(b.waar_nu.locatie_id);if(l&&l.type==='stockage')per_stockage[l.name]=(per_stockage[l.name]||0)+1;});
    return {tellers:{alle:bakken.length,thema:bakken.filter(b=>b.soort==='thema').length,vast:bakken.filter(b=>b.soort==='vast'||b.soort==='pool').length,
      attribuut:bakken.filter(b=>b.soort==='attribuut').length,onderweg:bakken.filter(b=>b.waar_nu.rit_id).length,incompleet:bakken.filter(b=>b.incompleet).length,per_stockage},
      bakken:bakken.map(b=>({...b,zoek:[b.code,b.naam,b.thema?b.thema.naam:'',b.waar_nu_tekst].join(' ').toLowerCase()}))};
  }
  app.get('/api/bakken-overzicht',alleenKantoor,(req,res)=>res.json(lijst()));

  app.get('/api/bakken/:id/detail',alleenKantoor,(req,res)=>{
    const isAttr=req.query.soort==='attribuut';
    const b=get(`SELECT * FROM ${isAttr?'attributen':'bakken'} WHERE id=?`,[req.params.id]);
    if(!b)return res.status(404).json({error:isAttr?'Attribuut niet gevonden':'Bak niet gevonden'});
    const soort=isAttr?'attribuut':b.soort==='thema'?'thema':b.is_bulk?'pool':'vast';
    const L=locs();
    const th=isAttr?get('SELECT t.id,t.name AS naam FROM thema_attribuut x JOIN themas t ON t.id=x.thema_id WHERE x.attribuut_id=? ORDER BY t.name',[b.id])
      :get('SELECT t.id,t.name AS naam FROM thema_bak x JOIN themas t ON t.id=x.thema_id WHERE x.bak_id=? ORDER BY t.name',[b.id]);
    const themaVan=new Map([[b.id,th||null]]);
    const basis=rij(b,soort,L,themaVan);
    const ls=laatsteSessie(soort==='pool'?'vast':soort,b.id);
    const inhoud=isAttr?[]:all(`SELECT id,naam,qty,item_type_id FROM ${itemTabel(soort)} WHERE bak_id=? ORDER BY id`,[b.id]).map(it=>{
      const r=ls.regels.find(x=>x.item_id===it.id);
      let st='niet geteld';
      if(r&&r.aangetroffen!=null){const t=Math.max(0,(r.verwacht||it.qty)-r.aangetroffen),v=Math.max(0,r.aangetroffen-(r.verwacht||it.qty));
        st=[r.kapot_aantal?`${r.kapot_aantal} kapot`:'',t?`tekort ${t}`:'',v?`te veel ${v}`:''].filter(Boolean).join(' · ')||'ok';
        if(r.tekort_status==='besteld'||r.besteld)st+=' · besteld';}
      return {item_id:it.id,naam:it.naam,qty:it.qty,item_type_id:it.item_type_id,stand_tekst:st};
    });
    const fotos=isAttr?(b.foto_path?[{id:null,url:'/uploads/'+b.foto_path,beschrijving:'foto'}]:[])
      :[...['foto_opgeplooid_path','foto_opgezet_path'].filter(k=>b[k]).map(k=>({id:null,url:'/uploads/'+b[k],beschrijving:k.includes('opgezet')?'opgezet':'opgeplooid'})),
        ...all('SELECT id,tijdstip,wie,beschrijving,foto_path,foto_data FROM bak_fotos WHERE bak_id=? ORDER BY id DESC',[b.id]).map(f=>({id:f.id,url:f.foto_path?'/uploads/'+f.foto_path:(f.foto_data||null),beschrijving:f.beschrijving||'',t:f.tijdstip,wie:f.wie}))];
    // Waar geweest: laad- en losmomenten uit verhuis_checks, met rit en chauffeur.
    const veld=isAttr?'attribuut_id':'bak_id';
    const checks=all(`SELECT c.*,r.chauffeur,t.van_locatie_id,t.naar_locatie_id,t.type FROM verhuis_checks c LEFT JOIN transport_ritten r ON r.id=c.rit_id LEFT JOIN transport_taken t ON t.id=c.taak_id WHERE c.${veld}=? ORDER BY c.id DESC`,[b.id]);
    const waar_geweest=[];
    checks.forEach(c=>{
      if(c.gelost)waar_geweest.push({t:c.gelost_op,datum:tijdTekst(c.gelost_op),actie:'gelost',locatie:(L.get(c.naar_locatie_id)||{}).name||'?',rit_id:c.rit_id||null,chauffeur:c.chauffeur||c.gelost_door||''});
      if(c.geladen)waar_geweest.push({t:c.geladen_op,datum:tijdTekst(c.geladen_op),actie:'geladen',locatie:(L.get(c.van_locatie_id)||{}).name||'?',rit_id:c.rit_id||null,chauffeur:c.chauffeur||c.geladen_door||''});
    });
    const laatste=waar_geweest[0];
    const terug=get(`SELECT t.*,r.chauffeur FROM transport_regels g JOIN transport_taken t ON t.id=g.taak_id LEFT JOIN transport_ritten r ON r.id=t.rit_id
      WHERE g.${veld}=? AND t.type='ophaling' AND t.status NOT IN ('gedaan','geannuleerd') ORDER BY t.datum,t.id`,[b.id]);
    const thuis=L.get(b.thuislocatie_id);
    const waar={nu_tekst:basis.waar_nu_tekst,nu_door:laatste?laatste.chauffeur:'',nu_op:laatste?laatste.datum:'',nu_rit_id:laatste?laatste.rit_id:null,
      terug_tekst:terug?`ophaling ${terug.datum?tijdTekst(terug.datum):'(nog geen datum)'}${terug.tijd&&terug.rit_id?' '+terug.tijd:''} · ${terug.rit_id?'rit #'+terug.rit_id+(terug.chauffeur?' '+terug.chauffeur:''):'nog geen rit'}`:'',
      thuis_tekst:thuis?[thuis.name,b.rek?'rek '+b.rek:'',b.plank?'plank '+b.plank:''].filter(Boolean).join(' · '):'—'};
    const tellingen=all(`SELECT * FROM nakijk_sessies WHERE ${sessieVeld[soort==='pool'?'vast':soort]}=? ORDER BY id DESC`,[b.id]).map(s=>{
      const st=stand(s,all('SELECT * FROM nakijk_regels WHERE sessie_id=?',[s.id]));
      return {sessie_id:s.id,datum:tijdTekst(s.kv_tijdstip||s.datum),kv:s.kv_wie||'',uitslag:st.tekst,kv_status:s.kv_status,kantoor_status:s.kantoor_status,locatie:(L.get(s.locatie_id)||{}).name||'',week:s.week};
    });
    // Historiek: wijzigingen op de bak en haar stukken + activiteitenlog dat de code noemt, nieuwste eerst.
    const itemIds=inhoud.map(i=>i.item_id);
    const hist=[];
    const veldTekst=(o,n)=>{try{o=JSON.parse(o||'{}');n=JSON.parse(n||'{}');}catch(e){return '';}
      return Object.keys(n).filter(k=>String(o[k]??'')!==String(n[k]??'')).map(k=>`${k}: ${o[k]||'—'} → ${n[k]||'—'}`).join(', ');};
    all(`SELECT * FROM wijzigingen WHERE (tabel=? AND rij_id=?)${itemIds.length?` OR (tabel='${itemTabel(soort)}' AND rij_id IN (${itemIds.map(()=>'?').join(',')}))`:''} ORDER BY id DESC LIMIT 100`,
      [isAttr?'attributen':'bakken',b.id,...itemIds]).filter(w=>w.actie!=='update'||veldTekst(w.oud,w.nieuw)).forEach(w=>hist.push({t:tijdTekst(w.tijdstip),wie:w.persoon_naam||'',
        wat:(/items$/.test(w.tabel)?'inhoud: ':'')+(w.actie==='insert'?'aangemaakt':w.actie==='delete'?'verwijderd':(veldTekst(w.oud,w.nieuw)||'gewijzigd'))+(w.context?` (${w.context})`:''),wijziging_id:w.id}));
    if(b.code)all("SELECT * FROM activiteiten_log WHERE beschrijving LIKE ? ORDER BY id DESC LIMIT 50",[`%(${b.code})%`]).forEach(a=>hist.push({t:tijdTekst(a.tijdstip),wie:'',wat:a.beschrijving,wijziging_id:null}));
    res.json({bak:{...basis,thuis_tekst:waar.thuis_tekst,notitie:b.notitie||''},inhoud,fotos,waar,waar_geweest,tellingen,historiek:hist});
  });

  // Verwijderen met controle; daarna de bestaande DELETE-route (zelfde opruimgedrag en log).
  function bestaandeRoute(methode,pad){
    const laag=(app._router?.stack||[]).find(l=>l.route&&l.route.path===pad&&l.route.methods[methode]);
    return laag?laag.route.stack[laag.route.stack.length-1].handle:null;
  }
  app.delete('/api/bakken-overzicht/:id',alleenKantoor,(req,res)=>{
    const isAttr=req.query.soort==='attribuut';
    const b=get(`SELECT * FROM ${isAttr?'attributen':'bakken'} WHERE id=?`,[req.params.id]);
    if(!b)return res.status(404).json({error:'Niet gevonden'});
    const soort=isAttr?'attribuut':b.soort==='thema'?'thema':'vast';
    const ow=onderweg(soort,b.id);
    if(ow)return res.status(409).json({error:`${b.code||b.naam} is onderweg op rit #${ow.rit_id} — verwijderen kan pas als hij gelost is`});
    const open=get(`SELECT id FROM nakijk_sessies WHERE ${sessieVeld[soort]}=? AND kv_status IN ('bezig','ingediend') AND COALESCE(kantoor_status,'open')<>'nagekeken'`,[b.id]);
    if(open)return res.status(409).json({error:`${b.code||b.naam} heeft nog een open telling — rond eerst de keuring af`});
    const h=bestaandeRoute('delete',isAttr?'/api/attributen/:id':'/api/bakken/:id');
    if(!h)return res.status(500).json({error:'Verwijderroute niet gevonden'});
    h(req,res,()=>{});
  });

  app.get('/bakken',(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','bakken.html')));
  app.get('/etiketten',(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','etiketten.html')));
};
