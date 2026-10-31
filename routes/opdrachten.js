// routes/opdrachten.js — BW2: opdracht met wagens, afspraken in de agenda en feedback (design/mockup-opdracht-kampmoment.html, tabs 4 en 5).
// Een wagen is een rij in transport_ritten; zo blijven rit-link, token en alle rit-routes gewoon werken. Datamodel: OVERLEG-c.md.
'use strict';
module.exports=function(ctx){
  const {app,get,all,run,ins,now,logAct,insMetLog,updateMetLog,delMetLog,alleenKantoor,path,ROOT_DIR,_ritPlanInfo}=ctx;
  const fotos=require('../lib/fotos')(ctx.UPLOADS_DIR);
  const locNaam=id=>id?((get('SELECT name FROM locaties WHERE id=?',[id])||{}).name||'?'):'?';
  const stopLoc=t=>t.type==='ophaling'?(t.van_locatie_id||t.naar_locatie_id):(t.naar_locatie_id||t.van_locatie_id);
  const min=s=>{const m=/^(\d{1,2}):(\d{2})/.exec(s||'');return m?(+m[1])*60+(+m[2]):null;};
  const hhmm=s=>{const m=/^(\d{1,2}):(\d{2})/.exec(s||'');return m?m[1].padStart(2,'0')+':'+m[2]:'';};
  const nuHm=()=>{const d=new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');};
  const takenVan=id=>all("SELECT * FROM transport_taken WHERE rit_id=? AND status<>'geannuleerd' ORDER BY COALESCE(volgorde,1000000),COALESCE(tijd,''),id",[id]);
  const persNaam=id=>(get('SELECT naam FROM personeel WHERE id=?',[id])||{}).naam||'';

  // Elke rit hoort bij een opdracht; ook wat de generator of Nieuwe rit net maakte. Twee keer draaien doet niets.
  function zorgOpdrachten(){
    all('SELECT id,datum FROM transport_ritten WHERE opdracht_id IS NULL').forEach(r=>{
      const o=ins('INSERT INTO opdrachten (datum,created_at) VALUES (?,?)',[r.datum||'',now()]);
      run('UPDATE transport_ritten SET opdracht_id=? WHERE id=?',[o,r.id]);
    });
  }
  ctx.zorgOpdrachten=zorgOpdrachten;
  const wagensVan=oid=>all("SELECT * FROM transport_ritten WHERE opdracht_id=? AND status<>'geannuleerd' ORDER BY id",[oid]);

  function mensen(r){
    const uit=[];const hoofd=r.personeel_id?{id:r.personeel_id,naam:persNaam(r.personeel_id)||r.chauffeur||'',hoofd:true}:(r.chauffeur?{id:null,naam:r.chauffeur,hoofd:true}:null);
    if(hoofd)uit.push(hoofd);
    all('SELECT rp.personeel_id AS id,p.naam FROM rit_personen rp JOIN personeel p ON p.id=rp.personeel_id WHERE rp.rit_id=? ORDER BY rp.id',[r.id]).forEach(p=>{if(p.id!==r.personeel_id)uit.push({id:p.id,naam:p.naam,hoofd:false});});
    return uit;
  }
  ctx.isOpWagen=(ritId,pid)=>!!get('SELECT id FROM rit_personen WHERE rit_id=? AND personeel_id=?',[ritId,pid]);
  // Een afgeleide gedeelde stop: zelfde opdracht, locatie en tijd op een andere wagen.
  function samenVan(r,t){
    if(!r.opdracht_id||!t.tijd)return [];
    return wagensVan(r.opdracht_id).filter(w=>w.id!==r.id&&takenVan(w.id).some(x=>stopLoc(x)===stopLoc(t)&&hhmm(x.tijd)===hhmm(t.tijd))).map(w=>({rit_id:w.id,voertuig:w.voertuig||'',mensen:mensen(w).map(m=>m.naam)}));
  }
  function laadVolgorde(r){try{return JSON.parse(r.laadvolgorde||'[]');}catch(e){return [];}}
  function laadstops(r,taken){
    const m=new Map();
    taken.filter(t=>t.type!=='ophaling'&&t.van_locatie_id&&t.van_locatie_id!==t.naar_locatie_id&&get('SELECT id FROM transport_regels WHERE taak_id=? LIMIT 1',[t.id])).forEach(t=>{if(!m.has(t.van_locatie_id))m.set(t.van_locatie_id,new Set());m.get(t.van_locatie_id).add(locNaam(stopLoc(t)));});
    const vg=laadVolgorde(r),plaats=id=>{const i=vg.indexOf(id);return i<0?999:i;};
    return [...m.keys()].sort((a,b)=>plaats(a)-plaats(b)).map(id=>({locatie_id:id,locatie:locNaam(id),lad:'laden voor '+[...m.get(id)].join(' en ')}));
  }
  ctx.wagenExtra=(rit,data)=>{
    (data.stops||[]).forEach(s=>{const t=get('SELECT * FROM transport_taken WHERE id=?',[s.taak_id]);s.samen=t?samenVan(rit,t):[];});
    return {...data,opdracht_id:rit.opdracht_id,mensen:mensen(rit),laadvolgorde:laadVolgorde(rit)};
  };
  // Waarschuwingen; nooit een verbod.
  function afspraakOverlap(datum,v,t,kol,id){
    return all(`SELECT * FROM afspraken WHERE datum=? AND ${kol}=? AND status<>'klaar'`,[datum,id]).filter(a=>{const x=min(a.van),y=min(a.tot)??(x==null?null:x+60);return x==null||v==null||(x<(t??v+60)&&v<y);});
  }
  const SOORT={autokeuring:'🛠 Autokeuring',garage:'🔧 Garage',carwash:'🧽 Carwash',tanken:'⛽ Tanken',winkel:'📦 Ophalen winkel',andere:'Andere'};
  function waarschuwingen(r,info){
    const w=[...(info.waarschuwingen||[])];
    if(['gedaan','geannuleerd'].includes(r.status))return w;
    const v=min(info.vertrek),e=min(info.einde)??(v==null?null:v+60),ik=mensen(r).filter(m=>m.id);
    all("SELECT * FROM transport_ritten WHERE datum=? AND id<>? AND status<>'geannuleerd'",[r.datum,r.id]).forEach(o=>{
      const i2=ctx._ritTijden(o),v2=min(i2.vertrek),e2=min(i2.einde)??(v2==null?null:v2+60);
      if(v!=null&&v2!=null&&!(v<(e2)&&v2<(e)))return;
      const hun=mensen(o);
      ik.forEach(m=>{if(hun.some(h=>h.id===m.id))w.push(`persoon dubbel: ${m.naam} ook op rit #${o.id}`);});
    });
    ik.forEach(m=>afspraakOverlap(r.datum,v,e,'personeel_id',m.id).forEach(a=>w.push(`${m.naam} is bezet: ${SOORT[a.soort]||a.soort} ${a.van}–${a.tot}`)));
    if(r.voertuig_id)afspraakOverlap(r.datum,v,e,'voertuig_id',r.voertuig_id).forEach(a=>w.push(`voertuig bezet: ${SOORT[a.soort]||a.soort} ${a.van}–${a.tot}`));
    return [...new Set(w)];
  }
  function wagenData(r){
    const info=_ritPlanInfo(r),taken=takenVan(r.id);
    const stops=taken.map((t,i)=>{
      const regels=all('SELECT id,naam,qty FROM transport_regels WHERE taak_id=? ORDER BY id',[t.id]),samen=samenVan(r,t),korte=regels.slice(0,3).map(x=>x.qty>1?x.qty+' × '+x.naam:x.naam).join(', ')+(regels.length>3?' +'+(regels.length-3):'');
      const lad=regels.length?(t.type==='ophaling'?'ophalen: ':'lossen: ')+korte+(samen.length?', samen helpen':''):i===0&&t.van_locatie_id===t.naar_locatie_id?'vertrekt zonder lading':samen.length?'helpt, geen lading':'geen lading';
      const door=[...new Set(all('SELECT geladen_door AS a,gelost_door AS b FROM verhuis_checks WHERE taak_id=?',[t.id]).flatMap(c=>[c.a,c.b]).filter(Boolean))];
      return {afgerond_door:t.status==='gedaan'?(t.afgerond_door||''):'',taak_id:t.id,gedaan_door:door,tijd:hhmm(t.tijd),locatie:locNaam(stopLoc(t)),locatie_id:stopLoc(t),type:t.type,status:t.status,samen,lad,regels};
    });
    return {rit_id:r.id,token:r.rit_token||'',status:r.status,klaarzet_status:r.klaarzet_status||'',voertuig:{id:r.voertuig_id||null,naam:r.voertuig||''},aanhangwagen_id:r.aanhangwagen_id||null,mensen:mensen(r),
      vertrek:info.vertrek,einde:info.einde,lading:info.lading,laadstops:laadstops(r,taken).map(l=>({...l,tijd:info.vertrek})),stops,waarschuwingen:waarschuwingen(r,info),echte_start:r.echte_start||'',echte_einde:r.echte_einde||''};
  }
  function meting(o,w){
    const st=w.map(x=>x.echte_start).filter(Boolean).sort()[0]||'',kl=w.length&&w.every(x=>x.echte_einde),e=kl?w.map(x=>x.echte_einde).sort().pop():'',g=hhmm(o.einde||'')||w.map(x=>x.einde).filter(Boolean).sort().pop()||'';
    const d=[];if(g)d.push('geschat '+g);if(e)d.push('echt '+e);else if(st)d.push('gestart '+st);
    if(g&&e){const x=min(e)-min(g),a=Math.abs(x);d.push(x===0?'precies op tijd':(a>=60?Math.floor(a/60)+'u'+String(a%60).padStart(2,'0'):a+' min')+' '+(x>0?'langer':'korter'));}
    return {tekst:d.join(' · '),geschat:g,echt_start:st,echt_einde:e,vorig:hhmm(o.einde_vorig||'')};
  }
  function opdrachtData(o){
    const w=wagensVan(o.id).map(wagenData),klaar=w.length&&w.every(x=>x.klaarzet_status==='klaar'||(x.status&&x.status!=='gepland')),gedaan=w.length&&w.every(x=>x.status==='gedaan');
    const start=w.map(x=>x.vertrek).filter(Boolean).sort()[0]||'';
    return {id:o.id,datum:o.datum,wagens:w,start,meting:meting(o,w),status:gedaan?'gedaan':w.some(x=>x.status==='onderweg')?'onderweg':klaar?'klaargezet':'concept',feedback:all('SELECT id,soort,tekst,wie,created_at FROM feedback WHERE opdracht_id=? ORDER BY id DESC',[o.id])};
  }
  const AFSPR=a=>({...a,titel:SOORT[a.soort]||a.soort,voertuig:a.voertuig_id?(get('SELECT naam FROM voertuigen WHERE id=?',[a.voertuig_id])||{}).naam||'':'',wie:a.personeel_id?persNaam(a.personeel_id):''});

  app.get('/api/opdrachten',alleenKantoor,(req,res)=>{
    zorgOpdrachten();
    const datum=/^\d{4}-\d{2}-\d{2}$/.test(req.query.datum||'')?req.query.datum:(d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)(new Date());
    const ids=new Set(all("SELECT DISTINCT opdracht_id AS id FROM transport_ritten WHERE datum=? AND status<>'geannuleerd'",[datum]).map(x=>x.id));
    all('SELECT id FROM opdrachten WHERE datum=?',[datum]).forEach(x=>ids.add(x.id));
    const opdrachten=[...ids].map(id=>opdrachtData(get('SELECT * FROM opdrachten WHERE id=?',[id])));
    res.json({datum,opdrachten,afspraken:all('SELECT * FROM afspraken WHERE datum=? ORDER BY van,id',[datum]).map(AFSPR),
      personeel:all("SELECT id,naam,rol FROM personeel WHERE COALESCE(actief,1)=1 AND rol<>'kv' ORDER BY naam"),voertuigen:all('SELECT id,naam,aard FROM voertuigen ORDER BY naam'),locaties:all('SELECT id,name AS naam,type FROM locaties WHERE parent_id IS NULL OR parent_id=0 ORDER BY name COLLATE NOCASE'),stockages:all("SELECT id,name AS naam FROM locaties WHERE type='stockage' ORDER BY name")});
  });
  app.get('/api/opdrachten/:id',alleenKantoor,(req,res)=>{zorgOpdrachten();const o=get('SELECT * FROM opdrachten WHERE id=?',[req.params.id]);if(!o)return res.status(404).json({error:'Opdracht niet gevonden'});res.json(opdrachtData(o));});
  function nieuweWagen(req,o,b){
    const pid=parseInt(b.personeel_id)||null,chauffeur=pid?persNaam(pid):'',vn=b.voertuig_id?get('SELECT naam FROM voertuigen WHERE id=?',[b.voertuig_id]):null;
    return insMetLog(req,'transport_ritten',['datum','vertrek','chauffeur','personeel_id','status','created_at','voertuig','voertuig_id','opdracht_id'],[o.datum,hhmm(b.vertrek)||'',chauffeur,pid,'gepland',now(),vn?vn.naam:'',b.voertuig_id||null,o.id],`opdracht #${o.id}: wagen erbij`);
  }
  // Eén chauffeur alleen = één opdracht met één wagen, meteen.
  app.post('/api/opdrachten',alleenKantoor,(req,res)=>{
    const b=req.body||{};if(!/^\d{4}-\d{2}-\d{2}$/.test(b.datum||''))return res.status(400).json({error:'Datum is verplicht'});
    const id=ins('INSERT INTO opdrachten (datum,einde,created_at) VALUES (?,?,?)',[b.datum,hhmm(b.einde)||'',now()]),o=get('SELECT * FROM opdrachten WHERE id=?',[id]);
    nieuweWagen(req,o,b);logAct('transport','opdracht',`Opdracht #${id} gemaakt (${b.datum})`,null,null);
    res.json(opdrachtData(o));
  });
  app.put('/api/opdrachten/:id',alleenKantoor,(req,res)=>{
    const o=get('SELECT * FROM opdrachten WHERE id=?',[req.params.id]);if(!o)return res.status(404).json({error:'Opdracht niet gevonden'});
    const e=(req.body||{}).einde;if(e!==undefined){if(e&&!hhmm(e))return res.status(400).json({error:'einde moet HH:MM zijn'});if(hhmm(e)!==hhmm(o.einde||''))run('UPDATE opdrachten SET einde=?,einde_vorig=? WHERE id=?',[hhmm(e),hhmm(o.einde||'')||o.einde_vorig||'',o.id]);}
    res.json(opdrachtData(get('SELECT * FROM opdrachten WHERE id=?',[o.id])));
  });
  app.post('/api/opdrachten/:id/wagens',alleenKantoor,(req,res)=>{
    const o=get('SELECT * FROM opdrachten WHERE id=?',[req.params.id]);if(!o)return res.status(404).json({error:'Opdracht niet gevonden'});
    const rit_id=nieuweWagen(req,o,req.body||{});res.json({ok:true,rit_id,opdracht:opdrachtData(o)});
  });
  app.post('/api/opdrachten/:id/klaarzet',alleenKantoor,(req,res)=>{
    const o=get('SELECT * FROM opdrachten WHERE id=?',[req.params.id]);if(!o)return res.status(404).json({error:'Opdracht niet gevonden'});
    const naam=req.persoon.naam,t=now();let n=0;
    wagensVan(o.id).forEach(w=>{if(w.klaarzet_status==='klaar'||!takenVan(w.id).length)return;updateMetLog(req,'transport_ritten',w.id,{klaarzet_status:'klaar',klaarzet_door:naam,klaarzet_op:t},`opdracht #${o.id}: klaargezet`);if(ctx.meldRitKlaar)ctx.meldRitKlaar(req,w.id);n++;});
    res.json({ok:true,klaargezet:n,opdracht:opdrachtData(o)});
  });
  // Mensen
  app.post('/api/wagens/:id/personen',alleenKantoor,(req,res)=>{
    const r=get('SELECT * FROM transport_ritten WHERE id=?',[req.params.id]),pid=parseInt((req.body||{}).personeel_id);
    if(!r)return res.status(404).json({error:'Wagen niet gevonden'});if(!get('SELECT id FROM personeel WHERE id=?',[pid]))return res.status(400).json({error:'Onbekende persoon'});
    if(!r.personeel_id&&!r.chauffeur)updateMetLog(req,'transport_ritten',r.id,{personeel_id:pid,chauffeur:persNaam(pid)},'persoon op wagen');
    else if(r.personeel_id!==pid&&!ctx.isOpWagen(r.id,pid))insMetLog(req,'rit_personen',['rit_id','personeel_id'],[r.id,pid],'persoon op wagen');
    if(ctx.meldRitGewijzigd)ctx.meldRitGewijzigd(req,r.id,'bezetting');
    res.json(wagenData(get('SELECT * FROM transport_ritten WHERE id=?',[r.id])));
  });
  app.delete('/api/wagens/:id/personen/:pid',alleenKantoor,(req,res)=>{
    const r=get('SELECT * FROM transport_ritten WHERE id=?',[req.params.id]),pid=parseInt(req.params.pid);if(!r)return res.status(404).json({error:'Wagen niet gevonden'});
    const extra=get('SELECT id FROM rit_personen WHERE rit_id=? AND personeel_id=?',[r.id,pid]);
    if(extra)delMetLog(req,'rit_personen',extra.id,'persoon van wagen');
    else if(r.personeel_id===pid){const v=get('SELECT id,personeel_id FROM rit_personen WHERE rit_id=? ORDER BY id LIMIT 1',[r.id]);updateMetLog(req,'transport_ritten',r.id,{personeel_id:v?v.personeel_id:null,chauffeur:v?persNaam(v.personeel_id):''},'persoon van wagen');if(v)delMetLog(req,'rit_personen',v.id,'persoon van wagen');}
    res.json(wagenData(get('SELECT * FROM transport_ritten WHERE id=?',[r.id])));
  });
  // Verplaatsen tussen wagens; al geladen = eerst terugzetten.
  const isGeladen=taak=>!!get('SELECT id FROM verhuis_checks WHERE taak_id=? AND geladen=1 LIMIT 1',[taak]);
  function stopNaarWagen(req,t,doel){
    updateMetLog(req,'transport_taken',t.id,{rit_id:doel.id,wie:doel.chauffeur||'',volgorde:((get('SELECT MAX(volgorde) AS m FROM transport_taken WHERE rit_id=?',[doel.id])||{}).m||0)+1},`stop naar wagen #${doel.id}`);
    run('UPDATE verhuis_checks SET rit_id=? WHERE taak_id=?',[doel.id,t.id]);
    if(t.rit_id&&ctx.meldRitGewijzigd)ctx.meldRitGewijzigd(req,t.rit_id,'stop verplaatst');if(ctx.meldRitGewijzigd)ctx.meldRitGewijzigd(req,doel.id,'stop erbij');
  }
  app.post('/api/transport-taken/:id/naar-wagen',alleenKantoor,(req,res)=>{
    const t=get('SELECT * FROM transport_taken WHERE id=?',[req.params.id]),d=get('SELECT * FROM transport_ritten WHERE id=?',[(req.body||{}).rit_id]);
    if(!t||!d)return res.status(404).json({error:'Stop of wagen niet gevonden'});if(isGeladen(t.id)||t.status==='gedaan')return res.status(409).json({error:'Deze stop is al geladen of afgerond'});
    stopNaarWagen(req,t,d);res.json({ok:true});
  });
  app.post('/api/transport-regels/:id/naar-stop',alleenKantoor,(req,res)=>{
    const r=get('SELECT * FROM transport_regels WHERE id=?',[req.params.id]),t=get('SELECT * FROM transport_taken WHERE id=?',[(req.body||{}).taak_id]);
    if(!r||!t)return res.status(404).json({error:'Regel of stop niet gevonden'});
    const c=all('SELECT * FROM verhuis_checks WHERE taak_id=? AND ('+(r.bak_id?'bak_id=?':r.attribuut_id?'attribuut_id=?':'item_naam=?')+')',[r.taak_id,r.bak_id||r.attribuut_id||r.naam]);
    if(c.some(x=>x.geladen))return res.status(409).json({error:'Dit stuk is al geladen: zet het eerst terug'});
    if(t.status==='gedaan')return res.status(409).json({error:'Die stop is al afgerond'});
    const oud=get('SELECT rit_id FROM transport_taken WHERE id=?',[r.taak_id]);
    updateMetLog(req,'transport_regels',r.id,{taak_id:t.id},'stuk verplaatst');c.forEach(x=>run('UPDATE verhuis_checks SET taak_id=?,rit_id=? WHERE id=?',[t.id,t.rit_id,x.id]));
    if(ctx.meldRitGewijzigd){if(oud&&oud.rit_id)ctx.meldRitGewijzigd(req,oud.rit_id,'stuk verplaatst');if(t.rit_id)ctx.meldRitGewijzigd(req,t.rit_id,'stuk erbij');}
    res.json({ok:true});
  });
  // Punt 2: laadvolgorde omdraaien, een stockage aan een andere wagen geven, thuisplaats artikel, stockagekeuze.
  app.put('/api/wagens/:id/laadvolgorde',alleenKantoor,(req,res)=>{
    const r=get('SELECT * FROM transport_ritten WHERE id=?',[req.params.id]),l=(req.body||{}).locatie_ids;if(!r)return res.status(404).json({error:'Wagen niet gevonden'});
    if(!Array.isArray(l))return res.status(400).json({error:'locatie_ids is verplicht'});
    updateMetLog(req,'transport_ritten',r.id,{laadvolgorde:JSON.stringify(l.map(Number))},'laadvolgorde');if(ctx.meldRitGewijzigd)ctx.meldRitGewijzigd(req,r.id,'laadvolgorde');
    res.json(wagenData(get('SELECT * FROM transport_ritten WHERE id=?',[r.id])));
  });
  app.post('/api/wagens/:id/stockage-naar',alleenKantoor,(req,res)=>{
    const b=req.body||{},d=get('SELECT * FROM transport_ritten WHERE id=?',[b.rit_id]);if(!d)return res.status(404).json({error:'Wagen niet gevonden'});
    let n=0;all("SELECT * FROM transport_taken WHERE rit_id=? AND van_locatie_id=? AND type<>'ophaling' AND status<>'gedaan'",[req.params.id,b.locatie_id]).forEach(t=>{if(isGeladen(t.id))return;stopNaarWagen(req,t,d);n++;});
    res.json({ok:true,verplaatst:n});
  });
  app.put('/api/item-types/:id/thuisplaats',alleenKantoor,(req,res)=>{
    const l=(req.body||{}).locatie_id||null;if(l&&!get("SELECT id FROM locaties WHERE id=?",[l]))return res.status(400).json({error:'Onbekende locatie'});
    updateMetLog(req,'item_types',req.params.id,{thuislocatie_id:l},'thuisplaats');res.json({ok:true});
  });
  app.get('/api/stockages',alleenKantoor,(req,res)=>res.json(all("SELECT id,name AS naam,stockage_rol FROM locaties WHERE type='stockage' ORDER BY name")));
  // De mensen op een wagen krijgen dezelfde meldingen als de bestuurder.
  const eigen=(req,pid)=>req&&req.persoon&&req.persoon.persoon_id===pid;
  const extraMeld=(req,ritId,tekst)=>all('SELECT personeel_id FROM rit_personen WHERE rit_id=?',[ritId]).forEach(p=>{if(!eigen(req,p.personeel_id))ctx.melding(req,{voor_persoon_id:p.personeel_id,van_naam:'Kantoor',tekst,link:'/vandaag',niveau:'vandaag'});});
  const gw=ctx.meldRitGewijzigd,gk=ctx.meldRitKlaar;
  ctx.meldRitGewijzigd=(req,rit,wat)=>{gw(req,rit,wat);const id=rit&&rit.id||rit,r=get('SELECT status,klaarzet_status FROM transport_ritten WHERE id=?',[id]);if(r&&(r.klaarzet_status==='klaar'||r.status==='onderweg')&&!['gedaan','geannuleerd'].includes(r.status))extraMeld(req,id,`Rit #${id} is gewijzigd`);};
  ctx.meldRitKlaar=(req,id)=>{gk(req,id);all('SELECT personeel_id FROM rit_personen WHERE rit_id=?',[id]).forEach(p=>{if(!eigen(req,p.personeel_id))ctx.melding(req,{voor_persoon_id:p.personeel_id,van_naam:'Kantoor',tekst:`Rit #${id} staat voor je klaar`,link:'/vandaag',niveau:'info'});});};

  // ── Punt 4: afspraak ──
  const afspBody=b=>{
    if(!SOORT[b.soort])return {fout:'Kies een soort'};if(!/^\d{4}-\d{2}-\d{2}$/.test(b.datum||''))return {fout:'Datum is verplicht'};
    if(!hhmm(b.van))return {fout:'Van moet HH:MM zijn'};if(b.tot&&!hhmm(b.tot))return {fout:'Tot moet HH:MM zijn'};return {};
  };
  app.post('/api/afspraken',alleenKantoor,(req,res)=>{
    const b=req.body||{},f=afspBody(b);if(f.fout)return res.status(400).json({error:f.fout});
    const vid=parseInt(b.voertuig_id)||null,pid=parseInt(b.personeel_id)||null,v=hhmm(b.van),t=hhmm(b.tot)||'',mld=[];
    if(vid&&ctx._ritTijden)all("SELECT * FROM transport_ritten WHERE datum=? AND voertuig_id=? AND status<>'geannuleerd'",[b.datum,vid]).forEach(o=>{const i=ctx._ritTijden(o),x=min(i.vertrek),y=min(i.einde)??(x==null?null:x+60);if(x==null||(x<(min(t)??min(v)+60)&&min(v)<y))mld.push(`Let op: dit voertuig rijdt dan op rit #${o.id}`);});
    if(pid)all("SELECT * FROM transport_ritten WHERE datum=? AND status<>'geannuleerd'",[b.datum]).forEach(o=>{if(!mensen(o).some(m=>m.id===pid))return;const i=ctx._ritTijden(o),x=min(i.vertrek),y=min(i.einde)??(x==null?null:x+60);if(x==null||(x<(min(t)??min(v)+60)&&min(v)<y))mld.push(`Let op: ${persNaam(pid)} rijdt dan op rit #${o.id}`);});
    let oid=null;
    if(vid&&['garage','autokeuring'].includes(b.soort))oid=insMetLog(req,'voertuig_onderhoud',['voertuig_id','datum_van','datum_tot','reden'],[vid,b.datum,b.datum,SOORT[b.soort]+(b.waar?': '+b.waar:'')],'afspraak'); // gekoppeld aan Voertuigen
    const id=insMetLog(req,'afspraken',['soort','voertuig_id','personeel_id','datum','van','tot','waar','status','onderhoud_id','created_at'],[b.soort,vid,pid,b.datum,v,t,String(b.waar||'').slice(0,300),'open',oid,now()],'afspraak');
    if(pid&&!eigen(req,pid))ctx.melding(req,{voor_persoon_id:pid,van_naam:req.persoon.naam,tekst:`Afspraak: ${SOORT[b.soort]} op ${b.datum} om ${v}`,link:'/vandaag',niveau:'vandaag'});
    res.json({...AFSPR(get('SELECT * FROM afspraken WHERE id=?',[id])),melding:[...new Set(mld)].join(' · ')});
  });
  app.delete('/api/afspraken/:id',alleenKantoor,(req,res)=>{
    const a=get('SELECT * FROM afspraken WHERE id=?',[req.params.id]);if(!a)return res.json({ok:true});
    if(a.onderhoud_id)delMetLog(req,'voertuig_onderhoud',a.onderhoud_id,'afspraak weg');delMetLog(req,'afspraken',a.id,'afspraak weg');res.json({ok:true});
  });
  app.get('/api/afspraken/vandaag',(req,res)=>{
    const d=new Date(),datum=/^\d{4}-\d{2}-\d{2}$/.test(req.query.datum||'')?req.query.datum:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const l=all('SELECT * FROM afspraken WHERE datum=? ORDER BY van,id',[datum]);
    res.json({afspraken:(req.persoon.rol==='kantoor'?l:l.filter(a=>a.personeel_id===req.persoon.persoon_id)).map(AFSPR)});
  });
  app.post('/api/afspraken/:id/klaar',(req,res)=>{
    const a=get('SELECT * FROM afspraken WHERE id=?',[req.params.id]);if(!a)return res.status(404).json({error:'Afspraak niet gevonden'});
    if(req.persoon.rol!=='kantoor'&&a.personeel_id!==req.persoon.persoon_id)return res.status(403).json({error:'Dit is niet jouw afspraak'});
    if(a.status!=='klaar')updateMetLog(req,'afspraken',a.id,{status:'klaar',echte_einde:nuHm()},'afspraak klaar');
    res.json(AFSPR(get('SELECT * FROM afspraken WHERE id=?',[a.id])));
  });

  // ── Punt 5: feedback (onwisbaar) ──
  const FB=['rit','locatie','voertuig','probleem'];
  function feedback(req,res,{rit,wie,pid}){
    const b=req.body||{},soort=b.soort,tekst=String(b.tekst||'').trim().slice(0,2000);
    if(!FB.includes(soort))return res.status(400).json({error:'Kies waarover het gaat'});if(!tekst)return res.status(400).json({error:'Schrijf kort wat er is'});
    let f={pad:'',url:''};try{if(b.foto_data)f=fotos.verwerkWaarde(b.foto_data,'','feedback');}catch(e){return res.status(e.status||400).json({error:e.message||'Foto kon niet bewaard worden'});}
    const eerste=rit?takenVan(rit.id)[0]:null,loc=parseInt(b.locatie_id)||(eerste?stopLoc(eerste):null),vt=parseInt(b.voertuig_id)||(rit&&rit.voertuig_id)||null;
    const id=ins('INSERT INTO feedback (soort,rit_id,opdracht_id,locatie_id,voertuig_id,tekst,foto_path,persoon_id,wie,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',[soort,rit?rit.id:null,rit?rit.opdracht_id:null,loc,vt,tekst,f.pad||'',pid||null,wie,new Date().toISOString()]);
    logAct('feedback',soort,`${wie}: ${tekst}`.slice(0,300),loc,null);
    if(soort==='probleem'&&rit&&eerste&&ctx.nuProbleem)ctx.nuProbleem(req,rit,eerste,tekst,loc);
    else ctx.melding(req,{voor_rol:'kantoor',van_naam:wie,tekst:`Feedback ${soort} van ${wie}: ${tekst}`.slice(0,300),link:'/meldingen',niveau:soort==='probleem'?'nu':'info'});
    res.json({ok:true,id});
  }
  app.post('/api/rit-token/:token/feedback',(req,res)=>{
    const rit=get('SELECT * FROM transport_ritten WHERE rit_token=?',[req.params.token]);if(!rit)return res.status(403).json({error:'Ongeldig of verlopen token'});
    feedback(req,res,{rit,wie:rit.chauffeur||'Chauffeur',pid:rit.personeel_id});
  });
  app.post('/api/feedback',(req,res)=>{const r=req.body&&req.body.rit_id?get('SELECT * FROM transport_ritten WHERE id=?',[req.body.rit_id]):null;feedback(req,res,{rit:r,wie:req.persoon.naam,pid:req.persoon.persoon_id});});
  app.get('/api/feedback',alleenKantoor,(req,res)=>{
    const w=[],p=[];[['rit_id','rit'],['locatie_id','locatie'],['voertuig_id','voertuig']].forEach(([k,q])=>{if(req.query[q]){w.push(k+'=?');p.push(req.query[q]);}});
    res.json({feedback:all(`SELECT * FROM feedback ${w.length?'WHERE '+w.join(' AND '):''} ORDER BY id DESC LIMIT 200`,p).map(x=>({...x,locatie:x.locatie_id?locNaam(x.locatie_id):'',voertuig:x.voertuig_id?(get('SELECT naam FROM voertuigen WHERE id=?',[x.voertuig_id])||{}).naam||'':'',foto_url:x.foto_path?'/uploads/'+x.foto_path:null}))});
  });
  // ── TF13 punt 3: meehelpen zonder op de rit te staan. Met de eigen sessie; plant niemand. Chauffeurs zien geen niet-klaargezette ritten. ──
  const zichtbaar=(r,rol)=>rol==='kantoor'||r.klaarzet_status==='klaar'||(r.status&&r.status!=='gepland');
  app.get('/api/meehelpen/ritten',(req,res)=>{
    const d=new Date(),datum=/^\d{4}-\d{2}-\d{2}$/.test(req.query.datum||'')?req.query.datum:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    res.json({datum,ritten:all("SELECT * FROM transport_ritten WHERE datum=? AND status<>'geannuleerd' ORDER BY vertrek,id",[datum]).filter(r=>zichtbaar(r,req.persoon.rol)).map(r=>{
      const t=takenVan(r.id);return {id:r.id,tijd:_ritPlanInfo(r).vertrek,mensen:mensen(r).map(m=>m.naam),voertuig:r.voertuig||'',stand:r.status==='gedaan'?'afgerond':r.status==='onderweg'?'onderweg':r.klaarzet_status==='klaar'?'klaargezet':'nog niet klaargezet',lading:ctx._ritLading?ctx._ritLading(r.id).tekst:'',stops:t.map(x=>locNaam(stopLoc(x)))};
    })});
  });
  app.get('/api/meehelpen/:id',(req,res)=>{
    const r=get('SELECT * FROM transport_ritten WHERE id=?',[req.params.id]);if(!r)return res.status(404).json({error:'Rit niet gevonden'});
    if(!zichtbaar(r,req.persoon.rol))return res.status(403).json({error:'Deze rit is nog niet klaargezet'});
    let t=r.rit_token;if(!t){t=ctx._genToken(10);run('UPDATE transport_ritten SET rit_token=? WHERE id=?',[t,r.id]);}
    res.json({token:t});
  });
  app.post('/api/meehelpen/:id/mee',(req,res)=>{
    const r=get('SELECT * FROM transport_ritten WHERE id=?',[req.params.id]),pid=req.persoon.persoon_id;if(!r)return res.status(404).json({error:'Rit niet gevonden'});
    if(!zichtbaar(r,req.persoon.rol))return res.status(403).json({error:'Deze rit is nog niet klaargezet'});
    if(r.personeel_id!==pid&&!ctx.isOpWagen(r.id,pid)){insMetLog(req,'rit_personen',['rit_id','personeel_id'],[r.id,pid],'op deze rit mee');ctx.melding(req,{voor_rol:'kantoor',van_naam:req.persoon.naam,tekst:`${req.persoon.naam} rijdt mee op rit #${r.id}`,link:'/opdracht?datum='+r.datum+'&rit='+r.id,niveau:'vandaag'});}
    res.json({ok:true});
  });
  // TF13 punt 4: alleen bekijken. Concepten niet; alleen de naam als persoonsgegeven.
  app.get('/api/planning-ploeg',(req,res)=>{
    const isoD=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,nu=new Date(),m=new Date(nu);m.setDate(m.getDate()+1);
    const datum=/^\d{4}-\d{2}-\d{2}$/.test(req.query.datum||'')?req.query.datum:isoD(nu),meeOk=datum===isoD(nu)||datum===isoD(m),per=new Map();
    const bij=(n,x)=>{if(!per.has(n))per.set(n,[]);per.get(n).push(x);};
    all("SELECT * FROM transport_ritten WHERE datum=? AND status<>'geannuleerd' ORDER BY id",[datum]).filter(r=>r.klaarzet_status==='klaar'||(r.status&&r.status!=='gepland')).forEach(r=>{
      const i=_ritPlanInfo(r),ms=mensen(r).map(x=>x.naam),item={soort:'rit',id:r.id,opdracht_id:r.opdracht_id,tijd:i.vertrek,einde:i.einde,voertuig:r.voertuig||'',stand:r.status==='gedaan'?'afgerond':r.status==='onderweg'?'onderweg':'klaargezet',mensen:ms,stops:takenVan(r.id).map(t=>locNaam(stopLoc(t))),kan_meehelpen:meeOk&&r.status!=='gedaan'};
      (ms.length?ms:['Nog niemand']).forEach(n=>bij(n,item));
    });
    all('SELECT * FROM afspraken WHERE datum=? ORDER BY van,id',[datum]).forEach(a=>bij(a.personeel_id?persNaam(a.personeel_id):'Zonder persoon',{soort:'afspraak',titel:SOORT[a.soort]||a.soort,van:a.van,tot:a.tot,voertuig:a.voertuig_id?(get('SELECT naam FROM voertuigen WHERE id=?',[a.voertuig_id])||{}).naam||'':'',klaar:a.status==='klaar'}));
    // TF14: kampen van die week. Een kampmoment zonder thema is nog niet ingevuld en blijft weg. Geen telefoonnummer.
    const dW=new Date(datum+'T12:00:00');dW.setDate(dW.getDate()-((dW.getDay()+6)%7));const ma=isoD(dW),DG=['ma','di','wo','do','vr','za','zo'];
    const kampen=all('SELECT * FROM kampmomenten').map(km=>{
      const pr=km.periode_id?get('SELECT start_datum FROM vakantieperiodes WHERE id=?',[km.periode_id]):null;if(!pr||!pr.start_datum||!km.week)return null;
      const m0=new Date(pr.start_datum+'T12:00:00');m0.setDate(m0.getDate()+(km.week-1)*7);m0.setDate(m0.getDate()-((m0.getDay()+6)%7));if(isoD(m0)!==ma)return null;
      const th=all('SELECT t.name,t.leeftijdsgroep AS tg,kt.leeftijdsgroep AS kg,kt.groepen,kt.dag FROM kampmoment_themas kt JOIN themas t ON t.id=kt.thema_id WHERE kt.kampmoment_id=? ORDER BY kt.dag,t.name',[km.id]);if(!th.length)return null;
      const dagen=[0,1,2,3,4].filter(i=>{const d=new Date(m0);d.setDate(d.getDate()+i);const iso=isoD(d),k=get('SELECT open FROM kalender_dagen WHERE locatie_id=? AND datum=?',[km.locatie_id,iso]);if(k)return !!k.open;return !get('SELECT id FROM gesloten_dagen WHERE datum=? AND (locatie_id IS NULL OR locatie_id=?) LIMIT 1',[iso,km.locatie_id]);}).map(i=>DG[i]);
      return {locatie:locNaam(km.locatie_id),week:km.week,kv:ctx._kvNaam(km)||'',dagen,themas:th.map(t=>({naam:t.name,groep:t.kg||t.tg||'',groepen:t.groepen||1,dag:t.dag?DG[t.dag-1]||'':''}))};
    }).filter(Boolean).sort((a,b)=>a.locatie.localeCompare(b.locatie,'nl'));
    const ik=req.persoon.naam;if(!per.has(ik))per.set(ik,[]);
    const tijd=x=>x.tijd||x.van||'99';
    res.json({datum,kampen,personen:[...per.entries()].map(([naam,items])=>({naam,eigen:naam===ik,items:items.sort((a,b)=>tijd(a).localeCompare(tijd(b)))})).sort((a,b)=>(b.eigen-a.eigen)||a.naam.localeCompare(b.naam,'nl'))});
  });
  app.get('/planning-ploeg',(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','planning-ploeg.html')));
  app.get('/meehelpen/:id',(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','meehelpen.html')));
  app.get('/opdracht',(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','opdracht.html')));
};
