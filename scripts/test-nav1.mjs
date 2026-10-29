// test-nav1.mjs — NAV1 (chat D): één bovenbalk/subbalk-tabel (public/nav.js) voor alle nieuwe schermen; oude tabs tonen een vervangstrook.
// Eigen server via _testhulp (poort 3348, herfst-test.db). De tekening zelf (DOM) wordt als module met dezelfde tabel gecontroleerd; de browsercontrole staat in het verslag.
import * as T from './_testhulp.mjs';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const srv = await T.startServer({ poort: parseInt(process.env.TEST_POORT || '3348') });
const BASIC = 'Basic ' + Buffer.from('sporty:' + T.APP_PASSWORD).toString('base64');
try {
  const tok = await T.login(srv.base);
  const NAV = require(T.ROOT + '/public/nav.js');
  const HREFS = ['/vandaag', '/kampmomenten', '/ritplanning', '/bakken', '/locaties', '/nakijken', '/personeel'];
  const NAMEN = ['Vandaag', 'Planning', 'Transport', 'Materiaal', 'Locaties', 'Voorraad & controles', 'Beheer'];
  T.check(NAV.BOVEN.map((o) => o.href).join() === HREFS.join() && NAV.BOVEN.map((o) => o.naam).join() === NAMEN.join(), 'mapping bovenbalk: Vandaag /vandaag · Planning /kampmomenten · Transport /ritplanning · Materiaal /bakken · Locaties /#locaties · Voorraad & controles /nakijken · Beheer /personeel');
  const SUBS = {
    planning: ['/kampmomenten', '/#kampplanner', '/#periodes', '/#themas'], transport: ['/#transport', '/ritplanning', '/taken', '/#voertuigen'],
    materiaal: ['/#themas', '/bakken', '/#pool', '/#catalogus'], voorraad: ['/nakijken', '/#tekorten', '/#tekorten', '/#voorraad'], beheer: ['/personeel', '/logboek', '/#beheer', '/#beheer']
  };
  T.check(Object.entries(SUBS).every(([k, v]) => NAV.SUB[k].map((s) => s[1]).join() === v.join()), 'mapping subbalken (planning, transport, materiaal, voorraad, beheer) exact volgens de prompt');
  const PAGINAS = { '/vandaag': ['vandaag', 'vandaag.js'], '/kampmomenten': ['planning', 'kampmomenten.js'], '/ritplanning': ['transport', 'ritplanning.js'], '/taken': ['transport', 'taken.js'], '/bakken': ['materiaal', 'bakken.js'], '/nakijken': ['voorraad', 'nakijken.js'], '/personeel': ['beheer', 'personeel.js'], '/logboek': ['beheer', 'logboek.js'] };
  for (const [pad, [onderdeel, js]] of Object.entries(PAGINAS)) {
    const r = await fetch(srv.base + pad, { headers: { Authorization: BASIC } });
    const html = await r.text();
    T.check(r.status === 200 && html.indexOf('/public/nav.js') > -1 && html.indexOf('/public/nav.js') < html.indexOf('/public/' + js) && /class="top"/.test(html) && !/<div class="top">(?:(?!<div class="rechts">)[\s\S])*<a /.test(html), `${pad} → 200, laadt nav.js vóór ${js} en bevat geen eigen bovenbalk-links meer`);
    const boven = NAV.boven(NAV.PAGINA[pad]);
    T.check(HREFS.every((h) => boven.includes('href="' + h + '"')) && (boven.match(/class="act"/g) || []).length === 1 && boven.includes(`class="act" href="${NAV.BOVEN.find((o) => o.id === onderdeel).href}"`), `${pad}: bovenbalk met de 7 links, enkel "${onderdeel}" actief`);
    if (SUBS[onderdeel]) {
      const sb = NAV.sub(onderdeel, pad), n = (sb.match(/<a /g) || []).length;
      T.check(n === 4 && SUBS[onderdeel].every((h) => sb.includes('href="' + h + '"')) && sb.includes(`class="act" href="${pad}"`) && /class="sub"/.test(html), `${pad}: subbalk (4 links, "${pad}" actief)`);
    } else T.check(!/class="sub"/.test(html) && NAV.sub('vandaag', pad) === '', `${pad}: Vandaag heeft geen subbalk`);
  }
  // index.html: vervangstrook en bereikbaarheid van de oude tabs
  const ix = fs.readFileSync(T.ROOT + '/index.html', 'utf8');
  T.check(/id="vervang-strook"/.test(ix) && /function toonVervangstrook/.test(ix) && /Dit scherm is vervangen door/.test(ix), 'index.html heeft de vervangstrook');
  const map = [['transport-plan', '/ritplanning'], ['transport-noden', '/taken'], ['transporten', '/ritplanning'], ['kampplanner', '/kampmomenten'], ['personeel', '/personeel'], ['overzicht', '/vandaag']];
  T.check(map.every(([, h]) => ix.includes("'" + h + "'")) && /ms==='themabakken'.*links=\[\['Bakken','\/bakken'\]\]/.test(ix) && /ms==='nakijken'\)links=\[\['Voorraad & controles › Nakijken','\/nakijken'\]\]/.test(ix), 'de strook wijst: transport → Ritplanning/Taken, planning → Kampmomenten, bakken → Bakken, personeel → Personeel/Logboek, nakijken → Nakijken, overzicht → Vandaag');
  T.check(/toonVervangstrook\(id\);/.test(ix) && /matSubtab=tab;toonVervangstrook\(null,tab\);/.test(ix), 'goTo en setMatSubtab tekenen de strook');
  const SECS = (/const SECS=\[([^\]]*)\]/.exec(ix)[1]).replace(/'/g, '').split(',');
  const alias = /const ALIAS=\{([^}]*)\}/.exec(ix)[1];
  const doelen = [...alias.matchAll(/(\w+):\['([\w-]+)'(?:,'(\w+)')?\]/g)].map((m) => ({ naam: m[1], sec: m[2], sub: m[3] }));
  const subtabs = ['themabakken', 'vastebakken', 'gedeeld', 'voorraad', 'sport', 'themas', 'catalogus', 'standaard', 'voertuigen', 'nakijken'];
  T.check(doelen.length >= 10 && doelen.every((d) => SECS.includes(d.sec) && (!d.sub || d.sec !== 'materiaal' || subtabs.includes(d.sub))), `de /#-links van de balken (${doelen.map((d) => d.naam).join(', ')}) wijzen naar bestaande tabs en subtabs van de oude app`);
  const gebruikt = new Set([...NAV.BOVEN.map((o) => o.href), ...Object.values(NAV.SUB).flat().map((s) => s[1])].filter((h) => h.startsWith('/#')).map((h) => h.slice(2)));
  T.check([...gebruikt].every((h) => SECS.includes(h) || doelen.some((d) => d.naam === h)), `elke /#-link in nav.js (${[...gebruikt].join(', ')}) is een oude tab of heeft een alias`);
  T.check(/locaties:\['planning'\]/.test(alias), '/#locaties blijft bereikbaar (oude tab Locaties = planning)');
  T.check(/id="nb-vandaag"/.test(ix) && /location\.href='\/vandaag'/.test(ix), 'de knop Vandaag staat in de oude app');
  // rollen: niet-kantoor blijft buiten de Vandaag-API
  const nieuw = await T.api(srv.base, tok, 'POST', '/api/personeel', { naam: 'Nav1 Chauffeur', rol: 'chauffeur' });
  await T.api(srv.base, tok, 'POST', `/api/personeel/${nieuw.json.id}/pincode`, { pincode: '7777' });
  const lg = await T.api(srv.base, null, 'POST', '/api/login', { persoon_id: nieuw.json.id, pincode: '7777' });
  T.check((await T.api(srv.base, lg.json.token, 'GET', '/api/vandaag')).status === 403 && (await T.api(srv.base, tok, 'GET', '/api/vandaag')).status === 200, 'niet-kantoor krijgt 403 op /api/vandaag, kantoor 200 (zoals nu)');
} catch (e) {
  T.fout('test crashte: ' + (e.stack || e));
}
await T.einde(srv);
