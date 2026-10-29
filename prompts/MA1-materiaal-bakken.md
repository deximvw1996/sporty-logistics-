# PROMPT MA1 — MATERIAAL › BAKKEN op het standaardpagina-patroon (exacte kopie van de goedgekeurde mockup) + rek/plank per bak
**Chat C (Opus) · map `D:\Sporty\sporty-c` · branch `bouw-c` · poort 3303 · verslag `OVERLEG-c.md` · TIJDSLIMIET 3 uur**

Lees eerst `CLAUDE.md` in je map. Begin met `git fetch origin` en `git rebase origin/main` (GR1 en PL1 staan op main). Lees dan volledig:
1. `design/mockup-materiaal.html` — de goedgekeurde mockup (Maxim 30/10). Exact nabouwen: subbalk Thema's · Bakken · Pool · Catalogus, filterchips, kolommen code·naam / thema / waar nu / inhoud / stand, selectievakjes + bulk-voet (Etiketten printen · Verplaatsen · Aan thema koppelen · Verwijderen), detail met kop, knoppen (Bewerken · Etiket · Verplaatsen · Inhoud aanpassen), tabs Inhoud · Foto's · Waar geweest · Tellingen · Historiek, inhoud met ✕ en + Stuk, foto's, "waar is de bak" (nu / terug / thuis), historiek.
2. `design/PATROON-DEFINITIEF.html` + `design/DESIGN-BRIEF.md` "Scherm 5"; `OVERLEG-d.md` GEVONDEN van VC1 over rek/plank (werklijst 82).
3. `routes/bakken.js`, `routes/themas.js`, `lib/bulk.js` (pool/bulk), `routes/voorraad.js`, `lib/fotos.js`, en als voorbeeld jouw `routes/taken.js` + `public/taken.js`.

Je raakt ALLEEN: `public/bakken.html` + `public/bakken.js` + `public/bakken.css` (nieuw; laadt `patroon.css`), `routes/bakken-overzicht.js` (nieuw; één regel in `server.js`), `routes/bakken.js` (alleen Punt 1), `lib/migraties.js` (één migratie onderaan), `scripts/test-ma1-bakken.mjs`, `OVERLEG-c.md`, en in `routes/nakijken.js` uitsluitend de rek-afleiding van de aanvullijst (Punt 1). Bestaande API's verder NIET wijzigen; ontbreekt iets, dan GEVONDEN.

## Waarom deze prompt
Materiaal is de bron van elke levering en elke telling: wat zit in welke bak, waar staat die bak nu, en waar hoort hij thuis. Het nieuwe scherm maakt dat in één lijst zichtbaar en geeft de aanvullijst eindelijk een echte plaats per bak (rek en plank) in plaats van een afgeleide letter.

## Punt 1 — Rek en plank per bak, pool-plaats per stuk (werklijst 82)
- Migratie: `bakken.rek TEXT DEFAULT ''`, `bakken.plank TEXT DEFAULT ''`, `bakken.thuis_locatie_id INTEGER` (stockage, als dat veld nog niet bestaat; controleer), `item_types.pool_plaats TEXT DEFAULT ''` (bv. "rek P · bak P-03"). Backfill eenmalig: `rek` = eerste letter van de bakcode als die A–Z is; `thuis_locatie_id` = Rozenweg voor thema- en vaste bakken zonder thuis.
- `PUT /api/bakken/:id` accepteert `rek`, `plank`, `thuis_locatie_id` (alleenKantoor, gelogd); `GET /api/bakken` geeft ze mee. `GET /api/aanvullijst` (nakijken.js) gebruikt `rek`/`plank` en `pool_plaats` voor `waar_tekst` (fallback: de oude afleiding).

## Punt 2 — Eén databron: `GET /api/bakken-overzicht` (alleenKantoor)
`tellers {alle, thema, vast, attribuut, onderweg, incompleet, per_stockage{}}` en `bakken[]` met `{id, soort (thema|vast|attribuut|pool), code, naam, thema {id, naam}|null, waar_nu_tekst ("Abdijschool wk 1" / "Rozenweg · rek N plank 2" / "onderweg rit #23"), waar_nu {locatie_id|null, rit_id|null}, inhoud_tekst ("8 soorten · 41 stuks" / "1" / "12 stuks"), stand_tekst (uit de laatste telling: ok / tekort n / te veel n / kapot / niet geteld / besteld), status (ok|let)}`. Detail `GET /api/bakken/:id/detail`: `{bak, inhoud[{item_id, naam, qty, stand_tekst}], fotos[], waar {nu_tekst, nu_door, nu_op, terug_tekst, thuis_tekst}, waar_geweest[] (uit verhuis_checks/ritten: datum, locatie, rit, chauffeur), tellingen[] (nakijk_sessies van deze bak: datum, kv, uitslag), historiek[]}`.

## Punt 3 — De pagina `/bakken` (alleen kantoor)
Exacte kopie van de mockup, gevuld uit Punt 2. Subbalk: Thema's · Pool · Catalogus → bestaande tabbladen; Export (bestaand), 🖨 Etiketten (bestaande etiket-/printroute als die er is; anders een printbare pagina `/etiketten?ids=` met code, naam, thema, thuis-rek, in het patroon; meld in GEVONDEN wat je koos), + Nieuwe bak (overlay met code, naam, soort, thema, thuis, rek, plank). Filterchips + zoek (code, naam, inhoud, thema). Bulk: Etiketten printen, Verplaatsen (overlay: naar locatie of rek/plank → `PUT`), Aan thema koppelen (bestaande koppelroute), Verwijderen (409 als onderweg of met open telling). Detail: knoppen Bewerken (overlay met dezelfde velden), Etiket, Verplaatsen, Inhoud aanpassen (bestaande bak-items-routes: ✕ en + Stuk met zoekveld op item-types); tabs zoals de mockup; Foto's met + foto (`lib/fotos.js`). `?id=` opent dat detail.

## Bewijs
- `scripts/test-ma1-bakken.mjs` (via `_testhulp` op `herfst-test.db`, eigen poort): overzicht telt juist per soort; bak op een rit → `waar_nu_tekst` "onderweg rit #n"; bak gelost op locatie → locatie wk; bak thuis → "Rozenweg · rek N plank 2"; stand uit een KV-telling met tekort → "tekort 1"; `PUT rek/plank` gelogd en zichtbaar; aanvullijst gebruikt rek/plank; detail toont inhoud, waar geweest (minstens 2 regels na laden + lossen), tellingen, historiek; verwijderen van een bak onderweg → 409; `GET /bakken` → 200 met subbalk, 7 chips, voet; niet-kantoor → 403.
- Live in de browser op 1920×900: lijst, filters, detail, verplaats-overlay; vergelijk met de mockup; DOM-dump of screenshot.
- `node scripts/volle-run.mjs` 2×: alles groen + jouw test. Eindtabel in het verslag.
- Commit per punt, push `origin HEAD:bouw-c`. NOOIT naar main, NOOIT deploy.bat.
- Verslag onderaan `OVERLEG-c.md`: JSON-vorm, afwijkingen (hoort leeg te zijn), GEVONDEN. Laatste bericht eindigt met exact: **VOLLEDIG KLAAR MET DE PROMPT. NU IS HET TERUG AAN DE HOOFDCHAT.** Bij de tijdslimiet: stop, commit, "Stand bij tijdslimiet", push, en eindig met **TIJDSLIMIET BEREIKT: GESTOPT MET EEN TUSSENSTAND. NU IS HET TERUG AAN DE HOOFDCHAT.** Volgorde bij tijdnood: 1, 2, dan 3.
