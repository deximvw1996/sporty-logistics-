# DOORLICHTING-t — lens 6: de hele kampcyclus als rollenspel

Testchat T (Opus) · branch `test-1` · poort 3306 · verse db-kopie van `sporty-railway/sporty.db` (28/10 16:14).
Start 16:14, limiet 18:14, gestopt ±17:15. **Geen code gewijzigd.** Alles in de browser (in-app pane, desktop + 375px), API alleen om terug te lezen of als omweg (gemarkeerd).
Server gestart met `NODE_PATH=sporty-railway/node_modules` (sporty-t heeft geen eigen `node_modules` → `Cannot find module 'express'`; kleine drempel voor elke testchat).

Gebruikte data: periode **Herfstvakantie 2026** (2–8 nov, zelf aangemaakt), kampmoment **De Bosstraat wk1** met kleuterthema **1001 Ballen en Bellen** (8 bakken) + sportpakket **Badminton A**, KV **SIM KV Anna**; tweede kampmoment **Klare Bron wk1** met hetzelfde thema (bewust, voor de conflictcheck).

---

## 1. KANTOOR

| # | Stap | Verwacht | Gezien | Oordeel |
|---|---|---|---|---|
| 1.1 | Inloggen (Claude (API) + pincode, Enter) | Enter logt in | Enter in het pincodeveld doet niets; alleen de knop werkt | WRONG (klein) |
| 1.2 | Overzicht na login | Lege staat met wegwijzer naar "maak een periode" | Kop zegt **"Zomer 2026"** eind oktober; 0 kampmomenten, geen hint | WRONG |
| 1.3 | Periodes → Nieuwe periode "Herfstvakantie 2026", 2/11–8/11 | Opgeslagen, 1 week | "Periode aangemaakt", 1 week, meteen actief, kop wordt "Herfstvakantie 2026" | OK |
| 1.4 | Pagina herladen | Herfst blijft actief | Kop springt terug naar **"Zomer 2026"**: actieve periode wordt niet bewaard (`index.html:3846` kiest "eerste periode met kampen, anders de eerste"); terugval in `_activePeriode()` is hardcoded `2026-06-29…Zomer 2026` (`index.html:4175`) — botst met regel 5 | WRONG |
| 1.5 | Kampplanner openen (tab) | Rooster met locaties × weken | **Leeg wit vlak**, alleen knop "Compact". Pas na klik op subtab "Rooster" verschijnt het grid. "Per locatie" toont kop maar **geen weekrijen** zolang Zomer actief is | WRONG |
| 1.6 | Periode Herfst activeren → Rooster | 1 kolom "Week 1 · 2 nov" | Correct, 27 kamplocaties × 1 week | OK |
| 1.7 | Klik cel De Bosstraat wk1 | Venster opent | Venster opent pas na ±1–2 s, zonder laadindicatie (zelfde traagheid overal in de app) | WRONG (klein) |
| 1.8 | Venster "Kampmoment toevoegen" | Duidelijk | "Week 1 · 2 nov–6 nov (Herfstvakantie 2026)" ✓; maar: knop **🗑 Verwijderen** op een nog niet bestaand kampmoment; KV-lijst toont ook chauffeurs en kantoor ("Jeroen (Chauffeur)"); sportpakketten heten "Badminton A — A", "Archery tag A — A" (dubbel label) | WRONG (klein) |
| 1.9 | Sportpakket "Toevoegen" | Chip verschijnt | Pas na ±3 s, geen feedback ertussen → ik klikte nog eens; de lay-out verschoof onder mijn muis waardoor "Opslaan" mis was | WRONG |
| 1.10 | Opslaan | Cel gevuld | "1001 Balle…" in de cel; API bevestigt kampmoment 167 (thema 4082, set 1944, KV 11, open_dagen 2–6 nov) | OK |
| 1.11 | Tweede kamp Klare Bron, zelfde thema | Waarschuwing "dit thema draait al op De Bosstraat" | Geen enkele waarschuwing bij het aanvinken of opslaan | WRONG |
| 1.12 | Overzicht → **Conflicten** | Dubbel thema + 8 dubbel geboekte bakken | **"✓ Geen conflicten gevonden!"** — ook na herladen. De tab gebruikt een eigen client-check (`checkConflicten`, `index.html:1838`: sport/gedeeld/thema-loos, met hardcoded `w<=9`) en negeert `/api/conflicten`, dat wél `dubbel_thema` (hoog) + `dubbelboeking_bak` teruggeeft. Bovendien licht de subtab "Periodes" op terwijl je op Conflicten staat | **WRONG (ernstig)** |
| 1.13 | Transport → Plannen | Conflicten zichtbaar | Hier staan ze wél: "Planningsconflicten (9)". Twee plekken, twee waarheden. Het blok verdween bij een volgende bezoek tijdelijk en kwam terug na een actie (laadt asynchroon/onbetrouwbaar). Tekst bevat jargon "De Bosstraat@1" | WRONG |
| 1.14 | Op te stellen → Genereer voorstel | Leveringen + ophalingen per kamp | 6 voorstellen: 2 themaleveringen, 2 themaophalingen, sportlevering + sportophaling. Maar: **levert dezelfde 8 bakken naar twee locaties tegelijk** zonder waarschuwing; sport komt van **"Kantoor"** i.p.v. Rozenweg (regel 3: alles met code ligt in de Rozenweg); "8 materiaalitems" i.p.v. "8 bakken" | WRONG |
| 1.15 | 6× "+ Backlog" | 6 taken in backlog | "Toegevoegd aan de backlog", 6 transporten. Kop "WEEK 1 (5)" — de sportophaling heeft geen week en hangt nergens; locatienamen afgekapt tot "Rozenweg→De", "Kantoor→De" | WRONG (klein) |
| 1.16 | 📅 op levering De Bosstraat | Kiezen wanneer | Maakt meteen een rit op ma 2 nov en opent die (traag, ±2 s) | OK |
| 1.17 | Sportlevering uit backlog erbij, chauffeur Jeroen, camionette, Opslaan | Rit opgeslagen | Lukt; maar de getypte chauffeursnaam **verdween** toen het venster herteken­de na "Uit backlog" (opnieuw typen nodig). "Rit opgeslagen" ✓. API: rit 22, Jeroen, Camionette, taken 196+197 | WRONG (klein) |
| 1.18 | Rit-kaart in weekbord | Toont aantal bakken | **"0 / 20 bakken"** terwijl er 8 bakken + 1 sportset in zitten | WRONG |
| 1.19 | Klaarzetten | Lijst per rek, per bak | Uitstekend: gegroepeerd per Rek H/L/N + "Sportmateriaal", OK/Deels/Weg per bak, teller 9/9, "Rit gemarkeerd als klaargelegd door Claude (API)". Wel "Bak Themabak 2/4…" (dubbel "Bak"); paneel blijft openstaan na klaarleggen | OK |

