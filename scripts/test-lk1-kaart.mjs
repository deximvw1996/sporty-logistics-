// test-lk1-kaart.mjs — LK1 (chat D): Locaties › Kaart (Lijst/Kaart-schakelaar) + voertuig wisselen in het ritdetail + /bakken?thema= + strengere dubbel-regel in de Catalogus.
// Eigen server via _testhulp (poort 3356, herfst-test.db). Pagina's zonder headless browser: HTML/JS-bronnen en de echte API-data.
import * as T from './_testhulp.mjs';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const lees = (p) => fs.readFileSync(T.ROOT + '/' + p, 'utf8');
const plus = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const srv = await T.startServer({ poort: 3356 });
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const P = (m, p, b) => T.api(srv.base, null, m, p, b);

  // ═══ Punt 1: kaartdata en pagina ═══
  const o = (await A('GET', '/api/locaties-overzicht')).json;
  const met = o.locaties.filter((l) => l.lat != null && l.lng != null);
  const zonder = o.locaties.filter((l) => l.lat == null || l.lng == null);
  T.check(met.length === 28 && zonder.length === o.locaties.length - 28 && o.tellers.zonder_kaart === zonder.length, `kaartdata: ${met.length} locaties met coördinaten, teller "zonder" = ${o.tellers.zonder_kaart}`);
  T.check(met.every((l) => typeof l.lat === 'number' && typeof l.lng === 'number' && Math.abs(l.lat) <= 90 && Math.abs(l.lng) <= 180), 'coördinaten zijn getallen binnen het bereik');
  T.check(met.some((l) => l.type === 'stockage') && met.some((l) => l.type === 'kamp'), 'pins voor zowel kamp als stockage');
  const html = lees('public/locaties.html'), js = lees('public/locaties.js'), css = lees('public/locaties.css');
  T.check(/<span class="seg"><a data-zicht="lijst" class="act">Lijst<\/a><a data-zicht="kaart">Kaart<\/a><\/span>/.test(html), 'filterbalk: schakelaar Lijst / Kaart (.seg)');
  T.check(html.includes('id="kaart-map"') && html.includes('id="kaartvak"') && html.includes('leaflet@1.9.4/dist/leaflet.js') && html.includes('leaflet@1.9.4/dist/leaflet.css'), 'kaartcontainer + Leaflet 1.9.4 (unpkg, zoals de oude kaart)');
  T.check(js.includes("Q.get('zicht')==='kaart'") && js.includes("history.replaceState(null,'',`/locaties?zicht=kaart&id=${x.id}`)") && js.includes('laadDetail(x.id)'), '?zicht=kaart opent de kaart; klik op een pin = detail met ?id= (zelfde detailkaart)');
  T.check(js.includes("location.href='/locaties?zicht=kaart&id='+l.id") && !js.includes("'/#kaart"), 'knop 📍 Kaart in het detail wijst naar /locaties?zicht=kaart&id=<id>');
  T.check(js.includes('zonder adres op de kaart') && js.includes("FILTER='zonder_kaart'") && js.includes('zonder_kaart:l=>!metCoord(l)'), 'teller "N zonder adres op de kaart" met link naar de gefilterde lijst');
  T.check(js.includes('tekenKaart(l)') && js.includes('const l=zichtbaar();') && js.includes("x.type==='stockage'?' stockage'"), 'pins volgen de actieve chips (zichtbaar()), stockage oranje');
  T.check(/\.loc-kaart-pin\{background:#15803d/.test(css) && /\.loc-kaart-pin\.stockage\{background:#E65100\}/.test(css), 'kamp groen, stockage oranje');
  T.check(html.includes('href="/locaties?zicht=kaart"') && !html.includes('href="/#kaart"'), 'subbalk-link Kaart gaat naar /locaties?zicht=kaart');
  T.check((await P('GET', '/locaties?zicht=kaart')).status === 200 && (await A('GET', '/locaties?zicht=kaart&id=1')).status === 200, 'GET /locaties?zicht=kaart → 200');
  // gsm
  T.check(/@media \(max-width:767px\)/.test(css) && /#kaartvak\{height:60vh/.test(css) && /min-height:44px/.test(css) && /\.body\.toon-detail:not\(\.zicht-kaart\)/.test(css) && /\.terug\{display:inline-flex/.test(css) && js.includes('data-act="terug"'), 'gsm-CSS: kaart 60vh volle breedte, detail eronder, ‹ terug, knoppen ≥ 44 px');
  // vervangstrook
  const idx = lees('index.html');
  T.check(idx.includes("sec==='kaart'") && idx.includes('De kaart staat nu in Locaties › Kaart.') && idx.includes("'/locaties?zicht=kaart'"), 'oude Kaart-tab: vervangstrook "De kaart staat nu in Locaties › Kaart"');

  // ═══ Punt 2: voertuig wisselen in het ritdetail ═══
  const MA = '2027-03-01';
  const plan = async () => (await A('GET', `/api/ritplanning?week=${MA}`)).json;
  let pl = await plan();
  const rit = (id) => pl.dagen.flatMap((d) => d.ritten).find((r) => r.id === id);
  const dubbel = (r) => r.waarschuwingen.filter((w) => /^voertuig dubbel/.test(w));
  const cn = pl.voertuigen.find((v) => v.soort === 'eigen'), huur = (await A('POST', '/api/voertuigen', { naam: 'Huurbus LK1', soort: 'huur', plaatsen: 12 })).json;
  const di = plus(MA, 1);
  const rA = (await A('POST', '/api/ritten', { datum: di, vertrek: '13:00', personeel_id: 2, voertuig_id: cn.id })).json;
  const rB = (await A('POST', '/api/ritten', { datum: di, vertrek: '13:00', personeel_id: 3, voertuig_id: huur.id })).json;
  pl = await plan();
  T.check(dubbel(rit(rA.id)).length === 0 && dubbel(rit(rB.id)).length === 0, 'start: twee ritten, twee verschillende voertuigen → geen "voertuig dubbel"');
  const w1 = await A('PUT', `/api/ritten/${rB.id}`, { voertuig_id: cn.id });
  pl = await plan();
  T.check(w1.status === 200 && rit(rB.id).voertuig.id === cn.id && rit(rB.id).voertuig.naam === cn.naam, `wisselen: voertuig_id opgeslagen (${rit(rB.id).voertuig.naam})`);
  T.check(dubbel(rit(rB.id)).some((w) => w.includes(`rit #${rA.id}`)) && dubbel(rit(rA.id)).some((w) => w.includes(`rit #${rB.id}`)), `waarschuwing "voertuig dubbel" verschijnt bij beide ritten (“${dubbel(rit(rB.id))[0]}”)`);
  const w2 = await A('PUT', `/api/ritten/${rB.id}`, { voertuig_id: huur.id });
  pl = await plan();
  T.check(w2.status === 200 && rit(rB.id).voertuig.id === huur.id && dubbel(rit(rB.id)).length === 0 && dubbel(rit(rA.id)).length === 0, 'terugwisselen: waarschuwing verdwijnt bij beide');
  const w3 = await A('PUT', `/api/ritten/${rB.id}`, { voertuig: 'Wagen van Evy', voertuig_soort: 'eigen', voertuig_capaciteit: 6 });
  pl = await plan();
  T.check(w3.status === 200 && rit(rB.id).voertuig.id === null && rit(rB.id).voertuig.naam === 'Wagen van Evy' && rit(rB.id).voertuig.capaciteit === 6, '"Ander voertuig…": vrije naam + capaciteit, zonder voertuig_id');
  T.check((await A('PUT', `/api/ritten/${rB.id}`, { voertuig_id: 999999 })).status === 400, 'onbekend voertuig_id → 400');
  const rp = lees('public/ritplanning.js');
  T.check(rp.includes('data-vsel') && rp.includes('Ander voertuig…') && rp.includes('(ook op rit #') && rp.includes("api('PUT',`/api/ritten/${ritId}`,body)") && rp.includes('Eigen voertuigen') && rp.includes("select[data-vsel]"), 'ritdetail: keuzelijst met groepen, "(ook op rit #n)", "Ander voertuig…" en PUT via sportyApi');
  T.check(rp.includes('${voertuigKeuze(r)}') && !rp.includes("· ${esc(r.voertuig.naam||'geen voertuig')} ·"), 'ritdetail toont de keuzelijst i.p.v. de tekst; de rest van het beeld is ongewijzigd');

  // ═══ Punt 3: /bakken?thema= ═══
  const bo = (await A('GET', '/api/bakken-overzicht')).json;
  T.check(Array.isArray(bo.themas) && bo.themas.length > 10 && bo.bakken.every((b) => Array.isArray(b.thema_ids)), 'bakken-overzicht geeft thema_ids per bak en de themalijst');
  const metThema = bo.bakken.filter((b) => b.thema_ids.length);
  const tid = bo.themas.map((t) => t.id).map((id) => [id, bo.bakken.filter((b) => b.thema_ids.includes(id)).length]).sort((a, b) => b[1] - a[1])[0];
  const gevolg = bo.bakken.filter((b) => b.thema_ids.includes(tid[0]));
  T.check(tid[1] >= 10 && tid[1] < bo.bakken.length && metThema.length > tid[1], `thema ${tid[0]}: ${tid[1]} van ${bo.bakken.length} bakken (alleen die van dat thema)`);
  const th = (await A('GET', `/api/themas/${tid[0]}/detail`)).json;
  const inThema = new Set([...(th.bakken || []).map((b) => b.naam), ...(th.attributen || []).map((a) => a.naam)]);
  const sl = (b) => (b.soort === 'attribuut' ? 'a' : 'b') + b.id;
  T.check(inThema.size === 0 || gevolg.filter((b) => b.soort === 'thema' || b.soort === 'attribuut').every((b) => inThema.has(b.naam)), `elke themabak en elk attribuut uit het filter staat in het thema-detail (${inThema.size}); gekoppelde vaste bakken komen er extra bij (${gevolg.filter((b) => b.soort === 'vast' || b.soort === 'pool').length})`);
  const bj = lees('public/bakken.js');
  T.check(bj.includes("parseInt(Q.get('thema'))") && bj.includes('thema_ids') && bj.includes('Thema: ') && bj.includes('✕') && bj.includes('data-wisthema') && bj.includes("history.replaceState(null,'','/bakken')"), 'bakken.js leest ?thema=, toont de wisbare chip "Thema: <naam> ✕"');
  T.check(lees('public/themas.js').includes('/bakken?thema=${t.id}'), 'knop "alles in Bakken ›" bij een thema wijst naar /bakken?thema=<id>');

  // ═══ Punt 4: dubbel-regel ═══
  const cat0 = (await A('GET', '/api/catalogus-overzicht?limiet=500&chip=dubbel')).json;
  T.check(cat0.tellers.dubbel > 0 && cat0.tellers.dubbel < cat0.tellers.alle, `dubbel-chip op de testdata: ${cat0.tellers.dubbel} artikels`);
  const nm = (id) => id;
  const mk = async (naam, categorie, eenheid = 'stuk') => (await A('POST', '/api/item-types', { naam, eenheid, categorie })).json;
  const b1 = await mk('Ballon LK1', 'materiaal'), b2 = await mk('Ballonnen LK1', 'materiaal');
  // meervoud geldt enkel voor het laatste woord: eindig dus op het te vergelijken woord
  const c1 = await mk('Kleurballon', 'materiaal'), c2 = await mk('Kleurballonnen', 'materiaal');
  const d1 = await mk('Hoepelx', 'materiaal'), d2 = await mk('Hoepelxen', 'speelgoed');
  const e1 = await mk('Lijm', 'materiaal'), e2 = await mk('Lijmen', 'materiaal');
  const f1 = await mk('Stoeptegel', 'materiaal', 'stuk'), f2 = await mk('Stoeptegels', 'materiaal', 'doos');
  const g1 = await mk('Krijtje LK1', 'materiaal'), g2 = await mk('krijtje  lk1', 'materiaal');
  const alle = (await A('GET', '/api/catalogus-overzicht?limiet=500&zoek=')).json;
  const volledig = [];
  for (let off = 0; ; off += 500) { const r = (await A('GET', `/api/catalogus-overzicht?limiet=500&offset=${off}`)).json; volledig.push(...r.artikels); if (!r.meer) break; }
  const dub = (naam) => volledig.find((a) => a.naam === naam).dubbel;
  T.check(dub('Kleurballon') && dub('Kleurballonnen'), '"Kleurballon"/"Kleurballonnen" (-nen na dubbele medeklinker, zelfde eenheid/categorie) blijft dubbel');
  T.check(!dub('Hoepelx') && !dub('Hoepelxen'), '"Hoepelx"/"Hoepelxen" met een andere categorie is geen dubbel');
  T.check(!dub('Lijm') && !dub('Lijmen'), '"Lijm"/"Lijmen" (korter dan 5 tekens) is geen dubbel');
  T.check(!dub('Stoeptegel') && !dub('Stoeptegels'), 'zelfde categorie maar andere eenheid is geen dubbel');
  T.check(dub('Krijtje LK1') && dub('krijtje  lk1'), 'gelijke genormaliseerde naam (hoofdletters, dubbele spaties) blijft dubbel');
  T.check(!dub('Ballon LK1') && !dub('Ballonnen LK1'), 'meervoud in een niet-laatste woord telt niet (Ballon LK1 ≠ Ballonnen LK1)');
  const det = (await A('GET', `/api/catalogus/${c1.id}/detail`)).json;
  T.check(det.dubbel.length === 1 && det.dubbel[0].id === c2.id && (await A('GET', `/api/catalogus/${d1.id}/detail`)).json.dubbel.length === 0, 'detail toont dezelfde dubbelen als de lijst');
  const oud = (n) => { let s = String(n).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); return s.split(' ').map((w) => (w.length > 4 && /en$/.test(w) ? w.slice(0, -2) : w.length > 3 && /s$/.test(w) ? w.slice(0, -1) : w)).join(' '); };
  const gOud = {}; volledig.forEach((a) => { (gOud[oud(a.naam)] = gOud[oud(a.naam)] || []).push(a); });
  const weg = Object.values(gOud).filter((g) => g.length > 1 && g.every((a) => !a.dubbel));
  T.check(weg.length >= 5 && weg.some((g) => g.some((a) => a.naam === 'Vork' || a.naam === 'Vorken')), `${weg.length} groepen van de oude regel zijn geen dubbel meer (bv. ${weg.slice(0, 3).map((g) => g.map((a) => a.naam).join('/')).join(', ')})`);
  T.info(`dubbel-artikels nu ${volledig.filter((a) => a.dubbel).length}`);
} catch (e) { T.fout('uitzondering: ' + (e.stack || e)); }
await T.einde(srv);
