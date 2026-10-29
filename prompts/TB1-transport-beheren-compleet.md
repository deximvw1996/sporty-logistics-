# PROMPT TB1 — TRANSPORT BEHEREN COMPLEET: bundelen, ontkoppelen, splitsen, kapotte attributen, patroon-CSS samenvoegen
**Chat D (Sonnet) · map `D:\Sporty\sporty-d` · branch `bouw-d` · poort 3304 · verslag `OVERLEG-d.md` · TIJDSLIMIET 2,5 uur**

Lees eerst `CLAUDE.md` in je map. Begin met `git fetch origin` en `git rebase origin/main` (TR1 en VC1 staan op main). Lees dan: `routes/transport.js` (splits, bulk-move, bulk-ontkoppel, `PUT /api/transport-taken/:id/rit`, de RP1-route `POST /api/ritten/:id/taken/:taakId/ontkoppel`), `routes/taken.js` + `public/taken.js` (TR1; de uitgeschakelde knop Bundelen), `routes/nakijken.js` (jouw VC1), `public/patroon.css`, `public/nakijken.css`, `OVERLEG-c.md` (GEVONDEN van RP1 en TR1) en `OVERLEG-d.md` (GEVONDEN van VC1).

Je raakt ALLEEN: `routes/transport.js` (Punt 1 en 2), `routes/taken.js` + `public/taken.js` (knop Bundelen activeren), `routes/nakijken.js` + `routes/kv.js` (Punt 4), `public/kv.js` (Punt 4, één sectie), `public/patroon.css` + `public/nakijken.css` (Punt 5), `scripts/test-tb1-transport.mjs`, `OVERLEG-d.md`. Geen nieuwe pagina's.

## Waarom deze prompt
Maxim (29/10): "het plannen en beheren van transporten moet echt goed werken". De bouwchats vonden bij RP1, TR1 en VC1 vijf gaten in de keten. Deze prompt dicht ze, elk met bewijs, zodat de generale repetitie met de echte herfstplanning op een sluitende keten draait.

## Punt 1 — Bundelen (werklijst 80)
`POST /api/transport-taken/bundel {taak_ids:[…]}` (alleenKantoor): alle taken moeten dezelfde `datum`, hetzelfde `type` en dezelfde `naar_locatie_id` (bij ophaling: `van_locatie_id`) hebben, en geen enkele regel mag al geladen zijn (anders 409 met uitleg welke taak); het resultaat is één taak (de oudste blijft, met de vroegste tijd), de regels van de andere worden eraan gehangen (`transport_regels.taak_id`), bestaande checks mee verhuisd, de rit van de blijvende taak blijft, de andere taken krijgen status `geannuleerd` met opmerking "gebundeld in #<id>" (niet verwijderd: omkeerbaar), alles via `updateMetLog`/`insMetLog`, plus één `activiteiten_log`-regel. Omgekeerd blijft splitsen de weg terug. In `/taken` wordt de knop Bundelen actief bij ≥ 2 geselecteerde taken; bij een 409 toont de toast de servertekst.

## Punt 2 — Ontkoppelen zonder dataverlies (GEVONDEN RP1)
De oude routes `PUT /api/transport-taken/:id/rit` met `rit_id:null` en `POST /api/transport-taken/bulk-ontkoppel` wissen de datum en controleren niet op geladen stukken. Maak ze gelijk aan de RP1-route: datum en tijd blijven, 409 als er al geladen is, log met context. De RP1-route mag intern dezelfde functie gebruiken (één `_ontkoppelTaak`).

## Punt 3 — Splitsen bewezen met echte stops
De splits-route is nooit live getest met een stop van meerdere regels (GEVONDEN RP1). Test: taak met 3 regels op een rit → splits 1 regel af naar een nieuwe datum → nieuwe taak zonder rit met die regel en zijn check, oude taak houdt 2 regels, bezetting van de rit daalt; splitsen van een geladen regel → 409. Herstel wat niet klopt, met minimale wijziging.

## Punt 4 — Kapotte attributen krijgen een kantoor-actie (werklijst 81) + meldingen van kantoor op de KV-pagina
Als de KV een attribuut als beschadigd meldt (`POST /api/kv/:token/attributen/:attrId/status`), maak dan óók een `nakijk_regel` aan in de sessie van dat attribuut (item_naam = attribuutnaam, verwacht 1, aangetroffen 1, kapot_aantal 1) zodat Nakijken er een actie aan kan hangen en de aanvullijst het toont. Op de KV-pagina (`public/kv.js`, tab Aanvragen) komt onder "Mijn aanvragen" een sectie "Berichten van kantoor" met `meldingen_kantoor` (herinnering, notitie), zelfde stijl als meldingen chauffeur; de brief laat dit toe als aanvulling (geen nieuw scherm).

## Punt 5 — Eén patroon-CSS
`public/nakijken.css` bevat de patroonregels nog eens; verwijder ze daar en laad `patroon.css` vóór `nakijken.css` (zoals vandaag/ritplanning/taken). Het beeld van `/nakijken` mag niet veranderen: bewijs met dezelfde computed-style-hash-methode als chat C bij TR1 (zie OVERLEG-c.md), of een DOM-dump vóór/na.

## Bewijs
- `scripts/test-tb1-transport.mjs` (via `_testhulp` op `herfst-test.db`, eigen poort): bundel 3 leveringen zelfde dag/bestemming (één op een rit) → één taak met 5 regels op die rit, 2 taken geannuleerd "gebundeld in", log; bundel met verschillende bestemming → 409; bundel met een geladen regel → 409; ontkoppel via de oude route → datum blijft, geladen → 409; splits-scenario van Punt 3; attribuut beschadigd via KV → nakijk_regel bestaat, Nakijken toont kapot met actie-select, aanvullijst toont de handeling; herinnering → `meldingen_kantoor` in kv-data en op de pagina (DOM-bouw met echte data); `/nakijken` laadt `patroon.css`.
- `node scripts/volle-run.mjs` 2×: alles groen + jouw test. Eindtabel in het verslag.
- Commit per punt, push `origin HEAD:bouw-d`. NOOIT naar main, NOOIT deploy.bat.
- Verslag onderaan `OVERLEG-d.md` met per punt wat er veranderde en het bewijs; GEVONDEN. Laatste bericht eindigt met exact: **VOLLEDIG KLAAR MET DE PROMPT. NU IS HET TERUG AAN DE HOOFDCHAT.** Bij de tijdslimiet: stop, commit, "Stand bij tijdslimiet", push, en eindig met **TIJDSLIMIET BEREIKT: GESTOPT MET EEN TUSSENSTAND. NU IS HET TERUG AAN DE HOOFDCHAT.** Volgorde bij tijdnood: 1, 2, 3, 4, dan 5.
