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

*(nog leeg — hier komt elke correctie te staan, met datum en het thema waarbij hij geleerd werd)*

---

## Invoerchecklist per thema (na Maxims akkoord)

1. Thema aanmaken (naam, leeftijdsgroep, kleur)
2. Attributen aanmaken + koppelen
3. Per bak: aanmaken met label + code (thuislocatie = Rozenweg default) + alle items met qty en verbruik-vlag
4. Verificatie: aantal bakken/items/attributen teruglezen uit de API en tonen
5. Zelfde invoer op lokaal én productie (of enkel productie als Maxim dat vraagt)
