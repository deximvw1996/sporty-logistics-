# DOORLICHTING-a — architectuur & datamodel Sporty (chat A, 2026-10-28)

Lees-opdracht, geen code- of datawijziging. Start 16:11, tijdslimiet 2 u (tot 18:11).
Bewijsbasis: `server.js` (5.483 regels, 358.765 B) en `index.html` (9.700 regels, 584.438 B) op branch `bouw-a` (= origin/main, commit d181db9);
database = kopie van `sporty-a/sporty.db` (1.007.616 B, stand 2026-08-04 = de prod-zetronde) naar `D:\Sporty\sporty-a-doorlicht\`, testserver op poort 3301 (`DATA_DIR` naar die map, `NODE_PATH` naar de node_modules van de hoofdmap omdat de worktree er geen heeft), login "Claude (API)" / 1111 → `/api/wie-ben-ik` = `{"id":10,"naam":"Claude (API)","rol":"kantoor"}`. Alleen GET's tegen 3301; rijtellingen daarnaast via een sql.js-leesscript in-memory op de kopie (schrijft niets).
Let op: de kopie bevat **0 kampmomenten** (zomerplanning gewist bij Verse Start 2; prod heeft intussen mogelijk herfstdata) — alle "0"-tellingen in de transportketen zijn dus stand-van-kopie, geen oordeel over de code.

---

## 1. KAART

### 1.1 server.js — lagen en "muren"
| regels | wat | bewijs |
|---|---|---|
| 1–22 | bootstrap: `DATA_DIR = RAILWAY_VOLUME_MOUNT_PATH ∥ DATA_DIR ∥ __dirname`, `DB_PATH`, uploads-map, `bundels/` in repo | r.11–19 |
| 24–31 | `uncaughtException`/`unhandledRejection` worden gelogd en **geslikt** (proces blijft draaien) | r.26–31 |
| 36–55 | **Muur 1: Basic auth** op `APP_PASSWORD` voor álles (ook statics); leeg wachtwoord = open | r.43–55 |
| 57–64 | `/bundels` en frontend-statics pas ná muur 1 | r.57, r.64 |
| 68–95 | **persistentie**: `saveDb()` = `db.export()` + `fs.writeFileSync(DB_PATH)` + dagbackup (14 dagen); helpers `run()`/`ins()` roepen elk **zelf** `saveDb()` aan | r.68–71, r.92, r.95 |
| 103–111 | `resolveItemTypeId(naam)`: maakt bij onbekende naam **altijd** een nieuwe `item_types`-rij (ook voor "KV:"/"INFO:"-regels, zie §2.3) | r.103–111 |
| 120–1897 | **migratielaag** (1.778 regels, zie §3); eindigt met `saveDb()` | r.120, r.1897 |
| 1899–1962 | login/sessies: `sessies`-tabel + `_sessieCache` (Map), pincode sha256 | r.1900–1908 |
| 1964–1975 | **Muur 2: sessietoken** (`x-auth-token` of Bearer) op elk `/api/*`, met whitelist `PUBLIEKE_API_PADEN` (login, login-status, setup-eerste-pincode, personeel-lijst-login) en prefixen `/api/rit-token/`, `/api/kv/` (eigen tokenvalidatie per route) | r.1917–1918, r.1964–1975 |
| 1993–5471 | routes per domein (sectiekoppen `// ── … ──`) | zie tabel hieronder |
| 5472+ | globale foutafhandeling, `app.listen` | r.5472 |

Routes vóór muur 2 zijn uitsluitend de vier login-routes (r.1920–1958); `/rit/:token` en `/kv/:token` staan niet onder `/api/` en renderen een eigen mobiele pagina (r.4722, r.4818). Bewijs muur 2 via 3301: `GET /api/themas` zonder token → **401**; `GET /api/kv/xyz/data` → **403** (route-eigen tokencheck); `GET /kv/xyz` → 404.

### 1.2 API-oppervlak
`grep -cE "^\s*app\.(get|post|put|delete)\("` = **220 routes**: get 68, post 82, put 33, delete 37, patch 0.
Per URL-prefix (top): `/api/themas` 19, `/api/transport-taken` 11, `/api/sport` 10, `/api/locaties` 9, `/api/vaste-bakken` 8, `/api/ritten` 8, `/api/bakken` 8, `/api/personeel` 7, `/api/kampmomenten` 7, `/api/gedeeld` 7, `/api/nakijk` 6, `/api/kv` 6, `/api/kleurenborden` 5, `/api/attributen` 5, `/api/voertuig-types` 4, `/api/standaard` 4, `/api/periodes` 4, `/api/nakijk-regels` 4, `/api/materiaal` 4, `/api/item-types` 4, … (75 prefixen in totaal).
Grootste secties (regels): TRANSPORT 618 (r.2676–3293, incl. generator `/api/transport-genereer` r.2678), KV-SCHERM 358 (r.4818), CONFLICTENDETECTOR 234 (r.5176), KV-verwacht/tellen 195 (r.2055), THEMA BAKKEN 111 (r.3399), TEKORTEN PER BAK 111 (r.4236), KAMPMOMENTEN 109, PLANNING-IMPORT 96, CHAUFFEUR-VIEW 96, EXPORT/IMPORT 90, NAKIJKEN 88, VASTE BAKKEN 85, GEDEELD 73 (legacy), SPORT 71, …

### 1.3 index.html
- Twee scriptblokken: admin-SPA r.1502–8800 (450 functies) en service-worker/PWA-rest r.9040–9699 (35 functies); 56 `render*`-functies; 1.492 top-level `let/const/var`-declaraties (grep `^\s{0,4}(let|var|const)`).
- **Tabs** (`const SECS`, r.2013): overzicht, planning, materiaal, transport-noden, transport-plan, transporten, kaart, seizoensoverzicht, kampplanner, personeel → secties `#sec-overzicht` r.453 … `#sec-seizoensoverzicht` r.9031.
- **Materiaal-subtabs** (`setMatSubtab`, r.2059): knoppen in HTML voor themabakken, vastebakken, gedeeld, voorraad, sport, themas, catalogus, nakijken; divs bestaan ook nog voor `standaard` en `voertuigen` **zonder knop** (dode subtabs). Subtab `gedeeld` (legacy `gedeeld_items`) is dus nog bereikbaar — 27 `api()`-calls naar `/gedeeld` in index.html.
- Kern-state: `S={locaties,themas,standaard,kampmomenten,spoed,materiaal,overzicht,locMat}` (r.3704), `CURRENT_USER` (r.3746), `matSubtab` (r.2058), `_tbData/_tbOpen` themabakken (r.2502), `_vasteBakken/_vbSpreiding` (r.2693/2723), `_vrdData` voorraad (r.2962), `_attrAlle` (r.2644), `_behoefteVastTypes` (r.2609), `tpVoorstellen/plannerTaken` (r.3710), `kalData/ovDate` (r.3454), `_kaartMap` (r.6758), `plannerWk` (r.6947). Legacy-state nog aanwezig: `S_chauffeurs` (r.3705), `S.spoed`, `_invSport/_invGedeeld` (r.1948), `ploegShifts` (r.3504).
- Frontend-api-calls per prefix (top): /themas 36, /sport 34, /locaties 28, /kampmomenten 27, **/gedeeld 27**, /transport-taken 24, /ritten 19, /personeel 11, /vaste-bakken 9, **/standaard 9, /verbruik 8, /locatie-materiaal 7, /kalender 7, /thema-categorieen 5, /materiaal 5, /import-themas 3** (vet = legacy-routes die de frontend nog aanroept).

