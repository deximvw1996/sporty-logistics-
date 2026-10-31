// test-tf3-rechten.mjs — TF3 punt 1: standaard dicht. Veegt ALLE routes uit app._router af als chauffeur, coördinator, monitor en anoniem:
// alles buiten de tabel 401/403 en de database blijft gelijk; de gewone flows van elke rol blijven werken; de KV-link geeft alleen eigen data.
process.env.SPORTY_TESTHOOK = '1';
import * as T from './_testhulp.mjs';
import { createRequire } from 'node:module';
const { ROL_ROUTES, rolMag, zwakkePin } = createRequire(import.meta.url)('../lib/auth.js');
const PUBLIEK = ['/api/login', '/api/login-status', '/api/setup-eerste-pincode', '/api/personeel-lijst-login', '/api/eerste-pincode'];
const isPubliek = (p) => p === '/api/live' /* RT1: blijft open; test-rt1 bewijst dat de route zelf weigert */ || PUBLIEK.includes(p) || p.startsWith('/api/rit-token/') || p.startsWith('/api/kv/');
const vul = (p) => p.replace(/:[a-zA-Z_]+/g, '1');
const TABELLEN = ['themas', 'locaties', 'kampmomenten', 'personeel', 'transport_ritten', 'transport_taken', 'bakken', 'vakantieperiodes', 'aanvragen', 'meldingen'];
const srv = await T.startServer({ poort: 3371 });
try {
  const A0 = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, A0, m, p, b);
  const pers = async (naam, rol, pin) => { const x = (await A('POST', '/api/personeel', { naam, rol })).json; await A('POST', `/api/personeel/${x.id}/pincode`, { pincode: pin }); return { id: x.id, tok: await T.login(srv.base, x.id, pin) }; };
  const ch = await pers('Rechten Chauffeur', 'chauffeur', '5821'), co = await pers('Rechten Coord', 'coordinator', '5822'), mo = await pers('Rechten Monitor', 'monitor', '5823');
  const routes = (await A('GET', '/api/_test/routes')).json;
  T.check(routes.length > 350, `${routes.length} routes uit app._router`);
  const api = routes.filter((r) => /^\/api\//i.test(r.pad) && !isPubliek(r.pad) && !r.pad.startsWith('/api/_test'));
  const tel = async () => { const u = {}; await new Promise((r) => setTimeout(r, 300)); for (const t of TABELLEN) u[t] = (await A('GET', '/api/_test/schrijfacties')).status && 0; return (await A('GET', '/api/_test/schrijfacties')).json.schrijfacties; };

  for (const [naam, rol, tok] of [['chauffeur', 'chauffeur', ch.tok], ['monitor', 'monitor', mo.tok]]) {
    const voor = await tel(); let open = [], binnen = 0;
    for (const r of api) {
      if (rolMag(rol, r.methode, vul(r.pad))) { binnen++; continue; }
      const x = await T.api(srv.base, tok, r.methode, vul(r.pad), r.methode === 'GET' ? undefined : {});
      if (x.status !== 403) open.push(`${r.methode} ${r.pad} → ${x.status}`);
    }
    T.check(open.length === 0, `${naam}: ${api.length - binnen} routes buiten de tabel allemaal 403${open.length ? ': ' + open.slice(0, 8).join(' | ') : ''}`);
    T.check((await tel()) === voor, `${naam}: geen enkele schrijfactie door de veeg`);
  }
  // Anoniem: alles 401, ook met hoofdletters en een slotstreep.
  { const voor = await tel(); let open = [];
    for (const r of api) { const x = await T.api(srv.base, null, r.methode, vul(r.pad), r.methode === 'GET' ? undefined : {}); if (x.status !== 401) open.push(`${r.methode} ${r.pad} → ${x.status}`); }
    T.check(open.length === 0, `anoniem: ${api.length} routes allemaal 401${open.length ? ': ' + open.slice(0, 8).join(' | ') : ''}`);
    T.check((await tel()) === voor, 'anoniem: geen enkele schrijfactie'); }
  for (const p of ['/API/personeel', '/Api/Themas', '/api/personeel/', '/API/backup/']) T.check((await T.api(srv.base, null, 'GET', p)).status === 401, `anoniem ${p} → 401 (poort volgt de hoofdletters en slotstreep van Express)`);
  T.check((await T.api(srv.base, ch.tok, 'DELETE', '/API/themas/1')).status === 403 && (await T.api(srv.base, ch.tok, 'DELETE', '/api/themas/1/')).status === 403, 'chauffeur DELETE /API/themas/1 en met slotstreep → 403');
  T.check((await T.api(srv.base, ch.tok, 'GET', '/api/bestaat-niet')).status === 403 && (await A('GET', '/api/bestaat-niet')).status === 404, 'onbekende API: chauffeur 403, kantoor JSON 404');
  T.check((await T.api(srv.base, null, 'GET', '/api/_test/routes')).status === 401, 'testhaak: anoniem 401');

  // G1 letterlijk: kerngegevens blijven staan.
  const th = (await A('GET', '/api/themas')).json[0], lo = (await A('GET', '/api/locaties')).json[0], km = (await A('GET', '/api/kampmomenten')).json[0];
  for (const [n, tok] of [['chauffeur', ch.tok], ['monitor', mo.tok]]) {
    T.check((await T.api(srv.base, tok, 'DELETE', '/api/themas/' + th.id)).status === 403 && (await T.api(srv.base, tok, 'DELETE', '/api/locaties/' + lo.id)).status === 403 && (await T.api(srv.base, tok, 'DELETE', '/api/kampmomenten/' + km.id)).status === 403 && (await T.api(srv.base, tok, 'PUT', '/api/locaties/' + lo.id, { name: 'GEHACKT' })).status === 403, `${n}: thema, locatie, kampmoment wissen en locatie hernoemen → 403`);
  }
  T.check((await A('GET', '/api/themas')).json.some((x) => x.id === th.id) && (await A('GET', '/api/locaties')).json.find((x) => x.id === lo.id).name === lo.name && (await A('GET', '/api/kampmomenten')).json.some((x) => x.id === km.id), 'database: thema, locatie (met oude naam) en kampmoment bestaan nog');

  // Flows per rol.
  for (const [n, tok, rol] of [['chauffeur', ch.tok, 'chauffeur'], ['monitor', mo.tok, 'monitor']]) {
    const w = await T.api(srv.base, tok, 'GET', '/api/wie-ben-ik'), v = await T.api(srv.base, tok, 'GET', '/api/vandaag?mijn=1'), m = await T.api(srv.base, tok, 'GET', '/api/meldingen');
    T.check(w.json.rol === rol && v.status === 200 && m.status === 200, `${n}: wie-ben-ik, eigen Vandaag en Meldingen werken`);
    T.check((await T.api(srv.base, tok, 'GET', '/api/vandaag')).status === 403, `${n}: kantoor-Vandaag (zonder mijn=1) → 403`);
    T.check((await T.api(srv.base, tok, 'POST', `/api/personeel/10/pincode`, { pincode: '5839' })).status === 403, `${n}: andermans pincode → 403`);
  }
  T.check((await T.api(srv.base, ch.tok, 'GET', '/api/aanvullijst?alles=1')).status === 200 && (await T.api(srv.base, co.tok, 'GET', '/api/aanvullijst?alles=1')).status === 200 && (await T.api(srv.base, mo.tok, 'GET', '/api/aanvullijst?alles=1')).status === 403, 'aanvullijst: chauffeur en coördinator ja, monitor nee');
  const mld = await T.api(srv.base, ch.tok, 'POST', '/api/aanvullijst/melding', { soort: 'weg', item_naam: 'Rechtentest hoepel', aantal: 1 });
  T.check(mld.status === 200, `chauffeur meldt in de stockage: ${mld.status} ${mld.status === 200 ? '' : mld.text.slice(0, 120)}`);
  T.check((await T.api(srv.base, co.tok, 'GET', '/api/tekorten-overzicht')).status === 200 && (await T.api(srv.base, co.tok, 'GET', '/api/voorraad')).status === 200 && (await T.api(srv.base, co.tok, 'GET', '/api/item-types')).status === 200, 'coördinator: Tekorten en de keuzes voor + Bestelling');
  T.check((await T.api(srv.base, ch.tok, 'GET', '/api/tekorten-overzicht')).status === 403 && (await T.api(srv.base, mo.tok, 'GET', '/api/voorraad')).status === 403, 'chauffeur geen Tekorten, monitor geen voorraad');
  T.check((await T.api(srv.base, ch.tok, 'POST', '/api/tekorten/melden', {})).status === 403, 'chauffeur: tekort melden blijft kantoor');
  // Rit rijden via de rit-link: geen sessie nodig.
  const rit = (await A('POST', '/api/ritten', { datum: '2026-11-02', personeel_id: ch.id })).json, rt = await T.ritToken(srv.base, A0, rit.id);
  T.check((await T.api(srv.base, null, 'GET', '/api/rit-token/' + rt + '/data')).status === 200 && (await T.api(srv.base, null, 'GET', '/api/rit-token/fout/data')).status >= 400, 'rit-link: eigen token werkt zonder login, fout token niet');
  // KV-link: alleen eigen data.
  const kms = (await A('GET', '/api/kampmomenten')).json.slice(0, 2), t1 = await T.kvToken(srv.base, A0, kms[0].id), t2 = await T.kvToken(srv.base, A0, kms[1].id, 'Test KV twee');
  const k1 = await T.api(srv.base, null, 'GET', '/api/kv/' + t1 + '/data'), k2 = await T.api(srv.base, null, 'GET', '/api/kv/' + t2 + '/data');
  T.check(k1.status === 200 && k2.status === 200 && JSON.stringify(k1.json) !== JSON.stringify(k2.json), 'KV-link: twee tokens geven elk hun eigen data');
  T.check((await T.api(srv.base, null, 'GET', '/api/kv/fout-token/data')).status === 403 && (await T.api(srv.base, t1, 'GET', '/api/personeel')).status === 401, 'KV: vreemd token 403, KV-token op een kantoor-API 401');
  // Kantoor verandert niet.
  T.check((await A('GET', '/api/vandaag')).status === 200 && (await A('GET', '/api/personeel')).status === 200 && (await A('GET', '/api/ritplanning')).status === 200, 'kantoor: Vandaag, personeel en ritplanning ongewijzigd');
  // Pure regels.
  T.check(ROL_ROUTES.every((r) => r[3] && r[3].length > 5), `tabel: ${ROL_ROUTES.length} regels, elk met een reden`);
  T.check(ROL_ROUTES.every((r) => !(/^(PUT|DELETE)$/.test(r[0]) && r[2].includes('monitor'))) && ROL_ROUTES.filter((r) => r[2].includes('monitor') && r[0] === 'POST').every((r) => /pincode|logout|gelezen|push.(in|uit)schrijven/.test(r[1])), 'monitor schrijft alleen eigen pincode, uitloggen en gelezen');
  T.check(['0000', '1111', '1234', '4321', '1212', '9876'].every(zwakkePin) && !['2468', '1357', '5821', '3334'].some(zwakkePin), 'zwakke pincodes herkend, gewone niet');
} catch (e) { T.fout('uitzondering: ' + e.message); console.log(srv.log().slice(-1500)); }
await T.einde(srv);
