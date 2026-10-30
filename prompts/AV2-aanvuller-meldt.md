# PROMPT AV2 — AANVULLER MELDT ZELF KAPOT OF WEG (met foto) + drie kleine restpunten
**Chat D (Sonnet) · map `D:\Sporty\sporty-d` · branch `bouw-d` · poort 3304 · verslag `OVERLEG-d.md` · TIJDSLIMIET 2 uur**

Lees eerst `CLAUDE.md`. Begin met `git fetch origin` en `git rebase origin/main` (ME1 staat op main). Controleer de exitcode van de rebase zelf vóór je pusht. Lees dan volledig: `public/aanvullen.*`, `routes/nakijken.js` (`/api/aanvullijst`, `ACTIES`, `_afronden`, regels en sessies), `public/nakijken.js`, `routes/tekorten-overzicht.js`, `routes/meldingen.js` (ME1), `lib/fotos.js`, `routes/instellingen.js`, `public/vandaag.js`.

Je raakt ALLEEN: `public/aanvullen.js/.css/.html`, `routes/nakijken.js`, `public/nakijken.js` (alleen het herkomstlabel), `lib/migraties.js` (één migratie onderaan, alleen als onvermijdelijk), `public/vandaag.js` en `routes/instellingen.js` (alleen Punt 2), `scripts/test-av2-melden.mjs`, `OVERLEG-d.md`.

## Punt 1 — Kapot of weg melden (BINDEND, Maxim 30/10: de aanvuller moet dit kunnen)
De aanvuller ontdekt in de stockage dat iets kapot of weg is, ook als kantoor daar niets over besliste. Een melding is geen beslissing: **kantoor beslist in Nakijken** (KERNREGEL), de voorraad verandert nog niet.
- In een geopende bak: knop **⚠ Kapot of weg melden** (≥ 44 px), ook bij een stuk een kleine knop. Overlay van volle hoogte: artikel (voorgevuld of kiezen uit de inhoud van de bak, of vrije naam), Kapot / Weg, aantal, foto, notitie. Foto verplicht bij Kapot, optioneel bij Weg.
- `POST /api/aanvullijst/melding {bak_id, kampmoment_id?, item_naam, soort: kapot|weg, aantal, foto_data?, notitie?}`: maakt een nakijk-regel (in de bestaande sessie van die bak, of een nieuwe sessie zonder KV) die in Nakijken verschijnt als te beslissen, met label "gemeld door <naam> · stockage". Kapot krijgt de acties van kapot, Weg die van tekort. Heropent de keuring van die bak als die al afgerond was. Gelogd, en via `routes/meldingen.js` een melding aan kantoor. Rollen: coördinator, chauffeur, kantoor.
- Op het aanvulscherm staat de melding met pil "gemeld, wacht op kantoor", niet afvinkbaar tot kantoor beslist.
- Dubbele melding (zelfde bak, artikel, soort, nog onbeslist): aantal optellen, geen tweede regel.
- Een bak die niet op de lijst staat: knop **+ Melding zonder bak** in de lijst (vrije naam, optioneel stockage).

## Punt 2 — Kleine restpunten
- `public/vandaag.js`: de rij "n meldingen" linkt naar `/meldingen`.
- `routes/instellingen.js`: verhuis-avond toont standaard 17:00 (nu 18:00 terwijl de taak 17:00 krijgt).
- Op een deels afgevinkte regel toont het aanvulscherm "n van m gedaan" (uit het log of een kolom via de migratie; kies de eenvoudigste die klopt).

## Bewijs
`scripts/test-av2-melden.mjs` (via `_testhulp`, eigen poort; DOM-bouw op 390 px): kapot zonder foto → 400, met foto → regel in Nakijken met juist label en acties, voorraad ongewijzigd; weg zonder foto lukt; afgeronde keuring heropent; dubbele melding telt op; kantoor beslist → regel volgt de gewone keten (aanvullen, bestellen, aanvaarden); kantoor krijgt één melding; KV-rol of niet ingelogd → geweigerd; "n van m gedaan" klopt; link en 17:00; knoppen ≥ 44 px; scrollWidth 390. Bestaande tests av1, vc1, tb2, me1, mob2 groen.
Browsercontrole: NOOIT een adres met gebruikersnaam/wachtwoord openen; test via scripts met de inlog in de request-header. Lukt een browserstap niet zonder toestemming: overslaan, melden, verder. Volle run 2× groen. Commit per punt, push `origin HEAD:bouw-d`. NOOIT naar main, NOOIT deploy.bat. Verslag onderaan `OVERLEG-d.md` per punt + GEVONDEN. Laatste bericht eindigt met exact: **VOLLEDIG KLAAR MET DE PROMPT. NU IS HET TERUG AAN DE HOOFDCHAT.** Bij de tijdslimiet: stop, commit, "Stand bij tijdslimiet", push, **TIJDSLIMIET BEREIKT: GESTOPT MET EEN TUSSENSTAND. NU IS HET TERUG AAN DE HOOFDCHAT.** Volgorde bij tijdnood: 1, 2.
