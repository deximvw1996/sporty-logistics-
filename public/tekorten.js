// public/tekorten.js — TB2: Voorraad & controles › Tekorten & bestellingen (design/mockup-tekorten.html) op het standaardpatroon.
// Lijst uit GET /api/tekorten-overzicht, detail uit GET /api/tekorten/:id/detail; acties via /api/tekorten/…. Keuren gebeurt in Nakijken:
// de chip "Te beslissen" linkt erheen. De HTML-bouwers zijn los van de browser, zodat de test ze met echte data-JSON kan aanroepen.
'use strict';
(function(){
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const fmt=n=>n==null?'—':(Math.round(n*100)/100).toLocaleString('nl-BE');
  const eenh=(n,e)=>fmt(n)+(e&&!/^stuk/.test(e)?' '+esc(e):'');
  const PIL={te_bestellen:['rood','te bestellen'],besteld:['blauw','📦 besteld'],binnen:['groen','binnen'],uit_voorraad:['paars','uit voorraad'],afgehandeld:['','afgehandeld']};
  const pil=s=>{const p=PIL[s]||['',s];return `<span class="pil ${p[0]}">${p[1]}</span>`;};
  const CHIPS=[['open','Open'],['te_beslissen','Te beslissen'],['te_bestellen','Te bestellen'],['besteld','Besteld'],['binnen','Binnen'],['afgehandeld','Afgehandeld']]; // "Uit voorraad" als 7e chip paste niet (gemeten: 11 px te breed op 1920)
  const BOUW={
    chips(tel,act){return CHIPS.map(([k,t])=>k==='te_beslissen'?`<a class="chip" href="/nakijken" title="Keuren gebeurt in Nakijken">${t} <b>${tel[k]||0}</b></a>`
      :`<span class="chip ${act===k?'act':''}" data-f="${k}">${t} <b>${tel[k]||0}</b></span>`).join('');},
    rij(a,{sel,act}={}){
      const sub=a.los?'bestelling zonder tekort':a.n_bakken===0?'losse melding of aanvraag':`${a.n_bakken} ${a.n_bakken===1?'bak':'bakken'}${a.n_locaties>1?' · '+a.n_locaties+' locaties':''}`;
      const v=a.voorraad,onder=v&&v.minimum&&v.rozenweg<v.minimum;
      const roz=!v?'—':`${fmt(v.rozenweg)}${onder?` <small style="color:#b91c1c">/${fmt(v.minimum)}</small>`:''}`;
      return `<div class="r ${act?'act':''}" data-id="${esc(a.artikel_id)}"><span><input type="checkbox" data-sel="${esc(a.artikel_id)}" ${sel?'checked':''} aria-label="Selecteer ${esc(a.naam)}"></span><span><b>${esc(a.naam)}</b><span class="k" style="display:block">${esc(sub)}</span></span><span class="get">${a.los?'—':eenh(a.tekort,a.eenheid)}</span><span class="k">${esc(a.waar_tekst||'—')}</span><span class="get">${roz}</span><span>${pil(a.stand)}${a.bestelling&&!a.bestelling.binnen_op&&a.bestelling.binnen_aantal>0?` <span class="k" style="display:block">${fmt(a.bestelling.binnen_aantal)} van ${fmt(a.bestelling.aantal)} binnen</span>`:''}${a.bestelling&&a.bestelling.extra&&!a.bestelling.binnen_op?' <span class="pil blauw" title="extra bestelling">📦</span>':''}</span></div>`;
    },
    detail(D,tab){
      const a=D.artikel,v=D.voorraad,b=D.bestelling;
      const kv=(k,x)=>`<div class="kv"><span>${k}</span><b>${x}</b></div>`;
      // De knop die het voorstel volgt is de blauwe (mockup: Bestellen blauw bij te bestellen).
      const blauw=a.stand_voorstel==='uit_voorraad'?'aanvul':'bestel';
      const acts=a.los?'':`<button class="knop ${blauw==='aanvul'?'':'licht'}" id="d-aanvul">Aanvullen uit voorraad</button><button class="knop licht" id="d-negeer">Negeren</button><button class="knop ${blauw==='bestel'?'':'licht'}" id="d-bestel">Bestelling plaatsen</button>`;
      const kopTekst=a.los?`Bestelling zonder tekort · ${eenh(b.aantal,a.eenheid)}${b.reden?' · '+esc(b.reden):''}`
        :`Tekort ${eenh(a.tekort,a.eenheid)} in ${a.n_bakken} ${a.n_bakken===1?'bak':'bakken'} · Rozenweg heeft ${v.rozenweg==null?'—':fmt(v.rozenweg)}${v.minimum?', minimum '+fmt(v.minimum):''}`;
      const tl=`<div class="blok vol"><h4>Stand</h4><div class="tl">${D.tijdlijn.map(s=>`<div class="${s.stand}">${esc(s.stap)}</div>`).join('')}</div></div>`;
      const waar=`<div class="blok"><h4>Waar ontbreekt het (${D.regels.length})</h4>${D.regels.map(r=>`<div class="rij"><span class="code">${esc(r.code||'—')}</span><div class="nm">${esc(r.bak||'')}<b>${esc([r.locatie,r.week?'wk '+r.week:'',r.kv?(/^kantoor$/.test(r.kv)?'kantoor':'KV '+r.kv.replace(/^KV\s+/i,'')):'',r.geteld!=null?`geteld ${fmt(r.geteld)} van ${fmt(r.gewenst)}`:'',r.notitie?'"'+r.notitie+'"':''].filter(Boolean).join(' · '))}${r.status!=='open'?' · '+esc(r.status):''}</b></div><span class="getal">${fmt(r.aantal)}</span></div>`).join('')||'<div class="rij"><div class="nm">Hangt niet aan een melding</div></div>'}</div>`;
      const vrd=`<div class="blok"><h4>Voorraad</h4>${kv('Rozenweg',v.rozenweg==null?'— (niet in de catalogus)':`${fmt(v.rozenweg)}${v.minimum?' · minimum '+fmt(v.minimum):''}`)}${kv('Kantoor',v.kantoor==null?'—':fmt(v.kantoor))}${a.los?'':kv('Na aanvullen',v.na_aanvullen==null?'—':`<span style="${v.onder_minimum?'color:#b91c1c':''}">${v.na_aanvullen<0?'⚠ te weinig: er ontbreekt '+fmt(-v.na_aanvullen):fmt(v.na_aanvullen)}${v.onder_minimum&&v.na_aanvullen>=0?' · onder minimum':''}</span>`)}${a.los?'':kv('Voorstel',esc(D.voorstel.tekst)+(a.stand_bron==='kantoor'?' · <span class="pil oranje">kantoor koos anders</span>':''))}</div>`;
      const best=`<div class="blok"><h4>Bestelling</h4>${b&&b.besteld_op?kv('Aantal',`${eenh(b.aantal,a.eenheid)}${b.extra?' (extra)':''}`)+kv('Waar kopen',esc(b.waar_kopen||'—'))+kv('Leveren aan',esc(b.leveren_aan||'Rozenweg'))+kv('Besteld',esc([b.besteld_op,b.besteld_door].filter(Boolean).join(' · ')))+(b.binnen_op?kv('Binnen',esc(b.binnen_op)):(b.binnen_aantal>0?kv('Binnen',esc(fmt(b.binnen_aantal)+' van '+fmt(b.aantal)+' binnen')):''))
        :kv('Aantal',a.stand==='uit_voorraad'?'— (uit voorraad; bestellen kan toch)':`voorstel ${eenh(a.bestel_voorstel,a.eenheid)}`)+kv('Leveren aan','Rozenweg')}<div class="stap3" style="margin-top:8px"><button class="knop klein" id="d-besteld">Besteld</button><button class="knop licht klein" id="d-binnen" ${b&&b.binnen_op?'disabled':''}>Bestelling binnen</button></div></div>`;
      const na=a.los?'':`<div class="blok"><h4>Na levering</h4>${kv('Aanvullijst',esc(D.na_levering.aanvullijst))}${kv('Rest',esc(D.na_levering.rest))}</div>`;
      const hist=`<div class="blok vol"><h4>Historiek (alles gelogd met naam)</h4>${D.historiek.map(h=>`<div class="rij"><div class="nm">${esc(h.wat)}<b>${esc([h.t,h.wie].filter(Boolean).join(' · '))}</b></div></div>`).join('')||'<div class="rij"><div class="nm">Nog niets gelogd</div></div>'}</div>`;
      const inhoud=tab==='historiek'?hist:tl+waar+vrd+best+na;
      const cat=a.item_type_id?`/catalogus?id=${a.item_type_id}`:'/catalogus';
      return `<button class="knop licht terug" id="d-terug">‹ terug</button><div class="dkop"><div><h2>${esc(a.naam)}</h2><span>${kopTekst}</span></div><div class="acts">${acts}</div></div>
        <div class="dtabs"><a class="${tab!=='historiek'?'act':''}" data-tab="tekort">Tekort</a><a href="${cat}" data-cat="1">Catalogus ›</a><a class="${tab==='historiek'?'act':''}" data-tab="historiek">Historiek ${D.historiek.length}</a></div>
        <div class="dgrid">${inhoud}</div>`;
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
  async function api(m,url,body){if(window.sportyApi)return window.sportyApi(m,url,body,{toast:x=>toast(x,'info'),token:TOKEN});const r=await fetch(url,{method:m,headers:{'Content-Type':'application/json','x-auth-token':TOKEN},body:body?JSON.stringify(body):undefined});const j=await r.json().catch(()=>({}));return {status:r.status,ok:r.ok,json:j};}
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
  let O=null,D=null,SEL=new Set(),FILTER='open',ZOEK='',TAB='tekort',ROL='kantoor';
  const FILTERS={open:a=>a.stand!=='afgehandeld',te_bestellen:a=>a.stand==='te_bestellen',besteld:a=>a.stand==='besteld',binnen:a=>a.stand==='binnen',uit_voorraad:a=>a.stand==='uit_voorraad',afgehandeld:a=>a.stand==='afgehandeld'};
  const zichtbaar=()=>O.artikels.filter(FILTERS[FILTER]).filter(a=>!ZOEK||a.zoek.includes(ZOEK));
  window.addEventListener('sporty-live',()=>laad()); // RT1
  async function laad(){
    const r=await api('GET','/api/tekorten-overzicht');
    if(r.status===401){location.href='/';return;}
    if(!r.ok){toast(r.json.error||'Tekorten laden mislukt','error');return;}
    O=r.json;SEL=new Set([...SEL].filter(id=>O.artikels.some(a=>a.artikel_id===id)));
    $('per-naam').textContent=O.periode?O.periode.naam:'geen periode';
    tekenLijst();if(D)await laadDetail(D.artikel.artikel_id,true);
    zonderArtikel();
  }
  // TF6: goedgekeurde KV-aanvragen waar het artikel nog niet van gekozen is.
  async function zonderArtikel(){
    let b=$('zonder-art');
    if(!b){b=document.createElement('div');b.id='zonder-art';b.style.cssText='margin:8px 12px;padding:10px 14px;border:1px solid #fcd34d;background:#fffbeb;border-radius:8px;font-size:14px;width:auto';const body=$('body');body.parentNode.insertBefore(b,body);} // TF8 G11: boven alles, volle breedte
    const r=await api('GET','/api/aanvragen/zonder-artikel');
    const l=r.ok&&Array.isArray(r.json)?r.json:[];window.__zonderArt=l;
    b.hidden=!l.length;
    b.innerHTML=l.length?`<b>Aanvragen zonder artikel (${l.length})</b> — goedgekeurd, maar welk artikel is het?`+l.map(a=>`<div style="display:flex;gap:8px;align-items:center;margin-top:6px"><span style="flex:1">${esc(a.tekst)}${a.locatie?' · '+esc(a.locatie):''}</span><button class="knop klein" data-kies-art="${a.id}">Kies artikel</button></div>`).join(''):'';
  }
  function tekenLijst(){
    $('chips').innerHTML=BOUW.chips(O.tellers,FILTER);
    const lijst=zichtbaar();
    $('lijst').innerHTML=lijst.map(a=>BOUW.rij(a,{sel:SEL.has(a.artikel_id),act:D&&D.artikel.artikel_id===a.artikel_id})).join('')||'<div class="leeg">Geen artikels in deze lijst</div>';
    $('n-art').textContent=FILTER==='open'?`${O.tellers.open} open tekorten`:`${lijst.length} artikels`;
    $('n-sel').textContent=`${SEL.size} geselecteerd`;$('voet').classList.toggle('sel',SEL.size>0);
    $('alles').checked=lijst.length>0&&lijst.every(a=>SEL.has(a.artikel_id));
    $('b-negeer').hidden=ROL!=='kantoor';
  }
  async function laadDetail(id,stil){
    const r=await api('GET',`/api/tekorten/${encodeURIComponent(id)}/detail`);
    if(!r.ok){if(!stil)toast(r.json.error||'Detail laden mislukt','error');D=null;$('detail').innerHTML='<div class="leegd">Klik een artikel in de lijst voor het detail.</div>';$('body').classList.remove('detail-open');return tekenLijst();}
    D=r.json;tekenDetail();tekenLijst();$('body').classList.add('detail-open');
    history.replaceState(null,'',`/tekorten?id=${encodeURIComponent(id)}`);
  }
  function tekenDetail(){$('detail').innerHTML=BOUW.detail(D,TAB);const n=$('d-negeer');if(n)n.hidden=ROL!=='kantoor';
    const c=document.querySelector('#detail [data-cat]');if(c&&ROL!=='kantoor')c.remove(); // TF6 G6: de Catalogus is voor kantoor; een kantoor krijgt geen dode link
  }
  const pad=(id,x)=>`/api/tekorten/${encodeURIComponent(id)}/${x}`;
  async function besteld(ids,a){
    const een=ids.length===1&&a;
    const v=await vraag({titel:een?`${a.naam} besteld`:`${ids.length} artikels besteld`,tekst:een&&a.stand==='uit_voorraad'?'Er is genoeg voorraad: dit wordt een extra aankoop. Het aanvullen blijft uit voorraad; de bestelling vult de voorraad bij.':'',ok:'Besteld',
      html:`${een?`<label>Aantal<input name="aantal" type="number" min="0" step="any" value="${esc((a.bestelling&&a.bestelling.aantal)||a.bestel_voorstel||a.tekort)}"></label>`:''}<label>Waar kopen<input name="waar" placeholder="bv. Action" value="${esc(een&&a.bestelling?a.bestelling.waar_kopen:'')}"></label>`,
      lees:f=>({aantal:f.aantal?f.aantal.value:undefined,waar_kopen:f.waar.value})});
    if(!v)return;
    const r=een?await api('POST',pad(ids[0],'besteld'),v):await api('POST','/api/tekorten/bulk/besteld',{artikel_ids:ids,waar_kopen:v.waar_kopen});
    klaar(r,'Besteld');
  }
  async function binnen(ids){
    let body={};
    if(ids.length===1){
      const a=O.artikels.find(x=>x.artikel_id===ids[0]),b=a&&a.bestelling;
      const totaal=b&&b.aantal?b.aantal:(a?a.bestel_voorstel||a.tekort:0),eerder=(b&&b.binnen_aantal)||0,rest=Math.max(0,totaal-eerder);
      const v=await vraag({titel:`${a?a.naam:'Bestelling'} binnen`,tekst:eerder>0?`Er is al ${fmt(eerder)} van ${fmt(totaal)} binnen. Hoeveel kwam er nu bij?`:`Besteld: ${fmt(totaal)}. Hoeveel is er nu binnen? Een deel mag ook; de rest blijft open staan.`,ok:'Bestelling binnen',
        html:`<label>Aantal binnen<input name="aantal" type="number" min="0" step="any" max="${esc(rest)}" value="${esc(rest)}"></label>`,
        lees:f=>{const n=parseFloat(f.aantal.value);if(!(n>0)){toast('Vul in hoeveel er binnen is','warn');return null;}return {aantal:n};}});
      if(!v)return;body=v;
    }
    const r=ids.length===1?await api('POST',pad(ids[0],'binnen'),body):await api('POST','/api/tekorten/bulk/binnen',{artikel_ids:ids});
    klaar(r,ids.length===1&&r.ok&&r.json.volledig===false?`${fmt(r.json.binnen)} van ${fmt(r.json.totaal)} binnen — voorraad Rozenweg verhoogd`:'Bestelling binnen — voorraad Rozenweg verhoogd');
  }
  async function negeren(ids){
    const v=await vraag({titel:`${ids.length===1?'Dit tekort':ids.length+' tekorten'} negeren?`,tekst:'De handelingen verdwijnen van de aanvullijst. Gelogd met je naam.',ok:'Negeren',html:'<label>Reden<input name="reden" placeholder="bv. nog genoeg in de bak"></label>',lees:f=>({reden:f.reden.value})});
    if(!v)return;
    const r=ids.length===1?await api('POST',pad(ids[0],'negeren'),v):await api('POST','/api/tekorten/bulk/negeren',{artikel_ids:ids,reden:v.reden});
    klaar(r,'Genegeerd');
  }
  async function stand(ids,s){
    const r=ids.length===1?await api('PUT',pad(ids[0],'stand'),{stand:s}):await api('POST','/api/tekorten/bulk/stand',{artikel_ids:ids,stand:s});
    klaar(r,s==='uit_voorraad'?'Aanvullen uit voorraad':'Op de bestellijst');
  }
  function klaar(r,tekst){
    if(!r.ok)return toast(r.json.error||'Mislukt','error');
    const f=r.json.fouten||[];
    if(f.length)toast(`${f.length} niet gelukt: ${f.map(x=>x.error).join(' · ')}`,'warn');else toast(tekst,'success');
    SEL.clear();laad();
  }
  async function catalogusKeuze(titel,ok,extra,voor={}){
    const c=await api('GET','/api/voorraad');const types=new Map();(c.ok?c.json:[]).forEach(x=>types.set(x.item_type_id,x.item_naam));
    const it=await api('GET','/api/item-types');(it.ok&&Array.isArray(it.json)?it.json:[]).forEach(x=>types.set(x.id,x.naam));
    const opties=[...types].sort((a,b)=>String(a[1]).localeCompare(String(b[1]))).map(([id,n])=>`<option value="${esc(n)}" data-id="${id}"></option>`).join('');
    return vraag({titel,ok,html:`<label>Artikel (uit de catalogus)<input name="art" list="tb-cat" placeholder="Typ om te zoeken" value="${esc(voor.naam||'')}"><datalist id="tb-cat">${opties}</datalist></label><label>Aantal<input name="aantal" type="number" min="0" step="any" value="${esc(voor.aantal||'')}"></label>${extra}`,
      lees:f=>{const n=f.art.value.trim(),o=[...f.querySelectorAll('#tb-cat option')].find(x=>x.value===n);
        if(!n){toast('Kies een artikel','warn');return null;}if(!(parseFloat(f.aantal.value)>0)){toast('Vul een aantal in','warn');return null;}
        const v={naam:n,item_type_id:o?+o.dataset.id:null,aantal:f.aantal.value};f.querySelectorAll('[data-veld]').forEach(x=>v[x.dataset.veld]=x.value);return v;}});
  }
  document.addEventListener('click',async e=>{
    const t=e.target;
    if(t.matches('[data-sel]')){const id=t.dataset.sel;t.checked?SEL.add(id):SEL.delete(id);return tekenLijst();}
    if(t.id==='alles'){zichtbaar().forEach(a=>t.checked?SEL.add(a.artikel_id):SEL.delete(a.artikel_id));return tekenLijst();}
    const kiesArt=t.closest('[data-kies-art]');
    if(kiesArt){const id=kiesArt.dataset.kiesArt;const aanv=(window.__zonderArt||[]).find(x=>String(x.id)===String(id))||{},mm=/^\s*(\d{1,4})\s*[×x]\s*(.*)$/i.exec(aanv.tekst||'');
      const v=await catalogusKeuze('Welk artikel is dit?','Koppelen','',{aantal:mm?mm[1]:'',naam:mm?mm[2]:(aanv.tekst||'')});if(!v)return;const r=await api('PUT','/api/aanvragen/'+id+'/artikel',{item_type_id:v.item_type_id,artikel:v.naam,aantal:v.aantal});if(!r.ok)return toast(r.json.error||'Koppelen mislukt','error');toast('Gekoppeld: '+(r.json.actie==='uit_pool'?'uit voorraad aanvullen':'te bestellen'),'success');return laad();}
    const chip=t.closest('.chip[data-f]');if(chip){FILTER=chip.dataset.f;return tekenLijst();}
    const rij=t.closest('.r[data-id]');if(rij){TAB='tekort';return laadDetail(rij.dataset.id);}
    const tab=t.closest('[data-tab]');if(tab){TAB=tab.dataset.tab;return tekenDetail();}
    if(t.closest('[data-cat]')&&!D.artikel.item_type_id){e.preventDefault();location.href='/catalogus';return;}
    if(t.id==='d-terug'){$('body').classList.remove('detail-open');return;}
    const ids=SEL.size?[...SEL]:[];
    const a=D&&D.artikel;
    if(t.id==='d-aanvul'){
      // TF8: melden mag, verbieden niet: is er te weinig voorraad, dan zegt het scherm hoeveel er ontbreekt en vraagt het of het toch moet.
      const v=D.voorraad,hier=(v.rozenweg||0)+(v.kantoor||0);
      if(hier<a.tekort&&!await vraag({titel:'Er is te weinig voorraad',tekst:`Er ligt ${fmt(hier)} in de stockage en je vult ${fmt(a.tekort)} aan: er ontbreekt ${fmt(a.tekort-hier)}. De voorraad komt dan op ${fmt(hier-a.tekort)}. Toch uit voorraad aanvullen?`,ok:'Toch aanvullen'}))return;
      return stand([a.artikel_id],'uit_voorraad');
    }
    if(t.id==='d-bestel')return besteld([a.artikel_id],a); // werkt altijd (aanvulling 30/10): bij uit voorraad = extra aankoop
    if(t.id==='d-besteld')return besteld([a.artikel_id],a);
    if(t.id==='d-binnen')return binnen([a.artikel_id]);
    if(t.id==='d-negeer')return negeren([a.artikel_id]);
    if(t.id==='b-lijst')return stand(ids,'te_bestellen');
    if(t.id==='b-besteld')return besteld(ids,ids.length===1?O.artikels.find(x=>x.artikel_id===ids[0]):null);
    if(t.id==='b-binnen')return binnen(ids);
    if(t.id==='b-negeer')return negeren(ids);
  });
  $('zoek').oninput=e=>{ZOEK=e.target.value.toLowerCase().trim();tekenLijst();};
  $('bestellijst').onclick=()=>window.open('/tekorten/bestellijst','_blank');
  $('export').onclick=()=>{
    const rijen=[['Artikel','Tekort','Eenheid','Waar','Rozenweg','Minimum','Stand','Bestelling','Waar kopen'],...zichtbaar().map(a=>[a.naam,a.tekort,a.eenheid,a.waar_tekst,a.voorraad?a.voorraad.rozenweg:'',a.voorraad?a.voorraad.minimum:'',a.stand,a.bestelling?a.bestelling.aantal:'',a.bestelling?a.bestelling.waar_kopen:''])];
    const csv='﻿'+rijen.map(r=>r.map(x=>{const s=String(x==null?'':x);return /[;"\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}).join(';')).join('\r\n');
    const l=document.createElement('a');l.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));l.download='tekorten.csv';l.click();
  };
  $('melden').onclick=async()=>{
    const v=await catalogusKeuze('Tekort melden','Melden',`<label>Bak (code, optioneel)<input data-veld="bak_code" placeholder="bv. N20"></label><label>Reden<input data-veld="reden" placeholder="bv. gezien bij bezoek"></label>`);
    if(!v)return;
    if(v.bak_code){const b=await api('GET','/api/alle-bakken');const bk=(b.ok?b.json:[]).flatMap(x=>x.bakken||[]).find(x=>(x.code||'').toLowerCase()===v.bak_code.toLowerCase());if(bk)v.bak_id=bk.id;else return toast('Bak '+v.bak_code+' niet gevonden','warn');}
    const r=await api('POST','/api/tekorten/melden',v);
    if(!r.ok)return toast(r.json.error||'Melden mislukt','error');toast('Tekort gemeld','success');await laad();if(r.json.artikel_id)laadDetail(r.json.artikel_id);
  };
  $('bestelling').onclick=async()=>{
    const v=await catalogusKeuze('Bestelling zonder tekort','Bestellen',`<label>Waar kopen<input data-veld="waar_kopen" placeholder="bv. Action"></label><label>Leveren aan<select data-veld="leveren_aan_id" id="tb-naar"></select></label><label>Reden<input data-veld="reden" placeholder="bv. voor het geval dat"></label>`);
    if(!v)return;
    const r=await api('POST','/api/tekorten/bestelling',v);
    if(!r.ok)return toast(r.json.error||'Bestellen mislukt','error');toast('Bestelling bewaard','success');await laad();laadDetail(r.json.artikel_id);
  };
  // "Leveren aan": de stockages (Rozenweg eerst) zodra het venster open is.
  new MutationObserver(async()=>{const s=document.getElementById('tb-naar');if(!s||s.dataset.v)return;s.dataset.v=1;
    const l=await api('GET','/api/locaties');const st=(l.ok?l.json:[]).filter(x=>x.type==='stockage'&&!x.parent_id).sort((a,b)=>(b.name==='Rozenweg')-(a.name==='Rozenweg'));
    s.innerHTML=st.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');}).observe(document.body,{childList:true});
  async function kop(){
    const w=await api('GET','/api/wie-ben-ik');
    if(w.ok){ROL=w.json.rol||(w.json.persoon&&w.json.persoon.rol)||'kantoor';const n=w.json.naam||(w.json.persoon&&w.json.persoon.naam)||'';$('wie').textContent=n+' · '+ROL;
      $('melden').hidden=ROL!=='kantoor';if(O)tekenLijst();if(D)tekenDetail();
      // TF8 G14: een kantoor heeft hier geen kantoorbalk: eigen terugknop naar Meer.
      if(ROL!=='kantoor'&&!document.getElementById('terug-meer')){const a2=document.createElement('a');a2.id='terug-meer';a2.href='/meer';a2.textContent='‹ Meer';a2.style.cssText='display:inline-flex;align-items:center;min-height:44px;padding:0 14px;font-weight:700;color:#1e3a8a;text-decoration:none';document.body.insertBefore(a2,document.body.firstChild);}}
  }
  (async()=>{await kop();await laad();const id=Q.get('id');if(id)laadDetail(id);})();
})();
