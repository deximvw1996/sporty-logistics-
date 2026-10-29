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

**DEFINITIEF (Maxim 29/10): `KANTOOR-DEFINITIEF.html` = B1 + B3 samen.** Eén scherm met schakelaar **Groot / Compact** rechtsboven in het werkvlak (voorkeur per gebruiker onthouden): Groot = kaartjes met acties rechtsonder (B1), Compact = dichte stroken met één hoofdknop per rij (B3, de lichte knop verdwijnt). Vast in beide standen: bovenbalk met 7 onderdelen + periode, drie apart scrollende kolommen Beslissen / Inplannen / Nakijken met teller, korte uitleg en "alles ›", rechts 400 px: twee kerncijfers, Ritten vandaag (🔒/vrij-stops), Deze week. Dashboardregel: alleen wat vandaag of deze week moet. Bouw = exacte kopie.

## Scherm 3 — KV: "Wat hoort er te staan" + telscherm (mobiel)
Later; LOGISTIEK EERST. Inhoud: bakken + status, levering verwacht, eigen meldingen en hun status, tellen per bak met aantal typen / alles aanwezig / kapot melden, versturen; monitor-link met alleen het telscherm.

## Referenties
Koeriersapps (PostNL/DHL bezorger-app: één stop per scherm, grote knoppen), magazijn-scanapps (checklist-strook), Linear/Notion voor de kantoorkant (rustig, veel wit, duidelijke hiërarchie).
