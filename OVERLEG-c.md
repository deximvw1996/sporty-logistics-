
---
## V3a — Ketenfixes transport (chat C, Opus) — 2026-10-28

**Gebied:** `routes/transport.js`, `routes/aanvragen.js`, `lib/bulk.js` (nieuw), `scripts/test-v3a-keten.mjs`, + 2 regels in `lib/migraties.js`.

### Wat af is
- **Punt 1 — één verplaatsfunctie voor bulk.** `lib/bulk.js`: `verplaatsBulk(req,bakId,van,naar,aantal,context)` (te weinig op `van` → Error met tekst "Op X staan maar N × "naam" — kan er geen M verplaatsen", status 409), `controleerBulk` (zelfde check zonder schrijven), `leidBulkStatusAf` (status/huidige_locatie_id van een bulk-rij afgeleid: `op_locatie` @ grootste buiten-thuis-plek, anders `thuis`). Elke spreidingswijziging gelogd in `wijzigingen` (tabel `bulk_spreiding`). Idempotent via nieuwe kolom `transport_regels.verplaatsing_uitgevoerd` (elke regel max. één keer verplaatst). Bulk-rijen worden bij laden niet meer op `onderweg` gezet.
- **Punt 2 — rit/taak sluiten vanzelf.** Nieuwe `_rondTaakAf` in transport.js = de ENIGE afronding, gebruikt door de kantoorknop (`PUT /api/transport-taken/:id/status` gedaan) én de rit-token (laatste regel van een stop gelost). Alle taken gedaan → rit `gedaan`. Eerste stuk geladen → rit `onderweg`. Nieuwe route `POST /api/rit-token/:token/taken/:taakId/aangekomen` + knop "📍 Ik ben aangekomen" per stop op de rit-pagina → taak `aangekomen`. Een vinkje "gelost" terug uitzetten draait een afgeronde taak bewust NIET terug (dat doet kantoor).
- **Punt 3 — spoedtaak uit aanvraag.** van = `spoedtransport.van_locatie_id`, anders thuislocatie van een bak/attribuut met die code/naam, anders de Rozenweg; naar = kamplocatie van het kampmoment; datum = eerstvolgende werkdag (ma–vr) binnen de kampweek vanaf vandaag (week voorbij → eerstvolgende werkdag; expliciete `spoedtransport.datum` wordt gerespecteerd, ook in het weekend); aantal = `spoedtransport.qty`, anders eerste getal uit de tekst, anders 1. Taak krijgt `aanvraag_id` (nieuwe kolom) + `kampmoment_id`. **Keuze afwijzen: status `geannuleerd`** (spoor blijft bewaard, rit ook `geannuleerd` als er niets anders op staat); al geladen/aangekomen/gedaan → 409 met uitleg.
- **Punt 4 — ophaalrit toont de bakkenlijst.** Bij het openen van `/rit/:token` krijgen taken zonder checks die automatisch uit hun regels (geen Klaarzetten nodig, bestaande checks blijven staan). Oude ophaling zonder regels: regels afgeleid uit `_kvVerwacht(kampmoment)` gefilterd op wat nu op de van-locatie staat (bakken/attributen via huidige_locatie_id, bulk via bulk_spreiding).
- Meegenomen bug: `_pasSpoedEffectToe` riep `updateMetLog(req,…)` zonder `req` in scope (F1-regressie → ReferenceError bij "gedaan" op een spoedtaak met spoed_kind); krijgt nu `req` mee.

### Bewijs (één regel per claim, alle uit `scripts/test-v3a-keten.mjs`, eigen server 3311 + wegwerp-db)
- levering via rit-token: spreiding Sporthal Kessel-Lo 0→3, thuis 17→14, som 17 = bezit 17; bulk afgeleid op_locatie @1; themabak op_locatie; taak `gedaan`, rit `gedaan` in GET /api/ritten.
- rit `onderweg` na eerste laden; stop `aangekomen`; na 1/2 gelost taak nog niet gedaan.
- gepland → gedaan en gedaan → gedaan: spreiding ongewijzigd (`{"1":3,"7":14,"31":0}`).
- ophaling 2 stuks vanaf De Bosstraat (0): kantoorknop 409 "Op De Bosstraat staan maar 0 × …", taak niet gedaan, rit-token lossen 409, vinkje blijft uit, spreiding ongewijzigd.
- ophaalrit-pagina toont bulkregel + afgeleide themabak van oude ophaling zonder regels; na lossen spreiding hersteld `{"1":0,"7":17,"31":0}`, rit gedaan.
- aanvraag "3 rollen tape" → spoedtaak van Rozenweg (7), naar kamplocatie (1), datum 2026-11-23 = maandag BINNEN de toekomstige testweek, qty 3, aanvraag_id gezet; afwijzen → `geannuleerd`; zonder getal → qty 1; geladen spoedtaak afwijzen → 409.
- `wijzigingen`: bulk_spreiding 4, transport_taken 18, transport_ritten 15, aanvragen 5, bakken 6 nieuwe regels; afronding via rit-token met context `rit-link`.

