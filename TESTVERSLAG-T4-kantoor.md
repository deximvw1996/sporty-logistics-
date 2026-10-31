# TESTVERSLAG T4: rol kantoor en algemeen, na TF5 en TF6 (1920×900 en 390×844)

**Kan kantoor morgen zijn werk doen? Op een draaiende server wel, maar nog niet veilig na een deploy.**
1. Elke herstart (deploy, terugzetten) geeft elke taak zonder rit stil een eigen rit zonder bestuurder (G1, BLOKKEERT). Vóór de deploy naar prod bekijken.
2. Vandaag verstopt "nog geen levering gepland" onder "Later", ook als het kamp over 2 dagen start (G2).
3. Een onbesliste melding is na afronden moeilijk terug te vinden (G3); bij tekort én kapot blijft een deel onbehandeld (G4).
4. Taak of kampmoment weghalen laat werk op de aanvullijst staan (G5, G6). De rest van de week werkt: Genereer, Taken, ritten, aanvragen, deels binnen, terugzetten.

Getest op 31/10/2026 vanaf 10:51, op `origin/main` 5f9f743, lokaal op 3306 met een verse kopie van `herfst-test.db`, `APP_PASSWORD` leeg. Niets op prod.

## Hertest T3

| # | Stand | Gezien |
|---|---|---|
| N1 Taken toont niets | **Weg** | "Je ziet week 26 okt – 1 nov" + "Alles tonen"; alle 7 taken zichtbaar, ook 30/10. Toast "Bekijk in Taken ›" |
| N2 Vandaag mengt | **Deels** | Kolommen rustig, "Later deze periode · 7" ingeklapt; zie G2 |
| N3 tekort én kapot | **Deels** | Alle acties staan er; zie G4 |
| N4 einde vóór start | **Deels** | Niet opnieuw in het scherm geklikt; API aanvaardt het nog (200, "2026-12-20" tot "2026-12-01") |
| N5 Meldingen desktop | **Weg** | "🔔 Meldingen" in de balk met teller |
| N6 vertrek 09:00, stop 17:00 | **Niet opnieuw getest** | Niet aangepakt volgens TF6 |
| N7 uitnodigen | **Niet in de browser herhaald** | Volgens TF6 in het detail |
| N8 raster locatie × week | **Nog aanwezig** | Niet gebouwd; ontwerpvraag |
| N9 Bak openen | **Niet getest** | |
| N10 sportrooster | **Niet opnieuw getest** | |
| N11 bakken/stuks | **Nog aanwezig** | Zie G7 |
| N12 teksten | **Deels** | "1 rit" goed, "1 handeling … wordt"; zie COSMETISCH |
| N13 historiek kampmoment | **Niet opnieuw getest** | Niet aangepakt volgens TF6 |
| N14 themakeuze | **Niet opnieuw getest** | |
| N15 tikken per taak | **Weg** | Lijst "Nog te plannen" blijft staan na rit en koppelen |
| N16 tweede kampmoment | **Niet opnieuw getest** | Niet aangepakt volgens TF6 |
| N17 uit pool bij voorraad 0 | **Niet opnieuw getest** | Ongewijzigd volgens TF6 |
| N18 chip, kiezer, 38 px | **Nog aanwezig** | Periodekiezer 18 px, zoekveld gsm 38 px op 11 schermen |
| ONDUIDELIJK Bestellen/Besteld | **Nog aanwezig** | Beide knoppen op hetzelfde scherm |
| ONDUIDELIJK Periode actief | **Nog aanwezig** | Niet opgehelderd |
| ONDUIDELIJK Nakijken op Vandaag | **Weg** | Heet nu "Controles" |
| ONDUIDELIJK "🔒 vast", "Conflict" | **Nog aanwezig** | |
| ONDUIDELIJK bakken/stuks | **Nog aanwezig** | G7 |
| ONDUIDELIJK levering buiten periode | **Weg** | Staat bij "Alle taken" |

## Per scenario

**Genereer → Taken → Ritplanning → Klaarzetten: GROEN op een draaiende server.** "✓ 4 taken aangemaakt voor 2 kampmomenten · Bekijk in Taken ›". Ritplanning vr 30: "2 open"; rit #22 gemaakt, twee taken gekoppeld met muisklikken. Vóór klaarzetten geeft de rit-link `niet_klaargezet:true`, na klaarzetten de stops. De levering op 30/10 ligt al in het verleden; daar is geen waarschuwing voor (G8).

**Rit terugzetten: bekend zonder knop.** Via API 200; rit-link weer `niet_klaargezet`; laden via de link 409; opnieuw klaarzetten 200.

**Vandaag: DEELS.** Met 3 aanvragen en 1 telling: Beslissen 3, Controles 1; dat is meteen duidelijk. Zie G2 voor wat onder Later zit. Gsm: "1 ding vandaag" boven "Controles · 4" en "8 meldingen", met de EHBO-melding naast de telling.

