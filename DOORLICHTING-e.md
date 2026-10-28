# DOORLICHTING lens 5 (chat E, Sonnet) — datakwaliteit
Datum 2026-10-28 · branch bouw-e · alleen gelezen, geen data gewijzigd.
Methode: `sporty.db` in sporty-e (byte-identiek aan `sporty-railway/sporty.db`, 1.007.616 bytes, bestandsdatum **4 aug 21:31**) rechtstreeks gelezen met sql.js in een node-leesscript (alle queries `SELECT`). Elke telling hieronder is een SQL-query op die db; de query staat erbij.

> ⚠️ **Eerste bevinding: de "productiestand" is van 4 augustus.** Alles wat sindsdien in prod is ingevoerd, staat hier niet in. Dit rapport klopt dus voor de stand van 4 aug. Herdraai de queries op een verse prod-kloon vóór je opschoont (zelfde scriptpatroon, 1 minuut).

## 0. Totalen (stand db)
themas 184 (kamp 79 / themadag 105) · bakken 466 (351 thema-bakken, 115 vaste/pool-rijen, som `aantal` vaste = 234) · bak_items 4.133 · item_types 3.338 · attributen 85 (thema-koppelingen 135) · thema_bak 408 · thema_behoefte 90 · item_type_stock 868 · bulk_spreiding 55 · vaste_bakken 0 · thema_bakken (legacy) 3.

