// Testscript V3c punt 2+3 — catalogusvervuiling stoppen + prod-opschoning (chat E).
// Eigen server op poort 3351 met wegwerp-db BUITEN de worktree (D:\Sporty\sporty-e-v3c-catalogustest).
// Raakt nooit de echte sporty.db, nooit 3001/prod. Gebruik: node scripts/test-v3c-catalogus.mjs  (vanuit D:\Sporty\sporty-e)
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const initSqlJs = require('sql.js');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3351;
const TESTDIR = path.resolve(ROOT, '..', 'sporty-e-v3c-catalogustest');
const TEST_DB = path.join(TESTDIR, 'sporty.db');
const APP_PASSWORD = 'v3ctest';
const BASIC = 'Basic ' + Buffer.from('sporty:' + APP_PASSWORD).toString('base64');
const BASE = `http://localhost:${PORT}`;
const API_ID = 10;

let fouten = 0, oks = 0;
const ok = (m) => { oks++; console.log('ok    ' + m); };
const fout = (m) => { fouten++; console.log('FOUT  ' + m); };
const check = (c, m) => (c ? ok(m) : fout(m));
const md5 = (f) => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');

fs.rmSync(TESTDIR, { recursive: true, force: true });
fs.mkdirSync(TESTDIR, { recursive: true });
fs.copyFileSync(path.join(ROOT, 'sporty.db'), TEST_DB);

async function leesDb(sql, bestand = TEST_DB) { const SQL = await initSqlJs(); const d = new SQL.Database(fs.readFileSync(bestand)); const r = d.exec(sql); d.close(); return r[0] ? r[0].values : []; }
const een = async (sql, f) => (await leesDb(sql, f))[0]?.[0];

// ── Testdata inspuiten ──
{
  const SQL = await initSqlJs();
  const d = new SQL.Database(fs.readFileSync(TEST_DB));
  const bakId = d.exec("SELECT id FROM bakken WHERE soort='thema' ORDER BY id LIMIT 1")[0].values[0][0];
  // vervuilde/ongebruikte types + één gebruikt "Bak …"-type + info-types
  d.run("INSERT INTO item_types (naam,eenheid,categorie) VALUES ('Bak Testtransport (X1)','stuk','materiaal')");
  d.run("INSERT INTO item_types (naam,eenheid,categorie) VALUES ('3 × Testfiets','stuk','materiaal')");
  d.run("INSERT INTO item_types (naam,eenheid,categorie) VALUES ('Bak met testveren','stuk','materiaal')");
  const gebruiktId = d.exec("SELECT id FROM item_types WHERE naam='Bak met testveren'")[0].values[0][0];
  d.run("INSERT INTO bak_items (bak_id,naam,qty,item_type_id) VALUES (?,?,?,?)", [bakId, 'Bak met testveren', 1, gebruiktId]);
  d.run("INSERT INTO item_types (naam,eenheid,categorie) VALUES ('INFO: testrij zonder gebruik','stuk','materiaal')");
  // 'undefined'/lege namen
  d.run("INSERT INTO locaties (name,type) VALUES ('undefined','kamp')");
  d.run("INSERT INTO locaties (name,type) VALUES ('undefined','kamp')");
  const lokMetRef = d.exec("SELECT MAX(id) FROM locaties")[0].values[0][0];
  d.run("INSERT INTO kampmomenten (locatie_id,week) VALUES (?,98)", [lokMetRef]); // verwijzing → blijft
  d.run("INSERT INTO attributen (naam) VALUES ('')");
  d.run("INSERT INTO item_types (naam) VALUES ('undefined')");
  d.run("INSERT INTO bakken (naam,soort) VALUES ('','thema')");
  // wezen
  d.run("INSERT INTO bulk_spreiding (bak_id,locatie_id,aantal) VALUES (999999,1,5)");
  d.run("INSERT INTO verhuis_checks (rit_id,item_naam) VALUES (999999,'wees')");
  d.run("INSERT INTO nakijk_regels (sessie_id,item_naam) VALUES (999999,'wees')");
  fs.writeFileSync(TEST_DB, Buffer.from(d.export()));
  d.close();
}
const typesVoor = await een('SELECT COUNT(*) FROM item_types');
const bulkRijenVoor = await een('SELECT COUNT(*) FROM bulk_spreiding WHERE bak_id IN (SELECT id FROM bakken)');
const bulkMismatch = (f) => een("SELECT COUNT(*) FROM bakken b WHERE is_bulk=1 AND (SELECT COALESCE(SUM(aantal),0) FROM bulk_spreiding s WHERE s.bak_id=b.id)<>b.aantal", f);

