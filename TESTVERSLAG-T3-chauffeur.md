**Kan deze persoon morgen zijn werk doen met deze app? Ja voor gewone leveringen en ophalingen, nee voor de verhuistaak van een sportset.**
Inloggen, Vandaag, laden, lossen, "past niet", problemen melden en ophalen werken, en de data klopt.
Wat tegenhoudt: een verhuistaak toont niet wat er verhuist en kan niet worden afgerond (BLOKKEERT, G1).
Wijzigingen van kantoor komen te laat of niet binnen: een open ritscherm ververst niet, een nieuwe vertrektijd geeft geen melding, en zonder klaarzetten is er geen enkele melding (G2, G3, G4).
Een grote rit is veel werk: 30 bakken kosten 62 tikken, en een tweede tik draait een actie zonder waarschuwing terug (G5, G6).

# Testverslag T3: chauffeur (Chat B)

Lokaal op poort 3302, code `origin/main` 44fab81, kopie van `herfst-test.db`, datum 31/10/2026, 390×844. Niets op prod, geen code gewijzigd.

## Wat niet echt geklikt of getest is
- **Klikken:** de knoppen in de rit- en aanvulschermen zijn echte knoppen uit de pagina, maar aangeklikt met een script (DOM-klik). Coördinaatklikken lukten niet onder de gsm-emulatie. Echte vingers, scrollen tijdens het tikken en de grootte van de tik-doelen in de praktijk zijn dus niet getest.
- **Wijzigingen door kantoor en klaarzetten:** gedaan via de API als kantoor, niet via de kantoorschermen.
- **Netwerk uit:** nagebootst door `fetch` te laten mislukken, niet echt offline. De service worker en het werken zonder bereik zijn niet getest.
- **Foto's:** niet gemaakt of opgestuurd, dus ook geen foto bij een probleem of bij "kapot".
- **Niet getest:**
  - een melding aantikken om de link te volgen;
  - "Alles gelezen";
  - de echte `/aanvullen`-lijst met regels (de lijst was leeg, alleen "Melding zonder bak" is getest);
  - een wissel met een al afgeronde stop;
  - te laat handelen (na de ritdatum).
- **Inloggen:** de pincode is gekozen bij de eerste login na de uitnodiging; ze staat hier niet genoteerd. Herinloggen met een verkeerde pincode is in dit deel van de test niet opnieuw nagekeken.
- **Kantoorschermen:** alleen `/ritplanning` en `/personeel` zijn echt geopend. Voor de andere pagina's is alleen de HTTP-status opgevraagd.

## Scenario's

