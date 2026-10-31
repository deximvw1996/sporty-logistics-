# TESTVERSLAG T3 — rol Kampverantwoordelijke (KV)

Getest op `origin/main` (44fab81), lokaal, poort 3380, `APP_PASSWORD` leeg, verse kopie van `herfst-test.db`. Browser: in-app browser op 390×844. Drie KV's klaargezet via kantoor (persoon 10): Betekom (Test KV Betekom), Abdijschool (Test KV Abdijschool) en een derde kamp Boudewijnstadion (Test KV Derde) met twee thema's (Alles op wieltjes 6-8 jaar, Holderdebolder 9-12 jaar). Levering en ophaling zijn gegenereerd via "genereer-transport".

## Kan deze persoon morgen zijn werk doen met deze app?
1. **Ja voor het begin en het midden van het kamp.** Overzicht, tellen (klopt, tekort + notitie, kapot, te veel, Rest klopt), aanvragen, kapot melden en de status van een aanvraag werken op 390 px. Geen console-fouten, geen horizontale scroll, alle 49 zichtbare knoppen ≥ 44 px.
2. **Nee voor "tellen voor de ophaling" aan het einde.** Wie na "Telling versturen" opnieuw telt, krijgt geen enkel teken dat dit nog niet bij kantoor is, en kantoor krijgt geen melding. Dit houdt het einde van het kamp tegen (G1).
3. **De KV weet na het versturen niet dat het verstuurd is.** De knop blijft "Telling versturen (1/2)", er staat geen "verstuurd om 14:02" (G2).
4. **Bij twee thema's staat er niet bij welke groep of welk thema een bak is** (G3), en een kamp zonder bak (Abdijschool) toont "Nog geen bakken" zonder uitleg (G5).
5. **De beveiliging is in orde:** een vreemd token, verzonnen token, andermans bak, monitor-link en alle kantoor-API's met een KV-token werden geweigerd (403/404/401). Een oude link blijft na het kamp werken (G4).

## Scenario's

| Scenario | Score | Wat ik zag |
|---|---|---|
| Begin kamp: wat komt er, wanneer? | GROEN | Overzicht: "Levering gepland · vrijdag 30 okt · 09:00 · 48 stuks", "Ophaling gepland · vrijdag 6 nov · 17:00", kop "Boudewijnstadion · week 1 / ma 2 – vr 6 nov · KV Test KV Derde". Wat er in de 48 stuks zit staat nergens (alleen aantal). |
| Wat moet ik tellen? | GROEN | Tab "Tellen 0/2": F40 (23 soorten) en HB01 (3 soorten), waarschuwing "⚠ Levering nog niet aangekomen: tel pas als alles er staat." (blokkeert niets). |
| Bak die klopt | GROEN | Tik ✓ 1 bij Politiepak: knop groen, "1 van 23 geteld"; database bevestigt (aangetroffen 1). |
| Tekort met notitie | GROEN | "anders" bij Prints agenten, 5 → 3, notitie "2 prints lagen niet in de bak", Opslaan: "✓ Opgeslagen", rij rood "tekort 2". API: status tekort, aangetroffen 3. |
| Kapot met foto | DEELS | Kapot 1 + foto + notitie "knapt af" via API werkt en toont "💥 1 kapot", miniatuur en notitie. **De foto kiezen via het scherm (📷) heb ik niet echt geklikt**: de bestandskiezer kan ik in het pane niet bedienen. |
| Te veel | DEELS | Via API (Verhaaltje 3 i.p.v. 1): "te veel 2" blauw. Het invoerscherm met +/− zelf heb ik wel geklikt bij het tekort. |
| Rest klopt | GROEN | Eén tik: 23/23 geteld in de database. |
| Stoppen en later verder | GROEN | Na herladen staat de stand er nog (Tellen 1/2, tekort en kapot zichtbaar). |
| Herladen | GROEN | Herladen met `#aanvragen` en `#tellen` opent het juiste tabblad. Herladen met alleen een andere `#bak-…` in dezelfde pagina laadt niet opnieuw (geen echte fout). |
| Op een andere dag | DEELS | De KV-link is niet aan een dag gebonden: het scherm is op elke dag hetzelfde. Niet apart op een andere datum getest. |
| Iets aanvragen | GROEN | Sheet "Materiaal vragen": "stoepkrijt", aantal 4, Versturen. Verschijnt als "4 × stoepkrijt", kantoor kreeg melding "Aanvraag: 4 × stoepkrijt · Boudewijnstadion". |
| Kapot melden tijdens de week | GROEN (API) | "2 × Springtouw knapt af" aangemaakt, kantoormelding "Kapot: 2 × Springtouw knapt af". Het sheet "Kapot melden" zelf heb ik niet geklikt. |
| Status volgen: goedgekeurd/afgewezen | GROEN | Kantoor keurt "4 × stoepkrijt" goed en wijst "20 ballonnen" af met reden. KV ziet "goedgekeurd" en "afgewezen · Staat al in de bak". |
| Einde kamp: tellen voor de ophaling | ROOD | Zie G1 en G2. |
| Twee thema's op één locatie | DEELS | Zie G3. |
| Andere KV zijn link | GROEN | Abdijschool-link toont alleen Abdijschool (1 bak, 0 aanvragen); in de data van het derde kamp staat geen woord Betekom/Abdijschool. |
| Bak van een andere locatie | GROEN | HB01 met het Betekom-token: 403. (F40 geeft 200 omdat die bak ook echt bij Betekom hoort.) |
| Verzonnen token | GROEN | `/api/kv/abcdefghijkl/data` 403, `/kv/…` 404, `/tel/…` 404. |
| KV-token op `/tel/` | GROEN | 404. |
| Monitor-link | GROEN | Aanvraag, kapot en versturen: 403. |
| Kantoor-API's met mijn token | GROEN | 11 routes (aanvragen, personeel, nakijken, kampmomenten-overzicht, locaties, transport-taken, kv-links, instellingen, vandaag, meldingen, aanvraag-status wijzigen) met KV-token als bearer, in `x-token` of zonder token: allemaal 401. |
| Oude link na het kamp | ROOD | Zie G4: er is geen einddatum, de link werkt altijd. Niet met een verstreken periode op het scherm geprobeerd. |
| Wegvallende verbinding | NIET GETEST | Netwerk uitzetten kan ik in dit pane niet. Uit de code: nieuwe pogingen na 2 s en 5 s, laatste stand uit localStorage. Niet gezien. |
| Twee keer op dezelfde knop | NIET GETEST | Alleen "Opslaan" wordt uitgeschakeld tijdens het opslaan (gezien). Twee keer Versturen heb ik via de API gedaan: 200, geen tweede melding. |

