# Routes

> De app is een single-page-app zonder router-bibliotheek. "Routes" zijn (1) de `.sec`-secties in `D:\Sporty\sporty-railway\index.html`, geschakeld door `goTo(id)` (index.html:1998-2037), en (2) twee publieke server-gerenderde pagina's: `/rit/:token` en `/kv/:token`. Geen URL-hash of history: de adresbalk verandert niet bij navigeren.

## 1. Navigatiemechanisme

- `const SECS=[...]` (index.html:1995): `overzicht, planning, materiaal, transport-noden, transport-plan, transporten, kaart, seizoensoverzicht, kampplanner, personeel`.
- `goTo(id)` (index.html:1998-2037): zet `.active` op `#sec-<id>`, markeert de nav-knop (`.nb`, volgorde: overzicht, kampplanner, transport, materiaal, planning, kaart, personeel — transport-noden/-plan/transporten activeren allemaal de derde knop) en roept `renderMap[id]()` aan; fouten → `showToast`.
- Subtabs binnen een sectie: `.kal-subtab`-knoppen met eigen functies: `setMatSubtab` (2041), `setKampMode` (2208), `setPersSubtab` (9455), `setPlanSubtab` (2190), `setNkInnerTab` (3332); Overzicht gebruikt `.ov-view-btn` + show*-functies.
- Startsectie: `overzicht` (`class="sec active"`, index.html:453). `bootApp()` (8770) rendert na `loadAll()` de actieve sectie (alleen overzicht/planning/materiaal/transport-*; **kampplanner, kaart, personeel, seizoensoverzicht ontbreken in `_initRenderMap`**, index.html:8774-8781).
- Hoofdnavigatie (index.html:438-446): Overzicht · Kampplanner · Transport · Materiaal · Locaties · Kaart · Personeel.
- Auth: sessietoken in `localStorage['sporty-auth-token']`, 401 → loginscherm (`showLoginScreen`, index.html:3828).

## 2. Secties van index.html

### `#sec-overzicht` — 📊 Overzicht

- **Navigatie:** `goTo('overzicht')` (index.html:439); HTML regels 453-528
- **Renderfunctie:** `renderOverzicht()` (index.html:2113-2187)
- **Toont:** Dashboard met 4 kerncijfers (kamplocaties, kampmomenten, transporten gepland, nieuwe aanvragen), aankomende transporten (7 dagen) en een lijst geplande kampmomenten.
- **Belangrijkste API-routes (client → server):** 
  - `GET /api/transport-taken` (routes/transport.js:8)
  - `GET /api/aanvragen` (routes/aanvragen.js:11)

| Sub-container (id) | Knop | Renderfunctie | Toont |
|---|---|---|---|
| `#ov-main` | Overzicht | `showOvMain` | Standaardweergave (metrics + aankomende transporten + kampmomenten). |
| `#week-mat-ov` | Week materiaal | `showWeekMatOverzicht` | Materiaalbehoefte per week met weekkiezer. |
| `#conflict-ov` | Conflicten | `showConflicten` | Lijst conflicten/waarschuwingen per soort en ernst met knop naar het kampmoment. |
| `#periodes-ov` | Periodes | `showPeriodesBeheer` | Vakantieperiodes beheren (actief instellen, bewerken, verwijderen). |
| `#rooster-ov` | Rooster | `showRooster` | Rooster locaties × weken; cel aanklikken om kampmoment toe te voegen/bewerken. |

API per subweergave:

- `#ov-main`: `GET /api/transport-taken` (routes/transport.js:8); `GET /api/aanvragen` (routes/aanvragen.js:11)
- `#week-mat-ov`: (geen eigen API-calls in de functieboom; gebruikt data uit S)
- `#conflict-ov`: `GET /api/conflicten` (routes/conflicten.js:7)
- `#periodes-ov`: `POST /api/periodes/:p/activeer` (routes/planning.js:162); `GET /api/periodes` (routes/planning.js:159); `DELETE /api/periodes/:p` (routes/planning.js:187)
- `#rooster-ov`: `GET /api/themas/:p/bakken` (routes/bakken.js:26)

### `#sec-kampplanner` — 🏕️ Kampplanner

- **Navigatie:** `goTo('kampplanner')` (index.html:440); HTML regels 557-579
- **Renderfunctie:** `renderKampplanner()` (index.html:2230-2234)
- **Toont:** Kampmomenten plannen in vijf modi (Rooster, Per locatie, Per week, Per thema, Sportpakketten) met detailpaneel en kampmoment-modal.
- **Belangrijkste API-routes (client → server):** 
  - `GET /api/sport` (routes/sport.js:8)
  - `GET /api/themas` (routes/themas.js:8)

| Sub-container (id) | Knop | Renderfunctie | Toont |
|---|---|---|---|
| `#kp-rooster-content` | Rooster | `renderRooster (via _renderKampMode)` | Rooster locaties × weken met detailpaneel. |
| `#kp-locatie-content` | Per locatie | `_renderKampLocatie` | Per kamplocatie de weken met thema-selectie per leeftijdsgroep. |
| `#kp-week-content` | Per week | `_renderKampWeek` | Per week alle locaties met thema's. |
| `#kp-thema-content` | Per thema | `_renderKampThema` | Per thema waar/wanneer het draait. |
| `#kp-sport-content` | Sportpakketten | `renderSportPlanningGrid` | Planningsgrid sportpakketten per locatie/week. |