### Tests
- `node scripts/test-v3a-keten.mjs`: **52 ok, 0 fout — ALLES GROEN, 2×.**
- `test-f1-schrijven` 22/0 groen 2×; `test-f1-wijzigingen` 46/0 groen 2×.
- `test-veiligheid` 55 ok / 3 fout en `test-f1-modules` 80 ok / 2 fout — **identiek op een schone kopie van origin/main** (git archive in scratchpad), dus niet door V3a: zie GEVONDEN.
- Geen keten-tests van chat B gevonden op origin (`origin/bouw-b` heeft geen `test-keten-*`), dus eigen test.

### GEVONDEN (niet gefixt)
- `test-veiligheid` op origin/main: pincode blijft `sha256$` na login en geen 429 na 5 foute pogingen (Stijn logt 6× in met 200) — op schone main-kopie hetzelfde. Mogelijk ligt de pincode van Stijn in de db-kopie zo dat de "foute" pin klopt, of de scrypt-migratie op login draait niet; te onderzoeken door chat A.
- `test-f1-modules`: vergelijkt routes met `origin/main:server.js`, dat sinds de F1-merge maar 3 routes heeft → test is verouderd na de merge.
- Rit-pagina gebruikt nog `alert()` bij fouten (bestaand patroon; mijn nieuwe knop volgt het) — regel 8 vraagt toasts.

### Buiten mijn gebied
- `routes/bakken.js` `POST /api/bakken/:id/verplaats` (handmatige verplaatsing) zet voor een bulk-rij nog rechtstreeks status/huidige_locatie_id en raakt bulk_spreiding niet; moet `require('../lib/bulk')(ctx).verplaatsBulk` gebruiken (met een `aantal` uit de body). Ook `PUT /api/vaste-bakken/:id` (aantal aanpassen, bakken.js r.180) schrijft spreiding kaal. Terugkomst (`/api/terugkomst`) beweegt geen bulk, dus geen wijziging nodig.
- `lib/migraties.js`: 2 regels `addColumnIfMissing` (aanvraag_id + verplaatsing_uitgevoerd) — prompt noemde één kolom; de tweede is nodig voor de idempotentie van punt 1.
- Commits: punten 1, 2 en 4 zitten in dezelfde functie (`_rondTaakAf`/rit-token) en zijn samen gecommit; punt 3 apart.

---
## V3d — Splitsen/verwijderen na laden, bulk overal via één functie, geen alert() op de rit-pagina (chat C, Opus) — 2026-10-29

**Gebied:** `routes/transport.js` (splits, delete, bulk-delete, status-gepland, checks-sync, rit-pagina), `routes/bakken.js` (verplaats + PUT vaste-bakken), `lib/bulk.js`, `scripts/test-v3d-bulk.mjs`. `routes/aanvragen.js`: 1 regel (punt 3, mijn eigen V3a-code). Niet aangeraakt: generator-regio 40–350 (chat B), `routes/kv.js` (bevat geen `resolveItemTypeId` — niets te doen), `scripts/test-keten-splits.mjs` (contract ongewijzigd).

### Wat af is
- **Punt 1 (9118af4).** Splitsen: de checks van de afgesplitste regels verhuizen mee naar de nieuwe taak, laadstatus inbegrepen (koppeling regel→check op bak_id, anders attribuut_id, anders naam). De nieuwe taak heeft nog geen rit → `rit_id = 0` (**de kolom is NOT NULL, dus 0 = "nog geen rit"**); `_syncChecksRit` zet rit_id goed zodra de taak aan een rit hangt (aangeroepen bij GET checks, checks/init en het openen van de rit-pagina — dekt ook `PUT /api/transport-taken/:id/rit` in locaties.js zonder dat bestand te raken).
  **Gekozen lijnen (allebei):** (a) een taak verwijderen (ook bulk-delete) terwijl er regels geladen maar niet gelost zijn → **409** "N regels zijn al geladen: los ze eerst of zet de taak terug op gepland"; bulk-delete controleert eerst alles en verwijdert dan niets. Zonder geladen regels verwijdert hij ook zijn checks (`delMetLog`), en een lege rit gaat mét zijn checks weg. (b) **Terug op `gepland`** (bestaande status-route): verplaatste bulk gaat via `verplaatsBulk` terug naar de van-locatie (te weinig daar → 409), verplaatste/geladen gewone bakken en attributen terug naar de van-locatie resp. hun plek (`thuis`/`op_locatie`, nooit meer `onderweg`), laad- en losvinkjes gewist, idempotentie-vlag gewist (opnieuw "gedaan" verplaatst dus opnieuw), rit `gedaan` → `onderweg`.
- **Punt 2 (d1bcec7).** `lib/bulk.js`: `zetBezit` (verschil op thuis, gelogd, 409 "Er staan nog N × … op kamplocaties — het bezit kan niet lager dan N" als het nieuwe bezit kleiner is dan wat elders staat), `controleerSom(bakId)` → `{ok,som,bezit}`, `standaardVan` (grootste plek buiten thuis, anders thuis). `POST /api/bakken/:id/verplaats` voor bulk: `aantal` verplicht (400 met uitleg), `van_locatie_id` optioneel → `verplaatsBulk`, antwoord bevat `som`. `PUT /api/vaste-bakken/:id`: aantal via `zetBezit` (eerst gecontroleerd, dus bij 409 wijzigt niets), en de status van een bulk-rij kan niet meer rechtstreeks gezet worden.
- **Punt 3 (070eedc).** 5× in transport.js (POST transport-taken, POST transport-regels, checks/init, auto-checks van de rit-pagina, spoedtransport) + 1× in aanvragen.js → `resolveItemTypeId(naam, undefined, false)`.
- **Punt 4 (a008d5c).** Rit-pagina: `toast(tekst, goed)` onderaan (3 s, groen/rood); alle 4 `alert()` vervangen + bevestigingstoasts bij laden, lossen en aankomst. 0 `alert(` meer in transport.js.

