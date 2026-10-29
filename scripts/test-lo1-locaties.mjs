// test-lo1-locaties.mjs — LO1 (chat C): Locaties op het patroon. Tellers, periode_tekst (week · KV per kampmoment),
// aandacht, detail (kampmomenten, historiek), PUT wifi/gemeente gelogd, foto's, verwijderen met 409, contact-mail,
// de pagina /locaties, en de HTML-bouwers van public/locaties.js met de echte data-JSON (DOM-dump zonder browser).
// Eigen server via _testhulp (poort 3339, herfst-test.db).
import * as T from './_testhulp.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const POORT = parseInt(process.env.TEST_POORT || '3339');
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: POORT });
const BASIC = 'Basic ' + Buffer.from('sporty:' + T.APP_PASSWORD).toString('base64');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const tekst = (h) => h.replace(/<[^>]+>/g, '\n').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\n\s*\n+/g, '\n').trim().split('\n').join(' | ');
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const AB = ijk.locaties.abdijschool, BE = ijk.locaties.betekom, R = ijk.locaties.rozenweg, kmAB = ijk.kampmomenten.abdijschool;
  const ov = async () => (await A('GET', '/api/locaties-overzicht')).json;

  // ── overzicht ──
  let o = await ov();
  const t = o.tellers, loc = (id) => o.locaties.find((l) => l.id === id);
  T.check(t.alle === o.locaties.length && t.kamp === o.locaties.filter((l) => l.type === 'kamp').length && t.stockage === o.locaties.filter((l) => l.type === 'stockage').length
    && t.let_op === o.locaties.filter((l) => l.status === 'let').length && t.deze_periode === o.locaties.filter((l) => l.periode.length).length, `tellers ${JSON.stringify(t)}`);
  T.check(loc(AB).periode_tekst === 'wk 1 Test KV Abdijschool' && loc(AB).periode[0].kampmoment_id === kmAB && 'loopt_nu' in loc(AB).periode[0], `periode_tekst Abdijschool: "${loc(AB).periode_tekst}"`);
  T.check(loc(R).periode_tekst === '—' && loc(R).type === 'stockage', `stockage: "${loc(R).periode_tekst}"`);
  T.check(loc(AB).gemeente !== undefined && o.locaties.some((l) => l.gemeente), `migratie 82: gemeente uit het adres (bv. ${o.locaties.find((l) => l.gemeente)?.naam}: ${o.locaties.find((l) => l.gemeente)?.gemeente})`);
  T.check(loc(AB).status === 'let' && loc(AB).aandacht.some((a) => /contact|sleutel/.test(a)), `aandacht zonder contact: ${loc(AB).aandacht.join(' · ')}`);

  // ── PUT met wifi/gemeente + contact → gelogd, aandacht weg ──
  const cur = (await A('GET', '/api/locaties')).json.find((l) => l.id === AB);
  let r = await A('PUT', `/api/locaties/${AB}`, { ...cur, contact_naam: 'Conciërge Jan <jan@abdij.be>', contact_telefoon: '0470 11 22 33', sleutel_info: 'bij de buren nr. 12', wifi: 'Sporty-gast / zomer2026', gemeente: 'Kessel-Lo', heeft_eigen_sportmateriaal: true, addr: cur.addr || 'Molenstraat 90, 3010 Kessel-Lo' });
  T.check(r.status === 200 && r.json.wifi === 'Sporty-gast / zomer2026' && r.json.gemeente === 'Kessel-Lo', 'PUT met wifi en gemeente bewaard');
  o = await ov();
  T.check(loc(AB).aandacht.every((a) => !/contact|sleutel/.test(a)) && loc(AB).gemeente === 'Kessel-Lo', `aandacht na contact + sleutel: [${loc(AB).aandacht.join(' · ')}]`);
  const wz = (await A('GET', '/api/wijzigingen?tabel=locaties&rij_id=' + AB)).json;
  T.check(wz.length >= 1 && wz[0].nieuw.wifi === 'Sporty-gast / zomer2026' && wz[0].oud.wifi === '', 'PUT staat in wijzigingen (oud/nieuw wifi)');

  // ── foto's ──
  r = await A('POST', `/api/locaties/${AB}/foto`, { foto_data: PNG, beschrijving: 'ingang' });
  const foto = r.json.id;
  T.check(r.status === 200 && /^\/uploads\//.test(r.json.url), `foto toegevoegd (${r.json.url})`);
  const f2 = (await A('POST', `/api/locaties/${AB}/foto`, { foto_data: PNG, beschrijving: 'berging' })).json.id;
  r = await A('DELETE', `/api/locaties/${AB}/foto/${f2}`);
  T.check(r.status === 200, 'tweede foto verwijderd');

  // ── detail ──
  let d = (await A('GET', `/api/locaties/${AB}/detail`)).json;
  T.check(d.contact.telefoon === '0470 11 22 33' && d.sleutel_info && d.wifi && d.ter_plaatse.eigen_sportmateriaal === true && d.ter_plaatse.eigen_oven === false, `detail contact & toegang: ${d.contact.naam} · ${d.contact.telefoon} · ${d.wifi}`);
  T.check(d.fotos.length === 1 && d.fotos[0].beschrijving === 'ingang', `foto's: ${d.fotos.map((f) => f.beschrijving).join(', ')}`);
  T.check(d.kampmomenten.length >= 1 && d.kampmomenten[0].kampmoment_id === kmAB && d.kampmomenten[0].periode && d.kampmomenten[0].transport, `kampmomenten: ${d.kampmomenten.map((k) => `${k.periode} wk ${k.week} · KV ${k.kv_naam} · ${k.transport}`).join(' | ')}`);
  T.check(d.historiek.some((h) => /wifi: — → Sporty-gast/.test(h.wat)) && d.historiek.some((h) => /foto toegevoegd \(ingang\)/.test(h.wat)) && d.historiek.some((h) => /foto verwijderd \(berging\)/.test(h.wat)), `historiek: ${d.historiek.slice(0, 4).map((h) => h.wat.slice(0, 60)).join(' | ')}`);

  // ── verwijderen ──
  r = await A('DELETE', `/api/locaties-overzicht/${AB}`);
  T.check(r.status === 409 && /kampmoment/.test(r.json.error), `verwijderen met kampmomenten → 409 "${r.json.error}"`);
  r = await A('DELETE', `/api/locaties-overzicht/${R}`);
  T.check(r.status === 409 && /bak/.test(r.json.error), `stockage met bakken → 409 "${r.json.error}"`);
  const nieuw = (await A('POST', '/api/locaties', { name: 'LO1 testlocatie', type: 'kamp', addr: 'Teststraat 1, 3000 Leuven' })).json.id;
  r = await A('DELETE', `/api/locaties-overzicht/${nieuw}`);
  T.check(r.status === 200 && !(await ov()).locaties.some((l) => l.id === nieuw), 'lege locatie → verwijderd');

  // ── contact-mail ──
  r = await A('POST', '/api/locaties/contact-mail', { ids: [AB, BE] });
  T.check(r.status === 200 && r.json.mails.some((m) => m.id === AB && m.mailto.startsWith('mailto:jan@abdij.be')) && r.json.zonder.some((z) => z.id === BE), `contact-mail: ${r.json.mails.map((m) => m.mailto).join(', ')} · zonder: ${r.json.zonder.map((z) => z.naam).join(', ')}`);

  // ── niet-kantoor ──
  await A('POST', '/api/personeel/13/pincode', { pincode: '4321' });
  const tokCh = await T.login(srv.base, 13, '4321');
  const rs = await Promise.all([['GET', '/api/locaties-overzicht'], ['GET', `/api/locaties/${AB}/detail`], ['POST', `/api/locaties/${AB}/foto`, { foto_data: PNG }], ['DELETE', `/api/locaties-overzicht/${nieuw}`], ['POST', '/api/locaties/contact-mail', { ids: [AB] }]].map(([m, p, b]) => T.api(srv.base, tokCh, m, p, b)));
  T.check(rs.every((x) => x.status === 403), `chauffeur → ${rs.map((x) => x.status).join('/')}`);

  // ── pagina ──
  const html = await (await fetch(srv.base + '/locaties', { headers: { authorization: BASIC } })).text();
  const chips = (html.match(/class="chip[ "]/g) || []).length;
  T.check(html.includes('class="sub"') && html.includes('>Kaart<') && html.includes('>Contacten<') && html.includes('class="voet') && html.includes('/public/patroon.css') && chips === 5, `GET /locaties: subbalk, ${chips} chips, voet`);

  // ── DOM-bouw met de echte data-JSON ──
  const BOUW = require(T.ROOT + '/public/locaties.js');
  o = await ov(); d = (await A('GET', `/api/locaties/${AB}/detail`)).json;
  const rijAB = BOUW.rij(loc(AB), { sel: true, act: true }), rijR = BOUW.rij(loc(R), {}), rijC = BOUW.rij(loc(AB), { contacten: true });
  T.info('DOM rij Abdijschool: ' + tekst(rijAB));
  T.info('DOM rij Rozenweg:    ' + tekst(rijR));
  T.info('DOM rij contacten:   ' + tekst(rijC));
  T.check(/class="r act"/.test(rijAB) && /checked/.test(rijAB) && tekst(rijAB).includes('Abdijschool Vlierbeek | kamp | Kessel-Lo | wk 1 Test KV Abdijschool') && tekst(rijR).includes('Rozenweg | stockage') && tekst(rijR).includes('| — |'), 'lijstrijen: naam · type · gemeente · week+KV (stockage —) · stand');
  T.check(tekst(rijC).includes('Conciërge Jan <jan@abdij.be> · 0470 11 22 33'), 'contacten-weergave: telefoon i.p.v. periode');
  const det = BOUW.detail(d, 'gegevens');
  T.info('DOM detail: ' + tekst(det).slice(0, 700));
  T.check(['Bewerken', '📍 Kaart', 'Rit plannen', 'Gegevens', "Foto's 1", 'Kampmomenten', 'Historiek', 'Contact & toegang', 'Sleutel', 'Wifi', 'Ter plaatse', '+ foto', '↶ Terug'].every((s) => tekst(det).includes(s)) && det.includes(`/kampmomenten?id=${kmAB}`), 'detail: kop + 3 knoppen, 4 tabs, contact & toegang, foto\'s met + foto, kampmomenten met Open, historiek met ↶ Terug');
  T.check(tekst(BOUW.detail(d, 'fotos')).includes('ingang') && !tekst(BOUW.detail(d, 'fotos')).includes('Contact & toegang'), 'tab Foto\'s toont enkel de foto\'s');
} catch (e) { T.fout('onverwachte fout: ' + (e.stack || e)); }
await T.einde(srv);
