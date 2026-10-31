// test-tf4-keten.mjs — TF4 (chat D): blokkers T2 (G2 Nakijken-CSS, G4 vastgelopen bak, G11 terug naar pool, G16 printlijst, G17),
// zichtbaarheid van meldingen (G22–G26), planning melden (G8–G10), ritplanning en kleine fouten.
// Eigen server via _testhulp (poort 3360 of TEST_POORT, herfst-test.db).
import * as T from './_testhulp.mjs';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const lees = (p) => fs.readFileSync(T.ROOT + '/' + p, 'utf8');
const ijk = T.leesIjk();
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const srv = await T.startServer({ poort: Number(process.env.TEST_POORT) || 3360 });
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const P = (m, p, b) => T.api(srv.base, null, m, p, b);
  const R = ijk.locaties.rozenweg, km = ijk.kampmomenten.abdijschool, thema = ijk.themas.alles_op_wieltjes;
  const AV = require(T.ROOT + '/public/aanvullen.js');

  // ── bak met 3 stukken: Prints tekort (bestellen), Bal te veel (naar pool), Lint klopt ──
  const bakId = (await A('POST', `/api/themas/${thema}/bakken`, { label: 'Tf4 bak', code: 'TF01' })).json.id;
  for (const [n, q] of [['Tf4 Prints', 5], ['Tf4 Bal', 3], ['Tf4 Lint', 2]]) await A('POST', `/api/bakken/${bakId}/items`, { naam: n, qty: q });
  await A('POST', `/api/kampmomenten/${km}/themas`, { thema_id: thema });
  const kvtok = await T.kvToken(srv.base, tok, km);
  const d0 = (await P('GET', `/api/kv/${kvtok}/data`)).json, kb = d0.bakken.find((b) => b.code === 'TF01');
  const tel = (n, a) => P('POST', `/api/kv/${kvtok}/bakken/${kb.id}/tellen`, { regels: [{ item_id: kb.items.find((i) => i.naam === n).id, aangetroffen: a }] });
  await tel('Tf4 Prints', 3); await tel('Tf4 Bal', 5); await tel('Tf4 Lint', 2);
  await P('POST', `/api/kv/${kvtok}/versturen`, {});
  const typeVan = async (n) => (await T.leesDb(srv.dbPad, 'SELECT item_type_id AS t FROM bak_items WHERE bak_id=? AND naam=?', [bakId, n]))[0].t;
  const prints = await typeVan('Tf4 Prints'), bal = await typeVan('Tf4 Bal');
  await A('PUT', `/api/catalogus/${prints}/voorraad`, { locatie_id: R, qty: 20 });
  await A('PUT', `/api/catalogus/${bal}/voorraad`, { locatie_id: R, qty: 5 });
  const stock = async (t) => ((await T.leesDb(srv.dbPad, 'SELECT qty FROM item_type_stock WHERE item_type_id=? AND locatie_id=?', [t, R]))[0] || { qty: 0 }).qty;
  const nk = (await A('GET', '/api/nakijken')).json.bakken.find((b) => b.bak.code === 'TF01' && b.kampmoment_id === km);
  let det = (await A('GET', `/api/nakijken/sessie/${nk.sessie_id}`)).json;
  const reg = (n) => det.items.find((i) => i.naam === n);
  // T1-G13: kop en lijst tellen hetzelfde (stuks)
  T.check(det.afwijkingen.tekort === 2 && det.afwijkingen.te_veel === 2 && nk.uitslag_tekst.includes('tekort 2') && nk.uitslag_tekst.includes('te veel 2'), `tellers lijst en kop gelijk: lijst "${nk.uitslag_tekst}", kop tekort ${det.afwijkingen.tekort} / te veel ${det.afwijkingen.te_veel}`);
  await A('PUT', `/api/nakijken/regel/${reg('Tf4 Prints').regel_id}`, { kantoor_actie: 'bestellen', kantoor_aantal: 2 });
  await A('PUT', `/api/nakijken/regel/${reg('Tf4 Bal').regel_id}`, { kantoor_actie: 'naar_pool', kantoor_aantal: 2 });
  let r = await A('POST', `/api/nakijken/sessie/${nk.sessie_id}/afronden`);
  T.check(r.status === 200 && r.json.bestellingen === 1, `keuring afgerond, ${r.json.bestellingen} bestelling`);
  T.check((await A('POST', `/api/nakijken/sessie/${nk.sessie_id}/afronden`)).json.bestellingen === 0, 'G29: opnieuw afronden telt geen oude bestelling mee (0)');
  T.check((await stock(prints)) === 20 && (await stock(bal)) === 5, 'voorraad na afronden ongewijzigd (Prints 20, Bal 5)');

  // ═══ G4: Tekorten → Bestellen → binnen → afvinkbaar → Bak klaar ═══
  let ov = (await A('GET', '/api/tekorten-overzicht')).json;
  const art = ov.artikels.find((a) => /Tf4 Prints/.test(a.naam));
  T.check(art, `Tekorten kent het artikel (stand ${art && art.stand})`);
  let data = (await A('GET', '/api/aanvullijst?alles=1')).json;
  let g = data.bakken.find((b) => b.bak.code === 'TF01');
  const hP = () => g.handelingen.find((x) => /Prints/.test(x.stuk)), hB = () => g.handelingen.find((x) => /Bal/.test(x.stuk));
  T.check(hP().kan_afvinken === false && hP().soort === 'bestelling', 'vóór binnen: Prints wacht op levering');
  r = await A('POST', `/api/tekorten/${art.artikel_id}/besteld`, { aantal: 2 });
  T.check(r.status === 200, `Tekorten › Bestellen (${r.status})`);
  r = await A('POST', `/api/tekorten/${art.artikel_id}/binnen`, {});
  T.check(r.status === 200 && (await stock(prints)) === 22, `Tekorten › Bestelling binnen: voorraad Prints ${await stock(prints)} (20 + 2)`);
  data = (await A('GET', '/api/aanvullijst?alles=1')).json; g = data.bakken.find((b) => b.bak.code === 'TF01');
  T.check(hP().kan_afvinken === true, 'G4: na "binnen" is Prints afvinkbaar (niet meer ⏳)');
  r = await A('POST', `/api/aanvullijst/${hP().regel_id}/aangevuld`, { aangevuld: true });
  T.check(r.status === 200 && (await stock(prints)) === 20, `afvinken: voorraad Prints ${await stock(prints)} (22 − 2, niet dubbel geteld)`);
  r = await A('POST', `/api/aanvullijst/${hP().regel_id}/aangevuld`, { aangevuld: false });
  T.check((await stock(prints)) === 22, `terugzetten: voorraad Prints ${await stock(prints)}`);
  await A('POST', `/api/aanvullijst/${hP().regel_id}/aangevuld`, { aangevuld: true });
  T.check((await stock(prints)) === 20, 'opnieuw afvinken: 20');
  T.check((await A('POST', `/api/tekorten/${art.artikel_id}/binnen`, {})).status === 409 && (await stock(prints)) === 20, 'tweede "binnen" wordt geweigerd: nooit dubbel');

  // ═══ G11: naar pool verhoogt de voorraad, terugzetten draait het terug ═══
  T.check(hB().soort === 'naar_pool' && hB().kan_afvinken === true, 'Bal staat als "naar pool" en is afvinkbaar');
  r = await A('POST', `/api/aanvullijst/${hB().regel_id}/aangevuld`, { aangevuld: true });
  T.check(r.status === 200 && (await stock(bal)) === 7, `G11: afvinken naar pool: voorraad Bal ${await stock(bal)} (5 + 2)`);
  r = await A('POST', `/api/aanvullijst/${hB().regel_id}/aangevuld`, { aangevuld: true });
  T.check((await stock(bal)) === 7, 'tweede keer afvinken telt niet opnieuw (7)');
  r = await A('POST', `/api/aanvullijst/${hB().regel_id}/aangevuld`, { aangevuld: false });
  T.check((await stock(bal)) === 5, `terugzetten: voorraad Bal ${await stock(bal)} (weer 5)`);
  await A('POST', `/api/aanvullijst/${hB().regel_id}/aangevuld`, { aangevuld: true });
  T.check((await stock(bal)) === 7, 'opnieuw afvinken: 7');
  data = (await A('GET', '/api/aanvullijst?alles=1')).json; g = data.bakken.find((b) => b.bak.code === 'TF01');
  T.check(AV.bakKlaar(g) && AV.bak(g, {}).includes('Bak TF01 klaar (2/2)') && !/data-av="klaar" disabled/.test(AV.bak(g, {})), 'G4: Bak klaar actief (2/2)');
  // deels naar pool
  const sess2 = nk.sessie_id; void sess2;

  // ═══ G25: herstellen heet herstellen ═══
  T.check(/herstellen/.test(AV.handeling({ regel_id: 1, stuk: 'x', aantal: 1, soort: 'nakijken', actie: 'herstellen', kan_afvinken: true, aangevuld: 0, waar_tekst: '' }, {})) && !/zelf tellen/.test(AV.handeling({ regel_id: 1, stuk: 'x', aantal: 1, soort: 'nakijken', actie: 'herstellen', kan_afvinken: true, aangevuld: 0, waar_tekst: '' }, {})), 'G25: "herstellen" krijgt het label herstellen, niet "zelf tellen"');

  // ═══ G24: volledige bak in de meldoverlay, ook bij een bak zonder handelingen ═══
  const leeg = data.bakken.find((b) => b.bak.code === 'TF01');
  T.check(Array.isArray(leeg.inhoud) && ['Tf4 Prints', 'Tf4 Bal', 'Tf4 Lint'].every((n) => leeg.inhoud.includes(n)), `G24: de groep kent de volledige inhoud (${leeg.inhoud.join(', ')})`);
  const ovl = AV.meldOverlay({ soort: 'kapot', aantal: 1, stuk: 'Tf4 Lint', naam: '', notitie: '', foto: '' }, leeg);
  T.check(ovl.includes('value="Tf4 Lint" selected') && ovl.includes('value="Tf4 Prints"') && ovl.includes('value="Tf4 Bal"'), 'G24: de overlay toont ook Lint (geen handeling) en afgevinkte stukken');
  const bak2 = (await A('POST', `/api/themas/${thema}/bakken`, { label: 'Tf4 leeg', code: 'TF02' })).json.id;
  await A('POST', `/api/bakken/${bak2}/items`, { naam: 'Tf4 Paal', qty: 2 });
  const kv2 = (await P('GET', `/api/kv/${kvtok}/data`)).json.bakken.find((b) => b.code === 'TF02');
  await P('POST', `/api/kv/${kvtok}/bakken/${kv2.id}/tellen`, { regels: [{ item_id: kv2.items[0].id, aangetroffen: 2 }] });
  await P('POST', `/api/kv/${kvtok}/versturen`, {});
  const nk2 = (await A('GET', '/api/nakijken')).json.bakken.find((b) => b.bak.code === 'TF02' && b.kampmoment_id === km);
  await A('POST', `/api/nakijken/sessie/${nk2.sessie_id}/afronden`);
  data = (await A('GET', '/api/aanvullijst?alles=1')).json;
  const g2 = data.bakken.find((b) => b.bak.code === 'TF02');
  T.check(g2 && g2.leeg === true && g2.handelingen.length === 0 && g2.inhoud.includes('Tf4 Paal'), 'G24: een bak zonder handelingen staat in de lijst en is meldbaar');
  T.check(AV.lijst(data, { vandaag: '2026-11-10' }).includes('niets aan te vullen') && data.tellers.bakken === data.bakken.filter((b) => !b.leeg).length, 'lijst: "niets aan te vullen" en de teller telt zulke bakken niet');
  r = await A('POST', '/api/aanvullijst/melding', { sessie_id: nk2.sessie_id, item_naam: 'Tf4 Paal', soort: 'kapot', aantal: 1, foto_data: PNG });
  T.check(r.status === 200, 'melden op een bak zonder handelingen lukt');

  // ═══ G22 + G26 + G14: melding opgeteld, losse melding, Gemeld-chip ═══
  await A('POST', '/api/aanvullijst/melding', { sessie_id: nk2.sessie_id, item_naam: 'tf4 paal', soort: 'kapot', aantal: 2, foto_data: PNG });
  const mm = (await A('GET', '/api/meldingen')).json.meldingen.filter((m) => /Tf4 Paal.*gemeld vanuit/i.test(m.tekst)); // TF5: een natelling van de KV geeft nu ook een eigen melding
  T.check(mm.length === 1 && /\(3×\)/.test(mm[0].tekst) && mm[0].gelezen === false, `G22: de kantoormelding werd bijgewerkt naar het nieuwe aantal: "${mm[0] && mm[0].tekst}"`);
  r = await A('POST', '/api/aanvullijst/melding', { item_naam: 'Tf4 Losse emmer', soort: 'weg', aantal: 1 });
  const lijst = (await A('GET', '/api/nakijken')).json;
  const lm = lijst.bakken.find((b) => b.bak.soort === 'melding');
  T.check(lm && lm.gemeld === 1 && lm.gemeld_op && lijst.tellers.gemeld >= 2, `G14: tellers.gemeld ${lijst.tellers.gemeld}, losse melding heeft gemeld_op ${lm && lm.gemeld_op}`);
  T.check(lijst.bakken.slice(0, lijst.tellers.gemeld).every((b) => b.gemeld > 0), 'G14: gemelde bakken staan bovenaan');
  const nkJs = require(T.ROOT + '/public/nakijken.js');
  const hl = nkJs.lijstHtml(lijst, { filter: 'gemeld', zoek: '', geselecteerd: new Set() });
  T.check(/data-a="gemeld"/.test(hl) && hl.includes('Gemeld ' + lijst.tellers.gemeld) && hl.includes('gemeld vandaag') && !/wk\s*<\/small>|wk null|wk undefined/.test(hl), 'G14/G26: chip "Gemeld" met teller; losse melding toont "stockage · gemeld vandaag", geen lege week');
  data = (await A('GET', '/api/aanvullijst?alles=1')).json;
  T.check(data.tellers.gemeld >= 2 && data.tellers.totaal === data.bakken.flatMap((b) => b.handelingen).filter((h) => !h.wacht_op_kantoor).length, 'G26: een melding die wacht telt niet als handeling');

  // ═══ G16: printlijst ═══
  const pr = lees('public/aanvullijst-print.html');
  T.check(/nav\.js[\s\S]*nakijken\.js/.test(pr), 'G16: de printpagina laadt nav.js (sportyApi) vóór nakijken.js');
  T.check((await A('GET', '/api/aanvullijst')).status === 200 && (await P('GET', '/aanvullijst-print')).status === 200, 'printlijst: pagina en data bereikbaar');
  // (de echte printpagina is live in de browser bekeken: zie het verslag)

  // ═══ G2 en G17 (CSS/JS) ═══
  const schil = lees('public/app-schil.css'), nkCss = lees('public/nakijken.css');
  const regelsNaSchermen = schil.slice(schil.indexOf('/* schermen'));
  T.check(!/(^|[\s,}])\.tel[\s{.,]/m.test(regelsNaSchermen.replace(/\.tel:not\(\.r\):not\(\.kopr\)/g, '')) && /\.r\.tel/.test(nkCss), 'G2: de schilregels voor .tel gelden niet voor .r.tel en .kopr.tel van Nakijken');
  const nkSrc = lees('public/nakijken.js');
  T.check(/if \(\$\('s-tekorten'\)\)/.test(nkSrc) && /if \(\$\('wie'\)\)/.test(nkSrc), 'G17: s-tekorten en per-naam worden alleen gezet als ze bestaan');
  T.check(!/root\.location\.href = '\/';/.test(nkSrc) && /\/login/.test(nkSrc), 'G3 (eigen bestanden): niet ingelogd → /login');

  // ═══ Punt 3 ═══
  const kmJs = lees('public/kampmomenten.js'), roJs = lees('public/rooster.js'), roSrv = lees('routes/rooster.js');
  T.check(/themas_bezet/.test(kmJs) && /staat al in/.test(kmJs) && !/nergens anders gepland zijn/.test(kmJs), 'G8: de themakeuze toont ook thema\'s die al elders staan, onderaan met "staat al in <locatie>"');
  const RO = require(T.ROOT + '/public/rooster.js');
  const kmD = { kampmoment: { locatie: 'Test', id: 1, kv: '', periode_id: 1 }, week: { nr: 2, kort: '2–6/11' }, let_op: [{ soort: 'gesloten', tekst: '⛔ Gesloten dag in deze week: wo 4/11', uitleg: 'x', knop: '' }], groepen: [{ groep: 'KL1', voor: null, deze: { naam: 'Thema Een', kt_id: 77, meldingen: [] }, na: null }], sport: [], transport: {}, gedeeld: [], zomer: [], historiek: [], vorige_week: null, volgende_week: null };
  const panel = RO.kmPaneel(kmD, 'week');
  T.check(/data-wissel="77"/.test(panel) && /Gesloten dag in deze week/.test(panel) && /Hele periode/.test(panel), 'G9/G10: Wissel bij elk thema van de week; gesloten dag staat bij "Let op"; tab "Hele periode"');
  // gesloten dag in de API: melding + teller (geen verbod)
  const per = (await A('GET', '/api/periodes')).json.find((p) => p.actief) || (await A('GET', '/api/periodes')).json[0];
  const wk1 = (await A('GET', `/api/rooster/week?periode_id=${per.id}&week=1`)).json;
  const eerste = wk1.locaties[0];
  const dag = wk1.week.van;
  r = await A('POST', '/api/instellingen/gesloten', { van: dag, reden: 'TF4-test', locatie_id: eerste.locatie_id });
  const wk1b = (await A('GET', `/api/rooster/week?periode_id=${per.id}&week=1`)).json;
  const l1 = wk1b.locaties.find((l) => l.kampmoment_id === eerste.kampmoment_id);
  T.check(l1.gesloten.length === 1 && l1.meldingen_n === eerste.meldingen_n + 1 && wk1b.tellers.gesloten >= 1, `G10: gesloten dag ${dag} geeft een melding in het rooster (meldingen ${eerste.meldingen_n} → ${l1.meldingen_n}, teller ${wk1b.tellers.gesloten}); status ${r.status}`);
  const rij = RO.weekRij(l1, {});
  T.check(/gesloten/.test(rij) && /Gesloten/.test(RO.filtersWeek(wk1b, 'alle')), 'G10: het scherm toont het label en de chip "Gesloten"');
  T.check(/herhaald/.test(roSrv) && /↻ Herhaald/.test(roJs), 'rooster: chip "↻ Herhaald" aanwezig (live bekeken in de browser)');

  // ═══ Punt 4 ═══
  const rp = lees('public/ritplanning.js'), ritJs = lees('public/rit.js');
  T.check(/data-bsel/.test(rp) && /bestuurderWissel/.test(rp), 'G12: bestuurder wisselen in het ritdetail op desktop');
  T.check(!/Goedkeuren'/.test(rp) && /'Klaarzetten'/.test(rp), 'G30: ook op gsm heet de knop "Klaarzetten"');
  T.check(/ritlink/.test(rp) && /data-act="kopieer"/.test(rp), 'G19: rit-link blijft staan met een kopieerknop');
  T.check(/gel \+ ' van ' \+ tot \+ ' stuks geladen'/.test(ritJs), 'G20: de rit-kop telt stuks');
  T.check(/'rit':'ritten'/.test(rp), 'G29: "1 rit" in enkelvoud');
  T.check(/r\.status==='gedaan'&&\/plaatsen\//.test(rp), 'T1-G12: geen capaciteitswaarschuwing op een gedane rit');
} catch (e) { T.fout('uitzondering: ' + (e && e.stack || e)); }
await T.einde(srv);
