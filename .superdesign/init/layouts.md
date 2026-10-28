# Layouts

> De app is geen component-framework. Er zijn drie layouts:
> 1. **App-shell** van `index.html` (kantoor-app: loginscherm + topbalk + hoofdnavigatie + `.content` met `.sec`-secties) — bestand `D:\Sporty\sporty-railway\index.html`.
> 2. **Rit-pagina** (chauffeur, mobiel) — server-gerenderde template-string in `D:\Sporty\sporty-railway\routes\transport.js` (`app.get('/rit/:token'`, regels 1101-1206).
> 3. **KV-pagina** (kampverantwoordelijke, mobiel) — server-gerenderde template-string in `D:\Sporty\sporty-railway\routes\kv.js` (`app.get('/kv/:token'`, regels 143-496).
>
> Alle fragmenten hieronder zijn letterlijk gekopieerd; regelnummers verwijzen naar de bronbestanden zoals ze nu zijn.

---

# 1. App-shell (index.html)

## 1.1 Document-head (index.html:1-13)

**`index.html:1-13`**

```html
<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="theme-color" content="#2563eb">
<link rel="manifest" href="/manifest.json">
<title>Sporty vzw &mdash; Logistiek</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<!-- QR codes worden gegenereerd via api.qrserver.com (geen JS-bibliotheek nodig) -->
<style>
*{box-sizing:border-box;margin:0;padding:0}
```

## 1.2 Structuur in één oogopslag

```
<body>
  #login-overlay            (fixed, z-index 5000, standaard display:none)  regels 383-410
  .app                      (max-width 960px, gecentreerd)                regels 412-1242
    .topbar                 gebruiker-pil · logo · titel + periode · globale zoek · 🌙 · 🕐 · tijdmachine · aanvragen-badge   413-436
    .nav                    7 × button.nb  (Overzicht, Kampplanner, Transport, Materiaal, Locaties, Kaart, Personeel)       438-446
    .content                                                                 448-1241
      .sec#sec-overzicht (active) · #sec-planning · #sec-kampplanner · #sec-kaart · #sec-personeel · #sec-materiaal
      · #sec-transport-noden · #sec-transport-plan · #sec-transporten
  (modals .modal-bg buiten .app, op body-niveau)                             1246-1500 en 8885-9112
  .sec#sec-seizoensoverzicht  (regel 9114: staat op body-niveau, BUITEN .app/.content, tussen de latere modals en het tweede <script>; wordt wel door SECS/goTo meegenomen)
<script> 1502-8883 · tweede <script> 9123-9782
```

## 1.3 Loginscherm (volledige HTML, index.html:383-410)

**`index.html:383-410`**

```html
<div id="login-overlay" style="display:none;position:fixed;inset:0;background:var(--bg);z-index:5000;align-items:center;justify-content:center;flex-direction:column">
  <div style="width:min(360px,92vw);text-align:center">
    <div style="font-size:40px;margin-bottom:6px">&#9978;</div>
    <div style="font-weight:700;font-size:18px;margin-bottom:2px">Sporty vzw — Logistiek</div>
    <div id="login-sub" style="font-size:12px;color:var(--text2);margin-bottom:1.25rem">Log in om verder te gaan</div>

    <div id="login-normal">
      <select class="inp" id="login-persoon" style="width:100%;height:38px;margin-bottom:.5rem">
        <option value="">— Kies je naam —</option>
      </select>
      <input class="inp" id="login-pincode" type="password" inputmode="numeric" placeholder="Pincode" style="width:100%;height:38px;margin-bottom:.75rem" onkeydown="if(event.key==='Enter')doLogin()">
      <button class="btn-b" style="width:100%;height:38px" onclick="doLogin()">Inloggen</button>
      <div id="login-error" style="color:var(--red);font-size:12px;margin-top:.5rem"></div>
    </div>

    <div id="login-setup" style="display:none">
      <div style="font-size:12px;color:var(--amber-dk);background:var(--amber-bg);border:.5px solid var(--amber);border-radius:var(--r);padding:8px 10px;margin-bottom:.75rem;text-align:left">
        &#9888;&#65039; Er is nog geen enkele pincode ingesteld. Kies hieronder wie het eerste kantoor-account wordt.
      </div>
      <select class="inp" id="setup-persoon" style="width:100%;height:38px;margin-bottom:.5rem">
        <option value="">— Kies je naam —</option>
      </select>
      <input class="inp" id="setup-pincode" type="password" inputmode="numeric" placeholder="Nieuwe pincode (min. 4 tekens)" style="width:100%;height:38px;margin-bottom:.75rem" onkeydown="if(event.key==='Enter')doSetup()">
      <button class="btn-g" style="width:100%;height:38px" onclick="doSetup()">Eerste pincode instellen</button>
      <div id="setup-error" style="color:var(--red);font-size:12px;margin-top:.5rem"></div>
    </div>
  </div>
</div>
```

## 1.4 Topbalk + hoofdnavigatie + begin van .content (volledige HTML, index.html:412-452)

**`index.html:412-452`**

```html
<div class="app">
  <div class="topbar">
    <span id="topbar-user" style="display:none;align-items:center;gap:6px;font-size:12px;color:var(--text2);background:var(--bg2);border:.5px solid var(--border2);border-radius:999px;padding:3px 10px;margin-right:4px">
      &#128100; <span id="topbar-user-naam"></span>
      <button onclick="doLogout()" title="Uitloggen" style="background:transparent;border:none;cursor:pointer;color:var(--text3);font-size:11px;padding:0 0 0 4px">&#10132; Uit</button>
    </span>
    <div class="logo">&#9978;</div>
    <div>
      <div class="topbar-title" style="font-size:15px;font-weight:600;">Sporty vzw &mdash; Logistiek</div>
      <div style="font-size:11px;color:var(--text2)" id="topbar-periode"></div>
    </div>
    <div id="global-search-wrap" style="flex:1;max-width:300px;position:relative;margin:0 8px">
      <input type="text" id="global-search" class="inp" placeholder="🔍 Zoeken..." style="width:100%;padding-left:8px" oninput="globalSearch(this.value)" onkeydown="if(event.key==='Escape'){this.value='';globalSearch('')}" autocomplete="off">
      <div id="global-search-results" style="display:none;position:absolute;top:36px;left:0;right:0;background:var(--bg);border:.5px solid var(--border2);border-radius:var(--rl);box-shadow:0 4px 16px rgba(0,0,0,.12);z-index:200;max-height:320px;overflow-y:auto"></div>
    </div>
    <button id="dark-toggle" onclick="toggleDarkMode()" title="Donkere modus" style="background:transparent;border:.5px solid var(--border2);border-radius:var(--r);padding:4px 8px;cursor:pointer;font-size:14px;color:var(--text2)">🌙</button>
    <button id="time-toggle" onclick="toggleTimeMachine()" title="Datum simuleren" style="background:transparent;border:.5px solid var(--border2);border-radius:var(--r);padding:4px 8px;cursor:pointer;font-size:14px;color:var(--text2)">🕐</button>
    <div id="time-machine" style="display:none;align-items:center;gap:6px;background:var(--amber-bg);border:.5px solid var(--amber);border-radius:var(--r);padding:4px 8px;">
      <span style="font-size:11px;color:var(--amber-dk);font-weight:600">Simuleer datum:</span>
      <input type="date" id="sim-date-input" onchange="setSimDate(this.value)" style="font-size:11px;border:.5px solid var(--amber);border-radius:4px;padding:2px 4px;background:var(--bg);color:var(--text)">
      <button onclick="setSimDate('')" style="font-size:11px;background:transparent;border:.5px solid var(--amber);border-radius:4px;padding:2px 6px;cursor:pointer;color:var(--amber-dk)">Reset</button>
    </div>
    <span id="sim-indicator" style="display:none;align-items:center;gap:4px;background:var(--amber-bg);border:.5px solid var(--amber);border-radius:999px;padding:2px 8px;font-size:11px;font-weight:600;color:var(--amber-dk);cursor:pointer" onclick="toggleTimeMachine()" title="Klik om datum te wijzigen">🕐 <span id="sim-date-label"></span></span>
    <span class="badge-spoed" id="badge-spoed" style="display:none;background:var(--red);color:#fff;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:700;cursor:pointer" onclick="goTo('transport-noden')">&#128231; <span id="badge-spoed-n">0</span> aanvragen</span>
  </div>

  <div class="nav">
    <button class="nb active" onclick="goTo('overzicht')">&#128202; Overzicht</button>
    <button class="nb" onclick="goTo('kampplanner')">&#127956; Kampplanner</button>
    <button class="nb" onclick="goTo('transport-plan')">&#128666; Transport</button>
    <button class="nb" onclick="goTo('materiaal')">&#128230; Materiaal<span id="materiaal-badge" style="display:none;margin-left:4px;background:var(--red);color:#fff;font-size:10px;font-weight:700;border-radius:999px;padding:1px 6px"></span></button>
    <button class="nb" onclick="goTo('planning')">&#128205; Locaties</button>
    <button class="nb" onclick="goTo('kaart')">&#128506;&#65039; Kaart</button>
    <button class="nb" onclick="goTo('personeel')">&#128101; Personeel</button>
  </div>

  <div class="content">

  <!-- ═══════════════════════════════════════════════════════
       TAB 1: OVERZICHT
  ═══════════════════════════════════════════════════════ -->
```

