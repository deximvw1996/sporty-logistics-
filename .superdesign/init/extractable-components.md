# Extractable components

> Catalogus van herbruikbare onderdelen die uit de drie bronnen te halen zijn:
> - **IDX** = `D:\Sporty\sporty-railway\index.html` (kantoor-app; vanilla JS + CSS-klassen, regelnummers hieronder)
> - **RIT** = `D:\Sporty\sporty-railway\routes\transport.js` (chauffeurspagina `/rit/:token`, regels 1101-1206; template-string)
> - **KV** = `D:\Sporty\sporty-railway\routes\kv.js` (KV-pagina `/kv/:token`, regels 143-496; template-string)
>
> Categorie: **layout** = bepaalt paginastructuur/navigatie; **basic** = herbruikbaar bouwblokje. "Hardcoded" = wat nu in de markup/JS-string staat en dus bij extractie een prop zou moeten worden. Er is geen component-systeem: alles is HTML-string-sjablonen + globale CSS-klassen; "props" zijn de variabelen die in de huidige code al dynamisch zijn of eenvoudig dynamisch te maken zijn.

Inhoud: A. Layout (IDX) · B. Basic (IDX) · C. Rit-pagina · D. KV-pagina

---

# A. Layout-componenten (IDX)

### AppShell
- **Bron:** IDX 412-413, 438, 448, 1241-1242 (`.app` > `.topbar` + `.nav` + `.content` > `.sec`); CSS 16, 25-26.
- **Categorie:** layout
- **Beschrijving:** Gecentreerde app-container (max 960px) met topbalk, hoofdnavigatie en sectie-gebied waarin precies één `.sec.active` zichtbaar is.
- **Props:** actieve sectie-id (`.sec.active`), dark/light (`data-theme` op `<html>`).
- **Hardcoded:** max-width 960px; lijst van 10 sectie-ids (`SECS`, IDX 1995); `goTo()` schakelt via classes.

### TopBar
- **Bron:** IDX 413-436 (HTML); CSS 17-18, 24, 358, 325-326; JS `_setCurrentUser` 3796, `updateAanvragenBadge` 3905-3909, `toggleDarkMode` 8867, `toggleTimeMachine` 1976, `setSimDate` 1982.
- **Categorie:** layout
- **Beschrijving:** Topbalk met gebruiker-pil (naam + "Uit"), logo, titel + actieve periode, globale zoekbalk, donkere-modus-knop, tijdmachine, simulatie-indicator en rode aanvragen-badge.
- **Props:** `gebruikersnaam` (`#topbar-user-naam`), `periodeNaam` (`#topbar-periode`, gevuld in `loadAll` IDX 3897), `simDatum` (`#sim-date-label`), `aantalAanvragen` (`#badge-spoed-n`), `zoekterm`.
- **Hardcoded:** titel "Sporty vzw — Logistiek", logo-emoji ⛰ (`&#9978;`), placeholders, emoji-knoppen 🌙/🕐, badge-link naar `goTo('transport-noden')`, zoekveld max 300px.

### MainNav
- **Bron:** IDX 438-446 (HTML); CSS 19-23, 341, 362; actief-logica in `goTo` IDX 2003-2014.
- **Categorie:** layout
- **Beschrijving:** Horizontale knoppenbalk met zeven hoofdsecties; actieve knop groen gemarkeerd, transport-subsecties delen één knop.
- **Props:** `actieveSectie`, `tellerMateriaal` (`#materiaal-badge`, via `updateMateriaalBadge` IDX 3223-3229); knop-array `{label, icoon, doel}`.
- **Hardcoded:** 7 knoppen met emoji + `onclick="goTo('…')"`; index-gebaseerde activatie (`document.querySelectorAll('.nb')[i]` vs. vaste volgorde-array) — nieuwe knop vereist aanpassing van die array.

