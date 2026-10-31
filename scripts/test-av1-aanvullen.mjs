// test-av1-aanvullen.mjs — AV1 (chat D): Voorraad & controles › Aanvullen op de gsm (design/mockup-aanvullen-gsm.html).
// Eigen server via _testhulp (poort 3358 of TEST_POORT, herfst-test.db). De HTML-bouwers van public/aanvullen.js worden als module met de echte API-data aangeroepen.
import * as T from './_testhulp.mjs';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const lees = (p) => fs.readFileSync(T.ROOT + '/' + p, 'utf8');
const ijk = T.leesIjk();
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const srv = await T.startServer({ poort: Number(process.env.TEST_POORT) || 3358 });
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const P = (m, p, b) => T.api(srv.base, null, m, p, b);
  const R = ijk.locaties.rozenweg, km = ijk.kampmomenten.abdijschool, thema = ijk.themas.alles_op_wieltjes;
  const AV = require(T.ROOT + '/public/aanvullen.js');

  // ── data: bak met 4 stukken; KV telt; kantoor beslist en rondt af ──
  const bakId = (await A('POST', `/api/themas/${thema}/bakken`, { label: 'Av bak', code: 'AV01' })).json.id;
  for (const [n, q] of [['Springtouw', 4], ['Hoepel', 6], ['Pion', 10], ['Lintje', 3]]) await A('POST', `/api/bakken/${bakId}/items`, { naam: n, qty: q });
  await A('POST', `/api/kampmomenten/${km}/themas`, { thema_id: thema });
  const kvtok = await T.kvToken(srv.base, tok, km);
  const kv = (m, p, b) => P(m, `/api/kv/${kvtok}${p}`, b);
  const d0 = (await kv('GET', '/data')).json, kb = d0.bakken.find((b) => b.code === 'AV01');
  const tel = (naam, rest) => kv('POST', `/bakken/${kb.id}/tellen`, { regels: [{ item_id: kb.items.find((i) => i.naam === naam).id, ...rest }] });
  await tel('Springtouw', { aangetroffen: 0, notitie: 'weg' });          // tekort 4 → uit pool
  await tel('Hoepel', { aangetroffen: 2 });                               // tekort 4 → bestellen (wacht op levering)
  await tel('Pion', { aangetroffen: 10, kapot_aantal: 2, notitie: 'gebarsten', foto_data: PNG }); // kapot 2 → afschrijven + bestellen
  await tel('Lintje', { aangetroffen: 3 });
  await kv('POST', '/versturen', {});
  const nk = (await A('GET', '/api/nakijken')).json.bakken.find((b) => b.bak.code === 'AV01' && b.kampmoment_id === km);
  const det = (await A('GET', `/api/nakijken/sessie/${nk.sessie_id}`)).json;
  const reg = (n) => det.items.find((i) => i.naam === n);
  const kies = (n, actie) => A('PUT', `/api/nakijken/regel/${reg(n).regel_id}`, { kantoor_actie: actie, kantoor_aantal: reg(n).aantal_afwijking });
  T.check([(await kies('Springtouw', 'uit_pool')).status, (await kies('Hoepel', 'bestellen')).status, (await kies('Pion', 'afschrijven_bestellen')).status].every((s) => s === 200), 'kantoor beslist in Nakijken: uit pool, bestellen, afschrijven + bestellen');
  T.check((await A('POST', `/api/nakijken/sessie/${nk.sessie_id}/afronden`)).status === 200, 'keuring afgerond → de aanvullijst volgt');
  // voorraad Rozenweg van Springtouw
  const typeId = (await T.leesDb(srv.dbPad, "SELECT item_type_id AS t FROM bak_items WHERE bak_id=? AND naam='Springtouw'", [bakId]))[0].t;
  await A('PUT', `/api/catalogus/${typeId}/voorraad`, { locatie_id: R, qty: 20 });
  const stock = async () => (await T.leesDb(srv.dbPad, 'SELECT qty FROM item_type_stock WHERE item_type_id=? AND locatie_id=?', [typeId, R]))[0].qty;

  // ═══ Lijst volgt uit Nakijken ═══
  let data = (await A('GET', '/api/aanvullijst?alles=1')).json;
  const g = data.bakken.find((b) => b.bak.code === 'AV01');
  const h = (n) => g.handelingen.find((x) => x.stuk === n);
  T.check(g && g.handelingen.length === 3 && ['Springtouw', 'Hoepel', 'Pion'].every((n) => h(n)), `lijst volgt uit Nakijken: AV01 heeft ${g.handelingen.map((x) => x.stuk + ':' + x.soort)}`);
  T.check('vertrek' in g && g.plaats !== undefined, 'bak heeft vertrekdatum en plaats (rek/plank)');
  const lijst = AV.lijst(data, { vandaag: '2026-11-10' });
  T.check(!/<table|<tr[ >]/.test(lijst) && lijst.includes('class="kopB"') && lijst.includes('Aanvullen · Rozenweg') && lijst.includes('AV01') && lijst.includes('0 van 3 klaar') && lijst.includes('href="/aanvullijst-print"') && lijst.includes('🖨 Printlijst'), 'lijst op 390 px: per bak "n van m klaar", geen tabel, 🖨 Printlijst → /aanvullijst-print');
  T.check(lijst.includes('data-a="uit_pool"') && lijst.includes('data-a="bestelling"') && lijst.includes('data-a="klaar"') && lijst.includes('data-av="open"'), 'filters Alles / Uit pool / Bestelling / Klaar en bak openen');
  // volgorde: wat vandaag vertrekt bovenaan
  const nep = (code, vertrek, k = 0) => ({ sessie_id: code, bak: { code, naam: code }, vertrek, handelingen: [{ aangevuld: k, regel_id: 1 }] });
  const sorted = AV.sorteer([nep('C', ''), nep('B', '2026-11-12'), nep('A', '2026-11-10'), nep('D', '2026-11-10', 1)], '2026-11-10').map((x) => x.bak.code).join('');
  T.check(sorted === 'ABCD', `volgorde: vandaag, dan later, dan zonder vertrek, klaar onderaan (${sorted})`);

  // ═══ Bakscherm ═══
  const bakHtml = AV.bak(g, {});
  T.check(bakHtml.includes('‹ terug') && bakHtml.includes('data-av="terug"') && (bakHtml.match(/class="vink/g) || []).length === 3 && bakHtml.includes('data-av="aantal"') && bakHtml.includes('capture="environment"') && bakHtml.includes('Bak AV01 klaar (0/3)') && /data-av="klaar" disabled/.test(bakHtml), 'bak: per stuk een groot vinkvak, aantal, camera (capture), ‹ terug, Bak klaar nog uit');
  T.check(bakHtml.includes('wacht op levering') && /class="vink uit" disabled/.test(bakHtml), 'bestelling die niet binnen is: knop uit met uitleg "wacht op levering"');
  const hHoepel = h('Hoepel');
  T.check(hHoepel.kan_afvinken === false && (await A('POST', `/api/aanvullijst/${hHoepel.regel_id}/aangevuld`, { aangevuld: true })).status === 409, 'bestelling niet binnen: API geeft 409');

  // ═══ Afvinken verlaagt de voorraad één keer ═══
  T.check((await stock()) === 20, 'voorraad Springtouw Rozenweg vóór afvinken: 20');
  const sp = h('Springtouw');
  let r = await A('POST', `/api/aanvullijst/${sp.regel_id}/aangevuld`, { aangevuld: true });
  T.check(r.status === 200 && r.json.aangevuld === 1 && (await stock()) === 16, `afvinken (4) → voorraad ${await stock()}`);
  r = await A('POST', `/api/aanvullijst/${sp.regel_id}/aangevuld`, { aangevuld: true });
  T.check(r.status === 200 && (await stock()) === 16, `tweede keer afvinken verlaagt niet opnieuw (${await stock()})`);
  r = await A('POST', `/api/aanvullijst/${sp.regel_id}/aangevuld`, { aangevuld: false });
  T.check(r.status === 200 && (await stock()) === 20, 'terugzetten (tik op een afgevinkt stuk) zet de voorraad terug');

  // ═══ Minder gevonden → rest blijft open ═══
  r = await A('POST', `/api/aanvullijst/${sp.regel_id}/aangevuld`, { aangevuld: true, aantal: 3 });
  data = (await A('GET', '/api/aanvullijst?alles=1')).json;
  const sp2 = data.bakken.find((b) => b.bak.code === 'AV01').handelingen.find((x) => x.stuk === 'Springtouw');
  T.check(r.status === 200 && r.json.gedaan === 3 && r.json.open === 1 && r.json.aangevuld === 0 && sp2.aantal === 1 && !sp2.aangevuld && (await stock()) === 17, `3 van 4 gevonden → voorraad ${await stock()}, rest ${sp2.aantal} blijft open`);
  const log = (await A('GET', '/api/logboek')).json;
  const logTekst = JSON.stringify(log);
  T.check(/3 van 4 aangevuld/.test(logTekst) && /1 blijven open/.test(logTekst), 'de gedeeltelijke aanvulling staat in het logboek');
  T.check((await A('POST', `/api/aanvullijst/${sp.regel_id}/aangevuld`, { aangevuld: true, aantal: 0 })).status === 400, 'aantal 0 → 400');
  r = await A('POST', `/api/aanvullijst/${sp.regel_id}/aangevuld`, { aangevuld: true });
  T.check(r.status === 200 && r.json.aangevuld === 1 && (await stock()) === 16, `rest afvinken (1) → voorraad ${await stock()}, regel af`);

  // ═══ Afschrijven vraagt een foto ═══
  const pion = h('Pion');
  const zonder = await A('POST', `/api/aanvullijst/${pion.regel_id}/aangevuld`, { aangevuld: true });
  T.check(zonder.status === 400 && /foto/i.test(zonder.json.error), `afschrijven zonder foto geweigerd (${zonder.json.error})`);
  const met = await A('POST', `/api/aanvullijst/${pion.regel_id}/aangevuld`, { aangevuld: true, foto_data: PNG });
  T.check(met.status === 200 && /^\/uploads\//.test(met.json.foto || ''), `afschrijven met foto bewaard (${met.json.foto})`);
  T.check(bakHtml.includes('foto verplicht'), 'het scherm zegt dat de foto verplicht is bij afschrijven');

  // ═══ Bak klaar: bestelling binnen, alles af ═══
  await A('POST', `/api/nakijken/regel/${hHoepel.regel_id}/binnen`);
  data = (await A('GET', '/api/aanvullijst?alles=1')).json;
  let g2 = data.bakken.find((b) => b.bak.code === 'AV01');
  T.check((await A('POST', `/api/aanvullijst/${hHoepel.regel_id}/aangevuld`, { aangevuld: true })).status === 200, 'binnen → afvinken lukt');
  data = (await A('GET', '/api/aanvullijst?alles=1')).json;
  g2 = data.bakken.find((b) => b.bak.code === 'AV01');
  const klaarHtml = AV.bak(g2, {});
  T.check(AV.bakKlaar(g2) && klaarHtml.includes('Bak AV01 klaar (3/3)') && !/data-av="klaar" disabled/.test(klaarHtml), 'alles af → Bak klaar actief (3/3)');
  const l2 = AV.lijst(data, { vandaag: '2026-11-10' });
  T.check(l2.includes('3 van 3 klaar') && /bakK klaar/.test(l2), 'terug in de lijst: bak staat op klaar');

  // ═══ Pagina, tabbalk, vandaag, desktop ═══
  T.check((await P('GET', '/aanvullen')).status === 200 && (await A('GET', '/aanvullen')).status === 200, 'GET /aanvullen → 200');
  T.check((await P('GET', '/api/aanvullijst')).status === 401 || (await P('GET', '/api/aanvullijst')).status === 403, 'aanvullijst-API zonder inlog geweigerd');
  const nav = require(T.ROOT + '/public/nav.js');
  const ploeg = nav.TABS.ploeg.find((t) => t[0] === 'stockage');
  T.check(ploeg[3] === '/aanvullen' && nav.PAGINA['/aanvullen'] === 'voorraad' && nav.SUB.voorraad.some((s) => s[0] === 'Aanvullijst' && s[1] === '/aanvullen'), 'tab Stockage, de PAGINA-tabel en de Voorraad-subbalk wijzen naar /aanvullen');
  T.check(nav.actieveTab('chauffeur', '/aanvullen', '') === 'stockage' && nav.actieveTab('kantoor', '/aanvullen', '') === 'voorraad', 'tab Stockage is actief op /aanvullen (kantoor: Voorraad)');
  T.check(nav.magOpGsm('chauffeur', '/aanvullen') && nav.magOpGsm('kantoor', '/aanvullen'), 'coördinator, chauffeur en kantoor mogen /aanvullen op de gsm');
  const vj = lees('public/vandaag.js');
  T.check(vj.includes("u==='/aanvullijst-print'?'/aanvullen'") && vj.includes('escG(aUrl(n.url))') && vj.includes('location.href=aUrl(a.url)'), 'de NU-kaart "Aanvullen" op Vandaag opent /aanvullen');
  const html = lees('public/aanvullen.html'), css = lees('public/aanvullen.css');
  T.check(html.includes('class="top"') && html.includes('nav.js') && html.includes('name="viewport"') && !html.includes('class="sub"') && /\.av\{max-width:480px;margin:0 auto/.test(css), 'desktop: gecentreerde kolom van 480 px onder de bovenbalk van nav.js');
  T.check(/@media \(max-width:767px\)/.test(css) && /\.av \.knop\{height:44px/.test(css) && /\.av \.vink\{flex:none;width:56px;height:56px/.test(css) && /\.av \.aantal input\{width:64px;height:44px/.test(css) && /\.av \.chip\{flex:none;height:44px/.test(css) && /\.av \.terug\{display:inline-flex;align-items:center;min-height:44px/.test(css), 'knoppen, chips, aantal en ‹ terug zijn ≥ 44 px (vinkvak 56 px)');
  T.check(/overflow-x:auto/.test(css) && /overflow-wrap:anywhere/.test(css) && !/min-width:\d{3,}px/.test(css), 'geen vaste breedtes: filters scrollen horizontaal, tekst loopt door (scrollWidth blijft de schermbreedte)');
  T.check(fs.readFileSync(T.ROOT + '/public/aanvullijst-print.html', 'utf8') === lees('public/aanvullijst-print.html'), 'aanvullijst-print.html ongewijzigd');
} catch (e) { T.fout('uitzondering: ' + (e.stack || e)); }
await T.einde(srv);
