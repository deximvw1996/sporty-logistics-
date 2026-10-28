# Components

> **Geen component-framework.** De "componenten" van `D:\Sporty\sporty-railway\index.html` zijn herbruikbare CSS-klassen (één `<style>`-blok, regels 13-375) en vanilla-JS-functies die HTML-strings bouwen (`innerHTML`) of DOM-elementen aanmaken. Onderstaande fragmenten zijn letterlijk uit het bronbestand gekopieerd; elk fragment draagt pad + regelnummers. Rit- en KV-pagina (routes/transport.js, routes/kv.js) hebben hun eigen CSS en worden in layouts.md en extractable-components.md behandeld. Kleurtokens (`var(--green)` e.d.) staan in theme.md.

Inhoud: 1 Knoppen · 2 Formulieren/inputs · 3 Tabs & filterknoppen · 4 Kaarten & rijen · 5 Badges & status-pills · 6 Tabellen · 7 Toasts · 8 Modals & dialogen · 9 Lege-staat/laden · 10 Paginering · 11 Metrics · 12 Zoek-dropdown · 13 Kaart-pins & overige.

---

## 1. Knoppen

Varianten: `.btn-g` (groen primair, 32px), `.btn-b` (blauw), `.btn-r` (rood, 36px), `.btn-o` (outline, 28px), `.btn-del-sm` (rode outline, klein), `.btn-xs` (groen klein, 28px), `.bi` (icoon-knop zonder rand; `.bi.del` / `.bi.save`), `.nb` (navigatieknop), `.dag-pill` (kleine pil-knop), `.fb` (filter-pil).

**Icoon-knoppen (.bi) — `index.html:40-41`**

```css
.bi{background:transparent;border:none;cursor:pointer;padding:4px 5px;border-radius:4px;font-size:14px;color:var(--text2);font-family:inherit}
.bi:hover{background:var(--bg2)}.bi.del:hover{color:var(--red)}.bi.save{color:var(--green)}
```

**Tekstknoppen — `index.html:52-60`**

```css
.btn-g{background:var(--green);color:#fff;border:none;padding:0 14px;border-radius:var(--r);font-size:12px;cursor:pointer;font-weight:600;height:32px;font-family:inherit}
.btn-g:hover{background:#0F6E56}
.btn-b{background:var(--blue);color:#fff;border:none;padding:0 12px;border-radius:var(--r);font-size:12px;cursor:pointer;font-weight:600;height:32px;font-family:inherit}
.btn-b:hover{background:var(--blue-dk)}
.btn-r{background:var(--red);color:#fff;border:none;padding:0 14px;border-radius:var(--r);font-size:13px;cursor:pointer;font-weight:600;height:36px;font-family:inherit}
.btn-r:hover{background:#A32D2D}
.btn-o{background:transparent;border:.5px solid var(--border2);padding:0 10px;border-radius:var(--r);font-size:11px;cursor:pointer;height:28px;color:var(--text);font-family:inherit}
.btn-o:hover{background:var(--bg2)}
.btn-del-sm{background:transparent;border:.5px solid #F09595;padding:0 8px;border-radius:var(--r);font-size:11px;cursor:pointer;height:28px;color:#A32D2D;font-family:inherit}
```

**.btn-xs — `index.html:112-113`**

```css
.btn-xs{background:var(--green);color:#fff;border:none;padding:0 10px;border-radius:var(--r);font-size:11px;cursor:pointer;height:28px;font-family:inherit}
.btn-xs:hover{background:#0F6E56}
```

**.dag-pill — `index.html:72-76`**

```css
.dag-pill{font-size:10px;padding:3px 8px;border-radius:999px;font-weight:500;cursor:pointer;border:none;font-family:inherit}
.dag-open{background:var(--green-bg);color:var(--green-dk)}.dag-open:hover{background:#9FE1CB}
.dag-dicht{background:var(--bg3);color:var(--text3)}.dag-dicht:hover{background:#dddbd5}
.dag-feest{background:#F1EFE8;color:#B4B2A9;cursor:not-allowed}
.thema-tag{display:inline-flex;align-items:center;gap:5px;font-size:11px;padding:3px 9px;border-radius:999px;margin:2px;font-weight:500}
```

**Disabled-regel — `index.html:230-230`**

```css
button:disabled{opacity:.45;cursor:not-allowed;}
```

**Drag-handle — `index.html:295-296`**

```css
.drag-handle{cursor:grab;color:var(--text3);font-size:14px;padding:0 4px;user-select:none;}
.drag-handle:active{cursor:grabbing;}
```

Gebruik (HTML): `<button class="btn-g" onclick="...">Opslaan</button>`, `<button class="btn-o" ...>Annuleren</button>`, `<button class="btn-del-sm" ...>Verwijderen</button>`, icoon: `<button class="bi del" ...>🗑️</button>` — zie o.a. index.html:1338-1342 (modal-km) en 1282-1286 (modal-shift).

---

## 2. Formulieren / inputs

Basisinput `.inp`, select `.sel`, compacte `.ai` (add-rij), veldgroep `.fg` (label + control, varianten `.sm/.md/.grow`), rij `.fr`, `.add-row`, verplicht-sterretje `.req`, kleurkiezer-dots `.clr-dot`, radio-status `.tk-status-lbl`.

**.inp .sel .fr .fg — `index.html:42-51`**

```css
.inp{font-size:12px;border-radius:var(--r);border:.5px solid var(--border2);padding:5px 9px;background:var(--bg);color:var(--text);height:32px;font-family:inherit}
.inp:focus{outline:none;border-color:var(--green)}.inp.gb{border-color:#5DCAA5}
.sel{font-size:12px;border-radius:var(--r);border:.5px solid var(--border2);padding:5px 9px;background:var(--bg);color:var(--text);height:32px;font-family:inherit;cursor:pointer}
.sel:focus{outline:none;border-color:var(--green)}.sel.gb{border-color:#5DCAA5}
.fr{display:flex;gap:7px;flex-wrap:wrap;align-items:flex-end;margin-bottom:8px}
.fg{display:flex;flex-direction:column;gap:3px}
.fg label{font-size:11px;color:var(--text2);font-weight:500}
.fg.grow{flex:1;min-width:90px}
.fg.sm .inp{width:65px}.fg.sm .sel{width:80px}
.fg.md .inp,.fg.md .sel{width:140px}
```

**.add-row .ai — `index.html:108-111`**

```css
.add-row{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;align-items:center}
.ai{font-size:12px;height:28px;border-radius:var(--r);border:.5px solid var(--border2);padding:4px 8px;background:var(--bg);color:var(--text);font-family:inherit}
.ai:focus{outline:none;border-color:var(--green)}
.ai.grow{flex:1;min-width:90px}.ai.sm{width:52px}
```

**Focus-ring — `index.html:229-229`**

```css
.inp:focus,.sel:focus{box-shadow:0 0 0 3px rgba(29,158,117,.15);}
```

**Kleurdots, required, sel-cat — `index.html:285-292`**

```css
.clr-dot{display:inline-block;width:18px;height:18px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:transform .1s,border-color .1s;}
.clr-dot:hover{transform:scale(1.2);border-color:rgba(0,0,0,.2);}

/* Required field marker */
.inp:required:invalid{border-color:var(--red);}

/* Better select with category colors */
.sel-cat option{font-weight:500;}
```

**.req — `index.html:305-306`**

```css
/* Required asterisk */
.req{color:var(--red);font-size:11px;margin-left:2px;}
```

**Radio-status label — `index.html:268-269`**