### 1.4 Levende kernketens (met regelbewijs)
1. **themas → thema_bak → bakken(soort='thema') → bak_items(item_type_id) → item_types**: routes r.3399–3509; generator leest `bakken JOIN thema_bak` r.2688; 184 thema's / 408 koppelingen / 351 themabakken / 4.133 items / 3.338 item_types (leesscript); 37 bakken gedeeld door >1 thema.
2. **pool / bulk / spreiding**: `bakken(soort='vast', vast_type, is_bulk, aantal)` + `bulk_spreiding(bak_id,locatie_id,aantal)` (schema r.1799–1806); generator `_themaBehoefteRegels` r.2720–2760 leest `bulk_spreiding` (r.2736/2741) voor bulk en `status='op_locatie' AND huidige_locatie_id` (r.2802, 3014, 3038) voor unieke exemplaren; 115 vaste rijen (67 uniek + 48 bulk, som aantal 234; `/api/vaste-bakken` via 3301: n=115, som=234, bulk=48).
3. **behoefte**: `thema_behoefte(thema_id, vast_type, aantal, notitie, bak_id)` (r.1610–1619) — 90 rijen, 9 met `bak_id`; CRUD r.4054–4085; generator r.2724; conflict `pool_tekort` r.5357–5410.
4. **generator → ritten → taken → regels → checks**: `/api/transport-genereer` (r.2678, 0 writes = preview) → frontend `POST /api/transport-taken` per voorstel (r.3217: 1 `ins` taak + 1 `ins` per regel) → `transport_ritten`/`transport_taken.rit_id` (r.3294) → `verhuis_checks` (r.3510) → laden/lossen via rit-token (r.3612/3628) → `_pasBakAttribuutStatusToe` (r.3577) zet `bakken.status/huidige_locatie_id`; alternatief pad `PUT /api/transport-taken/:id/status` → 'gedaan' (r.3220–3277) dat **ook** bak-status én bulk_spreiding boekt.
5. **kv-cyclus**: `kampmomenten.kv_token/kv_persoon_id` (r.1533–1534) → `/kv/:token` (r.4818) → `GET /api/kv/:token/data` (r.2080, `_kvVerwacht` r.2059) → `POST …/bakken/:bakId/tellen` (r.2123, `nakijk_sessies`+`nakijk_regels`) → `…/versturen` (r.2183, kv_status 'ingediend') → kantoor `GET /api/nakijk-tekorten` (r.4241) → `besteld`/`genegeerd`/`aanvullen` (r.4280–4333; aanvullen boekt `item_type_stock` af r.4293) → `PUT /api/nakijk-sessies/:id/verwerkt` (r.4335, sluit-gate r.4339). KV-boodschappenlijst = `thema_materiaal WHERE name LIKE 'KV:%'` (r.2113).
6. **conflicten**: `GET /api/conflicten` (r.5177) met 11 types: dubbel_thema, geen_levering, geen_ophaling, materiaal_tekort, dubbelboeking_bak, dubbelboeking_attribuut, elders_nodig_vast, elders_nodig_kleur, ontbrekend_transport, locatieconfig_onvolledig, pool_tekort (×2 varianten).

---

## 2. DATAMODEL-OORDEEL

### 2.1 Per tabel (64 tabellen in de db; 76 `CREATE TABLE IF NOT EXISTS` in server.js incl. 3 `_new`-hulptabellen van Mig 53)
Legenda: **L** levend (routes lezen én schrijven, UI gebruikt het), **G** gegevens-only (levend maar alleen via migratie/seed gevuld), **D** dood (0 rijen én geen levende route), **LEG** legacy (nog routes/UI maar bewust vervangen). Rijtelling = db-kopie. "routes r/w" = aantal verwijzingen in het routesdeel (vanaf r.1899) totaal / waarvan schrijvend (grep).

