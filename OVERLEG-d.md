
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

# VC1 — Voorraad & controles › Nakijken + aanvullijst (printlijst) (chat D, 2026-10-30)
Start 17:56. Commits op bouw-d (niet main, geen deploy.bat). Gewijzigd: `routes/nakijken.js` (nieuw; 1 regel in `server.js`), `lib/migraties.js` (migratie 76), `public/nakijken.{html,css,js}` + `public/aanvullijst-print.html` (nieuw), `public/vandaag.js` (alleen de tekorten-link), `scripts/test-vc1-nakijken.mjs`, `OVERLEG-d.md`; daarbuiten: 1 veld in `routes/kv.js` en 1 regel in `scripts/test-f1-modules.mjs` (zie "Buiten mijn gebied").

## Punt 1 — Data en API (`routes/nakijken.js`)
- **Migratie 76** (enkel kolommen met defaults): `nakijk_regels.kantoor_actie, kantoor_aantal, kantoor_notitie, aangevuld, aangevuld_door, aangevuld_op`; `nakijk_sessies.kantoor_afgerond_op, kantoor_door`.
- **`GET /api/nakijken?week=YYYY-MM-DD`** (alleen kantoor): alle verwachte bakken én attributen van de kampmomenten in die week (ook zonder sessie). Zonder `?week` en zonder treffer in de huidige week: de dichtstbijzijnde week met kampmomenten (`week.fallback:true`); met een expliciete week zonder kampmomenten een lege lijst.
```
{ week:{maandag,van,tot,weeknummer,fallback}, periode:{id,naam}|null,
  tellers:{te_keuren,niet_geteld,met_tekort,met_kapot,nagekeken},
  bakken:[{ sessie_id|null, kampmoment_id, locatie, week, kv_naam,
            bak:{id,code,naam,soort:'thema'|'vast'|'attribuut'}, geteld, totaal,
            uitslag_tekst:'✓ alles klopt'|'tekort 1 · te veel 1 · kapot 1'|'3 niet geteld'|'niet geteld'|'KV is bezig · 3/8 geteld',
            met_tekort, met_kapot, status:'te_keuren'|'niet_geteld'|'nagekeken', ingediend_op, nagekeken_op }] }
```
  `te_keuren` = de KV heeft verstuurd en er is minstens één stuk geteld; een telling die nog `bezig` is staat op `niet_geteld`.
- **`GET /api/nakijken/sessie/:id`** en **`GET /api/nakijken/bak?kampmoment_id=&bak=<soort>:<id>`** (bak zonder sessie): 
```
{ sessie_id|null, kampmoment_id, locatie, week, maandag, bak:{id,code,naam,soort}, geteld, totaal, uitslag_tekst, status,
  kv_naam, ingediend_op, nagekeken_op, afwijkingen:{tekort,te_veel,kapot},
  items:[{ regel_id|null, naam, verwacht, aangetroffen|null, te_veel, kapot_aantal, notitie, foto_url|null,
           afwijking:'klopt'|'tekort'|'te_veel'|'kapot'|'niet_geteld', aantal_afwijking,
           kantoor_actie, kantoor_aantal, kantoor_notitie, aangevuld,
           acties:[{waarde,label}] }],      // tekort: bestellen|uit_pool|aanvaarden · te_veel: naar_pool|laten_staan · kapot: afschrijven_bestellen|herstellen|aanvaarden
  foto_s:[{url,stuk}], vorige_tellingen:[{sessie_id,datum,locatie,week,uitslag,kv_naam}],
  historiek:[{tekst,wie,tijd}], contact:{kv_naam,kv_telefoon} }
```
  De historiek bevat de telling (ingediend, kapot + foto), de wijzigingen van kantoor (acties, afronden, aangevuld; uit de bestaande `wijzigingen`-log) en de rit-checks laden/lossen van de bak.
- **`PUT /api/nakijken/regel/:id`** `{kantoor_actie, kantoor_aantal, kantoor_notitie}` (gevalideerd, gelogd via `updateMetLog`).
- **`POST /api/nakijken/sessie/:id/afronden`**: vult voor elke afwijking zonder keuze de eerste optie in, zet `kantoor_status='nagekeken'` + `kantoor_afgerond_op`/`kantoor_door`, en markeert regels met `bestellen`/`afschrijven_bestellen` met de bestaande bestel-markering van `routes/voorraad.js` (`besteld=1, tekort_status='besteld'`; er bestaat geen aparte bestelregel-tabel). 409 als de KV nog niet verstuurd heeft. **`POST /api/nakijken/afronden`** `{sessie_ids:[]}` doet dit in bulk en geeft `{afgerond[], overgeslagen[]}`.
- **`POST /api/nakijken/herinnering`** `{kampmoment_id}` en **`POST /api/nakijken/notitie`** `{kampmoment_id, tekst}` → `activiteiten_log` + `aanvragen`-rij (soort `herinnering_kv` / `notitie_kantoor`), zichtbaar in `GET /api/kv/:token/data` als `meldingen_kantoor[]` (niet in `aanvragen[]` van de KV).
- **`GET /api/aanvullijst?datum=YYYY-MM-DD[&alles=1]`** (elke ingelogde rol; contract voor de gsm-versie):
```
{ datum, afgedrukt_door, tellers:{totaal,uit_pool,bestelling,klaar,bakken},
  bakken:[{ sessie_id, bak:{id,code,naam,soort}, locatie, week, plaats:{rek,plank,tekst:'rek N'}, afgerond_op,
            handelingen:[{ regel_id, stuk, aantal, soort:'uit_pool'|'naar_pool'|'afschrijven'|'bestelling'|'nakijken', waar_tekst, aangevuld:0|1 }] }] }
```
  `uit_pool` ← uit_pool, `naar_pool` ← naar_pool, `afschrijven` ← afschrijven_bestellen, `bestelling` ← bestellen, `nakijken` ← herstellen én elk stuk dat de KV niet telde ("zelf tellen"); aanvaarden/laten_staan geven geen handeling. Afgevinkte handelingen verdwijnen (`?alles=1` houdt ze). Plaats: `bakken` heeft geen rek/plank-kolommen → rek = eerste letter van de bakcode, plank leeg.
- **`POST /api/aanvullijst/:regelId/aangevuld`** `{aangevuld:true|false, foto_data?}`: bewaart wie/wanneer (`aangevuld_door/op`), logt op naam in `wijzigingen` én `activiteiten_log`, bewaart een meegestuurde foto (pad in het log).

