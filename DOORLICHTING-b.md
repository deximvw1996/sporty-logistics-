# DOORLICHTING lens 2 — backend-correctheid (chat B, Opus)

Datum 2026-10-28, 16:38–17:10. Lees-opdracht: **geen code- of datawijzigingen** in de repo; alles gespeeld op een wegwerpkopie van `D:\Sporty\sporty-railway\sporty.db` (in de scratchpad, `DATA_DIR`), server op poort 3302, branch `bouw-b` op `origin/main` (d181db9).
Login "Claude (API)"/1111, header `x-auth-token`. Alle bewijzen hieronder zijn echte HTTP-calls met teruggelezen output.

## Testopzet

Periode "Herfst 2026" aangemaakt (`POST /api/periodes` 2026-11-02..08 → id 2, max_weken 1). Testkampmomenten:

| km | locatie | week | periode | thema | doel |
|---|---|---|---|---|---|
| 167 | 29 Abdijschool | 1 | herfst | 4083 Alice | 1-weeks herfst, heeft locatieconfig |
| 168/169 | 36 Betekom | 1+2 | zomer | 4084 Alles op wieltjes → 4085 Holderdebolder | thema-wissel met pool/blazers |
| 170/171 | 37 Boutersem | 1+3 | zomer | 4086 De bakkerij | rustweek (gap w2) |
| 172 | 31 Boudewijnstadion | 5 | zomer | 4100 Jumpen! | definitieve sluiting |
| 173 | 24 De Kraal | 4 | zomer | 4088 Op stap met Sporty | uitstapthema-uitzondering |
| 174 | 27 De Ark 3 | 1 | zomer | 4083 Alice | cross-periode-conflict |
| 175 | 15 Campus GroepT | 2 | zomer | 4085 Holderdebolder | pool_tekort |
| 176/177 | 13 De Bosstraat | 6+8 | zomer | 4085 | gap met springkastelen |

Reproduceer met `POST /api/kampmomenten {locatie_id,week,periode_id,type:"kamp"}` + `POST /api/kampmomenten/:id/themas {thema_id,dag:null}` en daarna `POST /api/transport-genereer`.

---

## 1. ECHTE FOUTEN

### F1 — Thema-wissel negeert het poolmateriaal (themabehoefte) volledig · ernst HOOG · **voor herfst** (zodra een locatie 2 weken met ander thema draait)
Betekom w1 "Alles op wieltjes" → w2 "Holderdebolder" (`POST /api/transport-genereer`, gefilterd op km 168/169):
```
168 levering 2026-06-26 7>36 … F40 | Verkeerskoffer 1 | 17 × Kleuterfiets | 4 × Loopfiets | 5 × Loopwagen | 2 × Zitfiets | 3 × Easy roller | Opblaasbaar fietsparcours | 1 × Blazer 1500W | 1 × Verlengdraadkoffer
169 ophaling 2026-07-06 >7 Thema-wissel ophaling week 2 — Betekom ;; Bak Themabak zwarte curver (F40)
169 ophaling 2026-07-13 >7 Ophaling themabehoefte-materiaal week 2 — Betekom ;; 4 × WESCO | Klein springkasteel - jungle | Groot springkasteel | Kleuterhindernisbaan | 4 blazers | Verlengdraadkoffer
```
- De wieltjes-pool (koffer, 31 voertuigen, fietsparcours, blazer, verlengdraadkoffer) wordt **nooit opgehaald**.
- De Holderdebolder-pool (WESCO + 3 springkastelen + 4 blazers) wordt **nooit geleverd**, maar wél opgehaald op 07-13 → chauffeur rijdt naar Betekom om springkastelen te halen die er nooit stonden.
Oorzaak: wisselblok (server.js ±r.2952–2995) bouwt `ophaalMat/leverMat` enkel uit `themaBakken` + `themaAttrRegels`; `_themaBehoefteRegels` wordt alleen bij eerste levering (r.2907) en eind-ophaling (r.3025) aangeroepen.

