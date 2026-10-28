# Theme

> Bron: `D:\Sporty\sporty-railway\index.html` (één `<style>`-blok, regels 13-375), en de inline `<style>`-blokken van `routes/transport.js` (rit-pagina) en `routes/kv.js` (KV-pagina). Er is geen Tailwind, geen CSS-framework, geen webfont en geen build-stap. De kantoor-app thematiseert via CSS custom properties op `:root` met een donkere variant op `[data-theme="dark"]`; de rit- en KV-pagina hebben alleen hardcoded hex-kleuren (geen variabelen, geen donkere modus).

# Deel 1 — Compacte tokens

## 1.1 Kleurtokens (kantoor-app, `:root`, index.html:14)

| Token | Licht | Donker (`[data-theme="dark"]`, index.html:366-374) | Gebruik |
|---|---|---|---|
| `--bg` | `#fff` | `#1a1a18` | app-achtergrond, kaarten, modals, inputs |
| `--bg2` | `#f5f5f3` | `#242422` | body-achtergrond, hover-rijen, metric-tegels, tabelkoppen |
| `--bg3` | `#eceae4` | `#2e2e2c` | week-koprijen, "dicht"-pillen, scrollbar-track, voortgangsbalk-achtergrond |
| `--text` | `#1a1a18` | `#e8e8e4` | hoofdtekst |
| `--text2` | `#6b6b67` | `#a0a09c` | labels, secundaire tekst |
| `--text3` | `#9a9a95` | `#6b6b67` | hints, uitgeschakeld, placeholders |
| `--border` | `rgba(0,0,0,.11)` | `rgba(255,255,255,.1)` | standaard rand (altijd `.5px solid`) |
| `--border2` | `rgba(0,0,0,.2)` | `rgba(255,255,255,.2)` | rand van inputs/knoppen |
| `--green` | `#1D9E75` | `#1D9E75` | primair (logo, `.btn-g`, actieve states, focus) |
| `--green-bg` | `#E1F5EE` | `#0d3d2e` | actieve nav/tab, "open", geslaagd |
| `--green-dk` | `#085041` | `#4dcaa5` | tekst op green-bg |
| `--red` | `#E24B4A` | `#E24B4A` | badge, gevaar-knop, fout |
| `--red-bg` | `#FCEBEB` | `#3d1515` | dicht, conflict, fout-achtergrond |
| `--red-dk` | `#791F1F` | `#f09595` | tekst op red-bg |
| `--amber` | `#EF9F27` | `#EF9F27` | waarschuwing, tijdmachine, gepland |
| `--amber-bg` | `#FAEEDA` | `#3d2c0d` | waarschuwingsvlak, status gepland |
| `--amber-dk` | `#633806` | `#f0c57a` | tekst op amber-bg |
| `--blue` | `#378ADD` | `#378ADD` | info, `.btn-b`, links |
| `--blue-bg` | `#E6F1FB` | `#0c2640` | status bevestigd, info-vlak |
| `--blue-dk` | `#0C447C` | `#85b7eb` | tekst op blue-bg |

Utility-tekstkleuren (index.html:31): `.g` = `var(--green-dk)`, `.r` = `#A32D2D`, `.a` = `#854F0B`, `.b` = `var(--blue-dk)`.

Hardcoded kleuren buiten de tokens in index.html (komen herhaaldelijk voor, geen variabele): `#5DCAA5` (groene rand/actieve border), `#0F6E56` (groene hover), `#9FE1CB` (open-hover), `#E8F9F3` / `#FAFFFE` (kamp-/voorstelachtergrond), `#F7C1C1` (dicht-hover), `#F09595` (rode rand), `#A32D2D` (rode tekst/hover), `#F1EFE8` + `#B4B2A9` (feestdag), `#dddbd5` (dicht-hover), `#E65100` + `#FFF3E0` (stockage-oranje), `#85B7EB` / `#F8FBFF` (ophaling-voorstel), `#854F0B` (amber tekst). Dark mode overschrijft deze hardcoded kleuren NIET.

Toast-kleuren (inline in `showToast`, index.html:3495): info `#378ADD`, error `#E24B4A`, success `#1D9E75`, warn `#EF9F27`; tekst wit.
`vraagModal` gevaar-knop: `#b42318` (index.html:3450). Thema-kleuren per thema komen uit de database (`t.color`) en worden als `${color}22` achtergrond + `${color}` tekst gebruikt.
`<meta name="theme-color">` = `#2563eb` (index.html:7) — wijkt af van het groene merkcolor.

## 1.2 Typografie

