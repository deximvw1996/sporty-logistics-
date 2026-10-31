**Kan deze persoon morgen zijn werk doen? Ja: geen blokkering meer, de volledige dag loopt van login tot "Rit afgerond", ook de verhuistaak.**
T3-blokkering G1 (verhuistaak) is weg; de meeste hinderlijke punten ook. Kantoorwijzigingen verschijnen binnen ongeveer 30 s en open werk blijft staan.
Wat nog hindert: opnieuw klaarzetten geeft geen melding, terwijl het scherm die belooft (G1 hieronder).
Snelle wijzigingen overschrijven een eerdere melding, zoals "aan jou toegewezen" (G2). Ongedaan maken op een afgeronde stop laat scherm en data uiteenlopen (G3).
Tellers spreken elkaar tegen ("Alles gelost (8)" → "12 stuks" → "8 stuks"; G4). Een grote rit kost nog 26 tikken, geen 62 meer (G5).

# Testverslag T4: chauffeur (Chat B)

Lokaal op poort 3302, code `origin/main` 5f9f743, verse kopie van `herfst-test.db`, datum 31/10/2026, 390×844. Niets op prod, geen code gewijzigd.

## Wat niet echt geklikt is
- **Echte muisklikken:** inloggen en pincode, blok "Laden" openen, dubbeltik op laden, Past niet met bevestiging, Alles geladen met bevestiging, een melding aantikken.
- **`element.click()`:** de rest van de ritschermen (Ongedaan maken, Toch lossen, Alles gelost, aankomen, wissel, ophaalrit, grote rit, verhuistaak) en `history.back()`. Geen vinger of touch.
- **Ongedaan maken met de muis is niet gelukt:** mijn klik kwam na de 6 s van de toast. Via `element.click()` binnen die tijd werkt het.
- **Kantoor:** wijzigingen en klaarzetten via de API, niet via kantoorschermen.
- **Niet opnieuw getest:** gesloten deur en "iets anders" melden tot het einde, foto's, netwerk uit, `/aanvullen` en kapot/weg, de rit-link van een oude bestuurder, tijd wijzigen na een afgeronde stop, een gestarte rit die niet klaargezet was, verkeerde pincode.
- **Verhuistaak:** `sport_sets.locatie_id` na afloop niet zelf nagelezen.
- **Stop weg terwijl er geladen is en terugzetten op niet-klaargezet bij een gestarte rit:** alleen de API-weigering, er is geen knop bij kantoor gezien.

## Hertest T3

| T3 | Onderwerp | Stand | Gezien |
|---|---|---|---|
| G1 | Verhuistaak | **weg** | "VERHUIS · 17:00", "Archery tag (A) van Abdijschool Vlierbeek → Betekom, vóór wo 4/11 · 1 stuk". Tot `gedaan`, rit `gedaan`, op een rit van de juiste datum (3/11) |
| G2 | Scherm ververst niet | **weg** | Na 32 s balk "Kantoor wijzigde deze rit: ander voertuig, nieuwe vertrektijd" |
| G3 | Vertrektijd zonder melding | **weg** | Melding "…vertrektijd aangepast". Afgeronde stop niet opnieuw getest |
| G4 | Niet klaargezet, geen melding | **weg** | Rit is onzichtbaar tot klaarzetten en schrijven via de link geeft 409. Gestarte rit zonder klaarzetten niet getest |
| G5 | 62 tikken bij 30 bakken | **deels** | 26 tikken (zie scenario). Geen knop voor het hele blok, wel per rek |
| G6 | Tweede tik draait stil om | **weg** | Dubbeltik: blijft geladen, data klopt (`geladen` true) |
| G7 | Lossen vóór laden stil | **weg** | Venster "Nog niet geladen… Toch lossen zet het op geladen én gelost." Op past niet: geen losknop |
| G8 | "50/20 bakken" | **weg voor de chauffeur** | Staat niet meer op Vandaag of in Ritten. De chauffeur ziet alleen stuks. `klaarzet` geeft 20 van 20, niet meer boven capaciteit |
| G9 | Laden niet als stap | **deels** | Blok "📦 Laden in Rozenweg · 0 van 50" over alle stops. Op de stop staat "Ik ben aangekomen" nog boven de regels |
| G10 | Past niet moeilijk te vinden | **weg** | Rode knop op elke regel, 44 px |
| G11 | ▲ op eerste stop doet niets | **weg** | Knop uitgeschakeld |
| G12 | Kantoorlinks in de HTML | **nog aanwezig** | `/ritplanning`, `/nakijken`, `/kampmomenten` nog verborgen in de Ritten-pagina. Openen stuurt door; data 403 |
| G13 | Terugknop vanuit stop | **weg** | Terug naar het dagscherm van de rit |
| G14 | Vertrek tegenover stoptijd | **nog aanwezig** | Vertrek 10:30, stop 11:30; de rit toont geen vertrek |
| G15 | Dubbele regels | **deels** | Samengevoegd, maar zie G6 hieronder |
| O1 | Laden/lossen bij ophaling | **weg** | "📥 Lossen in Rozenweg · 17 nog te lossen" |
| O2 | Vast/vrij, wisselen | **deels** | Extra regel "▲▼ wisselt alleen met een aangrenzende vrije stop"; over de tijden geen uitleg |
| O3 | Te vroeg laden | **nog aanwezig** | Verhuistaak van 3/11 op 31/10 volledig afgewerkt, zonder opmerking |
| O4 | Geen eindboodschap | **weg** | "✓ Rit afgerond · 2 stops · 49 stuks", "Terug naar Vandaag" |
| O5 | "rijd je niet meer" | **nog aanwezig** | Zelfde tekst; link van oude bestuurder niet getest |
| O6 | "stop toegevoegd" zegt weinig | **nog aanwezig** | Balk en melding noemen de stop niet |
| O7 | Twee soorten "past niet" | niet getest | |

