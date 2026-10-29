// public/logboek.js — BH1: Beheer › Logboek op het kantoorpatroon. Lijst uit GET /api/logboek (wijzigingen + activiteiten_log),
// filters periode / wie / onderdeel / zoek (in de URL: /logboek?wie=12), detail rechts met oud en nieuw van de gekozen regel.
// "↶ Terug" staat er waar de regel terugdraaibaar is, maar blijft uit zolang er geen terugdraai-route bestaat (GEVONDEN BH1).
'use strict';
(function(){
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const terugKnop=(r,kan)=>r.terugdraaibaar?`<button class="knop licht klein" data-terug="${esc(r.id)}" ${kan?'':'disabled title="Terugdraaien bestaat nog niet als route"'}>↶ Terug</button>`:'';
  function lijstHtml(L,openId){
    return L.regels.length?L.regels.map(r=>`<div class="r lb ${r.id===openId?'act':''}" data-id="${esc(r.id)}"><span>${esc(r.tijd_tekst)}</span><span>${esc(r.wie)}</span><span>${esc(r.wat)}</span><span>${esc(r.tabel_tekst)}</span><span><small>${esc(r.context)}</small></span><span>${terugKnop(r,L.terugdraaien_beschikbaar)}</span></div>`).join('')
      :'<div class="leeg">Niets gelogd voor deze filter</div>';
  }
  const waarde=v=>v==null||v===''?'—':typeof v==='object'?JSON.stringify(v):String(v);
  function detailHtml(r){
    if(!r)return '<div class="leegd">Klik een regel voor oud en nieuw.</div>';
    const o=r.oud&&typeof r.oud==='object'?r.oud:{},n=r.nieuw&&typeof r.nieuw==='object'?r.nieuw:{};
    const sleutels=[...new Set([...Object.keys(o),...Object.keys(n)])];
    const gewijzigd=k=>JSON.stringify(o[k])!==JSON.stringify(n[k]);
    sleutels.sort((a,b)=>gewijzigd(b)-gewijzigd(a));
    const tabel=sleutels.length?`<table class="on"><tr><th>Veld</th><th>Oud</th><th>Nieuw</th></tr>${sleutels.map(k=>`<tr class="${r.actie==='update'&&gewijzigd(k)?'anders':''}"><td>${esc(k.replace(/_/g,' '))}</td><td>${esc(waarde(o[k]))}</td><td>${esc(waarde(n[k]))}</td></tr>`).join('')}</table>`
      :`<div class="rij"><div class="nm">${esc(r.wat)}<b>activiteit zonder oud/nieuw</b></div></div>`;
    return `<div class="dkop"><div><h2>${esc(r.wat)}</h2><span>${esc([r.tijd_tekst,r.wie!=='—'?'door '+r.wie:'',r.tabel_tekst,r.context].filter(Boolean).join(' · '))}</span></div><div class="acts">${terugKnop(r,false)}</div></div>
   <div class="dtabs"><a class="act">Oud en nieuw</a></div><div class="dgrid een"><div class="blok"><h4>${r.actie==='insert'?'Aangemaakt':r.actie==='delete'?'Verwijderd':r.actie==='update'?'Gewijzigd (oranje = anders)':'Activiteit'}</h4>${tabel}</div><div></div></div>`;
  }
  if(typeof module!=='undefined'&&module.exports){module.exports={lijstHtml,detailHtml};}
  if(typeof document==='undefined')return;

  const TOKEN=localStorage.getItem('sporty-auth-token');
  if(!TOKEN){location.href='/';return;}
  const $=id=>document.getElementById(id);
  function toast(msg,type){
    const t=document.createElement('div');
    t.style.background={info:'#378ADD',error:'#E24B4A',success:'#1D9E75',warn:'#EF9F27'}[type||'info'];
    t.textContent=msg;t.onclick=()=>t.remove();$('toasts').appendChild(t);
    setTimeout(()=>{t.style.transition='opacity .3s';t.style.opacity='0';setTimeout(()=>t.remove(),300);},type==='error'?5000:3000);
  }
  async function api(methode,url){
    const r=await fetch(url,{method:methode,headers:{'x-auth-token':TOKEN}});
    return {status:r.status,ok:r.ok,json:await r.json().catch(()=>({}))};
  }
  const Q=new URLSearchParams(location.search);
  const F={van:Q.get('van')||'',tot:Q.get('tot')||'',wie:Q.get('wie')||'',tabel:Q.get('tabel')||'',zoek:Q.get('zoek')||''};
  let L=null,OPEN=null,eersteKeer=true;
  async function laad(){
    const qs=new URLSearchParams(Object.entries(F).filter(([,v])=>v)).toString();
    history.replaceState(null,'','/logboek'+(qs?'?'+qs:''));
    const r=await api('GET','/api/logboek'+(qs?'?'+qs:''));
    if(r.status===401){location.href='/';return;}
    if(r.status===403)return toast('Het logboek is alleen voor de rol kantoor','error');
    if(!r.ok)return toast(r.json.error||'Logboek laden mislukt','error');
    L=r.json;
    if(eersteKeer){eersteKeer=false;
      $('f-wie').innerHTML='<option value="">Iedereen</option>'+L.personen.map(p=>`<option value="${p.id}">${esc(p.naam)}</option>`).join('');
      $('f-tabel').innerHTML='<option value="">Alle onderdelen</option>'+L.tabellen.map(t=>`<option value="${esc(t.tabel)}">${esc(t.tekst)}</option>`).join('');
      $('f-wie').value=F.wie;$('f-tabel').value=F.tabel;$('van').value=F.van;$('tot').value=F.tot;$('zoek').value=F.zoek;}
    if(OPEN&&!L.regels.some(x=>x.id===OPEN))OPEN=null;
    teken();
  }
  function teken(){
    $('lijst').innerHTML=lijstHtml(L,OPEN);
    $('n-regels').textContent=`${L.regels.length} ${L.regels.length===1?'regel':'regels'}`;
    $('detail').innerHTML=detailHtml(L.regels.find(x=>x.id===OPEN));
  }
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-terug]'))return toast('Terugdraaien bestaat nog niet als route','warn');
    const r=e.target.closest('.r[data-id]');if(r){OPEN=r.dataset.id;teken();}
  });
  let wacht;
  $('zoek').oninput=e=>{clearTimeout(wacht);wacht=setTimeout(()=>{F.zoek=e.target.value.trim();laad();},300);};
  ['van','tot'].forEach(k=>$(k).onchange=e=>{F[k]=e.target.value;laad();});
  $('f-wie').onchange=e=>{F.wie=e.target.value;laad();};
  $('f-tabel').onchange=e=>{F.tabel=e.target.value;laad();};
  $('instellingen').onclick=()=>toast('Instellingen heeft nog geen eigen pagina','warn');
  $('export').onclick=async()=>{
    const r=await fetch('/api/export',{headers:{'x-auth-token':TOKEN}});
    if(!r.ok)return toast('Export mislukt','error');
    const a=document.createElement('a');a.href=URL.createObjectURL(await r.blob());a.download='sporty-export.json';a.click();URL.revokeObjectURL(a.href);
  };
  async function kop(){
    const v=await api('GET','/api/vandaag');
    if(v.ok){const b=$('b-vandaag');b.textContent=v.json.beslissen.length;b.hidden=!v.json.beslissen.length;
      $('per-naam').textContent=v.json.periode?v.json.periode.naam:'geen periode';$('wie').textContent=v.json.gebruiker.naam+' · kantoor';}
    const p=await api('GET','/api/periodes');if(!p.ok)return;
    const sel=$('per-kies');sel.innerHTML=p.json.map(x=>`<option value="${x.id}"${x.actief?' selected':''}>${esc(x.naam)}</option>`).join('');
    sel.onchange=async()=>{const a=await fetch('/api/periodes/'+sel.value+'/activeer',{method:'POST',headers:{'x-auth-token':TOKEN}});if(!a.ok)return toast('Periode wisselen mislukt','error');location.reload();};
  }
  (async()=>{await laad();kop();})();
})();
