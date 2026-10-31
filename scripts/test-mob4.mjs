// test-mob4.mjs — MOB4 (chat D): gsm-lijsten in plaats van tabellen (design/mockup-gsm-lijsten.html).
// Eigen server via _testhulp (poort 3366 of TEST_POORT). De kaarten worden uit de echte rijen van de pagina gebouwd (kampmomenten: met de echte
// API-data en de echte lijstHtml; de andere pagina's met rijen zoals de pagina ze tekent, vastgelegd uit de live pagina). De meting op 390 en
// 1920 en de schermafdrukken staan in het verslag (live, in de browser).
import * as T from './_testhulp.mjs';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const lees = (p) => fs.readFileSync(T.ROOT + '/' + p, 'utf8');
const srv = await T.startServer({ poort: Number(process.env.TEST_POORT) || 3366 });
const bovenste = (css) => { let d = 0, uit = ''; for (const ch of css.replace(/\/\*[\s\S]*?\*\//g, '')) { if (ch === '{') { if (!d) uit += '{'; d++; continue; } if (ch === '}') { d--; if (!d) uit += '}'; continue; } if (!d) uit += ch; } return uit; };
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const GL = require(T.ROOT + '/public/gsm-lijst.js');
  const css = lees('public/gsm-lijst.css'), js = lees('public/gsm-lijst.js');
  const PAG = ['kampmomenten', 'taken', 'bakken', 'personeel', 'logboek', 'themas', 'pool', 'catalogus', 'locaties'];

  T.info('Opzet');
  T.check(PAG.every((p) => GL.PAGINA['/' + p]), 'het patroon kent alle negen pagina’s (één configuratie per pagina, één gedeelde hulp)');
  T.check(lees('public/nav.js').includes('/public/gsm-lijst.js') && lees('public/nav.js').includes('/public/gsm-lijst.css'), 'nav.js laadt de gedeelde hulp; geen kopie per pagina');
  T.check((js.match(/function start\(/g) || []).length === 1 && PAG.every((p) => !/gsm-lijst/.test(lees(`public/${p}.js`))), 'geen vijf kopieën: de pagina-scripts bevatten niets van het patroon');
  T.check(bovenste(css).replace(/\s+/g, '').replace(/@media[\s\S]*$/, '') === '#gl,#gl-terug,#gl-sheet{}' && /#gl,#gl-terug,#gl-sheet\{display:none\}/.test(css), 'desktop ongewijzigd: buiten de gsm-@media staat alleen "verborgen"');
  T.check(PAG.every((p) => !/gl-/.test(lees(`public/${p}.html`))) && !/min-width:\s*768/.test(css), 'de pagina’s zelf zijn niet aangepast: desktop-HTML bevat geen gsm-onderdelen');
  T.check(/\.gl-ik\{width:44px;height:44px/.test(css) && /\.gl-c\{[^}]*min-height:44px/.test(css) && /\.gl-v\{width:44px;height:44px/.test(css) && /\.gl-b\{min-height:48px/.test(css) && /\.gl-ba button\{height:44px/.test(css) && /\.gl-z input\{[^}]*height:44px/.test(css) && /#gl-terug button\{height:44px/.test(css), 'knoppen, chips, vinkje (44 px aanraakgebied), zoekveld en actieknoppen zijn minstens 44 px');
  T.check(/body\.gl \.frame>\.top,body\.gl \.frame>\.sub[^{]*\{display:none!important/.test(css) && /body\.gl \.body>\*:not\(\.gl-host\)/.test(css), 'de tabel (desktoplijst) is op gsm verborgen; er staat geen tabel op het scherm');
  T.check(/body\.gl \.mbg\{padding:0/.test(css) && /body\.gl \.mbox\{[^}]*height:100%/.test(css) && /\.kn-box,body\.gl \.tkz-box/.test(css), 'dialogen zijn op gsm een scherm van volle hoogte');
  T.check(/\.gl-cw\.meer:after\{content:"›"/.test(css), 'chips tonen een pijltje als er meer is');
  T.check(/body\.gl\.gl-detail \.gl-host\{display:block!important;position:fixed/.test(css) && js.includes('data-gl="terug"') && js.includes('popstate'), 'tik opent het detail als volgend scherm met ‹ terug (ook met de terugknop van de telefoon)');

  T.info('Kaarten uit echte rijen');
  const KM = require(T.ROOT + '/public/kampmomenten.js');
  const ov = (await A('GET', '/api/kampmomenten-overzicht')).json;
  const rijen = KM.lijstHtml(ov, { filter: 'periode', zoek: '', sel: new Set(), open: null }).match(/<div class="r[ "][\s\S]*?<\/div>(?=<div class="r[ "]|$)/g) || [];
  T.check(rijen.length === ov.kampmomenten.length && rijen.length >= 1, `kampmomenten: ${rijen.length} echte rijen uit /api/kampmomenten-overzicht`);
  const km = ov.kampmomenten[0], kaart0 = GL.maakKaart(GL.PAGINA['/kampmomenten'], rijen[0]);
  T.check(kaart0.titel === km.locatie.naam && kaart0.regels[0] === km.dagen_tekst && kaart0.heeftVinkje && String(kaart0.id) === String(km.id), `kampmomenten: kaart = locatie, dagen, KV · thema en status (${kaart0.titel} / ${kaart0.regels.join(' / ')})`);
  T.check(kaart0.regels[1] && /KV|Geen KV/.test(kaart0.regels[1]) && kaart0.pills.length >= 1, 'kampmomenten: tweede regel "KV … · thema" en een pil voor de status');
  const FIX = {
    taken: '<div class="r " data-id="196"><span><input type="checkbox" data-sel="196" aria-label="Selecteer taak #196"></span><span><b>#196</b> levering</span><span>ma 2 nov</span><span>Rozenweg → Abdijschool Vlierbeek</span><span>Ballen ×6</span><span>— zonder rit</span><span><span class="pil">gepland</span></span></div>',
    bakken: '<div class="r " data-k="b12146"><span><input type="checkbox" data-sel="b12146" aria-label="Selecteer B09"></span><span><b>B09</b> Themabak 1/4 (LS bak)</span><span>Ambachtenacademie</span><span>Rozenweg · rek B</span><span>35 soorten · 173 stuks</span><span>niet geteld</span><span><span class="pil groen">ok</span></span></div>',
    personeel: '<div class="r " data-id="2"><span><input type="checkbox" data-sel="2" aria-label="Selecteer Jeroen"></span><span><b>Jeroen</b></span><span>chauffeur</span><span>0470 12 34 56</span><span>—</span><span><span class="pil oranje">geen pincode</span></span></div>',
    logboek: '<div class="r " data-id="a283"><span>za 31 okt 17:27</span><span>Jeroen</span><span>laadde 14 bakken</span><span>transport_ritten</span><span>rit #41</span></div>',
    themas: '<div class="r " data-id="4160"><span><input type="checkbox" data-sel="4160" aria-label="Selecteer"></span><span style="display:flex"><i class="kleur"></i><b>1001 ballen (themadag)</b></span><span>themadag · kleuters</span><span class="k">3 bakken</span><span>—</span><span><span class="pil groen">ok</span></span></div>',
    pool: '<div class="r " data-key="vast:12418"><span><input type="checkbox" data-sel="vast:12418" aria-label="Selecteer"></span><span><b>Administratiekastje</b></span><span><b>1</b></span><span class="k">Rozenweg 1</span><span>—</span><span><span class="pil groen">ok</span></span></div>',
    catalogus: '<div class="r " data-id="3881"><span><input type="checkbox" data-sel="3881" aria-label="Selecteer"></span><span><b>Brieven in kleur</b></span><span>stuk</span><span>1 bak</span><span class="get">12</span><span class="get">—</span><span><span class="pil groen">ok</span></span></div>',
    locaties: '<div class="r " data-id="29"><span><input type="checkbox" data-sel="29" aria-label="Selecteer"></span><span><b>Abdijschool Vlierbeek</b></span><span>kamp</span><span>Kessel-Lo</span><span>wk 1 Test KV Abdijschool</span><span><span class="pil oranje" title="geen contact">⚠ let op</span></span></div>'
  };
  const verwacht = { taken: ['#196 levering · ma 2 nov', 'zonder rit'], bakken: ['B09 Themabak 1/4 (LS bak)', 'niet geteld'], personeel: ['Jeroen', 'geen pincode'], logboek: ['Jeroen: laadde 14 bakken', null], themas: ['1001 ballen (themadag)', 'ok'], pool: ['Administratiekastje', 'ok'], catalogus: ['Brieven in kleur', 'ok'], locaties: ['Abdijschool Vlierbeek', '⚠ let op'] };
  for (const [p, [titel, pil]] of Object.entries(verwacht)) {
    const k = GL.maakKaart(GL.PAGINA['/' + p], FIX[p]), h = GL.kaartHtml(k, false);
    T.check(k.titel === titel && (pil === null ? !k.pills.length : k.pills.some((x) => x.t === pil)) && !/<table|<tr[ >]/.test(h) && h.includes('data-gl="open"'), `${p}: kaart "${k.titel}" · ${k.regels.join(' / ') || '–'}${pil ? ' · pil ' + pil : ''} (geen tabel)`);
  }
  const tk = GL.maakKaart(GL.PAGINA['/taken'], FIX.taken);
  T.check(tk.pills[0].k === 'or' && tk.regels[0] === 'Rozenweg → Abdijschool Vlierbeek' && tk.regels[1] === 'Ballen ×6', 'taken: oranje pil "zonder rit", route en inhoud op de kaart (zoals de mockup)');
  const lg = GL.maakKaart(GL.PAGINA['/logboek'], FIX.logboek);
  T.check(!lg.heeftVinkje && lg.klein && !GL.kopHtml(GL.PAGINA['/logboek']).includes('data-gl="nieuw"') && GL.kopHtml(GL.PAGINA['/logboek']).includes('data-gl="export"') && !GL.kaartHtml(lg, false).includes('gl-v'), 'logboek: geen vinkje en geen "+", wel ⬇ (zoals de mockup)');
  T.check(GL.kopHtml(GL.PAGINA['/taken']).includes('data-gl="export"') && GL.kopHtml(GL.PAGINA['/taken']).includes('data-gl="nieuw"'), 'kop met titel, ⬇ Export en + Nieuw op de andere pagina’s');
  const kh = GL.kaartHtml(kaart0, true);
  T.check(/role="checkbox" aria-checked="true"/.test(kh) && kh.includes('gl-v x') && kh.includes('data-gl="vink"'), 'vinkje is een eigen knop (aanraakgebied 44 px) en toont de gekozen staat');
  T.check(GL.chipsHtml([{ key: 'a', label: 'Alles 5', act: true }, { key: 'b', label: 'Zonder KV 1', act: false }]).includes('aria-pressed="true"') && GL.balkHtml(2, 'x').includes('2 gekozen') && GL.balkHtml(2, 'x').includes('data-gl="acties"') && GL.balkHtml(0, 'x') === '', 'chips en balk "n gekozen · Acties" (alleen bij een selectie)');

  T.info('Bulkacties bereikbaar');
  const BULK = { kampmomenten: 4, taken: 4, bakken: 4, personeel: 3, themas: 3, pool: 3, catalogus: 3, locaties: 3 };
  for (const [p, n] of Object.entries(BULK)) {
    const h = lees(`public/${p}.html`), b = [...(/<span class="bulk">([\s\S]*?)<\/span><\/div>/.exec(h) || [, ''])[1].matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((x) => ({ label: x[1] }));
    const ac = GL.acti(b), sh = GL.sheetHtml(2, GL.PAGINA['/' + p], ac);
    const gevaar = ac.filter((a) => a.gevaar).map((a) => a.label);
    T.check(b.length === n && (sh.match(/data-gl="actie"/g) || []).length === n && gevaar.length === 1 && sh.includes('class="gl-b r"') && /…<\/button>/.test(sh), `${p}: alle ${n} bulkacties staan als grote knop in het scherm Acties; gevaarlijk in rood met "…" (${gevaar[0]})`);
    const bron = lees(`public/${p}.js`), at = bron.search(/b-(weg|deact)'\)\.onclick/);
    T.check(at > 0 && /vraag\(|verwijder-voorbeeld|wegHalen/.test(bron.slice(at, at + 700)), `${p}: de gevaarlijke actie vraagt zelf om bevestiging (het scherm stuurt de tik door)`);
  }
  T.check(!lees('public/logboek.html').includes('class="bulk"'), 'logboek heeft geen bulkacties (alleen lezen en terugdraaien in het detail)');

  T.info('Doorgeven aan de pagina (zelfde API, selectie, live)');
  T.check(js.includes("doc.querySelectorAll('.bulk button')") && js.includes("'#lijst > .r'") && js.includes('input[data-sel]') && js.includes("zetVeld(bron, z.value, 'input')"), 'elke tik gaat naar het bestaande element van de pagina: bulkknop, rij, vinkje, zoekveld, chip');
  T.check(js.includes('MutationObserver') && js.includes("'sporty-live'") && js.includes('lst.scrollTop = y') && js.includes('doc.activeElement !== zo'), 'live (RT1): bij een wijziging worden de kaarten vervangen met behoud van scrollpositie, selectie (uit de pagina) en het zoekveld');
  for (const p of PAG) T.check(/id="lijst"/.test(lees(`public/${p}.html`)) && /id="detail"/.test(lees(`public/${p}.html`)) && (p === 'logboek' || (/id="export"/.test(lees(`public/${p}.html`)) && /id="nieuw"/.test(lees(`public/${p}.html`)))), `${p}: de pagina heeft lijst, detail${p === 'logboek' ? '' : ', Export en + Nieuw'} waar het patroon op leunt`);
} finally {
  await T.einde(srv);
}
