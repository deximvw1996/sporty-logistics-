# PROMPT V2b — KV-SESSIES PER KAMPMOMENT, KALENDER EN PLANNER-KIEZER DYNAMISCH
**Chat B (Opus) · map `D:\Sporty\sporty-b` · branch `bouw-b` · poort 3302 · verslag `OVERLEG-b.md` · TIJDSLIMIET 2 uur**

Lees eerst `CLAUDE.md` in je map. Begin met `git fetch origin` en `git rebase origin/main` (V2 en V3d zijn gemerged). Je raakt ALLEEN `lib/migraties.js` (nieuwe migratie onderaan), `routes/kv.js`, `routes/voorraad.js`, `routes/planning.js` (alleen `/api/kalender`), `index.html` (alleen `setPlannerPeriode`, `_activePeriode` en het kalenderscherm), `scripts/test-keten-kv-periode.mjs` (nieuw), `scripts/testdata/maak-testdb.mjs` en `OVERLEG-b.md`.

## Waarom deze prompt
Jouw eigen "Buiten mijn gebied" van V2: `nakijk_sessies` heeft alleen `locatie_id` + `week`, dus een herfst-KV op Abdijschool week 1 ziet en overschrijft de zomer-sessie van dezelfde locatie, en "versturen" dient die mee in. In de herfstweek (2–8 nov) is dat een echte fout zodra de zomerplanning nog in de database staat. Daarnaast hardcodeert de kalender juli–augustus en zet de periode-kiezer in de transportplanner de actieve periode alleen lokaal.

## Punt 1 — Sessies aan het kampmoment (werklijst 64; B-R11)
- Migratie: kolom `nakijk_sessies.kampmoment_id INTEGER` + index; backfill: het kampmoment met dezelfde `locatie_id` en `week` in de actieve periode, anders in eender welke periode als er maar één is, anders NULL (log het aantal per geval).
- `routes/kv.js`: elke zoek- en schrijfactie op sessies (±r.12, 68, 100, 112) gaat op `kampmoment_id` van het kv-token, nooit meer op `locatie_id+week`. Een nieuwe sessie krijgt het kampmoment_id mee.
- `routes/voorraad.js` (±r.166) en de tekortenlijst: kampmoment via `kampmoment_id`; de lijst toont standaard alleen sessies van kampmomenten in de actieve periode (`?periode_id=` om een andere te zien).
- Oude sessies met NULL (geen kampmoment te vinden) blijven bestaan maar verschijnen onder een kop "zonder kampmoment" in de tekortenlijst, zodat niets stil verdwijnt.

## Punt 2 — Kalender en planner-kiezer (werklijst 65)
- `GET /api/kalender` berekent de dagen uit de actieve periode (of `?periode_id=`), niet uit een vast juli–augustus; weeknummers blijven 1..max_weken van die periode.
- `setPlannerPeriode` in index.html roept `POST /api/periodes/:id/activeer` aan en herlaadt de periodes, zodat de topbalk na F5 klopt; `_activePeriode()` verliest de "Zomer 2026"-terugval (geen periode → lege staat met de melding "Maak eerst een vakantieperiode aan").

## Bewijs
- `scripts/test-keten-kv-periode.mjs` (op `herfst-test.db` via `_testhulp`): zomer-kampmoment en herfst-kampmoment op dezelfde locatie+week, beide met KV; herfst-KV telt en verstuurt → alleen de herfst-sessie verandert, de zomer-sessie blijft onaangeroerd; tekortenlijst standaard alleen herfst; `?periode_id=1` toont zomer; kalender voor herfst geeft dagen in november.
- Volle run 2×, eindtabel in het verslag.
- Commit per punt, push `origin HEAD:bouw-b`. NOOIT naar main, NOOIT deploy.bat.
- Verslag onderaan `OVERLEG-b.md`; laatste bericht eindigt met exact: **VOLLEDIG KLAAR MET DE PROMPT. NU IS HET TERUG AAN DE HOOFDCHAT.** Bij de tijdslimiet: stop, commit, "Stand bij tijdslimiet", push, en eindig met **TIJDSLIMIET BEREIKT: GESTOPT MET EEN TUSSENSTAND. NU IS HET TERUG AAN DE HOOFDCHAT.** Punt 1 eerst.
