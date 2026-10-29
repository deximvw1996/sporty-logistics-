// public/personeel.js — BH1: Beheer › Personeel (design/mockup-beheer.html) op het kantoorpatroon.
// Lijst uit GET /api/personeel-overzicht, detail uit GET /api/personeel/:id/detail; acties via de BH1-routes.
// De HTML-bouwers (chipsHtml, lijstHtml, detailHtml, uitnodigingHtml) zijn pure functies op de API-JSON: de test laadt
// ze als module met de echte data; de gsm-laag kan later dezelfde API gebruiken. Fouten als toast, nooit een kale browser-melding.
'use strict';
(function(){
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const ROL={kantoor:'kantoor',chauffeur:'chauffeur',coordinator:'coördinator',monitor:'monitor',kv:'kv'};
  const CHIPS=[['alle','Alle'],['kantoor','Kantoor'],['chauffeur','Chauffeur'],['coordinator','Coördinator'],['monitor','Monitor'],['zonder_pincode','⚠ Zonder pincode']];
  const FILTERS={alle:()=>true,zonder_pincode:p=>p.stand==='geen_pincode'};
  const past=(p,f)=>(FILTERS[f]||(x=>x.rol===f))(p);
  const zichtbaar=(O,st)=>O.personeel.filter(p=>past(p,st.filter)).filter(p=>!st.zoek||[p.naam,p.rol_tekst||p.rol,p.telefoon].join(' ').toLowerCase().includes(st.zoek));
  const STAND={actief:['groen','actief'],geen_pincode:['oranje','geen pincode'],inactief:['','inactief']};

  function chipsHtml(O,filter){
    return CHIPS.map(([k,l])=>`<span class="chip ${filter===k?'act':''}" data-f="${k}">${l} ${O.tellers[k]??0}</span>`).join('');
  }
  function lijstHtml(O,st){
    const l=zichtbaar(O,st);
    return l.length?l.map(p=>{const s=STAND[p.stand]||STAND.actief;
      return `<div class="r ${st.open===p.id?'act':''}" data-id="${p.id}"><span><input type="checkbox" data-sel="${p.id}" ${st.sel.has(p.id)?'checked':''} aria-label="Selecteer ${esc(p.naam)}"></span><span><b>${esc(p.naam)}</b></span><span>${esc(ROL[p.rol]||p.rol)}</span><span>${esc(p.telefoon||'—')}</span><span>${esc(p.laatst_actief_tekst)}</span><span><span class="pil ${s[0]}">${s[1]}</span></span></div>`;}).join('')
      :'<div class="leeg">Geen personen voor deze filter</div>';
  }
  const rij=(nm,sub,extra)=>`<div class="rij"><div class="nm">${esc(nm)}<b>${esc(sub)}</b></div>${extra||''}</div>`;
  const kv=(k,v)=>`<div class="kv"><span>${k}</span><b>${v}</b></div>`;
  function detailHtml(D,tab){
    const p=D.persoon,rt=ROL[p.rol]||p.rol;
    const sub=[rt,p.telefoon,p.email,p.laatst_actief?'ingelogd '+p.laatst_actief_tekst:'nog niet ingelogd'].filter(Boolean).map(esc).join(' · ')
      +(p.stand==='inactief'?' · <span class="pil">inactief</span>':p.stand==='geen_pincode'?' · <span class="pil oranje">geen pincode</span>':'');
    const wagen=D.eigen_wagen_capaciteit!=null?`eigen wagen (${D.eigen_wagen_capaciteit} bakken)`:'';
    const pin=D.pincode.gezet?`gezet (scrypt)${D.pincode.gewijzigd_tekst?' · laatste wijziging '+D.pincode.gewijzigd_tekst:''}`:`nog niet gezet${p.uitnodiging_op?' · uitnodiging verstuurd':''}`;
    const inzet=D.inzet.map(i=>rij(i.titel,i.sub,`<a class="knop licht klein" href="${esc(i.link)}">Open</a>`)).join('')||'<div class="rij"><div class="nm">Geen inzet deze periode</div></div>';
    const logRij=l=>rij(l.wat,[l.tijd_tekst,l.wie!=='—'&&l.persoon_id!==p.id?'door '+l.wie:''].filter(Boolean).join(' · '));
    const volledig=`<a class="knop licht klein" style="margin-top:6px;align-self:flex-start" href="/logboek?wie=${p.id}">Volledig logboek ›</a>`;
    const blokGeg=`<div class="blok"><h4>Gegevens &amp; rechten</h4>${kv('Rol',`${esc(rt)} <span class="pil">mag: ${esc(D.rechten.join(' · ')||'—')}</span>`)}${kv('Telefoon',esc(p.telefoon||'—'))}${kv('Pincode',esc(pin))}${kv('Rijbewijs',esc([D.rijbewijs,wagen].filter(Boolean).join(' · ')||'—'))}${kv('Meldingen',D.meldingen_aan?'app-meldingen aan':'app-meldingen uit')}
     <h4 style="margin-top:14px">Inzet deze periode</h4>${inzet}</div>`;
    const blokLog=`<div class="blok" style="display:flex;flex-direction:column"><h4>Wat deed ze (logboek op naam)</h4>${D.logboek.slice(0,6).map(logRij).join('')||'<div class="rij"><div class="nm">Nog niets gelogd</div></div>'}${volledig}</div>`;
    let grid;
    if(tab==='inzet')grid=`<div class="dgrid een"><div class="blok"><h4>Inzet deze periode${D.periode?' · '+esc(D.periode):''}</h4>${inzet}</div><div></div></div>`;
    else if(tab==='logboek')grid=`<div class="dgrid een"><div class="blok" style="display:flex;flex-direction:column"><h4>Wat deed ze (logboek op naam)</h4>${D.logboek.map(l=>rij(l.wat,l.tijd_tekst+(l.wie!=='—'&&l.persoon_id!==p.id?' · door '+l.wie:''),`<button class="knop licht klein" disabled title="Terugdraaien bestaat nog niet als route">↶ Terug</button>`)).join('')||'<div class="rij"><div class="nm">Nog niets gelogd</div></div>'}${volledig}</div><div></div></div>`;
    else grid=`<div class="dgrid een">${blokGeg}${blokLog}</div>`;
    const tabs=[['gegevens','Gegevens'],['inzet',`Inzet ${D.inzet.length}`],['logboek',`Wat deed ze ${D.logboek.length}`]];
    return `<div class="dkop"><div><h2>${esc(p.naam)}</h2><span>${sub}</span></div><div class="acts"><button class="knop licht" id="d-bewerk">Bewerken</button><button class="knop licht" id="d-reset">Pincode resetten</button><button class="knop licht" id="d-deact">${p.stand==='inactief'?'Activeren':'Deactiveren'}</button><button class="knop" id="d-rol">Rol wijzigen</button></div></div>
   <div class="dtabs">${tabs.map(([k,l])=>`<a class="${tab===k?'act':''}" data-tab="${k}">${l}</a>`).join('')}</div>
   ${grid}`;
  }
  function uitnodigingHtml(U){
    return U.personen.map((p,i)=>`<div class="uit"><div><b>${esc(p.naam)} · ${esc(ROL[p.rol]||p.rol)}${p.telefoon?' · '+esc(p.telefoon):''}</b>${esc(p.instructie)}</div><button type="button" class="knop licht klein" data-kopieer="${i}">Kopiëren</button></div>`).join('')
      +`<button type="button" class="knop licht klein" data-kopieer="alles">Alles kopiëren</button>`;
  }
  const BOUWERS={chipsHtml,lijstHtml,detailHtml,uitnodigingHtml};
  if(typeof module!=='undefined'&&module.exports){module.exports=BOUWERS;}
  if(typeof document==='undefined')return;

  // ── browser ──
  const TOKEN=localStorage.getItem('sporty-auth-token');
  if(!TOKEN){location.href='/';return;}
  const $=id=>document.getElementById(id);
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
  // vraagModal (zelfde gedrag als bakken.js): null bij annuleren, anders wat lees() teruggeeft. zonderOk: enkel "Sluiten".
  function vraag({titel,tekst,html,ok='Bevestigen',lees,breed,zonderOk,klaar}){
    return new Promise(resolve=>{
      const bg=document.createElement('div');bg.className='mbg';
      bg.innerHTML=`<div class="mbox${breed?' breed':''}" role="dialog" aria-modal="true"><h4>${esc(titel)}</h4>${tekst?`<p>${esc(tekst)}</p>`:''}<form class="form" onsubmit="return false">${html||''}<div class="knoppen"><button type="button" class="knop licht" data-x="0">${zonderOk?'Sluiten':'Annuleren'}</button>${zonderOk?'':`<button type="button" class="knop" data-x="1">${esc(ok)}</button>`}</div></form></div>`;
      const sluit=v=>{document.removeEventListener('keydown',toets,true);bg.remove();resolve(v);};
      const toets=e=>{if(e.key==='Escape'){e.preventDefault();sluit(null);}};
      document.addEventListener('keydown',toets,true);
      bg.addEventListener('mousedown',e=>{if(e.target===bg)sluit(null);});
      bg.querySelector('[data-x="0"]').onclick=()=>sluit(null);
      const okK=bg.querySelector('[data-x="1"]');if(okK)okK.onclick=async()=>{const v=lees?await lees(bg.querySelector('form')):{};if(v)sluit(v);};
      document.body.appendChild(bg);if(klaar)klaar(bg);(bg.querySelector('select,input')||bg.querySelector('button')).focus();
    });
  }

  const Q=new URLSearchParams(location.search);
  let O=null,D=null,TAB='gegevens';
  const ST={filter:'alle',zoek:'',sel:new Set(),open:null};
  async function laad(){
    const r=await api('GET','/api/personeel-overzicht');
    if(r.status===401){location.href='/';return;}
    if(r.status===403){toast('Personeel beheren kan alleen met de rol kantoor','error');return;}
    if(!r.ok)return toast(r.json.error||'Personeel laden mislukt','error');
    O=r.json;
    ST.sel=new Set([...ST.sel].filter(id=>O.personeel.some(p=>p.id===id)));
    tekenLijst();
    if(D)await laadDetail(D.persoon.id);
  }
  function tekenLijst(){
    $('chips').innerHTML=chipsHtml(O,ST.filter);
    $('lijst').innerHTML=lijstHtml(O,ST);
    const n=zichtbaar(O,ST).length;
    $('n-pers').textContent=`${n} ${n===1?'persoon':'personen'}`;
    $('n-sel').textContent=`${ST.sel.size} geselecteerd`;
    $('voet').classList.toggle('sel',ST.sel.size>0);
    const l=zichtbaar(O,ST);$('alles').checked=l.length>0&&l.every(p=>ST.sel.has(p.id));
  }
  async function laadDetail(id){
    const r=await api('GET',`/api/personeel/${id}/detail`);
    if(!r.ok){D=null;ST.open=null;$('detail').innerHTML='<div class="leegd">Klik een persoon in de lijst voor het detail.</div>';return toast(r.json.error||'Detail laden mislukt','error');}
    D=r.json;ST.open=D.persoon.id;$('detail').innerHTML=detailHtml(D,TAB);
    document.querySelectorAll('.r[data-id]').forEach(x=>x.classList.toggle('act',+x.dataset.id===ST.open));
  }
  const rolOpt=sel=>['kantoor','chauffeur','coordinator','monitor'].map(r=>`<option value="${r}" ${r===sel?'selected':''}>${ROL[r]}</option>`).join('');
  const rolForm=(titel,sel)=>vraag({titel,ok:'Rol opslaan',html:`<label>Nieuwe rol<select name="rol">${rolOpt(sel)}</select></label>`,lees:f=>({rol:f.rol.value})});
  async function perPersoon(ids,doe,goed){
    let n=0;for(const id of ids){const r=await doe(id);if(r.ok)n++;else toast(`${(O.personeel.find(p=>p.id===id)||{}).naam||id}: ${r.json.error||'mislukt'}`,'error');}
    if(n)toast(`${n} ${goed}`,'success');return n;
  }
  async function uitnodigen(ids){
    const r=await api('POST','/api/personeel/uitnodiging',{ids});
    if(!r.ok)return toast(r.json.error||'Uitnodiging mislukt','error');
    const U=r.json, kopieer=async t=>{try{await navigator.clipboard.writeText(t);toast('Gekopieerd','success');}catch(e){toast('Kopiëren lukt niet in deze browser: selecteer de tekst en kopieer met Ctrl+C','warn');}};
    vraag({titel:`Pincode-uitnodiging voor ${U.personen.length} ${U.personen.length===1?'persoon':'personen'}`,tekst:'Er gaat geen mail of sms uit: kopieer de tekst en stuur hem zelf door (WhatsApp, sms, mail).',
      html:uitnodigingHtml(U),breed:true,zonderOk:true,klaar:bg=>bg.addEventListener('click',e=>{const k=e.target.closest('[data-kopieer]');if(!k)return;
        kopieer(k.dataset.kopieer==='alles'?U.personen.map(p=>p.instructie).join('\n\n'):U.personen[+k.dataset.kopieer].instructie);})});
    laad();
  }

  document.addEventListener('click',async e=>{
    const t=e.target;
    if(t.matches('[data-sel]')){const id=+t.dataset.sel;t.checked?ST.sel.add(id):ST.sel.delete(id);return tekenLijst();}
    const chip=t.closest('.chip[data-f]');if(chip){ST.filter=chip.dataset.f;return tekenLijst();}
    const r=t.closest('.r[data-id]');if(r){return laadDetail(+r.dataset.id);}
    const tab=t.closest('[data-tab]');if(tab&&D){TAB=tab.dataset.tab;$('detail').innerHTML=detailHtml(D,TAB);return;}
    if(!D||!t.closest('#detail'))return;
    const p=D.persoon;
    if(t.id==='d-bewerk'){
      const v=await vraag({titel:`${p.naam} bewerken`,ok:'Opslaan',html:`<label>Naam<input name="naam" value="${esc(p.naam)}"></label><label>Telefoon<input name="telefoon" value="${esc(p.telefoon)}"></label><label>E-mail<input name="email" value="${esc(p.email)}"></label>
        <label>Rijbewijs<input name="rijbewijs" value="${esc(D.rijbewijs)}" placeholder="bv. B"></label><label>Eigen wagen: aantal bakken<input type="number" min="0" max="99" name="cap" value="${D.eigen_wagen_capaciteit??''}" placeholder="leeg = geen eigen wagen"></label>
        <label class="chk"><input type="checkbox" name="meld" ${D.meldingen_aan?'checked':''}> App-meldingen aan</label><label>Notities<input name="notities" value="${esc(p.notities)}"></label>`,
        lees:f=>{if(!f.naam.value.trim()){toast('Naam mag niet leeg zijn','warn');return null;}
          return {naam:f.naam.value.trim(),telefoon:f.telefoon.value,email:f.email.value,rijbewijs:f.rijbewijs.value,eigen_wagen_capaciteit:f.cap.value,meldingen_aan:f.meld.checked,notities:f.notities.value};}});
      if(!v)return;const x=await api('PUT',`/api/personeel/${p.id}/velden`,v);if(!x.ok)return toast(x.json.error||'Opslaan mislukt','error');toast('Opgeslagen','success');return laad();
    }
    if(t.id==='d-reset'){
      if(!await vraag({titel:`Pincode van ${p.naam} resetten?`,tekst:'De huidige pincode werkt meteen niet meer en ingelogde toestellen worden afgemeld. Stuur daarna een pincode-uitnodiging.',ok:'Pincode resetten'}))return;
      const x=await api('POST',`/api/personeel/${p.id}/pincode-reset`);if(!x.ok)return toast(x.json.error||'Resetten mislukt','error');toast('Pincode gewist','success');return laad();
    }
    if(t.id==='d-deact'){
      const weg=p.stand!=='inactief';
      if(weg&&!await vraag({titel:`${p.naam} deactiveren?`,tekst:'Kan niet meer inloggen; blijft wel in de historiek en het logboek. Je kan later weer activeren.',ok:'Deactiveren'}))return;
      const x=await api('POST',`/api/personeel/${p.id}/${weg?'deactiveer':'activeer'}`);if(!x.ok)return toast(x.json.error||'Mislukt','error');toast(weg?'Gedeactiveerd':'Weer actief','success');return laad();
    }
    if(t.id==='d-rol'){
      const v=await rolForm(`Rol van ${p.naam}`,p.rol);if(!v)return;
      const x=await api('PUT',`/api/personeel/${p.id}/rol`,v);if(!x.ok)return toast(x.json.error||'Rol wijzigen mislukt','error');toast('Rol gewijzigd','success');return laad();
    }
  });
  $('alles').onchange=e=>{zichtbaar(O,ST).forEach(p=>e.target.checked?ST.sel.add(p.id):ST.sel.delete(p.id));tekenLijst();};
  $('zoek').oninput=e=>{ST.zoek=e.target.value.trim().toLowerCase();tekenLijst();};

  // ── bulk ──
  $('b-uitnodig').onclick=()=>uitnodigen([...ST.sel]);
  $('b-rol').onclick=async()=>{const v=await rolForm(`Rol van ${ST.sel.size} personen wijzigen`,'coordinator');if(!v)return;
    await perPersoon([...ST.sel],id=>api('PUT',`/api/personeel/${id}/rol`,v),'rol gewijzigd');ST.sel.clear();laad();};
  $('b-deact').onclick=async()=>{
    if(!await vraag({titel:`${ST.sel.size} personen deactiveren?`,tekst:'Ze kunnen niet meer inloggen; ze blijven in de historiek en het logboek.',ok:'Deactiveren'}))return;
    await perPersoon([...ST.sel],id=>api('POST',`/api/personeel/${id}/deactiveer`),'gedeactiveerd');ST.sel.clear();laad();};

  // ── subbalk ──
  $('instellingen').onclick=()=>toast('Instellingen heeft nog geen eigen pagina','warn');
  $('export').onclick=async()=>{
    const r=await fetch('/api/export',{headers:{'x-auth-token':TOKEN}});
    if(!r.ok)return toast('Export mislukt','error');
    const a=document.createElement('a');a.href=URL.createObjectURL(await r.blob());a.download='sporty-export.json';a.click();URL.revokeObjectURL(a.href);
  };
  $('nieuw').onclick=async()=>{
    const v=await vraag({titel:'Nieuwe persoon',ok:'Aanmaken',html:`<label>Naam<input name="naam"></label><label>Rol<select name="rol">${rolOpt('coordinator')}</select></label><label>Telefoon<input name="telefoon"></label><label>E-mail<input name="email"></label>`,
      lees:f=>f.naam.value.trim()?{naam:f.naam.value.trim(),rol:f.rol.value,telefoon:f.telefoon.value.trim(),email:f.email.value.trim()}:(toast('Geef een naam','warn'),null)});
    if(!v)return;const r=await api('POST','/api/personeel',v);if(!r.ok)return toast(r.json.error||'Aanmaken mislukt','error');
    toast(`${v.naam} toegevoegd: stuur een pincode-uitnodiging`,'success');await laad();laadDetail(r.json.id);
  };

  // ── bovenbalk ──
  async function kop(){
    const v=await api('GET','/api/vandaag');
    if(v.ok){const b=$('b-vandaag');b.textContent=v.json.beslissen.length;b.hidden=!v.json.beslissen.length;
      $('per-naam').textContent=v.json.periode?v.json.periode.naam:'geen periode';$('wie').textContent=v.json.gebruiker.naam+' · kantoor';}
    const p=await api('GET','/api/periodes');if(!p.ok)return;
    const sel=$('per-kies');sel.innerHTML=p.json.map(x=>`<option value="${x.id}"${x.actief?' selected':''}>${esc(x.naam)}</option>`).join('');
    sel.onchange=async()=>{const a=await api('POST','/api/periodes/'+sel.value+'/activeer');if(!a.ok)return toast(a.json.error||'Periode wisselen mislukt','error');location.reload();};
  }
  (async()=>{await laad();const q=+Q.get('id');if(q)laadDetail(q);kop();})();
})();
