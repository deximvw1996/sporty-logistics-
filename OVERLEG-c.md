
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

---

## RP1 — Ritplanning (weekagenda + dag-inzoom + ritdetail) (chat C, Opus) · 2026-10-29

**Commits op `bouw-c`:**
- c71a53c (punt 1: datamodel en ritten-API, migratie 75)
- e6698a1 (punt 2: `GET /api/ritplanning`, kantoor-wissel, ontkoppel)
- 2b6734e (punt 3: pagina `/ritplanning`, Vandaag-links, test)
- dit verslag

Gewerkt van 16:47 tot ±17:15.

### Wat er gebouwd is

**Punt 1 — Migratie 75 en de ritten-API**
- **Nieuwe kolommen** op `transport_ritten`:
  - `bestuurder_rol` (chauffeur, coordinator, kantoor of anders);
  - `voertuig_soort` (pool, eigen of huur);
  - `voertuig_capaciteit`;
  - `vertrek`.
- **Eenmalige backfill** (gepoort op `migratie75_klaar`): `vertrek` wordt de vroegste taaktijd en de pool-capaciteit komt uit `voertuig_types`.
- **`POST /api/ritten` en `PUT /api/ritten/:id`** nemen de nieuwe velden aan en geven 400 bij een ongeldige waarde.
  - Zonder `bestuurder_rol` wordt de rol afgeleid van `personeel.rol`: chauffeur blijft chauffeur, kantoor blijft kantoor, de rest wordt coordinator.
  - Een poolwagen zonder opgegeven capaciteit krijgt die van zijn voertuigtype.
  - `chauffeur` (naam) en `personeel_id` werken zoals vroeger.
- **`GET /api/ritten`** (en `?week=YYYY-MM-DD` voor één kalenderweek) geeft per rit ook `vertrek`, `einde`, `bezetting` en `waarschuwingen[]`. Mogelijke waarschuwingen:
  - "N bakken op M plaatsen"
  - "<naam> staat ook op rit #k om HH:MM"
  - "<naam> is die dag KV op <locatie>"
  - "weekend"

  Het zijn uitleg, nooit een verbod.

**Punt 2 — `routes/ritplanning.js`**
- `GET /api/ritplanning?week=` (alleen kantoor).
- `POST /api/ritten/:id/taken/:taakId/wissel` (▲▼, alleen kantoor). Er geldt geen slot-eis. Volgorde en tijd wisselen samen en de wissel wordt gelogd in `wijzigingen` (context `ritplanning`) en in het activiteitenlog.
- `POST /api/ritten/:id/taken/:taakId/ontkoppel` (✕, alleen kantoor). Als er al iets geladen is, geeft die 409. Anders verdwijnt de taak van de rit maar blijft ze op dezelfde dag staan, zodat ze terug bij "open" komt.
- `GET /ritplanning` geeft de pagina.

**Punt 3 — De pagina**
- `public/ritplanning.html`, `.css` en `.js`. De stijlen zijn 1-op-1 overgenomen uit `RITPLANNING-DEFINITIEF.html` (E1 + de lade).
- **Banen:** de pagina berekent ze zelf. Een rit komt in de eerste baan waar de vorige rit al gedaan is. De dagkolom krijgt als breedte-factor het aantal banen; een weekenddag zonder ritten krijgt 0,55.
- **Lade:**
  - links de dag-inzoom per bestuurder, met lege rijen "+ rit" voor de vaste chauffeurs en de rij "+ iemand anders";
  - rechts het ritdetail, de lijst "nog te plannen" of het formulier "+ rit".
- **Vandaag:** "Rit plannen", "Op een rit zetten" en "Chauffeur/Voertuig kiezen" gaan nu naar `/ritplanning`, `/ritplanning?taak=ID` en `/ritplanning?rit=ID`.

### JSON-vorm van `GET /api/ritplanning?week=YYYY-MM-DD`
```json
{
  "week": {"start": "2026-11-02", "eind": "2026-11-08", "nummer": 1, "kampweek": true},
  "dagen": [
    {"datum": "2026-11-06", "dag": "vr 6", "weekend": false,
     "ritten": [
       {"id": 27, "vertrek": "07:30", "einde": "09:30",
        "bestuurder": {"personeel_id": 1, "naam": "Maxim", "rol": "chauffeur", "kleur": "#0891b2"},
        "voertuig": {"naam": "Camionette", "soort": "pool", "capaciteit": 20},
        "bezetting": 23, "status": "gepland", "klaarzet_status": "",
        "waarschuwingen": ["23 bakken op 20 plaatsen", "Maxim staat ook op rit #32 om 13:30"],
        "stops": [{"taak_id": 210, "volgorde": 1, "tijd": "08:15", "slot": "vast", "locatie": "Abdijschool Vlierbeek",
                   "wat": "levering 14 · KV Test KV Abdijschool", "bakken": 14, "status": "gepland"}]}
     ],
     "open": [{"taak_id": 225, "type": "levering", "naam": "Levering Abdijschool Vlierbeek", "route": "Rozenweg → Abdijschool Vlierbeek",
               "stuks": 3, "tijd": "11:00", "soort": "rest|aanvraag|levering|ophaling|terugrit|weekend"}]}
  ],
  "personen": [{"personeel_id": 14, "naam": "Test KV Abdijschool", "rol": "kv", "bestuurder_rol": "coordinator", "kleur": "#ea580c", "vast": false}],
  "voertuigen": [{"naam": "Camionette", "soort": "pool", "capaciteit": 20}, {"naam": "Eigen wagen", "soort": "eigen", "capaciteit": null}, {"naam": "Huurwagen", "soort": "huur", "capaciteit": null}],
  "alle_personeel": [{"personeel_id": 10, "naam": "Claude (API)", "rol": "kantoor", "kleur": "#2563eb"}]
}
```
Regels:
- **`week`**:
  - `week.start` is de maandag van de gevraagde datum.
  - `nummer` is de kampweek van de actieve periode als de week daarin valt (dan `kampweek:true`), anders de ISO-week.
- **`personen`**: alle vaste chauffeurs (`vast:true`), ook zonder rit, plus iedereen die die week rijdt.
- **Kleuren**: `kleur` = `personeel_id` modulo het palet van 5 kleuren uit het ontwerp.
- **`bezetting`**: het maximum dat tegelijk aan boord is. De rit vertrekt met alle regels behalve die van ophalingen, lost bij een levering en laadt bij een ophaling (som van `qty`).
- **`einde`**: de laatste taaktijd.

### Bewijs
- **`node scripts/test-rp1-ritplanning.mjs` (poort 3335): 28 ok, 0 fout, ALLES GROEN**, gedraaid in de losse controle en in beide volle runs. Gecontroleerd:
  - 6 ritten in kampweek 1:
    - donderdag 2× Jesse tegelijk → "Jesse staat ook op rit #24 om 09:30";
    - woensdag 25 op 20 → "25 bakken op 20 plaatsen";
    - vrijdag een coördinator (KV) met huurwagen 15 → `coordinator`/`huur`/15, plus "… is die dag KV op Abdijschool Vlierbeek";
    - zaterdag → "weekend".
  - 4 open taken staan op de juiste dag, met soort rest, weekend of levering.
  - `personen` bevat de coördinator met een kleur en alle vaste chauffeurs.
  - Een kantoor-wissel op twee vaste stops → 200, tijden omgewisseld.
  - De chauffeur via de rit-link op een vaste stop krijgt nog steeds 409.
  - ✕ op een geladen taak → 409. ✕ op een niet-geladen taak → terug in "open" van die dag.
  - Een chauffeur krijgt 403 op `/api/ritplanning` en op de kantoor-wissel.
  - `/ritplanning` → 200 met legenda, dagkop en lade (inzoom + detail).
- **`test-ko1-vandaag`**: nog steeds 34 ok. Eén verwachting is aangepast naar de nieuwe link `/ritplanning?taak=`.
- **Live in de browser op 1920×900**, op een kopie van herfst-test.db met een zomervrijdag van 6 ritten, waarvan 5 tegelijk, met 2 coördinatoren:
  - De dagkop-flex is `1 / 1 / 1 / 2 / 5 / 0.55 / 0.55`, precies zoals in het ontwerp: vrijdag 5 banen, donderdag 2, lege weekenddagen gekrompen.
  - De dag-inzoom toont Maxim, Jeroen en Jesse (chauffeur), Test KV Abdijschool en Test KV Betekom (coördinator), de lege rij "+ rit" voor Test Chauffeur harnas, en "+ iemand anders".
  - **Ritdetail #27**, via `?rit=27`: vrijdag geselecteerd, waarschuwing "⚠ 23 bakken op 20 plaatsen …". Acties:
    - ▼ → "08:15 Betekom vrij | 09:30 Abdijschool 🔒 vast";
    - tik op het slot → beide vast;
    - Klaarzetten → "Klaargezet ✓";
    - Rit-link → toast met de link (het klembord is in de testbrowser niet beschikbaar, de toast toont dan de link);
    - ✕ → "Taak van de rit gehaald", en de teller "open" ging van 2 naar 3;
    - "→ aan rit" met keuze uit de 7 ritten van die dag + "nieuwe rit" → "Taak op rit #27 gezet".
  - Een weekendtaak vraagt bevestiging: "Dit is een weekendtaak: een uitzondering, geen verbod."
  - "+ iemand anders" met huurwagen 15 en vertrek 11:00 → rit #33, "coördinator rijdt mee · Huurwagen · 0/15 bakken".
