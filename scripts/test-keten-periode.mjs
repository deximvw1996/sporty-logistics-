// test-keten-periode.mjs — bewaakt WERKLIJST 7, 8 · DOORLICHTING-b F2/F3/R11 · T-G7.
// Gewenst (CLAUDE.md regel 5, DRAAIBOEK 0.7/1.1/9.2): alles periode-gestuurd. Een tweede, niet-actieve
// periode "Zomer TEST" met een kampmoment op dezelfde locatie, dezelfde week 1 en hetzelfde thema mag
// de herfst niet beïnvloeden: geen valse conflicten, geen zomer-sport/kleurenborden in de herfstvoorstellen,
// en de actieve periode blijft "Herfst TEST" na een herstart.
import * as T from './_testhulp.mjs';
const POORT = parseInt(process.env.TEST_POORT || '3325');
const ijk = T.leesIjk();
let srv = await T.startServer({ poort: POORT });
try {
  let tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const herfst = ijk.periode.id, betekom = ijk.locaties.betekom, thema = ijk.themas.alles_op_wieltjes;
  const herfstKms = Object.values(ijk.kampmomenten);

  // ── Zomer TEST (niet actief) ──
  const zp = await A('POST', '/api/periodes', { naam: 'Zomer TEST', start_datum: '2027-07-05', eind_datum: '2027-08-29' });
  T.check(zp.status === 200, `periode Zomer TEST aanmaken → 200 (kreeg ${zp.status})`);
  const zomer = zp.json.id;
  const maakKm = async (loc) => {
    const r = await A('POST', '/api/kampmomenten', { locatie_id: loc, week: 1, periode_id: zomer, type: 'kamp' });
    if (r.status === 200) await A('POST', `/api/kampmomenten/${r.json.id}/themas`, { thema_id: thema, dag: null });
    return r;
  };
  const zSame = await maakKm(betekom);
  T.check(zSame.status === 200, `zomer-kampmoment op Betekom week 1 kan naast het herfst-kampmoment Betekom week 1 bestaan (kreeg ${zSame.status} ${zSame.json?.error || ''})`);
  // Zelfde thema, zelfde week 1, andere locatie in de zomer: lokt dubbel_thema/dubbelboeking uit als de detectie periodes mengt.
  const locs = (await A('GET', '/api/locaties')).json || [];
  const boutersem = locs.find((l) => l.name === 'Boutersem')?.id;
  const zAnder = await maakKm(boutersem);
  T.check(zAnder.status === 200, `zomer-kampmoment op Boutersem week 1 met hetzelfde thema → 200 (kreeg ${zAnder.status})`);
  // Zomer-kleurenborden en zomer-sport op dezelfde locatie+week
  await A('POST', '/api/kleurenborden', { locatie_id: betekom, week: 1, kleur: 'ZOMERROOD', aantal: 3, periode_id: zomer });
  const sport = (await A('GET', '/api/sport')).json || [];
  const set = sport.flatMap((i) => (i.sets || []).map((s) => ({ ...s, item: i.name }))).find((s) => !(s.planning || []).length);
  if (set) await A('POST', `/api/sport/sets/${set.id}/plan`, { week: 1, locatie_id: betekom, periode_id: zomer });
  T.info(`zomer-sportset gepland: ${set ? set.item + ' — ' + set.label : 'geen vrije set gevonden'}`);

  // ── Conflicten voor de actieve (herfst)periode ──
  const cf = await A('GET', `/api/conflicten?periode_id=${herfst}`);
  T.check(cf.status === 200, `conflicten → 200 (kreeg ${cf.status})`);
  const lek = (cf.json || []).filter((c) => /dubbel_thema|dubbelboeking/.test(c.type) && /Boutersem/.test(c.bericht));
  T.check(lek.length === 0, `geen dubbel_thema/dubbelboeking tussen herfst en zomer (kreeg ${lek.length}: ${lek.map((c) => c.type).join(', ')})`);
  const zonderPeriode = (cf.json || []).filter((c) => /^Week \d+ — /.test(c.bericht) && !/Herfst TEST|Zomer TEST/.test(c.bericht));
  T.check(zonderPeriode.length === 0, `conflictmeldingen noemen de periode (kreeg ${zonderPeriode.length} zonder)`);

  // ── Generator: herfstvoorstellen bevatten geen zomer-sport of zomer-kleurenborden ──
  const gen = (await A('POST', '/api/transport-genereer')).json || [];
  const herfstV = gen.filter((v) => (v.locatie_id === betekom || herfstKms.includes(v.kampmoment_id)) && v.datum >= '2026-10-01' && v.datum <= '2026-11-30');
  T.check(herfstV.length > 0, `er zijn herfstvoorstellen voor Betekom (${herfstV.length})`);
  const sportInHerfst = herfstV.flatMap((v) => v.materiaal.filter((m) => m.soort === 'sport'));
  T.check(sportInHerfst.length === 0, `geen zomer-sportsets in de herfstvoorstellen (kreeg ${sportInHerfst.map((m) => m.naam).join(', ') || 0})`);
  const kleurInHerfst = herfstV.flatMap((v) => v.materiaal.filter((m) => /ZOMERROOD/.test(m.naam)));
  T.check(kleurInHerfst.length === 0, `geen zomer-kleurenborden in de herfstvoorstellen (kreeg ${kleurInHerfst.length})`);
  const zKm = zAnder.json?.id;
  const zomerV = gen.filter((v) => v.kampmoment_id === zKm);
  T.check(zomerV.length > 0 && zomerV.every((v) => v.datum >= '2027-07-01' && v.datum <= '2027-07-31'), `het zomer-kampmoment (Boutersem) krijgt zijn eigen voorstellen in juli 2027 (kreeg ${zomerV.map((v) => v.datum).join(', ') || 'geen'})`);

  // ── Actieve periode blijft Herfst TEST na herstart ──
  const actief = (rijen) => (rijen || []).filter((p) => p.actief === 1 || p.actief === true || p.is_actief === 1);
  let per = (await A('GET', '/api/periodes')).json;
  T.check(actief(per).length === 1 && actief(per)[0].naam === 'Herfst TEST', `de actieve periode is Herfst TEST (kreeg ${JSON.stringify(actief(per).map((p) => p.naam))}; velden: ${Object.keys(per?.[0] || {}).join(',')})`);
  await srv.stop();
  srv = await T.startServer({ poort: POORT, verseMap: false });
  tok = await T.login(srv.base);
  per = (await T.api(srv.base, tok, 'GET', '/api/periodes')).json;
  T.check(actief(per).length === 1 && actief(per)[0].naam === 'Herfst TEST', `na herstart is de actieve periode nog Herfst TEST (kreeg ${JSON.stringify(actief(per).map((p) => p.naam))})`);
  T.check((per || []).some((p) => p.naam === 'Zomer TEST'), 'Zomer TEST bestaat nog na herstart (schrijven naar schijf werkt)');
} catch (e) { T.fout('onverwachte fout: ' + (e.stack || e)); }
await T.einde(srv);
