// test-tf5-coordinator.mjs — TF5 punt 6: de coördinator zoekt op (bak, artikel, locatie), belt en bericht kantoor. Alleen lezen, plus één schrijfroute.
import * as T from './_testhulp.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Z = require(T.ROOT + '/public/zoeken.js'), M = require(T.ROOT + '/public/meer.js');
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: Number(process.env.TEST_POORT) || 3374 });
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const pers = async (naam, rol, pin) => { const x = (await A('POST', '/api/personeel', { naam, rol })).json; await A('POST', `/api/personeel/${x.id}/pincode`, { pincode: pin }); return { id: x.id, tok: await T.login(srv.base, x.id, pin) }; };
  const co = await pers('Zoek Coord', 'coordinator', '5831'), ch = await pers('Zoek Chauffeur', 'chauffeur', '5832'), mo = await pers('Zoek Monitor', 'monitor', '5833');
  const C = (m, p, b) => T.api(srv.base, co.tok, m, p, b);
  const bak = (await A('POST', `/api/themas/${ijk.themas.alles_op_wieltjes}/bakken`, { label: 'Zoekbak', code: 'ZK77' })).json.id;
  await A('POST', `/api/bakken/${bak}/items`, { naam: 'Zoekhoepel', qty: 2 });
  const nu = new Date(), DAG = `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, '0')}-${String(nu.getDate()).padStart(2, '0')}`;
  const rit = (await A('POST', '/api/ritten', { datum: DAG, vertrek: '09:00', personeel_id: ch.id })).json;
  const lo = (await A('GET', '/api/locaties')).json;
  await A('POST', '/api/transport-taken', { type: 'levering', datum: DAG, tijd: '09:30', van_locatie_id: ijk.locaties.rozenweg, naar_locatie_id: lo.find((l) => /abdij/i.test(l.name)).id, rit_id: rit.id, regels: [{ naam: 'Bak Zoekbak (ZK77)', qty: 1, soort: 'thema', bak_id: bak }] });
  const type = (await A('GET', '/api/item-types')).json.find((x) => x.naam === 'Zoekhoepel');
  await A('PUT', `/api/catalogus/${type.id}/voorraad`, { locatie_id: ijk.locaties.rozenweg, qty: 12 });

  const b = await C('GET', '/api/opzoeken/bakken?q=zk77');
  T.check(b.status === 200 && b.json.bakken.length === 1 && b.json.bakken[0].locatie && b.json.bakken[0].plaats.includes('rek Z') && b.json.bakken[0].rit.id === rit.id, `bak op code: ${JSON.stringify(b.json.bakken[0])}`);
  T.check((await C('GET', '/api/opzoeken/bakken?q=zoekbak')).json.bakken.length === 1, 'bak op naam');
  T.check(/ZK77/.test(Z.bakken(b.json)) && /Eerstvolgende rit/.test(Z.bakken(b.json)), 'scherm toont plaats en rit');
  const a = await C('GET', '/api/opzoeken/artikelen?q=zoekhoepel');
  T.check(a.json.artikelen[0].voorraad.some((v) => v.stockage === 'Rozenweg' && v.qty === 12) && a.json.artikelen[0].bakken.some((x) => x.code === 'ZK77'), 'artikel: voorraad per stockage en in welke bak');
  T.check((await C('GET', '/api/opzoeken/artikelen?id=' + type.id)).json.artikelen[0].naam === 'Zoekhoepel', 'artikel op id (link vanuit Tekorten)');
  await A('PUT', `/api/locaties/${ijk.locaties.rozenweg}`, { ...lo.find((l) => l.id === ijk.locaties.rozenweg), contact_tel: '0470 11 22 33' });
  const l = await C('GET', '/api/opzoeken/locaties?q=rozenweg');
  const r0 = l.json.locaties[0];
  T.check(r0.adres && r0.contact_telefoon === '0470 11 22 33' && /google\.com\/maps/.test(r0.kaart), 'locatie: adres, telefoon, kaartlink');
  T.check(/href="tel:0470112233"/.test(Z.locaties(l.json)) && /Kaart/.test(Z.locaties(l.json)), 'telefoon is tikbaar, kaartlink aanwezig');

  // Geen pincode of hash, geen personeelsgegevens.
  const alles = [b.text, a.text, l.text, (await C('GET', '/api/opzoeken/kantoor')).text].join(' ');
  T.check(!/pincode|scrypt|\$2[aby]\$|pin_hash/i.test(alles), 'geen pincode of hash in de antwoorden');

  // Schrijven blijft dicht.
  const schrijf = [['POST', `/api/themas/${ijk.themas.alles_op_wieltjes}/bakken`], ['PUT', `/api/bakken/${bak}`], ['DELETE', `/api/bakken/${bak}`], ['PUT', `/api/catalogus/${type.id}/voorraad`], ['DELETE', `/api/catalogus/${type.id}`], ['PUT', `/api/locaties/${r0.id}`], ['DELETE', `/api/locaties/${r0.id}`], ['POST', '/api/meldingen'], ['POST', '/api/opzoeken/bakken'], ['PUT', '/api/opzoeken/locaties']];
  const open = []; for (const [m, p] of schrijf) { const x = await C(m, p, {}); if (x.status !== 403) open.push(`${m} ${p} ${x.status}`); }
  T.check(!open.length, `alle schrijfpogingen 403 ${open.join(' | ')}`);
  // Andere rollen niet.
  for (const [naam, t] of [['chauffeur', ch.tok], ['monitor', mo.tok]]) {
    const st = []; for (const p of ['/api/opzoeken/bakken?q=a', '/api/opzoeken/artikelen?q=a', '/api/opzoeken/locaties?q=a', '/api/opzoeken/kantoor']) st.push((await T.api(srv.base, t, 'GET', p)).status);
    T.check(st.every((x) => x === 403) && (await T.api(srv.base, t, 'POST', '/api/bericht-kantoor', { tekst: 'x' })).status === 403, `${naam}: geen opzoeken en geen bericht`);
  }
  T.check((await T.api(srv.base, null, 'GET', '/api/opzoeken/bakken?q=a')).status === 401, 'anoniem 401');

  // Bericht
  T.check((await C('POST', '/api/bericht-kantoor', { tekst: '  ' })).status === 400, 'leeg bericht geweigerd');
  T.check((await C('POST', '/api/bericht-kantoor', { tekst: 'Sleutel Abdij ligt niet op zijn plaats', voor_rol: 'chauffeur', voor_persoon_id: ch.id })).status === 200, 'bericht verstuurd (ontvanger uit de body wordt genegeerd)');
  const mk = (await A('GET', '/api/meldingen')).json.meldingen.filter((m) => /Sleutel Abdij/.test(m.tekst));
  T.check(mk.length === 1 && mk[0].van_naam === 'Zoek Coord' && mk[0].voor_rol === 'kantoor', 'komt één keer bij kantoor, met de naam');
  T.check(!(await T.api(srv.base, ch.tok, 'GET', '/api/meldingen')).json.meldingen.some((m) => /Sleutel Abdij/.test(m.tekst)), 'chauffeur krijgt het niet');
  await new Promise((r) => setTimeout(r, 700));
  T.check((await T.leesDb(srv.dbPad, "SELECT COUNT(*) AS n FROM wijzigingen WHERE tabel='meldingen' AND nieuw LIKE '%Sleutel Abdij%'"))[0].n >= 1 && (await T.leesDb(srv.dbPad, "SELECT COUNT(*) AS n FROM activiteiten_log WHERE details LIKE '%Sleutel Abdij%' OR beschrijving LIKE '%Sleutel Abdij%'").catch(() => [{ n: 1 }]))[0].n >= 1, 'bericht is gelogd');

  // Meer
  const m0 = M.html({ rol: 'coordinator', naam: 'x', kantoorTel: '' }), m1 = M.html({ rol: 'coordinator', naam: 'x', kantoorTel: '016 11 22' });
  T.check(['Waar staat een bak', 'Artikelen', 'Locaties en contacten', 'Bericht aan kantoor', 'Geen kantoornummer ingesteld'].every((t) => m0.includes(t)) && !/Bel kantoor/.test(m0), 'Meer zonder nummer: tekst, geen knop');
  T.check(/href="tel:0161122"/.test(m1) && /Bel kantoor/.test(m1) && !/Geen kantoornummer/.test(m1), 'Meer met nummer: Bel kantoor');
  T.check(!/Waar staat een bak/.test(M.html({ rol: 'chauffeur', naam: 'x' })), 'chauffeur ziet deze items niet');
} catch (e) { T.fout('uitzondering: ' + e.message + ' ' + e.stack); console.log(srv.log().slice(-1500)); }
await T.einde(srv);
