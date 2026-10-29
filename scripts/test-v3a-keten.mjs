// Testscript V3a — ketenfixes transport (chat C): bulk-boekhouding, rit/taak sluiten, spoedtaak uit
// aanvraag, ophaalrit-lijst. Start een EIGEN server op poort 3311 met een wegwerp-db-kopie BUITEN de
// worktree (D:\Sporty\sporty-c-v3atest). Raakt nooit de echte sporty.db, nooit 3001/prod.
// Gebruik: node scripts/test-v3a-keten.mjs   (vanuit D:\Sporty\sporty-c)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { ritTekst } from './_rit-render.mjs';

const require = createRequire(import.meta.url);
const initSqlJs = require('sql.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3311;
const TESTDIR = path.resolve(ROOT, '..', 'sporty-c-v3atest');
const TEST_DB = path.join(TESTDIR, 'sporty.db');
const APP_PASSWORD = 'v3atest';
const BASIC = 'Basic ' + Buffer.from('sporty:' + APP_PASSWORD).toString('base64');
const BASE = `http://localhost:${PORT}`;

let fouten = 0, oks = 0;
const ok = (m) => { oks++; console.log('ok    ' + m); };
const fout = (m) => { fouten++; console.log('FOUT  ' + m); };
const check = (cond, m) => (cond ? ok(m) : fout(m));

fs.mkdirSync(path.join(TESTDIR, 'uploads'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'sporty.db'), TEST_DB);

const server = spawn(process.execPath, ['server.js'], {
  cwd: ROOT, env: { ...process.env, PORT: String(PORT), DATA_DIR: TESTDIR, APP_PASSWORD }, stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));
const stop = () => { try { server.kill(); } catch {} };
process.on('exit', stop);

async function wachtOpServer() {
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) {
    try { const r = await fetch(BASE + '/api/login-status', { headers: { authorization: BASIC } }); if (r.ok) return true; } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}
let TOKEN = null;
async function call(method, p, { body, sessie = true } = {}) {
  const headers = { authorization: BASIC };
  if (sessie && TOKEN) headers['x-auth-token'] = TOKEN;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(BASE + p, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, text, json };
}
// Live db lezen via de backup-route (de server houdt de db in het geheugen).
async function db(sql, params = []) {
  const r = await fetch(BASE + '/api/backup-db', { headers: { authorization: BASIC, 'x-auth-token': TOKEN } });
  const SQL = await initSqlJs();
  const d = new SQL.Database(Buffer.from(await r.arrayBuffer()));
  const st = d.prepare(sql); st.bind(params); const rows = []; while (st.step()) rows.push(st.getAsObject()); st.free(); d.close();
  return rows;
}
const spreiding = async (bakId) => Object.fromEntries((await db('SELECT locatie_id,aantal FROM bulk_spreiding WHERE bak_id=?', [bakId])).map((r) => [r.locatie_id, r.aantal]));
const som = (sp) => Object.values(sp).reduce((s, n) => s + n, 0);

try {
  if (!(await wachtOpServer())) { fout('server kwam niet op\n' + serverLog); process.exit(1); }
  ok('server op poort ' + PORT + ' met wegwerp-db ' + TEST_DB);
  let r = await call('POST', '/api/login', { body: { persoon_id: 10, pincode: '1111' }, sessie: false });
  TOKEN = r.json?.token; check(!!TOKEN, 'login Claude (API)');
  const startWijz = (await db('SELECT MAX(id) AS m FROM wijzigingen'))[0].m || 0;

  // ── Uitgangspunt ──
  const bulk = (await db("SELECT * FROM bakken WHERE is_bulk=1 AND thuislocatie_id IS NOT NULL AND aantal>=6 ORDER BY id LIMIT 1"))[0];
  check(!!bulk, `uitgangspunt: bulk-rij "${bulk?.naam}" (bezit ${bulk?.aantal}, thuis ${bulk?.thuislocatie_id})`);
  // Herstel invariant voor de test als de kopie scheef staat: alles op thuis.
  const sp0 = await spreiding(bulk.id);
  check(som(sp0) === bulk.aantal, `uitgangspunt: som spreiding ${som(sp0)} = bezit ${bulk.aantal}`);
  const thuis = bulk.thuislocatie_id;
  const thuisVoor = sp0[thuis] || 0;
  const kampLocs = await db("SELECT id,name FROM locaties WHERE type='kamp' ORDER BY id");
  const K = kampLocs[0].id, L = kampLocs[1].id;
  const lK = sp0[K] || 0, lL = sp0[L] || 0;
  check(lL === 0, `uitgangspunt: op ${kampLocs[1].name} staat 0 × ${bulk.naam}`);
  const themaBak = (await db("SELECT b.*,tb.thema_id FROM bakken b JOIN thema_bak tb ON tb.bak_id=b.id WHERE b.soort='thema' AND (b.is_bulk IS NULL OR b.is_bulk=0) ORDER BY b.id LIMIT 1"))[0];
  check(!!themaBak, `uitgangspunt: themabak "${themaBak?.naam}" (${themaBak?.code})`);

  // ── 1+2. Levering volledig via rit-token ──
  r = await call('POST', '/api/transport-taken', { body: { type: 'levering', datum: '2026-11-03', van_locatie_id: thuis, naar_locatie_id: K,
    regels: [{ naam: `3 × ${bulk.naam}`, qty: 3, soort: 'vast', bak_id: bulk.id }, { naam: `Bak ${themaBak.naam}`, qty: 1, soort: 'thema', bak_id: themaBak.id }] } });
  const taak1 = r.json.id;
  r = await call('POST', '/api/ritten', { body: { datum: '2026-11-03', chauffeur: 'Testchauffeur', taak_ids: [taak1] } });
  const rit1 = r.json.id;
  const tok1 = (await call('POST', `/api/ritten/${rit1}/token`)).json.token;
  r = await call('GET', '/rit/' + tok1, { sessie: false });
  // CH2: de pagina tekent zich uit de rit-data; zoek in de HTML die rit.js daaruit bouwt.
  const pgStatus = r.status;
  r.text = ritTekst((await call('GET', `/api/rit-token/${tok1}/data`, { sessie: false })).json);
  r.status = pgStatus;
  check(r.status === 200 && r.text.includes(themaBak.naam) && r.text.includes(bulk.naam), 'rit-pagina toont de bakkenlijst zonder Klaarzetten (checks automatisch aangemaakt)');
  check(r.text.includes('Ik ben aangekomen'), 'rit-pagina heeft per stop een knop "aangekomen"');
  const checks1 = (await call('GET', `/api/ritten/${rit1}/checks`)).json.checks;
  check(checks1.length === 2, `rit heeft 2 checks (kreeg ${checks1.length})`);
  r = await call('POST', `/api/rit-token/${tok1}/checks/${checks1[0].id}/laden`, { sessie: false });
  check(r.status === 200, 'eerste stuk laden → 200');
  check((await db('SELECT status FROM transport_ritten WHERE id=?', [rit1]))[0].status === 'onderweg', "rit → 'onderweg' na eerste stuk geladen");
  await call('POST', `/api/rit-token/${tok1}/checks/${checks1[1].id}/laden`, { sessie: false });
  check((await db('SELECT status FROM bakken WHERE id=?', [bulk.id]))[0].status !== 'onderweg', 'bulk-rij wordt bij laden NIET rechtstreeks op onderweg gezet');
  r = await call('POST', `/api/rit-token/${tok1}/taken/${taak1}/aangekomen`, { sessie: false });
  check(r.status === 200 && r.json.status === 'aangekomen', "stop → 'aangekomen'");
  r = await call('POST', `/api/rit-token/${tok1}/taken/${taak1}/aangekomen`);
  r = await call('POST', `/api/rit-token/${tok1}/checks/${checks1[0].id}/lossen`, { sessie: false });
  check((await db('SELECT status FROM transport_taken WHERE id=?', [taak1]))[0].status === 'aangekomen', 'na 1 van 2 gelost: taak nog niet gedaan');
  r = await call('POST', `/api/rit-token/${tok1}/checks/${checks1[1].id}/lossen`, { sessie: false });
  check(r.status === 200, 'laatste stuk lossen → 200');
  let t = (await db('SELECT status FROM transport_taken WHERE id=?', [taak1]))[0];
  check(t.status === 'gedaan', `alles gelost → taak 'gedaan' (kreeg ${t.status})`);
  const rr = (await call('GET', '/api/ritten')).json.find((x) => x.id === rit1);
  check(rr.status === 'gedaan', `alle taken gedaan → rit 'gedaan', zichtbaar in GET /api/ritten (kreeg ${rr.status})`);
  let sp = await spreiding(bulk.id);
  check(sp[K] === lK + 3 && sp[thuis] === thuisVoor - 3, `spreiding: ${kampLocs[0].name} ${lK}→${sp[K]}, thuis ${thuisVoor}→${sp[thuis]}`);
  check(som(sp) === bulk.aantal, `invariant: som spreiding ${som(sp)} = bezit ${bulk.aantal}`);
  let b = (await db('SELECT status,huidige_locatie_id FROM bakken WHERE id=?', [bulk.id]))[0];
  check(b.status === 'op_locatie' && b.huidige_locatie_id === K, `bulk-status afgeleid: op_locatie @ ${b.huidige_locatie_id}`);
  b = (await db('SELECT status,huidige_locatie_id FROM bakken WHERE id=?', [themaBak.id]))[0];
  check(b.status === 'op_locatie' && b.huidige_locatie_id === K, `themabak op_locatie @ ${kampLocs[0].name}`);

  // ── idempotent: terug op gepland en opnieuw gedaan ──
  await call('PUT', `/api/transport-taken/${taak1}/status`, { body: { status: 'gepland' } });
  r = await call('PUT', `/api/transport-taken/${taak1}/status`, { body: { status: 'gedaan' } });
  check(r.status === 200 && r.json.status === 'gedaan', 'taak opnieuw gedaan → 200');
  const sp2 = await spreiding(bulk.id);
  check(JSON.stringify(sp2) === JSON.stringify(sp), `opnieuw gedaan → spreiding ongewijzigd (${JSON.stringify(sp2)})`);
  await call('PUT', `/api/transport-taken/${taak1}/status`, { body: { status: 'gedaan' } });
  check(JSON.stringify(await spreiding(bulk.id)) === JSON.stringify(sp), 'gedaan → gedaan → spreiding ongewijzigd (geen 34 van 17)');

  // ── ophaling vanaf een locatie met 0 stuks → fout, geen bijtelling ──
  r = await call('POST', '/api/transport-taken', { body: { type: 'ophaling', datum: '2026-11-07', van_locatie_id: L, naar_locatie_id: thuis,
    regels: [{ naam: `2 × ${bulk.naam}`, qty: 2, soort: 'vast', bak_id: bulk.id }] } });
  const taak0 = r.json.id;
  r = await call('PUT', `/api/transport-taken/${taak0}/status`, { body: { status: 'gedaan' } });
  check(r.status === 409 && /staan maar 0/.test(r.json?.error || ''), `ophaling van 0 stuks via kantoorknop → 409 "${r.json?.error}"`);
  check((await db('SELECT status FROM transport_taken WHERE id=?', [taak0]))[0].status !== 'gedaan', 'die taak staat NIET op gedaan');
  check(JSON.stringify(await spreiding(bulk.id)) === JSON.stringify(sp), 'spreiding ongewijzigd (geen bijtelling op thuis)');
  r = await call('POST', '/api/ritten', { body: { datum: '2026-11-07', chauffeur: 'Testchauffeur', taak_ids: [taak0] } });
  const tok0 = (await call('POST', `/api/ritten/${r.json.id}/token`)).json.token;
  await call('GET', '/rit/' + tok0, { sessie: false });
  const c0 = (await call('GET', `/api/ritten/${r.json.id}/checks`)).json.checks[0];
  r = await call('POST', `/api/rit-token/${tok0}/checks/${c0.id}/lossen`, { sessie: false });
  check(r.status === 409, `ophaling van 0 stuks via rit-token lossen → 409 (kreeg ${r.status})`);
  check((await db('SELECT gelost FROM verhuis_checks WHERE id=?', [c0.id]))[0].gelost === 0, 'het vinkje blijft uit');

  // ── 4. ophaalrit: regels uit het voorstel + oude ophaling zonder regels ──
  r = await call('POST', '/api/transport-taken', { body: { type: 'ophaling', datum: '2026-11-07', van_locatie_id: K, naar_locatie_id: thuis,
    regels: [{ naam: `3 × ${bulk.naam}`, qty: 3, soort: 'vast', bak_id: bulk.id }] } });
  const taakO = r.json.id;
  // Toekomstige kampweek (maandag over 3 weken, 5 dagen) zodat 'datum binnen de kampweek' echt getest wordt.
  const ma = new Date(); ma.setDate(ma.getDate() + 21 + ((8 - ma.getDay()) % 7)); const vr = new Date(ma); vr.setDate(ma.getDate() + 4);
  const perId = (await call('POST', '/api/periodes', { body: { naam: 'V3a testweek', start_datum: ma.toISOString().slice(0, 10), eind_datum: vr.toISOString().slice(0, 10) } })).json?.id;
  check(!!perId, 'testperiode aangemaakt ' + ma.toISOString().slice(0, 10));
  const kmR = await call('POST', '/api/kampmomenten', { body: { locatie_id: K, week: 1, periode_id: perId } });
  const kmId = kmR.json?.id;
  await call('POST', `/api/kampmomenten/${kmId}/themas`, { body: { thema_id: themaBak.thema_id } });
  r = await call('POST', '/api/transport-taken', { body: { type: 'ophaling', datum: '2026-11-07', van_locatie_id: K, naar_locatie_id: thuis, kampmoment_id: kmId } });
  const taakOud = r.json.id;
  r = await call('POST', '/api/ritten', { body: { datum: '2026-11-07', chauffeur: 'Testchauffeur', taak_ids: [taakO, taakOud] } });
  const ritO = r.json.id;
  const tokO = (await call('POST', `/api/ritten/${ritO}/token`)).json.token;
  r = await call('GET', '/rit/' + tokO, { sessie: false });
  r.text = ritTekst((await call('GET', `/api/rit-token/${tokO}/data`, { sessie: false })).json);
  check(r.text.includes(`3 × ${bulk.naam}`), 'ophaalrit-pagina toont de bulkregel van het voorstel (zonder Klaarzetten)');
  check(r.text.includes(themaBak.naam), 'oude ophaling zonder regels: bak afgeleid uit wat op de locatie staat voor dat kampmoment');
  const chO = (await call('GET', `/api/ritten/${ritO}/checks`)).json.checks;
  check(chO.some((c) => c.taak_id === taakOud && c.bak_id === themaBak.id), 'afgeleide check hangt aan de oude ophaaltaak met bak_id');
  for (const c of chO) { await call('POST', `/api/rit-token/${tokO}/checks/${c.id}/laden`, { sessie: false }); }
  for (const c of chO) { await call('POST', `/api/rit-token/${tokO}/checks/${c.id}/lossen`, { sessie: false }); }
  const spO = await spreiding(bulk.id);
  check(spO[K] === lK && spO[thuis] === thuisVoor && som(spO) === bulk.aantal, `ophaling terug: spreiding hersteld (${JSON.stringify(spO)}), som = bezit`);
  b = (await db('SELECT status FROM bakken WHERE id=?', [bulk.id]))[0];
  check(lK > 0 || b.status === 'thuis', `bulk-status afgeleid na ophaling: ${b.status}`);
  check((await db('SELECT status FROM transport_ritten WHERE id=?', [ritO]))[0].status === 'gedaan', 'ophaalrit → gedaan');

  // ── 3. aanvraag → goedkeuren → spoedtaak; afwijzen → geannuleerd ──
  const km = (await db('SELECT * FROM kampmomenten WHERE id=?', [kmId]))[0];
  const per = (await db('SELECT * FROM vakantieperiodes WHERE id=?', [km.periode_id]))[0];
  r = await call('POST', '/api/aanvragen', { body: { kampmoment_id: kmId, soort: 'materiaal', tekst: '3 rollen tape' } });
  const aid = r.json.id;
  r = await call('PUT', `/api/aanvragen/${aid}/status`, { body: { status: 'goedgekeurd', maak_spoedtransport: true } });
  const st = (await db('SELECT * FROM transport_taken WHERE id=?', [r.json.spoed_taak_id]))[0];
  const regel = (await db('SELECT * FROM transport_regels WHERE taak_id=?', [st.id]))[0];
  const rozenweg = (await db("SELECT id FROM locaties WHERE name LIKE '%Rozenweg%' ORDER BY (parent_id IS NULL) DESC,id LIMIT 1"))[0]?.id;
  check(st.van_locatie_id === rozenweg, `spoedtaak van = Rozenweg (${st.van_locatie_id})`);
  check(st.naar_locatie_id === K, `spoedtaak naar = kamplocatie van het kampmoment (${st.naar_locatie_id})`);
  const dag = new Date(st.datum + 'T12:00:00').getDay();
  const ws = new Date(per.start_datum + 'T12:00:00'); const we = new Date(ws); we.setDate(ws.getDate() + 6);
  const vandaag = new Date().toISOString().slice(0, 10);
  const inWeek = st.datum >= ws.toISOString().slice(0, 10) && st.datum <= we.toISOString().slice(0, 10);
  if (per.start_datum > vandaag) check(inWeek, `toekomstige kampweek: spoeddatum ${st.datum} valt BINNEN de week`);
  check(dag !== 0 && dag !== 6 && (inWeek || st.datum >= vandaag), `spoedtaak datum ${st.datum}: werkdag, in kampweek (${per.start_datum} +6) of vanaf vandaag`);
  check(regel.qty === 3, `aantal uit "3 rollen tape" = 3 (kreeg ${regel.qty})`);
  check(st.aanvraag_id === aid, 'koppeling aanvraag_id op de taak');
  r = await call('PUT', `/api/aanvragen/${aid}/status`, { body: { status: 'afgewezen', reden: 'test' } });
  check(r.status === 200, 'afwijzen → 200');
  check((await db('SELECT status FROM transport_taken WHERE id=?', [st.id]))[0].status === 'geannuleerd', "gekoppelde spoedtaak → 'geannuleerd'");
  // geladen spoedtaak afwijzen → 409
  r = await call('POST', '/api/aanvragen', { body: { kampmoment_id: kmId, soort: 'materiaal', tekst: 'extra lijm' } });
  const aid2 = r.json.id;
  r = await call('PUT', `/api/aanvragen/${aid2}/status`, { body: { status: 'goedgekeurd', maak_spoedtransport: true } });
  const st2 = (await db('SELECT * FROM transport_taken WHERE id=?', [r.json.spoed_taak_id]))[0];
  check((await db('SELECT qty FROM transport_regels WHERE taak_id=?', [st2.id]))[0].qty === 1, 'aanvraag zonder getal → aantal 1');
  const tok2 = (await call('POST', `/api/ritten/${st2.rit_id}/token`)).json.token;
  await call('GET', '/rit/' + tok2, { sessie: false });
  const c2 = (await call('GET', `/api/ritten/${st2.rit_id}/checks`)).json.checks[0];
  await call('POST', `/api/rit-token/${tok2}/checks/${c2.id}/laden`, { sessie: false });
  r = await call('PUT', `/api/aanvragen/${aid2}/status`, { body: { status: 'afgewezen' } });
  check(r.status === 409, `geladen spoedtaak afwijzen → 409 "${r.json?.error}"`);

  // ── wijzigingen-log ──
  const w = await db('SELECT tabel,COUNT(*) AS n FROM wijzigingen WHERE id>? GROUP BY tabel', [startWijz]);
  const per_t = Object.fromEntries(w.map((x) => [x.tabel, x.n]));
  for (const tb of ['bulk_spreiding', 'transport_taken', 'transport_ritten', 'aanvragen', 'bakken'])
    check(per_t[tb] > 0, `wijzigingen bevat regels voor ${tb} (${per_t[tb] || 0})`);
  const ctx = await db("SELECT COUNT(*) AS n FROM wijzigingen WHERE id>? AND context='rit-link' AND tabel='transport_taken'", [startWijz]);
  check(ctx[0].n > 0, 'taak-afronding via rit-token gelogd met context rit-link');
} catch (e) {
  fout('onverwachte fout: ' + (e.stack || e));
} finally {
  stop();
}
console.log(`\n${oks} ok, ${fouten} fout`);
if (fouten === 0) { console.log('ALLES GROEN'); process.exit(0); }
console.log('NIET GROEN\n--- serverlog (staart) ---\n' + serverLog.slice(-1500)); process.exit(1);
