# Pagina's — dependency trees

> Pad: `D:\Sporty\sporty-railway\index.html` (één bestand, inline CSS + JS, 9.783 regels). Alle regelnummers verwijzen naar dat bestand tenzij anders vermeld. De bomen zijn automatisch gegenereerd door statische analyse van `function naam(`-definities op regelbegin (genest gedefinieerde functies en `const x=()=>`-functies zijn niet meegenomen). Gedeelde hulpfuncties (`api`, `showToast`, `_escH`, `_attrH`, `fIso`, `fDag`, `openModal`, `closeModal`, `bevestig`, `vraagModal`, `isoLocal`, `_appNow`, `showLoginScreen`) zijn bewust niet uitgevouwen.

## 0. Gedeelde basis voor elk scherm

- App-shell: `<div class="app">` met `.topbar` (413-436), `.nav` (438-446), `.content` (448-1241) — zie layouts.md.
- Routing: `SECS` + `goTo(id)` (index.html:1995-2037).
- Boot: `checkLoginOnStart()` → `bootApp()` (8770) → `loadAll()` (3892) → vult `S` (locaties, themas, standaard, kampmomenten, materiaal, overzicht, periodes) + `kalData`.
- Netwerk: `api(method,path,body)` (3764-3793) met header `x-auth-token` uit `localStorage['sporty-auth-token']`.
- Feedback: `showToast` (3488), `vraagModal`/`bevestig` (3423/3482), `openModal/closeModal` (3910-3911).
- Globale state: `let S` (3753), `kalData` (3503), `plannerTaken`, `S_chauffeurs`, `_simDate` (tijdmachine).

## 1. Overzicht / dashboard

- **Ingang:** Nav-knop `📊 Overzicht` → `goTo('overzicht')` (index.html:439); sectie `#sec-overzicht`; binnen de sectie schakelen `ov-view-btn`-knoppen tussen Overzicht / Week materiaal / Conflicten / Periodes / Rooster (index.html:455-461).
- **Statische HTML (index.html):** regels 453-528 (sec-overzicht incl. ov-main, week-mat-ov, conflict-ov, rooster-ov, periodes-ov)
- **Wortel-functies:** `renderOverzicht()` (2113-2187), `showOvMain()` (1505-1512), `showWeekMatOverzicht()` (1650-1669), `showPeriodesBeheer()` (1680-1688), `showRooster()` (1521-1529), `exportKampoverzichtCSV()` (8819-8831)
- **Opmerking:** `renderOverzicht` vult alleen `#ov-main` (4 metrics, aankomende transporten, kampmomenten). De sub-weergaven (Week materiaal, Periodes, Rooster) hebben eigen show*-functies; Conflicten staat apart in scherm 8.

### Functie-boom (diepte 3; `(verder: …)` = niet verder uitgevouwen)

- `renderOverzicht()` — index.html:2113-2187
  - `updateAanvragenBadge()` — index.html:3905-3909
  - `openEditTp()` — index.html:7988-8007
    - `fillTpLocs()` — index.html:8008-8008
    - `fillThemaAddSelect()` — index.html:7960-7963
    - `fillMatDatalist()` — index.html:7956-7959
      - `_materiaalKeuzeOpts()` — index.html:5643-5650
    - `renderTpRegels()` — index.html:8009-8009
  - `weekVoorDatum()` — index.html:4276-4283
    - `_periodeVoorDatum()` — index.html:4266-4274
      - `_activePeriode()` — index.html:4225-4232
    - `_periodeMaxWeken()` — index.html:4259-4264
      - `_activePeriode()` — index.html:4225-4232 (zie hierboven)
  - `getWeekDagen()` — index.html:4238-4245
    - `_activePeriode()` — index.html:4225-4232 (zie hierboven)
    - `getWeekMaandag()` — index.html:4233-4237
      - `_activePeriode()` — index.html:4225-4232 (zie hierboven)
- `showOvMain()` — index.html:1505-1512
- `showWeekMatOverzicht()` — index.html:1650-1669
  - `_periodeMaxWeken()` — index.html:4259-4264 (zie hierboven)
  - `weekVoorDatum()` — index.html:4276-4283 (zie hierboven)
  - `renderWeekMateriaalOverzicht()` — index.html:1765-1839
- `showPeriodesBeheer()` — index.html:1680-1688
  - `renderPeriodesList()` — index.html:1689-1708
    - `setActivePeriode()` — index.html:1753-1762
      - `renderPeriodesList()` — index.html:1689-1708 (zie hierboven)
    - `editPeriode()` — index.html:1718-1726
    - `deletePeriode()` — index.html:1745-1752
      - `renderPeriodesList()` — index.html:1689-1708 (zie hierboven)
- `showRooster()` — index.html:1521-1529
  - `renderRooster()` — index.html:1530-1570
    - `_activePeriode()` — index.html:4225-4232 (zie hierboven)
    - `_periodeMaxWeken()` — index.html:4259-4264 (zie hierboven)
    - `getWeekDagen()` — index.html:4238-4245 (zie hierboven)
    - `selectKpCell()` — index.html:1574-1628
      - `openBewerkKampmoment()` — index.html:4525-4564
        - (verder: `_fillKmPeriodeSelect`, `updateKmWeekMax`, `updateKmPreview`, `setKmType`, `_renderKmDagUI`, `renderKmCheckboxes`, `_fillKmSportSectie`, `_fillKmKvSelect`)
    - `openBewerkKampmoment()` — index.html:4525-4564 (zie hierboven)
    - `openNieuwKampmoment()` — index.html:4503-4524
      - `_fillKmPeriodeSelect()` — index.html:4432-4438
      - `updateKmWeekMax()` — index.html:4439-4445
        - (verder: `_periodeMaxWeken`)
      - `setKmType()` — index.html:4448-4459
      - `renderKmCheckboxes()` — index.html:4685-4689
      - `_renderKmDagUI()` — index.html:4473-4490
        - (verder: `kmDagRemoveThema`, `kmDagAddThema`)
      - `updateKmPreview()` — index.html:4674-4684
        - (verder: `_periodeMaxWeken`, `getWeekDagen`)
      - `_fillKmSportSectie()` — index.html:4599-4640
        - (verder: `kmModalRemoveSport`, `kmModalNeemSportOver`)
      - `_fillKmKvSelect()` — index.html:4566-4576
        - (verder: `_kmKvChanged`)
- `exportKampoverzichtCSV()` — index.html:8819-8831
  - `_downloadCSV()` — index.html:8800-8800

Gedeelde hulpfuncties die hier worden aangeroepen en niet uitgevouwen zijn: `api`, `_appNow`, `isoLocal`, `fIso`, `_escH`, `fDag`, `openModal`, `_attrH`, `showToast`, `bevestig`.

### CSS-klassen (uit index.html `<style>`, regelnummers van de definitie)

`.active` (l.22,23,26…), `.b` (l.31), `.bi` (l.40,41,276…), `.btn-g` (l.52,53), `.btn-o` (l.58,59,251), `.btn-xs` (l.112,113), `.card` (l.32), `.card-hd` (l.33), `.del` (l.41), `.empty` (l.149), `.g` (l.31), `.leeg` (l.261), `.loading` (l.150), `.loc-col` (l.84,180,214…), `.loc-name` (l.86,182,259), `.mat-qty` (l.80), `.mat-row` (l.79), `.metric` (l.28), `.metric-label` (l.29), `.metric-val` (l.30,329), `.metrics` (l.27,271,328…), `.ov-view-btn` (l.194,195,196), `.p-amber` (l.65), `.pill` (l.63), `.r` (l.31), `.ra` (l.39), `.ri` (l.38), `.rm` (l.38), `.rooster-cell` (l.260,261,262…), `.rooster-table` (l.255,256,257…), `.row` (l.34,35,36…), `.rs` (l.38), `.sec` (l.26), `.sel` (l.44,45,50…), `.thema-tag` (l.76), `.vol` (l.263)

_Klassen worden statisch uit `class="…"`-attributen gehaald; klassen die dynamisch uit variabelen worden samengesteld of alleen via inline style werken ontbreken._

### API-routes (client-aanroep → server-handler; transitief over de hele boom, ook functies achter (verder: …))

- `GET /api/transport-taken` → routes/transport.js:8
- `GET /api/aanvragen` → routes/aanvragen.js:11
- `POST /api/periodes/:p/activeer` → routes/planning.js:162
- `GET /api/periodes` → routes/planning.js:159
- `DELETE /api/periodes/:p` → routes/planning.js:187
- `GET /api/themas/:p/bakken` → routes/bakken.js:26
- `POST /api/sport/sets/:p/plan` → routes/sport.js:64
- `GET /api/sport` → routes/sport.js:8
- `GET /api/personeel` → routes/personeel.js:7
- `DELETE /api/kampmomenten/:p/themas/:p` → routes/planning.js:131
- `POST /api/kampmomenten/:p/themas` → routes/planning.js:125
- `GET /api/kampmomenten` → routes/planning.js:51

## 2. Kampplanner

- **Ingang:** Nav-knop `🏕️ Kampplanner` → `goTo('kampplanner')` (index.html:440); subtabs Rooster / Per locatie / Per week / Per thema / Sportpakketten via `setKampMode()` (index.html:559-563). Kampmoment toevoegen/bewerken via `#modal-km`.
- **Statische HTML (index.html):** regels 557-579 (sec-kampplanner); regels 1293-1344 (modal-km)
- **Wortel-functies:** `renderKampplanner()` (2230-2234), `setKampMode()` (2208-2217), `openNieuwKampmoment()` (4503-4524), `saveKampmoment()` (4696-4737)
- **Opmerking:** De modus-renderers `_renderKampLocatie/_renderKampWeek/_renderKampThema` staan in de boom via `_renderKampMode`.

### Functie-boom (diepte 3; `(verder: …)` = niet verder uitgevouwen)