### Bewijs
- `test-keten-splits` (chat B): rood (4 fout) → **GROEN 9/0**; verwijderen na laden → 409 "9 regels zijn al geladen: …".
- `test-v3d-bulk`: **27 ok / 0 fout** — o.a. zonder aantal → 400; 5 verplaatst → Rozenweg 12 / Abdijschool 5, som 17 = bezit, status op_locatie @29; 50 terwijl er 12 staan → 409; bezit 17→20 → thuis 15 (som 20); bezit → 10 terwijl 12 op locatie → 409, niets gewijzigd; 12 terug → alles thuis, status thuis; taak gedaan → 3 op locatie, terug op gepland → weer 20 thuis, opnieuw gedaan → weer 3; verkeerskoffer geladen → onderweg → DELETE 409 / bulk-delete 409 → gepland → `thuis`, vinkje gewist → DELETE 200, geen checks/rit over; elke stap staat in `wijzigingen`; "Bak Verkeerskoffer 1" → bestaand type 6350, onbekende namen → null, item_types 3338 → 3338 na taak, regel, checks/init, spoedtaak uit aanvraag en `/api/spoedtransport`; rit-pagina zonder `alert(` en mét `toast(`.

### Volle run (`node scripts/volle-run.mjs`, 2× identiek)
| test | uitslag | ok | fout |
|---|---|---|---|
| f1-modules | GROEN | 82 | 0 |
| f1-schrijven | GROEN | 22 | 0 |
| f1-wijzigingen | GROEN | 46 | 0 |
| keten-aanvraag | GROEN | 12 | 0 |
| keten-levering | GROEN | 44 | 0 |
| keten-ophaling | GROEN | 7 | 0 |
| keten-periode | ROOD | 6 | 7 |
| keten-splits | GROEN | 9 | 0 |
| v3a-keten | GROEN | 52 | 0 |
| v3b-ui | GROEN | 15 | 0 |
| v3c-catalogus | GROEN | 33 | 0 |
| v3c-fotos | ROOD | 45 | 2 |
| v3d-bulk | GROEN | 27 | 0 |
| veiligheid | ROOD | 55 | 3 |

11/14 groen. De 3 rode tests komen niet door V3d:
- `keten-periode`: chat B, V2 — die loopt nog.
- `veiligheid` (3 fout): bij V3a al identiek rood op een schone origin/main.
- `v3c-fotos` (2 fout): **identiek op een schone origin/main-kopie met dezelfde `sporty.db`** — deze test leest de lokale `sporty.db` van de worktree (niet `herfst-test.db`) en verwacht daar base64-foto's in; de db van sporty-c heeft die niet. Dat hangt dus van de omgeving af, niet van de code → GEVONDEN.

### GEVONDEN
- `test-v3c-fotos` hangt af van de lokale `sporty.db` van de worktree (kopieert `ROOT/sporty.db`) → resultaat verschilt per map. Voorstel: `herfst-test.db` + zelf een base64-foto inzaaien.
- `test-veiligheid` blijft rood (zelfde 3 als in V3a; ook op main).

### Buiten mijn gebied
- `POST /api/vaste-bakken` (aanmaken van een bulk-rij) schrijft de eerste spreidingsrij nog met kale `ins` (niet gelogd); dat is geen verplaatsing en de som klopt (= aantal), dus ik heb het gelaten.
- `PUT /api/transport-taken/:id/rit` (locaties.js) synchroniseert de checks niet zelf; dat gebeurt lui bij het lezen (zie punt 1).

---
## CH1 — Chauffeursscherm deel 1: data en API (chat C, Opus) — 2026-10-29

**Gebied:** `lib/migraties.js` (migratie 73), `routes/transport.js` (API; de rit-pagina-HTML is NIET aangeraakt), `routes/locaties.js`, `routes/aanvragen.js`, `scripts/test-ch1-rit-api.mjs`.
**Buiten mijn gebied (gemeld):**
- `routes/kv.js`: één veld `meldingen_chauffeur` in de kv-data — door de prompt gevraagd.
- `routes/beheer.js`: export, 1 regel die de contactvelden weglaat — door de prompt gevraagd.
- `scripts/test-f1-modules.mjs`: 1 regel die `/api/rit-token/:token` invult; zonder die regel kan de route-inventaris de nieuwe GET-route niet aanroepen.

**Ontwerpbestand:** `design/CHAUFFEUR-DEFINITIEF.html` staat NIET in de repo (alleen `chauffeur-drieluik-1.html`). Ik werkte op `DESIGN-BRIEF.md` scherm 1 en deze prompt.

