// test-tf3-login.mjs — TF3 punt 2, 3, 4: / en 404 (geen oude app), geen /#-links, meldingen bij elke ritwijziging, pincode tweemaal + zwakke codes, oude sha256-hash.
import * as T from './_testhulp.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const lees = (p) => fs.readFileSync(T.ROOT + '/' + p, 'utf8');
const NAV = require('../public/nav.js'), LOGIN = require('../public/login.js');

// Wegwerp-bron met een persoon op de oude sha256-hash (test-waarde, niemand echt).
const SQL = await require('sql.js')();
const db = new SQL.Database(fs.readFileSync(T.IJK_DB));
db.run("INSERT INTO personeel (naam,rol,pincode) VALUES ('Oud Hash','chauffeur',?)", ['sha256$' + crypto.createHash('sha256').update('5931').digest('hex')]);
const oudId = db.exec("SELECT id FROM personeel WHERE naam='Oud Hash'")[0].values[0][0];
const bron = path.resolve(T.ROOT, '..', 'sporty-c-tf3-bron.db'); fs.writeFileSync(bron, Buffer.from(db.export())); db.close();

const srv = await T.startServer({ poort: 3372, dbBron: bron });
try {
  const tok = await T.login(srv.base), A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  // ── Punt 2 ──
  const start = await T.api(srv.base, null, 'GET', '/');
  T.check(start.status === 200 && start.text.includes('/login?terug=') && start.text.includes('/api/wie-ben-ik') && !start.text.includes('nb-vandaag'), '/ is de kleine doorstuurpagina, niet de oude app');
  T.check(start.text.length < 3000, `/ is klein (${start.text.length} tekens)`);
  for (const h of ['transport-noden', 'transport-plan', 'overzicht', 'transporten', 'kampplanner', 'planning', 'materiaal', 'catalogus']) T.check(new RegExp(`"${h}":"/`).test(start.text), `oude hash #${h} is vertaald`);
  const script = /<script>([\s\S]*)<\/script>/.exec(start.text)[1];
  try { new Function(script); T.ok('script op / parseert'); } catch (e) { T.fout('script op /: ' + e.message); }
  for (const p of ['/index.html', '/bestaat-niet', '/server.js', '/sporty.db', '/.env', '/package.json', '/CLAUDE.md', '/lib/db.js']) {
    const r = await T.api(srv.base, null, 'GET', p);
    T.check(r.status === 404 && r.text.includes('href="/vandaag"') && !r.text.includes('require(') && !r.text.includes('nb-vandaag'), `${p} → echte 404-pagina met link naar Vandaag`);
  }
  const a404 = await A('GET', '/api/bestaat-niet'), p404 = await A('POST', '/api/bestaat-niet', {});
  T.check(a404.status === 404 && a404.json?.error && p404.status === 404 && p404.json?.error, 'onbekende /api: JSON 404 (GET en POST)');
  for (const p of ['/vandaag', '/login', '/meer', '/meldingen', '/ritplanning', '/kampmomenten', '/aanvullen', '/aanvullijst-print', '/nakijken', '/tekorten', '/personeel', '/backup', '/sw.js', '/manifest.json']) T.check((await A('GET', p)).status === 200, `${p} bestaat nog`);
  // Geen enkele menu- of Vandaag-link naar / of /#.
  const links = [...NAV.BOVEN.map((o) => o.href), ...Object.values(NAV.SUB).flat().map((s) => s[1]), ...Object.values(NAV.TABS).flat().map((t) => t[3])];
  T.check(links.every((h) => /^\/[a-z]/.test(h) && !h.includes('#')), `${links.length} menulinks: geen / of /#`);
  for (const f of ['public/vandaag.html', 'public/vandaag.js', 'routes/vandaag.js', 'public/kampmomenten.js', 'public/nav.js', 'public/meer.js', 'public/login.js']) T.check(!/['"`]\/#/.test(lees(f)), `${f}: geen /#-link`);
  const v = (await A('GET', '/api/vandaag')).json, acties = ['beslissen', 'inplannen', 'nakijken'].flatMap((k) => v[k].flatMap((x) => x.acties)).filter((a) => a.soort === 'link');
  T.check(acties.every((a) => !a.url.includes('#') && a.url !== '/'), `Vandaag: ${acties.length} actielinks, geen / of /#`);
  // Menu's per rol.
  T.check(NAV.tabsVan('chauffeur').map((t) => t[0]).join() === 'vandaag,ritten,stockage,meldingen,meer' && NAV.tabsVan('monitor').map((t) => t[0]).join() === 'vandaag,ritten,meldingen,meer', 'tabbalk per rol (monitor zonder Stockage, die mag hij niet)');
  T.check(!NAV.magOpGsm('chauffeur', '/personeel') && !NAV.magOpGsm('coordinator', '/nakijken') && !NAV.magOpGsm('monitor', '/aanvullen') && NAV.magOpGsm('coordinator', '/tekorten') && NAV.magOpGsm('kantoor', '/personeel'), 'pagina per rol');
  const nv = lees('public/nav.js');
  T.check(nv.includes("'/api/wie-ben-ik'") && !/isGsm\(\) && !magOpGsm\(rol0/.test(nv) && !/!tok0 && isGsm/.test(nv), 'nav.js: rol uit de sessie, niet-ingelogd op elke breedte naar /login');
  T.check(LOGIN.terug('?terug=/ritplanning') === '/ritplanning' && LOGIN.terug('?terug=//evil.test') === '/vandaag', 'terug-adres alleen binnen de site');

  // ── Punt 3 ──
  const pers = async (naam, rol, pin) => { const x = (await A('POST', '/api/personeel', { naam, rol })).json; await A('POST', `/api/personeel/${x.id}/pincode`, { pincode: pin }); return { id: x.id, tok: await T.login(srv.base, x.id, pin) }; };
  const jan = await pers('Tf Jan', 'chauffeur', '5841'), piet = await pers('Tf Piet', 'chauffeur', '5842');
  const lijst = async (p) => (await T.api(srv.base, p.tok, 'GET', '/api/meldingen')).json.meldingen;
  const gen = (await A('POST', '/api/transport-genereer')).json, lev = gen.filter((x) => x.type === 'levering');
  const { ritId, taakId } = await T.voorstelNaarRit(srv.base, tok, lev[0], { chauffeur: { id: jan.id, naam: 'Tf Jan' } });
  const r2 = await T.voorstelNaarRit(srv.base, tok, lev[1], {});
  await A('PUT', `/api/transport-taken/${r2.taakId}/rit`, { rit_id: null });
  const extra = r2.taakId;
  T.check((await lijst(jan)).length === 0, 'vóór klaarzetten: geen melding');
  await A('POST', `/api/ritten/${ritId}/klaarzet`, {});
  let l = await lijst(jan);
  T.check(l.length === 1 && /staat voor je klaar/.test(l[0].tekst) && l[0].link.startsWith('/rit/'), `klaarzetten: één melding met link naar de rit (${l[0]?.tekst})`);
  T.check(/\((ma|di|wo|do|vr|za|zo) \d{1,2}\/\d{1,2}( om \d\d:\d\d)?\)/.test(l[0].tekst) && !/\d{4}-\d{2}-\d{2}/.test(l[0].tekst), 'datum leesbaar, geen ISO');
  T.check(l[0].titel.split('Rit #').length === 2, 'titel zonder dubbel');
  const lees1 = l[0].id; await T.api(srv.base, jan.tok, 'POST', `/api/meldingen/${lees1}/gelezen`);
  await A('PUT', `/api/transport-taken/${extra}/rit`, { rit_id: ritId });
  l = (await lijst(jan)).filter((m) => !m.gelezen);
  T.check(l.length === 1 && /stop toegevoegd/.test(l[0].tekst), `stop toevoegen: melding (${l[0]?.tekst})`);
  const eenId = l[0].id;
  await A('POST', `/api/ritten/${ritId}/taken/${extra}/wissel`, { richting: 'omhoog' });
  l = (await lijst(jan)).filter((m) => !m.gelezen);
  T.check(l.length === 1 && l[0].id === eenId && /stop toegevoegd/.test(l[0].tekst) && /volgorde/.test(l[0].tekst), `wisselen: dezelfde melding bijgewerkt (${l[0]?.tekst})`);
  await A('POST', `/api/ritten/${ritId}/taken/${extra}/ontkoppel`, {});
  l = (await lijst(jan)).filter((m) => !m.gelezen);
  T.check(l.length === 1 && /van de rit gehaald/.test(l[0].tekst), 'ontkoppelen: dezelfde melding bijgewerkt');
  for (let i = 0; i < 10; i++) await A('PUT', `/api/ritten/${ritId}`, { voertuig: 'Wagen ' + i });
  l = (await lijst(jan)).filter((m) => !m.gelezen);
  T.check(l.length === 1 && l[0].tekst.split('voertuig aangepast').length === 2, 'tien snelle wijzigingen: één melding, reden één keer');
  await A('PUT', `/api/ritten/${ritId}/verplaats`, { datum: '2026-11-03', vertrek: '10:15' });
  l = (await lijst(jan)).filter((m) => !m.gelezen);
  T.check(l.length === 1 && /di 3\/11 om 10:15/.test(l[0].tekst), `verplaatsen: nieuwe datum leesbaar (${l[0].tekst})`);
  await T.api(srv.base, jan.tok, 'POST', `/api/meldingen/${l[0].id}/gelezen`);
  await A('PUT', `/api/ritten/${ritId}/stops/volgorde`, { taak_ids: [taakId] });
  l = (await lijst(jan)).filter((m) => !m.gelezen);
  T.check(l.length === 1 && l[0].id !== eenId, 'gelezen melding wordt niet herschreven: een nieuwe');
  await T.api(srv.base, jan.tok, 'POST', '/api/meldingen/alles-gelezen');
  await A('PUT', `/api/ritten/${ritId}`, { personeel_id: piet.id });
  const lj = (await lijst(jan)).filter((m) => !m.gelezen), lp = (await lijst(piet)).filter((m) => !m.gelezen);
  T.check(lj.length === 1 && /rijd je niet meer/.test(lj[0].tekst), `wissel: oude bestuurder krijgt er één (${lj[0]?.tekst})`);
  T.check(lp.length === 1 && /aan jou toegewezen/.test(lp[0].tekst) && lp[0].link.startsWith('/rit/'), `wissel: nieuwe bestuurder krijgt er één (${lp[0]?.tekst})`);
  // G29: geen "Chauffeur X: Chauffeur X".
  const rt = await T.ritToken(srv.base, tok, ritId);
  await T.api(srv.base, null, 'POST', `/api/rit-token/${rt}/taken/${taakId}/probleem`, { soort: 'gesloten', tekst: 'deur Tf3' });
  const km = (await A('GET', '/api/meldingen')).json.meldingen.find((m) => /deur Tf3/.test(m.tekst));
  T.check(km && km.titel.split('Tf Piet').length === 2, `chauffeursmelding zonder dubbele naam (${km?.titel})`);

  // ── Punt 4 ──
  for (const zw of ['0000', '1111', '1234', '4321', '1212']) {
    const r = await T.api(srv.base, jan.tok, 'POST', `/api/personeel/${jan.id}/pincode`, { pincode: zw });
    T.check(r.status === 400 && /te raden/.test(r.json.error), `eigen pincode ${zw} geweigerd met uitleg`);
  }
  T.check((await T.login(srv.base, jan.id, '5841')).length > 10, 'oude pincode blijft gelden na de weigering');
  T.check((await T.api(srv.base, jan.tok, 'POST', `/api/personeel/${jan.id}/pincode`, { pincode: '5977' })).status === 200 && (await T.login(srv.base, jan.id, '5977')).length > 10, 'sterke code wijzigen werkt');
  const nw = (await A('POST', '/api/personeel', { naam: 'Tf Nieuw', rol: 'chauffeur' })).json;
  await A('POST', '/api/personeel/uitnodiging', { ids: [nw.id] });
  const eerste = await T.api(srv.base, null, 'POST', '/api/eerste-pincode', { persoon_id: nw.id, pincode: '1234' });
  T.check(eerste.status === 400 && eerste.json.zwak === true, `eerste pincode 1234 geweigerd (${eerste.status})`);
  T.check((await T.login(srv.base, 10, '1111')).length > 10, 'bestaande testlogin met 1111 blijft werken');
  T.check(LOGIN.zwak('1234') && LOGIN.zwak('0000') && !LOGIN.zwak('5977'), 'login.js herkent dezelfde zwakke codes');
  T.check(LOGIN.pin({ naam: 'x', rol: 'chauffeur' }, 0, '', 'Nog een keer, ter controle').includes('Nog een keer, ter controle'), 'login toont de tweede invoer');
  T.check(!lees('public/meer.js').includes('prompt(') && lees('public/meer.js').includes('Nog een keer, ter controle'), 'Meer: geen prompt(), tweemaal op het toetsenblok');
  // Oude hash gaat over bij de eerste login. Alleen het formaat wordt gelezen, nooit de waarde.
  await T.login(srv.base, oudId, '5931');
  await new Promise((r) => setTimeout(r, 400));
  const fmt = (await T.leesDb(srv.dbPad, 'SELECT substr(pincode,1,7) AS f FROM personeel WHERE id=?', [oudId]))[0].f;
  T.check(fmt === 'scrypt$', `oude sha256-hash is na de login scrypt (formaat ${fmt})`);
  T.check((await T.login(srv.base, oudId, '5931')).length > 10, 'en inloggen blijft werken');
  // ── Aanvulling: tellers, verplaats, back-updatum ──
  const stand = async () => { const k = (await A('GET', '/api/vandaag')).json, g = (await A('GET', '/api/vandaag?mijn=1')).json; return { n: k.te_keuren, tab: g.tellers.voorraad, rij: k.nakijken.some((x) => x.id === 'tellingen-te-keuren') }; };
  const s0 = await stand();
  const am = await A('POST', '/api/aanvullijst/melding', { item_naam: 'Tf3 losse hoepel', soort: 'weg', aantal: 1 });
  const s1 = await stand();
  T.check(am.status === 200 && s1.n === s0.n + 1 && s1.tab === s0.tab + 1 && s1.rij, `melding aanvuller zonder week: Vandaag ${s0.n}→${s1.n}, tabteller ${s0.tab}→${s1.tab}`);
  const nk = (await A('GET', '/api/nakijken')).json, nkBak = (nk.bakken || nk.rijen || []).find((b) => b.bak && b.bak.soort === 'melding');
  const det = (await A('GET', `/api/nakijken/sessie/${nkBak.sessie_id}`)).json, regel = det.items.find((x) => x.naam === 'Tf3 losse hoepel');
  const rid = regel.regel_id;
  const best = await A('PUT', `/api/nakijken/regel/${rid}`, { actie: 'aanvaarden', kantoor_actie: 'aanvaarden' });
  const afr = await A('POST', `/api/nakijken/sessie/${nkBak.sessie_id}/afronden`);
  const s2 = await stand();
  T.check(best.status === 200 && afr.status === 200 && s2.n === s0.n && s2.tab === s0.tab, `na beslissen en afronden: Vandaag ${s1.n}→${s2.n}, tabteller ${s1.tab}→${s2.tab} (${best.status}/${afr.status})`);
  const vr = (await A('POST', '/api/ritten', { datum: '2026-11-04', vertrek: '09:00' })).json;
  const vt = (await A('GET', '/api/transport-taken')).json.find((t) => !t.rit_id && t.status === 'gepland');
  await A('PUT', `/api/transport-taken/${vt.id}/rit`, { rit_id: vr.id });
  await A('PUT', `/api/transport-taken/${vt.id}`, { ...vt, slot: undefined, regels: undefined, tijd: '11:00' });
  const stopT = async () => { await new Promise((r) => setTimeout(r, 300)); return (await T.leesDb(srv.dbPad, 'SELECT tijd FROM transport_taken WHERE id=?', [vt.id]))[0].tijd; }, voorS = await stopT();
  await A('PUT', `/api/ritten/${vr.id}/verplaats`, { datum: '2026-11-04', vertrek: '10:15' });
  const naS = await stopT();
  T.check(voorS === '11:00' && naS === '12:15', `verplaats 09:00 → 10:15: stop ${voorS} → ${naS}`);
  const lokaal = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Brussels' }).format(new Date()), utc = new Date().toISOString().slice(0, 10);
  await A('POST', '/api/locaties', { name: 'Tf3 back-up', type: 'kamp' });
  await new Promise((r) => setTimeout(r, 400));
  const bk = fs.readdirSync(path.join(srv.dataDir, 'backups')).filter((f) => /^sporty-\d{4}-\d{2}-\d{2}\.db$/.test(f));
  T.check(bk.includes(`sporty-${lokaal}.db`) && (lokaal === utc || !bk.includes(`sporty-${utc}.db`)), `automatische back-up op de lokale datum, geen tweede (lokaal ${lokaal}, UTC ${utc}: ${bk.join()})`);
  T.check(!/toISOString/.test(lees('lib/db.js').split('function backupDb')[1].split('\n').slice(0, 3).join()), 'backupDb gebruikt geen UTC meer');
} catch (e) { T.fout('uitzondering: ' + e.message); console.log(srv.log().slice(-1500)); }
try { fs.unlinkSync(bron); } catch {}
await T.einde(srv);
