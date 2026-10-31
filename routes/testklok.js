// routes/testklok.js — TK1: wordt alleen geladen met SPORTY_TESTKLOK=1; anders bestaan deze routes niet (404).
// Bewuste keuze (Maxim 31/10): zonder login aanpasbaar, omdat hij ook als chauffeur en op de KV-link test. De veiligheid is de variabele. Elke wissel is gelogd.
'use strict';
const klok = require('../lib/testklok');
module.exports = function(ctx){
  const {app,get,run,logAct,checkSessie} = ctx;
  const toon = d => new klok.EchteDate(d).toLocaleString('nl-BE',{weekday:'short',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const stand = () => ({aan:true,verschil:klok.verschil(),nu:new klok.EchteDate(klok.echteNu()+klok.verschil()).toISOString(),verzet:klok.verschil()!==0});
  app.get('/api/testklok',(req,res)=>res.json(stand()));
  app.post('/api/testklok',(req,res)=>{
    const b=req.body||{},nu=klok.echteNu()+klok.verschil();
    let doel;
    if(b.actie==='echt')doel=klok.echteNu();
    else if(b.actie==='plus_uur')doel=nu+36e5;
    else if(b.actie==='plus_dag'){const d=new klok.EchteDate(nu);d.setDate(d.getDate()+1);doel=d.getTime();}
    else if(b.actie==='maandag'||b.actie==='vrijdag'){
      const dag=b.actie==='maandag'?1:5,d=new klok.EchteDate(nu);
      do d.setDate(d.getDate()+1);while(d.getDay()!==dag);
      d.setHours(dag===1?8:16,0,0,0);doel=d.getTime();
    }else if(/^\d{4}-\d{2}-\d{2}$/.test(b.datum||'')&&/^\d{2}:\d{2}$/.test(b.uur||'')){
      doel=new klok.EchteDate(`${b.datum}T${b.uur}:00`).getTime();
      if(isNaN(doel))return res.status(400).json({error:'Ongeldige datum of uur'});
    }else return res.status(400).json({error:'Kies een datum en uur, of een snelknop'});
    const p=checkSessie(req.headers['x-auth-token']||'');
    const via=String(b.via||'').replace(/\/(rit|kv|tel)\/.*/,'/$1/…').slice(0,60);
    klok.zet(b.actie==='echt'?0:doel-klok.echteNu(),{run});
    logAct('testklok','wissel',`Testklok ${toon(nu)} → ${toon(doel)} · echte tijd ${toon(klok.echteNu())} · via ${via||'?'} · ${p?p.naam:'zonder login'}`,null,null);
    res.json(stand());
  });
};
