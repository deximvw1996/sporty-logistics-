// Testscript F1 deel 2 — atomaire schrijving + schrijf-batching (chat A).
// Eigen server op poort 3312 met wegwerp-db-kopie in D:\Sporty\sporty-a-f1test-schrijven (BUITEN de worktree).
// 1) 50 schrijvende API-calls (locatie aanmaken/wijzigen/verwijderen) terwijl sporty.db elke 100 ms
//    op mtime+size gepold wordt: aantal wijzigingen op schijf moet > 0 en <= 50 zijn (batching per request).
// 2) Harde kill + herstart: laatste wijziging staat op schijf (per-request-flush); geen sporty.db.tmp.
// 3) SIGTERM: op Windows is child.kill('SIGTERM') een harde TerminateProcess ZONDER handler. Daarom draait
//    de server met SPORTY_TESTHOOK=1, die POST /api/_test/sigterm registreert -> process.emit('SIGTERM')
//    -> de echte handler (flush + exit 0). Bewijs: logregel, exitcode 0, wijziging op schijf, geen .tmp,
//    en zonder de env is de testroute niet actief.
// Gebruik: node scripts/test-f1-schrijven.mjs   (vanuit D:\Sporty\sporty-a)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const initSqlJs = require('sql.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3312;
const TESTDIR = path.resolve(ROOT, '..', 'sporty-a-f1test-schrijven');
const BRON_DB = 'D:\\Sporty\\sporty-railway\\sporty.db';
const TEST_DB = path.join(TESTDIR, 'sporty.db');
const TMP = TEST_DB + '.tmp';
const APP_PASSWORD = 'f1test';
const BASIC = 'Basic ' + Buffer.from('sporty:' + APP_PASSWORD).toString('base64');
const BASE = `http://localhost:${PORT}`;
let fouten = 0, oks = 0;
const ok = (m) => { oks++; console.log('ok    ' + m); };
const fout = (m) => { fouten++; console.log('FOUT  ' + m); };
const check = (c, m) => (c ? ok(m) : fout(m));
const slaap = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(TESTDIR, { recursive: true });
fs.copyFileSync(BRON_DB, TEST_DB);
try { fs.unlinkSync(TMP); } catch {}

let server = null, serverLog = '', exitCode = null;
function start(extraEnv = {}) {
  serverLog = ''; exitCode = null;
  server = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DATA_DIR: TESTDIR, APP_PASSWORD, SPORTY_TESTHOOK: '', ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', (d) => (serverLog += d));
  server.stderr.on('data', (d) => (serverLog += d));
  server.on('exit', (c) => (exitCode = c));
}
const stop = () => { try { server && server.kill(); } catch {} };
process.on('exit', stop);
async function wachtOpServer() {
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) {
    try { const r = await fetch(BASE + '/api/login-status', { headers: { authorization: BASIC } }); if (r.ok) return true; } catch {}
    await slaap(200);
  }
  return false;
}
async function wachtOpExit() { const t0 = Date.now(); while (exitCode === null && Date.now() - t0 < 10000) await slaap(100); return exitCode; }
async function call(method, p, { token, body } = {}) {
  const headers = { authorization: BASIC };
  if (token) headers['x-auth-token'] = token;
  let b; if (body !== undefined) { b = JSON.stringify(body); headers['content-type'] = 'application/json'; }
  const res = await fetch(BASE + p, { method, headers, body: b });
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}
async function login() { const r = await call('POST', '/api/login', { body: { persoon_id: 10, pincode: '1111' } }); check(r.status === 200 && r.json?.token, `login Claude (API) -> ${r.status}`); return r.json?.token; }
async function leesDb(sql, p = []) {
  const SQL = await initSqlJs(); const db = new SQL.Database(fs.readFileSync(TEST_DB));
  const s = db.prepare(sql); s.bind(p); const r = []; while (s.step()) r.push(s.getAsObject()); s.free(); db.close(); return r;
}
function handtekening() { try { const st = fs.statSync(TEST_DB); return st.mtimeMs + ':' + st.size; } catch { return 'geen'; } }

