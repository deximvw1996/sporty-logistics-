# TESTVERSLAG T3: rol coördinator

**Kan deze persoon morgen zijn werk doen? Ja voor de stockage, tekorten en ritten; nee zodra hij iets moet opzoeken.**
1. Aanvullen, afschrijven, melden, bestellen en rijden werken, en de voorraad klopte na elke stap.
2. **Grootste gat, door TF3:** er is geen scherm om te zien waar een bak staat (G1) en geen scherm met contacten of adressen buiten de eigen rit (G2).
3. "Bak klaar" blijft uit zolang de eigen melding bij kantoor ligt, ook als de bak vandaag vertrekt (G3).
4. Bij een wegvallende verbinding krijgt hij bij afvinken geen enkele melding (G4).

Getest op 31/10/2026 tussen 00:55 en 01:20, op `origin/main` 44fab81, lokaal op poort 3303, datamap `D:\Sporty\sporty-c-t3`, kopie van `herfst-test.db`, lege `APP_PASSWORD`. Niets op prod. Testpersoon: Tine Coord (rol coordinator), uitgenodigd door kantoor. Vooral 390×844, kort 1920×900.

## Eerlijk: wat niet echt geklikt is

- **Klikken gebeurde bijna altijd met `element.click()` in de echte pagina**, met de echte handlers en API-calls. Eén echte muisklik (naam kiezen bij het inloggen). Geen vinger op een gsm.
- **Foto's:** synthetisch PNG van 1×1 px op de file-input, geen camera.
- **Verbinding weg is nagebootst:** `fetch` tijdelijk laten mislukken, één keer bij afvinken. Geen echt netwerk uit, en niet bij Tekorten of in de rit.
- **Via API door kantoor (testdata):** bakken, KV-tellingen, keuringen, voorraad op 20, ritten, taken. Ook de beslissing op de gemelde regel is niet in Nakijken geklikt (zie G5).
- **Niet uitgevoerd:** Uitloggen, een geldige pincode wijzigen in Meer (alleen de weigering van 1234), de Export-download en de knop Afdrukken. De tussenstappen van de eerste pincode (zwakke code, ongelijke code) kon ik niet aflezen: het script werd afgekapt door het inloggen. Het eindresultaat was wel ingelogd.
- **Niet getest:** ritten van morgen op het scherm, "Past niet / niet gevonden" in de rit, de ▲▼-wissel (mijn stops waren vast), een klaargezette rit met melding (de melding hangt aan klaarzetten, ik heb niet klaargezet), Tekorten en Meldingen in detail op 1920.
- **Knopmaat en scroll** zijn gemeten op de schermen hieronder, niet op elk tussenscherm.

## Belangrijkste vraag: wat ontbreekt door de strenge rechten?

Elke route hieronder heb ik als coördinator opgevraagd.

| Nodig op een werkdag | Stand | Gevolg |
|---|---|---|
| Waar staat een bak | `/api/alle-bakken` en `/api/bakken` 403, `/bakken` stuurt naar Vandaag | Alleen het rek van een bak die op de aanvullijst of in de eigen rit staat. Elke andere bak: niet te vinden (G1) |
| Contact of adres van een locatie | Geen scherm. `/api/locaties` geeft wel 200 | Alleen KV en sleutelcontact van stops in de eigen rit (G2) |
| Kantoor bellen | Geen knop in de app; de printlijst kent een kantoorregel als er een nummer is | Vastzitten = naar kantoor stappen (G2) |
| Bericht naar kantoor | `/api/meldingen/ontvangers` en `POST /api/meldingen` 403, geen knop | Kan alleen een stuk melden (G2) |
| Artikel opzoeken | Link "Catalogus ›" in Tekorten stuurt zonder uitleg naar Vandaag | Dode link (G6) |
| Kalender of wat er deze week op een locatie staat | `/api/kampmomenten` 403 | Geen overzicht; ik weet niet of hij dat nodig heeft (twijfel) |

Wat wel open moet zijn, werkte allemaal. Wat dicht moet zijn, was 403: `DELETE /api/themas/1`, `POST /api/tekorten/melden`, `POST /api/ritten`, `/api/personeel`, `/api/nakijken`, `/api/ritplanning`.
Ook 403: `/api/mij/voorkeuren`. Op `/vandaag` vraagt de pagina dat alleen in de kantoortak; ik zag er geen hinder van.

## Per scenario

### Inloggen en Vandaag: GROEN
- Naam kiezen, "Kies een pincode", toetsenblok met knoppen van 64 px. Ingelogd op `/vandaag`.
- "2 dingen vandaag": NU "Aanvullen in de Rozenweg, 1 bak · 4 handelingen", DAARNA "14:00 Rit #23". Geen horizontale scroll, geen consolefouten.
- De kantoorlinks ("alles ›") staan onzichtbaar in de pagina (hoogte 0).

### Aanvullijst, afvinken en voorraad: GROEN

