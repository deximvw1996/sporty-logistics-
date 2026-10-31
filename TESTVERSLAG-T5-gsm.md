# TESTVERSLAG T5: wat kan op desktop en niet op gsm?

## Samenvatting per rol

**Kantoor.**
1. Elke pagina is bereikbaar, maar via twee of drie stappen; alleen `/opdracht` heeft op gsm geen ingang.
2. Vandaag, Meldingen, Ritplanning, Nakijken, Aanvullen en Opdracht hebben een echte gsm-weergave. De rest is de desktop-pagina, smaller gemaakt.
3. Vijf pagina's blijven afgesneden tabellen: Kampmomenten, Taken, Bakken, Personeel, Logboek.
4. Op vier daarvan vallen bulkknoppen buiten beeld en zijn ze niet bereikbaar: de balk is breder dan het scherm en scrollt niet.
5. Het verschil zit minder in ontbrekende functies dan in "werkt, niet geschikt"; zie de telling.

**Chauffeur.**
1. Desktop en gsm zijn gelijk: dezelfde 5 tabs, dezelfde knoppen, dezelfde `/rit`-pagina.
2. Eén uitzondering: `/vandaag?tab=ritten` op desktop toont ook de lege kantoorkolommen (Beslissen, Inplannen, "Rit plannen").
3. Er is dus geen "lichte" gsm: hij is op beide even beperkt.
4. Wat hij op beide mist: ritten verder dan morgen. Rit #22 op 2/11 stond op 31/10 niet onder Ritten ("Geen ritten vandaag"); alleen de melding verwees ernaar.
5. Kantooradressen sturen door naar `/vandaag`, op beide breedtes.

**Telling (schatting).** Kantoor: 75 volledig, 56 werkt niet geschikt, 23 ontbreekt, 4 niet nodig. Chauffeur: 7 volledig, 0 werkt niet geschikt, 1 ontbreekt, 1 niet nodig.

### Top 10 wat het meest mist voor een echte werkdag

1. **Kampmomenten als gsm-lijst**: KV, thema en transport staan in een afgesneden tabel.
2. **Bulkacties** op Kampmomenten, Taken, Bakken, Personeel: alleen de eerste knop past; "Verwijderen", "Bundelen", "Rol wijzigen" en andere zijn niet te bereiken.
3. **Weekoverzicht van ritten**: op gsm alleen dag per dag, geen beeld van wie wanneer rijdt.
4. **Ingang naar Opdracht** (twee wagens, afspraken): de pagina werkt goed op 390, maar de knop "Opdracht" zit alleen in het desktop-ritdetail.
5. **Splitsen van een rit**: ontbreekt in het gsm-ritdetail.
6. **Taken als gsm-lijst**: route, inhoud en rit afgesneden; meerdere taken verplaatsen of bundelen kan niet.
7. **Bakken als gsm-lijst**: "Waar staat…" in Meer wijst hierheen, maar plaats en status staan buiten beeld.
8. **Personeel als gsm-lijst**: telefoon en stand afgesneden.
9. **Export, "+ Nieuw…" en filterchips** staan buiten beeld in een scrollende balk, zonder teken dat er meer is. Dat raakt elke beheerpagina.
10. **Eerdere tellingen op Nakijken gsm** ontbreken; ook zoeken ontbreekt daar.

## Eerlijk: wat niet echt geklikt is

- **Niet elke functie is op 390 echt uitgevoerd.** Ik heb per pagina in een iframe van 390×844 en 1920×900 automatisch gemeten: alle knoppen, velden en chips in de lijst, na een klik op de eerste rij, na één vinkje en na de "+ Nieuw"-knop. Een knop die ik zag maar niet uitvoerde, staat als "volledig" of "werkt, niet geschikt" op basis van bereikbaarheid, formaat en code.
- **Uit de code gelezen, niet geopend:** dialogen zoals samenvoegen, splitsen, kopiëren, rol wijzigen, onderhoud, dupliceren, foto toevoegen.
- **Niet geprobeerd:** downloads en export, printen, back-up terugzetten, slepen op een aanraakscherm.
- **Geen echte vinger.** Schermafdrukken op gsm-formaat liepen vast, dus de meeste metingen zijn zonder beeld. Een iframe emuleert geen aanraking en geen mobiele user agent. "Buiten beeld" bij de bulkbalk is gemeten: 1106 px in `.frame` met `overflow:hidden`.
- **De telling** telt mijn regels, en een regel is soms een groep knoppen. Het is dus een schatting. "Werkt, niet geschikt" is mijn oordeel.
- **Niet bekeken:** monitor, coördinator, Sportrooster met ingeplande sport op gsm, Locaties-kaart op gsm.

