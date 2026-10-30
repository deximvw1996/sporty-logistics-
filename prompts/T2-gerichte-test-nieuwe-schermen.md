# PROMPT T2 — TESTCHAT: gerichte test van alle nieuwe schermen, als echte gebruiker, desktop en gsm
**Chat T (test) · map `D:\Sporty\sporty-t` · poort 3306 · GEEN code-wijzigingen · verslag `TESTVERSLAG-T2.md` · TIJDSLIMIET 3 uur**

Begin met `git fetch origin` en `git checkout origin/main` (lezen, niet bouwen). Lees `CLAUDE.md` (Testchats, MOBIEL-REGEL), `D:\Sporty\Werking Sporty.txt` (hoe het echt loopt), `TESTVERSLAG-T1.md` (20 GEVONDEN: controleer ook of die weg zijn) en de GEVONDEN- en Afwijkingen-regels onderaan `OVERLEG-c.md` en `OVERLEG-d.md`.

## Opstelling
**Alleen lokaal, niet op prod.** Maak een lege map `D:\Sporty\sporty-t-data`, kopieer `scripts/testdata/herfst-test.db` daarheen onder de naam die `startServer` in `scripts/_testhulp.mjs` gebruikt, en start de server met `PORT=3306`, `DATA_DIR` op die map en `APP_PASSWORD` leeg (zoals `_testhulp`; ontbreken er `node_modules`, gebruik dezelfde `NODE_PATH`-terugval). Zonder `APP_PASSWORD` is er geen Basic-muur, dus je test de kantoorschermen nu **echt in de in-app browser**, wat T1 niet kon. Pincodes en personen haal je uit deze testdatabase en `herfst-test.json`. NOOIT een adres met gebruikersnaam/wachtwoord openen. Lukt een browserstap niet zonder toestemming: overslaan, melden, verder.

## Zo test je
Echt klikken en typen, geen API-aanroepen in de plaats van een knop; de API alleen om een resultaat na te lezen. Vul zo nodig testdata aan via de schermen zelf. Bij elk scherm, op **1920×900 én 390×844**: console-fouten, horizontale scroll, afgesneden tekst, knoppen (≥ 36 px desktop, ≥ 44 px gsm), lege plekken waar data hoort, knoppen die niets doen, onbegrijpelijke tekst. Vergelijk met de mockup in `design/` (`PATROON-DEFINITIEF`, `MOBIEL-DEFINITIEF`, `mockup-gsm-1`, `mockup-aanvullen-gsm`, `mockup-planning-v3`, `mockup-gedeeld-materiaal`, `mockup-beheer`, `mockup-voertuigen`). Klopt iets met de test maar niet met hoe het in `Werking Sporty.txt` echt loopt: ook melden.

## Scenario's (in deze volgorde)
**A. Inloggen en schil (gsm).** Kantoor, coördinator, chauffeur: juiste tabs per rol, foute pincode en blokkering, ingelogd blijven na herladen, niet ingelogd → `/login`. Elk item onder Meer opent iets bruikbaars. Terugknop van de browser op elk niveau. `/rit/<token>` en `/kv/<token>` zonder tabbalk.

**B. Planning (desktop en gsm).** Rooster per week met kaarten en labels. Zet met opzet: één thema op twee locaties in dezelfde week (moet altijd conflict geven), hetzelfde thema twee opeenvolgende weken op dezelfde locatie (moet "herhaald" geven), een gesloten dag. Wissel een thema. Gedeeld materiaal: tabblad vult, tekort op springkasteel, blazer, springdier of fiets wordt gemeld. Sportrooster: plan op ma–wo en do–vr op verschillende locaties → één verhuistaak; meer sets vragen dan er zijn → rood mét voorstel; Toepassen. Meldingen mogen nooit iets verbieden. Klaar voor de start in Periodes klopt met wat je zag.

**C. Transport.** Taak op een rit zetten, stops herschikken (slepen desktop, ▲▼ gsm), bestuurder en voertuig wisselen, voertuig dubbel, in onderhoud en over capaciteit geven elk een waarschuwing die verdwijnt na oplossen. Klaarzetten. Rit aan een losse naam zonder personeelslid → ⚠. Voertuigenpagina: toevoegen, onderhoud, verwijderen met komende rit geweigerd.

