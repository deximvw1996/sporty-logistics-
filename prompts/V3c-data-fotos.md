# PROMPT V3c — FOTO'S UIT DE DATABASE, PROD-OPSCHONING, CATALOGUSVERVUILING STOPPEN
**Chat E (Sonnet) · map `D:\Sporty\sporty-e` · branch `bouw-e` · poort 3305 · verslag `OVERLEG-e.md` · TIJDSLIMIET 2 uur**

Lees eerst `CLAUDE.md` in je map. Begin met `git fetch origin` en `git rebase origin/main` (F1 is gemerged: server in `lib/` + `routes/`). Je raakt ALLEEN `lib/fotos.js` (nieuw), `lib/migraties.js` (alleen nieuwe migraties onderaan), `routes/bakken.js`, `routes/sport.js`, `routes/aanvragen.js` (alleen de foto-regels van de kapot-melding; chat C werkt in de status-route van datzelfde bestand: raak die niet), `lib/db.js` (alleen `resolveItemTypeId`), `scripts/opschoning-*.mjs`, `scripts/test-v3c-*.mjs` en `OVERLEG-e.md`. `index.html` blijft dicht.

## Waarom deze prompt
Foto's (bakken opgeplooid/opgezet, bak_fotos, attributen, sport-items, kapot-meldingen) staan als base64-tekst in de database; elke foto maakt het db-bestand groter en elke schrijfactie trager, en een KV die vijf foto's van een kapotte oven stuurt, zet megabytes in sqlite. Daarnaast staat er testrest op prod (Abdijschool vraagt 99 EHBO-koffers) en vervuilt elke opgeslagen transportregel de materiaalcatalogus met namen als "17 × Kleuterfiets rood". Maxim wil een professionele, schone datalaag vóór de herfstweek.

## Punt 1 — Foto's naar de uploads-map (werklijst 23; A-2, C-#10)
- `lib/fotos.js`: `bewaarFoto(base64OfBuffer, soort)` → valideert (alleen jpeg/png/webp op magic bytes, max 2 MB na decodering, anders fout), schrijft `uploads/<soort>/<jaar>/<random>.<ext>`, geeft het relatieve pad terug; `verwijderFoto(pad)`. Hergebruik de bestaande upload-hardening uit V0 (extensie-whitelist, padcheck) zodat er één waarheid is.
- Alle routes die vandaag `foto_data` (base64) opslaan (bakken `foto_opgeplooid`/`foto_opgezet`, `bak_fotos`, `attributen.foto_data`, kapot-melding via kv-link, sport-foto) slaan voortaan een pad op in een kolom `foto_path` (bestaat al bij sport_items; nieuwe kolommen via migratie voor de andere tabellen). De API blijft hetzelfde naar buiten: waar vroeger base64 teruggegeven werd, komt nu een URL onder `/uploads/...` (de bestaande `/uploads`-mount zit achter de wachtwoordmuur, dat blijft zo). Controleer in `index.html` (lezen mag, wijzigen niet) hoe de foto's getoond worden; is een UI-wijziging nodig, dan GEVONDEN met regelnummer.
- Migratie: bestaande base64-foto's in de db worden bij het opstarten éénmalig naar bestanden geschreven en de base64-kolom leeggemaakt (idempotent; sla een rij over als de decodering faalt en log ze). Draai dat op een kopie van `sporty.db` en meet: db-grootte vóór en na, aantal weggeschreven bestanden.

## Punt 2 — Catalogusvervuiling stoppen (werklijst 24; B-F9)
`resolveItemTypeId` in `lib/db.js` maakt een nieuw item_type voor elke onbekende naam, ook voor transportregels. Geef de functie een parameter `maakAan` (standaard `true`) en laat de transportregel-opslag (`POST /api/transport-taken` en de generator in `routes/transport.js`: dat bestand is van chat C; zoek de aanroep en geef hem in je verslag door als GEVONDEN met de exacte regel, verander hem niet zelf) de catalogus niet meer vullen. Schrijf `scripts/opschoning-catalogus.mjs` die de vervuilde item_types (naam begint met "Bak ", "Attribuut ", "Kleurenbord ", of bevat " × ", en niet gebruikt in `bak_items`/`voorraad`/`standaard_materiaal`/`sport_items`) opsomt en met `--doe` verwijdert; zonder vlag alleen tonen. Hetzelfde voor de 256 item_types met prefix "KV:"/"INFO:" die als catalogustype bestaan maar informatie zijn (A-2.3): tonen, en alleen verwijderen als ze nergens gebruikt worden.

## Punt 3 — Prod-opschoning klaarzetten (werklijst 25; B-F13)
Schrijf `scripts/opschoning-prod.mjs` dat tegen een db-bestand (pad als argument) werkt en in droogloop rapporteert, met `--doe` uitvoert:
- locatie_config-regels met `aantal >= 50` (de "99× EHBO" op Abdijschool Vlierbeek) → tonen; met `--doe` verwijderen.
- Rijen met naam `'undefined'` of lege naam in `locaties`, `bakken`, `item_types`, `attributen` → tonen; verwijderen als ze geen verwijzingen hebben, anders alleen melden.
- Verweesde `nakijk_regels`/`verhuis_checks`/`bulk_spreiding`-rijen zonder bestaande ouder → tonen/verwijderen.
Fable draait dit script zelf tegen prod via de bestaande herstel-route; jij draait het alleen tegen je kopie en plakt de droogloop-uitvoer in je verslag.

## Bewijs
- `scripts/test-v3c-fotos.mjs` (patroon `scripts/test-veiligheid.mjs`, poort 3350): upload een bakfoto, een attribuutfoto en een kapot-melding met foto via de kv-link → in de db staat een pad en geen base64, het bestand bestaat, de GET geeft een `/uploads/...`-URL die 200 geeft met Basic-auth en 401 zonder; een upload van 3 MB of een `.html`-bestand wordt geweigerd; de migratie op een db-kopie met bestaande base64-foto's zet ze om en een tweede start doet niets meer.
- `scripts/test-v3c-catalogus.mjs`: na het opslaan van een transporttaak met een regel "17 × Kleuterfiets rood" bestaat er geen nieuw item_type met die naam; de opschoningsscripts geven in droogloop de verwachte rijen en na `--doe` zijn ze weg en zijn de bulk-sommen nog 55/55 sluitend.
- `test-veiligheid` 2× groen (de foto-upload-tests daarin blijven gelden).
- Commit per punt, push `origin HEAD:bouw-e`. NOOIT naar main, NOOIT deploy.bat, nooit tegen prod.
- Verslag onderaan `OVERLEG-e.md` met de metingen (db-grootte vóór/na, aantal foto's, aantal verwijderde types); laatste bericht aan Maxim eindigt met exact: **VOLLEDIG KLAAR MET DE PROMPT. NU IS HET TERUG AAN DE HOOFDCHAT.** Bij de tijdslimiet: stop, commit, "Stand bij tijdslimiet", push, en eindig met **TIJDSLIMIET BEREIKT: GESTOPT MET EEN TUSSENSTAND. NU IS HET TERUG AAN DE HOOFDCHAT.** Volgorde bij tijdnood: punt 3, dan 2, dan 1.