## 1. Tellingen & wezen
| Check | Query (samengevat) | Aantal |
|---|---|---|
| Thema's per cat/groep | `group by categorie, leeftijdsgroep` | kamp·kleuters 40 (37 eigen_materiaal, 2 `eigen`, 1 `eigen_standaard`) · kamp·LS 39 (37 + 2 `eigen_standaard`) · themadag·kleuters 57 · themadag·LS 48. **Kolom `leeftijdsgroep` van themas is overal gevuld; thema_type kent 3 waarden (eigen_materiaal / eigen / eigen_standaard).** |
| Thema-bakken zonder thema-koppeling | `soort='thema'` zonder `thema_bak` | **0** |
| thema_bak → niet-bestaand thema / bak | NOT EXISTS | **0 / 0** |
| thema_bak → bak die geen thema-bak is | `b.soort<>'thema'` | **6** (alle naar bak 12237 "Houten kist kruisbogen", `soort` ≠ thema, geen code/vast_type; thema's Play Factory, Actie & Avontuur, Expeditie Survival, We knallen er op los, The Hunger Games, Boog- en lasershooting) |
| Thema's zonder enige bak (en zonder attribuut) | NOT EXISTS thema_bak | **14** — 9 kamp: Balls & Rackets, Beestenbende, CLIC IT, Fun on ice, Holderdebolder, Klim & Rackets, Klimwereld, Op stap met Sporty, Wacko Waterweek · 5 themadag: Blokkenbouwdoos, Clic-it, Holderdebolder (themadag), Jumpen XL, Laat je rollen. Deels bewust "volledig pool/uitstapkamp" (MASTERPLAN L22/L28), maar **8 hebben ook geen thema_behoefte** (zie §5) → écht leeg |
| Bak in >1 thema | `group by bak_id having count>1` | 37 bakken (gedeeld kamp↔themadag; bewust per themadag-regel, maar zie §2 voor codes) |
| Thema-bakken zonder items | NOT EXISTS bak_items | **3**: 12260 (Spookje Poef, leeg sjabloon, bewust) · 12302 Minigym 2/2 M00 (bewust leeg, VRAGENLOG r.206) · 12399 Wereldreizigers 2/2 K29 |
| Vaste pool-rijen (niet bulk) zonder items | | 51 — normaal (pool-eenheden zijn leeg per ontwerp); geen actie |
| Thema-bakken zonder code | `code=''` | **54** bakken (naar cat: 48 kamp-gekoppeld, 17 themadag-gekoppeld; overlap via gedeelde bakken). Voorbeelden: De bakkerij 1/2 + 2/2, Play Factory-curverbakken. Code onbekend is bij de invoer gelogd; zie §5 |
| bak_items zonder `item_type_id` / naar niet-bestaand type / naar niet-bestaande bak | | **0 / 0 / 0** ✅ (Mig 47-dekking 100% blijft) |
| Attributen zonder thema | NOT EXISTS thema_attribuut | **0** ✅ |
| thema_attribuut naar niet-bestaand attr/thema | | **0 / 0** ✅ |
| Attributen zonder magazijncode | `code=''` | **81 van 85** (alleen 4 hebben een code: TD1, TD7, F41, F41). Strijdt met ontwerpregel "alles met code ligt in Rozenweg"; attributen zijn dus niet traceerbaar |
| item_type_stock → niet-bestaand type / niet-bestaande locatie | | **0 / 0** ✅ |
| item_type_stock-rijen waar het type in geen enkele bak zit | | **3** |
| Item_types zonder voorraadrij | | 2.470 (normaal: alleen verbruik krijgt een rij) |
| **Item_types die nergens gebruikt worden** (geen bak_item, geen voorraad) | | **401** (404 zonder bak_item; 3 daarvan hebben nog een voorraadrij) |
| thema_behoefte → niet-bestaand thema / bak | | **0 / 0** ✅ |
| thema_behoefte met `vast_type` zonder bijbehorende vaste bak | | **0** ✅ |
| thema_behoefte met `bak_id` NULL | | 81 van 90 (verwacht: behoefte aan een pool-type, niet aan een specifieke bak) |
| bulk_spreiding → niet-bestaande bak / locatie | | **0 / 0** ✅ |
| **bulk_spreiding-som ≠ bakken.aantal** (is_bulk=1) | | **0** ✅ (alle 55 rijen sluiten) |
| bakken.thuislocatie_id naar niet-bestaande locatie | | **0** ✅ |
| Niet-bulk bak met `aantal`>1 | | **0** ✅ |

## 2. Dubbels
- **Thema's met bijna-gelijke namen die geen kamp/themadag-paar zijn:** exacte duplicaten naam (lower) **0**; zelfde naam+categorie+groep **0**. Er zijn 27 thema's met suffix "(themadag)" (bewuste kamp/TD-paren, naam botst met kampthema). Geen verdachte bijna-dubbels gevonden op naam; **niet** gecontroleerd op fuzzy-gelijkenis buiten exact/suffix (zie "Niet gedaan").
- **item_types exact dubbel** (lower+trim, naam+eenheid): **0**. Zelfde naam los van eenheid: **0**. ✅ (Mig-47-dekking houdt.)
- **item_types enkelvoud ↔ meervoud (naam vs naam+"s"/"en"): 61 paren, bij ALLE 61 worden beide varianten in bak_items gebruikt.** Voorbeelden: Blinddoek (id 3621, 8×) ↔ Blinddoeken (3286, 22×) · Maatbeker 4212 ↔ Maatbekers 4603 · Glitter 4635 ↔ Glitters 5437 · Vork 4422 ↔ Vorken 3681 · Spons 3946 ↔ Sponsen 3296 · Elastiekje 3505 ↔ Elastiekjes 5188 · Kartonnen bordje 4083 ↔ Kartonnen bordjes 3688 · Stoepkrijt 3911 ↔ Stoepkrijten 5186 · Laken 3893 ↔ Lakens 4726 · Cutter 3682 ↔ Cutters 6321. **Gevolg: voorraad/bestellijst/tekorten van hetzelfde fysieke ding worden gesplitst over 2 types.** Dit is het grootste echte datakwaliteitsprobleem. (Een grovere normalisatie — spaties/koppeltekens/leestekens/"s" weg — geeft 74 groepen; min of meer hetzelfde probleem, inclusief valse positieven.)
- **Hoofdletter-inconsistentie in item_types:** 234 namen beginnen met kleine letter (bv. "sponsjes", "houten blokken", "precisiemesje"); cosmetisch maar zichtbaar in lijsten/printbaar.
- **Top-50 meest gebruikte types (steekproef gelijkenis):** top-50 bevat Blinddoeken/Blinddoek, Kartonnen bordjes (13)/Kartonnen bordje, Plastic bekers (7)/Bekers (11)/Maatbekers (7) — "Bekers" vs "Plastic bekers" kan hetzelfde zijn (niet beoordeeld). Overige top-50-namen zijn uniek.
- **Dubbele bakcodes (20 codes, alle thema-bakken):** RGE×3, M00×5, G59×3, J21×3, O26, K43, K37, K2, I51, I38, I37, I24, H70, H31, H03, G13, G12, G00, F41, D35 (zelfde code op 2 bakken). **In VRAGENLOG gedocumenteerd (L5): RGE, M00, K43, K37, K2, J21, I51, I38, I37, I24, H31, H03, G59, G13, G12, F41, D35 (17 van 20). NIET gedocumenteerd: `O26` (bakken 12135, 12136), `H70` (11860, 11861), `G00` (12102, 12409)** — onderzoeken: echt dezelfde fysieke bak of invoerfout? (G00 komt ook voor als "koker G00" in Reis rond de wereld en "Doos zwembad noodles G00" legacy-atletiek.)
- **Attribuutcode ↔ bakcode-botsing:** attributen "Themabord 'De beweegplaneet'" en "Voet + paal (voor themabord)" delen code **F41** met elkaar én met 2 bakken (Bamboe-doos 3, Themabak 1/1 LS). F41 is dus 4× vergeven.

## 3. Gekke waarden
| Check | Aantal |
|---|---|
| bak_items qty ≤ 0 | **0** ✅ |
| bak_items qty > 500 | **15** — Rozijnen 800 · Bloem 900 · Vloeibare kinderlijm 800 · Mais in blik 600 · **Blikken kikkererwt 4800** · Pure chocolade 800 (+600) · Ongezouten noten 550 · Suiker 600 · Fijne kristalsuiker/Basterdsuiker/Chocolade 800 · **Rijst 6400** · **Nagels 1280** · Spijkers 960. Bijna zeker **gram/ml opgeslagen als "stuk"** (ingredienten per 8–32 kinderen). Plausibel voor Nagels/Spijkers is stuks; voor kikkererwt-blikken (4800) en rijst (6400 g) niet. |
| bak_items qty > 100 | 75 totaal (160 = 5×32 bij Pijpenragers/Kralen is wél plausibel) |
| bak_items qty niet-geheel (bv. 2.5 Zelfrijzende bloem, 1.6 Bloem 00, 6.4 Tomatenblokjes in blik, 1.12 Tomatenpuree) | **18** — kommagetallen voor tellingen van "stuks" |
| **Eenheid-model:** item_types.eenheid | 3.337× "stuk", 1× "vel" — er is feitelijk **geen eenheid-onderscheid** (kg/g/l/ml bestaat niet), wat de ongeloofwaardige hoeveelheden hierboven verklaart |
| Lege namen (bak_items / bakken / themas / attributen) | **0 / 0 / 0 / 0** ✅ |
| Items/types met "..." of "…" | bak_items **4** (ids 86540, 86616, 88767, 88923); item_types **6**: 4201, 4262, 5830 ("KV: 800g belegen kaas (Gouda, Reypenaer, ...)"), 5879, 5972, **6012** (een volledige INFO-alinea van ±250 tekens als item_type-naam!) |
| bak_items.naam ≠ item_types.naam | **0** ✅ (denormalisatie consistent) |
| Notitie "verifi*" (de werkvoorraad) | **bak_items 549** · bakken 4 · attributen **55 van 85** · item_types 0 → totaal **608** |
| – opgesplitst in bak_items | 149 "inhoud hersteld uit pre-opkuis-backup (2026-08-04)" (in 14 bakken) · 71 "aantal onbekend" · 58 "aantal niet op fiche" · 20 "hoeveelheid niet op fiche" · 19 "aantal verifiëren" · 19 "aantal onbekend op fiche (L7)" · 12 "aantal onbepaald" · 7 "hoeveelheid onbekend" · 7 "code onbekend" · 4 "verdeling bak 1/2 en 2/2 niet op fiche" · rest kleinere varianten (24+ losse formuleringen) |
| Items met "aantal onbekend/zonder aantal" (zodat qty=1 een gok is) | **266** |
| Bakken met ≥1 verifieer-item, per thema-cat | kamp 104 · themadag 93 (distinct bakken) |
| Voorraadrijen qty=0 met minimum>0 / qty<minimum / qty>500 / qty<0 | **0 / 0 / 0 / 0** ✅ — **geen bestellijst-ruis uit minimum>0**. Maar **867 van 868 voorraadrijen hebben qty=0 én minimum=0** (Rozenweg 858/859, Kantoor 9/9): de voorraad is *leeg ingevuld*, dus **tekort-/bestellijst kan nu niets betekenisvols tonen** zolang Maxim geen echte aantallen/minima invult. |

## 4. Steekproef 10 thema's vs STATUSLOG-claims
Bak/item/verbruik/attribuut via `thema_bak`→`bak_items`/`thema_attribuut`; "voorraadrijen" = rijen item_type_stock voor de item_types van dat thema (kan hoger uitvallen doordat types gedeeld worden met andere thema's — daarom alleen indicatief).

| Thema (id) | Claim bakken/items/verbruik/attr | Gemeten | Uitslag |
|---|---|---|---|
| De beweegplaneet kamp (4090) | 3 / 37 / 6 / 2 | 3 / 37 / 6 / 2 · codes F41, D57, D58 | ✅ |
| Circus Krokofant! kamp (4091) | 4 / 32 / 15 / 2 | 4 / 32 / 15 / 2 | ✅ |
| Dierenplezier kamp (4094) | 1 / 41 / 22 / 0 | 1 / 41 / 22 / 0 · N35 | ✅ |
| De vloek van de farao kamp (4096) | 2 / 48 / 20 / 0 | 2 / 48 / 20 / 0 · C29, D22 | ✅ |
| Mini helden 112 kamp (4104) | 3 / 74 / 37 / 0 | 3 / 74 / 37 / 0 · L05, L03, L01 | ✅ |
| Circus Krokofant (themadag) (4168) | 2 / 11 / 4 / **2** (frame + themadoek TD3) | 2 / 11 / 4 / **1** (alleen "Themadoek TD3", zonder code) | ❌ **frame-attribuut ontbreekt** (of werd samengevoegd met attribuut 37 van kamp 4091, dat ook "frame met doek" heet maar niet aan 4168 hangt) |
| Creakriebels (themadag) (4169) | 2 / 19 / 6 / 0 | 2 / 19 / 6 / 0 · L27, L25 | ✅ |
| De techniekfabriek (themadag) (4171) | 2 / 19 / 6 / 0 | 2 / 19 / 6 / 0 · I48, I49 | ✅ |
| De wondere kabouterwereld (themadag) (4173) | 2 / 20 / 4 / 0 | 2 / 20 / 4 / 0 · I38+I38 (dubbele code, gelogd) | ✅ |
| Hoeden en petten (themadag) (4178) | 3 / 6 / 5 / 0 | 3 / 6 / 5 / 0 · I23, I24, I24 (gelogd) | ✅ |

Voorraadrijen-claims (4090: 6 · 4091: 12 · 4094: 22 · 4096: 14 · 4104: 28 · 4168: 2 · 4169: 3 · 4171: 5 · 4173: 4 · 4178: 5): meting 11/12/22/14/30/3/7/5/5/5 — verschillen in 4090, 4104, 4168, 4169, 4173 komen door gedeelde item_types (stock is per type, niet per thema); **niet als fout gelezen**, wel een teken dat per-thema-voorraadtelling in STATUSLOG niet herleidbaar is.
**Score: 9 van 10 exact; 1 afwijking (attribuut 4168).** Globale claim "kampthema's: 77 thema's, 74 attributen, 638 voorraadrijen" (2 aug) vs nu: 79 kamp-thema's, 76 kamp-attributen, 868 voorraadrijen (themadagen toegevoegd na 2 aug) — niet vergelijkbaar, geen fout gevonden.

## 5. Oordeel & opschoonlijst
### Vóór de herfstvakantie (2–8 nov) — moet
1. **Verse prod-kloon trekken en dit script herdraaien** (db hier is 4 aug). 0 inspanning, voorkomt dat je een voorbije stand opschoont.
2. **Voorraad vullen met echte aantallen** voor de thema's van de herfstweek: 867/868 rijen zijn qty 0 / min 0 → tekortenlijst, bestellijst en generator tonen nul. Zonder dit is "waterdicht" niet te bewijzen. (Aantal: de item_types van de gekozen herfst-thema's; schatting 100–300 rijen.)
3. **Geplande herfst-thema's afchecken op de 14 lege thema's** (lijst §1). Als er één van de 14 in 2–8 nov valt, heeft de generator niets te leveren: óf bakken/pool aanmaken, óf bewust "pool/uitstap" label.
4. **Bakcodes van de herfst-thema's invullen** (54 bakken zonder code, 17 daarvan themadag): chauffeurslijst toont "bak — code"; zonder code komt de chauffeur niets te weten. Alleen voor de geselecteerde thema's, niet alle 54.
5. **Onopgehelderde dubbele codes O26, H70, G00** + de F41-vierling: bepalen of het dezelfde fysieke bak is (dan 1 bak met meerdere thema-koppelingen) of niet. Levert verwarring op in de generator (dubbelboeking-conflict) als beide in dezelfde week vallen.
6. **12237 "Houten kist kruisbogen"**: `soort`≠thema maar hangt aan 6 thema's via `thema_bak`. Controleer of de generator/chauffeur dit als bak ziet (6 thema's, ontbrekende code).
7. **Wereldreizigers 2/2 (12399, K29)**: lege thema-bak met code → ofwel items verdelen ofwel verwijderen.

