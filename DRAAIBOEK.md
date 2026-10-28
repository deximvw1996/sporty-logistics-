# DRAAIBOEK — wat de app moet kunnen, fase per fase, rol per rol

> Versie 0.1 (2026-10-28, Fable) — **reconstructie door Claude, nog NIET door Maxim gevalideerd.**
> Elke regel met ❓ is een aanname of open vraag. In de brainstormsessie lopen we dit stap voor stap door;
> elke correctie van Maxim wordt hier verwerkt. Daarna is dít het functionele kompas: elke bouwprompt
> verwijst naar een fase/actie uit dit document, en "klaar" betekent: de actie werkt zoals hier beschreven.
> Status per actie: ✅ werkt (bewezen) · 🟠 werkt half / met bekende fouten (verwijzing naar DOORLICHTING) · ❌ bestaat niet · ❓ onbekend/aanname.

## De rollen
| rol | wie | gebruikt |
|---|---|---|
| **Admin** (nieuw, Maxim 28/10) | Maxim + Claude | alles + beheer: herstel/import, rollen, instellingen |
| **Kantoor/coördinator** | kernteam (manager + 3 coördinatoren) | de werk-app: plannen, materiaal, transport, thema's aanmaken |
| **Chauffeur** | chauffeurs/klusjesmensen | mobiele rit-pagina via rit-link |
| **Kampverantwoordelijke (KV)** | 1 per kampmoment | mobiele kv-pagina via kv-link |
| Monitor | begeleiders per groep | ✔ geen app-rol (Maxim 28/10: monitoren komen niet in de app) |
| Beheerder | Maxim | Railway, deploys, data-herstel |

## De cyclus in 9 fasen

