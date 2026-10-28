
# V3c — foto's naar bestanden, catalogusvervuiling, prod-opschoning (chat E, Sonnet)
Start 23:21 · limiet 2 uur · gedaan in de volgorde punt 3 → 2 → 1. Commits: a385a6a (3), 0eeaa45 (2), 64c06ed (1), gepusht naar `bouw-e`.

## Wat af is (bewijs in één regel)
- **Punt 3** `scripts/opschoning-prod.mjs <db> [--doe]` (+ gedeelde hulp `scripts/opschoning-gedeeld.mjs`): droogloop op kopie van sporty.db → `99× EHBO-Koffer op "Abdijschool Vlierbeek"` (locatie_config id 1), 0 'undefined'/lege namen, 96 verweesde nakijk_regels. Test injecteert extra gevallen; `--doe` verwijdert precies de aangekondigde (md5 bewijst dat droogloop niets schrijft).
- **Punt 2** `resolveItemTypeId(naam, categorieHint, maakAan=true)` in `lib/db.js`: `maakAan=false` zoekt alleen; bovendien vangnet: een naam die met `N × ` begint wordt nooit meer een catalogustype (zelfs met maakAan=true). `scripts/opschoning-catalogus.mjs <db> [--doe]`: vervuilde types (Bak / Attribuut / Kleurenbord / " × ") + KV:/INFO:-types, verwijdert alleen wat nergens gebruikt wordt (alle kolommen `item_type_id`, behalve transport_regels/verhuis_checks, waar het id bij verwijdering op NULL gaat).
- **Punt 1** `lib/fotos.js` (`bewaarFoto`, `verwijderFoto`, `verwerkWaarde`, `detecteer`): magic bytes jpeg/png/webp, max 2 MB, random naam `uploads/<soort>/<jaar>/<hex>.<ext>`, pad-check. Routes: vaste-bak foto-slot, attributen POST/PUT/DELETE, bak-foto POST/DELETE, aanvraag-POST, kapot-melding via kv-link, sport-foto (magic-bytes-check toegevoegd, bestandsnaamformaat `sport-<id>-<ts>.<ext>` ongewijzigd). Migratie 70 (vlag `migratie70_klaar`): nieuwe kolommen `foto_path` (bak_fotos, attributen, aanvragen) en `foto_opgeplooid_path`/`foto_opgezet_path` (bakken), bestaande base64 → bestanden, **VACUUM erna**.
- **Ontwerpkeuze (UI blijft ongewijzigd):** de legacy-kolom (`foto_data` / `foto_opgeplooid` / `foto_opgezet`) bevat na de wijziging de URL `/uploads/<pad>`; `foto_path` het relatieve pad. Alle bestaande lezers (`<img src=bak.foto_opgeplooid>` in index.html:2754, export, kv-pagina) zien dus zonder aanpassing een bruikbare URL. Een client die de URL terugstuurt in een PUT laat de foto staan; `''` verwijdert; een data-URL vervangt (oud bestand wordt gewist).

## Metingen
- Foto's: wegwerp-db met 4 inspuit-foto's (±0,9 MB) + 2 al aanwezige in de basis-db (bak 11937, png) + 1 bewust kapotte: **Migratie 70 → "6 foto's naar uploads/ geschreven, 1 overgeslagen"; 6 bestanden; db 2.199.552 B → 1.007.616 B (-54 %)**. Zonder VACUUM bleef het bestand even groot (eerste run: 2.207.744 B) — daarom toegevoegd.
- Kapot-melding met foto (300 KB): in de db 51 tekens i.p.v. ±400.000; 1 bestand in `uploads/aanvraag/`.
- Catalogus (kopie van sporty.db, 3338 types): vervuilde kandidaten 23, daarvan **10 ongebruikt (verwijderd bij --doe)**, 13 in gebruik (bv. "Bak met veren" = echt bak_item → blijft). KV:/INFO: 256 kandidaten, **0 verwijderbaar: alle 256 hangen nog aan `thema_materiaal`** (de interim-KV-boodschappenlijst van S4.8, zie GEVONDEN).
- Bulk: na `--doe` 55/55 spreidingsrijen, 0 bakken met afwijkende som.

