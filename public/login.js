// public/login.js — MOB1 punt 2: /login (design/mockup-gsm-1.html). Naam uit /api/personeel-lijst-login, pincode op een eigen toetsenblok.
// Token in localStorage 'sporty-auth-token' (zelfde sleutel als de rest van de app): de sessie blijft op dit toestel tot uitloggen.
'use strict';
(function(){
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const ROL={kantoor:'kantoor',chauffeur:'chauffeur',coordinator:'coördinator',monitor:'monitor'};
  const KOP='<div class="logo">Sporty logistiek</div><div class="vraag">Wie ben je?</div>';
  const VOET='<div class="voettekst">Je blijft ingelogd op deze gsm · Pincode vergeten? Vraag het kantoor</div>';
  const BOUW={
    // Laatste gebruiker op dit toestel bovenaan.
    sorteer(l,laatste){return [...l].sort((a,b)=>(b.id===laatste)-(a.id===laatste)||a.naam.localeCompare(b.naam,'nl'));},
    keuze(l,zoek){const q=(zoek||'').toLowerCase();const r=l.filter(p=>!q||p.naam.toLowerCase().includes(q));
      return r.map(p=>`<button class="wie" data-id="${p.id}"><b>${esc(p.naam)}</b><span>${esc(ROL[p.rol]||p.rol)}</span></button>`).join('')||'<div class="vraag">Niemand gevonden</div>';},
    pin(p,n,fout,kiezen){return `${KOP}<button class="wie" data-terug="1" aria-label="Iemand anders kiezen"><b>${esc(p.naam)}</b><span>${esc(ROL[p.rol]||p.rol)}</span></button><div class="pinvraag">${typeof kiezen==='string'?esc(kiezen):kiezen?'Kies een pincode':'Geef je pincode'}</div><div class="dots${fout?' schud':''}">${[0,1,2,3].map(i=>`<i${i<n?' class="v"':''}></i>`).join('')}</div><div class="fout" role="alert">${esc(fout||'')}</div><div class="pad">${[1,2,3,4,5,6,7,8,9].map(c=>`<button data-c="${c}">${c}</button>`).join('')}<span></span><button data-c="0">0</button><button data-w="1" aria-label="Wissen">⌫</button></div>${VOET}`;},
    // TF3: dezelfde regel als de server (lib/auth.js zwakkePin), zodat je het meteen weet.
    zwak(c){const d=[...String(c)].map(Number),st=d.slice(1).map((x,i)=>x-d[i]);return st.every(x=>x===0)||st.every(x=>x===1)||st.every(x=>x===-1)||(c.length===4&&c.slice(0,2)===c.slice(2));},
    // Alleen een pad binnen deze site als terug-adres.
    terug(q){const t=new URLSearchParams(q||'').get('terug')||'';return /^\/(?![\/\\])/.test(t)&&!/^\/login\b/.test(t)?t:'/vandaag';}
  };
  if(typeof module!=='undefined'&&module.exports){module.exports=BOUW;return;}
  const $s=document.getElementById('scherm');
  const TERUG=BOUW.terug(location.search);
  let L=[],P=null,PIN='',EERSTE='';
  const oud=localStorage.getItem('sporty-auth-token');
  if(oud)fetch('/api/wie-ben-ik',{headers:{'x-auth-token':oud}}).then(r=>{if(r.ok)location.replace(TERUG);}).catch(()=>{});
  function lijst(){$s.innerHTML=`${KOP}<input class="zoek" id="zoek" placeholder="🔍 Zoek je naam…" aria-label="Zoek je naam"><div class="lijst" id="l">${BOUW.keuze(L,'')}</div>${VOET}`;document.getElementById('zoek').oninput=e=>{document.getElementById('l').innerHTML=BOUW.keuze(L,e.target.value);};}
  const pin=fout=>{$s.innerHTML=BOUW.pin(P,PIN.length,fout,P.heeft_pincode?false:EERSTE?'Nog een keer, ter controle':'Kies een pincode');};
  // TF3 G27: een eerste pincode tweemaal invoeren; true = klaar om te versturen.
  function tweemaal(){
    if(P.heeft_pincode)return true;
    if(!EERSTE){const c=PIN;PIN='';if(BOUW.zwak(c)){pin('Te makkelijk te raden (zoals 0000 of 1234). Kies een andere.');return false;}EERSTE=c;pin();return false;}
    if(PIN!==EERSTE){EERSTE='';PIN='';pin('De twee pincodes zijn niet gelijk. Begin opnieuw.');return false;}
    return true;
  }
  async function post(u,b){const r=await fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});let j={};try{j=await r.json();}catch(e){}return {ok:r.ok,status:r.status,json:j};}
  async function verstuur(){
    const code=PIN;$s.querySelectorAll('.pad button').forEach(b=>{b.disabled=true;});
    try{
      if(!P.heeft_pincode){const e=await post('/api/eerste-pincode',{persoon_id:P.id,pincode:code});if(!e.ok){PIN='';EERSTE='';return pin(e.json.error||'Pincode kiezen mislukt');}P.heeft_pincode=1;}
      const r=await post('/api/login',{persoon_id:P.id,pincode:code});
      if(!r.ok){PIN='';return pin(r.status===429?`Te veel pogingen. Probeer over ${Math.ceil((r.json.wacht_seconden||60)/60)} min opnieuw.`:r.json.error||'Inloggen mislukt');}
      localStorage.setItem('sporty-auth-token',r.json.token);localStorage.setItem('sporty-rol',r.json.rol);localStorage.setItem('sporty-laatste-gebruiker',String(r.json.id));
      location.replace(TERUG);
    }catch(e){PIN='';pin('Geen verbinding. Probeer opnieuw.');}
  }
  document.addEventListener('click',e=>{
    const k=e.target.closest('button');if(!k)return;
    if(k.dataset.id){P=L.find(x=>x.id===+k.dataset.id);PIN='';EERSTE='';return pin();}
    if(k.dataset.terug){P=null;return lijst();}
    if(k.dataset.w){PIN=PIN.slice(0,-1);return pin();}
    if(k.dataset.c!=null&&PIN.length<4){PIN+=k.dataset.c;pin();if(PIN.length===4&&tweemaal())verstuur();}
  });
  (async()=>{
    try{const r=await fetch('/api/personeel-lijst-login');L=BOUW.sorteer(await r.json(),+localStorage.getItem('sporty-laatste-gebruiker')||0);}catch(e){L=[];}
    lijst();
  })();
})();
