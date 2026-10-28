// Testscript veiligheidsronde (DOORLICHTING-c #1-#6) — chat A.
// Start een EIGEN server op poort 3310 met een wegwerp-db-kopie BUITEN de worktree
// (D:\Sporty\sporty-a-veiligheidstest). Raakt nooit de echte sporty.db, nooit 3001/prod.
// Gebruik: node scripts/test-veiligheid.mjs   (vanuit D:\Sporty\sporty-a)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const initSqlJs = require('sql.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3310;
const TESTDIR = path.resolve(ROOT, '..', 'sporty-a-veiligheidstest');
const BRON_DB = path.join(ROOT, 'sporty.db');
const TEST_DB = path.join(TESTDIR, 'sporty.db');
const UPLOADS = path.join(TESTDIR, 'uploads');
const APP_PASSWORD = 'veiligheidstest';
const BASIC = 'Basic ' + Buffer.from('sporty:' + APP_PASSWORD).toString('base64');
const BASE = `http://localhost:${PORT}`;

let fouten = 0, oks = 0;
const ok = (m) => { oks++; console.log('ok    ' + m); };
const fout = (m) => { fouten++; console.log('FOUT  ' + m); };
const check = (cond, m) => (cond ? ok(m) : fout(m));

// ── Wegwerp-db klaarzetten ──
fs.mkdirSync(TESTDIR, { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });
fs.copyFileSync(BRON_DB, TEST_DB);
for (const f of fs.readdirSync(TESTDIR)) if (/^bewijs/.test(f)) fs.unlinkSync(path.join(TESTDIR, f));

async function leesDb(sql) {
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(TEST_DB));
  const r = db.exec(sql);
  db.close();
  return r[0] ? r[0].values : [];
}

const API_ID = 10; // "Claude (API)", pincode 1111
const pinVoor = (await leesDb(`SELECT pincode FROM personeel WHERE id=${API_ID}`))[0]?.[0] || '';
check(/^[0-9a-f]{64}$/i.test(pinVoor), `uitgangspunt: Claude (API) heeft nog een kale SHA-256-pincode in de wegwerp-db (${pinVoor.slice(0, 12)}…)`);
const sportId = (await leesDb('SELECT id FROM sport_items ORDER BY id LIMIT 1'))[0]?.[0];
check(!!sportId, `uitgangspunt: er is een sport_item (id ${sportId})`);

// ── Server starten ──
const server = spawn(process.execPath, ['server.js'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), DATA_DIR: TESTDIR, APP_PASSWORD },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));
const stop = () => { try { server.kill(); } catch {} };
process.on('exit', stop);

