// public/sportrooster.js — PL3: Planning › Sportrooster (design/mockup-planning-v3.html, schermen "Sport · Week" en "Sport · Seizoen").
// Data: GET /api/sportrooster/week|seizoen|soort/:soort; acties via /api/sportrooster/plan (gelogd). De HTML-bouwers (BOUW) zijn los van de
// browser, zodat de test ze met echte data-JSON kan aanroepen.
'use strict';
(function(){
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const DAG=['ma','di','wo','do','vr'];
  const dagTekst=(a,b)=>a===b?DAG[a-1]:`${DAG[a-1]}–${DAG[b-1]}`;
  const knop=(id,t,licht)=>`<button class="knop ${licht===false?'':'licht'}" id="${id}">${t}</button>`;
  const vakje=d=>{
    const kls=d.te_weinig?' ov':d.in_gebruik>0&&d.in_gebruik>=d.sets?' vl':d.in_gebruik===0?' vr':'';
    return `<span class="vk${kls}"><b>${d.in_gebruik}/${d.sets}</b><i style="width:${Math.min(100,d.sets?Math.round(100*d.in_gebruik/d.sets):0)}%"></i></span>`;
  };
  const BOUW={
    filters(mode,T,{filter,zoek,week,label}){
      const chip=(f,t,n)=>`<span class="chip${filter===f?' act':''}" data-f="${f}">${t} <b>${n}</b></span>`;
      const seg=`<span class="seg"><a data-mode="week" class="${mode==='week'?'act':''}">Week</a><a data-mode="seizoen" class="${mode==='seizoen'?'act':''}">Seizoen</a></span>`;
      if(mode==='week')return `<span class="wis"><button class="knop licht klein" data-wkstap="-1" aria-label="Vorige week">‹</button><b>${esc(label)}</b><button class="knop licht klein" data-wkstap="1" aria-label="Volgende week">›</button></span>${seg}`
        +chip('ingepland','Ingepland',T.ingepland)+chip('alle','Alle',T.alle)+chip('tekort','⚠ Te weinig sets',T.te_weinig)+chip('verhuis','Verhuis',T.verhuis);
      return `${seg}<input id="zoek" placeholder="🔍 Zoek sport…" value="${esc(zoek||'')}">`+chip('ingepland','Ingepland',T.ingepland)+chip('alle','Alle',T.alle)+chip('tekort','⚠ Te weinig sets',T.te_weinig);
    },
    kop(){return `<div class="kopr"><span><input type="checkbox" id="alles" aria-label="Alles selecteren"></span><span>Sport</span>${DAG.map(d=>`<span style="text-align:center">${d}</span>`).join('')}</div>`;},
    rij(s,{act,sel}={}){
      return `<div class="r sp${act?' act':''}" data-soort="${esc(s.soort)}"><span><input type="checkbox" data-sel="${esc(s.soort)}" ${sel?'checked':''} aria-label="Selecteer ${esc(s.soort)}"></span><span><b>${esc(s.soort)}</b> <span class="k">${s.sets} set${s.sets===1?'':'s'}</span></span>${s.dagen.map(vakje).join('')}</div>`;
    },
    legende(){return `<span class="leg"><span class="tg">in gebruik</span><span class="tg vl">alles weg</span><span class="tg dub">⚠ te weinig</span></span>`;},
    seizoen(S,{lijst,sel}){
      const kop=`<span class="h">Sport</span>${S.week_labels.map((_,i)=>`<span class="h">wk ${i+1}</span>`).join('')}`;
      const rijen=lijst.map(s=>`<span class="l${sel&&sel.soort===s.soort?' act':''}" data-soort="${esc(s.soort)}" title="${esc(s.soort)}">${esc(s.soort)}</span>`
        +s.weken.map(w=>`<span class="c ${w.leeg?'leeg':w.te_weinig?'dub':w.gebruik>=w.sets?'vl':''}${sel&&sel.soort===s.soort&&sel.week===w.week?' sel':''}" data-soort="${esc(s.soort)}" data-wk="${w.week}">${w.leeg?'':`${w.gebruik}/${w.sets}`}</span>`).join('')).join('');
      return `<div class="sgrid" style="--wk:${S.weken}">${kop}${rijen}</div>`;
    },
    // Paneel in weekmodus
    detailWeek(D,tab,{verhuizers}={}){
      const wk=D.week,kv=(k,x)=>`<div class="kv"><span>${k}</span><b>${x}</b></div>`;
      const tot=D.dagen.map(d=>`<span class="${d.te_weinig?'ovt':''}">${d.in_gebruik}/${d.sets}</span>`).join('');
      const raster=`<div class="blok vol"><h4>Waar staat ${esc(D.soort.toLowerCase())}, per dag</h4><div class="tw d5"><span class="h">Locatie</span>${DAG.map(d=>`<span class="h">${d}</span>`).join('')}`
        +(D.raster.length?D.raster.map(r=>`<span class="g kl" data-wijzig="${r.locatie_id}" title="Dagen wijzigen of weghalen" ${r.te_weinig?'style="color:#b91c1c"':''}>${esc(r.naam)}${r.te_weinig?' ⚠':''}</span>${r.dagen.map(x=>`<span class="${x}">${x?'●':''}</span>`).join('')}`).join('')
          +`<span class="g">totaal</span>${tot}`:`<span class="g" style="grid-column:1/-1;font-weight:500;color:#64748b">Deze week nergens ingepland</span>`)
        +`</div></div>`;
      const letOp=`<div class="blok"><h4>Let op</h4>${D.let_op.length?D.let_op.map(l=>`<div class="rij"><div class="nm rood">${esc(l.tekst)}</div></div>`
        +l.voorstellen.map(v=>`<div class="rij"><div class="nm">${v.voorstel?'':'<span style="color:#b91c1c">'}voorstel: ${esc(v.tekst)}${v.voorstel?'':'</span>'}</div>${v.voorstel?`<button class="knop licht klein" data-toepassen="${v.rij_id}" data-alt="${esc(v.voorstel.soort)}">Toepassen</button>`:''}</div>`).join('')).join(''):'<div class="rij"><div class="nm">Geen tekort deze week</div></div>'}</div>`;
      const verhuis=`<div class="blok"><h4>Verhuis midden in de week</h4>${D.verhuis.length?D.verhuis.map(v=>`${kv(esc(v.wanneer),`${esc(v.van)} → ${esc(v.naar)}`)}${kv('Sets',esc(v.sets.join(', ')))}`
        +kv('Wie',`<select data-wie="${v.taak_id||''}" aria-label="Wie verhuist"><option value="">wie verhuist ▾</option>${(verhuizers||D.personeel).map(p=>`<option value="${p.id}" ${p.naam===v.wie?'selected':''}>${esc(p.naam)} · ${esc(p.rol)}</option>`).join('')}</select>`)
        +kv('Taak',v.taak_id?`<a href="/taken?taak=${v.taak_id}">staat op Transport › Taken #${v.taak_id}</a>`:'komt op Transport › Taken')).join('<hr style="border:0;border-top:1px solid #e2e8f0;margin:6px 0">')
        :'<div class="rij"><div class="nm">Geen verhuis: de sets blijven de hele week op dezelfde plek</div></div>'}</div>`;
      return {raster,letOp,verhuis,wk};
    },
    zomerRijen(D){
      return D.hele_zomer.length?D.hele_zomer.map(z=>`<div class="rij"><div class="nm${z.te_weinig?' rood':''}">week ${z.week} · ${z.gebruik}/${z.sets}${z.te_weinig?` op ${esc(z.te_weinig_dagen)} ⚠`:''}<b>${esc(z.locaties.join(' · '))}</b></div>${z.te_weinig?`<button class="knop licht klein" data-oplossen="${z.week}">Oplossen</button>`:`<button class="knop licht klein" data-naarweek="${z.week}">Open week</button>`}</div>`).join('')
        :'<div class="rij"><div class="nm">Deze sport staat in geen enkele week ingepland</div></div>';
    },
    setsBlok(D){
      return `<div class="blok"><h4>Sets</h4>${D.sets_lijst.map(s=>`<div class="kv"><span>${esc(s.label)}</span><b>${esc(s.item)}${s.stockage?` · stockage ${esc(s.stockage)}`:''}<br><small style="color:#64748b;font-weight:500">deze week: ${esc(s.deze_week)}</small></b></div>`).join('')}<div class="kv"><span>Pool</span><b><a href="/pool">Materiaal › Pool ›</a></b></div></div>`;
    },
    detail(D,tab,mode,opt){
      const b=BOUW.detailWeek(D,tab,opt);
      if(mode==='seizoen'){
        return `<a class="terug" data-act="terug">‹ terug naar de lijst</a><div class="dkop"><div><h2>${esc(D.soort)} · hele periode</h2><span>${esc(D.samenvatting.zomer)}</span></div><div class="acts">${knop('d-naarweek','Naar weekbeeld',false)}</div></div>
          <div class="dgrid"><div class="blok vol"><h4>Per week</h4>${BOUW.zomerRijen(D)}</div>${BOUW.setsBlok(D)}</div>`;
      }
      const tabs=[['week','Week'],['zomer','Hele periode'],['sets',`Sets ${D.sets}`]];
      const inhoud=tab==='zomer'?`<div class="blok vol"><h4>Per week</h4>${BOUW.zomerRijen(D)}</div>`:tab==='sets'?BOUW.setsBlok(D):b.raster+b.letOp+b.verhuis;
      return `<a class="terug" data-act="terug">‹ terug naar de lijst</a><div class="dkop"><div><h2>${esc(D.soort)} · week ${D.week}</h2><span>${esc(D.samenvatting.week)}</span></div><div class="acts">${knop('d-vorige',`‹ wk ${D.week-1}`)}${knop('d-volgende',`wk ${D.week+1} ›`)}${knop('d-inplannen','+ Inplannen',false)}</div></div>
        <div class="dtabs">${tabs.map(([k,x])=>`<a class="${tab===k?'act':''}" data-tab="${k}">${x}</a>`).join('')}</div>
        <div class="dgrid"${tab==='week'?'':' style="grid-template-columns:1fr"'}>${inhoud}</div>`;
    },
    dagKnoppen(van,tot){return `<div class="dagknoppen" id="dagknoppen">${DAG.map((d,i)=>`<button type="button" class="${i+1>=van&&i+1<=tot?'act':''}" data-dag="${i+1}">${d}</button>`).join('')}</div>`;}
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
      bg.querySelectorAll('[data-weg]').forEach(b=>b.onclick=()=>{const f=bg.querySelector('form');sluit({weg:true,id:+(f.rij&&f.rij.value)||0});});
      bg.querySelector('[data-x="1"]').onclick=()=>{const v=lees?lees(bg.querySelector('form')):{};if(v)sluit(v);};
      document.body.appendChild(bg);(bg.querySelector('select,input')||bg.querySelector('[data-x="1"]')).focus();
    });
  }
  const Q=new URLSearchParams(location.search);
  const PER=Q.get('periode_id')||'';
  let MODE=(Q.get('modus')==='seizoen'||Q.get('zicht')==='seizoen')?'seizoen':'week',WEEK=parseInt(Q.get('week'))||0,FILTER='ingepland',ZOEK='',TAB='week',SOORT=Q.get('soort')||'';
  let W=null,S=null,D=null,SEL=new Set();
  const pq=()=>PER?`periode_id=${PER}&`:'';

  async function laad(){
    const r=MODE==='week'?await api('GET',`/api/sportrooster/week?${pq()}week=${WEEK||1}`):await api('GET',`/api/sportrooster/seizoen?${pq().replace(/&$/,'')}`);
    if(r.status===401||r.status===403){location.href='/';return;}
    if(!r.ok)return toast(r.json.error||'Sportrooster laden mislukt','error');
    if(MODE==='week'){W=r.json;WEEK=W.week;}else S=r.json;
    if(MODE==='seizoen'&&!W){const w=await api('GET',`/api/sportrooster/week?${pq()}week=${WEEK||1}`);if(w.ok)W=w.json;}
    teken();if(SOORT)await laadDetail(SOORT,true);
  }
  const T=()=>MODE==='week'?W.tellers:S.tellers;
  function lijstNu(){
    const bron=MODE==='week'?W.sporten:S.sporten;
    const F={ingepland:s=>s.ingepland,alle:()=>true,tekort:s=>s.te_weinig,verhuis:s=>s.verhuis>0};
    return bron.filter(F[FILTER]||F.alle).filter(s=>!ZOEK||s.soort.toLowerCase().includes(ZOEK));
  }
  function teken(){
    $('filters').innerHTML=BOUW.filters(MODE,T(),{filter:FILTER,zoek:ZOEK,week:WEEK,label:W&&W.label});
    const l=lijstNu();
    if(MODE==='week'){
      $('kopr-plek').innerHTML=BOUW.kop();$('lijst').className='scroll';
      $('lijst').innerHTML=l.length?l.map(s=>BOUW.rij(s,{act:SOORT===s.soort,sel:SEL.has(s.soort)})).join(''):`<div class="leeg">${FILTER==='ingepland'?'Deze week is nog geen sport ingepland. Plan er een in met de knop hieronder, of kies "Alle".':'Geen sporten voor deze filter'}${FILTER==='ingepland'?'<div style="margin-top:10px"><button class="knop" id="leeg-inplannen">+ Inplannen</button></div>':''}</div>`;
      $('voet').innerHTML=`<span><span id="n-tot">${l.length} sport${l.length===1?'':'en'}</span> · <span class="n">${SEL.size} geselecteerd</span></span><span>vakje = sets in gebruik / sets van die sport · sets zijn uitwisselbaar</span>${BOUW.legende()}`;
      const al=$('alles');if(al)al.checked=l.length>0&&l.every(x=>SEL.has(x.soort));
    }else{
      $('kopr-plek').innerHTML='';$('lijst').className='scroll sz';$('lijst').style.padding='8px';
      $('lijst').innerHTML=l.length?BOUW.seizoen(S,{lijst:l,sel:SOORT?{soort:SOORT,week:WEEK}:null}):'<div class="leeg">Geen sporten voor deze filter</div>';
      $('voet').innerHTML=`<span>cel = drukste dag van die week: sets in gebruik / sets</span>${BOUW.legende()}`;
    }
    if(MODE==='week')$('lijst').style.padding='';
    const z=$('zoek');if(z)z.oninput=e=>{ZOEK=e.target.value.trim().toLowerCase();const p=e.target.selectionStart;teken();const z2=$('zoek');z2.focus();z2.setSelectionRange(p,p);};
  }
  let VERHUIZERS=null;
  async function laadDetail(soort,stil){
    SOORT=soort;
    const r=await api('GET',`/api/sportrooster/soort/${encodeURIComponent(soort)}?${pq()}week=${WEEK||1}`);
    if(!r.ok){D=null;SOORT='';$('detail').innerHTML='<div class="leegd">Klik een sport in de lijst voor het detail.</div>';return toast(r.json.error||'Detail laden mislukt','error');}
    D=r.json;VERHUIZERS=D.personeel;$('detail').innerHTML=BOUW.detail(D,TAB,MODE);
    document.querySelectorAll('.r[data-soort]').forEach(x=>x.classList.toggle('act',x.dataset.soort===soort));
    document.querySelectorAll('.sgrid .c').forEach(x=>x.classList.toggle('sel',x.dataset.soort===soort&&+x.dataset.wk===WEEK));
    if(!stil)$('body').classList.add('toon-detail');
  }
  const herlaad=async()=>{await laad();};

  // Inplannen / dagen wijzigen: dagen ma–vr als vijf knoppen; wat je aanklikt wordt één aaneengesloten reeks.
  function dagenLezen(f){const a=[...f.querySelectorAll('#dagknoppen button.act')].map(b=>+b.dataset.dag);return a.length?{dag_van:Math.min(...a),dag_tot:Math.max(...a)}:null;}
  async function inplannen(soort){
    const locs=(W&&W.locaties)||[];const alle=(W?W.sporten:[]);
    const x=await vraag({titel:`Sport inplannen — week ${WEEK}`,ok:'Inplannen',html:`<label>Sport<select name="soort">${alle.map(s=>`<option value="${esc(s.soort)}" ${s.soort===soort?'selected':''}>${esc(s.soort)} (${s.sets} sets)</option>`).join('')}</select></label>
      <label>Locatie<select name="loc">${locs.map(l=>`<option value="${l.id}">${esc(l.naam)}</option>`).join('')}</select></label><label>Dagen</label>${BOUW.dagKnoppen(1,5)}
      <p style="font-size:12px;color:#64748b">Het systeem kiest zelf een vrije set van deze sport.</p>`,
      lees:f=>{const d=dagenLezen(f);return d?{soort:f.soort.value,locatie_id:+f.loc.value,...d}:(toast('Kies minstens één dag','warn'),null);}});
    if(!x)return;
    const r=await api('POST','/api/sportrooster/plan',{...x,periode_id:PER||undefined,week:WEEK});
    if(!r.ok)return toast(r.json.error||'Inplannen mislukt','error');
    toast(r.json.te_weinig?`Ingepland (${r.json.set}), maar te weinig sets op ${r.json.te_weinig_dagen.join(', ')} — zie Let op`:`Ingepland: ${r.json.set} → ${r.json.locatie}`,r.json.te_weinig?'warn':'success');
    if(r.json.verhuistaken_nieuw)toast('Verhuistaak aangemaakt op Transport › Taken','info');
    SOORT=x.soort;await herlaad();
  }
  async function wijzig(locId){
    const rs=D.raster.find(r=>r.locatie_id===locId);if(!rs)return;const locs=(W&&W.locaties)||[];
    const r0=rs.rijen[0];
    const x=await vraag({titel:`${D.soort} bij ${rs.naam} — dagen wijzigen`,ok:'Opslaan',html:`${rs.rijen.length>1?`<label>Set<select name="rij">${rs.rijen.map(r=>`<option value="${r.id}">${esc(r.set)} · ${dagTekst(r.dag_van,r.dag_tot)}</option>`).join('')}</select></label>`:`<input type="hidden" name="rij" value="${r0.id}"><p>${esc(r0.set)} · nu ${dagTekst(r0.dag_van,r0.dag_tot)}</p>`}
      <label>Locatie<select name="loc">${locs.map(l=>`<option value="${l.id}" ${l.id===locId?'selected':''}>${esc(l.naam)}</option>`).join('')}</select></label><label>Dagen</label>${BOUW.dagKnoppen(r0.dag_van,r0.dag_tot)}
      <div class="knoppen" style="margin-top:0"><button type="button" class="knop weg" data-weg>Weghalen</button></div>`,
      lees:f=>{const d=dagenLezen(f);return d?{id:+f.rij.value,locatie_id:+f.loc.value,...d}:(toast('Kies minstens één dag','warn'),null);}});
    if(!x)return;
    if(x.weg){const r=await api('DELETE',`/api/sportrooster/plan/${x.id||r0.id}`);if(!r.ok)return toast(r.json.error||'Weghalen mislukt','error');toast('Weggehaald','success');return herlaad();}
    const r=await api('PUT',`/api/sportrooster/plan/${x.id}`,{dag_van:x.dag_van,dag_tot:x.dag_tot,locatie_id:x.locatie_id});
    if(!r.ok)return toast(r.json.error||'Opslaan mislukt','error');toast('Dagen gewijzigd','success');herlaad();
  }
  function csv(){
    const rijen=MODE==='week'?[['Sport','Sets',...DAG],...W.sporten.filter(s=>s.ingepland).map(s=>[s.soort,s.sets,...s.dagen.map(d=>`${d.in_gebruik}/${d.sets}`)])]
      :[['Sport','Sets',...S.week_labels],...S.sporten.filter(s=>s.ingepland).map(s=>[s.soort,s.sets,...s.weken.map(w=>w.leeg?'':`${w.gebruik}/${w.sets}`)])];
    const tekst=rijen.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(';')).join('\r\n');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+tekst],{type:'text/csv'}));a.download=MODE==='week'?`sportrooster-week-${WEEK}.csv`:'sportrooster-seizoen.csv';a.click();URL.revokeObjectURL(a.href);
  }

  document.addEventListener('click',async e=>{
    const t=e.target;
    const dk=t.closest('#dagknoppen button');
    if(dk){dk.classList.toggle('act');const a=[...document.querySelectorAll('#dagknoppen button.act')].map(b=>+b.dataset.dag);
      if(a.length){const mi=Math.min(...a),ma=Math.max(...a);document.querySelectorAll('#dagknoppen button').forEach(b=>b.classList.toggle('act',+b.dataset.dag>=mi&&+b.dataset.dag<=ma));}return;}
    if(t.closest('.mbox'))return;
    if(t.matches('[data-sel]')){const id=t.dataset.sel;t.checked?SEL.add(id):SEL.delete(id);return teken();}
    const md=t.closest('[data-mode]');if(md){MODE=md.dataset.mode;FILTER='ingepland';return laad();}
    const st=t.closest('[data-wkstap]');if(st){WEEK=Math.max(1,Math.min(W.weken,WEEK+(+st.dataset.wkstap)));return laad();}
    const chip=t.closest('.chip[data-f]');if(chip){FILTER=chip.dataset.f;return teken();}
    const cel=t.closest('.sgrid .c');if(cel){WEEK=+cel.dataset.wk;SOORT=cel.dataset.soort;return laadDetail(SOORT);}
    const lab=t.closest('.sgrid .l');if(lab)return laadDetail(lab.dataset.soort);
    const rij=t.closest('.r[data-soort]');if(rij)return laadDetail(rij.dataset.soort);
    const tab=t.closest('[data-tab]');if(tab){TAB=tab.dataset.tab;return laadDetail(SOORT,true);}
    if(t.closest('[data-act="terug"]')){$('body').classList.remove('toon-detail');return;}
    if(t.id==='leeg-inplannen')return inplannen(''); // TF10: werkt ook zonder gekozen sport (lege week); stond eerder achter de guard `if(!D)return`
    if(!D)return;
    if(t.id==='d-vorige'||t.id==='d-volgende'){WEEK=Math.max(1,Math.min(D.weken,WEEK+(t.id==='d-vorige'?-1:1)));MODE==='week'&&(W=null);return laad();}
    if(t.id==='d-inplannen')return inplannen(D.soort);
    if(t.id==='d-naarweek'){MODE='week';TAB='week';FILTER='alle';return laad();}
    const nw=t.closest('[data-naarweek],[data-oplossen]');if(nw){WEEK=+(nw.dataset.naarweek||nw.dataset.oplossen);MODE='week';TAB='week';FILTER='alle';return laad();}
    const wz=t.closest('[data-wijzig]');if(wz)return wijzig(+wz.dataset.wijzig);
    const tp=t.closest('[data-toepassen]');
    if(tp){const r=await api('POST','/api/sportrooster/toepassen',{rij_id:+tp.dataset.toepassen,soort:tp.dataset.alt});if(!r.ok)return toast(r.json.error||'Toepassen mislukt','error');toast(`Toegepast: nu ${r.json.nu}`,'success');return herlaad();}
  });
  document.addEventListener('change',async e=>{
    const w=e.target.closest&&e.target.closest('select[data-wie]');if(!w||!w.value)return;
    if(!w.dataset.wie)return toast('Nog geen verhuistaak om aan te koppelen','warn');
    const r=await api('PUT',`/api/sportrooster/verhuis/${w.dataset.wie}`,{wie_id:+w.value});
    if(!r.ok)return toast(r.json.error||'Opslaan mislukt','error');toast(`Verhuis voor ${r.json.wie}`,'success');
  });
  document.addEventListener('change',e=>{if(e.target.id==='alles'){lijstNu().forEach(s=>e.target.checked?SEL.add(s.soort):SEL.delete(s.soort));teken();}});
  $('export').onclick=()=>{if(W||S)csv();};
  async function kop(){
    const v=await api('GET','/api/vandaag');
    if(v.ok){const b=$('b-vandaag');if(b){b.textContent=v.json.beslissen.length;b.hidden=!v.json.beslissen.length;}$('per-naam').textContent=v.json.periode?v.json.periode.naam:'geen periode';$('wie').textContent=v.json.gebruiker.naam+' · kantoor';}
    const p=await api('GET','/api/periodes');if(!p.ok)return;
    const sel=$('per-kies');sel.innerHTML=p.json.map(x=>`<option value="${x.id}"${x.actief?' selected':''}>${esc(x.naam)}</option>`).join('');
    sel.onchange=async()=>{const a=await api('POST','/api/periodes/'+sel.value+'/activeer');if(!a.ok)return toast(a.json.error||'Periode wisselen mislukt','error');location.reload();};
  }
  (async()=>{await laad();kop();})();
})();
