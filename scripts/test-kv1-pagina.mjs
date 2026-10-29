// test-kv1-pagina.mjs — KV1 (chat D): de KV-pagina (/kv/:token), het telscherm "✓ klopt / anders" en de monitor-stand (/tel/:token).
// Eigen server via _testhulp (poort 3343, herfst-test.db). Geen headless browser: de HTML-bouwers en de actielogica van
// public/kv.js worden als module geladen en met de ECHTE data-JSON/API van de server aangeroepen.
import * as T from './_testhulp.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const POORT = parseInt(process.env.TEST_POORT || '3343');
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: POORT });
const BASIC = 'Basic ' + Buffer.from('sporty:' + T.APP_PASSWORD).toString('base64');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const tekst = (h) => h.replace(/<[^>]+>/g, '\n').replace(/&amp;/g, '&').replace(/\n\s*\n+/g, '\n').trim().split('\n').join(' | ');
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const P = (m, p, b) => T.api(srv.base, null, m, p, b);
  const R = ijk.locaties.rozenweg, AB = ijk.locaties.abdijschool, km = ijk.kampmomenten.abdijschool, thema = ijk.themas.alles_op_wieltjes;

  // ── data: kampmoment met 3 bakken (8, 5 en 1 items), een levering op een rit ──
  const maakBak = async (label, code, items) => {
    const b = (await A('POST', `/api/themas/${thema}/bakken`, { label, code })).json;
    for (const [naam, qty] of items) await A('POST', `/api/bakken/${b.id}/items`, { naam, qty });
    return b.id;
  };
  const b1 = await maakBak('Kv1 bak een', 'KV01', [['Springtouw', 4], ['Hoepel', 6], ['Pion', 10], ['Bal zacht', 4], ['Lintje', 12], ['Fluitje', 2], ['Krijt', 1], ['Tape', 2]]);
  const b2 = await maakBak('Kv1 bak twee', 'KV02', [['Kegel', 3], ['Touw', 2], ['Doek', 5], ['Pen', 1], ['Blok', 8]]);
  const b3 = await maakBak('Kv1 bak drie', 'KV03', [['Parachute', 1]]);
  await A('POST', `/api/kampmomenten/${km}/themas`, { thema_id: thema });
  const taak = (await A('POST', '/api/transport-taken', { type: 'levering', datum: '2026-11-02', tijd: '14:00', van_locatie_id: R, naar_locatie_id: AB, kampmoment_id: km, regels: [{ naam: 'Bak Kv1 bak een (KV01)', qty: 1, soort: 'thema', bak_id: b1 }, { naam: 'Bak Kv1 bak twee (KV02)', qty: 1, soort: 'thema', bak_id: b2 }] })).json.id;
  await A('POST', '/api/ritten', { datum: '2026-11-02', chauffeur: 'Jan', taak_ids: [taak] });
  const kvtok = await T.kvToken(srv.base, tok, km);

  // ── 1. De pagina's ──
  const pg = await (await fetch(`${srv.base}/kv/${kvtok}`, { headers: { Authorization: BASIC } })).text();
  T.check(/<div id="app">/.test(pg) && /window\.__KV_TOKEN="/.test(pg) && /__KV_MONITOR=false/.test(pg) && pg.includes('.kaartB{') && pg.includes('function createApp'), 'GET /kv/:token → 200 met #app, token, de ontwerp-CSS en kv.js inline');
  T.check(['Overzicht', 'Tellen', 'Aanvragen', 'Info'].every((t) => pg.includes("['" + t.toLowerCase() + "'") || pg.includes(t)) && pg.includes("'overzicht', '🏠', 'Overzicht'") && pg.includes("'info', 'ℹ️', 'Info'"), 'pagina bevat de vier tabs Overzicht · Tellen · Aanvragen · Info');
  T.check(!/\bprompt\(|\bconfirm\(|\balert\(/.test(pg.replace(/<script>window\.__KV_TOKEN[^<]*<\/script>/, '')), 'geen prompt()/confirm()/alert() in de pagina');
  const fout404 = await fetch(`${srv.base}/kv/zzzzzzzzzz`, { headers: { Authorization: BASIC } });
  const ft = await fout404.text();
  T.check(fout404.status === 404 && /niet gevonden of verlopen/.test(ft) && !/at .*\.js|Error:|stack/i.test(ft), 'verkeerde token → 404 met nette foutpagina (geen stacktrace)');

  // ── 2. Data-contract ──
  let d = (await P('GET', `/api/kv/${kvtok}/data`)).json;
  const bakken = d.bakken.filter((b) => ['KV01', 'KV02', 'KV03'].includes(b.code));
  T.check(bakken.length === 3 && bakken.map((b) => b.items.length).sort((x, y) => y - x).join() === '8,5,1' && bakken.every((b) => b.status === 'nog_niet' && b.geteld === 0 && b.aantal === b.items.length), `data: 3 bakken (8, 5, 1 items) met status nog_niet, geteld 0`);
  T.check(d.levering?.datum === '2026-11-02' && d.levering.tijd === '14:00' && d.levering.chauffeur === 'Jan' && d.levering.stuks >= 2 && d.levering.status === 'gepland' && d.ophaling === null, `data: levering ${JSON.stringify(d.levering)}, ophaling null`);
  T.check(d.monitor_url?.startsWith('/tel/') && d.locatie?.naam && 'sleutel_info' in d.locatie && d.kantoor && 'telefoon' in d.kantoor && Array.isArray(d.aanvragen) && Array.isArray(d.meldingen_chauffeur) && Array.isArray(d.boodschappen), 'data: monitor_url, locatie {naam,adres,sleutel_info}, kantoor {telefoon}, aanvragen[], meldingen_chauffeur[], boodschappen[]');
  const bak1 = () => app.data().bakken.find((b) => b.code === 'KV01');
  const bak2 = () => app.data().bakken.find((b) => b.code === 'KV02');
  const bak3 = () => app.data().bakken.find((b) => b.code === 'KV03');

  // ── 3. DOM-bouw op de echte data ──
  const KP = require(T.ROOT + '/public/kv.js');
  const ov = KP.overzichtHtml(d);
  T.check(ov.includes('Levering gepland') && ov.includes('maandag 2 nov') && ov.includes('Tellen · 0/') && ov.includes('Aanvragen') && ov.includes('Abdijschool Vlierbeek · week 1'), 'Overzicht: kop, leveringskaart, Tellen-kaart, Aanvragen-kaart');
  T.check(['Overzicht', 'Tellen', 'Aanvragen', 'Info'].every((t) => ov.includes('<span>' + t)), 'Overzicht: tabbalk met vier tabs');
  console.log('--- DOM-dump Overzicht ---\n' + tekst(ov) + '\n');

  // ── 4. Acties via de pagina-logica ──
  const meldingen = [];
  let scherm = '';
  const app = KP.createApp({
    token: kvtok, monitor: false, host: 'http://test',
    fetch: (u, o = {}) => fetch(srv.base + u, { ...o, headers: { ...(o.headers || {}), Authorization: BASIC } }),
    toast: (t, goed) => meldingen.push({ t, goed }), mount: (h) => { scherm = h; },
    kiesFoto: async () => PNG, kopieer: async () => {}
  });
  T.check(await app.laad(), 'app.laad() haalt de data op');
  app.ga('bak', bak1().id);
  const it = (naam) => bak1().items.find((i) => i.naam === naam);
  // 4× ✓ klopt (Bal zacht, Lintje, Fluitje, Krijt)
  for (const n of ['Bal zacht', 'Lintje', 'Fluitje', 'Krijt']) await app.klik('klopt', String(bak1().id), String(it(n).id));
  T.check(['Bal zacht', 'Lintje', 'Fluitje', 'Krijt'].every((n) => it(n).aangetroffen === it(n).gewenst && it(n).status === 'ok') && scherm.includes('class="it groen"'), '4× "✓ klopt" → aangetroffen = verwacht, rij groen');
  // tekort: Springtouw 2 van 4 + notitie
  await app.klik('anders', String(it('Springtouw').id));
  T.check(scherm.includes('class="uitklap"') && scherm.includes('Geteld') && scherm.includes('Kapot') && scherm.includes('Notitie') && scherm.includes('Opslaan'), 'anders klapt uit: geteld −/+, kapot −/+ met 📷, notitie, Opslaan');
  await app.klik('stp', 'geteld', '-1'); await app.klik('stp', 'geteld', '-1');
  T.check(scherm.includes('tekort: 2'), 'uitklap toont "tekort: 2" bij geteld 2 van 4');
  app.zet('notitie', 'twee zitten in de knoop');
  await app.klik('opslaan');
  T.check(it('Springtouw').aangetroffen === 2 && it('Springtouw').status === 'tekort' && it('Springtouw').notitie === 'twee zitten in de knoop' && scherm.includes('class="it rood"') && scherm.includes('📝 twee zitten in de knoop'), 'tekort + notitie opgeslagen; rij rood met notitie');
  // te veel: Hoepel 8 van 6
  await app.klik('anders', String(it('Hoepel').id)); await app.klik('stp', 'geteld', '1'); await app.klik('stp', 'geteld', '1'); await app.klik('opslaan');
  T.check(it('Hoepel').aangetroffen === 8 && it('Hoepel').te_veel === 2 && it('Hoepel').status === 'te_veel' && scherm.includes('class="it blauw"'), 'te veel: Hoepel 8 van 6 (te_veel 2), rij blauw');
  // kapot 2 + foto: Pion 10 van 10
  await app.klik('anders', String(it('Pion').id)); await app.klik('stp', 'kapot', '1'); await app.klik('stp', 'kapot', '1'); await app.klik('itemfoto'); app.zet('notitie', 'gebarsten'); await app.klik('opslaan');
  const pion = it('Pion');
  T.check(pion.aangetroffen === 10 && pion.kapot_aantal === 2 && pion.status === 'kapot' && /^\/uploads\//.test(pion.foto_url || '') && pion.notitie === 'gebarsten' && scherm.includes('💥 2 kapot') && scherm.includes('class="it oranje"'), `kapot 2 + foto: ${JSON.stringify({ k: pion.kapot_aantal, f: pion.foto_url, s: pion.status })}`);
  T.check(bak1().status === 'tekort' && bak1().geteld === 7, `bak-status 'tekort' (tekort wint van kapot/te veel), geteld ${bak1().geteld} van 8`);
  const fotoOk = (await fetch(srv.base + pion.foto_url, { headers: { Authorization: BASIC } })).status === 200;
  T.check(fotoOk, 'foto-bestand is opvraagbaar via foto_url');
  const bk1s = KP.bakHtml(app.data(), bak1().id, app.staat());
  T.check(bk1s.includes('7 van 8 geteld · 1 tekort · 1 te veel · 1 kapot'), 'telscherm-kop: "7 van 8 geteld · 1 tekort · 1 te veel · 1 kapot"');
  console.log('--- DOM-dump Telscherm bak 1 ---\n' + tekst(bk1s) + '\n');
  // Rest klopt
  await app.klik('rest-klopt');
  T.check(it('Tape').aangetroffen === 2 && bak1().geteld === 8 && it('Springtouw').aangetroffen === 2 && it('Pion').kapot_aantal === 2, 'Rest klopt zet het niet-getelde (Tape) op verwacht en laat de rest ongemoeid');
  // Tellen-lijst
  app.ga('tellen');
  const tl = scherm;
  T.check(tl.includes('KV01') && tl.includes('pil rood') && tl.includes('Telling versturen (') && tl.includes('maandag nakijken'), 'Tellen: bakkenlijst met pil "tekort" en "Telling versturen (n/m)"');
  console.log('--- DOM-dump Tellen ---\n' + tekst(tl) + '\n');
  // bak 2: deels tellen (2 van 5) → versturen onvolledig
  app.ga('bak', bak2().id);
  for (const i of bak2().items.slice(0, 2)) await app.klik('klopt', String(bak2().id), String(i.id));
  app.ga('tellen');
  const m0 = meldingen.length;
  await app.klik('versturen');
  T.check(meldingen.at(-1).goed && /verstuurd naar kantoor/i.test(meldingen.at(-1).t) && meldingen.length === m0 + 1, `versturen met onvolledige bak 2 → 200 + toast "${meldingen.at(-1).t}"`);
  const nak = (await A('GET', '/api/nakijk')).json.filter((s) => s.kampmoment_id === km && s.kv_status === 'ingediend');
  const bak2S = nak.find((s) => s.thema_bak_id === bak2().id);
  const nietGeteld = bak2S ? bak2S.regels.filter((r) => r.aangetroffen === null && /niet geteld/.test(r.opmerking)).length : -1;
  T.check(bak2S && nietGeteld === 3 && bak2S.regels.filter((r) => r.aangetroffen != null).length === 2, `kantoor ziet bak 2 als ingediend met ${nietGeteld} regels "niet geteld" (aangetroffen leeg) en 2 getelde`);
  const bak1S = nak.find((s) => s.thema_bak_id === bak1().id);
  const rSpr = bak1S.regels.find((r) => r.item_naam === 'Springtouw'), rPion = bak1S.regels.find((r) => r.item_naam === 'Pion');
  T.check(rSpr.ontbreekt === 2 && rSpr.notitie === 'twee zitten in de knoop' && rPion.kapot_aantal === 2 && rPion.is_kapot === 1 && rPion.foto_path, 'kantoor-regels: tekort 2 + notitie, kapot 2 + is_kapot + foto_path');
  // bak 3 + attributen: nog niet geteld blijft nog_niet in de pagina
  T.check(bak3().status === 'nog_niet' && bak2().status === 'nog_niet' && bak2().geteld === 2, "bak 2 (2 van 5) en bak 3 blijven 'nog_niet' in de data");

  // ── 5. Aanvragen en kapot melden via de pagina ──
  app.ga('aanvragen');
  T.check(scherm.includes('Materiaal vragen') && scherm.includes('Kapot melden') && scherm.includes('Mijn aanvragen'), 'Aanvragen: knoppen Materiaal vragen / Kapot melden + "Mijn aanvragen"');
  await app.klik('sheet-open', 'materiaal');
  T.check(scherm.includes('Materiaal vragen</h3>') && scherm.includes('Foto toevoegen') && scherm.includes('Versturen'), 'overlay "Materiaal vragen": tekst, aantal, foto, Versturen');
  const mA = meldingen.length;
  await app.klik('sheet-ok');
  T.check(meldingen.length === mA + 1 && !meldingen.at(-1).goed && /Vul in/.test(meldingen.at(-1).t), 'lege aanvraag → toast, niets verstuurd');
  app.zet('tekst', 'hesjes maat S'); app.zet('aantal', '10'); await app.klik('sheet-foto'); await app.klik('sheet-ok');
  d = app.data();
  const av = d.aanvragen.find((a) => a.tekst === '10 × hesjes maat S');
  T.check(av && av.status === 'nieuw' && av.soort === 'materiaal' && av.foto_url && meldingen.at(-1).t === '✓ Verstuurd naar kantoor', `aanvraag bestaat (nieuw, met foto) en toast "${meldingen.at(-1).t}"`);
  await app.klik('sheet-open', 'kapot'); app.zet('tekst', 'Oven kapot'); await app.klik('sheet-ok');
  d = app.data();
  const kp = d.aanvragen.find((a) => a.tekst === 'Oven kapot');
  T.check(kp && kp.soort === 'kapot', 'kapot-melding bestaat in aanvragen[] (soort kapot)');
  await A('PUT', `/api/aanvragen/${av.id}/status`, { status: 'goedgekeurd', reden: 'komt mee met de spoedrit' });
  await app.laad();
  T.check(app.data().aanvragen.find((a) => a.id === av.id).antwoord === 'komt mee met de spoedrit' && KP.aanvragenHtml(app.data()).includes('komt mee met de spoedrit') && KP.aanvragenHtml(app.data()).includes('goedgekeurd'), 'antwoord van kantoor staat in aanvragen[] en in de pagina, met status goedgekeurd');
  // chauffeur-melding + info
  const rit = (await A('GET', '/api/ritten')).json.find((r) => r.chauffeur === 'Jan' && r.datum === '2026-11-02');
  const rtok = await T.ritToken(srv.base, tok, rit.id);
  await P('POST', `/api/rit-token/${rtok}/taken/${taak}/probleem`, { soort: 'gesloten', tekst: 'geen sleutel' });
  await app.laad();
  T.check(app.data().meldingen_chauffeur.length === 1 && KP.overzichtHtml(app.data()).includes('Melding chauffeur') && KP.aanvragenHtml(app.data()).includes('Meldingen chauffeur'), 'melding van de chauffeur verschijnt in Overzicht en Aanvragen');
  const info = KP.infoHtml(app.data(), 'http://test');
  T.check(info.includes('Monitor-link') && info.includes('http://test/tel/') && info.includes('Kopieer') && info.includes('Locatie') && info.includes('Abdijschool Vlierbeek'), 'Info: monitor-link met Kopieer, locatie');
  await app.klik('kopieer');
  T.check(meldingen.at(-1).t === '✓ Link gekopieerd', 'Kopieer → toast');

  // ── 6. Monitor-stand ──
  const mtok = d.monitor_url.replace('/tel/', '');
  const mp = await fetch(`${srv.base}/tel/${mtok}`, { headers: { Authorization: BASIC } });
  const mh = await mp.text();
  T.check(mp.status === 200 && /__KV_MONITOR=true/.test(mh), '/tel/:token → 200 in monitor-stand');
  const md = (await P('GET', `/api/kv/${mtok}/data`)).json;
  T.check(md.monitor === true && md.bakken.length >= 3 && !('aanvragen' in md) && !('locatie' in md) && !('kantoor' in md) && !('monitor_url' in md), 'monitor-data: enkel bakken/attributen (geen aanvragen, sleutel-info, kantoor)');
  const mon = KP.schermHtml(md, { scherm: 'tellen', monitor: true }, 'http://test');
  T.check(mon.includes('Tellen ') && !mon.includes('Aanvragen') && !mon.includes('Overzicht') && !mon.includes('Info') && !mon.includes('Telling versturen') && !mon.includes('sleutel'), 'monitor-pagina: enkel Tellen, zonder Aanvragen/Overzicht/Info/versturen');
  let r = await P('POST', `/api/kv/${mtok}/aanvraag`, { tekst: 'x' });
  T.check(r.status === 403, `aanvraag met monitor-token → 403 ("${r.json?.error}")`);
  r = await P('POST', `/api/kv/${mtok}/kapot`, { tekst: 'x' });
  T.check(r.status === 403, 'kapot met monitor-token → 403');
  r = await P('POST', `/api/kv/${mtok}/versturen`, {});
  T.check(r.status === 403, 'versturen met monitor-token → 403');
  r = await P('POST', `/api/kv/${mtok}/bakken/${bak3().id}/tellen`, { regels: [{ item_id: bak3().items[0].id, aangetroffen: 1 }] });
  T.check(r.status === 200, 'tellen mag wel met het monitor-token');
  r = await fetch(`${srv.base}/tel/${kvtok}`, { headers: { Authorization: BASIC } });
  T.check(r.status === 404, 'het gewone KV-token opent /tel/ niet (404)');
  r = await P('GET', `/api/kv/zzzzzzzzzz/data`);
  T.check(r.status === 403, 'verkeerde token → 403 op de API');
} catch (e) {
  T.fout('test crashte: ' + (e.stack || e));
}
await T.einde(srv);
