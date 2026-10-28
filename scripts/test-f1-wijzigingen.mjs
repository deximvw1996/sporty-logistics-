// Testscript F1 deel 3 — wijzigingslog (chat A).
// Eigen server op poort 3313 met wegwerp-db-kopie in D:\Sporty\sporty-a-f1test-wijzigingen (BUITEN de worktree).
// 1) Als kantoor: kampmoment aanmaken, wijzigen, verwijderen -> 3 regels in `wijzigingen` (insert/update/delete),
//    persoon_naam = Claude (API), oud/nieuw exact gelijk aan de rijen die de API teruggaf / die vooraf gelezen werden.
// 2) Chauffeursroute (/api/rit-token/...): rit + taak met bak aanmaken als kantoor, checks init, rit-token,
//    bak laden -> bakken-update met context 'rit-link' en persoon_id null.
// 3) KV-link (/api/kv/:token/aanvraag): aanvragen-insert met context 'kv-link' en persoon_id null.
// 4) GET /api/wijzigingen?tabel=kampmomenten geeft de regels; als chauffeur-rol -> 403.
// Gebruik: node scripts/test-f1-wijzigingen.mjs   (vanuit D:\Sporty\sporty-a)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const initSqlJs = require('sql.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3313;
const TESTDIR = path.resolve(ROOT, '..', 'sporty-a-f1test-wijzigingen');
const BRON_DB = 'D:\\Sporty\\sporty-railway\\sporty.db';
const TEST_DB = path.join(TESTDIR, 'sporty.db');
const APP_PASSWORD = 'f1test';
const BASIC = 'Basic ' + Buffer.from('sporty:' + APP_PASSWORD).toString('base64');
const BASE = `http://localhost:${PORT}`;
let fouten = 0, oks = 0;
const ok = (m) => { oks++; console.log('ok    ' + m); };
const fout = (m) => { fouten++; console.log('FOUT  ' + m); };
const check = (c, m) => (c ? ok(m) : fout(m));
const slaap = (ms) => new Promise((r) => setTimeout(r, ms));
const gelijk = (a, b) => JSON.stringify(a) === JSON.stringify(b);

fs.mkdirSync(TESTDIR, { recursive: true });
fs.copyFileSync(BRON_DB, TEST_DB);

let serverLog = '';
const server = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DATA_DIR: TESTDIR, APP_PASSWORD }, stdio: ['ignore', 'pipe', 'pipe'] });
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));
const stop = () => { try { server.kill(); } catch {} };
process.on('exit', stop);
async function wachtOpServer() {
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) {
    try { const r = await fetch(BASE + '/api/login-status', { headers: { authorization: BASIC } }); if (r.ok) return true; } catch {}
    await slaap(200);
  }
  return false;
}
async function call(method, p, { token, body } = {}) {
  const headers = { authorization: BASIC };
  if (token) headers['x-auth-token'] = token;
  let b; if (body !== undefined) { b = JSON.stringify(body); headers['content-type'] = 'application/json'; }
  const res = await fetch(BASE + p, { method, headers, body: b });
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}
async function leesDb(sql, p = []) {
  await slaap(150); // per-request-flush afwachten
  const SQL = await initSqlJs(); const db = new SQL.Database(fs.readFileSync(TEST_DB));
  const s = db.prepare(sql); s.bind(p); const r = []; while (s.step()) r.push(s.getAsObject()); s.free(); db.close(); return r;
}
const parse = (s) => (s == null ? null : JSON.parse(s));

