// _testhulp.mjs — gedeelde testbibliotheek (V1, chat B). Patroon van test-veiligheid.mjs:
// eigen server op een eigen poort, wegwerp-db BUITEN de worktree, ok/FOUT-regels, ALLES GROEN.
// Gebruik in een testscript:
//   import * as T from './_testhulp.mjs';
//   const srv = await T.startServer({ poort: 3321 });          // dbBron default: scripts/testdata/herfst-test.db
//   const tok = await T.login(srv.base, 10, '1111');
//   const r = await T.api(srv.base, tok, 'GET', '/api/periodes');
//   T.check(r.status === 200, 'periodes 200');
//   await T.einde(srv);                                         // ALLES GROEN of N FOUT + exitcode
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TESTDATA = path.join(ROOT, 'scripts', 'testdata');
export const IJK_DB = path.join(TESTDATA, 'herfst-test.db');
export const IJK_JSON = path.join(TESTDATA, 'herfst-test.json');

// Worktrees hebben vaak geen eigen node_modules: val terug op die van sporty-railway (enkel lezen).
const NM_FALLBACK = path.resolve(ROOT, '..', 'sporty-railway', 'node_modules');
const NODE_PATH = [process.env.NODE_PATH, fs.existsSync(path.join(ROOT, 'node_modules')) ? path.join(ROOT, 'node_modules') : null, NM_FALLBACK]
  .filter(Boolean).join(path.delimiter);
function laadModule(naam) {
  const require = createRequire(import.meta.url);
  try { return require(naam); } catch { return require(path.join(NM_FALLBACK, naam)); }
}

export const APP_PASSWORD = 'testharnas';
const BASIC = (pw) => 'Basic ' + Buffer.from('sporty:' + pw).toString('base64');
export const API_PERSOON = 10; // "Claude (API)"
export const API_PIN = '1111';

// ── ok / fout / check / einde ──
let _oks = 0, _fouten = 0;
export const ok = (m) => { _oks++; console.log('ok    ' + m); };
export const fout = (m) => { _fouten++; console.log('FOUT  ' + m); };
export const check = (cond, m) => (cond ? ok(m) : fout(m));
export const info = (m) => console.log('      ' + m);
export async function einde(srv) {
  if (srv) await srv.stop();
  console.log(`\n${_oks} ok, ${_fouten} fout`);
  if (_fouten === 0) { console.log('ALLES GROEN'); process.exit(0); }
  console.log(`${_fouten} FOUT`); process.exit(1);
}

// ── Server ──
let _basicPw = APP_PASSWORD;
export async function startServer({ poort, dbBron = IJK_DB, appPassword = APP_PASSWORD, verseMap = true } = {}) {
  if (!poort) throw new Error('startServer: poort is verplicht');
  if (!fs.existsSync(dbBron)) throw new Error('startServer: dbBron bestaat niet: ' + dbBron);
  _basicPw = appPassword;
  const dataDir = path.resolve(ROOT, '..', `${path.basename(ROOT)}-test-${poort}`);
  if (verseMap) fs.rmSync(dataDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dataDir, 'uploads'), { recursive: true });
  const dbPad = path.join(dataDir, 'sporty.db');
  if (verseMap || !fs.existsSync(dbPad)) fs.copyFileSync(dbBron, dbPad);
  const base = `http://localhost:${poort}`;
  let serverLog = '';
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(poort), DATA_DIR: dataDir, APP_PASSWORD: appPassword, NODE_PATH },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stdout.on('data', (d) => (serverLog += d));
  proc.stderr.on('data', (d) => (serverLog += d));
  let gestopt = false;
  const killNu = () => { if (!gestopt) { gestopt = true; try { proc.kill(); } catch {} } };
  process.on('exit', killNu);
  const t0 = Date.now();
  let klaar = false;
  while (Date.now() - t0 < 20000) {
    if (proc.exitCode !== null) break;
    try { const r = await fetch(base + '/api/login-status', { headers: { authorization: BASIC(appPassword) } }); if (r.ok) { klaar = true; break; } } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!klaar) { killNu(); throw new Error(`server op ${poort} kwam niet op binnen 20 s\n${serverLog.slice(-3000)}`); }
  return {
    base, poort, dataDir, dbPad,
    log: () => serverLog,
    // Stopt de server en wacht tot het proces echt weg is (SIGTERM → flush naar schijf).
    stop: () => new Promise((res) => {
      if (gestopt || proc.exitCode !== null) { gestopt = true; return res(); }
      proc.once('exit', () => res());
      gestopt = true; try { proc.kill(); } catch { res(); }
      setTimeout(res, 5000);
    }),
  };
}