## 2. CHAUFFEUR (`/rit/<token>`, 375px)

| # | Stap | Verwacht | Gezien | Oordeel |
|---|---|---|---|---|
| 2.1 | Rit-link openen | Bakken, geen inhoud | 2 stops + "Materiaallijst (9 items)" per rek: alleen bak-namen + codes, **geen inhoud** ✓. 375px: geen horizontale scroll (scrollWidth 375) ✓ | OK |
| 2.2 | Rare details | — | Twee verschillende zakken met **dezelfde code H70** (handballen / mini-rugbyballen) — op een rek niet te onderscheiden; kleuterthema bevat drie "LS bak"-bakken; "9 items" i.p.v. "9 bakken" | WRONG |
| 2.3 | Badminton A | Laden/Lossen | Toont al een ✅ zonder knoppen; API: `geladen=0, gelost=0` → de chauffeur **kan het sportpakket nooit laden/lossen** | WRONG |
| 2.4 | Laden (8×) | ✅ Geladen | Werkt, direct | OK |
| 2.5 | **Onderweg zetten** | Knop "vertrokken / onderweg" of per stop "aangekomen" | **Bestaat niet.** Alleen Laden/Lossen per bak; stops kunnen niet afgevinkt worden | WRONG |
| 2.6 | Lossen (8×) | Rit afgerond | Alle ✅ Gelost, maar geen "rit klaar"-melding; API: rit 22 en taken 196/197 blijven **"gepland"** — kantoor ziet nooit dat de levering gebeurd is | **WRONG (ernstig)** |

