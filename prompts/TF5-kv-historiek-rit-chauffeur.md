# PROMPT TF5 — T3: KV-tellingen met volledige historiek, KV-link, en de rit voor chauffeur (verhuistaak, klaarzetten, verversen, Alles geladen)
**Chat C (Opus) · map `D:\Sporty\sporty-c` · branch `bouw-c` · poort 3303 · verslag `OVERLEG-c.md` · TIJDSLIMIET 3,5 uur**

Lees eerst `CLAUDE.md`. Ga naar je branch (`git checkout bouw-c`), dan `git fetch origin` en `git rebase origin/main`. Controleer de exitcode van de rebase zelf vóór je pusht. Lees dan volledig: `TESTVERSLAG-T3-kv.md`, `TESTVERSLAG-T3-chauffeur.md`, `routes/kv.js`, `public/kv.*`, `lib/gedeeld.js`, `public/rit.*` en de rit-token-routes, `routes/transport.js`, `routes/ritplanning.js`, `routes/sportrooster.js` (verhuistaak), `routes/vandaag.js`, `routes/meldingen.js`, `routes/nakijken.js` (hoe tellingen in Nakijken landen).

Je raakt ALLEEN: `routes/kv.js`, `public/kv.*`, `lib/gedeeld.js`, `public/rit.*`, de rit-token-routes, `routes/transport.js`, `routes/ritplanning.js`, `routes/vandaag.js`, `routes/meldingen.js`, `lib/migraties.js` (onderaan), `routes/nakijken.js` en `public/nakijken.js` (alleen het blok Tellingen-historiek), `scripts/test-tf5-*.mjs`, `OVERLEG-c.md`. Chat D werkt tegelijk aan `public/nakijken.*` voor iets anders, `public/vandaag.*`, `public/taken.*`, `public/aanvullen.*`, `routes/tekorten-overzicht.js`: blijf daar af.

## Punt 1 — KV-tellingen: alles bewaard (BINDEND, Maxim 31/10)
"Kv kan 10 keer per week iets natellen. Alles moet historiek hebben en bewaren. Alles moet gelogd worden en blijven."
- Elke telling van een stuk wordt een eigen, onwisbare rij (wie, wanneer, geteld, kapot, te veel, notitie, foto, via welke link). Geen enkele wijziging overschrijft een vorige; ook "Rest klopt" en een correctie niet. Migreer bestaande tellingen als eerste versie.
- De KV kan onbeperkt natellen, elke dag, ook na versturen. Elke keer versturen die iets nieuws bevat geeft kantoor één melding met wat er veranderde ("F40: Politiepet 1 → 0, 'weg'"); versturen zonder wijziging geeft geen melding.
- Een al afgeronde keuring heropent bij een nieuwe afwijking (zelfde weg als de melding van de aanvuller). Wat kantoor al besliste blijft staan en bewaard; een nieuwe afwijking krijgt een nieuwe regel of een opgetelde, nooit een stille wijziging van een beslissing. Beschrijf je keuze in het verslag.
- Nakijken toont per stuk de laatste stand en een uitklap "Eerdere tellingen" met datum, wie, cijfers, notitie, foto. KV-scherm: "Verstuurd om 14:02", en wat sindsdien nieuw is ("2 wijzigingen nog niet verstuurd"). Vervang "maandag nakijken" door een tekst die de hele week klopt.
- Dit geldt ook voor aanvragen en kapot melden: nooit wissen, status bewaard met wie en wanneer.

## Punt 2 — KV-scherm
- Bak krijgt thema en groep; bij twee thema's gegroepeerd (G3). Kamp zonder bak: uitleg en kantoor-telefoon (leeg: geen nummer tonen) (G5). Tijdstippen in dezelfde vorm (G10). "Rest klopt" zegt hoeveel stukken het zet, vóór het gebeurt. Een knop Kapot melden op het telscherm.
- **Link na het kamp (akkoord Maxim):** tot 14 dagen na het einde van het kampmoment alleen lezen (schrijven 403, scherm legt het uit), daarna dicht met een nette pagina. Tellingen blijven bewaard.