// ── HTTP ──
export async function api(base, token, method, pad, body) {
  const headers = { authorization: BASIC(_basicPw) };
  if (token) headers['x-auth-token'] = token;
  let b;
  if (body !== undefined) { b = typeof body === 'string' ? body : JSON.stringify(body); headers['content-type'] = 'application/json'; }
  const res = await fetch(base + pad, { method, headers, body: b });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, headers: res.headers };
}
export async function login(base, persoonId = API_PERSOON, pincode = API_PIN) {
  const r = await api(base, null, 'POST', '/api/login', { persoon_id: persoonId, pincode });
  if (r.status !== 200 || !r.json?.token) throw new Error(`login ${persoonId} mislukt: ${r.status} ${r.text.slice(0, 200)}`);
  return r.json.token;
}

// ── Database lezen (sql.js, leest het bestand zoals het nu op schijf staat) ──
let _SQL = null;
export async function leesDb(pad, sql, params = []) {
  if (!_SQL) _SQL = await laadModule('sql.js')();
  const db = new _SQL.Database(fs.readFileSync(pad));
  try {
    const st = db.prepare(sql); st.bind(params);
    const rijen = []; while (st.step()) rijen.push(st.getAsObject()); st.free();
    return rijen;
  } finally { db.close(); }
}

// ── Links ──
// kv-link: bestaat pas als er een KV gekoppeld is. Is er nog geen KV, koppel dan een
// persoon met rol 'kv' (bestaande of nieuw aangemaakt) aan het kampmoment.
export async function kvToken(base, token, kampmomentId, kvNaam = 'Test KV harnas') {
  let r = await api(base, token, 'POST', `/api/kampmomenten/${kampmomentId}/kv-token`);
  if (r.status === 200 && r.json?.token) return r.json.token;
  const pers = await api(base, token, 'GET', '/api/personeel');
  let kv = (pers.json || []).find((p) => p.naam === kvNaam && p.rol === 'kv');
  if (!kv) { const n = await api(base, token, 'POST', '/api/personeel', { naam: kvNaam, rol: 'kv' }); kv = n.json; }
  await api(base, token, 'PUT', `/api/kampmomenten/${kampmomentId}`, { kv_persoon_id: kv.id });
  r = await api(base, token, 'POST', `/api/kampmomenten/${kampmomentId}/kv-token`);
  if (r.status !== 200 || !r.json?.token) throw new Error(`kv-token voor km ${kampmomentId} mislukt: ${r.status} ${r.text.slice(0, 200)}`);
  return r.json.token;
}
export async function ritToken(base, token, ritId) {
  const r = await api(base, token, 'POST', `/api/ritten/${ritId}/token`);
  if (r.status !== 200 || !r.json?.token) throw new Error(`rit-token ${ritId} mislukt: ${r.status} ${r.text.slice(0, 200)}`);
  return r.json.token;
}

// ── Kleine helpers voor ketentests ──
export function leesIjk() { return JSON.parse(fs.readFileSync(IJK_JSON, 'utf8')); }
// Maak van een generator-voorstel een echte taak + rit (zoals de UI "+ Backlog" en daarna plannen).
export async function voorstelNaarRit(base, token, voorstel, { chauffeur } = {}) {
  const isOph = voorstel.type === 'ophaling';
  const body = {
    type: voorstel.type, opmerking: voorstel.opmerking, kampmoment_id: voorstel.kampmoment_id,
    van_locatie_id: isOph ? voorstel.locatie_id : voorstel.van_locatie_id,
    naar_locatie_id: isOph ? voorstel.naar_locatie_id : voorstel.locatie_id,
    regels: (voorstel.materiaal || []).map((m) => ({ naam: m.naam, qty: m.qty, soort: m.soort, bak_id: m.bak_id, attribuut_id: m.attribuut_id })),
  };
  const t = await api(base, token, 'POST', '/api/transport-taken', body);
  if (t.status !== 200) throw new Error('taak aanmaken mislukt: ' + t.status + ' ' + t.text.slice(0, 200));
  const m = await api(base, token, 'PUT', `/api/transport-taken/${t.json.id}/move`, { datum: voorstel.datum, tijd: voorstel.tijd || '09:00' });
  if (m.status !== 200 || !m.json?.rit_id) throw new Error('taak inplannen mislukt: ' + m.status + ' ' + m.text.slice(0, 200));
  if (chauffeur) await api(base, token, 'PUT', `/api/ritten/${m.json.rit_id}`, { datum: voorstel.datum, chauffeur: chauffeur.naam, personeel_id: chauffeur.id });
  return { taakId: t.json.id, ritId: m.json.rit_id, regels: t.json.regels || [] };
}
// Rit-pagina-acties via het publieke rit-token (zoals de chauffeur op zijn GSM).
export const ritActie = (base, ritTok, checkId, actie) => api(base, null, 'POST', `/api/rit-token/${ritTok}/checks/${checkId}/${actie}`);