- `renderKampplanner()` — index.html:2230-2234
  - `_renderKampMode()` — index.html:2219-2228
    - `renderRooster()` — index.html:1530-1570
      - `_activePeriode()` — index.html:4225-4232
      - `_periodeMaxWeken()` — index.html:4259-4264
        - (verder: `_activePeriode`)
      - `getWeekDagen()` — index.html:4238-4245
        - (verder: `_activePeriode`, `getWeekMaandag`)
      - `selectKpCell()` — index.html:1574-1628
        - (verder: `openBewerkKampmoment`)
      - `openBewerkKampmoment()` — index.html:4525-4564
        - (verder: `_fillKmPeriodeSelect`, `updateKmWeekMax`, `updateKmPreview`, `setKmType`, `_renderKmDagUI`, `renderKmCheckboxes`, `_fillKmSportSectie`, `_fillKmKvSelect`)
      - `openNieuwKampmoment()` — index.html:4503-4524
        - (verder: `_fillKmPeriodeSelect`, `updateKmWeekMax`, `setKmType`, `renderKmCheckboxes`, `_renderKmDagUI`, `updateKmPreview`, `_fillKmSportSectie`, `_fillKmKvSelect`)
    - `_renderKampLocatie()` — index.html:2307-2339
      - `_kpKampLocs()` — index.html:2237-2239
      - `_kpWeken()` — index.html:2240-2242
      - `_kpKm()` — index.html:2243-2245
      - `_kpThemaCell()` — index.html:2250-2266
        - (verder: `_normLG`, `kpSetThema`, `_kpThemaTag`)
      - `_kpSportCell()` — index.html:2268-2280
        - (verder: `kpRemoveSport`, `kpAddSport`)
    - `_renderKampWeek()` — index.html:2342-2374
      - `_kpWeken()` — index.html:2240-2242 (zie hierboven)
      - `_kpKampLocs()` — index.html:2237-2239 (zie hierboven)
      - `_kpKm()` — index.html:2243-2245 (zie hierboven)
      - `_kpThemaCell()` — index.html:2250-2266 (zie hierboven)
      - `_kpSportCell()` — index.html:2268-2280 (zie hierboven)
    - `renderSportPlanningGrid()` — index.html:2422-2468
      - `setSportPlan()` — index.html:2469-2475
        - (verder: `renderSportPlanningGrid`)
    - `_renderKampThema()` — index.html:2377-2421
      - `_kpWeken()` — index.html:2240-2242 (zie hierboven)
      - `_kpKampLocs()` — index.html:2237-2239 (zie hierboven)
      - `_kpKm()` — index.html:2243-2245 (zie hierboven)
      - `kpSetThema()` — index.html:2282-2290
        - (verder: `_normLG`, `_renderKampMode`)
- `setKampMode()` — index.html:2208-2217
  - `_renderKampMode()` — index.html:2219-2228 (zie hierboven)
- `openNieuwKampmoment()` — index.html:4503-4524 (zie hierboven)
- `saveKampmoment()` — index.html:4696-4737
  - `bevestigDubbelThema()` — index.html:1902-1915
  - `renderKampen()` — index.html:4363-4428
    - `_refreshLocDetail()` — index.html:5531-5531
      - `renderLocatieDetail()` — index.html:5689-5871
        - (verder: `_locAddFormHTML`, `_locEditFormHTML`, `loadKalender`, `deleteLocTab`, `saveLocEigenschap`, `saveLocatieConfig`, `verwijderLocatieConfig`, `_locMatRowsHTML`, `openNieuwKampmoment`, `openKleurenborden`, `_kleurBg`, `_kleurFg`, `saveKbStock`, `_initLocDetailMap`, `_loadLocLog`)
    - `getWeekDagen()` — index.html:4238-4245 (zie hierboven)
    - `toggleKalDag()` — index.html:3511-3518
      - `syncKampen()` — index.html:3411-3418
      - `_refreshLocDetail()` — index.html:5531-5531 (zie hierboven)
    - `_kmThemaChipsHTML()` — index.html:4331-4342
      - `removeThemaFromKm()` — index.html:4753-4753
        - (verder: `renderKampen`)
    - `addThemaToKm()` — index.html:4752-4752
      - `bevestigDubbelThema()` — index.html:1902-1915 (zie hierboven)
      - `renderKampen()` — index.html:4363-4428 (zie hierboven)
    - `toggleKmBody()` — index.html:4430-4430
    - `_kmTypeBadge()` — index.html:4354-4362
    - `openBewerkKampmoment()` — index.html:4525-4564 (zie hierboven)
    - `openTerugkomst()` — index.html:6721-6797
    - `deleteKampmoment()` — index.html:4738-4751
      - `renderKampen()` — index.html:4363-4428 (zie hierboven)
      - `renderRooster()` — index.html:1530-1570 (zie hierboven)
      - `_renderKampMode()` — index.html:2219-2228 (zie hierboven)
    - `_kmSportTagsHTML()` — index.html:4294-4304
      - `removeSportFromKm()` — index.html:4323-4327
        - (verder: `renderKampen`)
    - `_kmSportAddHTML()` — index.html:4305-4313
      - `addSportToKm()` — index.html:4314-4322
        - (verder: `renderKampen`)
    - `_kmThemaMatHTML()` — index.html:4343-4353
  - `renderRooster()` — index.html:1530-1570 (zie hierboven)
  - `_refreshLocDetail()` — index.html:5531-5531 (zie hierboven)
  - `_renderKampMode()` — index.html:2219-2228 (zie hierboven)

Gedeelde hulpfuncties die hier worden aangeroepen en niet uitgevouwen zijn: `api`, `fDag`, `_escH`, `_attrH`, `showToast`, `openModal`, `closeModal`, `bevestig`, `isoLocal`.

### CSS-klassen (uit index.html `<style>`, regelnummers van de definitie)

`.active` (l.22,23,26…), `.add-row` (l.108), `.ai` (l.109,110,111…), `.bi` (l.40,41,276…), `.btn-g` (l.52,53), `.btn-o` (l.58,59,251), `.btn-r` (l.56,57), `.btn-xs` (l.112,113), `.card` (l.32), `.card-hd` (l.33), `.dag-feest` (l.75,167), `.dag-pill` (l.72), `.editing` (l.36), `.empty` (l.149), `.exp-body` (l.98), `.exp-card` (l.95,100), `.exp-hd` (l.96,97,101), `.fg` (l.47,48,49…), `.fr` (l.46,350), `.gb` (l.43,45), `.grow` (l.49,111,280), `.inp` (l.42,43,50…), `.kal-subtab` (l.173,174,175), `.km-body` (l.71), `.km-card` (l.68,232,233), `.km-hd` (l.69,70), `.leeg` (l.261), `.loading` (l.150), `.loc-col` (l.84,180,214…), `.loc-contact` (l.309,310,311), `.loc-name` (l.86,182,259), `.mat-block` (l.77), `.mat-block-title` (l.78), `.mat-qty` (l.80), `.mat-row` (l.79), `.md` (l.51,351), `.modal` (l.136,346), `.modal-bg` (l.134,135), `.modal-close` (l.138,139), `.modal-title` (l.137), `.open` (l.88,135,186…), `.p-blue` (l.66), `.p-gray` (l.64), `.pill` (l.63), `.ra` (l.39), `.ri` (l.38), `.rm` (l.38), `.rooster-cell` (l.260,261,262…), `.rooster-table` (l.255,256,257…), `.row` (l.34,35,36…), `.rs` (l.38), `.save` (l.41), `.sec` (l.26), `.sel` (l.44,45,50…), `.sl` (l.62), `.sm` (l.50,111,238…), `.thema-tag` (l.76), `.tk-regel` (l.266,267), `.tk-status-lbl` (l.268,269), `.vol` (l.263)

_Klassen worden statisch uit `class="…"`-attributen gehaald; klassen die dynamisch uit variabelen worden samengesteld of alleen via inline style werken ontbreken._

### API-routes (client-aanroep → server-handler; transitief over de hele boom, ook functies achter (verder: …))

- `GET /api/sport` → routes/sport.js:8
- `GET /api/themas` → routes/themas.js:8
- `GET /api/themas/:p/bakken` → routes/bakken.js:26
- `POST /api/sport/sets/:p/plan` → routes/sport.js:64
- `GET /api/personeel` → routes/personeel.js:7
- `DELETE /api/kampmomenten/:p/themas/:p` → routes/planning.js:131
- `POST /api/kampmomenten/:p/themas` → routes/planning.js:125
- `GET /api/kampmomenten` → routes/planning.js:51
- `PUT /api/kampmomenten/:p` → routes/planning.js:89
- `POST /api/kampmomenten` → routes/planning.js:56
- `GET /api/kalender` → routes/planning.js:137
- `GET /api/locaties/:p/materiaal` → routes/locaties.js:94
- `GET /api/gedeeld` → routes/bakken.js:360
- `GET /api/vast-types` → routes/locaties.js:27
- `GET /api/locatie-config/:p` → routes/locaties.js:30
- `GET /api/kleurenborden` → routes/locaties.js:140
- `GET /api/kleurenborden-stock/:p` → routes/locaties.js:170
- `POST /api/locaties` → routes/locaties.js:8
- `PUT /api/locaties/:p` → routes/locaties.js:17
- `GET /api/log` → routes/beheer.js:105
- `DELETE /api/locaties/:p` → routes/locaties.js:52
- `GET /api/overzicht` → routes/themas.js:143
- `POST /api/locaties/:p/materiaal-van-template` → routes/locaties.js:123
- `PUT /api/locatie-materiaal/:p` → routes/locaties.js:111
- `DELETE /api/locatie-materiaal/:p` → routes/locaties.js:118
- `POST /api/locaties/:p/materiaal` → routes/locaties.js:105
- `POST /api/locatie-config` → routes/locaties.js:33
- `DELETE /api/locatie-config/:p` → routes/locaties.js:47
- `POST /api/kleurenborden-stock/:p` → routes/locaties.js:173
- `POST /api/kalender/toggle` → routes/planning.js:152
- `DELETE /api/kampmomenten/:p` → routes/planning.js:115

## 3. Transport plannen

- **Ingang:** Nav-knop `🚚 Transport` → `goTo('transport-plan')` (index.html:441); subtabs Op te stellen / Plannen / Alle transporten (index.html:1100-1103).
- **Statische HTML (index.html):** regels 1099-1157 (sec-transport-plan (zonder ploegplanning)); regels 1388-1415 (modal-rit); regels 1347-1387 (modal-transport); regels 1455-1485 (modal-spoedtransport); regels 1246-1288 (modal-shift)
- **Wortel-functies:** `renderTransportPlan()` (3082-3085), `setPlannerView()` (7020-7029), `plannerNav()` (7030-7036), `openNieuweRitOp()` (7457-7463), `openRitModal()` (7473-7495), `saveRit()` (7542-7570), `openSpoedtransport()` (7067-7080), `saveSpoedtransport()` (7099-7125)
- **Opmerking:** `renderTransportPlan` roept `renderPlanner` (weekkalender, backlog-strip, metrics) en `renderPloeg` (ploegplanning) aan.

### Functie-boom (diepte 3; `(verder: …)` = niet verder uitgevouwen)

