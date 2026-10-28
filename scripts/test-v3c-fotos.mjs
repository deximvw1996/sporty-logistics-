// Testscript V3c punt 1 — foto's als bestanden i.p.v. base64 in sqlite (chat E).
// Eigen server op poort 3350 met een wegwerp-db BUITEN de worktree (D:\Sporty\sporty-e-v3c-fototest).
// Raakt nooit de echte sporty.db, nooit 3001/prod. Gebruik: node scripts/test-v3c-fotos.mjs  (vanuit D:\Sporty\sporty-e)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const initSqlJs = require('sql.js');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3350;
const TESTDIR = path.resolve(ROOT, '..', 'sporty-e-v3c-fototest');
const TEST_DB = path.join(TESTDIR, 'sporty.db');
const UPLOADS = path.join(TESTDIR, 'uploads');
const APP_PASSWORD = 'v3ctest';
const BASIC = 'Basic ' + Buffer.from('sporty:' + APP_PASSWORD).toString('base64');
const BASE = `http://localhost:${PORT}`;
const API_ID = 10; // "Claude (API)", pincode 1111

let fouten = 0, oks = 0;
const ok = (m) => { oks++; console.log('ok    ' + m); };
const fout = (m) => { fouten++; console.log('FOUT  ' + m); };
const check = (c, m) => (c ? ok(m) : fout(m));

const jpeg = (n) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]), crypto.randomBytes(n)]);
const png = (n) => Buffer.concat([Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'), crypto.randomBytes(n)]);
const dataUrl = (buf, mime) => `data:${mime};base64,` + buf.toString('base64');

// ── Wegwerp-db klaarzetten + oude (base64-)foto's inspuiten ──
fs.rmSync(TESTDIR, { recursive: true, force: true });
fs.mkdirSync(UPLOADS, { recursive: true });
fs.copyFileSync(path.join(ROOT, 'sporty.db'), TEST_DB);

async function db() { const SQL = await initSqlJs(); return new SQL.Database(fs.readFileSync(TEST_DB)); }
async function leesDb(sql) { const d = await db(); const r = d.exec(sql); d.close(); return r[0] ? r[0].values : []; }

const vastId = (await leesDb("SELECT id FROM bakken WHERE soort='vast' ORDER BY id LIMIT 1"))[0][0];
const themaBakId = (await leesDb("SELECT id FROM bakken WHERE soort='thema' ORDER BY id LIMIT 1"))[0][0];
const attrId = (await leesDb('SELECT id FROM attributen ORDER BY id LIMIT 1'))[0][0];
const KV_TOKEN = 'v3ctoken123';
{
  const SQL = await initSqlJs();
  const d = new SQL.Database(fs.readFileSync(TEST_DB));
  // kolommen bestaan nog niet in de oude db voor *_path; legacy-kolommen wel
  d.run('UPDATE bakken SET foto_opgeplooid=? WHERE id=?', [dataUrl(jpeg(300000), 'image/jpeg'), vastId]);
  d.run('INSERT INTO bak_fotos (bak_id,tijdstip,wie,beschrijving,foto_data) VALUES (?,?,?,?,?)', [themaBakId, '01/08/2026', 'test', 'oude foto', jpeg(300000).toString('base64')]);
  d.run('UPDATE attributen SET foto_data=? WHERE id=?', [dataUrl(png(200000), 'image/png'), attrId]);
  d.run("INSERT INTO aanvragen (soort,tekst,foto_data,status,created_at) VALUES ('kapot','oud, geldige foto',?, 'nieuw','x')", [dataUrl(jpeg(100000), 'image/jpeg')]);
  d.run("INSERT INTO aanvragen (soort,tekst,foto_data,status,created_at) VALUES ('kapot','oud, kapotte foto','data:image/jpeg;base64,@@@geen-base64@@@','nieuw','x')");
  d.run("INSERT INTO kampmomenten (locatie_id,week,kv_token) VALUES (1,99,?)", [KV_TOKEN]);
  fs.writeFileSync(TEST_DB, Buffer.from(d.export()));
  d.close();
}
const grootteVoor = fs.statSync(TEST_DB).size;
console.log(`(uitgangspunt: wegwerp-db ${(grootteVoor / 1024).toFixed(0)} KB met 4 geldige + 1 kapotte base64-foto)`);

// ── Server start/stop ──
let server, serverLog = '';
async function start() {
  serverLog = '';
  server = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DATA_DIR: TESTDIR, APP_PASSWORD }, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', (d) => (serverLog += d));
  server.stderr.on('data', (d) => (serverLog += d));
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) {
    try { const r = await fetch(BASE + '/api/login-status', { headers: { authorization: BASIC } }); if (r.ok) return true; } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}
async function stop() {
  if (!server) return;
  try { await fetch(BASE + '/api/_test/sigterm', { method: 'POST', headers: { authorization: BASIC } }); } catch {}
  await new Promise((r) => setTimeout(r, 800));
  try { server.kill(); } catch {}
  await new Promise((r) => setTimeout(r, 300));
}
process.on('exit', () => { try { server.kill(); } catch {} });
async function call(method, p, { token, body, basic = true } = {}) {
  const headers = {};
  if (basic) headers.authorization = BASIC;
  if (token) headers['x-auth-token'] = token;
  let b; if (body !== undefined) { b = JSON.stringify(body); headers['content-type'] = 'application/json'; }
  const res = await fetch(BASE + p, { method, headers, body: b });
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, headers: res.headers, text, json, buf: null };
}
const bestanden = (dir) => { let n = 0; const loop = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) f.isDirectory() ? loop(path.join(d, f.name)) : n++; }; if (fs.existsSync(dir)) loop(dir); return n; };

