# PROMPT MOB2 — GSM-WEERGAVE van RITPLANNING, NAKIJKEN en ROOSTER (exacte kopie van design/mockup-gsm-1.html)
**Chat D (Sonnet) · map `D:\Sporty\sporty-d` · branch `bouw-d` · poort 3304 · verslag `OVERLEG-d.md` · TIJDSLIMIET 3 uur**

Lees eerst `CLAUDE.md` (MOBIEL-REGEL). Begin met `git fetch origin` en `git rebase origin/main`. Controleer de exitcode van de rebase zelf vóór je pusht. Lees dan volledig:
1. `design/mockup-gsm-1.html` — goedgekeurd door Maxim 30/10. Telefoons Ritplanning, Nakijken en Rooster zijn bindend. (Inloggen en de tabbalk bouwt chat C in MOB1.)
2. `design/MOBIEL-DEFINITIEF.html` voor de stijl.
3. `public/ritplanning.*`, `routes/ritplanning.js`; `public/nakijken.*`, `routes/nakijken.js`; `public/rooster.*`, `routes/rooster.js`.

Je raakt ALLEEN: `public/ritplanning.js/.css/.html`, `public/nakijken.js/.css/.html`, `public/rooster.js/.css/.html`, `routes/ritplanning.js`, `routes/nakijken.js`, `routes/rooster.js` (alleen als een gsm-scherm data mist), `scripts/test-mob2-gsm.mjs`, `OVERLEG-d.md`. NIET `public/nav.js`, `public/vandaag.*`, `public/login.*`, `lib/auth.js` (chat C). Laat onderaan 76 px vrij voor de tabbalk die C bouwt.

## Regels
Dezelfde URL en dezelfde API: onder 768 px toont de pagina de gsm-weergave, daarboven verandert er **niets** (computed-style vóór/na gelijk). Geen desktop-tabellen op gsm, één vraag per scherm, knoppen ≥ 44 px, geen horizontale paginascroll. Data verversen via `window.sportyApi`.

## Punt 1 — Ritplanning op gsm
Dagkiezer ma–vr bovenaan (rood puntje op een dag met waarschuwingen; ‹ › naar een andere week), kop met aantal ritten en waarschuwingen. Blok Open taken met knop **Op rit** (keuzelijst: bestaande ritten van die dag of nieuwe rit). Daaronder per bestuurder + voertuig de ritten: tijd, stops, route, bezetting; rood randje en ⚠ bij waarschuwing. Tik = ritdetail als volgend scherm met ‹ terug: stops met ▲▼ verplaatsen (geen slepen op gsm), bestuurder en voertuig wijzigen, waarschuwingen, Goedkeuren. **+ Nieuwe rit** als overlay van volle hoogte. Verhuistaken van sport verschijnen als rit of taak bij de bestuurder.

## Punt 2 — Nakijken op gsm
Lijst van bakken met tellers en chips (horizontaal scrollbaar). Bak openen = **één regel per scherm**: artikel groot, geteld/gewenst, wat de KV zegt, voorraad, voorstel; grote knoppen (56 px) met de acties van die regel (`ACTIES`: tekort: Bestellen / Aanvullen uit voorraad / Aanvaarden; kapot: Afschrijven + bestellen / Herstellen / Aanvaarden; te veel: Naar pool / Laten staan). De knop die het voorstel volgt is blauw. Na een keuze automatisch naar de volgende regel; Vorige / Overslaan onderaan; "Regel 1 van 3"; lijst "Nog in deze bak". Na de laatste regel: Keuring afronden. Elke keuze gaat via de bestaande API en is meteen bewaard.

## Punt 3 — Rooster op gsm
Weekkeuze ‹ ›, chips horizontaal scrollbaar, elke locatie een kaart: naam, KV ("geen KV" oker), alle thema's als labels met groep (1 tot 8, labels lopen door), regel "n meldingen ›". Tik = kampmomentpaneel als volgend scherm (‹ terug) met Wissel. Schakelaar Seizoen blijft: bestaand raster, scrollt binnen het raster.

## Bewijs
`scripts/test-mob2-gsm.mjs` (via `_testhulp`, eigen poort; DOM-bouw met echte data-JSON op 390 px): elk scherm toont de gsm-weergave en geen tabel; desktopweergave ongewijzigd; Op rit koppelt een taak; ▲▼ wijzigt de stopvolgorde; Nakijken gaat na een keuze naar de volgende regel en bewaart de actie; laatste regel toont Keuring afronden; Rooster toont 7 labels bij 7 thema's; alle knoppen ≥ 44 px; scrollWidth = 390. Bestaande tests rp1, rp2, vc1, pl2 blijven groen.
Browsercontrole: NOOIT een adres met gebruikersnaam/wachtwoord openen; test via scripts met de inlog in de request-header. Lukt een browserstap niet zonder toestemming: overslaan, melden, verder. Volle run 2× groen. Commit per punt, push `origin HEAD:bouw-d`. NOOIT naar main, NOOIT deploy.bat. Verslag onderaan `OVERLEG-d.md` per punt + GEVONDEN. Laatste bericht eindigt met exact: **VOLLEDIG KLAAR MET DE PROMPT. NU IS HET TERUG AAN DE HOOFDCHAT.** Bij de tijdslimiet: stop, commit, "Stand bij tijdslimiet", push, **TIJDSLIMIET BEREIKT: GESTOPT MET EEN TUSSENSTAND. NU IS HET TERUG AAN DE HOOFDCHAT.** Volgorde bij tijdnood: 1, 2, 3.
