# TESTVERSLAG T2: gerichte test van de nieuwe schermen (desktop en gsm)

**Is dit klaar om zelf te proberen? Nog niet.** De keten zelf werkt grotendeels, maar vier fouten houden het tegen.
1. Een chauffeur of coördinator kan via de API thema's, locaties en kampmomenten wissen (G1).
2. Het keuringsscherm Nakijken is op desktop onbruikbaar: elke rij is 900 px hoog (G2).
3. Wie op desktop niet is ingelogd, landt op de dode oude app in plaats van op `/login` (G3).
4. Een bak kan vastlopen op "wacht op levering", ook als de bestelling binnen is (G4).

Op de gsm kan kantoor alles keuren; chauffeur, KV en aanvuller liepen zonder blokkade.

Getest op 30/10/2026 van 22:56 tot 23:24, op `origin/main` 74a702a, lokaal op poort 3306 met een kopie van `herfst-test.db` en een lege `APP_PASSWORD`. Niets op prod.

## Eerlijk: wat niet echt geklikt is

- **Klikken gebeurde meestal met `element.click()` in de echte pagina**, met echte handlers en API-calls, en deels met muisklik of slepen. Dat is geen vinger op een gsm.
- **Foto's zijn een synthetisch PNG-bestand** van 1×1 px op de file-input. Echte camera-invoer is niet getest.
- **De gsm is een browser op 390×844** (ingesteld formaat met mobiele emulatie), geen echt toestel.
- **Via API gedaan in plaats van via een knop (testdata of omdat de knop ontbreekt):**
  - voorraad zetten;
  - tweede thema op Betekom (het scherm laat dit niet toe, zie G8);
  - periode van twee weken en de kampmomenten daarin;
  - sportplannen;
  - gesloten dag;
  - ritten #23 en #24;
  - onderhoud;
  - standaardtijden opslaan (ik vond de velden in het scherm niet met mijn script, dus die pagina is niet beoordeeld);
  - back-up maken en terugzetten (bewust geen bestand gedownload in de browser).
- **Foute pincode en blokkering** zijn getest met dezelfde call als het toetsenblok.
- **De rechtentest** liep op een aparte wegwerpkopie op poort 3397, volledig via de API.
- **Mockups in `design/`:** niet element voor element vergeleken. Ik heb de schermen beoordeeld op bruikbaarheid en de regels uit de prompt.
- **Knopmaat en scroll** zijn voor 23 pagina's gemeten in de beginstand (lijst), niet in elk detail of elke dialoog. Afgesneden tekst is alleen beoordeeld op de schermafdrukken die ik nam.
- **Niet getest:**
  - slepen van stops op desktop (die zijn er niet: er zijn 0 sleepbare elementen, alleen ▲▼);
  - een echte KV-telling op Abdijschool;
  - Locaties › Kaart, Bakken, Thema's, Pool en Catalogus verder dan laden en links verzamelen;
  - de echte nachtback-up om 03:00 (alleen de lijstregel);
  - tijdzone op een UTC-server.

## Testpersonen in deze kopie

- Kantoor: Claude (API), persoon 10.
- Chauffeur: Test Chauffeur harnas, persoon 13.
- Coördinator: Tine Coord (aangemaakt via Personeel).

## Per scenario

### A. Inloggen en schil: DEELS

| Stap | Uitkomst |
|---|---|
| Tabs kantoor | Vandaag, Transport, Voorraad, Meldingen, Meer |
| Tabs chauffeur en coördinator | Vandaag, Ritten, Stockage, Meldingen, Meer |
| Foute pincode | 5× 401 "Ongeldige pincode", daarna 429 "Te veel mislukte pogingen — probeer over 300 seconden opnieuw" |
| Niet uitgenodigd | 403 "Kantoor moet je eerst uitnodigen om een pincode te kiezen" |
| Eerste pincode na uitnodiging | Lukt, maar zonder tweede invoer ter controle (G27) |
| Ingelogd blijven | Na herladen en navigeren ingelogd |
| Niet ingelogd op gsm | `/login?terug=…`, na inloggen terug op de juiste pagina |
| **Niet ingelogd op desktop** | **Oude app op `/` (G3)** |
| Meer, kantoor | Planning, Materiaal, Locaties, Beheer, Waar staat, Contacten, Periode, pincode, Weergave, Uitloggen: alle links wijzen naar bestaande pagina's. Waar staat → `/bakken`, Contacten → `/locaties` |
| Meer, coördinator | Alleen Tekorten, pincode, Uitloggen |
| Terugknop | Rooster → Kampmomenten → Meer: klopt |
| `/rit/` en `/kv/` | Zonder de tabbalk van de app (de KV-pagina heeft haar eigen vier tabs) |
| Chauffeur op kantoor-URL | Gsm: elke kantoor-URL → `/vandaag`. Desktop: idem, behalve `/personeel` → oude app (G3) |
| Coördinator op kantoor-URL | Gsm: `/nakijken`, `/personeel`, `/themas` → `/vandaag`, `/tekorten` mag |

