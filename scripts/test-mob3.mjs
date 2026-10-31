// test-mob3.mjs — MOB3 (chat D): gsm gelijk aan desktop, eerste groep (balken, Transport, Nakijken/Vandaag, chauffeur, print).
// Eigen server via _testhulp (poort 3365 of TEST_POORT, herfst-test.db). HTML-bouwers draaien met echte API-data (390 px = de gsm-weergave);
// CSS-bronnen bewijzen dat boven 768 px niets verandert. De pagina-metingen op 390 en 1920 staan in het verslag (live, in de browser).
import * as T from './_testhulp.mjs';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const lees = (p) => fs.readFileSync(T.ROOT + '/' + p, 'utf8');
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: Number(process.env.TEST_POORT) || 3365 });
// bovenste niveau van een CSS-tekst (zonder de inhoud van de blokken en zonder commentaar)
const bovenste = (css) => { let d = 0, uit = ''; for (const ch of css.replace(/\/\*[\s\S]*?\*\//g, '')) { if (ch === '{') { if (!d) uit += '{'; d++; continue; } if (ch === '}') { d--; if (!d) uit += '}'; continue; } if (!d) uit += ch; } return uit; };
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const nu = new Date(), iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const plus = (n) => { const d = new Date(nu); d.setDate(d.getDate() + n); return iso(d); };
  const R = ijk.locaties.rozenweg, AB = ijk.locaties.abdijschool, BE = ijk.locaties.betekom;

  // ═══ Punt 1 · gemeenschappelijk ═══
  T.info('Punt 1 · gemeenschappelijk');
  const css = lees('public/gsm-gelijk.css'), js = lees('public/gsm-gelijk.js');
  const buiten = bovenste(css);
  T.check(buiten.replace(/@media[\s\S]*$/, '').replace(/\s+/g, '') === '.gsm-uitleg{}.gsm-hint{}' && /\.gsm-uitleg\{display:none\}/.test(css) && /\.gsm-hint\{display:none\}/.test(css),'desktop ongewijzigd: buiten de gsm-@media staat alleen "verborgen" voor uitleg en hint');
  T.check(/@media \(max-width:767px\)/.test(css) && !/min-width/.test(css), 'alle regels staan onder 768 px');
  T.check(/\.voet\.sel\{position:fixed[^}]*bottom:calc\(72px/.test(css) && /\.voet\.sel \.bulk \.knop\{[^}]*min-height:44px/.test(css), 'bulkbalk: vast boven de tabbalk, elke actie een knop van minstens 44 px');
  T.check(/\.gsm-acties[^}]*\{[^}]*flex-wrap:wrap/.test(css) && /\.gsm-acties \.knop[^}]*min-height:44px/.test(css), 'Export en + Nieuw: eigen rij, knoppen van minstens 44 px');
  T.check(/\.gsm-scroll\{[^}]*mask-image:linear-gradient/.test(css) && /\.gsm-scroll\.gsm-eind\{[^}]*mask-image:none/.test(css), 'scrollbare balken: fade tot het einde bereikt is');
  T.check(/input\[type=checkbox\]::before[^}]*inset:-12px/.test(css) && /input\[type=checkbox\][^}]*width:24px/.test(css), 'vinkjes: 24 px met een aanraakgebied van 48 px (::before rondom)');
  T.check(/\.frame input:not\(\[type=checkbox\]\)[^{]*\{min-height:44px/.test(css) && /\.frame a:not\(\.logo\)\{min-height:44px/.test(css) && /\.frame button:not\(\.x\)[^{]*\{min-height:44px/.test(css), 'velden, knoppen, dagknoppen en tekstlinks: minstens 44 px');
  T.check(/body\.heeft-tabs\{overflow-x:hidden\}/.test(css), 'geen horizontale paginascroll onder de tabbalk (o.a. /locaties)');
  const nav = lees('public/nav.js');
  T.check(nav.includes('/public/gsm-gelijk.css') && nav.includes('/public/gsm-gelijk.js'), 'nav.js laadt de gedeelde gsm-regels op elke pagina');
  const BULK = { kampmomenten: ['b-genereer', 'b-kvlinks', 'b-thema', 'b-weg'], taken: ['b-rit', 'b-verplaats', 'b-bundel', 'b-weg'], bakken: ['b-etiket', 'b-verplaats', 'b-thema', 'b-weg'], personeel: ['b-uitn', 'b-rol', 'b-deact'] };
  for (const [pagina, ids] of Object.entries(BULK)) {
    const h = lees(`public/${pagina}.html`), bulk = /<span class="bulk">([\s\S]*?)<\/span><\/div>/.exec(h);
    T.check(bulk && ids.every((id) => bulk[1].includes(`id="${id}"`)), `${pagina}: alle ${ids.length} bulkacties (${ids.join(', ')}) staan in .voet .bulk, dus in de wrap-balk`);
    const pcss = lees(`public/${pagina}.css`);
    T.check(!/\.bulk[^{]*\{[^}]*overflow:\s*hidden/.test(pcss) && !/\.voet[^{]*\{[^}]*overflow:\s*hidden/.test(pcss), `${pagina}: de bulkbalk wordt niet afgesneden door de eigen CSS`);
  }
  // Export en + Nieuw: .sub .r bestaat op de beheerpagina's en gsm-gelijk.js verplaatst de inhoud
  for (const pagina of ['kampmomenten', 'rooster', 'taken', 'bakken', 'personeel', 'periodes', 'nakijken']) {
    const h = lees(`public/${pagina}.html`);
    T.check(/<(?:span|div) class="r">/.test(h) && /class="sub"/.test(h), `${pagina}: Export / + Nieuw staan in .sub .r en komen op gsm in een eigen rij`);
  }
  // gsm-gelijk.js met een nagebouwde DOM
  const maakEl = (tag, attrs = {}, ouder = null, kinderen = []) => { const e = { nodeType: 1, tagName: tag, parentElement: ouder, disabled: !!attrs.disabled, getAttribute: (k) => attrs[k] ?? null }; return e; };
  globalThis.matchMedia = undefined; // module laadt zonder document
  const G = require(T.ROOT + '/public/gsm-gelijk.js');
  const div = maakEl('DIV', { title: 'Wit = vrij, blauw = bezet' }), cel = maakEl('SPAN', {}, div);
  T.check(G.uitlegVoor(cel) === 'Wit = vrij, blauw = bezet', 'tik-uitleg: een tik op een cel binnen een element met title geeft die uitleg');
  T.check(G.uitlegVoor(maakEl('BUTTON', { title: 'Opslaan' })) === '' && G.uitlegVoor(maakEl('INPUT', { title: 'x' })) === '', 'een knop met een eigen actie en een veld tonen geen uitleg (ze doen hun werk)');
  T.check(G.uitlegVoor(maakEl('BUTTON', { title: 'Kies minstens twee taken van dezelfde dag', disabled: true })) === 'Kies minstens twee taken van dezelfde dag', 'een uitgeschakelde knop legt op een tik uit waarom hij niet kan');
  T.check(G.uitlegVoor(maakEl('DIV', { title: '  ' })) === '' && G.uitlegVoor(null) === '', 'lege title of geen element: geen uitleg');
  const titelPag = { voertuigen: lees('public/voertuigen.js'), locaties: lees('public/locaties.js'), rooster: lees('public/rooster.js') };
  T.check(Object.values(titelPag).every((x) => /title=/.test(x)), 'Voertuigen, Locaties en Rooster Seizoen gebruiken title; de gedeelde hulp dekt ze alle drie');
  T.check(js.includes("doc.addEventListener('click'") && /'click'[\s\S]*true\)/.test(js), 'één gedeelde klik-luisteraar (capture) opent de uitleg, geen eigen code per pagina');
  const bundel = js.includes('plaatsActies') && js.includes('insertAdjacentElement') && js.includes('rij._thuis');
  T.check(bundel, 'acties gaan naar een eigen rij en bij een breed scherm terug naar de subbalk');

  // ═══ Punt 2 · Transport ═══
  T.info('Punt 2 · Transport');
  const DAG = plus(3), MA = (() => { const d = new Date(DAG + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); })();
  const RP = require(T.ROOT + '/public/ritplanning.js').gsm;
  const plan = async () => (await A('GET', `/api/ritplanning?week=${MA}`)).json;
  const cn = (await plan()).voertuigen.find((v) => v.soort === 'eigen');
  const rit = (await A('POST', '/api/ritten', { datum: DAG, vertrek: '09:00', personeel_id: 2, voertuig_id: cn.id })).json;
  const t1 = (await A('POST', '/api/transport-taken', { type: 'levering', datum: DAG, tijd: '09:30', van_locatie_id: R, naar_locatie_id: AB, rit_id: rit.id, regels: [{ naam: 'Croquet doelen', qty: 4 }, { naam: 'Pionnen', qty: 20 }] })).json;
  const t2 = (await A('POST', '/api/transport-taken', { type: 'levering', datum: DAG, tijd: '10:30', van_locatie_id: R, naar_locatie_id: BE, rit_id: rit.id, regels: [{ naam: 'Ballen', qty: 8 }] })).json;
  let P = await plan();
  const dagD = P.dagen.find((d) => d.datum === DAG);
  let lijst = RP.lijst(P, DAG);
  T.check(lijst.includes('data-opdracht-ingang') && lijst.includes(`href="/opdracht?datum=${DAG}"`) && /Opdracht van/.test(lijst), 'ingang naar Opdracht onder Transport (Ritplanning gsm): knop met de datum van de dag');
  T.check(lijst.includes('data-g="weergave" data-w="dag"') && lijst.includes('data-g="weergave" data-w="week"'), 'schakelaar Dag / Week in de ritlijst');
  const wk = RP.week(P, DAG);
  T.check(wk.includes(`data-weekdag="${DAG}"`) && wk.includes('aria-pressed="true"') && wk.includes(`data-g="rit" data-id="${rit.id}"`) && wk.includes(`data-g="dag" data-d="${DAG}"`), 'weekbeeld: per dag de ritten per bestuurder; tik op een rit opent het detail, tik op de dag opent de dag');
  T.check(!/<table|<tr[ >]/.test(wk) && (wk.match(/data-weekdag=/g) || []).length >= 5, 'weekbeeld zonder tabel, minstens ma–vr');
  const ritD = dagD.ritten.find((r) => r.id === rit.id);
  const det = RP.detail(P, ritD);
  T.check((det.match(/data-g="slot"/g) || []).length === 2 && /🔒 vast|🔓 vrij/.test(det), 'ritdetail gsm: per stop een knop 🔒 vast / 🔓 vrij');
  T.check(det.includes('data-g="splits"') && det.includes('Splitsen') && det.includes(`href="/opdracht?datum=${DAG}&rit=${rit.id}"`), 'ritdetail gsm: Splitsen en de knop Opdracht');
  const slot0 = ritD.stops.find((s) => s.taak_id === t1.id).slot;
  const sl = await A('PUT', `/api/transport-taken/${t1.id}`, { slot: slot0 === 'vrij' ? 'vast' : 'vrij' });
  P = await plan();
  T.check(sl.status === 200 && P.dagen.find((d) => d.datum === DAG).ritten.find((r) => r.id === rit.id).stops.find((s) => s.taak_id === t1.id).slot !== slot0, `🔒 vast/vrij wisselt echt via de API (${slot0} → ${slot0 === 'vrij' ? 'vast' : 'vrij'})`);
  const gr = (await A('GET', `/api/ritten/${rit.id}`)).json;
  const spl = RP.splitsen(ritD, gr.taken.filter((t) => (t.regels || []).length > 1), { taak: t1.id, datum: DAG });
  T.check((spl.match(/name="regel"/g) || []).length === 2 && spl.includes('Croquet doelen × 4') && spl.includes('name="datum"') && spl.includes('data-g="splits-ok"'), 'splitsscherm: de regels van de gekozen stop als vinkjes, nieuwe datum, knop Splitsen');
  const taken0 = (await A('GET', `/api/ritten/${rit.id}`)).json.taken.length;
  const dagNa = plus(4), sp = await A('POST', `/api/transport-taken/${t1.id}/splits`, { regel_ids: [gr.taken.find((t) => t.id === t1.id).regels[0].id], datum: dagNa });
  T.check(sp.status === 200 && sp.json.verplaatst === 1 && sp.json.nieuwe_taak_id, `splitsen op gsm gebruikt dezelfde route als desktop (1 regel naar taak #${sp.json.nieuwe_taak_id} op ${dagNa})`);
  const rjs = lees('public/ritplanning.js');
  T.check(rjs.includes("a==='weergave'") && rjs.includes("a==='slot'") && rjs.includes("a==='splits-ok'") && rjs.includes("GS.weergave==='week'"), 'de knoppen zijn aan de pagina gekoppeld (weergave, slot, splits)');
  const rcss = lees('public/ritplanning.css');
  T.check(!/\.wk\b[^{]*\{[^}]*display:none/.test(rcss), 'de schakelaar gebruikt de bestaande .wk-balk; geen nieuwe desktopregel');

  // ═══ Punt 4 · chauffeur ═══
  T.info('Punt 4 · chauffeur');
  const ch = (await A('POST', '/api/personeel', { naam: 'Mob3 Chauffeur', rol: 'chauffeur' })).json;
  await A('POST', `/api/personeel/${ch.id}/pincode`, { pincode: '5837' });
  const chTok = await T.login(srv.base, ch.id, '5837');
  const C = (m, p, b) => T.api(srv.base, chTok, m, p, b);
  const maakRit = async (dag, vertrek) => { const r = (await A('POST', '/api/ritten', { datum: dag, vertrek, personeel_id: ch.id })).json; await A('POST', '/api/transport-taken', { type: 'levering', datum: dag, tijd: vertrek, van_locatie_id: R, naar_locatie_id: AB, rit_id: r.id, regels: [{ naam: 'Ballen', qty: 2 }] }); await A('POST', `/api/ritten/${r.id}/klaarzet`, {}); return r.id; };
  const r1 = await maakRit(plus(1), '09:00'), r3 = await maakRit(plus(3), '10:00'), r9 = await maakRit(plus(9), '08:30');
  const n2 = (await A('POST', '/api/ritten', { datum: plus(5), vertrek: '08:00', personeel_id: ch.id })).json; // niet klaargezet
  const vm = (await C('GET', '/api/vandaag?mijn=1')).json;
  const ids = (vm.ritten_komend || []).flatMap((x) => x.ritten.map((r) => r.id));
  T.check(vm.ritten_morgen.some((r) => r.id === r1) && ids.includes(r3) && ids.includes(r9), 'ritten verder dan morgen staan onder Ritten (klaargezette ritten over 3 en 9 dagen)');
  T.check(!ids.includes(n2.id), 'een rit die nog niet klaargezet is, blijft verborgen (zoals voorheen)');
  T.check(vm.ritten_komend.every((x, i, a) => !i || a[i - 1].datum < x.datum) && vm.ritten_komend.every((x) => x.datum > plus(1)), 'per dag, in volgorde, na morgen');
  const VD = require(T.ROOT + '/public/vandaag.js');
  const gs = VD.ritten(vm);
  T.check(gs.includes(`data-komend="${plus(3)}"`) && gs.includes('data-rdatum') && gs.includes('Andere dag bekijken') && /type="date"/.test(gs), 'gsm-tab Ritten: komende dagen met datumkeuze');
  const gk = VD.ritten({ ...vm, gekozen: { datum: plus(9), datum_tekst: 'x', ritten: (vm.ritten_komend.find((x) => x.datum === plus(9)) || { ritten: [] }).ritten } });
  T.check(gk.includes(`/rit/`) && gk.includes('value="' + plus(9) + '"'), 'gekozen dag: de ritten van die dag met link naar de rit');
  const dag9 = (await C('GET', `/api/vandaag?mijn=1&datum=${plus(9)}`)).json;
  T.check(dag9.ritten_vandaag.some((r) => r.id === r9), 'datumkeuze: /api/vandaag?mijn=1&datum= geeft de ritten van die dag');
  T.check((await C('POST', '/api/ritten', { datum: plus(3), vertrek: '08:00' })).status === 403 && (await C('PUT', `/api/transport-taken/${t1.id}`, { slot: 'vrij' })).status === 403 && (await C('POST', `/api/transport-taken/${t1.id}/splits`, { regel_ids: [1], datum: plus(5) })).status === 403, 'rechten blijven: een chauffeur plant, wisselt en splitst niets');
  const vjs = lees('public/vandaag.js'), vcss = lees('public/vandaag.css');
  T.check(/eigenRol==='chauffeur'[\s\S]{0,120}alleen-gsm[\s\S]{0,80}startGsm\(\)/.test(vjs) && /body\.alleen-gsm \.frame\{display:none\}/.test(vcss), 'desktop: de chauffeur krijgt de lichte weergave zonder lege kantoorkolommen');
  T.check(!/alleen-gsm/.test(lees('public/vandaag.html')), 'kantoor op desktop: de pagina-opbouw is ongewijzigd');

  // ═══ Punt 3 · Nakijken en Vandaag ═══
  T.info('Punt 3 · Nakijken en Vandaag');
  const k = (await A('GET', '/api/vandaag')).json;
  const kx = VD.kantoorExtra(k);
  T.check(kx.includes('id="k-cijfers"') && kx.includes('ritten onderweg') && kx.includes('locaties open'), 'Vandaag gsm (kantoor): cijfers onderweg en locaties open');
  T.check(/<details class="sec gsm-blok" id="k-later">/.test(kx) && /<details class="sec gsm-blok" id="k-week">/.test(kx) && /<details class="sec gsm-blok" id="k-volgende">/.test(kx) && !/<details[^>]* open/.test(kx), 'Later deze periode, Deze week en Volgende week: elk ingeklapt');
  const sc = VD.vandaag({ gebruiker: { naam: 'Test', rol: 'kantoor' }, datum_tekst: 'x', n_dingen: 0, nu: null, daarna: [], meldingen: [], kantoor: k });
  T.check(sc.indexOf('class="nukaart"') > -1 && sc.indexOf('class="nukaart"') < sc.indexOf('id="k-cijfers"') && sc.indexOf('id="k-later"') < sc.indexOf('id="k-volgende"'), 'ze staan onder de Nu-kaart');
  T.check(!VD.vandaag({ gebruiker: { naam: 'T', rol: 'chauffeur' }, datum_tekst: 'x', n_dingen: 0, nu: null, daarna: [], meldingen: [] }).includes('k-cijfers'), 'een chauffeur ziet die blokken niet');
  const meer = lees('public/meer.js');
  T.check(!/act:'weergave'/.test(meer.replace(/if\(a==='weergave'\)[^\n]*/, '')) && !meer.includes("s:'groot / compact (zoals op desktop)'"), 'Groot/Compact is uit Meer gehaald: het doet op gsm niets (alleen de desktop-Vandaag gebruikt de voorkeur)');
  const NK = require(T.ROOT + '/public/nakijken.js');
  const nk = (await A('GET', '/api/nakijken')).json;
  const open = Object.fromEntries((nk.locaties || []).map((l) => [String(l.kampmoment_id), true])), st = { locOpen: open, gs: 'lijst', gi: 0, filter: '', zoek: '', geselecteerd: new Set(), open: null, tab: 'telling', week: '' };
  const nl = NK.gsmLijstHtml(nk, st);
  T.check(nl.includes('id="gzoek"') && nl.includes('type="search"') && /min-height:44px/.test(nl.slice(nl.indexOf('id="gzoek"'), nl.indexOf('id="gzoek"') + 300)), 'Nakijken gsm: zoekveld van 44 px');
  const bak0 = (nk.bakken || [])[0];
  if (bak0) {
    const zk = NK.gsmLijstHtml(nk, { ...st, zoek: 'zzzonbestaand' });
    const zp = NK.gsmLijstHtml(nk, { ...st, zoek: bak0.bak.naam });
    T.check((zk.match(/data-gk="open"/g) || []).length === 0 && (zp.match(/data-gk="open"/g) || []).length >= 1, `zoeken filtert de lijst ("${bak0.bak.naam}": ${(zp.match(/data-gk="open"/g) || []).length} treffer(s); onzin: 0)`);
    // de testdata heeft geen telling; een bak met sessie wordt nagebouwd uit de eerste echte bak
    const metSel = (nk.bakken || []).find((b) => b.sessie_id) || { ...bak0, sessie_id: 9901 };
    if (metSel) {
      if (!bak0.sessie_id) { nk.bakken[0] = metSel; }
      const nl = NK.gsmLijstHtml(nk, { ...st, zoek: metSel.bak.naam });
      const sh = NK.gsmLijstHtml(nk, { ...st, zoek: metSel.bak.naam, geselecteerd: new Set([metSel.sessie_id]) });
      T.check(/data-act="vink"[^>]*data-a="\d+"/.test(nl) && sh.includes('1 geselecteerd') && sh.includes('data-act="bulk-afronden"') && sh.includes('data-act="bulk-herinnering"') && sh.includes('data-act="printlijst"') && sh.includes('class="voet sel"'), 'meer bakken samen: vinkje per bak en de bulkbalk (Afronden, Herinnering, Printlijst)');
    } else T.info('geen bak met sessie in de testdata: bulkbalk alleen via bron gecontroleerd');
  } else T.info('geen bakken in de nakijklijst van de testdata');
  T.check(lees('public/nakijken.js').includes('eerdereHtml(det)') && /function gsmRegelHtml[\s\S]{0,1200}eerdereHtml\(det\)/.test(lees('public/nakijken.js')), 'Eerdere tellingen staan al op het gsm-regelscherm (TF7), nu ook in de test vastgelegd');

  // ═══ Punt 5 · print ═══
  T.info('Punt 5 · print');
  T.check(lees('public/backup.js').includes('gsm-hint') && /\.gsm-hint\{display:block!important/.test(css), 'Back-up terugzetten: op gsm een uitleg (kan, maar liever op de pc); op desktop verborgen');
  T.check(lees('public/etiketten.html').includes('gsm-hint') && /@media \(max-width:767px\)\{\.gsm-hint\{display:block\}\}/.test(lees('public/etiketten.html')), 'Etiketten: op gsm een uitleg over printen via het browsermenu');
  T.check(lees('public/aanvullijst-print.html').includes('id="print-knop"') && lees('public/etiketten.html').includes('window.print()'), 'de printknoppen zelf blijven bestaan (niets weggehaald)');
} finally {
  await T.einde(srv);
}
