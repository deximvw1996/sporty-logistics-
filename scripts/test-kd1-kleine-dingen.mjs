// test-kd1-kleine-dingen.mjs — KD1 (chat D): Vandaag toont "Volgende week" als deze week leeg is (werklijst 96);
// Nakijken toont ook bakken zonder telling als "nog niet geteld" (werklijst 73). Eigen server via _testhulp (poort 3351).
import * as T from './_testhulp.mjs';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: parseInt(process.env.TEST_POORT || '3351') });
const lees = (p) => fs.readFileSync(T.ROOT + '/' + p, 'utf8');
const plus = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const P = (m, p, b) => T.api(srv.base, null, m, p, b);

  // ── Punt 1: Vandaag ──
  const per = (await A('GET', '/api/periodes')).json;
  const actief = (Array.isArray(per) ? per : per.periodes || []).find((p) => p.actief) || (Array.isArray(per) ? per[0] : null);
  T.check(!!actief && !!actief.start_datum, `actieve periode gevonden (start ${actief && actief.start_datum})`);
  const S = actief.start_datum;
  let v = (await A('GET', `/api/vandaag?datum=${plus(S, -4)}`)).json;
  T.check(v.deze_week.length === 0 && v.volgende_week.length > 0 && v.week_label === 'Volgende week', `donderdag vóór de kampweek: deze_week ${v.deze_week.length}, volgende_week ${v.volgende_week.length}, label "${v.week_label}"`);
  T.check(v.cijfers.locaties_open === 0, 'cijfers.locaties_open blijft "deze week" (0)');
  const vorm = v.volgende_week[0];
  T.check(vorm.kampmoment_id && vorm.locatie && 'dagen' in vorm && Array.isArray(vorm.markeringen), 'volgende_week heeft dezelfde vorm als deze_week');
  v = (await A('GET', `/api/vandaag?datum=${plus(S, 1)}`)).json;
  T.check(v.deze_week.length > 0 && v.week_label === 'Deze week', `in de kampweek: label "${v.week_label}", ${v.deze_week.length} locaties`);
  v = (await A('GET', `/api/vandaag?datum=${plus(S, -40)}`)).json;
  T.check(v.week_label === 'Deze week' && v.volgende_week.length === 0, 'ver vóór de periode: "Deze week", geen volgende week');
  const js = lees('public/vandaag.js');
  T.check(/week_labels*===s*'Volgende week'/.test(js) && /t-week/.test(js) && /id="t-week"/.test(lees('public/vandaag.html')), 'client: kop en lijst volgen week_label');

  // ── Punt 2: Nakijken ──
  const km = ijk.kampmomenten.abdijschool, thema = ijk.themas.alles_op_wieltjes;
  const ids = [];
  for (const code of ['KD01', 'KD02', 'KD03']) {
    const b = (await A('POST', `/api/themas/${thema}/bakken`, { label: 'Kd bak ' + code, code })).json;
    await A('POST', `/api/bakken/${b.id}/items`, { naam: 'Kegel ' + code, qty: 3 });
    ids.push(b.id);
  }
  await A('POST', `/api/kampmomenten/${km}/themas`, { thema_id: thema });
  const kvtok = await T.kvToken(srv.base, tok, km);
  const kv = (m, p, b) => P(m, `/api/kv/${kvtok}${p}`, b);
  const d0 = (await kv('GET', '/data')).json; const kb = (c) => d0.bakken.find((b) => b.code === c);
  await kv('POST', `/bakken/${kb('KD01').id}/tellen`, { regels: [{ item_id: kb('KD01').items[0].id, aangetroffen: 3 }] });
  await kv('POST', '/versturen', {});
  let r = await A('GET', '/api/nakijken');
  const eigen = r.json.bakken.filter((b) => b.kampmoment_id === km && ['KD01', 'KD02', 'KD03'].includes(b.bak.code));
  T.check(eigen.length === 3 && eigen.filter((b) => b.status === 'nog_niet').length === 2, `3 rijen, waarvan 2 nog_niet (${eigen.map((b) => b.bak.code + ':' + b.status).join(', ')})`);
  const geteld = eigen.find((b) => b.bak.code === 'KD01');
  T.check(geteld.status !== 'nog_niet' && !!geteld.sessie_id, `de getelde bak heeft een sessie en status ${geteld.status}`);
  const nn = eigen.find((b) => b.bak.code === 'KD02');
  T.check(nn.sessie_id === null && nn.uitslag_tekst === 'nog niet geteld' && nn.geteld === 0 && nn.totaal === 1, 'nog_niet-rij: geen sessie, uitslag "nog niet geteld", 0 geteld');
  const allNn = r.json.bakken.filter((b) => b.status === 'nog_niet').length;
  T.check(r.json.tellers.nog_niet === allNn && allNn >= 2, `tellers.nog_niet klopt (${r.json.tellers.nog_niet} = ${allNn})`);

  const NK = require(T.ROOT + '/public/nakijken.js');
  const st = { filter: 'alle', zoek: '', geselecteerd: new Set(), open: null, tab: 'telling' };
  const lh = NK.lijstHtml(r.json, st);
  T.check(lh.includes('data-a="nog_niet">Nog niet geteld ' + r.json.tellers.nog_niet) && lh.includes('data-a="niet_geteld"'), 'chip "Nog niet geteld" naast de bestaande chips');
  T.check(/nog-niet[^>]*opacity:\.55/.test(lh) && lh.includes('nog niet geteld · KV'), 'rij is grijs met "nog niet geteld · <KV-naam>"');
  const gefilterd = NK.zichtbaar(r.json, { ...st, filter: 'nog_niet' });
  T.check(gefilterd.length === allNn && gefilterd.every((b) => b.status === 'nog_niet'), 'filter "nog_niet" toont enkel die rijen');
  r = await A('GET', `/api/nakijken/bak?kampmoment_id=${km}&bak=${nn.bak.soort}:${nn.bak.id}`);
  T.check(r.status === 200 && r.json.status === 'nog_niet' && r.json.items.length === 1 && r.json.items[0].verwacht === 3, 'detail van een nog_niet-bak geeft de verwachte inhoud (3 stuks)');
  const dh = NK.detailHtml(r.json, { tab: 'telling' });
  T.check(dh.includes('De KV heeft deze bak nog niet geteld') && !dh.includes('data-act="afronden"') && !dh.includes('<select') && !dh.includes('data-act="binnen"'), 'detail: hint aanwezig, geen keuren-knop, geen actiekeuze');
  T.check(dh.includes('Kegel KD02') || dh.includes('Kegel'), 'detail toont het verwachte stuk');
} catch (e) {
  T.fout('test crashte: ' + (e.stack || e));
}
await T.einde(srv);
