// test-vt1-voertuigen.mjs — VT1 (chat D): Transport › Voertuigen: per echt voertuig, weekbezetting, dubbele boeking.
// Twee eigen servers via _testhulp (poort 3353: migratie op een db met oude ritten; poort 3354: de rest). HTML-bouwers als module, geen headless browser.
import * as T from './_testhulp.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const lees = (p) => fs.readFileSync(T.ROOT + '/' + p, 'utf8');
const plus = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const MA = '2027-03-01'; // een maandag
try {
  // ═══ Migratie: voertuigen uit voertuig_types, ritten met een type-naam krijgen voertuig_id ═══
  const initSql = require('sql.js');
  const SQL = await initSql();
  const bron = new SQL.Database(fs.readFileSync(T.IJK_DB));
  bron.run("INSERT INTO transport_ritten (datum,chauffeur,status,voertuig) VALUES ('2027-03-02','Oud','gepland','Camion')");
  bron.run("INSERT INTO transport_ritten (datum,chauffeur,status,voertuig) VALUES ('2027-03-03','Oud','gepland','Rare wagen')");
  const tmp = path.join(T.ROOT, '..', 'sporty-d-vt1-bron.db');
  fs.writeFileSync(tmp, Buffer.from(bron.export()));
  const s0 = await T.startServer({ poort: 3353, dbBron: tmp });
  const tok0 = await T.login(s0.base);
  const p0 = (await T.api(s0.base, tok0, 'GET', `/api/ritplanning?week=${MA}`)).json;
  await new Promise((r) => setTimeout(r, 600)); const v0 = await T.leesDb(s0.dbPad, 'SELECT * FROM voertuigen'); // TF7: Camion 1 en Camionette 1 blijven bestaan, mogelijk inactief (migratie 92)
  const camion = v0.find((v) => v.naam === 'Camion 1'), camionette = v0.find((v) => v.naam === 'Camionette 1');
  T.check(camion && camion.plaatsen === 40 && camionette && camionette.plaatsen === 20, `migratie: uit voertuig_types ontstaan ${v0.map((v) => v.naam).join(', ')}`);
  const ritten0 = p0.dagen.flatMap((d) => d.ritten);
  const oud1 = ritten0.find((r) => r.voertuig.naam === 'Camion'), oud2 = ritten0.find((r) => r.voertuig.naam === 'Rare wagen');
  T.check(oud1 && oud1.voertuig.id === camion.id, 'bestaande rit met "Camion" kreeg voertuig_id van Camion 1');
  T.check(oud2 && oud2.voertuig.id === null, 'rit met een vrije naam houdt zijn tekst en blijft zonder voertuig_id');
  T.check((await T.api(s0.base, tok0, 'GET', '/api/voertuig-types')).json.length >= 2, 'voertuig_types blijft bestaan');
  await s0.stop();

  // ═══ Hoofdserver ═══
  const srv = await T.startServer({ poort: 3354 });
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const P = (m, p, b) => T.api(srv.base, null, m, p, b);
  T.check(new Date(MA + 'T12:00:00').getDay() === 1, 'testweek begint op een maandag');

  // pagina en rechten
  T.check((await P('GET', '/voertuigen')).status === 200, 'GET /voertuigen → 200');
  for (const pad of ['/api/voertuigen-overzicht', '/api/voertuigen/1/detail']) { const r = await P('GET', pad); T.check(r.status === 401 || r.status === 403, `${pad} zonder login → ${r.status}`); }
  const NAV = require(T.ROOT + '/public/nav.js');
  const sb = NAV.sub('transport', '/voertuigen');
  T.check(NAV.SUB.transport.map((s) => s[1]).join() === '/ritplanning,/taken,/voertuigen' && /class="act" href="\/voertuigen"/.test(sb) && NAV.PAGINA['/voertuigen'] === 'transport' && !sb.includes('/#transport'), 'nav.js: Transport-subbalk Ritplanning · Taken · Voertuigen, "Ritten /#transport" eruit, actieve knop volgt de URL');
  const html = lees('public/voertuigen.html');
  T.check(html.includes('/public/patroon.css') && html.indexOf('/public/nav.js') > -1 && html.indexOf('/public/nav.js') < html.indexOf('/public/voertuigen.js'), 'voertuigen.html laadt patroon.css en nav.js vóór het eigen script');

  // voertuigen van de ritplanning
  const plan = (week = MA) => A('GET', `/api/ritplanning?week=${week}`);
  // TF7: de voorbeeldvoertuigen zijn door migratie 92 inactief; deze test bouwt ze zelf opnieuw op.
  await A('POST', '/api/voertuigen', { naam: 'Camionette 1', plaatsen: 20, trekhaak: true }); await A('POST', '/api/voertuigen', { naam: 'Camion 1', plaatsen: 40 });
  let pl = (await plan()).json;
  const vt = (n) => pl.voertuigen.find((v) => v.naam === n);
  const cn = vt('Camionette 1'), cm = vt('Camion 1');
  // nieuwe voertuigen
  const huur = (await A('POST', '/api/voertuigen', { naam: 'Huurwagen Hertz', soort: 'huur', plaatsen: 15, huur_van: plus(MA, 8), huur_tot: plus(MA, 10), nummerplaat: '' })).json;
  const prive = (await A('POST', '/api/voertuigen', { naam: 'Eigen wagen Evy', soort: 'prive', plaatsen: 4, notitie: 'kilometervergoeding' })).json;
  T.check(huur.ok && prive.ok, 'POST /api/voertuigen: huurwagen en privé wagen aangemaakt');
  T.check((await A('POST', '/api/voertuigen', { naam: ' ' })).status === 400 && (await A('POST', '/api/voertuigen', { naam: 'X', soort: 'raket' })).status === 400 && (await A('POST', '/api/voertuigen', { naam: 'X', huur_van: '2027-03-10', huur_tot: '2027-03-01' })).status === 400, 'validatie: lege naam, onbekende soort en huur_tot vóór huur_van → 400');
  pl = (await plan()).json;
  const volgorde = pl.voertuigen.map((v) => v.soort);
  T.check(volgorde.indexOf('huur') > volgorde.lastIndexOf('eigen') && volgorde.indexOf('prive') > volgorde.lastIndexOf('huur'), `ritplanning voertuigen[]: eigen, dan huur, dan privé (${volgorde.join(', ')})`);
  T.check(pl.voertuigen.every((v) => v.id && 'plaatsen' in v && 'bezet_op_dag' in v), 'voertuigen[] heeft id, naam, soort, plaatsen en bezet_op_dag');

  // ritten met voertuig_id
  const di = plus(MA, 1), wo = plus(MA, 2), do_ = plus(MA, 3);
  const maakRit = async (datum, vertrek, pid, voertuig_id) => (await A('POST', '/api/ritten', { datum, vertrek, personeel_id: pid, voertuig_id })).json;
  const rA = await maakRit(di, '13:00', 2, cn.id), rB = await maakRit(di, '13:00', 3, cn.id), rC = await maakRit(di, '18:00', 13, cn.id);
  pl = (await plan()).json;
  const rit = (id) => pl.dagen.flatMap((d) => d.ritten).find((r) => r.id === id);
  T.check(rit(rA.id).voertuig.naam === 'Camionette 1' && rit(rA.id).voertuig.capaciteit === 20 && rit(rA.id).voertuig.soort === 'pool' && rit(rA.id).voertuig.id === cn.id, 'POST /api/ritten {voertuig_id} vult naam, soort (pool) en capaciteit (20)');
  const dubbelTekst = (r) => r.waarschuwingen.filter((w) => /^voertuig dubbel/.test(w));
  T.check(dubbelTekst(rit(rA.id)).some((w) => w.includes(`rit #${rB.id}`)) && dubbelTekst(rit(rB.id)).some((w) => w.includes(`rit #${rA.id}`)), `overlappende ritten: “${dubbelTekst(rit(rA.id))[0]}” bij beide`);
  T.check(dubbelTekst(rit(rC.id)).length === 0, 'rit zonder overlap (18:00) krijgt geen "voertuig dubbel"');
  // onderhoud
  const ond = (await A('POST', `/api/voertuigen/${cn.id}/onderhoud`, { datum_van: do_, datum_tot: do_, reden: 'jaarlijkse keuring' })).json;
  const rD = await maakRit(do_, '09:00', 2, cn.id);
  pl = (await plan()).json;
  T.check(ond.ok && rit(rD.id).waarschuwingen.includes('voertuig in onderhoud'), 'rit op een onderhoudsdag → "voertuig in onderhoud"');
  T.check((await A('POST', `/api/voertuigen/${cn.id}/onderhoud`, { datum_van: do_, datum_tot: di })).status === 400, 'onderhoud met einde vóór begin → 400');
  // huurwagen
  const rH1 = await maakRit(plus(MA, 8 + 1), '10:00', 2, huur.id), rH2 = await maakRit(plus(MA, 8 + 4), '10:00', 2, huur.id);
  const pl2 = (await plan(plus(MA, 7))).json, rit2 = (id) => pl2.dagen.flatMap((d) => d.ritten).find((r) => r.id === id);
  T.check(!rit2(rH1.id).waarschuwingen.includes('huurwagen niet beschikbaar') && rit2(rH2.id).waarschuwingen.includes('huurwagen niet beschikbaar'), 'huurwagen: binnen de huurperiode geen waarschuwing, erbuiten "huurwagen niet beschikbaar"');
  // PUT rit met ander voertuig (de oude naam mag niet terugkomen)
  const put = await A('PUT', `/api/ritten/${rC.id}`, { voertuig_id: cm.id });
  pl = (await plan()).json;
  T.check(put.status === 200 && rit(rC.id).voertuig.naam === 'Camion 1' && rit(rC.id).voertuig.capaciteit === 40 && rit(rC.id).voertuig.id === cm.id, 'PUT /api/ritten {voertuig_id}: naam en capaciteit volgen het nieuwe voertuig');
  const put2 = await A('PUT', `/api/ritten/${rC.id}`, { voertuig: 'Rare wagen' });
  pl = (await plan()).json;
  T.check(put2.status === 200 && rit(rC.id).voertuig.naam === 'Rare wagen' && rit(rC.id).voertuig.id === null, 'PUT met een vrije voertuignaam: voertuig_id wordt leeg, de tekst blijft');
  T.check((await A('POST', '/api/ritten', { datum: di, voertuig_id: 999999 })).status === 400, 'onbekend voertuig_id → 400');
  // bezet_op_dag
  const cn2 = pl.voertuigen.find((v) => v.id === cn.id);
  T.check((cn2.bezet_op_dag[di] || []).length === 2 && (cn2.bezet_op_dag[di] || []).every((x) => x.rit_id && x.vertrek), 'ritplanning: bezet_op_dag toont de twee ritten van Camionette 1 op dinsdag');
  const optie = lees('public/ritplanning.js');
  T.check(/optgroup/.test(optie) && /ook op rit #/.test(optie) && /Ander voertuig…/.test(optie) && /voertuig_id/.test(optie), 'public/ritplanning.js: keuzelijst per groep, "(ook op rit #n)" en "Ander voertuig…"');

  // overzicht
  let r = await A('GET', `/api/voertuigen-overzicht?week=${MA}`);
  const O = r.json, ov = (naam) => O.voertuigen.find((v) => v.naam === naam);
  T.check(r.status === 200 && O.week.start === MA && O.week.dagen.length === 7 && O.week.dagen[5].weekend && O.week.dagen[6].weekend && !O.week.dagen[0].weekend, 'overzicht: week ma–zo, za en zo zijn weekend');
  const wk = ov('Camionette 1').week;
  T.check(wk.length === 7 && wk[1].status === 'dubbel' && wk[1].ritten.length === 2 && wk[3].status === 'onderhoud' && wk[0].status === 'vrij' && wk[2].status === 'vrij', `weekstrook Camionette 1: di ${wk[1].status} (2 ritten), do ${wk[3].status}, ma/wo ${wk[0].status}/${wk[2].status}`);
  T.check(ov('Camionette 1').status === 'dubbel' && ov('Camionette 1').aandacht.includes('dubbel di') && ov('Camionette 1').aandacht.includes('onderhoud do'), `status dubbel met aandacht ${ov('Camionette 1').aandacht.join(', ')}`);
  T.check(ov('Camion 1').status === 'ok' && ov('Camion 1').week.every((d) => d.status === 'vrij' || d.status === 'rit'), 'Camion 1 zonder problemen → ok');
  T.check(O.tellers.alle === O.voertuigen.length && O.tellers.eigen === 2 && O.tellers.huur === 1 && O.tellers.prive === 1 && O.tellers.dubbel === 1 && O.tellers.onderhoud === 1, `tellers ${JSON.stringify(O.tellers)}`);
  const sub = ov('Huurwagen Hertz').sub;
  T.check(/^gehuurd /.test(sub) && ov('Eigen wagen Evy').sub.startsWith('privé · kilometervergoeding'), `sub-regels: “${sub}” en “${ov('Eigen wagen Evy').sub}”`);
  const O2 = (await A('GET', `/api/voertuigen-overzicht?week=${plus(MA, 7)}`)).json;
  const h2 = O2.voertuigen.find((v) => v.naam === 'Huurwagen Hertz');
  T.check(h2.week[2].status === 'rit' && h2.week[5].status === 'rit' && h2.week[0].status === 'vrij', 'weekstrook huurwagen volgende week: rit op wo en za');

  // detail
  r = await A('GET', `/api/voertuigen/${cn.id}/detail?week=${MA}`);
  const DT = r.json;
  const dub = (DT.let_op || []).find((l) => l.soort === 'dubbel');
  T.check(r.status === 200 && DT.week.dagen.length === 7 && dub && dub.knop === 'Oplossen' && /Dubbel geboekt di/.test(dub.tekst) && dub.sub.includes(`rit #${rA.id}`) && dub.sub.includes(`rit #${rB.id}`), `detail: blok Let op met “${dub && dub.tekst}”`);
  T.check(DT.onderhoud.length === 1 && DT.onderhoud[0].reden === 'jaarlijkse keuring' && DT.voertuig.plaatsen === 20, 'detail: onderhoud en gegevens');
  T.check(DT.historiek.some((h) => /onderhoud .* gepland/.test(h.wat)), 'historiek toont de onderhoudsperiode');
  T.check((await A('GET', '/api/voertuigen/999999/detail')).status === 404, 'onbekend voertuig → 404');
  // bewerken: naam volgt op de ritten
  r = await A('PUT', `/api/voertuigen/${cn.id}`, { naam: 'Camionette 1b', plaatsen: 22, nummerplaat: '1-ABC-123', sleutel_info: 'haak 1', keuring_tot: '2027-03-14' });
  pl = (await plan()).json;
  T.check(r.status === 200 && rit(rA.id).voertuig.naam === 'Camionette 1b' && rit(rA.id).voertuig.capaciteit === 22, 'voertuig hernoemen/plaatsen wijzigen: de ritten volgen (oude velden blijven kloppen)');
  const DT2 = (await A('GET', `/api/voertuigen/${cn.id}/detail?week=${MA}`)).json;
  T.check(DT2.historiek.some((h) => /naam: Camionette 1 → Camionette 1b/.test(h.wat)) && DT2.voertuig.keuring_tot === '2027-03-14' && DT2.voertuig.nummerplaat === '1-ABC-123', 'bewerken is gelogd in de historiek');
  // onderhoud verwijderen
  r = await A('DELETE', `/api/voertuigen/${cn.id}/onderhoud/${ond.id}`);
  T.check(r.status === 200 && (await A('GET', `/api/voertuigen/${cn.id}/detail?week=${MA}`)).json.onderhoud.length === 0 && (await A('DELETE', `/api/voertuigen/${cn.id}/onderhoud/${ond.id}`)).status === 404, 'onderhoud verwijderen (en daarna 404)');
  // verwijderen
  r = await A('DELETE', `/api/voertuigen/${cn.id}`);
  T.check(r.status === 409 && /komende rit/.test(r.json.error), `verwijderen met toekomstige ritten → 409 (“${(r.json.error || '').slice(0, 60)}…”)`);
  r = await A('DELETE', `/api/voertuigen/${prive.id}`);
  const O3 = (await A('GET', `/api/voertuigen-overzicht?week=${MA}`)).json;
  T.check(r.status === 200 && !O3.voertuigen.some((v) => v.id === prive.id) && O3.tellers.prive === 0, 'verwijderen zonder ritten → actief=0, weg uit het overzicht');

  // DOM-bouw met echte data
  const VT = require(T.ROOT + '/public/voertuigen.js');
  const lh = O.voertuigen.map((v) => VT.rij(v)).join('');
  T.check((lh.match(/class="wk"/g) || []).length === O.voertuigen.length && (lh.match(/<i class="/g) || []).length === O.voertuigen.length * 7, 'DOM: elke rij heeft een weekstrook van 7 vakjes');
  const rijCn = VT.rij(ov('Camionette 1'));
  T.check(/<i class="x" title="di">/.test(rijCn) && /<i class="o" title="do">/.test(rijCn) && rijCn.includes('⚠ dubbel di') && rijCn.includes('class="get"'), 'DOM: dubbel (rood) op di, onderhoud (oranje) op do, “⚠ dubbel di” en rechts uitgelijnde plaatsen');
  T.check(VT.rij(ov('Camion 1')).includes('<span class="pil groen">ok</span>') && VT.rij(ov('Camion 1')).includes('eigen'), 'DOM: ok-pil en soort');
  const dh = VT.detail(DT, 'planning');
  T.check(dh.includes('Deze week') && dh.includes('Let op') && dh.includes('Oplossen') && dh.includes(`data-rit="${rA.id}"`) && dh.includes('Gegevens') && dh.includes('Bewerken') && dh.includes('Onderhoud plannen') && dh.includes('Naar ritplanning') && /<span class="x">13:00–13:00 · rit #\d+/.test(dh), 'DOM detail: Deze week met rode ritblokken, Let op met Oplossen, Gegevens en de drie knoppen');
  T.check(VT.detail(DT2, 'gegevens').includes('+ periode') && VT.detail(DT2, 'historiek').includes('Historiek (alles gelogd)'), 'DOM: tabs Gegevens (Onderhoud) en Historiek');
  const fl = lees('public/voertuigen.html');
  for (const c of ['alle', 'eigen', 'huur', 'prive', 'dubbel', 'onderhoud']) T.check(fl.includes(`data-f="${c}"`), `voertuigen.html: chip ${c}`);
  T.check(fl.includes('legende') && fl.includes('id="kop-week"') && fl.includes('+ Voertuig') && fl.includes('⬇ Export') && fl.includes('data-week="-1"') && fl.includes('data-week="1"'), 'voertuigen.html: legenda, weekkop m–z, + Voertuig, Export, weekkeuze ‹ ›');

  // gsm
  const css = lees('public/voertuigen.css');
  T.check(/@media \(max-width:767px\)/.test(css) && /toon-detail/.test(css) && /min-height:44px/.test(css) && /overflow-x:auto/.test(css) && /wkcel/.test(css) && lees('public/voertuigen.js').includes('data-act="terug"'), 'voertuigen.css/js: gsm-regels (detail als volgend scherm met ‹ terug, knoppen ≥ 44 px, weekstrook zichtbaar)');

  // vervangstroken
  const ix = lees('index.html');
  T.check(/Ritten staan nu in de Ritplanning/.test(ix) && /Voertuigen staan nu in Transport › Voertuigen/.test(ix) && /ms==='voertuigen'[^;]*\/voertuigen/.test(ix), 'index.html: vervangstrook voor de oude tabs Transporten en Voertuigen');
  await srv.stop();
  try { fs.unlinkSync(tmp); } catch (e) { /* tijdelijk bestand */ }
} catch (e) {
  T.fout('test crashte: ' + (e.stack || e));
}
await T.einde(null);
