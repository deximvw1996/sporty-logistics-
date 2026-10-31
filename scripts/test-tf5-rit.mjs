// test-tf5-rit.mjs — TF5 punt 3, 4, 5: klaarzetten als poort, verhuistaak tot gedaan, Alles geladen, ongedaan maken, verversen, capaciteit.
import * as T from './_testhulp.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const RP = require(T.ROOT + '/public/rit.js');
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: Number(process.env.TEST_POORT) || 3373 });
const wacht = (ms = 600) => new Promise((r) => setTimeout(r, ms));
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const nu = new Date(), DAG = `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, '0')}-${String(nu.getDate()).padStart(2, '0')}`;
  const R = ijk.locaties.rozenweg, AB = (await A('GET', '/api/locaties')).json.find((l) => /abdij/i.test(l.name)).id;
  const ch = (await A('POST', '/api/personeel', { naam: 'Tf5 Chauffeur', rol: 'chauffeur' })).json;
  await A('POST', `/api/personeel/${ch.id}/pincode`, { pincode: '5837' });
  const chTok = await T.login(srv.base, ch.id, '5837');
  const C = (m, p, b) => T.api(srv.base, chTok, m, p, b);
  const maak = async (regels, extra = {}) => {
    const r = (await A('POST', '/api/ritten', { datum: DAG, vertrek: '09:00', personeel_id: ch.id })).json;
    const t = (await A('POST', '/api/transport-taken', { type: 'levering', datum: DAG, tijd: '09:30', van_locatie_id: R, naar_locatie_id: AB, rit_id: r.id, regels, ...extra })).json;
    const token = (await A('POST', `/api/ritten/${r.id}/token`)).json.token;
    return { id: r.id, taak: t.id, token };
  };
  const P = (x, m, p, b) => T.api(srv.base, null, m, `/api/rit-token/${x.token}${p}`, b);
  const data = async (x) => (await P(x, 'GET', '/data')).json;
  const meld = async () => (await C('GET', '/api/meldingen')).json.meldingen;
  const zichtbaar = async (id) => { const v = (await C('GET', '/api/vandaag?mijn=1')).json; return v.ritten_vandaag.some((r) => r.id === id) || (v.nu && JSON.stringify(v.nu).includes('Rit #' + id)); };

  // ── Punt 3 ──
  const r1 = await maak([{ naam: 'Doos', qty: 1 }, { naam: 'Mand', qty: 1 }, { naam: 'Kist', qty: 1 }]);
  T.check(!(await zichtbaar(r1.id)), 'vóór klaarzetten: niet in Vandaag / tab Ritten (mijn=1)');
  const v0 = await P(r1, 'GET', '/data');
  T.check(v0.json.niet_klaargezet === true && !v0.json.stops, 'rit-link vóór klaarzetten: alleen "niet klaargezet"');
  T.check(/nog niet klaargezet/.test(RP.schermHtml(v0.json, { scherm: 'dag' })), 'scherm: "Deze rit is nog niet klaargezet"');
  T.check((await P(r1, 'POST', `/taken/${r1.taak}/aangekomen`)).status === 409, 'schrijven vóór klaarzetten → 409');
  await A('POST', `/api/ritten/${r1.id}/klaarzet`, {});
  T.check(await zichtbaar(r1.id), 'na klaarzetten zichtbaar');
  T.check((await meld()).some((m) => /staat voor je klaar/.test(m.tekst)), 'melding "staat voor je klaar"');
  T.check((await A('POST', `/api/ritten/${r1.id}/klaarzet-terug`, {})).status === 200 && !(await zichtbaar(r1.id)) && (await meld()).some((m) => /staat niet meer klaar/.test(m.tekst)), 'terug op niet-klaargezet: onzichtbaar, met melding');
  T.check((await C('POST', `/api/ritten/${r1.id}/klaarzet-terug`, {})).status === 403, 'chauffeur mag niet terugzetten');
  await A('POST', `/api/ritten/${r1.id}/klaarzet`, {});

  // ── Punt 5: laden, lossen, alles, ongedaan ──
  let d = await data(r1);
  const ids = d.stops[0].regels.map((r) => r.check_id);
  const pn = await P(r1, 'POST', `/checks/${ids[2]}/niet-mee`, { reden: 'past_niet' });
  T.check(pn.status === 200, 'Kist past niet');
  const lvl = await P(r1, 'POST', `/checks/${ids[0]}/lossen`, {});
  T.check(lvl.status === 409 && lvl.json.code === 'niet_geladen', 'lossen vóór laden → 409 niet_geladen');
  const lpn = await P(r1, 'POST', `/checks/${ids[2]}/lossen`, { toch: true });
  T.check(lpn.status === 409 && lpn.json.code === 'niet_mee', 'lossen op past niet: geblokkeerd, ook met toch');
  const al = await P(r1, 'POST', '/alles', { actie: 'laden', check_ids: ids });
  d = await data(r1);
  T.check(al.json.verwerkt.length === 2 && al.json.overgeslagen === 1 && d.stops[0].regels.filter((r) => r.geladen).length === 2, 'Alles geladen slaat past niet over (2 geladen, 1 overgeslagen)');
  T.check(d.rit.status === 'onderweg', 'rit onderweg');
  const dub = await P(r1, 'POST', `/checks/${ids[0]}/laden`, { gezet: true });
  T.check(dub.status === 200 && (await data(r1)).stops[0].regels.find((r) => r.check_id === ids[0]).geladen, 'tweede keer gezet:true draait niet terug');
  await P(r1, 'POST', '/alles', { actie: 'laden', check_ids: [ids[0], ids[1]], gezet: false });
  T.check((await data(r1)).stops[0].regels.filter((r) => r.geladen).length === 0, 'ongedaan maken van Alles geladen');
  await P(r1, 'POST', '/alles', { actie: 'laden', check_ids: ids });
  await wacht();
  const logN = (await T.leesDb(srv.dbPad, "SELECT COUNT(*) AS n FROM activiteiten_log WHERE actie='alles geladen'"))[0].n;
  const wN = (await T.leesDb(srv.dbPad, "SELECT COUNT(*) AS n FROM wijzigingen WHERE tabel='verhuis_checks'"))[0].n;
  T.check(logN >= 2 && wN >= 4, `gelogd als handeling (${logN}) plus elke regel (${wN})`);

  // Client: tweede tik → toast met Ongedaan maken; lossen vóór laden → venster Toch lossen.
  const toasts = []; let html = '';
  const app = RP.createApp({ token: r1.token, fetch: (u, o) => fetch(srv.base + u, o), toast: (t, g, a) => toasts.push({ t, a }), mount: (h) => { html = h; } });
  await app.laad();
  await app.klik('laden', String(ids[0]));
  T.check(/Staat al op geladen/.test(toasts.at(-1).t) && toasts.at(-1).a.label === 'Ongedaan maken', 'tweede tik: toast met zichtbaar Ongedaan maken');
  await toasts.at(-1).a.doe();
  T.check(!app.data().stops[0].regels.find((r) => r.check_id === ids[0]).geladen, 'Ongedaan maken werkt');
  await app.klik('lossen', String(ids[0]));
  T.check(app.staat().sheet && app.staat().sheet.type === 'toch' && /Toch lossen/.test(html), 'lossen vóór laden: venster met knop Toch lossen');
  await app.klik('toch-ok');
  let rg = app.data().stops[0].regels.find((r) => r.check_id === ids[0]);
  T.check(rg.geladen && rg.gelost, 'Toch lossen: scherm en data zeggen geladen én gelost');
  T.check(['aangekomen', 'gedaan'].includes(app.data().stops[0].status), 'lossen vóór aankomst geeft de aankomst door');

  // Verversen
  const voor = html, n0 = app.data().stops.length;
  app.ga('stop', r1.taak);
  await A('POST', '/api/transport-taken', { type: 'levering', datum: DAG, tijd: '10:30', van_locatie_id: R, naar_locatie_id: AB, rit_id: r1.id, regels: [{ naam: 'Extra', qty: 1 }] });
  app.klik('probleem-open', String(r1.taak)); app.zet('tekst', 'lopend werk');
  await app.ververs();
  T.check(app.data().stops.length === n0 + 1 && app.staat().balk.includes('stop toegevoegd'), 'verversen ziet de nieuwe stop');
  T.check(app.staat().sheet && app.staat().sheet.tekst === 'lopend werk', 'lopend werk gaat niet verloren');
  await app.klik('sluit');
  T.check(/Kantoor wijzigde deze rit: stop toegevoegd/.test(html), 'zichtbare balk');
  T.check(typeof (await data(r1)).meldingen_ongelezen === 'number' && (await data(r1)).meldingen_ongelezen > 0 && /melding/.test(RP.dagHtml(await data(r1))), `meldingenteller op de rit (${(await data(r1)).meldingen_ongelezen})`);

  // Gestarte rit zonder klaarzetten: oude rit blijft werken, melding bij wijziging, tijd van afgeronde stop schuift niet.
  const r2 = await maak([{ naam: 'Een', qty: 1 }]);
  await A('POST', '/api/transport-taken', { type: 'levering', datum: DAG, tijd: '10:00', van_locatie_id: R, naar_locatie_id: AB, rit_id: r2.id, regels: [{ naam: 'Twee', qty: 1 }] });
  await A('POST', `/api/ritten/${r2.id}/klaarzet`, {}); const d2 = await data(r2), c2 = d2.stops[0].regels[0].check_id;
  await P(r2, 'POST', `/checks/${c2}/laden`, { gezet: true }); await P(r2, 'POST', `/checks/${c2}/lossen`, { gezet: true });
  const tijdVoor = (await data(r2)).stops[0].tijd;
  await A('POST', `/api/ritten/${r2.id}/klaarzet-terug`, {}).then((x) => T.check(x.status === 409, 'gestarte rit kan niet terug op niet-klaargezet'));
  const mN = (await meld()).length;
  await A('PUT', `/api/ritten/${r2.id}`, { vertrek: '11:00' }); await wacht(50);
  const d2b = await data(r2);
  T.check(d2b.stops[0].tijd === tijdVoor, `afgeronde stop schuift niet mee (${tijdVoor})`);
  T.check((await meld()).some((m) => /vertrektijd aangepast/.test(m.tekst)) && (await meld()).length >= mN, 'nieuwe vertrektijd op lopende rit geeft melding');

  // ── Capaciteit ──
  const thema = ijk.themas.alles_op_wieltjes;
  const bak = (await A('POST', `/api/themas/${thema}/bakken`, { label: 'Cap', code: 'CP01' })).json.id;
  const bulk = (await T.leesDb(srv.dbPad, 'SELECT id,naam FROM bakken WHERE is_bulk=1 LIMIT 1'))[0];
  const v = (await A('POST', '/api/voertuigen', { naam: 'Tf5 busje', soort: 'bestelwagen', plaatsen: 2 })).json;
  const r3 = await maak([{ naam: 'Bak Cap (CP01)', qty: 1, soort: 'thema', bak_id: bak }, { naam: '50 × ' + (bulk ? bulk.naam : 'x'), qty: 50, soort: 'pool', bak_id: bulk ? bulk.id : null }]);
  await A('PUT', `/api/ritten/${r3.id}`, { voertuig: 'Tf5 busje', voertuig_capaciteit: 2 });
  const kz = (await A('POST', `/api/ritten/${r3.id}/klaarzet`, {})).json;
  T.check(kz.lading && /1 bak \+ 50 losse stuks/.test(kz.lading.tekst), `TF7: klaarzetten zegt wat erop staat: ${kz.lading && kz.lading.tekst}`);
  const vd = (await C('GET', '/api/vandaag?mijn=1')).json;
  T.check(/1 bak \+ 50 losse stuks/.test(JSON.stringify(vd)), 'TF7: Vandaag dezelfde telling');

  // ── Weergave ──
  const dv = { rit: { datum: DAG, chauffeur: 'x', voertuig: '', status: 'onderweg' }, voortgang: { stops: 1, stuks: 3, geladen: 0, huidige_stop: 1 }, stops: [{ taak_id: 1, volgorde: 1, type: 'levering', status: 'gepland', van: { naam: 'Rozenweg' }, naar: { naam: 'A' }, locatie: { naam: 'A' }, regels: [{ check_id: 1, naam: 'Blazer', qty: 1, is_bulk: true, aantal_geladen: 0 }, { check_id: 2, naam: 'Blazer', qty: 2, is_bulk: true, aantal_geladen: 0 }, { check_id: 3, naam: 'Bak', code: 'B1', bak_id: 9, qty: 1, rek: 'B' }] }] };
  const sh = RP.stopHtml(dv, 1);
  T.check(/data-a="1,2"/.test(sh) && /3 geladen|van 3 geladen/.test(sh), 'dubbele regels samen (Blazer 1 + 2)');
  T.check((sh.match(/class="pn"/g) || []).length === 2, 'Past niet is een knop per regel');
  T.check(/class="alles"[^>]*>Alles geladen/.test(sh) && /Laden in Rozenweg/.test(RP.dagHtml(dv)) && /Laden in Rozenweg/.test(RP.blokHtml(dv, 'laden')), 'Alles geladen per rek en het blok Laden in de Rozenweg');
  const ophaling = { ...dv, stops: [{ ...dv.stops[0], type: 'ophaling', status: 'aangekomen', van: { naam: 'A' }, naar: { naam: 'Rozenweg' }, regels: [{ check_id: 4, naam: 'Bak', code: 'B1', bak_id: 9, qty: 1, geladen: true, rek: 'B' }] }] };
  T.check(/Lossen in Rozenweg/.test(RP.dagHtml(ophaling)), 'ophaling: Lossen in de Rozenweg op het einde');
  const eind = { ...dv, voortgang: { ...dv.voortgang, huidige_stop: null }, stops: [{ ...dv.stops[0], status: 'gedaan' }] };
  T.check(/✓ Rit afgerond/.test(RP.dagHtml(eind)), 'eindscherm Rit afgerond');
  const twee = { ...dv, stops: [{ ...dv.stops[0], slot: 'vrij', tijd: '09:00' }, { ...dv.stops[0], taak_id: 2, volgorde: 2, slot: 'vrij', tijd: '10:00' }] };
  T.check(/aria-label="Eerder in de rit" disabled/.test(RP.dagHtml(twee)), '▲ op de eerste stop uitgeschakeld');

  // ── Punt 4: verhuistaak ──
  const per = (await A('GET', '/api/periodes')).json.find((p) => p.actief);
  const set = (await T.leesDb(srv.dbPad, 'SELECT ss.id,ss.label,si.name FROM sport_sets ss JOIN sport_items si ON si.id=ss.item_id ORDER BY si.name,ss.id LIMIT 1'))[0];
  const betekom = (await A('GET', '/api/locaties')).json.find((l) => /betekom/i.test(l.name)).id;
  const soort = set.name.replace(/ +([A-Za-z]|[0-9]+)$/, '').trim() || set.name;
  const pl1 = await A('POST', '/api/sportrooster/plan', { periode_id: per.id, week: 1, soort, locatie_id: AB, dag_van: 1, dag_tot: 2 });
  const pl2 = await A('POST', '/api/sportrooster/plan', { periode_id: per.id, week: 1, soort, locatie_id: betekom, dag_van: 3, dag_tot: 5 });
  T.check(pl1.status === 200 && pl2.status === 200, `sportset ingepland (${pl1.status}/${pl2.status}) ${pl2.text.slice(0, 80)}`);
  const svt = (await T.leesDb(srv.dbPad, "SELECT * FROM transport_taken WHERE categorie LIKE 'sv:%' ORDER BY id DESC LIMIT 1"))[0];
  T.check(!!svt && /Sport verhuis/.test(svt.opmerking), `verhuistaak op zijn eigen datum ${svt && svt.datum}: "${svt && svt.opmerking}"`);
  const r4r = (await A('POST', '/api/ritten', { datum: svt.datum, vertrek: '17:00', personeel_id: ch.id })).json;
  await A('PUT', `/api/transport-taken/${svt.id}/rit`, { rit_id: r4r.id });
  await A('POST', `/api/ritten/${r4r.id}/klaarzet`, {});
  const r4 = { id: r4r.id, token: (await A('POST', `/api/ritten/${r4r.id}/token`)).json.token };
  const d4 = await data(r4), st4 = d4.stops[0];
  T.check(st4.regels.length >= 1 && st4.verhuis, `op de juiste datum eerst 0 regels, nu ${st4.regels.length}: ${st4.regels.map((r) => r.naam)}`);
  const sc = RP.stopHtml(d4, st4.taak_id);
  T.check(/verhuis/i.test(sc) && sc.includes(soort) && /→/.test(sc) && /stuk/.test(sc), 'scherm: welke set, van waar naar waar, hoeveel');
  await P(r4, 'POST', `/taken/${st4.taak_id}/aangekomen`, {});
  for (const r of st4.regels) { await P(r4, 'POST', `/checks/${r.check_id}/laden`, { gezet: true }); await P(r4, 'POST', `/checks/${r.check_id}/lossen`, { gezet: true }); }
  const d4b = await data(r4);
  T.check(d4b.stops[0].status === 'gedaan' && d4b.rit.status === 'gedaan', 'verhuistaak en rit op gedaan');
  await wacht();
  const lblSet = (await T.leesDb(srv.dbPad, 'SELECT locatie_id FROM sport_sets WHERE id=?', [set.id]))[0];
  T.check(lblSet.locatie_id === betekom, `waar staat de set: sport_sets.locatie_id volgt (${lblSet.locatie_id})`);
} catch (e) { T.fout('uitzondering: ' + e.message + ' ' + e.stack); console.log(srv.log().slice(-1500)); }
await T.einde(srv);