- `renderTransportPlan()` — index.html:3082-3085
  - `renderPlanner()` — index.html:7193-7215
    - `_fillPlannerPeriodeSel()` — index.html:7172-7177
    - `_zorgMatData()` — index.html:7947-7955
    - `loadPloegShifts()` — index.html:3557-3570
      - `fillChaufDatalist()` — index.html:4220-4223
    - `fillChaufDatalist()` — index.html:4220-4223 (zie hierboven)
    - `renderPlannerKalender()` — index.html:7360-7434
      - `plannerWeekDagen()` — index.html:7127-7140
        - (verder: `_activePeriode`, `getWeekMaandag`)
      - `plannerWeekLabel()` — index.html:7142-7146
        - (verder: `getWeekDagen`)
      - `_periodeMaxWeken()` — index.html:4259-4264
        - (verder: `_activePeriode`)
      - `rittenOpDag()` — index.html:7168-7170
        - (verder: `ritMatchesFilters`)
      - `openNieuweRitOp()` — index.html:7457-7463
        - (verder: `plannerWeekDagen`, `openRitModal`)
      - `dropOpDag()` — index.html:7051-7063
        - (verder: `_herlaadPlanner`)
      - `_ritCardEl()` — index.html:7233-7282
        - (verder: `_ritStatus`, `_ritRoute`, `openRitModal`, `openRitKlaarzetten`)
    - `updatePlannerMetrics()` — index.html:7217-7222
    - `renderBacklogStrip()` — index.html:7285-7336
      - `_ritRoute()` — index.html:7225-7232
      - `planNood()` — index.html:7464-7472
        - (verder: `plannerWeekDagen`, `_herfetchRitten`, `openRitModal`)
      - `planWeekAlsRit()` — index.html:7338-7358
        - (verder: `_herlaadPlanner`)
    - `renderChauffeursBeheer()` — index.html:7592-7596
      - `deleteChauf()` — index.html:7610-7617
        - (verder: `loadPloegShifts`, `renderChauffeursBeheer`, `renderPloegGrid`)
  - `renderPloeg()` — index.html:3572-3579
    - `loadPloegShifts()` — index.html:3557-3570 (zie hierboven)
    - `renderPloegGrid()` — index.html:3581-3673
      - `plannerWeekLabel()` — index.html:7142-7146 (zie hierboven)
      - `getWeekMaandag()` — index.html:4233-4237
        - (verder: `_activePeriode`)
      - `openEditShift()` — index.html:3699-3710
        - (verder: `fillShiftChaufSel`)
      - `openNieuweShiftFor()` — index.html:3693-3697
        - (verder: `openNieuweShift`)
- `setPlannerView()` — index.html:7020-7029
  - `plannerWeekDagen()` — index.html:7127-7140 (zie hierboven)
  - `renderPlannerKalender()` — index.html:7360-7434 (zie hierboven)
- `plannerNav()` — index.html:7030-7036
  - `setPlannerWk()` — index.html:7436-7439
    - `_periodeMaxWeken()` — index.html:4259-4264 (zie hierboven)
    - `renderPlannerKalender()` — index.html:7360-7434 (zie hierboven)
  - `plannerWeekDagen()` — index.html:7127-7140 (zie hierboven)
  - `renderPlannerKalender()` — index.html:7360-7434 (zie hierboven)
- `openNieuweRitOp()` — index.html:7457-7463 (zie hierboven)
- `openRitModal()` — index.html:7473-7495
  - `fillChaufDatalist()` — index.html:4220-4223 (zie hierboven)
  - `renderRitLeden()` — index.html:7496-7516
    - `_ritRoute()` — index.html:7225-7232 (zie hierboven)
    - `zetTaakTijd()` — index.html:7517-7521
    - `openEditTp()` — index.html:7988-8007
      - `fillTpLocs()` — index.html:8008-8008
      - `fillThemaAddSelect()` — index.html:7960-7963
      - `fillMatDatalist()` — index.html:7956-7959
        - (verder: `_materiaalKeuzeOpts`)
      - `renderTpRegels()` — index.html:8009-8009
    - `ontkoppelVanRit()` — index.html:7531-7536
      - `_herfetchRitten()` — index.html:7537-7541
      - `renderRitLeden()` — index.html:7496-7516 (zie hierboven)
- `saveRit()` — index.html:7542-7570
  - `fillChaufDatalist()` — index.html:4220-4223 (zie hierboven)
  - `_herlaadPlanner()` — index.html:7038-7049
    - `renderPlannerKalender()` — index.html:7360-7434 (zie hierboven)
    - `updatePlannerMetrics()` — index.html:7217-7222 (zie hierboven)
    - `renderBacklogStrip()` — index.html:7285-7336 (zie hierboven)
    - `controleerConflicten()` — index.html:9697-9714
    - `renderTransportenOV()` — index.html:3089-3169
      - `toggleTpSelectie()` — index.html:3180-3183
        - (verder: `updateTpBulkBar`)
      - `openEditTp()` — index.html:7988-8007 (zie hierboven)
      - `cycleStatus()` — index.html:7621-7627
        - (verder: `_herverversTransportSchermen`)
      - `openTransportChecklist()` — index.html:8325-8368
        - (verder: `toggleCheckItem`)
      - `updatePlannerMetrics()` — index.html:7217-7222 (zie hierboven)
      - `updateTpBulkBar()` — index.html:3184-3190
      - `renderVoertuigBezetting()` — index.html:9753-9779
    - `renderNodenLijst()` — index.html:7804-7804
      - `renderTransportBeheer()` — index.html:7732-7803
        - (verder: `_ritRoute`, `_updateBulkBar`, `_tbToggleCb`, `enkeleOntkoppel`, `planNood`, `openTaakSplits`, `openEditTp`, `verwijderNood`)
- `openSpoedtransport()` — index.html:7067-7080
  - `spoedKindChange()` — index.html:7081-7098
- `saveSpoedtransport()` — index.html:7099-7125
  - `renderPlanner()` — index.html:7193-7215 (zie hierboven)
  - `renderTransportenOV()` — index.html:3089-3169 (zie hierboven)

Gedeelde hulpfuncties die hier worden aangeroepen en niet uitgevouwen zijn: `api`, `isoLocal`, `fDag`, `showToast`, `_escH`, `_appNow`, `bevestig`, `openModal`, `fIso`, `_attrH`, `vraagModal`, `closeModal`.

### CSS-klassen (uit index.html `<style>`, regelnummers van de definitie)

`.a` (l.31), `.active` (l.22,23,26…), `.add-row` (l.108), `.ai` (l.109,110,111…), `.b` (l.31), `.bi` (l.40,41,276…), `.btn-b` (l.54,55), `.btn-del-sm` (l.60), `.btn-g` (l.52,53), `.btn-o` (l.58,59,251), `.btn-r` (l.56,57), `.btn-xs` (l.112,113), `.divider` (l.61), `.empty` (l.149), `.fg` (l.47,48,49…), `.fr` (l.46,350), `.g` (l.31), `.grow` (l.49,111,280), `.inp` (l.42,43,50…), `.kal-subtab` (l.173,174,175), `.mat-qty` (l.80), `.mat-row` (l.79), `.md` (l.51,351), `.metric` (l.28), `.metric-label` (l.29), `.metric-val` (l.30,329), `.metrics` (l.27,271,328…), `.modal` (l.136,346), `.modal-bg` (l.134,135), `.modal-close` (l.138,139), `.modal-title` (l.137), `.open` (l.88,135,186…), `.ov-view-btn` (l.194,195,196), `.p-amber` (l.65), `.p-gray` (l.64), `.pill` (l.63), `.ri` (l.38), `.rm` (l.38), `.row` (l.34,35,36…), `.rs` (l.38), `.sec` (l.26), `.sel` (l.44,45,50…), `.sl` (l.62), `.sm` (l.50,111,238…), `.thema-tag` (l.76), `.tp-body` (l.118), `.tp-hd` (l.116,117,336), `.tp-taak` (l.114,115,356)

_Klassen worden statisch uit `class="…"`-attributen gehaald; klassen die dynamisch uit variabelen worden samengesteld of alleen via inline style werken ontbreken._

### API-routes (client-aanroep → server-handler; transitief over de hele boom, ook functies achter (verder: …))

- `GET /api/transport-taken` → routes/transport.js:8
- `GET /api/ritten` → routes/transport.js:749
- `GET /api/thema-categorieen` → routes/themas.js:146
- `GET /api/sport` → routes/sport.js:8
- `GET /api/gedeeld` → routes/bakken.js:360
- `GET /api/verbruik` → routes/voorraad.js:7
- `GET /api/personeel` → routes/personeel.js:7
- `POST /api/ritten` → routes/transport.js:753
- `PUT /api/transport-taken/:p/move` → routes/transport.js:715
- `PUT /api/transport-taken/:p/rit` → routes/locaties.js:184
- `PUT /api/ritten/:p` → routes/transport.js:767
- `GET /api/voertuig-types` → routes/transport.js:800
- `GET /api/ritten/:p/checks` → routes/transport.js:820
- `POST /api/ritten/:p/checks/init` → routes/transport.js:827
- `GET /api/checks/item-historie` → routes/transport.js:847
- `PUT /api/checks/:p` → routes/transport.js:866
- `GET /api/conflicten` → routes/conflicten.js:7
- `PUT /api/transport-taken/:p/status` → routes/transport.js:701
- `POST /api/transport-taken/bulk-ontkoppel` → routes/transport.js:579
- `GET /api/aanvragen:p:p` → routes/aanvragen.js:11, routes/bakken.js:28, routes/bakken.js:120, routes/bakken.js:145, routes/bakken.js:237, routes/bakken.js:346, routes/bakken.js:360, routes/beheer.js:19, routes/beheer.js:49, routes/beheer.js:60, routes/beheer.js:105, routes/beheer.js:119, routes/conflicten.js:7, routes/locaties.js:7, routes/locaties.js:27, routes/locaties.js:88, routes/locaties.js:140, routes/personeel.js:7, routes/planning.js:51, routes/planning.js:137, routes/planning.js:154, routes/planning.js:159, routes/planning.js:197, routes/sport.js:8, routes/themas.js:8, routes/themas.js:139, routes/themas.js:143, routes/themas.js:146, routes/themas.js:162, routes/transport.js:8, routes/transport.js:749, routes/transport.js:800, routes/transport.js:1006, routes/transport.js:1209, routes/voorraad.js:7, routes/voorraad.js:46, routes/voorraad.js:63, routes/voorraad.js:72, routes/voorraad.js:169, routes/voorraad.js:277
- `GET /api/aanvragen` → routes/aanvragen.js:11
- `PUT /api/aanvragen/:p/status` → routes/aanvragen.js:70
- `DELETE /api/transport-taken/:p` → routes/transport.js:631
- `GET /api/voertuig-bezetting` → routes/transport.js:1209
- `DELETE /api/personeel/:p` → routes/personeel.js:32
- `POST /api/spoedtransport` → routes/transport.js:1013

## 4. Ritten / chauffeur-beheer