```css
.tk-status-lbl{display:flex;align-items:center;gap:5px;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:12px;border:.5px solid var(--border);}
input[type=radio]:checked+.tk-status-lbl{font-weight:600;border-color:var(--green-dk);background:var(--green-bg);}
```

Voorbeeld-markup (formulier met veldgroepen, index.html:743-759):

**`index.html:743-759`**

```html
      <div class="card" style="margin-top:.75rem">
        <div class="card-hd">+ Nieuwe vaste bak aanmaken</div>
        <div class="fr">
          <div class="fg grow"><label>Naam (exemplaar)</label><input class="inp" id="vb-new-naam" placeholder="bv. EHBO-koffer #1"></div>
          <div class="fg md"><label>Soort (voor locatieconfig)</label><input class="inp" id="vb-new-vasttype" placeholder="bv. EHBO-koffer" list="vb-vasttype-lijst"><datalist id="vb-vasttype-lijst"></datalist></div>
          <div class="fg sm"><label>Code</label><input class="inp" id="vb-new-code" placeholder="bv. V01" style="width:80px"></div>
          <div class="fg md"><label>Type</label>
            <select class="sel" id="vb-new-type">
              <option value="vast">Vast materiaal</option>
              <option value="verbruik">Verbruik (wekelijks aanvullen)</option>
            </select>
          </div>
          <button class="btn-g" onclick="addVasteBak()">+ Aanmaken</button>
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px">💡 "Soort" groepeert exemplaren: maak bv. 3× een exemplaar met soort <b>EHBO-koffer</b> — in de locatieconfig kies je dan "EHBO-koffer ×2" en het transport pakt vrije exemplaren.</div>
      </div>
    </div>
```

Voorbeeld-markup (modal-formulier, index.html:1252-1281) staat onder §8.

---

## 3. Tabs en filterknoppen

- **Hoofdnavigatie** `.nav` / `.nb` (+ `.nb.active`, `.nb.red-tab.active`)
- **Subtabs** `.kal-subtab` (onderlijn-stijl)
- **Weergave-schakelaar** `.ov-view-btn` (segmented)
- **Filter-pillen** `.fb`, `.kal-loc-btn`

**Hoofdnavigatie — `index.html:19-23`**

```css
.nav{display:flex;gap:2px;padding:.5rem 1.25rem;border-bottom:.5px solid var(--border);flex-wrap:wrap}
.nb{padding:6px 10px;font-size:12px;border-radius:var(--r);cursor:pointer;border:.5px solid transparent;color:var(--text2);background:transparent;position:relative;font-family:inherit}
.nb:hover{background:var(--bg2)}
.nb.active{background:var(--green-bg);color:var(--green-dk);border-color:#5DCAA5;font-weight:500}
.nb.red-tab.active{background:var(--red-bg);color:var(--red-dk);border-color:#F09595}
```

**Subtabs — `index.html:172-175`**

```css
/* Kalender subtabs */
.kal-subtab{padding:6px 14px;font-size:12px;border:none;cursor:pointer;background:transparent;color:var(--text2);border-bottom:2px solid transparent;font-family:inherit;font-weight:500;}
.kal-subtab.active{color:var(--green-dk);border-bottom-color:var(--green);}
.kal-subtab:hover{color:var(--text);}
```

**Overzicht view-knoppen — `index.html:193-196`**

```css
/* Overzicht kalender */
.ov-view-btn{padding:5px 12px;font-size:11px;border:none;cursor:pointer;background:var(--bg);color:var(--text2);font-family:inherit;}
.ov-view-btn.active{background:var(--green-bg);color:var(--green-dk);font-weight:600;}
.ov-view-btn:hover{background:var(--bg2);}
```

**Filter-pillen — `index.html:143-146`**

```css
.filter-row{display:flex;gap:5px;margin-bottom:.875rem;flex-wrap:wrap;align-items:center}
.filter-lbl{font-size:11px;color:var(--text2)}
.fb{padding:4px 11px;font-size:11px;border-radius:999px;border:.5px solid var(--border2);cursor:pointer;background:var(--bg);color:var(--text2);font-family:inherit}
.fb.active{background:var(--green-bg);color:var(--green-dk);border-color:#5DCAA5;font-weight:500}
```

**Locatie-filterknoppen — `index.html:168-170`**

```css
.kal-loc-filter{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:.875rem;align-items:center;}
.kal-loc-btn{padding:3px 10px;font-size:11px;border-radius:999px;border:.5px solid var(--border2);cursor:pointer;background:var(--bg);color:var(--text2);font-family:inherit;}
.kal-loc-btn.active{font-weight:500;}
```

Subtab-balk (HTML, index.html:703-715):

**`index.html:703-715`**

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

Subtab-wissel (JS, index.html:2208-2217 — Kampplanner) en Materiaal (index.html:2041-2060):

**`index.html:2208-2217`**

```js
function setKampMode(mode,btn){
  _kampMode=mode;
  document.querySelectorAll('#sec-kampplanner .kal-subtab').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  ['rooster','locatie','week','thema','sport'].forEach(m=>{
    const el=document.getElementById('kp-'+m+'-content');
    if(el)el.style.display=m===mode?'block':'none';
  });
  _renderKampMode();
}
```

**`index.html:2041-2060`**

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

---

## 4. Kaarten en rijen

Varianten: `.card` + `.card-hd` (algemeen), `.km-card`/`.km-hd`/`.km-body` (kampmoment), `.exp-card`/`.exp-hd`/`.exp-body` (uitklapbaar), `.tp-taak` (transporttaak met gekleurde linkerrand per type), `.spoed-card` (prioriteitsrand), `.loc-overview`/`.lo-hd`/`.lo-body`, `.voorstel-card`, `.mat-block`, `.ov-loc-dag-card`; lijst-rijen `.row`, `.item-line`, `.hist-row`; `.thema-tag`.

**.card .row .dot .ri .rm .rs .ra — `index.html:32-39`**

```css
.card{background:var(--bg);border:.5px solid var(--border);border-radius:var(--rl);padding:.875rem 1.125rem;margin-bottom:.75rem}
.card-hd{font-size:11px;font-weight:600;color:var(--text2);margin-bottom:.75rem;text-transform:uppercase;letter-spacing:.05em}
.row{display:flex;align-items:center;gap:8px;padding:8px 10px;border:.5px solid var(--border);border-radius:var(--r);margin-bottom:5px;background:var(--bg)}
.row:hover{background:var(--bg2)}
.row.editing{background:var(--bg2);border-color:#5DCAA5}
.dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
.ri{flex:1;min-width:0}.rm{font-size:13px;font-weight:500}.rs{font-size:11px;color:var(--text2)}
.ra{display:flex;gap:4px;flex-shrink:0;align-items:center}
```

**.km-card — `index.html:68-71`**

```css
.km-card{border:.5px solid var(--border);border-radius:var(--rl);margin-bottom:.875rem;overflow:hidden}
.km-hd{display:flex;align-items:flex-start;gap:10px;padding:.875rem 1rem;cursor:pointer;background:var(--bg)}
.km-hd:hover{background:var(--bg2)}
.km-body{padding:.875rem 1rem;border-top:.5px solid var(--border)}
```

**.thema-tag .mat-block .mat-qty — `index.html:76-80`**