### Kan wachten (na 11 nov)
| Actie | Omvang |
|---|---|
| Enkelv/meerv-types samenvoegen (61 paren; beide in gebruik) → voorraad klopt per fysiek ding; **eerst per paar mappen, dan `bak_items.item_type_id` hermappen, dan oud type verwijderen** | 61 paren, ±120 bak_items-rijen schatting (niet exact geteld) |
| 401 nergens gebruikte item_types opruimen (3 hebben voorraadrij) | 401 |
| Eenheden-model: kg/g/l/ml invoeren; items als Rijst 6400, Kikkererwt 4800, Rozijnen 800 nalopen | 15 items >500 + 18 kommagetallen + 75 >100 |
| 6 vervuilde item_types (met "…", **id 6012 = hele INFO-alinea als type**) herschrijven of omzetten in notitie/INFO-regel | 6 types + 4 bak_items |
| 234 item_types met kleine beginletter → hoofdletter | 234 |
| Attributen codes geven (81 zonder) en F41-conflict oplossen | 81 |
| De 608 verifieer-notities wegwerken bij eerste echte nakijk/inventaris — dit IS het werkprogramma voor september; per soort: 149 backup-herstel (14 bakken, kijk eerst die), 266 aantal-onbekend, 55 attributen | 608 |
| Attribuut "frame" voor Circus Krokofant (themadag) 4168 aanvullen | 1 |
| thema_type-waarden normaliseren (`eigen` ×2, `eigen_standaard` ×3 naast `eigen_materiaal`) | 5 thema's |
| Legacy `thema_bakken` (3 rijen, thema 4080 atletiek: G11/D17/G00) en de dode tabellen (thema_materiaal, materiaal_*, gedeeld_*, …): aanwezig in schema; legacy-tabel moet nog door de migratie "vervangen" zijn | 3 + dode tabellen |

