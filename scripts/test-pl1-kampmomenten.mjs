// test-pl1-kampmomenten.mjs — PL1 (chat D): Planning › Kampmomenten (overzicht, detail, velden, KV-links, genereren, verwijderen).
// Eigen server via _testhulp (poort 3346, herfst-test.db). De HTML-bouwers van public/kampmomenten.js worden als module met de echte API-data aangeroepen.
import * as T from './_testhulp.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const POORT = parseInt(process.env.TEST_POORT || '3346');
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: POORT });
const BASIC = 'Basic ' + Buffer.from('sporty:' + T.APP_PASSWORD).toString('base64');
const tekst = (h) => h.replace(/<[^>]+>/g, '\n').replace(/&amp;/g, '&').replace(/\n\s*\n+/g, '\n').trim().split('\n').join(' | ');
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const P = (m, p, b) => T.api(srv.base, null, m, p, b);
  const periode = ijk.periode?.id || (await A('GET', '/api/periodes/actief')).json.id;
  const locs = (await A('GET', '/api/locaties')).json.filter((l) => l.type === 'kamp');
  const themas = (await A('GET', '/api/themas')).json;
  const vrij = themas.filter((x) => ![ijk.themas.alles_op_wieltjes, ijk.themas.holderdebolder].includes(x.id));
  const thA = vrij[0].id, thB = vrij[1].id; // thema's die de testdata nog nergens plant
  const WEEK = 1; // de enige week van de herfst-testperiode
  const basis = (await A('GET', `/api/kampmomenten-overzicht?periode_id=${periode}`)).json.tellers;
  const mk = async (loc, week = WEEK) => (await A('POST', '/api/kampmomenten', { locatie_id: loc.id, week, periode_id: periode, type: 'kamp' })).json;
  const l = [locs[2], locs[3], locs[4], locs[5]];
  const k1 = await mk(l[0]), k2 = await mk(l[1]), k3 = await mk(l[2]);
  const pers = (await A('GET', '/api/personeel')).json;
  const kvP = pers.find((p) => p.rol === 'kv') || (await A('POST', '/api/personeel', { naam: 'Test KV PL1', rol: 'kv' })).json;
  await A('PUT', `/api/kampmomenten/${k2.id}`, { kv_persoon_id: kvP.id });

  // ── overzicht ──
  let r = await A('GET', `/api/kampmomenten-overzicht?periode_id=${periode}`);
  let L = r.json; const rij = (id) => L.kampmomenten.find((k) => k.id === id);
  T.check(r.status === 200 && r.json.periode.id === periode && r.json.tellers.totaal === r.json.kampmomenten.length && r.json.tellers.per_week[WEEK] === (basis.per_week[WEEK] || 0) + 3, `overzicht: ${r.json.tellers.totaal} kampmomenten, week ${WEEK} = ${r.json.tellers.per_week[WEEK]} (tellers per week kloppen)`);
  T.check(rij(k1.id).status === 'let' && rij(k1.id).aandacht.includes('geen thema') && rij(k1.id).thema_tekst === '— geen thema' && rij(k1.id).kv === null && rij(k1.id).aandacht.includes('geen KV'), 'zonder thema en zonder KV → status let, aandacht "geen thema" + "geen KV"');
  T.check(rij(k2.id).kv && rij(k2.id).kv.naam === kvP.naam && rij(k2.id).kv.link_gestuurd === false, 'kv {id,naam,telefoon,link_gestuurd:false}');
  T.check(rij(k1.id).dagen.length === 7 && rij(k1.id).dagen.slice(0, 5).every(Boolean) && !rij(k1.id).dagen[5] && /^wk 1 · ma 2 – vr 6 nov$/.test(rij(k1.id).dagen_tekst), `dagen[7] (ma–vr aan, weekend uit) en dagen_tekst "${rij(k1.id).dagen_tekst}"`);
  const tellers0 = r.json.tellers;
  r = await A('GET', `/api/kampmomenten-overzicht?periode_id=${periode}&week=${WEEK}`);
  T.check(r.json.kampmomenten.length === (basis.per_week[WEEK] || 0) + 3 && r.json.kampmomenten.every((k) => k.week === WEEK), '?week= filtert de lijst (tellers blijven die van de hele periode)');

  // ── thema dubbel + beschikbaarheid ──
  await A('POST', `/api/kampmomenten/${k1.id}/themas`, { thema_id: thA });
  await A('POST', `/api/kampmomenten/${k2.id}/themas`, { thema_id: thA });
  r = await A('GET', `/api/kampmomenten-overzicht?periode_id=${periode}`); L = r.json;
  T.check(rij(k1.id).aandacht.some((a) => /^thema dubbel/.test(a)) && rij(k2.id).aandacht.some((a) => /^thema dubbel/.test(a)) && rij(k1.id).thema_tekst === rij(k2.id).thema_tekst, `thema dubbel → aandacht op beide ("${rij(k1.id).aandacht.find((a) => /^thema dubbel/.test(a))}")`);
  T.check(r.json.tellers.conflict >= tellers0.conflict + 2 && r.json.tellers.zonder_thema === tellers0.zonder_thema - 2, `tellers: conflict ${tellers0.conflict}→${r.json.tellers.conflict}, zonder thema ${tellers0.zonder_thema}→${r.json.tellers.zonder_thema}`);
  const d3 = (await A('GET', `/api/kampmomenten/${k3.id}/detail`)).json;
  T.check(!d3.themas_beschikbaar.some((t) => t.id === thA) && d3.themas_beschikbaar.some((t) => t.id === thB) && d3.themas_bezet.some((t) => t.id === thA), 'themas_beschikbaar sluit het dubbele thema uit (en themas_bezet zegt waar het zit)');
  const d1 = (await A('GET', `/api/kampmomenten/${k1.id}/detail`)).json;
  T.check(d1.themas_beschikbaar.length === 0 || d1.themas_beschikbaar.some((t) => t.id === thA && t.gekozen === false) === false, 'het thema dat al elders zit staat voor k1 niet als beschikbaar (alleen eigen keuzes tellen niet als elders)');

  // ── velden ──
  r = await A('PUT', `/api/kampmomenten/${k1.id}/velden`, { dagen: [true, true, true, false, false, false, false], kookdagen: ['wo', 'do'], aantal_kinderen: 24, aantal_kleuters: 10, aantal_monitoren: 2, opmerking: 'poort aan de zijkant' });
  T.check(r.status === 200, 'PUT velden → 200');
  const dv = (await A('GET', `/api/kampmomenten/${k1.id}/detail`)).json;
  T.check(dv.dagen.join() === 'true,true,true,false,false,false,false' && /ma 2 – wo 4/.test(dv.dagen_tekst), `dagen ma–wo (${dv.dagen_tekst})`);
  T.check(dv.kookdagen.join() === 'wo,do' && dv.groep.kinderen === 24 && dv.groep.kleuters === 10 && dv.groep.lager === 14 && dv.groep.monitoren === 2 && dv.opmerking === 'poort aan de zijkant', 'kookdagen, groep (24 / kleuters 10 / lager 14 / monitoren 2) en opmerking bewaard');
  T.check(dv.oven_mee === true || dv.heeft_eigen_oven === true, `oven_mee ${dv.oven_mee} (eigen oven ${dv.heeft_eigen_oven})`);
  T.check(dv.historiek.some((h) => /kookdagen wo\/do gezet/.test(h.tekst)) && dv.historiek.some((h) => /open dagen aangepast/.test(h.tekst)), `gelogd in de historiek (${dv.historiek.slice(0, 3).map((h) => h.tekst).join(' / ')})`);
  r = await A('PUT', `/api/kampmomenten/${k1.id}/velden`, { kookdagen: ['za'] });
  T.check(r.status === 400, 'ongeldige kookdag → 400');
  r = await A('PUT', `/api/kampmomenten/${k1.id}/velden`, { aantal_kinderen: 5, aantal_kleuters: 9 });
  T.check(r.status === 400, 'meer kleuters dan kinderen → 400');
  r = await A('PUT', `/api/kampmomenten/${k1.id}/velden`, { dagen: [true] });
  T.check(r.status === 400, 'dagen moet 7 waarden hebben → 400');
  r = await A('PUT', `/api/kampmomenten/${k1.id}/velden`, { dagen: [true, true, true, true, true, true, false] });
  T.check((await A('GET', `/api/kampmomenten/${k1.id}/detail`)).json.dagen[5] === true, 'zaterdag aanzetten werkt (weekend-kamp)');

  // ── KV-links ──
  r = await A('POST', '/api/kampmomenten/kv-links', { ids: [k1.id, k2.id] });
  T.check(r.status === 200 && r.json.links.length === 1 && r.json.links[0].id === k2.id && /\/kv\/[a-z0-9]+$/.test(r.json.links[0].url) && r.json.links[0].volledig.startsWith('http') && r.json.fouten.length === 1 && r.json.fouten[0].id === k1.id && /geen KV/.test(r.json.fouten[0].reden), `kv-links: 1 link voor k2, k1 geeft "${r.json.fouten[0]?.reden}"`);
  const kvd = (await P('GET', `/api${r.json.links[0].url}/data`)).json;
  T.check(!!kvd.bakken, 'de link werkt (kv-data te lezen)');
  T.check(rij(k2.id) && (await A('GET', `/api/kampmomenten-overzicht?periode_id=${periode}`)).json.kampmomenten.find((k) => k.id === k2.id).kv.link_gestuurd === true, 'link_gestuurd is nu true');
  r = await A('POST', '/api/kampmomenten/kv-links', { ids: [] });
  T.check(r.status === 400, 'kv-links zonder selectie → 400');

  // ── genereer transport ──
  const km = ijk.kampmomenten.abdijschool;
  const voor = (await A('GET', `/api/kampmomenten-overzicht?periode_id=${periode}`)).json.kampmomenten.find((k) => k.id === km);
  r = await A('POST', '/api/kampmomenten/genereer-transport', { ids: [km] });
  T.check(r.status === 200 && r.json.aangemaakt >= 1 && r.json.gemaakt.every((g) => g.kampmoment_id === km), `genereer voor de selectie → ${r.json.aangemaakt} taken, enkel voor dat kampmoment`);
  const taken = (await A('GET', '/api/transport-taken')).json.filter((t) => t.kampmoment_id === km && t.status !== 'geannuleerd');
  T.check(taken.some((t) => t.type === 'levering') && taken.every((t) => t.datum), `leveringen bestaan (${taken.length} taken met datum)`);
  const na = (await A('GET', `/api/kampmomenten-overzicht?periode_id=${periode}`)).json.kampmomenten.find((k) => k.id === km);
  T.check(na.transport_tekst !== voor.transport_tekst && /levering/.test(na.transport_tekst), `transport_tekst: "${voor.transport_tekst}" → "${na.transport_tekst}"`);
  r = await A('POST', '/api/kampmomenten/genereer-transport', { ids: [km] });
  T.check(r.status === 200 && r.json.aangemaakt === 0 && r.json.overgeslagen >= 1, 'nogmaals genereren maakt niets dubbel (overgeslagen)');
  const dk = (await A('GET', `/api/kampmomenten/${km}/detail`)).json;
  T.check(dk.transport.length >= 1 && dk.transport[0].wanneer_tekst && Array.isArray(dk.conflicten) && Array.isArray(dk.aanvragen_open) && dk.historiek.length >= 0 && dk.materiaal.every((m) => Array.isArray(m.items)), `detail: transport (${dk.transport.length}), conflicten (${dk.conflicten.length}), aanvragen_open, materiaal, historiek (${dk.historiek.length})`);

  // ── verwijderen met geladen transport ──
  const kv4 = await mk(l[3]);
  const bakId = (await A('POST', `/api/themas/${thB}/bakken`, { label: 'Pl1 bak', code: 'PL1' })).json.id;
  const taak = (await A('POST', '/api/transport-taken', { type: 'levering', datum: '2026-12-21', tijd: '09:00', van_locatie_id: ijk.locaties.rozenweg, naar_locatie_id: l[3].id, kampmoment_id: kv4.id, regels: [{ naam: 'Bak Pl1 bak (PL1)', qty: 1, soort: 'thema', bak_id: bakId }] })).json.id;
  const rit = (await A('POST', '/api/ritten', { datum: '2026-12-21', chauffeur: 'Jan', taak_ids: [taak] })).json.id;
  await A('POST', `/api/ritten/${rit}/checks/init`);
  const rtok = await T.ritToken(srv.base, tok, rit);
  const cid = (await P('GET', `/api/rit-token/${rtok}/data`)).json.stops[0].regels[0].check_id;
  await P('POST', `/api/rit-token/${rtok}/checks/${cid}/laden`);
  r = await A('POST', '/api/kampmomenten/verwijderen', { ids: [k3.id, kv4.id] });
  T.check(r.status === 409 && /al geladen/.test(r.json.error) && /Niets|niets/.test(r.json.error), `verwijderen met geladen transport → 409 ("${r.json.error}")`);
  const nog = (await A('GET', `/api/kampmomenten-overzicht?periode_id=${periode}`)).json.kampmomenten;
  T.check(nog.some((k) => k.id === k3.id) && nog.some((k) => k.id === kv4.id), '… en er is niets verwijderd (ook k3 niet)');
  await P('POST', `/api/rit-token/${rtok}/checks/${cid}/laden`);
  r = await A('POST', '/api/kampmomenten/verwijderen', { ids: [k3.id, kv4.id] });
  T.check(r.status === 200 && r.json.verwijderd === 2 && !(await A('GET', `/api/kampmomenten-overzicht?periode_id=${periode}`)).json.kampmomenten.some((k) => k.id === k3.id), 'na terugdraaien van het laden: verwijderen werkt (taken mee)');
  r = await A('POST', '/api/kampmomenten/verwijderen', { ids: [] });
  T.check(r.status === 400, 'verwijderen zonder selectie → 400');
  r = await A('GET', '/api/kampmomenten/999999/detail');
  T.check(r.status === 404, 'detail van een onbekend kampmoment → 404');

  // ── pagina + DOM-bouw ──
  const pg = await (await fetch(`${srv.base}/kampmomenten`, { headers: { Authorization: BASIC } })).text();
  T.check(/Kampmomenten/.test(pg) && /class="sub"/.test(pg) && /nav\.js/.test(pg) && /Genereer transport/.test(pg) && /\+ Kampmoment/.test(pg) && /id="voet"/.test(pg) && /id="chips"/.test(pg) && /patroon\.css/.test(pg), '/kampmomenten → 200 met subbalk (Kampmomenten · Rooster · Periodes · Thema\'s per week · Export · Genereer transport · + Kampmoment), chips en voet, patroon.css');
  const KP = require(T.ROOT + '/public/kampmomenten.js');
  const O = (await A('GET', `/api/kampmomenten-overzicht?periode_id=${periode}`)).json;
  const st = { filter: 'periode', zoek: '', sel: new Set([k1.id, k2.id]), open: k1.id, tab: 'gegevens' };
  const ch = KP.chipsHtml(O, st), lh = KP.lijstHtml(O, st);
  T.check(['Zonder thema', 'Zonder KV', 'Conflict', 'Week ' + WEEK].every((c) => ch.includes(c)) && ch.includes(O.periode.naam) && lh.includes('wk 1') && lh.includes('thema dubbel') && lh.includes('⚠ let op') && lh.includes('checked'), 'DOM-bouw: chips (periode, weken, zonder thema/KV, conflict) en lijst met ⚠ let op, dubbel-melding en selectie');
  console.log('--- DOM-dump lijst ---\n' + tekst(lh).slice(0, 600) + '\n');
  const dh = KP.detailHtml(dv && (await A('GET', `/api/kampmomenten/${k1.id}/detail`)).json, st);
  T.check(['Bewerken', 'Locatie', 'KV-link', 'Thema kiezen', 'Gegevens', 'Thema &amp; materiaal', 'Telling', 'Historiek', 'Kookdagen', 'Conflicten &amp; aandacht', 'Transport voor dit kampmoment'].every((c) => dh.includes(c)) && (dh.match(/data-dag="/g) || []).length === 7 && dh.includes('data-kook="wo"'), 'DOM-bouw detail: kop, knoppen, tabs, 7 dagen-knoppen, kookdagen, aandacht, transport');
  console.log('--- DOM-dump detail ---\n' + tekst(dh).slice(0, 800) + '\n');

  // ── rollen ──
  const nieuw = await A('POST', '/api/personeel', { naam: 'Test Chauffeur PL1', rol: 'chauffeur' });
  await A('POST', `/api/personeel/${nieuw.json.id}/pincode`, { pincode: '7777' });
  const lg = await T.api(srv.base, null, 'POST', '/api/login', { persoon_id: nieuw.json.id, pincode: '7777' });
  if (lg.json?.token) {
    const C = (m, p, b) => T.api(srv.base, lg.json.token, m, p, b);
    T.check((await C('GET', '/api/kampmomenten-overzicht')).status === 403 && (await C('GET', `/api/kampmomenten/${k1.id}/detail`)).status === 403 && (await C('PUT', `/api/kampmomenten/${k1.id}/velden`, { opmerking: 'x' })).status === 403 && (await C('POST', '/api/kampmomenten/kv-links', { ids: [k1.id] })).status === 403 && (await C('POST', '/api/kampmomenten/verwijderen', { ids: [k1.id] })).status === 403, 'chauffeur → 403 op overzicht, detail, velden, kv-links en verwijderen');
  } else T.fout('geen chauffeur-login om rollen te testen');
  T.check([401, 403].includes((await P('GET', '/api/kampmomenten-overzicht')).status), 'zonder login geen overzicht');
} catch (e) {
  T.fout('test crashte: ' + (e.stack || e)); console.log('SERVERLOG:', srv.log().slice(-1500));
}
await T.einde(srv);