**D. De hele keten met meldingen.** Dit is de kern; volg na elke stap de tabteller en `/meldingen` van elke rol.
1. Chauffeur rijdt een rit op gsm, meldt iets → kantoor krijgt één melding.
2. Ritwijziging na klaarzetten → de bestuurder krijgt een melding. **Test apart: stop toevoegen, ontkoppelen, wisselen, tijd, voertuig** en schrijf per soort of er een melding komt (bekend gat).
3. KV telt via link: één klopt, één tekort met notitie, één kapot met foto en te veel, één aanvraag.
4. Kantoor in Nakijken, desktop én gsm: elke actie minstens één keer (bestellen, aanvullen uit voorraad, aanvaarden, afschrijven + bestellen, herstellen, naar pool, laten staan), afronden. Niet alles goedkeuren: controleer dat een geweigerde aanvraag nergens werk veroorzaakt.
5. Tekorten: bestelling plaatsen, deels binnen, volledig binnen; ook bestellen zonder KV-melding moet kunnen. Voorraad na elke stap noteren.
6. Aanvuller op gsm (`/aanvullen`): afvinken, minder gevonden ("n van m gedaan"), bestelling niet binnen is geblokkeerd met uitleg, afschrijven vraagt foto, Bak klaar, terugzetten. Controleer dat de voorraad nooit dubbel daalt.

**E. Aanvuller meldt zelf (nieuw).** Kapot zonder foto geweigerd, met foto kan; weg zonder foto kan; ⚠ bij een stuk en de knop in de bak; **+ Melding zonder bak**; twee keer melden telt op; voorraad blijft gelijk; keuring heropent; kantoor beslist en rondt af → juiste keten. **Beoordeel:** zien mensen dat kantoor de keuring opnieuw moet afronden, of blijft een melding stil liggen? Waar staat een losse melding, en vindt kantoor die? Echte foto-invoer op gsm: lukt niet in de browser → testfoto en melden.

**F. Beheer en de rest.** Handmatige back-up, herstellen (alleen op deze kopie), nachtback-up in de lijst, standaard tijden werken bij Nieuwe rit en de verhuistaak. Locaties › Kaart, Bakken, Thema's, Pool, Catalogus, Vandaag kantoor: elke doorklik landt op de juiste plek. **Rechten:** per rol elke kantoor-URL en een schrijf-API proberen: chauffeur en coördinator mogen niets buiten hun werk, KV-link geeft alleen zijn eigen data. Broncode niet downloadbaar (`/server.js`, `/lib/db.js`, `/sporty.db`).

**G. Oude schermen en bugs.** Staat er nog een oude pagina of oude tab die je kunt bereiken vanuit de menu's? Dode links? Herlees de 20 GEVONDEN van T1: per punt weg / nog aanwezig.

## Verslag `TESTVERSLAG-T2.md`
Bovenaan in vijf regels: **is dit klaar om zelf te proberen, en wat houdt dat tegen?** Daarna per scenario GROEN / DEELS / ROOD met wat je deed en zag (letterlijke teksten, aantallen, voorraadcijfers), schermafdrukken waar het telt. Schrijf eerlijk op wat je niet echt geklikt hebt. Onderaan genummerd **GEVONDEN**, op ernst: BLOKKEERT (werk loopt vast, verkeerde voorraad, data weg, rechtenlek) / HINDERLIJK / COSMETISCH, met per punt: scherm + breedte, verwacht, gezien, exacte stappen om te herhalen. Niet fixen. Noem aparte punten apart; meld ook waar je twijfelt of het een fout is.

Commit alleen `TESTVERSLAG-T2.md`, `git push origin HEAD:refs/heads/test-t2`. NOOIT naar main, NOOIT deploy.bat, niets op prod. Stop je server aan het einde. Volgorde bij tijdnood: D, E, A, B, C, F, G. Laatste bericht eindigt met exact: **VOLLEDIG KLAAR MET DE PROMPT. NU IS HET TERUG AAN DE HOOFDCHAT.** Bij de tijdslimiet: stop, commit, "Stand bij tijdslimiet", push, **TIJDSLIMIET BEREIKT: GESTOPT MET EEN TUSSENSTAND. NU IS HET TERUG AAN DE HOOFDCHAT.**
