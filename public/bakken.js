// public/bakken.js — MA1: Materiaal › Bakken (design/mockup-materiaal.html) op het kantoorpatroon.
// Lijst uit GET /api/bakken-overzicht, detail uit GET /api/bakken/:id/detail; acties via de bestaande routes.
// Na elke actie opnieuw laden; fouten als toast. Alleen weergave: de gsm-laag gebruikt later dezelfde API.
'use strict';
(function(){
  function kvL(n){return /^KV\s/i.test(n)?n:'KV '+n;}
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
  async function api(methode,url,body){
    return window.sportyApi(methode,url,body,{toast:m=>toast(m,'info'),token:TOKEN});
  }
  // vraagModal (zelfde gedrag als index.html): null bij annuleren, anders wat lees() teruggeeft.
  function vraag({titel,tekst,html,ok='Bevestigen',lees}){
    return new Promise(resolve=>{
      const bg=document.createElement('div');bg.className='mbg';
      bg.innerHTML=`<div class="mbox" role="dialog" aria-modal="true"><h4>${esc(titel)}</h4>${tekst?`<p>${esc(tekst)}</p>`:''}<form class="form" onsubmit="return false">${html||''}<div class="knoppen"><button type="button" class="knop licht" data-x="0">Annuleren</button><button type="button" class="knop" data-x="1">${esc(ok)}</button></div></form></div>`;
      const sluit=v=>{document.removeEventListener('keydown',toets,true);bg.remove();resolve(v);};
      const toets=e=>{if(e.key==='Escape'){e.preventDefault();sluit(null);}};
      document.addEventListener('keydown',toets,true);
      bg.addEventListener('mousedown',e=>{if(e.target===bg)sluit(null);});
      bg.querySelector('[data-x="0"]').onclick=()=>sluit(null);
      bg.querySelector('[data-x="1"]').onclick=async()=>{const v=lees?await lees(bg.querySelector('form')):{};if(v)sluit(v);};
      document.body.appendChild(bg);(bg.querySelector('select,input')||bg.querySelector('[data-x="1"]')).focus();
    });
  }

  const Q=new URLSearchParams(location.search);
  let O=null,D=null,SEL=new Set(),FILTER='alle',ZOEK='',TAB='inhoud',LOCS=null,THEMAS=null;
  const sleutel=b=>(b.soort==='attribuut'?'a':'b')+b.id;
  const ROZ=()=>((LOCS||[]).find(l=>l.type==='stockage'&&/rozenweg/i.test(l.name))||{}).id;
  const FILTERS={alle:()=>true,thema:b=>b.soort==='thema',vast:b=>b.soort==='vast'||b.soort==='pool',attribuut:b=>b.soort==='attribuut',
    onderweg:b=>!!b.waar_nu.rit_id,incompleet:b=>b.incompleet,code_dubbel:b=>b.code_dubbel,code_leeg:b=>b.code_leeg,rozenweg:b=>b.waar_nu.locatie_id===ROZ()};
  const zichtbaar=()=>O.bakken.filter(FILTERS[FILTER]).filter(b=>!ZOEK||b.zoek.includes(ZOEK));
  const basis=s=>s==='attribuut'?'/api/attributen/':'/api/bakken/';

  async function laad(){
    const r=await api('GET','/api/bakken-overzicht');
    if(r.status===401||r.status===403){location.href='/';return;}
    if(!r.ok)return toast(r.json.error||'Bakken laden mislukt','error');
    O=r.json;
    if(!LOCS){const l=await api('GET','/api/locaties');LOCS=l.ok?l.json:[];}
    SEL=new Set([...SEL].filter(k=>O.bakken.some(b=>sleutel(b)===k)));
    tekenLijst();
    if(D)await laadDetail(D.bak.soort,D.bak.id);
  }
  function tekenLijst(){
    document.querySelectorAll('.chip').forEach(c=>{c.classList.toggle('act',c.dataset.f===FILTER);const b=c.querySelector('b');if(b)b.textContent=O.tellers[c.dataset.f==='alle'?'alle':c.dataset.f];});
    const lijst=zichtbaar();
    $('lijst').innerHTML=lijst.length?lijst.map(b=>`<div class="r ${D&&sleutel(D.bak)===sleutel(b)?'act':''}" data-k="${sleutel(b)}"><span><input type="checkbox" data-sel="${sleutel(b)}" ${SEL.has(sleutel(b))?'checked':''} aria-label="Selecteer ${esc(b.code||b.naam)}"></span><span>${b.code?`<b>${esc(b.code)}</b> `:''}${esc(b.naam)}</span><span>${esc(b.thema?b.thema.naam:'—')}</span><span>${esc(b.waar_nu_tekst)}</span><span>${esc(b.inhoud_tekst)}</span><span>${esc(b.stand_tekst)}</span><span><span class="pil ${b.status==='let'?'oranje':'groen'}">${b.status==='let'?'⚠':'ok'}</span></span></div>`).join('')
      :'<div class="leeg">Geen bakken voor deze filter</div>';
    $('n-bakken').textContent=`${lijst.length} bakken`;
    $('n-sel').textContent=`${SEL.size} geselecteerd`;
    $('voet').classList.toggle('sel',SEL.size>0);
    $('alles').checked=lijst.length>0&&lijst.every(b=>SEL.has(sleutel(b)));
  }

  async function laadDetail(soort,id){
    const r=await api('GET',`/api/bakken/${id}/detail${soort==='attribuut'?'?soort=attribuut':''}`);
    if(!r.ok){D=null;$('detail').innerHTML='<div class="leegd">Klik een bak in de lijst voor het detail.</div>';return toast(r.json.error||'Detail laden mislukt','error');}
    D=r.json;tekenDetail();
    document.querySelectorAll('.r').forEach(x=>x.classList.toggle('act',x.dataset.k===sleutel(D.bak)));
  }
  function tekenDetail(){
    const {bak:b,inhoud,fotos,waar,waar_geweest:wg,tellingen,historiek}=D;
    const kv=(k,v)=>`<div class="kv"><span>${k}</span><b>${v}</b></div>`;
    const sub=[b.thema?b.thema.naam:null,'nu '+(b.waar_nu.rit_id?b.waar_nu_tekst:'bij '+b.waar_nu_tekst),'thuis: '+b.thuis_tekst].filter(Boolean).map(esc).join(' · ')
      +(b.status==='let'?` · <span class="pil oranje">${esc(b.stand_tekst)}</span>`:'');
    const blokInhoud=`<div class="blok"><h4>Inhoud (hoort erin)</h4>${b.soort==='attribuut'?'<div class="rij"><div class="nm">Eén stuk (attribuut)</div></div>':
      inhoud.map(i=>`<div class="rij"><div class="nm">${esc(i.naam)}<b>${esc(i.stand_tekst)}</b></div><span class="pil">× ${i.qty}</span><button class="knop licht klein" data-itemweg="${i.item_id}" aria-label="Stuk verwijderen">✕</button></div>`).join('')||'<div class="rij"><div class="nm">Nog leeg</div></div>'}${b.soort==='attribuut'?'':'<button class="knop licht klein" style="margin-top:6px" id="stuk-plus">+ Stuk</button>'}</div>`;
    const blokFotos=`<h4>Foto's</h4><div class="fotos">${fotos.map(f=>`<div class="f" style="${f.url?`background-image:url('${esc(f.url)}')`:''}">${esc(f.beschrijving||'foto')}</div>`).join('')}${b.soort==='attribuut'?'':'<label class="f plus">+ foto<input type="file" accept="image/*" id="foto-in" hidden></label>'}</div>`;
    const blokWaar=`<h4 style="margin-top:14px">Waar is de bak</h4>`+kv('Nu',esc(waar.nu_tekst+(waar.nu_op?` · ${wg[0]?.actie||''} ${waar.nu_op}${waar.nu_door?' door '+waar.nu_door:''}${waar.nu_rit_id?' (rit #'+waar.nu_rit_id+')':''}`:'')))
      +kv('Terug',esc(waar.terug_tekst||'— geen ophaling gepland'))+kv('Thuis',esc(waar.thuis_tekst));
    const histRij=h=>`<div class="rij"><div class="nm">${esc(h.wat)}<b>${esc([h.t,h.wie].filter(Boolean).join(' · '))}</b></div><button class="knop licht klein" disabled title="Terugdraaien bestaat nog niet als route (GEVONDEN TR1)">↶ Terug</button></div>`;
    const blokHist=`<div style="margin-top:14px"><h4>Historiek (alles gelogd, omkeerbaar)</h4>${historiek.slice(0,6).map(histRij).join('')||'<div class="rij"><div class="nm">Nog niets gelogd</div></div>'}</div>`;
    const tabs=[['inhoud',`Inhoud ${b.soort==='attribuut'?1:inhoud.length}`],['fotos',`Foto's ${fotos.length}`],['waar',`Waar geweest ${wg.length}`],['tellingen',`Tellingen ${tellingen.length}`],['historiek',`Historiek ${historiek.length}`]];
    let grid;
    if(TAB==='inhoud')grid=`<div class="dgrid een">${blokInhoud}<div class="blok">${blokFotos}${blokWaar}${blokHist}</div></div>`;
    else if(TAB==='fotos')grid=`<div class="dgrid een"><div class="blok">${blokFotos}</div><div></div></div>`;
    else if(TAB==='waar')grid=`<div class="dgrid een"><div class="blok"><h4>Waar geweest</h4>${wg.map(w=>`<div class="rij"><div class="nm">${esc(w.actie)} · ${esc(w.locatie)}<b>${esc([w.datum,w.chauffeur,w.rit_id?'rit #'+w.rit_id:''].filter(Boolean).join(' · '))}</b></div></div>`).join('')||'<div class="rij"><div class="nm">Nog geen ritten</div></div>'}</div><div class="blok">${blokWaar.replace(' style="margin-top:14px"','')}</div></div>`;
    else if(TAB==='tellingen')grid=`<div class="dgrid een"><div class="blok"><h4>Tellingen</h4>${tellingen.map(t=>`<div class="rij"><div class="nm">${esc(t.uitslag)}<b>${esc([t.datum,t.kv?kvL(t.kv):'',t.locatie+(t.week?' wk '+t.week:''),t.kantoor_status==='nagekeken'?'nagekeken':t.kv_status].filter(Boolean).join(' · '))}</b></div><a class="knop licht klein" style="display:inline-flex;align-items:center;text-decoration:none" href="/nakijken">Open</a></div>`).join('')||'<div class="rij"><div class="nm">Nog niet geteld</div></div>'}</div><div></div></div>`;
    else grid=`<div class="dgrid een"><div class="blok"><h4>Historiek (alles gelogd, omkeerbaar)</h4>${historiek.map(histRij).join('')||'<div class="rij"><div class="nm">Nog niets gelogd</div></div>'}</div><div></div></div>`;
    $('detail').innerHTML=`<div class="dkop"><div><h2>${esc([b.code,b.naam].filter(Boolean).join(' · '))}</h2><span>${sub}</span></div><div class="acts"><button class="knop licht" id="d-bewerk">Bewerken</button><button class="knop licht" id="d-etiket">🖨 Etiket</button><button class="knop licht" id="d-verplaats">Verplaatsen</button><button class="knop" id="d-inhoud" ${b.soort==='attribuut'?'disabled':''}>Inhoud aanpassen</button></div></div>
      <div class="dtabs">${tabs.map(([k,l])=>`<a class="${TAB===k?'act':''}" data-tab="${k}">${l}</a>`).join('')}</div>${grid}`;
    const fi=$('foto-in');if(fi)fi.onchange=()=>fotoUpload(fi.files[0]);
  }

  // ── formulieren ──
  const stockOpt=sel=>LOCS.filter(l=>l.type==='stockage').map(l=>`<option value="${l.id}" ${String(l.id)===String(sel)?'selected':''}>${esc(l.name)}</option>`).join('');
  const locOpt=()=>LOCS.map(l=>`<option value="${l.id}">${esc(l.name)}${l.type==='stockage'?' (stockage)':''}</option>`).join('');
  async function themaOpt(sel){if(!THEMAS){const t=await api('GET','/api/themas');THEMAS=t.ok?t.json:[];}return '<option value="">—</option>'+THEMAS.map(t=>`<option value="${t.id}" ${String(t.id)===String(sel)?'selected':''}>${esc(t.name)}</option>`).join('');}
  async function bakForm(titel,b,ok,nieuw){
    return vraag({titel,ok,html:`<label>Code<input name="code" value="${esc(b.code||'')}"></label><label>Naam<input name="naam" value="${esc(b.naam||'')}"></label>
      ${nieuw?'<label>Soort<select name="soort"><option value="thema">themabak</option><option value="vast">vaste bak</option><option value="attribuut">attribuut</option></select></label>':''}
      <label>Thema<select name="thema">${await themaOpt(b.thema&&b.thema.id)}</select></label>
      <label>Thuis<select name="thuis">${stockOpt(b.thuis_locatie_id||ROZ())}</select></label>
      <label>Rek<input name="rek" value="${esc(b.rek||'')}" maxlength="10"></label><label>Plank<input name="plank" value="${esc(b.plank||'')}" maxlength="10"></label>`,
      lees:f=>{if(!f.naam.value.trim()){toast('Geef de bak een naam','warn');return null;}
        return {code:f.code.value.trim(),naam:f.naam.value.trim(),soort:f.soort?f.soort.value:b.soort,thema:+f.thema.value||null,thuis:+f.thuis.value||null,rek:f.rek.value.trim(),plank:f.plank.value.trim()};}});
  }
  async function bewaarPlaats(soort,id,v){
    if(soort==='attribuut'){
      const r=await api('PUT',`/api/attributen/${id}`,{naam:v.naam,code:v.code,thuislocatie_id:v.thuis});
      if(v.rek||v.plank)toast('Rek en plank bestaan nog niet voor attributen (alleen voor bakken)','warn');return r;}
    return api('PUT',`/api/bakken/${id}`,{naam:v.naam,code:v.code,thuis_locatie_id:v.thuis,rek:v.rek,plank:v.plank});
  }
  async function koppelThema(soort,id,themaId){
    return soort==='attribuut'?api('POST',`/api/themas/${themaId}/attributen`,{attribuut_id:id}):api('POST',`/api/themas/${themaId}/bakken`,{bak_id:id});
  }
  async function verplaatsForm(aantal){
    return vraag({titel:aantal>1?`${aantal} bakken verplaatsen`:'Bak verplaatsen',tekst:'Kies een nieuwe plaats, of geef een rek/plank in de thuisstockage. Een handmatige verplaatsing wordt gelogd met de reden.',ok:'Verplaatsen',
      html:`<label>Naar locatie<select name="naar"><option value="">— niet verplaatsen —</option>${locOpt()}</select></label><label>Reden<input name="reden" placeholder="bv. teruggezet na controle"></label>
        <label>Rek<input name="rek" maxlength="10"></label><label>Plank<input name="plank" maxlength="10"></label>`,
      lees:f=>{if(!f.naar.value&&!f.rek.value&&!f.plank.value){toast('Kies een locatie of rek/plank','warn');return null;}
        if(f.naar.value&&!f.reden.value.trim()){toast('Geef een reden voor de verplaatsing','warn');return null;}
        return {naar:+f.naar.value||null,reden:f.reden.value.trim(),rek:f.rek.value.trim(),plank:f.plank.value.trim()};}});
  }
  async function verplaats(lijst,v){
    let n=0;
    for(const b of lijst){
      if(v.naar){const r=await api('POST',`${basis(b.soort)}${b.id}/verplaats`,{naar_locatie_id:v.naar,reden:v.reden});if(!r.ok){toast(`${b.code||b.naam}: ${r.json.error||'mislukt'}`,'error');continue;}}
      if((v.rek||v.plank)&&b.soort!=='attribuut'){const body={};if(v.rek)body.rek=v.rek;if(v.plank)body.plank=v.plank;
        const r=await api('PUT',`/api/bakken/${b.id}`,body);if(!r.ok){toast(`${b.code||b.naam}: ${r.json.error||'mislukt'}`,'error');continue;}}
      n++;
    }
    toast(`${n} verplaatst`,'success');
  }
  const etiketten=lijst=>window.open('/etiketten?ids='+lijst.map(b=>sleutel(b)).join(','),'_blank');
  async function fotoUpload(bestand){
    if(!bestand)return;
    const data=await new Promise((ok,nok)=>{const fr=new FileReader();fr.onload=()=>ok(fr.result);fr.onerror=nok;fr.readAsDataURL(bestand);});
    const r=await api('POST',`/api/bakken/${D.bak.id}/foto`,{foto_data:data,wie:$('wie').textContent.split(' · ')[0],beschrijving:bestand.name.replace(/\.[^.]+$/,'')});
    if(!r.ok)return toast(r.json.error||'Foto bewaren mislukt','error');toast('Foto bewaard','success');laad();
  }
  async function stukPlus(){
    let types=[];
    const v=await vraag({titel:`Stuk toevoegen aan ${D.bak.code||D.bak.naam}`,ok:'Toevoegen',
      html:'<label>Stuk (zoek in de catalogus)<input name="naam" list="it-lijst" autocomplete="off"><datalist id="it-lijst"></datalist></label><label>Aantal<input type="number" min="1" name="qty" value="1"></label>',
      lees:f=>{if(!f.naam.value.trim()){toast('Kies of typ een stuk','warn');return null;}return {naam:f.naam.value.trim(),qty:+f.qty.value||1};}});
    if(!v)return;
    const url=D.bak.soort==='thema'?`/api/bakken/${D.bak.id}/items`:`/api/vaste-bakken/${D.bak.id}/items`;
    const r=await api('POST',url,v);if(!r.ok)return toast(r.json.error||'Toevoegen mislukt','error');toast('Stuk toegevoegd','success');laad();
  }
  // Catalogus voor de zoeklijst van "+ Stuk": één keer laden, daarna filteren bij typen.
  let ITEMTYPES=null;
  document.addEventListener('input',async e=>{
    if(e.target.getAttribute('list')!=='it-lijst')return;
    if(!ITEMTYPES){const r=await api('GET','/api/item-types');ITEMTYPES=r.ok?r.json:[];}
    const q=e.target.value.toLowerCase();if(q.length<2)return;
    document.getElementById('it-lijst').innerHTML=ITEMTYPES.filter(t=>t.naam.toLowerCase().includes(q)).slice(0,30).map(t=>`<option value="${esc(t.naam)}">`).join('');
  });

  document.addEventListener('click',async e=>{
    const t=e.target;
    if(t.matches('[data-sel]')){const k=t.dataset.sel;t.checked?SEL.add(k):SEL.delete(k);return tekenLijst();}
    const chip=t.closest('.chip');if(chip){FILTER=chip.dataset.f;return tekenLijst();}
    const rij=t.closest('.r[data-k]');if(rij){const k=rij.dataset.k;return laadDetail(k[0]==='a'?'attribuut':'b',+k.slice(1));}
    const tab=t.closest('[data-tab]');if(tab){TAB=tab.dataset.tab;return tekenDetail();}
    if(!D)return;
    const b=D.bak;
    if(t.id==='d-etiket')return etiketten([b]);
    if(t.id==='d-inhoud'){TAB='inhoud';tekenDetail();return stukPlus();}
    if(t.id==='stuk-plus')return stukPlus();
    if(t.id==='d-verplaats'){const v=await verplaatsForm(1);if(!v)return;await verplaats([b],v);return laad();}
    if(t.id==='d-bewerk'){const v=await bakForm(`${b.code||b.naam} bewerken`,b,'Opslaan');if(!v)return;
      const r=await bewaarPlaats(b.soort,b.id,v);if(!r.ok)return toast(r.json.error||'Opslaan mislukt','error');
      if(v.thema&&(!b.thema||v.thema!==b.thema.id)){const k=await koppelThema(b.soort,b.id,v.thema);if(!k.ok)toast(k.json.error||'Thema koppelen mislukt','error');}
      toast('Opgeslagen','success');return laad();}
    const iw=t.closest('[data-itemweg]');
    if(iw){const it=D.inhoud.find(x=>x.item_id===+iw.dataset.itemweg);
      if(!await vraag({titel:'Stuk verwijderen?',tekst:`${it.naam} × ${it.qty} uit ${b.code||b.naam}`,ok:'Verwijderen'}))return;
      const r=await api('DELETE',b.soort==='thema'?`/api/bak-items/${it.item_id}`:`/api/vaste-bak-items/${it.item_id}`);
      if(!r.ok)return toast(r.json.error||'Verwijderen mislukt','error');toast('Stuk verwijderd','success');return laad();}
  });
  $('alles').onchange=e=>{zichtbaar().forEach(b=>e.target.checked?SEL.add(sleutel(b)):SEL.delete(sleutel(b)));tekenLijst();};
  $('zoek').oninput=e=>{ZOEK=e.target.value.trim().toLowerCase();tekenLijst();};
  const gekozen=()=>O.bakken.filter(b=>SEL.has(sleutel(b)));

  // ── bulk ──
  $('b-etiket').onclick=()=>etiketten(gekozen());
  $('b-verplaats').onclick=async()=>{const v=await verplaatsForm(SEL.size);if(!v)return;await verplaats(gekozen(),v);SEL.clear();laad();};
  $('b-thema').onclick=async()=>{
    const v=await vraag({titel:`${SEL.size} bakken aan een thema koppelen`,ok:'Koppelen',html:`<label>Thema<select name="thema">${await themaOpt(null)}</select></label>`,
      lees:f=>+f.thema.value?{thema:+f.thema.value}:(toast('Kies een thema','warn'),null)});
    if(!v)return;let n=0;
    for(const b of gekozen()){const r=await koppelThema(b.soort,b.id,v.thema);if(r.ok)n++;else toast(`${b.code||b.naam}: ${r.json.error||'mislukt'}`,'error');}
    toast(`${n} gekoppeld`,'success');SEL.clear();laad();
  };
  $('b-weg').onclick=async()=>{
    if(!await vraag({titel:`${SEL.size} bakken verwijderen?`,tekst:'Een bak die onderweg is of nog een open telling heeft, wordt niet verwijderd.',ok:'Verwijderen'}))return;
    let n=0;
    for(const b of gekozen()){const r=await api('DELETE',`/api/bakken-overzicht/${b.id}${b.soort==='attribuut'?'?soort=attribuut':''}`);if(r.ok)n++;else toast(r.json.error||'Verwijderen mislukt','error');}
    if(n)toast(`${n} verwijderd`,'success');if(D&&SEL.has(sleutel(D.bak)))D=null;SEL.clear();laad();
  };

  // ── subbalk ──
  $('export').onclick=async()=>{
    const r=await fetch('/api/export',{headers:{'x-auth-token':TOKEN}});
    if(!r.ok)return toast('Export mislukt','error');
    const a=document.createElement('a');a.href=URL.createObjectURL(await r.blob());a.download='sporty-export.json';a.click();URL.revokeObjectURL(a.href);
  };
  $('etiketten').onclick=()=>{const l=SEL.size?gekozen():zichtbaar();etiketten(l.slice(0,200));if(l.length>200)toast('Eerste 200 etiketten geopend; filter of selecteer voor de rest','warn');};
  $('nieuw').onclick=async()=>{
    const v=await bakForm('Nieuwe bak',{soort:'thema'},'Aanmaken',true);if(!v)return;
    let r;
    if(v.soort==='attribuut')r=await api('POST','/api/attributen',{naam:v.naam,code:v.code,thuislocatie_id:v.thuis});
    else if(v.soort==='vast')r=await api('POST','/api/vaste-bakken',{naam:v.naam,code:v.code,thuislocatie_id:v.thuis});
    else{if(!v.thema)return toast('Een themabak hoort bij een thema: kies er een','warn');r=await api('POST',`/api/themas/${v.thema}/bakken`,{label:v.naam,code:v.code});}
    if(!r.ok)return toast(r.json.error||'Aanmaken mislukt','error');
    const id=r.json.id;
    if(v.soort!=='attribuut'&&(v.rek||v.plank||v.thuis))await api('PUT',`/api/bakken/${id}`,{thuis_locatie_id:v.thuis,rek:v.rek,plank:v.plank});
    if(v.thema&&v.soort!=='thema')await koppelThema(v.soort,id,v.thema);
    toast(`${v.code||v.naam} aangemaakt`,'success');await laad();laadDetail(v.soort==='attribuut'?'attribuut':'b',id);
  };

  // ── bovenbalk ──
  async function kop(){
    const v=await api('GET','/api/vandaag');
    if(v.ok){const b=$('b-vandaag');b.textContent=v.json.beslissen.length;b.hidden=!v.json.beslissen.length;
      $('per-naam').textContent=v.json.periode?v.json.periode.naam:'geen periode';$('wie').textContent=v.json.gebruiker.naam+' · kantoor';}
    const p=await api('GET','/api/periodes');if(!p.ok)return;
    const sel=$('per-kies');sel.innerHTML=p.json.map(x=>`<option value="${x.id}"${x.actief?' selected':''}>${esc(x.naam)}</option>`).join('');
    sel.onchange=async()=>{const a=await api('POST','/api/periodes/'+sel.value+'/activeer');if(!a.ok)return toast(a.json.error||'Periode wisselen mislukt','error');location.reload();};
  }
  (async()=>{
    await laad();
    // ?id=N (bak) of ?id=a12 (attribuut) opent dat detail.
    const q=Q.get('id');if(q)laadDetail(/^a/.test(q)?'attribuut':'b',+q.replace(/^\D/,''));
    kop();
  })();
})();
