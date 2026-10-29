// public/pool.js — MA2: Materiaal › Pool (design/mockup-materiaal-rest.html, scherm 2) op het kantoorpatroon.
// Lijst uit GET /api/pool-overzicht, detail uit GET /api/pool/:soort/:id/detail; acties via /api/pool-overzicht/:soort/:id (gelogd).
// Poolstukken zijn per aantal (bulk), per stuk of sportpakketten met sets. De HTML-bouwers (BOUW) zijn los van de browser (testbaar).
'use strict';
(function(){
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const knop=(id,t,licht)=>`<button class="knop ${licht===false?'':'licht'}" id="${id}">${t}</button>`;
  const BOUW={
    rij(s,{sel,act}={}){
      const pil=s.tekort>0?`<span class="pil rood">⚠ ${s.tekort} te weinig</span>`:'<span class="pil groen">ok</span>';
      return `<div class="r ${act?'act':''}" data-key="${s.soort}:${s.id}"><span><input type="checkbox" data-sel="${s.soort}:${s.id}" ${sel?'checked':''} aria-label="Selecteer ${esc(s.naam)}"></span><span><b>${esc(s.naam)}</b></span><span><b>${s.totaal}</b></span><span class="k">${esc(s.waar_tekst)}</span><span>${s.nodig==null?'—':`<b>${esc(s.nodig_tekst)}</b>`}</span><span>${pil}</span></div>`;
    },
    detail(D,tab){
      const {stuk:s,spreiding,sets,gegevens,fotos,nodig,historiek}=D;
      const kv=(k,v)=>`<div class="kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>`;
      const sub=s.mode==='sport'?`Pool · sportpakket · ${s.totaal} set${s.totaal===1?'':'s'}`:`Pool · ${s.mode==='aantal'?'per aantal':'per stuk'} · ${s.totaal} stuks`;
      const blokSpreiding=`<div class="blok"><h4>Waar staan ze nu (${s.totaal})</h4>${spreiding.map(r=>`<div class="rij"><div class="nm">${esc(r.naam)}<b>${esc(r.sub)}</b></div><span class="getal">${r.aantal}</span></div>`).join('')||'<div class="rij"><div class="nm">Geen exemplaren</div></div>'}</div>`;
      const perWeek={};nodig.rijen.forEach(r=>{(perWeek[r.week]=perWeek[r.week]||0);perWeek[r.week]+=r.aantal;});
      const max=Math.max(0,...Object.values(perWeek));
      const pct=s.totaal>0?Math.min(100,Math.round(100*max/s.totaal)):(max?100:0);
      const blokNodig=`<div class="blok"><h4>Nodig deze periode (${max} van ${s.totaal})</h4>${nodig.rijen.map(r=>`<div class="rij"><div class="nm">wk ${r.week} · ${esc(r.locatie)}<b>${esc([r.bron,r.kv?'KV '+r.kv.replace(/^KV\s+/i,''):''].filter(Boolean).join(' · '))}</b></div><span class="getal">${r.aantal}</span></div>`).join('')||`<div class="rij"><div class="nm">${s.nodig==null?'Niet vastgelegd in thema’s of locatieconfig':'Niet nodig in deze periode'}</div></div>`}<div class="rij" style="gap:8px"><span style="font-size:12px;color:#64748b;width:110px">bezetting</span><div class="balk ${max>s.totaal?'op':''}"><i style="width:${pct}%"></i></div><b style="font-size:12px">${max}/${s.totaal}</b></div></div>`;
      const blokSets=sets.length?`<div class="blok vol"><h4>Sets en weken</h4>${sets.map(x=>`<div class="rij"><span class="code">${esc(x.label)}</span><div class="nm">${esc(x.locatie)}<b>${x.weken.length?x.weken.map(w=>`wk ${w.week} ${esc(w.locatie)}`).join(' · '):'niet ingepland deze periode'}</b></div><a class="knop licht klein" href="${x.weken[0]&&x.weken[0].kampmoment_id?'/kampmomenten?id='+x.weken[0].kampmoment_id:'/kampmomenten'}">Inplannen</a></div>`).join('')}</div>`:'';
      const blokGeg=`<div class="blok"><h4>Gegevens</h4>${gegevens.map(g=>kv(g.k,g.v)).join('')}</div>`;
      const blokFotos=`<div class="blok"><h4>Foto's</h4><div class="fotos">${fotos.map(f=>`<div class="f" style="background-image:url('${esc(f.url)}')">${esc(f.label)}</div>`).join('')}${D.kan_foto?'<label class="f plus">+ foto<input type="file" accept="image/*" id="foto-in" hidden></label>':''}</div></div>`;
      const blokHist=`<div class="blok"><h4>Historiek (alles gelogd)</h4>${historiek.slice(0,tab==='historiek'?100:5).map(h=>`<div class="rij"><div class="nm">${esc(h.wat)}<b>${esc([h.t,h.wie].filter(Boolean).join(' · '))}</b></div><button class="knop licht klein" disabled title="Terugdraaien bestaat nog niet als route (GEVONDEN)">↶ Terug</button></div>`).join('')||'<div class="rij"><div class="nm">Nog niets gelogd</div></div>'}</div>`;
      const inhoud={spreiding:blokSpreiding+blokNodig+blokSets+blokGeg+blokFotos,fotos:blokFotos,historiek:blokHist}[tab]||'';
      return `<a class="terug" data-act="terug">‹ terug naar de lijst</a><div class="dkop"><div><h2>${esc(s.naam)}</h2><span>${esc(sub)}</span></div><div class="acts">${knop('d-bewerk','Bewerken')}<button class="knop licht" id="d-etiket" ${D.bak_ids.length?'':'disabled title="Etiketten bestaan enkel voor vaste bakken"'}>🖨 Etiket</button>${s.mode==='sport'?'<button class="knop" id="d-verplaats" disabled title="Sportsets worden per week toegewezen">Verplaatsen</button>':knop('d-verplaats','Verplaatsen',false)}</div></div>
        <div class="dtabs">${[['spreiding','Spreiding'],['fotos',`Foto’s ${fotos.length}`],['historiek',`Historiek ${historiek.length}`]].map(([k,x])=>`<a class="${tab===k?'act':''}" data-tab="${k}">${x}</a>`).join('')}</div>
        <div class="dgrid"${tab==='spreiding'?'':' style="grid-template-columns:1fr"'}>${inhoud}</div>`;
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
  let O=null,D=null,SEL=new Set(),FILTER='alle',ZOEK='',TAB='spreiding';
  const FILTERS={alle:()=>true,per_aantal:s=>s.mode==='aantal',per_stuk:s=>s.mode==='stuk',sport:s=>s.mode==='sport',op_locatie:s=>s.op_locatie,te_weinig:s=>s.tekort>0};
  const zichtbaar=()=>O.stukken.filter(FILTERS[FILTER]).filter(s=>!ZOEK||s.zoek.includes(ZOEK));
  const sleutel=s=>`${s.soort}:${s.id}`;

  async function laad(){
    const r=await api('GET','/api/pool-overzicht');
    if(r.status===401||r.status===403){location.href='/';return;}
    if(!r.ok)return toast(r.json.error||'Pool laden mislukt','error');
    O=r.json;SEL=new Set([...SEL].filter(k=>O.stukken.some(s=>sleutel(s)===k)));tekenLijst();if(D)await laadDetail(sleutel(D.stuk),true);
  }
  function tekenLijst(){
    document.querySelectorAll('.chip').forEach(c=>{c.classList.toggle('act',c.dataset.f===FILTER);c.querySelector('b').textContent=O.tellers[c.dataset.f];});
    const l=zichtbaar();
    $('lijst').innerHTML=l.length?l.map(x=>BOUW.rij(x,{sel:SEL.has(sleutel(x)),act:D&&sleutel(D.stuk)===sleutel(x)})).join(''):'<div class="leeg">Geen poolstukken voor deze filter</div>';
    $('n-tot').textContent=`${l.length} poolstukken`;$('n-sel').textContent=`${SEL.size} geselecteerd`;$('voet').classList.toggle('sel',SEL.size>0);$('alles').checked=l.length>0&&l.every(x=>SEL.has(sleutel(x)));
  }
  async function laadDetail(key,stil){
    const [soort,id]=key.split(':');
    const r=await api('GET',`/api/pool/${soort}/${id}/detail`);
    if(!r.ok){D=null;$('detail').innerHTML='<div class="leegd">Klik een poolstuk in de lijst voor het detail.</div>';return toast(r.json.error||'Detail laden mislukt','error');}
    D=r.json;teken();document.querySelectorAll('.r[data-key]').forEach(x=>x.classList.toggle('act',x.dataset.key===key));
    if(!stil)$('body').classList.add('toon-detail');
  }
  function teken(){$('detail').innerHTML=BOUW.detail(D,TAB);const fi=$('foto-in');if(fi)fi.onchange=()=>foto(fi.files[0]);}
  async function foto(bestand){
    if(!bestand)return;
    const data=await new Promise((ok,nok)=>{const fr=new FileReader();fr.onload=()=>ok(fr.result);fr.onerror=nok;fr.readAsDataURL(bestand);});
    const slot=D.fotos.some(f=>f.label==='opgeplooid')?'opgezet':'opgeplooid';
    const r=await api('POST',`/api/vaste-bakken/${D.stuk.id}/foto-slot`,{slot,foto_data:data});
    if(!r.ok)return toast(r.json.error||'Foto bewaren mislukt','error');toast('Foto bewaard','success');laad();
  }
  function csv(lijst,naam){
    const kol=['naam','type','totaal','waar_tekst','nodig','tekort'];
    const tekst=[kol.join(';'),...lijst.map(t=>kol.map(k=>`"${String(t[k]??'').replace(/"/g,'""')}"`).join(';'))].join('\r\n');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+tekst],{type:'text/csv'}));a.download=naam;a.click();URL.revokeObjectURL(a.href);
  }
  const gekozen=()=>O.stukken.filter(s=>SEL.has(sleutel(s)));
  function etiketten(lijst){
    const ids=lijst.filter(s=>s.soort==='vast').map(s=>'b'+s.id);
    if(!ids.length)return toast('Etiketten bestaan enkel voor vaste bakken','warn');
    window.open('/etiketten?ids='+ids.join(','),'_blank');
  }

  document.addEventListener('click',async e=>{
    const t=e.target;if(t.closest('.mbox'))return;
    if(t.matches('[data-sel]')){t.checked?SEL.add(t.dataset.sel):SEL.delete(t.dataset.sel);return tekenLijst();}
    const chip=t.closest('.chip');if(chip){FILTER=chip.dataset.f;return tekenLijst();}
    const rij=t.closest('.r[data-key]');if(rij)return laadDetail(rij.dataset.key);
    const tab=t.closest('[data-tab]');if(tab){TAB=tab.dataset.tab;return teken();}
    if(t.closest('[data-act="terug"]')){$('body').classList.remove('toon-detail');return;}
    if(!D)return;const s=D.stuk,pad=`/api/pool-overzicht/${s.soort}/${s.id}`;
    if(t.id==='d-etiket')return etiketten([s]);
    if(t.id==='d-bewerk'){
      const geg=D.gegevens.find(g=>g.k==='Notitie');
      const v=await vraag({titel:`${s.naam} bewerken`,ok:'Opslaan',html:`<label>Naam<input name="naam" value="${esc(s.naam)}"></label><label>Notitie<input name="notitie" value="${esc(geg&&geg.v!=='—'?geg.v:'')}"></label>`,
        lees:f=>f.naam.value.trim()?{naam:f.naam.value.trim(),notitie:f.notitie.value}:(toast('Naam is verplicht','warn'),null)});
      if(!v)return;const r=await api('PUT',pad,v);if(!r.ok)return toast(r.json.error||'Opslaan mislukt','error');toast('Opgeslagen','success');return laad();
    }
    if(t.id==='d-verplaats'){
      const locs=(await api('GET','/api/locaties-overzicht')).json.locaties||[];
      const van=D.spreiding.filter(x=>x.locatie_id);
      const v=await vraag({titel:`${s.naam} verplaatsen`,ok:'Verplaatsen',html:`<label>Van<select name="van">${van.map(x=>`<option value="${x.locatie_id}">${esc(x.naam)} (${x.aantal})</option>`).join('')}</select></label>
        <label>Naar<select name="naar">${locs.map(l=>`<option value="${l.id}">${esc(l.naam)}</option>`).join('')}</select></label><label>Aantal<input name="aantal" type="number" min="1" value="1"></label><label>Reden<input name="reden" placeholder="bv. extra voor week 2"></label>`,
        lees:f=>({van_locatie_id:+f.van.value,naar_locatie_id:+f.naar.value,aantal:+f.aantal.value||1,reden:f.reden.value})});
      if(!v)return;const r=await api('POST',pad+'/verplaats',v);if(!r.ok)return toast(r.json.error||'Verplaatsen mislukt','error');toast('Verplaatst','success');return laad();
    }
  });
  $('alles').onchange=e=>{zichtbaar().forEach(s=>e.target.checked?SEL.add(sleutel(s)):SEL.delete(sleutel(s)));tekenLijst();};
  $('zoek').oninput=e=>{ZOEK=e.target.value.trim().toLowerCase();tekenLijst();};
  $('b-export').onclick=()=>csv(gekozen(),'pool-selectie.csv');
  $('export').onclick=()=>csv(O.stukken,'pool.csv');
  $('b-etiket').onclick=()=>etiketten(gekozen());
  $('etiketten').onclick=()=>etiketten(O.stukken);
  $('b-weg').onclick=async()=>{
    if(!await vraag({titel:`${SEL.size} poolstukken verwijderen?`,tekst:'Een poolstuk dat ingepland is of op een locatie staat wordt niet verwijderd.',ok:'Verwijderen'}))return;
    let n=0;for(const s of gekozen()){const r=await api('DELETE',`/api/pool-overzicht/${s.soort}/${s.id}`);if(r.ok)n++;else toast(r.json.error||'Verwijderen mislukt','error');}
    if(n)toast(`${n} verwijderd`,'success');if(D&&SEL.has(sleutel(D.stuk)))D=null;SEL.clear();laad();
  };
  $('nieuw').onclick=()=>{location.href='/bakken';}; // een nieuw vast poolstuk maak je als vaste bak in Bakken
  async function kop(){
    const v=await api('GET','/api/vandaag');
    if(v.ok){const b=$('b-vandaag');if(b){b.textContent=v.json.beslissen.length;b.hidden=!v.json.beslissen.length;}$('per-naam').textContent=v.json.periode?v.json.periode.naam:'geen periode';$('wie').textContent=v.json.gebruiker.naam+' · kantoor';}
    const p=await api('GET','/api/periodes');if(!p.ok)return;
    const sel=$('per-kies');sel.innerHTML=p.json.map(x=>`<option value="${x.id}"${x.actief?' selected':''}>${esc(x.naam)}</option>`).join('');
    sel.onchange=async()=>{const a=await api('POST','/api/periodes/'+sel.value+'/activeer');if(!a.ok)return toast(a.json.error||'Periode wisselen mislukt','error');location.reload();};
  }
  (async()=>{await laad();const id=Q.get('id');if(id)laadDetail(id.includes(':')?id:'vast:'+id);kop();})();
})();
