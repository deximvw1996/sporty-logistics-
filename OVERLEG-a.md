# OVERLEG-a — verslag chat A (Fable, bouw)

## 2026-10-28 — Veiligheidsronde 1: zes KRITIEK/HOOG-punten uit DOORLICHTING-c (server.js)

Start 17:48, tijdslimiet 2 uur (tot 19:48). Afgerond 17:55. Branch `bouw-a`, map `D:\Sporty\sporty-a`. Nooit naar main gepusht, geen deploy.

### Wat af is (alle zes punten)

| # | Punt (DOORLICHTING-c) | Fix in server.js | Bewijs (test-veiligheid.mjs) |
|---|---|---|---|
| 1 | Sport-foto-upload: `ext` ongefilterd → padtraversal + willekeurig bestand (KRITIEK) | r.4564-4594: extensie uit vaste lijst `jpg/jpeg/png/webp` (hoofdletterongevoelig, leidende punt gestript), `id` moet een positief geheel getal zijn, naam volledig server-side `sport-<id>-<ts>.<ext>`, `path.resolve(UPLOADS_DIR,naam)` moet binnen `UPLOADS_DIR` liggen, max 2 MB gedecodeerd, lege/ongeldige base64 → 400; oude foto wordt enkel gewist als `path.basename(foto_path)` binnen uploads ligt | ext `html` → 400; ext `x/../../bewijs-traversal.txt` → 400 en géén bestand buiten uploads; geldige png → 200 met server-naam + bestand in uploads; 2 MB+1 → 400; lege data → 400 |
| 2 | Geen rolcontrole (KRITIEK) | r.2036-2051: sessiepoort geeft rol `kv` 403 op alles onder `/api/*` behalve `wie-ben-ik`/`logout`; middleware `vereisRol(...rollen)` + `alleenKantoor` op alle beheerroutes (tabel hieronder); `POST /api/personeel/:id/pincode` enkel eigen id of rol kantoor (r.2059-2061) | kv-sessie: backup-db/export/herstel-db/import/reset/dbinfo/locaties → 403, pincode-van-Stijn → 403 (hash ongewijzigd); chauffeur: locaties 200, backup-db/POST+DELETE personeel/pincode-van-ander → 403, eigen pincode → 200 + login met nieuwe pin 200; kantoor: backup-db 200 (SQLite), dbinfo 200, export 200 |
| 3 | `/api/export` lekt sessies + pincode-hashes (HOOG); C-#9 POST/PUT personeel geven pincode terug | r.3826-3830: tabel `sessies` uitgesloten, `pincode` uit elke personeel-rij gestript; r.3971-3984: `_persoonZonderPin()` in de antwoorden van POST/PUT `/api/personeel` (geeft `heeft_pincode` zoals GET) | export: geen sleutel `sessies`, 14 personeel-rijen zonder `pincode`, gewone tabellen nog aanwezig; POST/PUT personeel zonder `pincode`-veld, met `heeft_pincode` |
| 4 | `/uploads` vóór de Basic-auth-muur (HOOG) | r.16 verwijderd; mount nu r.61, ná de muur, naast `/bundels`, met `X-Content-Type-Options: nosniff` | `/uploads/test-nosniff.txt` zonder Basic → 401; mét Basic → 200 + header `nosniff` |
| 5 | SQL-injectie via tabelnaam in `/api/import/tabel` (HOOG) | r.3824 `_tabelBestaat()` = letterlijke match tegen `_alleTabellen()`; r.3888 onbekend → 400 vóór `_kolommenVan`/INSERT | `app_vlaggen); CREATE TABLE pwned_a(x); --` → 400 en `pwned_a` bestaat niet; `bestaat_niet` → 400; `app_vlaggen` met 0 / 1 rij → 200 |
| 6a | Geen rate-limit op login (HOOG) | r.1945-1955: in-memory teller per `persoon_id`, max 5 mislukte pogingen per 5 min, daarna 429 met `Retry-After` + `wacht_seconden`; geslaagde login wist de teller | 5× foute pin Stijn → 401, 6e → 429 (Retry-After 300 s); Claude (API) logt intussen gewoon in (blokkade per persoon) |
| 6b | Pincodes ongezouten SHA-256 (HOOG) | r.1922-1944: `hashPin` = `crypto.scryptSync` (N=16384,r=8,p=1), 16-byte salt per persoon, formaat `scrypt$<salt>$<hash>`; `verifieerPin()` herkent `scrypt$`, `sha256$…` en kale 64-hex; vergelijking met `timingSafeEqual`. **Migratie 56** (r.1900-1917, gegate op `migratie56_klaar`, vlag ALLEEN bij succes, patroon 52) labelt bestaande kale hashes als `sha256$…` (geen dataverlies, blijft inloggen). Bij de eerstvolgende GESLAAGDE login wordt de hash omgezet naar scrypt (r.1997-2000; `saveDb()` volgt in dezelfde route) | Claude (API) met kale SHA-256 in de wegwerp-db logt in → 200; daarna staat `scrypt$…` in de db; tweede login tegen scrypt → 200; foute pin → 401; vlag `migratie56_klaar=1`; niet-ingelogde Stijn behoudt `sha256$…` |
| 6c | Personeelslijst voor login toont KV (HOOG) | r.2024: `WHERE rol IN ('kantoor','chauffeur')` | lijst bevat enkel rollen chauffeur,kantoor |