async function wachtOpServer() {
  const t0 = Date.now();
  while (Date.now() - t0 < 15000) {
    try { const r = await fetch(BASE + '/api/login-status', { headers: { authorization: BASIC } }); if (r.ok) return true; } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function call(method, p, { token, body, basic = true, raw } = {}) {
  const headers = {};
  if (basic) headers.authorization = BASIC;
  if (token) headers['x-auth-token'] = token;
  let b;
  if (raw) { b = raw; headers['content-type'] = 'application/octet-stream'; }
  else if (body !== undefined) { b = JSON.stringify(body); headers['content-type'] = 'application/json'; }
  const res = await fetch(BASE + p, { method, headers, body: b });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, headers: res.headers, text, json };
}

try {
  if (!(await wachtOpServer())) { fout('server op ' + PORT + ' kwam niet op binnen 15 s\n' + serverLog); process.exit(1); }
  ok('server op poort ' + PORT + ' met wegwerp-db ' + TEST_DB);
  check(serverLog.includes('Migratie 56:'), 'Migratie 56 draaide bij start (labelt SHA-256-pincodes)');

  // ── 4. /uploads achter de Basic-auth-muur + nosniff ──
  fs.writeFileSync(path.join(UPLOADS, 'test-nosniff.txt'), '<script>alert(1)</script>');
  let r = await call('GET', '/uploads/test-nosniff.txt', { basic: false });
  check(r.status === 401, `/uploads zonder Basic auth → 401 (kreeg ${r.status})`);
  r = await call('GET', '/uploads/test-nosniff.txt');
  check(r.status === 200, `/uploads mét Basic auth → 200 (kreeg ${r.status})`);
  check(r.headers.get('x-content-type-options') === 'nosniff', `/uploads geeft X-Content-Type-Options: nosniff (kreeg ${r.headers.get('x-content-type-options')})`);

  // ── 6b. bestaande SHA-256-pin logt in en wordt scrypt ──
  r = await call('POST', '/api/login', { body: { persoon_id: API_ID, pincode: '1111' } });
  check(r.status === 200 && r.json?.token, `login Claude (API) met SHA-256-pin 1111 → 200 (kreeg ${r.status})`);
  const kantoor = r.json?.token;
  const pinNa = (await leesDb(`SELECT pincode FROM personeel WHERE id=${API_ID}`))[0]?.[0] || '';
  check(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{64}$/.test(pinNa), `na login staat de pincode als scrypt in de db (${pinNa.slice(0, 14)}…)`);
  r = await call('POST', '/api/login', { body: { persoon_id: API_ID, pincode: '1111' } });
  check(r.status === 200, `tweede login tegen de scrypt-hash → 200 (kreeg ${r.status})`);
  r = await call('POST', '/api/login', { body: { persoon_id: API_ID, pincode: '9999' } });
  check(r.status === 401, `foute pincode tegen scrypt-hash → 401 (kreeg ${r.status})`);
  const vlag = (await leesDb("SELECT waarde FROM app_vlaggen WHERE naam='migratie56_klaar'"))[0]?.[0];
  check(vlag === '1', 'vlag migratie56_klaar staat op 1');
  // andere, nog niet ingelogde persoon blijft gelabeld sha256$ (geen dataverlies)
  const pinStijn = (await leesDb('SELECT pincode FROM personeel WHERE id=4'))[0]?.[0] || '';
  check(pinStijn.startsWith('sha256$'), `niet-ingelogde persoon (Stijn) behoudt zijn hash als sha256$… (${pinStijn.slice(0, 14)}…)`);

  // ── 6c. loginlijst toont geen kv ──
  r = await call('GET', '/api/personeel-lijst-login');
  check(r.status === 200 && Array.isArray(r.json) && r.json.length > 0 && r.json.every((p) => p.rol === 'kantoor' || p.rol === 'chauffeur'),
    `personeel-lijst-login bevat alleen kantoor/chauffeur (rollen: ${[...new Set((r.json || []).map((p) => p.rol))].join(',')})`);

  // ── 1. sport-foto-upload ──
  const pngKlein = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').toString('base64');
  r = await call('POST', `/api/sport/${sportId}/foto`, { token: kantoor, body: { data: pngKlein, ext: 'html' } });
  check(r.status === 400, `foto met ext html → 400 (kreeg ${r.status}: ${r.json?.error})`);
  r = await call('POST', `/api/sport/${sportId}/foto`, { token: kantoor, body: { data: Buffer.from('BEWIJS-A').toString('base64'), ext: 'x/../../bewijs-traversal.txt' } });
  check(r.status === 400, `foto met traversal-ext → 400 (kreeg ${r.status})`);
  check(!fs.existsSync(path.join(TESTDIR, 'bewijs-traversal.txt')) && !fs.existsSync(path.join(ROOT, 'bewijs-traversal.txt')),
    'geen bestand buiten de uploads-map geschreven (traversal onmogelijk)');
  r = await call('POST', `/api/sport/${sportId}/foto`, { token: kantoor, body: { data: pngKlein, ext: 'PNG' } });
  check(r.status === 200 && /^sport-\d+-\d+\.png$/.test(r.json?.foto_path || ''), `geldige png → 200 met server-side naam (${r.json?.foto_path})`);
  check(r.json?.foto_path && fs.existsSync(path.join(UPLOADS, r.json.foto_path)), 'png staat in de uploads-map');
  const groot = Buffer.alloc(2 * 1024 * 1024 + 1, 1).toString('base64');
  r = await call('POST', `/api/sport/${sportId}/foto`, { token: kantoor, body: { data: groot, ext: 'jpg' } });
  check(r.status === 400, `foto > 2 MB → 400 (kreeg ${r.status}: ${r.json?.error})`);
  r = await call('POST', `/api/sport/${sportId}/foto`, { token: kantoor, body: { data: '', ext: 'jpg' } });
  check(r.status === 400, `lege data → 400 (kreeg ${r.status})`);

  // ── 2. rolcontrole ──
  r = await call('POST', '/api/personeel', { token: kantoor, body: { naam: 'TEST-KV-veiligheid', rol: 'kv' } });
  check(r.status === 200 && r.json?.id, `kantoor maakt kv-testpersoon aan → 200 (id ${r.json?.id})`);
  check(r.json && !('pincode' in r.json) && 'heeft_pincode' in r.json, 'POST /api/personeel geeft geen pincode-veld terug (wel heeft_pincode)');
  const kvId = r.json.id;
  r = await call('POST', `/api/personeel/${kvId}/pincode`, { token: kantoor, body: { pincode: '2222' } });
  check(r.status === 200, `kantoor zet pincode van kv-testpersoon → 200 (kreeg ${r.status})`);
  r = await call('PUT', `/api/personeel/${kvId}`, { token: kantoor, body: { naam: 'TEST-KV-veiligheid', rol: 'kv' } });
  check(r.status === 200 && !('pincode' in (r.json || {})), 'PUT /api/personeel geeft geen pincode-veld terug');
  r = await call('POST', '/api/login', { body: { persoon_id: kvId, pincode: '2222' } });
  check(r.status === 200 && r.json?.rol === 'kv', `login kv-testpersoon → 200 rol kv (kreeg ${r.status})`);
  const kv = r.json?.token;
  r = await call('GET', '/api/backup-db', { token: kv });
  check(r.status === 403, `kv op /api/backup-db → 403 (kreeg ${r.status})`);
  r = await call('GET', '/api/export', { token: kv });
  check(r.status === 403, `kv op /api/export → 403 (kreeg ${r.status})`);
  r = await call('POST', '/api/personeel/4/pincode', { token: kv, body: { pincode: '0000' } });
  check(r.status === 403, `kv zet pincode van ander (Stijn) → 403 (kreeg ${r.status})`);
  r = await call('POST', '/api/herstel-db', { token: kv, raw: Buffer.from('SQLite format 3\0' + 'x'.repeat(200)) });
  check(r.status === 403, `kv op /api/herstel-db → 403 (kreeg ${r.status})`);
  r = await call('POST', '/api/import/reset', { token: kv, body: {} });
  check(r.status === 403, `kv op /api/import/reset → 403 (kreeg ${r.status})`);
  r = await call('GET', '/api/dbinfo', { token: kv });
  check(r.status === 403, `kv op /api/dbinfo → 403 (kreeg ${r.status})`);
  r = await call('GET', '/api/locaties', { token: kv });
  check(r.status === 403, `kv op gewone admin-route /api/locaties → 403 (kreeg ${r.status})`);
  r = await call('GET', '/api/wie-ben-ik', { token: kv });
  check(r.status === 200 && r.json?.rol === 'kv', `kv op /api/wie-ben-ik → 200 (kreeg ${r.status})`);
  const pinStijnNa = (await leesDb('SELECT pincode FROM personeel WHERE id=4'))[0]?.[0] || '';
  check(pinStijnNa === pinStijn, 'pincode van Stijn is ongewijzigd gebleven');

  // chauffeur: lezen ok, beheer 403, eigen pincode ok
  r = await call('POST', '/api/personeel', { token: kantoor, body: { naam: 'TEST-CHAUFFEUR-veiligheid', rol: 'chauffeur' } });
  const chId = r.json?.id;
  await call('POST', `/api/personeel/${chId}/pincode`, { token: kantoor, body: { pincode: '3333' } });
  r = await call('POST', '/api/login', { body: { persoon_id: chId, pincode: '3333' } });
  check(r.status === 200 && r.json?.rol === 'chauffeur', `login chauffeur-testpersoon → 200 (kreeg ${r.status})`);
  const ch = r.json?.token;
  r = await call('GET', '/api/locaties', { token: ch });
  check(r.status === 200, `chauffeur leest /api/locaties → 200 (kreeg ${r.status})`);
  r = await call('GET', '/api/backup-db', { token: ch });
  check(r.status === 403, `chauffeur op /api/backup-db → 403 (kreeg ${r.status})`);
  r = await call('POST', '/api/personeel', { token: ch, body: { naam: 'X', rol: 'kantoor' } });
  check(r.status === 403, `chauffeur POST /api/personeel → 403 (kreeg ${r.status})`);
  r = await call('DELETE', `/api/personeel/${kvId}`, { token: ch });
  check(r.status === 403, `chauffeur DELETE /api/personeel → 403 (kreeg ${r.status})`);
  r = await call('POST', '/api/personeel/4/pincode', { token: ch, body: { pincode: '0000' } });
  check(r.status === 403, `chauffeur zet pincode van ander → 403 (kreeg ${r.status})`);
  r = await call('POST', `/api/personeel/${chId}/pincode`, { token: ch, body: { pincode: '3334' } });
  check(r.status === 200, `chauffeur zet eigen pincode → 200 (kreeg ${r.status})`);
  r = await call('POST', '/api/login', { body: { persoon_id: chId, pincode: '3334' } });
  check(r.status === 200, `chauffeur logt in met nieuwe eigen pincode → 200 (kreeg ${r.status})`);

  // kantoor mag alles
  r = await call('GET', '/api/backup-db', { token: kantoor });
  check(r.status === 200 && r.text.startsWith('SQLite format 3'), `kantoor op /api/backup-db → 200 sqlite (kreeg ${r.status})`);
  r = await call('GET', '/api/dbinfo', { token: kantoor });
  check(r.status === 200, `kantoor op /api/dbinfo → 200 (kreeg ${r.status})`);

  // ── 3. export zonder sessies en zonder pincode ──
  r = await call('GET', '/api/export', { token: kantoor });
  check(r.status === 200 && r.json, `kantoor op /api/export → 200 (kreeg ${r.status})`);
  check(r.json && !('sessies' in r.json), 'export bevat geen tabel sessies');
  check(r.json && Array.isArray(r.json.personeel) && r.json.personeel.length > 0 && r.json.personeel.every((p) => !('pincode' in p)),
    `export: geen pincode in ${r.json?.personeel?.length} personeel-rijen`);
  check(r.json && Array.isArray(r.json.app_vlaggen) && Array.isArray(r.json.locaties), 'export bevat nog wel de gewone tabellen (app_vlaggen, locaties)');

  // ── 5. tabelnaam whitelist in import/tabel ──
  r = await call('POST', '/api/import/tabel', { token: kantoor, body: { table: 'app_vlaggen); CREATE TABLE pwned_a(x); --', rows: [{ naam: 'x' }] } });
  check(r.status === 400, `import/tabel met injectie-tabelnaam → 400 (kreeg ${r.status}: ${r.json?.error})`);
  const pwned = await leesDb("SELECT name FROM sqlite_master WHERE name='pwned_a'");
  check(pwned.length === 0, 'tabel pwned_a bestaat NIET in de db');
  r = await call('POST', '/api/import/tabel', { token: kantoor, body: { table: 'bestaat_niet', rows: [{ a: 1 }] } });
  check(r.status === 400, `import/tabel met onbekende tabelnaam → 400 (kreeg ${r.status})`);
  r = await call('POST', '/api/import/tabel', { token: kantoor, body: { table: 'app_vlaggen', rows: [] } });
  check(r.status === 200 && r.json?.count === 0, `import/tabel met geldige tabelnaam en 0 rijen → 200 (kreeg ${r.status})`);
  r = await call('POST', '/api/import/tabel', { token: kantoor, body: { table: 'app_vlaggen', rows: [{ naam: 'test_veiligheid_vlag', waarde: '1' }] } });
  check(r.status === 200 && r.json?.count === 1, `import/tabel met geldige tabelnaam en 1 rij → 200 count 1 (kreeg ${r.status})`);

  // ── 6a. rate-limit: 6e foute login binnen 5 min → 429 ──
  const statussen = [];
  for (let i = 0; i < 6; i++) {
    r = await call('POST', '/api/login', { body: { persoon_id: 4, pincode: '0000' } });
    statussen.push(r.status);
  }
  check(statussen.slice(0, 5).every((s) => s === 401) && statussen[5] === 429, `5× foute login Stijn → 401, 6e → 429 (kreeg ${statussen.join(',')})`);
  check(r.headers.get('retry-after') && r.json?.wacht_seconden > 0, `429 geeft Retry-After (${r.headers.get('retry-after')} s) en wacht_seconden`);
  r = await call('POST', '/api/login', { body: { persoon_id: API_ID, pincode: '1111' } });
  check(r.status === 200, `blokkade is per persoon: Claude (API) logt nog gewoon in → 200 (kreeg ${r.status})`);

  // ── Opruimen testpersonen (wegwerp-db, maar netjes) ──
  r = await call('DELETE', `/api/personeel/${kvId}`, { token: kantoor });
  check(r.status === 200, 'kantoor verwijdert kv-testpersoon → 200');
  await call('DELETE', `/api/personeel/${chId}`, { token: kantoor });
} catch (e) {
  fout('onverwachte fout: ' + (e.stack || e));
} finally {
  stop();
}

console.log(`\n${oks} ok, ${fouten} fout`);
if (fouten === 0) { console.log('ALLES GROEN'); process.exit(0); }
console.log('NIET GROEN'); process.exit(1);