## Punt 2 — `/nakijken` (alleen kantoor)
Exacte kopie van `design/mockup-voorraad-nakijken.html`: bovenbalk, subbalk (Nakijken · Tekorten n · Bestellingen n · Voorraad · ⬇ Export · 🖨 Printlijst), zoekveld + chips (Te keuren · Niet geteld · Met tekort · Met kapot · Nagekeken · Week), lijst met selectievakjes en bulk-voet (Keuring afronden · Herinnering naar KV · Printlijst), detail met kop (pils tekort/te veel/kapot), knoppen Bak openen · Foto's n (overlay) · KV bellen (`tel:`) · Keuring afronden ✓, tabbladen Telling · Vorige tellingen n · Historiek n, tabel per stuk met een select per afwijking (wijzigen = meteen `PUT`), onderregel met bestellingen/afschrijvingen en "Notitie aan KV" (overlay). `?sessie=ID` en `?kampmoment_id=&bak=thema:ID` openen het detail (en springen naar de juiste week). `{error}` als toast; geen prompt()/confirm().
In `public/vandaag.js` verwijst alleen de link "Open" bij tekorten nu naar `/nakijken`.

## Punt 3 — `/aanvullijst-print?datum=`
Exacte kopie van de A4 uit `mockup-aanvullen-gsm.html`: kop, tabel (✓ · Bak · plaats · Stuk · Aantal · Wat · Waar / opmerking · Gedaan door) met ☐-vakjes en de bak enkel op de eerste rij, voettekst; `@media print` zonder balk, `@page` A4 staand met "pagina x van y", herhaalde tabelkop, knop 🖨 Afdrukken buiten de print.

## Bewijs
- `node scripts/test-vc1-nakijken.mjs` → **46 ok, 0 fout** (eigen server 3344, herfst-test.db): 3 bakken (8/5/1 items) → vóór het tellen 3× `niet_geteld` zonder sessie; na KV-telling NK01 `te_keuren` ("tekort 1 · te veel 1 · kapot 1", 8/8), NK02 `te_keuren` ("3 niet geteld", 2/5), NK03 `niet_geteld`; detail met afwijkingen, foto-url, notitie, acties exact als de mockup; PUT bestellen/naar_pool/afschrijven_bestellen, onbekende actie 400; afronden → `nagekeken` + 2 bestel-markeringen (bestaande logica); aanvullijst gegroepeerd per bak met 3 handelingen (+3 "nakijken" voor NK02); afvinken verwijdert uit de lijst, log op naam, terugzetten; herinnering + notitie zichtbaar in kv-data; `/nakijken` 200 met subbalk, `/aanvullijst-print` 200 met tabel en `@media print`; DOM-bouw van lijst/detail/printrijen met de echte data; chauffeur 403 op nakijken (GET en PUT), 200 op aanvullijst; zonder login geen aanvullijst.
- **DOM-dump lijst**: `Te keuren 0 | Niet geteld 6 | Met tekort 1 | Met kapot 1 | Nagekeken 2 | ‹ | Week 1 | › | Locatie · KV | Bak | Geteld | Uitslag | Status | Betekom | wk 1 · Test KV Betekom | F40 Themabak zwarte curver | 0/23 geteld | niet geteld | niet geteld …`
- **DOM-dump detail**: `NK01 · Nk bak een · Abdijschool Vlierbeek | week 1 · geteld door KV Test KV Abdijschool, ingediend … · 8 van 8 stuks | tekort 1 | te veel 1 | kapot 1 | Bak openen | Foto's 1 | KV bellen | Keuring afronden ✓ | Telling | Vorige tellingen 0 | Historiek 9 | Telling KV vs. verwacht · kies per afwijking wat kantoor doet | Stuk | Hoort | Geteld | Afwijking | Notitie KV | Actie kantoor …`
- **Echte browser 1920×900** (in-app, poort 3304, met een KV-telling van N09 uit de mockup: springtouw −2, hoepel +2, pion 2 kapot): lijst met chips en rij "N09 … 5/5 geteld · tekort 1 · te veel 1 · kapot 1 · te keuren"; klik → detail zoals de mockup; select Hoepel → "Laten staan" = `PUT /api/nakijken/regel/293` + toast "✓ Opgeslagen" + historiek-regel; "Keuring afronden ✓" = `POST …/sessie/24/afronden` + toast "✓ Keuring afgerond · 2 bestelling(en)", status in de lijst op nagekeken; `/aanvullijst-print` toont de 2 handelingen (bestelling, afschrijven) met `@page`/`@media print`-regels aanwezig (print-preview zelf niet kunnen emuleren). `scrollWidth` = 1920, geen console-fouten behalve de bedoelde 404 van een test met een onbestaande `?sessie=1`. Schermafdrukken enkel in de browserpane gezien.
- `node scripts/volle-run.mjs` 2× → **21/21 groen** (eerste run 20/21: `f1-modules` wilde de nieuwe route `/api/nakijken/sessie/:id` ingevuld zien; 1 regel toegevoegd).

## Afwijkingen van het ontwerp
1. **"Week 1"-chip**: tussen twee kleine chips ‹ › om van week te wisselen (de mockup toont enkel het label).
2. **Historiek zonder "↶ Terug"-knoppen**: een generieke undo van alle gelogde acties is een eigen onderwerp; wel is alles gelogd (wie/wanneer) en elke kantoor-actie is gewoon opnieuw te kiezen.
3. **Aanvaarden/laten staan** geven in de aanvullijst geen handeling (er valt niets aan te vullen); `herstellen` verschijnt als "nakijken".
4. **Bak openen** springt naar `/#materiaal?bak=<id>` (de bestaande SPA kent die deep-link nog niet: opent Materiaal).
5. Geen `public/patroon.css` van chat C op main → eigen `nakijken.css` met dezelfde patroonregels (zie GEVONDEN).

## Buiten mijn gebied
- `routes/kv.js`: één veld `meldingen_kantoor` in de kv-data (nodig voor "zichtbaar in de kv-data" bij herinnering/notitie); de KV-pagina toont het nog niet (staat niet in het ontwerp).
- `scripts/test-f1-modules.mjs`: 1 regel die `/api/nakijken/sessie/:id` invult.