## 1.5 Sluiting van de shell (index.html:1241-1242)

**`index.html:1241-1242`**

```html
  </div><!-- /content -->
</div><!-- /app -->
```

## 1.6 Sectie-skeletten (hoe een sectie intern is opgebouwd)

Twee patronen: (a) secties met subtab-balk (`.kal-subtab` in een flex-rij met onderlijn) en verborgen/zichtbare sub-containers, (b) enkelvoudige secties.

**Voorbeeld a — Locaties (lijst/detail, twee kolommen):**

**`index.html:534-552`**

```html
  <div class="sec" id="sec-planning">
    <div style="display:flex;gap:4px;margin-bottom:1rem;border-bottom:.5px solid var(--border);padding-bottom:.5rem">
      <button class="kal-subtab active" id="plan-sub-locaties" onclick="setPlanSubtab('locaties',this)">&#128205; Locaties &amp; Kampen</button>
    </div>
    <div id="plan-sub-locaties-content">
      <div class="loc-split" style="display:flex;gap:1rem;align-items:flex-start;flex-wrap:wrap">
        <div class="loc-col-list" style="flex:1 1 220px;max-width:300px;min-width:190px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem">
            <strong style="font-size:13px">&#128205; Locaties</strong>
            <button class="btn-xs" onclick="openNieuweLocatie()">+ Nieuw</button>
          </div>
          <div id="loc-tab-list"><div class="loading">Laden&hellip;</div></div>
        </div>
        <div class="loc-col-detail" style="flex:3 1 420px;min-width:280px">
          <div id="loc-tab-detail"><div class="empty">Selecteer een locatie links.</div></div>
        </div>
      </div>
    </div>
  </div>
```

**Voorbeeld b — Materiaal (subtab-balk, rest staat in `#mat-sub-*`-containers die `setMatSubtab()` toont/verbergt):**

**`index.html:703-716`**

```html
  <div class="sec" id="sec-materiaal">
    <div style="display:flex;gap:4px;margin-bottom:1rem;border-bottom:.5px solid var(--border);padding-bottom:.5rem;flex-wrap:wrap;align-items:center">
      <!-- Tijdelijk verborgen (opkuis thema's/materiaal, wordt stuk per stuk teruggezet) -->
      <button class="kal-subtab" style="display:none" onclick="setMatSubtab('catalogus',this)">&#128230; Alle artikelen</button>
      <button class="kal-subtab" onclick="setMatSubtab('themabakken',this)">&#129082; Themabakken</button>
      <button class="kal-subtab" onclick="setMatSubtab('vastebakken',this)">&#128451; Vaste bakken</button>
      <button class="kal-subtab" style="display:none" onclick="setMatSubtab('gedeeld',this)">&#128295; Gedeeld</button>
      <button class="kal-subtab" onclick="setMatSubtab('voorraad',this)">&#128203; Voorraad</button>
      <button class="kal-subtab" onclick="setMatSubtab('sport',this)">&#9917; Sport</button>
      <button class="kal-subtab" onclick="setMatSubtab('nakijken',this)">&#128994; Nakijken<span id="nakijken-subtab-badge" style="display:none;margin-left:4px;background:var(--red);color:#fff;font-size:9px;font-weight:700;border-radius:999px;padding:1px 5px"></span></button>
      <div style="flex:1"></div>
      <button class="btn-o" style="font-size:11px;height:28px" onclick="setMatSubtab('themas',this)">&#9881;&#65039; Thema&apos;s beheer</button>
    </div>

```

**Voorbeeld c — Transport (drie secties die elkaar spiegelen met dezelfde subtab-balk):**

**`index.html:1018-1023`**

```html
  <div class="sec" id="sec-transport-noden">
    <div style="display:flex;gap:5px;margin-bottom:1rem">
      <button class="kal-subtab active" onclick="goTo('transport-noden')">&#128229; Op te stellen</button>
      <button class="kal-subtab" onclick="goTo('transport-plan')">&#9889; Plannen</button>
      <button class="kal-subtab" onclick="goTo('transporten')">&#128202; Alle transporten</button>
    </div>
```

**`index.html:1099-1104`**

```html
  <div class="sec" id="sec-transport-plan">
    <div style="display:flex;gap:5px;margin-bottom:1rem">
      <button class="kal-subtab" onclick="goTo('transport-noden')">&#128229; Op te stellen</button>
      <button class="kal-subtab active" onclick="goTo('transport-plan')">&#9889; Plannen</button>
      <button class="kal-subtab" onclick="goTo('transporten')">&#128202; Alle transporten</button>
    </div>
```

## 1.7 Shell-CSS (index.html:14-31 + responsive 270-281, 322-364)

**Basis + shell — `index.html:14-31`**

```css
:root{--bg:#fff;--bg2:#f5f5f3;--bg3:#eceae4;--text:#1a1a18;--text2:#6b6b67;--text3:#9a9a95;--border:rgba(0,0,0,.11);--border2:rgba(0,0,0,.2);--green:#1D9E75;--green-bg:#E1F5EE;--green-dk:#085041;--red:#E24B4A;--red-bg:#FCEBEB;--red-dk:#791F1F;--amber:#EF9F27;--amber-bg:#FAEEDA;--amber-dk:#633806;--blue:#378ADD;--blue-bg:#E6F1FB;--blue-dk:#0C447C;--r:8px;--rl:12px}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--text);background:var(--bg2);min-height:100vh}
.app{max-width:960px;margin:0 auto;background:var(--bg);min-height:100vh;box-shadow:0 0 0 .5px var(--border)}
.topbar{display:flex;align-items:center;gap:10px;padding:.75rem 1.25rem;border-bottom:.5px solid var(--border)}
.logo{width:30px;height:30px;background:var(--green);border-radius:var(--r);display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;flex-shrink:0}
.nav{display:flex;gap:2px;padding:.5rem 1.25rem;border-bottom:.5px solid var(--border);flex-wrap:wrap}
.nb{padding:6px 10px;font-size:12px;border-radius:var(--r);cursor:pointer;border:.5px solid transparent;color:var(--text2);background:transparent;position:relative;font-family:inherit}
.nb:hover{background:var(--bg2)}
.nb.active{background:var(--green-bg);color:var(--green-dk);border-color:#5DCAA5;font-weight:500}
.nb.red-tab.active{background:var(--red-bg);color:var(--red-dk);border-color:#F09595}
.badge{position:absolute;top:1px;right:1px;width:15px;height:15px;border-radius:50%;background:var(--red);color:#fff;font-size:9px;font-weight:700;display:none;align-items:center;justify-content:center}
.content{padding:1.25rem}
.sec{display:none}.sec.active{display:block}
.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:1rem}
.metric{background:var(--bg2);border-radius:var(--r);padding:.625rem .875rem}
.metric-label{font-size:11px;color:var(--text2);margin-bottom:2px}
.metric-val{font-size:19px;font-weight:600}
.g{color:var(--green-dk)}.r{color:#A32D2D}.a{color:#854F0B}.b{color:var(--blue-dk)}
```

**Breakpoint ≤700px — `index.html:270-281`**

```css
@media(max-width:700px){
  .metrics{grid-template-columns:repeat(2,1fr);}
  .ov-dag-detail{grid-template-columns:1fr;}
  .content{padding:.75rem;}
  .topbar{padding:.5rem .875rem;}
  /* Larger tap targets for inline icon buttons */
  .bi{padding:7px 9px;}
  /* Prevent iOS Safari auto-zoom on input focus */
  .inp,.sel,.ai,input,select,textarea{font-size:16px!important;}
  /* Full-width filter inputs when wrapping */
  .fg.grow{flex:1 1 100%;}
}
```

**Breakpoint ≤600px en ≤400px — `index.html:322-364`**

```css
/* ── MOBIEL (≤600px) ── */
@media(max-width:600px){
  .app{max-width:100%;box-shadow:none}
  .topbar{padding:.5rem .875rem;gap:6px}
  .topbar-title{font-size:14px}
  .content{padding:.75rem .625rem}
  .metrics{grid-template-columns:repeat(2,1fr);gap:6px}
  .metric-val{font-size:16px}
  /* Tabellen scrollen horizontaal */
  .kal-wrap,.od-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
  .od-table{min-width:600px}
  .kal-table{min-width:500px}
  /* Planner week-grid: kleiner */
  #pl-kalender-grid{font-size:11px}
  #pl-kalender-grid .tp-hd{padding:.5rem .625rem;gap:6px}
  /* Maandkalender kleinere cellen */
  .maand-kal td,.maand-kal th{padding:2px 1px}
  .dag-vak{min-height:55px;padding:2px}
  /* Knoppen in nav */
  .nb{padding:5px 7px;font-size:11px}
  /* Filter-rij wrappen */
  .filter-row{gap:4px}
  .fb{padding:3px 8px}
  /* Modals */
  .modal{width:95vw!important;padding:.875rem;max-height:92vh}
  /* Kaart volledige breedte */
  #loc-map{height:200px}
  /* Formulieren stapelen */
  .fr{flex-direction:column}
  .fg.md .inp,.fg.md .sel{width:100%}
  .fg.sm .inp,.fg.sm .sel{width:100%}
  /* Overzicht-acties wrappen */
  .s-actions{flex-wrap:wrap}
  /* Transport-kaarten */
  .tp-taak{font-size:12px}
  /* Periode-selector in topbar verbergen op klein scherm */
  #topbar-periode{font-size:10px;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
}
@media(max-width:400px){
  .metrics{grid-template-columns:1fr 1fr}
  .nb{padding:4px 5px;font-size:10px}
  .content{padding:.5rem}
}
```

