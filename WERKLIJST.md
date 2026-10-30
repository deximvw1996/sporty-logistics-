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
| 37 | Designsessie KV/chauffeur/navigatie/dashboard | Schermen en navigatie | Fable | bezig | 1 | chauffeursscherm GOEDGEKEURD 29/10; kantoor Vandaag DEFINITIEF 29/10 (design/KANTOOR-DEFINITIEF.html: B1+B3 met schakelaar Groot/Compact); ritplanning drieluik 1 afgewezen (lege ruimte / geen tijd / te veel rit); Maxim koos E+D (29/10) + regels bestuurder=elke medewerker en banen/meegroeiende dagkolommen; ritplanning DEFINITIEF 29/10; KV DEFINITIEF 29/10; prompts RP1 (C) en KV1 (D) klaar; patroon DEFINITIEF 29/10 (P1 + bulk van P2, design/PATROON-DEFINITIEF.html); DESKTOP COMPLEET EN GOEDGEKEURD 30/10 (alle 7 onderdelen); bouw: PL1 (D) gestart, MA1/BH1 volgen; gsm-ontwerpen daarna (Maxim: desktop eerst) |
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
| 70 | Rit-link en KV-link achter het Basic-wachtwoord | Veiligheid | Fable | gekeurd | 1 | Maxim 29/10: optie b. Rit-, kv-, tel-links, hun API's, foto's en public staan buiten de muur (token = toegang); rest blijft erachter; veiligheidstest 62 ok |
| 72 | KV-pagina op het goedgekeurde ontwerp (/kv/:token koerier-tabs + telscherm ✓ klopt/anders; te veel/kapot+foto/notitie; monitor-link /tel/:token) | KV | Bouwchat | gebouwd | 1 | KV1 (D) GEKEURD 29/10: test-kv1 43 ok op herdraai, volle run 19/19, live-check 390 px ok; afwijkingen terecht (attributen mini-telscherm, lege secties weg). Live op main |
| 73 | Kantoor-Nakijken toont ook bakken waar de KV nog niet aan begon (nu enkel bakken met een sessie) | Voorraad | Bouwchat | gebouwd | 2 | KD1 (D) GEKEURD 30/10: rij nog_niet + chip; test-kd1 17 ok, volle run 34/34 |
| 74 | Kantoornummer voor de KV-pagina instellen (app_vlaggen kantoor_telefoon) | Beheer | Maxim | open | 2 | zonder nummer verdwijnt de sectie Kantoor op de KV-pagina; Maxim geeft het nummer |
| 75 | Ritplanning op het goedgekeurde ontwerp (/ritplanning: weekagenda met banen, dag-inzoom, ritdetail; bestuurder = elke medewerker; voertuig pool/eigen/huur; waarschuwingen) | Transport | Bouwchat | gebouwd | 1 | RP1 (C) GEKEURD 29/10: test-rp1 28 ok op herdraai, volle run groen (catalogus-test 1× afgebroken door poort, apart 33 ok), live-check 1920×900 ok; migratie hernummerd naar 76. Live op main. Open: splitsen niet live getest (demodata), bezetting telt qty van regels |
| 76 | Aanvullijst Rozenweg: gsm-scherm (afvinken per stuk, foto bij afschrijven, bak klaar) + A4-printlijst, uit de beslissingen van Nakijken | Voorraad | Bouwchat | gebouwd | 1 | AV1 (D, 34 ok) gekeurd 30/10, 45/45, live; Maxim 29/10: aanvuller heeft geen desktop bij; mockup design/mockup-aanvullen-gsm.html; onderdeel van de mobiele app (77), niet als losse link |
| 77 | De volledige app ook op gsm: app-schil (tabbalk, rolafhankelijk) + per scherm een gsm-versie aangepast aan het formaat en aan app-conventies; personeel logt in met pincode; token-links alleen KV/monitor | Schermen en navigatie | Fable | bezig | 1 | KERNREGEL Maxim 29/10; Maxim koos M1 + takenstroom (29/10); app-schil DEFINITIEF 29/10 (A2 grote NU-kaart, design/MOBIEL-DEFINITIEF.html: chauffeur, coördinator, kantoor, Meer); MOB1 (C, 31 ok) + MOB2 (D, 42 ok) gekeurd 30/10, 44/44, live; overige schermen houden voorlopig hun eenvoudige gsm-weergave |
| 78 | Transport › Taken op het patroon (/taken, GET /api/taken-overzicht + /api/taken/:id/detail, patroon.css gedeeld) | Transport | Bouwchat | gebouwd | 1 | TR1 (C) GEKEURD 29/10: test-tr1 26 ok op herdraai, volle run 22/22, live-check ok. Live op main |
| 79 | Voorraad › Nakijken op het patroon + aanvullijst-API + A4-printlijst (/nakijken, /aanvullijst-print, migratie 77) | Voorraad | Bouwchat | gebouwd | 1 | VC1 (D) GEKEURD 29/10: test-vc1 46 ok op herdraai, volle run 22/22, live-check ok. Live op main. nakijken.css dubbelt patroon.css (samenvoegen bij volgende bouw) |
| 80 | Taken bundelen (zelfde dag + bestemming samenvoegen) | Transport | Bouwchat | gebouwd | 1 | TB1 (D) GEKEURD 30/10: route + knop in /taken, 409-uitleg; ontkoppelen zonder dataverlies (één functie); splitsen weigert geladen regels (gat gevonden+gedicht); herdraai 42 ok, volle run 23/23. Live op main |
| 81 | Attribuut dat de KV als beschadigd meldt krijgt een nakijk-regel en kantoor-actie | Voorraad | Bouwchat | gebouwd | 2 | TB1 (D) 30/10: nakijk_regel bij 'beschadigd', acties in Nakijken, aanvullijst toont het; + sectie 'Berichten van kantoor' op de KV-pagina; nakijken.css deelt patroon.css (hash identiek) |
| 82 | Rek/plank per bak + pool-plaats per stuk; aanvullijst gebruikt ze | Materiaal | Bouwchat | gebouwd | 2 | MA1 (C) 30/10: migratie 79 + backfill; PUT /api/bakken rek/plank/thuis gelogd |
| 83 | Generale repetitie: fictieve herfst uit de zomerdata, hele keten doorlopen (seed-script, ketentest, draaiboek) | Alles | Maxim | bezig | 1 | 30/10 04:05: seed GEDRAAID OP PROD (periode 'Herfst 2026 FICTIEF' actief; 8 locaties, 8 KV's, 6 ritten, 16 taken; links in GENERALE-REPETITIE-links.json). Maxim loopt het draaiboek GENERALE-REPETITIE.md op desktop + gsm; daarna --opruimen |
| 84 | Planning › Kampmomenten op het patroon (/kampmomenten, overzicht/detail/velden/kv-links, migratie 78) | Planning | Bouwchat | gebouwd | 1 | PL1 (D) GEKEURD 30/10: test-pl1 37 ok op herdraai, volle run 25/25. Live op main |
| 85 | Gaten uit de generale repetitie dichten (rest-taak datum, Vandaag morgen + tellingen, KV-logging, coördinator-rol, weekendbevestiging, opruimen, generator ophaaldag/themadag, kookdagen) | Alles | Bouwchat | gebouwd | 1 | GF1 (D) GEKEURD 30/10: test-gf1 37 ok op herdraai, ketentest 47 ok zonder overgeslagen gaten, volle run 27/27; migratie 80. Live op main. Volgende: seed op prod + draaiboek |
| 86 | Railway-mail 'Deployment crashed' bij elke update (oude versie stopte via npm met signaal i.p.v. exit 0) | Beheer | Fable | gebouwd | 2 | 30/10: railway.json met startCommand 'node server.js' (SIGTERM-handler eindigt met exit 0); bewijs: volgende deploy zet de vorige op REMOVED, niet CRASHED |
| 87 | Materiaal › Bakken op het patroon (/bakken, GET /api/bakken-overzicht + detail, verwijderen met controle, /etiketten printbaar) | Materiaal | Bouwchat | gebouwd | 1 | MA1 (C) GEKEURD 30/10: test-ma1 25 ok op herdraai, volle run 26/26. Live op main |
| 88 | Beheer › Personeel + Logboek op het patroon (/personeel, /logboek, rollen/rechten, pincode-reset, (de)activeren, uitnodiging, migratie 81) | Beheer | Bouwchat | gebouwd | 1 | BH1 (C) GEKEURD 30/10: test-bh1 37 ok op herdraai, volle run 28/28. Live op main. DESKTOP VOLLEDIG GEBOUWD behalve Locaties (LO1) en navigatie-bedrading (NAV1) |
| 89 | Navigatie: bovenbalk/subbalken wijzen naar de nieuwe schermen (public/nav.js); oude tabs tonen vervangstrook | Schermen en navigatie | Bouwchat | gebouwd | 1 | NAV1 (D) GEKEURD 30/10: test-nav1 34 ok, volle run 30/30; reviewfix Fable: Locaties → /locaties, testfoto's uit repo. Live op main. DESKTOP VOLLEDIG NIEUW |
| 90 | Locaties op het patroon (/locaties; PATROON-DEFINITIEF als ontwerp; wifi, gemeente, foto's, contact mailen; migratie 82) | Locaties | Bouwchat | gebouwd | 1 | LO1 (C) GEKEURD 30/10: test-lo1 24 ok op herdraai, volle run 29/29. Live op main. DESKTOP: alle 7 onderdelen gebouwd; alleen NAV1 (89) nog open |
| 91 | Testverslag T1 (generale repetitie op prod door chat T): 8 stappen, 20 bevindingen (G1–G20); verslag TESTVERSLAG-T1.md | Alles | T | gekeurd | 1 | 30/10: fixes verdeeld over TF1 (C: keten) en TF2 (D: afwerking); G1 (visuele desktop-check) doet Maxim in zijn run |
| 92 | TF1: spoedrit zonder chauffeur zichtbaar + waarschuwing, stoptijden volgen vertrek, herinnering niet in Beslissen + wel op KV-overzicht, niet-geleverd-waarschuwing, capaciteit enkel op te rijden ritten + klaarzet-bevestiging, te-veel in stuks, regel zonder aantal, chauffeursnaam in logboek | Alles | Bouwchat | gebouwd | 1 | TF1 (C) GEKEURD 30/10: test-tf1 24 ok op herdraai, volle run 31/31. Live op main. Rest → RP2: spoedroute zelf kiest chauffeur (aanvragen.js), stops schuiven mee bij vertrek-wijziging, geleverd-vlag voor bulk |
| 93 | TF2: tijdzone Europe/Brussels, 502-herpoging tijdens deploy, wissel-hint, dubbele/lege bakcodes, draaiboek, bestelling pas afvinkbaar na levering, datumformaat, 'KV KV', teksten, bakcode in kapot-lijst | Alles | Bouwchat | gebouwd | 1 | TF2 (D) GEKEURD 30/10: test-tf2 32 ok op herdraai, volle run 31/31. Live op main. Rest: herpoging op kantoorpagina's, knop 'Bestelling binnen' in /nakijken (enkel API) |
| 94 | Ritplanning interactief (RP2, incl. rest TF1: spoedroute met chauffeur, stops schuiven mee bij vertrek-wijziging, geleverd-vlag bulk): ritblokken slepen (dag/uur), verlengen/inkorten, stops slepen tussen/binnen ritten (🔒-regel), open taken in de agenda droppen; gelogd en omkeerbaar; muis + touch | Transport | Bouwchat | gebouwd | 1 | RP2 (C) GEKEURD 30/10: test-rp2 35 ok, volle run 35/35; reviewfix: sportyApi + flits 4 s. Rest: bestuurder-keuze bij 'Goedkeuren + spoed' (kaart heeft geen modal), verlengen onderaan doet niets (geen einde-kolom), nav-balk op gsm te breed |
| 97 | Materiaal › Thema's, Pool (incl. sportsets), Catalogus op het standaardpatroon (mockup-materiaal-rest goedgekeurd) | Materiaal | Bouwchat | gebouwd | 1 | MA2 (D) GEKEURD 30/10: test-ma2 94 ok, volle run 36/36. Rest: dubbel-detectie te breed (149 i.p.v. ~22), Bestellen in Catalogus uit (komt via TB2 + Bestelling), /bakken?thema= nog niet gelezen, ↶-terugdraai ontbreekt als route |
| 98 | Voorraad › Tekorten & bestellingen op het patroon (Voorraad gaat op in Catalogus) | Voorraad | Bouwchat | gebouwd | 1 | TB2 door C, gekeurd 30/10 (34 ok, volle run groen), live |
| 99 | Transport › Voertuigen per echt voertuig (weekbezetting, dubbel, onderhoud); oude rittenlijst opgaan in Ritplanning | Transport | Bouwchat | gebouwd | 1 | VT1 door D, gekeurd 30/10 (55 ok, 37/37), live; rest: voertuig wisselen in ritdetail |
| 100 | Planning › Periodes, Rooster, Thema's per week + Sportrooster (sets per week/locatie) + Sport-tab per kampmoment | Planning | Fable | gebouwd | 2 | PL2 (C, 47 ok) + PL3 (D, 68 ok) gekeurd 30/10, volle run 40/40, live; groep 4; v3 goedgekeurd 30/10, prompts PL2 (C: rooster+periodes) en PL3 (D: sportrooster per dag); mockup v2 (week+seizoen, sport per dag en per soort, meldingen dubbel/herhaald thema) 30/10; Maxim 30/10: sportsets in Pool, inplannen in Planning |
| 101 | Beheer › Export & back-up, Instellingen (incl. kantoornummer, punt 74) | Beheer | Fable | gebouwd | 2 | BH2 (C, 47 ok) gekeurd 30/10, 42/42, live; mockup-beheer goedgekeurd 30/10 + nachtback-up; prompt BH2 (C); groep 5 |
| 102 | Kaart: tab in Locaties of laatste oude tab | Locaties | Fable | gebouwd | 3 | LK1 (D, 36 ok) gekeurd 30/10, 41/41, live; Kaart als knop in Locaties (Maxim 30/10); prompt LK1 (D) + 3 restpunten; groep 6 |
| 95 | AF1: 502-herpoging op alle kantoorpagina's (gedeelde sportyApi in nav.js), knop 'Bestelling binnen' in Nakijken › Tekorten, notitie-strip in taken-overzicht/vandaag waar nodig | Alles | Bouwchat | gebouwd | 2 | AF1 (D) GEKEURD 30/10: test-af1 36 ok op herdraai, volle run 33/33; reviewfix: locaties.html laadt nav.js. Knop 'Bestelling binnen' staat in het Nakijken-detail (geen Tekorten-lijst in /nakijken; oude /#tekorten zonder knop) |
| 96 | Vandaag: als 'Deze week' leeg is, 'Volgende week · N locaties' tonen (M1, Maxims run 30/10) | Vandaag | Bouwchat | gebouwd | 2 | KD1 (D) GEKEURD 30/10: volgende_week + week_label; live |
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