API per subweergave:

- `#kp-rooster-content`: `GET /api/themas/:p/bakken` (routes/bakken.js:26); `GET /api/personeel` (routes/personeel.js:7)
- `#kp-locatie-content`: `DELETE /api/kampmomenten/:p/themas/:p` (routes/planning.js:131); `POST /api/kampmomenten/:p/themas` (routes/planning.js:125); `GET /api/kampmomenten` (routes/planning.js:51); `POST /api/sport/sets/:p/plan` (routes/sport.js:64)
- `#kp-week-content`: `DELETE /api/kampmomenten/:p/themas/:p` (routes/planning.js:131); `POST /api/kampmomenten/:p/themas` (routes/planning.js:125); `GET /api/kampmomenten` (routes/planning.js:51); `POST /api/sport/sets/:p/plan` (routes/sport.js:64)
- `#kp-thema-content`: `DELETE /api/kampmomenten/:p/themas/:p` (routes/planning.js:131); `POST /api/kampmomenten/:p/themas` (routes/planning.js:125); `GET /api/kampmomenten` (routes/planning.js:51); `GET /api/sport` (routes/sport.js:8)
- `#kp-sport-content`: `GET /api/sport` (routes/sport.js:8); `POST /api/sport/sets/:p/plan` (routes/sport.js:64); `GET /api/kampmomenten` (routes/planning.js:51)

### `#sec-transport-plan` — 🚚 Transport (subtab Plannen)

- **Navigatie:** `goTo('transport-plan')` (index.html:441); HTML regels 1099-1188
- **Renderfunctie:** `renderTransportPlan()` (index.html:3082-3085)
- **Toont:** Weekkalender/dagweergave van ritten met metrics, filters, backlog-strip, conflictenstrook en ploegplanning/chauffeursbeheer.
- **Belangrijkste API-routes (client → server):** 
  - `GET /api/transport-taken` (routes/transport.js:8)
  - `GET /api/ritten` (routes/transport.js:749)
  - `GET /api/thema-categorieen` (routes/themas.js:146)
  - `GET /api/sport` (routes/sport.js:8)
  - `GET /api/gedeeld` (routes/bakken.js:360)
  - `GET /api/verbruik` (routes/voorraad.js:7)
  - `GET /api/personeel` (routes/personeel.js:7)

### `#sec-transport-noden` — 🚚 Transport (subtab Op te stellen)

- **Navigatie:** `goTo('transport-noden')` (index.html:1020); HTML regels 1018-1094
- **Renderfunctie:** `renderNoden()` (index.html:7631-7640)
- **Toont:** Backlog van nog niet ingeplande transporten + aanvragen (materiaal/kapot) + gegenereerde voorstellen en bulkacties.
- **Belangrijkste API-routes (client → server):** 
  - `GET /api/transport-taken` (routes/transport.js:8)
  - `GET /api/ritten` (routes/transport.js:749)
  - `GET /api/voertuig-types` (routes/transport.js:800)
  - `GET /api/sport` (routes/sport.js:8)
  - `GET /api/gedeeld` (routes/bakken.js:360)
  - `GET /api/verbruik` (routes/voorraad.js:7)
  - `POST /api/transport-taken/bulk-ontkoppel` (routes/transport.js:579)
  - `POST /api/ritten` (routes/transport.js:753)
  - `DELETE /api/transport-taken/:p` (routes/transport.js:631)
  - `GET /api/aanvragen:p:p` (routes/aanvragen.js:11, routes/bakken.js:28, routes/bakken.js:120, routes/bakken.js:145, routes/bakken.js:237, routes/bakken.js:346, routes/bakken.js:360, routes/beheer.js:19, routes/beheer.js:49, routes/beheer.js:60, routes/beheer.js:105, routes/beheer.js:119, routes/conflicten.js:7, routes/locaties.js:7, routes/locaties.js:27, routes/locaties.js:88, routes/locaties.js:140, routes/personeel.js:7, routes/planning.js:51, routes/planning.js:137, routes/planning.js:154, routes/planning.js:159, routes/planning.js:197, routes/sport.js:8, routes/themas.js:8, routes/themas.js:139, routes/themas.js:143, routes/themas.js:146, routes/themas.js:162, routes/transport.js:8, routes/transport.js:749, routes/transport.js:800, routes/transport.js:1006, routes/transport.js:1209, routes/voorraad.js:7, routes/voorraad.js:46, routes/voorraad.js:63, routes/voorraad.js:72, routes/voorraad.js:169, routes/voorraad.js:277)
  - `GET /api/aanvragen` (routes/aanvragen.js:11)
  - `PUT /api/aanvragen/:p/status` (routes/aanvragen.js:70)

### `#sec-transporten` — 🚚 Transport (subtab Alle transporten)

- **Navigatie:** `goTo('transporten')` (index.html:1022); HTML regels 1191-1239
- **Renderfunctie:** `renderTransportenOV()` (index.html:3089-3169)
- **Toont:** Overzichtslijst van alle transporten met type-/periodefilters, bulk-verwijderen, CSV-export en voertuigbezetting per week.
- **Belangrijkste API-routes (client → server):** 
  - `GET /api/transport-taken` (routes/transport.js:8)
  - `PUT /api/transport-taken/:p/status` (routes/transport.js:701)
  - `GET /api/voertuig-bezetting` (routes/transport.js:1209)