## 1.8 Hoe secties geladen worden (routing + render)

Alle secties staan al in de DOM; `goTo(id)` zet alleen `.active` om en roept de bijbehorende render-functie aan. Data zit in de globale `S` (gevuld door `loadAll()`).

**SECS + goTo — `index.html:1994-2037`**

```js
// ── 4-TAB ROUTING ──
const SECS=['overzicht','planning','materiaal','transport-noden','transport-plan','transporten','kaart','seizoensoverzicht','kampplanner','personeel'];


function goTo(id){
  SECS.forEach(s=>{
    const el=document.getElementById('sec-'+s);
    if(el) el.classList.toggle('active',s===id);
  });
  document.querySelectorAll('.nb').forEach((b,i)=>{
    const active=[
      id==='overzicht',
      id==='kampplanner',
      id==='transport-plan'||id==='transporten'||id==='transport-noden',
      id==='materiaal',
      id==='planning',
      id==='kaart',
      id==='personeel',
    ][i]||false;
    b.classList.toggle('active',active);
  });
  const renderMap={
    overzicht:renderOverzicht,
    planning:renderPlanning,
    kampplanner:renderKampplanner,
    materiaal:renderMateriaal,
    'transport-noden':renderNoden,
    'transport-plan':renderTransportPlan,
    transporten:renderTransportenOV,
    kaart:renderKaart,
    seizoensoverzicht:renderSeizoensoverzicht,
    personeel:renderPersoneel,
  };
  try {
    const p = renderMap[id]?.();
    if(p instanceof Promise) p.catch(err=>{
      console.error('Render error for',id,':',err);
      showToast('Fout bij laden van '+id+'. Is de server bereikbaar?','error');
    });
  } catch(err) {
    console.error('Render error for',id,':',err);
    showToast('Fout bij laden. Is de server bereikbaar?','error');
  }
}
```

**renderMateriaal (materiaal-sectie kiest zelf een subtab) — `index.html:2477-2484`**

```js
function renderMateriaal(){
  const activeTab=(['themabakken','vastebakken','gedeeld','voorraad','sport','themas','catalogus','standaard','voertuigen','nakijken'].includes(matSubtab)?matSubtab:'sport');
  matSubtab=activeTab;
  setMatSubtab(activeTab, document.querySelector('#sec-materiaal .kal-subtab.active')||document.querySelector(`#sec-materiaal .kal-subtab[onclick*="'${activeTab}'"]`)||document.querySelector('#sec-materiaal .kal-subtab'));
}

// ── THEMABAKKEN ──
let _tbOpen={}, _tbData=[];
```

**setMatSubtab (subtab-wissel in Materiaal) — `index.html:2041-2060`**

```js
function setMatSubtab(tab,btn){
  matSubtab=tab;
  document.querySelectorAll('#sec-materiaal .kal-subtab').forEach(b=>b.classList.remove('active'));
  if(btn&&btn.classList.contains('kal-subtab'))btn.classList.add('active');
  ['themabakken','vastebakken','gedeeld','voorraad','sport','themas','catalogus','standaard','voertuigen','nakijken'].forEach(t=>{
    const el=document.getElementById('mat-sub-'+t);
    if(el) el.style.display=t===tab?'block':'none';
  });
  if(tab==='themabakken'){renderThemabakken();}
  else if(tab==='vastebakken'){renderVasteBakken();}
  else if(tab==='gedeeld'){renderGedeeldTab();}
  else if(tab==='voorraad'){renderVoorraadTab();}
  else if(tab==='sport'){renderSportMateriaal();}
  else if(tab==='themas'){renderThemas();renderThemaCatBeheer();
    document.querySelectorAll('.th-cat-sel').forEach(sel=>{const cur=sel.value;sel.innerHTML=renderThemaCatSelect(cur);});}
  else if(tab==='catalogus'){renderCatalogus();}
  else if(tab==='standaard'){renderStandaard();}
  else if(tab==='voertuigen'){renderVoertuigen();}
  else if(tab==='nakijken'){laadNakijken();renderNakijkTekorten();}
}
```

### Opstart: login → bootApp → loadAll

**_setCurrentUser / checkLoginOnStart / showLoginScreen — `index.html:3796-3856`**

```js
function _setCurrentUser(u){
  CURRENT_USER=u;
  const el=document.getElementById('topbar-user'),naamEl=document.getElementById('topbar-user-naam');
  if(el&&naamEl&&u){el.style.display='inline-flex';naamEl.textContent=u.naam;}
  _prefillWieVelden();
}
// S3.2: acties op naam — overal waar nu een vrij "wie"-tekstveld bestaat vullen we de
// ingelogde naam vooraf in en zetten we het veld readonly (het veld blijft bestaan).
function _prefillWieVelden(){
  if(!CURRENT_USER)return;
  const nk=document.getElementById('nk2-wie');
  if(nk){nk.value=CURRENT_USER.naam;nk.readOnly=true;}
  const kz=document.getElementById('kz-naam');
  if(kz){kz.readOnly=true;}
}
async function checkLoginOnStart(){
  const token=localStorage.getItem('sporty-auth-token');
  if(token){
    const res=await fetch(API+'/wie-ben-ik',{headers:{'x-auth-token':token}});
    if(res.ok){
      const u=await res.json();
      localStorage.setItem('sporty-auth-user',JSON.stringify(u));
      _setCurrentUser(u);
      document.getElementById('login-overlay').style.display='none';
      bootApp();
      return;
    }
    localStorage.removeItem('sporty-auth-token');
    localStorage.removeItem('sporty-auth-user');
  }
  showLoginScreen();
}
async function showLoginScreen(){
  document.getElementById('login-overlay').style.display='flex';
  document.getElementById('topbar-user').style.display='none';
  let status={setup_nodig:false};
  try{ status=await (await fetch(API+'/login-status')).json(); }catch(e){}
  const setupMode=!!status.setup_nodig;
  document.getElementById('login-normal').style.display=setupMode?'none':'block';
  document.getElementById('login-setup').style.display=setupMode?'block':'none';
  document.getElementById('login-sub').textContent=setupMode?'Eerste keer opstarten':'Log in om verder te gaan';
  if(setupMode){
    // Setup-vangnet: personeel bestaat mogelijk al maar heeft nog geen pincode. We tonen de
    // volledige personeelslijst zodat de allereerste kantoor-pincode gezet kan worden.
    let personen=[];
    try{personen=await (await fetch(API+'/personeel-lijst-login')).json();}catch(e){}
    const sel=document.getElementById('setup-persoon');
    sel.innerHTML='<option value="">— Kies je naam —</option>'+(Array.isArray(personen)?personen:[]).map(p=>`<option value="${p.id}">${_escH(p.naam)} (${_rolLabel[p.rol]||p.rol})</option>`).join('');
  } else {
    let personen=[];
    try{personen=await (await fetch(API+'/personeel-lijst-login')).json();}catch(e){}
    const groepen={kantoor:'🏢 Kantoor',chauffeur:'🚐 Chauffeur',animator:'🎪 Animator',kv:'🏕️ KV'};
    const sel=document.getElementById('login-persoon');
    let html='<option value="">— Kies je naam —</option>';
    Object.keys(groepen).forEach(rol=>{
      const lijst=(Array.isArray(personen)?personen:[]).filter(p=>p.rol===rol);
      if(lijst.length)html+=`<optgroup label="${groepen[rol]}">`+lijst.map(p=>`<option value="${p.id}">${_escH(p.naam)}</option>`).join('')+'</optgroup>';
    });
    sel.innerHTML=html;
  }
}
```

**bootApp — `index.html:8770-8795`**

```js
function bootApp(){
  loadAll()
    .then(()=>{
      handleQrScan();
      updateMateriaalBadge();
      // Re-render whatever tab is currently visible (incl. if user clicked a tab during loading)
      const _initRenderMap={
        overzicht:renderOverzicht,
        planning:renderPlanning,
        materiaal:renderMateriaal,
        'transport-noden':renderNoden,
        'transport-plan':renderTransportPlan,
        transporten:renderTransportenOV,
      };
      const _activeTab=['overzicht','planning','materiaal','transport-noden','transport-plan','transporten']
        .find(t=>document.getElementById('sec-'+t)?.classList.contains('active'))||'overzicht';
      try{const p=_initRenderMap[_activeTab]?.();if(p instanceof Promise)p.catch(e=>console.error(e));}
      catch(e){console.error('Init render error:',e);}
    })
    .catch(err=>{
      console.error('Load failed:',err);
      showToast('Server niet bereikbaar. Is de server gestart op poort 3001?','error');
    });
}
// S3.2: app start achter login. checkLoginOnStart() (zie login-blok verderop) toont het
// loginscherm of, bij een geldig bewaard token, roept meteen bootApp() aan.
```

**loadAll + updateAanvragenBadge — `index.html:3892-3909`**

```js
async function loadAll(){const[a,b,c,d,f,g,h,periodes]=await Promise.all([api('GET','/locaties'),api('GET','/themas'),api('GET','/standaard'),api('GET','/kampmomenten'),api('GET','/materiaal'),api('GET','/overzicht'),api('GET','/kalender'),api('GET','/periodes')]);S={locaties:a,themas:b.map(t=>({...t,materiaal:t.materiaal||t.mat||[]})),standaard:c,kampmomenten:d,materiaal:f,overzicht:g,locMat:{},periodes:Array.isArray(periodes)?periodes:[]};kalData=h&&h.werkdagen?h:{werkdagen:[],locaties:[],dagen:[],gesloten_dagen:[]};await Promise.all(a.filter(l=>l.type==='kamp').map(async l=>{S.locMat[l.id]=await api('GET','/locaties/'+l.id+'/materiaal');}));
S_thema_cats=await api('GET','/thema-categorieen');
// Stel de actieve periode in: eerste periode of de eerste met kampmomenten
// V2: de actieve periode komt van de server (vakantieperiodes.actief), niet meer uit "de eerste met kampmomenten".
if(S.periodes.length){S.activePeriode=S.periodes.find(p=>p.actief)||S.periodes[0];}
const tbl=document.getElementById('topbar-periode');if(tbl&&S.activePeriode)tbl.textContent=S.activePeriode.naam;
// Initialiseer kalender navigatiedatum op start actieve periode
if(S.activePeriode&&!ovDate)ovDate=new Date(S.activePeriode.start_datum+'T12:00:00');
else if(!ovDate)ovDate=new Date(); // V2b: geen vaste juli 2026 meer — zonder periode: vandaag
const _nAanv=await api('GET','/aanvragen?status=nieuw');
updateAanvragenBadge(Array.isArray(_nAanv)?_nAanv.length:0);}

