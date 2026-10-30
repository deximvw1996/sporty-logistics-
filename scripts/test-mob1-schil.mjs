// test-mob1-schil.mjs — MOB1 (chat C): gsm-schil, /login, Vandaag op gsm. Eigen server via _testhulp (poort 3368, herfst-test.db).
// Tabbalk per rol, login goed/fout/blokkering, /rit en /kv zonder tabbalk, NU-kaart per rol, DOM-bouw met de echte data-JSON.
// Maten en computed style op 390 px en desktop zijn in de browser gemeten (geen DOM in node): zie het verslag; hier de CSS-regels.
import * as T from './_testhulp.mjs';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const POORT = parseInt(process.env.TEST_POORT || '3368');
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: POORT });
const BASIC = 'Basic ' + Buffer.from('sporty:' + T.APP_PASSWORD).toString('base64');
const html = async (p) => { const r = await fetch(srv.base + p, { headers: { authorization: BASIC } }); return { status: r.status, t: await r.text() }; };
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const P = (m, p, b) => T.api(srv.base, null, m, p, b);
  const NAV = require(T.ROOT + '/public/nav.js');
  // ── tabbalk per rol ──
  const namen = (r) => NAV.tabsVan(r).map((t) => t[2]).join(' · ');
  T.check(namen('chauffeur') === 'Vandaag · Ritten · Stockage · Meldingen · Meer' && namen('coordinator') === namen('chauffeur'), `chauffeur/coördinator: ${namen('chauffeur')}`);
  T.check(namen('kantoor') === 'Vandaag · Transport · Voorraad · Meldingen · Meer', `kantoor: ${namen('kantoor')}`);
  const act = (r, p, q) => NAV.actieveTab(r, p, q);
  T.check(act('kantoor', '/ritplanning') === 'transport' && act('kantoor', '/taken') === 'transport' && act('kantoor', '/tekorten') === 'voorraad' && act('kantoor', '/rooster') === 'meer' && act('kantoor', '/vandaag', '?tab=meldingen') === 'meldingen' && act('chauffeur', '/vandaag', '?tab=ritten') === 'ritten' && act('chauffeur', '/meer') === 'meer' && act('kantoor', '/vandaag') === 'vandaag', 'actieve tab volgt de PAGINA-tabel');
  const tb = NAV.tabbalk('kantoor', '/vandaag', '', { vandaag: 4, transport: 9 });
  T.check((tb.match(/<a /g) || []).length === 5 && /Vandaag <em>4<\/em>/.test(tb) && /Transport <em>9<\/em>/.test(tb) && !/Voorraad <em>/.test(tb) && /class="act" href="\/vandaag"/.test(tb), 'tabbalk: 5 tabs, rode tellers alleen als er iets is');
  // ── desktop ongewijzigd + gsm-regels ──
  const css = fs.readFileSync(T.ROOT + '/public/app-schil.css', 'utf8');
  const voorMedia = css.split('@media')[0].replace(/\/\*[\s\S]*?\*\//g, '').trim();
  T.check(voorMedia === '.app-tabs{display:none}' && /max-width:767px/.test(css) && /\.app-tabs a\{[^}]*height:52px/.test(css) && /body\.heeft-tabs \.top\{display:none!important\}/.test(css), 'app-schil.css: boven 767 px alleen ".app-tabs{display:none}"; tabs 52 px');
  T.check(NAV.SUB.transport.length === 3 && /body\.heeft-tabs \.sub\{[^}]*overflow-x:auto/.test(css), 'subbalk op gsm: horizontaal scrollbaar');
  // ── niet ingelogd → /login?terug= ──
  const navSrc = fs.readFileSync(T.ROOT + '/public/nav.js', 'utf8');
  T.check(/\/login\?terug=/.test(navSrc) && /plaintext/.test(navSrc), 'nav.js: zonder token op gsm → /login?terug= (browser: zie verslag)');
  T.check(!NAV.magOpGsm('chauffeur', '/rooster') && NAV.magOpGsm('chauffeur', '/meer') && NAV.magOpGsm('coordinator', '/tekorten') && !NAV.magOpGsm('chauffeur', '/tekorten') && NAV.magOpGsm('kantoor', '/rooster'), 'gsm: de ploeg op een kantoorpagina → Vandaag');
  // ── /rit en /kv zonder tabbalk ──
  const rit = fs.readFileSync(T.ROOT + '/public/rit.html', 'utf8'), kv = fs.readFileSync(T.ROOT + '/public/kv.html', 'utf8');
  T.check(!/nav\.js/.test(rit) && !/nav\.js/.test(kv), '/rit/<token> en /kv/<token> laden nav.js niet: geen tabbalk');
  // ── pagina's ──
  for (const p of ['/login', '/meer']) { const r = await html(p); T.check(r.status === 200 && /<title>/.test(r.t), `GET ${p} 200`); }
  // ── login ──
  const pers = async (naam, rol, pin) => { const x = (await A('POST', '/api/personeel', { naam, rol })).json; await A('POST', `/api/personeel/${x.id}/pincode`, { pincode: pin }); return x.id; };
  const ch = await pers('Mob Jan', 'chauffeur', '4101'), co = await pers('Mob Lotte', 'coordinator', '4102');
  const lijst = (await P('GET', '/api/personeel-lijst-login')).json;
  T.check(lijst.some((x) => x.id === ch && x.heeft_pincode) && lijst.some((x) => x.id === co), 'personeelslijst voor het loginscherm bevat chauffeur en coördinator');
  const goed = await P('POST', '/api/login', { persoon_id: ch, pincode: '4101' });
  T.check(goed.status === 200 && goed.json.token && goed.json.rol === 'chauffeur', 'login goed → token en rol');
  T.check((await P('POST', '/api/login', { persoon_id: co, pincode: '0000' })).status === 401, 'login fout → 401');
  const LB = require(T.ROOT + '/public/login.js');
  T.check(LB.sorteer([{ id: 1, naam: 'A' }, { id: 2, naam: 'B' }], 2)[0].id === 2 && /Niemand gevonden/.test(LB.keuze([{ id: 1, naam: 'A', rol: 'kantoor' }], 'zzz')), 'login: laatste gebruiker bovenaan, zoeken werkt');
  const ph = LB.pin({ naam: 'Lotte', rol: 'coordinator', heeft_pincode: 1 }, 2, 'Ongeldige pincode');
  T.check((ph.match(/<i class="v">/g) || []).length === 2 && (ph.match(/<i/g) || []).length === 4 && /schud/.test(ph) && /Geef je pincode/.test(ph) && (ph.match(/data-c=/g) || []).length === 10 && /Je blijft ingelogd op deze gsm/.test(ph), 'login: 4 stippen (2 vol), schudden bij fout, 10 cijfers, tekst uit de mockup');
  T.check(LB.terug('?terug=/rooster%3Fweek%3D3') === '/rooster?week=3' && LB.terug('?terug=//evil.be') === '/vandaag' && LB.terug('?terug=https://evil.be') === '/vandaag' && LB.terug('') === '/vandaag', 'login: terug alleen naar een pad binnen de site');
  const blok = []; const bl = await pers('Mob Blok', 'chauffeur', '4103');
  for (let i = 0; i < 6; i++) blok.push((await P('POST', '/api/login', { persoon_id: bl, pincode: '0000' })).status);
  T.info(`blokkering, 6× fout: ${blok.join(',')}`);
  T.check(blok[5] === 429, `blokkering na 5 mislukkingen → 429 (kreeg ${blok.join(',')})`);
  // ── NU-kaart ──
  const { kiesNu } = require(T.ROOT + '/routes/vandaag.js');
  const r1 = { titel: 'r1', tijd: '08:30' }, r2 = { titel: 'r2', tijd: '13:30' }, on = { titel: 'on', tijd: '13:00', onderweg: true }, av = { titel: 'av' }, tl = { titel: 'tl', tijd: '11:00' };
  T.check(kiesNu([r2, r1], null, []).nu.titel === 'r1' && kiesNu([r2, r1], null, []).nu.knop === 'Start ›' && kiesNu([r1, on], null, []).nu.titel === 'on' && kiesNu([r1, on], null, []).nu.knop === 'Verder ›', 'NU chauffeur: rit onderweg gaat voor (Verder), anders de eerste op tijd (Start)');
  const c = kiesNu([r1, r2], av, [tl]);
  T.check(c.nu.titel === 'av' && c.daarna.map((x) => x.titel).join() === 'r1,tl,r2', 'NU coördinator: aanvullen eerst; Daarna op tijd: rit, tellen, rit');
  T.check(kiesNu([on], av, []).nu.titel === 'on' && kiesNu([], null, []).nu === null, 'coördinator onderweg: de rit gaat voor aanvullen; niets = geen NU');
  // echte data: chauffeur met een rit
  const gen = (await A('POST', '/api/transport-genereer')).json;
  const vs = gen.find((v) => v.type === 'levering');
  const { ritId } = await T.voorstelNaarRit(srv.base, tok, vs, { chauffeur: { id: ch, naam: 'Mob Jan' } });
  const dat = (await A('GET', `/api/ritten`)).json; const datum = (Array.isArray(dat) ? dat : []).find((r) => r.id === ritId)?.datum || vs.datum;
  const CH = (await T.api(srv.base, goed.json.token, 'GET', `/api/vandaag?mijn=1&datum=${datum}`)).json;
  T.check(CH.nu && CH.nu.soort === 'rit' && /^\/rit\/\w+/.test(CH.nu.url) && CH.nu.titel.startsWith(`Rit #${ritId}`) && CH.tellers.ritten === 1, `NU chauffeur (echte data): "${CH.nu && CH.nu.titel}" → ${CH.nu && CH.nu.url.slice(0, 6)}…`);
  const open = await html(CH.nu.url); T.check(open.status === 200, 'de knop op de NU-kaart opent de rit-weergave (200)');
  const ctok = (await P('POST', '/api/login', { persoon_id: co, pincode: '4102' })).json.token;
  const CO = (await T.api(srv.base, ctok, 'GET', `/api/vandaag?mijn=1&datum=${datum}`)).json;
  T.check(CO.gebruiker.rol === 'coordinator' && Array.isArray(CO.daarna) && CO.tellers.meldingen === 0, `coördinator: ${CO.nu ? 'NU "' + CO.nu.titel + '"' : 'geen NU'}, ${CO.daarna.length} daarna`);
  const KA = (await A('GET', '/api/vandaag?mijn=1')).json;
  T.check(KA.gebruiker.rol === 'kantoor' && 'vandaag' in KA.tellers && 'transport' in KA.tellers && 'voorraad' in KA.tellers && KA.ritten_vandaag !== undefined, `kantoor: tellers ${JSON.stringify(KA.tellers)}`);
  const { kiesNuKantoor } = require(T.ROOT + '/routes/vandaag.js');
  const kg = kiesNuKantoor([{ titel: 'Beslissen · 4' }, { titel: 'Inplannen · 9' }]);
  T.check(kg.nu.titel === 'Beslissen · 4' && kg.nu.knop === 'Start ›' && kg.daarna.length === 1, 'NU kantoor: de eerste groep die aandacht vraagt (Beslissen → Inplannen → Nakijken → Ritten)');
  T.check((await T.api(srv.base, goed.json.token, 'GET', '/api/vandaag')).status === 403, 'chauffeur zonder mijn=1 blijft 403');
  // ── DOM-bouw ──
  const t = (h) => h.replace(/<[^>]+>/g, '\n').replace(/\n\s*\n+/g, '\n').trim().split('\n').join(' | ');
  const G = require(T.ROOT + '/public/vandaag.js');
  const hc = G.scherm(CH, '');
  T.check(/class="kopA"/.test(hc) && /Hallo Mob Jan/.test(hc) && /class="nukaart"/.test(hc) && /Start ›/.test(hc) && /chauffeur · /.test(hc), `Vandaag chauffeur: ${t(hc).slice(0, 200)}`);
  T.check(/Ritten/.test(G.scherm(CH, 'ritten')) && /\/rit\//.test(G.scherm(CH, 'ritten')) && /Geen open meldingen/.test(G.scherm(CH, 'meldingen')), 'tabs Ritten en Meldingen');
  const MB = require(T.ROOT + '/public/meer.js');
  const mk = MB.html({ rol: 'kantoor', naam: 'Maxim' }, { naam: 'Herfst' }), mc = MB.html({ rol: 'chauffeur', naam: 'Jan' });
  T.check(['Planning', 'Materiaal', 'Locaties', 'Beheer', 'Uitloggen', 'Periode'].every((x) => mk.includes(x)), 'Meer kantoor: Planning, Materiaal, Locaties, Beheer, periode, profiel, uitloggen');
  T.check(!mc.includes('Planning') && !mc.includes('Beheer') && mc.includes('Uitloggen') && mc.includes('pincode wijzigen'), 'Meer chauffeur: alleen wat de rol mag');
} catch (e) { T.fout('uitzondering: ' + e.stack); }
await T.einde(srv);
