# PROMPT F1 — FUNDAMENT: modules, atomaire schrijving, wijzigingslog
**Chat A (Fable) · map `D:\Sporty\sporty-a` · branch `bouw-a` · poort 3301 · verslag `OVERLEG-a.md` · TIJDSLIMIET 3 uur**

Lees eerst `CLAUDE.md` in je map (de werkregels gelden volledig). Begin met `git fetch origin` en `git rebase origin/main` in `D:\Sporty\sporty-a`. Kopieer een verse `sporty.db` uit `D:\Sporty\sporty-railway\sporty.db` als je er geen hebt. Je raakt ALLEEN `server.js`, nieuwe bestanden onder `lib/` en `routes/`, `scripts/test-f1-*.mjs` en `OVERLEG-a.md`. `index.html` blijft dicht.

## Waarom deze prompt
`server.js` is 5.589 regels en bijna alles staat in één functie `startServer()`. Vier andere bouwchats moeten er straks tegelijk in werken; dat kan alleen als het bestand in modules staat. Daarnaast wordt de database (sql.js, in geheugen) bij ELKE `run()`/`ins()` volledig naar schijf geschreven met `fs.writeFileSync` op het echte pad: een crash halverwege = kapot bestand, en honderden schrijfacties per request. Tot slot wil Maxim dat niets nog verloren gaat: elke wijziging aan elk gegeven moet terug te vinden en omkeerbaar zijn ("zoals Google Drive"). Deze prompt legt dat fundament. Gedrag naar buiten (API, schermen) verandert NIET.