Eén keer stuurde `/ritplanning` kantoor op gsm naar `/vandaag`, vlak na het wisselen van rol in dezelfde browser. Een tweede poging lukte. Vermoedelijk een achterhaalde `sporty-rol`, en dus deels een gevolg van mijn testopstelling (G31).

### B. Planning: DEELS

- **Rooster:** weekrooster met labels werkt.
- **Thema op twee locaties:** Holderdebolder op Abdijschool én Betekom geeft "⚠ Dubbel 1", met de tekst "⚠ KL2 Holderdebolder staat deze week ook in Abdijschool Vlierbeek". Maar die situatie kan niet via het scherm ontstaan (G8).
- **Wissel:** de dialoog toont 80 opties met "voorstel · vrij deze week, niet eerder op deze locatie". Na het kiezen wordt Dubbel 0.
- **Wisselen zonder melding:** kan niet in het rooster, de knop bestaat alleen bij een melding (G9).
- **Herhaald:** in een periode van twee weken geeft de API `herhaald:1`. Alleen via de API nagelezen, niet op het scherm gezien.
- **Gesloten dag:** Betekom woensdag 4/11 gesloten staat in de Periodes-API, maar `/api/rooster/week` geeft geen enkele melding (tellers ongewijzigd). Twijfelpunt (G10).
- **Gedeeld materiaal:** het tabblad vult ("Nodig deze week 4"). Tekort op springkasteel gemeld: "◐ Klein springkasteel - jungle: 2 nodig". Blazer, springdier en fiets niet apart getest.
- **Sportrooster:** Base hockey (1 set) op ma–wo Abdijschool en do–vr Betekom geeft één verhuistaak #201, "wo 4/11 avond, Abdijschool Vlierbeek → Betekom".
- **Te veel sets:** "ma–wo 2 nodig, 1 sets" rood, met "voorstel: Betekom ma–wo Kinball (5 vrij)". Toepassen werkt: "Toegepast: nu Kinball", tekort weg, Verhuis 1.
- **Verbieden:** behalve G8 verbiedt niets. Capaciteit vraagt alleen "Dat mag (geen verbod), maar het wordt gelogd".
- **Klaar voor de start:** thema's 2 van 2, KV's 2 van 2, geen dubbel, gedeeld past, leveringen 1 van 1, genoeg sets. Klopt met wat ik zag; dit las ik vóór de sportplannen en de gesloten dag.

### C. Transport: DEELS

- Taak op rit zetten (dagkop "2 open" → "→ aan rit") werkt. De rit gaat naar 50/20 met "⚠ 50 stuks op 20 plaatsen".
- **Waarschuwingen op rit #23 (Test Bus):** "14 stuks op 10 plaatsen · voertuig dubbel: ook op rit #24 (09:30–17:00) · voertuig in onderhoud · ⚠ bestuurder niet gekoppeld".
- **Na wissel naar Camion 1:** capaciteit, dubbel en onderhoud weg op #23, dubbel weg op #24. De naam-⚠ blijft terecht.
- Stops wisselen met ▲▼ werkt. Slepen van rit in de agenda werkt (10:15), maar er bleef kort een spookblok staan.
- Bestuurder wisselen: op desktop geen keuzelijst in het ritdetail (G12), op gsm wel.
- Klaarzetten: desktop "Klaarzetten", gsm "Goedkeuren" (G30). Capaciteit vraagt bevestiging.
- **Voertuigenpagina:**
  - toevoegen "Test Bus" lukt;
  - onderhoud via API;
  - verwijderen geweigerd: "Test Bus" staat nog op 2 komende ritten en kan niet verwijderd worden. Kies eerst een ander voertuig voor die ritten.

