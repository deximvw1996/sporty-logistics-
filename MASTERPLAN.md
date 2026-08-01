# MASTERPLAN — Sporty Logistiek

> **Werkwijze (zoals atlas-v2):** dit document is de enige bron van waarheid voor wat er gebouwd wordt en in welke volgorde.
> Per taak bouwt de bouwer (Sonnet) autonoom, levert **bewijs** (herdraaibare test/API-call/screenshot) en commit.
> De reviewer (Fable) keurt per beurt met **onafhankelijk herdraaide bewijzen** + live-checks. Acceptatie = groen op herdraai, nooit op belofte.
> Elke afgeronde taak wordt afgevinkt in de STATUSLOG onderaan. Afwijken van dit plan = eerst overleggen met Maxim.

Laatst bijgewerkt: 2026-08-01 (initiële versie na volledige doorlichting van server.js 3.885 regels + index.html 9.833 regels).

---

## 1. Visie & vaste ontwerpregels

De app beheert de volledige logistiek van Sporty vzw-kampen: kampen plannen, materiaal beheren, transporten organiseren, en de vrijdagcontrole/aanvulling-cyclus. Drie rollen:

| Rol | Mag |
|---|---|
| **Kantoormedewerker** | Alles |
| **Chauffeur** | Alles |
| **Kampverantwoordelijke (KV)** | Enkel: vrijdagcontrole doorgeven + aanvraag indienen tijdens de week |

**Vaste ontwerpregels (uit de testcase-gesprekken met Maxim — NIET van afwijken):**

