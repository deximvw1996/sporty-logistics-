// public/voertuigen.js — VT1: Transport › Voertuigen (design/mockup-voertuigen.html) op het kantoorpatroon.
// Lijst uit GET /api/voertuigen-overzicht?week=, detail uit GET /api/voertuigen/:id/detail?week=; acties via /api/voertuigen (gelogd).
// De HTML-bouwers (BOUW) zijn los van de browser, zodat de test ze met echte data-JSON kan aanroepen.
'use strict';
(function(){
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const knop=(id,t,licht)=>`<button class="knop ${licht===false?'':'licht'}" id="${id}">${t}</button>`;
  const SOORT={eigen:'eigen',huur:'huur',prive:'privé'};
  const BOUW={
    rij(v,{sel,act}={}){
      const kls={rit:'r',dubbel:'x',onderhoud:'o'};
      const pil=v.status==='dubbel'?`<span class="pil rood">⚠ ${esc(v.aandacht.find(a=>/^dubbel/.test(a)))}</span>`:v.status==='onderhoud'?`<span class="pil oranje">${esc(v.aandacht.find(a=>/^onderhoud/.test(a)))}</span>`:v.aandacht.length?`<span class="pil oranje">${esc(v.aandacht[0])}</span>`:'<span class="pil groen">ok</span>';
      return `<div class="r ${act?'act':''}" data-id="${v.id}"><span><input type="checkbox" data-sel="${v.id}" ${sel?'checked':''} aria-label="Selecteer ${esc(v.naam)}"></span><span><b>${esc(v.naam)}</b><span class="k" style="display:block">${esc(v.sub)}</span></span><span>${esc(SOORT[v.soort]||v.soort)}</span><span class="get">${v.plaatsen==null?'—':v.plaatsen}</span><span>${esc(v.rijbewijs||'—')}</span><span class="wkcel"><span class="wk">${v.week.map(d=>`<i class="${kls[d.status]||''}" title="${esc(d.dag)}"></i>`).join('')}</span></span><span>${pil}</span></div>`;
    },
    detail(D,tab){
      const {voertuig:v,week,let_op:letOp,onderhoud,historiek}=D;
      const kv=(k,x)=>`<div class="kv"><span>${k}</span><b>${x}</b></div>`;
      const dagen=week.dagen.map(d=>{
        const klas=d.status==='dubbel'?'x':d.status==='onderhoud'?'o':'';
        const blokken=[...(d.status==='onderhoud'?[`<span class="o">onderhoud${d.onderhoud&&d.onderhoud!=='onderhoud'?' · '+esc(d.onderhoud):''}</span>`]:[]),
          ...d.ritten.map(r=>`<span class="${klas==='o'?'':klas}">${esc(r.van||'?')}–${esc(r.tot||'?')} · rit #${r.id}${r.bestuurder?' · '+esc(r.bestuurder):''}${r.lading?' · '+esc(r.lading):''}</span>`)];
        return `<div class="dag"><span class="d"${d.weekend?' style="color:#94a3b8"':''}>${esc(d.tekst)}</span>${blokken.length?`<span class="blk">${blokken.join('')}</span>`:'<span class="k">vrij</span>'}</div>`;
      }).join('');
      const blokWeek=`<div class="blok vol"><h4>Deze week</h4>${dagen}</div>`;
      const blokLetOp=letOp.length?`<div class="blok"><h4>Let op</h4>${letOp.map(l=>`<div class="rij"><div class="nm" style="color:${l.soort==='dubbel'?'#b91c1c':'#c2410c'}">${esc(l.tekst)}<b>${esc(l.sub)}</b></div><button class="knop licht klein" data-rit="${l.rit_id}">${esc(l.knop)}</button></div>`).join('')}</div>`:'';
      const blokGeg=`<div class="blok"><h4>Gegevens</h4>${kv('Nummerplaat',esc(v.nummerplaat||'—'))}${kv('Past ongeveer',v.plaatsen==null?'—':'± '+v.plaatsen+' bakken (info)')}${v.aard==='aanhangwagen'?'':kv('Rijbewijs',esc(v.rijbewijs||'—'))+kv('Trekhaak',v.trekhaak?'ja':'nee')+kv('Laadklep',v.laadklep?'ja':'nee')}${kv('Standplaats',esc(v.standplaats||'—'))}${kv('Sleutel',esc(v.sleutel_info||'—'))}${kv('Keuring',v.keuring_tot?'tot '+esc(v.keuring_tot.split('-').reverse().join('/')):'—')}${v.soort==='huur'?kv('Huur',esc([v.huur_van,v.huur_tot].map(x=>x?x.split('-').reverse().join('/'):'…').join(' – '))):''}${v.notitie?kv('Notitie',esc(v.notitie)):''}</div>`;
      const blokOnd=`<div class="blok"><h4>Onderhoud <a data-act="onderhoud-nieuw" style="cursor:pointer">+ periode</a></h4>${onderhoud.map(o=>`<div class="rij"><div class="nm">${esc(o.datum_van.split('-').reverse().join('/'))} – ${esc(o.datum_tot.split('-').reverse().join('/'))}<b>${esc(o.reden||'onderhoud')}</b></div><button class="knop licht klein" data-ond-weg="${o.id}" aria-label="Verwijderen">✕</button></div>`).join('')||'<div class="rij"><div class="nm">Geen onderhoud gepland</div></div>'}</div>`;
      const blokHist=`<div class="blok"><h4>Historiek (alles gelogd)</h4>${historiek.slice(0,tab==='historiek'?100:5).map(h=>`<div class="rij"><div class="nm">${esc(h.wat)}<b>${esc([h.t,h.wie].filter(Boolean).join(' · '))}</b></div><button class="knop licht klein" disabled title="Terugdraaien bestaat nog niet als route (GEVONDEN)">↶ Terug</button></div>`).join('')||'<div class="rij"><div class="nm">Nog niets gelogd</div></div>'}</div>`;
      const inhoud={planning:blokWeek+blokLetOp+blokGeg,gegevens:blokGeg+blokOnd,historiek:blokHist}[tab]||'';
      const sub=[v.soort_tekst,v.nummerplaat,v.plaatsen!=null?'± '+v.plaatsen+' bakken':'',v.rijbewijs?'rijbewijs '+v.rijbewijs:'',v.standplaats?'staat in '+v.standplaats:''].filter(Boolean).map(esc).join(' · ');
      return `<a class="terug" data-act="terug">‹ terug naar de lijst</a><div class="dkop"><div><h2>${esc(v.naam)}</h2><span>${sub}</span></div><div class="acts">${knop('d-bewerk','Bewerken')}${knop('d-onderhoud','Onderhoud plannen')}${knop('d-rit','Naar ritplanning',false)}</div></div>
        <div class="dtabs">${[['planning','Planning'],['gegevens','Gegevens'],['historiek',`Historiek ${historiek.length}`]].map(([k,x])=>`<a class="${tab===k?'act':''}" data-tab="${k}">${x}</a>`).join('')}</div>
        <div class="dgrid"${tab==='planning'?'':' style="grid-template-columns:1fr"'}>${inhoud}</div>`;
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
  let O=null,D=null,SEL=new Set(),FILTER='alle',ZOEK='',TAB='planning',WEEK=Q.get('week')||'',LOCS=null;
  const FILTERS={alle:()=>true,eigen:v=>v.soort==='eigen',huur:v=>v.soort==='huur',prive:v=>v.soort==='prive',dubbel:v=>v.status==='dubbel',onderhoud:v=>v.week.some(d=>d.status==='onderhoud')};
  const alleV=()=>[...O.voertuigen,...(O.aanhangwagens||[])];
  const zichtbaar=()=>alleV().filter(FILTERS[FILTER]).filter(v=>!ZOEK||v.zoek.includes(ZOEK));
  const dm=s=>{const d=new Date(s+'T12:00:00');return `${d.getDate()}/${d.getMonth()+1}`;};
  const plus=(s,n)=>{const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};

  async function laad(){
    const r=await api('GET','/api/voertuigen-overzicht'+(WEEK?`?week=${WEEK}`:''));
    if(r.status===401||r.status===403){location.href='/';return;}
    if(!r.ok)return toast(r.json.error||'Voertuigen laden mislukt','error');
    O=r.json;WEEK=O.week.start;SEL=new Set([...SEL].filter(id=>alleV().some(v=>v.id===id)));
    $('weeknr').textContent=`${dm(O.week.start)} – ${dm(O.week.eind)}`;
    $('kop-week').innerHTML=O.week.dagen.map(d=>`<i title="${esc(d.dag)}">${esc(d.dag[0])}</i>`).join('');
    tekenLijst();if(D)await laadDetail(D.voertuig.id,true);
  }
  function tekenLijst(){
    document.querySelectorAll('.chip[data-f]').forEach(c=>{c.classList.toggle('act',c.dataset.f===FILTER);c.querySelector('b').textContent=O.tellers[c.dataset.f];});
    const l=zichtbaar();
    const rij=x=>BOUW.rij(x,{sel:SEL.has(x.id),act:D&&D.voertuig.id===x.id}),kop=t=>`<h3 class="blokkop" style="font-size:13px;margin:12px 10px 4px;color:#334155">${t}</h3>`,lv=l.filter(x=>x.aard!=='aanhangwagen'),la=l.filter(x=>x.aard==='aanhangwagen');
    $('lijst').innerHTML=l.length?(lv.length?kop('Voertuigen')+lv.map(rij).join(''):'')+(la.length?kop('Aanhangwagens')+la.map(rij).join(''):''):'<div class="leeg">Geen voertuigen voor deze filter</div>';
    $('n-tot').textContent=`${l.length} voertuig${l.length===1?'':'en'}`;$('n-sel').textContent=`${SEL.size} geselecteerd`;$('voet').classList.toggle('sel',SEL.size>0);$('alles').checked=l.length>0&&l.every(x=>SEL.has(x.id));
  }
  async function laadDetail(id,stil){
    const r=await api('GET',`/api/voertuigen/${id}/detail?week=${WEEK}`);
    if(!r.ok){D=null;$('detail').innerHTML='<div class="leegd">Klik een voertuig in de lijst voor het detail.</div>';return toast(r.json.error||'Detail laden mislukt','error');}
    D=r.json;teken();document.querySelectorAll('.r[data-id]').forEach(x=>x.classList.toggle('act',+x.dataset.id===id));
    if(!stil)$('body').classList.add('toon-detail');
  }
  function teken(){$('detail').innerHTML=BOUW.detail(D,TAB);}
  async function locaties(){
    if(LOCS)return LOCS;
    const r=await api('GET','/api/locaties-overzicht');
    LOCS=r.ok?r.json.locaties.filter(l=>l.type==='stockage'):[];return LOCS;
  }
  async function voertuigForm(titel,v,ok){
    v=v||{};const locs=await locaties();
    return vraag({titel,ok,html:`<label>Naam<input name="naam" value="${esc(v.naam||'')}"></label>
      <label>Wat<select name="aard"><option value="voertuig" ${v.aard==='aanhangwagen'?'':'selected'}>Voertuig</option><option value="aanhangwagen" ${v.aard==='aanhangwagen'?'selected':''}>Aanhangwagen</option></select></label>
      <label><input type="checkbox" name="trekhaak" ${v.trekhaak?'checked':''}> Trekhaak</label>
      <label><input type="checkbox" name="laadklep" ${v.laadklep?'checked':''}> Laadklep</label>
      <label>Soort<select name="soort">${[['eigen','eigen voertuig'],['huur','huurwagen'],['prive','privé wagen']].map(([k,n])=>`<option value="${k}" ${k===(v.soort||'eigen')?'selected':''}>${n}</option>`).join('')}</select></label>
      <label>Nummerplaat<input name="plaat" value="${esc(v.nummerplaat||'')}" placeholder="1-ABC-123"></label>
      <label>Past ongeveer (bakken, alleen info)<input name="plaatsen" type="number" min="1" value="${v.plaatsen==null?'':v.plaatsen}"></label>
      <label>Rijbewijs<input name="rijb" value="${esc(v.naam?v.rijbewijs||'':'B')}"></label>
      <label>Standplaats<select name="plek"><option value="">—</option>${locs.map(l=>`<option value="${l.id}" ${l.id===v.standplaats_locatie_id?'selected':''}>${esc(l.naam)}</option>`).join('')}</select></label>
      <label>Sleutel<input name="sleutel" value="${esc(v.sleutel_info||'')}"></label>
      <label>Keuring tot<input name="keuring" type="date" value="${esc(v.keuring_tot||'')}"></label>
      <label>Gehuurd van<input name="hvan" type="date" value="${esc(v.huur_van||'')}"></label>
      <label>Gehuurd tot<input name="htot" type="date" value="${esc(v.huur_tot||'')}"></label>
      <label>Notitie<input name="notitie" value="${esc(v.notitie||'')}"></label>`,
      lees:f=>f.naam.value.trim()?{naam:f.naam.value.trim(),aard:f.aard.value,trekhaak:f.trekhaak.checked,laadklep:f.laadklep.checked,soort:f.soort.value,nummerplaat:f.plaat.value,plaatsen:f.plaatsen.value||null,rijbewijs:f.rijb.value,standplaats_locatie_id:f.plek.value||null,
        sleutel_info:f.sleutel.value,keuring_tot:f.keuring.value,huur_van:f.hvan.value,huur_tot:f.htot.value,notitie:f.notitie.value}:(toast('Naam is verplicht','warn'),null)});
  }
  function csv(lijst,naam){
    const kol=['naam','soort','nummerplaat','plaatsen','rijbewijs','sub','status'];
    const tekst=[kol.join(';'),...lijst.map(t=>kol.map(k=>`"${String(t[k]??'').replace(/"/g,'""')}"`).join(';'))].join('\r\n');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+tekst],{type:'text/csv'}));a.download=naam;a.click();URL.revokeObjectURL(a.href);
  }
  const gekozen=()=>alleV().filter(v=>SEL.has(v.id));
  async function onderhoudPlannen(){
    const v=await vraag({titel:`Onderhoud plannen — ${D.voertuig.naam}`,ok:'Plannen',html:`<label>Van<input name="van" type="date" value="${esc(WEEK)}"></label><label>Tot<input name="tot" type="date" value="${esc(WEEK)}"></label><label>Reden<input name="reden" placeholder="bv. jaarlijkse keuring"></label>`,
      lees:f=>f.van.value&&f.tot.value?{datum_van:f.van.value,datum_tot:f.tot.value,reden:f.reden.value}:(toast('Kies een begin- en einddatum','warn'),null)});
    if(!v)return;
    const r=await api('POST',`/api/voertuigen/${D.voertuig.id}/onderhoud`,v);if(!r.ok)return toast(r.json.error||'Plannen mislukt','error');toast('Onderhoud gepland','success');laad();
  }

  document.addEventListener('click',async e=>{
    const t=e.target;if(t.closest('.mbox'))return;
    if(t.matches('[data-sel]')){const id=+t.dataset.sel;t.checked?SEL.add(id):SEL.delete(id);return tekenLijst();}
    const wk=t.closest('[data-week]');if(wk){WEEK=plus(WEEK,7*(+wk.dataset.week));return laad();}
    const chip=t.closest('.chip[data-f]');if(chip){FILTER=chip.dataset.f;return tekenLijst();}
    const rij=t.closest('.r[data-id]');if(rij)return laadDetail(+rij.dataset.id);
    const tab=t.closest('[data-tab]');if(tab){TAB=tab.dataset.tab;return teken();}
    if(t.closest('[data-act="terug"]')){$('body').classList.remove('toon-detail');return;}
    if(!D)return;const v=D.voertuig;
    const ritKnop=t.closest('[data-rit]');if(ritKnop)return location.href=`/ritplanning?rit=${ritKnop.dataset.rit}&week=${WEEK}`;
    if(t.id==='d-rit')return location.href=`/ritplanning?week=${WEEK}`;
    if(t.id==='d-bewerk'){const x=await voertuigForm(`${v.naam} bewerken`,v,'Opslaan');if(!x)return;const r=await api('PUT',`/api/voertuigen/${v.id}`,x);if(!r.ok)return toast(r.json.error||'Opslaan mislukt','error');toast('Opgeslagen','success');return laad();}
    if(t.id==='d-onderhoud'||t.closest('[data-act="onderhoud-nieuw"]'))return onderhoudPlannen();
    const ow=t.closest('[data-ond-weg]');
    if(ow){const r=await api('DELETE',`/api/voertuigen/${v.id}/onderhoud/${ow.dataset.ondWeg}`);if(!r.ok)return toast(r.json.error||'Verwijderen mislukt','error');return laad();}
  });
  $('alles').onchange=e=>{zichtbaar().forEach(v=>e.target.checked?SEL.add(v.id):SEL.delete(v.id));tekenLijst();};
  $('zoek').oninput=e=>{ZOEK=e.target.value.trim().toLowerCase();tekenLijst();};
  $('export').onclick=()=>csv(alleV(),'voertuigen.csv');
  $('b-export').onclick=()=>csv(gekozen(),'voertuigen-selectie.csv');
  $('b-weg').onclick=async()=>{
    if(!await vraag({titel:`${SEL.size} voertuigen verwijderen?`,tekst:'Een voertuig met komende ritten wordt niet verwijderd.',ok:'Verwijderen'}))return;
    let n=0;for(const v of gekozen()){const r=await api('DELETE',`/api/voertuigen/${v.id}`);if(r.ok)n++;else toast(r.json.error||'Verwijderen mislukt','error');}
    if(n)toast(`${n} verwijderd`,'success');if(D&&SEL.has(D.voertuig.id))D=null;SEL.clear();laad();
  };
  $('nieuw').onclick=async()=>{
    const x=await voertuigForm('Nieuw voertuig',{},'Aanmaken');if(!x)return;
    const r=await api('POST','/api/voertuigen',x);if(!r.ok)return toast(r.json.error||'Aanmaken mislukt','error');
    toast(`${x.naam} aangemaakt`,'success');await laad();laadDetail(r.json.id);
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
