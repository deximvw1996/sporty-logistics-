# PROMPT TF7 — T4: geen capaciteitsgok meer, rit afwerken, meldingen, KV
**Chat C (Opus) · map `D:\Sporty\sporty-c` · branch `bouw-c` · poort 3303 · verslag `OVERLEG-c.md` · TIJDSLIMIET 3 uur**

Lees eerst `CLAUDE.md`. Ga naar je branch (`git checkout bouw-c`), dan `git fetch origin` en `git rebase origin/main`. Controleer de exitcode van de rebase zelf vóór je pusht. Lees dan volledig: `TESTVERSLAG-T4-chauffeur.md`, `TESTVERSLAG-T4-kv.md`, `TESTVERSLAG-T4-coordinator.md` (N2, N3, N4, N5, N7), `public/rit.*` en de rit-token-routes, `routes/transport.js`, `routes/ritplanning.js`, `public/ritplanning.*`, `routes/voertuigen.js`, `public/voertuigen.*`, `routes/meldingen.js`, `routes/kv.js`, `public/kv.*`, `routes/vandaag.js`, `lib/gedeeld.js`.

Je raakt ALLEEN de bestanden hierboven, plus `routes/nakijken.js` en `public/nakijken.js` (alleen Punt 3, eerste bullet en de gsm-uitklap), `scripts/test-tf7-*.mjs`, aangepaste tests, `OVERLEG-c.md`. NIET `public/tekorten.*`, `routes/tekorten-overzicht.js`, `public/aanvullen.*`, `public/vandaag.*`, `public/taken.*`, `routes/taken.js`, `public/kampmomenten.*` (chat D).

## Punt 1 — Geen capaciteitsgok (BINDEND, Maxim 31/10)
"Wij weten niet hoeveel spullen er exact in een voertuig past. Tijdens het inladen merken we dan of het gaat lukken of niet." De app rekent dus niet uit of iets past.
- Weg overal: "n bakken op m plaatsen", "n/m bakken", rode of ⚠-capaciteitswaarschuwing, `over_capaciteit`, en de bevestiging bij klaarzetten. Kantoor mag dus niet meer tegengehouden of gewaarschuwd worden op een berekening, ook niet op de gsm, Voertuigen of Vandaag.
- De rit toont gewoon wat erop staat: "14 bakken + 36 losse stuks", altijd zo en overal dezelfde telling.
- Het veld plaatsen bij een voertuig blijft bestaan als vrije informatie ("± 20 bakken"), zonder berekening; label aanpassen.
- De echte controle is **Past niet** bij het laden; die blijft en gaat als taak naar kantoor. Dit wordt bovenaan de ritplanning zichtbaar met een teller.
- Bestaande data niet wissen. Pas tests aan met uitleg.

## Punt 2 — Rit op gsm
- **Vroeger mag (BINDEND, Maxim):** "Wat vroeger kan en mag gedaan worden, mag vroeger gedaan worden." Laden, aankomen en lossen zijn op een vroegere dag nooit geblokkeerd en vragen geen bevestiging; alleen een kleine tekst "gepland voor di 3/11".
- Opnieuw klaarzetten geeft een melding "staat weer klaar" (T4 G1).
- Melding samenvoegen: alleen wijzigingen onder elkaar; "aan jou toegewezen", "rijd je niet meer", "staat voor je klaar" en "staat niet meer klaar" worden nooit overschreven (T4 G2). Melding en balk noemen welke stop, en "rijd je niet meer" zegt wat er moet gebeuren met wat al geladen is.
- Ongedaan maken op een afgeronde stop: de stop en de rit gaan weer open en de bakken terug zoals het hoort, of de knop wordt niet aangeboden. Scherm en data zeggen hetzelfde. Kies en leg uit (T4 G3, coördinator N3). Toast geldt alleen voor het scherm waarop je staat (N4), bedekt geen regels, en na 6 s blijft bovenaan de stop "Laatste actie ongedaan maken" tot de volgende actie (T4 G7).
- Eén telling: knop, vraag en toast noemen hetzelfde en zeggen wat ze tellen, "Alles geladen (12 regels · 42 stuks)"; blok en kop tellen gelijk (T4 G4, N5). Samengevoegde regel toont de juiste naam en aantal (T4 G6).
- Knop "Alles geladen" voor het hele blok (T4 G5), en per regel voor welke stop.
- **Set op een kamp hoort niet onder "Laden in Rozenweg"** (N2): laadblok per echte plaats.
- Herladen op een blok blijft op het blok (G8). Lossen vóór aankomst geeft een boodschap (G9). Niet-klaargezette link heeft een knop naar Vandaag (G10). Ritten-tab op tijd (G11). Kantoorlinks uit de HTML van de ploeg (G12). Vertrektijd op de rit (G13). "📞 Bel kantoor" leesbaar (N7). Bij een wissel: duidelijk wat er met de tijd gebeurt.
- `klaarzet-terug`-knop in de ritplanning voor kantoor. `PUT /api/transport-taken/:id` met enkel `wie` geeft geen 500. Een eerste stop die veel later is dan het vertrek geeft een waarschuwing (N6).

