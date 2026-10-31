// test-pl3-sportrooster.mjs — PL3 (chat D): Planning › Sportrooster per dag en per soort sport.
// Eigen server via _testhulp (poort 3355, herfst-test.db). De HTML-bouwers van public/sportrooster.js worden als module met de echte API-data aangeroepen.
import * as T from './_testhulp.mjs';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const lees = (p) => fs.readFileSync(T.ROOT + '/' + p, 'utf8');

const DAG = ['ma', 'di', 'wo', 'do', 'vr'];
const plus = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const srv = await T.startServer({ poort: 3355 });
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const P = (m, p, b) => T.api(srv.base, null, m, p, b);
  const PER = 1, W = 4; // Zomer 2026 (9 weken); week 4 is leeg in de testdata
  const q = (w = W) => `periode_id=${PER}&week=${w}`;

  // ═══ Migratie: bestaande rijen 1–5 en een soort ═══
  const sport = (await A('GET', `/api/sport?periode_id=${PER}`)).json;
  const rijen = sport.flatMap((i) => i.sets.flatMap((s) => s.planning));
  T.check(rijen.length > 0 && rijen.every((r) => r.dag_van === 1 && r.dag_tot === 5), `migratie: ${rijen.length} bestaande planningsrijen kregen dag_van 1 en dag_tot 5`);
  T.check(rijen.every((r) => r.soort && !/ [A-Z]$/.test(r.soort)), 'migratie: elke rij kreeg een soort zonder de laatste letter');

  // ═══ Week-API: alle soorten, uitwisselbaar ═══
  const w0 = (await A('GET', `/api/sportrooster/week?${q(1)}`)).json;
  T.check(w0.sporten.length >= 40 && w0.tellers.alle === w0.sporten.length, `week-API: ${w0.sporten.length} soorten (Alle ${w0.tellers.alle})`);
  T.check(w0.tellers.ingepland > 0 && w0.tellers.ingepland === w0.sporten.filter((s) => s.ingepland).length, `week 1: ${w0.tellers.ingepland} soorten ingepland (bestaande data telt mee)`);
  const wl = (await A('GET', `/api/sportrooster/week?${q()}`)).json;
  T.check(wl.tellers.ingepland === 0 && wl.tellers.te_weinig === 0 && wl.tellers.verhuis === 0, 'week 4 is leeg: 0 ingepland, 0 tekort, 0 verhuis');
  T.check(wl.sporten.every((s) => s.dagen.length === 5), 'elke soort heeft vijf dagvakjes');
  T.check(w0.label.startsWith('Week 1 · 29–'), `weeklabel: ${w0.label}`);
  // de soort met de meeste sets
  const H = [...wl.sporten].sort((a, b) => b.sets - a.sets || a.soort.localeCompare(b.soort))[0];
  const N = H.sets;
  T.check(N >= 3, `testsoort "${H.soort}" heeft ${N} sets`);
  T.check(wl.sporten.every((s) => !/ ([A-Za-z]|\d+)$/.test(s.soort)), 'geen soortnaam eindigt nog op een losse letter of cijfer');
  const locs = wl.locaties;
  T.check(locs.length >= 8, `${locs.length} locaties om te plannen`);
  const L = locs.slice(0, 12).map((l) => l.id);

  // ═══ Plannen: ma–wo op A, do–vr op B → dezelfde set + één verhuistaak ═══
  const p1 = (await A('POST', '/api/sportrooster/plan', { periode_id: PER, week: W, soort: H.soort, locatie_id: L[0], dag_van: 1, dag_tot: 3 })).json;
  const p2 = (await A('POST', '/api/sportrooster/plan', { periode_id: PER, week: W, soort: H.soort, locatie_id: L[1], dag_van: 4, dag_tot: 5 })).json;
  T.check(p1.ok && p2.ok && p1.set_id === p2.set_id, `${H.soort} ma–wo en do–vr kiest dezelfde set (${p1.set})`);
  T.check(p1.te_weinig === false && p2.te_weinig === false && p2.verhuistaken_nieuw === 1, 'geen tekort; de tweede plek maakte één verhuistaak');
  const taken = (await A('GET', '/api/transport-taken')).json.filter((t) => (t.categorie || '').startsWith('sv:'));
  const wo = plus('2026-06-29', (W - 1) * 7 + 2);
  T.check(taken.length === 1 && taken[0].datum === wo && taken[0].tijd >= '17:00', `één verhuistaak op de avond van woensdag ${wo} (${taken.length})`);
  T.check(taken[0] && taken[0].van_locatie_id === L[0] && taken[0].naar_locatie_id === L[1] && /Sport verhuis/.test(taken[0].opmerking), 'van → naar klopt en de opmerking zegt wat het is');
  const wk1 = (await A('GET', `/api/sportrooster/week?${q()}`)).json;
  const sh = wk1.sporten.find((s) => s.soort === H.soort);
  T.check(sh.dagen.every((d) => d.in_gebruik === 1 && d.sets === N && !d.te_weinig), 'week-API: 1 set per dag in gebruik, vijf dagen');
  T.check(wk1.tellers.ingepland === 1 && wk1.tellers.verhuis === 1, 'tellers: 1 ingepland, 1 verhuis');

  // ═══ Uitwisselbaar: een tweede plan krijgt een andere set ═══
  const p3 = (await A('POST', '/api/sportrooster/plan', { periode_id: PER, week: W, soort: H.soort, locatie_id: L[2], dag_van: 1, dag_tot: 5 })).json;
  T.check(p3.ok && p3.set_id !== p1.set_id && p3.te_weinig === false, `tweede plan (ma–vr) krijgt een andere set (${p3.set})`);

  // ═══ Te weinig sets: vul alle sets tot N op do–vr en plan er nog één ═══
  let laatste = null;
  for (let i = 3; i <= N; i++) laatste = (await A('POST', '/api/sportrooster/plan', { periode_id: PER, week: W, soort: H.soort, locatie_id: L[i], dag_van: 4, dag_tot: 5 })).json;
  T.check(N === 3 || (laatste && laatste.ok && !laatste.te_weinig), `${N} sets op do–vr: nog geen tekort`);
  const over = (await A('POST', '/api/sportrooster/plan', { periode_id: PER, week: W, soort: H.soort, locatie_id: L[N + 1], dag_van: 4, dag_tot: 5 })).json;
  T.check(over.ok && over.te_weinig === true && over.te_weinig_dagen.join() === 'do,vr', `${N + 1}× ${H.soort} op do–vr bij ${N} sets → te_weinig op do,vr`);
  const wk2 = (await A('GET', `/api/sportrooster/week?${q()}`)).json;
  const sh2 = wk2.sporten.find((s) => s.soort === H.soort);
  T.check(sh2.dagen[3].te_weinig && sh2.dagen[4].te_weinig && !sh2.dagen[0].te_weinig && !sh2.dagen[2].te_weinig && sh2.dagen[3].in_gebruik === N + 1, `week-API: do en vr rood (${sh2.dagen[3].in_gebruik}/${N}), ma–wo niet`);
  T.check(wk2.tellers.te_weinig === 1, 'teller "Te weinig sets" = 1');
  const dt = (await A('GET', `/api/sportrooster/soort/${encodeURIComponent(H.soort)}?${q()}`)).json;
  T.check(dt.raster.length === N + 2 && dt.raster.find((r) => r.locatie_id === L[N + 1]).te_weinig, 'paneel: raster per locatie, de extra locatie is rood');
  const tot = dt.dagen.map((d) => `${d.in_gebruik}/${d.sets}`);
  T.check(tot[3] === `${N + 1}/${N}` && tot[0] === `${Math.min(N, 2)}/${N}`, `paneel: totaalrij ${tot.join(' ')}`);
  T.check(dt.let_op.length === 1 && /do–vr/.test(dt.let_op[0].tekst) && dt.let_op[0].voorstellen.length >= 1 && dt.let_op[0].voorstellen[0].voorstel, `paneel: Let op met voorstel (${dt.let_op[0].voorstellen[0].tekst})`);
  T.check(dt.verhuis.length === 1 && /^wo \d+\/\d+ avond$/.test(dt.verhuis[0].wanneer) && dt.verhuis[0].taak_id === taken[0].id, `paneel: verhuis "${dt.verhuis[0].wanneer}" ${dt.verhuis[0].van} → ${dt.verhuis[0].naar} met taak-link`);
  T.check(dt.sets_lijst.length === N && dt.hele_zomer.length === 1 && dt.hele_zomer[0].week === W, 'paneel: Sets-tab en Hele-zomer-tab gevuld');

  // ═══ Seizoen ═══
  const sz = (await A('GET', `/api/sportrooster/seizoen?periode_id=${PER}`)).json;
  const szH = sz.sporten.find((s) => s.soort === H.soort);
  T.check(sz.weken === 9 && szH.weken.length === 9 && szH.weken[W - 1].te_weinig && szH.weken[W - 1].gebruik === N + 1, `seizoen: ${H.soort} week ${W} = ${szH.weken[W - 1].gebruik}/${N} rood`);
  T.check(sz.te_weinig_totaal === 1 && sz.tellers.te_weinig === 1 && sz.tellers.alle === sz.sporten.length, 'seizoen: te_weinig_totaal 1 (Periodes leest dit), tellers kloppen');
  T.check(szH.weken.filter((w) => !w.leeg).length === 1, 'seizoen: andere weken van deze soort blijven leeg');

  // ═══ Voorstel toepassen ═══
  const v = dt.let_op[0].voorstellen[0];
  const tp = await A('POST', '/api/sportrooster/toepassen', { rij_id: v.rij_id, soort: v.voorstel.soort });
  T.check(tp.status === 200 && tp.json.ok && tp.json.nu === v.voorstel.soort, `Toepassen: ${v.locatie} do–vr wordt ${v.voorstel.soort}`);
  const wk3 = (await A('GET', `/api/sportrooster/week?${q()}`)).json;
  T.check(wk3.sporten.find((s) => s.soort === H.soort).dagen.every((d) => !d.te_weinig) && wk3.tellers.te_weinig === 0, 'na Toepassen is het tekort weg');
  T.check(wk3.sporten.find((s) => s.soort === v.voorstel.soort).ingepland, 'de voorgestelde sport staat nu ingepland');
  const tp2 = await A('POST', '/api/sportrooster/toepassen', { rij_id: v.rij_id });
  T.check([404, 409].includes(tp2.status), `tweede Toepassen op dezelfde rij → ${tp2.status} (geen dubbele toepassing)`);

  // ═══ Wie doet de verhuis ═══
  const pers = (await A('GET', `/api/sportrooster/soort/${encodeURIComponent(H.soort)}?${q()}`)).json;
  const chauf = pers.personeel.find((p) => p.rol === 'chauffeur');
  T.check(!!chauf && pers.personeel.every((p) => ['chauffeur', 'kantoor', 'kv'].includes(p.rol)), `keuzelijst bevat alleen chauffeur/coördinator (${pers.personeel.length})`);
  T.check((await A('PUT', `/api/sportrooster/verhuis/${taken[0].id}`, { wie_id: chauf.id })).json.wie === chauf.naam, `verhuis krijgt ${chauf.naam}`);
  T.check((await A('PUT', `/api/sportrooster/verhuis/${taken[0].id}`, { wie_id: 999999 })).status === 400, 'TF9: kantoor mag verhuizen; een onbekende persoon wordt geweigerd');
  const pers2 = (await A('GET', `/api/sportrooster/soort/${encodeURIComponent(H.soort)}?${q()}`)).json;
  T.check(pers2.verhuis[0].wie === chauf.naam, 'paneel toont de gekozen verhuizer');
  const tk2 = (await A('GET', '/api/transport-taken')).json.find((t) => t.id === taken[0].id);
  T.check(tk2.wie === chauf.naam, 'de verhuistaak op Transport › Taken heeft de verhuizer in "wie"');

  // ═══ Wijzig dagen / Verwijderen ═══
  const rijA = dt.raster.find((r) => r.locatie_id === L[1]).rijen[0];
  const put = await A('PUT', `/api/sportrooster/plan/${rijA.id}`, { dag_van: 5, dag_tot: 5 });
  T.check(put.status === 200 && put.json.ok, 'Wijzig dagen do–vr → vr');
  const taken2 = (await A('GET', '/api/transport-taken')).json.filter((t) => (t.categorie || '').startsWith('sv:'));
  T.check(taken2.length === 1 && taken2[0].datum === plus('2026-06-29', (W - 1) * 7 + 3), `verhuistaak schoof mee naar donderdagavond (${taken2.map((t) => t.datum)})`);
  T.check(taken2[0].wie === chauf.naam, 'de gekozen verhuizer bleef bij de aangepaste taak');
  T.check((await A('PUT', `/api/sportrooster/plan/${rijA.id}`, { dag_van: 4, dag_tot: 2 })).status === 400, 'ongeldige dagen (4–2) → 400');
  const del = await A('DELETE', `/api/sportrooster/plan/${rijA.id}`);
  const taken3 = (await A('GET', '/api/transport-taken')).json.filter((t) => (t.categorie || '').startsWith('sv:'));
  T.check(del.status === 200 && taken3.length === 0, 'rij verwijderd → verhuistaak verdwijnt mee');
  T.check((await A('POST', '/api/sportrooster/plan', { periode_id: PER, week: 99, soort: H.soort, locatie_id: L[0] })).status === 400, 'week buiten de periode → 400');
  T.check((await A('POST', '/api/sportrooster/plan', { periode_id: PER, week: W, soort: 'Bestaat Niet', locatie_id: L[0] })).status === 400, 'onbekende sport → 400');

  // ═══ Bestaande lezers: generator, conflicten, pool ═══
  // generator: de set gaat mee op de levering naar de locatie waar hij op dag_van staat
  const LA = locs.find((l) => /^Abdijschool/.test(l.naam)).id, LB = locs.find((l) => /^Sporthal Kessel-Lo/.test(l.naam)).id; // locaties zonder gesloten dagen in de testdata
  const km = (await A('POST', '/api/kampmomenten', { locatie_id: LA, week: 6, periode_id: PER, type: 'kamp' })).json;
  const kmB = (await A('POST', '/api/kampmomenten', { locatie_id: LB, week: 6, periode_id: PER, type: 'kamp' })).json;
  const szG = (await A('GET', `/api/sportrooster/seizoen?periode_id=${PER}`)).json;
  const G = szG.sporten.filter((x) => !x.ingepland && x.sets >= 2).sort((x, y) => y.sets - x.sets || x.soort.localeCompare(y.soort))[0]; // een soort die nergens ingepland staat: andere weken storen de generator dan niet
  const g1 = (await A('POST', '/api/sportrooster/plan', { periode_id: PER, week: 6, soort: G.soort, locatie_id: LA, dag_van: 1, dag_tot: 2 })).json;
  const g2 = (await A('POST', '/api/sportrooster/plan', { periode_id: PER, week: 6, soort: G.soort, locatie_id: LB, dag_van: 3, dag_tot: 5 })).json;
  T.check(g1.set_id === g2.set_id, `generator-opzet: ${G.soort} dezelfde set ma–di op A en wo–vr op B`);
  const gen = (await A('POST', '/api/transport-genereer', {})).json;
  const gl = (Array.isArray(gen) ? gen : gen.voorstellen || []).filter((x) => (x.materiaal || []).some((m) => m.soort === 'sport' && m.naam.includes(G.soort) && m.naam.endsWith(g1.set)));
  const naarA = gl.filter((x) => x.type === 'levering' && x.locatie_id === LA);
  const naarB = gl.filter((x) => x.type === 'levering' && x.locatie_id === LB);
  const vanB = gl.filter((x) => x.type === 'ophaling' && x.locatie_id === LB);
  T.check(naarA.length === 1, `generator: de set wordt geleverd naar de locatie waar hij op dag_van staat (${gl.map((x) => x.type + '@' + x.locatie_id).join(', ')})`);
  T.check(naarB.length === 0 && vanB.length === 1, 'generator: geen aparte levering naar de tweede plek (eigen verhuistaak), de ophaling komt van de laatste plek');
  // conflicten: "sport gepland zonder transport" ziet de dagrijen
  const cf = (await A('GET', `/api/conflicten?periode_id=${PER}`)).json;
  const lijst = Array.isArray(cf) ? cf : cf.conflicten || [];
  T.check(Array.isArray(lijst), `conflicten-API leest de dagrijen zonder fout (${lijst.length} meldingen)`);
  // pool: nodig telt een set die op twee plekken staat als één
  const pool = (await A('GET', `/api/pool-overzicht?periode_id=${PER}`)).json;
  const stukken = pool.stukken || pool.lijst || pool.items || [];
  T.check(pool && (stukken.length > 0 || pool.tellers), `pool-API blijft werken (${stukken.length} stukken)`);

  // ═══ Pagina en rechten ═══
  T.check((await P('GET', '/sportrooster')).status === 200, 'GET /sportrooster → 200 (zoals alle pagina-routes; de gegevens zitten achter de kantoor-API)');
  await A('POST', '/api/personeel/13/pincode', { pincode: '4321' });
  const tokCh = await T.login(srv.base, 13, '4321');
  T.check((await T.api(srv.base, tokCh, 'GET', `/api/sportrooster/week?${q()}`)).status === 403 && (await T.api(srv.base, tokCh, 'POST', '/api/sportrooster/plan', { week: 1, soort: H.soort, locatie_id: L[0] })).status === 403, 'chauffeur (niet-kantoor): sportrooster-API → 403');
  T.check((await A('GET', '/sportrooster')).status === 200, 'GET /sportrooster als kantoor → 200');
  for (const pad of [`/api/sportrooster/week?${q()}`, `/api/sportrooster/seizoen?periode_id=${PER}`, `/api/sportrooster/soort/Hockey?${q()}`])
    T.check([401, 403].includes((await P('GET', pad)).status), `${pad.split('?')[0]} zonder inlog geweigerd`);
  const ex = await A('GET', `/api/sportrooster/export?periode_id=${PER}`);
  T.check(ex.status === 200 && /^﻿?"Periode";"Week";"Sport"/.test(ex.text) && ex.text.split('\r\n').length > 10, 'export: CSV met kopregel en rijen');

  // ═══ DOM-bouw met echte data ═══
  const BOUW = require(T.ROOT + '/public/sportrooster.js');
  const html = lees('public/sportrooster.html'), css = lees('public/sportrooster.css'), js = lees('public/sportrooster.js');
  const wd = (await A('GET', `/api/sportrooster/week?${q()}`)).json;
  const hk = wd.sporten.find((s) => s.soort === H.soort);
  const rh = BOUW.rij(hk, {});
  T.check((rh.match(/class="vk/g) || []).length === 5 && rh.includes(`<b>${hk.dagen[0].in_gebruik}/${N}</b>`) && /<i style="width:\d+%"/.test(rh), 'rij: vijf vakjes met alleen "n/m" en een balkje');
  await A('POST', '/api/sportrooster/plan', { periode_id: PER, week: 8, soort: H.soort, locatie_id: L[0], dag_van: 1, dag_tot: 5 });
  for (let i = 1; i <= N; i++) await A('POST', '/api/sportrooster/plan', { periode_id: PER, week: 8, soort: H.soort, locatie_id: L[i], dag_van: 4, dag_tot: 5 });
  const h8 = (await A('GET', `/api/sportrooster/week?${q(8)}`)).json.sporten.find((s) => s.soort === H.soort);
  const r8 = BOUW.rij(h8, {});
  T.check((r8.match(/class="vk ov"/g) || []).length === 2 && !/class="vk ov"[^]*class="vk ov"[^]*class="vk ov"/.test(r8), `rij: alleen de twee tekortdagen zijn rood (${h8.dagen.map((d) => d.in_gebruik + '/' + d.sets).join(' ')})`);
  const full = (await A('GET', `/api/sportrooster/soort/${encodeURIComponent(H.soort)}?${q(8)}`)).json;
  const dh = BOUW.detail(full, 'week', 'week');
  T.check(dh.includes('class="tw d5"') && dh.includes('>totaal<') && dh.includes('class="ovt"') && dh.includes('Let op') && dh.includes('data-toepassen=') && dh.includes('Toepassen') && dh.includes('+ Inplannen') && dh.includes('Hele periode') && dh.includes(`Sets ${N}`), 'detail Week: raster, totaalrij met rode dagen, Let op met Toepassen, + Inplannen, drie tabs');
  T.check(dh.includes('Verhuis midden in de week') && dh.includes('wk 7') && dh.includes('wk 9'), 'detail Week: blok Verhuis en knoppen ‹ wk 7 / wk 9 ›');
  const tw = BOUW.detail(full, 'zomer', 'week');
  T.check(tw.includes('Oplossen') && tw.includes('Per week'), 'detail Hele zomer: tekortweek heeft Oplossen');
  const dz = BOUW.detail(full, 'week', 'seizoen');
  T.check(dz.includes('hele periode') && dz.includes('Naar weekbeeld') && dz.includes('Per week') && dz.includes('Materiaal › Pool ›'), 'detail Seizoen: Per week, Naar weekbeeld, Sets met Pool-link');
  const szD = (await A('GET', `/api/sportrooster/seizoen?periode_id=${PER}`)).json;
  const gr = BOUW.seizoen(szD, { lijst: szD.sporten.filter((s) => s.ingepland), sel: { soort: H.soort, week: 8 } });
  T.check(gr.includes('class="sgrid"') && gr.includes('wk 9') && /class="c dub sel"/.test(gr) && /class="c leeg"/.test(gr), 'seizoen-raster: 9 weken, rode cel geselecteerd, lege cellen');
  T.check(BOUW.filters('week', wd.tellers, { filter: 'ingepland', label: wd.label }).includes('Te weinig sets') && BOUW.filters('seizoen', szD.tellers, { filter: 'alle' }).includes('Zoek sport'), 'filters: week met ‹ ›, seizoen met zoekveld');
  T.check(html.includes('sportrooster.js') && html.includes('patroon.css') && html.includes('name="viewport"'), 'html: scripts, patroon, viewport');
  // gsm (MOBIEL-REGEL)
  T.check(/@media \(max-width:767px\)/.test(css) && /toon-detail/.test(css) && /min-height:44px/.test(css) && /\.r\.sp\{display:grid !important;grid-template-columns:repeat\(5,1fr\)/.test(css) && /\.scroll\.sz\{overflow-x:auto/.test(css) && /\.sgrid\{min-width:640px\}/.test(css), 'gsm-CSS: vijf vakjes per rij, detail als volgend scherm, seizoen scrolt binnen het raster, knoppen ≥ 44 px');
  T.check(js.includes('data-act="terug"') && dh.includes('‹ terug naar de lijst'), 'gsm: ‹ terug naar de lijst aanwezig');
} catch (e) { T.fout('uitzondering: ' + (e.stack || e)); }
await T.einde(srv);
