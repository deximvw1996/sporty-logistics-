// routes/ritplanning.js — RP1: kantoor-ritplanning (design/RITPLANNING-DEFINITIEF.html).
// Eén databron GET /api/ritplanning?week=YYYY-MM-DD (alleen kantoor), de kantoor-wissel van stops (geen
// slot-eis), een stop van de rit halen met 409 als er al geladen is, en de pagina /ritplanning.
'use strict';
module.exports = function(ctx){
  const {kvL}=require('../lib/tijd');
  const {app,get,all,run,updateMetLog,logAct,alleenKantoor,path,ROOT_DIR,_ritPlanInfo} = ctx;

  const PALET=['#2563eb','#0891b2','#7c3aed','#db2777','#ea580c']; // kleuren uit het ontwerp
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const d0=s=>new Date(s+'T12:00:00');
  const DAG=['zo','ma','di','wo','do','vr','za'];
  const kleur=(pid,naam)=>{let h=pid?Number(pid):[...(naam||'?')].reduce((s,c)=>s*31+c.charCodeAt(0)>>>0,7);return PALET[h%PALET.length];};
  const locNaam=id=>id?((get('SELECT name FROM locaties WHERE id=?',[id])||{}).name||'?'):'?';
  const stopLoc=t=>t.type==='ophaling'?(t.van_locatie_id||t.naar_locatie_id):(t.naar_locatie_id||t.van_locatie_id);
  const regelsQ=id=>get('SELECT COALESCE(SUM(qty),0) AS q,COUNT(*) AS n FROM transport_regels WHERE taak_id=?',[id]);
  const takenVanRit=id=>all("SELECT * FROM transport_taken WHERE rit_id=? AND status<>'geannuleerd' ORDER BY COALESCE(volgorde,1000000),COALESCE(tijd,''),id",[id]);
  function soortVan(t){
    if(/^Rest van rit/.test(t.opmerking||''))return 'rest';
    if(t.aanvraag_id)return 'aanvraag';
    if(t.datum&&[0,6].includes(d0(t.datum).getDay()))return 'weekend';
    return t.type==='levering'?'levering':t.type==='ophaling'?'ophaling':'terugrit';
  }
  function kvVan(t){
    const km=t.kampmoment_id?get('SELECT kv_persoon_id FROM kampmomenten WHERE id=?',[t.kampmoment_id]):null;
    const p=km&&km.kv_persoon_id?get('SELECT naam FROM personeel WHERE id=?',[km.kv_persoon_id]):null;
    return p?p.naam:'';
  }

  function planning(req){
    const basis=/^\d{4}-\d{2}-\d{2}$/.test(req.query.week||'')?d0(req.query.week):d0(iso(new Date()));
    basis.setDate(basis.getDate()-((basis.getDay()+6)%7));
    const start=iso(basis),dagen=[];
    for(let i=0;i<7;i++){const d=new Date(basis);d.setDate(d.getDate()+i);dagen.push(iso(d));}
    const eind=dagen[6];
    // Weeknummer: kampweek van de actieve periode als de week erin valt, anders de ISO-week.
    const per=get('SELECT * FROM vakantieperiodes WHERE actief=1');
    let nummer,kampweek=false;
    if(per&&eind>=per.start_datum&&start<=per.eind_datum){nummer=Math.floor((d0(start)-d0(per.start_datum))/(7*864e5))+1;if(nummer<1)nummer=1;kampweek=true;}
    else{const t=new Date(basis);t.setDate(t.getDate()+3);const j=new Date(t.getFullYear(),0,4);nummer=1+Math.round(((t-j)/864e5-3+((j.getDay()+6)%7))/7);}

    const personeel=all('SELECT id,naam,rol FROM personeel ORDER BY naam');
    const persoonVan=id=>personeel.find(p=>p.id===id);
    const rijders=new Map();
    const dagObj=dagen.map(datum=>{
      const ritten=all("SELECT * FROM transport_ritten WHERE datum=? AND status<>'geannuleerd' ORDER BY id",[datum]).map(r=>{
        const info=_ritPlanInfo(r);
        const p=r.personeel_id?persoonVan(r.personeel_id):null;
        const naam=p?p.naam:(r.chauffeur||'');
        const best={personeel_id:r.personeel_id||null,naam,rol:r.bestuurder_rol||'chauffeur',kleur:kleur(r.personeel_id,naam)};
        if(naam)rijders.set(r.personeel_id?'p'+r.personeel_id:'n'+naam,{personeel_id:best.personeel_id,naam,rol:p?p.rol:'',bestuurder_rol:best.rol,kleur:best.kleur});
        const stops=takenVanRit(r.id).map(t=>{
          const q=regelsQ(t.id),kv=kvVan(t);
          return {taak_id:t.id,volgorde:t.volgorde,tijd:t.tijd||'',slot:t.slot==='vrij'?'vrij':'vast',locatie:locNaam(stopLoc(t)),
            wat:[t.type+(q.n?' '+q.q:''),kv?kvL(kv):null].filter(Boolean).join(' · '),bakken:q.q,status:t.status,
            geladen:!!get('SELECT 1 AS x FROM verhuis_checks WHERE taak_id=? AND geladen=1 AND COALESCE(gelost,0)=0 LIMIT 1',[t.id])};
        });
        return {id:r.id,vertrek:info.vertrek,einde:info.einde,bestuurder:best,
          voertuig:{id:r.voertuig_id||null,naam:r.voertuig||'',soort:r.voertuig_soort||'pool',capaciteit:r.voertuig_capaciteit??null},aanhangwagen_id:r.aanhangwagen_id||null,vol_tekst:ctx.volTekst?ctx.volTekst(r.id):'',
          lading:info.lading,status:r.status,klaarzet_status:r.klaarzet_status||'',waarschuwingen:!r.personeel_id&&naam&&!['gedaan','geannuleerd'].includes(r.status)&&ctx.persoonOpNaam&&!ctx.persoonOpNaam(naam)?[...info.waarschuwingen,'⚠ bestuurder niet gekoppeld']:info.waarschuwingen,notitie:info.notitie||'',stops,
          laatste_wijziging:ctx._laatsteRitWijziging?ctx._laatsteRitWijziging(r.id):null};
      }).sort((a,b)=>(a.vertrek||'99').localeCompare(b.vertrek||'99'));
      const open=all("SELECT * FROM transport_taken WHERE datum=? AND (rit_id IS NULL OR rit_id=0) AND status='gepland' ORDER BY tijd,id",[datum]).map(t=>{
        const q=regelsQ(t.id);
        const naam=t.type==='levering'?`Levering ${locNaam(t.naar_locatie_id)}`:t.type==='ophaling'?`Ophaling ${locNaam(t.van_locatie_id)}`
          :(t.opmerking||'Transfer').replace(/^🚨\s*/,'').split(':')[0];
        return {taak_id:t.id,type:t.type,naam,route:`${locNaam(t.van_locatie_id)} → ${locNaam(t.naar_locatie_id)}`,stuks:q.q,tijd:t.tijd||'',soort:soortVan(t)};
      });
      const g=d0(datum).getDay();
      return {datum,dag:`${DAG[g]} ${d0(datum).getDate()}`,weekend:g===0||g===6,ritten,open};
    });
    // Vaste chauffeurs altijd, plus iedereen die deze week rijdt.
    const personen=personeel.filter(p=>p.rol==='chauffeur').map(p=>({personeel_id:p.id,naam:p.naam,rol:p.rol,bestuurder_rol:'chauffeur',kleur:kleur(p.id,p.naam),vast:true}));
    rijders.forEach(r=>{if(!personen.some(p=>r.personeel_id?p.personeel_id===r.personeel_id:p.naam===r.naam))personen.push({...r,vast:false});});
    // VT1: echte voertuigen (eigen eerst, dan huur, dan privé) met hun ritten van de getoonde week; "ander voertuig…" blijft een vrije naam + plaatsen.
    const bezet={};
    dagObj.forEach(d=>d.ritten.forEach(r=>{if(r.voertuig.id)((bezet[r.voertuig.id]=bezet[r.voertuig.id]||{})[d.datum]=(bezet[r.voertuig.id][d.datum]||[])).push({rit_id:r.id,vertrek:r.vertrek,einde:r.einde});}));
    const voertuigen=all("SELECT * FROM voertuigen WHERE actief=1 AND COALESCE(aard,'voertuig')<>'aanhangwagen' ORDER BY CASE soort WHEN 'eigen' THEN 0 WHEN 'huur' THEN 1 ELSE 2 END,naam COLLATE NOCASE")
      .map(v=>({id:v.id,naam:v.naam,soort:v.soort,plaatsen:v.plaatsen,capaciteit:v.plaatsen,trekhaak:!!v.trekhaak,bezet_op_dag:bezet[v.id]||{}}));
    const aanhangwagens=all("SELECT id,naam FROM voertuigen WHERE actief=1 AND aard='aanhangwagen' ORDER BY naam COLLATE NOCASE");
    // TF7: Past niet bij het laden is de echte controle; wat zo overblijft staat als teller bovenaan.
    const past_niet=get("SELECT COUNT(*) AS n FROM transport_taken WHERE rest_van_rit_id IS NOT NULL AND (rit_id IS NULL OR rit_id=0) AND status='gepland'").n;
    return {week:{start,eind,nummer,kampweek},past_niet,dagen:dagObj,personen,voertuigen,aanhangwagens,
      alle_personeel:personeel.map(p=>({personeel_id:p.id,naam:p.naam,rol:p.rol,kleur:kleur(p.id,p.naam)}))};
  }
  app.get('/api/ritplanning',alleenKantoor,(req,res)=>res.json({...planning(req),standaard_vertrek:(get("SELECT waarde FROM app_vlaggen WHERE naam='tijd_vertrek_ritten'")||{}).waarde||''})); // ME1

  // ▲▼ door kantoor: wisselt volgorde én tijd van twee buurstops; geen slot-eis (kantoor beslist), wel log.
  app.post('/api/ritten/:id/taken/:taakId/wissel',alleenKantoor,(req,res)=>{
    const rit=get('SELECT * FROM transport_ritten WHERE id=?',[req.params.id]);
    if(!rit)return res.status(404).json({error:'Rit niet gevonden'});
    const richting=req.body?.richting;
    if(!['omhoog','omlaag'].includes(richting))return res.status(400).json({error:"richting moet 'omhoog' of 'omlaag' zijn"});
    const taken=takenVanRit(rit.id);
    taken.forEach((t,i)=>{if(t.volgorde!==i+1){run('UPDATE transport_taken SET volgorde=? WHERE id=?',[i+1,t.id]);t.volgorde=i+1;}});
    const i=taken.findIndex(t=>t.id===parseInt(req.params.taakId));
    if(i<0)return res.status(404).json({error:'Deze stop hoort niet bij deze rit'});
    const j=richting==='omhoog'?i-1:i+1;
    if(j<0||j>=taken.length)return res.status(409).json({error:richting==='omhoog'?'Dit is al de eerste stop':'Dit is al de laatste stop'});
    const a=taken[i],b=taken[j];
    updateMetLog(req,'UPDATE transport_taken SET volgorde=?,tijd=? WHERE id=?',[b.volgorde,b.tijd,a.id],'ritplanning');
    updateMetLog(req,'UPDATE transport_taken SET volgorde=?,tijd=? WHERE id=?',[a.volgorde,a.tijd,b.id],'ritplanning');
    if(ctx.meldRitGewijzigd)ctx.meldRitGewijzigd(req,rit.id,'volgorde van de stops aangepast'); // TF3
    logAct('transport','gewisseld',`Kantoor (${req.persoon?.naam||'?'}) wisselde stop ${locNaam(stopLoc(a))} en ${locNaam(stopLoc(b))} (rit #${rit.id})`,null,null);
    res.json({ok:true,taken:takenVanRit(rit.id).map(t=>({id:t.id,volgorde:t.volgorde,tijd:t.tijd,slot:t.slot}))});
  });

  // ✕: taak van de rit halen. Blijft op dezelfde dag staan (komt terug in "open"); 409 als er al iets geladen is.
  app.post('/api/ritten/:id/taken/:taakId/ontkoppel',alleenKantoor,(req,res)=>{
    const t=get('SELECT * FROM transport_taken WHERE id=? AND rit_id=?',[req.params.taakId,req.params.id]);
    if(!t)return res.status(404).json({error:'Deze stop hoort niet bij deze rit'});
    const o=ctx._ontkoppelTaak(req,t,'ritplanning'); // TB1: één ontkoppel-functie (transport.js)
    if(o.fout)return res.status(o.status).json({error:o.fout});
    if(ctx.meldRitGewijzigd)ctx.meldRitGewijzigd(req,parseInt(req.params.id),'stop van de rit gehaald'); // TF3
    logAct('transport','van rit gehaald',`Taak #${t.id} (${locNaam(stopLoc(t))}) van rit #${req.params.id} gehaald`,null,null);
    res.json({ok:true});
  });

  app.get('/ritplanning',(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','ritplanning.html')));
};