### `#sec-materiaal` — 📦 Materiaal

- **Navigatie:** `goTo('materiaal')` (index.html:442); HTML regels 703-1013
- **Renderfunctie:** `renderMateriaal()` (index.html:2477-2481)
- **Toont:** Materiaalbeheer met subtabs; onthoudt de laatst gekozen subtab in `matSubtab` (standaard `themabakken`).
- **Belangrijkste API-routes (client → server):** 
  - `GET /api/alle-bakken` (routes/bakken.js:28)
  - `GET /api/attributen` (routes/bakken.js:237)
  - `GET /api/vast-types` (routes/locaties.js:27)
  - `GET /api/vaste-bakken` (routes/bakken.js:145)
  - `GET /api/gedeeld` (routes/bakken.js:360)
  - `GET /api/kleurenborden-stock/:p` (routes/locaties.js:170)
  - `GET /api/stock-overzicht` (routes/bakken.js:120)
  - `GET /api/bestellijst` (routes/voorraad.js:63)
  - `GET /api/sport` (routes/sport.js:8)
  - `GET /api/verbruik` (routes/voorraad.js:7)
  - `GET /api/locaties/:p/materiaal` (routes/locaties.js:94)
  - `GET /api/standaard` (routes/locaties.js:88)
  - `GET /api/voertuig-types` (routes/transport.js:800)
  - `GET /api/nakijk/urgentie` (routes/voorraad.js:87)
  - `GET /api/nakijk` (routes/voorraad.js:72)
  - `GET /api/nakijk-tekorten` (routes/voorraad.js:169)

| Sub-container (id) | Knop | Renderfunctie | Toont |
|---|---|---|---|
| `#mat-sub-themabakken` | Themabakken | `renderThemabakken` | Thema's met hun bakken en inhoud + "Waar is…?"-zoeker. |
| `#mat-sub-vastebakken` | Vaste bakken | `renderVasteBakken` | Vaste bakken (EHBO, sportkoffer…) beheren + nieuwe aanmaken. |
| `#mat-sub-voorraad` | Voorraad | `renderVoorraadTab` | Verbruiksstock met zoek/categorie/filter en bestellijst. |
| `#mat-sub-sport` | Sport | `renderSportMateriaal` | Sportmateriaal-inventaris. |
| `#mat-sub-nakijken` | Nakijken | `laadNakijken + renderNakijkTekorten` | Tekorten uit KV-vrijdagcontroles; sub-subtabs Per controle / Tekortendashboard (`setNkInnerTab`). |
| `#mat-sub-themas` | Thema's beheer (knop rechts) | `renderThemas + renderThemaCatBeheer` | Compacte themalijst met paginering, import/export, backup, nieuw thema, categorieën. |
| `#mat-sub-gedeeld` | Gedeeld (knop verborgen, display:none) | `renderGedeeldTab` | Gedeeld materiaal (ovens, muziekboxen…). |
| `#mat-sub-catalogus` | Alle artikelen (knop verborgen) | `renderCatalogus` | Catalogus van alle materialen met filter/groepering/paginering. |
| `#mat-sub-standaard` | (geen knop; alleen via code bereikbaar) | `renderStandaard` | Standaardmateriaal per locatie (Basis + per kamplocatie). |
| `#mat-sub-voertuigen` | (geen knop; alleen via code bereikbaar) | `renderVoertuigen` | Voertuigtypes en capaciteit (bakken). |

API per subweergave:

- `#mat-sub-themabakken`: `GET /api/alle-bakken` (routes/bakken.js:28); `GET /api/attributen` (routes/bakken.js:237); `GET /api/vast-types` (routes/locaties.js:27); `GET /api/waar-is` (routes/bakken.js:346)
- `#mat-sub-vastebakken`: `GET /api/vaste-bakken` (routes/bakken.js:145); `PUT /api/vaste-bakken/:p` (routes/bakken.js:178); `GET /api/vaste-bakken/:p/spreiding` (routes/themas.js:179); `DELETE /api/vaste-bakken/:p` (routes/bakken.js:200); `DELETE /api/vaste-bak-items/:p` (routes/bakken.js:222); `POST /api/vaste-bakken/:p/items` (routes/bakken.js:204)
- `#mat-sub-voorraad`: `GET /api/stock-overzicht` (routes/bakken.js:120); `GET /api/bestellijst` (routes/voorraad.js:63); `POST /api/voorraad` (routes/voorraad.js:52)
- `#mat-sub-sport`: `GET /api/sport` (routes/sport.js:8); `POST /api/sport` (routes/sport.js:23); `DELETE /api/sport/sets/:p` (routes/sport.js:57, routes/sport.js:113); `DELETE /api/sport/:p` (routes/sport.js:37); `POST /api/sport/:p/sets` (routes/sport.js:46)
- `#mat-sub-nakijken`: `GET /api/nakijk/urgentie` (routes/voorraad.js:87); `GET /api/nakijk` (routes/voorraad.js:72); `GET /api/nakijk-tekorten` (routes/voorraad.js:169); `GET /api/nakijk-tekorten/aantal-open` (routes/voorraad.js:204); `POST /api/nakijk-regels/:p/aanvullen` (routes/voorraad.js:211); `POST /api/nakijk-regels/:p/voorraadrij-aanmaken` (routes/voorraad.js:231); `POST /api/nakijk-regels/:p/besteld` (routes/voorraad.js:247); `POST /api/nakijk-regels/:p/genegeerd` (routes/voorraad.js:254); `PUT /api/nakijk-sessies/:p/verwerkt` (routes/voorraad.js:262); `GET /api/tekorten-dashboard` (routes/voorraad.js:277)
- `#mat-sub-themas`: `GET /api/gedeeld` (routes/bakken.js:360); `PUT /api/themas/:p` (routes/themas.js:10); `POST /api/kampmomenten` (routes/planning.js:56); `POST /api/kampmomenten/:p/themas` (routes/planning.js:125); `GET /api/kampmomenten` (routes/planning.js:51); `POST /api/themas/:p/bakken` (routes/bakken.js:36); `POST /api/themas/:p/bundels` (routes/themas.js:28); `GET /api/themas/:p/bakken` (routes/bakken.js:26); `GET /api/themas/:p/bundels` (routes/themas.js:25); `GET /api/bundels/bestanden` (routes/themas.js:19); `DELETE /api/themas/:p` (routes/themas.js:11); `PUT /api/themas/:p/materiaal/:p` (routes/themas.js:13); `POST /api/gedeeld/:p/gebruik` (routes/bakken.js:411); `DELETE /api/themas/:p/materiaal/:p` (routes/themas.js:14); `DELETE /api/gedeeld/:p/gebruik/:p` (routes/bakken.js:416); `POST /api/themas/:p/materiaal` (routes/themas.js:12); `DELETE /api/thema-categorieen/:p` (routes/themas.js:152)
- `#mat-sub-gedeeld`: `GET /api/gedeeld` (routes/bakken.js:360); `GET /api/kleurenborden-stock/:p` (routes/locaties.js:170); `POST /api/kleurenborden-stock/:p` (routes/locaties.js:173)
- `#mat-sub-catalogus`: `GET /api/sport` (routes/sport.js:8); `GET /api/gedeeld` (routes/bakken.js:360); `GET /api/verbruik` (routes/voorraad.js:7); `GET /api/locaties/:p/materiaal` (routes/locaties.js:94)
- `#mat-sub-standaard`: `GET /api/standaard` (routes/locaties.js:88); `GET /api/locaties/:p/materiaal` (routes/locaties.js:94); `GET /api/gedeeld` (routes/bakken.js:360); `GET /api/sport` (routes/sport.js:8); `GET /api/verbruik` (routes/voorraad.js:7); `PUT /api/standaard/:p` (routes/locaties.js:90); `DELETE /api/standaard/:p` (routes/locaties.js:91); `POST /api/standaard` (routes/locaties.js:89); `POST /api/locaties/:p/basis/:p` (routes/locaties.js:96); `PUT /api/locatie-materiaal/:p` (routes/locaties.js:111); `DELETE /api/locatie-materiaal/:p` (routes/locaties.js:118); `POST /api/locaties/:p/materiaal` (routes/locaties.js:105)
- `#mat-sub-voertuigen`: `GET /api/voertuig-types` (routes/transport.js:800); `PUT /api/voertuig-types/:p` (routes/transport.js:808); `DELETE /api/voertuig-types/:p` (routes/transport.js:817); `POST /api/voertuig-types` (routes/transport.js:801)

### `#sec-planning` — 📍 Locaties

- **Navigatie:** `goTo('planning')` (index.html:443); HTML regels 534-552
- **Renderfunctie:** `renderPlanning()` (index.html:2196-2198)
- **Toont:** Locatielijst links, detail/formulier rechts (kamp- en stockagelocaties, contact, kalender open/dicht, materiaal).
- **Belangrijkste API-routes (client → server):** 
  - `GET /api/locaties/:p/materiaal` (routes/locaties.js:94)
  - `GET /api/sport` (routes/sport.js:8)
  - `GET /api/gedeeld` (routes/bakken.js:360)
  - `GET /api/vast-types` (routes/locaties.js:27)
  - `GET /api/locatie-config/:p` (routes/locaties.js:30)
  - `GET /api/kleurenborden` (routes/locaties.js:140)
  - `GET /api/kleurenborden-stock/:p` (routes/locaties.js:170)

### `#sec-kaart` — 🗺️ Kaart

- **Navigatie:** `goTo('kaart')` (index.html:444); HTML regels 584-603
- **Renderfunctie:** `renderKaart()` (index.html:6826-6849)
- **Toont:** Leaflet-kaart met locatie-markers, zoek/type/rit-filter en coördinaten ophalen.
- **Belangrijkste API-routes (client → server):** 
  - `GET /api/locaties` (routes/locaties.js:7)
  - `GET /api/ritten` (routes/transport.js:749)

### `#sec-personeel` — 👥 Personeel