### D. De hele keten met meldingen: DEELS (kern)

**D1. Chauffeur rijdt op gsm.** Laden, lossen en aankomen op beide stops werkt, rit op "gedaan". Melding "Iets anders" geeft de toast "✓ Gemeld aan kantoor en Test KV Betekom", kantoor van 0 naar 1 melding, ook onder Beslissen.

**D2. Wijziging na klaarzetten (bekend gat):**

| Soort wijziging | Melding aan bestuurder? |
|---|---|
| Voertuig | **Ja**: "datum, voertuig of bestuurder is aangepast" |
| Tijd (slepen) | **Ja**: "nu 2026-10-30 om 10:15" (ruwe datum) |
| Bestuurder | **Alleen de oude** (Jesse); de nieuwe (Jeroen) krijgt niets (G6) |
| Stops wisselen (▲▼) | **Nee** (G5) |
| Stop ontkoppelen (✕) | **Nee** (G5) |
| Stop toevoegen | **Nee** (G5) |
| Klaarzetten zelf | **Nee**: twijfelpunt (G28) |

**D3. KV via link.** F40 met 23 stuks:
- klopt: Politiepak;
- tekort met notitie: Prints 3 van 5 "2 prints lagen niet in de bak";
- kapot met foto: Fluitje;
- kapot én te veel: Fietsspelletjes;
- te veel: Bellenblaas +3;
- Rest klopt: "14 stuks ingevuld";
- twee aanvragen.
Kantoor kreeg één melding per aanvraag en één "Telling verstuurd · Betekom".

**D4. Kantoor in Nakijken.**
- Desktop: technisch werken de keuzes, zichtbaar is het kapot (G2). Ik zette ze via de keuzelijsten in de pagina.
- Gsm: regel per regel, goed bruikbaar ("Regel 1 van 11", voorstel en voorraad op één scherm).
- Alle zeven acties zijn gekozen: herstellen, afschrijven + bestellen, aanvaarden, bestellen, uit pool, naar pool, laten staan.
- Afronden: "✓ Keuring afgerond · 3 bestelling(en)".
- **Aanvraag afgewezen (20 ballonnen):** nergens werk, klopt. KV ziet "afgewezen". Geen reden gevraagd.
- **Aanvraag goedgekeurd (4 stoepkrijt):** ook nergens werk (G7).

**D5. Tekorten en D6. Aanvullen: voorraad op Rozenweg.** Startstand zette ik zelf.

| Stuk | Start | Actie | Na afronden keuring | Na aanvullen |
|---|---|---|---|---|
| Kaartjes klein | 100 | uit pool 6 | 100 | 4 van 6 → 96 ("4 van 6 gedaan"), rest → 94; ontvinken → 96, opnieuw → 94 |
| Woordkaartjes | 0 | bestellen 2 | 0 | Bestelling binnen → 2, vink → 0, terugzetten → 2, vink → 0 |
| Fluitje | 10 | afschrijven + bestellen | 10 | zonder foto geweigerd ("tik eerst op 📷"), met foto → 9 |
| Politiepet | 10 | herstellen | 10 | 10, label "zelf tellen" (G25) |
| Bellenblaas | 5 | naar pool 3 | 5 | **5, verwacht 8** (G11) |
| Prints | 20 | bestellen 2 | 20 | Bestelling binnen → 22, **nooit afvinkbaar** (G4) |
| Groot, Fietsspelletjes, Post-it | 30 / 5 / 5 | aanvaarden / aanvaarden / laten staan | gelijk | geen handeling |