| Scenario | Uitslag | Bewijs |
|---|---|---|
| Login naam + pincode | GROEN | Namenlijst → "Kies een pincode", twee keer ingeven → `/vandaag` |
| Vandaag: weten wat eerst komt | GROEN | "3 dingen vandaag", NU "Rit #22 · Camionette 08:00", daarna 12:00 en 16:00. Geen horizontale scroll. Wel G8 |
| Rit-link `/rit/<token>` | GROEN | Werkt zonder login; verzonnen token → 403 |
| Laden in de Rozenweg | DEELS | Werkt, gegroepeerd per rek (REK E, POOL, OVERIG). De Rozenweg is geen eigen stop en er is geen massaknop (G5, G9) |
| Rijden, aankomen | GROEN | Toast "✓ Aankomst doorgegeven", knop wordt "✓ Aangekomen", stop `aangekomen`. Tweede tik kan niet |
| Lossen | GROEN | 19 stuks geladen en gelost op stop 1 + 2. EHBO en springkasteel `op_locatie 29`; WESCO verdeeld "2@Abdijschool, 2@Rozenweg" |
| Past niet | DEELS | Werkt: toast "✓ Gemarkeerd: blijft open voor kantoor", kantoor krijgt taak 202 "Rest van rit #22: past niet" met 2 regels. Maar slecht vindbaar en "gelost" blijft tikbaar (G7, G10) |
| Aantal bij bulk | GROEN | 9 van 4 → "Geef een aantal tussen 1 en 4."; 2 van 4 werkt |
| Wissel vrije stops | DEELS | ▼ werkt, tijden blijven staan (205 18:00, 204 18:45). ▲ op de eerste stop doet niets (G11) |
| Gesloten deur melden | GROEN | Toast "✓ Gemeld aan kantoor en Test KV Abdijschool"; kantoor krijgt "…: locatie gesloten" |
| Iets anders melden | GROEN | Leeg → "Beschrijf kort wat er mis is."; met tekst komt de melding bij kantoor |
| Rit gedaan | GROEN | Geen aparte knop: na de laatste stop `gedaan`, rit `gedaan`, knop "Terug naar dag" |
| Ophaalrit | GROEN | 20 stuks, rit 23 `gedaan`; lijst meteen zichtbaar |
| Verhuistaak sportset | **ROOD** | Zie G1 |
| Kantoor wijzigt tijdens de rit | **DEELS** | Geladen stukken blijven bewaard, maar het zien gaat mis (G2, G3, G4) |
| Stop weg terwijl er geladen is | GROEN | 409 "Betekom: 3 stukken zijn al geladen — los ze eerst of zet de taak terug op gepland" |
| Meldingen lezen | GROEN | 3 ongelezen, leesbare teksten, teller op de tab klopt |
| Aanvullijst | DEELS | Opent, 200, geen kleine knoppen. Lijst was leeg, regels afvinken niet getest |
| Kapot/weg melden | DEELS | "Weg" komt bij kantoor: "Testbal (1×) is weg, gemeld vanuit de stockage — beslis in Nakijken". "Kapot" zonder foto maakt geen melding aan; de melding zelf heb ik niet kunnen aflezen. Kapot mét foto niet getest |
| Kantoorschermen | GROEN | `/ritplanning` en `/personeel` sturen door naar `/vandaag`. Wel G12 |
| Schrijf-API's | GROEN | 11 van 11 → 403: rit wijzigen, verwijderen en aanmaken, tijden, ontkoppelen, taakstatus, genereren, persoon aanmaken, token, checks/init, klaarzet. 6 lees-API's ook 403 |
| Rit met alleen naam (rit 24) | GROEN | Staat in Vandaag; afgewerkt tot `gedaan` |
| Herladen midden in een stop | GROEN | Zelfde stop, 9 geladen, niets kwijt |
| Terugknop | DEELS | Geen doodlopend scherm, maar zie G13 |
| Netwerk uit (nagebootst) | GROEN | "Geen verbinding — probeer het zo opnieuw."; server ongewijzigd |
| Grote rit, 30 bakken | DEELS | Werkt, 3,6 schermen hoog, 62 tikken (G5) |
| Console | DEELS | Op de pagina's bij elkaar 42 fouten, allemaal 403/404-laadfouten in de laatste 30 die ik las. Een deel komt van mijn eigen pogingen op verboden API's en onbestaande adressen; de oudste 12 heb ik niet gelezen. Geen JavaScript-fouten gezien |

## GEVONDEN

### BLOKKEERT
**G1. Verhuistaak sportset: de chauffeur ziet niet wat er verhuist en kan niet afronden.** Rit-scherm, 390 px.
- Verwacht: zien welke set van waar naar waar gaat, die afvinken en de stop afronden.
- Gezien: "levering · 0 stuks", "Betekom", "van Abdijschool Vlierbeek". De tekst "Sport verhuis: Archery tag (A)…" staat niet op het scherm. Na "Ik ben aangekomen" is er niets meer om af te werken: taak 203 blijft `aangekomen`, rit 26 blijft `onderweg`, en Vandaag blijft hem als NU tonen ("Verder ›").
- Stappen: `POST /api/sportrooster/plan` met Archery tag op Abdijschool dag 1–2 en op Betekom dag 3–5 → taak 203 met 0 regels → op een rit zetten → `/rit/asrp8jzhw1` openen → aangekomen.
- Twijfel: de rit heb ik op 31/10 gezet, terwijl de taak voor 3/11 stond. Dat verklaart de 0 regels en de ontbrekende tekst niet, maar is niet los nagekeken op de juiste datum.