### SubTabBar
- **Bron:** voorbeelden IDX 535-537, 558-564, 609-616, 704-715, 893-896, 1019-1023, 1100-1104, 1192-1196, 9115-9118; CSS 173-175; JS `setMatSubtab` 2041, `setKampMode` 2208, `setPersSubtab` 9455, `setPlanSubtab` 2190, `setNkInnerTab` 3332.
- **Categorie:** layout
- **Beschrijving:** Rij `.kal-subtab`-knoppen met groene onderlijn voor de actieve tab; wisselt `display` van sub-containers en roept de bijbehorende render-functie aan.
- **Props:** `tabs[{id,label,icoon,verborgen,badge}]`, `actief`, rechts uitgelijnde actieknop (`flex:1` spacer + `.btn-g`/`.btn-o`).
- **Hardcoded:** elke sectie heeft zijn eigen set van id's (`mat-sub-*`, `pers-sub-*`, `kp-*-content`) en eigen setter-functie; verborgen tabs via `style="display:none"`; badge-spans inline.

### ViewSwitcher (segmented)
- **Bron:** IDX 455-461, 1119-1122; CSS 194-196.
- **Categorie:** layout
- **Beschrijving:** Rij `.ov-view-btn`-knoppen als segmented control voor weergavewissel binnen een sectie (Overzicht / Week materiaal / Conflicten / Periodes / Rooster; Week/Dag).
- **Props:** `opties[{label,onclick}]`, `actiefIndex`.
- **Hardcoded:** `showOvMain/showConflicten/…` en index-gebaseerde `.active` (IDX 1505-1512, 1521-1529, 1680-1688).

### BackHeaderRow
- **Bron:** IDX 494-497, 504-507, 512-517, 521-525.
- **Categorie:** layout
- **Beschrijving:** Kopregel van een subweergave met `← Overzicht`-knop, vette titel en optionele extra acties.
- **Props:** `titel`, `terugActie`, `extraActies`.
- **Hardcoded:** tekst "← Overzicht" en `showOvMain()`.

### ListDetailSplit
- **Bron:** IDX 539-550 (HTML); CSS 240-245 (desktop-scroll, ≥760px).
- **Categorie:** layout
- **Beschrijving:** Flex-wrap tweekolommenlayout: smalle lijst (190-300px) links, brede detailkolom rechts; op desktop scrollen beide onafhankelijk.
- **Props:** `lijstTitel`, `nieuwActie`, `lijstId`, `detailId`.
- **Hardcoded:** ids `loc-tab-list`/`loc-tab-detail`, hoogte `calc(100vh - 150px)`.

### LoginOverlay
- **Bron:** IDX 383-410; JS 3811-3882 (`checkLoginOnStart`, `showLoginScreen`, `doLogin`, `doSetup`, `doLogout`).
- **Categorie:** layout
- **Beschrijving:** Volschermformulier (z-index 5000) met naamkeuze + pincode, of eerste-pincode-setup wanneer er nog geen pincodes bestaan.
- **Props:** `personenLijst` (uit `/api/personeel-lijst-login`), `setupModus` (uit `/api/login-status`), `foutmelding`.
- **Hardcoded:** teksten, emoji ⛰, min. pincodelengte 4, endpoints.

### FilterBar (planner)
- **Bron:** IDX 1131-1151 (HTML), JS `applyPlannerFilters`/`clearPlannerFilters`.
- **Categorie:** layout
- **Beschrijving:** Grijs vlak met drie gelabelde selects (locatie, chauffeur, status) en wis-knop.
- **Props:** opties per select, huidige waarden.
- **Hardcoded:** labels (LOCATIE/CHAUFFEUR/STATUS), statuswaarden gepland/bevestigd/gedaan.

### BulkActionBar
- **Bron:** IDX 1066-1076 (backlog, sticky) en 1220-1225 (alle transporten).
- **Categorie:** layout
- **Beschrijving:** Balk die verschijnt bij geselecteerde rijen met teller en bulkacties (terugzetten, nieuwe rit, toevoegen aan rit, verwijderen, deselecteren).
- **Props:** `aantalGeselecteerd`, acties, rit-opties.
- **Hardcoded:** actienamen `bulkActie('backlog'|'nieuwe-rit'|'bestaande-rit'|'delete')`; groene sticky stijl inline.

### CollapsiblePanel (`<details>`)
- **Bron:** IDX 1026-1047 (Aanvragen), 1159-1185 (Ploegplanning), 1229-1232 (Voertuigbezetting).
- **Categorie:** layout
- **Beschrijving:** Native `<details>`-blok met `<summary>` (titel, teller, actieknop) en inhoud.
- **Props:** `titel`, `teller`, `open`, `actieknop`.
- **Hardcoded:** inline randen/achtergronden per instantie.

