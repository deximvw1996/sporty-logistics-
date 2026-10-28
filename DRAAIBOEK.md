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
| 1.7 | Conflicten zien bij het plannen: dubbel thema, pool-tekort, locatieconfig onhaalbaar, geen transport, **geen KV toegewezen** (Maxim) + ❓ rest van 1.5-antwoord | 🟠 bestaat; periode-lek (B-F3), gaten (B-F10/F11), geen actieknoppen (D) | |
| 1.8 | ❓ Budget per kamp — in de app of elders? (nog te beantwoorden) | ❌ | |
| 1.9 | Monitorenplanning — niet in de app (monitoren = geen rol) | — | |

---
### FASE 2 — Materiaal voorbereiden (laatste 1–2 weken vóór de vakantie)
Eigenaar: kantoor (magazijnwerk Rozenweg).
| # | actie | moet kunnen | status |
|---|---|---|---|
| 2.1 | Per kampmoment zien wat er mee moet: themabakken + attributen + pool + locatieconfig + sport + kleurenborden | 🟠 ("Week materiaal" + genereer-preview) | |
| 2.2 | Verbruik aanvullen: tekorten uit vorige controles + bestellijst onder minimum → aankopen → voorraad bijwerken | 🟠 flow bestaat (S6); zinloos tot voorraad gevuld (E) | |
| 2.3 | KV-boodschappenlijst (verse waren) bij kookthema's beschikbaar voor de KV | ✅ | |
| 2.4 | Bakken klaarzetten/nakijken vóór vertrek ❓ (gebeurt er een fysieke check met de app in de hand? wie?) | 🟠 nakijk-flow bestaat; "verifiëren bij eerste nakijk"-notities (608 stuks) zijn hiervoor de werklijst | |
| 2.5 | ❓ Printwerk (🖨️-items: diploma's, kampmap-formulieren, affiches) — lijstje per kampmoment "wat moet geprint"? | ❌ (alleen notities op items) | |

---
### FASE 3 — Transport plannen (week vóór + tijdens de vakantie)
Eigenaar: kantoor; uitvoering chauffeur.
| # | actie | moet kunnen | status |
|---|---|---|---|
| 3.1 | Voorstellen genereren uit de planning (leveringen vrijdag/weekend vóór de week ❓, ophalingen na afloop, wissels, rustweek-regels, sluitregels) | 🟠 kern werkt (S5-bewijzen); pool bij thema-wissel vergeten (B-F1), herlevering in gap (B-F12), periode-lek (B-F2) | |
| 3.2 | Voorstellen → taken; taken bundelen tot ritten; datum/tijd/voertuig/chauffeur toewijzen; taak splitsen over dagen | 🟠 werkt; splitsen breekt checks (B-F6) | |
| 3.3 | Chauffeur krijgt rit-link met stops + bakkenlijst per stop (codes, geen inhoud) | ✅ | |
| 3.4 | Spoedtransport (vanuit aanvraag of los) met bron+bestemming+datum | 🟠 kapot: geen bestemming vanuit aanvraag (B-F8) | |
| 3.5 | "Waar is bak X" — actuele plaats + historiek | 🟠 werkt voor unieke bakken; bulk lekt (B-F4), log op tekstmatch (A) | |
| 3.6 | ❓ Voertuigen/capaciteit: speelt dat echt (camion vol)? | 🟠 voertuigtypes bestaan; capaciteitscheck ❓ | |

---
### FASE 4 — Leverdag / opbouw (vr–ma rond de kampstart)
Eigenaar: chauffeur (+ kantoor volgt).
| # | actie | moet kunnen | status |
|---|---|---|---|
| 4.1 | Chauffeur opent rit-link op GSM: stops in volgorde, per stop bakken afvinken bij LADEN in de Rozenweg | ✅ (statusketen) | |
| 4.2 | Per stop LOSSEN afvinken → bak staat "op locatie" | 🟠 uniek ✅; bulk fout (B-F4) | |
| 4.3 | Kantoor ziet live wat geladen/gelost/onderweg is | 🟠 | |
| 4.4 | ❓ Opbouw springkastelen: wie, en moet de app iets tonen (blazers, zekeringen, foto opgezet)? | 🟠 foto's bestaan | |
| 4.5 | ❓ Wat als er iets niet mee kan / vergeten is op leverdag — naar spoedflow? | 🟠 | |

---
### FASE 5 — Kampweek (ma–vr)
Eigenaar: KV (mobiel), kantoor reageert.
| # | actie | moet kunnen | status |
|---|---|---|---|
| 5.1 | KV opent kv-link: ziet wat er hoort te staan (bakken, attributen, pool, boodschappenlijst) | 🟠 vaste bakken tonen 0 items (A-GEVONDEN-4); bulk-zicht ❓ | |
| 5.2 | KV dient aanvraag in ("tape op", "extra ballen") → kantoor keurt → spoedtaak of afwijzing mét reden terug naar KV | 🟠 flow bestaat; afwijs-annuleer-bug (D-#1), spoedtaak zonder bestemming (B-F8) | |
| 5.3 | KV meldt iets kapot (+foto) → kantoor ziet het | 🟠 foto ongelimiteerd base64 in db (A/C) | |
| 5.4 | Kantoor-dashboard: vandaag — wat speelt er (aanvragen, transporten, conflicten) | 🟠 versnipperd (D) | |
| 5.5 | ❓ Dagelijkse telling/checks tijdens de week, of alleen vrijdag? | ❓ | |

---
### FASE 6 — Vrijdagcontrole (einde kampweek)
Eigenaar: KV → kantoor.
| # | actie | moet kunnen | status |
|---|---|---|---|
| 6.1 | KV telt per bak de items (gewenst vs aangetroffen), vinkt attributen, versturen | 🟠 werkt; lege controle verzendbaar (D-#2), alerts (D-#3), hertellen-na-verwerking (B-R5) | |
| 6.2 | Kantoor ziet tekorten per bak + geaggregeerd dashboard; status besteld/aangevuld/genegeerd; aanvullen boekt voorraad af | 🟠 werkt (S6); randgevallen R6/R7; zinloos tot voorraad gevuld | |
| 6.3 | Controle afsluiten pas als alles verwerkt | ✅ | |
| 6.4 | ❓ Vrijdag = ook fysieke wissel-voorbereiding (bakken dicht, klaar voor ophaal/wissel)? | ❓ | |

---
### FASE 7 — Week-overgang (alleen meerweekse vakanties)
Eigenaar: kantoor + chauffeur.
| # | actie | moet kunnen | status |
|---|---|---|---|
| 7.1 | Thema-wissel: oude themabakken + pool op, nieuwe eraf, in één rit | 🟠 bakken ✅, pool vergeten (B-F1) | |
| 7.2 | Rustweek (locatie dicht, heropent): vast materiaal + kleurenborden blijven; thema rouleert | 🟠 kleurenborden ✅, pool dubbel geleverd (B-F12) | |
| 7.3 | Zelfde thema elders nodig → tussentransport bewust plannen (conflict toont het) | 🟠 | |

---
### FASE 8 — Sluiting & eindophaling (einde vakantie)
| # | actie | moet kunnen | status |
|---|---|---|---|
| 8.1 | Definitief dicht: ALLES terug (thema, pool, kleurenborden, config-uitrusting, sport) | ✅ (S5-bewijs; herbevestigen met pool) | |
| 8.2 | Alles weer "thuis" in de Rozenweg; spreiding klopt | 🟠 bulk (B-F4/F5) | |
| 8.3 | ❓ Eindcontrole/inventaris na de vakantie: verifieer-notities afwerken, kapot vervangen, voorraad hertellen | ❌ als flow (losse stukken bestaan) | |

---
### FASE 9 — Evaluatie & volgende vakantie
| # | actie | moet kunnen | status |
|---|---|---|---|
| 9.1 | ❓ Wat wil kantoor achteraf weten: wat is kapot/weg, wat kostte het, welke thema's gedraaid, tekort-top? | ❌ | |
| 9.2 | Archief: oude periode blijft raadpleegbaar zonder de nieuwe te storen | ❌ (periode-lek B-F2/F3) | |
| 9.3 | Thema's bijwerken n.a.v. de praktijk (leesgids-stijl) | 🟠 handmatig | |

---
## Dwarsthema's (gelden overal)
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