## Tests (2× groen waar gevraagd)
- `scripts/test-v3c-fotos.mjs` (poort 3350): 47 ok, ALLES GROEN (2×; plus 1× tijdens bouw). Dekt: migratie + 2e start doet niets, pad i.p.v. base64, `/uploads`-URL 200 mét / 401 zonder Basic-auth, 3 MB / html-als-base64 / geen-base64 → 400 op attribuut, bakfoto, kapot-melding, sport-foto html-ext → 400, bestanden verdwijnen bij vervangen/verwijderen.
- `scripts/test-v3c-catalogus.mjs` (poort 3351): 33 ok, ALLES GROEN (2×). Dekt: transporttaak "17 × Kleuterfiets rood" → regel bewaard, géén nieuw item_type; droogloops md5-onveranderd; `--doe` precies de aangekondigde rijen; 2e `--doe` doet niets; bulk 55/55.
- `scripts/test-veiligheid.mjs`: 58 ok ALLES GROEN (2×; gedraaid via tijdelijke kopie met poort 3352 en eigen testmap omdat het origineel vast op 3310/`sporty-a-veiligheidstest` staat; kopie weer verwijderd).
- Bestaande tests op geraakte code: `test-f1-schrijven` 22 ok GROEN, `test-f1-wijzigingen` 46 ok GROEN, `test-f1-modules` **2–3 FOUT**: de test vergelijkt de routes met `origin/main:server.js` ("inventaris origin/main: 3 routes, verwacht >= 220") — sinds F1 gemerged is staat daar de gesplitste server; fout zit in de test, niet in mijn wijziging (geen route toegevoegd/verwijderd).

## GEVONDEN (niet zelf gefixt)
1. **`routes/transport.js` (chat C) vult de catalogus nog:** regels 546 (POST /api/transport-taken, regels), 619 (POST /api/transport-regels), 731 (verhuis_checks bij rit-init, `r.item_type_id||resolveItemTypeId(r.naam)`), 892 (spoedtransport) en `routes/aanvragen.js:51` (spoedtransport uit goedgekeurde aanvraag, in de status-route van chat C). Elk moet `resolveItemTypeId(naam, undefined, false)` worden. Het `N × `-vangnet in db.js vangt alleen het "17 × …"-patroon, niet "Bak Verkeerskoffer 1".
2. **De 256 KV:/INFO:-types kunnen nog niet weg**: `thema_materiaal` is voor de KV-boodschappenlijst nog in gebruik (MASTERPLAN noemt de tabel "dode generatie"). Pas na S4.8-vervanger opruimen; het script doet het dan vanzelf.
3. Prefix "Bak " is geen betrouwbaar vervuilingskenmerk (13 echte bak-items heten "Bak met veren", …); daarom beslist het script op gebruik, niet op naam.
4. **Backup dekt de foto's niet:** `/api/backup-db` en de dagelijkse backup bevatten enkel sporty.db; sinds deze wijziging staan de foto's in `uploads/` op het Railway-volume. Volume-backup of foto-export is een open punt vóór oktober-productie. (`/api/herstel-db` laat uploads/ staan, dus een restore verliest geen foto's maar kan wel URL's krijgen naar bestanden die ontbreken als het volume ooit wisselt.)
5. `kapotte` oude base64-foto's (niet decodeerbaar, >2 MB of geen jpeg/png/webp) blijven ongewijzigd in de db staan en worden gelogd (`Migratie 70: … overgeslagen`); na de prod-run de log nakijken.
6. De `index.html` toont uit `foto_data`/aanvragen/bak_fotos nergens iets (alleen upload op 4135 en de vaste-bak-slots op 2754) — geen UI-wijziging nodig; verder geen regel gevonden die base64 verwacht.

## Buiten mijn gebied
- `routes/kv.js:132-135`: de kapot-melding via de kv-link bewaart nu pad+URL i.p.v. base64 (de opdracht noemt dit pad expliciet, maar kv.js stond niet in de lijst; 4 regels, alleen het foto-deel).
- `routes/sport.js`: één regel toegevoegd (magic-bytes-check) en `require('../lib/fotos')`.

## Aanwijzing voor de prod-run
Eerst `node scripts/opschoning-catalogus.mjs <kopie>` en `node scripts/opschoning-prod.mjs <kopie>` als droogloop; pas daarna `--doe` via de herstel-route. Voor de foto's niets te doen: Migratie 70 draait bij de eerste start na deploy; controleer in de Railway-log de regel "Migratie 70: N foto's naar uploads/ geschreven, M overgeslagen" en daarna de db-grootte.
