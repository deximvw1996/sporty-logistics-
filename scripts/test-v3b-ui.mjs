// Test V3b (chat D): vraagModal i.p.v. prompt/confirm, annuleer-bug aanvragen, conflicten-tab op server-bron.
// Start een EIGEN server op poort 3340 met een wegwerp-db-kopie BUITEN de worktree. Raakt nooit 3001/prod.
// Gebruik: node scripts/test-v3b-ui.mjs   (vanuit D:\Sporty\sporty-d)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3340;
const TESTDIR = path.resolve(ROOT, '..', 'sporty-d-v3btest');
const APP_PASSWORD = 'v3btest';
const BASIC = 'Basic ' + Buffer.from('sporty:' + APP_PASSWORD).toString('base64');
const BASE = `http://localhost:${PORT}`;

let fouten = 0, oks = 0;
const ok = (m) => { oks++; console.log('ok    ' + m); };
const fout = (m) => { fouten++; console.log('FOUT  ' + m); };
const check = (c, m) => (c ? ok(m) : fout(m));

// ── Statisch: index.html ──
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const zonderComment = html.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
check(!/(^|[^\w.])prompt\(/.test(zonderComment), 'index.html bevat geen prompt( meer');
check(!/(^|[^\w.])confirm\(/.test(zonderComment), 'index.html bevat geen confirm( meer');
check(/function vraagModal\(/.test(html), 'vraagModal bestaat');
check(/async function bevestig\(/.test(html), 'bevestig-helper bestaat');
const bh = html.slice(html.indexOf('async function behandelAanvraag'), html.indexOf('function _vulTbWekFilter'));
check(bh.length > 200 && !/\|\|\s*''/.test(bh.replace(/reden=v\.reden/g, '')), "behandelAanvraag: geen ||'' op modal-resultaat");
check(/if\(v===null\)return;/.test(bh), 'behandelAanvraag: stopt bij annuleren (null)');
check(/spoedtransport=\{item:tekstA,qty:/.test(bh) && /datum:v\.datum/.test(bh), 'behandelAanvraag: spoedtransport-body bevat qty en datum');
const cc = html.slice(html.indexOf('async function checkConflicten'), html.indexOf('async function bevestigDubbelThema'));
check(/api\('GET','\/conflicten'\)/.test(cc), 'checkConflicten leest GET /api/conflicten');
check(!/\/sport'|\/gedeeld'|S\.kampmomenten\.forEach/.test(cc), 'checkConflicten rekent niet meer zelf in de browser');
check(/Geen conflicten in/.test(cc), "lege lijst noemt de periode");

// ── Server ──
fs.mkdirSync(path.join(TESTDIR, 'uploads'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'sporty.db'), path.join(TESTDIR, 'sporty.db'));
const srv = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
  cwd: ROOT, env: { ...process.env, PORT: String(PORT), APP_PASSWORD, DB_PATH: path.join(TESTDIR, 'sporty.db'), DATA_DIR: TESTDIR }, stdio: 'ignore'
});
const stop = () => { try { srv.kill(); } catch {} };
process.on('exit', stop);
let up = false;
for (let i = 0; i < 40 && !up; i++) {
  try { const r = await fetch(BASE + '/', { headers: { Authorization: BASIC } }); up = r.ok; } catch {}
  if (!up) await new Promise(r => setTimeout(r, 500));
}
check(up, 'testserver draait op ' + PORT);
if (up) {
  const l = await fetch(BASE + '/api/login', { method: 'POST', headers: { Authorization: BASIC, 'Content-Type': 'application/json' }, body: JSON.stringify({ persoon_id: 10, pincode: '1111' }) });
  const lj = await l.json().catch(() => ({}));
  const H = { Authorization: BASIC, 'x-auth-token': lj.token || '', 'Content-Type': 'application/json' };
  check(!!lj.token, 'login als API-gebruiker');
  const api = async (m, u, b) => { const r = await fetch(BASE + '/api' + u, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined }); return r.json().catch(() => ({})); };
  const served = await (await fetch(BASE + '/', { headers: { Authorization: BASIC } })).text(); // TF3: de oude app wordt niet meer geserveerd
  check(!served.includes('function vraagModal('), 'TF3: / serveert de oude app niet meer');
  // Aanvraag: status blijft nieuw tot er echt een PUT komt
  const a = await api('POST', '/aanvragen', { soort: 'materiaal', tekst: 'Test 5 ballen', persoon_id: 10 });
  const lijst = await api('GET', '/aanvragen?status=nieuw');
  check(Array.isArray(lijst) && lijst.some(x => x.id === a.id), 'aanvraag staat op nieuw (zonder PUT blijft dat zo)');
  const p = await api('GET', '/periodes');
  const periodeId = Array.isArray(p) && p[0] ? p[0].id : 1;
  const themas = await api('GET', '/themas');
  const locs = (await api('GET', '/locaties')).filter(x => x.type === 'kamp');
  const th = themas.find(t => !/themadag/i.test(t.name)) || themas[0];
  const k1 = await api('POST', '/kampmomenten', { locatie_id: locs[0].id, week: 2, periode_id: periodeId, type: 'kamp' });
  const k2 = await api('POST', '/kampmomenten', { locatie_id: locs[1].id, week: 2, periode_id: periodeId, type: 'kamp' });
  await api('POST', `/kampmomenten/${k1.id}/themas`, { thema_id: th.id });
  await api('POST', `/kampmomenten/${k2.id}/themas`, { thema_id: th.id });
  const cs = await api('GET', '/conflicten');
  check(Array.isArray(cs) && cs.some(c => c.type === 'dubbel_thema' && /week 2/.test(c.bericht)), 'GET /api/conflicten meldt dubbel_thema voor dit testgeval');
}
stop();
console.log(`\n${oks} ok, ${fouten} fout`);
console.log(fouten === 0 ? 'ALLES GROEN' : 'NIET GROEN');
process.exit(fouten ? 1 : 0);
