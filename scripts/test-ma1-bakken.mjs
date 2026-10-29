// test-ma1-bakken.mjs — MA1 (chat C): Materiaal › Bakken. Rek/plank per bak (migratie 79, PUT, aanvullijst),
// GET /api/bakken-overzicht (tellers, waar nu, stand), GET /api/bakken/:id/detail (inhoud, waar geweest, tellingen,
// historiek), verwijderen met 409, de pagina /bakken. Eigen server via _testhulp (poort 3337, herfst-test.db).
import * as T from './_testhulp.mjs';
const POORT = parseInt(process.env.TEST_POORT || '3337');
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: POORT });
const BASIC = 'Basic ' + Buffer.from('sporty:' + T.APP_PASSWORD).toString('base64');
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const P = (m, p, b) => T.api(srv.base, null, m, p, b);
  const R = ijk.locaties.rozenweg, AB = ijk.locaties.abdijschool, kmAB = ijk.kampmomenten.abdijschool;
  const ov = async () => (await A('GET', '/api/bakken-overzicht')).json;
  const rij = (o, code) => o.bakken.find((b) => b.code === code);

  // ── overzicht: tellers per soort ──
  let o = await ov();
  const t = o.tellers;
  T.check(t.alle === o.bakken.length && t.thema === o.bakken.filter((b) => b.soort === 'thema').length && t.attribuut === o.bakken.filter((b) => b.soort === 'attribuut').length
    && t.vast === o.bakken.filter((b) => b.soort === 'vast' || b.soort === 'pool').length && t.thema + t.vast + t.attribuut === t.alle, `tellers ${JSON.stringify({ alle: t.alle, thema: t.thema, vast: t.vast, attribuut: t.attribuut, onderweg: t.onderweg, incompleet: t.incompleet })}`);
  const n20 = rij(o, 'N20'), n21 = o.bakken.find((b) => b.soort === 'thema' && /^N\d/.test(b.code) && b.code !== 'N20');
  T.check(n20 && n20.rek === 'N' && n20.thuis_locatie_id === R, `migratie 79: N20 kreeg rek "${n20?.rek}" uit de code, thuis Rozenweg`);
  T.check(n20.inhoud_tekst === '3 soorten · 40 stuks' && n20.thema?.naam && n20.stand_tekst === 'niet geteld', `N20: ${n20.thema?.naam} · ${n20.inhoud_tekst} · ${n20.stand_tekst}`);
  T.check(o.bakken.some((b) => b.soort === 'attribuut' && b.inhoud_tekst === '1') && o.bakken.some((b) => b.soort === 'pool' && /stuks$/.test(b.inhoud_tekst)), 'attribuut "1", pool "N stuks"');

  // ── rek/plank: PUT (kantoor, gelogd) ──
  let r = await A('PUT', `/api/bakken/${n21.id}`, { rek: 'n', plank: '2' });
  T.check(r.status === 200 && r.json.rek === 'N' && r.json.plank === '2', `PUT rek/plank → ${r.json.rek} / ${r.json.plank}`);
  o = await ov();
  T.check(rij(o, n21.code).waar_nu_tekst === 'Rozenweg · rek N plank 2', `bak thuis: "${rij(o, n21.code).waar_nu_tekst}"`);
  let d = (await A('GET', `/api/bakken/${n21.id}/detail`)).json;
  T.check(d.historiek.some((h) => /rek: N → N|plank: — → 2|plank/.test(h.wat)) && d.waar.thuis_tekst === 'Rozenweg · rek N · plank 2', `gelogd in historiek ("${d.historiek[0]?.wat}"), thuis "${d.waar.thuis_tekst}"`);
  r = await A('PUT', `/api/bakken/${n21.id}`, { thuis_locatie_id: AB });
  T.check(r.status === 400, 'thuis op een kamplocatie → 400');

  // ── bak op een rit → onderweg, verwijderen 409, lossen → locatie wk ──
  await A('POST', `/api/kampmomenten/${kmAB}/themas`, { thema_id: n20.thema.id });
  const taak = (await A('POST', '/api/transport-taken', { type: 'levering', datum: '2026-11-02', tijd: '08:00', van_locatie_id: R, naar_locatie_id: AB, kampmoment_id: kmAB, regels: [{ naam: `Bak ${n20.naam} (N20)`, qty: 1, soort: 'thema', bak_id: n20.id }] })).json.id;
  const rit = (await A('POST', '/api/ritten', { datum: '2026-11-02', personeel_id: 2, voertuig: 'Camionette', taak_ids: [taak] })).json.id;
  const rtok = await T.ritToken(srv.base, tok, rit);
  const check = (await P('GET', `/api/rit-token/${rtok}/data`)).json.stops[0].regels[0].check_id;
  await T.ritActie(srv.base, rtok, check, 'laden');
  o = await ov();
  T.check(rij(o, 'N20').waar_nu_tekst === `onderweg rit #${rit}` && rij(o, 'N20').waar_nu.rit_id === rit && o.tellers.onderweg === 1, `bak op een rit: "${rij(o, 'N20').waar_nu_tekst}", teller onderweg ${o.tellers.onderweg}`);
  r = await A('DELETE', `/api/bakken-overzicht/${n20.id}`);
  T.check(r.status === 409 && /onderweg/.test(r.json.error), `verwijderen van een bak onderweg → 409 "${r.json.error}"`);
  await P('POST', `/api/rit-token/${rtok}/taken/${taak}/aangekomen`);
  await T.ritActie(srv.base, rtok, check, 'lossen');
  o = await ov();
  T.check(rij(o, 'N20').waar_nu_tekst === 'Abdijschool Vlierbeek wk 1', `bak gelost: "${rij(o, 'N20').waar_nu_tekst}"`);

  // ── KV-telling met tekort → stand ──
  const kvtok = await T.kvToken(srv.base, tok, kmAB);
  const kb = (await P('GET', `/api/kv/${kvtok}/data`)).json.bakken.find((b) => b.code === 'N20');
  r = await P('POST', `/api/kv/${kvtok}/bakken/${kb.id}/tellen`, { regels: kb.items.map((it, i) => ({ item_id: it.id, aangetroffen: i === 0 ? it.gewenst - 1 : it.gewenst })) });
  await P('POST', `/api/kv/${kvtok}/versturen`);
  o = await ov();
  T.check(r.status === 200 && rij(o, 'N20').stand_tekst === 'tekort 1' && rij(o, 'N20').status === 'let' && rij(o, 'N20').incompleet, `stand na KV-telling: "${rij(o, 'N20').stand_tekst}" (status ${rij(o, 'N20').status})`);
  r = await A('DELETE', `/api/bakken-overzicht/${n20.id}`);
  T.check(r.status === 409 && /open telling/.test(r.json.error), `verwijderen met open telling → 409 "${r.json.error}"`);

  // ── aanvullijst gebruikt rek/plank ──
  await A('PUT', `/api/bakken/${n20.id}`, { plank: '3' });
  const nk = (await A('GET', '/api/nakijken?week=2026-11-02')).json.bakken.find((b) => b.bak.code === 'N20' && b.kampmoment_id === kmAB);
  await A('POST', '/api/nakijken/afronden', { sessie_ids: [nk.sessie_id] });
  const al = (await A('GET', '/api/aanvullijst?alles=1')).json.bakken.find((g) => g.bak.code === 'N20');
  T.check(al && al.plaats.rek === 'N' && al.plaats.plank === '3' && al.plaats.tekst === 'rek N · plank 3', `aanvullijst N20: plaats "${al?.plaats.tekst}"`);

  // ── detail ──
  d = (await A('GET', `/api/bakken/${n20.id}/detail`)).json;
  T.check(d.inhoud.length === 3 && d.inhoud[0].stand_tekst.startsWith('tekort 1') && d.inhoud[1].stand_tekst === 'ok', `inhoud: ${d.inhoud.map((i) => `${i.naam} ×${i.qty} (${i.stand_tekst})`).join(' | ')}`);
  T.check(d.waar_geweest.length >= 2 && d.waar_geweest.some((w) => w.actie === 'geladen' && w.locatie === 'Rozenweg') && d.waar_geweest.some((w) => w.actie === 'gelost' && w.locatie === 'Abdijschool Vlierbeek'), `waar geweest: ${d.waar_geweest.map((w) => `${w.actie} ${w.locatie} rit #${w.rit_id}`).join(' | ')}`);
  T.check(d.tellingen.length === 1 && d.tellingen[0].uitslag.startsWith('tekort 1'), `tellingen: ${d.tellingen.map((x) => x.uitslag + ' · ' + x.kv).join(' | ')}`);
  T.check(d.historiek.length >= 2 && d.waar.nu_tekst === 'Abdijschool Vlierbeek wk 1' && d.waar.nu_rit_id === rit, `historiek ${d.historiek.length} regels; nu "${d.waar.nu_tekst}" door ${d.waar.nu_door}`);
  const ophaal = (await A('POST', '/api/transport-taken', { type: 'ophaling', datum: '2026-11-06', van_locatie_id: AB, naar_locatie_id: R, kampmoment_id: kmAB, regels: [{ naam: 'Bak N20', qty: 1, soort: 'thema', bak_id: n20.id }] })).json.id;
  d = (await A('GET', `/api/bakken/${n20.id}/detail`)).json;
  T.check(/^ophaling vr 6 nov · nog geen rit$/.test(d.waar.terug_tekst), `terug: "${d.waar.terug_tekst}" (taak #${ophaal})`);
  const attr = o.bakken.find((b) => b.soort === 'attribuut');
  r = await A('GET', `/api/bakken/${attr.id}/detail?soort=attribuut`);
  T.check(r.status === 200 && r.json.bak.soort === 'attribuut' && r.json.inhoud.length === 0, `detail attribuut ${attr.code || attr.naam} → 200`);
  r = await A('GET', '/api/bakken/99999999/detail');
  T.check(r.status === 404, 'onbekende bak → 404');

  // ── niet-kantoor ──
  await A('POST', '/api/personeel/13/pincode', { pincode: '4321' });
  const tokCh = await T.login(srv.base, 13, '4321');
  const r1 = await T.api(srv.base, tokCh, 'GET', '/api/bakken-overzicht');
  const r2 = await T.api(srv.base, tokCh, 'GET', `/api/bakken/${n20.id}/detail`);
  const r3 = await T.api(srv.base, tokCh, 'PUT', `/api/bakken/${n21.id}`, { rek: 'Z' });
  const r4 = await T.api(srv.base, tokCh, 'DELETE', `/api/bakken-overzicht/${n21.id}`);
  T.check(r1.status === 403 && r2.status === 403 && r3.status === 403 && r4.status === 403, `chauffeur → overzicht ${r1.status}, detail ${r2.status}, rek ${r3.status}, verwijderen ${r4.status}`);

  // ── verwijderen zonder blokkade ──
  const nieuw = (await A('POST', '/api/vaste-bakken', { naam: 'MA1 testbak', code: 'MA1' })).json.id;
  r = await A('DELETE', `/api/bakken-overzicht/${nieuw}`);
  T.check(r.status === 200 && !rij(await ov(), 'MA1'), 'losse bak zonder rit of telling → verwijderd');

  // ── pagina's ──
  const html = await (await fetch(srv.base + '/bakken', { headers: { authorization: BASIC } })).text();
  const chips = (html.match(/class="chip[ "]/g) || []).length;
  T.check(html.includes('class="sub"') && html.includes('>Thema\'s<') && html.includes('>Catalogus<') && html.includes('class="voet') && html.includes('/public/patroon.css') && chips === 7, `GET /bakken: subbalk, ${chips} chips, voet, patroon.css`);
  const et = await fetch(srv.base + '/etiketten?ids=b' + n20.id, { headers: { authorization: BASIC } });
  T.check(et.status === 200 && (await et.text()).includes('window.print'), 'GET /etiketten → 200 (printbaar)');
} catch (e) { T.fout('onverwachte fout: ' + (e.stack || e)); }
await T.einde(srv);