### F2 — Sportplanning en kleurenborden zijn niet periode-bewust: zomerplanning lekt in de herfst · ernst HOOG · **voor herfst**
Herfst-km 167 (Abdijschool w1) krijgt de zomer-sportsets van Abdijschool w1:
```
 ;; levering ;; 2026-10-30 ;; 08:30 ;; 4>29 ;; Sport levering — 2 sets — Abdijschool Vlierbeek ;; Badminton A — A | Basket A — A
```
en er is **géén bijhorende sport-ophaling** (de laatste geplande week van die set valt op een zomer-locatie zonder kampmoment → `if(lKm)` slaat over). Oorzaak r.3108–3138: `kms.find(km=>km.locatie_id===…&&km.week===…)` zonder `periode_id`; `sport_planning` en `locatie_kleuren` hebben geen periodekolom. Idem kleurenborden: `POST /api/kleurenborden {locatie_id:29,week:1,…}` (bedoeld voor zomer) verschijnt in de herfstlevering én -ophaling van km 167. De generator groepeert bovendien álle kampmomenten per locatie over periodes heen op weeknummer (`perLocatie`, r.2678 e.v.) — zomer-w1 en herfst-w1 op dezelfde locatie worden als hetzelfde/aansluitend beschouwd.

### F3 — Conflictdetectie mengt periodes: valse dubbel_thema / dubbelboeking / materiaal_tekort · ernst HOOG · **voor herfst**
km 167 (Alice, **herfst** w1, Abdijschool) + km 174 (Alice, **zomer** w1, De Ark 3) → `GET /api/conflicten`:
```
dubbel_thema | Thema "Alice in Wonderland" is in week 1 ingepland op 2 locaties: Abdijschool Vlierbeek & De Ark 3
dubbelboeking_bak | Bak "Themabak 1/2 (kleuterbak)" (N08) … Abdijschool Vlierbeek@1, De Ark 3@1   (+ E26, Decor, Croquet)
materiaal_tekort | Week 1: "Pompons (zakjes)" — 8 nodig over alle kampen samen, maar 7 op voorraad
```
Die twee kampen liggen 4 maanden uit elkaar. Na `DELETE /api/kampmomenten/174` verdwijnen ze (detectie zelf werkt dus, maar sleutelt enkel op `week`). Meldingen noemen ook nooit de periode ("Week 1 — …"), dus kantoor kan niet zien welke week bedoeld is. Zodra herfst én zomer(-archief) samen in de db staan, is het conflictscherm onbruikbaar.

### F4 — Chauffeur-lossen zet een héle bulk-rij "op locatie" en wijzigt bulk_spreiding niet · ernst HOOG · **voor herfst**
Volledige keten (script `keten.mjs`: taak uit voorstel km168 → move → rit-token → checks/init → laden → lossen → taak gedaan):
```
VOLLEDIG GELADEN  Blazer 1500W:onderweg@7 spreiding=5@7     Verlengdraadkoffer:onderweg@7 spreiding=10@7
GELOST            Blazer 1500W:op_locatie@36 spreiding=5@7  Verlengdraadkoffer:op_locatie@36 spreiding=10@7
                  Kleuterfiets:op_locatie@36 spreiding=17@7
NA TAAK GEDAAN    Kleuterfiets spreiding=17@36 ; Blazer 1500W spreiding=1@36,4@7 ; Verlengdraadkoffer 1@36,9@7
```
- Na laden/lossen via `/api/rit-token/:token/checks/:id/{laden,lossen}` staat de bulk-rij (alle 5 blazers, alle 10 koffers) als `op_locatie@Betekom`, terwijl er 1 ging.
- `bulk_spreiding` beweegt **pas** bij `PUT /api/transport-taken/:id/status {status:"gedaan"}` door kantoor. De chauffeurspagina zet de taak niet op gedaan → in de normale chauffeursflow blijft de spreiding "17 in Rozenweg" en kan de generator dezelfde fietsen opnieuw toewijzen.

### F5 — bulk_spreiding kan opblazen (meer stuks dan het bezit) · ernst HOOG · **voor herfst**
(a) Taak terug naar gepland en opnieuw gedaan:
```
PUT /api/transport-taken/196/status {"status":"gepland"} → {"status":"gedaan"}
GET /api/vaste-bakken/11870/spreiding → 17 bezit; spreiding [["Betekom",34]]
```
(b) Ophaling van een locatie waar 0 staan voegt toch toe op de bestemming (r.3257–3262: aftrek = min(n, bron), bijtelling = n):
```
POST /api/transport-taken {"type":"ophaling","van_locatie_id":31,"naar_locatie_id":7,"regels":[{"qty":17,"bak_id":11870,…}]} → 198
PUT /api/transport-taken/198/status {"status":"gedaan"}
GET /api/vaste-bakken/11870/spreiding → [["Betekom",17],["Rozenweg",34]]   (51 fietsen van 17)
```
Dezelfde dubbel-toepassing geldt voor unieke bakken (status/locatie opnieuw gezet, logAct dubbel) en het spoed-voorraadeffect is het enige dat expliciet tegen dubbel beschermd is.