- **Navigatie:** `goTo('personeel')` (index.html:445); HTML regels 608-697
- **Renderfunctie:** `renderPersoneel()` (index.html:9439-9442)
- **Toont:** Personeelsbeheer met subtabs Overzicht / KV's / Chauffeurs / Kantoor, plus modals persoon en shift.
- **Belangrijkste API-routes (client → server):** 
  - `GET /api/personeel` (routes/personeel.js:7)

| Sub-container (id) | Knop | Renderfunctie | Toont |
|---|---|---|---|
| `#pers-sub-overzicht` | Overzicht | `renderPersoneelOverzicht` | Alle personen met naamzoek en weekfilter. |
| `#pers-sub-kv` | KV's | `renderPersoneelRol('kv')` | Kampverantwoordelijken. |
| `#pers-sub-chauffeurs` | Chauffeurs | `renderPersoneelRol('chauffeur')` | Chauffeurs. |
| `#pers-sub-kantoor` | Kantoor | `renderPersoneelRol('kantoor')` | Kantoor. |

API per subweergave:

- `#pers-sub-overzicht`: `DELETE /api/personeel-shifts/:p` (routes/personeel.js:45)
- `#pers-sub-kv`: `DELETE /api/personeel-shifts/:p` (routes/personeel.js:45)
- `#pers-sub-chauffeurs`: `DELETE /api/personeel-shifts/:p` (routes/personeel.js:45)
- `#pers-sub-kantoor`: `DELETE /api/personeel-shifts/:p` (routes/personeel.js:45)

### `#sec-seizoensoverzicht` — (geen hoofdknop; link onderaan Alle transporten, index.html:1236)

- **Navigatie:** `goTo('seizoensoverzicht')` (index.html:1236); HTML regels 9114-9121
- **Renderfunctie:** `renderSeizoensoverzicht()` (index.html:9717-9750)
- **Toont:** Grid van alle locaties per week voor het hele seizoen; klik op een cel springt naar de weekplanning.
- **Belangrijkste API-routes (client → server):** 
  - `GET /api/seizoensoverzicht` (routes/planning.js:197)
  - `POST /api/ritten` (routes/transport.js:753)
  - `PUT /api/ritten/:p` (routes/transport.js:767)

## 3. Publieke pagina's (server-gerenderd)

| Route | Bestand | Doel | Auth |
|---|---|---|---|
| `GET /rit/:token` | routes/transport.js:1101-1206 | Chauffeurspagina voor één rit: stops (met "Ik ben aangekomen"), materiaallijst per rek met Laden/Lossen-knoppen | Geen sessie; token = `transport_ritten.rit_token`; 404-tekst "Rit niet gevonden of link verlopen." |
| `GET /kv/:token` | routes/kv.js:143-496 | KV-scherm met 4 (of 5) tabs: Wat moet er staan, Vrijdagcontrole, Iets nodig?, Iets kapot?, (Boodschappen) | Geen sessie; token = `kampmomenten.kv_token`; 404-tekst "Link niet gevonden of verlopen." |

Bijbehorende publieke API-routes (prefixen `/api/rit-token/` en `/api/kv/` in `lib/auth.js:58`):

- `POST /api/rit-token/:token/taken/:taakId/aangekomen` — routes/transport.js:969
- `POST /api/rit-token/:token/checks/:checkId/laden` — routes/transport.js:926
- `POST /api/rit-token/:token/checks/:checkId/lossen` — routes/transport.js:943
- `GET /api/kv/:token/data` — routes/kv.js:7
- `POST /api/kv/:token/bakken/:bakId/tellen` — routes/kv.js:51
- `POST /api/kv/:token/attributen/:attrId/status` — routes/kv.js:90
- `POST /api/kv/:token/versturen` — routes/kv.js:109
- `POST /api/kv/:token/aanvraag` — routes/kv.js:118
- `POST /api/kv/:token/kapot` — routes/kv.js:128

## 4. Overige server-routes (server.js)

- Statisch: `/bundels` (server.js:58), `/uploads` (server.js:61), `express.static(FRONTEND_PATH)` (server.js:68) — serveert `index.html`, `sw.js`, `manifest.json`.
- Catch-all: `app.get('*')` → `index.html` (server.js:116) — elke onbekende GET-URL toont de kantoor-app.
- Routemodules: `routes/{aanvragen,bakken,beheer,conflicten,kv,locaties,personeel,planning,sport,themas,transport,voorraad}.js` worden in server.js:~105-108 geladen (`require('./routes/'+naam)(ctx)`).
- Globale Basic-auth-muur via `APP_PASSWORD` (server.js:43-56) en sessielogin (`lib/auth.js`).

## 5. Volledige lijst API-routes per modulebestand (server)

### routes/aanvragen.js

- `GET /api/aanvragen` (routes/aanvragen.js:11)
- `POST /api/aanvragen` (routes/aanvragen.js:24)
- `PUT /api/aanvragen/:id/status` (routes/aanvragen.js:70)

### routes/bakken.js