### TimeMachineBar
- **Bron:** IDX 428-434; JS 1973-1992.
- **Categorie:** layout
- **Beschrijving:** Amber balk om een gesimuleerde "vandaag" in te stellen; indicator-pil toont de gekozen datum.
- **Props:** `simDatum`.
- **Hardcoded:** vervangt `new Date()` via `_appNow()`; renderMap bij wijzigen beperkt tot 4 secties (IDX 1990).

---

# B. Basic-componenten (IDX)

### Button
- **Bron:** CSS IDX 52-60, 112-113, 40-41; voorbeeld IDX 1338-1342.
- **Categorie:** basic
- **Beschrijving:** Knopvarianten `.btn-g` (groen), `.btn-b` (blauw), `.btn-r` (rood), `.btn-o` (outline), `.btn-del-sm`, `.btn-xs`, `.bi` (icoon).
- **Props:** variant, label/icoon, `onclick`, disabled (`button:disabled{opacity:.45}` IDX 230).
- **Hardcoded:** hoogtes per variant (32/36/28px), kleuren (hover `#0F6E56`, `#A32D2D`), geen size-prop.

### StatusPill
- **Bron:** CSS IDX 63-66, 119; gebruik IDX 2149-2151, 2182-2183, 5322, 4358.
- **Categorie:** basic
- **Beschrijving:** Afgeronde label-pil met kleurvarianten (`p-gray/green/red/amber/blue/stock`) en transportstatus (`st-gepland/bevestigd/gedaan`).
- **Props:** `tekst`, `kleur`/`status`, optionele `fontSize`.
- **Hardcoded:** status→klasse-mapping `{gepland:'st-gepland',…}` en NL-labels inline in renderfuncties; `.p-stock` hex `#FFF3E0/#E65100`.

### CountBadge
- **Bron:** CSS IDX 24 (`.badge`); JS `updateAanvragenBadge` 3905-3909, `updateMateriaalBadge` 3223-3229; inline rode tellers IDX 442, 712, 1029.
- **Categorie:** basic
- **Beschrijving:** Klein rood rond/pil-bolletje met aantal, getoond naast nav-/tabknoppen of titels.
- **Props:** `aantal` (verbergt bij 0).
- **Hardcoded:** `var(--red)` + wit, inline stijl per plek (3 varianten: absolute `.badge`, inline pil in nav, inline in tab).

### ThemaTag
- **Bron:** CSS IDX 76; JS `_kpThemaTag` 2246-2249, IDX 2179-2181.
- **Categorie:** basic
- **Beschrijving:** Gekleurde tag van een thema (achtergrond = themakleur + `22`, tekst = themakleur).
- **Props:** `naam`, `kleur` (hex uit DB), optionele dag-label.
- **Hardcoded:** alpha `22`; lege-dag-variant `#eee/#999`.

### Card
- **Bron:** CSS IDX 32-33 (`.card`, `.card-hd`); voorbeeld IDX 472-478, 481-490.
- **Categorie:** basic
- **Beschrijving:** Witte kaart met hairline rand, 12px radius en uppercase kleine kop; optionele actieknoppen rechts in de kop.
- **Props:** `titel`, `acties`, children.
- **Hardcoded:** kop-flex-layout wordt per instantie inline herhaald.

### ListRow
- **Bron:** CSS IDX 34-39 (`.row`, `.dot`, `.ri`, `.rm`, `.rs`, `.ra`), 132-133 (`.item-line`), 140-142 (`.hist-row`); JS-voorbeelden IDX 2145-2153, 2185.
- **Categorie:** basic
- **Beschrijving:** Horizontale lijst-rij: icoon/dot, titel (`.rm`) + subtitel (`.rs`), pill rechts, hover-achtergrond; klikbaar.
- **Props:** `icoon`, `titel`, `subtitel`, `status`, `onClick`, `actief/bewerken` (`.row.editing`).
- **Hardcoded:** icoon-emoji per transporttype (`{levering:'🟢',ophaling:'🔵',…}` IDX 2148); inline stijl voor gemarkeerde rij (groen/amber).

