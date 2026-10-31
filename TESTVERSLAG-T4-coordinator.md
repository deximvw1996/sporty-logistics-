# TESTVERSLAG T4: rol coördinator

**Kan deze persoon morgen zijn werk doen? Ja. Niets blokkeert, en de voorraad klopte na elke stap.**
1. Opzoeken, aanvullen, tekorten en rijden werken van begin tot eind.
2. De knop "Aanvullen uit voorraad" verschijnt nooit op het aanvulscherm (N1). De omweg via Tekorten werkt, maar een nieuweling vindt die niet.
3. Op de rit staat een set die op een kamp staat onder "Laden in Rozenweg" (N2).
4. "Ongedaan maken" na de laatste stop maakt scherm en data ongelijk (N3).
5. In de testdata heeft geen enkele locatie een telefoonnummer, dus de echte waarde van Locaties hangt af van wat kantoor invult.

Getest op 31/10/2026, `origin/main` 5f9f743, lokaal op poort 3303, verse kopie van `herfst-test.db`, datamap `D:\Sporty\sporty-c-t4`, lege `APP_PASSWORD`. Niets op prod. Testpersoon Tine Coord. 390×844, kort 1920×900.

## Eerlijk: wat niet echt geklikt is

- **Echte muisklikken en echt typen:** alleen Bericht aan kantoor (Meer openen, leeg versturen, tekst typen, versturen). Bij de zoekopdracht kreeg de muisklik geen uitvoering (mijn fout: nog geen schermafdruk), dus dat typen kwam nergens terecht.
- **Al de rest:** `element.click()` in de echte pagina met de echte handlers.
- **Netfout:** nagebootst met een falende `fetch`, alleen bij afvinken.
- **Foto:** synthetisch PNG.
- **`POST /api/tekorten/6445/binnen`:** mijn eerste poging via de API (2 stuks) werkte niet. Het script werd afgekapt door mijn eigen herladen, dus de reden ken ik niet. In het scherm lukte het daarna wel.
- **Testdata via kantoor-API:** bakken, tellingen, keuring, voorraad, aanvragen, rit, sportset. De keuze van kantoor is dus niet in Nakijken geklikt.
- **Niet gedaan:** Afdrukken, Export, Uitloggen, de knop tel: echt bellen (alleen de `href`), de kaartlink volgen, "Aanvullen uit voorraad" bij voorraad 0 aanklikken, verversbalk op de rit (hoort bij chauffeur, niet opnieuw getest), echte terugknop op de rit. De verhuistaak staat voor 3/11 maar zat op een rit van 31/10.
- **Knopmaat:** gemeten op de hoofdschermen, niet op elk venster.

## Hertest T3

| T3 | Onderwerp | Nu | Wat ik zag |
|---|---|---|---|
| G1 | Waar staat een bak | **weg** | `CO01`: "Rozenweg · rek C", rit #22 op 2026-10-31 om 14:00 |
| G2 | Contacten, kantoor | **deels** | Bel kantoor `tel:016123456`; zonder nummer "Geen kantoornummer ingesteld"; bericht komt aan. Locaties: 28 gezocht, 26 met adres, 0 met telefoon in de testdata |
| G3 | Melding houdt bak tegen | **weg** | "1 melding ligt bij kantoor en houdt "Bak klaar" niet tegen."; "Bak CO01 klaar (5/5)" kon, met open melding |
| G4 | Netfout stil | **weg** | "Geen verbinding, niet bewaard. Probeer het zo opnieuw."; voorraad bleef 20 |
| G5 | Tekorten tegen Aanvullen | **deels** | Tekst "nu al afvinkbaar" staat er nog terwijl Aanvullen "wacht op levering" zegt; knop op Aanvullen ontbreekt (N1) |
| G6 | Catalogus-link | **weg** | Link staat niet meer in het Tekorten-detail |
| G7 | Losse melding als bak | **weg** | Eigen blok "LOSSE MELDINGEN EN AANVRAGEN", "in 1 bak" |
| G8 | Printlijst 390 | **weg** | scrollWidth 390, "‹ Terug naar Aanvullen" naar `/aanvullen`, knoppen 44 px, "3 handelingen" bij 3 rijen |
| G9 | `PUT` met `wie` geeft 500 | niet hertest | Verslag TF6: niet aangeraakt. Niet gecontroleerd in TF5 |
| G10 | Lossen vóór aankomst, open bak laden | **deels** | Lossen zonder laden: venster "Toch lossen", aankomst volgt. Een bak met open handelingen laden kan nog zonder waarschuwing |
| G11 | Melding aan jezelf | **weg** | "Tine Coord: Bestelling binnen: 3 × Veer (3 van 5)" staat bij kantoor, niet bij Tine |
| G12 | Toasts over knoppen | **deels** | Aanvullen: bovenaan (TF6, niet opgemeten). Rit: toast ligt nog onderaan en blijft staan over een ander scherm (N4) |
| G13 | Deelaantal | **weg** | "✓ Krijt × 5" en "✓ Veer × 5" |
| G14 | Tab bij Tekorten | **nog aanwezig** | Meer licht op; `/zoeken` idem. Geen eigen kop of terug naar Meer |
| Twijfel | Rit zonder klaarzetten | **weg** | TF5, in deze ronde klaargezet gebruikt |
| Twijfel | Bak klaar | **nog aanwezig** | Alleen de toast; kaart blijft "5 van 5 klaar" |

