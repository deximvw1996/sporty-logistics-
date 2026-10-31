// public/aanvullen.js — AV1: Voorraad & controles › Aanvullen (design/mockup-aanvullen-gsm.html, gsm-deel) voor de aanvuller in de stockage.
// Data: GET /api/aanvullijst?alles=1 (wat kantoor in Nakijken besliste); afvinken: POST /api/aanvullijst/:regel/aangevuld (pas dan daalt de voorraad).
// Pure HTML-bouwers (BOUW) los van de browser, zodat de test ze met echte data-JSON kan aanroepen.
'use strict';
(function(root){
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const DG=['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'],MND=['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
  const dagTekst=iso=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(iso||'');if(!m)return '';const d=new Date(+m[1],+m[2]-1,+m[3]);return `${DG[d.getDay()].slice(0,2)} ${d.getDate()} ${MND[d.getMonth()]}`;};
  const PIL={herstellen:['oranje','herstellen'],uit_pool:['blauw','uit voorraad'],naar_pool:['','terug in voorraad'],afschrijven:['oranje','afschrijven'],bestelling:['','bestelling'],nakijken:['groen','zelf tellen'],melding:['oranje','gemeld, wacht op kantoor']};
  const FILTERS=[['alles','Alles'],['uit_pool','Uit voorraad'],['bestelling','Bestelling'],['klaar','Klaar']];
  const klaarN=g=>g.handelingen.filter(h=>h.aangevuld).length;
  // TF6 G3: een melding die bij kantoor ligt houdt "Bak klaar" niet tegen en telt niet mee in "n van m".
  const eigen=g=>g.handelingen.filter(h=>!h.wacht_op_kantoor);
  const bakKlaar=g=>eigen(g).length>0&&klaarN(g)===eigen(g).length;
  // Wat vandaag vertrekt bovenaan, dan op vertrekdatum, bakken zonder vertrek onderaan; afgeronde bakken helemaal onderaan.
  function sorteer(groepen,vandaag){
    const rang=g=>g.leeg?4:bakKlaar(g)?3:g.vertrek&&g.vertrek<=vandaag?0:g.vertrek?1:2;
    return groepen.slice().sort((a,b)=>rang(a)-rang(b)||(a.vertrek||'9').localeCompare(b.vertrek||'9')||(a.bak.code||'').localeCompare(b.bak.code||''));
  }
  const passeert=(h,f)=>f==='alles'||(f==='klaar'?!!h.aangevuld:f==='uit_pool'?h.soort==='uit_pool':f==='bestelling'?h.soort==='bestelling':true);
  const plaatsTekst=g=>g.plaats&&g.plaats.tekst?g.plaats.tekst:'';
  const BOUW={
    esc,dagTekst,sorteer,bakKlaar,klaarN,
    // Lijstscherm: één kaart per bak, "n van m klaar", wat vandaag vertrekt bovenaan.
    lijst(data,{filter='alles',vandaag,...st}={}){
      const t=data.tellers||{},w=data.week;
      // TF8 N6: Vandaag en Aanvullen tellen hetzelfde: wat nog te doen is (open handelingen, bakken met iets open); wat klaar is staat apart.
      const alleG=data.bakken||[],isOpen=h=>!h.wacht_op_kantoor&&!h.aangevuld;
      const tel={open:alleG.reduce((s,g)=>s+g.handelingen.filter(isOpen).length,0),klaar:alleG.reduce((s,g)=>s+g.handelingen.filter(h=>h.aangevuld).length,0),bakken:alleG.filter(g=>g.bak.soort!=='melding'&&g.handelingen.some(isOpen)).length};
      const chips=FILTERS.map(([k,n])=>`<span class="chip${filter===k?' act':''}" role="button" tabindex="0" data-av="filter" data-a="${k}">${n} <b>${k==='alles'?t.totaal||0:k==='klaar'?t.klaar||0:t[k]||0}</b></span>`).join('');
      const groepen=sorteer(data.bakken||[],vandaag||data.datum).filter(g=>filter==='alles'||g.handelingen.some(h=>passeert(h,filter)));
      const kaartHtml=g=>{
        const n=g.handelingen.filter(h=>!h.wacht_op_kantoor).length,k=klaarN(g),vt=g.vertrek;
        const dagNu=vandaag||data.datum,vandaagVt=vt&&vt===dagNu,teLaat=vt&&vt<dagNu; // TF8 G12: een datum in het verleden is niet "vandaag" maar "te laat"
        return `<div class="bakK${bakKlaar(g)?' klaar':''}" role="button" tabindex="0" data-av="open" data-id="${g.sessie_id}"><span class="code">${esc(g.bak.code||(g.bak.soort==='melding'?'📝':'—'))}</span><div class="nm">${esc(g.bak.soort==='melding'?('Losse melding'+(g.handelingen.length?' · '+g.handelingen.map(h=>h.stuk).join(', ').slice(0,50):'')):g.bak.naam)}<b>${esc([g.locatie,g.week?'wk '+g.week:'',plaatsTekst(g)].filter(Boolean).join(' · '))}</b></div><div class="rechts"><span class="pil ${bakKlaar(g)?'groen':k?'blauw':''}">${g.leeg?'niets aan te vullen':k+' van '+n+' klaar'}</span>${g.klaar?`<small class="klaarTag">klaar ✓ ${esc([g.klaar.door,g.klaar.op?g.klaar.op.slice(11,16):''].filter(Boolean).join(' · '))}</small>`:vt&&!bakKlaar(g)?`<small class="${vandaagVt||teLaat?'vandaag':''}">${teLaat?'levering te laat ('+esc(dagTekst(vt))+')':vandaagVt?'vertrekt vandaag':'vertrekt '+esc(dagTekst(vt))}</small>`:''}</div></div>`;
      };
      const bakkenG=groepen.filter(g=>g.bak.soort!=='melding'),losseG=groepen.filter(g=>g.bak.soort==='melding');
      const kaarten=bakkenG.map(kaartHtml).join('')+(losseG.length?`<h3 class="losseKop">Losse meldingen en aanvragen</h3>`+losseG.map(kaartHtml).join(''):'')||'<div class="leeg">Er is niets aan te vullen.</div>';
      return `<div class="kopB"><div><b>Aanvullen · Rozenweg</b><span>${esc(dagTekst(data.datum))} · ${tel.open} handeling${tel.open===1?'':'en'} te doen in ${tel.bakken} bak${tel.bakken===1?'':'ken'}${tel.klaar?' · '+tel.klaar+' klaar':''}</span></div><a class="knop licht klein" href="/aanvullijst-print">🖨 Printlijst</a></div>
        <div class="gbody"><div class="filters2">${chips}</div>${kaarten}<button type="button" class="knop licht meldKnop" data-av="meld-open" data-los="1">+ Losse melding</button><div class="hint">Kies een bak en vink af wat je gedaan hebt. Afschrijven vraagt een foto. Wat op een bestelling wacht, kan pas afgevinkt worden als die binnen is.</div></div>${st.meld?BOUW.meldOverlay(st.meld,null):''}`;
    },
    // Eén handeling: groot vinkvak, aantal, foto, uitleg.
    handeling(h,st={}){
      const p=(h.actie==='herstellen'?PIL.herstellen:PIL[h.soort])||['',h.soort],foto=(st.fotos||{})[h.regel_id];
      const gemeldWacht=!!h.wacht_op_kantoor;
      const wacht=!h.kan_afvinken&&!h.aangevuld&&!gemeldWacht;
      const kleur=h.aangevuld?'groen':wacht?'rood':'';
      const vink=gemeldWacht?`<button type="button" class="vink uit" disabled aria-label="Gemeld, wacht op kantoor">🕓</button>`:wacht?`<button type="button" class="vink uit" disabled aria-label="Wacht op levering">⏳</button>`:`<button type="button" class="vink${h.aangevuld?' aan':''}" data-av="vink" data-regel="${h.regel_id}" aria-label="${h.aangevuld?'Terugzetten naar open':'Afvinken'}: ${esc(h.stuk)}">${h.aangevuld?'✓':''}</button>`;
      const aantal=h.aangevuld||wacht||gemeldWacht?'':`<label class="aantal">aantal<input type="number" inputmode="numeric" min="1" max="${h.aantal}" value="${(st.aantal||{})[h.regel_id]||h.aantal}" data-av="aantal" data-regel="${h.regel_id}" aria-label="Aantal aangevuld van ${esc(h.stuk)}"></label>`;
      const fotoKnop=h.aangevuld||wacht||gemeldWacht?'':`<label class="knop ${foto?'':'licht'} klein cam" aria-label="Foto maken">📷${foto?' ✓':''}<input type="file" accept="image/*" capture="environment" data-av="foto" data-regel="${h.regel_id}" hidden></label>`;
      return `<div class="it ${kleur}" data-regel="${h.regel_id}">${vink}<div class="nm">${esc(h.stuk)} <b class="x">× ${h.aangevuld&&h.totaal?h.totaal:h.aantal}</b>${h.aangevuld&&h.aangevuld_door?`<small class="door">${esc(h.aangevuld_door)}</small>`:h.gedaan_door?`<small class="door">deel: ${esc(h.gedaan_door)}</small>`:''}<span class="pil ${p[0]}">${wacht?'wacht op levering':p[1]}</span>${h.gedaan>0&&!h.aangevuld?`<span class="pil blauw gedaan">${h.gedaan} van ${h.totaal} gedaan</span>`:''}<b>${esc(h.waar_tekst||'')}${h.soort==='afschrijven'&&!h.aangevuld?' · foto verplicht':''}</b>${h.uit_voorraad_mogelijk&&st.rol&&st.rol!=='aanvuller'&&st.rol!=='chauffeur'?`<button type="button" class="knop klein uitV" data-av="uit-voorraad" data-art="${esc(h.artikel_id)}" aria-label="Aanvullen uit voorraad: ${esc(h.stuk)}">Aanvullen uit voorraad</button>`:''}</div><div class="acties">${aantal}${fotoKnop}${h.aangevuld||gemeldWacht?'':`<button type="button" class="knop licht klein melds" data-av="meld-open" data-stuk="${esc(h.stuk)}" aria-label="Kapot of weg melden: ${esc(h.stuk)}">⚠</button>`}</div></div>`;
    },
    // Bakscherm: ‹ terug, per stuk afvinken, Bak klaar als alles af is.
    bak(g,st={}){
      const n=eigen(g).length,k=klaarN(g),klaar=bakKlaar(g),nm=g.handelingen.length-n;
      return `<div class="kopB"><a class="terug" role="button" tabindex="0" data-av="terug">‹ terug</a><div><b>${esc((g.bak.code?g.bak.code+' · ':'')+g.bak.naam)}</b><span>${esc([g.locatie,g.week?'wk '+g.week:'',plaatsTekst(g)].filter(Boolean).join(' · '))}</span></div></div>
        <div class="gbody"><div class="sec">${g.handelingen.map(h=>BOUW.handeling(h,st)).join('')}</div><button type="button" class="knop licht meldKnop" data-av="meld-open">⚠ Kapot of weg melden</button><div class="hint">Vink af wat je gedaan hebt. Minder gevonden dan nodig? Pas het aantal aan: de rest blijft open staan. Afschrijven vraagt een foto.</div>${nm?`<div class="hint">${nm} melding${nm===1?' ligt':'en liggen'} bij kantoor. De bak mag mee: kantoor beslist later in Nakijken.</div>`:''}${g.klaar?`<div class="hint klaarTag">✓ Klaar gezet door ${esc(g.klaar.door)} om ${esc((g.klaar.op||'').slice(11,16))}</div>`:''}</div>
        <div class="voet"><a class="knop licht" href="/aanvullijst-print">🖨 Printlijst</a><button type="button" class="knop" data-av="klaar"${klaar?'':' disabled'}>Bak ${esc(g.bak.code||'')} klaar (${k}/${n})</button></div>${st.meld?BOUW.meldOverlay(st.meld,g):''}`;
    },
    // AV2: overlay van volle hoogte om kapot of weg te melden. Een melding is geen beslissing: kantoor beslist in Nakijken.
    meldOverlay(m,g){
      const namen=g?[...new Set([...(g.inhoud||[]),...g.handelingen.map(h=>h.stuk)])]:[];
      const vrij=!g||m.stuk==='__vrij'||(m.stuk&&!namen.includes(m.stuk));
      const opties=namen.map(n=>`<option value="${esc(n)}"${m.stuk===n?' selected':''}>${esc(n)}</option>`).join('')+(g?`<option value="__vrij"${vrij?' selected':''}>Ander stuk (typ de naam)…</option>`:'');
      const kapot=m.soort==='kapot';
      return `<div class="meld" role="dialog" aria-modal="true" aria-label="Kapot of weg melden"><div class="kopB"><a class="terug" role="button" tabindex="0" data-av="meld-sluit">‹ terug</a><div><b>${g?'Kapot of weg melden':'Losse melding'}</b><span>${g?esc((g.bak.code?g.bak.code+' · ':'')+g.bak.naam):'Kantoor beslist in Nakijken'}</span></div></div>
        <div class="gbody">${g&&namen.length?`<label class="vl">Welk stuk<select data-av="meld-stuk" aria-label="Welk stuk">${opties}</select></label>`:''}${vrij?`<label class="vl">${g?'Naam van het stuk':'Welk stuk (vrije naam)'}<input type="text" maxlength="80" data-av="meld-naam" value="${esc(m.naam||'')}" aria-label="Naam van het stuk"></label>`:''}
        <div class="vl">Wat is er aan de hand<div class="duo"><button type="button" class="knop ${kapot?'':'licht'}" data-av="meld-soort" data-a="kapot" aria-pressed="${kapot}">Kapot</button><button type="button" class="knop ${kapot?'licht':''}" data-av="meld-soort" data-a="weg" aria-pressed="${!kapot}">Weg</button></div></div>
        <label class="vl">Aantal<input type="number" inputmode="numeric" min="1" data-av="meld-aantal" value="${esc(m.aantal||1)}" aria-label="Aantal"></label>
        <div class="vl">Foto ${kapot?'(verplicht bij kapot)':'(mag, helpt kantoor)'}<label class="knop ${m.foto?'':'licht'} cam fotoBig" aria-label="Foto maken">📷 ${m.foto?'Foto klaar ✓':'Foto maken'}<input type="file" accept="image/*" capture="environment" data-av="meld-foto" hidden></label></div>
        ${g?'':`<label class="vl">Waar in de stockage (mag leeg)<input type="text" maxlength="60" data-av="meld-waar" value="${esc(m.waar||'')}" aria-label="Waar in de stockage"></label>`}
        <label class="vl">Notitie (mag leeg)<textarea rows="3" maxlength="300" data-av="meld-notitie" aria-label="Notitie">${esc(m.notitie||'')}</textarea></label>
        <div class="hint">Dit is een melding, geen beslissing. Kantoor kijkt ernaar in Nakijken; de voorraad verandert pas als kantoor beslist.</div></div>
        <div class="voet"><button type="button" class="knop licht" data-av="meld-sluit">Annuleren</button><button type="button" class="knop" data-av="meld-stuur">Melden aan kantoor</button></div></div>`;
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
  // TF6 G4: een netfout is nooit stil: de aanroep geeft een mislukt resultaat terug en de melding staat in beeld.
  async function api(m,url,body){
    try{return await window.sportyApi(m,url,body,{toast:x=>toast(x,'info'),token:TOKEN});}
    catch(e){return {ok:false,status:0,json:{error:'Geen verbinding, niet bewaard. Probeer het zo opnieuw.'}};}
  }
  let ROL='';try{ROL=(JSON.parse(localStorage.getItem('sporty-auth-user')||'{}')||{}).rol||localStorage.getItem('sporty-rol')||'';}catch(x){/* geen gebruiker */}
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  let DATA=null,OPEN=null,FILTER='alles',ST={fotos:{},aantal:{},meld:null};
  const groep=()=>DATA&&DATA.bakken.find(g=>g.sessie_id===OPEN);
  function teken(){
    const g=OPEN&&groep();
    if(OPEN&&!g)OPEN=null;
    ST.rol=ROL;
    $('av').innerHTML=g?BOUW.bak(g,ST):DATA?BOUW.lijst(DATA,{filter:FILTER,vandaag:iso(new Date()),meld:ST.meld,rol:ROL}):'<div class="leeg">Laden…</div>';
  }
  window.addEventListener('sporty-live',()=>laad()); // RT1
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
    if(!ST.meld)return;
    if(t.dataset.av==='meld-foto'&&t.files&&t.files[0]){try{ST.meld.foto=await leesFoto(t.files[0]);teken();}catch(x){toast('Foto lezen mislukt','error');}}
    if(t.dataset.av==='meld-stuk'){ST.meld.stuk=t.value;teken();}
    if(t.dataset.av==='meld-naam')ST.meld.naam=t.value;
    if(t.dataset.av==='meld-aantal')ST.meld.aantal=parseInt(t.value)||'';
    if(t.dataset.av==='meld-waar')ST.meld.waar=t.value;
    if(t.dataset.av==='meld-notitie')ST.meld.notitie=t.value;
  });
  document.addEventListener('input',e=>{
    const t=e.target;if(!ST.meld||!t.dataset)return;
    if(t.dataset.av==='meld-naam')ST.meld.naam=t.value;
    if(t.dataset.av==='meld-aantal')ST.meld.aantal=parseInt(t.value)||'';
    if(t.dataset.av==='meld-waar')ST.meld.waar=t.value;
    if(t.dataset.av==='meld-notitie')ST.meld.notitie=t.value;
  });
  document.addEventListener('click',async e=>{
    const el=e.target.closest('[data-av]');if(!el||el.disabled||el.tagName==='INPUT')return;
    const a=el.dataset.av;
    if(a==='meld-open'){const g=el.dataset.los?null:groep();const namen=g?[...new Set([...(g.inhoud||[]),...g.handelingen.map(h=>h.stuk)])]:[];ST.meld={soort:'kapot',aantal:1,stuk:el.dataset.stuk||(namen[0]||'__vrij'),naam:'',waar:'',notitie:'',foto:''};return teken();}
    if(a==='meld-sluit'){ST.meld=null;return teken();}
    if(a==='meld-soort'){ST.meld.soort=el.dataset.a;return teken();}
    if(a==='meld-stuur'){
      const m=ST.meld,g=groep();if(!m)return;
      const naam=(g&&m.stuk&&m.stuk!=='__vrij'&&(g.inhoud||[]).concat(g.handelingen.map(h=>h.stuk)).includes(m.stuk))?m.stuk:(m.naam||'').trim();
      if(!naam)return toast('Vul in welk stuk het is.','warn');
      if(!(m.aantal>=1))return toast('Vul een aantal in (minstens 1).','warn');
      if(m.soort==='kapot'&&!m.foto)return toast('Kapot melden vraagt een foto: tik op 📷.','warn');
      const body={item_naam:naam,soort:m.soort,aantal:m.aantal,notitie:[m.waar?'Waar: '+m.waar:'',m.notitie].filter(Boolean).join(' · ')};
      if(m.foto)body.foto_data=m.foto;
      if(g){body.sessie_id=g.sessie_id;}
      const r=await api('POST','/api/aanvullijst/melding',body);
      if(!r.ok)return toast(r.json.error||'Melden mislukt','error');
      ST.meld=null;toast(r.json.dubbel?'Erbij op je eerdere melding. Kantoor beslist.':'Gemeld aan kantoor. Kantoor beslist in Nakijken.','success');return laad();
    }
    if(a==='filter'){FILTER=el.dataset.a;return teken();}
    if(a==='uit-voorraad'){
      const r=await api('PUT','/api/tekorten/'+encodeURIComponent(el.dataset.art)+'/stand',{stand:'uit_voorraad'});
      if(!r.ok)return toast(r.json.error||'Dat lukte niet','error');
      toast('Wordt aangevuld uit voorraad','success');return laad();
    }
    if(a==='open'){OPEN=+el.dataset.id;window.scrollTo(0,0);return teken();}
    if(a==='terug'){OPEN=null;return teken();}
    if(a==='klaar'){
      const g=groep();if(!g)return;
      const r=await api('POST','/api/aanvullijst/sessie/'+g.sessie_id+'/klaar',{klaar:true}); // TF8: bewaard met wie en wanneer
      if(!r.ok)return toast(r.json.error||'Klaar zetten mislukt','error');
      toast(`Bak ${g.bak.code||''} klaar · ${r.json.door||''}`,'success');OPEN=null;await laad();return;
    }
    if(a==='vink'){
      const id=+el.dataset.regel,g=groep(),h=g&&g.handelingen.find(x=>x.regel_id===id);if(!h)return;
      if(h.aangevuld){let r=await api('POST',`/api/aanvullijst/${id}/aangevuld`,{aangevuld:false});
        if(r.status===409&&r.json.code==='ander'){if(!confirm(`Dit deed ${r.json.door}. Toch terugzetten?`))return;r=await api('POST',`/api/aanvullijst/${id}/aangevuld`,{aangevuld:false,bevestigd:true});}
        if(!r.ok)return toast(r.json.error||'Terugzetten mislukt','error');return laad();}
      if(!h.kan_afvinken)return toast('Deze bestelling wacht nog op levering.','warn');
      const body={aangevuld:true,gezien:h.aantal};
      if(h.soort==='afschrijven'&&!ST.fotos[id])return toast('Afschrijven vraagt een foto: tik eerst op 📷.','warn');
      if(ST.fotos[id])body.foto_data=ST.fotos[id];
      const n=ST.aantal[id];
      if(n&&n>h.aantal)toast(`Je vulde ${n} in, maar er is nog maar ${h.aantal} te doen: het worden er ${h.aantal}.`,'warn'); // TF8 N11
      if(n&&n<h.aantal)body.aantal=n;
      const r=await api('POST',`/api/aanvullijst/${id}/aangevuld`,body);
      if(!r.ok){toast('Niet bewaard: '+(r.json.error||'afvinken mislukt'),'error');return laad();}
      if(r.json.al_gedaan){toast(`Al gedaan${r.json.door?' door '+r.json.door:''}`,'warn');return laad();}
      if(r.json.intussen)toast(`${r.json.intussen.door||'Iemand'} deed er intussen al ${r.json.intussen.aantal}`,'warn');
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
