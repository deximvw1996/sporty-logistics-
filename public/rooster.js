// public/rooster.js — PL2: Planning › Rooster, Week en Seizoen (design/mockup-planning-v3.html).
// Week uit GET /api/rooster/week?week=, Seizoen uit GET /api/rooster/seizoen; panelen uit /api/rooster/kampmoment/:id en /api/rooster/thema/:id.
// Wissel = keuzelijst (/api/rooster/wissel-opties, voorstellen eerst) → POST /api/rooster/wissel (gelogd). Meldingen zijn uitleg, nooit een verbod.
// De HTML-bouwers (BOUW) zijn los van de browser, zodat de test ze met echte data-JSON kan aanroepen.
'use strict';
(function(){
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const TEKEN={dubbel:'⚠',herhaald:'↻',gedeeld:'◐'},KLAS={dubbel:'dub',herhaald:'her',gedeeld:'ged'};
  const klasVan=m=>m.includes('dubbel')?'dub':m.includes('herhaald')?'her':m.includes('gedeeld')?'ged':'';
  const tekens=m=>['dubbel','herhaald','gedeeld'].filter(x=>m.includes(x)).map(x=>TEKEN[x]).join('');
  const label=t=>`<span class="tg ${klasVan(t.meldingen)}"><i>${esc(t.groep)}</i>${esc(t.naam)}${t.meldingen.length?' '+tekens(t.meldingen):''}</span>`;
  const kv=(k,x)=>`<div class="kv"><span>${k}</span><b>${x}</b></div>`;
  const dm=s=>{if(!s)return '';const d=new Date(s+'T12:00:00');return `${['zo','ma','di','wo','do','vr','za'][d.getDay()]} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;};
  const LEG_WEEK='<span class="leg"><span class="tg dub">⚠ dubbel</span><span class="tg her">↻ 2 weken na elkaar</span><span class="tg ged">◐ te weinig gedeeld materiaal</span></span>';
  const LEG_SEIZ='<span class="leg"><span class="tg dub">⚠ 2 locaties tegelijk</span><span class="tg her">↻ zelfde locatie 2 weken na elkaar</span></span>';
  const BOUW={
    label,
    filtersWeek(O,f){
      const c=(k,t)=>`<span class="chip ${f===k?'act':''}" data-f="${k}">${t} ${O.tellers[k]}</span>`;
      return `<span class="wis"><button class="knop licht klein" data-week="-1" aria-label="Vorige week"${O.week.nr<=1?' disabled':''}>‹</button><b>${esc(O.week.label)}</b><button class="knop licht klein" data-week="1" aria-label="Volgende week"${O.week.nr>=O.weken?' disabled':''}>›</button></span><span class="seg"><a class="act" data-zicht="week">Week</a><a data-zicht="seizoen">Seizoen</a></span>${c('alle','Alle')}${c('dubbel','⚠ Dubbel')}${c('herhaald','↻ Herhaald')}${c('gedeeld','◐ Gedeeld')}${c('gesloten','⛔ Gesloten')}${c('geen_kv','Geen KV')}`;
    },
    filtersSeizoen(S,f,zoek){
      const c=(k,t)=>`<span class="chip ${f===k?'act':''}" data-f="${k}">${t} ${S.tellers[k]}</span>`;
      return `<span class="seg"><a data-zicht="week">Week</a><a class="act" data-zicht="seizoen">Seizoen</a></span><input id="zoek" placeholder="🔍 Zoek thema of locatie…" value="${esc(zoek||'')}">${c('alle','Alle')}${c('dubbel','⚠ Dubbel')}${c('herhaald','↻ Herhaald')}${c('niet_gebruikt','Niet gebruikt')}`;
    },
    weekRij(l,{act,sel}={}){
      return `<div class="r ${act?'act':''}" data-km="${l.kampmoment_id}"><span><input type="checkbox" data-sel="${l.kampmoment_id}" ${sel?'checked':''} aria-label="Selecteer ${esc(l.naam)}"></span><span><b>${esc(l.naam)}</b></span><span class="tgs">${l.themas.map(label).join('')||'<span class="k">geen thema</span>'}${(l.gesloten||[]).length?`<span class="tg dub" title="gesloten dag">⛔ gesloten ${esc(l.gesloten.map(g=>g.tekst).join(', '))}</span>`:''}</span><span>${l.kv?esc(l.kv):'<span style="color:#a16207;font-weight:600">geen KV</span>'}</span><span class="k">${l.sport.length?l.sport.map(esc).join(' · '):'—'}</span></div>`;
    },
    // MOB2: gsm-weergave van de week (design/mockup-gsm-1.html, telefoon Planning › Rooster): weekkeuze, chips die horizontaal scrollen, elke locatie een kaart.
    filtersWeekGsm(O,f){
      const c=(k,t)=>`<span class="chip ${f===k?'act':''}" data-f="${k}" role="button">${t} ${O.tellers[k]}</span>`;
      return `<div class="wk"><button class="knop licht klein" data-week="-1" aria-label="Vorige week"${O.week.nr<=1?' disabled':''}>‹</button><b>${esc(O.week.label)}</b><button class="knop licht klein" data-week="1" aria-label="Volgende week"${O.week.nr>=O.weken?' disabled':''}>›</button></div><div class="chipsS"><span class="seg"><a class="act" data-zicht="week">Week</a><a data-zicht="seizoen">Seizoen</a></span>${c('alle','Alle')}${c('dubbel','⚠ Dubbel')}${c('herhaald','↻ Herhaald')}${c('gedeeld','◐ Gedeeld')}${c('gesloten','⛔ Gesloten')}${c('geen_kv','Geen KV')}</div>`;
    },
    weekKaart(l,{act}={}){
      return `<div class="r gk ${act?'act':''}" data-km="${l.kampmoment_id}" role="button" tabindex="0"><div class="gkop"><b>${esc(l.naam)}</b>${l.kv?`<span>KV ${esc(l.kv)}</span>`:'<span class="geen">geen KV</span>'}</div><div class="tgs">${l.themas.map(label).join('')||'<span class="k">geen thema</span>'}${(l.gesloten||[]).length?`<span class="tg dub">⛔ gesloten ${esc(l.gesloten.map(g=>g.tekst).join(', '))}</span>`:''}</div>${l.meldingen_n?`<div class="gmeld">${l.meldingen_n} melding${l.meldingen_n===1?'':'en'} ›</div>`:''}</div>`;
    },
    voetWeek(n,nTh){return `<span>${n} locatie${n===1?'':'s'} · ${nTh} thema's</span>${LEG_WEEK}`;},
    voetSeizoen(){return `<span>één rij per thema (elk thema bestaat 1×) · cel = waar het die week staat</span>${LEG_SEIZ}`;},
    raster(S,rijen,sel){
      const n=S.weken.length;
      const kop=`<span class="h">Thema</span>${S.weken.map(w=>`<span class="h ${S.huidige_week===w.nr?'nu':''}" title="${esc(w.label)}">wk ${w.nr}</span>`).join('')}`;
      const body=rijen.map(r=>`<span class="l ${sel&&sel.thema===r.thema_id?'act':''}" data-thema="${r.thema_id}" title="${esc(r.naam)}">${esc(r.naam)}</span>`+r.weken.map(w=>{
        if(!w.locaties.length)return '<span class="c leeg"></span>';
        const k=w.dubbel?'dub':w.herhaald?'her':'';const s=sel&&sel.thema===r.thema_id&&sel.week===w.week?' sel':'';
        const naam=w.locaties.map(l=>l.naam.replace(/^Abdijschool Vlierbeek$/,'Abdij')).join(' + ')+(w.dubbel?' ⚠':w.herhaald?' ↻':'');
        return `<span class="c ${k}${s}" data-thema="${r.thema_id}" data-wk="${w.week}" title="${esc(w.locaties.map(l=>l.naam+' '+l.groep).join(' · '))}">${esc(naam)}</span>`;
      }).join('')).join('');
      return `<div class="sgrid" style="grid-template-columns:120px repeat(${n},1fr);--nw:${n}">${kop}${body||`<span class="l" style="grid-column:1/-1;padding:30px;text-align:center;color:#64748b">Geen thema's voor deze filter</span>`}</div>`;
    },
    kmPaneel(D,tab){
      const k=D.kampmoment,w=D.week.nr,nMeld=D.let_op.length,nGroep=D.groepen.filter(g=>g.deze).length;
      const cel=(x,nu)=>{if(!x)return `<span${nu?' class="nu"':''}>—</span>`;const kl=[nu?'nu':'',klasVan(x.meldingen)].filter(Boolean).join(' ');return `<span class="${kl}">${esc(x.naam)}${nu&&x.meldingen.length?' '+tekens(x.meldingen):''}${nu&&x.kt_id?` <button class="knop licht klein wis" data-wissel="${x.kt_id}" aria-label="Wissel ${esc(x.naam)}">Wissel</button>`:''}</span>`;};
      const tw=`<div class="blok vol"><h4>Thema's per groep · week ervoor en erna</h4><div class="tw"><span class="h">Groep</span><span class="h">${D.vorige_week?'wk '+D.vorige_week:'—'}</span><span class="h nu">wk ${w}</span><span class="h">${D.volgende_week?'wk '+D.volgende_week:'—'}</span>
        ${D.groepen.map(g=>`<span class="g">${esc(g.groep)}</span>${cel(g.voor)}${cel(g.deze,true)}${cel(g.na)}`).join('')}</div></div>`;
      const kleur={dubbel:'#b91c1c',herhaald:'#c2410c',gedeeld:'#7c3aed',gesloten:'#b45309'};
      const letop=`<div class="blok"><h4>Let op (${nMeld})</h4>${D.let_op.map(l=>`<div class="rij"><div class="nm" style="color:${kleur[l.soort]}">${esc(l.tekst)}<b>${esc(l.uitleg)}</b></div>${l.soort==='gesloten'?'':`<button class="knop licht klein" ${l.soort==='gedeeld'?`data-toon="${esc(l.key)}"`:`data-wissel="${l.kt_id}"`}>${esc(l.knop)}</button>`}</div>`).join('')||'<div class="rij"><div class="nm">Geen meldingen</div></div>'}</div>`;
      const rit=(t,x)=>x?`${dm(x.datum)}${x.rit_id?` · rit #${x.rit_id}`:' · nog geen rit'}`:'nog niet gepland';
      const st=`<div class="blok"><h4>Sport en transport</h4>${D.sport.map(s=>kv(esc(s),'deze week')).join('')||kv('Sport','—')}${kv('Brengen',esc(rit('b',D.transport.brengen)))}${kv('Halen',esc(rit('h',D.transport.halen)))}</div>`;
      const ged=`<div class="blok"><h4>Gedeeld materiaal <a href="/gedeeld?week=${w}&periode_id=${k.periode_id}">Gedeeld materiaal ›</a></h4>${D.gedeeld.map(s=>kv(esc(s.naam),`${s.hier} van ${s.beschikbaar}${s.nodig!==s.hier?` · deze week samen ${s.nodig}`:''}${s.stand==='te_weinig'?' ◐':''}${s.aanvaard.length?` · zonder: ${esc(s.aanvaard.join(', '))}`:''}`)).join('')||'<div class="rij"><div class="nm">Geen gedeeld materiaal deze week</div></div>'}</div>`;
      const zomer=`<div class="blok vol"><h4>${esc(k.locatie)} · hele periode</h4>${D.zomer.map(z=>`<div class="rij"><div class="nm">week ${z.week}${z.week===w?' (deze)':''}<b>${z.themas.map(t=>`${esc(t.groep)} ${esc(t.naam)}${t.meldingen.length?' '+tekens(t.meldingen):''}`).join(' · ')||'geen thema'}${z.kv?' · KV '+esc(z.kv):''}</b></div>${z.week!==w?`<button class="knop licht klein" data-naarweek="${z.week}">Toon</button>`:''}</div>`).join('')}</div>`;
      const hist=`<div class="blok vol"><h4>Historiek (alles gelogd)</h4>${D.historiek.map(h=>`<div class="rij"><div class="nm">${esc(h.wat)}<b>${esc(h.t)} · ${esc(h.wie)}</b></div></div>`).join('')||'<div class="rij"><div class="nm">Nog niets gelogd</div></div>'}</div>`;
      const inhoud={week:tw+letop+st+ged,zomer,historiek:hist}[tab]||'';
      const sub=[D.week.kort,`${nGroep} groep${nGroep===1?'':'en'}`,k.kv?'KV '+k.kv:'geen KV',`${nMeld} melding${nMeld===1?'':'en'}`].map(esc).join(' · ');
      return `<a class="terug" data-act="terug">‹ terug naar de lijst</a><div class="dkop"><div><h2>${esc(k.locatie)} · week ${w}</h2><span>${sub}</span></div><div class="acts"><button class="knop licht" data-pweek="-1"${D.vorige_week?'':' disabled'}>‹ wk ${D.vorige_week||w-1}</button><button class="knop licht" data-pweek="1"${D.volgende_week?'':' disabled'}>wk ${D.volgende_week||w+1} ›</button><button class="knop" data-open="${k.id}">Open kampmoment</button></div></div>
        <div class="dtabs">${[['week','Week'],['zomer','Hele periode'],['historiek','Historiek']].map(([x,t])=>`<a class="${tab===x?'act':''}" data-tab="${x}">${t}</a>`).join('')}</div><div class="dgrid"${tab==='week'?'':' style="grid-template-columns:1fr"'}>${inhoud}</div>`;
    },
    themaPaneel(D){
      const t=D.thema,lg=t.leeftijdsgroep?(/^k/i.test(t.leeftijdsgroep)?'KL':/^l/i.test(t.leeftijdsgroep)?'LS':t.leeftijdsgroep):'LS/KL';
      const kleur={dubbel:'#b91c1c',herhaald:'#c2410c'};
      const waar=`<div class="blok vol"><h4>Waar staat ${esc(t.naam)}</h4>${D.plaatsen.map(p=>{const m=p.meldingen.includes('dubbel')?'dubbel':p.meldingen.includes('herhaald')?'herhaald':'';
        return `<div class="rij"><div class="nm"${m?` style="color:${kleur[m]}"`:''}>week ${p.week} · ${esc(p.locatie)}${m?' '+TEKEN[m]:''}<b>${m?esc(p.uitleg):[esc(p.groep),p.kv?'KV '+esc(p.kv):'geen KV',p.brengen_rit?'brengen rit #'+p.brengen_rit:''].filter(Boolean).join(' · ')}</b></div>${m?`<button class="knop licht klein" data-wissel="${p.kt_id}">Wissel</button>`:''}</div>`;}).join('')||'<div class="rij"><div class="nm">Niet ingepland in deze periode</div></div>'}</div>`;
      const vrij=`<div class="blok"><h4>Vrij in</h4>${kv('Weken',D.vrij.length?D.vrij.join(' · '):'geen')}${kv('Voorstel',D.voorstel?esc(D.voorstel.tekst):'—')}</div>`;
      const ged=`<div class="blok"><h4>Gedeeld materiaal</h4>${D.gedeeld.map(s=>kv(esc(s.naam),`${s.andere.length?'ook in '+esc(s.andere.join(', ')):'alleen in '+esc(t.naam)} · ${s.beschikbaar} ${esc(s.eenheid)}`)).join('')||'<div class="rij"><div class="nm">Geen gedeeld materiaal</div></div>'}</div>`;
      const n=new Set(D.plaatsen.map(p=>p.locatie)).size;
      return `<a class="terug" data-act="terug">‹ terug naar de lijst</a><div class="dkop"><div><h2>${esc(t.naam)} · hele periode</h2><span>Thema ${esc(lg)} · ${t.bakken} themabak${t.bakken===1?'':'ken'} · ${n} locatie${n===1?'':'s'} ingepland</span></div><div class="acts"><button class="knop licht" data-openthema="${t.id}">Open thema</button><button class="knop" data-naarweekbeeld="${D.plaatsen[0]?D.plaatsen[0].week:''}">Naar weekbeeld</button></div></div>
        <div class="dgrid">${waar}${vrij}${ged}</div>`;
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
  const Q=new URLSearchParams(location.search);
  let ZICHT=Q.get('zicht')==='seizoen'?'seizoen':'week',WEEK=parseInt(Q.get('week'))||0,PER=parseInt(Q.get('periode_id'))||0,FILTER=Q.get('f')||'alle',ZOEK='',TAB='week';
  let O=null,S=null,D=null,TH=null,SEL=new Set(),CEL=null;
  const pq=()=>PER?`periode_id=${PER}`:'';
  function bewaarUrl(){const u=new URLSearchParams();if(ZICHT==='seizoen')u.set('zicht','seizoen');if(WEEK)u.set('week',WEEK);if(PER)u.set('periode_id',PER);if(FILTER!=='alle')u.set('f',FILTER);history.replaceState(null,'','/rooster'+(u.toString()?'?'+u:''));}
  const FW={alle:()=>true,dubbel:l=>l.themas.some(t=>t.meldingen.includes('dubbel')),herhaald:l=>l.themas.some(t=>t.meldingen.includes('herhaald')),gedeeld:l=>l.themas.some(t=>t.meldingen.includes('gedeeld')),geen_kv:l=>!l.kv,gesloten:l=>(l.gesloten||[]).length>0};
  const FS={alle:r=>r.n>0,dubbel:r=>r.dubbel,herhaald:r=>r.herhaald,niet_gebruikt:r=>r.n===0};
  const zichtbaarWeek=()=>O.locaties.filter(FW[FW[FILTER]?FILTER:'alle']);
  const zichtbaarSeizoen=()=>(FILTER==='niet_gebruikt'?S.niet_gebruikt:S.themas).filter(FS[FS[FILTER]?FILTER:'alle']).filter(r=>!ZOEK||r.naam.toLowerCase().includes(ZOEK)||r.weken.some(w=>w.locaties.some(l=>l.naam.toLowerCase().includes(ZOEK))));

  window.addEventListener('sporty-live',()=>laad()); // RT1
  async function laad(){
    bewaarUrl();
    $('f1')&&($('f1').id='f1');document.querySelector('.frame').id=ZICHT==='week'?'f1':'f2';
    if(ZICHT==='week'){
      const r=await api('GET',`/api/rooster/week?${pq()}${WEEK?'&week='+WEEK:''}`);
      if(r.status===401||r.status===403){location.href='/';return;}
      if(!r.ok)return toast(r.json.error||'Rooster laden mislukt','error');
      O=r.json;WEEK=O.week.nr;if(!FW[FILTER])FILTER='alle';bewaarUrl();
    }else{
      const r=await api('GET',`/api/rooster/seizoen?${pq()}`);
      if(r.status===401||r.status===403){location.href='/';return;}
      if(!r.ok)return toast(r.json.error||'Seizoen laden mislukt','error');
      S=r.json;if(!FS[FILTER])FILTER='alle';
    }
    teken();
  }
  function teken(){
    const week=ZICHT==='week';
    $('kopr').style.display=week?'':'none';$('lijst').classList.toggle('raster',!week);
    if(week){
      const gsm=window.matchMedia&&window.matchMedia('(max-width:767px)').matches;
      $('filters').innerHTML=gsm?BOUW.filtersWeekGsm(O,FILTER):BOUW.filtersWeek(O,FILTER);$('filters').classList.toggle('gs',!!gsm);
      const l=zichtbaarWeek();
      $('lijst').innerHTML=l.length?l.map(x=>(gsm?BOUW.weekKaart:BOUW.weekRij)(x,{act:D&&D.kampmoment.id===x.kampmoment_id,sel:SEL.has(x.kampmoment_id)})).join(''):'<div class="leeg">Geen locaties voor deze filter</div>';
      $('voet').innerHTML=BOUW.voetWeek(l.length,l.reduce((n,x)=>n+x.themas.length,0));
      $('alles').checked=l.length>0&&l.every(x=>SEL.has(x.kampmoment_id));
    }else{
      $('filters').innerHTML=BOUW.filtersSeizoen(S,FILTER,ZOEK);$('filters').classList.remove('gs');
      $('lijst').innerHTML=BOUW.raster(S,zichtbaarSeizoen(),CEL);
      $('voet').innerHTML=BOUW.voetSeizoen();
      const z=$('zoek');z.oninput=e=>{ZOEK=e.target.value.trim().toLowerCase();const p=z.selectionStart;teken();const n=$('zoek');n.focus();n.setSelectionRange(p,p);};
    }
    if(week&&D)$('detail').innerHTML=BOUW.kmPaneel(D,TAB);
    else if(!week&&TH)$('detail').innerHTML=BOUW.themaPaneel(TH);
    else $('detail').innerHTML=`<div class="leegd">${week?'Klik een locatie in de lijst voor het detail.':'Klik een thema of een cel voor de hele zomer.'}</div>`;
  }
  async function openKm(id,stil){
    const r=await api('GET',`/api/rooster/kampmoment/${id}`);if(!r.ok)return toast(r.json.error||'Detail laden mislukt','error');
    D=r.json;teken();if(!stil)$('body').classList.add('toon-detail');
  }
  async function openThema(id,wk,stil){
    const r=await api('GET',`/api/rooster/thema/${id}?${pq()}`);if(!r.ok)return toast(r.json.error||'Thema laden mislukt','error');
    TH=r.json;CEL={thema:id,week:wk||null};teken();if(!stil)$('body').classList.add('toon-detail');
  }
  function kies({titel,opties,ok='Wissel'}){
    return new Promise(resolve=>{
      const bg=document.createElement('div');bg.className='mbg';
      bg.innerHTML=`<div class="mbox" role="dialog" aria-modal="true"><h4>${esc(titel)}</h4><input class="zk" placeholder="🔍 Zoek thema…" style="display:block;width:100%;height:38px;border:1px solid #cbd5e1;border-radius:8px;padding:0 10px;font:inherit;margin-bottom:8px"><div class="keuzes"></div><div class="knoppen" style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px"><button class="knop licht" data-x="0">Annuleren</button><button class="knop" data-x="1" disabled>${esc(ok)}</button></div></div>`;
      let gekozen=null;const lijst=bg.querySelector('.keuzes'),zk=bg.querySelector('.zk'),okb=bg.querySelector('[data-x="1"]');
      const toon=()=>{const q=zk.value.trim().toLowerCase();lijst.innerHTML=opties.filter(o=>!q||o.naam.toLowerCase().includes(q)).slice(0,80).map(o=>`<div data-id="${o.thema_id}" class="${o.voorgesteld?'vs':''} ${gekozen===o.thema_id?'act':''}">${esc(o.naam)}${o.voorgesteld?'<small>voorstel · vrij deze week, niet eerder op deze locatie</small>':''}</div>`).join('')||'<div>Geen thema gevonden</div>';};
      const sluit=v=>{document.removeEventListener('keydown',toets,true);bg.remove();resolve(v);};
      const toets=e=>{if(e.key==='Escape'){e.preventDefault();sluit(null);}};
      document.addEventListener('keydown',toets,true);
      lijst.onclick=e=>{const d=e.target.closest('[data-id]');if(!d)return;gekozen=+d.dataset.id;okb.disabled=false;toon();};
      lijst.ondblclick=e=>{const d=e.target.closest('[data-id]');if(d)sluit(+d.dataset.id);};
      zk.oninput=toon;bg.querySelector('[data-x="0"]').onclick=()=>sluit(null);okb.onclick=()=>sluit(gekozen);
      bg.addEventListener('mousedown',e=>{if(e.target===bg)sluit(null);});
      document.body.appendChild(bg);toon();zk.focus();
    });
  }
  async function wissel(ktId){
    const o=await api('GET',`/api/rooster/wissel-opties?kt_id=${ktId}`);if(!o.ok)return toast(o.json.error||'Keuzelijst laden mislukt','error');
    // BW1 punt 2: dezelfde themakeuze als bij het kampmoment (één thema kiezen); zonder dat script blijft de oude keuzelijst.
    let id;
    if(window.ThemaKeuze){
      const g=await window.ThemaKeuze.open({periode_id:PER||undefined,week:o.json.week,enkel:true,gekozen:o.json.huidig&&o.json.huidig.id?[o.json.huidig.id]:[],titel:`Wissel ${o.json.groep} ${o.json.huidig.naam} · ${o.json.locatie} wk ${o.json.week}`});
      if(!g||!g.length||(o.json.huidig&&g[0].id===o.json.huidig.id))return;id=g[0].id;
    }else{id=await kies({titel:`Wissel ${o.json.groep} ${o.json.huidig.naam} · ${o.json.locatie} wk ${o.json.week}`,opties:o.json.opties});if(!id)return;}
    const km=(D&&D.kt_ids&&D.kt_ids.includes(ktId))?D.kampmoment.id:undefined;
    const r=await api('POST','/api/rooster/wissel',{kampmoment_id:km,groep_thema_id:ktId,nieuw_thema_id:id});
    if(!r.ok)return toast(r.json.error||'Wisselen mislukt','error');
    toast(`${r.json.groep}: ${r.json.oud.naam} → ${r.json.nieuw.naam}${r.json.meldingen.length?' · let op: '+r.json.let_op.map(l=>l.tekst).join(' / '):' · geen meldingen'}`,r.json.meldingen.length?'warn':'success');
    await laad();
    if(D)await openKm(D.kampmoment.id,true);
    if(TH)await openThema(TH.thema.id,CEL&&CEL.week,true);
  }
  function csv(){
    let kol,rijen;
    if(ZICHT==='week'){
      const l=SEL.size?O.locaties.filter(x=>SEL.has(x.kampmoment_id)):zichtbaarWeek();
      kol=['Week','Locatie','Thema\'s','KV','Sport','Meldingen'];
      rijen=l.map(x=>[O.week.label,x.naam,x.themas.map(t=>`${t.groep} ${t.naam}${t.meldingen.length?' '+tekens(t.meldingen):''}`).join(' · '),x.kv||'geen KV',x.sport.join(' · '),x.meldingen_n]);
    }else{
      kol=['Thema',...S.weken.map(w=>'wk '+w.nr)];
      rijen=zichtbaarSeizoen().map(r=>[r.naam,...r.weken.map(w=>w.locaties.map(l=>l.naam).join(' + ')+(w.dubbel?' ⚠':w.herhaald?' ↻':''))]);
    }
    const tekst=[kol,...rijen].map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(';')).join('\r\n');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+tekst],{type:'text/csv'}));a.download=ZICHT==='week'?`rooster-week-${WEEK}.csv`:'rooster-seizoen.csv';a.click();URL.revokeObjectURL(a.href);
  }

  document.addEventListener('click',async e=>{
    const t=e.target;if(t.closest('.mbox'))return;
    if(t.matches('[data-sel]')){const id=+t.dataset.sel;t.checked?SEL.add(id):SEL.delete(id);return;}
    const z=t.closest('[data-zicht]');if(z){if(z.dataset.zicht!==ZICHT){ZICHT=z.dataset.zicht;FILTER='alle';$('body').classList.remove('toon-detail');await laad();}return;}
    const wk=t.closest('[data-week]');if(wk&&!wk.disabled){WEEK+=+wk.dataset.week;const loc=D&&D.kampmoment.locatie_id;D=null;await laad();if(loc){const x=O.locaties.find(l=>l.locatie_id===loc);if(x)openKm(x.kampmoment_id,true);}return;}
    const chip=t.closest('.chip[data-f]');if(chip){FILTER=chip.dataset.f;bewaarUrl();return teken();}
    const rij=t.closest('.r[data-km]');if(rij){TAB='week';return openKm(+rij.dataset.km);}
    const cel=t.closest('[data-thema]');if(cel&&!cel.classList.contains('leeg'))return openThema(+cel.dataset.thema,+cel.dataset.wk||null);
    const tab=t.closest('[data-tab]');if(tab){TAB=tab.dataset.tab;return teken();}
    if(t.closest('[data-act="terug"]')){$('body').classList.remove('toon-detail');return;}
    const w=t.closest('[data-wissel]');if(w)return wissel(+w.dataset.wissel);
    const toon=t.closest('[data-toon]');if(toon)return location.href=`/gedeeld?week=${D?D.week.nr:WEEK}&key=${encodeURIComponent(toon.dataset.toon)}${PER?'&periode_id='+PER:''}`;
    const op=t.closest('[data-open]');if(op)return location.href=`/kampmomenten?id=${op.dataset.open}`;
    const ot=t.closest('[data-openthema]');if(ot)return location.href=`/themas?id=${ot.dataset.openthema}`;
    const pw=t.closest('[data-pweek]');if(pw&&!pw.disabled&&D){const loc=D.kampmoment.locatie_id;WEEK=D.week.nr+(+pw.dataset.pweek);ZICHT='week';await laad();const x=O.locaties.find(l=>l.locatie_id===loc);if(x)return openKm(x.kampmoment_id,true);D=null;return teken();}
    const nw=t.closest('[data-naarweek]');if(nw&&D){const loc=D.kampmoment.locatie_id;WEEK=+nw.dataset.naarweek;await laad();const x=O.locaties.find(l=>l.locatie_id===loc);if(x){TAB='week';openKm(x.kampmoment_id,true);}return;}
    const nwb=t.closest('[data-naarweekbeeld]');if(nwb){ZICHT='week';WEEK=(CEL&&CEL.week)||+nwb.dataset.naarweekbeeld||WEEK;FILTER='alle';D=null;$('body').classList.remove('toon-detail');return laad();}
  });
  $('alles').onchange=e=>{zichtbaarWeek().forEach(x=>e.target.checked?SEL.add(x.kampmoment_id):SEL.delete(x.kampmoment_id));teken();};
  $('export').onclick=csv;
  async function kop(){
    const v=await api('GET','/api/vandaag');
    if(v.ok){$('per-naam').textContent=v.json.periode?v.json.periode.naam:'geen periode';$('wie').textContent=v.json.gebruiker.naam+' · kantoor';}
    const p=await api('GET','/api/periodes');if(!p.ok)return;
    if(PER){const x=p.json.find(y=>y.id===PER);if(x)$('per-naam').textContent=x.naam;}
    const sel=$('per-kies');sel.innerHTML=p.json.map(x=>`<option value="${x.id}"${(PER?x.id===PER:x.actief)?' selected':''}>${esc(x.naam)}</option>`).join('');
    sel.onchange=async()=>{const a=await api('POST','/api/periodes/'+sel.value+'/activeer');if(!a.ok)return toast(a.json.error||'Periode wisselen mislukt','error');PER=0;WEEK=0;bewaarUrl();location.reload();};
  }
  (async()=>{await laad();const km=+Q.get('km');if(km&&ZICHT==='week')openKm(km,true);const th=+Q.get('thema');if(th&&ZICHT==='seizoen')openThema(th,null,true);kop();})();
})();