try {
  if (!(await wachtOpServer())) { fout('server kwam niet op\n' + serverLog); process.exit(1); }
  ok('server op poort ' + PORT + ' met wegwerp-db ' + TEST_DB);
  check(/Migratie 65/.test(serverLog) || (await leesDb("SELECT name FROM sqlite_master WHERE type='table' AND name='wijzigingen'")).length === 1, 'tabel wijzigingen bestaat (migratie 65)');
  check((await leesDb("SELECT naam FROM app_vlaggen WHERE naam='migratie65_klaar'")).length === 1, 'vlag migratie65_klaar staat in app_vlaggen');
  check((await leesDb("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_wijzigingen_tabel_rij'")).length === 1, 'index idx_wijzigingen_tabel_rij bestaat');

  let r = await call('POST', '/api/login', { body: { persoon_id: 10, pincode: '1111' } });
  check(r.status === 200 && r.json?.token, `login Claude (API) -> ${r.status}`);
  const kantoor = r.json?.token; const kantoorNaam = r.json?.naam;
  if (!kantoor) { console.log('NIET GROEN'); process.exit(1); }
  const locatie = (await leesDb('SELECT id FROM locaties ORDER BY id LIMIT 1'))[0]?.id;
  const locatie2 = (await leesDb('SELECT id FROM locaties ORDER BY id LIMIT 1 OFFSET 1'))[0]?.id ?? locatie;

  // ── 1. Kampmoment: aanmaken, wijzigen, verwijderen ──
  r = await call('POST', '/api/kampmomenten', { token: kantoor, body: { locatie_id: locatie, week: 97, type: 'kamp' } });
  check(r.status === 200 && r.json?.id, `POST /api/kampmomenten -> ${r.status}`);
  const kmId = r.json?.id;
  const kmNaInsert = (await leesDb('SELECT * FROM kampmomenten WHERE id=?', [kmId]))[0];
  r = await call('PUT', '/api/kampmomenten/' + kmId, { token: kantoor, body: { week: 98 } });
  check(r.status === 200, `PUT /api/kampmomenten/${kmId} (week 97 -> 98) -> ${r.status}`);
  const kmNaUpdate = (await leesDb('SELECT * FROM kampmomenten WHERE id=?', [kmId]))[0];
  r = await call('DELETE', '/api/kampmomenten/' + kmId, { token: kantoor });
  check(r.status === 200, `DELETE /api/kampmomenten/${kmId} -> ${r.status}`);
  const wk = await leesDb('SELECT * FROM wijzigingen WHERE tabel=? AND rij_id=? ORDER BY id', ['kampmomenten', kmId]);
  check(wk.length === 3, `3 regels in wijzigingen voor kampmomenten #${kmId} (kreeg ${wk.length})`);
  check(wk.map((w) => w.actie).join(',') === 'insert,update,delete', `acties = insert,update,delete (kreeg ${wk.map((w) => w.actie).join(',')})`);
  check(wk.every((w) => w.persoon_id === 10 && w.persoon_naam === kantoorNaam && w.context === 'api'), `persoon_id 10, persoon_naam "${kantoorNaam}", context api op alle 3`);
  check(wk[0] && wk[0].oud === null && gelijk(parse(wk[0].nieuw), kmNaInsert), 'insert: oud null, nieuw = exact de rij na aanmaken');
  check(wk[1] && gelijk(parse(wk[1].oud), kmNaInsert) && gelijk(parse(wk[1].nieuw), kmNaUpdate) && parse(wk[1].nieuw).week === 98, 'update: oud = rij voor wijziging, nieuw = rij na wijziging (week 98)');
  check(wk[2] && gelijk(parse(wk[2].oud), kmNaUpdate) && wk[2].nieuw === null, 'delete: oud = laatste rij, nieuw null');
  check(wk.every((w) => /^\d{4}-\d\d-\d\dT/.test(w.tijdstip)), 'tijdstip is ISO');

  // ── 2. Chauffeursroute: bak-status via rit-link ──
  r = await call('POST', '/api/vaste-bakken', { token: kantoor, body: { naam: 'F1-testbak wijzigingen', code: 'F1W', vast_type: 'f1test', thuislocatie_id: locatie } });
  check(r.status === 200 && r.json?.id, `POST /api/vaste-bakken -> ${r.status}`);
  const bakId = r.json?.id;
  const bakInsertLog = await leesDb('SELECT * FROM wijzigingen WHERE tabel=? AND rij_id=? AND actie=?', ['bakken', bakId, 'insert']);
  check(bakInsertLog.length === 1 && gelijk(parse(bakInsertLog[0].nieuw), r.json), 'bakken insert gelogd met nieuw = exact wat de API teruggaf');
  r = await call('POST', '/api/ritten', { token: kantoor, body: { datum: '2099-01-01', chauffeur: 'F1 chauffeur' } });
  check(r.status === 200 && r.json?.id, `POST /api/ritten -> ${r.status}`);
  const ritId = r.json?.id;
  check((await leesDb('SELECT * FROM wijzigingen WHERE tabel=? AND rij_id=? AND actie=?', ['transport_ritten', ritId, 'insert'])).length === 1, 'transport_ritten insert gelogd');
  r = await call('POST', '/api/transport-taken', { token: kantoor, body: { type: 'levering', datum: '2099-01-01', van_locatie_id: locatie, naar_locatie_id: locatie2, rit_id: ritId, regels: [{ naam: 'F1-testbak wijzigingen', qty: 1, soort: 'bak', bak_id: bakId }] } });
  check(r.status === 200 && r.json?.id, `POST /api/transport-taken -> ${r.status}`);
  const taakId = r.json?.id;
  check((await leesDb('SELECT * FROM wijzigingen WHERE tabel=? AND rij_id=? AND actie=?', ['transport_taken', taakId, 'insert'])).length === 1, 'transport_taken insert gelogd');
  r = await call('POST', `/api/ritten/${ritId}/checks/init`, { token: kantoor });
  check(r.status === 200 && r.json?.checks?.length >= 1, `checks/init -> ${r.status} (${r.json?.aangemaakt} checks)`);
  const checkId = (r.json?.checks || []).find((c) => c.bak_id === bakId)?.id;
  r = await call('POST', `/api/ritten/${ritId}/token`, { token: kantoor });
  check(r.status === 200 && r.json?.token, `rit-token -> ${r.status}`);
  const ritToken = r.json?.token;
  const bakVoor = (await leesDb('SELECT * FROM bakken WHERE id=?', [bakId]))[0];
  r = await call('POST', `/api/rit-token/${ritToken}/checks/${checkId}/laden`); // GEEN sessietoken: chauffeurslink
  check(r.status === 200, `POST /api/rit-token/:token/checks/:id/laden zonder sessie -> ${r.status}`);
  const bakNa = (await leesDb('SELECT * FROM bakken WHERE id=?', [bakId]))[0];
  check(bakNa?.status === 'onderweg', `bak staat op "onderweg" (kreeg ${bakNa?.status})`);
  const wb = await leesDb('SELECT * FROM wijzigingen WHERE tabel=? AND rij_id=? AND actie=? ORDER BY id DESC LIMIT 1', ['bakken', bakId, 'update']);
  check(wb.length === 1 && wb[0].context === 'rit-link' && wb[0].persoon_id === null && wb[0].persoon_naam === null, `bak-update via chauffeursroute: context rit-link, persoon_id null (kreeg ${wb[0]?.context}/${wb[0]?.persoon_id})`);
  check(wb[0] && gelijk(parse(wb[0].oud), bakVoor) && gelijk(parse(wb[0].nieuw), bakNa), 'bak-update: oud/nieuw exact de rij voor/na');

  // ── 3. KV-link: aanvraag ──
  r = await call('POST', '/api/personeel', { token: kantoor, body: { naam: 'F1 KV test', rol: 'kv' } });
  check(r.status === 200 && r.json?.id, `POST /api/personeel (kv) -> ${r.status}`);
  const kvId = r.json?.id;
  r = await call('POST', '/api/kampmomenten', { token: kantoor, body: { locatie_id: locatie, week: 96, type: 'kamp', kv_persoon_id: kvId } });
  const km2 = r.json?.id;
  r = await call('POST', `/api/kampmomenten/${km2}/kv-token`, { token: kantoor });
  check(r.status === 200 && r.json?.token, `kv-token -> ${r.status}`);
  const kvToken = r.json?.token;
  check((await leesDb('SELECT * FROM wijzigingen WHERE tabel=? AND rij_id=? AND actie=?', ['kampmomenten', km2, 'update'])).some((w) => parse(w.nieuw).kv_token === kvToken), 'kv-token-update op kampmomenten gelogd (nieuw bevat de token)');
  r = await call('POST', `/api/kv/${kvToken}/aanvraag`, { body: { tekst: 'F1 test-aanvraag via kv-link' } }); // geen sessietoken
  check(r.status === 200 && r.json?.id, `POST /api/kv/:token/aanvraag zonder sessie -> ${r.status}`);
  const aanvraagId = r.json?.id;
  const wa = await leesDb('SELECT * FROM wijzigingen WHERE tabel=? AND rij_id=?', ['aanvragen', aanvraagId]);
  check(wa.length === 1 && wa[0].actie === 'insert' && wa[0].context === 'kv-link' && wa[0].persoon_id === null, `aanvraag via kv-link: insert, context kv-link, persoon_id null (kreeg ${wa[0]?.context}/${wa[0]?.persoon_id})`);
  check(wa[0] && wa[0].oud === null && gelijk(parse(wa[0].nieuw), r.json), 'aanvraag: oud null, nieuw = exact wat de API teruggaf');
  // Kantoor behandelt de aanvraag -> update met persoon
  r = await call('PUT', `/api/aanvragen/${aanvraagId}/status`, { token: kantoor, body: { status: 'afgewezen', reden: 'test' } });
  check(r.status === 200, `PUT /api/aanvragen/:id/status -> ${r.status}`);
  const wa2 = await leesDb('SELECT * FROM wijzigingen WHERE tabel=? AND rij_id=? AND actie=?', ['aanvragen', aanvraagId, 'update']);
  check(wa2.length === 1 && wa2[0].persoon_id === 10 && parse(wa2[0].oud).status === 'nieuw' && parse(wa2[0].nieuw).status === 'afgewezen', 'aanvraag-status door kantoor: update gelogd met persoon 10, oud nieuw -> nieuw afgewezen');

  // ── 4. GET /api/wijzigingen ──
  r = await call('GET', '/api/wijzigingen?tabel=kampmomenten&rij_id=' + kmId, { token: kantoor });
  check(r.status === 200 && Array.isArray(r.json) && r.json.length === 3, `GET /api/wijzigingen?tabel=kampmomenten&rij_id=${kmId} -> ${r.status}, ${r.json?.length} regels`);
  check(r.json?.[0]?.actie === 'delete' && r.json?.[2]?.actie === 'insert', 'nieuwste eerst (delete, update, insert)');
  check(r.json?.[2]?.nieuw && typeof r.json[2].nieuw === 'object' && r.json[2].nieuw.id === kmId, 'oud/nieuw komen als objecten terug');
  r = await call('GET', '/api/wijzigingen?tabel=kampmomenten&limit=2', { token: kantoor });
  check(r.status === 200 && r.json?.length === 2 && r.json.every((w) => w.tabel === 'kampmomenten'), 'limit=2 en tabel-filter werken');
  r = await call('GET', '/api/wijzigingen', { token: kantoor });
  check(r.status === 200 && r.json?.length >= 8, `GET /api/wijzigingen zonder filter -> ${r.json?.length} regels (standaard max 100)`);
  // chauffeur-rol -> 403
  r = await call('POST', '/api/personeel', { token: kantoor, body: { naam: 'F1 chauffeur test', rol: 'chauffeur' } });
  const chId = r.json?.id;
  r = await call('POST', `/api/personeel/${chId}/pincode`, { token: kantoor, body: { pincode: '2222' } });
  check(r.status === 200, `pincode zetten voor chauffeur -> ${r.status}`);
  r = await call('POST', '/api/login', { body: { persoon_id: chId, pincode: '2222' } });
  check(r.status === 200 && r.json?.rol === 'chauffeur', `login als chauffeur -> ${r.status} (rol ${r.json?.rol})`);
  const chauffeur = r.json?.token;
  r = await call('GET', '/api/wijzigingen?tabel=kampmomenten', { token: chauffeur });
  check(r.status === 403, `GET /api/wijzigingen als chauffeur -> 403 (kreeg ${r.status})`);
  r = await fetch(BASE + '/api/wijzigingen'); // geen Basic
  check(r.status === 401, `zonder Basic-auth -> 401 (kreeg ${r.status})`);
  r = await call('GET', '/api/wijzigingen');
  check(r.status === 401, `zonder sessietoken -> 401 (kreeg ${r.status})`);

  const serverFouten = serverLog.split('\n').filter((l) => /API-fout|ReferenceError|TypeError|is not defined|Wijzigingslog fout|Flush mislukt/.test(l));
  check(serverFouten.length === 0, 'geen fouten in de serverlog' + (serverFouten.length ? ':\n' + serverFouten.slice(0, 8).join('\n') : ''));
} catch (e) { fout('onverwachte fout in testscript: ' + (e.stack || e)); } finally { stop(); }

console.log(`\n${oks} ok, ${fouten} FOUT`);
if (fouten === 0) { console.log('ALLES GROEN'); process.exit(0); }
console.log('NIET GROEN'); process.exit(1);
