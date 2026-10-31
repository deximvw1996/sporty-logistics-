// routes/locatie-dossier.js — MT2 (BESPREKING-MATERIAAL.md, delen 2 en 6): weekkaart, ruimtes, leverafspraken en dossier per locatie.
// De app rekent niet of iets past; ze bewaart wat kantoor weet en meldt. Nooit een verbod. Codes staan in een eigen tabel: nooit in een export, elke opvraging gelogd.
'use strict';
module.exports=function(ctx){
  const {app,get,all,run,ins,now,logAct,insMetLog,updateMetLog,delMetLog,alleenKantoor}=ctx;
  const DG=['zo','ma','di','wo','do','vr','za'],isoDat=/^\d{4}-\d{2}-\d{2}$/;
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const hhmm=s=>{const m=/^(\d{1,2}):(\d{2})/.exec(s||'');return m?m[1].padStart(2,'0')+':'+m[2]:'';};
  const locNaam=id=>(get('SELECT name FROM locaties WHERE id=?',[id])||{}).name||'?';
  const STAND={binnen:'dicht, wij kunnen binnen',geen_toegang:'dicht, geen toegang'};
  const periodeVan=id=>(id&&get('SELECT * FROM vakantieperiodes WHERE id=?',[id]))||get('SELECT * FROM vakantieperiodes WHERE actief=1');
  const loc=(req,res)=>{const l=get('SELECT * FROM locaties WHERE id=?',[req.params.id]);if(!l)res.status(404).json({error:'Locatie niet gevonden'});return l;};

  // ── Punt 1: weekkaart. API voor het latere routevoorstel. ──
  function standVan(locatieId,week,periodeId){
    const per=periodeVan(periodeId),km=per?get('SELECT id FROM kampmomenten WHERE locatie_id=? AND periode_id=? AND week=?',[locatieId,per.id,week]):null;
    const r=per?get('SELECT * FROM locatie_weekkaart WHERE locatie_id=? AND periode_id=? AND week=?',[locatieId,per.id,week]):null;
    return {week,stand:km?'kamp_open':(r&&r.stand)||'onbekend',kampmoment_id:km?km.id:null,reden:(r&&r.reden)||'',materiaal_mag_blijven:!!(r&&r.materiaal_mag_blijven),ruimte:(r&&r.ruimte)||'',notitie:(r&&r.notitie)||''};
  }
  ctx.standVan=standVan;
  function wekenVan(per){if(!per||!per.start_datum)return 0;const a=new Date(per.start_datum+'T12:00:00'),b=new Date((per.eind_datum||per.start_datum)+'T12:00:00');return Math.max(per.max_weken||0,Math.floor((b-a)/(7*864e5))+1);}
  app.get('/api/locaties/:id/weekkaart',alleenKantoor,(req,res)=>{
    const l=loc(req,res);if(!l)return;const per=periodeVan(req.query.periode_id);if(!per)return res.json({periode:null,weken:[]});
    res.json({periode:{id:per.id,naam:per.naam},weken:Array.from({length:wekenVan(per)},(_,i)=>standVan(l.id,i+1,per.id))});
  });
  app.put('/api/locaties/:id/weekkaart',alleenKantoor,(req,res)=>{
    const l=loc(req,res);if(!l)return;const b=req.body||{},per=periodeVan(b.periode_id),weken=Array.isArray(b.weken)?b.weken.map(Number).filter(n=>n>0):[];
    if(!per)return res.status(400).json({error:'Geen periode'});if(!weken.length)return res.status(400).json({error:'Kies minstens één week'});
    if(b.stand!==undefined&&b.stand!==''&&!STAND[b.stand])return res.status(400).json({error:'Onbekende stand'});
    weken.forEach(w=>{
      const o=get('SELECT * FROM locatie_weekkaart WHERE locatie_id=? AND periode_id=? AND week=?',[l.id,per.id,w]),v={stand:b.stand!==undefined?b.stand:(o?o.stand:''),reden:String(b.reden??(o?o.reden:'')).slice(0,200),materiaal_mag_blijven:b.materiaal_mag_blijven!==undefined?(b.materiaal_mag_blijven?1:0):(o?o.materiaal_mag_blijven:0),ruimte:String(b.ruimte??(o?o.ruimte:'')).slice(0,100),notitie:String(b.notitie??(o?o.notitie:'')).slice(0,500)};
      if(o)updateMetLog(req,'locatie_weekkaart',o.id,v,'weekkaart');else insMetLog(req,'locatie_weekkaart',['locatie_id','periode_id','week',...Object.keys(v)],[l.id,per.id,w,...Object.values(v)],'weekkaart');
    });
    logAct('locatie','weekkaart',`${l.name}: weken ${weken.join(', ')} → ${STAND[b.stand]||'bijgewerkt'}`,l.id,l.name);
    res.json({ok:true,weken:weken.map(w=>standVan(l.id,w,per.id))});
  });

  // ── Punt 2: ruimtes ──
  const ruimtes=id=>all('SELECT * FROM locatie_ruimtes WHERE locatie_id=? ORDER BY naam',[id]).map(r=>({...r,beperkingen:all('SELECT * FROM ruimte_beperkingen WHERE ruimte_id=? ORDER BY datum_van',[r.id])}));
  app.post('/api/locaties/:id/ruimtes',alleenKantoor,(req,res)=>{const l=loc(req,res);if(!l)return;const n=String(req.body?.naam||'').trim();if(!n)return res.status(400).json({error:'Naam is verplicht'});res.json({id:insMetLog(req,'locatie_ruimtes',['locatie_id','naam','notitie'],[l.id,n.slice(0,100),String(req.body.notitie||'').slice(0,300)],'ruimte')});});
  app.delete('/api/ruimtes/:id',alleenKantoor,(req,res)=>{all('SELECT id FROM ruimte_beperkingen WHERE ruimte_id=?',[req.params.id]).forEach(b=>delMetLog(req,'ruimte_beperkingen',b.id,'ruimte weg'));delMetLog(req,'locatie_ruimtes',req.params.id,'ruimte weg');res.json({ok:true});});
  app.post('/api/ruimtes/:id/beperkingen',alleenKantoor,(req,res)=>{
    const b=req.body||{};if(!get('SELECT id FROM locatie_ruimtes WHERE id=?',[req.params.id]))return res.status(404).json({error:'Ruimte niet gevonden'});
    if(!isoDat.test(b.datum_van||''))return res.status(400).json({error:'Kies een datum'});const tot=isoDat.test(b.datum_tot||'')?b.datum_tot:b.datum_van;if(tot<b.datum_van)return res.status(400).json({error:'Tot ligt vóór van'});
    res.json({id:insMetLog(req,'ruimte_beperkingen',['ruimte_id','datum_van','datum_tot','reden'],[req.params.id,b.datum_van,tot,String(b.reden||'').slice(0,200)],'ruimte')});
  });
  app.delete('/api/ruimte-beperkingen/:id',alleenKantoor,(req,res)=>{delMetLog(req,'ruimte_beperkingen',req.params.id,'ruimte');res.json({ok:true});});
  // Melding, geen verbod: een kampdag raakt een beperkte ruimte.
  ctx.ruimteMeldingen=km=>{
    const per=km&&km.periode_id?get('SELECT start_datum FROM vakantieperiodes WHERE id=?',[km.periode_id]):null;if(!per||!per.start_datum||!km.week)return [];
    const m=new Date(per.start_datum+'T12:00:00');m.setDate(m.getDate()+(km.week-1)*7);const uit=[];
    for(let i=0;i<5;i++){const d=new Date(m);d.setDate(d.getDate()+i);const s=iso(d);
      all('SELECT r.naam,b.reden FROM ruimte_beperkingen b JOIN locatie_ruimtes r ON r.id=b.ruimte_id WHERE r.locatie_id=? AND b.datum_van<=? AND b.datum_tot>=?',[km.locatie_id,s,s]).forEach(x=>uit.push(`${x.naam} niet bruikbaar op ${DG[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}${x.reden?': '+x.reden:''}`));}
    return uit;
  };

  // ── Punt 3: leverafspraken ──
  const lever=id=>{const r=get('SELECT * FROM locatie_lever WHERE locatie_id=?',[id]);let uren={};try{uren=JSON.parse((r&&r.uren)||'{}');}catch(e){uren={};}return {type:(r&&r.type)||'',uren};};
  ctx.stopMeldingen=(locatieId,datum,tijd)=>{
    const uit=[];if(!locatieId||!isoDat.test(datum||''))return uit;
    const l=lever(locatieId),t=hhmm(tijd),dag=DG[new Date(datum+'T12:00:00').getDay()],heeft=Object.keys(l.uren).length>0,u=l.uren[dag];
    if(heeft&&t){if(!u||!u.van)uit.push(`${dag}: geen leveruren`);else if(t<u.van||(u.tot&&t>u.tot))uit.push(`buiten de leveruren (${dag} ${u.van}–${u.tot||''})`);}
    all('SELECT * FROM locatie_niet_storen WHERE locatie_id=? AND van<=? AND tot>=?',[locatieId,datum,datum]).forEach(n=>uit.push(`andere firma aanwezig, niet storen${n.tekst?': '+n.tekst:''}`));
    all('SELECT * FROM locatie_afspraken WHERE locatie_id=? AND van<=? AND tot>=?',[locatieId,datum,datum]).forEach(a=>uit.push(`afspraak: ${a.tekst}`));
    return uit;
  };
  const stopLoc=t=>t.type==='ophaling'?(t.van_locatie_id||t.naar_locatie_id):(t.naar_locatie_id||t.van_locatie_id);
  ctx.ritLocMeldingen=rit=>{
    if(['gedaan','geannuleerd'].includes(rit.status))return [];
    return all("SELECT * FROM transport_taken WHERE rit_id=? AND status NOT IN ('gedaan','geannuleerd')",[rit.id]).flatMap(t=>ctx.stopMeldingen(stopLoc(t),rit.datum,t.tijd).map(m=>`${locNaam(stopLoc(t))}: ${m}`));
  };
  app.put('/api/locaties/:id/lever',alleenKantoor,(req,res)=>{
    const l=loc(req,res);if(!l)return;const b=req.body||{},o=get('SELECT * FROM locatie_lever WHERE locatie_id=?',[l.id]);
    if(b.type&&!['openbaar','school','anders'].includes(b.type))return res.status(400).json({error:'Onbekend type'});
    const u={};Object.entries(b.uren||{}).forEach(([d,v])=>{if(DG.includes(d)&&v&&hhmm(v.van))u[d]={van:hhmm(v.van),tot:hhmm(v.tot)};});
    const v={type:b.type||'',uren:JSON.stringify(u)};if(o)updateMetLog(req,'locatie_lever',o.id,v,'leverafspraken');else insMetLog(req,'locatie_lever',['locatie_id','type','uren'],[l.id,v.type,v.uren],'leverafspraken');
    res.json(lever(l.id));
  });
  const lijstRoute=(pad,tabel)=>{
    app.post(`/api/locaties/:id/${pad}`,alleenKantoor,(req,res)=>{const l=loc(req,res);if(!l)return;const b=req.body||{};if(!isoDat.test(b.van||'')||!isoDat.test(b.tot||''))return res.status(400).json({error:'Kies van en tot'});if(b.tot<b.van)return res.status(400).json({error:'Tot ligt vóór van'});const t=String(b.tekst||'').trim();if(tabel==='locatie_afspraken'&&!t)return res.status(400).json({error:'Schrijf de afspraak'});res.json({id:insMetLog(req,tabel,['locatie_id','van','tot','tekst'],[l.id,b.van,b.tot,t.slice(0,500)],'leverafspraken')});});
    app.delete(`/api/${pad}/:id`,alleenKantoor,(req,res)=>{delMetLog(req,tabel,req.params.id,'leverafspraken');res.json({ok:true});});
  };
  lijstRoute('niet-storen','locatie_niet_storen');lijstRoute('locatie-afspraken','locatie_afspraken');

  // ── Punt 4: dossier ──
  const VELD=[['sleutel_info','sleutel'],['wie_opent','wie opent'],['concierge','conciërge'],['parking','parking of laadzone'],['wifi','wifi'],['binnenruimte','binnenruimte'],['kuisen_info','kuisen']];
  function ontbreekt(l){
    if(l.type!=='kamp')return [];
    const a=VELD.filter(([k])=>!String(l[k]||'').trim()).map(([,n])=>n);
    if(!(l.contact_tel||'').trim()&&!get('SELECT id FROM locatie_contacten WHERE locatie_id=? LIMIT 1',[l.id]))a.push('contactpersoon');
    if(!get('SELECT locatie_id FROM locatie_lever WHERE locatie_id=? AND type<>""',[l.id]))a.push('type leveren');
    if(!get('SELECT id FROM locatie_fotos WHERE locatie_id=? LIMIT 1',[l.id]))a.push("foto's");
    return a;
  }
  ctx.dossierOntbreekt=ontbreekt;
  app.get('/api/locaties/:id/dossier',alleenKantoor,(req,res)=>{
    const l=loc(req,res);if(!l)return;
    res.json({id:l.id,velden:Object.fromEntries(VELD.map(([k])=>[k,l[k]||''])),heeft_eigen_oven:!!l.heeft_eigen_oven,zelf_kuisen:!!l.zelf_kuisen,heeft_code:!!get('SELECT locatie_id FROM locatie_codes WHERE locatie_id=?',[l.id]),
      contact:{naam:l.contact_naam||'',telefoon:l.contact_tel||''},contacten:all('SELECT * FROM locatie_contacten WHERE locatie_id=? ORDER BY id',[l.id]),ontbreekt:ontbreekt(l),lever:lever(l.id),niet_storen:all('SELECT * FROM locatie_niet_storen WHERE locatie_id=? ORDER BY van',[l.id]),afspraken:all('SELECT * FROM locatie_afspraken WHERE locatie_id=? ORDER BY van',[l.id]),ruimtes:ruimtes(l.id)});
  });
  app.put('/api/locaties/:id/dossier',alleenKantoor,(req,res)=>{
    const l=loc(req,res);if(!l)return;const b=req.body||{},v={};VELD.forEach(([k])=>{if(b[k]!==undefined)v[k]=String(b[k]).slice(0,500);});
    if(b.heeft_eigen_oven!==undefined)v.heeft_eigen_oven=b.heeft_eigen_oven?1:0;if(b.zelf_kuisen!==undefined)v.zelf_kuisen=b.zelf_kuisen?1:0;
    if(Object.keys(v).length)updateMetLog(req,'locaties',l.id,v,'dossier');res.json({ok:true,ontbreekt:ontbreekt(get('SELECT * FROM locaties WHERE id=?',[l.id]))});
  });
  app.post('/api/locaties/:id/contacten',alleenKantoor,(req,res)=>{const l=loc(req,res);if(!l)return;const n=String(req.body?.naam||'').trim();if(!n)return res.status(400).json({error:'Naam is verplicht'});res.json({id:insMetLog(req,'locatie_contacten',['locatie_id','naam','rol','telefoon'],[l.id,n.slice(0,100),String(req.body.rol||'').slice(0,100),String(req.body.telefoon||'').slice(0,40)],'dossier')});});
  app.delete('/api/locatie-contacten/:id',alleenKantoor,(req,res)=>{delMetLog(req,'locatie_contacten',req.params.id,'dossier');res.json({ok:true});});
  // Code: de waarde komt niet in het wijzigingenlog of een export. Elke opvraging gelogd.
  app.put('/api/locaties/:id/code',alleenKantoor,(req,res)=>{
    const l=loc(req,res);if(!l)return;const c=String(req.body?.code||'').trim().slice(0,100);run('DELETE FROM locatie_codes WHERE locatie_id=?',[l.id]);if(c)run('INSERT INTO locatie_codes (locatie_id,code) VALUES (?,?)',[l.id,c]);
    logAct('locatie','code gewijzigd',`${l.name}: code ${c?'gewijzigd':'gewist'} door ${req.persoon.naam}`,l.id,l.name);res.json({ok:true,heeft_code:!!c});
  });
  const geefCode=(res,l,wie)=>{const c=get('SELECT code FROM locatie_codes WHERE locatie_id=?',[l.id]);logAct('locatie','code opgevraagd',`${l.name}: code opgevraagd door ${wie}`,l.id,l.name);res.json({code:c?c.code:''});};
  const vandaag=()=>iso(new Date());
  function heeftStop(pid,locId){
    return all("SELECT t.* FROM transport_taken t JOIN transport_ritten r ON r.id=t.rit_id WHERE r.datum=? AND r.status<>'geannuleerd' AND t.status<>'geannuleerd' AND (r.personeel_id=? OR r.id IN (SELECT rit_id FROM rit_personen WHERE personeel_id=?))",[vandaag(),pid,pid]).some(t=>stopLoc(t)===locId);
  }
  app.get('/api/locaties/:id/code',(req,res)=>{
    const l=loc(req,res);if(!l)return;
    if(req.persoon.rol!=='kantoor'&&!heeftStop(req.persoon.persoon_id,l.id))return res.status(403).json({error:'Je hebt vandaag geen stop op deze locatie'});
    geefCode(res,l,req.persoon.naam);
  });
  // Op de rit-link: de stop moet vandaag zijn en wie meehelpt zonder op de rit te staan, krijgt de code niet.
  app.post('/api/rit-token/:token/taken/:taakId/code',(req,res)=>{
    const rit=get('SELECT * FROM transport_ritten WHERE rit_token=?',[req.params.token]),t=get('SELECT * FROM transport_taken WHERE id=?',[req.params.taakId]);
    if(!rit||!t||t.rit_id!==rit.id)return res.status(403).json({error:'Deze stop hoort niet bij deze rit'});
    const w=ctx._ritWie(req,rit);if(w.helpt&&req.persoon?.rol!=='kantoor'){const s=ctx.checkSessie(req.headers['x-auth-token']);if(!s||s.rol!=='kantoor')return res.status(403).json({error:'De code is voor wie op de rit staat'});}
    if(rit.datum!==vandaag()){const s=req.headers['x-auth-token']&&ctx.checkSessie(req.headers['x-auth-token']);if(!s||s.rol!=='kantoor')return res.status(403).json({error:'De code is alleen op de dag van de stop zichtbaar'});}
    geefCode(res,get('SELECT * FROM locaties WHERE id=?',[stopLoc(t)])||{},w.naam||rit.chauffeur||'rit-link');
  });
  ctx.stopGeldt=t=>{const id=stopLoc(t),l=lever(id),r=get('SELECT datum FROM transport_ritten WHERE id=?',[t.rit_id]),d=r?r.datum:t.datum,dg=d?DG[new Date(d+'T12:00:00').getDay()]:'',u=l.uren[dg],lo=get('SELECT wie_opent,parking FROM locaties WHERE id=?',[id])||{};
    return {meldingen:ctx.stopMeldingen(id,d,t.tijd),uren:u?`${u.van}–${u.tot||''}`:'',wie_opent:lo.wie_opent||'',parking:lo.parking||'',heeft_code:!!get('SELECT locatie_id FROM locatie_codes WHERE locatie_id=?',[id])};};
};