| tabel | rijen | routes r/w | oordeel | bewijs/opmerking |
|---|---|---|---|---|
| themas | 184 | 25/5 | L | `/api/themas` r.2251 |
| thema_bak | 408 | 15/3 | L | koppeltabel, UNIQUE(thema_id,bak_id), **geen FK** |
| bakken | 466 | 71/13 | L | centrale tabel; **geen FK** op thuislocatie/huidige_locatie |
| bak_items | 4.133 | 22/7 | L | FK→bakken (herbouwd in Mig 53); 0 rijen zonder item_type_id |
| item_types | 3.338 | 12/3 | L | 279 zonder enige referentie; **161 namen "KV:…" + 95 "INFO:…"** (zie 2.3); 103 namen >60 tekens |
| item_type_stock | 868 | 14/4 | L | 859 Rozenweg + 9 Kantoor; slechts **1 rij qty>0, 1 rij minimum>0** → bestellijst (`/api/bestellijst` = `[]`) is nog betekenisloos; 225 verbruik-item_types zónder voorraadrij, 29 voorraadrijen zonder verbruik-item |
| attributen | 85 | 22/7 | L | 4 met code; 29 gedeeld door >1 thema |
| thema_attribuut | 135 | 10/3 | L | UNIQUE, geen FK |
| thema_behoefte | 90 | 14/4 | L | geen FK, vast_type tekst (2.5) |
| bulk_spreiding | 55 | 12/5 | L | UNIQUE(bak_id,locatie_id), geen FK; som spreiding = bakken.aantal voor alle 48 bulkrijen (consistent op kopie) |
| locatie_config | 2 | 7/3 | L | UNIQUE(kamplocatie_id,vast_type) |
| kampmomenten | 0 | 27/6 | L | UNIQUE(locatie_id,week) + FK locaties; `periode_id` zonder FK |
| kampmoment_themas | 1 | 18/4 | L | **1 wees met `kampmoment_id='undefined'` (tekst!)** (id 591, thema 4084) — FK ontdook omdat de waarde geen integer is; invoer zonder typecheck |
| vakantieperiodes | 1 | 9/3 | L | enkel "Zomer 2026" (hardcoded seed r.283–286) |
| transport_ritten / transport_taken / transport_regels / verhuis_checks | 0/0/20/0 | 27/11, 45/23, 15/8, 18/5 | L | **20 transport_regels-wezen** (taak 194/195 bestaat niet; geen FK) |
| nakijk_sessies / nakijk_regels | 5/128 | 24/10, 23/9 | L | **96 nakijk_regels-wezen** (sessies 18/19/20 weg) ondanks `ON DELETE CASCADE` → gewist zonder FK-afdwinging (bv. `/api/import/reset` r.3790 of oudere code) |
| aanvragen | 0 | 11/4 | L | S3.3-flow; `foto_data` base64 in db |
| sessies | 112 | 3/2 | L | **nooit opgeruimd** behalve bij logout (r.1989): groeit per login (02/08→28/10: 112) |
| personeel / personeel_shifts | 12/1 | 24/6, 7/3 | L | 2 van 4 kantoor-rijen met pincode; chauffeurs/kv 0 pincodes |
| locaties | 41 | 65/4 | L | 27 kamp + 14 stockage |
| sport_items / sport_sets / sport_planning | 112/112/22 | 16/5, 14/5, 8/3 | L | |
| voertuig_types | 2 | 7/2 | L | |
| thema_bundels | 3 | 6/3 | L | |
| kalender_dagen / gesloten_dagen | 291/1 | 7/3, 8/2 | L | |
| locatie_kleuren / kleurenborden_stock | 0/0 | 9/5, 4/2 | L | kleurenborden-flow, leeg op kopie |
| activiteiten_log | 122 | 3/0 (+`logAct`) | L | `waar-is` zoekt op `beschrijving LIKE '%"naam"%'` (r.4140) — tekstmatch i.p.v. bak_id |
| bak_fotos / bak_nakijk_log | 0/0 | 4/2, 4/2 | G | FK→bakken; base64 in db |
| terugkomst_rapporten / terugkomst_regels | 0/0 | 3/1, 2/1 | LEG | 1 frontend-call; vervangen door nakijk-flow |
| app_vlaggen | 20 | 0 | L | 20 vlaggen, zie §3 |
| **thema_materiaal** | **290** | **10/6** | **LEG, maar actief misbruikt** | zie 2.3; `/api/themas` r.2251 laadt het volledig mee |
| thema_bakken | 3 | 5/0 | LEG/D | 3 resten (thema 4080 atletiek, G11/D17/G00, gemigreerd naar bakken in Mig 53); **nog gelezen in `PUT /api/transport-taken/:id/status` r.3231** (stock-deplétie-tak is daardoor altijd leeg) en in `/api/nakijk` r.4150/4165, `/api/voorraad/nakijken` r.3364 |
| vaste_bakken | 0 | 2/0 | D | alleen nog gelezen in `/api/nakijk` r.4150/4165 |
| vaste_bak_items | 0 | 9/3 | LEG | `_bakItems` (r.2076) leest het voor `soort='vast'` → **KV kan een vaste bak nooit per item tellen** (altijd 0 items); routes r.3984–4002 |
| gedeeld_items / gedeeld_gebruik / gedeeld_stock | 0/0/0 | 9/3, 5/2, 11/3 | LEG | subtab "gedeeld" nog klikbaar (index r.2069), 27 frontend-calls; `/api/spoedtransport` r.4618 en `/api/catalogus-item` r.4667 raken het nog |
| standaard_materiaal / locatie_materiaal / kamp_basis_afwijking | 0/0/0 | 7/3, 11/4, 4/2 | LEG | routes r.2384–2440; **`/api/transport-genereer` r.2678 leest nog `standaard_materiaal`/`locatie_materiaal`** (dode tak); frontend 9+7 calls |
| materiaal_items / materiaal_eenheden / verplaatsingen / set_planning | 0/0/0/0 | 7/3, 3/1, 1/1, 0/0 | LEG/D | `/api/materiaal` r.2630–2633, `/api/overzicht` r.2634; `verplaatsingen` in `/api/ritten/:id/klaarzet` r.3566 |
| verbruik_stock / verbruik_log | 0/0 | 6/1, 3/1 | LEG | `/api/verbruik` r.2653/2667; **conflict `materiaal_tekort` r.5201 leunt op `verbruik_stock`** (0 rijen → vuurt nooit; MASTERPLAN E al genoemd, nog niet opgelost) |
| thema_categorieen | 0 | 3/2 | LEG | routes r.2637–2643, 5 frontend-calls |
| standaard_dozen / standaard_doos_items / locatie_doos_config | 0/0/0 | 0/0, 0/0, 0/0 | D | alleen migratielaag (r.1025–1195); `PUT /api/locaties/:id` r.2004 noemt het in commentaar |
| chauffeurs / ploeg_shifts | 3/1 | 0/0 | D (archief) | Mig 54 gemigreerd; index.html noemt `chauffeurs` nog 29× (renderChauffeursBeheer, S_chauffeurs) |
| spoedmeldingen | 0 | 0/0 | D (archief) | Mig 55; index.html 4 verwijzingen |

### 2.2 Relaties & constraints — wat ontbreekt
- **FK-dekking**: `PRAGMA foreign_keys=ON` (r.118), maar de nieuwe generatie heeft nauwelijks FK's: `bakken`, `thema_bak`, `thema_attribuut`, `thema_behoefte`, `bulk_spreiding`, `item_type_stock`, `locatie_config`, `transport_regels`, `transport_taken`, `transport_ritten`, `sessies`, `aanvragen`, `thema_bundels`, `nakijk_sessies` hebben **geen enkele FK** (PRAGMA foreign_key_list via leesscript). Alleen bak_items/bak_fotos/bak_nakijk_log (→bakken), kampmoment_themas, kampmomenten, nakijk_regels, personeel_shifts, locatie_kleuren hebben FK's.
- Gevolg zichtbaar: 20 `transport_regels`-wezen, 96 `nakijk_regels`-wezen, 1 `kampmoment_themas`-rij met tekst 'undefined'. Delete-routes compenseren handmatig (bv. `DELETE /api/themas/:id` r.2254 wist 5 tabellen zelf).
- **Type-validatie ontbreekt**: SQLite slaat `'undefined'` op in een INTEGER-kolom; geen `CHECK`-constraints, geen parseInt in `POST /api/kampmoment-themas`.
- **Codes**: 167 bakken zonder code; dubbele codes: M00 ×5, RGE ×3, J21 ×3, G59 ×3, O26/K43/K37/K2/I51/I38 ×2 (deels bewust: bak 2/3+3/3 delen een code). Geen UNIQUE, enkel een UI-waarschuwing (MASTERPLAN S2-beslissing 3) — ok als bewuste keuze.
- **Dubbele concepten**: (a) `bakken.status/huidige_locatie_id` vs `bulk_spreiding` (2.4); (b) `bak_items.qty_stock/qty_minimum` (oud, 0 gebruikt) vs `item_type_stock` (nieuw) — de oude kolommen worden nog beschreven in r.3237 via de dode `thema_bakken`-tak; (c) `nakijk_regels.besteld` (0/1) vs `tekort_status` (Mig 60 legt het uit, beide worden nog samen gezet r.4294); (d) `transport_ritten.chauffeur` (tekst) vs `personeel_id` (Mig 48) — laden/lossen logt op `rit.chauffeur` (r.3581); (e) `nakijk_sessies.locatie_id+week` i.p.v. `kampmoment_id` (commentaar r.4239–4240 geeft het zelf toe).