Testdata via API op een verse kopie: opdracht #1 met 2 wagens, garage-afspraak, telling, tekort, bestelling, aanvraag. Getest op `origin/main` 110e732, lokaal op 3306. Niets op prod.

## Bereikbaarheid en meting op 390

- **Tabbalk kantoor:** Vandaag, Transport, Voorraad, Meldingen, Meer. Meer: Mijn ritten, Aanvullen, Planning, Materiaal, Locaties, Beheer; Snel: Waar staat…, Contacten.
- **Alleen via subbalk (horizontaal scrollen):** Rooster, Sportrooster, Gedeeld, Periodes, Taken, Voertuigen, Thema's, Pool, Catalogus, Logboek, Back-up, Instellingen, Tekorten, Aanvullijst. "Gedeeld materiaal", "Periodes" en "Instellingen" staan buiten beeld.
- **Geen ingang gevonden:** `/opdracht`. `/etiketten` alleen vanuit Bakken en Pool.
- **Horizontale paginascroll:** `/locaties` (404 op 371). Rest niet, op de 23 gemeten pagina's.
- **Onder 44 px:** vinkjes 20 px op de meeste lijsten; Kampmomenten tabs 40, dagknoppen 36, "wijzig" 21, aantalveld 31; Taken-link 17; Thema's en Catalogus 16 ("alles in Bakken ›", "+ regel", "+ attribuut"); Logboek-keuze 38; Opdracht tijdveld 36.
- **Hover:** `title` op Voertuigen (70), Locaties (27), Rooster seizoen-weken. Geen tik-alternatief gezien. Kampmomenten "let op" heeft wel een tik.

## Kantoor per pagina

### Vandaag (5 volledig, 0 werkt niet geschikt, 4 ontbreekt, 0 niet nodig)

| Pagina | Functie op desktop | Op gsm | Hoe |
|---|---|---|---|
| Vandaag | Groot / Compact | ontbreekt | Niet op gsm-Vandaag; Meer › Weergave bestaat, effect niet gezien |
| Vandaag | Kolommen Beslissen, Inplannen, Controles | volledig | Kaart "Nu" + Daarna, items via Start |
| Vandaag | Goedkeuren / Afwijzen | volledig | Via tab Beslissen; niet geklikt op gsm |
| Vandaag | Later deze periode | ontbreekt | Geen eigen blok; deels in "Controles · n" |
| Vandaag | Cijfers onderweg, locaties open | ontbreekt | Niet op gsm-Vandaag |
| Vandaag | Blok Ritten vandaag, Rit plannen | volledig | Tab Transport |
| Vandaag | Blok Volgende week | ontbreekt | Niet op gsm gezien |
| Vandaag | Periode kiezen | volledig | In Meer |
| Vandaag | Afspraak Klaar | volledig | Bovenaan, 44 px |

### Meldingen (4 volledig, 0 werkt niet geschikt, 0 ontbreekt, 0 niet nodig)

| Pagina | Functie op desktop | Op gsm | Hoe |
|---|---|---|---|
| Meldingen | Lijst, tik = gelezen | volledig | Zelfde pagina |
| Meldingen | Alles gelezen | volledig | 44 px |
| Meldingen | + Bericht met ontvanger | volledig | Dialoog uit code |
| Meldingen | Meldingen aanzetten, geluid, push | volledig | 44 px |

### Kampmomenten (4 volledig, 9 werkt niet geschikt, 1 ontbreekt, 0 niet nodig)