**ONDUIDELIJK uit T3**

| Punt | Nu |
|---|---|
| Hint Meer "Alles wat op de desktop kan…" | weg |
| Bestellen naast Besteld | nog aanwezig |
| "Er is genoeg voorraad" | nog aanwezig |
| "uit pool" naast Rozenweg | nog aanwezig |
| Adres leest alsof het van de bron is | nog aanwezig: "van Abdijschool Vlierbeek · Pastoor Pitetlaan 30" is Betekom |
| Stand "gekeurd", "gemeld door KV" | nog aanwezig |
| ⚠ zonder tekst naast "Kapot of weg melden" | nog aanwezig |

## Per scenario

### Meer en opzoeken: GROEN
- Bak, artikel, locatie geven juiste data. 1920: geen horizontale scroll.
- Krijt: "Rozenweg: 13", "In bak: Verkeerskoffer 1, … CO01, …".
- Bericht: leeg geeft "Schrijf eerst een korte tekst"; daarna "Verstuurd naar kantoor". Bij kantoor: "Tine Coord: T4 sleutel Abdij ligt niet op zijn plaats", één keer.
- Geen schrijfknop op deze schermen. API: `PUT /api/bakken/1`, `DELETE /api/locaties/7`, `PUT /api/catalogus/1/voorraad`, `POST /api/meldingen`, `PUT /api/aanvragen/1/status`, `POST /api/ritten/22/klaarzet-terug`: alle 403.
- **Genoeg voor een werkdag?** Ja, als kantoor telefoonnummers invult. Ontbreekt nog: wat er deze week op een locatie staat.

### Aanvullen en voorraad: DEELS (alleen door N1)

| Stap | Voorraad Rozenweg | Tekst |
|---|---|---|
| Start | Springtouw 20, Krijt 20, Pion 20, Hoepel 20, Veer geen | "6 handelingen in 1 bak" |
| Netfout Springtouw | 20 | "Geen verbinding, niet bewaard…" |
| Springtouw dubbel getikt | 16 (één keer) | "Springtouw aangevuld" |
| Krijt 3 van 5 | 17 | "3 aangevuld, 2 blijven open" |
| Krijt 9 ingevuld bij rest 2 | 15 | Stil afgetopt op 2 |
| Krijt rest terugzetten, opnieuw | 17, dan 15 | Alleen de laatste 2 terug |
| Pion met foto | 18 | "Pion aangevuld" |
| Hoepel na uit voorraad (Tekorten) | 16 | "Hoepel aangevuld" |
| Veer 3 van 5 binnen, afvinken | Veer 3 → 0 | "Veer × 2", "3 van 5 gedaan" |
| Veer rest binnen, afvinken | Veer 2 → 0 | "✓ Veer × 5" |
| Aanvraag Krijt × 2 (goedgekeurd) | 13 | "uit de pool · gevraagd door KV" |

Eindstand 16 / 13 / 18 / 16 / 0: klopt met wat werd afgevinkt. Geen enkele dubbele wijziging gezien.

### Tekorten: GROEN
- Binnen: 7 geeft "Er is nog maar 5 te verwachten (besteld 5, al binnen 0)."; 0 geeft "Vul in hoeveel er binnen is"; 3 dubbel getikt telt één keer: "3 van 5 binnen — voorraad Rozenweg verhoogd".
- Tweede keer: "Er is al 3 van 5 binnen. Hoeveel kwam er nu bij?", standaard 2. Daarna knop uit.
- Aanvraag zonder artikel (ballonnen): kantoor en coördinator krijgen melding; lijst en `zonder-artikel` niet voor de coördinator (403).

