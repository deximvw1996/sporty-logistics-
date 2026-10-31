// test-tf13.mjs — TF13: twee mensen op dezelfde lijst: rit en aanvullijst, juiste naam, één voorraadwijziging, ongedaan met bevestiging, "Wie ben jij?".
import * as T from './_testhulp.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), RIT = require(T.ROOT + '/public/rit.js'), ijk = T.leesIjk();
const srv = await T.startServer({ poort: Number(process.env.TEST_POORT) || 3385 });
const v = T.check, wachtTot = async (f, ms = 15000) => { const e = Date.now() + ms; let x; while (Date.now() < e) { x = await f(); if (x) return x; await new Promise((r) => setTimeout(r, 100)); } return x; };
function luister(q, hdr = {}) {
  const ber = [], ac = new AbortController();
  fetch(`${srv.base}/api/live${q || ''}`, { headers: hdr, signal: ac.signal }).then(async (r) => { const rd = r.body.getReader(), dec = new TextDecoder(); let b = ''; for (;;) { const d = await rd.read(); if (d.done) break; b += dec.decode(d.value); let i; while ((i = b.indexOf('\n\n')) >= 0) { const m = /^data: (.*)$/m.exec(b.slice(0, i)); b = b.slice(i + 2); if (m) ber.push(JSON.parse(m[1])); } } }).catch(() => {});
  return { ber, stop: () => ac.abort() };
}
try {
  const tok = await T.login(srv.base), A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const mens = async (n, pin) => { const x = (await A('POST', '/api/personeel', { naam: n, rol: 'chauffeur' })).json; await A('POST', `/api/personeel/${x.id}/pincode`, { pincode: pin }); return { id: x.id, tok: await T.login(srv.base, x.id, pin) }; };
  const jer = await mens('Tf Jeroen', '5893'), jes = await mens('Tf Jesse', '5894');
  const R = ijk.locaties.rozenweg, X = ijk.locaties.abdijschool;
  const o = (await A('POST', '/api/opdrachten', { datum: '2026-11-04', vertrek: '08:00', personeel_id: jer.id })).json, rit = o.wagens[0].rit_id;
  await A('POST', `/api/wagens/${rit}/personen`, { personeel_id: jes.id });
  const taak = (await A('POST', `/api/ritten/${rit}/stops`, { type: 'levering', van_locatie_id: R, naar_locatie_id: X, tijd: '09:00' })).json.taak_id;
  for (const n of ['A', 'B', 'C', 'D']) await A('POST', `/api/transport-taken/${taak}/regels`, { bron: 'tekst', naam: 'Stuk ' + n, qty: 2 });
  await A('POST', `/api/opdrachten/${o.id}/klaarzet`);
  const tk = (await A('POST', `/api/ritten/${rit}/token`)).json.token;
  const raw = async (m, p, b, h) => { const r = await fetch(`${srv.base}/api/rit-token/${tk}${p}`, { method: m, headers: { 'Content-Type': 'application/json', ...h }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, json: await r.json() }; };
  const S1 = { 'x-auth-token': jer.tok }, S2 = { 'x-auth-token': jes.tok };
  const regels = async (h = S1) => (await raw('GET', '/data', null, h)).json.stops[0].regels;
  const [c1, c2, c3, c4] = (await regels()).map((r) => r.check_id);
  // Live
  const l1 = luister('?rit=' + tk), l2 = luister('?rit=' + tk); await new Promise((r) => setTimeout(r, 300));
  const n0 = l2.ber.length;
  // Gelijktijdig
  const [a, b] = await Promise.all([raw('POST', `/checks/${c1}/laden`, { gezet: true }, S2), raw('POST', `/checks/${c1}/laden`, { gezet: true }, S1)]);
  const eerste = a.json.al_gedaan ? b : a, tweede = a.json.al_gedaan ? a : b;
  v(!eerste.json.al_gedaan && tweede.json.al_gedaan, 'gelijktijdige tik: één keer gedaan');
  v(tweede.json.door === eerste.json.geladen_door, `de tweede ziet: Al gedaan door ${tweede.json.door}`);
  await wachtTot(() => l2.ber.length > n0);
  v(l2.ber.slice(n0).some((x) => x.t === 'ververs'), 'de andere gsm krijgt een sein via /api/live');
  const r1 = (await regels()).find((r) => r.check_id === c1);
  v(r1.geladen_door === eerste.json.geladen_door, `naam bij het stuk: ${r1.geladen_door}`);
  const doorA = r1.geladen_door, ikA = doorA === 'Tf Jeroen' ? S1 : S2, andereH = doorA === 'Tf Jeroen' ? S2 : S1, andereNaam = doorA === 'Tf Jeroen' ? 'Tf Jesse' : 'Tf Jeroen';
  const akt = (await raw('GET', '/data', null, andereH)).json.actief;
  v(akt.includes('Tf Jeroen') && akt.includes('Tf Jesse'), 'ook bezig: beide namen');
  // Ongedaan
  const u0 = await raw('POST', `/checks/${c1}/laden`, { gezet: false }, andereH);
  v(u0.status === 409 && u0.json.code === 'ander' && u0.json.door === doorA, 'wat een ander deed: bevestiging met de naam');
  v((await regels()).find((r) => r.check_id === c1).geladen, 'blijft geladen zolang niet bevestigd');
  v((await raw('POST', `/checks/${c1}/laden`, { gezet: false }, ikA)).status === 200, 'eigen actie terugdraaien: zonder vraag');
  await raw('POST', `/checks/${c1}/laden`, { gezet: true }, ikA);
  v((await raw('POST', `/checks/${c1}/laden`, { gezet: false, bevestigd: true }, andereH)).status === 200, 'met bevestiging kan het');
  await raw('POST', `/checks/${c1}/laden`, { gezet: true }, S2);
  // Alles geladen
  await raw('POST', `/checks/${c2}/laden`, { gezet: true }, S2);
  const al = await raw('POST', '/alles', { actie: 'laden', check_ids: [c1, c2, c3, c4] }, S1);
  v(al.json.verwerkt.length === 2 && al.json.al_gedaan === 2 && al.json.al_door.includes('Tf Jesse'), 'Alles geladen slaat over wat de ander deed en telt juist');
  const rg = await regels();
  v(rg.find((r) => r.check_id === c2).geladen_door === 'Tf Jesse' && rg.find((r) => r.check_id === c3).geladen_door === 'Tf Jeroen', 'elk stuk houdt zijn eigen naam');
  const un = await raw('POST', '/alles', { actie: 'laden', check_ids: [c1, c3], gezet: false }, S1);
  v(un.json.verwerkt.length === 1 && un.json.ander.includes('Tf Jesse'), 'Alles terug: alleen het eigen; de naam komt terug');
  await raw('POST', `/checks/${c3}/laden`, { gezet: true }, S1);
  // Lossen: voorraad en stop één keer
  const [l] = await Promise.all([raw('POST', '/alles', { actie: 'lossen', check_ids: [c1, c2, c3, c4] }, S1), raw('POST', '/alles', { actie: 'lossen', check_ids: [c1, c2, c3, c4] }, S2)]);
  const rl = await regels();
  v(rl.every((r) => r.gelost) && l.status === 200, 'lossen door twee tegelijk: alles één keer gelost');
  const gel = (await T.api(srv.base, tok, 'GET', `/api/opdrachten/${o.id}`)).json.wagens[0].stops[0];
  v(gel.gedaan_door.length === 2, `opdracht-detail toont wie: ${gel.gedaan_door.join(', ')}`);
  // Rit-link zonder login
  const xw = await raw('POST', '/alles', { actie: 'lossen', check_ids: [c1], gezet: false, bevestigd: true }, { 'x-wie': String(jes.id) });
  v(xw.status === 200, 'rit-link: x-wie van iemand op de wagen');
  const vreemd = (await A('POST', '/api/personeel', { naam: 'Vreemde', rol: 'chauffeur' })).json;
  await raw('POST', `/checks/${c1}/lossen`, { gezet: true }, { 'x-wie': String(vreemd.id) });
  v((await regels()).find((r) => r.check_id === c1).gelost_door === 'Tf Jeroen', 'iemand die niet op de wagen staat: valt terug op de bestuurder');
  // App: Wie ben jij?
  let html = '', wieW = '', calls = [];
  const d0 = (await raw('GET', '/data', null, S1)).json;
  d0.stops[0].regels.forEach((r) => { r.geladen = false; r.gelost = false; });
  const app = RIT.createApp({ token: tk, wie: { get: () => wieW, set: (x) => { wieW = x; } }, mount: (h) => { html = h; }, toast: () => {}, fetch: async (u, o2) => { calls.push({ u, h: o2 && o2.headers }); return { ok: true, status: 200, json: async () => (/\/data/.test(u) ? d0 : {}) }; } });
  await app.laad();
  await app.klik('laden', String(c2));
  v(/Wie ben jij\?/.test(html) && html.includes('Tf Jesse') && !calls.some((x) => /laden/.test(x.u)), 'losse link: eerst "Wie ben jij?"');
  await app.klik('wie-kies', String(jes.id));
  v(wieW === String(jes.id) && calls.some((x) => /laden$/.test(x.u) && x.h['x-wie'] === String(jes.id)), 'keuze onthouden; de tik gaat door met de naam');
  calls = []; await app.klik('laden', String(c3));
  v(!/Wie ben jij/.test(html) && calls.some((x) => /laden$/.test(x.u)), 'daarna niet meer gevraagd');
  // Niet bewaard
  let weg = true; const d1 = JSON.parse(JSON.stringify(d0));
  const app2 = RIT.createApp({ token: tk, wie: { get: () => '1', set() {} }, mount: (h) => { html = h; }, toast: () => {}, wacht: async () => {}, fetch: async (u, o2) => { if (o2 && o2.method === 'POST' && weg) throw new Error('net'); return { ok: true, status: 200, json: async () => d1 }; } });
  await app2.laad(); await app2.klik('blok', 'laden:' + d1.stops[0].van.id); await app2.klik('laden', String(c2));
  v(/Niet bewaard/.test(html), 'verbinding weg: "Niet bewaard"');
  v(/Niet bewaard/.test(html) && !d1.stops[0].regels.find((r) => r.check_id === c2).geladen, 'de stand blijft de echte');
  weg = false; await app2.ververs(); v(!/Niet bewaard/.test(html), 'na herverbinden weg');
  l1.stop(); l2.stop();
  // Meehelpen
  const B = await mens('Tf Bert', '5895'), KT = { 'x-auth-token': tok }, BH = { 'x-auth-token': B.tok }, dagM = '2026-11-05';
  const om = (await A('POST', '/api/opdrachten', { datum: dagM, vertrek: '08:00', personeel_id: jer.id })).json, rm = om.wagens[0].rit_id, tm = (await A('POST', `/api/ritten/${rm}/stops`, { type: 'levering', van_locatie_id: R, naar_locatie_id: X, tijd: '09:00' })).json.taak_id;
  await A('POST', `/api/transport-taken/${tm}/regels`, { bron: 'tekst', naam: 'Hulp 1', qty: 1 }); await A('POST', `/api/transport-taken/${tm}/regels`, { bron: 'tekst', naam: 'Hulp 2', qty: 1 });
  const Bapi = (m, p, x) => T.api(srv.base, B.tok, m, p, x);
  v(!(await Bapi('GET', '/api/meehelpen/ritten?datum=' + dagM)).json.ritten.some((x) => x.id === rm) && (await Bapi('GET', '/api/meehelpen/' + rm)).status === 403, 'B ziet geen niet-klaargezette rit');
  const kl0 = (await A('GET', '/api/meehelpen/ritten?datum=' + dagM)).json.ritten.find((x) => x.id === rm);
  v(kl0.stand === 'nog niet klaargezet' && !JSON.stringify(kl0).includes('telefoon'), 'kantoor ziet ze wel: nog niet klaargezet');
  const tm0 = (await A('GET', '/api/meehelpen/' + rm)).json.token, rawM = async (m, p, b2, h) => { const r = await fetch(`${srv.base}/api/rit-token/${tm0}${p}`, { method: m, headers: { 'Content-Type': 'application/json', ...h }, body: b2 ? JSON.stringify(b2) : undefined }); return { status: r.status, json: await r.json() }; };
  const dk = (await rawM('GET', '/data', null, KT)).json;
  v(dk.helper && dk.helper.rol === 'kantoor' && dk.nog_niet_klaargezet, 'kantoor opent de checklist vóór klaarzetten');
  v((await rawM('POST', `/checks/${dk.stops[0].regels[0].check_id}/laden`, { gezet: true }, KT)).json.geladen_door === 'Claude (API)', 'kantoor niet op de rit laadt met eigen naam');
  await A('POST', `/api/opdrachten/${om.id}/klaarzet`);
  const lA = luister('?rit=' + tm0); await new Promise((r) => setTimeout(r, 200)); const nA = lA.ber.length;
  v((await Bapi('GET', '/api/meehelpen/ritten?datum=' + dagM)).json.ritten.some((x) => x.id === rm), 'B ziet de klaargezette rit');
  const dB = (await rawM('GET', '/data', null, BH)).json, cB = dB.stops[0].regels[1].check_id;
  v(dB.helper && dB.helper.rol === 'chauffeur' && dB.ik === 'Tf Bert', 'B opent als helper en kent zichzelf');
  v((await rawM('POST', `/checks/${cB}/laden`, { gezet: true }, BH)).json.geladen_door === 'Tf Bert', 'chauffeur B laadt op de rit van A met de eigen naam');
  await wachtTot(() => lA.ber.length > nA); v(lA.ber.length > nA, 'live: A krijgt een sein');
  v((await rawM('GET', '/data', null, { 'x-auth-token': jer.tok })).json.actief.includes('Tf Bert'), 'A ziet: ook bezig Tf Bert');
  lA.stop();
  await wachtTot(async () => true);
  const pv = await Bapi('GET', '/api/vandaag?mijn=1&datum=' + dagM);
  v(!pv.json.ritten_vandaag.some((x) => x.id === rm), 'rit niet in Mijn ritten van B');
  await A('POST', `/api/transport-taken/${tm}/regels`, { bron: 'tekst', naam: 'Hulp 3', qty: 1 });
  v(!(await Bapi('GET', '/api/meldingen')).json.meldingen.some((m) => m.tekst.includes('Rit #' + rm)), 'geen ritmelding voor B');
  v((await rawM('POST', `/taken/${tm}/aangekomen`, {}, BH)).status === 403, 'B geeft geen aankomst door');
  v((await rawM('POST', `/taken/${tm}/aangekomen`, {}, KT)).status === 409 && (await rawM('POST', `/taken/${tm}/aangekomen`, { bevestigd: true }, KT)).status === 200, 'kantoor: alleen met bevestiging');
  v((await Bapi('PUT', '/api/ritten/' + rm, { einde: '12:00' })).status === 403 && (await Bapi('POST', `/api/ritten/${rm}/klaarzet`, {})).status === 403 && (await Bapi('PUT', `/api/transport-taken/${tm}/status`, { status: 'gedaan' })).status === 403 && (await Bapi('PUT', `/api/ritten/${rm}/stops/volgorde`, { taak_ids: [tm] })).status === 403, 'B: 403 op rit wijzigen, klaarzetten, afronden, stops');
  await wachtTot(async () => true);
  const rp0 = (await T.leesDb(srv.dbPad, 'SELECT COUNT(*) AS n FROM rit_personen WHERE rit_id=?', [rm]))[0].n;
  v(rp0 === 0, 'rit_personen ongewijzigd');
  v((await Bapi('POST', `/api/meehelpen/${rm}/mee`)).status === 200 && (await Bapi('GET', '/api/vandaag?mijn=1&datum=' + dagM)).json.ritten_vandaag.some((x) => x.id === rm) && (await A('GET', '/api/meldingen')).json.meldingen.some((m) => /Tf Bert rijdt mee/.test(m.tekst)), 'Op deze rit mee: toegevoegd, melding aan kantoor');
  // Planning ploeg
  const dagP = '2026-11-06', pk = (await A('POST', '/api/opdrachten', { datum: dagP, vertrek: '08:00', personeel_id: jer.id })).json, pc = (await A('POST', '/api/opdrachten', { datum: dagP, vertrek: '09:00', personeel_id: jes.id })).json;
  for (const x of [pk, pc]) await A('POST', `/api/ritten/${x.wagens[0].rit_id}/stops`, { type: 'levering', van_locatie_id: R, naar_locatie_id: X, tijd: '10:00' });
  await A('POST', `/api/opdrachten/${pk.id}/klaarzet`); await A('POST', '/api/afspraken', { soort: 'carwash', personeel_id: jer.id, datum: dagP, van: '13:00', tot: '14:00', waar: 'geheim adres' });
  const pp = await Bapi('GET', '/api/planning-ploeg?datum=' + dagP), ppT = JSON.stringify(pp.json);
  const pj = pp.json.personen.find((x) => x.naam === 'Tf Jeroen');
  v(pp.status === 200 && pj.items.some((x) => x.id === pk.wagens[0].rit_id) && pj.items.some((x) => x.soort === 'afspraak' && /Carwash/.test(x.titel)), 'B ziet de klaargezette rit en de afspraak van een collega');
  v(!ppT.includes('"id":' + pc.wagens[0].rit_id + ','), 'concept niet zichtbaar');
  v(!/pincode|telefoon|email|personeel_id|geheim adres|token/i.test(ppT), 'geen verboden velden');
  v(pp.json.personen[0].naam === 'Tf Bert' && pp.json.personen[0].eigen, 'eigen planning bovenaan');
  v((await Bapi('POST', '/api/afspraken', { soort: 'tanken', datum: dagP, van: '08:00' })).status === 403 && (await Bapi('POST', '/api/opdrachten', { datum: dagP })).status === 403 && (await Bapi('GET', '/api/opdrachten?datum=' + dagP)).status === 403, 'schrijven en kantoorschermen geweigerd');
  // Aanvullijst
  const it = (await A('POST', '/api/item-types', { naam: 'Tf Krijt' })).json;
  const db = (q, p) => T.leesDb(srv.dbPad, q, p);
  const km = ijk.kampmomenten.abdijschool, kt = await T.kvToken(srv.base, tok, km), th = (await db('SELECT thema_id FROM kampmoment_themas WHERE kampmoment_id=? LIMIT 1', [km]))[0].thema_id;
  const nb = (await A('POST', `/api/themas/${th}/bakken`, { label: 'Tf bak', code: 'TF1X' })).json;
  await A('POST', `/api/bakken/${nb.id}/items`, { naam: 'Tf Krijt', qty: 10 });
  const K = (m, p, x) => T.api(srv.base, null, m, `/api/kv/${kt}${p}`, x);
  const kd = (await K('GET', '/data')).json, kb = kd.bakken.find((x) => x.code === 'TF1X');
  await K('POST', `/bakken/${kb.id}/tellen`, { regels: [{ item_id: kb.items[0].id, aangetroffen: 2 }] }); await K('POST', '/versturen', {});
  const wk = kd.dagen.van, rij = (await A('GET', '/api/nakijken?week=' + wk)).json.bakken.find((x) => x.bak.code === 'TF1X'), det = (await A('GET', `/api/nakijken/sessie/${rij.sessie_id}`)).json;
  const rg0 = det.items.find((x) => x.regel_id);
  await A('PUT', `/api/nakijken/regel/${rg0.regel_id}`, { kantoor_actie: 'uit_pool', kantoor_aantal: 8 }); await A('POST', `/api/nakijken/sessie/${rij.sessie_id}/afronden`);
  const stock = async () => (await T.api(srv.base, tok, 'GET', '/api/_test/schrijfacties')).status;
  const AV = (t, b2) => T.api(srv.base, t, 'POST', `/api/aanvullijst/${rg0.regel_id}/aangevuld`, b2);
  const [d1a, d1b] = [await AV(jer.tok, { aangevuld: true, aantal: 3, gezien: 8 }), await AV(jes.tok, { aangevuld: true, aantal: 2, gezien: 8 })];
  v(d1a.json.open === 5 && d1b.json.open === 3 && d1b.json.intussen && d1b.json.intussen.aantal === 3 && d1b.json.intussen.door === 'Tf Jeroen', 'deelaantal niet dubbel, de rest klopt, de tweede ziet wat de ander deed');
  const [v1, v2] = await Promise.all([AV(jer.tok, { aangevuld: true, gezien: 3 }), AV(jes.tok, { aangevuld: true, gezien: 3 })]);
  const eerst = v1.json.al_gedaan ? v2 : v1, late = v1.json.al_gedaan ? v1 : v2;
  v(!eerst.json.al_gedaan && late.json.al_gedaan && /Tf /.test(late.json.door), `aanvullijst gelijktijdig: Al gedaan door ${late.json.door}`);
  const lijst = (await A('GET', '/api/aanvullijst?alles=1')).json.bakken.flatMap((g) => g.handelingen).find((h) => h.regel_id === rg0.regel_id);
  v(lijst.aangevuld_door === late.json.door, 'de lijst toont wie');
  const andere = late.json.door === 'Tf Jeroen' ? jes.tok : jer.tok;
  const t0 = await AV(andere, { aangevuld: false });
  v(t0.status === 409 && t0.json.code === 'ander', 'terugzetten van een ander: bevestiging');
  v((await AV(andere, { aangevuld: false, bevestigd: true })).status === 200, 'met bevestiging terug');
  void stock; void it;
} catch (e) { T.fout('uitzondering: ' + e.message + ' ' + e.stack); console.log(srv.log().slice(-1200)); }
await T.einde(srv);
