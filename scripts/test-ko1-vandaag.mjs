// test-ko1-vandaag.mjs — KO1 (chat C): kantoor-startscherm "Vandaag". Eén databron GET /api/vandaag
// (beslissen / inplannen / nakijken / ritten vandaag / deze week / cijfers), voorkeur Groot/Compact per
// gebruiker, de pagina /vandaag. Eigen server via _testhulp (poort 3334, herfst-test.db).
import * as T from './_testhulp.mjs';
const POORT = parseInt(process.env.TEST_POORT || '3334');
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: POORT });
const BASIC = 'Basic ' + Buffer.from('sporty:' + T.APP_PASSWORD).toString('base64');
const DATUM = '2026-11-04'; // woensdag, kampweek 1 van "Herfst TEST" (2026-11-02 → 08)
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const R = ijk.locaties.rozenweg, AB = ijk.locaties.abdijschool, BE = ijk.locaties.betekom;
  const kmAB = ijk.kampmomenten.abdijschool, kmBE = ijk.kampmomenten.betekom;

  // ── klaarzetten ──
  const locAB = (await A('GET', '/api/locaties')).json.find((l) => l.id === AB);
  await A('PUT', `/api/locaties/${AB}`, { ...locAB, contact_naam: 'Conciërge', contact_telefoon: '0470 11 22 33' });
  let r = await A('POST', '/api/aanvragen', { kampmoment_id: kmAB, soort: 'materiaal', tekst: '3 rollen tape' });
  const aanvraag = r.json.id;
  const kapot = (await A('POST', '/api/aanvragen', { kampmoment_id: kmBE, soort: 'kapot', tekst: 'Oven kapot' })).json.id;
  // rit met 3 stops vast/vrij/vrij op DATUM
  const mk = async (naar, km, tijd) => (await A('POST', '/api/transport-taken', { type: 'levering', datum: DATUM, tijd, van_locatie_id: R, naar_locatie_id: naar, kampmoment_id: km, regels: [{ naam: 'Croquet doelen', qty: 1, soort: 'attribuut', attribuut_id: 4 }] })).json.id;
  const t1 = await mk(AB, kmAB, '07:30'), t2 = await mk(BE, kmBE, '08:30'), t3 = await mk(AB, kmAB, '09:30');
  const rit = (await A('POST', '/api/ritten', { datum: DATUM, chauffeur: 'Test Chauffeur', taak_ids: [t1, t2, t3] })).json.id;
  await A('PUT', `/api/transport-taken/${t2}`, { slot: 'vrij' });
  await A('PUT', `/api/transport-taken/${t3}`, { slot: 'vrij' });
  // melding van de chauffeur via de rit-link (probleem_chauffeur)
  const rtok = await T.ritToken(srv.base, tok, rit);
  r = await T.api(srv.base, null, 'POST', `/api/rit-token/${rtok}/taken/${t1}/probleem`, { soort: 'gesloten', tekst: 'geen sleutel' });
  T.check(r.status === 200, `probleem_chauffeur aangemaakt (${r.status})`);
  const melding = r.json.id;
  // rest-taak zonder rit
  const rest = (await A('POST', '/api/transport-taken', { type: 'levering', datum: '2026-11-05', tijd: '10:00', van_locatie_id: R, naar_locatie_id: AB, kampmoment_id: kmAB, opmerking: `Rest van rit #${rit}: past niet`, regels: [{ naam: 'Oven', qty: 1, soort: 'attribuut', attribuut_id: 4 }] })).json.id;
  const weekendTaak = (await A('POST', '/api/transport-taken', { type: 'levering', datum: '2026-11-07', tijd: '10:00', van_locatie_id: R, naar_locatie_id: BE, regels: [] })).json.id;
  // conflict: zelfde thema op beide locaties in week 1
  const thema = (await A('GET', '/api/themas')).json[0];
  await A('POST', `/api/kampmomenten/${kmAB}/themas`, { thema_id: thema.id });
  await A('POST', `/api/kampmomenten/${kmBE}/themas`, { thema_id: thema.id });

  // ── GET /api/vandaag ──
  r = await A('GET', `/api/vandaag?datum=${DATUM}`);
  T.check(r.status === 200, 'GET /api/vandaag → 200');
  const v = r.json;
  T.check(v.periode && v.periode.naam === 'Herfst TEST' && v.week === 1 && v.datum === DATUM, `periode ${v.periode?.naam}, week ${v.week}, datum ${v.datum}`);
  T.check(v.gebruiker?.naam === 'Claude (API)', `gebruiker ${v.gebruiker?.naam}`);
  T.check(v.datum_tekst === 'woensdag 4 november', `datum_tekst "${v.datum_tekst}"`);
  const b = (id) => v.beslissen.find((x) => x.id === id);
  const ba = b(aanvraag), bk = b(kapot), bm = b(melding);
  T.check(ba && ba.ico === '📩' && /^3 rollen tape · Abdijschool/.test(ba.titel) && /^aanvraag KV .+ · (\d\d:\d\d|gisteren|\d{1,2}\/\d{1,2})$/.test(ba.sub), `aanvraag materiaal in Beslissen: ${ba?.ico} "${ba?.titel}" / "${ba?.sub}"`);
  T.check(ba && ba.acties.map((a) => a.label).join('|') === 'Afwijzen|Goedkeuren + spoed', `acties materiaal (kamp loopt deze week): ${ba?.acties.map((a) => a.label).join(' / ')}`);
  T.check(ba && ba.acties[1].url === `/api/aanvragen/${aanvraag}/status` && ba.acties[1].body.maak_spoedtransport === true, 'spoed-actie = PUT /api/aanvragen/:id/status met maak_spoedtransport');
  T.check(bk && bk.ico === '💥', `aanvraag kapot → 💥 (${bk?.ico})`);
  T.check(bm && bm.ico === '🚪' && /^melding /.test(bm.sub) && /rit gepland/.test(bm.sub) && /KV .+ ook verwittigd/.test(bm.sub), `melding chauffeur: ${bm?.ico} "${bm?.sub}"`);
  T.check(bm && bm.acties.map((a) => a.label).join('|') === 'Bel conciërge|Afgehandeld' && bm.acties[0].url === 'tel:0470112233', `acties melding: ${bm?.acties.map((a) => a.label + (a.url ? ' ' + a.url : '')).join(' / ')}`);
  const ir = v.inplannen.find((x) => x.taak_id === rest);
  T.check(ir && ir.ico === '🚚' && /^Rest van rit #\d+: Rozenweg/.test(ir.titel) && ir.acties[0].label === 'Op een rit zetten' && ir.acties[0].url === `/#transport-plan?taak=${rest}`, `rest-taak in Inplannen: ${ir?.ico} "${ir?.titel}" → ${ir?.acties[0].url}`);
  const iw = v.inplannen.find((x) => x.taak_id === weekendTaak);
  T.check(iw && iw.ico === '🏃' && iw.pil === 'weekend', `weekendtaak: ${iw?.ico} pil ${iw?.pil}`);
  T.check(!v.inplannen.some((x) => [t1, t2, t3].includes(x.taak_id)), 'taken die al op een rit staan, staan niet in Inplannen');
  const ivt = v.inplannen.find((x) => x.rit_id === rit);
  T.check(ivt && ivt.ico === '🚐' && ivt.titel === `Rit #${rit} heeft nog geen voertuig` && ivt.acties[0].label === 'Voertuig kiezen', `rit zonder voertuig: "${ivt?.titel}"`);
  const nd = v.nakijken.find((x) => /ingepland op 2 locaties/.test(x.titel));
  T.check(nd && nd.ico === '⚠' && nd.acties[0].label === 'Open', `conflict dubbel thema in Nakijken: "${nd?.titel}"`);
  T.check(v.nakijken.every((x) => x.ico && x.titel && x.acties.length), 'elke Nakijken-regel heeft ico/titel/actie');
  const rv = v.ritten_vandaag.find((x) => x.id === rit);
  T.check(rv && rv.stops.map((s) => s.slot).join() === 'vast,vrij,vrij' && rv.stops_totaal === 3 && rv.stop_huidig === 1 && rv.tijd === '07:30' && rv.status === 'gepland', `ritten_vandaag: ${rv?.tijd} ${rv?.chauffeur} ${rv?.stops.map((s) => s.naam + '/' + s.slot).join(' → ')}`);
  T.check(v.deze_week.length === 2 && v.deze_week.every((k) => k.locatie && k.dagen && Array.isArray(k.markeringen)), `deze_week: ${v.deze_week.map((k) => `${k.locatie} (${k.thema}, KV ${k.kv_naam}, ${k.dagen}, ${k.markeringen.join('; ')})`).join(' | ')}`);
  T.check(v.deze_week.find((k) => k.kampmoment_id === kmBE)?.markeringen.some((m) => /^⚠ oven/.test(m)), 'Betekom gemarkeerd met ⚠ oven (open aanvraag kapot)');
  T.check(v.cijfers.locaties_open === 2 && v.cijfers.ritten_onderweg === 0, `cijfers ${JSON.stringify(v.cijfers)}`);

  // onderweg → telt mee
  const ritRow = (await A('GET', `/api/ritten/${rit}`)).json;
  await A('PUT', `/api/ritten/${rit}`, { ...ritRow, status: 'onderweg' });
  const v2 = (await A('GET', `/api/vandaag?datum=${DATUM}`)).json;
  T.check(v2.cijfers.ritten_onderweg === v2.ritten_vandaag.filter((x) => x.status === 'onderweg').length && v2.ritten_vandaag.find((x) => x.id === rit)?.status === 'onderweg', `ritten_onderweg = ${v2.cijfers.ritten_onderweg} na rit op onderweg`);

  // actie uitvoeren zoals de pagina: Afgehandeld → melding weg uit Beslissen
  const act = bm.acties[1];
  r = await A(act.methode, act.url, act.body);
  const v3 = (await A('GET', `/api/vandaag?datum=${DATUM}`)).json;
  T.check(r.status === 200 && !v3.beslissen.some((x) => x.id === melding), 'actie Afgehandeld → melding verdwijnt uit Beslissen');

  // lege dag buiten de periode: lege lijsten blijven lijsten
  const vl = (await A('GET', '/api/vandaag?datum=2027-03-03')).json;
  T.check(vl.week === null && Array.isArray(vl.ritten_vandaag) && vl.ritten_vandaag.length === 0 && Array.isArray(vl.deze_week) && vl.deze_week.length === 0, 'datum buiten de periode: week null, lege lijsten');

  // ── niet-kantoor → 403 ──
  await A('POST', '/api/personeel/13/pincode', { pincode: '4321' });
  const tokCh = await T.login(srv.base, 13, '4321');
  r = await T.api(srv.base, tokCh, 'GET', `/api/vandaag?datum=${DATUM}`);
  T.check(r.status === 403, `chauffeur → GET /api/vandaag ${r.status}`);

  // ── voorkeur ──
  r = await A('GET', '/api/mij/voorkeuren');
  T.check(r.status === 200 && r.json.vandaag_weergave === undefined, 'voorkeuren standaard leeg {}');
  r = await A('PUT', '/api/mij/voorkeuren', { vandaag_weergave: 'compact' });
  T.check(r.status === 200 && r.json.vandaag_weergave === 'compact', 'PUT voorkeur compact');
  r = await A('GET', '/api/mij/voorkeuren');
  T.check(r.json.vandaag_weergave === 'compact', 'teruggelezen: compact');
  r = await A('PUT', '/api/mij/voorkeuren', { vandaag_weergave: 'reuze' });
  T.check(r.status === 400, 'ongeldige weergave → 400');
  r = await T.api(srv.base, tokCh, 'GET', '/api/mij/voorkeuren');
  T.check(r.json.vandaag_weergave === undefined, 'voorkeur is per gebruiker (chauffeur ziet geen compact)');

  // ── pagina ──
  const p = await fetch(srv.base + '/vandaag', { headers: { authorization: BASIC } });
  const html = await p.text();
  T.check(p.status === 200 && ['Beslissen', 'Inplannen', 'Nakijken'].every((k) => html.includes(k)), 'GET /vandaag → 200 met de drie kolomkoppen');
  T.check(html.includes('▦ Groot') && html.includes('☰ Compact'), 'schakelaar Groot / Compact in de HTML');
  const js = await fetch(srv.base + '/public/vandaag.js', { headers: { authorization: BASIC } });
  T.check(js.status === 200 && (await js.text()).includes('/api/vandaag'), 'vandaag.js wordt geserveerd');
  const ix = await (await fetch(srv.base + '/', { headers: { authorization: BASIC } })).text();
  T.check(ix.includes("location.href='/vandaag'") && ix.includes('🏠 Vandaag'), 'index.html: doorsturen naar /vandaag + knop 🏠 Vandaag');
} catch (e) { T.fout('onverwachte fout: ' + (e.stack || e)); }
await T.einde(srv);
