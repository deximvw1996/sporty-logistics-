
# V3b — annuleer-bug, modals i.p.v. prompt/confirm, conflicten-tab (chat D, 2026-10-29)
Start 23:21, klaar ruim binnen 2 uur. Alleen `index.html`, `scripts/test-v3b-ui.mjs`, `OVERLEG-d.md` geraakt. Commits op bouw-d (niet naar main).

## Wat af is
- **Punt 1** — `behandelAanvraag`: één modal. Afwijzen = verplicht redenveld; goedkeuren = motivatie + vinkje spoedtransport + aantal (vooringevuld uit de tekst) + gewenste dag (standaard eerstvolgende werkdag). Annuleren/Escape/klik buiten = niets. Body blijft `{status,reden,maak_spoedtransport,spoedtransport:{item,qty,datum}}`.
- **Punt 2** — `vraagModal({titel,tekst,velden,bevestigTekst,gevaarlijk})` (Promise → `null` of veldwaarden; Enter/Escape, focus op eerste veld, knoppen 44px, rode knop bij `gevaarlijk`) + `bevestig(tekst,opt)`-helper. Alle 9 `prompt(` en 35 `confirm(` weg (bak toevoegen = 1 formulier met dropdown leeftijdsgroep; nieuwe aanvraag = soort-select + tekst; aantal in bezit; stockagelocatie = select; ander voertuig). Niet-destructieve bevestigingen (kaartposities, ontkoppelen, checklist) hebben `gevaarlijk:false`/eigen titel.
- **Punt 3** — Conflicten-tab leest `GET /api/conflicten`, gegroepeerd per soort (icoon + titel + aantal, ernst-gekleurd), met "Naar kampmoment →" (springt naar Kampplanner › Per locatie met die locatie als die in de tekst staat, anders Rooster), laadtekst, foutmelding+opnieuw-knop, lege lijst "Geen conflicten in <periodenaam>". Oude client-berekening weg. `controleerConflicten()` toont een foutregel i.p.v. stil falen. Nieuw: `bevestigDubbelThema()` — gele waarschuwing vóór opslaan bij koppelen van een thema dat dezelfde week al op een andere locatie staat (kampmoment-formulier, "thema toevoegen" aan kampmoment, "plan thema hier").

