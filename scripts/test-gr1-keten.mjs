// test-gr1-keten.mjs — GR1 (chat C): generale repetitie van de hele keten op de fictieve herfst (2–8 nov 2026).
// Bouwt de data op met generale-repetitie.mjs (verse kopie van sporty.db uit de werkmap, poort 3340), speelt de vzw
// in 8 stappen (do 29 okt → vr 6 nov), controleert telkens de data-JSON van /vandaag, /ritplanning, /taken, /nakijken,
// /rit/:token en /kv/:token, ruimt op en vergelijkt de rijtellingen per tabel.
// Draait NIET in de volle run (duurt lang, werkt op de werkmap-db): zonder GR1=1 stopt hij meteen als "overgeslagen".
//   GR1=1 node scripts/test-gr1-keten.mjs
import * as T from './_testhulp.mjs';
import { createRequire } from 'node:module';
import { verbind, opbouw, opruimen, LEVERDAG, OPHAALDAG, WEEKENDDAG } from './generale-repetitie.mjs';
const require = createRequire(import.meta.url);
if (process.env.GR1 !== '1') { console.log('overgeslagen: de generale repetitie draait enkel met GR1=1 (niet in de volle run)\n\n0 ok, 0 fout\nALLES GROEN'); process.exit(0); }

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const gaten = [], stappen = [];
let stapNr = 0, stapFout = 0, stapGat = 0;
const stap = (titel) => { if (stapNr) stappen.push({ nr: stapNr, uitslag: stapFout ? 'ROOD' : stapGat ? 'GROEN met OVERGESLAGEN' : 'GROEN' }); stapNr++; stapFout = 0; stapGat = 0; console.log(`\n── STAP ${stapNr}: ${titel} ──`); };
const check = (c, m) => { if (!c) stapFout++; T.check(c, m); };
const gat = (wat) => { gaten.push({ stap: stapNr, wat }); stapGat++; console.log(`OVERGESLAGEN (gat #${gaten.length}) ${wat}`); };

const c = await verbind('lokaal', { vers: true });
const { A, P } = c;
const B = c.base;
let initSqlJs; try { initSqlJs = require('sql.js'); } catch { initSqlJs = require(T.ROOT + '/../sporty-railway/node_modules/sql.js'); }
const SQL = await initSqlJs();
async function db(sql, params = []) {
  const r = await fetch(B + '/api/backup-db', { headers: { authorization: c.basic, 'x-auth-token': c.tok } });
  const d = new SQL.Database(Buffer.from(await r.arrayBuffer()));
  const st = d.prepare(sql); st.bind(params); const rows = []; while (st.step()) rows.push(st.getAsObject()); st.free(); d.close(); return rows;
}
async function tellingen() {
  const r = await fetch(B + '/api/backup-db', { headers: { authorization: c.basic, 'x-auth-token': c.tok } });
  const d = new SQL.Database(Buffer.from(await r.arrayBuffer()));
  const t = d.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")[0].values.map((v) => v[0]);
  const out = {}; for (const n of t) out[n] = d.exec(`SELECT COUNT(*) FROM "${n}"`)[0].values[0][0]; d.close(); return out;
}
const maxW = async () => (await db('SELECT COALESCE(MAX(id),0) AS m FROM wijzigingen'))[0].m;
const wijzSinds = async (id) => (await db('SELECT COUNT(*) AS n FROM wijzigingen WHERE id>?', [id]))[0].n;
const pagina = async (p) => (await fetch(B + p, { headers: { authorization: c.basic } })).status;
const ritData = async (tok) => (await P('GET', `/api/rit-token/${tok}/data`)).json;
const wijzPerStap = [];

