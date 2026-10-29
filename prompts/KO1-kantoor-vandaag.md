# PROMPT KO1 — KANTOOR "VANDAAG" + NIEUWE HOOFDNAVIGATIE (exacte kopie van het goedgekeurde ontwerp)
**Chat C (Opus) · map `D:\Sporty\sporty-c` · branch `bouw-c` · poort 3303 · verslag `OVERLEG-c.md` · TIJDSLIMIET 2,5 uur**

Lees eerst `CLAUDE.md` in je map. Begin met `git fetch origin` en `git rebase origin/main`. Lees dan volledig:
1. `design/KANTOOR-DEFINITIEF.html` — het goedgekeurde ontwerp (Maxim 29/10). Dit is de wet: exact nabouwen (opbouw, teksten, kleuren, groottes, knoppen, de schakelaar Groot/Compact, de drie apart scrollende kolommen, de rechterstrook met twee apart scrollende vakken). Geen eigen versie.
2. `design/DESIGN-BRIEF.md`, "Scherm 2" (7 bindende punten, keuze Maxim, dashboardregel, definitief).

Je raakt ALLEEN: `public/vandaag.html` + `public/vandaag.js` + `public/vandaag.css` (nieuw), `routes/vandaag.js` (nieuw, in `server.js` één regel registreren), `lib/migraties.js` (één migratie onderaan), `scripts/test-ko1-vandaag.mjs`, `OVERLEG-c.md`, en in `index.html` uitsluitend: (a) na het inloggen van een kantoor-gebruiker doorsturen naar `/vandaag` als er geen `#tab` in de URL staat, (b) een knop "🏠 Vandaag" linksboven in de bestaande tabbalk die naar `/vandaag` gaat. De bestaande tabs en API's blijven ongemoeid.

## Waarom deze prompt
Kantoor heeft vooral tijdsgebrek (DRAAIBOEK fase 2). Het goedgekeurde "Vandaag"-scherm beantwoordt in één blik "wat moet ik nu doen": drie kolommen Beslissen / Inplannen / Nakijken met de actie ernaast, rechts ritten vandaag en deze week. Dit is het nieuwe startscherm van kantoor; de zeven hoofdonderdelen in de bovenbalk zijn de nieuwe navigatie (de bestaande tabs blijven bereikbaar via die onderdelen).

## Punt 1 — Eén databron: `GET /api/vandaag` (alleenKantoor)
Geeft, voor de actieve periode en vandaag (serverdatum; `?datum=YYYY-MM-DD` voor tests):
- `periode {id,naam}`, `gebruiker {naam}`, `datum`, `week` (kampweek-nummer als die bestaat).
- `beslissen[]`: aanvragen met status `nieuw` (soorten materiaal en kapot: ico 📩/💥, titel = tekst, sub = "aanvraag KV <naam> · <tijd of gisteren/datum>") en chauffeursmeldingen (`soort='probleem_chauffeur'`, ico 🚪/💥/📩 naar soort, sub = "melding <tijd> · rit <status> · KV <naam> ook verwittigd"); elk met `acties` precies zoals in het ontwerp (Afwijzen / Goedkeuren / Goedkeuren + spoed; Bel conciërge als er een contact_telefoon is / Afgehandeld) en de bestaande API-aanroep per actie (`PUT /api/aanvragen/:id` met status; spoed via de bestaande spoedtransport-route).
- `inplannen[]`: transport-taken van deze week zonder rit (ico 🚚 rest-taak als opmerking met "Rest van rit" begint, 📦 levering, ↩ ophaling, 🔁 transfer/terugrit, 📩 goedgekeurde aanvraag), ritten zonder chauffeur (🚐 "Rit #n heeft nog geen chauffeur") of zonder voertuig, weekendtaken (🏃, pil "weekend"), capaciteitsconflicten (🔥). Actie = "Op een rit zetten" / "Chauffeur kiezen" / "Voertuig kiezen" / "Rit maken" / "Open conflict" → link naar het juiste bestaande tabblad met de taak/rit geselecteerd (`/#transport?taak=ID` of hoe index.html dat nu doet; zoek het op en gebruik wat er is).
- `nakijken[]`: conflicten van `/api/conflicten?periode_id` (ico ⚠/📋 naar soort) en open tekorten (🧮 "N tekorten open uit vrijdagcontroles · M besteld"). Actie "Open" → tabblad.
- `ritten_vandaag[]`: per rit `tijd, chauffeur, voertuig, status (gepland/onderweg/gedaan), stop_huidig, stops_totaal, stops[{naam, slot}]` (🔒 bij vast, pil "vrij" bij vrij, zoals het ontwerp).
- `deze_week[]`: open kampmomenten van deze week: `locatie, thema, kv_naam, dagen` + markeringen (vrijdagcontrole gepland, ⚠ bij open aanvraag kapot, kookdagen).
- `cijfers {ritten_onderweg, locaties_open}`.
Alles uit bestaande tabellen; je verzint geen velden. Lege lijsten blijven lege lijsten (het scherm toont dan "niets te doen" zoals het ontwerp dat zou doen: zelfde kolom, lege tekst in dezelfde stijl).

