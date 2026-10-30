// Testscript F1 deel 1 — server.js opgedeeld in lib/ en routes/ (chat A).
// 1) Route-inventaris: alle app.get/post/put/delete in server.js + lib/ + routes/ moet exact de set
//    van scripts/testdata/route-inventaris-f1.json bevatten (220 routes van het oude server.js, 28/10).
// 2) Eigen server op poort 3311 met een wegwerp-db-kopie BUITEN de worktree (D:\Sporty\sporty-a-f1test),
//    login als "Claude (API)" (id 10, pincode 1111), en ELKE GET-route aanroepen: status < 500 verwacht.
// Gebruik: node scripts/test-f1-modules.mjs   (vanuit D:\Sporty\sporty-a)
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const initSqlJs = require('sql.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3311;
const TESTDIR = path.resolve(ROOT, '..', 'sporty-a-f1test');
const BRON_DB = path.join(ROOT, 'sporty.db');
const TEST_DB = path.join(TESTDIR, 'sporty.db');
const APP_PASSWORD = 'f1test';
const BASIC = 'Basic ' + Buffer.from('sporty:' + APP_PASSWORD).toString('base64');
const BASE = `http://localhost:${PORT}`;

let fouten = 0, oks = 0;
const ok = (m) => { oks++; console.log('ok    ' + m); };
const fout = (m) => { fouten++; console.log('FOUT  ' + m); };
const check = (cond, m) => (cond ? ok(m) : fout(m));

// ── 1. Route-inventaris ──
const ROUTE_RE = /^\s*app\.(get|post|put|delete)\(\s*(['"`])([^'"`]+)\2/gm;
function inventaris(tekst) {
  const s = new Set();
  for (const m of tekst.matchAll(ROUTE_RE)) s.add(m[1].toUpperCase() + ' ' + m[3]);
  return s;
}
const bronBestanden = ['server.js', ...fs.readdirSync(path.join(ROOT, 'lib')).map((f) => 'lib/' + f), ...fs.readdirSync(path.join(ROOT, 'routes')).map((f) => 'routes/' + f)];
const nieuw = new Set();
for (const f of bronBestanden) for (const r of inventaris(fs.readFileSync(path.join(ROOT, f), 'utf8'))) {
  if (nieuw.has(r)) fout(`route dubbel geregistreerd: ${r} (in ${f})`);
  nieuw.add(r);
}
// Ijkpunt: de route-inventaris van de F1-merge (28/10, 220 routes van het oude server.js), vastgelegd in
// scripts/testdata/route-inventaris-f1.json. Vóór die merge stond de baseline in origin/main:server.js; na de
// merge heeft main zelf nog maar 3 routes, dus de baseline is een bestand. Routes mogen erbij komen (latere
// prompts); ze mogen NIET verdwijnen zonder dat de baseline bewust wordt bijgewerkt.
const BASELINE = path.join(ROOT, 'scripts', 'testdata', 'route-inventaris-f1.json');
const oud = new Set(JSON.parse(fs.readFileSync(BASELINE, 'utf8')));
const ontbreekt = [...oud].filter((r) => !nieuw.has(r));
const extra = [...nieuw].filter((r) => !oud.has(r));
check(oud.size >= 219, `inventaris ijkpunt: ${oud.size} routes (verwacht >= 219: TF3 haalde de catch-all GET * eruit)`);
check(!ontbreekt.length,
  `inventaris nieuw: ${nieuw.size} routes, alle ${oud.size} routes van het ijkpunt aanwezig` + (ontbreekt.length ? ` — ONTBREEKT: ${ontbreekt.join(', ')}` : '') + (extra.length ? ` (nieuw sinds F1: ${extra.length}: ${extra.join(', ')})` : ''));
const wcServer = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8').split('\n').length;
check(wcServer < 300, `server.js is ${wcServer} regels (richtcijfer < 300)`);

// ── 2. Wegwerp-db klaarzetten ──
fs.mkdirSync(TESTDIR, { recursive: true });
fs.mkdirSync(path.join(TESTDIR, 'uploads'), { recursive: true });
fs.copyFileSync(BRON_DB, TEST_DB);

async function leesDb(sql) {
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(TEST_DB));
  let r = [];
  try { r = db.exec(sql); } catch (e) { r = []; }
  db.close();
  return r[0] ? r[0].values : [];
}
async function eersteId(sql) { const v = await leesDb(sql); return v[0]?.[0] ?? null; }

// ── 3. Server starten ──
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
  while (Date.now() - t0 < 20000) {
    try { const r = await fetch(BASE + '/api/login-status', { headers: { authorization: BASIC } }); if (r.ok) return true; } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}
async function call(method, p, { token, body } = {}) {
  const headers = { authorization: BASIC };
  if (token) headers['x-auth-token'] = token;
  let b;
  if (body !== undefined) { b = JSON.stringify(body); headers['content-type'] = 'application/json'; }
  const res = await fetch(BASE + p, { method, headers, body: b, redirect: 'manual' });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, text, json };
}

try {
  if (!(await wachtOpServer())) { fout('server op ' + PORT + ' kwam niet op binnen 20 s\n' + serverLog); process.exit(1); }
  ok('server op poort ' + PORT + ' met wegwerp-db ' + TEST_DB);

  let r = await call('POST', '/api/login', { body: { persoon_id: 10, pincode: '1111' } });
  check(r.status === 200 && r.json?.token, `login Claude (API) → 200 (kreeg ${r.status})`);
  const kantoor = r.json?.token;
  if (!kantoor) { console.log('NIET GROEN'); process.exit(1); }

  // ── 4. Padparameters invullen uit de wegwerp-db (eerste bestaande id; anders 1) ──
  const ids = {
    bak: await eersteId('SELECT id FROM bakken ORDER BY id LIMIT 1'),
    vasteBak: await eersteId("SELECT id FROM bakken WHERE soort='vast' ORDER BY id LIMIT 1"),
    bakFoto: await eersteId('SELECT id FROM bak_fotos ORDER BY id LIMIT 1'),
    locatie: await eersteId('SELECT id FROM locaties ORDER BY id LIMIT 1'),
    thema: await eersteId('SELECT id FROM themas ORDER BY id LIMIT 1'),
    rit: await eersteId('SELECT id FROM transport_ritten ORDER BY id LIMIT 1'),
    ritToken: await eersteId("SELECT rit_token FROM transport_ritten WHERE rit_token IS NOT NULL AND rit_token<>'' ORDER BY id LIMIT 1"),
    kvToken: await eersteId("SELECT kv_token FROM kampmomenten WHERE kv_token IS NOT NULL AND kv_token<>'' ORDER BY id LIMIT 1"),
    sport: await eersteId('SELECT id FROM sport_items ORDER BY id LIMIT 1'),
    itemType: await eersteId('SELECT id FROM item_types ORDER BY id LIMIT 1'),
  };
  const nietGevonden = Object.entries(ids).filter(([, v]) => v == null).map(([k]) => k);
  if (nietGevonden.length) console.log('      (geen id gevonden, gebruik 1/placeholder voor: ' + nietGevonden.join(', ') + ')');
  const v = (x) => (x == null ? 1 : x);
  const vulIn = (pad) => pad
    .replace('/api/bak-fotos/:id', `/api/bak-fotos/${v(ids.bakFoto)}`)
    .replace('/api/bakken/:id', `/api/bakken/${v(ids.bak)}`)
    .replace('/api/vaste-bakken/:id', `/api/vaste-bakken/${v(ids.vasteBak)}`)
    .replace('/api/catalogus-item/:type/:id', `/api/catalogus-item/sport/${v(ids.sport)}`)
    .replace('/api/kleurenborden-stock/:locatie_id', `/api/kleurenborden-stock/${v(ids.locatie)}`)
    .replace('/api/locatie-config/:locatie_id', `/api/locatie-config/${v(ids.locatie)}`)
    .replace('/api/locaties/:id', `/api/locaties/${v(ids.locatie)}`)
    .replace('/api/themas/:id', `/api/themas/${v(ids.thema)}`)
    .replace('/api/ritten/:id', `/api/ritten/${v(ids.rit)}`)
    .replace('/api/taken/:id', '/api/taken/999999') // TR1: taak-detail (onbekende taak → 404, geen 500)
    .replace('/api/personeel/:id/detail', '/api/personeel/10/detail') // BH1
    .replace('/api/logboek/wijziging/:id', '/api/logboek/wijziging/999999') // BH1: onbekend → 404
    .replace('/api/nakijken/sessie/:id', '/api/nakijken/sessie/1') // VC1: onbekende sessie → 404 (geen 5xx)
    .replace('/api/catalogus/:id/detail', '/api/catalogus/1/detail') // MA2
    .replace('/api/voertuigen/:id/detail', '/api/voertuigen/1/detail') // VT1
    .replace('/api/sportrooster/soort/:soort', '/api/sportrooster/soort/Kinball') // PL3
    .replace('/api/pool/:soort/:id/detail', '/api/pool/vast/1/detail') // MA2
    .replace('/api/kampmomenten/:id/detail', '/api/kampmomenten/1/detail') // PL1: onbekend kampmoment → 404 (geen 5xx)
    .replace('/api/personeel/week/:week', '/api/personeel/week/1')
    .replace('/api/tekorten/:artikel_id/detail', '/api/tekorten/999999/detail') // TB2: onbekend artikel → 404 (geen 5xx)
    .replace('/api/backups/:naam', '/api/backups/sporty-2000-01-01.db').replace('/api/instellingen/:groep', '/api/instellingen/onbekend') // BH2: onbekend → 404 (geen 5xx)
    .replace('/api/periodes/:id/detail', '/api/periodes/999999/detail').replace('/api/rooster/kampmoment/:id', '/api/rooster/kampmoment/999999').replace('/api/rooster/thema/:id', '/api/rooster/thema/999999') // PL2: onbekend → 404 (geen 5xx)
    .replace('/api/kv/:token', `/api/kv/${ids.kvToken || 'geen-token'}`)
    .replace('/kv/:token', `/kv/${ids.kvToken || 'geen-token'}`)
    .replace('/tel/:token', '/tel/geen-token') // KV1: monitor-pagina (404 bij onbekend token)
    .replace('/api/rit-token/:token', `/api/rit-token/${ids.ritToken || 'geen-token'}`) // CH1: rit-data-JSON
    .replace('/rit/:token', `/rit/${ids.ritToken || 'geen-token'}`);

  // ── 5. Elke GET-route aanroepen ──
  const gets = [...nieuw].filter((r) => r.startsWith('GET ')).map((r) => r.slice(4)).filter((p) => p !== '*');
  let geteld = 0;
  for (const pad of gets) {
    const url = vulIn(pad);
    if (/:\w+/.test(url)) { fout(`GET ${pad}: padparameter niet ingevuld (${url})`); continue; }
    let st;
    try { st = (await call('GET', url, { token: kantoor })).status; } catch (e) { st = 'EXC ' + e.message; }
    geteld++;
    check(typeof st === 'number' && st < 500, `GET ${pad}${url !== pad ? ' → ' + url : ''} → ${st}`);
  }
  // catch-all '*' (index.html)
  r = await call('GET', '/', { token: kantoor });
  check(r.status === 200 && /<html/i.test(r.text), `GET / → ${r.status}, levert de doorstuurpagina (TF3: oude app weg)`);
  ok(`${geteld} GET-routes aangeroepen`);

  // ── 6. Volgorde middleware: zonder token → 401 op /api, publiek blijft publiek, Basic-muur eerst ──
  r = await call('GET', '/api/locaties');
  check(r.status === 401, `zonder sessietoken: /api/locaties → 401 (kreeg ${r.status})`);
  r = await fetch(BASE + '/api/login-status'); // geen Basic
  check(r.status === 401, `zonder Basic-auth: /api/login-status → 401 (kreeg ${r.status})`);
  r = await call('GET', '/api/login-status');
  check(r.status === 200, `publiek pad met Basic, zonder token: /api/login-status → 200 (kreeg ${r.status})`);
  r = await call('POST', '/api/logout', { token: kantoor });
  check(r.status === 200, `logout → 200 (kreeg ${r.status})`);
  r = await call('GET', '/api/locaties', { token: kantoor });
  check(r.status === 401, `na logout: /api/locaties → 401 (kreeg ${r.status})`);

  const serverFouten = serverLog.split('\n').filter((l) => /API-fout|ReferenceError|TypeError|is not defined/.test(l));
  check(serverFouten.length === 0, `geen ReferenceError/TypeError/API-fout in de serverlog` + (serverFouten.length ? ':\n' + serverFouten.slice(0, 10).join('\n') : ''));
} catch (e) {
  fout('onverwachte fout in testscript: ' + (e.stack || e));
} finally {
  stop();
}

console.log(`\n${oks} ok, ${fouten} FOUT`);
if (fouten === 0) { console.log('ALLES GROEN'); process.exit(0); }
console.log('NIET GROEN'); process.exit(1);
