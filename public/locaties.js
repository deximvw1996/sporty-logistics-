// public/locaties.js — LO1: Locaties (design/PATROON-DEFINITIEF.html) op het kantoorpatroon.
// Lijst uit GET /api/locaties-overzicht, detail uit GET /api/locaties/:id/detail; acties via de bestaande routes.
// De HTML-bouwers (BOUW) zijn los van de browser, zodat de test ze met echte data-JSON kan aanroepen.
'use strict';
(function(){
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  // ── HTML-bouwers (geen DOM nodig) ──
  const BOUW={
    // Rij in de lijst; contacten-weergave toont telefoon i.p.v. periode.
    rij(l,{sel,act,contacten}={}){
      const periode=l.periode.length?l.periode.map(k=>{const t=`wk ${k.week}${k.kv_naam?' '+esc(k.kv_naam):''}`;return k.loopt_nu?`<b>${t}</b>`:t;}).join(' · '):'—';
      const vijfde=contacten?esc([l.contact_naam,l.telefoon].filter(Boolean).join(' · ')||'—'):periode;
      return `<div class="r ${act?'act':''}" data-id="${l.id}"><span><input type="checkbox" data-sel="${l.id}" ${sel?'checked':''} aria-label="Selecteer ${esc(l.naam)}"></span><span><b>${esc(l.naam)}</b></span><span>${esc(l.type)}</span><span>${esc(l.gemeente||'—')}</span><span>${vijfde}</span><span><span class="pil ${l.status==='let'?'oranje':'groen'}" ${l.aandacht.length?`title="${esc(l.aandacht.join(' · '))}"`:''}>${l.status==='let'?'⚠ let op':'ok'}</span></span></div>`;
    },
    detail(D,tab){
      const {locatie:l,contact,sleutel_info,wifi,ter_plaatse:tp,fotos,kampmomenten:kms,historiek}=D;
      const kv=(k,v)=>`<div class="kv"><span>${k}</span><b>${v}</b></div>`;
      const jn=b=>b?'ja':'nee';
      const blokContact=`<div class="blok"><h4>Contact &amp; toegang</h4>${kv('Contact',esc([contact.naam,contact.telefoon].filter(Boolean).join(' · ')||'—'))}${kv('Sleutel',esc(sleutel_info||'—'))}${kv('Wifi',esc(wifi||'—'))}${kv('Ter plaatse',`eigen oven: ${jn(tp.eigen_oven)} · eigen sportmateriaal: ${jn(tp.eigen_sportmateriaal)} · zelf kuisen: ${jn(tp.zelf_kuisen)}`)}${l.aandacht.length?kv('Let op',`<span class="pil oranje">${esc(l.aandacht.join(' · '))}</span>`):''}</div>`;
      const blokFotos=`<div class="blok"><h4>Foto's</h4><div class="fotos">${fotos.map(f=>`<div class="f" style="${f.url?`background-image:url('${esc(f.url)}')`:''}">${esc(f.beschrijving||'foto')}<span class="x" data-fotoweg="${f.id}" title="Foto verwijderen">✕</span></div>`).join('')}<label class="f plus">+ foto<input type="file" accept="image/*" id="foto-in" hidden></label></div></div>`;
      const blokKm=`<div class="blok"><h4>Kampmomenten</h4>${kms.map(k=>`<div class="rij"><div class="nm">${esc(k.periode)} · week ${k.week}${k.thema?' · '+esc(k.thema):''}${k.loopt_nu?' <span class="pil groen">loopt nu</span>':''}<b>${esc([k.kv_naam?'KV '+k.kv_naam:'geen KV',k.transport].join(' · '))}</b></div><a class="knop licht klein" style="display:inline-flex;align-items:center;text-decoration:none" href="/kampmomenten?id=${k.kampmoment_id}">Open</a></div>`).join('')||'<div class="rij"><div class="nm">Nog geen kampmomenten</div></div>'}</div>`;
      const blokHist=`<div class="blok"><h4>Historiek (alles gelogd, omkeerbaar)</h4>${historiek.slice(0,tab==='historiek'?100:5).map(h=>`<div class="rij"><div class="nm">${esc(h.wat)}<b>${esc([h.t,h.wie].filter(Boolean).join(' · '))}</b></div><button class="knop licht klein" disabled title="Terugdraaien bestaat nog niet als route (GEVONDEN TR1)">↶ Terug</button></div>`).join('')||'<div class="rij"><div class="nm">Nog niets gelogd</div></div>'}</div>`;
      const inhoud={gegevens:blokContact+blokFotos+blokKm+blokHist,fotos:blokFotos,kampmomenten:blokKm,historiek:blokHist}[tab]||'';
      const sub=[l.type==='kamp'?'Kamplocatie':l.type==='stockage'?'Stockage':l.type,l.adres].filter(Boolean).map(esc).join(' · ');
      return `<div class="dkop"><div><h2>${esc(l.naam)}</h2><span>${sub}</span></div><div class="acts"><button class="knop licht" id="d-bewerk">Bewerken</button><button class="knop licht" id="d-kaart">📍 Kaart</button><button class="knop" id="d-rit">Rit plannen</button></div></div>
        <div class="dtabs">${[['gegevens','Gegevens'],['fotos',`Foto's ${fotos.length}`],['kampmomenten',`Kampmomenten ${kms.length}`],['historiek',`Historiek ${historiek.length}`]].map(([k,t])=>`<a class="${tab===k?'act':''}" data-tab="${k}">${t}</a>`).join('')}</div>
        <div class="dgrid"${tab==='gegevens'?'':' style="grid-template-columns:1fr"'}>${inhoud}</div>`;
    }
  };
  if(typeof module!=='undefined'&&module.exports){module.exports=BOUW;return;}

  // ── browser ──
  const TOKEN=localStorage.getItem('sporty-auth-token');
  if(!TOKEN){location.href='/';return;}
  const $=id=>document.getElementById(id);
  function toast(msg,type){
    const t=document.createElement('div');t.style.background={info:'#378ADD',error:'#E24B4A',success:'#1D9E75',warn:'#EF9F27'}[type||'info'];
    t.textContent=msg;t.onclick=()=>t.remove();$('toasts').appendChild(t);
    setTimeout(()=>{t.style.transition='opacity .3s';t.style.opacity='0';setTimeout(()=>t.remove(),300);},type==='error'?5000:3000);
  }
  async function api(m,url,body){const r=await fetch(url,{method:m,headers:{'Content-Type':'application/json','x-auth-token':TOKEN},body:body?JSON.stringify(body):undefined});const j=await r.json().catch(()=>({}));return {status:r.status,ok:r.ok,json:j};}
  function vraag({titel,tekst,html,ok='Bevestigen',annuleer='Annuleren',lees}){
    return new Promise(resolve=>{
      const bg=document.createElement('div');bg.className='mbg';
      bg.innerHTML=`<div class="mbox" role="dialog" aria-modal="true"><h4>${esc(titel)}</h4>${tekst?`<p>${esc(tekst)}</p>`:''}<form class="form" onsubmit="return false">${html||''}<div class="knoppen">${annuleer?`<button type="button" class="knop licht" data-x="0">${esc(annuleer)}</button>`:''}<button type="button" class="knop" data-x="1">${esc(ok)}</button></div></form></div>`;
      const sluit=v=>{document.removeEventListener('keydown',toets,true);bg.remove();resolve(v);};
      const toets=e=>{if(e.key==='Escape'){e.preventDefault();sluit(null);}};
      document.addEventListener('keydown',toets,true);bg.addEventListener('mousedown',e=>{if(e.target===bg)sluit(null);});
      const nee=bg.querySelector('[data-x="0"]');if(nee)nee.onclick=()=>sluit(null);
      bg.querySelector('[data-x="1"]').onclick=()=>{const v=lees?lees(bg.querySelector('form')):{};if(v)sluit(v);};
      document.body.appendChild(bg);(bg.querySelector('select,input')||bg.querySelector('[data-x="1"]')).focus();
    });
  }
  const Q=new URLSearchParams(location.search);
  const CONTACTEN=Q.get('weergave')==='contacten';
  let O=null,D=null,SEL=new Set(),FILTER=CONTACTEN?'kamp':'alle',ZOEK='',TAB='gegevens';
  if(CONTACTEN){$('sub-loc').classList.remove('act');$('sub-contact').classList.add('act');$('kol-periode').textContent='Contact · telefoon';}
  const FILTERS={alle:()=>true,kamp:l=>l.type==='kamp',stockage:l=>l.type==='stockage',let_op:l=>l.status==='let',deze_periode:l=>l.periode.length>0};
  const zichtbaar=()=>O.locaties.filter(FILTERS[FILTER]).filter(l=>!ZOEK||l.zoek.includes(ZOEK));

  async function laad(){
    const r=await api('GET','/api/locaties-overzicht');
    if(r.status===401||r.status===403){location.href='/';return;}
    if(!r.ok)return toast(r.json.error||'Locaties laden mislukt','error');
    O=r.json;SEL=new Set([...SEL].filter(id=>O.locaties.some(l=>l.id===id)));tekenLijst();if(D)await laadDetail(D.locatie.id);
  }
  function tekenLijst(){
    document.querySelectorAll('.chip').forEach(c=>{c.classList.toggle('act',c.dataset.f===FILTER);c.querySelector('b').textContent=O.tellers[c.dataset.f];});
    const l=zichtbaar();
    $('lijst').innerHTML=l.length?l.map(x=>BOUW.rij(x,{sel:SEL.has(x.id),act:D&&D.locatie.id===x.id,contacten:CONTACTEN})).join(''):'<div class="leeg">Geen locaties voor deze filter</div>';
    $('n-loc').textContent=`${l.length} locaties`;$('n-sel').textContent=`${SEL.size} geselecteerd`;$('voet').classList.toggle('sel',SEL.size>0);$('alles').checked=l.length>0&&l.every(x=>SEL.has(x.id));
  }
  async function laadDetail(id){
    const r=await api('GET',`/api/locaties/${id}/detail`);
    if(!r.ok){D=null;$('detail').innerHTML='<div class="leegd">Klik een locatie in de lijst voor het detail.</div>';return toast(r.json.error||'Detail laden mislukt','error');}
    D=r.json;teken();document.querySelectorAll('.r').forEach(x=>x.classList.toggle('act',+x.dataset.id===id));
  }
  function teken(){$('detail').innerHTML=BOUW.detail(D,TAB);const fi=$('foto-in');if(fi)fi.onchange=()=>foto(fi.files[0]);}
  async function foto(bestand){
    if(!bestand)return;
    const data=await new Promise((ok,nok)=>{const fr=new FileReader();fr.onload=()=>ok(fr.result);fr.onerror=nok;fr.readAsDataURL(bestand);});
    const r=await api('POST',`/api/locaties/${D.locatie.id}/foto`,{foto_data:data,beschrijving:bestand.name.replace(/\.[^.]+$/,'')});
    if(!r.ok)return toast(r.json.error||'Foto bewaren mislukt','error');toast('Foto bewaard','success');laad();
  }
  async function locForm(titel,d,ok){
    const l=d.locatie||{},c=d.contact||{},tp=d.ter_plaatse||{};
    return vraag({titel,ok,html:`<label>Naam<input name="naam" value="${esc(l.naam||'')}"></label><label>Type<select name="type">${['kamp','stockage'].map(t=>`<option ${t===(l.type||'kamp')?'selected':''}>${t}</option>`).join('')}</select></label>
      <label>Adres<input name="adres" value="${esc(l.adres||'')}" placeholder="Straat nr, postcode gemeente"></label><label>Gemeente<input name="gemeente" value="${esc(l.gemeente||'')}"></label>
      <label>Contact (naam, eventueel e-mail)<input name="cnaam" value="${esc(c.naam||'')}"></label><label>Telefoon<input name="ctel" value="${esc(c.telefoon||'')}"></label>
      <label>Sleutel<input name="sleutel" value="${esc(d.sleutel_info||'')}"></label><label>Wifi<input name="wifi" value="${esc(d.wifi||'')}"></label>
      <label class="chk"><input type="checkbox" name="oven" ${tp.eigen_oven?'checked':''}> eigen oven</label><label class="chk"><input type="checkbox" name="sport" ${tp.eigen_sportmateriaal?'checked':''}> eigen sportmateriaal</label><label class="chk"><input type="checkbox" name="kuis" ${tp.zelf_kuisen?'checked':''}> zelf kuisen</label>`,
      lees:f=>f.naam.value.trim()?{name:f.naam.value.trim(),type:f.type.value,addr:f.adres.value,gemeente:f.gemeente.value,contact_naam:f.cnaam.value,contact_tel:f.ctel.value,sleutel_info:f.sleutel.value,wifi:f.wifi.value,
        heeft_eigen_oven:f.oven.checked,heeft_eigen_sportmateriaal:f.sport.checked,zelf_kuisen:f.kuis.checked}:(toast('Naam is verplicht','warn'),null)});
  }
  function exporteer(lijst){
    const kol=['naam','type','gemeente','adres','contact_naam','telefoon','periode_tekst','status'];
    const csv=[kol.join(';'),...lijst.map(l=>kol.map(k=>`"${String(l[k]??'').replace(/"/g,'""')}"`).join(';'))].join('\r\n');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+csv],{type:'text/csv'}));a.download='locaties.csv';a.click();URL.revokeObjectURL(a.href);
  }

  document.addEventListener('click',async e=>{
    const t=e.target;if(t.closest('.mbox'))return;
    if(t.matches('[data-sel]')){const id=+t.dataset.sel;t.checked?SEL.add(id):SEL.delete(id);return tekenLijst();}
    const chip=t.closest('.chip');if(chip){FILTER=chip.dataset.f;return tekenLijst();}
    const rij=t.closest('.r[data-id]');if(rij)return laadDetail(+rij.dataset.id);
    const tab=t.closest('[data-tab]');if(tab){TAB=tab.dataset.tab;return teken();}
    if(!D)return;const l=D.locatie;
    if(t.id==='d-kaart')return location.href='/#kaart?id='+l.id;
    if(t.id==='d-rit')return location.href='/ritplanning';
    const fw=t.closest('[data-fotoweg]');
    if(fw){e.preventDefault();if(!await vraag({titel:'Foto verwijderen?',ok:'Verwijderen'}))return;const r=await api('DELETE',`/api/locaties/${l.id}/foto/${fw.dataset.fotoweg}`);if(!r.ok)return toast(r.json.error||'Verwijderen mislukt','error');toast('Foto verwijderd','success');return laad();}
    if(t.id==='d-bewerk'){const v=await locForm(`${l.naam} bewerken`,D,'Opslaan');if(!v)return;const r=await api('PUT',`/api/locaties/${l.id}`,v);if(!r.ok)return toast(r.json.error||'Opslaan mislukt','error');toast('Opgeslagen','success');return laad();}
  });
  $('alles').onchange=e=>{zichtbaar().forEach(l=>e.target.checked?SEL.add(l.id):SEL.delete(l.id));tekenLijst();};
  $('zoek').oninput=e=>{ZOEK=e.target.value.trim().toLowerCase();tekenLijst();};
  const gekozen=()=>O.locaties.filter(l=>SEL.has(l.id));
  $('b-export').onclick=()=>exporteer(gekozen());
  $('b-mail').onclick=async()=>{
    const r=await api('POST','/api/locaties/contact-mail',{ids:[...SEL]});if(!r.ok)return toast(r.json.error||'Mislukt','error');
    const {mails,zonder,alles}=r.json;
    await vraag({titel:`Contact mailen (${mails.length})`,tekst:'Er wordt niets verstuurd: een klik opent je eigen mailprogramma.',ok:'Klaar',annuleer:'',
      html:mails.map(m=>`<div class="mail"><a href="${esc(m.mailto)}">${esc(m.naam)}</a><span>${esc(m.email)}</span></div>`).join('')+(alles&&mails.length>1?`<div class="mail"><a href="${esc(alles)}">Allemaal in één mail (bcc)</a></div>`:'')
        +(zonder.length?`<p>Zonder e-mailadres: ${zonder.map(z=>esc(z.naam+(z.telefoon?' ('+z.telefoon+')':''))).join(', ')}</p>`:'')});
  };
  $('b-weg').onclick=async()=>{
    if(!await vraag({titel:`${SEL.size} locaties verwijderen?`,tekst:'Een locatie met kampmomenten, transporttaken of bakken wordt niet verwijderd.',ok:'Verwijderen'}))return;
    let n=0;for(const l of gekozen()){const r=await api('DELETE',`/api/locaties-overzicht/${l.id}`);if(r.ok)n++;else toast(r.json.error||'Verwijderen mislukt','error');}
    if(n)toast(`${n} verwijderd`,'success');if(D&&SEL.has(D.locatie.id))D=null;SEL.clear();laad();
  };
  $('export').onclick=async()=>{ // bestaande volledige export (zoals de andere schermen)
    const r=await fetch('/api/export',{headers:{'x-auth-token':TOKEN}});if(!r.ok)return toast('Export mislukt','error');
    const a=document.createElement('a');a.href=URL.createObjectURL(await r.blob());a.download='sporty-export.json';a.click();URL.revokeObjectURL(a.href);
  };
  $('nieuw').onclick=async()=>{
    const v=await locForm('Nieuwe locatie',{},'Aanmaken');if(!v)return;
    const r=await api('POST','/api/locaties',v);if(!r.ok)return toast(r.json.error||'Aanmaken mislukt','error');
    await api('PUT',`/api/locaties/${r.json.id}`,v); // sleutel, wifi, gemeente en ter plaatse kent de POST niet
    toast(`${v.name} aangemaakt`,'success');await laad();laadDetail(r.json.id);
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