- `GET /api/themas/:id/bakken` (routes/bakken.js:26)
- `GET /api/alle-bakken` (routes/bakken.js:28)
- `POST /api/themas/:id/bakken` (routes/bakken.js:36)
- `DELETE /api/themas/:themaId/bakken/:bakId` (routes/bakken.js:51)
- `PUT /api/bakken/:id` (routes/bakken.js:55)
- `DELETE /api/bakken/:id` (routes/bakken.js:65)
- `POST /api/bakken/:id/items` (routes/bakken.js:73)
- `PUT /api/bak-items/:id` (routes/bakken.js:80)
- `DELETE /api/bak-items/:id` (routes/bakken.js:92)
- `GET /api/bakken/:id/items-detail` (routes/bakken.js:96)
- `POST /api/bakken/:id/nakijk` (routes/bakken.js:102)
- `GET /api/stock-overzicht` (routes/bakken.js:120)
- `GET /api/vaste-bakken` (routes/bakken.js:145)
- `POST /api/vaste-bakken/:id/foto-slot` (routes/bakken.js:150)
- `DELETE /api/vaste-bakken/:id/foto-slot/:slot` (routes/bakken.js:161)
- `POST /api/vaste-bakken` (routes/bakken.js:169)
- `PUT /api/vaste-bakken/:id` (routes/bakken.js:178)
- `DELETE /api/vaste-bakken/:id` (routes/bakken.js:200)
- `POST /api/vaste-bakken/:id/items` (routes/bakken.js:204)
- `PUT /api/vaste-bak-items/:id` (routes/bakken.js:213)
- `DELETE /api/vaste-bak-items/:id` (routes/bakken.js:222)
- `GET /api/attributen` (routes/bakken.js:237)
- `GET /api/themas/:id/attributen` (routes/bakken.js:238)
- `POST /api/attributen` (routes/bakken.js:239)
- `PUT /api/attributen/:id` (routes/bakken.js:251)
- `DELETE /api/attributen/:id` (routes/bakken.js:260)
- `POST /api/themas/:id/attributen` (routes/bakken.js:267)
- `DELETE /api/themas/:themaId/attributen/:attrId` (routes/bakken.js:274)
- `GET /api/themas/:id/behoefte` (routes/bakken.js:280)
- `POST /api/themas/:id/behoefte` (routes/bakken.js:284)
- `PUT /api/themas/:themaId/behoefte/:id` (routes/bakken.js:299)
- `DELETE /api/themas/:themaId/behoefte/:id` (routes/bakken.js:307)
- `POST /api/bakken/:id/verplaats` (routes/bakken.js:313)
- `POST /api/attributen/:id/verplaats` (routes/bakken.js:335)
- `GET /api/waar-is` (routes/bakken.js:346)
- `GET /api/gedeeld` (routes/bakken.js:360)
- `POST /api/gedeeld/:id/stock` (routes/bakken.js:382)
- `POST /api/gedeeld` (routes/bakken.js:389)
- `PUT /api/gedeeld/:id` (routes/bakken.js:396)
- `DELETE /api/gedeeld/:id` (routes/bakken.js:403)
- `POST /api/gedeeld/:id/gebruik` (routes/bakken.js:411)
- `DELETE /api/gedeeld/:id/gebruik/:thema_id` (routes/bakken.js:416)
- `GET /api/bakken/:id/fotos` (routes/bakken.js:422)
- `POST /api/bakken/:id/foto` (routes/bakken.js:425)
- `GET /api/bak-fotos/:id` (routes/bakken.js:433)
- `DELETE /api/bak-fotos/:id` (routes/bakken.js:438)

### routes/beheer.js

- `GET /api/export` (routes/beheer.js:19)
- `POST /api/herstel-db` (routes/beheer.js:34)
- `GET /api/backup-db` (routes/beheer.js:49)
- `GET /api/dbinfo` (routes/beheer.js:60)
- `POST /api/import/reset` (routes/beheer.js:67)
- `POST /api/import/tabel` (routes/beheer.js:78)
- `GET /api/log` (routes/beheer.js:105)
- `GET /api/wijzigingen` (routes/beheer.js:119)
- `GET /sw.js` (routes/beheer.js:133)
- `GET /manifest.json` (routes/beheer.js:147)

### routes/conflicten.js

- `GET /api/conflicten` (routes/conflicten.js:7)

### routes/kv.js

- `GET /api/kv/:token/data` (routes/kv.js:7)
- `POST /api/kv/:token/bakken/:bakId/tellen` (routes/kv.js:51)
- `POST /api/kv/:token/attributen/:attrId/status` (routes/kv.js:90)
- `POST /api/kv/:token/versturen` (routes/kv.js:109)
- `POST /api/kv/:token/aanvraag` (routes/kv.js:118)
- `POST /api/kv/:token/kapot` (routes/kv.js:128)
- `GET /kv/:token` (routes/kv.js:143)

### routes/locaties.js

