// test-bh1-personeel.mjs — BH1 (chat C): Beheer › Personeel + Logboek. Overzicht (tellers per rol, zonder pincode),
// detail (rechten, inzet, logboek), velden/rol/pincode-reset/(de)activeren/uitnodiging, eerste pincode per persoon,
// /api/logboek met filters, de pagina's. Eigen server via _testhulp (poort 3338, herfst-test.db).
import * as T from './_testhulp.mjs';
const POORT = parseInt(process.env.TEST_POORT || '3338');
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: POORT });
const BASIC = 'Basic ' + Buffer.from('sporty:' + T.APP_PASSWORD).toString('base64');
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const P = (m, p, b) => T.api(srv.base, null, m, p, b);
  const R = ijk.locaties.rozenweg, AB = ijk.locaties.abdijschool, kmAB = ijk.kampmomenten.abdijschool;
  const ov = async () => (await A('GET', '/api/personeel-overzicht')).json;

  // ── overzicht ──
  let o = await ov();
  const tl = o.tellers, g = (r) => o.personeel.filter((p) => p.rol_groep === r).length;
  T.check(tl.alle === o.personeel.length && tl.kantoor === g('kantoor') && tl.chauffeur === g('chauffeur') && tl.coordinator === g('coordinator') && tl.monitor === g('monitor')
    && tl.zonder_pincode === o.personeel.filter((p) => p.stand === 'geen_pincode').length, `tellers ${JSON.stringify(tl)}`);
  const ik = o.personeel.find((p) => p.id === 10);
  T.check(ik && /^vandaag \d\d:\d\d$/.test(ik.laatst_actief_tekst) && ik.stand === 'actief', `Claude (API) laatst actief "${ik?.laatst_actief_tekst}" (gezet bij login), stand ${ik?.stand}`);

  // ── nieuwe coördinator klaarzetten ──
  let r = await A('POST', '/api/personeel', { naam: 'Lotte BH1', rol: 'coordinator', telefoon: '0475 12 34 56', email: 'lotte@x.be' });
  const lotte = r.json.id;
  o = await ov();
  const lo = o.personeel.find((p) => p.id === lotte);
  T.check(lo.rol_groep === 'coordinator' && lo.stand === 'geen_pincode' && o.tellers.zonder_pincode === tl.zonder_pincode + 1, `nieuwe coördinator: stand ${lo.stand}, zonder pincode ${o.tellers.zonder_pincode}`);
  r = await A('PUT', `/api/personeel/${lotte}/velden`, { rijbewijs: 'B', eigen_wagen_capaciteit: 6, meldingen_aan: true, telefoon: '0475 12 34 57' });
  T.check(r.status === 200 && r.json.rijbewijs === 'B' && r.json.eigen_wagen_capaciteit === 6 && !('pincode' in r.json), 'velden bewaard (rijbewijs, eigen wagen 6, telefoon), geen pincode-hash in het antwoord');
  r = await A('PUT', `/api/personeel/${lotte}/velden`, { eigen_wagen_capaciteit: -2 });
  T.check(r.status === 400, 'negatieve capaciteit → 400');

  // ── inzet: KV-koppeling + rit als bestuurder ──
  await A('PUT', `/api/kampmomenten/${kmAB}`, { kv_persoon_id: lotte });
  const taak = (await A('POST', '/api/transport-taken', { type: 'levering', datum: '2026-11-04', tijd: '09:00', van_locatie_id: R, naar_locatie_id: AB, kampmoment_id: kmAB, regels: [] })).json.id;
  const rit = (await A('POST', '/api/ritten', { datum: '2026-11-04', personeel_id: lotte, voertuig: 'Eigen wagen', voertuig_soort: 'eigen', voertuig_capaciteit: 6, taak_ids: [taak] })).json.id;
  let d = (await A('GET', `/api/personeel/${lotte}/detail`)).json;
  T.check(d.rechten.length >= 3 && d.rechten.some((x) => /ritten rijden/.test(x)), `rechten coördinator: ${d.rechten.join(' · ')}`);
  T.check(d.inzet.some((i) => i.soort === 'kv' && /Abdijschool Vlierbeek · wk 1/.test(i.titel)) && d.inzet.some((i) => i.soort === 'rit' && i.rit_id === rit && /coördinator rijdt mee/.test(i.sub)), `inzet: ${d.inzet.map((i) => i.titel + ' (' + i.sub + ')').join(' | ')}`);
  T.check(d.rijbewijs === 'B' && d.eigen_wagen_capaciteit === 6 && d.pincode.gezet === false && d.meldingen_aan === true, 'detail: rijbewijs, eigen wagen, pincode niet gezet, meldingen aan');
  T.check(d.logboek.length >= 1 && d.logboek.some((l) => /rijbewijs/.test(l.wat)) && d.logboek.every((l) => 'wijziging_id' in l), `logboek op naam: ${d.logboek.slice(0, 3).map((l) => l.wat).join(' | ')}`);

  // ── uitnodiging + eerste pincode per persoon ──
  r = await P('POST', '/api/eerste-pincode', { persoon_id: lotte, pincode: '2468' });
  T.check(r.status === 403, `eerste pincode zonder uitnodiging → ${r.status}`);
  r = await A('POST', '/api/personeel/uitnodiging', { ids: [lotte, ijk.personen?.kv || 14] });
  const u = r.json.uitnodigingen.find((x) => x.id === lotte);
  T.check(r.status === 200 && u && /kies je pincode bij de eerste keer/.test(u.instructie) && u.instructie.includes(r.json.adres), `uitnodiging: "${u?.instructie}"`);
  T.check(r.json.fouten.some((f) => /KV-link/.test(f.reden)), `KV-rol krijgt geen uitnodiging: ${r.json.fouten.map((f) => f.reden).join('; ')}`);
  T.check((await ov()).personeel.find((p) => p.id === lotte).uitnodiging_op !== '', 'uitnodiging_op gezet');
  const lijst = (await P('GET', '/api/personeel-lijst-login')).json;
  T.check(lijst.some((p) => p.id === lotte && p.heeft_pincode === 0), 'coördinator staat in de loginlijst (zonder pincode)');
  r = await P('POST', '/api/eerste-pincode', { persoon_id: lotte, pincode: '2468' });
  T.check(r.status === 200, 'eerste pincode gekozen na uitnodiging');
  r = await P('POST', '/api/eerste-pincode', { persoon_id: lotte, pincode: '9999' });
  T.check(r.status === 409, 'tweede keer "eerste pincode" → 409');
  const tokL = await T.login(srv.base, lotte, '2468');
  T.check(!!tokL, 'Lotte logt in met haar pincode');
  d = (await A('GET', `/api/personeel/${lotte}/detail`)).json;
  T.check(d.pincode.gezet && d.pincode.gewijzigd_op && d.persoon.stand === 'actief', `pincode gezet, gewijzigd ${d.pincode.gewijzigd_tekst}`);

  // ── pincode-reset ──
  r = await A('POST', `/api/personeel/${lotte}/pincode-reset`);
  T.check(r.status === 200 && r.json.heeft_pincode === false, 'pincode-reset → gewist');
  r = await T.api(srv.base, tokL, 'GET', '/api/periodes');
  T.check(r.status === 401, `oude sessie van Lotte na reset → ${r.status}`);
  r = await P('POST', '/api/login', { persoon_id: lotte, pincode: '2468' });
  T.check(r.status === 401, `login met de oude pincode → ${r.status}`);
  r = await P('POST', '/api/eerste-pincode', { persoon_id: lotte, pincode: '1357' });
  const tokL2 = await T.login(srv.base, lotte, '1357');
  T.check(r.status === 200 && !!tokL2, 'eerste-pincode-flow na reset werkt, login met de nieuwe pincode');
  const w = (await A('GET', `/api/logboek?tabel=personeel&zoek=pincode`)).json;
  T.check(w.regels.some((x) => /pincode-reset/.test(x.context)) && !JSON.stringify(w).includes('scrypt$'), 'reset staat in het logboek, zonder pincode-hash');

  // ── deactiveren / activeren ──
  r = await A('POST', `/api/personeel/${lotte}/deactiveer`);
  const na = await T.api(srv.base, tokL2, 'GET', '/api/periodes');
  const lg = await P('POST', '/api/login', { persoon_id: lotte, pincode: '1357' });
  T.check(r.status === 200 && na.status === 401 && lg.status === 403 && (await ov()).personeel.find((p) => p.id === lotte).stand === 'inactief', `deactiveren: sessie ${na.status}, login ${lg.status} "${lg.json.error}", stand inactief`);
  T.check(!(await P('GET', '/api/personeel-lijst-login')).json.some((p) => p.id === lotte), 'inactief → niet in de loginlijst');
  r = await A('POST', `/api/personeel/${lotte}/activeer`);
  T.check(r.status === 200 && !!(await T.login(srv.base, lotte, '1357')), 'activeren → login weer ok');
  r = await A('POST', '/api/personeel/10/deactiveer');
  T.check(r.status === 409, 'jezelf deactiveren → 409');

  // ── rol wijzigen ──
  r = await A('PUT', `/api/personeel/${lotte}/rol`, { rol: 'chauffeur' });
  const rl = (await A('GET', '/api/logboek?wie=Claude&tabel=personeel')).json;
  T.check(r.status === 200 && r.json.rol === 'chauffeur' && rl.regels.some((x) => /rol coordinator → chauffeur/.test(x.wat)), `rol gewijzigd en gelogd ("${rl.regels.find((x) => /rol /.test(x.wat))?.wat}")`);
  r = await A('PUT', `/api/personeel/${lotte}/rol`, { rol: 'baas' });
  T.check(r.status === 400, 'ongeldige rol → 400');

  // ── logboek ──
  const lb = (await A('GET', '/api/logboek')).json;
  T.check(lb.regels.length > 0 && lb.regels.length <= 500 && lb.regels.every((x) => 'terugdraaibaar' in x && x.tijd_tekst) && lb.tabellen.includes('personeel'), `logboek: ${lb.totaal} regels, tabellen ${lb.tabellen.length}`);
  const lt = (await A('GET', '/api/logboek?tabel=transport_ritten')).json;
  T.check(lt.regels.length > 0 && lt.regels.every((x) => x.tabel === 'transport_ritten'), `filter tabel: ${lt.regels.length} regels transport_ritten`);
  const lz = (await A('GET', `/api/logboek?zoek=Eigen%20wagen`)).json;
  T.check(lz.regels.some((x) => x.tabel === 'transport_ritten'), `filter zoek "Eigen wagen": ${lz.regels.length}`);
  const vandaag = new Date().toISOString().slice(0, 10);
  const lv = (await A('GET', `/api/logboek?van=2030-01-01`)).json;
  T.check(lv.regels.length === 0 && (await A('GET', `/api/logboek?van=${vandaag}`)).json.regels.length > 0, 'filter periode (van)');
  const wid = lb.regels.find((x) => x.wijziging_id && x.tabel === 'personeel').wijziging_id;
  const wd = (await A('GET', `/api/logboek/wijziging/${wid}`)).json;
  T.check(wd.oud && wd.nieuw && !('pincode' in wd.nieuw), `wijziging-detail met oud/nieuw (zonder pincode)`);

  // ── niet-kantoor ──
  const rs = await Promise.all(['/api/personeel-overzicht', `/api/personeel/${lotte}/detail`, '/api/logboek'].map((p) => T.api(srv.base, tokL2, 'GET', p)));
  const tokCh = await (async () => { await A('POST', '/api/personeel/13/pincode', { pincode: '4321' }); return T.login(srv.base, 13, '4321'); })();
  const rc = await Promise.all(['/api/personeel-overzicht', `/api/personeel/${lotte}/detail`, '/api/logboek'].map((p) => T.api(srv.base, tokCh, 'GET', p)));
  const rp = await T.api(srv.base, tokCh, 'POST', `/api/personeel/${lotte}/pincode-reset`);
  T.check(rc.every((x) => x.status === 403) && rp.status === 403, `chauffeur → ${rc.map((x) => x.status).join('/')}, reset ${rp.status}`);

  // ── pagina's ──
  for (const [p, chips] of [['/personeel', 6], ['/logboek', 0]]) {
    const html = await (await fetch(srv.base + p, { headers: { authorization: BASIC } })).text();
    const n = (html.match(/class="chip[ "]/g) || []).length;
    T.check(html.includes('class="sub"') && html.includes('/public/nav.js') && html.includes('class="voet') && html.includes('/public/patroon.css') && n === chips, `GET ${p}: subbalk, ${n} chips, voet`);
  }
} catch (e) { T.fout('onverwachte fout: ' + (e.stack || e)); }
await T.einde(srv);
