// test-tf14.mjs — TF14: kampen op Planning ploeg, naam van de helper in melding en Nu oplossen, afgerond door.
import * as T from './_testhulp.mjs';
const ijk = T.leesIjk(), srv = await T.startServer({ poort: Number(process.env.TEST_POORT) || 3386 }), v = T.check;
try {
  const tok = await T.login(srv.base), A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const mens = async (n, pin, tel) => { const x = (await A('POST', '/api/personeel', { naam: n, rol: 'chauffeur', telefoon: tel })).json; await A('POST', `/api/personeel/${x.id}/pincode`, { pincode: pin }); return { id: x.id, tok: await T.login(srv.base, x.id, pin) }; };
  const jer = await mens('Tg Jeroen', '5901', '0470000001'), jes = await mens('Tg Jesse', '5902', '0470000002');
  const km = ijk.kampmomenten.abdijschool, kt = await T.kvToken(srv.base, tok, km), dag = (await T.api(srv.base, null, 'GET', `/api/kv/${kt}/data`)).json.dagen.van;
  const J = (m, p, b) => T.api(srv.base, jes.tok, m, p, b);
  // Kampen
  const pp = await J('GET', '/api/planning-ploeg?datum=' + dag), k = pp.json.kampen.find((x) => /Abdij/.test(x.locatie));
  v(pp.status === 200 && k && k.themas.length && k.dagen.length && 'kv' in k, `kampen: ${k && k.locatie}, ${k && k.dagen.join(' ')}`);
  v(!/telefoon|gsm|email|kv_token|pincode/i.test(JSON.stringify(pp.json.kampen)), 'geen telefoon of token');
  v((await J('POST', `/api/kampmomenten/${km}/themas`, { thema_id: 1 })).status === 403 && (await J('GET', '/api/kampmomenten')).status === 403, 'schrijven en kantoorroutes 403');
  // Helper
  const o = (await A('POST', '/api/opdrachten', { datum: dag, vertrek: '08:00', personeel_id: jer.id })).json, rit = o.wagens[0].rit_id;
  const t = (await A('POST', `/api/ritten/${rit}/stops`, { type: 'levering', van_locatie_id: ijk.locaties.rozenweg, naar_locatie_id: ijk.locaties.abdijschool, tijd: '09:00' })).json.taak_id;
  for (const n of ['Een', 'Twee', 'Drie']) await A('POST', `/api/transport-taken/${t}/regels`, { bron: 'tekst', naam: n, qty: 2 });
  await A('POST', `/api/opdrachten/${o.id}/klaarzet`);
  const tk = (await J('GET', '/api/meehelpen/' + rit)).json.token, raw = async (m, p, b, h) => { const r = await fetch(`${srv.base}/api/rit-token/${tk}${p}`, { method: m, headers: { 'Content-Type': 'application/json', ...h }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, json: await r.json() }; };
  const H = { 'x-auth-token': jes.tok }, regs = (await raw('GET', '/data', null, H)).json.stops[0].regels.map((r) => r.check_id);
  await raw('POST', `/checks/${regs[0]}/niet-mee`, { reden: 'niet_gevonden' }, H);
  const m = (await A('GET', '/api/meldingen')).json.meldingen.find((x) => x.tekst.includes(`rit #${rit} `));
  v(m && m.tekst.startsWith('Tg Jesse (helpt) · rit #' + rit), `melding: ${m && m.tekst}`);
  const blok = (await A('GET', '/api/nu-oplossen')).json.ritten.find((r) => r.rit_id === rit);
  v(blok.chauffeur === 'Tg Jeroen' && blok.telefoon === '0470000001' && blok.bellen[0].telefoon === '0470000002' && blok.bellen[0].helpt && blok.items[0].door === 'Tg Jesse', 'Nu oplossen belt de helper en toont de bestuurder');
  await raw('POST', `/checks/${regs[1]}/niet-mee`, { reden: 'kapot' }, { 'x-auth-token': jer.tok });
  const m2 = (await A('GET', '/api/meldingen')).json.meldingen.find((x) => x.tekst.includes(`rit #${rit} `));
  v(/Tg Jesse \(helpt\), Tg Jeroen · rit/.test(m2.tekst), `gebundeld, beide namen: ${m2.tekst}`);
  // Afronden
  await raw('POST', '/alles', { actie: 'laden', check_ids: [regs[2]] }, H); await raw('POST', '/alles', { actie: 'lossen', check_ids: [regs[2]] }, H);
  const d = (await raw('GET', '/data', null, H)).json;
  v(d.stops[0].status === 'gedaan' && d.stops[0].afgerond_door === 'Tg Jesse', 'stop: afgerond door de helper');
  v(d.rit.status === 'gedaan', 'de rit sluit vanzelf, zoals afgesproken');
  await new Promise((r) => setTimeout(r, 800));
  const lg = await T.leesDb(srv.dbPad, "SELECT beschrijving AS b FROM activiteiten_log WHERE actie IN ('stop afgerond','rit afgerond') ORDER BY id");
  v(lg.length === 2 && lg.every((x) => /Tg Jesse \(helpt\)/.test(x.b)), 'log: stop en rit met de naam');
  v((await A('GET', `/api/opdrachten/${o.id}`)).json.wagens[0].stops[0].afgerond_door === 'Tg Jesse', 'ook in de opdracht');
} catch (e) { T.fout('uitzondering: ' + e.message + ' ' + e.stack); console.log(srv.log().slice(-1200)); }
await T.einde(srv);