1. **Chauffeur ziet bakken, geen inhoud.** Een transportlijst voor de chauffeur = bakken + attributen met hun magazijncode (bv. "KL bak — N08", "Decor Alice"). Nooit item-detail.
2. **Kantoor ziet inhoud.** Elke bak heeft een itemlijst met gewenst aantal per item; elk item verwijst verplicht naar de centrale catalogus (`item_types`). "Knutsellijm in bak E26" = hetzelfde item als "Knutsellijm in de voorraad". Dat is de kern van stockbeheer.
3. **Verbruiksitem vs. duurzaam.** Verbruiksitems (diploma's, kranten, lijm...) raken op en worden telkens aangevuld/aangekocht; duurzame items enkel vervangen bij kapot/verloren.
4. **Alles met een code ligt in de Rozenweg.** Bakken en attributen met een magazijncode (G11, D17, N08...) staan fysiek in de Rozenweg. Kamplocaties zijn GEEN stockageplaats.
5. **Locatieconfiguratie is per locatie instelbaar.** Elke kamplocatie heeft een eigen vaste uitrusting (1 adminkast altijd; 1 of 2 EHBO; wel/geen sportkoffer per leeftijdsgroep...). Kantoor beslist dit zelf per locatie.
6. **Thema's zijn de bouwstenen.** Thema (naam + leeftijdsgroep) → themabakken (label + code) → items (qty + verbruik-vlag + item_type). Attributen (decor, croquet-doelen...) horen bij een thema maar zijn geen bak.
7. **KV-controlecyclus:** KV telt op vrijdag wat er nog in de bakken zit → app berekent tekort (gewenst − geteld) → kantoor ziet tekorten en vult aan. Thema al eens gebruikt? Dan is de KV-data het startpunt voor kantoor.
8. **KV-aanvraag tijdens de week** gaat naar kantoor; kantoor beslist en zet het eventueel om in een spoedtransport.
9. **Data wordt stuk per stuk heropgebouwd.** De database is bewust leeggemaakt (behalve sportpakketten, locaties, personeel). Elk thema komt er één per één terug in, uit de themabundel-PDF's, met Maxims controle. Eerste thema: "Als atleet over de meet" (✅ staat er al in).

---

## 2. Huidige stand (doorlichting 2026-08-01)

### Wat goed zit
- **Kern-datamodel nieuwe generatie is gezond:** `themas → thema_bakken → bak_items(item_type_id)` + centrale `item_types`-catalogus met `resolveItemTypeId` (100% dekking sinds Migratie 47). `vaste_bakken` parallel ernaast.
- **Transportketen is compleet:** ritten → taken → regels → verhuis_checks, met klaarzet-flow, voertuigcapaciteit, chauffeur-link (`/rit/:token`, read-only mobiel), en een werkende voorstellen-generator die sinds de fix uit `thema_bakken` leest en Rozenweg/Kantoor correct routeert.
- **Nakijk-flow (v2) heeft de juiste tweestaps-structuur** (KV-status → kantoor-status) — precies wat regel 7 vraagt.
- **Sportpakketten, locaties, personeel**: data aanwezig en werkend; sportpakketten nu ook kiesbaar bij het aanmaken van een kampmoment.
- Frontend roept geen enkel niet-bestaand endpoint aan; de basis is stabiel.

### Kritieke problemen (uit de audits)

**A. Herseed-lekken — de opkuis wordt stilletjes ongedaan gemaakt.** Ongegate migraties zaaien bij elke (her)start data terug die Maxim bewust gewist heeft:
- Mig 38 (r.1477): 7 standaarddozen + inhoud komen terug zodra de tabel leeg is → **is vermoedelijk al gebeurd op productie**
- Mig 27 (r.836): 4 vaste_bakken komen terug
- Mig 30 (r.911): ±95 generieke item_types komen terug
- Mig 20 (r.442): wist+herseedt sportdata als count ≤ 15 (tijdbom)
- Mig 42 (r.1360): herseedt sport_planning als < 100 rijen (tijdbom)

**B. Legacy-laag van 3 dode generaties.** `thema_materiaal`, `materiaal_items`/`materiaal_eenheden`/`verplaatsingen`/`set_planning`, `verbruik_stock`/`verbruik_log`, `standaard_materiaal`/`locatie_materiaal`/`kamp_basis_afwijking`, `gedeeld_*`, `thema_categorieen` — allemaal leeg, maar ±25 dode routes en ±1.600 regels dode migratiecode verwijzen er nog naartoe. De import-themas-route schrijft zelfs nog naar de oude structuur (gevaarlijk i.c.m. Mig 29 die dan bij herstart oude→nieuwe structuur migreert).

**C. Frontend: ±1.500 regels dode code + dubbele systemen.** Oude kalender-renderers, onbereikbare spoed-sectie, QR/foto/dagplanning zonder ingang, modals met niet-gedefinieerde save-functies, nakijken-v1 naast v2, kleurenborden-UI op 3 plekken, `th.mat` vs `th.materiaal` alias-verwarring, kampplanning op 3 plekken, personeel vs. chauffeurs/ploeg dubbelspoor.

**D. Structurele gaten in het datamodel:**
1. Geen **attributen**-concept (decors zitten als items in pseudo-bakken)
2. Geen **magazijncode-registry** (codes zijn vrije tekst, los van de sublocaties RGA-RGF die wél als locaties bestaan); transport-genereer hardcodeert "Kantoor"/"Rozenweg" op naam
3. Geen **voorraad per item_type per stockagelocatie** (versnipperd over bak_items.qty_stock, legacy verbruik_stock, gedeeld_stock, kleurenborden_stock)
4. Geen **bak-thuislocatie/actuele-locatie** ("waar is bak N08 nu?")
5. **Twee dozen-concepten** (standaard_dozen mét conditielogica vs. vaste_bakken mét catalogus-koppeling) — locatieconfig hangt aan het verkeerde
6. **Twee spoed-concepten** zonder brug (spoedmeldingen vs. spoedtransport)
7. `/api/export` + `/api/import` kennen de nieuwe tabellen niet → JSON-backup is lossy (volledige DB-download via `/api/backup-db` is wél compleet)
8. Kalender hardcodeert jaar 2026

**E. Ontbrekende doellijst-functionaliteit:**
- Rollen/login: bestaat helemaal niet (één gedeeld wachtwoord)
- KV-aanvraagflow met kantoor-beslissing: bestaat niet (alleen losse spoedmeldingen)
- KV-weergave (mobiel, zonder volledige admin-app): bestaat niet (alleen chauffeur-token voor ritten, read-only)
- Kantoor-tekortendashboard geaggregeerd over nakijksessies: bestaat niet
- Laden/lossen als twee aparte checkfases per bak: bestaat niet (één statusveld per regel)
- Conflictdetectie materiaaltekort leunt op lege legacy-tabel → doet stil niets

---

## 3. Fases

### FASE S0 — Stop het bloeden (noodfixes) 🚑
Klein, urgent, vóór al de rest.
- [ ] S0.1 Mig 27/30/38 gaten op `migratie49_klaar` (zelfde patroon als 25/26/32/44); daarna eenmalige opruimmigratie die de per ongeluk teruggeseedde standaarddozen/vaste_bakken/item_types op productie opnieuw wist
- [ ] S0.2 Mig 20/42-drempels (≤15 / <100) vervangen door app_vlaggen
- [ ] S0.3 Import-themas-routes (schrijven naar legacy thema_materiaal) uitschakelen tot F3 ze vervangt
- [ ] S0.4 Verifiëren op productie: thema "Als atleet over de meet" intact, standaarddozen/item_types-seed weer weg
- **Bewijs:** productie-API-calls tonen 0 standaarddozen, 0 generieke item_types behalve die van het atletiek-thema; herstart verandert niets.

### FASE S1 — Grote opkuis 🧹
- [ ] S1.1 Backend: alle dode routes verwijderen (thema-materiaal-CRUD, materiaal/eenheden/verplaatsingen/inventaris-sets, verbruik, gedeeld+converteer, thema-categorieen, stockage-migratie, kapotte catalogus-item-takken) — na check dat de frontend ze nergens levend aanroept
- [ ] S1.2 Backend: vlag-gegate dode migratiecode fysiek verwijderen (±1.600 regels, incl. hardcoded 1001BB/Alice-seeds); de vlaggen zelf blijven bestaan als guard
- [ ] S1.3 Frontend: dode code verwijderen (oude kalender-renderers, sec-spoed, QR/foto/dagplanning-restanten, modals zonder save-functie, nakijken-v1, bulk-kampmoment-restanten, verweesde subtab-divs)
- [ ] S1.4 Consolidatie personen: `chauffeurs`+`ploeg_shifts` opgaan in `personeel`(+shifts); `transport_ritten.chauffeur` (vrije tekst) → `personeel_id`
- [ ] S1.5 Consolidatie spoed: één concept — "aanvraag" (melding, wie/wat/waar) met status nieuw → beoordeeld → (optioneel) omgezet in spoedtransport; oude spoedmeldingen-scherm eruit
- [ ] S1.6 Export/import bijwerken naar de levende tabellen (of JSON-export laten vallen en enkel `/api/backup-db` houden)
- **Bewijs:** app start zonder fouten; elke bestaande zichtbare feature werkt nog (regressielijst per tab afvinken); regeltelling voor/na.

### FASE S2 — Datamodel-fundament 🏗️
- [ ] S2.1 **Attributen**: `thema_bakken.soort` ('bak' | 'attribuut') of aparte tabel; attributen hebben code + optionele foto, geen itemlijst verplicht
- [ ] S2.2 **Magazijncode-registry**: tabel `stockage_plaatsen` (locatie_id → code, bv. Rozenweg → G11); bak/attribuut-code wordt FK i.p.v. vrije tekst; transport-genereer routeert via registry i.p.v. hardcoded namen
- [ ] S2.3 **Voorraad per item_type per stockagelocatie**: `item_type_stock(item_type_id, locatie_id, qty, minimum)`; stock-overzicht, conflictdetectie, spoed-effect en tekortenoverzicht hierop laten steunen; `bak_items.qty_stock` blijft "wat zit er nu in deze bak" (KV-telling)
- [ ] S2.4 **Bak-status/actuele locatie**: veld op bak/attribuut ("in magazijn / op locatie X / onderweg"), bijgewerkt door transport-status; basis voor "waar is bak N08?" en historiek
- [ ] S2.5 **Locatieconfig op vaste_bakken**: `locatie_vaste_bak_config(kamplocatie_id, vaste_bak_id, aantal)`; standaard_dozen-tabellen en -routes verwijderen; conditielogica (leeftijdsgroep/koken) meenemen als optioneel veld op de config
- [ ] S2.6 Transport-genereer herschrijven op het nieuwe fundament: chauffeurslijst = bakken+attributen (met code), gegroepeerd per rit; locatieconfig automatisch mee bij eerste levering
- **Bewijs:** het Alice/atletiek-scenario uit de testcase volledig herdraaid via API: kamp plannen → genereer → chauffeurslijst bevat exact G11+D17+G00+locatieconfig; conflict "materiaaltekort" vuurt op een bewust laag gezette voorraad.

### FASE S3 — Rollen & toegang 🔐
- [ ] S3.1 Login: personeel-gebaseerd (naam kiezen + per-persoon pincode of wachtwoord), sessie in localStorage + server-side token; APP_PASSWORD blijft als buitenmuur
- [ ] S3.2 Rolgebaseerde UI: kantoor/chauffeur zien alles; KV ziet enkel zijn KV-scherm
- [ ] S3.3 KV-weergave (mobiel-eerst): eigen kamp kiezen → vrijdagcontrole (nakijk-flow v2 hergebruiken) + aanvraag indienen; bereikbaar via een simpele link, geen admin-navigatie
- [ ] S3.4 Chauffeursweergave uitbreiden: `/rit/:token` interactief maken (laden afvinken → lossen afvinken, twee fases per bak/attribuut)
- **Bewijs:** drie testpersonen (kantoor/chauffeur/kv) loggen in en zien elk het juiste; KV kan niets anders bereiken (ook niet via directe URL/API).

### FASE S4 — Thema-opbouwstraat 📚
De werkstroom waarmee Maxim en Claude alle thema's stuk per stuk terugzetten.
- [ ] S4.1 Invoerflow: themabundel-PDF → gestructureerd voorstel (bakken/attributen/items, verbruik-vlaggen, codes) → Maxim keurt → in database. Zoals gedaan voor "Als atleet over de meet", maar herhaalbaar en met minder handwerk
- [ ] S4.2 Materiaal-tab herschikken: Thema's beheer wordt een volwaardige tab; verborgen subtabs (catalogus, vaste bakken, voorraad, nakijken) komen één per één terug zodra hun data/flow klaar is; lege-staat-schermen krijgen een call-to-action
- [ ] S4.3 Per ingevoerd thema: verbruiksitems krijgen voorraad + minimum in `item_type_stock`
- [ ] Doorlopend: thema's invoeren (kleuterkampen eerst, dan lagere school, themadagen laatst)
- **Bewijs per thema:** Maxim keurt de lijst in de app goed (zoals bij het atletiek-thema).

### FASE S5 — Transport 2.0 🚚
- [ ] S5.1 Laad/los-checklist: twee aparte fases per bak/attribuut in verhuis_checks (geladen_door/op, gelost_door/op); chauffeurspagina toont de juiste fase
- [ ] S5.2 Transporthistoriek: per bak/attribuut een tijdlijn (welke rit, wanneer, waarheen) uit transport-data; zoekveld "waar is X?"
- [ ] S5.3 Spoedflow eind-tot-eind: KV-aanvraag → kantoor keurt → spoedtransport met eigen checklist → voorraad-effect bij "gedaan" op `item_type_stock`
- [ ] S5.4 Transport-tab consolideren: één duidelijke flow (genereer → plan → volg), dubbele backlogs samenvoegen
- **Bewijs:** volledige rit gesimuleerd: genereer, plan, chauffeur vinkt laden af, vinkt lossen af, historiek toont de verplaatsing, bak-status is "op locatie".

### FASE S6 — KV-cyclus & kantoor-dashboard ✅
- [ ] S6.1 Vrijdagcontrole eind-tot-end op echte data: KV telt per bak → tekorten berekend → kantoor-verwerkstap (besteld/aangevuld) → `item_type_stock` bijgewerkt
- [ ] S6.2 Kantoor-tekortendashboard: alle open tekorten geaggregeerd per item_type over alle sessies, met voorraadstand en bestel-status; "thema al gebruikt → KV-data als startpunt" zichtbaar maken
- [ ] S6.3 Conflictdetectie compleet: dubbel thema, materiaaltekort (op item_type_stock), ontbrekend transport, locatieconfig onvolledig
- **Bewijs:** het knutsellijm-scenario uit de testcase (4 gewenst, 1 geteld → 3 bijvullen) volledig herdraaid door drie rollen heen.

### FASE S7 — UX-consolidatie & poets 🎨
- [ ] S7.1 Eén kampplanning (Kampplanner als enige plek; Overzicht-rooster wordt read-only doorklik)
- [ ] S7.2 Navigatie-mapping robuust maken (geen positie-hardcodes), Seizoensoverzicht correct linken
- [ ] S7.3 Prompts vervangen door nette modals; mobiele check op alle schermen
- [ ] S7.4 Kalender-hardcodes (2026) weg; periode-gestuurd
- **Bewijs:** walkthrough met Maxim door alle tabs; geen dode knoppen, geen dubbele wegen.

---

## 4. Werkafspraken

- **Volgorde:** S0 → S1 → S2 → S3 → S4 (doorlopend) → S5 → S6 → S7. S4 (thema's invoeren) kan parallel lopen vanaf S2.
- **Deploy:** via `deploy.bat` (push → Railway auto-deploy). Vóór elke migratie die data raakt: backup (`/api/backup-db` voor productie, kopie naar `D:\Sporty\backups` lokaal).
- **Testen:** lokaal eerst (poort 3001, eigen sporty.db), dan productie. Productie-verificatie altijd met echte API-calls, nooit op zicht.
- **Promptgrootte:** klein als Maxim actief meetest, groot als hij weg is.
- **Nooit** stilzwijgend van dit plan afwijken; nieuwe inzichten → eerst dit document bijwerken.

---

## STATUSLOG

| Datum | Fase/taak | Status | Bewijs |
|---|---|---|---|
| 2026-07-04 | Consolidatie item_types (Mig 47/48) + endpoints | ✅ | 2.932 rijen gekoppeld, stock-overzicht aggregeert correct |
| 2026-07-04 | Opkuis thema's/materiaal (Mig 49/50) | ✅ (met herseed-lek, zie S0.1) | themas=0 na herstart, 3× herdraaid |
| 2026-07-04 | Thema "Als atleet over de meet" ingevoerd (prod) | ✅ | 3 bakken G11/D17/G00, 19 items, Maxim gecontroleerd |
| 2026-07-04 | Transport-genereer leest thema_bakken + Rozenweg-routering | ✅ | prod-call: "van Rozenweg", 19 items |
| 2026-07-04 | Kampmoment verwijderbaar + sportpakketten bij aanmaken | ✅ | lokaal getest, prod gedeployed |
| 2026-08-01 | Volledige doorlichting (backend + frontend) | ✅ | dit document |
| | S0.1 t/m S0.4 | ⬜ | |