- **Ingang:** Subtab `📊 Alle transporten` → `goTo('transporten')` (index.html:1195) voor het ritoverzicht; chauffeursbeheer zit in `<details>` 'Ploegplanning & chauffeurs' binnen `#sec-transport-plan` (index.html:1158-1185) en in Personeel → 🚐 Chauffeurs (`setPersSubtab('chauffeurs')`, index.html:612).
- **Statische HTML (index.html):** regels 1191-1239 (sec-transporten); regels 1158-1185 (ploegplanning + chauffeurs beheren in sec-transport-plan); regels 618-637 (pers-sub-* containers in sec-personeel)
- **Wortel-functies:** `renderTransportenOV()` (3089-3169), `renderPloeg()` (3572-3579), `renderChauffeursBeheer()` (7592-7596), `renderRitLeden()` (7496-7516), `renderVoertuigBezetting()` (9753-9779), `addChauf()` (7598-7608), `kopieerRitLink()` (9686-9694), `setPersSubtab()` (9455-9467), `renderPersoneel()` (9439-9442)
- **Opmerking:** Rit-modal (`#modal-rit`) staat bij scherm 3 (html 1388-1415); de chauffeurspagina voor buiten staat in scherm 9.

### Functie-boom (diepte 3; `(verder: …)` = niet verder uitgevouwen)

- `renderTransportenOV()` — index.html:3089-3169
  - `toggleTpSelectie()` — index.html:3180-3183
    - `updateTpBulkBar()` — index.html:3184-3190
  - `openEditTp()` — index.html:7988-8007
    - `fillTpLocs()` — index.html:8008-8008
    - `fillThemaAddSelect()` — index.html:7960-7963
    - `fillMatDatalist()` — index.html:7956-7959
      - `_materiaalKeuzeOpts()` — index.html:5643-5650
    - `renderTpRegels()` — index.html:8009-8009
  - `cycleStatus()` — index.html:7621-7627
    - `_herverversTransportSchermen()` — index.html:8011-8016
      - `_herfetchRitten()` — index.html:7537-7541
      - `renderNodenLijst()` — index.html:7804-7804
        - (verder: `renderTransportBeheer`)
      - `renderPlannerKalender()` — index.html:7360-7434
        - (verder: `plannerWeekDagen`, `plannerWeekLabel`, `_periodeMaxWeken`, `rittenOpDag`, `openNieuweRitOp`, `dropOpDag`, `_ritCardEl`)
      - `updatePlannerMetrics()` — index.html:7217-7222
      - `renderBacklogStrip()` — index.html:7285-7336
        - (verder: `_ritRoute`, `planNood`, `planWeekAlsRit`)
      - `renderTransportenOV()` — index.html:3089-3169 (zie hierboven)
  - `openTransportChecklist()` — index.html:8325-8368
    - `toggleCheckItem()` — index.html:8370-8378
  - `updatePlannerMetrics()` — index.html:7217-7222 (zie hierboven)
  - `updateTpBulkBar()` — index.html:3184-3190 (zie hierboven)
  - `renderVoertuigBezetting()` — index.html:9753-9779
- `renderPloeg()` — index.html:3572-3579
  - `loadPloegShifts()` — index.html:3557-3570
    - `fillChaufDatalist()` — index.html:4220-4223
  - `renderPloegGrid()` — index.html:3581-3673
    - `plannerWeekLabel()` — index.html:7142-7146
      - `getWeekDagen()` — index.html:4238-4245
        - (verder: `_activePeriode`, `getWeekMaandag`)
    - `getWeekMaandag()` — index.html:4233-4237
      - `_activePeriode()` — index.html:4225-4232
    - `openEditShift()` — index.html:3699-3710
      - `fillShiftChaufSel()` — index.html:3712-3715
    - `openNieuweShiftFor()` — index.html:3693-3697
      - `openNieuweShift()` — index.html:3680-3691
        - (verder: `fillShiftChaufSel`)
- `renderChauffeursBeheer()` — index.html:7592-7596
  - `deleteChauf()` — index.html:7610-7617
    - `loadPloegShifts()` — index.html:3557-3570 (zie hierboven)
    - `renderChauffeursBeheer()` — index.html:7592-7596 (zie hierboven)
    - `renderPloegGrid()` — index.html:3581-3673 (zie hierboven)
- `renderRitLeden()` — index.html:7496-7516
  - `_ritRoute()` — index.html:7225-7232
  - `zetTaakTijd()` — index.html:7517-7521
  - `openEditTp()` — index.html:7988-8007 (zie hierboven)
  - `ontkoppelVanRit()` — index.html:7531-7536
    - `_herfetchRitten()` — index.html:7537-7541 (zie hierboven)
    - `renderRitLeden()` — index.html:7496-7516 (zie hierboven)
- `renderVoertuigBezetting()` — index.html:9753-9779 (zie hierboven)
- `addChauf()` — index.html:7598-7608
  - `fillChaufDatalist()` — index.html:4220-4223 (zie hierboven)
  - `renderChauffeursBeheer()` — index.html:7592-7596 (zie hierboven)
  - `renderPlannerKalender()` — index.html:7360-7434 (zie hierboven)
- `kopieerRitLink()` — index.html:9686-9694
- `setPersSubtab()` — index.html:9455-9467
  - `renderPersoneelOverzicht()` — index.html:9469-9480
    - `openNieuwPersoonModal()` — index.html:9515-9526
    - `_persKaart()` — index.html:9490-9513
      - `openShiftModal()` — index.html:9585-9596
      - `openBewerkPersoon()` — index.html:9528-9542
      - `verwijderShiftDirect()` — index.html:9616-9623
        - (verder: `_laadPersoneel`, `setPersSubtab`)
  - `renderPersoneelRol()` — index.html:9482-9488
    - `openNieuwPersoonModal()` — index.html:9515-9526 (zie hierboven)
    - `_persKaart()` — index.html:9490-9513 (zie hierboven)
- `renderPersoneel()` — index.html:9439-9442
  - `_laadPersoneel()` — index.html:9444-9453
  - `setPersSubtab()` — index.html:9455-9467 (zie hierboven)

Gedeelde hulpfuncties die hier worden aangeroepen en niet uitgevouwen zijn: `api`, `_appNow`, `isoLocal`, `fIso`, `_escH`, `openModal`, `_attrH`, `fDag`, `showToast`, `bevestig`.

### CSS-klassen (uit index.html `<style>`, regelnummers van de definitie)

`.active` (l.22,23,26…), `.bi` (l.40,41,276…), `.btn-b` (l.54,55), `.btn-del-sm` (l.60), `.btn-g` (l.52,53), `.btn-o` (l.58,59,251), `.btn-r` (l.56,57), `.btn-xs` (l.112,113), `.empty` (l.149), `.fb` (l.145,146,344), `.filter-lbl` (l.144), `.filter-row` (l.143,343), `.inp` (l.42,43,50…), `.kal-subtab` (l.173,174,175), `.loading` (l.150), `.mat-qty` (l.80), `.mat-row` (l.79), `.open` (l.88,135,186…), `.p-amber` (l.65), `.p-gray` (l.64), `.pill` (l.63), `.ri` (l.38), `.rm` (l.38), `.row` (l.34,35,36…), `.rs` (l.38), `.sec` (l.26), `.sel` (l.44,45,50…), `.thema-tag` (l.76), `.tp-body` (l.118), `.tp-hd` (l.116,117,336), `.tp-taak` (l.114,115,356)

_Klassen worden statisch uit `class="…"`-attributen gehaald; klassen die dynamisch uit variabelen worden samengesteld of alleen via inline style werken ontbreken._

### API-routes (client-aanroep → server-handler; transitief over de hele boom, ook functies achter (verder: …))

- `GET /api/transport-taken` → routes/transport.js:8
- `PUT /api/transport-taken/:p/status` → routes/transport.js:701
- `GET /api/ritten` → routes/transport.js:749
- `POST /api/transport-taken/bulk-ontkoppel` → routes/transport.js:579
- `GET /api/voertuig-types` → routes/transport.js:800
- `GET /api/sport` → routes/sport.js:8
- `GET /api/gedeeld` → routes/bakken.js:360
- `GET /api/verbruik` → routes/voorraad.js:7
- `GET /api/aanvragen:p:p` → routes/aanvragen.js:11, routes/bakken.js:28, routes/bakken.js:120, routes/bakken.js:145, routes/bakken.js:237, routes/bakken.js:346, routes/bakken.js:360, routes/beheer.js:19, routes/beheer.js:49, routes/beheer.js:60, routes/beheer.js:105, routes/beheer.js:119, routes/conflicten.js:7, routes/locaties.js:7, routes/locaties.js:27, routes/locaties.js:88, routes/locaties.js:140, routes/personeel.js:7, routes/planning.js:51, routes/planning.js:137, routes/planning.js:154, routes/planning.js:159, routes/planning.js:197, routes/sport.js:8, routes/themas.js:8, routes/themas.js:139, routes/themas.js:143, routes/themas.js:146, routes/themas.js:162, routes/transport.js:8, routes/transport.js:749, routes/transport.js:800, routes/transport.js:1006, routes/transport.js:1209, routes/voorraad.js:7, routes/voorraad.js:46, routes/voorraad.js:63, routes/voorraad.js:72, routes/voorraad.js:169, routes/voorraad.js:277
- `GET /api/aanvragen` → routes/aanvragen.js:11
- `PUT /api/aanvragen/:p/status` → routes/aanvragen.js:70
- `POST /api/ritten` → routes/transport.js:753
- `PUT /api/transport-taken/:p/move` → routes/transport.js:715
- `PUT /api/transport-taken/:p/rit` → routes/locaties.js:184
- `PUT /api/ritten/:p` → routes/transport.js:767
- `GET /api/ritten/:p/checks` → routes/transport.js:820
- `POST /api/ritten/:p/checks/init` → routes/transport.js:827
- `GET /api/checks/item-historie` → routes/transport.js:847
- `PUT /api/checks/:p` → routes/transport.js:866
- `GET /api/conflicten` → routes/conflicten.js:7
- `GET /api/voertuig-bezetting` → routes/transport.js:1209
- `DELETE /api/transport-taken/:p` → routes/transport.js:631
- `GET /api/thema-categorieen` → routes/themas.js:146
- `GET /api/personeel` → routes/personeel.js:7
- `DELETE /api/personeel/:p` → routes/personeel.js:32
- `POST /api/personeel` → routes/personeel.js:19
- `POST /api/ritten/:p/token` → routes/transport.js:1060
- `DELETE /api/personeel-shifts/:p` → routes/personeel.js:45

## 5. Thema's

