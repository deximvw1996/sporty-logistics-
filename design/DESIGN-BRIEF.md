# Designsessie Sporty — brief (Fable, 2026-10-29)

Doel: de app moet "echt goed aanvoelen" (Maxim 29/10). Werkwijze zoals bij Atlas: per scherm drie richtingen met **dezelfde inhoud** in drie uitvoeringen, Maxim kiest, dan varianten tot "goed zo", daarna bouwen als exacte kopie. Volgorde volgens LOGISTIEK EERST: 1 chauffeur rit-pagina (mobiel) → 2 kantoor-dashboard "vandaag" + navigatie (desktop 1920×900) → 3 KV-scherm + telscherm (mobiel) → 4 monitor-telpagina.

## Scherm 1 — Chauffeur: de rit (mobiel, 390 px breed)
Dit is wat de chauffeur in de hand heeft bij laden in de Rozenweg, onderweg en bij lossen op locatie. Eén rit per link, geen login.

**Inhoud die in ELKE richting aanwezig moet zijn (bindend):**
1. Kop: datum van de rit, voertuig, chauffeur, voortgang (bv. "stop 1 van 3", "12 van 20 stuks geladen").
2. Stops in volgorde, per stop: soort (levering / ophaling / transfer), van → naar, tijd, contactpersoon + telefoon van de locatie (DRAAIBOEK 3.5), knop "Ik ben aangekomen".
3. Per stop de stukkenlijst, gegroepeerd per rek in de stockage (rek A, B, …) bij laden en per stop bij lossen: code + naam, aantal, foto-miniatuur (DRAAIBOEK 2.6), twee vinkjes: Geladen / Gelost. Elk stuk apart (DRAAIBOEK 4.2, bindend).
4. "Past niet / niet gevonden" per stuk → rest blijft open als nieuwe taak (DRAAIBOEK 3.3).
5. "Probleem melden" per stop: tekst + foto → kantoor en KV (DRAAIBOEK 3.5).
6. Status van de rit zichtbaar: gepland → onderweg → aangekomen → gedaan; sluit vanzelf.
7. Werkt met één hand, knoppen ≥ 44 px, leesbaar in de zon (hoog contrast), offline-tolerant (laatste stand blijft staan).
8. **Dagoverzicht met tijdlijn** (Maxim 29/10): alle stops van de dag in volgorde op een tijdlijn; de chauffeur kan stops **verslepen** als kantoor dat toelaat. Kantoor zet per stop een slot: 🔒 vast (tijd/volgorde door kantoor bepaald) of ↕ vrij (chauffeur kiest). Vaste stops blijven staan, vrije stops kunnen ertussen bewegen. Vanuit het overzicht kan de chaufeur naar élke stop springen, ook terug naar een vorige.

**Wat er NIET op mag:** inhoud van bakken (de chauffeur ziet codes, geen itemlijsten), beheerknoppen, kantoor-jargon.

**Drie richtingen (zelfde inhoud):**
- **A. Checklist-strook** — één lange lijst van boven naar beneden, zoals een pakbon; stops als kopjes; grote vinkrijen; minimaal kleurgebruik, zwart op wit, één accentkleur voor "nu bezig".
- **B. Stop-kaarten** — één stop tegelijk als volledig scherm (swipe/volgende), bovenaan een voortgangsbalk met de stops als bolletjes; de stukkenlijst als kaarten met foto groot; rust door focus.
- **C. Dashboard-tegels** — bovenaan drie tegels (geladen / onderweg / gelost) met grote cijfers, daaronder uitklapbare stops; kleurcodering per status (grijs, blauw, groen, rood voor probleem); voelt als een professionele koeriersapp.

Meetlat vóór voorleggen: past op 390×844 zonder horizontaal scrollen; alle 8 inhoudspunten aanwezig; knoppen 44 px; contrast ≥ 4.5:1.

**Keuze Maxim 29/10 (na drieluik 1):** richting B (stop-kaarten) als basis, met de rek-groepering van A bij het laden en de rode 'past niet'-markering van C, plus het nieuwe dagoverzicht met tijdlijn (punt 8) als eerste scherm van de rit, van waaruit elke stop bereikbaar is.

