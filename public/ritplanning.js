// public/ritplanning.js — RP1: kantoor-ritplanning (design/RITPLANNING-DEFINITIEF.html).
// Weekagenda (tijdas 07–17, banen bij gelijktijdige ritten, dagkolommen groeien mee) + lade met dag-inzoom
// per bestuurder en het ritdetail. Alles uit GET /api/ritplanning; na elke actie de week opnieuw laden.
'use strict';
// ── RP2: gebaren (los van de browser, zodat node ze kan testen) ──
// Elk gebaar = één route; de pagina geeft de pointer-punten (of het berekende doel) en krijgt de API-call terug.
const GEBAREN=(function(){
  const STAP=15;let AS0=420,AS_MIN=600; // tijdas in minuten over de kolomhoogte; de pagina zet ze via bereik()
  const min=s=>{const m=/^(\d{1,2}):(\d{2})$/.exec(s||'');return m?(+m[1])*60+(+m[2]):null;};
  const hm=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
  const snap=m=>Math.round(m/STAP)*STAP;
  const klem=m=>Math.max(0,Math.min(23*60+45,m));
  const plusDag=(d,n)=>{const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;};
  const weekend=d=>[0,6].includes(new Date(d+'T12:00:00').getDay());
  const BEZIG=['onderweg','aangekomen','gedaan'];
  const DG=['zo','ma','di','wo','do','vr','za'];
  const label=(d,a,b)=>{const x=new Date(d+'T12:00:00');return `${DG[x.getDay()]} ${x.getDate()}/${x.getMonth()+1} · ${a}${b?'–'+b:''}`;};
  // dag onder punt x: geo.dagOp(x) (pagina: kolom onder de pointer) of vaste kolombreedte (test)
  const dagOp=(geo,x0,x,datum)=>geo.dagOp?geo.dagOp(x)||datum:geo.dagen[Math.max(0,Math.min(geo.dagen.length-1,geo.dagen.indexOf(datum)+Math.round((x-x0)/geo.kolomBreedte)))];
  const dMin=(geo,dy)=>snap(dy/geo.kolomHoogte*AS_MIN);
  // Mobiele maten (MOBIEL-REGEL): 1 dag, knoppen ≥ 44 px, grepen 14 px op touch, lang drukken 250 ms.
  const mobielMaten=w=>({dagen:w<768?1:7,knop:44,greep:w<768?14:8,langDruk:250});
  function maak({P,api,vraag,toast,na}){
    na=na||(()=>{});
    const ritten=()=>P.dagen.flatMap(d=>d.ritten);
    async function klaar(r,fout,tekst,ritId){if(!r.ok){toast(r.json.error||fout,'error');return null;}await na(ritId,tekst);return r.json;}
    const g={
      // doel berekenen tijdens het slepen (schaduwblok + tijdlabel)
      doelRit(rit,geo,p0,p){const a=min(rit.vertrek)??480,b=Math.max(min(rit.einde)??a,a+30);
        const datum=dagOp(geo,p0.x,p.x,rit.datum||P.dagen.find(d=>d.ritten.some(x=>x.id===rit.id)).datum),d=dMin(geo,p.y-p0.y);
        const v=klem(snap(a)+d);return {datum,vertrek:hm(v),einde:hm(v+(b-a)),label:label(datum,hm(v),hm(v+(b-a)))};},
      doelGreep(rit,kant,geo,p0,p){const a=min(rit.vertrek)??480,b=Math.max(min(rit.einde)??a,a+30),d=dMin(geo,p.y-p0.y);
        const datum=rit.datum||P.dagen.find(x=>x.ritten.some(y=>y.id===rit.id)).datum;
        if(kant==='boven'){const v=Math.min(klem(snap(a)+d),b);return {datum,vertrek:hm(v),einde:hm(b),label:label(datum,hm(v),hm(b))};}
        const e=Math.max(klem(snap(b)+d),a);return {datum,vertrek:hm(a),einde:hm(e),label:label(datum,hm(a),hm(e)),samen:rit.stops.filter(s=>min(s.tijd)!=null&&min(s.tijd)>e).map(s=>s.taak_id)};},
      async verplaats(rit,datum,vertrek){
        if(BEZIG.includes(rit.status)){toast('rit is al bezig','warn');return null;}
        return klaar(await api('PUT',`/api/ritten/${rit.id}/verplaats`,{datum,vertrek}),'Verplaatsen mislukt','✓ verplaatst',rit.id);},
      async tijden(rit,body){
        if(BEZIG.includes(rit.status)){toast('rit is al bezig','warn');return null;}
        return klaar(await api('PUT',`/api/ritten/${rit.id}/tijden`,body),'Tijden aanpassen mislukt',body.einde?'✓ einde aangepast':'✓ vertrek aangepast',rit.id);},
      async sleepRit(rit,geo,punten){const d=g.doelRit(rit,geo,punten[0],punten[punten.length-1]);return g.verplaats(rit,d.datum,d.vertrek);},
      async sleepGreep(rit,kant,geo,punten){const d=g.doelGreep(rit,kant,geo,punten[0],punten[punten.length-1]);
        return g.tijden(rit,kant==='boven'?{vertrek:d.vertrek}:{einde:d.einde});},
      // open taak droppen: doel {soort:'rit',rit_id,volgorde?} of {soort:'uur',datum,vertrek}
      async dropOpen(open,doel){
        const rit=doel.soort==='rit'?ritten().find(x=>x.id===doel.rit_id):null;
        const datum=doel.soort==='rit'?(rit&&rit.datum)||P.dagen.find(d=>d.ritten.some(x=>x.id===doel.rit_id))?.datum||open.datum:doel.datum;
        if(weekend(datum)&&!await vraag({titel:'Weekendtaak inplannen?',tekst:'Dit is een weekendtaak: een uitzondering, geen verbod. Toch inplannen?',ok:'Ja, inplannen'}))return null;
        const r=doel.soort==='rit'?await api('PUT',`/api/transport-taken/${open.taak_id}/rit`,{rit_id:doel.rit_id,...(doel.volgorde?{volgorde:doel.volgorde}:{})})
          :await api('POST','/api/ritten',{datum,vertrek:doel.vertrek,taak_ids:[open.taak_id]});
        if(r.ok&&weekend(datum)){const wb=await api('POST',`/api/transport-taken/${open.taak_id}/weekend-bevestig`);if(!wb.ok)toast(wb.json.error||'Bevestiging bewaren mislukt','warn');}
        return klaar(r,'Inplannen mislukt',doel.soort==='rit'?'✓ op rit gezet':'✓ nieuwe rit',doel.soort==='rit'?doel.rit_id:r.json.id);},
      // stop slepen: binnen de rit (volgorde) of naar een andere rit {rit_id,volgorde}
      async dropStop(stop,doel){
        const van=ritten().find(x=>x.id===stop.rit_id),s=van&&van.stops.find(x=>x.taak_id===stop.taak_id);
        if(s&&s.geladen){toast('Deze stop is al geladen — eerst lossen of terugzetten','warn');return null;}
        if(doel.rit_id===stop.rit_id){
          const ids=van.stops.map(x=>x.taak_id).filter(x=>x!==stop.taak_id);ids.splice(Math.max(0,doel.volgorde-1),0,stop.taak_id);
          return klaar(await api('PUT',`/api/ritten/${stop.rit_id}/stops/volgorde`,{taak_ids:ids}),'Volgorde aanpassen mislukt','✓ volgorde',stop.rit_id);}
        return klaar(await api('PUT',`/api/transport-taken/${stop.taak_id}/rit`,{rit_id:doel.rit_id,volgorde:doel.volgorde}),'Stop verplaatsen mislukt','✓ stop verplaatst',doel.rit_id);},
      async ongedaan(ritId){return klaar(await api('POST',`/api/ritten/${ritId}/ongedaan`),'Ongedaan maken mislukt','↶ ongedaan',ritId);},
    };
    return g;
  }
  // TF11: de agenda loopt minstens 07:00–18:00 en groeit mee met de vroegste en laatste rit, zodat niets buiten beeld valt.
  const bereik=ritten=>{let a=420,b=1080;ritten.forEach(r=>{const v=min(r.vertrek),e=min(r.einde);if(v!=null){a=Math.min(a,v);b=Math.max(b,v+30);}if(e!=null)b=Math.max(b,e);(r.stops||[]).forEach(s=>{const t=min(s.tijd);if(t!=null){a=Math.min(a,t);b=Math.max(b,t);}});});a=Math.floor(a/60)*60;b=Math.min(1440,Math.ceil(b/60)*60);return {a0:a,a1:b};};
  const zetAs=(a0,a1)=>{AS0=a0;AS_MIN=a1-a0;};
  const pos=(a,b)=>({top:Math.max(0,(a-AS0)/AS_MIN*100),hoog:Math.max(0,(Math.min(b,AS0+AS_MIN)-a)/AS_MIN*100)});
  return {maak,snap,mobielMaten,label,BEZIG,get AS0(){return AS0;},get AS_MIN(){return AS_MIN;},min,hm,plusDag,bereik,zetAs,pos};
})();
// ── MOB2: gsm-weergave (≤ 767 px) van de ritplanning (design/mockup-gsm-1.html, telefoon Transport › Ritplanning) ──
// Pure HTML-bouwers op dezelfde GET /api/ritplanning-data (los van de browser, zodat node ze met echte data-JSON kan aanroepen).
const RITGSM=(function(){
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const DG=['zo','ma','di','wo','do','vr','za'];
  const d0=s=>new Date(s+'T12:00:00');
  const kort=s=>{const x=d0(s);return `${DG[x.getDay()]} ${x.getDate()}/${x.getMonth()+1}`;};
  const echteW=r=>r.waarschuwingen.filter(w=>!/^weekend/.test(w));
  const bezTekst=r=>r.lading?r.lading.tekst:'';
  const dag=(P,datum)=>P.dagen.find(d=>d.datum===datum);
  const kopWeek=P=>{const a=d0(P.week.start),b=new Date(a);b.setDate(b.getDate()+4);return `Week ${P.week.nummer} · ${a.getDate()}–${b.getDate()}/${String(b.getMonth()+1).padStart(2,'0')}`;};
  function dagen(P,datum){
    const zichtbaar=P.dagen.filter((d,i)=>i<5||d.ritten.length||d.open.length);
    return `${P.past_niet?`<a class="knop licht breed" href="/taken" style="display:flex;align-items:center;justify-content:center;min-height:44px;margin-bottom:8px;text-decoration:none;color:#c2410c">⚠ ${P.past_niet} past niet · taak voor kantoor</a>`:''}<div class="wk"><button class="knop licht klein" data-g="week" data-n="-1" aria-label="Vorige week">‹</button><b>${esc(kopWeek(P))}</b><button class="knop licht klein" data-g="week" data-n="1" aria-label="Volgende week">›</button></div>
      <div class="dagen">${zichtbaar.map(d=>`<a data-g="dag" data-d="${d.datum}" class="${d.datum===datum?'act':''}">${DG[d0(d.datum).getDay()]}<b>${d0(d.datum).getDate()}</b>${d.ritten.some(r=>echteW(r).length)?'<em></em>':''}</a>`).join('')}</div>`;
  }
  function ritKaart(r){
    const w=echteW(r).length,route=r.stops.length?r.stops.map(s=>s.locatie).join(' → '):'nog geen stops';
    return `<div class="bak ${w?'rood':'groen'}" data-g="rit" data-id="${r.id}" role="button" tabindex="0"><span class="code">${esc(r.vertrek||'—')}</span><div class="nm">Rit #${r.id} · ${r.stops.length} stop${r.stops.length===1?'':'s'}<b>${esc(route)} · ${esc(bezTekst(r))}${w?' ⚠':''}</b></div><span class="pijl">›</span></div>`;
  }
  // Lijstscherm: dagkiezer, open taken met "Op rit", dan per bestuurder + voertuig de ritten van die dag.
  function lijst(P,datum){
    const d=dag(P,datum)||P.dagen[0];
    const nw=d.ritten.filter(r=>echteW(r).length).reduce((s,r)=>s+echteW(r).length,0);
    const groepen=new Map();
    d.ritten.forEach(r=>{const k=(r.bestuurder.naam||'').trim().toLowerCase()||('p'+r.bestuurder.personeel_id);(groepen.get(k)||groepen.set(k,{naam:r.bestuurder.naam||'geen bestuurder',vts:[],ritten:[]}).get(k)).ritten.push(r);
      const v=r.voertuig.naam||'';const g=groepen.get(k);if(v&&!g.vts.includes(v))g.vts.push(v);});
    const open=d.open.length?`<div class="sec"><h3>Open taken <span style="color:#c2410c">${d.open.length} zonder rit</span></h3>${d.open.map(o=>`<div class="rij" style="min-height:48px"><div class="nm">${esc(o.naam)}<b>${esc([o.stuks?o.stuks+(o.stuks===1?' stuk':' stuks'):'',o.tijd?'liefst om '+o.tijd:'',o.route].filter(Boolean).join(' · '))}</b></div><button class="knop licht klein" data-g="oprit" data-taak="${o.taak_id}">Op rit</button></div>`).join('')}</div>`:'';
    const ritten=[...groepen.values()].map(g=>`<h3 class="tus">${esc(g.naam)} · ${esc(g.vts.join(' / ')||'geen voertuig')}</h3>${g.ritten.map(ritKaart).join('')}`).join('')
      ||'<div class="hint" style="text-align:center;padding:18px 0">Geen ritten op deze dag</div>';
    return `<div class="kop2"><div style="flex:1"><b>Ritplanning</b><span>${esc(kort(d.datum))} · ${d.ritten.length} ${d.ritten.length===1?'rit':'ritten'} · ${nw} waarschuwing${nw===1?'':'en'}</span></div></div>${dagen(P,d.datum)}
      <div class="body">${open}${ritten}<button class="knop breed licht" data-g="nieuw">+ Nieuwe rit</button></div>`;
  }
  const voertuigOpties=(P,r)=>{
    const GR={eigen:'Eigen voertuigen',huur:'Huur',prive:'Privé'},huidig=r.voertuig.id||'';
    const vrij=!huidig&&r.voertuig.naam?`<option value="" selected>${esc(r.voertuig.naam)} (vrije naam)</option>`:'';
    return vrij+['eigen','huur','prive'].map(s=>{const l=P.voertuigen.filter(v=>v.soort===s);return l.length?`<optgroup label="${GR[s]}">${l.map(v=>{
      const o=((v.bezet_op_dag||{})[r.datum]||[]).find(x=>x.rit_id!==r.id);
      return `<option value="${v.id}" ${v.id===huidig?'selected':''}>${esc(v.naam)}${v.plaatsen?' (± '+v.plaatsen+' bakken)':''}${o?` (ook op rit #${o.rit_id})`:''}</option>`;}).join('')}</optgroup>`:'';}).join('')+'<option value="nieuw">Ander voertuig…</option>';
  };
  const aanhangOpties=(P,h)=>'<option value="">Geen aanhangwagen</option>'+(P.aanhangwagens||[]).map(a=>`<option value="${a.id}" ${String(a.id)===String(h||'')?'selected':''}>${esc(a.naam)}</option>`).join('');
  // Ritdetail als volgend scherm: waarschuwingen, bestuurder + voertuig, stops met ▲▼ (geen slepen op gsm), Goedkeuren.
  function detail(P,r){
    const w=r.waarschuwingen.filter(x=>!/^weekend · bevestigd/.test(x)&&true);
    const ws=w.length?`<div class="sec" style="border-left:4px solid #dc2626"><h3>Waarschuwingen</h3>${w.map(x=>`<div class="rij" style="min-height:40px;color:#b91c1c;font-weight:600">⚠ ${esc(x)}</div>`).join('')}</div>`:'';
    const wie=`<div class="sec"><h3>Wie en wat</h3><label class="vl">Bestuurder<select data-g="bsel" data-id="${r.id}">${P.alle_personeel.map(p=>`<option value="${p.personeel_id}" ${p.personeel_id===r.bestuurder.personeel_id?'selected':''}>${esc(p.naam)}${p.rol==='chauffeur'?'':' ('+esc(p.rol)+')'}</option>`).join('')}</select></label>
      <label class="vl">Voertuig<select data-g="vsel" data-vsel="${r.id}">${voertuigOpties(P,r)}</select></label><label class="vl">Aanhangwagen<select data-asel="${r.id}" aria-label="Aanhangwagen">${aanhangOpties(P,r.aanhangwagen_id)}</select></label></div>`;
    const stops=`<div class="sec"><h3>Stops <span>${esc(bezTekst(r))}</span></h3>${r.stops.length?r.stops.map((s,i)=>`<div class="it ${s.geladen?'groen':''}"><div class="stp"><button data-g="wissel" data-taak="${s.taak_id}" data-r="omhoog" aria-label="Omhoog" ${i===0?'disabled':''}>▲</button><button data-g="wissel" data-taak="${s.taak_id}" data-r="omlaag" aria-label="Omlaag" ${i===r.stops.length-1?'disabled':''}>▼</button></div><div class="nm">${esc(s.locatie)}<b>${esc([s.tijd,s.wat,s.status!=='gepland'?s.status:''].filter(Boolean).join(' · '))}</b></div><button class="knop licht klein" data-g="mat" data-taak="${s.taak_id}">+ Materiaal</button><button class="knop licht klein" data-g="uit" data-taak="${s.taak_id}" aria-label="Van de rit halen">✕</button></div>${(s.regels||[]).map(g=>`<div class="stopregel"><span>${esc(g.naam)}</span><input type="number" min="1" data-rq="${g.id}" value="${g.qty}" aria-label="Aantal"><button class="knop licht klein" data-rweg="${g.id}" aria-label="Regel verwijderen">✕</button></div>`).join('')}`).join(''):'<div class="hint" style="padding:10px 0">Nog geen stops: voeg er een toe of zet een open taak op deze rit</div>'}<button class="knop breed licht" data-g="stop-nieuw">+ Stop</button></div>`;
    const meting=`<div class="sec"><h3>Tijd</h3><label class="vl">Geschat einde<input type="time" data-einde="${r.id}" value="${esc((r.meting&&r.meting.geschat)||'')}"></label>${r.meting&&r.meting.tekst?`<div class="hint">${esc(r.meting.tekst)}${r.meting.vorig?' · eerder geschat '+esc(r.meting.vorig):''}</div>`:''}</div>`;
    return `<div class="kop2"><a data-g="terug">‹ Ritplanning</a><div style="flex:1"><b>Rit #${r.id} · ${esc(r.vertrek||'?')}–${esc(r.einde||'?')}</b><span>${esc(kort(r.datum))} · ${esc(r.bestuurder.naam||'geen bestuurder')} · ${esc(r.voertuig.naam||'geen voertuig')}${r.vol_tekst?' · '+esc(r.vol_tekst):''}</span></div></div>
      <div class="body">${ws}${wie}${typeof LINK!=='undefined'&&LINK&&LINK.rit===r.id?`<div class="sec"><h3>Rit-link</h3><div class="rij" style="min-height:48px"><input readonly value="${esc(LINK.url)}" aria-label="Rit-link" style="flex:1;min-width:0;height:44px;border:1px solid #cbd5e1;border-radius:10px;padding:0 8px;font:inherit"><button type="button" class="knop licht klein" data-g="kopieer">Kopieer</button></div></div>`:''}${meting}${stops}</div><div class="voet"><button class="knop licht" data-g="link">Rit-link</button>${r.klaarzet_status==='klaar'&&(!r.status||r.status==='gepland')?'<button class="knop licht" data-g="klaar-terug">Terugzetten</button>':''}<button class="knop" data-g="klaar">${r.klaarzet_status==='klaar'?'Klaargezet ✓':'Klaarzetten'}</button></div>`;
  }
  // TF11: per stap op de gsm.
  function stopNieuw(P,r){
    const opt=g=>(P.locaties||[]).map(l=>`<option value="${l.id}" ${l.naam===g?'selected':''}>${esc(l.naam)}</option>`).join('');
    return `<div class="kop2"><a data-g="stap-terug">‹ Rit #${r.id}</a><div style="flex:1"><b>+ Stop</b></div></div><form class="body" id="gsf" onsubmit="return false"><label class="vl">Soort<select name="type"><option value="levering">Levering</option><option value="ophaling">Ophaling</option></select></label><label class="vl">Van<select name="van">${opt('Rozenweg')}</select></label><label class="vl">Naar<select name="naar">${opt('')}</select></label><label class="vl">Tijd<input type="time" name="tijd" value="${esc(r.vertrek||'')}"></label></form><div class="voet"><button class="knop licht" data-g="stap-terug">Annuleren</button><button class="knop" data-g="stop-ok">Stop toevoegen</button></div>`;
  }
  function matZoek(){return `<div class="kop2"><a data-g="stap-terug">‹ Rit</a><div style="flex:1"><b>+ Materiaal</b><span>stap 1: wat moet er mee?</span></div></div><div class="body"><label class="vl">Zoek bak, attribuut, sportset of artikel<input name="mq" autocomplete="off"></label><div id="m-res"></div><label class="vl">Of vrije tekst<input name="mvrij" id="gm-vrij" maxlength="200"></label><button class="knop breed licht" data-g="mat-vrij">Vrije tekst gebruiken</button></div>`;}
  function matAantal(m){return `<div class="kop2"><a data-g="stap-terug">‹ Rit</a><div style="flex:1"><b>+ Materiaal</b><span>stap 2: hoeveel?</span></div></div><div class="body"><div class="sec" style="padding:12px"><b>${esc(m.naam)}</b></div><label class="vl">Aantal<input type="number" min="1" id="gm-n" value="1"></label></div><div class="voet"><button class="knop licht" data-g="stap-terug">Annuleren</button><button class="knop" data-g="mat-ok">Toevoegen</button></div>`;}
  // + Nieuwe rit: overlay van volle hoogte.
  function nieuw(P,datum,opt={}){
    const vast=P.personen.filter(p=>p.vast);
    const bst=`<optgroup label="Vaste chauffeurs">${vast.map(p=>`<option value="${p.personeel_id}" ${String(p.personeel_id)===String(opt.personeel_id||'')?'selected':''}>${esc(p.naam)}</option>`).join('')}</optgroup><optgroup label="Iemand anders… (rijdt mee)">${P.alle_personeel.filter(p=>!vast.some(v=>v.personeel_id===p.personeel_id)).map(p=>`<option value="${p.personeel_id}">${esc(p.naam)} (${esc(p.rol)})</option>`).join('')}</optgroup>`;
    const GR={eigen:'Eigen voertuigen',huur:'Huur',prive:'Privé'};
    const vts=['eigen','huur','prive'].map(s=>{const l=P.voertuigen.filter(v=>v.soort===s);return l.length?`<optgroup label="${GR[s]}">${l.map(v=>`<option value="${v.id}">${esc(v.naam)}${v.plaatsen?' (± '+v.plaatsen+' bakken)':''}</option>`).join('')}</optgroup>`:'';}).join('')+'<option value="">Ander voertuig…</option>';
    return `<div class="kop2"><a data-g="annuleer">‹ Annuleren</a><div style="flex:1"><b>Nieuwe rit</b><span>${opt.taak_ids?'met taak #'+opt.taak_ids.join(', #'):'bestuurder = elke medewerker'}</span></div></div>
      <form class="body" id="gnf" onsubmit="return false"><label class="vl">Datum<input type="date" name="datum" value="${esc(datum)}"></label><label class="vl">Vertrek<input type="time" name="vertrek" value="${esc(opt.vertrek||(P&&P.standaard_vertrek)||'08:00')}"></label>
      <label class="vl">Geschat einde<input type="time" name="einde"></label><label class="vl">Bestuurder<select name="personeel_id">${bst}</select></label><label class="vl">Voertuig<select name="voertuig">${vts}</select></label><label class="vl">Aanhangwagen<select name="aanhang">${aanhangOpties(P,'')}</select></label>
      <label class="vl" id="gnf-n" hidden>Naam van het voertuig<input name="vnaam" value="Eigen wagen"></label><label class="vl" id="gnf-c" hidden>Capaciteit (bakken)<input type="number" min="1" name="cap" value="6"></label></form>
      <div class="voet"><button class="knop licht" data-g="annuleer">Annuleren</button><button class="knop" data-g="maak">Rit maken</button></div>`;
  }
  // Op rit: kies een bestaande rit van die dag of een nieuwe.
  function opRit(P,datum,taakId){
    const d=dag(P,datum),o=d.open.find(x=>x.taak_id===taakId);
    return `<div class="kop2"><a data-g="annuleer">‹ Annuleren</a><div style="flex:1"><b>${esc(o?o.naam:'Taak')} → op rit</b><span>${esc(o?o.route:'')}</span></div></div>
      <form class="body" id="gor" onsubmit="return false"><label class="vl">Rit<select name="rit">${d.ritten.map(r=>`<option value="${r.id}">#${r.id} · ${esc(r.vertrek||'?')} · ${esc(r.bestuurder.naam||'geen bestuurder')} · ${esc(r.voertuig.naam||'')}</option>`).join('')}<option value="nieuw">+ nieuwe rit…</option></select></label></form>
      <div class="voet"><button class="knop licht" data-g="annuleer">Annuleren</button><button class="knop" data-g="oprit-ok" data-taak="${taakId}">Op deze rit zetten</button></div>`;
  }
  return {lijst,detail,nieuw,opRit,dagen,ritKaart,echteW,stopNieuw,matZoek,matAantal};
})();
if(typeof module!=='undefined'&&module.exports)module.exports={gebaren:GEBAREN,gsm:RITGSM};
if(typeof window!=='undefined')(function(){
  const TOKEN=localStorage.getItem('sporty-auth-token');
  if(!TOKEN){location.href='/';return;}
  const $=id=>document.getElementById(id);
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const MAAND=['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
  const DAGLANG=['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'];
  const d0=s=>new Date(s+'T12:00:00');
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const min=s=>{const m=/^(\d{1,2}):(\d{2})$/.exec(s||'');return m?(+m[1])*60+(+m[2]):null;};
  const pct=m=>Math.max(0,Math.min(100,(m-GEBAREN.AS0)/GEBAREN.AS_MIN*100)); // TF11: tijdas uit GEBAREN.bereik
  const urenLijst=()=>{const u=[];for(let m=GEBAREN.AS0;m<GEBAREN.AS0+GEBAREN.AS_MIN;m+=60)u.push(GEBAREN.hm(m));return u;};
  const f2=n=>n.toFixed(2);

  // Zelfde toast-stijl als index.html (showToast).
  function toast(msg,type){
    const t=document.createElement('div');
    t.style.background={info:'#378ADD',error:'#E24B4A',success:'#1D9E75',warn:'#EF9F27'}[type||'info'];
    t.textContent=msg;t.onclick=()=>t.remove();$('toasts').appendChild(t);
    setTimeout(()=>{t.style.transition='opacity .3s';t.style.opacity='0';setTimeout(()=>t.remove(),300);},type==='error'?5000:3000);
  }
  async function api(methode,url,body){
    if(window.sportyApi)return window.sportyApi(methode,url,body,{toast:m=>toast(m,"info"),token:TOKEN}); // AF1: herpoging bij 502/503/504
    const r=await fetch(url,{method:methode,headers:{'Content-Type':'application/json','x-auth-token':TOKEN},body:body?JSON.stringify(body):undefined});
    const j=await r.json().catch(()=>({}));
    return {status:r.status,ok:r.ok,json:j};
  }
  // Kleine vraagModal (zelfde gedrag als die van index.html): null bij annuleren, anders de ingevulde velden.
  function vraag({titel,tekst,html,ok='Bevestigen',lees}){
    return new Promise(resolve=>{
      const bg=document.createElement('div');bg.className='mbg';
      bg.innerHTML=`<div class="mbox" role="dialog" aria-modal="true"><h4>${esc(titel)}</h4>${tekst?`<p>${esc(tekst)}</p>`:''}<div class="form">${html||''}<div class="knoppen"><button class="knop licht" data-x="0">Annuleren</button><button class="knop" data-x="1">${esc(ok)}</button></div></div></div>`;
      const sluit=v=>{document.removeEventListener('keydown',toets,true);bg.remove();resolve(v);};
      const toets=e=>{if(e.key==='Escape'){e.preventDefault();sluit(null);}};
      document.addEventListener('keydown',toets,true);
      bg.addEventListener('mousedown',e=>{if(e.target===bg)sluit(null);});
      bg.querySelector('[data-x="0"]').onclick=()=>sluit(null);
      bg.querySelector('[data-x="1"]').onclick=()=>{const v=lees?lees(bg):{};if(v)sluit(v);};
      document.body.appendChild(bg);(bg.querySelector('select,input')||bg.querySelector('[data-x="1"]')).focus();
    });
  }

  const Q=new URLSearchParams(location.search);
  let SLEEP=null, FLITS=null, WEEK=Q.get('week')||iso(new Date()), P=null, DAG=null, RIT=null, MODUS='rit', NIEUW={}, LADE=true;

  window.addEventListener('sporty-live',()=>laad()); // RT1
  async function laad(){
    const r=await api('GET','/api/ritplanning?week='+WEEK);
    if(r.status===401||r.status===403){location.href='/';return;}
    if(!r.ok){toast(r.json.error||'Ritplanning laden mislukt','error');return;}
    P=r.json;P.dagen.forEach(d=>d.ritten.forEach(x=>{x.datum=d.datum;}));
    if(!DAG||!P.dagen.some(d=>d.datum===DAG))DAG=(P.dagen.find(d=>d.ritten.length)||P.dagen[0]).datum;
    if(RIT&&!alleRitten().some(x=>x.id===RIT))RIT=null;
    teken();tekenGsm();
  }
  const alleRitten=()=>P.dagen.flatMap(d=>d.ritten);
  const dagVan=datum=>P.dagen.find(d=>d.datum===datum);
  const ritVan=id=>alleRitten().find(r=>r.id===id);
  const coord=r=>r.bestuurder.rol!=='chauffeur';
  const echteW=r=>r.waarschuwingen.filter(w=>!/^weekend/.test(w));
  const bez=r=>r.lading?r.lading.tekst:''; // TF7: wat erop staat, geen berekening

  // Banen: zoals een agenda bij overlappende afspraken — eerste baan waar de vorige rit al gedaan is.
  function banen(ritten){
    const lijst=ritten.map(r=>{const a=min(r.vertrek)??480;return {r,a,b:Math.max(min(r.einde)??a,a+30)};}).sort((x,y)=>x.a-y.a);
    const eind=[];
    lijst.forEach(x=>{let i=eind.findIndex(e=>e<=x.a);if(i<0){i=eind.length;eind.push(0);}eind[i]=x.b;x.baan=i;});
    return {lijst,n:Math.max(1,eind.length)};
  }
  function teken(){
    const w=P.week,ma=d0(w.start),zo=d0(w.eind);
    $('wk-label').textContent=`Week ${w.nummer} · ma ${ma.getDate()}${ma.getMonth()!==zo.getMonth()?' '+MAAND[ma.getMonth()]:''} – zo ${zo.getDate()} ${MAAND[zo.getMonth()]}`;
    $('leg').innerHTML=(P.past_niet?`<a class="pil oranje" href="/taken" style="text-decoration:none;margin-right:8px">⚠ ${P.past_niet} past niet · taak voor kantoor</a>`:'')+P.personen.map(p=>`<i style="background:${p.kleur}"></i>${esc(p.naam)}${p.bestuurder_rol!=='chauffeur'?' <em>kantoor</em>':''}`).join('');
    const as=GEBAREN.bereik(alleRitten());GEBAREN.zetAs(as.a0,as.a1);
    const per=P.dagen.map(d=>({d,...banen(SLEEP&&SLEEP.doel&&SLEEP.doel.datum===d.datum?[...d.ritten.filter(r=>SLEEP.soort!=='rit'||r.id!==SLEEP.rit.id),{id:'schaduw',vertrek:SLEEP.doel.vertrek,einde:SLEEP.doel.einde,schaduw:true}]:d.ritten.filter(r=>!(SLEEP&&SLEEP.doel&&SLEEP.soort==='rit'&&r.id===SLEEP.rit.id)))}));
    const flex=x=>x.d.weekend&&!x.d.ritten.length?0.55:x.n;
    $('dagkop').innerHTML='<div class="tk"><button class="dagnav" data-dagnav="-1" aria-label="Vorige dag">‹</button><button class="dagnav" data-dagnav="1" aria-label="Volgende dag">›</button></div>'+per.map(x=>`<div class="${x.d.weekend?'wk':''} ${x.d.datum===DAG?'act':''}" style="flex:${flex(x)}" data-dag="${x.d.datum}">${esc(x.d.dag)}${x.d.weekend?'<i>weekend</i>':''}${x.d.ritten.length?`<span class="pil">${x.d.ritten.length} ${x.d.ritten.length===1?'rit':'ritten'}</span>`:''}${x.d.open.length?`<span class="pil oranje" data-open="${x.d.datum}">${x.d.open.length} open</span>`:''}</div>`).join('');
    const uren=urenLijst();
    $('raster').innerHTML=`<div class="tk">${uren.map(u=>`<span>${u}</span>`).join('')}</div>`+per.map(x=>{
      const blokken=x.lijst.map(({r,a,b,baan})=>{
        const pos=`top:min(${f2(pct(a))}%,calc(100% - 28px));height:calc(${f2(pct(b))}% - ${f2(pct(a))}%);left:calc(${f2(baan/x.n*100)}% + 2px);width:calc(${f2(100/x.n)}% - 4px)`;
        if(r.schaduw)return `<div class="be schaduw" style="${pos}"><span class="tl">${esc(SLEEP.doel.label)}</span></div>`;
        const k=r.bestuurder.kleur,wv=echteW(r).length,bezig=GEBAREN.BEZIG.includes(r.status);
        return `<div class="be ${r.status} ${wv?'w':''} ${r.id===RIT?'sel':''} ${bezig?'bezig':'sleepbaar'}" tabindex="0" data-rit="${r.id}" style="${pos};border-color:${k}">${bezig?'':'<i class="greep boven" data-greep="boven"></i>'}<b style="color:${k}">${esc(r.bestuurder.naam||'geen bestuurder')}${coord(r)?' ·c':''} #${r.id}${wv?' ⚠':''}</b><span class="vt">${esc(r.voertuig.naam||'geen voertuig')} ${bez(r)}</span>${r.stops.map(s=>`<span class="${s.slot}${SLEEP&&SLEEP.samen&&SLEEP.samen.includes(s.taak_id)?' samen':''}">${esc(s.tijd)} ${s.slot==='vrij'?'◌':'🔒'} ${esc(s.locatie)}</span>`).join('')}${FLITS&&FLITS.rit===r.id?`<div class="flits">${esc(FLITS.tekst)} ${r.laatste_wijziging?`<button data-ongedaan="${r.id}">ongedaan</button>`:''}</div>`:''}${bezig?'':'<i class="greep onder" data-greep="onder"></i>'}</div>`;
      }).join('');
      return `<div class="kolom ${x.d.weekend?'wk':''} ${x.d.datum===DAG?'act':''}" style="flex:${flex(x)}" data-dag="${x.d.datum}">${'<i></i>'.repeat(uren.length)}${blokken}${x.d.ritten.length?'':`<button class="knop licht klein plus" data-plus="${x.d.datum}">+ rit</button>`}</div>`;
    }).join('');
    $('lade').style.display=LADE?'':'none';
    tekenLade();
  }

  function tekenLade(){
    const d=dagVan(DAG),dt=d0(DAG);
    const dagNaam=`${DAGLANG[dt.getDay()]} ${dt.getDate()} ${MAAND[dt.getMonth()]}`;
    $('lade-titel').textContent=`${dagNaam[0].toUpperCase()+dagNaam.slice(1)} · ${d.ritten.length} ${d.ritten.length===1?'rit':'ritten'}`;
    // Dag-inzoom: rij per bestuurder van die dag, vaste chauffeurs zonder rit als lege rij, "+ iemand anders".
    const rijen=[];
    d.ritten.forEach(r=>{const key=(r.bestuurder.naam||'').trim().toLowerCase()||('p'+r.bestuurder.personeel_id);
      let rij=rijen.find(x=>x.key===key);if(!rij)rijen.push(rij={key,b:r.bestuurder,ritten:[]});rij.ritten.push(r);});
    P.personen.filter(p=>p.vast&&!rijen.some(x=>x.key===(p.naam||'').trim().toLowerCase()||x.key==='p'+p.personeel_id)).forEach(p=>rijen.push({key:(p.naam||'').trim().toLowerCase()||('p'+p.personeel_id),b:{...p,rol:'chauffeur'},ritten:[],leeg:true}));
    const uren=urenLijst().map(u=>u.slice(0,2));
    $('inzoom').innerHTML=`<div class="uren"><span class="wie">${esc(dagNaam)}</span>${uren.map(u=>`<span>${u}</span>`).join('')}</div>`+rijen.map(x=>
      `<div class="rij"><div class="wie"><b style="color:${x.b.kleur}">${esc(x.b.naam||'geen bestuurder')}</b><span>${x.b.rol==='chauffeur'?'chauffeur':x.b.rol==='kantoor'?'kantoor':'anders'}</span></div><div class="spoor">${'<i></i>'.repeat(uren.length)}${
        x.leeg?`<button class="knop licht klein leeg" data-plus="${DAG}" data-pid="${x.b.personeel_id}">+ rit</button>`:x.ritten.map(r=>{
          const a=min(r.vertrek)??480,b=Math.max(min(r.einde)??a,a+30),wv=echteW(r).length;
          return `<div class="blok ${wv?'w':''} ${r.id===RIT?'sel':''}" data-rit="${r.id}" style="left:${f2(pct(a))}%;width:calc(${f2(pct(b))}% - ${f2(pct(a))}%);border-color:${r.bestuurder.kleur}"><b>#${r.id} ${esc(r.voertuig.naam||'geen voertuig')} ${bez(r)}${wv?' ⚠':''}</b></div>`;}).join('')}</div></div>`).join('')
      +`<div class="rij ander"><div class="wie"><b data-plus="${DAG}" data-ander="1" style="cursor:pointer">+ iemand anders</b><span>kantoor</span></div><div class="spoor leegspoor"><span>Kies een medewerker; de rit krijgt het label "rijdt mee". Voertuig: pool of eigen/huurwagen met capaciteit.</span></div></div>`;
    tekenDetail();
  }

  function tekenDetail(){
    const el=$('detail'),d=dagVan(DAG);
    if(MODUS==='nieuw')return tekenNieuw(el);
    if(MODUS==='open'||!RIT||!ritVan(RIT)){
      el.innerHTML=`<div class="ritkop"><div><b>Nog te plannen · ${esc(d.dag)}</b><span>${d.open.length} taken zonder rit</span></div><div class="acties"><button class="knop klein" data-plus="${DAG}">+ rit</button></div></div><div class="scroll">${
        d.open.length?d.open.map(o=>`<div data-sleepopen="${o.taak_id}" class="sleepbaar open ${o.soort==='rest'||o.soort==='weekend'?'oranje':''}"><div class="nm">${esc(o.naam)}<b>${esc([o.route,o.stuks?o.stuks+(o.stuks===1?' stuk':' stuks'):null,o.tijd].filter(Boolean).join(' · '))}</b></div><span class="pil ${o.soort==='weekend'||o.soort==='rest'?'oranje':''}">${esc(o.soort)}</span><button class="knop klein" data-aanrit="${o.taak_id}">→ aan rit</button></div>`).join('')
        :'<div class="leegtxt">Niets meer te plannen op deze dag</div>'}</div>`;
      return;
    }
    const r=ritVan(RIT),dt=d0(DAG),wv=echteW(r);
    el.innerHTML=`<div class="ritkop"><div><b>Rit #${r.id} · ${esc(d.dag.split(' ')[0])} ${dt.getDate()} ${MAAND[dt.getMonth()].slice(0,3)} · ${esc(r.vertrek||'?')}–${esc(r.einde||'?')}</b><span>${bestuurderKeuze(r)}${coord(r)?' (rijdt mee)':''} · ${voertuigKeuze(r)} · ${aanhangKeuze(r)} · <i>${esc(bez(r))}</i> · geschat einde <input type="time" class="vsel" data-einde="${r.id}" aria-label="Geschat einde" value="${esc((r.meting&&r.meting.geschat)||'')}">${r.meting&&r.meting.tekst?' · '+esc(r.meting.tekst):''}${r.meting&&r.meting.vorig?' · eerder geschat '+esc(r.meting.vorig):''}${r.notitie?' · '+esc(r.notitie):''}${r.vol_tekst?' · '+esc(r.vol_tekst):''}</span></div>${
      wv.length?`<div class="waarsch">⚠ ${esc(wv.join(' · '))}</div>`:r.waarschuwingen.includes('weekend')?(()=>{const b=r.waarschuwingen.find(w=>/^weekend · /.test(w));return '<div class="waarsch">'+(b&&/bevestigd door/.test(b)?'✓ '+esc(b):'⚠ '+esc(b||'weekend: uitzondering'))+'</div>';})():''}<div class="acties"><a class="knop licht klein" href="/opdracht?datum=${esc(r.datum||'')}&rit=${r.id}">Opdracht</a><button class="knop licht klein" data-act="stop-nieuw">+ Stop</button><button class="knop licht klein" data-act="splits">Splitsen</button><button class="knop licht klein" data-act="link">Rit-link</button>${r.klaarzet_status==='klaar'&&(!r.status||r.status==='gepland')?'<button class="knop licht klein" data-act="klaar-terug">Terugzetten</button>':''}<button class="knop klein" data-act="klaar">${r.klaarzet_status==='klaar'?'Klaargezet ✓':'Klaarzetten'}</button></div></div><div class="scroll">${ritLinkBlok(r)}${
      r.stops.length?r.stops.map((s,i)=>`<div class="stop ${s.slot} ${s.geladen?'geladen':'sleepbaar'}" data-taak="${s.taak_id}" data-i="${i}"><div class="t">${esc(s.tijd)}</div><div class="nm">${esc(s.locatie)}<b>${esc(s.wat)}${s.status!=='gepland'?' · '+esc(s.status):''}</b></div><span class="pil ${s.slot==='vrij'?'oranje':''}" data-slot="${s.taak_id}" title="Tik om te wisselen tussen vast en vrij">${s.slot==='vrij'?'vrij':'🔒 vast'}</span><div class="pijl"><button data-wissel="${s.taak_id}" data-r="omhoog" ${i===0?'disabled':''}>▲</button><button data-wissel="${s.taak_id}" data-r="omlaag" ${i===r.stops.length-1?'disabled':''}>▼</button></div><button class="knop licht klein" data-mat="${s.taak_id}">+ Materiaal</button><button class="knop licht klein" data-uit="${s.taak_id}">✕</button></div>${(s.regels||[]).map(g=>`<div class="stopregel"><span>${esc(g.naam)}</span><input type="number" min="1" data-rq="${g.id}" value="${g.qty}" aria-label="Aantal"><button class="knop licht klein" data-rweg="${g.id}" aria-label="Regel verwijderen">✕</button></div>`).join('')}`).join('')
      :'<div class="leegtxt">Nog geen stops — zet een taak op deze rit via "N open" in de dagkop</div>'}</div>`;
  }

  // LK1 (VT1-restpunt): het voertuig in het ritdetail is een keuzelijst, dezelfde als bij Nieuwe rit (eigen · huur · privé · ander voertuig…, "(ook op rit #n)" blijft kiesbaar).
  const _minR=t=>{const m=/^(\d{1,2}):(\d{2})$/.exec(t||'');return m?(+m[1])*60+(+m[2]):null;};
  let LINK=null;
  const ritLinkBlok=r=>LINK&&LINK.rit===r.id?`<div class="ritlink" style="display:flex;gap:8px;align-items:center;padding:8px 10px;background:#eff6ff;border-radius:8px;margin:6px 0"><input readonly value="${esc(LINK.url)}" aria-label="Rit-link" style="flex:1;min-width:0;height:36px;border:1px solid #cbd5e1;border-radius:8px;padding:0 8px;font:inherit;font-size:12px"><button type="button" class="knop licht klein" data-act="kopieer">Kopieer</button></div>`:'';
  const kopieer=async()=>{if(!LINK)return;try{await navigator.clipboard.writeText(LINK.url);toast('Rit-link gekopieerd','success');}catch(x){toast('Kopiëren lukt hier niet: selecteer de link en kopieer zelf','warn');}};
  function bestuurderKeuze(r){
    const vast=P.personen.filter(p=>p.vast),huidig=r.bestuurder.personeel_id||'';
    const op=p=>`<option value="${p.personeel_id}" ${p.personeel_id===huidig?'selected':''}>${esc(p.naam)}${p.rol&&p.rol!=='chauffeur'?' ('+esc(p.rol)+')':''}</option>`;
    const ander=P.alle_personeel.filter(p=>!vast.some(v=>v.personeel_id===p.personeel_id));
    return `<select class="vsel" data-bsel="${r.id}" aria-label="Bestuurder van rit #${r.id}">${huidig?'':`<option value="" selected>${esc(r.bestuurder.naam||'geen bestuurder')}</option>`}<optgroup label="Vaste chauffeurs">${vast.map(op).join('')}</optgroup><optgroup label="Iemand anders (rijdt mee)">${ander.map(op).join('')}</optgroup></select>`;
  }
  async function bestuurderWissel(sel){
    if(sel.value==='')return;
    const ritId=parseInt(sel.dataset.bsel);
    const r=await api('PUT',`/api/ritten/${ritId}`,{personeel_id:parseInt(sel.value)||null});
    if(!r.ok){toast(r.json.error||'Bestuurder wisselen mislukt','error');return laad();}
    toast('Bestuurder gewijzigd','success');RIT=ritId;await laad();
  }
  document.addEventListener('change',e=>{const s=e.target.closest&&e.target.closest('select[data-bsel]');if(s)bestuurderWissel(s);});
  function voertuigKeuze(r){
    const GR={eigen:'Eigen voertuigen',huur:'Huur',prive:'Privé'},vt=_minR(r.vertrek),et=_minR(r.einde);
    const ook=v=>{const o=((v.bezet_op_dag||{})[r.datum]||[]).find(x=>x.rit_id!==r.id&&(vt==null||et==null||x.vertrek===''||x.einde===''||(_minR(x.vertrek)<=Math.max(et,vt)&&vt<=_minR(x.einde))));return o?` (ook op rit #${o.rit_id})`:'';};
    const huidig=r.voertuig.id||'';
    const groepen=['eigen','huur','prive'].map(s=>{const l=P.voertuigen.filter(v=>v.soort===s);return l.length?`<optgroup label="${GR[s]}">${l.map(v=>`<option value="${v.id}" ${v.id===huidig?'selected':''}>${esc(v.naam)}${v.plaatsen?' (± '+v.plaatsen+' bakken)':''}${esc(ook(v))}</option>`).join('')}</optgroup>`:'';}).join('');
    const vrij=!huidig&&r.voertuig.naam?`<option value="" selected>${esc(r.voertuig.naam)} (vrije naam)</option>`:'';
    return `<select class="vsel" data-vsel="${r.id}" aria-label="Voertuig van rit #${r.id}">${vrij}${groepen}<option value="nieuw">Ander voertuig…</option></select>`;
  }
  const aanhangKeuze=r=>`<select class="vsel" data-asel="${r.id}" aria-label="Aanhangwagen van rit #${r.id}"><option value="">geen aanhangwagen</option>${(P.aanhangwagens||[]).map(a=>`<option value="${a.id}" ${a.id===r.aanhangwagen_id?'selected':''}>${esc(a.naam)}</option>`).join('')}</select>`;
  async function voertuigWissel(sel){
    const ritId=parseInt(sel.dataset.vsel);let body;
    if(sel.value==='nieuw'){
      const x=await vraag({titel:'Ander voertuig',ok:'Opslaan',html:'<label>Naam van het voertuig<input name="vnaam" value="Eigen wagen"></label><label>Past ongeveer (bakken, alleen info)<input name="cap" type="number" min="1"></label>',lees:f=>f.vnaam.value.trim()?{naam:f.vnaam.value.trim(),cap:parseInt(f.cap.value)||null}:(toast('Naam is verplicht','warn'),null)});
      if(!x)return laad();
      body={voertuig:x.naam,voertuig_soort:'eigen',voertuig_capaciteit:x.cap};
    }else if(sel.value==='')return;else body={voertuig_id:parseInt(sel.value)};
    const r=await api('PUT',`/api/ritten/${ritId}`,body);
    if(!r.ok){toast(r.json.error||'Voertuig wisselen mislukt','error');return laad();}
    toast('Voertuig gewijzigd','success');RIT=ritId;await laad();
  }
  document.addEventListener('change',e=>{const s=e.target.closest&&e.target.closest('select[data-vsel]');if(s)voertuigWissel(s);});
  document.addEventListener('change',async e=>{const s=e.target.closest&&e.target.closest('select[data-asel]');if(!s)return;const r=await api('PUT',`/api/ritten/${s.dataset.asel}`,{aanhangwagen_id:s.value?+s.value:null});if(!r.ok)toast(r.json.error||'Aanhangwagen wisselen mislukt','error');laad();});

  function opties(){
    const vast=P.personen.filter(p=>p.vast);
    return `<optgroup label="Vaste chauffeurs">${vast.map(p=>`<option value="${p.personeel_id}">${esc(p.naam)}</option>`).join('')}</optgroup><optgroup label="Iemand anders… (rijdt mee)">${
      P.alle_personeel.filter(p=>!vast.some(v=>v.personeel_id===p.personeel_id)).map(p=>`<option value="${p.personeel_id}">${esc(p.naam)} (${esc(p.rol)})</option>`).join('')}</optgroup>`;
  }
  function tekenNieuw(el){
    el.innerHTML=`<div class="ritkop"><div><b>Nieuwe rit</b><span>${NIEUW.taak_ids?'met taak #'+NIEUW.taak_ids.join(', #'):'bestuurder = elke medewerker · voertuig pool, eigen of huur'}</span></div></div><div class="scroll"><form class="form" id="nf" onsubmit="return false">
      <label>Datum<input type="date" name="datum" value="${esc(NIEUW.datum||DAG)}"></label>
      <label>Vertrek<input type="time" name="vertrek" value="${esc(NIEUW.vertrek||(P&&P.standaard_vertrek)||'08:00')}"></label>
      <label>Geschat einde<input type="time" name="einde"></label>
      <label>Bestuurder<select name="personeel_id">${opties()}</select></label>
      <label>Voertuig<select name="voertuig"></select></label>
      <label>Aanhangwagen<select name="aanhang"><option value="">Geen aanhangwagen</option>${(P.aanhangwagens||[]).map(a=>`<option value="${a.id}">${esc(a.naam)}</option>`).join('')}</select></label>
      <label id="nf-cap" style="display:none">Naam van het voertuig<input name="vnaam" value="Eigen wagen"></label>
      <label id="nf-cap2" style="display:none">Capaciteit (bakken)<input type="number" min="1" name="cap" value="6"></label>
      <div class="knoppen"><button class="knop licht klein" data-act="annuleer">Annuleren</button><button class="knop klein" data-act="maak">Rit maken</button></div></form></div>`;
    const f=$('nf');
    if(NIEUW.personeel_id)f.personeel_id.value=NIEUW.personeel_id;
    else if(NIEUW.ander)f.personeel_id.value=(P.alle_personeel.find(p=>!P.personen.some(v=>v.vast&&v.personeel_id===p.personeel_id))||{}).personeel_id||'';
    // VT1: eigen voertuigen bovenaan, dan huur, dan privé, dan "ander voertuig…"; een voertuig dat dan al op een andere rit staat toont "(ook op rit #n)" maar blijft kiesbaar.
    const GROEP={eigen:'Eigen voertuigen',huur:'Huur',prive:'Privé'};
    const _min=t=>{const m=/^(\d{1,2}):(\d{2})$/.exec(t||'');return m?(+m[1])*60+(+m[2]):null;};
    const vulVoertuigen=()=>{
      const dag=f.datum.value,vt=_min(f.vertrek.value);
      const ook=v=>{const l=(v.bezet_op_dag||{})[dag]||[];const o=l.find(x=>vt==null||x.vertrek===''||x.einde===''||(_min(x.vertrek)<=vt&&vt<=_min(x.einde)));return o?` (ook op rit #${o.rit_id})`:'';};
      const keuze=f.voertuig.value;
      f.voertuig.innerHTML=['eigen','huur','prive'].map(s=>{const l=P.voertuigen.filter(v=>v.soort===s);return l.length?`<optgroup label="${GROEP[s]}">${l.map(v=>`<option value="${v.id}">${esc(v.naam)}${v.plaatsen?' (± '+v.plaatsen+' bakken)':''}${esc(ook(v))}</option>`).join('')}</optgroup>`:'';}).join('')+'<option value="">Ander voertuig…</option>';
      if(keuze!==''&&[...f.voertuig.options].some(o=>o.value===keuze))f.voertuig.value=keuze;
      capZicht();
    };
    const capZicht=()=>{const vrij=f.voertuig.value==='';$('nf-cap').style.display=vrij?'':'none';$('nf-cap2').style.display=vrij?'':'none';};
    f.voertuig.onchange=capZicht;f.datum.onchange=vulVoertuigen;f.vertrek.onchange=vulVoertuigen;vulVoertuigen();
  }
  async function maakRit(){
    const f=$('nf'),vid=parseInt(f.voertuig.value)||null,pid=parseInt(f.personeel_id.value)||null;
    const datum=f.datum.value;
    if(!datum)return toast('Kies een datum','warn');
    if([0,6].includes(d0(datum).getDay())){
      if(!await vraag({titel:'Rit in het weekend?',tekst:'Weekendritten zijn een uitzondering, geen verbod. Toch inplannen?',ok:'Ja, inplannen'}))return;
    }
    const body={datum,vertrek:f.vertrek.value,einde:f.einde.value||undefined,personeel_id:pid,taak_ids:NIEUW.taak_ids||[],aanhangwagen_id:f.aanhang.value?+f.aanhang.value:null};
    if(vid)body.voertuig_id=vid;
    else{body.voertuig=f.vnaam.value.trim()||'Eigen wagen';body.voertuig_soort='eigen';body.voertuig_capaciteit=parseInt(f.cap.value)||null;}
    const r=await api('POST','/api/ritten',body);
    if(!r.ok)return toast(r.json.error||'Rit maken mislukt','error');
    if([0,6].includes(d0(datum).getDay()))for(const tid of (NIEUW.taak_ids||[])){const wb=await api('POST',`/api/transport-taken/${tid}/weekend-bevestig`);if(!wb.ok)toast(wb.json.error||'Bevestiging bewaren mislukt','warn');}
    toast(`Rit #${r.json.id} gemaakt`,'success');
    // TF6 N15: staan er die dag nog andere taken zonder rit, dan blijft de lijst open staan (geen extra tik per taak).
    const nogOpen=(dagVan(DAG)&&dagVan(DAG).open?dagVan(DAG).open.length:0)-(NIEUW.taak_ids||[]).length;
    if(nogOpen>0){MODUS='open';RIT=null;}else{MODUS='rit';RIT=r.json.id;}NIEUW={};
    if(datum<P.week.start||datum>P.week.eind)WEEK=datum;
    DAG=datum;laad();
  }

  async function aanRit(taakId){
    const d=dagVan(DAG),o=d.open.find(x=>x.taak_id===taakId);
    if(d.weekend&&!await vraag({titel:'Weekendtaak inplannen?',tekst:'Dit is een weekendtaak: een uitzondering, geen verbod. Toch op een rit zetten?',ok:'Ja, inplannen'}))return;
    const keuze=await vraag({titel:`${o.naam} → aan rit`,tekst:o.route,ok:'Op deze rit zetten',
      html:`<label>Rit<select name="rit">${d.ritten.map(r=>`<option value="${r.id}">#${r.id} · ${esc(r.vertrek)} · ${esc(r.bestuurder.naam||'geen bestuurder')} · ${esc(r.voertuig.naam||'')}</option>`).join('')}<option value="nieuw">+ nieuwe rit…</option></select></label>`,
      lees:bg=>({rit:bg.querySelector('[name=rit]').value})});
    if(!keuze)return;
    if(keuze.rit==='nieuw'){MODUS='nieuw';NIEUW={datum:DAG,vertrek:o.tijd||'08:00',taak_ids:[taakId]};return tekenDetail();}
    const r=await api('PUT',`/api/transport-taken/${taakId}/rit`,{rit_id:parseInt(keuze.rit)});
    if(r.ok&&d.weekend){const wb=await api('POST',`/api/transport-taken/${taakId}/weekend-bevestig`);if(!wb.ok)toast(wb.json.error||'Bevestiging bewaren mislukt','warn');}
    if(!r.ok)return toast(r.json.error||'Op rit zetten mislukt','error');
    toast(`Taak op rit #${keuze.rit} gezet`,'success');
    const nogOpen=(dagVan(DAG)&&dagVan(DAG).open?dagVan(DAG).open.length:0)-1; // TF6 N15
    if(nogOpen>0){MODUS='open';RIT=null;}else{RIT=parseInt(keuze.rit);MODUS='rit';}
    laad();
  }
  async function splits(){
    const g=await api('GET',`/api/ritten/${RIT}`);
    if(!g.ok)return toast(g.json.error||'Rit laden mislukt','error');
    const taken=g.json.taken.filter(t=>(t.regels||[]).length>1);
    if(!taken.length)return toast('Geen stop met meer dan één regel om te splitsen','warn');
    const k=await vraag({titel:'Splitsen',tekst:'Kies de stop en de regels die naar een nieuwe taak verhuizen (bv. de helft een dag later).',ok:'Splitsen',
      html:`<label>Stop<select name="taak">${taken.map(t=>`<option value="${t.id}">#${t.id} · ${esc(t.tijd)} · ${esc(t.type)}</option>`).join('')}</select></label><div id="sp-regels"></div><label>Nieuwe datum<input type="date" name="datum" value="${esc(DAG)}"></label>`,
      lees:bg=>{const ids=[...bg.querySelectorAll('[name=regel]:checked')].map(x=>parseInt(x.value));
        if(!ids.length){toast('Kies minstens één regel','warn');return null;}
        return {taak:bg.querySelector('[name=taak]').value,ids,datum:bg.querySelector('[name=datum]').value};}});
    if(!k)return;
    const r=await api('POST',`/api/transport-taken/${k.taak}/splits`,{regel_ids:k.ids,datum:k.datum});
    if(!r.ok)return toast(r.json.error||'Splitsen mislukt','error');
    toast(`${r.json.verplaatst} regel(s) afgesplitst naar taak #${r.json.nieuwe_taak_id}`,'success');laad();
  }
  // TF11: + Stop en + Materiaal, en de regels zelf. Eén route voor desktop en gsm.
  const locOpties=(gekozen)=>(P.locaties||[]).map(l=>`<option value="${l.id}" ${l.id===gekozen?'selected':''}>${esc(l.naam)}</option>`).join('');
  const rozenweg=()=>((P.locaties||[]).find(l=>l.naam==='Rozenweg')||{}).id;
  async function stopNieuw(){
    const r=ritVan(RIT),v=await vraag({titel:`+ Stop op rit #${r.id}`,ok:'Stop toevoegen',html:`<label>Soort<select name="type"><option value="levering">Levering</option><option value="ophaling">Ophaling</option></select></label><label>Van<select name="van">${locOpties(rozenweg())}</select></label><label>Naar<select name="naar">${locOpties()}</select></label><label>Tijd<input type="time" name="tijd" value="${esc(r.vertrek||'')}"></label>`,
      lees:bg=>({type:bg.querySelector('[name=type]').value,van_locatie_id:+bg.querySelector('[name=van]').value,naar_locatie_id:+bg.querySelector('[name=naar]').value,tijd:bg.querySelector('[name=tijd]').value})});
    if(!v)return;const a=await api('POST',`/api/ritten/${RIT}/stops`,v);if(!a.ok)return toast(a.json.error||'Stop toevoegen mislukt','error');toast('Stop toegevoegd','success');laad();
  }
  let MATRES=[];
  const matRijen=(gsm)=>MATRES.map((m,i)=>gsm?`<button type="button" class="mresult" data-g="mat-kies" data-i="${i}"><span>${esc(m.naam)}</span><small>${esc(m.sub)}</small></button>`:`<label class="mresult"><input type="radio" name="mk" value="${i}"><span>${esc(m.naam)}</span><small>${esc(m.sub)}</small></label>`).join('')||'<div class="leegtxt">Niets gevonden. Vul eventueel een vrije tekst in.</div>';
  let matTm=null;
  document.addEventListener('input',e=>{
    const t=e.target;if(t.name!=='mq')return;clearTimeout(matTm);
    matTm=setTimeout(async()=>{const r=await api('GET','/api/rit-materiaal?q='+encodeURIComponent(t.value));MATRES=r.ok?r.json.resultaten:[];const b=document.getElementById('m-res');if(b)b.innerHTML=matRijen(!!t.closest('#gsm'));},200);
  });
  async function regelBewaar(taakId,body){const a=await api('POST',`/api/transport-taken/${taakId}/regels`,body);if(!a.ok){toast(a.json.error||'Toevoegen mislukt','error');return false;}if(a.json.melding)toast(a.json.melding,'warn');else toast('Toegevoegd','success');laad();return true;}
  async function materiaal(taakId){
    MATRES=[];
    const v=await vraag({titel:'+ Materiaal',ok:'Toevoegen',html:'<label>Zoek bak, attribuut, sportset of artikel<input name="mq" autocomplete="off"></label><div id="m-res"></div><label>Of vrije tekst<input name="mvrij" maxlength="200"></label><label>Aantal<input type="number" min="1" name="mn" value="1"></label>',
      lees:bg=>{const k=bg.querySelector('[name=mk]:checked'),n=+bg.querySelector('[name=mn]').value||1,vr=bg.querySelector('[name=mvrij]').value.trim();if(k){const m=MATRES[+k.value];return {bron:m.bron,id:m.id,qty:n};}if(vr)return {bron:'tekst',naam:vr,qty:n};toast('Kies iets of vul een vrije tekst in','warn');return null;}});
    if(v)regelBewaar(taakId,v);
  }
  document.addEventListener('change',async e=>{
    const t=e.target;
    if(t.dataset&&t.dataset.einde){const a=await api('PUT',`/api/ritten/${t.dataset.einde}`,{einde:t.value});if(!a.ok)toast(a.json.error||'Einde bewaren mislukt','error');return laad();}
    if(t.dataset&&t.dataset.rq){const a=await api('PUT',`/api/transport-regels/${t.dataset.rq}`,{qty:+t.value});if(!a.ok)toast(a.json.error||'Aantal bewaren mislukt','error');return laad();}
  });
  document.addEventListener('click',async e=>{
    const w=e.target.closest&&e.target.closest('[data-rweg]');if(w){const a=await api('DELETE',`/api/transport-regels/${w.dataset.rweg}`);if(!a.ok)return toast(a.json.error||'Verwijderen mislukt','error');return laad();}
    if(e.target.closest&&e.target.closest('#gsm'))return;
    const m=e.target.closest&&e.target.closest('[data-mat]');if(m)return materiaal(+m.dataset.mat);
    if(e.target.closest&&e.target.closest('[data-act="stop-nieuw"]'))return stopNieuw();
  });
  // De regelkeuze in het splitsvenster volgt de gekozen stop.
  document.addEventListener('change',async e=>{
    if(e.target.name!=='taak'||!e.target.closest('.mbox'))return;
    vulRegels(e.target.closest('.mbox'));
  });
  async function vulRegels(box){
    const g=await api('GET',`/api/ritten/${RIT}`),t=g.json.taken.find(x=>String(x.id)===box.querySelector('[name=taak]').value);
    box.querySelector('#sp-regels').innerHTML=(t?t.regels:[]).map(rg=>`<label class="chk"><input type="checkbox" name="regel" value="${rg.id}">${esc(rg.naam)} × ${rg.qty}</label>`).join('');
  }
  new MutationObserver(()=>{const b=document.querySelector('.mbox #sp-regels');if(b&&!b.dataset.v){b.dataset.v=1;vulRegels(b.closest('.mbox'));}}).observe(document.body,{childList:true});

  document.addEventListener('click',async e=>{
    const t=e.target;
    const plus=t.closest('[data-plus]');
    if(plus){e.stopPropagation();DAG=plus.dataset.plus;MODUS='nieuw';NIEUW={datum:DAG,personeel_id:plus.dataset.pid||null,ander:!!plus.dataset.ander};LADE=true;return teken();}
    const open=t.closest('[data-open]');
    if(open){DAG=open.dataset.open;MODUS='open';RIT=null;LADE=true;return teken();}
    const rit=t.closest('[data-rit]');
    if(rit){RIT=parseInt(rit.dataset.rit);DAG=ritVan(RIT).datum||DAG;P.dagen.forEach(d=>{if(d.ritten.some(x=>x.id===RIT))DAG=d.datum;});MODUS='rit';LADE=true;return teken();}
    const dag=t.closest('[data-dag]');
    if(dag){DAG=dag.dataset.dag;if(!dagVan(DAG).ritten.some(x=>x.id===RIT)){RIT=null;MODUS=dagVan(DAG).ritten.length?'rit':'open';}LADE=true;return teken();}
    if(t.closest('[data-aanrit]'))return aanRit(parseInt(t.closest('[data-aanrit]').dataset.aanrit));
    const slot=t.closest('[data-slot]');
    if(slot){const s=ritVan(RIT).stops.find(x=>x.taak_id===parseInt(slot.dataset.slot));
      const r=await api('PUT',`/api/transport-taken/${s.taak_id}`,{slot:s.slot==='vrij'?'vast':'vrij'});
      if(!r.ok)return toast(r.json.error||'Slot wisselen mislukt','error');return laad();}
    const ws=t.closest('[data-wissel]');
    if(ws){const r=await api('POST',`/api/ritten/${RIT}/taken/${ws.dataset.wissel}/wissel`,{richting:ws.dataset.r});
      if(!r.ok)return toast(r.json.error||'Wisselen mislukt','error');return laad();}
    const uit=t.closest('[data-uit]');
    if(uit){const r=await api('POST',`/api/ritten/${RIT}/taken/${uit.dataset.uit}/ontkoppel`);
      if(!r.ok)return toast(r.json.error||'Van de rit halen mislukt','error');toast('Taak van de rit gehaald — staat weer bij "open"','success');return laad();}
    const act=t.closest('[data-act]');
    if(act){const a=act.dataset.act;
      if(a==='annuleer'){MODUS=RIT?'rit':'open';NIEUW={};return tekenDetail();}
      if(a==='maak')return maakRit();
      if(a==='splits')return splits();
      if(a==='kopieer')return kopieer();
      if(a==='link'){const r=await api('POST',`/api/ritten/${RIT}/token`);if(!r.ok)return toast(r.json.error||'Rit-link maken mislukt','error');
        const url=location.origin+r.json.url;LINK={rit:RIT,url};tekenDetail();await kopieer();return;}
      if(a==='klaar-terug'){const r=await api('POST',`/api/ritten/${RIT}/klaarzet-terug`,{});if(!r.ok)return toast(r.json.error||'Terugzetten mislukt','error');toast('Rit staat niet meer klaar','success');return laad();}
      if(a==='klaar'){const r=await api('POST',`/api/ritten/${RIT}/klaarzet`,{});if(!r.ok)return toast(r.json.error||'Klaarzetten mislukt','error');toast('Rit klaargezet door '+r.json.klaarzet_door,'success');return laad();}
    }
  });
  // ── RP2: pointer-gebaren (muis én touch; touch = lang drukken 250 ms, zodat scrollen blijft werken) ──
  const gb=()=>{return GEBAREN.maak({P,api,vraag,toast,na:async(ritId,tekst)=>{if(ritId&&tekst)FLITS={rit:ritId,tekst};SLEEP=null;if(ritId)RIT=ritId;await laad();if(FLITS&&FLITS.rit===ritId){const f=FLITS;setTimeout(()=>{if(FLITS===f){FLITS=null;teken();}},4000);}const dg=ritId&&P.dagen.find(d=>d.ritten.some(x=>x.id===ritId));if(dg&&dg.datum!==DAG){DAG=dg.datum;MODUS="rit";teken();}}});};
  const geoNu=()=>{const k=[...document.querySelectorAll('#raster .kolom')].find(c=>c.getBoundingClientRect().height>0);return {kolomHoogte:k?k.getBoundingClientRect().height:600,
    dagOp:x=>{const kol=[...document.querySelectorAll('#raster .kolom')].find(c=>{const b=c.getBoundingClientRect();return x>=b.left&&x<=b.right;});return kol?kol.dataset.dag:null;}};};
  const uurOp=(kolom,y)=>{const b=kolom.getBoundingClientRect();return GEBAREN.hm(Math.max(0,Math.min(23*60+45,GEBAREN.snap(GEBAREN.AS0+(y-b.top)/b.height*GEBAREN.AS_MIN))));};
  const onder=(x,y)=>{const els=document.elementsFromPoint?document.elementsFromPoint(x,y):[document.elementFromPoint(x,y)];return els.find(e=>e&&!e.closest('.schaduw,.sleepkaart,.bron'))||null;};
  let wacht=null;
  document.addEventListener('pointerdown',e=>{
    if(e.button>0||e.target.closest('button,select,input,[data-slot],.pijl'))return;
    const blok=e.target.closest('#raster .be[data-rit]'),stop=e.target.closest('#detail .stop[data-taak]'),open=e.target.closest('[data-sleepopen]');
    if(!blok&&!stop&&!open)return;
    const p0={x:e.clientX,y:e.clientY},touch=e.pointerType==='touch';
    const start=()=>{wacht=null;
      if(blok){const rit=alleRitten().find(r=>r.id===parseInt(blok.dataset.rit));
        if(GEBAREN.BEZIG.includes(rit.status)){toast('rit is al bezig','warn');return;}
        const gr=e.target.closest('[data-greep]');SLEEP={soort:gr?'greep':'rit',kant:gr&&gr.dataset.greep,rit,p0,doel:null};}
      else if(stop){const s=ritVan(RIT).stops.find(x=>x.taak_id===parseInt(stop.dataset.taak));
        if(s.geladen){toast('Deze stop is al geladen — eerst lossen of terugzetten','warn');return;}
        SLEEP={soort:'stop',stop:{rit_id:RIT,taak_id:s.taak_id},p0,el:stop,kaart:sleepKaart(stop,p0)};}
      else SLEEP={soort:'open',open:{taak_id:parseInt(open.dataset.sleepopen),datum:DAG},p0,kaart:sleepKaart(open,p0)};
      document.body.classList.add('sleept');
    };
    if(touch){wacht={t:setTimeout(start,GEBAREN.mobielMaten(innerWidth).langDruk),p0};}else{e.preventDefault();start();}
  });
  function sleepKaart(el,p0){const b=el.getBoundingClientRect(),k=el.cloneNode(true);k.classList.add('sleepkaart');
    Object.assign(k.style,{left:b.left+'px',top:b.top+'px',width:b.width+'px'});k.dataset.dx=p0.x-b.left;k.dataset.dy=p0.y-b.top;document.body.appendChild(k);return k;}
  document.addEventListener('pointermove',e=>{
    if(wacht){if(Math.hypot(e.clientX-wacht.p0.x,e.clientY-wacht.p0.y)>8){clearTimeout(wacht.t);wacht=null;}return;}
    if(!SLEEP)return;e.preventDefault();
    const p={x:e.clientX,y:e.clientY};
    if(SLEEP.kaart){SLEEP.kaart.style.left=(p.x-SLEEP.kaart.dataset.dx)+'px';SLEEP.kaart.style.top=(p.y-SLEEP.kaart.dataset.dy)+'px';
      const el=onder(p.x,p.y),kol=el&&el.closest('#raster .kolom');document.querySelectorAll('.doel').forEach(x=>x.classList.remove('doel'));
      const doelEl=el&&(el.closest('[data-rit]')||el.closest('#detail .stop[data-taak]')||kol);if(doelEl)doelEl.classList.add('doel');
      SLEEP.kaart.querySelector('.tl')?.remove();
      if(SLEEP.soort==='open'&&kol&&!el.closest('[data-rit]')){const t=document.createElement('span');t.className='tl';t.textContent=GEBAREN.label(kol.dataset.dag,uurOp(kol,p.y));SLEEP.kaart.prepend(t);}
      return;}
    const geo=geoNu(),d=SLEEP.soort==='rit'?gb().doelRit(SLEEP.rit,geo,SLEEP.p0,p):gb().doelGreep(SLEEP.rit,SLEEP.kant,geo,SLEEP.p0,p);
    if(!SLEEP.doel||d.label!==SLEEP.doel.label){SLEEP.doel=d;SLEEP.samen=d.samen||null;teken();}
  },{passive:false});
  document.addEventListener('pointerup',async e=>{
    if(wacht){clearTimeout(wacht.t);wacht=null;return;}
    if(!SLEEP)return;
    const s=SLEEP,g=gb(),p={x:e.clientX,y:e.clientY};document.body.classList.remove('sleept');
    if(s.kaart)s.kaart.remove();document.querySelectorAll('.doel').forEach(x=>x.classList.remove('doel'));
    if(Math.hypot(p.x-s.p0.x,p.y-s.p0.y)<5){SLEEP=null;teken();return;} // een klik, geen sleep
    LAATSTE_SLEEP=Date.now();
    if(s.soort==='rit'||s.soort==='greep'){if(!s.doel){SLEEP=null;return teken();}
      const r=s.soort==='rit'?await g.verplaats(s.rit,s.doel.datum,s.doel.vertrek):await g.tijden(s.rit,s.kant==='boven'?{vertrek:s.doel.vertrek}:{einde:s.doel.einde});
      if(!r){SLEEP=null;teken();}return;} // tijdens het wachten blijft het schaduwblok staan; laad() tekent opnieuw
    SLEEP=null;
    const el=onder(p.x,p.y);if(!el)return;
    const ritEl=el.closest('[data-rit]'),stopEl=el.closest('#detail .stop[data-taak]'),kol=el.closest('#raster .kolom');
    if(s.soort==='open'){
      if(ritEl)return g.dropOpen(s.open,{soort:'rit',rit_id:parseInt(ritEl.dataset.rit)});
      if(stopEl)return g.dropOpen(s.open,{soort:'rit',rit_id:RIT,volgorde:parseInt(stopEl.dataset.i)+1});
      if(kol)return g.dropOpen(s.open,{soort:'uur',datum:kol.dataset.dag,vertrek:uurOp(kol,p.y)});
      return;}
    if(stopEl&&stopEl!==s.el)return g.dropStop(s.stop,{rit_id:RIT,volgorde:parseInt(stopEl.dataset.i)+1});
    if(ritEl&&parseInt(ritEl.dataset.rit)!==s.stop.rit_id){const doel=ritVan(parseInt(ritEl.dataset.rit));
      if(doel.datum!==ritVan(s.stop.rit_id).datum)return toast('Een stop gaat alleen naar een rit van dezelfde dag','warn');
      return g.dropStop(s.stop,{rit_id:doel.id,volgorde:doel.stops.length+1});}
  });
  document.addEventListener('pointercancel',()=>{if(wacht){clearTimeout(wacht.t);wacht=null;}if(SLEEP){SLEEP.kaart&&SLEEP.kaart.remove();SLEEP=null;document.body.classList.remove('sleept');teken();}});
  let LAATSTE_SLEEP=0;
  document.addEventListener('click',e=>{if(Date.now()-LAATSTE_SLEEP<300){e.stopImmediatePropagation();e.preventDefault();}},true);
  // ongedaan in de bevestigingsflits
  document.addEventListener('click',async e=>{const o=e.target.closest('[data-ongedaan]');if(!o)return;e.stopImmediatePropagation();FLITS=null;await gb().ongedaan(parseInt(o.dataset.ongedaan));},true);
  // Toetsenbord: gekozen blok ±15 min (pijl op/neer), Alt+pijl links/rechts ±1 dag; Enter bevestigt, Esc annuleert.
  document.addEventListener('keydown',async e=>{
    const blok=e.target.closest&&e.target.closest('#raster .be[data-rit]');if(!blok)return;
    const rit=ritVan(parseInt(blok.dataset.rit));
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
      if((e.key==='ArrowLeft'||e.key==='ArrowRight')&&!e.altKey)return;
      e.preventDefault();if(GEBAREN.BEZIG.includes(rit.status))return toast('rit is al bezig','warn');
      const a=GEBAREN.min(rit.vertrek)??480,b=Math.max(GEBAREN.min(rit.einde)??a,a+30);
      const k=SLEEP&&SLEEP.toets&&SLEEP.rit.id===rit.id?SLEEP:{soort:'rit',toets:true,rit,dm:0,dd:0};
      if(e.key==='ArrowUp')k.dm-=15;if(e.key==='ArrowDown')k.dm+=15;if(e.key==='ArrowLeft')k.dd-=1;if(e.key==='ArrowRight')k.dd+=1;
      const datum=GEBAREN.plusDag(rit.datum,k.dd),v=Math.max(0,GEBAREN.snap(a)+k.dm);
      k.doel={datum,vertrek:GEBAREN.hm(v),einde:GEBAREN.hm(v+b-a),label:GEBAREN.label(datum,GEBAREN.hm(v),GEBAREN.hm(v+b-a))};SLEEP=k;teken();
      document.querySelector(`#raster .be[data-rit="${rit.id}"]`)?.focus();return;}
    if(e.key==='Enter'&&SLEEP&&SLEEP.toets){e.preventDefault();const s=SLEEP;if(!(await gb().verplaats(s.rit,s.doel.datum,s.doel.vertrek))){SLEEP=null;teken();}return;}
    if(e.key==='Escape'&&SLEEP){SLEEP=null;teken();}
  });
  document.addEventListener('click',e=>{const n=e.target.closest('[data-dagnav]');if(!n)return;e.stopPropagation();
    const i=P.dagen.findIndex(d=>d.datum===DAG)+parseInt(n.dataset.dagnav);
    if(i<0||i>6){const d=d0(P.week.start);d.setDate(d.getDate()+(i<0?-7:7));WEEK=iso(d);DAG=null;RIT=null;return laad().then(()=>{DAG=P.dagen[i<0?6:0].datum;teken();});}
    DAG=P.dagen[i].datum;RIT=null;MODUS=dagVan(DAG).ritten.length?'rit':'open';teken();},true);
  // swipe ‹ › op de agenda (mobiel): horizontaal vegen zonder slepen wisselt van dag
  let veeg=null;
  $('raster').addEventListener('touchstart',e=>{veeg={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});
  $('raster').addEventListener('touchend',e=>{if(!veeg||SLEEP||innerWidth>=768)return;const dx=e.changedTouches[0].clientX-veeg.x,dy=e.changedTouches[0].clientY-veeg.y;veeg=null;
    if(Math.abs(dx)>60&&Math.abs(dx)>2*Math.abs(dy))document.querySelector(`[data-dagnav="${dx<0?1:-1}"]`)?.click();},{passive:true});

  $('wk-vorig').onclick=()=>{const d=d0(P.week.start);d.setDate(d.getDate()-7);WEEK=iso(d);DAG=null;RIT=null;laad();};
  $('wk-volg').onclick=()=>{const d=d0(P.week.start);d.setDate(d.getDate()+7);WEEK=iso(d);DAG=null;RIT=null;laad();};
  $('lade-sluit').onclick=()=>{LADE=false;teken();};
  $('dag-open').onclick=()=>{MODUS='open';RIT=null;tekenDetail();};

  // Bovenbalk: tellers zoals op Vandaag, periode-kiezer zoals de bestaande (activeer + herladen).
  // ── MOB2: gsm-weergave (zelfde URL, zelfde API; boven 768 px blijft #gsm leeg en verborgen) ──
  const MQ=window.matchMedia('(max-width:767px)');
  let GS={scherm:'lijst',nieuw:null,oprit:null};
  function tekenGsm(){
    let e=$('gsm');if(!e){e=document.createElement('div');e.id='gsm';document.body.insertBefore(e,$('toasts'));}
    if(!P||!MQ.matches){e.innerHTML='';return;}
    let h;
    if(GS.oprit)h=RITGSM.opRit(P,DAG,GS.oprit);
    else if(GS.nieuw)h=RITGSM.nieuw(P,GS.nieuw.datum||DAG,GS.nieuw);
    else if(GS.stap==='stop'&&RIT&&ritVan(RIT))h=RITGSM.stopNieuw(P,ritVan(RIT));
    else if(GS.stap==='zoek')h=RITGSM.matZoek();
    else if(GS.stap==='aantal')h=RITGSM.matAantal(GS.mat);
    else if(GS.scherm==='detail'&&RIT&&ritVan(RIT))h=RITGSM.detail(P,ritVan(RIT));
    else{GS.scherm='lijst';h=RITGSM.lijst(P,DAG);}
    const y=(e.querySelector('.body')||{}).scrollTop||0;
    e.innerHTML=h;const b=e.querySelector('.body');if(b&&y&&!GS.nieuw&&!GS.oprit)b.scrollTop=y;
  }
  if(MQ.addEventListener)MQ.addEventListener('change',tekenGsm);
  document.addEventListener('change',e=>{
    const t=e.target;if(!t.closest||!t.closest('#gsm'))return;
    if(t.name==='voertuig'){const v=t.value==='';const n=$('gnf-n'),c=$('gnf-c');if(n)n.hidden=!v;if(c)c.hidden=!v;return;}
    if(t.dataset.g==='bsel')api('PUT',`/api/ritten/${t.dataset.id}`,{personeel_id:parseInt(t.value)||null}).then(r=>{if(!r.ok)toast(r.json.error||'Bestuurder wisselen mislukt','error');else toast('Bestuurder gewijzigd','success');laad();});
  });
  document.addEventListener('click',async e=>{
    const g=e.target.closest&&e.target.closest('#gsm [data-g]');if(!g)return;
    const a=g.dataset.g;
    if(a==='stop-nieuw'){GS.stap='stop';tekenGsm();return window.scrollTo(0,0);}
    if(a==='stap-terug'){GS.stap=null;return tekenGsm();}
    if(a==='stop-ok'){const f=document.getElementById('gsf'),rr=await api('POST',`/api/ritten/${RIT}/stops`,{type:f.type.value,van_locatie_id:+f.van.value,naar_locatie_id:+f.naar.value,tijd:f.tijd.value});if(!rr.ok)return toast(rr.json.error||'Stop toevoegen mislukt','error');toast('Stop toegevoegd','success');GS.stap=null;return laad();}
    if(a==='mat'){GS.stap='zoek';GS.taak=+g.dataset.taak;MATRES=[];tekenGsm();return window.scrollTo(0,0);}
    if(a==='mat-kies'){const m=MATRES[+g.dataset.i];GS.mat={bron:m.bron,id:m.id,naam:m.naam};GS.stap='aantal';return tekenGsm();}
    if(a==='mat-vrij'){const v=document.getElementById('gm-vrij').value.trim();if(!v)return toast('Vul een tekst in','warn');GS.mat={bron:'tekst',naam:v};GS.stap='aantal';return tekenGsm();}
    if(a==='mat-ok'){const b={...GS.mat,qty:+document.getElementById('gm-n').value||1};if(await regelBewaar(GS.taak,b))GS.stap=null;return;}
    if(a==='dag'){DAG=g.dataset.d;GS.scherm='lijst';return tekenGsm();}
    if(a==='week'){WEEK=GEBAREN.plusDag(P.week.start,7*(+g.dataset.n));DAG=null;GS.scherm='lijst';return laad();}
    if(a==='rit'){RIT=parseInt(g.dataset.id);GS.scherm='detail';tekenGsm();window.scrollTo(0,0);return;}
    if(a==='terug'){GS.scherm='lijst';return tekenGsm();}
    if(a==='nieuw'){GS.nieuw={datum:DAG};return tekenGsm();}
    if(a==='annuleer'){GS.nieuw=null;GS.oprit=null;return tekenGsm();}
    if(a==='oprit'){GS.oprit=parseInt(g.dataset.taak);return tekenGsm();}
    if(a==='oprit-ok'){
      const taakId=parseInt(g.dataset.taak),d=dagVan(DAG),o=d.open.find(x=>x.taak_id===taakId),keuze=document.querySelector('#gor [name=rit]').value;
      if(keuze==='nieuw'){GS.oprit=null;GS.nieuw={datum:DAG,vertrek:(o&&o.tijd)||'08:00',taak_ids:[taakId]};return tekenGsm();}
      if(d.weekend&&!await vraag({titel:'Weekendtaak inplannen?',tekst:'Dit is een weekendtaak: een uitzondering, geen verbod. Toch op een rit zetten?',ok:'Ja, inplannen'}))return;
      const r=await api('PUT',`/api/transport-taken/${taakId}/rit`,{rit_id:parseInt(keuze)});
      if(!r.ok)return toast(r.json.error||'Op rit zetten mislukt','error');
      if(d.weekend){const wb=await api('POST',`/api/transport-taken/${taakId}/weekend-bevestig`);if(!wb.ok)toast(wb.json.error||'Bevestiging bewaren mislukt','warn');}
      toast(`Taak op rit #${keuze} gezet`,'success');GS.oprit=null;RIT=parseInt(keuze);GS.scherm='detail';return laad();
    }
    if(a==='maak'){
      const f=$('gnf'),vid=parseInt(f.voertuig.value)||null,pid=parseInt(f.personeel_id.value)||null,datum=f.datum.value;
      if(!datum)return toast('Kies een datum','warn');
      const wk=[0,6].includes(d0(datum).getDay());
      if(wk&&!await vraag({titel:'Rit in het weekend?',tekst:'Weekendritten zijn een uitzondering, geen verbod. Toch inplannen?',ok:'Ja, inplannen'}))return;
      const taakIds=(GS.nieuw&&GS.nieuw.taak_ids)||[];
      const body={datum,vertrek:f.vertrek.value,einde:f.einde&&f.einde.value||undefined,personeel_id:pid,taak_ids:taakIds,aanhangwagen_id:f.aanhang&&f.aanhang.value?+f.aanhang.value:null};
      if(vid)body.voertuig_id=vid;else{body.voertuig=f.vnaam.value.trim()||'Eigen wagen';body.voertuig_soort='eigen';body.voertuig_capaciteit=parseInt(f.cap.value)||null;}
      const r=await api('POST','/api/ritten',body);if(!r.ok)return toast(r.json.error||'Rit maken mislukt','error');
      if(wk)for(const tid of taakIds){const wb=await api('POST',`/api/transport-taken/${tid}/weekend-bevestig`);if(!wb.ok)toast(wb.json.error||'Bevestiging bewaren mislukt','warn');}
      toast(`Rit #${r.json.id} gemaakt`,'success');GS.nieuw=null;RIT=r.json.id;GS.scherm='detail';
      if(datum<P.week.start||datum>P.week.eind)WEEK=datum;DAG=datum;return laad();
    }
    if(!RIT)return;
    if(a==='wissel'){const r=await api('POST',`/api/ritten/${RIT}/taken/${g.dataset.taak}/wissel`,{richting:g.dataset.r});if(!r.ok)return toast(r.json.error||'Wisselen mislukt','error');return laad();}
    if(a==='uit'){const r=await api('POST',`/api/ritten/${RIT}/taken/${g.dataset.taak}/ontkoppel`);if(!r.ok)return toast(r.json.error||'Van de rit halen mislukt','error');toast('Taak van de rit gehaald — staat weer bij "open"','success');return laad();}
    if(a==='kopieer')return kopieer();
    if(a==='link'){const r=await api('POST',`/api/ritten/${RIT}/token`);if(!r.ok)return toast(r.json.error||'Rit-link maken mislukt','error');
      const url=location.origin+r.json.url;LINK={rit:RIT,url};tekenGsm();await kopieer();return;}
    if(a==='klaar-terug'){const r=await api('POST',`/api/ritten/${RIT}/klaarzet-terug`,{});if(!r.ok)return toast(r.json.error||'Terugzetten mislukt','error');toast('Rit staat niet meer klaar','success');return laad();}
    if(a==='klaar'){const r=await api('POST',`/api/ritten/${RIT}/klaarzet`,{});if(!r.ok)return toast(r.json.error||'Klaarzetten mislukt','error');toast('Rit klaargezet door '+r.json.klaarzet_door,'success');return laad();}
  });

  async function kop(){
    const v=await api('GET','/api/vandaag');
    if(v.ok){const tel=(id,n)=>{const b=$(id);b.textContent=n;b.hidden=!n;};tel('b-vandaag',v.json.beslissen.length);tel('b-transport',v.json.inplannen.length);
      $('per-naam').textContent=v.json.periode?v.json.periode.naam:'geen periode';$('wie').textContent=v.json.gebruiker.naam+' · kantoor';}
    const p=await api('GET','/api/periodes');if(!p.ok)return;
    const sel=$('per-kies');sel.innerHTML=p.json.map(x=>`<option value="${x.id}"${x.actief?' selected':''}>${esc(x.naam)}</option>`).join('');
    sel.onchange=async()=>{const a=await api('POST','/api/periodes/'+sel.value+'/activeer');if(!a.ok)return toast(a.json.error||'Periode wisselen mislukt','error');location.reload();};
  }

  // ?taak=ID of ?rit=ID: open de juiste week en dag, selecteer de rit (of de lijst nog te plannen).
  (async()=>{
    const ritQ=parseInt(Q.get('rit')),taakQ=parseInt(Q.get('taak'));
    if(ritQ){const g=await api('GET','/api/ritten/'+ritQ);if(g.ok&&g.json.datum){WEEK=g.json.datum;DAG=g.json.datum;RIT=ritQ;GS.scherm='detail';}}
    else if(taakQ){const g=await api('GET','/api/transport-taken');const t=g.ok?g.json.find(x=>x.id===taakQ):null;
      if(t&&t.datum){WEEK=t.datum;DAG=t.datum;if(t.rit_id)RIT=t.rit_id;else MODUS='open';}}
    else if(!Q.get('week')){
      // TF6 N1: staat er deze week niets te plannen, open dan op de eerste week met taken zonder rit (net gegenereerd werk).
      await laad();
      if(P&&P.dagen.every(d=>!d.open.length&&!d.ritten.length)){
        const g=await api('GET','/api/transport-taken');
        const vandaag=iso(new Date()),open=g.ok?g.json.filter(x=>!x.rit_id&&x.datum&&x.status==='gepland').map(x=>x.datum).sort():[];
        const eerste=open.find(d=>d>=vandaag)||open[0];
        if(eerste){WEEK=eerste;DAG=null;}
      }
    }
    await laad();kop();
  })();
})();
