// public/backup.js — BH2 punt 2: Beheer › Back-up & export (design/mockup-beheer.html, scherm 1).
// Lijst = 7 vaste rijen; gegevens uit GET /api/backups (nachtback-up + handmatige), GET /api/backup-inhoud (tellingen, grootte).
// Download nu = POST /api/backups/nu (kopie in de map) + download; terugzetten = eerst een back-up (server), het woord TERUGZETTEN, dan /api/herstel-db.
// De HTML-bouwers (BOUW) zijn los van de browser, zodat de test ze met echte data-JSON kan aanroepen.
'use strict';
(function(){
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const kv=(k,x)=>`<div class="kv"><span>${k}</span><b>${x}</b></div>`;
  const getal=n=>Number(n||0).toLocaleString('nl-BE');
  // "vannacht 03:00", "gisteren 03:00", "28/10 14:10", "2 dagen geleden"
  function wanneer(iso,nu){
    if(!iso)return '—';const d=new Date(iso),n=nu||new Date();if(isNaN(d))return '—';
    const uur=`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    const dag=x=>new Date(x.getFullYear(),x.getMonth(),x.getDate());const dd=Math.round((dag(n)-dag(d))/864e5);
    if(dd===0)return d.getHours()<7?`vannacht ${uur}`:`vandaag ${uur}`;if(dd===1)return `gisteren ${uur}`;
    return `${d.getDate()}/${String(d.getMonth()+1).padStart(2,'0')} ${uur}`;
  }
  const bTijd=b=>{if(b.gewijzigd)return b.gewijzigd;const [j,m,d]=b.datum.split('-').map(Number);const [u,mi]=(b.uur||'03:00').split(':').map(Number);return new Date(j,m-1,d,u,mi).toISOString();}; // echt tijdstip van het bestand (ook bij een back-up bij opstart)
  const RIJEN=[
    {id:'volledig',soort:'backup',naam:'Volledige back-up',sub:'alle gegevens als één databasebestand (.db)'},
    {id:'nacht',soort:'backup',naam:'Automatische nachtback-up',sub:B=>`elke nacht om ${B.uur} · ${B.bewaard} bewaard`},
    {id:'planning',soort:'export',naam:'Planning exporteren',sub:"kampmomenten, thema's, KV's · Excel"},
    {id:'materiaal',soort:'export',naam:'Materiaal exporteren',sub:'catalogus, bakken, pool, voorraad · Excel'},
    {id:'themas',soort:'export',naam:"Thema's exporteren",sub:"thema's + materiaal · JSON (om terug te importeren)"},
    {id:'import',soort:'import',naam:'Planning importeren',sub:'ingebouwde zomerplanning of eigen JSON-bestand'},
    {id:'terugzetten',soort:'backup',naam:'Back-up terugzetten',sub:'oude toestand herstellen uit een .db-bestand'}];
  const BOUW={
    RIJEN,wanneer,
    rijen(B,I,nu){
      const hand=B.backups.find(b=>b.soort==='handmatig'),laatst=hand?bTijd(hand):(B.backups[0]?bTijd(B.backups[0]):null);
      const info={
        volledig:{laatst:laatst?BOUW.relatief(laatst,nu):'nooit',stand:B.backups.length?'<span class="pil groen">ok</span>':''},
        nacht:{laatst:wanneer(B.laatst_nacht,nu),stand:B.fout?'<span class="pil rood">mislukt</span>':'<span class="pil groen">aan</span>'},
        planning:{laatst:'—',stand:''},materiaal:{laatst:'—',stand:''},themas:{laatst:'—',stand:''},
        import:{laatst:I.laatste_import?String(I.laatste_import).slice(0,5):'—',stand:''},
        terugzetten:{laatst:I.laatste_terugzetten?String(I.laatste_terugzetten).slice(0,10):'nooit',stand:'<span class="pil rood">gevaarlijk</span>'}};
      return RIJEN.map(r=>({...r,sub:typeof r.sub==='function'?r.sub(B):r.sub,...info[r.id]}));
    },
    relatief(iso,nu){const n=nu||new Date(),d=new Date(iso);const dd=Math.round((new Date(n.getFullYear(),n.getMonth(),n.getDate())-new Date(d.getFullYear(),d.getMonth(),d.getDate()))/864e5);return dd<=0?'vandaag':dd===1?'gisteren':`${dd} dagen geleden`;},
    chips(rs,f){const n=k=>k==='alles'?rs.length:rs.filter(r=>r.soort===k).length;return [['alles','Alles'],['backup','Back-up'],['export','Export'],['import','Import']].map(([k,t])=>`<span class="chip ${f===k?'act':''}" data-f="${k}">${t} ${n(k)}</span>`).join('');},
    rij(r,act){return `<div class="r ${act?'act':''}" data-id="${r.id}"><span></span><span><b>${esc(r.naam)}</b><span class="k" style="display:block">${esc(r.sub)}</span></span><span class="k">${esc(r.laatst)}</span><span>${r.stand}</span></div>`;},
    voet(I,B){return `<span>database ${esc(I.db_grootte_tekst)} · laatste wijziging ${esc(wanneer(I.laatste_wijziging))}${I.railway?' · Railway':''}</span>${B.fout?`<span class="rood">⚠ nachtback-up mislukt: ${esc(B.fout)}</span>`:''}`;},
    backupRij(b,nu){return `<div class="rij"><div class="nm">${esc(b.soort==='automatisch'?wanneer(bTijd(b),nu)+' · automatisch':wanneer(bTijd(b),nu)+' · '+(b.wie||'?')+' (handmatig)')}<b>${esc(b.naam)} · ${esc(b.grootte_tekst)}</b></div><button class="knop licht klein" data-dl="${esc(b.naam)}">Download</button></div>`;},
    detail(id,B,I,tab,nu){
      const inhoud=`<div class="blok"><h4>Wat zit erin</h4>${kv('Locaties',getal(I.locaties))}${kv("Thema's",getal(I.themas))}${kv('Bakken',getal(I.bakken))}${kv('Ritten',getal(I.ritten))}${kv('Personeel',getal(I.personeel))}${kv('Historiek',getal(I.wijzigingen)+' wijzigingen')}</div>`;
      const tip=t=>`<div class="blok vol"><h4>Tip</h4>${kv(t[0],t[1])}</div>`;
      const kop=(h,s,acts)=>`<a class="terug" data-act="terug">‹ terug naar de lijst</a><div class="dkop"><div><h2>${esc(h)}</h2><span>${esc(s)}</span></div><div class="acts">${acts||''}</div></div>`;
      const lijst=(n)=>B.backups.slice(0,n).map(b=>BOUW.backupRij(b,nu)).join('')||'<div class="rij"><div class="nm">Nog geen back-ups</div></div>';
      if(id==='volledig'){
        const tabs=`<div class="dtabs"><a class="${tab!=='eerder'?'act':''}" data-tab="backup">Back-up</a><a class="${tab==='eerder'?'act':''}" data-tab="eerder">Eerdere ${B.backups.length}</a></div>`;
        const body=tab==='eerder'?`<div class="dgrid" style="grid-template-columns:1fr"><div class="blok vol"><h4>Alle bewaarde back-ups (max. ${B.bewaard})</h4>${lijst(99)}</div></div>`
          :`<div class="dgrid"><div class="blok"><h4>Laatste back-ups</h4>${lijst(3)}</div>${inhoud}${tip(['Bewaren','download minstens één keer per week een back-up naar je eigen computer of Drive'])}</div>`;
        return kop('Volledige back-up',"Alle locaties, thema's, materiaal, planning, ritten, personeel en historiek in één bestand",'<button class="knop" data-act="nu">💾 Download nu</button>')+tabs+body;
      }
      if(id==='nacht')return kop('Automatische nachtback-up',`Elke nacht om ${B.uur} een kopie in de map backups; de laatste ${B.bewaard} blijven`,'<a class="knop licht" href="/instellingen?groep=tijden" style="display:inline-flex;align-items:center;text-decoration:none">Uur wijzigen</a>')
        +`<div class="dgrid"><div class="blok"><h4>Stand</h4>${kv('Laatste',esc(wanneer(B.laatst_nacht,nu)))}${kv('Volgende',esc(wanneer(B.volgende,nu)))}${kv('Bewaard',`${B.backups.filter(b=>b.soort==='automatisch').length} automatisch · ${B.backups.filter(b=>b.soort==='handmatig').length} handmatig`)}${B.fout?kv('Fout',`<span style="color:#b91c1c">${esc(B.fout)}</span>`):''}</div><div class="blok"><h4>Laatste back-ups</h4>${lijst(3)}</div>${tip(['Bij opstart','is de laatste nachtback-up ouder dan 24 uur, dan maakt de app er meteen één'])}</div>`;
      if(id==='planning')return kop('Planning exporteren',"Kampmomenten met locatie, week, thema's per groep en KV",'<button class="knop" data-act="exp-planning">⬇ Download (Excel/CSV)</button>')+`<div class="dgrid">${inhoud}${tip(['Excel','het bestand opent rechtstreeks in Excel (puntkomma, UTF-8)'])}</div>`;
      if(id==='materiaal')return kop('Materiaal exporteren','Catalogus, bakken, pool en voorraad','<button class="knop" data-act="exp-materiaal">⬇ Download (Excel/CSV)</button>')+`<div class="dgrid">${inhoud}${tip(['Excel','één bestand, één rij per bak of artikel'])}</div>`;
      if(id==='themas')return kop("Thema's exporteren","Thema's met materiaal, als JSON om later terug te importeren",'<button class="knop" data-act="exp-themas">⬇ Download (JSON)</button>')+`<div class="dgrid">${inhoud}${tip(['Terug','importeer het bestand via Planning importeren › Uit bestand'])}</div>`;
      if(id==='import')return kop('Planning importeren',"Thema's + materiaal uit de ingebouwde zomerplanning of uit een eigen JSON-bestand",'<button class="knop licht" data-act="imp-bestand">📂 Uit bestand</button><button class="knop" data-act="imp-ingebouwd">📋 Ingebouwde planning</button>')
        +`<div class="dgrid"><div class="blok vol"><h4>Hoe</h4>${kv('Bestaand',"thema's die al bestaan worden overgeslagen, dus opnieuw importeren is veilig")}${kv('Laatst',esc(I.laatste_import||'—'))}</div></div><input type="file" id="imp-file" accept=".json,application/json" hidden>`;
      return kop('Back-up terugzetten','Vervangt álle gegevens door een eerder .db-bestand','<button class="knop" style="background:#dc2626" data-act="terugzetten">Bestand kiezen…</button>')
        +`<div class="dgrid"><div class="blok"><h4>Zo gaat het</h4>${kv('1','de app maakt eerst een back-up van de huidige toestand')}${kv('2','je typt TERUGZETTEN om te bevestigen')}${kv('3','de database wordt vervangen en de app herstart')}</div><div class="blok"><h4>Laatste back-ups</h4>${lijst(3)}</div></div><input type="file" id="tz-file" accept=".db,application/octet-stream" hidden>`;
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
    setTimeout(()=>{t.style.transition='opacity .3s';t.style.opacity='0';setTimeout(()=>t.remove(),300);},type==='error'?6000:3000);
  }
  async function api(m,url,body){return window.sportyApi(m,url,body,{toast:x=>toast(x,'info'),token:TOKEN});}
  let B=null,I=null,SEL=new URLSearchParams(location.search).get('id')||'volledig',FILTER='alles',TAB='backup';
  async function laad(){
    const [b,i]=await Promise.all([api('GET','/api/backups'),api('GET','/api/backup-inhoud')]);
    if(b.status===401||b.status===403){location.href='/';return;}
    if(!b.ok||!i.ok)return toast((b.json.error||i.json.error)||'Laden mislukt','error');
    B=b.json;I=i.json;teken();
  }
  function teken(){
    const rs=BOUW.rijen(B,I);
    $('filters').innerHTML=BOUW.chips(rs,FILTER);
    $('lijst').innerHTML=rs.filter(r=>FILTER==='alles'||r.soort===FILTER).map(r=>BOUW.rij(r,r.id===SEL)).join('');
    $('voet').innerHTML=BOUW.voet(I,B);
    $('detail').innerHTML=BOUW.detail(SEL,B,I,TAB);
  }
  async function download(url,naam){
    const r=await fetch(url,{headers:{'x-auth-token':TOKEN}});if(!r.ok){let e={};try{e=await r.json();}catch(_){}return toast(e.error||'Download mislukt','error');}
    const a=document.createElement('a');a.href=URL.createObjectURL(await r.blob());a.download=naam;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  }
  const csv=(kol,rijen,naam)=>{const t=[kol,...rijen].map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(';')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+t],{type:'text/csv'}));a.download=naam;a.click();};
  const vandaag=()=>new Date().toISOString().slice(0,10);
  async function exportData(){const r=await api('GET','/api/export');if(!r.ok){toast(r.json.error||'Export mislukt','error');return null;}return r.json;}
  async function expPlanning(){
    const d=await exportData();if(!d)return;
    const loc=Object.fromEntries((d.locaties||[]).map(l=>[l.id,l.name])),th=Object.fromEntries((d.themas||[]).map(t=>[t.id,t.name])),pe=Object.fromEntries((d.personeel||[]).map(p=>[p.id,p.naam])),per=Object.fromEntries((d.vakantieperiodes||[]).map(p=>[p.id,p.naam]));
    const kt={};(d.kampmoment_themas||[]).forEach(x=>{(kt[x.kampmoment_id]=kt[x.kampmoment_id]||[]).push(`${x.leeftijdsgroep?x.leeftijdsgroep+': ':''}${th[x.thema_id]||'#'+x.thema_id}`);});
    const rijen=(d.kampmomenten||[]).sort((a,b)=>(a.periode_id-b.periode_id)||(a.week-b.week)).map(k=>[per[k.periode_id]||'',k.week,loc[k.locatie_id]||'',(kt[k.id]||[]).join(' · '),pe[k.kv_persoon_id]||'',k.type||'']);
    csv(['Periode','Week','Locatie',"Thema's",'KV','Soort'],rijen,`planning-${vandaag()}.csv`);toast(`${rijen.length} kampmomenten geëxporteerd`,'success');
  }
  async function expMateriaal(){
    const d=await exportData();if(!d)return;const loc=Object.fromEntries((d.locaties||[]).map(l=>[l.id,l.name]));
    const rijen=[...(d.bakken||[]).map(b=>['bak',b.naam,b.code||'',b.soort||'',b.vast_type||'',b.is_bulk?b.aantal:1,loc[b.huidige_locatie_id||b.thuislocatie_id]||'',b.status||'']),
      ...(d.item_types||[]).map(t=>['artikel',t.naam,'',t.categorie||'','',(d.item_type_stock||[]).filter(s=>s.item_type_id===t.id).reduce((n,s)=>n+(s.qty||0),0),'',''])];
    csv(['Soort','Naam','Code','Categorie','Pool-type','Aantal','Waar','Stand'],rijen,`materiaal-${vandaag()}.csv`);toast(`${rijen.length} rijen geëxporteerd`,'success');
  }
  async function expThemas(){
    const r=await api('GET','/api/themas');if(!r.ok)return toast(r.json.error||'Export mislukt','error');
    const themas=(r.json||[]).map(t=>({naam:t.name,leeftijdsgroep:t.leeftijdsgroep||'',color:t.color,materiaal:(t.materiaal||[]).map(m=>({naam:m.name,locatie:m.stockage_code||''}))}));
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({_meta:{bron:'export Sporty app',datum:vandaag(),aantal_themas:themas.length},themas},null,2)],{type:'application/json'}));a.download=`themas_${vandaag()}.json`;a.click();
    toast(`${themas.length} thema's geëxporteerd`,'success');
  }
  function bevestig(titel,tekst,woord){
    return new Promise(res=>{
      const bg=document.createElement('div');bg.className='mbg';
      bg.innerHTML=`<div class="mbox" role="dialog" aria-modal="true"><h4>${esc(titel)}</h4><p>${esc(tekst)}</p>${woord?`<div class="veld"><label>Typ ${esc(woord)}</label><input id="bv-woord" autocomplete="off"></div>`:''}<div class="knoppen" style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px"><button class="knop licht" data-x="0">Annuleren</button><button class="knop" data-x="1"${woord?' disabled':''}>Bevestigen</button></div></div>`;
      const ok=bg.querySelector('[data-x="1"]'),sluit=v=>{bg.remove();res(v);};
      if(woord)bg.querySelector('#bv-woord').oninput=e=>{ok.disabled=e.target.value.trim()!==woord;};
      bg.querySelector('[data-x="0"]').onclick=()=>sluit(false);ok.onclick=()=>sluit(true);
      document.body.appendChild(bg);(bg.querySelector('input')||ok).focus();
    });
  }
  async function terugzetten(file){
    if(!file)return;
    const buf=await file.arrayBuffer();
    if(new TextDecoder().decode(buf.slice(0,15))!=='SQLite format 3')return toast('Dit is geen geldig .db-bestand','error');
    if(!await bevestig('Back-up terugzetten?',`${file.name} vervangt ÁLLE huidige gegevens. De app maakt eerst automatisch een back-up van de huidige toestand en herstart daarna.`,'TERUGZETTEN'))return;
    const r=await fetch('/api/herstel-db',{method:'POST',headers:{'x-auth-token':TOKEN,'Content-Type':'application/octet-stream','x-bevestig':'TERUGZETTEN'},body:buf});
    let j={};try{j=await r.json();}catch(_){}
    if(!r.ok)return toast(j.error||'Terugzetten mislukt','error');
    toast('Teruggezet. De app herstart; de pagina laadt over een paar seconden opnieuw.','success');setTimeout(()=>location.reload(),6000);
  }
  async function importeer(body,url){
    const r=await api('POST',url,body);if(!r.ok||r.json.error)return toast(r.json.error||'Importeren mislukt','error');
    toast(`Klaar: ${r.json.aangemaakt??r.json.nieuw??''} thema's geïmporteerd`.replace(': ',': ').replace(/  /g,' '),'success');laad();
  }
  document.addEventListener('click',async e=>{
    const t=e.target;if(t.closest('.mbox'))return;
    const chip=t.closest('.chip[data-f]');if(chip){FILTER=chip.dataset.f;return teken();}
    const r=t.closest('.r[data-id]');if(r){SEL=r.dataset.id;TAB='backup';teken();$('body').classList.add('toon-detail');return;}
    const tab=t.closest('[data-tab]');if(tab){TAB=tab.dataset.tab;return teken();}
    const dl=t.closest('[data-dl]');if(dl)return download('/api/backups/'+encodeURIComponent(dl.dataset.dl),dl.dataset.dl);
    const a=(t.closest('[data-act]')||{}).dataset?.act;
    if(a==='terug'){$('body').classList.remove('toon-detail');return;}
    if(a==='nu'){const x=await api('POST','/api/backups/nu');if(!x.ok)return toast(x.json.error||'Back-up mislukt','error');await download('/api/backups/'+encodeURIComponent(x.json.naam),x.json.naam);toast(`Back-up ${x.json.naam} (${x.json.grootte_tekst}) gemaakt en bewaard`,'success');return laad();}
    if(a==='exp-planning')return expPlanning();if(a==='exp-materiaal')return expMateriaal();if(a==='exp-themas')return expThemas();
    if(a==='imp-ingebouwd'){const p=await api('GET','/api/import-themas/preview');if(!p.ok||p.json.error)return toast(p.json.error||'Voorbeeld laden mislukt','error');
      if(!p.json.nieuw)return toast(`Niets nieuw: alle ${p.json.totaal} thema's bestaan al`,'info');
      if(!await bevestig('Ingebouwde planning importeren?',`${p.json.nieuw} nieuwe thema's (${p.json.materiaalitems} materiaalitems); ${p.json.bestaat} bestaan al en worden overgeslagen.`))return;return importeer({},'/api/import-themas');}
    if(a==='imp-bestand'){const f=$('imp-file');f.value='';f.onchange=async()=>{const file=f.files[0];if(!file)return;let d;try{d=JSON.parse(await file.text());}catch(_){return toast('Ongeldig JSON-bestand','error');}
      const lijst=Array.isArray(d)?d:(d.themas||[]);if(!lijst.length)return toast("Geen thema's in dit bestand",'error');
      if(!await bevestig(`${file.name} importeren?`,`${lijst.length} thema's; thema's die al bestaan worden overgeslagen.`))return;importeer({themas:lijst},'/api/import-themas/data');};f.click();return;}
    if(a==='terugzetten'){const f=$('tz-file');f.value='';f.onchange=()=>terugzetten(f.files[0]);f.click();return;}
  });
  async function kop(){
    const v=await api('GET','/api/vandaag');
    if(v.ok){$('per-naam').textContent=v.json.periode?v.json.periode.naam:'geen periode';$('wie').textContent=v.json.gebruiker.naam+' · kantoor';}
    const p=await api('GET','/api/periodes');if(!p.ok)return;
    const sel=$('per-kies');sel.innerHTML=p.json.map(x=>`<option value="${x.id}"${x.actief?' selected':''}>${esc(x.naam)}</option>`).join('');
    sel.onchange=async()=>{const q=await api('POST','/api/periodes/'+sel.value+'/activeer');if(!q.ok)return toast(q.json.error||'Periode wisselen mislukt','error');location.reload();};
  }
  (async()=>{await laad();kop();})();
})();