## Scherm 2 — Kantoor: "Vandaag" + navigatie (desktop 1920×900)
**Inhoud die in ELKE richting aanwezig moet zijn (bindend):**
1. Zeven hoofdonderdelen, nooit meer: Vandaag · Planning (rooster, kampmomenten, periodes) · Transport (ritten, taken, ritplanning met vast/vrij) · Materiaal (thema's, bakken, pool, catalogus) · Locaties · Voorraad & controles (tekorten, nakijken) · Beheer (personeel, export, logboek). Tellers op onderdelen met werk.
2. Actieve periode altijd zichtbaar en wisselbaar; ingelogde persoon.
3. Te keuren: aanvragen (materiaal/kapot) van KV's en meldingen van chauffeurs, met de knop om te keuren of af te handelen.
4. Ritten vandaag per chauffeur met stops, tijden, 🔒 vast / vrij, status; rest-taken die nog ingepland moeten worden; knop "Rit plannen".
5. Let op: conflicten van de actieve periode (dubbel thema, bak dubbel, capaciteit pool, kampmoment zonder thema), open tekorten.
6. Deze week: open locaties met thema en KV.
7. Snelle acties: spoedtaak, aanvraag, rit plannen.
Meetlat: 1920×900 zonder scrollen; knoppen ≥ 36 px op desktop; één scherm, één vraag ("wat moet ik vandaag doen?").

**Drie richtingen (drieluik 1, `kantoor-drieluik-1.html`):** A linkerbalk + kaartenraster (cijfers boven, drie kolommen Te keuren / Ritten / Let op) · B bovenbalk + één werklijst "Nu eerst" op urgentie (Beslissen / Inplannen / Nakijken) met rechts ritten en deze week · C commandocentrum (icoonrail, donkere strip met tellers, links de gebeurtenissenstroom nieuwste eerst, rechts ritten en locaties).

**Keuze Maxim 29/10 (na drieluik 1):** richting B, maar met de drie groepen (Beslissen / Inplannen / Nakijken) als drie kolommen naast elkaar die elk apart scrollen, zodat een lange Inplannen-lijst Nakijken nooit onder de vouw duwt. Dashboardregel: Vandaag toont alleen wat vandaag of deze week moet; de volledige lijsten leven in Transport/Planning.

**Varianten (`kantoor-varianten-1.html`, zelfde inhoud: 4 beslissen · 9 inplannen · 3 nakijken · 2 ritten · 4 locaties):** B1 drie stapels (kaartjes met acties rechtsonder, rechts ritten + deze week) · B2 bord (gekleurde kolomkoppen met uitleg, tegels met acties eronder, ritten + deze week als strook onderaan over de volle breedte) · B3 werkbank (vijf kerncijfers bovenaan, dichte rijen met één knop per rij en "alles ›" per kolom, rechts ritten + deze week).

**DEFINITIEF (Maxim 29/10): `KANTOOR-DEFINITIEF.html` = B1 + B3 samen.** Eén scherm met schakelaar **Groot / Compact** rechtsboven in het werkvlak (voorkeur per gebruiker onthouden): Groot = kaartjes met acties rechtsonder (B1), Compact = dichte stroken met één hoofdknop per rij (B3, de lichte knop verdwijnt). Vast in beide standen: bovenbalk met 7 onderdelen + periode, drie apart scrollende kolommen Beslissen / Inplannen / Nakijken met teller, korte uitleg en "alles ›", rechts 400 px: twee kerncijfers, Ritten vandaag (🔒/vrij-stops), Deze week. Rechts scrollen Ritten vandaag en Deze week elk in een eigen vak (verhouding 4:5) met teller en "alles ›", zodat een zware week (6 ritten, 12 locaties) nooit de kolommen of elkaar wegduwt (Maxim 29/10). Dashboardregel: alleen wat vandaag of deze week moet. Bouw = exacte kopie.

## Scherm 3 — KV: "Wat hoort er te staan" + telscherm (mobiel)
Later; LOGISTIEK EERST. Inhoud: bakken + status, levering verwacht, eigen meldingen en hun status, tellen per bak met aantal typen / alles aanwezig / kapot melden, versturen; monitor-link met alleen het telscherm.

## Referenties
Koeriersapps (PostNL/DHL bezorger-app: één stop per scherm, grote knoppen), magazijn-scanapps (checklist-strook), Linear/Notion voor de kantoorkant (rustig, veel wit, duidelijke hiërarchie).

## Scherm 3 — Kantoor: Ritplanning (desktop 1920×900)
**Inhoud die in ELKE richting aanwezig moet zijn (bindend):**
1. Weekkeuze binnen de actieve periode (‹ ›); zaterdag/zondag zichtbaar maar als uitzondering gemarkeerd (weekendtaak = bevestiging, geen verbod; DRAAIBOEK 7).
2. Nog te plannen: leveringen (vrijdag), ophalingen bij sluiting, rest-taken (past niet), goedgekeurde aanvragen/naleveringen, terugritten; met van → naar, aantal stuks en dag.
3. Ritten: datum, vertrek, chauffeur, voertuig met bezetting/capaciteit in bakken, status; stops in volgorde met tijd, 🔒 vast / vrij per stop (kantoor beslist), ▲▼ en ✕ per stop, "+ stop zonder taak".
4. Taak aan rit toevoegen / van rit halen (409 als al geladen), splitsen; wisselen van vast/vrij per tik.
5. Waarschuwingen in beeld: bakken > capaciteit, chauffeur dubbel op hetzelfde uur, locatie gesloten; nooit blokkeren, altijd uitleggen.
6. Rit-link naar chauffeur en Klaarzetten (checks aanmaken) vanaf de rit.
7. Drie stockageplaatsen (Rozenweg, Kantoor, Marco) als gewone van/naar-locaties.
Meetlat: 1920×900 zonder paginascroll; lijsten scrollen apart; knoppen ≥ 36 px.

**Drie richtingen (drieluik 1, `ritplanning-drieluik-1.html`, zelfde inhoud: week 2, 3 ritten waarvan #23 over capaciteit en #25 chauffeur dubbel, 5 nog te plannen waarvan 1 weekend):** A bouwtafel (links nog te plannen met "→ aan rit", rechts de gekozen rit als tabblad met velden en stoplijst) · B weekrooster (7 dagkolommen met ritkaarten en nog-te-plannen per dag, rechts detail van de gekozen rit) · C rit-voor-rit (links rittenlijst + nog te plannen, midden de rit als genummerde tijdlijn, rechts "past op deze rit"-suggesties van dezelfde dag).

**Reactie Maxim op drieluik 1 (29/10):** geen van de drie; A te veel lege ruimte, B geen tijdsaanduiding en smalle lange vakken, C te veel rit en te weinig overzicht. Nieuwe eisen: tijd altijd zichtbaar als as, scherm gevuld, overzicht boven detail.

**Drieluik 2 (`ritplanning-drieluik-2.html`, zelfde inhoud: week 2, 6 ritten [gedaan/onderweg/gepland; #23 over capaciteit; #25+#26 Sam dubbel op do 10:00], 5 nog te plannen waarvan 1 weekend):** D dagtijdlijn per chauffeur (dagtabs met tellers, per chauffeur een rij op een tijdas 07–17 met de rit als blok en de stops als 🔒/◌-markers op hun tijd; onder: nog te plannen + detail van de gekozen rit) · E weekagenda (7 dagkolommen × tijdrijen 07–17, ritten als blokken met stops op tijd, open taken onderaan de dag; links nog te plannen + gekozen rit) · F chauffeursrooster (rijen chauffeurs × 7 dagen, per cel de ritten als chips met vertrek–terug en stops op tijd, onderste rij nog te plannen per dag; detail-lade onderaan).

**Keuze Maxim 29/10 (na drieluik 2):** E weekagenda als overzicht met D dagtijdlijn als inzoom. Twee bindende aanvullingen uit het gesprek:
- **Bestuurder = elke medewerker.** "Chauffeur" is een rol op de rit, geen persoonstype: vaste chauffeurs bovenaan in de keuzelijst, daaronder "iemand anders…" (coördinatoren, kantoor) met label "coördinator rijdt mee". Voertuig: pool bovenaan, daaronder eigen wagen / huurwagen met vrij in te vullen capaciteit. Rit-link, checks en dubbelcontrole ("X staat ook op rit…", "X is die dag KV op…") gelden voor iedereen; waarschuwing, geen verbod. In de dag-inzoom verschijnen ad-hoc bestuurders alleen op dagen dat ze rijden; vaste chauffeurs zonder rit blijven als lege rij met "+ rit".
- **Gelijktijdige ritten.** Banen naast elkaar in de dagkolom (zoals een agenda bij overlappende afspraken) én dagkolommen die meegroeien met het aantal banen; weekenddagen zonder ritten krimpen. Vaste kleur per bestuurder, legenda met personen in de subbalk.

**Varianten (`ritplanning-varianten-1.html`, zelfde inhoud: zomer week 4, 11 ritten, zomervrijdag 6 ritten waarvan 5 tegelijk met Lotte en Bram als coördinator-bestuurders, 4 nog te plannen):** E1 agenda boven + dag-inzoom als lade eronder (vrijdag open, rij per bestuurder) · E2 agenda links, rechts de dag-inzoom verticaal + gekozen rit · E3 agenda op volle hoogte met daarboven een strook nog te plannen + gekozen rit (dag-inzoom opent als overlay).
