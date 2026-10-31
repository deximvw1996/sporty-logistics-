// public/vandaag.js — KO1: kantoor-startscherm "Vandaag" (design/KANTOOR-DEFINITIEF.html).
// Vult de pagina uit GET /api/vandaag; na elke actie opnieuw laden. Groot/Compact per gebruiker onthouden.
'use strict';
(function(){
  // MOB1: gsm-weergave (design/MOBIEL-DEFINITIEF.html, A2). Los van de browser, zodat de test ze met echte data-JSON kan aanroepen.
  const aUrl=u=>u==='/aanvullijst-print'?'/aanvullen':u; // AV1: de NU-kaart Aanvullen opent het aanvullen-scherm
  const escG=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const ROL={kantoor:'kantoor',chauffeur:'chauffeur',monitor:'monitor'};
  const GSM={
    kop(v,titel){const d=v.datum_tekst,n=v.n_dingen||0;return `<div class="kopA"><div class="l">${escG(ROL[v.gebruiker.rol]||v.gebruiker.rol)} · ${escG(d)}</div><b>${escG(titel||'Hallo '+v.gebruiker.naam)}</b>${titel?'':`<span>${n===0?'niets meer vandaag':n===1?'1 ding vandaag':n+' dingen vandaag'}</span>`}</div>`;},
    rij(x){return `<a class="rij" href="${escG(aUrl(x.url))}"><div class="ico">${escG(x.ico)}</div><div class="nm">${x.tijd?`<i>${escG(x.tijd)}</i> `:''}${escG(x.titel)}<b>${escG(x.sub)}</b></div><span class="pijl">›</span></a>`;},
    nu(n){return n?`<div class="nukaart"><div class="l">NU</div><div class="t">${escG(n.ico)} ${escG(n.titel)}</div><div class="s">${n.tijd?escG(n.tijd)+' · ':''}${escG(n.sub)}</div><a class="knop breed" href="${escG(aUrl(n.url))}">${escG(n.knop)}</a></div>`:'<div class="nukaart"><div class="l">NU</div><div class="t">✓ Niets te doen</div><div class="s">Er staat nu niets op je lijst.</div></div>';},
    // MOB3: kantoor op gsm — cijfers onderweg/locaties open, en Later deze periode, Deze week, Volgende week elk ingeklapt onder de Nu-kaart.
    kantoorExtra(k){
      if(!k)return '';
      const lat=[];['beslissen','inplannen','nakijken'].forEach(kol=>(k[kol]||[]).forEach(x=>{if(x.dringend===false)lat.push(x);}));
      const acht=x=>{const a=(x.acties||[]).find(y=>y.soort==='link');return `<a class="rij" ${a?`href="${escG(aUrl(a.url))}"`:''}><div class="ico">${escG(x.ico||'•')}</div><div class="nm">${escG(x.titel)}<b>${escG(x.sub)}</b></div>${a?'<span class="pijl">›</span>':''}</a>`;};
      const loc=l=>l.map(x=>`<a class="rij" href="/kampmomenten?id=${escG(x.kampmoment_id)}"><div class="nm"><i>${escG(x.dagen)}</i> ${escG(x.locatie)}<b>${escG([x.thema||'geen thema',x.kv_naam?'KV '+x.kv_naam.replace(/^KV\s/i,''):null].filter(Boolean).join(' · '))}</b></div><span class="pijl">›</span></a>`).join('')||'<div class="hint">Niets</div>';
      const blok=(kop,n,inhoud,id)=>`<details class="sec gsm-blok" id="${id}"><summary style="min-height:44px;display:flex;align-items:center;justify-content:space-between;font-weight:700;cursor:pointer">${escG(kop)}<span class="pil">${n}</span></summary>${inhoud}</details>`;
      const dezeWeek=k.week_label==='Volgende week'?[]:(k.deze_week||[]),volg=k.week_label==='Volgende week'?(k.volgende_week||[]):(k.volgende_week||[]);
      return `<div class="twee" id="k-cijfers"><div class="sec" style="flex:1;text-align:center"><b style="font-size:22px">${(k.cijfers||{}).ritten_onderweg||0}</b><div class="hint" style="margin:0">ritten onderweg</div></div><div class="sec" style="flex:1;text-align:center"><b style="font-size:22px">${(k.cijfers||{}).locaties_open||0}</b><div class="hint" style="margin:0">locaties open</div></div></div>`
        +blok('Later deze periode',lat.length,lat.map(acht).join('')||'<div class="hint">Niets dat later kan</div>','k-later')
        +blok(k.week_label==='Volgende week'?'Deze week (voorbij)':'Deze week',dezeWeek.length,loc(dezeWeek),'k-week')
        +blok('Volgende week',volg.length,loc(volg),'k-volgende');
    },
    vandaag(v){
      const m=v.meldingen||[];
      const meldRij=m.length?GSM.rij({ico:'🔔',tijd:'',titel:m.length===1?'1 melding':m.length+' meldingen',sub:m.slice(0,2).map(x=>x.titel).join(' · '),url:'/meldingen'}):'';
      const rijen=(v.daarna||[]).map(GSM.rij).join('')+meldRij;
      return GSM.kop(v)+`<div class="gbody">${GSM.nu(v.nu)}${rijen?`<div class="sec"><h3>Daarna</h3>${rijen}</div>`:''}${GSM.kantoorExtra(v.kantoor)}</div>`;
    },
    ritten(v){
      const rij=(r,dag)=>GSM.rij({ico:'🚚',tijd:(dag?dag+' ':'')+(r.tijd||''),titel:`Rit #${r.id}${r.voertuig?' · '+r.voertuig:''}${r.status==='gedaan'?' · gedaan':r.status==='onderweg'?' · onderweg':''}`,sub:r.stops.map(s=>s.naam+(s.slot==='vrij'?' (vrij)':' 🔒')).join(' → '),url:'/rit/'+r.token});
      const a=v.ritten_vandaag||[],b=v.ritten_morgen||[],k=v.ritten_komend||[],gk=v.gekozen;
      // MOB3: komende klaargezette ritten per dag + datumkeuze (een dag verder dan de lijst)
      const kiezer=`<div class="sec"><h3>Andere dag bekijken</h3><label style="display:flex;flex-direction:column;gap:4px;font-size:13px;color:#64748b">Kies een datum<input type="date" data-rdatum value="${escG(gk?gk.datum:'')}" min="${escG(v.datum||'')}" aria-label="Datum kiezen" style="height:44px;border:1px solid #cbd5e1;border-radius:10px;padding:0 10px;font:inherit;font-size:15px"></label>${gk?`<h3 style="margin-top:10px">${escG(gk.datum_tekst)}</h3>${gk.ritten.map(r=>rij(r)).join('')||'<div class="hint">Geen klaargezette ritten op deze dag</div>'}`:''}</div>`;
      return GSM.kop(v,'Ritten')+`<div class="gbody"><div class="sec"><h3>Vandaag</h3>${a.map(r=>rij(r)).join('')||'<div class="hint">Geen ritten vandaag</div>'}</div>${b.length?`<div class="sec"><h3>Morgen</h3>${b.map(r=>rij(r)).join('')}</div>`:''}${k.map(x=>`<div class="sec" data-komend="${escG(x.datum)}"><h3>${escG(x.datum_tekst)}</h3>${x.ritten.map(r=>rij(r)).join('')}</div>`).join('')}${kiezer}</div>`;
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
    const laadG=async()=>{const r=await api('GET','/api/vandaag?mijn=1');if(!r.ok)return toast(r.json.error||'Vandaag laden mislukt','error');V=r.json;if(V.gebruiker&&V.gebruiker.rol==='kantoor'){const kk=await api('GET','/api/vandaag');if(kk.ok)V.kantoor=kk.json;}$('gsm').hidden=false;$('gsm').innerHTML=GSM.scherm(V,tab);};
    window.addEventListener('sporty-live',()=>laadG()); // RT1
    document.addEventListener('change',async e=>{const t=e.target;if(!t.matches||!t.matches('[data-rdatum]')||!t.value)return;
      const r=await api('GET','/api/vandaag?mijn=1&datum='+encodeURIComponent(t.value));if(!r.ok)return toast(r.json.error||'Ritten laden mislukt','error');
      V.gekozen={datum:t.value,datum_tekst:r.json.datum_tekst,ritten:r.json.ritten_vandaag||[]};$('gsm').innerHTML=GSM.scherm(V,tab);});
    document.addEventListener('click',async e=>{
      const b=e.target.closest('button[data-gk]');if(!b)return;
      const a=V[b.dataset.gk][b.dataset.i].acties[b.dataset.j];
      if(a.soort==='link'||a.soort==='tel'){location.href=aUrl(a.url);return;}
      b.disabled=true;const r=await api(a.methode,a.url,a.body);b.disabled=false;
      if(!r.ok)return toast(r.json.error||'Actie mislukt','error');toast(a.label+': gelukt','success');laadG();
    });
    laadG();
  }
  // MOB3: een chauffeur ziet op desktop dezelfde lichte weergave als op gsm (geen lege kantoorkolommen).
  let eigenRol='';try{eigenRol=localStorage.getItem('sporty-rol')||'';}catch(e){/* geen opslag */}
  if(eigenRol==='chauffeur'){document.body.classList.add('alleen-gsm');startGsm();return;}
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
    // TF8 G2: één regel die zegt wat onder "Later" zit, zodat je niet hoeft uit te klappen om te weten of er iets dringends in zit.
    const ENK={'taken zonder rit':'taak zonder rit','ritten zonder bestuurder':'rit zonder bestuurder',tekorten:'tekort',planningsmeldingen:'planningsmelding',capaciteitsmeldingen:'capaciteitsmelding',conflicten:'conflict'};
    const laterRegel=l=>{const n={};l.forEach(([x])=>{const s=/^taak-/.test(x.id)?'taken zonder rit':/^rit-/.test(x.id)?'ritten zonder bestuurder':x.id==='tekorten'?'tekorten':x.sub==='planning'?'planningsmeldingen':x.sub==='capaciteitsconflict'?'capaciteitsmeldingen':'conflicten';n[s]=(n[s]||0)+1;});return Object.keys(n).map(k=>n[k]+' '+(n[k]===1?ENK[k]:k)).join(' · ')+(l.length?' · niets dringends':'');};
    let lb=$('later-blok');
    if(!lb){lb=document.createElement('details');lb.id='later-blok';lb.style.cssText='margin:12px 0;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc';const kols=document.querySelector('.kols');kols.parentNode.insertBefore(lb,kols.nextSibling);}
    const open=lb.open;
    lb.hidden=!later.length;
    lb.innerHTML=`<summary style="cursor:pointer;font-weight:700;min-height:36px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">Later deze periode · ${later.length}<span style="font-weight:400;color:#64748b;font-size:13px">${esc(laterRegel(later))}</span></summary><div style="margin-top:6px">${later.map(([x,i,k])=>item(x,i,k)).join('')}</div>`;
    lb.open=open;
    const tel=(id,n)=>{const b=$(id);b.textContent=n;b.hidden=!n;};
    tel('b-vandaag',v.beslissen.length);tel('b-transport',v.inplannen.length);
    api('GET','/api/meldingen').then(m=>{const b=$('b-meldingen');if(b&&m.ok){b.textContent=m.json.ongelezen||0;b.hidden=!m.json.ongelezen;}}).catch(()=>{}); // TF6 N5: teller bij Meldingen in de balk
    $('c-onderweg').textContent=v.cijfers.ritten_onderweg;$('c-open').textContent=v.cijfers.locaties_open;
    $('n-ritten').textContent=v.ritten_vandaag.length;
    const ritRij=r=>{
      const pil=r.status==='onderweg'?`<span class="pil blauw">stop ${r.stop_huidig}/${r.stops_totaal}</span>`:r.status==='gedaan'?'<span class="pil groen">gedaan</span>':'<span class="pil">gepland</span>';
      const stops=r.stops.map(s=>esc(s.naam)+(s.slot==='vrij'?' <span class="pil oranje">vrij</span>':' 🔒')).join(' → ');
      return `<div class="rit"><div class="u">${esc(r.tijd)}</div><div class="nm"><b>${esc([r.chauffeur||'geen chauffeur',r.voertuig].filter(Boolean).join(' · '))} ${pil}</b>${stops}${r.meting?`<div style="font-size:12px;color:#334155">${esc(r.meting)}</div>`:''}</div></div>`;
    };
    // GF1: onder de ritten van vandaag staan die van morgen (zelfde rijstijl), zodat kantoor op donderdag de leveringen van vrijdag ziet.
    const morgen=(v.ritten_morgen||[]);
    $('l-ritten').innerHTML='<div style="font-size:11px;color:#64748b;margin-bottom:4px">🔒 = vaste stop (afgesproken tijd) · vrij = mag verschuiven</div>'+(v.ritten_vandaag.length?v.ritten_vandaag.map(ritRij).join(''):'<div class="leeg">Geen ritten vandaag</div>')
      +(morgen.length?'<div class="morgen-kop" style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin:10px 0 2px">Morgen · '+morgen.length+'</div>'+morgen.map(ritRij).join(''):'');
    const wk=v.week_label==='Volgende week'?(v.volgende_week||[]):v.deze_week;
    $('t-week').textContent=v.week_label||'Deze week';
    $('n-week').textContent=wk.length+' locatie'+(wk.length===1?'':'s');
    $('l-week').innerHTML=wk.length?wk.map(k=>`<div class="rit" data-km="${k.kampmoment_id}" style="cursor:pointer"><div class="u">${esc(k.dagen)}</div><div class="nm"><b>${esc(k.locatie)}</b>${
      esc([k.thema||'geen thema',k.kv_naam?kvL(k.kv_naam):null,...k.markeringen].filter(Boolean).join(' · '))}</div></div>`).join(''):'<div class="leeg">Geen open locaties deze week</div>';
  }
  window.addEventListener('sporty-live',()=>laad()); // RT1
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
    sel.title='Let op: dit wisselt de actieve periode voor alle schermen en alle gebruikers, niet alleen voor jou.'; // TF8
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
