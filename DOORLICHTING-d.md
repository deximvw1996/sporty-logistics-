# DOORLICHTING lens 4 — frontend & UX (chat D, Sonnet)

Datum: 2026-10-28 · map sporty-d · branch bouw-d · server 3304 · wegwerp-db (kopie, 1 kampmoment, 184 thema's, 3338 voorraaditems) · login als "Claude (API)".
Gedaan: lees-opdracht, geen code gewijzigd. Alle schermen via de draaiende pagina (clicks + JS-meting, dialogen onderschept), KV- en chauffeurspagina op 375px, code-greps voor dialogen.
Niet gedaan / beperkt: de chauffeurspagina heeft in mijn db geen stops (geen transporttaken) → de Laden/Lossen-knoppen zelf niet geklikt, enkel de CSS gelezen. De KV-pagina had geen bakken → telflow (invoer per bak) niet doorlopen. Kaart-tab enkel gelijst, niet visueel beoordeeld. Donkere modus niet beoordeeld.

## 0. Tellingen
| Wat | Aantal |
|---|---|
| `confirm()` in index.html (verwijder-bevestigingen e.d.) | 35 |
| `prompt()` in index.html | 9 (7 plaatsen; nieuwe bak = 3 prompts na elkaar) |
| `alert()` in index.html | 0 |
| `alert()` in KV-pagina (server.js 4807–5145) | 10, ook voor succes ("Controle verstuurd. Bedankt!") |
| chauffeurspagina | geen dialogen |
| `showToast`/toast-gebruik in hoofdapp | ruim aanwezig (±240 regels) → hoofdapp is vooral goed, KV-pagina niet |
| stil ingeslikte fouten `catch(e){}` | ±12 in index.html, o.a. laden van sport/gedeeld/thema's (2249, 2443, 2738, 2877, 4997, 5098) |
| Console-fouten tijdens hele rondgang | 0 |
| Knopklassen | btn-o 70, btn-g 49, btn-xs 42, btn-r 6, btn-b 6, btn-del-sm 6 + veel inline `style=` |

## 1. Scherm voor scherm
| Scherm | Wat | Bevinding |
|---|---|---|
| Login | naam + pincode | Werkt, Enter verstuurt. Dropdown toont álle 12 personen incl. KV's en "SIM KV Anna/Bram" — KV's horen niet in het kantoor-login (enkel link). |
| 📊 Overzicht (hoofdtab) | 4 tellers + kampmomentenlijst + subnav | Subnav heet óók "📊 Overzicht" (dubbel). Conflicten, Periodes, Week materiaal, Rooster zitten hier verstopt. "Kamplocaties 27" terwijl de Locaties-lijst er 41 heeft (sport/andere types? onduidelijk). |
| Ov › Week materiaal | per week uitklappen | Rendert, geen fout. |
| Ov › Conflicten | lijst | Enkel "geen thema gekoppeld"; zonder koppeling naar de oplossing (geen knop "koppel thema"). |
| Ov › Periodes | lijst | Datums als `2026-06-29 – 2026-09-06` (ISO) terwijl rest "29 jun" is. |
| Ov › Rooster | locaties × weken | Bestaat ook als Kampplanner › Rooster → twee wegen, zelfde scherm. |
| 🏔 Kampplanner | 5 modi (Rooster/Locatie/Week/Thema/Sportpakketten) + Compact | Per locatie/week/thema = leeg scherm + "Kies…". Thema-keuze = select met 184 opties (zoeken niet mogelijk). Sportpakketten-modus 3703px hoog, geen paginering. |
| 🚚 Transport › Plannen | weekgrid + filters + Spoedtransport/Nieuwe rit | Werkt. Tellers (Leveringen/Ophalingen/Bevestigd/Op te stellen) allemaal 0 zonder uitleg. Onderaan ingeklapt "Ploegplanning & chauffeurs" = ander onderwerp onder zelfde tab. |
| Transport › Op te stellen | backlog + **Aanvragen** (KV-aanvragen) | "Aanvragen" is geen tab maar zit in "Op te stellen" — onvindbaar voor wie het niet weet. |
| Transport › Alle transporten | lijst + filters + CSV | Leeg → "Geen transporten gevonden" (geen uitleg hoe er een maken). |
| 📦 Materiaal | 6 subtabs | Zie §4. Voorraad: "3338 items · ⚠️ 2842 tekort" = bijna alles rood → ruis. Vaste bakken: 6903px hoog, geen paginering, veel "0 items". Sport: 112 items, 6858px. Themabakken en Thema's beheer wél gepagineerd. |
| Materiaal › Nakijken | controles + Tekortendashboard | Hier landt de KV-vrijdagcontrole; naam "Nakijken" verklapt dat niet. |
| 📍 Locaties | locatielijst + detail | Eén pagina van ±26.000 tekens: alle locaties onder elkaar, ✏️/🗑️ naast elkaar. Geen zoekveld, geen paginering. |
| 🗺️ Kaart | filter + coördinaten ophalen | "📍 Coördinaten ophalen" is een bulk-actie op een kijk-scherm. |
| 👥 Personeel | 4 subtabs | Shift zonder week toont **"Week ?"** en locatie "?". Rij van Maxim staat onder "Chauffeur". Elke persoon heeft "+ Shift" en ✏️ van 11px. |
| Zoekbalk | globaal | Werkt (resultaten in dropdown), maar zoekt ook sport-sets en geeft "Kinball Abdij" naast de locatie → ruis. |
| 🕐 (datum simuleren) | tijdmachine | Alleen een klokicoon met tooltip; geen hint dat dit een testmodus is. |

## 2. De drie rollen
**Kantoor (hoofdapp):** zie boven.

**KV-pagina `/kv/<token>` op 375px** (token gemaakt via kampmoment + KV):
- Geen horizontale paginascroll (scrollWidth 375). Tabbalk scrolt zijwaarts; 4e tab ("Iets kapot?") half buiten beeld zonder aanwijzing.
- Tabknoppen **30px hoog** (richtlijn ≥44). Versturen-knop 52px (goed).
- Stappen heten "BLOK 1/2/3/4" → jargon/lijkt op rapportstructuur; "Blok" zegt niets.
- **Tegenstrijdige statussen:** "Wat moet er staan" zegt "0 bakken", "Vrijdagcontrole" zegt "0 van 1 bakken geteld" + "Alles nagekeken — klaar om te versturen", en de Versturen-knop is niet disabled (enkel grijs gekleurd, `disabled=false`). Een KV kan dus een lege controle versturen.
- Alle meldingen via `alert()`; bevestiging na versturen is een browser-alert die op GSM weggezwiept wordt.
- Lege staat: "Nog geen bakken gekoppeld." (ok, kort).

**Chauffeurspagina `/rit/<token>` op 375px:**
- Geen horizontale scroll, 0 knoppen in lege rit; Laden/Lossen-knoppen zijn 48px (goed, uit CSS).
- Titel "Rit 2026-06-30" = ISO-datum, niet "di 30 jun" zoals in de hoofdapp.
- Lege rit: "Geen stops gepland." Prima. Lettergroottes 11–12px voor rit-detail/notities (klein buiten).
- Link verlopen → nette tekst, geen link terug of contactinfo.

**Hoofdapp op 375px:** geen paginabrede horizontale scroll, maar: bijna alle knoppen/selects < 36px (overzicht 19/19, transport 62/63, personeel 42/43). Transport-weekgrid: 7 kolommen van ±50px, rit-kaartjes afgeknipt ("Klaa…"), selects afgeknipt ("Alle statussen" → "Alle statusser"). De lege knop naast de titel in de header (zoekveld ingeklapt?) oogt als kapotte knop.

## 3. Logica / navigatie voor een nieuwe collega
1. Zeven hoofdtabs + per tab 3–6 subtabs, deels met hetzelfde icoon (📊 Overzicht/Alle transporten/Tekortendashboard) → "waar zit het?" is een raadspel.
2. Dingen zitten verborgen onder een naam die er niet over gaat: Aanvragen onder "Op te stellen", vrijdagcontroles onder "Materiaal › Nakijken", Conflicten/Periodes/Rooster onder "Overzicht", KV-link onder een kampmoment, chauffeurlink onder een rit-modal.
3. Dubbele wegen: Rooster (Overzicht én Kampplanner), Overzicht (hoofdtab én subtab), Locaties-aanmaak (Locaties én Kampplanner), chauffeur toevoegen (Personeel én Transport › Ploegplanning).
4. Te veel tegelijk zonder pagina/filter: Locaties (26k tekens), Vaste bakken, Sport (6,8k px), Kampplanner › Sportpakketten, Voorraad (3338 items; wel filters).
5. Eerste verwarring van een nieuwe collega: "Overzicht" toont 27 locaties maar Locaties toont 41; 0'en overal zonder aanwijzing wat eerst te doen; wat is "Week 1" (geen datum in elke context).

## 4. Consistentie
- **Meldingen:** hoofdapp = toast; KV-pagina = `alert()`; 35 `confirm()` en 9 `prompt()` in de hoofdapp (strijdig met regel 8 voor *nieuwe* code, maar bestaand). Slechtste voorbeelden: `openNieuweAanvraag` (index.html:7606) vraagt eerst tekst via prompt en dan via `confirm()` "OK = materiaal-aanvraag, Annuleren = kapot-melding"; nieuwe bak (4005–4008) = 3 prompts achter elkaar met afkortingen "KL / LS / KLS".
- **Bug in afwijzen/goedkeuren (index.html:7618–7625):** `prompt(...)||''` maakt van "Annuleren" een lege string, waarna `if(reden===null)return` nooit afgaat → wie op Annuleren klikt, wijst de aanvraag toch af / keurt ze toch goed.
- **Datums:** "di 30 jun", "29 jun–3 jul" (hoofdapp) vs `2026-06-29` (Periodes, chauffeurspagina) vs "Week ?"; `toLocaleDateString` en handgemaakte formatters door elkaar.
- **Knoppen:** vijf klassen + veel inline-styles; destructieve acties 🗑 / ✕ / "Rit verwijderen" in drie stijlen; actieknoppen 10–11px.
- **Kleur:** groen = primair én "klaar"; rood = tekort én verwijderen én Spoedtransport; amber = simulatie. Rood "tekort" op 2842 van 3338 items verliest elke betekenis.
- **Lege staten:** wisselend: soms uitleg ("Nog geen transporten — voeg er een toe uit de backlog"), soms enkel "Geen transporten gevonden"/"0". Geen "wat nu?"-link.
- **Emoji's** als icoon in tabs: rendert wisselend per toestel; sommige tabs hebben ze, subtab "Per controle" niet.

## 5. Top-20 UX-punten (impact aflopend)
| # | Punt | Scherm | Reproductie | Voorstel |
|---|---|---|---|---|
| 1 | Annuleren bij aanvraag afwijzen/goedkeuren doet de actie toch | Transport › Op te stellen › Aanvragen | Nieuwe aanvraag → ✕ Afwijzen → prompt → Annuleren → aanvraag staat op afgewezen | `const r=prompt(..); if(r===null)return;` — 5 min |
| 2 | KV kan lege/onaf controle versturen; tegenstrijdige tellers (0 bakken vs 0 van 1 bakken, "Alles nagekeken") | /kv/… › Vrijdagcontrole | Kampmoment zonder (volledig getelde) bakken → knop actief | Knop echt `disabled` tot `klaar`, tellers uit dezelfde bron, uitleg wat ontbreekt |
| 3 | KV-pagina gebruikt `alert()` voor succes en fouten | /kv/… alle tabs | Versturen/Aanvraag/Kapot | Toast/inline banner; succes = groen vak met "Verstuurd ✓" |
| 4 | Navigatie: dubbele Overzicht + dubbele Rooster + verborgen Aanvragen/Conflicten/Periodes | hoofdnavigatie | zie §3 | Aanvragen als eigen subtab met rode teller; subnav "Overzicht" hernoemen "Dashboard"; één Rooster |
| 5 | Locaties-scherm = 26k tekens, geen zoek/paginering | 📍 Locaties | tab openen, scrollen | lijst links + detail rechts (zoals Personeel), zoekveld, 25/pagina |
| 6 | Touch-targets: bijna alle knoppen < 36px (KV-tabs 30px) | hoofdapp 375px, KV | meting | `min-height:44px` op GSM voor `.btn-*`, KV-tabs, selects |
| 7 | Browser-prompts/confirms (35+9) i.p.v. eigen dialoog | o.a. Nieuwe bak, Nieuwe aanvraag, Totaal in bezit, Kies stockagelocatie | zie §0 | één `askModal()` helper; bak-/aanvraagformulier als modal met velden (dropdown KL/LS/KLS i.p.v. typen) |
| 8 | "Tekort" op 2842/3338 items → alarmmoeheid | Materiaal › Voorraad | tab openen | standaard filter "Enkel items in komende kampweken" of tekort pas tonen als er een behoefte is |
| 9 | Transport-weekgrid onbruikbaar op GSM | Transport › Plannen op 375px | resize | Onder 600px: dagenlijst i.p.v. 7 kolommen |
| 10 | Vaste bakken/Sport/Sportpakketten zonder paginering of zoek (6,8–6,9k px) | Materiaal › Vaste bakken / Sport; Kampplanner › Sportpakketten | tab openen | zelfde pager als Themabakken, inklap per categorie |
| 11 | "Week ?" en "?" bij shift zonder week | Personeel › Overzicht (Maxim) | zie rij | Toon "Hele periode"/datum, of verberg ontbrekende velden |
| 12 | Login toont alle personeel (ook KV/SIM KV) | Login | dropdown | Enkel rol kantoor/chauffeur tonen |
| 13 | ISO-datums in Periodes en op chauffeurspagina | Overzicht › Periodes; /rit/… | zie scherm | Eén `fDatum()` ("di 30 jun 2026") overal incl. server-HTML |
| 14 | Conflicten zonder actie | Overzicht › Conflicten | tab openen | Knop "Koppel thema" die naar Kampplanner-cel springt |
| 15 | Thema-keuze = select van 184 | Kampplanner › Per thema | dropdown | Doorzoekbaar select (datalist) |
| 16 | Lege staten zonder "wat nu" | Transport, Overzicht, KV | zie §4 | Elke lege lijst: één zin + primaire knop |
| 17 | Tellers/kaarten niet klikbaar-herkenbaar; 0'en zonder uitleg | Overzicht en Transport › Plannen | | Klik op teller → gefilterde lijst; tooltip "wat telt dit" |
| 18 | KV-tabs "BLOK 1–4" + 4e tab afgesneden | /kv/… | | Hernoem naar "Wat staat er?", "Vrijdag tellen", "Iets nodig", "Kapot"; fade-rand |
| 19 | Stille `catch(e){}` bij laden sport/gedeeld/thema's | index.html 2249, 2443, 2738, 2877, 4997, 5098 | server offline → lege lijst zonder melding | toast "Laden mislukt — probeer opnieuw" |
| 20 | 🕐 datum-simulatie ziet er uit als gewone klok, geen waarschuwing in productie | header | | alleen tonen voor kantoor, banner wanneer actief (indicator bestaat al, maar verborgen standaard) |

## 6. Quick wins ≤ 30 min
1. Fix annuleer-bug bij afwijzen/goedkeuren (punt 1) — 5 min.
2. `disabled` op KV-"Versturen" tot klaar (punt 2) — 15 min.
3. KV `alert('Controle verstuurd…')` → bestaande toast/inline vak (punt 3) — 20 min.
4. KV-tabs hernoemen + `min-height:44px` (punt 6/18) — 10 min.
5. Login-dropdown filteren op rol ≠ KV (punt 12) — 10 min (server: `personeel-lijst-login`).
6. `Week ?` → "Hele periode" (punt 11) — 5 min.
7. Periodes-datums met bestaande `fIso()` (punt 13) — 10 min; chauffeurspagina-titel idem — 10 min.
8. Subnav "Overzicht" hernoemen — 2 min.
9. Mobiel: `@media(max-width:600px){button,select{min-height:40px}}` — 15 min.
10. Voorraad-tekortlabel pas tonen bij filter "Tekort" (of ruis-badge grijs) — 20 min.

## 7. GEVONDEN (buiten opdracht, niet gefixt)
- Onbekende `/api/...`-routes geven HTML (SPA-fallback) i.p.v. JSON-404 → front-end `api()` crasht met "Unexpected token '<'" (zag ik bij `/api/shifts`).
- `npm install` was niet gedraaid in sporty-d (geen node_modules); server startte pas daarna.
- Kampmomenten-API gaf `[]` zonder `?periode_id=`; zelfde endpoint bij bestaande kampmomenten: aanroepers moeten parameter kennen (niet onderzocht).
- Seed/testdata: Maxim als "Chauffeur", Nakijk-"Verwerkt door Claude (API)", rit/kampmoment die ik aanmaakte (wegwerp-db).
- Rit-modal verscheen niet op een screenshot direct na openen terwijl DOM zichtbaar (display block) — mogelijk animatie/lag, niet bevestigd.