**Nakijken, eerdere tellingen: DEELS.** Desktop: "Politiepak · laatste: 1 · 2 eerder", openklappen toont "geteld 0 · weg" tweemaal. Elk stuk krijgt ook "2 eerder" als niets wijzigde (G9). Gsm: geen uitklap (G10).

**Tekort én kapot: DEELS.** Zie G4.

**Onbesliste melding: DEELS.** Toast: "✓ Keuring afgerond · 1 bestelling(en) · let op: 1 gemelde regel(s) wachten nog op jouw besluit". Zie G3.

**Goedgekeurde aanvraag: GROEN.**
- Met voorraad: Pompons (7 op voorraad) → "uit voorraad", op de aanvullijst, taak #202.
- Zonder voorraad: Bellenblaas → "te bestellen", taak #200, KV-tekst "Goedgekeurd — het stuk wordt besteld en daarna geleverd."
- Niet herkend: "Papieren vliegtuig" → blok "Aanvragen zonder artikel", "Kies artikel"; zonder aantal "Vul een aantal in"; daarna "Gekoppeld: te bestellen". Layout en aantal: G11.
- Taak weghalen: zie G5.

**Bestelling 3 van 5 binnen: GROEN.** Voorraad 0 → 3, "3 van 5 binnen"; 9 geweigerd: "Er is nog maar 2 te verwachten (besteld 5, al binnen 3)". Standaard daarna 2. De slotstap (2 erbij) ging in mijn script mis door een fout in mijn eigen uitleesregel; ik heb de stand 5 van 5 niet teruggelezen.

**Capaciteit: DEELS, zie G7.** Rit met 14 + 36 stuks toont "20/40 bakken"; klaarzetten zonder waarschuwing.

**Back-up en terugzetten: GROEN op het herstel, zie G1 voor de bijwerking.** Back-up 1.146.880 bytes met 69 versies en 3 verstuurd. Natelling erna, terugzetten: 200, "Database vervangen — server herstart nu". Na herstart: 69 en 3, de natelling van na de back-up is weg uit de actieve db (verwacht; de `sporty-hand-…`-kopie staat in de map). Triggers staan er nog: `delete` geweigerd met "Tellingen zijn onwisbaar". Historiek in Nakijken klopt na herstel. Lokaal stopt de server en moest ik hem zelf starten.

**Kampmoment verwijderen: DEELS.** "✓ 1 verwijderd"; taken 7 → 3, KV-data 403, tekorten 5 → 0, nakijken-tellers 0. Blijft staan: zie G6.

**Elke link: GROEN.** 24 pagina's op 2 breedtes in iframes: geen doorsturing, geen `/` of `/#`-links, geen horizontale scroll. Alle links uit de balken en Meer verzameld; ze horen bij deze 24 pagina's. In de startstand.

## Eerlijk: wat niet echt geklikt is

- **Muisklik:** Genereer, Later uitklappen, rit maken, taak aan rit, Nakijken openen, afronden, Goedkeuren, Kies artikel, koppelen, typen.
- **`element.click()` of script:** acties in Nakijken, besteld en binnen, taak verwijderen, kampmoment verwijderen, Alles tonen.
- **API:** KV-telling en natellingen, aanvragen indienen, gemelde regel, **klaarzetten van rit #22** en terugzetten, **back-up terugzetten** (geen bestand gekozen in het scherm, de waarschuwing dus niet gezien).
- **Niet getest:** terugknop, netwerk uit, verschillende scherm-T3-nummers in de tabel, sportrooster, voertuigen, Bak klaar, gsm-keuren helemaal doorlopen, knop "Aanvullen uit voorraad".
- Gsm is browser-emulatie.

## GEVONDEN

### BLOKKEERT

**G1. NIEUW. Elke herstart maakt ritten zonder bestuurder.** Server, alle schermen. Verwacht: taken zonder rit blijven zonder rit. Gezien: taak #203 aangemaakt met `rit null`, gewone herstart, daarna `rit 27`. Log: "Migratie 14: 1 ritten aangemaakt (backfill)". Na terugzetten ook: "4 ritten aangemaakt", #198 en #199 gingen van "— zonder rit" naar rit #23 en #24, zonder bestuurder of voertuig.
Oorzaak: `lib/migraties.js:202` draait zonder `app_vlaggen`-gate op elke start. Gevolg: na elke deploy zijn "Zonder rit" en "Nog te plannen" leeg, dus kantoor denkt dat alles gepland is; en de chauffeur ziet niets. Stappen: maak een taak met datum zonder rit, herstart, lees `/api/transport-taken`. Bestaat wellicht al lang; T3 zag het niet omdat ik toen niet herstartte.

### HINDERLIJK

**G2. Ontbrekende levering telt als "later".** `/vandaag`, 1920, za 31/10, kamp start ma 2/11. Verwacht: bovenaan. Gezien: de drie kolommen "Niets…", en "nog geen levering gepland" pas onder "Later deze periode · 7". NIEUW als gevolg van de N2-fix.

