// public/meer.js — MOB1: tab Meer (design/MOBIEL-DEFINITIEF.html, telefoon "Kantoor · Meer").
// Alleen wat de rol mag: kantoor ziet alle onderdelen; chauffeur en kantoor hun eigen dingen. De 403's op de API blijven de echte grens.
'use strict';
(function(){
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const rij=(x)=>`<a class="rij" ${x.act?`data-act="${x.act}" role="button" tabindex="0"`:`href="${esc(x.url)}"`}>${x.ico?`<div class="ico">${x.ico}</div>`:''}<div class="nm">${esc(x.t)}${x.s?`<b>${esc(x.s)}</b>`:''}</div><span class="pijl">›</span></a>`;
  const ROLNAAM={kantoor:'kantoor',chauffeur:'chauffeur',monitor:'monitor'};
  const ONDERDELEN={
    kantoor:[{ico:'🚚',t:'Mijn ritten',s:'zelf een rit rijden',url:'/vandaag?tab=ritten'},{ico:'📦',t:'Aanvullen',s:'stockage: aanvullen en melden',url:'/aanvullen'},{ico:'📅',t:'Planning',s:'rooster, kampmomenten, periodes',url:'/kampmomenten'},{ico:'📦',t:'Materiaal',s:'thema’s, bakken, pool, catalogus',url:'/bakken'},{ico:'📍',t:'Locaties',s:'adressen, contacten, sleutels, foto’s',url:'/locaties'},{ico:'⚙️',t:'Beheer',s:'personeel, export, logboek',url:'/personeel'}]};
  const BOUW={
    html(g,per){
      const ond=ONDERDELEN[g.rol]||[];
      return `<div class="kopA"><div class="l">${esc(ROLNAAM[g.rol]||g.rol)} · ${esc(g.naam)}</div><b>Meer</b>${g.rol==='kantoor'?`<span>Periode: ${esc(per?per.naam:'—')} ▾</span>`:''}</div><div class="gbody">
        ${ond.length?`<div class="sec"><h3>Onderdelen</h3>${ond.map(rij).join('')}</div>`:''}
        ${g.rol==='kantoor'?`<div class="sec"><h3>Snel</h3><div class="twee"><a class="knop licht" href="/bakken">🔍 Waar staat…</a><a class="knop licht" href="/locaties">📞 Contacten</a></div></div><div class="sec"><h3>Periode</h3><select id="per-kies" aria-label="Periode kiezen" style="width:100%"></select></div>`:''}
        <div class="sec"><h3>Ik</h3>${rij({t:`${g.naam} · ${ROLNAAM[g.rol]||g.rol}`,s:'pincode wijzigen',act:'pin'})}${g.rol==='kantoor'?rij({t:'Weergave',s:'groot / compact (zoals op desktop)',act:'weergave'}):''}${rij({t:'Uitloggen',act:'uit'})}</div>
        ${g.rol==='kantoor'?'<div class="hint">Alles wat op de desktop kan, kan hier ook, maar één scherm per vraag. Voor de grote overzichten (weekagenda, tabellen) toont de gsm een lijst per dag of per item.</div>':''}</div>`;
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
  // TF3 G27: pincode wijzigen op het toetsenblok, tweemaal invoeren.
  function pinKiezen(){
    let code='',eerste='',fout='';
    const bg=document.createElement('div');bg.style.cssText='position:fixed;inset:0;z-index:1200;background:rgba(15,23,42,.6);display:flex;align-items:center;justify-content:center;padding:16px';
    const teken=()=>{bg.innerHTML=`<div role="dialog" aria-modal="true" style="background:#1e3a8a;color:#fff;border-radius:16px;padding:20px;width:100%;max-width:340px;font-family:system-ui"><div style="text-align:center;font-weight:700;margin-bottom:12px">${eerste?'Nog een keer, ter controle':'Kies een nieuwe pincode'}</div><div style="display:flex;justify-content:center;gap:14px;margin-bottom:10px">${[0,1,2,3].map(i=>`<i style="width:16px;height:16px;border-radius:50%;border:2px solid #fff;${i<code.length?'background:#fff':''}"></i>`).join('')}</div><div role="alert" style="min-height:36px;text-align:center;font-size:14px;font-weight:700;color:#fecaca">${esc(fout)}</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${[1,2,3,4,5,6,7,8,9,'x',0,'w'].map(c=>`<button data-p="${c}" style="height:56px;border:0;border-radius:12px;background:rgba(255,255,255,.14);color:#fff;font-size:${c==='x'?14:22}px;font-weight:700">${c==='x'?'Annuleer':c==='w'?'⌫':c}</button>`).join('')}</div></div>`;};
    bg.onclick=async e=>{
      const k=e.target.closest('[data-p]');if(!k)return;const c=k.dataset.p;
      if(c==='x')return bg.remove();
      if(c==='w'){code=code.slice(0,-1);return teken();}
      code+=c;fout='';
      if(code.length<4)return teken();
      if(!eerste){const d=[...code].map(Number),st=d.slice(1).map((x,i)=>x-d[i]);if(st.every(x=>x===0)||st.every(x=>x===1)||st.every(x=>x===-1)||code.slice(0,2)===code.slice(2)){code='';fout='Te makkelijk te raden (zoals 0000 of 1234). Kies een andere.';return teken();}eerste=code;code='';return teken();}
      if(code!==eerste){eerste='';code='';fout='De twee pincodes zijn niet gelijk. Begin opnieuw.';return teken();}
      const r=await api('POST',`/api/personeel/${G.id}/pincode`,{pincode:code});
      if(!r.ok){eerste='';code='';fout=r.json.error||'Wijzigen mislukt';return teken();}
      bg.remove();toast('Pincode gewijzigd');
    };
    teken();document.body.appendChild(bg);
  }
  document.addEventListener('click',async e=>{
    const a=(e.target.closest('[data-act]')||{dataset:{}}).dataset.act;
    if(a==='uit'){await api('POST','/api/logout');localStorage.removeItem('sporty-auth-token');localStorage.removeItem('sporty-rol');location.replace('/login');}
    if(a==='pin')pinKiezen();
    if(a==='weergave'){const v=await api('GET','/api/mij/voorkeuren');const nw=v.ok&&v.json.vandaag_weergave==='compact'?'groot':'compact';const r=await api('PUT','/api/mij/voorkeuren',{vandaag_weergave:nw});r.ok?toast('Weergave: '+nw):toast('Bewaren mislukt',true);}
  });
})();
