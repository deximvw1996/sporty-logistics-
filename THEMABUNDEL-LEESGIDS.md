# Themabundel-leesgids

> Hoe je een Sporty-themabundel-PDF correct leest en omzet naar databasedata (thema → bakken → items, attributen, verbruik-vlaggen). **Elke correctie die Maxim tijdens de leerfase geeft wordt hier als regel toegevoegd** — dit document is de bron van waarheid voor de autonome extractiefase. Lees dit VOLLEDIG vóór elke thema-extractie.

Status leerfase: gestart 2026-08-02 · 0 thema's zonder correcties goedgekeurd (autonome fase vanaf enkele foutloze thema's op rij).

---

## Structuur van een themabundel (basiskennis)

- **Pagina 1 = de MATERIAALFICHE** — dit is de bron voor de database. De rest van de bundel (weekplanning, activiteitenbeschrijvingen) is context: handig om te begrijpen wat een item is, maar activiteiten-materiaallijsten gaan NIET de database in (generiek sportmateriaal daar zit in de sportkoffers/locatie-uitrusting).
- De fiche kent drie rubrieken:
  1. **"Vast themamateriaal"** — duurzame spullen; hieronder staan de themabakken met hun code, en soms losse attributen (decor, doelen...)
  2. **"Los materiaal voor 32 kinderen (telkens nieuw aan te kopen)"** — dit zijn VERBRUIKSITEMS (verbruik-vlag aan)
  3. **"Sportmateriaal"** — aparte koffer(s) met code, of "nee" als het thema er geen heeft
- Baknotatie: `(KL bak – N08)` = kleuterbak (groot) op magazijnplek N08; `(LS bak – E26)` = lagereschoolbak (kleiner). Letter = rek, cijfer = plek, alles in de Rozenweg.
- "Apart: ..." op de fiche = een los ding buiten de bakken (bv. "Doos met 16 zwembad noodles (Kartonnen doos - G00)").

## Vertaalregels naar de database

1. **Bak = telbare inhoud; attribuut = los ding zonder telbare inhoud.** Grensregel van Maxim: *telbaar = bak* (een doos met 16 noodles is dus een bak met 1 itemsoort, geen attribuut). Decor, croquet-doelen, muziekbox = attributen.
2. **De bak is de kleinste transporteenheid** — items nooit over bakken heen verzinnen; neem de bak-indeling van de fiche letterlijk over.
3. Aantallen uit de fiche letterlijk overnemen; bij "±" het richtgetal gebruiken. Notaties als "5 x 10 aanwijzingen" = totaal (50). "2/kind" bij 32 kinderen = 64.
4. Samengestelde regels splitsen in aparte items ("Doos met: 16 theekopjes, 16 bordjes, 4 theepotten" → 3 items met elk hun aantal), tenzij het echt één set is ("Verkleedkledij Alice + Konijn" = 1 set).
5. Verbruik-vlag: alles onder "Los materiaal / telkens nieuw aan te kopen" = verbruik; uitzonderingen op de fiche expliciet vermeld (bv. "Themabak 1/2: doos PlayMais" onder de losse rubriek = verbruiksitem dat in bak 1 hoort).
6. Verkleedkledij die themaspecifiek is hoort als item ín de themabak (geen apart attribuut) — bevestigd door Maxim voor Alice.

## Door Maxim aangeleerde leesregels (leerfase)

**L1 (2026-08-02, 1001 Ballen en Bellen): de leeftijdsgroep komt uit de MAP, niet uit de bakformaten.** Een bundel uit `Kleuterkampen\` is een kleuterthema, ook als alle bakken LS-formaat hebben.

**L2 (idem): de "Sportmateriaal"-rubriek op de fiche = échte transporteenheden van het thema**, met eigen code en eigen inhoud — géén verwijzing naar de sportpakketten-catalogus. Elke regel daar is een bak/zak die de chauffeur meeneemt en waarvan kantoor de inhoud beheert.

**L3 (idem): er bestaan meer bakvormen dan KL/LS.** Tot nu toe gezien: KL bak (grootste), LS bak (kleiner dan KL!), zwarte curver bak, gele zak, kartonnen doos. Formaatvolgorde: kleuterbak > lagereschoolbak. Neem de vorm uit de fiche over ("Gele zak H70" = zak, geen bak).

**L4 (idem): de fiche kan fouten bevatten — bakformaat en codes blind overnemen is fout.** Voorbeelden: N20 stond als "LS bak" maar is een kleuterbak; de kinbal/zweefbal-bak stond als "H70" maar is L70. Bij het presenteren van een extractie altijd de bakcodes + formaten expliciet tonen zodat Maxim ze kan verifiëren; bij gedeelde codes (zoals meerdere zakken op H70) navragen.

**L5 (idem): meerdere eenheden kunnen dezelfde magazijncode delen** (twee verschillende gele zakken allebei op H70). De dubbele-code-waarschuwing in de app is dus informatief, niet blokkerend.

**L6 (idem): de rek-letter zegt iets over het bakformaat — gang N = grote kleuterbakken.** Een code die met N begint hoort dus bij een kleuterbak, ook als de fiche "LS bak" schrijft (zo werd de N20-fout ontdekt). Bij andere letters (H, L, G, E...) is het formaat niet af te leiden uit de letter; neem dan de fiche-aanduiding en laat Maxim verifiëren.

**L7 (idem): onzeker aantal → laagste zekere aantal invoeren + notitie "verifiëren bij eerste nakijk".** Voorbeeld: kinbal- en zweefbalpomp zijn vermoedelijk hetzelfde type → pomp ×1 met notitie; de eerste vrijdagcontrole geeft dan het echte antwoord. Nooit een gok als hard aantal invoeren.

**L8 (idem): voorraadlocatie is een eigenschap van het ITEM, niet van het thema.** Eén keer geleerd = overal geldig: "ballonnen liggen in de Rozenweg" geldt automatisch voor elk volgend thema met ballonnen. Vastleggen als voorraadrij op de genoemde locatie met aantal 0 ("ligt daar, nog te tellen" — geen aantallen verzinnen) + notitie op het bak-item. Tot nu toe geleerd: sportballen (voetbal, basketbal, mousse) → Kantoor; zowat al het bellenblaas-, knutsel- en verbruiksmateriaal → Rozenweg.

**L9 (idem): sommige items hebben géén voorraadrij maar een maak-/druk-notitie.** (a) Afdrukbare items (handleidingen): notitie "bijdrukken via pc bij verlies", geen voorraad. (b) Maaksels uit grondstoffen ("PET-fles met rietjes", "vierkant stuk stof", "papiersnippers"): notitie "te maken uit <grondstoffen> (locatie)" — de grondstoffen (lege petflessen, sokken, rietjes, stof, papierafval) zijn de voorraad, niet het maaksel zelf.

---

## Invoerchecklist per thema (na Maxims akkoord)

1. Thema aanmaken (naam, leeftijdsgroep, kleur)
2. Attributen aanmaken + koppelen
3. Per bak: aanmaken met label + code (thuislocatie = Rozenweg default) + alle items met qty en verbruik-vlag
4. Verificatie: aantal bakken/items/attributen teruglezen uit de API en tonen
5. Zelfde invoer op lokaal én productie (of enkel productie als Maxim dat vraagt)
