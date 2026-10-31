// public/instellingen.js — BH2 punt 3: Beheer › Instellingen (design/mockup-beheer.html, scherm 2).
// Lijst uit GET /api/instellingen, detail uit GET /api/instellingen/:groep; opslaan via PUT/POST/DELETE /api/instellingen/... (alles gelogd).
// De HTML-bouwers (BOUW) zijn los van de browser, zodat de test ze met echte data-JSON kan aanroepen.
'use strict';
(function(){
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const kv=(k,x)=>`<div class="kv"><span>${k}</span><b>${x}</b></div>`;
  const veld=(label,naam,waarde,extra)=>`<div class="veld"><label for="v-${naam}">${esc(label)}</label><input id="v-${naam}" name="${naam}" value="${esc(waarde||'')}"${extra||''}></div>`;
  const datum=s=>{const d=new Date(s+'T12:00:00');return `${['zo','ma','di','wo','do','vr','za'][d.getDay()]} ${d.getDate()}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;};
  const SUBTITEL={kantoor:'Zo kunnen KV’s, chauffeurs en kantoormedewerkers het kantoor bereiken',gesloten:'Feestdagen en sluitingen: voor heel Sporty of voor één locatie',stockage:'Waar het materiaal ligt tussen de kampen door',
    leeftijd:'De groepen in het rooster (KL1, LS1 …) komen hiervan',categorie:'Soorten thema’s (kamp, themadag …)',tijden:'Uren die de app als standaard gebruikt',app:'Versie, opslag en back-ups'};
  const BOUW={
    rij(g,act){const st=g.stand?(g.stand.soort?`<span class="pil ${g.stand.soort}">${esc(g.stand.tekst)}</span>`:esc(g.stand.tekst)):'';return `<div class="r ${act?'act':''}" data-id="${g.id}"><span></span><span><b>${esc(g.naam)}</b><span class="k" style="display:block">${esc(g.sub)}</span></span><span>${st}</span></div>`;},
    chips(O,f,zoek){return `<input id="zoek" placeholder="🔍 Zoek instelling…" value="${esc(zoek||'')}"><span class="chip ${f==='alles'?'act':''}" data-f="alles">Alles ${O.tellers.alles}</span><span class="chip ${f==='aandacht'?'act':''}" data-f="aandacht">⚠ Aandacht ${O.tellers.aandacht}</span>`;},
    detail(D,tab){
      const g=D.groep,d=D.data,id=g.id;
      const bewaar=['kantoor','tijden'].includes(id);
      const acts=bewaar?'<button class="knop licht" data-act="annuleer">Annuleren</button><button class="knop" data-act="opslaan">Opslaan</button>':'';
      const tabs=`<div class="dtabs"><a class="${tab!=='historiek'?'act':''}" data-tab="gegevens">Gegevens</a><a class="${tab==='historiek'?'act':''}" data-tab="historiek">Historiek ${D.historiek.length}</a></div>`;
      const kop=`<a class="terug" data-act="terug">‹ terug naar de lijst</a><div class="dkop"><div><h2>${esc(g.naam)}</h2><span>${esc(SUBTITEL[id]||'')}</span></div><div class="acts">${acts}</div></div>`;
      if(tab==='historiek')return kop+tabs+`<div class="dgrid" style="grid-template-columns:1fr"><div class="blok vol"><h4>Historiek (alles gelogd)</h4>${D.historiek.map(h=>`<div class="rij"><div class="nm">${esc(h.wat)}<b>${esc(h.t)}</b></div></div>`).join('')||'<div class="rij"><div class="nm">Nog niets gewijzigd</div></div>'}</div></div>`;
      let body='';
      if(id==='kantoor'){
        const tel=d.kantoor_telefoon;
        body=`<div class="blok"><h4>Contact</h4><form id="form" onsubmit="return false">${veld('Telefoon kantoor','kantoor_telefoon',tel,` placeholder="bv. 016 12 34 56" inputmode="tel"${tel?'':' class="let"'}`)}${veld('GSM permanentie','kantoor_gsm',d.kantoor_gsm,' inputmode="tel"')}${veld('E-mail','kantoor_email',d.kantoor_email,' type="email"')}</form></div>
          <div class="blok"><h4>Waar je het ziet</h4><div class="rij"><div class="nm"${tel?'':' style="color:#c2410c"'}>KV-pagina · blok "Kantoor"<b>${tel?'toont '+esc(tel):'nu verborgen: telefoon kantoor ontbreekt'}</b></div></div><div class="rij"><div class="nm">Rit-pagina chauffeur<b>knop "Bel kantoor"${tel?'':' (verborgen zolang het nummer ontbreekt)'}</b></div></div><div class="rij"><div class="nm">Aanvullijst (print)<b>onderaan</b></div></div></div>`;
      }else if(id==='gesloten'){
        const jaar=String(new Date().getFullYear());
        body=`<div class="blok vol"><h4>Toevoegen</h4><form id="form" class="naast" onsubmit="return false">${veld('Van','van','',' type="date"')}${veld('Tot (leeg = één dag)','tot','',' type="date"')}${veld('Reden','reden','',' placeholder="bv. nationale feestdag"')}<div class="veld"><label for="v-loc">Voor</label><select id="v-loc" name="locatie_id"><option value="">heel Sporty</option>${d.locaties.map(l=>`<option value="${l.id}">${esc(l.name)}</option>`).join('')}</select></div><button class="knop" data-act="gesloten-toe" style="margin-bottom:10px">+ Toevoegen</button></form></div>
          <div class="blok vol"><h4>Gesloten dagen (${d.dagen.filter(x=>x.datum.startsWith(jaar)).length} dit jaar)</h4>${d.dagen.map(x=>`<div class="rij"><div class="nm">${esc(datum(x.datum))}${x.reden?' · '+esc(x.reden):''}<b>${x.locatie?'alleen '+esc(x.locatie):'heel Sporty'}</b></div><button class="knop licht klein" data-gesl-weg="${x.id}" aria-label="Verwijderen">✕</button></div>`).join('')||'<div class="rij"><div class="nm">Geen gesloten dagen</div></div>'}</div>`;
      }else if(id==='stockage'){
        body=`<div class="blok vol"><h4>Stockagelocaties <a href="/locaties">Locaties ›</a></h4>${d.locaties.map(l=>`<div class="rij"><div class="nm">${esc(l.name)}<b>${l.bakken} bakken liggen hier</b></div><a class="knop licht klein" href="/locaties?id=${l.id}" style="display:inline-flex;align-items:center;text-decoration:none">Open</a></div>`).join('')||'<div class="rij"><div class="nm">Geen stockagelocaties</div></div>'}</div>`;
      }else if(id==='leeftijd'||id==='categorie'){
        body=`<div class="blok vol"><h4>Toevoegen</h4><form id="form" class="naast" onsubmit="return false">${veld('Naam','naam','')}<button class="knop" data-act="lijst-toe" style="margin-bottom:10px">+ Toevoegen</button></form></div>
          <div class="blok vol"><h4>${id==='leeftijd'?'Leeftijdsgroepen':'Thema-categorieën'} (${d.lijst.length})</h4>${d.lijst.map(x=>`<div class="rij"><div class="nm">${esc(x.naam)}<b>${x.gebruikt?`gebruikt ${x.gebruikt}×`:'niet gebruikt'}</b></div><button class="knop licht klein" data-hernoem="${esc(x.naam)}">Hernoemen</button><button class="knop licht klein" data-lijst-weg="${esc(x.naam)}"${x.gebruikt?' title="Wordt nog gebruikt"':''} aria-label="Verwijderen">✕</button></div>`).join('')}</div>`;
      }else if(id==='tijden'){
        body=`<div class="blok"><h4>Tijden</h4><form id="form" onsubmit="return false">${veld('Vertrek ritten','tijd_vertrek_ritten',d.tijd_vertrek_ritten,' type="time"')}${veld('Verhuis-avond (sport midden in de week)','tijd_verhuis_avond',d.tijd_verhuis_avond,' type="time"')}${veld('Nachtback-up','tijd_nachtbackup',d.tijd_nachtbackup,' type="time"')}</form></div>
          <div class="blok"><h4>Waar je het ziet</h4><div class="rij"><div class="nm">Ritplanning<b>standaard vertrekuur van een nieuwe rit</b></div></div><div class="rij"><div class="nm">Sportrooster<b>verhuistaak midden in de week</b></div></div><div class="rij"><div class="nm">Back-up &amp; export<b>uur van de automatische nachtback-up</b></div></div></div>`;
      }else{
        body=`<div class="blok"><h4>App</h4>${kv('Versie',esc(d.versie))}${kv('Database',esc(d.grootte_tekst))}${kv('Pad',esc(d.pad))}${kv('Opslag',d.railway?'Railway-volume':'lokaal')}</div><div class="blok"><h4>Back-ups</h4>${kv('Bewaard',d.backups+' <a href="/backup">Back-up &amp; export ›</a>')}${d.nachtbackup_fout?kv('Fout',`<span style="color:#b91c1c">${esc(d.nachtbackup_fout)}</span>`):kv('Nachtback-up','in orde')}</div>`;
      }
      return kop+tabs+`<div class="dgrid">${body}</div>`;
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
  let O=null,D=null,SEL=new URLSearchParams(location.search).get('groep')||'kantoor',FILTER='alles',ZOEK='',TAB='gegevens';
  async function laad(){
    const r=await api('GET','/api/instellingen');
    if(r.status===401||r.status===403){location.href='/';return;}
    if(!r.ok)return toast(r.json.error||'Laden mislukt','error');
    O=r.json;tekenLijst();await open(SEL,true);
  }
  function tekenLijst(){
    const zf=document.activeElement&&document.activeElement.id==='zoek',pos=zf?document.activeElement.selectionStart:0;
    $('filters').innerHTML=BOUW.chips(O,FILTER,ZOEK);
    const l=O.groepen.filter(g=>FILTER==='alles'||g.aandacht).filter(g=>!ZOEK||(g.naam+' '+g.sub).toLowerCase().includes(ZOEK));
    $('lijst').innerHTML=l.map(g=>BOUW.rij(g,g.id===SEL)).join('')||'<div class="leeg">Geen instelling gevonden</div>';
    $('voet').innerHTML='<span>alleen kantoor kan instellingen wijzigen · elke wijziging komt in het Logboek</span>';
    $('zoek').oninput=e=>{ZOEK=e.target.value.trim().toLowerCase();tekenLijst();};
    if(zf){$('zoek').focus();$('zoek').setSelectionRange(pos,pos);}
  }
  async function open(id,stil){
    const r=await api('GET','/api/instellingen/'+id);if(!r.ok)return toast(r.json.error||'Laden mislukt','error');
    SEL=id;D=r.json;$('detail').innerHTML=BOUW.detail(D,TAB);tekenLijst();if(!stil)$('body').classList.add('toon-detail');
  }
  const form=()=>Object.fromEntries([...$('form').querySelectorAll('input,select')].map(i=>[i.name,i.value]));
  async function doe(m,url,body,ok){const r=await api(m,url,body);if(!r.ok)return toast(r.json.error||'Opslaan mislukt',r.status===409?'warn':'error'),false;if(ok)toast(ok,'success');await laad();return true;}
  function vraagNaam(titel,waarde){
    return new Promise(res=>{const bg=document.createElement('div');bg.className='mbg';
      bg.innerHTML=`<div class="mbox" role="dialog" aria-modal="true"><h4>${esc(titel)}</h4><div class="veld"><label>Nieuwe naam</label><input id="vn" value="${esc(waarde)}"></div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px"><button class="knop licht" data-x="0">Annuleren</button><button class="knop" data-x="1">Opslaan</button></div></div>`;
      const sluit=v=>{bg.remove();res(v);};bg.querySelector('[data-x="0"]').onclick=()=>sluit(null);bg.querySelector('[data-x="1"]').onclick=()=>sluit(bg.querySelector('#vn').value.trim()||null);
      document.body.appendChild(bg);bg.querySelector('#vn').focus();});
  }
  document.addEventListener('click',async e=>{
    const t=e.target;if(t.closest('.mbox'))return;
    const chip=t.closest('.chip[data-f]');if(chip){FILTER=chip.dataset.f;return tekenLijst();}
    const r=t.closest('.r[data-id]');if(r){TAB='gegevens';return open(r.dataset.id);}
    const tab=t.closest('[data-tab]');if(tab){TAB=tab.dataset.tab;$('detail').innerHTML=BOUW.detail(D,TAB);return;}
    const a=(t.closest('[data-act]')||{}).dataset?.act;
    if(a==='terug'){$('body').classList.remove('toon-detail');return;}
    if(a==='annuleer'){$('detail').innerHTML=BOUW.detail(D,TAB);return toast('Wijzigingen niet bewaard','info');}
    if(a==='opslaan')return doe('PUT','/api/instellingen/'+SEL,form(),'Opgeslagen');
    if(a==='gesloten-toe'){const f=form();if(!f.van)return toast('Kies een datum','warn');const x=await api('POST','/api/instellingen/gesloten',f);if(!x.ok)return toast(x.json.error||'Toevoegen mislukt','error');toast(`${x.json.toegevoegd} dag${x.json.toegevoegd===1?'':'en'} toegevoegd${x.json.bestond_al?` (${x.json.bestond_al} bestonden al)`:''}`,'success');return laad();}
    if(a==='lijst-toe'){const f=form();if(!f.naam)return toast('Geef een naam','warn');return doe('POST',`/api/instellingen/${SEL}/lijst`,{naam:f.naam},`${f.naam} toegevoegd`);}
    const gw=t.closest('[data-gesl-weg]');if(gw)return doe('DELETE','/api/instellingen/gesloten/'+gw.dataset.geslWeg,null,'Gesloten dag verwijderd');
    const hn=t.closest('[data-hernoem]');if(hn){const n=await vraagNaam(`${hn.dataset.hernoem} hernoemen`,hn.dataset.hernoem);if(!n||n===hn.dataset.hernoem)return;return doe('PUT',`/api/instellingen/${SEL}/lijst`,{oud:hn.dataset.hernoem,nieuw:n},'Hernoemd');}
    const lw=t.closest('[data-lijst-weg]');if(lw)return doe('DELETE',`/api/instellingen/${SEL}/lijst/${encodeURIComponent(lw.dataset.lijstWeg)}`,null,`${lw.dataset.lijstWeg} verwijderd`);
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