### Afwijkingen (bewust, met reden)
- **Geen dubbele kolommen.** `locaties` heeft al `addr` en `contact_tel`, `personeel` heeft al `telefoon`. Ik voeg alleen `sleutel_info` toe. De API gebruikt wél de namen uit de prompt:
  - `PUT /api/locaties/:id` aanvaardt `contact_telefoon` en `adres` als alias. De alias wint als hij verschilt van wat er al staat.
  - `GET /api/locaties` geeft `contact_telefoon` en `adres` mee naast de oude namen.
  - De rit-data gebruikt alleen de nieuwe namen.
- **`slot` zetten.** `PUT /api/transport-taken/:id` met `slot`:
  - alleen rol `kantoor` (anders 403);
  - 400 bij een andere waarde dan `vast`/`vrij`;
  - een body met enkel `slot` wijzigt enkel het slot (de bestaande route overschrijft anders alle velden).
- **Contactvelden** (`contact_naam`, `contact_tel`/`contact_telefoon`, `sleutel_info`) wijzigt alleen kantoor. De andere locatievelden blijven open voor elke ingelogde gebruiker.
- **Stop met enkel "niet mee"-stukken** sluit vanzelf af: de taak gaat op `gedaan` via `_rondTaakAf`, en wat niet mee ging wacht in de rest-taak.
  - "Niet mee"-stukken tellen niet mee voor "alles geladen/gelost".
  - Terugdraaien heropent een al afgesloten stop NIET; dat doet kantoor met "terug op gepland".
- **Bulk "niet mee".** `aantal` = wat WEL mee gaat. De check krijgt qty = aantal en blijft laadbaar; de rest-taak krijgt een regel `(qty−aantal) × naam`.

### Wat af is
- **Punt 1 — slot, volgorde en wissel.**
  - Migratie 73: `transport_taken.slot` (default `'vast'`), `volgorde` en `rest_van_rit_id`. Backfill per rit op tijd, dan id, gegate met `migratie73_klaar`.
  - De volgorde wordt bij elke lezing genormaliseerd naar 1..n; nieuwe taken komen achteraan op tijd.
  - `GET /api/ritten/:id` (nieuw) en `GET /api/ritten` geven de taken op volgorde, met `slot`/`volgorde`/`tijd`.
  - `POST /api/rit-token/:token/taken/:taakId/wissel {richting}`:
    - werkt alleen als beide stops `vrij` zijn, anders 409 "<locatie> staat vast door kantoor — …";
    - volgorde én tijd van de twee taken worden omgewisseld;
    - gelogd via `updateMetLog` met context `rit-link` + `activiteiten_log` "Chauffeur X wisselde stop A en B (rit #n)";
    - eerste stop omhoog of laatste stop omlaag → 409; fout token → 403.
- **Punt 2 — contacten.** Zie de afwijkingen hierboven. De export bevat `locaties` zonder `contact_tel`, `contact_telefoon` en `sleutel_info`.
- **Punt 3 — per stuk en niet mee.**
  - `GET /api/rit-token/:token/data` (nieuw, publiek via de rit-token-prefix) is de bron voor chat D.
  - `POST /api/rit-token/:token/checks/:checkId/niet-mee {reden:'past_niet'|'niet_gevonden'|'kapot'|null, opmerking, aantal}`:
    - maakt één rest-taak per rit + bestemming: gepland, `rit_id` null, `slot='vrij'`, opmerking "Rest van rit #id: past niet[, niet gevonden…]";
    - een volgende niet-mee voor dezelfde bestemming vult die rest-taak aan;
    - `reden:null` draait terug, en een lege rest-taak wordt verwijderd (met `delMetLog`);
    - laden van een niet-mee-stuk → 409; een al geladen stuk op niet-mee zetten → 409.
- **Punt 4 — probleem melden.** `POST /api/rit-token/:token/taken/:taakId/probleem {soort:'gesloten'|'past_niet_lokaal'|'anders', tekst, foto_data}`:
  - maakt een rij in `aanvragen` met `soort='probleem_chauffeur'`, status `nieuw` en het `kampmoment_id` van de taak;
  - tekst: "Chauffeur <naam> bij <locatie>: <soort> — <tekst>";
  - foto via `lib/fotos.js` (`foto_path` + de URL in `foto_data`);
  - `anders` zonder tekst → 400;
  - zichtbaar in `GET /api/aanvragen` en in `GET /api/kv/:token/data` als `meldingen_chauffeur: [{id, tekst, status, created_at, foto_data(URL)}]`.

