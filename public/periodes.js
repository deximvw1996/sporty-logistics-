// public/periodes.js — PL2 punt 3: Planning › Periodes (Periodes-scherm in design/mockup-planning-rest.html).
// Lijst uit GET /api/periodes-overzicht, detail uit GET /api/periodes/:id/detail. Nieuw/bewerken/activeren via /api/periodes (routes/planning.js),
// gesloten dagen via /api/gesloten, kopiëren via POST /api/periodes/:id/kopieer (kampmomenten + thema's, zonder KV's en ritten; gelogd).
'use strict';
(function(){
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const kv=(k,x)=>`<div class="kv"><span>${k}</span><b>${x}</b></div>`;
  const PIL={actief:'<span class="pil groen">actief</span>',komend:'<span class="pil">komend</span>',leeg:'<span class="pil oranje">leeg</span>',voorbij:'<span class="pil">voorbij</span>'};
  const BOUW={
    rij(p,{act}={}){return `<div class="r ${act?'act':''}" data-id="${p.id}"><span></span><span><b>${esc(p.naam)}</b></span><span>${esc(p.datums)}</span><span>${p.weken}</span><span>${esc(p.km_tekst)}</span><span>${PIL[p.stand]||''}</span></div>`;},
    detail(D,tab,alleWeken){
      const p=D.periode;
      const toonW=alleWeken?D.weken:D.weken.slice(0,4);
      const weken=`<div class="blok"><h4>Kampweken</h4>${toonW.map(w=>`<div class="rij" data-href="/rooster?week=${w.nr}&periode_id=${p.id}" style="cursor:pointer" title="Open week ${w.nr} in het rooster"><div class="nm">${esc(w.label)}${w.gesloten.length?` (${esc(w.gesloten.join(', '))})`:''}<b>${esc(w.sub)}</b></div></div>`).join('')}${D.weken.length>4&&!alleWeken?`<div class="rij" data-act="alleweken" style="cursor:pointer"><div class="nm" style="color:#64748b;font-weight:500">+ ${D.weken.length-4} andere weken</div></div>`:''}</div>`;
      const geg=`<div class="blok"><h4>Gegevens</h4>${kv('Start',esc(p.start_lang))}${kv('Einde',esc(p.eind_lang))}${kv('Weken',D.weken.length)}${kv('Actief',p.actief?'ja · alle schermen tonen deze periode':`nee · <a data-act="activeer" style="color:#2563eb;cursor:pointer">actief maken</a>`)}</div>`;
      const gesl=plus=>`<div class="blok"><h4>Gesloten dagen${plus?' <a data-act="gesloten-nieuw" style="cursor:pointer">+ dag</a>':''}</h4>${D.gesloten.map(g=>`<div class="rij"><div class="nm">${esc(g.tekst)}${g.reden?' · '+esc(g.reden):''}<b>${g.locatie?esc("alleen "+g.locatie):"alle locaties dicht"}</b></div><button class="knop licht klein" data-gesl-weg="${g.id}" aria-label="Verwijderen">✕</button></div>`).join('')||'<div class="rij"><div class="nm">Geen gesloten dagen in deze periode</div></div>'}</div>`;
      const klaar=`<div class="blok"><h4>Klaar voor de start?</h4>${D.klaar.map(k=>kv(esc(k.label),`<a href="${esc(k.link)}"${k.probleem?' class="let"':''}>${esc(k.tekst)}${k.uitleg?' · '+esc(k.uitleg):''}${k.probleem?' ›':''}</a>`)).join('')}</div>`;
      const hist=`<div class="blok vol"><h4>Historiek (alles gelogd)</h4>${D.historiek.map(h=>`<div class="rij"><div class="nm">${esc(h.wat)}<b>${esc(h.t)}</b></div></div>`).join('')||'<div class="rij"><div class="nm">Nog niets gelogd</div></div>'}</div>`;
      const inhoud={weken:weken+geg+gesl(false)+klaar,gesloten:gesl(true).replace('class="blok"','class="blok vol"'),historiek:hist}[tab]||'';
      return `<a class="terug" data-act="terug">‹ terug naar de lijst</a><div class="dkop"><div><h2>${esc(p.naam)}</h2><span>${esc(p.sub)}</span></div><div class="acts"><button class="knop licht" data-act="bewerk">Bewerken</button><button class="knop licht" data-act="kopieer">Kopieer naar nieuwe periode</button><a class="knop" style="display:inline-flex;align-items:center;text-decoration:none" href="/rooster?periode_id=${p.id}">Rooster openen</a></div></div>
        <div class="dtabs">${[['weken','Weken'],['gesloten','Gesloten dagen'],['historiek','Historiek']].map(([x,t])=>`<a class="${tab===x?'act':''}" data-tab="${x}">${t}</a>`).join('')}</div><div class="dgrid"${tab==='weken'?'':' style="grid-template-columns:1fr"'}>${inhoud}</div>`;
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
  function vraag({titel,tekst,html,ok='Bevestigen',lees}){
    return new Promise(resolve=>{
      const bg=document.createElement('div');bg.className='mbg';
      bg.innerHTML=`<div class="mbox" role="dialog" aria-modal="true"><h4>${esc(titel)}</h4>${tekst?`<p>${esc(tekst)}</p>`:''}<form class="form" onsubmit="return false">${html||''}<div class="knoppen"><button type="button" class="knop licht" data-x="0">Annuleren</button><button type="button" class="knop" data-x="1">${esc(ok)}</button></div></form></div>`;
      const sluit=v=>{document.removeEventListener('keydown',toets,true);bg.remove();resolve(v);};
      const toets=e=>{if(e.key==='Escape'){e.preventDefault();sluit(null);}};
      document.addEventListener('keydown',toets,true);bg.addEventListener('mousedown',e=>{if(e.target===bg)sluit(null);});
      bg.querySelector('[data-x="0"]').onclick=()=>sluit(null);
      bg.querySelector('[data-x="1"]').onclick=()=>{const v=lees?lees(bg.querySelector('form')):{};if(v)sluit(v);};
      document.body.appendChild(bg);(bg.querySelector('input')||bg.querySelector('[data-x="1"]')).focus();
    });
  }
  const Q=new URLSearchParams(location.search);
  let O=null,D=null,FILTER='alle',ZOEK='',TAB='weken',ALLE=false;
  const zichtbaar=()=>O.periodes.filter(p=>FILTER==='alle'||p.tijd===FILTER).filter(p=>!ZOEK||p.zoek.includes(ZOEK));
  async function laad(){
    const r=await api('GET','/api/periodes-overzicht');
    if(r.status===401||r.status===403){location.href='/';return;}
    if(!r.ok)return toast(r.json.error||'Periodes laden mislukt','error');
    O=r.json;tekenLijst();if(D)await openP(D.periode.id,true);
  }
  function tekenLijst(){
    document.querySelectorAll('.chip[data-f]').forEach(c=>{c.classList.toggle('act',c.dataset.f===FILTER);c.querySelector('b').textContent=O.tellers[c.dataset.f];});
    const l=zichtbaar();
    $('lijst').innerHTML=l.length?l.map(p=>BOUW.rij(p,{act:D&&D.periode.id===p.id})).join(''):'<div class="leeg">Geen periodes voor deze filter</div>';
    $('n-tot').textContent=`${l.length} periode${l.length===1?'':'s'}`;
  }
  async function openP(id,stil){
    const r=await api('GET',`/api/periodes/${id}/detail`);if(!r.ok)return toast(r.json.error||'Detail laden mislukt','error');
    D=r.json;teken();tekenLijst();if(!stil)$('body').classList.add('toon-detail');
  }
  function teken(){$('detail').innerHTML=BOUW.detail(D,TAB,ALLE);}
  const periodeForm=(titel,p,ok)=>vraag({titel,ok,html:`<label>Naam<input name="naam" value="${esc(p.naam||'')}"></label><label>Start<input name="start" type="date" value="${esc(p.start_datum||'')}"></label><label>Einde<input name="eind" type="date" value="${esc(p.eind_datum||'')}"></label>`,
    lees:f=>f.naam.value.trim()&&f.start.value&&f.eind.value?{naam:f.naam.value.trim(),start_datum:f.start.value,eind_datum:f.eind.value}:(toast('Naam, start en einde zijn verplicht','warn'),null)});
  document.addEventListener('click',async e=>{
    const t=e.target;if(t.closest('.mbox'))return;
    const chip=t.closest('.chip[data-f]');if(chip){FILTER=chip.dataset.f;return tekenLijst();}
    const rij=t.closest('.r[data-id]');if(rij){ALLE=false;return openP(+rij.dataset.id);}
    const tab=t.closest('[data-tab]');if(tab){TAB=tab.dataset.tab;return teken();}
    const hr=t.closest('[data-href]');if(hr)return location.href=hr.dataset.href;
    const act=t.closest('[data-act]');const a=act&&act.dataset.act;
    if(a==='terug'){$('body').classList.remove('toon-detail');return;}
    if(!D)return;const p=D.periode;
    if(a==='alleweken'){ALLE=true;return teken();}
    if(a==='bewerk'){const x=await periodeForm(`${p.naam} bewerken`,p,'Opslaan');if(!x)return;const r=await api('PUT',`/api/periodes/${p.id}`,x);if(!r.ok)return toast(r.json.error||'Opslaan mislukt','error');toast('Opgeslagen','success');return laad();}
    if(a==='activeer'){const r=await api('POST',`/api/periodes/${p.id}/activeer`);if(!r.ok)return toast(r.json.error||'Activeren mislukt','error');toast(`${p.naam} is nu de actieve periode`,'success');kop();return laad();}
    if(a==='kopieer'){
      const x=await vraag({titel:`${p.naam} kopiëren`,tekst:'Kampmomenten en thema’s worden gekopieerd, zonder KV’s en ritten. Alles wordt gelogd.',ok:'Kopiëren',
        html:`<label>Naam nieuwe periode<input name="naam" value="${esc(p.naam.replace(/\d{4}/,m=>+m+1))}"></label><label>Start<input name="start" type="date"></label><label>Einde<input name="eind" type="date"></label>`,
        lees:f=>f.naam.value.trim()&&f.start.value&&f.eind.value?{naam:f.naam.value.trim(),start_datum:f.start.value,eind_datum:f.eind.value}:(toast('Naam, start en einde zijn verplicht','warn'),null)});
      if(!x)return;const r=await api('POST',`/api/periodes/${p.id}/kopieer`,x);if(!r.ok)return toast(r.json.error||'Kopiëren mislukt','error');
      toast(`${x.naam}: ${r.json.kampmomenten} kampmomenten en ${r.json.themas} thema’s gekopieerd${r.json.niet_gekopieerd?` (${r.json.niet_gekopieerd} vielen buiten de weken)`:''}`,'success');await laad();return openP(r.json.id,true);
    }
    if(a==='gesloten-nieuw'){
      const x=await vraag({titel:'Gesloten dag toevoegen',ok:'Toevoegen',html:`<label>Datum<input name="datum" type="date" min="${esc(p.start_datum)}" max="${esc(p.eind_datum)}"></label><label>Reden<input name="reden" placeholder="bv. nationale feestdag"></label>`,
        lees:f=>f.datum.value?{datum:f.datum.value,reden:f.reden.value}:(toast('Kies een datum','warn'),null)});
      if(!x)return;const r=await api('POST','/api/gesloten',x);if(!r.ok)return toast(r.json.error||'Toevoegen mislukt','error');toast('Gesloten dag toegevoegd','success');return openP(p.id,true);
    }
    const gw=t.closest('[data-gesl-weg]');if(gw){const r=await api('DELETE',`/api/gesloten/${gw.dataset.geslWeg}`);if(!r.ok)return toast(r.json.error||'Verwijderen mislukt','error');toast('Gesloten dag verwijderd','success');return openP(p.id,true);}
  });
  $('zoek').oninput=e=>{ZOEK=e.target.value.trim().toLowerCase();tekenLijst();};
  $('nieuw').onclick=async()=>{const x=await periodeForm('Nieuwe periode',{},'Aanmaken');if(!x)return;const r=await api('POST','/api/periodes',x);if(!r.ok)return toast(r.json.error||'Aanmaken mislukt','error');toast(`${x.naam} aangemaakt (niet actief)`,'success');await laad();openP(r.json.id);};
  async function kop(){
    const v=await api('GET','/api/vandaag');
    if(v.ok){$('per-naam').textContent=v.json.periode?v.json.periode.naam:'geen periode';$('wie').textContent=v.json.gebruiker.naam+' · kantoor';}
    const p=await api('GET','/api/periodes');if(!p.ok)return;
    const sel=$('per-kies');sel.innerHTML=p.json.map(x=>`<option value="${x.id}"${x.actief?' selected':''}>${esc(x.naam)}</option>`).join('');
    sel.onchange=async()=>{const a=await api('POST','/api/periodes/'+sel.value+'/activeer');if(!a.ok)return toast(a.json.error||'Periode wisselen mislukt','error');location.reload();};
  }
  (async()=>{await laad();const id=+Q.get('id')||(O&&(O.periodes.find(p=>p.actief)||{}).id);if(id)openP(id,true);kop();})();
})();