- **`node scripts/volle-run.mjs`:**

| run | groen | rood |
|---|---|---|
| 1 | 15/19 | f1-schrijven (1), v3c-catalogus (8), v3c-fotos (3), veiligheid (3) |
| 2 | 17/19 | v3c-fotos (2), veiligheid (3) |

`rp1-ritplanning`, `ko1-vandaag` en `ch1-rit-api` zijn in beide runs groen.

### Afwijkingen van het ontwerp
- **Weggelaten demo-elementen:** de demo-balk (`.keuze`) en de CSS van de niet-gekozen varianten E2/E3. Het frame vult het venster; op 1920×900 is het beeld identiek.
- **Stops zonder depot:** de stops zijn alleen de echte taken. Het ontwerp toont ook "Rozenweg laden" aan het begin en "Rozenweg terug" aan het einde, maar een rit heeft geen depotveld en ik verzin er geen.
- **Standaarddag:** bij het openen is de eerste dag met ritten geselecteerd (in het ontwerp toevallig vrijdag). Met `?rit=`/`?taak=` is het de dag van die rit of taak.
- **"Dag openen":** het ontwerp zegt niet wat die knop doet. Hij toont nu de lijst "nog te plannen" van de gekozen dag. "Sluiten ✕" verbergt de lade.

### GEVONDEN
- **`v3c-catalogus` en `f1-schrijven` zijn rood in de eerste volle run en groen in de tweede.** Bij KO1 gebeurde precies hetzelfde.
  - `v3c-catalogus` werkt in de vaste map `D:\Sporty\sporty-e-v3c-catalogustest`, die alle chats delen. Los gedraaid zag ik "item_types 3345 → 3329": de database werd tussendoor door iets anders veranderd.
  - Waarschijnlijk lopen andere chats tegelijk volle runs. Dit raakt geen RP1-code.
- **`v3c-fotos` en `veiligheid`:** dezelfde omgevingsafhankelijke rode tests als bij V3a, V3d, CH1 en KO1. Ze lezen de lokale `sporty.db`.
- **Bezetting telt de som van `qty` van de regels.** Een bulkregel "5 × kleuterfiets" telt dus als 5 "bakken". Er bestaat geen bakken-equivalent per stuk. Als kantoor bakken anders wil tellen, is dat een aparte beslissing.
- **De bestaande ontkoppel-routes** (`PUT /api/transport-taken/:id/rit` met null en `bulk-ontkoppel`) controleren niet op geladen stukken en wissen de datum, waardoor de taak uit de week verdwijnt. Daarom heeft ✕ een eigen route. Mogelijk zijn die oude routes zelf een bug.
- **Splitsen is niet live getest:** in de demodata had geen stop meer dan één regel. De knop roept de bestaande splits-route aan, met een keuzevenster voor de stop, de regels en een datum.
- **Klembord:** de rit-link wordt naar het klembord gekopieerd. In de testbrowser lukte dat niet en toonde de toast de link (fallback).

### Buiten mijn gebied
- **`scripts/test-ko1-vandaag.mjs`:** één verwachting aangepast, de link van "Op een rit zetten" is nu `/ritplanning?taak=…`. Het is mijn eigen test van KO1, maar die stond niet in de lijst van deze prompt.
- **`server.js`:** zoals toegestaan één regel (`'ritplanning'` in de routelijst).

---

## TR1 — Transport › Taken op het standaardpagina-patroon (chat C, Opus) · 2026-10-29

**Commits op `bouw-c`:**
- 5aa3c16 (punt 1: API)
- 6bb4883 (punt 3: `patroon.css`)
- e18eb64 (punt 2: pagina `/taken` + test)
- een commit met de regel in `test-f1-modules`
- dit verslag

Gewerkt van 17:55 tot ±18:30.

### Wat er gebouwd is

**Punt 1 — `routes/taken.js`**
- `GET /api/taken-overzicht?week=YYYY-MM-DD[&alle=1]` en `GET /api/taken/:id/detail`, allebei alleen voor kantoor. Daarnaast `GET /taken` voor de pagina.
- Er worden alleen gegevens gelezen. Alle acties gaan via bestaande routes, behalve ✕ "Van rit halen": die gebruikt de RP1-route `POST /api/ritten/:id/taken/:taakId/ontkoppel`.
- Data en weergave zijn gescheiden, zodat de latere gsm-laag op dezelfde API kan (MOBIEL-REGEL).

**Punt 2 — De pagina (`public/taken.html`, `.css`, `.js`)**, als exacte kopie van de mockup:
- **Lijst:** zoekveld (op taak, locatie, rit en regel/bak) en 7 filterchips met tellers, waarvan er één actief is. Kolommen Taak (soort + pil rest/vrij/weekend), Wanneer, Route, Wat, Rit en Status.
- **Selectie:** selectievakjes plus "alles", met de voet "N taken · M geselecteerd" en de bulkknoppen.
- **Detailkop:** naam, subregel en de knoppen Bewerken, Splitsen, Van rit halen en Open rit #n (zonder rit: "Op een rit zetten").
- **Detailtabs:** Regels (het volle overzicht zoals in de mockup), Checks, Kampmoment en Historiek.
- **Inhoud van het detail:**
  - regels met ✕ en "+ Regel";
  - rit met bezetting/capaciteit en ⚠;
  - slot met de knop "🔒 Zet vast" of "Zet vrij";
  - checks (geladen, gelost, klaargezet);
  - de stops van de rit, met deze stop onderstreept;
  - het kampmoment met KV, contact, sleutel en de gekoppelde ophaling of levering (aanklikbaar);
  - de historiek met "↶ Terug".
- **Bulk:**
  - **Op een rit zetten:** keuze uit de ritten van die dag + "nieuwe rit" (→ `/ritplanning?taak=`), via `bulk-move`.
  - **Verplaatsen:** datum en/of tijd, via `PUT /api/transport-taken/:id` met de volledige taak.
  - **Verwijderen:** met bevestiging, via `bulk-delete`. Bij 409 verschijnt een toast.
  - **Bundelen:** uitgeschakeld, zie GEVONDEN.
- **Subbalk:** Export (bestaande `/api/export`, download), "Genereer uit planning" (bestaande `POST /api/transport-genereer`, na bevestiging) en "+ Nieuwe taak" (venster met de velden van de bewerkmodal).
- `?taak=ID` opent de week en het detail van die taak. Na elke actie wordt de pagina opnieuw geladen en elke fout verschijnt als toast.

