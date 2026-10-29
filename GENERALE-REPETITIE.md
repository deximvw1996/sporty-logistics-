# Generale repetitie — fictieve herfst (2–8 november 2026)

Een week uit de zomerplanning, gespeeld als herfst. Alles wat het script maakt heet **FICTIEF**. Het opruimscript verwijdert het weer.
Rollen: **K** = kantoor (desktop) · **C** = chauffeur (gsm) · **V** = KV (gsm).

## 0. Klaarzetten (hoofdchat, één keer)
```
set SPORTY_PROD_PW=<wachtwoord van de site>
node scripts/generale-repetitie.mjs --doel=prod
```
Dit maakt het volgende aan:
- de periode "Herfst 2026 FICTIEF", die meteen actief wordt;
- 8 kampmomenten met thema's en een KV;
- de leveringen (vr 30 okt) en ophalingen;
- 4 leveringsritten (één coördinator met een huurwagen) en 2 ophaalritten (vr 6 nov);
- een sportdag op za 7 nov, nog zonder rit.

De links staan daarna in `GENERALE-REPETITIE-links.json`. Vul ze hieronder in:

| Wat | Link |
|---|---|
| KV-links (8) | `<site>/kv/<token>` — Abdijschool · Boutersem · Betekom · Rotselaar · De Kraal · De Waaier · De Ark 3 · Sportschuur |
| Rit-links leveringen | `<site>/rit/<token>` — rit 1 · rit 2 · rit 3 · coördinator |
| Rit-links ophalingen | `<site>/rit/<token>` — ophaling 1 · ophaling 2 |

## 1. Donderdag 29 okt — vooruitkijken
| Wie | Scherm | Doen | Je moet zien |
|---|---|---|---|
| K | **Ritplanning**, week van 30 okt | vrijdag aanklikken | 4 ritten op vrijdag. Bij één of meer ritten staat "⚠ N stuks op 20 plaatsen". |
| K | **Vandaag** | — | 0 te beslissen. De ritten van morgen staan hier (nog) niet. |

## 2. Vrijdag 30 okt — leveren
| Wie | Scherm | Doen | Je moet zien |
|---|---|---|---|
| C | rit-link rit 1 | Bij stop 2 één bak "past niet" melden, de rest laden | De teller springt naar alles geladen op 1 na. |
| C | rit-link rit 1 | twee vrije stops van plaats wisselen: kantoor zet eerst stop 1 **én** stop 2 op vrij (▲▼ wisselt alleen met een aangrenzende vrije stop; vaste stops blijven staan) | De volgorde draait om, de tijden mee. |
| C | rit-link rit 1 | per stop: Aangekomen, dan lossen | De rit staat op "gedaan". |
| C | rit-link coördinator | laden, aankomen, lossen | De rit staat op "gedaan". |
| K | **Taken** / **Vandaag** › Inplannen | de rest-taak zoeken | Ze staat er (oranje "rest", met datum en stuks). |

## 3. Vrijdag 30 okt, namiddag — rest wegbrengen
| Wie | Scherm | Doen | Je moet zien |
|---|---|---|---|
| K | **Ritplanning** › "+ rit" | rit om 15:00, met de rest-taak erop, daarna Klaarzetten | De rit om 15:00 staat er. Daarna knop "Klaargezet ✓". |

## 4. Maandag 2 nov — tellen en melden
| Wie | Scherm | Doen | Je moet zien |
|---|---|---|---|
| V ×5 | KV-link › Tellen | alles "✓ klopt", Versturen | Het overzicht toont "geteld". |
| V | KV-link (De Waaier) | 1 stuk "anders": één te weinig + notitie | De status is rood (tekort). |
| V | KV-link (De Ark 3) | 1 stuk kapot + foto, 1 stuk twee te veel | Oranje (kapot) en blauw (te veel). |
| V | KV-link (Sportschuur) | niets | — |
| V | KV-link › Aanvragen | Boutersem: "extra ballen ×6"; Betekom: "oven kapot" + foto | Beide aanvragen staan als "nieuw". |
| C | rit-link ophaling 1 › stop › Probleem | "Locatie gesloten" | Kantoor krijgt een melding. |

## 5. Maandag 2 nov — kantoor beslist en keurt
| Wie | Scherm | Doen | Je moet zien |
|---|---|---|---|
| K | **Vandaag** › Beslissen | — | 🚪 melding chauffeur · 💥 oven · 📩 ballen |
| K | **Voorraad & controles › Nakijken** | tekort → Bestellen, te veel → Terug naar pool, kapot → Afschrijven + bestellen; daarna Keuring afronden | Te keuren gaat naar 0 en Nagekeken loopt op. |
| K | Nakijken › Sportschuur | Herinnering naar KV | De KV ziet de herinnering op haar pagina. |
| K | **Aanvullen** + 🖨 Printlijst | — | 3 handelingen (bestelling, afschrijven, terug naar pool). De printlijst opent. |

## 6. Dinsdag 3 nov — aanvullen in de Rozenweg
| Wie | Scherm | Doen | Je moet zien |
|---|---|---|---|
| K | Nakijken | de bestelling op "Bestelling binnen" zetten (kan pas na levering) | Pas daarna is ze af te vinken. |
| K (gsm) | Aanvullijst | elke handeling afvinken | Alles staat op "klaar". |

## 7. Vrijdag 6 nov — ophalen + weekend
| Wie | Scherm | Doen | Je moet zien |
|---|---|---|---|
| C | rit-links ophaling 1 en 2 | laden, aankomen, lossen per stop | Beide ritten staan op "gedaan". In **Taken** staan de ophaaltaken op gedaan. |
| K | **Taken** › filter Weekend | sportdag → "Op een rit zetten" (bevestig het weekend) | De rit op zaterdag toont ⚠ weekend. |

## 8. Afsluiten
| Wie | Scherm | Doen | Je moet zien |
|---|---|---|---|
| K | **Overzicht › Conflicten** | — | Geen dubbel thema; de lijst is normaal leeg. Capaciteit staat daar niet: die zie je in de **Ritplanning** (⚠ N stuks op M plaatsen). |
| hoofdchat | terminal | `node scripts/generale-repetitie.mjs --doel=prod --opruimen` | De periode, kampmomenten, ritten, taken en FICTIEF-personen zijn weg, en "Zomer 2026" is weer actief. |

⚠ **Blijft staan na het opruimen** (geen verwijderroute): aanvragen, tellingen (nakijk-sessies en -regels) en kalenderdagen van de fictieve kampmomenten (gat #8). Op prod moet dat met de hand of met een opruimroute.
