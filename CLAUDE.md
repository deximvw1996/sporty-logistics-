# Sporty — werkregels voor bouw- en testchats (2026-10-28)

Sporty is de logistiek-app van Sporty Creactief vzw (Node/Express + sql.js, één `server.js` + `index.html`).
**Doel tot 11 november: de app draait waterdicht de herfstvakantie (2–8 nov) en draagt Maxims sollicitatie.**
Hoofdchat (Fable) ontwerpt, schrijft prompts, keurt en deployt; bouwchats bouwen precies één opdracht.
Lees bij elke opdracht ook de FASE V-sectie en STATUSLOG van `MASTERPLAN.md`.

## De gouden regel van dit project
**Een push naar `main` deployt ONMIDDELLIJK naar productie (Railway) — en de app wordt volgende week écht gebruikt.**
Daarom: een bouwchat pusht ALLEEN naar zijn eigen branch (`git push origin HEAD:bouw-<letter>`), nooit naar main.
Mergen naar main + deployen doet uitsluitend de hoofdchat, na keuring. `deploy.bat` is dus verboden terrein voor bouwchats.

## Parallel bouwen — vaste indeling
Elke chat heeft een EIGEN map (git worktree), EIGEN branch, EIGEN poort, EIGEN database-kopie en EIGEN verslag.

| chat | model | map | branch | poort | verslag |
|---|---|---|---|---|---|
| A | Fable (bouw) | D:\Sporty\sporty-a | bouw-a | 3301 | OVERLEG-a.md |
| B | Opus | D:\Sporty\sporty-b | bouw-b | 3302 | OVERLEG-b.md |
| C | Opus | D:\Sporty\sporty-c | bouw-c | 3303 | OVERLEG-c.md |
| D | Sonnet | D:\Sporty\sporty-d | bouw-d | 3304 | OVERLEG-d.md |
| E | Sonnet | D:\Sporty\sporty-e | bouw-e | 3305 | OVERLEG-e.md |
| T | testchat(s), bouwen niets | D:\Sporty\sporty-t | test-<nr> | 3306 | OVERLEG-t.md |

- **D:\Sporty\sporty-railway is van Maxim en de hoofdchat** (daar draait zijn lokale kopie op 3001). Een bouwchat werkt daar NOOIT, ook niet "even". Sta je in de verkeerde map: stap zonder vragen over naar je eigen map.
- **Poort**: start je server als `set PORT=<jouw poort>&& node server.js` (of `$env:PORT=<poort>; node server.js`), los gestart, niet hangend in je werkterminal.
- **Database**: elke map heeft een eigen `sporty.db`. Bestaat hij niet of zegt de prompt "verse data": kopieer hem uit `D:\Sporty\sporty-railway\sporty.db`. Je lokale db is wegwerp-testdata; échte data-invoer gebeurt alleen door de hoofdchat.
- **Begin van elke opdracht**: `git fetch origin` + `git rebase origin/main` in je eigen map (branch schoon).
- **Afleveren** (na elke afgeronde stap): rebase op origin/main, je tests opnieuw, dan `git push origin HEAD:bouw-<letter>`. Conflict in een bestand dat niet in je opdracht staat: NIET oplossen, stoppen en melden.
- **Nooit**: `git stash`, `reset`, `checkout -- <pad>`, `restore`, `clean`; nooit de map/branch van een ander; je worktree niet verwijderen; nooit pushen naar main; nooit `deploy.bat`.
- **server.js en index.html zijn één groot gedeeld bestand.** Daarom wijst elke prompt een eigen FUNCTIE-/SECTIEGEBIED aan (regelbereik of functienamen). Blijf daarbinnen; één regel daarbuiten nodig (een route-registratie, een import): melden onder "buiten mijn gebied".