### HINDERLIJK
**G2. Een open ritscherm ververst niet.** Rit-scherm, 390 px.
- Verwacht: een wijziging van kantoor verschijnt vanzelf of er komt een seintje.
- Gezien: na stop erbij, nieuw voertuig en nieuwe tijd bleef het scherm "STOP 2 VAN 2 · Camionette · 09:45" tonen, terwijl de server al 3 stops, Camion en 12:15 had. Pas herladen toont het. `rit.js` heeft geen timer of verversing. De pagina toont ook geen meldingenteller.

**G3. Een nieuwe vertrektijd op een lopende rit geeft geen melding.** API + Meldingen.
- Verwacht: melding "tijden aangepast".
- Gezien: `PUT /api/ritten/22 {vertrek}` geeft 200 en verschuift de stops, maar de melding noemt alleen "voertuig aangepast, stop van de rit gehaald, stop toegevoegd". De knoppen `/tijden` en `/verplaats` weigeren wel met 409 "rit is al bezig/gedaan", dus deze route is ongelijk. De tijd van een al afgeronde stop schuift mee (196 van 09:00 naar 11:30).

**G4. Een rit die niet klaargezet is, geeft nooit een melding, ook niet als ze al onderweg is.** Meldingen.
- Verwacht: de chauffeur die al rijdt hoort het als er iets wijzigt.
- Gezien: 0 meldingen na stop erbij, stop weg, voertuig, tijd en andere bestuurder op rit 22 (`onderweg`, niet klaargezet). Na `klaarzet` kwamen ze wel. De chauffeur kan een niet-klaargezette rit gewoon starten, zonder waarschuwing.

**G5. Geen massaknop bij grote ritten.** Stop-scherm, 390 px.
- Verwacht: minder tikken dan bakken × 2.
- Gezien: 30 bakken = 1 stop openen + 30 laden + 1 aangekomen + 30 lossen = **62 tikken**, over 3,6 schermen hoog, verdeeld over 11 rekken.
- Op rit 22 kost een stop van 10 regels ook 21 tikken.

**G6. Laden en lossen draaien stil om bij een tweede tik.** Stop-scherm, 390 px.
- Verwacht: een bevestiging of een duidelijke melding.
- Gezien: dubbel tikken maakt de actie ongedaan, zonder toast. In mijn eigen test bleef rit 23 zo op "10 geladen, 9 gelost" hangen en was de stop niet klaar, zonder dat het scherm zei waarom.

**G7. Lossen kan vóór laden, zonder melding.** Stop-scherm, 390 px.
- Verwacht: een waarschuwing.
- Gezien: check 83 kreeg `gelost` true en `geladen` false, geen toast. Ook bij een stuk met "past niet" blijft "lossen" tikbaar: Kleuterhindernisbaan toonde "✓ gelost" terwijl de bak nog `thuis` in de Rozenweg lag. Het scherm zegt dus iets anders dan de data.

**G8. "50/20 bakken ⚠" op Vandaag telt stuks als bakken.** Vandaag, 390 px.
- Verwacht: het aantal bakken tegenover de capaciteit.
- Gezien: rit #22 en #23 tonen 50/20 met een waarschuwing. 50 is het aantal stuks, inclusief bulk. De chauffeur denkt dat de rit niet past. `klaarzet` geeft om dezelfde reden `over_capaciteit: true`.

**G9. Stopvolgorde van het scherm klopt niet met de dag.** Stop-scherm, 390 px.
- Verwacht: eerst laden in de Rozenweg, dan rijden, dan aankomen.
- Gezien: "📍 Ik ben aangekomen" staat boven de laadregels, en elke stop heeft zijn eigen laadlijst. Er is geen stap "laden in de Rozenweg" en geen totaalbeeld over de stops heen. Bij stop 2 zit het laden dus in een scherm dat je pas opent als je volgens het scherm al naar stop 2 gaat.