### 2.3 thema_materiaal als prefix-misbruik
- 290 rijen, **190 "KV:…" + 100 "INFO:…" + 0 gewone** (leesscript `GROUP BY prefix`). Verdeeld over 94 thema's, max 31 per thema.
- Parsing op 4 plekken met regex: server r.2113–2114 (KV-boodschappen), index.html r.2599–2605 (themabakken-weergave) en r.3867–3876 (themadetail). INFO-regels bevatten lange vrije tekst (voorbeeld 300+ tekens over pool-materiaal, "themabehoefte volgt in S4.5").
- **Bijwerking**: `POST /api/themas/:id/materiaal` r.2255 roept `resolveItemTypeId(name)` → elke KV/INFO-regel werd een catalogusrij: **161 item_types "KV:…" en 95 "INFO:…"** zitten in `item_types` (3.338 totaal), en Mig 47 (ongegate, r.1214–1246) herhaalt dat bij elke start voor rijen zonder item_type_id. Zo lekt vrije tekst in de centrale catalogus (`/api/item-types` levert 3.338 rijen, 329 KB).
- Oordeel: **slecht**. Het is een werkende interim (MASTERPLAN S4.8 noemt het zelf), maar het vervuilt de catalogus en de KV-lijst heeft geen eenheid/aantal-structuur (qty zit soms in de tekst: "Verse gist (g; 17 pakjes van 42g)").

### 2.4 bulk_spreiding vs status/huidige_locatie_id — twee waarheidssystemen? **Ja, en ze kunnen uit elkaar lopen**
- Voor bulkrijen (`is_bulk=1`) boekt alleen `PUT /api/transport-taken/:id/status` → 'gedaan' per regel-qty in `bulk_spreiding` (r.3243–3261) en laat `bakken.status/huidige_locatie_id` ongemoeid.
- Maar `_pasBakAttribuutStatusToe` (chauffeur laden/lossen, r.3586 en r.3592), `POST /api/bakken/:id/verplaats` (r.4119) en `PUT /api/bakken/:id` kennen **geen bulk-tak**: ze zetten de héle bulkrij op `status='onderweg'`/`op_locatie` en `huidige_locatie_id=X`, zonder `bulk_spreiding` te raken. Na een gelost 17×kleuterfiets via het rit-token staat dus `bakken.huidige_locatie_id`=kamplocatie terwijl `bulk_spreiding` nog "17 Rozenweg" zegt (of omgekeerd via het taak-pad).
- Lezers kiezen verschillend: generator bulk → `bulk_spreiding` (r.2736); `_kvVerwacht` → `huidige_locatie_id` (r.2069); `waar-is` → `huidige_locatie_id` (r.4136); Vaste-bakken-UI → `/api/vaste-bakken/:id/spreiding`. Op de kopie zijn beide nog consistent (alle 48 bulkrijen: som spreiding = aantal, status 'thuis', huidige=thuis), omdat er nog geen transport gereden is.
- Oordeel: **matig-slecht**: ontwerpkeuze is verdedigbaar (uniek vs bulk), maar één van beide moet afgeleid zijn. Voor bulk hoort `bakken.status/huidige_locatie_id` betekenisloos te zijn (of afgeleid: "thuis" als spreiding volledig op thuislocatie), en elk statuspad moet via één functie lopen.

### 2.5 thema_behoefte.vast_type (tekst) vs bak_id
- `vast_type` is een vrije string in `bakken` (65 verschillende waarden, incl. `'EHBO-Koffer'` met hoofdletters naast snake_case, en 1 vaste bak met lege vast_type: id 12237 "Houten kist kruisbogen", die bovendien de enige vaste bak is die via `thema_bak` gekoppeld is — grensgeval attribuut/bak/pool).
- `thema_behoefte` (90 rijen) verwijst 81× op `vast_type` en 9× op een specifiek `bak_id` (Mig 64, springkastelen). `locatie_config` gebruikt dezelfde tekst-referentie. Op de kopie: 0 behoefte-rijen met onbestaand vast_type, 0 mismatch tussen `bak_id` en `vast_type` — nu robuust, maar niets dwingt het af: hernoem een vast_type via `PUT /api/vaste-bakken/:id` en elke behoefte/locatieconfig op dat type valt stil zonder fout (generator r.2724 vindt gewoon geen exemplaren; conflict `pool_tekort` r.5363 rekent met `DISTINCT vast_type`).
- Oordeel: **matig**. Een tekst-type is bruikbaar als er een `vast_types`-tabel (naam, label, is_bulk-default) met FK achter zit — nu bestaat `/api/vast-types` (1 route) enkel als DISTINCT-lijst. `bak_id` als FK naar `bakken` is wél de juiste vorm voor "specifiek exemplaar".

### 2.6 attributen vs bakken
- Definitie klopt met de regel "telbaar = bak": `attributen` heeft geen itemlijst (schema r.1390–1398), KV-check enkel aanwezig/beschadigd (r.2163). Grens is in de praktijk **overlappend**: 4 attributen hebben een magazijncode (dus bak-achtig), voorbeelden "Strijkplanken (2)", "Losse bogen (±16)" dragen een aantal in de naam (telbaar → hoort bak/bulk te zijn); omgekeerd is "Houten kist kruisbogen" een vaste bak zonder vast_type gekoppeld via thema_bak. Combinatie-attributen "Frame en themadoek X" blijven bewust naast de `themaframe`-pool bestaan (Mig 62 commentaar r.1608–1612).
- Structureel zijn `attributen` en `bakken` bijna dezelfde tabel (naam, code, thuislocatie, huidige_locatie, status, foto, notitie) met gedupliceerde statuslogica op 3 plekken (r.3586–3607, r.3262–3273, r.4113–4133). Oordeel: **matig** — grens helder op papier, maar het model dwingt ze niet af en dupliceert code.

