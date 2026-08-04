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

### FASE S9 (backlog) — Verhuurmodule 🏷️
Maxim (2026-08-02): Sporty verhuurt ook materiaal aan bedrijven en particulieren (o.a. paintballgeweren — die worden niet met kinderen gebruikt, enkel verhuur). Het logistieke deel daarvan (reserveringen, uitlening, terugname, botsing met kampplanning/pool-beschikbaarheid) moet later ook in de app. Nog niet ontworpen — eerst S6/S7 en de themadagen.

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
| 2026-08-02 | Thema "Schattenjacht" ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4111: 1 bak (F05)/21 items (1 verbruik)/0 attributen/1 voorraadrij; sportmateriaal-rubriek ontbreekt + KV-verrassing (VRAGENLOG) |
| 2026-08-02 | Thema "Spelen in dromenland" ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4112: 4 bakken (H25/H27/H28/H29)/48 items (35 verbruik)/0 attributen/29 voorraadrijen; wasmand+bommazak zonder inhoudsopgave (VRAGENLOG) |
| 2026-08-02 | Thema "Sporty in smurfenland" ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4113: 2 bakken (codes onbekend)/52 items (15 verbruik)/1 attribuut (Smurfendecor)/13 voorraadrijen |
| 2026-08-02 | Thema "Sprookjesland" ingevoerd (lokaal, batch-agent; hoofdfiche leidend, 3-daagse-extra's aangevuld, niets herschoven) | ✅ lokaal, prod open | thema 4114: 3 bakken (G35/G37/G39)/62 items (23 verbruik)/1 attribuut (decor frame+doek)/14 voorraadrijen; KV 3 regels + kookbak/afwasbak-pool als INFO |
| 2026-08-02 | Thema "Superhelden" ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4115: 3 bakken (H22/H59/emmer H21)/46 items (25 verbruik)/0 attributen/20 voorraadrijen |
| 2026-08-02 | Thema "De techniekfabriek" ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4116: 2 bakken (F35/F37)/38 items (12 verbruik)/0 attributen/12 voorraadrijen |
| 2026-08-02 | Thema "We gaan op berenjacht" ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4117: 2 bakken (codes onbekend)/48 items (15 verbruik)/2 attributen (Sneeuwballen, 12 platte kartonnen dozen)/13 voorraadrijen |
| 2026-08-02 | Thema "We slaan in het rond" ingevoerd (lokaal, batch-agent; 3-daagse-fiche vergeleken, enkel standballen/strandballen-verschil genoteerd) | ✅ lokaal, prod open | thema 4118: 4 bakken (2×G13/2×G12)/11 items (3 verbruik)/0 attributen/3 voorraadrijen; mini tennis+golf/croquet als INFO |
| 2026-08-02 | Thema "Welkom op de boerderij" ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4119: 5 bakken (H23/H51/H32/2×H31)/41 items (17 verbruik)/2 attributen/14 voorraadrijen; bak 4/5+5/5 zonder inhoudsopgave (L27) |
| 2026-08-02 | Thema "WK voetbal Kleuters" ingevoerd (lokaal, batch-agent; eigen thema naast FC Sporty, L16; bundel zonder fiche → fotolijst) | ✅ lokaal, prod open | thema 4120: 1 bak (code onbekend)/21 items (0 verbruik)/0 attributen/0 voorraadrijen; 4 INFO-regels |
| 2026-08-02 | Thema "Word verrast als gymnast" ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4121: 3 bakken (F20/D25/O03)/15 items (7 verbruik)/0 attributen/7 voorraadrijen; bilibo's D25 vs E29 (VRAGENLOG) |
| 2026-08-02 | Thema "Woutje Astronautje" ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4122: 2 bakken (F01/F03)/49 items (21 verbruik)/1 attribuut (decor)/18 voorraadrijen |
| 2026-08-02 | Thema "Ypie is vermist" ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4123: 3 bakken (2×O26/E29)/37 items (13 verbruik)/1 attribuut (Ypie mascotte)/9 voorraadrijen |
| 2026-08-02 | Thema "Actie & Avontuur" ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4124: 8 bakken (enkel D21 met code)/52 items (14 verbruik)/5 attributen (2 pool hergebruikt)/14 voorraadrijen; Games of empire zonder baklabel + KV: bananen (VRAGENLOG) |
| 2026-08-02 | Thema "Ambachtenacademie" ingevoerd (lokaal, batch-agent; incl. 3-daagse- en Betekom-variant, verschillen aangevuld, niets herschoven) | ✅ lokaal, prod open | thema 4125: 4 bakken (B09/B19/B29/B30)/88 items (53 verbruik)/0 attributen/52 voorraadrijen; KV 3 regels; kookpool-INFO; Betekom-afwijkingen in VRAGENLOG |
| 2026-08-02 | Thema "Art @ Sporty" ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4126: 2 bakken (D19/D09)/49 items (35 verbruik)/0 attributen/33 voorraadrijen; sportmateriaal-rubriek ontbreekt; Action-aankoopnotities |
| 2026-08-02 | Thema "Balls & Rackets" ingevoerd (lokaal, batch-agent) — sportkamp zonder fiche, thema-only (cf. L28) | ✅ lokaal, prod open | thema 4127: 0 bakken/0 items/0 attributen/0 voorraadrijen; 1 INFO-regel; bron zegt 3-daagse maar rooster 5 dagen |
| 2026-08-02 | Batch 9 (Fable zelf, na 2× vastgelopen agent): Beestenbende (4128, uitstap L28), Beestige natuurweek (4129: 1 bak E25/9 items/4 voorraadrijen), Buitengewoon bouwen (4130: 13 bakken/31 items/5 voorraadrijen), CLIC IT (4131, clics-pool), Dagelijkse Sportykost (4132: 2 bakken D39+D45/40 items/28 voorraadrijen/22 KV-regels) | ✅ lokaal, prod open | script invoer_batch9.js; aannames in VRAGENLOG "Batch 9" |
| 2026-08-02 | Batch 10 (Fable zelf): Expeditie Survival (4133: 4 bakken D35/D33/D32/D00 + gedeelde Geocache-bak + 5 attributen/43 items/10 voorraadrijen), Experimenteerfabriek (4134: 2 bakken D35!/D37, 77 items/42 voorraadrijen), FC Sporty girls (4135: 1 bak/24 items uit fotolijst), Festivalfood (4136: 2 bakken L15/L14, 42 items/32 voorraadrijen/30 KV-regels) | ✅ lokaal, prod open | script invoer_batch10.js; kolom-extractie per fiche-helft |
| 2026-08-02 | Batch 11a (Fable zelf): Fun on ice (4137, L28), Geef acht! (4138: N31 48 items + 3 attributen + gedeelde Geocache), Jump around (4139: F39+L29, 4 opblaasstructuren→pool), Klim & Rackets (4140, L28), Klimwereld (4141, bundel gescand!), Koekiemonsters (4142: E43/E41/E45, 56 items), Lego Legends (4143: C07/C08) | ✅ lokaal, prod open | script invoer_batch11a.js |
| 2026-08-02 | Batch 12 (Fable zelf): Modemakers (4144: L59/M05/M08/O00, 50 items), Play a game (4145: 14 gedeelde Play Factory-bakken), Plan(t)trekkers (4146: 3 bakken/46 items), Sportymadness (4147: 7 bakken F59/F31/K43/F58/F21/F33/E01, 49 items), Voetbal madness (4148: 2 bakken/25 items + gedeelde voetgolf/pannakooien), Wacko Waterweek (4149 + 10 waterstructuren in pool) | ✅ lokaal, prod open | script invoer_batch12.js; grasmus-variant = notities |
| 2026-08-02 | Batch 13 (Fable zelf, laatste LS): We knallen er op los (4150), Wereldkeuken (4151, kook, 27 KV-regels), Homo Universalis (4152), WK voetbal LS (4153, geen fiche), Zeepkistenrace (4154 + 4 zeepkisten pool), Zoete toetjes (4155, kook, 97 items), Slag- en balsporten (4156), Bouwingenieurs (4157 + 2 Creatool-pooleenheden), The Hunger Games (4158) | ✅ lokaal, prod open | script invoer_batch13.js |
| 2026-08-02 | **ALLE KAMPTHEMA'S INGEVOERD (lokaal)** — eindstand: 77 thema's, 172 pool-eenheden (vaste bakken), 74 attributen, 638 voorraadrijen; alle 106 kamp-PDF's (kleuters + lagere school incl. varianten) verwerkt; vragen gebundeld in VRAGENLOG.md; themadagen volgen na overleg met Maxim | ✅ | eindtelling via API 2026-08-02 |
| 2026-08-02 | Antwoordenronde VRAGENLOG verwerkt: voetbalkisten = 1 gedeelde bak (12174) aan 5 voetbalthema's (3 dubbels verwijderd, VM-extra's samengevoegd); GPS-bak gedeeld (4 thema's); boogschieten → houten kist kruisbogen (bak) + losse bogen ±16 + pijlen ±32 (attributen) aan 5 thema's, oud attribuut weg; bilibo's = 1 gedeelde set; kerstboom ontdubbeld; Ypie-mascottepak (1×) gedeeld aan 3 thema's; LS-hindernisbaan (2 delen) en waterglijbaan (1 blazer) hernoemd; L29+L30 in leesgids; verhuurmodule → FASE S9 backlog | ✅ lokaal | script fix_antwoorden.js + fix_rest.js |
| 2026-08-03 | **FASE S6 GOEDGEKEURD** (review Fable, onafhankelijke herdraai 15/15 relevant groen) | ✅ | herdraaid op verse testdata: Alice N08-keten (tellen 4/16 → tekort 12 → afsluiten 400 → aanvullen zonder rij = 400+kan_aanmaken → rij aanmaken → aanvullen 20→4 → besteld → afsluiten 200); dashboard aggregeert (Pijpenragers 70=10+60, 2 herkomsten; veld `herkomst`); ontbrekend_transport vuurt mét locatienaam en NIET voor materiaalloos uitstapthema; locatieconfig_onvolledig noemt week+locatie ("Week 1 — Abdijschool: 99× EHBO, 2 vrij"); 77 thema's intact. Reviewfindings verholpen door Fable: Chat A's week-99-testsessies (16/17) stonden nog open in dashboard → genegeerd+verwerkt; eigen testresten idem; dashboard nu 0 rijen |
| 2026-08-03 | **S4.6+S4.7+S4.8 GOEDGEKEURD na reviewfixes** (review Fable, herdraai 12/12 groen na fix) | ✅ | herdraaid: foto-slots opgeplooid/opgezet gezet+persistent na serverherstart, ongeldig slot 400; bundels: bestandenlijst 3, koppelen/ontkoppelen, PDF-serve 200+%PDF; KV-boodschappen: Festivalfood 30 regels prefix-gestript zonder INFO, Alice leeg; 77 thema's intact. **Reviewfixes Fable:** (1) path-traversal-lek gedicht ("..\\server.js" was koppelbaar → nu 400 op padscheiders/..); (2) /bundels-static verplaatst tot ná de Basic-auth-muur (stond publiek op prod); (3) Chat B's testkoppelingen opgeruimd (traversal-rij + duplicaat) — 4084 heeft nu exact 2 correcte bundels |
| 2026-08-03 | Thema "Spookje Poef" (themadag) ingevoerd (lokaal, batch-agent; leeg sjabloon, TD-regel 5) | ✅ lokaal, prod open | thema 4159: 1 bakken/0 items/0 attributen/0 voorraadrijen; lege bak code onbekend + INFO "bundel nog niet geschreven" |
| 2026-08-03 | Thema "1001 ballen (themadag)" ingevoerd (lokaal, batch-agent; gele zakken J43/J44/J45 = themabakken, TD-regel 8) | ✅ lokaal, prod open | thema 4160: 3 bakken/4 items/0 attributen/0 voorraadrijen; mousseballen 18 vs 20 (p.3) in VRAGENLOG |
| 2026-08-03 | Thema "Alice in Wonderland (themadag)" ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4161: 1 bak (L17)/19 items (3 verbruik)/0 attributen/2 voorraadrijen |
| 2026-08-03 | Thema "Alle kleuren van de regenboog" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4162: 1 bak (I13)/10 items (6 verbruik)/0 attributen/2 voorraadrijen |
| 2026-08-03 | Thema "Alles op wieltjes (themadag)" ingevoerd (lokaal, batch-agent; verkeerskoffer+voertuigen = pool-INFO; bijlage fietsspelletjes gelogd) | ✅ lokaal, prod open | thema 4163: 1 bak (I05)/5 items (3 verbruik)/0 attributen/0 voorraadrijen |
| 2026-08-03 | Thema "Avontuur in de natuur" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4164: 1 bak (I04)/5 items (2 verbruik)/0 attributen/2 voorraadrijen |
| 2026-08-03 | Thema "Balanceren op één been (themadag)" ingevoerd (lokaal, batch-agent; eigen bakken, beide M00 — overlap met kamp 4089 in VRAGENLOG) | ✅ lokaal, prod open | thema 4165: 2 bakken (2×M00)/7 items/0 attributen/0 voorraadrijen |
| 2026-08-03 | Thema "Bij de politie" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4166: 1 bak (I12)/19 items (12 verbruik)/0 attributen/4 voorraadrijen; 4 print-aannames in VRAGENLOG |
| 2026-08-03 | Thema "Blokkenbouwdoos" (themadag) ingevoerd (lokaal, batch-agent; volledig pool, L22) + pool-uitbreiding | ✅ lokaal, prod open | thema 4167: 0 bakken; pool +20 bouwhelmen +2 koffers houten blokken (bezit verifiëren); INFO-regel met behoefte |
| 2026-08-03 | Thema "Circus Krokofant (themadag)" ingevoerd (lokaal, batch-agent; bijlage activiteitenfiche gelogd) | ✅ lokaal, prod open | thema 4168: 2 bakken (J22/J23)/11 items (4 verbruik)/2 attributen (frame + themadoek TD3)/2 voorraadrijen |
| 2026-08-03 | Thema "Creakriebels" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4169: 2 bakken (L27/L25)/19 items (6 verbruik)/0 attributen/3 voorraadrijen |
| 2026-08-03 | Thema "De 4 seizoenen" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4170: 1 bak (I29)/20 items (10 verbruik)/0 attributen/3 voorraadrijen; veel aantallen onbekend → L7-notities |
| 2026-08-03 | Thema "De techniekfabriek (themadag)" ingevoerd (lokaal, batch-agent; suffix wegens kampthema 4116) | ✅ lokaal, prod open | thema 4171: 2 bakken (I48/I49)/19 items (6 verbruik)/0 attributen/5 voorraadrijen |
| 2026-08-03 | Thema "De vloek van de farao (themadag)" ingevoerd (lokaal, batch-agent; suffix wegens kampthema 4096) | ✅ lokaal, prod open | thema 4172: 1 bak (L21)/11 items (4 verbruik)/0 attributen/4 voorraadrijen |
| 2026-08-03 | Thema "De wondere kabouterwereld" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4173: 2 bakken (2×I38, incl. mayo pot natuurblokken)/20 items (4 verbruik)/0 attributen/4 voorraadrijen; fiche-vs-activiteit-verschillen in VRAGENLOG |
| 2026-08-03 | Thema "Diep in de zee" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4174: 1 bak (I11)/17 items (8 verbruik)/0 attributen/5 voorraadrijen; fiche eindigt op "…" → mogelijk onvolledig (VRAGENLOG) |
| 2026-08-03 | Thema "Geuren en kleuren" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4175: 1 bak (I22)/14 items (8 verbruik)/0 attributen/8 voorraadrijen |
| 2026-08-03 | Thema "Het kraaiende kinderkoor" (themadag) ingevoerd (lokaal, batch-agent; bijlage songteksten gelogd) | ✅ lokaal, prod open | thema 4176: 1 bak (I19)/6 items (4 verbruik)/0 attributen/3 voorraadrijen; wc-rolletjes = verzamelstroom (L29) |
| 2026-08-03 | Thema "Het wilde wilde Westen" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4177: 1 bak (I34)/9 items (4 verbruik)/1 attribuut (frame+themadoek western, niet op fiche — VRAGENLOG)/2 voorraadrijen |
| 2026-08-03 | Thema "Hoeden en petten" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4178: 3 bakken (I23/2×I24)/6 items (5 verbruik)/0 attributen/5 voorraadrijen; gedeelde code I24 (VRAGENLOG) |
| 2026-08-03 | Thema "Hoera 't is feest" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4179: 1 bak (I06)/20 items (15 verbruik)/0 attributen/11 voorraadrijen; veel aantallen onbekend → L7-notities |
| 2026-08-03 | Thema "Holderdebolder (themadag)" ingevoerd (lokaal, batch-agent; geen fiche → TD-regel 6, thema-only; bijlage Wesco gelogd) | ✅ lokaal, prod open | thema 4180: 0 bakken/0 items/0 attributen/0 voorraadrijen; INFO-regel "±zelfde pool als kampversie"; naamkeuze Holderdebolder (VRAGENLOG) |
| 2026-08-03 | Thema "Ik word kunstenaar" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4181: 1 bak (I17)/13 items (5 verbruik)/1 attribuut (schildersezel I00)/2 voorraadrijen |
| 2026-08-03 | Thema "In dromenland (themadag)" ingevoerd (lokaal, batch-agent; suffix wegens naambotsing met kamp "Spelen in dromenland" 4112) | ✅ lokaal, prod open | thema 4182: 1 bak (I21)/9 items (7 verbruik)/0 attributen/6 voorraadrijen |
| 2026-08-03 | Thema "In smurfenland (themadag)" ingevoerd (lokaal, batch-agent; suffix wegens kamp "Sporty in smurfenland" 4113) | ✅ lokaal, prod open | thema 4183: 1 bak (J09)/15 items (7 verbruik)/0 attributen/7 voorraadrijen |
| 2026-08-03 | Thema "Jumpen (themadag)" ingevoerd (lokaal, batch-agent; gedeelde springdieren-bak N17/18 van kamp "Jumpen!" gekoppeld, TD-regel 4; Compressor 1 in pool, TD-regel 7) | ✅ lokaal, prod open | thema 4184: 1 gedeelde bak (12071, +item tjoepkes)/0 attributen/0 voorraadrijen; 2 INFO-regels (springkastelen-pool, compressor) |
| 2026-08-03 | Thema "Kleine dappere indiaan" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4185: 1 bak (I43)/14 items (11 verbruik)/0 attributen/9 voorraadrijen |
| 2026-08-03 | Thema "Knuffeldag" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4186: 2 bakken (I01/I02)/10 items (8 verbruik)/0 attributen/6 voorraadrijen; knuffelbak zonder inhoudsopgave (L27) |
| 2026-08-03 | Thema "Koekiemonstertjes" (themadag, kook) ingevoerd (lokaal, batch-agent; apart kleuterthema naast LS-kamp "Koekiemonsters") | ✅ lokaal, prod open | thema 4187: 3 bakken (K37/K39/K38)/29 items (12 verbruik)/0 attributen/12 voorraadrijen; 2 KV-regels + kookpool-INFO; K37+K39 gedeeld met TD Koekjesfabriek (VRAGENLOG) |
| 2026-08-03 | Thema "Kriebelbeestjes" (themadag) ingevoerd (lokaal, batch-agent; beoordeeld als apart thema naast kamp "Kriebeldiertjes" 4102) | ✅ lokaal, prod open | thema 4188: 1 bak (I25)/9 items (3 verbruik)/0 attributen/2 voorraadrijen |
| 2026-08-03 | Thema "Mini atletiek" (themadag) ingevoerd (lokaal, batch-agent; bijlage Activiteitenfiche Atletiek gelogd) | ✅ lokaal, prod open | thema 4189: 1 bak (J33)/11 items (2 verbruik)/0 attributen/1 voorraadrij; diploma = printbaar |
| 2026-08-03 | Thema "Minigym" (themadag) ingevoerd (lokaal, batch-agent; bijlagen Kleuteracrobatie + Bewegingskaarten banken 1-3 gelogd) | ✅ lokaal, prod open | thema 4190: 2 bakken (2×M00)/4 items/0 attributen/0 voorraadrijen; item-verdeling over de 2 bakken onbekend (VRAGENLOG) |
| 2026-08-03 | Thema "Mini Olympische spelen" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4191: 2 bakken (K57/K00)/6 items/0 attributen/0 voorraadrijen; aantal hordes onbekend |
| 2026-08-03 | Thema "Minidisco (themadag)" ingevoerd (lokaal, batch-agent; suffix wegens kampthema 4106) | ✅ lokaal, prod open | thema 4192: 1 bak (I16)/5 items (0 verbruik)/0 attributen/0 voorraadrijen |
| 2026-08-03 | Thema "Op avontuur in de ruimte" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4193: 1 bak (I33)/14 items (9 verbruik)/2 attributen (frame + themadoek TD4)/7 voorraadrijen; WC rol = verzamelstroom (L29) |
| 2026-08-03 | Thema "Op stap in de jungle (themadag)" ingevoerd (lokaal, batch-agent; suffix wegens kamp 4109; kamp-attribuut 50 frame+doek hergebruikt) | ✅ lokaal, prod open | thema 4194: 1 bak (I31)/15 items (4 verbruik)/1 attribuut/2 voorraadrijen |
| 2026-08-03 | Thema "Pinguïns en Eskimo's" (themadag) ingevoerd (lokaal, batch-agent; frame+themadoek niet op fiche → attribuut + VRAGENLOG; iglo blokken TD8 als bak) | ✅ lokaal, prod open | thema 4196: 2 bakken (I26/TD8)/15 items (10 verbruik)/1 attribuut/8 voorraadrijen |
| 2026-08-03 | Thema "Pizza pronto" (themadag, kook) ingevoerd (lokaal, batch-agent; kookpool-INFO + 7 KV-regels) | ✅ lokaal, prod open | thema 4197: 1 bak (K49)/17 items (12 verbruik)/0 attributen/10 voorraadrijen |
| 2026-08-03 | Thema "Reis rond de wereld (themadag)" ingevoerd (lokaal, batch-agent; suffix wegens kampthema 4110) | ✅ lokaal, prod open | thema 4198: 1 bak (I09)/11 items (2 verbruik)/0 attributen/1 voorraadrij |
| 2026-08-03 | Thema "Ridders en prinsessen" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4199: 1 bak (I08)/20 items (10 verbruik)/0 attributen/8 voorraadrijen; veel aantallen onbekend → L7-notities |
| 2026-08-03 | Thema "Schattenjacht (themadag)" ingevoerd (lokaal, batch-agent; suffix wegens kampthema 4111; eierdozen = verzamelstroom-aanname) | ✅ lokaal, prod open | thema 4200: 2 bakken (K23 + schatkist K21)/21 items (9 verbruik)/0 attributen/6 voorraadrijen |
| 2026-08-03 | Thema "Schip ahoi, kapitein!" (themadag) ingevoerd (lokaal, batch-agent; frame piratenboot niet op fiche → attribuut + VRAGENLOG) | ✅ lokaal, prod open | thema 4201: 1 bak (I28)/13 items (7 verbruik)/1 attribuut/2 voorraadrijen |
| 2026-08-03 | Thema "School voor hekserij en hocus pocus" (themadag) ingevoerd (lokaal, batch-agent; frame + themadoek TD7 = 2 attributen) | ✅ lokaal, prod open | thema 4202: 1 bak (I15)/16 items (8 verbruik)/2 attributen/7 voorraadrijen |
| 2026-08-03 | Thema "Sportymove" (themadag) ingevoerd (lokaal, batch-agent; 4 Fiches-bijlagen gelogd voor S4.7) | ✅ lokaal, prod open | thema 4203: 1 bak (J37)/9 items (2 verbruik)/0 attributen/2 voorraadrijen |
| 2026-08-03 | Thema "Sprookjesland (themadag)" ingevoerd (lokaal, batch-agent; suffix wegens kampthema 4114; frame + themadoek TD1 = 2 attributen) | ✅ lokaal, prod open | thema 4204: 1 bak (I07)/21 items (10 verbruik)/2 attributen/7 voorraadrijen |
| 2026-08-03 | Thema "Superdeluxe kleuterorkest" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4205: 2 bakken (I35/I36)/11 items (8 verbruik)/0 attributen/7 voorraadrijen |
| 2026-08-03 | Thema "Superhelden (themadag)" ingevoerd (lokaal, batch-agent; suffix wegens kampthema 4115) | ✅ lokaal, prod open | thema 4206: 1 bak (I03)/14 items (5 verbruik)/0 attributen/2 voorraadrijen |
| 2026-08-03 | Thema "Terug in de tijd" (themadag) ingevoerd (lokaal, batch-agent; rubriek "Creamateriaal" als verbruik gelezen) | ✅ lokaal, prod open | thema 4207: 1 bak (I27)/8 items (4 verbruik)/0 attributen/4 voorraadrijen |
| 2026-08-03 | Thema "Van auto tot zeppelin" (themadag) ingevoerd (lokaal, batch-agent; "Rondel" onduidelijk → VRAGENLOG) | ✅ lokaal, prod open | thema 4208: 1 bak (K01)/17 items (10 verbruik)/0 attributen/6 voorraadrijen |
| 2026-08-03 | Thema "Van kop tot teen" (themadag) ingevoerd (lokaal, batch-agent; Creamateriaal als verbruik gelezen) | ✅ lokaal, prod open | thema 4209: 1 bak (I14)/17 items (3 verbruik)/0 attributen/1 voorraadrij |
| 2026-08-03 | Thema "Waterpret en bellen" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4210: 2 bakken (K17/K19)/17 items (6 verbruik)/0 attributen/2 voorraadrijen |
| 2026-08-03 | Thema "We slaan er op los" (themadag) ingevoerd (lokaal, batch-agent; beoordeeld als apart thema naast kamp "We slaan in het rond" 4118 — VRAGENLOG) | ✅ lokaal, prod open | thema 4211: 2 bakken (J31/J42)/7 items (1 verbruik)/0 attributen/0 voorraadrijen |
| 2026-08-03 | Thema "Welkom op de boerderij (themadag)" ingevoerd (lokaal, batch-agent; suffix wegens kampthema 4119) | ✅ lokaal, prod open | thema 4212: 1 bak (I44)/13 items (0 verbruik)/0 attributen/0 voorraadrijen |
| 2026-08-03 | Thema "Wij worden kleuterchefs" (themadag, kook) ingevoerd (lokaal, batch-agent; kookpool-INFO + 9 KV-regels) | ✅ lokaal, prod open | thema 4213: 1 bak (J12)/12 items (7 verbruik)/0 attributen/1 voorraadrij |
| 2026-08-03 | Thema "Wij zijn bij de brandweer" (themadag) ingevoerd (lokaal, batch-agent; rubriekloze fiche, papier/wol/krijt als verbruik — VRAGENLOG) | ✅ lokaal, prod open | thema 4214: 1 bak (I54)/17 items (11 verbruik)/0 attributen/2 voorraadrijen |
| 2026-08-03 | Thema "Winterwonderland" (themadag) ingevoerd (lokaal, batch-agent; WC-rolletjes = verzamelstroom L29) | ✅ lokaal, prod open | thema 4215: 2 bakken (J47/J46)/25 items (14 verbruik)/0 attributen/3 voorraadrijen |
| 2026-08-03 | Thema "Zomerzotten" (themadag) ingevoerd (lokaal, batch-agent; 3 eenheden delen code J21, houten schijf onduidelijk — VRAGENLOG) | ✅ lokaal, prod open | thema 4216: 3 bakken (3×J21)/25 items (5 verbruik)/0 attributen/1 voorraadrij |
| 2026-08-03 | Thema "Apenstreken" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4217: 1 bak (J50)/24 items (8 verbruik)/0 attributen/6 voorraadrijen; KV 1 regel + kookvuur-pool-INFO |
| 2026-08-03 | Thema "Apero go" (themadag, kook) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4218: 1 bak (K24)/14 items (11 verbruik)/0 attributen/11 voorraadrijen; KV 18 regels + kookpool-INFO |
| 2026-08-03 | Thema "Art @ Sporty (themadag)" ingevoerd (lokaal, batch-agent; suffix wegens kamp 4126; beide bakken code I37) | ✅ lokaal, prod open | thema 4219: 2 bakken (2×I37)/19 items (9 verbruik)/0 attributen/9 voorraadrijen |
| 2026-08-03 | Thema "Atleet voor één dag" (themadag) ingevoerd (lokaal, batch-agent; bestaande bak J33 van TD "Mini atletiek" gekoppeld, TD-regel 4; bijlage activiteitenfiche atletiek gelogd) | ✅ lokaal, prod open | thema 4220: 1 gedeelde bak (12300, 11 items)/0 attributen/0 voorraadrijen; 1 INFO-regel |
| 2026-08-03 | Thema "Bake off" (themadag, kook) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4221: 2 bakken (I40/I39)/18 items (15 verbruik)/0 attributen/15 voorraadrijen; KV 5 regels + kookpool-INFO |
| 2026-08-03 | Thema "Boog- en lasershooting" (themadag) ingevoerd (lokaal, batch-agent; gedeelde eenheden gekoppeld: lasershoot-bak 12000 + kruisbogen-kist 12237 + attributen targets/rozen-doelen/losse bogen/pijlen; 2 bijlagen gelogd) | ✅ lokaal, prod open | thema 4222: 2 gedeelde bakken/4 attributen/0 voorraadrijen; 2 INFO-regels; aantallen-inconsistentie in VRAGENLOG |
| 2026-08-03 | Thema "Bouwen met Lego" (themadag) ingevoerd (lokaal, batch-agent; bestaande C07+C08-bakken van kamp Lego Legends gekoppeld, TD-regel 4) | ✅ lokaal, prod open | thema 4223: 2 gedeelde bakken (12187/12188)/0 attributen/0 voorraadrijen |
| 2026-08-03 | Thema "Clic-it (themadag)" ingevoerd (lokaal, batch-agent; suffix wegens kamp "CLIC IT" 4131; clics-pool via INFO zoals het kamp — keuze in VRAGENLOG) | ✅ lokaal, prod open | thema 4224: 0 bakken/0 items/0 attributen/0 voorraadrijen; 1 INFO-regel |
| 2026-08-03 | Thema "Creatief met papier" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4225: 1 bak (J49)/25 items (9 verbruik)/0 attributen/9 voorraadrijen |
| 2026-08-03 | Thema "De bakkerij (themadag)" (kook) ingevoerd (lokaal, batch-agent; suffix wegens kampthema 4086; eigen bakken K45/K47) | ✅ lokaal, prod open | thema 4226: 2 bakken (K45/K47)/23 items (16 verbruik)/0 attributen/16 voorraadrijen; KV 3 regels + kookpool-INFO |
| 2026-08-03 | Thema "De bal gaat aan het rollen" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4227: 3 bakken (K53/K55/K52, sportpakketten L2)/3 items/0 attributen/2 voorraadrijen (Kantoor, L8) |
| 2026-08-03 | Thema "De bouwbrigade" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4228: 3 bakken (3× RGE)/15 items/0 attributen/0 voorraadrijen; INFO karton-Makedo |
| 2026-08-03 | Thema "Druk er op los" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4229: 2 bakken (K25/K22)/24 items (8 verbruik)/0 attributen/6 voorraadrijen |
| 2026-08-03 | Thema "Expeditie Sportyson" (themadag) ingevoerd (lokaal, batch-agent; eigen bak, kamp Expeditie Survival NIET gekoppeld — andere codes) | ✅ lokaal, prod open | thema 4230: 1 bak (K41)/24 items (4 verbruik)/0 attributen/4 voorraadrijen |
| 2026-08-03 | Thema "Experimenteeratelier" (themadag) ingevoerd (lokaal, batch-agent; eigen bakken, kamp Experimenteerfabriek niet gekoppeld — andere codes) | ✅ lokaal, prod open | thema 4231: 2 bakken (D59/D60)/12 items (4 verbruik)/0 attributen/4 voorraadrijen |
| 2026-08-03 | Thema "Fit & fun" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4232: 1 bak (J20)/11 items (1 verbruik, printbaar)/0 attributen/0 voorraadrijen |
| 2026-08-03 | Thema "Flock Fun" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4233: 1 bak (K15)/14 items (7 verbruik)/1 attribuut (strijkplanken)/6 voorraadrijen |
| 2026-08-03 | Thema "Fun in the farwest" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4234: 1 bak (I41)/19 items (10 verbruik)/0 attributen/8 voorraadrijen |
| 2026-08-03 | Thema "Games of empire" (themadag) ingevoerd (lokaal, batch-agent; bestaande set-bak 12138 van Actie & Avontuur gekoppeld + attributen 65/77/78) | ✅ lokaal, prod open | thema 4235: 1 gekoppelde bak/14 items/3 gekoppelde attributen/0 voorraadrijen; INFO rekkers |
| 2026-08-03 | Thema "Groene vingers" (themadag) ingevoerd (lokaal, batch-agent; eigen bakken, kamp Plan(t)trekkers niet gekoppeld — andere codes) | ✅ lokaal, prod open | thema 4236: 2 bakken (J07/K20)/22 items (16 verbruik)/0 attributen/12 voorraadrijen; INFO potgrond |
| 2026-08-03 | Thema "Homo Universalis (themadag)" ingevoerd (lokaal, batch-agent; suffix wegens kamp 4152) | ✅ lokaal, prod open | thema 4237: 2 bakken (I52/I53)/30 items (7 verbruik)/0 attributen/5 voorraadrijen; KV 1 regel |
| 2026-08-03 | Thema "Jumpen XL" (themadag) ingevoerd (lokaal, batch-agent; geen fiche — TD-regel 6) | ✅ lokaal, prod open | thema 4238: 0 bakken/0 items/0 attributen; INFO-regel pool-verwijzing |
| 2026-08-03 | Thema "Koekjesfabriek (themadag)" ingevoerd (lokaal, batch-agent; suffix wegens kleuterkamp 4101; bestaande TD-bakken K37/K39 van Koekiemonstertjes gekoppeld) | ✅ lokaal, prod open | thema 4239: 3 bakken (2 gekoppeld + nieuwe 2/3 K37)/34 items (17 verbruik)/0 attributen/9 voorraadrijen; KV 2 regels + 2 INFO |
| 2026-08-03 | Thema "Laat je rollen" (themadag) ingevoerd (lokaal, batch-agent; geen fiche — TD-regel 6, voertuigenpool) | ✅ lokaal, prod open | thema 4240: 0 bakken/0 items/0 attributen; 1 INFO-regel |
| 2026-08-03 | Thema "Let's escape" (themadag) ingevoerd (lokaal, batch-agent; codes onbekend, 2 gescande bijlagen gelogd) | ✅ lokaal, prod open | thema 4241: 2 bakken (codes onbekend)/22 items (0 verbruik)/0 attributen/0 voorraadrijen; 1 INFO |
| 2026-08-03 | Thema "Luilekkerland" (themadag, kookthemadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4242: 1 bak (O09)/21 items (5 verbruik)/0 attributen/5 voorraadrijen; KV 4 regels |
| 2026-08-03 | Thema "Missie avontuur" (themadag) ingevoerd (lokaal, batch-agent; boogschieten-pool gekoppeld) | ✅ lokaal, prod open | thema 4243: 1 bak (K26)/5 items/1 gekoppeld attribuut/0 voorraadrijen; 1 INFO (kruisbogen-kist pool) |
| 2026-08-03 | Thema "Olympische spelen" (themadag) ingevoerd (lokaal, batch-agent; apart LS-thema naast kleuter "Mini Olympische spelen") | ✅ lokaal, prod open | thema 4244: 1 bak (D43)/17 items (1 verbruik)/0 attributen/1 voorraadrij |
| 2026-08-03 | Thema "Op expeditie" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4245: 1 bak (J15)/10 items (1 verbruik)/0 attributen/1 voorraadrij |
| 2026-08-03 | Thema "Paralympics" (themadag) ingevoerd (lokaal, batch-agent; eigen bak K43, overlap Sportymadness gelogd) | ✅ lokaal, prod open | thema 4246: 1 bak (K43)/8 items/0 attributen/0 voorraadrijen; 1 INFO |
| 2026-08-03 | Thema "Play Factory (themadag)" ingevoerd (lokaal, batch-agent; suffix wegens kamp 4087; 7 kampbakken + targets-attribuut gekoppeld) | ✅ lokaal, prod open | thema 4247: 7 gekoppelde bakken (domino 1+2, trapjes 1+2, KUBB, Fins kegelspel, lasershoot-geweren)/0 eigen items/1 gekoppeld attribuut; 1 INFO; 3 bijlagen gelogd |
| 2026-08-03 | Thema "Professor Kanniboemski" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4248: 1 bak (J35)/45 items (22 verbruik)/0 attributen/22 voorraadrijen |
| 2026-08-03 | Thema "Push & play" (themadag) ingevoerd (lokaal, batch-agent; alleen sportmateriaal-rubriek L2; 2 bijlagen gelogd) | ✅ lokaal, prod open | thema 4249: 2 bakken (Gaga bal + Push the button, codes onbekend)/4 items/0 attributen; 1 INFO |
| 2026-08-03 | Thema "Ravot je rot" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4250: 1 bak (J19)/18 items (2 verbruik)/0 attributen/2 voorraadrijen |
| 2026-08-04 | Thema "Showtime" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4251: 1 bak (J16)/17 items (7 verbruik)/1 nieuw attribuut (Magic Speldoos)/1 voorraadrij |
| 2026-08-04 | Thema "Spellenspektakel" (themadag) ingevoerd (lokaal, batch-agent; 4 XL-attributen gekoppeld; handleidingen-bijlage gelogd) | ✅ lokaal, prod open | thema 4252: 1 bak (N12)/23 items/4 gekoppelde attributen |
| 2026-08-04 | Thema "Spionnen gezocht" (themadag) ingevoerd (lokaal, batch-agent; verwacht kamp bestaat NIET in DB → geen suffix/koppeling, zie VRAGENLOG; 3 bijlagen gelogd) | ✅ lokaal, prod open | thema 4253: 2 bakken (K04+K13)/36 items (4 verbruik)/0 attributen/2 voorraadrijen |
| 2026-08-04 | Thema "Sporty records" (themadag) ingevoerd (lokaal, batch-agent; K2-code gedeeld bak 2/3+3/3) | ✅ lokaal, prod open | thema 4254: 3 bakken (K11+2×K2)/50 items (16 verbruik)/0 attributen/7 voorraadrijen; 1 KV-regel |
| 2026-08-04 | Thema "Sticks & bats" (themadag) ingevoerd (lokaal, batch-agent; 4 sportpakketten als bakken L2; 4 bijlagen gelogd) | ✅ lokaal, prod open | thema 4255: 4 bakken (I51×2/I55/I56)/11 items/0 attributen |
| 2026-08-04 | Thema "Under construction" (themadag) ingevoerd (lokaal, batch-agent; houten-blokken-pool INFO) | ✅ lokaal, prod open | thema 4256: 3 bakken (J05/J10/apart)/16 items (8 verbruik)/0 attributen/5 voorraadrijen; 1 INFO |
| 2026-08-04 | Thema "Van creatie tot constructie" (themadag) ingevoerd (lokaal, batch-agent; Creatool OPLA/SPOK-pool INFO; 2 opdrachtkaarten-bijlagen gelogd) | ✅ lokaal, prod open | thema 4257: 1 bak (codeloos)/1 item/0 attributen; 1 INFO |
| 2026-08-04 | Thema "Verf in alle kleuren en geuren" (themadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4258: 1 bak (I18)/20 items (11 verbruik)/0 attributen/5 voorraadrijen |
| 2026-08-04 | Thema "Voetbalmadness (themadag)" ingevoerd (lokaal, batch-agent; suffix wegens kamp 4148; voetbalkisten-bak 12174 gekoppeld L30) | ✅ lokaal, prod open | thema 4259: 1 eigen zak (codeloos) + 1 gekoppelde bak/3 eigen items/0 attributen |
| 2026-08-04 | Thema "Wafels en pannenkoeken" (themadag, kookthemadag) ingevoerd (lokaal, batch-agent) | ✅ lokaal, prod open | thema 4260: 3 bakken (K05/K07/K03)/23 items (7 verbruik)/0 attributen/2 voorraadrijen; 3 KV + 1 INFO |
| 2026-08-04 | Thema "Wereldkeuken (themadag)" (kookthemadag) ingevoerd (lokaal, batch-agent; suffix wegens kamp 4151) | ✅ lokaal, prod open | thema 4261: 1 bak (K58)/15 items (10 verbruik)/0 attributen/7 voorraadrijen; 9 KV + 1 INFO |
| 2026-08-04 | Thema "Wereldreizigers" (themadag) ingevoerd (lokaal, batch-agent; itemverdeling K27/K29 onbekend, zie VRAGENLOG) | ✅ lokaal, prod open | thema 4262: 2 bakken (K27+K29)/25 items (7 verbruik)/0 attributen/4 voorraadrijen |
| 2026-08-04 | Thema "Zoete toetjes (themadag)" (kookthemadag) ingevoerd (lokaal, batch-agent; suffix wegens kamp 4155; geen code-overlap met kampbakken → geen koppeling) | ✅ lokaal, prod open | thema 4263: 2 bakken (K31+K33)/29 items (12 verbruik)/0 attributen/2 voorraadrijen; 3 KV + 1 INFO |
| 2026-08-04 | Thema "Zomerse cocktails" (themadag, kookthemadag) ingevoerd (lokaal, batch-agent) — **themadagen compleet** | ✅ lokaal, prod open | thema 4264: 2 bakken (I47+I45)/18 items (16 verbruik)/0 attributen/11 voorraadrijen; 5 KV-regels |
| 2026-08-04 | **THEMADAGEN COMPLEET** (9 TD-batches, 105 themadag-thema's) + gemist kampthema "Spionnen gezocht!" alsnog ingevoerd (Fable: 4265, 3 bakken/73 items/10 voorraadrijen — TD-slotbatch ontdekte het gat) + 1001/Alice kregen categorie 'kamp' | ✅ lokaal, prod open | eindstand lokaal: 78 kampen + 105 themadagen = 183 thema's; nieuwe vraag: escape-kisten kamp-Spionnen 2/3+3/3 = zelfde als TD "Let's escape"-curvers? (geen codes op beide fiches) |
| 2026-08-04 | Prod-zetronde voorbereid: /api/herstel-db-endpoint (achter beide muren, met auto-veiligheidskopie + herstart), round-trip lokaal getest; "Als atleet over de meet" bleek nérgens meer te bestaan (Verse Start 2 wiste hem ook op prod) → alsnog lokaal ingevoerd (4266: G11/D17/G00, 18 items) | ✅ | lokaal 184 thema's; prod-backup PROD-…-voor-zetronde.db in D:\Sporty\backups |
| 2026-08-04 | **PROD-ZETRONDE VOLTOOID**: code gedeployed (S6, S4.6-4.8, herstel-db) + volledige lokale database naar prod | ✅ | prod geverifieerd: 184 thema's (79 kamp/105 themadag), 196 pool, 90 attributen, 868 voorraadrijen, 41 locaties intact; oude prod-db in D:\Sporty\backups + volume-kopie. LES: na /api/herstel-db herstart Railway niet vanzelf (exit 0) → lege commit pushen; ±6 min downtime |
| 2026-08-04 | **S4.5a–f GOEDGEKEURD** (review Fable, herdraai 11/11 groen — 2 aanvankelijke fails waren eigen testfout: week buiten periode) | ✅ | herdraaid: behoefte-CRUD; 81 behoefteregels gevuld; blazers_nodig (hindernisbanen 2); themaframe-pool 3 + frame-attributen netjes omgezet; generator: wieltjes-km ⇒ koffer+fietsen+fietsparcours+blazer+verlengdraadkoffer; pool_tekort vuurt; 184 thema's intact; testdata opgeruimd. **OPEN: S4.5g bulk-materiaal (aanvulling Maxim) is NIET gebouwd — vervolgopdracht Chat A** |
| | **Simulatie-bevindingen voor S5-fixronde:** (1) dubbele voorstellen bij aansluitende weken: directe transfer én wissel-ophaling voor dezelfde bakken; (2) waar-is-historiek toont geen transportbewegingen, enkel handmatige verplaatsingen; (3) thema-bakkenlijst geeft ander id-veld dan items-detail-route verwacht; (4) kv-tellen-endpoint slikt misvormde payload stil met ok:true | 🐛 | vastgesteld tijdens simulatie 2026-08-02 |
| 2026-08-02 | S6.1-S6.3 gebouwd (kv-tekortstatus besteld/aangevuld/genegeerd, sluit-gate, kantoor-tekortendashboard, conflicten ontbrekend_transport + locatieconfig_onvolledig) | gebouwd, review Fable volgt | Migratie 60 (tekort_status); knutsellijm-scenario 3-rollen herdraaid (4 gewenst/1 geteld -> tekort 3 -> besteld -> aanvullen zonder voorraadrij nette fout+knop -> voorraadrij aanmaken -> aanvullen voorraad daalt -> sluiten geweigerd bij open tekort, geslaagd na besteld/aangevuld); dashboard aggregeert 2 bakken/locaties zelfde item_type tot 1 rij (totaal 70 = 10+60, 2 herkomsten) + thema-al-gebruikt-signaal; ontbrekend_transport vuurt zonder taak en verdwijnt na aanmaken levering+ophaling; locatieconfig_onvolledig vuurt bij 0/1 vrije EHBO-exemplaren en verdwijnt bij voldoende exemplaren; testdata opgeruimd (zie eindrapport) |
| 2026-08-02 | S6-hertest op echte data (77 thema's/638 voorraadrijen) + S6.3(a) uitzondering materiaalloze thema's toegevoegd | ✅ geverifieerd | code van S6.1/S6.2/S6.3 klopte inhoudelijk (herlezen r.3687-3853, 4734-4767); S6.3(a) ontbrak nog — toegevoegd: ontbrekend_transport slaat kampmomenten over waarvan élk gekoppeld thema 0 bakken+0 attributen heeft (bv. "Op stap met Sporty" 4088, "Beestenbende" 4128) én er geen sport gepland is; bewijs op echte thema's: Theekopjes-bak N08 (Alice in Wonderland) 16 gewenst/4 geteld -> tekort 12 -> besteld -> aanvullen zonder voorraadrij 400+kan_aanmaken -> voorraadrij aangemaakt -> aanvullen 20->8 -> sluiten geweigerd (400) bij open tekort, geslaagd na verwerking; dashboard: Aluminiumfolie-tekort in 2 echte bakken (Alles op wieltjes @Abdijschool, Mini helden 112 @Boudewijnstadion) -> 1 rij totaal_tekort 2, 2 herkomsten met verschillende locatie_naam; ontbrekend_transport vuurt op km140+Alice (materiaal, geen taak), verdwijnt niet bij km140+sport (want sport heeft ook transport nodig — correct), vuurt NIET voor km145+"Op stap met Sporty" (materiaalloos, geen sport) t.o.v. wel-vurende buurweken; alle test-kampmoment_themas-links en nakijk-sessies nadien verwijderd; 77 thema's/2194 item_types ongewijzigd; 1 voorraadrij (Theekopjes @Rozenweg) blijft staan op qty 0 — geen delete-endpoint voor item_type_stock, expliciete afwijking |
| 2026-08-03 | S4.6/S4.7/S4.8 gebouwd (foto's op pool-eenheden, themabundel-PDF, KV-boodschappenlijst) | gebouwd, review Fable volgt | Migratie 61 (bakken.foto_opgeplooid/foto_opgezet + tabel thema_bundels, geen datamigratie). **S4.6**: POST/DELETE /api/vaste-bakken/:id/foto-slot (opgeplooid/opgezet), canvas-resize max 1200px breed vóór upload; UI in Vaste bakken-lijst toont 2 vakken (📷 leeg / thumbnail + 🗑️) enkel voor vast_type springkasteel/waterstructuur, klik-naar-groot lightbox; bewijs: 2 foto's op "Klein springkasteel - jungle" (11937) → beide zichtbaar → 3 herstarts → nog aanwezig; volledige UI-flow (file-input→resize→upload→herrender) ook los geverifieerd op "Colorslide" (12178); testfoto's (1×1-pixel placeholders) nadien verwijderd, de eigenlijke springkastelen blijven foto-loos tot Maxim echte foto's neemt. **S4.7**: servermap `bundels/` (__dirname, meegedeployed, NIET het DATA_DIR-uploadvolume) gemount op /bundels; tabel thema_bundels; GET /api/bundels/bestanden (dropdown), POST/GET/DELETE /api/themas/:id/bundels; themadetail toont "📄 Themabundel"-sectie met 📄-knoppen (target=_blank) + koppel-UI; bewijs: 2 test-PDF's gekoppeld aan "Alles op wieltjes" (4084, hoofdbundel+Coole Kadeekes) → beide 📄-knoppen tonen "(2)", href klopt (curl 200, content-type application/pdf); 1 PDF aan "De bakkerij" (4086); ontkoppelen getest (2→1) en teruggekoppeld; 3 testbestanden gecommit in bundels/ (bulk-copy bewust NIET gedaan, repo-grootte). **S4.8**: themadetail splitst thema_materiaal in gewoon materiaal / "🛒 KV koopt vers" (KV:-prefix gestript) / "ℹ️ Info" (INFO:-prefix gestript), secties tonen zich enkel als er regels zijn; GET /api/kv/:token/data levert nu ook `boodschappen` (KV:-regels van de gekoppelde thema's); KV-scherm krijgt een 5de tabblad "Boodschappen" (enkel als boodschappen.length>0) met lokaal-afvinkbare checkboxes (geen persistentie) + vaste voettekst (factuuradres); bewijs: "De bakkerij" (kookthema, 11 KV-regels) toont sectie in themadetail én 5de KV-tabblad, checkbox-tellers werken, verstuurbalk blijft verborgen op blok5; "Alles op wieltjes" (geen KV-regels) toont geen extra sectie/tabblad, exact 4 tabs. Alle admin-tabs + KV-pagina 0 console-errors (incl. stale-Service-Worker-cache omzeild met verse tab); 375px zonder horizontale scroll; 77 thema's/2194 item_types ongewijzigd; testkampmomenten (150/151) en testfoto's opgeruimd, thema-bundel-koppelingen blijven bewust staan als bewijs |
| 2026-08-04 | S4.5a–S4.5f gebouwd (themabehoefte aan pool-materiaal + blazerbehoefte + frame-herstructurering + generator/conflictdetectie-integratie) | gebouwd, review Fable volgt | Migratie 62 (tabel thema_behoefte; bakken.blazers_nodig + bakken.notitie; 3× themaframe aangemaakt; 5 "alleen frame"-attributen omgezet naar 1×themaframe-behoefte; 81 eerste behoefteregels uit bestaande INFO-teksten). CRUD /api/themas/:id/behoefte end-to-end herdraaid (create→list→update→delete→leeg); generator (`_themaBehoefteRegels`) hangt aan isEersteVanPeriode-levering/isLaatsteVanPeriode-ophaling, kiest vrije exemplaren zoals locConfigRegels, springkasteel/waterstructuur trekt automatisch zijn blazers_nodig + 1 gedeelde verlengdraadkoffer per levering mee (reviewfix tijdens bouw: dedup-bug gefixt — zelfde blazer werd 3× ingepland, nu met gebruikte-id-set); "Alles op wieltjes"-proef: levering/ophaling bevatten verkeerskoffer+17 kleuterfietsen+4 loopfietsen+5 loopwagens+2 zitfietsen+3 easy rollers+fietsparcours+1 blazer+1 verlengdraadkoffer, eind-ophaling neemt alles terug; Kleuterhindernisbaan geverifieerd op 2 blazers (apart scenario met tijdelijk verplaatste concurrenten, nadien teruggezet); conflicttype `pool_tekort` (S4.5e) getest met 2 kampmomenten die samen 2× compressor vragen tegen 1 beschikbaar → vuurt met locaties+week, verdwijnt bij verwijderen van één moment; blazer-piek-variant zit in dezelfde conflictblok (som per week als bovengrens, expliciete "verfijn met dagplanning"-melding, geen dagplanning-model aanwezig — gedocumenteerde beperking). Frame-herstructurering (S4.5c): "Frame (Circus Krokofant themadag)", "Frame (Op avontuur in de ruimte themadag)", "Frame grote piratenboot (themadag)", "Frame (School voor hekserij themadag)", "Frame (Sprookjesland themadag)" verwijderd, elk vervangen door 1×themaframe-behoefte op hun thema; combinatie-attributen ("Decor X: frame en/met doek", "Frame en themadoek Y") bewust NIET gesplitst (blijven als thema-eigen stuk staan) — eigen interpretatiekeuze, zie eindrapport. Alle admin-endpoints getest met echte curl-calls (Browser-tool bewust niet gebruikt, zie eindrapport) — 14 kern-routes 200; node -c server.js slaagt. 184 thema's/199 pool-eenheden(+3 themaframe)/85 attributen(−5)/81 thema_behoefte-rijen; alle testkampmomenten (155/156/157/158) en testbehoefte-rijen opgeruimd, telling geverifieerd vóór/na |
