# PROMPT TF6 — T3: kantoorschermen, aanvuller, goedgekeurde aanvraag, bestelling deels binnen
**Chat D (Sonnet) · map `D:\Sporty\sporty-d` · branch `bouw-d` · poort 3304 · verslag `OVERLEG-d.md` · TIJDSLIMIET 3 uur**

Lees eerst `CLAUDE.md`. Ga naar je branch (`git checkout bouw-d`), dan `git fetch origin` en `git rebase origin/main`. Controleer de exitcode van de rebase zelf vóór je pusht. Lees dan volledig: `TESTVERSLAG-T3-kantoor.md`, `TESTVERSLAG-T3-coordinator.md`, `public/taken.*`, `routes/taken.js`, `public/vandaag.*` (kantoordeel), `public/nakijken.*`, `routes/nakijken.js`, `public/aanvullen.*`, `public/aanvullijst-print.html`, `routes/tekorten-overzicht.js`, `public/tekorten.*`, `public/periodes.*`, `public/personeel.*`, `public/sportrooster.*`, `public/kampmomenten.*`, de aanvraagroutes.

Je raakt de bestanden hierboven, plus `lib/migraties.js` (onderaan), `scripts/test-tf6-*.mjs`, `OVERLEG-d.md`. NIET `routes/vandaag.js` behalve de sortering/groepering van Punt 3, NIET `routes/kv.js`, `public/kv.*`, `public/rit.*`, `routes/transport.js`, `routes/ritplanning.js`, `lib/auth.js`, en in `public/nakijken.js` niet het blok Tellingen-historiek (chat C).

## Punt 1 — Besluiten Maxim
- **Goedgekeurde KV-aanvraag (T2-G7):** bij goedkeuren: voorraad genoeg → handeling op de aanvullijst; te weinig → Tekorten, en na binnen op de aanvullijst. In beide gevallen een transporttaak naar de locatie van de KV. Niet nodig meer: kantoor haalt de taak weg. Het artikel kiest kantoor bij goedkeuren (vrije tekst van de KV naar catalogus, of nieuw); zonder artikel: taak en duidelijke vraag aan kantoor. KV ziet de status. Alles gelogd.
- **Bestelling deels binnen (T2-G13):** "Bestelling binnen" vraagt het aantal, ingevuld met wat besteld is. Voorraad stijgt met dat aantal; de rest blijft open staan, zichtbaar als "3 van 5 binnen". Aanvullijst kan afvinken tot wat binnen is. Nooit dubbel.

## Punt 2 — Aanvuller en coördinator
- Open eigen melding houdt **Bak klaar** niet tegen: de melding blijft apart bij kantoor; bakteller "n/m" en lijst tellen hetzelfde (G3).
- Netfout bij afvinken: zichtbare melding "Geen verbinding, niet bewaard", knop terug, geen stille fout (G4).
- Tekorten en Aanvullen spreken elkaar niet tegen. Bij "wacht op levering" met voorraad: knop "Aanvullen uit voorraad" ook op het aanvulscherm, voor wie mag (G5). Een onbesliste gemelde regel krijgt bij afronden geen stille actie "bestellen": afronden waarschuwt en de regel blijft open.
- "Losse melding" is geen bak: aparte blok, telt niet in "n bakken", tellers op Vandaag en Aanvullen gelijk (G7; meld wat in `routes/vandaag.js` nodig is als het buiten de groepering valt).
- Printlijst 390: geen scroll, enkelvoud, juiste terugknop per rol (G8). Deelaantal klopt na afvinken (G13). Toasts niet over de knoppen (G12). `PUT /api/transport-taken/:id` met enkel `wie` geeft geen 500: meld dit aan de hoofdchat als het in `routes/transport.js` zit.
- "Bestelling binnen"-melding gaat niet naar wie het zelf deed (G11; als dit in `ctx.melding` moet: meld).

## Punt 3 — Kantoor
- **N1:** Taken toont meteen wat gegenereerd is, ook leveringen vóór de periode, met duidelijke periodefilter en knop "Alles". Toast linkt ernaar; Ritplanning opent op de eerste week met open taken.
- **N2:** Vandaag kantoor: bovenaan wat vandaag moet (te keuren, aanvragen, meldingen, ritten vandaag), daaronder apart en ingeklapt "Later deze periode". "Nakijken" op Vandaag krijgt een andere naam dan het scherm Nakijken.
- **N3:** tekort én kapot op één regel: alle acties van beide, met aantal per deel. Test op echte telling.
- **N4:** einde vóór start geweigerd. **N5:** Meldingen in de desktopbalk met teller (als dat `nav.js` vraagt, enkel die ene regel). **N7:** uitnodigen in het persoon-detail. **N9:** "Bak openen" opent echt de bak (`/bakken?bak=`), test met een themabak en een vaste bak. **N10:** tekst Sportrooster en `?zicht=seizoen`. **N13:** historiek filtert ook op periode. **N14:** zoekveld in de themakeuze; gewone thema's vóór themadag. **N15:** na koppelen blijft de open-lijst staan. **N16:** tweede kampmoment zelfde locatie en week: geeft duidelijke uitkomst. **N12, N18:** "1 rit", "Hele periode", "wk 0", afgesneden chip, 18 px-kiezer.

## Bewijs
`scripts/test-tf6-keten.mjs` (via `_testhulp`, eigen poort): aanvraag met en zonder voorraad tot op de locatie; 3 van 5 binnen tot volledig met voorraadcijfers; bak klaar met open melding; netfout zichtbaar (DOM); onbesliste melding niet stil besteld; N1, N3, N4 op echte data; print 390. Bestaande vc1, tb2, av1, av2, tf4, ko1, pl2 groen. Browser op localhost op 1920 en 390; NOOIT een adres met gebruikersnaam/wachtwoord openen; lukt een browserstap niet zonder toestemming: overslaan, melden, verder. Volle run 2× groen. Commit per punt, push `origin HEAD:bouw-d`. NOOIT naar main, NOOIT deploy.bat. Verslag onderaan `OVERLEG-d.md` per punt + GEVONDEN. Laatste bericht eindigt met exact: **VOLLEDIG KLAAR MET DE PROMPT. NU IS HET TERUG AAN DE HOOFDCHAT.** Bij de tijdslimiet: stop, commit, "Stand bij tijdslimiet", push, **TIJDSLIMIET BEREIKT: GESTOPT MET EEN TUSSENSTAND. NU IS HET TERUG AAN DE HOOFDCHAT.** Volgorde bij tijdnood: 1, 2, 3.
