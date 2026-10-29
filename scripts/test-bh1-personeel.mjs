// test-bh1-personeel.mjs — BH1: Beheer › Personeel + Logboek (design/mockup-beheer.html).
// Eigen server via _testhulp (herfst-test.db, poort uit TEST_POORT of 3305). Geen headless browser: de HTML-bouwers van
// public/personeel.js en public/logboek.js worden als module geladen en met de ECHTE data-JSON van de server aangeroepen.
import * as T from './_testhulp.mjs';
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const POORT = parseInt(process.env.TEST_POORT || '3305');
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: POORT });
const BASIC = 'Basic ' + Buffer.from('sporty:' + T.APP_PASSWORD).toString('base64');
const tekst = (html) => html.replace(/<[^>]+>/g, '\n').replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/\n\s*\n+/g, '\n').trim();
const dump = process.env.BH1_DUMP === '1';
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const L = (id, pin) => T.api(srv.base, null, 'POST', '/api/login', { persoon_id: id, pincode: pin });
  const wijz = async (rij) => (await A('GET', `/api/wijzigingen?tabel=personeel&rij_id=${rij}&limit=50`)).json;

  // ── 0. Migratie 81 + schoon antwoord ──
  let r = await A('GET', '/api/personeel-overzicht');
  T.check(r.status === 200 && r.json.tellers && Array.isArray(r.json.personeel), `GET /api/personeel-overzicht → 200 (${r.status})`);
  T.check(!r.text.includes('scrypt$') && !/"pincode"/.test(r.text), 'overzicht bevat geen pincode-hash of pincode-veld');
  const ps = r.json.personeel, tel = r.json.tellers;
  const telRol = (rol) => ps.filter((p) => p.rol === rol).length;
  T.check(tel.alle === ps.length && tel.kantoor === telRol('kantoor') && tel.chauffeur === telRol('chauffeur') && tel.coordinator === telRol('coordinator') && tel.monitor === telRol('monitor'),
    `tellers per rol kloppen met de lijst (alle ${tel.alle}, kantoor ${tel.kantoor}, chauffeur ${tel.chauffeur}, coördinator ${tel.coordinator}, monitor ${tel.monitor})`);
  const zonder = ps.filter((p) => p.stand === 'geen_pincode').length;
  const dbZonder = (await T.leesDb(srv.dbPad, "SELECT COUNT(*) n FROM personeel WHERE (pincode IS NULL OR pincode='') AND COALESCE(actief,1)<>0"))[0].n;
  T.check(tel.zonder_pincode === zonder && zonder === dbZonder && zonder > 0, `zonder pincode: teller ${tel.zonder_pincode} = lijst ${zonder} = db ${dbZonder}`);
  const api = ps.find((p) => p.id === T.API_PERSOON);
  T.check(api.stand === 'actief' && /^vandaag \d\d:\d\d$/.test(api.laatst_actief_tekst), `laatst actief gezet bij login: "${api.laatst_actief_tekst}"`);
  T.check(ps.every((p) => ['actief', 'geen_pincode', 'inactief'].includes(p.stand) && typeof p.laatst_actief_tekst === 'string'), 'elke rij heeft stand (actief|geen_pincode|inactief) en laatst_actief_tekst');

  // ── 1. Nieuwe coördinator + velden (gelogd) ──
  r = await A('POST', '/api/personeel', { naam: 'Lotte BH1', rol: 'coordinator', telefoon: '0475 12 34 56', email: 'lotte@test' });
  const lotte = r.json.id;
  T.check(r.status === 200 && lotte, `+ Persoon (bestaande POST /api/personeel) → id ${lotte}`);
  r = await A('PUT', `/api/personeel/${lotte}/velden`, { telefoon: '0475 99 99 99', rijbewijs: 'B', eigen_wagen_capaciteit: 6, meldingen_aan: true, notities: 'test' });
  let w = await wijz(lotte);
  T.check(r.status === 200 && w[0]?.actie === 'update' && w[0].nieuw.telefoon === '0475 99 99 99' && w[0].oud.telefoon === '0475 12 34 56' && w[0].persoon_id === T.API_PERSOON && w[0].context === 'beheer: gegevens',
    'PUT velden → gelogd in wijzigingen (oud/nieuw, persoon, context)');
  r = await A('PUT', `/api/personeel/${lotte}/velden`, { eigen_wagen_capaciteit: 'veel' });
  T.check(r.status === 400 && /eigen wagen/i.test(r.json.error), `ongeldige capaciteit → 400 "${r.json.error}"`);

  // ── 2. Inzet: KV-koppeling + rit als bestuurder ──
  const km = ijk.kampmomenten.abdijschool;
  await A('PUT', `/api/kampmomenten/${km}`, { kv_persoon_id: lotte });
  const per = (await T.leesDb(srv.dbPad, 'SELECT * FROM vakantieperiodes WHERE actief=1'))[0];
  const taak = (await A('POST', '/api/transport-taken', { type: 'levering', datum: per.start_datum, tijd: '09:00', van_locatie_id: ijk.locaties.rozenweg, naar_locatie_id: ijk.locaties.abdijschool, kampmoment_id: km, regels: [] })).json.id;
  const rit = (await A('POST', '/api/ritten', { datum: per.start_datum, chauffeur: 'Lotte BH1', taak_ids: [taak] })).json.id;
  await A('PUT', `/api/ritten/${rit}`, { datum: per.start_datum, chauffeur: 'Lotte BH1', personeel_id: lotte });
  r = await A('GET', `/api/personeel/${lotte}/detail`);
  const D = r.json;
  T.check(r.status === 200 && D.persoon.naam === 'Lotte BH1' && D.persoon.rol === 'coordinator' && D.rijbewijs === 'B' && D.eigen_wagen_capaciteit === 6 && D.meldingen_aan === true, 'detail: gegevens, rijbewijs, eigen wagen, meldingen');
  T.check(Array.isArray(D.rechten) && D.rechten.includes('ritten rijden') && D.rechten.includes('tellen'), `detail: rechten per rol (${D.rechten.join(' · ')})`);
  T.check(D.pincode && D.pincode.gezet === false && !r.text.includes('scrypt$'), 'detail: pincode {gezet:false}, geen hash in het antwoord');
  const kvI = D.inzet.find((i) => i.soort === 'kv'), ritI = D.inzet.find((i) => i.soort === 'rit');
  T.check(kvI && /^KV .* · wk \d/.test(kvI.titel) && kvI.link === `/kampmomenten?id=${km}`, `inzet: KV-kampmoment "${kvI?.titel}" met link`);
  T.check(ritI && ritI.titel.startsWith(`Rit #${rit}`) && ritI.link.includes(`rit=${rit}`), `inzet: rit als bestuurder "${ritI?.titel}" · "${ritI?.sub}" met link`);
  T.check(D.logboek.length > 0 && D.logboek.every((l) => 'wijziging_id' in l) && D.logboek.some((l) => l.wijziging_id === w[0].id), `detail: logboek op naam (${D.logboek.length} regels, met wijziging_id)`);
  T.check(D.logboek.length <= 50 && D.logboek.every((l, i, a) => i === 0 || (a[i - 1].tijdstip || '') >= (l.tijdstip || '')), 'detail: logboek max 50, nieuwste eerst');

  // ── 3. Pincode: zetten → login ok → reset → 401 → opnieuw zetten → ok ──
  r = await A('POST', `/api/personeel/${lotte}/pincode`, { pincode: '2468' });
  r = await L(lotte, '2468');
  T.check(r.status === 200 && r.json.token, 'pincode gezet → login ok');
  const lotteTok = r.json.token;
  const pg = (await A('GET', `/api/personeel/${lotte}/detail`)).json.pincode;
  T.check(pg.gezet === true && pg.gewijzigd_op, `pincode-stand: gezet, gewijzigd op ${pg.gewijzigd_tekst}`);
  r = await A('POST', `/api/personeel/${lotte}/pincode-reset`);
  T.check(r.status === 200, 'POST pincode-reset → 200');
  r = await L(lotte, '2468');
  T.check(r.status === 401, `login met de oude pincode na reset → 401 (${r.status})`);
  r = await T.api(srv.base, lotteTok, 'GET', '/api/wie-ben-ik');
  T.check(r.status === 401, `bestaande sessie na reset ongeldig → 401 (${r.status})`);
  w = await wijz(lotte);
  const wr = w.find((x) => x.context === 'beheer: pincode gewist');
  T.check(wr && wr.oud.pincode === '[gezet]' && wr.nieuw.pincode === '' && !JSON.stringify(w).includes('scrypt$'), 'pincode-reset gelogd met masker ([gezet] → leeg), nergens een hash in het logboek');
  r = await A('GET', `/api/personeel-overzicht`);
  T.check(r.json.personeel.find((p) => p.id === lotte).stand === 'geen_pincode', 'na reset: stand "geen pincode" in de lijst');
  // Eerste-pincode: de persoon (of kantoor) zet een nieuwe via de bestaande pincode-route; daarna kan hij weer in.
  r = await A('POST', `/api/personeel/${lotte}/pincode`, { pincode: '1357' });
  const l2 = await L(lotte, '1357');
  T.check(r.status === 200 && l2.status === 200, 'nieuwe pincode na reset → login weer ok');

  // ── 4. Deactiveren → 403, activeren → ok ──
  const lTok = l2.json.token;
  r = await A('POST', `/api/personeel/${lotte}/deactiveer`);
  T.check(r.status === 200, 'POST deactiveer → 200');
  r = await L(lotte, '1357');
  T.check(r.status === 403 && r.json.error === 'Deze persoon is gedeactiveerd', `login na deactiveren → 403 "${r.json.error}"`);
  r = await T.api(srv.base, lTok, 'GET', '/api/wie-ben-ik');
  T.check(r.status === 401, `sessie van een gedeactiveerde persoon → 401 (${r.status})`);
  r = await A('GET', `/api/personeel-overzicht`);
  T.check(r.json.personeel.find((p) => p.id === lotte).stand === 'inactief', 'lijst: stand inactief (blijft in de lijst/historiek)');
  r = await A('POST', `/api/personeel/${T.API_PERSOON}/deactiveer`);
  T.check(r.status === 400, `jezelf deactiveren → 400 (${r.json?.error})`);
  r = await A('POST', `/api/personeel/${lotte}/activeer`);
  r = await L(lotte, '1357');
  T.check(r.status === 200, `activeren → login weer ok (${r.status})`);
  const coordTok = r.json.token;

  // ── 5. Rol wijzigen (gelogd) ──
  r = await A('PUT', `/api/personeel/${lotte}/rol`, { rol: 'monitor' });
  w = await wijz(lotte);
  T.check(r.status === 200 && w[0].context === 'beheer: rol' && w[0].oud.rol === 'coordinator' && w[0].nieuw.rol === 'monitor', 'rol wijzigen → gelogd (coordinator → monitor)');
  r = await A('PUT', `/api/personeel/${lotte}/rol`, { rol: 'baas' });
  T.check(r.status === 400, 'onbekende rol → 400');
  r = await T.api(srv.base, coordTok, 'GET', '/api/wie-ben-ik');
  T.check(r.status === 200 && r.json.rol === 'monitor', `sessie ziet de nieuwe rol meteen (${r.json?.rol})`);
  await A('PUT', `/api/personeel/${lotte}/rol`, { rol: 'coordinator' });

  // ── 6. Uitnodiging ──
  const eva = (await A('POST', '/api/personeel', { naam: 'Eva BH1', rol: 'coordinator' })).json.id;
  r = await A('POST', '/api/personeel/uitnodiging', { ids: [eva, lotte] });
  const inv = (await T.leesDb(srv.dbPad, 'SELECT uitnodiging_op FROM personeel WHERE id=?', [eva]))[0];
  const evaW = await wijz(eva);
  T.check(r.status === 200 && r.json.personen.length === 2 && r.json.personen[0].instructie.includes(r.json.app_adres) && /kies je pincode bij de eerste keer/.test(r.json.personen[0].instructie) && r.json.personen[0].instructie.includes('Eva BH1'),
    `uitnodiging → instructies per persoon: "${r.json.personen?.[0]?.instructie}"`);
  T.check(r.json.uitnodiging_op && evaW.some((x) => x.context === 'beheer: uitnodiging' && x.nieuw.uitnodiging_op), 'uitnodiging zet uitnodiging_op (gelogd)');
  T.check((await A('POST', '/api/personeel/uitnodiging', { ids: [] })).status === 400, 'uitnodiging zonder ids → 400');
  T.check(inv !== undefined, 'uitnodiging_op-kolom bestaat (migratie 81)');

  // ── 7. /api/logboek ──
  r = await A('GET', `/api/logboek?wie=${lotte}`);
  T.check(r.status === 200 && r.json.regels.length > 0 && r.json.regels.every((x) => typeof x.terugdraaibaar === 'boolean'), `logboek wie=${lotte}: ${r.json.regels?.length} regels, elk met terugdraaibaar`);
  T.check(r.json.regels.every((x) => x.persoon_id === lotte || (x.tabel === 'personeel' && x.rij_id === lotte) || x.bron === 'activiteiten_log'), 'filter wie: alleen regels van/over deze persoon');
  T.check(r.json.regels.some((x) => x.terugdraaibaar === true) && r.json.terugdraaien_beschikbaar === false, 'update-regels zijn terugdraaibaar, maar er is (nog) geen terugdraai-route → knop uit');
  r = await A('GET', '/api/logboek?tabel=personeel');
  T.check(r.json.regels.length > 0 && r.json.regels.every((x) => x.tabel === 'personeel'), `filter tabel=personeel: ${r.json.regels.length} regels`);
  r = await A('GET', '/api/logboek?zoek=Eva%20BH1');
  T.check(r.json.regels.length > 0 && r.json.regels.every((x) => JSON.stringify(x).includes('Eva BH1')), `filter zoek: ${r.json.regels.length} regels met "Eva BH1"`);
  r = await A('GET', '/api/logboek?tabel=activiteiten_log');
  T.check(r.json.regels.length > 0 && r.json.regels.every((x) => x.bron === 'activiteiten_log' && x.terugdraaibaar === false), 'activiteiten_log zit in het logboek (niet terugdraaibaar)');
  r = await A('GET', '/api/logboek');
  T.check(r.json.regels.length <= 500 && r.json.regels.some((x) => x.bron === 'wijzigingen') && r.json.regels.some((x) => x.bron === 'activiteiten_log') && !r.text.includes('scrypt$'), `logboek gecombineerd, max 500 (${r.json.regels.length}), geen hash`);
  const vandaag = new Date().toISOString().slice(0, 10);
  r = await A('GET', `/api/logboek?van=2000-01-01&tot=2000-01-02`);
  T.check(r.json.regels.length === 0, 'filter periode buiten bereik → 0 regels');

  // ── 8. Pagina's + rechten ──
  const pag = async (p) => { const x = await fetch(srv.base + p, { headers: { authorization: BASIC } }); return { status: x.status, text: await x.text() }; };
  const hp = await pag('/personeel'), hl = await pag('/logboek');
  T.check(hp.status === 200 && hp.text.includes('class="sub"') && hp.text.includes('>Logboek<') && hp.text.includes('Export &amp; back-up') && hp.text.includes('id="voet"') && hp.text.includes('Pincode-uitnodiging sturen'), 'GET /personeel → 200 met subbalk en bulk-voet');
  T.check(hl.status === 200 && hl.text.includes('class="sub"') && hl.text.includes('>Personeel<') && hl.text.includes('id="voet"'), 'GET /logboek → 200 met subbalk en voet');
  T.check((await fetch(srv.base + '/personeel')).status === 401, '/personeel zonder Basic-wachtwoord → 401');
  const chTok = coordTok;
  for (const p of ['/api/personeel-overzicht', `/api/personeel/${lotte}/detail`, '/api/logboek']) {
    r = await T.api(srv.base, chTok, 'GET', p);
    T.check(r.status === 403, `niet-kantoor (coördinator) op ${p} → 403`);
  }
  r = await T.api(srv.base, chTok, 'POST', `/api/personeel/${eva}/deactiveer`);
  T.check(r.status === 403, 'niet-kantoor deactiveren → 403');
  r = await T.api(srv.base, null, 'GET', '/api/personeel-overzicht');
  T.check(r.status === 401, 'zonder token → 401');
  const js = fs.readFileSync(T.ROOT + '/public/personeel.js', 'utf8') + fs.readFileSync(T.ROOT + '/public/logboek.js', 'utf8');
  T.check(!/\b(alert|prompt|confirm)\(/.test(js), 'geen alert()/prompt()/confirm() in personeel.js en logboek.js');

  // ── 9. DOM-bouw met de echte data (geen headless browser) ──
  const PP = require(T.ROOT + '/public/personeel.js');
  const LB = require(T.ROOT + '/public/logboek.js');
  const O = (await A('GET', '/api/personeel-overzicht')).json;
  const lijst = PP.lijstHtml(O, { filter: 'alle', zoek: '', sel: new Set([eva]), open: lotte });
  const rijN = (lijst.match(/class="r[ "]/g) || []).length;
  T.check(rijN === O.personeel.length && lijst.includes('class="r act"') && lijst.includes('pil oranje">geen pincode') && lijst.includes('pil groen">actief'), `lijst: ${rijN} rijen, actieve rij, pillen actief/geen pincode`);
  const chips = PP.chipsHtml(O, 'alle');
  T.check(['Alle', 'Kantoor', 'Chauffeur', 'Coördinator', 'Monitor', '⚠ Zonder pincode'].every((c) => chips.includes(c)) && chips.includes(`Alle ${O.tellers.alle}`), 'chips: Alle · Kantoor · Chauffeur · Coördinator · Monitor · ⚠ Zonder pincode met tellers');
  const coLijst = PP.lijstHtml(O, { filter: 'coordinator', zoek: '', sel: new Set(), open: null });
  T.check((coLijst.match(/class="r[ "]/g) || []).length === O.tellers.coordinator, 'chip Coördinator filtert de lijst');
  const zpLijst = PP.lijstHtml(O, { filter: 'zonder_pincode', zoek: '', sel: new Set(), open: null });
  T.check((zpLijst.match(/class="r[ "]/g) || []).length === O.tellers.zonder_pincode, 'chip Zonder pincode filtert de lijst');
  const Dd = (await A('GET', `/api/personeel/${lotte}/detail`)).json;
  const det = PP.detailHtml(Dd, 'gegevens');
  T.check(['Bewerken', 'Pincode resetten', 'Deactiveren', 'Rol wijzigen', 'Gegevens', 'Inzet ' + Dd.inzet.length, 'Wat deed ze ' + Dd.logboek.length, 'Gegevens &amp; rechten', 'Inzet deze periode', 'Wat deed ze (logboek op naam)', 'Volledig logboek ›'].every((x) => det.includes(x)), 'detail: kop, 4 knoppen, tabs Gegevens · Inzet n · Wat deed ze n, blokken, Volledig logboek ›');
  T.check(det.includes('mag: ritten rijden · stockage · tellen · meldingen') && det.includes('B · eigen wagen (6 bakken)') && det.includes('app-meldingen aan'), 'detail: rechten-pil, rijbewijs + eigen wagen, meldingen zoals de mockup');
  T.check(det.includes(`href="/logboek?wie=${lotte}"`), 'Volledig logboek › → /logboek?wie=');
  const uitn = PP.uitnodigingHtml((await A('POST', '/api/personeel/uitnodiging', { ids: [eva] })).json);
  T.check(uitn.includes('Eva BH1') && uitn.includes('data-kopieer') && uitn.includes('Alles kopiëren'), 'uitnodiging-overlay: instructie per persoon + kopieerknoppen');
  const LBd = (await A('GET', `/api/logboek?wie=${lotte}`)).json;
  const lbl = LB.lijstHtml(LBd, LBd.regels[0].id);
  T.check((lbl.match(/class="r[ "]/g) || []).length === LBd.regels.length && lbl.includes('↶ Terug') && /↶ Terug<\/button>/.test(lbl) && lbl.includes('disabled'), 'logboek-lijst: rijen met ↶ Terug (uit: geen terugdraai-route)');
  const lbd = LB.detailHtml(LBd.regels.find((x) => x.actie === 'update'));
  T.check(lbd.includes('Oud') && lbd.includes('Nieuw') && lbd.includes('rol'), 'logboek-detail: oud/nieuw van de gekozen regel');
  if (dump) {
    console.log('--- DOM-dump lijst ---\n' + tekst(chips + lijst).split('\n').join(' | '));
    console.log('--- DOM-dump detail ---\n' + tekst(det).split('\n').join(' | '));
    console.log('--- DOM-dump uitnodiging ---\n' + tekst(uitn).split('\n').join(' | '));
    console.log('--- DOM-dump logboek ---\n' + tekst(lbl).split('\n').slice(0, 40).join(' | '));
    console.log('--- DOM-dump logboek-detail ---\n' + tekst(lbd).split('\n').join(' | '));
  }
} catch (e) {
  T.fout('test crashte: ' + (e.stack || e));
}
await T.einde(srv);
