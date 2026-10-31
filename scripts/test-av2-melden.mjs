// test-av2-melden.mjs — AV2 (chat D): de aanvuller meldt zelf kapot of weg (met foto) + restpunten (meldingen-link, verhuis-avond 17:00, "n van m gedaan").
// Eigen server via _testhulp (poort 3359 of TEST_POORT, herfst-test.db). De HTML-bouwers van public/aanvullen.js worden als module met echte API-data aangeroepen.
import * as T from './_testhulp.mjs';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const lees = (p) => fs.readFileSync(T.ROOT + '/' + p, 'utf8');
const ijk = T.leesIjk();
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const srv = await T.startServer({ poort: Number(process.env.TEST_POORT) || 3359 });
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  let _k2; const K2 = async (m, p) => { if (!_k2) { const x = (await A('POST', '/api/personeel', { naam: 'Tweede kantoor', rol: 'kantoor' })).json; await A('POST', `/api/personeel/${x.id}/pincode`, { pincode: '5861' }); _k2 = await T.login(srv.base, x.id, '5861'); } return T.api(srv.base, _k2, m, p); }; // TF9: een melding gaat niet naar wie de handeling deed
  const P = (m, p, b) => T.api(srv.base, null, m, p, b);
  const pers = async (naam, rol, pin) => { const x = (await A('POST', '/api/personeel', { naam, rol })).json; await A('POST', `/api/personeel/${x.id}/pincode`, { pincode: pin }); const l = await P('POST', '/api/login', { persoon_id: x.id, pincode: pin }); return { id: x.id, tok: l.json && l.json.token, status: l.status }; };
  const R = ijk.locaties.rozenweg, km = ijk.kampmomenten.abdijschool, thema = ijk.themas.alles_op_wieltjes;
  const AV = require(T.ROOT + '/public/aanvullen.js');
  const stockVan = async (naamItem, bakId) => { const t = (await T.leesDb(srv.dbPad, 'SELECT item_type_id AS t FROM bak_items WHERE bak_id=? AND naam=?', [bakId, naamItem]))[0].t; return { t, qty: async () => ((await T.leesDb(srv.dbPad, 'SELECT qty FROM item_type_stock WHERE item_type_id=? AND locatie_id=?', [t, R]))[0] || { qty: 0 }).qty }; };

  // ── een bak waar de KV alles klopt telt en kantoor al heeft afgerond ──
  const bakId = (await A('POST', `/api/themas/${thema}/bakken`, { label: 'Av2 bak', code: 'AW01' })).json.id;
  for (const [n, q] of [['Av2 Kegel', 5], ['Av2 Ring', 4]]) await A('POST', `/api/bakken/${bakId}/items`, { naam: n, qty: q });
  await A('POST', `/api/kampmomenten/${km}/themas`, { thema_id: thema });
  const kvtok = await T.kvToken(srv.base, tok, km);
  const d0 = (await P('GET', `/api/kv/${kvtok}/data`)).json, kb = d0.bakken.find((b) => b.code === 'AW01');
  for (const it of kb.items) { const tr = await P('POST', `/api/kv/${kvtok}/bakken/${kb.id}/tellen`, { regels: [{ item_id: it.id, aangetroffen: it.gewenst, notitie: 'blijft te keuren (TF12: een kale klopt gaat automatisch)' }] }); if (tr.status !== 200) T.info('tel ' + tr.status); }
  await P('POST', `/api/kv/${kvtok}/versturen`, {});
  const rij = async () => (await A('GET', '/api/nakijken')).json.bakken.find((b) => b.bak.code === 'AW01' && b.kampmoment_id === km);
  const nk = await rij();
  T.check(nk && nk.status === 'te_keuren', 'start: de bak is door de KV ingediend');
  T.check((await A('POST', `/api/nakijken/sessie/${nk.sessie_id}/afronden`)).status === 200 && (await rij()).status === 'nagekeken', 'kantoor rondde de keuring af (alles klopte)');
  const kegel = await stockVan('Av2 Kegel', bakId), ring = await stockVan('Av2 Ring', bakId);
  await A('PUT', `/api/catalogus/${kegel.t}/voorraad`, { locatie_id: R, qty: 30 });
  await A('PUT', `/api/catalogus/${ring.t}/voorraad`, { locatie_id: R, qty: 20 });

  // ═══ Punt 1: melden ═══
  const melding = (b) => A('POST', '/api/aanvullijst/melding', { sessie_id: nk.sessie_id, ...b });
  let r = await melding({ item_naam: 'Av2 Kegel', soort: 'kapot', aantal: 2 });
  T.check(r.status === 400 && /foto/i.test(r.json.error), `kapot zonder foto → 400 (${r.json.error})`);
  T.check((await melding({ item_naam: 'Av2 Kegel', soort: 'kapot', aantal: 0, foto_data: PNG })).status === 400, 'aantal 0 → 400');
  T.check((await melding({ item_naam: '', soort: 'kapot', aantal: 1, foto_data: PNG })).status === 400 && (await melding({ item_naam: 'Av2 Kegel', soort: 'vies', aantal: 1 })).status === 400, 'zonder naam of met onbekende soort → 400');
  T.check((await rij()).status === 'nagekeken', 'mislukte meldingen veranderen niets: keuring nog afgerond');
  r = await melding({ item_naam: 'Av2 Kegel', soort: 'kapot', aantal: 2, foto_data: PNG, notitie: 'poot gebroken' });
  const kapotRegel = r.json.regel_id;
  T.check(r.status === 200 && r.json.heropend === true && r.json.dubbel === false && /^\/uploads\//.test(r.json.foto || ''), `kapot met foto → regel ${kapotRegel}, keuring heropend`);
  T.check((await rij()).status === 'te_keuren', 'afgeronde keuring is heropend: staat weer op "te keuren" in Nakijken');
  r = await melding({ item_naam: 'Av2 Ring', soort: 'weg', aantal: 4 });
  const wegRegel = r.json.regel_id;
  T.check(r.status === 200 && r.json.foto === null, 'weg zonder foto lukt');

  // wat kantoor in Nakijken ziet
  let det = (await A('GET', `/api/nakijken/sessie/${nk.sessie_id}`)).json;
  const itK = det.items.find((i) => i.regel_id === kapotRegel), itW = det.items.find((i) => i.regel_id === wegRegel);
  T.check(itK && itK.afwijking === 'kapot' && /gemeld door Claude \(API\) · stockage/.test(itK.herkomst) && itK.foto_url && itK.notitie === 'poot gebroken', `Nakijken toont de gemelde regel met label "${itK && itK.herkomst}", foto en notitie`);
  T.check(itK.acties.map((a) => a.waarde).join() === 'afschrijven_bestellen,herstellen,aanvaarden', 'kapot krijgt de acties van kapot (afschrijven + bestellen, herstellen, aanvaarden)');
  T.check(itW.afwijking === 'tekort' && itW.acties.map((a) => a.waarde).join() === 'bestellen,uit_pool,aanvaarden', 'weg krijgt de acties van een tekort (bestellen, uit pool, aanvaarden)');
  T.check((await kegel.qty()) === 30 && (await ring.qty()) === 20, 'een melding is geen beslissing: voorraad ongewijzigd');
  const nkPagina = lees('public/nakijken.js');
  T.check(/it\.herkomst/.test(nkPagina), 'public/nakijken.js toont het herkomstlabel');

  // dubbele melding
  r = await melding({ item_naam: 'av2 kegel', soort: 'kapot', aantal: 3, foto_data: PNG });
  det = (await A('GET', `/api/nakijken/sessie/${nk.sessie_id}`)).json;
  T.check(r.status === 200 && r.json.dubbel === true && r.json.regel_id === kapotRegel && det.items.filter((i) => i.herkomst).length === 2 && det.items.find((i) => i.regel_id === kapotRegel).kantoor_aantal === 5, `dubbele melding telt op (2 + 3 = 5) in dezelfde regel, geen tweede regel`);

  // kantoor krijgt één melding per nieuwe regel
  const mm = (await K2('GET', '/api/meldingen')).json.meldingen;
  const kegelM = mm.filter((m) => /Av2 Kegel/.test(m.tekst)), ringM = mm.filter((m) => /Av2 Ring/.test(m.tekst));
  T.check(kegelM.length === 1 && ringM.length === 1 && kegelM[0].link === '/nakijken' && /(5×)/.test(kegelM[0].tekst), `kantoor krijgt één melding per gemelde regel (kegel ${kegelM.length}, ring ${ringM.length}) met link naar Nakijken`);
  const logTekst = JSON.stringify((await A('GET', '/api/logboek')).json);
  T.check(/Av2 Kegel: 2 kapot gemeld door/.test(logTekst) && /erbij op een bestaande melding/.test(logTekst) && /keuring heropend/.test(logTekst), 'de melding, de dubbele en het heropenen staan in het logboek');

  // rollen
  const kvp = await pers('Av2 KV', 'kv', '5201'), coo = await pers('Av2 Coo', 'coordinator', '5202'), chf = await pers('Av2 Chauffeur', 'chauffeur', '5203');
  const mt = (t, b) => T.api(srv.base, t, 'POST', '/api/aanvullijst/melding', b);
  const zonderBak = { item_naam: 'Av2 Emmer coördinator', soort: 'weg', aantal: 1 };
  T.check((await mt(null, zonderBak)).status === 401 || (await mt(null, zonderBak)).status === 403, 'niet ingelogd → geweigerd');
  T.check(!kvp.tok || [401, 403].includes((await mt(kvp.tok, zonderBak)).status), `KV-rol → geweigerd${kvp.tok ? '' : ' (KV kan niet eens inloggen)'}`);
  T.check((await mt(coo.tok, { ...zonderBak, item_naam: 'Av2 Emmer coördinator' })).status === 200 && (await mt(chf.tok, { ...zonderBak, item_naam: 'Av2 Emmer chauffeur' })).status === 200, 'coördinator en chauffeur kunnen melden');

  // ═══ Op het aanvulscherm ═══
  let data = (await A('GET', '/api/aanvullijst?alles=1')).json;
  const g = data.bakken.find((b) => b.sessie_id === nk.sessie_id);
  const hk = g.handelingen.find((x) => x.regel_id === kapotRegel);
  T.check(hk && hk.soort === 'melding' && hk.wacht_op_kantoor === true && hk.kan_afvinken === false && hk.aantal === 5, 'aanvullijst: gemelde regel staat erin, wacht op kantoor, niet afvinkbaar');
  const html = AV.bak(g, {});
  T.check(/gemeld, wacht op kantoor/.test(html) && /class="vink uit" disabled aria-label="Gemeld, wacht op kantoor"/.test(html), 'bakscherm: pil "gemeld, wacht op kantoor" en afvinken uit');
  T.check((await A('POST', `/api/aanvullijst/${kapotRegel}/aangevuld`, { aangevuld: true, foto_data: PNG })).status === 409, 'afvinken van een onbeslist gemelde regel → 409');
  T.check(html.includes('⚠ Kapot of weg melden') && html.includes('data-av="meld-open"'), 'knop "⚠ Kapot of weg melden" in de bak');
  const ov = AV.meldOverlay({ soort: 'kapot', aantal: 1, stuk: 'Av2 Kegel', naam: '', notitie: '', foto: '' }, g);
  T.check(/role="dialog"/.test(ov) && ov.includes('data-av="meld-stuk"') && ov.includes('data-av="meld-soort" data-a="kapot"') && ov.includes('data-av="meld-soort" data-a="weg"') && ov.includes('data-av="meld-aantal"') && ov.includes('capture="environment"') && ov.includes('data-av="meld-notitie"') && ov.includes('verplicht bij kapot'), 'overlay: stuk, Kapot/Weg, aantal, foto (verplicht bij kapot), notitie');
  T.check(AV.meldOverlay({ soort: 'weg', aantal: 1, stuk: '__vrij' }, g).includes('mag, helpt kantoor'), 'bij Weg is de foto optioneel');
  T.check(AV.lijst(data, { vandaag: '2026-11-10' }).includes('+ Losse melding'), 'lijst: knop "+ Losse melding"');
  const hs = AV.bak({ ...g, handelingen: [g.handelingen.find((x) => x.soort !== 'melding') || { ...hk, soort: 'uit_pool', wacht_op_kantoor: false, kan_afvinken: true, aangevuld: 0, regel_id: 9999 }] }, {});
  T.check(/data-av="meld-open" data-stuk=/.test(hs), 'ook bij een stuk staat een kleine ⚠-knop');

  // losse melding (zonder bak)
  const lm = (await A('GET', '/api/nakijken')).json.bakken.find((b) => b.bak.soort === 'melding');
  T.check(lm && lm.sessie_id && lm.status === 'te_keuren', 'losse melding (zonder bak) staat als rij in Nakijken');
  const ld = (await A('GET', `/api/nakijken/sessie/${lm.sessie_id}`)).json;
  T.check(ld.items.some((i) => i.naam === 'Av2 Emmer coördinator') && ld.items.every((i) => i.acties.length === 3), 'losse melding: detail met de gemelde stukken en acties');
  data = (await A('GET', '/api/aanvullijst?alles=1')).json;
  T.check(data.bakken.some((b) => b.bak.naam === 'Losse melding' && b.handelingen.some((x) => x.stuk === 'Av2 Emmer coördinator' && x.wacht_op_kantoor)), 'losse melding staat ook op het aanvulscherm (wacht op kantoor)');

  // ═══ Kantoor beslist → gewone keten ═══
  const kies = (id, actie, aantal) => A('PUT', `/api/nakijken/regel/${id}`, { kantoor_actie: actie, kantoor_aantal: aantal });
  T.check((await kies(wegRegel, 'bestellen', 4)).status === 200 && (await kies(kapotRegel, 'afschrijven_bestellen', 5)).status === 200, 'kantoor beslist: weg → bestellen, kapot → afschrijven + bestellen');
  data = (await A('GET', '/api/aanvullijst?alles=1')).json;
  T.check(data.bakken.find((b) => b.sessie_id === nk.sessie_id).handelingen.find((x) => x.regel_id === wegRegel).wacht_op_kantoor === true, 'beslist maar keuring nog niet afgerond: blijft "wacht op kantoor"');
  r = await A('POST', `/api/nakijken/sessie/${nk.sessie_id}/afronden`);
  T.check(r.status === 200 && r.json.bestellingen === 2 && r.json.afschrijvingen === 1, `keuring weer afgerond: ${r.json.bestellingen} bestellingen, ${r.json.afschrijvingen} afschrijving`);
  data = (await A('GET', '/api/aanvullijst?alles=1')).json;
  let g2 = data.bakken.find((b) => b.sessie_id === nk.sessie_id);
  const hw = g2.handelingen.find((x) => x.regel_id === wegRegel);
  T.check(hw.soort === 'bestelling' && hw.kan_afvinken === false && !hw.wacht_op_kantoor && hw.gemeld === 1, 'na afronden: bestelling, wacht op levering (gewone keten)');
  T.check((await A('POST', `/api/aanvullijst/${wegRegel}/aangevuld`, { aangevuld: true })).status === 409, 'bestelling niet binnen → 409 zoals altijd');
  T.check((await A('POST', `/api/nakijken/regel/${wegRegel}/binnen`)).status === 200, 'kantoor zet de bestelling op binnen (afschrijven is meteen klaar om te plaatsen)');
  r = await A('POST', `/api/aanvullijst/${wegRegel}/aangevuld`, { aangevuld: true });
  T.check(r.status === 200 && (await ring.qty()) === 16, `weg-regel aangevuld (4) → voorraad Ring ${await ring.qty()}`);

  // ═══ "n van m gedaan" ═══
  T.check((await A('POST', `/api/aanvullijst/${kapotRegel}/aangevuld`, { aangevuld: true, aantal: 2 })).status === 400, 'afschrijven zonder foto → 400 (AV1-regel)');
  r = await A('POST', `/api/aanvullijst/${kapotRegel}/aangevuld`, { aangevuld: true, aantal: 2, foto_data: PNG });
  data = (await A('GET', '/api/aanvullijst?alles=1')).json;
  g2 = data.bakken.find((b) => b.sessie_id === nk.sessie_id);
  const hd = g2.handelingen.find((x) => x.regel_id === kapotRegel);
  T.check(r.status === 200 && r.json.gedaan === 2 && r.json.open === 3 && hd.gedaan === 2 && hd.totaal === 5 && hd.aantal === 3 && (await kegel.qty()) === 28, `2 van 5 gedaan: voorraad Kegel ${await kegel.qty()}, nog ${hd.aantal} open`);
  T.check(AV.handeling(hd, {}).includes('2 van 5 gedaan'), 'het aanvulscherm toont "2 van 5 gedaan"');
  r = await A('POST', `/api/aanvullijst/${kapotRegel}/aangevuld`, { aangevuld: true, aantal: 1, foto_data: PNG });
  data = (await A('GET', '/api/aanvullijst?alles=1')).json;
  const hd2 = data.bakken.find((b) => b.sessie_id === nk.sessie_id).handelingen.find((x) => x.regel_id === kapotRegel);
  T.check(hd2.gedaan === 3 && hd2.totaal === 5 && hd2.aantal === 2 && !hd2.aangevuld, `tweede deel: 3 van 5 gedaan, 2 open`);
  r = await A('POST', `/api/aanvullijst/${kapotRegel}/aangevuld`, { aangevuld: true, foto_data: PNG });
  T.check(r.status === 200 && (await kegel.qty()) === 25, `de rest (2) afvinken → voorraad Kegel ${await kegel.qty()} (30 − 5, nooit dubbel)`);

  // ═══ Punt 2 ═══
  const vandaagJs = lees('public/vandaag.js');
  T.check(/titel:m\.length===1\?'1 melding':m\.length\+' meldingen'[^}]*url:'\/meldingen'/.test(vandaagJs) && !/url:'\/vandaag\?tab=meldingen'/.test(vandaagJs), 'vandaag: de rij "n meldingen" linkt naar /meldingen');
  const tijden = (await A('GET', '/api/instellingen/tijden')).json.data;
  T.check(tijden.tijd_verhuis_avond === '17:00', `verhuis-avond toont standaard ${tijden.tijd_verhuis_avond}`);

  // ═══ gsm-maten ═══
  const css = lees('public/aanvullen.css');
  T.check(/\.av \.meldKnop\{width:100%;height:48px/.test(css) && /\.av \.knop\.melds\{min-width:44px\}/.test(css) && /\.av \.knop\{height:44px/.test(css) && /\.av \.knop\.klein\{height:44px/.test(css), 'knoppen (melden, ⚠ per stuk) zijn ≥ 44 px');
  T.check(/\.av \.meld\{position:fixed;inset:0/.test(css) && /\.av \.meld \.duo \.knop\{flex:1;height:52px\}/.test(css) && /min-height:48px/.test(css) && !/min-width:\d{3,}px/.test(css) && /box-sizing:border-box/.test(css), 'overlay van volle hoogte; velden 48 px; geen vaste breedtes → scrollWidth blijft 390');
  T.check(ov.length > 0 && !/<table|style="[^"]*width:\s*\d{3,}px/.test(ov), 'overlay-HTML heeft geen tabel en geen vaste pixelbreedte');
} catch (e) { T.fout('uitzondering: ' + (e && e.stack || e)); }
await T.einde(srv);
