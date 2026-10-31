// test-bw1.mjs — BW1 (chat D): nieuw kampmoment (punt 1), themakeuze + migratie (punt 2), standaardmateriaal per locatie (punt 3).
// Eigen server via _testhulp (poort 3364 of TEST_POORT, herfst-test.db). T.check(voorwaarde, tekst).
import * as T from './_testhulp.mjs';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const lees = (p) => fs.readFileSync(T.ROOT + '/' + p, 'utf8');
const ijk = T.leesIjk();
const poort = Number(process.env.TEST_POORT) || 3364;
let srv = await T.startServer({ poort });
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const q = (s, p = []) => T.leesDb(srv.dbPad, s, p);
  const vandaag = (() => { const d = new Date(); return d.toISOString().slice(0, 10); })();
  const plusDagen = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

  // ═══ migratie ═══
  T.info('Migratie');
  const kol = async (t) => (await q(`PRAGMA table_info(${t})`)).map((c) => c.name);
  T.check((await kol('themas')).includes('extern_firma') && (await kol('themas')).includes('is_zwem') && (await kol('themas')).includes('locatie_nodig'), 'themas heeft extern_firma, is_zwem en locatie_nodig');
  T.check((await kol('kampmoment_themas')).includes('groepen') && (await kol('kampmomenten')).includes('standaard_materiaal'), 'kampmoment_themas.groepen en kampmomenten.standaard_materiaal bestaan');
  const th0 = (await q('SELECT COUNT(*) n, SUM(CASE WHEN leeftijdsgroep<>\'\' THEN 1 ELSE 0 END) m FROM themas'))[0];
  // ═══ periodes: 2 weken en 3 weken ═══
  const p2 = (await A('POST', '/api/periodes', { naam: 'BW1 twee weken', start_datum: '2027-03-01', eind_datum: '2027-03-14' })).json;
  const p3 = (await A('POST', '/api/periodes', { naam: 'BW1 drie weken', start_datum: '2027-05-03', eind_datum: '2027-05-23' })).json;
  const pNu = (await A('POST', '/api/periodes', { naam: 'BW1 nu', start_datum: vandaag, eind_datum: plusDagen(13) })).json;
  const LOC = { a: ijk.locaties.abdijschool, b: ijk.locaties.betekom, c: 33, d: 35, e: 31 };
  const themas = (await A('GET', `/api/themakeuze?periode_id=${p2.id}`)).json.themas;
  const kamp = themas.filter((t) => t.categorie === 'kamp');
  const [t1, t2, t3] = [kamp[0], kamp[1], kamp[2]];

  // ═══ punt 1 · nieuw kampmoment ═══
  T.info('Punt 1 · nieuw kampmoment');
  let r = await A('POST', '/api/kampmomenten/nieuw', { periode_id: p2.id, locatie_id: LOC.a, weken: [1] });
  const leegId = r.json.weken && r.json.weken[0] && r.json.weken[0].id;
  T.check(r.status === 200 && r.json.gemaakt === 1 && leegId, 'leeg kampmoment: alleen locatie en week, zonder thema (' + JSON.stringify(r.json.weken && r.json.weken.map((w) => w.status)) + ')');
  T.check((await q('SELECT COUNT(*) n FROM kampmoment_themas WHERE kampmoment_id=?', [leegId]))[0].n === 0 && (await q('SELECT standaard_materiaal s FROM kampmomenten WHERE id=?', [leegId]))[0].s === 1, 'zonder thema\'s; standaardmateriaal staat standaard aan');
  r = await A('POST', '/api/kampmomenten/nieuw', { periode_id: p2.id, locatie_id: LOC.b, weken: [1, 2], dagen: [true, true, true, true, true, false, false], themas: [{ thema_id: t1.id, groepen: 2 }, { thema_id: t2.id, groepen: 1 }, { thema_id: t3.id, groepen: 3 }], standaard_materiaal: true });
  T.check(r.status === 200 && r.json.gemaakt === 2 && r.json.bestond_al === 0, 'volledig kampmoment over 2 weken: 2 gemaakt');
  const kmB = r.json.weken.map((w) => w.id);
  const ktB = await q('SELECT kampmoment_id,thema_id,groepen FROM kampmoment_themas WHERE kampmoment_id IN (?,?) ORDER BY kampmoment_id,id', kmB);
  T.check(ktB.length === 6 && ktB.filter((x) => x.kampmoment_id === kmB[0]).map((x) => x.groepen).join() === '2,1,3' && ktB.filter((x) => x.kampmoment_id === kmB[1]).map((x) => x.groepen).join() === '2,1,3', 'beide weken krijgen 3 thema\'s met groepen 2, 1 en 3');
  const dagenB = await q("SELECT COUNT(*) n FROM kalender_dagen WHERE locatie_id=? AND datum BETWEEN '2027-03-01' AND '2027-03-14'", [LOC.b]);
  T.check(dagenB[0].n === 10, 'ma–vr geopend in beide weken (' + dagenB[0].n + ' dagen)');
  const detail = (await A('GET', `/api/kampmomenten/${kmB[0]}/detail`)).json;
  T.check(detail.themas.map((t) => t.groepen).join() === '2,1,3' || detail.themas.length === 3, 'het detail toont de groepen per thema');
  const ktId = detail.themas[0].kt_id;
  r = await A('PUT', `/api/kampmomenten/${kmB[0]}/themas/${ktId}/groepen`, { groepen: 5 });
  T.check(r.status === 200 && (await q('SELECT groepen g FROM kampmoment_themas WHERE id=?', [ktId]))[0].g === 5, 'aantal groepen is te wijzigen in het kampmoment');
  r = await A('PUT', `/api/kampmomenten/${kmB[0]}/themas/${ktId}/groepen`, { groepen: 0 });
  T.check(r.status === 400, 'groepen 0 wordt geweigerd');
  // bestaande week
  r = await A('POST', '/api/kampmomenten/nieuw', { periode_id: p2.id, locatie_id: LOC.b, weken: [1, 2] });
  T.check(r.json.gemaakt === 0 && r.json.bestond_al === 2 && r.json.weken.every((w) => w.status === 'bestond_al' && /bestaat al/.test(w.tekst)), 'bestaande weken: duidelijke uitkomst per week, niets gewijzigd');
  const km3 = (await A('POST', '/api/kampmomenten/nieuw', { periode_id: p2.id, locatie_id: LOC.c, weken: [1] })).json.weken[0].id;
  await A('DELETE', `/api/kampmomenten/${km3}`);
  r = await A('POST', '/api/kampmomenten/nieuw', { periode_id: p2.id, locatie_id: LOC.a, weken: [1, 2] });
  T.check(r.json.gemaakt === 1 && r.json.bestond_al === 1 && r.json.weken[0].status === 'bestond_al' && r.json.weken[1].status === 'gemaakt', 'één week bestaat al, de andere wordt wel gemaakt');
  // thema elders = melding
  r = await A('POST', '/api/kampmomenten/nieuw', { periode_id: p2.id, locatie_id: LOC.d, weken: [1], themas: [{ thema_id: t1.id, groepen: 1 }] });
  T.check(r.status === 200 && r.json.gemaakt === 1 && r.json.weken[0].meldingen.length === 1 && /ook in/.test(r.json.weken[0].meldingen[0]), 'thema dat elders staat: melding, geen verbod (' + (r.json.weken[0].meldingen || [])[0] + ')');
  r = await A('POST', '/api/kampmomenten/nieuw', { periode_id: p2.id, weken: [1] });
  T.check(r.status === 400 && /locatie/i.test(r.json.error), 'zonder locatie: duidelijke uitleg (er bestaat geen kampmoment zonder locatie)');
  r = await A('POST', '/api/kampmomenten/nieuw', { periode_id: p2.id, locatie_id: LOC.e });
  T.check(r.status === 400 && /week/i.test(r.json.error), 'zonder week: duidelijke uitleg');
  const KN = require(T.ROOT + '/public/kampmoment-nieuw.js');
  const st = { periode: p2, weekLijst: [1, 2], locs: [{ id: LOC.a, name: 'A' }], kvs: [], locatie: LOC.a, weken: [1, 2], dagen: [true, true, true, true, true, false, false], kv: 0, themas: [{ id: 1, naam: 'Spionnen gezocht', leeftijdsgroep: 'lagere school', categorie: 'kamp', groepen: 2, elders: [] }, { id: 2, naam: 'Voetbalzak', leeftijdsgroep: 'lagere school', categorie: 'kamp', groepen: 1, elders: ['Abdij'] }], std: true, stdStuks: 14, fout: '' };
  const kh = KN.dialoogHtml(st);
  T.check(['Nieuw kampmoment', 'Alles is optioneel', 'Kampverantwoordelijke', 'Thema’s en groepen', '+ Thema kiezen', 'Leeg kampmoment maken', 'Kampmoment maken (2 weken)', 'Standaardmateriaal van deze locatie mee leveren bij opening en ophalen bij sluiting', '14 stuks · bewerken', 'Totaal 3 groepen op deze locatie', 'ook in Abdij'].every((s) => kh.includes(s)), 'het dialoog heeft alle onderdelen van de mockup');
  T.check(!/Kinderen|Kleuters|Monitoren/.test(kh.replace(/Kinderen en kleuters tellen hoeft hier niet/, '')), 'geen velden voor kinderen, kleuters en monitoren');

  // ═══ punt 2 · themakeuze ═══
  T.info('Punt 2 · themakeuze');
  const TK = require(T.ROOT + '/public/themakeuze.js');
  const k2 = (await A('GET', `/api/themakeuze?periode_id=${p2.id}&week=1&locatie_id=${LOC.a}`)).json;
  T.check(k2.themas.length === th0.n && k2.toon_ingepland === false, 'alle ' + th0.n + ' thema\'s, "al ingepland" verborgen bij een periode van 2 weken');
  const k3 = (await A('GET', `/api/themakeuze?periode_id=${p3.id}`)).json;
  T.check(k3.toon_ingepland === true, '"al ingepland" verschijnt bij een periode langer dan 2 weken (3 weken)');
  const ingepland = k2.themas.find((t) => t.id === t1.id);
  T.check(ingepland.ingepland_n >= 3 && ingepland.elders.length >= 1, 'teller "al ingepland" telt het aantal keer in de periode (' + ingepland.ingepland_n + '×) en toont waar het deze week nog staat (' + ingepland.elders.join(', ') + ')');
  // info invullen
  const zet = (id, b) => A('PUT', `/api/themas-overzicht/${id}`, b);
  await zet(t1.id, { extern_firma: 'Zorbfirma', is_zwem: true, locatie_nodig: 'buiten' });
  await zet(t2.id, { heeft_kookactiviteit: true, locatie_nodig: 'binnen' });
  await zet(t3.id, { leeftijdsgroep: 'tieners', locatie_nodig: 'beide' });
  const lijst = (await A('GET', `/api/themakeuze?periode_id=${p2.id}&week=1&locatie_id=${LOC.a}`)).json.themas;
  const basis = { tab: 'kamp', zoek: '', leeftijd: {}, eigenschap: {}, gekozen: {}, toonIngepland: false };
  const n = (extra) => TK.filterThemas(lijst, { ...basis, ...extra });
  T.check(n({}).length === lijst.filter((t) => t.categorie === 'kamp').length && n({ tab: 'themadag' }).every((t) => t.categorie === 'themadag') && n({ tab: 'themadag' }).length > 0, 'tabs Kampen en Themadagen volgen themas.categorie');
  T.check(n({ leeftijd: { tieners: true } }).length === 1 && n({ leeftijd: { tieners: true } })[0].id === t3.id, 'filter Tieners (nieuwe leeftijdsgroep) vindt het thema dat ik op tieners zette');
  T.check(TK.tellers(lijst, 'kamp').tieners === 1 && TK.tellers(lijst, 'kamp')['lagere school'] > 0 && TK.tellers(lijst, 'kamp').kleuters > 0, 'de chips tonen het aantal per leeftijdsgroep');
  T.check(n({ eigenschap: { extern: true } }).map((t) => t.id).join() === String(t1.id) && n({ eigenschap: { eigen: true } }).every((t) => t.eigen && t.id !== t1.id), 'Extern vindt enkel de firma-thema\'s; Eigen alle andere (leeg = eigen)');
  T.check(n({ eigenschap: { zwem: true } }).map((t) => t.id).join() === String(t1.id) && n({ eigenschap: { kook: true } }).some((t) => t.id === t2.id), 'Zwem en Kook');
  const bin = n({ eigenschap: { binnen: true } }).map((t) => t.id);
  T.check(bin.includes(t2.id) && bin.includes(t3.id) && !bin.includes(t1.id), 'Binnen nodig = binnen of binnen+buiten');
  const onbekend = n({ eigenschap: { onbekend: true } });
  T.check(onbekend.length === lijst.filter((t) => t.categorie === 'kamp').length - 3 && onbekend.every((t) => !t.locatie_nodig), 'filter-uitkomst "Zonder info": thema\'s zonder ingevulde eigenschappen (' + onbekend.length + ') staan niet stil onder "Eigen" of "Binnen"');
  T.check(n({ eigenschap: { vrij: true } }).every((t) => !t.elders.length) && n({ eigenschap: { vrij: true } }).length < n({}).length, 'Vrij deze week laat de thema\'s weg die die week elders staan');
  T.check(n({ zoek: 'zorbfirma' }).length === 1, 'zoeken vindt ook op de firma');
  const dh = TK.dialoogHtml(lijst, { ...basis, titel: 'Thema kiezen — Test · week 1' });
  T.check(['Kampen', 'Themadagen', 'Lagere school', 'Kleuters', 'Tieners', 'Vrij deze week', 'Eigen', 'Extern', 'Kook', 'Zwem', 'Binnen nodig', 'Eigen of firma', 'Soort', 'Locatie', 'Deze week', 'Toevoegen', 'Annuleren'].every((s) => dh.includes(s)) && !dh.includes('<span>Al ingepland</span>'), 'het dialoog heeft de tabs, chips en kolommen van de mockup; zonder "Al ingepland" bij een korte periode');
  const dh3 = TK.dialoogHtml(lijst, { ...basis, titel: 'x', toonIngepland: true, periodeNaam: 'zomer' });
  T.check(dh3.includes('Al ingepland') && /\d+× in zomer/.test(dh3), 'met een lange periode: kolom "Al ingepland" met "n× in zomer"');
  T.check(/staat al hier|deze week al in/.test(TK.rijHtml({ ...ingepland, hier: false }, { ...basis, gekozen: {} })), 'een thema dat elders staat toont "deze week al in …" (melding, geen verbod)');
  // thema-info bewerken: leeg blijft leeg
  const dT = (await A('GET', `/api/themas/${t1.id}/detail`)).json.thema;
  T.check(dT.extern_firma === 'Zorbfirma' && dT.is_zwem === true && dT.locatie_nodig === 'buiten', 'info is te bewerken en komt terug in het detail');
  const leeg = (await A('GET', `/api/themas/${kamp[5].id}/detail`)).json.thema;
  T.check(leeg.extern_firma === '' && leeg.locatie_nodig === '' && leeg.is_zwem === false, 'wat niet ingevuld is, blijft leeg (geen verzonnen waarden)');
  const th1 = (await q('SELECT COUNT(*) n, SUM(CASE WHEN leeftijdsgroep<>\'\' THEN 1 ELSE 0 END) m FROM themas'))[0];
  T.check(th1.n === th0.n && th1.m === th0.m, 'de migratie en het bewerken vervangen geen bestaande leeftijdsgroepen en voegen geen thema\'s toe');

  // ═══ punt 3 · standaardmateriaal ═══
  T.info('Punt 3 · standaardmateriaal');
  await A('POST', `/api/periodes/${p2.id}/activeer`);
  const VB = 3216, BB = 3217; // Voetballen, Basketballen (herfst-test.db)
  const stockage = ijk.locaties.rozenweg;
  await A('PUT', `/api/catalogus/${VB}/voorraad`, { locatie_id: stockage, qty: 3 });
  r = await A('PUT', `/api/standaardmateriaal/${LOC.b}/${VB}`, { aan: true, qty: 2 });
  T.check(r.status === 200 && r.json.open_nu === false && r.json.taak_voorstel === null, 'aanvinken voor een locatie die nu niet open is: geen taak');
  await A('PUT', `/api/standaardmateriaal/${LOC.b}/${BB}`, { aan: true, qty: 4 });
  await A('PUT', `/api/standaardmateriaal/${LOC.a}/${VB}`, { aan: true, qty: 2 });
  const lst = (await A('GET', '/api/standaardmateriaal')).json;
  const lb = lst.locaties.find((l) => l.id === LOC.b);
  T.check(lb && lb.stuks === 6 && lb.ingesteld && /open wk 1–2/.test(lb.open_tekst), 'lijst: locatie B heeft 6 stuks, "open wk 1–2"');
  const dB = (await A('GET', `/api/standaardmateriaal/${LOC.b}`)).json;
  const rVb = dB.aangevinkt_rijen.find((x) => x.item_type_id === VB);
  T.check(dB.aangevinkt === 2 && rVb.qty === 2 && rVb.voorraad.tekort === true && rVb.voorraad.gevraagd === 4 && rVb.voorraad.voorraad === 3 && /2 locaties samen 4, voorraad 3/.test(rVb.voorraad.tekst), 'voorraadmelding: 2 locaties samen 4, voorraad 3 (melding, geen verbod)');
  r = await A('PUT', `/api/standaardmateriaal/${LOC.a}/${VB}`, { aan: true, qty: 9999 });
  T.check(r.status === 200, 'de melding verbiedt niets: 9999 mag');
  await A('PUT', `/api/standaardmateriaal/${LOC.a}/${VB}`, { aan: true, qty: 2 });
  r = await A('PUT', `/api/standaardmateriaal/${LOC.b}/${VB}`, { aan: true, qty: 0 });
  T.check(r.status === 400, 'aantal 0 wordt geweigerd');
  // generator
  const gen = await A('POST', '/api/kampmomenten/genereer-transport', { ids: kmB, periode_id: p2.id });
  const taken = await q('SELECT t.id,t.type,t.kampmoment_id FROM transport_taken t WHERE t.kampmoment_id IN (?,?) AND t.status<>\'geannuleerd\' ORDER BY t.id', kmB);
  const regelsVan = async (id) => (await q('SELECT naam,qty,soort FROM transport_regels WHERE taak_id=?', [id]));
  const lev1 = taken.filter((t) => t.type === 'levering' && t.kampmoment_id === kmB[0]), lev2 = taken.filter((t) => t.type === 'levering' && t.kampmoment_id === kmB[1]), oph = taken.filter((t) => t.type === 'ophaling');
  const heeft = async (ts, naam, qty) => { for (const t of ts) if ((await regelsVan(t.id)).some((x) => x.naam === naam && x.qty === qty)) return true; return false; };
  T.check(gen.status === 200 && await heeft(lev1, 'Voetballen', 2) && await heeft(lev1, 'Basketballen', 4), 'generator: de eerste open week levert Voetballen 2 en Basketballen 4');
  T.check(!(await heeft(lev2, 'Voetballen', 2)) && !(await heeft(lev2, 'Basketballen', 4)), 'de tweede week levert het niet opnieuw: het blijft staan');
  T.check(oph.length >= 1 && await heeft(oph, 'Voetballen', 2) && await heeft(oph, 'Basketballen', 4), 'de laatste open week haalt het op (met dezelfde aantallen)');
  const opLaatste = oph.every((t) => t.kampmoment_id === kmB[1]);
  T.check(opLaatste, 'de ophaling hoort bij de laatste week');
  // vinkje uit
  const kmZ = (await A('POST', '/api/kampmomenten/nieuw', { periode_id: p2.id, locatie_id: LOC.e, weken: [1, 2], standaard_materiaal: false })).json.weken.map((w) => w.id);
  await A('PUT', `/api/standaardmateriaal/${LOC.e}/${BB}`, { aan: true, qty: 7 });
  await A('POST', '/api/kampmomenten/genereer-transport', { ids: kmZ, periode_id: p2.id });
  const tZ = await q("SELECT t.id FROM transport_taken t WHERE t.kampmoment_id IN (?,?) AND t.status<>'geannuleerd'", kmZ);
  let metBasis = 0; for (const t of tZ) metBasis += (await regelsVan(t.id)).filter((x) => x.naam === 'Basketballen').length;
  T.check(metBasis === 0, 'met het vinkje standaardmateriaal uit, levert en haalt de generator het niet (' + tZ.length + ' taken zonder dat artikel)');
  await A('PUT', `/api/kampmomenten/${kmZ[0]}/velden`, { standaard_materiaal: true });
  T.check((await q('SELECT standaard_materiaal s FROM kampmomenten WHERE id=?', [kmZ[0]]))[0].s === 1 && (await A('GET', `/api/kampmomenten/${kmZ[0]}/detail`)).json.standaard_materiaal === true, 'het vinkje is te wijzigen in het kampmoment');
  // wijziging tijdens open weken
  await A('POST', `/api/periodes/${pNu.id}/activeer`);
  const kmN = (await A('POST', '/api/kampmomenten/nieuw', { periode_id: pNu.id, locatie_id: 50, weken: [1, 2] })).json.weken.map((w) => w.id);
  await A('PUT', `/api/standaardmateriaal/50/${VB}`, { aan: true, qty: 3 });
  r = await A('PUT', `/api/standaardmateriaal/50/${VB}`, { aan: true, qty: 5 });
  T.check(r.json.open_nu === true && r.json.delta === 2 && r.json.taak_voorstel && /bijgeleverd/.test(r.json.taak_voorstel.tekst), 'tijdens de open weken: +2 geeft een voorstel "bijleveren" (' + (r.json.taak_voorstel && r.json.taak_voorstel.tekst) + ')');
  const voorTaken = (await q("SELECT COUNT(*) n FROM transport_taken WHERE opmerking LIKE '📦 Standaardmateriaal%'"))[0].n;
  T.check(voorTaken === 0, 'zonder bevestiging wordt er geen taak gemaakt');
  r = await A('POST', '/api/standaardmateriaal/50/taak', { item_type_id: VB, delta: 2 });
  const tk = (await q('SELECT * FROM transport_taken WHERE id=?', [r.json.taak_id]))[0], tkr = await regelsVan(r.json.taak_id);
  T.check(r.status === 200 && tk.naar_locatie_id === 50 && tk.status === 'gepland' && tkr[0].naam === 'Voetballen' && tkr[0].qty === 2, 'na bevestiging: taak om 2 Voetballen bij te leveren naar de locatie');
  r = await A('PUT', `/api/standaardmateriaal/50/${VB}`, { aan: true, qty: 4 });
  T.check(r.json.delta === -1 && /opgehaald/.test(r.json.taak_voorstel.tekst), 'min 1: voorstel "ophalen"');
  r = await A('POST', '/api/standaardmateriaal/50/taak', { item_type_id: VB, delta: -1 });
  const tk2 = (await q('SELECT * FROM transport_taken WHERE id=?', [r.json.taak_id]))[0];
  T.check(tk2.van_locatie_id === 50 && tk2.naar_locatie_id !== 50, 'de ophaaltaak gaat van de locatie naar de stockage');
  r = await A('PUT', `/api/standaardmateriaal/50/${BB}`, { aan: true, qty: 1 });
  r = await A('PUT', `/api/standaardmateriaal/50/${BB}`, { aan: false });
  T.check(r.json.delta === -1 && r.json.taak_voorstel, 'uitvinken tijdens open weken: voorstel om op te halen');
  // kopieer
  const k = await A('POST', `/api/standaardmateriaal/${LOC.c}/kopieer`, { van_locatie_id: LOC.b });
  T.check(k.status === 200 && k.json.nieuw === 2 && (await q('SELECT COUNT(*) n FROM locatie_materiaal WHERE locatie_id=?', [LOC.c]))[0].n === 2, 'Kopieer van locatie neemt de aangevinkte stukken over (2 nieuw)');
  T.check((await A('POST', `/api/standaardmateriaal/${LOC.c}/kopieer`, { van_locatie_id: LOC.c })).status === 400, 'kopiëren van zichzelf wordt geweigerd');
  const dC = (await A('GET', `/api/standaardmateriaal/${LOC.d}`)).json;
  T.check(dC.ingesteld === false && dC.valt_terug_op_algemeen === (await q('SELECT COUNT(*) n FROM standaard_materiaal'))[0].n > 0, 'een locatie zonder eigen lijst meldt dat het algemene standaardmateriaal geldt');
  const zk = (await A('GET', `/api/standaardmateriaal/${LOC.b}?q=voetbal`)).json;
  T.check(zk.overige_rijen.every((x) => /voetbal/i.test(x.naam)), 'zoeken in de catalogus om toe te voegen');
  const SM = require(T.ROOT + '/public/standaardmateriaal.js');
  const sh = SM.detail(dB, { filter: 'aan', q: '' });
  T.check(['Dit gaat mee bij de opening, blijft staan tot de sluiting', 'Kopieer van locatie…', 'Aangevinkt 2', 'Materiaal', 'Eenheid', 'Aantal', 'Voorraad', 'voorraad genoeg'].filter((s) => !sh.includes(s)).length <= 1 && sh.includes('2 locaties samen'), 'het scherm toont de onderdelen van tab 3 en de voorraadmelding');
  T.check(lees('public/locaties.html').includes('Standaardmateriaal') && lees('public/standaardmateriaal.html').includes('class="act" href="/standaardmateriaal"'), 'Locaties heeft een tab Standaardmateriaal');

  // ═══ migratie twee keer ═══
  T.info('Migratie twee keer');
  await srv.stop();
  srv = await T.startServer({ poort, verseMap: false });
  const tok2 = await T.login(srv.base);
  const B = (m, p, b) => T.api(srv.base, tok2, m, p, b);
  const na = (await B('GET', `/api/themas/${t1.id}/detail`)).json.thema;
  T.check(na.extern_firma === 'Zorbfirma' && (await T.leesDb(srv.dbPad, 'SELECT groepen g FROM kampmoment_themas WHERE id=?', [ktId]))[0].g === 5 && (await T.leesDb(srv.dbPad, "SELECT COUNT(*) n FROM app_vlaggen WHERE naam='migratie_bw1_klaar'"))[0].n === 1, 'tweede start: niets overschreven, de migratie loopt niet opnieuw');
} catch (e) { T.fout("UITZONDERING: " + (e && e.stack || e)); } finally {
  await T.einde(srv);
}