| Pagina | Functie op desktop | Op gsm | Hoe |
|---|---|---|---|
| Kampmomenten | Lijst met kolommen | werkt, niet geschikt | Afgesneden tabel, rij 46 px |
| Kampmomenten | Zoeken | volledig | 44 px |
| Kampmomenten | Filterchips | werkt, niet geschikt | Horizontaal scrollen |
| Kampmomenten | Export | werkt, niet geschikt | Buiten beeld in balk; download niet geprobeerd |
| Kampmomenten | Genereer transport | werkt, niet geschikt | Buiten beeld in balk |
| Kampmomenten | + Kampmoment | werkt, niet geschikt | Knop buiten beeld; dialoog past, vinkjes 20 px |
| Kampmomenten | Detail-tabs | werkt, niet geschikt | 40 px |
| Kampmomenten | Bewerken, Locatie, KV-link, Thema kiezen | volledig | Na rij-tik |
| Kampmomenten | KV koppelen | volledig | Uit code |
| Kampmomenten | Dagen en kookdagen | werkt, niet geschikt | 36 px |
| Kampmomenten | Groepsaantallen | werkt, niet geschikt | Veld 31 px |
| Kampmomenten | Bulk: Genereer transport | werkt, niet geschikt | Eerste knop past |
| Kampmomenten | Bulk: KV-links, Thema toewijzen, Verwijderen | ontbreekt | Buiten beeld, balk scrollt niet |
| Kampmomenten | "Let op"-uitleg | volledig | Tik-popover |

### Rooster (3 volledig, 3 werkt niet geschikt, 2 ontbreekt, 0 niet nodig)

| Pagina | Functie op desktop | Op gsm | Hoe |
|---|---|---|---|
| Rooster | Week, Seizoen, weekwissel | volledig |  |
| Rooster | Filterchips | werkt, niet geschikt | Horizontaal |
| Rooster | Export | werkt, niet geschikt | Buiten beeld |
| Rooster | Lijst per locatie | volledig | Kaartrij |
| Rooster | Selecteren | ontbreekt | Geen vinkje op gsm; op desktop geen bulkknop gezien, dus weinig verlies |
| Rooster | Detail, Wissel, Open kampmoment | volledig | Na tik |
| Rooster | Seizoen-raster | werkt, niet geschikt | Niet apart gemeten op 390 |
| Rooster | Hover op weken | ontbreekt | `title` zonder tik |

### Sportrooster (1 volledig, 5 werkt niet geschikt, 0 ontbreekt, 0 niet nodig)

| Pagina | Functie op desktop | Op gsm | Hoe |
|---|---|---|---|
| Sportrooster | Week, Seizoen, weekwissel | volledig |  |
| Sportrooster | Filterchips | werkt, niet geschikt | Horizontaal |
| Sportrooster | Dagraster per sport | werkt, niet geschikt | Kaartrij, 60 sporten lang; detail niet gemeten |
| Sportrooster | + Inplannen, Weghalen, Dagen wijzigen | werkt, niet geschikt | Dialoog past; rest uit code |
| Sportrooster | Verhuis Oplossen, Toepassen | werkt, niet geschikt | Uit code |
| Sportrooster | Export | werkt, niet geschikt | Buiten beeld |

### Gedeeld materiaal (2 volledig, 3 werkt niet geschikt, 0 ontbreekt, 0 niet nodig)

| Pagina | Functie op desktop | Op gsm | Hoe |
|---|---|---|---|
| Gedeeld materiaal | Week, Seizoen, chips | werkt, niet geschikt | Horizontaal |
| Gedeeld materiaal | Lijst | volledig | Kaartrij |
| Gedeeld materiaal | Vinkjes | werkt, niet geschikt | 20 px |
| Gedeeld materiaal | Detail, Oplossen, Toepassen | volledig | Na tik |
| Gedeeld materiaal | Export | werkt, niet geschikt | Buiten beeld |

### Periodes (3 volledig, 2 werkt niet geschikt, 0 ontbreekt, 0 niet nodig)

| Pagina | Functie op desktop | Op gsm | Hoe |
|---|---|---|---|
| Periodes | Lijst, zoeken, chips | volledig |  |
| Periodes | + Nieuwe periode | werkt, niet geschikt | Buiten beeld; dialoog past |
| Periodes | Bewerken, Kopiëren, Rooster openen, Actief maken | volledig |  |
| Periodes | Gesloten dag toevoegen, wissen | volledig | Uit code |
| Periodes | Klaar voor de start-links | werkt, niet geschikt | 17 px op desktop; op gsm niet gemeten |