| Stap | Rozenweg | Op het scherm |
|---|---|---|
| Start | Springtouw 20, Krijt 20, Pion 20, Hoepel 20 | "4 handelingen", CO01 "vertrekt vandaag" |
| Springtouw × 4 afvinken | Springtouw 16 | "Springtouw aangevuld" |
| Terugzetten, opnieuw afvinken | 20, dan 16 | Klopt |
| Krijt: 3 van 5 (minder gevonden) | Krijt 17 | "3 aangevuld, 2 blijven open" |
| Krijt rest, dubbel getikt | Krijt 15 (geen dubbele aftrek) | Twee toasts "Krijt aangevuld" |
| Krijt terugzetten, opnieuw | 17, dan 15 | "3 van 5 gedaan" komt terug |
| Pion zonder foto | 20 | "Afschrijven vraagt een foto: tik eerst op 📷." |
| Pion met foto | Pion 18 | Afgevinkt |
| Hoepel | 20 | ⏳ uit, "wacht op levering" |

De volgorde is maar beperkt getest: één bak had een vertrekdatum en die stond bovenaan. Later stond de losse melding boven CO02 (zonder vertrekdatum).

### Melden: DEELS
- Kapot zonder foto: "Kapot melden vraagt een foto: tik op 📷." Met foto: gelukt.
- Weg: "Gemeld aan kantoor. Kantoor beslist in Nakijken." Voorraad ongewijzigd, kantoor kreeg een melding.
- Melding zonder bak: lege naam geeft "Vul in welk stuk het is."; ingevuld lukt.
- Deels omdat de melding de bak blokkeert (G3) en als rare bak in de lijst staat (G7).

### Bak klaar: DEELS
- Na alles afgevinkt: "Bak CO01 klaar (5/5)", toast "Bak CO01 klaar".
- Met open melding bleef de knop uit (G3).
- Na "klaar" zag ik geen verandering in de data: de bak staat er nog als "5 van 5 klaar", tellers gelijk. Of dat de bedoeling is, weet ik niet (twijfel).

### Printlijst: DEELS
Laadt met de juiste rijen, maar zie G8: horizontale scroll, "1 handelingen" boven 3 rijen, terugknop en tekst voor kantoor.

### Tekorten: DEELS

| Stap | Voorraad | Uitkomst |
|---|---|---|
| Hoepel "Besteld" (4, Decathlon) | 20 | Bestelling met naam en tijd, nog niet afvinkbaar |
| "Bestelling binnen" | 24 | Afvinkbaar, knop daarna uit (geen dubbele levering) |
| Hoepel afvinken | 20 | "binnen, klaar om te plaatsen" |
| + Bestelling leeg | | "Kies een artikel" |
| + Bestelling Springtouw × 5, binnen | 16 → 21 | "Bestelling bewaard" |
| Veer "Aanvullen uit voorraad" | | Handeling meteen afvinkbaar |

- `/tekorten/bestellijst` opent, met "Niets te bestellen." op dat moment.
- Deels door de tegenspraak in G5 en de dode link in G6.

### Verhuistaak: DEELS
- Gekoppeld aan zijn rit: verschijnt als stop "verhuis · 2 stuks", laden en lossen werken, taak op `gedaan`.
- Toewijzen kan alleen via de rit. Een taak zonder rit ziet hij nergens. De partiële `PUT /api/transport-taken/197 {wie}` geeft 500 (G9).

### Rit rijden: GROEN
- Vandaag › Ritten › `/rit/…`: adres, KV, rek, laden, aangekomen, lossen, volgende stop. Knoppen 46-50 px.
- Herladen midden in de rit: stand blijft (2 van 2 geladen).
- Database: rit 23 `gedaan`, taken 196 en 197 `gedaan`. Scherm: "Rit afgerond ✓".
- Twee opmerkingen in G10.

### Meer: DEELS
- Tekorten & bestellingen, pincode, Uitloggen: rijen van 60 px. Tekorten werkt, 1234 geweigerd met "Te makkelijk te raden". Uitloggen niet aangeraakt.
- De tekst onderaan klopt niet voor deze rol (zie ONDUIDELIJK).

### Meldingen: DEELS
"Bestelling binnen" gaat naar de rol coördinator, dus ook naar wie het zelf deed, en niet naar kantoor (G11). Tikken op de melding opent Tekorten.

### Desktop 1920: GROEN
Geen kantoorbalk, eigen tabbalk onderaan, Vandaag en Aanvullen in een smalle kolom, Tekorten in twee vakken. Geen horizontale scroll. Alleen laden en lezen, niet doorgeklikt.

## GEVONDEN

**BLOKKEERT**

1. **G1. Waar staat een bak: geen scherm.** Gsm en desktop, Meer. Verwacht: zoeken op bak. Gezien: `/bakken` → `/vandaag`, API 403. Stappen: als coördinator een bak zoeken die niet op de aanvullijst of in de rit staat. Ik noem dit blokkerend omdat er in de app geen omweg is.

**HINDERLIJK**