### CONTRACT voor chat D — `GET /api/rit-token/:token/data`
```json
{
  "rit": { "id": 22, "datum": "2026-11-02", "chauffeur": "Test Chauffeur", "voertuig": "", "status": "gepland|onderweg|gedaan" },
  "voortgang": { "stops": 3, "stops_gedaan": 0, "huidige_stop": 1, "stuks": 4, "geladen": 0, "gelost": 0 },
  "stops": [
    {
      "taak_id": 196, "volgorde": 1, "slot": "vast|vrij", "tijd": "09:00",
      "type": "levering|ophaling|transfer|extra", "status": "gepland|aangekomen|gedaan|geannuleerd",
      "opmerking": "…",
      "van":  { "id": 7,  "naam": "Rozenweg" },
      "naar": { "id": 29, "naam": "Abdijschool Vlierbeek" },
      "locatie": { "id": 29, "naam": "Abdijschool Vlierbeek", "adres": "…", "contact_naam": "Conciërge Jan",
                   "contact_telefoon": "0470 11 22 33", "sleutel_info": "Sleutel bij de buren nr. 12" },
      "kv": { "naam": "Test KV Abdijschool", "telefoon": "0499 88 77 66" },
      "regels": [
        { "check_id": 83, "code": "N20", "naam": "Bak Themabak 1/4 (kleuterbak) (N20)", "qty": 1, "soort": "thema",
          "rek": "N", "foto_url": null, "bak_id": 11854, "attribuut_id": null, "is_bulk": false,
          "geladen": false, "gelost": false, "aantal_geladen": null,
          "niet_mee": null }
      ]
    }
  ]
}
```
- `locatie` = de plek waar de chauffeur bij die stop staat: bij `ophaling` de van-locatie, anders de naar-locatie. `null` als er geen locatie is.
- `kv` = `null` als het kampmoment geen KV heeft of de taak geen kampmoment heeft.
- `rek` = de eerste letter van de code, anders uit "(X12)" in de naam, anders `null`.
- `foto_url` = `/uploads/…` of `null`. Bak: `foto_opgeplooid` als dat een URL is; attribuut: `/uploads/` + `foto_path`. De data bevat geen bak-inhoud.
- `aantal_geladen`: alleen bij bulk (qty als het stuk geladen is, anders 0); anders `null`.
- `niet_mee`: `null` of `{ "reden": "past_niet|niet_gevonden|kapot", "opmerking": "…", "aantal": <aantal dat NIET mee gaat> }`.
- `voortgang.stuks/geladen/gelost` tellen niet-mee-stukken niet mee. `huidige_stop` = de volgorde van de eerste stop die niet `gedaan` is.
- **Acties** (allemaal `POST`, zonder sessie, via de rit-token):
  - `…/checks/:checkId/laden` en `…/checks/:checkId/lossen` (bestaand, togglen);
  - `…/checks/:checkId/niet-mee`;
  - `…/taken/:taakId/aangekomen` (bestaand);
  - `…/taken/:taakId/wissel {richting:"omhoog"|"omlaag"}` → `{ok, taken:[{id,volgorde,tijd,slot}]}`;
  - `…/taken/:taakId/probleem`.
- Fouten zijn altijd `{error:"<Nederlandse tekst>"}` met status 400, 403 of 409, zodat chat D ze rechtstreeks in een toast kan tonen.

### Bewijs (`scripts/test-ch1-rit-api.mjs`, eigen server 3332, herfst-test.db): 38 ok / 0 fout
- **Locatie en slot:**
  - `contact_telefoon` (alias) en `sleutel_info` worden bewaard; GET geeft ze mee.
  - Een nieuwe taak krijgt slot `vast`; kantoor zet hem op `vrij`; slot `half` → 400.
  - `GET /api/ritten/:id` geeft de taken op volgorde, met slot/volgorde/tijd.
- **Wissel:**
  - Wissel omlaag op stop 2 → volgorde 1,3,2 (taken 196, 198, 197); tijden: stop 3 → 10:00, stop 2 → 11:00.
  - 2 regels in `wijzigingen` met context `rit-link`; `activiteiten_log`: "Chauffeur Test Chauffeur wisselde stop Betekom en Abdijschool Vlierbeek (rit #22)".
  - Wissel met een vaste stop → 409 "Abdijschool Vlierbeek staat vast door kantoor — …"; laatste stop omlaag → 409; fout token → 403.
- **Rit-data:**
  - 3 stops + voortgang.
  - Stop 1 heeft locatie met contact, telefoon, sleutel-info en adres, en een kv met naam + telefoon.
  - Regel N20 heeft `rek` N, `foto_url`, `qty`, `geladen`/`gelost`; de bulkregel heeft `aantal_geladen` 0; de attribuut-regel is aanwezig; geen bak-inhoud.
- **Niet mee:**
  - Past niet → rest-taak #199 "Rest van rit #22: past niet" (gepland, zonder rit, vrij, naar Abdijschool) met de H53-regel, zichtbaar in `/api/transport-taken`.
  - De check blijft niet geladen; laden → 409; de data toont `niet_mee`.
  - Bulk 3 van 5 mee → dezelfde rest-taak krijgt +2, de check qty 3; terugdraaien → qty weer 5.
  - Terugdraaien H53 → rest-taak weg, regel terug bij de stop.
  - Een stop met enkel een niet-mee-stuk sluit af.
- **Probleem melden:**
  - Aanvraag "Chauffeur Test Chauffeur bij Abdijschool Vlierbeek: locatie gesloten — poort op slot" met foto.
  - Staat in `/api/aanvragen` (status nieuw) en in de kv-data onder `meldingen_chauffeur`; ongeldige soort → 400.
- **Export:** bevat geen `contact_tel`, `contact_telefoon` of `sleutel_info`.

