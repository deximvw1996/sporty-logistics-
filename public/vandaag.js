// public/vandaag.js — KO1: kantoor-startscherm "Vandaag" (design/KANTOOR-DEFINITIEF.html).
// Vult de pagina uit GET /api/vandaag; na elke actie opnieuw laden. Groot/Compact per gebruiker onthouden.
'use strict';
(function(){
  function kvL(n){return /^KV\s/i.test(n)?n:'KV '+n;}
  const TOKEN=localStorage.getItem('sporty-auth-token');
  const $=id=>document.getElementById(id);
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  // Zelfde toast-stijl als index.html (showToast).
  function toast(msg,type){
    const t=document.createElement('div');
    t.style.background={info:'#378ADD',error:'#E24B4A',success:'#1D9E75',warn:'#EF9F27'}[type||'info'];
    t.textContent=msg;t.onclick=()=>t.remove();$('toasts').appendChild(t);
    setTimeout(()=>{t.style.transition='opacity .3s';t.style.opacity='0';setTimeout(()=>t.remove(),300);},type==='error'?5000:3000);
  }
  async function api(methode,url,body){
    const r=await fetch(url,{method:methode,headers:{'Content-Type':'application/json','x-auth-token':TOKEN||''},body:body?JSON.stringify(body):undefined});
    const j=await r.json().catch(()=>({}));
    return {status:r.status,ok:r.ok,json:j};
  }
  if(!TOKEN){location.href='/';return;}

  let DATA=null;
  const item=(x,i,kol)=>`<div class="it ${x.kleur}"><span class="ico">${esc(x.ico)}</span><span class="nm">${esc(x.titel)}<b>${esc(x.sub)}</b></span><span class="acts">${
    x.acties.map((a,j)=>`<button class="knop ${a.primair?'':'licht'}" data-k="${kol}" data-i="${i}" data-j="${j}">${esc(a.label)}</button>`).join('')}</span></div>`;
  const LEEG={beslissen:'Niets te beslissen',inplannen:'Niets in te plannen',nakijken:'Niets na te kijken'};
  function teken(){
    const v=DATA;
    $('per-naam').textContent=v.periode?v.periode.naam:'geen periode';
    $('wie').textContent=(v.gebruiker.naam||'')+' · kantoor';
    $('kop-sub').textContent=[v.datum_tekst,v.week?'kampweek '+v.week:null,'alleen wat vandaag of deze week moet'].filter(Boolean).join(' · ');
    for(const k of ['beslissen','inplannen','nakijken']){
      $('n-'+k).textContent=v[k].length;
      $('l-'+k).innerHTML=v[k].length?v[k].map((x,i)=>item(x,i,k)).join(''):`<div class="leeg">${LEEG[k]}</div>`;
    }
    const tel=(id,n)=>{const b=$(id);b.textContent=n;b.hidden=!n;};
    tel('b-vandaag',v.beslissen.length);tel('b-transport',v.inplannen.length);
    $('c-onderweg').textContent=v.cijfers.ritten_onderweg;$('c-open').textContent=v.cijfers.locaties_open;
    $('n-ritten').textContent=v.ritten_vandaag.length;
    const ritRij=r=>{
      const pil=r.status==='onderweg'?`<span class="pil blauw">stop ${r.stop_huidig}/${r.stops_totaal}</span>`:r.status==='gedaan'?'<span class="pil groen">gedaan</span>':'<span class="pil">gepland</span>';
      const stops=r.stops.map(s=>esc(s.naam)+(s.slot==='vrij'?' <span class="pil oranje">vrij</span>':' 🔒')).join(' → ');
      return `<div class="rit"><div class="u">${esc(r.tijd)}</div><div class="nm"><b>${esc([r.chauffeur||'geen chauffeur',r.voertuig].filter(Boolean).join(' · '))} ${pil}</b>${stops}</div></div>`;
    };
    // GF1: onder de ritten van vandaag staan die van morgen (zelfde rijstijl), zodat kantoor op donderdag de leveringen van vrijdag ziet.
    const morgen=(v.ritten_morgen||[]);
    $('l-ritten').innerHTML=(v.ritten_vandaag.length?v.ritten_vandaag.map(ritRij).join(''):'<div class="leeg">Geen ritten vandaag</div>')
      +(morgen.length?'<div class="morgen-kop" style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin:10px 0 2px">Morgen · '+morgen.length+'</div>'+morgen.map(ritRij).join(''):'');
    $('n-week').textContent=v.deze_week.length+' locatie'+(v.deze_week.length===1?'':'s');
    $('l-week').innerHTML=v.deze_week.length?v.deze_week.map(k=>`<div class="rit" data-km="${k.kampmoment_id}" style="cursor:pointer"><div class="u">${esc(k.dagen)}</div><div class="nm"><b>${esc(k.locatie)}</b>${
      esc([k.thema||'geen thema',k.kv_naam?kvL(k.kv_naam):null,...k.markeringen].filter(Boolean).join(' · '))}</div></div>`).join(''):'<div class="leeg">Geen open locaties deze week</div>';
  }
  async function laad(){
    const r=await api('GET','/api/vandaag'+location.search);
    if(r.status===401||r.status===403){location.href='/';return;}
    if(!r.ok){toast(r.json.error||'Vandaag laden mislukt','error');return;}
    DATA=r.json;teken();
  }
  document.addEventListener('click',async e=>{
    const rij=e.target.closest('[data-km]');if(rij&&!e.target.closest('button')){location.href='/kampmomenten?id='+rij.dataset.km;return;} // PL1: Deze week → het kampmoment
    const b=e.target.closest('button[data-k]');if(!b)return;
    const it=DATA[b.dataset.k][b.dataset.i],a=it.acties[b.dataset.j];
    // PL1: kampmoment zonder thema / planningsmelding → Kampmomenten; VC1: tekorten → Nakijken
    if(a.soort==='link'||a.soort==='tel'){location.href=a.url==='/#materiaal?tekorten'?'/nakijken':(a.url==='/#overzicht?conflicten'&&it.sub==='planning')?'/kampmomenten':a.url;return;} // VC1: tekorten/nakijken openen op de nieuwe Nakijken-pagina
    b.disabled=true;
    const r=await api(a.methode,a.url,a.body);
    b.disabled=false;
    if(!r.ok){toast(r.json.error||'Actie mislukt','error');return;}
    toast(a.label+': gelukt','success');
    laad();
  });
  $('rit-plannen').onclick=()=>{location.href='/ritplanning';};

  // Groot / Compact: voorkeur per gebruiker (GET/PUT /api/mij/voorkeuren).
  for(const [id,w] of [['wgG','groot'],['wgC','compact']])
    $(id).addEventListener('change',async()=>{const r=await api('PUT','/api/mij/voorkeuren',{vandaag_weergave:w});if(!r.ok)toast(r.json.error||'Weergave bewaren mislukt','error');});

  // Periode-kiezer: zelfde actie als de bestaande planner-kiezer (POST /api/periodes/:id/activeer), daarna herladen.
  async function periodes(){
    const r=await api('GET','/api/periodes');if(!r.ok)return;
    const sel=$('per-kies');
    sel.innerHTML=r.json.map(p=>`<option value="${p.id}"${p.actief?' selected':''}>${esc(p.naam)}</option>`).join('');
    sel.onchange=async()=>{
      const a=await api('POST','/api/periodes/'+sel.value+'/activeer');
      if(!a.ok){toast(a.json.error||'Periode wisselen mislukt','error');return;}
      location.reload();
    };
  }
  (async()=>{
    const vk=await api('GET','/api/mij/voorkeuren');
    if(vk.ok&&vk.json.vandaag_weergave==='compact')$('wgC').checked=true;
    await laad();periodes();
  })();
})();