// S3.3: badge-infrastructuur hergebruikt voor het aantal 'nieuw'-aanvragen (voorheen spoedmeldingen).
function updateAanvragenBadge(n){
  const b=document.getElementById('badge-spoed');if(b)b.style.display=n?'inline-block':'none';
  const bn=document.getElementById('badge-spoed-n');if(bn)bn.textContent=n;
  const ovSp=document.getElementById('ov-sp');if(ovSp)ovSp.textContent=n;
}
```

### Topbalk-gedrag: tijdmachine (🕐), donkere modus (🌙), globale zoek

**Tijdmachine — `index.html:1970-1992`**

```js



// ── TIJDMACHINE ──
let _simDate=null;
function _appNow(){return _simDate?new Date(_simDate+'T12:00:00'):new Date();}
function toggleTimeMachine(){
  const el=document.getElementById('time-machine');
  const isOpen=el.style.display!=='none';
  el.style.display=isOpen?'none':'flex';
  if(!isOpen){const inp=document.getElementById('sim-date-input');inp.value=_simDate||new Date().toISOString().split('T')[0];}
}
function setSimDate(v){
  _simDate=v||null;
  const ind=document.getElementById('sim-indicator');
  if(ind)ind.style.display=_simDate?'inline-flex':'none';
  const lbl=document.getElementById('sim-date-label');
  if(lbl&&_simDate)lbl.textContent=new Date(_simDate+'T12:00:00').toLocaleDateString('nl-BE',{day:'numeric',month:'short',year:'numeric'});
  if(!v)document.getElementById('time-machine').style.display='none';
  const renderMap={overzicht:renderOverzicht,planning:renderPlanning,'transport-plan':renderTransportPlan,transporten:renderTransportenOV};
  const activeTab=SECS.find(t=>document.getElementById('sec-'+t)?.classList.contains('active'))||'overzicht';
  try{renderMap[activeTab]?.();}catch(e){console.error(e);}
}
```

**Globale zoek + donkere modus — `index.html:8833-8882`**

```js
// ── GLOBALE ZOEKFUNCTIE ──
let _searchTimer=null;
function globalSearch(q){
  const wrap=document.getElementById('global-search-results');
  if(!wrap)return;
  clearTimeout(_searchTimer);
  q=q.trim().toLowerCase();
  if(!q){wrap.style.display='none';return;}
  _searchTimer=setTimeout(()=>{
    const results=[];
    // Locaties
    (S.locaties||[]).forEach(l=>{if(l.name&&l.name.toLowerCase().includes(q))results.push({icon:'📍',label:l.name,sub:l.type==='stockage'?'Stockage':'Kamplocatie',action:`goTo('planning')`});});
    // Sportmateriaal
    (_invSport||[]).forEach(it=>{if(it.name&&it.name.toLowerCase().includes(q))results.push({icon:'⚽',label:it.name,sub:'Sportmateriaal',action:`goTo('materiaal')`});});
    // Thema's
    (S.themas||[]).forEach(t=>{if(t.name&&t.name.toLowerCase().includes(q))results.push({icon:'🎨',label:t.name,sub:'Thema',action:`goTo('materiaal')`});});
    // Thema-materiaal
    (S.themas||[]).forEach(t=>(t.materiaal||t.mat||[]).forEach(m=>{if(m.name&&m.name.toLowerCase().includes(q))results.push({icon:'🎯',label:m.name,sub:'Thema: '+t.name,action:`goTo('materiaal')`});}));
    // Gedeeld materiaal
    (_invGedeeld||[]).forEach(m=>{if(m.name&&m.name.toLowerCase().includes(q))results.push({icon:'🔧',label:m.name,sub:'Gedeeld materiaal',action:`goTo('materiaal')`});});
    // Transporten
    (plannerTaken||[]).filter(t=>t.opmerking&&t.opmerking.toLowerCase().includes(q)).slice(0,5).forEach(t=>{results.push({icon:'🚚',label:t.opmerking||t.type,sub:t.rit_id?((t.datum||'')+' · '+t.type):'Op te stellen · '+t.type,action:t.rit_id?`goTo('transport-plan')`:`goTo('transport-noden')`});});
    // Periodes
    (S.periodes||[]).forEach(p=>{if(p.naam&&p.naam.toLowerCase().includes(q))results.push({icon:'📅',label:p.naam,sub:'Vakantieperiode',action:`goTo('overzicht')`});});

    if(!results.length){wrap.innerHTML='<div style="padding:10px 14px;font-size:12px;color:var(--text2)">Geen resultaten voor "'+q+'"</div>';wrap.style.display='block';return;}
    wrap.innerHTML=results.slice(0,12).map((r,i)=>`<div onclick="${r.action};document.getElementById('global-search').value='';document.getElementById('global-search-results').style.display='none'" style="display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;border-bottom:.5px solid var(--border)" onmouseenter="this.style.background='var(--bg2)'" onmouseleave="this.style.background=''"><span style="font-size:16px;width:22px;text-align:center">${r.icon}</span><div><div style="font-size:13px;font-weight:500">${r.label}</div><div style="font-size:11px;color:var(--text2)">${r.sub}</div></div></div>`).join('');
    wrap.style.display='block';
  },150);
}
// Sluit zoekresultaten bij klik buiten
document.addEventListener('click',function(e){const r=document.getElementById('global-search-results');if(r&&!r.contains(e.target)&&e.target.id!=='global-search')r.style.display='none';});