try {
  start({ SPORTY_TESTHOOK: '1' });
  if (!(await wachtOpServer())) { fout('server kwam niet op\n' + serverLog); process.exit(1); }
  ok('server op poort ' + PORT + ' met wegwerp-db ' + TEST_DB);
  let token = await login();

  // 1. 50 schrijvende calls + schijf-poller
  let vorige = handtekening(), wijzigingen = 0, tmpGezien = false, stopPoll = false;
  const poller = (async () => { while (!stopPoll) { const h = handtekening(); if (h !== vorige) { wijzigingen++; vorige = h; } if (fs.existsSync(TMP)) tmpGezien = true; await slaap(100); } })();
  const r0 = await call('GET', '/api/_test/schrijfacties', { token });
  const schrijf0 = r0.json?.schrijfacties ?? 0;
  const ids = [];
  let calls = 0;
  for (let i = 0; i < 20; i++) { const r = await call('POST', '/api/locaties', { token, body: { name: 'F1-schrijftest ' + i, addr: 'Teststraat ' + i } }); calls++; if (r.status === 200 && r.json?.id) ids.push(r.json.id); else fout(`POST /api/locaties #${i} -> ${r.status}`); }
  for (let i = 0; i < 20; i++) { const r = await call('PUT', '/api/locaties/' + ids[i], { token, body: { name: 'F1-schrijftest ' + i + ' gewijzigd', addr: 'Teststraat ' + i } }); calls++; if (r.status !== 200) fout(`PUT /api/locaties/${ids[i]} -> ${r.status}`); }
  for (let i = 0; i < 10; i++) { const r = await call('DELETE', '/api/locaties/' + ids[i], { token }); calls++; if (r.status !== 200) fout(`DELETE /api/locaties/${ids[i]} -> ${r.status}`); }
  check(calls === 50 && ids.length === 20, '50 schrijvende API-calls gedaan (20 aanmaken, 20 wijzigen, 10 verwijderen)');
  await slaap(300); stopPoll = true; await poller;
  const r1 = await call('GET', '/api/_test/schrijfacties', { token });
  const schrijfServer = (r1.json?.schrijfacties ?? 0) - schrijf0;
  check(wijzigingen > 0 && wijzigingen <= 50, `sporty.db op schijf ${wijzigingen}x gewijzigd volgens poller (verwacht > 0 en <= 50)`);
  check(schrijfServer > 0 && schrijfServer <= 50, `server telde ${schrijfServer} flush-schrijfacties voor 50 calls (verwacht > 0 en <= 50)`);
  check(r1.json?.vuil === false, 'na afloop is de db niet meer vuil (alles geflusht)');
  check(!fs.existsSync(TMP), 'geen sporty.db.tmp achtergebleven na de 50 calls' + (tmpGezien ? ' (tmp wel kortstondig gezien tijdens schrijven - ok)' : ''));

  // 2. Harde kill + herstart
  const laatste = ids[19];
  const schijfVoorKill = await leesDb('SELECT name FROM locaties WHERE id=?', [laatste]);
  check(schijfVoorKill[0]?.name === 'F1-schrijftest 19 gewijzigd', `voor harde kill staat de laatste wijziging al op schijf ("${schijfVoorKill[0]?.name}")`);
  check((await leesDb('SELECT count(*) n FROM locaties WHERE id=?', [ids[0]]))[0].n === 0, 'voor harde kill is de verwijderde locatie ook op schijf weg');
  server.kill(); await wachtOpExit();
  ok(`harde kill (child.kill -> TerminateProcess op Windows, exitcode ${exitCode}) gedaan`);
  start({ SPORTY_TESTHOOK: '1' });
  if (!(await wachtOpServer())) { fout('server kwam niet opnieuw op\n' + serverLog); process.exit(1); }
  token = await login();
  let r = await call('GET', '/api/locaties', { token });
  const teruggelezen = (r.json || []).find((l) => l.id === laatste);
  check(teruggelezen?.name === 'F1-schrijftest 19 gewijzigd', `na herstart leest de API de laatste wijziging terug ("${teruggelezen?.name}")`);

  // 3. SIGTERM-handler via testhaak
  r = await call('PUT', '/api/locaties/' + laatste, { token, body: { name: 'F1-schrijftest voor SIGTERM', addr: 'x' } });
  check(r.status === 200, 'wijziging vlak voor SIGTERM -> 200');
  r = await call('POST', '/api/_test/sigterm', { token });
  check(r.status === 200 && r.json?.ok, 'POST /api/_test/sigterm -> 200 (testhaak alleen met SPORTY_TESTHOOK=1)');
  const code = await wachtOpExit();
  check(code === 0, `server stopte via SIGTERM-handler met exitcode 0 (kreeg ${code})`);
  check(/SIGTERM ontvangen/.test(serverLog), 'serverlog bevat "SIGTERM ontvangen - database wegschrijven en stoppen"');
  check(!fs.existsSync(TMP), 'geen sporty.db.tmp na SIGTERM');
  const naSigterm = await leesDb('SELECT name FROM locaties WHERE id=?', [laatste]);
  check(naSigterm[0]?.name === 'F1-schrijftest voor SIGTERM', `na SIGTERM staat de wijziging op schijf ("${naSigterm[0]?.name}")`);
  start();
  if (!(await wachtOpServer())) { fout('server kwam niet op (3e start)\n' + serverLog); process.exit(1); }
  token = await login();
  r = await call('POST', '/api/_test/sigterm', { token });
  check(r.status !== 200 || !r.json?.ok, `zonder SPORTY_TESTHOOK is /api/_test/sigterm niet actief (status ${r.status})`);
  r = await call('GET', '/api/locaties', { token });
  check((r.json || []).find((l) => l.id === laatste)?.name === 'F1-schrijftest voor SIGTERM', 'na herstart (zonder testhaak) leest de API de SIGTERM-wijziging terug');
  const serverFouten = serverLog.split('\n').filter((l) => /API-fout|ReferenceError|TypeError|is not defined|Flush mislukt/.test(l));
  check(serverFouten.length === 0, 'geen fouten in de serverlog' + (serverFouten.length ? ':\n' + serverFouten.slice(0, 5).join('\n') : ''));
} catch (e) { fout('onverwachte fout in testscript: ' + (e.stack || e)); } finally { stop(); }

console.log(`\n${oks} ok, ${fouten} FOUT`);
if (fouten === 0) { console.log('ALLES GROEN'); process.exit(0); }
console.log('NIET GROEN'); process.exit(1);