- `GET /api/locaties` (routes/locaties.js:7)
- `POST /api/locaties` (routes/locaties.js:8)
- `PUT /api/locaties/:id` (routes/locaties.js:17)
- `GET /api/vast-types` (routes/locaties.js:27)
- `GET /api/locatie-config/:locatie_id` (routes/locaties.js:30)
- `POST /api/locatie-config` (routes/locaties.js:33)
- `DELETE /api/locatie-config/:id` (routes/locaties.js:47)
- `DELETE /api/locaties/:id` (routes/locaties.js:52)
- `POST /api/locaties/geocode` (routes/locaties.js:60)
- `GET /api/standaard` (routes/locaties.js:88)
- `POST /api/standaard` (routes/locaties.js:89)
- `PUT /api/standaard/:id` (routes/locaties.js:90)
- `DELETE /api/standaard/:id` (routes/locaties.js:91)
- `GET /api/locaties/:id/materiaal` (routes/locaties.js:94)
- `POST /api/locaties/:id/basis/:sid` (routes/locaties.js:96)
- `POST /api/locaties/:id/materiaal` (routes/locaties.js:105)
- `PUT /api/locatie-materiaal/:id` (routes/locaties.js:111)
- `DELETE /api/locatie-materiaal/:id` (routes/locaties.js:118)
- `POST /api/locaties/:id/materiaal-van-template` (routes/locaties.js:123)
- `GET /api/kleurenborden` (routes/locaties.js:140)
- `POST /api/kleurenborden` (routes/locaties.js:143)
- `PUT /api/kleurenborden/:id` (routes/locaties.js:149)
- `DELETE /api/kleurenborden/:id` (routes/locaties.js:153)
- `POST /api/kleurenborden/bulk` (routes/locaties.js:158)
- `GET /api/kleurenborden-stock/:locatie_id` (routes/locaties.js:170)
- `POST /api/kleurenborden-stock/:locatie_id` (routes/locaties.js:173)
- `PUT /api/transport-taken/:id/rit` (routes/locaties.js:184)

### routes/personeel.js

- `GET /api/personeel` (routes/personeel.js:7)
- `POST /api/personeel` (routes/personeel.js:19)
- `PUT /api/personeel/:id` (routes/personeel.js:26)
- `DELETE /api/personeel/:id` (routes/personeel.js:32)
- `POST /api/personeel/:id/shifts` (routes/personeel.js:33)
- `PUT /api/personeel-shifts/:id` (routes/personeel.js:39)
- `DELETE /api/personeel-shifts/:id` (routes/personeel.js:45)
- `GET /api/personeel/week/:week` (routes/personeel.js:47)

### routes/planning.js

- `GET /api/kampmomenten` (routes/planning.js:51)
- `POST /api/kampmomenten` (routes/planning.js:56)
- `PUT /api/kampmomenten/:id` (routes/planning.js:89)
- `POST /api/kampmomenten/:id/kv-token` (routes/planning.js:106)
- `DELETE /api/kampmomenten/:id` (routes/planning.js:115)
- `POST /api/kampmomenten/:id/themas` (routes/planning.js:125)
- `DELETE /api/kampmomenten/:id/themas/:ktid` (routes/planning.js:131)
- `GET /api/kalender` (routes/planning.js:137)
- `POST /api/kalender/toggle` (routes/planning.js:152)
- `POST /api/kalender/bulk` (routes/planning.js:153)
- `GET /api/gesloten` (routes/planning.js:154)
- `POST /api/gesloten` (routes/planning.js:155)
- `DELETE /api/gesloten/:id` (routes/planning.js:156)
- `GET /api/periodes` (routes/planning.js:159)
- `GET /api/periodes/actief` (routes/planning.js:160)
- `POST /api/periodes/:id/activeer` (routes/planning.js:162)
- `POST /api/periodes` (routes/planning.js:170)
- `PUT /api/periodes/:id` (routes/planning.js:179)
- `DELETE /api/periodes/:id` (routes/planning.js:187)
- `GET /api/seizoensoverzicht` (routes/planning.js:197)

### routes/sport.js

- `GET /api/sport` (routes/sport.js:8)
- `POST /api/sport` (routes/sport.js:23)
- `PUT /api/sport/:id` (routes/sport.js:30)
- `DELETE /api/sport/:id` (routes/sport.js:37)
- `POST /api/sport/:id/sets` (routes/sport.js:46)
- `PUT /api/sport/sets/:id` (routes/sport.js:52)
- `DELETE /api/sport/sets/:id` (routes/sport.js:57)
- `POST /api/sport/sets/:id/plan` (routes/sport.js:64)
- `POST /api/sport/:id/foto` (routes/sport.js:85)
- `DELETE /api/sport/:id/foto` (routes/sport.js:113)

### routes/themas.js

- `GET /api/themas` (routes/themas.js:8)
- `POST /api/themas` (routes/themas.js:9)
- `PUT /api/themas/:id` (routes/themas.js:10)
- `DELETE /api/themas/:id` (routes/themas.js:11)
- `POST /api/themas/:id/materiaal` (routes/themas.js:12)
- `PUT /api/themas/:tid/materiaal/:mid` (routes/themas.js:13)
- `DELETE /api/themas/:tid/materiaal/:mid` (routes/themas.js:14)
- `GET /api/bundels/bestanden` (routes/themas.js:19)
- `GET /api/themas/:id/bundels` (routes/themas.js:25)
- `POST /api/themas/:id/bundels` (routes/themas.js:28)
- `DELETE /api/thema-bundels/:id` (routes/themas.js:39)
- `GET /api/import-themas/preview` (routes/themas.js:71)
- `POST /api/import-themas` (routes/themas.js:81)
- `POST /api/import-themas/data` (routes/themas.js:116)
- `GET /api/materiaal` (routes/themas.js:139)
- `POST /api/materiaal` (routes/themas.js:140)
- `PUT /api/materiaal/:id` (routes/themas.js:141)
- `DELETE /api/materiaal/:id` (routes/themas.js:142)
- `GET /api/overzicht` (routes/themas.js:143)
- `GET /api/thema-categorieen` (routes/themas.js:146)
- `POST /api/thema-categorieen` (routes/themas.js:147)
- `DELETE /api/thema-categorieen/:id` (routes/themas.js:152)
- `GET /api/item-types` (routes/themas.js:162)
- `POST /api/item-types` (routes/themas.js:163)
- `PUT /api/item-types/:id` (routes/themas.js:169)
- `DELETE /api/item-types/:id` (routes/themas.js:174)
- `GET /api/vaste-bakken/:id/spreiding` (routes/themas.js:179)
- `GET /api/catalogus-item/:type/:id` (routes/themas.js:188)