## 3. KV (`/kv/<token>`, 375px)

| # | Stap | Verwacht | Gezien | Oordeel |
|---|---|---|---|---|
| 3.0 | KV-link | In de UI via "🔗 KV-link kopiëren" (kopieert naar klembord, niet leesbaar in de test) → omweg: `POST /api/kampmomenten/167/kv-token` (zelfde call) | — | (omweg) |
| 3.1 | Tab "Wat moet er staan" | Bakken + sportpakket | 8 bakken met code ✓, "0 attributen". **Sportpakket Badminton A ontbreekt** (de KV weet niet dat het komt). "1 items"; 4e tab "Iets kapot?" valt buiten beeld (scrollbaar, maar niet zichtbaar dat er meer is); paginatitel "KV-scherm" | WRONG |
| 3.2 | Vrijdagcontrole — tellen | Snel tellen | Per bak openklappen, per artikel −/+. + begint bij leeg→1: **20 mousse balletjes = 20 tikken**, geen "alles aanwezig"-knop en niet intypbaar. Voor 8 bakken × ±50 stuks onwerkbaar op vrijdagmiddag | **WRONG (ernstig)** |
| 3.3 | Bak afsluiten met ongetelde regels | Melding "nog X regels te tellen" | Bak klapt stil dicht, blijft "1/3"; geen uitleg | WRONG |
| 3.4 | Versturen grijs zolang niet alles geteld | Uitleg waarom | Grijs, geen uitleg; wordt groen bij 8/8 ("Alles nagekeken — klaar om te versturen") | WRONG (klein) |
| 3.5 | Tekorten tellen | Duidelijke telling | Kop "28 tekorten" = aantal **tekortregels**; bak-badge "2 te weinig" = aantal soorten; regel "19 te weinig" = stuks. Drie betekenissen van "te weinig" | WRONG |
| 3.6 | Versturen | Bevestiging "verstuurd naar kantoor" | `POST …/versturen → 200`, maar **scherm verandert niet**, geen bevestiging | WRONG |
| 3.7 | Iets nodig? → "8 voetballen extra…" | In lijst | Verschijnt onder "Eerdere aanvragen" met status "Nieuw" ✓ | OK |
| 3.8 | Iets kapot? → "Bak H53: deksel gebroken" | Bevestiging + lijst | `POST …/kapot → 200`, formulier sluit, **geen bevestiging, geen lijst eerdere meldingen** (anders dan "Iets nodig?"); vrije tekst, geen keuze uit de eigen bakken | WRONG |

## 4. KANTOOR WEER