## Scenario's

| Scenario | Uitslag | Bewijs |
|---|---|---|
| Inloggen, Vandaag | GROEN | "niets meer vandaag", "✓ Niets te doen" zolang niets klaarstaat |
| Rit vóór klaarzetten | GROEN | Niet in Vandaag of Ritten. Link: "Deze rit is nog niet klaargezet. Kantoor werkt er nog aan; je krijgt een melding zodra ze klaarstaat." |
| Verschijnt vanzelf | GROEN | Klaarzetten, binnen 33 s staat de rit op de open link, zonder herladen |
| Blok laden over alle stops | GROEN | 20 regels in rekken, geen horizontale scroll, geen knop onder 44 px |
| Alles per rek, per stuk, gemengd | GROEN | Past niet overgeslagen: EH2 blijft `niet_mee`, voortgang klopt |
| Ongedaan maken na Alles | GROEN | 18 → 13, "✓ Ongedaan gemaakt". Venster 6 s, daarna per regel (G7) |
| Lossen vóór aankomst | DEELS | Aankomst wordt doorgegeven, `aangekomen`; geen boodschap (G9) |
| Toch lossen | GROEN | F40: geladen en gelost true |
| Rit afgerond | GROEN | 19 van 19, rit `gedaan`, bakken op locatie 29 |
| Past niet → kantoor | GROEN | Taak 204 "Rest van rit #22: past niet", EH2 blijft thuis in de Rozenweg |
| Verhuistaak | GROEN | Zie G1 in de hertest |
| Voertuig, tijd | GROEN | Balk binnen 32 s |
| Stop erbij | GROEN | Balk "stop toegevoegd", "STOP … VAN 3" |
| Stop weg (niets geladen) | GROEN | Balk "stop weggehaald" |
| Stop weg (geladen) | GROEN | 409 "Betekom: 9 stukken zijn al geladen — los ze eerst of zet de taak terug op gepland" |
| Andere bestuurder heen en terug | DEELS | Meldingen komen, maar worden overschreven (G2) |
| Terug op niet-klaargezet | DEELS | Open link toont het binnen 32 s; melding "staat niet meer klaar"; gestart: 409. Opnieuw klaarzetten: geen melding (G1) |
| Open venster bij wijziging | GROEN | Probleemvenster met getypte tekst bleef 32 s staan, de balk werkte bij na sluiten. Niets verloren |
| Ophaalrit | GROEN | 20 regels, Lossen in Rozenweg per rek, EHBO weer `thuis` op 7, rit `gedaan` |
| Herladen midden in Alles | DEELS | Verzoek is verwerkt (5 stukken op de server). Herladen op een blok toont het dagscherm (G8). Herladen op een stop blijft op de stop |
| Grote rit, 30 bakken | DEELS | 26 tikken: blok 1, 10 rekken × 2 (Alles + Ja), terug 1, stop 1, aangekomen 1, Alles gelost 2. Blok 5,1 schermen hoog |
| Eenheid bakken/plaatsen | GROEN | De chauffeur ziet stuks, geen plaatsen. Kantoor kreeg 20 van 20. Wel G4 voor de tellers |
| Meldingen lezen | GROEN | Tik op melding: Ritten-tab, 8 → 7 ongelezen |
| Kantoorschermen | GROEN | `/zoeken` stuurt door naar `/vandaag` |
| API's geweigerd | GROEN | 403 op alle 13 schrijfpogingen, ook `/api/bericht-kantoor` en `klaarzet-terug`. 403 op `/api/opzoeken/bakken`, `artikelen`, `locaties`, `bak` en 5 kantoor-API's. `/api/opzoeken/kantoor` niet geprobeerd |
| Console | DEELS | Meer dan 80 laadfouten in de hele sessie: 403 en 409 van mijn eigen pogingen, en veel 404's waarvan ik de bron niet heb gevonden (de stop van rit 22 heeft er zelf geen). Geen JavaScript-fouten gezien |

## GEVONDEN

