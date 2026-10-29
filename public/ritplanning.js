// public/ritplanning.js — RP1: kantoor-ritplanning (design/RITPLANNING-DEFINITIEF.html).
// Weekagenda (tijdas 07–17, banen bij gelijktijdige ritten, dagkolommen groeien mee) + lade met dag-inzoom
// per bestuurder en het ritdetail. Alles uit GET /api/ritplanning; na elke actie de week opnieuw laden.
'use strict';
(function(){
  const TOKEN=localStorage.getItem('sporty-auth-token');
  if(!TOKEN){location.href='/';return;}
  const $=id=>document.getElementById(id);
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const MAAND=['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
  const DAGLANG=['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'];
  const d0=s=>new Date(s+'T12:00:00');
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const min=s=>{const m=/^(\d{1,2}):(\d{2})$/.exec(s||'');return m?(+m[1])*60+(+m[2]):null;};
  const pct=m=>Math.max(0,Math.min(100,(m-420)/600*100)); // 07:00 → 0 %, 17:00 → 100 %
  const f2=n=>n.toFixed(2);

  // Zelfde toast-stijl als index.html (showToast).
  function toast(msg,type){
    const t=document.createElement('div');
    t.style.background={info:'#378ADD',error:'#E24B4A',success:'#1D9E75',warn:'#EF9F27'}[type||'info'];
    t.textContent=msg;t.onclick=()=>t.remove();$('toasts').appendChild(t);
    setTimeout(()=>{t.style.transition='opacity .3s';t.style.opacity='0';setTimeout(()=>t.remove(),300);},type==='error'?5000:3000);
  }
  async function api(methode,url,body){
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
  let WEEK=Q.get('week')||iso(new Date()), P=null, DAG=null, RIT=null, MODUS='rit', NIEUW={}, LADE=true;

  async function laad(){
    const r=await api('GET','/api/ritplanning?week='+WEEK);
    if(r.status===401||r.status===403){location.href='/';return;}
    if(!r.ok){toast(r.json.error||'Ritplanning laden mislukt','error');return;}
    P=r.json;
    if(!DAG||!P.dagen.some(d=>d.datum===DAG))DAG=(P.dagen.find(d=>d.ritten.length)||P.dagen[0]).datum;
    if(RIT&&!alleRitten().some(x=>x.id===RIT))RIT=null;
    teken();
  }
  const alleRitten=()=>P.dagen.flatMap(d=>d.ritten);
  const dagVan=datum=>P.dagen.find(d=>d.datum===datum);
  const ritVan=id=>alleRitten().find(r=>r.id===id);
  const coord=r=>r.bestuurder.rol!=='chauffeur';
  const echteW=r=>r.waarschuwingen.filter(w=>!/^weekend/.test(w));
  const bez=r=>`${r.bezetting}${r.voertuig.capaciteit?'/'+r.voertuig.capaciteit:''}`;

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
    $('leg').innerHTML=P.personen.map(p=>`<i style="background:${p.kleur}"></i>${esc(p.naam)}${p.bestuurder_rol!=='chauffeur'?' <em>coörd.</em>':''}`).join('');
    const per=P.dagen.map(d=>({d,...banen(d.ritten)}));
    const flex=x=>x.d.weekend&&!x.d.ritten.length?0.55:x.n;
    $('dagkop').innerHTML='<div class="tk"></div>'+per.map(x=>`<div class="${x.d.weekend?'wk':''} ${x.d.datum===DAG?'act':''}" style="flex:${flex(x)}" data-dag="${x.d.datum}">${esc(x.d.dag)}${x.d.weekend?'<i>weekend</i>':''}${x.d.ritten.length?`<span class="pil">${x.d.ritten.length} ritten</span>`:''}${x.d.open.length?`<span class="pil oranje" data-open="${x.d.datum}">${x.d.open.length} open</span>`:''}</div>`).join('');
    const uren=['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];
    $('raster').innerHTML=`<div class="tk">${uren.map(u=>`<span>${u}</span>`).join('')}</div>`+per.map(x=>{
      const blokken=x.lijst.map(({r,a,b,baan})=>{
        const k=r.bestuurder.kleur,wv=echteW(r).length;
        return `<div class="be ${r.status} ${wv?'w':''} ${r.id===RIT?'sel':''}" data-rit="${r.id}" style="top:${f2(pct(a))}%;height:calc(${f2(pct(b))}% - ${f2(pct(a))}%);left:calc(${f2(baan/x.n*100)}% + 2px);width:calc(${f2(100/x.n)}% - 4px);border-color:${k}"><b style="color:${k}">${esc(r.bestuurder.naam||'geen bestuurder')}${coord(r)?' ·c':''} #${r.id}${wv?' ⚠':''}</b><span class="vt">${esc(r.voertuig.naam||'geen voertuig')} ${bez(r)}</span>${r.stops.map(s=>`<span class="${s.slot}">${esc(s.tijd)} ${s.slot==='vrij'?'◌':'🔒'} ${esc(s.locatie)}</span>`).join('')}</div>`;
      }).join('');
      return `<div class="kolom ${x.d.weekend?'wk':''} ${x.d.datum===DAG?'act':''}" style="flex:${flex(x)}" data-dag="${x.d.datum}">${'<i></i>'.repeat(11)}${blokken}${x.d.ritten.length?'':`<button class="knop licht klein plus" data-plus="${x.d.datum}">+ rit</button>`}</div>`;
    }).join('');
    $('lade').style.display=LADE?'':'none';
    tekenLade();
  }

  function tekenLade(){
    const d=dagVan(DAG),dt=d0(DAG);
    const dagNaam=`${DAGLANG[dt.getDay()]} ${dt.getDate()} ${MAAND[dt.getMonth()]}`;
    $('lade-titel').textContent=`${dagNaam[0].toUpperCase()+dagNaam.slice(1)} · ${d.ritten.length} ritten`;
    // Dag-inzoom: rij per bestuurder van die dag, vaste chauffeurs zonder rit als lege rij, "+ iemand anders".
    const rijen=[];
    d.ritten.forEach(r=>{const key=r.bestuurder.personeel_id?'p'+r.bestuurder.personeel_id:'n'+r.bestuurder.naam;
      let rij=rijen.find(x=>x.key===key);if(!rij)rijen.push(rij={key,b:r.bestuurder,ritten:[]});rij.ritten.push(r);});
    P.personen.filter(p=>p.vast&&!rijen.some(x=>x.key==='p'+p.personeel_id)).forEach(p=>rijen.push({key:'p'+p.personeel_id,b:{...p,rol:'chauffeur'},ritten:[],leeg:true}));
    const uren=['07','08','09','10','11','12','13','14','15','16','17'];
    $('inzoom').innerHTML=`<div class="uren"><span class="wie">${esc(dagNaam)}</span>${uren.map(u=>`<span>${u}</span>`).join('')}</div>`+rijen.map(x=>
      `<div class="rij"><div class="wie"><b style="color:${x.b.kleur}">${esc(x.b.naam||'geen bestuurder')}</b><span>${x.b.rol==='chauffeur'?'chauffeur':x.b.rol==='kantoor'?'kantoor':'coördinator'}</span></div><div class="spoor">${'<i></i>'.repeat(11)}${
        x.leeg?`<button class="knop licht klein leeg" data-plus="${DAG}" data-pid="${x.b.personeel_id}">+ rit</button>`:x.ritten.map(r=>{
          const a=min(r.vertrek)??480,b=Math.max(min(r.einde)??a,a+30),wv=echteW(r).length;
          return `<div class="blok ${wv?'w':''} ${r.id===RIT?'sel':''}" data-rit="${r.id}" style="left:${f2(pct(a))}%;width:calc(${f2(pct(b))}% - ${f2(pct(a))}%);border-color:${r.bestuurder.kleur}"><b>#${r.id} ${esc(r.voertuig.naam||'geen voertuig')} ${bez(r)}${wv?' ⚠':''}</b></div>`;}).join('')}</div></div>`).join('')
      +`<div class="rij ander"><div class="wie"><b data-plus="${DAG}" data-ander="1" style="cursor:pointer">+ iemand anders</b><span>coördinator / kantoor</span></div><div class="spoor leegspoor"><span>Kies een medewerker; de rit krijgt het label "coördinator rijdt mee". Voertuig: pool of eigen/huurwagen met capaciteit.</span></div></div>`;
    tekenDetail();
  }

  function tekenDetail(){
    const el=$('detail'),d=dagVan(DAG);
    if(MODUS==='nieuw')return tekenNieuw(el);
    if(MODUS==='open'||!RIT||!ritVan(RIT)){
      el.innerHTML=`<div class="ritkop"><div><b>Nog te plannen · ${esc(d.dag)}</b><span>${d.open.length} taken zonder rit</span></div><div class="acties"><button class="knop klein" data-plus="${DAG}">+ rit</button></div></div><div class="scroll">${
        d.open.length?d.open.map(o=>`<div class="open ${o.soort==='rest'||o.soort==='weekend'?'oranje':''}"><div class="nm">${esc(o.naam)}<b>${esc([o.route,o.stuks?o.stuks+(o.stuks===1?' stuk':' stuks'):null,o.tijd].filter(Boolean).join(' · '))}</b></div><span class="pil ${o.soort==='weekend'||o.soort==='rest'?'oranje':''}">${esc(o.soort)}</span><button class="knop klein" data-aanrit="${o.taak_id}">→ aan rit</button></div>`).join('')
        :'<div class="leegtxt">Niets meer te plannen op deze dag</div>'}</div>`;
      return;
    }
    const r=ritVan(RIT),dt=d0(DAG),wv=echteW(r);
    const over=r.voertuig.capaciteit&&r.bezetting>r.voertuig.capaciteit;
    el.innerHTML=`<div class="ritkop"><div><b>Rit #${r.id} · ${esc(d.dag.split(' ')[0])} ${dt.getDate()} ${MAAND[dt.getMonth()].slice(0,3)} · ${esc(r.vertrek||'?')}–${esc(r.einde||'?')}</b><span>${esc(r.bestuurder.naam||'geen bestuurder')}${coord(r)?' (coördinator rijdt mee)':''} · ${esc(r.voertuig.naam||'geen voertuig')} · <i class="${over&&r.status!=='gedaan'?'over':''}">${bez(r)} bakken</i>${r.notitie?' · '+esc(r.notitie):''}</span></div>${
      wv.length?`<div class="waarsch">⚠ ${esc(wv.join(' · '))}</div>`:r.waarschuwingen.includes('weekend')?(()=>{const b=r.waarschuwingen.find(w=>/^weekend · /.test(w));return '<div class="waarsch">'+(b&&/bevestigd door/.test(b)?'✓ '+esc(b):'⚠ '+esc(b||'weekend: uitzondering'))+'</div>';})():''}<div class="acties"><button class="knop licht klein" data-act="splits">Splitsen</button><button class="knop licht klein" data-act="link">Rit-link</button><button class="knop klein" data-act="klaar">${r.klaarzet_status==='klaar'?'Klaargezet ✓':'Klaarzetten'}</button></div></div><div class="scroll">${
      r.stops.length?r.stops.map((s,i)=>`<div class="stop ${s.slot}"><div class="t">${esc(s.tijd)}</div><div class="nm">${esc(s.locatie)}<b>${esc(s.wat)}${s.status!=='gepland'?' · '+esc(s.status):''}</b></div><span class="pil ${s.slot==='vrij'?'oranje':''}" data-slot="${s.taak_id}" title="Tik om te wisselen tussen vast en vrij">${s.slot==='vrij'?'vrij':'🔒 vast'}</span><div class="pijl"><button data-wissel="${s.taak_id}" data-r="omhoog" ${i===0?'disabled':''}>▲</button><button data-wissel="${s.taak_id}" data-r="omlaag" ${i===r.stops.length-1?'disabled':''}>▼</button></div><button class="knop licht klein" data-uit="${s.taak_id}">✕</button></div>`).join('')
      :'<div class="leegtxt">Nog geen stops — zet een taak op deze rit via "N open" in de dagkop</div>'}</div>`;
  }

  function opties(){
    const vast=P.personen.filter(p=>p.vast);
    return `<optgroup label="Vaste chauffeurs">${vast.map(p=>`<option value="${p.personeel_id}">${esc(p.naam)}</option>`).join('')}</optgroup><optgroup label="Iemand anders… (coördinator rijdt mee)">${
      P.alle_personeel.filter(p=>!vast.some(v=>v.personeel_id===p.personeel_id)).map(p=>`<option value="${p.personeel_id}">${esc(p.naam)} (${esc(p.rol)})</option>`).join('')}</optgroup>`;
  }
  function tekenNieuw(el){
    el.innerHTML=`<div class="ritkop"><div><b>Nieuwe rit</b><span>${NIEUW.taak_ids?'met taak #'+NIEUW.taak_ids.join(', #'):'bestuurder = elke medewerker · voertuig pool, eigen of huur'}</span></div></div><div class="scroll"><form class="form" id="nf" onsubmit="return false">
      <label>Datum<input type="date" name="datum" value="${esc(NIEUW.datum||DAG)}"></label>
      <label>Vertrek<input type="time" name="vertrek" value="${esc(NIEUW.vertrek||'08:00')}"></label>
      <label>Bestuurder<select name="personeel_id">${opties()}</select></label>
      <label>Voertuig<select name="voertuig">${P.voertuigen.map((v,i)=>`<option value="${i}">${esc(v.naam)}${v.capaciteit?' ('+v.capaciteit+' bakken)':''}</option>`).join('')}</select></label>
      <label id="nf-cap" style="display:none">Capaciteit (bakken)<input type="number" min="1" name="cap" value="6"></label>
      <div class="knoppen"><button class="knop licht klein" data-act="annuleer">Annuleren</button><button class="knop klein" data-act="maak">Rit maken</button></div></form></div>`;
    const f=$('nf');
    if(NIEUW.personeel_id)f.personeel_id.value=NIEUW.personeel_id;
    else if(NIEUW.ander)f.personeel_id.value=(P.alle_personeel.find(p=>!P.personen.some(v=>v.vast&&v.personeel_id===p.personeel_id))||{}).personeel_id||'';
    const capZicht=()=>{$('nf-cap').style.display=P.voertuigen[f.voertuig.value].soort==='pool'?'none':'';};
    f.voertuig.onchange=capZicht;capZicht();
  }
  async function maakRit(){
    const f=$('nf'),v=P.voertuigen[f.voertuig.value],pid=parseInt(f.personeel_id.value)||null;
    const datum=f.datum.value;
    if(!datum)return toast('Kies een datum','warn');
    if([0,6].includes(d0(datum).getDay())){
      if(!await vraag({titel:'Rit in het weekend?',tekst:'Weekendritten zijn een uitzondering, geen verbod. Toch inplannen?',ok:'Ja, inplannen'}))return;
    }
    const body={datum,vertrek:f.vertrek.value,personeel_id:pid,voertuig:v.naam,voertuig_soort:v.soort,taak_ids:NIEUW.taak_ids||[]};
    if(v.soort!=='pool')body.voertuig_capaciteit=parseInt(f.cap.value)||null;
    const r=await api('POST','/api/ritten',body);
    if(!r.ok)return toast(r.json.error||'Rit maken mislukt','error');
    if([0,6].includes(d0(datum).getDay()))for(const tid of (NIEUW.taak_ids||[])){const wb=await api('POST',`/api/transport-taken/${tid}/weekend-bevestig`);if(!wb.ok)toast(wb.json.error||'Bevestiging bewaren mislukt','warn');}
    toast(`Rit #${r.json.id} gemaakt`,'success');
    MODUS='rit';RIT=r.json.id;NIEUW={};
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
    toast(`Taak op rit #${keuze.rit} gezet`,'success');RIT=parseInt(keuze.rit);MODUS='rit';laad();
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
      if(a==='link'){const r=await api('POST',`/api/ritten/${RIT}/token`);if(!r.ok)return toast(r.json.error||'Rit-link maken mislukt','error');
        const url=location.origin+r.json.url;try{await navigator.clipboard.writeText(url);toast('Rit-link gekopieerd: '+url,'success');}catch(x){toast('Rit-link: '+url,'info');}return;}
      if(a==='klaar'){const rt=ritVan(RIT),over=rt.voertuig.capaciteit&&rt.bezetting>rt.voertuig.capaciteit;
        if(over&&!await vraag({titel:'Rit boven capaciteit klaarzetten?',tekst:`${rt.bezetting} bakken op ${rt.voertuig.capaciteit} plaatsen. Dat mag (geen verbod), maar het wordt gelogd. Toch klaarzetten?`,ok:'Ja, klaarzetten'}))return;
        const r=await api('POST',`/api/ritten/${RIT}/klaarzet`,over?{bevestigd_over_capaciteit:true}:{});if(!r.ok)return toast(r.json.error||'Klaarzetten mislukt','error');toast('Rit klaargezet door '+r.json.klaarzet_door,'success');return laad();}
    }
  });
  $('wk-vorig').onclick=()=>{const d=d0(P.week.start);d.setDate(d.getDate()-7);WEEK=iso(d);DAG=null;RIT=null;laad();};
  $('wk-volg').onclick=()=>{const d=d0(P.week.start);d.setDate(d.getDate()+7);WEEK=iso(d);DAG=null;RIT=null;laad();};
  $('lade-sluit').onclick=()=>{LADE=false;teken();};
  $('dag-open').onclick=()=>{MODUS='open';RIT=null;tekenDetail();};

  // Bovenbalk: tellers zoals op Vandaag, periode-kiezer zoals de bestaande (activeer + herladen).
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
    if(ritQ){const g=await api('GET','/api/ritten/'+ritQ);if(g.ok&&g.json.datum){WEEK=g.json.datum;DAG=g.json.datum;RIT=ritQ;}}
    else if(taakQ){const g=await api('GET','/api/transport-taken');const t=g.ok?g.json.find(x=>x.id===taakQ):null;
      if(t&&t.datum){WEEK=t.datum;DAG=t.datum;if(t.rit_id)RIT=t.rit_id;else MODUS='open';}}
    await laad();kop();
  })();
})();
