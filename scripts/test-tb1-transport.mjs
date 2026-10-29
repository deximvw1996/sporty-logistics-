// test-tb1-transport.mjs — TB1 (chat D): bundelen, ontkoppelen zonder dataverlies, splitsen met echte stops, kapot attribuut → nakijk-regel,
// berichten van kantoor op de KV-pagina, één patroon.css. Eigen server via _testhulp (poort 3345, herfst-test.db).
import * as T from './_testhulp.mjs';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const POORT = parseInt(process.env.TEST_POORT || '3345');
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: POORT });
const BASIC = 'Basic ' + Buffer.from('sporty:' + T.APP_PASSWORD).toString('base64');
let tok;
async function db(sql, params = []) {
  const r = await fetch(srv.base + '/api/backup-db', { headers: { authorization: BASIC, 'x-auth-token': tok } });
  let initSqlJs; try { initSqlJs = require('sql.js'); } catch { initSqlJs = require(T.ROOT + '/../sporty-railway/node_modules/sql.js'); }
  const SQL = await initSqlJs(); const d = new SQL.Database(Buffer.from(await r.arrayBuffer()));
  const st = d.prepare(sql); st.bind(params); const rows = []; while (st.step()) rows.push(st.getAsObject()); st.free(); d.close(); return rows;
}
try {
  tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const P = (m, p, b) => T.api(srv.base, null, m, p, b);
  const R = ijk.locaties.rozenweg, AB = ijk.locaties.abdijschool, BE = ijk.locaties.betekom, km = ijk.kampmomenten.abdijschool, thema = ijk.themas.alles_op_wieltjes;
  const DAG = '2026-11-03', ANDERE = '2026-11-05';
  const maakBak = async (label, code) => (await A('POST', `/api/themas/${thema}/bakken`, { label, code })).json.id;
  const mk = async (naar, datum, regels, extra = {}) => (await A('POST', '/api/transport-taken', { type: 'levering', datum, tijd: '10:00', van_locatie_id: R, naar_locatie_id: naar, kampmoment_id: km, regels, ...extra })).json.id;
  const reg = (naam, qty, bak) => ({ naam, qty, soort: 'thema', bak_id: bak });
  const taak = async (id) => (await db('SELECT * FROM transport_taken WHERE id=?', [id]))[0];
  const nRegels = async (id) => (await db('SELECT COUNT(*) AS n FROM transport_regels WHERE taak_id=?', [id]))[0].n;
  const vind = (o, id) => { if (!o || typeof o !== 'object') return null; if (o.id === id && 'bezetting' in o) return o; for (const k of Object.keys(o)) { const g = vind(o[k], id); if (g) return g; } return null; };
  const bz = async (ritId) => { const j = (await A('GET', `/api/ritplanning?week=${DAG}`)).json; const r = vind(j, ritId); return r ? r.bezetting : undefined; };

  // ── Punt 1: bundelen ──
  const bk = []; for (let i = 1; i <= 8; i++) bk.push(await maakBak('Tb1 bak ' + i, 'TB' + i));
  const a = await mk(AB, DAG, [reg('Bak Tb1 bak 1 (TB1)', 1, bk[0]), reg('Bak Tb1 bak 2 (TB2)', 1, bk[1])]);
  const b = await mk(AB, DAG, [reg('Bak Tb1 bak 3 (TB3)', 1, bk[2]), reg('Bak Tb1 bak 4 (TB4)', 1, bk[3])]);
  const c = await mk(AB, DAG, [reg('Bak Tb1 bak 5 (TB5)', 1, bk[4])]);
  const rit = (await A('POST', '/api/ritten', { datum: DAG, chauffeur: 'Jan', taak_ids: [b] })).json.id;
  await A('POST', `/api/ritten/${rit}/checks/init`);
  let r = await A('POST', '/api/transport-taken/bundel', { taak_ids: [a] });
  T.check(r.status === 400, 'bundel met één taak → 400');
  const verschil = await mk(BE, DAG, [reg('Bak Tb1 bak 6 (TB6)', 1, bk[5])]);
  r = await A('POST', '/api/transport-taken/bundel', { taak_ids: [a, verschil] });
  T.check(r.status === 409 && /dezelfde bestemming/.test(r.json.error), `andere bestemming → 409 "${r.json.error}"`);
  const andereDag = await mk(AB, ANDERE, [reg('Bak Tb1 bak 7 (TB7)', 1, bk[6])]);
  r = await A('POST', '/api/transport-taken/bundel', { taak_ids: [a, andereDag] });
  T.check(r.status === 409 && /andere dag/.test(r.json.error), 'andere dag → 409');
  r = await P('POST', '/api/transport-taken/bundel', { taak_ids: [a, c] });
  T.check(r.status === 401 || r.status === 403, 'zonder login geen bundel');
  // geladen → 409
  const ch = (await P('GET', `/api/rit-token/${await T.ritToken(srv.base, tok, rit)}/data`)).json;
  const rtok = await T.ritToken(srv.base, tok, rit);
  const geladenCheck = ch.stops[0].regels[0].check_id;
  await P('POST', `/api/rit-token/${rtok}/checks/${geladenCheck}/laden`);
  r = await A('POST', '/api/transport-taken/bundel', { taak_ids: [a, b, c] });
  T.check(r.status === 409 && /al geladen/.test(r.json.error) && r.json.error.includes('#' + b), `een geladen regel → 409 met de taak erbij ("${r.json.error}")`);
  T.check((await nRegels(a)) === 2 && (await nRegels(b)) === 2 && (await taak(c)).status === 'gepland', '… en er is niets gewijzigd');
  await P('POST', `/api/rit-token/${rtok}/checks/${geladenCheck}/laden`); // terug ongeladen
  // geslaagd: b staat op een rit → blijft
  r = await A('POST', '/api/transport-taken/bundel', { taak_ids: [a, b, c] });
  T.check(r.status === 200 && r.json.taak.id === b && r.json.taak.regels.length === 5 && r.json.samengevoegd.sort().join() === [a, c].sort().join(), `bundel → één taak #${b} (op de rit) met ${r.json?.taak?.regels?.length} regels`);
  const tb = await taak(b), ta = await taak(a), tc = await taak(c);
  T.check(tb.rit_id === rit && ta.status === 'geannuleerd' && tc.status === 'geannuleerd' && ta.rit_id === null && new RegExp('gebundeld in #' + b).test(ta.opmerking) && new RegExp('gebundeld in #' + b).test(tc.opmerking), 'rit blijft, de andere twee zijn geannuleerd met "gebundeld in #id" en niet verwijderd');
  T.check((await db('SELECT COUNT(*) AS n FROM verhuis_checks WHERE taak_id=? AND rit_id=?', [b, rit]))[0].n >= 2 && (await db('SELECT COUNT(*) AS n FROM verhuis_checks WHERE taak_id IN (?,?)', [a, c]))[0].n === 0, 'checks horen bij de blijvende taak (geen losse checks op de geannuleerde taken)');
  const logB = await db("SELECT beschrijving FROM activiteiten_log WHERE actie='gebundeld' ORDER BY id DESC LIMIT 1");
  T.check(logB.length === 1 && logB[0].beschrijving.includes('#' + b), `activiteiten_log: "${logB[0]?.beschrijving}"`);
  const wzB = await db("SELECT COUNT(*) AS n FROM wijzigingen WHERE tabel='transport_taken' AND context LIKE 'bundelen%'");
  T.check(wzB[0].n >= 3, `wijzigingen gelogd (${wzB[0].n} regels, context bundelen)`);
  // twee taken beide op dezelfde rit: oudste blijft, checks verhuizen mee
  const x = await mk(AB, DAG, [reg('Bak Tb1 bak 6 (TB6)', 1, bk[5])]);
  const y = await mk(AB, DAG, [reg('Bak Tb1 bak 7 (TB7)', 1, bk[6])]);
  const rit2 = (await A('POST', '/api/ritten', { datum: DAG, chauffeur: 'Piet', taak_ids: [x, y] })).json.id;
  await A('POST', `/api/ritten/${rit2}/checks/init`);
  r = await A('POST', '/api/transport-taken/bundel', { taak_ids: [y, x] });
  T.check(r.status === 200 && r.json.taak.id === x && (await nRegels(x)) === 2, 'twee taken op dezelfde rit → de oudste blijft met beide regels');
  T.check((await db('SELECT COUNT(*) AS n FROM verhuis_checks WHERE taak_id=? AND rit_id=?', [x, rit2]))[0].n === 2, 'beide checks staan nu op de blijvende taak en de rit');
  const ritA = await mk(AB, DAG, [reg('Bak Tb1 bak 8 (TB8)', 1, bk[7])]), ritB = await mk(AB, DAG, [reg('Bak Tb1 bak 1 (TB1)', 1, bk[0])]);
  const rit3 = (await A('POST', '/api/ritten', { datum: DAG, chauffeur: 'Els', taak_ids: [ritB] })).json.id;
  r = await A('POST', '/api/transport-taken/bundel', { taak_ids: [x, ritB] });
  T.check(r.status === 409 && /verschillende ritten/.test(r.json.error), 'taken op twee verschillende ritten → 409');
  r = await A('POST', '/api/transport-taken/bundel', { taak_ids: [ta.id, ritA] });
  T.check(r.status === 409 && /geannuleerd/.test(r.json.error), 'een al geannuleerde taak bundelen → 409');

  // ── Punt 2: ontkoppelen zonder dataverlies ──
  const o1 = await mk(AB, DAG, [reg('Bak Tb1 bak 2 (TB2)', 1, bk[1])], { tijd: '11:30' });
  const o2 = await mk(AB, DAG, [reg('Bak Tb1 bak 3 (TB3)', 1, bk[2])]);
  const o3 = await mk(AB, DAG, [reg('Bak Tb1 bak 4 (TB4)', 1, bk[3])]);
  const ritO = (await A('POST', '/api/ritten', { datum: DAG, chauffeur: 'Lies', taak_ids: [o1, o2, o3] })).json.id;
  await A('POST', `/api/ritten/${ritO}/checks/init`);
  r = await A('PUT', `/api/transport-taken/${o1}/rit`, { rit_id: null });
  let t1 = await taak(o1);
  T.check(r.status === 200 && t1.rit_id === null && t1.datum === DAG && t1.tijd === '11:30', `PUT /rit met null: rit weg, datum ${t1.datum} en tijd ${t1.tijd} blijven`);
  T.check((await db('SELECT COUNT(*) AS n FROM verhuis_checks WHERE taak_id=? AND rit_id=0', [o1]))[0].n >= 1, 'de checks van de taak staan los van de rit (rit_id 0)');
  const otok = await T.ritToken(srv.base, tok, ritO);
  const od = (await P('GET', `/api/rit-token/${otok}/data`)).json;
  const checkO2 = od.stops.find((s) => s.taak_id === o2).regels[0].check_id;
  await P('POST', `/api/rit-token/${otok}/checks/${checkO2}/laden`);
  r = await A('PUT', `/api/transport-taken/${o2}/rit`, { rit_id: null });
  T.check(r.status === 409 && /al geladen/.test(r.json.error) && (await taak(o2)).rit_id === ritO, `PUT /rit met null bij een geladen stuk → 409, taak blijft op de rit ("${r.json.error}")`);
  r = await A('POST', '/api/transport-taken/bulk-ontkoppel', { ids: [o2, o3] });
  T.check(r.status === 409 && (await taak(o3)).rit_id === ritO, 'bulk-ontkoppel met één geladen taak → 409 en NIETS gewijzigd');
  r = await A('POST', '/api/transport-taken/bulk-ontkoppel', { ids: [o3] });
  const t3 = await taak(o3);
  T.check(r.status === 200 && t3.rit_id === null && t3.datum === DAG, 'bulk-ontkoppel zonder geladen stuk: rit weg, datum blijft');
  r = await A('POST', `/api/ritten/${ritO}/taken/${o2}/ontkoppel`);
  T.check(r.status === 409, 'de ritplanning-✕ gebruikt dezelfde functie (geladen → 409)');
  await P('POST', `/api/rit-token/${otok}/checks/${checkO2}/laden`);
  r = await A('POST', `/api/ritten/${ritO}/taken/${o2}/ontkoppel`);
  T.check(r.status === 200 && (await taak(o2)).datum === DAG && (await taak(o2)).rit_id === null, 'ritplanning-✕ ontkoppelt en laat de datum staan');

  // ── Punt 3: splitsen met een stop van meerdere regels ──
  const s1 = await mk(AB, DAG, [reg('Bak Tb1 bak 1 (TB1)', 1, bk[0]), reg('Bak Tb1 bak 2 (TB2)', 1, bk[1]), reg('Bak Tb1 bak 3 (TB3)', 1, bk[2])]);
  const ritS = (await A('POST', '/api/ritten', { datum: DAG, chauffeur: 'Sam', taak_ids: [s1] })).json.id;
  await A('POST', `/api/ritten/${ritS}/checks/init`);
  const regelsS = (await db('SELECT * FROM transport_regels WHERE taak_id=? ORDER BY id', [s1]));
  const bezVoor = await bz(ritS);
  const checksVoor = (await db('SELECT COUNT(*) AS n FROM verhuis_checks WHERE rit_id=?', [ritS]))[0].n;
  r = await A('POST', `/api/transport-taken/${s1}/splits`, { regel_ids: [regelsS[0].id], datum: ANDERE, tijd: '09:00' });
  const nieuw = r.json.nieuwe_taak_id;
  const tn = await taak(nieuw);
  T.check(r.status === 200 && r.json.verplaatst === 1 && tn.rit_id === null && tn.datum === ANDERE && (await nRegels(nieuw)) === 1 && (await nRegels(s1)) === 2, `splits 1 van 3 regels → nieuwe taak #${nieuw} zonder rit op ${tn.datum} met 1 regel; oude taak houdt 2`);
  const cNieuw = await db('SELECT * FROM verhuis_checks WHERE taak_id=?', [nieuw]);
  T.check(cNieuw.length === 1 && cNieuw[0].rit_id === 0 && cNieuw[0].bak_id === bk[0], 'de check van de afgesplitste regel is mee en hangt aan geen rit');
  const checksNa = (await db('SELECT COUNT(*) AS n FROM verhuis_checks WHERE rit_id=?', [ritS]))[0].n;
  const bezNa = await bz(ritS);
  T.check(checksNa === checksVoor - 1 && JSON.stringify(bezNa) !== JSON.stringify(bezVoor), `rit-bezetting daalt (checks ${checksVoor}→${checksNa}; bezetting ${JSON.stringify(bezVoor)}→${JSON.stringify(bezNa)})`);
  const stoken = await T.ritToken(srv.base, tok, ritS);
  const sd = (await P('GET', `/api/rit-token/${stoken}/data`)).json;
  const geladenReg = sd.stops[0].regels[0];
  await P('POST', `/api/rit-token/${stoken}/checks/${geladenReg.check_id}/laden`);
  const regelsNa = await db('SELECT * FROM transport_regels WHERE taak_id=? ORDER BY id', [s1]);
  const teSplitsen = regelsNa.find((x) => x.bak_id === geladenReg.bak_id);
  r = await A('POST', `/api/transport-taken/${s1}/splits`, { regel_ids: [teSplitsen.id], datum: ANDERE });
  T.check(r.status === 409 && /al geladen/.test(r.json.error) && (await nRegels(s1)) === 2, `splitsen van een geladen regel → 409 ("${r.json.error}")`);
  r = await A('POST', `/api/transport-taken/${s1}/splits`, { regel_ids: regelsNa.map((x) => x.id), datum: ANDERE });
  T.check(r.status === 400, 'álle regels afsplitsen → 400');

  // ── Punt 4: kapot attribuut + berichten van kantoor ──
  await A('POST', `/api/themas/${thema}/attributen`, { attribuut_id: 4 });
  await A('POST', `/api/kampmomenten/${km}/themas`, { thema_id: thema });
  const kvtok = await T.kvToken(srv.base, tok, km);
  const kv = (m, p, bd) => P(m, `/api/kv/${kvtok}${p}`, bd);
  let kd = (await kv('GET', '/data')).json;
  const attr = kd.attributen.find((x) => x.id === 4);
  T.check(!!attr, 'attribuut 4 hoort bij het kampmoment');
  await kv('POST', '/attributen/4/status', { status: 'beschadigd' });
  const reg4 = await db("SELECT nr.* FROM nakijk_regels nr JOIN nakijk_sessies ns ON ns.id=nr.sessie_id WHERE ns.bak_type='attribuut' AND ns.attribuut_id=4 AND ns.kampmoment_id=?", [km]);
  T.check(reg4.length === 1 && reg4[0].item_naam === attr.naam && reg4[0].verwacht === 1 && reg4[0].aangetroffen === 1 && reg4[0].kapot_aantal === 1, 'beschadigd attribuut → nakijk_regel (verwacht 1, aangetroffen 1, kapot 1)');
  await kv('POST', '/attributen/4/status', { status: 'beschadigd' });
  T.check((await db("SELECT COUNT(*) AS n FROM nakijk_regels nr JOIN nakijk_sessies ns ON ns.id=nr.sessie_id WHERE ns.bak_type='attribuut' AND ns.attribuut_id=4 AND ns.kampmoment_id=?", [km]))[0].n === 1, 'nogmaals "beschadigd" maakt geen tweede regel');
  await kv('POST', '/versturen', {});
  const lijst = (await A('GET', '/api/nakijken')).json;
  const rij = lijst.bakken.find((x) => x.kampmoment_id === km && x.bak.soort === 'attribuut' && x.bak.id === 4);
  T.check(rij && rij.status === 'te_keuren' && rij.uitslag_tekst === 'kapot', `Nakijken: attribuut staat op te_keuren met uitslag "${rij?.uitslag_tekst}"`);
  const det = (await A('GET', `/api/nakijken/sessie/${rij.sessie_id}`)).json;
  T.check(det.items[0].afwijking === 'kapot' && det.items[0].regel_id && det.items[0].acties.map((x) => x.waarde).join() === 'afschrijven_bestellen,herstellen,aanvaarden', 'detail: kapot met regel_id en actie-select (afschrijven+bestellen / herstellen / aanvaarden)');
  r = await A('PUT', `/api/nakijken/regel/${det.items[0].regel_id}`, { kantoor_actie: 'afschrijven_bestellen', kantoor_aantal: 1 });
  T.check(r.status === 200, 'kantoor hangt er een actie aan');
  r = await A('POST', `/api/nakijken/sessie/${rij.sessie_id}/afronden`);
  T.check(r.status === 200 && r.json.afschrijvingen === 1, 'afronden → 1 afschrijving');
  const av = (await A('GET', '/api/aanvullijst')).json.bakken.find((x) => x.sessie_id === rij.sessie_id);
  T.check(av && av.handelingen.length === 1 && av.handelingen[0].soort === 'afschrijven' && av.handelingen[0].stuk === attr.naam, `aanvullijst toont de handeling: ${av?.handelingen[0]?.stuk} → ${av?.handelingen[0]?.soort}`);
  await kv('POST', '/attributen/4/status', { status: 'aanwezig' });
  const n4 = (await db("SELECT kapot_aantal FROM nakijk_regels nr JOIN nakijk_sessies ns ON ns.id=nr.sessie_id WHERE ns.bak_type='attribuut' AND ns.attribuut_id=4 AND ns.kampmoment_id=?", [km]));
  T.check(n4.length === 1 && n4[0].kapot_aantal === 0, 'terug op aanwezig na een kantoor-actie: de regel blijft, maar niet meer kapot');
  // berichten van kantoor
  await A('POST', '/api/nakijken/herinnering', { kampmoment_id: km });
  await A('POST', '/api/nakijken/notitie', { kampmoment_id: km, tekst: 'Tel de hoepels nog eens' });
  kd = (await kv('GET', '/data')).json;
  const KP = require(T.ROOT + '/public/kv.js');
  const pagina = KP.aanvragenHtml(kd);
  T.check(kd.meldingen_kantoor.length === 2 && pagina.includes('Berichten van kantoor') && pagina.includes('Tel de hoepels nog eens') && pagina.includes('herinnering van kantoor') && pagina.includes('notitie van kantoor'), 'KV-pagina (tab Aanvragen): sectie "Berichten van kantoor" met herinnering en notitie');
  const leeg = KP.aanvragenHtml({ ...kd, meldingen_kantoor: [] });
  T.check(!leeg.includes('Berichten van kantoor'), 'zonder berichten verdwijnt de sectie');

  // ── Punt 5: één patroon.css ──
  const pg = await (await fetch(`${srv.base}/nakijken`, { headers: { Authorization: BASIC } })).text();
  const css = fs.readFileSync(T.ROOT + '/public/nakijken.css', 'utf8');
  T.check(pg.indexOf('/public/patroon.css') > -1 && pg.indexOf('/public/patroon.css') < pg.indexOf('/public/nakijken.css'), '/nakijken laadt patroon.css vóór nakijken.css');
  T.check(!/\.top\{/.test(css) || /\.top,\.sub\{flex:none\}/.test(css), 'nakijken.css bevat de bovenbalk/subbalk-regels niet meer zelf');
  T.check(!/^\.knop\{height:38px/m.test(css) && !/\.knop\.licht\{/.test(css) && !/#toasts/.test(css), 'knop-basis, knop.licht en toasts staan enkel nog in patroon.css');

  // ── knop Bundelen actief ──
  const tk = fs.readFileSync(T.ROOT + '/public/taken.js', 'utf8'), th = fs.readFileSync(T.ROOT + '/public/taken.html', 'utf8');
  T.check(/b-bundel'\)\.disabled=SEL\.size<2/.test(tk) && /\/api\/transport-taken\/bundel/.test(tk) && !/disabled title="Er bestaat nog geen bundel-route/.test(th), '/taken: knop Bundelen is actief vanaf 2 geselecteerde taken en roept de bundel-route aan');
} catch (e) {
  T.fout('test crashte: ' + (e.stack || e));
}
await T.einde(srv);
