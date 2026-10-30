# PROMPT LK1 — LOCATIES › KAART (knop naast de lijst) + drie restpunten (voertuig wisselen in ritdetail, /bakken?thema=, dubbel-detectie Catalogus)
**Chat D (Sonnet) · map `D:\Sporty\sporty-d` · branch `bouw-d` · poort 3304 · verslag `OVERLEG-d.md` · TIJDSLIMIET 2,5 uur**

Lees eerst `CLAUDE.md`. Begin met `git fetch origin` en `git rebase origin/main` (PL2 en PL3 staan op main). Controleer de exitcode van de rebase zelf vóór je pusht. Lees dan volledig:
1. `public/locaties.html/.js/.css` + `routes/locaties-overzicht.js` (LO1, standaardpatroon: lijst links 860 px, detail rechts), `design/PATROON-DEFINITIEF.html`.
2. De oude kaart in `index.html` (Leaflet 1.9.4 van unpkg, `#kaart-map`, `.loc-kaart-pin`, `.loc-kaart-num`, stockage oranje; zoek "kaart"). In `public/locaties.js` regel ~109 verwijst de knop "📍 Kaart" nu naar `/#kaart?id=`.
3. `public/ritplanning.js` (ritdetail; VT1-keuzelijst bij Nieuwe rit), `routes/ritplanning.js` (`voertuigen[]` met `bezet_op_dag`), `PUT /api/ritten/:id {voertuig_id}` (bestaat, VT1).
4. `public/bakken.js` + `routes/bakken-overzicht.js` (MA1), `public/themas.js` (knop "alles in Bakken ›" → `/bakken?thema=<id>`).
5. `routes/catalogus-overzicht.js` (MA2: dubbel = naam genormaliseerd: kleine letters, accenten, meervoud -s/-en; geeft 149 groepen op de testdata).

Je raakt ALLEEN: `public/locaties.html/.js/.css`, `routes/locaties-overzicht.js` (alleen: coördinaten/kaartdata), `public/ritplanning.js` (alleen het ritdetail-voertuig), `public/bakken.js` en `routes/bakken-overzicht.js` (alleen het thema-filter), `routes/catalogus-overzicht.js` en `public/catalogus.js` (alleen de dubbel-regel), `index.html` (alleen: vervangstrook op de oude Kaart-tab "De kaart staat nu in Locaties › Kaart"), `scripts/test-lk1-kaart.mjs`, `OVERLEG-d.md`. NIET `public/nav.js`, `lib/migraties.js`, `routes/beheer.js`, `routes/instellingen.js`, `public/backup.*`, `public/instellingen.*` (chat C). Heb je een migratie nodig: GEVONDEN, werk zonder.

## Punt 1 — Kaart in Locaties (Maxim 30/10: geen eigen tabblad, een knop in Locaties)
- In de filterbalk van `/locaties` een schakelaar **Lijst / Kaart** (zelfde vorm als Week/Seizoen in `/rooster`: `.seg`). `?zicht=kaart` opent de kaart.
- Kaartzicht: het linkerdeel (860 px) wordt de Leaflet-kaart (zelfde versie als de oude, van unpkg, of uit `public/` als die al lokaal staat), met pins voor alle locaties die coördinaten hebben: kamp groen, stockage oranje; de actieve chips (bv. "deze week actief") filteren ook de pins. Klik op een pin = dezelfde detailkaart rechts als in de lijst (zelfde URL `?id=`). Locaties zonder coördinaten: teller "N zonder adres op de kaart" met link naar de lijst gefilterd.
- De knop "📍 Kaart" in het detail opent `/locaties?zicht=kaart&id=<id>` (ingezoomd op die pin), niet meer `/#kaart`.
- Gsm (390 px): kaart volle breedte, ~60 % schermhoogte, detail eronder; geen horizontale paginascroll; knoppen ≥ 44 px.

## Punt 2 — Voertuig wisselen in het ritdetail (VT1-restpunt)
In het ritdetail van de ritplanning wordt het voertuig een keuzelijst, dezelfde als bij Nieuwe rit (eigen · huur · privé · "ander voertuig…", "(ook op rit #n)" kiesbaar). Wijzigen = `PUT /api/ritten/:id {voertuig_id}` via `window.sportyApi`, de waarschuwingen (dubbel, onderhoud, capaciteit) verversen meteen. Het beeld verandert verder niet.

## Punt 3 — `/bakken?thema=<id>` (MA2-restpunt)
`public/bakken.js` leest `?thema=` en filtert de lijst op de bakken van dat thema (themabakken + gekoppelde bakken/attributen via `thema_bak`/`thema_attribuut`), met een wisbare chip "Thema: <naam> ✕" in de filterbalk.

## Punt 4 — Dubbel-detectie Catalogus minder ruim (MA2-restpunt)
De regel "meervoud -s/-en weg" maakt van te veel verschillende artikels een dubbel (149 groepen). Nieuwe regel: genormaliseerde naam (kleine letters, accenten weg, leestekens en dubbele spaties weg) moet **gelijk** zijn, óf alleen verschillen in een meervoud-uitgang van het **laatste** woord en dan alleen als beide namen minstens 5 tekens hebben en het artikel dezelfde eenheid/categorie heeft. Meet op `herfst-test.db`: aantal groepen vóór en na, en geef 10 voorbeelden van groepen die wegvielen en 10 die bleven in je verslag.

## Bewijs
- `scripts/test-lk1-kaart.mjs` (via `_testhulp` op `herfst-test.db`, eigen poort): kaartdata geeft alleen locaties met coördinaten + teller zonder; `?zicht=kaart` rendert de kaartcontainer en de Lijst/Kaart-schakelaar (DOM-test); knop Kaart in het detail wijst naar `/locaties?zicht=kaart&id=`; ritdetail-voertuig wisselen → `voertuig_id` opgeslagen en waarschuwing "voertuig dubbel" verschijnt/verdwijnt; `/bakken?thema=` geeft alleen de bakken van dat thema; dubbel-groepen < vroeger en "Ballon"/"Ballonnen" blijft dubbel, "Lijm"/"Lijmen" (andere categorie) niet; vervangstrook; bestaande tests (lo1, vt1, ma1, ma2, rp2) groen.
- Gsm-meting. Browsercontrole: NOOIT een adres met gebruikersnaam/wachtwoord openen; test via scripts met de inlog in de request-header. Lukt een browserstap niet zonder toestemming: overslaan, melden, verder. Volle run 2× groen. Commit per punt, push `origin HEAD:bouw-d`. NOOIT naar main, NOOIT deploy.bat. Verslag onderaan `OVERLEG-d.md` per punt + GEVONDEN. Laatste bericht eindigt met exact: **VOLLEDIG KLAAR MET DE PROMPT. NU IS HET TERUG AAN DE HOOFDCHAT.** Bij de tijdslimiet: stop, commit, "Stand bij tijdslimiet", push, **TIJDSLIMIET BEREIKT: GESTOPT MET EEN TUSSENSTAND. NU IS HET TERUG AAN DE HOOFDCHAT.** Volgorde bij tijdnood: 1, 2, 3, 4.
