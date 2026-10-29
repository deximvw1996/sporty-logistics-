// public/logboek.js — BH1: Beheer › Logboek. Eén lijst van wijzigingen + activiteiten_log (GET /api/logboek) met
// filters (periode, wie, tabel, zoek); rechts oud/nieuw van de gekozen wijziging. "↶ Terug" staat uit zolang er
// geen terugdraai-route bestaat (de API zegt per regel of het kan).
'use strict';
(function(){
  const TOKEN=localStorage.getItem('sporty-auth-token');
  if(!TOKEN){location.href='/';return;}
  const $=id=>document.getElementById(id);
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function toast(msg,type){
    const t=document.createElement('div');
    t.style.background={info:'#378ADD',error:'#E24B4A',success:'#1D9E75',warn:'#EF9F27'}[type||'info'];
    t.textContent=msg;t.onclick=()=>t.remove();$('toasts').appendChild(t);
    setTimeout(()=>{t.style.transition='opacity .3s';t.style.opacity='0';setTimeout(()=>t.remove(),300);},type==='error'?5000:3000);
  }
  async function api(m,url){const r=await fetch(url,{method:m,headers:{'x-auth-token':TOKEN}});const j=await r.json().catch(()=>({}));return {status:r.status,ok:r.ok,json:j};}

  const Q=new URLSearchParams(location.search);
  const F={van:$('f-van'),tot:$('f-tot'),wie:$('f-wie'),tabel:$('f-tabel'),zoek:$('f-zoek')};
  for(const k of Object.keys(F))if(Q.get(k))F[k].value=Q.get(k);
  let L=null,SEL=null,tabellenGevuld=false,wacht=null;

  async function laad(){
    const qs=new URLSearchParams();for(const [k,el] of Object.entries(F))if(el.value)qs.set(k,el.value);
    history.replaceState(null,'','/logboek'+(qs.toString()?'?'+qs:''));
    const r=await api('GET','/api/logboek?'+qs);
    if(r.status===401||r.status===403){location.href='/';return;}
    if(!r.ok)return toast(r.json.error||'Logboek laden mislukt','error');
    L=r.json;
    if(!tabellenGevuld){const huidig=F.tabel.value;F.tabel.innerHTML='<option value="">Alle tabellen</option>'+L.tabellen.map(t=>`<option ${t===huidig?'selected':''}>${esc(t)}</option>`).join('');tabellenGevuld=true;}
    $('lijst').innerHTML=L.regels.length?L.regels.map(x=>`<div class="r ${SEL===x.id?'act':''}" data-id="${x.id}"><span>${esc(x.tijd_tekst)}</span><span>${esc(x.wie||'—')}</span><span>${esc(x.wat)}</span><span>${esc(x.tabel)}</span><span>${esc(x.context||'—')}</span></div>`).join('')
      :'<div class="leeg">Niets gevonden voor deze filters</div>';
    $('n-regels').textContent=`${L.regels.length} regels${L.afgekapt?` (van ${L.totaal}; verfijn de filters)`:''}`;
  }
  async function detail(id){
    SEL=id;document.querySelectorAll('.r').forEach(r=>r.classList.toggle('act',r.dataset.id===id));
    const x=L.regels.find(r=>r.id===id);
    const terug=`<button class="knop licht" disabled title="${esc(x.reden_niet_terug||'')}">↶ Terug</button>`;
    let inhoud;
    if(x.wijziging_id){
      const r=await api('GET',`/api/logboek/wijziging/${x.wijziging_id}`);
      if(!r.ok)return toast(r.json.error||'Wijziging laden mislukt','error');
      const o=r.json.oud||{},n=r.json.nieuw||{};
      const sleutels=[...new Set([...Object.keys(o),...Object.keys(n)])];
      const anders=k=>String(o[k]??'')!==String(n[k]??'');
      sleutels.sort((a,b)=>anders(b)-anders(a));
      inhoud=`<table class="vgl"><tr><th>Veld</th><th>Oud</th><th>Nieuw</th></tr>${sleutels.map(k=>`<tr class="${anders(k)?'anders':''}"><td class="k">${esc(k)}</td><td>${esc(o[k]??'—')}</td><td>${esc(n[k]??'—')}</td></tr>`).join('')}</table>`;
    }else inhoud=`<div class="kv"><span>Beschrijving</span><b>${esc(x.wat)}</b></div><div class="kv"><span>Soort</span><b>${esc(x.tabel)} · ${esc(x.actie)}</b></div>${x.context?`<div class="kv"><span>Plaats</span><b>${esc(x.context)}</b></div>`:''}`;
    $('detail').innerHTML=`<div class="dkop"><div><h2>${esc(x.wat.length>60?x.wat.slice(0,60)+'…':x.wat)}</h2><span>${esc([x.tijd_tekst,x.wie?'door '+x.wie:'',x.tabel,x.actie,x.context].filter(Boolean).join(' · '))}</span></div><div class="acts">${terug}</div></div>
      <div class="dgrid een"><div class="blok"><h4>${x.wijziging_id?'Oud en nieuw (gewijzigde velden eerst)':'Activiteit'}</h4>${inhoud}</div><div class="blok"><h4>Terugdraaien</h4><div class="kv"><span>Kan het?</span><b>${x.terugdraaibaar?'ja':'nee — '+esc(x.reden_niet_terug||'')}</b></div></div></div>`;
  }
  document.addEventListener('click',e=>{const r=e.target.closest('.r[data-id]');if(r)detail(r.dataset.id);});
  for(const el of Object.values(F))el.addEventListener(el.tagName==='SELECT'||el.type==='date'?'change':'input',()=>{clearTimeout(wacht);wacht=setTimeout(laad,250);});
  (async()=>{
    await laad();
    const v=await api('GET','/api/vandaag');
    if(v.ok){const b=$('b-vandaag');b.textContent=v.json.beslissen.length;b.hidden=!v.json.beslissen.length;$('per-naam').textContent=v.json.periode?v.json.periode.naam:'geen periode';$('wie').textContent=v.json.gebruiker.naam+' · kantoor';}
  })();
})();
