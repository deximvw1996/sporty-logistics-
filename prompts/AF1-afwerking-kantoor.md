# PROMPT AF1 — AFWERKING KANTOOR: 502-herpoging op alle kantoorpagina's, knop "Bestelling binnen", rest van TF2
**Chat D (Sonnet) · map `D:\Sporty\sporty-d` · branch `bouw-d` · poort 3304 · verslag `OVERLEG-d.md` · TIJDSLIMIET 1,5 uur**

Lees eerst `CLAUDE.md`. Begin met `git fetch origin` en `git rebase origin/main` (TF2 staat op main; 68515d7). Lees dan: `public/rit.js` en `public/kv.js` (de `haal()`-helper uit TF2 G3), `public/nav.js` (gedeeld door alle kantoorpagina's), de `api()`-functie in `public/vandaag.js`, `ritplanning.js`, `taken.js`, `nakijken.js`, `kampmomenten.js`, `bakken.js`, `personeel.js`, `logboek.js`, `locaties.js`; `routes/nakijken.js` (`POST /api/nakijken/regel/:id/binnen`, aanvullijst `kan_afvinken`), `design/mockup-voorraad-nakijken.html` (Tekorten-gedeelte).

Je raakt ALLEEN: `public/nav.js` (één gedeelde `window.sportyApi` met herpoging), de tien kantoorpagina's hierboven (alleen hun `api()` laten doorverwijzen naar de gedeelde; NIET `ritplanning.js` als chat C daar tegelijk aan werkt: die slaat je over en meld je), `public/nakijken.js` (Punt 2), `routes/nakijken.js`, `routes/taken-overzicht.js`/`routes/vandaag.js` (alleen Punt 3), `scripts/test-af1-afwerking.mjs`, `OVERLEG-d.md`. Beeld blijft exacte kopie van de ontwerpen.

## Punt 1 — Herpoging bij 502/503/504 op kantoor (TF2 G3 was alleen rit/kv)
In `nav.js` één functie `sportyApi(methode,url,body)` met hetzelfde gedrag als `haal()` in `rit.js`: bij 502/503/504 na 2 s en 5 s opnieuw (max 2×), één toast "Even geduld, de app wordt bijgewerkt…" (de toast van de pagina als die bestaat, anders een eigen minimale), pas daarna de fout; GET's ook bij netwerkfout herhalen, POST/PUT/DELETE alleen bij 502/503/504. Elke kantoorpagina laat haar `api()` die functie aanroepen (zelfde teruggave `{status,ok,json}`), zodat verder niets verandert.

## Punt 2 — Knop "Bestelling binnen" (TF2 G15 had alleen de API)
In `/nakijken` › Tekorten: per regel met `tekort_status` bestellen/besteld een knop **Bestelling binnen** (≥ 36 px) die `POST /api/nakijken/regel/:id/binnen` aanroept en de lijst herlaadt; daarna toont de regel "binnen, klaar om te plaatsen" en is de handeling afvinkbaar in de aanvullijst. Plaats de knop waar het ontwerp de regel-acties heeft (geen nieuw vak). Als `/nakijken` geen Tekorten-lijst heeft: bouw ze niet; de oude `/#tekorten` in `index.html` is NIET jouw gebied → GEVONDEN, en zet de knop dan in het Nakijken-detail bij de tekort-regel.

## Punt 3 — Kleine rest uit TF2 GEVONDEN
Bestaande ritregels bewaren `item_naam` met interne notitie; de strip (`zonderHaakjes`) gebeurt bij uitlezen. Controleer `/api/taken-overzicht` en `/api/vandaag`: teksten die naar chauffeur/KV gaan (rit-link, KV) gestript; kantoor zelf mag de notitie wél zien, daar niets strippen. Alleen aanpassen waar het nu fout toont, en meld het.

## Bewijs
- `scripts/test-af1-afwerking.mjs`: nep-fetch die 503, 503, 200 geeft → één resultaat, twee herpogingen, toast-tekst; POST met netwerkfout → geen herpoging; DOM-bouw van Nakijken: knop aanwezig bij status besteld, afwezig bij binnen; `kan_afvinken` na binnen.
- Volle run 2× groen. Commit per punt, push `origin HEAD:bouw-d`. NOOIT naar main, NOOIT deploy.bat. Verslag onderaan `OVERLEG-d.md`. Laatste bericht eindigt met exact: **VOLLEDIG KLAAR MET DE PROMPT. NU IS HET TERUG AAN DE HOOFDCHAT.** Bij de tijdslimiet: stop, commit, "Stand bij tijdslimiet", push, **TIJDSLIMIET BEREIKT: GESTOPT MET EEN TUSSENSTAND. NU IS HET TERUG AAN DE HOOFDCHAT.** Volgorde bij tijdnood: 1, 2, 3.
