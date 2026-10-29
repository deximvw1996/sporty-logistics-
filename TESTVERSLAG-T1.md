# TESTVERSLAG T1: generale repetitie op PROD, vóór Maxim

**Wie en wanneer:** testchat T (Opus), do 29 okt 2026, 20:18 tot 20:56 (limiet 2,5 u).
**Waar:** prod `https://sporty-logistics-production.up.railway.app`, periode "Herfst 2026 FICTIEF" (#2, actief).
**Code:** `origin/main` 63c5e26. Tijdens de run deployde de hoofdchat nog twee keer (20:27 en 20:40–20:42; zie G3).
**Links:** gehaald met `generale-repetitie.mjs --doel=prod`. Dat is idempotent: er is niets dubbel aangemaakt. `--opruimen` is niet gebruikt.

## Hoe getest

- **Chauffeur en KV:** `/rit/<token>` en `/kv/<token>` zijn publiek (200 zonder Basic auth). Die heb ik **echt in de in-app browser op 390 × 844** gespeeld:
  - kliks en DOM-dumps;
  - knopmaten gemeten: alle knoppen ≥ 44 px, `scrollWidth` 390, geen horizontale scroll;
  - console leeg.
- **Lange reeksen klikken via JS:** gebruikt voor tot 28 bakken laden of lossen per stop en voor "Rest klopt" per bak. De knoppen zijn dezelfde; elke uitkomst is teruggelezen via `/api/rit-token/<t>/data` en `/api/kv/<t>/data`.
- **Foto's:** een testfoto (canvas-JPEG) ingespoten in het file-input, zoals een gsm-camera dat zou doen.
- **Kantoor (desktop) — NIET in de browser.** De kantoorpagina's zitten achter Basic auth op een productiesite. Daar typ ik geen wachtwoord in een browser (veiligheidsregel van de testchat).
  - Kantoor liep daarom volledig via **dezelfde API-calls die de pagina's doen**: nagelezen in `public/*.js`, met de body die de pagina stuurt.
  - Alle 7 kantoorpagina's zijn gecontroleerd op HTTP 200 (`/vandaag`, `/ritplanning`, `/taken`, `/nakijken`, `/kampmomenten`, `/bakken`, `/aanvullijst-print`).
  - **Niet gecontroleerd op desktop 1920 × 900:** opmaak, afgesneden tekst, knopmaten en console van de kantoorpagina's. Dat stuk moet Maxim of de hoofdchat nog op het scherm doen.

---

## Stap 1 — do 29 okt, vooruitkijken: **GROEN** (met opmerkingen)

**`/api/vandaag`**
- `ritten_morgen` toont 4 ritten:
  - #22 08:00 Jeroen (3 stops)
  - #23 08:00 Jesse
  - #24 09:00 Maxim
  - #25 10:00 Evy (Huurwagen)
- 0 te beslissen.

**`/api/kampmomenten-overzicht`**
- tellers `{"totaal":8,"zonder_thema":0,"zonder_kv":0,"conflict":0}`;
- elk kampmoment heeft een thema, een KV en een transporttekst, bijvoorbeeld "levering vr 30 okt · rit #22 · ophaling vr 6 nov · rit #26";
- de Sportschuur toont als thema "5 themadagen" in plaats van de namen.

**`/api/bakken-overzicht`**
- `{"alle":551,"thema":351,"vast":115,"attribuut":85,"onderweg":0,"incompleet":4}`;
- "waar nu" = "Rozenweg · rek B".

**`/api/ritplanning?week=2026-10-26`**
- vr 30: #22 "56 bakken op 20 plaatsen" en #24 "21 bakken op 20 plaatsen" ✓.

**Opmerkingen**
- Vandaag toont het tijdstip van de **eerste stop** (08:00). Ritplanning en het scriptoverzicht tonen het **vertrek** (07:30). Twee verschillende tijden voor dezelfde rit.
- Alle 8 KV's: `link_gestuurd:false`, hoewel het script de links aanmaakte.
- Er staat "KV KV Noor FICTIEF" (dubbel "KV") in de Ritplanning, de rit-link, de KV-pagina en de historiek.

## Stap 2 — vr 30 okt, leveren (rit #22 Jeroen, gsm): **DEELS**

| Actie | Gezien | Oordeel |
|---|---|---|
| Rit-link openen | "Rit vr 30 okt · GEPLAND · Jeroen · Camionette · 3 stops · 0 van 56 stuks geladen". Stops met 🔒/▲▼ en uitleg "▲▼ wisselt alleen met een andere vrije stop". | GROEN |
| Stop 1 De Kraal laden | Gegroepeerd per rek (D, H, "OVERIG"); per bak ↑ laden / ↓ lossen. 22/22 geladen. | GROEN, met opmerkingen (G7, G8) |
| Stop 2 Sportschuur, "Past niet / niet gevonden" | Toast: "Tik op de naam van het stuk dat niet mee kan". Tik op L17 opent een sheet met "Past niet meer in de wagen / Niet gevonden / Kapot + opmerking". "Markeer: blijft open" → "✓ Gemarkeerd: blijft open voor kantoor". | GROEN |
| Teller | Kop: "ONDERWEG … 55 van 55 stuks geladen". Het draaiboek belooft "alles op 1 na". De bak die niet mee mocht, verdwijnt uit de noemer. | DEELS (cosmetisch) |
| Twee vrije stops wisselen | Kantoor zette stop 1 op vrij (`PUT /api/transport-taken/196 {"slot":"vrij"}`). **Alle ▲▼ bleven uitgeschakeld**: wisselen kan alleen met de *aangrenzende* stop, en stop 2 stond vast. Pas toen stop 2 ook vrij stond, wisselde De Kraal met de Sportschuur, inclusief de tijden. | **ROOD voor het draaiboek** (G4) |
| Per stop aankomen + lossen | 3/3 stops "gedaan"; API `{"stuks":55,"geladen":55,"gelost":55}`, rit "gedaan". | GROEN |
| Coördinatorrit #25 (Evy, Huurwagen) | 8/8 geladen en gelost, "GEDAAN · Rit afgerond ✓". | GROEN |
| Rest-taak bij kantoor | `/api/taken-overzicht`: taak 213 `soort:"rest"`, "vr 30 okt · Rozenweg → Sportschuur · 1 bak". `/api/vandaag` › inplannen: "Rest van rit #22: Rozenweg → Sportschuur · vrijdag 30 okt · 1 stuks · nog geen rit" met de knop "Op een rit zetten". Het draaiboek zegt nog "⚠ Ze staat er niet": dat is **verouderd**, gat #2 is gedicht. | GROEN |
| Ritplanning capaciteit | #22 houdt "⚠ 55 bakken op 20 plaatsen" vast, ook nadat de rit "gedaan" is. | DEELS (G12) |

## Stap 3 — rest wegbrengen: **DEELS**

- `POST /api/ritten {datum:2026-10-30, vertrek:"15:00", personeel_id:2, taak_ids:[213]}` → rit #29.
- Klaarzetten → `klaarzet_door:"Claude (API)"`; de Ritplanning toont `kz=klaar`. De rit-link is aangemaakt (`/rit/qmycm7gjz1`).
- **Probleem:** de stop op rit #29 houdt tijd **08:45**, terwijl de rit om 15:00 vertrekt (G6).

## Stap 4 — tellen en melden (KV-links, gsm): **GROEN**, met één 502

**Overzicht KV.** Nieuwe pagina met 4 kaarten: "Levering gepland / ✓ geleverd", "Ophaling gepland vr 6 nov 14:45", "Tellen · 0/12 bakken", "Aanvragen". Onderaan een navigatiebalk.

**Tellen.** Per stuk "✓ 10" of "anders" (Geteld − / +, Kapot − / + / 📷, Notitie), plus "Rest klopt ✓" en "Bak klaar". Dat is een grote verbetering tegenover de vorige doorlichting.

| Locatie | Wat | Uitslag | Oordeel |
|---|---|---|---|
| Abdijschool, Boutersem, Betekom, Rotselaar, De Kraal | Alles klopt, versturen | 12, 8, 26, 9 en 22 bakken; telkens "✓ Telling verstuurd naar kantoor", overzicht "Alles geteld". | GROEN |
| Abdijschool | **Eerste verzending** | Toast "Dat lukte niet (502)." (deploy op prod, G3); tweede poging lukte. | DEELS |
| De Waaier | F58 Mölky: geteld 0 + notitie "Molky-set niet teruggevonden na het spel" | Rode pil "tekort"; lijst "⚠ Mölky 0 van 1 tekort". | GROEN |
| De Ark 3 | G13 krantenstokken kapot 1 + foto; stoepkrijt geteld 3 i.p.v. 1 | Oranje "kapot" met fotootje en blauw "te veel". Foto opgeslagen als `/uploads/nakijk/2026/db3ef….jpg`. | GROEN |
| Sportschuur | Niets geteld | — | GROEN |
| Boutersem | Aanvraag | "Materiaal vragen" (nu mét aantal-veld): "extra ballen", aantal 6 → "6 × extra ballen · nieuw" en "✓ Verstuurd naar kantoor". | GROEN |
| Betekom | Kapot melden | Keuzelijst per stuk (nieuw) of "zelf typen": "oven kapot" + foto → "oven kapot (foto) · nieuw". | GROEN |
| Ophaalrit #26 | ⚠ Probleem → "🚪 Locatie gesloten / geen sleutel" | "✓ Gemeld aan kantoor en Seppe". De melding koppelt aan de "volgende" stop (De Kraal) zonder te vragen welke stop. | GROEN |

**Opmerkingen**
- **Dubbele codes** op verschillende bakken: H70 ×2, I51 ×2 (Abdijschool), K43 ×2 (De Waaier), H31 ×2 (De Kraal) en I37 ×2 (Sportschuur) (G7).
- Betekom: **alle 26 bakken zonder code** ("—"; chauffeur: alles onder "OVERIG").
- "1 soorten" en "26/26 bakken" terwijl daar attributen in zitten.
- Bij De Ark 3 toont de lijst voor G13 enkel "kapot" en niet ook "te veel".
- "Telling versturen (0/9)" is al klikbaar voordat er iets geteld is (wel met uitleg).
- De Ark 3 telt bakken van levering #23, die nooit gereden is: geen waarschuwing (G10).

## Stap 5 — kantoor beslist en keurt: **DEELS**

**`/api/vandaag` › beslissen**
- Precies de 3 verwachte items:
  - 🚪 "Chauffeur Jeroen bij De Kraal: locatie gesloten · KV Seppe ook verwittigd" (knop Afgehandeld);
  - 💥 "oven kapot (foto) · Betekom" (Afwijzen / Goedkeuren + spoed);
  - 📩 "6 × extra ballen · Boutersem".
- **Tijden "19:40–19:42" terwijl het 20:40 was** (G2).

**`/api/vandaag` › nakijken**
- "90 tellingen te keuren" en "1 tekort open uit vrijdagcontroles · 0 besteld".

**`/api/nakijken`**
- Vóór de keuring: `{"te_keuren":90,"niet_geteld":8,"met_tekort":1,"met_kapot":1,"nagekeken":0}`; Sportschuur `niet_geteld`.
- Uitslag G13: "te veel 1 · kapot 1". Die "1" telt **regels**; het stoepkrijt staat er met `te_veel:2` (G13).

**Keuren** (`PUT /api/nakijken/regel/:id`)
- Mölky → `bestellen`;
- krantenstokken → `afschrijven_bestellen`;
- stoepkrijt → `naar_pool`.
- Daarna `POST /api/nakijken/afronden` met alle 90 → "afgerond 90, overgeslagen 0, bestellingen 2, afschrijvingen 1". Te keuren 90 → **0**, nagekeken **90** ✓.

**Herinnering naar de Sportschuur**
- `POST /api/nakijken/herinnering {kampmoment_id:174}` → "Kantoor vraagt je de bakken van Sportschuur (week 1) te tellen en te versturen."
- **Op de KV-pagina** staat ze enkel onder tabblad *Aanvragen*. De overzichtskaart zegt nog "Aanvragen · Nog geen aanvragen" (G9).
- **Bij kantoor** verschijnt de eigen herinnering in *Vandaag › Beslissen* als iets om te beslissen (G8).

**Aanvullijst**
- `GET /api/aanvullijst` geeft 3 handelingen ✓:
  - F58 Mölky ×1, bestelling, "wacht op levering";
  - G13 krantenstokken ×1, afschrijven, "nieuwe via bestelling";
  - G13 stoepkrijt ×2, "terug naar de pool".
- Eerste keer stonden **alle aantallen op 0**. Ik had `kantoor_actie` gezet zonder `kantoor_aantal`; de pagina stuurt dat wel mee (`public/nakijken.js:265`). Rechtgezet met het aantal erbij. Robuustheidspunt: zie G14.
- `/aanvullijst-print` → 200 met HTML "Aanvullijst Rozenweg — Sporty logistiek".

**Spoed**
- Oven "Goedkeuren + spoed" → taak 214 "ma 2 nov 09:00 · Rozenweg → Betekom · oven kapot ×1" op een nieuwe rit #30.
- Sterk verbeterd tegenover vroeger: er is nu een van/naar en een datum in de kampweek.
- Maar: **rit #30 zonder chauffeur of voertuig**, zonder waarschuwing, en niet op Vandaag › Inplannen (G5).

## Stap 6 — aanvullen (coördinator): **DEELS**

- In `/api/personeel-lijst-login` staat **geen coördinator en geen FICTIEF-KV**: alleen 3 chauffeurs en 4 kantoorleden. Daarom afgevinkt als kantoor.
- `POST /api/aanvullijst/{501,558,559}/aangevuld` → `{"klaar":3}` ✓.
- De Mölky-*bestelling* kon al op "aangevuld" voordat ze geleverd was (G15).

## Stap 7 — ophalen vr 6 nov + weekend: **GROEN**

| Rit | Uitslag |
|---|---|
| **#26 (Jeroen, 4 stops)** | De rit-link toont nu de 69 bakken per stop (het gat uit DOORLICHTING-t is dicht). Laden, aankomen en lossen per stop → "GEDAAN · Rit afgerond ✓". Mijn eerste klikreeks liet 7 bakken van de Abdijschool ongelost (herteken-race in mijn script); afgemaakt via "Open stop 2". |
| **#27 (Jesse, 4 stops)** | 29/29 → "GEDAAN · Rit afgerond ✓". |

**Taken**
- `/api/taken-overzicht?week=2026-11-02`: 8 ophaaltaken (204–211) "gedaan" ✓.
- **Weekend:** sportdag taak 212 (za 7 nov) stond al op rit #28 (gemaakt door het script). De Ritplanning toonde "weekend · nog niet bevestigd". Na `POST /api/transport-taken/212/weekend-bevestig`: "weekend · bevestigd door Claude (API)" ✓.

**Opmerkingen**
- #26 vertrekt om 13:00, maar de eerste stop is om 14:00.
- #26 heeft "69 bakken op 40 plaatsen" en is toch zonder stop of keuze afgerond.
- Rit #28 heeft geen bestuurder en geen waarschuwing daarover.
- #27 laadde bij De Ark 3 bakken die nooit geleverd zijn (#23 niet gereden), en bij de Sportschuur de rest-bak L17 (#29 niet gereden). Geen waarschuwing (G10).

## Stap 8 — afsluiten: **DEELS**

**`/api/conflicten` → `[]` (0)**, ook met `?periode_id=2`.
- De route kent geen capaciteitstype: capaciteit leeft alleen als ritwaarschuwing in de Ritplanning.
- Het draaiboek verwacht nog "geen levering themadag" en "locatieconfig onvolledig". Die zijn er niet meer: draaiboek verouderd (G11).

**`/api/wijzigingen?limit=500`** — regels voor elke stap:
- `bakken · rit-link` 154;
- `nakijk_sessies · nakijken · Claude (API)` 90;
- `nakijk_regels · kv-link · Seppe (KV)` 77, enz.;
- verder aanvragen, weekend-bevestig en aanvullen.
- **Alle 175 rit-link-regels staan zonder naam** (`persoon_naam` leeg) (G16).

---

## Wat Maxim na deze run al "gedaan" ziet op prod

- **Rit #22** (Jeroen): gedaan.
  - Stop 1 en 2 waren vrij gezet en gewisseld; de Sportschuur kwam eerst.
  - L17 werd als "past niet" gemeld.
- **Rit #25** (Evy): gedaan.
- **Ritten #23 en #24:** nog gepland. Niet gereden, buiten het draaiboek.
- **Rest-taak 213** staat op nieuwe rit **#29** (vr 30 okt 15:00, Jeroen, klaargezet, link gemaakt). Niet gereden.
- **KV-tellingen:**
  - 7 van de 8 locaties verstuurd;
  - de Sportschuur niet; die heeft een herinnering gekregen;
  - **alle 90 tellingen nagekeken.**
- **Aanvullijst:** 3 handelingen, alle 3 "klaar".
- **Aanvragen en meldingen:**
  - oven (Betekom): **goedgekeurd + spoed** (taak 214, rit #30 zonder chauffeur);
  - ballen (Boutersem): nog **nieuw**;
  - melding "locatie gesloten": nog **open**.
- **Ophaalritten #26 en #27:** gedaan.
- **Weekendrit #28:** bevestigd.

**Wil Maxim het zelf van nul spelen?**
1. `generale-repetitie.mjs --opruimen`.
2. Daarna opnieuw klaarzetten.

Het script is idempotent, maar zet een gedane rit niet terug.

---

## GEVONDEN (op ernst)

### Blokkeert Maxim / de live-week

1. **G1 — Kantoor-desktop niet visueel getest.**
   - Stap: alle. Scherm: `/vandaag`, `/ritplanning`, `/taken`, `/nakijken`, `/kampmomenten`, `/bakken`.
   - Verwacht: een klikcontrole op 1920 × 900. Gedaan: enkel API + HTTP 200, omdat de testchat geen wachtwoord in de browser op prod typt.
   - Reproduceren: n.v.t.
   - Oplossing: Maxim of de hoofdchat doet dit deel, of de testchat krijgt een lokale prod-kloon (`sporty.db` van prod op poort 3306).
2. **G2 — Tijden 1 uur achter (UTC i.p.v. Belgische tijd).**
   - Stap 4/5. Scherm: KV › Aanvragen ("29/10/2026, 19:40"), Vandaag › Beslissen ("melding 19:42"), historiek ("19:40"), aanvullijst `afgerond_op` "19:43".
   - Verwacht 20:40–20:43 (CET); gezien 19:40–19:43.
   - Reproduceren: een KV dient iets in en je vergelijkt met de klok. Vermoedelijk `now()` / `toLocaleString` zonder `timeZone:'Europe/Brussels'` op Railway.
3. **G3 — Elke push naar main geeft tijdens gebruik 502.**
   - Stap 4. Scherm: KV › "Telling versturen".
   - Verwacht: verstuurd. Gezien: "Dat lukte niet (502)." en een Railway-pagina "Application failed to respond" op `/kv/<t>`, telkens tijdens een deploy (20:27 en 20:40–20:42).
   - Data bleef intact; de tweede poging lukte.
   - Tijdens de live-week (2–8 nov) betekent elke deploy een paar seconden 502 voor chauffeurs en KV's. Advies: deployen buiten de laad- en telmomenten. Een automatische herpoging in `kv.js`/`rit.js` bij 502/503 zou helpen.
4. **G4 — Draaiboek stap 2 "twee vrije stops wisselen" kan niet zoals beschreven.**
   - Scherm: rit-link #22.
   - Verwacht: kantoor zet stop 1 vrij en de chauffeur wisselt.
   - Gezien: alle ▲▼ uitgeschakeld. Wisselen kan alleen met de **aangrenzende** stop; stop 2 (Sportschuur) stond vast. De hint "wisselt alleen met een andere vrije stop" zegt niet "aangrenzend".
   - Reproduceren: stops vast-vast-vrij, zet stop 1 vrij en kijk naar de pijlen.
   - Oplossing: het draaiboek aanvullen ("zet stop 1 én 2 vrij") of de wissel laten springen over vaste stops.
5. **G5 — Spoedrit zonder chauffeur valt buiten elk lijstje.**
   - Stap 5. Scherm: Vandaag / Ritplanning.
   - Verwacht: rit #30 (spoed oven, ma 2 nov) vraagt om een chauffeur.
   - Gezien:
     - `chauffeur:""`, `voertuig:""`, `waarschuwingen:[]`;
     - Vandaag › Inplannen is leeg, omdat de taak "al op een rit" staat.
     - Hetzelfde geldt voor weekendrit #28.
   - Reproduceren: Vandaag › oven › "Goedkeuren + spoed".

### Hinderlijk

6. **G6 — De stoptijd volgt de ritvertrektijd niet.**
   - Stap 3. Rit #29 vertrekt om 15:00, maar de stop blijft op 08:45 (de oorspronkelijke tijd van de rest-taak).
   - Reproduceren: `POST /api/ritten {vertrek:"15:00", taak_ids:[213]}` en kijk naar de stops in de Ritplanning.
   - Ook: rit #26 vertrekt om 13:00 en de eerste stop is om 14:00; Vandaag toont de stoptijd, de Ritplanning het vertrek.
7. **G7 — Bakcodes niet uniek of leeg.**
   - Stap 2/4. Scherm: rit-link en KV › Tellen.
   - Dubbel: H31 (De Kraal: "4/5 mandje stro" en "5/5 8 groene bakjes"), H70, I51, K43, I37.
   - Leeg: Betekom heeft 26 bakken zonder code, alle onder "OVERIG".
   - De chauffeur kan op het rek niet zien welke bak het is. Data, geen code. Het bakkenoverzicht kent al de chip "⚠ Incompleet 4", maar dubbele codes worden niet gemeld.
8. **G8 — De eigen herinnering van kantoor komt in Vandaag › Beslissen.**
   - Stap 5. Na `POST /api/nakijken/herinnering` staat "Kantoor vraagt je de bakken van Sportschuur (week 1) te tellen en te versturen. · Sportschuur" als eerste item om te beslissen.
   - Oorzaak: herinneringen worden als `aanvragen`-rij met status "nieuw" bewaard.
9. **G9 — De KV ziet de herinnering niet op het overzicht.**
   - Stap 5. Scherm: KV-pagina van de Sportschuur.
   - Verwacht: een melding bovenaan het overzicht.
   - Gezien: enkel onder tabblad Aanvragen; de overzichtskaart zegt "Aanvragen · Nog geen aanvragen".
10. **G10 — Tellen en ophalen van niet-geleverde bakken zonder waarschuwing.**
    - Stap 4/7.
    - De KV van De Ark 3 kon tellen en versturen, terwijl levering #23 nooit gereden was.
    - Ophaalrit #27 laadde die bakken en de rest-bak L17 (rit #29 niet gereden) "op" de locatie.
    - Verwacht: een waarschuwing "nog niet geleverd" bij KV en chauffeur.
11. **G11 — Draaiboek op 3 plaatsen verouderd.**
    - Stap 2: de rest-taak staat er nu wél.
    - Stap 8: `/api/conflicten` is leeg; "geen levering themadag" en "locatieconfig onvolledig" bestaan niet meer.
    - De prompt verwacht "capaciteitsconflicten" in `/api/conflicten`, maar die route kent geen capaciteitstype; capaciteit zit alleen in de Ritplanning.
12. **G12 — De capaciteitswaarschuwing blijft staan op gedane ritten.**
    - #22 (gedaan): "55 bakken op 20 plaatsen"; #26 (gedaan): "69 bakken op 40 plaatsen". Ruis in de Ritplanning.
    - Bovendien kon #26 met 69/40 zonder één stop of keuze helemaal geladen en afgerond worden.

### Cosmetisch

13. **G13 — "te veel 1" telt regels, geen stuks.**
    - Nakijken: uitslag "te veel 1 · kapot 1" terwijl het stoepkrijt `te_veel:2` heeft.
    - KV-lijst: G13 toont enkel "kapot" en niet ook "te veel".
14. **G14 — `PUT /api/nakijken/regel/:id` bewaart een actie zonder aantal stil als 0.**
    - Daardoor staat in de aanvullijst "×0".
    - De pagina stuurt het aantal wel mee; een API-gebruiker of een toekomstige knop zonder aantal niet.
    - Voorstel: standaard het afwijkingsaantal nemen, zoals `_afronden` al doet.
15. **G15 — Een bestelling kan "aangevuld" worden voordat ze geleverd is.**
    - Aanvullijst: Mölky "bestelling · wacht op levering" → aangevuld ✓ zonder tussenstap.
16. **G16 — Logboek: chauffeursacties zonder naam.**
    - `/api/wijzigingen`: 175 regels met `context:"rit-link"` en `persoon_naam` leeg.
    - KV-acties hebben wel "Seppe (KV)". De chauffeur van de rit is bekend, dus die kan erin.
17. **G17 — Historiek mengt datumformaten.**
    - Nakijken › sessie 110: "29/10/2026, 19:40" naast "2026-10-29T19:40:21.246Z".
18. **G18 — "KV KV Noor FICTIEF".** Dubbel "KV" in de Ritplanning, de rit-link, de KV-kop en de historiek. De fictieve namen beginnen al met "KV"; het label zet er nog eens "KV" voor.
19. **G19 — Teksten.**
    - "1 soorten", "1 stuks" (Vandaag › Inplannen).
    - "26/26 bakken" terwijl daar attributen in zitten.
    - "stuks" op de rit-link vs "bakken" in de Ritplanning voor hetzelfde getal.
    - Interne notities lekken naar de chauffeur: "Bak GPS-toestellen (gedeeld; mogelijk 2e exemplaar — verifiëren)", "Games of empire (set — geen baklabel op fiche)".
    - Themadagbakken heten alleen "Themabak 1/1 (curver)", zonder thema.
    - "Rek L · 0 van 0 geladen" na "past niet".
    - De Sportschuur toont "5 themadagen" i.p.v. de namen.
20. **G20 — Zelfde themabakken bij levering en kapot melden.**
    - KV › Kapot melden: de keuzelijst toont "Dominoblokjes" ×2, "Clics" ×2 en "Opblaasbare structuren" ×2 zonder bakcode erbij. Niet te onderscheiden welk exemplaar.

## Verbeterd t.o.v. DOORLICHTING-t (28 okt)

- Tellen met "✓ 10" en "Rest klopt" (niet meer honderden tikken).
- Bevestiging na versturen en na kapot melden.
- Een ophaalrit toont de bakken.
- De rit gaat op "gedaan" na lossen; aankomen per stop.
- Spoed heeft nu een van/naar en een datum in de kampweek.
- Aanvraag met aantal; kapot melden met keuze per stuk.
- Vandaag › Beslissen in plaats van `prompt()`.
- Knoppen ≥ 44 px op gsm.