### Rol-overzichtstabel (route → vereiste rol)

| Route | Vereiste rol |
|---|---|
| `GET /api/export` | kantoor |
| `GET /api/backup-db` | kantoor |
| `POST /api/herstel-db` | kantoor |
| `GET /api/dbinfo` | kantoor |
| `POST /api/import/reset` | kantoor |
| `POST /api/import/tabel` | kantoor (+ tabelnaam-whitelist) |
| `GET /api/import-themas/preview`, `POST /api/import-themas`, `POST /api/import-themas/data` | kantoor (routes geven sowieso al 410) |
| `POST /api/personeel`, `PUT /api/personeel/:id`, `DELETE /api/personeel/:id` | kantoor |
| `POST /api/personeel/:id/pincode` | eigen id (kantoor of chauffeur) óf rol kantoor |
| `GET /api/wie-ben-ik`, `POST /api/logout` | elke ingelogde rol (ook kv) |
| alle overige `/api/*` achter de sessiepoort | kantoor of chauffeur (kv → 403) |
| `/api/login`, `/api/login-status`, `/api/setup-eerste-pincode`, `/api/personeel-lijst-login`, `/api/kv/*`, `/api/rit-token/*` | publiek (ongewijzigd; eigen token-validatie) |

Rollen: **kantoor** = alles; **chauffeur** = lezen + eigen ritten, geen beheer (schrijfroutes buiten de beheerlijst heb ik niét dichtgezet — dat was buiten de zes punten en zou featuregedrag kunnen raken); **kv** = niets op de admin-API (werkt via kv-link). Niet onder rolcontrole gezet (bewust, buiten opdracht): `/api/personeel/:id/shifts` en `/api/personeel-shifts/:id` (shiftplanning, mogelijk ook door chauffeurs gebruikt) — volgende ronde beslissen.

### Tests gedraaid

