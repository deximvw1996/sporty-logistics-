// test-tf7-kv.mjs — TF7 punt 3: opgelost tekort met beide keuzes, identieke natelling, geen schijnwijziging, notitie bij zijn telling, KV-scherm.
import * as T from './_testhulp.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const KV = require(T.ROOT + '/public/kv.js'), NK = require(T.ROOT + '/public/nakijken.js');
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: Number(process.env.TEST_POORT) || 3376 });
const wacht = () => new Promise((r) => setTimeout(r, 700));
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const km = ijk.kampmomenten.abdijschool, th = ijk.themas.alles_op_wieltjes;
  const bakId = (await A('POST', `/api/themas/${th}/bakken`, { label: 'Tf7 bak', code: 'TK01' })).json.id;
  for (const [n, q] of [['Pet', 2], ['Muts', 2], ['Das', 3], ['Sjaal', 4]]) await A('POST', `/api/bakken/${bakId}/items`, { naam: n, qty: q });
  await A('POST', `/api/kampmomenten/${km}/themas`, { thema_id: th });
  const kt = await T.kvToken(srv.base, tok, km), K = (m, p, b) => T.api(srv.base, null, m, `/api/kv/${kt}${p}`, b);
  const d0 = (await K('GET', '/data')).json, bk = d0.bakken.find((b) => b.code === 'TK01'), id = (n) => bk.items.find((i) => i.naam === n).id;
  const tel = (n, a, x = {}) => K('POST', `/bakken/${bk.id}/tellen`, { regels: [{ item_id: id(n), aangetroffen: a, ...x }] });
  const versies = async (n) => { await wacht(); return T.leesDb(srv.dbPad, 'SELECT * FROM kv_telling_versies WHERE code=? AND item_naam=? ORDER BY id', ['TK01', n]); };
  const mk = async () => (await A('GET', '/api/meldingen')).json.meldingen.filter((m) => /Telling/.test(m.tekst));
  await tel('Pet', 1, { notitie: 'een weg' }); await tel('Muts', 1); await tel('Das', 3); await tel('Sjaal', 4);

  // Identiek
  await tel('Das', 3);
  T.check((await versies('Das')).length === 1, 'identieke natelling: geen nieuwe versie');
  await K('POST', '/versturen', {});
  const m0 = (await mk()).length;
  await tel('Das', 3); await K('POST', '/versturen', {});
  T.check((await mk()).length === m0 && (await versies('Das')).length === 1, 'identiek na versturen: geen versie, geen melding');

  // Geen schijnwijziging; meerdere stukken tegelijk
  await K('POST', `/bakken/${bk.id}/tellen`, { regels: [{ item_id: id('Das'), aangetroffen: 3 }, { item_id: id('Sjaal'), aangetroffen: 3 }] });
  await K('POST', '/versturen', {});
  const m1 = await mk();
  T.check(/Sjaal 4 → 3/.test(m1[0].tekst) && !/Das/.test(m1[0].tekst), `alleen echte wijzigingen: ${m1[0].tekst}`);
  // Notitie bij zijn telling
  await tel('Pet', 0);
  const vp = await versies('Pet');
  T.check(vp[0].notitie === 'een weg' && vp[1].notitie === '', 'notitie blijft bij de telling waarop ze gezegd werd');
  await tel('Pet', 1, { notitie: 'een weg' });

  // Keuring
  await K('POST', '/versturen', {});
  const nk = (await A('GET', '/api/nakijken')).json.bakken.find((b) => b.bak.code === 'TK01' && b.kampmoment_id === km), sid = nk.sessie_id;
  let det = (await A('GET', `/api/nakijken/sessie/${sid}`)).json; const reg = (n) => det.items.find((i) => i.naam === n);
  await A('PUT', `/api/nakijken/regel/${reg('Pet').regel_id}`, { kantoor_actie: 'bestellen', kantoor_aantal: 1 });
  await A('PUT', `/api/nakijken/regel/${reg('Muts').regel_id}`, { kantoor_actie: 'bestellen', kantoor_aantal: 1 });
  await A('POST', `/api/nakijken/sessie/${sid}/afronden`);
  await wacht();
  const voor = (await T.leesDb(srv.dbPad, 'SELECT kantoor_actie,kantoor_aantal FROM nakijk_regels WHERE id=?', [reg('Pet').regel_id]))[0];
  const m2 = (await mk()).length;

  // Tekort weg
  await tel('Pet', 2); await tel('Muts', 2); await K('POST', '/versturen', {});
  const m3 = await mk();
  T.check(m3.length === m2 + 1 && /Tekort weg bij Pet, Muts/.test(m3[0].tekst), `één melding: ${m3[0].tekst}`);
  await wacht();
  const na = (await T.leesDb(srv.dbPad, 'SELECT kantoor_actie,kantoor_aantal FROM nakijk_regels WHERE id=?', [reg('Pet').regel_id]))[0];
  T.check(JSON.stringify(na) === JSON.stringify(voor), 'beslissing wijzigt niet vanzelf');
  det = (await A('GET', `/api/nakijken/sessie/${sid}`)).json;
  T.check(det.status === 'te_keuren' && reg('Pet').opgelost_vraag && reg('Pet').aangetroffen === 2, 'keuring heropend, vraag staat er, tabel toont de laatste telling (2)');
  const h = NK.detailHtml(det, {});
  T.check(/Dit tekort is weg\. Bestelling nog nodig\?/.test(h) && /data-opgelost="nodig"/.test(h) && /data-opgelost="annuleren"/.test(h), 'Nakijken: vraag met twee knoppen');
  T.check(/Eerdere tellingen/.test(NK.gsmRegelHtml(det, {})) && /Dit tekort is weg/.test(NK.gsmRegelHtml(det, {})), 'gsm: Eerdere tellingen en de vraag');
  const opl = (n, keuze) => A('POST', `/api/nakijken/regel/${reg(n).regel_id}/opgelost`, { keuze });
  T.check((await opl('Pet', 'nodig')).status === 200, 'Nog nodig');
  T.check((await opl('Muts', 'annuleren')).status === 200, 'Annuleren');
  T.check((await opl('Muts', 'annuleren')).status === 409, 'tweede keer: geen vraag meer');
  await wacht();
  const [pet] = await T.leesDb(srv.dbPad, 'SELECT * FROM nakijk_regels WHERE id=?', [reg('Pet').regel_id]), [muts] = await T.leesDb(srv.dbPad, 'SELECT * FROM nakijk_regels WHERE id=?', [reg('Muts').regel_id]);
  T.check(pet.opgelost_keuze === 'nog_nodig' && pet.kantoor_actie === 'bestellen' && pet.tekort_status !== 'genegeerd', 'Nog nodig: beslissing blijft');
  T.check(muts.opgelost_keuze === 'geannuleerd' && muts.tekort_status === 'genegeerd' && muts.kantoor_actie === 'bestellen', 'Annuleren: stopt, beslissing bewaard');
  T.check((await T.leesDb(srv.dbPad, "SELECT COUNT(*) AS n FROM activiteiten_log WHERE actie='tekort weg'"))[0].n === 2, 'beide gelogd');
  await A('POST', `/api/nakijken/sessie/${sid}/afronden`);
  const lijst = (await A('GET', '/api/aanvullijst?alles=1')).json.bakken.flatMap((b) => b.handelingen).map((x) => x.stuk);
  T.check(lijst.includes('Pet') && !lijst.includes('Muts'), 'aanvullijst: Pet blijft, Muts weg');
  await wacht();
  T.check((await T.leesDb(srv.dbPad, 'SELECT tekort_status AS t FROM nakijk_regels WHERE id=?', [muts.id]))[0].t === 'genegeerd', 'opnieuw afronden zet de bestelling niet terug');

  // Al besteld: uitleg
  await tel('Das', 1); await K('POST', '/versturen', {});
  det = (await A('GET', `/api/nakijken/sessie/${sid}`)).json;
  await A('PUT', `/api/nakijken/regel/${reg('Das').regel_id}`, { kantoor_actie: 'bestellen', kantoor_aantal: 2 });
  await A('POST', `/api/nakijken/sessie/${sid}/afronden`);
  const typ = (await A('GET', '/api/item-types')).json.find((x) => x.naam === 'Das').id;
  const bs = await A('POST', `/api/tekorten/${typ}/besteld`, { aantal: 2 });
  await tel('Das', 3); await K('POST', '/versturen', {});
  det = (await A('GET', `/api/nakijken/sessie/${sid}`)).json;
  const uit = await opl('Das', 'annuleren');
  T.check(bs.status === 200 && uit.status === 409 && /al besteld/.test(uit.json.error), `al besteld: ${uit.json.error}`);

  // KV-scherm
  const a1 = (await K('POST', '/aanvraag', { tekst: 'Pet', aantal: 1 })).json, a2 = (await K('POST', '/aanvraag', { tekst: 'ballonnen' })).json, a3 = (await K('POST', '/aanvraag', { tekst: 'wacht' })).json;
  await A('PUT', `/api/aanvragen/${a1.id}/status`, { status: 'goedgekeurd' });
  await A('PUT', `/api/aanvragen/${a2.id}/status`, { status: 'afgewezen', reden: 'nee' });
  const d = (await K('GET', '/data')).json;
  const ov = KV.overzichtHtml(d);
  T.check(/1 wacht op kantoor/.test(ov) && /1 goedgekeurd, 1 afgewezen/.test(ov), 'Overzicht toont de antwoorden');
  T.check(/Aanvragen 1</.test(KV.tellenHtml(d, false)), 'tab-teller telt alleen wat wacht');
  T.check(d.aanvragen.find((x) => x.id === a1.id).komt && /komt /.test(KV.aanvragenHtml(d)), `goedgekeurd: ${JSON.stringify(d.aanvragen.find((x) => x.id === a1.id).komt)}`);
  const leeg = { ...d, bakken: [], attributen: [], levering: { status: 'gepland', datum: '2020-01-01' } }, th0 = KV.tellenHtml(leeg, false);
  T.check(/niets te tellen/.test(th0) && !/tik een bak/.test(th0) && !/levering/i.test(th0), 'kamp zonder bak: geen tegenstrijdige tekst');
  const lees = KV.schermHtml({ ...d, link_stand: 'lezen' }, { scherm: 'tellen' });
  T.check(!/tik een bak/.test(lees) && /\.alleenlezen \.body>\.hint\{display:none/.test(lees), 'lezen-stand zonder schrijfuitleg');
  T.check(/komt/.test(KV.tellenHtml({ ...d, levering: { status: 'gepland', datum: '2099-01-01' } }, false)) && /nog niet op afgewerkt/.test(KV.tellenHtml({ ...d, levering: { status: 'gepland', datum: '2020-01-01' } }, false)), 'waarschuwing volgt de rit');
  const twee = { ...d, bakken: [{ ...bk, geteld: 1, aantal: 4, items: bk.items.map((i, n) => ({ ...i, aangetroffen: n ? null : i.gewenst })) }] };
  T.check(/1 begonnen/.test(KV.tellenHtml(twee, false)), 'begonnen bakken tellen mee');
  T.check(/Sjaal 4 → 3/.test(KV.tellenHtml({ ...d, niet_verstuurd: 1, niet_verstuurd_lijst: ['TK01: Sjaal 4 → 3'] }, false)), '"wijzigingen" zegt welke');
  const veel = { ...d, bakken: [{ ...bk, code: 'A', items: [{ naam: 'x', status: 'tekort', aangetroffen: 0, gewenst: 1 }, { naam: 'y', status: 'tekort', aangetroffen: 0, gewenst: 1 }] }, { ...bk, code: 'B', items: [{ naam: 'z', status: 'kapot', aangetroffen: 1, gewenst: 1, kapot_aantal: 1 }] }] };
  T.check(/\+1/.test(KV.overzichtHtml(veel)) && /B: /.test(KV.overzichtHtml(veel)), 'kaart Tellen: alle afwijkingen of +n');
  const app = KV.createApp({ token: kt, fetch: (u, o) => fetch(srv.base + u, o), toast() {}, mount() {} });
  await app.laad(); app.ga('bak', bk.id); await app.klik('sheet-open', 'kapot');
  T.check(/TK01/.test(app.staat().sheet.stuk), `kapot-sheet start op de bak: ${app.staat().sheet.stuk}`);
  // Afgelopen, met nummer
  await A('PUT', '/api/instellingen/kantoor', { kantoor_telefoon: '016 11 22 33' });
  const km0 = (await T.leesDb(srv.dbPad, 'SELECT * FROM kampmomenten WHERE id=?', [km]))[0];
  await A('PUT', `/api/periodes/${km0.periode_id}`, { naam: 'Oud', start_datum: '2020-01-06', eind_datum: '2020-03-01' });
  const pg = await T.api(srv.base, null, 'GET', '/kv/' + kt);
  T.check(pg.status === 410 && /tel:016112233/.test(pg.text), 'afgelopen pagina: kantoornummer');
  T.check(a3.id > 0, 'aanvraag wacht bewaard');
} catch (e) { T.fout('uitzondering: ' + e.message + ' ' + e.stack); console.log(srv.log().slice(-1200)); }
await T.einde(srv);
