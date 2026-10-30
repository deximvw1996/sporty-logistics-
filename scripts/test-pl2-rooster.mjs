// test-pl2-rooster.mjs — PL2 (chat C): Planning › Rooster (week + seizoen), Gedeeld materiaal en Periodes. Eigen server via _testhulp (poort 3348, herfst-test.db).
// Werking (Maxim 30/10): zelfde thema zelfde week twee locaties = dubbel; zelfde thema zelfde locatie twee opeenvolgende weken = herhaald;
// gedeeld materiaal per week per vast_type (nodig ↔ er zijn) = gedeeld. Groep-labels KL1/KL2/LS1, seizoen, wissel (gelogd), aanvaarden,
// kopieer-periode zonder KV's, pagina's 200 met subbalk (5 links) en 403 voor niet-kantoor, vervangstroken, DOM-bouw met de echte data-JSON.
import * as T from './_testhulp.mjs';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const POORT = parseInt(process.env.TEST_POORT || '3348');
const srv = await T.startServer({ poort: POORT });
const BASIC = 'Basic ' + Buffer.from('sporty:' + T.APP_PASSWORD).toString('base64');
let initSqlJs; try { initSqlJs = require('sql.js'); } catch { initSqlJs = require(T.ROOT + '/../sporty-railway/node_modules/sql.js'); }
const SQL = await initSqlJs();
let tok;
async function db(sql, params = []) {
  const r = await fetch(srv.base + '/api/backup-db', { headers: { authorization: BASIC, 'x-auth-token': tok } });
  const d = new SQL.Database(Buffer.from(await r.arrayBuffer()));
  const st = d.prepare(sql); st.bind(params); const rows = []; while (st.step()) rows.push(st.getAsObject()); st.free(); d.close(); return rows;
}
try {
  tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const P = (m, p, b) => T.api(srv.base, null, m, p, b);
  const PER = 1; // Zomer 2026 (9 weken), in herfst-test.db nog leeg
  const L = (await db("SELECT id,name FROM locaties WHERE type='kamp' ORDER BY id LIMIT 3")).map((r) => r);
  // thema's zonder eigen behoefte, zodat alleen ons testmateriaal meldingen geeft
  const vrij = await db("SELECT id,name FROM themas WHERE id NOT IN (SELECT thema_id FROM thema_behoefte) AND COALESCE(categorie,'')<>'themadag' ORDER BY id LIMIT 12");
  const [tA, tB, tC, tD, tE, tF, tG, tH, tX] = vrij;
  const km = async (loc, week, kv) => (await A('POST', '/api/kampmomenten', { locatie_id: loc.id, week, periode_id: PER, kv_persoon_id: kv || null })).json.id;
  const th = async (k, t, lg) => A('POST', `/api/kampmomenten/${k}/themas`, { thema_id: t.id, leeftijdsgroep: lg });
  const K = {};
  // dubbel: week 1, thema A op L0 en L1
  K.l0w1 = await km(L[0], 1, 7); await th(K.l0w1, tA, 'kleuters');
  K.l1w1 = await km(L[1], 1, 8); await th(K.l1w1, tA, 'lagere school');
  // herhaald: thema B op L2 in week 2 en 3; thema C op L2 in week 5 en 7 (week ertussen) → niet
  K.l2w2 = await km(L[2], 2); await th(K.l2w2, tB, 'kleuters');
  K.l2w3 = await km(L[2], 3); await th(K.l2w3, tB, 'kleuters');
  K.l2w5 = await km(L[2], 5); await th(K.l2w5, tC, 'kleuters');
  K.l2w6 = await km(L[2], 6); await th(K.l2w6, tG, 'kleuters');
  K.l2w7 = await km(L[2], 7); await th(K.l2w7, tC, 'kleuters');
  // gedeeld: 2 springdieren; week 4 drie thema's (D,E,F) → te weinig; week 8 twee (D,E) → precies op
  for (const n of [1, 2]) await A('POST', '/api/vaste-bakken', { naam: 'Pl2 springdier ' + n, vast_type: 'pl2_springdier' });
  for (const t of [tD, tE, tF]) await A('POST', `/api/themas/${t.id}/behoefte`, { vast_type: 'pl2_springdier', aantal: 1 });
  K.l0w4 = await km(L[0], 4, 7); await th(K.l0w4, tD, 'kleuters'); await th(K.l0w4, tG, 'kleuters'); await th(K.l0w4, tH, 'lagere school');
  K.l1w4 = await km(L[1], 4); await th(K.l1w4, tE, 'lagere school');
  K.l2w4 = await km(L[2], 4); await th(K.l2w4, tF, 'kleuters');
  K.l0w8 = await km(L[0], 8); await th(K.l0w8, tD, 'kleuters');
  K.l1w8 = await km(L[1], 8); await th(K.l1w8, tE, 'kleuters');

  const wk = async (w) => (await A('GET', `/api/rooster/week?periode_id=${PER}&week=${w}`)).json;
  const tg = (o, kmId, themaId) => o.locaties.find((l) => l.kampmoment_id === kmId).themas.find((t) => t.thema_id === themaId);
  // ── punt 1: dubbel ──
  let w1 = await wk(1);
  T.check(tg(w1, K.l0w1, tA.id).meldingen.includes('dubbel') && tg(w1, K.l1w1, tA.id).meldingen.includes('dubbel'), `dubbel: ${tA.name} in week 1 op ${L[0].name} én ${L[1].name} → "dubbel" bij beide`);
  T.check(w1.tellers.dubbel === 1 && w1.tellers.alle === 2 && w1.week.label === 'Week 1 · 29/06–3/07', `week 1: tellers alle ${w1.tellers.alle}, dubbel ${w1.tellers.dubbel}; label "${w1.week.label}"`);
  // ── herhaald ──
  const w2 = await wk(2), w3 = await wk(3), w7 = await wk(7);
  T.check(tg(w3, K.l2w3, tB.id).meldingen.includes('herhaald') && !tg(w2, K.l2w2, tB.id).meldingen.includes('herhaald'), `herhaald: ${tB.name} op ${L[2].name} week 2 en 3 → "herhaald" op week 3 (niet op week 2)`);
  T.check(!tg(w7, K.l2w7, tC.id).meldingen.includes('herhaald'), `${tC.name} op ${L[2].name} week 5 en 7 (week 6 ertussen) → geen "herhaald"`);
  // ── gedeeld ──
  const w4 = await wk(4), w8 = await wk(8);
  T.check([[K.l0w4, tD], [K.l1w4, tE], [K.l2w4, tF]].every(([k, t]) => tg(w4, k, t.id).meldingen.includes('gedeeld')) && w4.tellers.gedeeld === 1, 'gedeeld: 3 thema\'s met pl2_springdier en maar 2 beschikbaar (week 4) → "gedeeld" bij alle drie');
  T.check(!tg(w8, K.l0w8, tD.id).meldingen.includes('gedeeld') && !tg(w8, K.l1w8, tE.id).meldingen.includes('gedeeld'), 'bij 2 thema\'s (week 8) geen "gedeeld"');
  // ── groep-labels ──
  const g4 = w4.locaties.find((l) => l.kampmoment_id === K.l0w4).themas.map((t) => t.groep + ' ' + t.naam);
  T.check(g4.join() === [`KL1 ${tD.name}`, `KL2 ${tG.name}`, `LS1 ${tH.name}`].join(), `groep-labels ${L[0].name} week 4: ${g4.join(' · ')}`);
  // ── seizoen ──
  const S = (await A('GET', `/api/rooster/seizoen?periode_id=${PER}`)).json;
  const sr = (t) => S.themas.find((r) => r.thema_id === t.id);
  T.check(sr(tA).weken[0].locaties.map((l) => l.naam).sort().join() === [L[0].name, L[1].name].sort().join() && sr(tA).weken[0].dubbel, `seizoen: ${tA.name} week 1 → ${sr(tA).weken[0].locaties.map((l) => l.naam).join(' + ')} (dubbel)`);
  T.check(sr(tB).weken[1].locaties[0].naam === L[2].name && sr(tB).weken[2].herhaald && !sr(tB).weken[1].herhaald && sr(tC).weken.filter((w) => w.locaties.length).map((w) => w.week).join() === '5,7', `seizoen: ${tB.name} wk 2+3 ${L[2].name} (↻ op wk 3); ${tC.name} wk 5 en 7`);
  T.check(S.weken.length === 9 && S.tellers.alle === 8 && S.tellers.niet_gebruikt === S.niet_gebruikt.length && S.tellers.dubbel === 1 && S.tellers.herhaald === 1, `seizoen tellers: alle ${S.tellers.alle}, dubbel ${S.tellers.dubbel}, herhaald ${S.tellers.herhaald}, niet gebruikt ${S.tellers.niet_gebruikt}`);
  // ── panelen ──
  const KP = (await A('GET', `/api/rooster/kampmoment/${K.l2w3}`)).json;
  const rij = KP.groepen.find((g) => g.groep === 'KL1');
  T.check(rij.voor.naam === tB.name && rij.deze.naam === tB.name && rij.deze.meldingen.includes('herhaald') && KP.let_op.some((l) => l.soort === 'herhaald' && /2 weken na elkaar/.test(l.tekst)), `kampmomentpaneel ${L[2].name} wk 3: KL1 wk2 ${rij.voor.naam} · wk3 ${rij.deze.naam} ↻ · let op "${KP.let_op[0].tekst}"`);
  const KP4 = (await A('GET', `/api/rooster/kampmoment/${K.l0w4}`)).json;
  const gb = KP4.gedeeld.find((s) => s.key === 'vt:pl2_springdier');
  T.check(gb && gb.hier === 1 && gb.beschikbaar === 2 && gb.nodig === 3 && gb.stand === 'te_weinig' && KP4.let_op.some((l) => l.soort === 'gedeeld'), `kampmomentpaneel blok Gedeeld materiaal: "${gb.naam} ${gb.hier} van ${gb.beschikbaar}" (week samen ${gb.nodig})`);
  const TP = (await A('GET', `/api/rooster/thema/${tA.id}?periode_id=${PER}`)).json;
  T.check(TP.plaatsen.length === 2 && TP.vrij.join() === '2,3,4,5,6,7,8,9' && TP.voorstel && /vrij, niet eerder in/.test(TP.voorstel.tekst), `themapaneel ${tA.name}: 2 plaatsen, vrij ${TP.vrij.join(' · ')}, voorstel "${TP.voorstel && TP.voorstel.tekst}"`);
  const TPd = (await A('GET', `/api/rooster/thema/${tD.id}?periode_id=${PER}`)).json;
  T.check(TPd.gedeeld.some((s) => s.key === 'vt:pl2_springdier' && s.andere.includes(tE.name) && s.andere.includes(tF.name)), `themapaneel ${tD.name}: blok Gedeeld materiaal met ${tE.name} en ${tF.name}`);
  // ── wissel ──
  const opt = (await A('GET', `/api/rooster/wissel-opties?kt_id=${tg(w1, K.l1w1, tA.id).kt_id}`)).json;
  T.check(opt.opties[0].voorgesteld && !opt.opties.some((o) => o.thema_id === tA.id), `wissel-keuzelijst: eerst voorstellen (${opt.opties.filter((o) => o.voorgesteld).length}), huidig thema niet in de lijst`);
  const ws = await A('POST', '/api/rooster/wissel', { kampmoment_id: K.l1w1, groep_thema_id: tg(w1, K.l1w1, tA.id).kt_id, nieuw_thema_id: tX.id });
  w1 = await wk(1);
  T.check(ws.status === 200 && ws.json.meldingen.length === 0 && !tg(w1, K.l0w1, tA.id).meldingen.includes('dubbel') && w1.tellers.dubbel === 0, `wissel ${L[1].name} wk 1 ${tA.name} → ${tX.name}: 200, melding "dubbel" weg bij beide`);
  const wl = (await db("SELECT * FROM wijzigingen WHERE tabel='kampmoment_themas' AND actie='update' ORDER BY id DESC LIMIT 1"))[0];
  const al = (await db("SELECT * FROM activiteiten_log WHERE actie='wissel' ORDER BY id DESC LIMIT 1"))[0];
  T.check(JSON.parse(wl.oud).thema_id === tA.id && JSON.parse(wl.nieuw).thema_id === tX.id && wl.persoon_naam === 'Claude (API)' && al && al.beschrijving.includes(`${tA.name} → ${tX.name}`), `wissel gelogd met oud/nieuw (${wl.persoon_naam}): "${al && al.beschrijving}"`);
  T.check((await A('POST', '/api/rooster/wissel', { kampmoment_id: K.l0w4, groep_thema_id: tg(w4, K.l0w4, tD.id).kt_id, nieuw_thema_id: tG.id })).status === 409, 'wissel naar een thema dat al in hetzelfde kampmoment zit → 409 (geen dubbele groep)');

  // ── punt 2b: gedeeld materiaal ──
  const G = async (w) => (await A('GET', `/api/rooster/gedeeld?periode_id=${PER}&week=${w}`)).json;
  let g = (await G(4)).stukken.find((s) => s.vast_type === 'pl2_springdier');
  T.check(g.nodig === 3 && g.beschikbaar === 2 && g.stand === 'te_weinig' && g.waar.length === 3 && g.waar.every((x) => x.kampmoment_id && x.locatie && x.thema), `gedeeld week 4: ${g.naam} nodig ${g.nodig}, er zijn ${g.beschikbaar} → ${g.stand}; waar ${g.waar.map((x) => x.thema + ' · ' + x.locatie).join(' / ')}`);
  const g8 = (await G(8)).stukken.find((s) => s.vast_type === 'pl2_springdier');
  T.check(g8.nodig === 2 && g8.stand === 'precies_op', `gedeeld week 8: nodig ${g8.nodig} van ${g8.beschikbaar} → ${g8.stand}, geen melding`);
  const GS = (await A('GET', `/api/rooster/gedeeld/seizoen?periode_id=${PER}`)).json;
  const gs = GS.stukken.find((s) => s.vast_type === 'pl2_springdier');
  T.check(gs.weken[3].nodig === 3 && gs.weken[3].stand === 'te_weinig' && gs.weken[7].stand === 'precies_op' && gs.weken[0].nodig === 0, `gedeeld seizoen (stuk × week): ${gs.weken.map((w) => w.nodig ? w.nodig + '/' + gs.beschikbaar : '·').join(' ')}`);
  const st = (await A('GET', `/api/rooster/gedeeld/stuk?periode_id=${PER}&week=4&key=vt:pl2_springdier`)).json;
  T.check(st.voorstellen.some((v) => v.soort === 'aanvaard') && st.vorige && st.volgende && st.zomer.length === 2, `stukpaneel: voorstellen ${st.voorstellen.map((v) => v.tekst).join(' / ')}; week ervoor ${st.vorige.nodig} · erna ${st.volgende.nodig}`);
  const av = await A('POST', '/api/rooster/gedeeld/aanvaard', { periode_id: PER, week: 4, key: 'vt:pl2_springdier', thema_id: tF.id });
  const w4b = await wk(4);
  T.check(av.status === 200 && av.json.stuk.stand === 'precies_op' && !tg(w4b, K.l2w4, tF.id).meldingen.includes('gedeeld') && !tg(w4b, K.l0w4, tD.id).meldingen.includes('gedeeld'), `aanvaarden "${tF.name} zonder springdier" → stand ${av.json.stuk.stand}, melding weg voor die week`);
  const alA = (await db("SELECT beschrijving FROM activiteiten_log WHERE actie='gedeeld' ORDER BY id DESC LIMIT 1"))[0];
  T.check(/zonder Pl2 springdier|zonder .*springdier/i.test(alA.beschrijving) && /Claude \(API\)/.test(alA.beschrijving), `aanvaarden gelogd: "${alA.beschrijving}"`);
  await A('POST', '/api/rooster/gedeeld/aanvaard', { periode_id: PER, week: 4, key: 'vt:pl2_springdier', thema_id: tF.id, terug: true });
  g = (await G(4)).stukken.find((s) => s.vast_type === 'pl2_springdier');
  T.check(g.stand === 'te_weinig', 'terugdraaien → weer te weinig');

  // ── punt 3: periodes ──
  const PD = (await A('GET', `/api/periodes/${PER}/detail`)).json;
  const kl = Object.fromEntries(PD.klaar.map((k) => [k.sleutel, k]));
  T.check(PD.weken.length === 9 && PD.weken[3].kampmomenten === 3 && kl.dubbel.probleem === 0 && kl.gedeeld.probleem === 1 && kl.kv.probleem > 0 && kl.transport.probleem > 0 && kl.themas.link === '/kampmomenten' && /\/gedeeld/.test(kl.gedeeld.link),
    `periodedetail: 9 weken, klaar voor de start: ${PD.klaar.map((k) => k.label + ' ' + k.tekst).join(' · ')}`);
  T.check(!PD.klaar.some((k) => k.sleutel === 'sport') && /sportrooster\/seizoen bestaat nog niet/.test(PD.sport_gemeld), 'sport (te weinig sets) weggelaten: /api/sportrooster/seizoen bestaat nog niet (gemeld)');
  T.check(PD.gesloten.some((x) => x.datum === '2026-08-15'), 'gesloten dagen in de periode: 15/08 nationale feestdag');
  const PO = (await A('GET', '/api/periodes-overzicht')).json;
  T.check(PO.periodes.length === 2 && PO.periodes.find((p) => p.id === PER).km_tekst === '12 op 3 locaties', `periodelijst: ${PO.periodes.map((p) => p.naam + ' ' + p.datums + ' · ' + p.km_tekst + ' · ' + p.stand).join(' / ')}`);
  const kp = await A('POST', `/api/periodes/${PER}/kopieer`, { naam: 'Zomer 2027 PL2', start_datum: '2027-06-28', eind_datum: '2027-08-27' });
  const nk = await db('SELECT * FROM kampmomenten WHERE periode_id=?', [kp.json.id]);
  const nt = await db('SELECT COUNT(*) AS n FROM kampmoment_themas WHERE kampmoment_id IN (SELECT id FROM kampmomenten WHERE periode_id=?)', [kp.json.id]);
  const nr = await db('SELECT COUNT(*) AS n FROM transport_taken WHERE kampmoment_id IN (SELECT id FROM kampmomenten WHERE periode_id=?)', [kp.json.id]);
  T.check(kp.status === 200 && nk.length === 12 && nk.every((k) => !k.kv_persoon_id) && nt[0].n === kp.json.themas && nt[0].n === 14 && nr[0].n === 0, `kopieer-periode: ${nk.length} kampmomenten zonder KV, ${nt[0].n} thema's, 0 ritten/taken`);
  const lk = (await db("SELECT beschrijving FROM activiteiten_log WHERE type='periode' AND actie='kopie' ORDER BY id DESC LIMIT 1"))[0];
  const wk2 = await db("SELECT COUNT(*) AS n FROM wijzigingen WHERE context LIKE 'periode kopiëren%'");
  T.check(lk && /zonder KV/.test(lk.beschrijving) && wk2[0].n === 1 + 12 + 14, `kopie gelogd: "${lk && lk.beschrijving}" + ${wk2[0].n} rijen in wijzigingen`);

  // ── pagina's + rechten ──
  const NAV = require(T.ROOT + '/public/nav.js');
  for (const pad of ['/rooster', '/gedeeld', '/periodes']) {
    const r = await fetch(srv.base + pad, { headers: { authorization: BASIC, 'x-auth-token': tok } });
    const html = await r.text(), sb = NAV.sub(NAV.PAGINA[pad], pad);
    T.check(r.status === 200 && /class="sub"/.test(html) && /nav\.js/.test(html) && (sb.match(/<a /g) || []).length === 5 && sb.includes(`class="act" href="${pad}"`), `GET ${pad} 200 met subbalk (5 links: ${NAV.SUB.planning.map((s) => s[0]).join(' · ')}; "${pad}" actief)`);
  }
  T.check(NAV.SUB.planning.map((s) => s[1]).join() === '/kampmomenten,/rooster,/sportrooster,/gedeeld,/periodes', 'nav.js Planning-subbalk: /kampmomenten · /rooster · /sportrooster · /gedeeld · /periodes');
  const chauf = (await A('POST', '/api/personeel', { naam: 'Pl2 Chauffeur', rol: 'chauffeur' })).json;
  await A('POST', `/api/personeel/${chauf.id}/pincode`, { pincode: '4323' });
  const htok = (await P('POST', '/api/login', { persoon_id: chauf.id, pincode: '4323' })).json.token;
  const nk403 = [];
  for (const pad of ['/rooster', '/gedeeld', '/periodes']) nk403.push((await fetch(srv.base + pad, { headers: { authorization: BASIC, 'x-auth-token': htok } })).status);
  for (const pad of ['/api/rooster/week', '/api/rooster/seizoen', '/api/rooster/gedeeld', '/api/periodes-overzicht']) nk403.push((await T.api(srv.base, htok, 'GET', pad)).status);
  nk403.push((await T.api(srv.base, htok, 'POST', '/api/rooster/wissel', {})).status);
  T.check(nk403.every((s) => s === 403), `niet-kantoor (chauffeur): pagina's en API ${nk403.join(',')}`);
  // ── vervangstroken ──
  const idx = fs.readFileSync(T.ROOT + '/index.html', 'utf8');
  T.check(/ov==='rooster'\)links=\[\['Planning › Rooster','\/rooster'\]\]/.test(idx) && /ov==='themas'\)\{links=\[\['Planning › Rooster','\/rooster'\],\['Gedeeld materiaal','\/gedeeld'\]\]/.test(idx) && /ov==='periodes'\)links=\[\['Planning › Periodes','\/periodes'\]\]/.test(idx)
    && /km==='sport'\)links=\[\['Planning › Sportrooster','\/sportrooster'\]\]/.test(idx) && /_pl2Ov='periodes';toonVervangstrook/.test(idx) && /_pl2Ov='rooster';toonVervangstrook/.test(idx) && /_pl2Ov='themas';toonVervangstrook/.test(idx) && /_kampMode=mode;toonVervangstrook/.test(idx),
    'index.html: vervangstroken op de oude tabs Rooster → /rooster, Thema\'s per week → /rooster + /gedeeld, Periodes → /periodes (kampplanner per modus)');

  // ── DOM-bouw met echte data-JSON ──
  const t = (h) => h.replace(/<[^>]+>/g, '\n').replace(/&amp;/g, '&').replace(/\n\s*\n+/g, '\n').trim().split('\n').join(' | ');
  const RB = require(T.ROOT + '/public/rooster.js'), GB = require(T.ROOT + '/public/gedeeld.js'), PB = require(T.ROOT + '/public/periodes.js');
  const w4c = await wk(4);
  const rh = RB.weekRij(w4c.locaties.find((l) => l.kampmoment_id === K.l0w4));
  T.check(/class="tg ged"><i>KL1<\/i>/.test(rh) && rh.includes(`${tD.name} ◐`) && /<i>LS1<\/i>/.test(rh), `weekrij: ${t(rh)}`);
  const fw = RB.filtersWeek(w4c, 'alle');
  T.check(/Week 4 · 20–24\/07/.test(fw) && /⚠ Dubbel 0/.test(fw) && /◐ Gedeeld 1/.test(fw) && /Geen KV/.test(fw), `filters week: ${t(fw)}`);
  const ras = RB.raster(S, S.themas, { thema: tB.id, week: 3 });
  T.check(/class="c her sel"/.test(ras) && /class="c dub"/.test(ras) && (ras.match(/class="h /g) || []).length === 9, 'seizoensraster: 9 weekkolommen, cel ↻ (her, geselecteerd) en ⚠ (dub)');
  const kph = RB.kmPaneel((await A('GET', `/api/rooster/kampmoment/${K.l0w4}`)).json, 'week');
  T.check(/Thema's per groep · week ervoor en erna/.test(kph) && /Let op \(1\)/.test(kph) && /Sport en transport/.test(kph) && /Gedeeld materiaal/.test(kph) && /1 van 2/.test(kph) && /Open kampmoment/.test(kph), `kampmomentpaneel: ${t(kph).slice(0, 300)}`);
  const tph = RB.themaPaneel(TPd);
  T.check(/hele zomer/.test(tph) && /Vrij in/.test(tph) && /Gedeeld materiaal/.test(tph) && /Naar weekbeeld/.test(tph), `themapaneel: ${t(tph).slice(0, 220)}`);
  const go = await G(4);
  const gr = GB.rij(go.stukken.find((s) => s.vast_type === 'pl2_springdier'));
  T.check(/⚠ te weinig/.test(gr) && /class="get n">3/.test(gr) && /class="get z">2/.test(gr), `gedeeld-rij: ${t(gr)}`);
  const gp = GB.paneelWeek(st, 'week');
  T.check(/Wie heeft het nodig/.test(gp) && /Voorstel/.test(gp) && /Week ervoor en erna/.test(gp) && /geen bak meer vrij/.test(gp) && /Aanvaarden/.test(gp), `gedeeld-paneel: ${t(gp).slice(0, 260)}`);
  T.check(/⚠ Te weinig 1/.test(GB.filtersWeek(go, 'nodig')) && /Nodig deze week/.test(GB.filtersWeek(go, 'nodig')), 'gedeeld-chips: Nodig deze week · Alle · ⚠ Te weinig · Precies op');
  const pdh = PB.detail((await A('GET', `/api/periodes/${PER}/detail`)).json, 'weken', false);
  T.check(/Kampweken/.test(pdh) && /\+ 5 andere weken/.test(pdh) && /Klaar voor de start\?/.test(pdh) && /Kopieer naar nieuwe periode/.test(pdh) && /Gesloten dagen/.test(pdh), `periodedetail: ${t(pdh).slice(0, 260)}`);
  // gsm-regels (de echte meting in de browser staat in het verslag)
  const css = fs.readFileSync(T.ROOT + '/public/rooster.css', 'utf8');
  T.check(/@media \(max-width:767px\)[\s\S]*\.scroll\.raster\{overflow-x:auto/.test(css) && /\.sgrid \.l,\.sgrid \.h:first-child\{position:sticky;left:0/.test(css) && /\.knop,\.chip\{min-height:44px\}/.test(css) && /\.body\.toon-detail>\.kaart\.lijstkaart\{display:none\}/.test(css),
    'gsm-CSS: raster scrollt horizontaal binnen zichzelf, eerste kolom vast, knoppen/chips ≥ 44 px, paneel als volgend scherm');
} catch (e) { T.fout('uitzondering: ' + e.stack); }
await T.einde(srv);
