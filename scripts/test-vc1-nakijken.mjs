// test-vc1-nakijken.mjs — VC1 (chat D): Voorraad & controles › Nakijken + aanvullijst (print). Eigen server via _testhulp (poort 3344, herfst-test.db).
// De HTML-bouwers van public/nakijken.js worden als module geladen en met de echte API-data aangeroepen (geen headless browser beschikbaar).
import * as T from './_testhulp.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const POORT = parseInt(process.env.TEST_POORT || '3344');
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: POORT });
const BASIC = 'Basic ' + Buffer.from('sporty:' + T.APP_PASSWORD).toString('base64');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const tekst = (h) => h.replace(/<[^>]+>/g, '\n').replace(/&amp;/g, '&').replace(/\n\s*\n+/g, '\n').trim().split('\n').join(' | ');
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const P = (m, p, b) => T.api(srv.base, null, m, p, b);
  const km = ijk.kampmomenten.abdijschool, thema = ijk.themas.alles_op_wieltjes;

  // ── data: 3 bakken (8, 5, 1 items) op het kampmoment ──
  const maakBak = async (label, code, items) => {
    const b = (await A('POST', `/api/themas/${thema}/bakken`, { label, code })).json;
    for (const [naam, qty] of items) await A('POST', `/api/bakken/${b.id}/items`, { naam, qty });
    return b.id;
  };
  const b1 = await maakBak('Nk bak een', 'NK01', [['Springtouw', 4], ['Hoepel', 6], ['Pion', 10], ['Bal zacht', 4], ['Lintje', 12], ['Fluitje', 2], ['Krijt', 1], ['Tape', 2]]);
  const b2 = await maakBak('Nk bak twee', 'NK02', [['Kegel', 3], ['Touw', 2], ['Doek', 5], ['Pen', 1], ['Blok', 8]]);
  const b3 = await maakBak('Nk bak drie', 'NK03', [['Parachute', 1]]);
  await A('POST', `/api/kampmomenten/${km}/themas`, { thema_id: thema });
  const kvtok = await T.kvToken(srv.base, tok, km);
  const kv = (m, p, b) => P(m, `/api/kv/${kvtok}${p}`, b);
  const d0 = (await kv('GET', '/data')).json;
  const kb = (code) => d0.bakken.find((b) => b.code === code);
  const tel = async (code, naam, rest) => { const bk = kb(code), it = bk.items.find((i) => i.naam === naam); return kv('POST', `/bakken/${bk.id}/tellen`, { regels: [{ item_id: it.id, ...rest }] }); };

  // ── 0. voor het tellen: alle bakken 'niet geteld' (ook zonder sessie, werklijst 73) ──
  let r = await A('GET', '/api/nakijken');
  const eigen = (j) => j.bakken.filter((b) => b.kampmoment_id === km && ['NK01', 'NK02', 'NK03'].includes(b.bak.code));
  T.check(r.status === 200 && eigen(r.json).length === 3 && eigen(r.json).every((b) => b.status === 'niet_geteld' && b.sessie_id === null && b.uitslag_tekst === 'niet geteld'), `GET /api/nakijken toont ook bakken zonder sessie (${eigen(r.json).length}× niet_geteld) [week ${r.json.week?.van}${r.json.week?.fallback ? ' (dichtstbijzijnde)' : ''}]`);

  // ── 1. KV telt: bak 1 volledig (tekort + te veel + kapot met foto + notitie), bak 2 half, bak 3 niet ──
  for (const n of ['Bal zacht', 'Lintje', 'Fluitje', 'Krijt', 'Tape']) { const it = kb('NK01').items.find((i) => i.naam === n); await tel('NK01', n, { aangetroffen: it.gewenst }); }
  await tel('NK01', 'Springtouw', { aangetroffen: 2, notitie: 'twee zitten in de knoop' });
  await tel('NK01', 'Hoepel', { aangetroffen: 8 });
  await tel('NK01', 'Pion', { aangetroffen: 10, kapot_aantal: 2, notitie: 'gebarsten', foto_data: PNG });
  for (const n of ['Kegel', 'Touw']) { const it = kb('NK02').items.find((i) => i.naam === n); await tel('NK02', n, { aangetroffen: it.gewenst }); }
  await kv('POST', '/versturen', {});
  r = await A('GET', '/api/nakijken');
  const L = r.json; const rij = (code) => L.bakken.find((b) => b.kampmoment_id === km && b.bak.code === code);
  T.check(rij('NK01').status === 'te_keuren' && rij('NK02').status === 'te_keuren' && rij('NK03').status === 'niet_geteld', `statussen: NK01 ${rij('NK01').status}, NK02 ${rij('NK02').status}, NK03 ${rij('NK03').status}`);
  T.check(rij('NK01').uitslag_tekst === 'tekort 2 · te veel 2 · kapot 2' /* TF1 G13: stuks, geen regels */ && rij('NK01').geteld === 8 && rij('NK01').totaal === 8, `NK01 uitslag "${rij('NK01').uitslag_tekst}" ${rij('NK01').geteld}/${rij('NK01').totaal}`);
  T.check(/^tekort \d · \d niet geteld$|^\d niet geteld$|niet geteld/.test(rij('NK02').uitslag_tekst) && rij('NK02').geteld === 2 && rij('NK02').totaal === 5, `NK02 "${rij('NK02').uitslag_tekst}" ${rij('NK02').geteld}/${rij('NK02').totaal}`);
  T.check(r.json.tellers.te_keuren >= 2 && r.json.tellers.niet_geteld >= 1 && r.json.tellers.met_tekort >= 1 && r.json.tellers.met_kapot >= 1, `tellers ${JSON.stringify(r.json.tellers)}`);
  r = await A('GET', '/api/nakijken?week=1999-01-04');
  T.check(r.status === 200 && r.json.bakken.length === 0, 'een week zonder kampmomenten geeft een lege lijst (geen fout)');
  r = await A('GET', '/api/nakijken');

  // ── 2. detail ──
  const sid = rij('NK01').sessie_id;
  r = await A('GET', `/api/nakijken/sessie/${sid}`);
  const det = r.json, di = (n) => det.items.find((i) => i.naam === n);
  T.check(r.status === 200 && det.items.length === 8 && di('Springtouw').afwijking === 'tekort' && di('Hoepel').afwijking === 'te_veel' && di('Pion').afwijking === 'kapot' && di('Bal zacht').afwijking === 'klopt', 'sessie-detail: 8 stukken met afwijking tekort / te_veel / kapot / klopt');
  T.check(di('Springtouw').notitie === 'twee zitten in de knoop' && /^\/uploads\//.test(di('Pion').foto_url || '') && di('Pion').kapot_aantal === 2, 'detail: notitie KV, foto_url, kapot_aantal');
  T.check(di('Springtouw').acties.map((a) => a.waarde).join() === 'bestellen,uit_pool,aanvaarden' && di('Hoepel').acties.map((a) => a.waarde).join() === 'naar_pool,laten_staan' && di('Pion').acties.map((a) => a.waarde).join() === 'afschrijven_bestellen,herstellen,aanvaarden', 'actie-opties per afwijking exact als de mockup');
  T.check(det.contact.kv_naam && 'kv_telefoon' in det.contact && Array.isArray(det.vorige_tellingen) && Array.isArray(det.historiek) && det.historiek.some((h) => /telling ingediend \(8\/8\)/.test(h.tekst)) && det.historiek.some((h) => /pion: 2 kapot \+ foto/.test(h.tekst)), `detail: contact, vorige_tellingen[], historiek (${det.historiek.length}: ${det.historiek.map((h) => h.tekst).join(' / ')})`);
  r = await A('GET', `/api/nakijken/bak?kampmoment_id=${km}&bak=thema:${b3}`);
  T.check(r.status === 200 && r.json.sessie_id === null && r.json.items.length === 1 && r.json.items[0].afwijking === 'niet_geteld', 'detail voor een bak zonder sessie (?kampmoment_id=&bak=thema:ID)');

  // ── 3. acties zetten ──
  r = await A('PUT', `/api/nakijken/regel/${di('Springtouw').regel_id}`, { kantoor_actie: 'bestellen', kantoor_aantal: 2, kantoor_notitie: 'voor woensdag' });
  T.check(r.status === 200 && r.json.kantoor_actie === 'bestellen' && r.json.kantoor_aantal === 2, 'PUT regel: Springtouw → bestellen (2)');
  r = await A('PUT', `/api/nakijken/regel/${di('Hoepel').regel_id}`, { kantoor_actie: 'naar_pool', kantoor_aantal: 2 });
  T.check(r.status === 200, 'PUT regel: Hoepel → naar_pool (2)');
  r = await A('PUT', `/api/nakijken/regel/${di('Pion').regel_id}`, { kantoor_actie: 'afschrijven_bestellen', kantoor_aantal: 2 });
  T.check(r.status === 200, 'PUT regel: Pion → afschrijven_bestellen (2)');
  r = await A('PUT', `/api/nakijken/regel/${di('Pion').regel_id}`, { kantoor_actie: 'verbranden' });
  T.check(r.status === 400, 'onbekende actie → 400');
  const wz = (await A('GET', `/api/nakijken/sessie/${sid}`)).json.historiek;
  T.check(wz.some((h) => /actie bestellen/.test(h.tekst)), 'historiek toont de actiewijziging (gelogd)');

  // ── 4. afronden ──
  const vroeg = await A('POST', `/api/nakijken/sessie/${rij('NK02').sessie_id}/afronden`);
  T.check(vroeg.status === 200, 'NK02 (ingediend, onvolledig) mag afgerond worden');
  r = await A('POST', `/api/nakijken/sessie/${sid}/afronden`);
  T.check(r.status === 200 && r.json.bestellingen === 2 && r.json.afschrijvingen === 1, `afronden NK01 → ${JSON.stringify(r.json)}`);
  const na = (await A('GET', '/api/nakijken')).json.bakken.find((b) => b.kampmoment_id === km && b.bak.code === 'NK01');
  T.check(na.status === 'nagekeken' && na.nagekeken_op, 'NK01 staat nu op nagekeken');
  const tekorten = (await A('GET', '/api/nakijk-tekorten')).json.find((s) => s.id === sid);
  T.check(tekorten && tekorten.regels.filter((x) => x.tekort_status === 'besteld').length === 2, 'bestaande tekorten/bestel-logica: 2 regels staan op tekort_status "besteld"');
  r = await A('POST', `/api/nakijken/sessie/999999/afronden`);
  T.check(r.status === 404, 'afronden van een onbekende sessie → 404');
  const geenKv = await A('POST', `/api/nakijken/afronden`, { sessie_ids: [] });
  T.check(geenKv.status === 400, 'bulk afronden zonder selectie → 400 met uitleg');

  // ── 5. aanvullijst ──
  const vandaag = new Date(); const iso = `${vandaag.getFullYear()}-${String(vandaag.getMonth() + 1).padStart(2, '0')}-${String(vandaag.getDate()).padStart(2, '0')}`;
  r = await A('GET', `/api/aanvullijst?datum=${iso}`);
  const g1 = r.json.bakken.find((b) => b.bak.code === 'NK01'), g2 = r.json.bakken.find((b) => b.bak.code === 'NK02');
  const soorten = (g1?.handelingen || []).map((h) => h.soort).sort().join();
  T.check(r.status === 200 && g1 && soorten === 'afschrijven,bestelling,naar_pool', `aanvullijst NK01 gegroepeerd per bak met 3 handelingen (${soorten})`);
  T.check(g1.plaats.tekst === 'rek N' && g1.handelingen.every((h) => h.regel_id && h.stuk && h.aantal > 0 && h.waar_tekst && h.aangevuld === 0), 'handeling heeft regel_id, stuk, aantal, waar_tekst; plaats "rek N"');
  T.check(g2 && g2.handelingen.every((h) => h.soort === 'nakijken') && g2.handelingen.length === 3, `NK02: 3 niet-getelde stukken als "nakijken" (${g2?.handelingen.length})`);
  const hSpr = g1.handelingen.find((h) => h.stuk === 'Springtouw');
  await A('POST', `/api/nakijken/regel/${hSpr.regel_id}/binnen`); // TF2 G15: een bestelling moet eerst binnen zijn
  r = await A('POST', `/api/aanvullijst/${hSpr.regel_id}/aangevuld`, { aangevuld: true });
  T.check(r.status === 200 && r.json.aangevuld === 1, 'aangevuld afvinken → 200');
  const lijst2 = (await A('GET', `/api/aanvullijst?datum=${iso}`)).json;
  T.check(!lijst2.bakken.find((b) => b.bak.code === 'NK01').handelingen.some((h) => h.regel_id === hSpr.regel_id), 'afgevinkte handeling verdwijnt uit de lijst');
  const alles = (await A('GET', `/api/aanvullijst?datum=${iso}&alles=1`)).json.bakken.find((b) => b.bak.code === 'NK01').handelingen.find((h) => h.regel_id === hSpr.regel_id);
  T.check(alles && alles.aangevuld === 1, 'met ?alles=1 blijft hij zichtbaar als aangevuld');
  const reg = (await A('GET', `/api/nakijken/sessie/${sid}`)).json.historiek;
  T.check(reg.some((h) => /springtouw: aangevuld/.test(h.tekst) && h.wie), `log op naam: "${reg.find((h) => /aangevuld/.test(h.tekst))?.tekst}" door ${reg.find((h) => /aangevuld/.test(h.tekst))?.wie}`);
  r = await A('POST', `/api/aanvullijst/${hSpr.regel_id}/aangevuld`, { aangevuld: false });
  T.check((await A('GET', `/api/aanvullijst?datum=${iso}`)).json.bakken.find((b) => b.bak.code === 'NK01').handelingen.some((h) => h.regel_id === hSpr.regel_id), 'aangevuld:false zet hem terug in de lijst');
  const hPion = g1.handelingen.find((h) => h.stuk === 'Pion');
  r = await A('POST', `/api/aanvullijst/${hPion.regel_id}/aangevuld`, { aangevuld: true, foto_data: PNG });
  T.check(r.status === 200 && /^\/uploads\//.test(r.json.foto || ''), 'afschrijven aanvinken met foto → foto bewaard');

  // ── 6. herinnering + notitie ──
  r = await A('POST', '/api/nakijken/herinnering', { kampmoment_id: km });
  T.check(r.status === 200 && r.json.soort === 'herinnering_kv', 'herinnering → aanvraag soort herinnering_kv');
  r = await A('POST', '/api/nakijken/notitie', { kampmoment_id: km, tekst: 'Tel de hoepels nog eens' });
  T.check(r.status === 200 && r.json.soort === 'notitie_kantoor', 'notitie aan KV → aanvraag soort notitie_kantoor');
  r = await A('POST', '/api/nakijken/notitie', { kampmoment_id: km, tekst: '  ' });
  T.check(r.status === 400, 'lege notitie → 400');
  const kvd = (await kv('GET', '/data')).json;
  T.check(Array.isArray(kvd.meldingen_kantoor) && kvd.meldingen_kantoor.length === 2 && kvd.meldingen_kantoor.some((m) => /hoepels/.test(m.tekst)), 'beide zijn zichtbaar in de kv-data (meldingen_kantoor)');
  T.check(!kvd.aanvragen.some((a) => a.soort === 'notitie_kantoor' || a.soort === 'herinnering_kv'), 'ze vervuilen de aanvragen van de KV niet');

  // ── 7. pagina's ──
  const pg = await (await fetch(`${srv.base}/nakijken`, { headers: { Authorization: BASIC } })).text();
  T.check(/Nakijken/.test(pg) && /class="sub"/.test(pg) && /Printlijst/.test(pg) && /id="lijst"/.test(pg) && /id="detail"/.test(pg) && /nav\.js/.test(pg), '/nakijken → 200 met bovenbalk, subbalk (Nakijken · Tekorten · Bestellingen · Voorraad · Export · Printlijst) en lijst/detail (chips en voet bouwt nakijken.js: zie lijst-test hierboven)');
  const pr = await (await fetch(`${srv.base}/aanvullijst-print`, { headers: { Authorization: BASIC } })).text();
  T.check(/<table/.test(pr) && /@media print/.test(pr) && /Aanvullijst Rozenweg/.test(pr), '/aanvullijst-print → 200 met tabel en @media print');
  const NK = require(T.ROOT + '/public/nakijken.js');
  const lijstData = (await A('GET', '/api/nakijken')).json;
  const st = { filter: 'alle', zoek: '', geselecteerd: new Set([rij('NK01').sessie_id]), open: null, tab: 'telling' };
  const lh = NK.lijstHtml(lijstData, st);
  T.check(['Te keuren', 'Niet geteld', 'Met tekort', 'Met kapot', 'Nagekeken', 'Week'].every((c) => lh.includes(c)) && lh.includes('NK01') && lh.includes('1 geselecteerd') && lh.includes('Keuring afronden') && lh.includes('Herinnering naar KV'), 'lijst: 6 chips, rijen, bulk-voet met selectie');
  console.log('--- DOM-dump lijst ---\n' + tekst(lh).slice(0, 700) + '\n');
  const dh = NK.detailHtml((await A('GET', `/api/nakijken/sessie/${rij('NK02').sessie_id}`)).json, { tab: 'telling' });
  T.check(dh.includes('NK02') && dh.includes('Bak openen') && dh.includes('KV bellen') && dh.includes('Keuring afronden'), 'detail: kop en knoppen');
  const det2 = (await A('GET', `/api/nakijken/sessie/${sid}`)).json;
  const th = NK.detailHtml(det2, { tab: 'telling' });
  T.check(th.includes('<select') && th.includes('Terug naar pool') && th.includes('Afschrijven (2) + bestellen') && th.includes('Notitie aan KV') && /bestelling/.test(th), 'detail-tabel: select per afwijking + onderregel + Notitie aan KV');
  console.log('--- DOM-dump detail ---\n' + tekst(th).slice(0, 900) + '\n');
  const ph = NK.printRijenHtml((await A('GET', `/api/aanvullijst?datum=${iso}`)).json);
  T.check(ph.includes('NK01') && ph.includes('☐') && ph.includes('rek N'), 'printlijst-rijen: vakje, bak, rek');

  // ── 8. rollen ──
  const nieuw = await A('POST', '/api/personeel', { naam: 'Test Chauffeur VC1', rol: 'chauffeur' });
  await A('POST', `/api/personeel/${nieuw.json.id}/pincode`, { pincode: '7777' });
  const l = await T.api(srv.base, null, 'POST', '/api/login', { persoon_id: nieuw.json.id, pincode: '7777' });
  const ctok = l.json?.token;
  if (ctok) {
    const C = (m, p, b) => T.api(srv.base, ctok, m, p, b);
    T.check((await C('GET', '/api/nakijken')).status === 403, 'chauffeur → 403 op /api/nakijken');
    T.check((await C('PUT', `/api/nakijken/regel/${di('Hoepel').regel_id}`, { kantoor_actie: 'laten_staan' })).status === 403, 'chauffeur → 403 op PUT regel');
    T.check((await C('GET', `/api/aanvullijst?datum=${iso}`)).status === 200, 'chauffeur → 200 op /api/aanvullijst');
  } else T.fout('geen chauffeur in de testdata om rollen te testen');
  T.check((await P('GET', '/api/aanvullijst')).status === 401 || (await P('GET', '/api/aanvullijst')).status === 403, 'zonder login → geen aanvullijst');
} catch (e) {
  T.fout('test crashte: ' + (e.stack || e));
}
await T.einde(srv);
