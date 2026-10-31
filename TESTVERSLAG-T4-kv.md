# TESTVERSLAG T4: rol kampverantwoordelijke (KV), tweede ronde

Getest op `origin/main` 5f9f743 (na TF5 en TF6), lokaal op poort 3381, verse kopie van `herfst-test.db`, `APP_PASSWORD` leeg. Drie KV's via kantoor klaargezet (Betekom, Abdijschool, Boudewijnstadion met twee thema's) plus een vierde kamp zonder bak. Browser op 390×844, KV's via `/kv/<token>`. Echte muisklikken waar het lukte (via `ref` van de pagina, niet met `element.click()`); het herladen deed ik met een nieuwe navigatie.

## Kan deze persoon morgen zijn werk doen?
1. **Ja, nu ook aan het einde van het kamp.** Natellen na versturen komt bij kantoor aan: elke versie staat in de database, kantoor krijgt een melding bij een wijziging en geen melding als er niets veranderd is.
2. De KV ziet nu "✓ Verstuurd om zaterdag 31 okt · 10:51" en "2 wijzigingen nog niet verstuurd"; bakken staan per thema en groep.
3. **Wat nog tegenhoudt:** een natelling die een tekort *oplost* haalt de eerdere melding aan kantoor niet weg (N1), en de KV ziet op het Overzicht niet dat kantoor al op een aanvraag antwoordde, en niet wanneer het stuk komt (N2, N3).
4. Beveiliging in orde: vreemd, verzonnen en andermans token en 11 kantoor-API's werden geweigerd.
5. Een kamp zonder bak geeft een tegenstrijdige tekst (N5).

## Hertest per nummer uit T3
| T3 | Stand | Wat ik zag |
|---|---|---|
| G1 hertellen na versturen komt niet bij kantoor | **Weg** | Elke natelling na versturen geeft een versie en bij "versturen" een rij in `kv_verstuurd` plus melding "Telling bijgewerkt · Boudewijnstadion: F40: Prints agenten 3 → 4". Zie 10 rondes hieronder |
| G2 geen teken van "verstuurd" | **Weg** | "✓ Verstuurd om zaterdag 31 okt · 10:51"; vóór het versturen "2 wijzigingen nog niet verstuurd" |
| G3 twee thema's niet te onderscheiden | **Weg** | Kopjes "Alles op wieltjes · kleuters" en "Holderdebolder · kleuters"; wel heet de bak daaronder nog "Alles op wieltjes · Themabak zwarte curver" (herhaling) en "Holderbak" |
| G4 oude link blijft werken | **Weg** | 13 dagen na de vrijdag: lezen (banner "Dit kamp is afgelopen. Je kan alles nog lezen, maar niets meer wijzigen"); schrijven, versturen, aanvraag, kapot: 403. 15 dagen: data 403, pagina 410 "Dit kamp is afgelopen" |
| G5 kamp zonder bak | **Deels** | Nu een uitleg ("Voor dit kamp staan er geen bakken op jouw lijst … Laat het kantoor weten"), maar zie N5 |
| G6 "maandag nakijken" | **Weg** | "tik een bak om te tellen · natellen mag de hele week" |
| G7 overzichtstekst rommelig | **Deels** | Nu "F40: 2 fluitje kapot · 2 bakken nog te tellen"; "(gelamineerd)" weg uit de overzichtstekst, maar de kaart toont alleen het eerste item |
| G8 toast over de onderste rij | Niet opnieuw bekeken | |
| G9 geen tabbalk op telscherm | Ongewijzigd (ontwerp) | Wel nu "💥 Kapot melden" op het telscherm zelf |
| G10 datumformaat | **Weg** | Overal "zaterdag 31 okt · 10:53" |
| Onduidelijk: "Rest klopt ✓" | **Weg** | "Rest klopt ✓ (zet 23 stuks)", telt af naar "(zet 21 stuks)" |
| Onduidelijk: wanneer versturen? | **Deels** | Hint "Je mag altijd natellen en opnieuw versturen; alles blijft bewaard" |
| Onduidelijk: "Aanvragen 3" telt ook afgewezen | Ongewijzigd | |

## Tien keer natellen (database en kantoorscherm, op één kamp, zelfde dag)
Kamp 169, bak F40. Kantoor keurde na de eerste verzending: Prints agenten "bestellen 2" en rondde af. Daarna, elke ronde "tellen + versturen" via de KV-API (de eerste verzending en het natellen met Politiepak en Prints deed ik met echte klikken in de browser):