**Punt 3 — `public/patroon.css`**
- Bevat de regels die Vandaag en Ritplanning letterlijk deelden (14), de subbalk (3) en de stijl van het bevestigingsvenster en het formulier (7).
- Die regels zijn uit `vandaag.css` en `ritplanning.css` gehaald. De drie pagina's laden `patroon.css` vóór hun eigen CSS.
- **Bewijs dat het beeld niet veranderde:** ik maakte een hash over álle berekende stijlen en posities van elk element op 1920×900, met dezelfde data.
  - Vandaag: 160 elementen, hash 1823108888 vóór en na.
  - Ritplanning (met rit #27 open): 377 elementen, hash 2487664090 vóór, na de eerste verschuiving en na de tweede.
  - Ik heb eerst gecontroleerd dat de hash bij herladen stabiel is.

### JSON-vorm

`GET /api/taken-overzicht?week=2026-11-04`
```json
{
  "week": {"start": "2026-11-02", "eind": "2026-11-08"},
  "bereik": {"van": "2026-11-02", "tot": "2026-11-08", "alle": false},
  "tellers": {"deze_week": 7, "zonder_rit": 4, "levering": 5, "ophaling": 1, "rest": 1, "weekend": 1, "gedaan": 0},
  "taken": [
    {"id": 196, "type": "levering", "soort": "rest|aanvraag|levering|ophaling|transfer", "pil": "rest|vrij|weekend|null",
     "datum": "2026-11-06", "tijd": "08:15", "wanneer_tekst": "vr 6 nov 08:15", "route": "Rozenweg → Abdijschool Vlierbeek",
     "wat": "3 bakken + Springkasteel ×2", "rit": {"id": 22, "chauffeur": "Jeroen", "voertuig": "Camionette", "status": "gepland"},
     "slot": "vast", "status": "gepland", "kampmoment_id": 168, "locatie_id": 29, "zoek": "196 rozenweg abdijschool … rit #22 jeroen bak …"}
  ]
}
```
Regels voor de lijst:
- **`wat`:** regels van soort thema, vast of bak tellen als "N bakken". De rest staat bij naam ("Oven ×1"); bij meer dan 2 andere regels wordt het "N stuks".
- **`wanneer_tekst`:** bevat de tijd alleen als de taak op een rit staat, zoals in de mockup.
- **`pil`:** de volgorde is rest, dan weekend, dan vrij (vrij alleen op een rit).
- **`?alle=1`:** geeft alle taken van de actieve periode. De tellers gaan altijd over de gekozen week.

`GET /api/taken/:id/detail`
```json
{
  "taak": {"…zelfde velden als in de lijst…": "", "opmerking": "", "van_locatie_id": 7, "naar_locatie_id": 29, "week": null},
  "regels": [{"id": 512, "code": "N20", "naam": "Bak Themabak 1/4 (kleuterbak) (N20)", "qty": 1, "soort": "thema"}],
  "rit": {"id": 22, "datum": "2026-11-06", "vertrek": "08:15", "chauffeur": "Jeroen", "voertuig": "Camionette", "bezetting": 19, "capaciteit": 20,
          "status": "gepland", "waarschuwingen": [], "stop_nr": 1,
          "stops": [{"taak_id": 196, "naam": "Abdijschool Vlierbeek", "slot": "vast", "is_deze": true}, {"taak_id": 197, "naam": "Betekom", "slot": "vrij", "is_deze": false}]},
  "checks": {"geladen": 0, "gelost": 0, "totaal": 3, "klaargezet": false},
  "kampmoment": {"id": 168, "locatie": "Abdijschool Vlierbeek", "thema": "Holderdebolder", "week": 1, "kv_naam": "Test KV Abdijschool", "kv_telefoon": "",
                 "contact_naam": "Conciërge", "contact_telefoon": "0470 11 22 33", "sleutel_info": "sleutel bij de buren"},
  "gekoppeld": {"ophaling_taak_id": 199, "tekst": "taak #199 · vr 6 nov · zonder rit"},
  "historiek": [{"t": "2026-10-29T17:20:39.000Z", "wie": "Claude (API)", "wat": "op rit #22 gezet (api)", "wijziging_id": 41},
                {"t": "…", "wie": "", "wat": "Taak #196: 1 regel(s) afgesplitst …", "wijziging_id": null}]
}
```
- **`rit` en `kampmoment`** zijn `null` als de taak geen rit of geen kampmoment heeft.
- **`gekoppeld`** bevat bij een levering de ophaling van hetzelfde kampmoment, en omgekeerd.
- **`historiek`:**
  - Bevat de rijen uit `wijzigingen` voor deze taak (nieuwste eerst, in leesbare taal: "op rit #22 gezet", "van rit #22 gehaald", "slot: vast → vrij"), plus de regels uit `activiteiten_log` die "Taak #id" noemen.
  - `wijziging_id` staat erbij voor een latere terugdraai-route.

### Bewijs
- **`node scripts/test-tr1-taken.mjs` (poort 3336): 26 ok, 0 fout, ALLES GROEN.** De test controleert:
  - 7 taken in kampweek 1: levering op een rit, levering op een rit met slot vrij, levering zonder rit, ophaling, rest-taak, goedgekeurde aanvraag (spoed) en zaterdagtaak;
  - de tellers;
  - soort, pil, wat, route en `wanneer_tekst`;
  - `?alle=1`;
  - het detail: regels met code N20, de rit met stops, `is_deze` en capaciteit 20, de checks, het kampmoment met KV, contacttelefoon en sleutel, gekoppeld = de ophaling, en minstens 2 historiekregels;
  - 404 voor een onbekende taak;
  - `bulk-move` zet 2 taken op een andere rit;
  - na het laden van een stuk geeft `bulk-delete` 409 en wordt niets verwijderd;
  - een chauffeur krijgt 403;
  - `/taken` heeft de subbalk, 7 chips en de voet;
  - `/taken`, `/vandaag` en `/ritplanning` laden `patroon.css`.
- **Live in de browser op 1920×900** (kopie van herfst-test.db met de RP1-demoweek):
  - **Lijst:** 23 taken; chips "Deze week 23 · Zonder rit 4 · Levering 23 · Ophaling 0 · Rest 0 · Weekend 1 · Gedaan 0", elk 36 px hoog en op één regel.
  - **Filter en zoeken:** "Zonder rit" toont 4 taken, zoeken op "marko" 2.
  - **Selectie:** 2 taken aangevinkt → voet "23 taken · 2 geselecteerd" met de bulkknoppen.
  - **`?taak=216`** opent het detail.
  - **Acties die werkten:**
    - "+ Regel" (Pionnen ×20) → "Regel toegevoegd";
    - Splitsen → "1 regel(s) naar taak #219";
    - Bewerken (tijd 11:30) → "Taak opgeslagen", Historiek 3;
    - "Op een rit zetten" met keuze #27/#28/#29… → "1 taak op rit #27 gezet", "stop 3 van 3";
    - "Zet vrij" → "Slot: vrij";
    - "Van rit halen" → "zonder rit";
    - "+ Nieuwe taak" → taak #220;
    - bulk Verplaatsen van #220 en #219 naar do 5 nov → "2 taken verplaatst";
    - bulk Verwijderen met bevestiging "2 taken verwijderen?" → weg uit de lijst;
    - ✕ regel met bevestiging "Pionnen × 20 van taak #216" → "Regel verwijderd".
  - De screenshot van lijst + detail (#201) komt overeen met de mockup.
- **`node scripts/volle-run.mjs`:**

| run | groen | rood / afgebroken |
|---|---|---|
| 1 | 18/21 | f1-modules (1, van mij: nieuw pad niet ingevuld), v3c-fotos (2), veiligheid (3) |
| 2 | 17/21 | f1-modules (1, idem), f1-wijzigingen (afgebroken), v3c-fotos (2), veiligheid (3) |
| 3 (na de f1-modules-regel) | 19/21 | v3c-fotos (2), veiligheid (3) |
| 4 | 18/21 | ch1-rit-api (afgebroken na 0,2 s zonder uitvoer), v3c-fotos (2), veiligheid (3) |

`tr1-taken`, `rp1-ritplanning` en `ko1-vandaag` zijn in alle runs groen.

### Afwijkingen van de mockup
- **Demo-balk en frame:** de demo-balk (`.keuze`) valt weg. Het frame vult het venster; op 1920×900 is het beeld identiek.
- **Tab "Regels":** toont zoals de mockup alle blokken. De tabs Checks, Kampmoment en Historiek tonen alleen hun eigen blok; de mockup laat die tabs niet zien.
- **Filterchips:** `white-space:nowrap` erbij. Met echte tellers liep "Deze week 23" anders over twee regels.
- **Pilkleuren:** `.pil.rood` en `.pil.blauw` toegevoegd. De mockup gebruikt die klassen (weekend, onderweg) maar definieert ze niet; de kleuren komen uit Vandaag en Ritplanning.
- **Knoppen zonder route** zijn uitgeschakeld, met uitleg (zie GEVONDEN): "↶ Terug" en "Bundelen".

### GEVONDEN
1. **Er bestaat geen terugdraai-route voor `wijzigingen`.** `wijziging_id` zit in de historiek, maar "↶ Terug" is uitgeschakeld met de uitleg "Terugdraaien bestaat nog niet als route". Nodig: een route die één wijziging terugzet (`oud` terugschrijven, zelf gelogd).
2. **Er bestaat geen bundel-route** om meerdere taken van dezelfde dag en bestemming samen te voegen. "Bundelen" is uitgeschakeld met uitleg.
3. **`bulk-move` verplaatst taken naar een rit, niet naar een datum.** Voor "Verplaatsen" (datum/tijd) bestaat geen bulkroute. De pagina doet daarom per taak `PUT /api/transport-taken/:id` met de volledige taak.
   - Die PUT zet bij ontbrekende velden standaardwaarden (type, tijd 09:00, status gepland), dus de pagina stuurt altijd de hele taak mee.
   - Taken op een rit houden de datum van hun rit; dat staat ook in het venster.
4. **`PUT /api/transport-taken/:id/move` maakt bij een losse taak een eigen 1-op-1-rit aan.** Daarom heb ik die niet gebruikt voor Verplaatsen.
5. **Bewerken:** de bewerkmodal van `index.html` zit in dat bestand en is niet los te laden. Taken heeft een eigen venster met dezelfde velden: type, datum, tijd, van, naar, opmerking.
6. **Export** is de bestaande volledige export (`/api/export`, JSON van de hele database). Een export van alleen de takenlijst bestaat niet.
7. **"Genereer uit planning" heb ik niet live geklikt**, omdat die voor alle kampmomenten taken aanmaakt. Hij roept de bestaande route aan na bevestiging.
8. **Rode of afgebroken tests die niet van mij zijn:**
   - `v3c-fotos` en `veiligheid` lezen de lokale `sporty.db` (zie V3a/CH1/KO1/RP1).
   - `f1-wijzigingen` (run 2) en `ch1-rit-api` (run 4) braken af. Los gedraaid zijn ze groen (46 ok en 40 ok). Waarschijnlijk een poortbotsing met testruns van andere chats.

### Buiten mijn gebied
- **`scripts/test-f1-modules.mjs`:** één regel (`.replace('/api/taken/:id', '/api/taken/999999')`). Zonder die regel kan de route-inventaris het nieuwe pad niet invullen, zoals bij CH1. Resultaat: 404, geen 500.
- **`public/ritplanning.html`:** de subbalklink "Taken" gaat nu naar `/taken` (was `/#transport-plan`). De prompt noemde alleen `ritplanning.js`, maar de link staat in de HTML.
- **`server.js`:** één regel, `'taken'` in de routelijst.

---

## GR1 — Generale repetitie: fictieve herfst uit de zomerdata (chat C, Opus) · 2026-10-29

Gewerkt van 18:37 tot ±19:35.

**Commits op `bouw-c`:**
- punt 1: `scripts/generale-repetitie.mjs` + `.gitignore`
- punt 2: `scripts/test-gr1-keten.mjs`
- punt 3: `GENERALE-REPETITIE.md`
- dit verslag

Routes en pagina's zijn niet aangeraakt.

### Wat er gebouwd is
- **`scripts/generale-repetitie.mjs --doel=lokaal|prod [--opruimen]`**
  - Lokaal: verse kopie van `sporty.db` uit de werkmap, eigen server op poort 3340.
  - Prod: `SPORTY_PROD_PW` + persoon 10/1111.
  - Alles gaat via de API. Alles wat het script maakt draagt "FICTIEF" in naam of opmerking. Het script is idempotent: bestaat er al iets met die naam, dan wordt het hergebruikt.
  - Het exporteert `verbind`, `opbouw` en `opruimen`; de ketentest gebruikt dezelfde code.
  - Het overzicht gaat naar `GENERALE-REPETITIE-links.json` (gitignored).
  - **Niet op prod gedraaid**, zoals de prompt vraagt.
- **`scripts/test-gr1-keten.mjs`**
  - Bouwt zelf op (verse kopie), speelt de 8 stappen, ruimt op en vergelijkt de rijtellingen per tabel.
  - Draait alleen met `GR1=1`. Zonder die variabele meldt hij "overgeslagen" + ALLES GROEN: `volle-run.mjs` pakt elk `test-*.mjs` op en de naam lag vast in de prompt.
- **`GENERALE-REPETITIE.md`**: het draaiboek voor Maxim op prod (≤ 2 pagina's), met per stap wie, welk scherm, wat je doet en wat je moet zien, en plaatshouders voor de links.

### Overzicht (lokaal, `GR1=1 node scripts/test-gr1-keten.mjs`)

Periode "Herfst 2026 FICTIEF" (2–8 nov), actief; de vorige actieve periode was "Zomer 2026". Stockage: Rozenweg, Kantoor en Marko.

| Locatie | Type | Thema('s) | KV |
|---|---|---|---|
| Abdijschool Vlierbeek | kamp | 1001 Ballen en Bellen + Slag- en balsporten | Evy |
| Boutersem | kamp | De Bouwfabriek | Guiseppe |
| Betekom | kamp | Play a game | KV A |
| Rotselaar | kamp | De Speelfabriek | KV A |
| De Kraal | kamp | Actie & Avontuur + Welkom op de boerderij | KV X |
| De Waaier | kamp | Sportymadness | SIM KV Anna |
| De Ark 3 | kamp | We slaan in het rond | SIM KV Bram |
| Sportschuur | themadag | Apenstreken / 1001 ballen / Apero go / Alice in Wonderland / Art @ Sporty (dag 0–4) | Seppe |

| Rit | Dag | Vertrek | Bestuurder | Voertuig | Bezetting | Waarschuwing |
|---|---|---|---|---|---|---|
| #28 | vr 30 okt | 07:30 | Jeroen | Camionette | 31/20 | 31 bakken op 20 plaatsen |
| #29 | vr 30 okt | 07:30 | Jesse | Camion | 13/40 | — |
| #30 | vr 30 okt | 08:00 | Maxim | Camionette | 40/20 | 40 bakken op 20 plaatsen |
| #31 | vr 30 okt | 09:00 | Evy (coördinator) | Huurwagen | 8/15 | — |
| #32 | vr 6 nov | 13:00 | Jeroen | Camion | 53/40 | 53 bakken op 40 plaatsen |
| #33 | vr 6 nov | 13:30 | Jesse | Camion | 39/40 | — |
| #34 (stap 3) | vr 30 okt | 15:00 | Maxim | Camionette | rest-taak | — |
| #35 (stap 7) | za 7 nov | 08:30 | Jesse | Camion | sportdag | weekend |

- **Transport:** 7 leveringen (vr 30 okt) en 7 ophalingen. De generator plande de ophalingen op ma 9 nov; de ritten zetten ze op vr 6 nov.
- **Vandaag op 2 nov** (direct na de opbouw): beslissen 0, inplannen 7, nakijken 5, ritten_vandaag 6, deze_week 8, locaties_open 8.
  - De 6 ritten en een deel van "inplannen" zijn oude testritten op 2 nov die al in de werkmap-`sporty.db` stonden. Prod heeft die niet.

### De 8 stappen

| Stap | Uitslag | Wat er gecontroleerd is |
|---|---|---|
| 1 do 29 okt | GROEN met OVERGESLAGEN (gat 1) | ritplanning vr: 4 FICTIEF-ritten; Vandaag: 0 beslissingen voor de fictieve locaties; /vandaag en /ritplanning → 200 |
| 2 vr 30 okt | GROEN met OVERGESLAGEN (gaten 2, 3) | rit-link #28: past niet op stop 2 → rest-taak (rest_van_rit_id, slot vrij); 30/30 geladen; vrije stops gewisseld (200); aankomen + lossen → rit gedaan; ritplanning toont "bakken op 20 plaatsen"; coördinator-rit #31 → gedaan; /rit/:token → 200 |
| 3 rest plannen | GROEN | rit #34 om 15:00 met de rest-taak, klaargezet; in de ritplanning niet meer open |
| 4 ma 2 nov | GROEN | 7 KV's tellen en versturen (5 kloppen, 1 tekort + notitie, 1 kapot + foto + te veel); 1 KV telt niet; aanvraag + kapot-melding + chauffeursmelding (gesloten) → 200; /kv/:token → 200 |
| 5 kantoor | GROEN met OVERGESLAGEN (gat 4) | Vandaag › Beslissen: 🚪 melding, 💥 oven, 📩 ballen; /nakijken: 65 bakken te keuren, 33 niet geteld; acties bestellen / naar pool / afschrijven; 65 keuringen afgerond; herinnering naar Seppe; aanvullijst met 3 handelingen (bestelling, afschrijven, naar_pool); printlijst en /nakijken → 200 |
| 6 di 3 nov | GROEN met OVERGESLAGEN (gat 5) | alle 3 handelingen afgevinkt |
| 7 vr 6 nov | GROEN met OVERGESLAGEN (gat 6) | ophaalritten #32 (4/4) en #33 (3/3) gedaan; /taken: 7 ophaaltaken gedaan; weekendtaak met pil weekend → rit #35 met waarschuwing "weekend" |
| 8 einde | GROEN met OVERGESLAGEN (gaten 7, 8) | geen dubbel thema; wijzigingen per stap 0 / 73 / 4 / 3 / 71 / 3 / 155 (stap 1 is enkel kijken); opruimen: periode, kampmomenten, ritten, taken en personeel exact terug op het begin; "Zomer 2026" weer actief |

Uitslag: 35 ok, 0 fout, ALLES GROEN.

### GEVONDEN

1. **Stap 1 — Vandaag toont geen ritten van morgen.** Kantoor ziet op donderdag de leveringen van vrijdag alleen in de Ritplanning.
   *Voorstel:* een regel "morgen: N ritten" in het rechterblok van Vandaag.
2. **Stap 2 — De rest-taak krijgt een lege datum.** `transport.js` maakt ze aan met `datum=''` en `week=null`. Daardoor staat ze **niet in /taken** (filtert op datum) en **niet op Vandaag › Inplannen** (zoekt op datum of kampweek). Kantoor vindt de rest-taak dus nergens in de nieuwe schermen.
   *Voorstel:* de rest-taak erft de datum van de rit, of /taken en Vandaag tonen taken zonder datum apart.
3. **Stap 2 — "Bewust één rit over capaciteit" lukt niet.** 3 van de 6 ritten zitten erover (31/20, 40/20, 53/40). De bezetting telt elke regel (`qty`), en één themaset is al groter dan een Camionette.
   *Voorstel:* kantoor beslist hoe "bakken" telt: per regel, per bak, of bulkstukken apart.
4. **Stap 5 — Vandaag › Nakijken toont de te keuren tellingen niet.** Het blok toont alleen conflicten en open tekorten.
   *Voorstel:* een regel "N bakken te keuren · M niet geteld" met de link naar /nakijken.
5. **Stap 6 — Geen coördinatorlogin.** Afvinken gebeurt met de kantoor-login. Er is geen rol "coördinator" en de bestaande KV-personen hebben geen pincode.
   *Voorstel:* de rol coordinator, of KV's met een pincode op de gsm (zie MOBIEL-REGEL).
6. **Stap 7 — De bevestiging van een weekendtaak wordt nergens bewaard.** Ze bestaat alleen als vraagModal in de pagina.
   *Voorstel:* een veld `weekend_bevestigd` (wie en wanneer) op de taak.
7. **Stap 8 — `/api/conflicten` is niet "leeg behalve capaciteit".** Er staan meldingen in van de soorten geen_levering, geen_ophaling, elders_nodig_vast, ontbrekend_transport en locatieconfig_onvolledig. De themadaglocatie krijgt geen levering (zie 10). Rit-capaciteit is geen conflict, enkel een waarschuwing op de rit.
8. **Stap 8 — Opruimen laat rijen achter die geen verwijderroute hebben:**
   - `kalender_dagen` 291→331 (blijven staan na `DELETE kampmoment`);
   - `nakijk_sessies` 6→71 en `nakijk_regels` 129→406;
   - `aanvragen` 1→5.

   `DELETE /api/kampmomenten/:id` wist ook de transportregels en checks niet zelf: het script verwijdert de taken daarom eerst via `bulk-delete`. Op prod blijft dit restant na `--opruimen` staan.
   *Voorstel:* een opruimroute "kampmoment volledig verwijderen" (alleen kantoor, gelogd).
9. **Punt 1 — De stockage heet "Marko", niet "Marco".** Het script gebruikt "Marko".
10. **Punt 1 — Ophalingen en themadag in de generator:**
    - de generator plant ophalingen op de eerste werkdag ná het kamp (ma 9 nov), niet op vrijdag;
    - een themadag-kampmoment krijgt geen levering of ophaling (bekend, commentaar in `transport-genereer`).
11. **Punt 1 — Kookdagen zijn niet per kampmoment in te stellen.** `heeft_kookactiviteit` is een eigenschap van het thema en staat op 0 bij alle 184 thema's. "Kookdagen wo/do op 3 locaties" kon niet zonder echte thema's te wijzigen.
12. **Stap 4 — KV-tellingen staan niet in `wijzigingen`.** `kv.js` schrijft `nakijk_sessies` en `nakijk_regels` met `run`/`ins` en niet met `insMetLog`, dus ze staan niet in de historiek en zijn niet omkeerbaar. Stap 4 had maar 3 wijzigingsregels: de aanvraag, de kapot-melding en de chauffeursmelding.
13. **Thema's: 5 kleuter- in plaats van 4.** 7 kamplocaties, waarvan 2 met twee thema's, vragen 9 verschillende thema's (8 zou een dubbel thema geven). Het zijn er dus 5 kleuter- en 4 lagereschoolthema's. Het KV-plan "6 kloppen + tekort + kapot + 1 telt niet" telt 9 KV's voor 8 locaties; gespeeld is 5 + 1 + 1 + 1.
14. **Pagina's: alleen JSON en HTTP 200 getest.** De ketentest controleert per scherm de data-JSON en of de pagina met 200 laadt, niet de DOM: er is geen headless browser. De DOM van Vandaag, Ritplanning en Taken werd in KO1, RP1 en TR1 live gecontroleerd.

### Volle run
| run | groen | rood |
|---|---|---|
| 1 | 21/23 | v3c-fotos (2), veiligheid (3) |
| 2 | 21/23 | v3c-fotos (2), veiligheid (3) |

- `gr1-keten` staat erin als "GROEN 0/0 (overgeslagen)": zonder `GR1=1` doet hij niets.
- De twee rode tests zijn de bekende omgevingsafhankelijke tests: ze lezen de lokale `sporty.db`.

---

## MA1 — Materiaal › Bakken op het patroon + rek/plank per bak (chat C, Opus) · 2026-10-29

Gewerkt van 19:43 tot ±20:30.

**Commits op `bouw-c`:**
- dff92c9: punt 1
- db34105: punt 2
- f2fb9c0: punt 3 + test
- dit verslag

### Wat er gebouwd is

**Punt 1 — Rek en plank (werklijst 82)**
- **Migratie 79** voegt `bakken.rek`, `bakken.plank` en `item_types.pool_plaats` toe.
- **Thuisplaats:** die bestond al als `bakken.thuislocatie_id`. Er is geen tweede kolom bijgekomen; `thuis_locatie_id` werkt als alias.
- **Eenmalige backfill** (`migratie79_klaar`):
  - `rek` = de eerste letter van de code (A–Z): 299 bakken in herfst-test.db;
  - bakken zonder thuis krijgen Rozenweg: 0 op herfst-test.db.
- **`PUT /api/bakken/:id`** neemt `rek`, `plank` en `thuis_locatie_id` aan:
  - alleen kantoor, anders 403;
  - gelogd via `updateMetLog`;
  - `rek` wordt in hoofdletters bewaard;
  - een thuisplaats moet een stockage zijn (anders 400).
- **Aanvullijst (`routes/nakijken.js`):**
  - `plaats` komt nu uit `rek`/`plank` (`{rek, plank, tekst:"rek N · plank 3"}`). Zonder rek valt hij terug op de oude afleiding uit de code.
  - Bij `uit_pool`/`naar_pool` komt de `pool_plaats` van het stuk in `waar_tekst` ("uit de pool (rek P · bak P-03)") als die gekend is.

**Punt 2 — `routes/bakken-overzicht.js`**
- `GET /api/bakken-overzicht` en `GET /api/bakken/:id/detail` (`?soort=attribuut` voor attributen), allebei alleen voor kantoor.
- `DELETE /api/bakken-overzicht/:id` controleert eerst. 409 als de bak onderweg is (geladen, niet gelost) of een open telling heeft. Daarna roept hij de bestaande `DELETE /api/bakken/:id` of `/api/attributen/:id` aan, met hetzelfde opruimgedrag en dezelfde log.
- `GET /bakken` en `GET /etiketten` geven de pagina's.

**Punt 3 — De pagina's**
- **`/bakken`** (`public/bakken.{html,css,js}`, laadt `patroon.css`) is een exacte kopie van de mockup:
  - subbalk: Thema's · Bakken · Pool · Catalogus + Export / 🖨 Etiketten / + Nieuwe bak;
  - 7 chips (Alle · Thema · Vast · Attribuut · Onderweg · ⚠ Incompleet · Rozenweg) en een zoekveld;
  - de kolommen uit de mockup, selectie en de bulkvoet.
- **Detail:** de kop met de knoppen Bewerken · 🖨 Etiket · Verplaatsen · Inhoud aanpassen, en de tabs Inhoud · Foto's · Waar geweest · Tellingen · Historiek. De tab Inhoud volgt de mockup: links de inhoud met ✕ en "+ Stuk", rechts foto's met "+ foto", "waar is de bak" (nu, terug, thuis) en de historiek.
- **`?id=N`** opent het detail van bak N; `?id=aN` dat van attribuut N.
- **Acties** gebruiken de bestaande routes:
  - **Stukken:** "+ Stuk" voegt toe via `bakken/:id/items` (themabak) of `vaste-bakken/:id/items` (vaste bak), met een zoeklijst uit `/api/item-types`. ✕ verwijdert via `bak-items/:id` of `vaste-bak-items/:id`.
  - **Foto:** `POST /api/bakken/:id/foto`, verwerkt met `lib/fotos.js`.
  - **Verplaatsen:** `POST /api/bakken/:id/verplaats` of `/api/attributen/:id/verplaats` met een verplichte reden, plus `PUT` voor rek en plank.
  - **Aan thema koppelen:** `POST /api/themas/:id/bakken` (`{bak_id}`) of `/attributen` (`{attribuut_id}`).
  - **Bewerken:** `PUT /api/bakken/:id` (attributen: `/api/attributen/:id`).
  - **+ Nieuwe bak:** naar soort `POST /api/themas/:id/bakken`, `/api/vaste-bakken` of `/api/attributen`.
- **`/etiketten?ids=b12,a5`** (`public/etiketten.html`): printbare A4 met 3 × 7 etiketten van 70 × 42 mm, met code, naam, thema en thuis · rek · plank.

### JSON-vorm
`GET /api/bakken-overzicht`
```json
{"tellers": {"alle": 551, "thema": 351, "vast": 115, "attribuut": 85, "onderweg": 1, "incompleet": 5, "per_stockage": {"Rozenweg": 549}},
 "bakken": [{"id": 11854, "soort": "thema|vast|attribuut|pool", "code": "N20", "naam": "Themabak 1/4 (kleuterbak)", "thema": {"id": 4082, "naam": "1001 Ballen en Bellen"},
   "waar_nu_tekst": "Abdijschool Vlierbeek wk 1 | Rozenweg · rek N plank 2 | onderweg rit #22", "waar_nu": {"locatie_id": 29, "rit_id": null},
   "inhoud_tekst": "3 soorten · 40 stuks | 1 | 12 stuks", "stand_tekst": "ok | tekort 1 | te veel 2 | kapot 1 | niet geteld | tekort 1 · besteld",
   "status": "ok|let", "incompleet": true, "rek": "N", "plank": "3", "thuis_locatie_id": 7, "zoek": "n20 themabak … rozenweg"}]}
```
Regels voor de lijst:
- **`soort`:** `pool` = vaste bak met `is_bulk`; die telt mee in `vast`.
- **`stand`:** komt uit de laatste `nakijk_sessie` van de bak.
- **`status`:** `let` bij tekort, te veel of kapot. `incompleet` = tekort of kapot.
- **`waar_nu`:**
  - "onderweg rit #n" zolang er een check geladen maar niet gelost is;
  - op de thuisstockage: met rek en plank;
  - op een kamplocatie: met de week van het kampmoment in de actieve periode.

`GET /api/bakken/:id/detail`
```json
{"bak": {"…zelfde velden…": "", "thuis_tekst": "Rozenweg · rek N · plank 3", "notitie": ""},
 "inhoud": [{"item_id": 85476, "naam": "Voetballen", "qty": 10, "item_type_id": 3216, "stand_tekst": "tekort 1 · besteld"}],
 "fotos": [{"id": 3, "url": "/uploads/…", "beschrijving": "open", "t": "…", "wie": "…"}],
 "waar": {"nu_tekst": "Abdijschool Vlierbeek wk 1", "nu_door": "Jeroen", "nu_op": "do 29 okt 19:55", "nu_rit_id": 22,
          "terug_tekst": "ophaling vr 6 nov 09:00 · rit #23", "thuis_tekst": "Rozenweg · rek N · plank 3"},
 "waar_geweest": [{"t": "…", "datum": "do 29 okt 19:55", "actie": "gelost|geladen", "locatie": "Abdijschool Vlierbeek", "rit_id": 22, "chauffeur": "Jeroen"}],
 "tellingen": [{"sessie_id": 1, "datum": "…", "kv": "Test KV Abdijschool", "uitslag": "tekort 1 · besteld", "kv_status": "ingediend", "kantoor_status": "nagekeken", "locatie": "Abdijschool Vlierbeek", "week": 1}],
 "historiek": [{"t": "…", "wie": "Claude (API)", "wat": "plank: — → 2 (api)", "wijziging_id": 812}]}
```

### Bewijs
- **`node scripts/test-ma1-bakken.mjs` (poort 3337): 25 ok, 0 fout, ALLES GROEN.** Gecontroleerd:
  - **Overzicht en migratie:**
    - de tellers per soort (thema + vast + attribuut = alle);
    - migratie 79: N20 heeft rek N en thuis Rozenweg;
    - attribuut "1" en pool "N stuks".
  - **Rek, plank en thuis:**
    - `PUT` rek/plank, in hoofdletters bewaard;
    - de bak thuis toont "Rozenweg · rek N plank 2";
    - de wijziging staat in de historiek ("plank: — → 2");
    - een thuis op een kamplocatie geeft 400.
  - **Onderweg en gelost:**
    - een bak op een rit (geladen) toont "onderweg rit #22", teller onderweg 1;
    - verwijderen van een bak onderweg → 409;
    - na het lossen: "Abdijschool Vlierbeek wk 1".
  - **Telling:**
    - een KV-telling met één te weinig geeft stand "tekort 1", status `let`;
    - verwijderen met een open telling → 409.
  - **Aanvullijst** na de keuring: plaats "rek N · plank 3".
  - **Detail:**
    - de inhoud per stuk met stand;
    - waar geweest: gelost op Abdijschool en geladen in Rozenweg (rit #22);
    - tellingen 1, historiek 5;
    - "terug: ophaling vr 6 nov · nog geen rit";
    - attribuutdetail 200, onbekende bak 404.
  - **Rechten:** een chauffeur krijgt 403 op het overzicht, het detail, rek/plank en verwijderen.
  - **Verwijderen zonder blokkade:** een losse bak zonder rit of telling wordt verwijderd.
  - **Pagina's:** `/bakken` heeft de subbalk, 7 chips, de voet en `patroon.css`; `/etiketten` geeft 200.
- **`test-vc1-nakijken`** (aanvullijst) blijft groen: 46 ok.
- **Live in de browser op 1920×900** (DOM-dump; de screenshot timede uit bij de lijst van 551 rijen, zie `reference_fmdl_responsive_screenshot`):
  - Lijst 860 px links, detail 988 px rechts. De chips "Alle 551 · Thema 351 · Vast 115 · Attribuut 85 · Onderweg 0 · ⚠ Incompleet 5 · Rozenweg", elk 36 px hoog.
  - Na het aanvinken: "351 bakken · 2 geselecteerd" met de 4 bulkknoppen.
  - Zoeken op "n20" geeft één rij: "N20 Themabak 1/4 (kleuterbak) · 1001 Ballen en Bellen · Abdijschool Vlierbeek wk 1 · 3 soorten · 40 stuks · tekort 1 · besteld ⚠".
  - **Detailkop:** "N20 · Themabak 1/4 (kleuterbak) | 1001 Ballen en Bellen · nu bij Abdijschool Vlierbeek wk 1 · thuis: Rozenweg · rek N · plank 3 · tekort 1 · besteld".
    - Knoppen: Bewerken · 🖨 Etiket · Verplaatsen · Inhoud aanpassen.
    - Tabs: Inhoud 3 · Foto's 0 · Waar geweest 2 · Tellingen 1 · Historiek 5.
  - **Waar is de bak:**
    - Nu: "Abdijschool Vlierbeek wk 1 · gelost do 29 okt 19:55 door Jeroen (rit #22)";
    - Terug: "ophaling vr 6 nov 09:00 · rit #23";
    - Thuis: "Rozenweg · rek N · plank 3".
  - **Verplaats-venster:** velden Naar locatie, Reden, Rek en Plank, met 42 locaties. Plank 4 gekozen → "1 verplaatst", de kop toont "plank 4".
- **`node scripts/volle-run.mjs`, twee keer: 24/26 groen.** Alleen `v3c-fotos` (2) en `veiligheid` (3) zijn rood, dezelfde omgevingsafhankelijke tests als altijd (ze lezen de lokale `sporty.db`). `ma1-bakken` is in beide runs groen (25 ok).

### Afwijkingen van de mockup
- **Demo-balk en frame:** de demo-balk (`.keuze`) valt weg. Het frame vult het venster; op 1920×900 is het beeld identiek.
- **Chip "Rozenweg":** zonder teller, zoals in de mockup. Hij filtert op bakken die nu in de Rozenweg staan.
- **"↶ Terug" in de historiek:** uitgeschakeld met uitleg. Er bestaat geen terugdraai-route (GEVONDEN TR1 #1).
- **Pilkleuren:** `.pil.rood` en `.pil.blauw`, plus `nowrap` op de chips, toegevoegd zoals bij Taken. Met 551 bakken en echte tellers liep de chiprij anders over twee regels.

### GEVONDEN
1. **Thuisplaats:** `bakken.thuislocatie_id` bestond al. Er is geen tweede kolom `thuis_locatie_id` aangemaakt; de API neemt beide namen aan.
2. **Er is geen `GET /api/bakken`-lijstroute.** De nieuwe velden komen vanzelf mee in `GET /api/alle-bakken` en `/api/vaste-bakken` (`SELECT *`), en in `/api/bakken-overzicht`.
3. **Etiketten:** er bestond geen etiket- of printroute. Ik koos een printbare pagina `/etiketten?ids=` (A4, 3 × 7, 70 × 42 mm) met code, naam, thema en thuis-rek. "🖨 Etiketten" in de subbalk opent de selectie, of anders de zichtbare lijst (max. 200).
4. **Attributen hebben geen rek of plank.** Het formulier meldt dat en bewaart enkel de thuis. Wil kantoor dat ook voor attributen, dan is dat één migratie extra.
5. **`DELETE /api/bakken/:id` en `/api/attributen/:id` controleren zelf niets** (onderweg, open telling) en hebben geen `alleenKantoor`. De controle zit nu in `DELETE /api/bakken-overzicht/:id`. De oude routes blijven ongemoeid, zoals de prompt vraagt.
6. **Vaste bakken bewaren hun stukken in `vaste_bak_items`, thema-bakken in `bak_items`.** Overzicht en detail lezen beide. ✕ en "+ Stuk" kiezen de juiste route.
7. **Pool per stuk:** `item_types.pool_plaats` bestaat nu, maar er is nog geen scherm om het in te vullen (Pool-subtab, niet in deze prompt). De aanvullijst toont het zodra het gevuld is.
8. **TR1-fout, gevonden door chat D** (OVERLEG-d.md): de knop "Genereer uit planning" in `/taken` roept alleen `POST /api/transport-genereer` aan. Die geeft voorstellen terug maar maakt geen taken, terwijl de pagina "Taken gegenereerd" meldt. De voorstellen moeten nog als taken aangenomen worden, zoals `generale-repetitie.mjs` doet. Niet opgelost: `public/taken.js` valt buiten deze prompt.
9. **De browser-screenshot timet uit bij de lijst van 551 rijen** (bekend). Het bewijs is daarom een DOM-dump met maten.

### Buiten mijn gebied
- **`server.js`:** één regel, `'bakken-overzicht'` in de routelijst.
- **`public/etiketten.html`:** nieuw bestand; de prompt liet een eigen printpagina toe als er geen etiketroute was.

---

## BH1 — Beheer › Personeel + Logboek op het patroon (chat C, Opus) · 2026-10-29

Gewerkt van 20:04 tot ±20:45.

**Commits op `bouw-c`:**
- punt 1: migratie 80 + API + auth
- punt 2: pagina's /personeel en /logboek + test
- een fix in de logboektekst
- de route-inventaris (`test-f1-modules`)
- dit verslag

### Wat er gebouwd is

**Punt 1 — Data en API**
- **Migratie 80** voegt aan `personeel` toe:
  - `actief` (standaard 1), `rijbewijs`, `eigen_wagen_capaciteit`;
  - `laatst_actief`, `uitnodiging_op`, `meldingen_aan` (standaard 1);
  - `pincode_gewijzigd_op`.

  Alles heeft een default; er is geen backfill.
- **`routes/personeel-overzicht.js`** (alleen kantoor):
  - `GET /api/personeel-overzicht`;
  - `GET /api/personeel/:id/detail`;
  - `PUT /api/personeel/:id/velden`;
  - `PUT /api/personeel/:id/rol`;
  - `POST /api/personeel/:id/pincode-reset`;
  - `POST /api/personeel/:id/deactiveer` en `/activeer`;
  - `POST /api/personeel/uitnodiging`;
  - `GET /api/logboek` en `GET /api/logboek/wijziging/:id`;
  - de pagina's `GET /personeel` en `GET /logboek`.
- **Rechten per rol** staan in één tabel `RECHTEN` in de code: kantoor, chauffeur, coordinator, monitor, plus de oude rollen kv en animator.
- **Personeelswijzigingen worden gelogd zonder pincode-hash.** `updateMetLog` zou de volledige rij, mét hash, in `wijzigingen` zetten. Daarom schrijf ik zelf naar `wijzigingen`, met `pincode_gezet: true/false` in plaats van de hash.
- **Wat de beheeracties doen:**
  - Deactiveren en een rolwissel maken open sessies meteen ongeldig, ook in de sessiecache.
  - Jezelf deactiveren of je eigen kantoorrol afnemen geeft 409, net als een reset van je eigen pincode.
  - De uitnodiging stuurt niets zelf: ze geeft per persoon een tekst met het app-adres, de naam en "kies je pincode bij de eerste keer". KV-rollen krijgen er geen ("KV werkt met de KV-link").
- **Logboek:** combineert `wijzigingen` en `activiteiten_log` (max. 500 regels).
  - Filters: van, tot, wie, tabel en zoek.
  - Elke regel heeft `terugdraaibaar: false` met een reden, want er bestaat geen terugdraai-route.
  - Het detail toont oud/nieuw en laat het pincode-veld weg.

**Punt 2 — De pagina's**
- **`/personeel`** (`public/personeel.{html,css,js}`, laadt `patroon.css`) is een exacte kopie van de mockup:
  - **Subbalk:** Personeel · Logboek · Export & back-up · Instellingen, plus Export en "+ Persoon".
  - **Lijst:** 6 chips (Alle · Kantoor · Chauffeur · Coördinator · Monitor · ⚠ Zonder pincode) en een zoekveld. Kolommen naam, rol, telefoon, laatst actief en stand.
  - **Bulkvoet:** Pincode-uitnodiging sturen (venster met de teksten, Kopieer en Kopieer alles) · Rol wijzigen · Deactiveren (met bevestiging).
  - **Detail:** kop met de knoppen Bewerken · Pincode resetten · Deactiveren/Activeren · Rol wijzigen.
    - Tabs: Gegevens · Inzet N · Wat deed <naam> N.
    - Blokken: Gegevens & rechten, Inzet deze periode met Open-links, en het logboek op naam met "Volledig logboek ›" (→ `/logboek?wie=`).
  - "Pincode resetten" opent na de reset meteen het uitnodigingsvenster.
- **`/logboek`** (`public/logboek.{html,js}`, zelfde patroon, geen eigen mockup):
  - **Filters:** van, tot, wie, een tabelkeuze en zoek; ze komen in de URL.
  - **Lijst:** datum, wie, wat, tabel, context.
  - **Detail:** oud/nieuw met de gewijzigde velden eerst, en "↶ Terug" uitgeschakeld met de reden.

### Ingrepen in `lib/auth.js` (meer dan de prompt noemt, nodig voor de gevraagde werking)
- **Inloggen:** een gedeactiveerde persoon krijgt 403 "Dit account is gedeactiveerd — …".
- **`laatst_actief`** wordt gezet bij de login en bij elke API-oproep met een sessie. Dat is hoogstens één schrijfactie per persoon per 5 minuten (in-memory teller).
- **Nieuwe export `vergeetSessiesVan(id)`:** wist de sessies van één persoon uit de cache en de tabel.
- **Nieuw publiek pad `POST /api/eerste-pincode {persoon_id, pincode}`** voor de "eerste pincode" per persoon. De bestaande `setup-eerste-pincode` werkt alleen zolang níemand een pincode heeft, en kon dus niet dienen na een reset of voor een nieuwe coördinator. De nieuwe route kan alleen als:
  - de persoon actief is;
  - de persoon nog geen pincode heeft;
  - kantoor de persoon uitnodigde (`uitnodiging_op`, ook gezet bij een reset).

  De pincode moet minstens 4 tekens hebben (scrypt, zoals overal).
- **`/api/personeel-lijst-login`:** bevat nu ook coordinator en monitor (nodig voor de mobiele app), laat inactieve personen weg en geeft `heeft_pincode` mee.
- **`/api/personeel/:id/pincode`** zet nu ook `pincode_gewijzigd_op`.

### JSON-vorm
`GET /api/personeel-overzicht`
```json
{"tellers": {"alle": 16, "kantoor": 4, "chauffeur": 5, "coordinator": 7, "monitor": 0, "zonder_pincode": 5},
 "personeel": [{"id": 16, "naam": "Lotte BH1", "rol": "coordinator", "rol_groep": "kantoor|chauffeur|coordinator|monitor", "telefoon": "0475 12 34 57", "email": "lotte@x.be",
   "laatst_actief_tekst": "vandaag 20:09 | gisteren | ma | 12 okt | —", "stand": "actief|geen_pincode|inactief", "heeft_pincode": true, "uitnodiging_op": "2026-10-29 20:07"}]}
```
- `rol_groep` vertaalt de oude rollen: `kv` telt als coordinator en `animator` als monitor.
- `geen_pincode` geldt alleen voor rollen die inloggen (kantoor, chauffeur, coordinator).

`GET /api/personeel/:id/detail`
```json
{"persoon": {"id": 16, "naam": "Lotte BH1", "rol": "coordinator", "rol_groep": "coordinator", "telefoon": "…", "email": "…", "notities": "", "actief": true, "stand": "actief",
             "laatst_actief": "2026-10-29 20:09", "laatst_actief_tekst": "vandaag 20:09", "uitnodiging_op": "…"},
 "rechten": ["ritten rijden (eigen of huurwagen)", "stockage: aanvullen en klaarzetten", "tellen bij ophaling", "meldingen lezen en doen"],
 "pincode": {"gezet": true, "gewijzigd_op": "2026-10-29 20:09", "gewijzigd_tekst": "do 29 okt 20:09"},
 "rijbewijs": "B", "eigen_wagen_capaciteit": 6, "meldingen_aan": true,
 "inzet": [{"soort": "kv|rit|aanvullen", "titel": "KV Abdijschool Vlierbeek · wk 1", "sub": "Holderdebolder · nog niet geteld", "link": "/nakijken", "kampmoment_id": 168},
           {"soort": "rit", "titel": "Rit #22 · wo 4 nov · Eigen wagen", "sub": "coördinator rijdt mee · gepland", "link": "/ritplanning?rit=22", "rit_id": 22}],
 "logboek": [{"bron": "wijziging|activiteit", "id": "w812", "wijziging_id": 812, "t": "…", "tijd_tekst": "do 29 okt 20:09", "wie": "Claude (API)",
              "wat": "personeel #16: rol coordinator → chauffeur", "tabel": "personeel", "actie": "update", "context": "beheer: rol", "terugdraaibaar": false, "reden_niet_terug": "er bestaat nog geen terugdraai-route"}]}
```
`GET /api/logboek?van=&tot=&wie=&tabel=&zoek=&max=`: `{filters, totaal, afgekapt, tabellen[], regels[]}`. Elke regel heeft dezelfde vorm als een logboekregel hierboven.

`POST /api/personeel/uitnodiging {ids[]}`
```json
{"adres": "https://…/", "uitnodigingen": [{"id": 2, "naam": "Jeroen", "telefoon": "", "heeft_pincode": false, "instructie": "Hallo Jeroen, open https://…/ op je gsm, kies je naam \"Jeroen\" en kies je pincode bij de eerste keer (minstens 4 cijfers). Groeten, kantoor Sporty"}],
 "fouten": [{"id": 7, "naam": "Evy", "reden": "rol kv logt niet in (KV werkt met de KV-link)"}]}
```

### Bewijs
- **`node scripts/test-bh1-personeel.mjs` (poort 3338): 37 ok, 0 fout, ALLES GROEN.** Gecontroleerd:
  - **Overzicht:** tellers per rol en zonder pincode; `laatst_actief` is gezet bij de login ("vandaag 20:07").
  - **Nieuwe coördinator:** stand "geen pincode". De velden (rijbewijs, eigen wagen 6, telefoon) worden bewaard en gelogd, zonder hash in het antwoord; een negatieve capaciteit geeft 400.
  - **Inzet:** de KV-koppeling ("KV Abdijschool Vlierbeek · wk 1") en een rit als bestuurder ("coördinator rijdt mee"). Ook de rechten en het logboek op naam staan in het detail.
  - **Uitnodiging en eerste pincode:**
    - een eerste pincode zonder uitnodiging geeft 403;
    - de uitnodiging zet `uitnodiging_op` en geeft de instructie; een KV-rol wordt geweigerd met reden;
    - de coördinator staat in de loginlijst;
    - daarna lukt de eerste pincode, een tweede keer geeft 409, en inloggen werkt.
  - **Pincode-reset:**
    - de oude sessie geeft 401 en de oude pincode geeft 401;
    - de eerste-pincode-flow werkt opnieuw, met login op de nieuwe pincode;
    - de reset staat in het logboek, zonder `scrypt$` in de uitvoer.
  - **Deactiveren:**
    - de sessie geeft 401, de login 403, en de persoon verdwijnt uit de loginlijst;
    - na activeren lukt de login weer;
    - jezelf deactiveren geeft 409.
  - **Rol wijzigen:** gelogd ("rol coordinator → chauffeur"); een ongeldige rol geeft 400.
  - **`/api/logboek`:** heeft `terugdraaibaar` en `tijd_tekst`, en de filters tabel, zoek en van werken. Het wijzigingsdetail toont oud/nieuw zonder pincode.
  - **Rechten:** een chauffeur krijgt 403 op het overzicht, het detail, het logboek en de reset.
  - **Pagina's:** `/personeel` (subbalk, 6 chips, voet) en `/logboek` (subbalk, voet) geven 200 en laden `patroon.css`.
- **Live in de browser op 1920×900** (DOM-dump; de screenshot timede uit omdat het paneel niet getekend werd):
  - Lijst 860 px, detail 988 px. Subbalk "Personeel · Logboek · Export & back-up · Instellingen · ⬇ Export · + Persoon"; 6 chips van 36 px; na het aanvinken "16 personen · 2 geselecteerd" met de 3 bulkknoppen.
  - **Detail Lotte:**
    - kop "chauffeur · 0475 12 34 57 · lotte@x.be · ingelogd vandaag 20:09";
    - tabs "Gegevens · Inzet 2 · Wat deed Lotte 12";
    - Gegevens & rechten: rol + "mag: …", pincode "gezet (scrypt) · laatste wijziging do 29 okt 20:09", "B · eigen wagen (6 bakken)", meldingen aan;
    - de inzet (KV + rit) en het logboek op naam.
  - **Uitnodiging voor 2 chauffeurs:** de 2 teksten met Kopieer, Kopieer alles en Klaar. Voor 2 KV's: "Niet uitgenodigd: … KV werkt met de KV-link".
  - **Logboek `?wie=Claude`:** 23 regels. Tabel=personeel geeft 12 en de URL wordt bijgewerkt. Het detail toont oud/nieuw (uitnodiging_op) zonder pincode-veld; "↶ Terug" is uitgeschakeld.
  - **Hersteld na deze controle:** het logboek toonde "actief 1 → —" in plaats van "1 → 0". Gecommit.
- **`node scripts/volle-run.mjs`:**

| run | groen | rood |
|---|---|---|
| 1 | 24/27 | f1-modules (2: nieuwe padparameters nog niet in de inventaris, van mij), v3c-fotos (afgebroken), veiligheid (3) |
| 2 | 24/27 | f1-modules (2, idem), v3c-fotos (2), veiligheid (3) |
| 3 (na de f1-modules-regels) | 25/27 | v3c-fotos (2), veiligheid (3) |
| 4 | 25/27 | v3c-fotos (2), veiligheid (3) |

`v3c-fotos` en `veiligheid` zijn de bekende omgevingsafhankelijke tests: ze lezen de lokale `sporty.db`.

### Afwijkingen van de mockup
- **Demo-balk en frame:** de demo-balk (`.keuze`) valt weg. Het frame vult het venster; op 1920×900 is het beeld identiek.
- **Tab "Wat deed hij/zij":** heet "Wat deed <voornaam>", omdat geslacht nergens bewaard wordt. De mockup toont "Wat deed ze".
- **"Instellingen"** linkt naar Overzicht, met de tooltip dat er nog geen instellingenpagina bestaat (zie GEVONDEN 4).
- **Pilkleuren** en `nowrap` op de chips: toegevoegd zoals bij Taken en Bakken.

### GEVONDEN
1. **Rollen:** `coordinator` en `monitor` bestonden niet. De database kent kantoor, chauffeur, kv en animator. Het overzicht telt kv als coördinator en animator als monitor.
   - Een bestaande KV (rol `kv`) kan niet inloggen en krijgt geen uitnodiging. Kantoor moet eerst de rol op coördinator zetten.
   - De auth-poort blokkeert alleen `kv` op de admin-API. `coordinator` en `monitor` krijgen dus dezelfde leestoegang als chauffeur. Specifieke rechten (bv. monitor = enkel tellen) worden nog nergens afgedwongen; `RECHTEN` is voorlopig alleen uitleg.
2. **Er bestaat geen terugdraai-route voor `wijzigingen`** (TR1 #1, nog open). "↶ Terug" staat overal uit met de reden.
3. **De "Eerste pincode"-flow in de app** (`setup-eerste-pincode`) werkt alleen als nog níemand een pincode heeft. Daarom is er `POST /api/eerste-pincode` per persoon. **Het loginscherm in `index.html` gebruikt die route nog niet:** wie geen pincode heeft, ziet daar nog geen "kies je pincode"-stap. Het loginscherm moet `heeft_pincode` uit `/api/personeel-lijst-login` gebruiken en dan `/api/eerste-pincode` aanroepen. `index.html` was dicht.
4. **Er is geen instellingenpagina** en geen tabel voor instellingen. `kantoor_telefoon` kon dus nergens bij; daar is een apart onderdeel voor nodig.
5. **`POST /api/personeel` (bestaand) gebruikt `ins` en niet `insMetLog`.** Het aanmaken van een persoon staat dus niet in `wijzigingen`. Ook `PUT /api/personeel/:id` (bestaand) logt niets. De nieuwe BH1-routes loggen wel.
6. **`DELETE /api/personeel/:id` (bestaand) verwijdert hard.** Deactiveren is de nieuwe, omkeerbare weg; de oude knop bestaat nog in het oude tabblad.
7. **Het logboek over één persoon** zoekt in `activiteiten_log` op naam (`LIKE`). Een gewone naam kan dus ook regels van iemand anders met die naam tonen. `activiteiten_log` heeft geen persoon-kolom.
8. **Uitnodigen via sms of mail bestaat niet.** Kantoor kopieert de tekst, zoals de prompt vraagt.
9. **`POST /api/transport-taken/bundel` bestaat nu (TB1 van chat D).** Het TR1-gat "Bundelen" is daarmee aan hun kant opgelost. De knop in `/taken` staat nog uit: dat is een kleine opvolging in `public/taken.js`.

### Buiten mijn gebied
- **`lib/auth.js`:** zie de sectie hierboven. Nodig voor inactief → geen login, `laatst_actief`, de eerste pincode per persoon, het vervallen van sessies en de loginlijst.
- **`scripts/test-f1-modules.mjs`:** 2 regels, de nieuwe padparameters in de route-inventaris.
- **`server.js`:** één regel, `'personeel-overzicht'` in de routelijst.
- **`public/logboek.html`:** heeft een kleine eigen `<style>` voor de kolommen. Een `logboek.css` stond niet in de bestandenlijst, dus de pagina laadt `personeel.css`.

**BH1 · aanvulling na de rebase (20:55).**

- **Conflict met GF1 (chat D), opgelost:**
  - `lib/auth.js`, in `/api/personeel-lijst-login`: GF1 had `coordinator` toegevoegd. Mijn versie bevat dat al, plus `monitor`, `actief` en `heeft_pincode`.
  - GF1 gebruikt migratienummer 80. De BH1-migratie heet daarom **Migratie 81**. Ze heeft geen vlag, alleen `addColumnIfMissing`; de nummering staat enkel in het commentaar.
- **Na de rebase opnieuw gedraaid:**
  - `test-bh1-personeel`: 37 ok, 0 fout.
  - `test-f1-modules`: 113 ok.
  - Volle run, twee keer: telkens **26/28 groen**. Alleen `v3c-fotos` (2) en `veiligheid` (3) zijn rood, de bekende omgevingsafhankelijke tests.
- **Push tijdens het conflict:** tijdens het conflict ging een `git push origin HEAD:bouw-c` mee. Die zette `bouw-c` even gelijk aan main (63c5e26); main zelf is niet geraakt. Daarna is de juiste branch (met BH1) gepusht.
