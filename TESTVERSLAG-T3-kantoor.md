# TESTVERSLAG T3: rol kantoor en algemeen (1920×900 en 390×844)

**Kan kantoor morgen zijn werk doen? Op desktop ja, met omwegen.** Ik vond geen harde blokkade; de T2-blokkers G1, G2, G3 en G14 zijn weg, G4 is niet in zijn exacte pad herhaald.
1. Taken toont na "Genereer" 0 taken: leveringen vind je alleen via Ritplanning (N1).
2. Op Vandaag verdringen planningswaarschuwingen wat echt dringend is (N2).
3. Een regel met tekort én kapot biedt geen keuze voor het kapotte stuk (N3).
4. Personeel, Kampmomenten en Bakken blijven op gsm afgesneden tabellen (T2-G18, besluit ligt er).

Getest op 31/10/2026 vanaf 00:58, op `origin/main` 44fab81, lokaal op 3306 met een kopie van `herfst-test.db`, `APP_PASSWORD` leeg. Niets op prod.

## Eerlijk: wat niet echt geklikt is

- **Klikken:** deels echte muisklik, meestal `element.click()` en velden gezet via script. Geen vinger op een toestel; de gsm is browser-emulatie.
- **Via API, niet via knop:** KV-telling (test-data, en mijn script gaf per stuk verwacht 1 door, vandaar "tekort 448"), goedkeuren van de aanvraag, kapot melden, pincodes van testpersonen, tweede rit, verplaatsen van die rit.
- **Meting van 25 pagina's per breedte** gebeurde in een iframe van die breedte, in de beginstand.
- **Niet getest:** netwerk uit, terugknop, herladen midden in werk, dubbel tikken in de praktijk (behalve een dubbele dialoog door mijn script), Wissel daadwerkelijk uitvoeren (dialoog wel geopend), onderhoud plannen, back-up terugzetten, back-up via de knop downloaden (API gaf 200, 1,1 MB), export- en importknoppen, Thema's, Pool en Catalogus verder dan laden, mockups vergelijken, "Bak klaar" tot het einde (één regel bleef bewust open).
- **Vergelijking met de oude app:** alleen op de sectielijst van `index.html` en de Seizoensoverzicht-code, niet functie per functie.

## Per scenario

**Periode en rooster: DEELS.** Nieuwe periode met twee weken, actief gezet, drie kampmomenten. "Naam, start en einde zijn verplicht" werkt. Einde vóór start wordt aanvaard (N4).

**Dubbel, herhaald, gesloten: GROEN.** Week 1: "⚠ Dubbel 1", "◐ Gedeeld 3". Seizoen: "Betekom + Abdij ⚠", "Betekom ↻", "Herhaald 1". Gesloten dag 11/11: "alle locaties dicht", API `gesloten:2`. Een thema dat elders staat kiezen mag ("— staat al in Abdijschool Vlierbeek"), nooit een verbod.

**Gedeeld materiaal: GROEN op lezen.** Rooster: "Klein springkasteel - jungle: 2 nodig, 1 bak". Pagina geladen, niets gewijzigd.

**Sportrooster: DEELS.** Archery tag ingepland op Abdijschool: totaal 1/2, geen verhuis. De tekst verwijst naar een knop die pas na het kiezen van een sport bestaat (N10). Te weinig sets en Toepassen niet opnieuw getest.

**Ritten maken en klaarzetten: DEELS.** Genereren: "✓ 4 taken aangemaakt voor 3 kampmomenten"; Betekom week 1→2 met hetzelfde thema krijgt terecht geen tussenrit. Rit #22: 2 stops, "Klaargezet ✓", rit-link met Kopieer. Taken-scherm zie N1.

**Ritmeldingen: GROEN op wat ik nalas.**
- "volgorde van de stops aangepast, stop van de rit gehaald" (samengevoegd).
- Oude bestuurder: "rijd je niet meer: een andere bestuurder neemt ze over"; nieuwe: "is aan jou toegewezen".
- Klaarzetten rit #23 (API): "staat voor je klaar". Bij rit #22 (via knop, vóór de bestuurder een pincode had) las ik die melding niet terug: twijfel.

**Voertuigen: GROEN op toevoegen.** Nieuw voertuig opgeslagen, weekbeeld correct.

**Personeel en uitnodigen: DEELS.** Aanmaken werkt. De uitnodiging staat alleen achter het vinkje in de lijst (N7). Tekst: "Hallo Jeroen, open http://localhost:3306/ op je gsm, kies je naam…".

**KV-links: GROEN.** "1 KV-link klaar", met Kopieer; zonder KV: "Koppel eerst een kampverantwoordelijke".

**Nakijken: DEELS.** Rij 46 px, `scrollHeight` 900. Acties bestellen, uit pool, aanvaarden, naar pool en laten staan gezet; afronden: "✓ Keuring afgerond · 2 bestelling(en)", voorraad ongewijzigd. Afschrijven en herstellen kon ik niet kiezen (N3).