### ExpandableCard (accordion)
- **Bron:** CSS IDX 68-71 (`.km-*`), 95-98 (`.exp-*`), 114-118 (`.tp-*`), 127-131 (`.lo-*`); toggle `toggleKmBody` 4430, `toggleThemaBody` 4767.
- **Categorie:** basic
- **Beschrijving:** Kaart met klikbare kop en uitklapbare body; vier visuele varianten, sommige met gekleurde linkerrand per type (levering groen / ophaling blauw / extra amber, stockage oranje).
- **Props:** `kop`, `body`, `open`, `type` (voor linkerrand).
- **Hardcoded:** body-ids `km-body-<id>`; open/dicht via `style.display`.

### PriorityCard
- **Bron:** CSS IDX 120-126 (`.spoed-card` + `.prio-hoog/midden/laag`, `.done-card`, `.s-hd/.s-info/.s-title/.s-meta/.s-note/.s-actions`).
- **Categorie:** basic
- **Beschrijving:** Kaart met prioriteitsrand (rood/amber/blauw) en doorgestreepte "klaar"-staat (opacity .55).
- **Props:** `prioriteit`, `titel`, `meta[]`, `notitie`, `acties`, `klaar`.
- **Hardcoded:** 3 prioriteiten; (klasse staat alleen in de CSS, IDX 120-126; geen gebruik in HTML of JS van index.html gevonden via grep op `spoed-card`).

### MetricTile
- **Bron:** CSS IDX 27-31; HTML IDX 464-469, 1105-1110.
- **Categorie:** basic
- **Beschrijving:** Kleine grijze tegel met label en grote waarde (19px/600); raster van 4 (2 op mobiel); optioneel klikbaar.
- **Props:** `label`, `waarde`, `kleur` (`g/r/a/b`), `onClick`, `title`.
- **Hardcoded:** waarde-id's (`ov-loc`, `ov-km`, `ov-tp`, `ov-sp`, `pl-lev`…) worden per id gevuld.

### FieldGroup / Input / Select
- **Bron:** CSS IDX 42-51, 109-111, 229, 289, 306; HTML-voorbeelden IDX 743-759, 1252-1281.
- **Categorie:** basic
- **Beschrijving:** Label + control (`.fg`) in een wrap-rij (`.fr`); varianten `.sm` (65/80px), `.md` (140px), `.grow` (flex); `.inp`/`.sel` 32px hoog; groene focus-ring; `:required:invalid` rode rand.
- **Props:** `label`, `type`, `waarde`, `placeholder`, `breedte` (sm/md/grow), `verplicht`, `opties`.
- **Hardcoded:** ≤700px forceert 16px font-size en volle breedte (IDX 270-281, 349-352).

### Toast
- **Bron:** IDX 3488-3500 (JS), 301-303 (CSS).
- **Categorie:** basic
- **Beschrijving:** Meldingskaartje rechtsonder, wit op gekleurde achtergrond; klik sluit; verdwijnt na 3 s (error 5 s).
- **Props:** `msg`, `type` (`info|error|success|warn`).
- **Hardcoded:** kleuren, positie (`bottom:1.5rem;right:1.5rem`), duur, max-breedte 320px — alles inline in JS.

### Modal (statisch)
- **Bron:** CSS IDX 134-139; HTML IDX 1246-1288 (voorbeeld) en 1293-1500, 8885-9112; JS `openModal/closeModal` 3910-3911.
- **Categorie:** basic
- **Beschrijving:** Overlay (`.modal-bg.open`) met 520px-kaart (`.modal`), titelrij met sluitknop en inhoud (formulierrijen + knoppenrij).
- **Props:** `id`, `titel`, `breedte` (inline `style="width:460px"`), children.
- **Hardcoded:** 21 modals als vaste HTML; titels via `getElementById(...).textContent`; ≤600px forceert 95vw.

### PromptModal (`vraagModal`) / ConfirmDialog (`bevestig`)
- **Bron:** IDX 3421-3486.
- **Categorie:** basic
- **Beschrijving:** Promise-gebaseerd dynamisch dialoog dat velden (text/number/textarea/select/checkbox/date) toont en `{naam:waarde}` of `null` teruggeeft; `bevestig()` is de ja/nee-variant.
- **Props:** `{titel, tekst, velden[], bevestigTekst, annuleerTekst, gevaarlijk}`.
- **Hardcoded:** alle stijlen inline (z-index 2600, 440px breed, gevaar-rood `#b42318`), Escape/Enter-afhandeling.

