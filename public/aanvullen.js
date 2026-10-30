// public/aanvullen.js — AV1: Voorraad & controles › Aanvullen (design/mockup-aanvullen-gsm.html, gsm-deel) voor de aanvuller in de stockage.
// Data: GET /api/aanvullijst?alles=1 (wat kantoor in Nakijken besliste); afvinken: POST /api/aanvullijst/:regel/aangevuld (pas dan daalt de voorraad).
// Pure HTML-bouwers (BOUW) los van de browser, zodat de test ze met echte data-JSON kan aanroepen.
'use strict';
(function(root){
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const DG=['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'],MND=['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
  const dagTekst=iso=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(iso||'');if(!m)return '';const d=new Date(+m[1],+m[2]-1,+m[3]);return `${DG[d.getDay()].slice(0,2)} ${d.getDate()} ${MND[d.getMonth()]}`;};
  const PIL={uit_pool:['blauw','uit pool'],naar_pool:['','naar pool'],afschrijven:['oranje','afschrijven'],bestelling:['','bestelling'],nakijken:['groen','zelf tellen']};
  const FILTERS=[['alles','Alles'],['uit_pool','Uit pool'],['bestelling','Bestelling'],['klaar','Klaar']];
  const klaarN=g=>g.handelingen.filter(h=>h.aangevuld).length;
  const bakKlaar=g=>g.handelingen.length>0&&klaarN(g)===g.handelingen.length;
  // Wat vandaag vertrekt bovenaan, dan op vertrekdatum, bakken zonder vertrek onderaan; afgeronde bakken helemaal onderaan.
  function sorteer(groepen,vandaag){
    const rang=g=>bakKlaar(g)?3:g.vertrek&&g.vertrek<=vandaag?0:g.vertrek?1:2;
    return groepen.slice().sort((a,b)=>rang(a)-rang(b)||(a.vertrek||'9').localeCompare(b.vertrek||'9')||(a.bak.code||'').localeCompare(b.bak.code||''));
  }
  const passeert=(h,f)=>f==='alles'||(f==='klaar'?!!h.aangevuld:f==='uit_pool'?h.soort==='uit_pool':f==='bestelling'?h.soort==='bestelling':true);
  const plaatsTekst=g=>g.plaats&&g.plaats.tekst?g.plaats.tekst:'';
  const BOUW={
    esc,dagTekst,sorteer,bakKlaar,klaarN,
    // Lijstscherm: één kaart per bak, "n van m klaar", wat vandaag vertrekt bovenaan.
    lijst(data,{filter='alles',vandaag}={}){
      const t=data.tellers||{},w=data.week;
      const chips=FILTERS.map(([k,n])=>`<span class="chip${filter===k?' act':''}" role="button" tabindex="0" data-av="filter" data-a="${k}">${n} <b>${k==='alles'?t.totaal||0:k==='klaar'?t.klaar||0:t[k]||0}</b></span>`).join('');
      const groepen=sorteer(data.bakken||[],vandaag||data.datum).filter(g=>filter==='alles'||g.handelingen.some(h=>passeert(h,filter)));
      const kaarten=groepen.map(g=>{
        const n=g.handelingen.length,k=klaarN(g),vt=g.vertrek;
        const vandaagVt=vt&&vt<=(vandaag||data.datum);
        return `<div class="bakK${bakKlaar(g)?' klaar':''}" role="button" tabindex="0" data-av="open" data-id="${g.sessie_id}"><span class="code">${esc(g.bak.code||'—')}</span><div class="nm">${esc(g.bak.naam)}<b>${esc([g.locatie,g.week?'wk '+g.week:'',plaatsTekst(g)].filter(Boolean).join(' · '))}</b></div><div class="rechts"><span class="pil ${bakKlaar(g)?'groen':k?'blauw':''}">${k} van ${n} klaar</span>${vt&&!bakKlaar(g)?`<small class="${vandaagVt?'vandaag':''}">${vandaagVt?'vertrekt vandaag':'vertrekt '+esc(dagTekst(vt))}</small>`:''}</div></div>`;
      }).join('')||'<div class="leeg">Er is niets aan te vullen.</div>';
      return `<div class="kopB"><div><b>Aanvullen · Rozenweg</b><span>${esc(dagTekst(data.datum))} · ${t.totaal||0} handeling${t.totaal===1?'':'en'} in ${t.bakken||0} bak${t.bakken===1?'':'ken'}</span></div><a class="knop licht klein" href="/aanvullijst-print">🖨 Printlijst</a></div>
        <div class="gbody"><div class="filters2">${chips}</div>${kaarten}<div class="hint">Kies een bak en vink af wat je gedaan hebt. Afschrijven vraagt een foto. Wat op een bestelling wacht, kan pas afgevinkt worden als die binnen is.</div></div>`;
    },
    // Eén handeling: groot vinkvak, aantal, foto, uitleg.
    handeling(h,st={}){
      const p=PIL[h.soort]||['',h.soort],foto=(st.fotos||{})[h.regel_id];
      const wacht=!h.kan_afvinken&&!h.aangevuld;
      const kleur=h.aangevuld?'groen':wacht?'rood':'';
      const vink=wacht?`<button type="button" class="vink uit" disabled aria-label="Wacht op levering">⏳</button>`:`<button type="button" class="vink${h.aangevuld?' aan':''}" data-av="vink" data-regel="${h.regel_id}" aria-label="${h.aangevuld?'Terugzetten naar open':'Afvinken'}: ${esc(h.stuk)}">${h.aangevuld?'✓':''}</button>`;
      const aantal=h.aangevuld||wacht?'':`<label class="aantal">aantal<input type="number" inputmode="numeric" min="1" max="${h.aantal}" value="${(st.aantal||{})[h.regel_id]||h.aantal}" data-av="aantal" data-regel="${h.regel_id}" aria-label="Aantal aangevuld van ${esc(h.stuk)}"></label>`;
      const fotoKnop=h.aangevuld||wacht?'':`<label class="knop ${foto?'':'licht'} klein cam" aria-label="Foto maken">📷${foto?' ✓':''}<input type="file" accept="image/*" capture="environment" data-av="foto" data-regel="${h.regel_id}" hidden></label>`;
      return `<div class="it ${kleur}" data-regel="${h.regel_id}">${vink}<div class="nm">${esc(h.stuk)} <b class="x">× ${h.aantal}</b><span class="pil ${p[0]}">${wacht?'wacht op levering':p[1]}</span><b>${esc(h.waar_tekst||'')}${h.soort==='afschrijven'&&!h.aangevuld?' · foto verplicht':''}</b></div><div class="acties">${aantal}${fotoKnop}</div></div>`;
    },
    // Bakscherm: ‹ terug, per stuk afvinken, Bak klaar als alles af is.
    bak(g,st={}){
      const n=g.handelingen.length,k=klaarN(g),klaar=bakKlaar(g);
      return `<div class="kopB"><a class="terug" role="button" tabindex="0" data-av="terug">‹ terug</a><div><b>${esc((g.bak.code?g.bak.code+' · ':'')+g.bak.naam)}</b><span>${esc([g.locatie,g.week?'wk '+g.week:'',plaatsTekst(g)].filter(Boolean).join(' · '))}</span></div></div>
        <div class="gbody"><div class="sec">${g.handelingen.map(h=>BOUW.handeling(h,st)).join('')}</div><div class="hint">Vink af wat je gedaan hebt. Minder gevonden dan nodig? Pas het aantal aan: de rest blijft open staan. Afschrijven vraagt een foto.</div></div>
        <div class="voet"><a class="knop licht" href="/aanvullijst-print">🖨 Printlijst</a><button type="button" class="knop" data-av="klaar"${klaar?'':' disabled'}>Bak ${esc(g.bak.code||'')} klaar (${k}/${n})</button></div>`;
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
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  let DATA=null,OPEN=null,FILTER='alles',ST={fotos:{},aantal:{}};
  const groep=()=>DATA&&DATA.bakken.find(g=>g.sessie_id===OPEN);
  function teken(){
    const g=OPEN&&groep();
    if(OPEN&&!g)OPEN=null;
    $('av').innerHTML=g?BOUW.bak(g,ST):DATA?BOUW.lijst(DATA,{filter:FILTER,vandaag:iso(new Date())}):'<div class="leeg">Laden…</div>';
  }
  async function laad(){
    const r=await api('GET','/api/aanvullijst?alles=1');
    if(r.status===401||r.status===403){location.href='/';return;}
    if(!r.ok)return toast(r.json.error||'Aanvullijst laden mislukt','error');
    DATA=r.json;teken();
  }
  const leesFoto=f=>new Promise((ok,nok)=>{const fr=new FileReader();fr.onload=()=>ok(fr.result);fr.onerror=nok;fr.readAsDataURL(f);});
  document.addEventListener('change',async e=>{
    const t=e.target;if(!t.dataset||!t.dataset.av)return;
    if(t.dataset.av==='foto'&&t.files&&t.files[0]){try{ST.fotos[t.dataset.regel]=await leesFoto(t.files[0]);toast('Foto klaar','success');teken();}catch(x){toast('Foto lezen mislukt','error');}}
    if(t.dataset.av==='aantal')ST.aantal[t.dataset.regel]=parseInt(t.value)||'';
  });
  document.addEventListener('click',async e=>{
    const el=e.target.closest('[data-av]');if(!el||el.disabled||el.tagName==='INPUT')return;
    const a=el.dataset.av;
    if(a==='filter'){FILTER=el.dataset.a;return teken();}
    if(a==='open'){OPEN=+el.dataset.id;window.scrollTo(0,0);return teken();}
    if(a==='terug'){OPEN=null;return teken();}
    if(a==='klaar'){const g=groep();toast(`Bak ${g?g.bak.code:''} klaar`,'success');OPEN=null;await laad();return;}
    if(a==='vink'){
      const id=+el.dataset.regel,g=groep(),h=g&&g.handelingen.find(x=>x.regel_id===id);if(!h)return;
      if(h.aangevuld){const r=await api('POST',`/api/aanvullijst/${id}/aangevuld`,{aangevuld:false});if(!r.ok)return toast(r.json.error||'Terugzetten mislukt','error');return laad();}
      if(!h.kan_afvinken)return toast('Deze bestelling wacht nog op levering.','warn');
      const body={aangevuld:true};
      if(h.soort==='afschrijven'&&!ST.fotos[id])return toast('Afschrijven vraagt een foto: tik eerst op 📷.','warn');
      if(ST.fotos[id])body.foto_data=ST.fotos[id];
      const n=ST.aantal[id];if(n&&n<h.aantal)body.aantal=n;
      const r=await api('POST',`/api/aanvullijst/${id}/aangevuld`,body);
      if(!r.ok)return toast(r.json.error||'Afvinken mislukt','error');
      delete ST.fotos[id];delete ST.aantal[id];
      if(r.json.open)toast(`${r.json.gedaan} aangevuld, ${r.json.open} blijven open`,'warn');else toast(`${h.stuk} aangevuld`,'success');
      return laad();
    }
  });
  (async()=>{
    await laad();
    try{const u=JSON.parse(localStorage.getItem('sporty-auth-user')||'{}');const w=$('wie');if(w)w.textContent=(u.naam||'')+(u.rol?' · '+u.rol:'');}catch(x){/* geen gebruiker */}
  })();
})(typeof window!=='undefined'?window:globalThis);
