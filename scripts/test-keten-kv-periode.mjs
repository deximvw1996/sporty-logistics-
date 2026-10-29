// test-keten-kv-periode.mjs — bewaakt WERKLIJST 64, 65 · DOORLICHTING-b R11 (V2b).
// Gewenst: een KV-sessie hoort bij zijn kampmoment. Herfst- en zomer-kampmoment op dezelfde
// locatie+week, elk met een KV: de herfst-KV telt en verstuurt → enkel de herfst-sessie verandert;
// de tekortenlijst toont standaard enkel de actieve periode, ?periode_id= de andere; oude sessies
// zonder kampmoment blijven zichtbaar; migratie 72 koppelt bestaande sessies; de kalender rekent
// met de actieve periode (herfst → novemberdagen).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as T from './_testhulp.mjs';
const POORT = parseInt(process.env.TEST_POORT || '3326');
const ijk = T.leesIjk();
const herfst = ijk.periode.id, betekom = ijk.locaties.betekom, kmHerfst = ijk.kampmomenten.betekom;

// ── Bron-db voorbereiden: 3 "oude" sessies zonder kampmoment_id, en migratie 72 opnieuw laten lopen ──
const require = createRequire(import.meta.url);
let initSqlJs; try { initSqlJs = require('sql.js'); } catch { initSqlJs = require(path.resolve(T.ROOT, '..', 'sporty-railway', 'node_modules', 'sql.js')); }
const SQL = await initSqlJs();
const bronDb = new SQL.Database(fs.readFileSync(T.IJK_DB));
const kol = bronDb.exec("PRAGMA table_info(nakijk_sessies)")[0].values.map((v) => v[1]);
if (kol.includes('kampmoment_id')) bronDb.run('UPDATE nakijk_sessies SET kampmoment_id=NULL');
bronDb.run("DELETE FROM app_vlaggen WHERE naam='migratie72_klaar'");
const oud = (loc, week, wie) => bronDb.run("INSERT INTO nakijk_sessies (bak_type,locatie_id,week,datum,kv_wie,kv_status,kantoor_status) VALUES ('thema',?,?,'2026-07-01',?,'ingediend','open')", [loc, week, wie]);
oud(betekom, 1, 'oud-herfstweek');   // → kampmoment in de actieve periode (herfst-Betekom)
// Niet-actieve archiefperiode met één kampmoment op Abdijschool week 3 → "het enige kampmoment"-geval.
bronDb.run("INSERT INTO vakantieperiodes (naam,start_datum,eind_datum,max_weken,actief) VALUES ('Archief TEST','2025-07-07','2025-08-31',8,0)");
const archiefId = bronDb.exec('SELECT last_insert_rowid()')[0].values[0][0];
bronDb.run('INSERT INTO kampmomenten (locatie_id,week,periode_id,type) VALUES (?,?,?,?)', [ijk.locaties.abdijschool, 3, archiefId, 'kamp']);
const kmArchief = bronDb.exec('SELECT last_insert_rowid()')[0].values[0][0];
oud(ijk.locaties.abdijschool, 3, 'oud-enig'); // → het enige kampmoment op die locatie+week (archief, niet actief)
oud(betekom, 7, 'oud-niemand');      // → geen kampmoment → NULL
const bronPad = path.join(path.resolve(T.ROOT, '..'), `sporty-b-kvbron-${POORT}.db`);
fs.writeFileSync(bronPad, Buffer.from(bronDb.export()));
bronDb.close();

