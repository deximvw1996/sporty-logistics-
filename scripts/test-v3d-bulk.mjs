// test-v3d-bulk.mjs — V3d (chat C): bulk overal via lib/bulk.js (handmatig verplaatsen, bezit aanpassen),
// taak terug op gepland, catalogus niet vullen vanuit transport, geen alert() op de rit-pagina.
// Eigen server via _testhulp (poort 3331, herfst-test.db).
import * as T from './_testhulp.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const POORT = parseInt(process.env.TEST_POORT || '3331');
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: POORT });
let tok;
// Live db (de server houdt hem in het geheugen) via de backup-route.
async function db(sql, params = []) {
  const r = await fetch(srv.base + '/api/backup-db', { headers: { authorization: 'Basic ' + Buffer.from('sporty:' + T.APP_PASSWORD).toString('base64'), 'x-auth-token': tok } });
  let initSqlJs; try { initSqlJs = require('sql.js'); } catch { initSqlJs = require(T.ROOT + '/../sporty-railway/node_modules/sql.js'); }
  const SQL = await initSqlJs(); const d = new SQL.Database(Buffer.from(await r.arrayBuffer()));
  const st = d.prepare(sql); st.bind(params); const rows = []; while (st.step()) rows.push(st.getAsObject()); st.free(); d.close(); return rows;
}
try {
  tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const R = ijk.locaties.rozenweg, K = ijk.locaties.abdijschool;
  const fiets = (await db("SELECT * FROM bakken WHERE is_bulk=1 AND naam LIKE 'Kleuterfiets rood%'"))[0];
  T.check(fiets && fiets.aantal === 17 && fiets.thuislocatie_id === R, `uitgangspunt: "${fiets?.naam}" bezit ${fiets?.aantal}, thuis Rozenweg`);
  const sp = async () => Object.fromEntries((await db('SELECT locatie_id,aantal FROM bulk_spreiding WHERE bak_id=? AND aantal>0', [fiets.id])).map((x) => [x.locatie_id, x.aantal]));
  const som = async () => { const b = (await db('SELECT aantal FROM bakken WHERE id=?', [fiets.id]))[0].aantal; const s = Object.values(await sp()).reduce((a, n) => a + n, 0); return { s, b }; };
  const wijz = async () => (await db("SELECT COUNT(*) AS n FROM wijzigingen WHERE tabel='bulk_spreiding' AND rij_id IN (SELECT id FROM bulk_spreiding WHERE bak_id=?)", [fiets.id]))[0].n;
  let w0 = await wijz();

  // ── handmatig verplaatsen ──
  let r = await A('POST', `/api/bakken/${fiets.id}/verplaats`, { naar_locatie_id: K, reden: 'test V3d' });
  T.check(r.status === 400 && /aantal/.test(r.json?.error || ''), `verplaatsen zonder aantal → 400 "${r.json?.error}"`);
  r = await A('POST', `/api/bakken/${fiets.id}/verplaats`, { naar_locatie_id: K, reden: 'test V3d', aantal: 5 });
  T.check(r.status === 200 && r.json?.som?.ok, `verplaats 5 → 200, controleerSom ok (${JSON.stringify(r.json?.som)})`);
  let s = await sp();
  T.check(s[R] === 12 && s[K] === 5, `spreiding Rozenweg 12, Abdijschool 5 (${JSON.stringify(s)})`);
  let b = (await db('SELECT status,huidige_locatie_id FROM bakken WHERE id=?', [fiets.id]))[0];
  T.check(b.status === 'op_locatie' && b.huidige_locatie_id === K, `status afgeleid: op_locatie @ Abdijschool (${b.status} @ ${b.huidige_locatie_id})`);
  let w1 = await wijz(); T.check(w1 > w0, `wijzigingen: verplaatsing gelogd (+${w1 - w0})`); w0 = w1;
  r = await A('POST', `/api/bakken/${fiets.id}/verplaats`, { naar_locatie_id: K, reden: 'test V3d', aantal: 50, van_locatie_id: R });
  T.check(r.status === 409, `50 verplaatsen terwijl er 12 staan → 409 "${r.json?.error}"`);

  // ── bezit aanpassen ──
  r = await A('PUT', `/api/vaste-bakken/${fiets.id}`, { aantal: 20 });
  s = await sp(); let sm = await som();
  T.check(r.status === 200 && s[R] === 15 && s[K] === 5 && sm.s === 20 && sm.b === 20, `bezit 17 → 20: thuis +3 (${JSON.stringify(s)}, som ${sm.s} = bezit ${sm.b})`);
  w1 = await wijz(); T.check(w1 > w0, `wijzigingen: bezit-aanpassing gelogd (+${w1 - w0})`); w0 = w1;
  r = await A('POST', `/api/bakken/${fiets.id}/verplaats`, { naar_locatie_id: K, reden: 'test V3d', aantal: 7, van_locatie_id: R });
  s = await sp(); T.check(s[K] === 12, `nog 7 naar Abdijschool → daar 12 (${JSON.stringify(s)})`);
  r = await A('PUT', `/api/vaste-bakken/${fiets.id}`, { aantal: 10 });
  T.check(r.status === 409 && /12/.test(r.json?.error || ''), `bezit → 10 terwijl 12 op locatie → 409 "${r.json?.error}"`);
  sm = await som(); T.check(sm.b === 20 && sm.s === 20, `na 409 niets gewijzigd (bezit ${sm.b}, som ${sm.s})`);
  r = await A('PUT', `/api/vaste-bakken/${fiets.id}`, { status: 'thuis' });
  b = (await db('SELECT status FROM bakken WHERE id=?', [fiets.id]))[0];
  T.check(b.status === 'op_locatie', `status van een bulk-rij is niet rechtstreeks te zetten (blijft ${b.status})`);
  r = await A('POST', `/api/bakken/${fiets.id}/verplaats`, { naar_locatie_id: R, reden: 'terug', aantal: 12 });
  s = await sp(); b = (await db('SELECT status,huidige_locatie_id FROM bakken WHERE id=?', [fiets.id]))[0];
  T.check(r.status === 200 && s[R] === 20 && !s[K] && b.status === 'thuis', `12 terug (standaard-van = grootste buiten thuis) → alles thuis, status thuis (${JSON.stringify(s)})`);

  // ── taak terug op gepland zet een verplaatsing terug ──
  r = await A('POST', '/api/transport-taken', { type: 'levering', datum: '2026-11-02', van_locatie_id: R, naar_locatie_id: K, regels: [{ naam: `3 × ${fiets.naam}`, qty: 3, soort: 'vast', bak_id: fiets.id }] });
  const taak = r.json.id;
  r = await A('PUT', `/api/transport-taken/${taak}/status`, { status: 'gedaan' });
  s = await sp(); T.check(r.status === 200 && s[K] === 3, `taak gedaan → 3 op Abdijschool (${JSON.stringify(s)})`);
  r = await A('PUT', `/api/transport-taken/${taak}/status`, { status: 'gepland' });
  s = await sp(); sm = await som();
  T.check(r.status === 200 && r.json?.status === 'gepland' && s[R] === 20 && !s[K] && sm.s === sm.b, `terug op gepland → bulk via verplaatsBulk terug naar Rozenweg (${JSON.stringify(s)}, som = bezit)`);
  r = await A('PUT', `/api/transport-taken/${taak}/status`, { status: 'gedaan' });
  s = await sp(); T.check(s[K] === 3, `opnieuw gedaan → weer 3 op Abdijschool (terugzetten wist de idempotentie-vlag)`);
  r = await A('PUT', `/api/transport-taken/${taak}/status`, { status: 'gepland' });
  // geladen taak terugzetten wist vinkjes en bak niet meer onderweg
  const koffer = (await db("SELECT * FROM bakken WHERE naam='Verkeerskoffer 1'"))[0];
  r = await A('POST', '/api/transport-taken', { type: 'levering', datum: '2026-11-02', van_locatie_id: R, naar_locatie_id: K, regels: [{ naam: 'Bak Verkeerskoffer 1', qty: 1, soort: 'vast', bak_id: koffer.id }] });
  const taak2 = r.json.id;
  const rit = (await A('POST', '/api/ritten', { datum: '2026-11-02', chauffeur: 'Test', taak_ids: [taak2] })).json.id;
  const rtok = await T.ritToken(srv.base, tok, rit);
  const pagina = await fetch(`${srv.base}/rit/${rtok}`, { headers: { authorization: 'Basic ' + Buffer.from('sporty:' + T.APP_PASSWORD).toString('base64') } }).then((x) => x.text());
  T.check(!/alert\(/.test(pagina) && /function toast\(/.test(pagina), 'rit-pagina: geen alert() meer, wel toast()');
  const ch = (await A('GET', `/api/ritten/${rit}/checks`)).json.checks;
  await T.ritActie(srv.base, rtok, ch[0].id, 'laden');
  T.check((await db('SELECT status FROM bakken WHERE id=?', [koffer.id]))[0].status === 'onderweg', 'Verkeerskoffer 1 geladen → onderweg');
  r = await A('DELETE', `/api/transport-taken/${taak2}`);
  T.check(r.status === 409 && /1 regel is al geladen/.test(r.json?.error || ''), `verwijderen na laden → 409 "${r.json?.error}"`);
  r = await A('POST', '/api/transport-taken/bulk-delete', { ids: [taak2] });
  T.check(r.status === 409, `bulk-delete na laden → 409`);
  r = await A('PUT', `/api/transport-taken/${taak2}/status`, { status: 'gepland' });
  const kb = (await db('SELECT status FROM bakken WHERE id=?', [koffer.id]))[0];
  const cv = (await db('SELECT geladen FROM verhuis_checks WHERE taak_id=?', [taak2]))[0];
  T.check(r.status === 200 && kb.status === 'thuis' && cv.geladen === 0, `terug op gepland → koffer 'thuis', laadvinkje gewist (${kb.status}, geladen=${cv.geladen})`);
  r = await A('DELETE', `/api/transport-taken/${taak2}`);
  const wees = await db('SELECT COUNT(*) AS n FROM verhuis_checks WHERE taak_id=? OR rit_id=?', [taak2, rit]);
  const ritWeg = await db('SELECT COUNT(*) AS n FROM transport_ritten WHERE id=?', [rit]);
  T.check(r.status === 200 && wees[0].n === 0 && ritWeg[0].n === 0, `daarna verwijderen → 200, checks weg, lege rit weg`);

  // ── catalogus niet vullen vanuit transport ──
  const n0 = (await db('SELECT COUNT(*) AS n FROM item_types'))[0].n;
  r = await A('POST', '/api/transport-taken', { type: 'levering', datum: '2026-11-03', van_locatie_id: R, naar_locatie_id: K,
    regels: [{ naam: 'Bak Verkeerskoffer 1', qty: 1, soort: 'vast' }, { naam: 'Bak Testkoffer V3d onbekend', qty: 1, soort: 'vast' }] });
  const t3 = r.json; await A('POST', '/api/transport-regels', { taak_id: t3.id, naam: 'Nog een onbekend V3d-ding', qty: 1 });
  const n1 = (await db('SELECT COUNT(*) AS n FROM item_types'))[0].n;
  T.check(n1 === n0, `transporttaak + transportregel met onbekende namen → geen nieuw item_type (${n0} → ${n1})`);
  const rg = await db('SELECT naam,item_type_id FROM transport_regels WHERE taak_id=? ORDER BY id', [t3.id]);
  T.check(rg[0].item_type_id != null && rg[1].item_type_id === null && rg[2].item_type_id === null, `bekend type gevonden ("Bak Verkeerskoffer 1" → ${rg[0].item_type_id}), onbekend blijft null`);
  const rit3 = (await A('POST', '/api/ritten', { datum: '2026-11-03', chauffeur: 'Test', taak_ids: [t3.id] })).json.id;
  await A('POST', `/api/ritten/${rit3}/checks/init`);
  const n2 = (await db('SELECT COUNT(*) AS n FROM item_types'))[0].n;
  T.check(n2 === n0, `checks/init → geen nieuw item_type (${n2})`);
  const ap = (await A('POST', '/api/aanvragen', { kampmoment_id: ijk.kampmomenten.abdijschool, soort: 'materiaal', tekst: '2 V3d-onbestaande-dingen' })).json.id;
  await A('PUT', `/api/aanvragen/${ap}/status`, { status: 'goedgekeurd', maak_spoedtransport: true });
  await A('POST', '/api/spoedtransport', { item: 'V3d spoed onbekend', qty: 1 });
  const n3 = (await db('SELECT COUNT(*) AS n FROM item_types'))[0].n;
  T.check(n3 === n0, `spoedtaak uit aanvraag + POST /api/spoedtransport → geen nieuw item_type (${n3})`);
} catch (e) { T.fout('onverwachte fout: ' + (e.stack || e)); }
await T.einde(srv);
