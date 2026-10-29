// routes/pool-overzicht.js — MA2 punt 2: Materiaal › Pool op het standaardpagina-patroon (design/mockup-materiaal-rest.html).
// Poolstuk = vast materiaal dat tussen Rozenweg en de kampen rondreist: per aantal (bulk, spreiding in bulk_spreiding), per stuk (de vaste bakken
// van één vast_type samen) of een sportpakket (sport_items met genummerde sets, per week ingepland in sport_planning).
// Vaste uitrusting per locatie loopt via de locatieconfiguratie (locatie_config) en wordt hier enkel meegeteld als "nodig".
'use strict';
module.exports = function(ctx){
  const {app,get,all,updateMetLog,delMetLog,alleenKantoor,logAct,path,ROOT_DIR} = ctx;
  const bulk=require('../lib/bulk')(ctx);

  const DAG=['zo','ma','di','wo','do','vr','za'],MND=['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
  function alsDatum(s){
    let m=/(\d{1,2})\/(\d{1,2})\/(\d{4})\D+(\d{1,2}):(\d{2})/.exec(s||'');
    if(m)return new Date(+m[3],+m[2]-1,+m[1],+m[4],+m[5]);
    if(/^\d{4}-\d{2}-\d{2}T/.test(s||''))return new Date(s);
    m=/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/.exec(s||'');
    return m?new Date(+m[1],+m[2]-1,+m[3],+(m[4]||0),+(m[5]||0)):null;
  }
  const dagTekst=s=>{const d=alsDatum(s);return d&&!isNaN(d)?`${DAG[d.getDay()]} ${d.getDate()} ${MND[d.getMonth()]}`:'';};
  const tijdTekst=s=>{const d=alsDatum(s);return d&&!isNaN(d)?`${dagTekst(s)} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`:(s||'');};
  const periodeVan=id=>(id&&get('SELECT * FROM vakantieperiodes WHERE id=?',[id]))||get('SELECT * FROM vakantieperiodes WHERE actief=1')||get('SELECT * FROM vakantieperiodes ORDER BY id DESC LIMIT 1');
  const locNaam=id=>id?((get('SELECT name FROM locaties WHERE id=?',[id])||{}).name||('locatie #'+id)):'—';
  const teksten=m=>Object.entries(m).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1]).map(([l,n])=>`${l} ${n}`).join(' · ');

  // Behoefte per week uit thema_behoefte (via de thema's op de kampmomenten) en locatie_config (conditie "altijd").
  function behoefteRijen(per,match){
    if(!per)return null;
    const rijen=[];let gezien=false;
    const km=all(`SELECT km.id,km.week,km.locatie_id,l.name AS loc,p.naam AS kv FROM kampmomenten km JOIN locaties l ON l.id=km.locatie_id LEFT JOIN personeel p ON p.id=km.kv_persoon_id
      WHERE km.periode_id=? ORDER BY km.week,l.name`,[per.id]);
    all('SELECT vast_type,bak_id FROM thema_behoefte').concat(all('SELECT vast_type,NULL AS bak_id FROM locatie_config')).forEach(r=>{if(match(r))gezien=true;});
    if(!gezien)return null;
    km.forEach(k=>{
      all(`SELECT t.name,tb.vast_type,tb.bak_id,tb.aantal FROM kampmoment_themas kt JOIN thema_behoefte tb ON tb.thema_id=kt.thema_id JOIN themas t ON t.id=kt.thema_id WHERE kt.kampmoment_id=?`,[k.id])
        .filter(match).forEach(r=>rijen.push({week:k.week,locatie:k.loc,kv:k.kv||'',bron:r.name,aantal:r.aantal||0,kampmoment_id:k.id}));
      all(`SELECT vast_type,aantal,conditie_type FROM locatie_config WHERE kamplocatie_id=? AND conditie_type='altijd'`,[k.locatie_id])
        .filter(r=>match({...r,bak_id:null})).forEach(r=>rijen.push({week:k.week,locatie:k.loc,kv:k.kv||'',bron:'vaste uitrusting',aantal:r.aantal||0,kampmoment_id:k.id}));
    });
    return rijen;
  }
  const maxPerWeek=rijen=>{const w={};rijen.forEach(r=>{w[r.week]=(w[r.week]||0)+r.aantal;});return Math.max(0,...Object.values(w));};

  // ── alle poolstukken opbouwen ──
  function bouw(per){
    const stukken=[];
    const vast=all("SELECT * FROM bakken WHERE soort='vast' ORDER BY naam COLLATE NOCASE,id");
    const spreid={};all('SELECT bs.bak_id,bs.aantal,l.name FROM bulk_spreiding bs JOIN locaties l ON l.id=bs.locatie_id WHERE bs.aantal>0').forEach(r=>{(spreid[r.bak_id]=spreid[r.bak_id]||{})[r.name]=r.aantal;});
    const groepen={};
    vast.forEach(b=>{
      if(b.is_bulk){
        const sp=spreid[b.id]||{[locNaam(b.thuislocatie_id)]:b.aantal};
        const op=Object.keys(sp).some(n=>n!==locNaam(b.thuislocatie_id));
        const rijen=behoefteRijen(per,r=>r.bak_id?r.bak_id===b.id:(b.vast_type&&r.vast_type===b.vast_type));
        stukken.push(maak('vast',b.id,b.naam,b.vast_type||'bulk','aantal',b.aantal,teksten(sp),op,rijen));
      }else{
        const k=b.vast_type||('bak'+b.id);(groepen[k]=groepen[k]||[]).push(b);
      }
    });
    Object.entries(groepen).forEach(([k,bs])=>{
      const w={};bs.forEach(b=>{const n=locNaam(b.huidige_locatie_id||b.thuislocatie_id);w[n]=(w[n]||0)+1;});
      const op=bs.some(b=>b.status==='op_locatie');
      const rijen=behoefteRijen(per,r=>!r.bak_id&&bs[0].vast_type&&r.vast_type===bs[0].vast_type);
      const naam=bs.length===1?bs[0].naam:(bs[0].vast_type?bs[0].vast_type.replace(/_/g,' ').replace(/^./,c=>c.toUpperCase()):bs[0].naam);
      stukken.push(maak('vast',bs[0].id,naam,bs[0].vast_type||'vast','stuk',bs.length,teksten(w),op,rijen));
    });
    // Sport: per pakket het aantal sets, nodig = max sets tegelijk in één week.
    const sets=all('SELECT ss.*,si.name AS item FROM sport_sets ss JOIN sport_items si ON si.id=ss.item_id');
    const perItem={};sets.forEach(s=>{(perItem[s.item_id]=perItem[s.item_id]||[]).push(s);});
    all('SELECT * FROM sport_items ORDER BY name COLLATE NOCASE').forEach(it=>{
      const ss=perItem[it.id]||[];
      const w={};ss.forEach(s=>{const n=locNaam(s.locatie_id);w[n]=(w[n]||0)+1;});
      let nodig=null;
      if(per){
        const pl=all(`SELECT sp.week,COUNT(*) AS n FROM sport_planning sp JOIN sport_sets s ON s.id=sp.set_id WHERE s.item_id=? AND sp.periode_id=? GROUP BY sp.week`,[it.id,per.id]);
        nodig=pl.length?Math.max(...pl.map(r=>r.n)):0;
      }
      const p=maak('sport',it.id,it.name,'sportpakket','sport',ss.length,teksten(w),false,null);
      if(nodig!=null){p.nodig=nodig;p.nodig_tekst=nodig?`${nodig}`:'—';p.tekort=Math.max(0,nodig-ss.length);p.status=p.tekort?'let':'ok';}
      stukken.push(p);
    });
    return stukken;
  }
  function maak(soort,id,naam,type,mode,totaal,waar,opLocatie,rijen){
    const nodig=rijen?maxPerWeek(rijen):null;
    const tekort=nodig!=null&&nodig>totaal?nodig-totaal:0;
    const locs=rijen?new Set(rijen.map(r=>r.locatie)).size:0;
    return {soort,id,naam,type,mode,totaal,waar_tekst:waar||'—',op_locatie:!!opLocatie,nodig,nodig_tekst:nodig==null?'—':(locs>1?`${nodig} (${locs} locaties)`:`${nodig}`),
      tekort,status:tekort?'let':'ok',zoek:[naam,type,waar].join(' ').toLowerCase()};
  }

  app.get('/api/pool-overzicht',alleenKantoor,(req,res)=>{
    const per=periodeVan(req.query.periode_id);
    const stukken=bouw(per);
    const n=f=>stukken.filter(f).length;
    res.json({periode:per?{id:per.id,naam:per.naam}:null,
      tellers:{alle:stukken.length,per_aantal:n(s=>s.mode==='aantal'),per_stuk:n(s=>s.mode==='stuk'),sport:n(s=>s.mode==='sport'),op_locatie:n(s=>s.op_locatie),te_weinig:n(s=>s.tekort>0)},stukken});
  });

  function groepVan(soort,id){
    if(soort==='sport'){const it=get('SELECT * FROM sport_items WHERE id=?',[id]);return it?{soort,item:it}:null;}
    const b=get("SELECT * FROM bakken WHERE id=? AND soort='vast'",[id]);
    if(!b)return null;
    const bakken=b.is_bulk||!b.vast_type?[b]:all("SELECT * FROM bakken WHERE soort='vast' AND vast_type=? AND is_bulk=0 ORDER BY id",[b.vast_type]);
    return {soort,bak:b,bakken};
  }

  app.get('/api/pool/:soort/:id/detail',alleenKantoor,(req,res)=>{
    const g=groepVan(req.params.soort,req.params.id);
    if(!g)return res.status(404).json({error:'Poolstuk niet gevonden'});
    const per=periodeVan(req.query.periode_id);
    const stuk=bouw(per).find(s=>s.soort===g.soort&&s.id===Number(req.params.id));
    const parse=s=>{try{return JSON.parse(s||'{}')||{};}catch(e){return {};}};
    // Levering/ophaling per locatie voor de zin "geleverd … · ophaling …".
    const stand=locId=>{
      const k=per?get('SELECT id FROM kampmomenten WHERE locatie_id=? AND periode_id=? ORDER BY week LIMIT 1',[locId,per.id]):null;
      if(!k)return '';
      const t=type=>{const x=get(`SELECT datum FROM transport_taken WHERE kampmoment_id=? AND type=? AND status<>'geannuleerd' ORDER BY datum LIMIT 1`,[k.id,type]);return x&&x.datum?dagTekst(x.datum):'';};
      return [t('levering')?'geleverd '+t('levering'):'',t('ophaling')?'ophaling '+t('ophaling'):''].filter(Boolean).join(' · ');
    };
    let spreiding=[],sets=[],gegevens=[],fotos=[],histWhere,histParams;
    if(g.soort==='vast'){
      const b=g.bak,thuis=locNaam(b.thuislocatie_id);
      if(b.is_bulk){
        spreiding=all('SELECT locatie_id,aantal FROM bulk_spreiding WHERE bak_id=? AND aantal>0 ORDER BY aantal DESC,locatie_id',[b.id]).map(r=>({locatie_id:r.locatie_id,naam:locNaam(r.locatie_id),aantal:r.aantal,sub:r.locatie_id===b.thuislocatie_id?'thuis':stand(r.locatie_id)||'op locatie'}));
      }else{
        const w={};g.bakken.forEach(x=>{const l=x.huidige_locatie_id||x.thuislocatie_id;w[l]=(w[l]||0)+1;});
        spreiding=Object.entries(w).map(([l,n])=>({locatie_id:+l,naam:locNaam(+l),aantal:n,sub:+l===b.thuislocatie_id?'thuis':stand(+l)||'op locatie'}));
      }
      gegevens=[['Type',`${b.vast_type||'—'} · ${b.is_bulk?'per aantal (bulk)':'per stuk'}`],['Thuis',thuis],['Notitie',b.notitie||'—']];
      fotos=[['opgeplooid',b.foto_opgeplooid_path],['opgezet',b.foto_opgezet_path]].filter(f=>f[1]).map(f=>({label:f[0],url:'/uploads/'+f[1]}));
      const ids=g.bakken.map(x=>x.id);
      histWhere=`(tabel='bakken' AND rij_id IN (${ids.map(()=>'?').join(',')})) OR (tabel='bulk_spreiding' AND (${ids.map(()=>'nieuw LIKE ?').join(' OR ')}))`;
      histParams=[...ids,...ids.map(i=>`%"bak_id":${i},%`)];
    }else{
      const it=g.item;
      sets=all('SELECT * FROM sport_sets WHERE item_id=? ORDER BY label',[it.id]).map(s=>{
        const weken=per?all(`SELECT sp.week,sp.locatie_id FROM sport_planning sp WHERE sp.set_id=? AND sp.periode_id=? ORDER BY sp.week`,[s.id,per.id]):[];
        return {set_id:s.id,label:s.label,locatie:locNaam(s.locatie_id),
          weken:weken.map(w=>{const k=get('SELECT id FROM kampmomenten WHERE locatie_id=? AND week=? AND periode_id=?',[w.locatie_id,w.week,per.id]);return {week:w.week,locatie:locNaam(w.locatie_id),kampmoment_id:k?k.id:null};})};
      });
      const w={};sets.forEach(s=>{w[s.locatie]=(w[s.locatie]||0)+1;});
      spreiding=Object.entries(w).map(([n,a])=>({locatie_id:null,naam:n,aantal:a,sub:'thuis'}));
      gegevens=[['Type','sportpakket (genummerde sets)'],['Notitie',it.notities||'—']];
      fotos=it.foto_path?[{label:'foto',url:'/uploads/'+it.foto_path}]:[];
      histWhere="(tabel='sport_items' AND rij_id=?) OR (tabel='sport_sets' AND nieuw LIKE ?)";histParams=[it.id,`%"item_id":${it.id},%`];
    }
    // Nodig deze periode, per week/locatie.
    let nodigRijen=[];
    if(g.soort==='vast'){
      const b=g.bak;
      nodigRijen=behoefteRijen(per,r=>r.bak_id?r.bak_id===b.id:(b.vast_type&&r.vast_type===b.vast_type))||[];
    }else{
      sets.forEach(s=>s.weken.forEach(w=>{nodigRijen.push({week:w.week,locatie:w.locatie,kv:'',bron:`set ${s.label}`,aantal:1,kampmoment_id:w.kampmoment_id});}));
    }
    const hist=[];
    all(`SELECT * FROM wijzigingen WHERE ${histWhere} ORDER BY id DESC LIMIT 100`,histParams).forEach(w=>{
      const o=parse(w.oud),n=parse(w.nieuw);
      const ks=Object.keys(n).filter(x=>String(o[x]??'')!==String(n[x]??''));
      if(w.actie==='update'&&!ks.length)return;
      const wat=w.tabel==='bulk_spreiding'?`spreiding ${locNaam(n.locatie_id||o.locatie_id)}: ${o.aantal??'—'} → ${n.aantal??'—'}`:w.actie==='insert'?'aangemaakt':w.actie==='delete'?'verwijderd':ks.map(x=>`${x}: ${o[x]===undefined||o[x]===''?'—':o[x]} → ${n[x]===undefined||n[x]===''?'—':n[x]}`).join(', ');
      hist.push({t:tijdTekst(w.tijdstip),wie:w.persoon_naam||'',wat,wijziging_id:w.id,terugdraaibaar:false});
    });
    res.json({stuk,periode:per?{id:per.id,naam:per.naam}:null,spreiding,sets,gegevens:gegevens.map(([k,v])=>({k,v})),fotos,
      nodig:{rijen:nodigRijen,nodig:stuk.nodig,totaal:stuk.totaal},bak_ids:g.soort==='vast'?g.bakken.map(x=>x.id):[],
      kan_foto:g.soort==='vast',historiek:hist});
  });

  app.put('/api/pool-overzicht/:soort/:id',alleenKantoor,(req,res)=>{
    const g=groepVan(req.params.soort,req.params.id);
    if(!g)return res.status(404).json({error:'Poolstuk niet gevonden'});
    const b=req.body||{};
    if(g.soort==='sport'){
      const naam=b.naam!==undefined?String(b.naam).trim():g.item.name;
      if(!naam)return res.status(400).json({error:'Naam is verplicht'});
      updateMetLog(req,'sport_items',g.item.id,{name:naam,notities:b.notitie!==undefined?b.notitie:g.item.notities},'pool');
      return res.json({ok:true});
    }
    const naam=b.naam!==undefined?String(b.naam).trim():g.bak.naam;
    if(!naam)return res.status(400).json({error:'Naam is verplicht'});
    updateMetLog(req,'bakken',g.bak.id,{naam,notitie:b.notitie!==undefined?b.notitie:g.bak.notitie},'pool');
    res.json({ok:true});
  });

  // Verplaatsen: bulk via lib/bulk.js (som blijft gelijk), per stuk via huidige_locatie_id van `aantal` bakken. Sportsets gaan per week (sportrooster), niet hier.
  app.post('/api/pool-overzicht/:soort/:id/verplaats',alleenKantoor,(req,res)=>{
    const g=groepVan(req.params.soort,req.params.id);
    if(!g)return res.status(404).json({error:'Poolstuk niet gevonden'});
    if(g.soort==='sport')return res.status(400).json({error:'Sportsets worden per week aan een locatie toegewezen (sportrooster), niet verplaatst.'});
    const {van_locatie_id,naar_locatie_id}=req.body||{},reden=String(req.body&&req.body.reden||'').trim()||'verplaatst vanuit Pool';
    const aantal=parseInt(req.body&&req.body.aantal)||1;
    if(!naar_locatie_id||!get('SELECT id FROM locaties WHERE id=?',[naar_locatie_id]))return res.status(400).json({error:'Kies een locatie om naartoe te verplaatsen'});
    if(g.bak.is_bulk){
      try{bulk.verplaatsBulk(req,g.bak.id,van_locatie_id||bulk.standaardVan(g.bak.id),naar_locatie_id,aantal,'pool: '+reden);}
      catch(e){return res.status(e.status||500).json({error:e.message});}
      logAct('bak','verplaatst',`Pool: "${g.bak.naam}" ×${aantal} van ${locNaam(van_locatie_id||bulk.standaardVan(g.bak.id))} naar ${locNaam(naar_locatie_id)} — ${reden}`,naar_locatie_id,locNaam(naar_locatie_id));
      return res.json({ok:true,som:bulk.controleerSom(g.bak.id)});
    }
    const van=van_locatie_id||g.bak.thuislocatie_id;
    const kandidaten=g.bakken.filter(x=>(x.huidige_locatie_id||x.thuislocatie_id)===Number(van)).slice(0,aantal);
    if(kandidaten.length<aantal)return res.status(409).json({error:`Op ${locNaam(van)} staan maar ${kandidaten.length} van "${g.bak.naam}" (gevraagd: ${aantal}).`});
    kandidaten.forEach(x=>updateMetLog(req,'bakken',x.id,{huidige_locatie_id:naar_locatie_id,status:naar_locatie_id===x.thuislocatie_id?'thuis':'op_locatie'},'pool'));
    logAct('bak','verplaatst',`Pool: "${g.bak.naam}" ×${aantal} van ${locNaam(van)} naar ${locNaam(naar_locatie_id)} — ${reden}`,naar_locatie_id,locNaam(naar_locatie_id));
    res.json({ok:true,verplaatst:kandidaten.length});
  });

  // Verwijderen met controle: 409 als het poolstuk ingepland is of op een locatie staat.
  app.delete('/api/pool-overzicht/:soort/:id',alleenKantoor,(req,res)=>{
    const g=groepVan(req.params.soort,req.params.id);
    if(!g)return res.status(404).json({error:'Poolstuk niet gevonden'});
    if(g.soort==='sport'){
      const n=get('SELECT COUNT(*) AS n FROM sport_planning WHERE set_id IN (SELECT id FROM sport_sets WHERE item_id=?)',[g.item.id]).n;
      if(n)return res.status(409).json({error:`"${g.item.name}" is ${n}× ingepland (sportplanning) en kan niet verwijderd worden. Haal de sets eerst uit het rooster.`});
      delMetLog(req,'sport_sets',{waar:'item_id=?',params:[g.item.id]},'pool');
      delMetLog(req,'sport_items',g.item.id,'pool');
      return res.json({ok:true});
    }
    const ids=g.bakken.map(x=>x.id),q=ids.map(()=>'?').join(',');
    const ingepland=get(`SELECT COUNT(*) AS n FROM thema_behoefte WHERE bak_id IN (${q})`,ids).n;
    const opLoc=g.bakken.some(x=>x.status==='op_locatie')||(g.bak.is_bulk&&get('SELECT COUNT(*) AS n FROM bulk_spreiding WHERE bak_id=? AND aantal>0 AND locatie_id<>?',[g.bak.id,g.bak.thuislocatie_id||0]).n>0);
    if(ingepland)return res.status(409).json({error:`"${g.bak.naam}" is gekoppeld aan ${ingepland} themabehoefte(n) en kan niet verwijderd worden.`});
    if(opLoc)return res.status(409).json({error:`"${g.bak.naam}" staat op een locatie en kan niet verwijderd worden. Haal het eerst terug.`});
    delMetLog(req,'bulk_spreiding',{waar:`bak_id IN (${q})`,params:ids},'pool');
    delMetLog(req,'bak_items',{waar:`bak_id IN (${q})`,params:ids},'pool');
    delMetLog(req,'bakken',{waar:`id IN (${q})`,params:ids},'pool');
    res.json({ok:true});
  });

  app.get('/pool',(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','pool.html')));
};