### BLOKKEERT
Niets.

### HINDERLIJK
**G1. NIEUW. Opnieuw klaarzetten geeft geen melding.** Meldingen, 390 px.
- Verwacht: zoals de link belooft, "je krijgt een melding zodra ze klaarstaat".
- Gezien: bovenaan blijft "Rit #26 … staat niet meer klaar: kantoor past ze nog aan", ook nadat de rit weer klaarstaat en werkt.
- Stappen: klaarzetten → `klaarzet-terug` → opnieuw `klaarzet` → `/meldingen`.

**G2. NIEUW. Een snelle wijziging overschrijft een andere melding over dezelfde rit.** Meldingen, 390 px.
- Verwacht: "aan jou toegewezen" en "staat voor je klaar" blijven bestaan.
- Gezien: "Rit #22 … is aan jou toegewezen" werd binnen 2 minuten vervangen door "is gewijzigd: stop van de rit gehaald". De laatste bestuurdersmelding is dan "rijd je niet meer", terwijl de rit weer van deze chauffeur is. "Rit #22 … staat voor je klaar" verdween op dezelfde manier. Vermoedelijke oorzaak: `routes/meldingen.js:45` zoekt alleen op de "Rit #n "-aanhef.
- Stappen: bestuurder wisselen en terugzetten, binnen 2 minuten een stop weghalen, zonder de meldingen te lezen.

**G3. NIEUW (TF5 noemde het). Ongedaan maken op een afgeronde stop laat scherm en data uiteenlopen.** Stop-scherm, 390 px.
- Verwacht: stop weer open, of duidelijk geen ongedaan.
- Gezien: na Alles gelost en Ongedaan maken: "✓ Stop afgerond", taak `gedaan`, slechts 1 van 9 gelost, en de bakken staan volgens de server al op de locatie. Opnieuw Alles gelost herstelt het.

**G4. NIEUW. Tellers spreken elkaar tegen.** Blok en stop, 390 px.
- Verwacht: één getal per handeling.
- Gezien: knop "Alles geladen (12)" → "Alles geladen: 42 stuks?", "Ja, 42 geladen" → toast "Geladen: 12 stuks". Knop "Alles gelost (8)" → "12 stuks" → "8 stuks". Kop "48 van 49 stuks geladen" naast "Laden in Rozenweg · 49 van 50". Na de wijziging "48 van 50" en "49 van 51". De chauffeur kan niet nagaan of het klopt.

**G5. Grote rit (T3-G5, deels).** 26 tikken in plaats van 62. Het laden blijft 21 tikken over 10 rekken; een knop voor het hele blok ontbreekt, op de stop is er wel "Alles gelost (30)".

### COSMETISCH
**G6. NIEUW. Samengevoegde regel toont de verkeerde naam.** Blok, 390 px. "1 × Blazer 1500W · 0 van 3 geladen", "1 × Verlengdraadkoffer · 0 van 2 geladen".

**G7. NIEUW. Toast met Ongedaan maken.** Blok, 390 px. Bedekt twee regels, en na 6 s is de groepsactie alleen nog per regel terug te draaien. Mijn muisklik kwam daardoor te laat.

**G8. NIEUW. Herladen op een blok gaat naar het dagscherm** terwijl het adres `#blok-laden` blijft. Niets verloren.

**G9. NIEUW. Lossen vóór aankomst geeft geen boodschap.** De aankomst wordt stil doorgegeven.

**G10. NIEUW. Niet-klaargezette link heeft geen knop.** Alleen de tekst, geen weg naar Vandaag. Ververst wel vanzelf.

**G11. NIEUW. Ritten-tab staat niet op tijd.** 10:30, 16:00, 07:00, 18:00.

**G12. Kantoorlinks in de HTML (T3-G12).** Geen toegang, wel nog aanwezig.

**G13. Vertrek ontbreekt op de rit (T3-G14).** Vertrek 10:30 tegenover eerste stop 11:30, zonder uitleg.

## ONDUIDELIJK VOOR DEZE ROL
1. Een rit voor een latere dag kan vandaag volledig afgewerkt worden; de verhuistaak van 3/11 ging op 31/10 op `gedaan`. Is dat de bedoeling?
2. Bij een verhuistaak vraagt de stop om "Ik ben aangekomen", en het blok heet "Laden in Abdijschool Vlierbeek": duidelijk, maar de chauffeur moet zelf weten dat laden daar eerst komt.
3. De tijden blijven staan bij een wissel, dus de stop komt op een ander uur dan gepland; dat staat niet op het scherm.
4. "stop toegevoegd" en "stop weggehaald" zeggen niet welke stop.
5. "rijd je niet meer" zegt niet wat er moet gebeuren met wat al geladen is.
6. Stuks of regels: "Alles geladen (12)" en "42 stuks" zijn allebei waar, maar de knop zegt niet wat hij telt.
7. Blok "Laden in Rozenweg" vermeldt niet per regel voor welke stop het stuk is.
