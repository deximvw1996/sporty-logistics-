// public/meer.js — MOB1: tab Meer (design/MOBIEL-DEFINITIEF.html, telefoon "Kantoor · Meer").
// Alleen wat de rol mag: kantoor ziet alle onderdelen; chauffeur en coördinator hun eigen dingen. De 403's op de API blijven de echte grens.
'use strict';
(function(){
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const rij=(x)=>`<a class="rij" ${x.act?`data-act="${x.act}" role="button" tabindex="0"`:`href="${esc(x.url)}"`}>${x.ico?`<div class="ico">${x.ico}</div>`:''}<div class="nm">${esc(x.t)}${x.s?`<b>${esc(x.s)}</b>`:''}</div><span class="pijl">›</span></a>`;
  const ROLNAAM={kantoor:'kantoor',chauffeur:'chauffeur',coordinator:'coördinator',monitor:'monitor'};
  const ONDERDELEN={
    kantoor:[{ico:'📅',t:'Planning',s:'rooster, kampmomenten, periodes',url:'/kampmomenten'},{ico:'📦',t:'Materiaal',s:'thema’s, bakken, pool, catalogus',url:'/bakken'},{ico:'📍',t:'Locaties',s:'adressen, contacten, sleutels, foto’s',url:'/locaties'},{ico:'⚙️',t:'Beheer',s:'personeel, export, logboek',url:'/personeel'}],
    coordinator:[{ico:'🧮',t:'Tekorten & bestellingen',s:'bestellen en binnen melden',url:'/tekorten'}]};
  const BOUW={
    html(g,per){
      const ond=ONDERDELEN[g.rol]||[];
      return `<div class="kopA"><div class="l">${esc(ROLNAAM[g.rol]||g.rol)} · ${esc(g.naam)}</div><b>Meer</b>${g.rol==='kantoor'?`<span>Periode: ${esc(per?per.naam:'—')} ▾</span>`:''}</div><div class="gbody">
        ${ond.length?`<div class="sec"><h3>Onderdelen</h3>${ond.map(rij).join('')}</div>`:''}
        ${g.rol==='kantoor'?`<div class="sec"><h3>Snel</h3><div class="twee"><a class="knop licht" href="/bakken">🔍 Waar staat…</a><a class="knop licht" href="/locaties">📞 Contacten</a></div></div><div class="sec"><h3>Periode</h3><select id="per-kies" aria-label="Periode kiezen" style="width:100%"></select></div>`:''}
        <div class="sec"><h3>Ik</h3>${rij({t:`${g.naam} · ${ROLNAAM[g.rol]||g.rol}`,s:'pincode wijzigen',act:'pin'})}${g.rol==='kantoor'?rij({t:'Weergave',s:'groot / compact (zoals op desktop)',act:'weergave'}):''}${rij({t:'Uitloggen',act:'uit'})}</div>
        <div class="hint">Alles wat op de desktop kan, kan hier ook, maar één scherm per vraag. Voor de grote overzichten (weekagenda, tabellen) toont de gsm een lijst per dag of per item.</div></div>`;
    }
  };
  if(typeof module!=='undefined'&&module.exports){module.exports=BOUW;return;}
  const TOKEN=localStorage.getItem('sporty-auth-token');if(!TOKEN){location.replace('/login?terug=/meer');return;}
  const $=id=>document.getElementById(id);
  const api=(m,u,b)=>window.sportyApi(m,u,b,{token:TOKEN});
  function toast(msg,fout){const t=document.createElement('div');t.style.background=fout?'#E24B4A':'#1D9E75';t.textContent=msg;$('toasts').appendChild(t);setTimeout(()=>t.remove(),3500);}
  let G=null;
  (async()=>{
    const w=await api('GET','/api/wie-ben-ik');if(!w.ok){location.replace('/login?terug=/meer');return;}
    G=w.json;try{localStorage.setItem('sporty-rol',G.rol);}catch(e){}
    const p=G.rol==='kantoor'?await api('GET','/api/periodes'):null,lijst=p&&p.ok?p.json:[];
    $('meer').innerHTML=BOUW.html(G,lijst.find(x=>x.actief));
    const sel=$('per-kies');
    if(sel){sel.innerHTML=lijst.map(x=>`<option value="${x.id}"${x.actief?' selected':''}>${esc(x.naam)}</option>`).join('');
      sel.onchange=async()=>{const a=await api('POST','/api/periodes/'+sel.value+'/activeer');if(!a.ok)return toast(a.json.error||'Periode wisselen mislukt',true);location.reload();};}
  })();
  document.addEventListener('click',async e=>{
    const a=(e.target.closest('[data-act]')||{dataset:{}}).dataset.act;
    if(a==='uit'){await api('POST','/api/logout');localStorage.removeItem('sporty-auth-token');localStorage.removeItem('sporty-rol');location.replace('/login');}
    if(a==='pin'){const n=prompt('Nieuwe pincode (4 cijfers)');if(!n)return;if(!/^\d{4}$/.test(n))return toast('Een pincode is 4 cijfers',true);const r=await api('POST',`/api/personeel/${G.id}/pincode`,{pincode:n});r.ok?toast('Pincode gewijzigd'):toast(r.json.error||'Wijzigen mislukt',true);}
    if(a==='weergave'){const v=await api('GET','/api/mij/voorkeuren');const nw=v.ok&&v.json.vandaag_weergave==='compact'?'groot':'compact';const r=await api('PUT','/api/mij/voorkeuren',{vandaag_weergave:nw});r.ok?toast('Weergave: '+nw):toast('Bewaren mislukt',true);}
  });
})();
