// test-me1-meldingen.mjs — ME1 (chat C): meldingen met echte bronnen, rit op naam, back-ups apart, standaard tijden. Eigen server (poort 3369, herfst-test.db).
// Maten op 390 px zijn in de browser gemeten (geen DOM in node): zie het verslag.
import * as T from './_testhulp.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: parseInt(process.env.TEST_POORT || '3369') });
const BASIC = 'Basic ' + Buffer.from('sporty:' + T.APP_PASSWORD).toString('base64');
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const P = (m, p, b) => T.api(srv.base, null, m, p, b);
  const pers = async (naam, rol, pin) => { const x = (await A('POST', '/api/personeel', { naam, rol })).json; await A('POST', `/api/personeel/${x.id}/pincode`, { pincode: pin }); return { id: x.id, tok: (await P('POST', '/api/login', { persoon_id: x.id, pincode: pin })).json.token }; };
  const jan = await pers('Me Jan', 'chauffeur', '5101'), lot = await pers('Me Lotte', 'coordinator', '5102'), an = await pers('Me Anna', 'coordinator', '5103');
  const voor = (t) => T.api(srv.base, t, 'GET', '/api/meldingen').then((r) => r.json);
  const nieuw = async (t, re) => (await voor(t)).meldingen.filter((m) => re.test(m.tekst));
  const K1 = ijk.kampmomenten.betekom;
  // ── KV ──
  const kv = await T.kvToken(srv.base, tok, K1);
  await P('POST', `/api/kv/${kv}/aanvraag`, { tekst: 'tape Me1', aantal: 2 }).then(async (r) => { if (r.status === 404) await P('POST', `/api/kv/${kv}/materiaal`, { tekst: 'tape Me1', aantal: 2 }); });
  let m = await nieuw(tok, /tape Me1/);
  T.check(m.length === 1 && m[0].link, `KV-aanvraag → precies één melding voor kantoor: "${m[0] && m[0].titel}"`);
  T.check((await nieuw(jan.tok, /tape Me1/)).length === 0, 'chauffeur ziet die melding van kantoor niet');
  await P('POST', `/api/kv/${kv}/kapot`, { tekst: 'oven Me1' });
  T.check((await nieuw(tok, /oven Me1/)).length === 1, 'KV-kapot → één melding voor kantoor');
  const d0 = (await P('GET', `/api/kv/${kv}/data`)).json, bk = d0.bakken[0];
  await P('POST', `/api/kv/${kv}/bakken/${bk.id}/tellen`, { regels: [{ item_id: bk.items[0].id, aangetroffen: 1 }] });
  await P('POST', `/api/kv/${kv}/versturen`, {});
  T.check((await nieuw(tok, /Telling verstuurd/)).length === 1, 'KV-telling verstuurd → één melding voor kantoor');
  await P('POST', `/api/kv/${kv}/versturen`, {});
  T.check((await nieuw(tok, /Telling verstuurd/)).length === 1, 'nog eens versturen → geen dubbel');
  // ── aanvraag beslist ──
  const av = (await A('GET', '/api/aanvragen')).json.find((a) => /tape Me1/.test(a.tekst));
  await A('PUT', `/api/aanvragen/${av.id}/status`, { status: 'goedgekeurd' });
  T.check((await nieuw(lot.tok, /tape Me1.*goedgekeurd/)).length === 1 && (await nieuw(an.tok, /tape Me1.*goedgekeurd/)).length === 1 && (await nieuw(jan.tok, /goedgekeurd/)).length === 0, 'aanvraag beslist → de coördinatoren, niet de chauffeur');
  // gelezen per persoon
  const mid = (await nieuw(lot.tok, /goedgekeurd/))[0].id, voorT = (await voor(lot.tok)).ongelezen;
  T.check((await T.api(srv.base, lot.tok, 'POST', `/api/meldingen/${mid}/gelezen`)).status === 200 && (await voor(lot.tok)).ongelezen === voorT - 1, 'gelezen haalt ze uit de teller');
  T.check((await nieuw(an.tok, /goedgekeurd/))[0].gelezen === false, 'de andere coördinator heeft ze nog ongelezen');
  // ── rit: chauffeur meldt, gewijzigd, op naam ──
  const gen = (await A('POST', '/api/transport-genereer')).json;
  const v = gen.find((x) => x.type === 'levering');
  const { ritId, taakId } = await T.voorstelNaarRit(srv.base, tok, v, { chauffeur: { id: jan.id, naam: 'Me Jan' } });
  const rt = await T.ritToken(srv.base, tok, ritId);
  await P('POST', `/api/rit-token/${rt}/taken/${taakId}/probleem`, { soort: 'gesloten', tekst: 'deur Me1' });
  T.check((await nieuw(tok, /deur Me1/)).length === 1 && (await nieuw(lot.tok, /deur Me1/)).length === 0, 'chauffeur meldt iets → één melding voor kantoor');
  const ritR = (await A('GET', '/api/ritten')).json.find((r) => r.id === ritId);
  await A('POST', `/api/ritten/${ritId}/klaarzet-terug`, {}); // TF5: T.ritToken zet klaar; hier hoort de rit nog niet klaar te staan
  await A('PUT', `/api/ritten/${ritId}`, { voertuig: 'Me wagen' });
  T.check((await nieuw(jan.tok, /is gewijzigd/)).length === 0, 'rit gewijzigd die nog niet klaarstond → geen melding');
  await A('POST', `/api/ritten/${ritId}/klaarzet`, {});
  await A('PUT', `/api/ritten/${ritId}`, { voertuig: 'Me wagen 2' });
  T.check((await nieuw(jan.tok, /is gewijzigd/)).length === 1 && (await nieuw(lot.tok, /is gewijzigd/)).length === 0, 'rit gewijzigd die klaarstond → één melding voor de bestuurder');
  await A('PUT', `/api/ritten/${ritId}`, { voertuig: 'Me wagen 3' });
  T.check((await nieuw(jan.tok, /is gewijzigd/)).length === 1, 'nog een wijziging, nog ongelezen → geen dubbel');
  // verhuistaak + bestelling binnen
  const PER = 1, sporten = (await A('GET', `/api/sportrooster/week?periode_id=${PER}&week=4`)).json.sporten, H = sporten.find((x) => x.sets >= 2);
  const L = (await T.leesDb(srv.dbPad, "SELECT id FROM locaties WHERE type='kamp' ORDER BY id LIMIT 4")).map((x) => x.id);
  const planV = async (w) => { await A('POST', '/api/sportrooster/plan', { periode_id: PER, week: w, soort: H.soort, locatie_id: L[0], dag_van: 1, dag_tot: 3 }); await A('POST', '/api/sportrooster/plan', { periode_id: PER, week: w, soort: H.soort, locatie_id: L[1], dag_van: 4, dag_tot: 5 }); return (await A('GET', '/api/transport-taken')).json.filter((t) => (t.categorie || '').startsWith('sv:') && t.week === w); };
  const v4 = await planV(4);
  T.check(v4[0] && v4[0].tijd === '17:00', `verhuistaak zonder tijd_verhuis_avond: ${v4[0] && v4[0].tijd}`);
  await A('PUT', `/api/sportrooster/verhuis/${v4[0].id}`, { wie_id: jan.id });
  T.check((await nieuw(jan.tok, /Verhuistaak voor jou/)).length === 1, 'verhuistaak toegewezen → één melding voor die persoon');
  await A('PUT', '/api/instellingen/tijden', { tijd_verhuis_avond: '19:30' });
  const v5 = await planV(5);
  T.check(v5[0] && v5[0].tijd === '19:30', `verhuistaak met tijd_verhuis_avond: ${v5[0] && v5[0].tijd}`);
  const pion = (await T.leesDb(srv.dbPad, 'SELECT id FROM item_types ORDER BY id LIMIT 1'))[0].id;
  const be = await A('POST', '/api/tekorten/bestelling', { item_type_id: pion, aantal: 3, waar_kopen: 'x' });
  await A('POST', `/api/tekorten/${be.json.id || be.json.artikel_id}/binnen`);
  T.check((await nieuw(lot.tok, /Bestelling binnen/)).length === 1 && (await nieuw(jan.tok, /Bestelling binnen/)).length === 0, 'bestelling binnen → de coördinatoren');
  // ── + Bericht ──
  T.check((await T.api(srv.base, jan.tok, 'POST', '/api/meldingen', { voor_rol: 'kantoor', tekst: 'x' })).status === 403, 'niet-kantoor kan geen bericht sturen (403)');
  const br = await A('POST', '/api/meldingen', { voor_persoon_id: jan.id, tekst: 'conciërge gebeld Me1' });
  T.check(br.status === 200 && (await nieuw(jan.tok, /conciërge gebeld/)).length === 1 && (await nieuw(lot.tok, /conciërge gebeld/)).length === 0, 'kantoor stuurt een bericht aan één persoon: alleen die ziet het');
  const jm = (await nieuw(jan.tok, /conciërge/))[0];
  T.check(jm.van_naam === 'Claude (API)' && (await T.api(srv.base, lot.tok, 'POST', `/api/meldingen/${jm.id}/gelezen`)).status === 404, 'andermans melding gelezen zetten → 404');
  const wl = await T.api(srv.base, tok, 'GET', '/api/wijzigingen?tabel=meldingen&limit=5');
  T.check(wl.json.length >= 1, 'meldingen staan in de wijzigingslog');
  await A('POST', '/api/meldingen', { voor_rol: 'coordinator', tekst: 'rolbericht Me1' });
  T.check((await nieuw(an.tok, /rolbericht/)).length === 1 && (await T.api(srv.base, an.tok, 'POST', '/api/meldingen/alles-gelezen')).status === 200 && (await voor(an.tok)).ongelezen === 0, 'bericht aan een rol; alles-gelezen → teller 0');
  // mijn=1
  const jv = (await T.api(srv.base, jan.tok, 'GET', `/api/vandaag?mijn=1&datum=${ritR.datum}`)).json;
  T.check(jv.tellers.meldingen === jv.meldingen.length && jv.meldingen.some((x) => /conciërge/.test(x.titel)) && jv.meldingen[0].titel, `mijn=1: ongelezen in "meldingen" (${jv.meldingen.length}), tabteller gelijk`);
  // verhuistaak + binnen via de routes
  const NAV = require(T.ROOT + '/public/nav.js');
  T.check(NAV.tabsVan('chauffeur').find((t) => t[0] === 'meldingen')[3] === '/meldingen' && NAV.actieveTab('kantoor', '/meldingen') === 'meldingen' && NAV.magOpGsm('chauffeur', '/meldingen'), 'tab Meldingen → /meldingen');
  const pg = await fetch(srv.base + '/meldingen', { headers: { authorization: BASIC } });
  T.check(pg.status === 200, 'GET /meldingen 200');
  const MB = require(T.ROOT + '/public/meldingen.js');
  const h = MB.html({ ongelezen: 1, meldingen: [{ id: 1, titel: 'A: b', created_at: new Date().toISOString(), gelezen: false, link: '/x' }, { id: 2, titel: 'C', created_at: new Date(Date.now() - 864e5).toISOString(), gelezen: true }] }, true);
  T.check(/melding nieuw/.test(h) && /Vandaag/.test(h) && /Gisteren/.test(h) && /\+ Bericht/.test(h) && !/\+ Bericht/.test(MB.html({ ongelezen: 0, meldingen: [] }, false)), 'pagina: per dag, ongelezen gemarkeerd, + Bericht alleen kantoor');
  // ── punt 2 ──
  const r2 = (await A('POST', '/api/ritten', { datum: ritR.datum, chauffeur: 'me JAN', opmerking: 'op naam' })).json;
  const r3 = (await A('POST', '/api/ritten', { datum: ritR.datum, chauffeur: 'Onbekend Me', opmerking: 'x' })).json;
  await A('POST', `/api/ritten/${r2.id}/klaarzet`, {}); await A('POST', `/api/ritten/${r3.id}/klaarzet`, {}); // TF5: pas na klaarzetten zichtbaar
  const jv2 = (await T.api(srv.base, jan.tok, 'GET', `/api/vandaag?mijn=1&datum=${ritR.datum}`)).json;
  T.check(jv2.ritten_vandaag.some((r) => r.id === r2.id) && !jv2.ritten_vandaag.some((r) => r.id === r3.id), 'rit op naam (hoofdletterongevoelig) verschijnt in Vandaag; onbekende naam niet');
  T.check(!(await T.leesDb(srv.dbPad, 'SELECT personeel_id FROM transport_ritten WHERE id=?', [r2.id]))[0]?.personeel_id, 'niets automatisch overschreven (personeel_id blijft leeg)');
  const wk = (await A('GET', `/api/ritplanning?week=${ritR.datum}`)).json;
  const alle = wk.dagen.flatMap((d) => d.ritten);
  const zk = (id) => alle.find((r) => r.id === id);
  T.check(zk(r3.id) && zk(r3.id).waarschuwingen.some((w) => /bestuurder niet gekoppeld/.test(w)) && !zk(r2.id).waarschuwingen.some((w) => /niet gekoppeld/.test(w)) && !zk(ritId).waarschuwingen.some((w) => /niet gekoppeld/.test(w)), 'ritplanning: ⚠ bestuurder niet gekoppeld alleen bij de onbekende naam');
  // ── punt 3 ──
  const BK = path.join(srv.dataDir, 'backups');
  const auto = () => fs.readdirSync(BK).filter((f) => /^sporty-\d{4}-\d{2}-\d{2}\.db$/.test(f));
  for (let i = 1; i <= 13; i++) fs.writeFileSync(path.join(BK, `sporty-2026-02-${String(i).padStart(2, '0')}.db`), 'SQLite format 3\0');
  const nA = auto().length;
  const namen = [];
  for (let i = 0; i < 20; i++) namen.push((await A('POST', '/api/backups/nu')).json.naam);
  T.check(new Set(namen).size === 20 && auto().length === nA && nA === 14 && namen.every((n) => /^sporty-hand-/.test(n)), `20 handmatige back-ups (${new Set(namen).size} namen) duwen geen automatische weg (${nA} → ${auto().length})`);
  for (let i = 0; i < 12; i++) await A('POST', '/api/backups/nu');
  const hand = fs.readdirSync(BK).filter((f) => /^sporty-hand-/.test(f));
  T.check(hand.length === 30, `maximaal 30 handmatige (${hand.length})`);
  const lijst = (await A('GET', '/api/backups')).json.backups;
  T.check(lijst.filter((b) => b.soort === 'handmatig').length === 30 && lijst.filter((b) => b.soort === 'automatisch').length === 14, 'lijst: 30 handmatig, 14 automatisch');
  // tijden
  T.check((await A('POST', '/api/ritten', { datum: '2026-11-03', opmerking: 't' })).json.vertrek == null || !(await A('POST', '/api/ritten', { datum: '2026-11-03' })).json.vertrek, 'zonder tijd_vertrek_ritten: geen begintijd (oud gedrag)');
  const pz = (await A('GET', `/api/ritplanning?week=${ritR.datum}`)).json;
  T.check(pz.standaard_vertrek === '', 'ritplanning-data zonder standaard: leeg (formulier blijft 08:00)');
  await A('PUT', '/api/instellingen/tijden', { tijd_vertrek_ritten: '07:15' });
  const met = (await A('POST', '/api/ritten', { datum: '2026-11-03' })).json;
  T.check(met.vertrek === '07:15' && (await A('GET', `/api/ritplanning?week=${ritR.datum}`)).json.standaard_vertrek === '07:15', 'met tijd_vertrek_ritten 07:15: begintijd bij Nieuwe rit');
  const expl = (await A('POST', '/api/ritten', { datum: '2026-11-03', vertrek: '09:45' })).json;
  T.check(expl.vertrek === '09:45', 'een gekozen vertrek wint');
  // herstel: laatst, server herstart
  const voorN = fs.readdirSync(BK).length;
  const buf = fs.readFileSync(path.join(BK, namen[namen.length - 1] && fs.readdirSync(BK).find((f) => /^sporty-hand-/.test(f))));
  const hr = await fetch(srv.base + '/api/herstel-db', { method: 'POST', headers: { authorization: BASIC, 'x-auth-token': tok, 'content-type': 'application/octet-stream', 'x-bevestig': 'TERUGZETTEN' }, body: buf });
  const naH = fs.readdirSync(BK);
  T.check(hr.status === 200 && !naH.some((f) => /^voor-herstel/.test(f)) && naH.filter((f) => /^sporty-hand-/.test(f)).length === 30 && voorN >= 44, 'herstel: één zichtbare back-up (in de lijst), geen voor-herstel-kopie meer');
} catch (e) { T.fout('uitzondering: ' + e.stack); }
await T.einde(srv);