| # | Stap | Verwacht | Gezien | Oordeel |
|---|---|---|---|---|
| 4.1 | Signalisatie | Melding van KV-acties | Kop-badge "📧 2 aanvragen", Materiaal-badge 8, Nakijken-badge 8 ✓ | OK |
| 4.2 | Tekortendashboard | Per artikel, met locatie/bak | Aantallen kloppen (voetballen 9 = 10−1, handballen 6 = 10−4). Maar: **geen locatie of bak** per regel; elke regel herhaalt "Thema … al eerder geteld — KV-telling is het startpunt voor kantoor" (onbegrijpelijk); overal "voorraad 0 / min 0"; geen actieknoppen | WRONG |
| 4.3 | Aanvraag goedkeuren | Venster: motivatie + "spoedtransport?" | **Klik doet niets.** Console: `prompt() is not supported` (`behandelAanvraag`, `index.html:7617`) — kale `prompt()` + `confirm()`, verboden volgens regel 8/V3. Omweg: prompt/confirm in de pagina overschreven met "OK", knop opnieuw geklikt → "Aanvraag bijgewerkt" | **WRONG (blokkerend)** |
| 4.4 | Spoedtaak | Taak naar De Bosstraat met 8 voetballen | Taak 202 + aparte rit 23: **datum = vandaag (28/10, vóór de vakantie)**, **van/naar leeg**, regel = de hele vrije tekst × **1** (qty hardcoded `1`), geen chauffeur. Chauffeur ziet "🚚 Transfer · **Stockage → Stockage**" en geen materiaallijst. Regel 3 (bak als eenheid) volledig los | **WRONG (ernstig)** |
| 4.5 | Tekort na goedkeuring | Voetballen-tekort gekoppeld/"onderweg" | Blijft "Voetballen — totaal tekort 9 · open": aanvraag en tekort weten niets van elkaar | WRONG |
| 4.6 | Per controle → Aangevuld (bubble rocket 5) | Voorraad daalt / regel weg | Regel weg ✓; toast "**Voorraad bijgewerkt: 0 → 0**" — er is geen voorraad, maar dat wordt niet gezegd | WRONG |
| 4.7 | Markeer volledig verwerkt met open regels | Weigeren met uitleg | "Nog 7 tekortregel(s) niet aangevuld, besteld of genegeerd: …" ✓ — maar de toast verschijnt **2×** en bedekt de knoppen | OK (met kleinigheid) |
| 4.8 | Besteld / Negeren | Status per regel | Besteld → blauw "wacht op levering" ✓. Negeren werkt **meteen, zonder bevestiging of ongedaan maken** | WRONG (klein) |
| 4.9 | Controle H53 afsluiten | Verwerkt | "Verwerkt door Claude (API)", badge 8 → 7 ✓ | OK |
| 4.10 | Eindophaling inplannen (slepen naar vr 6 nov) | Rit vrijdag | Slepen lukt niet in de testbrowser (HTML5-drag); 📅-klik plant meteen op **vr 6 nov** (rit 24) zonder te vragen ✓ logische standaard, maar zonder chauffeur | OK |
| 4.11 | Tijdstip eindophaling | Na de vrijdagcontrole | **09:00 op vrijdag**, terwijl de KV op vrijdag moet tellen en het kamp nog draait | WRONG |
| 4.12 | Eindophaling in chauffeurszicht | Lijst met 8 op te halen bakken | **Geen materiaallijst** — de bakkenlijst ontstaat pas na "Klaarzetten", wat bij een ophaling niemand doet. Chauffeur weet niet wat mee te nemen | **WRONG (ernstig)** |
| 4.13 | Sport-ophaling Badminton | Op te stellen | Taak 201 heeft geen week → telt mee in "Op te stellen (3)" maar staat in geen enkele weekgroep (2 zichtbaar) — wordt vergeten | WRONG |

Niet meer gedaan binnen de tijd: Klare Bron verder doorlopen, "Afwijzen" (gebruikt ook `prompt()`), KV na de week (link nog geldig?).

---

## Top-10 "dit moet echt beter voor 2 november"