// ── DONKERE MODUS ──
function toggleDarkMode(){
  const dark=document.documentElement.getAttribute('data-theme')==='dark';
  document.documentElement.setAttribute('data-theme',dark?'light':'dark');
  localStorage.setItem('sporty-theme',dark?'light':'dark');
  document.getElementById('dark-toggle').textContent=dark?'🌙':'☀️';
}
// Initialiseer thema bij laden
(function(){
  const saved=localStorage.getItem('sporty-theme');
  if(saved==='dark'){document.documentElement.setAttribute('data-theme','dark');}
  // Toggle-knop icon bijwerken zodra DOM klaar is
  document.addEventListener('DOMContentLoaded',function(){
    const btn=document.getElementById('dark-toggle');
    if(btn)btn.textContent=document.documentElement.getAttribute('data-theme')==='dark'?'☀️':'🌙';
  });
})();
```

---

# 2. Rit-pagina (chauffeur) — volledige template

Bron: `routes/transport.js` regels 1101-1206 (route-handler incl. server-side renderlogica, de HTML/CSS-template en het client-script). Letterlijk:

**Rit-pagina — `routes/transport.js:1101-1206`**

```js
  app.get('/rit/:token',(req,res)=>{
    const rit=get('SELECT * FROM transport_ritten WHERE rit_token=?',[req.params.token]);
    if(!rit)return res.status(404).send('<h2 style="font-family:system-ui;padding:2rem">Rit niet gevonden of link verlopen.</h2>');
    _zorgVoorChecks(rit);
    const taken=all(`SELECT tt.*,fl.name AS van_naam,tl.name AS naar_naam,km.week AS km_week
      FROM transport_taken tt
      LEFT JOIN locaties fl ON tt.van_locatie_id=fl.id
      LEFT JOIN locaties tl ON tt.naar_locatie_id=tl.id
      LEFT JOIN kampmomenten km ON tt.kampmoment_id=km.id
      WHERE tt.rit_id=? ORDER BY tt.tijd`,[rit.id]);
    const checks=all('SELECT * FROM verhuis_checks WHERE rit_id=? ORDER BY sort_order',[rit.id]);
    const typeIcon={levering:'📦',ophaling:'📤',transfer:'🔄'};
    const stops=taken.map(t=>`<div class="stop">
      <div class="type">${typeIcon[t.type]||'🚚'} ${t.type==='levering'?'Levering':t.type==='ophaling'?'Ophaling':'Transfer'}${t.km_week?' (week '+t.km_week+')':''}</div>
      <div class="nm">${t.opmerking||'(zonder naam)'}</div>
      <div class="rt">${t.van_naam||'Stockage'} → ${t.naar_naam||'Stockage'}</div>
      ${t.tijd?'<div class="ti">⏰ '+t.tijd+'</div>':''}
      <div class="fasebtns"><button type="button" class="fbtn ${t.status==='aangekomen'||t.status==='gedaan'?'done':''}" id="stop-${t.id}" onclick="aangekomen(${t.id})">${t.status==='gedaan'?'✅ Stop afgerond':t.status==='aangekomen'?'📍 Aangekomen':'📍 Ik ben aangekomen'}</button></div></div>`).join('');
    // Chauffeur ziet bakken, geen inhoud: groepeer per rek (eerste letter van de code in de naam)
    // zodat rek per rek gelopen kan worden.
    function _rekVan(c){const m=(c.item_naam||'').match(/\(([A-Za-z])[0-9]*\)/);return m?m[1].toUpperCase():null;}
    const chkByRek={};
    checks.forEach(c=>{const r=(c.item_soort==='thema'||c.item_soort==='attribuut'||c.item_soort==='vast')?(_rekVan(c)||'Overig'):'Overig';(chkByRek[r]=chkByRek[r]||[]).push(c);});
    const rekKeys=Object.keys(chkByRek).sort((a,b)=>a==='Overig'?1:b==='Overig'?-1:a.localeCompare(b));
    // S3.6: twee vink-fases per bak/attribuut (laden bij vertrek, lossen bij aankomst).
    // Alleen thema/attribuut/vast-regels (= bakken/attributen, geen basis-materiaal) krijgen
    // de fase-knoppen — basis-materiaal blijft de oude eenvoudige status-weergave.
    const chkRows=rekKeys.map(rek=>{
      const rows=chkByRek[rek].map(c=>{
        const isBak=c.item_soort==='thema'||c.item_soort==='attribuut'||c.item_soort==='vast';
        if(!isBak){
          return `<div class="chk ${c.status}">
            <span class="ico">${c.status==='ok'?'✅':c.status==='ontbreekt'?'❌':c.status==='deels'?'⚠️':'⬜'}</span>
            <span class="nm">${c.item_naam||''}</span>
            <span class="qty">×${c.qty}</span>
            ${c.notitie?'<div class="nt">'+c.notitie+'</div>':''}</div>`;
        }
        return `<div class="chk fase" id="chk-${c.id}">
          <span class="nm">${c.item_naam||''}</span>
          <span class="qty">×${c.qty}</span>
          <div class="fasebtns">
            <button type="button" class="fbtn b-laden ${c.geladen?'done':''}" onclick="tog(${c.id},'laden')">${c.geladen?'✅ Geladen':'⬆️ Laden'}</button>
            <button type="button" class="fbtn b-lossen ${c.gelost?'done':''}" onclick="tog(${c.id},'lossen')">${c.gelost?'✅ Gelost':'⬇️ Lossen'}</button>
          </div></div>`;
      }).join('');
      return (rek!=='Overig'?`<div class="rek">📍 Rek ${rek}</div>`:'')+rows;
    }).join('');
    res.send(`<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rit ${rit.datum}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;background:#f5f5f5;color:#1a1a1a}
.hdr{background:#2563eb;color:#fff;padding:14px 16px}.hdr h1{font-size:18px;font-weight:700}.hdr .sub{font-size:13px;opacity:.8;margin-top:2px}
.sec{padding:10px 16px 4px;font-size:11px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #e5e5e5;margin-top:8px}
.stop{background:#fff;border-left:4px solid #2563eb;margin:8px 10px;border-radius:6px;padding:12px 14px}
.stop .type{font-size:11px;color:#2563eb;font-weight:700;margin-bottom:2px}
.stop .nm{font-size:15px;font-weight:600}.stop .rt{font-size:12px;color:#666;margin-top:2px}.stop .ti{font-size:12px;color:#2563eb;margin-top:4px}
.chk{background:#fff;margin:6px 10px;border-radius:6px;padding:10px 12px;display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.chk.ok{background:#f0fff4;border-left:3px solid #22c55e}.chk.ontbreekt{background:#fff1f1;border-left:3px solid #ef4444}.chk.deels{background:#fffbeb;border-left:3px solid #f59e0b}
.chk .ico{font-size:18px;flex-shrink:0}.chk .nm{flex:1;font-size:14px}.chk .qty{font-size:12px;color:#888}.chk .nt{width:100%;font-size:11px;color:#888;font-style:italic}
.chk.fase{flex-direction:column;align-items:stretch}
.chk.fase .nm{flex:none}
.fasebtns{display:flex;gap:8px;margin-top:6px;width:100%}
.fbtn{flex:1;min-height:48px;border-radius:8px;border:1.5px solid #cbd5e1;background:#fff;color:#334155;font-size:14px;font-weight:600;font-family:inherit}
.fbtn.done{background:#dcfce7;border-color:#22c55e;color:#166534}
.rek{margin:10px 10px 2px;font-size:12px;font-weight:700;color:#2563eb}
.footer{padding:20px 16px;text-align:center;font-size:12px;color:#aaa}
.toast{position:fixed;left:50%;bottom:20px;transform:translate(-50%,20px);max-width:calc(100% - 32px);padding:12px 18px;border-radius:10px;color:#fff;font-size:14px;font-weight:600;box-shadow:0 4px 14px rgba(0,0,0,.2);opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;z-index:10}
.toast.zicht{opacity:1;transform:translate(-50%,0)}.toast.goed{background:#16a34a}.toast.fout{background:#dc2626}</style></head><body>
<div class="hdr"><h1>🚚 Rit ${rit.datum}</h1>
<div class="sub">${rit.chauffeur?'👤 '+rit.chauffeur:''}${rit.voertuig?' · 🚐 '+rit.voertuig:''} · ${taken.length} stop${taken.length!==1?'s':''}</div></div>
<div class="sec">Stops</div>${stops||'<div style="padding:16px;color:#888">Geen stops gepland.</div>'}
${checks.length?'<div class="sec">Materiaallijst ('+checks.length+' items)</div>'+chkRows:''}
<div class="footer">Sporty Logistics</div>
<script>
const TOKEN=${JSON.stringify(req.params.token)};
// V3d: kleine melding onderaan het scherm (3 s, groen/rood) i.p.v. toast().
function toast(tekst,goed){
  let t=document.getElementById('toast',false);
  if(!t){t=document.createElement('div');t.id='toast';t.setAttribute('role','status');document.body.appendChild(t);}
  t.textContent=tekst;t.className='toast '+(goed?'goed':'fout')+' zicht';
  clearTimeout(t._tm);t._tm=setTimeout(()=>t.classList.remove('zicht'),3000);
}
async function aangekomen(id){
  const b=document.getElementById('stop-'+id);b.disabled=true;
  try{const r=await fetch('/api/rit-token/'+TOKEN+'/taken/'+id+'/aangekomen',{method:'POST'});const t=await r.json();
    if(!r.ok){toast(t.error||'Fout bij opslaan',false);return;}
    b.textContent=t.status==='gedaan'?'✅ Stop afgerond':'📍 Aangekomen';b.classList.add('done');toast('Aankomst doorgegeven',true);}
  catch(e){toast('Netwerkfout — probeer opnieuw.',false);}finally{b.disabled=false;}
}
async function tog(id,kind){
  const row=document.getElementById('chk-'+id);
  const btns=row.querySelectorAll('.fbtn');
  btns.forEach(b=>b.disabled=true);
  try{
    const r=await fetch('/api/rit-token/'+TOKEN+'/checks/'+id+'/'+kind,{method:'POST'});
    const c=await r.json();
    if(!r.ok){toast(c.error||'Fout bij opslaan',false);return;}
    const bl=row.querySelector('.b-laden'), bg=row.querySelector('.b-lossen');
    bl.textContent=c.geladen?'✅ Geladen':'⬆️ Laden'; bl.classList.toggle('done',!!c.geladen);
    bg.textContent=c.gelost?'✅ Gelost':'⬇️ Lossen'; bg.classList.toggle('done',!!c.gelost);
    toast(kind==='laden'?(c.geladen?'Geladen':'Laden ongedaan'):(c.gelost?'Gelost':'Lossen ongedaan'),true);
  }catch(e){toast('Netwerkfout — probeer opnieuw.',false);}
  finally{btns.forEach(b=>b.disabled=false);}
}
</script>
</body></html>`);
  });