// ── A. resolveItemTypeId (rechtstreeks) ──
{
  fs.copyFileSync(TEST_DB, path.join(TESTDIR, 'unit.db'));
  const dbx = require(path.join(ROOT, 'lib', 'db.js'))(TESTDIR, path.join(TESTDIR, 'unit.db'));
  await dbx.open();
  const n0 = dbx.get('SELECT COUNT(*) n FROM item_types').n;
  check(dbx.resolveItemTypeId('Totaal Nieuwe Naam A', undefined, false) === null, 'resolveItemTypeId(naam, hint, false) voor onbekende naam → null');
  check(dbx.get('SELECT COUNT(*) n FROM item_types').n === n0, '…en maakt geen item_type aan');
  const id = dbx.resolveItemTypeId('Totaal Nieuwe Naam A');
  check(id > 0 && dbx.get('SELECT COUNT(*) n FROM item_types').n === n0 + 1, 'standaard (maakAan=true) maakt nog gewoon aan — bak-items blijven gekoppeld');
  check(dbx.resolveItemTypeId('totaal nieuwe naam a', undefined, false) === id, 'bestaande naam wordt met maakAan=false wél gevonden (case-insensitive)');
  check(dbx.resolveItemTypeId('17 × Kleuterfiets rood') === null, "vangnet: '17 × …' wordt zelfs met maakAan=true nooit een catalogustype");
}

// ── B. server: transporttaak opslaan ──
let server, serverLog = '';
async function start() {
  server = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DATA_DIR: TESTDIR, APP_PASSWORD, SPORTY_TESTHOOK: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', (d) => (serverLog += d)); server.stderr.on('data', (d) => (serverLog += d));
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) { try { const r = await fetch(BASE + '/api/login-status', { headers: { authorization: BASIC } }); if (r.ok) return true; } catch {} await new Promise((r) => setTimeout(r, 300)); }
  return false;
}
async function stop() {
  if (!server) return;
  try { await fetch(BASE + '/api/_test/sigterm', { method: 'POST', headers: { authorization: BASIC } }); } catch {}
  await new Promise((r) => setTimeout(r, 800)); try { server.kill(); } catch {}
  await new Promise((r) => setTimeout(r, 300));
}
process.on('exit', () => { try { server.kill(); } catch {} });
async function call(method, p, { token, body } = {}) {
  const headers = { authorization: BASIC };
  if (token) headers['x-auth-token'] = token;
  let b; if (body !== undefined) { b = JSON.stringify(body); headers['content-type'] = 'application/json'; }
  const res = await fetch(BASE + p, { method, headers, body: b });
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, text, json };
}
const draai = (script, ...args) => spawnSync(process.execPath, [path.join(ROOT, 'scripts', script), ...args], { encoding: 'utf8' });

