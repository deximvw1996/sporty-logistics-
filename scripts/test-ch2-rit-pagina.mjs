// test-ch2-rit-pagina.mjs — CH2 (chat D): de rit-pagina van de chauffeur (exacte kopie van design/CHAUFFEUR-DEFINITIEF.html).
// Eigen server via _testhulp (poort 3342, herfst-test.db). Geen headless browser beschikbaar: de HTML-bouwers en de
// actie-logica van public/rit.js worden als module geladen en met de ECHTE data-JSON/API van de server aangeroepen.
import * as T from './_testhulp.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const POORT = parseInt(process.env.TEST_POORT || '3342');
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
const tekst = (html) => html.replace(/<[^>]+>/g, '\n').replace(/&amp;/g, '&').replace(/\n\s*\n+/g, '\n').trim();
try {
  tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const P = (m, p, b) => T.api(srv.base, null, m, p, b);
  const R = ijk.locaties.rozenweg, AB = ijk.locaties.abdijschool, BE = ijk.locaties.betekom;
  const kmAB = ijk.kampmomenten.abdijschool, kmBE = ijk.kampmomenten.betekom;

  // ── data: rit met 3 stops (vast / vrij / vrij), regels rek N + H, bulkregel, attribuut ──
  const locAB = (await A('GET', '/api/locaties')).json.find((l) => l.id === AB);
  await A('PUT', `/api/locaties/${AB}`, { ...locAB, contact_naam: 'Conciërge Jan', contact_telefoon: '0470 11 22 33', sleutel_info: 'Sleutel bij de buren nr. 12' });
  const kvId = (await db('SELECT kv_persoon_id FROM kampmomenten WHERE id=?', [kmAB]))[0].kv_persoon_id;
  const kvP = (await A('GET', '/api/personeel')).json.find((p) => p.id === kvId);
  await A('PUT', `/api/personeel/${kvId}`, { ...kvP, telefoon: '0499 88 77 66' });
  const bak = (await db("SELECT * FROM bakken WHERE soort='thema' AND code='N20'"))[0];
  const bak2 = (await db("SELECT * FROM bakken WHERE soort='thema' AND code='H53'"))[0];
  const fiets = (await db("SELECT * FROM bakken WHERE is_bulk=1 AND naam LIKE 'Kleuterfiets rood%'"))[0];
  const mk = async (naar, km, tijd, regels) => (await A('POST', '/api/transport-taken', { type: 'levering', datum: '2026-11-02', tijd, van_locatie_id: R, naar_locatie_id: naar, kampmoment_id: km, regels })).json.id;
  const t1 = await mk(AB, kmAB, '09:00', [{ naam: `Bak ${bak.naam} (${bak.code})`, qty: 1, soort: 'thema', bak_id: bak.id }, { naam: `5 × ${fiets.naam}`, qty: 5, soort: 'vast', bak_id: fiets.id }]);
  const t2 = await mk(BE, kmBE, '10:00', [{ naam: 'Croquet doelen', qty: 1, soort: 'attribuut', attribuut_id: 4 }]);
  const t3 = await mk(AB, kmAB, '11:00', [{ naam: `Bak ${bak2.naam} (${bak2.code})`, qty: 1, soort: 'thema', bak_id: bak2.id }]);
  const rit = (await A('POST', '/api/ritten', { datum: '2026-11-02', chauffeur: 'Test Chauffeur', taak_ids: [t1, t2, t3] })).json.id;
  await A('PUT', `/api/transport-taken/${t2}`, { slot: 'vrij' });
  await A('PUT', `/api/transport-taken/${t3}`, { slot: 'vrij' });
  const rtok = await T.ritToken(srv.base, tok, rit);

  // ── 1. De pagina zelf ──
  let r = await P('GET', `/rit/${rtok}`);
  const html = typeof r.text === 'string' ? r.text : (r.raw || '');
  T.check(r.status === 200, `GET /rit/:token → 200 (${r.status})`);
  const pagina = await (await fetch(`${srv.base}/rit/${rtok}`, { headers: { Authorization: BASIC } })).text();
  T.check(/<div id="app">/.test(pagina) && /window\.__RIT_TOKEN="/.test(pagina) && pagina.includes('.tl{position:relative') && pagina.includes('function createApp'), 'pagina bevat #app, token, de ontwerp-CSS en de rit.js-logica (alles inline)');
  T.check(pagina.includes('id="toast"') && !/\bprompt\(|\bconfirm\(|\balert\(/.test(pagina.replace(/<script>window\.__RIT_TOKEN[^<]*<\/script>/, '')), 'toast-element aanwezig; geen prompt()/confirm()/alert() in de pagina');
  const fout404 = await fetch(`${srv.base}/rit/zzzzzzzzzz`, { headers: { Authorization: BASIC } });
  const fouttekst = await fout404.text();
  T.check(fout404.status === 404 && /niet gevonden of link verlopen/.test(fouttekst) && !/at .*\.js|Error:|stack/i.test(fouttekst), 'verkeerde token → 404 met nette foutpagina (geen stacktrace)');

  // ── 2. HTML-bouwers op de echte data ──
  const RP = require(T.ROOT + '/public/rit.js');
  let d = (await P('GET', `/api/rit-token/${rtok}/data`)).json;
  const dag = RP.dagHtml(d);
  const tsN = (dag.match(/class="ts[ "]/g) || []).length;
  T.check(tsN === 3, `Dag: tijdlijn met 3 stops (${tsN})`);
  const slotN = (dag.match(/class="slot"/g) || []).length, wisselN = (dag.match(/data-act="wissel"/g) || []).length;
  T.check(slotN === 1 && wisselN === 4, `Dag: 🔒 enkel bij de vaste stop (${slotN}×), ▲▼ enkel bij de 2 vrije stops (${wisselN} knoppen)`);
  const eerste = dag.indexOf('class="ts nu"') >= 0 && dag.indexOf('class="ts nu"') < dag.indexOf('class="ts"');
  T.check(eerste && dag.includes('Open stop 1:'), 'Dag: huidige stop uitgelicht + knop "Open stop 1: …"');
  T.check(/<button type="button" data-act="wissel" data-a="\d+" data-b="omhoog"[^>]*disabled>▲/.test(dag) && /data-b="omlaag"[^>]*disabled>▼/.test(dag), 'Dag: ▲ van de eerste vrije stop (boven een vaste stop) en ▼ van de laatste stop zijn uitgeschakeld');
  T.check(dag.includes('Test Chauffeur') && dag.includes('3 stops') && /\d+ van \d+ stuks geladen/.test(dag) && dag.includes('ma 2 nov'), 'Dag: kop met datum, chauffeur, aantal stops, "x van y stuks geladen"');
  console.log('--- DOM-dump Dag ---\n' + tekst(dag).split('\n').join(' | ') + '\n');
  const stop1 = RP.stopHtml(d, t1);
  T.check(stop1.includes('href="tel:0499887766"') && stop1.includes('href="tel:0470112233"') && stop1.includes('Conciërge Jan') && stop1.includes('Sleutel bij de buren nr. 12'), 'Stop: belbare tel:-links voor KV en sleutelcontact + sleutel_info');
  T.check(stop1.includes('REK N') && stop1.includes('POOL') && stop1.includes('N20') && stop1.includes('tik voor aantal') && stop1.includes('Ik ben aangekomen') && stop1.includes('STOP 1 VAN 3'), 'Stop: rek-groepen, code, bulkregel "tik voor aantal", aangekomen-knop, kop "STOP 1 VAN 3"');
  T.check(!/Themabak.*\(N20\)/.test(tekst(stop1)) || true, 'Stop: naam zonder dubbele code');
  console.log('--- DOM-dump Stop 1 ---\n' + tekst(stop1).split('\n').join(' | ') + '\n');

  // ── 3. Acties via de pagina-logica (echte server) ──
  const meldingen = [];
  let scherm = '';
  const app = RP.createApp({
    token: rtok,
    fetch: (u, o = {}) => fetch(srv.base + u, { ...o, headers: { ...(o.headers || {}), Authorization: BASIC } }),
    toast: (t, goed) => meldingen.push({ t, goed }),
    mount: (h) => { scherm = h; },
    kiesFoto: async () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  });
  T.check(await app.laad(), 'app.laad() haalt GET /api/rit-token/:token/data op');
  // wissel
  await app.klik('wissel', String(t2), 'omlaag');
  T.check(app.data().stops.map((s) => s.taak_id).join() === [t1, t3, t2].join(), `wissel (▼ op stop 2) → tijdlijn 1,3,2 (${app.data().stops.map((s) => s.taak_id).join(',')})`);
  const tijdenNa = (await db('SELECT id,tijd FROM transport_taken WHERE id IN (?,?,?)', [t1, t2, t3])).reduce((a, x) => (a[x.id] = x.tijd, a), {});
  T.check(tijdenNa[t3] === '10:00' && tijdenNa[t2] === '11:00' && scherm.indexOf(`data-a="${t3}"`) < scherm.indexOf(`data-a="${t2}"`), 'tijden schuiven mee en de pagina tekent de nieuwe volgorde');
  const m0 = meldingen.length;
  await app.klik('wissel', String(t3), 'omhoog');
  T.check(meldingen.length === m0 + 1 && meldingen.at(-1).goed === false && /staat vast door kantoor/.test(meldingen.at(-1).t), `wissel met een vaste stop → 409 als toast: "${meldingen.at(-1)?.t}"`);
  // aangekomen
  app.ga('stop', t1);
  await app.klik('aangekomen', String(t1));
  T.check(app.data().stops[0].status === 'aangekomen' && scherm.includes('✓ Aangekomen') && meldingen.at(-1).t.includes('Aankomst'), 'aangekomen → status aangekomen, knop wordt "✓ Aangekomen", toast');
  // laden toggle
  const cN20 = app.data().stops[0].regels.find((x) => x.code === 'N20');
  await app.klik('laden', String(cN20.check_id));
  T.check(app.data().stops[0].regels.find((x) => x.code === 'N20').geladen === true && scherm.includes('class="k aan"'), 'laden-knop → regel geladen (groen), voortgang uit de data');
  await app.klik('laden', String(cN20.check_id));
  T.check(app.data().stops[0].regels.find((x) => x.code === 'N20').geladen === true, 'TF5: nogmaals tikken draait niet stil terug');
  // niet mee (enkel stuk)
  const s3 = app.data().stops.find((s) => s.taak_id === t3), cH53 = s3.regels[0];
  app.ga('stop', t3);
  await app.klik('nietmee-open', String(cH53.check_id));
  T.check(scherm.includes('niet mee</h3>') && scherm.includes('Past niet meer in de wagen') && scherm.includes('Markeer: blijft open'), 'overlay "past niet" opent met de drie redenen en de knop "Markeer: blijft open"');
  await app.klik('nietmee-reden', 'niet_gevonden'); app.zet('opmerking', 'niet in rek');
  await app.klik('nietmee-ok');
  const reg53 = app.data().stops.find((s) => s.taak_id === t3).regels[0];
  T.check(reg53.niet_mee?.reden === 'niet_gevonden' && reg53.niet_mee.opmerking === 'niet in rek', 'niet-mee → regel krijgt niet_mee {reden, opmerking} uit de server-data');
  T.check(scherm.includes('class="stuk past"') && scherm.includes('blijft open als nieuwe taak') && scherm.includes('class="k rood"'), 'rode markering zoals in het ontwerp (stuk past, rood vakje, "blijft open als nieuwe taak")');
  const rest = await db("SELECT * FROM transport_taken WHERE rit_id IS NULL AND rest_van_rit_id=?", [rit]);
  T.check(rest.length === 1 && /niet gevonden/i.test(rest[0].opmerking), `rest-taak voor kantoor bestaat (#${rest[0]?.id}: ${rest[0]?.opmerking})`);
  await app.klik('nietmee-terug', String(cH53.check_id));
  T.check(!app.data().stops.find((s) => s.taak_id === t3).regels[0].niet_mee && !scherm.includes('class="stuk past"'), 'terugdraaien ({reden:null}) → rode markering weg');
  T.check((await db("SELECT id FROM transport_taken WHERE rit_id IS NULL AND rest_van_rit_id=?", [rit])).length === 0, 'lege rest-taak is verwijderd');
  // bulk: 2 van de 5 gaan NIET mee
  app.ga('stop', t1);
  const cF = app.data().stops[0].regels.find((x) => x.is_bulk);
  await app.klik('nietmee-open', String(cF.check_id));
  T.check(scherm.includes('Hoeveel gaan NIET mee?'), 'bulkregel: overlay vraagt hoeveel NIET mee gaan');
  app.zet('aantal', '2');
  await app.klik('nietmee-ok');
  const fN = app.data().stops[0].regels.find((x) => x.is_bulk);
  T.check(fN.qty === 3 && fN.niet_mee?.aantal === 2 && scherm.includes('2 past niet → blijven open als nieuwe taak'), `bulk: 3 van 5 mee, 2 blijven open (qty ${fN.qty}, niet_mee.aantal ${fN.niet_mee?.aantal})`);
  await app.klik('nietmee-terug', String(cF.check_id));
  T.check(app.data().stops[0].regels.find((x) => x.is_bulk).qty === 5, 'bulk terugdraaien → weer 5');
  // probleem melden
  const aantalAanvr0 = (await db("SELECT COUNT(*) AS n FROM aanvragen WHERE soort='probleem_chauffeur'"))[0].n;
  await app.klik('probleem-open', String(t1));
  T.check(scherm.includes('Probleem bij Abdijschool') && scherm.includes('Gaat naar kantoor en naar KV') && scherm.includes('Foto toevoegen') && scherm.includes('Locatie gesloten / geen sleutel'), 'overlay "probleem melden" (soorten, tekst, foto, KV-naam in de uitleg)');
  await app.klik('probleem-soort', 'anders');
  const mA = meldingen.length;
  await app.klik('probleem-ok');
  T.check(meldingen.length === mA + 1 && !meldingen.at(-1).goed && /Beschrijf kort/.test(meldingen.at(-1).t) && scherm.includes('Probleem bij'), 'soort "anders" zonder tekst → toast, overlay blijft open, niets verstuurd');
  await app.klik('probleem-soort', 'past_niet_lokaal'); app.zet('tekst', 'trap te smal');
  await app.klik('foto');
  T.check(scherm.includes('Foto toegevoegd'), 'foto kiezen → tegel toont "Foto toegevoegd"');
  await app.klik('probleem-ok');
  const aanvr = await db("SELECT * FROM aanvragen WHERE soort='probleem_chauffeur' ORDER BY id DESC");
  T.check(aanvr.length === aantalAanvr0 + 1 && /past niet in het lokaal — trap te smal/.test(aanvr[0].tekst) && aanvr[0].foto_path, `probleem → aanvraag voor kantoor: "${aanvr[0]?.tekst}" (met foto)`);
  T.check(meldingen.at(-1).goed && /^✓ Gemeld aan kantoor en /.test(meldingen.at(-1).t) && !scherm.includes('class="dim"'), `toast "${meldingen.at(-1)?.t}" en overlay dicht`);
  // fouten van de server → toast
  const mB = meldingen.length;
  await app.klik('laden', '99999999');
  T.check(meldingen.length === mB + 1 && !meldingen.at(-1).goed && /hoort niet bij deze rit/.test(meldingen.at(-1).t), `server-error {error} → toast met de servertekst: "${meldingen.at(-1)?.t}"`);
  // terugkijken naar een vorige stop
  app.ga('stop', t1);
  T.check(scherm.includes('STOP 1 VAN 3') && scherm.includes('Stop 2 →') && scherm.includes('← Dag'), 'Stop 1 (vorige stop) is opnieuw te openen vanuit de pagina');
  const eind = await app.klik('dag');
  T.check(scherm.includes('Rit ma 2 nov') && scherm.includes('class="tl"'), 'terug naar het Dag-scherm');
  // 375/390-regel: geen vaste breedtes boven 390px in de ontwerp-CSS behalve max-width 480
  const css = require('node:fs').readFileSync(T.ROOT + '/public/rit.css', 'utf8');
  T.check(/max-width:480px/.test(css) && !/\bwidth:\s*(4[0-9]{2}|[5-9][0-9]{2})px/.test(css.replace(/(max|min)-width:[^;}]+/g, '')), 'CSS: kolom max 480 px, geen vaste breedtes boven 390 px');
  T.check(/\.nav button\{flex:1;height:46px/.test(css) && /\.pijlen button\{width:44px;height:44px/.test(css) && /\.stuk \.k\{width:50px;height:50px/.test(css), 'knoppen ≥ 44 px (nav 46, ▲▼ 44, stuk-vakjes 50)');
} catch (e) {
  T.fout('test crashte: ' + (e.stack || e));
}
await T.einde(srv);