- **Ingang:** Nav `📦 Materiaal` → `goTo('materiaal')` (index.html:442) → subtab `🧺 Themabakken` (`setMatSubtab('themabakken')`, 707) en knop `⚙️ Thema's beheer` (`setMatSubtab('themas')`, 714).
- **Statische HTML (index.html):** regels 718-738 (mat-sub-themabakken); regels 795-878 (mat-sub-themas); regels 1434-1443 (modal-thema-detail); regels 1444-1454 (modal-import-themas)
- **Wortel-functies:** `renderMateriaal()` (2477-2481), `setMatSubtab()` (2041-2060), `renderThemas()` (4863-5027), `renderThemaCatBeheer()` (8209-8215), `renderThemabakken()` (2485-2526), `addThema()` (5133-5149), `saveThema()` (8062-8075), `openThemaPopup()` (3912-3986)
- **Opmerking:** `renderMateriaal` (index.html:2477) kiest de actieve materiaal-subtab; `renderThemas` rendert de compacte 'Excel'-tabel `#thema-list` met paginering.

### Functie-boom (diepte 3; `(verder: …)` = niet verder uitgevouwen)

- `renderMateriaal()` — index.html:2477-2481
  - `setMatSubtab()` — index.html:2041-2060
    - `renderThemabakken()` — index.html:2485-2526
      - `_normLG()` — index.html:8084-8084
      - `_pagerBar()` — index.html:5884-5900
      - `leeftijdBadge()` — index.html:8090-8097
        - (verder: `_normLG`)
      - `_tbToggle()` — index.html:2547-2547
        - (verder: `renderThemabakken`)
      - `categorieBadge()` — index.html:8100-8105
      - `_renderThemaBakkenInhoud()` — index.html:2549-2576
        - (verder: `_renderThemaAttributen`, `_renderThemaBehoefte`, `_renderThemaKvInfo`)
    - `renderVasteBakken()` — index.html:2676-2704
      - `_vbZetAantal()` — index.html:2706-2715
        - (verder: `renderVasteBakken`)
      - `_vbToggle()` — index.html:2716-2723
        - (verder: `renderVasteBakken`)
      - `deleteVasteBak()` — index.html:2848-2852
        - (verder: `renderVasteBakken`)
      - `_vbSpreidingHtml()` — index.html:2724-2731
      - `_renderVasteBakInhoud()` — index.html:2788-2814
        - (verder: `deleteVasteBakItem`, `addVasteBakItem`, `_vbFotoSectieHtml`, `setBlazersNodig`)
    - `renderGedeeldTab()` — index.html:2857-2895
      - `_kbsRowsHtml()` — index.html:2897-2907
        - (verder: `_kleurBg`, `kbsVerwijder`)
      - `kbsVoegToe()` — index.html:2909-2922
        - (verder: `_kbsRowsHtml`)
      - `kbsOpslaan()` — index.html:2929-2941
    - `renderVoorraadTab()` — index.html:2949-3026
      - `_vrdGaPag()` — index.html:2946-2946
        - (verder: `renderVoorraadTab`)
      - `_vrdZetPageSize()` — index.html:2947-2947
        - (verder: `renderVoorraadTab`)
      - `_vrdToggle()` — index.html:3045-3051
      - `_vrdDetail()` — index.html:3052-3080
        - (verder: `_vrdSaveStock`, `_vrdVoegLocatieToe`)
    - `renderSportMateriaal()` — index.html:5055-5094
      - `addSportItem()` — index.html:5099-5110
        - (verder: `renderSportMateriaal`)
      - `deleteSportSet()` — index.html:5120-5125
        - (verder: `renderSportMateriaal`)
      - `toggleSportBody()` — index.html:5095-5098
      - `deleteSportItem()` — index.html:5126-5131
        - (verder: `renderSportMateriaal`)
      - `addSportSet()` — index.html:5111-5119
        - (verder: `renderSportMateriaal`)
    - `renderThemas()` — index.html:4863-5027
      - `themaSelAllPage()` — index.html:5913-5916
        - (verder: `renderThemas`)
      - `_pagerBar()` — index.html:5884-5900 (zie hierboven)
      - `toggleThemaBody()` — index.html:4767-4770
      - `renderThemaCatSelect()` — index.html:8077-8080
      - `renderLeeftijdSelect()` — index.html:8086-8089
        - (verder: `_normLG`)
      - `saveThema()` — index.html:8062-8075
        - (verder: `_themaTypeFromForm`, `renderThemas`)
      - `toggleThemaSel()` — index.html:5907-5912
        - (verder: `_renderThemaBulkBar`)
      - `leeftijdBadge()` — index.html:8090-8097 (zie hierboven)
      - `categorieBadge()` — index.html:8100-8105 (zie hierboven)
      - `_themaOrgBadge()` — index.html:5029-5034
      - `_themaMatBadge()` — index.html:5035-5039
      - `openThemaPopup()` — index.html:3912-3986
        - (verder: `getWeekDagen`, `_periodeMaxWeken`, `_activePeriode`, `planThemaHier`, `voegBakToe`, `koppelThemaBundel`, `laadThemaBakken`, `laadThemaBundels`)
      - `deleteThema()` — index.html:5151-5151
        - (verder: `renderThemas`)
      - `saveThemaMat()` — index.html:4772-4784
        - (verder: `renderThemas`)
      - `convertNaarGedeeld()` — index.html:4844-4861
        - (verder: `renderThemas`, `_reopenThemaBody`)
      - `deleteThemaMat()` — index.html:4786-4792
        - (verder: `renderThemas`)
      - `updateGedeeldQty()` — index.html:4824-4833
        - (verder: `renderThemas`, `_reopenThemaBody`)
      - `ontkoppelGedeeld()` — index.html:4835-4842
        - (verder: `renderThemas`, `_reopenThemaBody`)
      - `_themaAddMode()` — index.html:4794-4800
      - `addThemaMat()` — index.html:1917-1927
        - (verder: `renderThemas`)
      - `koppelGedeeld()` — index.html:4806-4822
        - (verder: `renderThemas`, `_reopenThemaBody`)
      - `_renderThemaBulkBar()` — index.html:5918-5931
        - (verder: `renderThemaCatSelect`, `themaBulkCat`, `renderLeeftijdSelect`, `themaBulkLeeftijd`, `themaBulkDelete`, `clearThemaSel`)
    - `renderThemaCatBeheer()` — index.html:8209-8215
      - `deleteThemaCat()` — index.html:8201-8207
        - (verder: `renderThemaCatBeheer`)
    - `renderThemaCatSelect()` — index.html:8077-8080 (zie hierboven)
    - `renderCatalogus()` — index.html:5996-6027
      - `_stockOptsHtml()` — index.html:5978-5994
      - `renderCatalogusAddForm()` — index.html:6031-6064
      - `renderCatalogusLijst()` — index.html:6143-6249
        - (verder: `_buildCatItems`, `_stockFullName`, `_stockOptsHtml`, `catBulkOpslag`, `catBulkCat`, `catBulkDelete`, `catSelClear`, `_pagerBar`, `_renderCatRow`, `catSelAllToggle`)
    - `renderStandaard()` — index.html:5168-5183
      - `_ensureCatalogusGeladen()` — index.html:5157-5161
      - `_renderBasisEditor()` — index.html:5185-5200
        - (verder: `saveBasisItem`, `renderStandaard`, `deleteBasisItem`, `addBasisItem`, `_basisDatalist`)
      - `_renderKampMateriaal()` — index.html:5202-5231
        - (verder: `toggleBasisVerborgen`, `saveBasisQty`, `saveStdMat`, `renderStandaard`, `deleteStdMat`, `addStdMat`, `_basisDatalist`)
    - `renderVoertuigen()` — index.html:2061-2090
      - `updateVoertuigCap()` — index.html:2091-2096
      - `verwijderVoertuig()` — index.html:2097-2101
        - (verder: `renderVoertuigen`)
      - `voegVoertuigToe()` — index.html:2102-2110
        - (verder: `renderVoertuigen`)
    - `laadNakijken()` — index.html:9243-9248
      - `renderNk2Lijst()` — index.html:9257-9299
        - (verder: `_nk2BakHtml`)
    - `renderNakijkTekorten()` — index.html:3235-3289
      - `updateMateriaalBadge()` — index.html:3223-3229
        - (verder: `_nakijkOpenAantal`)
      - `nakijkRegelAanvullen()` — index.html:3290-3306
        - (verder: `nakijkVoorraadrijAanmaken`, `renderNakijkTekorten`)
      - `nakijkRegelBesteld()` — index.html:3313-3318
        - (verder: `renderNakijkTekorten`)
      - `nakijkRegelGenegeerd()` — index.html:3319-3324
        - (verder: `renderNakijkTekorten`)
      - `nakijkSessieVerwerkt()` — index.html:3325-3330
        - (verder: `renderNakijkTekorten`)
- `setMatSubtab()` — index.html:2041-2060 (zie hierboven)
- `renderThemas()` — index.html:4863-5027 (zie hierboven)
- `renderThemaCatBeheer()` — index.html:8209-8215 (zie hierboven)
- `renderThemabakken()` — index.html:2485-2526 (zie hierboven)
- `addThema()` — index.html:5133-5149
  - `_themaTypeFromForm()` — index.html:5040-5045
  - `renderThemas()` — index.html:4863-5027 (zie hierboven)
  - `renderThemaCatBeheer()` — index.html:8209-8215 (zie hierboven)
- `saveThema()` — index.html:8062-8075 (zie hierboven)
- `openThemaPopup()` — index.html:3912-3986 (zie hierboven)

Gedeelde hulpfuncties die hier worden aangeroepen en niet uitgevouwen zijn: `api`, `_escH`, `_attrH`, `vraagModal`, `showToast`, `bevestig`, `fDag`, `openModal`.

### CSS-klassen (uit index.html `<style>`, regelnummers van de definitie)