### routes/transport.js

- `GET /api/transport-taken` (routes/transport.js:8)
- `POST /api/transport-genereer` (routes/transport.js:9)
- `POST /api/transport-taken/bulk-ontkoppel` (routes/transport.js:579)
- `POST /api/transport-taken/bulk-move` (routes/transport.js:586)
- `POST /api/transport-taken/bulk-delete` (routes/transport.js:598)
- `POST /api/transport-taken/:id/splits` (routes/transport.js:609)
- `POST /api/transport-taken` (routes/transport.js:629)
- `PUT /api/transport-taken/:id` (routes/transport.js:630)
- `DELETE /api/transport-taken/:id` (routes/transport.js:631)
- `PUT /api/transport-taken/:id/status` (routes/transport.js:701)
- `PUT /api/transport-taken/:id/move` (routes/transport.js:715)
- `POST /api/transport-regels` (routes/transport.js:727)
- `DELETE /api/transport-regels/:id` (routes/transport.js:728)
- `GET /api/ritten` (routes/transport.js:749)
- `POST /api/ritten` (routes/transport.js:753)
- `PUT /api/ritten/:id` (routes/transport.js:767)
- `DELETE /api/ritten/:id` (routes/transport.js:784)
- `GET /api/voertuig-types` (routes/transport.js:800)
- `POST /api/voertuig-types` (routes/transport.js:801)
- `PUT /api/voertuig-types/:id` (routes/transport.js:808)
- `DELETE /api/voertuig-types/:id` (routes/transport.js:817)
- `GET /api/ritten/:id/checks` (routes/transport.js:820)
- `POST /api/ritten/:id/checks/init` (routes/transport.js:827)
- `GET /api/checks/item-historie` (routes/transport.js:847)
- `PUT /api/checks/:id` (routes/transport.js:866)
- `POST /api/ritten/:id/klaarzet` (routes/transport.js:877)
- `POST /api/rit-token/:token/checks/:checkId/laden` (routes/transport.js:926)
- `POST /api/rit-token/:token/checks/:checkId/lossen` (routes/transport.js:943)
- `POST /api/rit-token/:token/taken/:taakId/aangekomen` (routes/transport.js:969)
- `POST /api/terugkomst` (routes/transport.js:980)
- `GET /api/terugkomst` (routes/transport.js:1006)
- `POST /api/spoedtransport` (routes/transport.js:1013)
- `POST /api/ritten/:id/token` (routes/transport.js:1060)
- `GET /rit/:token` (routes/transport.js:1101)
- `GET /api/voertuig-bezetting` (routes/transport.js:1209)
- `PUT /api/kampmoment-themas/:id/retour` (routes/transport.js:1222)

### routes/voorraad.js

- `GET /api/verbruik` (routes/voorraad.js:7)
- `POST /api/verbruik/:id/stock` (routes/voorraad.js:21)
- `GET /api/voorraad/nakijken` (routes/voorraad.js:30)
- `GET /api/voorraad` (routes/voorraad.js:46)
- `POST /api/voorraad` (routes/voorraad.js:52)
- `GET /api/bestellijst` (routes/voorraad.js:63)
- `GET /api/nakijk` (routes/voorraad.js:72)
- `GET /api/nakijk/urgentie` (routes/voorraad.js:87)
- `POST /api/nakijk/start` (routes/voorraad.js:113)
- `PUT /api/nakijk/:id/kv` (routes/voorraad.js:130)
- `PUT /api/nakijk/:id/kantoor` (routes/voorraad.js:145)
- `DELETE /api/nakijk/:id` (routes/voorraad.js:153)
- `GET /api/nakijk-tekorten` (routes/voorraad.js:169)
- `GET /api/nakijk-tekorten/aantal-open` (routes/voorraad.js:204)
- `POST /api/nakijk-regels/:id/aanvullen` (routes/voorraad.js:211)
- `POST /api/nakijk-regels/:id/voorraadrij-aanmaken` (routes/voorraad.js:231)
- `POST /api/nakijk-regels/:id/besteld` (routes/voorraad.js:247)
- `POST /api/nakijk-regels/:id/genegeerd` (routes/voorraad.js:254)
- `PUT /api/nakijk-sessies/:id/verwerkt` (routes/voorraad.js:262)
- `GET /api/tekorten-dashboard` (routes/voorraad.js:277)

### server.js

- `POST /api/_test/sigterm` (server.js:112)
- `GET /api/_test/schrijfacties` (server.js:113)

