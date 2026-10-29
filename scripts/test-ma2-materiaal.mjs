// test-ma2-materiaal.mjs — MA2 (chat D): Materiaal › Thema's, Pool, Catalogus op het kantoorpatroon. Eigen server via _testhulp (poort 3352, herfst-test.db).
// De HTML-bouwers van public/themas.js, pool.js en catalogus.js worden als module geladen en met de echte API-data aangeroepen (geen headless browser).
import * as T from './_testhulp.mjs';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: parseInt(process.env.TEST_POORT || '3352') });
const lees = (p) => fs.readFileSync(T.ROOT + '/' + p, 'utf8');
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const P = (m, p, b) => T.api(srv.base, null, m, p, b);

  // ── Paginas en rechten ──
  for (const pad of ['/themas', '/pool', '/catalogus']) {
    const r = await P('GET', pad);
    T.check(r.status === 200, `GET ${pad} → 200`);
  }
  for (const pad of ['/api/themas-overzicht', '/api/pool-overzicht', '/api/catalogus-overzicht', '/api/themas/1/detail', '/api/catalogus/1/detail', '/api/pool/vast/1/detail']) {
    const r = await P('GET', pad);
    T.check(r.status === 401 || r.status === 403, `${pad} zonder login → ${r.status}`);
  }
  const NAV = require(T.ROOT + '/public/nav.js');
  const subM = NAV.sub('materiaal', '/pool');
  T.check(['/themas', '/bakken', '/pool', '/catalogus'].every((h) => subM.includes(`href="${h}"`)) && /class="act" href="\/pool"/.test(subM) && NAV.PAGINA['/themas'] === 'materiaal' && NAV.PAGINA['/pool'] === 'materiaal' && NAV.PAGINA['/catalogus'] === 'materiaal', 'nav.js: Materiaal-subbalk Thema’s · Bakken · Pool · Catalogus, actieve knop volgt de URL');
  for (const f of ['themas', 'pool', 'catalogus']) {
    const h = lees(`public/${f}.html`);
    T.check(h.includes('/public/patroon.css') && h.indexOf('/public/nav.js') > -1 && h.indexOf('/public/nav.js') < h.indexOf(`/public/${f}.js`), `${f}.html laadt patroon.css en nav.js vóór het eigen script`);
  }

  // ═══ Punt 1: Thema's ═══
  const alle = (await A('GET', '/api/themas')).json, alleBakken = (await A('GET', '/api/alle-bakken')).json;
  let r = await A('GET', '/api/themas-overzicht');
  const TO = r.json;
  const leegSql = alleBakken.filter((t) => !t.bakken.length && !t.attributen.length).length;
  T.check(r.status === 200 && TO.tellers.alle === alle.length && TO.themas.length === alle.length, `tellers.alle = ${TO.tellers.alle} = aantal thema’s (${alle.length})`);
  T.check(TO.tellers.kamp === alle.filter((t) => t.categorie === 'kamp').length && TO.tellers.themadag === alle.filter((t) => t.categorie === 'themadag').length && TO.tellers.kleuters === alle.filter((t) => t.leeftijdsgroep === 'kleuters').length && TO.tellers.lager === alle.filter((t) => t.leeftijdsgroep === 'lagere school').length,
    `tellers kamp ${TO.tellers.kamp} / themadag ${TO.tellers.themadag} / kleuters ${TO.tellers.kleuters} / lager ${TO.tellers.lager} kloppen met /api/themas`);
  T.check(TO.tellers.leeg === leegSql && leegSql > 0, `chip "⚠ Leeg" ${TO.tellers.leeg} = thema’s zonder bakken én attributen (${leegSql})`);
  const gepl = TO.themas.filter((t) => t.gepland);
  T.check(TO.tellers.deze_periode === gepl.length && gepl.length > 0 && gepl.every((t) => /^wk \d+ /.test(t.periode_tekst)), `deze periode: ${gepl.length} thema’s met "wk N locatie"`);
  const metBakken = alleBakken.find((t) => t.bakken.length >= 2 && t.attributen.length >= 1);
  const rijT = TO.themas.find((t) => t.id === metBakken.id);
  T.check(rijT.n_bakken === metBakken.bakken.length && rijT.n_attributen === metBakken.attributen.length, `thema “${metBakken.name}”: ${rijT.n_bakken} bakken / ${rijT.n_attributen} attributen in de lijst = ${metBakken.bakken.length}/${metBakken.attributen.length} in /api/alle-bakken`);
  r = await A('GET', `/api/themas/${metBakken.id}/detail`);
  const DT = r.json;
  T.check(r.status === 200 && DT.bakken.length === metBakken.bakken.length && DT.attributen.length === metBakken.attributen.length && DT.bakken.every((b) => 'code' in b && 'n_stuks' in b && 'waar' in b) && Array.isArray(DT.kampmomenten) && Array.isArray(DT.historiek) && Array.isArray(DT.los), 'thema-detail: bakken, attributen, los, kampmomenten, historiek');
  // dupliceren
  r = await A('POST', `/api/themas-overzicht/${metBakken.id}/dupliceer`, {});
  const kopie = r.json;
  const DK = (await A('GET', `/api/themas/${kopie.id}/detail`)).json;
  T.check(r.status === 200 && /\(kopie\)$/.test(kopie.naam) && DK.bakken.length === DT.bakken.length && DK.attributen.length === DT.attributen.length && DK.los.length === DT.los.length, `dupliceren: “${kopie.naam}” met dezelfde koppelingen`);
  // koppelen, ontkoppelen, los materiaal
  const vrijeBak = (await A('GET', '/api/bakken-zoek?q=')).json.bakken.find((b) => !DK.bakken.some((x) => x.id === b.id));
  r = await A('POST', `/api/themas-overzicht/${kopie.id}/koppel`, { bak_id: vrijeBak.id });
  let d2 = (await A('GET', `/api/themas/${kopie.id}/detail`)).json;
  T.check(r.status === 200 && d2.bakken.length === DK.bakken.length + 1, 'bak koppelen: +1 bak');
  r = await A('DELETE', `/api/themas-overzicht/${kopie.id}/koppel/bak/${vrijeBak.id}`);
  d2 = (await A('GET', `/api/themas/${kopie.id}/detail`)).json;
  T.check(r.status === 200 && d2.bakken.length === DK.bakken.length, 'bak ontkoppelen: terug op het oude aantal (de bak zelf blijft bestaan)');
  T.check((await A('DELETE', `/api/themas-overzicht/${kopie.id}/koppel/bak/${vrijeBak.id}`)).status === 404, 'ontkoppelen van een niet-bestaande koppeling → 404');
  const vrijeAttr = (await A('GET', '/api/bakken-zoek?q=')).json.attributen.find((a) => !DK.attributen.some((x) => x.id === a.id));
  r = await A('POST', `/api/themas-overzicht/${kopie.id}/koppel`, { attribuut_id: vrijeAttr.id });
  d2 = (await A('GET', `/api/themas/${kopie.id}/detail`)).json;
  T.check(r.status === 200 && d2.attributen.length === DK.attributen.length + 1, 'attribuut koppelen: +1');
  await A('DELETE', `/api/themas-overzicht/${kopie.id}/koppel/attribuut/${vrijeAttr.id}`);
  r = await A('POST', `/api/themas-overzicht/${kopie.id}/los`, { naam: 'Batterijen AA MA2', qty: 12, verbruik: true });
  d2 = (await A('GET', `/api/themas/${kopie.id}/detail`)).json;
  const losRij = d2.los.find((m) => m.naam === 'Batterijen AA MA2');
  T.check(r.status === 200 && losRij && losRij.qty === 12 && losRij.verbruik, 'los materiaal toevoegen (12, verbruik)');
  r = await A('DELETE', `/api/themas-overzicht/${kopie.id}/los/${losRij.id}`);
  T.check(r.status === 200 && !(await A('GET', `/api/themas/${kopie.id}/detail`)).json.los.some((m) => m.naam === 'Batterijen AA MA2'), 'los materiaal verwijderen');
  // bewerken + historiek
  r = await A('PUT', `/api/themas-overzicht/${kopie.id}`, { name: 'MA2 testthema', categorie: 'themadag', heeft_kookactiviteit: true });
  d2 = (await A('GET', `/api/themas/${kopie.id}/detail`)).json;
  T.check(r.status === 200 && d2.thema.naam === 'MA2 testthema' && d2.thema.categorie === 'themadag' && d2.thema.kook === true, 'bewerken: naam, soort en kookactiviteit');
  T.check(d2.historiek.some((h) => /naam: .* → MA2 testthema/.test(h.wat)) && d2.historiek.some((h) => /gekoppeld/.test(h.wat)) && d2.historiek.some((h) => /ontkoppeld/.test(h.wat)) && d2.historiek.some((h) => /los materiaal/.test(h.wat)), `historiek toont naamwijziging, koppelen, ontkoppelen en los materiaal (${d2.historiek.length} regels)`);
  T.check((await A('PUT', `/api/themas-overzicht/${kopie.id}`, { name: '  ' })).status === 400, 'bewerken met lege naam → 400');
  // verwijderen
  const planT = gepl[0];
  r = await A('DELETE', `/api/themas-overzicht/${planT.id}`);
  T.check(r.status === 409 && /kampmoment/.test(r.json.error), `verwijderen van een gepland thema → 409 (“${(r.json.error || '').slice(0, 60)}…”)`);
  r = await A('DELETE', `/api/themas-overzicht/${kopie.id}`);
  T.check(r.status === 200 && (await A('GET', `/api/themas/${kopie.id}/detail`)).status === 404, 'verwijderen van de kopie → 200, thema weg');
  T.check((await A('GET', '/api/themas-overzicht')).json.tellers.alle === alle.length, 'na dupliceren + verwijderen is het aantal thema’s weer gelijk');
  // DOM
  const TH = require(T.ROOT + '/public/themas.js');
  const lh = TO.themas.slice(0, 40).map((t) => TH.rij(t)).join('');
  T.check(lh.includes('class="kleur"') && lh.includes('kamp') && /ok<\/span>/.test(lh) && lh.includes('type="checkbox"'), 'DOM thema-rij: kleurvlak, soort, status en vakje');
  T.check(TH.rij(TO.themas.find((t) => t.leeg)).includes('⚠ leeg'), 'DOM: leeg thema krijgt “⚠ leeg”');
  const dh = TH.detail(DT, 'inhoud');
  T.check(dh.includes('Bakken ' + DT.bakken.length) && dh.includes('alles in Bakken ›') && dh.includes('+ attribuut') && dh.includes('+ regel') && dh.includes('Instellingen') && dh.includes('Bewerken') && dh.includes('Dupliceren') && dh.includes('+ Bak koppelen') && dh.includes('data-ontkoppel="bak:'), 'DOM thema-detail: blokken en knoppen zoals het ontwerp');
  T.check(TH.detail(DT, 'kampmomenten').includes('Kampmomenten') && TH.detail(DT, 'historiek').includes('Historiek (alles gelogd)'), 'DOM: tabs Kampmomenten en Historiek');

  // ═══ Punt 3: Catalogus ═══
  const types = (await A('GET', '/api/item-types')).json;
  r = await A('GET', '/api/catalogus-overzicht');
  const C0 = r.json;
  T.check(r.status === 200 && C0.tellers.alle === types.length && C0.artikels.length === 200 && C0.meer === true && C0.totaal_gefilterd === types.length, `catalogus: ${C0.tellers.alle} artikels, eerste pagina ${C0.artikels.length}, meer = ${C0.meer}`);
  T.check(C0.tellers.sport === types.filter((t) => t.categorie === 'sport').length && C0.tellers.materiaal === types.filter((t) => t.categorie !== 'sport').length, 'tellers materiaal/sport kloppen met /api/item-types');
  const C1 = (await A('GET', '/api/catalogus-overzicht?offset=200')).json;
  T.check(C1.artikels.length === 200 && !C1.artikels.some((a) => C0.artikels.some((b) => b.id === a.id)), 'paginering: offset 200 geeft 200 andere artikels');
  T.check(C0.artikels.every((a) => 'voorraad_rozenweg' in a && 'voorraad_kantoor' in a && 'n_bakken' in a && 'eenheid' in a && 'status' in a), 'elk artikel heeft aparte kolommen voorraad_rozenweg en voorraad_kantoor');
  const zk = (await A('GET', '/api/catalogus-overzicht?zoek=archery')).json;
  T.check(zk.artikels.length > 0 && zk.artikels.every((a) => /archery/i.test(a.naam)), `server-side zoeken: “archery” → ${zk.artikels.length} treffers`);
  T.check((await A('GET', '/api/catalogus-overzicht?chip=sport&limiet=500')).json.artikels.every((a) => a.sport), 'chip sport toont enkel sportartikels');
  // gezaaid dubbel paar + samenvoegen
  const n1 = (await A('POST', '/api/item-types', { naam: 'Pijpenragers MA2', eenheid: 'stuk', categorie: 'materiaal' })).json;
  const n2 = (await A('POST', '/api/item-types', { naam: 'Pijpenrager MA2', eenheid: 'stuk', categorie: 'materiaal' })).json;
  const thBak = (await A('POST', `/api/themas/${ijk.themas.alles_op_wieltjes}/bakken`, { label: 'Ma2 bak', code: 'MA2X' })).json;
  const itemRes = await A('POST', `/api/bakken/${thBak.id}/items`, { naam: 'Pijpenrager MA2', qty: 4 });
  const rozenwegId = (await A('GET', `/api/catalogus/${n1.id}/detail`)).json.voorraad.find((v) => v.naam === 'Rozenweg').locatie_id;
  const kantoorId = (await A('GET', `/api/catalogus/${n1.id}/detail`)).json.voorraad.find((v) => v.naam === 'Kantoor').locatie_id;
  await A('PUT', `/api/catalogus/${n1.id}/voorraad`, { locatie_id: rozenwegId, qty: 5, minimum: 8 });
  await A('PUT', `/api/catalogus/${n2.id}/voorraad`, { locatie_id: rozenwegId, qty: 7 });
  await A('PUT', `/api/catalogus/${n2.id}/voorraad`, { locatie_id: kantoorId, qty: 40 });
  const cd = (await A('GET', '/api/catalogus-overzicht?chip=dubbel&limiet=500')).json;
  const dubbelNamen = cd.artikels.map((a) => a.naam);
  T.check(dubbelNamen.includes('Pijpenragers MA2') && dubbelNamen.includes('Pijpenrager MA2') && cd.tellers.dubbel === cd.artikels.length, `dubbel-detectie vindt het gezaaide paar (${cd.tellers.dubbel} in de chip)`);
  const rij1 = (await A('GET', '/api/catalogus-overzicht?zoek=Pijpenragers MA2')).json.artikels[0];
  T.check(rij1.status === 'onder_min' && rij1.minimum === 8 && rij1.voorraad_rozenweg === 5, 'artikel onder zijn minimum krijgt status onder_min (5 < 8)');
  await A('PUT', `/api/catalogus/${n1.id}/voorraad`, { locatie_id: rozenwegId, delta: 1 });
  T.check((await A('GET', `/api/catalogus/${n1.id}/detail`)).json.voorraad.find((v) => v.naam === 'Rozenweg').qty === 6, 'voorraad + (delta 1): 5 → 6');
  r = await A('PUT', `/api/catalogus/${n1.id}/voorraad`, { locatie_id: rozenwegId, delta: -99 });
  T.check(r.status === 400, 'voorraad onder nul → 400');
  const det2 = (await A('GET', `/api/catalogus/${n2.id}/detail`)).json;
  T.check(det2.dubbel.some((d) => d.id === n1.id) && det2.gebruik.length >= 1 && det2.gebruik.some((g) => g.bak_id === thBak.id), 'detail “Pijpenrager MA2”: staat in onze bak en toont het dubbele artikel');
  r = await A('DELETE', `/api/catalogus-overzicht/${n2.id}`);
  T.check(r.status === 409, `verwijderen van een artikel in gebruik → 409 (“${(r.json.error || '').slice(0, 50)}…”)`);
  r = await A('POST', `/api/catalogus/${n2.id}/samenvoegen`, { naar_id: n1.id });
  const na = (await A('GET', `/api/catalogus/${n1.id}/detail`)).json;
  T.check(r.status === 200 && r.json.bak_items >= 1, `samenvoegen: ${r.json.bak_items} bakregel(s) verplaatst`);
  T.check(na.gebruik.some((g) => g.bak_id === thBak.id) && (await A('GET', `/api/catalogus/${n2.id}/detail`)).status === 404, 'na samenvoegen zit de bakregel op het doelartikel en is het andere artikel weg');
  const vo = Object.fromEntries(na.voorraad.map((v) => [v.naam, v.qty]));
  T.check(vo.Rozenweg === 13 && vo.Kantoor === 40, `voorraad opgeteld per stockage (Rozenweg 6 + 7 = ${vo.Rozenweg}, Kantoor ${vo.Kantoor})`);
  T.check(na.historiek.some((h) => /voorraad/.test(h.wat)), 'historiek toont de voorraadwijzigingen');
  r = await A('POST', `/api/catalogus/${n1.id}/samenvoegen`, { naar_id: n1.id });
  T.check(r.status === 400, 'samenvoegen met zichzelf → 400');
  const leeg = (await A('POST', '/api/item-types', { naam: 'Ma2 ongebruikt artikel xyz', eenheid: 'stuk', categorie: 'materiaal' })).json;
  T.check((await A('DELETE', `/api/catalogus-overzicht/${leeg.id}`)).status === 200, 'verwijderen van een ongebruikt artikel → 200');
  T.check((await A('POST', '/api/catalogus-overzicht/samenvoegen', { ids: [1], naar_id: 1 })).status === 400, 'bulk samenvoegen met 1 artikel → 400');
  r = await A('PUT', `/api/catalogus/${n1.id}`, { naam: 'Pijpenragers MA2', eenheid: 'doos', categorie: 'knutsel' });
  T.check(r.status === 200 && (await A('GET', `/api/catalogus/${n1.id}/detail`)).json.artikel.eenheid === 'doos', 'bewerken: eenheid doos');
  // DOM
  const CA = require(T.ROOT + '/public/catalogus.js');
  const rh = CA.rij(rij1);
  T.check(rh.includes('class="get"') && (rh.match(/class="get"/g) || []).length === 2 && rh.includes('⚠ onder min. 8'), 'DOM catalogus-rij: twee rechts uitgelijnde voorraadkolommen en “⚠ onder min.”');
  T.check(CA.rij({ ...rij1, status: 'dubbel' }).includes('mogelijk dubbel') && CA.getal(1200) === (1200).toLocaleString('nl-BE'), 'DOM: “mogelijk dubbel” en getalnotatie');
  const cdh = CA.detail(det2, 'gebruik');
  T.check(cdh.includes('In bakken') && cdh.includes('Voorraad per stockage') && cdh.includes('Deze periode') && cdh.includes('Mogelijk dubbel') && cdh.includes('Samenvoegen hierin') && cdh.includes('Samenvoegen met…') && cdh.includes('Bestellen'), 'DOM catalogus-detail: vier blokken en knoppen zoals het ontwerp');
  T.check(/data-stap="\d+:-1"/.test(cdh) && /data-stap="\d+:1"/.test(cdh), 'DOM: − / + per stockage');
  T.check(lees('public/catalogus.html').includes('Rozenweg') && lees('public/catalogus.html').includes('Kantoor') && lees('public/catalogus.html').includes('text-align:right'), 'catalogus.html: kolomkoppen Rozenweg en Kantoor rechts uitgelijnd');

  // ═══ Punt 2: Pool ═══
  r = await A('GET', '/api/pool-overzicht');
  const PO = r.json;
  const bulkSql = (await A('GET', '/api/vaste-bakken')).json;
  T.check(r.status === 200 && PO.tellers.alle === PO.stukken.length && PO.tellers.alle === PO.tellers.per_aantal + PO.tellers.per_stuk + PO.tellers.sport, `pool: ${PO.tellers.alle} poolstukken = ${PO.tellers.per_aantal} per aantal + ${PO.tellers.per_stuk} per stuk + ${PO.tellers.sport} sport`);
  const bulkVast = bulkSql.filter((b) => b.is_bulk);
  T.check(PO.tellers.per_aantal === bulkVast.length, `per aantal (${PO.tellers.per_aantal}) = bulk-rijen in /api/vaste-bakken (${bulkVast.length})`);
  const sportN = (await A('GET', '/api/sport')).json;
  T.check(PO.tellers.sport === (sportN.items || sportN).length, `sport (${PO.tellers.sport}) = pakketten in /api/sport`);
  // bulk-spreiding: som = totaal voor ALLE per-aantal-stukken
  let somOk = 0, somFout = [];
  for (const s of PO.stukken.filter((x) => x.mode === 'aantal')) {
    const d = (await A('GET', `/api/pool/vast/${s.id}/detail`)).json;
    const som = d.spreiding.reduce((t, x) => t + x.aantal, 0);
    if (som === s.totaal) somOk++; else somFout.push(`${s.naam}: ${som} ≠ ${s.totaal}`);
  }
  T.check(somFout.length === 0 && somOk === PO.tellers.per_aantal, `bulk-spreiding: som = totaal bij ${somOk}/${PO.tellers.per_aantal} stukken ${somFout.slice(0, 2).join('; ')}`);
  const fiets = PO.stukken.find((s) => /Kleuterfiets rood/.test(s.naam));
  const df = (await A('GET', `/api/pool/vast/${fiets.id}/detail`)).json;
  T.check(fiets && fiets.totaal === 17 && /Rozenweg/.test(fiets.waar_tekst) && df.spreiding.length >= 1 && df.gegevens.some((g) => g.k === 'Type') && Array.isArray(df.fotos) && Array.isArray(df.historiek), `detail “${fiets.naam}”: spreiding, gegevens, foto’s, historiek (${df.spreiding.map((x) => x.naam + ' ' + x.aantal).join(' · ')})`);
  const perStuk = PO.stukken.find((s) => s.mode === 'stuk' && s.totaal >= 2);
  const dp = (await A('GET', `/api/pool/vast/${perStuk.id}/detail`)).json;
  T.check(dp.spreiding.reduce((t, x) => t + x.aantal, 0) === perStuk.totaal && dp.bak_ids.length === perStuk.totaal, `per stuk “${perStuk.naam}”: ${perStuk.totaal} exemplaren, ${dp.bak_ids.length} bakken`);
  // sport
  const sp = PO.stukken.filter((s) => s.mode === 'sport');
  const spMetWeek = [];
  for (const s of sp) { const d = (await A('GET', `/api/pool/sport/${s.id}/detail?periode_id=1`)).json; if (d.sets.some((x) => x.weken.length)) { spMetWeek.push([s, d]); break; } }
  T.check(spMetWeek.length === 1 && spMetWeek[0][1].sets.length === spMetWeek[0][0].totaal && spMetWeek[0][1].stuk.nodig >= 1, `sport: “${spMetWeek[0] && spMetWeek[0][0].naam}” heeft ${spMetWeek[0] && spMetWeek[0][1].sets.length} sets met weken; nodig = max sets in één week (${spMetWeek[0] && spMetWeek[0][1].stuk.nodig})`);
  r = await A('POST', `/api/pool-overzicht/sport/${spMetWeek[0][0].id}/verplaats`, { naar_locatie_id: 1, aantal: 1 });
  T.check(r.status === 400, 'sportsets verplaatsen via Pool → 400 (gaat per week)');
  r = await A('DELETE', `/api/pool-overzicht/sport/${spMetWeek[0][0].id}`);
  T.check(r.status === 409 && /ingepland/.test(r.json.error), 'sportpakket verwijderen terwijl het ingepland is → 409');
  // verplaatsen bulk
  const rw = df.spreiding.find((x) => x.sub === 'thuis');
  const doel = (await A('GET', '/api/locaties-overzicht')).json.locaties.find((l) => l.type === 'kamp');
  const voor = (await A('GET', `/api/pool/vast/${fiets.id}/detail`)).json;
  r = await A('POST', `/api/pool-overzicht/vast/${fiets.id}/verplaats`, { van_locatie_id: rw.locatie_id, naar_locatie_id: doel.id, aantal: 2, reden: 'MA2 test' });
  const na2 = (await A('GET', `/api/pool/vast/${fiets.id}/detail`)).json;
  const somNa = na2.spreiding.reduce((t, x) => t + x.aantal, 0);
  T.check(r.status === 200 && somNa === 17 && na2.spreiding.find((x) => x.locatie_id === doel.id).aantal === (voor.spreiding.find((x) => x.locatie_id === doel.id)?.aantal || 0) + 2, `verplaatsen bulk: 2 naar ${doel.naam}, som blijft ${somNa}`);
  T.check(na2.historiek.some((h) => /spreiding/.test(h.wat)), 'verplaatsen staat in de historiek');
  r = await A('POST', `/api/pool-overzicht/vast/${fiets.id}/verplaats`, { van_locatie_id: rw.locatie_id, naar_locatie_id: doel.id, aantal: 999, reden: 'te veel' });
  T.check(r.status === 409, `verplaatsen van meer dan er staat → 409 (“${(r.json.error || '').slice(0, 50)}…”)`);
  const PO2 = (await A('GET', '/api/pool-overzicht')).json;
  T.check(PO2.stukken.find((s) => s.id === fiets.id && s.soort === 'vast').op_locatie === true && PO2.tellers.op_locatie >= 1, 'chip “Op locatie” telt het verplaatste poolstuk');
  r = await A('DELETE', `/api/pool-overzicht/vast/${fiets.id}`);
  T.check(r.status === 409, 'poolstuk op locatie verwijderen → 409');
  // per stuk verplaatsen
  r = await A('POST', `/api/pool-overzicht/vast/${perStuk.id}/verplaats`, { van_locatie_id: dp.spreiding[0].locatie_id, naar_locatie_id: doel.id, aantal: 1, reden: 'MA2' });
  const dp2 = (await A('GET', `/api/pool/vast/${perStuk.id}/detail`)).json;
  T.check(r.status === 200 && dp2.spreiding.reduce((t, x) => t + x.aantal, 0) === perStuk.totaal && dp2.spreiding.some((x) => x.locatie_id === doel.id && x.aantal === 1), 'verplaatsen per stuk: 1 exemplaar naar de locatie, totaal gelijk');
  r = await A('PUT', `/api/pool-overzicht/vast/${fiets.id}`, { naam: fiets.naam, notitie: 'MA2 notitie' });
  T.check(r.status === 200 && (await A('GET', `/api/pool/vast/${fiets.id}/detail`)).json.gegevens.find((g) => g.k === 'Notitie').v === 'MA2 notitie', 'bewerken: notitie bewaard');
  // te weinig: een nodig > totaal
  const tw = PO.stukken.filter((s) => s.tekort > 0);
  T.check(PO.tellers.te_weinig === tw.length, `chip “⚠ Te weinig” (${PO.tellers.te_weinig}) = stukken met tekort (${tw.length}${tw[0] ? ': ' + tw[0].naam + ' −' + tw[0].tekort : ''})`);
  // DOM
  const PL = require(T.ROOT + '/public/pool.js');
  const prh = PO.stukken.slice(0, 30).map((s) => PL.rij(s)).join('');
  T.check(prh.includes('type="checkbox"') && /<b>\d+<\/b>/.test(prh) && prh.includes('class="k"') && /ok<\/span>/.test(prh), 'DOM pool-rij: totaal, waar nu, nodig, status');
  if (tw[0]) T.check(PL.rij(tw[0]).includes(`⚠ ${tw[0].tekort} te weinig`), 'DOM: “⚠ N te weinig”');
  const pdh = PL.detail(na2, 'spreiding');
  T.check(pdh.includes('Waar staan ze nu (17)') && pdh.includes('Nodig deze periode') && pdh.includes('bezetting') && pdh.includes('Gegevens') && pdh.includes("Foto's") && pdh.includes('Verplaatsen') && pdh.includes('🖨 Etiket') && pdh.includes('Bewerken'), 'DOM pool-detail: Spreiding, Nodig met bezettingsbalk, Gegevens, Foto’s en knoppen');
  const sdh = PL.detail(spMetWeek[0][1], 'spreiding');
  T.check(sdh.includes('Sets en weken') && sdh.includes('Inplannen') && /href="\/kampmomenten(\?id=\d+)?"/.test(sdh), 'DOM sportpakket: sets met weken en knop Inplannen → /kampmomenten');

  // ═══ Punt 5: gsm (MOBIEL-REGEL) ═══
  for (const f of ['themas', 'pool', 'catalogus']) {
    const c = lees(`public/${f}.css`);
    T.check(/@media \(max-width:767px\)/.test(c) && /toon-detail/.test(c) && /min-height:44px/.test(c) && /overflow-x:auto/.test(c) && /\.terug/.test(c), `${f}.css: gsm-regels (detail als volgend scherm met ‹ terug, knoppen ≥ 44 px, chips scrollen horizontaal)`);
    T.check(lees(`public/${f}.js`).includes('data-act="terug"'), `${f}.js: knop ‹ terug in het detail`);
  }

  // ═══ Punt 4: vervangstroken in index.html ═══
  const ix = lees('index.html');
  T.check(/function toonVervangstrook/.test(ix) && /Dit scherm is vervangen door/.test(ix), 'index.html heeft de vervangstrook (NAV1)');
  for (const [tab, doel] of [['themas', '/themas'], ['vastebakken', '/pool'], ['catalogus', '/catalogus'], ['sport', '/pool']]) {
    T.check(new RegExp("ms==='" + tab + "'[^;]*'" + doel.replace('/', '\/') + "'").test(ix), `index.html: oude tab “${tab}” toont de strook met → ${doel}`);
  }
  T.check(/Sportsets staan nu in Pool; het sportrooster verhuist later naar Planning/.test(ix), 'index.html: sporttab meldt dat sportsets in Pool staan en het sportrooster later naar Planning verhuist');
} catch (e) {
  T.fout('test crashte: ' + (e.stack || e));
}
await T.einde(srv);