`.active` (l.22,23,26…), `.add-row` (l.108), `.ai` (l.109,110,111…), `.bi` (l.40,41,276…), `.btn-del-sm` (l.60), `.btn-g` (l.52,53), `.btn-o` (l.58,59,251), `.btn-xs` (l.112,113), `.card` (l.32), `.card-hd` (l.33), `.clr-dot` (l.285,286), `.dag-feest` (l.75,167), `.dag-pill` (l.72), `.del` (l.41), `.divider` (l.61), `.editing` (l.36), `.empty` (l.149), `.exp-body` (l.98), `.exp-card` (l.95,100), `.exp-hd` (l.96,97,101), `.fg` (l.47,48,49…), `.fr` (l.46,350), `.gb` (l.43,45), `.grow` (l.49,111,280), `.inp` (l.42,43,50…), `.kal-subtab` (l.173,174,175), `.km-body` (l.71), `.km-card` (l.68,232,233), `.km-hd` (l.69,70), `.leeg` (l.261), `.loading` (l.150), `.loc-col` (l.84,180,214…), `.loc-contact` (l.309,310,311), `.loc-name` (l.86,182,259), `.mat-block` (l.77), `.mat-block-title` (l.78), `.mat-edit` (l.319), `.mat-grp` (l.317,318), `.mat-qty` (l.80), `.mat-row` (l.79), `.mat-table` (l.313,314,315…), `.mat-table-wrap` (l.253), `.md` (l.51,351), `.modal` (l.136,346), `.modal-bg` (l.134,135), `.modal-close` (l.138,139), `.modal-title` (l.137), `.open` (l.88,135,186…), `.p-blue` (l.66), `.p-gray` (l.64), `.p-green` (l.64), `.pager` (l.247,248,249…), `.pager-nav` (l.248), `.pager-per` (l.250), `.pager-pg` (l.249), `.pill` (l.63), `.ra` (l.39), `.ri` (l.38), `.rm` (l.38), `.rooster-cell` (l.260,261,262…), `.rooster-table` (l.255,256,257…), `.row` (l.34,35,36…), `.rs` (l.38), `.save` (l.41), `.sel` (l.44,45,50…), `.sl` (l.62), `.sm` (l.50,111,238…), `.th-acties` (l.105), `.th-head` (l.107), `.th-items` (l.104), `.th-leeftijd` (l.103), `.th-naam` (l.102), `.thema-swatch` (l.106,299), `.thema-tag` (l.76), `.tk-regel` (l.266,267), `.tk-status-lbl` (l.268,269), `.vol` (l.263)

_Klassen worden statisch uit `class="…"`-attributen gehaald; klassen die dynamisch uit variabelen worden samengesteld of alleen via inline style werken ontbreken._

### API-routes (client-aanroep → server-handler; transitief over de hele boom, ook functies achter (verder: …))

- `GET /api/alle-bakken` → routes/bakken.js:28
- `GET /api/attributen` → routes/bakken.js:237
- `GET /api/vast-types` → routes/locaties.js:27
- `GET /api/themas/:p/attributen` → routes/bakken.js:238
- `DELETE /api/themas/:p/attributen/:p` → routes/bakken.js:274
- `POST /api/themas/:p/attributen` → routes/bakken.js:267
- `POST /api/attributen` → routes/bakken.js:239
- `DELETE /api/themas/:p/behoefte/:p` → routes/bakken.js:307
- `POST /api/themas/:p/behoefte` → routes/bakken.js:284
- `GET /api/vaste-bakken` → routes/bakken.js:145
- `PUT /api/vaste-bakken/:p` → routes/bakken.js:178
- `GET /api/vaste-bakken/:p/spreiding` → routes/themas.js:179
- `DELETE /api/vaste-bakken/:p` → routes/bakken.js:200
- `DELETE /api/vaste-bak-items/:p` → routes/bakken.js:222
- `POST /api/vaste-bakken/:p/items` → routes/bakken.js:204
- `DELETE /api/vaste-bakken/:p/foto-slot/:p` → routes/bakken.js:161
- `POST /api/vaste-bakken/:p/foto-slot` → routes/bakken.js:150
- `GET /api/gedeeld` → routes/bakken.js:360
- `GET /api/kleurenborden-stock/:p` → routes/locaties.js:170
- `POST /api/kleurenborden-stock/:p` → routes/locaties.js:173
- `GET /api/stock-overzicht` → routes/bakken.js:120
- `GET /api/bestellijst` → routes/voorraad.js:63
- `POST /api/voorraad` → routes/voorraad.js:52
- `GET /api/sport` → routes/sport.js:8
- `POST /api/sport` → routes/sport.js:23
- `DELETE /api/sport/sets/:p` → routes/sport.js:57, routes/sport.js:113
- `DELETE /api/sport/:p` → routes/sport.js:37
- `POST /api/sport/:p/sets` → routes/sport.js:46
- `PUT /api/themas/:p` → routes/themas.js:10
- `GET /api/themas` → routes/themas.js:8
- `DELETE /api/thema-categorieen/:p` → routes/themas.js:152
- `DELETE /api/themas/:p` → routes/themas.js:11
- `GET /api/kampmomenten` → routes/planning.js:51
- `POST /api/kampmomenten` → routes/planning.js:56
- `POST /api/kampmomenten/:p/themas` → routes/planning.js:125
- `GET /api/themas/:p/bakken` → routes/bakken.js:26
- `POST /api/sport/sets/:p/plan` → routes/sport.js:64
- `DELETE /api/kampmomenten/:p/themas/:p` → routes/planning.js:131
- `GET /api/personeel` → routes/personeel.js:7
- `GET /api/locaties/:p/materiaal` → routes/locaties.js:94
- `GET /api/locatie-config/:p` → routes/locaties.js:30
- `GET /api/kleurenborden` → routes/locaties.js:140
- `POST /api/locaties` → routes/locaties.js:8
- `PUT /api/locaties/:p` → routes/locaties.js:17
- `GET /api/log` → routes/beheer.js:105
- `DELETE /api/locaties/:p` → routes/locaties.js:52
- `GET /api/overzicht` → routes/themas.js:143
- `POST /api/locaties/:p/materiaal-van-template` → routes/locaties.js:123
- `PUT /api/locatie-materiaal/:p` → routes/locaties.js:111
- `DELETE /api/locatie-materiaal/:p` → routes/locaties.js:118
- `POST /api/locaties/:p/materiaal` → routes/locaties.js:105
- `GET /api/kalender` → routes/planning.js:137
- `POST /api/locatie-config` → routes/locaties.js:33
- `DELETE /api/locatie-config/:p` → routes/locaties.js:47
- `POST /api/kalender/toggle` → routes/planning.js:152
- `DELETE /api/kampmomenten/:p` → routes/planning.js:115
- `POST /api/themas/:p/bakken` → routes/bakken.js:36
- `GET /api/themas/0/bakken` → routes/bakken.js:26
- `fetch /api/bakken/` → (niet te herleiden)
- `PUT /api/bak-items/:p` → routes/bakken.js:80
- `DELETE /api/bak-items/:p` → routes/bakken.js:92
- `DELETE /api/bakken/:p` → routes/bakken.js:65
- `POST /api/themas/:p/bundels` → routes/themas.js:28
- `GET /api/themas/:p/bundels` → routes/themas.js:25
- `GET /api/bundels/bestanden` → routes/themas.js:19
- `DELETE /api/thema-bundels/:p` → routes/themas.js:39
- `PUT /api/themas/:p/materiaal/:p` → routes/themas.js:13
- `POST /api/gedeeld/:p/gebruik` → routes/bakken.js:411
- `DELETE /api/themas/:p/materiaal/:p` → routes/themas.js:14
- `DELETE /api/gedeeld/:p/gebruik/:p` → routes/bakken.js:416
- `POST /api/themas/:p/materiaal` → routes/themas.js:12
- `GET /api/verbruik` → routes/voorraad.js:7
- `PUT /api/sport/:p` → routes/sport.js:30
- `PUT /api/gedeeld/:p` → routes/bakken.js:396
- `PUT /api/materiaal/:p` → routes/themas.js:141
- `DELETE /api/gedeeld/:p` → routes/bakken.js:403
- `DELETE /api/materiaal/:p` → routes/themas.js:142
- `POST /api/gedeeld` → routes/bakken.js:389
- `POST /api/gedeeld/:p/stock` → routes/bakken.js:382
- `GET /api/catalogus-item/:p/:p` → routes/themas.js:188
- `POST /api/verbruik/:p/stock` → routes/voorraad.js:21
- `GET /api/standaard` → routes/locaties.js:88
- `PUT /api/standaard/:p` → routes/locaties.js:90
- `POST /api/locaties/:p/basis/:p` → routes/locaties.js:96
- `DELETE /api/standaard/:p` → routes/locaties.js:91
- `POST /api/standaard` → routes/locaties.js:89
- `GET /api/voertuig-types` → routes/transport.js:800
- `PUT /api/voertuig-types/:p` → routes/transport.js:808
- `DELETE /api/voertuig-types/:p` → routes/transport.js:817
- `POST /api/voertuig-types` → routes/transport.js:801
- `GET /api/nakijk/urgentie` → routes/voorraad.js:87
- `GET /api/nakijk` → routes/voorraad.js:72
- `PUT /api/nakijk/:p/kv` → routes/voorraad.js:130
- `DELETE /api/nakijk/:p` → routes/voorraad.js:153
- `PUT /api/nakijk/:p/kantoor` → routes/voorraad.js:145
- `POST /api/nakijk/start` → routes/voorraad.js:113
- `GET /api/nakijk-tekorten` → routes/voorraad.js:169
- `GET /api/nakijk-tekorten/aantal-open` → routes/voorraad.js:204
- `POST /api/nakijk-regels/:p/aanvullen` → routes/voorraad.js:211
- `POST /api/nakijk-regels/:p/voorraadrij-aanmaken` → routes/voorraad.js:231
- `POST /api/nakijk-regels/:p/besteld` → routes/voorraad.js:247
- `POST /api/nakijk-regels/:p/genegeerd` → routes/voorraad.js:254
- `PUT /api/nakijk-sessies/:p/verwerkt` → routes/voorraad.js:262
- `POST /api/themas` → routes/themas.js:9

## 6. Locaties

- **Ingang:** Nav-knop `📍 Locaties` → `goTo('planning')` (index.html:443); sectie-id is `sec-planning`.
- **Statische HTML (index.html):** regels 534-552 (sec-planning (lijst links, detail rechts))
- **Wortel-functies:** `renderPlanning()` (2196-2198), `renderLocatiesTab()` (5502-5526), `renderLocatieDetail()` (5689-5871), `openNieuweLocatie()` (5529-5539), `renderLocMatSection()` (5373-5426)
- **Opmerking:** Twee kolommen: `#loc-tab-list` (lijst) en `#loc-tab-detail` (detail/formulier). Kaartscherm (`goTo('kaart')`, `renderKaart`) is een apart scherm en niet in deze boom.

### Functie-boom (diepte 3; `(verder: …)` = niet verder uitgevouwen)