### Volle run (2×, identiek): 14/16 groen
| test | uitslag | ok | fout |
|---|---|---|---|
| ch1-rit-api | GROEN | 38 | 0 |
| f1-modules | GROEN | 85 | 0 |
| f1-schrijven | GROEN | 22 | 0 |
| f1-wijzigingen | GROEN | 46 | 0 |
| keten-aanvraag | GROEN | 12 | 0 |
| keten-kv-periode | GROEN | 19 | 0 |
| keten-levering | GROEN | 44 | 0 |
| keten-ophaling | GROEN | 7 | 0 |
| keten-periode | GROEN | 14 | 0 |
| keten-splits | GROEN | 9 | 0 |
| v3a-keten | GROEN | 52 | 0 |
| v3b-ui | GROEN | 15 | 0 |
| v3c-catalogus | GROEN | 33 | 0 |
| v3c-fotos | ROOD | 45 | 2 |
| v3d-bulk | GROEN | 27 | 0 |
| veiligheid | ROOD | 55 | 3 |

De twee rode tests zijn dezelfde als in V3a/V3d:
- Beide kopiëren de **lokale `sporty.db` van de werkmap**, niet `herfst-test.db`.
- Ze falen identiek op een schone kopie van origin/main met de db van sporty-c, dus de oorzaak ligt in die db, niet in CH1.
- In een werkmap met een recentere `sporty.db` zijn ze mogelijk groen.

`f1-modules` is weer groen na mijn ene regel; zonder die regel was hij rood omdat hij de nieuwe GET-route niet kon invullen.

### GEVONDEN
- `test-v3c-fotos` en `test-veiligheid` lezen de `sporty.db` van de werkmap, dus hun uitslag hangt af van de map. Voorstel: ze laten draaien op `herfst-test.db`.
- `design/CHAUFFEUR-DEFINITIEF.html` ontbreekt in de repo, hoewel de prompt ernaar verwijst.
- De 403 bij `slot` voor een niet-kantoor-gebruiker is niet getest: herfst-test.db heeft geen chauffeur met pincode. De code controleert `req.persoon.rol==='kantoor'`.

---

## KO1 — Kantoor "Vandaag" + nieuwe hoofdnavigatie (chat C, Opus) · 2026-10-29

**Commits op `bouw-c`:**
- d2215d0: punt 1, `GET /api/vandaag` + `/api/mij/voorkeuren`
- 5168b51: punt 2, pagina `/vandaag` + index.html
- 24a0b10: punt 3, migratie 74 + test
- dit verslag

### Wat er gebouwd is
- **Punt 1: `routes/vandaag.js`, `GET /api/vandaag`.**
  - Alleen kantoor (alleenKantoor).
  - Alles komt uit bestaande tabellen.
  - Conflicten en tekorten komen uit de bestaande handlers van `/api/conflicten` en `/api/nakijk-tekorten`, aangeroepen in hetzelfde proces. Er is geen tweede kopie van die logica.
  - `?datum=YYYY-MM-DD` en `?periode_id=` zijn optioneel.
  - De kampweek telt vanaf `start_datum` van de periode. Buiten de periode is `week` null en is "deze week" de kalenderweek ma–zo.
- **Punt 2: `public/vandaag.html`, `.css` en `.js`, met de route `GET /vandaag`.**
  - De stijlen zijn 1-op-1 overgenomen uit `KANTOOR-DEFINITIEF.html`: Groot/Compact via dezelfde radio-`~`-selectoren, drie apart scrollende kolommen, en rechts twee apart scrollende vakken in de verhouding 4:5.
  - Na elke actie laadt de pagina `/api/vandaag` opnieuw.
  - Fouten verschijnen als toast in de stijl van index.html. `showToast` staat niet in een gedeeld bestand, dus de pagina heeft een kleine eigen kopie.
  - Wie geen kantoor is of geen token heeft, gaat naar `/`.
- **Punt 3: migratie 74, `personeel.voorkeuren TEXT DEFAULT '{}'`.**
  - `GET` en `PUT /api/mij/voorkeuren {vandaag_weergave:'groot'|'compact'}`. Een andere waarde geeft 400.
  - De pagina leest de voorkeur bij het laden en bewaart elke wissel.
- **Aanpassingen in `index.html`:**
  - (a) Een kantoorgebruiker zonder `#` in de URL gaat na het inloggen naar `/vandaag`. Dat geldt ook bij een bewaard token.
  - (b) De knop "🏠 Vandaag" staat links in de tabbalk. Hij heeft bewust geen `.nb`-klasse, omdat `goTo()` de `.nb`-knoppen op positie telt.

### Mapping 7 onderdelen → bestaande tabbladen
| Onderdeel | Link | Tabblad |
|---|---|---|
| 🏠 Vandaag | `/vandaag` | deze pagina |
| 📅 Planning | `/#kampplanner` | Kampplanner |
| 🚚 Transport | `/#transport-plan` | Transport (ritplanning) |
| 📦 Materiaal | `/#materiaal` | Materiaal |
| 📍 Locaties | `/#planning` | Locaties |
| 🧮 Voorraad & controles | `/#materiaal?tekorten` | Materiaal → subtab Nakijken (tekorten) |
| ⚙️ Beheer | `/#personeel` | Personeel |

De links en knoppen binnen de pagina:

| Waar | Link | Tabblad |
|---|---|---|
| Beslissen "alles ›" | `/#transport-noden` | aanvragen |
| Inplannen "alles ›" en "Rit plannen" | `/#transport-plan` | Transport (ritplanning) |
| Nakijken "alles ›" en "Open conflict" | `/#overzicht?conflicten` | Overzicht → Conflicten |
| Ritten vandaag "alles ›" | `/#transporten` | Transporten |
| Deze week "alles ›" | `/#kampplanner` | Kampplanner |

### Exacte JSON-vorm van `GET /api/vandaag`
```json
{
  "periode": {"id": 2, "naam": "Herfst TEST"},
  "gebruiker": {"naam": "Claude (API)"},
  "datum": "2026-11-04", "datum_tekst": "woensdag 4 november", "week": 1,
  "beslissen": [
    {"id": 3, "bron": "aanvraag", "ico": "📩", "kleur": "rood", "titel": "3 rollen tape · Abdijschool Vlierbeek",
     "sub": "aanvraag KV Test KV Abdijschool · 08:12",
     "acties": [
       {"label": "Afwijzen", "primair": false, "soort": "afwijzen", "methode": "PUT", "url": "/api/aanvragen/3/status", "body": {"status": "afgewezen"}},
       {"label": "Goedkeuren + spoed", "primair": true, "soort": "api", "methode": "PUT", "url": "/api/aanvragen/3/status", "body": {"status": "goedgekeurd", "maak_spoedtransport": true}}]},
    {"id": 4, "bron": "melding", "ico": "🚪", "kleur": "rood", "titel": "Chauffeur Jan bij Abdijschool Vlierbeek: locatie gesloten — geen sleutel",
     "sub": "melding 08:31 · rit onderweg · KV Lotte ook verwittigd",
     "acties": [
       {"label": "Bel conciërge", "primair": false, "soort": "tel", "url": "tel:0470112233"},
       {"label": "Afgehandeld", "primair": true, "soort": "api", "methode": "PUT", "url": "/api/aanvragen/4/status", "body": {"status": "afgehandeld"}}]}
  ],
  "inplannen": [
    {"id": "taak-199", "taak_id": 199, "ico": "🚚", "kleur": "oranje", "titel": "Rest van rit #22: Rozenweg → Abdijschool Vlierbeek", "pil": null,
     "sub": "donderdag 5 nov · 1 stuks · nog geen rit", "acties": [{"label": "Op een rit zetten", "primair": true, "soort": "link", "url": "/#transport-plan?taak=199"}]},
    {"id": "rit-22", "rit_id": 22, "ico": "🚐", "kleur": "oranje", "titel": "Rit #22 heeft nog geen voertuig", "sub": "woensdag 4 nov · Jan · 3 stops",
     "acties": [{"label": "Voertuig kiezen", "primair": true, "soort": "link", "url": "/#transport-plan?rit=22"}]},
    {"id": "conflict-3", "ico": "🔥", "kleur": "oranje", "titel": "<bericht van pool_tekort>", "sub": "capaciteitsconflict",
     "acties": [{"label": "Open conflict", "primair": false, "soort": "link", "url": "/#overzicht?conflicten"}]}
  ],
  "nakijken": [
    {"id": "conflict-0", "ico": "⚠", "kleur": "blauw", "titel": "Thema \"…\" is in week 1 ingepland op 2 locaties: …", "sub": "conflict",
     "acties": [{"label": "Open", "primair": false, "soort": "link", "url": "/#overzicht?conflicten"}]},
    {"id": "tekorten", "ico": "🧮", "kleur": "blauw", "titel": "12 tekorten open uit vrijdagcontroles · 4 besteld", "sub": "voorraad",
     "acties": [{"label": "Open", "primair": false, "soort": "link", "url": "/#materiaal?tekorten"}]}
  ],
  "ritten_vandaag": [
    {"id": 22, "tijd": "07:30", "chauffeur": "Jan", "voertuig": "", "status": "gepland", "stop_huidig": 1, "stops_totaal": 3,
     "stops": [{"naam": "Abdijschool Vlierbeek", "slot": "vast"}, {"naam": "Betekom", "slot": "vrij"}, {"naam": "Abdijschool Vlierbeek", "slot": "vrij"}]}
  ],
  "deze_week": [
    {"kampmoment_id": 167, "locatie": "Betekom", "thema": "Holderdebolder", "kv_naam": "Sam", "dagen": "ma–vr",
     "markeringen": ["vrijdagcontrole gepland", "⚠ oven", "kookdagen wo/do"]}
  ],
  "cijfers": {"ritten_onderweg": 0, "locaties_open": 1}
}
```

### Regels per lijst

**Beslissen**
- Bevat aanvragen met status `nieuw`: die van de periode en die zonder kampmoment.
- Ico van een aanvraag: kapot 💥, materiaal 📩.
- Ico van een chauffeursmelding, naar de tekst: gesloten 🚪, past niet 📩, anders 💥.
- "Goedkeuren + spoed" verschijnt bij kapot, of als het kamp in de huidige kampweek loopt. Anders staat er "Goedkeuren".
- "Bel conciërge" verschijnt alleen als de locatie een `contact_tel` heeft.
- De rit-status in de sub is die van de meest recente rit van die chauffeur, gezocht op `personeel_id` of op naam. Een melding bewaart zelf geen rit.

