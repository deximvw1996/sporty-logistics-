# PROMPT GF1 — GATEN UIT DE GENERALE REPETITIE DICHTEN (rest-taak, Vandaag, logging KV, coördinator-login, weekend, opruimen, generator)
**Chat D (Sonnet) · map `D:\Sporty\sporty-d` · branch `bouw-d` · poort 3304 · verslag `OVERLEG-d.md` · TIJDSLIMIET 3 uur**

Lees eerst `CLAUDE.md` in je map. Begin met `git fetch origin` en `git rebase origin/main` (GR1 en PL1 staan op main). Lees dan `OVERLEG-c.md`, het GR1-verslag: de 8 stappen en de **14 GEVONDEN**; dat is je opdracht. Lees ook `scripts/generale-repetitie.mjs` en `scripts/test-gr1-keten.mjs` (die moeten na jouw werk zonder OVERGESLAGEN draaien) en de betrokken routes (`transport.js`, `vandaag.js`, `kv.js`, `planning.js`, `personeel.js`, `ritplanning.js`).

Je raakt ALLEEN: `routes/transport.js`, `routes/vandaag.js` + `public/vandaag.js`, `routes/kv.js`, `routes/personeel.js`, `routes/ritplanning.js` + `public/ritplanning.js`, `routes/planning.js` (alleen de generator-punten), `lib/migraties.js` (één migratie onderaan), `scripts/generale-repetitie.mjs` + `scripts/test-gr1-keten.mjs` (aanpassen aan de fixes; gaten die gedicht zijn worden gewone controles), `scripts/test-gf1-gaten.mjs`, `OVERLEG-d.md`. Geen nieuwe pagina's; bestaande schermen blijven exacte kopieën van hun ontwerp (alleen inhoud erbij waar het ontwerp dat al toont).

## Waarom deze prompt
De generale repetitie op de zomerdata (GR1) liep door alle 8 stappen, maar vond 14 gaten. Maxim gaat dit draaiboek zelf doen op prod met zijn gsm; vóór die tijd moeten de gaten dicht die hem zouden laten vastlopen. Nummers verwijzen naar GEVONDEN in OVERLEG-c.md.

## Punt 1 — Rest-taak krijgt datum en week (gat 2, KRITIEK)
Bij "past niet" (`…/checks/:checkId/niet-mee`) krijgt de rest-taak `datum` = datum van de rit en `week` = kampweek van die datum (zelfde afleiding als de generator), zodat hij in `/taken` en op Vandaag › Inplannen staat. Bestaande rest-taken zonder datum: migratie vult ze uit hun `rest_van_rit_id`.

## Punt 2 — Vandaag compleet (gaten 1 en 4)
`GET /api/vandaag`: `ritten_vandaag` krijgt een tweede lijst `ritten_morgen` (de pagina toont die onder "Ritten vandaag" als "Morgen" met dezelfde rijstijl; het ontwerp heeft een "Ritten vandaag"-vak, dus dit is inhoud erbij, geen nieuw vak). `nakijken[]` krijgt ook: "N tellingen te keuren" (ingediend, niet nagekeken) en "M bakken niet geteld van afgelopen kampweek", elk met Open → `/nakijken`.

## Punt 3 — KV-tellingen in de historiek (gat 12)
`routes/kv.js`: tellen, attribuut-status, versturen, aanvraag en kapot schrijven via `insMetLog`/`updateMetLog` met context `kv-link` en de KV-naam als `wie`, zodat ze in `wijzigingen` staan en omkeerbaar zijn. Nakijken › Historiek toont ze dan vanzelf.

## Punt 4 — Coördinator als rol met pincode (gat 5)
`personeel.rol` krijgt de waarde `coordinator` erbij (naast kantoor, chauffeur, monitor); `POST/PUT /api/personeel` accepteert ze; pincode zetten werkt voor elke rol; een coördinator mag: inloggen, `/api/aanvullijst` + afvinken, rit-link-acties als bestuurder, `GET /api/vandaag?mijn=1` (alleen eigen ritten/handelingen; geen kantoor-lijsten) → 200, en krijgt 403 op kantoor-routes. De RP1-afleiding `bestuurder_rol` gebruikt deze rol.

