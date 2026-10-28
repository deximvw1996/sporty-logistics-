# PROMPT V1 — TESTHARNAS: vaste testdata, hulpbibliotheek, volle run
**Chat B (Opus) · map `D:\Sporty\sporty-b` · branch `bouw-b` · poort 3302 · verslag `OVERLEG-b.md` · TIJDSLIMIET 2 uur**

Lees eerst `CLAUDE.md` in je map. Begin met `git fetch origin` en `git rebase origin/main` (F1 is gemerged: de server staat nu in `server.js` + `lib/` + `routes/`). Je raakt ALLEEN `scripts/_testhulp.mjs`, `scripts/volle-run.mjs`, `scripts/test-keten-*.mjs`, `scripts/testdata/` en `OVERLEG-b.md`. Geen regel app-code: vind je een fout, dan is dat een GEVONDEN in je verslag, en de test die hem aantoont blijft rood staan (dat is zijn werk).

## Waarom deze prompt
Vier bouwchats gaan tegelijk in de transportketen werken. Zonder gedeeld harnas bewijst iedereen met een eigen script op een eigen db-kopie, en niemand ziet dat chat C iets van chat D breekt. Er is één voorbeeld om op te bouwen: `scripts/test-veiligheid.mjs` (eigen server op een vrije poort, wegwerp-db buiten de worktree, ok/FOUT-regels, ALLES GROEN). Dat patroon wordt nu een bibliotheek.

## Deel 1 — `scripts/_testhulp.mjs`
Eén ESM-module die elk testscript importeert. Minimaal:
- `startServer({poort, dbBron, appPassword})` → start `server.js` als kindproces met `DATA_DIR` = wegwerpmap `D:\Sporty\sporty-b-test-<poort>` (buiten de worktree), kopieert `dbBron` erin, wacht tot `/api/login-status` antwoordt (max 20 s), geeft `{stop(), log()}` terug. `stop()` altijd in `process.on('exit')`.
- `login(base, persoonId, pincode)` → token; `api(base, token, method, pad, body)` → `{status, json}` met Basic-auth én `x-auth-token` erbij.
- `leesDb(pad, sql)` via sql.js (zoals in test-veiligheid).
- `ok/fout/check/einde()`: `einde()` drukt `ALLES GROEN` of `N FOUT` af en zet de exitcode (0/1).
- `kvToken(base, token, kampmomentId)` en `ritToken(base, token, ritId)`: haalt/maakt de kv-link en de rit-link (zie `POST /api/ritten/:id/token`; een kv-token bestaat pas als er een KV gekoppeld is: koppel in de test zelf een persoon met rol kv).

