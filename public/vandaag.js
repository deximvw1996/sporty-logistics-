// public/vandaag.js — KO1: kantoor-startscherm "Vandaag" (design/KANTOOR-DEFINITIEF.html).
// Vult de pagina uit GET /api/vandaag; na elke actie opnieuw laden. Groot/Compact per gebruiker onthouden.
'use strict';
(function(){
  // MOB1: gsm-weergave (design/MOBIEL-DEFINITIEF.html, A2). Los van de browser, zodat de test ze met echte data-JSON kan aanroepen.
  const aUrl=u=>u==='/aanvullijst-print'?'/aanvullen':u; // AV1: de NU-kaart Aanvullen opent het aanvullen-scherm
  const escG=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const ROL={kantoor:'kantoor',chauffeur:'chauffeur',coordinator:'coördinator',monitor:'monitor'};
  const GSM={
    kop(v,titel){const d=v.datum_tekst,n=v.n_dingen||0;return `<div class="kopA"><div class="l">${escG(ROL[v.gebruiker.rol]||v.gebruiker.rol)} · ${escG(d)}</div><b>${escG(titel||'Hallo '+v.gebruiker.naam)}</b>${titel?'':`<span>${n===0?'niets meer vandaag':n===1?'1 ding vandaag':n+' dingen vandaag'}</span>`}</div>`;},
    rij(x){return `<a class="rij" href="${escG(aUrl(x.url))}"><div class="ico">${escG(x.ico)}</div><div class="nm">${x.tijd?`<i>${escG(x.tijd)}</i> `:''}${escG(x.titel)}<b>${escG(x.sub)}</b></div><span class="pijl">›</span></a>`;},
    nu(n){return n?`<div class="nukaart"><div class="l">NU</div><div class="t">${escG(n.ico)} ${escG(n.titel)}</div><div class="s">${n.tijd?escG(n.tijd)+' · ':''}${escG(n.sub)}</div><a class="knop breed" href="${escG(aUrl(n.url))}">${escG(n.knop)}</a></div>`:'<div class="nukaart"><div class="l">NU</div><div class="t">✓ Niets te doen</div><div class="s">Er staat nu niets op je lijst.</div></div>';},
    vandaag(v){
      const m=v.meldingen||[];
      const meldRij=m.length?GSM.rij({ico:'🔔',tijd:'',titel:m.length===1?'1 melding':m.length+' meldingen',sub:m.slice(0,2).map(x=>x.titel).join(' · '),url:'/meldingen'}):'';
      const rijen=(v.daarna||[]).map(GSM.rij).join('')+meldRij;
      return GSM.kop(v)+`<div class="gbody">${GSM.nu(v.nu)}${rijen?`<div class="sec"><h3>Daarna</h3>${rijen}</div>`:''}</div>`;
    },
    ritten(v){
      const rij=(r,dag)=>GSM.rij({ico:'🚚',tijd:(dag?dag+' ':'')+(r.tijd||''),titel:`Rit #${r.id}${r.voertuig?' · '+r.voertuig:''}${r.status==='gedaan'?' · gedaan':r.status==='onderweg'?' · onderweg':''}`,sub:r.stops.map(s=>s.naam+(s.slot==='vrij'?' (vrij)':' 🔒')).join(' → '),url:'/rit/'+r.token});
      const a=v.ritten_vandaag||[],b=v.ritten_morgen||[];
      return GSM.kop(v,'Ritten')+`<div class="gbody"><div class="sec"><h3>Vandaag</h3>${a.map(r=>rij(r)).join('')||'<div class="hint">Geen ritten vandaag</div>'}</div>${b.length?`<div class="sec"><h3>Morgen</h3>${b.map(r=>rij(r)).join('')}</div>`:''}</div>`;
    },
    // Kantoor: meldingen en beslissingen met de knoppen uit /api/vandaag; ploeg: alleen lezen.
    lijst(v,lijst,titel,leeg,kol){
      const it=(x,i)=>`<div class="rij" style="flex-wrap:wrap"><div class="ico">${escG(x.ico||'🔔')}</div><div class="nm">${escG(x.titel)}<b>${escG(x.sub)}</b></div></div>${(x.acties||[]).length?`<div class="acts">${x.acties.map((a,j)=>`<button class="knop klein ${a.primair?'':'licht'}" data-gk="${kol}" data-i="${i}" data-j="${j}">${escG(a.label)}</button>`).join('')}</div>`:''}`;
      return GSM.kop(v,titel)+`<div class="gbody"><div class="sec">${lijst.map(it).join('')||`<div class="hint">${escG(leeg)}</div>`}</div></div>`;
    },
    scherm(v,tab){
      if(tab==='ritten')return GSM.ritten(v);
      if(tab==='meldingen')return GSM.lijst(v,v.meldingen||[],'Meldingen','Geen open meldingen','meldingen');
      if(tab==='beslissen')return GSM.lijst(v,v.beslissen||[],'Beslissen','Niets te beslissen','beslissen');
      return GSM.vandaag(v);
    }
  };
  if(typeof module!=='undefined'&&module.exports){module.exports=GSM;return;}
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
    return window.sportyApi(methode,url,body,{toast:m=>toast(m,'info'),token:TOKEN||''});
  }
  if(!TOKEN){location.href='/';return;}
  function startGsm(){
    const tab=new URLSearchParams(location.search).get('tab')||'';
    let V=null;
    const laadG=async()=>{const r=await api('GET','/api/vandaag?mijn=1');if(!r.ok)return toast(r.json.error||'Vandaag laden mislukt','error');V=r.json;$('gsm').hidden=false;$('gsm').innerHTML=GSM.scherm(V,tab);};
    document.addEventListener('click',async e=>{
      const b=e.target.closest('button[data-gk]');if(!b)return;
      const a=V[b.dataset.gk][b.dataset.i].acties[b.dataset.j];
      if(a.soort==='link'||a.soort==='tel'){location.href=aUrl(a.url);return;}
      b.disabled=true;const r=await api(a.methode,a.url,a.body);b.disabled=false;
      if(!r.ok)return toast(r.json.error||'Actie mislukt','error');toast(a.label+': gelukt','success');laadG();
    });
    laadG();
  }
  if(window.matchMedia('(max-width:767px)').matches){startGsm();return;}

  let DATA=null;
  const item=(x,i,kol)=>`<div class="it ${x.kleur}"><span class="ico">${esc(x.ico)}</span><span class="nm">${esc(x.titel)}<b>${esc(x.sub)}</b></span><span class="acts">${
    x.acties.map((a,j)=>`<button class="knop ${a.primair?'':'licht'}" data-k="${kol}" data-i="${i}" data-j="${j}">${esc(a.label)}</button>`).join('')}</span></div>`;
  const LEEG={beslissen:'Niets te beslissen',inplannen:'Niets in te plannen',nakijken:'Niets te controleren'};
  function teken(){
    const v=DATA;
    $('per-naam').textContent=v.periode?v.periode.naam:'geen periode';
    $('wie').textContent=(v.gebruiker.naam||'')+' · kantoor';
    $('kop-sub').textContent=[v.datum_tekst,v.week?'kampweek '+v.week:null,'bovenaan wat vandaag moet · planning voor later staat eronder'].filter(Boolean).join(' · ');
    // TF6 N2: wat vandaag/morgen moet staat in de kolommen; planning voor later gaat in het ingeklapte blok "Later deze periode".
    const later=[];
    for(const k of ['beslissen','inplannen','nakijken']){
      const nu=v[k].map((x,i)=>[x,i]).filter(([x])=>x.dringend!==false);
      v[k].forEach((x,i)=>{if(x.dringend===false)later.push([x,i,k]);});
      $('n-'+k).textContent=nu.length;
      $('l-'+k).innerHTML=nu.length?nu.map(([x,i])=>item(x,i,k)).join(''):`<div class="leeg">${LEEG[k]}</div>`;
    }
    let lb=$('later-blok');
    if(!lb){lb=document.createElement('details');lb.id='later-blok';lb.style.cssText='margin:12px 0;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc';const kols=document.querySelector('.kols');kols.parentNode.insertBefore(lb,kols.nextSibling);}
    const open=lb.open;
    lb.hidden=!later.length;
    lb.innerHTML=`<summary style="cursor:pointer;font-weight:700;min-height:36px;display:flex;align-items:center">Later deze periode · ${later.length}</summary><div style="margin-top:6px">${later.map(([x,i,k])=>item(x,i,k)).join('')}</div>`;
    lb.open=open;
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
    const wk=v.week_label==='Volgende week'?(v.volgende_week||[]):v.deze_week;
    $('t-week').textContent=v.week_label||'Deze week';
    $('n-week').textContent=wk.length+' locatie'+(wk.length===1?'':'s');
    $('l-week').innerHTML=wk.length?wk.map(k=>`<div class="rit" data-km="${k.kampmoment_id}" style="cursor:pointer"><div class="u">${esc(k.dagen)}</div><div class="nm"><b>${esc(k.locatie)}</b>${
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
    if(a.soort==='link'||a.soort==='tel'){location.href=aUrl(a.url);return;}
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
    // TF3 G33: wie geen kantoor is, ziet ook op desktop zijn eigen Vandaag; de rol komt uit de sessie.
    const w=await api('GET','/api/wie-ben-ik');
    if(w.ok&&w.json.rol!=='kantoor'){const f=document.querySelector('body>.frame');if(f)f.style.display='none';$('gsm').style.maxWidth='640px';$('gsm').style.margin='0 auto';startGsm();return;}
    const vk=await api('GET','/api/mij/voorkeuren');
    if(vk.ok&&vk.json.vandaag_weergave==='compact')$('wgC').checked=true;
    await laad();periodes();
  })();
})();
