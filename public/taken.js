// public/taken.js — TR1: Transport › Taken (design/mockup-transport-taken.html) op het kantoorpatroon.
// Lijst uit GET /api/taken-overzicht, detail uit GET /api/taken/:id/detail; acties via de bestaande routes.
// Na elke actie opnieuw laden; fouten als toast. Alleen weergave: de gsm-laag gebruikt later dezelfde API.
'use strict';
(function(){
  function kvL(n){return /^KV\s/i.test(n)?n:'KV '+n;}
  const TOKEN=localStorage.getItem('sporty-auth-token');
  if(!TOKEN){location.href='/';return;}
  const $=id=>document.getElementById(id);
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function toast(msg,type){
    const t=document.createElement('div');
    t.style.background={info:'#378ADD',error:'#E24B4A',success:'#1D9E75',warn:'#EF9F27'}[type||'info'];
    t.textContent=msg;t.onclick=()=>t.remove();$('toasts').appendChild(t);
    setTimeout(()=>{t.style.transition='opacity .3s';t.style.opacity='0';setTimeout(()=>t.remove(),300);},type==='error'?5000:3000);
  }
  async function api(methode,url,body){
    return window.sportyApi(methode,url,body,{toast:m=>toast(m,'info'),token:TOKEN});
  }
  // vraagModal (zelfde gedrag als index.html): null bij annuleren, anders wat lees() teruggeeft.
  function vraag({titel,tekst,html,ok='Bevestigen',lees}){
    return new Promise(resolve=>{
      const bg=document.createElement('div');bg.className='mbg';
      bg.innerHTML=`<div class="mbox" role="dialog" aria-modal="true"><h4>${esc(titel)}</h4>${tekst?`<p>${esc(tekst)}</p>`:''}<form class="form" onsubmit="return false">${html||''}<div class="knoppen"><button type="button" class="knop licht" data-x="0">Annuleren</button><button type="button" class="knop" data-x="1">${esc(ok)}</button></div></form></div>`;
      const sluit=v=>{document.removeEventListener('keydown',toets,true);bg.remove();resolve(v);};
      const toets=e=>{if(e.key==='Escape'){e.preventDefault();sluit(null);}};
      document.addEventListener('keydown',toets,true);
      bg.addEventListener('mousedown',e=>{if(e.target===bg)sluit(null);});
      bg.querySelector('[data-x="0"]').onclick=()=>sluit(null);
      bg.querySelector('[data-x="1"]').onclick=()=>{const v=lees?lees(bg.querySelector('form')):{};if(v)sluit(v);};
      document.body.appendChild(bg);(bg.querySelector('select,input')||bg.querySelector('[data-x="1"]')).focus();
    });
  }

  const Q=new URLSearchParams(location.search);
  let O=null,D=null,SEL=new Set(),FILTER='deze_week',ZOEK='',TAB='regels',LOCS=null;
  const FILTERS={deze_week:()=>true,zonder_rit:t=>!t.rit&&t.status!=='gedaan',levering:t=>t.type==='levering',ophaling:t=>t.type==='ophaling',
    rest:t=>t.soort==='rest',weekend:t=>t.pil==='weekend',gedaan:t=>t.status==='gedaan'};
  const zichtbaar=()=>O.taken.filter(FILTERS[FILTER]).filter(t=>!ZOEK||t.zoek.includes(ZOEK));
  // Historiek-tijdstip: ISO (wijzigingen) of nl-BE-tekst (activiteitenlog) → 'wo 28 okt 15:10'.
  const tijdTekst=s=>{const d=/^\d{4}-\d{2}-\d{2}T/.test(s||'')?new Date(s):null;if(!d||isNaN(d))return s||'';
    return d.toLocaleDateString('nl-BE',{weekday:'short',day:'numeric',month:'short'}).replace(/\./g,'')+' '+d.toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'});};
  const pilKlas={rest:'oranje',vrij:'oranje',weekend:'rood'};

  async function laad(){
    const r=await api('GET','/api/taken-overzicht'+(Q.get('week')?'?week='+Q.get('week'):'')+(Q.get('alle')?(Q.get('week')?'&':'?')+'alle=1':''));
    if(r.status===401||r.status===403){location.href='/';return;}
    if(!r.ok)return toast(r.json.error||'Taken laden mislukt','error');
    O=r.json;
    SEL=new Set([...SEL].filter(id=>O.taken.some(t=>t.id===id)));
    tekenLijst();
    if(D)await laadDetail(D.taak.id);
  }
  const iso0=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
  function status(t){
    if(t.status==='gedaan')return '<span class="pil groen">gedaan</span>';
    if(t.rit&&t.rit.status==='onderweg')return '<span class="pil blauw">onderweg</span>';
    return `<span class="pil">${esc(t.status)}</span>`;
  }
  function tekenLijst(){
    document.querySelectorAll('.chip').forEach(c=>{c.classList.toggle('act',c.dataset.f===FILTER);c.querySelector('b').textContent=O.tellers[c.dataset.f];});
    const lijst=zichtbaar();
    $('lijst').innerHTML=lijst.length?lijst.map(t=>`<div class="r ${D&&D.taak.id===t.id?'act':''}" data-id="${t.id}"><span><input type="checkbox" data-sel="${t.id}" ${SEL.has(t.id)?'checked':''} aria-label="Selecteer taak #${t.id}"></span><span><b>#${t.id}</b> ${esc(t.soort)}${t.pil?` <span class="pil ${pilKlas[t.pil]}">${t.pil}</span>`:''}</span><span>${esc(t.wanneer_tekst)}</span><span>${esc(t.route)}</span><span>${esc(t.wat)}</span><span>${t.rit?`rit #${t.rit.id} · ${esc(t.rit.chauffeur||'geen chauffeur')}`:'— zonder rit'}</span><span>${status(t)}</span></div>`).join('')
      :'<div class="leeg">Geen taken voor deze filter</div>';
    $('n-taken').textContent=`${lijst.length} taken`;
    // TF6 N1: duidelijk welke periode je ziet, met een knop om te wisselen tussen "Alles" en "Deze week".
    const bk=O.bereik||{},dtxt=s=>s?new Date(s+'T12:00:00').toLocaleDateString('nl-BE',{day:'numeric',month:'short'}).replace(/\./g,''):'';
    let zicht=$('taken-zicht');
    if(!zicht){zicht=document.createElement('div');zicht.id='taken-zicht';zicht.style.cssText='display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:6px 12px;font-size:13px;color:#475569';const l=$('lijst');l.parentNode.insertBefore(zicht,l);}
    zicht.innerHTML=bk.alle?`<span>Je ziet <b>alle taken</b>${bk.van?' · '+esc(dtxt(bk.van))+' – '+esc(dtxt(bk.tot)):''}</span><a href="/taken?week=${esc(iso0())}" class="knop licht klein" id="zicht-wissel">Alleen deze week</a>`:`<span>Je ziet <b>week ${esc(dtxt(O.week.start))} – ${esc(dtxt(O.week.eind))}</b></span><a href="/taken?alle=1" class="knop licht klein" id="zicht-wissel">Alles tonen</a>`;
    const wk=document.querySelector('.chip[data-f="deze_week"]');if(wk&&wk.firstChild)wk.firstChild.textContent=bk.alle?'Alle taken ':'Deze week ';
    $('n-sel').textContent=`${SEL.size} geselecteerd`;
    $('voet').classList.toggle('sel',SEL.size>0);
    $('b-bundel').disabled=SEL.size<2; // TB1
    $('alles').checked=lijst.length>0&&lijst.every(t=>SEL.has(t.id));
  }

  async function laadDetail(id){
    const r=await api('GET',`/api/taken/${id}/detail`);
    if(!r.ok){D=null;$('detail').innerHTML='<div class="leegd">Klik een taak in de lijst voor het detail.</div>';return toast(r.json.error||'Detail laden mislukt','error');}
    D=r.json;tekenDetail();
    document.querySelectorAll('.r').forEach(x=>x.classList.toggle('act',+x.dataset.id===id));
  }
  function tekenDetail(){
    const {taak:t,regels,rit,checks,kampmoment:km,gekoppeld:g,historiek}=D;
    const loc=t.route.split(' → ')[t.type==='ophaling'?0:1];
    const sub=[t.wanneer_tekst.replace(/ \d\d:\d\d$/,''),t.tijd&&t.rit?t.tijd:null,t.route+(km&&km.thema?` (${km.thema})`:''),km&&km.kv_naam?kvL(km.kv_naam):null,
      rit?`rit #${rit.id} (${rit.chauffeur||'geen chauffeur'}${rit.voertuig?', '+rit.voertuig:''})`:'zonder rit',rit?`stop ${rit.stop_nr} van ${rit.stops.length}`:null].filter(Boolean).map(esc).join(' · ')
      +(t.pil?` · <span class="pil ${pilKlas[t.pil]}">${t.pil}</span>`:'');
    const blokRegels=`<div class="blok"><h4>Regels (wat mee moet)</h4>${regels.map(r=>`<div class="rij"><div class="nm"><b style="display:inline;color:#334155">${esc(r.code)}</b> ${esc(r.naam)}<b>${r.qty} ×</b></div><button class="knop licht klein" data-regelweg="${r.id}" aria-label="Regel verwijderen">✕</button></div>`).join('')||'<div class="rij"><div class="nm">Nog geen regels</div></div>'}<button class="knop licht klein" style="margin-top:6px" id="regel-plus">+ Regel</button></div>`;
    const kv=(k,v)=>`<div class="kv"><span>${k}</span><b>${v}</b></div>`;
    const ritDeel=`<h4>Op de rit · checks</h4>`+(rit?kv('Rit',esc(`#${rit.id} · ${rit.datum?new Date(rit.datum+'T12:00:00').toLocaleDateString('nl-BE',{weekday:'short',day:'numeric',month:'short'}).replace('.',''):''} ${rit.vertrek} · ${rit.chauffeur||'geen chauffeur'} · ${rit.voertuig||'geen voertuig'} · ${rit.bezetting}${rit.capaciteit?'/'+rit.capaciteit:''} bakken`)+(rit.waarschuwingen.filter(w=>w!=='weekend').length?' ⚠':''))
        +kv('Slot',t.slot==='vrij'?'vrij (chauffeur mag wisselen) · <button class="knop licht klein" id="slot">🔒 Zet vast</button>':'vast (kantoor) · <button class="knop licht klein" id="slot">Zet vrij</button>')
        +kv('Checks',`${checks.geladen} van ${checks.totaal} geladen · ${checks.gelost} gelost · ${checks.klaargezet?'klaargezet':'nog niet klaargezet'}`)
        +kv('Stops rit',rit.stops.map(s=>(s.is_deze?`<u>${esc(s.naam)}</u>`:esc(s.naam))+(s.slot==='vast'?' 🔒':'')).join(' → '))
      :kv('Rit','— zonder rit · <button class="knop licht klein" id="op-rit">Op een rit zetten</button>'));
    const kmDeel=`<h4 style="margin-top:14px">Kampmoment</h4>`+(km?kv('Locatie',esc([km.locatie,km.thema,'week '+km.week,km.kv_naam?kvL(km.kv_naam):null].filter(Boolean).join(' · ')))
        +kv('Contact',esc([km.contact_naam?km.contact_naam+(km.contact_telefoon?' '+km.contact_telefoon:''):null,km.kv_naam&&km.kv_telefoon?'KV '+km.kv_telefoon:null,km.sleutel_info?'sleutel: '+km.sleutel_info:null].filter(Boolean).join(' · ')||'—'))
        +(g?kv(g.ophaling_taak_id?'Ophaling':'Levering',`<a href="/taken?taak=${g.ophaling_taak_id||g.levering_taak_id}">${esc(g.tekst)}</a>`):'')
      :kv('Locatie','geen kampmoment gekoppeld'));
    const histDeel=`<h4 style="margin-top:14px">Historiek (alles gelogd, omkeerbaar)</h4>`+(historiek.map(h=>`<div class="rij"><div class="nm">${esc(h.wat)}<b>${esc([tijdTekst(h.t),h.wie].filter(Boolean).join(' · '))}</b></div><button class="knop licht klein" disabled title="Terugdraaien bestaat nog niet als route (GEVONDEN in OVERLEG-c.md)">↶ Terug</button></div>`).join('')||'<div class="rij"><div class="nm">Nog niets gelogd</div></div>');
    const grid=TAB==='regels'?blokRegels+`<div class="blok">${ritDeel}${kmDeel}${histDeel}</div>`
      :TAB==='checks'?`<div class="blok">${ritDeel}</div>`:TAB==='kampmoment'?`<div class="blok">${kmDeel.replace(' style="margin-top:14px"','')}</div>`:`<div class="blok">${histDeel.replace(' style="margin-top:14px"','')}</div>`;
    $('detail').innerHTML=`<div class="dkop"><div><h2>Taak #${t.id} · ${esc(t.type)} · ${esc(loc)}</h2><span>${sub}</span></div><div class="acts"><button class="knop licht" id="d-bewerk">Bewerken</button><button class="knop licht" id="d-weg">Verwijderen</button><button class="knop licht" id="d-splits">Splitsen</button><button class="knop licht" id="d-van" ${rit?'':'disabled'}>Van rit halen</button>${rit?`<button class="knop" id="d-open">Open rit #${rit.id}</button>`:'<button class="knop" id="op-rit2">Op een rit zetten</button>'}</div></div>
      <div class="dtabs">${[['regels',`Regels ${regels.length}`],['checks','Checks'],['kampmoment','Kampmoment'],['historiek',`Historiek ${historiek.length}`]].map(([k,l])=>`<a class="${TAB===k?'act':''}" data-tab="${k}">${l}</a>`).join('')}</div>
      <div class="dgrid">${grid}</div>`;
  }

  // ── taak-formulier (Bewerken / + Nieuwe taak): velden van de mockup/bewerkmodal ──
  async function taakForm(titel,t,ok){
    if(!LOCS){const r=await api('GET','/api/locaties');LOCS=r.ok?r.json:[];}
    const opt=sel=>'<option value="">—</option>'+LOCS.map(l=>`<option value="${l.id}" ${String(l.id)===String(sel)?'selected':''}>${esc(l.name)}</option>`).join('');
    return vraag({titel,ok,html:`<label>Type<select name="type">${['levering','ophaling','transfer','extra'].map(x=>`<option ${x===(t.type||'levering')?'selected':''}>${x}</option>`).join('')}</select></label>
      <label>Datum<input type="date" name="datum" value="${esc(t.datum||'')}"></label><label>Tijd<input type="time" name="tijd" value="${esc(t.tijd||'09:00')}"></label>
      <label>Van<select name="van">${opt(t.van_locatie_id)}</select></label><label>Naar<select name="naar">${opt(t.naar_locatie_id)}</select></label>
      <label>Opmerking<input name="opmerking" value="${esc(t.opmerking||'')}"></label>`,
      lees:f=>{if(!f.van.value&&!f.naar.value){toast('Kies minstens een van- of naar-locatie','warn');return null;}
        return {type:f.type.value,datum:f.datum.value,tijd:f.tijd.value||'09:00',van_locatie_id:+f.van.value||null,naar_locatie_id:+f.naar.value||null,opmerking:f.opmerking.value};}});
  }
  const volleTaak=d=>({type:d.taak.type,datum:d.taak.datum,tijd:d.taak.tijd,van_locatie_id:d.taak.van_locatie_id,naar_locatie_id:d.taak.naar_locatie_id,opmerking:d.taak.opmerking,status:d.taak.status});

  async function opRit(ids){
    const eerste=O.taken.find(t=>t.id===ids[0]);
    const datum=eerste&&eerste.datum;
    let ritten=[];
    if(datum){const p=await api('GET','/api/ritplanning?week='+datum);if(p.ok)ritten=(p.json.dagen.find(d=>d.datum===datum)||{ritten:[]}).ritten;}
    const k=await vraag({titel:`${ids.length} taak${ids.length===1?'':'en'} op een rit zetten`,tekst:datum?`Ritten van ${eerste.wanneer_tekst.replace(/ \d\d:\d\d$/,'')}`:'Deze taak heeft nog geen datum.',ok:'Op rit zetten',
      html:`<label>Rit<select name="rit">${ritten.map(r=>`<option value="${r.id}">#${r.id} · ${esc(r.vertrek)} · ${esc(r.bestuurder.naam||'geen bestuurder')} · ${esc(r.voertuig.naam||'')}</option>`).join('')}<option value="nieuw">+ nieuwe rit… (ritplanning)</option></select></label>`,
      lees:f=>({rit:f.rit.value})});
    if(!k)return;
    if(k.rit==='nieuw'){location.href='/ritplanning?taak='+ids[0];return;}
    const r=await api('POST','/api/transport-taken/bulk-move',{ids,rit_id:+k.rit});
    if(!r.ok)return toast(r.json.error||'Op rit zetten mislukt','error');
    toast(`${r.json.count} taak${r.json.count===1?'':'en'} op rit #${k.rit} gezet`,'success');SEL.clear();laad();
  }

  document.addEventListener('click',async e=>{
    const t=e.target;
    if(t.matches('[data-sel]')){const id=+t.dataset.sel;t.checked?SEL.add(id):SEL.delete(id);return tekenLijst();}
    const chip=t.closest('.chip');if(chip){FILTER=chip.dataset.f;return tekenLijst();}
    const rij=t.closest('.r[data-id]');if(rij){TAB=TAB||'regels';return laadDetail(+rij.dataset.id);}
    const tab=t.closest('[data-tab]');if(tab){TAB=tab.dataset.tab;return tekenDetail();}
    const id=D&&D.taak.id;
    if(t.id==='slot'){const r=await api('PUT',`/api/transport-taken/${id}`,{slot:D.taak.slot==='vrij'?'vast':'vrij'});if(!r.ok)return toast(r.json.error||'Slot wijzigen mislukt','error');toast(`Slot: ${r.json.slot}`,'success');return laad();}
    if(t.id==='d-open')return location.href='/ritplanning?rit='+D.rit.id;
    if(t.id==='op-rit'||t.id==='op-rit2')return opRit([id]);
    if(t.id==='d-van'){const r=await api('POST',`/api/ritten/${D.rit.id}/taken/${id}/ontkoppel`);if(!r.ok)return toast(r.json.error||'Van rit halen mislukt','error');toast('Taak van de rit gehaald','success');return laad();}
    if(t.id==='d-weg')return wegHalen([id]);
    if(t.id==='d-bewerk'){const v=await taakForm(`Taak #${id} bewerken`,{...D.taak},'Opslaan');if(!v)return;
      const r=await api('PUT',`/api/transport-taken/${id}`,{...volleTaak(D),...v});if(!r.ok)return toast(r.json.error||'Opslaan mislukt','error');toast('Taak opgeslagen','success');return laad();}
    if(t.id==='d-splits'){
      if(D.regels.length<2)return toast('Splitsen kan pas met minstens twee regels','warn');
      const v=await vraag({titel:`Taak #${id} splitsen`,tekst:'Kies de regels die naar een nieuwe taak verhuizen (bv. de helft een dag later).',ok:'Splitsen',
        html:D.regels.map(r=>`<label class="chk"><input type="checkbox" name="regel" value="${r.id}">${esc(r.naam)} × ${r.qty}</label>`).join('')+`<label>Nieuwe datum<input type="date" name="datum" value="${esc(D.taak.datum)}"></label>`,
        lees:f=>{const ids=[...f.querySelectorAll('[name=regel]:checked')].map(x=>+x.value);if(!ids.length){toast('Kies minstens één regel','warn');return null;}return {ids,datum:f.datum.value};}});
      if(!v)return;const r=await api('POST',`/api/transport-taken/${id}/splits`,{regel_ids:v.ids,datum:v.datum});
      if(!r.ok)return toast(r.json.error||'Splitsen mislukt','error');toast(`${r.json.verplaatst} regel${r.json.verplaatst===1?'':'s'} naar taak #${r.json.nieuwe_taak_id}`,'success');return laad();}
    const rw=t.closest('[data-regelweg]');
    if(rw){const rg=D.regels.find(x=>x.id===+rw.dataset.regelweg);
      if(!await vraag({titel:'Regel verwijderen?',tekst:`${rg.naam} × ${rg.qty} van taak #${id}`,ok:'Verwijderen'}))return;
      const r=await api('DELETE',`/api/transport-regels/${rg.id}`);if(!r.ok)return toast(r.json.error||'Verwijderen mislukt','error');toast('Regel verwijderd','success');return laad();}
    if(t.id==='regel-plus'){
      const v=await vraag({titel:`Regel toevoegen aan taak #${id}`,ok:'Toevoegen',html:`<label>Wat<input name="naam" placeholder="bv. Oven of Bak N12"></label><label>Aantal<input type="number" min="1" name="qty" value="1"></label><label>Soort<select name="soort">${['thema','vast','attribuut','pool','andere'].map(x=>`<option>${x}</option>`).join('')}</select></label>`,
        lees:f=>{if(!f.naam.value.trim()){toast('Vul in wat er mee moet','warn');return null;}return {naam:f.naam.value.trim(),qty:+f.qty.value||1,soort:f.soort.value};}});
      if(!v)return;const r=await api('POST','/api/transport-regels',{taak_id:id,...v});if(!r.ok)return toast(r.json.error||'Toevoegen mislukt','error');toast('Regel toegevoegd','success');return laad();}
  });
  $('alles').onchange=e=>{zichtbaar().forEach(t=>e.target.checked?SEL.add(t.id):SEL.delete(t.id));tekenLijst();};
  $('zoek').oninput=e=>{ZOEK=e.target.value.trim().toLowerCase();tekenLijst();};

  // ── bulk ──
  $('b-rit').onclick=()=>opRit([...SEL]);
  $('b-verplaats').onclick=async()=>{
    const v=await vraag({titel:`${SEL.size} taken verplaatsen`,tekst:'Taken die al op een rit staan, houden de datum van hun rit (verplaats dan de rit in de ritplanning).',ok:'Verplaatsen',
      html:'<label>Nieuwe datum<input type="date" name="datum"></label><label>Tijd<input type="time" name="tijd"></label>',lees:f=>f.datum.value||f.tijd.value?{datum:f.datum.value,tijd:f.tijd.value}:(toast('Kies een datum of tijd','warn'),null)});
    if(!v)return;let n=0;
    for(const id of SEL){const d=await api('GET',`/api/taken/${id}/detail`);if(!d.ok)continue;
      const body={...volleTaak(d.json)};if(v.datum)body.datum=v.datum;if(v.tijd)body.tijd=v.tijd;
      const r=await api('PUT',`/api/transport-taken/${id}`,body);if(r.ok)n++;else toast(`#${id}: ${r.json.error||'mislukt'}`,'error');}
    toast(`${n} taken verplaatst`,'success');SEL.clear();laad();
  };
  $('b-bundel').onclick=async()=>{
    if(SEL.size<2)return;
    if(!await vraag({titel:`${SEL.size} taken bundelen?`,tekst:'De regels komen op één taak (de oudste, of die op een rit staat); de andere taken worden geannuleerd met een verwijzing. Splitsen is de weg terug.',ok:'Bundelen'}))return;
    const r=await api('POST','/api/transport-taken/bundel',{taak_ids:[...SEL]});
    if(!r.ok)return toast(r.json.error||'Bundelen mislukt','error');
    toast(`${SEL.size} taken gebundeld in #${r.json.taak.id} (${r.json.taak.regels.length} regels)`,'success');SEL.clear();await laad();laadDetail(r.json.taak.id);
  };
  // TF8 G5: bij taken uit een goedgekeurde aanvraag vraagt het scherm wat er met het stuk op de aanvullijst gebeurt.
  async function wegHalen(ids){
    const aanv=ids.map(id=>O.taken.find(x=>x.id===id)||(D&&D.taak.id===id?D.taak:null)).filter(t=>t&&t.aanvraag_id).map(t=>t.aanvraag_id);
    let ook=false;
    if(aanv.length){
      const v=await vraag({titel:'Ook het stuk van de aanvullijst halen en de KV laten weten?',tekst:`${ids.length===1?'Deze taak komt':'Deze taken komen'} uit een goedgekeurde aanvraag van een KV.`,ok:'Verwijderen',
        html:'<label class="chk"><input type="radio" name="ook" value="1" checked> Ja: het stuk gaat van de aanvullijst en de KV ziet dat het niet meer komt</label><label class="chk"><input type="radio" name="ook" value="0"> Nee: het stuk blijft op de aanvullijst staan</label>',
        lees:f=>({ook:f.ook.value==='1'})});
      if(!v)return;ook=v.ook;
    }else if(!await vraag({titel:`${ids.length} taak${ids.length===1?'':'en'} verwijderen?`,tekst:'Taken waarvan al iets geladen is, worden niet verwijderd (dan gebeurt er niets).',ok:'Verwijderen'}))return;
    const r=await api('POST','/api/transport-taken/bulk-delete',{ids});
    if(!r.ok)return toast(r.json.error||'Verwijderen mislukt','error');
    let extra='';
    if(aanv.length){const o=await api('POST','/api/taken/aanvraag-opruimen',{aanvraag_ids:aanv,ook_aanvullijst:ook});extra=o.ok&&ook?` · ${o.json.regels} stuk${o.json.regels===1?'':'ken'} van de aanvullijst gehaald, KV verwittigd`:(aanv.length?' · het stuk blijft op de aanvullijst':'');}
    toast(`${ids.length} taak${ids.length===1?'':'en'} verwijderd${extra}`,'success');if(D&&ids.includes(D.taak.id))D=null;SEL.clear();laad();
  }
  $('b-weg').onclick=()=>wegHalen([...SEL]);

  // ── subbalk ──
  $('export').onclick=async()=>{
    const r=await fetch('/api/export',{headers:{'x-auth-token':TOKEN}});
    if(!r.ok)return toast('Export mislukt','error');
    const a=document.createElement('a');a.href=URL.createObjectURL(await r.blob());a.download='sporty-export.json';a.click();URL.revokeObjectURL(a.href);
  };
  $('genereer').onclick=async()=>{
    if(!await vraag({titel:'Genereer uit planning',tekst:'Maakt transporttaken aan voor de kampmomenten die er nog geen hebben (bestaande generator).',ok:'Genereren'}))return;
    const r=await api('POST','/api/transport-genereer',{});
    if(!r.ok)return toast(r.json.error||'Genereren mislukt','error');
    toast('Taken gegenereerd'+(r.json.aangemaakt!=null?`: ${r.json.aangemaakt}`:''),'success');laad();
  };
  $('nieuw').onclick=async()=>{
    const v=await taakForm('Nieuwe taak',{},'Aanmaken');if(!v)return;
    const r=await api('POST','/api/transport-taken',{...v,regels:[]});
    if(!r.ok)return toast(r.json.error||'Aanmaken mislukt','error');toast(`Taak #${r.json.id} aangemaakt`,'success');
    await laad();laadDetail(r.json.id);
  };

  // ── bovenbalk (zoals Vandaag/Ritplanning) ──
  async function kop(){
    const v=await api('GET','/api/vandaag');
    if(v.ok){const tel=(id,n)=>{const b=$(id);b.textContent=n;b.hidden=!n;};tel('b-vandaag',v.json.beslissen.length);tel('b-transport',v.json.inplannen.length);
      $('per-naam').textContent=v.json.periode?v.json.periode.naam:'geen periode';$('wie').textContent=v.json.gebruiker.naam+' · kantoor';}
    const p=await api('GET','/api/periodes');if(!p.ok)return;
    const sel=$('per-kies');sel.innerHTML=p.json.map(x=>`<option value="${x.id}"${x.actief?' selected':''}>${esc(x.naam)}</option>`).join('');
    sel.title='Let op: dit wisselt de actieve periode voor alle schermen en alle gebruikers, niet alleen voor jou.'; // TF8
    sel.onchange=async()=>{const a=await api('POST','/api/periodes/'+sel.value+'/activeer');if(!a.ok)return toast(a.json.error||'Periode wisselen mislukt','error');location.reload();};
  }
  (async()=>{
    // ?taak=ID: open de week van die taak en haar detail.
    const tq=+Q.get('taak');
    if(tq&&!Q.get('week')){const d=await api('GET',`/api/taken/${tq}/detail`);if(d.ok&&d.json.taak.datum)Q.set('week',d.json.taak.datum);}
    await laad();if(tq)laadDetail(tq);kop();
  })();
})();