## Bewijs
- `node scripts/test-v3b-ui.mjs` 2× → 15 ok, 0 fout, ALLES GROEN (statisch: geen prompt(/confirm(, vraagModal, geen `||''` in behandelAanvraag, qty+datum in body, checkConflicten op server; live op poort 3340: aanvraag blijft `nieuw`, dubbel_thema verschijnt in /api/conflicten voor twee kampmomenten met hetzelfde thema in week 2).
- `node scripts/test-veiligheid.mjs` 2× → 58 ok, 0 fout, ALLES GROEN.
- `node --check` op beide inline scripts van index.html: geen syntaxfouten (alle 35 confirm-aanroepen stonden al in async-functies).
- Klikpad poort 3304 (login API-gebruiker): Transport › Op te stellen → ❌ Afwijzen → modal "Aanvraag afwijzen" met verplicht redenveld → Escape → geen enkele PUT in de netwerklog (fetch-spy), aanvraag #2 nog `nieuw`, 0 native dialogen. Daarna ✅ Goedkeuren → modal toonde de aanvraagtekst; aantal vooringevuld 12, dag 2026-10-29; vinkje spoed aan → Goedkeuren → `PUT /api/aanvragen/2/status {"status":"goedgekeurd","reden":"","maak_spoedtransport":true,"spoedtransport":{"item":"12 extra ballen voor Abdijschool","qty":12,"datum":"2026-10-29"}}`.
- Dubbel thema: "1001 Ballen en Bellen" op Abdijschool week 1, koppelen aan Betekom week 1 → modal "Thema al ingepland … staat in week 1 al op Abdijschool Vlierbeek" → Annuleren → geen POST, 0 thema's op Betekom. Daarna via API gekoppeld → Overzicht › Conflicten: 17 meldingen in 5 groepen (o.a. "ZELFDE THEMA OP TWEE PLEKKEN IN DEZELFDE WEEK (1)", "BAK NODIG OP MEERDERE PLEKKEN (8)"), kop "17 meldingen · Zomer 2026"; klik "Naar kampmoment →" → Kampplanner actief, Per locatie, locatie "Abdijschool Vlierbeek". Console: 0 fouten.
- Niet vastgelegd: schermafdrukken in `bewijs\` (wel gezien in de browserpane).

## GEVONDEN (buiten mijn gebied, niet gefixt)
- `GET /api/conflicten` filtert niet op periode en geeft geen gestructureerde velden (week/locatie_id/kampmoment_id): de tab haalt week en locatie met een regex uit `bericht`; bak-/attribuutconflicten ("…@1") hebben geen "week" in de tekst → geen weekprefix, sprong gaat naar de eerste locatie in de tekst. Voorstel voor chat C/server: `{type,ernst,bericht,week,locatie_ids,kampmoment_ids,periode_id}` + `?periode_id=`.
- Het oude tabblad toonde ook "kampmoment zonder thema", sport-sets te weinig en gedeeld materiaal; de server meldt "geen thema gekoppeld" niet → die controles zijn nu weg uit de tab (server-uitbreiding nodig als Maxim ze terug wil).
- Server zet bij goedgekeurde aanvraag het spoedtransport zonder van/naar-locatie (leest die uit `spoedtransport` maar de UI vraagt ze niet).
- Een bash-heredoc met een quote in index.html-patches faalde; werkscript in de worktree (`scripts/_tmp-*.js`) verdween spontaan tussen twee commando's — mogelijk ruimt iets/iemand `_tmp` op; patches daarna vanuit de scratchpad gedraaid.

## Buiten mijn gebied
Niets nodig in `routes/*` voor deze opdracht.

# CH2 — Chauffeursscherm deel 2: de rit-pagina (chat D, 2026-10-30)
Start 16:20, klaar binnen de 2,5 uur. Commits op bouw-d (niet main, geen deploy.bat).

## Wat af is
- `GET /rit/:token` (routes/transport.js, alleen die route) serveert nu `public/rit.html` met `public/rit.css` + `public/rit.js` **inline** (geen losse statics → geen Basic-auth-gat; foute token → nette 404-pagina, geen stacktrace; `_zorgVoorChecks(rit)` blijft aangeroepen zodat de regels bestaan).
- **Dag-scherm**: kop (datum "ma 2 nov", chauffeur · voertuig · stops · "x van y stuks geladen", statuspil), legenda, tijdlijn met tijd/dot/naam/soort·stuks·KV/chip (klaar/bezig/volgende/gepland), 🔒 bij vaste stops, ▲▼ (44 px, oranje) enkel bij vrije stops en alleen actief naast een andere vrije stop, uitgelichte huidige stop, oranje uitlegvak, balk met ⚠ en "Open stop N: …".
- **Stop-scherm**: kop "← Dag" + "STOP n VAN m"; kaart met soort · tijd · 🔒 vast/↕ vrij, locatie, "van/naar … · adres", 🔑 sleutel_info, belbare `tel:`-blokken (KV en sleutelcontact); "📍 Ik ben aangekomen" → "✓ Aangekomen"; rek-groepen (REK N / POOL / OVERIG) met "x van y geladen"; per stuk foto of placeholder, code · ×aantal, laden- en lossen-vak (toggle via de bestaande routes), bulk "x van y geladen · tik voor aantal", rode 'past niet'-markering + "blijft open als nieuwe taak" en terugdraaien via het rode vak (`{reden:null}`); onderbalk ⚠ / "Past niet / niet gevonden" (toont hint) / "Stop n+1 →" of "Terug naar dag". Elke stop (ook een vorige) is bereikbaar; `#stop-<id>` in de URL herstelt het scherm na verversen.
- **Overlay "past niet"** (3 redenen, opmerking, "Markeer: blijft open"); voor bulk een extra veld "Hoeveel gaan NIET mee?" → de pagina stuurt `aantal` = totaal − niet-mee (de server wil "wat WEL mee gaat"). **Overlay "probleem melden"** (3 soorten, tekst, foto via camera/galerij → verkleind tot 1280 px jpeg, "Versturen") → toast "✓ Gemeld aan kantoor en <KV>".
- **Toast** voor elke bevestiging en elke `{error}` van de server (rood bij fout, 3 s). Na elke actie een verse `GET …/data` en hertekenen; bij geen verbinding blijft de laatste stand staan (localStorage) met een toast. Geen prompt()/confirm()/alert().

## Bewijs
- `node scripts/test-ch2-rit-pagina.mjs` 2× → **38 ok, 0 fout, ALLES GROEN**. (Geen headless browser in de map → HTML-bouwers + actielogica van `public/rit.js` als module met de échte data-JSON en de echte API van een eigen server op 3342.) Gedekt: 200/404-pagina; Dag met 3 stops, 🔒 ×1, ▲▼ ×4 (eerste ▲ en laatste ▼ disabled); Stop met tel:-links, REK N, POOL, bulk; wissel → tijdlijn 1,3,2 + tijden mee; wissel met vaste stop → 409-tekst als toast; aangekomen; laden aan/uit; niet-mee → rode markering + rest-taak #199; terugdraaien → rest-taak weg; bulk 2 van 5 niet mee → qty 3, "2 past niet → blijven open"; probleem "anders" zonder tekst → toast, overlay blijft; probleem met foto → aanvraag "Chauffeur Test Chauffeur bij Abdijschool Vlierbeek: past niet in het lokaal — trap te smal"; fout-id → servertekst als toast.
- **DOM-dump Dag** (uit de test): `Rit ma 2 nov | GEPLAND | Test Chauffeur · 3 stops · 0 van 4 stuks geladen | 🔒 vast door kantoor | ▲▼ vrij: wissel van plaats | 09:00 Abdijschool Vlierbeek levering · 6 stuks · KV Test KV Abdijschool [volgende] 🔒 | 10:00 Betekom … [gepland] ▲ ▼ | 11:00 Abdijschool Vlierbeek … [gepland] ▲ ▼ | ▲▼ wisselt alleen met een andere vrije stop · Abdijschool Vlierbeek staat vast door kantoor | ⚠ | Open stop 1: Abdijschool Vlierbeek →`
- **DOM-dump Stop 1**: `← Dag | STOP 1 VAN 3 | Rit ma 2 nov · Test Chauffeur | Levering · 09:00 · 🔒 vast | Abdijschool Vlierbeek | van Rozenweg · Molenstraat 90, 3010 Kessel-Lo | 🔑 Sleutel bij de buren nr. 12 | Test KV Abdijschool (KV) 📞 0499 88 77 66 | Sleutel · Conciërge Jan 📞 0470 11 22 33 | 📍 Ik ben aangekomen | REK N 0 van 1 geladen … laden/lossen | POOL 0 van 5 geladen … tik voor aantal | ⚠ | Past niet / niet gevonden | Stop 2 →`
- **Echte browser (in-app, 390×844, rit-link op poort 3304)**: Dag, Stop en de "past niet"-overlay bekeken en vergeleken met het ontwerp; `scrollWidth` 390 (geen horizontale scroll), geen knop < 44 px, console leeg; Stop-scherm hersteld via `#stop-197`. (Schermafdrukken enkel in de browserpane gezien, niet als bestand bewaard.)
- `node scripts/volle-run.mjs` 2× → **17/17 groen** (16 bestaande + ch2) na een verse `sporty.db`-kopie uit sporty-railway (mijn oude werkmap-db was door eerdere sessies vervuild: v3c-catalogus/veiligheid/v3c-fotos waren daardoor rood). Eindtabel: ch1 39 · ch2 38 · f1-modules 85 · f1-schrijven 22 · f1-wijzigingen 46 · keten-aanvraag 12 · keten-kv-periode 19 · keten-levering 44 · keten-ophaling 7 · keten-periode 14 · keten-splits 9 · v3a-keten 52 · v3b-ui 15 · v3c-catalogus 33 · v3c-fotos 47 · v3d-bulk 27 · veiligheid 58, allemaal 0 fout.

## Gelijk aan het ontwerp / afwijkingen
Gelijk: opbouw, teksten, kleuren, groottes, knoppen, overlays en toast van `CHAUFFEUR-DEFINITIEF.html` (CSS 1-op-1 overgenomen). Afwijkingen, elk met reden:
1. **Rozenweg-rijen "Laden · Rozenweg" / "Lossen · Rozenweg"** (07:30 / 15:00 in het ontwerp) ontbreken: ze bestaan niet in de data (alleen de taken zijn stops) → weggelaten, zoals de prompt voorschrijft.
2. **Tijdkolom** 2 px smaller/verschoven (`left:-66px;width:44px`): met 390 px breed overlapte de dot de "0" van "08:30".
3. **Onderbalk-knoppen** breken af over 2 regels i.p.v. te worden afgekapt ("Past niet / niet gevonden" paste niet op 390 px).
4. **Bulk-overlay** heeft één extra veld ("Hoeveel gaan NIET mee?"), anders is het aantal niet te geven; "tik voor aantal" opent daarom diezelfde overlay.
5. Het contactvak toont "geen nummer" als er wel een naam maar geen telefoon is (ontwerp kent alleen gevulde vakken).
6. "kampweek N" in de van-regel ontbreekt (niet in de data).

## Buiten mijn gebied (nodig om volle-run groen te houden)
- `scripts/test-keten-ophaling.mjs`, `test-v3a-keten.mjs`, `test-v3d-bulk.mjs`: 6 controles zochten tekst in de oude server-gerenderde rit-HTML (bv. "rit-pagina toont bak met code F40", `function toast(`). Omdat de pagina nu client-side tekent, zoeken ze nu in de HTML die `public/rit.js` uit `GET …/data` bouwt (nieuw hulpbestand `scripts/_rit-render.mjs`); inhoud van de controles ongewijzigd, `alert()`-controle zoekt nu `id="toast"`.

## GEVONDEN
- Contract-tegenstrijdigheid: de CH2-prompt zegt `niet-mee {aantal}` = aantal dat NIET mee gaat, de server (CH1) leest `aantal` als wat WEL mee gaat; de pagina vertaalt (totaal − niet-mee). In de data is `niet_mee.aantal` wél "niet mee".
- `design/CHAUFFEUR-DEFINITIEF.html` stond nu wel in de repo (C zag hem nog niet).
- `/rit/:token`, `/api/rit-token/*` en `/uploads` (foto's) staan achter de Basic-auth-muur zolang `APP_PASSWORD` gezet is; foto's van bakken laden dus alleen als de chauffeur die muur ook gepasseerd is — in productie checken met een echte telefoon (de rit-token zelf is geen wachtwoord).
- Gesplitste bulk-niet-mee heeft in de data geen eigen vlag; de pagina leidt "gesplitst" af uit `is_bulk && niet_mee.aantal > 0`.
- Tijdlijn toont taken-stops; "laden in de Rozenweg" als aparte stop bestaat enkel in het ontwerp.

# KV1 — KV-pagina (koerier-tabs + telscherm "✓ klopt / anders") (chat D, 2026-10-30)
Start 16:47. Commits op bouw-d (niet main, geen deploy.bat). Gewijzigd: `routes/kv.js`, `lib/migraties.js` (migratie 75), `public/kv.{html,css,js}` (nieuw), `scripts/test-kv1-pagina.mjs`, `OVERLEG-d.md`; in oude tests 2 kleine aanpassingen (zie "Buiten mijn gebied").

## Punt 1 — Data en API
- **Migratie 75** (enkel kolommen met defaults, geen backfill → geen vlag nodig): `nakijk_regels.te_veel REAL`, `kapot_aantal REAL`, `notitie TEXT`, `foto_path TEXT`; `kampmomenten.monitor_token TEXT`. `is_kapot` blijft en wordt bij elke opslag = `kapot_aantal > 0`.
- **`POST /api/kv/:token/bakken/:bakId/tellen`**: per regel naast `item_id`+`aangetroffen` ook `kapot_aantal`, `notitie`, `foto_data` (base64 → bestand via `lib/fotos.js`, soort `nakijk`; lege string verwijdert, ontbrekend = ongewijzigd). `te_veel` wordt server-side afgeleid (aangetroffen − verwacht). Velden die niet worden meegestuurd blijven staan (een "✓ klopt" wist dus geen notitie/kapot). Foto's worden eerst gevalideerd, dan pas wordt er geschreven.
- **`POST …/versturen`** mag onvolledig: bij elke gestarte bak krijgen de niet-getelde items een regel met `aangetroffen NULL` en opmerking "niet geteld" (zichtbaar in kantoor `GET /api/nakijk`).
- **Monitor-token**: `kampmomenten.monitor_token` (lazy aangemaakt bij de eerste data-call van de KV, zelfde opzet als `kv_token`). `/api/kv/:token/data`, `…/tellen` en `…/attributen/…/status` werken met beide tokens; `aanvraag`, `kapot` en `versturen` geven bij een monitor-token **403** met een Nederlandse uitleg.
- **`aanvraag` en `kapot`** nemen ook `aantal` en `foto_data`; de tekst wordt "10 × hesjes maat S".
- **Pagina's**: `GET /kv/:token` en `GET /tel/:token` (alleen met een monitor-token) serveren `public/kv.html` met css+js inline; foute token → nette 404-pagina.
- **JSON-vorm `GET /api/kv/:token/data`** (de monitor-stand geeft alleen de eerste blokken t/m `attributen`, plus `monitor:true`):
```
{ kampNaam, kampLocatie, week, dagen:{van,tot}|null, kvNaam, monitor:false,
  bakken:[{ id, soort, code, naam, ingediend, status:'nog_niet'|'ok'|'tekort'|'te_veel'|'kapot', geteld, aantal,
            items:[{ id, naam, gewenst, aangetroffen|null, te_veel, kapot_aantal, notitie, foto_url|null,
                     status:'nog_niet'|'ok'|'tekort'|'te_veel'|'kapot' }] }],
  attributen:[{ id, code, naam, status:'aanwezig'|'beschadigd'|null, uitslag:'nog_niet'|'ok'|'kapot' }],
  aanvragen:[{ …kolommen van aanvragen, antwoord (= reden van kantoor of ''), foto_url|null }],   // soort materiaal én kapot
  boodschappen:[{id,naam,qty}], meldingen_chauffeur:[{id,tekst,status,created_at,foto_data}],
  levering:{datum,tijd,chauffeur,stuks,status}|null, ophaling:{datum,tijd,chauffeur,stuks,status,deel}|null,
  kantoor:{telefoon}, locatie:{naam,adres,sleutel_info}, monitor_url:'/tel/<token>' }
```
Status-voorrang (bak en item): tekort > kapot > te_veel > ok; een bak is `ok` pas als alle items geteld zijn.

## Punt 2 — De pagina `/kv/:token` (exacte kopie van `design/KV-DEFINITIEF.html`)
- **Overzicht**: kop "<locatie> · week n" + "ma 2 – vr 6 nov · KV <naam>"; kaarten Levering (groen bij gedaan), Ophaling, Tellen n/m (met samenvatting van afwijkingen + "x bakken nog te tellen"), Aanvragen ("· n wacht op kantoor", oranje), Melding chauffeur, Boodschappen, elk aanklikbaar naar zijn tab; tabbalk 🏠 Overzicht · 🧮 Tellen n/m · 📩 Aanvragen n · ℹ️ Info.
- **Tellen**: bakkenlijst (code, naam, "n soorten · ⚠ <eerste tekort> x van y", pil ✓ ok / tekort / te veel / kapot of knop "Tellen"), "Telling versturen (n/m)" + hint.
- **Telscherm**: "‹ Tellen", kop "CODE · naam" + "7 van 8 geteld · 1 tekort · 1 te veel · 1 kapot"; per item "✓ <hoort>" (één tik → rij groen) of "anders" (uitklap: Geteld −/+ met "tekort: k"/"te veel: k"/"klopt", Kapot −/+ met 📷 en miniatuur, Notitie, Opslaan); kleuren groen/rood/blauw/oranje zoals het ontwerp; onderaan "Rest klopt ✓" en "Bak klaar".
- **Aanvragen**: 📩 Materiaal vragen / 💥 Kapot melden (overlay: stuk uit een bak kiezen of typen, tekst, aantal, foto, Versturen → toast "✓ Verstuurd naar kantoor"), "Mijn aanvragen" met status-pil en antwoord van kantoor, "Meldingen chauffeur".
- **Info**: boodschappen, monitor-link met Kopieer (klembord + toast), kantoor bellen (`tel:`), locatie met adres en sleutel-info.
- Na elke actie een verse `GET …/data`; `{error}` als toast; geen prompt/confirm/alert; 390 px zonder horizontale scroll, knoppen ≥ 44 px, desktop max. 480 px; `#bak-<id>` of `#tellen` in de URL herstelt het scherm; laatste stand blijft bij geen verbinding (localStorage).

## Punt 3 — Monitor-stand
`/tel/<monitor_token>`: dezelfde bestanden met `__KV_MONITOR=true`: tabbalk met enkel "🧮 Tellen n/m", geen versturen-knop of hint, geen aanvraag-overlay, geen sleutel-info/kantoor/aanvragen in de data (de server levert ze niet).

## Bewijs
- `node scripts/test-kv1-pagina.mjs` → **43 ok, 0 fout, ALLES GROEN** (eigen server 3343, herfst-test.db). Bak 1 = 8 items: 4× ✓ klopt, tekort 2 van 4 + notitie, te veel 8 van 6, kapot 2 + foto + notitie → bak-status `tekort`, kop "7 van 8 geteld · 1 tekort · 1 te veel · 1 kapot"; Rest klopt zet Tape op verwacht; bak 2 (5 items) 2 geteld → versturen → kantoor ziet 3 regels "niet geteld"; aanvraag met foto en kapot-melding bestaan; antwoord van kantoor verschijnt; chauffeur-melding verschijnt; monitor-data zonder aanvragen/sleutel; aanvraag/kapot/versturen met monitor-token 403, tellen mag; `/tel/` met KV-token 404; verkeerde token 404 (pagina) of 403 (API).
- **DOM-dump Overzicht** (echte data): `Abdijschool Vlierbeek · week 1 | ma 2 – vr 6 nov · KV Test KV Abdijschool | Levering gepland | maandag 2 nov · 14:00 · Jan · 2 stuks | Ophaling | nog niet gepland | Tellen · 0/4 bakken | 4 bakken nog te tellen | Aanvragen | Nog geen aanvragen | 🏠 Overzicht | 🧮 Tellen 0/4 | 📩 Aanvragen | ℹ️ Info`
- **DOM-dump Telscherm**: `‹ Tellen | KV01 · Kv1 bak een | 7 van 8 geteld · 1 tekort · 1 te veel · 1 kapot | Per stuk: tik ✓ als het aantal klopt… | Springtouw × 4 | ✓ 4 | tekort | 📝 twee zitten in de knoop | Hoepel × 6 | ✓ 6 | te veel | Pion × 10 …`
- **Echte browser 390×844** (in-app, poort 3304): Overzicht, Tellen, Telscherm met uitklap en de "Kapot melden"-overlay bekeken tegen het ontwerp; `scrollWidth` 390 op alle vier, geen knop < 44 px, console leeg. Schermafdrukken enkel in de browserpane gezien, niet als bestand bewaard.
- `node scripts/volle-run.mjs`: **19/19 groen** (17 bestaande + ko1-vandaag + kv1), 4 van 5 runs; één run gaf 18/19 zonder dat ik de rode test kon vastleggen (de herhaling was meteen weer 19/19; zie GEVONDEN). Let op: een werkmap-`sporty.db` waar ik server 3304 op heb laten draaien maakt `veiligheid` en `v3c-fotos` rood; ik heb de db daarna opnieuw uit sporty-railway gekopieerd.

## Afwijkingen van het ontwerp
1. De statuszin "Alles op wieltjes" in de Overzicht-kop ontbreekt: die zin bestaat niet in de data.
2. **Attributen** (A41/A12 in de Tellen-lijst) hebben in het ontwerp geen eigen telscherm; ik toon een mini-scherm met één rij "✓ 1 / anders" (= aanwezig / beschadigd) in dezelfde stijl.
3. Statusranden voor "te veel" (blauw) en "kapot" (oranje) ook op de bak-rijen (het ontwerp kent daar enkel groen/rood).
4. De leveringskaart toont "nog niet gepland" als er geen levering is; de secties Melding chauffeur, Boodschappen en Kantoor (en de Bel-knop) verdwijnen als de data leeg is.
5. De subtekst "maandag nakijken" bij Tellen is letterlijk uit het ontwerp overgenomen.

## Buiten mijn gebied
- `scripts/test-keten-kv-periode.mjs` (3 queries krijgen `AND nr.aangetroffen IS NOT NULL`, omdat een verstuurde telling nu ook "niet geteld"-regels bevat) en `scripts/test-f1-modules.mjs` (1 regel: `/tel/:token` invullen met `geen-token`).
- De oude KV-pagina (S3.5, "Blok 1–4", met alert()) is vervangen; `design-mockups/kv-scherm/…` niet aangeraakt.

## GEVONDEN
- Kantoor ziet "niet geteld" alleen voor bakken waaraan de KV al gestart is; een bak die nog helemaal niet aangeraakt is heeft geen nakijk-sessie en dus geen regels. Voorstel: kantoor-Nakijken de verwachte bakken zelf laten afleiden uit het kampmoment.
- `kantoor.telefoon` komt uit `app_vlaggen` met naam `kantoor_telefoon` (er is geen instellingentabel); zonder die vlag verdwijnt de Kantoor-sectie. Het nummer moet eenmalig gezet worden.
- `design/DESIGN-BRIEF.md` in de repo bevat nog geen "Scherm 4 — KV" (de prompt verwees ernaar); ik bouwde naar het ontwerpbestand en de prompt.
- `GET /api/kv/:token/data` maakt (lazy) een `monitor_token` aan: een GET die schrijft.
- Eén volle-run (18/19) met een niet-geïdentificeerde rode test, daarna 3× 19/19.
