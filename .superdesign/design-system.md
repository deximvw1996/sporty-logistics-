# Sporty Logistiek — design system (v1, 2026-10-29)

## Product context
Interne logistiek-app van Sporty vzw (sportkampen voor kinderen in Vlaanderen). Kantoor plant per vakantieperiode kampmomenten (locatie × week), koppelt thema's (themabakken met materiaal, attributen, poolmateriaal zoals springkastelen en fietsen) en plant transporten vanuit drie stockageplaatsen (Rozenweg, Kantoor, Marco) naar de kamplocaties. Drie gebruikersgroepen:
- **Kantoor / coördinator / hoofdlogistiek** (desktop, 1920×900): plannen, keuren, voorraad, conflicten.
- **Chauffeur** (GSM, 390 px, één hand, buiten in de zon): rit-pagina via link zonder login; laadt en lost stuk per stuk.
- **Kampverantwoordelijke (KV)** en monitoren (GSM): wat hoort er te staan, tellen, tekort melden.
Taal: Nederlands (Vlaams), informeel maar professioneel. Geen jargon richting chauffeur/KV.

## Jobs to be done (chauffeur-scherm, eerste doel)
1. Zien welke stops ik vandaag rijd, in volgorde, met contactpersoon en sleutelafspraak.
2. Per stuk afvinken bij laden in de stockage (gegroepeerd per rek) en bij lossen op locatie. Elk stuk apart, nooit "alles in één keer".
3. Melden dat iets niet past of niet gevonden is (blijft open als nieuwe taak) en een probleem melden met foto.
4. Altijd weten waar ik sta: stop x van y, n van m stuks, status gepland → onderweg → aangekomen → gedaan.
5. Mijn dag indelen: een dagoverzicht met tijdlijn waarop ik vrije stops kan verslepen; stops die kantoor vast zet (🔒) blijven staan. Vanuit het overzicht spring ik naar elke stop, ook terug.

## Visuele identiteit (hard constraint)
- **Font:** system-ui stack (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`). Geen webfonts, geen serif, geen display-fonts.
- **Kleuren (alleen deze):**
  - Primair blauw `#2563eb` (knoppen, actieve staat, topbalk van de rit-pagina); donkerblauw `#1e3a8a` voor koppen op donkere vlakken.
  - Tekst `#1a1a1a`; secundaire tekst `#666666`; hint `#888888`.
  - Achtergrond `#f5f5f5`; kaarten `#ffffff`; lijnen `#e5e5e5`.
  - Status: groen `#22c55e` / `#16a34a` (gedaan, ok), oranje `#f59e0b` (deels, let op), rood `#ef4444` / `#dc2626` (ontbreekt, probleem), grijs `#94a3b8` (nog niet).
  - Lichte statusvlakken: groen `#f0fff4`, rood `#fff1f1`, oranje `#fffbeb`, blauw `#e7f0ff`.
  - Geen paars, roze, gradiënten of neon.
- **Vorm:** radius 6–12 px (kaarten 12, knoppen 8, vinkvakken 8); schaduw hooguit `0 1px 4px rgba(0,0,0,.08)`; lijnen 1 px `#e5e5e5`, accentlijn links 3–4 px in statuskleur.
- **Maten (mobiel):** tekst 14 px basis, 12 px secundair, koppen 16–19 px; aanraakdoelen minstens 44×44 px; zijmarge 12–16 px; verticale ritme 8 px.
- **Iconen:** emoji zijn in de huidige app in gebruik (📦 📤 🔄 ⬆️ ⬇️ ✅ ⚠️); in nieuwe ontwerpen bij voorkeur eenvoudige lijn-iconen (inline SVG, 1.5 px, 20–24 px), geen icoonbibliotheek laden.
- **Toon:** rustig, veel wit, hoog contrast (≥ 4.5:1), leesbaar buiten. Geen decoratie zonder functie.

## Componenten (bestaand, hergebruiken)
- Topbalk (blauw vlak, titel + subregel), sectiekop (11 px, kapitalen, grijs), stop-kaart (witte kaart, blauwe linkerrand, soort/naam/route/tijd), stuk-rij (naam, code, aantal, twee fase-knoppen Laden/Lossen die groen worden), toast onderaan (3 s, groen/rood), knop "Ik ben aangekomen".

## Bewegingen
Alleen functioneel: knop-status wisselt direct; toast schuift 150 ms in; geen parallax, geen laad-animaties langer dan 300 ms.

## Regels uit het draaiboek die het ontwerp moet dragen
- Elk stuk apart afvinken bij laden én lossen (bindend).
- Chauffeur ziet codes en foto's van bakken, nooit de inhoud van een bak.
- Contactpersoon + telefoon van de locatie en van de KV bij elke stop.
- "Past niet / niet gevonden" per stuk; "Probleem melden" per stop met foto.
- Status van de rit altijd zichtbaar; de rit sluit vanzelf als alles gelost is.
