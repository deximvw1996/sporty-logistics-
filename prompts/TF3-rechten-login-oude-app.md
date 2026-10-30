# PROMPT TF3 — BLOKKERS T2: rechtenlek dichten, inloggen op desktop, oude app weg, meldingen bij elke ritwijziging
**Chat C (Opus) · map `D:\Sporty\sporty-c` · branch `bouw-c` · poort 3303 · verslag `OVERLEG-c.md` · TIJDSLIMIET 3 uur**

Lees eerst `CLAUDE.md`. Begin met `git fetch origin` en `git rebase origin/main`. Controleer de exitcode van de rebase zelf vóór je pusht. Lees dan volledig: `TESTVERSLAG-T2.md` (G1, G3, G5, G6, G15, G27, G28, G31, G33 en het beveiligingsblok), `lib/auth.js` (rond regel 148: `vereisRol`), `server.js`, `public/nav.js`, `public/index.html`, `public/vandaag.js`, `routes/vandaag.js`, `routes/ritplanning.js`, `routes/transport.js`, `routes/meldingen.js`, `scripts/testdata/route-inventaris-f1.json`, `scripts/test-f1-*.mjs`.

Je raakt ALLEEN: `lib/auth.js`, `server.js`, `public/nav.js`, `public/login.*`, `public/meer.js`, `public/vandaag.js`, `public/kampmomenten.js` (alleen links), `routes/vandaag.js`, `routes/ritplanning.js`, `routes/transport.js`, `routes/meldingen.js`, `scripts/test-tf3-*.mjs`, aangepaste bestaande tests, `OVERLEG-c.md`. NIET `routes/nakijken.js`, `routes/tekorten-overzicht.js`, `public/nakijken.*`, `public/aanvullen.*`, `public/ritplanning.*`, `public/rooster.*`, `public/kampmomenten.css` (chat D).

## Punt 1 — Rechten: standaard dicht (G1, BLOKKEERT)
Chauffeur en coördinator kunnen nu via de API thema's, locaties en kampmomenten wissen. Dicht het niet route per route: **één centrale regel**. Elke `/api/*`-route is alleen voor kantoor, behalve een expliciete lijst per rol in één tabel (methode + pad), plus de publieke routes (`/api/login*`, `/api/rit-token/*`, `/api/kv/*` en wat zonder login hoort). Bestaande strengere `vereisRol` blijven gelden.
- Stel de lijst op uit wat de schermen van die rol echt aanroepen (Vandaag, `/rit`, `/aanvullen`, Meldingen, Tekorten voor de coördinator, eigen pincode, ...). Monitor: alleen lezen wat hij nu nodig heeft. Lezen is niet automatisch toegestaan: neem alleen op wat een scherm nodig heeft.
- Nieuwe routes zijn dus vanzelf dicht. Kantoor verandert niet.
- Noteer de tabel in het verslag, per regel waarom, zodat Maxim ze kan lezen.
**Bewijs:** een test die alle routes uit `app._router` of de inventaris afloopt als chauffeur, coördinator, monitor en anoniem: alles buiten de tabel 401/403, en controle in de database dat er niets veranderde. De gewone flows van elke rol blijven werken (rit rijden, aanvullen, melden, meldingen lezen, tekorten). KV-link geeft alleen eigen data.

## Punt 2 — Inloggen op desktop en de oude app weg (G3, G15, G31, G33, BLOKKEERT)
`index.html` is volgens T2 dood: het script geeft een syntaxfout, dus er kan niets meer van werken. Controleer dat eerst zelf en som op wat er stond dat nog nergens anders bestaat (GEVONDEN, niet bouwen).
- Niet ingelogd of verlopen sessie op elke breedte → `/login?terug=`. `/login` werkt op desktop als gecentreerde kolom. `location.href='/'` in andere pagina's blijft kloppen doordat `/` zelf goed doorstuurt.
- `/` → ingelogd naar `/vandaag`, anders naar `/login`. Onbekende URL's krijgen een echte 404-pagina met link naar `/vandaag`, niet langer de oude app; `/api/*` onbekend blijft JSON 404. Oude `/#...`-adressen: een klein script op `/` vertaalt de bekende hashes naar het nieuwe scherm.
- `/index.html` is niet meer te bereiken. Bestand laten staan tot Maxim akkoord geeft; noem dat in het verslag.
- Alle links naar `/#...` in jouw bestanden vervangen door de nieuwe pagina (Vandaag "alles ›", Kampmomenten). Staan ze in bestanden van D: lijst in het verslag.
- Chauffeur op desktop ziet alleen de menu's van zijn rol (G33). De rol komt uit de sessie, niet uit een oude lokale waarde (G31).
**Bewijs:** op 1920 en 390 geen enkele link in de menu's of op Vandaag gaat naar `/` of `/#`; console leeg; niet-ingelogd-pad per rol.

## Punt 3 — Melding bij elke ritwijziging (G5, G6, G28)
Na klaarzetten: stop toevoegen, ontkoppelen en wisselen geven een melding aan de bestuurder. Bij een bestuurderswissel krijgt zowel de oude als de nieuwe er één. Klaarzetten zelf geeft de bestuurder één melding met link naar de rit. Datum leesbaar ("vr 30/10 om 10:15", niet ISO), geen "Chauffeur <naam>" dubbel. Niet één melding per klik bij tien snelle wijzigingen: binnen 2 minuten voor dezelfde rit en persoon wordt de ongelezen melding bijgewerkt.

## Punt 4 — Pincode (G27 en beveiligingsblok)
Eerste pincode en wijzigen in Meer: tweemaal invoeren op het toetsenblok, geen `prompt()`. Weiger 0000, 1111, 1234 en gelijkaardig zwakke codes bij nieuw kiezen, met uitleg. Bestaande testpersonen blijven werken. Lees de hash van niemand uit en zet geen pincodes in tekst. Oude sha256-hashes: bij de eerstvolgende login gaan ze al over (controleer dat en meld het).

## Bewijs en afsluiting
`scripts/test-tf3-rechten.mjs` en `scripts/test-tf3-login.mjs` (via `_testhulp`, eigen poort). Bestaande tests mee aanpassen waar de oude app verwacht werd, met uitleg. Browsercontrole op localhost; NOOIT een adres met gebruikersnaam/wachtwoord openen; lukt een browserstap niet zonder toestemming: overslaan, melden, verder. Volle run 2× groen. Commit per punt, push `origin HEAD:bouw-c`. NOOIT naar main, NOOIT deploy.bat. Verslag onderaan `OVERLEG-c.md` per punt + GEVONDEN. Laatste bericht eindigt met exact: **VOLLEDIG KLAAR MET DE PROMPT. NU IS HET TERUG AAN DE HOOFDCHAT.** Bij de tijdslimiet: stop, commit, "Stand bij tijdslimiet", push, **TIJDSLIMIET BEREIKT: GESTOPT MET EEN TUSSENSTAND. NU IS HET TERUG AAN DE HOOFDCHAT.** Volgorde bij tijdnood: 1, 2, 3, 4.