### F6 — Taak splitsen na checks-init breekt de laadstatus · ernst MIDDEN · **voor herfst**
Taak 199 (Alice-levering, rit met checks) → `POST /api/transport-taken/199/splits {regel_ids:[EHBO1,EHBO2],datum:"2026-10-31"}` → nieuwe taak 200. De `verhuis_checks` houden `taak_id=199` (`checks na splits: taak_ids = 199 aantal 6`). Chauffeur laadt alle niet-EHBO-regels → `N08 na laden (zonder EHBO): thuis`; pas als ook de (intussen op een andere dag gereden) EHBO-regels geladen zijn: `onderweg`. Omgekeerd zitten de afgesplitste regels nog in de checklijst van de oude rit.

### F7 — Taak verwijderen na laden laat bakken "onderweg" en checks verweesd · ernst MIDDEN · **voor herfst**
Zelfde rit, alles geladen, dan `DELETE /api/transport-taken/199` → 200:
```
-> N08 onderweg EHBO1 onderweg
checks van rit na delete: 200 6
```
De rit wordt verwijderd (laatste taak), maar `verhuis_checks` blijven bestaan en de bakken blijven voor altijd `onderweg` (geen terugzetting, geen waarschuwing).

### F8 — Spoedtaak uit een goedgekeurde aanvraag heeft geen bestemming; afwijzen annuleert hem niet · ernst HOOG · **voor herfst**
```
POST /api/kv/<token>/aanvraag {"tekst":"3 rollen tape"} → id 2
PUT /api/aanvragen/2/status {"status":"goedgekeurd","maak_spoedtransport":true,"spoedtransport":{"item":"tape","qty":3}} → ["goedgekeurd",201]
GET /api/transport-taken → [[201,"extra","2026-10-28",null,null,["tapex3"]]]
PUT /api/aanvragen/2/status {"status":"afgewezen","reden":"toch niet"} → ["afgewezen",201]   (taak 201 bestaat nog)
```
- `van_locatie_id` en `naar_locatie_id` zijn NULL: de aanvraag kent zijn kampmoment, maar de spoedtaak niet → chauffeur weet niet waarheen. Datum = vandaag (servertijd), niet de kampweek.
- Afwijzen na goedkeuren laat de spoedtaak (en rit) staan; `afgewezen → nieuw → goedgekeurd` is ook vrij toegelaten (geen statusmachine, reden wordt gewist).

### F9 — Elke opgeslagen transportregel vervuilt de centrale catalogus · ernst MIDDEN · **voor herfst**
`POST /api/transport-taken` roept per regel `resolveItemTypeId(r.naam)` aan, en die **maakt een nieuw item_type** als de naam onbekend is (r.102–108). Regelnamen zijn "Bak Themabak 1/2 (kleuterbak) (N08)", "17 × Kleuterfiets rood (Winther)", "Kleurenbord ROOD ×3", "tape"… Telling `item_types WHERE naam LIKE 'Bak %' OR '% × %' OR 'Attribuut %' OR 'Kleurenbord %'`: **23 in Maxims lokale db** (dus vermoedelijk ook prod na de zetronde), 30 in mijn kopie na deze test (+7 door 1 rit + 1 spoedtaak). Ontwerpregel 2 ("elk item verwijst naar de centrale catalogus") raakt zo vervuild met pseudo-items, en "17 × …" en "4 × …" worden telkens aparte catalogusitems.

### F10 — pool_tekort ziet specifieke exemplaren en blazers niet · ernst MIDDEN · **voor herfst** (springkastelen zijn herfstmateriaal)
Betekom w2 + Campus GroepT w2 beide Holderdebolder (km 169 + 175). `GET /api/conflicten` geeft enkel:
```
pool_tekort | Week 2: 8× "wesco_pakket" … maar slechts 4 beschikbaar in de pool
```
maar de generator plant in **dezelfde week** "Klein springkasteel - jungle", "Groot springkasteel - kasteel" en "Kleuterhindernisbaan" (elk 1 exemplaar, via `thema_behoefte.bak_id`) op beide locaties tegelijk, plus 2×4 = 8 blazers 1500W terwijl er 5 zijn — zonder enig conflict. (`_blazerReserve` leeft per kampmoment, niet per week.)

### F11 — ontbrekend_transport zwijgt voor pool-only thema's · ernst MIDDEN · **voor herfst**
Holderdebolder heeft 0 bakken/0 attributen maar wel themabehoefte (WESCO + 3 springkastelen). km 169 (Betekom w2) heeft geen enkele taak, toch geen `ontbrekend_transport` (wel voor Betekom w1 vóór er een taak was, en voor De Ark 3). De S6.3(a)-uitzondering "materiaalloos" telt `thema_behoefte` niet mee.