## Punt 2 — De pagina `/vandaag` (alleen kantoor; anders naar `/`)
Exacte kopie van het ontwerp, gevuld uit `GET /api/vandaag`. De bovenbalk met de zeven onderdelen: Vandaag (deze pagina) · Planning · Transport · Materiaal · Locaties · Voorraad & controles · Beheer; elk onderdeel linkt naar het bestaande tabblad dat er het dichtst bij ligt (schrijf de mapping in het verslag); tellers op Vandaag (beslissen) en Transport (inplannen). Periode-kiezer rechts: de bestaande planner-kiezer (V2b) hergebruiken; wisselen laadt de pagina opnieuw. Knop "Rit plannen" → Transport-tab. De schakelaar **Groot / Compact** werkt zoals in het ontwerp en wordt onthouden per gebruiker (Punt 3). Na elke actie (Goedkeuren, Afgehandeld, …) laad je `GET /api/vandaag` opnieuw; fouten `{error}` tonen in de bestaande toast-stijl (vraagModal/toast van V3b hergebruiken als die in een gedeeld bestand staat; anders een kleine eigen toast in dezelfde stijl).

## Punt 3 — Voorkeur per gebruiker
Migratie: `personeel.voorkeuren TEXT DEFAULT '{}'` (JSON). `PUT /api/mij/voorkeuren {vandaag_weergave:'groot'|'compact'}` en `GET /api/mij/voorkeuren` (ingelogde gebruiker). De pagina leest het bij het laden.

## Bewijs
- `scripts/test-ko1-vandaag.mjs` (via `_testhulp` op `herfst-test.db`, eigen poort): zet een aanvraag `nieuw`, een probleem_chauffeur, een rest-taak zonder rit, een rit met 3 stops (vast/vrij/vrij) op `?datum`, een conflict (thema dubbel) → `GET /api/vandaag?datum=…` bevat ze in de juiste kolom met de juiste ico/sub/acties; `ritten_vandaag[0].stops` heeft slots; `cijfers` kloppen; niet-kantoor → 403; voorkeur opslaan en teruglezen; `GET /vandaag` → 200 met de drie kolomkoppen en de schakelaar in de HTML.
- `node scripts/volle-run.mjs` 2×: alles groen + jouw test. Eindtabel in het verslag.
- Commit per punt, push `origin HEAD:bouw-c`. NOOIT naar main, NOOIT deploy.bat.
- Verslag onderaan `OVERLEG-c.md`: mapping onderdelen → tabbladen, exacte JSON-vorm van `/api/vandaag`, lijst afwijkingen van het ontwerp (hoort leeg te zijn). Laatste bericht eindigt met exact: **VOLLEDIG KLAAR MET DE PROMPT. NU IS HET TERUG AAN DE HOOFDCHAT.** Bij de tijdslimiet: stop, commit, "Stand bij tijdslimiet", push, en eindig met **TIJDSLIMIET BEREIKT: GESTOPT MET EEN TUSSENSTAND. NU IS HET TERUG AAN DE HOOFDCHAT.** Volgorde bij tijdnood: 1, 2, dan 3.