**Inplannen**
- Taken met status `gepland`, zonder rit en met een datum in de kampweek:
  - ico: rest 🚚, aanvraag 📩, levering 📦, ophaling ↩, anders 🔁;
  - een weekenddatum geeft 🏃 met `pil:"weekend"`.
- Ritten van deze week zonder chauffeur of zonder voertuig. Ritten die gedaan of geannuleerd zijn of geen taken hebben, tellen niet mee.
- Conflicten van het type `pool_tekort`, met 🔥.

**Nakijken**
- Alle andere conflicten van de huidige week: 📋 voor planningssoorten, ⚠ voor de rest.
- Eén regel 🧮 als er open tekorten zijn.

**`ritten_vandaag`**
- `tijd` is de vroegste taaktijd. Ritten hebben zelf geen tijdkolom.
- `stop_huidig` is het aantal gedane stops + 1.
- `status` is `gepland`, `onderweg` of `gedaan`.

**`deze_week.dagen`**
- "ma–vr" bij een themakamp.
- Bij themadagen de dagen uit `kampmoment_themas.dag`.

### Bewijs
- **`node scripts/test-ko1-vandaag.mjs` (poort 3334): 34 ok, 0 fout, ALLES GROEN, twee keer gedraaid.** De test controleert:
  - elke kolom: het juiste ico, de sub en de acties;
  - de slots van de rit: vast, vrij, vrij;
  - de cijfers, ook nadat een rit op onderweg is gezet;
  - de actie Afgehandeld: de melding verdwijnt;
  - lege lijsten buiten de periode;
  - een chauffeur krijgt 403;
  - de voorkeur: bewaard, per gebruiker, 400 bij een ongeldige waarde;
  - `/vandaag` geeft 200, met de drie kolomkoppen en de schakelaar in de HTML;
  - index.html stuurt door en heeft de knop.
- **Live gecontroleerd in de browser op 1920×900**, op een kopie van herfst-test.db met demodata:
  - Groot en Compact komen overeen met het ontwerp. In Compact verdwijnen de lichte knoppen.
  - De voorkeur `compact` werd bewaard.
  - "Goedkeuren + spoed": de toast meldt "gelukt", Beslissen gaat van 2 naar 1 en de nieuwe spoedrit zonder chauffeur verschijnt in Inplannen.
  - `/#transport-plan?taak=…` opent het tabblad Transport.
  - `/` met een kantoor-token gaat naar `/vandaag`.
- **`node scripts/volle-run.mjs`, drie keer:**

| run | groen | rood |
|---|---|---|
| 1 | 12/17 | v3c-fotos (3), veiligheid (3), plus eenmalig f1-schrijven (1), keten-periode (afgebroken zonder fout) en v3c-catalogus (8) |
| 2 | 15/17 | v3c-fotos (2), veiligheid (3) |
| 3 | 15/17 | v3c-fotos (2), veiligheid (3) |

**Toelichting bij de rode tests**
- `v3c-fotos` en `veiligheid` zijn dezelfde omgevingsafhankelijke rode tests als bij V3a, V3d en CH1. Ze lezen de lokale `sporty.db` en falen ook op een schone main.
- De drie extra rode tests in run 1 waren in run 2 en 3 groen, zonder codewijziging tussendoor. Ik houd het op flakiness: er liepen andere testservers, onder meer mijn eigen server op 3303 die net gestopt was. Ze raken geen KO1-code.
- `ko1-vandaag` is in alle drie de runs groen.

### Afwijkingen van het ontwerp
- **Demo-balk en frame:** de demo-balk (`.keuze`) bovenaan valt weg. Het frame vult het venster in plaats van vast 1920×900 te zijn; op 1920×900 is het beeld identiek.
- **Weekendtaak:** het ontwerp toont de knop "Bevestigen". Er bestaat geen bevestig-veld, en een veld verzinnen mag niet. De actie is daarom "Op een rit zetten".
  - `pil:"weekend"` zit wel in de JSON, en de sub zegt "weekend = uitzondering".
  - De pil wordt niet getekend, omdat het ontwerp er bij een item geen toont.
- **Ritten vandaag:** alleen de echte stops (taken) worden getoond, niet het vertrek- en terugdepot dat het ontwerp als tekst toont. Een rit heeft geen depotveld.
- **Inhoud van de kolommen:** die volgt de echte data. Zo geeft herfst-test.db veel "geen ophaling gepland"-conflicten in Nakijken.

### Buiten mijn gebied
- **`index.html`:** naast (a) en (b) staat er één regel in `bootApp()` die `#tab` (en `?conflicten` / `?tekorten`) uit de URL opent. Index.html had geen hash-navigatie, dus zonder die regel komen alle links van `/vandaag` op Overzicht uit.
- **`server.js`:** zoals toegestaan één regel, `'vandaag'` in de routelijst.

### Open
- **Selectie in Transport:** `?taak=ID` en `?rit=ID` openen alleen het tabblad. index.html kan nog geen taak of rit selecteren; dat hoort bij de Ritplanning-bouw.
- **Periode-kiezer:** die gebruikt de bestaande `POST /api/periodes/:id/activeer`. Wisselen verandert de actieve periode dus voor iedereen, net zoals bij de bestaande kiezer.
