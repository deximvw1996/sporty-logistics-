// public/meldingen.js — ME1: lijst per dag, ongelezen vet met blauw randje, tik = gelezen en naar de link. Kantoor: + Bericht.
'use strict';
(function(){
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const MND=['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
  const dagVan=(iso,nu)=>{const d=new Date(iso),n=nu||new Date();const k=x=>new Date(x.getFullYear(),x.getMonth(),x.getDate()).getTime();const v=Math.round((k(n)-k(d))/864e5);return v===0?'Vandaag':v===1?'Gisteren':`${d.getDate()} ${MND[d.getMonth()]}`;};
  const uur=iso=>{const d=new Date(iso);return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;};
  const BOUW={
    dagVan,
    html(D,kantoor,nu){
      const groep=[];D.meldingen.forEach(m=>{const k=dagVan(m.created_at,nu);let g=groep.find(x=>x.k===k);if(!g)groep.push(g={k,l:[]});g.l.push(m);});
      const acts=`<div class="acts">${D.ongelezen?'<button class="knop licht" data-act="alles">Alles gelezen</button>':''}${kantoor?'<button class="knop" data-act="bericht">+ Bericht</button>':''}</div>`;
      return `<div class="kopA"><b>Meldingen</b><span>${D.ongelezen?D.ongelezen+' ongelezen':'alles gelezen'}</span>${acts}</div><div class="gbody">${groep.map(g=>`<div class="sec"><h3>${esc(g.k)}</h3>${g.l.map(m=>`<button class="melding ${m.gelezen?'':'nieuw'}" data-id="${m.id}"><span class="nm">${esc(m.titel)}<b>${esc(uur(m.created_at))}</b></span>${m.link?'<span class="pijl">›</span>':''}</button>`).join('')}</div>`).join('')||'<div class="hint">Geen meldingen</div>'}</div>`;
    }
  };
  if(typeof module!=='undefined'&&module.exports){module.exports=BOUW;return;}
  const TOKEN=localStorage.getItem('sporty-auth-token');if(!TOKEN){location.href='/';return;}
  const $=id=>document.getElementById(id);
  const api=(m,u,b)=>window.sportyApi(m,u,b,{token:TOKEN});
  function toast(msg,type){const t=document.createElement('div');t.style.background={error:'#E24B4A',success:'#1D9E75'}[type]||'#378ADD';t.textContent=msg;$('toasts').appendChild(t);setTimeout(()=>t.remove(),3500);}
  let D=null,G=null;
  window.addEventListener('sporty-live',()=>laad()); // RT1
  async function laad(){const r=await api('GET','/api/meldingen');if(!r.ok)return toast(r.json.error||'Laden mislukt','error');D=r.json;$('m').innerHTML=BOUW.html(D,G&&G.rol==='kantoor');}
  async function bericht(){
    const o=await api('GET','/api/meldingen/ontvangers');if(!o.ok)return toast(o.json.error||'Laden mislukt','error');
    const bg=document.createElement('div');bg.className='mbg';
    bg.innerHTML=`<div class="mbox" role="dialog" aria-modal="true"><h4>Bericht sturen</h4><div class="mform"><label>Aan<select id="b-aan">${o.json.rollen.map(r=>`<option value="r:${r}">alle ${esc(r)}</option>`).join('')}${o.json.personen.map(p=>`<option value="p:${p.id}">${esc(p.naam)} (${esc(p.rol)})</option>`).join('')}</select></label><label>Tekst<textarea id="b-t" rows="3"></textarea></label><div class="knoppen"><button class="knop licht" data-x="0">Annuleren</button><button class="knop" data-x="1">Versturen</button></div></div></div>`;
    document.body.appendChild(bg);bg.querySelector('[data-x="0"]').onclick=()=>bg.remove();
    bg.querySelector('[data-x="1"]').onclick=async()=>{const a=bg.querySelector('#b-aan').value,t=bg.querySelector('#b-t').value.trim();if(!t)return toast('Schrijf een tekst');
      const r=await api('POST','/api/meldingen',a[0]==='p'?{voor_persoon_id:+a.slice(2),tekst:t}:{voor_rol:a.slice(2),tekst:t});if(!r.ok)return toast(r.json.error||'Versturen mislukt','error');bg.remove();toast('Bericht verstuurd','success');laad();};
  }
  document.addEventListener('click',async e=>{
    if(e.target.closest('.mbox'))return;
    const a=(e.target.closest('[data-act]')||{dataset:{}}).dataset.act;
    if(a==='bericht')return bericht();
    if(a==='alles'){await api('POST','/api/meldingen/alles-gelezen');return location.reload();}
    const b=e.target.closest('.melding');if(!b)return;
    const m=D.meldingen.find(x=>x.id===+b.dataset.id);
    if(!m.gelezen)await api('POST',`/api/meldingen/${m.id}/gelezen`);
    if(m.link)location.href=m.link;else location.reload();
  });
  (async()=>{const w=await api('GET','/api/wie-ben-ik');if(w.ok){G=w.json;$('wie').textContent=G.naam+' · '+G.rol;}laad();})();
})();