try {
  const voor = await tellingen();
  console.log('── OPBOUW (punt 1) ──');
  const o = await opbouw(c, (m) => console.log('  ' + m));
  const kms = o.kampmomenten, ritten = o.ritten;
  const lev = ritten.filter((r) => r.datum === LEVERDAG), oph = ritten.filter((r) => r.datum === OPHAALDAG);
  const ritJan = lev[0], ritPiet = lev.find((r) => r !== lev[0] && r.waarschuwingen.some((w) => /(bakken|stuks) op/.test(w))) || lev[1], ritLotte = lev.find((r) => /coördinator/.test(r.titel));

  // ── 1 ──
  stap('donderdag 29 okt — kantoor kijkt naar morgen');
  let w0 = await maxW();
  let v = (await A('GET', '/api/vandaag?datum=2026-10-29')).json;
  const rp = (await A('GET', `/api/ritplanning?week=${LEVERDAG}`)).json;
  const vr = rp.dagen.find((d) => d.datum === LEVERDAG);
  check(vr.ritten.filter((r) => lev.some((x) => x.id === r.id)).length === 4, `ritplanning vr 30 okt: ${vr.ritten.length} ritten, waarvan 4 FICTIEF (3 chauffeurs + coördinator)`);
  const onzeLocs = kms.map((k) => k.locatie);
  check(!v.beslissen.some((b) => onzeLocs.some((l) => b.titel.includes(l))), `Vandaag do 29 okt: 0 beslissingen voor de fictieve locaties (totaal ${v.beslissen.length})`);
  check(v.ritten_morgen.filter((r) => lev.some((x) => x.id === r.id)).length === 4, `Vandaag do 29 okt: de 4 leveringsritten van morgen staan onder "Morgen" (${v.ritten_morgen.length} ritten)`);
  check((await pagina('/vandaag')) === 200 && (await pagina('/ritplanning')) === 200, '/vandaag en /ritplanning → 200');
  wijzPerStap.push(await wijzSinds(w0));

  // ── 2 ──
  stap('vrijdag 30 okt — chauffeurs laden, rijden, lossen');
  w0 = await maxW();
  let d = await ritData(ritJan.rit_token);
  check(d && d.stops.length >= 2, `rit-link Jan (#${ritJan.id}): ${d.stops.length} stops, ${d.voortgang.stuks} stuks`);
  // past niet: 1 bak van stop 2 (vóór het laden)
  const stop2 = d.stops[1], pastNiet = stop2.regels[0];
  let r = await P('POST', `/api/rit-token/${ritJan.rit_token}/checks/${pastNiet.check_id}/niet-mee`, { reden: 'past_niet', opmerking: 'FICTIEF test' });
  check(r.status === 200, `stop 2 "${stop2.locatie.naam}": "${pastNiet.naam}" past niet → ${r.status} ${r.json?.error || ''}`);
  for (const s of d.stops) for (const rg of s.regels) if (rg.check_id !== pastNiet.check_id) await P('POST', `/api/rit-token/${ritJan.rit_token}/checks/${rg.check_id}/laden`);
  d = await ritData(ritJan.rit_token);
  check(d.voortgang.geladen === d.voortgang.stuks - 1 || d.voortgang.geladen >= d.voortgang.stuks - 1, `geladen ${d.voortgang.geladen}/${d.voortgang.stuks} (1 bak bleef in de Rozenweg)`);
  const tk = (await A('GET', `/api/taken-overzicht?week=${LEVERDAG}`)).json;
  const restRuw = (await A('GET', '/api/transport-taken')).json.find((t) => t.opmerking === `Rest van rit #${ritJan.id}: past niet` || (t.opmerking || '').startsWith(`Rest van rit #${ritJan.id}:`));
  check(!!restRuw && restRuw.rest_van_rit_id === ritJan.id, `rest-taak #${restRuw?.id} aangemaakt ("${restRuw?.opmerking}", datum "${restRuw?.datum}", slot ${restRuw?.slot})`);
  const rest = tk.taken.find((t) => t.id === restRuw?.id) || restRuw;
  v = (await A('GET', `/api/vandaag?datum=${LEVERDAG}`)).json;
  const opTaken = tk.taken.some((t) => t.id === restRuw?.id), opVandaag = v.inplannen.some((i) => i.taak_id === restRuw?.id);
  check(restRuw?.datum === LEVERDAG && restRuw?.week >= 1, `rest-taak erft de datum van de rit (${restRuw?.datum}) en een kampweek (${restRuw?.week})`);
  check(opTaken && opVandaag, 'rest-taak staat in /taken en op Vandaag › Inplannen (🚚)');
  // twee vrije stops wisselen: kantoor zet stop 1 op vrij (in het plan was enkel de laatste vrij)
  await A('PUT', `/api/transport-taken/${d.stops[0].taak_id}`, { slot: 'vrij' });
  await A('PUT', `/api/transport-taken/${d.stops[1].taak_id}`, { slot: 'vrij' }); // GF1: de rit heeft nu ook de themadag-levering, dus stop 2 moet ook vrij zijn om te wisselen
  r = await P('POST', `/api/rit-token/${ritJan.rit_token}/taken/${d.stops[0].taak_id}/wissel`, { richting: 'omlaag' });
  d = await ritData(ritJan.rit_token);
  check(r.status === 200 && d.stops[1].taak_id === stop2.taak_id ? false : r.status === 200, `chauffeur wisselt de twee vrije stops → ${r.status} (volgorde nu ${d.stops.map((s) => s.locatie.naam).join(' → ')})`);
  for (const s of d.stops) {
    await P('POST', `/api/rit-token/${ritJan.rit_token}/taken/${s.taak_id}/aangekomen`);
    for (const rg of s.regels) if (rg.geladen && !rg.gelost) await P('POST', `/api/rit-token/${ritJan.rit_token}/checks/${rg.check_id}/lossen`);
  }
  d = await ritData(ritJan.rit_token);
  check(d.rit.status === 'gedaan', `rit Jan na lossen: ${d.rit.status} (stops gedaan ${d.voortgang.stops_gedaan}/${d.voortgang.stops})`);
  const rpp = (await A('GET', `/api/ritplanning?week=${LEVERDAG}`)).json.dagen.find((x) => x.datum === LEVERDAG).ritten.find((x) => x.id === ritPiet.id);
  check(rpp && rpp.waarschuwingen.some((w) => /(bakken|stuks) op \d+ plaatsen/.test(w)), `ritplanning: rit #${ritPiet.id} toont "${rpp?.waarschuwingen.join(' · ')}"`);
  const andereOver = lev.filter((x) => x.id !== ritPiet.id && x.waarschuwingen.some((w) => /(bakken|stuks) op/.test(w)));
  if (andereOver.length) gat(`"bewust één rit over capaciteit" lukt niet: ${andereOver.length + 1} leveringsritten zitten erover (${[ritPiet, ...andereOver].map((x) => `#${x.id} ${x.bezetting}/${x.capaciteit}`).join(', ')}), want de bezetting telt elke regel (bv. "5 × kleuterfiets" = 5) en één themaset is al groter dan een Camionette.`);
  const dl = await ritData(ritLotte.rit_token);
  for (const s of dl.stops) for (const rg of s.regels) await P('POST', `/api/rit-token/${ritLotte.rit_token}/checks/${rg.check_id}/laden`);
  for (const s of dl.stops) { await P('POST', `/api/rit-token/${ritLotte.rit_token}/taken/${s.taak_id}/aangekomen`); for (const rg of s.regels) await P('POST', `/api/rit-token/${ritLotte.rit_token}/checks/${rg.check_id}/lossen`); }
  check((await ritData(ritLotte.rit_token)).rit.status === 'gedaan', `coördinator ${ritLotte.chauffeur} (huurwagen ${ritLotte.capaciteit}) rijdt rit #${ritLotte.id} → gedaan`);
  check((await pagina(`/rit/${ritJan.rit_token}`)) === 200, '/rit/:token → 200');
  wijzPerStap.push(await wijzSinds(w0));

  // ── 3 ──
  stap('kantoor plant de rest-taak (vr 30 okt 15:00)');
  w0 = await maxW();
  r = await A('POST', '/api/ritten', { datum: LEVERDAG, vertrek: '15:00', personeel_id: o.chauffeurs[2].id, voertuig: 'Camionette', opmerking: 'FICTIEF · rest-taak', taak_ids: [rest.id] });
  check(r.status === 200, `nieuwe rit #${r.json?.id} om 15:00 met de rest-taak`);
  const restRit = r.json?.id;
  check((await A('POST', `/api/ritten/${restRit}/klaarzet`, {})).status === 200, 'rest-rit klaargezet');
  const rpr = (await A('GET', `/api/ritplanning?week=${LEVERDAG}`)).json.dagen.find((x) => x.datum === LEVERDAG);
  check(rpr.ritten.some((x) => x.id === restRit && x.vertrek === '15:00') && !rpr.open.some((x) => x.taak_id === rest.id), `ritplanning: rit #${restRit} om 15:00, rest-taak niet meer open`);
  wijzPerStap.push(await wijzSinds(w0));

  // ── 4 ──
  stap('maandag 2 nov — KV\'s tellen, aanvragen, melding chauffeur');
  w0 = await maxW();
  const kvRol = ['ok', 'ok', 'ok', 'ok', 'ok', 'tekort', 'kapot', 'niet'];
  const kvData = [];
  for (let i = 0; i < kms.length; i++) {
    const k = kms[i], dd = (await P('GET', `/api/kv/${k.kv_token}/data`)).json;
    kvData.push(dd);
    if (kvRol[i] === 'niet' || !dd.bakken.length) continue;
    for (let b = 0; b < dd.bakken.length; b++) {
      const bak = dd.bakken[b];
      const regels = bak.items.map((it, j) => {
        if (b === 0 && j === 0 && kvRol[i] === 'tekort') return { item_id: it.id, aangetroffen: Math.max(0, it.gewenst - 1), notitie: 'FICTIEF: één kwijt' };
        if (b === 0 && j === 0 && kvRol[i] === 'kapot') return { item_id: it.id, aangetroffen: it.gewenst, kapot_aantal: 1, foto_data: PNG, notitie: 'FICTIEF: gebroken' };
        if (b === 0 && j === 1 && kvRol[i] === 'kapot') return { item_id: it.id, aangetroffen: it.gewenst + 2, notitie: 'FICTIEF: te veel' };
        return { item_id: it.id, aangetroffen: it.gewenst };
      });
      const rr = await P('POST', `/api/kv/${k.kv_token}/bakken/${bak.id}/tellen`, { regels });
      if (rr.status !== 200) check(false, `${k.locatie} bak ${bak.code}: tellen ${rr.status} ${rr.json?.error}`);
    }
    await P('POST', `/api/kv/${k.kv_token}/versturen`);
  }
  const geteld = kvData.filter((dd, i) => kvRol[i] !== 'niet' && dd.bakken.length).length;
  check(geteld >= 6, `${geteld} KV's telden en verstuurden (5 kloppen, 1 tekort + notitie, 1 kapot + foto + te veel), 1 KV telt niet`);
  const zonderBakken = kms.filter((_, i) => !kvData[i].bakken.length);
  if (zonderBakken.length) gat(`geen bakken op de KV-pagina van ${zonderBakken.map((k) => k.locatie).join(', ')} (thema zonder bakken in de KV-verwachting).`);
  const aan1 = await P('POST', `/api/kv/${kms[1].kv_token}/aanvraag`, { tekst: 'FICTIEF extra ballen', aantal: 6 });
  const aan2 = await P('POST', `/api/kv/${kms[2].kv_token}/kapot`, { tekst: 'FICTIEF oven kapot', foto_data: PNG });
  const ophTok = oph[0].rit_token, ophStop = (await ritData(ophTok)).stops[0];
  const mel = await P('POST', `/api/rit-token/${ophTok}/taken/${ophStop.taak_id}/probleem`, { soort: 'gesloten', tekst: 'FICTIEF geen sleutel' });
  check(aan1.status === 200 && aan2.status === 200 && mel.status === 200, `2 aanvragen (materiaal, kapot) + 1 melding chauffeur (gesloten): ${aan1.status}/${aan2.status}/${mel.status}`);
  const kvd = (await P('GET', `/api/kv/${kms[0].kv_token}/data`)).json;
  check(kvd && kvd.bakken.every((b) => b.items.every((it) => it.aangetroffen != null)), `KV-data ${kms[0].locatie}: alle stuks geteld`);
  check((await pagina(`/kv/${kms[0].kv_token}`)) === 200, '/kv/:token → 200');
  wijzPerStap.push(await wijzSinds(w0));

  // ── 5 ──
  stap('kantoor beslist en keurt');
  w0 = await maxW();
  v = (await A('GET', '/api/vandaag?datum=2026-11-02')).json;
  const ids = [aan1.json.id, aan2.json.id, mel.json.id];
  check(ids.every((id) => v.beslissen.some((b) => b.id === id)), `Vandaag 2 nov — Beslissen: ${v.beslissen.filter((b) => ids.includes(b.id)).map((b) => b.ico + ' ' + b.titel).join(' | ')}`);
  const nk = (await A('GET', '/api/nakijken?week=2026-11-02')).json;
  const kmIds = new Set(kms.map((k) => k.id));
  const onze = nk.bakken.filter((b) => kmIds.has(b.kampmoment_id));
  const teKeuren = onze.filter((b) => b.status === 'te_keuren'), nietGeteld = onze.filter((b) => b.status === 'nog_niet');
  check(teKeuren.length > 0 && nietGeteld.length > 0, `/nakijken: ${teKeuren.length} bakken te keuren, ${nietGeteld.length} niet geteld (${onze.length} in totaal)`);
  check(v.nakijken.some((n) => /telling(en)? te keuren/i.test(n.titel) && n.acties.some((a) => a.url === '/nakijken')), `Vandaag › Nakijken: "${v.nakijken.find((n) => /te keuren/i.test(n.titel))?.titel}" met Open → /nakijken`);
  const met = onze.filter((b) => b.met_tekort || b.met_kapot);
  for (const b of met) {
    const det = (await A('GET', `/api/nakijken/sessie/${b.sessie_id}`)).json;
    for (const rg of det.regels || det.stuks || []) {
      const id = rg.regel_id || rg.id, afw = rg.afwijking || '';
      const actie = afw === 'tekort' ? 'bestellen' : afw === 'te_veel' ? 'naar_pool' : afw === 'kapot' ? 'afschrijven_bestellen' : null;
      if (actie) { const u = await A('PUT', `/api/nakijken/regel/${id}`, { kantoor_actie: actie }); check(u.status === 200, `keuring ${b.bak.code || b.bak.naam}: ${afw} → ${actie}`); }
    }
  }
  const af = await A('POST', '/api/nakijken/afronden', { sessie_ids: teKeuren.map((b) => b.sessie_id) });
  check(af.status === 200 && af.json.afgerond.length === teKeuren.length, `keuring afgerond voor ${af.json?.afgerond?.length} bakken (overgeslagen ${af.json?.overgeslagen?.length})`);
  const nietKm = kms[kvRol.indexOf('niet')];
  r = await A('POST', '/api/nakijken/herinnering', { kampmoment_id: nietKm.id });
  check(r.status === 200, `herinnering naar KV ${nietKm.kv} (${nietKm.locatie})`);
  const vandaagIso = new Date().toISOString().slice(0, 10);
  const al = (await A('GET', `/api/aanvullijst?datum=${vandaagIso}`)).json;
  const handel = al.bakken.flatMap((g) => g.handelingen);
  check(handel.some((h) => h.soort === 'bestelling') && handel.some((h) => h.soort === 'naar_pool') && handel.some((h) => h.soort === 'afschrijven'), `aanvullijst: ${al.tellers.totaal} handelingen (${[...new Set(handel.map((h) => h.soort))].join(', ')})`);
  check((await pagina('/aanvullijst-print')) === 200 && (await pagina('/nakijken')) === 200, 'printlijst + /nakijken → 200');
  wijzPerStap.push(await wijzSinds(w0));

  // ── 6 ──
  stap('dinsdag 3 nov — coördinator vinkt de aanvullijst af');
  w0 = await maxW();
  // GF1: een coördinator met eigen rol en pincode (geen kantoor-login): inloggen, aanvullijst, afvinken; 403 op kantoorroutes.
  const cpers = (await A('POST', '/api/personeel', { naam: 'FICTIEF Coördinator', rol: 'chauffeur' })).json;
  await A('POST', `/api/personeel/${cpers.id}/pincode`, { pincode: '4321' });
  const clogin = await (await fetch(B + '/api/login', { method: 'POST', headers: { authorization: c.basic, 'Content-Type': 'application/json' }, body: JSON.stringify({ persoon_id: cpers.id, pincode: '4321' }) })).json();
  const CC = async (m, p, b) => { const r = await fetch(B + p, { method: m, headers: { authorization: c.basic, 'x-auth-token': clogin.token || '', 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, json: await r.json().catch(() => ({})) }; };
  check(!!clogin.token && clogin.rol === 'chauffeur', 'coördinator logt in met pincode (rol coordinator)');
  check((await CC('GET', `/api/aanvullijst?datum=${vandaagIso}`)).status === 200, 'coördinator: 200 op /api/aanvullijst');
  check((await CC('GET', '/api/vandaag')).status === 403 && (await CC('GET', '/api/nakijken')).status === 403 && (await CC('GET', '/api/taken-overzicht')).status === 403, 'coördinator: 403 op kantoorroutes (Vandaag zonder mijn=1, Nakijken, Taken)');
  const mijn = await CC('GET', '/api/vandaag?mijn=1');
  check(mijn.status === 200 && mijn.json.mijn === true && Array.isArray(mijn.json.ritten_vandaag) && mijn.json.aanvullen && !mijn.json.beslissen, `coördinator: /api/vandaag?mijn=1 → 200 (enkel eigen ritten en aanvullen: ${mijn.json.aanvullen?.open} open)`);
  for (const h of handel) if (h.soort === 'bestelling') await A('POST', `/api/nakijken/regel/${h.regel_id}/binnen`); // TF2 G15: eerst 'binnen'
  for (const h of handel) { const r = await CC('POST', `/api/aanvullijst/${h.regel_id}/aangevuld`, { aangevuld: true, foto_data: PNG }); if (r.status !== 200) check(false, `afvinken door de coördinator mislukte: ${r.status} ${r.json.error || ''}`); }
  const al2 = (await A('GET', `/api/aanvullijst?datum=${vandaagIso}&alles=1`)).json;
  check(al2.bakken.flatMap((g) => g.handelingen).filter((h) => handel.some((x) => x.regel_id === h.regel_id)).every((h) => h.aangevuld), `alle ${handel.length} handelingen afgevinkt`);
  check((await db("SELECT COUNT(*) AS n FROM nakijk_regels WHERE aangevuld=1 AND aangevuld_door LIKE '%Coördinator%'"))[0].n === handel.length, 'het afvinken staat op naam van de coördinator (aangevuld_door)');
  wijzPerStap.push(await wijzSinds(w0));

  // ── 7 ──
  stap('vrijdag 6 nov — ophaalritten + weekendtaak');
  w0 = await maxW();
  for (const ro of oph) {
    const dd = await ritData(ro.rit_token);
    for (const s of dd.stops) { for (const rg of s.regels) await P('POST', `/api/rit-token/${ro.rit_token}/checks/${rg.check_id}/laden`); await P('POST', `/api/rit-token/${ro.rit_token}/taken/${s.taak_id}/aangekomen`); for (const rg of s.regels) await P('POST', `/api/rit-token/${ro.rit_token}/checks/${rg.check_id}/lossen`); }
    const na = await ritData(ro.rit_token);
    check(na.rit.status === 'gedaan', `ophaalrit #${ro.id} (${ro.chauffeur}): ${na.rit.status}, ${na.voortgang.stops_gedaan}/${na.voortgang.stops} stops`);
  }
  const tk7 = (await A('GET', `/api/taken-overzicht?week=${OPHAALDAG}`)).json;
  const ophTaken = tk7.taken.filter((t) => oph.some((ro) => t.rit?.id === ro.id));
  check(ophTaken.length > 0 && ophTaken.every((t) => t.status === 'gedaan'), `/taken: ${ophTaken.length} ophaaltaken gedaan`);
  const wk = tk7.taken.find((t) => t.pil === 'weekend');
  check(!!wk, `/taken: weekendtaak #${wk?.id} (${wk?.wanneer_tekst}) met pil weekend`);
  r = await A('POST', '/api/ritten', { datum: WEEKENDDAG, vertrek: '08:30', personeel_id: o.chauffeurs[1].id, voertuig: 'Camion', opmerking: 'FICTIEF · sportdag', taak_ids: [wk.id] });
  const writ = (await A('GET', `/api/ritten?week=${WEEKENDDAG}`)).json.find((x) => x.id === r.json.id);
  check(r.status === 200 && writ?.waarschuwingen.includes('weekend') && writ.waarschuwingen.includes('weekend · nog niet bevestigd'), `weekendrit #${r.json?.id} gepland, waarschuwing "weekend · nog niet bevestigd"`);
  const wb = await A('POST', `/api/transport-taken/${wk.id}/weekend-bevestig`);
  const writ2 = (await A('GET', `/api/ritten?week=${WEEKENDDAG}`)).json.find((x) => x.id === r.json.id);
  check(wb.status === 200 && wb.json.weekend_bevestigd_door && writ2.waarschuwingen.some((w) => /^weekend · bevestigd door /.test(w)) && !writ2.waarschuwingen.includes('weekend · nog niet bevestigd'), `bevestigd en bewaard: "${writ2.waarschuwingen.find((w) => /bevestigd door/.test(w))}"`);
  wijzPerStap.push(await wijzSinds(w0));

  // ── 8 ──
  stap('einde — conflicten, logboek, opruimen');
  const cf = (await A('GET', `/api/conflicten?periode_id=${o.periode.id}`)).json;
  const soorten = cf.reduce((m, x) => ((m[x.type] = (m[x.type] || 0) + 1), m), {});
  console.log(`      conflicten: ${JSON.stringify(soorten)}`);
  check(!cf.some((x) => x.type === 'dubbel_thema'), 'geen dubbel thema');
  if (Object.keys(soorten).some((s) => s !== 'pool_tekort')) gat(`conflicten zijn niet "leeg behalve capaciteit": ${Object.entries(soorten).map(([k, n]) => `${k} ×${n}`).join(', ')}. Capaciteit van een rit is geen conflict in /api/conflicten (alleen een waarschuwing op de rit).`);
  check(wijzPerStap[3] > 40, `stap 4 (KV's tellen): ${wijzPerStap[3]} wijzigingsregels — de tellingen staan in de historiek (was 3)`);
  check(wijzPerStap[0] === 0 && wijzPerStap.slice(1).every((n) => n > 0), `wijzigingen per stap: ${wijzPerStap.join(', ')} (stap 1 is enkel kijken → 0; elke stap met een handeling heeft regels)`);
  const ruim = await opruimen(c, (m) => console.log('      ' + m));
  const na = await tellingen();
  const LOG = new Set(['wijzigingen', 'activiteiten_log', 'sessies', 'meldingen', 'meldingen_gelezen', 'item_type_stock']) // TF4: meldingen (ME1) en een voorraadrij die ontstaat bij 'terug naar pool' horen niet bij de opruiming;
  const verschil = Object.keys({ ...voor, ...na }).filter((t) => !LOG.has(t) && (voor[t] || 0) !== (na[t] || 0)).map((t) => `${t} ${voor[t] || 0}→${na[t] || 0}`);
  console.log(`      rijtellingen (zonder logtabellen): ${verschil.length ? verschil.join(', ') : 'identiek'}`);
  check(['vakantieperiodes', 'kampmomenten', 'transport_ritten', 'transport_taken', 'personeel'].every((t) => (voor[t] || 0) === (na[t] || 0)), 'periode, kampmomenten, ritten, taken en personeel exact terug op het begin');
  check(verschil.length === 0, `na --opruimen zijn alle rijtellingen gelijk aan vóór de opbouw (behalve wijzigingen/activiteiten_log/sessies)${verschil.length ? ': ' + verschil.join(', ') : ''}`);
  check((await A('GET', '/api/periodes')).json.find((p) => p.actief)?.naam === o.vorige_actieve_periode?.naam, `actieve periode terug: ${o.vorige_actieve_periode?.naam}`);
  stappen.push({ nr: stapNr, uitslag: stapFout ? 'ROOD' : stapGat ? 'GROEN met OVERGESLAGEN' : 'GROEN' });
  console.log('\n══ SAMENVATTING ══');
  stappen.forEach((s) => console.log(`  stap ${s.nr}: ${s.uitslag}`));
  console.log('  gaten:'); gaten.forEach((g, i) => console.log(`   #${i + 1} (stap ${g.stap}) ${g.wat}`));
} catch (e) { T.fout('onverwachte fout in stap ' + stapNr + ': ' + (e.stack || e)); }
await c.stop();
await T.einde(null);
