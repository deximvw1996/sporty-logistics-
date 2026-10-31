// routes/taken.js — TR1: Transport › Taken op het standaardpagina-patroon (design/mockup-transport-taken.html).
// Alleen lezen: GET /api/taken-overzicht (lijst + tellers) en GET /api/taken/:id/detail; acties gebruiken de
// bestaande routes. Data en weergave gescheiden (MOBIEL-REGEL: de gsm-laag past op dezelfde API).
'use strict';
module.exports = function(ctx){
  const {app,get,all,alleenKantoor,path,ROOT_DIR,_ritPlanInfo,updateMetLog,delMetLog,logAct} = ctx;

  const DAG=['zo','ma','di','wo','do','vr','za'];
  const MND=['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
  const d0=s=>new Date(s+'T12:00:00');
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const locNaam=id=>id?((get('SELECT name FROM locaties WHERE id=?',[id])||{}).name||'?'):'?';
  const stopLoc=t=>t.type==='ophaling'?(t.van_locatie_id||t.naar_locatie_id):(t.naar_locatie_id||t.van_locatie_id);
  const isRest=t=>/^Rest van rit/.test(t.opmerking||'');
  const isWeekend=t=>!!t.datum&&[0,6].includes(d0(t.datum).getDay());
  const BAKSOORTEN=['thema','vast','bak'];
  function wanneer(t){if(!t.datum)return t.week?`week ${t.week}`:'geen datum';const d=d0(t.datum);
    return `${DAG[d.getDay()]} ${d.getDate()} ${MND[d.getMonth()]}${t.rit_id&&t.tijd?' '+t.tijd:''}`;}
  // "14 bakken" / "9 bakken + 2 springk." / "Oven 1": bakken apart geteld, de rest bij naam.
  function wat(regels){
    if(!regels.length)return '—';
    const bak=regels.filter(r=>BAKSOORTEN.includes(r.soort)),rest=regels.filter(r=>!BAKSOORTEN.includes(r.soort));
    const delen=[];
    const nb=bak.reduce((s,r)=>s+(r.qty||1),0);if(nb)delen.push(`${nb} bak${nb===1?'':'ken'}`);
    if(rest.length<=2)rest.forEach(r=>delen.push(`${r.naam.replace(/\s*\([^)]*\)\s*$/,'')} ×${r.qty||1}`));
    else delen.push(`${rest.reduce((s,r)=>s+(r.qty||1),0)} stuks`);
    return delen.join(' + ');
  }
  function rij(t,ritten){
    const rit=t.rit_id?ritten.get(t.rit_id):null;
    const regels=all('SELECT naam,qty,soort FROM transport_regels WHERE taak_id=?',[t.id]);
    const soort=isRest(t)?'rest':t.aanvraag_id?'aanvraag':['levering','ophaling'].includes(t.type)?t.type:'transfer';
    const pil=isRest(t)?'rest':isWeekend(t)?'weekend':(rit&&t.slot==='vrij')?'vrij':null;
    return {aanvraag_id:t.aanvraag_id||null,id:t.id,type:t.type,soort,pil,datum:t.datum||'',tijd:t.tijd||'',wanneer_tekst:wanneer(t),
      route:`${locNaam(t.van_locatie_id)} → ${locNaam(t.naar_locatie_id)}`,wat:wat(regels),
      rit:rit?{id:rit.id,chauffeur:rit.chauffeur||'',voertuig:rit.voertuig||'',status:rit.status}:null,
      slot:t.slot==='vrij'?'vrij':'vast',status:t.status,kampmoment_id:t.kampmoment_id||null,locatie_id:stopLoc(t)||null,
      zoek:[t.id,locNaam(t.van_locatie_id),locNaam(t.naar_locatie_id),rit?'rit #'+rit.id+' '+(rit.chauffeur||''):'',...regels.map(r=>r.naam)].join(' ').toLowerCase()};
  }

  app.get('/api/taken-overzicht',alleenKantoor,(req,res)=>{
    const basis=/^\d{4}-\d{2}-\d{2}$/.test(req.query.week||'')?d0(req.query.week):d0(iso(new Date()));
    basis.setDate(basis.getDate()-((basis.getDay()+6)%7));
    const ma=iso(basis);basis.setDate(basis.getDate()+6);const zo=iso(basis);
    const ritten=new Map(all('SELECT * FROM transport_ritten').map(r=>[r.id,r]));
    const sel=d=>all("SELECT * FROM transport_taken WHERE status<>'geannuleerd' AND datum>=? AND datum<=? ORDER BY datum,tijd,id",[d[0],d[1]]);
    // TF6 N1: "Alles" toont álle taken (ook leveringen vóór de periode of zonder datum). Staat er deze week niets en is er wel werk,
    // dan opent het scherm meteen op "Alles", zodat wat net gegenereerd is niet "verdwenen" lijkt.
    const alleTaken=()=>all("SELECT * FROM transport_taken WHERE status<>'geannuleerd' ORDER BY CASE WHEN COALESCE(datum,'')='' THEN '9999' ELSE datum END,COALESCE(tijd,''),id").map(t=>rij(t,ritten));
    const week=sel([ma,zo]).map(t=>rij(t,ritten));
    let toonAlle=req.query.alle==='1',auto=false;
    if(!toonAlle&&!/^\d{4}-\d{2}-\d{2}$/.test(req.query.week||'')&&!week.length){const nAll=get("SELECT COUNT(*) AS n FROM transport_taken WHERE status<>'geannuleerd'").n;if(nAll){toonAlle=true;auto=true;}}
    const taken=toonAlle?alleTaken():week;
    const datums=taken.map(t=>t.datum).filter(Boolean).sort();
    const van=toonAlle?(datums[0]||ma):ma,tot=toonAlle?(datums[datums.length-1]||zo):zo;
    const n=f=>taken.filter(f).length;
    res.json({week:{start:ma,eind:zo},bereik:{van,tot,alle:toonAlle,auto},
      tellers:{deze_week:taken.length,zonder_rit:n(t=>!t.rit&&t.status!=='gedaan'),levering:n(t=>t.type==='levering'),ophaling:n(t=>t.type==='ophaling'),
        rest:n(t=>t.soort==='rest'),weekend:n(t=>t.pil==='weekend'),gedaan:n(t=>t.status==='gedaan')},
      taken});
  });

  // Historiek: wijzigingen op de taak (en haar regels) + activiteitenlog dat de taak noemt, nieuwste eerst.
  function historiek(t){
    const uit=[];
    const veld=(o,n)=>{try{o=JSON.parse(o||'{}');n=JSON.parse(n||'{}');}catch(e){return '';}
      const k=Object.keys(n).filter(k=>String(o[k]??'')!==String(n[k]??'')&&!['created_at','wie'].includes(k));
      // Leesbare taal voor de velden die kantoor kent; de rest als 'veld: oud → nieuw'.
      return k.map(x=>x==='rit_id'?(n[x]?`op rit #${n[x]} gezet`:`van rit #${o[x]} gehaald`):`${x==='datum'?'datum':x}: ${o[x]||'—'} → ${n[x]||'—'}`).join(', ');};
    all("SELECT * FROM wijzigingen WHERE tabel='transport_taken' AND rij_id=? ORDER BY id DESC",[t.id]).forEach(w=>{
      const wat=w.actie==='insert'?'aangemaakt':w.actie==='delete'?'verwijderd':(veld(w.oud,w.nieuw)||'gewijzigd');
      uit.push({t:w.tijdstip,wie:w.persoon_naam||'',wat:wat+(w.context?` (${w.context})`:''),wijziging_id:w.id,sort:'w'+String(w.id).padStart(9,'0')});
    });
    all("SELECT * FROM activiteiten_log WHERE beschrijving LIKE ? OR beschrijving LIKE ? ORDER BY id DESC",[`%Taak #${t.id} %`,`%Taak #${t.id}:%`]).forEach(a=>
      uit.push({t:a.tijdstip,wie:'',wat:a.beschrijving,wijziging_id:null,sort:'a'+String(a.id).padStart(9,'0')}));
    // Op tijdstip sorteren lukt niet betrouwbaar (twee formaten); wijzigingen op id, logregels erachter.
    return uit.map(({sort,...r})=>r);
  }

  app.get('/api/taken/:id/detail',alleenKantoor,(req,res)=>{
    const t=get('SELECT * FROM transport_taken WHERE id=?',[req.params.id]);
    if(!t)return res.status(404).json({error:'Taak niet gevonden'});
    const regels=all('SELECT r.id,r.naam,r.qty,r.soort,b.code AS bak_code,a.code AS attr_code FROM transport_regels r LEFT JOIN bakken b ON b.id=r.bak_id LEFT JOIN attributen a ON a.id=r.attribuut_id WHERE r.taak_id=? ORDER BY r.id',[t.id])
      .map(r=>({id:r.id,code:r.bak_code||r.attr_code||(r.soort==='pool'?'P':''),naam:r.naam,qty:r.qty,soort:r.soort}));
    let rit=null,checks={geladen:0,gelost:0,totaal:0,klaargezet:false};
    const c=get('SELECT COUNT(*) AS n,COALESCE(SUM(geladen),0) AS g,COALESCE(SUM(gelost),0) AS l FROM verhuis_checks WHERE taak_id=?',[t.id]);
    checks={geladen:c.g,gelost:c.l,totaal:c.n||regels.length,klaargezet:false};
    if(t.rit_id){
      const r=get('SELECT * FROM transport_ritten WHERE id=?',[t.rit_id]);
      if(r){
        const info=_ritPlanInfo(r);
        const stops=all("SELECT * FROM transport_taken WHERE rit_id=? AND status<>'geannuleerd' ORDER BY COALESCE(volgorde,1000000),COALESCE(tijd,''),id",[r.id]);
        rit={id:r.id,datum:r.datum,vertrek:info.vertrek,chauffeur:r.chauffeur||'',voertuig:r.voertuig||'',bezetting:info.bezetting,capaciteit:r.voertuig_capaciteit??null,
          status:r.status,waarschuwingen:info.waarschuwingen,stop_nr:stops.findIndex(s=>s.id===t.id)+1,
          stops:stops.map(s=>({taak_id:s.id,naam:locNaam(stopLoc(s)),slot:s.slot==='vrij'?'vrij':'vast',is_deze:s.id===t.id}))};
        checks.klaargezet=r.klaarzet_status==='klaar';
      }
    }
    let kampmoment=null,gekoppeld=null;
    if(t.kampmoment_id){
      const km=get('SELECT km.*,l.name,l.contact_naam,l.contact_tel,l.sleutel_info FROM kampmomenten km JOIN locaties l ON l.id=km.locatie_id WHERE km.id=?',[t.kampmoment_id]);
      if(km){
        const kv=km.kv_persoon_id?get('SELECT naam,telefoon FROM personeel WHERE id=?',[km.kv_persoon_id]):null;
        const th=all('SELECT DISTINCT t.name FROM kampmoment_themas kt JOIN themas t ON t.id=kt.thema_id WHERE kt.kampmoment_id=?',[km.id]).map(x=>x.name).join(', ');
        kampmoment={id:km.id,locatie:km.name,thema:th,week:km.week,kv_naam:kv?kv.naam:'',kv_telefoon:kv?kv.telefoon||'':'',
          contact_naam:km.contact_naam||'',contact_telefoon:km.contact_tel||'',sleutel_info:km.sleutel_info||''};
        // Gekoppelde taak: bij een levering de ophaling van hetzelfde kampmoment, en omgekeerd.
        const ander=t.type==='levering'?'ophaling':t.type==='ophaling'?'levering':null;
        const g=ander?get("SELECT * FROM transport_taken WHERE kampmoment_id=? AND type=? AND status<>'geannuleerd' AND id<>? ORDER BY datum,id",[km.id,ander,t.id]):null;
        if(g)gekoppeld={[ander+'_taak_id']:g.id,tekst:`taak #${g.id} · ${wanneer(g)} · ${g.rit_id?'rit #'+g.rit_id:'zonder rit'}`};
      }
    }
    const ritten=new Map(all('SELECT * FROM transport_ritten WHERE id=?',[t.rit_id||-1]).map(r=>[r.id,r]));
    res.json({taak:{...rij(t,ritten),opmerking:t.opmerking||'',van_locatie_id:t.van_locatie_id,naar_locatie_id:t.naar_locatie_id,week:t.week},
      regels,rit,checks,kampmoment,gekoppeld,historiek:historiek(t)});
  });

  // TF8 G5: een taak uit een goedgekeurde KV-aanvraag is weggehaald. Kantoor kiest of het stuk ook van de aanvullijst gaat. Ja: de regel gaat weg
  // (gelogd, omkeerbaar via de wijzigingen), de aanvraag blijft in de historiek met status "afgehandeld" en een uitleg die de KV in zijn scherm leest.
  // Nee: alleen de aanvraag krijgt de uitleg niet; de regel blijft staan. Gebeurt pas nadat de taak echt weg is.
  app.post('/api/taken/aanvraag-opruimen',alleenKantoor,(req,res)=>{
    const ids=(Array.isArray(req.body?.aanvraag_ids)?req.body.aanvraag_ids:[]).map(Number).filter(Boolean);
    const ook=req.body?.ook_aanvullijst!==false;
    let regels=0,aanvragen=0;
    ids.forEach(id=>{
      const a=get('SELECT * FROM aanvragen WHERE id=?',[id]);
      if(!a||get('SELECT id FROM transport_taken WHERE aanvraag_id=?',[id]))return; // de taak moet echt weg zijn
      if(!ook)return;
      all('SELECT * FROM nakijk_regels WHERE kantoor_notitie LIKE ? AND COALESCE(aangevuld,0)=0',['%aanvraag #'+id+' van KV%']).forEach(r=>{
        delMetLog(req,'DELETE FROM nakijk_regels WHERE id=?',[r.id],'taak weggehaald');regels++;
        if(!get('SELECT COUNT(*) AS n FROM nakijk_regels WHERE sessie_id=?',[r.sessie_id]).n)delMetLog(req,'DELETE FROM nakijk_sessies WHERE id=?',[r.sessie_id],'taak weggehaald');
      });
      updateMetLog(req,'aanvragen',id,{status:'afgehandeld',reden:'Kantoor haalde de levering weg: het stuk komt niet meer. Heb je het toch nodig? Vraag het opnieuw aan.'},'taak weggehaald');
      logAct('aanvraag','taak weggehaald','Aanvraag #'+id+': taak weggehaald, stuk van de aanvullijst gehaald ('+regels+' regel(s)), KV ziet het',null,null);
      aanvragen++;
    });
    res.json({ok:true,regels,aanvragen});
  });
  app.get('/taken',(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','taken.html')));
};
