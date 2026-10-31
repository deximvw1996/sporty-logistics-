// test-tf5-kv.mjs — TF5 punt 1 en 2: onwisbare KV-tellingen, natellen na versturen, heropenen zonder beslissing te wijzigen, link na het kamp, KV-scherm.
import * as T from './_testhulp.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const KV = require(T.ROOT + '/public/kv.js');
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: Number(process.env.TEST_POORT) || 3372 });
const wacht = () => new Promise((r) => setTimeout(r, 700));
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const km = ijk.kampmomenten.abdijschool, thema = ijk.themas.alles_op_wieltjes;
  const bakId = (await A('POST', `/api/themas/${thema}/bakken`, { label: 'Tf5 bak', code: 'TF51' })).json.id;
  for (const [n, q] of [['Politiepet', 1], ['Pion', 10], ['Lint', 3]]) await A('POST', `/api/bakken/${bakId}/items`, { naam: n, qty: q });
  await A('POST', `/api/kampmomenten/${km}/themas`, { thema_id: thema });
  const kt = await T.kvToken(srv.base, tok, km);
  const K = (m, p, b) => T.api(srv.base, null, m, `/api/kv/${kt}${p}`, b);
  const data = async () => (await K('GET', '/data')).json;
  const d0 = await data(), bk = d0.bakken.find((b) => b.code === 'TF51');
  const id = (n) => bk.items.find((i) => i.naam === n).id;
  const tel = (n, a, x = {}) => K('POST', `/bakken/${bk.id}/tellen`, { regels: [{ item_id: id(n), aangetroffen: a, ...x }] });
  const kantoorMeld = async () => (await A('GET', '/api/meldingen')).json.meldingen.filter((m) => /Telling/.test(m.tekst));

  // ── 10× natellen = 10 versies, geen oude rij gewijzigd ──
  for (let i = 0; i < 10; i++) await tel('Pion', 10 - (i % 3));
  await wacht();
  const v10 = await T.leesDb(srv.dbPad, "SELECT * FROM kv_telling_versies WHERE item_naam='Pion' AND code='TF51' ORDER BY id");
  T.check(v10.length === 10, `10× natellen = ${v10.length} versies`);
  await tel('Politiepet', 1); await tel('Lint', 3);
  const m0 = (await kantoorMeld()).length;
  T.check((await K('POST', '/versturen', {})).status === 200 && (await kantoorMeld()).length === m0 + 1, 'eerste keer versturen: één melding');
  let d = await data();
  T.check(d.verstuurd && d.verstuurd.op && d.niet_verstuurd === 0, 'scherm: verstuurd met tijdstip, 0 nog niet verstuurd');
  const m1 = (await kantoorMeld()).length;
  await K('POST', '/versturen', {});
  T.check((await kantoorMeld()).length === m1, 'versturen zonder wijziging: geen melding');
  await tel('Lint', 3); // zelfde waarde
  await K('POST', '/versturen', {});
  T.check((await kantoorMeld()).length === m1, 'zelfde waarde opnieuw geteld en verstuurd: geen melding');

  // ── natelling na versturen ──
  await tel('Politiepet', 0, { notitie: 'weg' });
  d = await data();
  T.check(d.niet_verstuurd === 1 && d.bakken.find((b) => b.code === 'TF51').items.find((i) => i.naam === 'Politiepet').aangetroffen === 0, 'natelling: KV ziet 0 en "1 nog niet verstuurd"');
  const html = KV.tellenHtml(d, false);
  T.check(/1 wijziging nog niet verstuurd/.test(html) && /Verstuurd om/.test(html) && !/maandag nakijken/.test(html), 'KV-scherm toont beide teksten, geen "maandag nakijken"');
  await K('POST', '/versturen', {});
  const m2 = await kantoorMeld();
  T.check(m2.length === m1 + 1 && m2[0].tekst.includes("TF51: Politiepet 1 → 0, 'weg'"), `melding met wat veranderde: "${m2[0].tekst}"`);

  // ── afgeronde keuring heropent; beslissing blijft ──
  const nk = async () => (await A('GET', '/api/nakijken')).json.bakken.find((b) => b.bak.code === 'TF51' && b.kampmoment_id === km);
  const sid = (await nk()).sessie_id;
  let det = (await A('GET', `/api/nakijken/sessie/${sid}`)).json;
  const pet = () => det.items.find((i) => i.naam === 'Politiepet'), pion = () => det.items.find((i) => i.naam === 'Pion');
  await A('PUT', `/api/nakijken/regel/${pet().regel_id}`, { kantoor_actie: 'bestellen', kantoor_aantal: 1 });
  await A('PUT', `/api/nakijken/regel/${pion().regel_id}`, { kantoor_actie: 'uit_pool' });
  T.check((await A('POST', `/api/nakijken/sessie/${sid}/afronden`)).status === 200, 'keuring afgerond');
  await wacht();
  const voorRegels = await T.leesDb(srv.dbPad, 'SELECT id,aangetroffen,kantoor_actie,kantoor_aantal,besteld FROM nakijk_regels WHERE sessie_id=? ORDER BY id', [sid]);
  const pionVoor = pion();
  await tel('Pion', pionVoor.aangetroffen - 2, { notitie: 'nog twee weg' });
  await K('POST', '/versturen', {});
  await wacht();
  const naRegels = await T.leesDb(srv.dbPad, 'SELECT id,aangetroffen,kantoor_actie,kantoor_aantal,besteld FROM nakijk_regels WHERE sessie_id=? ORDER BY id', [sid]);
  T.check(voorRegels.every((r) => JSON.stringify(r) === JSON.stringify(naRegels.find((x) => x.id === r.id))), 'beslissingen en cijfers van bestaande regels ongewijzigd');
  const nieuw = naRegels.filter((r) => !voorRegels.some((x) => x.id === r.id));
  T.check(nieuw.length === 1 && nieuw[0].kantoor_aantal === 2, `nieuwe afwijking = nieuwe regel van 2 (${JSON.stringify(nieuw)})`);
  T.check((await nk()).status === 'te_keuren', 'afgeronde keuring is heropend');
  await tel('Pion', pionVoor.aangetroffen - 3); await K('POST', '/versturen', {}); await wacht();
  const na3 = await T.leesDb(srv.dbPad, 'SELECT id,kantoor_aantal FROM nakijk_regels WHERE sessie_id=? ORDER BY id', [sid]);
  T.check(na3.length === naRegels.length && na3.find((r) => r.id === nieuw[0].id).kantoor_aantal === 3, 'nog één weg: opgeteld op de open regel (3)');

  // ── historiek in Nakijken ──
  det = (await A('GET', `/api/nakijken/sessie/${sid}`)).json;
  T.check(pion().eerdere_tellingen.length >= 11 && pion().laatste_telling.geteld === pionVoor.aangetroffen - 3 && pion().laatste_telling.wie, `Nakijken: laatste stand + ${pion().eerdere_tellingen.length} eerdere tellingen`);
  const NK = require(T.ROOT + '/public/nakijken.js');
  T.check(/Eerdere tellingen/.test(NK.detailHtml(det, {})) && /nog twee weg/.test(NK.detailHtml(det, {})), 'Nakijken-detail toont de uitklap met notitie');

  // ── onwisbaar: triggers en geen oude rij gewijzigd ──
  await wacht();
  const v10b = await T.leesDb(srv.dbPad, 'SELECT * FROM kv_telling_versies WHERE id<=? AND item_naam=\'Pion\' AND code=\'TF51\' ORDER BY id', [v10[9].id]);
  T.check(JSON.stringify(v10b) === JSON.stringify(v10), 'DB: de eerste 10 versies zijn letterlijk gelijk gebleven');
  const SQL = await (await import('sql.js')).default();
  const dbb = new SQL.Database((await import('node:fs')).readFileSync(srv.dbPad));
  let geweigerd = 0; for (const q of ['UPDATE kv_telling_versies SET geteld=99', 'DELETE FROM kv_telling_versies', 'DELETE FROM kv_verstuurd']) { try { dbb.run(q); } catch { geweigerd++; } }
  T.check(geweigerd === 3, 'database weigert wijzigen en wissen');

  // ── KV-scherm ──
  const b = d.bakken.find((x) => x.code === 'TF51');
  T.check(b.thema && 'groep' in b, `bak heeft thema: ${b.thema}`);
  const tweeThemas = { ...d, attributen: [], bakken: [{ ...b, thema: 'A', groep: '6-8' }, { ...b, id: 999, thema: 'B', groep: '9-12' }] };
  T.check(/A · 6-8/.test(KV.tellenHtml(tweeThemas, false)) && /B · 9-12/.test(KV.tellenHtml(tweeThemas, false)), 'twee thema\'s gegroepeerd');
  const leeg = { ...d, attributen: [], bakken: [], kantoor: { telefoon: '' } };
  T.check(/niets te tellen/.test(KV.tellenHtml(leeg, false)) && !/tel:/.test(KV.tellenHtml(leeg, false)), 'zonder bak: uitleg, zonder nummer geen knop');
  T.check(/tel:016/.test(KV.tellenHtml({ ...leeg, kantoor: { telefoon: '016 123' } }, false)), 'zonder bak, met nummer: belknop');
  const vers = { ...b, items: b.items.map((i, n) => ({ ...i, aangetroffen: n ? null : i.aangetroffen })) };
  T.check(/stuks in orde/.test(KV.bakHtml({ ...d, bakken: [vers] }, b.id, {})) && /Kapot melden/.test(KV.bakHtml({ ...d, bakken: [vers] }, b.id, {})), 'Rest klopt zegt hoeveel; Kapot melden op het telscherm');
  const aan = (await K('POST', '/aanvraag', { tekst: 'krijt' })).json;
  T.check(/\d+ \w+ · \d\d:\d\d/.test(KV.aanvragenHtml({ ...d, aanvragen: [{ ...aan, antwoord: '', foto_url: null }] })), 'aanvraag: tijdstip in dezelfde vorm');

  // ── link na het kamp ──
  const dag = (iso, n) => { const x = new Date(iso + 'T12:00:00'); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const nu = new Date(), vandaag = `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, '0')}-${String(nu.getDate()).padStart(2, '0')}`;
  const kmRij = (await T.leesDb(srv.dbPad, 'SELECT * FROM kampmomenten WHERE id=?', [km]))[0], per = kmRij.periode_id, wk = kmRij.week;
  const zetEinde = async (dagenGeleden) => { const start = dag(dag(vandaag, -dagenGeleden), -((wk - 1) * 7 + 4)); return A('PUT', `/api/periodes/${per}`, { naam: 'Herfst TEST', start_datum: start, eind_datum: dag(start, 60) }); };
  const z13 = await zetEinde(13);
  T.check(z13.status === 200, `periode verzet: ${z13.status} ${z13.text.slice(0, 80)}`);
  const l13 = await K('GET', '/data');
  T.check(l13.status === 200 && l13.json.link_stand === 'lezen', `13 dagen na het einde: lezen (${l13.json.link_stand})`);
  const s13 = await K('POST', `/bakken/${bk.id}/tellen`, { regels: [{ item_id: id('Lint'), aangetroffen: 1 }] });
  T.check(s13.status === 403 && /afgelopen/.test(s13.json.error) && (await K('POST', '/aanvraag', { tekst: 'x' })).status === 403 && (await K('POST', '/versturen', {})).status === 403, 'schrijven 403 met uitleg');
  T.check(/Dit kamp is afgelopen/.test(KV.schermHtml(l13.json, { scherm: 'tellen' })), 'scherm legt het uit');
  await zetEinde(15);
  T.check((await K('GET', '/data')).status === 403 && (await T.api(srv.base, null, 'GET', '/kv/' + kt)).status === 410 && /afgelopen/.test((await T.api(srv.base, null, 'GET', '/kv/' + kt)).text), '15 dagen: dicht, nette pagina');
  await wacht();
  T.check((await T.leesDb(srv.dbPad, "SELECT COUNT(*) AS n FROM kv_telling_versies WHERE code='TF51'"))[0].n >= 13, 'tellingen blijven bewaard na sluiten');
} catch (e) { T.fout('uitzondering: ' + e.message + ' ' + e.stack); console.log(srv.log().slice(-1500)); }
await T.einde(srv);
 