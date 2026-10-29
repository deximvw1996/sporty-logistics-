# Sporty — werklijst

Spiegel van https://claude.ai/artifact/4RCousUbe3AhyaohNKF8Ge (Fable schrijft hem bij na elke wijziging). Statusladder: open → bezig → gebouwd → gekeurd (Fable) → goed voor Maxim → definitief (alleen Maxim zet dat vinkje). Prio 1 = vóór de herfstvakantie (2–8 nov).

| # | Wat | Gebied | Spoor | Status | Prio | Notitie |
|---|---|---|---|---|---|---|
| 1 | V0 veiligheidsronde: foto-upload, rolcontrole, export, uploads achter muur, tabel-whitelist, login-limiet + scrypt | Veiligheid | Bouwchat | gekeurd | 1 | chat A; test-veiligheid 2× 58/58; live 28/10 |
| 2 | Sessies: verloop + wissen bij verwijderen personeelslid (C-#7) | Veiligheid | Bouwchat | open | 3 | |
| 3 | XSS: ±20 ruwe interpolaties + /rit-pagina + CSP (C-#8) | Veiligheid | Bouwchat | open | 3 | |
| 4 | Foto-velden begrenzen op type/grootte, kv-kapotroute (C-#10) | Veiligheid | Bouwchat | open | 2 | hangt samen met #23 |
| 5 | APP_PASSWORD wisselen in Railway (variabele + Deploy, dan privévenster) | Veiligheid | Maxim | open | 1 | |
| 6 | V1 testharnas: _testhulp, volle-run, regressietests | Testen | Bouwchat | gekeurd | 1 | chat B; 13 tests in volle-run; herfst-test.db ijk-db |
| 7 | Periodes: beheer-UI, actieve periode bewaren, 'Zomer 2026'-terugval weg (T-1.4/G7) | Periodes en planning | Bouwchat | gekeurd | 1 | V2 chat B: migratie 71, /api/periodes/actief + activeer; live 29/10 |
| 8 | Periode-bewust: generator, conflicten, sport, kleurenborden, kv-sessies (B-F2/F3/R11) | Periodes en planning | Bouwchat | gekeurd | 1 | V2: generator/conflicten/sport/kleurenborden klaar; kv-sessies → 64 |
| 9 | Conflicten-tab op server-bron + waarschuwing bij themakeuze (T-G5) | Schermen en navigatie | Bouwchat | gekeurd | 1 | V3b chat D; live 29/10 |
| 10 | pool_tekort ziet kastelen/blazers; ontbrekend_transport bij pool-only (B-F10/F11) | Transport en generator | Bouwchat | open | 2 | |
| 11 | Spoedtaak uit aanvraag: locatie, datum in kampweek, aantal; afwijzen annuleert (B-F8) | Transport en generator | Bouwchat | gekeurd | 1 | V3a chat C; live 29/10 |
| 12 | Annuleer-bug behandelAanvraag + modal (D-#1, T-G1) | Schermen en navigatie | Bouwchat | gekeurd | 1 | V3b chat D; live 29/10 |
| 13 | Bulk-boekhouding: één verplaatsfunctie; opnieuw-gedaan niet dubbel (B-F4/F5) | Pool en bulk | Bouwchat | gekeurd | 1 | V3a lib/bulk.js; handmatige verplaatsing in bakken.js nog kaal (→ 58) |
| 14 | Rit/taak op gedaan na lossen; onderweg/aangekomen chauffeur (T-G3/2.5) | Chauffeur | Bouwchat | gekeurd | 1 | V3a chat C; live 29/10 |
| 15 | Ophaalrit toont bakkenlijst zonder Klaarzetten (T-G6) | Chauffeur | Bouwchat | gekeurd | 1 | V3a chat C; live 29/10 |
| 16 | Sportpakket door de hele keten (T-2.3/3.1/4.13/1.14) | Transport en generator | Bouwchat | open | 2 | |
| 17 | Thema-wissel + rustweek: pool correct (B-F1/F12) | Transport en generator | Bouwchat | open | 3 | kerst |
| 18 | Taak splitsen/verwijderen na laden (B-F6/F7) | Transport en generator | Bouwchat | gekeurd | 2 | V3d chat C: checks mee, 409 bij geladen, terug-op-gepland; live 29/10 |
| 19 | KV-telscherm: intypen, alles-aanwezig, bevestigingen, tabs, 44px (T-3.2, D) | KV-scherm | Bouwchat | open | 3 | LOGISTIEK EERST; designsessie eerst |
| 20 | Vrijdagcontrole: lege controle, hertellen, aanvullen-validatie (D-#2, B-R5-R7) | Vrijdagcontrole en voorraad | Bouwchat | open | 2 | |
| 21 | KV ziet vaste bakken met 0 items (A-GEVONDEN-4) | KV-scherm | Bouwchat | open | 2 | |
| 22 | Atomaire database-schrijving + SIGTERM-save (A-1) | Architectuur en robuustheid | Bouwchat | gekeurd | 1 | F1 chat A; live 28/10 |
| 23 | Foto's uit de database naar uploads-map (A-2) | Architectuur en robuustheid | Bouwchat | gekeurd | 2 | V3c chat E; migratie 70; backup dekt uploads/ niet (→ 61) |
| 24 | Mig 47 gaten; KV:/INFO:- en transportregel-rijen uit catalogus (A-5, B-F9) | Data en opschoning | Bouwchat | gekeurd | 2 | V3c+V3d: geen aanmaak meer vanuit transport; 10 types weg op prod; KV:/INFO: wacht op S4.8-vervanger |
| 25 | Prod-opschoning: 99-EHBO, 'undefined'-wees, regels-wezen (B-F13, A) | Data en opschoning | Fable | gekeurd | 1 | uitgevoerd op prod 29/10 00:50 na OK Maxim: 99-EHBO weg, 96 wezen weg, 10 types weg; backup voor-herstel op volume |
| 26 | Voorraad + bakcodes vullen voor herfstthema's (E) | Data en opschoning | Maxim | open | 1 | |
| 27 | Prompts/confirms → modal; KV-alerts → toasts; stille catches (D-#7/#19) | Schermen en navigatie | Bouwchat | gekeurd | 2 | V3b: index.html 0 prompt/confirm; rit-/kv-pagina alert() nog open (→ 59) |
| 28 | Navigatie herontwerpen (D-#4) | Schermen en navigatie | Fable | open | 2 | designsessie |
| 29 | Paginering/zoek Locaties, Vaste bakken, Sport (D-#5/#10) | Schermen en navigatie | Bouwchat | open | 3 | |
| 30 | Mobiel: 44px-knoppen, weekgrid onder 600px (D-#6/#9) | Schermen en navigatie | Bouwchat | open | 2 | |
| 31 | Eindophaling ná de vrijdagcontrole (T-4.11) | Transport en generator | Bouwchat | open | 2 | draaiboek fase 3 |
| 32 | Legacy-opkuis echt afmaken (A-11) | Architectuur en robuustheid | Bouwchat | later | 5 | |
| 33 | KV:/INFO: als structuur (A-9) | Thema's en catalogus | Bouwchat | later | 5 | |
| 34 | Schrijven batchen per request (A-7) | Architectuur en robuustheid | Bouwchat | later | 4 | vóór zomer |
| 35 | Catalogus: dubbels, eenheden, ongebruikte types (E) | Data en opschoning | Bouwchat | later | 4 | |
| 36 | DRAAIBOEK valideren met Maxim | Werkwijze | Maxim | bezig | 1 | brainstorm |
| 37 | Designsessie KV/chauffeur/navigatie/dashboard | Schermen en navigatie | Fable | bezig | 1 | chauffeursscherm GOEDGEKEURD 29/10; kantoor Vandaag DEFINITIEF 29/10 (design/KANTOOR-DEFINITIEF.html: B1+B3 met schakelaar Groot/Compact); ritplanning drieluik 1 afgewezen (lege ruimte / geen tijd / te veel rit); Maxim koos E+D (29/10) + regels bestuurder=elke medewerker en banen/meegroeiende dagkolommen; ritplanning DEFINITIEF 29/10; KV DEFINITIEF 29/10 (design/KV-DEFINITIEF.html: B + telscherm B2); volgende: patroon overige kantoorschermen (wacht op ok Maxim) + bouwprompt KV |
| 38 | Herfstplanning 2–8 nov invoeren | Periodes en planning | Fable | open | 1 | gegevens van Maxim nodig |
| 39 | Generale repetitie + walkthrough 3–8 | Testen | Fable | open | 1 | |
| 40 | Sollicitatiedossier (deadline 11 nov) | Sollicitatie | Maxim | open | 1 | |
| 41 | Wijzigingslog op alle tabellen + terugzetten (Google-Drive-versies) | Architectuur en robuustheid | Bouwchat | bezig | 2 | F1: tabel + 5 kerntabellen live; rest + terugzet-UI open |
| 42 | Postgres op Railway i.p.v. sql.js-bestand | Architectuur en robuustheid | Bouwchat (Opus) | open | 2 | golf 2, na testharnas |
| 43 | "Nodig van/tot" per onderdeel: nalevering + deelophaling in de generator | Transport en generator | Bouwchat | open | 2 | golf 2, DRAAIBOEK 3.1/3.4 |
| 44 | Rooster chauffeurs + voertuigen (wie werkt wanneer, wie rijdt met wat) | Transport en generator | Bouwchat | open | 2 | golf 2 |
| 45 | Rit: locatie→locatie zonder tussenstop; weekend alleen op keuze | Transport en generator | Bouwchat | open | 2 | golf 2 |
| 46 | "Probleem melden" op de rit-pagina (foto, naar kantoor/KV) | Chauffeur | Bouwchat | open | 2 | golf 2 |
| 47 | Locatiedossier: foto's, ruimtes, wifi, poortcodes, contactpersonen, overdrachtsfoto's | Locaties en standaardmateriaal | Bouwchat | open | 2 | golf 2; codes nooit in export |
| 48 | Meldingen + web-push (KV, chauffeur, kantoor) | Schermen en navigatie | Bouwchat | open | 2 | golf 2 |
| 49 | Volgscherm KV/coördinator: onderweg, verwacht, ontbreekt, waar staat het | KV-scherm | Bouwchat | open | 3 | golf 3 (LOGISTIEK EERST) |
| 50 | Monitor-link met tel-token (alleen telscherm) | KV-scherm | Bouwchat | open | 3 | golf 3 |
| 51 | Verbruikshistoriek per thema/item + inkooplijst per vakantie | Vrijdagcontrole en voorraad | Bouwchat | open | 3 | golf 3 |
| 52 | Rapporten per vakantie (kapot/weg, kosten, tekort-top, ritten) | Data en opschoning | Bouwchat | open | 3 | golf 3 |
| 53 | Printlijst per kampmoment + klaarzet-taak toewijsbaar | Pool en bulk | Bouwchat | open | 3 | golf 3 |
| 54 | Drie stockageplaatsen: ophaling naar de juiste thuisplaats verifiëren | Transport en generator | Bouwchat | open | 2 | golf 2 |
| 55 | KV-budget per kookkamp | KV-scherm | Bouwchat | later | 4 | wens Maxim |
| 56 | Backup-knop UI: downloadBackup() zonder token → 401 | Schermen en navigatie | Bouwchat | open | 2 | GEVONDEN A |
| 57 | POST kampmomenten slikt fouten in; klaarzet_door uit body i.p.v. sessie | Periodes en planning | Bouwchat | gekeurd | 2 | V2: 409 met tekst + log; klaarzet_door = sessie |
| 58 | Handmatige verplaatsing + vaste-bak-aantal in bakken.js via verplaatsBulk | Pool en bulk | Bouwchat | gekeurd | 1 | V3d: zetBezit/controleerSom; live 29/10 |
| 59 | alert() op rit- en kv-pagina → toasts | Chauffeur | Bouwchat | gebouwd | 2 | V3d: rit-pagina klaar; kv-pagina nog open |
| 61 | Backup dekt uploads/ (foto's) niet: volume-backup of foto-export | Architectuur en robuustheid | Bouwchat | open | 2 | GEVONDEN E |
| 62 | herstel-db: proces stopte met exit 0 en Railway herstartte niet (prod 10 min plat); hotfix exit 1 door Fable; nette oplossing = herladen zonder exit | Architectuur en robuustheid | Bouwchat | gebouwd | 1 | hotfix live 29/10 |
| 63 | test-v3c-fotos leest de lokale sporty.db i.p.v. herfst-test.db (resultaat hangt van de map af) | Testen | Bouwchat | open | 3 | GEVONDEN C |
| 64 | KV-sessies periode-veilig: nakijk_sessies.kampmoment_id (migratie+backfill), kv.js en voorraad.js erop | KV-scherm | Bouwchat | gekeurd | 1 | V2b chat B: migratie 72; keten-kv-periode 19/19; live 29/10 |
| 65 | Kalender hardcodeert juli-augustus; planner-periodekiezer zet actief lokaal; _activePeriode-terugval 'Zomer 2026' | Periodes en planning | Bouwchat | gekeurd | 2 | V2b: kalender uit periode (+ tijdzonefout weg), kiezer via server; live 29/10 |
| 66 | test-f1-schrijven flaky in volle run (AFGEBROKEN/1 fout, los altijd groen): poller 100 ms | Testen | Bouwchat | open | 3 | GEVONDEN B |
| 67 | Tekortenlijst-UI: kop 'zonder kampmoment' tonen (backend levert ze al achteraan) | Vrijdagcontrole en voorraad | Bouwchat | open | 2 | GEVONDEN B (V2b) |
| 68 | setActivePeriode (Periodes-lijst) herlaadt kalender niet; andere isoDate-middernacht-plekken (tijdzone) | Periodes en planning | Bouwchat | open | 3 | GEVONDEN B (V2b) |
| 69 | Dagoverzicht chauffeur met tijdlijn; stops vast (kantoor) of vrij (chauffeur wisselt met ▲▼); terug naar vorige stop | Chauffeur | Bouwchat | gebouwd | 1 | CH1 (C) + CH2 (D) GEKEURD 29/10: rit-pagina = exacte kopie van CHAUFFEUR-DEFINITIEF op de CH1-data (public/rit.*); herdraai ch2 38 ok, ch1 40 ok, volle run 17/17; live-check op 390 px (wissel, contacten, past-niet) ok; 2 reviewfixes (wissel van afgewerkte stop; gedeeltelijke PUT locatie). Live op main |
| 70 | Rit-link en KV-link achter het Basic-wachtwoord: chauffeur/KV moet het app-wachtwoord kennen; beslissen: wachtwoord delen of /rit, /kv, /uploads buiten de muur (token = toegang) | Veiligheid | Maxim | open | 1 | gevonden door chat D bij CH2 (29/10) |
| 71 | Kantoor "Vandaag" + nieuwe hoofdnavigatie (/vandaag, GET /api/vandaag, voorkeur Groot/Compact per gebruiker, migratie 74) | Schermen en navigatie | Bouwchat | gebouwd | 1 | KO1 (C) GEKEURD 29/10: test-ko1 34 ok op herdraai, volle run 18/18, live-check 1920×900 (schakelaar, voorkeur, actie Afwijzen) ok; afwijkingen terecht (weekend-bevestigen bestaat niet, depots geen stop). Open: ?taak=/?rit= selecteren in Transport komt met de ritplanning-bouw |
| 60 | /api/conflicten: periode-filter + gestructureerde velden (week, locatie_ids, kampmoment_ids); 'kampmoment zonder thema' terug | Periodes en planning | Bouwchat | gekeurd | 1 | V2: ?periode_id, velden, geen_thema |

## Volgorde van de prompts (voorlopig — brainstorm legt vast)
| plaats | chat | prompt | onderwerp | taken | toestand |
|---|---|---|---|---|---|
| ✓ | A | V0 | Veiligheidsnoodronde | 1 | klaar (28/10) |
| ✓ | A | F1 | Fundament: modules, atomaire schrijving, wijzigingslog | 22, 41 | klaar (28/10, 54d4ee6) |
| 1 | B | V1 | Testharnas | 6 | klaar (29/10, 670b19d) |
| 2 | B | V2 | Dynamische periodes + conflicten-API + kampmoment uniek per periode | 7, 8, 57, 60 | klaar (29/10, 1d0a818) |
| 8 | B | V2b | KV-sessies per kampmoment, kalender en planner-kiezer dynamisch | 64, 65 | klaar (29/10) |
| 9 | C | CH1 | Chauffeursscherm deel 1: data/API (slot vast/vrij, wissel, contacten, niet-mee → rest-taak, probleem melden) | 69, 47, 46 | gepland (prompt klaar) |
| 10 | D | CH2 | Chauffeursscherm deel 2: rit-pagina als exacte kopie van CHAUFFEUR-DEFINITIEF | 69 | idee (na CH1) |
| 3 | C | V3a | Ketenfixes transport | 11, 13, 14, 15 | klaar (29/10, 7febb80) |
| 4 | D | V3b | Annuleer-bug + modals + conflicten-tab | 12, 27, 9 | klaar (29/10, f389c61) |
| 5 | E | V3c | Foto's uit db + prod-opschoning + catalogus | 23, 24, 25 | klaar (29/10, 9e04932) |
| 6 | C | V3d | Splits/verwijderen na laden, bulk overal via één functie, catalogus, rit-toasts | 18, 58, 24, 59 | klaar (29/10, 27d4cfd) |