```css
.thema-tag{display:inline-flex;align-items:center;gap:5px;font-size:11px;padding:3px 9px;border-radius:999px;margin:2px;font-weight:500}
.mat-block{background:var(--bg2);border-radius:var(--r);padding:8px 10px;margin-bottom:6px;border-left:3px solid transparent}
.mat-block-title{font-size:11px;font-weight:600;margin-bottom:5px}
.mat-row{display:flex;align-items:center;gap:7px;padding:3px 0;font-size:12px}
.mat-qty{font-size:10px;background:var(--bg3);border-radius:999px;padding:1px 7px;color:var(--text2);min-width:24px;text-align:center}
```

**.exp-card — `index.html:95-98`**

```css
.exp-card{border:.5px solid var(--border);border-radius:var(--rl);margin-bottom:.625rem;overflow:hidden}
.exp-hd{display:flex;align-items:center;gap:9px;padding:.75rem 1rem;cursor:pointer;background:var(--bg)}
.exp-hd:hover{background:var(--bg2)}
.exp-body{padding:.875rem 1rem;border-top:.5px solid var(--border)}
```

**.tp-taak — `index.html:114-118`**

```css
.tp-taak{border:.5px solid var(--border);border-radius:var(--rl);margin-bottom:.625rem;overflow:hidden}
.tp-taak.levering{border-left:3px solid var(--green)}.tp-taak.ophaling{border-left:3px solid var(--blue)}.tp-taak.extra{border-left:3px solid var(--amber)}
.tp-hd{display:flex;align-items:center;gap:10px;padding:.75rem 1rem;background:var(--bg);cursor:pointer}
.tp-hd:hover{background:var(--bg2)}
.tp-body{padding:.875rem 1rem;border-top:.5px solid var(--border)}
```

**.spoed-card — `index.html:120-126`**

```css
.spoed-card{border-radius:var(--rl);margin-bottom:.625rem;border:.5px solid var(--border)}
.spoed-card.prio-hoog{border-left:3px solid var(--red)}.spoed-card.prio-midden{border-left:3px solid var(--amber)}.spoed-card.prio-laag{border-left:3px solid var(--blue)}.spoed-card.done-card{opacity:.55;border-left:3px solid var(--green)}
.s-hd{display:flex;align-items:flex-start;gap:10px;padding:.875rem 1rem}
.s-info{flex:1}.s-title{font-size:13px;font-weight:600;margin-bottom:2px}.s-title.done-txt{text-decoration:line-through;color:var(--text2)}
.s-meta{font-size:11px;color:var(--text2);display:flex;gap:8px;flex-wrap:wrap}
.s-note{font-size:12px;color:var(--text2);font-style:italic;margin-top:2px}
.s-actions{display:flex;gap:4px;align-items:flex-start;flex-wrap:wrap;justify-content:flex-end}
```

**.loc-overview .item-line — `index.html:127-133`**

```css
.loc-overview{border:.5px solid var(--border);border-radius:var(--rl);margin-bottom:.75rem;overflow:hidden}
.lo-hd{display:flex;align-items:center;gap:10px;padding:.875rem 1rem;cursor:pointer;background:var(--bg)}
.lo-hd:hover{background:var(--bg2)}
.lo-hd.stockage{border-left:3px solid #E65100}.lo-hd.kamp{border-left:3px solid var(--green)}
.lo-body{border-top:.5px solid var(--border);padding:.875rem 1rem}
.item-line{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:var(--r);margin-bottom:4px;border:.5px solid var(--border)}
.item-line:hover{background:var(--bg2)}
```

**.hist-row — `index.html:140-142`**

```css
.hist-row{display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:.5px solid var(--border)}
.hist-row:last-child{border-bottom:none}
.hist-dot{width:8px;height:8px;border-radius:50%;background:var(--green);flex-shrink:0;margin-top:4px}
```

**.voorstel-card — `index.html:147-148`**

```css
.voorstel-card{border:.5px solid #5DCAA5;border-radius:var(--rl);padding:.875rem 1rem;margin-bottom:.625rem;background:#FAFFFE}
.voorstel-card.ophaling-v{border-color:#85B7EB;background:#F8FBFF}
```

**.ov-loc-dag-card — `index.html:219-222`**

```css
.ov-dag-detail{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.ov-loc-dag-card{border:.5px solid var(--border);border-radius:var(--rl);padding:.75rem;background:var(--bg);}
.ov-loc-dag-card.kamp{border-color:#5DCAA5;background:#FAFFFE;}
.ov-loc-dag-card.dicht{border-color:var(--red);background:var(--red-bg);opacity:.7;}
```

**Hover/transition — `index.html:231-233`**

```css
.row{transition:background .1s;}
.km-card{transition:box-shadow .15s;}
.km-card:hover{box-shadow:0 2px 12px rgba(0,0,0,.08);}
```

**.loc-contact — `index.html:308-311`**

```css
/* Contact info in locatie card */
.loc-contact{font-size:11px;color:var(--text2);display:flex;gap:12px;margin-top:3px;flex-wrap:wrap;}
.loc-contact a{color:var(--blue);text-decoration:none;}
.loc-contact a:hover{text-decoration:underline;}
```

**JS-renderers voor kaart/rij** (rij met icoon + titel/subtitel + status-pill; kampmoment-rij met thema-tags):

**Aankomende transporten — rij (renderOverzicht, deel 1) — `index.html:2133-2155`**

```js
  // Aankomende transporten (next 7 days)
  const now=_appNow();
  const cutoff=_appNow();cutoff.setDate(cutoff.getDate()+7);
  const upcoming=taken
    .filter(t=>t.status!=='gedaan'&&t.datum)
    .filter(t=>{return t.datum>=isoLocal(now)&&t.datum<=isoLocal(cutoff);})
    .sort((a,b)=>a.datum.localeCompare(b.datum)||a.tijd.localeCompare(b.tijd))
    .slice(0,6);
  const tpEl=document.getElementById('ov-transporten');
  if(!upcoming.length){tpEl.innerHTML='<div class="empty">Geen transporten de komende week gepland.</div>';}
  else{
    tpEl.innerHTML='';
    upcoming.forEach(t=>{
      const van=S.locaties.find(l=>l.id===t.van_locatie_id);
      const naar=S.locaties.find(l=>l.id===t.naar_locatie_id);
      const icn={levering:'&#128994;',ophaling:'&#128309;',extra:'&#128993;',opdracht:'&#128203;'}[t.type]||'&#128230;';
      const stCls={gepland:'st-gepland',bevestigd:'st-bevestigd',gedaan:'st-gedaan'}[t.status]||'st-gepland';
      const row=document.createElement('div');row.className='row';
      row.innerHTML=`<span style="font-size:16px">${icn}</span><div class="ri"><div class="rm">${t.opmerking||t.type}</div><div class="rs">${fIso(t.datum)}${t.tijd?' \u00B7 '+t.tijd:''} \u00B7 ${van?.name||'?'} \u2192 ${naar?.name||'?'}${t.wie?' \u00B7 &#128100; '+t.wie:''}</div></div><span class="pill ${stCls}">${{gepland:'Gepland',bevestigd:'Bevestigd',gedaan:'Gedaan'}[t.status]||t.status}</span>`;
      row.onclick=()=>openEditTp(t.id);
      tpEl.appendChild(row);
    });
  }
```

**Kampmoment-rij (renderOverzicht, deel 2) — `index.html:2174-2186`**