## Punt 3 — KV
- **Opgelost tekort (akkoord Maxim):** telt de KV na en is een tekort, waarvoor kantoor al besliste, weg, dan wijzigt de beslissing niet vanzelf, maar kantoor krijgt in Nakijken bij die regel de vraag "Dit tekort is weg. Bestelling nog nodig?" met knoppen Nog nodig / Annuleren, en één melding. Annuleren zet ook een nog niet geplaatste bestelling stop; is ze al besteld: uitleg. Gelogd. De tabel toont de laatste telling (N1).
- "Eerdere tellingen" ook op gsm in Nakijken (T4 kantoor G10). Melding bevat alleen echte wijzigingen, geen "52 → 52", en een stuk zonder wijziging krijgt geen nieuwe versie; ook een identieke natelling niet (kantoor G9, KV N4). Een notitie blijft bij de telling waarop ze gezegd werd (N7).
- Overzicht: kaart Aanvragen toont de antwoorden ("1 goedgekeurd, 1 afgewezen"), tab-teller telt alleen wat wacht (N2). Goedgekeurd: wanneer komt het, uit de gekoppelde taak en rit ("komt vr 6 nov met de rit") (N3).
- Kamp zonder bak: geen tegenstrijdige tekst (N5). Lezen-stand zonder schrijfuitleg (N6). Kapot-sheet start op de bak waarin je zit (N8). Kaart Tellen toont alle afwijkingen, of "+3" (N10). "0/2 bakken" telt ook begonnen bakken, "2 wijzigingen" zegt welke. Waarschuwing "Levering nog niet aangekomen" klopt met de rit. Pagina afgelopen en kamp zonder bak: kantoornummer als dat is ingesteld.

## Bewijs
`scripts/test-tf7-rit.mjs` en `scripts/test-tf7-kv.mjs` (via `_testhulp`, eigen poort): geen enkele capaciteitstekst of -bevestiging op ritplanning, gsm, Vandaag, Voertuigen; "14 bakken + 36 losse stuks"; rit een dag vroeger afwerken zonder vraag; meldingen blijven apart; ongedaan op afgeronde stop; tellingen gelijk; opgelost tekort met beide keuzes; identieke natelling geen versie en geen melding. Bestaande rit-, kv-, tf3-, tf5-, rp1-, rp2-tests groen, aanpassen met uitleg. Browser op localhost op 390 en 1920; NOOIT een adres met gebruikersnaam/wachtwoord openen; lukt een browserstap niet zonder toestemming: overslaan, melden, verder. Volle run 2× groen. Commit per punt, push `origin HEAD:bouw-c`. NOOIT naar main, NOOIT deploy.bat. Verslag onderaan `OVERLEG-c.md` per punt + GEVONDEN. Laatste bericht eindigt met exact: **VOLLEDIG KLAAR MET DE PROMPT. NU IS HET TERUG AAN DE HOOFDCHAT.** Bij de tijdslimiet: stop, commit, "Stand bij tijdslimiet", push, **TIJDSLIMIET BEREIKT: GESTOPT MET EEN TUSSENSTAND. NU IS HET TERUG AAN DE HOOFDCHAT.** Volgorde bij tijdnood: 1, 3, 2.
