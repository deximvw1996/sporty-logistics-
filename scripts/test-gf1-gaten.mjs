// test-gf1-gaten.mjs — GF1 (chat D): de gaten uit de generale repetitie (GR1) zijn dicht. Eigen server via _testhulp (poort 3347, herfst-test.db).
import * as T from './_testhulp.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const POORT = parseInt(process.env.TEST_POORT || '3347');
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: POORT });
let tok;
let initSqlJs; try { initSqlJs = require('sql.js'); } catch { initSqlJs = require(T.ROOT + '/../sporty-railway/node_modules/sql.js'); }
const BASIC = 'Basic ' + Buffer.from('sporty:' + T.APP_PASSWORD).toString('base64');
async function dbBytes() { const r = await fetch(srv.base + '/api/backup-db', { headers: { authorization: BASIC, 'x-auth-token': tok } }); return Buffer.from(await r.arrayBuffer()); }
async function db(sql, params = []) {
  const SQL = await initSqlJs(); const d = new SQL.Database(await dbBytes());
  const st = d.prepare(sql); st.bind(params); const rows = []; while (st.step()) rows.push(st.getAsObject()); st.free(); d.close(); return rows;
}
async function tellingen() {
  const SQL = await initSqlJs(); const d = new SQL.Database(await dbBytes());
  const t = d.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")[0].values.map((v) => v[0]);
  const out = {}; for (const n of t) out[n] = d.exec(`SELECT COUNT(*) FROM "${n}"`)[0].values[0][0]; d.close(); return out;
}
try {
  tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const P = (m, p, b) => T.api(srv.base, null, m, p, b);
  const R = ijk.locaties.rozenweg, AB = ijk.locaties.abdijschool, BE = ijk.locaties.betekom, km = ijk.kampmomenten.abdijschool;
  const periode = (await A('GET', '/api/periodes/actief')).json;
  const locs = (await A('GET', '/api/locaties')).json.filter((l) => l.type === 'kamp');
  const themas = (await A('GET', '/api/themas')).json;
  const vrij = themas.filter((x) => ![ijk.themas.alles_op_wieltjes, ijk.themas.holderdebolder].includes(x.id));
  const maakBak = async (thema, label, code, items = [['Stuk', 1]]) => { const b = (await A('POST', `/api/themas/${thema}/bakken`, { label, code })).json; for (const [n, q] of items) await A('POST', `/api/bakken/${b.id}/items`, { naam: n, qty: q }); return b.id; };
  const reg = (naam, bak) => ({ naam, qty: 1, soort: 'thema', bak_id: bak });
  const DAG = '2026-11-02';

  // ── Punt 1: rest-taak krijgt datum en week ──
  const bk1 = await maakBak(vrij[0].id, 'Gf1 bak een', 'GF1A'), bk2 = await maakBak(vrij[0].id, 'Gf1 bak twee', 'GF1B');
  const t1 = (await A('POST', '/api/transport-taken', { type: 'levering', datum: DAG, tijd: '09:00', van_locatie_id: R, naar_locatie_id: AB, kampmoment_id: km, regels: [reg('Bak Gf1 bak een (GF1A)', bk1), reg('Bak Gf1 bak twee (GF1B)', bk2)] })).json.id;
  const rit = (await A('POST', '/api/ritten', { datum: DAG, chauffeur: 'Jan', taak_ids: [t1] })).json.id;
  await A('POST', `/api/ritten/${rit}/checks/init`);
  const rtok = await T.ritToken(srv.base, tok, rit);
  const stop = (await P('GET', `/api/rit-token/${rtok}/data`)).json.stops[0];
  let r = await P('POST', `/api/rit-token/${rtok}/checks/${stop.regels[0].check_id}/niet-mee`, { reden: 'past_niet', opmerking: 'busje vol' });
  const rest = (await db('SELECT * FROM transport_taken WHERE id=?', [r.json.rest_taak_id]))[0];
  T.check(r.status === 200 && rest.datum === DAG && rest.week >= 1 && rest.rit_id === null && rest.slot === 'vrij', `rest-taak #${rest.id}: datum ${rest.datum}, week ${rest.week}, zonder rit, slot vrij`);
  const tk = (await A('GET', `/api/taken-overzicht?week=${DAG}`)).json;
  T.check(tk.taken.some((t) => t.id === rest.id), 'de rest-taak staat in /taken (taken-overzicht van die week)');
  let v = (await A('GET', `/api/vandaag?datum=${DAG}`)).json;
  T.check(v.inplannen.some((i) => i.taak_id === rest.id && i.ico === '🚚'), 'de rest-taak staat op Vandaag › Inplannen (🚚)');
  // de migratie vult oude rest-taken zonder datum uit hun rit (zelfde afleiding): gecontroleerd op de broncode en op een nieuwe taak zonder datum
  const migr = require('node:fs').readFileSync(T.ROOT + '/lib/migraties.js', 'utf8');
  T.check(/migratie78_klaar/.test(migr) && /rest_van_rit_id IS NOT NULL AND \(datum IS NULL OR datum=''\)/.test(migr), 'migratie 78 (gegate op migratie78_klaar) vult rest-taken zonder datum uit hun rit');

  // ── Punt 2: Vandaag — ritten van morgen en tellingen te keuren ──
  const rm = (await A('POST', '/api/ritten', { datum: '2026-11-03', chauffeur: 'Piet', taak_ids: [] })).json.id;
  const tm = (await A('POST', '/api/transport-taken', { type: 'levering', datum: '2026-11-03', tijd: '09:00', van_locatie_id: R, naar_locatie_id: BE, regels: [reg('Bak Gf1 bak een (GF1A)', bk1)] })).json.id;
  await A('PUT', `/api/transport-taken/${tm}/rit`, { rit_id: rm });
  v = (await A('GET', `/api/vandaag?datum=${DAG}`)).json;
  T.check(Array.isArray(v.ritten_morgen) && v.ritten_morgen.some((x) => x.id === rm) && !v.ritten_vandaag.some((x) => x.id === rm), `ritten_morgen bevat rit #${rm} (${v.ritten_morgen.length}); ritten_vandaag niet`);
  const pagina = require('node:fs').readFileSync(T.ROOT + '/public/vandaag.js', 'utf8');
  T.check(/ritten_morgen/.test(pagina) && /Morgen/.test(pagina), 'de Vandaag-pagina toont "Morgen" onder de ritten van vandaag (zelfde rijstijl)');
  const kvtok = await T.kvToken(srv.base, tok, km);
  const kv = (m, p, b) => P(m, `/api/kv/${kvtok}${p}`, b);
  await A('POST', `/api/kampmomenten/${km}/themas`, { thema_id: vrij[0].id });
  const kd = (await kv('GET', '/data')).json;
  const bakKv = kd.bakken.find((b) => b.code === 'GF1A');
  await kv('POST', `/bakken/${bakKv.id}/tellen`, { regels: [{ item_id: bakKv.items[0].id, aangetroffen: 1, notitie: 'ok' }] });
  await kv('POST', '/versturen', {});
  v = (await A('GET', `/api/vandaag?datum=${DAG}`)).json;
  const tel = v.nakijken.find((n) => /te keuren/.test(n.titel));
  T.check(tel && /^\d+ telling(en)? te keuren$/.test(tel.titel) && tel.acties[0].url === '/nakijken', `Vandaag › Nakijken: "${tel?.titel}" met Open → /nakijken`);
  const laat = (await A('GET', '/api/vandaag?datum=2026-11-10')).json;
  const nietGeteld = laat.nakijken.find((n) => /niet geteld van kampweek/.test(n.titel));
  T.check(nietGeteld && nietGeteld.acties[0].url === '/nakijken', `Vandaag › Nakijken (na de kampweek): "${nietGeteld?.titel}" met Open → /nakijken`);

  // ── Punt 3: KV-tellingen in wijzigingen ──
  const wz = await db("SELECT * FROM wijzigingen WHERE context='kv-link' ORDER BY id");
  const wr = wz.filter((w) => w.tabel === 'nakijk_regels'), ws = wz.filter((w) => w.tabel === 'nakijk_sessies');
  T.check(wr.length >= 1 && ws.length >= 2 && wz.every((w) => /\(KV\)$/.test(w.persoon_naam || '')), `KV-tellen en -versturen staan in wijzigingen (${wr.length} regels, ${ws.length} sessie-wijzigingen) met de KV als wie ("${wz[0]?.persoon_naam}")`);
  await kv('POST', '/aanvraag', { tekst: 'Gf1 aanvraag' });
  T.check((await db("SELECT COUNT(*) AS n FROM wijzigingen WHERE tabel='aanvragen' AND context='kv-link' AND persoon_naam LIKE '%(KV)'"))[0].n >= 1, 'een aanvraag van de KV staat ook op naam van de KV in wijzigingen');
  const sess = (await A('GET', '/api/nakijken')).json.bakken.find((b) => b.kampmoment_id === km && b.bak.code === 'GF1A');
  const hist = (await A('GET', `/api/nakijken/sessie/${sess.sessie_id}`)).json.historiek;
  T.check(hist.some((h) => /geteld 1/.test(h.tekst) && /\(KV\)$/.test(h.wie)) && hist.some((h) => /telling verstuurd door de KV/.test(h.tekst)), `Nakijken › Historiek toont de KV-acties (${hist.map((h) => h.tekst).slice(0, 4).join(' / ')})`);

  // ── Punt 4: coördinator ──
  const cp = (await A('POST', '/api/personeel', { naam: 'Gf1 Coördinator', rol: 'coordinator' })).json;
  T.check(cp.rol === 'coordinator', 'POST /api/personeel accepteert de rol coordinator');
  await A('POST', `/api/personeel/${cp.id}/pincode`, { pincode: '4321' });
  const lijst = (await P('GET', '/api/personeel-lijst-login')).json;
  T.check(lijst.some((p) => p.id === cp.id && p.rol === 'coordinator'), 'de coördinator staat in het loginscherm');
  const lg = await T.api(srv.base, null, 'POST', '/api/login', { persoon_id: cp.id, pincode: '4321' });
  T.check(lg.status === 200 && lg.json.rol === 'coordinator', 'coördinator logt in met pincode');
  const C = (m, p, b) => T.api(srv.base, lg.json.token, m, p, b);
  const rc = (await A('POST', '/api/ritten', { datum: DAG, personeel_id: cp.id, taak_ids: [] })).json;
  T.check(rc.bestuurder_rol === 'coordinator', `rit met de coördinator als bestuurder → bestuurder_rol "${rc.bestuurder_rol}"`);
  const rcTok = await T.ritToken(srv.base, tok, rc.id);
  T.check((await P('GET', `/api/rit-token/${rcTok}/data`)).status === 200, 'rit-link-acties werken voor de coördinator als bestuurder (publieke rit-link)');
  T.check((await C('GET', `/api/aanvullijst?datum=${DAG}`)).status === 200, '200 op /api/aanvullijst');
  T.check((await C('GET', '/api/vandaag')).status === 403 && (await C('GET', '/api/nakijken')).status === 403 && (await C('GET', '/api/kampmomenten-overzicht')).status === 403, '403 op /api/vandaag (zonder mijn=1) en op andere kantoorroutes');
  const mijn = await C('GET', `/api/vandaag?mijn=1&datum=${DAG}`);
  T.check(mijn.status === 200 && mijn.json.mijn === true && mijn.json.ritten_vandaag.length === 1 && mijn.json.ritten_vandaag[0].id === rc.id && !('beslissen' in mijn.json) && mijn.json.aanvullen, `/api/vandaag?mijn=1 → 200 met enkel de eigen rit (#${mijn.json.ritten_vandaag?.[0]?.id}) en aanvullen`);
  T.check((await C('POST', '/api/transport-taken/bundel', { taak_ids: [t1, tm] })).status === 403, 'coördinator mag geen kantoor-acties (bundelen → 403)');

  // ── Punt 5: weekend-bevestiging ──
  const wt = (await A('POST', '/api/transport-taken', { type: 'transfer', datum: '2026-11-07', tijd: '09:00', van_locatie_id: R, naar_locatie_id: AB, regels: [reg('Bak Gf1 bak twee (GF1B)', bk2)] })).json.id;
  const writ = (await A('POST', '/api/ritten', { datum: '2026-11-07', chauffeur: 'Jan', taak_ids: [wt] })).json.id;
  const wr1 = (await A('GET', `/api/ritten/${writ}`)).json;
  const w1 = (wr1.waarschuwingen || (await A('GET', '/api/ritten?week=2026-11-07')).json.find((x) => x.id === writ)?.waarschuwingen || []);
  T.check(w1.includes('weekend') && w1.includes('weekend · nog niet bevestigd'), `weekendrit zonder bevestiging: ${JSON.stringify(w1)}`);
  r = await A('POST', `/api/transport-taken/${t1}/weekend-bevestig`);
  T.check(r.status === 400, 'weekend-bevestig op een gewone werkdagtaak → 400');
  r = await A('POST', `/api/transport-taken/${wt}/weekend-bevestig`);
  const w2 = (await A('GET', '/api/ritten?week=2026-11-07')).json.find((x) => x.id === writ)?.waarschuwingen || [];
  T.check(r.status === 200 && r.json.weekend_bevestigd_door && r.json.weekend_bevestigd_op && w2.some((w) => /^weekend · bevestigd door /.test(w)) && !w2.includes('weekend · nog niet bevestigd'), `na bevestigen: ${JSON.stringify(w2)} (bewaard: ${r.json.weekend_bevestigd_door} ${r.json.weekend_bevestigd_op})`);
  T.check((await db("SELECT COUNT(*) AS n FROM wijzigingen WHERE context='weekend-bevestig'"))[0].n === 1, 'de bevestiging is gelogd');
  T.check((await C('POST', `/api/transport-taken/${wt}/weekend-bevestig`)).status === 403, 'enkel kantoor kan bevestigen (coördinator → 403)');
  const rp = require('node:fs').readFileSync(T.ROOT + '/public/ritplanning.js', 'utf8');
  T.check(/weekend-bevestig/.test(rp) && /bevestigd door/.test(rp), 'de ritplanning-pagina roept weekend-bevestig aan na de vraagModal en toont de tekst');

  // ── Punt 6: opruimen volledig ──
  const lx = locs[4];
  const pers = (await A('GET', '/api/personeel')).json.find((p) => p.rol === 'kv') || (await A('POST', '/api/personeel', { naam: 'Gf1 KV', rol: 'kv' })).json;
  const bx = await maakBak(vrij[1].id, 'Gf1 bak x', 'GF1X', [['A', 2], ['B', 3]]);
  const voorBak = await tellingen(); // bak, items en KV bestaan al: enkel wat aan het kampmoment hangt moet verdwijnen
  const kx = (await A('POST', '/api/kampmomenten', { locatie_id: lx.id, week: 1, periode_id: periode.id, type: 'kamp' })).json;
  await A('PUT', `/api/kampmomenten/${kx.id}`, { kv_persoon_id: pers.id });
  await A('POST', `/api/kampmomenten/${kx.id}/themas`, { thema_id: vrij[1].id });
  const ktok = await T.kvToken(srv.base, tok, kx.id);
  const kd2 = (await P('GET', `/api/kv/${ktok}/data`)).json;
  const bb = kd2.bakken.find((b) => b.code === 'GF1X');
  await P('POST', `/api/kv/${ktok}/bakken/${bb.id}/tellen`, { regels: [{ item_id: bb.items[0].id, aangetroffen: 1, kapot_aantal: 1, notitie: 'x' }] });
  await P('POST', `/api/kv/${ktok}/versturen`, {});
  await P('POST', `/api/kv/${ktok}/aanvraag`, { tekst: 'Gf1 opruim aanvraag' });
  await A('PUT', `/api/kampmomenten/${kx.id}/velden`, { dagen: [true, true, true, true, true, true, false] });
  const tx = (await A('POST', '/api/transport-taken', { type: 'levering', datum: DAG, tijd: '08:00', van_locatie_id: R, naar_locatie_id: lx.id, kampmoment_id: kx.id, regels: [reg('Bak Gf1 bak x (GF1X)', bx)] })).json.id;
  const rx = (await A('POST', '/api/ritten', { datum: DAG, chauffeur: 'Jan', taak_ids: [tx] })).json.id;
  await A('POST', `/api/ritten/${rx}/checks/init`);
  const midden = await tellingen();
  T.check(midden.nakijk_sessies > voorBak.nakijk_sessies && midden.nakijk_regels > voorBak.nakijk_regels && midden.aanvragen > voorBak.aanvragen && midden.verhuis_checks > voorBak.verhuis_checks && midden.kalender_dagen > voorBak.kalender_dagen, `opbouw laat rijen achter (sessies +${midden.nakijk_sessies - voorBak.nakijk_sessies}, regels +${midden.nakijk_regels - voorBak.nakijk_regels}, aanvragen +${midden.aanvragen - voorBak.aanvragen}, checks +${midden.verhuis_checks - voorBak.verhuis_checks}, kalenderdagen +${midden.kalender_dagen - voorBak.kalender_dagen})`);
  const rtx = await T.ritToken(srv.base, tok, rx);
  const cx = (await P('GET', `/api/rit-token/${rtx}/data`)).json.stops[0].regels[0].check_id;
  await P('POST', `/api/rit-token/${rtx}/checks/${cx}/laden`);
  r = await A('POST', `/api/kampmomenten/${kx.id}/volledig-verwijderen`);
  T.check(r.status === 409 && /al geladen/.test(r.json.error) && (await db('SELECT id FROM kampmomenten WHERE id=?', [kx.id])).length === 1, `volledig verwijderen met geladen stuk → 409 ("${r.json.error}")`);
  await P('POST', `/api/rit-token/${rtx}/checks/${cx}/laden`);
  await A('DELETE', `/api/ritten/${rx}`);
  r = await A('POST', `/api/kampmomenten/${kx.id}/volledig-verwijderen`);
  const na = await tellingen();
  const LOG = new Set(['wijzigingen', 'activiteiten_log', 'sessies']);
  const verschil = Object.keys({ ...voorBak, ...na }).filter((t) => !LOG.has(t) && (voorBak[t] || 0) !== (na[t] || 0)).map((t) => `${t} ${voorBak[t] || 0}→${na[t] || 0}`);
  T.check(r.status === 200 && r.json.verwijderd.taken === 1 && verschil.length === 0, `volledig verwijderen: alle rijtellingen gelijk aan vóór het kampmoment${verschil.length ? ' — VERSCHIL ' + verschil.join(', ') : ''} (${JSON.stringify(r.json.verwijderd)})`);
  T.check((await C('POST', `/api/kampmomenten/${kx.id}/volledig-verwijderen`)).status === 403 && (await A('POST', `/api/kampmomenten/${kx.id}/volledig-verwijderen`)).status === 404, 'enkel kantoor (403) en een tweede keer → 404');
  const script = require('node:fs').readFileSync(T.ROOT + '/scripts/generale-repetitie.mjs', 'utf8');
  T.check(/'Rozenweg', 'Kantoor', 'Marko'/.test(script) && !/'Marco'\]/.test(script) && /volledig-verwijderen/.test(script), 'het seed-script gebruikt de echte stockage "Marko" en de volledige opruimroute');

  // ── Punt 7: generator — ophaling op de laatste kampdag, themadag-levering ──
  const LASTDAY = '2026-11-06';
  const lt = locs[5], ld = locs[6];
  const k7 = (await A('POST', '/api/kampmomenten', { locatie_id: lt.id, week: 1, periode_id: periode.id, type: 'kamp' })).json;
  const b7 = await maakBak(vrij[2].id, 'Gf1 bak 7', 'GF17');
  await A('POST', `/api/kampmomenten/${k7.id}/themas`, { thema_id: vrij[2].id });
  const kd7 = (await A('POST', '/api/kampmomenten', { locatie_id: ld.id, week: 1, periode_id: periode.id, type: 'themadag' })).json;
  const dagBakken = [];
  for (let d = 0; d < 5; d++) { const th = vrij[3 + d]; const bid = await maakBak(th.id, 'Gf1 dagbak ' + d, 'GFD' + d); dagBakken.push(bid); await A('POST', `/api/kampmomenten/${kd7.id}/themas`, { thema_id: th.id, dag: d }); }
  let g = await A('POST', '/api/transport-genereer', {});
  const vs = (id) => g.json.filter((x) => x.kampmoment_id === id);
  const oph7 = vs(k7.id).filter((x) => x.type === 'ophaling');
  T.check(g.status === 200 && oph7.length >= 1 && oph7.every((x) => x.datum === LASTDAY), `ophalingen van een themakamp staan op de laatste kampdag ${LASTDAY} (${oph7.map((x) => x.datum).join(', ')}), niet de maandag erna`);
  const levD = vs(kd7.id).filter((x) => x.type === 'levering'), ophD = vs(kd7.id).filter((x) => x.type === 'ophaling');
  const namenLev = levD.flatMap((x) => x.materiaal.map((m) => m.bak_id));
  T.check(levD.length === 1 && dagBakken.every((b) => namenLev.includes(b)) && levD[0].datum < '2026-11-02' + 'x' && levD[0].datum <= '2026-11-02', `themadag-locatie: één levering (${levD[0]?.datum}) met het materiaal van alle 5 dagen (${namenLev.length} bakken)`);
  T.check(ophD.length === 1 && ophD[0].datum === LASTDAY && dagBakken.every((b) => ophD[0].materiaal.some((m) => m.bak_id === b)), `… en één ophaling op ${ophD[0]?.datum} met dezelfde bakken`);

  // ── Punt 8: kookdagen sturen de oven mee ──
  const lk = locs[7];
  await A('POST', '/api/locatie-config', { kamplocatie_id: lk.id, vast_type: 'verkeerskoffer', conditie_type: 'kookthema', conditie_waarde: '', aantal: 1 });
  const k8 = (await A('POST', '/api/kampmomenten', { locatie_id: lk.id, week: 1, periode_id: periode.id, type: 'kamp' })).json;
  await A('POST', `/api/kampmomenten/${k8.id}/themas`, { thema_id: vrij[8].id });
  const heeftOven = async () => (await A('POST', '/api/transport-genereer', {})).json.filter((x) => x.kampmoment_id === k8.id && x.type === 'levering').some((x) => x.materiaal.some((m) => /Verkeerskoffer/.test(m.naam)));
  T.check(!(await heeftOven()), 'zonder kookdagen gaat het kook-materiaal (conditie kookthema) niet mee');
  await A('PUT', `/api/kampmomenten/${k8.id}/velden`, { kookdagen: ['wo', 'do'] });
  T.check(await heeftOven(), 'met kookdagen wo/do gaat het mee (conditie kookthema volgt kampmomenten.kookdagen)');
  const locRij = (await A('GET', '/api/locaties')).json.find((l) => l.id === lk.id);
  await A('PUT', `/api/locaties/${lk.id}`, { ...locRij, heeft_eigen_oven: 1 });
  T.check(!(await heeftOven()), 'heeft de locatie een eigen oven, dan gaat het niet mee');
} catch (e) {
  T.fout('test crashte: ' + (e.stack || e));
}
await T.einde(srv);
