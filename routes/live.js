// routes/live.js — RT1: /api/live, voorkeuren en Web Push. Zonder VAPID-variabelen staat push stil uit.
'use strict';
const live=require('../lib/live');
module.exports=function(ctx){
  const {app,get,all,run,ins,now,path,ROOT_DIR,checkSessie,alleenKantoor}=ctx;
  const MOCK=process.env.SPORTY_PUSH_MOCK==='1',PUB=process.env.VAPID_PUBLIC_KEY||'',PRIV=process.env.VAPID_PRIVATE_KEY||'',SUBJ=process.env.VAPID_SUBJECT||'mailto:info@sporty.be';
  let wp=null;if(PUB&&PRIV&&!MOCK){try{wp=require('web-push');wp.setVapidDetails(SUBJ,PUB,PRIV);}catch(e){console.warn('Push uit:',e.message);wp=null;}}
  const pushAan=()=>MOCK||!!wp,verzonden=[];
  live.zetResolve(pad=>{
    let m=/^\/api\/rit-token\/([^/]+)/.exec(pad);if(m){const r=get('SELECT id FROM transport_ritten WHERE rit_token=?',[m[1]]);return r?{rit_id:r.id}:null;}
    m=/^\/api\/kv\/([^/]+)/.exec(pad);if(m&&ctx._kvToegang){const t=ctx._kvToegang(m[1]);return t?{km_id:t.km.id}:null;}
    return null;
  });
  app.get('/api/live',(req,res)=>{
    const tok=req.headers['x-auth-token'],s=tok?checkSessie(tok):null;
    if(s)return live.voeg(res,{soort:'sessie',persoon_id:s.persoon_id,rol:s.rol});
    if(req.query.rit){const r=get('SELECT id,personeel_id FROM transport_ritten WHERE rit_token=?',[String(req.query.rit)]);if(r)return live.voeg(res,{soort:'rit',rit_id:r.id,personeel_id:r.personeel_id});}
    if(req.query.kv&&ctx._kvToegang){const t=ctx._kvToegang(String(req.query.kv));if(t)return live.voeg(res,{soort:'kv',km_id:t.km.id});}
    res.status(401).json({error:'Niet ingelogd'});
  });
  const voorkeur=pid=>get('SELECT geluid,push FROM melding_voorkeur WHERE persoon_id=?',[pid])||{geluid:1,push:'nu'};
  app.get('/api/meldingen/voorkeur',(req,res)=>res.json({...voorkeur(req.persoon.persoon_id),push_kan:pushAan(),sleutel:PUB||(MOCK?'mock':'')}));
  app.put('/api/meldingen/voorkeur',(req,res)=>{
    const o=voorkeur(req.persoon.persoon_id),b=req.body||{},g=b.geluid===undefined?o.geluid:(b.geluid?1:0),p=b.push===undefined?o.push:b.push;
    if(!['alles','nu','uit'].includes(p))return res.status(400).json({error:'Kies alles, nu of uit'});
    run('INSERT OR REPLACE INTO melding_voorkeur (persoon_id,geluid,push) VALUES (?,?,?)',[req.persoon.persoon_id,g,p]);res.json({geluid:g,push:p});
  });
  app.post('/api/push/inschrijven',(req,res)=>{
    const s=req.body||{};if(!s.endpoint||!/^https:/.test(s.endpoint))return res.status(400).json({error:'Ongeldige inschrijving'});
    run('DELETE FROM push_inschrijvingen WHERE endpoint=?',[s.endpoint]);
    ins('INSERT INTO push_inschrijvingen (persoon_id,endpoint,p256dh,auth,created_at) VALUES (?,?,?,?,?)',[req.persoon.persoon_id,s.endpoint,(s.keys||{}).p256dh||'',(s.keys||{}).auth||'',now()]);res.json({ok:true});
  });
  app.post('/api/push/uitschrijven',(req,res)=>{run('DELETE FROM push_inschrijvingen WHERE endpoint=? AND persoon_id=?',[String((req.body||{}).endpoint||''),req.persoon.persoon_id]);res.json({ok:true});});
  if(MOCK)app.get('/api/push/_mock',(req,res)=>res.json({verzonden,inschrijvingen:all('SELECT id,persoon_id,endpoint FROM push_inschrijvingen')}));
  // Bezorgen: info nooit; vandaag alleen voor wie "alles" koos (Maxims niveaus: standaard geen push); nu voor alles en nu. Verlopen inschrijvingen ruimen we op.
  async function zend(s,bericht){
    if(MOCK){verzonden.push({endpoint:s.endpoint,persoon_id:s.persoon_id,...bericht});if(/verlopen/.test(s.endpoint))run('DELETE FROM push_inschrijvingen WHERE id=?',[s.id]);return;}
    try{await wp.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify(bericht));}
    catch(e){if(e.statusCode===404||e.statusCode===410)run('DELETE FROM push_inschrijvingen WHERE id=?',[s.id]);else console.warn('Push mislukt:',e.statusCode||e.message);}
  }
  function push(m){
    if(!pushAan()||m.niveau==='info')return;
    const ids=m.voor_persoon_id?[m.voor_persoon_id]:all("SELECT id FROM personeel WHERE COALESCE(actief,1)=1 AND rol=?",[m.voor_rol]).map(p=>p.id).filter(i=>i!==m.van_persoon_id);
    ids.forEach(id=>{const v=voorkeur(id).push;if(v==='uit'||(v==='nu'&&m.niveau!=='nu'))return;
      all('SELECT * FROM push_inschrijvingen WHERE persoon_id=?',[id]).forEach(s=>zend(s,{titel:'Sporty',tekst:m.tekst,link:m.link||'/meldingen',niveau:m.niveau}));});
  }
  // Na elke nieuwe of bijgewerkte melding: naar de open schermen, en push tenzij de vorige minder dan 5 minuten oud is.
  ctx.meldingLive=function(id){
    const m=get('SELECT * FROM meldingen WHERE id=?',[id]);if(!m)return;
    live.melding({...m,niveau:m.niveau||'vandaag'});
    const nu=Date.now(),vorig=m.gepusht_op?new Date(m.gepusht_op).getTime():0;
    if(nu-vorig<5*60*1000)return;
    run('UPDATE meldingen SET gepusht_op=? WHERE id=?',[new Date(nu).toISOString(),id]);push({...m,niveau:m.niveau||'vandaag'});
  };
  app.get('/sw.js',(req,res)=>{res.set('Service-Worker-Allowed','/');res.sendFile(path.join(ROOT_DIR,'public','sw.js'));});
  app.get('/manifest.json',(req,res)=>res.type('application/manifest+json').sendFile(path.join(ROOT_DIR,'public','manifest.json')));
};
