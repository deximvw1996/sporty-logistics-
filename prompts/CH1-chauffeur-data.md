# PROMPT CH1 — CHAUFFEURSSCHERM, DEEL 1: DATA EN API (slots vast/vrij, volgorde, contacten, past-niet, probleem melden)
**Chat C (Opus) · map `D:\Sporty\sporty-c` · branch `bouw-c` · poort 3303 · verslag `OVERLEG-c.md` · TIJDSLIMIET 2 uur**

Lees eerst `CLAUDE.md` in je map en `design/CHAUFFEUR-DEFINITIEF.html` + `design/DESIGN-BRIEF.md` (scherm 1). Begin met `git fetch origin` en `git rebase origin/main`. Je raakt ALLEEN `lib/migraties.js` (nieuwe migratie onderaan), `routes/transport.js` (API-routes; de rit-pagina-HTML `GET /rit/:token` raak je NIET: chat D bouwt die daarna als exacte kopie van het ontwerp), `routes/locaties.js` (contactvelden), `routes/aanvragen.js` (probleem-melding), `scripts/test-ch1-*.mjs` en `OVERLEG-c.md`. `index.html` blijft dicht (kantoor-UI voor vast/vrij komt in het kantoor-ontwerp).

## Waarom deze prompt
Maxim keurde het chauffeursontwerp goed (29/10): een Dag-scherm met tijdlijn waarop kantoor per stop beslist of hij vast (🔒) of vrij is, en de chauffeur vrije stops met ▲▼ van plaats wisselt; een Stop-scherm met belbare contacten (KV + sleutelcontact van de locatie), rek-groepen met foto, geladen/gelost per stuk, "past niet / niet gevonden" per stuk (rest blijft open als nieuwe taak) en "probleem melden" per stop (naar kantoor én KV). De pagina zelf bouwt chat D; jij legt de data en de API's die zij nodig heeft, zodat D niets hoeft te verzinnen.

## Punt 1 — Stop-slot vast/vrij en volgorde (werklijst 69)
- Migratie: `transport_taken.slot TEXT DEFAULT 'vast'` (`vast`|`vrij`) en `transport_taken.volgorde INTEGER` (positie binnen de rit; backfill: volgorde op `tijd`, dan id). Bestaand gedrag ongewijzigd (alles vast).
- `PUT /api/transport-taken/:id` accepteert `slot` (alleenKantoor). `GET /api/ritten/:id` en de rit-token-data geven per taak `slot`, `volgorde`, `tijd` mee.
- `POST /api/rit-token/:token/taken/:taakId/wissel {richting:'omhoog'|'omlaag'}`: wisselt de taak van plaats met de aangrenzende taak in die richting, ALLEEN als beide `vrij` zijn (anders 409 met uitleg "Abdijschool staat vast door kantoor"); de tijden van de twee taken worden omgewisseld (de tijdslots blijven, de stops wisselen); gelogd via `updateMetLog` met context `rit-link` + een regel in `activiteiten_log` "chauffeur wisselde stop X en Y" zodat kantoor het ziet.
- De rit-generator en het aanmaken van taken zetten `slot='vast'` standaard; kantoor kiest later vrij (UI volgt).

## Punt 2 — Contacten per locatie en KV (werklijst 47, deel)
- Migratie: `locaties.contact_naam`, `locaties.contact_telefoon`, `locaties.sleutel_info` (TEXT, leeg standaard) + `locaties.adres` als die ontbreekt (controleer).
- `PUT /api/locaties/:id` accepteert ze (alleenKantoor); `GET /api/locaties` geeft ze mee; export laat `contact_telefoon` en `sleutel_info` WEG (gevoelig, DRAAIBOEK 3.7).
- Rit-token-data (`GET /api/rit-token/:token/data` of hoe de rit-pagina zijn gegevens nu leest; maak één JSON-route als die er niet is, zodat D een nette bron heeft): per stop `locatie {naam, adres, contact_naam, contact_telefoon, sleutel_info}` en `kv {naam, telefoon}` (de KV uit `kampmomenten.kv_persoon_id` → `personeel`; voeg `personeel.telefoon` toe als die kolom ontbreekt).

