# DOORLICHTING lens 3 — veiligheid (chat C, Opus) — 2026-10-28

Leesopdracht: **niets gefixt**. Alle bewijzen zijn echte HTTP-calls tegen mijn eigen server (poort 3303, `APP_PASSWORD=geheim`, db-kopie in sporty-c). Testscripts: scratchpad `aanval.mjs`, `aanval2.mjs`, `a3.mjs`, `a4.mjs` (niet in de repo). Het traversal-bewijsbestand dat ik zelf schreef heb ik daarna verwijderd.

## Samenvatting oordeel

| # | Ernst | Bevinding |
|---|---|---|
| 1 | **KRITIEK** | Padtraversal + willekeurig bestand schrijven via `POST /api/sport/:id/foto` (`ext`) — kan op prod `sporty.db` overschrijven |
| 2 | **KRITIEK** | Geen rolcontrole: elke ingelogde persoon (ook KV/chauffeur met pincode) mag alles, incl. db downloaden/vervangen en andermans pincode wijzigen |
| 3 | **HOOG** | `/api/export` lekt alle sessietokens + pincode-hashes → sessie-overname zonder pincode |
| 4 | **HOOG** | Pincodes: 4 cijfers, SHA-256 zonder salt, geen rate-limit (200 pogingen in 1,4 s), personeelslijst is publiek |
| 5 | **HOOG** | `/uploads` staat VÓÓR de Basic-auth-muur → bestanden publiek; met #1 = opgeslagen XSS (`.html` wordt als `text/html` geserveerd) |
| 6 | **HOOG** | SQL-injectie via tabelnaam in `/api/import/tabel` (`PRAGMA table_info(${tabel})`, multi-statement via `db.exec`) |
| 7 | MIDDEL | Sessies verlopen nooit; gewist personeelslid blijft ingelogd (sessie-cache) |
| 8 | MIDDEL | XSS: ruwe interpolatie van gebruikersinvoer in `/rit/:token`-pagina (server) en ±20 plekken in index.html |
| 9 | MIDDEL | `POST/PUT /api/personeel` geven het `pincode`-hash-veld terug |
| 10 | MIDDEL | Foto-/base64-velden zonder type- of groottecontrole (alleen 5 MB JSON-limiet) |
| 11 | LAAG | KV-token geeft toegang tot bakken van een ánder kampmoment met hetzelfde thema (by design, maar noteren) |
| 12 | LAAG | `_genToken` gebruikt `Math.random` (geen CSPRNG); kv/rit-tokens verlopen nooit |
| 13 | LAAG | `cors()` open voor elke origin; `/api/dbinfo` toont serverpaden |

**Wat goed is (OK, bewezen):** Basic auth staat vóór alles behalve `/uploads`; `/bundels` staat er correct achter; sessiepoort werkt (fout token 401, logout trekt token in); kv-token en rit-token werken NIET als sessietoken (401); kv-token geeft geen toegang tot admin-routes (401); rit-token A op check van rit B → 403; kv-token op bak van een ander thema → 403; foute/verwijderde kv- en rit-tokens → 403; bundels-traversal-fix houdt (`..\server.js` → "Ongeldige bestandsnaam"); alle andere queries gebruiken `?`-binding of vaste kolom-/tabellijsten; `TestSporty` komt in geen enkele commit van deze repo voor (267 commits, `git log --all -S` + `git grep` over alle revisies leeg).

---

## 1. Routetabel

Mount-volgorde in `server.js`:

| Regel | Mount | Basic auth | Sessietoken | Oordeel |
|---|---|---|---|---|
| 16 | `app.use('/uploads', express.static(UPLOADS_DIR))` | **NEE** (vóór muur r.43) | nee | **FOUT** — bewijs: `/uploads/sport-…html` zonder Basic → `200 text/html` |
| 33-34 | cors, json(5mb) | – | – | cors open voor alle origins (LAAG) |
| 43 | Basic-auth-muur | – | – | OK (open als `APP_PASSWORD` leeg — staat op prod in Railway, niet te checken vanuit repo) |
| 57 | `/bundels` static | ja | nee | OK (zonder Basic → 401) |
| 64 | `express.static(FRONTEND_PATH)` = repo-root | ja | nee | **MIDDEL**: serveert de hele repomap: `/server.js`, `/MASTERPLAN.md`, `/CLAUDE.md`, `/package.json`, en lokaal zelfs `/sporty.db` (lokaal FRONTEND_PATH=__dirname). Op prod staat de db op het volume, maar broncode + plannen zijn voor iedereen met het app-wachtwoord leesbaar. |
| 1920-1958 | `/api/login`, `/api/login-status`, `/api/setup-eerste-pincode`, `/api/personeel-lijst-login` | ja | **publiek** (PUBLIEKE_API_PADEN) | bewust; personeelslijst publiek + geen rate-limit = zie #4 |
| 1964 | sessiepoort voor `/api/*` | ja | – | OK |
| prefix `/api/kv/` | 6 KV-routes (r.2080-2204) | ja | publiek, eigen kv-token-check | OK (elke route valideert token + bak/attr hoort bij kampmoment) |
| prefix `/api/rit-token/` | laden/lossen (r.3612-3628) | ja | publiek, eigen rit-token-check | OK |
| 1975-5465 | alle overige ±230 `/api/*`-routes | ja | ja | OK qua muren, maar **geen rolcontrole** (#2) |
| 4706, 4720 | `/sw.js`, `/manifest.json` | ja | nee | OK |
| 4730, 4821 | `/rit/:token`, `/kv/:token` (HTML) | ja | nee (token in pad) | OK — let op: chauffeur/KV moet dus het app-wachtwoord kennen |
| 5470 | `*` → index.html | ja | nee | OK |

Let op prefix-match: `'/api/kv/'` is een prefix-uitzondering; nu bestaan er alleen `/api/kv/:token/...`-routes. Een toekomstige kantoorroute als `/api/kv/overzicht` zou ongewild publiek zijn. Aanbeveling: in de poort een regex `^/api/kv/[a-z0-9]{12}/` gebruiken.

## 2. Token-scheidingen (live getest)

| Test | Resultaat | Oordeel |
|---|---|---|
| kv-token als `x-auth-token` op `/api/locaties` | 401 | OK |
| kv-token op `/api/backup-db` | 401 | OK |
| kv-token A telt bak die alleen bij thema van C hoort | 403 | OK |
| kv-token A telt bak van kampmoment B **met hetzelfde thema** | `{ok:true}` | LAAG (#11): thema-bakken worden gedeeld via `thema_bak`; A kan ook B's sessie raken als locatie+week… nee — sessie wordt op A's `locatie_id/week` aangemaakt. Geen lek naar B's data, wel tellen van een bak die fysiek niet bij A staat. |
| kv fout token / kv-token na verwijderen kampmoment | 403 / 403 | OK |
| rit-token A op check van rit B | 403 | OK |
| rit-token A op eigen check | 200 | OK |
| rit-token als sessietoken | 401 | OK |
| fout rit-token | 403 | OK |
| sessie na logout | 401 | OK |
| sessie na DELETE van het personeelslid | **200** | FOUT (#7) |

## 3. Injectie & traversal

**SQL** — alle `${…}`-queries nagelopen: `IN (${ph})` met `?`-placeholders, `${veldNaam}`/`${kolom}` uit vaste ternaries, `${t}` uit `sqlite_master` → OK. **Eén FOUT**: `_kolommenVan(tabel)` (r.3739-3741) doet `db.exec(\`PRAGMA table_info(${tabel})\`)` met `req.body.table` uit `/api/import/tabel`. `db.exec` voert meerdere statements uit.
Bewijs: `table: "app_vlaggen); CREATE TABLE pwned_c(x); --"` → daarna toont `/api/export` tabel `pwned_c`. Met `DROP TABLE kampmomenten` is dat dataverlies. (Vereist sessie — maar zie #2/#3.)
Fix: `table` eerst toetsen tegen `_alleTabellen()` (whitelist) vóór `_kolommenVan`.

**Bundels-traversal-fix** — `..\server.js` → 400 "Ongeldige bestandsnaam". OK. (Lezen gaat via `express.static`, die `..` zelf blokkeert.)

**Foto-uploads**
- `POST /api/sport/:id/foto` (r.4476): `filename = sport-${id}-${Date.now()}.${ext}` met `ext` ongefilterd → **padtraversal + schrijven van willekeurige inhoud**.
  Bewijs: `ext: "x/../../DOORLICHTING-traversal-bewijs.txt"`, `data: base64("BEWIJS-C")` → bestand `D:\Sporty\sporty-c\DOORLICHTING-traversal-bewijs.txt` met inhoud `BEWIJS-C` (één map boven `uploads/`). Op prod is dat de volume-root = `DATA_DIR`, waar `sporty.db` staat → db overschrijven; met `../..` verder: `server.js` (bij volgende start = code-uitvoering). Ook `id` komt uit de URL in de bestandsnaam, maar moet eerst een bestaand sport_item zijn.
  Bewijs 2: `ext: "html"` + `<script>` → `/uploads/sport-15805-….html` geserveerd als `text/html`, **zonder Basic auth** (200). Opgeslagen XSS op het app-domein → kan `localStorage`-sessietoken stelen van wie de link opent.
  Fix: `ext` whitelist (`jpg|jpeg|png|webp`), bestandsnaam volledig server-side, `path.basename`, magic-bytes-check, max grootte; `/uploads` ná de Basic-auth-muur mounten en `X-Content-Type-Options: nosniff` zetten.
- `POST /api/bakken/:id/foto`, `/api/vaste-bakken/:id/foto-slot`, `/api/kv/:token/kapot` (`foto_data`): base64-tekst in SQLite, géén type-/groottecheck. Bewijs: 4,9 MB willekeurige `AAAA…` → `{ok:true}`; KV-kapot met `foto_data:"data:text/html,<script>…"` → 200. Risico hangt af van hoe de frontend het rendert (`<img src>` = onschuldig; als `href`/`iframe` = XSS) + db-opblazing (elke call +5 MB, publieke KV-route zonder sessie). MIDDEL.

**XSS-steekproef (≥10 velden)** — `_escH` bestaat (index.html r.5416, 238 aanroepen), maar:

| Veld | escaped / ruw | Waar ruw |
|---|---|---|
| thema `t.name` | 11 / 7 | r.2199, 4877 (`value="${t.name}"`), 4895, 5957, 5990, 4328 |
| locatie `l.name` | 14 / 7 | r.4454, 4479, 5240 (`value=`), 5261, 5962, 7925 |
| periode `p.naam` | 6 / 2 | r.4379, 7115 |
| transportregel `r.naam` | 2 / 6 | r.3170, 6717, 6726, 7926, 8169, 8273 |
| `t.opmerking` (index) | 3 / 0 | OK |
| `a.naam`, `a.tekst`, `b.code`, `loc.name` | allemaal escaped | OK |
| **server `/rit/:token`** | – | `t.opmerking`, `t.van_naam`, `t.naar_naam`, `c.item_naam`, `rit.chauffeur` ruw in HTML (r.4742-4795); `esc()` bestaat pas op r.4879 en wordt hier niet gebruikt |

Bewijs is codelezing (geen browser-run): een thema of transportregel met naam `<img src=x onerror=…>` voert script uit bij elke kantoorgebruiker / in de chauffeurspagina. Wie mag zo'n naam invoeren? Elke sessie (#2) — en `r.naam` komt ook uit regels die van KV-aanvragen kunnen afgeleid worden.

## 4. Secrets & hygiëne

- **Git-historie**: 267 commits; `git log --all -S TestSporty` en `git grep -i testsporty` over alle revisies: leeg. Geen hardgecodeerde `password=`/`secret=`/`api_key=`-strings gevonden. `APP_PASSWORD` komt uit env. → OK. (TestSporty lekte dus buiten deze repo — chat/doc/Railway — niet hier.)
- `sporty.db` zit NIET in git (`.gitignore: *.db`, `git log --all -- sporty.db` leeg) → OK. Wel: in combinatie met de static-mount r.64 (repo-root, codelezing — niet live getest) is een db in de app-map via `/sporty.db` downloadbaar voor wie het app-wachtwoord heeft.
- **Pincode-opslag** (`hashPin`, r.1900): `sha256(pin)`, **geen salt, geen iteraties**. 4-cijferige pin = 10.000 mogelijkheden → hash in microseconden te kraken; gelijke pins = gelijke hash. Bekende API-pin `1111`.
- **Brute force**: 200 foute `/api/login`-pogingen in 1.361 ms, geen vertraging/lockout. Personeelslijst (`id`, naam, rol) is publiek → volledige 10.000-ruimte per persoon in ±70 s.
- **Sessietokens**: 24 bytes `crypto.randomBytes` = 48 hex — sterk. Maar: geen verloop (tabel heeft enkel `created_at`), 111 oude sessies in de testdb; logout werkt; DELETE personeel wist de sessies niet en de `_sessieCache` houdt ze vast (bewijs: 200 na wissen).
- **Export-lek**: `/api/export` dumpt álle tabellen, ook `sessies` (113 tokens) en `personeel.pincode`. Bewijs: met een KV-sessie → `sessies:113`, `pincode:"9af15b336e6a…"`. Elk teamlid kan zo als ieder ander inloggen.
- **Rolcontrole**: nergens `req.persoon.rol` gecontroleerd. Bewijs met een KV-rolsessie: `/api/backup-db` 200, `/api/personeel/4/pincode` → `{ok:true}` (pincode van Stijn overschreven), en `/api/herstel-db` / `/api/import/reset` staan net zo open.
- `_genToken` (kv 12 / rit 10 tekens base36 ≈ 62 / 52 bit) via `Math.random` — voldoende lengte, niet cryptografisch; geen verloop.

## 5. Oordeel + aanbevolen fixes (NIET uitgevoerd)

**KRITIEK**
1. **Foto-upload-traversal** (`server.js:4476-4485`). Fix: `ext` whitelist, naam volledig server-side, check dat `path.resolve(UPLOADS_DIR, naam)` binnen `UPLOADS_DIR` valt, max bytes, magic-bytes.
2. **Rolcontrole ontbreekt** (sessiepoort r.1964). Fix: middleware `vereisRol('kantoor')` op beheerroutes (backup/herstel/import/reset/export/dbinfo/personeel/pincode); `POST /api/personeel/:id/pincode` alleen eigen pin of kantoor. KV-personeel hoort geen pincode-login te hebben (KV werkt via kv-link).

**HOOG**
3. `/api/export`: tabellen `sessies` uitsluiten en `personeel.pincode` strippen; daarna alle bestaande sessies wissen (zijn als gelekt te beschouwen voor wie export draaide).
4. Pincodes: `crypto.scrypt`/`pbkdf2` met salt per persoon (migratie: herhashen bij volgende geslaagde login), rate-limit/lockout op `/api/login` (bv. 5 pogingen per persoon per 5 min), pin `1111` van "Claude (API)" vervangen door een lange willekeurige waarde.
5. `/uploads` ná de Basic-auth-muur mounten (r.16 → na r.55) + `nosniff`; bestaande uploads checken op niet-afbeeldingen.
6. `/api/import/tabel`: tabelnaam whitelisten tegen `_alleTabellen()`.

**MIDDEL**
7. Sessieverloop (bv. 30 dagen, `laatst_gebruikt`), bij DELETE personeel `DELETE FROM sessies WHERE persoon_id=?` + cache legen.
8. XSS: ruwe interpolaties uit de tabel hierboven door `_escH`/`_attrH`; in `/rit/:token` de bestaande `esc()` gebruiken. Overweeg een CSP-header.
9. `POST/PUT /api/personeel`: `pincode` uit het antwoord strippen (zoals GET al doet).
10. Base64-fotovelden: type (`data:image/(jpeg|png|webp)`) + maxgrootte valideren, zeker op de publieke `/api/kv/:token/kapot`.
11. Static-mount r.64 serveert de repo-root: enkel `index.html` + echte assets serveren (aparte `public/`-map of whitelist), zodat `server.js`, `*.md`, `package.json` en (lokaal) `sporty.db` niet downloadbaar zijn.

**LAAG**
12. `_genToken` via `crypto.randomBytes`; kv-token laten vervallen na einde kampweek.
13. `cors()` beperken tot eigen origin; `/api/dbinfo` achter kantoorrol.
14. Prefix `'/api/kv/'` in PUBLIEKE_API_PREFIXEN strakker matchen (zie §1).
15. KV-token kan een bak van een ander kampmoment met hetzelfde thema tellen — bewuste keuze bevestigen.

## GEVONDEN (buiten opdracht)
- `node_modules` ontbrak in sporty-c; `npm ci` gedraaid (geen codewijziging).
- Testdb bevat 111 sessies — op prod waarschijnlijk vergelijkbaar en nooit opgeruimd.

## Stand
Leesopdracht volledig uitgevoerd binnen tijd; geen code gewijzigd; enige repowijziging = dit bestand.
