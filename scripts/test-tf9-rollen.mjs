// test-tf9-rollen.mjs — TF9: kantoor en coördinator zijn één rol. Migratie op een database met een coördinator (twee keer starten), meldingen, rechten, gsm.
import * as T from './_testhulp.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { rolMag } = require('../lib/auth.js');
const POORT = Number(process.env.TEST_POORT) || 3378;
// Database van vóór TF9: coördinator met pincode, oude meldingen, dubbele melding.
const SQL = await (await import('sql.js')).default();
const d = new SQL.Database(fs.readFileSync(T.IJK_DB));
const naar = (q, p) => d.run(q, p);
const hash = (s) => { const c = require('node:crypto'); return 'sha256$' + c.createHash('sha256').update(s).digest('hex'); };
try { naar("DELETE FROM app_vlaggen WHERE naam='migratie95_klaar'"); } catch {}
naar("INSERT INTO personeel (naam,rol,pincode) VALUES ('Oud Coord','coordinator',?)", [hash('5851')]);
const cid = d.exec("SELECT id FROM personeel WHERE naam='Oud Coord'")[0].values[0][0];
const tmp = path.join(os.tmpdir(), `tf9-${POORT}.db`);
try { naar("CREATE TABLE IF NOT EXISTS meldingen (id INTEGER PRIMARY KEY AUTOINCREMENT, voor_rol TEXT DEFAULT '', voor_persoon_id INTEGER, van_naam TEXT DEFAULT '', tekst TEXT NOT NULL, link TEXT DEFAULT '', gelezen_op TEXT, created_at TEXT DEFAULT '')"); } catch {}
naar("INSERT INTO meldingen (voor_rol,tekst,created_at) VALUES ('coordinator','Tf9 oud bericht','2026-10-01T10:00:00Z'),('coordinator','Tf9 dubbel','2026-10-01T10:00:00Z'),('kantoor','Tf9 dubbel','2026-10-01T10:00:00Z')");
fs.writeFileSync(tmp, Buffer.from(d.export()));
let srv = await T.startServer({ poort: POORT, dbBron: tmp });
try {
  const db = (q, p) => T.leesDb(srv.dbPad, q, p);
  T.check((await db('SELECT rol FROM personeel WHERE id=?', [cid]))[0].rol === 'kantoor', 'migratie: coördinator wordt kantoor');
  T.check((await db("SELECT COUNT(*) AS n FROM activiteiten_log WHERE beschrijving LIKE '%Oud Coord%coordinator → kantoor%'"))[0].n === 1, 'per persoon gelogd');
  let ct = await T.login(srv.base, cid, '5851');
  T.check(!!ct, 'oude pincode werkt');
  const C = (m, p, b) => T.api(srv.base, ct, m, p, b);
  for (const p of ['/api/personeel', '/api/nakijken', '/api/ritplanning', '/api/vandaag', '/api/tekorten-overzicht', '/api/locaties-overzicht']) T.check((await C('GET', p)).status === 200, `mag kantoorscherm ${p}`);
  const m = (await C('GET', '/api/meldingen')).json.meldingen;
  T.check(m.some((x) => x.tekst === 'Tf9 oud bericht') && m.filter((x) => x.tekst === 'Tf9 dubbel' && !x.gelezen).length === 1, 'oude melding zichtbaar, geen dubbele');
  // Tweede start
  await srv.stop();
  srv = await T.startServer({ poort: POORT, dbBron: tmp, verseMap: false });
  const db2 = (q, p) => T.leesDb(srv.dbPad, q, p);
  T.check((await db2("SELECT COUNT(*) AS n FROM activiteiten_log WHERE beschrijving LIKE '%Oud Coord%coordinator → kantoor%'"))[0].n === 1, 'twee keer starten: niets dubbel');
  T.check((await T.api(srv.base, ct, 'GET', '/api/wie-ben-ik')).json.rol === 'kantoor', 'open sessie heeft meteen de nieuwe rol');
  const tok = await T.login(srv.base);
  const A = (m2, p, b) => T.api(srv.base, tok, m2, p, b);
  // Server krijgt toch coordinator
  const nw = (await A('POST', '/api/personeel', { naam: 'Tf9 Nieuw', rol: 'coordinator' })).json;
  T.check(nw.rol === 'kantoor', 'rol coordinator bij aanmaken wordt kantoor');
  T.check(rolMag('coordinator', 'DELETE', '/api/themas/1'), 'rolMag: coordinator gedraagt zich als kantoor');
  // Melding niet aan jezelf; wel aan de andere kantoormedewerker; één keer.
  const ct2 = await T.login(srv.base, cid, '5851');
  const C2 = (m2, p, b) => T.api(srv.base, ct2, m2, p, b);
  await A('POST', '/api/meldingen', { voor_rol: 'kantoor', tekst: 'Tf9 van mezelf' });
  T.check(!(await A('GET', '/api/meldingen')).json.meldingen.some((x) => x.tekst === 'Tf9 van mezelf') && (await C2('GET', '/api/meldingen')).json.meldingen.filter((x) => x.tekst === 'Tf9 van mezelf').length === 1, 'melding niet naar wie het deed, één keer naar de andere');
  // Rechten chauffeur en monitor
  for (const [rol, ja, nee] of [['chauffeur', [['GET', '/api/aanvullijst'], ['POST', '/api/aanvullijst/melding'], ['POST', '/api/aanvullijst/5/aangevuld'], ['GET', '/api/vandaag'], ['GET', '/api/meldingen']], [['GET', '/api/tekorten-overzicht'], ['GET', '/api/voorraad'], ['GET', '/api/locaties'], ['GET', '/api/personeel'], ['POST', '/api/ritten']]], ['monitor', [['GET', '/api/vandaag'], ['GET', '/api/meldingen']], [['GET', '/api/aanvullijst'], ['POST', '/api/aanvullijst/melding'], ['GET', '/api/tekorten-overzicht'], ['GET', '/api/locaties']]]]) {
    T.check(ja.every(([x, y]) => rolMag(rol, x, y)) && !nee.some(([x, y]) => rolMag(rol, x, y)), `${rol}: rechten als voorheen`);
  }
  // Chauffeur: aanvullen mag, rit eerst, Stockage bereikbaar.
  const nav = require(T.ROOT + '/public/nav.js');
  const tabs = nav.tabsVan('chauffeur').map((t) => t[2]);
  T.check(tabs[0] === 'Vandaag' && tabs[1] === 'Ritten' && tabs.includes('Stockage'), `chauffeur tabs: ${tabs}`);
  const ijk = T.leesIjk(), n = new Date(), vd = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  const R = ijk.locaties.rozenweg, AB = (await A('GET', '/api/locaties')).json.find((l) => /abdij/i.test(l.name)).id;
  const pers = async (naam, rol, pin) => { const x = (await A('POST', '/api/personeel', { naam, rol })).json; await A('POST', `/api/personeel/${x.id}/pincode`, { pincode: pin }); return { id: x.id, tok: await T.login(srv.base, x.id, pin) }; };
  const ch = await pers('Tf9 Chauffeur', 'chauffeur', '5852');
  const CH = (m2, p, b) => T.api(srv.base, ch.tok, m2, p, b);
  // aanvulwerk: open melding
  T.check((await CH('POST', '/api/aanvullijst/melding', { soort: 'weg', item_naam: 'Tf9 hoepel', aantal: 1 })).status === 200, 'chauffeur meldt weg');
  const nk = (await A('GET', '/api/nakijken')).json.bakken.find((b) => b.bak && b.bak.soort === 'melding');
  const det = (await A('GET', `/api/nakijken/sessie/${nk.sessie_id}`)).json;
  await A('PUT', `/api/nakijken/regel/${det.items[0].regel_id}`, { kantoor_actie: 'uit_pool', kantoor_aantal: 1 });
  await A('POST', `/api/nakijken/sessie/${nk.sessie_id}/afronden`);
  const zonder = (await CH('GET', '/api/vandaag?mijn=1')).json;
  T.check(zonder.aanvullen.open > 0 && zonder.nu && zonder.nu.soort === 'aanvullen', 'chauffeur zonder rit: aanvullen mag NU zijn');
  const rit = (await A('POST', '/api/ritten', { datum: vd, vertrek: '09:00', personeel_id: ch.id })).json;
  await A('POST', '/api/transport-taken', { type: 'levering', datum: vd, tijd: '09:30', van_locatie_id: R, naar_locatie_id: AB, rit_id: rit.id, regels: [{ naam: 'Doos', qty: 1 }] });
  await A('POST', `/api/ritten/${rit.id}/klaarzet`, {});
  const met = (await CH('GET', '/api/vandaag?mijn=1')).json;
  T.check(met.nu.soort === 'rit' && met.daarna.some((x) => x.soort === 'aanvullen'), 'chauffeur met rit: rit is NU, aanvullen staat eronder');
  // Kantoor rijdt en vult aan (data van de gsm-Vandaag; 390 in de browser).
  const r2 = (await A('POST', '/api/ritten', { datum: vd, vertrek: '08:00', personeel_id: cid })).json;
  await A('POST', '/api/transport-taken', { type: 'levering', datum: vd, tijd: '08:30', van_locatie_id: R, naar_locatie_id: AB, rit_id: r2.id, regels: [{ naam: 'Mand', qty: 2 }] });
  await A('POST', `/api/ritten/${r2.id}/klaarzet`, {});
  const kv = (await C2('GET', '/api/vandaag?mijn=1')).json;
  T.check(kv.nu.soort === 'rit' && kv.nu.url.startsWith('/rit/') && kv.ritten_vandaag.some((x) => x.id === r2.id) && kv.daarna.some((x) => x.soort === 'aanvullen'), 'kantoor gsm: eigen rit als NU, aanvulwerk erachter');
  const tk = kv.nu.url.split('/').pop(), dd = (await T.api(srv.base, null, 'GET', `/api/rit-token/${tk}/data`)).json;
  await T.api(srv.base, null, 'POST', `/api/rit-token/${tk}/alles`, { actie: 'laden', check_ids: dd.stops[0].regels.map((x) => x.check_id) });
  await T.api(srv.base, null, 'POST', `/api/rit-token/${tk}/alles`, { actie: 'lossen', check_ids: dd.stops[0].regels.map((x) => x.check_id) });
  T.check((await T.api(srv.base, null, 'GET', `/api/rit-token/${tk}/data`)).json.rit.status === 'gedaan', 'kantoor rijdt zijn rit tot gedaan');
  const hl = (await C2('GET', '/api/aanvullijst?alles=1')).json.bakken.flatMap((b) => b.handelingen).find((x) => x.stuk === 'Tf9 hoepel' && x.kan_afvinken);
  T.check(hl && (await C2('POST', `/api/aanvullijst/${hl.regel_id}/aangevuld`, { aangevuld: true })).status === 200, 'kantoor vult aan');
  const M = require(T.ROOT + '/public/meer.js').html({ rol: 'kantoor', naam: 'x' });
  T.check(/Mijn ritten/.test(M) && /href="\/aanvullen"/.test(M) && !/zoeken/.test(M), 'Meer: Mijn ritten en Aanvullen, geen /zoeken');
  // Geen tekst meer in public/
  const rest = [];
  for (const f of fs.readdirSync(T.ROOT + '/public')) { const p = T.ROOT + '/public/' + f; if (fs.statSync(p).isFile() && /\.(js|html|css)$/.test(f) && /coördinator|coordinator/i.test(fs.readFileSync(p, 'utf8'))) rest.push(f); }
  T.check(!rest.length, `geen "coördinator" meer in public/ ${rest}`);
} catch (e) { T.fout('uitzondering: ' + e.message + ' ' + e.stack); console.log(srv.log().slice(-1200)); }
await T.einde(srv);
