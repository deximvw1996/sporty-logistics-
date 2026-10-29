# PROMPT KD1 — KLEINE DINGEN KANTOOR: "Volgende week" op Vandaag als deze week leeg is (werklijst 96) + Nakijken toont ook bakken zonder telling (werklijst 73)
**Chat D (Sonnet) · map `D:\Sporty\sporty-d` · branch `bouw-d` · poort 3304 · verslag `OVERLEG-d.md` · TIJDSLIMIET 1,5 uur**

Lees eerst `CLAUDE.md`. Begin met `git fetch origin` en `git rebase origin/main` (AF1 staat op main; 7655e9d). Lees dan: `routes/vandaag.js` (blok `deze_week`, rond regel 184, en `cijfers.locaties_open`), `public/vandaag.js` (vak "Deze week", rond regel 47; `n-week`, `l-week`), `design/KANTOOR-DEFINITIEF.html` (het vak Deze week), `routes/nakijken.js` (`GET /api/nakijken`, regel 109, en de sessie-opzoekfuncties rond regel 79), `public/nakijken.js` (lijst + chips), `design/mockup-voorraad-nakijken.html`.

Je raakt ALLEEN: `routes/vandaag.js`, `public/vandaag.js`, `routes/nakijken.js`, `public/nakijken.js`, `scripts/test-kd1-kleine-dingen.mjs`, `OVERLEG-d.md`. Beeld blijft exacte kopie van de ontwerpen; NIET `ritplanning.js` (chat C).

## Punt 1 — Vandaag: "Volgende week" als deze week leeg is (werklijst 96)
Maxim keek op donderdag 29 okt, de kampweek begint ma 2 nov: het vak zei "Deze week · 0 locaties · Geen open locaties deze week". Dat is juist maar verwarrend.
- `GET /api/vandaag` krijgt naast `deze_week` ook `volgende_week` (zelfde vorm, de kampmomenten van ma–zo erna) en `week_label` = "Deze week" als `deze_week` niet leeg is, anders "Volgende week" (als die wél iets heeft), anders "Deze week".
- Het vak toont de lijst die bij `week_label` hoort, met de koptekst eruit ("VOLGENDE WEEK · 8 LOCATIES"); de dagen per locatie blijven zoals nu. `cijfers.locaties_open` blijft "deze week" (de teller rechtsboven telt open locaties nu). Niets anders aan het beeld.

## Punt 2 — Nakijken toont ook bakken waar de KV nog niet aan begon (werklijst 73)
Nu toont `GET /api/nakijken` alleen bakken met een nakijk-sessie. Kantoor moet zien welke bakken van een kampmoment nog helemaal niet geteld zijn.
- Per kampmoment van de actieve periode: alle verwachte bakken (dezelfde bron als de KV-pagina, `_kvVerwacht`), en voor bakken zonder sessie een rij met status `nog_niet` ("nog niet geteld"), zonder regels; tellers krijgen `nog_niet`.
- In `/nakijken`: chip "Nog niet geteld" naast de bestaande chips (zelfde stijl), rijen in de lijst grijs met de tekst "nog niet geteld · <KV-naam>"; klikken opent het detail met de verwachte inhoud (aantallen uit de bakdefinitie) en de hint "De KV heeft deze bak nog niet geteld". Geen keuren-knoppen op zo'n rij (niets te keuren).
- Let op: filter altijd op `kampmoment_id` (TF2-GEVONDEN: een bak komt op meerdere kampmomenten voor).

## Bewijs
- `scripts/test-kd1-kleine-dingen.mjs` (via `_testhulp` op `herfst-test.db`, eigen poort): met "vandaag" vóór de kampweek → `week_label` "Volgende week" en `volgende_week.length` > 0; in de kampweek → "Deze week"; `GET /api/nakijken` bevat voor een kampmoment met 1 getelde en 2 ongetelde bakken 3 rijen waarvan 2 `nog_niet`, tellers kloppen; DOM-bouw: chip aanwezig, grijze rij, detail zonder keuren-knoppen.
- Volle run 2× groen. Commit per punt, push `origin HEAD:bouw-d`. NOOIT naar main, NOOIT deploy.bat. Verslag onderaan `OVERLEG-d.md`. Laatste bericht eindigt met exact: **VOLLEDIG KLAAR MET DE PROMPT. NU IS HET TERUG AAN DE HOOFDCHAT.** Bij de tijdslimiet: stop, commit, "Stand bij tijdslimiet", push, **TIJDSLIMIET BEREIKT: GESTOPT MET EEN TUSSENSTAND. NU IS HET TERUG AAN DE HOOFDCHAT.** Volgorde bij tijdnood: 1, 2.