## Deel 2 — vaste testdata `scripts/testdata/`
- `maak-testdb.mjs`: start van een kopie van `sporty.db` en bouwt daar bovenop een **vaste, kleine herfst-situatie** via de API (niet via SQL, zodat de test hetzelfde pad volgt als een gebruiker): een vakantieperiode "Herfst TEST" (2–8 nov 2026, actief), twee kamplocaties (bestaande: Abdijschool Vlierbeek en Betekom), per locatie één kampmoment week 1 met een kampthema dat bakken, attributen én poolbehoefte heeft (kies er een met `thema_behoefte`, bv. Holderdebolder, en één met bakken, bv. Alles op wieltjes), een KV-persoon gekoppeld aan elk kampmoment, één chauffeur. Schrijft het resultaat weg als `scripts/testdata/herfst-test.db` (gitignored? NEE: deze db hoort in git, het is de ijkstandaard; hou hem klein door geen foto's toe te voegen) plus `herfst-test.json` met de aangemaakte ids.
- Alle ketentests starten vanaf die db-kopie, nooit vanaf de live `sporty.db`.

## Deel 3 — ketentests (regressie, raken de gevonden fouten aan)
Schrijf ze zo dat ze de GEWENSTE uitkomst testen (zoals het DRAAIBOEK hem beschrijft), ook als de code dat vandaag nog niet doet. Een test die vandaag rood is, is goed: hij is de meetlat voor chat C en D. Zet in de kop van elk script welke werklijst-/DOORLICHTING-nummers hij bewaakt.
1. `test-keten-levering.mjs` (werklijst 13, 14; B-F4/F5, T-G3): genereer voorstellen voor het Betekom-kampmoment → maak de leveringstaak → rit → rit-token → alles laden → alles lossen. Verwacht: elke bak `op_locatie`; bulk-spreiding van elk bulk-item op de locatie = het geleverde aantal en thuis = bezit − geleverd; taak én rit `gedaan`; som van de spreiding = bezit (nooit 34 van 17). Zet de taak terug op `gepland` en opnieuw `gedaan`: spreiding onveranderd.
2. `test-keten-ophaling.mjs` (werklijst 15, T-G6): na de levering een ophalingstaak + rit → rit-token toont voor de stop een bakkenlijst (codes) ZONDER dat eerst "Klaarzetten" nodig was.
3. `test-keten-aanvraag.mjs` (werklijst 11, 12; B-F8): KV dient aanvraag in via kv-link → kantoor keurt goed met spoedtransport → de spoedtaak heeft bron (een stockagelocatie), bestemming (de kamplocatie van het kampmoment), datum binnen de kampweek, het aantal uit de aanvraag. Daarna afwijzen → de spoedtaak is geannuleerd/verwijderd, niet meer `gepland`.
4. `test-keten-splits.mjs` (werklijst 18; B-F6/F7): taak met checks splitsen → beide taken hebben hun eigen checks; taak verwijderen na laden → bakken staan niet eeuwig `onderweg` (verwacht: terug `thuis` of de API weigert met een duidelijke fout; test beide als aanvaardbaar en druk af welke).
5. `test-keten-periode.mjs` (werklijst 7, 8; B-F2/F3, T-G7): een tweede, niet-actieve periode "Zomer TEST" met een kampmoment op dezelfde locatie, zelfde week 1 en zelfde thema. Verwacht: `/api/conflicten` voor de actieve periode meldt GEEN dubbel_thema met de zomer; `transport-genereer` levert geen zomer-sportsets of kleurenborden in de herfst; na herstart van de server is de actieve periode nog "Herfst TEST".

## Deel 4 — `scripts/volle-run.mjs`
Draait alle `scripts/test-*.mjs` na elkaar (elk in eigen proces, eigen poort uit een reeks 3320–3339, timeout 10 min per test), drukt per test één regel `GROEN`/`ROOD (n fout)`/`AFGEBROKEN` en een eindtabel. Exitcode 1 als er iets rood is. Opties `--alleen a,b` en `--vanaf naam`. Dit is wat Fable draait bij elke keuring.

## Bewijs en afsluiten
- `node scripts/testdata/maak-testdb.mjs` 2× → identieke ids in `herfst-test.json` (deterministisch).
- `node scripts/volle-run.mjs` 2×: `test-veiligheid` groen; de vijf ketentests mogen rood zijn, maar elke rode regel moet een echte, met het DRAAIBOEK onderbouwde verwachting zijn, geen scriptfout. Plak de eindtabel in je verslag en leg per rode test in één regel uit welk gedrag ontbreekt (dat is de overdracht naar C en D).
- Commit per deel, push `origin HEAD:bouw-b`. NOOIT naar main, NOOIT deploy.bat.
- Verslag onderaan `OVERLEG-b.md`; laatste bericht aan Maxim eindigt met exact: **VOLLEDIG KLAAR MET DE PROMPT. NU IS HET TERUG AAN DE HOOFDCHAT.** Bij de tijdslimiet: stop, commit, "Stand bij tijdslimiet", push, en eindig met **TIJDSLIMIET BEREIKT: GESTOPT MET EEN TUSSENSTAND. NU IS HET TERUG AAN DE HOOFDCHAT.**