**G3. NIEUW. Onbesliste melding verdwijnt uit het standaardzicht.** Nakijken, 1920 en 390. Na afronden: chips "Te keuren 0", "Gemeld 0", "Niets in deze filter", terwijl Vandaag "1 telling te keuren" zegt en "Open" daarheen leidt. Terugvinden via "Nagekeken". Het vak toont ook "Bestellen" als keuze bij Post-it's, terwijl dat niet opgeslagen is. Stappen: meld iets op een bak in keuring, rond af.

**G4. Tekort én kapot: aantal klopt niet vooraf, en één deel blijft over.** Nakijken, 1920. Kaartjes: hoort 56, geteld 52, kapot 2. Keuze "Afschrijven (4) + bestellen", verstuurd `kantoor_aantal:4`. Na afronden staat er "Afschrijven (2) + bestellen", aanvullijst 2, tekort 2. De overige 2 van het tekort krijgen geen actie (TF6 noemt die beperking). Wc-rolletjes "Herstellen" 4 vooraf, 1 na afronden. De labels "· 2 tekort" uit TF6 zag ik niet.

**G5. NIEUW. Taak weghalen laat de regel staan.** Taken, 1920. #202 (Pompons) verwijderd: "1 taken verwijderd". Pompons blijft op de aanvullijst (`uit_pool`, 3) en de KV ziet nog "goedgekeurd… het stuk komt". Verwacht: aanvullijst weg of een vraag. Verwijderen staat bovendien alleen achter het vinkje, niet in het detail.

**G6. NIEUW. Verwijderd kampmoment laat werk achter.** Na verwijderen Betekom: aanvullijst blijft "totaal 6, losse 3" met regels voor die locatie; aanvragen blijven 3; lege ritten #23 en #25 blijven in de lijst. Rit #22 houdt zijn bestuurder.

**G7. Capaciteit zegt te weinig.** Ritplanning, 1920. Elke bulkregel telt 1: "17 × Kleuterfiets", "5 × Loopwagen" samen 2 plaatsen; rit 50 stuks = "20/40 bakken". Mijn oordeel: 50 fietsen op 1 plaats geeft nooit een waarschuwing, dus een echt overvolle camion zie je niet. Een echte regel van 50 is hetzelfde. Naast elkaar staan "14 stuks", "14 bakken" en "levering 14" voor hetzelfde.

**G8. NIEUW. Levering in het verleden zonder waarschuwing.** Genereren op za 31/10 maakt levering op vr 30/10, ook te plannen zonder melding.

**G9. NIEUW. Natelling-melding met schijnwijzigingen.** Melding: "Telling bijgewerkt · Betekom: F40: Politiepak 0 → 1 · F40: Kaartjes verkeer klein 52 → 52 · F40: Wc-rolletjes 28 → 28". Ook "2 eerder" bij ongewijzigde stukken. Deels mogelijk door mijn API-aanroep die alle regels en de foto opnieuw stuurde; via het KV-scherm niet geprobeerd.

**G10. Geen "Eerdere tellingen" op gsm.** Nakijken, 390: 0 keer de tekst. Bekend uit TF5.

**G11. NIEUW. Blok "Aanvragen zonder artikel" breekt de filterbalk.** Tekorten, 1920: smal blok naast het zoekveld, dat tot enkele letters krimpt, 4 regels tekst in een smalle kolom. Het aantal uit de aanvraag (3) staat niet ingevuld.

**G12. NIEUW. "vertrekt vandaag" klopt niet.** Aanvullen, 1920: rood "vertrekt vandaag" op de bak en elke losse aanvraag op 31/10, terwijl de leveringen op 30/10 en 2/11 staan. Oorzaak niet nagegaan.

**G13. Periode: API weigert einde vóór start niet.** Zie N4. TF6 meldde het.

**G14. `PUT /api/transport-taken/:id` met enkel `wie` geeft 500.** TF6-G9, nog aanwezig.

### COSMETISCH

**G15. NIEUW.** Tekorten-detail bij een aanvraag: "KV Claude (API)" in plaats van de KV. "0 bakken" onder het artikel.
**G16. NIEUW.** "Alles tonen" op Taken overlapt de koprij. Losse aanvragen op Aanvullen heten alle drie "Zonder bak".
**G17.** "bestelling(en)", "regel(s)", "1 taken verwijderd". Gsm "1 ding vandaag" boven "Controles · 4".
**G18. NIEUW, twijfel.** `Migratie 47: 11 materiaalrijen gekoppeld` draait ook bij de eerste herstart na terugzetten. Niet onderzocht of dit iets wijzigt.

## ONDUIDELIJK VOOR DEZE ROL

- "Bestellen" en "Besteld" naast elkaar.
- "Later deze periode": hoe weet ik dat niets dringends erin zit?
- "Periode" in de balk: alleen mijn zicht of voor iedereen?
- "1 telling te keuren" op Vandaag terwijl Nakijken "Te keuren 0" toont.
- "n bakken" terwijl er fietsen en stuks op staan.
- "🔒 vast", "Conflict".