### F12 — Herlevering van poolmateriaal na een rustweek · ernst MIDDEN · voor zomer
Boutersem w1 + w3 (De bakkerij):
```
170 ophaling 07-06 … Themabak 1/2 | Themabak 2/2          (kookvuur/ovens/afwasbak blijven staan)
171 levering 07-10 … Themabak 1/2 | 2/2 | Kookvuur 1 | Oven 1 | Oven 2 | Afwasbak 1   ← opnieuw geleverd
171 ophaling 07-20 … Kookvuur 1 | Oven 1 | Oven 2 | Afwasbak 1 | Themabakken
```
Idem De Bosstraat w6+w8 met de 3 springkastelen (geleverd w6, niet opgehaald, opnieuw geleverd w8). Ofwel blijft het staan (dan geen herlevering), ofwel wordt het opgehaald (dan ophaling in de gap) — nu is het beide half. Kleurenborden volgen de gap-regel wél correct (ROOD×3 enkel geleverd vóór w1 en opgehaald na w3).

### F13 — Testrest in echte data: Abdijschool vraagt 99 EHBO-koffers · ernst MIDDEN · **voor herfst — verifiëren op prod**
`GET /api/locatie-config/29` in de kopie van Maxims lokale db: `{"vast_type":"EHBO-Koffer","aantal":99,…}`. Dat is de S6-reviewtest ("99× EHBO, 2 vrij"). Sinds de PROD-ZETRONDE (lokale db → prod) staat dit mogelijk ook op productie: elke week op Abdijschool geeft `locatieconfig_onvolledig` + `elders_nodig_vast` ("bezet: -"). Ik heb prod niet aangeraakt.

---

## 2. RANDGEVALLEN DIE STIL MISGAAN

| # | Wat | Bewijs | Ernst | Wanneer |
|---|---|---|---|---|
| R1 | KV kan tellen op een bak die niet op de locatie staat | N08 `status: onderweg` → `POST /api/kv/<t>/bakken/<N08>/tellen` → `200 {ok:true}` | laag | voor zomer |
| R2 | `"5abc"` wordt aanvaard als 5 (parseFloat) | `aangetroffen:"5abc"` → `200 {ok:true}`; `"abc"`/negatief/item_id-string → 400 ✅ | laag | ooit |
| R3 | Kapotte JSON → 500 i.p.v. 400 | body `{regels:[` → `500 Er ging iets mis op de server`; idem `POST /api/transport-taken` zonder geldige body → 500 | laag | voor zomer |
| R4 | `versturen` zonder iets "bezig" → `200 {ok:true}` (2× verstuurd = 2× ok) | `POST /api/kv/<t>/versturen` ×2 | laag | ooit |
| R5 | KV kan hertellen ná kantoorverwerking; sessie blijft "verwerkt" met nieuwe cijfers | sessie 24 `verwerkt` → KV telt opnieuw → `200`; regel blijft `["…",0,"aangevuld"]`, extra regel `open` onder een verwerkte sessie | midden | voor herfst |
| R6 | Aanvullen zonder aantal = "aangevuld" met 0 afgeboekt | `POST /api/nakijk-regels/<r>/aanvullen {}` → `[0,0,"aangevuld"]` | midden | voor herfst |
| R7 | Aanvullen meer dan er voorraad is → ok, voorraad stil op 0 (en herhaalbaar) | voorraad 0 → `{"aangevuld":5}` → `[true,0,0]` | midden | voor herfst |
| R8 | `PUT /api/transport-taken/:id/status` aanvaardt elke string | `{"status":"blablabla"}` → `200 "blablabla"` | laag | voor zomer |
| R9 | Half geladen rit: geladen bakken blijven `thuis` tot de laatste regel van de taak geladen is | HALF GELADEN-stand in F4 | laag | ooit (ontwerpkeuze, maar "waar is" liegt intussen) |
| R10 | `POST /api/periodes` aanvaardt eind vóór start (max_weken valt terug op 1) en controleert niet op maandag-start | code r.3709–3716 (`Math.max(1,…)`) | laag | voor zomer |
| R11 | nakijk_sessies hangen op `locatie_id+week`, niet op kampmoment/periode → herfst-w1-KV vindt/overschrijft een zomer-w1-sessie op dezelfde locatie | code r.2139–2141 (`… AND locatie_id=? AND week=?`) | midden | voor herfst (zodra zomer-archief + herfst samen staan) |