try {
  process.env.SPORTY_TESTHOOK = '1';
  if (!(await start())) { fout('server kwam niet op\n' + serverLog); process.exit(1); }
  ok('server op poort ' + PORT);

  // ── A. Migratie 70 ──
  const m70 = /Migratie 70: (\d+) foto's naar uploads\/ geschreven, (\d+) overgeslagen/.exec(serverLog);
  console.log('      (log: ' + (m70 ? m70[0] : 'GEEN Migratie 70-regel') + ')');
  check(m70 && +m70[1] >= 4 && +m70[2] >= 1, 'Migratie 70 schreef minstens de 4 geldige foto\'s weg en liet de kapotte foto liggen');
  await new Promise((r) => setTimeout(r, 6000)); // wacht op flush-timer
  const grootteNa = fs.statSync(TEST_DB).size;
  check(grootteNa < grootteVoor - 700000, `db-bestand kleiner: ${(grootteVoor / 1024).toFixed(0)} KB → ${(grootteNa / 1024).toFixed(0)} KB`);
  console.log(`      (meting: db vóór ${grootteVoor} B, na ${grootteNa} B, ${bestanden(UPLOADS)} bestand(en) in uploads/)`);
  const rij = (sql) => leesDb(sql).then((r) => r[0] || []);
  const [fo, fop] = await rij(`SELECT foto_opgeplooid, foto_opgeplooid_path FROM bakken WHERE id=${vastId}`);
  check(fo.startsWith('/uploads/') && fop && fo === '/uploads/' + fop && fs.existsSync(path.join(UPLOADS, fop)) && /^bak\/\d{4}\/[0-9a-f]{24}\.jpg$/.test(fop), `vaste bak ${vastId}: pad ${fop}, URL in legacy-kolom, bestand bestaat`);
  const [bfd, bfp] = await rij(`SELECT foto_data, foto_path FROM bak_fotos WHERE beschrijving='oude foto'`);
  check(bfd === '/uploads/' + bfp && fs.existsSync(path.join(UPLOADS, bfp)), `bak_fotos: base64 weg, pad ${bfp}, bestand bestaat`);
  const [afd, afp] = await rij(`SELECT foto_data, foto_path FROM attributen WHERE id=${attrId}`);
  check(afd === '/uploads/' + afp && afp.endsWith('.png') && fs.existsSync(path.join(UPLOADS, afp)), `attribuut ${attrId}: png → pad ${afp}`);
  const [qfd, qfp] = await rij(`SELECT foto_data, foto_path FROM aanvragen WHERE tekst='oud, geldige foto'`);
  check(qfd === '/uploads/' + qfp && fs.existsSync(path.join(UPLOADS, qfp)), 'aanvraag: geldige oude foto omgezet');
  const [kfd, kfp] = await rij(`SELECT foto_data, foto_path FROM aanvragen WHERE tekst='oud, kapotte foto'`);
  check(kfd.startsWith('data:image/jpeg;base64,@@@') && !kfp, 'kapotte oude foto blijft ongemoeid staan (overgeslagen, niet verloren)');
  const nogBase64 = (await rij("SELECT (SELECT COUNT(*) FROM bakken WHERE foto_opgeplooid LIKE 'data:%' OR foto_opgezet LIKE 'data:%') + (SELECT COUNT(*) FROM attributen WHERE foto_data LIKE 'data:%') + (SELECT COUNT(*) FROM bak_fotos WHERE length(foto_data)>200 AND foto_data NOT LIKE '/uploads/%')"))[0];
  check(nogBase64 === 0, 'geen enkele geldige base64-foto meer in bakken/attributen/bak_fotos');
  const vlag = (await rij("SELECT waarde FROM app_vlaggen WHERE naam='migratie70_klaar'"))[0];
  check(vlag === '1', 'vlag migratie70_klaar = 1');

  // ── B. tweede start doet niets meer ──
  const filesVoor = bestanden(UPLOADS);
  const stand = JSON.stringify(await leesDb('SELECT foto_data FROM bak_fotos ORDER BY id'));
  await stop();
  if (!(await start())) { fout('tweede start mislukte\n' + serverLog); process.exit(1); }
  check(!/Migratie 70:/.test(serverLog), 'tweede start: Migratie 70 draait niet opnieuw');
  check(bestanden(UPLOADS) === filesVoor, `tweede start: aantal bestanden ongewijzigd (${filesVoor})`);
  await new Promise((r) => setTimeout(r, 1500));
  check(stand === JSON.stringify(await leesDb('SELECT foto_data FROM bak_fotos ORDER BY id')), 'tweede start: bak_fotos ongewijzigd');

  // ── C. API: nieuwe uploads ──
  let r = await call('POST', '/api/login', { body: { persoon_id: API_ID, pincode: '1111' } });
  const kantoor = r.json?.token;
  check(r.status === 200 && kantoor, 'login Claude (API)');

  // C1 attribuut met foto
  r = await call('POST', '/api/attributen', { token: kantoor, body: { naam: 'TEST-attribuut-foto', foto_data: dataUrl(jpeg(5000), 'image/jpeg') } });
  const nieuwAttr = r.json;
  check(r.status === 200 && nieuwAttr?.foto_path && nieuwAttr.foto_data === '/uploads/' + nieuwAttr.foto_path, `POST /api/attributen met foto → pad ${nieuwAttr?.foto_path}, foto_data is URL`);
  check(nieuwAttr && !nieuwAttr.foto_data.startsWith('data:') && nieuwAttr.foto_data.length < 80, 'in de db staat geen base64 (korte URL)');
  check(fs.existsSync(path.join(UPLOADS, nieuwAttr.foto_path)), 'bestand bestaat op schijf');
  r = await call('GET', '/api/attributen', { token: kantoor });
  check(r.json?.find((a) => a.id === nieuwAttr.id)?.foto_data === nieuwAttr.foto_data, 'GET /api/attributen geeft de /uploads-URL terug');
  r = await call('GET', nieuwAttr.foto_data);
  check(r.status === 200 && r.headers.get('content-type')?.startsWith('image/'), `GET ${nieuwAttr.foto_data} met Basic-auth → 200 ${r.headers.get('content-type')}`);
  r = await call('GET', nieuwAttr.foto_data, { basic: false });
  check(r.status === 401, `dezelfde URL zonder Basic-auth → 401 (kreeg ${r.status})`);
  // PUT met teruggestuurde URL laat de foto staan
  r = await call('PUT', `/api/attributen/${nieuwAttr.id}`, { token: kantoor, body: { naam: 'TEST-attribuut-foto2', foto_data: nieuwAttr.foto_data } });
  check(r.status === 200 && r.json.foto_path === nieuwAttr.foto_path && fs.existsSync(path.join(UPLOADS, nieuwAttr.foto_path)), 'PUT met dezelfde URL laat pad en bestand ongemoeid');
  // PUT met nieuwe foto vervangt (oud bestand weg)
  r = await call('PUT', `/api/attributen/${nieuwAttr.id}`, { token: kantoor, body: { foto_data: dataUrl(png(5000), 'image/png') } });
  check(r.status === 200 && r.json.foto_path !== nieuwAttr.foto_path && r.json.foto_path.endsWith('.png') && !fs.existsSync(path.join(UPLOADS, nieuwAttr.foto_path)) && fs.existsSync(path.join(UPLOADS, r.json.foto_path)), 'PUT met nieuwe foto: nieuw bestand, oud bestand verwijderd');
  const pngPad = r.json.foto_path;
  r = await call('PUT', `/api/attributen/${nieuwAttr.id}`, { token: kantoor, body: { foto_data: '' } });
  check(r.status === 200 && r.json.foto_data === '' && r.json.foto_path === '' && !fs.existsSync(path.join(UPLOADS, pngPad)), 'PUT met lege foto_data verwijdert de foto (db + bestand)');

  // C2 bakfoto
  r = await call('POST', `/api/bakken/${themaBakId}/foto`, { token: kantoor, body: { wie: 'Test', beschrijving: 'v3c', foto_data: dataUrl(jpeg(4000), 'image/jpeg') } });
  check(r.status === 200 && r.json?.id, 'POST /api/bakken/:id/foto → 200');
  const bakFotoId = r.json?.id;
  r = await call('GET', `/api/bak-fotos/${bakFotoId}`, { token: kantoor });
  check(/^\/uploads\/bakfoto\/\d{4}\/[0-9a-f]{24}\.jpg$/.test(r.json?.foto_data || '') && r.json.foto_path, `GET /api/bak-fotos/:id → URL (${r.json?.foto_data})`);
  const bakFotoPad = r.json.foto_path;
  r = await call('GET', r.json.foto_data);
  check(r.status === 200, 'bakfoto-URL met Basic-auth → 200');
  r = await call('DELETE', `/api/bak-fotos/${bakFotoId}`, { token: kantoor });
  check(r.status === 200 && !fs.existsSync(path.join(UPLOADS, bakFotoPad)), 'DELETE bak-foto verwijdert ook het bestand');

  // C3 vaste bak foto-slot
  r = await call('POST', `/api/vaste-bakken/${vastId}/foto-slot`, { token: kantoor, body: { slot: 'opgezet', foto_data: dataUrl(jpeg(4000), 'image/jpeg') } });
  check(r.status === 200 && r.json.foto_opgezet === '/uploads/' + r.json.foto_opgezet_path && r.json.foto_opgezet_path, `foto-slot opgezet → URL ${r.json?.foto_opgezet}`);
  r = await call('DELETE', `/api/vaste-bakken/${vastId}/foto-slot/opgezet`, { token: kantoor });
  check(r.status === 200 && r.json.foto_opgezet === '' && r.json.foto_opgezet_path === '', 'foto-slot verwijderen leegt URL en pad');

  // C4 kapot-melding via de kv-link
  const n0 = bestanden(path.join(UPLOADS, 'aanvraag'));
  r = await call('POST', `/api/kv/${KV_TOKEN}/kapot`, { body: { tekst: 'Oven kapot', foto_data: dataUrl(jpeg(300000), 'image/jpeg') } });
  check(r.status === 200 && r.json?.foto_path && r.json.foto_data === '/uploads/' + r.json.foto_path, `kapot-melding via kv-link met foto → pad ${r.json?.foto_path}`);
  const [kapDb] = await rij(`SELECT length(foto_data) FROM aanvragen WHERE id=${r.json?.id}`);
  check(kapDb < 80, `in de db staat voor deze melding ${kapDb} tekens i.p.v. ±400 000 (geen base64)`);
  check(bestanden(path.join(UPLOADS, 'aanvraag')) === n0 + 1, 'precies 1 nieuw bestand in uploads/aanvraag');
  r = await call('POST', `/api/kv/${KV_TOKEN}/kapot`, { body: { tekst: 'Zonder foto' } });
  check(r.status === 200 && r.json.foto_data === '' && r.json.foto_path === '', 'kapot-melding zonder foto werkt nog steeds');

  // ── D. weigeringen ──
  const groot = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(3 * 1024 * 1024, 1)]).toString('base64');
  const html = Buffer.from('<html><script>alert(1)</script></html>').toString('base64');
  for (const [label, foto] of [['3 MB', groot], ['html als base64', html], ['geen base64', '@@@@niet-base64@@@@']]) {
    r = await call('POST', '/api/attributen', { token: kantoor, body: { naam: 'TEST-weiger', foto_data: foto } });
    check(r.status === 400 && r.json?.error, `attribuut met ${label} → 400 (${r.json?.error})`);
    r = await call('POST', `/api/bakken/${themaBakId}/foto`, { token: kantoor, body: { foto_data: foto } });
    check(r.status === 400, `bakfoto met ${label} → 400`);
    r = await call('POST', `/api/kv/${KV_TOKEN}/kapot`, { body: { tekst: 'weiger', foto_data: foto } });
    check(r.status === 400, `kapot-melding met ${label} → 400`);
  }
  const sportId = (await rij('SELECT id FROM sport_items ORDER BY id LIMIT 1'))[0];
  r = await call('POST', `/api/sport/${sportId}/foto`, { token: kantoor, body: { data: html, ext: 'jpg' } });
  check(r.status === 400, 'sport-foto: html-inhoud met ext jpg → 400 (magic bytes, niet de extensie)');
  r = await call('POST', `/api/sport/${sportId}/foto`, { token: kantoor, body: { data: png(100).toString('base64'), ext: 'html' } });
  check(r.status === 400, 'sport-foto: ext html → 400');
  r = await call('POST', `/api/sport/${sportId}/foto`, { token: kantoor, body: { data: png(100).toString('base64'), ext: 'png' } });
  check(r.status === 200 && /^sport-\d+-\d+\.png$/.test(r.json?.foto_path || ''), 'sport-foto: geldige png → 200');
  check(!fs.readdirSync(UPLOADS).some((f) => /\.html$/.test(f)) && bestanden(UPLOADS) > 0, 'geen .html-bestand in uploads/');
  const geweigerdAttr = (await rij("SELECT COUNT(*) FROM attributen WHERE naam='TEST-weiger'"))[0];
  check(geweigerdAttr === 0, 'geweigerde uploads hebben geen attribuut-rij achtergelaten');
} catch (e) {
  fout('onverwachte fout: ' + (e.stack || e));
} finally {
  await stop();
}

console.log(`\n${oks} ok, ${fouten} fout`);
if (fouten === 0) { console.log('ALLES GROEN'); process.exit(0); }
console.log('NIET GROEN'); process.exit(1);