`scripts/test-veiligheid.mjs`: eigen server op **3310**, wegwerp-db-kopie in `D:\Sporty\sporty-a-veiligheidstest\` (buiten de worktree; `APP_PASSWORD=veiligheidstest` zodat de Basic-muur actief is), kv- en chauffeur-testpersonen worden in die kopie aangemaakt en weer gewist. De echte `sporty.db` van de worktree wordt enkel gelezen (gekopieerd). 2× gedraaid, 2× groen (58 ok, 0 fout).

Uitvoer run 1:
```
ok    uitgangspunt: Claude (API) heeft nog een kale SHA-256-pincode in de wegwerp-db (0ffe1abd1a08…)
ok    uitgangspunt: er is een sport_item (id 15804)
ok    server op poort 3310 met wegwerp-db D:\Sporty\sporty-a-veiligheidstest\sporty.db
ok    Migratie 56 draaide bij start (labelt SHA-256-pincodes)
ok    /uploads zonder Basic auth → 401 (kreeg 401)
ok    /uploads mét Basic auth → 200 (kreeg 200)
ok    /uploads geeft X-Content-Type-Options: nosniff (kreeg nosniff)
ok    login Claude (API) met SHA-256-pin 1111 → 200 (kreeg 200)
ok    na login staat de pincode als scrypt in de db (scrypt$2a45e7a…)
ok    tweede login tegen de scrypt-hash → 200 (kreeg 200)
ok    foute pincode tegen scrypt-hash → 401 (kreeg 401)
ok    vlag migratie56_klaar staat op 1
ok    niet-ingelogde persoon (Stijn) behoudt zijn hash als sha256$… (sha256$dbff534…)
ok    personeel-lijst-login bevat alleen kantoor/chauffeur (rollen: chauffeur,kantoor)
ok    foto met ext html → 400 (kreeg 400: Ongeldig bestandstype — alleen jpg, jpeg, png of webp)
ok    foto met traversal-ext → 400 (kreeg 400)
ok    geen bestand buiten de uploads-map geschreven (traversal onmogelijk)
ok    geldige png → 200 met server-side naam (sport-15804-1793206390224.png)
ok    png staat in de uploads-map
ok    foto > 2 MB → 400 (kreeg 400: Foto te groot (max 2 MB))
ok    lege data → 400 (kreeg 400)
ok    kantoor maakt kv-testpersoon aan → 200 (id 13)
ok    POST /api/personeel geeft geen pincode-veld terug (wel heeft_pincode)
ok    kantoor zet pincode van kv-testpersoon → 200 (kreeg 200)
ok    PUT /api/personeel geeft geen pincode-veld terug
ok    login kv-testpersoon → 200 rol kv (kreeg 200)
ok    kv op /api/backup-db → 403 (kreeg 403)
ok    kv op /api/export → 403 (kreeg 403)
ok    kv zet pincode van ander (Stijn) → 403 (kreeg 403)
ok    kv op /api/herstel-db → 403 (kreeg 403)
ok    kv op /api/import/reset → 403 (kreeg 403)
ok    kv op /api/dbinfo → 403 (kreeg 403)
ok    kv op gewone admin-route /api/locaties → 403 (kreeg 403)
ok    kv op /api/wie-ben-ik → 200 (kreeg 200)
ok    pincode van Stijn is ongewijzigd gebleven
ok    login chauffeur-testpersoon → 200 (kreeg 200)
ok    chauffeur leest /api/locaties → 200 (kreeg 200)
ok    chauffeur op /api/backup-db → 403 (kreeg 403)
ok    chauffeur POST /api/personeel → 403 (kreeg 403)
ok    chauffeur DELETE /api/personeel → 403 (kreeg 403)
ok    chauffeur zet pincode van ander → 403 (kreeg 403)
ok    chauffeur zet eigen pincode → 200 (kreeg 200)
ok    chauffeur logt in met nieuwe eigen pincode → 200 (kreeg 200)
ok    kantoor op /api/backup-db → 200 sqlite (kreeg 200)
ok    kantoor op /api/dbinfo → 200 (kreeg 200)
ok    kantoor op /api/export → 200 (kreeg 200)
ok    export bevat geen tabel sessies
ok    export: geen pincode in 14 personeel-rijen
ok    export bevat nog wel de gewone tabellen (app_vlaggen, locaties)
ok    import/tabel met injectie-tabelnaam → 400 (kreeg 400: Onbekende tabel: app_vlaggen); CREATE TABLE pwned_a(x); --)
ok    tabel pwned_a bestaat NIET in de db
ok    import/tabel met onbekende tabelnaam → 400 (kreeg 400)
ok    import/tabel met geldige tabelnaam en 0 rijen → 200 (kreeg 200)
ok    import/tabel met geldige tabelnaam en 1 rij → 200 count 1 (kreeg 200)
ok    5× foute login Stijn → 401, 6e → 429 (kreeg 401,401,401,401,401,429)
ok    429 geeft Retry-After (300 s) en wacht_seconden
ok    blokkade is per persoon: Claude (API) logt nog gewoon in → 200 (kreeg 200)
ok    kantoor verwijdert kv-testpersoon → 200

58 ok, 0 fout
ALLES GROEN
```

Uitvoer run 2 (identiek op de tijdstempel in de foto-naam en de salt na; laatste regels):
```
ok    429 geeft Retry-After (300 s) en wacht_seconden
ok    blokkade is per persoon: Claude (API) logt nog gewoon in → 200 (kreeg 200)
ok    kantoor verwijdert kv-testpersoon → 200

