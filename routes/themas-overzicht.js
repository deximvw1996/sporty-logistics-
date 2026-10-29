// routes/themas-overzicht.js — MA2 punt 1: Materiaal › Thema's op het standaardpagina-patroon (design/mockup-materiaal-rest.html).
// Lezen: GET /api/themas-overzicht (lijst + tellers) en GET /api/themas/:id/detail. Schrijven (alles gelogd via insMetLog/updateMetLog/delMetLog):
// bewerken, dupliceren, bak/attribuut koppelen en ontkoppelen, los materiaal, verwijderen (409 als het thema aan een kampmoment hangt).
// Data en weergave zijn gescheiden (MOBIEL-REGEL): de pagina public/themas.js bouwt enkel HTML uit deze JSON.
'use strict';
module.exports = function(ctx){
  const {app,get,all,insMetLog,updateMetLog,delMetLog,alleenKantoor,path,ROOT_DIR} = ctx;

  const DAG=['zo','ma','di','wo','do','vr','za'],MND=['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
  function alsDatum(s){
    let m=/(\d{1,2})\/(\d{1,2})\/(\d{4})\D+(\d{1,2}):(\d{2})/.exec(s||'');
    if(m)return new Date(+m[3],+m[2]-1,+m[1],+m[4],+m[5]);
    if(/^\d{4}-\d{2}-\d{2}T/.test(s||''))return new Date(s);
    m=/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/.exec(s||'');
    return m?new Date(+m[1],+m[2]-1,+m[3],+(m[4]||0),+(m[5]||0)):null;
  }
  const tijdTekst=s=>{const d=alsDatum(s);return d&&!isNaN(d)?`${DAG[d.getDay()]} ${d.getDate()} ${MND[d.getMonth()]} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`:(s||'');};
  const periodeVan=id=>(id&&get('SELECT * FROM vakantieperiodes WHERE id=?',[id]))||get('SELECT * FROM vakantieperiodes WHERE actief=1')||get('SELECT * FROM vakantieperiodes ORDER BY id DESC LIMIT 1');
  const SOORT_TXT={eigen_materiaal:'eigen materiaal (bakken van dit thema)',eigen_standaard:'standaardmateriaal',eigen:'eigen materiaal'};
  const KLEUREN={'#1D9E75':'groen','#378ADD':'blauw','#E8A33D':'geel','#8E44AD':'paars','#D85A30':'oranje','#C0392B':'rood','#2563EB':'blauw'};
  const soortTekst=t=>`${t.categorie==='themadag'?'themadag':t.categorie||'kamp'} · ${t.leeftijdsgroep||'alle leeftijden'}${t.heeft_kookactiviteit?' · 🍳':''}`;

  function kmsVan(themaId,per){
    if(!per)return [];
    return all(`SELECT km.id,km.week,l.name AS loc FROM kampmoment_themas kt JOIN kampmomenten km ON km.id=kt.kampmoment_id JOIN locaties l ON l.id=km.locatie_id
      WHERE kt.thema_id=? AND km.periode_id=? ORDER BY km.week,l.name`,[themaId,per.id]);
  }

  app.get('/api/themas-overzicht',alleenKantoor,(req,res)=>{
    const per=periodeVan(req.query.periode_id);
    const nb={},na={},nl={};
    all("SELECT tb.thema_id AS t,COUNT(*) AS n FROM thema_bak tb JOIN bakken b ON b.id=tb.bak_id WHERE b.soort='thema' GROUP BY tb.thema_id").forEach(r=>nb[r.t]=r.n);
    all('SELECT ta.thema_id AS t,COUNT(*) AS n FROM thema_attribuut ta JOIN attributen a ON a.id=ta.attribuut_id GROUP BY ta.thema_id').forEach(r=>na[r.t]=r.n);
    all('SELECT thema_id AS t,COUNT(*) AS n FROM thema_materiaal GROUP BY thema_id').forEach(r=>nl[r.t]=r.n);
    const gepland={};
    if(per)all(`SELECT kt.thema_id AS t,km.week,l.name AS loc FROM kampmoment_themas kt JOIN kampmomenten km ON km.id=kt.kampmoment_id JOIN locaties l ON l.id=km.locatie_id
      WHERE km.periode_id=? ORDER BY km.week,l.name`,[per.id]).forEach(r=>{(gepland[r.t]=gepland[r.t]||[]).push(`wk ${r.week} ${r.loc}`);});
    const themas=all('SELECT * FROM themas ORDER BY name COLLATE NOCASE').map(t=>{
      const b=nb[t.id]||0,a=na[t.id]||0,l=nl[t.id]||0,g=gepland[t.id]||[];
      const aandacht=[];
      if(!b&&!a)aandacht.push(g.length?'gepland zonder bakken':'geen bakken');
      else if(b===1&&!a)aandacht.push('1 bak');
      const inhoud=[b?`${b} bak${b===1?'':'ken'}`:'',a?`${a} attr.`:'',l?`${l} los`:''].filter(Boolean).join(' · ')||'geen bakken';
      return {id:t.id,naam:t.name,kleur:t.color||'#1D9E75',categorie:t.categorie||'',leeftijdsgroep:t.leeftijdsgroep||'',kook:!!t.heeft_kookactiviteit,soort_tekst:soortTekst(t),
        n_bakken:b,n_attributen:a,n_los:l,inhoud_tekst:inhoud,periode_tekst:g.length?g.join(' · '):'—',gepland:g.length>0,
        status:aandacht.length?'let':'ok',leeg:!b&&!a,aandacht,zoek:[t.name,t.categorie,t.leeftijdsgroep].join(' ').toLowerCase()};
    });
    // Zoeken op bak of attribuut: de naam/code van een bak of attribuut van dit thema telt ook mee.
    const zoekBak={};
    all("SELECT tb.thema_id AS t,b.naam,b.code FROM thema_bak tb JOIN bakken b ON b.id=tb.bak_id WHERE b.soort='thema'").forEach(r=>{(zoekBak[r.t]=zoekBak[r.t]||[]).push(r.naam,r.code);});
    all('SELECT ta.thema_id AS t,a.naam,a.code FROM thema_attribuut ta JOIN attributen a ON a.id=ta.attribuut_id').forEach(r=>{(zoekBak[r.t]=zoekBak[r.t]||[]).push(r.naam,r.code);});
    themas.forEach(t=>{t.zoek+=' '+(zoekBak[t.id]||[]).join(' ').toLowerCase();});
    const n=f=>themas.filter(f).length;
    res.json({periode:per?{id:per.id,naam:per.naam}:null,
      tellers:{alle:themas.length,kamp:n(t=>t.categorie==='kamp'),themadag:n(t=>t.categorie==='themadag'),kleuters:n(t=>t.leeftijdsgroep==='kleuters'),lager:n(t=>t.leeftijdsgroep==='lagere school'),
        deze_periode:n(t=>t.gepland),leeg:n(t=>t.leeg)},themas});
  });

  // Zoek bakken om aan een thema te koppelen (thema-bakken, op naam of code).
  app.get('/api/bakken-zoek',alleenKantoor,(req,res)=>{
    const q=String(req.query.q||'').trim().toLowerCase();
    const bakken=all("SELECT id,naam,code FROM bakken WHERE soort='thema' ORDER BY code,naam").filter(b=>!q||(b.naam+' '+b.code).toLowerCase().includes(q)).slice(0,30);
    const attr=all('SELECT id,naam,code FROM attributen ORDER BY code,naam').filter(a=>!q||(a.naam+' '+a.code).toLowerCase().includes(q)).slice(0,30);
    res.json({bakken,attributen:attr});
  });

  app.get('/api/themas/:id/detail',alleenKantoor,(req,res)=>{
    const t=get('SELECT * FROM themas WHERE id=?',[req.params.id]);
    if(!t)return res.status(404).json({error:'Thema niet gevonden'});
    const locNaam=id=>id?((get('SELECT name FROM locaties WHERE id=?',[id])||{}).name||''):'';
    const bakken=all(`SELECT b.* FROM bakken b JOIN thema_bak tb ON tb.bak_id=b.id WHERE tb.thema_id=? AND b.soort='thema' ORDER BY b.volgorde,b.code,b.id`,[t.id]).map(b=>{
      const n=(get('SELECT COALESCE(SUM(qty),0) AS n FROM bak_items WHERE bak_id=?',[b.id])||{}).n||0;
      return {id:b.id,code:b.code||'',naam:b.naam||'',n_stuks:Math.round(n),waar:[locNaam(b.huidige_locatie_id||b.thuislocatie_id),b.status==='op_locatie'?'op locatie':''].filter(Boolean).join(' · ')};
    });
    const attributen=all(`SELECT a.* FROM attributen a JOIN thema_attribuut ta ON ta.attribuut_id=a.id WHERE ta.thema_id=? ORDER BY a.code,a.id`,[t.id]).map(a=>({
      id:a.id,code:a.code||'',naam:a.naam||'',waar:`${a.status==='op_locatie'?'op locatie':'thuis'} · ${locNaam(a.status==='op_locatie'?a.huidige_locatie_id:a.thuislocatie_id)||'—'}`}));
    const los=all('SELECT * FROM thema_materiaal WHERE thema_id=? ORDER BY sort_order,id',[t.id]).map(m=>({id:m.id,naam:m.name,qty:m.qty,verbruik:!!m.is_verbruik}));
    const kampmomenten=all(`SELECT km.id,km.week,l.name AS loc,v.naam AS periode,v.start_datum,p.naam AS kv_naam FROM kampmoment_themas kt JOIN kampmomenten km ON km.id=kt.kampmoment_id
      JOIN locaties l ON l.id=km.locatie_id LEFT JOIN vakantieperiodes v ON v.id=km.periode_id LEFT JOIN personeel p ON p.id=km.kv_persoon_id WHERE kt.thema_id=? ORDER BY v.start_datum DESC,km.week DESC`,[t.id])
      .map(k=>({kampmoment_id:k.id,week:k.week,locatie:k.loc,periode:k.periode||'',kv_naam:k.kv_naam||''}));
    // Historiek: het thema zelf en zijn koppelingen (bak, attribuut, los materiaal).
    const parse=s=>{try{return JSON.parse(s||'{}')||{};}catch(e){return {};}};
    const hist=[];
    all(`SELECT * FROM wijzigingen WHERE (tabel='themas' AND rij_id=?) OR (tabel IN ('thema_bak','thema_attribuut','thema_materiaal') AND (nieuw LIKE ? OR oud LIKE ?)) ORDER BY id DESC LIMIT 100`,
      [t.id,`%"thema_id":${t.id},%`,`%"thema_id":${t.id},%`]).forEach(w=>{
      const o=parse(w.oud),n=parse(w.nieuw),bron=w.actie==='delete'?o:n;
      let wat;
      if(w.tabel==='thema_bak'||w.tabel==='thema_attribuut'){
        const rec=w.tabel==='thema_bak'?get('SELECT naam,code FROM bakken WHERE id=?',[bron.bak_id]):get('SELECT naam,code FROM attributen WHERE id=?',[bron.attribuut_id]);
        wat=`${w.tabel==='thema_bak'?'bak':'attribuut'} ${rec?(rec.code?rec.code+' ':'')+rec.naam:'#'+(bron.bak_id||bron.attribuut_id)} ${w.actie==='delete'?'ontkoppeld':'gekoppeld'}`;
      }else if(w.tabel==='thema_materiaal'){
        wat=`los materiaal "${bron.name||''}" ${w.actie==='delete'?'verwijderd':w.actie==='insert'?'toegevoegd':'gewijzigd'}`;
      }else{
        const k=Object.keys(n).filter(x=>String(o[x]??'')!==String(n[x]??''));
        if(w.actie==='update'&&!k.length)return;
        wat=w.actie==='insert'?'aangemaakt':k.map(x=>`${x==='name'?'naam':x}: ${o[x]===undefined||o[x]===''?'—':o[x]} → ${n[x]===undefined||n[x]===''?'—':n[x]}`).join(', ');
      }
      hist.push({t:tijdTekst(w.tijdstip),wie:w.persoon_naam||'',wat,wijziging_id:w.id,terugdraaibaar:false});
    });
    res.json({thema:{id:t.id,naam:t.name,kleur:t.color||'#1D9E75',kleur_naam:KLEUREN[(t.color||'').toUpperCase()]||'',categorie:t.categorie||'',leeftijdsgroep:t.leeftijdsgroep||'',
        thema_type:t.thema_type||'eigen_materiaal',materiaal_tekst:SOORT_TXT[t.thema_type]||t.thema_type||'',kook:!!t.heeft_kookactiviteit,soort_tekst:soortTekst(t)},
      bakken,attributen,los,kampmomenten,historiek:hist});
  });

  app.put('/api/themas-overzicht/:id',alleenKantoor,(req,res)=>{
    const t=get('SELECT * FROM themas WHERE id=?',[req.params.id]);
    if(!t)return res.status(404).json({error:'Thema niet gevonden'});
    const b=req.body||{};
    const naam=b.name!==undefined?String(b.name).trim():t.name;
    if(!naam)return res.status(400).json({error:'Naam is verplicht'});
    updateMetLog(req,'themas',t.id,{name:naam,color:b.color||t.color,categorie:b.categorie!==undefined?b.categorie:t.categorie,
      leeftijdsgroep:b.leeftijdsgroep!==undefined?b.leeftijdsgroep:t.leeftijdsgroep,thema_type:b.thema_type||t.thema_type,
      heeft_kookactiviteit:b.heeft_kookactiviteit!==undefined?(b.heeft_kookactiviteit?1:0):t.heeft_kookactiviteit},'themas');
    res.json({ok:true,id:t.id});
  });

  app.post('/api/themas-overzicht/:id/dupliceer',alleenKantoor,(req,res)=>{
    const t=get('SELECT * FROM themas WHERE id=?',[req.params.id]);
    if(!t)return res.status(404).json({error:'Thema niet gevonden'});
    const naam=String(req.body&&req.body.naam||'').trim()||`${t.name} (kopie)`;
    const id=insMetLog(req,'themas',['name','color','categorie','leeftijdsgroep','thema_type','heeft_kookactiviteit'],[naam,t.color,t.categorie,t.leeftijdsgroep,t.thema_type,t.heeft_kookactiviteit],'themas');
    all('SELECT bak_id FROM thema_bak WHERE thema_id=?',[t.id]).forEach(r=>insMetLog(req,'thema_bak',['thema_id','bak_id'],[id,r.bak_id],'themas'));
    all('SELECT attribuut_id FROM thema_attribuut WHERE thema_id=?',[t.id]).forEach(r=>insMetLog(req,'thema_attribuut',['thema_id','attribuut_id'],[id,r.attribuut_id],'themas'));
    all('SELECT * FROM thema_materiaal WHERE thema_id=?',[t.id]).forEach(m=>insMetLog(req,'thema_materiaal',['thema_id','name','qty','stockage_locatie_id','stockage_code','sort_order','is_verbruik','item_type_id'],
      [id,m.name,m.qty,m.stockage_locatie_id,m.stockage_code,m.sort_order,m.is_verbruik,m.item_type_id],'themas'));
    all('SELECT * FROM thema_behoefte WHERE thema_id=?',[t.id]).forEach(m=>insMetLog(req,'thema_behoefte',['thema_id','vast_type','aantal','notitie','bak_id'],[id,m.vast_type,m.aantal,m.notitie,m.bak_id],'themas'));
    res.json({ok:true,id,naam});
  });

  // Verwijderen met controle: een thema dat aan een kampmoment hangt blijft staan.
  app.delete('/api/themas-overzicht/:id',alleenKantoor,(req,res)=>{
    const t=get('SELECT * FROM themas WHERE id=?',[req.params.id]);
    if(!t)return res.status(404).json({error:'Thema niet gevonden'});
    const n=get('SELECT COUNT(*) AS n FROM kampmoment_themas WHERE thema_id=?',[t.id]).n;
    if(n)return res.status(409).json({error:`"${t.name}" hangt aan ${n} kampmoment${n===1?'':'en'} en kan niet verwijderd worden. Haal het thema eerst uit de planning.`});
    delMetLog(req,'thema_bak',{waar:'thema_id=?',params:[t.id]},'themas');
    delMetLog(req,'thema_attribuut',{waar:'thema_id=?',params:[t.id]},'themas');
    delMetLog(req,'thema_materiaal',{waar:'thema_id=?',params:[t.id]},'themas');
    delMetLog(req,'thema_behoefte',{waar:'thema_id=?',params:[t.id]},'themas');
    delMetLog(req,'thema_bundels',{waar:'thema_id=?',params:[t.id]},'themas');
    delMetLog(req,'themas',t.id,'themas');
    res.json({ok:true});
  });

  // Koppelen / ontkoppelen (de bak of het attribuut zelf blijft bestaan).
  app.post('/api/themas-overzicht/:id/koppel',alleenKantoor,(req,res)=>{
    const t=get('SELECT id FROM themas WHERE id=?',[req.params.id]);
    if(!t)return res.status(404).json({error:'Thema niet gevonden'});
    const {bak_id,attribuut_id}=req.body||{};
    if(bak_id){
      if(!get('SELECT id FROM bakken WHERE id=?',[bak_id]))return res.status(404).json({error:'Bak niet gevonden'});
      if(!get('SELECT id FROM thema_bak WHERE thema_id=? AND bak_id=?',[t.id,bak_id]))insMetLog(req,'thema_bak',['thema_id','bak_id'],[t.id,bak_id],'themas');
      return res.json({ok:true});
    }
    if(attribuut_id){
      if(!get('SELECT id FROM attributen WHERE id=?',[attribuut_id]))return res.status(404).json({error:'Attribuut niet gevonden'});
      if(!get('SELECT id FROM thema_attribuut WHERE thema_id=? AND attribuut_id=?',[t.id,attribuut_id]))insMetLog(req,'thema_attribuut',['thema_id','attribuut_id'],[t.id,attribuut_id],'themas');
      return res.json({ok:true});
    }
    res.status(400).json({error:'bak_id of attribuut_id is verplicht'});
  });
  app.delete('/api/themas-overzicht/:id/koppel/:soort/:ref',alleenKantoor,(req,res)=>{
    const tabel=req.params.soort==='attribuut'?'thema_attribuut':req.params.soort==='bak'?'thema_bak':null;
    if(!tabel)return res.status(400).json({error:'soort moet bak of attribuut zijn'});
    const kol=tabel==='thema_bak'?'bak_id':'attribuut_id';
    const n=delMetLog(req,tabel,{waar:`thema_id=? AND ${kol}=?`,params:[req.params.id,req.params.ref]},'themas');
    if(!n)return res.status(404).json({error:'Die koppeling bestaat niet (meer)'});
    res.json({ok:true});
  });
  app.post('/api/themas-overzicht/:id/los',alleenKantoor,(req,res)=>{
    const t=get('SELECT id FROM themas WHERE id=?',[req.params.id]);
    if(!t)return res.status(404).json({error:'Thema niet gevonden'});
    const naam=String(req.body&&req.body.naam||'').trim();
    if(!naam)return res.status(400).json({error:'Naam is verplicht'});
    const qty=Math.max(1,parseInt(req.body.qty)||1);
    const id=insMetLog(req,'thema_materiaal',['thema_id','name','qty','is_verbruik','item_type_id'],[t.id,naam,qty,req.body.verbruik?1:0,ctx.resolveItemTypeId?ctx.resolveItemTypeId(naam):null],'themas');
    res.json({ok:true,id});
  });
  app.delete('/api/themas-overzicht/:id/los/:mid',alleenKantoor,(req,res)=>{
    const n=delMetLog(req,'thema_materiaal',{waar:'id=? AND thema_id=?',params:[req.params.mid,req.params.id]},'themas');
    if(!n)return res.status(404).json({error:'Die regel bestaat niet (meer)'});
    res.json({ok:true});
  });

  app.get('/themas',(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','themas.html')));
};
