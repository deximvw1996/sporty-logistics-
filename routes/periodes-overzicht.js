// routes/periodes-overzicht.js — PL2 punt 3 (chat C): Planning › Periodes (Periodes-scherm in design/mockup-planning-rest.html).
// Lijst van periodes, detail met kampweken, gesloten dagen en "Klaar voor de start?", knop "Kopieer naar nieuwe periode"
// (kampmomenten + thema's, zonder KV's en ritten; gelogd). Aanmaken/bewerken/activeren/gesloten dagen: de bestaande routes
// in routes/planning.js (/api/periodes, /api/gesloten). De analyse (dubbel, gedeeld) komt uit routes/rooster.js.
'use strict';
module.exports = function(ctx){
  const {app,get,all,insMetLog,alleenKantoor,logAct,path,ROOT_DIR} = ctx;
  const DAG=['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'],MND=['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
  const d0=s=>new Date(s+'T12:00:00');
  const dm=s=>{const d=d0(s);return `${d.getDate()}/${d.getMonth()+1}`;};
  const lang=s=>{const d=d0(s);return `${DAG[d.getDay()]} ${d.getDate()} ${MND[d.getMonth()]} ${d.getFullYear()}`;};
  const kortLang=s=>{const d=d0(s);return `${d.getDate()} ${MND[d.getMonth()]}`;};
  const vandaag=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};

  function rij(p){
    const n=get('SELECT COUNT(*) AS n,COUNT(DISTINCT locatie_id) AS l FROM kampmomenten WHERE periode_id=?',[p.id]);
    const v=vandaag();
    const stand=p.actief?'actief':!n.n?'leeg':p.eind_datum<v?'voorbij':'komend';
    return {id:p.id,naam:p.naam,start_datum:p.start_datum,eind_datum:p.eind_datum,datums:`${dm(p.start_datum)} – ${dm(p.eind_datum)}`,weken:p.max_weken||1,
      kampmomenten:n.n,locaties:n.l,km_tekst:n.n?`${n.n} op ${n.l} locatie${n.l===1?'':'s'}`:'0',stand,actief:!!p.actief,
      tijd:p.eind_datum<v?'voorbij':'komend',zoek:p.naam.toLowerCase()};
  }
  app.get('/api/periodes-overzicht',alleenKantoor,(req,res)=>{
    const ps=all('SELECT * FROM vakantieperiodes ORDER BY start_datum DESC').map(rij);
    res.json({tellers:{alle:ps.length,komend:ps.filter(p=>p.tijd==='komend').length,voorbij:ps.filter(p=>p.tijd==='voorbij').length},periodes:ps});
  });

  function klaar(p,A){
    const kms=A.kms;
    const zonderThema=kms.filter(k=>!k.themas.length).length,zonderKv=kms.filter(k=>!k.kv_persoon_id).length;
    const dubbel=new Set(A.kts.filter(t=>t.meldingen.includes('dubbel')).map(t=>t.week+':'+t.thema_id)).size;
    let gedeeld=0;Object.values(A.gedeeld).forEach(g=>Object.values(g).forEach(x=>{if(x.stand==='te_weinig')gedeeld++;}));
    const zonderRit=kms.filter(k=>!get(`SELECT id FROM transport_taken WHERE kampmoment_id=? AND type='levering' AND status<>'geannuleerd' AND rit_id IS NOT NULL LIMIT 1`,[k.id])).length;
    const wekenMetRit=new Set(kms.filter(k=>get(`SELECT id FROM transport_taken WHERE kampmoment_id=? AND type='levering' AND status<>'geannuleerd' LIMIT 1`,[k.id])).map(k=>k.week)).size;
    const wekenMetKm=new Set(kms.map(k=>k.week)).size;
    return [
      {sleutel:'themas',label:"Thema's",tekst:`${kms.length-zonderThema} van ${kms.length} kampmomenten`,probleem:zonderThema,uitleg:zonderThema?`${zonderThema} zonder thema`:'',link:'/kampmomenten'},
      {sleutel:'kv',label:"KV's",tekst:`${kms.length-zonderKv} van ${kms.length}`,probleem:zonderKv,uitleg:zonderKv?`${zonderKv} zonder KV`:'',link:'/kampmomenten'},
      {sleutel:'dubbel',label:'Dubbel',tekst:dubbel?`${dubbel} thema${dubbel===1?'':"'s"} dubbel ⚠`:'geen thema dubbel',probleem:dubbel,link:`/rooster?periode_id=${p.id}&f=dubbel`},
      {sleutel:'gedeeld',label:'Gedeeld',tekst:gedeeld?`${gedeeld}× te weinig gedeeld materiaal ◐`:'gedeeld materiaal past',probleem:gedeeld,link:`/gedeeld?periode_id=${p.id}&zicht=seizoen`},
      {sleutel:'transport',label:'Transport',tekst:`leveringen ${wekenMetRit} van ${wekenMetKm} weken gegenereerd`,probleem:zonderRit,uitleg:zonderRit?`${zonderRit} kampmoment${zonderRit===1?'':'en'} zonder brengrit`:'',link:'/ritplanning'},
      ...(ctx.sportTeWeinig?[(()=>{const n=ctx.sportTeWeinig(p.id)||0;return {sleutel:'sport',label:'Sport',tekst:n?n+'× te weinig sets ⚠':'genoeg sets',probleem:n,link:'/sportrooster?periode_id='+p.id+'&zicht=seizoen'};})()]:[])
    ];
  }
  app.get('/api/periodes/:id/detail',alleenKantoor,(req,res)=>{
    const p=get('SELECT * FROM vakantieperiodes WHERE id=?',[req.params.id]);if(!p)return res.status(404).json({error:'Periode niet gevonden'});
    const A=ctx._roosterAnalyse(p);
    const gesloten=all('SELECT g.*,l.name AS locatie FROM gesloten_dagen g LEFT JOIN locaties l ON l.id=g.locatie_id WHERE g.datum>=? AND g.datum<=? ORDER BY g.datum',[p.start_datum,p.eind_datum]).map(g=>({id:g.id,datum:g.datum,locatie:g.locatie||'',tekst:`${lang(g.datum).replace(/ \d{4}$/,'')}`,reden:g.reden||''}));
    const weken=[];for(let w=1;w<=A.aantal;w++){
      const wi=ctx._roosterWeek(p,w),kms=A.kms.filter(k=>k.week===w);
      const dubbel=new Set(A.kts.filter(t=>t.week===w&&t.meldingen.includes('dubbel')).map(t=>t.thema_id)).size,zonderKv=kms.filter(k=>!k.kv_persoon_id).length;
      const gw=gesloten.filter(g=>g.datum>=wi.van&&g.datum<=wi.tot);
      weken.push({nr:w,label:`Week ${w} · ${dm(wi.van)} – ${dm(wi.tot)}`,gesloten:gw.map(g=>`${dm(g.datum)} ${g.reden||'gesloten'}`),kampmomenten:kms.length,zonder_kv:zonderKv,dubbel,
        sub:[`${kms.length} kampmomenten`,zonderKv?`${zonderKv} zonder KV`:'',dubbel?`${dubbel} thema dubbel`:''].filter(Boolean).join(' · ')});
    }
    const historiek=all(`SELECT tijdstip,actie,beschrijving FROM activiteiten_log WHERE type='periode' AND beschrijving LIKE ? ORDER BY id DESC LIMIT 50`,['%'+p.naam+'%']).map(h=>({t:String(h.tijdstip||'').slice(0,16),wat:h.beschrijving}));
    const r=rij(p);
    res.json({periode:{...r,start_lang:lang(p.start_datum),eind_lang:lang(p.eind_datum),sub:`${p.actief?'Actieve periode':r.stand==='voorbij'?'Voorbije periode':'Periode'} · ${kortLang(p.start_datum)} – ${kortLang(p.eind_datum)} · ${A.aantal} kampweken`},
      weken,gesloten,klaar:klaar(p,A),historiek});
  });

  // Kopieer naar nieuwe periode: kampmomenten (locatie, week, type) + thema's (thema, dag, leeftijdsgroep), zonder KV's en ritten.
  app.post('/api/periodes/:id/kopieer',alleenKantoor,(req,res)=>{
    const bron=get('SELECT * FROM vakantieperiodes WHERE id=?',[req.params.id]);if(!bron)return res.status(404).json({error:'Periode niet gevonden'});
    const {naam,start_datum,eind_datum}=req.body||{};
    if(!naam||!start_datum||!eind_datum)return res.status(400).json({error:'Naam, startdatum en einddatum zijn verplicht'});
    const max_weken=Math.max(1,Math.ceil(((d0(eind_datum)-d0(start_datum))/86400000+1)/7));
    const ctxt=`periode kopiëren: ${bron.naam} → ${naam}`;
    const pid=insMetLog(req,'INSERT INTO vakantieperiodes (naam,start_datum,eind_datum,max_weken) VALUES (?,?,?,?)',[naam,start_datum,eind_datum,max_weken],ctxt);
    let nKm=0,nTh=0,weg=0;
    all('SELECT * FROM kampmomenten WHERE periode_id=? ORDER BY week,id',[bron.id]).forEach(k=>{
      if(k.week>max_weken){weg++;return;}
      const id=insMetLog(req,'INSERT INTO kampmomenten (locatie_id,week,periode_id,type,notities) VALUES (?,?,?,?,?)',[k.locatie_id,k.week,pid,k.type||'kamp',k.notities||''],ctxt);nKm++;
      all('SELECT * FROM kampmoment_themas WHERE kampmoment_id=? ORDER BY id',[k.id]).forEach(t=>{insMetLog(req,'INSERT INTO kampmoment_themas (kampmoment_id,thema_id,dag,leeftijdsgroep) VALUES (?,?,?,?)',[id,t.thema_id,t.dag,t.leeftijdsgroep||''],ctxt);nTh++;});
    });
    logAct('periode','kopie',`Periode ${bron.naam} gekopieerd naar ${naam}: ${nKm} kampmomenten, ${nTh} thema's, zonder KV's en ritten${weg?` (${weg} buiten de nieuwe weken niet gekopieerd)`:''} (door ${req.persoon?req.persoon.naam:'?'})`,null,null);
    res.json({ok:true,id:pid,kampmomenten:nKm,themas:nTh,niet_gekopieerd:weg});
  });

  const paginaRol=(req,res,next)=>{const tk=req.headers['x-auth-token']||'';if(!tk)return next();req.persoon=ctx.checkSessie(tk);if(!req.persoon)return res.status(401).send('Niet ingelogd');return alleenKantoor(req,res,next);};
  app.get('/periodes',paginaRol,(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','periodes.html')));
};