try {
  if (!(await start())) { fout('server kwam niet op\n' + serverLog); process.exit(1); }
  let r = await call('POST', '/api/login', { body: { persoon_id: API_ID, pincode: '1111' } });
  const kantoor = r.json?.token;
  check(r.status === 200 && kantoor, 'login Claude (API)');
  const voor = (await call('GET', '/api/item-types', { token: kantoor }));
  const EXACT = "('17 × Kleuterfiets rood','2 × Loopfiets blauw')";
  const nVoor = await een(`SELECT COUNT(*) FROM item_types WHERE naam IN ${EXACT}`);
  r = await call('POST', '/api/transport-taken', { token: kantoor, body: { type: 'ophalen', datum: '2030-01-01', van_locatie_id: 7, naar_locatie_id: 1, regels: [{ naam: '17 × Kleuterfiets rood', qty: 17, soort: 'andere' }, { naam: '2 × Loopfiets blauw', qty: 2 }] } });
  check(r.status === 200, `transporttaak met regel "17 × Kleuterfiets rood" opgeslagen → 200 (kreeg ${r.status})`);
  r = await call('GET', '/api/transport-taken', { token: kantoor });
  await new Promise((x) => setTimeout(x, 6000)); // flush
  const regelTekst = await een("SELECT COUNT(*) FROM transport_regels WHERE naam='17 × Kleuterfiets rood'");
  check(regelTekst === 1, 'de transportregel zelf is wél bewaard (naam staat in transport_regels)');
  const nNa = await een(`SELECT COUNT(*) FROM item_types WHERE naam IN ${EXACT}`);
  check(nVoor === 0 && nNa === 0, `na opslaan bestaat er geen item_type "17 × Kleuterfiets rood"/"2 × Loopfiets blauw" (voor ${nVoor}, na ${nNa})`);
  const typesNaPost = await een('SELECT COUNT(*) FROM item_types');
  check(typesNaPost === typesVoor, `aantal item_types onveranderd door de taak (${typesVoor} → ${typesNaPost})`);
} catch (e) {
  fout('onverwachte fout: ' + (e.stack || e));
} finally {
  await stop();
}

// ── C. opschoning-catalogus ──
const md5Voor = md5(TEST_DB);
let o = draai('opschoning-catalogus.mjs', TEST_DB);
console.log(o.stdout.split('\n').filter((l) => /Samenvatting|kandidaten|weg: id|blijft: id 6/.test(l)).slice(0, 8).map((l) => '      | ' + l).join('\n'));
check(o.status === 0 && /A\. vervuilde transport-types/.test(o.stdout), 'opschoning-catalogus droogloop draait');
check(md5(TEST_DB) === md5Voor, 'droogloop wijzigt het db-bestand niet (md5 gelijk)');
check(/weg: id \d+ "Bak Testtransport \(X1\)"/.test(o.stdout) && /weg: id \d+ "3 × Testfiets"/.test(o.stdout), 'droogloop toont de ongebruikte vervuilde types als te verwijderen');
check(!/weg: id \d+ "Bak met testveren"/.test(o.stdout) && /blijft: id \d+ "Bak met testveren"/.test(o.stdout), '…en laat "Bak met testveren" (gebruikt in bak_items) staan');
check(/INFO: testrij zonder gebruik/.test(o.stdout) || /kandidaten 257/.test(o.stdout), 'KV:/INFO:-groep: ongebruikte INFO-rij herkend (257 kandidaten)');
const verwacht = +(/te verwijderen (\d+)/.exec(o.stdout)?.[1] ?? -1);
o = draai('opschoning-catalogus.mjs', TEST_DB, '--doe');
check(o.status === 0 && /Database herschreven/.test(o.stdout), 'opschoning-catalogus --doe voert uit');
const typesNa = await een('SELECT COUNT(*) FROM item_types');
check(typesVoor - typesNa === verwacht && verwacht >= 3, `item_types ${typesVoor} → ${typesNa}: precies de ${verwacht} aangekondigde types verwijderd`);
check((await een("SELECT COUNT(*) FROM item_types WHERE naam IN ('Bak Testtransport (X1)','3 × Testfiets','INFO: testrij zonder gebruik')")) === 0, 'de drie ongebruikte testtypes zijn weg');
check((await een("SELECT COUNT(*) FROM item_types WHERE naam='Bak met testveren'")) === 1, '"Bak met testveren" (gebruikt) bestaat nog');
check((await een("SELECT COUNT(*) FROM item_types WHERE naam='KV: Eieren'")) === 1, '"KV: Eieren" (nog in thema_materiaal) bestaat nog');
check((await een('SELECT COUNT(*) FROM bak_items WHERE item_type_id NOT IN (SELECT id FROM item_types)')) === 0, 'geen enkel bak_item wijst naar een verwijderd type');
o = draai('opschoning-catalogus.mjs', TEST_DB, '--doe');
check(/te verwijderen 0|verwijderd 0/.test(o.stdout) || /item_types \d+ → \d+ · verwijderd 0/.test(o.stdout), 'tweede --doe-run vindt niets meer');

