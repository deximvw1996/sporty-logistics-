# PROMPT TF4 — BLOKKERS T2: Nakijken desktop, vastgelopen bak, voorraad terug naar pool, printlijst + hinderlijke fouten
**Chat D (Sonnet) · map `D:\Sporty\sporty-d` · branch `bouw-d` · poort 3304 · verslag `OVERLEG-d.md` · TIJDSLIMIET 3 uur**

Lees eerst `CLAUDE.md`. Begin met `git fetch origin` en `git rebase origin/main`. Controleer de exitcode van de rebase zelf vóór je pusht. Lees dan volledig: `TESTVERSLAG-T2.md`, `public/nakijken.*`, `routes/nakijken.js`, `routes/tekorten-overzicht.js`, `public/tekorten.*`, `public/aanvullen.*`, `public/aanvullijst-print.html`, `public/app-schil.css`, `public/ritplanning.*`, `public/rooster.*`, `routes/rooster.js`, `public/kampmomenten.*`, `routes/vandaag.js` (alleen lezen).

Je raakt ALLEEN: `public/nakijken.*`, `routes/nakijken.js`, `routes/tekorten-overzicht.js`, `public/tekorten.*`, `public/aanvullen.*`, `public/aanvullijst-print.html`, `public/app-schil.css`, `public/ritplanning.*`, `public/rooster.*`, `routes/rooster.js`, `public/rit.*`, `public/kampmomenten.css` en de themakeuze in `public/kampmomenten.js`, `scripts/test-tf4-*.mjs`, `OVERLEG-d.md`. NIET `lib/auth.js`, `server.js`, `public/nav.js`, `public/vandaag.js`, `routes/ritplanning.js`, `routes/transport.js`, `routes/meldingen.js` (chat C). De links naar `/#...` in je eigen bestanden vervang je wel.

## Punt 1 — Blokkers
- **G2 Nakijken desktop:** elke rij is 900 px hoog omdat `.tel` uit `app-schil.css` botst met `.kopr.tel`/`.r.tel` van `nakijken.css`. Los het op aan de bron: de schilregels gelden alleen binnen de gsm-weergave. Controleer op 1920×900 Nakijken en elke pagina met dezelfde klassenaam, en dat de gsm-schermen niet veranderen.
- **G4 vastgelopen bak:** "Bestelling binnen" via de tak `best.los||best.extra` in `routes/tekorten-overzicht.js` zet de nakijk-regel niet op binnen. Daardoor blijft de regel op "wacht op levering" en kan Bak klaar nooit. Fix elke tak, en zorg dat de voorraad niet dubbel telt. Test: tekort met voorraad → Bestellen → afronden → binnen → afvinkbaar → Bak klaar.
- **G11 terug naar pool:** afvinken van `naar_pool` moet de voorraad verhogen en terugzetten moet het ongedaan maken, gespiegeld aan `uit_pool`, nooit dubbel. Controleer eerst of er een aparte poolvoorraad bestaat; zo ja, meld dat en boek daar.
- **G16 printlijst:** `/aanvullijst-print` toont "Geen verbinding". De pagina laadt alleen `nakijken.js`; de aanroep vertrekt niet. Oorzaak zoeken, fixen, ook met inlog.
- **G17:** `$('s-tekorten')` is null op Nakijken, en daardoor blijft "Periode: …" staan.

## Punt 2 — Zichtbaarheid van meldingen
- **G14:** een heropende keuring en een losse melding moeten zichtbaar zijn voor kantoor. Lees waarom Vandaag ze niet telt (`routes/vandaag.js:170`, niet jouw bestand): meld in het verslag wat de hoofdchat daar moet wijzigen. In Nakijken zelf: chip "Gemeld" met teller, en die bakken bovenaan.
- **G22:** een opgetelde melding werkt de bestaande kantoormelding bij naar het nieuwe aantal (via de bestaande `ctx.melding`-route; ontbreekt die mogelijkheid, in het verslag).
- **G26:** losse melding toont "stockage · gemeld vandaag", geen lege week, en telt niet als handeling.
- **G24:** in de meldoverlay staat de **volledige** inhoud van de bak, en ook afgevinkte regels en een bak zonder handelingen zijn meldbaar.
- **G25:** "herstellen" krijgt het label "herstellen", niet "zelf tellen".

## Punt 3 — Planning: melden, niet verbieden (KERNREGEL)
- **G8:** de themakeuze toont ook de thema's die al elders staan, onderaan met "staat al in <locatie>". Kiezen mag, en geeft het conflict.
- **G9:** in het rooster-detail staat een Wissel bij elk thema, niet alleen bij een melding (controleer `mockup-planning-v3`; wijkt het af: melden).
- **G10:** gesloten dag die in een kampmoment valt geeft een melding met teller in het rooster (nooit een verbod). `/rooster` toont ook "herhaald" zichtbaar; bewijs op het scherm, niet alleen de API.

## Punt 4 — Ritplanning en kleine fouten
- **G12:** bestuurder wisselen in het ritdetail op desktop (zelfde keuzelijst als gsm). **G30:** op gsm heet de knop ook "Klaarzetten".
- **G19:** rit-link blijft staan met kopieerknop. **G20:** de rit-kop telt stuks, niet regels ("0 van 50 stuks"). **G21:** geen dubbele rij voor dezelfde naam. **G32:** weekendritten bereikbaar op gsm als er een weekendrit is (controleren met data).
- **T1-resten:** stoptijd volgt het vertrek na verschuiven (T1-G6); capaciteitswaarschuwing weg op een gedane rit (T1-G12); tellers van lijst en kop in Nakijken gelijk (T1-G13).
- **G29:** enkelvoud/meervoud ("1 rit", "1 set"), "Hele zomer" → "Hele periode", "Keuring afgerond · n bestelling(en)" telt alleen de nieuwe, "Regel k van n" telt de open regels.

## Bewijs en afsluiting
`scripts/test-tf4-keten.mjs` (via `_testhulp`, eigen poort): G4 en G11 met voorraadcijfers per stap, terugzetten, geen dubbele telling; printlijst toont data; meldoverlay volle bak; themakeuze en conflict; gesloten-dag-melding; tellers gelijk. DOM-meting Nakijken op 1920: rijhoogte < 80 px, `scrollHeight` redelijk, gsm ongewijzigd. Live bekijken op 1920 en 390 met schermafdruk per punt 1-item. Bestaande tests vc1, tb2, av1, av2, mob2, pl2, rp1, rp2 groen. Browsercontrole op localhost; NOOIT een adres met gebruikersnaam/wachtwoord openen; lukt een browserstap niet zonder toestemming: overslaan, melden, verder. Volle run 2× groen. Commit per punt, push `origin HEAD:bouw-d`. NOOIT naar main, NOOIT deploy.bat. Verslag onderaan `OVERLEG-d.md` per punt + GEVONDEN. Laatste bericht eindigt met exact: **VOLLEDIG KLAAR MET DE PROMPT. NU IS HET TERUG AAN DE HOOFDCHAT.** Bij de tijdslimiet: stop, commit, "Stand bij tijdslimiet", push, **TIJDSLIMIET BEREIKT: GESTOPT MET EEN TUSSENSTAND. NU IS HET TERUG AAN DE HOOFDCHAT.** Volgorde bij tijdnood: 1, 2, 3, 4.