const srv = await T.startServer({ poort: POORT, dbBron: bronPad });
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const S = (sql, p) => T.leesDb(srv.dbPad, sql, p);
  await new Promise((r) => setTimeout(r, 400));

  // ── Migratie 72 ──
  // De ijk-db bevat ook échte oude sessies (Maxims data) — dus enkel controleren dat de migratie per geval telt;
  // de drie testsessies hieronder bewijzen elk geval afzonderlijk.
  const m72 = srv.log().match(/Migratie 72: nakijk_sessies\.kampmoment_id — (\d+) via de actieve periode, (\d+) via het enige kampmoment, (\d+) zonder kampmoment/);
  T.check(!!m72 && +m72[1] >= 1 && +m72[2] >= 1 && +m72[3] >= 1, `migratie 72 logt per geval (${(srv.log().match(/Migratie 72:[^\n]*/) || ['niet gevonden'])[0]})`);
  const oudRijen = await S("SELECT kv_wie,kampmoment_id FROM nakijk_sessies WHERE kv_wie LIKE 'oud-%' ORDER BY kv_wie");
  const m = Object.fromEntries(oudRijen.map((r) => [r.kv_wie, r.kampmoment_id]));
  T.check(m['oud-herfstweek'] === kmHerfst, `oude sessie Betekom w1 → herfst-kampmoment ${kmHerfst} (kreeg ${m['oud-herfstweek']})`);
  T.check(m['oud-enig'] === kmArchief, `oude sessie Abdijschool w3 → het enige kampmoment ${kmArchief} (niet-actieve archiefperiode) (kreeg ${m['oud-enig']})`);
  T.check(m['oud-niemand'] === null, `oude sessie zonder kampmoment blijft NULL (kreeg ${m['oud-niemand']})`);

  // ── Zomer TEST + zomer-kampmoment op dezelfde locatie+week, zelfde thema, eigen KV ──
  const zp = (await A('POST', '/api/periodes', { naam: 'Zomer TEST', start_datum: '2027-07-05', eind_datum: '2027-08-29' })).json;
  const zk = await A('POST', '/api/kampmomenten', { locatie_id: betekom, week: 1, periode_id: zp.id, type: 'kamp' });
  T.check(zk.status === 200, `zomer-kampmoment Betekom w1 naast herfst-Betekom w1 (kreeg ${zk.status})`);
  const kmZomer = zk.json.id;
  await A('POST', `/api/kampmomenten/${kmZomer}/themas`, { thema_id: ijk.themas.alles_op_wieltjes, dag: null });
  const kvZomer = await T.kvToken(srv.base, tok, kmZomer, 'Test KV Zomer');
  const kvHerfst = await T.kvToken(srv.base, tok, kmHerfst);

  const tel = async (kvTok, aantal) => {
    const d = (await T.api(srv.base, null, 'GET', `/api/kv/${kvTok}/data`)).json;
    const bak = (d?.bakken || []).find((b) => b.items?.length);
    const r = await T.api(srv.base, null, 'POST', `/api/kv/${kvTok}/bakken/${bak.id}/tellen`, { regels: [{ item_id: bak.items[0].id, aangetroffen: aantal }] });
    return { bak, status: r.status };
  };
  // Zomer-KV telt 0 en verstuurt (zomer-sessie bestaat al vóór de herfst-KV begint)
  const z = await tel(kvZomer, 0);
  T.check(z.status === 200, `zomer-KV telt bak ${z.bak.code || z.bak.naam} (kreeg ${z.status})`);
  await T.api(srv.base, null, 'POST', `/api/kv/${kvZomer}/versturen`);
  const zomerVoor = await S('SELECT ns.id,ns.kv_wie,ns.kv_tijdstip,ns.kv_status,nr.aangetroffen FROM nakijk_sessies ns JOIN nakijk_regels nr ON nr.sessie_id=ns.id WHERE ns.kampmoment_id=? AND nr.aangetroffen IS NOT NULL', [kmZomer]);
  T.check(zomerVoor.length === 1 && zomerVoor[0].kv_status === 'ingediend' && zomerVoor[0].aangetroffen === 0, `zomer-sessie ingediend met telling 0 (${JSON.stringify(zomerVoor)})`);

  // Herfst-KV ziet de zomer-telling niet en verstuurt enkel zijn eigen sessie
  const dH = (await T.api(srv.base, null, 'GET', `/api/kv/${kvHerfst}/data`)).json;
  const bakH = dH.bakken.find((b) => b.id === z.bak.id);
  T.check(bakH && bakH.ingediend === false && bakH.items[0].aangetroffen === null, `herfst-KV ziet de zomer-telling niet (ingediend ${bakH?.ingediend}, aangetroffen ${bakH?.items?.[0]?.aangetroffen})`);
  await new Promise((r) => setTimeout(r, 1100)); // ander tijdstip, zodat een overschrijving zichtbaar zou zijn
  const h = await tel(kvHerfst, 5);
  T.check(h.status === 200, `herfst-KV telt dezelfde bak (kreeg ${h.status})`);
  await T.api(srv.base, null, 'POST', `/api/kv/${kvHerfst}/versturen`);
  const zomerNa = await S('SELECT ns.id,ns.kv_wie,ns.kv_tijdstip,ns.kv_status,nr.aangetroffen FROM nakijk_sessies ns JOIN nakijk_regels nr ON nr.sessie_id=ns.id WHERE ns.kampmoment_id=? AND nr.aangetroffen IS NOT NULL', [kmZomer]);
  T.check(JSON.stringify(zomerNa) === JSON.stringify(zomerVoor), `zomer-sessie onaangeroerd na herfst tellen+versturen (voor ${JSON.stringify(zomerVoor)} / na ${JSON.stringify(zomerNa)})`);
  const herfstS = await S('SELECT ns.id,ns.kv_status,ns.kv_wie,nr.aangetroffen FROM nakijk_sessies ns JOIN nakijk_regels nr ON nr.sessie_id=ns.id WHERE ns.kampmoment_id=? AND nr.aangetroffen IS NOT NULL', [kmHerfst]);
  T.check(herfstS.length === 1 && herfstS[0].kv_status === 'ingediend' && herfstS[0].aangetroffen === 5 && herfstS[0].kv_wie === 'Test KV Betekom',
    `herfst-sessie apart, ingediend met telling 5 door de herfst-KV (${JSON.stringify(herfstS)})`);

  // ── Tekortenlijst + dashboard per periode ──
  const lijstH = (await A('GET', '/api/nakijk-tekorten')).json || [];
  const kmIds = (l) => [...new Set(l.map((s) => s.kampmoment_id))];
  T.check(lijstH.some((s) => s.kampmoment_id === kmHerfst) && !lijstH.some((s) => s.kampmoment_id === kmZomer), `tekortenlijst standaard: herfst wél, zomer niet (kampmomenten ${JSON.stringify(kmIds(lijstH))})`);
  const zonder = lijstH.filter((s) => s.zonder_kampmoment);
  T.check(zonder.some((s) => s.kv_wie === 'oud-niemand') && zonder.every((s) => s.kampmoment_id === null), `oude sessie zonder kampmoment blijft zichtbaar met zonder_kampmoment (${zonder.length} zulke, o.a. ${zonder.map((s) => s.kv_wie).join(', ')})`);
  const laatsteMet = lijstH.map((s) => !!s.zonder_kampmoment).lastIndexOf(false), eersteZonder = lijstH.findIndex((s) => s.zonder_kampmoment);
  T.check(eersteZonder === -1 || laatsteMet < eersteZonder, 'sessies zonder kampmoment staan achteraan (aparte groep)');
  const lijstZ = (await A('GET', `/api/nakijk-tekorten?periode_id=${zp.id}`)).json || [];
  T.check(lijstZ.some((s) => s.kampmoment_id === kmZomer) && !lijstZ.some((s) => s.kampmoment_id === kmHerfst), `?periode_id=${zp.id} toont de zomer en niet de herfst (kampmomenten ${JSON.stringify(kmIds(lijstZ))})`);
  const dashH = (await A('GET', '/api/tekorten-dashboard')).json;
  const herkomstWeken = JSON.stringify(dashH).includes('Zomer') ? 'bevat zomer' : 'ok';
  T.check((await A('GET', '/api/tekorten-dashboard')).status === 200 && herkomstWeken === 'ok', 'tekorten-dashboard antwoordt per periode (200)');
  const aantalH = (await A('GET', '/api/nakijk-tekorten/aantal-open')).json?.aantal;
  T.check(aantalH === lijstH.filter((s) => s.kantoor_status !== 'verwerkt').length, `aantal-open telt enkel de actieve periode (${aantalH})`);

  // ── Kalender per periode ──
  const kal = (await A('GET', '/api/kalender')).json;
  const wd = kal?.werkdagen || [];
  T.check(wd.length === 5 && wd.every((d) => d >= '2026-11-02' && d <= '2026-11-08'), `kalender (actief = herfst) geeft de 5 werkdagen van 2–6 nov (kreeg ${wd.join(',')})`);
  const kalZ = (await A('GET', `/api/kalender?periode_id=${zp.id}`)).json?.werkdagen || [];
  T.check(kalZ.length > 0 && kalZ.every((d) => d >= '2027-07-05' && d <= '2027-08-29') && !kalZ.some((d) => d.startsWith('2026-')), `kalender ?periode_id=zomer geeft enkel dagen in juli–aug 2027 (${kalZ.length} dagen, ${kalZ[0]}..${kalZ.at(-1)})`);
} catch (e) { T.fout('onverwachte fout: ' + (e.stack || e)); }
try { fs.unlinkSync(bronPad); } catch {}
await T.einde(srv);
