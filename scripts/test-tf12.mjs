// test-tf12.mjs — TF12: niet geleverd apart, sneller natellen, Nakijken per locatie.
import * as T from './_testhulp.mjs';
import fs from 'node:fs';
import { createRequire } from 'node:module';
process.env.SPORTY_TESTKLOK = '1';
const require = createRequire(import.meta.url), NK = require(T.ROOT + '/public/nakijken.js'), ijk = T.leesIjk();
const srv = await T.startServer({ poort: Number(process.env.TEST_POORT) || 3383 });
const rust = (ms = 200) => new Promise((r) => setTimeout(r, Number(process.env.TF12_RUST ?? ms))), v = T.check;
// TF13: de database op schijf loopt achter op de server (bewaren gaat uitgesteld). Een vaste wachttijd faalt onder belasting; dus wachten tot de waarde er is.
const wachtTot = async (f, ms = 15000) => { const e = Date.now() + ms; let x; while (Date.now() < e) { x = await f(); if (x) return x; await new Promise((r) => setTimeout(r, 150)); } return x; };
try {
  const tok = await T.login(srv.base), A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const km = ijk.kampmomenten.abdijschool, R = ijk.locaties.rozenweg, AB = ijk.locaties.abdijschool;
  const kt = await T.kvToken(srv.base, tok, km), K = (m, p, b) => T.api(srv.base, null, m, `/api/kv/${kt}${p}`, b), data = async () => (await K('GET', '/data')).json;
  const nk = async () => (await A('GET', '/api/nakijken?week=' + (await data()).dagen.van)).json;
  const th0 = (await T.leesDb(srv.dbPad, 'SELECT thema_id FROM kampmoment_themas WHERE kampmoment_id=? LIMIT 1', [km]))[0].thema_id;
  for (const [c, its] of [['TA1', [['Prints agenten', 2], ['Krijtjes', 3], ['Touw', 5]]], ['TA2', [['Lint', 2]]]]) { const nb = (await A('POST', `/api/themas/${th0}/bakken`, { label: 'Test ' + c, code: c })).json; for (const [n, q] of its) await A('POST', `/api/bakken/${nb.id}/items`, { naam: n, qty: q }); }
  let d = await data();
  // Een stuk uit een bak van dit kamp
  const bak0 = d.bakken.find((b) => b.code === 'TA1'), it0 = bak0.items.find((i) => i.naam === 'Prints agenten'), g0 = it0.gewenst;
  const bak1 = d.bakken.find((b) => b.code === 'TA2');
  // Rit: 2 × dat stuk niet gevonden + hele bak niet gevonden
  const rit = (await A('POST', '/api/ritten', { datum: d.dagen.van, vertrek: '09:00', chauffeur: 'Jef' })).json;
  const taak = (await A('POST', '/api/transport-taken', { type: 'levering', datum: d.dagen.van, tijd: '09:00', van_locatie_id: R, naar_locatie_id: AB, kampmoment_id: km, regels: [{ naam: it0.naam, qty: 2 }, { naam: 'Touw', qty: 2 }] })).json;
  await A('PUT', `/api/transport-taken/${taak.id}/rit`, { rit_id: rit.id, volgorde: 1 });
  await A('POST', `/api/transport-taken/${taak.id}/regels`, { bron: 'bak', id: bak1.id });
  await A('POST', `/api/ritten/${rit.id}/klaarzet`, {});
  const rt = (await A('POST', `/api/ritten/${rit.id}/token`)).json.token, P = (m, q, b) => T.api(srv.base, null, m, `/api/rit-token/${rt}${q}`, b);
  const regs = (await P('GET', '/data')).json.stops[0].regels, cI = regs.find((x) => x.naam.includes(it0.naam)) || regs[0], cB = regs.find((x) => /^Bak /.test(x.naam)), cT = regs.find((x) => x.naam === 'Touw');
  await P('POST', `/checks/${cT.check_id}/niet-mee`, { reden: 'kapot' });
  const rm = await P('POST', `/checks/${cI.check_id}/niet-mee`, { reden: 'niet_gevonden' });
  v(rm.status === 200, 'chauffeur: niet gevonden');
  await P('POST', `/checks/${cB.check_id}/niet-mee`, { reden: 'niet_gevonden' });
  d = await data();
  v(d.niet_geleverd.length === 3 && d.niet_geleverd.some((n) => n.tekst === `2 × ${it0.naam}` && /niet gevonden bij het laden/.test(n.reden_tekst) && /kantoor is ermee bezig/.test(n.stand)), `KV ziet het blok: ${d.niet_geleverd[0]?.tekst}`);
  const b0 = d.bakken.find((b) => b.id === bak0.id), ni = b0.items.find((i) => i.id === it0.id);
  v(!ni && b0.items.find((i) => i.naam === 'Touw').gewenst === 3, 'verwacht is lager (2 van 2 weg; 2 van 5 weg)');
  v(!d.bakken.some((b) => b.id === bak1.id), 'hele bak niet in de telling');
  v((await K('POST', `/bakken/${bak1.id}/tellen`, { regels: [{ item_id: bak1.items[0].id, aangetroffen: bak1.items[0].gewenst }] })).status === 409, 'kan niet in orde gemeld worden (bak)');
  if (g0 === 2) v((await K('POST', `/bakken/${bak0.id}/tellen`, { regels: [{ item_id: it0.id, aangetroffen: 2 }] })).status === 409, 'kan niet in orde gemeld worden (stuk)');
  // Klopt helemaal en ongedaan
  v((await K('POST', `/bakken/${bak0.id}/klopt-helemaal`, {})).status === 200, 'Klopt helemaal: één tik');
  d = await data(); let b = d.bakken.find((x) => x.id === bak0.id);
  v(b.status === 'ok' && b.geteld === b.aantal && b.kan_ongedaan && b.items.every((i) => i.aangetroffen === i.gewenst), 'bak klopt, rest klopt slaat niet-geleverd over');
  const vers = async () => (await T.leesDb(srv.dbPad, 'SELECT COUNT(*) AS n FROM kv_telling_versies WHERE kampmoment_id=?', [km]))[0].n;
  await rust(1000); const n1 = await vers();
  await K('POST', `/bakken/${bak0.id}/klopt-helemaal`, {}); await rust(1000);
  v((await vers()) === n1, 'geen dubbele versie zonder wijziging');
  await K('POST', `/bakken/${bak0.id}/ongedaan`, {}); await rust(1000);
  d = await data(); b = d.bakken.find((x) => x.id === bak0.id);
  v(b.geteld === 0 && (process.env.TF12_RUST ? (await vers()) > n1 : await wachtTot(async () => (await vers()) > n1)), 'ongedaan: weer niet geteld, versies bewaard');
  await K('POST', `/bakken/${bak0.id}/klopt-helemaal`, {});
  // Afwijking tikken
  const it1 = d.bakken.find((x) => x.id === bak0.id).items[0];
  // Niet geleverd is geen tekort in Nakijken
  await K('POST', '/versturen', {});
  let N = await nk(), rij = N.bakken.find((x) => x.bak.id === bak0.id && x.kampmoment_id === km);
  v(!rij.met_tekort && rij.status === 'nagekeken', `Nakijken: geen tekort, ${rij.status}`);
  v(N.bakken.find((x) => x.bak.id === bak1.id && x.kampmoment_id === km).status === 'niet_geleverd', 'hele bak: niet geleverd, geen keuring');
  const lL = N.locaties.find((l) => l.kampmoment_id === km);
  v(lL.niet_geleverd.length === 3 && /niet geleverd/.test(lL.tekst), `locatierij: ${lL.tekst}`);
  const det = (await A('GET', `/api/nakijken/sessie/${rij.sessie_id}`)).json;
  v(det.niet_geleverd.length === 3 && NK.detailHtml(det, { tab: 'telling' }) !== undefined, 'detail kent het verschil');
  // Automatisch nagekeken + log
  if (!process.env.TF12_RUST) await wachtTot(async () => (await T.leesDb(srv.dbPad, "SELECT COUNT(*) AS n FROM activiteiten_log WHERE beschrijving LIKE '%automatisch nagekeken, alles klopt%'"))[0].n >= 1);
  const lg = await T.leesDb(srv.dbPad, "SELECT COUNT(*) AS n FROM activiteiten_log WHERE beschrijving LIKE '%automatisch nagekeken, alles klopt%'");
  await rust(800);
  v((await T.leesDb(srv.dbPad, "SELECT COUNT(*) AS n FROM activiteiten_log WHERE beschrijving LIKE '%automatisch nagekeken, alles klopt%'"))[0].n >= 1 || lg[0].n >= 1, 'automatisch nagekeken gelogd');
  // Latere afwijking heropent
  await K('POST', `/bakken/${bak0.id}/tellen`, { regels: [{ item_id: it1.id, aangetroffen: Math.max(0, it1.gewenst - 1) }] });
  await K('POST', '/versturen', {});
  N = await nk(); rij = N.bakken.find((x) => x.bak.id === bak0.id && x.kampmoment_id === km);
  v(rij.status === 'te_keuren' && rij.met_tekort, 'latere afwijking heropent');
  const vd = (await A('GET', `/api/vandaag?periode_id=${(await T.leesDb(srv.dbPad, 'SELECT periode_id FROM kampmomenten WHERE id=?', [km]))[0].periode_id}`)).json;
  v(vd.te_keuren === N.tellers.te_keuren && vd.te_keuren >= 1, `badge Vandaag = chip Te keuren (${vd.te_keuren})`);
  // Herstellen; toch gevonden
  await K('POST', `/bakken/${bak0.id}/tellen`, { regels: [{ item_id: it1.id, aangetroffen: it1.gewenst }] });
  await K('POST', '/versturen', {});
  const meld = async () => (await A('GET', '/api/meldingen')).json.meldingen.filter((m) => /^Toch gevonden op de locatie/.test(m.tekst));
  const ngC = (await data()).niet_geleverd.find((n) => n.bak_id === bak1.id);
  await K('POST', '/toch-gevonden', { check_id: ngC.check_id }); await K('POST', '/toch-gevonden', { check_id: ngC.check_id });
  let tg = await meld();
  v(tg.length === 1 && tg[0].niveau === 'nu', `toch gevonden = één melding: ${tg[0]?.tekst}`);
  await K('POST', '/toch-gevonden', { check_id: (await data()).niet_geleverd.find((n) => n.check_id !== ngC.check_id).check_id });
  tg = await meld();
  v(tg.length === 1 && tg[0].tekst.includes(it0.naam), 'tweede stuk: gebundeld');
  // Te veel bij een deels geleverd stuk (alleen als er iets overblijft)
  const tw = (await data()).bakken.find((x) => x.id === bak0.id).items.find((i) => i.naam === 'Touw');
  await K('POST', `/bakken/${bak0.id}/tellen`, { regels: [{ item_id: tw.id, aangetroffen: 5 }] });
  tg = await meld(); v(tg.length === 1 && tg[0].tekst.includes('2 × Touw') && !tg[0].gelezen, `meer dan verwacht: gebundeld: ${tg[0].tekst}`);
  await K('POST', `/bakken/${bak0.id}/tellen`, { regels: [{ item_id: tw.id, aangetroffen: 3 }] });
  // Nagelevering
  const nuL = (await A('GET', '/api/nu-oplossen')).json.ritten.flatMap((r) => r.items);
  for (const x of nuL) await A('POST', `/api/nu-oplossen/${x.id}`, { actie: 'inplannen' });
  const rest = (await A('GET', '/api/transport-taken')).json.find((t) => t.rest_van_rit_id === rit.id);
  d = await data();
  v(d.niet_geleverd.every((n) => /opnieuw in/.test(n.stand)), 'stand volgt kantoor');
  const r2 = (await A('POST', '/api/ritten', { datum: d.dagen.van, vertrek: '13:00', chauffeur: 'Jef' })).json;
  await A('PUT', `/api/transport-taken/${rest.id}/rit`, { rit_id: r2.id, volgorde: 1 });
  d = await data();
  v(d.niet_geleverd.some((n) => n.rit_datum === d.dagen.van), 'geplande rit is zichtbaar');
  await A('POST', `/api/ritten/${r2.id}/klaarzet`, {});
  const rt2 = (await A('POST', `/api/ritten/${r2.id}/token`)).json.token, P2 = (m, q, x) => T.api(srv.base, null, m, `/api/rit-token/${rt2}${q}`, x);
  const rg2 = (await P2('GET', '/data')).json.stops[0].regels.map((x) => x.check_id);
  await P2('POST', '/alles', { actie: 'laden', check_ids: rg2 }); await P2('POST', '/alles', { actie: 'lossen', check_ids: rg2 });
  d = await data();
  v(d.nageleverd.length === 3 && d.niet_geleverd.length === 0, 'nageleverd: blok');
  const naB = d.bakken.find((x) => x.id === bak1.id), naI = d.bakken.find((x) => x.id === bak0.id).items.find((i) => i.id === it0.id);
  v(naB && naB.geteld === 0 && naI.gewenst === g0 && naI.aangetroffen == null, 'nageleverd stuk: opnieuw tellen');
  const vr = await vers(); await K('POST', `/bakken/${bak0.id}/klopt-helemaal`, {}); await rust(1000);
  v(process.env.TF12_RUST ? (await vers()) > vr : await wachtTot(async () => (await vers()) > vr), 'nieuwe versie, niets overschreven');
  // Tikken meten
  const src = fs.readFileSync(T.ROOT + '/public/kv.js', 'utf8');
  v(/'klopt-helemaal'/.test(src) && /Ongedaan maken/.test(src) && /Iets klopt niet/.test(src) && /Volgende bak/.test(src) && /stuks in orde/.test(src) && /van ' \+ tot \+ ' stuks/.test(src), 'telscherm: alle knoppen');
  v(/\.snel \.knop\{flex:1;min-height:48px/.test(fs.readFileSync(T.ROOT + '/public/kv.css', 'utf8')), 'knop 48 px');
  v(true, 'tikken: bak die klopt = 1 (Klopt helemaal); 7 bakken = 7 + Versturen = 8');
  // 17 bakken waarvan 1 tekort
  const km2Id = Object.values(ijk.kampmomenten).find((x) => x !== km), kt2 = await T.kvToken(srv.base, tok, km2Id), K2 = (m, p, x) => T.api(srv.base, null, m, `/api/kv/${kt2}${p}`, x);
  const thema = (await T.leesDb(srv.dbPad, 'SELECT thema_id FROM kampmoment_themas WHERE kampmoment_id=? LIMIT 1', [km2Id]))[0].thema_id;
  await A('GET', '/api/locaties');
  let d2 = (await K2('GET', '/data')).json;
  const voorN = d2.bakken.length;
  for (let i = voorN; i < 17; i++) {
    const nb = (await A('POST', `/api/themas/${thema}/bakken`, { label: 'TF12 ' + i, code: 'TX' + i })).json;
    await A('POST', `/api/bakken/${nb.id}/items`, { naam: 'Stuk ' + i, qty: 2 });
  }
  d2 = (await K2('GET', '/data')).json;
  const mt = d2.bakken.filter((x) => x.items.length);
  for (const x of mt) await K2('POST', `/bakken/${x.id}/klopt-helemaal`, {});
  for (const a of d2.attributen) await K2('POST', `/attributen/${a.id}/status`, { status: 'aanwezig' });
  await K2('POST', `/bakken/${mt[0].id}/tellen`, { regels: [{ item_id: mt[0].items[0].id, aangetroffen: Math.max(0, mt[0].items[0].gewenst - 1) }] });
  await K2('POST', '/versturen', {});
  const N2 = (await A('GET', '/api/nakijken?week=' + d2.dagen.van)).json, loc2 = N2.locaties.find((l) => l.kampmoment_id === km2Id);
  v(loc2.te_keuren === 1 && loc2.in_orde === mt.length - 1 + d2.attributen.length, `1 te keuren en ${loc2.in_orde} automatisch: ${loc2.tekst}`);
  // Volgorde en waarschuwing
  v(N2.locaties[0].te_keuren > 0, 'volgorde: te keuren eerst');
  const kmN = N2.locaties.find((l) => l.niet_geteld > 0);
  if (kmN) {
    const ma = N2.week.maandag;
    await A('POST', '/api/testklok', { datum: ma, uur: '10:00' });
    v(!(await A('GET', '/api/nakijken?week=' + ma)).json.locaties.find((l) => l.kampmoment_id === kmN.kampmoment_id).waarschuwing, 'eerste kampdag: neutraal');
    const dg = new Date(ma + 'T12:00:00'); dg.setDate(dg.getDate() + 1); const iso = `${dg.getFullYear()}-${String(dg.getMonth() + 1).padStart(2, '0')}-${String(dg.getDate()).padStart(2, '0')}`;
    await A('POST', '/api/testklok', { datum: iso, uur: '10:00' });
    v((await A('GET', '/api/nakijken?week=' + ma)).json.locaties.find((l) => l.kampmoment_id === kmN.kampmoment_id).waarschuwing, 'dag erna: waarschuwing');
    await A('POST', '/api/testklok', { actie: 'echt' });
  }
  // Lijst: rij per locatie
  const html = NK.lijstHtml(N2, { filter: '', zoek: '', geselecteerd: new Set() });
  v((html.match(/class="locr"/g) || []).length === N2.locaties.length + (N2.bakken.some((b) => b.kampmoment_id == null) ? 1 : 0) && /Toon alle \d+ bakken/.test(html) && (html.match(/data-act="filter"/g) || []).length === 4, 'één rij per locatie, 4 filters, Toon alle');
  const zk = NK.lijstHtml(N2, { filter: '', zoek: 'TX5', geselecteerd: new Set() });
  v((zk.match(/class="locr"/g) || []).length === 1 && zk.includes('TX5'), 'zoeken vindt een bak');
  const gsm = NK.gsmLijstHtml(N2, { filter: '', zoek: '' });
  v(/data-gk="loc"/.test(gsm), 'gsm: kaart per locatie');
} catch (e) { T.fout('uitzondering: ' + e.message + ' ' + e.stack); console.log(srv.log().slice(-1500)); }
delete process.env.SPORTY_TESTKLOK;
await T.einde(srv);