- De voorraad daalde nergens dubbel, ook niet bij ontvinken en opnieuw vinken.
- "Bak klaar" blijft uit bij (4/6) en (5/7) omdat Prints wacht. Daardoor heb ik "Bak klaar" nooit met succes kunnen drukken (G4).
- **Deels binnen bestaat niet** (G13).
- Bestellen zonder KV-melding: "+ Bestelling" werkt ("Bestelling bewaard"). Daarna niet verder gevolgd.
- **Tellers:** kantoor-Meldingen ging 0 → 1 → 3 → 4 → 7, en na openen van één melding naar 6. De melding landt in Nakijken. Chauffeur-Meldingen stond op 2 na de wijzigingen. Coördinator kreeg Bestelling-binnen-meldingen (3 zichtbaar).

### E. Aanvuller meldt zelf: GROEN op de werking, DEELS op zichtbaarheid

- Kapot zonder foto geweigerd: "Kapot melden vraagt een foto: tik op 📷". Met foto lukt.
- Weg zonder foto lukt (vrije naam "Rode hoepel").
- ⚠ staat bij elk open stuk, en de knop "⚠ Kapot of weg melden" in de bak. De keuzelijst toont alleen de stukken met een handeling plus vrije naam, niet alle 23 (G24).
- **+ Melding zonder bak:** werkt, staat als "— Losse melding" op Nakijken en de aanvullijst.
- Twee keer melden telt op: Politiepet ×3.
- Voorraad gelijk: 10.
- Keuring heropent: F40 van `nagekeken` naar `te_keuren`.
- Kantoor beslist en rondt af op gsm: "✓ Keuring afgerond · 5 bestelling(en)". Aanvullijst daalt naar 3 handelingen, Losse melding aanvaard en weg.

**Beoordeling: ziet men dat kantoor opnieuw moet afronden?** Maar half.
- De enige actieve signalen zijn één melding en de rij in Nakijken.
- Op Vandaag stond tijdens het heropenen "Nakijken · 3" over EHBO-conflicten en tekorten, geen woord over 2 te keuren.
- De tabteller Voorraad bleef 3.
- Wordt de melding gelezen zonder af te ronden, dan kan het stil blijven liggen (G14).

**Waar staat een losse melding?** Onder Nakijken, in de lijst van week 1, zonder bakcode en met "stockage · wk · 0/1 geteld" (lege week). Te vinden, wel onduidelijk (G26).

### F. Beheer en de rest: ROOD door de rechten

- **Rechten:** alle 383 routes geveegd als chauffeur, coördinator, monitor (alleen GET) en anoniem. Zie G1.
- **Anoniem:** geen enkele data-API open; alleen pagina's (die zelf doorsturen), `login-status`, `sw.js` en `manifest.json`.
- **KV-link:** vreemd token 403, vreemde bak 403, KV-token op een admin-API 401.
- **Pincode:** `/api/personeel` geeft geen pincode terug.
- **Broncode:** `/server.js`, `/lib/db.js`, `/sporty.db`, `/.env`, `/package.json`, `/CLAUDE.md` en encoded varianten geven 200 met de oude `index.html`, niet de inhoud. Dus niet te downloaden. Wel krijgt elke onbekende URL de oude app (G3).
- **Back-up:**
  - nu maken: `sporty-hand-2026-10-30-232104.db`, 1,2 MB, in de lijst als "handmatig";
  - nachtback-up staat in de lijst als "elke nacht om 03:00 · 14 bewaard";
  - terugzetten: "Database vervangen — server herstart nu", de server stopte, ik startte hem zelf opnieuw (op Railway herstart die vanzelf);
  - de verhuistaak die ik na de back-up maakte was daarna weg. Teruggezet klopt.
- **Standaard tijden:** vertrek 07:30 geeft `standaard_vertrek 07:30`, verhuis-avond 18:15 geeft nieuwe verhuistaak #202 om 18:15. De oude taak behoudt 17:00. Werkt.
- **Doorklikken op Vandaag desktop:** zie G15. Melding-link landt goed.
- **Printlijst aanvullen is stuk** (G16).

### G. Oude schermen en bugs: ROOD

- **Oude app:** `/`, `/index.html` en alle `/#…` tonen de oude pagina met lege streepjes. Het inline-script van `index.html` geeft in de browser "Uncaught SyntaxError: Unexpected end of input", en ook een aparte parsecontrole faalt. Die pagina is dus dood.
- **Bereikbaar vanuit de menu's:**
  - Vandaag desktop: "alles ›" naar `/#transport-noden`, `/#transport-plan`, `/#overzicht?conflicten`, `/#transporten`, `/#kampplanner`;
  - in code: Kampmomenten (`/#planning`, `/#overzicht?conflicten`), Nakijken "Bak openen" (`/#materiaal?bak=`), Tekorten (`/#catalogus`).
