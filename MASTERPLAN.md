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

1. **Chauffeur ziet bakken, geen inhoud.** Een transportlijst voor de chauffeur = bakken + attributen met hun magazijncode (bv. "KL bak — N08", "Decor Alice"). Nooit item-detail. **De bak is de kleinste transporteenheid** (Maxim 2026-08-02: "een halve bak gaan we normaal nooit meenemen") — splitsen van taken gebeurt dus altijd op bak-niveau.
2. **Kantoor ziet inhoud.** Elke bak heeft een itemlijst met gewenst aantal per item; elk item verwijst verplicht naar de centrale catalogus (`item_types`). "Knutsellijm in bak E26" = hetzelfde item als "Knutsellijm in de voorraad". Dat is de kern van stockbeheer.
3. **Verbruiksitem vs. duurzaam.** Verbruiksitems (diploma's, kranten, lijm...) raken op en worden telkens aangevuld/aangekocht; duurzame items enkel vervangen bij kapot/verloren.
4. **Alles met een code ligt in de Rozenweg.** Bakken en attributen met een magazijncode (G11, D17, N08...) staan fysiek in de Rozenweg. Kamplocaties zijn GEEN stockageplaats.
5. **Locatieconfiguratie is per locatie instelbaar.** Elke kamplocatie heeft een eigen vaste uitrusting (1 adminkast altijd; 1 of 2 EHBO; wel/geen sportkoffer per leeftijdsgroep...). Kantoor beslist dit zelf per locatie.
6. **Thema's zijn de bouwstenen.** Thema (naam + leeftijdsgroep) → themabakken (label + code) → items (qty + verbruik-vlag + item_type). Attributen (decor, croquet-doelen...) horen bij een thema maar zijn geen bak.
7. **KV-controlecyclus:** KV telt op vrijdag wat er nog in de bakken zit → app berekent tekort (gewenst − geteld) → kantoor ziet tekorten en vult aan. Thema al eens gebruikt? Dan is de KV-data het startpunt voor kantoor.
8. **KV-aanvraag tijdens de week** gaat naar kantoor; kantoor beslist en zet het eventueel om in een spoedtransport.
9. **Data wordt stuk per stuk heropgebouwd — via een leertraject.** (Aangescherpt 2026-08-02 bij Verse Start 2, Migratie 59.) De database is opnieuw leeggemaakt behalve sportpakketten (incl. planning), locaties, personeel en kampmomenten. Werkwijze thema-invoer in twee fases: **(leerfase)** Claude extraheert uit de themabundel-PDF en presenteert; Maxim overloopt de eerste thema's samen met Claude en corrigeert elke leesfout — élke correctie wordt als leesregel vastgelegd in `THEMABUNDEL-LEESGIDS.md`; **(autonome fase)** zodra Maxim enkele thema's zonder correcties heeft goedgekeurd, extraheert Claude zelfstandig volgens de leesgids, met Maxims akkoord per thema als eindcheck vóór invoer.

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
- [ ] S4.5 **Themabehoefte aan pool-materiaal** (Maxim akkoord 2026-08-02): per thema vastleggen "N stuks van vast_type X nodig" (bv. 1 verkeerskoffer, 17 kleuterfietsen, springkasteel fietsparcours). Generator en conflictdetectie nemen die behoefte mee (zoals locatieconfig, maar dan thema-gedreven). Inclusief blazer-logica (leesgids L18): behoefte per springkasteel (1 of 2 blazers; kleuterhindernisbaan=2), benodigd aantal = piek-gelijktijdigheid van de dagplanning (niet de som), verlengdraadkoffer 1 per levering. Voertuigen (fietsen, steps, loopwagens...) zijn een gedeelde pool per soort met bezitstotaal — zie leesgids L15.
- [ ] S4.6 **Foto's op springkastelen** (Maxim akkoord 2026-08-02): per springkasteel-exemplaar twee foto's in de app — opgeplooid én opgezet. Standaardregel: bij elk springkasteel horen een blazer + verlengdraadkoffer als bijlevering (leesgids L18).
- [ ] S4.7 **Themabundel-PDF bij het thema** (Maxim 2026-08-02): de originele bundel-PDF's moeten op de website staan — bij een thema kun je de bundel openen/bekijken. Upload of servermap + link in het themadetail.
- [ ] S4.8 **KV-boodschappenlijst per kookthema** (Maxim akkoord 2026-08-02): rubriek "Voorzien door de kampverantwoordelijke" (verse waren) als nette lijst bij het thema, zichtbaar in de KV-weergave (winkellijstje). Interim staat dit in `thema_materiaal` met prefix "KV:"; eigen structuur + UI nog te bouwen. Vraag open: horen themabak 1/2-2/2 van kookthema's bij de 6 pool-kookbakken?
- [ ] Doorlopend: thema's invoeren (kleuterkampen eerst, dan lagere school, themadagen laatst)
- **Bewijs per thema:** Maxim keurt de lijst in de app goed (zoals bij het atletiek-thema).

### FASE S5 — Transport-verfijning 🚚
(S5.1-laad/los en S5.3-spoedflow zijn al gebouwd in S3.6/S3.3 — deze fase is de fixronde uit de simulatie + Maxims testronde.)

**Ontwerpregels sluiting van een locatie (Maxim, 2026-08-02 — bindend):**
- **Definitief dicht** (geen kampmoment meer later in de vakantieperiode): ALLES wordt opgehaald — themabakken, attributen, sportsets, kleurenborden én de vaste locatieconfig-uitrusting.
- **Tijdelijk dicht** (locatie gaat in een latere week weer open): kleurenborden en standaard-/locatieconfig-materiaal blijven gewoon staan tijdens de rustweek — géén ophaal- en herlever-voorstellen. Themamateriaal volgt zijn eigen planning (dat rouleert wél).
- **Uitzondering "elders nodig":** blijft-staan is de default; heeft een andere locatie in de tussenweek diezelfde vaste exemplaren of kleurenborden nodig en is er onvoldoende vrije voorraad, dan toont de app dat als conflict/waarschuwing zodat kantoor bewust een tussentransport kan plannen. Nooit stilzwijgend weghalen.

**Taken:**
- [ ] S5.1 Generator: dubbele voorstellen bij aansluitende weken fixen (directe transfer ÉN wissel-ophaling voor dezelfde bakken — simulatie-bevinding 1)
- [ ] S5.2 Generator: sluitingsregels hierboven implementeren (basis/kleurenborden enkel ophalen na de láátste open week van de periode; gaps overslaan; elders-nodig-conflict)
- [ ] S5.3 Waar-is-historiek: transportbewegingen (laden/lossen) zichtbaar in de tijdlijn, niet enkel handmatige verplaatsingen (bevinding 2)
- [ ] S5.4 API-consistentie thema-bakkenlijst id-veld vs items-route (bevinding 3) + kv-tellen weigert misvormde payload met 400 (bevinding 4)
- [ ] S5.5 Transport-tab consolideren: één duidelijke flow (genereer → plan → volg), dubbele backlogs samenvoegen
- **Bewijs:** simulatie-scenario's herdraaid: (a) kruiswissel zonder dubbele voorstellen, (b) locatie open w1+w3: geen basis-ophaal/herlever in de gap, (c) locatie definitief dicht: alles opgehaald incl. kleurenborden/config, (d) elders-nodig geeft conflict, (e) waar-is toont de volledige reis van bak N08.

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
| 2026-08-02 | S3.4–S3.7 gebouwd (Chat B) en gereviewd (Fable, volledig rollenspel herdraaid) | ✅ | KV-link persoonsgebonden (zonder KV → 400; token gewist bij KV-wissel); /kv/:token: 3 bakken+items, 4 tabs, −/+ tellers 46px, Bak afsluiten, geen h-scroll op 375px; security: fout token 403, kv-token op admin-API 401; tellen→tekort→kantoor ziet per bak→aanvullen boekt af (voorraad 10→8); chauffeur: laden→onderweg, lossen→op_locatie, op naam; aanvraag: KV ziet goedgekeurd+reden; kapot-melding bij kantoor; alle admin-tabs 0 console-errors; testdata opgeruimd |
| 2026-08-02 | S3 volledig naar productie | ✅ | prod: API 401 zonder token; login-status setup_nodig; 9 personen in loginlijst; kv-pagina fout token 404 |
| 2026-08-02 | Thema "Alice in Wonderland" op prod (nieuw model) | ✅ | 2 attributen + N08 (34 items) + E26 (27 verbruik); generator-proef = exact de testcase-chauffeurslijst |
| 2026-08-02 | VOLLEDIGE SIMULATIE op prod-kloon (3 weken, 2 locaties, 2 thema's+sport, rustweek) | ✅ | hele cyclus groen: plannen→genereer (rustweek-logica: ophaal→aanvul→lever, geen directe transfer bij week-gap)→chauffeur 2 fases (statussen thuis→onderweg→op_locatie→thuis)→KV-controles met tekorten→aanvraag+spoedtransport→kantoor vult aan (voorraad 10→8; PlayMais eerst nette foutmelding zonder voorraadrij, daarna 5→4)→eindophaling: alle 5 bakken thuis |
| 2026-08-02 | S5.1–S5.4 gebouwd (Chat A) + reviewfix Fable (eind-ophaling exemplaren bij vooraf plannen) | ✅ | herdraaide scenario's: (a) kruiswissel 2 transfers/0 dubbels; (b) gap-week: thema via stockage, basis/kleuren 0 voorstellen, kleurverschil GEEL×4 als enige bijlevering; (c) definitieve sluiting: kleuren + config-exemplaren in eind-ophaling (na fix ook bij vooraf plannen); (d) elders-nodig-conflicten vuren met locatievermelding; (e) waar-is toont laden/lossen met chauffeur+tijdstip; (f) lijst-id werkt op items-detail, misvormde payload → 400 |
| 2026-08-02 | S5.5 afgerond (reviewfix Fable; Chat A leverde niets) | ✅ | label overal "Op te stellen"; spoed = 1 ingang (eerdere telling was vals alarm); alle tabs 0 console-errors |
| 2026-08-02 | Leertraject: 1001 3-daagse gelezen (L14) + "Alles op wieltjes" geëxtraheerd (L15-L19) + "Als atleet over de meet"-bundel herlezen ter verificatie | ✅ | leesgids-commits; wieltjes-invoer wacht op Maxims akkoord |
| 2026-08-02 | 1001-items uit 3-daagse fiche toegevoegd (lokaal): H57 +bubble machine ×2 +bubble gun ×2; H55 +reserve batterijen (verbruik) +schroevendraaier | ✅ lokaal, prod open | items-detail: H55 15→17, H57 8→10; prod wacht op Basic-auth-wachtwoord |
| 2026-08-02 | Thema "Alles op wieltjes" ingevoerd (lokaal) + voertuigen-/kofferpool + fietsparcours-set | ✅ lokaal, prod open | thema 4084; F40 23 items; 9 voorraadrijen Rozenweg qty 0; pool: 3 verkeerskoffers (9 items elk), 17 kleuterfietsen, 4 loopfietsen, 5 loopwagens, 2 zitfietsen, 3 easy rollers, 8 rolplanken, 16 stokken, 10 verlengdraadkoffers (±10, verifiëren), fietsparcours+blazer; themabehoefte (1 koffer/locatie, kampset voertuigen) wacht op S4.5 |
| 2026-08-02 | Thema "Holderdebolder" ingevoerd (lokaal) + pool-uitbreiding | ✅ lokaal, prod open | thema 4085 (geen bakken — volledig pool, L22); springkastelen nu 4 (jungle, kasteel, kleuterhindernisbaan [2 blazers], fietsparcours); blazers 15 (5×1500W+10×1000W, wattages verifiëren); WESCO-pakketten 4; blazerbehoefte per kasteel + gelijktijdigheid → S4.5 |
| 2026-08-02 | Thema "De bakkerij" ingevoerd (lokaal) + kookuitrusting-pool | ✅ lokaal, prod open | thema 4086; bak 1/2 (23 items, code onbekend) + bak 2/2 (27 items: bestek per 16 + 24 ingrediënten per 32 [p12 leidend, L23] met voorraadrijen qty 0); KV-boodschappenlijst 11 regels via thema_materiaal (interim, zie S4.8); pool +5 ovens/8 kookvuren/8 afwasbakken/6 kookbakken |
| 2026-08-02 | Thema "Play Factory" ingevoerd (lokaal) | ✅ lokaal, prod open | thema 4087: 18 bakken (26 items) + 30 attributen (10 volksspelen, 14 XL-spelen, lasershoot-targets/vestjes, frisbee/bowling/boogschieten/rozen-doelen); alle codes onbekend (verifiëren); golf zonder materiaal; drones = externe firma, niet ingevoerd (L26) |
| 2026-08-02 | Thema "Op stap met Sporty" ingevoerd (lokaal) — uitstapkamp zonder materiaal (L28) | ✅ lokaal, prod open | thema 4088; geen bakken/attributen; INFO-regel met externe activiteiten; bron zelf inconsistent over max (32 op p2, 40 op p3) |
| 2026-08-02 | Thema "Balanceren op één been" ingevoerd (lokaal, batch-agent; incl. 3-daagse-variant = identieke fiche) | ✅ lokaal, prod open | thema 4089: 2 bakken/14 items/0 attributen/0 voorraadrijen; geen bakcodes en geen item-verdeling op fiche (zie VRAGENLOG) |
| 2026-08-02 | Thema "De beweegplaneet" ingevoerd (lokaal, batch-agent; incl. 3-daagse- en Coole Kadeekes-variant) | ✅ lokaal, prod open | thema 4090: 3 bakken (F41/D57/D58)/37 items (6 verbruik)/2 attributen/6 voorraadrijen; CK-extra "stickers 5x40" aangevuld |
| 2026-08-02 | Thema "Circus Krokofant!" ingevoerd (lokaal, batch-agent; incl. Coole Kadeekes-variant) | ✅ lokaal, prod open | thema 4091: 4 bakken (G07/G09/springdieren/schminkkoffer)/32 items (15 verbruik)/2 attributen/12 voorraadrijen; CK-extra's schminkkoffer + zijdepapier aangevuld |
| 2026-08-02 | Thema "De Bouwfabriek" ingevoerd (lokaal, batch-agent; CK-variant = identieke fiche) + bouwpool (20 kruiwagens, 3 softlego-bakken, 7 duplo-bakken, 1 LEONARDO-pakket) | ✅ lokaal, prod open | thema 4092: 8 bakken (N22/N28/G57/G55/G53/3×G59)/11 items/0 attributen/0 voorraadrijen |
| 2026-08-02 | Thema "Alles op wieltjes": CK-variant-fiche vergeleken — identiek, niets aan te vullen (L14) | ✅ lokaal | diff hoofd- vs CK-bundel: alleen dagplanning verschilt; thema 4084 ongewijzigd |
| 2026-08-02 | Thema "Beweegkriebels (met Ypie)" ingevoerd (lokaal, batch-agent; eigen thema, geen variant) | ✅ lokaal, prod open | thema 4093: 1 bak (F08)/7 items/0 attributen/0 voorraadrijen; Hal 5-materiaal als INFO-regel |
| 2026-08-02 | Thema "Dierenplezier" ingevoerd (lokaal, batch-agent; enkel CK-3-daagse-bundel beschikbaar) | ✅ lokaal, prod open | thema 4094: 1 bak (N35)/41 items (22 verbruik)/0 attributen/22 voorraadrijen Rozenweg qty 0 |
| 2026-08-02 | Thema "De Speelfabriek" ingevoerd (lokaal, batch-agent) + clics-pool | ✅ lokaal, prod open | thema 4095: 5 bakken (H05/H00/H03/L31/H01)/26 items (1 verbruik, printbaar)/4 attributen (XL-spelen hergebruikt)/0 voorraadrijen |
| 2026-08-02 | Thema "De vloek van de farao" ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4096: 2 bakken (C29/D22)/48 items (20 verbruik)/0 attributen/14 voorraadrijen; hotdogs+mayonaise = vers, geen voorraadrij; Extra meenemen = pool-INFO |
| 2026-08-02 | Thema "Dino detectives" ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4097: 4 bakken (H45/H43/H41/H42)/68 items (20 verbruik)/2 attributen/16 voorraadrijen; fiche-tikfout "LS bal – H45" |
| 2026-08-02 | Thema "FC Sporty" ingevoerd (lokaal, batch-agent; bundel "FC Sporty Kleuters") | ✅ lokaal, prod open | thema 4098: 1 bak (Voetbalkisten, code onbekend)/18 items (1 verbruik: medailles)/0 attributen/1 voorraadrij |
| 2026-08-02 | Thema "Feestje bouwen!" ingevoerd (lokaal, batch-agent; incl. 3-daagse-variant, verschillen aangevuld) | ✅ lokaal, prod open | thema 4099: 3 bakken (F13/F15/F17)/64 items (36 verbruik)/2 attributen (kerstboom F12, waszak F11)/28 voorraadrijen |
| 2026-08-02 | Thema "Jumpen!" ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4100: 3 bakken (N17-N18/M00/C05)/8 items/0 attributen/0 voorraadrijen; springkastelen = bestaande pool (mapping verifiëren) |
| 2026-08-02 | Thema "Koekjesfabriek" ingevoerd (lokaal, batch-agent; kookthema) | ✅ lokaal, prod open | thema 4101: 3 bakken (B45/B47/B49)/42 items (25 verbruik)/0 attributen/21 voorraadrijen; KV: eieren+boter; Extra meenemen = kookpool-INFO; kolomtoewijzing B45/B47 verifiëren (zie VRAGENLOG) |
| 2026-08-02 | Thema "Kriebeldiertjes" ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4102: 2 bakken (H39/H37)/41 items (20 verbruik)/0 attributen/19 voorraadrijen; dubbele "map zoekkaarten"-regel + sportmateriaal-rubriek ontbreekt (VRAGENLOG) |
| 2026-08-02 | Thema "Later als ik groot ben" ingevoerd (lokaal, batch-agent; incl. 3-daagse-variant, verschillen genoteerd, niets herschoven) | ✅ lokaal, prod open | thema 4103: 2 bakken (G45/G31)/43 items (20 verbruik)/1 attribuut (lamineermachine)/12 voorraadrijen; APART-pool als INFO |
| 2026-08-02 | Thema "Mini helden 112" ingevoerd (lokaal, batch-agent; 3-daagse-fiche identiek) | ✅ lokaal, prod open | thema 4104: 3 bakken (L05/L03/L01)/74 items (37 verbruik)/0 attributen/28 voorraadrijen |
| 2026-08-02 | Thema "Mini Splash" ingevoerd (lokaal, batch-agent; enkel 3-daagse bundel bestaat) | ✅ lokaal, prod open | thema 4105: 3 bakken (G19/G17/eendjes H03)/33 items (15 verbruik)/3 attributen (2 dakgoten E00 + zak zand)/9 voorraadrijen; H03-code deelt met Speelfabriek (verifiëren) |
| 2026-08-02 | Thema "Minidisco" ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4106: 2 bakken (F23/K34)/19 items (10 verbruik)/0 attributen/7 voorraadrijen; wc-rolletjes via ouderbriefje (VRAGENLOG) |
| 2026-08-02 | Thema "Multiballs met Ypie" ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4107: 4 bakken (N37/N38/B41/B43)/12 items (0 verbruik)/0 attributen/0 voorraadrijen; geen Los-rubriek op fiche; B41-inhoud onbekend (VRAGENLOG) |
| 2026-08-02 | Thema "Op een onbewoond eiland" ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4108: 4 bakken (E31/E59/2 zakken RIWI z. code)/37 items (6 verbruik)/3 attributen (decor)/6 voorraadrijen |
| 2026-08-02 | Thema "Op stap in de jungle" ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4109: 2 bakken (G43/kooi G41)/27 items (16 verbruik)/1 attribuut (frame+doek)/10 voorraadrijen; verkleedkledij enkel foto's (VRAGENLOG) |
| 2026-08-02 | Thema "Reis rond de wereld" ingevoerd (lokaal, batch-agent; 3-daagse-verschillen genoteerd, niets herschoven) | ✅ lokaal, prod open | thema 4110: 4 bakken (G47/G49/G40/koker G00)/68 items (25 verbruik)/4 attributen/19 voorraadrijen; fiche mist 4/6+5/6 (VRAGENLOG) |
| | **Simulatie-bevindingen voor S5-fixronde:** (1) dubbele voorstellen bij aansluitende weken: directe transfer én wissel-ophaling voor dezelfde bakken; (2) waar-is-historiek toont geen transportbewegingen, enkel handmatige verplaatsingen; (3) thema-bakkenlijst geeft ander id-veld dan items-detail-route verwacht; (4) kv-tellen-endpoint slikt misvormde payload stil met ok:true | 🐛 | vastgesteld tijdens simulatie 2026-08-02 |
| 2026-08-02 | S6.1-S6.3 gebouwd (kv-tekortstatus besteld/aangevuld/genegeerd, sluit-gate, kantoor-tekortendashboard, conflicten ontbrekend_transport + locatieconfig_onvolledig) | gebouwd, review Fable volgt | Migratie 60 (tekort_status); knutsellijm-scenario 3-rollen herdraaid (4 gewenst/1 geteld -> tekort 3 -> besteld -> aanvullen zonder voorraadrij nette fout+knop -> voorraadrij aanmaken -> aanvullen voorraad daalt -> sluiten geweigerd bij open tekort, geslaagd na besteld/aangevuld); dashboard aggregeert 2 bakken/locaties zelfde item_type tot 1 rij (totaal 70 = 10+60, 2 herkomsten) + thema-al-gebruikt-signaal; ontbrekend_transport vuurt zonder taak en verdwijnt na aanmaken levering+ophaling; locatieconfig_onvolledig vuurt bij 0/1 vrije EHBO-exemplaren en verdwijnt bij voldoende exemplaren; testdata opgeruimd (zie eindrapport) |
