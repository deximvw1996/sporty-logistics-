// test-af1-afwerking.mjs — AF1 (chat D): gedeelde sportyApi met 502-herpoging, knop "Bestelling binnen" in Nakijken, strip in de aanvullijst.
// Eigen server via _testhulp (poort 3350). HTML-bouwers en nav.js worden als module geladen (geen headless browser).
import * as T from './_testhulp.mjs';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: parseInt(process.env.TEST_POORT || '3350') });
const lees = (p) => fs.readFileSync(T.ROOT + '/' + p, 'utf8');
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const P = (m, p, b) => T.api(srv.base, null, m, p, b);

  // ── Punt 1: sportyApi ──
  const NAV = require(T.ROOT + '/public/nav.js');
  const maak = (antwoorden) => {
    const calls = [], toasts = [], waits = [];
    const deps = { token: 'tok', toast: (t) => toasts.push(t), wacht: (ms) => { waits.push(ms); return Promise.resolve(); },
      fetch: async (u, o) => { calls.push([u, o.method]); const a = antwoorden[Math.min(calls.length - 1, antwoorden.length - 1)]; if (a === 'net') throw new TypeError('fetch failed'); return { status: a, ok: a < 400, json: async () => ({ n: calls.length }) }; } };
    return { deps, calls, toasts, waits };
  };
  let h = maak([503, 503, 200]); let r = await NAV.sportyApi('GET', '/api/x', null, h.deps);
  T.check(r.ok && r.status === 200 && r.json.n === 3 && h.calls.length === 3 && h.waits.join() === '2000,5000' && h.toasts.length === 1 && /Even geduld, de app wordt bijgewerkt/.test(h.toasts[0]), `503,503,200 → één resultaat, twee herpogingen (2 s, 5 s), één toast (${h.calls.length} calls, ${h.toasts.length} toast)`);
  h = maak([502, 504, 502]); r = await NAV.sportyApi('POST', '/api/x', { a: 1 }, h.deps);
  T.check(!r.ok && r.status === 502 && h.calls.length === 3, 'na twee herpogingen komt de fout gewoon terug (3 calls)');
  h = maak([400]); r = await NAV.sportyApi('POST', '/api/x', {}, h.deps);
  T.check(r.status === 400 && h.calls.length === 1 && h.toasts.length === 0, 'een 400 wordt niet herhaald');
  h = maak(['net', 200]); r = await NAV.sportyApi('GET', '/api/x', null, h.deps);
  T.check(r.ok && h.calls.length === 2, 'GET met netwerkfout wordt herhaald');
  h = maak(['net', 200]); let gegooid = false; try { await NAV.sportyApi('POST', '/api/x', {}, h.deps); } catch (e) { gegooid = true; }
  T.check(gegooid && h.calls.length === 1, 'POST met netwerkfout: geen herpoging, fout wordt gegooid');
  h = maak([503, 200]); r = await NAV.sportyApi('DELETE', '/api/x', null, h.deps);
  T.check(r.ok && h.calls.length === 2, 'DELETE bij 503 wordt wel herhaald (server niet bereikt)');
  for (const f of ['vandaag', 'taken', 'nakijken', 'kampmomenten', 'bakken', 'personeel', 'logboek', 'locaties']) {
    const s = lees(`public/${f}.js`);
    T.check(/sportyApi/.test(s), `${f}.js laat zijn api() door sportyApi lopen`);
  }
  T.check(/sportyApi/.test(lees('public/ritplanning.js')), 'ritplanning.js laat zijn api() door sportyApi lopen (reviewfix na RP2)');
  for (const f of ['vandaag', 'taken', 'nakijken', 'kampmomenten', 'bakken', 'personeel', 'logboek', 'ritplanning']) {
    const html = lees(`public/${f}.html`);
    T.check(html.indexOf('/public/nav.js') > -1 && html.indexOf('/public/nav.js') < html.indexOf(`/public/${f}.js`), `${f}.html laadt nav.js vóór het eigen script`);
  }

  // ── Punt 2: Bestelling binnen ──
  const km = ijk.kampmomenten.abdijschool, thema = ijk.themas.alles_op_wieltjes;
  const bak = (await A('POST', `/api/themas/${thema}/bakken`, { label: 'Af bak een', code: 'AF01' })).json;
  for (const [naam, qty] of [['Springtouw', 4], ['Touw (gedeeld; niet mee)', 2]]) await A('POST', `/api/bakken/${bak.id}/items`, { naam, qty });
  await A('POST', `/api/kampmomenten/${km}/themas`, { thema_id: thema });
  const kvtok = await T.kvToken(srv.base, tok, km);
  const kv = (m, p, b) => P(m, `/api/kv/${kvtok}${p}`, b);
  const d0 = (await kv('GET', '/data')).json; const kb = d0.bakken.find((b) => b.code === 'AF01');
  for (const [n, a] of [['Springtouw', 2], ['Touw (gedeeld; niet mee)', 1]]) await kv('POST', `/bakken/${kb.id}/tellen`, { regels: [{ item_id: kb.items.find((i) => i.naam.startsWith(n.slice(0, 4))).id, aangetroffen: a }] });
  await kv('POST', '/versturen', {});
  const sid = (await A('GET', '/api/nakijken')).json.bakken.find((b) => b.kampmoment_id === km && b.bak.code === 'AF01').sessie_id;
  let det = (await A('GET', `/api/nakijken/sessie/${sid}`)).json;
  const spr = det.items.find((i) => i.naam === 'Springtouw'), tou = det.items.find((i) => i.naam.startsWith('Touw'));
  await A('PUT', `/api/nakijken/regel/${spr.regel_id}`, { kantoor_actie: 'bestellen', kantoor_aantal: 2 });
  await A('PUT', `/api/nakijken/regel/${tou.regel_id}`, { kantoor_actie: 'bestellen', kantoor_aantal: 1 });
  await A('POST', `/api/nakijken/sessie/${sid}/afronden`);
  det = (await A('GET', `/api/nakijken/sessie/${sid}`)).json;
  const NK = require(T.ROOT + '/public/nakijken.js');
  T.check(det.items.find((i) => i.naam === 'Springtouw').tekort_status === 'besteld', 'detail geeft tekort_status door (besteld)');
  let th = NK.telTabel(det);
  const knop = new RegExp(`data-act="binnen" data-a="${spr.regel_id}">Bestelling binnen<`);
  T.check(knop.test(th) && /min-height:36px/.test(th), 'telTabel: knop "Bestelling binnen" bij status besteld (≥ 36 px)');
  const nu = new Date(), datum = `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, '0')}-${String(nu.getDate()).padStart(2, '0')}`; // lokale datum, zoals de server
  let h1 = null;
  const zoek = (j) => { h1 = null; for (const g of j.bakken || []) for (const x of g.handelingen) if (x.regel_id === spr.regel_id) h1 = x; };
  r = await A('GET', `/api/aanvullijst?datum=${datum}`); zoek(r.json);
  T.check(h1 && h1.kan_afvinken === false && h1.binnen === false, 'aanvullijst: vóór binnen is de handeling niet afvinkbaar');
  r = await A('POST', `/api/aanvullijst/${spr.regel_id}/aangevuld`, { aangevuld: true });
  T.check(r.status === 409, 'afvinken vóór binnen → 409');
  r = await A('POST', `/api/nakijken/regel/${spr.regel_id}/binnen`, {});
  T.check(r.status === 200 && r.json.tekort_status === 'binnen', 'POST binnen → 200, status binnen');
  det = (await A('GET', `/api/nakijken/sessie/${sid}`)).json; th = NK.telTabel(det);
  T.check(!knop.test(th) && /binnen, klaar om te plaatsen/.test(th), 'telTabel: bij status binnen géén knop voor deze regel, wel "binnen, klaar om te plaatsen"');
  T.check(new RegExp(`data-act="binnen" data-a="${tou.regel_id}"`).test(th), 'de andere (nog bestelde) regel houdt zijn knop');
  r = await A('GET', `/api/aanvullijst?datum=${datum}`); zoek(r.json);
  T.check(h1 && h1.kan_afvinken === true, 'aanvullijst: na binnen is de handeling afvinkbaar');
  r = await A('POST', `/api/aanvullijst/${spr.regel_id}/aangevuld`, { aangevuld: true });
  T.check(r.status === 200 && r.json.aangevuld === 1, 'afvinken na binnen → 200');
  T.check(NK.binnenCel({ regel_id: 5, kantoor_actie: 'uit_pool', tekort_status: 'besteld' }) === '', 'binnenCel: geen knop bij een andere actie dan bestellen');
  T.check(/act === 'binnen'[\s\S]{0,120}\/binnen/.test(lees('public/nakijken.js')), 'klik op de knop roept POST /api/nakijken/regel/:id/binnen aan en ververst');

  // ── Punt 3: strip in de aanvullijst (coördinator) ──
  r = await A('GET', `/api/aanvullijst?datum=${datum}`);
  const touH = (r.json.bakken || []).flatMap((g) => g.handelingen).find((x) => x.regel_id === tou.regel_id);
  T.check(touH && touH.stuk === 'Touw', `aanvullijst strip de interne notitie uit "stuk" ("${touH && touH.stuk}")`);
  T.check(det.items.some((i) => /gedeeld; niet mee/.test(i.naam)), 'kantoor (nakijk-detail) ziet de notitie wél');
} catch (e) {
  T.fout('test crashte: ' + (e.stack || e));
}
await T.einde(srv);