## Bindende regels (uit 3 maanden Sporty-geschiedenis)
1. **Prod is heilig.** API-token-login ("Claude (API)", pincode 1111, header `x-auth-token`) + Basic auth zijn de muren; elke nieuwe route hoort áchter beide (statics incl. — zie de /bundels-les). Geen endpoint zonder login-check.
2. **Databewijs, nooit op zicht.** Elke claim wordt bewezen met echte HTTP-calls en teruggelezen data. "Het ziet er goed uit" bestaat niet.
3. **De bak is de kleinste transporteenheid; chauffeur ziet bakken, kantoor ziet inhoud; alles met code ligt in de Rozenweg** (ontwerpregels MASTERPLAN §1 — lees ze).
4. **Migraties zijn gegate** op `app_vlaggen` (herseed-les!). Een nieuwe migratie krijgt een eigen vlag `migratieNN_klaar` en draait exact één keer. Nooit een seed zonder gate.
5. **Dynamisch, nooit hardgecodeerd**: geen jaartallen, geen weeknummers, geen "zomer"-aannames in code. Alles loopt via vakantieperiodes uit de database (herfst 1 week, kerst 2, zomer 9 — alles moet kunnen).
6. **Oude opslag blijft laden**: nieuwe kolommen via `addColumnIfMissing` met default; `deserialize`-gedrag nooit breken. De prod-database is 3 maanden werk.
7. **Nederlandse spelerstaal** in de UI, geen veldnamen/jargon richting kantoor/chauffeur/KV; bestaande compacte codestijl volgen.
8. **Foutafhandeling zichtbaar**: een mislukte actie toont een begrijpelijke melding (toast/modal), nooit een stille mislukking of kale browser-prompt/alert in nieuwe code.

## Bewijsplicht per opdracht
- Eén testscript `scripts/test-<naam>.mjs` naar het patroon in `scripts/` (start eigen server op een vrije poort of draait tegen je lopende server; ok/FOUT-regels; eindigt met `ALLES GROEN`), 2× groen gedraaid, uitslag in je verslag.
- Draai daarnaast de bestaande tests van de bestanden/functies die je raakt (grep op de naam in `scripts/test-*.mjs`, noem ze). De VOLLE RUN (`node scripts/volle-run.mjs`) is van de hoofdchat bij de keuring.
- Bij UI-werk: zelf-klik-verificatie in de draaiende pagina op jóúw poort (klikpad + wat je zag + console leeg), en bij een mockup: element-voor-element-afwijkingslijst die leeg is.
- GEEN ACHTERGRONDWACHTEN: elke test in de voorgrond, timeout ≤ 10 minuten, uitslag zelf lezen. Een test die langer duurt is zelf fout (GEVONDEN).
- Testdata die je aanmaakte in je eigen db hoef je niet op te ruimen (wegwerpkopie), maar je test mag nooit tegen 3001 of prod draaien.

## Eén onderwerp, tijdslimiet, klaar-zin
- ÉÉN ONDERWERP PER PROMPT, hoogstens ~2 uur werk. Krijg je meer: zeg het in je eerste bericht en doe het eerste onderwerp.
- TIJDSLIMIET in de kop van elke prompt (ontbreekt hij: 2 uur). Lees de klok bij start (`Get-Date -Format HH:mm`), zet start+limiet in je eerste bericht. Limiet bereikt → STOP, commit wat af is, verslag met "Stand bij tijdslimiet", push naar je branch, en sluit af met: **TIJDSLIMIET BEREIKT: GESTOPT MET EEN TUSSENSTAND. NU IS HET TERUG AAN DE HOOFDCHAT.**
- Verslag onderaan je EIGEN `OVERLEG-<letter>.md` (toevoegen, nooit herschrijven): wat af is, bewijs in één regel per claim, tests gedraaid, GEVONDEN (kapotte dingen buiten je opdracht: noteren, niet fixen), "buiten mijn gebied".
- Je LAATSTE BERICHT AAN MAXIM eindigt met exact deze regel, in hoofdletters, als laatste regel: **VOLLEDIG KLAAR MET DE PROMPT. NU IS HET TERUG AAN DE HOOFDCHAT.** Zonder die regel ben je niet klaar. Tussenberichten krijgen hem nooit; commit je daarna nog iets, dan eerst afmaken en de regel opnieuw.

## Testchats (T)
Een testchat bouwt niets en wijzigt geen code. Hij draait een TESTPLAN van de hoofdchat tegen zijn eigen kopie (map sporty-t, poort 3306, verse db-kopie): rollenspel kantoor → transport → chauffeur → KV → aanvulling, met echte clicks en echte API-checks. Verslag in OVERLEG-t.md: per stap OK/FOUT + schermafdruk of API-bewijs, afgesloten met dezelfde klaar-zin. Vindt hij een fout: noteren onder GEVONDEN met reproductiestappen, niet fixen.
