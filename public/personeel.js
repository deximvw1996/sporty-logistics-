// public/personeel.js — BH1: Beheer › Personeel (design/mockup-beheer.html) op het kantoorpatroon.
// Lijst uit GET /api/personeel-overzicht, detail uit GET /api/personeel/:id/detail; acties via de BH1-routes.
// Na elke actie opnieuw laden; fouten als toast. Alleen weergave: de gsm-laag gebruikt later dezelfde API.
'use strict';
(function(){
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
    const r=await fetch(url,{method:methode,headers:{'Content-Type':'application/json','x-auth-token':TOKEN},body:body?JSON.stringify(body):undefined});
    const j=await r.json().catch(()=>({}));
    return {status:r.status,ok:r.ok,json:j};
  }
  function vraag({titel,tekst,html,ok='Bevestigen',annuleer='Annuleren',lees}){
    return new Promise(resolve=>{
      const bg=document.createElement('div');bg.className='mbg';
      bg.innerHTML=`<div class="mbox" role="dialog" aria-modal="true"><h4>${esc(titel)}</h4>${tekst?`<p>${esc(tekst)}</p>`:''}<form class="form" onsubmit="return false">${html||''}<div class="knoppen">${annuleer?`<button type="button" class="knop licht" data-x="0">${esc(annuleer)}</button>`:''}<button type="button" class="knop" data-x="1">${esc(ok)}</button></div></form></div>`;
      const sluit=v=>{document.removeEventListener('keydown',toets,true);bg.remove();resolve(v);};
      const toets=e=>{if(e.key==='Escape'){e.preventDefault();sluit(null);}};
      document.addEventListener('keydown',toets,true);
      bg.addEventListener('mousedown',e=>{if(e.target===bg)sluit(null);});
      const nee=bg.querySelector('[data-x="0"]');if(nee)nee.onclick=()=>sluit(null);
      bg.querySelector('[data-x="1"]').onclick=()=>{const v=lees?lees(bg.querySelector('form')):{};if(v)sluit(v);};
      document.body.appendChild(bg);(bg.querySelector('select,input')||bg.querySelector('[data-x="1"]')).focus();
    });
  }

  const Q=new URLSearchParams(location.search);
  let O=null,D=null,SEL=new Set(),FILTER='alle',ZOEK='',TAB='gegevens';
  const ROLLEN=[['kantoor','kantoor'],['chauffeur','chauffeur'],['coordinator','coördinator'],['monitor','monitor']];
  const rolTekst=r=>({coordinator:'coördinator',kv:'coördinator (KV)',animator:'monitor (animator)'}[r]||r);
  const FILTERS={alle:()=>true,kantoor:p=>p.rol_groep==='kantoor',chauffeur:p=>p.rol_groep==='chauffeur',coordinator:p=>p.rol_groep==='coordinator',monitor:p=>p.rol_groep==='monitor',zonder_pincode:p=>p.stand==='geen_pincode'};
  const zichtbaar=()=>O.personeel.filter(FILTERS[FILTER]).filter(p=>!ZOEK||[p.naam,p.rol,rolTekst(p.rol),p.telefoon].join(' ').toLowerCase().includes(ZOEK));
  const STAND={actief:['groen','actief'],geen_pincode:['oranje','geen pincode'],inactief:['','inactief']};

  async function laad(){
    const r=await api('GET','/api/personeel-overzicht');
    if(r.status===401||r.status===403){location.href='/';return;}
    if(!r.ok)return toast(r.json.error||'Personeel laden mislukt','error');
    O=r.json;SEL=new Set([...SEL].filter(id=>O.personeel.some(p=>p.id===id)));
    tekenLijst();if(D)await laadDetail(D.persoon.id);
  }
  function tekenLijst(){
    document.querySelectorAll('.chip').forEach(c=>{c.classList.toggle('act',c.dataset.f===FILTER);c.querySelector('b').textContent=O.tellers[c.dataset.f];});
    const l=zichtbaar();
    $('lijst').innerHTML=l.length?l.map(p=>`<div class="r ${D&&D.persoon.id===p.id?'act':''}" data-id="${p.id}"><span><input type="checkbox" data-sel="${p.id}" ${SEL.has(p.id)?'checked':''} aria-label="Selecteer ${esc(p.naam)}"></span><span><b>${esc(p.naam)}</b></span><span>${esc(rolTekst(p.rol))}</span><span>${esc(p.telefoon||'—')}</span><span>${esc(p.laatst_actief_tekst)}</span><span><span class="pil ${STAND[p.stand][0]}">${STAND[p.stand][1]}</span></span></div>`).join('')
      :'<div class="leeg">Niemand voor deze filter</div>';
    $('n-pers').textContent=`${l.length} personen`;$('n-sel').textContent=`${SEL.size} geselecteerd`;
    $('voet').classList.toggle('sel',SEL.size>0);$('alles').checked=l.length>0&&l.every(p=>SEL.has(p.id));
  }
  async function laadDetail(id){
    const r=await api('GET',`/api/personeel/${id}/detail`);
    if(!r.ok){D=null;$('detail').innerHTML='<div class="leegd">Klik een persoon in de lijst voor het detail.</div>';return toast(r.json.error||'Detail laden mislukt','error');}
    D=r.json;tekenDetail();document.querySelectorAll('.r').forEach(x=>x.classList.toggle('act',+x.dataset.id===id));
  }
  function tekenDetail(){
    const {persoon:p,rechten,pincode,rijbewijs,eigen_wagen_capaciteit:cap,meldingen_aan,inzet,logboek}=D;
    const kv=(k,v)=>`<div class="kv"><span>${k}</span><b>${v}</b></div>`;
    const sub=[rolTekst(p.rol),p.telefoon,p.email,p.laatst_actief?'ingelogd '+p.laatst_actief_tekst:'nog nooit ingelogd',p.actief?'':'gedeactiveerd'].filter(Boolean).map(esc).join(' · ');
    const blokGeg=`<h4>Gegevens &amp; rechten</h4>`+kv('Rol',`${esc(rolTekst(p.rol))} ${rechten.length?`<span class="pil">mag: ${esc(rechten.join(' · '))}</span>`:''}`)
      +kv('Telefoon',esc(p.telefoon||'—'))+kv('E-mail',esc(p.email||'—'))
      +kv('Pincode',pincode.gezet?`gezet (scrypt)${pincode.gewijzigd_tekst?' · laatste wijziging '+esc(pincode.gewijzigd_tekst):''}`:`nog niet gekozen${p.uitnodiging_op?' · uitgenodigd':''}`)
      +kv('Rijbewijs',esc([rijbewijs||'—',cap?`eigen wagen (${cap} bakken)`:''].filter(Boolean).join(' · ')))
      +kv('Meldingen',meldingen_aan?'app-meldingen aan':'app-meldingen uit');
    const inzetRij=i=>`<div class="rij"><div class="nm">${esc(i.titel)}<b>${esc(i.sub)}</b></div><a class="knop licht klein" style="display:inline-flex;align-items:center;text-decoration:none" href="${esc(i.link)}">Open</a></div>`;
    const blokInzet=`<h4 style="margin-top:14px">Inzet deze periode</h4>${inzet.map(inzetRij).join('')||'<div class="rij"><div class="nm">Nog niets deze periode</div></div>'}`;
    const logRij=l=>`<div class="rij"><div class="nm">${esc(l.wat)}<b>${esc([l.tijd_tekst,l.wie&&l.wie!==p.naam?'door '+l.wie:''].filter(Boolean).join(' · '))}</b></div></div>`;
    const volledig=`<a class="knop licht klein" style="margin-top:6px;display:inline-flex;align-items:center;text-decoration:none" href="/logboek?wie=${encodeURIComponent(p.naam)}">Volledig logboek ›</a>`;
    const blokLog=`<div class="blok"><h4>Wat deed ${esc(p.naam.split(' ')[0])} (logboek op naam)</h4>${logboek.slice(0,TAB==='log'?50:6).map(logRij).join('')||'<div class="rij"><div class="nm">Nog niets gelogd</div></div>'}${volledig}</div>`;
    const grid=TAB==='gegevens'?`<div class="dgrid een"><div class="blok">${blokGeg}${blokInzet}</div>${blokLog}</div>`
      :TAB==='inzet'?`<div class="dgrid een"><div class="blok">${blokInzet.replace(' style="margin-top:14px"','')}</div><div></div></div>`
      :`<div class="dgrid een">${blokLog}<div></div></div>`;
    $('detail').innerHTML=`<div class="dkop"><div><h2>${esc(p.naam)}</h2><span>${sub}</span></div><div class="acts"><button class="knop licht" id="d-bewerk">Bewerken</button><button class="knop licht" id="d-reset">Pincode resetten</button><button class="knop licht" id="d-actief">${p.actief?'Deactiveren':'Activeren'}</button><button class="knop" id="d-rol">Rol wijzigen</button></div></div>
      <div class="dtabs">${[['gegevens','Gegevens'],['inzet',`Inzet ${inzet.length}`],['log',`Wat deed ${p.naam.split(' ')[0]} ${logboek.length}`]].map(([k,l])=>`<a class="${TAB===k?'act':''}" data-tab="${k}">${esc(l)}</a>`).join('')}</div>${grid}`;
  }

  const rolKeuze=sel=>`<label>Rol<select name="rol">${ROLLEN.map(([w,t])=>`<option value="${w}" ${w===sel?'selected':''}>${t}</option>`).join('')}</select></label>`;
  async function uitnodigen(ids){
    const r=await api('POST','/api/personeel/uitnodiging',{ids});
    if(!r.ok)return toast(r.json.error||'Uitnodiging mislukt','error');
    const u=r.json.uitnodigingen,f=r.json.fouten;
    await vraag({titel:`Pincode-uitnodiging (${u.length})`,tekst:'Er wordt niets automatisch verstuurd: kopieer de tekst en stuur hem zelf (sms, WhatsApp, mail).',ok:'Klaar',annuleer:'',
      html:u.map((x,i)=>`<div class="uitn"><p><b>${esc(x.naam)}</b>${x.telefoon?' · '+esc(x.telefoon):''}<br>${esc(x.instructie)}</p><button type="button" class="knop licht klein" data-kopie="${i}">Kopieer</button></div>`).join('')
        +(f.length?`<p>Niet uitgenodigd: ${f.map(x=>esc((x.naam||'#'+x.id)+' ('+x.reden+')')).join(', ')}</p>`:'')+(u.length>1?'<button type="button" class="knop licht klein" data-kopie="alle">Kopieer alles</button>':'')});
    laad();
  }
  document.addEventListener('click',async e=>{
    const k=e.target.closest('[data-kopie]');
    if(k){const tekst=[...document.querySelectorAll('.mbox .uitn p')].map(p=>p.innerText);const t=k.dataset.kopie==='alle'?tekst.join('\n\n'):tekst[+k.dataset.kopie].split('\n').slice(1).join('\n');
      try{await navigator.clipboard.writeText(t);toast('Gekopieerd','success');}catch(x){toast('Kopiëren lukte niet: selecteer de tekst met de hand','warn');}return;}
  },true);

  document.addEventListener('click',async e=>{
    const t=e.target;
    if(t.closest('.mbox'))return;
    if(t.matches('[data-sel]')){const id=+t.dataset.sel;t.checked?SEL.add(id):SEL.delete(id);return tekenLijst();}
    const chip=t.closest('.chip');if(chip){FILTER=chip.dataset.f;return tekenLijst();}
    const rij=t.closest('.r[data-id]');if(rij)return laadDetail(+rij.dataset.id);
    const tab=t.closest('[data-tab]');if(tab){TAB=tab.dataset.tab;return tekenDetail();}
    if(!D)return;const p=D.persoon;
    if(t.id==='d-bewerk'){
      const v=await vraag({titel:`${p.naam} bewerken`,ok:'Opslaan',html:`<label>Naam<input name="naam" value="${esc(p.naam)}"></label><label>Telefoon<input name="telefoon" value="${esc(p.telefoon)}"></label><label>E-mail<input name="email" value="${esc(p.email)}"></label>
        <label>Rijbewijs<input name="rijbewijs" value="${esc(D.rijbewijs)}" placeholder="bv. B"></label><label>Eigen wagen (bakken)<input type="number" min="1" name="cap" value="${D.eigen_wagen_capaciteit??''}"></label>
        <label class="chk"><input type="checkbox" name="meld" ${D.meldingen_aan?'checked':''}> app-meldingen aan</label><label>Notities<input name="notities" value="${esc(p.notities)}"></label>`,
        lees:f=>f.naam.value.trim()?{naam:f.naam.value.trim(),telefoon:f.telefoon.value,email:f.email.value,rijbewijs:f.rijbewijs.value,eigen_wagen_capaciteit:f.cap.value===''?null:+f.cap.value,meldingen_aan:f.meld.checked,notities:f.notities.value}:(toast('Naam is verplicht','warn'),null)});
      if(!v)return;const r=await api('PUT',`/api/personeel/${p.id}/velden`,v);if(!r.ok)return toast(r.json.error||'Opslaan mislukt','error');toast('Opgeslagen','success');return laad();}
    if(t.id==='d-reset'){
      if(!await vraag({titel:`Pincode van ${p.naam} resetten?`,tekst:`De pincode wordt gewist en ${p.naam} wordt uitgelogd. Bij de volgende keer kiest ${p.naam} zelf een nieuwe pincode.`,ok:'Resetten'}))return;
      const r=await api('POST',`/api/personeel/${p.id}/pincode-reset`);if(!r.ok)return toast(r.json.error||'Reset mislukt','error');toast('Pincode gewist','success');laad();return uitnodigen([p.id]);}
    if(t.id==='d-actief'){
      if(p.actief&&!await vraag({titel:`${p.naam} deactiveren?`,tekst:'Kan niet meer inloggen en wordt meteen uitgelogd. Blijft wel in de historiek; je kan later weer activeren.',ok:'Deactiveren'}))return;
      const r=await api('POST',`/api/personeel/${p.id}/${p.actief?'deactiveer':'activeer'}`);if(!r.ok)return toast(r.json.error||'Mislukt','error');toast(p.actief?'Gedeactiveerd':'Geactiveerd','success');return laad();}
    if(t.id==='d-rol'){
      const v=await vraag({titel:`Rol van ${p.naam}`,tekst:'Een rolwissel logt de persoon uit (de rol zit in de sessie).',ok:'Wijzigen',html:rolKeuze(p.rol),lees:f=>({rol:f.rol.value})});
      if(!v)return;const r=await api('PUT',`/api/personeel/${p.id}/rol`,v);if(!r.ok)return toast(r.json.error||'Rol wijzigen mislukt','error');toast('Rol gewijzigd','success');return laad();}
  });
  $('alles').onchange=e=>{zichtbaar().forEach(p=>e.target.checked?SEL.add(p.id):SEL.delete(p.id));tekenLijst();};
  $('zoek').oninput=e=>{ZOEK=e.target.value.trim().toLowerCase();tekenLijst();};
  const gekozen=()=>O.personeel.filter(p=>SEL.has(p.id));

  $('b-uitn').onclick=()=>uitnodigen([...SEL]);
  $('b-rol').onclick=async()=>{
    const v=await vraag({titel:`Rol van ${SEL.size} personen wijzigen`,ok:'Wijzigen',html:rolKeuze('coordinator'),lees:f=>({rol:f.rol.value})});if(!v)return;
    let n=0;for(const p of gekozen()){const r=await api('PUT',`/api/personeel/${p.id}/rol`,v);if(r.ok)n++;else toast(`${p.naam}: ${r.json.error||'mislukt'}`,'error');}
    toast(`${n} rol${n===1?'':'len'} gewijzigd`,'success');SEL.clear();laad();
  };
  $('b-deact').onclick=async()=>{
    if(!await vraag({titel:`${SEL.size} personen deactiveren?`,tekst:'Ze kunnen niet meer inloggen en worden meteen uitgelogd. Ze blijven in de historiek.',ok:'Deactiveren'}))return;
    let n=0;for(const p of gekozen()){const r=await api('POST',`/api/personeel/${p.id}/deactiveer`);if(r.ok)n++;else toast(`${p.naam}: ${r.json.error||'mislukt'}`,'error');}
    toast(`${n} gedeactiveerd`,'success');SEL.clear();laad();
  };
  $('export').onclick=async()=>{
    const r=await fetch('/api/export',{headers:{'x-auth-token':TOKEN}});if(!r.ok)return toast('Export mislukt','error');
    const a=document.createElement('a');a.href=URL.createObjectURL(await r.blob());a.download='sporty-export.json';a.click();URL.revokeObjectURL(a.href);
  };
  $('nieuw').onclick=async()=>{
    const v=await vraag({titel:'Nieuwe persoon',ok:'Aanmaken',html:`<label>Naam<input name="naam"></label>${rolKeuze('coordinator')}<label>Telefoon<input name="telefoon"></label><label>E-mail<input name="email"></label>`,
      lees:f=>f.naam.value.trim()?{naam:f.naam.value.trim(),rol:f.rol.value,telefoon:f.telefoon.value,email:f.email.value}:(toast('Naam is verplicht','warn'),null)});
    if(!v)return;const r=await api('POST','/api/personeel',v);if(!r.ok)return toast(r.json.error||'Aanmaken mislukt','error');
    toast(`${v.naam} aangemaakt — stuur nu een pincode-uitnodiging`,'success');await laad();laadDetail(r.json.id);
  };
  async function kop(){
    const v=await api('GET','/api/vandaag');
    if(v.ok){const b=$('b-vandaag');b.textContent=v.json.beslissen.length;b.hidden=!v.json.beslissen.length;$('per-naam').textContent=v.json.periode?v.json.periode.naam:'geen periode';$('wie').textContent=v.json.gebruiker.naam+' · kantoor';}
    const p=await api('GET','/api/periodes');if(!p.ok)return;
    const sel=$('per-kies');sel.innerHTML=p.json.map(x=>`<option value="${x.id}"${x.actief?' selected':''}>${esc(x.naam)}</option>`).join('');
    sel.onchange=async()=>{const a=await api('POST','/api/periodes/'+sel.value+'/activeer');if(!a.ok)return toast(a.json.error||'Periode wisselen mislukt','error');location.reload();};
  }
  (async()=>{await laad();const id=+Q.get('id');if(id)laadDetail(id);kop();})();
})();