## Deel 1 — Opdeling in modules (eerst, dit ontgrendelt de andere chats)
Doel: `server.js` wordt een kort startbestand (richtcijfer < 300 regels) dat de database opent, de migraties draait, de middleware zet en per gebied een route-module registreert. Werkwijze:
1. **`lib/db.js`**: alles rond sql.js: openen, `get/all/run/ins`, `saveDb`, `backupDb`, `now`, `isoDate`, `_genToken`, `resolveItemTypeId`, `logAct`. Exporteert een object met die functies (geen losse globals). Deel 2 bouwt hierop verder.
2. **`lib/migraties.js`**: het hele blok `// ── SCHEMA MIGRATIONS ──` t/m de laatste migratie (regel ±124 t/m ±1920), als `module.exports = function(dbx){...}` met `addColumnIfMissing`/`createTableIfMissing` erin. Volgorde en inhoud van de migraties blijven letterlijk gelijk: migraties zijn bevroren geschiedenis, je herschrijft er geen enkele.
3. **`lib/auth.js`**: login/sessies/rate-limit/`checkSessie`/`vereisRol`/`alleenKantoor`/publieke paden/de auth-poort-middleware (blok `S3.2: LOGIN / SESSIES` + de poort erna).
4. **`routes/<gebied>.js`**, één per groep van de bestaande `// ── ... ──`-kopjes. Elk bestand: `module.exports = function(ctx){ const {app,get,all,run,ins,now,logAct,alleenKantoor,vereisRol,...} = ctx; ...routes letterlijk verplaatst... }`. Voorgestelde indeling (pas aan als de code het anders wil, maar noem de indeling in je verslag):
   - `locaties.js` (LOCATIES, LOCATIECONFIG, LOCATIE MATERIAAL, STANDAARD MATERIAAL, KLEURENBORDEN)
   - `themas.js` (THEMAS, THEMABUNDEL-PDF'S, PLANNING-IMPORT, THEMA CATEGORIEËN, MATERIAAL, ITEM TYPES, CATALOGUS ITEM DETAIL)
   - `planning.js` (KAMPMOMENTEN, THEMAS AAN KAMPMOMENT, KALENDER, VAKANTIEPERIODES, SEIZOENSOVERZICHT)
   - `bakken.js` (THEMA BAKKEN, VASTE BAKKEN, ATTRIBUTEN, THEMABEHOEFTE POOL, BAK/ATTRIBUUT-STATUS, BAK FOTO'S, GEDEELD MATERIAAL, STOCK OVERZICHT)
   - `transport.js` (TRANSPORT, TRANSPORT RITTEN, VERHUIS CHECKS, chauffeurspagina-vinkfases, SPOEDTRANSPORT, TERUGKOMST, RETOUR STATUS, VOERTUIGTYPES, VOERTUIGBEZETTING, CHAUFFEUR-VIEW)
   - `voorraad.js` (VERBRUIKSSTOCK, VOORRAAD NAKIJKEN, VOORRAAD/BESTELLIJST, NAKIJKEN, TEKORTEN PER BAK, TEKORTENDASHBOARD)
   - `aanvragen.js` (AANVRAGEN)
   - `sport.js` (SPORT MATERIAAL, FOTO PER SPORT ITEM)
   - `personeel.js` (PERSONEEL + pincode-routes die niet in auth.js horen)
   - `kv.js` (KV-scherm: "wat hoort er te staan" + de KV-SCHERM-pagina)
   - `conflicten.js` (CONFLICTENDETECTOR)
   - `beheer.js` (DATA EXPORT/IMPORT, ACTIVITEITENLOG, PWA, herstel-db)
5. **Gedeelde logica**: functies die door meer dan één gebied gebruikt worden (bv. de "wat hoort er te staan"-berekening die zowel het KV-scherm als de transport-generator gebruikt, `_tabelBestaat`, foto-helpers) gaan naar `lib/<naam>.js` en worden via `ctx` doorgegeven. Grep op elke functienaam die je verplaatst vóór je het bestand sluit; een `ReferenceError` bij de eerste klik is de klassieke fout hier.
6. De globale foutafhandeling en `app.listen` blijven in `server.js`, als laatste.

Verboden: routes herschrijven, SQL "verbeteren", volgorde van middleware wijzigen (de auth-poort moet vóór de beschermde routes blijven en ná de publieke), iets aan `index.html` doen. Dit deel is knippen en plakken met discipline.

**Bewijs deel 1** — `scripts/test-f1-modules.mjs`:
- Route-inventaris: lees `server.js` + `routes/*.js` + `lib/auth.js` en tel alle `app.get/post/put/delete`-registraties per methode+pad; vergelijk met de inventaris van `origin/main` (haal die op via `git show origin/main:server.js` in het script). Verwacht: identieke set (220 routes op 28/10), anders FOUT met de verschillen.
- Start de server op poort 3311 met een kopie van je db, log in als kantoor (gebruik `scripts/test-veiligheid.mjs` als voorbeeld voor login), en roep ELKE GET-route zonder padparameters aan, plus de routes met `:id` met het eerste bestaande id uit de bijhorende tabel. Verwacht per route: status < 500. Druk per route één regel `ok`/`FOUT` af.
- Draai `scripts/test-veiligheid.mjs` opnieuw: 58/58.
- Alles 2× groen. Commit: `F1 deel 1: server.js opgedeeld in lib/ en routes/ (gedrag ongewijzigd)`. Push `origin HEAD:bouw-a`. Meld in de chat dat deel 1 af is (zonder klaar-zin) en ga door.

## Deel 2 — Atomaire schrijving en schrijf-batching (in `lib/db.js`)
1. **Atomair**: `saveDb` schrijft naar `sporty.db.tmp` in dezelfde map en doet dan `fs.renameSync` naar `sporty.db`. Nooit meer rechtstreeks op het echte bestand.
2. **Batching**: `run`/`ins` schrijven niet meer zelf naar schijf; ze zetten een vlag `vuil=true`. Een middleware in `server.js` (vóór de routes) hangt `res.on('finish', () => flush())` aan elk request; `flush()` schrijft alleen als `vuil`. Daarnaast: een timer die elke 5 s flusht als `vuil`, en een flush op `SIGTERM`, `SIGINT` en vóór `process.exit` in de bestaande `uncaughtException`-handler. Alle losse `saveDb()`-aanroepen in de routes (±59) worden overbodig: haal ze weg (grep) of laat `saveDb` een alias van `flush` zijn; kies één lijn en noem ze in het verslag.
3. Backup-gedrag (1 per dag, 14 bewaren) blijft gelijk en wordt vanuit `flush` aangeroepen.

**Bewijs deel 2** — `scripts/test-f1-schrijven.mjs`:
- Start server op 3312 met een db-kopie; doe 50 schrijvende API-calls (bv. locatie aanmaken/wijzigen/verwijderen); tel hoe vaak `sporty.db` op schijf verandert (mtime of hash per 100 ms): verwacht ≤ 50 en > 0; herstart de server in het script en lees de laatste wijziging terug.
- Stuur `SIGTERM` naar het serverproces direct na een schrijfactie (vóór de 5s-timer): na herstart staat de wijziging er. Geen `.tmp`-bestand achtergebleven.
- Commit: `F1 deel 2: atomaire schrijving + flush per request/SIGTERM`. Push.

## Deel 3 — Wijzigingslog (fundament voor "niets gaat verloren")
1. Nieuwe migratie (volgend nummer na de hoogste bestaande): tabel `wijzigingen (id INTEGER PRIMARY KEY, tijdstip TEXT, persoon_id INTEGER, persoon_naam TEXT, tabel TEXT, rij_id INTEGER, actie TEXT CHECK(actie IN ('insert','update','delete')), oud TEXT, nieuw TEXT, context TEXT)` + index op `(tabel, rij_id)`. `oud`/`nieuw` zijn JSON van de hele rij (bij insert `oud` null, bij delete `nieuw` null).
2. Helpers in `lib/db.js`: `logWijziging(req, tabel, rijId, actie, oud, nieuw, context)` (persoon uit `req.persoon` als die er is, anders `null` + context 'kv-link'/'rit-link'/'systeem'); en drie gemaksfuncties `insMetLog(req, tabel, kolommen, waarden, context)`, `updateMetLog(req, tabel, id, velden, context)` (leest de oude rij, doet de UPDATE, logt oud+nieuw) en `delMetLog(req, tabel, id, context)`.
3. Bedraad in dit deel ALLEEN de logistieke kern, letterlijk deze tabellen: `bakken` (elke status-/locatiewijziging), `transport_taken`, `ritten`, `aanvragen`, `kampmomenten`. Alle INSERT/UPDATE/DELETE-statements op die vijf tabellen in de routes gaan via de helpers. De andere tabellen volgen in latere prompts; schrijf in het verslag welke statements je hebt omgezet (grep `INSERT INTO bakken|UPDATE bakken|DELETE FROM bakken` enz. moet buiten `lib/db.js` leeg zijn voor die vijf tabellen).
4. Route `GET /api/wijzigingen?tabel=&rij_id=&limit=` (`alleenKantoor`, standaard 100, nieuwste eerst) in `routes/beheer.js`. Geen terugzet-knop in deze prompt (komt later), maar uit `oud` moet een rij terug te zetten zijn, dus volledige rijen loggen.

**Bewijs deel 3** — `scripts/test-f1-wijzigingen.mjs`:
- Server op 3313; als kantoor: maak een kampmoment, wijzig het, verwijder het → 3 regels in `wijzigingen` met juiste `actie`, `persoon_naam`, en `oud`/`nieuw` die exact de rijen zijn; zelfde voor een bak-statuswijziging via de chauffeursroute (context 'rit-link', persoon_id null) en voor een aanvraag via de kv-link.
- `GET /api/wijzigingen?tabel=kampmomenten` geeft die regels; als chauffeur-rol → 403.
- Alle drie testscripts + `test-veiligheid` 2× groen. Commit: `F1 deel 3: wijzigingen-tabel + helpers, bedraad op bakken/transport_taken/ritten/aanvragen/kampmomenten`. Push.

## Afsluiten
- Verslag onderaan `OVERLEG-a.md`: per deel wat af is, bewijs in één regel per claim (testnaam + uitslag + 2×), de module-indeling, de gekozen lijn voor `saveDb`, de omgezette statements van deel 3, GEVONDEN (alles wat je kapot zag maar niet mocht fixen).
- Push `origin HEAD:bouw-a`. NOOIT naar main, NOOIT deploy.bat.
- Laatste bericht aan Maxim eindigt met exact: **VOLLEDIG KLAAR MET DE PROMPT. NU IS HET TERUG AAN DE HOOFDCHAT.**
- Tijdslimiet bereikt → stop, commit wat af is, kop "Stand bij tijdslimiet" in het verslag, push, en eindig met: **TIJDSLIMIET BEREIKT: GESTOPT MET EEN TUSSENSTAND. NU IS HET TERUG AAN DE HOOFDCHAT.** Deel 1 alleen is al waardevol; liever deel 1 af dan drie delen half.
