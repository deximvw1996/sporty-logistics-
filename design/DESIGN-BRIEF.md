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
- **Gelijktijdige ritten.** Banen naast elkaar in de dagkolom (zoals een agenda bij overlappende afspraken) én dagkolommen die meegroeien met het aantal banen; weekenddagen zonder ritten krimpen. Vaste kleur per bestuurder, legenda met personen in de subbalk. Omdat de kolombreedte varieert, moet elke dag duidelijk afgebakend zijn (Maxim 29/10): dagkop als band over de volle kolombreedte, rand rond de kolom, afwisselende achtergrond, 10 px tussenruimte, gekozen dag donkerblauw omkaderd, weekend gestippeld.

**Varianten (`ritplanning-varianten-1.html`, zelfde inhoud: zomer week 4, 11 ritten, zomervrijdag 6 ritten waarvan 5 tegelijk met Lotte en Bram als coördinator-bestuurders, 4 nog te plannen):** E1 agenda boven + dag-inzoom als lade eronder (vrijdag open, rij per bestuurder) · E2 agenda links, rechts de dag-inzoom verticaal + gekozen rit · E3 agenda op volle hoogte met daarboven een strook nog te plannen + gekozen rit (dag-inzoom opent als overlay).

**DEFINITIEF (Maxim 29/10): `RITPLANNING-DEFINITIEF.html` = E1-opbouw met de lade-inhoud van E2.** Boven: weekagenda (tijdas 07–17, banen naast elkaar, dagkolommen groeien mee, dagen afgebakend, kleur per bestuurder, legenda in de subbalk, weekend gestippeld). Onder (lade, 360 px): links de dag-inzoom van de gekozen dag (rij per bestuurder op de tijdas, rit als blok met 🔒/◌-stops, lege rij "+ rit" voor vaste chauffeurs, rij "+ iemand anders" voor coördinator/kantoor), rechts het detail van de gekozen rit (kop met bezetting/capaciteit en waarschuwing, stops met tijd, 🔒/vrij, ▲▼, ✕, knoppen Splitsen / Rit-link / Klaarzetten). Nog te plannen opent via de teller "N open" in de dagkop (lijst met "→ aan rit"). Bouw = exacte kopie.

**Keuze Maxim 29/10 (na KV-drieluik 1):** richting B (koerier-tabs), maar het telscherm moet beter: een stuk kan ook te véél zijn, kapot melden met foto per stuk, en een notitie per stuk. Statuskleuren per stuk: ✓ klopt (groen) · tekort (rood) · te veel (blauw) · kapot (oranje) · nog niet geteld (grijs).

**Varianten (`kv-varianten-1.html`, startscherm B identiek; telscherm N09 met 8 stuks: springtouw tekort + notitie, hoepel te veel, pion 2 kapot + foto, bal ok, 4 nog niet geteld):** B1 stepper − / + (mag boven "hoort") met ⋯ dat kapot / foto / notitie uitklapt · B2 "✓ klopt" of "anders" (één tik als het klopt; "anders" klapt geteld / kapot + foto / notitie uit en benoemt tekort of te veel) · B3 kaart per stuk met invulveld en drie vaste knoppen 💥 📷 📝 (geen uitklap).

**DEFINITIEF (Maxim 29/10): `KV-DEFINITIEF.html` = B koerier-tabs + telscherm B2.** Tabbalk onderaan: Overzicht · Tellen (teller geteld/totaal) · Aanvragen (teller open) · Info. Overzicht = statuskaarten (levering, ophaling, tellen, aanvragen, melding chauffeur, boodschappen), elk aanklikbaar naar zijn tab. Tellen = bakkenlijst met status (nog niet / ✓ ok / tekort) en "Telling versturen (n/m)" (mag ook onvolledig). Telscherm = per stuk "✓ <hoort>" of "anders"; "anders" klapt uit: geteld (− / +, mag boven "hoort"; benoemt tekort of te veel), kapot (− / + met 📷 foto), notitie, Opslaan; statuskleur per stuk: ✓ klopt groen · tekort rood · te veel blauw · kapot oranje · nog niet grijs; onderaan "Rest klopt ✓" en "Bak klaar". Aanvragen = knoppen Materiaal vragen / Kapot melden (overlay: tekst, aantal, foto, Versturen → toast), mijn aanvragen met status en antwoord van kantoor, meldingen chauffeur. Info = boodschappen (KV-regels), monitor-link (alleen telscherm) kopiëren, kantoor bellen, locatie + sleutel-info. Alles via de KV-link zonder login; 390 px, knoppen ≥ 44 px. Bouw = exacte kopie. Datamodel-aanvulling voor de bouw: nakijk_regels krijgen `te_veel`/`kapot` (aantal), `notitie`, `foto` per stuk.

