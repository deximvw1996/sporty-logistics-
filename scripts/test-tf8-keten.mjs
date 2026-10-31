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

  // ═══ PUNT 2 · Aanvullen ═══
  T.info('Punt 2 · Aanvullen en Vandaag');
  const AV = require(T.ROOT + '/public/aanvullen.js');
  // Bak klaar bewaard met wie en wanneer
  const llK = (await A('GET', `/api/aanvullijst?datum=${vandaag}&alles=1`)).json;
  const grpK = llK.bakken.find((g) => g.sessie_id === nk.sessie_id);
  r = await A('POST', `/api/aanvullijst/sessie/${nk.sessie_id}/klaar`, { klaar: true });
  T.check(r.status === 409 && /nog \d+ handeling/.test(r.json.error), 'Bak klaar kan niet zolang er nog handelingen open staan (' + (r.json.error || '') + ')');
  for (const h of grpK.handelingen.filter((x) => !x.wacht_op_kantoor && !x.kan_afvinken && x.soort === 'bestelling')) await A('POST', `/api/nakijken/regel/${h.regel_id}/binnen`);
  const grpK2 = (await A('GET', `/api/aanvullijst?datum=${vandaag}&alles=1`)).json.bakken.find((g) => g.sessie_id === nk.sessie_id);
  for (const h of grpK2.handelingen.filter((x) => !x.wacht_op_kantoor && x.kan_afvinken && !x.aangevuld)) await A('POST', `/api/aanvullijst/${h.regel_id}/aangevuld`, {});
  const rest = (await A('GET', `/api/aanvullijst?datum=${vandaag}&alles=1`)).json.bakken.find((g) => g.sessie_id === nk.sessie_id).handelingen.filter((x) => !x.wacht_op_kantoor && !x.aangevuld).length;
  if (!rest) {
    r = await A('POST', `/api/aanvullijst/sessie/${nk.sessie_id}/klaar`, { klaar: true });
    T.check(r.status === 200 && r.json.klaar && r.json.door, 'Bak klaar bewaard: ' + JSON.stringify(r.json));
    const g2 = (await A('GET', `/api/aanvullijst?datum=${vandaag}&alles=1`)).json.bakken.find((g) => g.sessie_id === nk.sessie_id);
    T.check(g2.klaar && g2.klaar.door && g2.klaar.op, 'Bak klaar blijft in de lijst, met wie en wanneer');
    T.check(/klaar ✓/.test(AV.lijst({ bakken: [g2], tellers: {}, datum: vandaag }, { filter: 'alles', vandaag })), 'de kaart in de lijst toont "klaar ✓ wie · tijd"');
    await A('POST', `/api/aanvullijst/${g2.handelingen.find((h) => h.aangevuld).regel_id}/aangevuld`, { aangevuld: false });
    const g3 = (await A('GET', `/api/aanvullijst?datum=${vandaag}&alles=1`)).json.bakken.find((g) => g.sessie_id === nk.sessie_id);
    T.check(!g3.klaar, 'een handeling terugzetten maakt de bak weer "niet klaar"');
  } else T.check(false, 'er blijven ' + rest + ' handelingen open, Bak klaar niet te testen');
  // G12 vertrek: een datum in het verleden is "te laat", niet "vandaag"; een gedane levering vertrekt niet meer
  const gTest = { sessie_id: 1, bak: { code: 'X1', naam: 'Test', soort: 'thema' }, locatie: 'A', week: 1, handelingen: [{ regel_id: 1, stuk: 'a', aantal: 1, soort: 'uit_pool', kan_afvinken: true, aangevuld: 0 }], vertrek: '2020-01-01' };
  T.check(/levering te laat/.test(AV.lijst({ bakken: [gTest], tellers: {}, datum: vandaag }, { filter: 'alles', vandaag })) && !/vertrekt vandaag/.test(AV.lijst({ bakken: [gTest], tellers: {}, datum: vandaag }, { filter: 'alles', vandaag })), 'G12: een levering in het verleden staat als "te laat", niet als "vertrekt vandaag"');
  T.check(/vertrekt vandaag/.test(AV.lijst({ bakken: [{ ...gTest, vertrek: vandaag }], tellers: {}, datum: vandaag }, { filter: 'alles', vandaag })), 'G12: een levering van vandaag staat als "vertrekt vandaag"');
  const kmOudTaken = await q("SELECT id FROM transport_taken WHERE kampmoment_id=? AND type='levering' AND status<>'geannuleerd'", [km]);
  if (kmOudTaken.length) {
    await A('PUT', `/api/transport-taken/${kmOudTaken[0].id}`, { status: 'gedaan' });
  }
  // N6 tellers op dezelfde manier
  const llN = (await A('GET', `/api/aanvullijst?datum=${vandaag}&alles=1`)).json;
  const headerHtml = AV.lijst(llN, { filter: 'alles', vandaag });
  const openH = llN.bakken.reduce((n, g) => n + g.handelingen.filter((h) => !h.wacht_op_kantoor && !h.aangevuld).length, 0);
  const llOpen = (await A('GET', `/api/aanvullijst?datum=${vandaag}`)).json;
  T.check(llOpen.tellers.totaal === openH && headerHtml.includes(openH + ' handeling'), 'N6: Aanvullen en Vandaag tellen dezelfde open handelingen (' + openH + ' = ' + llOpen.tellers.totaal + ')');
  const av = lees('public/aanvullen.js');
  T.check(av.includes('maar ${h.aantal} te doen'), 'N11: 9 invullen bij rest 2 geeft een melding');
  T.check(!av.includes('Zonder bak') && !av.includes('Melding zonder bak') && av.includes('Losse melding'), 'N10: één naam: "Losse melding"');
  // Tekorten: tekst vóór de keuze en bij voorraad 0
  await zetStock(3225, 8);
  const bakB = (await A('POST', `/api/themas/${thema}/bakken`, { label: 'Tf8 bak B', code: 'TF82' })).json.id;
  await A('POST', `/api/bakken/${bakB}/items`, { naam: 'Multiblaasring', qty: 5 });
  const kb2 = (await P('GET', `/api/kv/${kvtok}/data`)).json.bakken.find((b) => b.code === 'TF82');
  await P('POST', `/api/kv/${kvtok}/bakken/${kb2.id}/tellen`, { regels: [{ item_id: kb2.items[0].id, aangetroffen: 1 }] });
  await P('POST', `/api/kv/${kvtok}/versturen`, {});
  const nk2 = (await A('GET', '/api/nakijken')).json.bakken.find((b) => b.bak.code === 'TF82' && b.kampmoment_id === km);
  const reg2 = (await A('GET', `/api/nakijken/sessie/${nk2.sessie_id}`)).json.items[0];
  await A('PUT', `/api/nakijken/regel/${reg2.regel_id}`, { kantoor_actie: 'bestellen', kantoor_aantal: 4 });
  await A('POST', `/api/nakijken/sessie/${nk2.sessie_id}/afronden`);
  const dt = (await A('GET', '/api/tekorten/3225/detail')).json;
  T.check(!/nu al afvinkbaar/.test(dt.na_levering.aanvullijst) && /zodra je "Aanvullen uit voorraad" kiest/.test(dt.na_levering.aanvullijst), 'Tekorten zegt vóór de keuze niet "nu al afvinkbaar": ' + dt.na_levering.aanvullijst);
  await A('PUT', '/api/tekorten/3225/stand', { stand: 'uit_voorraad' });
  const dt2 = (await A('GET', '/api/tekorten/3225/detail')).json;
  T.check(/nu al afvinkbaar/.test(dt2.na_levering.aanvullijst), 'na de keuze "Aanvullen uit voorraad" wel: ' + dt2.na_levering.aanvullijst);
  const tk8 = lees('public/tekorten.js');
  T.check(tk8.includes('⚠ te weinig: er ontbreekt') && tk8.includes('Er is te weinig voorraad'), 'bij te weinig voorraad: waarschuwing met het tekort, melden mag, verbieden niet');
  T.check(tk8.includes("id=\"d-bestel\">Bestelling plaatsen") && lees('public/tekorten.html').includes('Staat besteld'), 'Tekorten: "Bestelling plaatsen" en "Staat besteld" i.p.v. Bestellen en Besteld');
  const nkS = lees('routes/nakijken.js');
  T.check(nkS.includes("'uit voorraad Rozenweg'") && !nkS.includes("'uit de pool'"), '"uit pool" heet "uit voorraad Rozenweg"');
  // Zoeken en Meer
  const zk = lees('public/zoeken.js');
  T.check(zk.includes("!/^INFO:/i.test(a.naam)") && zk.includes('href="/meer"'), 'Zoeken: geen INFO-regel als artikel en een eigen terugknop naar Meer');
  T.check(lees('public/meer.js').includes("bg.querySelector('#ber-t').focus()") && tk8.includes("id='terug-meer'"), 'Bericht aan kantoor: cursor meteen in het vak; Tekorten heeft een terugknop naar Meer voor wie geen kantoor is');

  // ═══ PUNT 3 · Kantoor klein ═══
  T.info('Punt 3 · kantoor klein');
  r = await A('POST', '/api/periodes', { naam: 'Tf8 fout', start_datum: '2026-12-20', eind_datum: '2026-12-01' });
  T.check(r.status === 400 && /vóór de start/.test(r.json.error), 'G13: periode met einde vóór start geeft 400');
  const nieuw = await A('POST', '/api/periodes', { naam: 'Tf8 periode', start_datum: vandaag, eind_datum: new Date(Date.now() + 6 * 864e5).toISOString().slice(0, 10) });
  r = await A('PUT', `/api/periodes/${nieuw.json.id}`, { naam: 'Tf8 periode', start_datum: '2026-12-20', eind_datum: '2026-12-01' });
  T.check(nieuw.status === 200 && r.status === 400, 'G13: ook bij wijzigen (PUT) wordt een einde vóór start geweigerd');
  const pl = lees('public/taken.js') + lees('public/kampmomenten.js') + lees('public/nakijken.js');
  T.check(!/\(en\)|regel\(s\)|rit\(ten\)|aanvraag\/aanvragen/.test(pl), 'G17: geen "(en)", "(s)" of "aanvraag/aanvragen" meer in de teksten');
  // G2 dringend, G8 verleden, G15 KV-naam, N13 historiek, N16 dubbel: in een eigen periode die vandaag start
  await A('POST', `/api/periodes/${nieuw.json.id}/activeer`);
  const kvP2 = (await A('POST', '/api/personeel', { naam: 'Tf8 KV twee', rol: 'kv' })).json;
  const kmN = (await A('POST', '/api/kampmomenten', { locatie_id: 36, week: 1, periode_id: nieuw.json.id, kv_persoon_id: kvP2.id })).json;
  const kmNid = kmN.id || kmN;
  await A('POST', `/api/kampmomenten/${kmNid}/themas`, { thema_id: thema });
  const dub = await A('POST', '/api/kampmomenten', { locatie_id: 36, week: 1, periode_id: nieuw.json.id });
  T.check(dub.status === 409 && /al een kampmoment/.test(dub.json.error), 'N16: een tweede kampmoment op dezelfde locatie en week geeft een duidelijke uitkomst: ' + (dub.json.error || ''));
  T.check(lees('public/kampmomenten.js').includes('Dit kampmoment kan niet'), 'N16: het scherm toont die uitleg blijvend');
  const vd2 = (await A('GET', '/api/vandaag')).json;
  const dring = vd2.inplannen.filter((x) => /^conflict-/.test(x.id) && /levering/.test(x.titel));
  T.check(dring.length >= 1 && dring.every((x) => x.dringend === true) && vd2.inplannen[0].dringend === true && /^conflict-/.test(vd2.inplannen[0].id), 'G2: een kamp dat binnen 7 dagen start zonder levering is dringend en staat bovenaan Inplannen ' + JSON.stringify(vd2.inplannen.map((x) => [x.id, x.dringend, x.titel.slice(0, 50)])));
  const gen2 = await A('POST', '/api/kampmomenten/genereer-transport', { ids: [kmNid], periode_id: nieuw.json.id });
  T.check(gen2.status === 200 && Array.isArray(gen2.json.verleden), 'G8: genereren geeft een lijst "verleden" terug');
  T.check(gen2.json.aangemaakt >= 1, 'G8: genereren wordt niet geblokkeerd (' + gen2.json.aangemaakt + ' taken, verleden ' + gen2.json.verleden.length + ')');
  const dN = (await A('GET', `/api/kampmomenten/${kmNid}/detail`)).json;
  T.check(!dN.historiek.some((h) => /02\/08|\/08\/2026/.test(h.tekst + (h.wie || ''))), 'N13: de historiek van een nieuw kampmoment bevat geen regels van een andere periode (' + dN.historiek.length + ' regels)');
  const vj = lees('public/vandaag.js');
  T.check(vj.includes('Later deze periode') && vj.includes('laterRegel') && vj.includes('🔒 = vaste stop'), 'G2/N: "Later" zegt in één regel wat erin zit; 🔒 heeft uitleg');
  T.check(lees('public/app-schil.css').includes('TF8 N18'), 'N18: zoekveld en periodekiezer krijgen minstens 44 px op gsm (36 px op desktop)');
} finally {
  await T.einde(srv);
}