### 2.7 Wat er van de legacy-generaties (MASTERPLAN §2 lijst B) nog over is
| generatie | schema (CREATE nog in server.js) | rijen | routes | frontend |
|---|---|---|---|---|
| thema_materiaal | r.210 + kolommen r.199–201, 229, 581–584 | 290 (prefix) | 10 verwijzingen, 6 schrijvend (r.2251–2257, 2324, 2360, 2428, 3418) | themadetail/themabakken-weergave + 3× `/import-themas` |
| materiaal_items/eenheden/verplaatsingen/set_planning | r.230–232, 165 | 0 | `/api/materiaal*` (4), `/api/overzicht`, `/api/catalogus-item`, klaarzet r.3566 | 5 calls `/materiaal`, 2 `/overzicht` |
| verbruik_stock/verbruik_log | r.166–167, 249, 259 | 0 | `/api/verbruik` (2), spoedtransport, catalogus-item, **conflicten r.5201** | 8 calls `/verbruik` |
| standaard_materiaal/locatie_materiaal/kamp_basis_afwijking | r.211, 234–235 | 0 | `/api/standaard` (4), `/api/locatie-materiaal`/`locaties/:id/materiaal*` (6), **transport-genereer r.2678** | 9 + 7 calls; `renderStandaard`/`renderLocMatSection` |
| gedeeld_* | r.157–158, 269 | 0 | `/api/gedeeld` (7) + spoedtransport + catalogus-item + `/api/log` r.4531 | subtab `gedeeld` klikbaar, 27 calls |
| thema_categorieen | r.175, 209 | 0 | 3 routes r.2637–2643 | 5 calls, `renderThemaCatBeheer` |
| standaard_dozen/… | r.1025–1052 | 0 | 0 | 0 |
| vaste_bakken/vaste_bak_items | r.601–619 | 0/0 | 2 lees + 9 (items-CRUD r.3984–4002, `_bakItems` r.2076, nakijk/start r.4191) | 1 call `/vaste-bak-items` |
| chauffeurs/ploeg_shifts | r.236–246 | 3/1 | 0 (alleen Mig 48/54) | 29 + 1 verwijzingen (dode UI) |
| spoedmeldingen | r.229 | 0 | 0 (alleen Mig 55) | 4 verwijzingen (`S.spoed`) |
| thema_bakken | r.384–391 | 3 | 5 lees (r.3231, 3292?, 3364, 3482, 4150, 4165) | 1 |

Samengevat: 24 legacy-tabellen worden nog elke start aangemaakt; ±13 ervan hebben nog routes (±45 route-verwijzingen) en ±70 frontend-api-calls. S1.1 ("alle dode routes verwijderen") is in de STATUSLOG als ✅ gemarkeerd (2026-08-01), maar grep laat zien dat de materiaal/verbruik/standaard/gedeeld/thema-categorieen/import-themas-routes er nog (of opnieuw) staan.

---

## 3. MIGRATIELAAG (r.120–1897, 1.778 regels)

Mechanisme: `PRAGMA user_version` (staat op 6) wordt na Mig 6 niet meer gebruikt; alles daarna is ongegate `addColumnIfMissing`/`createTableIfMissing` (idempotent) plus gegate bodies op `app_vlaggen` (20 vlaggen in de kopie: migratie20/21/23/33/36/37/42/49/50/51/52/53/54/55/59/60/62/63/64_klaar, kampplanner_leeggemaakt). Elke `ins()` in de migratielaag schrijft het bestand (zie §4), de laag eindigt met `saveDb()` r.1897.

| nr | regel | aard | gegate? | vlag pas bij succes? | oordeel |
|---|---|---|---|---|---|
| 1 | 207–270 | CREATE-blok (incl. 20 legacy-tabellen) | n.v.t. (idempotent) | — | ok, maar maakt dode tabellen aan |
| 2–6 | 143–188 | kolommen/tabellen op `user_version<N` | user_version | — | ok (verouderd mechanisme; Mig 17 r.342 repareert verse-db-gaten) |
| 7–13, 15–19 | 190–205, 274–280, 288–292, 324–337, 345–365 | addColumn/seed | idempotent | — | ok; **Mig 12 seedt "Zomer 2026" hardcoded (r.283–286) op lege tabel** — strijdig met regel 5 (dynamisch) |
| 14 | 303–321 | ritten-backfill | idempotent via WHERE | — | ok |
| 18 | 377–382 | voertuigen-seed | op naam | — | ok (klein) |
| 20 | 441–470, 473–520 | sublocaties-seed + sport-herseed | sublocaties ongegate (op naam); seed via `migratie20_klaar` | **nee**: vlag gezet r.479 **vóór** de body r.480 | gegate, maar Mig-51-patroon (vlag bij crash gezet); body 41 regels dood |
| 21/22 | 530–538 | stub | vlag | ja (r.538, na lege body) | dood (9 r.) |
| 24 | 540–556 | Abdijschool-seed | `kampplanner_leeggemaakt` + `<8`-drempel | — | gegate; drempel-logica (tijdbom-stijl) staat er nog; dood (17 r.) |
| 25 | 558–564 | stub | `migratie49_klaar` | — | dood |
| 40 | 566–580 | opruimen kampmoment_themas-wezen | **ongegate**, elke start | — | ok (idempotent), maar vangt de 'undefined'-wees niet (`NOT IN (SELECT id FROM themas)` kijkt alleen naar thema_id) |
| 26 | 582–592 | addColumn + UPDATE op 4 themanamen elke start | UPDATE ongegate (no-op), body `migratie49_klaar` | — | dood (11 r.) |
| 27 | 594–634 | item_types/vaste_bakken-schema + seed | seed op `!migratie49_klaar && leeg` | — | ok sinds S0.1; seed-body dood (12 r.) |
| 28 | 636–668 | nakijk-schema | idempotent | — | ok |
| 29 | 670–677 | stub op `thema_bakken leeg && thema_materiaal>0` | gate op data, geen vlag | — | **guard zonder vlag**: thema_bakken heeft 3 resten → onwaar, maar als iemand die 3 rijen wist, blijft de lege stub onschadelijk. dood (8 r.) |
| 30 | 679–837 | item_types-seed (gegate) + alias-koppeling (ongegate, elke start) | seed `!migratie49_klaar && 0 rijen` | — | seed dood (±75 r.); alias-koppeling (±80 r.) is no-op (0 bak_items zonder item_type_id) |
| 31 | 839–887 | verbruik_stock-alias (ongegate) + personeel-schema | — | — | alias-deel dood (0 rijen verbruik_stock) (±45 r.) |
| 32 | 889–893 | stub | `migratie49_klaar` | — | dood |
| 33/36/37 | 895–945 | stubs met eigen vlag | vlag | ja (na lege body) | dood (±40 r.), loggen "al uitgevoerd" bij elke start |
| 34/35/43 | 907–920, 1018–1020 | lege arrays/`{}` | — | — | dood |
| 41 | 947–964 | sport_sets voor set-loze items | **ongegate** (op data) | — | levend-ish maar is een seed zonder vlag: nieuw `sport_item` via `/api/sport` krijgt bij herstart automatisch een set — gewenst gedrag? niet gedocumenteerd |
| 42 | 966–1000 | sport_planning-seed uit JSON | `migratie42_klaar` | **nee**: vlag gezet r.972 **vóór** body | gegate (S0.2), zelfde vlag-vóór-body-patroon; dood (35 r.) |
| 44/45 | 1002–1016 | stubs | `migratie49_klaar` / `kampplanner_leeggemaakt` | ja | dood |
| 38 | 1022–1195 | standaard_dozen-schema + 7 dozen-seed (array ±135 r.) | seed op `!migratie49_klaar` | — | ok sinds S0.1; schema + array dood (±170 r.); logt elke start "klaar" |
| 23 | 1197–1205 | stub | vlag | ja | dood |
| 46 | 1207–1212 | kleurenborden_stock-schema | idempotent | — | ok |
| 47 | 1214–1246 | item_type_id-backfill over 10 tabellen (6 legacy) | **ongegate, elke start** | — | **risico**: elke rij zonder item_type_id in o.a. `thema_materiaal` wordt een catalogusrij (zo kwamen de 256 KV/INFO-item_types erin); hoort gegate of beperkt tot levende tabellen |
| 48 | 1248–1269 | chauffeurs→personeel | ongegate (op data) | — | no-op nu; dood na Mig 54 (22 r.) |
| 49 | 1270–1301 | wis 32 tabellen | vlag | **nee**: fouten per tabel niet-fataal, vlag altijd gezet (r.1299) | gegate; dood (32 r.) |
| 50 | 1303–1315 | wis 8 tabellen | vlag | nee (zelfde patroon) | dood (13 r.) |
| 51 | 1317–1346 | opruim | vlag | **nee** (r.1345 buiten try — het schrikvoorbeeld) | dood (30 r.) |
| 52 | 1348–1367 | herstel 51 | vlag | **ja** (r.1364 binnen try) | dood (20 r.) |
| S2 | 1369–1431 | bakken/attributen/stock/config-schema | idempotent | — | ok |
| 53 | 1432–1508 | thema_bakken→bakken + tabel-herbouw | vlag | ja | dood (77 r.); **niet-atomair**: DROP/RENAME van 3 tabellen zonder transactie — crash halverwege = half schema, vlag niet gezet, herstart probeert `CREATE TABLE bak_items_new` opnieuw → faalt (bestaat al) → permanent in fout. Theoretisch, want al gedraaid |
| S3/56 | 1510–1545 | schema | idempotent | — | ok |
| 59 | 1546–1568 | verse start 2 (wist 19 tabellen) | vlag | ja | dood (23 r.) |
| 58/60/61 | 1570–1602 | kolommen + backfill | 60: vlag, ja | — | ok; 60-body dood (12 r.) |
| 62 | 1603–1619, 1662–1786 | behoefte-schema + databody (frames, 81 regels uit INFO-tekst) | vlag | ja | dood (125 r.) — **volgorde**: Mig 64 (r.1620) staat vóór de body van 62 (r.1663) in het bestand; op een verse db draait 64 vóór 62 en vindt geen themaframes/behoeften — alleen relevant bij herbouw vanaf lege db |
| 64 | 1620–1661 | hardcoded themanamen/kasteelnamen + 8 standaardmateriaal-rijen | vlag | ja, maar `INSERT INTO app_vlaggen (naam)` zonder `OR IGNORE` (r.1657) | dood (42 r.); hardcoded namen = regel-5-schending in migratie (aanvaardbaar als eenmalig) |
| 63 | 1787–1846 | bulk-samenvouwing | vlag | ja | dood (60 r.) |
| 57/54/55 | 1848–1896 | kolom + 2 datamigraties | vlag | ja | dood (±45 r.) |

