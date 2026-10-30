# PROMPT AV1 — AANVULLIJST OP GSM (exacte kopie van design/mockup-aanvullen-gsm.html, onderdeel van de gsm-app)
**Chat D (Sonnet) · map `D:\Sporty\sporty-d` · branch `bouw-d` · poort 3304 · verslag `OVERLEG-d.md` · TIJDSLIMIET 2,5 uur**

Lees eerst `CLAUDE.md` (MOBIEL-REGEL). Begin met `git fetch origin` en `git rebase origin/main`. Controleer de exitcode van de rebase zelf vóór je pusht. Lees dan volledig:
1. `design/mockup-aanvullen-gsm.html` — goedgekeurd door Maxim 29/10. Gsm-deel bindend.
2. `public/aanvullijst-print.html`, `routes/nakijken.js` (`/api/aanvullijst`, `/api/aanvullijst/:id/aangevuld`, `kan_afvinken`, `binnen`), `routes/tekorten-overzicht.js` (TB2: voorraad daalt pas bij afvinken), `lib/fotos.js` (foto-upload), `public/nav.js`, `public/app-schil.css`, `public/nakijken.js` (MOB2, jouw gsm-opbouw).

Je raakt ALLEEN: `public/aanvullen.html/.js/.css` (nieuw), één route voor `/aanvullen` in `routes/nakijken.js`, `routes/nakijken.js` (alleen wat dit scherm nodig heeft), `public/nav.js` (alleen: tab Stockage en de PAGINA-tabel wijzen naar `/aanvullen`; Voorraad-subbalk Aanvullijst → `/aanvullen`), `public/vandaag.js` (alleen: de NU-kaart "Aanvullen" wijst naar `/aanvullen`), `scripts/test-av1-aanvullen.mjs`, `OVERLEG-d.md`. NIET `routes/vandaag.js`, `lib/auth.js`, `routes/beheer.js`, `lib/nachtbackup.js`, `public/ritplanning.*`, `routes/transport.js` (chat C).

## Hoe de werking in elkaar zit (BINDEND)
De aanvuller staat in de stockage (Rozenweg) met alleen een gsm. Kantoor heeft in Nakijken beslist; de lijst volgt daaruit. Afvinken is de echte handeling: pas dan daalt de voorraad. Een bestelling die nog niet binnen is, kan niet afgevinkt worden (toon "wacht op levering", nooit een stille fout). Rollen: coördinator, chauffeur en kantoor mogen dit scherm gebruiken.

## Punt 1 — Scherm `/aanvullen`
Exacte kopie: lijst per bak (code, naam, locatie, "n van m klaar", volgorde: wat vandaag vertrekt bovenaan). Bak openen = per stuk afvinken met grote knop, aantal aanpasbaar (minder gevonden dan nodig → rest blijft open, gelogd). Kapot of weg: afschrijven met verplichte foto (camera van de gsm via `<input capture>`). **Bak klaar** als alles af is, terug naar de lijst. Tabbalk zichtbaar, ‹ terug in de bak. Bovenaan rechts "🖨 Printlijst" → `/aanvullijst-print`, en die pagina krijgt geen wijziging.

## Punt 2 — Desktop
Boven 768 px: dezelfde pagina als eenvoudige gecentreerde kolom van 480 px met de bovenbalk van `nav.js`; kantoor kan er ook afvinken.

## Bewijs
`scripts/test-av1-aanvullen.mjs` (via `_testhulp`, eigen poort; DOM-bouw op 390 px): lijst volgt uit Nakijken; afvinken verlaagt de voorraad één keer (tweede keer niet); bestelling niet binnen → knop uit met uitleg en API 409; minder gevonden → rest open; afschrijven zonder foto geweigerd, met foto bewaard; Bak klaar; tab Stockage wijst naar `/aanvullen`; knoppen ≥ 44 px; scrollWidth 390. Bestaande tests vc1, tb2, mob1, mob2 groen.
Browsercontrole: NOOIT een adres met gebruikersnaam/wachtwoord openen; test via scripts met de inlog in de request-header. Lukt een browserstap niet zonder toestemming: overslaan, melden, verder. Volle run 2× groen. Commit per punt, push `origin HEAD:bouw-d`. NOOIT naar main, NOOIT deploy.bat. Verslag onderaan `OVERLEG-d.md` per punt + GEVONDEN. Laatste bericht eindigt met exact: **VOLLEDIG KLAAR MET DE PROMPT. NU IS HET TERUG AAN DE HOOFDCHAT.** Bij de tijdslimiet: stop, commit, "Stand bij tijdslimiet", push, **TIJDSLIMIET BEREIKT: GESTOPT MET EEN TUSSENSTAND. NU IS HET TERUG AAN DE HOOFDCHAT.** Volgorde bij tijdnood: 1, 2.