### DataTable (`.mat-table`)
- **Bron:** CSS IDX 253, 313-320; JS-opbouw IDX 6241-6249 (`renderCatalogusLijst` 6143-6249), `_renderCatRow` 6253+.
- **Categorie:** basic
- **Beschrijving:** Compacte tabel (12.5px) met uppercase kop, rij-hover, groep-koprijen (`.mat-grp`), bewerk-rij (`.mat-edit`), horizontaal scrollbare wrapper.
- **Props:** `kolommen[{label,breedte,uitlijning}]`, `rijen`, `groepering`, selectie.
- **Hardcoded:** kolomdefinitie en inline `<th style="width:…">` in de render-functie; geen herbruikbare tabelfunctie.

### RoosterGrid (locaties × weken)
- **Bron:** CSS IDX 254-263; JS `renderRooster` 1530-1570, `selectKpCell` 1574-1628.
- **Categorie:** basic
- **Beschrijving:** Tabel met sticky eerste kolom (locatie) en sticky kop (weken); cellen tonen kampmoment (aantal of namen) en zijn klikbaar.
- **Props:** `locaties`, `weken`, `kampmomenten`, `compact`.
- **Hardcoded:** `_roosterCompact` toggle; target-id parameter.

### CalendarGrid (maand/week/open-dicht)
- **Bron:** CSS IDX 81-93, 152-170, 177-222; JS `renderPlannerKalender` 7360-7434.
- **Categorie:** basic
- **Beschrijving:** Familie van kalenderweergaven: `.kal-table`/`.od-table` (locatie × dag, cel open/dicht/feest/kamp), `.maand-kal` (maand), `#pl-kalender-grid` (7-koloms week), `.ov-maand-tbl`/`.ov-week-tbl`.
- **Props:** `dagen`, `locaties`, per cel `status` (`open|dicht|feest|kamp`).
- **Hardcoded:** kleuren per status (`#E8F9F3`, `#F1EFE8`, …), cel 36-40px.

### PagerBar
- **Bron:** IDX 5884-5901 (+ handlers 5902-5905), CSS 246-252.
- **Categorie:** basic
- **Beschrijving:** Paginabalk met "x–y van n", per-pagina-select (10/20/50/100) en vorige/volgende.
- **Props:** `prefix`, `page`, `perPage`, `total`.
- **Hardcoded:** opties [10,20,50,100]; vereist globale `<prefix>GoPage/<prefix>SetPerPage`.

### EmptyState / LoadingState
- **Bron:** CSS IDX 149-150; voorbeelden IDX 545, 548, 2142, 2186, 1869.
- **Categorie:** basic
- **Beschrijving:** Gecentreerde grijze tekstblokken (`.empty`, `.loading`), soms met herstelknop.
- **Props:** `tekst`, optionele `actieknop`.
- **Hardcoded:** teksten per call-site (NL); 49 `class="empty"`-voorkomens.

### SearchDropdown
- **Bron:** HTML IDX 423-426; JS `globalSearch` 8833-8862 + klik-buiten-handler 8864.
- **Categorie:** basic
- **Beschrijving:** Zoekveld met dropdown (max 12 resultaten) over locaties, sport, thema's, thema-materiaal, gedeeld, transporten, periodes; klik navigeert via `goTo`.
- **Props:** `query`; bronnen `S`, `_invSport`, `_invGedeeld`, `plannerTaken`.
- **Hardcoded:** categorieën + iconen + doel-secties, debounce 150ms, inline stijl (z-index 200).

### ConflictRow
- **Bron:** IDX 1862-1899 (`checkConflicten`), `CONFLICT_SOORTEN` 1842, `springNaarConflict` 1856.
- **Categorie:** basic
- **Beschrijving:** Gegroepeerde lijst conflicten per soort met ernstkleur (hoog rood / midden geel / laag grijs) en knop "Naar kampmoment →".
- **Props:** `soort`, `ernst`, `bericht`, `weekNr`, `locId`.
- **Hardcoded:** achtergrond/rand-hex (`#FEF2F2`, `#FEF6E0`, `#F09595`, `#EFC55A`).

