# Sporty — werklijst

Spiegel van https://claude.ai/artifact/4RCousUbe3AhyaohNKF8Ge (Fable schrijft hem bij na elke wijziging). Statusladder: open → bezig → gebouwd → gekeurd (Fable) → goed voor Maxim → definitief (alleen Maxim zet dat vinkje). Prio 1 = vóór de herfstvakantie (2–8 nov).

| # | Wat | Gebied | Spoor | Status | Prio | Notitie |
|---|---|---|---|---|---|---|
| 1 | V0 veiligheidsronde: foto-upload, rolcontrole, export, uploads achter muur, tabel-whitelist, login-limiet + scrypt | Veiligheid | Bouwchat | gekeurd | 1 | chat A; test-veiligheid 2× 58/58; live 28/10 |
| 2 | Sessies: verloop + wissen bij verwijderen personeelslid (C-#7) | Veiligheid | Bouwchat | open | 3 | |
| 3 | XSS: ±20 ruwe interpolaties + /rit-pagina + CSP (C-#8) | Veiligheid | Bouwchat | open | 3 | |
| 4 | Foto-velden begrenzen op type/grootte, kv-kapotroute (C-#10) | Veiligheid | Bouwchat | open | 2 | hangt samen met #23 |
| 5 | APP_PASSWORD wisselen in Railway (variabele + Deploy, dan privévenster) | Veiligheid | Maxim | open | 1 | |
| 6 | V1 testharnas: _testhulp, volle-run, regressietests | Testen | Bouwchat | open | 1 | |
| 7 | Periodes: beheer-UI, actieve periode bewaren, 'Zomer 2026'-terugval weg (T-1.4/G7) | Periodes en planning | Bouwchat | open | 1 | V2 deel 1 |
| 8 | Periode-bewust: generator, conflicten, sport, kleurenborden, kv-sessies (B-F2/F3/R11) | Periodes en planning | Bouwchat | open | 1 | V2 deel 2 |
| 9 | Conflicten-tab op server-bron + waarschuwing bij themakeuze (T-G5) | Schermen en navigatie | Bouwchat | open | 1 | |
| 10 | pool_tekort ziet kastelen/blazers; ontbrekend_transport bij pool-only (B-F10/F11) | Transport en generator | Bouwchat | open | 2 | |
| 11 | Spoedtaak uit aanvraag: locatie, datum in kampweek, aantal; afwijzen annuleert (B-F8) | Transport en generator | Bouwchat | open | 1 | bevestigd op kloon |
| 12 | Annuleer-bug behandelAanvraag + modal (D-#1, T-G1) | Schermen en navigatie | Bouwchat | open | 1 | |
| 13 | Bulk-boekhouding: één verplaatsfunctie; opnieuw-gedaan niet dubbel (B-F4/F5) | Pool en bulk | Bouwchat | open | 1 | 34 van 17 bevestigd |
| 14 | Rit/taak op gedaan na lossen; onderweg/aangekomen chauffeur (T-G3/2.5) | Chauffeur | Bouwchat | open | 1 | |
| 15 | Ophaalrit toont bakkenlijst zonder Klaarzetten (T-G6) | Chauffeur | Bouwchat | open | 1 | |
| 16 | Sportpakket door de hele keten (T-2.3/3.1/4.13/1.14) | Transport en generator | Bouwchat | open | 2 | |
| 17 | Thema-wissel + rustweek: pool correct (B-F1/F12) | Transport en generator | Bouwchat | open | 3 | kerst |
| 18 | Taak splitsen/verwijderen na laden (B-F6/F7) | Transport en generator | Bouwchat | open | 2 | |
| 19 | KV-telscherm: intypen, alles-aanwezig, bevestigingen, tabs, 44px (T-3.2, D) | KV-scherm | Bouwchat | open | 3 | LOGISTIEK EERST; designsessie eerst |
| 20 | Vrijdagcontrole: lege controle, hertellen, aanvullen-validatie (D-#2, B-R5-R7) | Vrijdagcontrole en voorraad | Bouwchat | open | 2 | |
| 21 | KV ziet vaste bakken met 0 items (A-GEVONDEN-4) | KV-scherm | Bouwchat | open | 2 | |
| 22 | Atomaire database-schrijving + SIGTERM-save (A-1) | Architectuur en robuustheid | Bouwchat | open | 1 | |
| 23 | Foto's uit de database naar uploads-map (A-2) | Architectuur en robuustheid | Bouwchat | open | 2 | |
| 24 | Mig 47 gaten; KV:/INFO:- en transportregel-rijen uit catalogus (A-5, B-F9) | Data en opschoning | Bouwchat | open | 2 | |
| 25 | Prod-opschoning: 99-EHBO, 'undefined'-wees, regels-wezen (B-F13, A) | Data en opschoning | Fable | open | 1 | |
| 26 | Voorraad + bakcodes vullen voor herfstthema's (E) | Data en opschoning | Maxim | open | 1 | |
| 27 | Prompts/confirms → modal; KV-alerts → toasts; stille catches (D-#7/#19) | Schermen en navigatie | Bouwchat | open | 2 | |
| 28 | Navigatie herontwerpen (D-#4) | Schermen en navigatie | Fable | open | 2 | designsessie |
| 29 | Paginering/zoek Locaties, Vaste bakken, Sport (D-#5/#10) | Schermen en navigatie | Bouwchat | open | 3 | |
| 30 | Mobiel: 44px-knoppen, weekgrid onder 600px (D-#6/#9) | Schermen en navigatie | Bouwchat | open | 2 | |
| 31 | Eindophaling ná de vrijdagcontrole (T-4.11) | Transport en generator | Bouwchat | open | 2 | draaiboek fase 3 |
| 32 | Legacy-opkuis echt afmaken (A-11) | Architectuur en robuustheid | Bouwchat | later | 5 | |
| 33 | KV:/INFO: als structuur (A-9) | Thema's en catalogus | Bouwchat | later | 5 | |
| 34 | Schrijven batchen per request (A-7) | Architectuur en robuustheid | Bouwchat | later | 4 | vóór zomer |
| 35 | Catalogus: dubbels, eenheden, ongebruikte types (E) | Data en opschoning | Bouwchat | later | 4 | |
| 36 | DRAAIBOEK valideren met Maxim | Werkwijze | Maxim | bezig | 1 | brainstorm |
| 37 | Designsessie KV/chauffeur/navigatie/dashboard | Schermen en navigatie | Fable | open | 1 | |
| 38 | Herfstplanning 2–8 nov invoeren | Periodes en planning | Fable | open | 1 | gegevens van Maxim nodig |
| 39 | Generale repetitie + walkthrough 3–8 | Testen | Fable | open | 1 | |
| 40 | Sollicitatiedossier (deadline 11 nov) | Sollicitatie | Maxim | open | 1 | |
| 41 | Wijzigingslog op alle tabellen + terugzetten (Google-Drive-versies) | Architectuur en robuustheid | Bouwchat | open | 2 | F1 legt de tabel + 5 kerntabellen |
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

## Volgorde van de prompts (voorlopig — brainstorm legt vast)
| plaats | chat | prompt | onderwerp | taken | toestand |
|---|---|---|---|---|---|
| ✓ | A | V0 | Veiligheidsnoodronde | 1 | klaar (28/10) |
| 0 | A | F1 | Fundament: modules, atomaire schrijving, wijzigingslog | 22, 41 | bezig (28/10) |
| 1 | B | V1 | Testharnas | 6 | gepland |
| 2 | B | V2 | Dynamische periodes (na V1; Fable-chat A rust na F1) | 7, 8 | gepland |
| 3 | C | V3a | Ketenfixes transport | 11, 13, 14, 15 | gepland |
| 4 | D | V3b | Annuleer-bug + modals + conflicten-tab | 12, 27, 9 | gepland |
| 5 | E | V3c | Foto's uit db + prod-opschoning + catalogus | 23, 24, 25 | gepland |