- **De 20 GEVONDEN van T1:**

| T1 | Stand |
|---|---|
| G1 kantoor desktop niet visueel | **Gedaan, en leverde G2 hieronder op** |
| G2 tijden UTC | **Waarschijnlijk weg** (`process.env.TZ` in `server.js`); niet op UTC-server getest |
| G3 502 bij deploy | Niet te testen lokaal |
| G4 wissel alleen aangrenzend | Niet opnieuw getest |
| G5 spoedrit zonder chauffeur | Niet opnieuw getest |
| G6 stoptijd volgt vertrek niet | **Nog aanwezig**: vertrek 10:15, eerste stop 11:15; #23 09:00 met stop 17:00 |
| G7 bakcodes | Data, niet opnieuw getest |
| G8, G9 herinnering | Niet opnieuw getest |
| G10 tellen zonder levering | Niet opnieuw getest |
| G11 draaiboek | Niet opnieuw getest |
| G12 capaciteit op gedane rit | **Nog aanwezig**: Voertuigen › Camion 1 "Rit #22: 50 stuks op 40 plaatsen", gsm-ritplanning idem |
| G13 te veel in regels | **Nog deels**: lijst "tekort 12 · te veel 5 · kapot 3", kop "tekort 4, te veel 2, kapot 3" |
| G14 actie zonder aantal | Niet opnieuw getest (de gsm-keuze stuurt het aantal goed mee) |
| G15 bestelling te vroeg afvinken | **Weg**: ⏳ uitgeschakeld (maar zie G4) |
| G16 logboek zonder naam | **Weg**: "Test Chauffeur harnas (rit #22)" |
| G17 datumformaten | Niet opnieuw gezien in Nakijken-historiek |
| G18 "KV KV" | **Nog aanwezig** als "KV Test KV Betekom" (testnaam) |
| G19 teksten | **Nog deels**: "1 ritten", "1 sets", "stuks" naast "bakken" |
| G20 kapot melden zonder bakcode | Niet opnieuw getest |

## GEVONDEN

### BLOKKEERT

**G1. Rechtenlek: chauffeur en coördinator kunnen kerngegevens wissen.**
- Scherm: API, elke breedte.
- Verwacht: 403 buiten eigen werk.
- Gezien, als chauffeur op de wegwerpkopie:
  - `DELETE /api/themas/4084` 200, thema's 184 → 183;
  - `DELETE /api/locaties/36` 200, locaties 40 → 39;
  - `DELETE /api/kampmomenten/167` 200, kampmomenten 2 → 1;
  - `PUT /api/locaties/29 {name:"GEHACKT"}` 200, naam gewijzigd.
- Ook niet geweigerd (200 op id 1 of 400/404 na de poort, zonder rolcontrole): bakken, vaste bakken, attributen, gedeeld, sport, standaard, kleurenborden, personeel-shifts, ritten, transport-genereer, klaarzetten, `nakijk/*`, periodes aanmaken en wissen. De coördinator kreeg dezelfde codes.
- Wel geweigerd (403): back-up, export, nakijken, tekorten voor chauffeur, logboek, personeel schrijven.
- Stappen: chauffeur inloggen, token nemen, `DELETE /api/themas/<id>` met header `x-auth-token`.

**G2. Nakijken op desktop onbruikbaar.**
- Scherm: `/nakijken`, 1920×900, detail van een bak.
- Verwacht: een tabel per regel.
- Gezien: de kopregel is 900 px hoog met kolommen onder elkaar, elke regel 900 px, eerste stuk op y=2120, scrollhoogte 21769.
- Oorzaak: `public/app-schil.css:20` `.tel{display:flex;flex-direction:column;min-height:100vh}` botst met `.kopr.tel` en `.r.tel` uit `nakijken.css`. `nav.js:53` laadt de schil-CSS ook op desktop.
- Stappen: KV dient in, kantoor opent `/nakijken` op desktop, klik de bak.