### CapacityBar (voertuigbezetting)
- **Bron:** IDX 9753-9783.
- **Categorie:** basic
- **Beschrijving:** Horizontale balk per rit met kleur op vulgraad (groen/amber/rood, blauw bij onbekende capaciteit).
- **Props:** `datum`, `voertuig`, `stops`, `capaciteit`.
- **Hardcoded:** drempel 80%, minimale balkbreedte 8%.

### MapPin (Leaflet divIcon)
- **Bron:** CSS IDX 234-238; JS `renderKaart` 6826-6849, `renderKaartMarkers` 6851.
- **Categorie:** basic
- **Beschrijving:** Gekleurde tekst-pin (kamp groen / stockage oranje) en genummerde ronde pin voor ritvolgorde.
- **Props:** `naam`, `type`, `nummer`.
- **Hardcoded:** Leaflet 1.9.4 via unpkg (IDX 9-10), kaarthoogte 420px (200px op mobiel).

### ColorSwatch / ColorDot
- **Bron:** CSS IDX 285-286, 298-299, 37; kleurinput IDX 825.
- **Categorie:** basic
- **Beschrijving:** Kleine thema-kleurvierkantjes en klikbare cirkel-dots voor kleurkeuze.
- **Props:** `kleur`, `actief`.
- **Hardcoded:** 12px/18px/9px afmetingen.

---

# C. Rit-pagina (RIT, routes/transport.js)

Geen scheiding in componenten: één template-string. Onderstaande onderdelen zijn de natuurlijke stukken.

### RitHeader
- **Bron:** RIT 1168-1169 (HTML); CSS 1150-1151 (`.hdr`).
- **Categorie:** layout
- **Beschrijving:** Blauwe kopbalk met 🚚 "Rit <datum>" en regel chauffeur · voertuig · aantal stops.
- **Props:** `rit.datum`, `rit.chauffeur`, `rit.voertuig`, `aantalStops`.
- **Hardcoded:** achtergrond `#2563eb`, emoji's, NL-teksten, enkelvoud/meervoud "stop(s)".

### SectionLabel
- **Bron:** RIT 1170-1171; CSS 1152 (`.sec`).
- **Categorie:** basic
- **Beschrijving:** Grijze uppercase sectiekop met onderlijn ("Stops", "Materiaallijst (n items)").
- **Props:** `tekst`.
- **Hardcoded:** `#666`/`#e5e5e5`, 11px.

### StopCard
- **Bron:** RIT 1113-1120 (server-side string); CSS 1153-1155 (`.stop`, `.type`, `.nm`, `.rt`, `.ti`); client `aangekomen(id)` 1182-1188.
- **Categorie:** basic
- **Beschrijving:** Witte kaart met blauwe linkerrand: type-label (📦 Levering / 📤 Ophaling / 🔄 Transfer, optioneel "(week n)"), omschrijving, route "van → naar", tijd en knop "📍 Ik ben aangekomen".
- **Props:** `t.type`, `t.km_week`, `t.opmerking`, `t.van_naam`, `t.naar_naam`, `t.tijd`, `t.status` (`aangekomen|gedaan` bepaalt knoptekst/`done`), `t.id`.
- **Hardcoded:** type→icoon/label-map, fallback "Stockage" en "(zonder naam)", endpoint `/api/rit-token/:token/taken/:id/aangekomen`.

### CheckRow (basis-materiaal, alleen-lezen status)
- **Bron:** RIT 1131-1137 (map `!isBak` tak); CSS 1156-1158 (`.chk`, `.ok/.ontbreekt/.deels`, `.ico/.nm/.qty/.nt`).
- **Categorie:** basic
- **Beschrijving:** Rij met statusicoon (✅ ❌ ⚠️ ⬜), naam, aantal (×qty) en optionele notitie; linkerrand in statuskleur.
- **Props:** `c.status` (`ok|ontbreekt|deels|wacht`), `c.item_naam`, `c.qty`, `c.notitie`.
- **Hardcoded:** icoon-map en kleurenset groen/rood/amber.