### Ritplanning (8 volledig, 0 werkt niet geschikt, 6 ontbreekt, 1 niet nodig)

| Pagina | Functie op desktop | Op gsm | Hoe |
|---|---|---|---|
| Ritplanning | Weekagenda 7 dagen | ontbreekt | Alleen dagkiezer met lijst |
| Ritplanning | Dagraster per bestuurder | ontbreekt | Lijst per rit |
| Ritplanning | Tijd aanpassen door slepen | ontbreekt | Geen slepen; wel ▲▼ en tijdveld |
| Ritplanning | + rit, + iemand anders | volledig | + Nieuwe rit, keuzelijst |
| Ritplanning | Nog te plannen, → aan rit | volledig | Op rit |
| Ritplanning | Bestuurder, voertuig, aanhangwagen | volledig | 48 px |
| Ritplanning | Ander voertuig | volledig | Uit code |
| Ritplanning | ▲▼, ✕ stop | volledig | 44 px |
| Ritplanning | 🔒 vast/vrij | ontbreekt | Niet gezien op gsm; niet verder nagegaan |
| Ritplanning | + Materiaal, + Stop | volledig |  |
| Ritplanning | Rit-link, Kopieer | volledig |  |
| Ritplanning | Klaarzetten, Terugzetten | volledig |  |
| Ritplanning | Splitsen | ontbreekt | Niet in het gsm-ritdetail |
| Ritplanning | Knop Opdracht | ontbreekt | Niet in het gsm-ritdetail |
| Ritplanning | Legende bestuurders | niet nodig | Hoort bij de agenda; Maxim beslist |

### Opdracht (7 volledig, 1 werkt niet geschikt, 1 ontbreekt, 0 niet nodig)

| Pagina | Functie op desktop | Op gsm | Hoe |
|---|---|---|---|
| Opdracht | Dag kiezen, agenda | volledig | Lijst |
| Opdracht | + Opdracht, + Afspraak, + Wagen | volledig | 44 px |
| Opdracht | Klaarzetten | volledig |  |
| Opdracht | Wagen-tabs | volledig | Per wagen |
| Opdracht | Voertuig, aanhang, mens, × | volledig | 44 px |
| Opdracht | ▲▼, Volgorde omdraaien | volledig |  |
| Opdracht | + Materiaal, + Stop, Andere wagen, Stuk verplaatsen | volledig |  |
| Opdracht | Eindtijd | werkt, niet geschikt | Veld 36 px |
| Opdracht | Pagina zelf openen | ontbreekt | Geen link op gsm |

### Taken (3 volledig, 4 werkt niet geschikt, 1 ontbreekt, 0 niet nodig)

| Pagina | Functie op desktop | Op gsm | Hoe |
|---|---|---|---|
| Taken | Lijst | werkt, niet geschikt | Afgesneden tabel |
| Taken | Zoeken, Alles tonen | volledig |  |
| Taken | Chips | werkt, niet geschikt | Horizontaal |
| Taken | Export, Genereer, + Nieuwe taak | werkt, niet geschikt | Buiten beeld |
| Taken | Detail: Bewerken, Splitsen, Van rit halen, Op rit, Open rit | volledig | Na rij-tik |
| Taken | Regels ✕, + Regel, Zet vrij/vast | volledig |  |
| Taken | Bulk: Op een rit zetten | werkt, niet geschikt | Eerste knop past |
| Taken | Bulk: Verplaatsen, Bundelen, Verwijderen | ontbreekt | Buiten beeld, balk scrollt niet |

### Voertuigen (3 volledig, 2 werkt niet geschikt, 1 ontbreekt, 0 niet nodig)

| Pagina | Functie op desktop | Op gsm | Hoe |
|---|---|---|---|
| Voertuigen | Lijst, weekcellen | volledig | Kaartrij |
| Voertuigen | Zoeken, chips, weekwissel | werkt, niet geschikt | Horizontaal |
| Voertuigen | Export, + Voertuig | werkt, niet geschikt | Buiten beeld; dialoog past |
| Voertuigen | Detail: Bewerken, Onderhoud plannen, Naar ritplanning | volledig |  |
| Voertuigen | Bulk: Export, Verwijderen | volledig | Past |
| Voertuigen | Hover op dagcel | ontbreekt | `title`, geen tik gezien |