**Antwoord op de vraag "alles gegate?"**: alle *seeds en destructieve bodies* zijn gegate (20, 21, 24, 27, 30, 38, 42, 49–55, 59, 60, 62–64) — de herseed-les is toegepast. **Vlag-vóór-body** (Mig-51-patroon) staat nog in **Mig 20 (r.479), 42 (r.972), 49 (r.1299 na niet-fatale fouten), 50 (r.1313)**; ongevaarlijk omdat ze al gedraaid zijn, maar het patroon hoort niet als voorbeeld in het bestand. **Ongegate code die elke start schrijft/zaait**: Mig 12 (periode "Zomer 2026" op lege tabel), 20-sublocaties, 18-voertuigen, 41 (sport_sets), 47 (item_types-backfill incl. legacy-tabellen), 48, 30/31-alias-koppelingen, 40 (opruimen). Daarvan is **47 de enige echt schadelijke** (catalogusvervuiling).

**Dode migratiecode**: som van de permanent geskipte bodies/stubs/seed-arrays in de tabel ≈ **1.000 regels** (41+9+17+7+11+12+75+80+45+40+19+35+19+135+9+22+32+13+30+20+77+23+12+125+42+60+45 ≈ 1.055) van de 1.778; wat moet blijven is ±700 regels schema (CREATE/addColumn) en de vlag-guards zelf. Daarbovenop: 20 CREATE TABLE's van dode tabellen (±60 regels) die pas weg kunnen als hun routes weg zijn.

---

## 4. SCHAAL

**Tellingen geverifieerd via 3301**: `/api/themas` n=184 (79 kamp / 105 themadag, 97.883 B), `/api/voorraad` n=868 (142.485 B), `/api/vaste-bakken` n=115 (som aantal 234), `/api/attributen` 85, `/api/item-types` 3.338 (329.449 B), `/api/alle-bakken` **1.110.116 B** (volledige bakken+items-dump), `/api/nakijk-sessies` **584.438 B** bij 5 sessies, `/api/dbinfo` themas=184.

**Schrijfmodel** (r.68–95): `saveDb()` exporteert de hele in-memory db en schrijft `DB_PATH` **synchroon** (`writeFileSync`, geen temp-bestand + rename, geen fsync-strategie), daarna 1×/dag een backup-kopie. `run()` en `ins()` roepen `saveDb()` **per statement** aan; daarbovenop staan 59 expliciete `saveDb()`-aanroepen in routes (grep), die dus dubbel schrijven. Alleen `db.run` direct (3 plekken: import r.3791/3815, sport-foto r.4504) schrijft niet.
Per mutatie-route (telling run/ins/saveDb via awk): `POST /api/spoedtransport` 7 run + 4 ins + 1 saveDb = **12 volledige bestandsschrijvingen**; `PUT /api/transport-taken/:id/status` 6+1+1 = 8 **plus** 1 per transport_regel (lus r.3243–3273) → bij 30 regels ±40 schrijvingen; `PUT /api/transport-taken/:id/move` 5+1; `POST /api/transport-taken` 1 + 1 per regel (r.3217); `POST /api/kv/:token/bakken/:bakId/tellen` 1–2 + 1 per item + 1 → bak met 50 items (max op kopie) = ±52 schrijvingen; `POST /api/themas/:id/bakken` 2; `PUT /api/aanvragen/:id/status` 1+3+1. `logAct` (r.112) is zelf ook een `run()` = nog een schrijving per logregel. Migratielaag bij start: elke `ins()` schrijft eveneens (bv. Mig 47 per gekoppelde rij).

**Gemeten kost** (scratchpad-benchmark op de 1.007.616 B-kopie, N=20): export 1,1 ms + write 0,9 ms = **≈2 ms per saveDb**. Dus de 52 schrijvingen van één KV-telling ≈ 0,1 s, blokkerend in de event-loop (Node is single-threaded: intussen wacht élke andere request). Bij 1 MB is dat verwaarloosbaar; de kost is lineair in bestandsgrootte: bij 10 MB ≈ 20 ms/schrijving, 50 items-telling ≈ 1 s blokkering. Groeifactoren: `activiteiten_log` (122 rijen, elke status- en verplaatsingsactie), `sessies` (112, nooit opgeruimd), en **base64-foto's in de db** (`aanvragen.foto_data` KV-kapotmelding r.2209 zonder limiet behalve `express.json 5mb` r.34; `attributen.foto_data`; `bakken.foto_opgeplooid/opgezet` met client-resize 1200 px; `bak_fotos`). Tien kapot-foto's van 1–2 MB = een db van 15–20 MB → 30–40 ms per schrijving × tientallen per actie. Sport-foto's gaan wél naar bestand (r.4484) — dat patroon hoort overal.
Schijfbudget: 14 dagbackups × bestandsgrootte in `DATA_DIR/backups` (r.79–89) + `voor-herstel-*.db` (r.3764, nooit opgeruimd).

