// routes/nuoplossen.js — RT1 punt 1: wat een chauffeur meldt, gebundeld per rit en stop, en het blok Nu oplossen op Vandaag.
'use strict';
module.exports=function(ctx){
  const {app,get,all,run,ins,now,logAct,alleenKantoor}=ctx;
  const WOORD={niet_gevonden:'niet gevonden',past_niet:'past niet',kapot:'kapot'},LABEL={niet_gevonden:'Niet gevonden',past_niet:'Past niet',kapot:'Kapot'};
  const locNaam=id=>{const l=id?get('SELECT name FROM locaties WHERE id=?',[id]):null;return l?l.name:'?';};
  const chauffeurVan=r=>r.chauffeur||(r.personeel_id?(get('SELECT naam FROM personeel WHERE id=?',[r.personeel_id])||{}).naam:'')||'Chauffeur';
  const schoon=n=>String(n||'').replace(/^\d+\s*×\s*/,'');
  const BUNDEL_MS=10*60*1000;
  function tekstVan(meldingId,rit,locId){
    const rij=all("SELECT * FROM nu_oplossen WHERE melding_id=?",[meldingId]);
    const delen=[],tel={};
    rij.forEach(x=>{if(x.soort==='probleem')delen.push(x.label);else tel[x.soort]=(tel[x.soort]||0)+(x.qty||1);});
    const stuks=rij.filter(x=>x.soort!=='probleem');
    const lijst=stuks.length===1?[`${stuks[0].qty} × ${stuks[0].naam} ${WOORD[stuks[0].soort]}`]:Object.keys(tel).map((k,i)=>`${tel[k]} ${tel[k]===1?'stuk':'stuks'} ${WOORD[k]}`);
    return `${chauffeurVan(rit)} · rit #${rit.id} · ${locNaam(locId)}: ${[...lijst,...delen].join(', ')}`;
  }
  function herbereken(meldingId,rit,locId){
    const rij=all("SELECT soort FROM nu_oplossen WHERE melding_id=?",[meldingId]);
    const niveau=rij.some(x=>x.soort==='niet_gevonden'||x.soort==='probleem')?'nu':'vandaag';
    run('UPDATE meldingen SET tekst=?,niveau=?,bijgewerkt_op=?,gelezen_op=NULL WHERE id=?',[tekstVan(meldingId,rit,locId),niveau,new Date().toISOString(),meldingId]);
    run('DELETE FROM meldingen_gelezen WHERE melding_id=?',[meldingId]); // weer ongelezen
  }
  // Bundel: één melding per rit en stop; binnen 10 minuten werkt ze bij.
  function bundelMelding(rit,taak){
    const sleutel=`rit${rit.id}-stop${taak.id}`,m=get("SELECT * FROM meldingen WHERE bundel=? ORDER BY id DESC LIMIT 1",[sleutel]);
    if(m&&Date.now()-new Date(m.bijgewerkt_op||m.created_at).getTime()<BUNDEL_MS)return m.id;
    return ins("INSERT INTO meldingen (voor_rol,voor_persoon_id,van_naam,tekst,link,created_at,niveau,bundel,bijgewerkt_op) VALUES ('kantoor',NULL,?,'…','/vandaag',?,'vandaag',?,?)",[chauffeurVan(rit),new Date().toISOString(),sleutel,new Date().toISOString()]);
  }
  function rijToe(req,{soort,rit,taak,check,restTaakId,naam,qty,label,locId}){
    const mid=bundelMelding(rit,taak);
    ins('INSERT INTO nu_oplossen (soort,rit_id,taak_id,check_id,rest_taak_id,melding_id,naam,qty,label,locatie_id,bak_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',[soort,rit.id,taak.id,check?check.id:null,restTaakId||null,mid,naam||'',qty||1,label||'',locId||null,check?check.bak_id:null,now()]);
    herbereken(mid,rit,locId);
    if(ctx.meldingLive)ctx.meldingLive(mid);
    return mid;
  }
  ctx.nuRestLabel=(reden,qty,naam)=>`${LABEL[reden]}: ${qty} × ${schoon(naam)}`;
  ctx.nuMeld=(req,a)=>{try{rijToe(req,{soort:a.reden,rit:a.rit,taak:a.taak,check:a.check,restTaakId:a.restTaakId,naam:schoon(a.check.item_naam),qty:a.qty,locId:a.taak.van_locatie_id||a.taak.naar_locatie_id});}catch(e){console.error('Nu oplossen mislukt:',e.message);}};
  ctx.nuProbleem=(req,rit,taak,tekst,locId)=>{try{rijToe(req,{soort:'probleem',rit,taak,label:tekst,locId});}catch(e){console.error('Nu oplossen mislukt:',e.message);}};
  function sluit(req,x,status,wie){
    run('UPDATE nu_oplossen SET status=?,afgehandeld_door=?,afgehandeld_op=? WHERE id=?',[status,wie,now(),x.id]);
    logAct('transport','nu oplossen',`${wie}: ${x.qty} × ${x.naam||x.label} (rit #${x.rit_id}): ${status}`,x.locatie_id,null);
    if(x.melding_id&&!get("SELECT id FROM nu_oplossen WHERE melding_id=? AND status='open' LIMIT 1",[x.melding_id])){ // alles afgehandeld = gelezen
      all("SELECT id FROM personeel WHERE rol='kantoor'").forEach(p=>run('INSERT OR IGNORE INTO meldingen_gelezen (melding_id,persoon_id,gelezen_op) VALUES (?,?,?)',[x.melding_id,p.id,new Date().toISOString()]));
      run('UPDATE meldingen SET gelezen_op=? WHERE id=?',[new Date().toISOString(),x.melding_id]);
    }
  }
  // De chauffeur vond het toch: terugzetten sluit de regel, kantoor ziet het meteen.
  ctx.nuTerug=(req,rit,check)=>{
    const x=get("SELECT * FROM nu_oplossen WHERE check_id=? AND status='open' ORDER BY id DESC LIMIT 1",[check.id]);if(!x)return;
    sluit(req,x,'gevonden door chauffeur',chauffeurVan(rit));
    const lb=ctx.nuRestLabel(x.soort,x.qty,x.naam),t=x.rest_taak_id&&get('SELECT * FROM transport_taken WHERE id=?',[x.rest_taak_id]);
    if(t)run('UPDATE transport_taken SET opmerking=? WHERE id=?',[String(t.opmerking||'').split(', ').filter(d=>d!==lb).join(', '),t.id]);
    ctx.melding(req,{voor_rol:'kantoor',van_naam:chauffeurVan(rit),niveau:'info',tekst:`${chauffeurVan(rit)} · rit #${rit.id}: ${x.qty} × ${x.naam} toch gevonden`,link:'/vandaag'});
  };
  function details(x){
    const bak=x.bak_id?get('SELECT * FROM bakken WHERE id=?',[x.bak_id]):null;
    const c=x.check_id?get('SELECT * FROM verhuis_checks WHERE id=?',[x.check_id]):null;
    const waar=bak?[locNaam(bak.thuislocatie_id||bak.huidige_locatie_id),bak.rek?'rek '+bak.rek:'',bak.plank?'plank '+bak.plank:''].filter(Boolean).join(' · '):locNaam(x.locatie_id);
    const lr=c?get(`SELECT r.id,r.datum,r.chauffeur,r.personeel_id FROM verhuis_checks v JOIN transport_ritten r ON r.id=v.rit_id WHERE v.geladen=1 AND r.id<>? AND ${c.bak_id?'v.bak_id=?':'v.item_naam=?'} ORDER BY v.id DESC LIMIT 1`,[x.rit_id,c.bak_id||c.item_naam]):null;
    const lt=c?get(`SELECT geteld,wie,op AS created_at FROM kv_telling_versies WHERE item_naam=? ORDER BY id DESC LIMIT 1`,[schoon(c.item_naam)]):null;
    return {id:x.id,soort:x.soort,titel:x.soort==='probleem'?x.label:`${x.qty} × ${x.naam} ${WOORD[x.soort]}`,waar_normaal:waar,
      laatste_rit:lr?`rit #${lr.id} · ${lr.datum||''} · ${chauffeurVan(lr)}`:'geen eerdere rit',
      laatste_telling:lt?`${lt.geteld} geteld · ${lt.wie||'?'} · ${String(lt.created_at||'').slice(0,10)}`:'geen telling',
      acties:x.soort==='probleem'?['opgelost']:['gevonden','inplannen','afschrijven']};
  }
  ctx.nuLijst=()=>{
    const open=all("SELECT * FROM nu_oplossen WHERE status='open' ORDER BY id"),per=new Map();
    open.forEach(x=>{if(!per.has(x.rit_id)){const r=get('SELECT * FROM transport_ritten WHERE id=?',[x.rit_id])||{id:x.rit_id};const p=r.personeel_id?get('SELECT telefoon FROM personeel WHERE id=?',[r.personeel_id]):(ctx.persoonOpNaam&&r.chauffeur?(()=>{const q=ctx.persoonOpNaam(r.chauffeur);return q?get('SELECT telefoon FROM personeel WHERE id=?',[q.id]):null;})():null);
      per.set(x.rit_id,{rit_id:x.rit_id,chauffeur:chauffeurVan(r),telefoon:(p&&p.telefoon)||'',locatie:locNaam(x.locatie_id),items:[]});}
      per.get(x.rit_id).items.push(details(x));});
    return [...per.values()];
  };
  app.get('/api/nu-oplossen',alleenKantoor,(req,res)=>res.json({ritten:ctx.nuLijst()}));
  app.post('/api/nu-oplossen/:id',alleenKantoor,(req,res)=>{
    const x=get("SELECT * FROM nu_oplossen WHERE id=?",[req.params.id]);if(!x)return res.status(404).json({error:'Niet gevonden'});
    if(x.status!=='open')return res.status(409).json({error:'Dit is al afgehandeld'});
    const a=(req.body||{}).actie,wie=req.persoon.naam;
    if(!(x.soort==='probleem'?['opgelost']:['gevonden','inplannen','afschrijven']).includes(a))return res.status(400).json({error:'Onbekende actie'});
    const rit=get('SELECT * FROM transport_ritten WHERE id=?',[x.rit_id]),c=x.check_id?get('SELECT * FROM verhuis_checks WHERE id=?',[x.check_id]):null,taak=c?get('SELECT * FROM transport_taken WHERE id=?',[c.taak_id]):null;
    if(a==='gevonden'){
      if(c&&taak&&rit&&rit.status!=='gedaan'&&taak.status!=='gedaan'&&c.niet_mee_reden){ctx._ritTerugzet(req,c,taak);}
      else if(x.rest_taak_id){const t=get('SELECT * FROM transport_taken WHERE id=?',[x.rest_taak_id]);if(t)run('UPDATE transport_taken SET opmerking=? WHERE id=?',[String(t.opmerking||'').replace(ctx.nuRestLabel(x.soort,x.qty,x.naam),`Gevonden: ${x.qty} × ${x.naam}`),t.id]);}
    }
    if(a==='afschrijven'&&c&&c.rest_regel_id){
      run('DELETE FROM transport_regels WHERE id=?',[c.rest_regel_id]);
      if(x.rest_taak_id&&!get('SELECT id FROM transport_regels WHERE taak_id=? LIMIT 1',[x.rest_taak_id]))run('DELETE FROM transport_taken WHERE id=?',[x.rest_taak_id]);
    }
    sluit(req,x,{gevonden:'gevonden',inplannen:'toch inplannen',afschrijven:'afgeschreven',opgelost:'opgelost'}[a],wie);
    res.json({ok:true});
  });
};