### Thema's (3 volledig, 3 werkt niet geschikt, 0 ontbreekt, 0 niet nodig)

| Pagina | Functie op desktop | Op gsm | Hoe |
|---|---|---|---|
| Thema's | Lijst, zoeken | volledig | Kaartrij |
| Thema's | Chips | werkt, niet geschikt | Horizontaal |
| Thema's | Export, + Nieuw thema | werkt, niet geschikt | Buiten beeld |
| Thema's | Detail: Bewerken, Dupliceren, + Bak koppelen, ✕ | volledig |  |
| Thema's | + attribuut, + regel, alles in Bakken | werkt, niet geschikt | 16 px |
| Thema's | Bulk: Export, Soort wijzigen, Verwijderen | volledig | Past |

### Bakken (3 volledig, 4 werkt niet geschikt, 1 ontbreekt, 1 niet nodig)

| Pagina | Functie op desktop | Op gsm | Hoe |
|---|---|---|---|
| Bakken | Lijst | werkt, niet geschikt | Afgesneden tabel |
| Bakken | Zoeken | volledig |  |
| Bakken | Chips, plaatsfilter | werkt, niet geschikt | Horizontaal |
| Bakken | Export, Etiketten, + Nieuwe bak | werkt, niet geschikt | Buiten beeld |
| Bakken | Detail: Bewerken, Verplaatsen, Inhoud aanpassen, + Stuk, ✕ | volledig |  |
| Bakken | Etiket printen | niet nodig | Printen op gsm weinig zinvol; Maxim beslist |
| Bakken | Foto toevoegen | volledig | Uit code, niet geprobeerd |
| Bakken | Bulk: Etiketten printen | werkt, niet geschikt | Eerste knop past |
| Bakken | Bulk: Verplaatsen, Aan thema koppelen, Verwijderen | ontbreekt | Buiten beeld, balk scrollt niet |

### Pool (3 volledig, 2 werkt niet geschikt, 0 ontbreekt, 0 niet nodig)

| Pagina | Functie op desktop | Op gsm | Hoe |
|---|---|---|---|
| Pool | Lijst, zoeken | volledig | Kaartrij |
| Pool | Chips | werkt, niet geschikt | Horizontaal |
| Pool | Export, Etiketten, + Nieuw poolstuk | werkt, niet geschikt | Buiten beeld |
| Pool | Detail: Bewerken, Verplaatsen, Etiket | volledig |  |
| Pool | Bulk: Export, Etiketten, Verwijderen | volledig | Past |

### Catalogus (3 volledig, 3 werkt niet geschikt, 0 ontbreekt, 0 niet nodig)

| Pagina | Functie op desktop | Op gsm | Hoe |
|---|---|---|---|
| Catalogus | Lijst, zoeken | volledig | Kaartrij |
| Catalogus | Chips | werkt, niet geschikt | Horizontaal |
| Catalogus | Export, + Nieuw artikel | werkt, niet geschikt | Buiten beeld |
| Catalogus | Detail: Bewerken, Samenvoegen, Bestellen, −, +, Min. | volledig |  |
| Catalogus | Alles in Bakken | werkt, niet geschikt | 16 px |
| Catalogus | Bulk: Samenvoegen, Categorie, Verwijderen | volledig | Past (rechterrand 360) |

### Locaties (4 volledig, 4 werkt niet geschikt, 1 ontbreekt, 0 niet nodig)

| Pagina | Functie op desktop | Op gsm | Hoe |
|---|---|---|---|
| Locaties | Lijst, zoeken | volledig | Kaartrij |
| Locaties | Chips | werkt, niet geschikt | Horizontaal |
| Locaties | Kaart | werkt, niet geschikt | Op gsm niet bekeken |
| Locaties | Contacten | volledig |  |
| Locaties | Export, + Nieuwe locatie | werkt, niet geschikt | Buiten beeld |
| Locaties | Detail: Bewerken, Rit plannen, Open, Foto's | volledig |  |
| Locaties | Bulk: Export, Contact mailen, Verwijderen | volledig | Past |
| Locaties | Paginabreedte | werkt, niet geschikt | Horizontale scroll 404 op 371 |
| Locaties | Hover | ontbreekt | 27 `title` zonder tik |