---
### FASE 0 — Stamdata (doorlopend, buiten de vakanties) — ✔ besproken met Maxim 28/10
Eigenaar: kantoor. **Rollen-besluit: monitoren komen NIET in de app.**
| # | actie | moet kunnen | status |
|---|---|---|---|
| 0.1 | Locaties beheren (adres, contact, type kamp/stockage, eigenschappen) — eigenschappen: **"heeft vuur en/of oven"** (vervangt "eigen oven"/"keuken"), eigen sportmateriaal, zelf kuisen | ✅ bevestigd; label "Heeft eigen oven" → "Heeft vuur en/of oven" | |
| 0.2 | Locatieconfig per locatie: standaarduitrusting met voorwaarde (altijd / leeftijdsgroep / kookthema / zelf kuisen / **bij uitstap**). **Gelijktijdigheidsregel (Maxim):** op-stap-pakket = 1 per groep die op hetzélfde moment op uitstap gaat (groep A dag 1 + groep B dag 2 = 1 pakket; samen weg = 2) — zelfde piek-logica als blazers. Andere voorwaarden komen uit de praktijk | 🟠 bestaat; voorwaarde "bij uitstap" + gelijktijdigheid nog te bouwen (vereist: per kampmoment weten welke groepen wanneer op uitstap gaan) | |
| 0.3 | Personeel: kantoor/chauffeur mét login; **KV krijgt ook een account** zodat hij/zij nakijk-resultaten en "iets is op"-meldingen kan doorgeven (Maxim) → KV logt in en ziet zijn eigen kampmoment(en); kv-link blijft als snelle weg | 🟠 besluit genomen; KV-login + KV-overzicht te bouwen (V0 blokkeert kv-rol nu op de admin-API — terecht, de KV krijgt zijn eigen scherm) | |
| 0.4 | Themacatalogus onderhouden: thema's → bakken → items; attributen; bundel-PDF bij thema. **Coördinatoren moeten zelf een nieuw thema kunnen aanmaken (Maxim)** → invoerscherm "nieuw thema" met bakken/items/attributen/behoefte (= oude S4.1). **Nieuwe rol "admin"** (Maxim + Claude) boven kantoor: beheer, herstel, import, rollen | 🟠 gevuld (184); onderhoud-UI bestaat; thema-invoerscherm + admin-rol te bouwen | |
| 0.5 | Pool beheren: unieke exemplaren (springkastelen+foto's, koffers) en bulk (totaal + spreiding) | 🟠 bestaat; **juiste getallen zijn nu niet belangrijk — werkende app eerst, cijfers later (Maxim)** | |
| 0.6 | Verbruiksmateriaal: **mengeling, geen vaste regel (Maxim) — alle werkwijzen moeten kunnen**: (a) vaste voorraad met minimum die aangevuld wordt, (b) gerichte inkoop per kamp/vakantie op basis van de fiches, (c) mix. Ontwerp: één **inkoop- en voorraadscherm** met drie bronnen — voorraad onder minimum, verwachte verbruik van de geplande kampen (fiches × kampmomenten), tekorten uit KV-controles — en per item de keuze "op voorraad houden" of "per kamp kopen" | 🟠 structuur voor (a) bestaat; (b) en de gecombineerde lijst te bouwen; voorraadrijen leeg (cijfers later) | |
| 0.7 | Periodes beheren — **ruimer dan schoolvakanties**: Sporty doet ook sportdagen, workshops, opvangdagen tijdens het schooljaar én evenementen (Leuven Night Run, Genk Marathon…) | 🟠 CRUD bestaat; app niet periode-bewust (V2) — **én het begrip "kampmoment" moet elke activiteitssoort aankunnen** (kamp, themadag, sportdag, workshop, opvangdag, evenement) | |
| 0.8 | Sportpakketten: **vast per locatie én roterend moet allebei kunnen** (Maxim) | 🟠 bestaat; planning niet periode-bewust | |
| 0.9 | Verhuur aan derden: **nu al relevant voor beschikbaarheid** (een verhuurd springkasteel is die dag niet inzetbaar) **+ klaarzet-agenda** (verhuurde spullen worden klaargezet voor afhaling) | ❌ → verhuur = blokkering in de pool-beschikbaarheid + agenda-item; volledige verhuurmodule (S9) later | |

---
### FASE 1 — Vakantie plannen (maanden vóór de vakantie) — ✔ besproken met Maxim 28/10 (1.5 nog open)
Eigenaar: de coördinatoren samen (nu in Excel; maanden vooraf, zodat het tijdig online staat voor ouders).
**Definitie (Maxim): één kampmoment = één locatie die één week open is**, rekening houdend met feestdagen (de meeste locaties dicht, enkele open). Of er 1 kleutergroep of 10 groepen kleuters+lager+tieners zijn, maakt voor het kampmoment niet uit — dat zijn eigenschappen ván het kampmoment.
**Groepen:** hangen af van inschrijvingen en mogelijkheden; gemiddeld 2 groepen per thema (kleuters: 3-4 j + 5-6 j; lager: 7-9 j + 10-12 j; ook tieners), samenvoegen bij weinig inschrijvingen. Inschrijven kan tot dag 1; kampen hebben een instelbare limiet en zitten snel vol.
| # | actie | moet kunnen | status |
|---|---|---|---|
| 1.1 | Periode aanmaken (vakantie, maar ook sportdag/workshop/opvang/evenement — zie 0.7) | 🟠 (V2) | |
| 1.2 | Kampmoment plannen = locatie × week (open dagen incl. feestdag-uitzonderingen) + welke leeftijdsgroepen/groepen er draaien | 🟠 werkt; weeknummering uit periode (V2); groepen per leeftijd nog niet als begrip | |
| 1.3 | Per kampmoment: thema per groep (kamp/themadag, passend bij leeftijd), sportpakket; themadagen-week = thema per dag ❓ (afleiden uit de kampprogramma's in de datamap) | 🟠 thema's per kampmoment bestaan; "thema per groep/dag" nog niet | |
| 1.4 | Inschrijvingen: limiet per kamp instelbaar; aantal kinderen bepaalt groepen en 16/32-lijsten. **Kampadmin (inschrijvingen bijhouden) is een wens op termijn; logistiek eerst perfect (Maxim)** | ❌ limiet/aantallen nog geen begrip | |
| 1.5 | KV toewijzen per kampmoment → kv-link/KV-account | ✅ koppeling bestaat; **KV-planning als puzzel** (KV's die geen volledige weken kunnen → wie staat waar wanneer) is een gewenste extra | |
| 1.6 | **Chauffeursplanning: hoofdlogistiek (een coördinator) bepaalt wie wat wanneer rijdt — KERNTAAK van de app (Maxim)** | 🟠 ploegplanning bestaat maar verstopt (D); moet volwaardig: per dag/rit wie rijdt, beschikbaarheid chauffeurs | |
| 1.7 | Conflicten zien bij het plannen (Maxim 28/10): dubbel thema, pool-tekort, locatieconfig onhaalbaar, geen transport, **geen KV toegewezen**, **verhuurd materiaal botst met een kamp**, **kookactiviteit op een locatie zonder vuur/oven** — ook als het thema niet "kook" is maar op 1 van de 5 dagen kookt → **per thema: kookdag(en) vastleggen** (niet alleen een ja/nee-vlag), zodat de app voor dié dag een vuur verwacht | 🟠 bestaat deels; periode-lek (B-F3), gaten (B-F10/F11), geen actieknoppen (D); verhuur-, KV- en kookdag-conflicten te bouwen; `heeft_kookactiviteit` wordt "kookdagen" | |
| 1.8 | ❓ Budget per kamp — in de app of elders? (nog te beantwoorden) | ❌ | |
| 1.9 | Monitorenplanning — niet in de app (monitoren = geen rol) | — | |

---
### FASE 2 — Materiaal voorbereiden (laatste 1–2 weken vóór de vakantie) — ✔ besproken met Maxim 28/10
Eigenaar: kantoor (magazijnwerk Rozenweg). Geen vaste persoon: coördinatoren én chauffeurs krijgen dit als taak. Vandaag: geprinte Excels.
| # | actie | moet kunnen | status |
|---|---|---|---|
| 2.1 | Per kampmoment zien wat er mee moet: themabakken + attributen + pool + locatieconfig + sport + kleurenborden; **als taak toewijsbaar aan een coördinator of chauffeur**, printbaar | 🟠 ("Week materiaal" + genereer-preview) | taak-eigenaar ontbreekt |
| 2.2 | Verbruik aanvullen: tekorten uit vorige controles + bestellijst onder minimum → aankopen → voorraad bijwerken. Praktijk: grote inslag vóór de zomer, bijkopen tijdens de vakantie. Kopers = coördinatoren én chauffeurs | 🟠 flow bestaat (S6); zinloos tot voorraad gevuld (E) | inkooplijst per vakantie gewenst |
| 2.3 | KV-boodschappenlijst (verse waren) bij kookthema's beschikbaar voor de KV; **later: KV-budget per kookkamp** (bedrag in euro, aankopen uit themabundel) | ✅ lijst; ❌ budget | budget = wens, na logistiek (werklijst) |
| 2.4 | Bakken nakijken vóór vertrek: gebeurt alleen bij tijd; meestal enkel aanvullen wat KV's doorgaven — en die info is vaak fout omdat KV's de bak niet deftig laten natellen. Gevolg: de app moet (a) de KV-telling verplicht en simpel maken (fase 5/6) en (b) kantoor een korte "te verifiëren"-lijst geven i.p.v. een volledige hertelling | 🟠 nakijk-flow bestaat; 608 "verifiëren bij eerste nakijk"-notities = die lijst | |
| 2.5 | Printwerk (diploma's, kampmap-formulieren, affiches): coördinatoren op kantoor; wordt vergeten als de KV er niet aan herinnert → **lijst "te printen voor kampmoment X"**, afvinkbaar | ❌ (alleen notities op items) | nieuw punt |
| 2.6 | **Foto bij elk materiaal/bak** zodat een chauffeur weet wat een "rebounder" is | 🟠 foto-upload bestaat (bakken); dekking laag; foto's nog in db (werklijst 23) | |
| 2.7 | **Capaciteitsconflict pool**: 5 ovens nodig in dezelfde week, 4 in voorraad → zichtbaar bij planning, niet pas bij het laden | 🟠 pool_tekort bestaat maar mist types (werklijst 10) | |
| 2.8 | **Eén kanaal voor tekorten** (wc-papier op → KV meldt in de app → kantoor keurt → wordt vanzelf een taak op de rit van de volgende chauffeur). Geen sms-ketting coördinator→chauffeur | 🟠 aanvraag→spoedtaak bestaat, kapot zonder van/naar (werklijst 11) | kernpunt |

**Pijnpunten die de app hier moet wegnemen (Maxim 28/10):** foute telinfo van KV's/monitoren · tijdsgebrek coördinatoren · vergeetachtigheid (KV én kantoor) · chauffeur vergeet in-/uitladen (oven niet mee naar oven-locatie) · bak verwisseld bij inladen · materiaal niet herkend (geen foto) · hoofdlogistiek vergeet iets op de lijst · tekort-melding verdwaalt in sms-ketting.
→ Ontwerpgevolg: de laadlijst van de chauffeur komt **uit de planning** (locatie heeft oven → oven staat op de lijst), niet uit het hoofd van de hoofdlogistiek; afvinken per stuk bij in- én uitladen (fase 4).

---
### FASE 3 — Transport plannen (week vóór + tijdens de vakantie) — ✔ besproken met Maxim 28/10
Eigenaar: hoofdlogistiek (bepaalt wie rijdt, met welk voertuig, wanneer); uitvoering chauffeur, vrijdag vaak samen met coördinatoren.
| # | actie | moet kunnen | status |
|---|---|---|---|
| 3.1 | Leveringen: normaal uiterlijk de vrijdag vóór de kampweek; **nalevering** maandag of later in de week mag (oven pas donderdag nodig, pas woensdag een vrij). Ophaling: als de locatie doorgaat → thema op vrijdag; **sluit de locatie → al tijdens de week deelophalingen** (tent, deel thema, sportpakket, springkasteel). Een thema reist dus niet altijd in één stuk: 2+ ritten | 🟠 generator kent alleen "levering vóór / ophaling na"; deelophaling en "vanaf dag X nodig" ontbreken | kernpunt: per onderdeel een "nodig van–tot" |
| 3.2 | Voorstellen → taken → ritten; **chauffeurs- én voertuigplanning** (wie werkt wanneer, wie rijdt met wat; 1 of 2 chauffeurs; coördinator kan rijden) | 🟠 ritten hebben chauffeur+voertuig, maar geen beschikbaarheidsrooster | rooster = nieuw |
| 3.3 | **Bundelen** van locaties in één voertuig (geen lege terugritten) en **splitsen** over 2 voertuigen (chauffeur + coördinator). Capaciteit = inschatting van de planner (geen afmetingen beschikbaar; gokken blijft); chauffeur meldt bij het laden "alles mee" of "niet gelukt: rest → nieuwe taak" | 🟠 bundelen bestaat; split breekt (B-F6); "rest blijft open" ontbreekt | |
| 3.4 | Week-overgang: standaardmateriaal blijft staan; het oude thema gaat **deels** mee terug afhankelijk van wat al weg mag en hoe laat de chauffeur komt (vrijdag 10u = thema nog in gebruik → rest in een latere rit). Dus: ophaling per onderdeel, met "mag weg vanaf" | 🟠 generator kent alleen thema-in-één-keer | zelfde kern als 3.1 |
| 3.5 | Chauffeur onderweg: stops + bakkenlijst, **plus wie de KV's zijn en de contactpersoon van de locatie (sleuteloverdracht als de school dicht is)**; **"Probleem melden"** op het rit-scherm (poort dicht, past niet, met foto) → melding naar kantoor en/of KV i.p.v. bellen | 🟠 rit-link bestaat zonder contacten en zonder melden | |
| 3.6 | **Opvolging voor KV én coördinator**: wat is onderweg, wanneer verwacht, wat ontbreekt nog, waar staat het nu | ❌ (alleen beheer-kant) | nieuw: volgscherm |
| 3.7 | **Locatiedossier**: foto's + uitleg waar wat moet staan, welke ruimtes gebruikt mogen worden, wifi, poortcodes, contactpersonen; **overdrachtsfoto's** bij ontvangst en afgifte (van voorganger/eigenaar → naar opvolger/eigenaar), door KV of coördinator | ❌ | nieuw; codes = gevoelig → alleen ingelogd, niet in export |

---
### FASE 4 — Leverdag / opbouw (vr–ma rond de kampstart) — ✔ besproken met Maxim 28/10
Eigenaar: chauffeur (+ kantoor volgt). KV helpt bij de levering als die tijd heeft; anders levert de chauffeur met een meegekregen sleutel of via afspraak met de locatie-eigenaar (→ contactpersoon uit het locatiedossier, 3.7).
| # | actie | moet kunnen | status |
|---|---|---|---|
| 4.1 | Chauffeur opent rit op GSM: stops in volgorde, **elk stuk apart afvinken bij LADEN** in de Rozenweg | ✅ (statusketen) | |
| 4.2 | **Elk stuk apart afvinken bij LOSSEN** → "op locatie". Vervangt de geprinte lijst + fluostift die nu weggegooid wordt. **Alles gelogd, alles traceerbaar, niets gaat verloren: volledige historiek per stuk** (wie, wanneer, waar) | 🟠 uniek ✅; bulk fout (B-F4); historiek op tekstmatch (A) | kernpunt, bindend |
| 4.3 | Kantoor ziet live wat geladen/gelost/onderweg is; **KV ziet hetzelfde voor zijn locatie** (3.6 volgscherm) | 🟠 | |
| 4.4 | KV + monitoren kijken **in de loop van maandag** alles na (ochtend is te druk) en melden tekorten → nu via sms/WhatsApp, straks in de app: **ontvangstcontrole** per bak, "alles aanwezig" of "dit ontbreekt" | 🟠 nakijk-flow bestaat, niet als ontvangstcontrole | |
| 4.5 | Tekort op maandag → aanvraag → kantoor keurt → taak op de volgende rit. **Meldingen bij elke stap, liefst pushmeldingen op de GSM** (KV: "goedgekeurd, komt woensdag"; chauffeur: "nieuwe taak op je rit"; kantoor: "nieuwe aanvraag") | 🟠 keten bestaat (werklijst 11); ❌ meldingen | push = web-push, haalbaar zonder app-store |
| 4.6 | ❓ Opbouw springkastelen: wie, en moet de app iets tonen (blazers, zekeringen, foto opgezet)? | 🟠 foto's bestaan | open (klein) |

---
### FASE 5 — Kampweek (ma–vr) — ✔ besproken met Maxim 28/10
Eigenaar: KV (mobiel), kantoor reageert. **Bouwvolgorde: pas ná het logistieke deel (zie Dwarsthema "Logistiek eerst").**
| # | actie | moet kunnen | status |
|---|---|---|---|
| 5.1 | KV opent kv-link: wat hoort er te staan (bakken, attributen, pool, boodschappenlijst) **+ wanneer iets geleverd wordt + opvolging van eigen meldingen/aanvragen** ("wat de KV nodig heeft om een goede KV te zijn") | 🟠 vaste bakken tonen 0 items (A-GEVONDEN-4); levering/opvolging ❌ | |
| 5.2 | KV dient aanvraag in → **kantoor beslist** (KV meldt en vraagt alleen) → spoedtaak of afwijzing mét reden terug naar KV | 🟠 flow bestaat; afwijs-annuleer-bug (D-#1), spoedtaak zonder bestemming (B-F8) | |
| 5.3 | KV meldt iets kapot (+foto) → kantoor ziet het en beslist (vervangen/herstellen/leveren) | 🟠 foto ongelimiteerd base64 in db (A/C) | |
| 5.4 | Kantoor-dashboard: vandaag — aanvragen, transporten, conflicten | 🟠 versnipperd (D) | |
| 5.5 | Midweekse controle: **mag, geen verplichting** (zelfde telscherm als 6.1, vrijblijvend) | 🟠 | |

---
### FASE 6 — Vrijdagcontrole (einde kampweek) — ✔ besproken met Maxim 28/10
Eigenaar: monitoren + KV → kantoor. Monitoren tellen en geven door aan de KV; sommige KV's tellen zelf. Beiden moeten het kunnen.
| # | actie | moet kunnen | status |
|---|---|---|---|
| 6.1 | **Telscherm** per bak: per onderdeel aantal typen, afvinken, iets melden (kapot/ontbreekt/opmerking); versturen | 🟠 werkt; lege controle verzendbaar (D-#2), alerts (D-#3), hertellen-na-verwerking (B-R5) | designsessie |
| 6.2 | **Monitor-link**: een monitor krijgt een link waarmee hij alleen zijn telling invult en niets anders ziet (geen aanvragen, geen andere locaties, geen beheer); KV ziet de ingevulde tellingen en verstuurt | ❌ (alleen kv-token) | nieuw: tel-token per bak/controle, kort geldig |
| 6.3 | Kantoor ziet tekorten per bak + dashboard; besteld/aangevuld/genegeerd; aanvullen boekt voorraad af; **terugkoppeling naar KV** ("verwerkt, bak 12 aangevuld") | 🟠 werkt (S6); randgevallen R6/R7; terugkoppeling ❌ | |
| 6.4 | **Verbruikshistoriek per thema/item over de vakanties** ("Bakkerij: 5 lijmstiften verbruikt zomer 2026") → inkoop op data i.p.v. gevoel | ❌ (tellingen worden bewaard, geen rapport) | nieuw; voedt 2.2 inkooplijst |
| 6.5 | Controle afsluiten pas als alles verwerkt | ✅ | |
| 6.6 | ❓ Vrijdag = ook fysieke wissel-voorbereiding (bakken dicht, klaar voor ophaal)? | ❓ | open (klein) |

---
### FASE 7 — Week-overgang (alleen meerweekse vakanties) — ✔ besproken met Maxim 28/10
Eigenaar: kantoor + chauffeur. **Weekend = uitzondering, geen verbod**: de generator stelt standaard geen zaterdag/zondag voor, maar de planner mag het wel kiezen (sportdagen en evenementen zoals de Leuven Night Run vallen in het weekend). **Locatie → locatie zonder tussenstop** in een stockageplaats is normaal en moet de app kunnen voorstellen.
| # | actie | moet kunnen | status |
|---|---|---|---|
| 7.1 | Thema-wissel: oud thema deels/volledig op (zie 3.4), nieuw eraf, liefst in één rit op vrijdag | 🟠 bakken ✅, pool vergeten (B-F1) | |
| 7.2 | Rustweek (locatie dicht, heropent): vast materiaal + kleurenborden blijven; thema rouleert | 🟠 kleurenborden ✅, pool dubbel geleverd (B-F12) | |
| 7.3 | Zelfde thema elders nodig → **rechtstreeks tussentransport locatie A → locatie B** op vrijdag, als voorstel aan de hoofdlogistiek (die beslist) | 🟠 generator kent alleen stockage↔locatie | nieuw |

---
### FASE 8 — Sluiting & eindophaling (einde vakantie) — ✔ besproken met Maxim 28/10
**Drie stockageplaatsen**: Rozenweg (het meeste), Kantoor (vooral sportpakketten), Marco (zelden nodig). De app rekent met de thuisplaats per item; een ophaling gaat naar de juiste thuisplaats, niet blind naar de Rozenweg.
| # | actie | moet kunnen | status |
|---|---|---|---|
| 8.1 | Definitief dicht: ALLES terug (thema, pool, kleurenborden, config-uitrusting, sport) naar elk zijn thuisplaats | ✅ keten (S5); thuisplaats per item bestaat (stockage_locatie_id), nog niet in de generator-bestemming geverifieerd | checken |
| 8.2 | Alles weer "thuis"; spreiding over de drie plaatsen klopt | 🟠 bulk (B-F4/F5) | |
| 8.3 | Eindcontrole/inventaris in het magazijn: **na de vakantie** als het materiaal niet meer nodig is, **tijdens** als het nog weg moet. Verifieer-notities afwerken, kapot vervangen, voorraad hertellen | ❌ als flow (losse stukken bestaan) | |

---
### FASE 9 — Evaluatie & volgende vakantie — ✔ besproken met Maxim 28/10
"Meten is weten": zoveel data en rapporten als mogelijk.
| # | actie | moet kunnen | status |
|---|---|---|---|
| 9.1 | Rapporten per vakantie: kapot/weg, kosten, thema's per locatie, tekort-top, verbruik per item (6.4), ritten per chauffeur/voertuig, aanvragen en doorlooptijd | ❌ | na logistiek; data moet nu al goed gelogd worden |
| 9.2 | Archief: afgesloten periode blijft raadpleegbaar en **aanpasbaar, maar elke aanpassing omkeerbaar en in een logboek** (versiegeschiedenis zoals Google Drive: wie, wanneer, wat, terugzetten) | ❌ (periode-lek B-F2/F3; geen wijzigingslog) | kernpunt: wijzigingslog op alle tabellen |
| 9.3 | Thema's bijwerken n.a.v. de praktijk (leesgids-stijl) | 🟠 handmatig | |

---
## Dwarsthema's (gelden overal)
- **Alles gelogd, alles omkeerbaar (Maxim 28/10):** elke wijziging aan elk gegeven krijgt een regel in een wijzigingslog (wie, wanneer, oud, nieuw) en is terug te zetten; elke verplaatsing van elk stuk staat in de historiek. Niets gaat nog verloren.
- **LOGISTIEK EERST (Maxim 28/10, bindend voor de bouwvolgorde):** coördinatoren en chauffeurs krijgen voorrang bij alles. Alles voor KV's en monitoren komt pas als het coördinatoren-/chauffeursdeel gebouwd is én volledig werkt. Uitzondering: het KV-/monitorstuk dat essentieel is voor de logistiek (aanvraag indienen, ontvangst bevestigen, telling versturen) mag tegelijk gebouwd worden.
- **Professioneel, met alles erop en eraan (Maxim 28/10):** één echte database (geen sql.js-bestand dat in het geheugen leeft en in één keer wordt weggeschreven): atomaire schrijfacties, migraties, back-ups, foto's buiten de db. Heel de app moet die lat halen: geen prompt()-vensters, geen halve schermen.
- **Veiligheid**: rollen gescheiden, alles achter de muren, geen lekken (DOORLICHTING-c → V0-noodronde).
- **Robuust**: geen stille fouten; foute invoer → 400 met uitleg; database-schrijving atomair (A).
- **Dynamisch**: periode-gestuurd, geen hardcodes; 1/2/9 weken even goed (V2, verdiept met B-F2/F3).
- **Mobiel**: KV + chauffeur volwaardig op GSM (D).
- **Begrijpelijk**: nieuwe collega vindt alles zonder uitleg (D-top-20; designsessie).

## Open vragen voor de brainstorm (de ❓'s gebundeld)
1. Monitoren: echt geen app-rol? (0/rollen)
2. Hoe ver vooraf wordt gepland, en door wie? (1)
3. Budget per kamp in deze app of erbuiten? (1.7)
4. Fysieke klaarzet-check vóór vertrek: wie + met de app? (2.4)
5. Print-lijstje per kampmoment nuttig? (2.5)
6. Leverdag-conventies: wanneer wordt geleverd/opgehaald precies (vr/za/ma)? (3.1)
7. Voertuigcapaciteit: echt knelpunt? (3.6)
8. Opbouw-informatie springkastelen in de app? (4.4)
9. Dagelijkse checks of alleen vrijdag? (5.5)
10. Vrijdag fysieke wissel-voorbereiding? (6.4)
11. Eindinventaris als echte flow? (8.3)
12. Wat moet de evaluatie/het archief tonen? (9.1)
