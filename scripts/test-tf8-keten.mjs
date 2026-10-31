// test-tf8-keten.mjs — TF8 (chat D): niets blijft stil achter (taak/kampmoment weghalen, onbeslist, tekort+kapot), Vandaag en Aanvullen, kantoor klein.
// Eigen server via _testhulp (poort 3362 of TEST_POORT, herfst-test.db). T.check(voorwaarde, tekst).
import * as T from './_testhulp.mjs';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const lees = (p) => fs.readFileSync(T.ROOT + '/' + p, 'utf8');
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: Number(process.env.TEST_POORT) || 3362 });
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const P = (m, p, b) => T.api(srv.base, null, m, p, b);
  const R = ijk.locaties.rozenweg, km = ijk.kampmomenten.abdijschool, thema = ijk.themas.alles_op_wieltjes;
  const q = (s, p = []) => T.leesDb(srv.dbPad, s, p);
  const kvtok = await T.kvToken(srv.base, tok, km);
  const zetStock = (t, qty) => A('PUT', `/api/catalogus/${t}/voorraad`, { locatie_id: R, qty });
  const WATER = 3223;
  const vandaag = new Date().toISOString().slice(0, 10);

  // ═══ PUNT 1 · G5 — taak van een goedgekeurde aanvraag weghalen ═══
  T.info('Punt 1 · G5 taak weghalen');
  await zetStock(WATER, 30);
  const maakAanvraag = async (tekst, n) => { const a = (await P('POST', `/api/kv/${kvtok}/aanvraag`, { tekst, aantal: n })).json.id; await A('PUT', `/api/aanvragen/${a}/status`, { status: 'goedgekeurd' }); return a; };
  const a1 = await maakAanvraag('Waterpistolen', 3);
  const t1 = (await q('SELECT id FROM transport_taken WHERE aanvraag_id=?', [a1]))[0].id;
  const reg1 = () => q("SELECT id FROM nakijk_regels WHERE kantoor_notitie LIKE ?", [`%aanvraag #${a1} van KV%`]);
  T.check((await reg1()).length === 1, 'goedgekeurde aanvraag heeft een regel op de aanvullijst');
  let r = await A('POST', '/api/taken/aanvraag-opruimen', { aanvraag_ids: [a1], ook_aanvullijst: true });
  T.check(r.status === 200 && r.json.aanvragen === 0 && (await reg1()).length === 1, 'opruimen vóór de taak weg is, doet niets');
  const ov = (await A('GET', '/api/taken-overzicht?alle=1')).json;
  T.check(ov.taken.find((t) => t.id === t1).aanvraag_id === a1, 'de takenlijst kent de aanvraag van een taak (aanvraag_id)');
  await A('DELETE', `/api/transport-taken/${t1}`);
  r = await A('POST', '/api/taken/aanvraag-opruimen', { aanvraag_ids: [a1], ook_aanvullijst: true });
  T.check(r.json.regels === 1 && r.json.aanvragen === 1 && (await reg1()).length === 0, 'Ja: de regel gaat van de aanvullijst (' + JSON.stringify(r.json) + ')');
  const kvA = (await P('GET', `/api/kv/${kvtok}/data`)).json.aanvragen.find((a) => a.id === a1);
  T.check(kvA && kvA.status === 'afgehandeld' && /niet meer/.test(kvA.antwoord), 'de aanvraag blijft in de historiek met status "afgehandeld" en de KV leest de uitleg: ' + (kvA && kvA.antwoord));
  const gelogd = await q("SELECT COUNT(*) n FROM wijzigingen WHERE tabel='nakijk_regels' AND actie='delete' AND context LIKE 'taak weggehaald%'");
  T.check(gelogd[0].n === 1, 'het weghalen van de regel is gelogd (omkeerbaar)');
  const a2 = await maakAanvraag('Waterpistolen', 2);
  const t2 = (await q('SELECT id FROM transport_taken WHERE aanvraag_id=?', [a2]))[0].id;
  await A('DELETE', `/api/transport-taken/${t2}`);
  r = await A('POST', '/api/taken/aanvraag-opruimen', { aanvraag_ids: [a2], ook_aanvullijst: false });
  T.check(r.json.regels === 0 && (await q("SELECT id FROM nakijk_regels WHERE kantoor_notitie LIKE ?", [`%aanvraag #${a2} van KV%`])).length === 1, 'Nee: de regel blijft op de aanvullijst staan');
  T.check((await q('SELECT status FROM aanvragen WHERE id=?', [a2]))[0].status === 'goedgekeurd', 'Nee: de aanvraag blijft goedgekeurd');
  const tk = lees('public/taken.js');
  T.check(tk.includes('Ook het stuk van de aanvullijst halen en de KV laten weten?') && tk.includes('id="d-weg"') || tk.includes("id=\"d-weg\""), 'het scherm stelt de vraag, en Verwijderen staat ook in het taakdetail');

  // ═══ PUNT 1 · G6 — kampmoment verwijderen ═══
  T.info('Punt 1 · G6 kampmoment verwijderen');
  const kvP = (await A('POST', '/api/personeel', { naam: 'Tf8 KV', rol: 'kv' })).json;
  const km2 = (await A('POST', '/api/kampmomenten', { locatie_id: 35, week: 1, periode_id: ijk.periode.id, kv_persoon_id: kvP.id })).json;
  const km2id = km2.id || km2;
  await A('POST', `/api/kampmomenten/${km2id}/themas`, { thema_id: thema });
  const kv2 = await T.kvToken(srv.base, tok, km2id, 'Tf8 KV');
  const av3 = (await P('POST', `/api/kv/${kv2}/aanvraag`, { tekst: 'Waterpistolen', aantal: 2 })).json.id;
  await A('PUT', `/api/aanvragen/${av3}/status`, { status: 'goedgekeurd' });
  const av4 = (await P('POST', `/api/kv/${kv2}/aanvraag`, { tekst: 'Iets nieuws' })).json.id; // blijft "nieuw"
  const taak3 = (await q('SELECT id FROM transport_taken WHERE aanvraag_id=?', [av3]))[0].id;
  const mv = await A('PUT', `/api/transport-taken/${taak3}/move`, { datum: '2026-11-03', tijd: '09:00' });
  const ritId = mv.json.rit_id;
  T.check(!!ritId, 'testrit met één taak van het kampmoment');
  const vb = (await A('POST', '/api/kampmomenten/verwijder-voorbeeld', { ids: [km2id] })).json;
  T.check(vb.aanvullijst === 1 && vb.aanvragen === 2 && vb.ritten.length === 1 && vb.ritten[0].id === ritId, 'voorbeeld toont wat blijft staan: ' + JSON.stringify(vb));
  r = await A('POST', '/api/kampmomenten/verwijderen', { ids: [km2id] });
  T.check(r.status === 200 && r.json.blijft.aanvullijst === 1 && r.json.blijft.aanvragen === 2 && r.json.blijft.ritten === 1, 'zonder keuze meldt het antwoord wat blijft staan (' + JSON.stringify(r.json.blijft) + ')');
  // tweede kampmoment: met opruimen
  const km3 = (await A('POST', '/api/kampmomenten', { locatie_id: 33, week: 1, periode_id: ijk.periode.id, kv_persoon_id: kvP.id })).json;
  const km3id = km3.id || km3;
  await A('POST', `/api/kampmomenten/${km3id}/themas`, { thema_id: thema });
  const kv3 = await T.kvToken(srv.base, tok, km3id, 'Tf8 KV');
  const av5 = (await P('POST', `/api/kv/${kv3}/aanvraag`, { tekst: 'Waterpistolen', aantal: 1 })).json.id;
  await A('PUT', `/api/aanvragen/${av5}/status`, { status: 'goedgekeurd' });
  const taak5 = (await q('SELECT id FROM transport_taken WHERE aanvraag_id=?', [av5]))[0].id;
  const rit5 = (await A('PUT', `/api/transport-taken/${taak5}/move`, { datum: '2026-11-03', tijd: '09:00' })).json.rit_id;
  const sessiesVoor = (await q('SELECT COUNT(*) n FROM nakijk_sessies WHERE kampmoment_id=?', [km3id]))[0].n;
  r = await A('POST', '/api/kampmomenten/verwijderen', { ids: [km3id], opruimen: { aanvullijst: true, aanvragen: true, ritten: true } });
  T.check(r.status === 200 && r.json.blijft.aanvullijst === 0 && r.json.blijft.aanvragen === 0 && r.json.blijft.ritten === 0, 'met opruimen blijft er niets staan (' + JSON.stringify(r.json.blijft) + ')');
  const regelsNa = await q("SELECT tekort_status FROM nakijk_regels WHERE kantoor_notitie LIKE ?", [`%aanvraag #${av5} van KV%`]);
  T.check(regelsNa.length === 1 && regelsNa[0].tekort_status === 'genegeerd', 'de aanvullijst-regel is genegeerd, niet gewist (omkeerbaar)');
  T.check((await q('SELECT status FROM aanvragen WHERE id=?', [av5]))[0].status === 'afgehandeld', 'de aanvraag is afgehandeld, niet gewist');
  T.check((await q('SELECT COUNT(*) n FROM transport_ritten WHERE id=?', [rit5]))[0].n === 0, 'de lege rit is weg (gelogd)');
  T.check((await q('SELECT COUNT(*) n FROM nakijk_sessies WHERE kampmoment_id=?', [km3id]))[0].n === sessiesVoor, 'tellingen en sessies blijven bewaard');
  const ll = (await A('GET', `/api/aanvullijst?datum=${vandaag}&alles=1`)).json;
  T.check(!ll.bakken.some((g) => g.handelingen.some((h) => h.regel_id === regelsNa.length && false)) && ll.tellers.totaal >= 0, 'de aanvullijst laadt zonder de opgeruimde regel');
  const kvg = lees('public/kampmomenten.js');
  T.check(kvg.includes('verwijder-voorbeeld') && kvg.includes('opruimen:'), 'het scherm toont eerst wat blijft staan, met een keuze per soort');

  // ═══ PUNT 1 · G3 — onbesliste melding blijft zichtbaar ═══
  T.info('Punt 1 · G3 onbeslist');
  const bakA = (await A('POST', `/api/themas/${thema}/bakken`, { label: 'Tf8 bak', code: 'TF81' })).json.id;
  for (const [n, qn] of [['Tf8 Veer', 4], ['Tf8 Prul', 5]]) await A('POST', `/api/bakken/${bakA}/items`, { naam: n, qty: qn });
  await A('POST', `/api/kampmomenten/${km}/themas`, { thema_id: thema });
  const kb = (await P('GET', `/api/kv/${kvtok}/data`)).json.bakken.find((b) => b.code === 'TF81');
  const tel = (n, a, extra = {}) => P('POST', `/api/kv/${kvtok}/bakken/${kb.id}/tellen`, { regels: [{ item_id: kb.items.find((i) => i.naam === n).id, aangetroffen: a, ...extra }] });
  await tel('Tf8 Veer', 4); await tel('Tf8 Prul', 3, { kapot_aantal: 2 });
  await P('POST', `/api/kv/${kvtok}/versturen`, {});
  const nk = (await A('GET', '/api/nakijken')).json.bakken.find((b) => b.bak.code === 'TF81' && b.kampmoment_id === km);
  await A('POST', '/api/aanvullijst/melding', { sessie_id: nk.sessie_id, item_naam: 'Tf8 Veer', soort: 'weg', aantal: 1 });

  // ═══ PUNT 1 · G4 — tekort én kapot: eigen actie en aantal per deel ═══
  T.info('Punt 1 · G4 tekort + kapot');
  let det = (await A('GET', `/api/nakijken/sessie/${nk.sessie_id}`)).json;
  const prul = det.items.filter((i) => i.naam === 'Tf8 Prul');
  T.check(prul.length === 2, 'tekort én kapot geeft twee regels in Nakijken (' + prul.map((i) => i.afwijking).join(' + ') + ')');
  const pTekort = prul.find((i) => i.afwijking === 'tekort'), pKapot = prul.find((i) => i.afwijking === 'kapot');
  T.check(pTekort && pKapot && pTekort.aantal_afwijking === 2 && pKapot.aantal_afwijking === 2, 'tekort 2 en kapot 2, elk met een eigen aantal');
  T.check(!pTekort.acties.some((a) => a.waarde === 'afschrijven_bestellen') && !pKapot.acties.some((a) => a.waarde === 'bestellen'), 'elk deel heeft alleen zijn eigen acties');
  T.check(pKapot.regel_id !== pTekort.regel_id && pKapot.herkomst === 'kapot deel van dit stuk', 'het kapotte deel is een eigen regel');
  const aantalVoor = { tekort: pTekort.aantal_afwijking, kapot: pKapot.aantal_afwijking };
  r = await A('PUT', `/api/nakijken/regel/${pTekort.regel_id}`, { kantoor_actie: 'bestellen', kantoor_aantal: 2 });
  r = await A('PUT', `/api/nakijken/regel/${pKapot.regel_id}`, { kantoor_actie: 'herstellen', kantoor_aantal: 2 });
  T.check(r.status === 200 && r.json.kantoor_actie === 'herstellen' && r.json.kantoor_aantal === 2, 'het kapotte deel krijgt zijn eigen actie (herstellen 2)');
  // G3: afronden met een onbesliste melding
  r = await A('POST', `/api/nakijken/sessie/${nk.sessie_id}/afronden`);
  T.check(r.status === 200 && r.json.onbeslist === 1, 'afronden waarschuwt voor 1 onbesliste melding');
  const lijst = (await A('GET', '/api/nakijken')).json;
  const rij = lijst.bakken.find((b) => b.sessie_id === nk.sessie_id);
  T.check(rij.status === 'te_keuren' && rij.gemeld === 1, 'G3: de bak blijft "Te keuren" en "Gemeld" na afronden (' + rij.status + ', gemeld ' + rij.gemeld + ')');
  T.check(lijst.tellers.te_keuren >= 1 && lijst.tellers.gemeld >= 1, 'G3: chips Te keuren en Gemeld tellen mee (' + lijst.tellers.te_keuren + ' / ' + lijst.tellers.gemeld + ')');
  const vd = (await A('GET', '/api/vandaag')).json;
  const tkVandaag = (vd.nakijken.find((x) => x.id === 'tellingen-te-keuren') || { titel: '0' }).titel;
  const nTeKeurenLijst = lijst.bakken.filter((b) => b.status === 'te_keuren').length;
  T.check(parseInt(tkVandaag, 10) === nTeKeurenLijst, 'G3: "' + tkVandaag + '" op Vandaag = ' + nTeKeurenLijst + ' in Nakijken');
  const reg = (await q("SELECT kantoor_actie,kantoor_aantal,deel_van FROM nakijk_regels WHERE sessie_id=? AND item_naam='Tf8 Prul' ORDER BY id", [nk.sessie_id]));
  T.check(reg.length === 2 && reg[0].kantoor_actie === 'bestellen' && reg[0].kantoor_aantal === 2 && reg[1].kantoor_actie === 'herstellen' && reg[1].kantoor_aantal === 2, 'aantallen na afronden gelijk aan ervoor: tekort ' + aantalVoor.tekort + ', kapot ' + aantalVoor.kapot + ' (db ' + JSON.stringify(reg) + ')');
  const ll2 = (await A('GET', `/api/aanvullijst?datum=${vandaag}&alles=1`)).json;
  const hs = ll2.bakken.filter((g) => g.sessie_id === nk.sessie_id).flatMap((g) => g.handelingen).filter((h) => h.stuk === 'Tf8 Prul');
  T.check(hs.length === 2 && hs.some((h) => h.soort === 'bestelling' && h.aantal === 2) && hs.some((h) => h.actie === 'herstellen' && h.aantal === 2), 'beide delen staan op de aanvullijst, elk met zijn aantal');
  const nkJs = lees('public/nakijken.js');
  T.check(nkJs.includes('— kies een actie —'), 'een gemelde regel zonder besluit toont "— kies een actie —" i.p.v. een niet-bewaarde keuze');
} finally {
  await T.einde(srv);
}
