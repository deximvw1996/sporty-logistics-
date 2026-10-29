# PROMPT NAV1 — DE BOVENBALK EN SUBBALKEN WIJZEN OVERAL NAAR DE NIEUWE SCHERMEN; de oude tabbladen alleen nog waar er nog geen nieuw scherm is
**Chat D (Sonnet) · map `D:\Sporty\sporty-d` · branch `bouw-d` · poort 3304 · verslag `OVERLEG-d.md` · TIJDSLIMIET 1,5 uur**

Lees eerst `CLAUDE.md`. Begin met `git fetch origin` en `git rebase origin/main` (BH1 staat op main). Lees dan `public/patroon.css`, en de bovenbalk + subbalk in `public/vandaag.js`, `public/ritplanning.js`, `public/taken.js`, `public/nakijken.js`, `public/kampmomenten.js`, `public/bakken.js`, `public/personeel.js`, `public/logboek.js`, en in `index.html` de functie die `#tab`-links opent (KO1) en de knop "🏠 Vandaag".

Je raakt ALLEEN: een nieuw gedeeld bestand `public/nav.js` (één functie die de bovenbalk en de subbalk van een onderdeel tekent uit één mapping-tabel), de acht pagina's hierboven (alleen om `nav.js` te gebruiken i.p.v. hun eigen bovenbalk/subbalk-HTML), `index.html` (alleen: elke oude tab die een nieuw scherm heeft, toont bovenaan een strook "Dit scherm is vervangen door … → openen" en de knop Vandaag), `scripts/test-nav1.mjs`, `OVERLEG-d.md`.

## Waarom
Maxim (30/10): "enkel Vandaag is de nieuwe look, al de rest is nog de oude app". De nieuwe schermen bestaan, maar de bovenbalk van Vandaag linkt nog naar de oude tabbladen, en de nieuwe schermen linken onderling niet consequent.

## De mapping (bindend)
Bovenbalk, zeven onderdelen: Vandaag → `/vandaag` · Planning → `/kampmomenten` · Transport → `/ritplanning` · Materiaal → `/bakken` · Locaties → `/#locaties` (oude tab; LO1 bouwt het nieuwe scherm later: dan wordt het `/locaties`) · Voorraad & controles → `/nakijken` · Beheer → `/personeel`. Tellers op Vandaag (beslissen), Transport (zonder rit), Voorraad (te keuren) uit `/api/vandaag` (al aanwezig) of de bestaande tellers-API's; periode-kiezer en ingelogde naam rechts, zoals nu.
Subbalken: Planning: Kampmomenten `/kampmomenten` · Rooster `/#kampplanner` · Periodes `/#periodes` (of de oude tab waar periodes staan) · Thema's per week `/#themas`. Transport: Ritten `/#transport` (oude tab) · Ritplanning `/ritplanning` · Taken `/taken` · Voertuigen `/#voertuigen` (of waar de voertuigtypes staan). Materiaal: Thema's `/#themas` · Bakken `/bakken` · Pool `/#pool` · Catalogus `/#catalogus`. Voorraad: Nakijken `/nakijken` · Tekorten `/#tekorten` · Bestellingen `/#tekorten` · Voorraad `/#voorraad`. Beheer: Personeel `/personeel` · Logboek `/logboek` · Export & back-up `/#beheer` · Instellingen `/#beheer`. Zoek de exacte oude tab-namen op in `index.html` (`SECS`) en gebruik die; bestaat een tab niet, meld het in GEVONDEN en laat de link weg.
De actieve bovenbalk-knop en subbalk-knop zijn gemarkeerd op basis van de URL. Het beeld van de nieuwe schermen verandert verder NIET (computed-style-hash of DOM-dump vóór/na per pagina).

## Bewijs
- `scripts/test-nav1.mjs`: elke nieuwe pagina → 200 en bevat de zeven bovenbalk-links met de juiste href's en haar eigen subbalk; `index.html` toont bij de oude tabs transport/planning/bakken/personeel de vervangstrook; `/#locaties` blijft bereikbaar; niet-kantoor krijgt op `/vandaag` 403 zoals nu.
- Volle run 2× groen. Commit per punt, push `origin HEAD:bouw-d`. NOOIT naar main. Verslag onderaan `OVERLEG-d.md` met de mapping-tabel. Laatste bericht eindigt met exact: **VOLLEDIG KLAAR MET DE PROMPT. NU IS HET TERUG AAN DE HOOFDCHAT.** Bij de tijdslimiet: stop, commit, "Stand bij tijdslimiet", push, **TIJDSLIMIET BEREIKT: GESTOPT MET EEN TUSSENSTAND. NU IS HET TERUG AAN DE HOOFDCHAT.**
