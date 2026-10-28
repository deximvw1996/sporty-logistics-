# OVERLEG-b — chat B (Opus)

## 2026-10-28 23:21–23:35 — PROMPT V1 TESTHARNAS (tijdslimiet 2 u, ruim binnen)

Gerebased op origin/main (F1 gemerged: server.js + lib/ + routes/). Enkel `scripts/_testhulp.mjs`, `scripts/volle-run.mjs`, `scripts/test-keten-*.mjs`, `scripts/testdata/` en dit verslag aangeraakt — geen regel app-code.

### Af
- **Deel 1 — `scripts/_testhulp.mjs`**: `startServer({poort,dbBron,appPassword,verseMap})` (kindproces `server.js`, `DATA_DIR` = `D:\Sporty\sporty-b-test-<poort>` buiten de worktree, db gekopieerd, wacht max 20 s op `/api/login-status`, `stop()` ook bij `process.on('exit')`, `log()`), `login`, `api` (Basic + `x-auth-token`), `leesDb` (sql.js), `ok/fout/check/info/einde` (ALLES GROEN / N FOUT + exitcode), `kvToken` (koppelt zelf een kv-persoon als er nog geen is), `ritToken`, plus `voorstelNaarRit` en `ritActie` voor de ketens. Valt terug op `..\sporty-railway\node_modules` als de worktree geen eigen `node_modules` heeft (alleen gelezen, niets geïnstalleerd) en geeft die via `NODE_PATH` door aan de server.
- **Deel 2 — `scripts/testdata/`**: `maak-testdb.mjs` bouwt via de API: periode "Herfst TEST" 2–8 nov 2026, Betekom w1 = "Alles op wieltjes" (bakken + bulkpool), Abdijschool w1 = "Holderdebolder" (enkel poolbehoefte: springkastelen/WESCO), 2 KV's gekoppeld, 1 chauffeur. Schrijft `herfst-test.db` (992 kB, geen foto's toegevoegd) + `herfst-test.json`.
- **Deel 3 — vijf ketentests**, testen het GEWENSTE gedrag (DRAAIBOEK), kop noemt werklijst/DOORLICHTING-nummers; elk start van de ijk-db; waar een rode check vacuüm groen of vals rood zou kunnen zijn, zit er een controle-check in (bv. ophaling: na klaarzetten toont de pagina de code wél → de zoekmethode klopt; splits: eerst bewijzen dat de bak echt 'onderweg' staat vóór het verwijderen).
- **Deel 4 — `scripts/volle-run.mjs`**: alle `scripts/test-*.mjs` na elkaar, eigen proces, poort uit 3320–3339 via `TEST_POORT`, timeout 10 min, regel per test `GROEN`/`ROOD (n fout)`/`AFGEBROKEN` + eindtabel, exitcode 1 bij rood; `--alleen a,b` en `--vanaf naam`.

### Bewijs
- `node scripts/testdata/maak-testdb.mjs` 2× → `diff` van beide `herfst-test.json`: **IDENTIEK** (periode 2, km Betekom 167 / Abdijschool 168, chauffeur 13, KV's 14/15, thema's 4084/4085, locaties 29/36/7).
- `node scripts/volle-run.mjs` 2× (run 2):

| test | uitslag | ok | fout | tijd |
|---|---|---|---|---|
| f1-modules | ROOD (2 fout) | 80 | 2 | 1.7 s |
| f1-schrijven | GROEN | 22 | 0 | 12.5 s |
| f1-wijzigingen | GROEN | 46 | 0 | 3.3 s |
| keten-aanvraag | ROOD (5 fout) | 7 | 5 | 0.7 s |
| keten-levering | ROOD (28 fout) | 16 | 28 | 1.2 s |
| keten-ophaling | ROOD (3 fout) | 4 | 3 | 0.8 s |
| keten-periode | ROOD (7 fout) | 6 | 7 | 1.4 s |
| keten-splits | ROOD (4 fout) | 6 | 4 | 0.8 s |
| veiligheid | GROEN | 58 | 0 | 1.4 s |

Run 1 identiek behalve f1-schrijven 1 fout (zie GEVONDEN). `test-veiligheid` 2× groen.

### Overdracht: wat ontbreekt per rode ketentest (meetlat voor C en D)
- **keten-levering** (werklijst 13/14): chauffeur-lossen boekt bulk niet in `bulk_spreiding` (fietsen 0 op Betekom, 17 nog thuis); taak en rit blijven `gepland` na volledig lossen; gepland→gedaan opnieuw boekt een 2de keer (17 → 34 kleuterfietsen, som > bezit).
- **keten-ophaling** (werklijst 15): rit-link van een ophaalrit toont geen enkele bak en heeft 0 checks tot iemand `checks/init` (klaarzetten) doet.
- **keten-aanvraag** (werklijst 11/12): spoedtaak heeft `van_locatie_id` en `naar_locatie_id` NULL, geen `kampmoment_id`, datum = vandaag i.p.v. in de kampweek; na afwijzen blijft de spoedtaak `gepland`. (Aantal 3 en KV-zicht op afgewezen+reden kloppen al.)
- **keten-splits** (werklijst 18): na splitsen blijft de check van de afgesplitste regel in de oude rit hangen (taak_id oud), waardoor de oude taak pas 'onderweg' wordt als ook die regel geladen is; taak verwijderen na laden → 200 maar bak blijft 'onderweg' en 10 verweesde checks blijven staan.
- **keten-periode** (werklijst 7/8): een 2de kampmoment op dezelfde locatie+week in een andere periode wordt geweigerd ("bestaat al", UNIQUE zonder periode); conflicten mengen periodes (dubbel_thema + dubbelboeking_bak herfst↔zomer) en noemen geen periode; zomer-sportset en zomer-kleurenbord (met `periode_id` meegegeven) komen in de herfstvoorstellen; er bestaat geen backend-begrip "actieve periode" (`/api/periodes` heeft enkel id/naam/start/eind/max_weken), dus "na herstart nog Herfst TEST" kan niet. Zomervoorstellen zelf krijgen wél juli-2027-data.

### Contractkeuzes in de tests (aanname — hoofdchat mag bijsturen)
- "Actieve periode" = veld `actief` (1/true) of `is_actief` op `GET /api/periodes`, precies één rij.
- Conflicten worden opgevraagd met `?periode_id=<id>`; kleurenborden en sportplanning krijgen een `periode_id` in de body.
- Spoedtaak na afwijzen: aanvaard = verwijderd of status `geannuleerd`.
- Taak verwijderen na laden: aanvaard = bakken terug `thuis` (en geen verweesde checks) OF 4xx met `error`; de test drukt af welke.

### GEVONDEN (buiten mijn opdracht, niet gefixt)
1. `test-f1-modules.mjs` is rood (2 fout) en blijft dat: hij vergelijkt de route-inventaris met `origin/main` als monoliet ("origin/main: 3 routes, verwacht ≥ 220"); sinds F1 gemerged is, staat de monoliet niet meer op main. Eenmalige migratietest → hoort uit de volle run of moet tegen een vaste commit vergelijken.
2. `test-f1-schrijven.mjs` was 1× rood (1 fout) in volle-run 1, daarna 4× groen (2× los, 1× in volle run, + run 2). Timing-gevoelig (pollt sporty.db elke 100 ms); niet verder uitgezocht.
3. Worktrees hebben geen `node_modules`; de bestaande tests werken enkel met `NODE_PATH` naar `sporty-railway\node_modules` (volle-run zet dat zelf).

### Buiten mijn gebied
Niets.
