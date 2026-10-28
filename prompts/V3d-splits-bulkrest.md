# PROMPT V3d — TAAK SPLITSEN/VERWIJDEREN NA LADEN, BULK OVERAL VIA ÉÉN FUNCTIE, GEEN alert() OP DE RIT-PAGINA
**Chat C (Opus) · map `D:\Sporty\sporty-c` · branch `bouw-c` · poort 3303 · verslag `OVERLEG-c.md` · TIJDSLIMIET 2 uur**

Lees eerst `CLAUDE.md` in je map. Begin met `git fetch origin` en `git rebase origin/main` (V1 testharnas van chat B is gemerged: `scripts/_testhulp.mjs`, `scripts/testdata/herfst-test.db`, `scripts/volle-run.mjs`, en de ketentests). Je raakt ALLEEN `routes/transport.js` (splits-route ±r.530, delete-route, rit-pagina-HTML), `routes/bakken.js` (verplaats + vaste-bak-aantal), `routes/kv.js` (alleen de catalogus-aanroep hieronder), `lib/bulk.js`, `scripts/test-keten-splits.mjs` (alleen als je contract afwijkt, met uitleg), `scripts/test-v3d-*.mjs` en `OVERLEG-c.md`. Chat B werkt tegelijk in `routes/transport.js` aan de generator-filters (periode) rond regels 40–350: blijf daar weg; conflict → rebase, beide kanten, melden.

## Waarom deze prompt
`scripts/test-keten-splits.mjs` (chat B, V1) is nog rood: na splitsen blijft de check van de afgesplitste regel aan de oude taak hangen, en een taak verwijderen na laden geeft 200 maar laat de bak voor altijd `onderweg` met tien verweesde checks. Daarnaast meldde je zelf (GEVONDEN V3a) dat `POST /api/bakken/:id/verplaats` en `PUT /api/vaste-bakken/:id` bulk nog kaal schrijven, buiten `verplaatsBulk` om, en dat de rit-pagina nog `alert()` gebruikt. Chat E vond dat transport.js de catalogus nog vult via `resolveItemTypeId(naam)` op vijf plekken. Dit is de laatste ketenronde vóór de herfstweek.

## Punt 1 — Splitsen en verwijderen (werklijst 18; B-F6/F7)
- `POST /api/transport-taken/:id/splits`: de `verhuis_checks` van de afgesplitste regels verhuizen mee naar de nieuwe taak (en naar diens rit als die er al is, anders `rit_id` null tot de taak aan een rit hangt). Geladen status van een regel reist mee. Resultaat: de oude taak wordt `onderweg`/`gedaan` op basis van zijn eigen regels alleen.
- `DELETE /api/transport-taken/:id` (en bulk-delete): een taak met geladen regels wordt geweigerd met 409 en een duidelijke tekst ("3 regels zijn al geladen: los ze eerst of zet de taak terug op gepland"); een taak zonder geladen regels verwijdert ook zijn checks (via `delMetLog`) en laat geen bak op `onderweg` achter. Kantoor kan een taak terugzetten op `gepland` (bestaande status-route): dat zet de geladen regels terug (bakken `thuis`, bulk via `verplaatsBulk` terug naar de van-locatie als er al verplaatst was) en wist de laad-vinkjes. Kies die twee lijnen (409 + terugzetten) en documenteer ze; de test aanvaardt beide varianten.
- Rit zonder taken na een delete wordt verwijderd (bestaand gedrag) mét zijn checks.

## Punt 2 — Bulk overal via `verplaatsBulk` (werklijst 58)
- `POST /api/bakken/:id/verplaats` voor een bulk-rij: body krijgt `aantal` (verplicht voor bulk, 400 zonder) en `van_locatie_id` (standaard: de plek met het grootste aantal buiten thuis, of thuis); roept `verplaatsBulk` aan; status/huidige_locatie_id worden afgeleid met `leidBulkStatusAf`.
- `PUT /api/vaste-bakken/:id` met een nieuw `aantal` (bezit): het verschil wordt op de thuislocatie bij- of afgeboekt in `bulk_spreiding` via één functie in `lib/bulk.js` (`zetBezit`), gelogd; nooit onder nul op thuis (409 met uitleg als er meer op locaties staat dan het nieuwe bezit).
- Na elke route: som van de spreiding = bezit (schrijf een `controleerSom(bakId)` in `lib/bulk.js` en roep hem in de tests aan).

## Punt 3 — Catalogus niet meer vullen vanuit transport (werklijst 24-rest; GEVONDEN E-1)
Alle vijf aanroepen `resolveItemTypeId(r.naam)`/`resolveItemTypeId(naam)` in `routes/transport.js` (POST transport-taken, POST transport-regels, checks-init, spoedtransport) en in `routes/aanvragen.js` (spoedtaak uit aanvraag, jouw code) worden `resolveItemTypeId(naam, undefined, false)`: zoeken mag, aanmaken niet. Een regel zonder bekend type houdt `item_type_id` null; niets anders verandert.

## Punt 4 — Geen `alert()` op de rit-pagina (werklijst 59, alleen het rit-deel)
De rit-pagina (`GET /rit/:token` in transport.js) krijgt één kleine toast-functie (onderaan het scherm, 3 s, groen/rood) en alle `alert(...)` daar gaan erdoor. De kv-pagina is niet van jou (werklijst 59 blijft deels open).

## Bewijs
- `scripts/test-keten-splits.mjs` van rood naar groen, 2×.
- `scripts/test-v3d-bulk.mjs` (gebruik `scripts/_testhulp.mjs` en `herfst-test.db`): handmatige verplaatsing bulk 5 stuks → spreiding klopt, som = bezit; bezit 17 → 20 → thuis +3; bezit 17 → 10 terwijl 12 op locatie → 409; verplaatsen zonder aantal → 400; `wijzigingen` heeft regels voor elke stap. Plus: transporttaak met regel "Bak Verkeerskoffer 1" → geen nieuw item_type.
- `node scripts/volle-run.mjs` 2×: alles groen behalve `keten-periode` (chat B, V2) als die nog loopt. Eindtabel in je verslag.
- Commit per punt, push `origin HEAD:bouw-c`. NOOIT naar main, NOOIT deploy.bat.
- Verslag onderaan `OVERLEG-c.md`; laatste bericht aan Maxim eindigt met exact: **VOLLEDIG KLAAR MET DE PROMPT. NU IS HET TERUG AAN DE HOOFDCHAT.** Bij de tijdslimiet: stop, commit, "Stand bij tijdslimiet", push, en eindig met **TIJDSLIMIET BEREIKT: GESTOPT MET EEN TUSSENSTAND. NU IS HET TERUG AAN DE HOOFDCHAT.** Volgorde bij tijdnood: punt 1, 2, 3, dan 4.