## GEVONDEN

**BLOKKEERT**
1. **Hertellen na versturen komt niet bij kantoor aan.**
   - Scherm: Tellen, na "Telling versturen" (390 px).
   - Verwacht: bij het einde van het kamp tel ik opnieuw voor de ophaling, ik verstuur opnieuw, kantoor krijgt een melding.
   - Gezien: de nieuwe telling (Politiepet 0 van 1, notitie "einde kamp weg") overschrijft stil dezelfde keuringssessie in Nakijken. De sessie blijft "ingediend". Het tweede "versturen" geeft 200 maar doet niets: `/versturen` raakt alleen sessies met status `bezig`, en er komt geen nieuwe melding. De eerste telling (begin) is overschreven.
   - Stappen: telling versturen → een bak aanpassen → opnieuw versturen → kantoormeldingen en Nakijken bekijken.

**HINDERLIJK**
2. **Na het versturen blijft alles hetzelfde.** Knop "Telling versturen (1/2)" blijft staan, geen "verstuurd", geen tijdstip, de tab-teller blijft "Tellen 1/2". De KV weet niet of kantoor het heeft. Stappen: versturen → Tellen-tab bekijken.
3. **Twee thema's: geen onderscheid of groep.** Bak F40 heet "Alles op wieltjes · Themabak zwarte curver", bak HB01 heet alleen "Holderbak" (geen thema, geen leeftijdsgroep 6-8/9-12). Lijst is vlak op volgorde, niet gegroepeerd. De KV weet niet welke groep welke bak krijgt. Stappen: kamp met twee thema's → Tellen.
4. **Oude link blijft werken na het kamp.** `_kvKampmoment` zoekt alleen op token (`routes/kv.js`/`lib/gedeeld.js:40`), er is geen einddatum. Iedereen met de link kan na het kamp nog tellen en aanvragen doen.
5. **Kamp zonder bak** (uit de code en de API: 0 bakken; het scherm zelf heb ik niet bekeken). Abdijschool (thema Holderdebolder zonder bak) toont "Nog geen bakken gekoppeld aan dit kampmoment." en "Telling versturen (0/0)". Geen tekst "er komt niets te tellen", geen telefoonnummer van kantoor op die plek.
6. **Tekst "maandag nakijken · tik een bak om te tellen"** staat altijd onder Tellen, ook halverwege en aan het einde van de week. Niet te volgen bij de ophaling.

**COSMETISCH**
7. Overzicht: kaart Tellen toont "F40: tekort prints agenten (gelamineerd), te veel verhaaltje fietskonijn (gelamineerd), 1 fluitje kapot · 2 bakken nog te tellen": kleine letters en "(gelamineerd)" nemen veel plaats in.
8. De toast "✓ Opgeslagen" ligt over de onderste itemrij en de voetknoppen.
9. Op het telscherm van een bak staat geen tabbalk meer; naar Aanvragen moet je eerst "‹ Tellen" en dan de tab. (Dit is bewust ontworpen, maar een KV die iets kapot ziet zoekt naar "Kapot melden" op dat scherm.)
10. Tijdstip bij aanvragen "31/10/2026, 01:00" is de servertijd in een andere indeling dan de rest ("vrijdag 30 okt").

## ONDUIDELIJK VOOR DEZE ROL
- "Telling versturen (1/2)" en "Versturen kan ook als nog niet alles geteld is; kantoor ziet wat ontbreekt." Wie weet wanneer je moet versturen: na elke bak of één keer per kamp?
- "Rest klopt ✓": niet duidelijk dat dit álle nog niet getelde stukken in de bak op "klopt" zet.
- "anders" bij een stuk: pas na het openen blijkt dat je daar tekort, kapot en te veel invult.
- "⚠ Levering nog niet aangekomen: tel pas als alles er staat." Wat doe ik als de levering er wel staat maar nog niet "gedaan" is?
- "Aanvragen 3" in de tab: telt ook afgewezen en goedgekeurde; het is niet duidelijk dat er een antwoord wacht.
- "💥 1 kapot" en "📝": symbolen zonder uitleg buiten de hint bovenaan.

## Wat ik niet echt geklikt heb
- Foto kiezen met 📷 (item en sheet), alleen via API getest.
- Kapot-sheet en het kiezen van een stuk uit de lijst.
- Netwerk uit/aan.
- De monitor-pagina `/tel/…` op het scherm (alleen de API-weigeringen).
- De Betekom- en Abdijschool-links op het scherm (alleen via API).