**Bestellen en binnen: GROEN.** Kaartjes: besteld 55, "Bestelling binnen — voorraad Rozenweg verhoogd" → 55, afvinken → 0. Geen dubbele daling. Fluitje naar pool: 0 → 2. Deels binnen bestaat nog niet (G13).

**Vandaag en Meldingen: DEELS.** Zie N2 en N5. Na een kapot-melding: `te_keuren` 0 → 1, "1 telling te keuren".

**Beheer en back-up: DEELS.** Scherm toont cijfers en bestand, API 200. Rest: zie hierboven.

**Elke link: GROEN op bereikbaarheid.** 25 pagina's op 2 breedtes: geen doorsturing en geen `/` of `/#`-links in de startstand. `scrollWidth` nooit breder dan het venster, behalve `/etiketten` (794) en `/aanvullijst-print` (393) op 390. Elementen buiten beeld op gsm: `/bakken` 3883, `/logboek` 551, `/personeel` 116, `/kampmomenten` 33 (afgesneden, zie G18). Te kleine velden: zoekveld 38 px op de meeste gsm-schermen, 5 elementen op logboek.

**Rechten en URL's: GROEN.** Chauffeur op thema's, locaties, kampmomenten, ritten, back-up, personeel: 403 (met niet-bestaande id's, dus geen effect). Anoniem `/API/themas` 401. `/index.html`, `/server.js`, `/sporty.db`, onbekende URL: 404. Zwakke eigen pincode: geweigerd. `server.log` bevat 0 regels met "error".

**Vind je wat vandaag dringend is? DEELS.** De aanvraag staat goed bovenaan in Beslissen, maar de rest is ruis (N2).

**Oude app: DEELS.** Kaart bestaat (`/locaties?zicht=kaart`, geladen). Niet teruggevonden: Seizoensoverzicht als raster locatie × week (N8). Andere secties (kampplanner, transport-noden, transporten, materiaal) hebben een opvolger per onderdeel; volledigheid niet nagegaan.

## Hertest T2 per nummer

| # | Stand |
|---|---|
| G1 rechten | **Weg** (steekproef 6 schrijf- en leesroutes, 403) |
| G2 Nakijken desktop | **Weg** |
| G3 login desktop | **Weg**: `/` → `/login?terug=%2Fvandaag` |
| G4 vastgelopen bak | **Niet in exact pad herhaald**; gewone route besteld/binnen werkt |
| G5 ritmeldingen | **Weg** voor wissel en ontkoppelen; stop toevoegen niet teruggelezen |
| G6 nieuwe bestuurder | **Weg** |
| G7 goedgekeurde aanvraag | **Nog aanwezig** (besluit ligt er): stoepkrijt niet op aanvullijst, niet in tekorten |
| G8 themakeuze | **Weg** |
| G9 Wissel | **Weg**: bij elk thema; dialoog geopend |
| G10 gesloten dag | **Weg** |
| G11 terug naar pool | **Weg**: 0 → 2 |
| G12 bestuurder desktop | **Weg** |
| G13 deels binnen | **Nog aanwezig** (besluit ligt er) |
| G14 heropende keuring | **Weg** |
| G15 dode links Vandaag | **Weg**; "Bak openen" zie N9 |
| G16 printlijst | **Weg**: 2 regels, "2 handelingen" |
| G17 Nakijken-console | **Weg op zicht**: "Periode: Herfst TEST" staat er; ik zag wel losse 401/404/409-regels in de sessie, niet per pagina toegewezen |
| G18 gsm-tabellen | **Nog aanwezig** (besluit ligt er) |
| G19 rit-link | **Weg** |
| G20 kop rit-link | **Twijfel**: zie N11 |
| G21 dubbele rij | Code gewijzigd, niet opnieuw getest |
| G22 oude meldingstekst | Niet opnieuw getest |
| G23 / G31 doorsturing | Niet opnieuw getest (rol chauffeur, chat B) |
| G24, G25, G26 | Niet opnieuw getest (aanvuller, chat C) |
| G27 pincode | **Deels**: zwak geweigerd; toetsenblok niet doorgeklikt |
| G28 klaarzetten melding | **Weg** op rit #23; zie twijfel hierboven |
| G29 teksten | **Deels**: zie N12 |
| G30 Klaarzetten/Goedkeuren | Desktop goed, gsm niet bekeken |
| G32 weekend gsm | Niet opnieuw getest |
| G33 chauffeur desktop | Niet opnieuw getest (chat B) |
| T1-G6 stoptijd | **Schuift mee** (17:00 → 18:15 bij 09:00 → 10:15), maar zie N6 |

## GEVONDEN

### BLOKKEERT
Geen.

### HINDERLIJK

**N1. Taken toont gegenereerde taken niet.** `/taken`, 1920. Verwacht: de 4 taken van de toast, die zegt dat ze in Transport › Taken staan. Gezien: "Geen taken voor deze filter", alle tellers 0. Met `?alle=1` (geen knop gevonden) 2 van de 4: de leveringen van 6/11 vallen vóór de periode en ontbreken. Stappen: periode 9–22/11, Genereer transport, open Taken. Ritplanning vr 6/11 toont ze wel als "2 open", maar opent op de huidige week.

**N2. Vandaag mengt planning met dringend.** `/vandaag`, beide breedtes. Kop: "alleen wat vandaag of deze week moet". Gezien op gsm: "1 ding vandaag" en "Nakijken · 8", met eerst "nog geen levering gepland" voor volgende week. Op desktop lang kolomscrollen; een telling te keuren staat tussen die regels. Deels testdata ("99× EHBO-Koffer").

**N3. Tekort én kapot op één regel: geen keuze voor kapot.** Nakijken, 1920. "Kaartjes verkeer klein 📷", 1 geteld, 1 kapot, hoort 56: alleen bestellen, uit pool, aanvaarden. Verwacht ook afschrijven of herstellen. Mijn testdata is extreem, de combinatie is realistisch. Afschrijven heb ik daardoor nergens kunnen kiezen.

**N4. Periode met einde vóór start aanvaard.** Periodes, 1920. Start 22/11, einde 9/11: opgeslagen als "22/11 – 9/11", 1 week, zonder fout. Rechtzetten via Bewerken lukt.

**N5. Meldingen op desktop verstopt.** Geen item in de bovenbalk; enkel "alles ›" op Vandaag. Op een andere pagina zie je niet dat er iets nieuw is.

**N6. Rit met vertrek 09:00 en eerste stop 17:00.** Een ophaling (standaard 17:00) op een rit van 09:00: de tijden botsen zonder waarschuwing. API-rit #23. Dit verklaart wellicht T1-G6.

**N7. Uitnodigen niet bij de persoon.** Personeel, 1920. Toast: "stuur nu een pincode-uitnodiging", maar het detail heeft alleen Bewerken, Pincode resetten, Deactiveren, Rol wijzigen. De knop verschijnt pas na een vinkje in de lijst.

**N8. Geen raster locatie × week.** De oude Seizoensoverzicht-sectie toonde "alle locaties per week". Rooster › Seizoen is per thema, "Hele periode" per locatie apart. Past bij `Werking Sporty.txt`, waar kantoor per week per locatie denkt.

**N9. `/bakken?bak=11937` opent geen detail.** 1920, "Kies…" blijft leeg. Het kan aan mijn id liggen (vaste bak uit de rit-data). "Bak openen" in Nakijken zelf niet geklikt.

**N10. Sportrooster verwijst naar een onzichtbare knop.** "Kies "Alle" of "+ Inplannen"", maar die knop verschijnt pas na het kiezen van een sport. De link `?zicht=seizoen` opent de weekweergave.

**N11. Aantallen rit verschillen.** Ritplanning "26/40 bakken" (14 + 12), rit-link-data `stuks: 18`. Na ontkoppelen geeft de KV-pagina nog 09:45 als levertijd tot de taak opnieuw gepland is. Eenheid onduidelijk: twijfel.

**N13. Historiek van een nieuw kampmoment toont oude gebeurtenissen.** Kampmomenten: "Historiek 13" op een net gemaakt moment, met regels van 02/08 en "Week 199". Het filtert op locatie en week, niet op periode.

**N14. Themakeuze zonder zoekveld.** Lijst van ongeveer 180 vinkjes. "Holderdebolder (themadag)" staat bovenaan, het gewone thema onderaan omdat het elders staat; ik koos daardoor zelf fout.

**N15. Ritplanning: elke taak opnieuw "N open" tikken.** Na een rit maken of een taak koppelen verdwijnt de lijst; rechts staat de rit. Voor 2 taken 6 tikken.

**N16. Tweede kampmoment zelfde locatie en week: geen zichtbaar gevolg.** Dialoog sluit, teller blijft 3, ik las geen foutmelding. Twijfel.

**N17. Uit pool bij voorraad 0 staat dubbel.** Prints agenten "uit pool": aanvullijst én tekorten "te bestellen". Twijfel of dit bedoeld is.

### COSMETISCH

**N12. Teksten.** "1 ritten" (dagkop ritplanning), "1 handeling (F40) worden afvinkbaar", "Hele zomer" (sportrooster), "‹ wk 0" bij week 1, login "op deze gsm" op desktop.

**N18.** Chip "Geen KV" afgesneden op `/rooster` 1920. Periodekiezer meet 18 px hoog (de zichtbare knop niet apart gemeten). `/etiketten` en printlijst breder dan 390, knoppen 36–40 px.

## ONDUIDELIJK VOOR DEZE ROL

- Tekorten: knoppen "Bestellen" en "Besteld" naast elkaar.
- "Periode" in de balk: wijzigt dit het actieve seizoen voor iedereen of alleen mijn zicht? Actief zetten en kiezen lijken hetzelfde.
- "Nakijken" op Vandaag betekent planning en conflicten, in de balk betekent het tellingen keuren.
- "🔒 vast" bij een stop.
- "Conflict 2" naast "⚠ let op".
- Bakken versus stuks in ritplanning en rit-link.
- Levering op 6/11 valt buiten periode 9–22/11: kantoor ziet niet waarom een taak dan "weg" is.