**Gelijktijdigheid / race-risico**
- Node serialiseert handlers; alle schrijvende routes zijn synchroon (1 `async`-route: `/api/locaties/geocode` r.2223, die tussen `await`s `run()` doet — tijdens geocode kunnen andere requests tussenkomen, maar elke `run` is atomair op de in-memory db; benigne). Conclusie: **geen echte write-race in het proces** — er is geen lock/queue nodig én er is er ook geen (grep op queue/lock/mutex: 0).
- **Verlies-/corruptierisico zit in het bestand**: `writeFileSync` overschrijft `sporty.db` in-place; een crash/kill (Railway redeploy, OOM, `process.exit` in herstel-db r.3767) **midden in** een schrijving laat een afgeknot bestand achter → volgende start: `new SQL.Database(buf)` faalt of leest half → enige redding is de dagbackup (max 1 dag oud) of de Railway-volume-snapshot. Railway stuurt SIGTERM bij redeploy; er is geen `SIGTERM`-handler die een laatste nette save doet (grep `SIGTERM`: 0), maar omdat elke mutatie al direct schrijft is het venster klein (ms).
- **Fouten na mutatie, vóór save**: `uncaughtException` wordt geslikt (r.26); een `writeFileSync`-fout (schijf vol) gooit in `saveDb` → in-memory staat is al gewijzigd, bestand niet; volgende succesvolle save schrijft alles alsnog, dus geen verlies zolang het proces leeft; bij herstart wel.
- **Meerdere instanties**: één Railway-replica met één volume — zo blijven. Twee replica's zouden elkaars bestand overschrijven (geen lock).
- **Lees-kant**: KV-token-pagina's en chauffeurspagina's lezen `nakijk_regels` volledig in (`all('SELECT * FROM nakijk_regels')` r.2086 en r.4243 — alle regels van alle sessies per request); 9 weken × ±30 locaties × ±5 bakken × ±11 items ≈ 15–20k regels → elke KV-pagina-load filtert die in JS. Werkt, maar schaalt kwadratisch in de tekorten-lijst (r.4247 `regels.filter` per sessie).
- **Sessiecache** `_sessieCache` (r.1902) groeit onbegrensd en wordt alleen bij logout geleegd.

**Overleeft dit de zomer (9 weken, dagelijks, kantoor + chauffeurs + KV's)?** Ja, mits (a) de db klein blijft (geen base64-foto's), en (b) er één instance draait. Realistische volumes: ±50 KV-tellingen/vrijdag × 50 schrijvingen × 2 ms = 5 s totale blokkering per vrijdag; transporten ±10/dag × 40 schrijvingen → verwaarloosbaar. Het echte risico is niet doorvoer maar **één afgeknot bestand na een ongelukkig getimede herstart** en **ongebonden groei door foto's**.

---

## 5. OORDEEL

| onderdeel | oordeel | kern |
|---|---|---|
| Kaart / secties (server.js) | **matig** | Muren kloppen (401/403 bewezen), secties helder gelabeld; maar 220 routes waarvan ±45 legacy-verwijzingen, 5.483 regels in één bestand, transport-sectie 618 regels met 3 statuspaden |
| Kaart / index.html | **matig** | 10 tabs + 8 subtabs werkbaar; dode subtab-divs (standaard, voertuigen), legacy-UI (gedeeld-subtab, chauffeurs-beheer, S.spoed), 1.492 globale variabelen |
| Datamodel — nieuwe kern (thema→bak→item→item_type, behoefte, pool) | **goed** | 0 wezen in de hele thema/bak/item/attribuut/behoefte-keten; bulk-spreiding consistent |
| Datamodel — constraints | **slecht** | nagenoeg geen FK's/CHECK's op de nieuwe generatie; bewijs: 'undefined' in kampmoment_themas, 20 + 96 wezen in transport_regels/nakijk_regels |
| Datamodel — dubbele waarheden | **matig** | bulk_spreiding vs status/huidige_locatie (kan uiteenlopen via rit-token/verplaats), qty_stock vs item_type_stock, besteld vs tekort_status, chauffeur-tekst vs personeel_id |
| thema_materiaal (KV:/INFO:) | **slecht** | 290 prefix-rijen, 256 ervan als vervuiling in item_types; regex-parsing op 4 plekken |
| Legacy-rest | **matig** | 24 dode/legacy-tabellen in schema, ±13 met routes, ±70 frontend-calls; S1.1 staat ✅ maar is niet (meer) waar |
| Migratielaag | **matig** | herseed-les toegepast (alle seeds gegate); ±1.000 regels dode code, 4× vlag-vóór-body-patroon, Mig 47 ongegate en schadelijk, Mig 12 hardcodet "Zomer 2026" |
| Schaal | **matig** | 2 ms/schrijving nu; per-statement-schrijven (tot ±50 per actie) en base64-foto's in db zijn de groeibom; geen atomaire schrijving |

### Moet vóór de herfstvakantie (2–8 nov) — klein, laag risico, voorkomt echte fouten
1. **Atomaire save**: in `saveDb()` eerst naar `DB_PATH+'.tmp'` schrijven, dan `fs.renameSync` (r.68–72). 3 regels; sluit afgeknotte db bij crash/redeploy uit. Plus een `process.on('SIGTERM')` die `saveDb()` doet en `process.exit(0)`.
2. **Foto's uit de db**: `aanvragen.foto_data` (r.2209, r.2596) en `attributen.foto_data`/`bakken.foto_*`/`bak_fotos` naar `UPLOADS_DIR` zoals sport-foto's (r.4484) óf minstens een server-side limiet (bv. weigeren > 300 KB base64) in de KV-kapotroute. Nu kan één KV-foto de db ×2 maken.
3. **Bulk-pad dichten**: in `_pasBakAttribuutStatusToe` (r.3577) en `POST /api/bakken/:id/verplaats` (r.4113) bulkrijen (`is_bulk=1`) óf overslaan óf via `bulk_spreiding` boeken; één helper `verplaatsBak(bak, naarLocatie, qty)` die beide paden (r.3243–3273 en r.3586–3607) gebruiken.
4. **Typecheck op koppelroutes**: `parseInt` + bestaanscontrole op `kampmoment_id`/`thema_id` in `POST /api/kampmoment-themas` (en de wees id 591 opruimen in Mig 40 door ook `kampmoment_id NOT IN (SELECT id FROM kampmomenten)` te wissen, r.571).
5. **Mig 47 gaten** op een vlag `migratie47_klaar` of beperken tot levende tabellen (`bak_items`, `sport_items`, `transport_regels`) — stopt de item_types-vervuiling bij elke herstart. Eenmalige opruimmigratie 65 (gegate, vlag pas na succes): `DELETE FROM item_types WHERE (naam LIKE 'KV:%' OR naam LIKE 'INFO:%') AND id NOT IN (levende referenties)` → −256 rijen; en `thema_materiaal.item_type_id` op NULL laten.
6. **Vakantieperiode herfst**: Mig 12 (r.283–286) zaait alleen bij lege tabel, dus geen gevaar, maar V2 (periodes-CRUD) moet de herfstperiode vóór 2 nov in prod hebben; `kampmomenten.periode_id DEFAULT 1` (r.288) is een stille val als periode 1 "Zomer 2026" blijft.

