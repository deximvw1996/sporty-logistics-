// test-tf10.mjs — TF10 (chat D): sportrooster + Inplannen (ook met testklok), Kampmomenten (geen "beschikbaar in", Historiek eigen kader,
// uitleg per aandachtspunt, enkelvoud), de pagina scrolt nooit (testklok-balk in de hoogte). Eigen server via _testhulp (poort 3363 of TEST_POORT).
// Draait met SPORTY_TESTKLOK=1, zoals Maxim op prod. T.check(voorwaarde, tekst).
import * as T from './_testhulp.mjs';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const lees = (p) => fs.readFileSync(T.ROOT + '/' + p, 'utf8');
const ijk = T.leesIjk();
process.env.SPORTY_TESTKLOK = '1';
const srv = await T.startServer({ poort: Number(process.env.TEST_POORT) || 3363 });
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const q = (s, p = []) => T.leesDb(srv.dbPad, s, p);

  // ═══ 1 · + Inplannen, ook met testklok ═══
  T.info('1 · Sportrooster + Inplannen');
  const kl = await A('POST', '/api/testklok', { datum: '2026-11-04', uur: '10:00' });
  T.check(kl.status === 200 && kl.json.verzet === true, 'testklok staat aan en verzet (' + (kl.json && kl.json.nu) + ')');
  const html = await T.api(srv.base, null, 'GET', '/sportrooster');
  T.check(/__TESTKLOK_VERSCHIL/.test(html.text || ''), 'de pagina krijgt de testklok mee');
  const w = (await A('GET', '/api/sportrooster/week?week=1')).json;
  T.check(w.week === 1 && w.sporten.length > 0, 'een lege week laadt met sporten (' + w.sporten.length + ') en ' + (w.locaties || []).length + ' locaties');
  const voor = (await q('SELECT COUNT(*) n FROM sport_planning'))[0].n;
  const soort = w.sporten.find((s) => s.sets > 0) || w.sporten[0];
  const loc = (w.locaties || [])[0];
  let r = await A('POST', '/api/sportrooster/plan', { soort: soort.soort, locatie_id: loc.id, dag_van: 1, dag_tot: 5, week: 1 });
  T.check(r.status === 200 && (await q('SELECT COUNT(*) n FROM sport_planning'))[0].n === voor + 1, 'Inplannen slaat op in een lege week met testklok aan: ' + JSON.stringify(r.json).slice(0, 120));
  const w2 = (await A('GET', '/api/sportrooster/week?week=1')).json;
  T.check(JSON.stringify(w2).includes(soort.soort), 'de week toont de ingeplande sport');
  const src = lees('public/sportrooster.js');
  T.check(src.indexOf("t.id==='leeg-inplannen'") > 0 && src.indexOf("t.id==='leeg-inplannen'") < src.indexOf('if(!D)return;'), 'de knop "+ Inplannen" in een lege week staat vóór de guard `if(!D)return` (oorzaak: zonder gekozen sport deed de klik niets)');
  const knoppen = [...src.matchAll(/id="([a-z-]*inplannen)"/g)].map((m) => m[1]);
  T.check(knoppen.length >= 1 && knoppen.every((k) => src.includes(`t.id==='${k}'`)), 'elke + Inplannen-knop (' + knoppen.join(', ') + ') heeft een klik-afhandeling');

  // ═══ 2/3/4 · Kampmomenten ═══
  T.info('2-4 · Kampmomenten');
  const km = ijk.kampmomenten.abdijschool;
  const D = (await A('GET', `/api/kampmomenten/${km}/detail`)).json;
  const KM = require(T.ROOT + '/public/kampmomenten.js');
  const g = KM.gegevensHtml(D);
  T.check(!/beschikbaar in/.test(g), 'tab Gegevens: de zin "beschikbaar in wk …" is weg');
  T.check(/<div class="blok" id="hist-kader"><h4>Historiek/.test(g) && /<\/div><div class="blok" id="hist-kader">/.test(g), 'Historiek is een eigen kader (eigen .blok, los van Conflicten & aandacht)');
  T.check(g.indexOf('Conflicten') < g.indexOf('hist-kader') && /gap:16px/.test(g), 'tussen de twee kaders zit ruimte (16 px)');
  const lijst = KM.lijstHtml({ kampmomenten: [] }, { sel: new Set() });
  const rij = (n) => ({ id: 1, locatie: { naam: 'X' }, dagen_tekst: 'ma–vr', thema_tekst: 't', kv: null, transport_tekst: '—', status: 'let', aandacht: n, week: 1, themas: [], dagen: [] });
  const O = { kampmomenten: [rij(['geen thema', 'geen KV']), rij(['geen KV'])] };
  let lh = '';
  try { lh = KM.lijstHtml(O, { sel: new Set(), filter: 'alle' }); } catch (e) { lh = ''; }
  const dh = KM.detailHtml({ ...D, aandacht: ['geen thema', 'geen KV'], status: 'let', historiek: D.historiek || [] }, { tab: 'gegevens' });
  T.check(/data-tip="Geen thema gekoppeld[^"]*&#10;|data-tip="Geen thema gekoppeld/.test(dh) && /Geen KV gekoppeld: de KV telt de bakken/.test(dh), 'kop: de tooltip noemt elk punt apart met exacte uitleg');
  T.check(/title="• Geen thema gekoppeld/.test(dh), 'kop: hover (title) toont de punten met een opsommingsteken per punt');
  const een = KM.detailHtml({ ...D, aandacht: ['x'.repeat(60)], status: 'let' }, { tab: 'gegevens' });
  T.check(/1 aandachtspunt</.test(een) && !/1 aandachtspunten/.test(een), '"1 aandachtspunt" in het enkelvoud');
  const veel = KM.detailHtml({ ...D, aandacht: ['a', 'b'], status: 'let' }, { tab: 'gegevens' });
  T.check(/2 aandachtspunten</.test(veel), '"2 aandachtspunten" in het meervoud');
  if (lh) T.check(/data-tip="[^"]*Geen thema gekoppeld/.test(lh) && /let op · 2/.test(lh), 'lijst: ⚠ let op heeft per punt uitleg en toont het aantal bij meer dan één');
  const kj = lees('public/kampmomenten.js');
  T.check(kj.includes("id = 'tip-pop'") && kj.includes('data-tip'), 'tik (gsm) opent de uitleg als popover');

  // ═══ 5 · De pagina scrolt nooit ═══
  T.info('5 · hoogte met de testklok-balk');
  const alleCss = fs.readdirSync(T.ROOT + '/public').filter((f) => f.endsWith('.css') && !/^(kv|rit|login|ritplanning)\.css$/.test(f));
  const fout = [];
  for (const f of alleCss) { const c = lees('public/' + f); const m = c.match(/(^|[;{\s,])height:100vh/g); if (m) fout.push(f); if (/height:calc\(100vh - \d+px\)/.test(c)) fout.push(f + ' (calc)'); }
  T.check(!fout.length, 'geen css met een kale 100vh-hoogte die de klokbalk negeert' + (fout.length ? ': ' + fout.join(', ') : ''));
  T.check(lees('public/testklok.js').includes('--tk-h:40px'), 'de testklok definieert --tk-h (alleen dan rekent de css de balk af)');
  T.check(lees('public/app-schil.css').includes('.tel[hidden]') && lees('public/meldingen.css').includes('--tk-h'), 'verborgen gsm-blok neemt op desktop geen ruimte in; Meldingen scrolt in zijn kader');
  T.check(lees('public/kampmomenten.css').includes('var(--tk-h,0px)'), 'Kampmomenten: de voettekst blijft in beeld (het kader rekent de klokbalk mee)');
} finally {
  await T.einde(srv);
}
