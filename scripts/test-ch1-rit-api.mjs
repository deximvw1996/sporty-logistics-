// test-ch1-rit-api.mjs — CH1 (chat C): chauffeursscherm, data en API. Slots vast/vrij + wissel, contacten
// per locatie en KV, rit-data per stuk (foto/rek/code), "niet mee" → rest-taak, probleem melden, export.
// Eigen server via _testhulp (poort 3332, herfst-test.db).
import * as T from './_testhulp.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const POORT = parseInt(process.env.TEST_POORT || '3332');
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: POORT });
const BASIC = 'Basic ' + Buffer.from('sporty:' + T.APP_PASSWORD).toString('base64');
let tok;
async function db(sql, params = []) {
  const r = await fetch(srv.base + '/api/backup-db', { headers: { authorization: BASIC, 'x-auth-token': tok } });
  let initSqlJs; try { initSqlJs = require('sql.js'); } catch { initSqlJs = require(T.ROOT + '/../sporty-railway/node_modules/sql.js'); }
  const SQL = await initSqlJs(); const d = new SQL.Database(Buffer.from(await r.arrayBuffer()));
  const st = d.prepare(sql); st.bind(params); const rows = []; while (st.step()) rows.push(st.getAsObject()); st.free(); d.close(); return rows;
}
try {
  tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const P = (m, p, b) => T.api(srv.base, null, m, p, b); // publiek (rit-link)
  const R = ijk.locaties.rozenweg, AB = ijk.locaties.abdijschool, BE = ijk.locaties.betekom;
  const kmAB = ijk.kampmomenten.abdijschool, kmBE = ijk.kampmomenten.betekom;

  // ── contacten klaarzetten (locatie + KV) ──
  const locAB = (await A('GET', '/api/locaties')).json.find((l) => l.id === AB);
  let r = await A('PUT', `/api/locaties/${AB}`, { ...locAB, contact_naam: 'Conciërge Jan', contact_telefoon: '0470 11 22 33', sleutel_info: 'Sleutel bij de buren nr. 12' });
  T.check(r.status === 200 && r.json.contact_tel === '0470 11 22 33' && r.json.sleutel_info === 'Sleutel bij de buren nr. 12', 'PUT /api/locaties: contact_telefoon (alias van contact_tel) + sleutel_info bewaard');
  const locNa = (await A('GET', '/api/locaties')).json.find((l) => l.id === AB);
  T.check(locNa.contact_telefoon === '0470 11 22 33' && locNa.sleutel_info && locNa.adres !== undefined, 'GET /api/locaties geeft contact_naam/contact_telefoon/sleutel_info/adres mee');
  // reviewfix Fable (CH2-keuring): gedeeltelijke PUT (enkel contact) mag de rest niet wissen en geen 500 geven
  r = await A('PUT', `/api/locaties/${AB}`, { contact_naam: 'Conciërge Jan', contact_telefoon: '0470 11 22 33' });
  T.check(r.status === 200 && r.json.name === locAB.name && r.json.addr === locAB.addr && r.json.contact_tel === '0470 11 22 33', `gedeeltelijke PUT /api/locaties (enkel contact) → 200, naam/adres blijven (${r.status})`);
  const kvId = (await db('SELECT kv_persoon_id FROM kampmomenten WHERE id=?', [kmAB]))[0].kv_persoon_id;
  const kvP = (await A('GET', '/api/personeel')).json.find((p) => p.id === kvId);
  await A('PUT', `/api/personeel/${kvId}`, { ...kvP, telefoon: '0499 88 77 66' });

  // ── rit met 3 stops: vast / vrij / vrij ──
  const bak = (await db("SELECT * FROM bakken WHERE soort='thema' AND code='N20'"))[0];
  const bak2 = (await db("SELECT * FROM bakken WHERE soort='thema' AND code='H53'"))[0];
  const fiets = (await db("SELECT * FROM bakken WHERE is_bulk=1 AND naam LIKE 'Kleuterfiets rood%'"))[0];
  const mk = async (naar, km, tijd, regels) => (await A('POST', '/api/transport-taken', { type: 'levering', datum: '2026-11-02', tijd, van_locatie_id: R, naar_locatie_id: naar, kampmoment_id: km, regels })).json.id;
  const t1 = await mk(AB, kmAB, '09:00', [{ naam: `Bak ${bak.naam} (${bak.code})`, qty: 1, soort: 'thema', bak_id: bak.id }, { naam: `5 × ${fiets.naam}`, qty: 5, soort: 'vast', bak_id: fiets.id }]);
  const t2 = await mk(BE, kmBE, '10:00', [{ naam: 'Croquet doelen', qty: 1, soort: 'attribuut', attribuut_id: 4 }]);
  const t3 = await mk(AB, kmAB, '11:00', [{ naam: `Bak ${bak2.naam} (${bak2.code})`, qty: 1, soort: 'thema', bak_id: bak2.id }]);
  const t1nieuw = (await db('SELECT slot FROM transport_taken WHERE id=?', [t1]))[0];
  T.check(t1nieuw.slot === 'vast', "nieuwe taak krijgt standaard slot 'vast'");
  const rit = (await A('POST', '/api/ritten', { datum: '2026-11-02', chauffeur: 'Test Chauffeur', taak_ids: [t1, t2, t3] })).json.id;
  r = await A('PUT', `/api/transport-taken/${t2}`, { slot: 'vrij' });
  T.check(r.status === 200 && r.json.slot === 'vrij', 'kantoor zet stop 2 op vrij (PUT met enkel slot)');
  await A('PUT', `/api/transport-taken/${t3}`, { slot: 'vrij' });
  r = await A('PUT', `/api/transport-taken/${t3}`, { slot: 'half' });
  T.check(r.status === 400, 'ongeldig slot → 400');
  let gr = (await A('GET', `/api/ritten/${rit}`)).json;
  T.check(gr.taken.map((t) => t.id).join() === [t1, t2, t3].join() && gr.taken.every((t) => t.slot && t.volgorde != null && t.tijd), `GET /api/ritten/:id geeft taken in volgorde met slot/volgorde/tijd (${gr.taken.map((t) => `${t.volgorde}:${t.slot}`).join(' ')})`);
  const rtok = await T.ritToken(srv.base, tok, rit);

  // ── wissel ──
  const wijz0 = (await db("SELECT MAX(id) AS m FROM wijzigingen"))[0].m || 0;
  r = await P('POST', `/api/rit-token/${rtok}/taken/${t2}/wissel`, { richting: 'omlaag' });
  T.check(r.status === 200, `wissel omlaag op stop 2 → 200 (kreeg ${r.status} ${r.json?.error || ''})`);
  gr = (await A('GET', `/api/ritten/${rit}`)).json;
  const volg = gr.taken.map((t) => t.id), tijden = Object.fromEntries(gr.taken.map((t) => [t.id, t.tijd]));
  T.check(volg.join() === [t1, t3, t2].join(), `volgorde nu stop 1, 3, 2 (${volg.join(',')})`);
  T.check(tijden[t3] === '10:00' && tijden[t2] === '11:00' && tijden[t1] === '09:00', `tijden omgewisseld (stop3 ${tijden[t3]}, stop2 ${tijden[t2]})`);
  const w = await db("SELECT COUNT(*) AS n FROM wijzigingen WHERE id>? AND tabel='transport_taken' AND context='rit-link'", [wijz0]);
  T.check(w[0].n >= 2, `wijzigingen: ${w[0].n} regels met context rit-link`);
  const al = await db("SELECT beschrijving FROM activiteiten_log WHERE beschrijving LIKE '%wisselde stop%' ORDER BY id DESC LIMIT 1");
  T.check(al.length === 1, `activiteiten_log: "${al[0]?.beschrijving}"`);
  r = await P('POST', `/api/rit-token/${rtok}/taken/${t3}/wissel`, { richting: 'omhoog' });
  T.check(r.status === 409 && /staat vast door kantoor/.test(r.json?.error || ''), `wissel met een vaste stop → 409 "${r.json?.error}"`);
  r = await P('POST', `/api/rit-token/${rtok}/taken/${t2}/wissel`, { richting: 'omlaag' });
  T.check(r.status === 409, 'laatste stop omlaag → 409');
  r = await P('POST', `/api/rit-token/zzzzzzzzzz/taken/${t2}/wissel`, { richting: 'omlaag' });
  T.check(r.status === 403, 'fout rit-token → 403');
  // reviewfix Fable: een stop die al aangekomen/gedaan is wisselt niet meer van plaats
  await A('PUT', `/api/transport-taken/${t3}/status`, { status: 'aangekomen' });
  r = await P('POST', `/api/rit-token/${rtok}/taken/${t3}/wissel`, { richting: 'omlaag' });
  T.check(r.status === 409 && /al aangekomen/.test(r.json?.error || ''), `wissel met een aangekomen stop → 409 "${r.json?.error}"`);
  await A('PUT', `/api/transport-taken/${t3}/status`, { status: 'gepland' });

  // ── rit-data ──
  let d = (await P('GET', `/api/rit-token/${rtok}/data`)).json;
  T.check(d.rit?.id === rit && d.stops?.length === 3 && d.voortgang?.stops === 3, `rit-data: rit + 3 stops + voortgang (${JSON.stringify(d.voortgang)})`);
  const s1 = d.stops[0];
  T.check(s1.locatie?.naam && s1.locatie.contact_naam === 'Conciërge Jan' && s1.locatie.contact_telefoon === '0470 11 22 33' && s1.locatie.sleutel_info.includes('buren') && 'adres' in s1.locatie, 'stop 1: locatie {naam, adres, contact_naam, contact_telefoon, sleutel_info}');
  T.check(s1.kv?.naam && s1.kv.telefoon === '0499 88 77 66', `stop 1: kv {naam "${s1.kv?.naam}", telefoon}`);
  T.check(s1.slot === 'vast' && d.stops[1].slot === 'vrij' && s1.volgorde === 1 && s1.tijd === '09:00', 'stop: slot, volgorde, tijd');
  const rN20 = s1.regels.find((x) => x.code === 'N20');
  T.check(rN20 && rN20.rek === 'N' && 'foto_url' in rN20 && rN20.qty === 1 && rN20.geladen === false && rN20.gelost === false && rN20.is_bulk === false, `regel N20: code/rek N/foto_url/qty/geladen/gelost (${JSON.stringify(rN20)})`);
  const rF = s1.regels.find((x) => x.is_bulk);
  T.check(rF && rF.aantal_geladen === 0 && rF.qty === 5, 'bulkregel: is_bulk + aantal_geladen 0');
  const attr = d.stops[2].regels[0];
  T.check(attr && attr.attribuut_id === 4 && 'foto_url' in attr, 'attribuut-regel heeft attribuut_id en foto_url-veld');
  T.check(!JSON.stringify(d).includes('items'), 'rit-data bevat geen bak-inhoud (chauffeur ziet bakken, geen inhoud)');

  // ── niet mee → rest-taak ──
  const cH53 = d.stops[1].regels[0];
  r = await P('POST', `/api/rit-token/${rtok}/checks/${cH53.check_id}/niet-mee`, { reden: 'past_niet', opmerking: 'busje vol' });
  T.check(r.status === 200 && r.json.rest_taak_id, `niet-mee (past niet) → 200, rest-taak #${r.json?.rest_taak_id}`);
  const restId = r.json.rest_taak_id;
  let rt = (await db('SELECT * FROM transport_taken WHERE id=?', [restId]))[0];
  let rr = await db('SELECT * FROM transport_regels WHERE taak_id=?', [restId]);
  T.check(rt.status === 'gepland' && rt.rit_id === null && rt.slot === 'vrij' && /Rest van rit #\d+: past niet/.test(rt.opmerking) && rt.naar_locatie_id === AB, `rest-taak: gepland, zonder rit, vrij, "${rt.opmerking}"`);
  T.check(rr.length === 1 && rr[0].bak_id === bak2.id, 'rest-taak bevat de regel van H53');
  T.check((await A('GET', '/api/transport-taken')).json.some((t) => t.id === restId), 'kantoor ziet de rest-taak in GET /api/transport-taken');
  let ch = (await db('SELECT * FROM verhuis_checks WHERE id=?', [cH53.check_id]))[0];
  T.check(ch.geladen === 0 && ch.niet_mee_reden === 'past_niet', 'regel niet geladen, gemarkeerd past_niet');
  r = await P('POST', `/api/rit-token/${rtok}/checks/${cH53.check_id}/laden`);
  T.check(r.status === 409, 'laden van een niet-mee-stuk → 409');
  d = (await P('GET', `/api/rit-token/${rtok}/data`)).json;
  T.check(d.stops[1].regels[0].niet_mee?.reden === 'past_niet' && d.stops[1].regels[0].niet_mee.opmerking === 'busje vol', 'rit-data toont niet_mee {reden, opmerking}');
  // bulk: 3 van de 5 mee
  r = await P('POST', `/api/rit-token/${rtok}/checks/${rF.check_id}/niet-mee`, { reden: 'past_niet', aantal: 3 });
  rr = await db('SELECT * FROM transport_regels WHERE taak_id=? ORDER BY id', [restId]);
  ch = (await db('SELECT qty,niet_mee_aantal FROM verhuis_checks WHERE id=?', [rF.check_id]))[0];
  T.check(r.status === 200 && r.json.rest_taak_id === restId && rr.length === 2 && rr[1].qty === 2 && ch.qty === 3 && ch.niet_mee_aantal === 2, `bulk 3 van 5 mee → zelfde rest-taak aangevuld met 2, check qty 3 (rest ${rr[1]?.qty})`);
  // terugdraaien
  r = await P('POST', `/api/rit-token/${rtok}/checks/${rF.check_id}/niet-mee`, { reden: null });
  ch = (await db('SELECT qty,niet_mee_reden FROM verhuis_checks WHERE id=?', [rF.check_id]))[0];
  T.check(r.status === 200 && ch.qty === 5 && ch.niet_mee_reden === null, 'bulk terugdraaien → check weer qty 5, markering weg');
  r = await P('POST', `/api/rit-token/${rtok}/checks/${cH53.check_id}/niet-mee`, { reden: null });
  rt = await db('SELECT id FROM transport_taken WHERE id=?', [restId]);
  const terug = await db('SELECT taak_id FROM transport_regels WHERE bak_id=? ORDER BY id DESC LIMIT 1', [bak2.id]);
  T.check(r.status === 200 && rt.length === 0 && terug[0].taak_id === t3, 'terugdraaien → lege rest-taak verwijderd, regel terug bij de stop');
  // stop afronden zonder het niet-mee stuk
  r = await P('POST', `/api/rit-token/${rtok}/checks/${cH53.check_id}/niet-mee`, { reden: 'niet_gevonden' });
  for (const c of (await P('GET', `/api/rit-token/${rtok}/data`)).json.stops[1].regels.filter((x) => !x.niet_mee)) { await P('POST', `/api/rit-token/${rtok}/checks/${c.check_id}/laden`); await P('POST', `/api/rit-token/${rtok}/checks/${c.check_id}/lossen`); }
  const st3 = (await db('SELECT status FROM transport_taken WHERE id=?', [t3]))[0].status;
  T.check(st3 === 'gedaan', `stop met enkel een niet-mee-stuk sluit toch af (taak ${st3}); het stuk wacht in de rest-taak`);

  // ── probleem melden ──
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  r = await P('POST', `/api/rit-token/${rtok}/taken/${t1}/probleem`, { soort: 'gesloten', tekst: 'poort op slot', foto_data: png });
  T.check(r.status === 200 && r.json.soort === 'probleem_chauffeur' && /^Chauffeur Test Chauffeur bij .+: locatie gesloten — poort op slot$/.test(r.json.tekst) && r.json.foto_path, `probleem melden → aanvraag "${r.json?.tekst}" met foto`);
  T.check((await A('GET', '/api/aanvragen')).json.some((a) => a.id === r.json.id && a.status === 'nieuw'), 'melding staat in kantoor /api/aanvragen (nieuw)');
  const kvtok = await T.kvToken(srv.base, tok, kmAB);
  const kvd = (await P('GET', `/api/kv/${kvtok}/data`)).json;
  T.check(kvd.meldingen_chauffeur?.some((m) => m.id === r.json.id), 'melding staat in kv-data (meldingen_chauffeur) van dat kampmoment');
  r = await P('POST', `/api/rit-token/${rtok}/taken/${t1}/probleem`, { soort: 'raar' });
  T.check(r.status === 400, 'ongeldige soort → 400');

  // ── export ──
  const ex = (await A('GET', '/api/export')).json;
  const le = ex.locaties.find((l) => l.id === AB);
  T.check(le && !('contact_tel' in le) && !('contact_telefoon' in le) && !('sleutel_info' in le) && !JSON.stringify(ex.locaties).includes('0470 11 22 33'), 'export bevat geen contact_telefoon/contact_tel/sleutel_info');
} catch (e) { T.fout('onverwachte fout: ' + (e.stack || e)); }
await T.einde(srv);
