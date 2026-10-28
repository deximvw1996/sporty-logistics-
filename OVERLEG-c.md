
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