1. **Aanvraag goedkeuren/afwijzen werkt niet zonder `prompt()`/`confirm()`** (`behandelAanvraag`). In browsers die prompts blokkeren (en in deze testpane) gebeurt er stil níets. → nette modal (regel 8).
2. **Spoedtransport uit een aanvraag is onbruikbaar**: geen van/naar (chauffeur ziet "Stockage → Stockage"), datum = vandaag, qty altijd 1, vrije tekst als artikel. Moet: naar de locatie van het kampmoment, op de eerstvolgende werkdag in de periode, met de gevraagde hoeveelheid.
3. **Ophalingsritten tonen de chauffeur geen bakken** (lijst alleen na Klaarzetten). Bij elke eindophaling weet de chauffeur niet wat mee te nemen.
4. **Rit/taak blijft "gepland" na volledig lossen** + geen "onderweg/aangekomen" in de chauffeursweergave. Kantoor ziet nooit dat een levering gebeurd is.
5. **Tab Conflicten liegt** ("Geen conflicten") terwijl `/api/conflicten` een dubbel thema + 8 dubbel geboekte bakken meldt; de generator levert dezelfde bakken zonder waarschuwing naar twee kampen. Eén bron: de server-conflicten, op beide plekken, en een waarschuwing al bij het kiezen van het thema.
6. **Tellen in de vrijdagcontrole kost honderden tikken** (+ start bij 1, geen intypen, geen "alles aanwezig"). Een KV met 8 bakken haakt af. Plus: bevestiging na Versturen en na Kapot melden ontbreekt.
7. **Actieve periode niet bewaard + hardcoded "Zomer 2026"-terugval**: na elke herlaadbeurt springt kantoor naar de zomer (kop, planner, transport). Voor de herfst moet de actieve periode = de lopende/eerstvolgende zijn, en bewaard blijven.
8. **Sportpakket valt overal tussen de mazen**: chauffeur kan het niet laden/lossen, KV ziet het niet in "Wat moet er staan", ophaling heeft geen week en verdwijnt uit het planbord, en het vertrekt van "Kantoor" i.p.v. Rozenweg.
9. **Kampplanner opent leeg** (rooster rendert pas na klik op de subtab) en de ophaling wordt standaard op vrijdag 09:00 gezet — vóór de vrijdagcontrole van de KV.
10. **Tekortendashboard zonder context**: geen locatie/bak, cryptische herhaalzin, "voorraad 0 / min 0", aanvraag ↔ tekort niet gekoppeld, aangevuld → "0 → 0". Plus overal de kleine woordfouten: "1 items", "materiaalitems" voor bakken, "Bak Themabak", "Badminton A — A", tijd "16:5", "De Bosstraat@1", rit-kaart "0 / 20 bakken", dubbele code H70.

## GEVONDEN (reproductiestappen, kort)
- **G1** Goedkeuren aanvraag faalt stil: KV dient aanvraag in → kantoor Transport › Op te stellen › Goedkeuren → console `prompt() is not supported`.
- **G2** Spoedtaak zonder locaties: G1 met omweg → `GET /api/transport-taken` → taak `type:extra`, `van_locatie_id:null`, `naar_locatie_id:null`, `datum` = vandaag, regel qty 1.
- **G3** Rit blijft gepland: rit-link → alle bakken Laden + Lossen → `GET /api/ritten` → `status:"gepland"`, taken `gepland`.
- **G4** Sportset niet laadbaar: rit met sportlevering → rit-link toont ✅ zonder knoppen → `/api/ritten/:id/checks` → `geladen:0`.
- **G5** Conflicten-tab mist server-conflicten: zelfde thema op 2 locaties dezelfde week → Overzicht › Conflicten = "Geen conflicten"; `/api/conflicten` = `dubbel_thema` + `dubbelboeking_bak`.
- **G6** Ophalingsrit zonder bakken: ophaling inplannen → rit-link → geen materiaallijst.
- **G7** Actieve periode reset: periode activeren → F5 → kop "Zomer 2026".
- **G8** `/api/conflicten` vergelijkt alleen `week`, niet `periode_id` → week 1 zomer en week 1 herfst met hetzelfde thema worden als conflict gezien (gezien in code `server.js:5186`, niet live getest).
- **G9** sporty-t heeft geen `node_modules` → server start niet zonder `NODE_PATH`.

Bewijs: elke OK/WRONG hierboven is gezien in de browser (screenshots in de sessie) en waar vermeld teruggelezen via de API (kampmomenten 167/168, ritten 22/23/24, taken 196–202, checks rit 22, netwerklog KV `versturen/aanvraag/kapot → 200`).
