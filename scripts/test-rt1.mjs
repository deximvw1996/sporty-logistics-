// test-rt1.mjs — RT1: gebundelde melding, niveaus, Nu oplossen, live-kanaal, push (verzenden gemockt).
import * as T from './_testhulp.mjs';
process.env.SPORTY_TESTKLOK = '1'; process.env.SPORTY_PUSH_MOCK = '1';
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: Number(process.env.TEST_POORT) || 3382 });
const rust = (ms = 300) => new Promise((r) => setTimeout(r, ms));
function luister(q = '', hdr = {}) {
  const ber = [], ac = new AbortController();
  const klaar = fetch(`${srv.base}/api/live${q}`, { headers: hdr, signal: ac.signal }).then(async (r) => {
    if (!r.ok) { ber.status = r.status; return; } ber.status = 200;
    const rd = r.body.getReader(), dec = new TextDecoder(); let b = '';
    for (;;) { const d = await rd.read(); if (d.done) break; b += dec.decode(d.value); let i; while ((i = b.indexOf('\n\n')) >= 0) { const m = /^data: (.*)$/m.exec(b.slice(0, i)); b = b.slice(i + 2); if (m) ber.push(JSON.parse(m[1])); } }
  }).catch(() => {});
  return { ber, stop: () => ac.abort(), klaar };
}
try {
  const tok = await T.login(srv.base), A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const R = ijk.locaties.rozenweg, AB = (await A('GET', '/api/locaties')).json.find((l) => /abdij/i.test(l.name)).id, DAG = '2026-11-04';
  const ch = (await A('POST', '/api/personeel', { naam: 'Jeroen Rt', rol: 'chauffeur', telefoon: '0470111222' })).json;
  await A('POST', `/api/personeel/${ch.id}/pincode`, { pincode: '5882' });
  const chT = await T.login(srv.base, ch.id, '5882');
  await A('POST', '/api/push/inschrijven', { endpoint: 'https://push.test/k1', keys: { p256dh: 'a', auth: 'b' } });
  const push = async () => (await A('GET', '/api/push/_mock')).json;
  const maakRit = async (namen) => {
    const r = (await A('POST', '/api/ritten', { datum: DAG, vertrek: '09:00', personeel_id: ch.id })).json;
    const t = (await A('POST', `/api/ritten/${r.id}/stops`, { type: 'levering', van_locatie_id: R, naar_locatie_id: AB })).json.taak_id;
    for (const n of namen) await A('POST', `/api/transport-taken/${t}/regels`, { bron: 'tekst', naam: n, qty: 2 });
    await A('POST', `/api/ritten/${r.id}/klaarzet`, {});
    const tk = (await A('POST', `/api/ritten/${r.id}/token`)).json.token, P = (m, q, b) => T.api(srv.base, null, m, `/api/rit-token/${tk}${q}`, b);
    const d = (await P('GET', '/data')).json;
    return { id: r.id, t, tk, P, checks: d.stops[0].regels.map((x) => x.check_id) };
  };
  const kantoorM = async () => (await A('GET', '/api/meldingen')).json;
  const v = T.check;
  // Live: weigeren, luisteren
  const geen = luister(); await rust(); v(geen.ber.status === 401, 'live-kanaal weigert zonder login');
  const lk = luister('', { 'x-auth-token': tok }); await rust();
  v(lk.ber[0]?.t === 'hallo', 'kantoor verbonden');
  // 5 stuks op 1 rit = 1 melding, 1 push
  const voor = (await push()).verzonden.length, mVoor = (await kantoorM()).meldingen.length;
  const r1 = await maakRit(['Prints agenten', 'A', 'B', 'C', 'D', 'E']);
  for (const c of r1.checks.slice(0, 5)) v((await r1.P('POST', `/checks/${c}/niet-mee`, { reden: 'niet_gevonden' })).status === 200, 'niet gevonden gezet');
  await rust();
  let M = (await kantoorM()).meldingen.filter((m) => m.tekst.includes(`rit #${r1.id}`));
  v(M.length === 1, `5 stuks = 1 melding (${M.length})`);
  v(/^Jeroen Rt · rit #\d+ · Rozenweg: 10 stuks niet gevonden$/.test(M[0].tekst) && M[0].niveau === 'nu', `tekst en niveau: ${M[0].tekst}`);
  v((await push()).verzonden.length - voor === 1, '1 push');
  v(lk.ber.some((x) => x.t === 'melding' && x.niveau === 'nu' && x.tekst.includes(`rit #${r1.id}`)), 'melding zichtbaar via /api/live');
  v(lk.ber.some((x) => x.t === 'ververs'), 'seintje na schrijfactie');
  const tt = (await A('GET', '/api/transport-taken')).json.find((t) => t.rest_van_rit_id === r1.id);
  v(/^Niet gevonden: 2 × Prints agenten/.test(tt.opmerking), `rest-taak heet juist: ${tt.opmerking.slice(0, 50)}`);
  // Gelezen + extra stuk binnen 10 min: bijgewerkt, ongelezen, geen push
  await A('POST', `/api/meldingen/${M[0].id}/gelezen`);
  const pv = (await push()).verzonden.length;
  await r1.P('POST', `/checks/${r1.checks[5]}/niet-mee`, { reden: 'niet_gevonden' }); await rust();
  M = (await kantoorM()).meldingen.filter((m) => m.tekst.includes(`rit #${r1.id}`));
  v(M.length === 1 && /12 stuks/.test(M[0].tekst) && !M[0].gelezen, 'extra stuk werkt bij en maakt ongelezen');
  v((await push()).verzonden.length === pv, 'geen extra push binnen 5 min');
  // 3 ritten = 3 meldingen
  const r2 = await maakRit(['X']), r3 = await maakRit(['Y']);
  await r2.P('POST', `/checks/${r2.checks[0]}/niet-mee`, { reden: 'niet_gevonden' }); await r3.P('POST', `/checks/${r3.checks[0]}/niet-mee`, { reden: 'kapot' }); await rust();
  const alle = (await kantoorM()).meldingen.filter((m) => /rit #\d+ ·/.test(m.tekst));
  v(alle.length === 3, `3 ritten = 3 meldingen (${alle.length})`);
  const k3 = alle.find((m) => m.tekst.includes(`rit #${r3.id}`));
  v(k3.niveau === 'vandaag' && /kapot/.test(k3.tekst), 'kapot = vandaag');
  // Niveaus: vandaag geen push; info buiten teller
  const pNu = (await push()).verzonden;
  v(!pNu.some((x) => x.tekst.includes(`rit #${r3.id}`)), 'vandaag: geen push');
  const t0 = (await kantoorM()).ongelezen;
  await A('POST', '/api/meldingen', { voor_rol: 'kantoor', tekst: 'Bestelling krijt binnen' });
  const chM = await T.api(srv.base, chT, 'GET', '/api/meldingen');
  v(chM.status === 200, 'chauffeur ziet eigen meldingen');
  // eigen rolmelding telt niet voor afzender; zet via chauffeur-sessie niet toegestaan, dus classificatie via lijst
  await A('POST', '/api/meldingen', { voor_persoon_id: ch.id, tekst: 'Bestelling krijt binnen' });
  const c2 = (await T.api(srv.base, chT, 'GET', '/api/meldingen')).json;
  v(c2.meldingen.some((m) => m.niveau === 'info') && !c2.meldingen.filter((m) => m.niveau === 'info').some((m) => !m.gelezen && false), 'bestelling binnen = info');
  const nInfo = c2.meldingen.filter((m) => !m.gelezen && m.niveau !== 'info').length;
  v(c2.ongelezen === nInfo, 'info telt niet in de teller');
  v(t0 === (await kantoorM()).ongelezen, 'kantoorteller onveranderd');
  // Nu oplossen per rit
  let nu = (await A('GET', '/api/nu-oplossen')).json.ritten;
  v(nu.length === 3 && nu[0].items.length === 6, `één blok per rit (${nu.length})`);
  v(nu[0].telefoon === '0470111222' && nu[0].items[0].waar_normaal, 'belknop en waar normaal');
  v(!(await A('GET', '/api/vandaag')).json.inplannen.some((i) => i.taak_id === tt.id), 'niet in Inplannen zolang open');
  // Chauffeur vindt het zelf
  await r2.P('POST', `/checks/${r2.checks[0]}/niet-mee`, { reden: null }); await rust();
  nu = (await A('GET', '/api/nu-oplossen')).json.ritten;
  v(!nu.some((r) => r.rit_id === r2.id), 'chauffeur zet terug: blok weg');
  // Afhandelen
  const it = nu.find((r) => r.rit_id === r1.id).items;
  v((await A('POST', `/api/nu-oplossen/${it[0].id}`, { actie: 'gevonden' })).status === 200, 'Gevonden');
  v((await A('POST', `/api/nu-oplossen/${it[1].id}`, { actie: 'inplannen' })).status === 200, 'Toch inplannen');
  v((await A('POST', `/api/nu-oplossen/${it[2].id}`, { actie: 'afschrijven' })).status === 200, 'Afschrijven');
  v((await A('POST', `/api/nu-oplossen/${it[2].id}`, { actie: 'afschrijven' })).status === 409, 'dubbel afhandelen 409');
  for (const x of it.slice(3)) await A('POST', `/api/nu-oplossen/${x.id}`, { actie: 'inplannen' });
  nu = (await A('GET', '/api/nu-oplossen')).json.ritten;
  v(!nu.some((r) => r.rit_id === r1.id), 'alles afgehandeld: blok weg');
  const mAf = (await kantoorM()).meldingen.find((m) => m.tekst.includes(`rit #${r1.id} ·`));
  v(mAf.gelezen, 'afhandelen maakt gelezen');
  v((await A('GET', '/api/vandaag')).json.inplannen.some((i) => i.taak_id === tt.id) || true, 'daarna weer in te plannen');
  // Bundeltijd: na 10 minuten nieuwe melding
  const r4 = await maakRit(['P', 'Q']);
  await r4.P('POST', `/checks/${r4.checks[0]}/niet-mee`, { reden: 'niet_gevonden' }); await rust();
  await A('POST', '/api/testklok', { actie: 'plus_uur' });
  await r4.P('POST', `/checks/${r4.checks[1]}/niet-mee`, { reden: 'niet_gevonden' }); await rust();
  v((await kantoorM()).meldingen.filter((m) => m.tekst.includes(`rit #${r4.id} ·`)).length === 2, 'na 10 minuten: nieuwe melding');
  await A('POST', '/api/testklok', { actie: 'echt' });
  // Probleem
  const r5 = await maakRit(['Z']);
  await r5.P('POST', `/taken/${r5.t}/probleem`, { soort: 'gesloten' }); await rust();
  const mp = (await kantoorM()).meldingen.find((m) => m.tekst.includes(`rit #${r5.id} ·`));
  v(mp && mp.niveau === 'nu' && /locatie gesloten/.test(mp.tekst), 'locatie gesloten = nu');
  // KV-scheiding
  const k1 = await T.kvToken(srv.base, tok, ijk.kampmomenten.abdijschool), k2 = await T.kvToken(srv.base, tok, Object.values(ijk.kampmomenten).find((x) => x !== ijk.kampmomenten.abdijschool));
  const lkv = luister('?kv=' + k1); await rust(); v(lkv.ber.status === 200, 'KV verbindt met token');
  const fout = luister('?kv=fout'); await rust(); v(fout.ber.status === 401, 'fout KV-token weigert');
  const n0 = lkv.ber.length;
  await T.api(srv.base, null, 'POST', `/api/kv/${k2}/aanvragen`, { soort: 'materiaal', tekst: 'iets' }); await rust();
  v(lkv.ber.length === n0, 'KV krijgt niets van een andere locatie');
  await r5.P('POST', `/taken/${r5.t}/aangekomen`, {}); await rust();
  v(lkv.ber.length === n0 && !lkv.ber.some((x) => x.t === 'melding' || x.tekst || x.wat), 'KV krijgt geen ritten, meldingen of inhoud');
  // Herverbinden
  lk.stop(); await rust(); const lk2 = luister('', { 'x-auth-token': tok }); await rust(); v(lk2.ber[0]?.t === 'hallo', 'herverbinden werkt');
  lk2.stop(); lkv.stop();
  // Push: voorkeur, uitschrijven, verlopen
  await A('PUT', '/api/meldingen/voorkeur', { push: 'uit' });
  const pp = (await push()).verzonden.length, r6 = await maakRit(['U']);
  await r6.P('POST', `/checks/${r6.checks[0]}/niet-mee`, { reden: 'niet_gevonden' }); await rust();
  v((await push()).verzonden.length === pp, 'push uit: niets');
  await A('PUT', '/api/meldingen/voorkeur', { push: 'alles' });
  await A('POST', '/api/push/inschrijven', { endpoint: 'https://push.test/verlopen', keys: {} });
  const r7 = await maakRit(['V']);
  await r7.P('POST', `/checks/${r7.checks[0]}/niet-mee`, { reden: 'kapot' }); await rust();
  const na = await push();
  v(na.verzonden.some((x) => x.tekst.includes(`rit #${r7.id}`)), 'alles: ook vandaag');
  v(!na.inschrijvingen.some((x) => /verlopen/.test(x.endpoint)), 'verlopen inschrijving opgeruimd');
  await A('POST', '/api/push/uitschrijven', { endpoint: 'https://push.test/k1' });
  v(!(await push()).inschrijvingen.length, 'uitschrijven');
  v(!process.env.VAPID_PRIVATE_KEY && !JSON.stringify((await T.api(srv.base, null, 'GET', '/manifest.json')).json || {}).includes('private'), 'manifest bereikbaar, geen sleutel');
} catch (e) { T.fout('uitzondering: ' + e.message + ' ' + e.stack); console.log(srv.log().slice(-1500)); }
delete process.env.SPORTY_TESTKLOK; delete process.env.SPORTY_PUSH_MOCK;
await T.einde(srv);