- `renderPlanning()` — index.html:2196-2198
  - `renderLocatiesTab()` — index.html:5502-5526
    - `selectLocTab()` — index.html:5528-5528
      - `renderLocatiesTab()` — index.html:5502-5526 (zie hierboven)
    - `renderLocatieDetail()` — index.html:5689-5871
      - `_locAddFormHTML()` — index.html:5541-5564
        - (verder: `geocodeAddr`, `addLoc`, `renderLocatiesTab`)
      - `_locEditFormHTML()` — index.html:5566-5590
        - (verder: `geocodeAddr`, `saveLoc`, `renderLocatieDetail`)
      - `loadKalender()` — index.html:3506-3506
      - `deleteLocTab()` — index.html:5533-5539
        - (verder: `renderLocatiesTab`)
      - `saveLocEigenschap()` — index.html:1630-1638
        - (verder: `selectKpCell`)
      - `saveLocatieConfig()` — index.html:1640-1643
        - (verder: `renderLocatieDetail`)
      - `verwijderLocatieConfig()` — index.html:1644-1647
        - (verder: `renderLocatieDetail`)
      - `_locMatRowsHTML()` — index.html:5651-5667
        - (verder: `saveLocMat`, `renderLocatieDetail`, `deleteLocMat`, `_materiaalKeuzeOpts`, `addLocMat`)
      - `openNieuwKampmoment()` — index.html:4503-4524
        - (verder: `_fillKmPeriodeSelect`, `updateKmWeekMax`, `setKmType`, `renderKmCheckboxes`, `_renderKmDagUI`, `updateKmPreview`, `_fillKmSportSectie`, `_fillKmKvSelect`)
      - `openKleurenborden()` — index.html:8429-8445
        - (verder: `_renderKbTabs`, `_renderKbBody`)
      - `_kleurBg()` — index.html:8424-8424
      - `_kleurFg()` — index.html:8425-8425
      - `saveKbStock()` — index.html:8495-8499
      - `_initLocDetailMap()` — index.html:5669-5678
      - `_loadLocLog()` — index.html:5680-5687
        - (verder: `_renderLogEntries`)
- `renderLocatiesTab()` — index.html:5502-5526 (zie hierboven)
- `renderLocatieDetail()` — index.html:5689-5871 (zie hierboven)
- `openNieuweLocatie()` — index.html:5529-5539
  - `renderLocatieDetail()` — index.html:5689-5871 (zie hierboven)
  - `_refreshLocDetail()` — index.html:5531-5531
    - `renderLocatieDetail()` — index.html:5689-5871 (zie hierboven)
  - `deleteLocTab()` — index.html:5533-5539 (zie hierboven)
  - `renderLocatiesTab()` — index.html:5502-5526 (zie hierboven)
- `renderLocMatSection()` — index.html:5373-5426
  - `getLocMat()` — index.html:4217-4217
  - `toggleLocMatBody()` — index.html:5366-5372
  - `openInventaris()` — index.html:8675-8723
    - `toggleCheckItem()` — index.html:8370-8378
  - `kopierenVanTemplate()` — index.html:5360-5365
    - `renderLocaties()` — index.html:5290-5335
      - `renderLocatiesTab()` — index.html:5502-5526 (zie hierboven)
      - `geocodeAddr()` — index.html:6942-6957
      - `saveLoc()` — index.html:5450-5467
        - (verder: `renderLocaties`)
      - `openLocGeschiedenis()` — index.html:6709-6716
        - (verder: `_renderLogEntries`)
      - `_q()` — index.html:5287-5287
      - `deleteLoc()` — index.html:5468-5468
        - (verder: `renderLocaties`)
      - `renderLocMatSection()` — index.html:5373-5426 (zie hierboven)
  - `saveLocMat()` — index.html:5346-5353
    - `renderLocaties()` — index.html:5290-5335 (zie hierboven)
  - `deleteLocMat()` — index.html:5354-5359
    - `renderLocaties()` — index.html:5290-5335 (zie hierboven)
  - `addLocMat()` — index.html:5336-5345
    - `renderLocaties()` — index.html:5290-5335 (zie hierboven)

Gedeelde hulpfuncties die hier worden aangeroepen en niet uitgevouwen zijn: `_escH`, `api`, `_attrH`, `bevestig`, `openModal`, `showToast`.

### CSS-klassen (uit index.html `<style>`, regelnummers van de definitie)

`.active` (l.22,23,26…), `.add-row` (l.108), `.ai` (l.109,110,111…), `.bi` (l.40,41,276…), `.btn-g` (l.52,53), `.btn-o` (l.58,59,251), `.btn-xs` (l.112,113), `.card` (l.32), `.card-hd` (l.33), `.editing` (l.36), `.empty` (l.149), `.exp-body` (l.98), `.exp-card` (l.95,100), `.exp-hd` (l.96,97,101), `.fg` (l.47,48,49…), `.fr` (l.46,350), `.gb` (l.43,45), `.grow` (l.49,111,280), `.inp` (l.42,43,50…), `.kal-subtab` (l.173,174,175), `.leeg` (l.261), `.loading` (l.150), `.loc-col` (l.84,180,214…), `.loc-col-detail` (l.244), `.loc-col-list` (l.242), `.loc-contact` (l.309,310,311), `.loc-name` (l.86,182,259), `.loc-split` (l.241), `.mat-qty` (l.80), `.mat-row` (l.79), `.md` (l.51,351), `.open` (l.88,135,186…), `.p-blue` (l.66), `.pill` (l.63), `.ra` (l.39), `.ri` (l.38), `.rm` (l.38), `.rooster-cell` (l.260,261,262…), `.rooster-table` (l.255,256,257…), `.row` (l.34,35,36…), `.rs` (l.38), `.save` (l.41), `.sec` (l.26), `.sel` (l.44,45,50…), `.sl` (l.62), `.sm` (l.50,111,238…), `.thema-tag` (l.76), `.vol` (l.263)

_Klassen worden statisch uit `class="…"`-attributen gehaald; klassen die dynamisch uit variabelen worden samengesteld of alleen via inline style werken ontbreken._

### API-routes (client-aanroep → server-handler; transitief over de hele boom, ook functies achter (verder: …))

- `GET /api/locaties/:p/materiaal` → routes/locaties.js:94
- `GET /api/sport` → routes/sport.js:8
- `GET /api/gedeeld` → routes/bakken.js:360
- `GET /api/vast-types` → routes/locaties.js:27
- `GET /api/locatie-config/:p` → routes/locaties.js:30
- `GET /api/kleurenborden` → routes/locaties.js:140
- `GET /api/kleurenborden-stock/:p` → routes/locaties.js:170
- `POST /api/locaties` → routes/locaties.js:8
- `PUT /api/locaties/:p` → routes/locaties.js:17
- `GET /api/kalender` → routes/planning.js:137
- `DELETE /api/locaties/:p` → routes/locaties.js:52
- `GET /api/themas/:p/bakken` → routes/bakken.js:26
- `POST /api/sport/sets/:p/plan` → routes/sport.js:64
- `GET /api/personeel` → routes/personeel.js:7
- `DELETE /api/kampmomenten/:p/themas/:p` → routes/planning.js:131
- `POST /api/kampmomenten/:p/themas` → routes/planning.js:125
- `GET /api/kampmomenten` → routes/planning.js:51
- `POST /api/locatie-config` → routes/locaties.js:33
- `DELETE /api/locatie-config/:p` → routes/locaties.js:47
- `PUT /api/locatie-materiaal/:p` → routes/locaties.js:111
- `DELETE /api/locatie-materiaal/:p` → routes/locaties.js:118
- `POST /api/locaties/:p/materiaal` → routes/locaties.js:105
- `POST /api/kleurenborden-stock/:p` → routes/locaties.js:173
- `GET /api/log` → routes/beheer.js:105
- `GET /api/overzicht` → routes/themas.js:143
- `POST /api/locaties/:p/materiaal-van-template` → routes/locaties.js:123

## 7. Voorraad / tekorten

- **Ingang:** Nav `📦 Materiaal` → subtabs `📋 Voorraad` (`setMatSubtab('voorraad')`, 710) en `🟢 Nakijken` (`setMatSubtab('nakijken')`, 712) met sub-subtabs Per controle / Tekortendashboard (`setNkInnerTab`, 894-895). Rode badge op nav via `updateMateriaalBadge()`.
- **Statische HTML (index.html):** regels 766-792 (mat-sub-voorraad); regels 891-925 (mat-sub-nakijken)
- **Wortel-functies:** `renderVoorraadTab()` (2949-3026), `laadNakijken()` (9243-9248), `renderNakijkTekorten()` (3235-3289), `setNkInnerTab()` (3332-3338), `renderTekortenDashboard()` (3339-3367), `setNk2Filter()` (9250-9255), `renderNk2Lijst()` (9257-9299), `updateMateriaalBadge()` (3223-3229)
- **Opmerking:** `setMatSubtab('nakijken')` doet `laadNakijken(); renderNakijkTekorten();` (index.html:2059).

### Functie-boom (diepte 3; `(verder: …)` = niet verder uitgevouwen)

- `renderVoorraadTab()` — index.html:2949-3026
  - `_vrdGaPag()` — index.html:2946-2946
    - `renderVoorraadTab()` — index.html:2949-3026 (zie hierboven)
  - `_vrdZetPageSize()` — index.html:2947-2947
    - `renderVoorraadTab()` — index.html:2949-3026 (zie hierboven)
  - `_vrdToggle()` — index.html:3045-3051
  - `_vrdDetail()` — index.html:3052-3080
    - `_vrdSaveStock()` — index.html:3027-3032
      - `renderVoorraadTab()` — index.html:2949-3026 (zie hierboven)
    - `_vrdVoegLocatieToe()` — index.html:3033-3043
      - `renderVoorraadTab()` — index.html:2949-3026 (zie hierboven)
- `laadNakijken()` — index.html:9243-9248
  - `renderNk2Lijst()` — index.html:9257-9299
    - `_nk2BakHtml()` — index.html:9301-9327
      - `_nk2Toggle()` — index.html:9394-9394
        - (verder: `renderNk2Lijst`)
      - `_nk2BakDetail()` — index.html:9329-9355
        - (verder: `_nk2KvFormulier`, `_nk2KantoorView`, `startNk2Check`)
- `renderNakijkTekorten()` — index.html:3235-3289
  - `updateMateriaalBadge()` — index.html:3223-3229
    - `_nakijkOpenAantal()` — index.html:3230-3233
  - `nakijkRegelAanvullen()` — index.html:3290-3306
    - `nakijkVoorraadrijAanmaken()` — index.html:3307-3312
      - `nakijkRegelAanvullen()` — index.html:3290-3306 (zie hierboven)
    - `renderNakijkTekorten()` — index.html:3235-3289 (zie hierboven)
  - `nakijkRegelBesteld()` — index.html:3313-3318
    - `renderNakijkTekorten()` — index.html:3235-3289 (zie hierboven)
  - `nakijkRegelGenegeerd()` — index.html:3319-3324
    - `renderNakijkTekorten()` — index.html:3235-3289 (zie hierboven)
  - `nakijkSessieVerwerkt()` — index.html:3325-3330
    - `renderNakijkTekorten()` — index.html:3235-3289 (zie hierboven)
- `setNkInnerTab()` — index.html:3332-3338
  - `renderTekortenDashboard()` — index.html:3339-3367
- `renderTekortenDashboard()` — index.html:3339-3367 (zie hierboven)
- `setNk2Filter()` — index.html:9250-9255
  - `renderNk2Lijst()` — index.html:9257-9299 (zie hierboven)
