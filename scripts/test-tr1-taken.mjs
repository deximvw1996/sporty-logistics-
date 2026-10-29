// test-tr1-taken.mjs — TR1 (chat C): Transport › Taken. GET /api/taken-overzicht (tellers, soort/pil/wat/route),
// GET /api/taken/:id/detail (regels, rit + stops + is_deze, checks, kampmoment, historiek), bulk-move, bulk-delete 409,
// de pagina /taken, en Vandaag/Ritplanning laden patroon.css. Eigen server via _testhulp (poort 3336, herfst-test.db).
import * as T from './_testhulp.mjs';
const POORT = parseInt(process.env.TEST_POORT || '3336');
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: POORT });
const BASIC = 'Basic ' + Buffer.from('sporty:' + T.APP_PASSWORD).toString('base64');
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const R = ijk.locaties.rozenweg, AB = ijk.locaties.abdijschool, BE = ijk.locaties.betekom;
  const kmAB = ijk.kampmomenten.abdijschool;
  const mk = async (b) => { const r = await A('POST', '/api/transport-taken', { tijd: '09:00', ...b }); if (r.status !== 200) T.fout('taak ' + r.text); return r.json.id; };
  // contact + KV-telefoon voor het kampmoment-blok
  const locAB = (await A('GET', '/api/locaties')).json.find((l) => l.id === AB);
  await A('PUT', `/api/locaties/${AB}`, { ...locAB, contact_naam: 'Conciërge', contact_telefoon: '0470 11 22 33', sleutel_info: 'sleutel bij de buren' });
  const bak = (await A('GET', '/api/alle-bakken')).json.flatMap((t) => t.bakken || []).find((b) => b.code === 'N20');

  // ── 6 taken in kampweek 1 ──
  const t1 = await mk({ type: 'levering', datum: '2026-11-06', tijd: '08:15', van_locatie_id: R, naar_locatie_id: AB, kampmoment_id: kmAB,
    regels: [{ naam: `Bak ${bak.naam} (N20)`, qty: 1, soort: 'thema', bak_id: bak.id }, { naam: 'Vaste bak EHBO', qty: 2, soort: 'vast' }, { naam: 'Springkasteel', qty: 2, soort: 'attribuut', attribuut_id: 4 }] });
  const t2 = await mk({ type: 'levering', datum: '2026-11-06', tijd: '10:00', van_locatie_id: R, naar_locatie_id: BE, regels: [{ naam: 'Vaste bak sport', qty: 14, soort: 'vast' }] });
  const rit = (await A('POST', '/api/ritten', { datum: '2026-11-06', personeel_id: 2, voertuig: 'Camionette', taak_ids: [t1, t2] })).json.id;
  await A('PUT', `/api/transport-taken/${t2}`, { slot: 'vrij' });
  const t3 = await mk({ type: 'levering', datum: '2026-11-04', van_locatie_id: R, naar_locatie_id: BE, regels: [{ naam: 'Oven', qty: 1, soort: 'attribuut', attribuut_id: 4 }] });
  const t4 = await mk({ type: 'ophaling', datum: '2026-11-06', van_locatie_id: AB, naar_locatie_id: R, kampmoment_id: kmAB, regels: [{ naam: 'Vaste bak EHBO', qty: 11, soort: 'vast' }] });
  const t5 = await mk({ type: 'levering', datum: '2026-11-06', van_locatie_id: R, naar_locatie_id: AB, opmerking: `Rest van rit #${rit}: past niet`, regels: [{ naam: 'Oven', qty: 1, soort: 'attribuut' }] });
  const aanv = (await A('POST', '/api/aanvragen', { kampmoment_id: kmAB, soort: 'materiaal', tekst: 'ballen' })).json.id;
  const ga = await A('PUT', `/api/aanvragen/${aanv}/status`, { status: 'goedgekeurd', maak_spoedtransport: true, spoedtransport: { datum: '2026-11-05', item: 'ballen', aantal: 6 } });
  const t6 = ga.json.spoed_taak_id;
  const t7 = await mk({ type: 'levering', datum: '2026-11-07', van_locatie_id: R, naar_locatie_id: BE, regels: [{ naam: 'Springkasteel', qty: 3, soort: 'attribuut' }] });

  // ── overzicht ──
  let r = await A('GET', '/api/taken-overzicht?week=2026-11-04');
  T.check(r.status === 200, 'GET /api/taken-overzicht → 200');
  const o = r.json, tk = (id) => o.taken.find((x) => x.id === id);
  T.check(o.week.start === '2026-11-02' && o.week.eind === '2026-11-08', `week ${o.week.start}…${o.week.eind}`);
  const ids = [t1, t2, t3, t4, t5, t6, t7];
  T.check(ids.every((id) => tk(id)), `alle 7 taken in de lijst (${ids.filter((id) => !tk(id)).length} ontbreken)`);
  const tel = o.tellers;
  T.check(tel.deze_week === o.taken.length && tel.zonder_rit === o.taken.filter((t) => !t.rit && t.status !== 'gedaan').length, `tellers deze_week ${tel.deze_week}, zonder_rit ${tel.zonder_rit}`);
  T.check(tel.levering === o.taken.filter((t) => t.type === 'levering').length && tel.ophaling >= 1 && tel.rest === 1 && tel.weekend === 1 && tel.gedaan === 0, `tellers ${JSON.stringify(tel)}`);
  T.check(tk(t1).soort === 'levering' && tk(t1).pil === null && tk(t1).wat === '3 bakken + Springkasteel ×2' && tk(t1).route === 'Rozenweg → Abdijschool Vlierbeek' && tk(t1).rit.id === rit && tk(t1).wanneer_tekst === 'vr 6 nov 08:15', `t1: ${JSON.stringify({ s: tk(t1).soort, p: tk(t1).pil, w: tk(t1).wat, r: tk(t1).route, q: tk(t1).wanneer_tekst })}`);
  T.check(tk(t2).pil === 'vrij' && tk(t2).wat === '14 bakken', `t2: pil ${tk(t2).pil}, wat "${tk(t2).wat}"`);
  T.check(tk(t3).rit === null && tk(t3).wat === 'Oven ×1' && tk(t3).wanneer_tekst === 'wo 4 nov', `t3 zonder rit: "${tk(t3).wat}", "${tk(t3).wanneer_tekst}"`);
  T.check(tk(t4).soort === 'ophaling' && tk(t5).soort === 'rest' && tk(t5).pil === 'rest' && tk(t6)?.soort === 'aanvraag' && tk(t7).pil === 'weekend', `soorten: ${tk(t4).soort}/${tk(t5).soort}/${tk(t6)?.soort}, pillen rest/weekend: ${tk(t5).pil}/${tk(t7).pil}`);
  r = await A('GET', '/api/taken-overzicht?week=2026-11-04&alle=1');
  T.check(r.status === 200 && r.json.bereik.alle && r.json.taken.length >= o.taken.length, `?alle=1: ${r.json.taken.length} taken van de periode`);

  // ── detail ──
  r = await A('GET', `/api/taken/${t1}/detail`);
  const d = r.json;
  T.check(r.status === 200 && d.regels.length === 3 && d.regels[0].code === 'N20' && d.regels.every((x) => x.id && x.naam && x.qty && x.soort), `detail regels: ${d.regels.map((x) => (x.code || '-') + ' ' + x.naam + ' ×' + x.qty).join(' | ')}`);
  T.check(d.rit && d.rit.id === rit && d.rit.stops.length === 2 && d.rit.stops.filter((s) => s.is_deze).length === 1 && d.rit.stops[0].is_deze && d.rit.stops[1].slot === 'vrij' && d.rit.capaciteit === 20, `rit #${d.rit?.id}: ${d.rit?.stops.map((s) => s.naam + '/' + s.slot + (s.is_deze ? '*' : '')).join(' → ')}`);
  T.check(d.checks && 'geladen' in d.checks && 'gelost' in d.checks && d.checks.totaal >= 3 && d.checks.klaargezet === false, `checks ${JSON.stringify(d.checks)}`);
  T.check(d.kampmoment && d.kampmoment.locatie === 'Abdijschool Vlierbeek' && d.kampmoment.kv_naam && d.kampmoment.contact_telefoon === '0470 11 22 33' && d.kampmoment.sleutel_info, `kampmoment ${JSON.stringify(d.kampmoment)}`);
  T.check(d.gekoppeld && d.gekoppeld.ophaling_taak_id === t4, `gekoppeld: ${d.gekoppeld?.tekst}`);
  T.check(d.historiek.length >= 2 && d.historiek.every((h) => h.wat && 'wijziging_id' in h), `historiek ${d.historiek.length} regels: ${d.historiek.slice(0, 3).map((h) => h.wat).join(' | ')}`);
  r = await A('GET', '/api/taken/999999/detail');
  T.check(r.status === 404, 'onbekende taak → 404');

  // ── bulk ──
  const rit2 = (await A('POST', '/api/ritten', { datum: '2026-11-06', personeel_id: 3, voertuig: 'Camion' })).json.id;
  r = await A('POST', '/api/transport-taken/bulk-move', { ids: [t4, t5], rit_id: rit2 });
  const o2 = (await A('GET', '/api/taken-overzicht?week=2026-11-04')).json;
  T.check(r.status === 200 && o2.taken.find((x) => x.id === t4).rit?.id === rit2 && o2.taken.find((x) => x.id === t5).rit?.id === rit2, 'bulk-move zet 2 taken op een andere rit');
  const rtok = await T.ritToken(srv.base, tok, rit);
  const data = (await T.api(srv.base, null, 'GET', `/api/rit-token/${rtok}/data`)).json;
  await T.ritActie(srv.base, rtok, data.stops.find((s) => s.taak_id === t1).regels[0].check_id, 'laden');
  r = await A('POST', '/api/transport-taken/bulk-delete', { ids: [t1, t3] });
  const o3 = (await A('GET', '/api/taken-overzicht?week=2026-11-04')).json;
  T.check(r.status === 409 && o3.taken.some((x) => x.id === t3), `bulk-delete met een geladen taak → 409, niets verwijderd ("${r.json.error}")`);
  const d2 = (await A('GET', `/api/taken/${t1}/detail`)).json;
  T.check(d2.checks.geladen === 1, `checks na laden: ${d2.checks.geladen} geladen`);

  // ── niet-kantoor ──
  await A('POST', '/api/personeel/13/pincode', { pincode: '4321' });
  const tokCh = await T.login(srv.base, 13, '4321');
  r = await T.api(srv.base, tokCh, 'GET', '/api/taken-overzicht');
  const r2 = await T.api(srv.base, tokCh, 'GET', `/api/taken/${t1}/detail`);
  T.check(r.status === 403 && r2.status === 403, `chauffeur → overzicht ${r.status}, detail ${r2.status}`);

  // ── pagina's ──
  const html = await (await fetch(srv.base + '/taken', { headers: { authorization: BASIC } })).text();
  const chips = (html.match(/class="chip[ "]/g) || []).length;
  T.check(html.includes('class="sub"') && html.includes('>Ritplanning<') && html.includes('class="voet') && chips === 7, `GET /taken: subbalk, ${chips} filterchips, voet`);
  for (const p of ['/taken', '/vandaag', '/ritplanning']) {
    const res = await fetch(srv.base + p, { headers: { authorization: BASIC } });
    T.check(res.status === 200 && (await res.text()).includes('/public/patroon.css'), `${p} → 200 en laadt patroon.css`);
  }
  const css = await fetch(srv.base + '/public/patroon.css', { headers: { authorization: BASIC } });
  T.check(css.status === 200 && (await css.text()).includes('.knop{'), 'patroon.css wordt geserveerd');
} catch (e) { T.fout('onverwachte fout: ' + (e.stack || e)); }
await T.einde(srv);
