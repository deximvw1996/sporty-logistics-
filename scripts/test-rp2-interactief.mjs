// test-rp2-interactief.mjs — RP2 (chat C): interactieve ritplanning. API (verplaats, tijden, volgorde, /rit met volgorde,
// drop op leeg uur, weekend, ongedaan), rest TF1 (spoed zonder chauffeur, PUT vertrek schuift stops, bulk geleverd) en
// een DOM-bouwtest van public/ritplanning.js met gesimuleerde pointer-gebaren (eigen DOM-stub) die de juiste route + body toont.
// Eigen server via _testhulp (poort 3343, herfst-test.db).
import * as T from './_testhulp.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const POORT = parseInt(process.env.TEST_POORT || '3343');
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: POORT });
const BASIC = 'Basic ' + Buffer.from('sporty:' + T.APP_PASSWORD).toString('base64');
let initSqlJs; try { initSqlJs = require('sql.js'); } catch { initSqlJs = require(T.ROOT + '/../sporty-railway/node_modules/sql.js'); }
const SQL = await initSqlJs();
let tok;
async function db(sql, params = []) {
  const r = await fetch(srv.base + '/api/backup-db', { headers: { authorization: BASIC, 'x-auth-token': tok } });
  const d = new SQL.Database(Buffer.from(await r.arrayBuffer()));
  const st = d.prepare(sql); st.bind(params); const rows = []; while (st.step()) rows.push(st.getAsObject()); st.free(); d.close(); return rows;
}
try {
  tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const P = (m, p, b) => T.api(srv.base, null, m, p, b);
  const R = ijk.locaties.rozenweg, AB = ijk.locaties.abdijschool, BE = ijk.locaties.betekom, kmBE = ijk.kampmomenten.betekom;
  const D = '2026-11-10';
  const mk = async (tijd, extra = {}) => (await A('POST', '/api/transport-taken', { type: 'levering', datum: D, tijd, van_locatie_id: R, naar_locatie_id: AB, regels: [{ naam: 'Croquet doelen', qty: 1, soort: 'attribuut', attribuut_id: 4 }], ...extra })).json.id;
  const rit = async (id) => (await A('GET', `/api/ritten/${id}`)).json;
  const tijden = (r) => r.taken.map((x) => x.tijd).join(',');
  const plan = async (datum, id) => (await A('GET', `/api/ritplanning?week=${datum}`)).json.dagen.flatMap((d) => d.ritten).find((x) => x.id === id);

  // ── verplaats: dag + uur, stops schuiven mee, log met → ──
  const t1 = await mk('09:00'), t2 = await mk('09:00');
  const RA = (await A('POST', '/api/ritten', { datum: D, vertrek: '08:00', personeel_id: 3, voertuig: 'Camionette', taak_ids: [t1, t2] })).json.id;
  T.check(tijden(await rit(RA)) === '09:00,09:45', `rit #${RA} start: ${tijden(await rit(RA))}`);
  let r = await A('PUT', `/api/ritten/${RA}/verplaats`, { datum: '2026-11-11', vertrek: '10:00' });
  let ra = await rit(RA);
  T.check(r.status === 200 && ra.datum === '2026-11-11' && ra.taken.every((t) => t.datum === '2026-11-11') && tijden(ra) === '11:00,11:45',
    `verplaats → wo 11/11 10:00: datum ${ra.datum}, stops ${tijden(ra)} (rit + stops +1 dag +120 min)`);
  let lg = await db("SELECT DISTINCT context FROM wijzigingen WHERE context LIKE ?", [`Rit #${RA}: di 10/11 08:00 → wo 11/11 10:00 ⟦g:%`]);
  T.check(lg.length === 1, `log-beschrijving: "${lg[0]?.context}"`);
  T.check(r.json.laatste_wijziging?.beschrijving === 'di 10/11 08:00 → wo 11/11 10:00' && Array.isArray(r.json.waarschuwingen), `antwoord: laatste_wijziging "${r.json.laatste_wijziging?.beschrijving}", waarschuwingen ${JSON.stringify(r.json.waarschuwingen)}`);
  const pA = await plan('2026-11-11', RA);
  T.check(pA.laatste_wijziging?.beschrijving === 'di 10/11 08:00 → wo 11/11 10:00', 'planning() geeft laatste_wijziging per rit');

  // ── ongedaan ──
  r = await A('POST', `/api/ritten/${RA}/ongedaan`);
  ra = await rit(RA);
  T.check(r.status === 200 && ra.datum === D && tijden(ra) === '09:00,09:45' && ra.vertrek === '08:00', `ongedaan: terug naar ${ra.datum} ${ra.vertrek}, stops ${tijden(ra)}`);
  T.check((await A('POST', `/api/ritten/${RA}/ongedaan`)).status === 404, 'tweede ongedaan zonder nieuwe wijziging → 404');

  // ── tijden: inkorten → samengedrukt + waarschuwing ──
  r = await A('PUT', `/api/ritten/${RA}/tijden`, { einde: '09:20' });
  ra = await rit(RA);
  T.check(tijden(ra) === '09:00,09:20' && r.json.waarschuwingen.includes('stops samengedrukt: 2 stops binnen 20 min'), `einde 09:20: stops ${tijden(ra)}, waarschuwingen ${JSON.stringify(r.json.waarschuwingen)}`);
  r = await A('PUT', `/api/ritten/${RA}/tijden`, { vertrek: '09:30' });
  ra = await rit(RA);
  T.check(tijden(ra) === '09:30,10:15' && !r.json.waarschuwingen.some((w) => /samengedrukt/.test(w)), `vertrek 09:30: stops vóór het vertrek → ${tijden(ra)} (G6-helper)`);

  // ── stopvolgorde ──
  r = await A('PUT', `/api/ritten/${RA}/stops/volgorde`, { taak_ids: [t2, t1] });
  ra = await rit(RA);
  T.check(r.status === 200 && ra.taken.map((t) => t.id).join() === `${t2},${t1}` && tijden(ra) === '09:30,10:15', `volgorde [#${t2},#${t1}]: tijden volgen (${tijden(ra)})`);
  const t3 = await mk('11:00');
  await A('PUT', `/api/transport-taken/${t3}/rit`, { rit_id: RA });
  await A('PUT', `/api/transport-taken/${t1}/status`, { status: 'aangekomen' });
  r = await A('PUT', `/api/ritten/${RA}/stops/volgorde`, { taak_ids: [t2, t1, t3] });
  T.check(r.status === 409, `volgorde met aangekomen stop niet vooraan → ${r.status} "${r.json.error}"`);
  r = await A('PUT', `/api/ritten/${RA}/stops/volgorde`, { taak_ids: [t1, t3, t2] });
  T.check(r.status === 200 && (await rit(RA)).taken[0].id === t1, `volgorde met aangekomen stop vooraan → 200`);

  // ── verplaats van een bezige/gedane rit → 409 ──
  const tg = await mk('09:00');
  const RG = (await A('POST', '/api/ritten', { datum: D, vertrek: '09:00', personeel_id: 1, voertuig: 'Camion', taak_ids: [tg] })).json.id;
  await A('PUT', `/api/ritten/${RG}`, { status: 'gedaan' });
  r = await A('PUT', `/api/ritten/${RG}/verplaats`, { datum: D, vertrek: '11:00' });
  T.check(r.status === 409 && r.json.error === 'rit is al bezig/gedaan', `verplaats gedane rit → ${r.status} "${r.json.error}"`);
  await A('PUT', `/api/ritten/${RG}`, { status: 'onderweg' });
  T.check((await A('PUT', `/api/ritten/${RG}/verplaats`, { datum: D, vertrek: '11:00' })).status === 409, 'verplaats rit met status onderweg → 409');

  // ── open taak op een rit droppen, met volgorde ──
  const tB1 = await mk('13:00'), tB2 = await mk('13:00'), t4 = await mk('07:00');
  const RB = (await A('POST', '/api/ritten', { datum: D, vertrek: '13:00', personeel_id: 2, voertuig: 'Camionette', taak_ids: [tB1, tB2] })).json.id;
  r = await A('PUT', `/api/transport-taken/${t4}/rit`, { rit_id: RB, volgorde: 1 });
  let rb = await rit(RB);
  T.check(r.status === 200 && rb.taken[0].id === t4 && rb.taken.length === 3, `taak #${t4} op rit #${RB} gedropt op plaats 1: volgorde ${rb.taken.map((t) => '#' + t.id + ' ' + t.tijd).join(', ')}`);
  T.check((await plan(D, RB)).laatste_wijziging?.beschrijving === `taak #${t4} → rit #${RB} (plaats 1)`, `log: "${(await plan(D, RB)).laatste_wijziging?.beschrijving}"`);
  // geladen stop naar een andere rit → 409
  const rtok = await T.ritToken(srv.base, tok, RB);
  const rd = (await P('GET', `/api/rit-token/${rtok}/data`)).json;
  const reg = rd.stops.find((s) => s.taak_id === tB1).regels[0];
  await P('POST', `/api/rit-token/${rtok}/checks/${reg.check_id}/laden`);
  r = await A('PUT', `/api/transport-taken/${tB1}/rit`, { rit_id: RA, volgorde: 1 });
  T.check(r.status === 409, `geladen stop naar andere rit → ${r.status} "${r.json.error}"`);
  T.check((await plan(D, RB)).stops.find((s) => s.taak_id === tB1).geladen === true, 'planning(): stop.geladen = true (geen greep)');

  // ── stop naar een andere rit (zelfde dag) ──
  r = await A('PUT', `/api/transport-taken/${tB2}/rit`, { rit_id: RG === 0 ? 0 : RA, volgorde: 2 });
  T.check(r.status === 200 && (await rit(RA)).taken.map((t) => t.id).indexOf(tB2) === 1, `stop #${tB2} van rit #${RB} → rit #${RA} plaats 2 ("${(await plan(D, RA)).laatste_wijziging?.beschrijving}")`);

  // ── open taak op een leeg uur → nieuwe rit zonder bestuurder ──
  const t5 = await mk('09:00');
  r = await A('POST', '/api/ritten', { datum: D, vertrek: '14:00', taak_ids: [t5] });
  const RN = r.json.id, pN = await plan(D, RN);
  T.check(pN.waarschuwingen.includes('geen chauffeur') && pN.waarschuwingen.includes('geen voertuig') && pN.stops[0].tijd === '14:00', `leeg uur 14:00 → rit #${RN}: ${JSON.stringify(pN.waarschuwingen)}, stop ${pN.stops[0].tijd}`);
  r = await A('POST', `/api/ritten/${RN}/ongedaan`);
  const naOng = await db('SELECT (SELECT COUNT(*) FROM transport_ritten WHERE id=?) AS n, (SELECT rit_id FROM transport_taken WHERE id=?) AS rid', [RN, t5]);
  T.check(r.status === 200 && naOng[0].n === 0 && naOng[0].rid == null, `ongedaan van de nieuwe rit: rit weg, taak #${t5} weer open`);

  // ── weekendtaak → bevestiging ──
  const tw = await mk('10:00', { datum: '2026-11-14' });
  const RW = (await A('POST', '/api/ritten', { datum: '2026-11-14', vertrek: '10:00', taak_ids: [tw] })).json.id;
  T.check((await plan('2026-11-14', RW)).waarschuwingen.includes('weekend · nog niet bevestigd'), 'weekendrit vóór bevestiging: "weekend · nog niet bevestigd"');
  await A('POST', `/api/transport-taken/${tw}/weekend-bevestig`);
  T.check((await plan('2026-11-14', RW)).waarschuwingen.some((w) => /^weekend · bevestigd door/.test(w)), 'na weekend-bevestig: "weekend · bevestigd door …"');

  // ── rest TF1: spoed zonder chauffeur ──
  const a1 = (await A('POST', '/api/aanvragen', { kampmoment_id: kmBE, soort: 'kapot', tekst: 'oven kapot' })).json.id;
  r = await A('PUT', `/api/aanvragen/${a1}/status`, { status: 'goedgekeurd', maak_spoedtransport: true });
  T.check(r.json.rit_zonder_chauffeur === true, `Goedkeuren + spoed zonder bestuurder → rit_zonder_chauffeur:${r.json.rit_zonder_chauffeur}`);
  const a2 = (await A('POST', '/api/aanvragen', { kampmoment_id: kmBE, soort: 'kapot', tekst: 'net kapot' })).json.id;
  r = await A('PUT', `/api/aanvragen/${a2}/status`, { status: 'goedgekeurd', maak_spoedtransport: true, spoedtransport: { personeel_id: 2, voertuig: 'Camionette' } });
  const sp = await db('SELECT r.chauffeur,r.personeel_id FROM transport_taken t JOIN transport_ritten r ON r.id=t.rit_id WHERE t.id=?', [r.json.spoed_taak_id]);
  T.check(!r.json.rit_zonder_chauffeur && sp[0].chauffeur === 'Jeroen' && sp[0].personeel_id === 2, `met spoedtransport.personeel_id → chauffeur "${sp[0].chauffeur}"`);

  // ── rest TF1: PUT vertrek schuift stops ──
  rb = await rit(RB);
  const voor = tijden(rb);
  await A('PUT', `/api/ritten/${RB}`, { vertrek: '14:00' });
  rb = await rit(RB);
  T.check(tijden(rb) === voor.split(',').map((t) => { const m = +t.slice(0, 2) * 60 + +t.slice(3) + 60; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }).join(','), `PUT /api/ritten/:id vertrek 13:00 → 14:00: stops ${voor} → ${tijden(rb)}`);

  // ── rest TF1: bulk geleverd volgens de spreiding ──
  const bulk = (await db('SELECT s.bak_id,s.locatie_id FROM bulk_spreiding s JOIN bakken b ON b.id=s.bak_id WHERE b.is_bulk=1 AND s.aantal>0 LIMIT 1'))[0];
  const zonder = (await db('SELECT id FROM locaties WHERE id NOT IN (SELECT locatie_id FROM bulk_spreiding WHERE bak_id=? AND aantal>0) AND id<>? LIMIT 1', [bulk.bak_id, bulk.locatie_id]))[0].id;
  const bk = (await db('SELECT naam FROM bakken WHERE id=?', [bulk.bak_id]))[0].naam;
  const oph = async (van) => (await A('POST', '/api/transport-taken', { type: 'ophaling', datum: '2026-11-12', tijd: '09:00', van_locatie_id: van, naar_locatie_id: R, regels: [{ naam: bk, qty: 1, soort: 'bulk', bak_id: bulk.bak_id }] })).json.id;
  const o1 = await oph(bulk.locatie_id), o2 = await oph(zonder);
  const RO = (await A('POST', '/api/ritten', { datum: '2026-11-12', vertrek: '09:00', personeel_id: 1, voertuig: 'Camion', taak_ids: [o1, o2] })).json.id;
  const od = (await P('GET', `/api/rit-token/${await T.ritToken(srv.base, tok, RO)}/data`)).json;
  const g1 = od.stops.find((s) => s.taak_id === o1).regels[0], g2 = od.stops.find((s) => s.taak_id === o2).regels[0];
  T.check(g1?.is_bulk && g1.geleverd === true && g2?.geleverd === false, `bulk "${bk}": op locatie met bezit → geleverd ${g1?.geleverd}; zonder bezit → ${g2?.geleverd}`);

  // ── rechten ──
  T.check((await P('PUT', `/api/ritten/${RA}/verplaats`, { datum: D, vertrek: '08:00' })).status >= 401, 'verplaats zonder kantoor-sessie → geweigerd');

  // ── DOM-bouw: pointer-gebaren → juiste route + body ──
  const RPJS = require(T.ROOT + '/public/ritplanning.js');
  const planD = (await A('GET', `/api/ritplanning?week=${D}`)).json;
  const G = RPJS.gebaren;
  let calls = [];
  const sim = G.maak({ P: planD, api: async (m, u, b) => { calls.push({ m, u, b }); return { ok: true, status: 200, json: { id: 999 } }; }, vraag: async () => ({}), toast: () => {} });
  const dagD = planD.dagen.find((d) => d.datum === D), blokRA = dagD.ritten.find((x) => x.id === RA);
  // rit slepen: 1 dag naar rechts, 60 min naar beneden (kolom 1000 px hoog = 600 min, 7 kolommen van 100 px breed)
  const geo = { kolomBreedte: 100, kolomHoogte: 1000, dagen: planD.dagen.map((d) => d.datum) };
  await sim.sleepRit(blokRA, geo, [{ x: 150, y: 600 }, { x: 250, y: 700 }]);
  T.check(calls[0]?.u === `/api/ritten/${RA}/verplaats` && calls[0].b.datum === '2026-11-11' && calls[0].b.vertrek === '10:30', `slepen ritblok → ${calls[0]?.m} ${calls[0]?.u} ${JSON.stringify(calls[0]?.b)}`);
  calls = [];
  await sim.sleepGreep(blokRA, 'onder', geo, [{ x: 150, y: 900 }, { x: 150, y: 800 }]);
  T.check(calls[0]?.u === `/api/ritten/${RA}/tijden` && calls[0].b.einde, `greep onderaan → ${calls[0]?.u} ${JSON.stringify(calls[0]?.b)}`);
  calls = [];
  await sim.dropOpen({ taak_id: t5, datum: D }, { soort: 'rit', rit_id: RA, volgorde: 2 });
  await sim.dropOpen({ taak_id: t5, datum: D }, { soort: 'uur', datum: D, vertrek: '14:15' });
  await sim.dropOpen({ taak_id: tw, datum: '2026-11-14' }, { soort: 'uur', datum: '2026-11-14', vertrek: '09:00' });
  T.check(calls[0]?.u === `/api/transport-taken/${t5}/rit` && calls[0].b.rit_id === RA && calls[0].b.volgorde === 2
    && calls[1]?.u === '/api/ritten' && calls[1].m === 'POST' && calls[1].b.vertrek === '14:15' && calls[1].b.taak_ids[0] === t5
    && calls.some((c) => c.u === `/api/transport-taken/${tw}/weekend-bevestig`),
  `taak droppen → ${calls.map((c) => c.m + ' ' + c.u + ' ' + JSON.stringify(c.b || {})).join(' | ')}`);
  calls = [];
  await sim.dropStop({ rit_id: RA, taak_id: tB2 }, { rit_id: RA, volgorde: 3 });
  await sim.dropStop({ rit_id: RA, taak_id: tB2 }, { rit_id: RB, volgorde: 1 });
  T.check(calls[0]?.u === `/api/ritten/${RA}/stops/volgorde` && Array.isArray(calls[0].b.taak_ids) && calls[0].b.taak_ids[2] === tB2
    && calls[1]?.u === `/api/transport-taken/${tB2}/rit` && calls[1].b.rit_id === RB && calls[1].b.volgorde === 1,
  `stop slepen → ${calls.map((c) => c.m + ' ' + c.u + ' ' + JSON.stringify(c.b)).join(' | ')}`);
  T.check(G.snap(7 * 60 + 52) === 7 * 60 + 45 && G.snap(7 * 60 + 53) === 8 * 60, 'snappen op 15 min');
  const bezig = { ...blokRA, status: 'onderweg' };
  calls = []; let melding = '';
  const sim2 = G.maak({ P: planD, api: async (m, u, b) => { calls.push({ m, u, b }); return { ok: true, status: 200, json: {} }; }, vraag: async () => ({}), toast: (m) => { melding = m; } });
  await sim2.sleepRit(bezig, geo, [{ x: 150, y: 600 }, { x: 250, y: 700 }]);
  T.check(!calls.length && melding === 'rit is al bezig', `bezige rit slepen → geen call, toast "${melding}"`);
  const mob = G.mobielMaten(390);
  T.check(mob.dagen === 1 && mob.knop >= 44 && mob.greep === 14 && mob.langDruk === 250, `mobiel 390 px: ${JSON.stringify(mob)}`);
} catch (e) { T.fout('uitzondering: ' + e.stack); }
await T.einde(srv);