### CheckRowFase (bak/attribuut met Laden/Lossen)
- **Bron:** RIT 1138-1146; CSS 1159-1163 (`.chk.fase`, `.fasebtns`, `.fbtn`, `.fbtn.done`); client `tog(id,kind)` 1189-1203.
- **Categorie:** basic
- **Beschrijving:** Rij met bak-naam, aantal en twee 48px-knoppen "⬆️ Laden" / "⬇️ Lossen" die groen worden (✅ Geladen/Gelost) na tikken.
- **Props:** `c.id`, `c.item_naam`, `c.qty`, `c.geladen`, `c.gelost`.
- **Hardcoded:** knopteksten, endpoint `/api/rit-token/:token/checks/:id/(laden|lossen)`, rek-groepering via regex op code in naam `(A12)`.

### RekHeader
- **Bron:** RIT 1147 (`📍 Rek X`); CSS 1164 (`.rek`).
- **Categorie:** basic
- **Beschrijving:** Blauwe kleine kop die bakken per rek groepeert ("Overig" onderaan).
- **Props:** `rekLetter`.
- **Hardcoded:** groepering enkel voor soort thema/attribuut/vast.

### Toast (rit)
- **Bron:** RIT 1176-1181 (JS) en CSS 1166-1167 (`.toast/.zicht/.goed/.fout`).
- **Categorie:** basic
- **Beschrijving:** Gecentreerde melding onderaan (groen/rood, 3 s).
- **Props:** `tekst`, `goed`.
- **Hardcoded:** `#16a34a`/`#dc2626`; aparte implementatie t.o.v. `showToast` van IDX.

### FooterNote
- **Bron:** RIT 1172.
- **Categorie:** basic
- **Beschrijving:** Gecentreerde grijze voettekst "Sporty Logistics".
- **Props:** geen. **Hardcoded:** tekst.

---

# D. KV-pagina (KV, routes/kv.js)

### KvStickyHeader
- **Bron:** KV 168-177 (HTML); `renderHeader` 218-221.
- **Categorie:** layout
- **Beschrijving:** Plakkende kop met groen logo-blokje, kampnaam, "KV-naam · kampverantwoordelijke" en onderliggende tab-pillen.
- **Props:** `DATA.kampNaam`, `DATA.kvNaam`.
- **Hardcoded:** logo (leeg groen vierkant), tekst "kampverantwoordelijke", z-index 20.

### KvTabPills
- **Bron:** KV 176 (container), `renderTabs` 222-225, `gaNaar` 226-234; CSS 156-157 (`.tabpill`, `.tabpill.actief`); `TABS` 199.
- **Categorie:** layout
- **Beschrijving:** Horizontaal scrollbare pil-tabs (Wat moet er staan / Vrijdagcontrole / Iets nodig? / Iets kapot? / optioneel Boodschappen).
- **Props:** `TABS[[id,label]]`, `ACTIEF`; vijfde tab alleen als `DATA.boodschappen.length`.
- **Hardcoded:** 4 vaste tabs; footer alleen zichtbaar bij `blok2`.

### KvBlockHeading
- **Bron:** KV 266-290 etc. (`seclabel` + `bloktitel` + `blokintro`); CSS 158-160.
- **Categorie:** basic
- **Beschrijving:** Kleine uppercase "Blok n", grote titel (20px/600) en introtekst per tab.
- **Props:** `nummer`, `titel`, `intro`.
- **Hardcoded:** NL-teksten per blok.

### CodeBadge
- **Bron:** CSS KV 153 (`.code`); gebruik in renderBlok1/renderBlok2 (KV 270, 275, 345).
- **Categorie:** basic
- **Beschrijving:** Monospace-badge met bak-/attribuutcode.
- **Props:** `code` (fallback "—"). **Hardcoded:** stijl.

### KvBakRow (accordion per bak)
- **Bron:** KV 293-329 (`bakHtml` in `renderBlok2` 290-354); acties `toggleBak` 355, `stel` 356, `stelUitInput` 361, `bakAfsluiten` 367.
- **Categorie:** basic
- **Beschrijving:** Kaart met kop (code, naam, aantal items, status-pil "Nog te tellen / n/m / Geteld / x te weinig", ▲▼) die uitklapt naar item-rijen met teller en "Bak afsluiten"-knop.
- **Props:** `b.id`, `b.code`, `b.naam`, `b.items[{id,naam,gewenst,aangetroffen}]`, `OPEN_BAK`, `LOCAL` (lokale waarden).
- **Hardcoded:** pil-kleuren (grijs/blauw/groen/amber), sub-tekst "x te weinig / te veel / Klopt · n gewenst", API `/bakken/:id/tellen`.