```js
  document.getElementById('ov-kampen').innerHTML=simBanner+(sorted.length?sorted.map(km=>{
    const wd=getWeekDagen(km.week);
    const dStr=wd.length?fDag(wd[0])+'\u2013'+fDag(wd[wd.length-1]):'';
    const isTd=km.type==='themadag';
    const open=_isOpen(km);
    const thTags=isTd
      ? ['Ma','Di','Wo','Do','Vr'].map((lbl,i)=>{const t=(km.themas||[]).find(x=>x.dag===i);return t?`<span class="thema-tag" style="background:${t.color}22;color:${t.color}"><b>${lbl}</b>\u00A0${t.name}</span>`:`<span class="thema-tag" style="background:#eee;color:#999;border:.5px dashed #ccc">${lbl}\u00A0\u2014</span>`;}).join('')
      : (km.themas||[]).map(t=>`<span class="thema-tag" style="background:${t.color}22;color:${t.color}">${t.name}</span>`).join('');
    const badge=isTd?` <span class="pill p-amber" style="font-size:9px">\u{1F5D3} themadag</span>`:'';
    const openBadge=open?` <span class="pill" style="background:var(--green);color:#fff;font-size:9px">\u25CF OPEN</span>`:'';
    const cnt=isTd?((km.themas||[]).filter(t=>t.dag!=null).length+'/5 dagen'):((km.themas||[]).length+' thema\'s');
    return `<div class="row" style="flex-wrap:wrap;gap:6px${open?';background:var(--green-bg);border-color:var(--green)':''}"><div class="ri" style="min-width:180px"><div class="rm">Week ${km.week} \u00B7 ${dStr} \u2014 ${km.locatie?.name||'?'}${openBadge}${badge}</div><div class="rs">${(km.open_dagen||[]).length} open dagen \u00B7 ${cnt}</div></div><div style="display:flex;flex-wrap:wrap;gap:3px">${thTags}</div></div>`;
  }).join(''):'<div class="empty">Nog geen kampmomenten gepland.</div>');
```

---

## 5. Badges en status-pills

- `.pill` + kleurvarianten `.p-gray .p-green .p-red .p-amber .p-blue .p-stock`
- Status-varianten `.st-gepland .st-bevestigd .st-gedaan`
- Dag-pillen (`.dag-open/.dag-dicht/.dag-feest`), kalender-chips (`.dag-kamp-pill`, `.ov-kamp-chip`)
- Telbadges: `.badge` (rood bolletje op nav-knop), inline rode tellers (materiaal-badge, aanvragen)

**.badge — `index.html:24-24`**

```css
.badge{position:absolute;top:1px;right:1px;width:15px;height:15px;border-radius:50%;background:var(--red);color:#fff;font-size:9px;font-weight:700;display:none;align-items:center;justify-content:center}
```

**.pill + varianten — `index.html:63-66`**

```css
.pill{font-size:10px;padding:2px 8px;border-radius:999px;font-weight:500;white-space:nowrap}
.p-gray{background:var(--bg2);color:var(--text2)}.p-green{background:var(--green-bg);color:var(--green-dk)}
.p-red{background:var(--red-bg);color:var(--red-dk)}.p-amber{background:var(--amber-bg);color:var(--amber-dk)}
.p-blue{background:var(--blue-bg);color:var(--blue-dk)}.p-stock{background:#FFF3E0;color:#E65100}
```

**Status-varianten — `index.html:119-119`**

```css
.st-gepland{background:var(--amber-bg);color:var(--amber-dk)}.st-bevestigd{background:var(--blue-bg);color:var(--blue-dk)}.st-gedaan{background:var(--green-bg);color:var(--green-dk)}
```

**Kalender-chips — `index.html:163-167`**

```css
.dag-kamp-pill{font-size:9px;padding:1px 5px;border-radius:999px;font-weight:600;margin-bottom:2px;cursor:pointer;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;border:.5px solid transparent;}
.dag-kamp-pill:hover{opacity:.85;}
.dag-status{font-size:9px;display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:2px;vertical-align:1px;}
.dag-gesloten{background:var(--red-bg);border-radius:3px;padding:2px 4px;font-size:9px;color:var(--red-dk);margin-top:2px;}
.dag-feest{background:#F1EFE8;border-radius:3px;padding:2px 4px;font-size:9px;color:#B4B2A9;margin-top:2px;}
```

**Overzicht-chips — `index.html:204-209`**

```css
.ov-dag-nr{font-size:11px;font-weight:600;color:var(--text2);margin-bottom:3px;display:inline-block;width:20px;height:20px;line-height:20px;text-align:center;border-radius:50%;}
.ov-dag-nr.vandaag{background:var(--green);color:#fff;}
.ov-kamp-chip{font-size:9px;padding:1px 5px;border-radius:3px;font-weight:600;margin-bottom:2px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;}
.ov-kamp-chip:hover{opacity:.85;}
.ov-feest{font-size:9px;color:#B4B2A9;background:#F1EFE8;border-radius:3px;padding:1px 4px;margin-bottom:2px;display:block;}
.ov-gesloten{font-size:9px;color:var(--red-dk);background:var(--red-bg);border-radius:3px;padding:1px 4px;margin-bottom:2px;display:block;}
```

**Aanvragen-badge in topbalk — `index.html:3905-3909`**

```js
function updateAanvragenBadge(n){
  const b=document.getElementById('badge-spoed');if(b)b.style.display=n?'inline-block':'none';
  const bn=document.getElementById('badge-spoed-n');if(bn)bn.textContent=n;
  const ovSp=document.getElementById('ov-sp');if(ovSp)ovSp.textContent=n;
}
```

**Materiaal-badge in nav — `index.html:3223-3229`**

```js
async function updateMateriaalBadge(){
  const n=await _nakijkOpenAantal();
  const el=document.getElementById('materiaal-badge');
  if(el){el.textContent=n;el.style.display=n>0?'inline-block':'none';}
  const sub=document.getElementById('nakijken-subtab-badge');
  if(sub){sub.textContent=n;sub.style.display=n>0?'inline-block':'none';}
}
```

Pill-gebruik (JS-string): `<span class="pill ${stCls}">Gepland</span>` (index.html:2149-2151), `<span class="pill p-amber">🗓 themadag</span>` (2182), `<span class="pill ${l.type==='stockage'?'p-stock':'p-green'}">…</span>` (5322).

---

## 6. Tabellen

Er is geen DataTable-component; er zijn zes tabelstijlen, elk met eigen klasse: `.mat-table` (materiaal/catalogus), `.kal-table` / `.od-table` (open-dicht-kalender), `.rooster-table` (locaties × weken), `.maand-kal` / `.ov-maand-tbl` (maandkalender), `.ov-week-tbl`. Sticky eerste kolom `.loc-col`/`.loc-name`.

**.mat-table-wrap + .rooster-table — `index.html:253-263`**

```css
.mat-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;}
/* Rooster (locaties × weken) */
.rooster-table{border-collapse:collapse;width:auto}
.rooster-table th{background:var(--bg2);padding:5px 6px;text-align:center;font-size:11px;font-weight:600;color:var(--text2);border:.5px solid var(--border);position:sticky;top:0;z-index:2;white-space:nowrap}
.rooster-table th.loc-col{text-align:left;position:sticky;left:0;z-index:3;min-width:150px}
.rooster-table td{border:.5px solid var(--border);vertical-align:top}
.rooster-table td.loc-name{text-align:left;padding:5px 8px;font-weight:500;font-size:12px;white-space:nowrap;position:sticky;left:0;background:var(--bg);z-index:1}
.rooster-cell{text-align:center;padding:3px;cursor:pointer;min-width:96px;font-size:11px}
.rooster-cell.leeg{color:var(--text3);font-size:15px}
.rooster-cell:hover{background:var(--green-bg)}
.rooster-cell.vol:hover{outline:1.5px solid var(--green)}
```

