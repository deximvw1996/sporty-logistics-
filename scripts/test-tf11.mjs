// test-tf11.mjs — TF11: lege rit krijgt stop en materiaal tot gedaan; agenda volgt einde en vroege/late ritten; geschat tegenover echt.
import * as T from './_testhulp.mjs';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const RPJS = require(T.ROOT + '/public/ritplanning.js'), G = RPJS.gebaren;
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: Number(process.env.TEST_POORT) || 3381 });
const wacht = () => new Promise((r) => setTimeout(r, 600));
try {
  const tok = await T.login(srv.base), A = (m, p, b) => T.api(srv.base, tok, m, p, b), db = (q, p) => T.leesDb(srv.dbPad, q, p);
  const DAG = '2026-11-04', R = ijk.locaties.rozenweg, AB = (await A('GET', '/api/locaties')).json.find((l) => /abdij/i.test(l.name)).id;
  const ch = (await A('POST', '/api/personeel', { naam: 'Tf11 Chauffeur', rol: 'chauffeur' })).json;
  await A('POST', `/api/personeel/${ch.id}/pincode`, { pincode: '5881' });
  const chT = await T.login(srv.base, ch.id, '5881');
  const plan = async (id) => (await A('GET', `/api/ritplanning?week=${DAG}`)).json.dagen.flatMap((d) => d.ritten).find((x) => x.id === id);
  const rit = (await A('POST', '/api/ritten', { datum: DAG, vertrek: '09:00', einde: '12:00', personeel_id: ch.id })).json;
  let p = await plan(rit.id);
  T.check(p.lading.tekst === '0 bakken + 0 losse stuks' && p.meting.geschat === '12:00', 'lege rit, geschat einde bij Nieuwe rit');
  // Stop
  T.check((await A('POST', `/api/ritten/${rit.id}/stops`, { type: 'x', van_locatie_id: R, naar_locatie_id: AB })).status === 400, 'foute soort 400');
  const st = await A('POST', `/api/ritten/${rit.id}/stops`, { type: 'levering', van_locatie_id: R, naar_locatie_id: AB, tijd: '09:30' });
  T.check(st.status === 200, '+ Stop');
  const t = st.json.taak_id;
  // Materiaal zoeken
  const bak = (await A('POST', `/api/themas/${ijk.themas.alles_op_wieltjes}/bakken`, { label: 'Tf11 bak', code: 'TE01' })).json.id;
  const z = (await A('GET', '/api/rit-materiaal?q=te01')).json.resultaten;
  T.check(z.some((x) => x.bron === 'bak' && x.id === bak), 'zoeken vindt de bak');
  T.check((await A('GET', '/api/rit-materiaal?q=krijt')).json.resultaten.some((x) => x.bron === 'artikel'), 'zoeken vindt een artikel');
  const set = (await db('SELECT ss.id,si.name FROM sport_sets ss JOIN sport_items si ON si.id=ss.item_id LIMIT 1'))[0];
  T.check((await A('GET', '/api/rit-materiaal?q=' + encodeURIComponent(set.name))).json.resultaten.some((x) => x.bron === 'set'), 'zoeken vindt een sportset');
  const reg = (b) => A('POST', `/api/transport-taken/${t}/regels`, b);
  T.check((await reg({ bron: 'bak', id: bak })).status === 200 && (await reg({ bron: 'tekst', naam: 'Stoelen', qty: 4 })).status === 200 && (await reg({ bron: 'set', id: set.id })).status === 200, 'bak, vrije tekst en sportset toegevoegd');
  T.check((await reg({ bron: 'tekst', naam: '' })).status === 400, 'lege tekst 400');
  p = await plan(rit.id);
  T.check(p.lading.tekst === '1 bak + 5 losse stuks', `telling werkt bij: ${p.lading.tekst}`);
  const rg = p.stops[0].regels, st4 = rg.find((x) => x.naam === 'Stoelen');
  T.check((await A('PUT', `/api/transport-regels/${st4.id}`, { qty: 6 })).status === 200 && (await plan(rit.id)).lading.tekst === '1 bak + 7 losse stuks', 'aantal wijzigen');
  const weg = rg.find((x) => !/Stoelen|Bak/.test(x.naam));
  T.check((await A('DELETE', `/api/transport-regels/${weg.id}`)).status === 200 && (await plan(rit.id)).lading.tekst === '1 bak + 6 losse stuks', 'regel verwijderen');
  await wacht();
  T.check((await db("SELECT COUNT(*) AS n FROM wijzigingen WHERE tabel='transport_regels' AND rij_id=? ", [weg.id]))[0].n >= 2, 'gelogd');
  // Melding, geen verbod
  const r2 = (await A('POST', '/api/ritten', { datum: DAG, vertrek: '13:00', chauffeur: 'X' })).json, t2 = (await A('POST', `/api/ritten/${r2.id}/stops`, { type: 'levering', van_locatie_id: R, naar_locatie_id: AB })).json.taak_id;
  const dub = await A('POST', `/api/transport-taken/${t2}/regels`, { bron: 'bak', id: bak });
  T.check(dub.status === 200 && new RegExp(`ook op rit #${rit.id}`).test(dub.json.melding), `elders op een rit: ${dub.json.melding}`);
  // Klaargezet: melding
  await A('POST', `/api/ritten/${rit.id}/klaarzet`, {});
  await reg({ bron: 'tekst', naam: 'Tafel', qty: 1 });
  const meld = (await T.api(srv.base, chT, 'GET', '/api/meldingen')).json.meldingen;
  T.check(meld.some((m) => /materiaal aangepast: Abdijschool/.test(m.tekst)), 'klaargezette rit: wijzigingsmelding');
  // Chauffeur rijdt
  const tk = (await A('POST', `/api/ritten/${rit.id}/token`)).json.token, P = (m, q, b) => T.api(srv.base, null, m, `/api/rit-token/${tk}${q}`, b);
  let d = (await P('GET', '/data')).json;
  await reg({ bron: 'tekst', naam: 'Na opening', qty: 1 });
  d = (await P('GET', '/data')).json;
  T.check(d.stops[0].regels.some((x) => x.naam === 'Na opening') && d.stops[0].regels.length === 4, 'regel na opening komt bij de chauffeur');
  const ids = d.stops[0].regels.map((x) => x.check_id);
  await P('POST', '/alles', { actie: 'laden', check_ids: ids });
  T.check((await A('DELETE', `/api/transport-regels/${st4.id}`)).status === 409, 'al geladen: niet verwijderen');
  await P('POST', '/alles', { actie: 'lossen', check_ids: ids });
  d = (await P('GET', '/data')).json;
  T.check(d.rit.status === 'gedaan', 'laden en lossen: rit gedaan, zoals een gegenereerde rit');
  await wacht();
  T.check((await db('SELECT huidige_locatie_id AS h FROM bakken WHERE id=?', [bak]))[0].h === AB, 'waar staat de bak: volgt');
  T.check((await A('POST', `/api/ritten/${rit.id}/stops`, { type: 'levering', van_locatie_id: R, naar_locatie_id: AB })).status === 409, 'afgeronde rit: geen stop meer');
  // Geschat tegenover echt
  p = await plan(rit.id);
  T.check(p.meting.echt_start && p.meting.echt_einde && /^geschat 12:00 · echt \d\d:\d\d · \du\d\d (langer|korter)|precies/.test(p.meting.tekst), `meting: ${p.meting.tekst}`);
  T.check((await A('GET', '/api/vandaag')).status === 200, 'Vandaag werkt');
  // Oude schatting
  const r3 = (await A('POST', '/api/ritten', { datum: DAG, vertrek: '09:00', einde: '11:00', chauffeur: 'Y' })).json;
  await A('PUT', `/api/ritten/${r3.id}`, { einde: '12:30' });
  p = await plan(r3.id);
  T.check(p.meting.geschat === '12:30' && p.meting.vorig === '11:00', 'oude schatting bewaard');
  // Agenda: einde
  const r4 = (await A('POST', '/api/ritten', { datum: '2026-11-05', vertrek: '09:00', chauffeur: 'Z' })).json;
  const dagp = async (id) => (await A('GET', `/api/ritplanning?week=${DAG}`)).json.dagen.flatMap((x) => x.ritten).find((x) => x.id === id);
  await A('PUT', `/api/ritten/${r4.id}/tijden`, { einde: '15:00' });
  let e = (await dagp(r4.id)).einde;
  G.zetAs(420, 1080);
  const h1 = G.pos(540, G.min(e)).hoog;
  T.check(e === '15:00', `langer: einde ${e}`);
  await A('PUT', `/api/ritten/${r4.id}/tijden`, { einde: '10:00' });
  e = (await dagp(r4.id)).einde;
  const h2 = G.pos(540, G.min(e)).hoog;
  T.check(e === '10:00' && h2 < h1, `blok volgt het einde: ${h1.toFixed(1)}% → ${h2.toFixed(1)}%`);
  await A('PUT', `/api/ritten/${r4.id}/verplaats`, { datum: '2026-11-05', vertrek: '10:00' });
  T.check((await dagp(r4.id)).einde === '11:00', 'verplaatsen houdt de duur');
  // 05:30 en 21:00
  const b0 = G.bereik([{ vertrek: '05:30', einde: '06:00' }, { vertrek: '21:00', einde: '21:30' }]);
  T.check(b0.a0 === 300 && b0.a1 === 1320, `bereik groeit: ${b0.a0}–${b0.a1}`);
  G.zetAs(b0.a0, b0.a1);
  const pa = G.pos(330, 360), pb = G.pos(1260, 1290);
  T.check(pa.top >= 0 && pb.top + pb.hoog <= 100, '05:30 en 21:00 binnen de kolom');
  const b1 = G.bereik([]);
  T.check(b1.a0 === 420 && b1.a1 === 1080, 'zonder ritten 07:00–18:00');
  G.zetAs(420, 600);
  const css = fs.readFileSync(T.ROOT + '/public/ritplanning.css', 'utf8');
  T.check(/\.dagkop>div:not\(\.tk\)\{padding:0\}/.test(css), 'kop zonder padding die de breedte verstoort (meting in de browser)');
  const gsm = RPJS.gsm;
  T.check(/\+ Stop/.test(gsm.stopNieuw({ locaties: [] }, { id: 1, vertrek: '' })) && /stap 1/.test(gsm.matZoek()) && /stap 2/.test(gsm.matAantal({ naam: 'x' })), 'gsm: een scherm per stap');
} catch (e) { T.fout('uitzondering: ' + e.message + ' ' + e.stack); console.log(srv.log().slice(-1200)); }
await T.einde(srv);