### CountStepper (`.rowbtn`)
- **Bron:** KV 315-318; CSS 161-163.
- **Categorie:** basic
- **Beschrijving:** − [getal] + stepper (44×46 knoppen) waarvan rand/achtergrond de teltoestand toont (leeg / klopt groen / tekort amber).
- **Props:** `waarde`, `gewenst`, `onChange`.
- **Hardcoded:** kleuren `#EF9F27/#5DCAA5/#FAEEDA/#E1F5EE`, max 999.

### AttributeToggleRow
- **Bron:** KV 330-340 (`attrHtml`); `zetAttr` 379-387.
- **Categorie:** basic
- **Beschrijving:** Rij met code + naam en twee knoppen "Aanwezig"/"Beschadigd" (groen/rood actief; opnieuw tikken zet terug op leeg).
- **Props:** `a.id`, `a.code`, `a.naam`, `status` (`aanwezig|beschadigd|null`).
- **Hardcoded:** twee statussen, kleuren, optimistische update + rollback.

### ProgressCard
- **Bron:** KV 344-349 (kaart met "n van m bakken geteld", tekortenteller en balk).
- **Categorie:** basic
- **Beschrijving:** Kaart met voortgangstekst, "Geen tekorten / n tekorten" en groene voortgangsbalk.
- **Props:** `geteld`, `totBakken`, `tekortTotaal`.
- **Hardcoded:** balkkleur `#1D9E75`, track `#eceae4`.

### KvStickyFooter
- **Bron:** KV 186-194 (HTML); `renderFooter` 388-393; `verstuurControle` 394-398.
- **Categorie:** layout
- **Beschrijving:** Plakkende onderbalk (alleen tab Vrijdagcontrole) met voortgang, subtekst en "Versturen"-knop (groen als alles nagekeken, grijs anders).
- **Props:** `voortgang()` → `{geteld,totBakken,attrGedaan,totAttr,klaar}`.
- **Hardcoded:** teksten, kleuren `#1D9E75`/`#9a9a95`, `safe-area-inset-bottom`.

### RequestCard + RequestForm (Iets nodig?)
- **Bron:** KV 399-421 (`renderBlok3`), `verstuurAanvraag` 422-431.
- **Categorie:** basic
- **Beschrijving:** Tekstveld + "Aanvraag versturen" en lijst van eerdere aanvragen met status-pil (Nieuw/Goedgekeurd/Afgewezen/Afgehandeld) en optionele afwijsreden.
- **Props:** `DATA.aanvragen[{tekst,status,created_at,reden}]`.
- **Hardcoded:** status→kleur/label-map (KV 402), placeholder-voorbeeldtekst.

### BreakReportForm (Iets kapot?)
- **Bron:** KV 432-451; `kvKapotFotoGekozen` 452-457; `verstuurKapot` 458-470.
- **Categorie:** basic
- **Beschrijving:** Knop die een formulierkaart opent (rode linkerrand) met tekstveld, fototoevoeging (camera) en "Melding versturen".
- **Props:** `KAPOT_OPEN`, `KAPOT_FOTO` (data-URL).
- **Hardcoded:** rood `#E24B4A`, `capture="environment"`, base64-upload in JSON.

### ShoppingCheckRow (Boodschappen)
- **Bron:** KV 471-490 (`renderBlok5`), `toggleBoodschap` 491.
- **Categorie:** basic
- **Beschrijving:** Checkbox-rij (22px) met doorstreepte naam bij afgevinkt en "×qty"; teller "n van m afgevinkt".
- **Props:** `b.id`, `b.naam`, `b.qty`, `BOODSCHAP_VINK`.
- **Hardcoded:** niet persistent (alleen sessie); vaste factuurtekst onderaan ("Sporty Creactief, E. Solvaystraat 2, 3010 Kessel-Lo").

### InfoBanner (404)
- **Bron:** KV 145 (404 `<h2>`), RIT 1103 (404 `<h2>`) en KV 211 (init-fout).
- **Categorie:** basic
- **Beschrijving:** Eenvoudige titel "Link niet gevonden of verlopen." bij ongeldige token.
- **Props:** geen. **Hardcoded:** tekst, `font-family:system-ui`.
