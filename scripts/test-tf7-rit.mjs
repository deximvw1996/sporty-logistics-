// test-tf7-rit.mjs — TF7 punt 1 en 2: geen capaciteitsgok, vroeger afwerken, meldingen apart, ongedaan op afgeronde stop, één telling, laadblok per plaats.
import * as T from './_testhulp.mjs';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const RP = require(T.ROOT + '/public/rit.js');
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: Number(process.env.TEST_POORT) || 3375 });
const lees = (p) => fs.readFileSync(T.ROOT + '/' + p, 'utf8');
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const dag = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const R = ijk.locaties.rozenweg, loc = (await A('GET', '/api/locaties')).json, AB = loc.find((l) => /abdij/i.test(l.name)).id, BE = loc.find((l) => /betekom/i.test(l.name)).id;
  const ch = (await A('POST', '/api/personeel', { naam: 'Tf7 Chauffeur', rol: 'chauffeur' })).json;
  await A('POST', `/api/personeel/${ch.id}/pincode`, { pincode: '5847' });
  const C0 = await T.login(srv.base, ch.id, '5847'), C = (m, p, b) => T.api(srv.base, C0, m, p, b);
  const bak = async (code) => (await A('POST', `/api/themas/${ijk.themas.alles_op_wieltjes}/bakken`, { label: 'Tf7 ' + code, code })).json.id;
  const meld = async () => (await C('GET', '/api/meldingen')).json.meldingen.map((m) => m.tekst);

  // ── Punt 1 ──
  const b1 = await bak('TA01'), b2 = await bak('TA02');
  const v = (await A('POST', '/api/voertuigen', { naam: 'Tf7 busje', soort: 'eigen', plaatsen: 1 })).json;
  const r = (await A('POST', '/api/ritten', { datum: dag(0), vertrek: '09:00', personeel_id: ch.id, voertuig_id: v.id })).json;
  const t1 = (await A('POST', '/api/transport-taken', { type: 'levering', datum: dag(0), tijd: '09:30', van_locatie_id: R, naar_locatie_id: AB, rit_id: r.id, regels: [{ naam: 'Bak Een (TA01)', qty: 1, soort: 'thema', bak_id: b1 }, { naam: 'Bak Twee (TA02)', qty: 1, soort: 'thema', bak_id: b2 }, { naam: '36 × Pionnen', qty: 36, soort: 'pool' }] })).json;
  const k = (await A('POST', `/api/ritten/${r.id}/klaarzet`, {})).json;
  const TEKST = '2 bakken + 36 losse stuks';
  T.check(k.lading.tekst === TEKST && k.over_capaciteit === undefined, `klaarzetten met 1 "plaats": ${k.lading.tekst}, geen bevestiging`);
  const plan = (await A('GET', `/api/ritplanning?week=${dag(0)}`)).json, pr = plan.dagen.flatMap((d) => d.ritten).find((x) => x.id === r.id);
  T.check(pr.lading.tekst === TEKST && !pr.waarschuwingen.some((w) => /plaats|capaciteit|bakken op/.test(w)) && !('bezetting' in pr), 'ritplanning: dezelfde telling, geen waarschuwing');
  const vd = (await C('GET', '/api/vandaag?mijn=1')).json;
  T.check(JSON.stringify(vd).includes(TEKST) && !/\d+\/\d+ bakken/.test(JSON.stringify(vd)), 'Vandaag gsm: dezelfde telling');
  const vk = (await A('GET', `/api/voertuigen/${v.id}/detail?week=${dag(0)}`)).json, vs = JSON.stringify(vk);
  T.check(vs.includes(TEKST) && !/plaatsen`|stuks op|"over"/.test(vs) && !(vk.let_op || []).some((l) => l.soort === 'capaciteit'), 'Voertuigen: geen Let op over capaciteit');
  for (const f of ['public/ritplanning.js', 'public/voertuigen.js', 'routes/vandaag.js', 'routes/transport.js', 'routes/voertuigen.js', 'routes/ritplanning.js']) T.check(!/over_capaciteit|boven capaciteit|bakken op \$|stuks op \$|reed met/.test(lees(f)), `${f}: geen capaciteitstekst`);
  T.check(/Past ongeveer/.test(lees('public/voertuigen.js')), 'veld blijft als vrije informatie');
  T.check(vk.voertuig.plaatsen === 1, 'bestaande waarde niet gewist');

  // ── Past niet teller ──
  const x = (await A('POST', `/api/ritten/${r.id}/token`)).json.token;
  const P = (m, p, b) => T.api(srv.base, null, m, `/api/rit-token/${x}${p}`, b);
  const data = async () => (await P('GET', '/data')).json;
  let d = await data();
  const pnStuk = d.stops[0].regels.find((q) => q.code === 'TA02');
  await P('POST', `/checks/${pnStuk.check_id}/niet-mee`, { reden: 'past_niet' });
  T.check((await A('GET', `/api/ritplanning?week=${dag(0)}`)).json.past_niet === 1, 'ritplanning: teller Past niet = 1');
  T.check(/past niet · taak voor kantoor/.test(lees('public/ritplanning.js')), 'teller staat op het scherm');

  // ── Eén telling ──
  d = await data();
  const hs = RP.blokHtml(d, 'laden:' + R);
  T.check(hs.includes('(2 regels · 37 stuks)'), 'knop zegt regels en stuks');
  const ids = d.stops[0].regels.filter((q) => !q.niet_mee).map((q) => q.check_id);
  const toasts = []; let html = '';
  const app = RP.createApp({ token: x, fetch: (u, o) => fetch(srv.base + u, o), toast: (t) => toasts.push(t), mount: (h) => { html = h; } });
  await app.laad();
  await app.klik('alles-open', 'laden', ids.join(','));
  T.check(html.includes('Alles geladen: 2 regels · 37 stuks?') && html.includes('Ja, 2 regels · 37 stuks'), 'vraag noemt hetzelfde');
  await app.klik('alles-ok');
  T.check(app.staat().laatste.tekst.includes('Geladen: 2 regels · 37 stuks') && /Laatste actie ongedaan maken/.test(html), 'bevestiging noemt hetzelfde en blijft bovenaan');
  const b0 = RP.laadRegels(app.data());
  T.check(b0.gedaan === 37 && b0.totaal === 37 && /37 van 37 stuks geladen/.test(RP.dagHtml(app.data())), `blok en kop gelijk (${b0.gedaan}/${b0.totaal})`);
  app.ga('dag');
  T.check(!app.staat().laatste && !/Laatste actie/.test(html), 'Laatste actie geldt alleen voor het scherm waarop je staat');

  // ── Ongedaan op afgeronde stop ──
  app.ga('stop', t1.id);
  await app.klik('alles-open', 'lossen', ids.join(','));
  await app.klik('alles-ok');
  d = await data();
  T.check(d.stops[0].status === 'gedaan' && d.rit.status === 'gedaan', 'alles gelost: stop en rit gedaan');
  await new Promise((q) => setTimeout(q, 600));
  T.check((await T.leesDb(srv.dbPad, 'SELECT huidige_locatie_id AS h FROM bakken WHERE id=?', [b1]))[0].h === AB, 'bak op de locatie');
  await app.klik('laatste-undo');
  d = await data();
  T.check(d.stops[0].status === 'aangekomen' && d.rit.status === 'onderweg' && d.stops[0].regels.filter((q) => ids.includes(q.check_id)).every((q) => q.geladen && !q.gelost), 'ongedaan: stop en rit weer open, regels geladen, niet gelost');
  await new Promise((q) => setTimeout(q, 600));
  const bk = (await T.leesDb(srv.dbPad, 'SELECT huidige_locatie_id AS h,status FROM bakken WHERE id=?', [b1]))[0];
  T.check(bk.h !== AB && bk.status === 'onderweg', `bak terug onderweg (${bk.status})`);
  T.check(!/Stop afgerond/.test(html), 'scherm zegt hetzelfde');
  await app.klik('alles-open', 'lossen', ids.join(',')); await app.klik('alles-ok');
  d = await data();
  T.check(d.rit.status === 'gedaan', 'opnieuw lossen rondt weer af');

  // ── Vroeger mag ──
  const later = dag(3), r2 = (await A('POST', '/api/ritten', { datum: later, vertrek: '09:00', personeel_id: ch.id })).json;
  const t2 = (await A('POST', '/api/transport-taken', { type: 'levering', datum: later, tijd: '09:30', van_locatie_id: R, naar_locatie_id: AB, rit_id: r2.id, regels: [{ naam: 'Doos', qty: 1 }] })).json;
  await A('POST', `/api/ritten/${r2.id}/klaarzet`, {});
  const y = (await A('POST', `/api/ritten/${r2.id}/token`)).json.token, Y = (m, p, b) => T.api(srv.base, null, m, `/api/rit-token/${y}${p}`, b);
  const dy = (await Y('GET', '/data')).json;
  T.check(/gepland voor/.test(RP.dagHtml(dy)), 'kleine tekst "gepland voor"');
  const cy = dy.stops[0].regels[0].check_id;
  T.check((await Y('POST', `/checks/${cy}/laden`, { gezet: true })).status === 200 && (await Y('POST', `/taken/${t2.id}/aangekomen`, {})).status === 200 && (await Y('POST', `/checks/${cy}/lossen`, { gezet: true })).status === 200 && (await Y('GET', '/data')).json.rit.status === 'gedaan', 'rit dagen vroeger afgewerkt zonder vraag');

  // ── Laadblok per plaats ──
  const r3 = (await A('POST', '/api/ritten', { datum: dag(0), vertrek: '11:00', personeel_id: ch.id })).json;
  await A('POST', '/api/transport-taken', { type: 'levering', datum: dag(0), tijd: '11:30', van_locatie_id: R, naar_locatie_id: AB, rit_id: r3.id, regels: [{ naam: 'Uit Rozenweg', qty: 2 }] });
  await A('POST', '/api/transport-taken', { type: 'verhuis', datum: dag(0), tijd: '12:00', van_locatie_id: AB, naar_locatie_id: BE, rit_id: r3.id, regels: [{ naam: 'Archery A', qty: 1 }] });
  await A('POST', `/api/ritten/${r3.id}/klaarzet`, {});
  const z = (await A('POST', `/api/ritten/${r3.id}/token`)).json.token, dz = (await T.api(srv.base, null, 'GET', `/api/rit-token/${z}/data`)).json;
  const dh = RP.dagHtml(dz);
  T.check(/Laden in Rozenweg · 0 van 2 stuks/.test(dh) && /Laden in Abdijschool Vlierbeek · 0 van 1 stuk/.test(dh), 'laadblok per echte plaats');
  const rz = RP.blokHtml(dz, 'laden:' + R);
  T.check(rz.includes('Uit Rozenweg') && !rz.includes('Archery') && /voor Abdijschool/.test(rz) && /blokknop alleskop/.test(rz), 'set op een kamp niet onder Rozenweg; per regel voor welke stop; knop voor het hele blok');
  T.check(/\/vandaag/.test(RP.schermHtml({ niet_klaargezet: true, rit: { datum: dag(0) } }, { scherm: 'dag' })), 'niet-klaargezet: knop naar Vandaag');
  T.check(/vertrek 11:00/.test(dh), 'vertrektijd op de rit');
  const voeg = RP.combineer([{ check_id: 1, naam: '1 × Blazer', qty: 1, is_bulk: true }, { check_id: 2, naam: '2 × Blazer', qty: 2, is_bulk: true }]);
  T.check(voeg.length === 1 && voeg[0].naam === 'Blazer' && voeg[0].qty === 3, 'samengevoegd: juiste naam en aantal');

  // ── Meldingen ──
  await A('PUT', `/api/ritten/${r3.id}`, { voertuig: 'Wagen A' });
  await A('POST', `/api/ritten/${r3.id}/klaarzet-terug`, {});
  await A('POST', `/api/ritten/${r3.id}/klaarzet`, {});
  let ms = (await meld()).filter((m) => m.startsWith(`Rit #${r3.id} `));
  T.check(ms.some((m) => /staat voor je klaar/.test(m)) && ms.some((m) => /staat niet meer klaar/.test(m)) && ms.some((m) => /staat weer klaar/.test(m)) && ms.some((m) => /is gewijzigd/.test(m)), `meldingen blijven apart: ${ms.length}`);
  const nt = (await A('POST', '/api/transport-taken', { type: 'levering', datum: dag(0), tijd: '13:00', van_locatie_id: R, naar_locatie_id: BE, regels: [{ naam: 'X', qty: 1 }] })).json;
  await A('PUT', `/api/transport-taken/${nt.id}/rit`, { rit_id: r3.id });
  ms = (await meld()).filter((m) => m.startsWith(`Rit #${r3.id} `));
  T.check(ms.some((m) => /stop toegevoegd: Betekom/.test(m)), 'melding noemt welke stop');
  T.check(RP.verschil({ rit: {}, stops: [] }, { rit: {}, stops: [{ taak_id: 1, locatie: { naam: 'Betekom' } }] })[0] === 'stop toegevoegd: Betekom', 'balk noemt welke stop');
  const r4 = (await A('POST', '/api/ritten', { datum: dag(0), vertrek: '15:00', personeel_id: ch.id })).json;
  await A('POST', '/api/transport-taken', { type: 'levering', datum: dag(0), tijd: '15:30', van_locatie_id: R, naar_locatie_id: AB, rit_id: r4.id, regels: [{ naam: 'Y', qty: 1 }] });
  await A('POST', `/api/ritten/${r4.id}/klaarzet`, {});
  const w4 = (await A('POST', `/api/ritten/${r4.id}/token`)).json.token, d4 = (await T.api(srv.base, null, 'GET', `/api/rit-token/${w4}/data`)).json;
  await T.api(srv.base, null, 'POST', `/api/rit-token/${w4}/checks/${d4.stops[0].regels[0].check_id}/laden`, { gezet: true });
  const ander = (await A('POST', '/api/personeel', { naam: 'Tf7 Ander', rol: 'chauffeur' })).json;
  await A('PUT', `/api/ritten/${r4.id}`, { personeel_id: ander.id });
  T.check((await meld()).some((m) => m.startsWith(`Rit #${r4.id} `) && /rijd je niet meer.*zet het terug in de stockage of bel kantoor/.test(m)), '"rijd je niet meer" zegt wat er moet gebeuren');

  // ── Rest ──
  const pw = await A('PUT', `/api/transport-taken/${nt.id}`, { wie: 'Iemand' });
  T.check(pw.status === 200, `PUT met enkel wie: ${pw.status}`);
  const vaste = (await T.leesDb(srv.dbPad, 'SELECT type,van_locatie_id FROM transport_taken WHERE id=?', [nt.id]))[0];
  await new Promise((q) => setTimeout(q, 500));
  T.check(vaste.type === 'levering', 'andere velden blijven staan');
  const r5 = (await A('POST', '/api/ritten', { datum: dag(1), vertrek: '09:00', personeel_id: ch.id })).json;
  await A('POST', '/api/transport-taken', { type: 'levering', datum: dag(1), tijd: '17:00', van_locatie_id: R, naar_locatie_id: AB, rit_id: r5.id, regels: [{ naam: 'Z', qty: 1 }] });
  const w5 = (await A('GET', `/api/ritplanning?week=${dag(1)}`)).json.dagen.flatMap((q) => q.ritten).find((q) => q.id === r5.id).waarschuwingen;
  T.check(w5.some((q) => /eerste stop pas om 17:00/.test(q)), `eerste stop veel later: ${w5}`);
  const tijden = (await C('GET', '/api/vandaag?mijn=1')).json.ritten_vandaag.map((q) => q.tijd);
  T.check(tijden.join() === [...tijden].sort().join(), `Ritten-tab op tijd: ${tijden}`);
  T.check(/klaar-terug/.test(lees('public/ritplanning.js')), 'knop Terugzetten in de ritplanning');
} catch (e) { T.fout('uitzondering: ' + e.message + ' ' + e.stack); console.log(srv.log().slice(-1200)); }
await T.einde(srv);