58 ok, 0 fout
ALLES GROEN
```

Bestaande tests van de geraakte functies: er bestaan nog geen `scripts/test-*.mjs` in de repo (enkel `fix_woudlucht.js`, `import_sport.js`, `reset_en_import.js`, niet van toepassing) — dit is het eerste. Rookproef op **3301** met de worktree-db: server start (`Migratie 56` draait), `/api/login-status` → 200, `/api/backup-db` zonder token → 401; server daarna gestopt. Poorten 3301/3310 vrij bij afsluiten.

### GEVONDEN (buiten opdracht, niet gefixt)
- `downloadBackup()` in index.html (r.8064) opent `/api/backup-db` als kale `<a href>` zonder `x-auth-token` → krijgt vandaag al 401 van de sessiepoort (los van mijn wijziging). De backup-knop in de UI werkt dus vermoedelijk niet; hoort bij een frontend-ronde.
- Sessies verlopen nooit en worden niet gewist bij DELETE personeel (C-#7, MIDDEL) — bewust niet aangeraakt.
- Omdat `/api/export` geen sessietokens meer meegeeft, blijft C's aanbeveling staan om op prod na deploy de bestaande sessies-tabel te legen (reeds gelekte tokens).
- De pincode `1111` van "Claude (API)" blijft bestaan (nodig voor tests/hoofdchat); C-#4 raadt aan die op prod te vervangen door een lange waarde.

### Buiten mijn gebied
- Geen regel in index.html gewijzigd. De 403's komen via de bestaande `api()`-helper (r.3728-3730) netjes als rode toast met de servertekst ("Geen toegang: hiervoor is de rol kantoor vereist"), dus geen aparte 403-melding nodig.
- De 429 op login: `doLogin` in index.html toont `data.error` bij een niet-ok antwoord (zelfde patroon), dus "Te veel mislukte pogingen — probeer over N seconden opnieuw" verschijnt al; niet aangeraakt.
- Nieuw bestand `scripts/test-veiligheid.mjs` (buiten server.js, maar binnen de opdracht).
- Wegwerpmap `D:\Sporty\sporty-a-veiligheidstest\` staat buiten de repo (mag weg).

### Afwijkingen
- Migratie 56 kan SHA-256 niet rechtstreeks naar scrypt omzetten (pincode niet gekend); ze labelt de hashes (`sha256$…`) en de login-route doet de omzetting per persoon bij succes. Vlag enkel na geslaagde labeling, precies zoals gevraagd.
- Rolcontrole voor kv is ruimer dan de beheerlijst (403 op alle `/api/*` behalve wie-ben-ik/logout), conform "kv = niets op de admin-API". Chauffeur-schrijfroutes buiten de beheerlijst zijn níét beperkt (zou featuregedrag raken; volgende ronde).
- `import-themas/*` kreeg ook `alleenKantoor` (ze geven al 410, maar de code erachter is importcode).

---

## Verslag PROMPT F1 — FUNDAMENT (chat A, 2026-10-28, 22:51 → 23:20, limiet 3 u)

Branch `bouw-a`, gerebased op origin/main (`2781e83`). Commits: `85519b8` (deel 1), `44a37d0` (deel 2), `87e810b` (deel 3). Niet naar main, geen deploy. `index.html` en `MASTERPLAN.md` onaangeraakt.

### Deel 1 — modules (af)
- `server.js`: 5589 → 104 regels (Basic-muur, statics, db openen, ctx, migraties → auth → gedeeld → routes, catch-all `GET *`, foutafhandeling, `app.listen`).
- `lib/db.js` (sql.js, `get/all/run/ins`, `saveDb/flush`, `backupDb`, `now`, `isoDate`, `_genToken`, `resolveItemTypeId`, `logAct`, factory met getter/setter `db`), `lib/migraties.js` (migratieblok letterlijk, `__dirname` → `ctx.ROOT_DIR` voor migratie 42), `lib/auth.js` (login/sessies/rate-limit/poort/`vereisRol`/`alleenKantoor`/wie-ben-ik/pincode/logout), `lib/gedeeld.js` (`_actieveLocatieConfig`, `_kvVerwacht`/`_kvKampmoment`/`_kvNaam`/`_bakItems`, `effectiefMateriaal`, `ensureGedeeldStock`).
- `routes/`: locaties, kv (kv-API + `/kv/:token`-pagina), themas, planning, aanvragen, voorraad, transport (incl. `/rit/:token`, spoed, terugkomst, voertuigen), bakken, beheer (export/import/herstel-db/dbinfo/activiteitenlog/PWA), personeel, sport, conflicten. Volgorde van middleware identiek; statisch gecontroleerd dat geen twee routes met dezelfde methode elkaars pad matchen (0 overlaps / 220), dus groepering per gebied verandert de matching niet.
- Afwijkingen: `DELETE /api/locaties/:id` + `/api/locaties/geocode` naar locaties.js; `GET *` blijft in server.js.
- Bewijs: `scripts/test-f1-modules.mjs` — inventaris origin/main = nieuw = 220 routes; 67 GET-routes + poortchecks < 500; 80 ok / 0 FOUT, 2× groen (later 82 ok na toevoegen routes deel 2/3). `test-veiligheid` 58/58, 2×.

### Deel 2 — atomair + batching (af)
- `flush()` schrijft `sporty.db.tmp` → `fs.renameSync` (getest op Windows), alleen als `vuil`; backup 1/dag, 14 bewaren vanuit flush. `run`/`ins` zetten enkel `vuil=true`.
- `server.js`: middleware `res.on('finish', flush)` vóór de routes, timer 5 s (unref), SIGTERM/SIGINT → flush + exit 0, flush in `uncaughtException`-handler.
- **Gekozen lijn `saveDb`**: `saveDb()` = geforceerde flush (voor code die rechtstreeks `db.run` doet). De ±55 losse aanroepen in routes/auth zijn weggehaald; bewaard in `routes/beheer.js` (import/reset) en `lib/migraties.js` (afsluitende flush na migraties).
- SIGTERM op Windows: `child.kill('SIGTERM')` is TerminateProcess zonder handler. Daarom testhaak `SPORTY_TESTHOOK=1` → `POST /api/_test/sigterm` (`process.emit('SIGTERM')`) en `GET /api/_test/schrijfacties`; zonder env bestaan die routes niet (test bewijst 404); achter Basic + sessiepoort.
- Bewijs: `scripts/test-f1-schrijven.mjs` (poort 3312) — 50 schrijvende calls → server telde 50 flushes, poller (100 ms) zag 3 bestandswijzigingen (≤ 50, > 0); harde kill → herstart → laatste wijziging teruggelezen; SIGTERM via haak → exit 0, geen `.tmp`, wijziging staat na herstart. 22 ok / 0 FOUT, 2× groen.

### Deel 3 — wijzigingslog (af)
- Migratie 65 (`migratie65_klaar`, vlag alleen bij succes): tabel `wijzigingen` zoals gespecificeerd + index `(tabel, rij_id)`.
- Helpers in `lib/db.js` via ctx: `logWijziging`, `insMetLog`, `updateMetLog`, `delMetLog`; object-vorm én raw-SQL-vorm (selecteert eerst de getroffen rijen, logt per id → berekende SET, WHERE op niet-id en bulk-DELETE gedekt). Log-fout blokkeert de schrijving nooit. Zonder sessie: persoon null, context 'kv-link'/'rit-link'/'systeem'.
- Tabelnaam ritten = `transport_ritten` (niet `ritten`).
- Omgezette statements (54): aanvragen.js (POST aanvragen; PUT :id/status → ins rit, ins taak, upd aanvraag); bakken.js (POST themas/:id/bakken, PUT/DELETE bakken/:id, foto-slot 2×, POST/PUT/DELETE vaste-bakken, POST bakken/:id/verplaats); kv.js (POST kv/:token/aanvraag en /kapot, context kv-link); locaties.js (PUT transport-taken/:id/rit 2×); planning.js (POST/PUT/DELETE kampmomenten incl. bulk del transport_taken per rij, kv-token); transport.js (bulk ontkoppelen/koppelen/verwijderen, kopieer-taak, POST/PUT/DELETE transport-taken, PUT :id/status incl. upd bakken, verplaats/datum, POST/PUT/DELETE ritten, klaarzet, `_pasBakAttribuutStatusToe` 2× upd bakken context rit-link, spoedtransport, rit-token).
- Grep `INSERT INTO|UPDATE|DELETE FROM` op de vijf tabellen in `routes/`, `lib/gedeeld.js`, `lib/auth.js` buiten `…MetLog(req`: leeg (hoofdchat herdraaid: 0).
- Route `GET /api/wijzigingen?tabel=&rij_id=&limit=` (`alleenKantoor`, 100 standaard, max 1000, nieuwste eerst) in `routes/beheer.js`.
- Bewijs: `scripts/test-f1-wijzigingen.mjs` (poort 3313) — kampmoment insert/update/delete met exacte oud/nieuw en persoon "Claude (API)"; bak-update via rit-token/laden → rit-link, persoon null; aanvraag via kv-link; filters/limit; chauffeur → 403; zonder Basic/token 401. 46 ok / 0 FOUT, 2× groen. Alle vier scripts ook na rebase groen; hoofdchat herdraaide schrijven/wijzigingen/veiligheid onafhankelijk: groen.

### GEVONDEN (niet gefixt)
- `POST /api/kampmomenten` slikt elke fout in als 400 "bestaat al" (catch-all zonder logging).
- `POST /api/ritten/:id/klaarzet` schrijft `klaarzet_door` uit de body i.p.v. `req.persoon.naam`.
- Lokale `sporty.db` van chat A was al gemigreerd (56-vlag); vervangen door verse kopie uit sporty-railway voor de tests.

### Buiten mijn gebied
- `scripts/test-f1-modules.mjs` kreeg een whitelist voor `/api/_test/*` en `GET /api/wijzigingen`.
- `_pasBakAttribuutStatusToe` (routes/transport.js) kreeg een extra `req`-parameter.
- Push naar bouw-a 2× met `--force-with-lease` (rebase op vooruitgelopen origin/main herschreef eigen commits; inhoud identiek, main onaangeraakt).