### Nakijken (5 volledig, 1 werkt niet geschikt, 3 ontbreekt, 0 niet nodig)

| Pagina | Functie op desktop | Op gsm | Hoe |
|---|---|---|---|
| Nakijken | Lijst per bak | volledig | Gsm-kaart |
| Nakijken | Zoeken | ontbreekt | Niet op gsm |
| Nakijken | Chips, week | volledig |  |
| Nakijken | Export, Printlijst | werkt, niet geschikt | Buiten beeld |
| Nakijken | Keuren per regel | volledig | Eigen stappenscherm |
| Nakijken | Afronden, Notitie aan KV, KV bellen, Herinner | volledig | Uit code |
| Nakijken | Bak openen, Historiek | volledig | Uit code |
| Nakijken | Eerdere tellingen | ontbreekt | Geen uitklap |
| Nakijken | Selecteren, meer bakken samen | ontbreekt | Geen vinkje op gsm |

### Tekorten (3 volledig, 2 werkt niet geschikt, 1 ontbreekt, 0 niet nodig)

| Pagina | Functie op desktop | Op gsm | Hoe |
|---|---|---|---|
| Tekorten | Lijst, zoeken | volledig | Kaartrij |
| Tekorten | Chips | werkt, niet geschikt | Horizontaal |
| Tekorten | Bestellijst, Export, + Bestelling, + Tekort melden | werkt, niet geschikt | Buiten beeld |
| Tekorten | Detail: Bestellen, Aanvullen uit voorraad, Negeren, Besteld, Binnen | volledig | Meting en code |
| Tekorten | Kies artikel | volledig | Uit code |
| Tekorten | Bulk: bestellijst, besteld, binnen, negeren | ontbreekt | Vinkje staat er, geen balk gemeten op 390 |

### Aanvullen (1 volledig, 0 werkt niet geschikt, 0 ontbreekt, 1 niet nodig)

| Pagina | Functie op desktop | Op gsm | Hoe |
|---|---|---|---|
| Aanvullen | Bakken, afvinken, melden | volledig | Gelijk aan desktop |
| Aanvullen | Printlijst | niet nodig | Afdrukken; pagina past |

### Personeel (2 volledig, 4 werkt niet geschikt, 1 ontbreekt, 0 niet nodig)

| Pagina | Functie op desktop | Op gsm | Hoe |
|---|---|---|---|
| Personeel | Lijst | werkt, niet geschikt | Afgesneden tabel |
| Personeel | Zoeken | volledig |  |
| Personeel | Chips | werkt, niet geschikt | Horizontaal |
| Personeel | Export, + Persoon | werkt, niet geschikt | Buiten beeld |
| Personeel | Detail: Bewerken, Uitnodiging, Pincode resetten, Deactiveren, Rol | volledig |  |
| Personeel | Bulk: Pincode-uitnodiging | werkt, niet geschikt | Rechterrand 391 |
| Personeel | Bulk: Rol wijzigen, Deactiveren | ontbreekt | Buiten beeld, balk scrollt niet |

### Logboek (0 volledig, 3 werkt niet geschikt, 0 ontbreekt, 0 niet nodig)

| Pagina | Functie op desktop | Op gsm | Hoe |
|---|---|---|---|
| Logboek | Lijst | werkt, niet geschikt | Afgesneden tabel |
| Logboek | Tabel-, datum-, wie-filter | werkt, niet geschikt | 38 px, deels afgesneden |
| Logboek | Zoeken, Terug | werkt, niet geschikt | Buiten beeld |

### Back-up & export (2 volledig, 1 werkt niet geschikt, 0 ontbreekt, 1 niet nodig)