## GEVONDEN
- `public/patroon.css` (TR1) ontbreekt nog: `nakijken.css` bevat de patroonregels van de mockup; de hoofdchat kan die met `ritplanning.css`/`vandaag.css` samenvoegen.
- Er is geen aparte bestelregel-tabel: "bestellen" betekent in de bestaande code enkel `nakijk_regels.tekort_status='besteld'` (+ `besteld=1`). De subtab "Bestellingen" linkt daarom naar hetzelfde tekorten-scherm van de oude SPA (`/#materiaal?tekorten`). Een echte bestellijst (leverancier, levering "komt wo") bestaat nog niet; de printlijst zegt nu "bestelling · wacht op levering".
- `bakken` heeft geen rek/plank-velden; de aanvullijst leidt "rek N" af uit de code. Voor "pool: rek P, bak P-03" (mockup) is een pool-locatie per stuk nodig (item_type_stock per locatie bestaat wel).
- Een attribuut dat de KV als beschadigd meldt krijgt geen `nakijk_regel` en dus geen kantoor-actie/aanvul-handeling; kantoor ziet het wel in de lijst ("kapot") maar kan er geen actie aan hangen.
- Tellers/lijst zijn per kampmoment: een thema met bakken op meerdere kampmomenten in dezelfde week verschijnt per locatie apart (zoals de KV's het zien).
- Een door mij gebruikte werkmap-`sporty.db` (server 3304 erop) laat `veiligheid`/`v3c-fotos` rood worden; ik kopieerde de db opnieuw uit sporty-railway vóór de volle run.

# TB1 — Transport beheren compleet: bundelen, ontkoppelen, splitsen, kapotte attributen, één patroon-CSS (chat D, 2026-10-30)
Start 18:27. Commits op bouw-d (niet main, geen deploy.bat). Gewijzigd: `routes/transport.js`, `routes/kv.js`, `routes/nakijken.js`, `public/taken.{html,js}`, `public/kv.js`, `public/nakijken.{html,css}`, `scripts/test-tb1-transport.mjs`, `OVERLEG-d.md`; daarbuiten kleine ingrepen in `routes/locaties.js` en `routes/ritplanning.js` (zie "Buiten mijn gebied").

## Punt 1 — Bundelen
- **`POST /api/transport-taken/bundel {taak_ids}`** (alleen kantoor). Voorwaarden, telkens met een Nederlandse uitleg (409): zelfde datum, zelfde soort, zelfde bestemming (bij ophaling de van-locatie), niet gedaan/geannuleerd, niet op verschillende ritten, niets geladen (de uitleg noemt welke taak). Eén taak → 400, onbekende taak → 404.
- **Blijvende taak**: de oudste taak **die op een rit staat**, anders de oudste. (De prompt zegt "de oudste blijft" én "de rit van de blijvende taak blijft"; wanneer één van drie op een rit staat moet die blijven, anders ging de rit verloren.) De tijd wordt de vroegste tijd; de opmerking krijgt "gebundeld met #a, #b".
- Regels (`transport_regels.taak_id`) en checks (`verhuis_checks.taak_id`, `rit_id` van de blijvende taak) verhuizen; de andere taken krijgen status `geannuleerd`, `rit_id`/`volgorde` leeg en opmerking "— gebundeld in #<id>" (niet verwijderd). Alles via `updateMetLog` (context `bundelen in #id`) en één `activiteiten_log`-regel.
- **`/taken`**: de knop Bundelen is actief vanaf 2 geselecteerde taken, vraagt een bevestiging en toont bij een fout de servertekst als toast; na afloop opent het detail van de blijvende taak.

## Punt 2 — Ontkoppelen zonder dataverlies
- Eén functie `_ontkoppelTaak` in `routes/transport.js` (ook als `ctx._ontkoppelTaak`): rit weg, `wie` leeg, `volgorde` leeg, checks los van de rit (`rit_id=0`); **datum en tijd blijven staan**, 409 met uitleg als er al iets geladen is.
- Gebruikt door: `PUT /api/transport-taken/:id/rit` met `rit_id:null` (route verhuisd van `routes/locaties.js` naar `routes/transport.js`; koppelen aan een rit synchroniseert nu ook de checks), `POST /api/transport-taken/bulk-ontkoppel` (eerst alles controleren: één geladen taak → 409 en niets gewijzigd) en de ritplanning-✕ (`POST /api/ritten/:id/taken/:taakId/ontkoppel`).

## Punt 3 — Splitsen met echte stops
- Bewezen met een taak van 3 regels op een rit: 1 regel afsplitsen naar een andere datum → nieuwe taak zonder rit met die regel en haar check (`rit_id 0`), oude taak houdt 2 regels, de rit-checks dalen 3→2 en de bezetting in de ritplanning 3→2.
- **Gevonden en hersteld**: de splits-route liet het afsplitsen van een **geladen** regel toe. Nu 409 ("'<stuk>' is al geladen: een geladen regel kan niet afgesplitst worden …"). Álle regels afsplitsen blijft 400 (bestond al).

## Punt 4 — Kapot attribuut + berichten van kantoor op de KV-pagina
- `POST /api/kv/:token/attributen/:attrId/status` met `beschadigd` maakt nu ook een `nakijk_regel` in de attribuut-sessie (item_naam = attribuutnaam, verwacht 1, aangetroffen 1, kapot_aantal 1, `is_kapot` 1; geen dubbele bij herhaling). Terug op `aanwezig`: de regel verdwijnt als kantoor er nog niets mee deed, anders blijft hij staan met kapot 0.
- `routes/nakijken.js`: het detail van een beschadigd attribuut geeft `regel_id`, `kantoor_actie` en de kapot-acties (afschrijven + bestellen · herstellen · aanvaarden); afronden en aanvullijst werken er zonder verdere wijziging op (handeling "afschrijven").
- `public/kv.js`, tab Aanvragen: sectie **"Berichten van kantoor"** (herinnering/notitie, uit `meldingen_kantoor`) onder "Mijn aanvragen", zelfde stijl als "Meldingen chauffeur"; verdwijnt als er geen berichten zijn.

## Punt 5 — Eén patroon-CSS
- `nakijken.html` laadt `patroon.css` vóór `nakijken.css`; uit `nakijken.css` zijn reset, `.pil`-basis, `.knop`-basis (+ licht/klein), bovenbalk, subbalk-basis en toasts verdwenen (het bestand telt 42 i.p.v. 50 regels; wat overblijft zijn de afwijkingen: body-achtergrond, knop als flex-inline, `.scroll` zonder padding, de pil-kleuren en de eigen kaart/lijst/detail-regels).
- **Bewijs beeld ongewijzigd**: computed-style-hash over alle 165 elementen van `/nakijken` met geopend detail (N09, 1920×900, demo-telling) vóór en na: **0 verschillen** (totaalhash `96f773b2` = `96f773b2`). Enige bekende verschil buiten de hash: de toasts zijn nu die van `patroon.css` (13 px, max 320 px breed) i.p.v. de eigen.

## Bewijs
- `node scripts/test-tb1-transport.mjs` → **42 ok, 0 fout** (eigen server 3345, herfst-test.db): bundelen (400/409 andere bestemming/dag/ritten/geladen/geannuleerd, geslaagd met 5 regels op de rit, 2 geannuleerd "gebundeld in", checks mee, log + wijzigingen, twee taken op dezelfde rit), ontkoppelen (PUT null, bulk, ritplanning-✕: datum blijft, geladen → 409, niets gewijzigd), splitsen (scenario + geladen → 409 + alles → 400), kapot attribuut → regel → Nakijken-select → afronden → aanvullijst → terug op aanwezig, berichten van kantoor op de KV-pagina (DOM-bouw met echte data), patroon.css-volgorde, knop Bundelen.
- `node scripts/volle-run.mjs` 2× → **23/23 groen**.
- Niet live geklikt: de knop Bundelen in `/taken` (bewezen via de route-test en door de code van de knop te controleren, niet in de browser) en de KV-sectie "Berichten van kantoor" (bewezen via de DOM-bouw).

## Buiten mijn gebied (nodig voor Punt 2)
- `routes/locaties.js`: de route `PUT /api/transport-taken/:id/rit` is eruit gehaald (staat nu in `transport.js`; anders won de oude versie omdat `locaties` eerst geladen wordt).
- `routes/ritplanning.js`: de ritplanning-✕ roept `ctx._ontkoppelTaak` aan i.p.v. zijn eigen kopie van de logica (gedrag en foutteksten ongewijzigd).

## GEVONDEN
- De oude `bulk-ontkoppel` had een voorwaarde `spoed_kind != '1'` die nooit werkte (het veld bevat tekst, nooit '1'); ze is weggevallen.
- Een geannuleerde (gebundelde) taak blijft in `GET /api/transport-taken` staan; schermen die alle taken tonen moeten op `status` filteren (de Vandaag-, Ritplanning- en Taken-schermen doen dat al of tonen hem als geannuleerd).
- Bundelen werkt niet over ritten heen en ook niet voor taken die al aangekomen zijn; wie dat wil, moet eerst ontkoppelen. Een gebundelde taak terugzetten kan enkel via Splitsen (de regels van de geannuleerde taken zijn verhuisd).
- Het detail-scherm van een attribuut in Nakijken toont de foto van de KV niet (attributen hebben geen foto-veld in `nakijk_regels` voor deze melding).

# PL1 — Planning › Kampmomenten op het standaardpagina-patroon (chat D, 2026-10-30)
Start 18:45. Commits op bouw-d (niet main, geen deploy.bat). Gewijzigd: `routes/kampmomenten.js` (nieuw; 1 regel in `server.js`), `lib/migraties.js` (migratie 77), `public/kampmomenten.{html,css,js}` (nieuw; laadt `patroon.css`), `public/vandaag.js` (alleen de links), `scripts/test-pl1-kampmomenten.mjs`, 1 regel in `scripts/test-f1-modules.mjs`, `OVERLEG-d.md`. Bestaande API's zijn niet gewijzigd.

## Punt 1 — Data en API
- **Migratie 77** (enkel kolommen met defaults): `kampmomenten.aantal_kinderen`, `aantal_kleuters`, `aantal_monitoren` (INTEGER), `kookdagen` (TEXT, "wo,do"), `kv_link_gestuurd` (INTEGER). De **opmerking** gebruikt de bestaande kolom `kampmomenten.notities` (er is dus geen tweede kolom `opmerking`).
- **`GET /api/kampmomenten-overzicht?periode_id=&week=`** (alleen kantoor):
```
{ periode:{id,naam,start_datum,eind_datum,max_weken},
  tellers:{totaal, per_week:{"1":5}, zonder_thema, zonder_kv, conflict},
  kampmomenten:[{ id, locatie:{id,naam}, week, periode_id, maandag, dagen_tekst:"wk 1 · ma 2 – vr 6 nov", dagen:[7×bool ma..zo],
                  type:'kamp'|'themadag', themas:[{id,kt_id,naam,leeftijdsgroep,dag|null}], thema_tekst:"Alles op wieltjes"|"— geen thema"|"5 themadagen",
                  kv:{id,naam,telefoon,link_gestuurd}|null, transport_tekst:"levering vr 30 okt ✓ · ophaling ma 9 nov zonder rit"|"—",
                  status:'ok'|'let', aandacht:[tekst…], conflict:bool, zoek }] }
```
  Aandacht: "geen thema", "geen KV", "thema dubbel: <thema> (met <locatie> wk n)", "levering zonder rit" en de conflicten van de bestaande detector met ernst `hoog` (de detector geeft enkel tekst; ze worden aan het kampmoment gekoppeld via locatienaam + week). "Nog geen levering/ophaling" zijn geen conflicten (staan in `transport_tekst`). `dagen`: werkdagen standaard open, weekend standaard dicht, `kalender_dagen`/`gesloten_dagen` bepalen de rest; datums buiten de periode tellen niet mee.
- **`GET /api/kampmomenten/:id/detail`**: alles van de rij plus
```
{ groep:{kinderen,kleuters,lager,monitoren}, kookdagen:['wo','do'], oven_mee, heeft_eigen_oven, opmerking, locatie_adres,
  themas_beschikbaar:[{id,naam,leeftijdsgroep,gekozen}], themas_bezet:[{id,naam,bij}],      // thema's die in die week elders gepland zijn staan NIET in beschikbaar
  materiaal:[{thema_id,thema,items:[{naam,code,soort:'bak'|'attribuut'}]}],
  transport:[{id,type,datum,tijd,wanneer_tekst,status,rit:{id,chauffeur,status}|null,wat,regels}],
  aanvragen_open:[{id,soort,tekst,status,created_at}], conflicten:[{type,ernst,bericht}],
  historiek:[{tekst,wie,tijd}], dagen_datums:[7 datums] }
```
  Historiek = `wijzigingen` van het kampmoment (KV gekoppeld, kookdagen, groep, opmerking, KV-link, week/soort) + `activiteiten_log` van die locatie en week.
- **`PUT /api/kampmomenten/:id/velden`** `{dagen[7], kookdagen[], aantal_kinderen, aantal_kleuters, aantal_monitoren, opmerking}` (alleen kantoor; elk veld optioneel; 400 bij ongeldige kookdag, niet-7 dagen, aantallen buiten 0–999 of meer kleuters dan kinderen; gelogd via `updateMetLog` + `activiteiten_log` voor de dagen).
- **`POST /api/kampmomenten/kv-links`** `{ids[]}` → `{links:[{id,locatie,week,kv_naam,telefoon,url,volledig}], fouten:[{id,locatie,week,reden}]}`; maakt ontbrekende tokens en zet `link_gestuurd`. Een kampmoment zonder KV komt in `fouten`.
- **`POST /api/kampmomenten/genereer-transport`** `{ids[]?, periode_id?}`: roept de bestaande generator (`POST /api/transport-genereer`, levert voorstellen) aan, filtert op de selectie (of de hele periode) en maakt er taken van via de bestaande `POST /api/transport-taken` (met datum, nog zonder rit); dubbels worden overgeslagen. → `{aangemaakt, gemaakt[], overgeslagen, kampmomenten}`.
- **`POST /api/kampmomenten/verwijderen`** `{ids[]}`: 409 als er al iets geladen is (er wordt dan niets verwijderd), anders thema's, taken en kampmoment weg (gelogd). Dit is nieuw omdat `DELETE /api/kampmomenten/:id` geen bewaking heeft (zie GEVONDEN).

## Punt 2 — `/kampmomenten` (alleen kantoor)
Exacte kopie van `design/mockup-planning.html`: bovenbalk (Planning actief), subbalk Kampmomenten · Rooster · Periodes · Thema's per week + ⬇ Export · ⚙ Genereer transport · + Kampmoment; zoekveld en chips (periode · week n · ⚠ zonder thema · ⚠ zonder KV · conflict); lijst met selectievakjes en bulk-voet (Genereer transport · KV-links sturen · Thema toewijzen · Verwijderen); detail met kop (locatie, week, dagen, KV, groep, status-pil), knoppen Bewerken · 📍 Locatie · KV-link · Thema kiezen, tabs Gegevens · Thema & materiaal · Transport n · Telling · Historiek n; dagen-knoppen en kookdagen (tik = meteen `PUT velden`), groep en opmerking bewerkbaar (bewaren bij verlaten van het veld), transport voor dit kampmoment met Open → `/taken?taak=`, conflicten & aandacht met knoppen (Kies thema / KV koppelen / Open), historiek. Overlays (eigen vraagModal, geen prompt/confirm): + Kampmoment / Bewerken, Thema kiezen (per leeftijdsgroep, themadag: per dag; bulk: enkel thema's die voor alle gekozen kampmomenten vrij zijn), KV koppelen, KV-links met kopieerknoppen, Genereer transport, Verwijderen. `?id=` opent dat detail, `?week=` filtert. `{error}` als toast.
- `public/vandaag.js`: een rij in "Deze week" opent nu `/kampmomenten?id=…` en de melding "kampmoment zonder thema" (planning-melding) opent `/kampmomenten`.