**.mat-table — `index.html:313-320`**

```css
.mat-table{width:100%;border-collapse:collapse;font-size:12.5px}
.mat-table thead th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:var(--text2);font-weight:700;padding:6px 8px;border-bottom:1px solid var(--border2)}
.mat-table tbody td{padding:5px 8px;border-bottom:.5px solid var(--border);vertical-align:middle}
.mat-table tbody tr:hover td{background:var(--bg2)}
.mat-table tr.mat-grp td{background:var(--bg2);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text2);padding:7px 8px}
.mat-table tr.mat-grp:hover td{background:var(--bg2)}
.mat-table tr.mat-edit td,.mat-table tr.mat-edit:hover td{background:var(--bg2)}
.mat-table .bi{padding:2px 4px}
```

**.kal-table — `index.html:81-93`**

```css
/* Kalender */
.kal-table{border-collapse:collapse;width:100%;font-size:12px}
.kal-table th{background:var(--bg2);padding:5px 3px;text-align:center;font-weight:600;color:var(--text2);border:.5px solid var(--border)}
.kal-table th.loc-col{text-align:left;padding:6px 10px;min-width:140px;position:sticky;left:0;z-index:3;background:var(--bg2)}
.kal-table td{border:.5px solid var(--border);padding:0;text-align:center;vertical-align:middle}
.kal-table td.loc-name{text-align:left;padding:6px 10px;font-weight:500;font-size:12px;white-space:nowrap;position:sticky;left:0;background:var(--bg);z-index:1;border-right:.5px solid var(--border2)}
.kal-dag{width:40px;height:34px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:background .1s;gap:1px}
.kal-dag.open{background:var(--green-bg);color:var(--green-dk)}.kal-dag.open:hover{background:#9FE1CB}
.kal-dag.dicht{background:var(--red-bg);color:var(--red-dk)}.kal-dag.dicht:hover{background:#F7C1C1}
.kal-dag.feest{background:#F1EFE8;color:#B4B2A9;cursor:not-allowed}
.kal-dag.kamp{background:#E8F9F3;border:.5px solid #5DCAA5}
.kal-week-header td{background:var(--bg3);font-weight:600;font-size:11px;color:var(--text2);padding:4px 8px;text-align:left}
.kal-wrap{overflow-x:auto;border:.5px solid var(--border);border-radius:var(--rl)}
```

**.maand-kal — `index.html:155-166`**

```css
.maand-kal{width:100%;border-collapse:collapse;margin-bottom:1.5rem;}
.maand-kal th{background:var(--bg2);padding:6px 4px;text-align:center;font-size:11px;font-weight:600;color:var(--text2);border:.5px solid var(--border);width:calc(100%/7);}
.maand-kal td{border:.5px solid var(--border);vertical-align:top;padding:0;width:calc(100%/7);height:auto;}
.maand-kal td.buiten-maand{background:var(--bg3);}
.dag-vak{min-height:80px;padding:3px;}
.dag-nr{font-size:11px;font-weight:600;color:var(--text2);padding:2px 4px;border-radius:4px;display:inline-block;margin-bottom:3px;}
.dag-nr.vandaag{background:var(--green);color:#fff;}
.dag-nr.feestdag{color:#B4B2A9;}
.dag-kamp-pill{font-size:9px;padding:1px 5px;border-radius:999px;font-weight:600;margin-bottom:2px;cursor:pointer;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;border:.5px solid transparent;}
.dag-kamp-pill:hover{opacity:.85;}
.dag-status{font-size:9px;display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:2px;vertical-align:1px;}
.dag-gesloten{background:var(--red-bg);border-radius:3px;padding:2px 4px;font-size:9px;color:var(--red-dk);margin-top:2px;}
```

**.od-table — `index.html:177-191`**

```css
/* Open/dicht tabel */
.od-table{border-collapse:collapse;white-space:nowrap;font-size:11px;}
.od-table th{background:var(--bg2);padding:4px 3px;text-align:center;font-weight:600;color:var(--text2);border:.5px solid var(--border);position:sticky;top:0;z-index:2;}
.od-table th.loc-col{text-align:left;padding:6px 10px;min-width:130px;position:sticky;left:0;z-index:3;background:var(--bg2);}
.od-table td{border:.5px solid var(--border);padding:0;text-align:center;}
.od-table td.loc-name{text-align:left;padding:5px 10px;font-weight:500;font-size:12px;position:sticky;left:0;background:var(--bg);z-index:1;border-right:.5px solid var(--border2);}
.od-cel{width:36px;height:30px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;transition:background .1s;}
.od-cel.kamp{background:#E8F9F3;color:var(--green-dk);}
.od-cel.kamp:hover{background:#9FE1CB;}
.od-cel.open{background:var(--green-bg);color:var(--green-dk);}
.od-cel.open:hover{background:#9FE1CB;}
.od-cel.dicht{background:var(--red-bg);color:var(--red-dk);}
.od-cel.dicht:hover{background:#F7C1C1;}
.od-cel.feest{background:#F1EFE8;color:#B4B2A9;cursor:not-allowed;font-size:10px;}
.od-week-hd td{background:var(--bg3);font-weight:600;font-size:10px;color:var(--text2);padding:3px 8px;text-align:left;}
```

**.ov-maand-tbl / .ov-week-tbl — `index.html:198-217`**

```css
/* Maandoverzicht */
.ov-maand-tbl{width:100%;border-collapse:collapse;}
.ov-maand-tbl th{background:var(--bg2);padding:6px 4px;text-align:center;font-size:11px;font-weight:600;color:var(--text2);border:.5px solid var(--border);}
.ov-dag-vak{border:.5px solid var(--border);vertical-align:top;padding:0;}
.ov-dag-vak.buiten{background:var(--bg3);}
.ov-dag-inner{min-height:70px;padding:3px 4px;}
.ov-dag-nr{font-size:11px;font-weight:600;color:var(--text2);margin-bottom:3px;display:inline-block;width:20px;height:20px;line-height:20px;text-align:center;border-radius:50%;}
.ov-dag-nr.vandaag{background:var(--green);color:#fff;}
.ov-kamp-chip{font-size:9px;padding:1px 5px;border-radius:3px;font-weight:600;margin-bottom:2px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;}
.ov-kamp-chip:hover{opacity:.85;}
.ov-feest{font-size:9px;color:#B4B2A9;background:#F1EFE8;border-radius:3px;padding:1px 4px;margin-bottom:2px;display:block;}
.ov-gesloten{font-size:9px;color:var(--red-dk);background:var(--red-bg);border-radius:3px;padding:1px 4px;margin-bottom:2px;display:block;}

/* Week overzicht */
.ov-week-tbl{width:100%;border-collapse:collapse;}
.ov-week-tbl th{background:var(--bg2);padding:6px;text-align:center;font-size:11px;font-weight:600;color:var(--text2);border:.5px solid var(--border);}
.ov-week-tbl th.loc-col{text-align:left;min-width:120px;}
.ov-week-tbl td{border:.5px solid var(--border);padding:4px;vertical-align:top;min-width:100px;}
.ov-week-tbl td.loc-name-col{font-weight:500;font-size:12px;background:var(--bg2);position:sticky;left:0;}

```

**JS-render van een tabel** (catalogus: thead + tbody met groeprijen, bulkbalk en paginering, index.html:6143-6249 — hier de table-opbouw):

**renderCatalogusLijst — tabelmarkup — `index.html:6241-6249`**

