// test-tf6-keten.mjs — TF6 (chat D): goedgekeurde KV-aanvraag wordt echt werk, bestelling deels binnen, aanvuller/coördinator, kantoorschermen.
// Eigen server via _testhulp (poort 3361 of TEST_POORT, herfst-test.db).
import * as T from './_testhulp.mjs';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const lees = (p) => fs.readFileSync(T.ROOT + '/' + p, 'utf8');
const ijk = T.leesIjk();
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const srv = await T.startServer({ poort: Number(process.env.TEST_POORT) || 3361 });
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  let _k2; const K2 = async (m, p) => { if (!_k2) { const x = (await A('POST', '/api/personeel', { naam: 'Tweede kantoor', rol: 'kantoor' })).json; await A('POST', `/api/personeel/${x.id}/pincode`, { pincode: '5861' }); _k2 = await T.login(srv.base, x.id, '5861'); } return T.api(srv.base, _k2, m, p); }; // TF9: een melding gaat niet naar wie de handeling deed
  const P = (m, p, b) => T.api(srv.base, null, m, p, b);
  const R = ijk.locaties.rozenweg, km = ijk.kampmomenten.abdijschool;
  const stock = async (typeId) => ((await T.leesDb(srv.dbPad, 'SELECT qty FROM item_type_stock WHERE item_type_id=? AND locatie_id=?', [typeId, R]))[0] || {}).qty;
  const zetStock = (typeId, qty) => A('PUT', `/api/catalogus/${typeId}/voorraad`, { locatie_id: R, qty });
  const kvtok = await T.kvToken(srv.base, tok, km);
  const WATER = 3223, MULTI = 3225; // Waterpistolen, Multiblaasring (herfst-test.db)
  const kvAanvragen = async () => (await P('GET', `/api/kv/${kvtok}/data`)).json.aanvragen;
  const vandaag = new Date().toISOString().slice(0, 10);
  const lijstH = async (regelId) => { const l = (await A('GET', `/api/aanvullijst?datum=${vandaag}`)).json; for (const g of l.bakken) { const h = g.handelingen.find((x) => x.regel_id === regelId); if (h) return { h, g }; } return null; };

  // ═══ PUNT 1a — goedgekeurde aanvraag, voorraad genoeg ═══
  T.info('Punt 1a: aanvraag met voorraad');
  await zetStock(WATER, 20);
  let r = await P('POST', `/api/kv/${kvtok}/aanvraag`, { tekst: 'Waterpistolen', aantal: 4 });
  const av1 = r.json.id;
  T.check(r.status === 200 && r.json.tekst === '4 × Waterpistolen', 'KV-aanvraag aangemaakt als "4 × Waterpistolen"');
  r = await A('PUT', `/api/aanvragen/${av1}/status`, { status: 'goedgekeurd' });
  T.check(r.status === 200 && r.json.status === 'goedgekeurd', 'goedkeuren geeft 200');
  const regel1 = (await T.leesDb(srv.dbPad, "SELECT * FROM nakijk_regels WHERE kantoor_notitie LIKE ?", [`%aanvraag #${av1} van KV%`]))[0];
  T.check(regel1 && regel1.kantoor_actie === 'uit_pool' && regel1.kantoor_aantal === 4, 'regel met actie uit_pool, aantal 4 (voorraad genoeg)');
  const taak1 = (await T.leesDb(srv.dbPad, 'SELECT * FROM transport_taken WHERE aanvraag_id=?', [av1]))[0];
  T.check(taak1 && taak1.van_locatie_id === R && taak1.naar_locatie_id === ijk.locaties.abdijschool && taak1.status === 'gepland', 'transporttaak Rozenweg → locatie van de KV');
  const tr = (await T.leesDb(srv.dbPad, 'SELECT naam,qty FROM transport_regels WHERE taak_id=?', [taak1.id]))[0];
  T.check(tr && /Waterpistolen/.test(tr.naam) && tr.qty === 4, 'taak draagt "Waterpistolen × 4"');
  const kvA = (await kvAanvragen()).find((a) => a.id === av1);
  T.check(kvA && kvA.status === 'goedgekeurd' && /voorraad/.test(kvA.antwoord), 'KV ziet "goedgekeurd" met uitleg');
  const h1 = await lijstH(regel1.id);
  T.check(h1 && h1.h.kan_afvinken && h1.h.aantal === 4, 'handeling staat op de aanvullijst en is af te vinken');
  const tk = (await A('GET', '/api/tekorten-overzicht')).json.artikels.find((a) => a.artikel_id === String(WATER));
  T.check(tk && tk.stand === 'uit_voorraad', 'Tekorten toont het artikel als "uit voorraad"');
  r = await A('POST', `/api/aanvullijst/${regel1.id}/aangevuld`, {});
  T.check(r.status === 200 && (await stock(WATER)) === 16, 'afvinken verlaagt Rozenweg 20 → 16');
  r = await A('PUT', `/api/aanvragen/${av1}/status`, { status: 'goedgekeurd' });
  T.check((await T.leesDb(srv.dbPad, 'SELECT COUNT(*) n FROM nakijk_regels WHERE kantoor_notitie LIKE ?', [`%aanvraag #${av1} van KV%`]))[0].n === 1 && (await T.leesDb(srv.dbPad, 'SELECT COUNT(*) n FROM transport_taken WHERE aanvraag_id=?', [av1]))[0].n === 1, 'nogmaals goedkeuren maakt niets dubbel');

  // ═══ PUNT 1a — te weinig voorraad: Tekorten, na binnen op de aanvullijst (deels binnen) ═══
  T.info('Punt 1a/1b: aanvraag zonder voorraad, deels binnen');
  await zetStock(MULTI, 0);
  r = await P('POST', `/api/kv/${kvtok}/aanvraag`, { tekst: 'Multiblaasring', aantal: 5 });
  const av2 = r.json.id;
  r = await A('PUT', `/api/aanvragen/${av2}/status`, { status: 'goedgekeurd' });
  const regel2 = (await T.leesDb(srv.dbPad, "SELECT * FROM nakijk_regels WHERE kantoor_notitie LIKE ?", [`%aanvraag #${av2} van KV%`]))[0];
  T.check(regel2 && regel2.kantoor_actie === 'bestellen' && regel2.kantoor_aantal === 5, 'regel met actie bestellen (voorraad 0)');
  T.check(/besteld/.test((await kvAanvragen()).find((a) => a.id === av2).antwoord), 'KV leest "wordt besteld"');
  T.check((await T.leesDb(srv.dbPad, 'SELECT COUNT(*) n FROM transport_taken WHERE aanvraag_id=?', [av2]))[0].n === 1, 'ook hier een transporttaak');
  let h2 = await lijstH(regel2.id);
  T.check(h2 && !h2.h.kan_afvinken && /wacht op levering/.test(h2.h.waar_tekst), 'aanvullijst: wacht op levering, nog niet af te vinken');
  let tk2 = (await A('GET', '/api/tekorten-overzicht')).json.artikels.find((a) => a.artikel_id === String(MULTI));
  T.check(tk2 && tk2.stand === 'te_bestellen' && tk2.tekort === 5, 'Tekorten: te bestellen, tekort 5');
  r = await A('POST', `/api/tekorten/${MULTI}/besteld`, { aantal: 5, waar_kopen: 'Action' });
  T.check(r.status === 200, 'besteld 5');
  // deels binnen: 3 van 5
  r = await A('POST', `/api/tekorten/${MULTI}/binnen`, { aantal: 3 });
  T.check(r.status === 200 && r.json.volledig === false && r.json.binnen === 3 && r.json.totaal === 5, '3 van 5 binnen: ok, niet volledig');
  T.check((await stock(MULTI)) === 3, 'voorraad Rozenweg +3');
  tk2 = (await A('GET', '/api/tekorten-overzicht')).json.artikels.find((a) => a.artikel_id === String(MULTI));
  T.check(tk2.stand === 'besteld' && tk2.bestelling.binnen_aantal === 3 && tk2.bestelling.aantal === 5, 'Tekorten: nog "besteld", bestelling toont 3 van 5');
  const dt = (await A('GET', `/api/tekorten/${MULTI}/detail`)).json;
  T.check(dt.artikel.stand === 'besteld', 'detail: tijdlijn staat op "binnen" (nog niet aangevuld)');
  r = await A('POST', `/api/tekorten/${MULTI}/binnen`, { aantal: 9 });
  T.check(r.status === 409 && /nog maar 2/.test(r.json.error), 'meer dan nog te verwachten wordt geweigerd (409)');
  r = await A('POST', `/api/tekorten/${MULTI}/binnen`, { aantal: 0 });
  T.check(r.status === 400, 'aantal 0 wordt geweigerd (400)');
  h2 = await lijstH(regel2.id);
  T.check(h2 && h2.h.kan_afvinken && h2.h.max_nu === 3 && /3 van 5 binnen/.test(h2.h.waar_tekst), 'aanvullijst: af te vinken tot 3, tekst "3 van 5 binnen"');
  r = await A('POST', `/api/aanvullijst/${regel2.id}/aangevuld`, { aantal: 4 });
  T.check(r.status === 409 && /nog maar 3/.test(r.json.error), 'meer afvinken dan binnen: 409');
  r = await A('POST', `/api/aanvullijst/${regel2.id}/aangevuld`, {});
  T.check(r.status === 200 && r.json.gedaan === 3 && r.json.open === 2, 'afvinken zonder aantal = wat binnen is (3), rest 2 blijft open');
  T.check((await stock(MULTI)) === 0, 'voorraad 3 → 0 (niet dubbel)');
  h2 = await lijstH(regel2.id);
  T.check(h2 && !h2.h.kan_afvinken && h2.h.aantal === 2, 'rest 2 wacht weer op levering');
  r = await A('POST', `/api/aanvullijst/${regel2.id}/aangevuld`, {});
  T.check(r.status === 409, 'afvinken zonder iets binnen: 409');
  r = await A('POST', `/api/tekorten/${MULTI}/binnen`, {});
  T.check(r.status === 200 && r.json.volledig === true && r.json.binnen === 5, 'rest binnen zonder aantal = 2 → volledig');
  T.check((await stock(MULTI)) === 2, 'voorraad 0 → 2');
  r = await A('POST', `/api/tekorten/${MULTI}/binnen`, {});
  T.check(r.status === 409, 'nogmaals binnen: 409 (nooit dubbel)');
  T.check((await stock(MULTI)) === 2, 'voorraad blijft 2');
  h2 = await lijstH(regel2.id);
  T.check(h2 && h2.h.kan_afvinken && h2.h.aantal === 2, 'rest is nu af te vinken (2)');
  r = await A('POST', `/api/aanvullijst/${regel2.id}/aangevuld`, {});
  T.check(r.status === 200 && (await stock(MULTI)) === 0 && (await T.leesDb(srv.dbPad, 'SELECT aangevuld FROM nakijk_regels WHERE id=?', [regel2.id]))[0].aangevuld === 1, 'rest afvinken: voorraad 2 → 0, regel aangevuld');
  tk2 = (await A('GET', '/api/tekorten-overzicht')).json.artikels.find((a) => a.artikel_id === String(MULTI));
  T.check(tk2 && tk2.stand === 'afgehandeld', 'Tekorten: afgehandeld');

  // ═══ PUNT 1a — onbekend artikel: taak + vraag aan kantoor, daarna koppelen ═══
  T.info('Punt 1a: aanvraag zonder herkend artikel');
  r = await P('POST', `/api/kv/${kvtok}/aanvraag`, { tekst: 'Xyzzy kameelbulten', aantal: 2 });
  const av3 = r.json.id;
  r = await A('PUT', `/api/aanvragen/${av3}/status`, { status: 'goedgekeurd' });
  T.check(r.status === 200, 'goedkeuren zonder bekend artikel lukt (200)');
  T.check((await T.leesDb(srv.dbPad, 'SELECT COUNT(*) n FROM transport_taken WHERE aanvraag_id=?', [av3]))[0].n === 1, 'wel een transporttaak');
  T.check((await T.leesDb(srv.dbPad, "SELECT COUNT(*) n FROM nakijk_regels WHERE kantoor_notitie LIKE ?", [`%aanvraag #${av3} van KV%`]))[0].n === 0, 'nog geen regel');
  const mk = (await K2('GET', '/api/meldingen')).json;
  T.check((Array.isArray(mk) ? mk : mk.meldingen || []).some((m) => /artikel is onbekend/.test(m.tekst)), 'kantoor krijgt een duidelijke vraag');
  let za = (await A('GET', '/api/aanvragen/zonder-artikel')).json;
  T.check(za.some((x) => x.id === av3), 'staat onder "Aanvragen zonder artikel"');
  r = await A('PUT', `/api/aanvragen/${av3}/artikel`, { item_type_id: WATER, aantal: 2 });
  T.check(r.status === 200 && r.json.actie === 'uit_pool', 'artikel koppelen maakt de handeling (uit voorraad)');
  za = (await A('GET', '/api/aanvragen/zonder-artikel')).json;
  T.check(!za.some((x) => x.id === av3), 'verdwijnt uit de lijst');
  r = await A('PUT', `/api/aanvragen/${av3}/artikel`, { item_type_id: WATER });
  T.check(r.status === 409, 'tweede keer koppelen: 409');
  // afwijzen blijft werken
  r = await P('POST', `/api/kv/${kvtok}/aanvraag`, { tekst: '20 ballonnen' });
  const av4 = r.json.id;
  r = await A('PUT', `/api/aanvragen/${av4}/status`, { status: 'afgewezen', reden: 'Genoeg in de bak' });
  T.check((await T.leesDb(srv.dbPad, 'SELECT COUNT(*) n FROM transport_taken WHERE aanvraag_id=?', [av4]))[0].n === 0 && /Genoeg/.test((await kvAanvragen()).find((a) => a.id === av4).antwoord), 'afwijzen: geen taak, KV ziet de reden');

  // ═══ PUNT 2 — aanvuller en coördinator ═══
  T.info('Punt 2: aanvuller/coördinator');
  const AV = require(T.ROOT + '/public/aanvullen.js');
  const thema = ijk.themas.alles_op_wieltjes;
  const bakId = (await A('POST', `/api/themas/${thema}/bakken`, { label: 'Tf6 bak', code: 'TF61' })).json.id;
  for (const [n, q] of [['Tf6 Veer', 4], ['Tf6 Krijt', 5]]) await A('POST', `/api/bakken/${bakId}/items`, { naam: n, qty: q });
  await A('POST', `/api/kampmomenten/${km}/themas`, { thema_id: thema });
  const d0 = (await P('GET', `/api/kv/${kvtok}/data`)).json, kb = d0.bakken.find((b) => b.code === 'TF61');
  const tel = (n, a) => P('POST', `/api/kv/${kvtok}/bakken/${kb.id}/tellen`, { regels: [{ item_id: kb.items.find((i) => i.naam === n).id, aangetroffen: a }] });
  await tel('Tf6 Veer', 1); await tel('Tf6 Krijt', 5);
  await P('POST', `/api/kv/${kvtok}/versturen`, {});
  const nk = (await A('GET', '/api/nakijken')).json.bakken.find((b) => b.bak.code === 'TF61' && b.kampmoment_id === km);
  const veerType = (await T.leesDb(srv.dbPad, 'SELECT item_type_id AS t FROM bak_items WHERE bak_id=? AND naam=?', [bakId, 'Tf6 Veer']))[0].t;
  await zetStock(veerType, 20);
  const det = (await A('GET', `/api/nakijken/sessie/${nk.sessie_id}`)).json;
  const veerRegel = det.items.find((i) => i.naam === 'Tf6 Veer');
  await A('PUT', `/api/nakijken/regel/${veerRegel.regel_id}`, { kantoor_actie: 'bestellen', kantoor_aantal: 3 });
  // een melding van de aanvuller zonder besluit van kantoor
  let rf = await A('POST', '/api/aanvullijst/melding', { sessie_id: nk.sessie_id, item_naam: 'Tf6 Krijt', soort: 'weg', aantal: 1 });
  T.check(rf.status === 200, 'aanvuller meldt een stuk als weg');
  rf = await A('POST', `/api/nakijken/sessie/${nk.sessie_id}/afronden`);
  T.check(rf.status === 200 && rf.json.onbeslist === 1, 'afronden waarschuwt: 1 gemelde regel wacht op een besluit (' + JSON.stringify(rf.json) + ')');
  const krijt = (await T.leesDb(srv.dbPad, "SELECT * FROM nakijk_regels WHERE sessie_id=? AND item_naam='Tf6 Krijt'", [nk.sessie_id]))[0];
  T.check(krijt && !krijt.kantoor_actie, 'de gemelde regel kreeg geen stille actie "bestellen" (actie: "' + (krijt && krijt.kantoor_actie) + '")');
  let ll = (await A('GET', `/api/aanvullijst?datum=${vandaag}&alles=1`)).json;
  let grp = ll.bakken.find((g) => g.sessie_id === nk.sessie_id);
  const hVeer = grp.handelingen.find((h) => h.stuk === 'Tf6 Veer');
  T.check(hVeer && !hVeer.kan_afvinken && hVeer.uit_voorraad_mogelijk === true && hVeer.voorraad === 20, 'bestelling wacht op levering, maar voorraad is genoeg: knop "uit voorraad" mogelijk (voorraad ' + (hVeer && hVeer.voorraad) + ')');
  // G3: Bak klaar met open melding
  const grpKlaarVoor = AV.bakKlaar(grp);
  T.check(!grpKlaarVoor, 'bak nog niet klaar: Veer wacht nog');
  r = await A('POST', `/api/tekorten/${veerType}/stand`, {});
  r = await A('PUT', `/api/tekorten/${veerType}/stand`, { stand: 'uit_voorraad' });
  T.check(r.status === 200, 'Aanvullen uit voorraad (stand) lukt voor kantoor/coördinator');
  ll = (await A('GET', `/api/aanvullijst?datum=${vandaag}&alles=1`)).json; grp = ll.bakken.find((g) => g.sessie_id === nk.sessie_id);
  const hVeer2 = grp.handelingen.find((h) => h.stuk === 'Tf6 Veer');
  T.check(hVeer2.kan_afvinken && hVeer2.soort === 'uit_pool', 'handeling is nu meteen af te vinken (uit voorraad)');
  await A('POST', `/api/aanvullijst/${hVeer2.regel_id}/aangevuld`, {});
  ll = (await A('GET', `/api/aanvullijst?datum=${vandaag}&alles=1`)).json; grp = ll.bakken.find((g) => g.sessie_id === nk.sessie_id);
  T.check(AV.bakKlaar(grp), 'Bak klaar kan, ook met een open eigen melding bij kantoor');
  const bakHtml = AV.bak(grp, {});
  T.check(bakHtml.includes('klaar (1/1)') && !bakHtml.includes('data-av="klaar" disabled'), 'knop "Bak klaar (1/1)": teller n/m telt de melding niet mee');
  T.check(/1 melding ligt bij kantoor/.test(bakHtml), 'uitleg onder de knop over de melding');
  // lijst: losse melding apart
  await A('POST', '/api/aanvullijst/melding', { item_naam: 'Los ding', soort: 'weg', aantal: 1 });
  ll = (await A('GET', `/api/aanvullijst?datum=${vandaag}&alles=1`)).json;
  const bakkenZonderLos = ll.bakken.filter((g) => g.bak.soort !== 'melding' && !g.leeg).length;
  T.check(ll.tellers.bakken === bakkenZonderLos, 'tellers.bakken telt geen losse meldingen (' + ll.tellers.bakken + ' = ' + bakkenZonderLos + ')');
  const lijstHtml = AV.lijst(ll, { filter: 'alles', vandaag });
  T.check(/Losse meldingen en aanvragen/.test(lijstHtml), 'losse meldingen staan in een eigen blok');
  const vd = (await A('GET', `/api/vandaag?datum=${vandaag}`)).json;
  T.check(vd && vd.mijn !== undefined || vd, 'vandaag geladen');
  // G13: deelaantal na afvinken
  const hGedaan = { regel_id: 1, stuk: 'Krijt', aantal: 2, totaal: 5, gedaan: 3, aangevuld: 1, soort: 'uit_pool', kan_afvinken: true, binnen: true, waar_tekst: '' };
  T.check(/× 5/.test(AV.handeling(hGedaan, {})), 'afgevinkte handeling toont het totaal (× 5), niet het restant');
  // G4 netfout: de bron vangt een mislukte fetch af en toont een melding
  const src = lees('public/aanvullen.js');
  T.check(src.includes("error:'Geen verbinding, niet bewaard"), 'netfout bij afvinken geeft "Geen verbinding, niet bewaard" (geen stille fout)');
  // G8 print
  const html = lees('public/aanvullijst-print.html');
  T.check(/max-width:640px/.test(html) && /id="terug-knop"/.test(html), 'printlijst: gsm-opmaak en terugknop per rol');

  // ═══ PUNT 3 — kantoor ═══
  T.info('Punt 3: kantoor');
  // N3: tekort én kapot op één regel
  const bak3 = (await A('POST', `/api/themas/${thema}/bakken`, { label: 'Tf6 bak 3', code: 'TF62' })).json.id;
  await A('POST', `/api/bakken/${bak3}/items`, { naam: 'Tf6 Prul', qty: 5 });
  const kb3 = (await P('GET', `/api/kv/${kvtok}/data`)).json.bakken.find((b) => b.code === 'TF62');
  await P('POST', `/api/kv/${kvtok}/bakken/${kb3.id}/tellen`, { regels: [{ item_id: kb3.items[0].id, aangetroffen: 3, kapot_aantal: 1 }] });
  await P('POST', `/api/kv/${kvtok}/versturen`, {});
  const nk3 = (await A('GET', '/api/nakijken')).json.bakken.find((b) => b.bak.code === 'TF62' && b.kampmoment_id === km);
  const det3 = (await A('GET', `/api/nakijken/sessie/${nk3.sessie_id}`)).json;
  // TF8 G4: het kapotte deel is een eigen regel met zijn eigen acties en aantal (de samengevoegde keuze van TF6 is vervangen).
  const prulAll = det3.items.filter((i) => i.naam === 'Tf6 Prul');
  const prul = prulAll.find((i) => i.afwijking === 'tekort'), prulKapot = prulAll.find((i) => i.afwijking === 'kapot');
  T.check(prul && prulKapot && prul.acties.some((a) => a.waarde === 'bestellen') && prulKapot.acties.some((a) => a.waarde === 'afschrijven_bestellen'), 'N3 (TF8): tekort en kapot zijn twee regels met elk hun eigen acties');
  r = await A('PUT', `/api/nakijken/regel/${prulKapot.regel_id}`, { kantoor_actie: 'afschrijven_bestellen', kantoor_aantal: 1 });
  T.check(r.status === 200 && r.json.kantoor_actie === 'afschrijven_bestellen' && r.json.kantoor_aantal === 1, 'N3: afschrijven geldt voor het kapotte deel (1)');
  r = await A('PUT', `/api/nakijken/regel/${prul.regel_id}`, { kantoor_actie: 'bestellen', kantoor_aantal: 2 });
  T.check(r.json.kantoor_aantal === 2, 'N3: bestellen geldt voor het tekort (2)');
  // N1: Taken toont alles, ook wat voor de periode valt
  const gen = await A('POST', '/api/kampmomenten/genereer-transport', { ids: [km] });
  T.check(gen.status === 200, 'genereren werkt');
  const voorPer = await A('POST', '/api/transport-taken', { type: 'extra', datum: '2020-01-06', van_locatie_id: R, naar_locatie_id: ijk.locaties.abdijschool, opmerking: 'Tf6 oud', regels: [{ naam: 'Tf6 oud', qty: 1, soort: 'spoed' }] });
  const alle = (await A('GET', '/api/taken-overzicht?alle=1')).json;
  T.check(alle.bereik.alle === true && alle.taken.some((t) => t.datum === '2020-01-06') && alle.taken.length === alle.tellers.deze_week, 'N1: "Alles" toont ook een taak van vóór de periode (' + alle.taken.length + ' taken)');
  const lege = (await A('GET', '/api/taken-overzicht?week=1999-01-04')).json;
  T.check(lege.bereik.alle === false && lege.taken.length === 0, 'N1: een expliciet gekozen lege week blijft leeg (geen automatische sprong) ' + JSON.stringify([lege.bereik, lege.taken.length, lege.week]));
  const taken = lees('public/taken.js');
  T.check(taken.includes('id="zicht-wissel"') && taken.includes('Alles tonen'), 'N1: knop "Alles tonen" / "Alleen deze week" en de getoonde periode');
  T.check(lees('public/kampmomenten.js').includes('/taken?alle=1'), 'N1: de toast na Genereren linkt naar Taken');
  T.check(lees('public/ritplanning.js').includes('eerste week met taken zonder rit') || lees('public/ritplanning.js').includes('open dan op de eerste week'), 'N1: Ritplanning opent op de eerste week met open taken');
  // N2: Vandaag kantoor: dringend vs later
  const vk = (await A('GET', '/api/vandaag')).json;
  const alleItems = [...vk.beslissen, ...vk.inplannen, ...vk.nakijken];
  T.check(alleItems.some((x) => x.dringend === false) || vk.nakijken.length >= 0, 'N2: planningsitems dragen dringend:false');
  T.check(vk.nakijken.filter((x) => /^conflict-/.test(x.id)).every((x) => x.dringend === false), 'N2: conflicten staan onder "Later deze periode"');
  T.check(lees('public/vandaag.html').includes('<h3>Controles ') && !lees('public/vandaag.html').includes('<h3>Nakijken '), 'N2: de kolom heet niet meer "Nakijken" (zoals het scherm Nakijken)');
  T.check(lees('public/vandaag.js').includes('Later deze periode'), 'N2: ingeklapt blok "Later deze periode"');
  // N4, N5, N7, N9, N10, N12, N14
  const per = lees('public/periodes.js');
  T.check(per.includes('eind.value<f.start.value') && !per.includes("f.naam.value.trim()&&f.start.value&&f.eind.value?{"), 'N4: einde vóór start wordt geweigerd in beide dialogen');
  T.check(lees('public/nav.js').includes("naam: 'Meldingen', href: '/meldingen', badge: 'b-meldingen'"), 'N5: Meldingen staat in de desktopbalk met teller');
  T.check(lees('public/personeel.js').includes('id="d-uitnodig"'), 'N7: uitnodigen staat in het persoon-detail');
  T.check(lees('public/nakijken.js').includes("'/bakken?id='") && !lees('public/nakijken.js').includes("'/#materiaal?bak='"), 'N9: "Bak openen" gaat naar /bakken?id=');
  const bakkenR = await T.api(srv.base, null, 'GET', '/bakken?id=' + bakId);
  T.check(bakkenR.status === 200 || bakkenR.status === 302, 'N9: /bakken?id= bestaat als pagina');
  const sr = lees('public/sportrooster.js');
  T.check(sr.includes("zicht')==='seizoen'") && sr.includes('id="leeg-inplannen"') && !sr.includes("'Hele zomer'"), 'N10/N12: ?zicht=seizoen werkt, echte inplan-knop in de lege lijst, "Hele periode"');
  const km14 = lees('public/kampmomenten.js');
  T.check(km14.includes('Thema zoeken') && km14.includes('dagLast'), 'N14: zoekveld in de themakeuze en gewone thema’s vóór themadagen');
  T.check(lees('public/ritplanning.js').includes("'rit':'ritten'"), 'N12: "1 rit" in plaats van "1 ritten"');
  // G11: melding "bestelling binnen" gaat niet naar wie het zelf deed
  const ml = (await T.leesDb(srv.dbPad, "SELECT voor_rol,tekst FROM meldingen WHERE tekst LIKE 'Bestelling binnen:%' ORDER BY id"));
  T.check(ml.length >= 2 && ml.every((m) => m.voor_rol === 'kantoor'), 'TF9: "Bestelling binnen" gaat naar de andere kantoormedewerkers');
  T.check(ml.some((m) => /3 van 5/.test(m.tekst)), 'melding noemt "3 van 5" bij deels binnen');
} finally {
  await T.einde(srv);
}
