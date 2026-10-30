# PROMPT MOB1 — GSM-APP: SCHIL (tabbalk per rol), INLOGGEN en VANDAAG (exacte kopie van design/MOBIEL-DEFINITIEF.html en het scherm Inloggen van design/mockup-gsm-1.html)
**Chat C (Opus) · map `D:\Sporty\sporty-c` · branch `bouw-c` · poort 3303 · verslag `OVERLEG-c.md` · TIJDSLIMIET 3,5 uur**

Lees eerst `CLAUDE.md` (MOBIEL-REGEL). Begin met `git fetch origin` en `git rebase origin/main`. Controleer de exitcode van de rebase zelf vóór je pusht. Lees dan volledig:
1. `design/MOBIEL-DEFINITIEF.html` — goedgekeurd 29/10: vier telefoons (chauffeur, coördinator, kantoor, Meer), uitvoering A2 (grote NU-kaart). Bindend.
2. `design/mockup-gsm-1.html`, telefoon Inloggen — goedgekeurd 30/10. Bindend. De tabbalk op de andere telefoons is dezelfde als in de schil.
3. `design/DESIGN-BRIEF.md`, Scherm 6.
4. Bestaand: `lib/auth.js` (`/api/login`, `/api/personeel-lijst-login`, `/api/login-status`, sessies), `public/nav.js` (BOVEN/SUB/PAGINA, `teken()`, `window.sportyApi`), `routes/vandaag.js` + `public/vandaag.*` (`/api/vandaag?mijn=1`), `public/rit.*`, `routes/taken.js`, `public/aanvullijst-print.html` en `design/mockup-aanvullen-gsm.html` (punt 76: bestaat de gsm-aanvullijst al? zo niet: GEVONDEN, tab Stockage linkt dan naar de lijst die er is).

Je raakt ALLEEN: `public/nav.js`, `public/app-schil.css` (nieuw), `public/login.html/.js/.css` (nieuw), `public/vandaag.js/.css/.html` (alleen de gsm-weergave), `routes/vandaag.js` (alleen wat de NU-kaart nodig heeft), `public/meer.html/.js` (nieuw), één route per nieuwe pagina, `scripts/test-mob1-schil.mjs`, `OVERLEG-c.md`. NIET `public/ritplanning.*`, `public/nakijken.*`, `public/rooster.*`, `routes/ritplanning.js`, `routes/nakijken.js`, `routes/rooster.js` (chat D).

## Hoe de werking in elkaar zit (BINDEND)
- Personeel logt op de gsm in met naam + pincode en blijft ingelogd op dat toestel. Losse token-links blijven alleen voor KV en monitor; `/rit/<token>` en `/kv/<token>` blijven werken en krijgen geen tabbalk.
- Geen aparte app: **dezelfde URL's**. Onder 768 px breedte vervangt `nav.js` de bovenbalk en subbalk door de tabbalk onderaan; op desktop verandert niets.
- Tabbalk per rol: chauffeur/coördinator: Vandaag · Ritten · Stockage · Meldingen · Meer. Kantoor: Vandaag · Transport · Voorraad · Meldingen · Meer. Onder Meer: Planning, Materiaal, Locaties, Beheer, periode, profiel, uitloggen. Tellers als rode bolletjes op de tabs (zelfde bron als de badges nu).
- Alleen wat de rol mag, staat in zijn tabs en onder Meer; de bestaande 403's blijven de echte grens.

## Punt 1 — Schil
`nav.js`: onder 768 px tabbalk (52 px hoog, knoppen ≥ 44 px), inhoud krijgt onderaan ruimte; subbalk wordt bovenaan een horizontaal scrollbare rij als een onderdeel subpagina's heeft (Transport: Ritplanning · Taken · Voertuigen, enz.). Actieve tab volgt de PAGINA-tabel. Pagina `/meer`. De "nav-balk te breed op gsm" (RP2-restpunt) verdwijnt hiermee. Kantoorpagina's die de schil nog niet goed volgen: meet ze allemaal op 390 px en meld ze in een tabel.

## Punt 2 — Inloggen
`/login` = exacte kopie: naam kiezen uit `/api/personeel-lijst-login` (zoekbaar, laatste gebruiker bovenaan op dit toestel), pincode op een eigen toetsenblok met 4 stippen, automatisch verzenden bij het 4e cijfer, foutmelding met schudden, bestaande blokkering na mislukkingen. Sessie blijft bewaard (lees hoe `lib/auth.js` dat nu doet; niet verlengen buiten wat er bestaat zonder dit te melden). Niet ingelogd op een personeelspagina op gsm → `/login?terug=`. Desktop-login blijft zoals nu, tenzij die er niet is: dan GEVONDEN.

## Punt 3 — Vandaag op gsm
Exacte kopie van de drie Vandaag-telefoons: donkerblauwe kop, grote NU-kaart (huidige taak met Start/verder), dan de volgende taken op volgorde met tijd en plaats, meldingen. Chauffeur: ritten; coördinator: ritten + aanvullen + tellen; kantoor: wat aandacht vraagt met doorklik. Data uit `/api/vandaag?mijn=1`; breid uit waar nodig. De knop op de NU-kaart opent de bestaande rit-weergave.

## Bewijs
`scripts/test-mob1-schil.mjs` (via `_testhulp`, eigen poort): tabbalk per rol juist (drie rollen); desktopbreedte toont de oude bovenbalk (computed-style ongewijzigd); login goed/fout/blokkering; niet ingelogd → `/login?terug=`; `/rit/<token>` en `/kv/<token>` zonder tabbalk; NU-kaart kiest de juiste taak voor elke rol; alle knoppen ≥ 44 px, geen horizontale scroll op 390 px op Vandaag, Meer, Login.
Browsercontrole: NOOIT een adres met gebruikersnaam/wachtwoord openen; test via scripts met de inlog in de request-header. Lukt een browserstap niet zonder toestemming: overslaan, melden, verder. Volle run 2× groen. Commit per punt, push `origin HEAD:bouw-c`. NOOIT naar main, NOOIT deploy.bat. Verslag onderaan `OVERLEG-c.md` per punt + GEVONDEN. Laatste bericht eindigt met exact: **VOLLEDIG KLAAR MET DE PROMPT. NU IS HET TERUG AAN DE HOOFDCHAT.** Bij de tijdslimiet: stop, commit, "Stand bij tijdslimiet", push, **TIJDSLIMIET BEREIKT: GESTOPT MET EEN TUSSENSTAND. NU IS HET TERUG AAN DE HOOFDCHAT.** Volgorde bij tijdnood: 1, 2, 3.
