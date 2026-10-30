# PROMPT ME1 — MELDINGEN op gsm (echte bronnen) + restpunten: rit zonder personeel, back-ups apart, standaard tijden, herstelkopie
**Chat C (Opus) · map `D:\Sporty\sporty-c` · branch `bouw-c` · poort 3303 · verslag `OVERLEG-c.md` · TIJDSLIMIET 3 uur**

Lees eerst `CLAUDE.md`. Begin met `git fetch origin` en `git rebase origin/main`. Controleer de exitcode van de rebase zelf vóór je pusht. Lees dan volledig: `design/MOBIEL-DEFINITIEF.html` (voorbeelden van meldingen op de telefoons), `routes/vandaag.js` en `public/vandaag.js` (MOB1: `meldingen`, `tellers`), `public/meer.js`, `public/nav.js` (tab Meldingen), `routes/transport.js` (chauffeursmeldingen, `transport_ritten`), `routes/kv.js`, `routes/taken.js`, `lib/db.js` (`backupDb`), `lib/nachtbackup.js`, `routes/beheer.js` (`/api/herstel-db`), `routes/instellingen.js`, `routes/sportrooster.js` (verhuistaak), `routes/ritplanning.js`.

Je raakt ALLEEN: `routes/meldingen.js` en `public/meldingen.html/.js/.css` (nieuw; naam in de lijst van `server.js`), `routes/vandaag.js`, `public/nav.js` (alleen de tab Meldingen en zijn teller), `lib/migraties.js` (één migratie onderaan), `lib/db.js`, `lib/nachtbackup.js`, `routes/beheer.js`, `routes/sportrooster.js` en `routes/ritplanning.js` (alleen Punt 3), `routes/kv.js` en `routes/transport.js` (alleen: een melding schrijven bij de gebeurtenissen van Punt 1), `scripts/test-me1-meldingen.mjs`, `OVERLEG-c.md`. NIET `public/aanvullen.*`, `public/vandaag.js`, en de stukken van `routes/nakijken.js` voor `/aanvullen` (chat D).

## Punt 1 — Meldingen met echte bronnen
De voorbeelden uit de mockup ("Kantoor: conciërge gebeld", "KV Zoë: tape goedgekeurd") hebben nu geen bron.
- Migratie: tabel `meldingen (id, voor_rol, voor_persoon_id, van_naam, tekst, link, gelezen_op, created_at)` (`voor_persoon_id` leeg = iedereen met die rol).
- Automatisch aanmaken, zonder dubbels: chauffeur meldt iets → kantoor; KV-telling verstuurd of KV-aanvraag → kantoor; aanvraag beslist → de KV niet (geen account), wel de coördinatoren; rit gewijzigd die al klaarstond → de bestuurder; verhuistaak toegewezen → die persoon; bestelling binnen → coördinatoren.
- Kantoor kan zelf een bericht sturen: **+ Bericht** (aan persoon of rol, tekst).
- `GET /api/meldingen` (eigen meldingen, nieuwste eerst), `POST …/:id/gelezen`, `POST …/alles-gelezen`, `POST /api/meldingen` (alleen kantoor). Alles gelogd.
- Pagina `/meldingen` in de stijl van MOBIEL-DEFINITIEF: lijst per dag, ongelezen vet met blauw randje, tik = gelezen en naar de `link`. Tabteller = aantal ongelezen. `/api/vandaag?mijn=1` geeft de ongelezen meldingen terug in het bestaande veld `meldingen`. Boven 768 px: eenvoudige kolom van 640 px met bovenbalk.

## Punt 2 — Rit zonder gekoppeld personeelslid
Een rit met alleen een chauffeursnaam verschijnt niet in iemands Vandaag. Koppel bij `mijn=1` ook op naam (hoofdletterongevoelig, exact, actief personeel), en toon op de ritplanning een ⚠-waarschuwing "bestuurder niet gekoppeld" als de naam niet bij één persoon past. Niets automatisch overschrijven.

## Punt 3 — Restpunten Beheer
- Handmatige back-ups tellen niet meer mee in de 14 automatische: eigen naampatroon (`sporty-hand-*`), maximaal 30 eigen, en `backupDb` ruimt alleen automatische op. Bestaande bestanden blijven.
- De oude `voor-herstel-*.db` wordt een gewone back-up in de lijst ("voor terugzetten"), geen tweede onzichtbare kopie.
- Standaard tijden: `tijd_vertrek_ritten` wordt de begintijd bij Nieuwe rit; `tijd_verhuis_avond` wordt het uur van de verhuistaak van het sportrooster (nu vast 17:00). Zonder waarde blijft het huidige gedrag.

## Bewijs
`scripts/test-me1-meldingen.mjs` (via `_testhulp`, eigen poort): elke gebeurtenis maakt precies één melding voor de juiste ontvanger; gelezen haalt ze uit de teller; niet-kantoor kan geen bericht sturen (403) en ziet andermans meldingen niet; rit op naam verschijnt in Vandaag, onbekende naam geeft ⚠; 20 handmatige back-ups duwen geen automatische weg; herstel maakt één zichtbare back-up; beide tijden werken met en zonder waarde; `GET /meldingen` 200; gsm: knoppen ≥ 44 px, scrollWidth 390. Bestaande tests mob1, bh2, pl3, rp1 groen.
Browsercontrole: NOOIT een adres met gebruikersnaam/wachtwoord openen; test via scripts met de inlog in de request-header. Lukt een browserstap niet zonder toestemming: overslaan, melden, verder. Volle run 2× groen. Commit per punt, push `origin HEAD:bouw-c`. NOOIT naar main, NOOIT deploy.bat. Verslag onderaan `OVERLEG-c.md` per punt + GEVONDEN. Laatste bericht eindigt met exact: **VOLLEDIG KLAAR MET DE PROMPT. NU IS HET TERUG AAN DE HOOFDCHAT.** Bij de tijdslimiet: stop, commit, "Stand bij tijdslimiet", push, **TIJDSLIMIET BEREIKT: GESTOPT MET EEN TUSSENSTAND. NU IS HET TERUG AAN DE HOOFDCHAT.** Volgorde bij tijdnood: 1, 2, 3.