- `renderNk2Lijst()` — index.html:9257-9299 (zie hierboven)
- `updateMateriaalBadge()` — index.html:3223-3229 (zie hierboven)

Gedeelde hulpfuncties die hier worden aangeroepen en niet uitgevouwen zijn: `api`, `_escH`, `showToast`, `vraagModal`.

### CSS-klassen (uit index.html `<style>`, regelnummers van de definitie)

`.active` (l.22,23,26…), `.btn-g` (l.52,53), `.btn-o` (l.58,59,251), `.card` (l.32), `.card-hd` (l.33), `.empty` (l.149), `.inp` (l.42,43,50…), `.kal-subtab` (l.173,174,175), `.loading` (l.150), `.ov-view-btn` (l.194,195,196), `.p-green` (l.64), `.pill` (l.63), `.ri` (l.38), `.rm` (l.38), `.row` (l.34,35,36…), `.rs` (l.38)

_Klassen worden statisch uit `class="…"`-attributen gehaald; klassen die dynamisch uit variabelen worden samengesteld of alleen via inline style werken ontbreken._

### API-routes (client-aanroep → server-handler; transitief over de hele boom, ook functies achter (verder: …))

- `GET /api/stock-overzicht` → routes/bakken.js:120
- `GET /api/bestellijst` → routes/voorraad.js:63
- `POST /api/voorraad` → routes/voorraad.js:52
- `GET /api/nakijk/urgentie` → routes/voorraad.js:87
- `GET /api/nakijk` → routes/voorraad.js:72
- `PUT /api/nakijk/:p/kv` → routes/voorraad.js:130
- `DELETE /api/nakijk/:p` → routes/voorraad.js:153
- `PUT /api/nakijk/:p/kantoor` → routes/voorraad.js:145
- `POST /api/nakijk/start` → routes/voorraad.js:113
- `GET /api/nakijk-tekorten` → routes/voorraad.js:169
- `GET /api/nakijk-tekorten/aantal-open` → routes/voorraad.js:204
- `POST /api/nakijk-regels/:p/aanvullen` → routes/voorraad.js:211
- `POST /api/nakijk-regels/:p/voorraadrij-aanmaken` → routes/voorraad.js:231
- `POST /api/nakijk-regels/:p/besteld` → routes/voorraad.js:247
- `POST /api/nakijk-regels/:p/genegeerd` → routes/voorraad.js:254
- `PUT /api/nakijk-sessies/:p/verwerkt` → routes/voorraad.js:262
- `GET /api/tekorten-dashboard` → routes/voorraad.js:277

## 8. Conflicten

- **Ingang:** Overzicht → knop `⚠️ Conflicten` → `showConflicten()` (index.html:458, 1671).
- **Statische HTML (index.html):** regels 503-509 (conflict-ov)
- **Wortel-functies:** `showConflicten()` (1671-1678), `checkConflicten()` (1862-1899), `springNaarConflict()` (1856-1860)
- **Opmerking:** Data uit `GET /api/conflicten`; soorten staan in `CONFLICT_SOORTEN` (index.html:1842).

### Functie-boom (diepte 3; `(verder: …)` = niet verder uitgevouwen)

- `showConflicten()` — index.html:1671-1678
  - `checkConflicten()` — index.html:1862-1899
    - `springNaarConflict()` — index.html:1856-1860
      - `goTo()` — index.html:1998-2037
      - `setKampMode()` — index.html:2208-2217
        - (verder: `_renderKampMode`)
- `checkConflicten()` — index.html:1862-1899 (zie hierboven)
- `springNaarConflict()` — index.html:1856-1860 (zie hierboven)

Gedeelde hulpfuncties die hier worden aangeroepen en niet uitgevouwen zijn: `api`, `_escH`, `showToast`.

### CSS-klassen (uit index.html `<style>`, regelnummers van de definitie)

`.active` (l.22,23,26…), `.btn-o` (l.58,59,251), `.btn-xs` (l.112,113), `.empty` (l.149), `.leeg` (l.261), `.loading` (l.150), `.loc-col` (l.84,180,214…), `.loc-name` (l.86,182,259), `.rooster-cell` (l.260,261,262…), `.rooster-table` (l.255,256,257…), `.sel` (l.44,45,50…), `.thema-tag` (l.76), `.vol` (l.263)

_Klassen worden statisch uit `class="…"`-attributen gehaald; klassen die dynamisch uit variabelen worden samengesteld of alleen via inline style werken ontbreken._

### API-routes (client-aanroep → server-handler; transitief over de hele boom, ook functies achter (verder: …))

- `GET /api/conflicten` → routes/conflicten.js:7
- `GET /api/sport` → routes/sport.js:8
- `GET /api/themas/:p/bakken` → routes/bakken.js:26
- `POST /api/sport/sets/:p/plan` → routes/sport.js:64
- `GET /api/personeel` → routes/personeel.js:7
- `DELETE /api/kampmomenten/:p/themas/:p` → routes/planning.js:131
- `POST /api/kampmomenten/:p/themas` → routes/planning.js:125
- `GET /api/kampmomenten` → routes/planning.js:51


## 9. Rit-pagina (chauffeur, mobiel) — `/rit/:token`

- **Ingang:** publieke link `GET /rit/:token` (routes/transport.js:1101-1206); token = `transport_ritten.rit_token`. Kantoor kopieert de link via `kopieerRitLink()` (index.html:9686) / knop `🔗 Chauffeur-link` in `#modal-rit` (index.html:1388-1415). Geen sessietoken nodig: `lib/auth.js:58` zet `/api/rit-token/` en `/api/kv/` in `PUBLIEKE_API_PREFIXEN`.
- **Bestand:** `D:\Sporty\sporty-railway\routes\transport.js` — server-gerenderd template-string (geen index.html).
- **Server-hulpfuncties in dezelfde module (voor het renderen):**
  - `_syncChecksRit(ritId)` — routes/transport.js:513
  - `_leidOphaalRegelsAf(taak)` — routes/transport.js:1070
  - `_zorgVoorChecks(rit)` — routes/transport.js:1089 (maakt `verhuis_checks` aan uit `transport_regels`)
  - `_rekVan(c)` — inline in de route (routes/transport.js:1121): groepeert bakken per rek (eerste letter van de code)
  - `resolveItemTypeId` — lib/db.js:62
- **Server-side renderblokken (in de route-handler):** `stops` (stop-kaarten, 1113-1120), `chkRows` (materiaallijst per rek met twee fase-knoppen Laden/Lossen, 1128-1147), daarna de volledige `res.send(...)` template (1148-1205).
- **Client-JS in de pagina (routes/transport.js:1173-1204):** `toast(tekst,goed)` (1176), `aangekomen(id)` (1182), `tog(id,kind)` (1189); const `TOKEN`.
- **CSS-blokken:** één inline `<style>` (routes/transport.js:1150-1167). Klassen: `.hdr`, `.sec`, `.stop` (+ `.type/.nm/.rt/.ti`), `.chk` (+ `.ok/.ontbreekt/.deels/.fase`, `.ico/.nm/.qty/.nt`), `.fasebtns`, `.fbtn` (+ `.done`, `.b-laden`, `.b-lossen`), `.rek`, `.footer`, `.toast` (+ `.zicht/.goed/.fout`). Geen gedeelde CSS met index.html.
- **API-routes:**
  - `GET /rit/:token` → routes/transport.js:1101
  - `POST /api/rit-token/:token/taken/:taakId/aangekomen` → routes/transport.js:969
  - `POST /api/rit-token/:token/checks/:checkId/laden` → routes/transport.js:926
  - `POST /api/rit-token/:token/checks/:checkId/lossen` → routes/transport.js:943
- **SQL-tabellen gelezen:** `transport_ritten`, `transport_taken` (+ join `locaties`, `kampmomenten`), `verhuis_checks`, `transport_regels`.

## 10. KV-pagina (kampverantwoordelijke, mobiel) — `/kv/:token`

- **Ingang:** publieke link `GET /kv/:token` (routes/kv.js:143-496); token = `kampmomenten.kv_token`. Kantoor kopieert de link via `kopieerKvLink()` (index.html:4582) in `#modal-km` (knop index.html:1335, sectie `km-kv-sectie` 1330-1337).
- **Bestand:** `D:\Sporty\sporty-railway\routes\kv.js` — template-string; script in de template (routes/kv.js:196-493).
- **Server-hulpfuncties:** `_kvKampmoment(token)` (lib/gedeeld.js:39), `_kvVerwacht(km)` (lib/gedeeld.js:26), `_kvNaam(km)` (lib/gedeeld.js:40), `_bakItems(bak)` (lib/gedeeld.js:41).
- **Client-functies in de pagina (routes/kv.js):** `esc` 201, `kvApi` 202, `init` 209, `renderHeader` 218, `renderTabs` 222, `gaNaar` 226, `waardeVan` 236, `attrStatusVan` 241, `voortgang` 244, `renderAll` 257, `renderBlok1` 266 (Wat moet er staan), `renderBlok2` 290 (Vrijdagcontrole), `toggleBak` 355, `stel` 356, `stelUitInput` 361, `bakAfsluiten` 367, `zetAttr` 379, `renderFooter` 388, `verstuurControle` 394, `renderBlok3` 399 (Iets nodig?), `verstuurAanvraag` 422, `renderBlok4` 432 (Iets kapot?), `kvKapotFotoGekozen` 452, `verstuurKapot` 458, `renderBlok5` 471 (Boodschappen, alleen als `DATA.boodschappen` gevuld), `toggleBoodschap` 491; `init()` wordt op 493 aangeroepen.
- **Client-state:** `DATA`, `ACTIEF`, `OPEN_BAK`, `LOCAL`, `ATTR_LOCAL`, `KAPOT_OPEN`, `KAPOT_FOTO`, `BOODSCHAP_VINK`, `TABS` (routes/kv.js:198-199).
- **CSS-blokken:** één inline `<style>` (routes/kv.js:148-166). Klassen: `.code`, `.card`, `.pill`, `.tabpill` (+ `.actief`), `.bloktitel`, `.blokintro`, `.seclabel`, `.rowbtn`, `.bigbtn`, `.textarea`. Veel stijl staat inline in de JS-strings (kleuren hardcoded).
- **API-routes:**
  - `GET /kv/:token` → routes/kv.js:143
  - `GET /api/kv/:token/data` → routes/kv.js:7
  - `POST /api/kv/:token/bakken/:bakId/tellen` → routes/kv.js:51
  - `POST /api/kv/:token/attributen/:attrId/status` → routes/kv.js:90
  - `POST /api/kv/:token/versturen` → routes/kv.js:109
  - `POST /api/kv/:token/aanvraag` → routes/kv.js:118
  - `POST /api/kv/:token/kapot` → routes/kv.js:128
