// routes/instellingen.js — BH2 punt 3: Beheer › Instellingen (design/mockup-beheer.html, scherm Instellingen).
// Groepen: Kantoor & contact, Gesloten dagen (heel Sporty of één locatie), Stockagelocaties, Leeftijdsgroepen, Thema-categorieën,
// Standaard tijden en App & database. Waarden in app_vlaggen; alles gelogd (activiteiten_log type 'instellingen', met naam).
'use strict';
module.exports = function(ctx){
  const {app,get,all,run,ins,alleenKantoor,logAct,checkSessie,path,fs,ROOT_DIR,DB_PATH,DATA_DIR} = ctx;
  const vlag=n=>(get('SELECT waarde FROM app_vlaggen WHERE naam=?',[n])||{}).waarde||'';
  const zetVlag=(n,w)=>run('INSERT OR REPLACE INTO app_vlaggen (naam,waarde) VALUES (?,?)',[n,w]);
  const wie=req=>req.persoon?req.persoon.naam:'?';
  const log=(req,groep,tekst)=>logAct('instellingen',groep,`${tekst} (door ${wie(req)})`,null,null);
  const TIJDEN={tijd_vertrek_ritten:['Vertrek ritten','08:00'],tijd_verhuis_avond:['Verhuis-avond','17:00'],tijd_nachtbackup:['Nachtback-up','03:00']};
  const GROEPEN=[['kantoor','Kantoor & contact'],['gesloten','Gesloten dagen'],['stockage','Stockagelocaties'],['leeftijd','Leeftijdsgroepen'],['categorie','Thema-categorieën'],['tijden','Standaard tijden'],['app','App & database']];
  const mb=n=>(n/1048576).toFixed(1).replace('.',',')+' MB';

  function leeftijdsgroepen(){
    const n={};
    all("SELECT leeftijdsgroep AS g,COUNT(*) AS n FROM themas WHERE COALESCE(leeftijdsgroep,'')<>'' GROUP BY 1").forEach(r=>{n[r.g]=(n[r.g]||0)+r.n;});
    all("SELECT leeftijdsgroep AS g,COUNT(*) AS n FROM kampmoment_themas WHERE COALESCE(leeftijdsgroep,'')<>'' GROUP BY 1").forEach(r=>{n[r.g]=(n[r.g]||0)+r.n;});
    let extra=[];try{extra=JSON.parse(vlag('leeftijdsgroepen')||'[]');}catch(e){}
    extra.forEach(g=>{if(!(g in n))n[g]=0;});
    return Object.entries(n).map(([naam,gebruikt])=>({naam,gebruikt})).sort((a,b)=>a.naam.localeCompare(b.naam,'nl'));
  }
  function categorieen(){
    const n={};all('SELECT name FROM thema_categorieen').forEach(r=>{n[r.name]=0;});
    all("SELECT categorie AS c,COUNT(*) AS n FROM themas WHERE COALESCE(categorie,'')<>'' GROUP BY 1").forEach(r=>{n[r.c]=(n[r.c]||0)+r.n;});
    return Object.entries(n).map(([naam,gebruikt])=>({naam,gebruikt})).sort((a,b)=>a.naam.localeCompare(b.naam,'nl'));
  }
  const gesloten=()=>all('SELECT g.*,l.name AS locatie FROM gesloten_dagen g LEFT JOIN locaties l ON l.id=g.locatie_id ORDER BY g.datum,l.name');
  const stockage=()=>all("SELECT id,name FROM locaties WHERE type='stockage' AND (parent_id IS NULL OR parent_id=0) ORDER BY name");
  function versie(){
    if(process.env.RAILWAY_GIT_COMMIT_SHA)return process.env.RAILWAY_GIT_COMMIT_SHA.slice(0,7);
    try{return require('child_process').execSync('git rev-parse --short HEAD',{cwd:ROOT_DIR,stdio:['ignore','pipe','ignore'],timeout:3000}).toString().trim();}catch(e){/* geen git: verder met .git lezen */}
    try{const h=fs.readFileSync(path.join(ROOT_DIR,'.git','HEAD'),'utf8').trim();
      if(h.startsWith('ref: ')){const ref=h.slice(5);const p=path.join(ROOT_DIR,'.git',ref);if(fs.existsSync(p))return fs.readFileSync(p,'utf8').trim().slice(0,7);
        const pk=path.join(ROOT_DIR,'.git','packed-refs');if(fs.existsSync(pk)){const m=fs.readFileSync(pk,'utf8').split('\n').find(l=>l.endsWith(' '+ref));if(m)return m.slice(0,7);}}
      return h.slice(0,7);}catch(e){return 'onbekend';}
  }
  function groepRij(id,naam){
    const jaar=String(new Date().getFullYear());
    if(id==='kantoor'){const t=vlag('kantoor_telefoon');return {id,naam,sub:'telefoon, e-mail · op de KV-pagina',stand:t?{tekst:'ok',soort:'groen'}:{tekst:'nummer ontbreekt',soort:'oranje'},aandacht:!t};}
    if(id==='gesloten'){const n=gesloten().filter(g=>g.datum.startsWith(jaar)).length;return {id,naam,sub:`feestdagen en sluitingen · ${n} dit jaar`,stand:{tekst:'ok',soort:'groen'},aandacht:false};}
    if(id==='stockage'){const s=stockage();return {id,naam,sub:`${s.map(x=>x.name).join(', ')||'—'} · wat ligt waar`,stand:{tekst:String(s.length)},aandacht:false};}
    if(id==='leeftijd'){const l=leeftijdsgroepen();return {id,naam,sub:l.map(x=>x.naam).join(', ')||'—',stand:{tekst:String(l.length)},aandacht:false};}
    if(id==='categorie'){const l=categorieen();return {id,naam,sub:(l.slice(0,3).map(x=>x.naam).join(', ')||'—')+(l.length>3?', …':''),stand:{tekst:String(l.length)},aandacht:false};}
    if(id==='tijden')return {id,naam,sub:'vertrek ritten, verhuis-avond, nachtback-up',stand:null,aandacht:false};
    const fout=vlag('nachtbackup_fout');
    return {id,naam,sub:'versie, opslag, Railway',stand:fout?{tekst:'back-up mislukt',soort:'rood'}:null,aandacht:!!fout};
  }
  app.get('/api/instellingen',alleenKantoor,(req,res)=>{
    const groepen=GROEPEN.map(([id,n])=>groepRij(id,n));
    res.json({tellers:{alles:groepen.length,aandacht:groepen.filter(g=>g.aandacht).length},groepen});
  });
  app.get('/api/instellingen/:groep',alleenKantoor,(req,res)=>{
    const g=GROEPEN.find(x=>x[0]===req.params.groep);if(!g)return res.status(404).json({error:'Onbekende instelling'});
    const id=g[0],rij=groepRij(id,g[1]);
    const historiek=all("SELECT tijdstip,beschrijving FROM activiteiten_log WHERE type='instellingen' AND actie=? ORDER BY id DESC LIMIT 100",[id]).map(h=>({t:h.tijdstip,wat:h.beschrijving}));
    let data={};
    if(id==='kantoor')data={kantoor_telefoon:vlag('kantoor_telefoon'),kantoor_gsm:vlag('kantoor_gsm'),kantoor_email:vlag('kantoor_email')};
    else if(id==='gesloten')data={dagen:gesloten(),locaties:all("SELECT id,name FROM locaties WHERE type='kamp' ORDER BY name")};
    else if(id==='stockage')data={locaties:stockage().map(l=>({...l,bakken:(get('SELECT COUNT(*) AS n FROM bakken WHERE COALESCE(huidige_locatie_id,thuislocatie_id)=?',[l.id])||{}).n||0}))};
    else if(id==='leeftijd')data={lijst:leeftijdsgroepen()};
    else if(id==='categorie')data={lijst:categorieen()};
    else if(id==='tijden')data=Object.fromEntries(Object.entries(TIJDEN).map(([k,[,d]])=>[k,vlag(k)||d]));
    else {let grootte=0;try{grootte=fs.statSync(DB_PATH).size;}catch(e){}
      data={versie:versie(),grootte,grootte_tekst:mb(grootte),pad:DB_PATH,data_dir:DATA_DIR,railway:!!process.env.RAILWAY_VOLUME_MOUNT_PATH,backups:ctx.nachtbackup?ctx.nachtbackup.lijst().length:0,nachtbackup_fout:vlag('nachtbackup_fout')||null};}
    res.json({groep:rij,data,historiek});
  });

  // ── opslaan ──
  const geldigTel=s=>!s||/^[+0-9 ./()-]{6,20}$/.test(s);
  app.put('/api/instellingen/kantoor',alleenKantoor,(req,res)=>{
    const b=req.body||{},v={kantoor_telefoon:String(b.kantoor_telefoon||'').trim(),kantoor_gsm:String(b.kantoor_gsm||'').trim(),kantoor_email:String(b.kantoor_email||'').trim()};
    if(!geldigTel(v.kantoor_telefoon)||!geldigTel(v.kantoor_gsm))return res.status(400).json({error:'Telefoonnummer: alleen cijfers, spaties, + . / ( ) -'});
    if(v.kantoor_email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.kantoor_email))return res.status(400).json({error:'Ongeldig e-mailadres'});
    const veranderd=Object.entries(v).filter(([k,w])=>vlag(k)!==w);
    veranderd.forEach(([k,w])=>zetVlag(k,w));
    if(veranderd.length)log(req,'kantoor',`Kantoor & contact: ${veranderd.map(([k,w])=>`${{kantoor_telefoon:'telefoon',kantoor_gsm:'gsm',kantoor_email:'e-mail'}[k]} ${w||'(leeg)'}`).join(', ')}`);
    res.json({ok:true,veranderd:veranderd.length});
  });
  app.put('/api/instellingen/tijden',alleenKantoor,(req,res)=>{
    const b=req.body||{},veranderd=[];
    for(const k of Object.keys(TIJDEN)){
      if(b[k]==null)continue;const w=String(b[k]).trim();
      if(!/^([01]?\d|2[0-3]):[0-5]\d$/.test(w))return res.status(400).json({error:`${TIJDEN[k][0]}: tijd als UU:MM`});
      if((vlag(k)||TIJDEN[k][1])!==w){zetVlag(k,w);veranderd.push(`${TIJDEN[k][0]} ${w}`);}
    }
    if(veranderd.length){log(req,'tijden',`Standaard tijden: ${veranderd.join(', ')}`);if(ctx.nachtbackup)ctx.nachtbackup.plan();}
    res.json({ok:true,veranderd:veranderd.length});
  });
  // Gesloten dagen: één datum of een reeks (werkdagen), heel Sporty (locatie_id leeg) of één locatie.
  app.post('/api/instellingen/gesloten',alleenKantoor,(req,res)=>{
    const {van,tot,reden}=req.body||{};const lid=parseInt((req.body||{}).locatie_id)||null;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(van||''))return res.status(400).json({error:'Kies een datum'});
    const eind=/^\d{4}-\d{2}-\d{2}$/.test(tot||'')?tot:van;if(eind<van)return res.status(400).json({error:'Einde ligt vóór het begin'});
    const loc=lid?get('SELECT name FROM locaties WHERE id=?',[lid]):null;if(lid&&!loc)return res.status(400).json({error:'Onbekende locatie'});
    const nieuw=[],al=[];
    for(const d=new Date(van+'T12:00:00');;d.setDate(d.getDate()+1)){
      const iso=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;if(iso>eind)break;
      if(eind!==van&&(d.getDay()===0||d.getDay()===6))continue;
      if(get('SELECT id FROM gesloten_dagen WHERE datum=? AND locatie_id IS ?',[iso,lid])){al.push(iso);continue;}
      ins('INSERT INTO gesloten_dagen (datum,reden,locatie_id) VALUES (?,?,?)',[iso,String(reden||''),lid]);nieuw.push(iso);
      if(nieuw.length>120)break;
    }
    if(nieuw.length)log(req,'gesloten',`Gesloten: ${nieuw.length===1?nieuw[0]:nieuw[0]+' – '+nieuw[nieuw.length-1]+' ('+nieuw.length+' dagen)'} · ${loc?loc.name:'heel Sporty'}${reden?' · '+reden:''}`);
    res.json({ok:true,toegevoegd:nieuw.length,bestond_al:al.length});
  });
  app.delete('/api/instellingen/gesloten/:id',alleenKantoor,(req,res)=>{
    const g=get('SELECT g.*,l.name AS locatie FROM gesloten_dagen g LEFT JOIN locaties l ON l.id=g.locatie_id WHERE g.id=?',[req.params.id]);if(!g)return res.status(404).json({error:'Niet gevonden'});
    run('DELETE FROM gesloten_dagen WHERE id=?',[g.id]);log(req,'gesloten',`Gesloten dag verwijderd: ${g.datum} · ${g.locatie||'heel Sporty'}`);res.json({ok:true});
  });
  // Leeftijdsgroepen en thema-categorieën: toevoegen, hernoemen (overal mee), verwijderen alleen als ongebruikt (anders 409).
  const LIJST={
    leeftijd:{lijst:leeftijdsgroepen,label:'Leeftijdsgroep',
      voegToe:n=>{let x=[];try{x=JSON.parse(vlag('leeftijdsgroepen')||'[]');}catch(e){}if(!x.includes(n))x.push(n);zetVlag('leeftijdsgroepen',JSON.stringify(x));},
      hernoem:(o,n)=>{run('UPDATE themas SET leeftijdsgroep=? WHERE leeftijdsgroep=?',[n,o]);run('UPDATE kampmoment_themas SET leeftijdsgroep=? WHERE leeftijdsgroep=?',[n,o]);let x=[];try{x=JSON.parse(vlag('leeftijdsgroepen')||'[]');}catch(e){}zetVlag('leeftijdsgroepen',JSON.stringify(x.map(g=>g===o?n:g)));},
      weg:n=>{let x=[];try{x=JSON.parse(vlag('leeftijdsgroepen')||'[]');}catch(e){}zetVlag('leeftijdsgroepen',JSON.stringify(x.filter(g=>g!==n)));},
      uitleg:'thema’s of kampmomenten'},
    categorie:{lijst:categorieen,label:'Thema-categorie',
      voegToe:n=>run('INSERT OR IGNORE INTO thema_categorieen (name) VALUES (?)',[n]),
      hernoem:(o,n)=>{if(get('SELECT id FROM thema_categorieen WHERE name=?',[n]))run('DELETE FROM thema_categorieen WHERE name=?',[o]);else run('UPDATE thema_categorieen SET name=? WHERE name=?',[n,o]);run('UPDATE themas SET categorie=? WHERE categorie=?',[n,o]);},
      weg:n=>run('DELETE FROM thema_categorieen WHERE name=?',[n]),uitleg:'thema’s'}
  };
  const lijstGroep=(req,res)=>{const L=LIJST[req.params.groep];if(!L){res.status(404).json({error:'Onbekende lijst'});return null;}return L;};
  app.post('/api/instellingen/:groep/lijst',alleenKantoor,(req,res)=>{
    const L=lijstGroep(req,res);if(!L)return;const n=String((req.body||{}).naam||'').trim();
    if(!n)return res.status(400).json({error:'Naam is verplicht'});
    if(L.lijst().some(x=>x.naam.toLowerCase()===n.toLowerCase()))return res.status(409).json({error:`${L.label} "${n}" bestaat al`});
    L.voegToe(n);log(req,req.params.groep,`${L.label} toegevoegd: ${n}`);res.json({ok:true,lijst:L.lijst()});
  });
  app.put('/api/instellingen/:groep/lijst',alleenKantoor,(req,res)=>{
    const L=lijstGroep(req,res);if(!L)return;const o=String((req.body||{}).oud||''),n=String((req.body||{}).nieuw||'').trim();
    if(!n)return res.status(400).json({error:'Nieuwe naam is verplicht'});
    const x=L.lijst().find(y=>y.naam===o);if(!x)return res.status(404).json({error:'Niet gevonden'});
    L.hernoem(o,n);log(req,req.params.groep,`${L.label} hernoemd: ${o} → ${n} (${x.gebruikt}× mee aangepast)`);res.json({ok:true,lijst:L.lijst()});
  });
  app.delete('/api/instellingen/:groep/lijst/:naam',alleenKantoor,(req,res)=>{
    const L=lijstGroep(req,res);if(!L)return;const n=String(req.params.naam);
    const x=L.lijst().find(y=>y.naam===n);if(!x)return res.status(404).json({error:'Niet gevonden'});
    if(x.gebruikt>0)return res.status(409).json({error:`${L.label} "${n}" wordt nog gebruikt door ${x.gebruikt} ${L.uitleg}. Hernoem of verplaats die eerst.`});
    L.weg(n);log(req,req.params.groep,`${L.label} verwijderd: ${n}`);res.json({ok:true,lijst:L.lijst()});
  });

  // Kantoorcontact voor de rit-pagina en de aanvullijst (enkel lezen, ook voor chauffeurs/coördinatoren).
  ctx.kantoorContact=()=>({telefoon:vlag('kantoor_telefoon'),gsm:vlag('kantoor_gsm'),email:vlag('kantoor_email')});

  const paginaRol=(req,res,next)=>{const tk=req.headers['x-auth-token']||'';if(!tk)return next();req.persoon=checkSessie(tk);if(!req.persoon)return res.status(401).send('Niet ingelogd');return alleenKantoor(req,res,next);};
  app.get('/instellingen',paginaRol,(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','instellingen.html')));
};
