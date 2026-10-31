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
  const mk = (await A('GET', '/api/meldingen')).json;
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
  // G11: melding "bestelling binnen" gaat niet naar wie het zelf deed
  const ml = (await T.leesDb(srv.dbPad, "SELECT voor_rol,tekst FROM meldingen WHERE tekst LIKE 'Bestelling binnen:%' ORDER BY id"));
  T.check(ml.length >= 2 && ml.every((m) => m.voor_rol === 'coordinator'), '"Bestelling binnen" van kantoor gaat naar coördinatoren');
  T.check(ml.some((m) => /3 van 5/.test(m.tekst)), 'melding noemt "3 van 5" bij deels binnen');
} finally {
  await T.einde(srv);
}