## Scherm 5 — Kantoor: standaardpagina-patroon (Transport · Voorraad & controles · Planning · Materiaal · Locaties · Beheer; desktop 1920×900)
**Aanpak (Maxim 29/10, "ok"):** één patroon ontwerpen (drieluik → keuze → definitief), daarna per onderdeel één mockup op dat patroon ter goedkeuring (geen drieluik meer per onderdeel). Volgorde: Transport, Voorraad & controles, Planning, Materiaal, Locaties, Beheer.
**Inhoud die in ELKE richting aanwezig moet zijn (bindend):** zoekveld + filterchips met tellers; lijst met sorteerbare kolommen en statuspil; detail met kop (naam, subregel, knoppen Bewerken / context-actie / primaire actie), tabbladen (Gegevens · Foto's · gekoppelde items · Historiek), blokken contact/toegang, foto's met "+ foto", gekoppelde items met "Open", historiek uit de wijzigingen-tabel met "↶ Terug" (alles gelogd en omkeerbaar, DRAAIBOEK 9); knoppen Export en Nieuw in de subbalk; lijst en detail scrollen apart. Zelfde bovenbalk en subbalk als Vandaag.
**Drie richtingen (drieluik 1, `patroon-drieluik-1.html`, voorbeeld Locaties met 15 rijen):** P1 lijst links (860 px) + detailpaneel rechts, altijd beide zichtbaar · P2 volle tabel met selectievakjes en bulk-acties in de voet, detail als lade die over de tabel schuift · P3 detail als eigen pagina met terugknop, links een samenvatting + zijlijst van de andere items, rechts het detail in vier kolommen.

**DEFINITIEF (Maxim 29/10, "akkoord"): `PATROON-DEFINITIEF.html` = P1 (lijst 860 px links + detailpaneel rechts) met de selectievakjes en bulk-voet van P2.** Voet toont "N geselecteerd" + bulk-knoppen zodra iets is aangevinkt. Detail: kop met naam, subregel en knoppen (Bewerken · context · primaire actie), tabbladen (Gegevens · Foto's · gekoppeld · Historiek), blokken in twee kolommen, historiek met "↶ Terug". Per onderdeel volgt één mockup op dit patroon; de bouwchat bouwt elk onderdeel als exacte kopie van zijn mockup.

**Mockup 1 — Transport › Taken (`mockup-transport-taken.html`):** filters Deze week · Zonder rit · Levering · Ophaling · Rest · Weekend · Gedaan; kolommen Taak (type + pil rest/vrij/weekend) · Wanneer · Route · Wat · Rit · Status; bulk Op een rit zetten · Verplaatsen · Bundelen · Verwijderen; subbalk Ritten · Ritplanning · Taken · Voertuigen + Export · Genereer uit planning · Nieuwe taak; detail: regels (met ✕ en + Regel), rit + slot (🔒 Zet vast) + checks + stops van de rit, kampmoment met contact en gekoppelde ophaling, historiek; knoppen Bewerken · Splitsen · Van rit halen · Open rit.
**Correctie Maxim 29/10 (patroon):** een KV hoort bij een kampmoment, niet bij een locatie; de locatielijst heeft dus géén KV-kolom. In de plaats: kolom "Deze periode (week · KV)" met per locatie de kampmomenten van de actieve periode ("wk 1 Lotte · wk 3 Bram", lopende week vet; stockage "—"). Algemene regel voor alle mockups: een kolom toont alleen wat écht bij de rij hoort; afgeleide gegevens altijd mét hun context (week, periode).

**Mockup 2 — Voorraad & controles › Nakijken (`mockup-voorraad-nakijken.html`):** kantoor-spiegel van het KV-telscherm. Subbalk Nakijken · Tekorten · Bestellingen · Voorraad + Export · Printlijst. Filters Te keuren · Niet geteld · Met tekort · Met kapot · Nagekeken · Week. Lijst per bak: locatie + week/KV, bak, geteld n/m, uitslag (klopt / tekort / te veel / kapot / niet geteld), status (te keuren / niet geteld / nagekeken); bulk Keuring afronden · Herinnering naar KV · Printlijst. Ook bakken die de KV nog niet telde staan erin (werklijst 73). Detail: kop met bak, locatie, week, KV, ingediend, samenvatting; knoppen Bak openen · Foto's · KV bellen · Keuring afronden; tabs Telling · Vorige tellingen · Historiek; tabel per stuk: hoort / geteld / afwijking / notitie KV / actie kantoor (tekort: bestellen, uit pool aanvullen, aanvaarden; te veel: terug naar pool, laten staan; kapot: afschrijven + bestellen, herstellen, aanvaarden); historiek met ↶ Terug.

**Aanvulling Maxim 29/10 (Voorraad):** wie in de Rozenweg aanvult heeft geen laptop of desktop bij; die werkt met gsm of papier. Daarom hoort bij Nakijken (beslissen, desktop) een derde vorm: de **aanvullijst** (`mockup-aanvullen-gsm.html`) = dezelfde beslissingen, gegroepeerd per bak met rek/plank, als gsm-scherm (kantoor-login of eigen link; afvinken per stuk, 📷 bij afschrijven, filterchips uit pool / bestelling / klaar, knop "Bak klaar", knop Printlijst) én als A4-printlijst met vakjes (kolommen bak·plaats, stuk, aantal, wat, waar/opmerking, gedaan door; voettekst "na afloop afvinken in de app of blad aan kantoor"). Wat op een bestelling wacht, verschijnt opnieuw zodra die binnen is. Subbalk Voorraad & controles krijgt het onderdeel Aanvullen; de knop 🖨 Printlijst staat op Nakijken, Aanvullen en de gsm-versie. Regel voor alle mockups: elke handeling die fysiek elders gebeurt (stockage, locatie) krijgt een gsm- of papierversie.