| Pagina | Functie op desktop | Op gsm | Hoe |
|---|---|---|---|
| Back-up & export | Lijst, chips | volledig |  |
| Back-up & export | Download nu, Download | volledig | Niet geprobeerd |
| Back-up & export | Exports, import | werkt, niet geschikt | Bestanden op gsm, niet geprobeerd |
| Back-up & export | Terugzetten | niet nodig | Gevaarlijk op gsm; Maxim beslist |

### Instellingen (3 volledig, 0 werkt niet geschikt, 0 ontbreekt, 0 niet nodig)

| Pagina | Functie op desktop | Op gsm | Hoe |
|---|---|---|---|
| Instellingen | Zoeken, chips | volledig |  |
| Instellingen | Velden, opslaan | volledig | Na tik |
| Instellingen | Lijsten: Toevoegen, Hernoemen, ✕ | volledig | Uit code |

## Chauffeur per pagina

### Vandaag (2 volledig, 0 werkt niet geschikt, 1 ontbreekt, 0 niet nodig)

| Pagina | Functie op desktop | Op gsm | Hoe |
|---|---|---|---|
| Vandaag | Nu, Daarna, meldingen | volledig | Gelijk |
| Vandaag | Afspraak Klaar | volledig | 44 px |
| Vandaag | Ritten verder dan morgen | ontbreekt | Ontbreekt ook op desktop |

### Ritten (1 volledig, 0 werkt niet geschikt, 0 ontbreekt, 0 niet nodig)

| Pagina | Functie op desktop | Op gsm | Hoe |
|---|---|---|---|
| Ritten | Lijst vandaag, morgen | volledig | Gelijk; desktop toont extra kantoorkolommen |

### Rit-pagina (1 volledig, 0 werkt niet geschikt, 0 ontbreekt, 0 niet nodig)

| Pagina | Functie op desktop | Op gsm | Hoe |
|---|---|---|---|
| Rit-pagina | Laden, stop, lossen, past niet, wissel, melden | volledig | Zelfde pagina, 44 px of meer; alleen geladen, niet doorlopen |

### Stockage (1 volledig, 0 werkt niet geschikt, 0 ontbreekt, 1 niet nodig)

| Pagina | Functie op desktop | Op gsm | Hoe |
|---|---|---|---|
| Stockage | Bakken, afvinken, melden, losse melding | volledig | Gelijk |
| Stockage | Printlijst | niet nodig | Afdrukken |

### Meldingen (1 volledig, 0 werkt niet geschikt, 0 ontbreekt, 0 niet nodig)

| Pagina | Functie op desktop | Op gsm | Hoe |
|---|---|---|---|
| Meldingen | Lijst, alles gelezen, push-instellingen | volledig | Gelijk |

### Meer (1 volledig, 0 werkt niet geschikt, 0 ontbreekt, 0 niet nodig)

| Pagina | Functie op desktop | Op gsm | Hoe |
|---|---|---|---|
| Meer | Pincode, uitloggen, feedback, meldingen | volledig | Gelijk |

## Voorstel: groepen om te bouwen

Volgorde op werkdagwaarde; grootte is relatief.

1. **Klein, eerst: gemeenschappelijke balk.** Bulkbalk die op gsm past of scrollt, zichtbare ingang voor Export en "+ Nieuw", vinkjes en velden op 44 px, tik voor `title`. Raakt alle pagina's.
2. **Klein: Transport afmaken.** Ingang Opdracht, Splitsen en 🔒 in het gsm-ritdetail, weekbeeld voor kantoor.
3. **Middel: de vijf tabellen naar gsm-lijst.** Kampmomenten, Taken, Bakken, Personeel, Logboek. Kaartrij zoals Rooster, Pool en Tekorten die al hebben.
4. **Klein: Nakijken gelijk trekken.** Eerdere tellingen, zoeken.
5. **Middel: Planning op de gsm.** Sportrooster, Seizoen-raster, dagen en kookdagen.
6. **Klein: Materiaal en Beheer netjes.** Thema's, Catalogus, Locaties (breedte, 16 px-links), Logboek-filters.
7. **Klein: chauffeur.** Ritten verder dan morgen, en de kantoorkolommen op `/vandaag?tab=ritten` op desktop.

**Voor Maxim om te beslissen:** printen van etiketten en lijsten, back-up terugzetten en de kleurlegende staan op "niet nodig".