**G3. Niet ingelogd op desktop = dode oude app.**
- Scherm: elke kantoorpagina, 1920.
- Verwacht: `/login`.
- Gezien: `location.href='/'` (o.a. `ritplanning.js:143`) toont de oude app met lege streepjes, zonder inlogkans. Ook bij een verlopen sessie en bij een chauffeur op `/personeel`. Alleen op gsm stuurt `nav.js:80` naar `/login`.
- Stappen: uitloggen op desktop of token wissen, open `/ritplanning`.

**G4. Bak loopt vast op "wacht op levering".**
- Scherm: `/nakijken` → `/tekorten` → `/aanvullen`.
- Verwacht: afvinkbaar, want Tekorten zegt "1 handeling (F40) nu al afvinkbaar (uit voorraad)".
- Gezien: regel 292 Prints blijft ⏳ `kan_afvinken:false`, ook na "Bestelling binnen" (voorraad 20 → 22). "Bak F40 klaar" kan nooit.
- Oorzaak (uit de code): de tak voor extra bestellingen rond `routes/tekorten-overzicht.js:209` zet de regel niet op binnen.
- Stappen: geef een artikel voorraad, kies in Nakijken "Bestellen", rond af, kijk in de aanvullijst. Tekorten › Besteld › Bestelling binnen verandert niets.

### HINDERLIJK

**G5. Geen melding bij drie ritwijzigingen.** Ritplanning, na klaarzetten: stop wisselen, ontkoppelen en toevoegen geven geen melding aan de bestuurder. Stappen: zet rit klaar, doe de wijziging, lees `/api/meldingen` van de chauffeur.

**G6. Nieuwe bestuurder krijgt geen melding.** Gsm-ritdetail, rit klaargezet, Jesse → Jeroen. De melding gaat naar Jesse (persoon 3), Jeroen krijgt niets.

**G7. Goedgekeurde aanvraag verdwijnt.** Vandaag › Goedkeuren van "4 × Extra stoepkrijt". Verwacht: taak, tekort of handeling. Gezien: alleen status "goedgekeurd" bij de KV, 0 taken, geen tekort, geen aanvullijst. Twijfel of dit zo bedoeld is.

**G8. Themakeuze verbergt dubbele thema's.** Kampmomenten › Thema toewijzen: "Alleen thema's die in die week nergens anders gepland zijn." Holderdebolder staat er niet tussen, dus via dit scherm kan de melding niet ontstaan. Dat botst met "meldingen mogen nooit iets verbieden". Ik zag niet of andere schermen het wel toelaten.

**G9. Rooster: wisselen kan alleen bij een melding.** `/rooster`, detail: `data-wissel` staat alleen op meldingen. Een gewoon thema is niet aanklikbaar. Twijfel; vergelijk met mockup-planning-v3.

**G10. Gesloten dag geeft geen melding in het rooster.** Betekom woensdag 4/11 gesloten met een kampmoment ma–vr: tellers ongewijzigd. Twijfel; alleen de API nagelezen.

**G11. Terug naar pool verhoogt de voorraad niet.** `/aanvullen`, Bellenblaas × 3, vink: voorraad bleef 5. Verwacht 8. Twijfel of de pool iets anders is dan Rozenweg, maar ik zag nergens een stijging.

**G12. Desktop: bestuurder niet te wisselen in het ritdetail.** Ritplanning 1920: alleen tekst, geen keuzelijst (gsm heeft die wel). Andere weg op desktop niet gevonden.

**G13. Deels binnen bestaat niet.** Tekorten › "Bestelling binnen" vraagt geen aantal en boekt alles: besteld 2 → voorraad +2. Prompt vroeg deels binnen; niet mogelijk.

**G14. Heropende keuring is niet zichtbaar op Vandaag.** Zie scenario E. Vandaag noemt de 2 te keuren niet, tabteller Voorraad toont iets anders. In `routes/vandaag.js:170` staat een voorwaarde op de week; ik heb niet uitgezocht of die dit veroorzaakt.