**G10. "Past niet / niet gevonden" is moeilijk te vinden.** Stop-scherm, 390 px.
- Verwacht: de knop opent de keuze.
- Gezien: de knop geeft alleen de hint "Tik op de naam van het stuk dat niet mee kan". De namen zijn tikbaar maar zien er niet zo uit, en de naam-knop van de EHBO-regel is 34 px hoog (onder de 44 px).

**G11. ▲ op de eerste stop doet niets.** Rit-scherm, 390 px.
- Verwacht: knop uitgeschakeld of een melding.
- Gezien: de knop is niet uitgeschakeld, geen toast, niets verandert. De server kent wel een foutmelding voor dit geval op de kantoorroute; op deze knop zag ik geen tekst.

### COSMETISCH
**G12. Kantoorlinks in de pagina.** `/ritplanning`, `/nakijken` en `/kampmomenten` zitten verborgen in de HTML van de chauffeurspagina. `/nakijken`, `/kampmomenten`, `/sportrooster`, `/logboek` en `/personeel` geven 200 op de HTML; alleen `/ritplanning` en `/personeel` zijn geopend en sturen door. De data erachter gaf 403 waar ik het probeerde. `/api/logboek` en dergelijke heb ik niet apart geprobeerd.

**G13. Terugknop vanuit een stop.** Vanuit stop 1 gaat de browser-terugknop naar `/vandaag` in plaats van naar het dagscherm van de rit. "← Dag" op het scherm werkt wel. Geen doodlopend scherm.

**G14. Stoptijden tegenover vertrek.** Vandaag zegt 08:00 en de stop 09:00. Dat kan kloppen (rijtijd), maar het wordt nergens uitgelegd.

**G15. Dubbele regels.** Drie aparte regels "Blazer 1500W" (1×, 1×, 2×) in dezelfde stop: drie keer tikken voor hetzelfde stuk. Springkastelen staan onder OVERIG zonder code. "geen nummer" bij de KV komt uit de testdata.

## ONDUIDELIJK VOOR DEZE ROL
1. Bij een ophaling staan "laden" en "lossen" op hetzelfde stopscherm bij de klant. Lossen gebeurt pas in de Rozenweg, maar het scherm zegt niet wanneer. De stop gaat pas op gedaan als alles gelost is, dus de chauffeur moet het eigenlijk later in dezelfde stop afwerken. En wanneer tik je dan "aangekomen"?
2. "🔒 vast door kantoor" en "▲▼ vrij": geen uitleg waarom je mag wisselen of wat er met de tijd gebeurt. De tijden blijven staan en de stops wisselen, dus een klant kan op een ander uur dan gepland aan de beurt komen.
3. Een rit voor morgen (rit 25, 1/11) kan vandaag al volledig geladen worden, zonder opmerking. Dat kan de bedoeling zijn (avond vooraf), maar het staat er niet bij.
4. Geen knop "rit gedaan": de rit sluit vanzelf. Prima als je het weet, maar er is geen duidelijke eindboodschap behalve "✓ Stop afgerond" en "Terug naar dag".
5. De melding "rijd je niet meer" zegt niet wat er moet gebeuren met wat je al geladen hebt. De rit-link blijft bovendien werken voor de oude bestuurder (rit-link werkt zonder login).
6. "is gewijzigd: stop toegevoegd" zegt niet welke stop of wat er verandert, en "gewijzigd" zegt niets over het eerstvolgende wat je moet doen.
7. Een melding "Past niet" en de meldknop "Materiaal past niet in het lokaal" lijken op elkaar: de eerste maakt een nieuwe taak voor één stuk, de tweede is een melding aan kantoor en KV. Het verschil staat niet op het scherm.

## Testritten
Rit 22 levering, 23 ophaling, 24 alleen naam, 25 groot (30 bakken), 26 verhuistaak, 27 wissel. Rit 25 blijft op 30 geladen staan en rit 26 blijft `onderweg` (G1); rit 27 is alleen gewisseld, niet afgewerkt.
