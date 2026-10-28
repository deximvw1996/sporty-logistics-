# DOORLICHTING-V2 — synthese van zes lenzen (2026-10-28, Fable)

Bronnen: DOORLICHTING-a (architectuur, Fable) · -b (backend, Opus) · -c (veiligheid, Opus) · -d (UX, Sonnet) · -e (data, Sonnet) · -t (rollenspel, Opus). Alle zes op branch bouw-x/test-1, lees-werk, stand main d181db9 + prod-kloon.
**Onafhankelijk herdraaid door Fable op een verse prod-kloon (28/10):** B-F4, B-F5, B-F8a/b, T-G3 (API-gedrag) en D-#1, C-#1, C-#2, A-saveDb, B-F13 (code/prod) — **9/9 bevestigd.** De overige bevindingen steunen op het bewijs in de rapporten zelf (regelnummers, API-outputs) en zijn consistent over de lenzen heen.

## 1. Totaaloordeel per domein
| domein | oordeel | kern |
|---|---|---|
| Datakern (thema→bak→item→catalogus, pool, behoefte) | **goed** | 0 wezen, bulk-sommen sluiten, 184 thema's correct (E 9/10 steekproef) |
| Veiligheid | **slecht** | 2 kritieke + 4 hoge bevindingen; muren zelf zijn ok |
| Backend-logica transport/kv | **matig–slecht** | 13 echte fouten (B), 3 ernstige ketenbreuken (T) |
| Periode-bewustzijn | **slecht** | zomer lekt in herfst in generator, conflicten, sport, kleurenborden, kv-sessies, UI-terugval |
| Bulk-boekhouding | **slecht** | twee waarheden; opblaasbaar (34 van 17) |
| UX hoofdapp | **matig** | werkt, maar 35 confirms/9 prompts, verstopte functies, dubbele wegen, geen laadindicatie |
| UX KV/chauffeur (mobiel) | **slecht** | tellen onwerkbaar, geen bevestigingen, knoppen te klein, ophaalrit zonder bakkenlijst |
| Data-vulling | **matig** | structuur ok; voorraad leeg (867/868), 608 verifieer-notities, 61 enkelv/meerv-dubbels |
| Architectuur/onderhoud | **matig** | 1 bestand van 5.483 regels, ±1.000 regels dode migratie, legacy nog half levend, niet-atomaire schrijving |

## 2. De bevindingen die de herfstvakantie (2–8 nov) blokkeren — gegroepeerd per DRAAIBOEK-fase
**Fase 0/1 (stamdata, plannen)**
- Actieve periode reset naar hardgecodeerde "Zomer 2026" bij herladen; terugval in `_activePeriode()` (T-1.4/G7).
- Conflicten-tab liegt: eigen client-check i.p.v. `/api/conflicten` (T-1.12/G5); server-conflicten mengen periodes (B-F3); pool_tekort ziet specifieke kastelen/blazers niet (B-F10); ontbrekend_transport zwijgt voor pool-only thema's (B-F11).
- Testrest op prod: Abdijschool locatieconfig "99× EHBO, altijd" (B-F13, **bevestigd op prod**).
**Fase 3 (transport)**
- Spoedtaak uit aanvraag: geen van/naar, datum = vandaag, qty 1 (B-F8, T-4.4, **bevestigd**); afwijzen na goedkeuren laat taak staan (**bevestigd**).
- Sportplanning/kleurenborden niet periode-bewust: zomer-sets lekken in herfstlevering, zonder ophaling (B-F2, T-1.14 "van Kantoor").
- Thema-wissel vergeet pool (B-F1) — alleen relevant bij ≥2 weken.
- Taak splitsen breekt checks; taak verwijderen na laden laat bakken "onderweg" (B-F6/F7).
**Fase 4 (leverdag)**
- Rit-token-lossen zet héle bulk-rij op locatie, spreiding beweegt niet (B-F4, **bevestigd**); opnieuw-gedaan verdubbelt spreiding (B-F5, **bevestigd: 34 van 17**).
- Rit/taak blijven "gepland" na volledig lossen; geen "onderweg/aangekomen" voor de chauffeur (T-2.5/2.6/G3, **bevestigd**).
- Ophaalrit toont chauffeur geen bakkenlijst (ontstaat pas bij Klaarzetten) (T-4.12/G6).
- Sportpakket niet laadbaar/losbaar door chauffeur (T-2.3/G4).
**Fase 5 (kampweek)**
- Aanvraag goedkeuren/afwijzen via kale prompt/confirm; Annuleren voert de actie tóch uit (D-#1, **bevestigd in code**; T-G1 blokkerend in prompt-blokkerende browsers).
- KV ziet sportpakket niet in "Wat moet er staan"; vaste bakken tonen 0 items (T-3.1, A-GEVONDEN-4).
**Fase 6 (vrijdagcontrole)**
- Tellen = honderden tikken, niet intypbaar, geen "alles aanwezig" (T-3.2); lege controle verzendbaar (D-#2); geen bevestiging na versturen/kapot (T-3.6/3.8); hertellen na verwerking (B-R5); aanvullen zonder aantal (B-R6).
- Voorraad leeg → tekortendashboard/bestellijst betekenisloos, "0 → 0"-toasts (E, T-4.6).
**Dwars: veiligheid (C, bevestigd in code)**
- KRITIEK: bestandsnaam-validatie ontbreekt in sport-foto-upload (extensie ongefilterd); geen rolcontrole op beheer-routes (backup/herstel/import/pincodes).
- HOOG: `/api/export` lekt sessietokens + pincode-hashes; pincodes ongezouten SHA-256 zonder login-vertraging; `/uploads` vóór de wachtwoordmuur; tabelnaam uit request in `/api/import/tabel`.
**Dwars: robuustheid (A, bevestigd in code)**
- `saveDb()` schrijft in-place zonder tmp+rename → afgeknotte db bij herstart midden in een schrijving; ±50 schrijvingen per KV-telling; foto's als base64 in de db.

## 3. Wat kan wachten
- Vóór kerst (2 weken): thema-wissel-pool (B-F1), gap-herlevering (B-F12), nakijk_sessies op kampmoment (B-R11), legacy-opkuis echt afmaken (A-11), KV:/INFO:-structuur i.p.v. prefix (A-9), catalogusvervuiling door transportregels (B-F9) + 256 KV/INFO-item_types (A-2.3), sessie-opruiming.
- Vóór zomer (9 weken): schrijven batchen (A-7), FK's (A-8), vast_types-tabel (A-10), eenheden-model (E), enkelv/meerv-samenvoeging (E), XSS-plekken + CSP (C-8), server.js opsplitsen.
- Ooit: objecten-tabel (A-16), activiteiten_log op id (A-17), better-sqlite3 (A-19), verhuur (S9).

## 4. Voorlopige bouwvolgorde (te bevestigen in de brainstorm)
V0 veiligheid-noodronde → V1 testharnas → V2 periodes (verdiept: generator/conflicten/sport/kleurenborden/kv-sessies/UI-terugval) → V3a spoedflow + transportstatussen + bulk-pad (fase 3-4) → V3b KV-telscherm + bevestigingen + modals (fase 5-6) → V3c conflicten-tab op server-bron + chauffeur-ophaallijst + sportpakket in de keten → V4 robuustheid (atomaire save, foto's uit db) → V5 data (99-EHBO weg, voorraad vullen voor herfstthema's, bakcodes herfstthema's) → V6 generale repetitie + live-week → V7 sollicitatie. Designsessie vóór V3b.
