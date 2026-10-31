// routes/voertuigen.js — VT1: Transport › Voertuigen op het standaardpagina-patroon (design/mockup-voertuigen.html).
// Eén rij per echt voertuig (geen soorten meer), een weekstrook ma–zo met bezetting (rit / dubbel / onderhoud), detail met Planning,
// Gegevens en Historiek. Een rit gebruikt één bepaald voertuig (transport_ritten.voertuig_id); de waarschuwingen "voertuig dubbel",
// "voertuig in onderhoud" en "huurwagen niet beschikbaar" staan in routes/transport.js (_ritWaarschuwingen). Alles gelogd.
'use strict';
module.exports = function(ctx){
  const {app,get,all,insMetLog,updateMetLog,delMetLog,alleenKantoor,path,ROOT_DIR,_ritPlanInfo} = ctx;

  const DAG=['zo','ma','di','wo','do','vr','za'],MND=['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const d0=s=>new Date(s+'T12:00:00');
  const kort=s=>{if(!s)return '';const d=d0(s);return `${DAG[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}`;};
  const lang=s=>{if(!s)return '';const d=d0(s);return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;};
  const min=s=>{const m=/^(\d{1,2}):(\d{2})$/.exec(s||'');return m?(+m[1])*60+(+m[2]):null;};
  const SOORTEN=['eigen','huur','prive'];
  const SOORT_TXT={eigen:'Eigen voertuig',huur:'Huurwagen',prive:'Privé wagen'};
  const locNaam=id=>id?((get('SELECT name FROM locaties WHERE id=?',[id])||{}).name||''):'';
  const isoDatum=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'');

  function weekVan(q){
    const basis=isoDatum(q)?d0(q):d0(iso(new Date()));
    basis.setDate(basis.getDate()-((basis.getDay()+6)%7));
    const dagen=[];for(let i=0;i<7;i++){const d=new Date(basis);d.setDate(d.getDate()+i);dagen.push(iso(d));}
    return {start:dagen[0],eind:dagen[6],dagen};
  }
  const bestuurderVan=r=>{const p=r.personeel_id?get('SELECT naam FROM personeel WHERE id=?',[r.personeel_id]):null;return p?p.naam:(r.chauffeur||'');};

  // Per dag: ritten van dit voertuig, onderhoud, en of twee ritten tegelijk lopen.
  function weekVoertuig(v,w){
    const onderhoud=all('SELECT * FROM voertuig_onderhoud WHERE voertuig_id=? ORDER BY datum_van',[v.id]);
    const ritten=all("SELECT * FROM transport_ritten WHERE (voertuig_id=? OR aanhangwagen_id=?) AND datum>=? AND datum<=? AND status<>'geannuleerd' ORDER BY datum,id",[v.id,v.id,w.start,w.eind]).map(r=>{
      const info=_ritPlanInfo(r);
      return {id:r.id,datum:r.datum,van:info.vertrek||'',tot:info.einde||'',bestuurder:bestuurderVan(r),lading:info.lading?info.lading.tekst:'',status:r.status,
        waarschuwingen:info.waarschuwingen.filter(x=>/^voertuig |^huurwagen |^aanhangwagen /.test(x))};
    });
    const dubbelPaar=[];
    const week=w.dagen.map(datum=>{
      const dr=ritten.filter(r=>r.datum===datum);
      const ond=onderhoud.find(o=>o.datum_van<=datum&&o.datum_tot>=datum);
      let dubbel=false;
      for(let i=0;i<dr.length;i++)for(let j=i+1;j<dr.length;j++){
        const a0=min(dr[i].van),a1=min(dr[i].tot),b0=min(dr[j].van),b1=min(dr[j].tot);
        if(v.aard==='aanhangwagen'||a0==null||b0==null||(a0<=b1&&b0<=a1)){dubbel=true;dubbelPaar.push({datum,a:dr[i],b:dr[j]});}
      }
      const status=dubbel?'dubbel':ond?'onderhoud':dr.length?'rit':'vrij';
      return {datum,dag:DAG[d0(datum).getDay()],status,onderhoud:ond?ond.reden||'onderhoud':'',ritten:dr.map(r=>({id:r.id,van:r.van,tot:r.tot,bestuurder:r.bestuurder,lading:r.lading}))};
    });
    return {week,ritten,dubbelPaar,onderhoud};
  }

  const uitrusting=v=>v.aard==='aanhangwagen'?[]:[v.trekhaak?'trekhaak':'geen trekhaak',v.laadklep?'laadklep':''];
  function sub(v){
    if(v.aard==='aanhangwagen')return [v.notitie,locNaam(v.standplaats_locatie_id)].filter(Boolean).join(' · ');
    if(v.soort==='huur'&&(v.huur_van||v.huur_tot))return `gehuurd ${kort(v.huur_van)||'…'} – ${kort(v.huur_tot)||'…'}`;
    const plek=locNaam(v.standplaats_locatie_id);
    if(v.soort==='prive')return ['privé',v.notitie].filter(Boolean).join(' · ');
    return [v.nummerplaat||'zonder kenteken',plek,v.notitie,...uitrusting(v)].filter(Boolean).join(' · ');
  }
  function rij(v,w){
    const wv=weekVoertuig(v,w);
    const dub=wv.week.filter(d=>d.status==='dubbel'),ond=wv.week.filter(d=>d.status==='onderhoud');
    const aandacht=[...dub.map(d=>`dubbel ${d.dag}`),...ond.map(d=>`onderhoud ${d.dag}`)];
    const huurBuiten=v.soort==='huur'&&wv.ritten.some(r=>(v.huur_van&&r.datum<v.huur_van)||(v.huur_tot&&r.datum>v.huur_tot));
    if(huurBuiten)aandacht.push('buiten huurperiode');
    return {id:v.id,naam:v.naam,sub:sub(v),aard:v.aard||'voertuig',trekhaak:!!v.trekhaak,laadklep:!!v.laadklep,soort:v.soort,plaatsen:v.plaatsen,rijbewijs:v.rijbewijs||'',nummerplaat:v.nummerplaat||'',
      week:wv.week,status:dub.length?'dubbel':ond.length?'onderhoud':'ok',aandacht,
      zoek:[v.naam,v.nummerplaat,v.soort,locNaam(v.standplaats_locatie_id),v.notitie].join(' ').toLowerCase(),wv};
  }

  app.get('/api/voertuigen-overzicht',alleenKantoor,(req,res)=>{
    const w=weekVan(req.query.week);
    const voertuigen=all('SELECT * FROM voertuigen WHERE actief=1 ORDER BY CASE soort WHEN \'eigen\' THEN 0 WHEN \'huur\' THEN 1 ELSE 2 END,naam COLLATE NOCASE').map(v=>{const r=rij(v,w);delete r.wv;return r;});
    // TF7 punt 4: twee blokken op de pagina.
    const aanhangwagens=voertuigen.filter(v=>v.aard==='aanhangwagen'),alleen=voertuigen.filter(v=>v.aard!=='aanhangwagen');
    const n=f=>voertuigen.filter(f).length;
    res.json({week:{start:w.start,eind:w.eind,dagen:w.dagen.map(d=>({datum:d,dag:DAG[d0(d).getDay()],weekend:[0,6].includes(d0(d).getDay())}))},
      tellers:{alle:voertuigen.length,eigen:n(v=>v.soort==='eigen'),huur:n(v=>v.soort==='huur'),prive:n(v=>v.soort==='prive'),dubbel:n(v=>v.status==='dubbel'),onderhoud:n(v=>v.week.some(d=>d.status==='onderhoud'))},voertuigen:alleen,aanhangwagens});
  });

  app.get('/api/voertuigen/:id/detail',alleenKantoor,(req,res)=>{
    const v=get('SELECT * FROM voertuigen WHERE id=?',[req.params.id]);
    if(!v)return res.status(404).json({error:'Voertuig niet gevonden'});
    const w=weekVan(req.query.week);
    const r=rij(v,w),wv=r.wv;
    const letOp=[];
    wv.dubbelPaar.forEach(p=>{
      const van=[p.a.van,p.b.van].filter(Boolean).sort().pop()||'',tot=[p.a.tot,p.b.tot].filter(Boolean).sort()[0]||'';
      letOp.push({soort:'dubbel',rit_id:p.a.id,knop:'Oplossen',tekst:`Dubbel geboekt ${kort(p.datum)}${van?` ${van}–${tot}`:''}`,
        sub:`rit #${p.a.id}${p.a.bestuurder?` (${p.a.bestuurder})`:''} en rit #${p.b.id}${p.b.bestuurder?` (${p.b.bestuurder})`:''} rijden tegelijk met deze wagen`});
    });
    wv.ritten.forEach(x=>x.waarschuwingen.filter(t=>/onderhoud|huurwagen/.test(t)).forEach(t=>letOp.push({soort:'beschikbaar',rit_id:x.id,knop:'Open rit',tekst:`Rit #${x.id} (${kort(x.datum)}): ${t}`,sub:'kies een ander voertuig of pas de datum aan'})));
    // Historiek: het voertuig zelf en zijn onderhoudsperiodes.
    const parse=s=>{try{return JSON.parse(s||'{}')||{};}catch(e){return {};}};
    const hist=[];
    all(`SELECT * FROM wijzigingen WHERE (tabel='voertuigen' AND rij_id=?) OR (tabel='voertuig_onderhoud' AND (nieuw LIKE ? OR oud LIKE ?)) ORDER BY id DESC LIMIT 100`,[v.id,`%"voertuig_id":${v.id},%`,`%"voertuig_id":${v.id},%`]).forEach(x=>{
      const o=parse(x.oud),n=parse(x.nieuw);let wat;
      if(x.tabel==='voertuig_onderhoud'){const b=x.actie==='delete'?o:n;wat=`onderhoud ${lang(b.datum_van)} – ${lang(b.datum_tot)}${b.reden?' ('+b.reden+')':''} ${x.actie==='delete'?'verwijderd':'gepland'}`;}
      else{const ks=Object.keys(n).filter(k=>String(o[k]??'')!==String(n[k]??''));if(x.actie==='update'&&!ks.length)return;
        wat=x.actie==='insert'?'aangemaakt':ks.map(k=>`${k}: ${o[k]===undefined||o[k]===''?'—':o[k]} → ${n[k]===undefined||n[k]===''?'—':n[k]}`).join(', ');}
      const t=new Date(x.tijdstip);
      hist.push({t:isNaN(t)?(x.tijdstip||''):`${DAG[t.getDay()]} ${t.getDate()} ${MND[t.getMonth()]} ${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`,wie:x.persoon_naam||'',wat,wijziging_id:x.id,terugdraaibaar:false});
    });
    res.json({voertuig:{id:v.id,naam:v.naam,aard:v.aard||'voertuig',trekhaak:!!v.trekhaak,laadklep:!!v.laadklep,soort:v.soort,soort_tekst:SOORT_TXT[v.soort]||v.soort,nummerplaat:v.nummerplaat||'',plaatsen:v.plaatsen,rijbewijs:v.rijbewijs||'',
        standplaats_locatie_id:v.standplaats_locatie_id,standplaats:locNaam(v.standplaats_locatie_id),sleutel_info:v.sleutel_info||'',keuring_tot:v.keuring_tot||'',
        huur_van:v.huur_van||'',huur_tot:v.huur_tot||'',notitie:v.notitie||'',status:r.status,aandacht:r.aandacht},
      week:{start:w.start,eind:w.eind,dagen:wv.week.map(d=>({...d,tekst:`${d.dag} ${d0(d.datum).getDate()}/${d0(d.datum).getMonth()+1}`,weekend:[0,6].includes(d0(d.datum).getDay())}))},
      let_op:letOp,onderhoud:wv.onderhoud.map(o=>({id:o.id,datum_van:o.datum_van,datum_tot:o.datum_tot,reden:o.reden||''})),historiek:hist});
  });

  // ── schrijven ──
  function velden(b,cur){
    const v={};
    if(b.naam!==undefined){const n=String(b.naam).trim();if(!n)return {fout:'Naam is verplicht'};v.naam=n;}
    else if(!cur)return {fout:'Naam is verplicht'};
    if(b.aard!==undefined){if(!['voertuig','aanhangwagen'].includes(b.aard))return {fout:'aard moet voertuig of aanhangwagen zijn'};v.aard=b.aard;}
    for(const k of ['trekhaak','laadklep'])if(b[k]!==undefined)v[k]=b[k]?1:0;
    if(b.soort!==undefined){if(!SOORTEN.includes(b.soort))return {fout:'soort moet eigen, huur of prive zijn'};v.soort=b.soort;}
    if(b.plaatsen!==undefined){const p=b.plaatsen===null||b.plaatsen===''?null:parseInt(b.plaatsen);if(p!==null&&!(p>0))return {fout:'plaatsen moet een positief aantal zijn'};v.plaatsen=p;}
    for(const k of ['keuring_tot','huur_van','huur_tot']){if(b[k]!==undefined){if(b[k]&&!isoDatum(b[k]))return {fout:`${k} moet een datum JJJJ-MM-DD zijn`};v[k]=b[k]||'';}}
    for(const k of ['nummerplaat','rijbewijs','sleutel_info','notitie'])if(b[k]!==undefined)v[k]=String(b[k]||'').trim();
    if(b.standplaats_locatie_id!==undefined)v.standplaats_locatie_id=b.standplaats_locatie_id?Number(b.standplaats_locatie_id):null;
    const van=v.huur_van!==undefined?v.huur_van:cur&&cur.huur_van,tot=v.huur_tot!==undefined?v.huur_tot:cur&&cur.huur_tot;
    if(van&&tot&&tot<van)return {fout:'huur_tot ligt vóór huur_van'};
    return {v};
  }
  app.post('/api/voertuigen',alleenKantoor,(req,res)=>{
    const r=velden(req.body||{},null);if(r.fout)return res.status(400).json({error:r.fout});
    const v={soort:'eigen',rijbewijs:'B',...r.v};
    const k=Object.keys(v);
    const id=insMetLog(req,'voertuigen',[...k,'actief','created_at'],[...k.map(x=>v[x]),1,new Date().toISOString()],'voertuigen');
    res.json({ok:true,id});
  });
  app.put('/api/voertuigen/:id',alleenKantoor,(req,res)=>{
    const cur=get('SELECT * FROM voertuigen WHERE id=?',[req.params.id]);
    if(!cur)return res.status(404).json({error:'Voertuig niet gevonden'});
    const r=velden(req.body||{},cur);if(r.fout)return res.status(400).json({error:r.fout});
    if(Object.keys(r.v).length)updateMetLog(req,'voertuigen',cur.id,r.v,'voertuigen');
    // De oude velden op de ritten blijven kloppen (oude tab, rit-link).
    const nw=get('SELECT * FROM voertuigen WHERE id=?',[cur.id]);
    if(nw.naam!==cur.naam||nw.plaatsen!==cur.plaatsen||nw.soort!==cur.soort)
      updateMetLog(req,'transport_ritten',{waar:'voertuig_id=?',params:[cur.id]},{voertuig:nw.naam,voertuig_capaciteit:nw.plaatsen,voertuig_soort:nw.soort==='eigen'?'pool':nw.soort==='huur'?'huur':'eigen'},'voertuigen');
    res.json({ok:true,id:cur.id});
  });
  app.delete('/api/voertuigen/:id',alleenKantoor,(req,res)=>{
    const v=get('SELECT * FROM voertuigen WHERE id=?',[req.params.id]);
    if(!v)return res.status(404).json({error:'Voertuig niet gevonden'});
    const vandaag=iso(new Date());
    const n=get("SELECT COUNT(*) AS n FROM transport_ritten WHERE (voertuig_id=? OR aanhangwagen_id=?) AND datum>=? AND status NOT IN ('gedaan','geannuleerd')",[v.id,v.id,vandaag]).n;
    if(n)return res.status(409).json({error:`"${v.naam}" staat nog op ${n} komende rit${n===1?'':'ten'} en kan niet verwijderd worden. Kies eerst een ander voertuig voor die ${n===1?'rit':'ritten'}.`});
    updateMetLog(req,'voertuigen',v.id,{actief:0},'voertuigen');
    res.json({ok:true});
  });
  app.post('/api/voertuigen/:id/onderhoud',alleenKantoor,(req,res)=>{
    const v=get('SELECT id FROM voertuigen WHERE id=?',[req.params.id]);
    if(!v)return res.status(404).json({error:'Voertuig niet gevonden'});
    const {datum_van,datum_tot,reden}=req.body||{};
    if(!isoDatum(datum_van)||!isoDatum(datum_tot))return res.status(400).json({error:'datum_van en datum_tot moeten JJJJ-MM-DD zijn'});
    if(datum_tot<datum_van)return res.status(400).json({error:'datum_tot ligt vóór datum_van'});
    const id=insMetLog(req,'voertuig_onderhoud',['voertuig_id','datum_van','datum_tot','reden'],[v.id,datum_van,datum_tot,String(reden||'').trim()],'voertuigen');
    res.json({ok:true,id});
  });
  app.delete('/api/voertuigen/:id/onderhoud/:oid',alleenKantoor,(req,res)=>{
    const n=delMetLog(req,'voertuig_onderhoud',{waar:'id=? AND voertuig_id=?',params:[req.params.oid,req.params.id]},'voertuigen');
    if(!n)return res.status(404).json({error:'Die onderhoudsperiode bestaat niet (meer)'});
    res.json({ok:true});
  });

  app.get('/voertuigen',(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','voertuigen.html')));
};
