# Bespreking materiaal met Maxim (31/10/2026) — bindend voor de bouwronde hierna

## 1. Stockageplaatsen
- **Rozenweg:** themamateriaal, attributen, voorraad voor thema's en standaardmateriaal, deel standaardmateriaal, gedeeld materiaal, klein deel sport. Plaats via code: RGA tot en met (vermoedelijk) RGG = Rozenweg Gelijkvloers gang A…; Boven = eerste verdieping.
- **Kantoor:** sport, standaardmateriaal, naaimachines. Vier delen: Boven, Garage (heet nu Beneden in de app), Sportgarage, Naschoolse garage. In de gewone garage ligt een kleine voorraad (bv. wc-papier), zodat er niet voor elk klein ding naar de Rozenweg gereden moet worden.
- **Marco:** stockage van Marco's Poorten, achter hun oud gebouw op de Diestsesteenweg. Materiaal dat niet vaak nodig is. Wat vaker nodig is, gaat voor de zomer naar de Rozenweg en na de zomer terug. Nog geen onderverdeling.
- Een artikel kan dus op meerdere plaatsen liggen, met aantal per plaats.

## 2. Terugbrengen: de app moet de route zelf doordenken (kernlogica)
Maxim: de planner hield hier te weinig rekening mee; de app moet dit echt beheersen. Doel: minder ritten, van 2 ritten 1 maken.
Normaal gaat materiaal terug naar zijn vaste plaats, maar:
- **Blijft beneden:** nodig in week 1 en week 3 → blijft op het gelijkvloers van de Rozenweg, geen verhuis naar boven of kantoor.
- **Blijft op de locatie:** moet niet nagekeken worden en locatie is de volgende week toegankelijk → blijft staan, verhuist rechtstreeks naar de volgende locatie.
- **Voorbeeld springkasteel:** week 1 locatie x, week 3 locatie y. Vragen: mag het rechtstreeks? Is x of y in week 2 open, kunnen we binnen, is er plaats? Is een locatie verhuurd aan een andere firma, dan mag er niets staan. y nog niet toegankelijk → kan nog niet naar y. x gesloten en niets mag blijven → terug naar de Rozenweg.

De app stelt de route voor met uitleg; kantoor beslist (nog door Maxim te bevestigen).

## 3. Catalogus (akkoord Maxim)
- Alles blijft in de catalogus. Vinkje **voorraad opvolgen** per artikel: aan = aantal en waarschuwing; uit = staat in de bak, de KV telt het, geen aantal en geen vanzelf waarschuwing. Bij het begin bijna alles uit.
- Veld **verbruik / blijvend** per artikel. Verbruik: minder terug = aanvullen. Blijvend: minder terug = weg of kapot, kantoor beslist. Hoofdchat stelt een eerste lijst voor, Maxim keurt goed.
- Soort **print**: knop "opnieuw printen" in plaats van "bestellen".
- Dubbels: voorstellijst, Maxim beslist per groep.
- Voorraad: wordt nu nergens bijgehouden, op het zicht. Alles start op **niet geteld** ("aantal onbekend", geen 0 en geen vals tekort). Tellen wanneer je er toch bent, een schatting mag.
- "INFO:"-regels zijn geen artikels. Kapotte tekens opkuisen.

## 4. Thema's (Maxim 31/10)
- Tienerkampen bestaan echt (bv. duikkamp), maar Maxim kent de lijst niet uit het hoofd. Bron: programma's in `D:\Sporty\Sporty data voor de app\Programma's` (9 weken, 167 docx). Daar komen o.a. Duiken en snorkelen, Klim & Rackets, Windsurfen en kajakken, Zeilen, Mountainbiken voor; die tellen eerst als kandidaten, Maxim beslist.
- Eigen/extern: alle combinaties bestaan. Twee aparte keuzes per thema: wie geeft het (eigen of firma) en wiens materiaal (ons, niet ons, deels).
- Kook, zwem, binnen: tonen en filteren, plus een melding als de locatie het niet biedt. Nooit verbieden.
- Groepen: verbruiksmateriaal schaalt mee met het aantal groepen; meestal is de inhoud voorzien voor 2 groepen. Bakken zelf blijven gelijk. Per artikel is dus nodig: verbruik en "voorzien voor n groepen" (standaard 2).
- Info invullen: hoofdchat leest de PDF-bundels, maakt een voorstel per thema, Maxim keurt goed.
- Kamp en themadag: bijna altijd twee aparte versies met volledig gesplitste bakken. Ze kunnen op hetzelfde moment op twee locaties. Dus geen "dubbel"-melding tussen kamp- en themadagversie, en het blijven aparte thema's (wel koppelbaar als familie).

## 5. Standaardmateriaal (Maxim 31/10)
- Bron: foto's `D:\Sporty\Sporty data voor de app\Materiaal\20260625_195415.jpg` (Specifiek materiaal Kleuterklas Sporthal) en `20260625_195436.jpg` (lijst Sporthal Kessel-Lo: Van, Wat, Aantal, Opmerkingen; blokken Administratiemateriaal, Varia, Thema- en sportmateriaal). Oude db-backup bevat ook een korte lijst (Ehbo kist, Administratie kast, Muziekbox, Programmabord, Zak plastic ballen, Zak mousse ballen) en 18 locatie-regels.
- Eén standaardlijst, en elke locatie een eigen aangepaste lijst (de meeste wijken af).
- Vast verbruik per week; geen rekenwerk met kinderen; de KV meldt wat op is.
- **Wijziging tijdens de open weken hangt af van locatie, materiaal en week.** Voorbeeld kleurenborden: in een rustige week 5 mogen ze blijven liggen waar ze niet nodig zijn; in een drukke week 8 is elk bord nodig, en een vrij groen bord moet naar de locatie waar er een tekort is.
- **Kleurenborden worden op voorhand gepland** zodat overal de juiste borden liggen; de app helpt daarbij. Aantal groepen per locatie per week is daarvoor bepalend. Bron te bekijken: `Materiaal\Kleurenschema ZOMER TD Sporty 2026.xls`. Sporthal-voorbeeld: 14 borden (rood, geel, groen 2x, blauw, oranje 2x, paars 2x, grijs, wit, zwart, roze, bruin), 14 palen, 14 voeten.
