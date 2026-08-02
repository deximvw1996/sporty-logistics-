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

**Ontwerpbeslissingen (brainstorm met Maxim, 2026-08-01) — bindend:**
1. **Attribuut = apart concept** naast bakken: naam, optionele code, optionele foto, thuislocatie; géén itemlijst. KV-check bij attributen = enkel "aanwezig/heel". Grensregel: **telbaar = bak** (de noodles-doos blijft dus een bak; decor/croquet-doelen/muziekbox worden attributen).
2. **Bakken én attributen zijn deelbaar over meerdere thema's** (koppeltabellen). Conflictdetectie waarschuwt als twee kampen in dezelfde week dezelfde bak/hetzelfde attribuut nodig hebben.
3. **Codes**: structuur letter=rek, cijfer=plek (G11 = rek G, plek 11) — app groepeert/sorteert per rek en waarschuwt bij dubbele codes, maar code blijft vrij invulbaar (geen registry). Elke bak/attribuut heeft een **verplichte thuislocatie** (default Rozenweg, per stuk instelbaar).
4. **Voorraad**: `item_type_stock(item_type_id, locatie_id, qty, minimum)` — per stockagelocatie. Automatische **bestellijst** (alles onder minimum). Afboeking automatisch bij de aanvul-actie van kantoor.
5. **Bak-status**: actuele locatie automatisch via transportstatus (geladen→onderweg, gelost→op locatie, retour→thuis); handmatige correctie mogelijk mét verplichte reden; historiek uit transportdata ("waar is bak N08?").
6. **Vaste bakken = fysieke exemplaren** (EHBO-koffer #1, #2... elk eigen code/status) gegroepeerd per type. **Locatieconfig** = per kamplocatie: welk type, hoeveel, met optionele conditie (altijd / enkel bij leeftijdsgroep X / enkel bij kookthema). Transport kiest vrije exemplaren.

**Taken:**
- [ ] S2.1 Uniforme `bakken`-tabel (soort 'thema'|'vast', vast_type voor exemplaar-groepering, code, thuislocatie_id, huidige_locatie_id, status) + koppeltabel `thema_bak`; migratie van thema_bakken + vaste_bakken
- [ ] S2.2 `attributen` + koppeltabel `thema_attribuut`; beheer-UI in Materiaal-tab
- [ ] S2.3 `item_type_stock` + Voorraad-subtab terug zichtbaar + bestellijst-scherm
- [ ] S2.4 Bak/attribuut-status gekoppeld aan transportstatus + handmatige correctie + "waar is X?"-zoek
- [ ] S2.5 `locatie_config` (type, aantal, conditie) op het exemplaren-model; standaard_dozen-tabellen/routes/UI definitief weg
- [ ] S2.6 Transport-genereer op het nieuwe fundament: chauffeurslijst = bakken+attributen met code gegroepeerd per rek; locatieconfig automatisch mee; dubbelboeking-conflict
- **Bewijs:** het atletiek-scenario volledig herdraaid via API: kamp plannen → genereer → chauffeurslijst bevat exact G11+D17+G00+locatieconfig-exemplaren; status van bak G11 verandert mee met de rit; "materiaaltekort" en "dubbelboeking bak" vuren op bewust geconstrueerde testgevallen.

### FASE S3 — Rollen & toegang 🔐

**Ontwerpbeslissingen (brainstorm met Maxim, 2026-08-02) — bindend:**
1. **KV-toegang = persoonlijke link per kamp, géén login.** Kantoor koppelt vooraf wie KV is op welk kampmoment (uit Personeel); de link is daardoor persoonsgebonden — de app weet wie invult. KV's zijn wisselend seizoenspersoneel: nul accountbeheer.
2. **Kantoor & chauffeurs: naam kiezen uit personeelslijst + eigen pincode.** APP_PASSWORD blijft als buitenmuur. Alles wat iemand doet (nakijken, laden, goedkeuren) wordt op naam gelogd.
3. **KV-scherm (mobiel-eerst), vier functies:** (a) vooraf zien wat er op de locatie moet staan (bakken/attributen mét codes — maandagochtend-check), (b) vrijdagcontrole: **alles wat er staat** — themabakken én vaste bakken items tellen, attributen aanwezig/heel afvinken, (c) aanvraag indienen tijdens de week, (d) kapot-melding met foto, los van de vrijdagcontrole.
4. **Chauffeurspagina wordt interactief: twee fases per bak/attribuut** — laden afvinken bij vertrek, lossen bij aankomst. Bak-status volgt automatisch (laden→onderweg, lossen→op locatie/thuis).
5. **Aanvraagflow: nieuw → goedgekeurd/afgewezen (met reden) → afgehandeld.** Bij goedkeuring kan kantoor direct een spoedtransport aanmaken. KV ziet de status op zijn link. Dit vervangt de oude losse spoedmeldingen (= S1.5 spoed-consolidatie).
6. **Kantoor verwerkt tekorten per bak** ("Themabak Alice 2/2 — 3 lijm bijvullen"), zoals je fysiek in het magazijn staat. Aanvul-actie boekt automatisch af van de voorraad (S2-regel).

**Taken:**
- [ ] S3.1 Personen-consolidatie (S1.4): chauffeurs+ploeg_shifts → personeel; transport_ritten op personeel_id
- [ ] S3.2 Login kantoor/chauffeur: naam + pincode, server-side sessietoken, acties op naam gelogd
- [ ] S3.3 KV-aanvraagflow (vervangt S1.5): aanvragen-tabel met statussen, kantoor-behandelscherm, spoedtransport-koppeling, oude spoedmeldingen-UI eruit
- [ ] S3.4 KV-koppeling per kampmoment + persoonlijke token-link
- [ ] S3.5 KV-scherm mobiel: de vier functies uit beslissing 3
- [ ] S3.6 Chauffeurspagina interactief: twee vink-fases + automatische status-doorwerking
- [ ] S3.7 Kantoor: tekorten-per-bak-werkscherm met aanvul-actie (boekt af van voorraad)
- [ ] S3.8 Export/import bijwerken naar levende tabellen (S1.6)
- **Bewijs:** volledig rollenspel herdraaid: kantoor plant kamp + koppelt KV → KV-link toont verwachte bakken → chauffeur laadt/lost af (status volgt) → KV doet vrijdagcontrole + aanvraag → kantoor keurt goed, maakt spoedtransport, vult bak aan (voorraad daalt). KV-link geeft geen toegang tot iets anders (ook niet via directe API-calls).

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
| 2026-08-01 | S0.1–S0.4 noodfixes (Chat A, review Fable) | ✅ | prod: standaard_dozen 0, vaste_bakken 0, item_types 319→131 (=112 sport+19 atletiek, exact), atletiek intact G11/D17/G00, import-themas 410 |
| 2026-08-01 | S1.1+S1.2 backend-opkuis (Chat A) | ✅ | server.js 3.885→3.135 regels; 9 levende endpoints 200; 3 herstarts zonder seeds |
| 2026-08-01 | S1.3 frontend-opkuis (Chat B) | ✅ | index.html 9.833→8.275; alle 9 tabs zonder console-errors |
| 2026-08-01 | Reviewfix: verhuis_checks.item_type_id ontbrak (checks-init + Mig 51 crashten) → kolom + Mig 52 | ✅ | item_types 207→19 lokaal; checks-init eind-tot-eind getest |
| 2026-08-01 | S2-brainstorm: 6 ontwerpbeslissingen vastgelegd | ✅ | sectie FASE S2 |
| 2026-08-02 | S2.1–S2.6 gebouwd (Chat A, 2 rondes) + reviewfix Fable (attributen-UI, alle-bakken levert attributen mee) | ✅ | herdraaide bewijzen: 3 bak-regels met bak_id in genereer; attribuut end-to-end; dubbelboeking-conflict vuurt; bestellijst + tekort-conflict (32 nodig/2 voorraad); status-keten gedaan→op_locatie→handmatig thuis; locatieconfig kiest 2 EHBO-exemplaren; alle tabs 0 console-errors; testdata opgeruimd |
| 2026-08-02 | S2 naar productie | ✅ | prod-kerntest: 3 bak-regels met bak_id van Rozenweg; atletiek gemigreerd (3 bakken/19 items/status thuis); sport 112/personeel 9/locaties 41 intact |
| 2026-08-02 | S3-brainstorm: 6 ontwerpbeslissingen | ✅ | sectie FASE S3 |
| 2026-08-02 | KV-scherm-mockup (Claude Design) goedgekeurd + omgebouwd naar 4 echte tabbladen | ✅ | design-mockups/kv-scherm/KV-scherm.dc.html — bindende UI-spec voor S3.5 |
| 2026-08-02 | S3.1/S3.2/S3.3/S3.8 gebouwd (Chat A) + reviewfix Fable (bootstrap-gat setup op lege personeelstabel) | ✅ | herdraaid: 401 zonder token; setup→login→wie-ben-ik; foute pincode 401; 2e setup 400; aanvraag nieuw→goedgekeurd(+spoedtaak, behandeld_door=ingelogde naam)→afgehandeld; export 62 tabellen dynamisch; chauffeurs/ploeg-routes weg; login-UI + alle tabs 0 console-errors |
| | S3 deel 1+2 samen naar productie (na deel 2) | ⬜ | |
| | S3.4–S3.7 (KV-link, KV-scherm, chauffeur interactief, tekorten-per-bak) | ⬜ | Chat B |