// ── D. opschoning-prod ──
const md5b = md5(TEST_DB);
o = draai('opschoning-prod.mjs', TEST_DB);
console.log(o.stdout.split('\n').filter((l) => l.trim()).slice(0, 24).map((l) => '      | ' + l).join('\n'));
check(md5(TEST_DB) === md5b, 'opschoning-prod droogloop wijzigt niets (md5 gelijk)');
check(/99× EHBO-Koffer op "Abdijschool Vlierbeek"/.test(o.stdout), 'droogloop toont de "99× EHBO" op Abdijschool Vlierbeek');
check(/locaties: 2 rij/.test(o.stdout) && /BLIJFT, nog \d+ verwijzing/.test(o.stdout) && /geen verwijzingen: zou verwijderen/.test(o.stdout), "droogloop: 'undefined'-locaties — één zonder verwijzing (weg), één met verwijzing (blijft)");
check(/verhuis_checks: 1 verweesd/.test(o.stdout) && /bulk_spreiding: 1 verweesd/.test(o.stdout) && /nakijk_regels: 9\d|nakijk_regels: \d+ verweesd/.test(o.stdout), 'droogloop meldt de verweesde rijen');
const bulkVoorDoe = await bulkMismatch(TEST_DB);
o = draai('opschoning-prod.mjs', TEST_DB, '--doe');
check(o.status === 0 && /Database herschreven/.test(o.stdout), 'opschoning-prod --doe voert uit');
check((await een('SELECT COUNT(*) FROM locatie_config WHERE aantal>=50')) === 0, 'locatie_config met aantal>=50: weg');
check((await een("SELECT COUNT(*) FROM locaties WHERE name='undefined'")) === 1, "van de 2 'undefined'-locaties is de ongebruikte weg, de gebruikte blijft");
check((await een("SELECT COUNT(*) FROM attributen WHERE TRIM(naam)=''")) === 0 && (await een("SELECT COUNT(*) FROM item_types WHERE naam='undefined'")) === 0, "lege attribuutnaam en item_type 'undefined' weg");
check((await een("SELECT COUNT(*) FROM verhuis_checks WHERE rit_id=999999")) === 0 && (await een('SELECT COUNT(*) FROM nakijk_regels WHERE sessie_id NOT IN (SELECT id FROM nakijk_sessies)')) === 0 && (await een('SELECT COUNT(*) FROM bulk_spreiding WHERE bak_id NOT IN (SELECT id FROM bakken)')) === 0, 'verweesde verhuis_checks / nakijk_regels / bulk_spreiding: weg');
const bulkRijenNa = await een('SELECT COUNT(*) FROM bulk_spreiding');
check(bulkRijenNa === bulkRijenVoor && bulkRijenNa === 55 && (await bulkMismatch(TEST_DB)) === 0 && bulkVoorDoe === 0, `bulk-sommen sluiten nog: ${bulkRijenNa}/55 spreidingsrijen, 0 bakken met afwijkende som`);
o = draai('opschoning-prod.mjs', TEST_DB, '--doe');
check(/locatie_config met aantal >= 50\s+\(geen\)/.test(o.stdout.replace(/\r/g, '')) || /\(geen\)/.test(o.stdout), 'tweede --doe-run: niets meer te doen voor locatie_config');

console.log(`\n${oks} ok, ${fouten} fout`);
if (fouten === 0) { console.log('ALLES GROEN'); process.exit(0); }
console.log('NIET GROEN'); process.exit(1);