- Font (kantoor-app, index.html:15): `-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif` — geen webfont geladen. Knoppen/inputs erven via `font-family:inherit`.
- Rit-pagina (routes/transport.js:1150): `system-ui,sans-serif`.
- KV-pagina (routes/kv.js:150): `-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif` + `-webkit-font-smoothing:antialiased`; codes in `ui-monospace,SFMono-Regular,Menlo,monospace` (12px/600).
- Groottes in index.html-CSS (aantal voorkomens): 9px (8), 10px (10), 11px (30), 12px (20), 12.5px (1, mat-table), 13px (6), 14px (3), 15px (2), 16px (3), 18px (1), 19px (1, `.metric-val`). Inline stijlen gebruiken dezelfde reeks; titel topbalk 15px/600; modaltitel 15px/600 (vraagModal 16px/600); sectie-labels 11px/600 uppercase met `letter-spacing:.05em`.
- Gewichten: 400 (default), 500 (labels, nav actief, pills), 600 (titels, knoppen, metrics), 700 (tabelkoppen, badges, uppercase koppen).
- Op ≤700px krijgen `.inp,.sel,.ai,input,select,textarea` `font-size:16px!important` (voorkomt iOS-zoom, index.html:278).
- Cijfers in tabellen: `font-variant-numeric:tabular-nums` (themalijst, pager).

## 1.3 Maten, ruimte, radius, schaduw

- Radius: `--r:8px` (knoppen, inputs, rijen), `--rl:12px` (kaarten, modals, secties); pills `999px`; ronde dots/badges `50%`; kleine accenten `3px/4px/6px`.
- Containerbreedte: `.app{max-width:960px;margin:0 auto}`; `.content{padding:1.25rem}` (mobiel `.75rem`/`.625rem`).
- Controlehoogtes: input/select `32px` (`.inp/.sel`), compact `28px` (`.ai`, `.btn-o`, `.btn-xs`), `.btn-g/.btn-b` `32px`, `.btn-r` `36px`, login `38px`, vraagModal-knoppen `min-height:44px`, rit-knoppen `48px`, KV-grote knop `50px`, KV-teller `46px`.
- Gaps: 2/4/5/6/7/8/10/12px; kaart-marge onder `.75rem`; `.row` padding `8px 10px`.
- Schaduwen: app-rand `0 0 0 .5px var(--border)`; focus-ring `0 0 0 3px rgba(29,158,117,.15)`; kamp-kaart hover `0 2px 12px rgba(0,0,0,.08)`; kaart-pin `0 2px 6px rgba(0,0,0,.25)`; nummer-pin `0 1px 5px rgba(0,0,0,.4)`; zoekresultaten `0 4px 16px rgba(0,0,0,.12)`; toast `0 4px 16px rgba(0,0,0,.18)`; vraagModal `0 10px 40px rgba(0,0,0,.25)`; persoon-modal `0 8px 32px #0004`.
- Randen: altijd `.5px solid var(--border)` (hairline), accentranden `3px solid <kleur>` links op kaarten (levering groen / ophaling blauw / extra amber / prio rood-amber-blauw).
- Overlay: `.modal-bg` `rgba(0,0,0,.4)`; vraagModal `rgba(0,0,0,.45)`; persoon/shift-modals `#0008`.
- z-index: sticky tabelkop 1-3, zoekresultaten 200, bulkbalk 10, persoon-modals 1000, `.modal-bg` 2000, vraagModal 2600, loginscherm 5000, toasts 9999.
- Scrollbar: 6px, thumb `var(--border2)`.

## 1.4 Breakpoints

| Query | Effect | Regels |
|---|---|---|
| `min-width:760px` | Locaties: lijst en detail scrollen apart (`calc(100vh - 150px)`) | 240-245 |
| `max-width:700px` | metrics 2 kolommen, dag-detail 1 kolom, kleinere paddings, 16px inputs, `.fg.grow` volle breedte | 270-281 |
| `max-width:600px` | `.app` volle breedte zonder schaduw, tabellen scrollen horizontaal, `.fr` stapelt, modals 95vw, nav-knoppen kleiner, periode-label verkort | 322-359 |
| `max-width:400px` | nav-knoppen 10px, content-padding .5rem | 360-364 |

Rit- en KV-pagina: geen media queries; mobile-first met `<meta viewport>`.

## 1.5 Hardcoded kleuren in de rit-pagina (routes/transport.js:1150-1167)