### Verhuistaak en rit: DEELS
- Laden, aangekomen, lossen, "Toch lossen", tweede tik "Staat al op geladen / Ongedaan maken": werkt. Geen knop onder 44 px.
- Verhuistaak: "Archery tag (A) van Abdijschool Vlierbeek → Betekom, vóór wo 4/11 · 1 stuk". Database: set A op Betekom, taken 198 en 199 `gedaan`, rit `gedaan`, bak CO01 `op_locatie` 29.
- Deels door N2, N3, N5.

### Tellers: DEELS
Vandaag "1 bak · 3 handelingen" (open), Aanvullen "6 handelingen in 1 bak" (alles). Bakken gelijk, handelingen niet (N6).

## GEVONDEN

**BLOKKEERT:** geen.

**HINDERLIJK**

1. **N1, NIEUW. "Aanvullen uit voorraad" verschijnt nooit op Aanvullen.** 390. Verwacht: knop bij Hoepel (API: `uit_voorraad_mogelijk:true`, voorraad 20). Gezien: alleen ⏳ en ⚠. `aanvullen.js:90` leest de rol uit `sporty-auth-user`; dat bestaat niet (localStorage: `sporty-rol`, `sporty-laatste-gebruiker`, `sporty-auth-token`) en geen enkel bestand zet het. Stappen: login als coördinator, bak met bestelling en genoeg voorraad openen. Omweg: Tekorten › Aanvullen uit voorraad werkt. Zelfde sleutel in `aanvullen.js:171` en `nakijken.js:287`.
2. **N2, NIEUW. Set op een kamp staat onder "Laden in Rozenweg".** Rit, 390. Verwacht: alleen wat in de Rozenweg ligt. Gezien: "Archery tag A" in dat blok, terwijl de set van Abdijschool komt. "Alles geladen" tikt hem mee. Stappen: rit met levering uit Rozenweg en een sportverhuis, blok openen.
3. **N3, NIEUW. Ongedaan maken na de laatste stop.** Rit, 390. Verwacht: niet aangeboden, of de stop gaat open. Gezien: rit en stop `gedaan`, regels gelost 1/3, toast "✓ Ongedaan gemaakt", knop "✓ Stop afgerond". Stappen: laatste "Alles gelost", dan Ongedaan maken.
4. **N5, NIEUW. Aantallen in "Alles" spreken elkaar tegen.** Rit, 390. Knop "Alles geladen (3)", venster "Alles gelost: 3 stuks?", toast "Gelost: 2 stuks" bij dezelfde twee Blazer-regels van 1 + 2. Laadblok zegt 4 stuks.
5. **G5 rest.** Tekorten-detail. "1 handeling (CO01) nu al afvinkbaar (uit voorraad)" vóór de klik, terwijl Aanvullen "wacht op levering" toont.
6. **N6, NIEUW. Tellers.** Vandaag telt open handelingen, Aanvullen alle. Eindstand: Vandaag open 0, Aanvullen "6 handelingen".

**COSMETISCH**

7. **N4, NIEUW.** Rit: de toast "Ongedaan maken" blijft 6 s staan over het volgende scherm, onderaan boven de knoppen; je kan zo iets ongedaan maken van een stop die je al verliet.
8. **N7, NIEUW.** Rit, dagscherm: "📞 Bel kantoor" donkerblauw op donkerblauw, slecht leesbaar; in de tekst plakt hij aan "🔔 3 meldingen".
9. **N8, NIEUW.** Bericht aan kantoor: venster opent zonder cursor in het tekstvak. Typen gaat verloren tot je tikt.
10. **N9, NIEUW.** Artikelen: zoeken op "hoepel" toont ook een rij "INFO: kamp draait op het Sporty-bewegingslandschap…". Geen artikel.
11. **N10, NIEUW.** Blok heet "Zonder bak" in de lijst en "Losse melding" in het detail; "vertrekt vandaag" bij een aanvraag.
12. **G14** nog aanwezig.
13. **N11, NIEUW.** Krijt: 9 invullen bij rest 2 wordt zonder melding 2.

**Twijfel**

- Tekorten biedt "Aanvullen uit voorraad" ook bij Rozenweg 0, met "Na aanvullen -5 · onder minimum". Niet aangeklikt.
- "Bak klaar" verandert niets in de data die ik kan zien.
- Een verhuistaak voor 3/11 kan op een rit van vandaag; de stop toont dan "vóór wo 4/11". Bewust of niet?

## ONDUIDELIJK VOOR DEZE ROL

- De punten met "nog aanwezig" in de tabel hierboven.
- "Alles geladen (3)": drie regels of drie stuks?
- "Deze stop" boven "Alles gelost": er staat ook al een rek-kop met "Alles geladen"; welke eerst?
- Bak "5 van 5 klaar" terwijl er een melding bij kantoor ligt: is de bak nu goed om mee te geven?
