# PROMPT T1 — TESTCHAT: de generale repetitie volledig doorlopen op PROD (vóór Maxim het zelf doet)
**Chat T (test) · map `D:\Sporty\sporty-t` (of je eigen testmap) · GEEN branch, GEEN code-wijzigingen · verslag `TESTVERSLAG-T1.md` · TIJDSLIMIET 2,5 uur**

Begin met `git fetch origin && git checkout origin/main` (lezen, niet bouwen). Lees `GENERALE-REPETITIE.md` (het draaiboek), `CLAUDE.md`, en `OVERLEG-c.md`/`OVERLEG-d.md` onderaan (GR1 + GF1: welke gaten gedicht zijn). Prod = `https://sporty-logistics-production.up.railway.app`, Basic `sporty:TestSporty`, kantoor-login persoon 10 pincode 1111. Op prod staat de fictieve herfst al klaar (periode "Herfst 2026 FICTIEF" is actief). Alle links (KV-links per locatie, rit-links per rit) krijg je door `SPORTY_PROD_PW=TestSporty node scripts/generale-repetitie.mjs --doel=prod` te draaien: het script is idempotent en print het overzicht opnieuw zonder iets dubbel te maken. NOOIT `--opruimen`.

## Opdracht
Speel het draaiboek van begin tot eind als de vzw, op prod, in de echte volgorde, en noteer per stap: wat je deed (welk scherm, welke knop of API), wat je zag, en of het klopt met wat het draaiboek belooft. Doe het op twee manieren tegelijk:
1. **Via de pagina's** in de in-app browser: desktop 1920×900 voor kantoor (`/vandaag`, `/ritplanning`, `/taken`, `/nakijken`, `/kampmomenten`, `/bakken`), telefoonbreedte 390 voor de rit-links (`/rit/<token>`) en KV-links (`/kv/<token>`). Let bij elk scherm op: horizontale scroll, afgesneden tekst, knoppen kleiner dan 36 px (desktop) of 44 px (gsm), foutmeldingen in de console, lege plekken waar data hoort, en of elke knop die je nodig hebt ook echt werkt.
2. **Via de API** waar de pagina het niet toont: `/api/vandaag`, `/api/ritplanning?week=`, `/api/taken-overzicht`, `/api/nakijken`, `/api/aanvullijst`, `/api/rit-token/<token>/data`, `/api/kv/<token>/data`, `/api/conflicten`.

De stappen (uit het draaiboek, met de dag erbij; prod denkt vandaag = 29 okt):
1. Kantoor Vandaag: morgen (vr 30 okt) 4 leveringsritten zichtbaar; Planning › Kampmomenten toont 8 kampmomenten met thema en KV; Materiaal › Bakken toont de bakken van die thema's met "waar nu".
2. Chauffeur Jeroen (rit-link rit #22, gsm): laden in de Rozenweg, "past niet" op 1 bak bij stop 2, wissel van de vrije stops, aankomen, lossen, rit gedaan. Daarna: kantoor ziet de rest-taak in Taken én op Vandaag › Inplannen; Ritplanning toont de capaciteitswaarschuwing.
3. Kantoor: rest-taak op een nieuwe rit (Ritplanning, "+ rit", vr 30 okt 15:00), klaarzetten, rit-link.
4. KV's (KV-links, gsm): 3 KV's tellen (1 klopt helemaal, 1 tekort + notitie, 1 kapot + foto + te veel), 1 KV telt niet; 1 aanvraag materiaal, 1 kapot melden; chauffeur meldt "gesloten" via een rit-link.
5. Kantoor: Vandaag › Beslissen toont de 3 items; Nakijken toont de tellingen; keur (bestellen, naar pool, afschrijven), herinnering naar de KV die niet telde, keuring afronden; printlijst `/aanvullijst-print` opent; aanvullijst-API bevat de handelingen.
6. Coördinator (log in als een FICTIEF-KV met pincode 1111 als die bestaat; anders als kantoor): aanvullijst afvinken via API.
7. Ophaalritten vr 6 nov: rit-links van rit #26 en #27 doorlopen (laden op locatie, lossen in de Rozenweg); weekendtaak za 7 nov: bevestiging in de Ritplanning.
8. Einde: `/api/conflicten` alleen de bewuste capaciteitsconflicten; Beheer › Logboek (als dat bestaat) of `/api/wijzigingen` toont regels voor elke stap.

## Verslag `TESTVERSLAG-T1.md`
Per stap: GROEN / ROOD / DEELS met wat je zag (letterlijke teksten, aantallen, URL's), screenshots of DOM-dumps waar het telt. Onderaan een genummerde lijst **GEVONDEN** (bug, ontbrekende knop, onduidelijke tekst, verkeerde telling, vormgeving) met per punt: stap, scherm, wat je verwachtte, wat er was, hoe te reproduceren. Rangschik op ernst (blokkeert Maxim / hinderlijk / cosmetisch). Verander geen code en ruim niets op; laat de data op prod staan zoals het na je run is (Maxim speelt daarna zelf; noteer wat hij door jouw run al "gedaan" zal zien). Commit alleen `TESTVERSLAG-T1.md` op een branch `test-t1` en push die (`git push origin HEAD:test-t1`). Laatste bericht eindigt met exact: **VOLLEDIG KLAAR MET DE PROMPT. NU IS HET TERUG AAN DE HOOFDCHAT.** Bij de tijdslimiet: stop, commit, en eindig met **TIJDSLIMIET BEREIKT: GESTOPT MET EEN TUSSENSTAND. NU IS HET TERUG AAN DE HOOFDCHAT.**