**G15. Dode links op Vandaag desktop.** Elke "alles ›" naar de oude app. Stappen: `/vandaag` op 1920, klik "alles ›" bij Beslissen. Ook Nakijken "Bak openen" en de code-links uit scenario G wijzen daarheen.

**G16. Printlijst aanvullen werkt niet.** `/aanvullijst-print`: "De lijst kon niet geladen worden. Geen verbinding — probeer het zo opnieuw." Er gaat geen API-call uit. De pagina laadt alleen `nakijken.js`. Getest op 1920, twee keer.

**G17. Console-fout op elke Nakijken.** `nakijken.js:272` `$('s-tekorten')` is null. Daardoor blijft "Periode: …" staan op desktop.

**G18. Kantoorschermen op gsm zijn desktop-tabellen.** `/personeel`, `/kampmomenten`, `/bakken` op 390: tabel afgesneden aan de rechterkant, geen eigen gsm-versie. Botst met de MOBIEL-REGEL. De pagina scrolt niet horizontaal, de kolommen zijn gewoon niet te zien op het eerste scherm. Logboek-knop 38 px.

**G19. Rit-link alleen in een toast.** Ritplanning desktop: "Rit-link: http://…" verdwijnt na enkele seconden, zonder kopieerknop gezien.

**G20. Kop van rit-link klopt niet.** "0 van 20 stuks geladen" bij 36 + 14 = 50 stuks; 20 lijkt het aantal regels.

**G21. Dubbele rij in Ritplanning.** Rit van Jesse op 6/11: rij "Jesse" met de rit én een lege rij "Jesse" met "+ rit". Gezien nadat ik de rit via de API met `chauffeur:'Jesse'` maakte, dus mogelijk alleen bij ritten zonder gekoppeld personeelslid.

**G22. Melding met oude tekst.** Tweede kapot-melding van Politiepet telt op tot ×3, de kantoormelding blijft "Politiepet (2×)".

**G23. Oude rol kan verkeerd sturen.** Zie G31. Verder niet hard gemaakt.

### COSMETISCH

**G24. Melden in bak:** keuzelijst met alleen stukken met handeling, en afgevinkte regels hebben geen ⚠. Een bak zonder handelingen is niet te openen.

**G25. Politiepet "herstellen" krijgt het label "zelf tellen".** Onbegrijpelijk.

**G26. Losse melding:** "stockage · wk · 0/1 geteld" met lege week, en telt mee in "handelingen" terwijl ze niet afvinkbaar is.

**G27. Eerste pincode zonder bevestiging.** Een tikfout sluit iemand buiten. Pincode wijzigen in Meer gebruikt nog een kale `prompt()`.

**G28. Klaarzetten geeft geen melding aan de chauffeur.** Twijfel. Na een wijziging blijft de knop "Klaargezet ✓".

**G29. Teksten:**
- "nu 2026-10-30 om 10:15";
- "Hele zomer" als tab bij een herfstperiode;
- "Chauffeur Test Chauffeur harnas" dubbel in de melding;
- "Keuring afgerond · 5 bestelling(en)" telt oude mee;
- Periode twee keer op Meer;
- "Regel 1 van 11" ook bij al beslist;
- Back-up zegt "Bakken 466", het Bakken-scherm "551".

**G30. Zelfde actie, twee namen:** desktop "Klaarzetten", gsm "Goedkeuren".

**G31. Eén onverklaarde doorsturing.** Zie scenario A. Mogelijk door mijn rolwissels in één browser.

**G32. Gsm-ritplanning toont week "26–30/10" en dagen ma–vr.** Weekendritten lijken niet bereikbaar. Twijfel, niet getest met een weekendrit.

**G33. Chauffeur op desktop** ziet op `/vandaag` de hele kantoorbovenbalk (Planning, Beheer…). De doorsturing vangt het op, het oogt verkeerd.

### Beveiligingsopmerking buiten de test

Bij de blokkeertest logde mijn eerste "foute" pincode toevallig echt in als Stijn. Stijn is de enige in deze database met een oude `sha256`-hash, en de testdatabase is afgeleid van `sporty.db`. Ik heb dit niet op prod geprobeerd. Advies aan de hoofdchat: controleer die pincode en laat hem wijzigen. De waarde staat bewust niet in dit verslag; ik geef ze in de chat.