| # | Natelling | Versies | Verstuurd-rijen | Meldingen | Nakijk-regels | Uitkomst |
|---|---|---|---|---|---|---|
| start | Politiepak 1, Prints 3 | 2 | 1 | 0 | 23 | |
| 1 | kantoor rondt af | 2 | 1 | 0 | 23 | keuring afgerond, `kantoor_status nagekeken` |
| 2 | Prints 4 (kleiner tekort) | 3 | 2 | 1 | 23 | beslissing "bestellen 2" blijft letterlijk, regel wel nog 3 |
| 3 | Prints 1 (groter tekort) | 4 | 3 | 2 | 24 | extra regel "weg" 2 als gemelde regel, keuring weer `open` |
| 4 | geen wijziging | 4 | 3 | 2 | 24 | geen versie, geen melding: goed |
| 5 | Prints 1 nogmaals | 5 | 3 | 2 | 24 | **versie erbij** (identiek), geen verstuurd-rij, geen melding |
| 6 | Politiepet 0 | 6 | 4 | 3 | 24 | regel zonder beslissing bijgewerkt |
| 7 | Fluitje kapot 1 | 7 | 5 | 4 | 24 | |
| 8 | Fluitje kapot 2 | 8 | 6 | 5 | 24 | regel bijgewerkt (kapot 2), notitie "knapt af" blijft |
| 9 | Politiepet 1 | 9 | 7 | 6 | 24 | |
| 10 | Prints 5 (volledig) | 10 | 8 | 7 | 24 | beslissing "bestellen 2" en gemelde "weg 2" blijven staan (zie N1) |

- **Een beslissing wijzigt niet:** Prints "bestellen 2" bleef na alle rondes `kantoor_actie=bestellen, kantoor_aantal=2`. Dat klopt met de keuze van TF5.
- **Kantoor, "Eerdere tellingen" (desktop, echt geklikt):** rechts staat per stuk "Prints agenten · laatste: 5 · 4 eerder", uitklapbaar met `geteld 1 · … · 31/10/2026, 10:52 · Test KV Derde (KV)`. De notitie "2 prints lagen niet in de bak" staat bij een versie met 1 en een met 4, ook al ging die over 3.
- **Meerdere dagen:** de klok kon ik niet verzetten; het meerdaagse deel is dus alleen als één dag met losse tijdstippen getest. De link-datum (13 en 15 dagen) heb ik wel via de periode verzet.

## Scenario's
| Scenario | Score | Zo gezien |
|---|---|---|
| Overzicht, begin kamp | GROEN | "Levering gepland vrijdag 30 okt · 09:00 · 48 stuks", "Ophaling gepland vrijdag 6 nov · 17:00" |
| Groepering per thema/groep | GROEN | Twee kopjes "Alles op wieltjes · kleuters", "Holderdebolder · kleuters" |
| Bak klopt (✓), tekort met notitie | GROEN | Politiepak ✓; Prints 5→3 "tekort 2" met notitie; "✓ Opgeslagen" |
| Rest klopt | GROEN | knop toont "(zet 23 stuks)", daarna 21 |
| Herladen midden in het werk | GROEN | stand blijft ("2 wijzigingen nog niet verstuurd") |
| Telling versturen | GROEN | "✓ Verstuurd om zaterdag 31 okt · 10:51" |
| Kapot melden vanaf het telscherm | GROEN | knop "💥 Kapot melden" op het telscherm; sheet met "Wat is er kapot?"; "✓ Verstuurd naar kantoor"; aanvraag "Hoepel gebarsten" (soort kapot) in de lijst. De sheet start op "— zelf typen —", niet op het stuk uit de bak waar je in zit |
| Foto kiezen | NIET GETEST | bestandskiezer niet bedienbaar in dit pane |
| Aanvraag volgen | DEELS | "20 × Ballonnen · afgewezen · Staat al in de bak"; "5 × Multiblaasring · goedgekeurd · Goedgekeurd — het stuk wordt besteld en daarna geleverd." Maar geen datum of locatie van de levering (N3) |
| Link 13 dagen na het kamp | GROEN | lezen; schrijfknoppen zitten niet in beeld (hoogte 0) en schrijven geeft 403; "Verstuurd om …" en tellers blijven |
| Link 15 dagen | GROEN | pagina 410 "Dit kamp is afgelopen. De link is gesloten. Je tellingen en aanvragen blijven bewaard bij Sporty. Heb je nog een vraag? Neem contact op met kantoor." |
| Kamp zonder bak | DEELS | "Voor dit kamp staan er geen bakken op jouw lijst, dus er is niets te tellen. Klopt dat niet? Laat het kantoor weten." Geen belknop (kantoornummer leeg in de testdata) |
| Verzonnen token | GROEN | data 403, pagina 404, `/tel/…` 404 |
| Andermans token | GROEN | Betekom-token op een bak van het derde kamp: 403; Abdij-link toont alleen eigen bak (HB01), geen woord Boudewijn |
| Kantoor-API's met mijn token | GROEN | 11 routes (aanvragen, aanvraag-status, personeel, nakijken, taken, tekorten, aanvullijst, opzoeken, bericht-kantoor, meldingen, zonder-artikel): 401 zowel zonder token als met KV-token in `x-auth-token` |
| Console, scroll, knoppen | GROEN | telscherm 390: scrollWidth 390, 50 elementen, geen onder 44 px, geen console-fouten |
| Binnen enkele minuten zonder uitleg | DEELS | zie ONDUIDELIJK |