## Punt 3 — Per stuk: foto, rek, "past niet / niet gevonden" (werklijst 2.6, 3.3 draaiboek)
- Rit-token-data per check-regel: `foto_url` (bak: `foto_opgeplooid`-URL als die er is; attribuut: `foto_path`; anders null), `rek` (eerste letter van de bakcode zoals de huidige `_rekVan`), `code`, `naam`, `qty`, `geladen`, `gelost`, `aantal_geladen` voor bulk.
- `POST /api/rit-token/:token/checks/:checkId/niet-mee {reden:'past_niet'|'niet_gevonden'|'kapot', opmerking}`: markeert de regel (`niet_mee_reden`, nieuwe kolom op `verhuis_checks`), zet hem NIET op geladen, en maakt (of vult aan) één **rest-taak** voor dezelfde rit-bestemming met status `gepland`, zonder rit, `slot='vrij'`, opmerking "Rest van rit #<id>: <reden>", met die regel erin (gebruik de bestaande splits-logica van V3d waar het kan). Kantoor ziet die rest-taak in Transport. Bulk: `aantal` meegeven, de rest = qty − geladen.
- Terugdraaien: dezelfde route met `{reden:null}` haalt de markering weg en verwijdert de regel weer uit de rest-taak (lege rest-taak wordt verwijderd).

## Punt 4 — Probleem melden per stop (werklijst 46)
- `POST /api/rit-token/:token/taken/:taakId/probleem {soort:'gesloten'|'past_niet_lokaal'|'anders', tekst, foto_data}`: maakt een `aanvragen`-rij met `soort='probleem_chauffeur'`, `kampmoment_id` van de taak, tekst "Chauffeur <naam> bij <locatie>: <soort> — <tekst>", foto via `lib/fotos.js`, status `nieuw`. Zichtbaar in de bestaande aanvragenlijst van kantoor én in de kv-data van dat kampmoment (`GET /api/kv/:token/data` krijgt een lijst `meldingen_chauffeur`). Geen pushmeldingen (werklijst 48, later).

## Bewijs
- `scripts/test-ch1-rit-api.mjs` (via `_testhulp` op `herfst-test.db`): rit met 3 taken (slots vast/vrij/vrij) → wissel omlaag op taak 2 → volgorde 1,3,2 en tijden omgewisseld, `wijzigingen` + `activiteiten_log` hebben een regel; wissel op een vaste taak → 409; rit-data bevat per stop locatie-contact + kv-naam/telefoon en per regel foto_url/rek/code; `niet-mee` op een regel → rest-taak bestaat met die regel, regel niet geladen; terugdraaien → rest-taak weg; probleem melden → aanvraag `probleem_chauffeur` zichtbaar in `/api/aanvragen` en in de kv-data; export bevat geen `contact_telefoon`.
- `node scripts/volle-run.mjs` 2×: 15/15 + jouw test groen. Eindtabel in het verslag.
- Commit per punt, push `origin HEAD:bouw-c`. NOOIT naar main, NOOIT deploy.bat.
- Verslag onderaan `OVERLEG-c.md` met de exacte JSON-vorm van de rit-data (dat is het contract voor chat D); laatste bericht eindigt met exact: **VOLLEDIG KLAAR MET DE PROMPT. NU IS HET TERUG AAN DE HOOFDCHAT.** Bij de tijdslimiet: stop, commit, "Stand bij tijdslimiet", push, en eindig met **TIJDSLIMIET BEREIKT: GESTOPT MET EEN TUSSENSTAND. NU IS HET TERUG AAN DE HOOFDCHAT.** Volgorde bij tijdnood: 1, 2, 3, dan 4.
