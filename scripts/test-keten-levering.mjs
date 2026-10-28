// test-keten-levering.mjs — bewaakt WERKLIJST 13, 14 · DOORLICHTING-b F4/F5 · T-G3.
// Gewenst (DRAAIBOEK 4.1/4.2/8.2): levering via de rit-link laden+lossen ⇒ elke bak/attribuut
// op_locatie op de kamplocatie; bulk_spreiding = geleverd aantal op de locatie, thuis = bezit − geleverd,
// som = bezit; taak én rit 'gedaan'; opnieuw gedaan zetten verandert niets.
import * as T from './_testhulp.mjs';
const POORT = parseInt(process.env.TEST_POORT || '3321');
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: POORT });
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const kmId = ijk.kampmomenten.betekom, betekom = ijk.locaties.betekom;

  const gen = await A('POST', '/api/transport-genereer');
  T.check(gen.status === 200, `transport-genereer → 200 (kreeg ${gen.status})`);
  const v = (gen.json || []).find((x) => x.kampmoment_id === kmId && x.type === 'levering');
  T.check(!!v, `er is een leveringsvoorstel voor het Betekom-kampmoment (km ${kmId})`);
  if (!v) await T.einde(srv);
  const bulkRegels = v.materiaal.filter((m) => /^\d+ × /.test(m.naam));
  const uniekRegels = v.materiaal.filter((m) => !/^\d+ × /.test(m.naam));
  T.info(`voorstel: ${v.materiaal.length} regels (${bulkRegels.length} bulk, ${uniekRegels.length} uniek)`);
  T.check(bulkRegels.length > 0, 'het voorstel bevat bulk-materiaal (fietsen/blazers/...)');

  const bezit = {};
  for (const m of bulkRegels) { const s = await A('GET', `/api/vaste-bakken/${m.bak_id}/spreiding`); bezit[m.bak_id] = s.json.aantal; }

  const { taakId, ritId } = await T.voorstelNaarRit(srv.base, tok, v, { chauffeur: { id: ijk.personen.chauffeur, naam: 'Test Chauffeur harnas' } });
  const rtok = await T.ritToken(srv.base, tok, ritId);
  const init = await A('POST', `/api/ritten/${ritId}/checks/init`);
  T.check(init.status === 200 && init.json?.aangemaakt === v.materiaal.length, `checks/init maakt ${v.materiaal.length} checks (kreeg ${init.status} / ${init.json?.aangemaakt})`);
  const checks = init.json?.checks || [];
  for (const c of checks) await T.ritActie(srv.base, rtok, c.id, 'laden');
  for (const c of checks) await T.ritActie(srv.base, rtok, c.id, 'lossen');

  // ── unieke bakken + attributen op locatie ──
  const vb = (await A('GET', '/api/vaste-bakken')).json || [];
  const tb = ((await A('GET', '/api/alle-bakken')).json || []).flatMap((t) => t.bakken || []);
  const at = (await A('GET', '/api/attributen')).json || [];
  for (const m of uniekRegels) {
    const b = m.bak_id ? (vb.find((x) => x.id === m.bak_id) || tb.find((x) => x.id === m.bak_id)) : at.find((x) => x.id === m.attribuut_id);
    T.check(b && b.status === 'op_locatie' && b.huidige_locatie_id === betekom, `${m.naam}: op_locatie @${betekom} (kreeg ${b?.status} @${b?.huidige_locatie_id})`);
  }
  // ── bulk: spreiding klopt na alleen laden/lossen door de chauffeur ──
  const spreidingStand = async () => {
    const uit = {};
    for (const m of bulkRegels) { const s = (await A('GET', `/api/vaste-bakken/${m.bak_id}/spreiding`)).json; uit[m.bak_id] = s.spreiding; }
    return uit;
  };
  const sp1 = await spreidingStand();
  for (const m of bulkRegels) {
    const rijen = sp1[m.bak_id] || [];
    const opLoc = rijen.find((r) => r.locatie_id === betekom)?.aantal || 0;
    const thuis = rijen.find((r) => r.locatie_id === m.stockage_id)?.aantal || 0;
    const som = rijen.reduce((s, r) => s + r.aantal, 0);
    T.check(opLoc === m.qty, `${m.naam}: ${m.qty} op Betekom na lossen (kreeg ${opLoc})`);
    T.check(thuis === bezit[m.bak_id] - m.qty, `${m.naam}: thuis = bezit ${bezit[m.bak_id]} − ${m.qty} = ${bezit[m.bak_id] - m.qty} (kreeg ${thuis})`);
    T.check(som === bezit[m.bak_id], `${m.naam}: som spreiding = bezit ${bezit[m.bak_id]} (kreeg ${som})`);
  }
  // ── taak + rit automatisch gedaan na volledig lossen ──
  const taak = ((await A('GET', '/api/transport-taken')).json || []).find((x) => x.id === taakId);
  T.check(taak?.status === 'gedaan', `taak #${taakId} 'gedaan' na volledig lossen (kreeg '${taak?.status}')`);
  const rit = ((await A('GET', '/api/ritten')).json || []).find((x) => x.id === ritId);
  T.check(rit?.status === 'gedaan', `rit #${ritId} 'gedaan' na volledig lossen (kreeg '${rit?.status}')`);

  // ── opnieuw gedaan zetten = geen tweede boeking ──
  await A('PUT', `/api/transport-taken/${taakId}/status`, { status: 'gedaan' });
  const sp2 = await spreidingStand();
  await A('PUT', `/api/transport-taken/${taakId}/status`, { status: 'gepland' });
  await A('PUT', `/api/transport-taken/${taakId}/status`, { status: 'gedaan' });
  const sp3 = await spreidingStand();
  for (const m of bulkRegels) {
    const som3 = (sp3[m.bak_id] || []).reduce((s, r) => s + r.aantal, 0);
    T.check(JSON.stringify(sp3[m.bak_id]) === JSON.stringify(sp2[m.bak_id]), `${m.naam}: gepland→gedaan opnieuw verandert de spreiding niet (${JSON.stringify((sp2[m.bak_id] || []).map((r) => r.aantal + '@' + r.locatie_id))} → ${JSON.stringify((sp3[m.bak_id] || []).map((r) => r.aantal + '@' + r.locatie_id))})`);
    T.check(som3 === bezit[m.bak_id], `${m.naam}: som blijft ${bezit[m.bak_id]}, nooit meer dan het bezit (kreeg ${som3})`);
  }
} catch (e) { T.fout('onverwachte fout: ' + (e.stack || e)); }
await T.einde(srv);
