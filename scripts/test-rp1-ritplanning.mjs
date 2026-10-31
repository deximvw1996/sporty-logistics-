// test-rp1-ritplanning.mjs — RP1 (chat C): ritplanning. Bestuurder = elke medewerker, voertuig vrij,
// waarschuwingen (capaciteit, dubbel, KV, weekend), GET /api/ritplanning, kantoor-wissel, ✕ met 409, pagina.
// Eigen server via _testhulp (poort 3335, herfst-test.db; kampweek 1 = ma 2026-11-02 … zo 08).
import * as T from './_testhulp.mjs';
const POORT = parseInt(process.env.TEST_POORT || '3335');
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: POORT });
const BASIC = 'Basic ' + Buffer.from('sporty:' + T.APP_PASSWORD).toString('base64');
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const R = ijk.locaties.rozenweg, AB = ijk.locaties.abdijschool, BE = ijk.locaties.betekom;
  const kmAB = ijk.kampmomenten.abdijschool, kmBE = ijk.kampmomenten.betekom;
  const taak = async (datum, tijd, naar, qty = 2, extra = {}) => (await A('POST', '/api/transport-taken', { type: 'levering', datum, tijd, van_locatie_id: R, naar_locatie_id: naar, kampmoment_id: naar === AB ? kmAB : kmBE, regels: [{ naam: 'Croquet doelen', qty, soort: 'attribuut', attribuut_id: 4 }], ...extra })).json.id;
  const rit = async (datum, body, taken) => { const r = await A('POST', '/api/ritten', { datum, taak_ids: taken, ...body }); if (r.status !== 200) T.fout('rit maken ' + r.status + ' ' + r.text); return r.json; };

  // ── 6 ritten ──
  const ma1 = await taak('2026-11-02', '08:00', AB), ma2 = await taak('2026-11-02', '09:00', BE);
  const r1 = await rit('2026-11-02', { personeel_id: 2, voertuig: 'Camionette' }, [ma1, ma2]);
  T.check(r1.bestuurder_rol === 'chauffeur' && r1.voertuig_soort === 'pool' && r1.voertuig_capaciteit === 20, `pool-rit: rol ${r1.bestuurder_rol}, ${r1.voertuig_soort}, capaciteit ${r1.voertuig_capaciteit} (uit voertuig_types)`);
  const r2 = await rit('2026-11-05', { personeel_id: 3, voertuig: 'Camion', vertrek: '09:00' }, [await taak('2026-11-05', '10:00', AB)]);
  const r3 = await rit('2026-11-05', { personeel_id: 3, voertuig: 'Camionette', vertrek: '09:30' }, [await taak('2026-11-05', '10:30', BE)]);
  const r4 = await rit('2026-11-04', { personeel_id: 1, voertuig: 'Camionette' }, [await taak('2026-11-04', '08:30', AB, 25)]);
  const r5 = await rit('2026-11-06', { personeel_id: 14, voertuig: 'Huurwagen', voertuig_soort: 'huur', voertuig_capaciteit: 15, vertrek: '09:00' }, [await taak('2026-11-06', '10:00', AB)]);
  T.check(r5.bestuurder_rol === 'coordinator' && r5.voertuig_soort === 'huur' && r5.voertuig_capaciteit === 15 && r5.vertrek === '09:00', `coördinator met huurwagen: rol ${r5.bestuurder_rol}, ${r5.voertuig_soort} ${r5.voertuig_capaciteit}, vertrek ${r5.vertrek}`);
  const r6 = await rit('2026-11-07', { personeel_id: 3, voertuig: 'Camion' }, [await taak('2026-11-07', '10:00', BE)]);
  let r = await A('POST', '/api/ritten', { datum: '2026-11-07', voertuig_soort: 'boot' });
  T.check(r.status === 400, 'ongeldige voertuig_soort → 400');
  r = await A('PUT', `/api/ritten/${r6.id}`, { voertuig_soort: 'eigen', voertuig: 'Eigen wagen', voertuig_capaciteit: 6 });
  T.check(r.status === 200 && r.json.voertuig_soort === 'eigen' && r.json.voertuig_capaciteit === 6, `PUT: eigen wagen capaciteit 6 (${r.json.voertuig_soort} ${r.json.voertuig_capaciteit})`);

  // ── 4 open taken ──
  const o1 = await taak('2026-11-02', '13:00', BE), o2 = await taak('2026-11-03', '10:00', AB);
  const o3 = await taak('2026-11-06', '11:00', BE, 3, { opmerking: `Rest van rit #${r5.id}: past niet` }), o4 = await taak('2026-11-07', '09:00', AB);

  // ── GET /api/ritten?week= ──
  const wk = (await A('GET', '/api/ritten?week=2026-11-04')).json;
  const w = (id) => wk.find((x) => x.id === id)?.waarschuwingen || [];
  T.check(wk.length === 6 && wk.every((x) => 'bezetting' in x && 'einde' in x), `GET /api/ritten?week: ${wk.length} ritten met bezetting/einde`);
  T.check(w(r2.id).some((s) => s === `Jesse staat ook op rit #${r3.id} om 09:30`) && w(r3.id).some((s) => /staat ook op rit #/.test(s)), `dubbel donderdag: "${w(r2.id).join(' | ')}"`);
  T.check(!w(r4.id).some((x) => /plaatsen/.test(x)), `TF7: geen capaciteitswaarschuwing: "${w(r4.id).join(' | ')}"`);
  T.check(w(r5.id).some((s) => /is die dag KV op Abdijschool/.test(s)), `KV-waarschuwing coördinator: "${w(r5.id).join(' | ')}"`);
  T.check(w(r6.id).includes('weekend') && !w(r1.id).length, `weekend op zaterdag, maandag zonder waarschuwing (${w(r1.id).length})`);

  // ── GET /api/ritplanning ──
  r = await A('GET', '/api/ritplanning?week=2026-11-05');
  T.check(r.status === 200, 'GET /api/ritplanning → 200');
  const p = r.json;
  T.check(p.week.start === '2026-11-02' && p.week.eind === '2026-11-08' && p.week.nummer === 1 && p.dagen.length === 7, `week ${p.week.start}…${p.week.eind} nr ${p.week.nummer}, 7 dagen`);
  const dag = (d) => p.dagen.find((x) => x.datum === d);
  T.check(dag('2026-11-05').ritten.length === 2 && dag('2026-11-02').ritten.length === 1 && dag('2026-11-07').weekend && !dag('2026-11-06').weekend, 'ritten op de juiste dag, weekend-vlag');
  const pr5 = dag('2026-11-06').ritten[0];
  T.check(pr5.bestuurder.rol === 'coordinator' && pr5.bestuurder.kleur && pr5.voertuig.soort === 'huur' && pr5.voertuig.capaciteit === 15 && pr5.stops[0].slot === 'vast' && pr5.stops[0].locatie === 'Abdijschool Vlierbeek', `rit coördinator: ${JSON.stringify(pr5.bestuurder)} ${JSON.stringify(pr5.voertuig)}`);
  T.check(/25/.test(dag('2026-11-04').ritten[0].lading.tekst), 'TF7: ritplanning zegt wat erop staat');
  const coord = p.personen.find((x) => x.personeel_id === 14);
  T.check(coord && !coord.vast && coord.bestuurder_rol === 'coordinator' && /^#[0-9a-f]{6}$/.test(coord.kleur), `personen: coördinator ${coord?.naam} kleur ${coord?.kleur}`);
  T.check(p.personen.filter((x) => x.vast).every((x) => x.rol === 'chauffeur') && p.personen.some((x) => x.vast && x.personeel_id === 13), 'personen: alle vaste chauffeurs, ook zonder rit');
  const o = (d) => dag(d).open.map((x) => x.taak_id);
  T.check(o('2026-11-02').includes(o1) && o('2026-11-03').includes(o2) && o('2026-11-06').includes(o3) && o('2026-11-07').includes(o4) && !o('2026-11-02').includes(ma1), `open per dag: ma ${o('2026-11-02')}, di ${o('2026-11-03')}, vr ${o('2026-11-06')}, za ${o('2026-11-07')}`);
  const so = (d, id) => dag(d).open.find((x) => x.taak_id === id)?.soort;
  T.check(so('2026-11-06', o3) === 'rest' && so('2026-11-07', o4) === 'weekend' && so('2026-11-02', o1) === 'levering', `soort: rest/weekend/levering (${so('2026-11-06', o3)}/${so('2026-11-07', o4)}/${so('2026-11-02', o1)})`);
  T.check(p.voertuigen.some((v) => v.soort === 'eigen' && v.capaciteit === 20 && /Camionette 1/.test(v.naam)) && p.voertuigen.every((v) => v.id && 'bezet_op_dag' in v), 'voertuigen: echte voertuigen uit de nieuwe tabel (VT1)');

  // ── kantoor-wissel op vaste stops ──
  r = await A('POST', `/api/ritten/${r1.id}/taken/${ma1}/wissel`, { richting: 'omlaag' });
  const na = (await A('GET', `/api/ritten/${r1.id}`)).json.taken;
  T.check(r.status === 200 && na[0].id === ma2 && na[0].tijd === '08:00' && na[1].id === ma1 && na[1].tijd === '09:00', `kantoor wisselt vaste stops → 200, volgorde ${na.map((t) => t.id + '@' + t.tijd)}`);
  const rtok = await T.ritToken(srv.base, tok, r1.id);
  r = await T.api(srv.base, null, 'POST', `/api/rit-token/${rtok}/taken/${ma2}/wissel`, { richting: 'omlaag' });
  T.check(r.status === 409, `chauffeur (rit-link) op vaste stop blijft 409 (${r.status})`);

  // ── ✕ op geladen taak → 409; niet geladen → van de rit, blijft open op die dag ──
  const data = (await T.api(srv.base, null, 'GET', `/api/rit-token/${rtok}/data`)).json;
  const check = data.stops.find((s) => s.taak_id === ma1).regels[0].check_id;
  r = await T.ritActie(srv.base, rtok, check, 'laden');
  T.check(r.status === 200, `stuk geladen (${r.status})`);
  r = await A('POST', `/api/ritten/${r1.id}/taken/${ma1}/ontkoppel`);
  T.check(r.status === 409 && /al geladen/.test(r.json.error), `✕ op geladen taak → 409 "${r.json.error}"`);
  r = await A('POST', `/api/ritten/${r1.id}/taken/${ma2}/ontkoppel`);
  const p2 = (await A('GET', '/api/ritplanning?week=2026-11-02')).json;
  T.check(r.status === 200 && p2.dagen[0].open.some((x) => x.taak_id === ma2) && p2.dagen[0].ritten[0].stops.length === 1, '✕ op niet-geladen taak → van de rit, terug in "open" van maandag');

  // ── niet-kantoor ──
  await A('POST', '/api/personeel/13/pincode', { pincode: '4321' });
  const tokCh = await T.login(srv.base, 13, '4321');
  r = await T.api(srv.base, tokCh, 'GET', '/api/ritplanning?week=2026-11-02');
  T.check(r.status === 403, `chauffeur → GET /api/ritplanning ${r.status}`);
  r = await T.api(srv.base, tokCh, 'POST', `/api/ritten/${r1.id}/taken/${ma1}/wissel`, { richting: 'omlaag' });
  T.check(r.status === 403, `chauffeur → kantoor-wissel ${r.status}`);

  // ── pagina ──
  const pg = await fetch(srv.base + '/ritplanning', { headers: { authorization: BASIC } });
  const html = await pg.text();
  T.check(pg.status === 200 && html.includes('class="leg"') && html.includes('id="dagkop"') && html.includes('class="lade"') && html.includes('class="ladegrid"') && html.includes('class="inzoom'), 'GET /ritplanning → 200 met legenda, dagkop, lade (inzoom + detail)');
  const js = await (await fetch(srv.base + '/public/ritplanning.js', { headers: { authorization: BASIC } })).text();
  T.check(js.includes('/api/ritplanning') && /dagkop/.test(js), 'ritplanning.js geserveerd en tekent de dagkoppen');
} catch (e) { T.fout('onverwachte fout: ' + (e.stack || e)); }
await T.einde(srv);