| Waarde | Gebruik |
|---|---|
| `#f5f5f5` / `#1a1a1a` | body achtergrond / tekst |
| `#2563eb` | header-achtergrond (`.hdr`), stop-rand links, stoptype-tekst, tijd, rek-label |
| `#fff` | header-tekst, stop-/check-kaarten, knoppen |
| `#666` / `#888` / `#aaa` | sectiekop & route-tekst / aantal & notitie / footer |
| `#e5e5e5` | sectiekop-onderlijn |
| `#22c55e` + `#f0fff4` | check status ok (rand + vlak) |
| `#ef4444` + `#fff1f1` | check status ontbreekt |
| `#f59e0b` + `#fffbeb` | check status deels |
| `#cbd5e1` / `#334155` | fase-knop rand / tekst |
| `#dcfce7` / `#166534` | fase-knop done: vlak / tekst (rand `#22c55e`) |
| `#16a34a` / `#dc2626` | toast goed / fout |
| radius | stops 6px, knoppen 8px, toast 10px; knophoogte min 48px |

## 1.6 Hardcoded kleuren in de KV-pagina (routes/kv.js:148-166 en de render-strings 196-493)

| Waarde | Gebruik |
|---|---|
| `#f5f5f3` / `#1a1a18` | body achtergrond / tekst (zelfde als `--bg2`/`--text`) |
| `#6b6b67` / `#9a9a95` | secundaire / tertiaire tekst |
| `#fff` | kaarten, sticky header/footer |
| `rgba(0,0,0,.11)` / `rgba(0,0,0,.2)` / `rgba(0,0,0,.08)` / `rgba(0,0,0,.15)` | randen (kaart, input, scheidingslijn) |
| `#1D9E75` | logo-blok, voortgangsbalk, actieve verstuurknop, "Aanvraag versturen" |
| `#E1F5EE` + `#085041` | actieve tabpill, "Geteld", "Klopt", aanwezig |
| `#FAEEDA` + `#633806` | "x te weinig" (amber) |
| `#E6F1FB` + `#0C447C` | "n/m geteld", "te veel", status Nieuw |
| `#FCEBEB` + `#791F1F` | beschadigd, afgewezen, redenblok |
| `#E24B4A` | kapot-knop, rode kaartrand, beschadigd-rand |
| `#EF9F27` / `#5DCAA5` | tekort-rand / correct-rand teller |
| `#F09595` | rand "Kapot materiaal melden" |
| `#eceae4` | voortgangsbalk-achtergrond |
| `#9a9a95` | verstuurknop als niet klaar |
| radius | kaarten 12px, knoppen 10px, pills 999px, code-badge 5px |

# Deel 2 — Ruwe globale CSS van index.html (letterlijk)

Basis, `:root`, shell, utilities (gedeeld door alle schermen):

**Reset + :root + shell — `index.html:13-31`**

```css
*{box-sizing:border-box;margin:0;padding:0}
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

Laad-/scrollbar-polish en globale hover/focus:

**`index.html:225-233`**

```css
/* Loading & polish */
::-webkit-scrollbar{width:6px;height:6px;}
::-webkit-scrollbar-track{background:var(--bg2);}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px;}
.inp:focus,.sel:focus{box-shadow:0 0 0 3px rgba(29,158,117,.15);}
button:disabled{opacity:.45;cursor:not-allowed;}
.row{transition:background .1s;}
.km-card{transition:box-shadow .15s;}
.km-card:hover{box-shadow:0 2px 12px rgba(0,0,0,.08);}
```

Responsive overrides:

**min-width:760px — `index.html:240-245`**

```css
@media(min-width:760px){
  #sec-planning .loc-split{height:calc(100vh - 150px);}
  #sec-planning .loc-col-list{display:flex;flex-direction:column;height:100%;}
  #sec-planning #loc-tab-list{flex:1 1 auto;overflow-y:auto;overflow-x:hidden;padding-right:6px;}
  #sec-planning .loc-col-detail{height:100%;overflow-y:auto;overflow-x:hidden;padding-right:6px;}
}
```

**max-width:700px — `index.html:270-281`**

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

**max-width:600px / 400px — `index.html:322-364`**

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

Donkere modus:

**`index.html:366-374`**

```css
[data-theme="dark"]{
  --bg:#1a1a18;--bg2:#242422;--bg3:#2e2e2c;
  --text:#e8e8e4;--text2:#a0a09c;--text3:#6b6b67;
  --border:rgba(255,255,255,.1);--border2:rgba(255,255,255,.2);
  --green:#1D9E75;--green-bg:#0d3d2e;--green-dk:#4dcaa5;
  --red:#E24B4A;--red-bg:#3d1515;--red-dk:#f09595;
  --amber:#EF9F27;--amber-bg:#3d2c0d;--amber-dk:#f0c57a;
  --blue:#378ADD;--blue-bg:#0c2640;--blue-dk:#85b7eb;
}
```

Toggle-logica (donkere modus) — index.html:8866-8882:

**`index.html:8866-8882`**

```js
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

> De component-specifieke CSS (knoppen, kaarten, tabellen, pills, modals, formulieren, kalender) staat in components.md.
