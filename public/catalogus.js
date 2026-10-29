// public/catalogus.js — MA2: Materiaal › Catalogus (design/mockup-materiaal-rest.html, scherm 3) op het kantoorpatroon.
// 3338 artikels: de server zoekt, filtert en pagineert (200 per keer, "meer laden" bij scrollen). Detail uit GET /api/catalogus/:id/detail.
// De HTML-bouwers (BOUW) zijn los van de browser, zodat de test ze met echte data-JSON kan aanroepen.
'use strict';
(function(){
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const getal=n=>n==null?'—':Number(n).toLocaleString('nl-BE');
  const knop=(id,t,licht)=>`<button class="knop ${licht===false?'':'licht'}" id="${id}">${t}</button>`;
  const BOUW={
    getal,
    rij(a,{sel,act}={}){
      const pil=a.status==='onder_min'?`<span class="pil rood">⚠ onder min. ${getal(a.minimum)}</span>`:a.status==='dubbel'?'<span class="pil oranje">mogelijk dubbel</span>':a.status==='ongebruikt'?'<span class="pil">niet gebruikt</span>':'<span class="pil groen">ok</span>';
      return `<div class="r ${act?'act':''}" data-id="${a.id}"><span><input type="checkbox" data-sel="${a.id}" ${sel?'checked':''} aria-label="Selecteer ${esc(a.naam)}"></span><span><b>${esc(a.naam)}</b></span><span>${esc(a.eenheid)}</span><span>${a.n_bakken} bak${a.n_bakken===1?'':'ken'}</span><span class="get">${getal(a.voorraad_rozenweg)}</span><span class="get">${getal(a.voorraad_kantoor)}</span><span>${pil}</span></div>`;
    },
    detail(D,tab,uitgeklapt){
      const {artikel:a,gebruik,voorraad,deze_periode:dp,dubbel,historiek}=D;
      uitgeklapt=uitgeklapt||{};
      const kv=(k,v)=>`<div class="kv"><span>${k}</span><b>${v}</b></div>`;
      const zicht=uitgeklapt.bakken?gebruik:gebruik.slice(0,3);
      const blokGebruik=`<div class="blok"><h4>In bakken ${gebruik.length} <a href="/bakken">alles in Bakken ›</a></h4>${zicht.map(g=>`<div class="rij"><span class="code">${esc(g.code||'—')}</span><div class="nm">${esc(g.bak)}<b>${esc((g.themas.slice(0,2).join(', ')||'zonder thema')+' · per bak '+getal(g.per_bak))}</b></div><a class="knop licht klein" href="/bakken?id=${g.bak_id}">Open</a></div>`).join('')||'<div class="rij"><div class="nm">In geen enkele bak</div></div>'}${gebruik.length>3&&!uitgeklapt.bakken?`<div class="rij"><div class="nm" style="color:#64748b;font-weight:500;cursor:pointer" data-meer="bakken">+ ${gebruik.length-3} andere bakken</div></div>`:''}</div>`;
      const blokVoorraad=`<div class="blok"><h4>Voorraad per stockage</h4>${voorraad.map(v=>`<div class="rij"><div class="nm">${esc(v.naam)}<b>${v.minimum!=null?'minimum '+getal(v.minimum):'geen minimum'}</b></div><span class="stap"><button data-stap="${v.locatie_id}:-1" aria-label="Eén minder">−</button><span class="getal" data-zet="${v.locatie_id}" style="cursor:pointer" title="Klik om een aantal in te vullen">${getal(v.qty)}</span><button data-stap="${v.locatie_id}:1" aria-label="Eén meer">+</button></span><button class="knop licht klein" data-min="${v.locatie_id}">Min.</button></div>`).join('')||'<div class="rij"><div class="nm">Geen stockages</div></div>'}</div>`;
      const blokPeriode=`<div class="blok"><h4>Deze periode</h4>${kv('Nodig',dp.bakken?`${dp.bakken} bak${dp.bakken===1?'':'ken'} op ${dp.locaties} locatie${dp.locaties===1?'':'s'} · ±${getal(dp.stuks)} stuks`:'niet nodig in deze periode')}${kv('Tekorten',dp.open_tekorten?`${dp.open_tekorten} open tekort${dp.open_tekorten===1?'':'ten'}`:'geen open tekort')}${kv('Laatst besteld',dp.laatst_besteld||'—')}</div>`;
      const blokDubbel=dubbel.length?`<div class="blok"><h4>Mogelijk dubbel</h4>${dubbel.map(d=>`<div class="rij"><div class="nm">${esc(d.naam)}<b>${d.n_bakken} bak${d.n_bakken===1?'':'ken'}${d.voorraad_tekst?' · '+esc(d.voorraad_tekst):''}</b></div><button class="knop licht klein" data-hierin="${d.id}">Samenvoegen hierin</button></div>`).join('')}</div>`:'';
      const blokHist=`<div class="blok"><h4>Historiek (alles gelogd)</h4>${historiek.slice(0,tab==='historiek'?100:5).map(h=>`<div class="rij"><div class="nm">${esc(h.wat)}<b>${esc([h.t,h.wie].filter(Boolean).join(' · '))}</b></div><button class="knop licht klein" disabled title="Terugdraaien bestaat nog niet als route (GEVONDEN)">↶ Terug</button></div>`).join('')||'<div class="rij"><div class="nm">Nog niets gelogd</div></div>'}</div>`;
      const inhoud={gebruik:blokGebruik+blokVoorraad+blokPeriode+blokDubbel,voorraad:blokVoorraad,historiek:blokHist}[tab]||'';
      return `<a class="terug" data-act="terug">‹ terug naar de lijst</a><div class="dkop"><div><h2>${esc(a.naam)}</h2><span>Artikel · ${a.sport?'sport':'materiaal'} · eenheid ${esc(a.eenheid)} · in ${gebruik.length} bak${gebruik.length===1?'':'ken'}</span></div><div class="acts">${knop('d-bewerk','Bewerken')}${knop('d-samen','Samenvoegen met…')}<button class="knop" id="d-bestel" disabled title="Er is nog geen route om een artikel los te bestellen (GEVONDEN MA2)">Bestellen</button></div></div>
        <div class="dtabs">${[['gebruik','Gebruik'],['voorraad','Voorraad'],['historiek',`Historiek ${historiek.length}`]].map(([k,x])=>`<a class="${tab===k?'act':''}" data-tab="${k}">${x}</a>`).join('')}</div>
        <div class="dgrid"${tab==='gebruik'?'':' style="grid-template-columns:1fr"'}>${inhoud}</div>`;
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
  let T={alle:0,materiaal:0,sport:0,onder_min:0,dubbel:0,ongebruikt:0},ITEMS=[],TOT=0,MEER=false,LAADT=false,D=null,SEL=new Map(),FILTER='alle',ZOEK='',TAB='gebruik',UIT={},TIMER=null;

  async function laad(reset=true){
    if(LAADT)return;LAADT=true;
    const offset=reset?0:ITEMS.length;
    const r=await api('GET',`/api/catalogus-overzicht?chip=${FILTER}&zoek=${encodeURIComponent(ZOEK)}&offset=${offset}`);
    LAADT=false;
    if(r.status===401||r.status===403){location.href='/';return;}
    if(!r.ok)return toast(r.json.error||'Catalogus laden mislukt','error');
    T=r.json.tellers;TOT=r.json.totaal_gefilterd;MEER=r.json.meer;ITEMS=reset?r.json.artikels:ITEMS.concat(r.json.artikels);tekenLijst(reset);
  }
  function tekenLijst(){
    document.querySelectorAll('.chip').forEach(c=>{c.classList.toggle('act',c.dataset.f===FILTER);c.querySelector('b').textContent=getal(T[c.dataset.f]);});
    $('lijst').innerHTML=(ITEMS.length?ITEMS.map(x=>BOUW.rij(x,{sel:SEL.has(x.id),act:D&&D.artikel.id===x.id})).join(''):'<div class="leeg">Geen artikels voor deze filter</div>')+(MEER?'<div class="laadmeer">meer laden…</div>':'');
    $('n-tot').textContent=`${getal(TOT)} artikelen`;$('n-sel').textContent=`${SEL.size} geselecteerd`;$('voet').classList.toggle('sel',SEL.size>0);$('alles').checked=ITEMS.length>0&&ITEMS.every(x=>SEL.has(x.id));
  }
  async function laadDetail(id,stil){
    const r=await api('GET',`/api/catalogus/${id}/detail`);
    if(!r.ok){D=null;$('detail').innerHTML='<div class="leegd">Klik een artikel in de lijst voor het detail.</div>';return toast(r.json.error||'Detail laden mislukt','error');}
    D=r.json;teken();document.querySelectorAll('.r[data-id]').forEach(x=>x.classList.toggle('act',+x.dataset.id===id));
    if(!stil)$('body').classList.add('toon-detail');
  }
  function teken(){$('detail').innerHTML=BOUW.detail(D,TAB,UIT);}
  async function herlaad(){const behoud=ITEMS.length;await laad(true);while(MEER&&ITEMS.length<behoud)await laad(false);if(D)await laadDetail(D.artikel.id,true);}
  function csv(lijst,naam){
    const kol=['naam','eenheid','categorie','n_bakken','voorraad_rozenweg','voorraad_kantoor','status'];
    const tekst=[kol.join(';'),...lijst.map(t=>kol.map(k=>`"${String(t[k]??'').replace(/"/g,'""')}"`).join(';'))].join('\r\n');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+tekst],{type:'text/csv'}));a.download=naam;a.click();URL.revokeObjectURL(a.href);
  }
  async function artikelForm(titel,a,ok){
    a=a||{};
    return vraag({titel,ok,html:`<label>Naam<input name="naam" value="${esc(a.naam||'')}"></label><label>Eenheid<input name="eenheid" value="${esc(a.eenheid||'stuk')}"></label><label>Categorie<input name="cat" value="${esc(a.categorie||'materiaal')}"></label>`,
      lees:f=>f.naam.value.trim()?{naam:f.naam.value.trim(),eenheid:f.eenheid.value.trim()||'stuk',categorie:f.cat.value.trim()}:(toast('Naam is verplicht','warn'),null)});
  }
  async function kiesArtikel(titel,ok,uitgesloten){
    return new Promise(resolve=>{
      const bg=document.createElement('div');bg.className='mbg';
      bg.innerHTML=`<div class="mbox" role="dialog" aria-modal="true"><h4>${esc(titel)}</h4><input id="kz-zoek" placeholder="🔍 Zoek artikel…"><div class="keuzes" id="kz-lijst"></div><div class="knoppen"><button type="button" class="knop licht" data-x="0">Annuleren</button><button type="button" class="knop" data-x="1">${esc(ok)}</button></div></div>`;
      let gekozen=null;const lijst=bg.querySelector('#kz-lijst');
      const toon=async()=>{const r=await api('GET','/api/catalogus-overzicht?limiet=30&zoek='+encodeURIComponent(bg.querySelector('#kz-zoek').value));
        lijst.innerHTML=r.json.artikels.filter(x=>x.id!==uitgesloten).map(x=>`<div data-k="${x.id}" class="${gekozen==x.id?'act':''}">${esc(x.naam)} <small>(${x.n_bakken} bakken)</small></div>`).join('')||'<div>Niets gevonden</div>';};
      lijst.onclick=e=>{const d=e.target.closest('[data-k]');if(!d)return;gekozen=+d.dataset.k;lijst.querySelectorAll('[data-k]').forEach(x=>x.classList.toggle('act',x===d));};
      bg.querySelector('#kz-zoek').oninput=toon;
      const sluit=v=>{bg.remove();resolve(v);};
      bg.querySelector('[data-x="0"]').onclick=()=>sluit(null);bg.querySelector('[data-x="1"]').onclick=()=>sluit(gekozen);
      bg.addEventListener('mousedown',e=>{if(e.target===bg)sluit(null);});
      document.body.appendChild(bg);toon();bg.querySelector('#kz-zoek').focus();
    });
  }
  async function samenvoegen(vanId,naarId,vanNaam,naarNaam){
    if(!await vraag({titel:`"${vanNaam}" samenvoegen in "${naarNaam}"?`,tekst:'Alle bakken, voorraad en themaregels van het eerste artikel gaan naar het tweede. Het eerste artikel verdwijnt. Dit staat in de historiek, maar kan niet automatisch teruggedraaid worden.',ok:'Samenvoegen'}))return false;
    const r=await api('POST',`/api/catalogus/${vanId}/samenvoegen`,{naar_id:naarId});
    if(!r.ok){toast(r.json.error||'Samenvoegen mislukt','error');return false;}
    toast(`Samengevoegd: ${r.json.bak_items} bakregels verplaatst`,'success');return true;
  }

  document.addEventListener('click',async e=>{
    const t=e.target;if(t.closest('.mbox'))return;
    if(t.matches('[data-sel]')){const id=+t.dataset.sel;if(t.checked)SEL.set(id,ITEMS.find(x=>x.id===id));else SEL.delete(id);return tekenLijst();}
    const chip=t.closest('.chip');if(chip){FILTER=chip.dataset.f;return laad(true);}
    const rij=t.closest('.r[data-id]');if(rij)return laadDetail(+rij.dataset.id);
    const tab=t.closest('[data-tab]');if(tab){TAB=tab.dataset.tab;return teken();}
    if(t.closest('[data-act="terug"]')){$('body').classList.remove('toon-detail');return;}
    const meer=t.closest('[data-meer]');if(meer){UIT[meer.dataset.meer]=true;return teken();}
    if(!D)return;const a=D.artikel;
    const stap=t.closest('[data-stap]');
    if(stap){const [loc,d]=stap.dataset.stap.split(':');const r=await api('PUT',`/api/catalogus/${a.id}/voorraad`,{locatie_id:+loc,delta:+d});if(!r.ok)return toast(r.json.error||'Opslaan mislukt','error');return herlaad();}
    const zet=t.closest('[data-zet]');
    if(zet){const v=await vraag({titel:`Voorraad ${a.naam}`,ok:'Opslaan',html:'<label>Aantal<input name="qty" type="number" min="0" step="any"></label>',lees:f=>f.qty.value!==''?{qty:+f.qty.value}:null});if(!v)return;
      const r=await api('PUT',`/api/catalogus/${a.id}/voorraad`,{locatie_id:+zet.dataset.zet,qty:v.qty});if(!r.ok)return toast(r.json.error||'Opslaan mislukt','error');return herlaad();}
    const mn=t.closest('[data-min]');
    if(mn){const v=await vraag({titel:`Minimum ${a.naam}`,ok:'Opslaan',html:'<label>Minimum (0 = geen)<input name="min" type="number" min="0" step="any"></label>',lees:f=>f.min.value!==''?{min:+f.min.value}:null});if(!v)return;
      const r=await api('PUT',`/api/catalogus/${a.id}/voorraad`,{locatie_id:+mn.dataset.min,minimum:v.min});if(!r.ok)return toast(r.json.error||'Opslaan mislukt','error');return herlaad();}
    if(t.id==='d-bewerk'){const v=await artikelForm(`${a.naam} bewerken`,a,'Opslaan');if(!v)return;const r=await api('PUT',`/api/catalogus/${a.id}`,v);if(!r.ok)return toast(r.json.error||'Opslaan mislukt','error');toast('Opgeslagen','success');return herlaad();}
    if(t.id==='d-samen'){const k=await kiesArtikel(`"${a.naam}" samenvoegen met…`,'Kies doelartikel',a.id);if(!k)return;
      const doel=(await api('GET',`/api/catalogus/${k}/detail`)).json.artikel;if(await samenvoegen(a.id,k,a.naam,doel.naam)){D=null;return herlaad();}return;}
    const hier=t.closest('[data-hierin]');
    if(hier){const d=D.dubbel.find(x=>x.id===+hier.dataset.hierin);if(await samenvoegen(d.id,a.id,d.naam,a.naam))return herlaad();}
  });
  $('lijst').addEventListener('scroll',()=>{const l=$('lijst');if(MEER&&!LAADT&&l.scrollTop+l.clientHeight>=l.scrollHeight-80)laad(false);});
  $('alles').onchange=e=>{ITEMS.forEach(x=>e.target.checked?SEL.set(x.id,x):SEL.delete(x.id));tekenLijst();};
  $('zoek').oninput=e=>{ZOEK=e.target.value.trim();clearTimeout(TIMER);TIMER=setTimeout(()=>laad(true),250);};
  $('export').onclick=async()=>{const r=await api('GET',`/api/catalogus-overzicht?chip=${FILTER}&zoek=${encodeURIComponent(ZOEK)}&limiet=500`);if(r.ok)csv(r.json.artikels,'catalogus.csv');};
  $('b-samen').onclick=async()=>{
    const gekozen=[...SEL.values()];if(gekozen.length<2)return toast('Selecteer minstens 2 artikels om samen te voegen','warn');
    const v=await vraag({titel:`${gekozen.length} artikels samenvoegen`,tekst:'Kies het artikel dat blijft bestaan; de andere gaan erin op.',ok:'Samenvoegen',html:`<label>Doelartikel<select name="naar">${gekozen.map(x=>`<option value="${x.id}">${esc(x.naam)}</option>`).join('')}</select></label>`,lees:f=>({naar:+f.naar.value})});if(!v)return;
    const r=await api('POST','/api/catalogus-overzicht/samenvoegen',{ids:gekozen.map(x=>x.id),naar_id:v.naar});if(!r.ok)return toast(r.json.error||'Samenvoegen mislukt','error');
    toast(`${r.json.samengevoegd} samengevoegd`,'success');SEL.clear();D=null;herlaad();
  };
  $('b-cat').onclick=async()=>{
    const v=await vraag({titel:`Categorie wijzigen (${SEL.size})`,ok:'Wijzigen',html:'<label>Categorie<input name="cat" value="materiaal"></label>',lees:f=>({categorie:f.cat.value.trim()})});if(!v)return;
    const r=await api('POST','/api/catalogus-overzicht/categorie',{ids:[...SEL.keys()],categorie:v.categorie});if(!r.ok)return toast(r.json.error||'Wijzigen mislukt','error');toast('Categorie gewijzigd','success');SEL.clear();herlaad();
  };
  $('b-weg').onclick=async()=>{
    if(!await vraag({titel:`${SEL.size} artikels verwijderen?`,tekst:'Een artikel dat in een bak, themaregel of voorraad voorkomt wordt niet verwijderd.',ok:'Verwijderen'}))return;
    let n=0;for(const id of [...SEL.keys()]){const r=await api('DELETE',`/api/catalogus-overzicht/${id}`);if(r.ok)n++;else toast(r.json.error||'Verwijderen mislukt','error');}
    if(n)toast(`${n} verwijderd`,'success');if(D&&SEL.has(D.artikel.id))D=null;SEL.clear();herlaad();
  };
  $('nieuw').onclick=async()=>{
    const v=await artikelForm('Nieuw artikel',{},'Aanmaken');if(!v)return;
    const r=await api('POST','/api/item-types',{naam:v.naam,eenheid:v.eenheid,categorie:v.categorie});if(!r.ok)return toast(r.json.error||'Aanmaken mislukt','error');
    toast(`${v.naam} aangemaakt`,'success');await herlaad();laadDetail(r.json.id);
  };
  async function kop(){
    const v=await api('GET','/api/vandaag');
    if(v.ok){const b=$('b-vandaag');if(b){b.textContent=v.json.beslissen.length;b.hidden=!v.json.beslissen.length;}$('per-naam').textContent=v.json.periode?v.json.periode.naam:'geen periode';$('wie').textContent=v.json.gebruiker.naam+' · kantoor';}
    const p=await api('GET','/api/periodes');if(!p.ok)return;
    const sel=$('per-kies');sel.innerHTML=p.json.map(x=>`<option value="${x.id}"${x.actief?' selected':''}>${esc(x.naam)}</option>`).join('');
    sel.onchange=async()=>{const a=await api('POST','/api/periodes/'+sel.value+'/activeer');if(!a.ok)return toast(a.json.error||'Periode wisselen mislukt','error');location.reload();};
  }
  (async()=>{await laad(true);const id=+Q.get('id');if(id)laadDetail(id);kop();})();
})();
