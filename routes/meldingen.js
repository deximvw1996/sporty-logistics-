// routes/meldingen.js — ME1 punt 1: meldingen met echte bronnen. Tabel meldingen (voor_persoon_id leeg = iedereen met die rol).
// Andere routes schrijven via ctx.melding(req,{...}); dezelfde ongelezen melding voor dezelfde ontvanger wordt niet dubbel gemaakt.
// Gelezen: persoonlijke melding in meldingen.gelezen_op; een melding voor een hele rol per persoon in meldingen_gelezen,
// zodat de ene coördinator ze niet wegleest voor de andere. Alles gelogd (wijzigingen).
'use strict';
module.exports = function(ctx){
  const {app,get,all,now,insMetLog,updateMetLog,alleenKantoor,logAct,path,ROOT_DIR} = ctx;
  const ROLLEN=['kantoor','chauffeur','coordinator','monitor'];
  const isoNu=()=>new Date().toISOString();

  function melding(req,{voor_rol,voor_persoon_id,van_naam,tekst,link}){
    try{
      const pid=voor_persoon_id||null,rol=pid?'':(voor_rol||'');
      if(!tekst||(!pid&&!rol))return null;
      const dubbel=get("SELECT id FROM meldingen WHERE tekst=? AND COALESCE(voor_rol,'')=? AND voor_persoon_id IS ? AND gelezen_op IS NULL",[tekst,rol,pid]);
      if(dubbel)return dubbel.id;
      return insMetLog(req||null,'INSERT INTO meldingen (voor_rol,voor_persoon_id,van_naam,tekst,link,created_at) VALUES (?,?,?,?,?,?)',[rol,pid,van_naam||'',String(tekst),link||'',isoNu()],'melding');
    }catch(e){console.error('Melding mislukt:',e.message);return null;} // een melding mag de echte actie nooit blokkeren
  }
  // Rit-bestuurder: gekoppeld personeelslid, anders exact één actieve persoon met die naam (hoofdletterongevoelig).
  function persoonOpNaam(naam){
    const n=String(naam||'').trim().toLowerCase();if(!n)return null;
    const l=all('SELECT id,naam FROM personeel WHERE COALESCE(actief,1)=1').filter(p=>String(p.naam||'').trim().toLowerCase()===n);
    return l.length===1?l[0]:null;
  }
  // Voor de bestuurder als een rit wijzigt die al klaarstond (zelf wijzigen geeft geen melding).
  function ritGewijzigd(req,ritVoor,wat){
    if(!ritVoor||ritVoor.klaarzet_status!=='klaar')return;
    const pid=ritVoor.personeel_id||(persoonOpNaam(ritVoor.chauffeur)||{}).id;
    if(!pid||(req&&req.persoon&&req.persoon.persoon_id===pid))return;
    melding(req,{voor_persoon_id:pid,van_naam:'Kantoor',tekst:`Rit #${ritVoor.id} is gewijzigd terwijl ze klaarstond: ${wat}`,link:ritVoor.rit_token?'/rit/'+ritVoor.rit_token:'/vandaag?tab=ritten'});
  }
  const voorWhere="(voor_persoon_id=? OR (voor_persoon_id IS NULL AND voor_rol=?))";
  function vanPersoon(p,alleenOngelezen){
    const gel=new Set(all('SELECT melding_id FROM meldingen_gelezen WHERE persoon_id=?',[p.persoon_id]).map(r=>r.melding_id));
    return all(`SELECT * FROM meldingen WHERE ${voorWhere} ORDER BY id DESC LIMIT 200`,[p.persoon_id,p.rol])
      .map(m=>({id:m.id,van_naam:m.van_naam||'',tekst:m.tekst,titel:(m.van_naam?m.van_naam+': ':'')+m.tekst,link:m.link||'',created_at:m.created_at,voor_rol:m.voor_rol||'',voor_persoon_id:m.voor_persoon_id,gelezen:!!(m.gelezen_op||gel.has(m.id))}))
      .filter(m=>!alleenOngelezen||!m.gelezen);
  }
  function leesVoor(req,m){
    if(m.voor_persoon_id)updateMetLog(req,'meldingen',m.id,{gelezen_op:isoNu()},'melding gelezen');
    else if(!get('SELECT id FROM meldingen_gelezen WHERE melding_id=? AND persoon_id=?',[m.id,req.persoon.persoon_id]))
      insMetLog(req,'INSERT INTO meldingen_gelezen (melding_id,persoon_id,gelezen_op) VALUES (?,?,?)',[m.id,req.persoon.persoon_id,isoNu()],'melding gelezen');
  }
  Object.assign(ctx,{melding,meldingenVan:vanPersoon,persoonOpNaam,meldRitGewijzigd:ritGewijzigd});

  app.get('/api/meldingen',(req,res)=>{const l=vanPersoon(req.persoon,false);res.json({meldingen:l,ongelezen:l.filter(m=>!m.gelezen).length});});
  app.get('/api/meldingen/ontvangers',alleenKantoor,(req,res)=>res.json({rollen:ROLLEN,personen:all("SELECT id,naam,rol FROM personeel WHERE COALESCE(actief,1)=1 AND rol<>'kv' ORDER BY naam")}));
  app.post('/api/meldingen/alles-gelezen',(req,res)=>{
    const ids=vanPersoon(req.persoon,true);ids.forEach(x=>leesVoor(req,get('SELECT * FROM meldingen WHERE id=?',[x.id])));res.json({ok:true,gelezen:ids.length});
  });
  app.post('/api/meldingen/:id/gelezen',(req,res)=>{
    const m=get(`SELECT * FROM meldingen WHERE id=? AND ${voorWhere}`,[req.params.id,req.persoon.persoon_id,req.persoon.rol]);
    if(!m)return res.status(404).json({error:'Melding niet gevonden'});
    leesVoor(req,m);res.json({ok:true});
  });
  app.post('/api/meldingen',alleenKantoor,(req,res)=>{
    const b=req.body||{},tekst=String(b.tekst||'').trim(),pid=parseInt(b.voor_persoon_id)||null,rol=b.voor_rol||'';
    if(!tekst)return res.status(400).json({error:'Tekst is verplicht'});
    if(pid){if(!get('SELECT id FROM personeel WHERE id=?',[pid]))return res.status(400).json({error:'Onbekende persoon'});}
    else if(!ROLLEN.includes(rol))return res.status(400).json({error:'Kies een persoon of een rol'});
    const link=/^\/(?![\/\\])/.test(b.link||'')?b.link:'';
    const id=melding(req,{voor_rol:rol,voor_persoon_id:pid,van_naam:req.persoon.naam,tekst,link});
    logAct('melding','bericht',`Bericht van ${req.persoon.naam} aan ${pid?(get('SELECT naam FROM personeel WHERE id=?',[pid])||{}).naam:rol}: ${tekst}`,null,null);
    res.json({ok:true,id});
  });
  app.get('/meldingen',(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','meldingen.html')));
};
