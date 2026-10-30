// public/gedeeld.js — PL2 punt 2b: Planning › Gedeeld materiaal, Week en Seizoen (design/mockup-gedeeld-materiaal.html).
// Gedeeld stuk = vast_type of vaste bak uit thema_behoefte die bij meer dan één thema hoort; "er zijn" = Materiaal › Pool.
// Week: GET /api/rooster/gedeeld?week=, Seizoen: GET /api/rooster/gedeeld/seizoen, paneel: GET /api/rooster/gedeeld/stuk?key=&week=.
// Toepassen = POST /api/rooster/wissel (ruil met een andere week op dezelfde locatie); Aanvaarden = POST /api/rooster/gedeeld/aanvaard (gelogd).
'use strict';
(function(){
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const kv=(k,x)=>`<div class="kv"><span>${k}</span><b>${x}</b></div>`;
  const PIL={te_weinig:'<span class="pil rood">⚠ te weinig</span>',precies_op:'<span class="pil oranje">precies op</span>',ok:'<span class="pil groen">ok</span>',niet_nodig:'<span class="k">niet nodig</span>'};
  const LEG='<span class="leg"><span class="tg">in gebruik</span><span class="tg vl">alles weg</span><span class="tg dub">⚠ te weinig</span></span>';
  const BOUW={
    filtersWeek(O,f){
      const c=(k,t)=>`<span class="chip ${f===k?'act':''}" data-f="${k}">${t} ${O.tellers[k]}</span>`;
      return `<span class="wis"><button class="knop licht klein" data-week="-1" aria-label="Vorige week"${O.week.nr<=1?' disabled':''}>‹</button><b>${esc(O.week.label)}</b><button class="knop licht klein" data-week="1" aria-label="Volgende week"${O.week.nr>=O.weken?' disabled':''}>›</button></span><span class="seg"><a class="act" data-zicht="week">Week</a><a data-zicht="seizoen">Seizoen</a></span>${c('nodig','Nodig deze week')}${c('alle','Alle')}${c('te_weinig','⚠ Te weinig')}${c('precies_op','Precies op')}`;
    },
    filtersSeizoen(S,f,zoek){
      const c=(k,t)=>`<span class="chip ${f===k?'act':''}" data-f="${k}">${t} ${S.tellers[k]}</span>`;
      return `<span class="seg"><a data-zicht="week">Week</a><a class="act" data-zicht="seizoen">Seizoen</a></span><input id="zoek" placeholder="🔍 Zoek stuk…" value="${esc(zoek||'')}">${c('gebruikt','Gebruikt')}${c('alle','Alle')}${c('te_weinig','⚠ Te weinig')}`;
    },
    rij(s,{act,sel}={}){
      return `<div class="r ${act?'act':''}" data-key="${esc(s.key)}"><span><input type="checkbox" data-sel="${esc(s.key)}" ${sel?'checked':''} aria-label="Selecteer ${esc(s.naam)}"></span><span><b>${esc(s.naam)}</b></span><span class="get n">${s.nodig}</span><span class="get z">${s.beschikbaar}</span><span class="k">${s.waar.length?s.waar.map(w=>`${esc(w.thema)} (${esc(w.locatie)})`).join(' · '):'—'}${s.aanvaard.length?` · zonder: ${s.aanvaard.map(a=>esc(a.thema)).join(', ')}`:''}</span><span>${PIL[s.stand]}</span></div>`;
    },
    voetWeek(){return '<span>gedeeld materiaal = stukken die bij meer dan één thema horen · aantal uit Materiaal › Pool</span>';},
    voetSeizoen(){return `<span>cel = nodig / er zijn, per week</span>${LEG}`;},
    raster(S,rijen,sel){
      const n=S.weken.length;
      const kop=`<span class="h">Stuk</span>${S.weken.map(w=>`<span class="h" title="${esc(w.label)}">wk ${w.nr}</span>`).join('')}`;
      const body=rijen.map(s=>`<span class="l ${sel&&sel.key===s.key?'act':''}" data-key="${esc(s.key)}" title="${esc(s.naam)}">${esc(s.naam)}</span>`+s.weken.map(w=>{
        if(!w.nodig)return '<span class="c leeg"></span>';
        const k=w.stand==='te_weinig'?'dub':w.stand==='precies_op'?'vl':'';const x=sel&&sel.key===s.key&&sel.week===w.week?' sel':'';
        return `<span class="c ${k}${x}" data-key="${esc(s.key)}" data-wk="${w.week}">${w.nodig}/${s.beschikbaar}</span>`;
      }).join('')).join('');
      return `<div class="sgrid" style="grid-template-columns:120px repeat(${n},1fr);--nw:${n}">${kop}${body||'<span class="l" style="grid-column:1/-1;padding:30px;text-align:center;color:#64748b">Geen stukken voor deze filter</span>'}</div>`;
    },
    paneelWeek(D,tab){
      const s=D.stuk,w=D.week.nr;
      let vrij=s.beschikbaar;
      const wie=`<div class="blok vol"><h4>Wie heeft het nodig</h4>${s.waar.map(x=>{vrij-=x.aantal;const op=vrij<0;
        return `<div class="rij"><div class="nm"${op?' style="color:#b91c1c"':''}>${esc(x.locatie)} · ${esc(x.groep)} ${esc(x.thema)}${op?' ⚠':''}<b>${op?(s.beschikbaar?'geen bak meer vrij':'er is er geen in de Pool'):`${esc(x.dag)} · ${x.kv?'KV '+esc(x.kv):'geen KV'}`}${x.aantal>1?` · ${x.aantal} nodig`:''}</b></div><button class="knop licht klein" data-open="${x.kampmoment_id}">Open</button></div>`;}).join('')||'<div class="rij"><div class="nm">Niemand deze week</div></div>'}</div>`;
      const vs=D.voorstellen.map((v,i)=>`<div class="rij"><div class="nm">${esc(v.tekst)}<b>${esc(v.sub)}</b></div><button class="knop licht klein" data-voorstel="${i}">${v.soort==='ruil'?'Toepassen':'Aanvaarden'}</button></div>`).join('');
      const aanv=s.aanvaard.map(a=>`<div class="rij"><div class="nm">${esc(a.thema)} zonder ${esc(s.naam.toLowerCase())}<b>${esc(a.locatie)} · aanvaard, gelogd</b></div><button class="knop licht klein" data-terug="${a.thema_id}">↶ Terug</button></div>`).join('');
      const voorstel=`<div class="blok"><h4>Voorstel</h4>${vs+aanv||`<div class="rij"><div class="nm">${s.stand==='te_weinig'?'Geen voorstel gevonden':'Niets op te lossen'}<b>${s.nodig} van ${s.beschikbaar} in gebruik</b></div></div>`}</div>`;
      const vn=x=>x?kv('wk '+x.week,`${x.nodig} van ${x.beschikbaar}${x.locaties.length?' · '+esc(x.locaties.join(', ')):''}`):'';
      const rond=`<div class="blok"><h4>Week ervoor en erna</h4>${vn(D.vorige)}${vn(D.volgende)||''}${!D.vorige&&!D.volgende?'<div class="rij"><div class="nm">—</div></div>':''}</div>`;
      const zomer=`<div class="blok vol"><h4>Per week</h4>${D.zomer.map(z=>`<div class="rij"><div class="nm"${z.stand==='te_weinig'?' style="color:#b91c1c"':''}>week ${z.week} · ${z.nodig}/${s.beschikbaar}${z.stand==='te_weinig'?' ⚠':''}<b>${esc(z.waar.join(' · '))}</b></div>${z.week!==w?`<button class="knop licht klein" data-naarweek="${z.week}">Toon</button>`:''}</div>`).join('')||'<div class="rij"><div class="nm">Niet nodig deze periode</div></div>'}</div>`;
      const themas=`<div class="blok vol"><h4>Thema's met ${esc(s.naam.toLowerCase())}</h4>${D.themas.map(t=>kv(esc(t.naam),`${t.aantal} ${t.aantal===1?'stuk':'stuks'}`)).join('')}</div>`;
      const inhoud={week:wie+voorstel+rond,zomer,themas}[tab]||'';
      return `<a class="terug" data-act="terug">‹ terug naar de lijst</a><div class="dkop"><div><h2>${esc(s.naam)} · week ${w}</h2><span>${s.beschikbaar} ${esc(s.eenheid)} · ${s.nodig} nodig · <a href="/pool" style="color:#2563eb;text-decoration:none">Materiaal › Pool ›</a></span></div><div class="acts"><button class="knop licht" data-pweek="-1"${w>1?'':' disabled'}>‹ wk ${w-1}</button><button class="knop licht" data-pweek="1"${w<D.weken?'':' disabled'}>wk ${w+1} ›</button><button class="knop" data-oplossen${D.voorstellen.length?'':' disabled'}>Oplossen</button></div></div>
        <div class="dtabs">${[['week','Week'],['zomer','Hele zomer'],['themas',`Thema's ${D.themas.length}`]].map(([x,t])=>`<a class="${tab===x?'act':''}" data-tab="${x}">${t}</a>`).join('')}</div><div class="dgrid"${tab==='week'?'':' style="grid-template-columns:1fr"'}>${inhoud}</div>`;
    },
    paneelSeizoen(D){
      const s=D.stuk;
      const per=`<div class="blok vol"><h4>Per week</h4>${D.zomer.map(z=>`<div class="rij"><div class="nm"${z.stand==='te_weinig'?' style="color:#b91c1c"':''}>week ${z.week} · ${z.nodig}/${s.beschikbaar}${z.stand==='te_weinig'?' ⚠':''}<b>${esc(z.waar.join(' · '))}</b></div>${z.stand==='te_weinig'?`<button class="knop licht klein" data-naarweek="${z.week}">Oplossen</button>`:''}</div>`).join('')||'<div class="rij"><div class="nm">Niet nodig deze periode</div></div>'}</div>`;
      const th=`<div class="blok"><h4>Thema's met ${esc(s.naam.toLowerCase())}</h4>${D.themas.map(t=>kv(esc(t.naam),`${t.aantal} ${t.aantal===1?'bak':'bakken'}`)).join('')}</div>`;
      return `<a class="terug" data-act="terug">‹ terug naar de lijst</a><div class="dkop"><div><h2>${esc(s.naam)} · hele zomer</h2><span>${s.beschikbaar} ${esc(s.eenheid)} · ${D.themas.length} thema's gebruiken het</span></div><div class="acts"><button class="knop" data-naarweek="${D.week.nr}">Naar weekbeeld</button></div></div>
        <div class="dgrid">${per}${th}</div>`;
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
  let ZICHT=Q.get('zicht')==='seizoen'?'seizoen':'week',WEEK=parseInt(Q.get('week'))||0,PER=parseInt(Q.get('periode_id'))||0,FILTER=ZICHT==='week'?'nodig':'gebruikt',ZOEK='',TAB='week';
  let O=null,S=null,D=null,KEY=Q.get('key')||'',SEL=new Set();
  const pq=()=>PER?`periode_id=${PER}`:'';
  function bewaarUrl(){const u=new URLSearchParams();if(ZICHT==='seizoen')u.set('zicht','seizoen');if(WEEK)u.set('week',WEEK);if(PER)u.set('periode_id',PER);if(KEY)u.set('key',KEY);history.replaceState(null,'','/gedeeld'+(u.toString()?'?'+u:''));}
  const FW={nodig:s=>s.nodig>0||s.aanvaard.length>0,alle:()=>true,te_weinig:s=>s.stand==='te_weinig',precies_op:s=>s.stand==='precies_op'};
  const FS={gebruikt:s=>s.gebruikt,alle:()=>true,te_weinig:s=>s.te_weinig};
  const zw=()=>O.stukken.filter(FW[FILTER]||FW.alle);
  const zs=()=>S.stukken.filter(FS[FILTER]||FS.alle).filter(s=>!ZOEK||s.naam.toLowerCase().includes(ZOEK)||String(s.vast_type).toLowerCase().includes(ZOEK));

  async function laad(){
    document.querySelector('.frame').id=ZICHT==='week'?'f1':'f2';
    if(ZICHT==='week'){
      const r=await api('GET',`/api/rooster/gedeeld?${pq()}${WEEK?'&week='+WEEK:''}`);
      if(r.status===401||r.status===403){location.href='/';return;}
      if(!r.ok)return toast(r.json.error||'Gedeeld materiaal laden mislukt','error');
      O=r.json;WEEK=O.week.nr;if(!FW[FILTER])FILTER='nodig';
    }else{
      const r=await api('GET',`/api/rooster/gedeeld/seizoen?${pq()}`);
      if(r.status===401||r.status===403){location.href='/';return;}
      if(!r.ok)return toast(r.json.error||'Seizoen laden mislukt','error');
      S=r.json;if(!FS[FILTER])FILTER='gebruikt';
    }
    bewaarUrl();
    if(KEY){await openStuk(KEY,WEEK,true);}else teken();
  }
  function teken(){
    const week=ZICHT==='week';
    $('kopr').style.display=week?'':'none';$('lijst').classList.toggle('raster',!week);
    if(week){
      $('filters').innerHTML=BOUW.filtersWeek(O,FILTER);
      const l=zw();
      $('lijst').innerHTML=l.length?l.map(s=>BOUW.rij(s,{act:KEY===s.key,sel:SEL.has(s.key)})).join(''):'<div class="leeg">Geen stukken voor deze filter</div>';
      $('voet').innerHTML=BOUW.voetWeek();
    }else{
      $('filters').innerHTML=BOUW.filtersSeizoen(S,FILTER,ZOEK);
      $('lijst').innerHTML=BOUW.raster(S,zs(),D&&{key:KEY,week:D.week.nr});
      $('voet').innerHTML=BOUW.voetSeizoen();
      const z=$('zoek');z.oninput=e=>{ZOEK=e.target.value.trim().toLowerCase();const p=z.selectionStart;teken();const n=$('zoek');n.focus();n.setSelectionRange(p,p);};
    }
    $('detail').innerHTML=D?(week?BOUW.paneelWeek(D,TAB):BOUW.paneelSeizoen(D)):`<div class="leegd">Klik een stuk in de lijst voor het detail.</div>`;
  }
  async function openStuk(key,wk,stil){
    const r=await api('GET',`/api/rooster/gedeeld/stuk?key=${encodeURIComponent(key)}&week=${wk||WEEK||''}${PER?'&periode_id='+PER:''}`);
    if(!r.ok){KEY='';D=null;teken();return toast(r.json.error||'Detail laden mislukt','error');}
    KEY=key;D=r.json;bewaarUrl();teken();if(!stil)$('body').classList.add('toon-detail');
  }
  async function voerUit(v){
    let r;
    if(v.soort==='ruil')r=await api('POST','/api/rooster/wissel',{kampmoment_id:v.kampmoment_id,groep_thema_id:v.groep_thema_id,nieuw_thema_id:v.nieuw_thema_id,ruil_met_kt_id:v.ruil_met_kt_id});
    else r=await api('POST','/api/rooster/gedeeld/aanvaard',{periode_id:PER||undefined,week:D.week.nr,key:KEY,thema_id:v.thema_id});
    if(!r.ok)return toast(r.json.error||'Toepassen mislukt','error');
    toast(v.soort==='ruil'?`${v.tekst}: toegepast`:`${v.tekst.replace(/^of /,'')}: aanvaard voor deze week`,'success');
    await laad();
  }
  function csv(){
    let kol,rijen;
    if(ZICHT==='week'){const l=SEL.size?O.stukken.filter(s=>SEL.has(s.key)):zw();kol=['Week','Stuk','Nodig','Er zijn','Waar','Stand'];rijen=l.map(s=>[O.week.label,s.naam,s.nodig,s.beschikbaar,s.waar.map(w=>`${w.thema} (${w.locatie})`).join(' · '),s.stand.replace('_',' ')]);}
    else{kol=['Stuk',...S.weken.map(w=>'wk '+w.nr)];rijen=zs().map(s=>[s.naam,...s.weken.map(w=>w.nodig?`${w.nodig}/${s.beschikbaar}`:'')]);}
    const tekst=[kol,...rijen].map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(';')).join('\r\n');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+tekst],{type:'text/csv'}));a.download=ZICHT==='week'?`gedeeld-week-${WEEK}.csv`:'gedeeld-seizoen.csv';a.click();URL.revokeObjectURL(a.href);
  }
  document.addEventListener('click',async e=>{
    const t=e.target;if(t.closest('.mbox'))return;
    if(t.matches('[data-sel]')){t.checked?SEL.add(t.dataset.sel):SEL.delete(t.dataset.sel);return;}
    const z=t.closest('[data-zicht]');if(z){if(z.dataset.zicht!==ZICHT){ZICHT=z.dataset.zicht;FILTER=ZICHT==='week'?'nodig':'gebruikt';$('body').classList.remove('toon-detail');await laad();}return;}
    const wk=t.closest('[data-week]');if(wk&&!wk.disabled){WEEK+=+wk.dataset.week;return laad();}
    const chip=t.closest('.chip[data-f]');if(chip){FILTER=chip.dataset.f;return teken();}
    const tab=t.closest('[data-tab]');if(tab){TAB=tab.dataset.tab;return teken();}
    if(t.closest('[data-act="terug"]')){$('body').classList.remove('toon-detail');return;}
    const op=t.closest('[data-open]');if(op)return location.href=`/rooster?km=${op.dataset.open}&week=${D?D.week.nr:WEEK}${PER?'&periode_id='+PER:''}`;
    const pw=t.closest('[data-pweek]');if(pw&&!pw.disabled&&D){WEEK=D.week.nr+(+pw.dataset.pweek);return laad();}
    const nw=t.closest('[data-naarweek]');if(nw){ZICHT='week';WEEK=+nw.dataset.naarweek;FILTER='nodig';TAB='week';return laad();}
    const vs=t.closest('[data-voorstel]');if(vs&&D)return voerUit(D.voorstellen[+vs.dataset.voorstel]);
    if(t.closest('[data-oplossen]')&&D&&D.voorstellen.length)return voerUit(D.voorstellen[0]);
    const tr=t.closest('[data-terug]');if(tr&&D){const r=await api('POST','/api/rooster/gedeeld/aanvaard',{periode_id:PER||undefined,week:D.week.nr,key:KEY,thema_id:+tr.dataset.terug,terug:true});if(!r.ok)return toast(r.json.error||'Terugdraaien mislukt','error');toast('Teruggedraaid: het thema heeft het stuk weer nodig','success');return laad();}
    const rij=t.closest('[data-key]');if(rij&&!rij.classList.contains('leeg')){TAB='week';return openStuk(rij.dataset.key,+rij.dataset.wk||WEEK);}
  });
  $('alles').onchange=e=>{zw().forEach(s=>e.target.checked?SEL.add(s.key):SEL.delete(s.key));teken();};
  $('export').onclick=csv;
  async function kop(){
    const v=await api('GET','/api/vandaag');
    if(v.ok){$('per-naam').textContent=v.json.periode?v.json.periode.naam:'geen periode';$('wie').textContent=v.json.gebruiker.naam+' · kantoor';}
    const p=await api('GET','/api/periodes');if(!p.ok)return;
    if(PER){const x=p.json.find(y=>y.id===PER);if(x)$('per-naam').textContent=x.naam;}
    const sel=$('per-kies');sel.innerHTML=p.json.map(x=>`<option value="${x.id}"${(PER?x.id===PER:x.actief)?' selected':''}>${esc(x.naam)}</option>`).join('');
    sel.onchange=async()=>{const a=await api('POST','/api/periodes/'+sel.value+'/activeer');if(!a.ok)return toast(a.json.error||'Periode wisselen mislukt','error');PER=0;WEEK=0;KEY='';bewaarUrl();location.reload();};
  }
  (async()=>{await laad();kop();})();
})();
