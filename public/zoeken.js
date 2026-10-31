// public/zoeken.js — TF5 punt 6: de coördinator zoekt op (bak, artikel, locatie). Alleen lezen, via de smalle routes /api/opzoeken/*. Pure HTML-bouwers zijn exporteerbaar.
'use strict';
(function(){
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const TABS=[['bakken','Waar staat een bak'],['artikelen','Artikelen'],['locaties','Locaties en contacten']];
  const TEL=n=>'tel:'+esc(String(n).replace(/[^\d+]/g,''));
  const BOUW={
    bakken:l=>l.bakken.map(b=>`<div class="kaart"><h2>${esc(b.code)}${b.code?' · ':''}${esc(b.naam)}</h2><p>${esc([b.locatie||'locatie onbekend',b.plaats].filter(Boolean).join(' · '))}</p><p>${b.rit?`Eerstvolgende rit: #${esc(b.rit.id)} op ${esc(b.rit.datum)}${b.rit.vertrek?' om '+esc(b.rit.vertrek):''}`:'Geen rit gepland'}</p></div>`).join(''),
    artikelen:l=>l.artikelen.filter(a=>!/^INFO:/i.test(a.naam)).map(a=>`<div class="kaart"><h2>${esc(a.naam)}</h2><p>${a.voorraad.length?a.voorraad.map(v=>esc(v.stockage)+': '+esc(v.qty)).join(' · '):'Geen voorraad geregistreerd'}</p>${a.plaats?`<p>Ligt op: ${esc(a.plaats)}</p>`:''}${a.bakken.length?`<p>In bak: ${a.bakken.map(b=>esc(b.code||b.naam)).join(', ')}</p>`:''}</div>`).join(''),
    locaties:l=>l.locaties.map(x=>`<div class="kaart"><h2>${esc(x.naam)}</h2><p>${esc(x.adres||'Geen adres ingevuld')}</p>${x.contact_naam?`<p>Contact: ${esc(x.contact_naam)}</p>`:''}${x.sleutel_info?`<p>🔑 ${esc(x.sleutel_info)}</p>`:''}${x.contact_telefoon?`<a class="k" href="${TEL(x.contact_telefoon)}">📞 ${esc(x.contact_telefoon)}</a>`:''}${x.kaart?`<a class="k" href="${esc(x.kaart)}" target="_blank" rel="noopener">🗺 Kaart</a>`:''}</div>`).join('')
  };
  if(typeof module!=='undefined'&&module.exports){module.exports=BOUW;return;}
  const q0=new URLSearchParams(location.search),tab=TABS.some(t=>t[0]===q0.get('tab'))?q0.get('tab'):'bakken',id0=q0.get('id')||'';
  const $=document.getElementById('zoeken');
  $.innerHTML=`<a class="terug" href="/meer" style="display:inline-flex;align-items:center;min-height:44px;font-weight:700;color:#1e3a8a;text-decoration:none">‹ Meer</a><h1>Opzoeken</h1><div class="tabs">${TABS.map(t=>`<a class="${t[0]===tab?'act':''}" href="/zoeken?tab=${t[0]}">${t[1]}</a>`).join('')}</div><input id="q" type="search" placeholder="Typ om te zoeken…" aria-label="Zoeken" autocomplete="off"><div id="uit"><div class="leeg">Typ een code of een naam.</div></div>`;
  const inp=document.getElementById('q'),uit=document.getElementById('uit');let tm=null,nr=0;
  async function zoek(par){
    const mijn=++nr;let r;
    try{r=await window.sportyApi('GET','/api/opzoeken/'+tab+'?'+par);}catch(e){uit.innerHTML='<div class="leeg">Geen verbinding, probeer het zo opnieuw.</div>';return;}
    if(mijn!==nr)return;
    if(!r.ok){uit.innerHTML='<div class="leeg">'+esc(r.json.error||'Zoeken mislukt')+'</div>';return;}
    uit.innerHTML=BOUW[tab](r.json)||'<div class="leeg">Niets gevonden.</div>';
  }
  inp.addEventListener('input',()=>{clearTimeout(tm);const v=inp.value.trim();if(!v){uit.innerHTML='<div class="leeg">Typ een code of een naam.</div>';return;}tm=setTimeout(()=>zoek('q='+encodeURIComponent(v)),200);});
  if(id0&&tab==='artikelen')zoek('id='+encodeURIComponent(id0));
})();
