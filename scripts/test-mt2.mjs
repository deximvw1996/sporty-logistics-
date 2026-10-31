// test-mt2.mjs — MT2: weekkaart, ruimtes, leverafspraken, dossier en codes.
import * as T from './_testhulp.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), DOS = require(T.ROOT + '/public/locatie-dossier.js'), ijk = T.leesIjk();
const srv = await T.startServer({ poort: Number(process.env.TEST_POORT) || 3387 }), v = T.check, rust = () => new Promise((r) => setTimeout(r, 900));
try {
  const tok = await T.login(srv.base), A = (m, p, b) => T.api(srv.base, tok, m, p, b), R = ijk.locaties.rozenweg, X = ijk.locaties.abdijschool, Z = ijk.locaties.betekom;
  const d = new Date(), iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`, vd = iso(d);
  const mens = async (n, pin) => { const x = (await A('POST', '/api/personeel', { naam: n, rol: 'chauffeur' })).json; await A('POST', `/api/personeel/${x.id}/pincode`, { pincode: pin }); return { id: x.id, tok: await T.login(srv.base, x.id, pin) }; };
  const c1 = await mens('Mt Rij', '5911'), c2 = await mens('Mt Vrij', '5912');
  // Weekkaart
  const km = (await T.leesDb(srv.dbPad, 'SELECT * FROM kampmomenten WHERE id=?', [ijk.kampmomenten.abdijschool]))[0];
  let wk = (await A('GET', `/api/locaties/${X}/weekkaart?periode_id=${km.periode_id}`)).json;
  v(wk.weken.find((w) => w.week === km.week).stand === 'kamp_open', 'kamp open volgt het kampmoment');
  const wVrij = [km.week + 5, km.week + 6]; // de testperiode heeft weinig weken; de route bewaart elke gekozen week
  const b = await A('PUT', `/api/locaties/${X}/weekkaart`, { periode_id: km.periode_id, weken: [...wVrij, km.week], stand: 'geen_toegang', reden: 'Verhuurd aan een firma', materiaal_mag_blijven: true, ruimte: 'Berging', notitie: 'enkel kleine berging' });
  v(b.status === 200 && b.json.weken.filter((w) => w.stand === 'geen_toegang').length === wVrij.length, 'bulk over meerdere weken');
  v(b.json.weken.find((w) => w.week === km.week).stand === 'kamp_open', 'kampweek blijft kamp open');
  const w0 = b.json.weken.find((w) => w.week === wVrij[0]);
  v(w0.reden === 'Verhuurd aan een firma' && w0.materiaal_mag_blijven && w0.ruimte === 'Berging' && w0.notitie, 'reden, vinkje, ruimte, notitie');
  v((await A('PUT', `/api/locaties/${X}/weekkaart`, { periode_id: km.periode_id, weken: [wVrij[0]], stand: 'binnen' })).json.weken[0].stand === 'binnen', 'stand wijzigt');
  v((await A('PUT', `/api/locaties/${X}/weekkaart`, { periode_id: km.periode_id, weken: [], stand: 'binnen' })).status === 400, 'zonder week: 400');
  // Ruimte
  const kd = (await A('GET', `/api/kampmomenten/${km.id}/detail`)).json, per = (await T.leesDb(srv.dbPad, 'SELECT start_datum FROM vakantieperiodes WHERE id=?', [km.periode_id]))[0];
  const m = new Date(per.start_datum + 'T12:00:00'); m.setDate(m.getDate() + (km.week - 1) * 7); const dinsdag = new Date(m); dinsdag.setDate(m.getDate() + 1);
  const rz = (await A('POST', `/api/locaties/${X}/ruimtes`, { naam: 'Turnzaal', notitie: 'groot' })).json.id;
  v(!kd.ruimte_meldingen.length, 'zonder beperking geen melding');
  await A('POST', `/api/ruimtes/${rz}/beperkingen`, { datum_van: iso(dinsdag), reden: 'examen' });
  const k2 = (await A('GET', `/api/kampmomenten/${km.id}/detail`)).json;
  v(k2.ruimte_meldingen.length === 1 && /Turnzaal.*examen/.test(k2.ruimte_meldingen[0]), `kampmoment: ${k2.ruimte_meldingen[0]}`);
  const ro = await A('GET', `/api/rooster/kampmoment/${km.id}`);
  if (ro.status === 200) v(ro.json.let_op.some((l) => /Turnzaal/.test(l.tekst)), 'rooster: melding'); else T.info && T.info('roosterroute ' + ro.status);
  // Levering
  const dg = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'][d.getDay()];
  await A('PUT', `/api/locaties/${Z}/lever`, { type: 'openbaar', uren: { [dg]: { van: '09:00', tot: '12:00' } } });
  await A('POST', `/api/locaties/${Z}/niet-storen`, { van: vd, tot: vd, tekst: 'Firma Kamp' }); await A('POST', `/api/locaties/${Z}/locatie-afspraken`, { van: vd, tot: vd, tekst: 'enkel na afspraak met de school' });
  const o = (await A('POST', '/api/opdrachten', { datum: vd, vertrek: '08:00', personeel_id: c1.id })).json, rit = o.wagens[0].rit_id;
  const st = await A('POST', `/api/ritten/${rit}/stops`, { type: 'levering', van_locatie_id: R, naar_locatie_id: Z, tijd: '14:00' });
  v(st.status === 200, 'stop buiten de uren mag: geen verbod');
  const w = (await A('GET', `/api/opdrachten/${o.id}`)).json.wagens[0].waarschuwingen.join(' | ');
  v(/buiten de leveruren/.test(w) && /niet storen: Firma Kamp/.test(w) && /enkel na afspraak/.test(w), 'opdracht: melding met tekst');
  v((await A('GET', '/api/ritplanning?week=' + vd)).json.dagen.flatMap((x) => x.ritten).find((r) => r.id === rit).waarschuwingen.some((x) => /leveruren/.test(x)), 'ritplanning: melding');
  await A('POST', `/api/transport-taken/${st.json.taak_id}/regels`, { bron: 'tekst', naam: 'Stuk', qty: 1 }); await A('POST', `/api/opdrachten/${o.id}/klaarzet`);
  // Codes
  await A('PUT', `/api/locaties/${Z}/code`, { code: 'GEHEIM4711' });
  const C1 = (mm, p, x) => T.api(srv.base, c1.tok, mm, p, x), C2 = (mm, p, x) => T.api(srv.base, c2.tok, mm, p, x);
  v((await C1('GET', `/api/locaties/${Z}/code`)).json.code === 'GEHEIM4711', 'chauffeur met stop ziet de code');
  v((await C2('GET', `/api/locaties/${Z}/code`)).status === 403, 'zonder stop niet');
  v((await C1('GET', `/api/locaties/${X}/code`)).status === 403, 'met stop elders niet');
  const tk = (await A('POST', `/api/ritten/${rit}/token`)).json.token, data = (await T.api(srv.base, null, 'GET', `/api/rit-token/${tk}/data`)).json;
  v(data.stops[0].geldt.meldingen.length === 3 && data.stops[0].geldt.heeft_code && !JSON.stringify(data).includes('GEHEIM4711'), 'chauffeur ziet op de stop wat geldt; code niet in de data');
  v((await T.api(srv.base, null, 'POST', `/api/rit-token/${tk}/taken/${st.json.taak_id}/code`, {})).json.code === 'GEHEIM4711', 'op de rit-link via de knop');
  const hr = await fetch(`${srv.base}/api/rit-token/${tk}/taken/${st.json.taak_id}/code`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': c2.tok }, body: '{}' });
  v(hr.status === 403, 'helper krijgt de code niet');
  const ex = (await A('GET', '/api/export')).text;
  v(!ex.includes('GEHEIM4711') && !JSON.parse(ex).locatie_codes, 'export zonder code');
  for (const u of ['/api/locaties', `/api/locaties/${Z}/detail`, `/api/locaties/${Z}/dossier`, '/api/locaties-overzicht']) v(!JSON.stringify((await A('GET', u)).json).includes('GEHEIM4711'), 'niet in ' + u);
  await rust();
  const lg = await T.leesDb(srv.dbPad, "SELECT beschrijving AS b FROM activiteiten_log WHERE actie='code opgevraagd'");
  v(lg.length >= 2 && lg.some((x) => /Mt Rij/.test(x.b)) && !lg.some((x) => /GEHEIM/.test(x.b)), 'opvraging gelogd, zonder de code');
  v(!(await T.leesDb(srv.dbPad, "SELECT COUNT(*) AS n FROM wijzigingen WHERE nieuw LIKE '%GEHEIM%'").catch(() => [{ n: 0 }]))[0].n, 'niet in het wijzigingenlog');
  // Ontbrekend
  let ov = (await A('GET', '/api/locaties-overzicht')).json, lz = ov.locaties.find((l) => l.id === X);
  v(lz.dossier_ontbreekt.includes('wie opent') && ov.tellers.dossier > 0, `balk: ${lz.dossier_ontbreekt.join(', ')}`);
  await A('PUT', `/api/locaties/${X}/dossier`, { wie_opent: 'Conciërge Jan', parking: 'Laadzone achter', heeft_eigen_oven: true });
  const dd = (await A('GET', `/api/locaties/${X}/dossier`)).json;
  v(!dd.ontbreekt.includes('wie opent') && dd.heeft_eigen_oven && /Dossier onvolledig/.test(DOS.balk(dd)), 'invullen werkt de balk bij');
  await A('POST', `/api/locaties/${X}/contacten`, { naam: 'Piet', rol: 'conciërge', telefoon: '016 12' });
  const d3 = (await A('GET', `/api/locaties/${X}/dossier`)).json; d3.wk = { weken: [] }; d3.fb = [];
  v(/href="tel:016 12"/.test(DOS.html(d3, 'dossier')), 'tikbaar nummer');
  for (const t of ['weekkaart', 'leveren', 'ruimtes', 'feedback']) v(DOS.html(d3, t).length > 20, 'tab ' + t);
  // Schrijven door chauffeur
  v((await C1('PUT', `/api/locaties/${Z}/code`, { code: 'x' })).status === 403 && (await C1('GET', `/api/locaties/${Z}/dossier`)).status === 403 && (await C1('PUT', `/api/locaties/${Z}/lever`, {})).status === 403, 'dossier alleen kantoor');
} catch (e) { T.fout('uitzondering: ' + e.message + ' ' + e.stack); console.log(srv.log().slice(-1200)); }
await T.einde(srv);