## Punt 3 — Klaarzetten is de poort (akkoord Maxim)
De chauffeur ziet een rit pas na Klaarzetten: niet in Vandaag, niet in de tab Ritten; de rit-link toont vóór klaarzetten "Deze rit is nog niet klaargezet". Kantoor kan terug op niet-klaargezet zetten zolang de rit niet gestart is, met melding. Bij een rit die al gestart is altijd een melding bij wijziging, ook bij een rit die vroeger zonder klaarzetten startte (G4). Een nieuwe vertrektijd op een lopende rit geeft ook een melding, en de tijd van een afgeronde stop schuift nooit mee (G3).

## Punt 4 — Verhuistaak afwerken (G1, BLOKKEERT)
Toon welke set, van waar naar waar, en hoeveel. De verhuistaak krijgt regels (of een eigen afvinkbare regel als er geen zijn). Aangekomen, laden, lossen, klaar: taak en rit gaan op gedaan. Controleer eerst of de 0 regels ook optreden op de juiste datum. Voorraad en `waar staat` van de set volgen.

## Punt 5 — Rit op gsm
- **Beide manieren moeten kunnen (Maxim):** per stuk tikken blijft, en daarnaast "Alles geladen" en "Alles gelost" per rek en per stop. Bevestigen met het aantal; wat "past niet" heeft, slaat de knop over. Gelogd als één handeling plus elke regel.
- Tweede tik draait niet stil terug: toast met zichtbaar "Ongedaan maken" (G6).
- Lossen vóór laden en lossen op "past niet": waarschuwing of geblokkeerd (eigen knop "Toch lossen"), scherm en data zeggen hetzelfde (G7). Lossen vóór aankomst: geeft de aankomst automatisch door of vraagt erom.
- Scherm ververst vanzelf (ca. 30 s en bij terugkeer naar het scherm); bij een wijziging een zichtbare balk "Kantoor wijzigde deze rit: stop toegevoegd", en lopend werk gaat niet verloren (G2). Op de rit de meldingenteller.
- "50/20 bakken" telt op Vandaag en bij klaarzetten bakken tegenover capaciteit, niet stuks (G8). Controleer de bron; meld de eenheid.
- "Past niet" is een duidelijke knop per regel (≥ 44 px) (G10). ▲ op de eerste stop uitgeschakeld (G11). Terugknop vanuit een stop gaat naar het ritscherm (G13). Eindscherm "Rit afgerond". Dubbele regels van hetzelfde stuk samen tonen (G15).
- Eerst een eenvoudig blok "Laden in de Rozenweg" over alle stops heen (G9), bij een ophaling "Lossen in de Rozenweg" op het einde. Werkt de opbouw daarvoor niet met één scherm: GEVONDEN en vóór je iets groots bouwt stoppen.

## Bewijs
`scripts/test-tf5-kv.mjs` en `scripts/test-tf5-rit.mjs` (via `_testhulp`, eigen poort): 10× natellen = 10 bewaarde versies; DB: geen enkele oude rij gewijzigd; melding alleen bij wijziging; afgeronde keuring heropent, oude beslissing intact; historiek in Nakijken; link 13 dagen lezen, 15 dagen dicht; rit onzichtbaar vóór klaarzetten voor chauffeur op drie plekken; verhuistaak tot gedaan; Alles geladen slaat past-niet over; ongedaan maken; verversing toont wijziging; tellingen van bakken en capaciteit. Bestaande kv-, rit-, gr1-, me1-, tf3-tests groen; pas ze alleen aan met uitleg. Browser op localhost op 390; NOOIT een adres met gebruikersnaam/wachtwoord openen; lukt een browserstap niet zonder toestemming: overslaan, melden, verder. Volle run 2× groen. Commit per punt, push `origin HEAD:bouw-c`. NOOIT naar main, NOOIT deploy.bat. Verslag onderaan `OVERLEG-c.md` per punt + GEVONDEN. Laatste bericht eindigt met exact: **VOLLEDIG KLAAR MET DE PROMPT. NU IS HET TERUG AAN DE HOOFDCHAT.** Bij de tijdslimiet: stop, commit, "Stand bij tijdslimiet", push, **TIJDSLIMIET BEREIKT: GESTOPT MET EEN TUSSENSTAND. NU IS HET TERUG AAN DE HOOFDCHAT.** Volgorde bij tijdnood: 1, 4, 3, 5, 2.