## Punt 5 — Weekendbevestiging bewaren (gat 6)
`transport_taken.weekend_bevestigd_door TEXT DEFAULT ''`, `weekend_bevestigd_op TEXT DEFAULT ''`; `POST /api/transport-taken/:id/weekend-bevestig` (alleenKantoor, gelogd); de ritplanning-pagina roept die aan na de vraagModal; een weekendtaak zonder bevestiging houdt de waarschuwing "weekend · nog niet bevestigd", mét bevestiging "weekend · bevestigd door <naam>".

## Punt 6 — Opruimen volledig (gat 8) en Marko (gat 9)
Elke tabel waarin het seed-script rijen achterlaat krijgt een verwijderroute of het script verwijdert via bestaande routes (verhuis_checks, nakijk_sessies/regels, aanvragen, activiteiten_log-regels mogen blijven maar worden gemarkeerd FICTIEF). Na `--opruimen` zijn de rijtellingen per tabel gelijk aan vóór de opbouw, behalve `wijzigingen` en `activiteiten_log` (dat is het logboek). Het script gebruikt de echte stockage-naam ("Marko" bestaat; geen "Marco" aanmaken).

## Punt 7 — Generator: ophalingen op de laatste kampdag, themadag-levering (gat 10)
`POST /api/transport-genereer`: de ophaling komt op de laatste open dag van het kampmoment (vr 6 nov), niet de maandag erna; een themadag-locatie krijgt één levering met het materiaal van alle 5 dagen en één ophaling. De bestaande keten-tests mogen hierdoor niet rood worden (pas verwachtingen alleen aan als ze de oude, verkeerde dag eisten; meld dat).

## Punt 8 — Kookdagen per kampmoment (gat 11)
PL1 heeft `kampmomenten.kookdagen`; de generator gebruikt die (oven mee als er kookdagen zijn en de locatie geen eigen oven heeft) in plaats van `thema.heeft_kookactiviteit`; het seed-script zet kookdagen wo/do op 3 locaties.

## Bewijs
- `scripts/test-gf1-gaten.mjs` (via `_testhulp` op `herfst-test.db`, eigen poort): per punt één of meer controles (rest-taak met datum/week in `/taken` en Vandaag; `ritten_morgen` en nakijken-regels op Vandaag; KV-telling in `wijzigingen` met context kv-link; coördinator logt in, 200 op aanvullijst, 403 op `/api/vandaag` zonder `mijn=1`; weekend-bevestig bewaart naam en de waarschuwingstekst verandert; generator zet de ophaling op de laatste kampdag en maakt één themadag-levering; kookdagen sturen de oven mee).
- `GR1=1 node scripts/test-gr1-keten.mjs` (lokaal, op de werkmap-db): **0 OVERGESLAGEN** voor de gaten 1, 2, 4, 5, 6, 8, 9, 10, 11; de rest (3, 7, 13, 14) blijft als informatie in het verslag.
- `node scripts/volle-run.mjs` 2×: alles groen + jouw test. Eindtabel in het verslag.
- Commit per punt, push `origin HEAD:bouw-d`. NOOIT naar main, NOOIT deploy.bat, NOOIT `--doel=prod`.
- Verslag onderaan `OVERLEG-d.md`: per gat wat er veranderde en het bewijs; GEVONDEN. Laatste bericht eindigt met exact: **VOLLEDIG KLAAR MET DE PROMPT. NU IS HET TERUG AAN DE HOOFDCHAT.** Bij de tijdslimiet: stop, commit, "Stand bij tijdslimiet", push, en eindig met **TIJDSLIMIET BEREIKT: GESTOPT MET EEN TUSSENSTAND. NU IS HET TERUG AAN DE HOOFDCHAT.** Volgorde bij tijdnood: 1, 2, 3, 4, 5, 6, 7, dan 8.
