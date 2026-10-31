// test-tk1-testklok.mjs — TK1: testklok. Zonder variabele niets; met variabele volgt de hele app, overal aanpasbaar, gelogd; sessie en blokkering op echte tijd.
import * as T from './_testhulp.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
const POORT = Number(process.env.TEST_POORT) || 3379, ijk = T.leesIjk();
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// ── Zonder variabele ──
delete process.env.SPORTY_TESTKLOK;
let srv = await T.startServer({ poort: POORT });
try {
  let tok = await T.login(srv.base);
  const kaal = (p, ...x) => T.api(srv.base, null, 'GET', p, ...x);
  T.check((await kaal('/api/testklok')).status === 404 && (await T.api(srv.base, null, 'POST', '/api/testklok', { actie: 'plus_dag' })).status === 404, 'zonder variabele: routes 404');
  T.check(!/testklok/.test((await kaal('/login')).text) && !/testklok/.test((await kaal('/vandaag')).text), 'zonder variabele: niets in de HTML');
  await srv.stop();
  // Opgeslagen verschil genegeerd
  // ── Met variabele ──
  process.env.SPORTY_TESTKLOK = '1';
  srv = await T.startServer({ poort: POORT });
  tok = await T.login(srv.base);
  let A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const db = (q, p) => T.leesDb(srv.dbPad, q, p), wacht = () => new Promise((r) => setTimeout(r, 700));
  const pers = async (naam, rol, pin) => { const x = (await A('POST', '/api/personeel', { naam, rol })).json; await A('POST', `/api/personeel/${x.id}/pincode`, { pincode: pin }); return { id: x.id, tok: await T.login(srv.base, x.id, pin) }; };
  const ch = await pers('Tk Chauffeur', 'chauffeur', '5871');
  const zet = (b, t) => T.api(srv.base, t, 'POST', '/api/testklok', b);
  const stand = async () => (await T.api(srv.base, null, 'GET', '/api/testklok')).json;
  T.check((await stand()).verzet === false, 'begint op echte tijd');
  // Zetten
  T.check((await zet({ datum: '2026-11-02', uur: '09:00', via: '/vandaag' }, tok)).status === 200, 'klok gezet op ma 2/11 09:00');
  const v = (await A('GET', '/api/vandaag')).json;
  T.check(v.datum === '2026-11-02', `/api/vandaag volgt: ${v.datum}`);
  await A('POST', '/api/meldingen', { voor_rol: 'chauffeur', tekst: 'Tk logregel' });
  await wacht();
  const w = await db("SELECT tijdstip FROM wijzigingen WHERE tabel='meldingen' ORDER BY id DESC LIMIT 1");
  T.check(/^2026-11-02/.test(new Date(w[0].tijdstip).toISOString()), `logregel volgt: ${w[0].tijdstip}`);
  const lg = await db("SELECT beschrijving AS b FROM activiteiten_log WHERE type='testklok' OR actie='wissel' ORDER BY id DESC LIMIT 1");
  T.check(/→/.test(lg[0].b) && /echte tijd/.test(lg[0].b) && /via \/vandaag/.test(lg[0].b) && /Claude/.test(lg[0].b), `wissel gelogd: ${lg[0].b}`);
  // Vanuit chauffeur, KV-link (zonder login)
  T.check((await zet({ actie: 'plus_uur', via: '/rit/abc' }, ch.tok)).status === 200, 'chauffeur kan wisselen');
  T.check(new Date((await stand()).nu).getHours() === 10, '+1 uur');
  T.check((await zet({ actie: 'plus_dag', via: '/kv/abcdef' }, null)).status === 200, 'KV-link kan wisselen zonder login');
  await wacht();
  const lg2 = await db("SELECT beschrijving AS b FROM activiteiten_log WHERE actie='wissel' ORDER BY id DESC LIMIT 1");
  T.check(/via \/kv\/…/.test(lg2[0].b) && /zonder login/.test(lg2[0].b) && !/abcdef/.test(lg2[0].b), 'gelogd via welk scherm, zonder token');
  await zet({ actie: 'vrijdag' }); let d = new Date((await stand()).nu);
  T.check(d.getDay() === 5 && d.getHours() === 16, `volgende vrijdag 16:00: ${d}`);
  await zet({ actie: 'maandag' }); d = new Date((await stand()).nu);
  T.check(d.getDay() === 1 && d.getHours() === 8, 'volgende maandag 08:00');
  T.check((await zet({ datum: 'x' })).status === 400, 'foute invoer 400');
  // Sessie na +30 dagen
  await zet({ datum: '2026-12-15', uur: '10:00' });
  T.check((await A('GET', '/api/personeel')).status === 200, 'sessie blijft geldig na +30 dagen');
  // Herstart
  await new Promise((r) => setTimeout(r, 1000));
  await srv.stop();
  srv = await T.startServer({ poort: POORT, verseMap: false });
  T.check(iso(new Date((await T.api(srv.base, null, 'GET', '/api/testklok')).json.nu)) === '2026-12-15', 'klok overleeft een herstart');
  tok = await T.login(srv.base); A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  // KV-link 13 / 15 dagen
  const km = ijk.kampmomenten.abdijschool, kt = await T.kvToken(srv.base, tok, km), rij = (await T.leesDb(srv.dbPad, 'SELECT * FROM kampmomenten WHERE id=?', [km]))[0], per = (await T.leesDb(srv.dbPad, 'SELECT start_datum FROM vakantieperiodes WHERE id=?', [rij.periode_id]))[0];
  const eind = new Date(per.start_datum + 'T12:00:00'); eind.setDate(eind.getDate() + (rij.week - 1) * 7 + 4);
  const naEind = (n) => { const x = new Date(eind); x.setDate(x.getDate() + n); return iso(x); };
  await zet({ datum: naEind(13), uur: '10:00' });
  T.check((await T.api(srv.base, null, 'GET', `/api/kv/${kt}/data`)).json.link_stand === 'lezen', '13 dagen: lezen, alleen door de klok');
  await zet({ datum: naEind(15), uur: '10:00' });
  T.check((await T.api(srv.base, null, 'GET', `/kv/${kt}`)).status === 410, '15 dagen: dicht');
  // Vertrekt vandaag en dringend
  const dag = '2026-11-04', R = ijk.locaties.rozenweg, AB = (await A('GET', '/api/locaties')).json.find((l) => /abdij/i.test(l.name)).id;
  await A('POST', '/api/transport-taken', { type: 'levering', datum: dag, tijd: '09:00', van_locatie_id: R, naar_locatie_id: AB, kampmoment_id: km, regels: [{ naam: 'Doos', qty: 1 }] });
  await zet({ datum: '2026-11-04', uur: '08:00' });
  const v1 = (await A('GET', '/api/vandaag')).json;
  const r1 = (await A('GET', '/api/transport-taken')).json.length;
  T.check(v1.datum === dag && r1 > 0, 'dezelfde dag: Vandaag staat op de dag van de levering');
  const aan = fs.readFileSync(T.ROOT + '/public/aanvullen.js', 'utf8');
  T.check(/new Date\(\)/.test(aan), '"vertrekt vandaag" rekent met new Date() in de browser, die de klok volgt');
  await zet({ datum: '2026-09-01', uur: '08:00' });
  const v2 = (await A('GET', '/api/vandaag')).json;
  T.check(v2.datum === '2026-09-01' && Array.isArray(v2.inplannen), 'dringend wordt herberekend op de klokdatum; terug in de tijd crasht niet');
  // HTML overal
  const rit = (await A('POST', '/api/ritten', { datum: dag, vertrek: '09:00', personeel_id: ch.id })).json;
  const rt = (await A('POST', `/api/ritten/${rit.id}/token`)).json.token;
  for (const p of ['/vandaag', '/login', `/rit/${rt}`, `/kv/${kt}`, '/aanvullijst-print', '/meer']) {
    const h = (await T.api(srv.base, null, 'GET', p)).text;
    T.check(/window\.__TESTKLOK_VERSCHIL=-?\d+/.test(h) && h.indexOf('/public/testklok.js') < h.search(/<script[^>]*>(?!window\.__TESTKLOK)(?![^<]*testklok)/) + 1e9 && h.indexOf('testklok.js') < (h.indexOf('</head>') + 1 || 1e9), `klok in de HTML vóór de rest: ${p.replace(/(rit|kv)\/.*/, '$1/…')}`);
  }
  // Browser-Date (zonder DOM)
  const ctxt = { Function, Date, setTimeout, setInterval, __TESTKLOK_VERSCHIL: 86400000 };
  ctxt.window = ctxt; vm.createContext(ctxt);
  vm.runInContext(fs.readFileSync(T.ROOT + '/public/testklok.js', 'utf8'), ctxt);
  const nuB = vm.runInContext('Date.now()', ctxt), ech = Date.now();
  T.check(Math.abs(nuB - (ech + 86400000)) < 2000 && vm.runInContext('new Date(0).getTime()', ctxt) === 0 && vm.runInContext('new Date() instanceof Date', ctxt), 'browser-Date verschuift, vaste datums niet');
  vm.runInContext('__testklokZet(0)', ctxt);
  const js = fs.readFileSync(T.ROOT + '/public/testklok.js', 'utf8');
  T.check(/title = 'Naar de echte tijd'/.test(js) && /terug\.disabled = v === 0/.test(js) && /@media print/.test(js), '⟲ met tooltip, uit op echte tijd, niet op de afdruk');
  T.check(/isOverlay\(\) \|\| vuil/.test(js) && /ververs\.hidden = false/.test(js), 'een open venster of ingevulde tekst wordt niet weggeherladen');
  // Echte tijd
  T.check((await zet({ actie: 'echt', via: '/vandaag' })).status === 200 && (await stand()).verzet === false && Math.abs(new Date((await stand()).nu).getTime() - Date.now()) < 5000, '⟲: terug naar de echte tijd');
  T.check((await A('GET', '/api/vandaag')).status === 200, 'na terugzetten crasht niets (latere regels staan in de toekomst)');
} catch (e) { T.fout('uitzondering: ' + e.message + ' ' + e.stack); console.log(srv.log().slice(-1200)); }
delete process.env.SPORTY_TESTKLOK;
await T.einde(srv);