### Voor de zomer (9 weken) — structureel, na de herfst
7. **Schrijven batchen**: `run()`/`ins()` zonder `saveDb()`; één `saveDb()` per request via een middleware-hook op `res.on('finish')` (of een `dirty`-vlag + `setImmediate`-flush). Verlaagt 50 schrijvingen per KV-telling naar 1; de 59 losse `saveDb()`-calls worden dan de enige. Test: volle-run + tel `writeFileSync`-aanroepen per route.
8. **Constraints toevoegen** (SQLite kan geen FK toevoegen via ALTER → tabel-herbouw in een gegate migratie met transactie, vlag pas na succes): FK's op `thema_bak`, `thema_attribuut`, `thema_behoefte(thema_id, bak_id)`, `bulk_spreiding`, `item_type_stock`, `locatie_config`, `transport_regels(taak_id)`, `transport_taken(rit_id, kampmoment_id)`, `verhuis_checks(taak_id)`, `sessies(persoon_id)`, `aanvragen`, `nakijk_sessies(thema_bak_id/attribuut_id)`. Vooraf: wezen opruimen (20 + 96 + 1).
9. **KV-boodschappen en INFO als structuur**: tabel `thema_boodschappen(thema_id, naam, qty, eenheid, volgorde)` en kolom `themas.notitie` (of `thema_notities`); migratie zet de 190 KV- en 100 INFO-rijen om; `thema_materiaal` daarna leeg en uit `/api/themas` (r.2251) halen. Regex-parsing op 4 plekken verdwijnt.
10. **vast_types als tabel** (`vast_types(naam PK, label, is_bulk_default, blazers_default)`), FK vanuit `bakken.vast_type`, `thema_behoefte.vast_type`, `locatie_config.vast_type`; hernoemen wordt dan een UPDATE met cascade i.p.v. stille breuk. Normaliseer 'EHBO-Koffer' → snake_case.
11. **Legacy-opkuis S1.1 écht afmaken**: routes `/api/materiaal*`, `/api/verbruik*`, `/api/standaard*`, `/api/locatie-materiaal*`, `/api/gedeeld*`, `/api/thema-categorieen*`, `/api/import-themas*`, `/api/overzicht`, `/api/catalogus-item` + hun frontend-calls en subtab `gedeeld`; `thema_bakken`-lezingen in r.3231/3364/4150/4165 vervangen door `bakken`; conflict `materiaal_tekort` (r.5201) op `item_type_stock` zetten (of schrappen tot voorraad gevuld is); `vaste_bak_items`-pad in `_bakItems` (r.2076) → `bak_items` zodat KV ook vaste bakken telt. Daarna de 20 legacy-CREATE's en ±1.000 regels dode migratiecode verwijderen (vlaggen blijven), met regeltelling voor/na.
12. **Lees-queries per sessie** i.p.v. alles: r.2086 en r.4243 `nakijk_regels WHERE sessie_id IN (…)`; paginering op `/api/alle-bakken` (1,1 MB) en `/api/nakijk-sessies` (584 KB bij 5 sessies — vermoedelijk met regels genest).
13. **Sessies-opruiming**: `DELETE FROM sessies WHERE created_at < now-30d` bij start; `_sessieCache` meeleggen.
14. **Voorraad vullen of bestellijst verbergen**: met 1 van 868 rijen qty>0 is `/api/bestellijst` leeg en "aanvullen boekt af" werkt op 0-standen (Math.max(0,…) r.4292 maskeert dat).

### Ooit
15. `nakijk_sessies.kampmoment_id` i.p.v. `locatie_id+week` (commentaar r.4239 erkent het); `transport_ritten.chauffeur` → alleen `personeel_id`; `nakijk_regels.besteld` laten vallen.
16. `attributen` en `bakken` samenvoegen tot één `objecten`-tabel met `soort ∈ {thema_bak, vast, attribuut}` — haalt 3× gedupliceerde statuslogica weg; of minstens één gedeelde statusfunctie.
17. `activiteiten_log` met `object_soort/object_id`-kolommen zodat `waar-is` (r.4140) niet op `beschrijving LIKE '%"naam"%'` hoeft te zoeken.
18. server.js opsplitsen in modules per sectie (transport, kv, nakijk, migraties) en index.html in losse js-bestanden — de secties bestaan al als commentaarkoppen.
19. Echte SQLite (better-sqlite3 met WAL) i.p.v. sql.js-export per schrijving, zodra schrijfvolume of bestandsgrootte dat vraagt; met punt 7 is dat voor de zomer nog niet nodig.

---

## Verslag-afsluiting
- **Wat af is**: dit document, 5 hoofdstukken zoals gevraagd.
- **Bewijs**: elke claim met regelnummer (server.js/index.html), 3301-GET-uitslag of leesscript-telling (scripts in scratchpad `tel.js`, `tel2.js`, `bench.js`; niet in de repo).
- **Tests gedraaid**: geen bouwopdracht → geen `scripts/test-*.mjs`; wel 16 GET-routes op 3301 (alle 200) + 3 muur-checks (401/403/404). Opmerking: `scripts/` bevat géén `test-*.mjs`/`volle-run.mjs` op deze branch (V1 is nog niet gebouwd).
- **GEVONDEN** (buiten opdracht, niet gefixt): (1) `kampmoment_themas` id 591 met `kampmoment_id='undefined'`; (2) 96 `nakijk_regels`- en 20 `transport_regels`-wezen; (3) 256 KV/INFO-rijen in `item_types`; (4) `_bakItems` leest `vaste_bak_items` (0 rijen) → KV telt vaste bakken nooit per item; (5) stock-deplétie in taak-status leest `thema_bakken` (dood); (6) bulk-rijen krijgen volledige status-wijziging via rit-token/verplaats; (7) worktree `sporty-a` heeft geen `node_modules` (server start niet zonder `NODE_PATH`).
- **Buiten mijn gebied**: niets gewijzigd; alleen `DOORLICHTING-a.md` toegevoegd. Gebruikte hulpbestanden staan buiten de worktree (`D:\Sporty\sporty-a-doorlicht\`, scratchpad).