2. **G2. Geen contacten, geen kantoor.** Meer, 390. Verwacht: adres en contact per locatie, en kantoor kunnen bellen of berichten. Gezien: alleen bij stops in de eigen rit. Bij de KV stond "geen nummer" en er is geen alternatief.
3. **G3. Eigen melding houdt de bak tegen.** Bakscherm, 390. Verwacht: Bak klaar kan, de melding blijft apart bij kantoor. Gezien: 4 van 4 gedaan, knop "Bak CO01 klaar (4/5)" uit. Stappen: alles afvinken, kapot of weg melden. Het scherm legt niet uit waarom de knop uit staat. Dezelfde bak heet in de lijst "3 van 4" terwijl het bakscherm "4/5" zegt.
4. **G4. Geen melding bij netfout.** Aanvullen, 390. Verwacht: "Geen verbinding, niet bewaard". Gezien: niets op het scherm, in de console `Uncaught (in promise) TypeError: Failed to fetch` (`aanvullen.js:147`). De voorraad veranderde niet, dus er gaat niets stuk, maar de persoon weet het niet. Nagebootst, zie boven.
5. **G5. Tekorten en Aanvullen spreken elkaar tegen.** Tekorten-detail, 390. Gezien bij Hoepel en Veer: "1 handeling (CO01) nu al afvinkbaar (uit voorraad)" en "Rozenweg heeft 20", terwijl Aanvullen "wacht op levering" toont en de API 409-stand `kan_afvinken:false` geeft. Pas de knop "Aanvullen uit voorraad" maakt het waar, en vanuit Aanvullen is die knop niet te vinden. Ook: wie afrondt zonder over een gemelde regel te beslissen, krijgt die regel op `bestellen` (Springtouw × 1, met 21 in voorraad). Dat deed kantoor via de API bij mij, niet in het scherm Nakijken.
6. **G6. Dode link "Catalogus ›".** Tekorten-detail. Gezien: `/catalogus?id=…` → `/vandaag` zonder uitleg.
7. **G7. "Losse melding" telt als bak.** Aanvullen, 390. Gezien: "— Losse melding, 0 van 0 klaar" als kaart, en "4 handelingen in 2 bakken". Vandaag zei daarna "2 bakken · 1 handeling" terwijl Aanvullen "6 handelingen in 3 bakken" toonde.
8. **G8. Printlijst voor de coördinator.** 390. Gezien: scrollbreedte 476 op 390 px; "1 handelingen" boven 3 rijen; knop "‹ Terug naar Nakijken" (een scherm dat hij niet mag openen, knop niet geklikt); tekst "Voorraad & controles › Aanvullen" die hij niet heeft; knoppen 40 px.
9. **G9. `PUT /api/transport-taken/:id` met enkel `wie` geeft 500.** Log: `tried to bind a value of an unknown type (undefined)`. Via API als kantoor; of een scherm dit zo aanroept, heb ik niet nagekeken. Er staat ook nergens welke taak aan wie "toegewezen" is buiten de rit.
10. **G10. Rit laat alles toe.** Rit, 390. Lossen vóór "Ik ben aangekomen" rondt de stop af ("✓ Stop afgerond", uit), dus de aankomst kan niet meer doorgegeven worden. CO01 laden kan terwijl de bak nog open handelingen had, zonder waarschuwing.
11. **G11. Melding aan jezelf.** Meldingen, 390. Gezien: "Tine Coord: Bestelling binnen: 4 × Hoepel" bij Tine zelf, ongelezen. Kantoor krijgt ze niet. Op Vandaag wordt dat "2 meldingen" onder DAARNA.

**COSMETISCH**

12. **G12. Toasts over de knoppen.** Bakscherm, 390. Drie toasts liggen enkele seconden over Printlijst en Bak klaar (schermafdruk gezien).
13. **G13. Afgevinkt deelaantal.** Krijt toont na afvinken "× 2" terwijl er 5 gedaan zijn.
14. **G14. Tab bij Tekorten.** Op `/tekorten` licht Meer op; het scherm heeft geen eigen kop of terug naar Meer.

**Twijfel**

- Rit #23 stond op Vandaag zonder dat kantoor hem klaarzette. Hoort een niet-klaargezette rit zichtbaar te zijn?
- "Bak klaar" lijkt alleen een toast te geven (zie boven).

## ONDUIDELIJK VOOR DEZE ROL

- Meer: "Alles wat op de desktop kan, kan hier ook, maar één scherm per vraag." Niet waar voor een coördinator.
- Tekorten-detail: "Aanvullen uit voorraad" en "Bestellen" staan naast "Besteld" en "Bestelling binnen". "Bestellen" opent hetzelfde venster als "Besteld".
- "Er is genoeg voorraad: dit wordt een extra aankoop." Wat moet ik dan doen als de lijst "wacht op levering" zegt?
- "uit pool" en "uit de pool" naast "Rozenweg": dezelfde plek?
- Rit: "van Rozenweg · Molenstraat 90, 3010 Kessel-Lo". Dat adres is van de bestemming, maar het leest alsof het bij Rozenweg hoort.
- Stand "gekeurd", "gemeld door KV": zegt weinig aan iemand die de stockage doet.
- Knop ⚠ per regel en ⚠ "Kapot of weg melden": twee ingangen voor hetzelfde, zonder tekst bij de eerste.