```js
  el.innerHTML=bulkBar+`<div class="mat-table-wrap"><table class="mat-table">
    <thead><tr>
      <th style="width:30px;text-align:center"><input type="checkbox" id="cat-sel-all"${allChecked?' checked':''} onclick="catSelAllToggle()" title="Alles selecteren"></th>
      <th style="width:42px;text-align:center">Type</th><th>Naam</th><th>Context</th>
      <th style="width:74px;text-align:right">Aantal</th><th style="width:92px">Locatie</th><th style="width:84px">Opslag</th><th style="width:92px">Huidige</th><th style="width:64px"></th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}
```

**JS-render van het rooster** (locaties × weken, sticky kolom, klikbare cellen — index.html:1530-1570):

**renderRooster — `index.html:1530-1570`**

```js
function renderRooster(targetId){
  const el=document.getElementById(targetId||'rooster-content'); if(!el)return;
  const p=_activePeriode();
  const maxWk=_periodeMaxWeken(p);
  const locs=(S.locaties||[]).filter(l=>l.type==='kamp').sort((a,b)=>a.name.localeCompare(b.name,'nl'));
  if(!locs.length){ el.innerHTML='<div class="empty">Nog geen kamplocaties.</div>'; return; }
  const kmBy={};
  (S.kampmomenten||[]).forEach(km=>{ if(p.id&&km.periode_id&&km.periode_id!==p.id)return; kmBy[km.locatie_id+'_'+km.week]=km; });
  let head='<th class="loc-col">Locatie</th>';
  for(let w=1;w<=maxWk;w++){ const wd=getWeekDagen(w,p); const lbl=wd.length?fDag(wd[0]):''; head+=`<th>Week ${w}<div style="font-size:9px;font-weight:400;color:var(--text3)">${lbl}</div></th>`; }
  let body='';
  locs.forEach(l=>{
    let row=`<td class="loc-name">${_escH(l.name)}</td>`;
    for(let w=1;w<=maxWk;w++){
      const km=kmBy[l.id+'_'+w];
      if(km){
        const ths=(km.themas||[]);
        const namen=ths.map(t=>t.name).join(', ');
        let inner;
        if(_roosterCompact){
          inner = ths.length
            ? `<span class="thema-tag" style="background:${ths[0].color}22;color:${ths[0].color};max-width:78px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:middle">${_escH(ths[0].name)}</span>${ths.length>1?` <span style="font-size:10px;color:var(--text2);font-weight:600">+${ths.length-1}</span>`:''}`
            : '<span style="color:var(--text3);font-size:10px">geen thema</span>';
        } else {
          inner = ths.length?ths.map(t=>`<span class="thema-tag" style="background:${t.color}22;color:${t.color};display:block;margin:1px 0;white-space:normal">${_escH(t.name)}</span>`).join(''):'<span style="color:var(--text3);font-size:10px">geen thema</span>';
        }
        const clickFn = (targetId==='rooster-content-kp')
          ? `selectKpCell(${km.id})`
          : `openBewerkKampmoment(${km.id})`;
        row+=`<td class="rooster-cell vol" onclick="${clickFn}" title="${_attrH(namen||'Bewerk kampmoment')}">${inner}</td>`;
      } else {
        const clickFn = (targetId==='rooster-content-kp')
          ? `openNieuwKampmoment(${l.id},${w})`
          : `openNieuwKampmoment(${l.id},${w})`;
        row+=`<td class="rooster-cell leeg" onclick="${clickFn}" title="Kampmoment toevoegen (week ${w})">+</td>`;
      }
    }
    body+=`<tr>${row}</tr>`;
  });
  el.innerHTML=`<div style="overflow-x:auto"><table class="rooster-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}
```

---

## 7. Toasts

Container wordt on-demand aangemaakt (fixed rechtsonder, kolom). Types: `info | error | success | warn`; error blijft 5 s, rest 3 s; klik sluit. De kleuren zijn hardcoded in de functie.

**CSS — `index.html:301-303`**

```css
/* Toast improvement */
#toast-container{pointer-events:none;}
#toast-container>div{pointer-events:auto;}
```

**showToast(msg, type) — `index.html:3488-3500`**

```js
function showToast(msg, type){
  type=type||'info';
  let c=document.getElementById('toast-container');
  if(!c){c=document.createElement('div');c.id='toast-container';
    c.style.cssText='position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
    document.body.appendChild(c);}
  const t=document.createElement('div');
  const colors={info:'#378ADD',error:'#E24B4A',success:'#1D9E75',warn:'#EF9F27'};
  t.style.cssText='padding:10px 16px;border-radius:10px;color:#fff;font-size:13px;font-family:inherit;background:'+(colors[type]||colors.info)+';box-shadow:0 4px 16px rgba(0,0,0,.18);max-width:320px;pointer-events:auto;cursor:pointer;';
  t.textContent=msg;t.onclick=()=>t.remove();
  c.appendChild(t);
  setTimeout(()=>{t.style.transition='opacity .3s';t.style.opacity='0';setTimeout(()=>t.remove(),300);},type==='error'?5000:3000);
}
```

Gebruik: `showToast('Capaciteit bijgewerkt','success')` (index.html:2095), `showToast('Geef een naam op','warn')` (2105).

---

## 8. Modals en dialogen

Twee systemen:
1. **Statische `.modal-bg` + `.modal`** in de HTML (sluit met `closeModal(id)`, open met `openModal(id)`): modal-shift, modal-km, modal-transport, modal-rit, modal-periode, modal-thema-detail, modal-import-themas, modal-spoedtransport, modal-taak-splits (index.html:1246-1500) en nog 12 modals op index.html:8885-9112 (dagrapport, checklist, klaarzetten, kleurenborden, bak-beheer, bak-nakijk, inventaris, scan, terugkomst, loc-geschiedenis, cat-detail, item-historie). Persoon/shift-modals van Personeel gebruiken een eigen inline-stijl (index.html:641-697).
2. **`vraagModal(opties)`** — dynamisch dialoogvenster (Promise-gebaseerd, vervangt prompt/confirm) en `bevestig(tekst,opt)` erbovenop. Alle stijlen inline in de functie.

**Modal CSS — `index.html:134-139`**

```css
.modal-bg{display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:2000;align-items:center;justify-content:center}
.modal-bg.open{display:flex}
.modal{background:var(--bg);border-radius:var(--rl);padding:1.25rem;width:520px;max-width:95vw;max-height:88vh;overflow-y:auto;border:.5px solid var(--border)}
.modal-title{font-size:15px;font-weight:600;margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between}
.modal-close{background:transparent;border:none;font-size:18px;cursor:pointer;color:var(--text2);padding:2px 6px;border-radius:4px}
.modal-close:hover{background:var(--bg2)}
```

**Voorbeeld statische modal (modal-shift) — `index.html:1246-1288`**

```html
<div class="modal-bg" id="modal-shift">
  <div class="modal" style="width:460px;">
    <div class="modal-title">
      <span id="modal-shift-title">Shift toevoegen</span>
      <button class="modal-close" aria-label="Sluiten" onclick="closeModal('modal-shift')">&#x2715;</button>
    </div>
    <div class="fr">
      <div class="fg grow"><label for="sh-chauf">Chauffeur</label>
        <select class="sel" id="sh-chauf" style="width:100%"></select>
      </div>
    </div>
    <div class="fr">
      <div class="fg md"><label for="sh-datum">Datum</label>
        <input class="inp" type="date" id="sh-datum">
      </div>
      <div class="fg sm"><label for="sh-start">Van</label>
        <input class="inp" type="time" id="sh-start" value="08:00">
      </div>
      <div class="fg sm"><label for="sh-eind">Tot</label>
        <input class="inp" type="time" id="sh-eind" value="17:00">
      </div>
    </div>
    <div class="fr">
      <div class="fg md"><label for="sh-type">Type</label>
        <select class="sel" id="sh-type">
          <option value="vol">&#x1F7E2; Volledige dag</option>
          <option value="vm">&#x1F7E1; Voormiddag</option>
          <option value="nm">&#x1F7E1; Namiddag</option>
          <option value="standby">&#x1F537; Standby</option>
          <option value="vrij">&#x26AA; Vrij / afwezig</option>
        </select>
      </div>
      <div class="fg grow"><label for="sh-opmerking">Opmerking</label>
        <input class="inp" type="text" id="sh-opmerking" placeholder="bv. Keuring auto om 14u&#x2026;">
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:.75rem;">
      <button class="btn-g" style="flex:1" onclick="saveShift()">&#x1F4BE; Opslaan</button>
      <button class="btn-o" onclick="closeModal('modal-shift')">Annuleren</button>
      <button class="btn-del-sm" id="sh-delete-btn" style="display:none" onclick="deleteShift()">&#x1F5D1;&#xFE0F; Verwijderen</button>
    </div>
  </div>
</div>
```

**openModal / closeModal — `index.html:3910-3911`**

```js
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
```

**vraagModal + bevestig — `index.html:3421-3486`**

```js
// Eén herbruikbaar dialoogvenster i.p.v. prompt()/confirm(): geeft null bij annuleren/Escape/klik buiten, anders {veldnaam:waarde}.
// velden: [{naam,label,type:'text'|'number'|'textarea'|'select'|'checkbox'|'date',standaard,verplicht,opties:[{waarde,label}],hint}]
function vraagModal(o){
  o=o||{};
  return new Promise(resolve=>{
    const vorigeFocus=document.activeElement;
    const bg=document.createElement('div');
    bg.className='vraag-bg';
    bg.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:2600;display:flex;align-items:center;justify-content:center;padding:12px';
    const box=document.createElement('div');
    box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');
    box.style.cssText='background:var(--bg);border:.5px solid var(--border);border-radius:var(--rl);padding:1.25rem;width:440px;max-width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 10px 40px rgba(0,0,0,.25)';
    const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const velden=o.velden||[];
    const inpStijl='width:100%;font-size:14px;padding:8px 10px;min-height:40px;border:.5px solid var(--border2);border-radius:var(--r);background:var(--bg);color:var(--text);font-family:inherit';
    box.innerHTML=`<div style="font-size:16px;font-weight:600;margin-bottom:${o.tekst?'6':'12'}px">${esc(o.titel||'Bevestigen')}</div>`
      +(o.tekst?`<div style="font-size:13px;color:var(--text2);margin-bottom:12px;white-space:pre-line">${esc(o.tekst)}</div>`:'')
      +velden.map((f,i)=>{
        const id='vm-f-'+i,t=f.type||'text',lab=`<label for="${id}" style="display:block;font-size:12px;font-weight:600;color:var(--text2);margin-bottom:3px">${esc(f.label||f.naam)}${f.verplicht?' *':''}</label>`;
        let el;
        if(t==='textarea')el=`<textarea id="${id}" rows="3" style="${inpStijl}">${esc(f.standaard)}</textarea>`;
        else if(t==='select')el=`<select id="${id}" style="${inpStijl}">${(f.opties||[]).map(x=>`<option value="${esc(x.waarde)}"${String(x.waarde)===String(f.standaard)?' selected':''}>${esc(x.label)}</option>`).join('')}</select>`;
        else if(t==='checkbox')return `<label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:12px;min-height:32px;cursor:pointer"><input type="checkbox" id="${id}" ${f.standaard?'checked':''}> ${esc(f.label||f.naam)}</label>`;
        else el=`<input id="${id}" type="${t}" value="${esc(f.standaard)}" style="${inpStijl}"${t==='number'?' min="0"':''}>`;
        return `<div style="margin-bottom:12px">${lab}${el}${f.hint?`<div style="font-size:11px;color:var(--text3);margin-top:2px">${esc(f.hint)}</div>`:''}</div>`;
      }).join('')
      +`<div id="vm-fout" style="display:none;color:var(--red,#b42318);font-size:12px;margin-bottom:8px"></div>`
      +`<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:4px">
        <button type="button" class="btn-o" id="vm-annuleer" style="min-height:44px;padding:0 16px">${esc(o.annuleerTekst||'Annuleren')}</button>
        <button type="button" class="${o.gevaarlijk?'btn-r':'btn-g'}" id="vm-ok" style="min-height:44px;padding:0 16px;${o.gevaarlijk?'background:#b42318;color:#fff;border-color:#b42318':''}">${esc(o.bevestigTekst||'Bevestigen')}</button></div>`;
    bg.appendChild(box);document.body.appendChild(bg);
    const sluit=r=>{document.removeEventListener('keydown',toets,true);bg.remove();try{vorigeFocus&&vorigeFocus.focus&&vorigeFocus.focus();}catch(e){}resolve(r);};
    const lees=()=>{
      const r={};
      for(let i=0;i<velden.length;i++){
        const f=velden[i],e=document.getElementById('vm-f-'+i),t=f.type||'text';
        let v=t==='checkbox'?e.checked:e.value;
        if(t==='number')v=v===''?null:Number(v);
        else if(typeof v==='string'&&t!=='textarea')v=v.trim();
        else if(typeof v==='string')v=v.trim();
        if(f.verplicht&&(v===''||v===null||v===false&&t!=='checkbox')){
          const m=document.getElementById('vm-fout');m.textContent=(f.label||f.naam)+' is verplicht.';m.style.display='block';e.focus();return undefined;
        }
        r[f.naam]=v;
      }
      return r;
    };
    const ok=()=>{const r=lees();if(r!==undefined)sluit(r);};
    function toets(ev){
      if(ev.key==='Escape'){ev.preventDefault();ev.stopPropagation();sluit(null);}
      else if(ev.key==='Enter'&&!(ev.target&&ev.target.tagName==='TEXTAREA')){ev.preventDefault();ev.stopPropagation();ok();}
    }
    document.addEventListener('keydown',toets,true);
    bg.addEventListener('mousedown',e=>{if(e.target===bg)sluit(null);});
    box.querySelector('#vm-annuleer').onclick=()=>sluit(null);
    box.querySelector('#vm-ok').onclick=ok;
    const eerste=box.querySelector('input:not([type=checkbox]),textarea,select')||box.querySelector('#vm-ok');
    setTimeout(()=>{eerste.focus();if(eerste.select&&eerste.tagName==='INPUT')eerste.select();},0);
  });
}
// Ja/nee-bevestiging bovenop vraagModal: true bij bevestigen, false bij annuleren.
async function bevestig(tekst,opt){
  opt=opt||{};
  const r=await vraagModal({titel:opt.titel||'Weet je het zeker?',tekst,bevestigTekst:opt.bevestigTekst||'Ja, doorgaan',gevaarlijk:opt.gevaarlijk!==false});
  return r!==null;
}
```

vraagModal-opties: `{titel, tekst, velden:[{naam,label,type:'text'|'number'|'textarea'|'select'|'checkbox'|'date',standaard,verplicht,opties:[{waarde,label}],hint}], bevestigTekst, annuleerTekst, gevaarlijk}`; resolve = `null` (annuleren/Escape/klik buiten) of `{naam:waarde}`. `bevestig(tekst,{titel,bevestigTekst,gevaarlijk})` → `true/false`.

---

## 9. Lege-staat- en laad-blokken

Twee klassen, geen eigen JS-functie: `.empty` en `.loading` (gecentreerde grijze tekst, 13px). 49 voorkomens van `class="empty"`.

**CSS — `index.html:149-150`**

```css
.empty{text-align:center;padding:1.5rem;color:var(--text2);font-size:13px}
.loading{text-align:center;padding:1.5rem;color:var(--text2);font-size:13px}
```

Voorbeelden (HTML-strings): `<div class="empty">Geen transporten de komende week gepland.</div>` (index.html:2142), `<div class="empty">Nog geen kampmomenten gepland.</div>` (2186), `<div class="loading">Laden&hellip;</div>` (545), `<div class="empty">Selecteer een locatie links.</div>` (548). Met actieknop: `<div class="empty">Conflicten laden mislukt: … <button class="btn-o btn-xs" onclick="checkConflicten()">Opnieuw proberen</button></div>` (1869). "Alles OK"-variant als groen vlak: index.html:1872.

---

## 10. Paginering

**CSS — `index.html:246-252`**

```css
/* Paginering (catalogus + thema's) */
.pager{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 2px;font-size:12px;color:var(--text2);}
.pager .pager-nav{display:flex;align-items:center;gap:6px;}
.pager .pager-pg{min-width:58px;text-align:center;font-variant-numeric:tabular-nums;}
.pager .pager-per{display:flex;align-items:center;gap:5px;}
.pager .btn-o{height:30px;min-width:36px;padding:0 10px;}
.pager select{height:30px;}
```

**_pagerBar(prefix,page,perPage,total) — `index.html:5884-5901`**

```js
function _pagerBar(prefix,page,perPage,total){
  if(!total) return '';
  const totalPages=Math.max(1,Math.ceil(total/perPage));
  if(page>totalPages)page=totalPages; if(page<1)page=1;
  const from=(page-1)*perPage+1, to=Math.min(total,page*perPage);
  const opts=[10,20,50,100].map(n=>`<option value="${n}"${perPage===n?' selected':''}>${n}</option>`).join('');
  return `<div class="pager">
    <span>${from}–${to} van ${total}</span>
    <span style="flex:1"></span>
    <label class="pager-per">Per pagina <select class="sel" onchange="${prefix}SetPerPage(this.value)">${opts}</select></label>
    <div class="pager-nav">
      <button class="btn-o" ${page<=1?'disabled':''} onclick="${prefix}GoPage(${page-1})" title="Vorige">‹</button>
      <span class="pager-pg">${page} / ${totalPages}</span>
      <button class="btn-o" ${page>=totalPages?'disabled':''} onclick="${prefix}GoPage(${page+1})" title="Volgende">›</button>
    </div>
  </div>`;
}
function catGoPage(p){_catPage=Math.max(1,p|0);renderCatalogusLijst();}
```

Verwacht globale handlers `<prefix>GoPage(p)` en `<prefix>SetPerPage(n)` (zie `catGoPage`/`themaGoPage`, index.html:5902-5905); wordt gebruikt voor catalogus (`cat`), thema's (`thema`) en themabakken (`tb`, index.html:2528-2529).

---

## 11. Metric-tegels

**CSS — `index.html:27-31`**

```css
.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:1rem}
.metric{background:var(--bg2);border-radius:var(--r);padding:.625rem .875rem}
.metric-label{font-size:11px;color:var(--text2);margin-bottom:2px}
.metric-val{font-size:19px;font-weight:600}
.g{color:var(--green-dk)}.r{color:#A32D2D}.a{color:#854F0B}.b{color:var(--blue-dk)}
```

**HTML (4 tegels) — `index.html:464-469`**

```html
      <div class="metrics">
        <div class="metric"><div class="metric-label">Kamplocaties</div><div class="metric-val g" id="ov-loc">—</div></div>
        <div class="metric"><div class="metric-label">Kampmomenten</div><div class="metric-val b" id="ov-km">—</div></div>
        <div class="metric"><div class="metric-label">Transporten gepland</div><div class="metric-val" id="ov-tp">—</div></div>
        <div class="metric" style="cursor:pointer" onclick="goTo('transport-noden')" title="Naar de aanvragen"><div class="metric-label">Nieuwe aanvragen</div><div class="metric-val r" id="ov-sp">—</div></div>
      </div>
```

Waarden worden gevuld met `document.getElementById('ov-loc').textContent=…` (index.html:2125-2129). Kleurklassen `.g .r .a .b` op `.metric-val`.

---

## 12. Globale zoek-dropdown (topbalk)

HTML staat in de topbalk (index.html:423-426); resultaatlijst volledig inline gestijld.

**globalSearch(q) — `index.html:8833-8862`**

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
```

---

## 13. Overige herbruikbare stukken

Kaart-pins (Leaflet divIcon), kalendercellen, scroll-wrap en print/QR:

**Kaart-pins — `index.html:234-238`**

```css
#kaart-map{height:420px;border-radius:var(--rl);border:.5px solid var(--border);overflow:hidden;}
.loc-kaart-pin{background:var(--green-dk);color:#fff;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.25);}
.loc-kaart-pin.stockage{background:#E65100;}
.loc-kaart-num{background:var(--green);color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.4);}
.loc-kaart-num.sm{width:20px;height:20px;font-size:11px;display:inline-flex;margin-right:6px;vertical-align:middle;flex:0 0 auto;}
```

**QR/foto/regel — `index.html:264-266`**

```css
.qr-print-wrap{display:flex;flex-direction:column;align-items:center;gap:.5rem;}
.sport-foto{width:100%;max-height:110px;object-fit:cover;border-radius:6px;margin-bottom:8px;cursor:pointer;}
.tk-regel{padding:8px 0;border-bottom:.5px solid var(--border);}
```

**Thema-swatch — `index.html:298-299`**

```css
/* Theme color swatch in list */
.thema-swatch{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-1px;margin-right:4px;}
```

**Planner-weekgrid cel-rand — `index.html:152-153`**

```css
/* Planner week kalender */
#pl-kalender-grid > div { border: .5px solid var(--border); }
```

**Open/dicht cellen — `index.html:183-191`**

```css
.od-cel{width:36px;height:30px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;transition:background .1s;}
.od-cel.kamp{background:#E8F9F3;color:var(--green-dk);}
.od-cel.kamp:hover{background:#9FE1CB;}
.od-cel.open{background:var(--green-bg);color:var(--green-dk);}
.od-cel.open:hover{background:#9FE1CB;}
.od-cel.dicht{background:var(--red-bg);color:var(--red-dk);}
.od-cel.dicht:hover{background:#F7C1C1;}
.od-cel.feest{background:#F1EFE8;color:#B4B2A9;cursor:not-allowed;font-size:10px;}
.od-week-hd td{background:var(--bg3);font-weight:600;font-size:10px;color:var(--text2);padding:3px 8px;text-align:left;}
```

**Kalender-dag cellen — `index.html:87-91`**

```css
.kal-dag{width:40px;height:34px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:background .1s;gap:1px}
.kal-dag.open{background:var(--green-bg);color:var(--green-dk)}.kal-dag.open:hover{background:#9FE1CB}
.kal-dag.dicht{background:var(--red-bg);color:var(--red-dk)}.kal-dag.dicht:hover{background:#F7C1C1}
.kal-dag.feest{background:#F1EFE8;color:#B4B2A9;cursor:not-allowed}
.kal-dag.kamp{background:#E8F9F3;border:.5px solid #5DCAA5}
```

