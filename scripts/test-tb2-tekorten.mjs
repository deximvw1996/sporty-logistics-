// test-tb2-tekorten.mjs — TB2 (chat C): Voorraad & controles › Tekorten & bestellingen. Eigen server via _testhulp (poort 3345, herfst-test.db).
// Keten: KV telt → kantoor keurt in Nakijken (aanvaarden / uit pool / bestellen) → enkel goedgekeurde regels op /tekorten, één rij per
// artikel; voorstel uit voorraad ↔ te bestellen; omdraaien, besteld, binnen, negeren, afvinken (voorraad pas bij afvinken), bestellijst,
// aanvulling 30/10 (bestellen bij genoeg voorraad, bestelling zonder tekort, coördinator). DOM-bouw met de echte data-JSON + gsm-maten.
import * as T from './_testhulp.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const POORT = parseInt(process.env.TEST_POORT || '3345');
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: POORT });
const BASIC = 'Basic ' + Buffer.from('sporty:' + T.APP_PASSWORD).toString('base64');
let initSqlJs; try { initSqlJs = require('sql.js'); } catch { initSqlJs = require(T.ROOT + '/../sporty-railway/node_modules/sql.js'); }
const SQL = await initSqlJs();
let tok;
async function db(sql, params = []) {
  const r = await fetch(srv.base + '/api/backup-db', { headers: { authorization: BASIC, 'x-auth-token': tok } });
  const d = new SQL.Database(Buffer.from(await r.arrayBuffer()));
  const st = d.prepare(sql); st.bind(params); const rows = []; while (st.step()) rows.push(st.getAsObject()); st.free(); d.close(); return rows;
}
try {
  tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const P = (m, p, b) => T.api(srv.base, null, m, p, b);
  const thema = ijk.themas.alles_op_wieltjes;
  const R = (await db("SELECT id FROM locaties WHERE name='Rozenweg' AND (parent_id IS NULL OR parent_id=0)"))[0].id;

  // ── data: twee kampmomenten, elk een bak met Ballonnen TB2 (+ Lijm TB2, Touw TB2, Zout TB2) ──
  const maakBak = async (code, items) => {
    const b = (await A('POST', `/api/themas/${thema}/bakken`, { label: 'Tb2 ' + code, code })).json;
    for (const [naam, qty] of items) await A('POST', `/api/bakken/${b.id}/items`, { naam, qty });
    return b.id;
  };
  const bakId = { TB01: await maakBak('TB01', [['Ballonnen TB2', 30], ['Lijm TB2', 4], ['Touw TB2', 2]]), TB02: await maakBak('TB02', [['Ballonnen TB2', 15], ['Zout TB2', 5]]) };
  const kms = [ijk.kampmomenten.abdijschool, ijk.kampmomenten.betekom];
  for (const km of kms) await A('POST', `/api/kampmomenten/${km}/themas`, { thema_id: thema });
  const sessies = {};
  for (const [km, code, tellingen] of [[kms[0], 'TB01', { 'Ballonnen TB2': 10, 'Lijm TB2': 1, 'Touw TB2': 1 }], [kms[1], 'TB02', { 'Ballonnen TB2': 5, 'Zout TB2': 3 }]]) {
    const kvtok = await T.kvToken(srv.base, tok, km);
    const d0 = (await P('GET', `/api/kv/${kvtok}/data`)).json, bk = d0.bakken.find((b) => b.code === code);
    for (const it of bk.items) await P('POST', `/api/kv/${kvtok}/bakken/${bk.id}/tellen`, { regels: [{ item_id: it.id, aangetroffen: tellingen[it.naam] ?? it.gewenst, notitie: it.naam === 'Ballonnen TB2' && code === 'TB02' ? 'zak gescheurd' : '' }] });
    await P('POST', `/api/kv/${kvtok}/versturen`, {});
  }
  for (const code of ['TB01', 'TB02']) { const sid = (await db("SELECT id FROM nakijk_sessies WHERE bak_type='thema' AND thema_bak_id=? ORDER BY id DESC LIMIT 1", [bakId[code]]))[0].id; sessies[code] = (await A('GET', `/api/nakijken/sessie/${sid}`)).json; }
  const regel = (code, naam) => sessies[code].items.find((i) => i.naam === naam);

  // vóór de keuring: niets op de pagina, wel "te beslissen"
  let o = (await A('GET', '/api/tekorten-overzicht')).json;
  T.check(o.tellers.te_beslissen >= 5 && !o.artikels.some((a) => /TB2/.test(a.naam)), `ongekeurde meldingen: te_beslissen ${o.tellers.te_beslissen}, geen TB2-rij in de lijst`);

  // keuring in Nakijken: Ballonnen 2× uit pool (wordt één rij), Lijm aanvaard, Touw bestellen, Zout uit pool
  await A('PUT', `/api/nakijken/regel/${regel('TB01', 'Ballonnen TB2').regel_id}`, { kantoor_actie: 'uit_pool' });
  await A('PUT', `/api/nakijken/regel/${regel('TB02', 'Ballonnen TB2').regel_id}`, { kantoor_actie: 'uit_pool' });
  await A('PUT', `/api/nakijken/regel/${regel('TB01', 'Lijm TB2').regel_id}`, { kantoor_actie: 'aanvaarden' });
  await A('PUT', `/api/nakijken/regel/${regel('TB01', 'Touw TB2').regel_id}`, { kantoor_actie: 'bestellen' });
  await A('PUT', `/api/nakijken/regel/${regel('TB02', 'Zout TB2').regel_id}`, { kantoor_actie: 'uit_pool' });
  for (const code of ['TB01', 'TB02']) await A('POST', `/api/nakijken/sessie/${sessies[code].sessie_id}/afronden`);
  o = (await A('GET', '/api/tekorten-overzicht')).json;
  const art = (naam) => o.artikels.find((a) => a.naam === naam);
  T.check(!art('Lijm TB2'), 'aanvaarde melding (Lijm) staat NIET op de pagina');
  const bal = art('Ballonnen TB2');
  T.check(bal && bal.tekort === 30 && bal.n_bakken === 2 && bal.n_locaties === 2 && o.artikels.filter((a) => a.naam === 'Ballonnen TB2').length === 1, `twee regels in twee bakken → één rij: tekort ${bal?.tekort}, ${bal?.n_bakken} bakken, waar "${bal?.waar_tekst}"`);
  // voorraad zetten: Ballonnen 100 (minimum 20) → uit voorraad; Zout 3 (minimum 5) → te bestellen
  await A('POST', '/api/voorraad', { item_type_id: bal.item_type_id, locatie_id: R, qty: 100, minimum: 20 });
  await A('POST', '/api/voorraad', { item_type_id: art('Zout TB2').item_type_id, locatie_id: R, qty: 3, minimum: 5 });
  o = (await A('GET', '/api/tekorten-overzicht')).json;
  T.check(art('Ballonnen TB2').stand === 'uit_voorraad' && art('Ballonnen TB2').stand_voorstel === 'uit_voorraad' && !art('Ballonnen TB2').bestelling, `voldoende voorraad (100, min 20, tekort 30) → ${art('Ballonnen TB2').stand}, geen bestelling`);
  T.check(art('Zout TB2').stand === 'te_bestellen' && art('Zout TB2').bestel_voorstel === 4, `onder minimum (voorraad 3, min 5, tekort 2) → ${art('Zout TB2').stand}, bestel_voorstel ${art('Zout TB2').bestel_voorstel} (= 2 − 3 + 5)`);
  T.check(art('Touw TB2').stand === 'te_bestellen' && art('Touw TB2').bestel_voorstel === 1, `geen voorraad (Touw, tekort 1) → te_bestellen, voorstel ${art('Touw TB2').bestel_voorstel}`);

  // kantoor draait het voorstel om → gelogd, stand_bron kantoor
  let r = await A('PUT', `/api/tekorten/${art('Zout TB2').artikel_id}/stand`, { stand: 'uit_voorraad' });
  o = (await A('GET', '/api/tekorten-overzicht')).json;
  const zr = await db("SELECT kantoor_actie FROM nakijk_regels WHERE id=?", [regel('TB02', 'Zout TB2').regel_id]);
  const lgZ = await db("SELECT COUNT(*) AS n FROM wijzigingen WHERE tabel='tekort_bestellingen' AND context='tekorten' AND persoon_naam IS NOT NULL");
  T.check(r.status === 200 && art('Zout TB2').stand === 'uit_voorraad' && art('Zout TB2').stand_bron === 'kantoor' && zr[0].kantoor_actie === 'uit_pool' && lgZ[0].n >= 1, `omdraaien Zout → uit_voorraad (bron ${art('Zout TB2').stand_bron}), gelogd met naam`);
  r = await A('PUT', `/api/tekorten/${art('Zout TB2').artikel_id}/stand`, { stand: 'te_bestellen' });
  o = (await A('GET', '/api/tekorten-overzicht')).json;
  T.check(art('Zout TB2').stand === 'te_bestellen' && art('Zout TB2').stand_bron === 'voorstel', 'terug naar het voorstel → stand_bron voorstel');

  // besteld → binnen → voorraad + aantal, aanvullijst kan_afvinken
  const zout = art('Zout TB2');
  r = await A('POST', `/api/tekorten/${zout.artikel_id}/besteld`, { aantal: 10, waar_kopen: 'Colruyt' });
  o = (await A('GET', '/api/tekorten-overzicht')).json;
  let al = (await A('GET', '/api/aanvullijst?alles=1')).json.bakken.flatMap((b) => b.handelingen);
  const hZout = () => al.find((h) => h.regel_id === regel('TB02', 'Zout TB2').regel_id);
  T.check(art('Zout TB2').stand === 'besteld' && art('Zout TB2').bestelling.aantal === 10 && art('Zout TB2').bestelling.waar_kopen === 'Colruyt' && hZout()?.kan_afvinken === false, `besteld 10 bij Colruyt → stand besteld; aanvullijst-handeling nog niet afvinkbaar`);
  r = await A('POST', `/api/tekorten/${zout.artikel_id}/binnen`);
  o = (await A('GET', '/api/tekorten-overzicht')).json;
  al = (await A('GET', '/api/aanvullijst?alles=1')).json.bakken.flatMap((b) => b.handelingen);
  T.check(r.status === 200 && art('Zout TB2').stand === 'binnen' && art('Zout TB2').voorraad.rozenweg === 13 && hZout()?.kan_afvinken === true, `binnen → voorraad Rozenweg 3 + 10 = ${art('Zout TB2').voorraad.rozenweg}; handeling kan_afvinken ${hZout()?.kan_afvinken}`);
  T.check((await A('POST', `/api/tekorten/${zout.artikel_id}/binnen`)).status === 409, 'tweede keer binnen → 409 (voorraad niet dubbel verhoogd)');
  const d = (await A('GET', `/api/tekorten/${zout.artikel_id}/detail`)).json;
  T.check(d.tijdlijn.map((x) => x.stap + (x.stand ? ':' + x.stand : '')).join(' > ') === 'gemeld door KV:ok > gekeurd:ok > bestellen:ok > besteld:ok > binnen:ok > aangevuld:nu' && d.regels[0].code === 'TB02' && d.historiek.some((h) => /besteld: 10 bij Colruyt/.test(h.wat)) && d.historiek.some((h) => /bestelling binnen/.test(h.wat)),
    `detail: tijdlijn ${d.tijdlijn.map((x) => x.stap + (x.stand ? ':' + x.stand : '')).join(' > ')}; historiek ${d.historiek.map((h) => h.wat).join(' / ')}`);

  // afvinken uit voorraad verlaagt item_type_stock pas bij afvinken
  const balRegel = regel('TB01', 'Ballonnen TB2').regel_id;
  let st = (await db('SELECT qty FROM item_type_stock WHERE item_type_id=? AND locatie_id=?', [bal.item_type_id, R]))[0].qty;
  T.check(st === 100, `vóór afvinken: Ballonnen Rozenweg ${st} (keuring en stand veranderen de voorraad niet)`);
  await A('POST', `/api/aanvullijst/${balRegel}/aangevuld`, {});
  st = (await db('SELECT qty FROM item_type_stock WHERE item_type_id=? AND locatie_id=?', [bal.item_type_id, R]))[0].qty;
  T.check(st === 80, `na afvinken TB01 (20 ballonnen): Rozenweg ${st}`);
  await A('POST', `/api/aanvullijst/${balRegel}/aangevuld`, { aangevuld: false });
  st = (await db('SELECT qty FROM item_type_stock WHERE item_type_id=? AND locatie_id=?', [bal.item_type_id, R]))[0].qty;
  T.check(st === 100, `afvinken teruggezet → Rozenweg weer ${st}`);

  // negeren haalt het van de aanvullijst
  const touw = art('Touw TB2');
  r = await A('POST', `/api/tekorten/${touw.artikel_id}/negeren`, { reden: 'nog genoeg in de bak' });
  al = (await A('GET', '/api/aanvullijst?alles=1')).json.bakken.flatMap((b) => b.handelingen);
  o = (await A('GET', '/api/tekorten-overzicht')).json;
  T.check(r.status === 200 && !al.some((h) => h.regel_id === regel('TB01', 'Touw TB2').regel_id) && art('Touw TB2').stand === 'afgehandeld', `negeren → niet meer op de aanvullijst, stand ${art('Touw TB2').stand}`);

  // aanvulling 30/10: bestellen bij genoeg voorraad → extra aankoop, aanvullen blijft uit voorraad
  r = await A('POST', `/api/tekorten/${bal.artikel_id}/besteld`, { aantal: 50, waar_kopen: 'Action' });
  o = (await A('GET', '/api/tekorten-overzicht')).json;
  al = (await A('GET', '/api/aanvullijst?alles=1')).json.bakken.flatMap((b) => b.handelingen);
  T.check(r.status === 200 && art('Ballonnen TB2').stand === 'uit_voorraad' && art('Ballonnen TB2').bestelling?.extra === true && al.find((h) => h.regel_id === balRegel)?.kan_afvinken === true,
    `bestellen bij genoeg voorraad: 200, stand blijft ${art('Ballonnen TB2').stand}, bestelling extra, aanvullen blijft afvinkbaar`);
  let bl = (await A('GET', '/api/tekorten/bestellijst')).json;
  T.check(bl.artikels.some((a) => a.naam === 'Ballonnen TB2' && a.aantal === 50), 'extra bestelling staat op de bestellijst');
  await A('POST', `/api/tekorten/${bal.artikel_id}/binnen`);
  st = (await db('SELECT qty FROM item_type_stock WHERE item_type_id=? AND locatie_id=?', [bal.item_type_id, R]))[0].qty;
  T.check(st === 150, `extra bestelling binnen → Rozenweg 100 + 50 = ${st}`);

  // + Bestelling zonder tekort → binnen verhoogt alleen de voorraad
  const pion = (await db("SELECT id FROM item_types ORDER BY id LIMIT 1"))[0].id;
  const v0 = ((await db('SELECT qty FROM item_type_stock WHERE item_type_id=? AND locatie_id=?', [pion, R]))[0] || { qty: 0 }).qty;
  r = await A('POST', '/api/tekorten/bestelling', { item_type_id: pion, aantal: 12, waar_kopen: 'Decathlon', reden: 'voor het geval dat' });
  const losId = r.json.artikel_id;
  o = (await A('GET', '/api/tekorten-overzicht')).json;
  const los = o.artikels.find((a) => a.artikel_id === losId);
  bl = (await A('GET', '/api/tekorten/bestellijst')).json;
  T.check(r.status === 200 && los?.stand === 'besteld' && los.tekort === 0 && bl.artikels.some((a) => a.artikel_id === losId), `bestelling zonder tekort: rij ${losId} stand ${los?.stand}, op de bestellijst`);
  await A('POST', `/api/tekorten/${losId}/binnen`);
  const v1 = (await db('SELECT qty FROM item_type_stock WHERE item_type_id=? AND locatie_id=?', [pion, R]))[0].qty;
  o = (await A('GET', '/api/tekorten-overzicht')).json;
  T.check(v1 === v0 + 12 && o.artikels.find((a) => a.artikel_id === losId).stand === 'binnen', `binnen → voorraad ${v0} → ${v1}, stand binnen`);

  // bestellijst: alleen te bestellen / besteld (niet uit voorraad, niet binnen, niet afgehandeld)
  T.check(bl.artikels.every((a) => ['te_bestellen', 'besteld'].includes(a.stand) || a.naam === 'Ballonnen TB2') && !bl.artikels.some((a) => a.naam === 'Touw TB2' || a.naam === 'Zout TB2'), `bestellijst: ${bl.artikels.map((a) => a.naam + ' (' + a.stand + ')').join(', ')}`);
  const bp = await fetch(srv.base + '/tekorten/bestellijst', { headers: { authorization: BASIC, 'x-auth-token': tok } });
  T.check(bp.status === 200 && /Bestellijst/.test(await bp.text()), 'printbare bestellijst /tekorten/bestellijst 200');

  // + Tekort melden (kantoor)
  r = await A('POST', '/api/tekorten/melden', { item_type_id: bal.item_type_id, aantal: 5, reden: 'gezien bij bezoek' });
  o = (await A('GET', '/api/tekorten-overzicht')).json;
  T.check(r.status === 200 && art('Ballonnen TB2').tekort === 35, `tekort melden: Ballonnen tekort 30 → ${art('Ballonnen TB2').tekort}`);

  // pagina + rechten + coördinator
  const pg = await fetch(srv.base + '/tekorten', { headers: { authorization: BASIC, 'x-auth-token': tok } });
  const html = await pg.text();
  T.check(pg.status === 200 && /class="sub"/.test(html) && /Bestellijst/.test(html) && /Tekort melden/.test(html), 'GET /tekorten 200 met subbalk (Bestellijst · Export · + Tekort melden)');
  const cp = (await A('POST', '/api/personeel', { naam: 'Tb2 Coördinator', rol: 'coordinator' })).json;
  await A('POST', `/api/personeel/${cp.id}/pincode`, { pincode: '4321' });
  const ctok = (await P('POST', '/api/login', { persoon_id: cp.id, pincode: '4321' })).json.token;
  const C = (m, p, b) => T.api(srv.base, ctok, m, p, b);
  o = (await A('GET', '/api/tekorten-overzicht')).json;
  T.check((await C('GET', '/api/tekorten-overzicht')).status === 200 && (await C('POST', `/api/tekorten/${art('Ballonnen TB2').artikel_id}/besteld`, { aantal: 5, waar_kopen: 'Action' })).status === 200, 'coördinator: overzicht 200, bestellen 200');
  T.check((await C('POST', `/api/tekorten/${art('Ballonnen TB2').artikel_id}/negeren`, { reden: 'x' })).status === 403 && (await C('POST', '/api/tekorten/melden', { naam: 'x', aantal: 1 })).status === 403, 'coördinator: negeren 403, tekort melden 403');
  const chauf = (await A('POST', '/api/personeel', { naam: 'Tb2 Chauffeur', rol: 'chauffeur' })).json;
  await A('POST', `/api/personeel/${chauf.id}/pincode`, { pincode: '4322' });
  const htok = (await P('POST', '/api/login', { persoon_id: chauf.id, pincode: '4322' })).json.token;
  const pgC = await fetch(srv.base + '/tekorten', { headers: { authorization: BASIC, 'x-auth-token': htok } });
  T.check(pgC.status === 403 && (await T.api(srv.base, htok, 'GET', '/api/tekorten-overzicht')).status === 403, 'niet-kantoor (chauffeur): GET /tekorten 403, API 403');
  const naam = (await db("SELECT persoon_naam FROM wijzigingen WHERE tabel='tekort_bestellingen' ORDER BY id DESC LIMIT 1"))[0].persoon_naam;
  T.check(naam === 'Tb2 Coördinator', `bestelling door de coördinator gelogd met naam "${naam}"`);

  // vervangstrook in index.html
  const idx = require('node:fs').readFileSync(T.ROOT + '/index.html', 'utf8');
  T.check(/Voorraad staat nu in Materiaal › Catalogus/.test(idx) && /'\/tekorten'/.test(idx), 'index.html: vervangstrook "Voorraad staat nu in Materiaal › Catalogus" + link /tekorten');
  const NAV = require(T.ROOT + '/public/nav.js');
  T.check(JSON.stringify(NAV.SUB ? NAV.SUB.voorraad : null).includes('/tekorten') || /'\/tekorten': 'voorraad'/.test(require('node:fs').readFileSync(T.ROOT + '/public/nav.js', 'utf8')), 'nav.js: Voorraad-subbalk Nakijken · Tekorten & bestellingen · Aanvullijst');

  // ── DOM-bouw met echte data-JSON + gsm-maten ──
  const TB = require(T.ROOT + '/public/tekorten.js');
  o = (await A('GET', '/api/tekorten-overzicht')).json;
  const det = (await A('GET', `/api/tekorten/${art('Zout TB2').artikel_id}/detail`)).json;
  const rijHtml = TB.rij(art('Ballonnen TB2'), { act: true });
  const t = (h) => h.replace(/<[^>]+>/g, '\n').replace(/&amp;/g, '&').replace(/\n\s*\n+/g, '\n').trim().split('\n').join(' | ');
  T.check(/Ballonnen TB2/.test(rijHtml) && /2 bakken · 2 locaties/.test(rijHtml) && /uit voorraad/.test(rijHtml), `rij: ${t(rijHtml)}`);
  const dh = TB.detail(det, 'tekort');
  T.check(/Aanvullen uit voorraad/.test(dh) && /Negeren/.test(dh) && /Bestellen/.test(dh) && /Waar ontbreekt het/.test(dh) && /Na levering/.test(dh) && /Catalogus ›/.test(dh), `detail: ${t(dh).slice(0, 400)}`);
  const chips = TB.chips(o.tellers, 'open');
  T.check(/Open/.test(chips) && /Te beslissen/.test(chips) && /href="\/nakijken"/.test(chips) && /Afgehandeld/.test(chips), `chips: ${t(chips)}`);
  T.info('gsm-maten: zie de browsermeting in het verslag');
} catch (e) { T.fout('uitzondering: ' + e.stack); }
await T.einde(srv);