```

---

# 3. KV-pagina (kampverantwoordelijke) — volledige template

Bron: `routes/kv.js` regels 143-496 (route-handler, HTML/CSS-template en het volledige client-script dat de vijf blokken rendert). Letterlijk:

**KV-pagina — `routes/kv.js:143-496`**

```js
  app.get('/kv/:token',(req,res)=>{
    const km=_kvKampmoment(req.params.token);
    if(!km)return res.status(404).send('<h2 style="font-family:system-ui;padding:2rem">Link niet gevonden of verlopen.</h2>');
    res.send(`<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>KV-scherm</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#f5f5f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a18;-webkit-font-smoothing:antialiased;padding-bottom:4px}
input,textarea,button{font-family:inherit}
input::placeholder,textarea::placeholder{color:#9a9a95}
.code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;font-weight:600;background:#f5f5f3;border:.5px solid rgba(0,0,0,.2);border-radius:5px;padding:3px 7px;flex-shrink:0}
.card{background:#fff;border:.5px solid rgba(0,0,0,.11);border-radius:12px}
.pill{font-size:11px;font-weight:600;padding:4px 9px;border-radius:999px;flex-shrink:0}
.tabpill{flex-shrink:0;font-size:12px;font-weight:500;padding:7px 12px;border-radius:999px;background:#f5f5f3;color:#6b6b67;text-decoration:none;border:none;cursor:pointer}
.tabpill.actief{background:#E1F5EE;color:#085041;font-weight:600}
.bloktitel{font-size:20px;font-weight:600;letter-spacing:-.01em}
.blokintro{font-size:13px;color:#6b6b67;margin-top:4px;line-height:1.45}
.seclabel{font-size:11px;font-weight:700;color:#6b6b67;text-transform:uppercase;letter-spacing:.06em}
.rowbtn{display:flex;align-items:center;flex-shrink:0;border:1.5px solid rgba(0,0,0,.2);border-radius:10px;background:#fff;overflow:hidden}
.rowbtn button{width:44px;height:46px;border:none;background:transparent;font-size:22px;line-height:1;color:#1a1a18;cursor:pointer}
.rowbtn input{width:46px;height:46px;border:none;background:transparent;text-align:center;font-size:17px;font-weight:600;color:#1a1a18;outline:none;padding:0}
.bigbtn{width:100%;height:50px;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer}
.textarea{width:100%;border:.5px solid rgba(0,0,0,.2);border-radius:10px;padding:12px;font-size:15px;line-height:1.45;color:#1a1a18;background:#fff;resize:none;outline:none}
</style></head><body>

<div style="position:sticky;top:0;z-index:20;background:#fff;border-bottom:.5px solid rgba(0,0,0,.11)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px">
    <div style="width:30px;height:30px;background:#1D9E75;border-radius:8px;flex-shrink:0"></div>
    <div style="flex:1;min-width:0">
      <div id="kv-kampnaam" style="font-size:15px;font-weight:600;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Laden…</div>
      <div id="kv-kvregel" style="font-size:12px;color:#6b6b67;margin-top:1px"></div>
    </div>
  </div>
  <div id="kv-tabs" style="display:flex;gap:6px;padding:0 16px 10px;overflow-x:auto"></div>
</div>

<div id="kv-blok1" style="padding:20px 16px 0"></div>
<div id="kv-blok2" style="padding:28px 16px 0;display:none"></div>
<div id="kv-blok3" style="padding:28px 16px 0;display:none"></div>
<div id="kv-blok4" style="padding:28px 16px 0;display:none"></div>
<div id="kv-blok5" style="padding:28px 16px 0;display:none"></div>
<div style="height:24px"></div>

<div id="kv-footer" style="display:none;position:sticky;bottom:0;z-index:20;background:#fff;border-top:.5px solid rgba(0,0,0,.11);padding:12px 16px calc(12px + env(safe-area-inset-bottom))">
  <div style="display:flex;align-items:center;gap:10px">
    <div style="flex:1;min-width:0">
      <div id="kv-voortgang-tekst" style="font-size:14px;font-weight:600;line-height:1.2"></div>
      <div id="kv-balk-subtekst" style="font-size:12px;color:#6b6b67;margin-top:2px"></div>
    </div>
    <button id="kv-versturen-btn" class="bigbtn" style="flex-shrink:0;width:auto;height:52px;padding:0 22px;color:#fff" onclick="verstuurControle()">Versturen</button>
  </div>
</div>

<script>
const TOKEN=${JSON.stringify(req.params.token)};
let DATA=null, ACTIEF='blok1', OPEN_BAK=null, LOCAL={}, ATTR_LOCAL={}, KAPOT_OPEN=false, KAPOT_FOTO=null, BOODSCHAP_VINK={};
let TABS=[['blok1','Wat moet er staan'],['blok2','Vrijdagcontrole'],['blok3','Iets nodig?'],['blok4','Iets kapot?']];

function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
async function kvApi(method,path,body){
  const r=await fetch('/api/kv/'+TOKEN+path,{method,headers:body!==undefined?{'Content-Type':'application/json'}:{},body:body!==undefined?JSON.stringify(body):undefined});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||'Er ging iets mis');
  return d;
}

async function init(){
  try{ DATA=await kvApi('GET','/data'); }
  catch(e){ document.body.innerHTML='<div style="padding:2rem;font-family:system-ui"><h2>Link niet gevonden of verlopen.</h2></div>'; return; }
  // S4.8: enkel een 5de tabblad "Boodschappen" tonen als dit kampmoment KV-boodschappen heeft.
  if((DATA.boodschappen||[]).length)TABS=[...TABS,['blok5','Boodschappen']];
  renderHeader();
  renderTabs();
  renderAll();
}
function renderHeader(){
  document.getElementById('kv-kampnaam').textContent=DATA.kampNaam;
  document.getElementById('kv-kvregel').textContent=(DATA.kvNaam||'—')+' · kampverantwoordelijke';
}
function renderTabs(){
  const el=document.getElementById('kv-tabs');
  el.innerHTML=TABS.map(([id,label])=>'<button class="tabpill'+(ACTIEF===id?' actief':'')+'" onclick="gaNaar(\\''+id+'\\')">'+label+'</button>').join('');
}
function gaNaar(blok){
  ACTIEF=blok;
  TABS.forEach(([id])=>{document.getElementById('kv-'+id).style.display=(id===blok)?'':'none';});
  document.getElementById('kv-footer').style.display=(blok==='blok2')?'flex':'none';
  renderTabs();
  window.scrollTo({top:0});
  renderAll();
}

// ── Voortgangsberekening (merged: lokale bewerking > laatst opgeslagen serverwaarde) ──
function waardeVan(bakId,itemId,serverVal){
  const lok=LOCAL[bakId];
  if(lok&&Object.prototype.hasOwnProperty.call(lok,itemId))return lok[itemId];
  return serverVal;
}
function attrStatusVan(attrId,serverStatus){
  return Object.prototype.hasOwnProperty.call(ATTR_LOCAL,attrId)?ATTR_LOCAL[attrId]:serverStatus;
}
function voortgang(){
  let geteld=0,tekortTotaal=0;
  (DATA.bakken||[]).forEach(b=>{
    const compleet=b.items.every(it=>typeof waardeVan(b.id,it.id,it.aangetroffen)==='number');
    if(compleet)geteld++;
    b.items.forEach(it=>{const v=waardeVan(b.id,it.id,it.aangetroffen);if(typeof v==='number'&&v<it.gewenst)tekortTotaal++;});
  });
  const attrGedaan=(DATA.attributen||[]).filter(a=>attrStatusVan(a.id,a.status)).length;
  const totBakken=(DATA.bakken||[]).length||1;
  return {geteld,tekortTotaal,attrGedaan,totAttr:(DATA.attributen||[]).length,totBakken,
    klaar:geteld===(DATA.bakken||[]).length&&attrGedaan===(DATA.attributen||[]).length};
}

function renderAll(){
  if(ACTIEF==='blok1')renderBlok1();
  if(ACTIEF==='blok2')renderBlok2();
  if(ACTIEF==='blok3')renderBlok3();
  if(ACTIEF==='blok4')renderBlok4();
  if(ACTIEF==='blok5')renderBlok5();
  if(ACTIEF==='blok2')renderFooter();
}

function renderBlok1(){
  const el=document.getElementById('kv-blok1');
  const bakRows=(DATA.bakken||[]).map(b=>'<div style="display:flex;align-items:center;gap:10px;padding:11px 14px;border-top:.5px solid rgba(0,0,0,.11)">'
    +'<span class="code">'+esc(b.code||'—')+'</span>'
    +'<div style="flex:1;min-width:0;font-size:14px">'+esc(b.naam)+'</div>'
    +'<div style="font-size:12px;color:#9a9a95;flex-shrink:0">'+b.items.length+' items</div></div>').join('');
  const attrRows=(DATA.attributen||[]).map(a=>'<div style="display:flex;align-items:center;gap:10px;padding:11px 14px;border-top:.5px solid rgba(0,0,0,.11)">'
    +'<span class="code">'+esc(a.code||'—')+'</span>'
    +'<div style="flex:1;min-width:0;font-size:14px">'+esc(a.naam)+'</div></div>').join('');
  el.innerHTML=
    '<div class="seclabel" style="margin-bottom:6px">Blok 1</div>'
    +'<div class="bloktitel">Wat moet er staan</div>'
    +'<div class="blokintro">Dit is wat de chauffeur lost op de locatie. Even nakijken of alles er staat — je hoeft hier niets in te vullen.</div>'
    +'<div class="card" style="margin-top:12px;overflow:hidden">'
    +'<div style="font-size:11px;font-weight:600;color:#6b6b67;text-transform:uppercase;letter-spacing:.05em;padding:12px 14px 8px">'+(DATA.bakken||[]).length+' bakken</div>'
    +(bakRows||'<div style="padding:11px 14px;color:#9a9a95;font-size:13px;border-top:.5px solid rgba(0,0,0,.11)">Nog geen bakken gekoppeld.</div>')
    +'</div>'
    +'<div class="card" style="margin-top:10px;overflow:hidden">'
    +'<div style="font-size:11px;font-weight:600;color:#6b6b67;text-transform:uppercase;letter-spacing:.05em;padding:12px 14px 8px">'+(DATA.attributen||[]).length+' attributen</div>'
    +(attrRows||'<div style="padding:11px 14px;color:#9a9a95;font-size:13px;border-top:.5px solid rgba(0,0,0,.11)">Geen attributen.</div>')
    +'</div>'
    +'<div style="font-size:12px;color:#6b6b67;margin-top:10px;line-height:1.5">Staat er iets niet? Meld het onderaan bij <strong style="font-weight:600;color:#1a1a18">Iets nodig?</strong></div>';
}

function renderBlok2(){
  const el=document.getElementById('kv-blok2');
  const v=voortgang();
  const bakHtml=(DATA.bakken||[]).map(b=>{
    const open=OPEN_BAK===b.id;
    const compleet=b.items.every(it=>typeof waardeVan(b.id,it.id,it.aangetroffen)==='number');
    const tekorten=b.items.filter(it=>{const val=waardeVan(b.id,it.id,it.aangetroffen);return typeof val==='number'&&val<it.gewenst;}).length;
    const geteldAantal=b.items.filter(it=>typeof waardeVan(b.id,it.id,it.aangetroffen)==='number').length;
    let pilTekst='Nog te tellen',pilBg='#f5f5f3',pilKleur='#6b6b67';
    if(compleet&&tekorten>0){pilTekst=tekorten+' te weinig';pilBg='#FAEEDA';pilKleur='#633806';}
    else if(compleet){pilTekst='Geteld';pilBg='#E1F5EE';pilKleur='#085041';}
    else if(geteldAantal>0){pilTekst=geteldAantal+'/'+b.items.length;pilBg='#E6F1FB';pilKleur='#0C447C';}
    const itemsHtml=open?b.items.map(it=>{
      const val=waardeVan(b.id,it.id,it.aangetroffen);
      const heeft=typeof val==='number';
      const tekort=heeft&&val<it.gewenst, teveel=heeft&&val>it.gewenst;
      let sub=it.gewenst+' gewenst',subKleur='#6b6b67';
      if(tekort){sub=(it.gewenst-val)+' te weinig · '+it.gewenst+' gewenst';subKleur='#633806';}
      else if(teveel){sub=(val-it.gewenst)+' te veel · '+it.gewenst+' gewenst';subKleur='#0C447C';}
      else if(heeft){sub='Klopt · '+it.gewenst+' gewenst';subKleur='#085041';}
      const rand=tekort?'#EF9F27':(heeft?'#5DCAA5':'rgba(0,0,0,.2)');
      const veldBg=tekort?'#FAEEDA':(heeft?'#E1F5EE':'#fff');
      return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:.5px solid rgba(0,0,0,.08)">'
        +'<div style="flex:1;min-width:0"><div style="font-size:15px;line-height:1.3">'+esc(it.naam)+'</div>'
        +'<div style="font-size:12px;margin-top:3px;color:'+subKleur+'">'+esc(sub)+'</div></div>'
        +'<div class="rowbtn" style="border-color:'+rand+';background:'+veldBg+'">'
        +'<button onclick="stel('+b.id+','+it.id+',Math.max(0,('+(heeft?val:0)+')-1))">−</button>'
        +'<input value="'+(heeft?val:'')+'" inputmode="numeric" placeholder="—" onchange="stelUitInput('+b.id+','+it.id+',this.value)">'
        +'<button onclick="stel('+b.id+','+it.id+',('+(heeft?val:0)+')+1)">+</button></div></div>';
    }).join('')+'<button class="bigbtn" style="margin-top:12px;border:.5px solid rgba(0,0,0,.2);background:#fff;color:#1a1a18" onclick="bakAfsluiten('+b.id+')">Bak afsluiten</button>':'';
    return '<div class="card" style="margin-top:10px;overflow:hidden">'
      +'<button onclick="toggleBak('+b.id+')" style="display:flex;align-items:center;gap:10px;width:100%;padding:14px;background:#fff;border:none;cursor:pointer;text-align:left;min-height:60px">'
      +'<span class="code">'+esc(b.code||'—')+'</span>'
      +'<span style="flex:1;min-width:0"><span style="display:block;font-size:15px;font-weight:500;line-height:1.25">'+esc(b.naam)+'</span>'
      +'<span style="display:block;font-size:12px;color:#6b6b67;margin-top:2px">'+b.items.length+' items</span></span>'
      +'<span class="pill" style="background:'+pilBg+';color:'+pilKleur+'">'+pilTekst+'</span>'
      +'<span style="font-size:11px;color:#9a9a95;flex-shrink:0;width:12px;text-align:center">'+(open?'▲':'▼')+'</span></button>'
      +(open?'<div style="padding:0 14px 14px;border-top:.5px solid rgba(0,0,0,.11)">'+itemsHtml+'</div>':'')
      +'</div>';
  }).join('');
  const attrHtml=(DATA.attributen||[]).map(a=>{
    const st=attrStatusVan(a.id,a.status);
    const aRand=st==='aanwezig'?'#1D9E75':'rgba(0,0,0,.15)', aBg=st==='aanwezig'?'#E1F5EE':'#fff', aKleur=st==='aanwezig'?'#085041':'#6b6b67';
    const bRand=st==='beschadigd'?'#E24B4A':'rgba(0,0,0,.15)', bBg=st==='beschadigd'?'#FCEBEB':'#fff', bKleur=st==='beschadigd'?'#791F1F':'#6b6b67';
    return '<div style="padding:12px 14px;border-bottom:.5px solid rgba(0,0,0,.08)">'
      +'<div style="display:flex;align-items:center;gap:10px"><span class="code">'+esc(a.code||'—')+'</span>'
      +'<div style="flex:1;min-width:0;font-size:15px;line-height:1.3">'+esc(a.naam)+'</div></div>'
      +'<div style="display:flex;gap:8px;margin-top:10px">'
      +'<button onclick="zetAttr('+a.id+',\\'aanwezig\\')" style="flex:1;height:46px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;border:1.5px solid '+aRand+';background:'+aBg+';color:'+aKleur+'">Aanwezig</button>'
      +'<button onclick="zetAttr('+a.id+',\\'beschadigd\\')" style="flex:1;height:46px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;border:1.5px solid '+bRand+';background:'+bBg+';color:'+bKleur+'">Beschadigd</button></div></div>';
  }).join('');
  el.innerHTML=
    '<div class="seclabel" style="margin-bottom:6px">Blok 2</div>'
    +'<div class="bloktitel">Vrijdagcontrole</div>'
    +'<div class="blokintro">Tel op vrijdag alles na wat er staat. Eén bak per keer — je werk blijft bewaard, ook als je tussendoor stopt.</div>'
    +'<div class="card" style="padding:14px;margin-top:12px">'
    +'<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">'
    +'<div style="font-size:15px;font-weight:600">'+v.geteld+' van '+v.totBakken+' bakken geteld</div>'
    +'<div style="font-size:12px;color:#6b6b67">'+(v.tekortTotaal===0?'Geen tekorten':v.tekortTotaal+(v.tekortTotaal===1?' tekort':' tekorten'))+'</div></div>'
    +'<div style="height:8px;border-radius:999px;background:#eceae4;margin-top:10px;overflow:hidden">'
    +'<div style="height:8px;border-radius:999px;background:#1D9E75;width:'+Math.round(v.geteld/v.totBakken*100)+'%"></div></div></div>'
    +bakHtml
    +'<div class="seclabel" style="margin:22px 0 8px">Attributen</div>'
    +'<div class="card" style="overflow:hidden">'+(attrHtml||'<div style="padding:12px 14px;color:#9a9a95;font-size:13px">Geen attributen.</div>')+'</div>';
}
function toggleBak(id){ OPEN_BAK=(OPEN_BAK===id)?null:id; renderBlok2(); renderFooter(); }
function stel(bakId,itemId,val){
  if(!LOCAL[bakId])LOCAL[bakId]={};
  LOCAL[bakId][itemId]=Math.max(0,val);
  renderBlok2(); renderFooter();
}
function stelUitInput(bakId,itemId,raw){
  const digits=(raw||'').replace(/[^0-9]/g,'');
  if(!LOCAL[bakId])LOCAL[bakId]={};
  if(digits==='')delete LOCAL[bakId][itemId]; else LOCAL[bakId][itemId]=Math.min(999,parseInt(digits,10));
  renderBlok2(); renderFooter();
}
async function bakAfsluiten(bakId){
  const bak=(DATA.bakken||[]).find(b=>b.id===bakId); if(!bak)return;
  const regels=bak.items.filter(it=>typeof waardeVan(bakId,it.id,it.aangetroffen)==='number')
    .map(it=>({item_id:it.id,aangetroffen:waardeVan(bakId,it.id,it.aangetroffen)}));
  try{
    await kvApi('POST','/bakken/'+bakId+'/tellen',{regels});
    bak.items.forEach(it=>{const v=waardeVan(bakId,it.id,it.aangetroffen);if(typeof v==='number')it.aangetroffen=v;});
    delete LOCAL[bakId];
    OPEN_BAK=null;
    renderBlok2(); renderFooter();
  }catch(e){ alert(e.message); }
}
async function zetAttr(attrId,klik){
  const attr=(DATA.attributen||[]).find(a=>a.id===attrId); if(!attr)return;
  const huidig=attrStatusVan(attrId,attr.status);
  const nieuw=huidig===klik?null:klik;
  ATTR_LOCAL[attrId]=nieuw;
  renderBlok2(); renderFooter();
  try{ await kvApi('POST','/attributen/'+attrId+'/status',{status:nieuw}); attr.status=nieuw; delete ATTR_LOCAL[attrId]; }
  catch(e){ alert(e.message); delete ATTR_LOCAL[attrId]; renderBlok2(); renderFooter(); }
}
function renderFooter(){
  const v=voortgang();
  document.getElementById('kv-voortgang-tekst').textContent=v.geteld+' van '+v.totBakken+' bakken geteld';
  document.getElementById('kv-balk-subtekst').textContent=v.klaar?'Alles nagekeken — klaar om te versturen':(v.attrGedaan+' van '+v.totAttr+' attributen afgevinkt');
  document.getElementById('kv-versturen-btn').style.background=v.klaar?'#1D9E75':'#9a9a95';
}
async function verstuurControle(){
  try{ await kvApi('POST','/versturen',{}); alert('Controle verstuurd. Bedankt!'); }
  catch(e){ alert(e.message); }
}

function renderBlok3(){
  const el=document.getElementById('kv-blok3');
  const rows=(DATA.aanvragen||[]).map(a=>{
    const map={nieuw:['#E6F1FB','#0C447C','Nieuw'],goedgekeurd:['#E1F5EE','#085041','Goedgekeurd'],afgewezen:['#FCEBEB','#791F1F','Afgewezen'],afgehandeld:['#f5f5f3','#6b6b67','Afgehandeld']};
    const c=map[a.status]||map.nieuw;
    return '<div class="card" style="padding:13px 14px;margin-bottom:8px">'
      +'<div style="display:flex;align-items:flex-start;gap:10px">'
      +'<div style="flex:1;min-width:0;font-size:15px;line-height:1.35">'+esc(a.tekst)+'</div>'
      +'<span class="pill" style="background:'+c[0]+';color:'+c[1]+'">'+c[2]+'</span></div>'
      +'<div style="font-size:12px;color:#9a9a95;margin-top:5px">'+esc((a.created_at||'').split(',')[0]||a.created_at||'')+'</div>'
      +(a.reden?'<div style="font-size:13px;line-height:1.45;color:#791F1F;background:#FCEBEB;border-radius:8px;padding:9px 11px;margin-top:9px">'+esc(a.reden)+'</div>':'')
      +'</div>';
  }).join('');
  el.innerHTML=
    '<div class="seclabel" style="margin-bottom:6px">Blok 3</div>'
    +'<div class="bloktitel">Iets nodig?</div>'
    +'<div class="blokintro">Vraag materiaal aan tijdens de week. Het kantoor ziet je aanvraag meteen.</div>'
    +'<div class="card" style="padding:14px;margin-top:12px">'
    +'<textarea id="kv-aanvraag-tekst" class="textarea" rows="3" placeholder="Wat heb je nodig? Bv. 10 hesjes maat S — de onze zijn te groot voor de kleuters."></textarea>'
    +'<button class="bigbtn" style="margin-top:10px;background:#1D9E75;color:#fff" onclick="verstuurAanvraag()">Aanvraag versturen</button></div>'
    +'<div class="seclabel" style="margin:20px 0 8px">Eerdere aanvragen</div>'
    +(rows||'<div style="color:#9a9a95;font-size:13px">Nog geen aanvragen.</div>');
}
async function verstuurAanvraag(){
  const ta=document.getElementById('kv-aanvraag-tekst');
  const tekst=(ta.value||'').trim(); if(!tekst)return;
  try{
    const a=await kvApi('POST','/aanvraag',{tekst});
    DATA.aanvragen.unshift(a);
    renderBlok3();
  }catch(e){ alert(e.message); }
}

function renderBlok4(){
  const el=document.getElementById('kv-blok4');
  el.innerHTML=
    '<div class="seclabel" style="margin-bottom:6px">Blok 4</div>'
    +'<div class="bloktitel">Iets kapot?</div>'
    +'<div class="blokintro">Los van de vrijdagcontrole. Meld het meteen, dan kan het kantoor vervanging klaarzetten.</div>'
    +(!KAPOT_OPEN
      ? '<button class="bigbtn" style="margin-top:12px;border:1.5px solid #F09595;background:#fff;color:#791F1F" onclick="KAPOT_OPEN=true;renderBlok4()">Kapot materiaal melden</button>'
      : '<div class="card" style="border-left:3px solid #E24B4A;padding:14px;margin-top:12px">'
        +'<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px">'
        +'<div style="font-size:15px;font-weight:600">Kapotmelding</div>'
        +'<button onclick="KAPOT_OPEN=false;renderBlok4()" style="border:none;background:transparent;font-size:20px;line-height:1;color:#6b6b67;cursor:pointer;padding:6px 8px">×</button></div>'
        +'<label style="display:block;font-size:12px;font-weight:600;color:#6b6b67;margin-bottom:6px">Wat is er kapot?</label>'
        +'<textarea id="kv-kapot-tekst" class="textarea" rows="3" placeholder="Bv. Muziekbox A01 — luidspreker kraakt, doet het niet meer op batterij."></textarea>'
        +'<label style="display:block;font-size:12px;font-weight:600;color:#6b6b67;margin:14px 0 6px">Foto</label>'
        +'<input type="file" accept="image/*" capture="environment" id="kv-kapot-file" style="display:none" onchange="kvKapotFotoGekozen(this)">'
        +'<button type="button" style="width:100%;min-height:88px;border:1.5px dashed rgba(0,0,0,.2);border-radius:10px;background:#f5f5f3;color:#6b6b67;font-size:14px;font-weight:500;cursor:pointer;padding:14px" onclick="document.getElementById(\\'kv-kapot-file\\').click()">'
        +(KAPOT_FOTO?'Foto toegevoegd — tik om een andere te nemen':'Tik om een foto te nemen')+'</button>'
        +'<button class="bigbtn" style="margin-top:12px;background:#E24B4A;color:#fff" onclick="verstuurKapot()">Melding versturen</button></div>');
}
function kvKapotFotoGekozen(inp){
  const f=inp.files&&inp.files[0]; if(!f)return;
  const reader=new FileReader();
  reader.onload=e=>{ KAPOT_FOTO=e.target.result; renderBlok4(); };
  reader.readAsDataURL(f);
}
async function verstuurKapot(){
  const ta=document.getElementById('kv-kapot-tekst');
  const tekst=(ta.value||'').trim();
  if(!tekst){alert('Vul eerst in wat er kapot is.');return;}
  try{
    await kvApi('POST','/kapot',{tekst,foto_data:KAPOT_FOTO||''});
    KAPOT_OPEN=false; KAPOT_FOTO=null;
    renderBlok4();
    alert('Kapotmelding verstuurd.');
  }catch(e){ alert(e.message); }
}

// S4.8: KV-boodschappenlijst — enkel lokaal in de sessie afvinkbaar (geen persistentie nodig).
function renderBlok5(){
  const el=document.getElementById('kv-blok5');
  const lijst=DATA.boodschappen||[];
  const gevinkt=lijst.filter(b=>BOODSCHAP_VINK[b.id]).length;
  const rijen=lijst.map(b=>{
    const aan=!!BOODSCHAP_VINK[b.id];
    return '<label style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:.5px solid rgba(0,0,0,.08);cursor:pointer">'
      +'<input type="checkbox" '+(aan?'checked':'')+' onchange="toggleBoodschap('+b.id+')" style="width:22px;height:22px;flex-shrink:0">'
      +'<span style="flex:1;font-size:15px;line-height:1.35;'+(aan?'text-decoration:line-through;color:#9a9a95':'')+'">'+esc(b.naam)+(b.qty>1?' <span style="color:#6b6b67">×'+b.qty+'</span>':'')+'</span>'
      +'</label>';
  }).join('');
  el.innerHTML=
    '<div class="seclabel" style="margin-bottom:6px">Blok 5</div>'
    +'<div class="bloktitel">Boodschappen</div>'
    +'<div class="blokintro">Verse waren die je zelf koopt voor dit thema. Afvinken helpt tijdens het winkelen — dit wordt niet bewaard.</div>'
    +'<div class="card" style="padding:14px;margin-top:12px">'
    +'<div style="font-size:13px;font-weight:600;color:#6b6b67;margin-bottom:4px">'+gevinkt+' van '+lijst.length+' afgevinkt</div>'
    +'<div>'+(rijen||'<div style="color:#9a9a95;font-size:13px">Geen boodschappen.</div>')+'</div></div>'
    +'<div style="font-size:12px;color:#6b6b67;margin-top:16px;line-height:1.5;text-align:center">Vraag een factuur: Sporty Creactief, E. Solvaystraat 2, 3010 Kessel-Lo (geen BTW-nummer)</div>';
}
function toggleBoodschap(id){ BOODSCHAP_VINK[id]=!BOODSCHAP_VINK[id]; renderBlok5(); }

init();
</script>
</body></html>`);
  });
```

