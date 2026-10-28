
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