### Wat er goed uitziet (nul-bevindingen)
Alle verwijzingen (thema↔bak, thema↔attribuut, bak_items→type, voorraad→type/locatie, behoefte→thema/bak/vast_type, bulk_spreiding→bak/locatie) zijn referentieel schoon: **0 wezen overal**. Bulk-sommen sluiten 55/55. Geen negatieve of nul-hoeveelheden, geen lege namen, geen exacte dubbele item_types of thema's.

## Niet gedaan / beperkingen
- Fuzzy-gelijkenis voor thema-namen (Levenshtein) niet uitgevoerd; alleen exact + suffix.
- Gelijkenis van item_types is op "s"/"en" en leestekens gedaan, niet op synoniemen (Bekers/Plastic bekers).
- Per-thema-voorraadrijen zijn indicatief (gedeelde types).
- Db is de kopie van 4 aug; alles ná die datum is niet gezien. Server op 3305 niet gestart; queries zijn rechtstreeks op het bestand gedraaid (`SELECT` only, db-bestand ongewijzigd).
- Leesscript staat niet in de repo (scratchpad); op verzoek toe te voegen als `scripts/audit-data.mjs`.

**VOLLEDIG KLAAR MET DE PROMPT. NU IS HET TERUG AAN DE HOOFDCHAT.**