## Niet echt geklikt / niet getest
- De tien natelrondes zijn via de KV-API gedaan (de eerste twee wel met klikken); de Nakijken-uitklap op desktop is geklikt, de gsm-weergave van "Eerdere tellingen" niet (TF5 meldde dat die daar ontbreekt).
- Foto kiezen, netwerk uit, dubbel tikken op "Telling versturen" (API-versturen zonder wijziging wel getest: geen tweede melding).
- Meerdere echte dagen: de klok niet verzet.
- De lezen-stand heb ik in de pagina gelezen (knoppen met hoogte 0); een vinger-tik erop niet geprobeerd.

## GEVONDEN
### BLOKKEERT
Geen.

### HINDERLIJK
**N1 (NIEUW). Een natelling die het tekort oplost haalt de melding aan kantoor niet weg.** Kamp 169, ronde 3 en 10. Verwacht: als de KV na een groter tekort (Prints 1) weer op 5 komt, ziet kantoor dat het weer klopt. Gezien: Prints heeft nog steeds de beslissing "bestellen 2" en de gemelde regel "weg 2" (`gemeld_soort=weg`, aangetroffen leeg) staat open, terwijl het laatste getelde aantal 5 is; kantoor bestelt 2 voor iets dat er is. De "Eerdere tellingen" tonen wel "laatste: 5", maar de tabel erboven toont de oude stand (geteld 3, -2). Stappen: telling afronden door kantoor, KV telt 1, verstuurt, telt 5, verstuurt.
**N2 (NIEUW). De KV ziet op het Overzicht niet dat er een antwoord is.** Kaart "Aanvragen · 3 wacht op kantoor" toont "laat kapot · laat" (de nieuwste), niet dat "20 × Ballonnen" afgewezen en "5 × Multiblaasring" goedgekeurd is. Het antwoord staat pas onder tab Aanvragen. De tab-teller "Aanvragen 5" telt ook afgehandelde. Stappen: kantoor beslist, KV opent het Overzicht.
**N3 (NIEUW). Aanvraag volgen "tot op locatie" kan niet.** Goedgekeurd met "wordt besteld en daarna geleverd": geen datum, geen "onderweg", niet wanneer het er is. Er is wel een transporttaak (TF6) maar de KV-data (`/api/kv/…/data`) bevat die niet bij de aanvraag. Stappen: aanvraag goedkeuren, KV-scherm bekijken.
**N4 (NIEUW). Identieke natelling schrijft een versie.** Ronde 5: Prints opnieuw 1 geeft een tiende versie (identiek aan de vorige) zonder melding. In "Eerdere tellingen" staat die dubbel ("geteld 1" twee keer). Geen foutieve melding, wel ruis in de historiek.

### COSMETISCH
**N5 (NIEUW). Kamp zonder bak: tegenstrijdige tekst.** Tab Tellen: "tik een bak om te tellen · natellen mag de hele week" en "⚠ Levering nog niet aangekomen: tel pas als alles er staat." staan boven "er is niets te tellen". Geen knop "Bel kantoor" als kantoor geen nummer heeft, en geen ander middel om kantoor iets te laten weten (een kapot-melding of aanvraag kan wel).
**N6 (NIEUW). Lezen-stand toont nog schrijfuitleg.** In het telscherm blijft "Per stuk: tik ✓ als het aantal klopt…" en in Tellen "tik een bak om te tellen · natellen mag de hele week" staan, terwijl er geen knoppen meer zijn.
**N7 (NIEUW). Notitie blijft hangen op nieuwe versies.** Notitie "2 prints lagen niet in de bak" staat bij versies met 1 en 4 stuks, ook al gaat de notitie over de eerste telling van 3.
**N8 (NIEUW). Kapot-sheet start op "zelf typen".** In bak HB01 start de keuze op "— zelf typen —" in plaats van de bak waar je in zit; een jongere typt "Hoepel gebarsten" i.p.v. te kiezen.
**N9.** Pagina "Dit kamp is afgelopen" noemt geen telefoonnummer van kantoor (alleen "Neem contact op").
**N10.** Overzichtskaart Tellen toont alleen het eerste afwijkende stuk ("2 fluitje kapot"), terwijl er ook tekort 2 bij Prints is.

## ONDUIDELIJK VOOR DEZE ROL
- "Telling versturen (0/2)" blijft staan terwijl er al gedeeltelijk geteld en verstuurd is; "0/2" wekt de indruk dat er niets gedaan is.
- "Tellen 0/2 bakken" terwijl in F40 al 4 stukken geteld zijn.
- "2 wijzigingen nog niet verstuurd": welke? Er staat niet bij wat.
- De "Levering nog niet aangekomen"-waarschuwing blijft staan, ook al is de levering gepland op een dag die voorbij is (30 okt).
- Het verschil tussen "Kapot melden" op het telscherm (een melding aan kantoor) en "kapot" invullen bij een stuk (een telling): beide leiden tot "kapot", maar op twee plekken bij kantoor.
- "Aanvragen 5": telt alles, ook wat al beantwoord is.
