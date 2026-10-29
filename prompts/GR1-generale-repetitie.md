# PROMPT GR1 — GENERALE REPETITIE: fictieve herfstplanning uit de zomerdata, de hele keten doorlopen, draaiboek voor Maxim
**Chat C (Opus) · map `D:\Sporty\sporty-c` · branch `bouw-c` · poort 3303 · verslag `OVERLEG-c.md` · TIJDSLIMIET 3 uur**

Lees eerst `CLAUDE.md` in je map. Begin met `git fetch origin` en `git rebase origin/main` (TR1, VC1 en de vier kernschermen staan op main). Lees dan: `DRAAIBOEK.md` (fases 3 t/m 9: de echte werkwijze), `routes/planning.js` (periodes, kampmomenten, thema's koppelen, kv-token), `routes/transport.js` (`POST /api/transport-genereer`, ritten, klaarzet, rit-token), `routes/ritplanning.js`, `routes/kv.js`, `routes/nakijken.js`, `scripts/_testhulp.mjs` en `scripts/testdata/maak-testdb.mjs` (hoe de testdb gebouwd wordt), en `data/materiaallijst_foto*.json` (de echte zomer-materiaallijst; prod heeft die al geïmporteerd: 184 thema's, 3331 item-types, 41 locaties, 12 personen, 1 periode "Zomer 2026", 0 kampmomenten).

Je raakt ALLEEN: `scripts/generale-repetitie.mjs` (nieuw), `scripts/test-gr1-keten.mjs` (nieuw), `GENERALE-REPETITIE.md` (nieuw, in de root), `OVERLEG-c.md`. Routes en pagina's raak je NIET; elk gat dat je tegenkomt gaat in GEVONDEN (met de exacte stap waar het misging). Dat is juist de bedoeling van deze prompt.

## Waarom deze prompt
Maxim (29/10): "het inplannen van kampmomenten en het plannen en beheren van transporten moet echt goed werken". Hij kent de echte herfstplanning niet; we nemen een week uit de zomerplanning als fictieve herfst (2 tot 8 november 2026). Deze prompt zet die data neer, loopt de hele keten door zoals de vzw het doet, en levert Maxim een draaiboek om het zelf op prod en op zijn gsm te doen.

