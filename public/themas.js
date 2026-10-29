// public/themas.js — MA2: Materiaal › Thema's (design/mockup-materiaal-rest.html, scherm 1) op het kantoorpatroon.
// Lijst uit GET /api/themas-overzicht, detail uit GET /api/themas/:id/detail; alle acties via /api/themas-overzicht/… (gelogd).
// De HTML-bouwers (BOUW) zijn los van de browser, zodat de test ze met echte data-JSON kan aanroepen.
'use strict';
(function(){
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const knop=(id,t,licht)=>`<button class="knop ${licht===false?'':'licht'}" id="${id}">${t}</button>`;
  // ── HTML-bouwers (geen DOM nodig) ──
  const BOUW={
    rij(t,{sel,act}={}){
      const pil=t.leeg?'<span class="pil rood">⚠ leeg</span>':t.status==='let'?`<span class="pil oranje">⚠ ${esc(t.aandacht[0])}</span>`:'<span class="pil groen">ok</span>';
      return `<div class="r ${act?'act':''}" data-id="${t.id}"><span><input type="checkbox" data-sel="${t.id}" ${sel?'checked':''} aria-label="Selecteer ${esc(t.naam)}"></span><span style="display:flex;gap:8px;align-items:center"><i class="kleur" style="background:${esc(t.kleur)}"></i><b>${esc(t.naam)}</b></span><span>${esc(t.soort_tekst)}</span><span class="k">${esc(t.inhoud_tekst)}</span><span>${t.periode_tekst==='—'?'—':`<b>${esc(t.periode_tekst)}</b>`}</span><span>${pil}</span></div>`;
    },
    detail(D,tab,uitgeklapt){
      const {thema:t,bakken,attributen,los,kampmomenten:kms,historiek}=D;
      uitgeklapt=uitgeklapt||{};
      const kv=(k,v)=>`<div class="kv"><span>${k}</span><b>${v}</b></div>`;
      const meer=(lijst,sleutel,woord)=>lijst.length>4&&!uitgeklapt[sleutel]?`<div class="rij"><div class="nm" style="color:#64748b;font-weight:500;cursor:pointer" data-meer="${sleutel}">+ ${lijst.length-4} andere ${woord}</div></div>`:'';
      const zicht=(lijst,sleutel)=>uitgeklapt[sleutel]?lijst:lijst.slice(0,4);
      const blokBakken=`<div class="blok"><h4>Bakken ${bakken.length} <a href="/bakken?thema=${t.id}">alles in Bakken ›</a></h4>${zicht(bakken,'bakken').map(b=>`<div class="rij"><span class="code">${esc(b.code||'—')}</span><div class="nm">${esc(b.naam)}<b>${b.n_stuks} stuks${b.waar?' · '+esc(b.waar):''}</b></div><a class="knop licht klein" href="/bakken?id=${b.id}">Open</a><button class="knop licht klein" data-ontkoppel="bak:${b.id}" aria-label="Ontkoppelen">✕</button></div>`).join('')||'<div class="rij"><div class="nm">Nog geen bakken</div></div>'}${meer(bakken,'bakken','bakken')}</div>`;
      const blokAttr=`<div class="blok"><h4>Attributen ${attributen.length} <a data-act="attr-koppel" style="cursor:pointer">+ attribuut</a></h4>${zicht(attributen,'attr').map(a=>`<div class="rij"><span class="code">${esc(a.code||'—')}</span><div class="nm">${esc(a.naam)}<b>${esc(a.waar)}</b></div><button class="knop licht klein" data-ontkoppel="attribuut:${a.id}" aria-label="Ontkoppelen">✕</button></div>`).join('')||'<div class="rij"><div class="nm">Nog geen attributen</div></div>'}${meer(attributen,'attr','attributen')}</div>`;
      const blokLos=`<div class="blok"><h4>Los materiaal en verbruik ${los.length} <a data-act="los-nieuw" style="cursor:pointer">+ regel</a></h4>${los.map(m=>`<div class="rij"><div class="nm">${esc(m.naam)}<b>${m.verbruik?'verbruik':'materiaal'}</b></div><span class="getal">${m.qty}</span><button class="knop licht klein" data-los-weg="${m.id}" aria-label="Verwijderen">✕</button></div>`).join('')||'<div class="rij"><div class="nm">Geen los materiaal</div></div>'}</div>`;
      const blokInst=`<div class="blok"><h4>Instellingen</h4>${kv('Soort',esc(`${t.categorie||'—'} · ${t.leeftijdsgroep||'alle leeftijden'}`))}${kv('Materiaal',esc(t.materiaal_tekst))}${kv('Kookactiviteit',t.kook?'ja':'nee')}${kv('Kleur',`<i class="kleur" style="background:${esc(t.kleur)};vertical-align:-2px"></i> ${esc(t.kleur_naam||t.kleur)} (planner en etiketten)`)}</div>`;
      const blokKm=`<div class="blok"><h4>Kampmomenten ${kms.length}</h4>${kms.map(k=>`<div class="rij"><div class="nm">${esc(k.periode)} · week ${k.week} · ${esc(k.locatie)}<b>${esc(k.kv_naam?'KV '+k.kv_naam.replace(/^KV\s+/i,''):'geen KV')}</b></div><a class="knop licht klein" href="/kampmomenten?id=${k.kampmoment_id}">Open</a></div>`).join('')||'<div class="rij"><div class="nm">Nog niet gepland</div></div>'}</div>`;
      const blokHist=`<div class="blok"><h4>Historiek (alles gelogd)</h4>${historiek.slice(0,tab==='historiek'?100:5).map(h=>`<div class="rij"><div class="nm">${esc(h.wat)}<b>${esc([h.t,h.wie].filter(Boolean).join(' · '))}</b></div><button class="knop licht klein" disabled title="Terugdraaien bestaat nog niet als route (GEVONDEN)">↶ Terug</button></div>`).join('')||'<div class="rij"><div class="nm">Nog niets gelogd</div></div>'}</div>`;
      const inhoud={inhoud:blokBakken+blokAttr+blokLos+blokInst,kampmomenten:blokKm,historiek:blokHist}[tab]||'';
      return `<a class="terug" data-act="terug">‹ terug naar de lijst</a><div class="dkop"><div><h2><i class="kleur" style="background:${esc(t.kleur)};width:18px;height:18px"></i>${esc(t.naam)}</h2><span>${esc(t.soort_tekst.replace(' · 🍳',''))} · ${esc(t.materiaal_tekst)} · ${t.kook?'met':'geen'} kookactiviteit</span></div><div class="acts">${knop('d-bewerk','Bewerken')}${knop('d-dup','Dupliceren')}${knop('d-koppel','+ Bak koppelen',false)}</div></div>
        <div class="dtabs">${[['inhoud','Inhoud'],['kampmomenten',`Kampmomenten ${kms.length}`],['historiek',`Historiek ${historiek.length}`]].map(([k,x])=>`<a class="${tab===k?'act':''}" data-tab="${k}">${x}</a>`).join('')}</div>
        <div class="dgrid"${tab==='inhoud'?'':' style="grid-template-columns:1fr"'}>${inhoud}</div>`;
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
  async function api(m,url,body){return window.sportyApi(m,url,body,{toast:x=>toast(x,'info'),token:TOKEN});}
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
  let O=null,D=null,SEL=new Set(),FILTER='alle',ZOEK='',TAB='inhoud',UIT={};
  const FILTERS={alle:()=>true,kamp:t=>t.categorie==='kamp',themadag:t=>t.categorie==='themadag',kleuters:t=>t.leeftijdsgroep==='kleuters',lager:t=>t.leeftijdsgroep==='lagere school',deze_periode:t=>t.gepland,leeg:t=>t.leeg};
  const zichtbaar=()=>O.themas.filter(FILTERS[FILTER]).filter(t=>!ZOEK||t.zoek.includes(ZOEK));

  async function laad(){
    const r=await api('GET','/api/themas-overzicht');
    if(r.status===401||r.status===403){location.href='/';return;}
    if(!r.ok)return toast(r.json.error||'Thema’s laden mislukt','error');
    O=r.json;SEL=new Set([...SEL].filter(id=>O.themas.some(t=>t.id===id)));tekenLijst();if(D)await laadDetail(D.thema.id,true);
  }
  function tekenLijst(){
    document.querySelectorAll('.chip').forEach(c=>{c.classList.toggle('act',c.dataset.f===FILTER);c.querySelector('b').textContent=O.tellers[c.dataset.f];});
    const l=zichtbaar();
    $('lijst').innerHTML=l.length?l.map(x=>BOUW.rij(x,{sel:SEL.has(x.id),act:D&&D.thema.id===x.id})).join(''):'<div class="leeg">Geen thema’s voor deze filter</div>';
    $('n-tot').textContent=`${l.length} thema’s`;$('n-sel').textContent=`${SEL.size} geselecteerd`;$('voet').classList.toggle('sel',SEL.size>0);$('alles').checked=l.length>0&&l.every(x=>SEL.has(x.id));
  }
  async function laadDetail(id,stil){
    const r=await api('GET',`/api/themas/${id}/detail`);
    if(!r.ok){D=null;$('detail').innerHTML='<div class="leegd">Klik een thema in de lijst voor het detail.</div>';return toast(r.json.error||'Detail laden mislukt','error');}
    D=r.json;teken();document.querySelectorAll('.r[data-id]').forEach(x=>x.classList.toggle('act',+x.dataset.id===id));
    if(!stil)$('body').classList.add('toon-detail');
  }
  function teken(){$('detail').innerHTML=BOUW.detail(D,TAB,UIT);}
  const KLEURKEUZE=[['#1D9E75','groen'],['#378ADD','blauw'],['#E8A33D','geel'],['#8E44AD','paars'],['#D85A30','oranje'],['#C0392B','rood'],['#0F766E','petrol'],['#DB2777','roze'],['#7C5C3B','bruin']];
  async function themaForm(titel,t,ok){
    t=t||{};
    return vraag({titel,ok,html:`<label>Naam<input name="naam" value="${esc(t.naam||'')}"></label>
      <label>Soort<select name="cat">${['kamp','themadag'].map(x=>`<option ${x===(t.categorie||'kamp')?'selected':''}>${x}</option>`).join('')}</select></label>
      <label>Leeftijdsgroep<select name="lg">${['kleuters','lagere school'].map(x=>`<option ${x===(t.leeftijdsgroep||'kleuters')?'selected':''}>${x}</option>`).join('')}</select></label>
      <label>Materiaaltype<select name="tt">${[['eigen_materiaal','eigen materiaal'],['eigen_standaard','standaardmateriaal']].map(([v,n])=>`<option value="${v}" ${v===(t.thema_type||'eigen_materiaal')?'selected':''}>${n}</option>`).join('')}</select></label>
      <label>Kleur<select name="kl">${KLEURKEUZE.map(([v,n])=>`<option value="${v}" ${v.toLowerCase()===String(t.kleur||'#1D9E75').toLowerCase()?'selected':''}>${n}</option>`).join('')}</select></label>
      <label class="chk"><input type="checkbox" name="kook" ${t.kook?'checked':''}> kookactiviteit</label>`,
      lees:f=>f.naam.value.trim()?{name:f.naam.value.trim(),categorie:f.cat.value,leeftijdsgroep:f.lg.value,thema_type:f.tt.value,color:f.kl.value,heeft_kookactiviteit:f.kook.checked}:(toast('Naam is verplicht','warn'),null)});
  }
  function csv(lijst,naam){
    const kol=['naam','categorie','leeftijdsgroep','n_bakken','n_attributen','n_los','periode_tekst'];
    const tekst=[kol.join(';'),...lijst.map(t=>kol.map(k=>`"${String(t[k]??'').replace(/"/g,'""')}"`).join(';'))].join('\r\n');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+tekst],{type:'text/csv'}));a.download=naam;a.click();URL.revokeObjectURL(a.href);
  }
  async function kiesUitLijst(titel,haal,ok){
    // overlay met zoekveld en klikbare resultaten; geeft het gekozen {soort,id} terug
    return new Promise(resolve=>{
      const bg=document.createElement('div');bg.className='mbg';
      bg.innerHTML=`<div class="mbox" role="dialog" aria-modal="true"><h4>${esc(titel)}</h4><input id="kz-zoek" placeholder="🔍 Zoek op naam of code…"><div class="keuzes" id="kz-lijst"></div><div class="knoppen"><button type="button" class="knop licht" data-x="0">Annuleren</button><button type="button" class="knop" data-x="1">${esc(ok)}</button></div></div>`;
      let gekozen=null;const lijst=bg.querySelector('#kz-lijst');
      const toon=async()=>{const items=await haal(bg.querySelector('#kz-zoek').value);lijst.innerHTML=items.map(i=>`<div data-k="${i.key}" class="${gekozen===i.key?'act':''}">${esc(i.tekst)}</div>`).join('')||'<div>Niets gevonden</div>';};
      lijst.onclick=e=>{const d=e.target.closest('[data-k]');if(!d)return;gekozen=d.dataset.k;lijst.querySelectorAll('[data-k]').forEach(x=>x.classList.toggle('act',x===d));};
      bg.querySelector('#kz-zoek').oninput=toon;
      const sluit=v=>{bg.remove();resolve(v);};
      bg.querySelector('[data-x="0"]').onclick=()=>sluit(null);bg.querySelector('[data-x="1"]').onclick=()=>sluit(gekozen);
      bg.addEventListener('mousedown',e=>{if(e.target===bg)sluit(null);});
      document.body.appendChild(bg);toon();bg.querySelector('#kz-zoek').focus();
    });
  }

  document.addEventListener('click',async e=>{
    const t=e.target;if(t.closest('.mbox'))return;
    if(t.matches('[data-sel]')){const id=+t.dataset.sel;t.checked?SEL.add(id):SEL.delete(id);return tekenLijst();}
    const chip=t.closest('.chip');if(chip){FILTER=chip.dataset.f;return tekenLijst();}
    const rij=t.closest('.r[data-id]');if(rij)return laadDetail(+rij.dataset.id);
    const tab=t.closest('[data-tab]');if(tab){TAB=tab.dataset.tab;return teken();}
    if(t.closest('[data-act="terug"]')){$('body').classList.remove('toon-detail');return;}
    const meer=t.closest('[data-meer]');if(meer){UIT[meer.dataset.meer]=true;return teken();}
    if(!D)return;const th=D.thema;
    if(t.id==='d-bewerk'){const v=await themaForm(`${th.naam} bewerken`,th,'Opslaan');if(!v)return;const r=await api('PUT',`/api/themas-overzicht/${th.id}`,v);if(!r.ok)return toast(r.json.error||'Opslaan mislukt','error');toast('Opgeslagen','success');return laad();}
    if(t.id==='d-dup'){const v=await vraag({titel:`${th.naam} dupliceren`,ok:'Dupliceren',html:`<label>Naam van de kopie<input name="naam" value="${esc(th.naam)} (kopie)"></label>`,lees:f=>f.naam.value.trim()?{naam:f.naam.value.trim()}:null});if(!v)return;
      const r=await api('POST',`/api/themas-overzicht/${th.id}/dupliceer`,v);if(!r.ok)return toast(r.json.error||'Dupliceren mislukt','error');toast(`"${r.json.naam}" aangemaakt`,'success');D=null;await laad();return laadDetail(r.json.id);}
    if(t.id==='d-koppel'){
      const k=await kiesUitLijst('Bak koppelen aan '+th.naam,async q=>(await api('GET','/api/bakken-zoek?q='+encodeURIComponent(q))).json.bakken.map(b=>({key:'bak:'+b.id,tekst:`${b.code||'—'} · ${b.naam}`})),'Koppelen');
      if(!k)return;const r=await api('POST',`/api/themas-overzicht/${th.id}/koppel`,{bak_id:+k.split(':')[1]});if(!r.ok)return toast(r.json.error||'Koppelen mislukt','error');toast('Bak gekoppeld','success');return laad();
    }
    if(t.closest('[data-act="attr-koppel"]')){
      const k=await kiesUitLijst('Attribuut koppelen aan '+th.naam,async q=>(await api('GET','/api/bakken-zoek?q='+encodeURIComponent(q))).json.attributen.map(a=>({key:'attr:'+a.id,tekst:`${a.code||'—'} · ${a.naam}`})),'Koppelen');
      if(!k)return;const r=await api('POST',`/api/themas-overzicht/${th.id}/koppel`,{attribuut_id:+k.split(':')[1]});if(!r.ok)return toast(r.json.error||'Koppelen mislukt','error');toast('Attribuut gekoppeld','success');return laad();
    }
    if(t.closest('[data-act="los-nieuw"]')){
      const v=await vraag({titel:'Los materiaal toevoegen',ok:'Toevoegen',html:'<label>Naam<input name="naam"></label><label>Aantal<input name="qty" type="number" min="1" value="1"></label><label class="chk"><input type="checkbox" name="verbruik"> verbruik (wordt opgebruikt)</label>',
        lees:f=>f.naam.value.trim()?{naam:f.naam.value.trim(),qty:+f.qty.value||1,verbruik:f.verbruik.checked}:(toast('Naam is verplicht','warn'),null)});
      if(!v)return;const r=await api('POST',`/api/themas-overzicht/${th.id}/los`,v);if(!r.ok)return toast(r.json.error||'Toevoegen mislukt','error');return laad();
    }
    const ont=t.closest('[data-ontkoppel]');
    if(ont){const [soort,ref]=ont.dataset.ontkoppel.split(':');if(!await vraag({titel:`Ontkoppelen van ${th.naam}?`,tekst:'De bak of het attribuut zelf blijft bestaan.',ok:'Ontkoppelen'}))return;
      const r=await api('DELETE',`/api/themas-overzicht/${th.id}/koppel/${soort}/${ref}`);if(!r.ok)return toast(r.json.error||'Ontkoppelen mislukt','error');return laad();}
    const lw=t.closest('[data-los-weg]');
    if(lw){const r=await api('DELETE',`/api/themas-overzicht/${th.id}/los/${lw.dataset.losWeg}`);if(!r.ok)return toast(r.json.error||'Verwijderen mislukt','error');return laad();}
  });
  $('alles').onchange=e=>{zichtbaar().forEach(t=>e.target.checked?SEL.add(t.id):SEL.delete(t.id));tekenLijst();};
  $('zoek').oninput=e=>{ZOEK=e.target.value.trim().toLowerCase();tekenLijst();};
  const gekozen=()=>O.themas.filter(t=>SEL.has(t.id));
  $('b-export').onclick=()=>csv(gekozen(),'themas-selectie.csv');
  $('b-soort').onclick=async()=>{
    const v=await vraag({titel:`Soort wijzigen (${SEL.size})`,ok:'Wijzigen',html:'<label>Soort<select name="cat"><option>kamp</option><option>themadag</option></select></label>',lees:f=>({categorie:f.cat.value})});if(!v)return;
    for(const t of gekozen()){const r=await api('PUT',`/api/themas-overzicht/${t.id}`,{categorie:v.categorie});if(!r.ok)toast(r.json.error||'Wijzigen mislukt','error');}
    toast('Soort gewijzigd','success');laad();
  };
  $('b-weg').onclick=async()=>{
    if(!await vraag({titel:`${SEL.size} thema’s verwijderen?`,tekst:'Een thema dat aan een kampmoment hangt wordt niet verwijderd.',ok:'Verwijderen'}))return;
    let n=0;for(const t of gekozen()){const r=await api('DELETE',`/api/themas-overzicht/${t.id}`);if(r.ok)n++;else toast(r.json.error||'Verwijderen mislukt','error');}
    if(n)toast(`${n} verwijderd`,'success');if(D&&SEL.has(D.thema.id))D=null;SEL.clear();laad();
  };
  $('export').onclick=()=>csv(O.themas,'themas.csv');
  $('nieuw').onclick=async()=>{
    const v=await themaForm('Nieuw thema',{},'Aanmaken');if(!v)return;
    const r=await api('POST','/api/themas',v);if(!r.ok)return toast(r.json.error||'Aanmaken mislukt','error');
    await api('PUT',`/api/themas-overzicht/${r.json.id}`,v);
    toast(`${v.name} aangemaakt`,'success');await laad();laadDetail(r.json.id);
  };
  async function kop(){
    const v=await api('GET','/api/vandaag');
    if(v.ok){const b=$('b-vandaag');if(b){b.textContent=v.json.beslissen.length;b.hidden=!v.json.beslissen.length;}$('per-naam').textContent=v.json.periode?v.json.periode.naam:'geen periode';$('wie').textContent=v.json.gebruiker.naam+' · kantoor';}
    const p=await api('GET','/api/periodes');if(!p.ok)return;
    const sel=$('per-kies');sel.innerHTML=p.json.map(x=>`<option value="${x.id}"${x.actief?' selected':''}>${esc(x.naam)}</option>`).join('');
    sel.onchange=async()=>{const a=await api('POST','/api/periodes/'+sel.value+'/activeer');if(!a.ok)return toast(a.json.error||'Periode wisselen mislukt','error');location.reload();};
  }
  (async()=>{await laad();const id=+Q.get('id');if(id)laadDetail(id);kop();})();
})();