## 3. ONLOGISCH GEDRAG

| # | Wat | Bewijs | Ernst | Wanneer |
|---|---|---|---|---|
| O1 | Blazerbehoefte = som per springkasteel, niet piek-gelijktijdigheid (S4.5-regel) | Holderdebolder: 1+1+2 = 4× "Blazer 1500W", in 3 losse regels i.p.v. "4 × Blazer 1500W" | midden | voor zomer (nu geen dagplanning-data) |
| O2 | Drievoudige melding van hetzelfde: `geen_levering` + `geen_ophaling` + `ontbrekend_transport`; de oude twee kennen de uitstap-uitzondering niet | De Kraal w4 "Op stap met Sporty": `geen_levering`/`geen_ophaling` vuren, `ontbrekend_transport` terecht niet | laag | voor herfst (ruis op het scherm) |
| O3 | Stock-deplétie bij levering-gedaan leest de dode tabel `thema_bakken` | r.3229 `SELECT id FROM thema_bakken WHERE thema_id=?` → doet niets voor nieuwe bakken | laag | ooit (opruimen) |
| O4 | Duurzame items (verkleedkledij) lopen dezelfde voorraad-aanvulflow als verbruik | tekortregel "Verkleedkledij Alice + Konijn (set) 0/1" → aanvullen vraagt voorraadrij | laag | voor zomer |
| O5 | Meldingen noemen nooit de periode | alle conflicten "Week N — locatie" | midden | voor herfst (samen met F3) |
| O6 | Bulk-pool-rij heeft één `status`/`huidige_locatie_id` die niets betekent | zie F4 | midden | voor herfst |

## 4. WAT WÉL KLOPT (terecht groen)
- 1-weekse herfstlevering km 167: vrijdag 30/10 08:30/09:00, ophaling maandag 09/11 17:00; N08/E26 + 2 attributen + locatieconfig-exemplaren; ophaling bevat alles terug (incl. EHBO).
- Definitieve sluiting km 172 (Jumpen! w5): alles + springkasteel + blazer + verlengdraadkoffer terug.
- Uitstapthema km 173: 0 voorstellen, geen `ontbrekend_transport`.
- Verlengdraadkoffer exact 1 per levering, ook bij 3 springkastelen.
- Kleurenborden gap-regel (tijdelijk dicht = blijven staan).
- Conflicten verdwijnen na de fix (dubbel_thema/dubbelboeking/pool_tekort weg na `DELETE` km 174/175; `ontbrekend_transport` Betekom w1 weg na taak 196).
- KV-validatie: negatief, "abc", item_id als string, regels geen array → 400; vreemde bak → 403; afsluiten met open tekort → 400 met itemnaam; aanvullen zonder voorraadrij → 400 + `kan_aanmaken`.

## 5. PRIORITEIT VOOR DE HERFST (2–8 nov)
1. **F8** spoedtaak zonder bestemming / blijft na afwijzen — gaat in de herfstweek gegarandeerd gebruikt worden.
2. **F4 + F5** bulk_spreiding: chauffeursflow boekt bulk niet; opnieuw-gedaan en lege-bron blazen op. Zonder fix klopt "waar zijn de fietsen/blazers" na dag 1 niet meer.
3. **F2 + F3 + R11** periode-lekken (sport, kleurenborden, conflicten, KV-sessies): zodra de herfstplanning naast de zomerdata staat.
4. **F13** 99-EHBO-testrest op prod nakijken.
5. **F1 / F10 / F11** enkel als er in de herfst een locatie 2 weken draait of springkastelen dubbel staan (herfst = 1 week → F1 niet, F10 wél als 2 locaties dezelfde kastelen willen).
6. **F6 / F7 / F9 / R5–R7**: voor de herfst graag, anders vóór de zomer.

## Werkwijze / buiten mijn gebied
- Geen code of data in de repo gewijzigd; enkel dit verslag. Server draaide met `DATA_DIR` = scratchpad-kopie, `NODE_PATH` naar de node_modules van sporty-railway (worktree heeft geen eigen `node_modules` — alleen gelezen, niets geïnstalleerd).
- Hulpscripts (keten.mjs, annul.mjs, kv.mjs) staan in de scratchpad, niet in de repo; geen `scripts/test-*.mjs` gemaakt omdat dit een lees-opdracht is.
- Let op voor wie in Git Bash test: `/api/...`-paden als argument worden door MSYS herschreven → `MSYS_NO_PATHCONV=1` zetten (gaf mij eerst een schijnbare HTML-respons op `/api/periodes`).
