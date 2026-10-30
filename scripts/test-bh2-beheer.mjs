// test-bh2-beheer.mjs — BH2 (chat C): Beheer › Back-up & export en Instellingen, nachtback-up, gesloten dagen per locatie.
// Eigen server via _testhulp (poort 3367, herfst-test.db, eigen tijdelijke DATA_DIR per poort). Nachtback-up bij opstart, max 14,
// handmatige back-up in de lijst, download weigert ../-namen, terugzetten = eerst back-up + het woord, gesloten dag per locatie
// (planning + generator), kantoornummer op KV-/rit-pagina en aanvullijst, 409 bij een gebruikte leeftijdsgroep, pagina's en rechten,
// vervangstrook, DOM-bouw met de echte data-JSON + gsm-CSS.
import * as T from './_testhulp.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const POORT = parseInt(process.env.TEST_POORT || '3367');
const ijk = T.leesIjk();
let srv = await T.startServer({ poort: POORT });
const BASIC = 'Basic ' + Buffer.from('sporty:' + T.APP_PASSWORD).toString('base64');
const pad = (n) => String(n).padStart(2, '0');
const vandaag = (() => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })();
try {
  const BK = path.join(srv.dataDir, 'backups');
  let tok = await T.login(srv.base);
  let A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  // ── punt 1: nachtback-up bij opstart (verse DATA_DIR = geen recente) ──
  T.check(fs.existsSync(path.join(BK, `sporty-${vandaag}.db`)) && fs.readFileSync(path.join(BK, `sporty-${vandaag}.db`)).slice(0, 15).toString() === 'SQLite format 3', `opstart zonder recente back-up → backups/sporty-${vandaag}.db (geldige SQLite)`);
  const lg = (await A('GET', '/api/log?type=beheer')).json;
  T.check(lg.some((l) => /Nachtback-up gemaakt \(opstart/.test(l.beschrijving) && /MB/.test(l.beschrijving)), `gelogd in het Logboek: "${(lg.find((l) => /Nachtback-up/.test(l.beschrijving)) || {}).beschrijving}"`);
  let B = (await A('GET', '/api/backups')).json;
  T.check(B.uur === '03:00' && B.bewaard === 14 && B.laatst_nacht && !B.fout && new Date(B.volgende).getHours() === 3, `GET /api/backups: uur ${B.uur}, bewaard ${B.bewaard}, volgende ${B.volgende}`);
  // handmatig
  const h = await A('POST', '/api/backups/nu');
  B = (await A('GET', '/api/backups')).json;
  const hb = B.backups.find((b) => b.naam === h.json.naam);
  T.check(h.status === 200 && /^sporty-\d{4}-\d{2}-\d{2}-\d{4}\.db$/.test(h.json.naam) && hb && hb.soort === 'handmatig' && hb.wie === 'Claude (API)' && fs.existsSync(path.join(BK, h.json.naam)), `handmatige back-up ${h.json.naam} staat in de lijst (handmatig · ${hb && hb.wie})`);
  // download
  const dl = await fetch(srv.base + '/api/backups/' + h.json.naam, { headers: { authorization: BASIC, 'x-auth-token': tok } });
  const buf = Buffer.from(await dl.arrayBuffer());
  T.check(dl.status === 200 && buf.slice(0, 15).toString() === 'SQLite format 3', `download ${h.json.naam} → 200, SQLite (${buf.length} bytes)`);
  const slecht = [];
  for (const n of ['..%2Fsporty.db', '..%2F..%2Fbackups%2Fsporty.db', 'sporty.db', 'sporty-2026-10-30.db.tmp', '%2E%2E%2Fsporty-2026-10-30.db', 'sporty-2026-10-30.db%00x']) { const r = await A('GET', '/api/backups/' + n); slecht.push({ s: r.status, t: r.text || '' }); }
  T.check(slecht.every((x) => x.s === 400 || x.s === 404 || (x.s === 200 && /^<!DOCTYPE html>/i.test(x.t))) && slecht[0].s === 400 && !slecht.some((x) => /^SQLite format 3/.test(x.t) || x.t === fs.readFileSync(T.ROOT + '/server.js', 'utf8')), `download weigert ../ en andere namen: ${slecht.map((x) => x.s + (x.s === 200 ? ' (app-pagina, geen bestand)' : '')).join(',')}`);
  { const st = await fetch(srv.base + '/server.js', { headers: { authorization: BASIC } }); T.info(`GEVONDEN (buiten BH2): GET /server.js → ${st.status} (express.static op de projectmap)`); }
  const inh = (await A('GET', '/api/backup-inhoud')).json;
  T.check(inh.locaties > 0 && inh.themas > 0 && inh.bakken > 0 && inh.personeel > 0 && typeof inh.wijzigingen === 'number' && inh.db_grootte > 0, `wat zit erin: ${inh.locaties} locaties, ${inh.themas} thema's, ${inh.bakken} bakken, ${inh.ritten} ritten, ${inh.personeel} personeel, ${inh.wijzigingen} wijzigingen · ${inh.db_grootte_tekst}`);

  // ── max 14: herstart met 16 oude back-ups in de map ──
  for (let i = 1; i <= 16; i++) fs.writeFileSync(path.join(BK, `sporty-2026-01-${pad(i)}.db`), 'SQLite format 3\0oud');
  await srv.stop();
  srv = await T.startServer({ poort: POORT, verseMap: false });
  tok = await T.login(srv.base); A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const na = fs.readdirSync(BK).filter((f) => /^sporty-.*\.db$/.test(f));
  T.check(na.length === 14 && na.includes(`sporty-${vandaag}.db`) && na.includes(h.json.naam) && !na.includes('sporty-2026-01-01.db'), `16 oude + 2 nieuwe in de map → na opstart blijven er 14 (oudste weg, recente blijven)`);

  // ── punt 3: gesloten dag per locatie ──
  const L1 = ijk.locaties.betekom, L2 = ijk.locaties.abdijschool, K1 = ijk.kampmomenten.betekom, K2 = ijk.kampmomenten.abdijschool;
  const open = async (k) => (await A('GET', '/api/kampmomenten')).json.find((x) => x.id === k).open_dagen;
  const voor1 = await open(K1), voor2 = await open(K2);
  const g1 = await A('POST', '/api/instellingen/gesloten', { van: '2026-11-04', reden: 'sporthal bezet', locatie_id: L1 });
  T.check(g1.status === 200 && g1.json.toegevoegd === 1, 'gesloten dag 04/11 alleen voor Betekom toegevoegd');
  T.check(!(await open(K1)).includes('2026-11-04') && (await open(K2)).includes('2026-11-04') && voor1.includes('2026-11-04') && voor2.includes('2026-11-04'), 'planning: 04/11 dicht voor Betekom, open voor Abdijschool');
  const dubbel = await A('POST', '/api/gesloten', { datum: '2026-11-04', locatie_id: L1 });
  const anders = await A('POST', '/api/gesloten', { datum: '2026-11-04', locatie_id: L2, reden: 'x' });
  T.check(dubbel.status === 400 && anders.status === 200, 'UNIQUE (datum, locatie): dezelfde dag dezelfde locatie → 400, andere locatie → 200');
  await A('DELETE', `/api/gesloten/${anders.json.id}`);
  // generator: hele week dicht voor Betekom → geen voorstel voor Betekom, wel voor Abdijschool
  await A('POST', '/api/instellingen/gesloten', { van: '2026-11-02', tot: '2026-11-06', reden: 'week dicht', locatie_id: L1 });
  let gen = (await A('POST', '/api/transport-genereer')).json || [];
  T.check(!gen.some((v) => v.kampmoment_id === K1) && gen.some((v) => v.kampmoment_id === K2), `generator: week dicht voor Betekom → geen voorstel voor Betekom, wel voor Abdijschool (${gen.filter((v) => v.kampmoment_id === K2).length})`);
  // NULL = heel Sporty
  await A('POST', '/api/instellingen/gesloten', { van: '2026-11-02', tot: '2026-11-06', reden: 'herfst dicht' });
  gen = (await A('POST', '/api/transport-genereer')).json || [];
  T.check(!gen.some((v) => v.kampmoment_id === K1 || v.kampmoment_id === K2) && (await open(K2)).length === 0, 'heel Sporty dicht (locatie leeg) → geen voorstellen en geen open dagen meer voor beide');
  const GD = (await A('GET', '/api/instellingen/gesloten')).json;
  T.check(GD.data.dagen.filter((d) => d.locatie === 'Betekom').length === 5 && GD.data.dagen.filter((d) => !d.locatie_id && d.datum >= '2026-11-02' && d.datum <= '2026-11-06').length === 5, 'instellingen › gesloten: reeks = 5 werkdagen per keuze (Betekom en heel Sporty apart)');
  for (const d of GD.data.dagen.filter((x) => x.datum >= '2026-11-02' && x.datum <= '2026-11-06')) await A('DELETE', `/api/instellingen/gesloten/${d.id}`);
  T.check((await open(K2)).length === 5, 'gesloten dagen weer weg → 5 open dagen');
  const mig = await T.leesDb(srv.dbPad, "SELECT sql FROM sqlite_master WHERE name='gesloten_dagen'");
  T.check(/locatie_id INTEGER/.test(mig[0].sql) && /UNIQUE\(datum, locatie_id\)/.test(mig[0].sql), 'migratie 86: gesloten_dagen heeft locatie_id en UNIQUE(datum, locatie_id)');
  const PD = (await A('GET', '/api/periodes/2/detail')).json;
  T.check(Array.isArray(PD.gesloten), 'periodes-detail leest gesloten dagen nog (met locatie)');

  // ── instellingen ──
  let I = (await A('GET', '/api/instellingen')).json;
  T.check(I.tellers.alles === 7 && I.tellers.aandacht === 1 && I.groepen[0].stand.tekst === 'nummer ontbreekt', `instellingen: 7 groepen, ⚠ aandacht 1 ("${I.groepen[0].stand.tekst}")`);
  const kvtok = await T.kvToken(srv.base, tok, K1);
  T.check(!(await T.api(srv.base, null, 'GET', `/api/kv/${kvtok}/data`)).json.kantoor.telefoon, 'KV-pagina zonder nummer: blok Kantoor leeg');
  T.check((await A('PUT', '/api/instellingen/kantoor', { kantoor_telefoon: 'abc' })).status === 400, 'ongeldig telefoonnummer → 400');
  await A('PUT', '/api/instellingen/kantoor', { kantoor_telefoon: '016 12 34 56', kantoor_gsm: '0470 12 34 56', kantoor_email: 'logistiek@sporty.be' });
  const kvd = (await T.api(srv.base, null, 'GET', `/api/kv/${kvtok}/data`)).json;
  T.check(kvd.kantoor.telefoon === '016 12 34 56', `kantoornummer opgeslagen → KV-pagina-data heeft het blok (${kvd.kantoor.telefoon})`);
  I = (await A('GET', '/api/instellingen')).json;
  T.check(I.tellers.aandacht === 0 && I.groepen[0].stand.tekst === 'ok', 'na opslaan: geen aandacht meer');
  const av = (await A('GET', '/api/aanvullijst')).json;
  T.check(av.kantoor && av.kantoor.telefoon === '016 12 34 56' && av.kantoor.gsm === '0470 12 34 56', 'aanvullijst-data heeft het kantoornummer');
  gen = (await A('POST', '/api/transport-genereer')).json || [];
  const vs = gen.find((v) => v.type === 'levering');
  const { ritId } = await T.voorstelNaarRit(srv.base, tok, vs, { chauffeur: { id: ijk.personen.chauffeur, naam: 'Test Chauffeur harnas' } });
  const rt = await T.ritToken(srv.base, tok, ritId);
  const rd = (await T.api(srv.base, null, 'GET', `/api/rit-token/${rt}/data`)).json;
  T.check(rd.kantoor && rd.kantoor.telefoon === '016 12 34 56', 'rit-pagina-data heeft het kantoornummer ("Bel kantoor")');
  const KD = (await A('GET', '/api/instellingen/kantoor')).json;
  T.check(KD.historiek.length === 1 && /telefoon 016 12 34 56/.test(KD.historiek[0].wat) && /Claude \(API\)/.test(KD.historiek[0].wat), `gelogd: "${KD.historiek[0].wat}"`);
  // leeftijdsgroepen + categorieën
  const lw = await A('DELETE', '/api/instellingen/leeftijd/lijst/kleuters');
  T.check(lw.status === 409 && /wordt nog gebruikt/.test(lw.json.error), `gebruikte leeftijdsgroep verwijderen → 409 ("${lw.json.error}")`);
  await A('POST', '/api/instellingen/leeftijd/lijst', { naam: '12+' });
  T.check((await A('POST', '/api/instellingen/leeftijd/lijst', { naam: '12+' })).status === 409 && (await A('DELETE', '/api/instellingen/leeftijd/lijst/12%2B')).status === 200, 'leeftijdsgroep 12+ toegevoegd (dubbel → 409) en ongebruikt verwijderd → 200');
  await A('POST', '/api/instellingen/categorie/lijst', { naam: 'Testcat BH2' });
  const hn = await A('PUT', '/api/instellingen/categorie/lijst', { oud: 'Testcat BH2', nieuw: 'Testcat BH2b' });
  T.check(hn.status === 200 && hn.json.lijst.some((x) => x.naam === 'Testcat BH2b') && !hn.json.lijst.some((x) => x.naam === 'Testcat BH2'), 'thema-categorie hernoemd');
  const gebruikteCat = (await A('GET', '/api/instellingen/categorie')).json.data.lijst.find((x) => x.gebruikt > 0);
  T.check(!gebruikteCat || (await A('DELETE', '/api/instellingen/categorie/lijst/' + encodeURIComponent(gebruikteCat.naam))).status === 409, `gebruikte thema-categorie${gebruikteCat ? ' "' + gebruikteCat.naam + '"' : ''} verwijderen → 409`);
  // tijden
  T.check((await A('PUT', '/api/instellingen/tijden', { tijd_nachtbackup: '25:00' })).status === 400, 'ongeldige tijd → 400');
  await A('PUT', '/api/instellingen/tijden', { tijd_nachtbackup: '02:30', tijd_verhuis_avond: '19:00' });
  B = (await A('GET', '/api/backups')).json;
  T.check(B.uur === '02:30' && new Date(B.volgende).getHours() === 2 && new Date(B.volgende).getMinutes() === 30, `uur nachtback-up 02:30 → volgende ${B.volgende}`);
  const AP = (await A('GET', '/api/instellingen/app')).json.data;
  T.check(/^[0-9a-f]{7}$/.test(AP.versie) && AP.grootte > 0 && AP.backups === 14, `App & database: versie ${AP.versie}, ${AP.grootte_tekst}, ${AP.backups} back-ups`);

  // ── pagina's + rechten ──
  const NAV = require(T.ROOT + '/public/nav.js');
  for (const p of ['/backup', '/instellingen']) {
    const r = await fetch(srv.base + p, { headers: { authorization: BASIC, 'x-auth-token': tok } });
    const html = await r.text(), sb = NAV.sub(NAV.PAGINA[p], p);
    T.check(r.status === 200 && /class="sub"/.test(html) && (sb.match(/<a /g) || []).length === 4 && sb.includes(`class="act" href="${p}"`), `GET ${p} 200 met subbalk (${NAV.SUB.beheer.map((s) => s[0]).join(' · ')}; "${p}" actief)`);
  }
  const chauf = (await A('POST', '/api/personeel', { naam: 'Bh2 Chauffeur', rol: 'chauffeur' })).json;
  await A('POST', `/api/personeel/${chauf.id}/pincode`, { pincode: '4324' });
  const htok = (await T.api(srv.base, null, 'POST', '/api/login', { persoon_id: chauf.id, pincode: '4324' })).json.token;
  const st = [];
  for (const p of ['/backup', '/instellingen']) st.push((await fetch(srv.base + p, { headers: { authorization: BASIC, 'x-auth-token': htok } })).status);
  for (const p of ['/api/backups', '/api/backup-inhoud', '/api/instellingen', '/api/instellingen/kantoor', '/api/backups/' + h.json.naam]) st.push((await T.api(srv.base, htok, 'GET', p)).status);
  st.push((await T.api(srv.base, htok, 'POST', '/api/backups/nu')).status, (await T.api(srv.base, htok, 'PUT', '/api/instellingen/kantoor', {})).status);
  T.check(st.every((s) => s === 403), `niet-kantoor (chauffeur): pagina's en API ${st.join(',')}`);
  const idx = fs.readFileSync(T.ROOT + '/index.html', 'utf8');
  T.check(/ms==='themas'\)\{links=\[\['Thema’s','\/themas'\],\['Beheer › Back-up & export','\/backup'\]\]/.test(idx) && /Planning importeren\/exporteren en de volledige back-up staan nu in Beheer › Back-up & export/.test(idx), 'index.html: vervangstrook op het oude Beheer-blok → /backup');

  // ── DOM-bouw met de echte data-JSON ──
  const t = (x) => x.replace(/<[^>]+>/g, '\n').replace(/&amp;/g, '&').replace(/\n\s*\n+/g, '\n').trim().split('\n').join(' | ');
  const BB = require(T.ROOT + '/public/backup.js'), IB = require(T.ROOT + '/public/instellingen.js');
  B = (await A('GET', '/api/backups')).json; const IN = (await A('GET', '/api/backup-inhoud')).json;
  const rs = BB.rijen(B, IN);
  T.check(rs.length === 7 && /Alles 7/.test(BB.chips(rs, 'alles')) && /Back-up 3/.test(BB.chips(rs, 'alles')) && /Export 3/.test(BB.chips(rs, 'alles')) && /Import 1/.test(BB.chips(rs, 'alles')), `chips: ${t(BB.chips(rs, 'alles'))}`);
  T.check(/elke nacht om 02:30 · 14 bewaard/.test(BB.rij(rs[1])) && /pil groen">aan/.test(BB.rij(rs[1])) && /gevaarlijk/.test(BB.rij(rs[6])), `rijen: ${t(BB.rij(rs[1]))} / ${t(BB.rij(rs[6]))}`);
  const dv = BB.detail('volledig', B, IN, 'backup');
  T.check(/Laatste back-ups/.test(dv) && /Wat zit erin/.test(dv) && /Download nu/.test(dv) && /Tip/.test(dv) && /Eerdere 14/.test(dv) && /handmatig/.test(dv), `detail Volledige back-up: ${t(dv).slice(0, 300)}`);
  T.check(/TERUGZETTEN/.test(BB.detail('terugzetten', B, IN)) && /Ingebouwde planning/.test(BB.detail('import', B, IN)) && /database .* MB/.test(BB.voet(IN, B)), 'detail Terugzetten (woord), Importeren, voet met grootte');
  const I2 = (await A('GET', '/api/instellingen')).json;
  T.check(/Alles 7/.test(IB.chips(I2, 'alles', '')) && /⚠ Aandacht 0/.test(IB.chips(I2, 'alles', '')) && /Zoek instelling/.test(IB.chips(I2, 'alles', '')), 'instellingen-chips: zoekveld · Alles · ⚠ Aandacht');
  const kd = IB.detail((await A('GET', '/api/instellingen/kantoor')).json, 'gegevens');
  T.check(/Telefoon kantoor/.test(kd) && /GSM permanentie/.test(kd) && /Waar je het ziet/.test(kd) && /Annuleren/.test(kd) && /Opslaan/.test(kd) && /Historiek 1/.test(kd), `detail Kantoor & contact: ${t(kd).slice(0, 260)}`);
  T.check(/heel Sporty/.test(IB.detail((await A('GET', '/api/instellingen/gesloten')).json, 'gegevens')) && /niet gebruikt|gebruikt \d+×/.test(IB.detail((await A('GET', '/api/instellingen/leeftijd')).json, 'gegevens')), 'detail Gesloten dagen (heel Sporty/locatie) en Leeftijdsgroepen (gebruikt n×)');
  const css = fs.readFileSync(T.ROOT + '/public/backup.css', 'utf8') + fs.readFileSync(T.ROOT + '/public/rooster.css', 'utf8');
  T.check(/@media \(max-width:767px\)\{\r?\n  \.veld input,\.veld select\{height:44px;width:100%\}/.test(css) && /\.body\.toon-detail>\.kaart\.lijstkaart\{display:none\}/.test(css), 'gsm-CSS: velden volle breedte en 44 px, detail als volgend scherm');

  // ── terugzetten (laatst: de server herstart daarna) ──
  const dbBuf = fs.readFileSync(path.join(BK, h.json.naam));
  const voorN = fs.readdirSync(BK).length;
  const zonder = await fetch(srv.base + '/api/herstel-db', { method: 'POST', headers: { authorization: BASIC, 'x-auth-token': tok, 'content-type': 'application/octet-stream' }, body: dbBuf });
  T.check(zonder.status === 400 && /TERUGZETTEN/.test((await zonder.json()).error) && fs.readdirSync(BK).length === voorN, 'terugzetten zonder het woord → 400, geen wijziging');
  const met = await fetch(srv.base + '/api/herstel-db', { method: 'POST', headers: { authorization: BASIC, 'x-auth-token': tok, 'content-type': 'application/octet-stream', 'x-bevestig': 'TERUGZETTEN' }, body: dbBuf });
  const lijstNa = fs.readdirSync(BK);
  const nieuw = lijstNa.filter((f) => /^sporty-\d{4}-\d{2}-\d{2}-\d{4}\.db$/.test(f));
  T.check(met.status === 200 && nieuw.length >= 1, `terugzetten met TERUGZETTEN → 200, eerst een back-up van de huidige toestand (${nieuw.join(', ')})`);
  await new Promise((r) => setTimeout(r, 1500));
  srv = await T.startServer({ poort: POORT, verseMap: false });
  tok = await T.login(srv.base);
  const lg2 = (await T.api(srv.base, tok, 'GET', '/api/log?type=beheer')).json;
  const tz = lg2.find((l) => l.actie === 'terugzetten');
  T.check(tz && /Back-up teruggezet .* door Claude \(API\); de toestand ervoor staat in sporty-/.test(tz.beschrijving), `na herstart: het terugzetten staat in het Logboek van de nieuwe database ("${tz && tz.beschrijving}")`);
} catch (e) { T.fout('uitzondering: ' + e.stack); }
await T.einde(srv);