## Punt 1 — `scripts/generale-repetitie.mjs --doel=lokaal|prod [--opruimen]`
- `--doel=lokaal`: start zelf een server via `_testhulp.startServer` op een verse kopie van **`sporty.db` uit de werkmap** (niet herfst-test.db: we willen de echte thema's en locaties) en voert alles via de API uit. `--doel=prod`: gebruikt `https://sporty-logistics-production.up.railway.app` met Basic `sporty:<APP_PASSWORD uit env SPORTY_PROD_PW>` en login persoon 10 pincode 1111. Alles wat het script aanmaakt krijgt de tekst **"FICTIEF"** in naam of opmerking, zodat `--opruimen` het weer exact kan verwijderen (en niets anders).
- Maakt (idempotent: bestaat het al met dezelfde FICTIEF-naam, dan hergebruiken): periode **"Herfst 2026 FICTIEF"** 2026-11-02 t/m 2026-11-08, 1 kampweek, en activeert ze (bewaar welke periode actief was en zet die bij `--opruimen` terug).
- Kiest **8 kamplocaties** uit de bestaande 41 (voorkeur: Abdijschool Vlierbeek, Boutersem, Betekom, Rotselaar, Kraal, Waaier, Ark, Sportschuur, of de dichtstbijzijnde namen die bestaan) + de drie stockageplaatsen Rozenweg, Kantoor, Marco (bestaan ze niet als stockage, GEVONDEN en aanmaken met FICTIEF).
- Maakt per locatie een **kampmoment** week 1, ma–vr, met een **thema** uit de bestaande lijst (4 kleuter-, 4 lagere-schoolthema's; 2 locaties krijgen 2 thema's omdat ze twee leeftijdsgroepen hebben; 1 locatie is een themadag-locatie met 5 thema's op dag 0–4 als dat type bestaat), **kookdagen** wo/do op 3 locaties, en een **KV** per kampmoment: 8 coördinatoren uit het bestaande personeel; zijn er te weinig, maak ze aan als "KV <naam> FICTIEF" met telefoon en pincode 1111. Zorg dat 3 chauffeurs bestaan (anders aanmaken, FICTIEF) en de voertuigtypes Camionette en Camion.
- **Transport genereren** via `POST /api/transport-genereer` (leveringen vr 30 okt / ophalingen vr 6 nov) en de voorstellen aannemen; daarna **ritten plannen** via de RP1-routes: 3 ritten op vrijdag 30 okt (Jan Bestelwagen 2, Piet Camion, Sam Bestelwagen 1), taken verdelen op bestemming, één stop per rit op `vrij`, bewust één rit over capaciteit (de waarschuwing moet verschijnen), één coördinator met huurwagen op een vierde rit; ophaalritten vr 6 nov; één weekendtaak (sportdag za 7 nov). Alle ritten **klaarzetten** en rit-tokens aanmaken; kv-tokens voor alle kampmomenten.
- Print aan het einde een **overzicht**: per locatie thema/KV/KV-link, per rit chauffeur/voertuig/stops/rit-link, en de tellers van `/api/vandaag` op 2026-11-02. Bewaar dat als `GENERALE-REPETITIE-links.json` (gitignored: voeg toe aan .gitignore).

## Punt 2 — De keten doorlopen: `scripts/test-gr1-keten.mjs` (lokaal, op het resultaat van Punt 1)
Speel als de vzw, in deze volgorde, en controleer na elke stap de data én de pagina's (`/vandaag`, `/ritplanning`, `/taken`, `/nakijken`, `/rit/:token`, `/kv/:token` via hun data-JSON en DOM-bouw zoals de eerdere tests):
1. Donderdag: kantoor ziet op Vandaag de 3 leveringsritten van morgen en 0 beslissingen.
2. Vrijdag: chauffeur Jan laadt in de Rozenweg via de rit-link (alle stukken), meldt bij stop 2 "past niet" voor 1 bak → rest-taak verschijnt in `/taken` en op Vandaag onder Inplannen; wisselt zijn twee vrije stops; komt aan, lost, rit gedaan. Piet rijdt over capaciteit: waarschuwing zichtbaar in ritplanning. Lotte (coördinator, huurwagen) rijdt haar rit.
3. Kantoor zet de rest-taak op een nieuwe rit (vr 30 okt 15:00, Sam) en zet hem klaar.
4. Maandag: 8 KV's tellen (6 kloppen, 1 met tekort + notitie, 1 met kapot + foto + te veel), 1 KV telt niet; 2 KV's sturen een aanvraag (materiaal, kapot); 1 chauffeur meldt een probleem (gesloten).
5. Kantoor: Vandaag toont beslissen (2 aanvragen + 1 melding), nakijken (bakken te keuren + 1 niet geteld); keurt via `/nakijken` (bestellen, naar pool, afschrijven), stuurt herinnering aan de KV die niet telde, rondt af; aanvullijst bevat de handelingen; printlijst → 200.
6. Dinsdag: coördinator vinkt de aanvullijst af (API).
7. Vrijdag 6 nov: ophaalritten gereden, taken gedaan; weekendtaak za: bevestiging + rit.
8. Einde: `/api/conflicten` leeg behalve het bewust gemaakte capaciteitsconflict; `wijzigingen` heeft voor elke stap regels; `--opruimen` verwijdert alles met FICTIEF en laat de rest van de db identiek (tel rijen per tabel vóór/na).
Elke stap die niet kan via de bestaande API's of pagina's = **GEVONDEN met de exacte stap**; de test markeert hem als `OVERGESLAGEN (gat #n)` en gaat door.

## Punt 3 — `GENERALE-REPETITIE.md`: draaiboek voor Maxim op prod
Stap-voor-stap in gewone taal, met per stap: wie (kantoor desktop / chauffeur gsm / KV gsm), welk scherm, wat je doet, wat je moet zien. Begint met `node scripts/generale-repetitie.mjs --doel=prod` (met de env-variabele) en eindigt met `--opruimen`. Bevat de lijst met links uit Punt 1 als placeholders. Max. 2 pagina's.

## Bewijs
- `node scripts/generale-repetitie.mjs --doel=lokaal` → overzicht; `node scripts/test-gr1-keten.mjs` → alle 8 stappen groen of OVERGESLAGEN met gat-nummer; `--opruimen` → rijtellingen gelijk.
- `node scripts/volle-run.mjs` 2×: alles groen (jouw test hoort NIET in de volle run: hij draait op de werkmap-db en duurt lang; registreer hem niet).
- Commit per punt, push `origin HEAD:bouw-c`. NOOIT naar main, NOOIT deploy.bat, NOOIT `--doel=prod` zelf draaien (dat doet de hoofdchat na keuring).
- Verslag onderaan `OVERLEG-c.md`: de 8 stappen met uitslag, de lijst GEVONDEN (genummerd, met stap en voorstel), het overzicht. Laatste bericht eindigt met exact: **VOLLEDIG KLAAR MET DE PROMPT. NU IS HET TERUG AAN DE HOOFDCHAT.** Bij de tijdslimiet: stop, commit, "Stand bij tijdslimiet", push, en eindig met **TIJDSLIMIET BEREIKT: GESTOPT MET EEN TUSSENSTAND. NU IS HET TERUG AAN DE HOOFDCHAT.** Volgorde bij tijdnood: 1, 2 (stap 1–5 eerst), dan 3.