## Bewijs
- `node scripts/test-pl1-kampmomenten.mjs` → **37 ok, 0 fout** (3× herhaald; eigen server 3346, herfst-test.db): tellers (totaal, per week, zonder thema/KV, conflict), zonder thema/KV → `status let` + aandacht, `dagen[7]` en `dagen_tekst` ("wk 1 · ma 2 – vr 6 nov"), `?week=` filter, thema dubbel → aandacht op beide + `themas_beschikbaar` sluit het thema uit (en `themas_bezet`), `PUT velden` (dagen, kookdagen, groep 24/10/14/2, opmerking, gelogd; 400's; weekend aanzetten), kv-links (1 link, 1 fout "er is nog geen KV gekoppeld", link werkt, `link_gestuurd` true), genereer voor de selectie (2 taken, enkel dat kampmoment, `transport_tekst` "—" → "levering vr 30 okt zonder rit · ophaling ma 9 nov zonder rit", tweede keer niets dubbel), detail (transport, conflicten, aanvragen_open, materiaal, historiek), verwijderen met geladen stuk → 409 en niets weg, na terugdraaien wel, `/kampmomenten` 200 met subbalk/chips/voet/patroon.css, DOM-bouw van chips, lijst en detail met de echte data, chauffeur → 403 op alle nieuwe routes, zonder login geen overzicht.
- **DOM-dump lijst**: `Abdijschool Vlierbeek | wk 1 · ma 2 – vr 6 nov | Holderdebolder | Test KV Abdijschool | levering vr 30 okt zonder rit · ophaling ma 9 nov zonder rit | ⚠ let op | Boudewijnstadion | wk 1 · ma 2 – za 7 nov | 1001 Ballen en Bellen | — geen KV | kookdag…`
- **DOM-dump detail**: `Boudewijnstadion · week 1 | ma 2 – za 7 nov · geen KV · 24 kinderen · 2 monitoren · ⚠ geen KV | Bewerken | 📍 Locatie | KV-link | Thema kiezen | Gegevens | Thema & materiaal | Transport 0 | Telling | Historiek 7 | Kampmoment | Dagen | ma | di | w…`
- **Echte browser 1920×900** (in-app, poort 3304, 5 demo-kampmomenten in 2 weken): lijst met chips (Zomer 2026 · 5, Week 1 · 3, Week 2 · 2, ⚠ Zonder thema, ⚠ Zonder KV, Conflict) en rijen met ⚠ let op en de dubbel-melding; detail Betekom: zaterdag-knop → `PUT /api/kampmomenten/168/velden {"dagen":[true,true,true,true,true,true,false]}` en knop wordt actief; kookdag do aan; "Thema kiezen" opent de overlay met alle vrije thema's per leeftijdsgroep (183), keuze → `POST /api/kampmomenten/168/themas {"thema_id":4160,"leeftijdsgroep":"kleuters"}` + toast "✓ Thema opgeslagen"; rij aanvinken → bulk-voet verschijnt, "KV-links sturen" toont de overlay met link en Kopieer-knop. Eerste weergave had te brede labels in de detailtabel (dagen onder elkaar); opgelost met `.kv b span{width:auto}`. Schermafdrukken enkel in de browserpane gezien.
- `node scripts/volle-run.mjs` 2× → **24/24 groen** (eerste run 23/24: `f1-modules` wilde de nieuwe route `/api/kampmomenten/:id/detail` ingevuld zien; 1 regel toegevoegd).

## Afwijkingen van het mockup
1. **Historiek zonder "↶ Terug"-knoppen** (zoals bij Nakijken): een generieke undo is een eigen onderwerp; alles staat wel gelogd met wie en wanneer.
2. **Groep en opmerking** zijn invoervelden (kinderen / waarvan kleuters / monitoren, opmerkingveld) i.p.v. een vaste zin, omdat de prompt "bewerkbaar" vraagt; de samenvatting "24 kinderen · 2 monitoren" staat in de kop.
3. De pil in de detailkop toont bij meer dan één aandachtspunt "n aandachtspunten" i.p.v. de eerste tekst.
4. Subbalk-links Rooster · Periodes · Thema's per week verwijzen naar de bestaande tabbladen van de oude SPA (`/#overzicht?rooster`, `/#overzicht?periodes`, `/#kampplanner`); die kennen de deep-link nog niet en openen gewoon de juiste hoofdpagina.
5. "Telling" is een verwijzing naar `/nakijken?week=<maandag>` (de pagina kent `?kampmoment_id=` enkel samen met een bak).

## Buiten mijn gebied
- `scripts/test-f1-modules.mjs`: 1 regel die `/api/kampmomenten/:id/detail` invult.

## GEVONDEN
- `DELETE /api/kampmomenten/:id` (bestaand) verwijdert ook de taken van het kampmoment zonder te controleren of er al iets geladen is; de pagina gebruikt daarom de nieuwe route. De oude route zou dezelfde bewaking moeten krijgen (andere bouwchat: routes/planning.js).
- `POST /api/transport-genereer` levert voorstellen en maakt zelf geen taken; de knop "Genereer uit planning" in `/taken` toont "Taken gegenereerd" na alleen die aanroep en maakt dus niets aan. De generator werkt voor álle kampmomenten; mijn route filtert op de selectie maar rekent dus wel alles door (traag bij veel kampmomenten).
- De conflictdetector geeft geen kampmoment-id's; koppeling aan een kampmoment gebeurt via de tekst (locatienaam + "Week n" of "@n"). Een gestructureerd veld (`kampmoment_ids`) zou dit robuuster maken.
- Een thema met `leeftijdsgroep` leeg verschijnt in de overlay onder "overig"; bij koppelen wordt dan een lege leeftijdsgroep opgeslagen.
- De herfst-testperiode heeft maar één week; voor "weken" met datums buiten de periode geeft `dagen` altijd `false` (en dagen_tekst "geen open dagen").

# GF1 — Gaten uit de generale repetitie dichten (chat D, 2026-10-30)
Start 19:44. Commits op bouw-d (niet main, geen deploy.bat, nooit `--doel=prod`). Nummers verwijzen naar GEVONDEN in het GR1-verslag (OVERLEG-c.md).
Gewijzigd: `routes/transport.js`, `routes/vandaag.js` + `public/vandaag.js`, `routes/kv.js`, `public/ritplanning.js` (de weekend-bevestiging; `routes/ritplanning.js` bleef ongewijzigd), `lib/migraties.js` (migratie 78), `scripts/generale-repetitie.mjs`, `scripts/test-gr1-keten.mjs`, `scripts/test-gf1-gaten.mjs`, `OVERLEG-d.md`; daarbuiten kleine ingrepen in `lib/auth.js`, `lib/gedeeld.js`, `routes/nakijken.js` en `scripts/test-f1-modules.mjs` (zie "Buiten mijn gebied").

## Per gat

| Gat | Wat er veranderde | Bewijs |
|---|---|---|
| **2 (kritiek) — rest-taak zonder datum** | Een rest-taak ("past niet") krijgt `datum` = datum van de rit en `week` = kampweek (van de taak, anders van het kampmoment, anders afgeleid uit de datum; vóór de periode = week 1). **Migratie 78** (gegate op `migratie78_klaar`) vult bestaande rest-taken zonder datum uit hun `rest_van_rit_id`. | `test-gf1-gaten`: rest-taak #197 heeft datum 2026-11-02, week 1, staat in `/api/taken-overzicht` en op Vandaag › Inplannen (🚚). `test-gr1-keten` stap 2: datum = vr 30 okt, week ≥ 1. |
| **1 — Vandaag toont ritten van morgen** | `GET /api/vandaag` heeft naast `ritten_vandaag` ook `ritten_morgen` (zelfde rijvorm). `public/vandaag.js` toont onder het vak "Ritten vandaag" een kopje "Morgen · n" met dezelfde rijstijl (inhoud erbij, geen nieuw vak). | `ritten_morgen` bevat de rit van morgen en niet de ritten van vandaag; ketentest stap 1: de 4 leveringsritten staan onder "Morgen". |
| **4 — Vandaag › Nakijken** | Twee nieuwe regels: "N telling(en) te keuren" (KV verstuurd, nog niet nagekeken) en "M bakken niet geteld van kampweek n" (alle verwachte bakken en attributen van de laatste voorbije kampweek zonder telling, ook zonder sessie), elk met Open → `/nakijken`. | `test-gf1-gaten`: "1 telling te keuren" (Open → /nakijken) en na de kampweek (datum 10 nov) "10 bakken niet geteld van kampweek 1"; ketentest stap 5: "65 tellingen te keuren". |
| **12 — KV-tellingen in de historiek** | Alle schrijfacties van de KV-routes (tellen, attribuut-status, versturen, aanvraag, kapot, "niet geteld"-regels) lopen via `insMetLog`/`updateMetLog`/`delMetLog` met context `kv-link` en de KV-naam als `wie` ("Evy (KV)"). Nakijken › Historiek toont ze (geteld x → y, telling verstuurd door de KV). | `wijzigingen` heeft de regels met `persoon_naam` "… (KV)"; historiek-controle; ketentest stap 4: **410** wijzigingsregels i.p.v. 3. |
| **5 — coördinator met pincode** | Rol `coordinator` bestaat nu volledig: `POST/PUT /api/personeel` accepteert ze, pincode zetten werkt (bestond voor elke rol), de coördinator staat in het loginscherm (`personeel-lijst-login`), `bestuurder_rol` van een rit wordt `coordinator`. `GET /api/vandaag?mijn=1` (alleen voor ingelogde niet-KV): eigen ritten (vandaag/morgen, met rit-token) en het aantal open aanvul-handeling; zonder `mijn=1` en op andere kantoorroutes 403. | `test-gf1-gaten`: aanmaken, loginlijst, login, `bestuurder_rol` "coordinator", 200 aanvullijst, 403 op vandaag/nakijken/kampmomenten/bundelen, `?mijn=1` → 200 met enkel de eigen rit. Ketentest stap 6: de coördinator vinkt de 3 handelingen af op eigen naam (`aangevuld_door`). |
| **6 — weekend-bevestiging bewaard** | Kolommen `weekend_bevestigd_door`/`_op` op `transport_taken` (migratie 78); `POST /api/transport-taken/:id/weekend-bevestig` (alleen kantoor, 400 op een niet-weekendtaak, gelogd). De rit-waarschuwingen blijven `"weekend"` en krijgen erbij `"weekend · nog niet bevestigd"` of `"weekend · bevestigd door <naam>"`. De ritplanning-pagina roept de route aan na de vraagModal (taak aan rit zetten én nieuwe weekendrit) en toont ✓/⚠ met die tekst. | `test-gf1-gaten` en ketentest stap 7: eerst "nog niet bevestigd", na bevestigen "bevestigd door Claude (API)" (naam en tijdstip bewaard), coördinator → 403. |
| **8 — opruimen volledig** | Nieuwe route `POST /api/kampmomenten/:id/volledig-verwijderen` (alleen kantoor, gelogd, 409 bij geladen stukken): wist taken + regels + checks, KV-tellingen (sessies + regels + foto's), aanvragen/meldingen, kalenderdagen van die week, thema-koppelingen en het kampmoment. Het seed-script gebruikt haar. | `test-gf1-gaten`: alle rijtellingen (behalve logtabellen) gelijk aan vóór het kampmoment (taken 1, sessies 1, aanvragen 1, kalenderdagen 6); ketentest stap 8: "rijtellingen identiek" en `--opruimen`-controle groen (voorheen kalender_dagen 291→331, nakijk_sessies 6→71, nakijk_regels 129→406, aanvragen 1→5). |
| **9 — Marko** | Het seed-script gebruikt de echte stockage "Marko" (geen "Marco" meer). | Statische controle in `test-gf1-gaten`; ketentest laat 3 stockages zien. |
| **10 — generator** | In `POST /api/transport-genereer` staan de ophalingen op de **laatste open kampdag** (vr 6 nov) i.p.v. de werkdag erna (3 plekken). Een **themadag-locatie** krijgt één levering (werkdag vóór de eerste open dag) met het materiaal van alle dagen en één ophaling op de laatste open dag. | `test-gf1-gaten`: ophalingen op 2026-11-06; themadag: één levering met de bakken van alle 5 dagen (15 bakken) en één ophaling op 2026-11-06. Geen bestaande ketentest moest aangepast (de oude tests eisten de maandag niet). |
| **11 — kookdagen per kampmoment** | `_actieveLocatieConfig` (lib/gedeeld.js) laat de conditie `kookthema` ook gelden als het kampmoment kookdagen heeft en de locatie geen eigen oven heeft (naast `thema.heeft_kookactiviteit`). Het seed-script zet kookdagen wo/do op de eerste 3 kamplocaties (via PL1 `PUT /velden`). | `test-gf1-gaten`: zonder kookdagen gaat het kook-materiaal niet mee, met kookdagen wel, met eigen oven weer niet. |

## Bewijs
- `node scripts/test-gf1-gaten.mjs` → **37 ok, 0 fout** (2× herhaald; eigen server 3347, herfst-test.db).
- `GR1=1 node scripts/test-gr1-keten.mjs` (lokaal, werkmap-db) → **47 ok, 0 fout, ALLES GROEN**, stap 1/3/4/5/6/7 volledig GROEN; **0 OVERGESLAGEN voor de gaten 1, 2, 4, 5, 6, 8, 9, 10, 11 (en 12)**. Wat overblijft is informatie: **gat 3** (capaciteit: nu 2 leveringsritten over capaciteit; de bezetting telt elke regel `qty`; kantoor beslist hoe "bakken" telt) en **gat 7** (`/api/conflicten` bevat `elders_nodig_vast` en `locatieconfig_onvolledig`), plus 13 en 14 (geen code). Eén ketentest-aanpassing: de rit van Jan heeft door de themadag-levering nu 3 stops, dus de test zet ook stop 2 op "vrij" vóór de wissel.
- `node scripts/volle-run.mjs` → **26/26 groen** (de 26 = de 24 van PL1 + `gf1-gaten` + `gr1-keten`, dat zonder `GR1=1` "overgeslagen" meldt). Drie opeenvolgende runs waren volledig groen. Tijdens het afronden zag ik in enkele runs één test met `AFGEBROKEN` op 0,2 s (willekeurig: ch2-rit-pagina, keten-splits, pl1-kampmomenten; eenmaal v3a-keten + v3c-fotos); elke herhaling was meteen weer groen. Vermoedelijke oorzaak: poortbotsingen met de volle-runs van de andere bouwchats die tegelijk draaiden (de testpoorten liggen per worktree vast); geen enkele test faalde inhoudelijk.

## Buiten mijn gebied (nodig voor de gaten)
- `lib/auth.js`: de loginlijst `personeel-lijst-login` toont ook rol `coordinator` (gat 5).
- `lib/gedeeld.js`: `_actieveLocatieConfig` kent kookdagen per kampmoment (gat 11).
- `routes/nakijken.js`: de historiek in Nakijken toont de KV-acties uit `wijzigingen` (gat 12).
- `scripts/test-f1-modules.mjs`: hier niets gewijzigd door GF1 (de routes die ik toevoegde werden automatisch ingevuld of overgeslagen).

## GEVONDEN
- De generator maakt voor een themadag-locatie nu één levering voor alle 5 dagen; of dat praktisch is (de materialen van dag 5 staan dan vier dagen vroeger op de locatie) is een keuze van Maxim.
- Gat 3 (capaciteit): de bezetting telt `qty` per regel; een bulkregel ("5 × kleuterfiets") telt dus 5 bakken. Nog niet beslist hoe kantoor wil tellen.
- Gat 7: `elders_nodig_vast` en `locatieconfig_onvolledig` komen uit de testdata (te weinig vrije vaste exemplaren voor de fictieve locaties), geen codefout.
- `volledig-verwijderen` laat de `activiteiten_log`-regels staan (logboek); de FICTIEF-markering ervan is niet apart toegevoegd omdat de teksten de locatienaam bevatten, niet het woord FICTIEF.
- De volle-run-testpoorten zijn per worktree vast: twee chats die tegelijk `volle-run.mjs` draaien botsen af en toe (zie hierboven).

## NAV1 — bovenbalk en subbalken wijzen naar de nieuwe schermen (chat D)

**Gedaan:** één tabel in `public/nav.js` (BOVEN/SUB/PAGINA); de acht pagina's laden het en tekenen er hun balken mee (alleen de `<a>`'s; logo, periode-kiezer, naam, knoppen rechts en alle ids blijven). Actieve knop volgt de URL. Tellers (Vandaag = te beslissen, Transport = in te plannen, Voorraad = te keuren tellingen) komen uit `/api/vandaag` (alleen kantoor). `index.html`: vervangstrook op oude tabs met nieuw scherm + `ALIAS`-tabel voor de `/#…`-links.

| Bovenbalk | Href | | Subbalk | Knoppen |
|---|---|---|---|---|
| Vandaag | /vandaag | | Planning | Kampmomenten /kampmomenten · Rooster /#kampplanner · Periodes /#periodes · Thema's per week /#themas |
| Planning | /kampmomenten | | Transport | Ritten /#transport · Ritplanning /ritplanning · Taken /taken · Voertuigen /#voertuigen |
| Transport | /ritplanning | | Materiaal | Thema's /#themas · Bakken /bakken · Pool /#pool · Catalogus /#catalogus |
| Materiaal | /bakken | | Voorraad | Nakijken /nakijken · Tekorten /#tekorten · Bestellingen /#tekorten · Voorraad /#voorraad |
| Locaties | /#locaties (later /locaties) | | Beheer | Personeel /personeel · Logboek /logboek · Export & back-up /#beheer · Instellingen /#beheer |
| Voorraad & controles | /nakijken | | | |
| Beheer | /personeel | | | |

**Bewijs:** `scripts/test-nav1.mjs` 34 ok; volle-run 2× 29/29 groen. Beeld ongewijzigd: computed-style-hash vóór/na op alle 8 pagina's → niets buiten `.top`/`.sub` veranderd (nietInVoor 0). Live: `/#transport` toont de strook "vervangen door Ritplanning en Taken". Vijf oudere tests (bh1, ma1, pl1, tr1, vc1) controleerden linkteksten in de statische HTML; die staan nu op "laadt nav.js" (de teksten zelf worden in test-nav1 gecontroleerd).

**GEVONDEN / afwijkingen:** Locaties blijft `/#locaties`; `/#transport` opent oude tab Transporten; Export & back-up en Instellingen openen beide Materiaal › Thema's (daar staat de back-upkaart); Bestellingen deelt Tekorten; geen vervangstrook voor Kaart/Locaties; tellers alleen voor kantoor.

## TF2 — fixes uit TESTVERSLAG T1, deel afwerking (chat D)

Bewijs: `scripts/test-tf2-afwerking.mjs` 32 ok; volle-run 2× 31/31 groen. Commits per punt op `bouw-d`.

- **G2 tijden** — `server.js` zet als allereerste regel `process.env.TZ='Europe/Brussels'`: alle servertijden (`now()`, `isoNu()`, `getHours()` in `routes/*`) zijn Belgisch; opslag van `wijzigingen.tijdstip` blijft ISO/UTC. Nieuw `lib/tijd.js` (`fmtDatumTijd`, `fmtTijd`, `kvL`, `telw`, `zonderHaakjes`, `namenKort`). Test: 19:40Z → "20:40" (winter) en 10:00Z → "12:00" (zomer). Clientpagina's tonen al in de browsertijd (België).
- **G3 herpoging** — `rit.js` en `kv.js`: helper `haal()`: bij 502/503/504 (of netwerkfout op een GET) na 2 s en 5 s opnieuw, één toast "Even geduld, de app wordt bijgewerkt…", pas daarna de foutmelding. POST's: enkel herhaald bij 502/503/504 (proxy → app niet bereikt); netwerkfout-herhaling voor POST alleen bij `/versturen`: de server doet daar `WHERE kv_status='bezig'`, een tweede keer verandert dus niets (gecontroleerd). Rit-POST's (laden, aankomen…) worden niet herhaald bij een netwerkfout. Test via `createApp` met nep-fetch. De kantoorpagina's hebben nog géén herpoging (afwijking: de prompt noemt ze "via dezelfde helper", maar ze delen geen fetch-laag met rit/kv; apart punt).
- **G4** — hint op de rit-pagina en 409-tekst: "▲▼ wisselt alleen met een aangrenzende vrije stop". Gedrag ongewijzigd.
- **G7** — `GET /api/bakken-overzicht`: `tellers.code_dubbel` / `code_leeg`, per bak `code_dubbel`, `code_leeg`, `aandacht[]` (dubbel = hoofdletterongevoelig, bakken en attributen apart geteld); chips "⚠ Code dubbel" en "Geen code" in `/bakken`. Geen hernummering. `test-ma1-bakken` telt nu 9 chips.
- **G11** — `GENERALE-REPETITIE.md`: stap 1 ("stuks op 20 plaatsen"), stap 2 (stops 1 én 2 vrij; rest-taak staat er), stap 6 (eerst "Bestelling binnen"), stap 8 (conflicten leeg; capaciteit = Ritplanning). ±900 woorden.
- **G15** — `POST /api/nakijken/regel/:id/binnen` (kantoor, gelogd; `tekort_status='binnen'`). `POST /api/aanvullijst/:id/aangevuld` geeft 409 voor een bestelling die nog niet binnen is; handelingen krijgen `binnen` + `kan_afvinken`; tekst "bestelling · binnen, klaar om te plaatsen". Afwijking: er is nog geen knop in de pagina (de afvinkknop bestaat niet in `nakijken.js`; enkel API). `test-vc1`/`test-gr1` zetten de bestelling nu eerst op binnen.
- **G17** — historiek van Nakijken: alle tijden via `fmtDatumTijd` → "29/10/2026, 20:40".
- **G18** — `kvL()` op alle 12 plekken waar "KV " voor een naam werd gezet (server en client); seed-script noemt fictieve KV's "Noor (FICTIEF)".
- **G19** — één/meerdere (soort/soorten, stuk/stuks) in KV, Vandaag, Bakken, Ritplanning; "bakken" vs "stuks" op KV-overzicht afhankelijk van attributen; Ritplanning-waarschuwing "N stuks op M plaatsen" (zelfde woord als rit-link; `test-rp1` aangepast); interne notities (`(gedeeld; …)`, `(set — …)`) gestript in rit- en KV-data (echte haakjes als "(kleuterbak)" blijven); themabakken "<thema> · Themabak 1/1 (curver)"; rekkop "0 van 0 geladen" verborgen; "5 themadagen" → themanamen, afgekort na 3 ("A, B, C +2").
- **G20** — Kapot melden: "Dominoblokjes · N12", zonder code "· (geen code)".

GEVONDEN: (1) Bestaande ritregels in de database bewaren `item_naam` met notitie; de strip gebeurt bij het uitlezen, niet in de opslag. (2) Een nieuwe `GET /api/nakijken` bak kan op meerdere kampmomenten voorkomen: filter altijd op `kampmoment_id`.

## AF1 — Afwerking kantoor (chat D, bouw-d)
- **Punt 1 — herpoging op kantoor.** `public/nav.js` heeft nu één `window.sportyApi(methode,url,body,{toast,token})`: bij 502/503/504 na 2 s en 5 s opnieuw (max 2×), één toast "Even geduld, de app wordt bijgewerkt…", daarna het gewone antwoord; GET ook bij netwerkfout, POST/PUT/DELETE niet. Teruggave `{status,ok,json}`. `api()`/`aanroep()` in vandaag, taken, nakijken, kampmomenten, bakken, personeel, logboek en locaties lopen erdoor. **ritplanning.js overgeslagen** (chat C): zij moet dezelfde regel `return window.sportyApi(methode,url,body,{toast:…,token:TOKEN})` in haar `api()` zetten.
- **Punt 2 — knop.** `/nakijken` heeft geen Tekorten-lijst (de subknop "Tekorten" gaat naar het oude `/#tekorten`, niet mijn gebied). Daarom staat de knop **Bestelling binnen** (min. 36 px) in de Nakijken-detailtabel onder de actie-keuze van een regel met actie bestellen/afschrijven+bestellen en status `besteld`. Na klik: POST `/binnen`, lijst herladen, regel toont "binnen, klaar om te plaatsen" en is afvinkbaar (`kan_afvinken`). Detail-items geven nu `tekort_status` door.
- **Punt 3 — strip.** `/api/taken-overzicht` is alleen-kantoor (niets gestript, zoals gevraagd); `/api/vandaag?mijn=1` bevat geen stuknamen. Fout was `/api/aanvullijst` (coördinator/chauffeur): `stuk` toonde de ruwe `item_naam`; nu `zonderHaakjes`.
- **GEVONDEN:** `locaties.html` laadt `nav.js` niet, dus `locaties.js` valt terug op gewone fetch (zonder herpoging). Eén regel `<script src="/public/nav.js">` in `locaties.html` lost dat op (niet mijn bestand). De oude `/#tekorten` in `index.html` heeft nog geen "binnen"-knop.
- **Bewijs:** `scripts/test-af1-afwerking.mjs` 36 ok (nep-fetch 503,503,200; POST-netwerkfout zonder herpoging; knop bij besteld, weg bij binnen; 409 vóór binnen; strip). Volle run: 32/33 (één niet-geïdentificeerde uitval), daarna 2× 33/33. Niet in een echte browser bekeken.

## KD1 — Kleine dingen kantoor (chat D, bouw-d)
- **Punt 1 (werklijst 96).** `GET /api/vandaag` geeft nu ook `volgende_week` (zelfde vorm) en `week_label` ("Volgende week" als `deze_week` leeg is en de week erna iets heeft, anders "Deze week"). Voor de periode telt de week erna als kampweek 1 wanneer de periode in de volgende kalenderweek (of eerder) start. Het vak toont de lijst van `week_label` met die kop; `cijfers.locaties_open` blijft "deze week". Afwijking: de kop is nu `<span id="t-week">` in `public/vandaag.html` (buiten de lijst van bestanden, één element).
- **Punt 2 (werklijst 73).** `GET /api/nakijken` gaf bakken zonder sessie al terug, maar met status `niet_geteld`. Die hebben nu status `nog_niet` ("nog niet geteld"); `niet_geteld` blijft voor een sessie zonder tellingen. Tellers krijgen `nog_niet`. `/nakijken`: chip "Nog niet geteld", grijze rij met "nog niet geteld · KV <naam>", detail met verwachte inhoud en hint "De KV heeft deze bak nog niet geteld", zonder "Keuring afronden".
- **Tests aangepast:** `test-vc1-nakijken` (3 plekken: status/tekst/teller `nog_niet`) en `test-gr1-keten` (regel 162; draait enkel met GR1=1, dus niet opnieuw gedraaid).
- **Bewijs:** `scripts/test-kd1-kleine-dingen.mjs` 17 ok; volle run 2× 34/34 groen. Niet in een echte browser bekeken.
