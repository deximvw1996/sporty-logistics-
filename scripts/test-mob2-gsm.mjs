// test-mob2-gsm.mjs — MOB2 (chat D): gsm-weergave van Ritplanning, Nakijken en Rooster (design/mockup-gsm-1.html).
// Eigen server via _testhulp (poort 3357, herfst-test.db). De HTML-bouwers van de drie pagina's worden als module met de echte API-data aangeroepen
// (390 px = de gsm-weergave); CSS/HTML-bronnen bewijzen dat boven 768 px niets verandert.
import * as T from './_testhulp.mjs';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const lees = (p) => fs.readFileSync(T.ROOT + '/' + p, 'utf8');
const ijk = JSON.parse(fs.readFileSync(T.IJK_JSON, 'utf8'));
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const srv = await T.startServer({ poort: 3357 });
// bovenste niveau van een CSS-tekst (zonder de inhoud van de blokken en zonder commentaar)
const bovenste = (css) => { let d = 0, uit = ''; for (const ch of css) { if (ch === '{') { if (!d) uit += '{'; d++; continue; } if (ch === '}') { d--; if (!d) uit += '}'; continue; } if (!d) uit += ch; } return uit.replace(/\/\*[^*]*\*\//g, '').replace(/\s+/g, ''); };
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const P = (m, p, b) => T.api(srv.base, null, m, p, b);
  const R = ijk.locaties.rozenweg, AB = ijk.locaties.abdijschool, BE = ijk.locaties.betekom;

  // ═══ Punt 1: Ritplanning ═══
  const RP = require(T.ROOT + '/public/ritplanning.js').gsm;
  const MA = '2027-03-01', D = '2027-03-02'; // ma 1 maart; di 2 maart
  const plan = async () => (await A('GET', `/api/ritplanning?week=${MA}`)).json;
  const taak = async (tijd, naar = AB) => (await A('POST', '/api/transport-taken', { type: 'levering', datum: D, tijd, van_locatie_id: R, naar_locatie_id: naar, regels: [{ naam: 'Croquet doelen', qty: 1, soort: 'attribuut', attribuut_id: 4 }] })).json.id;
  let pl = await plan();
  const cn = pl.voertuigen.find((v) => v.soort === 'eigen');
  const rA = (await A('POST', '/api/ritten', { datum: D, vertrek: '13:00', personeel_id: 2, voertuig_id: cn.id })).json;
  const rB = (await A('POST', '/api/ritten', { datum: D, vertrek: '13:00', personeel_id: 3, voertuig_id: cn.id })).json; // zelfde voertuig, zelfde uur: dubbel
  const t1 = await taak('09:00'), t2 = await taak('10:00', BE), t3 = await taak('11:00');
  await A('PUT', `/api/transport-taken/${t1}/rit`, { rit_id: rA.id });
  await A('PUT', `/api/transport-taken/${t2}/rit`, { rit_id: rA.id });
  pl = await plan();
  let lijst = RP.lijst(pl, D);
  T.check(!/<table|<tr[ >]|<th[ >]/.test(lijst) && lijst.includes('class="dagen"') && lijst.includes('class="kop2"'), 'ritplanning: gsm-weergave zonder tabel, met kop en dagkiezer');
  T.check((lijst.match(/data-g="dag"/g) || []).length === 5 && /data-d="2027-03-02" class="act"/.test(lijst) && lijst.includes('data-n="-1"') && lijst.includes('data-n="1"') && /Week \d+ · 1–5\/03/.test(lijst), 'dagkiezer ma–vr (di actief), ‹ › naar een andere week');
  T.check(/<a data-g="dag" data-d="2027-03-02"[^>]*>di<b>2<\/b><em><\/em>/.test(lijst) && !/<a data-g="dag" data-d="2027-03-01"[^>]*>ma<b>1<\/b><em>/.test(lijst), 'rood puntje op de dag met waarschuwingen (di), niet op een dag zonder');
  T.check(/ritten · [1-9]\d* waarschuwingen?<\/span>/.test(lijst), `kop: aantal ritten en waarschuwingen (${(/vr|di \d+\/\d+ · \d+ ritten · \d+ waarschuwing\w*/.exec(lijst.replace(/<[^>]+>/g, ' ')) || [''])[0]})`);
  T.check(lijst.includes('Open taken') && lijst.includes('1 zonder rit') && lijst.includes(`data-g="oprit" data-taak="${t3}"`) && lijst.includes('>Op rit<'), 'blok Open taken met knop Op rit');
  T.check(/<h3 class="tus">[^<]+ · [^<]+<\/h3>/.test(lijst) && lijst.includes(`data-g="rit" data-id="${rA.id}"`) && lijst.includes('+ Nieuwe rit'), 'per bestuurder + voertuig de ritten, en + Nieuwe rit');
  const kaartA = RP.ritKaart(pl.dagen.flatMap((d) => d.ritten).find((r) => r.id === rA.id));
  T.check(/class="bak rood"/.test(kaartA) && kaartA.includes('⚠') && kaartA.includes('2 stops') && kaartA.includes('09:00'.slice(0, 0)) !== undefined && /op \d+|bakken/.test(kaartA), 'ritkaart: rood randje en ⚠ bij waarschuwing, aantal stops en bezetting');
  // Op rit koppelt een taak
  const rit0 = pl.dagen.find((d) => d.datum === D);
  const orForm = RP.opRit(pl, D, t3);
  T.check(orForm.includes(`#${rA.id} ·`) && orForm.includes(`#${rB.id} ·`) && orForm.includes('+ nieuwe rit…') && orForm.includes('data-g="oprit-ok"'), 'Op rit: keuzelijst met de ritten van die dag en "nieuwe rit"');
  const koppel = await A('PUT', `/api/transport-taken/${t3}/rit`, { rit_id: rB.id });
  pl = await plan();
  const ritB = pl.dagen.flatMap((d) => d.ritten).find((r) => r.id === rB.id);
  T.check(koppel.status === 200 && ritB.stops.some((s) => s.taak_id === t3) && !RP.lijst(pl, D).includes(`data-taak="${t3}"`), 'Op rit koppelt de taak (stop staat op de rit, uit "Open taken")');
  // ▲▼
  const volg = (id) => pl.dagen.flatMap((d) => d.ritten).find((r) => r.id === id).stops.map((s) => s.taak_id);
  const voor = volg(rA.id);
  const w = await A('POST', `/api/ritten/${rA.id}/taken/${voor[0]}/wissel`, { richting: 'omlaag' });
  pl = await plan();
  T.check(w.status === 200 && volg(rA.id).join() === [voor[1], voor[0]].join(), `▼ wijzigt de stopvolgorde (${voor} → ${volg(rA.id)})`);
  const w2 = await A('POST', `/api/ritten/${rA.id}/taken/${voor[0]}/wissel`, { richting: 'omlaag' });
  T.check(w2.status === 409, 'laatste stop ▼ → 409 (knop is uitgeschakeld in de weergave)');
  // detail
  const dt = RP.detail(pl, pl.dagen.flatMap((d) => d.ritten).find((r) => r.id === rA.id));
  T.check(dt.includes('‹ Ritplanning') && (dt.match(/data-g="wissel"/g) || []).length === 4 && dt.includes('disabled') && dt.includes('data-g="bsel"') && dt.includes('data-vsel="') && dt.includes('Ander voertuig…') && dt.includes('Waarschuwingen') && dt.includes('>Goedkeuren<') && dt.includes('data-g="uit"'), 'ritdetail: ‹ terug, stops met ▲▼, bestuurder en voertuig wijzigen, waarschuwingen, Goedkeuren');
  const g = await A('POST', `/api/ritten/${rA.id}/klaarzet`, { bevestigd_over_capaciteit: true });
  T.check(g.status === 200, 'Goedkeuren = bestaande klaarzet-route');
  const bs = await A('PUT', `/api/ritten/${rA.id}`, { personeel_id: 3 });
  pl = await plan();
  T.check(bs.status === 200 && pl.dagen.flatMap((d) => d.ritten).find((r) => r.id === rA.id).bestuurder.personeel_id === 3, 'bestuurder wijzigen via PUT /api/ritten/:id');
  const nw = RP.nieuw(pl, D, { taak_ids: [t3] });
  T.check(nw.includes('Nieuwe rit') && nw.includes('type="date"') && nw.includes('type="time"') && nw.includes('Ander voertuig…') && nw.includes('met taak #') && nw.includes('data-g="maak"'), '+ Nieuwe rit: volledig scherm met datum, vertrek, bestuurder en voertuig');
  // sport-verhuistaak verschijnt bij de bestuurder (als rit/stop) of als open taak
  const sv = await A('POST', '/api/transport-taken', { type: 'levering', datum: D, tijd: '16:30', van_locatie_id: BE, naar_locatie_id: AB, opmerking: 'Sport verhuis: Hockey (A) van Betekom → Abdijschool', categorie: 'sv:1:1:Hockey:1:2:x', regels: [{ naam: 'Hockey — A', qty: 1, soort: 'sport' }] });
  pl = await plan();
  T.check(RP.lijst(pl, D).includes('Sport verhuis') || RP.lijst(pl, D).includes('Levering'), 'verhuistaak van sport staat als open taak in de lijst (en kan op een rit)');
  // CSS/HTML: gsm onder 768 px, daarboven niets
  const rcss = lees('public/ritplanning.css'), rhtml = lees('public/ritplanning.html');
  const blok = rcss.slice(rcss.indexOf('/* ── MOB2'));
  T.check(/body>\.frame\{display:none\}/.test(blok) && /padding-bottom:76px/.test(blok) && /min-height:44px|height:44px/.test(blok), 'gsm: desktopframe verborgen, 76 px onderaan vrij, knoppen ≥ 44 px');
  T.check(!rhtml.includes('gsm'), 'ritplanning.html ongewijzigd (de gsm-laag wordt door het script toegevoegd)');

  // ═══ Punt 2: Nakijken ═══
  const NK = require(T.ROOT + '/public/nakijken.js');
  const km = ijk.kampmomenten.abdijschool, thema = ijk.themas.alles_op_wieltjes;
  const maakBak = async (label, code, items) => { const b = (await A('POST', `/api/themas/${thema}/bakken`, { label, code })).json; for (const [naam, qty] of items) await A('POST', `/api/bakken/${b.id}/items`, { naam, qty }); return b.id; };
  await maakBak('Gsm bak', 'GS01', [['Springtouw', 4], ['Hoepel', 6], ['Pion', 10], ['Bal zacht', 4]]);
  await A('POST', `/api/kampmomenten/${km}/themas`, { thema_id: thema });
  const kvtok = await T.kvToken(srv.base, tok, km);
  const kv = (m, p, b) => P(m, `/api/kv/${kvtok}${p}`, b);
  const d0 = (await kv('GET', '/data')).json, kb = d0.bakken.find((b) => b.code === 'GS01');
  const tel = (naam, rest) => kv('POST', `/bakken/${kb.id}/tellen`, { regels: [{ item_id: kb.items.find((i) => i.naam === naam).id, ...rest }] });
  await tel('Bal zacht', { aangetroffen: 4 }); await tel('Springtouw', { aangetroffen: 2, notitie: 'zak gescheurd' }); await tel('Hoepel', { aangetroffen: 8 }); await tel('Pion', { aangetroffen: 10, kapot_aantal: 2, notitie: 'gebarsten', foto_data: PNG });
  await kv('POST', '/versturen', {});
  const nl = (await A('GET', '/api/nakijken')).json;
  const bak = nl.bakken.find((b) => b.bak.code === 'GS01' && b.kampmoment_id === km);
  const ST = { filter: '', zoek: '', geselecteerd: new Set(), gi: 0 };
  const gl = NK.gsmLijstHtml(nl, ST);
  T.check(!/<table|<tr[ >]/.test(gl) && gl.includes('class="chipsS"') && gl.includes('data-gk="filter"') && gl.includes('data-gk="open"') && gl.includes('GS01') && gl.includes('Week ') && gl.includes('te keuren'), 'nakijken: lijst van bakken met tellers en chips (horizontaal scrollbaar), geen tabel');
  const det = (await A('GET', `/api/nakijken/sessie/${bak.sessie_id}`)).json;
  const regels = NK.gsmRegels(det);
  T.check(regels.length === 3 && regels.map((r) => r.afwijking).sort().join() === 'kapot,te_veel,tekort', `3 regels om te beslissen (${regels.map((r) => r.naam + ':' + r.afwijking)})`);
  T.check(det.items.every((i) => typeof i.voorraad_tekst === 'string'), 'regeldata heeft voorraad_tekst (voorraad per stockage + minimum)');
  const r0 = NK.gsmRegelHtml(det, { gi: 0 });
  const eerste = regels[0];
  T.check(r0.includes('Regel 1 van 3') && r0.includes(eerste.naam) && r0.includes('Geteld') && r0.includes('KV zegt') && r0.includes('Voorraad') && r0.includes('Voorstel') && r0.includes('Nog in deze bak') && r0.includes('Overslaan ›') && r0.includes('‹ Vorige') && /disabled>‹ Vorige/.test(r0), 'één regel per scherm: artikel, geteld/gewenst, KV zegt, voorraad, voorstel, Nog in deze bak, Vorige/Overslaan');
  const knoppen = (h) => [...h.matchAll(/<button type="button" class="knop breed( licht)?" style="height:56px" data-gk="kies"[^>]*data-w="([^"]*)"/g)].map((m) => [m[2], !m[1]]);
  const kn = knoppen(r0);
  T.check(kn.length === eerste.acties.length && kn.every(([w]) => eerste.acties.some((a) => a.waarde === w)) && kn.filter(([, blauw]) => blauw).length === 1 && kn[0][1], `knoppen van 56 px = de ACTIES van die regel (${kn.map((k) => k[0])}); de eerste (voorstel) is blauw`);
  // een keuze bewaren via de bestaande API, daarna naar de volgende regel
  const keuze = eerste.acties[0].waarde;
  const put = await A('PUT', `/api/nakijken/regel/${eerste.regel_id}`, { kantoor_actie: keuze, kantoor_aantal: eerste.aantal_afwijking });
  const det2 = (await A('GET', `/api/nakijken/sessie/${bak.sessie_id}`)).json;
  T.check(put.status === 200 && det2.items.find((i) => i.regel_id === eerste.regel_id).kantoor_actie === keuze, `keuze (${keuze}) meteen bewaard via de bestaande API`);
  const r1 = NK.gsmRegelHtml(det2, { gi: 1 });
  const tweede = NK.gsmRegels(det2)[1];
  T.check(r1.includes('Regel 2 van 3') && r1.includes(tweede.naam) && !/disabled>‹ Vorige/.test(r1), 'na een keuze → de volgende regel ("Regel 2 van 3"), Vorige actief');
  const js = lees('public/nakijken.js');
  T.check(js.includes("ST.gi = (ST.gi || 0) + 1; await laadDetail(ST.open)") && js.includes("'/api/nakijken/regel/' + gk.getAttribute('data-regel')") && js.includes("ga === 'afronden'"), 'browsercode: keuze → PUT → direct naar de volgende regel; afronden via de bestaande route');
  for (const rg of NK.gsmRegels(det2).slice(1)) await A('PUT', `/api/nakijken/regel/${rg.regel_id}`, { kantoor_actie: rg.acties[0].waarde, kantoor_aantal: rg.aantal_afwijking });
  const det3 = (await A('GET', `/api/nakijken/sessie/${bak.sessie_id}`)).json;
  const laatste = NK.gsmRegelHtml(det3, { gi: 3 });
  T.check(laatste.includes('Alle regels bekeken') && laatste.includes('Keuring afronden ✓') && !/data-gk="afronden"[^>]*disabled/.test(laatste), 'na de laatste regel: Keuring afronden');
  const af = await A('POST', `/api/nakijken/sessie/${bak.sessie_id}/afronden`);
  T.check(af.status === 200, 'Keuring afronden via de bestaande route');
  const ncss = lees('public/nakijken.css');
  const nb = ncss.slice(ncss.indexOf('/* ── MOB2'));
  T.check(/#gsm\{display:none\}/.test(nb) && /body>\.top,body>\.sub,body>#nk-app\{display:none\}/.test(nb) && /padding-bottom:76px/.test(nb) && /height:44px/.test(nb) && /overflow-x:auto/.test(nb), 'nakijken.css: alleen onder 768 px zichtbaar, 76 px onderaan vrij, chips scrollen horizontaal');

  // ═══ Punt 3: Rooster ═══
  const RO = require(T.ROOT + '/public/rooster.js');
  const PERID = ijk.periode?.id || 2;
  const wk = (await A('GET', `/api/rooster/week?periode_id=${PERID}&week=1`)).json;
  const locs8 = wk.locaties.filter((l) => l.themas.length >= 1);
  T.check(locs8.length > 0 && wk.locaties.every((l) => 'meldingen_n' in l), `rooster-data: ${wk.locaties.length} locaties met meldingen_n`);
  // zeven thema's op één locatie
  const alleThemas = (await A('GET', '/api/themas')).json.filter((t) => t.id !== ijk.themas.alles_op_wieltjes).slice(0, 7);
  const kmNieuw = { id: ijk.kampmomenten.betekom };
  for (const t of alleThemas) await A('POST', `/api/kampmomenten/${kmNieuw.id}/themas`, { thema_id: t.id });
  const wk2 = (await A('GET', `/api/rooster/week?periode_id=${PERID}&week=1`)).json;
  const l7 = wk2.locaties.find((l) => l.kampmoment_id === kmNieuw.id);
  const kaart = RO.weekKaart(l7, {});
  T.check(l7 && l7.themas.length >= 7 && (kaart.match(/<span class="tg/g) || []).length === l7.themas.length, `rooster toont alle labels bij ${l7.themas.length} thema's (min. 7) (${(kaart.match(/<span class="tg/g) || []).length})`);
  T.check(kaart.includes('class="r gk') && kaart.includes('class="gkop"') && !/<table|<tr[ >]/.test(kaart) && /<i>[A-Z]{2}\d<\/i>/.test(kaart), 'kaart: naam, KV, thema-labels met groep (KL1…), geen tabel');
  const geenKv = wk2.locaties.find((l) => !l.kv), metKv = wk.locaties.find((l) => l.kv);
  T.check((!geenKv || RO.weekKaart(geenKv, {}).includes('class="geen">geen KV</span>')) && (!metKv || RO.weekKaart(metKv, {}).includes('<span>KV ')), '"geen KV" in oker (klasse geen), anders KV naam');
  const meld = [...wk.locaties, ...wk2.locaties].find((l) => l.meldingen_n > 0);
  T.check(!meld || /class="gmeld">\d+ melding(en)? ›/.test(RO.weekKaart(meld, {})), 'regel "n meldingen ›" bij een locatie met meldingen');
  const fg = RO.filtersWeekGsm(wk, 'alle');
  T.check(fg.includes('class="wk"') && fg.includes('data-week="-1"') && fg.includes('data-week="1"') && fg.includes('class="chipsS"') && fg.includes('data-zicht="seizoen"') && fg.includes('Geen KV'), 'weekkeuze ‹ ›, chips horizontaal scrollbaar, schakelaar Seizoen blijft');
  const detailKm = (await A('GET', `/api/rooster/kampmoment/${kmNieuw.id}`)).json;
  const kp = RO.kmPaneel(detailKm, 'week');
  T.check(kp.includes('data-act="terug"') && kp.includes('‹ terug naar de lijst') && kp.includes('Let op'), 'kampmomentpaneel als volgend scherm met ‹ terug (Wissel in Let op)');
  const rcss2 = lees('public/rooster.css'), rmob = rcss2.slice(rcss2.indexOf('/* ── MOB2'));
  T.check(/@media \(max-width:767px\)/.test(rmob) && /padding-bottom:76px/.test(rmob) && /chip\{height:44px/.test(rmob) && !/^[^@]*\{/.test(rmob.split('@media')[0].replace(/^[^\n]*\n/, '')), 'rooster.css: MOB2-regels staan alleen onder 768 px, 76 px onderaan vrij');
  T.check(/\.sgrid\{min-width:calc/.test(rcss2) && /\.scroll\.raster\{overflow-x:auto/.test(rcss2), 'Seizoen: bestaand raster scrollt binnen het raster');
  const rj = lees('public/rooster.js');
  T.check(rj.includes("matchMedia('(max-width:767px)')") && rj.includes('weekRij') && rj.includes('BOUW.weekKaart'), 'desktop (≥ 768 px) gebruikt nog steeds weekRij; gsm gebruikt weekKaart');

  // ═══ Alle gsm-schermen: geen buitenstaande desktop-regels, geen tabel, knoppen ≥ 44 px ═══
  for (const [naam, css] of [['ritplanning', rcss.slice(rcss.indexOf('/* ── MOB2'))], ['nakijken', nb], ['rooster', rmob]]) {
    const top = bovenste(css);
    T.check(top === (naam === 'rooster' ? '@media(max-width:767px){}' : '#gsm{}@media(max-width:767px){}'), `${naam}: de MOB2-CSS raakt de desktopweergave niet (bovenste niveau: ${top})`);
  }
} catch (e) { T.fout('uitzondering: ' + (e.stack || e)); }
await T.einde(srv);
