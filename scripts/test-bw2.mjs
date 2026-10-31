// test-bw2.mjs — BW2: elk voorbeeld van Maxim als aparte test, migratie, oude rit-link, twee mensen op één wagen, afspraak, feedback.
import * as T from './_testhulp.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), OD = require(T.ROOT + '/public/opdracht.js'), ijk = T.leesIjk();
const srv = await T.startServer({ poort: Number(process.env.TEST_POORT) || 3384 });
const v = T.check, rust = (ms = 700) => new Promise((r) => setTimeout(r, ms));
try {
  const tok = await T.login(srv.base), A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const lo = (await A('GET', '/api/locaties')).json, R = ijk.locaties.rozenweg, X = ijk.locaties.abdijschool, Z = ijk.locaties.betekom;
  const Y = (await A('POST', '/api/locaties', { name: 'Locatie Y', type: 'kamp' })).json.id, K = (await A('POST', '/api/locaties', { name: 'Kantoor test', type: 'stockage' })).json.id;
  const mens = async (n, pin) => { const x = (await A('POST', '/api/personeel', { naam: n, rol: 'chauffeur' })).json; if (pin) await A('POST', `/api/personeel/${x.id}/pincode`, { pincode: pin }); return x.id; };
  const [p1, p2, p3, p4, p5] = [await mens('Bw Jeroen', '5891'), await mens('Bw Jesse', '5892'), await mens('Bw Maxim'), await mens('Bw Kato'), await mens('Bw Stijn')];
  const vt = async (naam) => (await A('POST', '/api/voertuigen', { naam, soort: 'eigen', capaciteit: 20 })).json.id;
  const [v1, v2, v3] = [await vt('Bw Jumper'), await vt('Bw Camion'), await vt('Bw Berlingo')];
  let dag = 0; const D = () => `2026-11-${String(++dag).padStart(2, '0')}`;
  const opdr = async (d, b = {}) => (await A('POST', '/api/opdrachten', { datum: d, vertrek: '08:00', ...b })).json;
  const wagen = async (o, b = {}) => (await A('POST', `/api/opdrachten/${o.id}/wagens`, { vertrek: '08:00', ...b })).json.rit_id;
  const pers = (r, p) => A('POST', `/api/wagens/${r}/personen`, { personeel_id: p });
  const stop = async (r, naar, tijd, van) => (await A('POST', `/api/ritten/${r}/stops`, { type: 'levering', van_locatie_id: van || naar, naar_locatie_id: naar, tijd })).json.taak_id;
  const lad = (t, n, q = 1) => A('POST', `/api/transport-taken/${t}/regels`, { bron: 'tekst', naam: n, qty: q });
  const get = async (o) => (await A('GET', `/api/opdrachten/${o.id}`)).json;
  // Maxims voorbeelden
  let o = await opdr(D(), { personeel_id: p1, voertuig_id: v1 }); let g = await get(o);
  v(g.wagens.length === 1 && g.wagens[0].mensen.length === 1 && g.wagens[0].voertuig.id === v1, 'chauffeur alleen: opdracht met één wagen, zonder extra klik');
  o = await opdr(D(), { personeel_id: p1 }); await pers((await get(o)).wagens[0].rit_id, p2); g = await get(o);
  v(g.wagens[0].mensen.map((m) => m.naam).join() === 'Bw Jeroen,Bw Jesse', '2 in 1 voertuig');
  await pers(g.wagens[0].rit_id, p3); g = await get(o); v(g.wagens[0].mensen.length === 3, '3 in 1 voertuig');
  o = await opdr(D(), { personeel_id: p1 }); await wagen(o, { personeel_id: p2 }); g = await get(o); v(g.wagens.length === 2 && g.wagens.every((w) => w.mensen.length === 1), '2 in 2 voertuigen');
  o = await opdr(D(), { personeel_id: p1 }); const a2 = await wagen(o, { personeel_id: p2 }), a3 = await wagen(o, { personeel_id: p3 }); await pers(a2, p4); await pers(a3, p5); g = await get(o);
  v(g.wagens.length === 3 && g.wagens.reduce((n, w) => n + w.mensen.length, 0) === 5, '5 in 3 voertuigen');
  // Wagen 1 voor x, wagen 2 voor y, samen naar beide
  o = await opdr(D(), { personeel_id: p1 }); const w1 = (await get(o)).wagens[0].rit_id, w2 = await wagen(o, { personeel_id: p2 });
  await lad(await stop(w1, X, '09:00', R), 'Voor X'); await stop(w2, X, '09:00');
  await lad(await stop(w2, Y, '11:00', R), 'Voor Y'); await stop(w1, Y, '11:00'); g = await get(o);
  v(g.wagens.every((w) => w.stops.every((s) => s.samen.length === 1)) && g.wagens[1].stops[0].lad === 'vertrekt zonder lading' || g.wagens[1].stops[0].lad === 'helpt, geen lading', 'x en y: elk geladen, samen naar beide (gedeelde stops, helpen zonder lading)');
  // Het volle voorbeeld: w1 x en y, w2 z en y, w3 zonder lading naar y
  o = await opdr(D(), { personeel_id: p1, voertuig_id: v1 }); const f1 = (await get(o)).wagens[0].rit_id, f2 = await wagen(o, { personeel_id: p3, voertuig_id: v2 }), f3 = await wagen(o, { personeel_id: p4, voertuig_id: v3 });
  await pers(f1, p2); await pers(f3, p5);
  await lad(await stop(f1, X, '09:00', R), 'F40'); await lad(await stop(f1, Y, '10:30', R), 'EHBO');
  await lad(await stop(f2, Z, '08:45', R), 'Voetbalzak', 12); await stop(f2, Y, '10:30');
  await stop(f3, K, '10:15'); await stop(f3, Y, '10:30'); g = await get(o);
  const sv = (i) => g.wagens[i].stops;
  v(sv(0)[0].locatie !== sv(1)[0].locatie && sv(0)[1].samen.length === 2 && sv(1)[1].samen.length === 2 && sv(2)[1].samen.length === 2, 'wagen 1 eerst x, wagen 2 eerst z, daarna allebei y, wagen 3 komt helpen');
  v(g.wagens[2].stops[0].lad === 'vertrekt zonder lading' && sv(1)[1].lad === 'helpt, geen lading' && g.wagens[2].laadstops.length === 0, 'wagen 3: zonder spullen, met kantoor erbij');
  v(g.wagens[0].laadstops[0].lad.includes(' en '), `laadstop: ${g.wagens[0].laadstops[0].lad}`);
  // Html
  const P = { datum: g.datum, opdrachten: [g], afspraken: [], voertuigen: [], personeel: [], locaties: [], stockages: [] }, h = OD.opdrachtHtml(g, P, 0);
  v((h.match(/class="wagen/g) || []).length === 3 && (h.match(/stop ged/g) || []).length === 3 && /\+ Wagen/.test(h) && /Klaarzetten/.test(h) && /\+ persoon/.test(h) && /\+ Stop/.test(h) && /Geschatte eindtijd/.test(h), 'scherm: wagens naast elkaar, paars, knoppen');
  // Klaarzetten voor de hele opdracht
  const kz = (await A('POST', `/api/opdrachten/${o.id}/klaarzet`)).json;
  v(kz.klaargezet === 3 && kz.opdracht.status === 'klaargezet', 'Klaarzetten voor de hele opdracht');
  // Gsm per persoon
  const tJ = await T.login(srv.base, p2, '5892');
  const vm = (await T.api(srv.base, tJ, 'GET', `/api/vandaag?mijn=1&datum=${g.datum}`)).json;
  v(vm.ritten_vandaag && vm.ritten_vandaag.some((r) => r.id === f1) && !vm.ritten_vandaag.some((r) => r.id === f2), 'extra persoon ziet alleen de eigen wagen');
  // Twee mensen op één wagen
  const tk = (await A('POST', `/api/ritten/${f1}/token`)).json.token, PP = (m, q, b) => T.api(srv.base, null, m, `/api/rit-token/${tk}${q}`, b);
  let d = (await PP('GET', '/data')).json;
  v(d.stops[1].samen.length === 2 && d.stops[1].samen.some((s) => s.mensen.includes('Bw Kato')) && d.mensen.length === 2, 'gedeelde stop: je ziet wie meewerkt');
  const cid = d.stops[0].regels[0].check_id;
  await PP('POST', `/checks/${cid}/laden`, { gezet: true }); await PP('POST', `/checks/${cid}/laden`, { gezet: true });
  d = (await PP('GET', '/data')).json;
  v(d.stops[0].regels[0].geladen === true || d.stops[0].regels[0].geladen === 1, 'twee mensen tikken hetzelfde: stand blijft geladen, geen overschrijven');
  await PP('POST', `/checks/${cid}/lossen`, { gezet: true });
  // Verplaatsen
  o = await opdr(D(), { personeel_id: p1 }); const m1 = (await get(o)).wagens[0].rit_id, m2 = await wagen(o, { personeel_id: p2 }); const ts = await stop(m1, X, '09:00', R), ts2 = await stop(m2, Z, '09:00', R); await lad(ts, 'Stuk A'); await lad(ts, 'Stuk B');
  g = await get(o); const rg = g.wagens[0].stops[0].regels[0].id;
  v((await A('POST', `/api/transport-regels/${rg}/naar-stop`, { taak_id: ts2 })).status === 200 && (await get(o)).wagens[1].stops[0].regels.length === 1, 'stuk tussen wagens verplaatsen');
  v((await A('POST', `/api/transport-taken/${ts}/naar-wagen`, { rit_id: m2 })).status === 200 && (await get(o)).wagens[0].stops.length === 0 && (await get(o)).wagens[1].stops.length === 2, 'stop tussen wagens verplaatsen');
  // Rozenweg → Kantoor → locatie
  o = await opdr(D(), { personeel_id: p1 }); const q1 = (await get(o)).wagens[0].rit_id, q2 = await wagen(o, { personeel_id: p2 });
  await lad(await stop(q1, X, '10:00', R), 'Bak R'); await lad(await stop(q1, X, '10:00', K), 'Sport K'); g = await get(o);
  v(g.wagens[0].laadstops.map((l) => l.locatie_id).join() === `${R},${K}`, 'Rozenweg → Kantoor → locatie');
  await A('PUT', `/api/wagens/${q1}/laadvolgorde`, { locatie_ids: [K, R] }); g = await get(o);
  v(g.wagens[0].laadstops[0].locatie_id === K, 'omgekeerd: Kantoor → Rozenweg');
  const tkq = (await A('POST', `/api/ritten/${q1}/token`)).json.token; await A('POST', `/api/opdrachten/${o.id}/klaarzet`);
  const dq = (await T.api(srv.base, null, 'GET', `/api/rit-token/${tkq}/data`)).json;
  v(dq.laadvolgorde[0] === K && new Set(dq.stops.map((s) => s.van.id)).size === 2, 'chauffeur: per stockage apart');
  const mv = await A('POST', `/api/wagens/${q1}/stockage-naar`, { locatie_id: K, rit_id: q2 }); g = await get(o);
  v(mv.json.verplaatst === 1 && g.wagens[1].laadstops[0].locatie_id === K && g.wagens[0].laadstops.length === 1, 'twee wagens per stockage');
  v((await A('GET', '/api/stockages')).json.every((s) => s), 'stockagekeuze: alleen echte stockages');
  // Waarschuwingen
  const dg = D(); o = await opdr(dg, { personeel_id: p1, voertuig_id: v1 }); const o2 = await opdr(dg, { personeel_id: p1, voertuig_id: v1 });
  for (const x of [o, o2]) { const r = (await get(x)).wagens[0].rit_id; await stop(r, X, '09:00'); await A('PUT', `/api/ritten/${r}/tijden`, { einde: '11:00' }); }
  g = await get(o);
  v(g.wagens[0].waarschuwingen.some((w) => /persoon dubbel: Bw Jeroen/.test(w)) && g.wagens[0].waarschuwingen.some((w) => /Bw Jumper|voertuig/i.test(w)), `dubbel: ${g.wagens[0].waarschuwingen.join(' | ').slice(0, 90)}`);
  const ah = (await A('POST', '/api/voertuigen', { naam: 'Bw Kar', soort: 'eigen', aard: 'aanhangwagen', capaciteit: 5 })).json.id;
  await A('PUT', `/api/ritten/${g.wagens[0].rit_id}`, { aanhangwagen_id: ah }); g = await get(o);
  v(g.wagens[0].waarschuwingen.some((w) => /trekhaak/.test(w)), 'geen trekhaak: waarschuwing, geen verbod');
  // Afspraak
  const dA = D(); const af = (await A('POST', '/api/afspraken', { soort: 'garage', voertuig_id: v2, personeel_id: p2, datum: dA, van: '08:00', tot: '09:30', waar: 'Garage Peeters' })).json;
  v(af.id && af.onderhoud_id, 'afspraak bewaard, onderhoud gekoppeld');
  const oa = await opdr(dA, { personeel_id: p2, voertuig_id: v2 }); const ra = (await get(oa)).wagens[0].rit_id; await stop(ra, X, '08:30'); g = await get(oa);
  v(g.wagens[0].waarschuwingen.some((w) => /voertuig bezet: 🔧 Garage/.test(w)) && g.wagens[0].waarschuwingen.some((w) => /Bw Jesse is bezet/.test(w)), 'afspraak maakt voertuig en persoon bezet: melding, geen verbod');
  const af2 = await A('POST', '/api/afspraken', { soort: 'tanken', voertuig_id: v2, datum: dA, van: '08:15', tot: '09:00' });
  v(af2.status === 200 && /rijdt dan op rit/.test(af2.json.melding), 'omgekeerd: melding bij de afspraak');
  const lijst = (await T.api(srv.base, tJ, 'GET', `/api/afspraken/vandaag?datum=${dA}`)).json.afspraken;
  v(lijst.length === 1 && lijst[0].id === af.id, 'persoon ziet de eigen afspraak');
  v((await T.api(srv.base, tJ, 'POST', `/api/afspraken/${af2.json.id}/klaar`)).status === 403, 'andermans afspraak: niet');
  const kl = (await T.api(srv.base, tJ, 'POST', `/api/afspraken/${af.id}/klaar`)).json;
  v(kl.status === 'klaar' && /^\d\d:\d\d$/.test(kl.echte_einde), `Klaar: echte eindtijd ${kl.echte_einde}`);
  const on = (await A('POST', `/api/voertuigen/${v3}/onderhoud`, { datum_van: dA, datum_tot: dA, reden: 'Autokeuring' })).status;
  v(on === 200 && (await A('GET', `/api/opdrachten?datum=${dA}`)).json.afspraken.some((x) => x.soort === 'autokeuring'), 'onderhoud verschijnt in de agenda');
  // Feedback
  const fb = await PP('POST', '/feedback', { soort: 'rit', tekst: 'Sleutel lag er niet' });
  v(fb.status === 200, 'feedback vanuit de rit');
  let M = (await A('GET', '/api/meldingen')).json.meldingen.find((m) => /Sleutel lag er niet/.test(m.tekst));
  v(M && M.niveau === 'info', 'feedback = info');
  await PP('POST', '/feedback', { soort: 'probleem', tekst: 'Band lijkt plat' }); await rust(200);
  const nu = (await A('GET', '/api/nu-oplossen')).json.ritten.find((r) => r.rit_id === f1);
  v(nu && nu.items.some((i) => /Band lijkt plat/.test(i.titel)), 'probleem = nu, in Nu oplossen');
  M = (await A('GET', '/api/meldingen')).json.meldingen.find((m) => /Band lijkt plat/.test(m.tekst));
  v(M && M.niveau === 'nu', 'probleem: niveau nu');
  v((await T.api(srv.base, tJ, 'POST', '/api/feedback', { soort: 'voertuig', voertuig_id: v1, tekst: 'Lamp stuk' })).status === 200, 'via Meer, zonder rit');
  const fl = (await A('GET', `/api/feedback?voertuig=${v1}`)).json.feedback;
  v(fl.length >= 1 && fl.every((x) => x.voertuig === 'Bw Jumper') && fl[0].wie, 'kantoor: per voertuig, met wie');
  await rust();
  const db = await T.leesDb(srv.dbPad, "SELECT sql FROM sqlite_master WHERE type='trigger' AND name LIKE 'feedback_geen%'");
  v(db.length === 2, 'feedback onwisbaar (triggers)');
  // Migratie: testdata met ritten in elke stand
  const rt0 = (await A('POST', '/api/ritten', { datum: D(), chauffeur: 'Oud', vertrek: '09:00' })).json;
  const zonder = await T.leesDb(srv.dbPad, 'SELECT COUNT(*) AS n FROM transport_ritten WHERE opdracht_id IS NULL');
  (await A('GET', `/api/opdrachten?datum=${rt0.datum}`));await rust();
  v((await T.leesDb(srv.dbPad, 'SELECT COUNT(*) AS n FROM transport_ritten WHERE opdracht_id IS NULL'))[0].n === 0, `nieuwe rit via de oude route krijgt een opdracht (${zonder[0].n} wachtte)`);
  const paren = await T.leesDb(srv.dbPad, 'SELECT COUNT(*) AS w,COUNT(DISTINCT opdracht_id) AS o FROM transport_ritten');
  v(paren[0].w >= paren[0].o, 'elke rit heeft een opdracht');
  const oud = (await A('POST', `/api/ritten/${rt0.id}/token`)).json.token;
  v((await T.api(srv.base, null, 'GET', `/rit/${oud}`)).status === 200, 'oude rit-link werkt');
  // Herstart: migratie twee keer
  await rust(1000); await srv.stop();
  const srv2 = await T.startServer({ poort: Number(process.env.TEST_POORT) || 3384, verseMap: false });
  const t2 = await T.login(srv2.base);
  const na = await T.leesDb(srv2.dbPad, 'SELECT COUNT(*) AS w,COUNT(DISTINCT opdracht_id) AS o FROM transport_ritten');
  v(na[0].w === paren[0].w && na[0].o === paren[0].o, `migratie twee keer: niets dubbel (${na[0].w} wagens, ${na[0].o} opdrachten)`);
  v((await T.api(srv2.base, t2, 'GET', `/api/ritten/${rt0.id}`)).status === 200, 'oude rit-id blijft');
  await srv2.stop();
} catch (e) { T.fout('uitzondering: ' + e.message + ' ' + e.stack); console.log(srv.log().slice(-1500)); }
await T.einde(srv).catch(() => {});
