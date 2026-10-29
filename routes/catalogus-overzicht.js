// routes/catalogus-overzicht.js — MA2 punt 3: Materiaal › Catalogus op het standaardpagina-patroon (design/mockup-materiaal-rest.html).
// 3338 artikels → server-side zoeken, filteren en pagineren (200 per keer). Voorraad per stockage in twee aparte kolommen (Rozenweg, Kantoor).
// Schrijven (gelogd): bewerken, voorraad − / + en minimum, samenvoegen (één transactie), categorie wijzigen, verwijderen met controle (409 als in gebruik).
'use strict';
module.exports = function(ctx){
  const {app,db,get,all,run,insMetLog,updateMetLog,delMetLog,alleenKantoor,path,ROOT_DIR} = ctx;

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

  // "Mogelijk dubbel": zelfde naam na normaliseren (kleine letters, accenten weg, meervoud -s/-en weg).
  function norm(n){
    let s=String(n||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
    s=s.split(' ').map(w=>w.length>4&&/en$/.test(w)?w.slice(0,-2):w.length>3&&/s$/.test(w)?w.slice(0,-1):w).join(' ');
    return s;
  }
  const stockLoc=naam=>(get("SELECT id FROM locaties WHERE name=? AND type='stockage' AND (parent_id IS NULL OR parent_id=0) ORDER BY id LIMIT 1",[naam])||{}).id||null;
  const fmtN=n=>n==null?null:Math.round(n*100)/100;

  function bouwAlle(){
    const rozenweg=stockLoc('Rozenweg'),kantoor=stockLoc('Kantoor');
    const nBak={},nThemaMat={},stock={},minTekort={};
    all('SELECT item_type_id AS t,COUNT(DISTINCT bak_id) AS n FROM bak_items WHERE item_type_id IS NOT NULL GROUP BY item_type_id').forEach(r=>nBak[r.t]=r.n);
    all('SELECT item_type_id AS t,COUNT(*) AS n FROM thema_materiaal WHERE item_type_id IS NOT NULL GROUP BY item_type_id').forEach(r=>nThemaMat[r.t]=r.n);
    all('SELECT item_type_id AS t,locatie_id AS l,qty,minimum FROM item_type_stock').forEach(r=>{
      (stock[r.t]=stock[r.t]||{})[r.l]=r;
      if(r.minimum>0&&r.qty<r.minimum)minTekort[r.t]=Math.max(minTekort[r.t]||0,r.minimum);
    });
    const items=all('SELECT * FROM item_types ORDER BY naam COLLATE NOCASE');
    const groepen={};
    items.forEach(i=>{const k=norm(i.naam);(groepen[k]=groepen[k]||[]).push(i.id);});
    return items.map(i=>{
      const st=stock[i.id]||{},rw=st[rozenweg],kt=st[kantoor];
      const totaal=Object.values(st).reduce((s,r)=>s+(r.qty||0),0);
      const dubbel=(groepen[norm(i.naam)]||[]).length>1;
      const onderMin=!!minTekort[i.id];
      const ongebruikt=!(nBak[i.id]||0)&&!(nThemaMat[i.id]||0)&&totaal<=0;
      const status=onderMin?'onder_min':dubbel?'dubbel':ongebruikt?'ongebruikt':'ok';
      return {id:i.id,naam:i.naam,eenheid:i.eenheid||'stuk',categorie:i.categorie||'',n_bakken:nBak[i.id]||0,
        voorraad_rozenweg:rw?fmtN(rw.qty):null,voorraad_kantoor:kt?fmtN(kt.qty):null,minimum:onderMin?minTekort[i.id]:null,
        status,dubbel,onder_min:onderMin,ongebruikt,sport:i.categorie==='sport'};
    });
  }
  const CHIPS={alle:()=>true,materiaal:a=>!a.sport,sport:a=>a.sport,onder_min:a=>a.onder_min,dubbel:a=>a.dubbel,ongebruikt:a=>a.ongebruikt};

  app.get('/api/catalogus-overzicht',alleenKantoor,(req,res)=>{
    const alle=bouwAlle();
    const chip=CHIPS[req.query.chip]?req.query.chip:'alle';
    const zoek=String(req.query.zoek||'').trim().toLowerCase();
    const offset=Math.max(0,parseInt(req.query.offset)||0),limiet=Math.min(500,Math.max(1,parseInt(req.query.limiet)||200));
    const gefilterd=alle.filter(CHIPS[chip]).filter(a=>!zoek||a.naam.toLowerCase().includes(zoek)||a.categorie.toLowerCase().includes(zoek));
    const n=f=>alle.filter(f).length;
    res.json({tellers:{alle:alle.length,materiaal:n(CHIPS.materiaal),sport:n(CHIPS.sport),onder_min:n(CHIPS.onder_min),dubbel:n(CHIPS.dubbel),ongebruikt:n(CHIPS.ongebruikt)},
      totaal_gefilterd:gefilterd.length,offset,limiet,meer:offset+limiet<gefilterd.length,artikels:gefilterd.slice(offset,offset+limiet)});
  });

  app.get('/api/catalogus/:id/detail',alleenKantoor,(req,res)=>{
    const a=get('SELECT * FROM item_types WHERE id=?',[req.params.id]);
    if(!a)return res.status(404).json({error:'Artikel niet gevonden'});
    const per=periodeVan(req.query.periode_id);
    const gebruik=all(`SELECT bi.bak_id,bi.qty,b.code,b.naam FROM bak_items bi JOIN bakken b ON b.id=bi.bak_id WHERE bi.item_type_id=? ORDER BY b.code,b.id`,[a.id]).map(r=>({
      bak_id:r.bak_id,code:r.code||'',bak:r.naam||'',per_bak:r.qty,
      themas:all('SELECT t.name FROM thema_bak tb JOIN themas t ON t.id=tb.thema_id WHERE tb.bak_id=? ORDER BY t.name',[r.bak_id]).map(x=>x.name)}));
    const voorraad=['Rozenweg','Kantoor','Marko'].map(naam=>{
      const lid=stockLoc(naam),r=lid?get('SELECT * FROM item_type_stock WHERE item_type_id=? AND locatie_id=?',[a.id,lid]):null;
      return {locatie_id:lid,naam,qty:r?fmtN(r.qty):null,minimum:r&&r.minimum>0?fmtN(r.minimum):null};
    }).filter(v=>v.locatie_id);
    let nodig={bakken:0,locaties:0,stuks:0};
    if(per){
      const rijen=all(`SELECT DISTINCT km.id AS km,km.locatie_id,bi.bak_id,bi.qty FROM kampmomenten km JOIN kampmoment_themas kt ON kt.kampmoment_id=km.id
        JOIN thema_bak tb ON tb.thema_id=kt.thema_id JOIN bak_items bi ON bi.bak_id=tb.bak_id WHERE km.periode_id=? AND bi.item_type_id=?`,[per.id,a.id]);
      nodig={bakken:new Set(rijen.map(r=>r.bak_id)).size,locaties:new Set(rijen.map(r=>r.locatie_id)).size,stuks:Math.round(rijen.reduce((s,r)=>s+(r.qty||0),0))};
    }
    const tekorten=get(`SELECT COUNT(*) AS n FROM nakijk_regels WHERE item_naam=? AND COALESCE(tekort_status,'open') NOT IN ('aangevuld','genegeerd') AND aangetroffen<verwacht`,[a.naam]).n;
    const k=norm(a.naam);
    const dubbel=all('SELECT * FROM item_types WHERE id<>?',[a.id]).filter(x=>norm(x.naam)===k).map(x=>{
      const nb=get('SELECT COUNT(DISTINCT bak_id) AS n FROM bak_items WHERE item_type_id=?',[x.id]).n;
      const st=all('SELECT l.name,s.qty FROM item_type_stock s JOIN locaties l ON l.id=s.locatie_id WHERE s.item_type_id=? AND s.qty>0',[x.id]).map(s=>`${s.name} ${fmtN(s.qty)}`);
      return {id:x.id,naam:x.naam,n_bakken:nb,voorraad_tekst:st.join(' · ')};
    });
    const parse=s=>{try{return JSON.parse(s||'{}')||{};}catch(e){return {};}};
    const hist=[];
    all(`SELECT * FROM wijzigingen WHERE (tabel='item_types' AND rij_id=?) OR (tabel='item_type_stock' AND (nieuw LIKE ? OR oud LIKE ?)) ORDER BY id DESC LIMIT 100`,[a.id,`%"item_type_id":${a.id},%`,`%"item_type_id":${a.id},%`]).forEach(w=>{
      const o=parse(w.oud),n=parse(w.nieuw);let wat;
      if(w.tabel==='item_type_stock'){
        const l=get('SELECT name FROM locaties WHERE id=?',[(n.locatie_id||o.locatie_id)]);
        wat=`voorraad ${l?l.name:''}: ${o.qty??'—'} → ${n.qty??'—'}${n.minimum!==undefined&&n.minimum!==o.minimum?` · minimum ${o.minimum??'—'} → ${n.minimum}`:''}`;
      }else{
        const ks=Object.keys(n).filter(x=>String(o[x]??'')!==String(n[x]??''));
        if(w.actie==='update'&&!ks.length)return;
        wat=w.actie==='insert'?'aangemaakt':ks.map(x=>`${x}: ${o[x]||'—'} → ${n[x]||'—'}`).join(', ');
      }
      hist.push({t:tijdTekst(w.tijdstip),wie:w.persoon_naam||'',wat,wijziging_id:w.id,terugdraaibaar:false});
    });
    res.json({artikel:{id:a.id,naam:a.naam,eenheid:a.eenheid||'stuk',categorie:a.categorie||'',sport:a.categorie==='sport',notities:a.notities||''},
      gebruik,voorraad,periode:per?{id:per.id,naam:per.naam}:null,deze_periode:{...nodig,open_tekorten:tekorten,laatst_besteld:null},dubbel,historiek:hist});
  });

  app.put('/api/catalogus/:id',alleenKantoor,(req,res)=>{
    const a=get('SELECT * FROM item_types WHERE id=?',[req.params.id]);
    if(!a)return res.status(404).json({error:'Artikel niet gevonden'});
    const b=req.body||{};
    const naam=b.naam!==undefined?String(b.naam).trim():a.naam;
    if(!naam)return res.status(400).json({error:'Naam is verplicht'});
    updateMetLog(req,'item_types',a.id,{naam,eenheid:b.eenheid!==undefined?b.eenheid:a.eenheid,categorie:b.categorie!==undefined?b.categorie:a.categorie},'catalogus');
    res.json({ok:true,id:a.id});
  });

  // Voorraad − / + (delta) of vaste waarde (qty), en minimum. Eén rij per artikel en stockage.
  app.put('/api/catalogus/:id/voorraad',alleenKantoor,(req,res)=>{
    const a=get('SELECT * FROM item_types WHERE id=?',[req.params.id]);
    if(!a)return res.status(404).json({error:'Artikel niet gevonden'});
    const b=req.body||{};
    if(!b.locatie_id||!get("SELECT id FROM locaties WHERE id=? AND type='stockage'",[b.locatie_id]))return res.status(400).json({error:'locatie_id van een stockage is verplicht'});
    const r=get('SELECT * FROM item_type_stock WHERE item_type_id=? AND locatie_id=?',[a.id,b.locatie_id]);
    let qty=r?r.qty:0;
    if(b.qty!==undefined&&b.qty!==null)qty=Number(b.qty);
    else if(b.delta!==undefined)qty=qty+Number(b.delta);
    if(!isFinite(qty)||qty<0)return res.status(400).json({error:'De voorraad kan niet negatief zijn'});
    const minimum=b.minimum!==undefined&&b.minimum!==null?Math.max(0,Number(b.minimum)||0):(r?r.minimum:0);
    if(r)updateMetLog(req,'item_type_stock',r.id,{qty,minimum},'catalogus');
    else insMetLog(req,'item_type_stock',['item_type_id','locatie_id','qty','minimum'],[a.id,b.locatie_id,qty,minimum],'catalogus');
    res.json({ok:true,qty,minimum});
  });

  // Samenvoegen: alles van `van` wijst daarna naar `naar` (bak_items, voorraad opgeteld per stockage, thema_materiaal, transport_regels, sport_items); het artikel `van` verdwijnt.
  function voegSamen(req,vanId,naarId){
    const stappen={bak_items:0,voorraad:0,thema_materiaal:0,transport_regels:0,sport_items:0};
    stappen.bak_items=updateMetLog(req,'bak_items',{waar:'item_type_id=?',params:[vanId]},{item_type_id:naarId},'catalogus');
    all('SELECT * FROM item_type_stock WHERE item_type_id=?',[vanId]).forEach(r=>{
      const doel=get('SELECT * FROM item_type_stock WHERE item_type_id=? AND locatie_id=?',[naarId,r.locatie_id]);
      if(doel){updateMetLog(req,'item_type_stock',doel.id,{qty:(doel.qty||0)+(r.qty||0),minimum:Math.max(doel.minimum||0,r.minimum||0)},'catalogus');delMetLog(req,'item_type_stock',r.id,'catalogus');}
      else updateMetLog(req,'item_type_stock',r.id,{item_type_id:naarId},'catalogus');
      stappen.voorraad++;
    });
    stappen.thema_materiaal=updateMetLog(req,'thema_materiaal',{waar:'item_type_id=?',params:[vanId]},{item_type_id:naarId},'catalogus');
    stappen.transport_regels=updateMetLog(req,'transport_regels',{waar:'item_type_id=?',params:[vanId]},{item_type_id:naarId},'catalogus');
    stappen.sport_items=updateMetLog(req,'sport_items',{waar:'item_type_id=?',params:[vanId]},{item_type_id:naarId},'catalogus');
    delMetLog(req,'item_types',vanId,'catalogus');
    return stappen;
  }
  app.post('/api/catalogus/:id/samenvoegen',alleenKantoor,(req,res)=>{
    const van=get('SELECT * FROM item_types WHERE id=?',[req.params.id]);
    const naar=get('SELECT * FROM item_types WHERE id=?',[req.body&&req.body.naar_id]);
    if(!van||!naar)return res.status(404).json({error:'Artikel niet gevonden'});
    if(van.id===naar.id)return res.status(400).json({error:'Kies een ander artikel om mee samen te voegen'});
    let stappen;
    try{db.run('BEGIN');stappen=voegSamen(req,van.id,naar.id);db.run('COMMIT');}
    catch(e){try{db.run('ROLLBACK');}catch(x){}return res.status(500).json({error:'Samenvoegen mislukt: '+e.message});}
    res.json({ok:true,van:van.naam,naar:naar.naam,...stappen});
  });
  // Bulk samenvoegen (2+ geselecteerd): alles gaat naar `naar_id`.
  app.post('/api/catalogus-overzicht/samenvoegen',alleenKantoor,(req,res)=>{
    const ids=((req.body&&req.body.ids)||[]).map(Number).filter(Boolean),naar=Number(req.body&&req.body.naar_id);
    if(ids.length<2||!ids.includes(naar))return res.status(400).json({error:'Selecteer minstens 2 artikels en kies er één om in samen te voegen'});
    let n=0;
    try{db.run('BEGIN');ids.filter(i=>i!==naar).forEach(i=>{voegSamen(req,i,naar);n++;});db.run('COMMIT');}
    catch(e){try{db.run('ROLLBACK');}catch(x){}return res.status(500).json({error:'Samenvoegen mislukt: '+e.message});}
    res.json({ok:true,samengevoegd:n});
  });
  app.post('/api/catalogus-overzicht/categorie',alleenKantoor,(req,res)=>{
    const ids=((req.body&&req.body.ids)||[]).map(Number).filter(Boolean);
    if(!ids.length)return res.status(400).json({error:'Geen artikels gekozen'});
    ids.forEach(id=>updateMetLog(req,'item_types',id,{categorie:String(req.body.categorie||'')},'catalogus'));
    res.json({ok:true,aantal:ids.length});
  });
  app.delete('/api/catalogus-overzicht/:id',alleenKantoor,(req,res)=>{
    const a=get('SELECT * FROM item_types WHERE id=?',[req.params.id]);
    if(!a)return res.status(404).json({error:'Artikel niet gevonden'});
    const bakken=get('SELECT COUNT(DISTINCT bak_id) AS n FROM bak_items WHERE item_type_id=?',[a.id]).n;
    const thema=get('SELECT COUNT(*) AS n FROM thema_materiaal WHERE item_type_id=?',[a.id]).n;
    const voorraad=get('SELECT COALESCE(SUM(qty),0) AS n FROM item_type_stock WHERE item_type_id=?',[a.id]).n;
    if(bakken||thema||voorraad>0)return res.status(409).json({error:`"${a.naam}" is in gebruik (${bakken} bak${bakken===1?'':'ken'}${thema?`, ${thema} themaregel${thema===1?'':'s'}`:''}${voorraad>0?`, voorraad ${fmtN(voorraad)}`:''}) en kan niet verwijderd worden. Voeg het samen met een ander artikel.`});
    delMetLog(req,'item_type_stock',{waar:'item_type_id=?',params:[a.id]},'catalogus');
    delMetLog(req,'item_types',a.id,'catalogus');
    res.json({ok:true});
  });

  app.get('/catalogus',(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','catalogus.html')));
};
