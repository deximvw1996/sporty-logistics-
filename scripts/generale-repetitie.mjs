// generale-repetitie.mjs — GR1 (chat C): fictieve herfstplanning (2–8 nov 2026) uit de echte zomerdata, alles via de API.
//   node scripts/generale-repetitie.mjs --doel=lokaal             verse kopie van sporty.db uit de werkmap, eigen server (poort 3340)
//   node scripts/generale-repetitie.mjs --doel=lokaal --opruimen  zelfde serverkopie, verwijdert alles met "FICTIEF"
//   SPORTY_PROD_PW=… node scripts/generale-repetitie.mjs --doel=prod [--opruimen]   (enkel na keuring, door de hoofdchat)
// Alles wat dit script maakt draagt "FICTIEF" in naam of opmerking; --opruimen verwijdert enkel dat (en zet de vorige
// actieve periode terug). Idempotent: bestaat iets al met dezelfde FICTIEF-naam, dan wordt het hergebruikt.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as T from './_testhulp.mjs';

export const PROD_URL = 'https://sporty-logistics-production.up.railway.app';
export const POORT = 3340;
export const LINKS = path.join(T.ROOT, 'GENERALE-REPETITIE-links.json');
export const PERIODE = { naam: 'Herfst 2026 FICTIEF', start_datum: '2026-11-02', eind_datum: '2026-11-08' };
export const LEVERDAG = '2026-10-30', OPHAALDAG = '2026-11-06', WEEKENDDAG = '2026-11-07';
const F = 'FICTIEF';

// ── verbinding: zelfde helpers voor lokaal en prod (Basic + sessietoken) ──
export async function verbind(doel, { vers = true } = {}) {
  let base, pw, srv = null;
  if (doel === 'prod') {
    pw = process.env.SPORTY_PROD_PW;
    if (!pw) throw new Error('Zet eerst de omgevingsvariabele SPORTY_PROD_PW (het APP_PASSWORD van prod).');
    base = PROD_URL;
  } else {
    srv = await T.startServer({ poort: POORT, dbBron: path.join(T.ROOT, 'sporty.db'), verseMap: vers });
    base = srv.base; pw = T.APP_PASSWORD;
  }
  const basic = 'Basic ' + Buffer.from('sporty:' + pw).toString('base64');
  const kaal = async (m, p, b, tok) => {
    const r = await fetch(base + p, { method: m, headers: { authorization: basic, 'content-type': 'application/json', ...(tok ? { 'x-auth-token': tok } : {}) }, body: b ? JSON.stringify(b) : undefined });
    const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch {}
    return { status: r.status, json, text };
  };
  const lg = await kaal('POST', '/api/login', { persoon_id: 10, pincode: '1111' });
  if (lg.status !== 200) throw new Error(`Inloggen als persoon 10 mislukt (${lg.status}): ${lg.text.slice(0, 200)}`);
  const tok = lg.json.token;
  const A = (m, p, b) => kaal(m, p, b, tok);
  const P = (m, p, b) => kaal(m, p, b, null); // publieke token-links (rit/kv)
  const moet = async (m, p, b) => { const r = await A(m, p, b); if (r.status >= 400) throw new Error(`${m} ${p} → ${r.status}: ${r.text.slice(0, 300)}`); return r.json; };
  return { doel, base, srv, A, P, moet, tok, basic, stop: async () => { if (srv) await srv.stop(); } };
}

// Voorkeurnamen → bestaande locaties (exact, anders "bevat"); stockage idem.
const KAMPLOCS = ['Abdijschool Vlierbeek', 'Boutersem', 'Betekom', 'Rotselaar', 'Kraal', 'Waaier', 'Ark', 'Sportschuur'];
const STOCK = ['Rozenweg', 'Kantoor', 'Marko']; // de echte stockage heet Marko (GF1: geen 'Marco' aanmaken)
const KV_NAMEN = ['Lotte', 'Bram', 'Noor', 'Eva', 'Sam', 'Fien', 'Jonas', 'Lien'];
// Thema's: echte namen uit de zomerlijst; ontbreekt er een, dan het volgende thema van die leeftijdsgroep met bakken.
const KLEUTER = ['1001 Ballen en Bellen', 'De Bouwfabriek', 'De Speelfabriek', 'Welkom op de boerderij', 'We slaan in het rond'];
const LAGER = ['Slag- en balsporten', 'Play a game', 'Actie & Avontuur', 'Sportymadness'];
// Plan per locatie (index in KAMPLOCS): thema's [groep, index]; de laatste is de themadaglocatie.
const PLAN = [[['K', 0], ['L', 0]], [['K', 1]], [['L', 1]], [['K', 2]], [['L', 2], ['K', 3]], [['L', 3]], [['K', 4]], 'themadag'];

export async function opbouw(c, log = console.log) {
  const { A, moet } = c;
  const gevonden = [];
  const g = (stap, tekst) => { gevonden.push({ stap, tekst }); log(`  ⚠ GEVONDEN (${stap}): ${tekst}`); };
  // 1. periode
  const periodes = await moet('GET', '/api/periodes');
  const vorige = periodes.find((p) => p.actief && p.naam !== PERIODE.naam) || null;
  let per = periodes.find((p) => p.naam === PERIODE.naam) || await moet('POST', '/api/periodes', PERIODE);
  await moet('POST', `/api/periodes/${per.id}/activeer`);
  log(`periode "${per.naam}" (#${per.id}) actief${vorige ? `; vorige actieve: "${vorige.naam}" (#${vorige.id})` : ''}`);
  // 2. locaties
  const locs = await moet('GET', '/api/locaties');
  const zoek = (naam, type) => locs.find((l) => l.type === type && l.name === naam) || locs.find((l) => l.type === type && l.name.toLowerCase().includes(naam.toLowerCase()))
    || (naam === 'Marko' ? locs.find((l) => l.type === type && /^mar[ck]o$/i.test(l.name)) : null);
  const kamp = KAMPLOCS.map((n) => zoek(n, 'kamp')).filter(Boolean);
  if (kamp.length < 8) for (const l of locs.filter((l) => l.type === 'kamp' && !kamp.includes(l))) { if (kamp.length >= 8) break; kamp.push(l); }
  const stock = {};
  for (const n of STOCK) {
    let l = zoek(n, 'stockage');
    if (l && l.name !== n) g('punt 1 · stockage', `"${n}" bestaat niet; gebruikt "${l.name}" (zelfde plaats, andere schrijfwijze).`);
    if (!l) { g('punt 1 · stockage', `stockage "${n}" bestaat niet; aangemaakt als "${n} ${F}".`); l = await moet('POST', '/api/locaties', { name: `${n} ${F}`, type: 'stockage', addr: '' }); }
    stock[n] = l;
  }
  log(`locaties: ${kamp.map((l) => l.name).join(', ')} · stockage ${STOCK.map((n) => stock[n].name).join(', ')}`);
  // 3. personen
  let pers = await moet('GET', '/api/personeel');
  const kvs = pers.filter((p) => p.rol === 'kv' && !/FICTIEF/.test(p.naam)).slice(0, 8);
  for (const n of KV_NAMEN) {
    if (kvs.length >= 8) break;
    const naam = `${n} (${F})`;
    let p = pers.find((x) => x.naam === naam);
    if (!p) { p = await moet('POST', '/api/personeel', { naam, rol: 'kv', telefoon: '0470 00 00 ' + String(kvs.length).padStart(2, '0'), notities: F }); await moet('POST', `/api/personeel/${p.id}/pincode`, { pincode: '1111' }); }
    kvs.push(p);
  }
  pers = await moet('GET', '/api/personeel');
  const chauffeurs = pers.filter((p) => p.rol === 'chauffeur' && !/harnas/i.test(p.naam)).slice(0, 3);
  for (let i = chauffeurs.length; i < 3; i++) {
    const naam = `Chauffeur ${['Jan', 'Piet', 'Sam'][i]} ${F}`;
    let p = pers.find((x) => x.naam === naam) || await moet('POST', '/api/personeel', { naam, rol: 'chauffeur', telefoon: '', notities: F });
    chauffeurs.push(p);
  }
  const vt = await moet('GET', '/api/voertuig-types');
  for (const [naam, cap] of [['Camionette', 20], ['Camion', 40]]) if (!vt.some((v) => v.naam === naam)) { g('punt 1 · voertuigen', `voertuigtype ${naam} ontbrak; aangemaakt.`); await moet('POST', '/api/voertuig-types', { naam, capaciteit_bakken: cap, capaciteit_label: cap + ' bakken' }); }
  log(`KV's: ${kvs.map((p) => p.naam).join(', ')} · chauffeurs: ${chauffeurs.map((p) => p.naam).join(', ')}`);
  // 4. kampmomenten + thema's + kv-links
  const themas = await moet('GET', '/api/themas');
  const metBakken = new Set((await moet('GET', '/api/alle-bakken')).filter((t) => (t.bakken || []).length).map((t) => t.id));
  const gebruikt = new Set();
  const kiesThema = (namen, groep, cat, i) => {
    const pool = themas.filter((t) => t.leeftijdsgroep === groep && t.categorie === cat && metBakken.has(t.id) && !gebruikt.has(t.id));
    const t = (namen && pool.find((x) => x.name === namen[i])) || pool[0];
    if (t) gebruikt.add(t.id);
    return t;
  };
  const bestaand = (await moet('GET', '/api/kampmomenten')).filter((k) => k.periode_id === per.id);
  const kms = [];
  for (let i = 0; i < kamp.length; i++) {
    const loc = kamp[i], plan = PLAN[i], themadag = plan === 'themadag';
    let km = bestaand.find((k) => k.locatie_id === loc.id);
    if (!km) km = await moet('POST', '/api/kampmomenten', { locatie_id: loc.id, week: 1, periode_id: per.id, type: themadag ? 'themadag' : 'kamp', kv_persoon_id: kvs[i].id });
    const heeft = (km.themas || []).length;
    const gekozen = [];
    if (themadag) for (let d = 0; d < 5; d++) { const t = kiesThema(null, d % 2 ? 'kleuters' : 'lagere school', 'themadag', 0); if (t) { gekozen.push(t.name + ` (dag ${d})`); if (!heeft) await moet('POST', `/api/kampmomenten/${km.id}/themas`, { thema_id: t.id, dag: d }); } }
    else for (const [gr, j] of plan) { const t = kiesThema(gr === 'K' ? KLEUTER : LAGER, gr === 'K' ? 'kleuters' : 'lagere school', 'kamp', j); if (t) { gekozen.push(t.name); if (!heeft) await moet('POST', `/api/kampmomenten/${km.id}/themas`, { thema_id: t.id }); } }
    const kvl = await moet('POST', `/api/kampmomenten/${km.id}/kv-token`);
    kms.push({ id: km.id, locatie: loc.name, locatie_id: loc.id, type: themadag ? 'themadag' : 'kamp', themas: heeft ? (km.themas || []).map((t) => t.name) : gekozen, kv: kvs[i].naam, kv_id: kvs[i].id, kv_link: kvl.url, kv_token: kvl.token });
  }
  // GF1: kookdagen zijn per kampmoment (PL1): wo/do op de eerste 3 kamplocaties; de generator stuurt dan de oven mee.
  for (const k of kms.filter((x) => x.type === 'kamp').slice(0, 3)) await moet('PUT', `/api/kampmomenten/${k.id}/velden`, { kookdagen: ['wo', 'do'] });
  // 5. transport genereren + voorstellen aannemen (taken met FICTIEF in de opmerking)
  const kmIds = new Set(kms.map((k) => k.id));
  let taken = (await moet('GET', '/api/transport-taken')).filter((t) => kmIds.has(t.kampmoment_id));
  if (!taken.length) {
    const voorstellen = (await moet('POST', '/api/transport-genereer')).filter((v) => kmIds.has(v.kampmoment_id));
    for (const v of voorstellen) {
      const oph = v.type === 'ophaling';
      await moet('POST', '/api/transport-taken', { type: v.type, datum: v.datum, tijd: v.tijd, opmerking: `${F} · ${v.opmerking || v.type}`, kampmoment_id: v.kampmoment_id,
        van_locatie_id: oph ? v.locatie_id : v.van_locatie_id, naar_locatie_id: oph ? v.naar_locatie_id : v.locatie_id,
        regels: (v.materiaal || []).map((m) => ({ naam: m.naam, qty: m.qty, soort: m.soort, bak_id: m.bak_id, attribuut_id: m.attribuut_id })) });
    }
    taken = (await moet('GET', '/api/transport-taken')).filter((t) => kmIds.has(t.kampmoment_id));
  }
  const lev = taken.filter((t) => t.type === 'levering'), oph = taken.filter((t) => t.type === 'ophaling');
  const levDagen = [...new Set(lev.map((t) => t.datum))], ophDagen = [...new Set(oph.map((t) => t.datum))];
  log(`transport: ${lev.length} leveringen (${levDagen.join(', ')}), ${oph.length} ophalingen (${ophDagen.join(', ')})`);
  if (ophDagen.some((d) => d !== OPHAALDAG)) g('punt 1 · genereren', `de generator plant de ophalingen op ${ophDagen.join(', ')} (eerste werkdag ná het kamp), niet op vr ${OPHAALDAG}; de ophaalritten hieronder zetten ze op vrijdag.`);
  if (levDagen.some((d) => d !== LEVERDAG)) g('punt 1 · genereren', `leveringen staan op ${levDagen.join(', ')} i.p.v. vr ${LEVERDAG}.`);
  const geenTaak = kms.filter((k) => !lev.some((t) => t.kampmoment_id === k.id));
  if (geenTaak.length) g('punt 1 · genereren', `geen leveringsvoorstel voor ${geenTaak.map((k) => `${k.locatie} (${k.type})`).join(', ')} — de generator slaat themadag-kampmomenten over voor basis/thema-materiaal (bekend, zie commentaar in transport-genereer).`);
  // 6. ritten (RP1-velden); bestaan ze al (FICTIEF in opmerking), dan hergebruiken
  let ritten = (await moet('GET', '/api/ritten')).filter((r) => /FICTIEF/.test(r.opmerking || ''));
  if (!ritten.length) {
    const perLoc = [...new Set(lev.map((t) => t.naar_locatie_id))];
    const deel = (i) => lev.filter((t) => perLoc.indexOf(t.naar_locatie_id) % 3 === i).map((t) => t.id);
    const coordTaak = lev.filter((t) => perLoc.indexOf(t.naar_locatie_id) === perLoc.length - 1).map((t) => t.id);
    const rit = (body, ids, tijd0) => moet('POST', '/api/ritten', { datum: body.datum, opmerking: `${F} · ${body.titel}`, ...body.velden, taak_ids: ids }).then(async (r) => {
      for (let i = 0; i < ids.length; i++) await moet('PUT', `/api/transport-taken/${ids[i]}/move`, { tijd: `${String(tijd0 + Math.floor(i * 3 / 4)).padStart(2, '0')}:${['00', '45', '30', '15'][i % 4]}` });
      if (ids.length > 1) await moet('PUT', `/api/transport-taken/${ids[ids.length - 1]}`, { slot: 'vrij' });
      return r;
    });
    const zonderCoord = (ids) => ids.filter((id) => !coordTaak.includes(id));
    await rit({ datum: LEVERDAG, titel: 'levering 1', velden: { personeel_id: chauffeurs[0].id, voertuig: 'Camionette', vertrek: '07:30' } }, zonderCoord(deel(0)), 8);
    await rit({ datum: LEVERDAG, titel: 'levering 2', velden: { personeel_id: chauffeurs[1].id, voertuig: 'Camion', vertrek: '07:30' } }, zonderCoord(deel(1)), 8);
    await rit({ datum: LEVERDAG, titel: 'levering 3', velden: { personeel_id: chauffeurs[2].id, voertuig: 'Camionette', vertrek: '08:00' } }, zonderCoord(deel(2)), 9);
    await rit({ datum: LEVERDAG, titel: 'levering coördinator', velden: { personeel_id: kvs[0].id, voertuig: 'Huurwagen', voertuig_soort: 'huur', voertuig_capaciteit: 15, vertrek: '09:00' } }, coordTaak, 10);
    const ophIds = oph.map((t) => t.id);
    await rit({ datum: OPHAALDAG, titel: 'ophaling 1', velden: { personeel_id: chauffeurs[0].id, voertuig: 'Camion', vertrek: '13:00' } }, ophIds.filter((_, i) => i % 2 === 0), 14);
    await rit({ datum: OPHAALDAG, titel: 'ophaling 2', velden: { personeel_id: chauffeurs[1].id, voertuig: 'Camion', vertrek: '13:30' } }, ophIds.filter((_, i) => i % 2 === 1), 14);
    ritten = (await moet('GET', '/api/ritten')).filter((r) => /FICTIEF/.test(r.opmerking || ''));
  }
  // weekendtaak (sportdag za 7 nov, zonder rit: kantoor bevestigt en plant ze in stap 7 van de ketentest)
  const sportschuur = kamp[7];
  if (!(await moet('GET', '/api/transport-taken')).some((t) => /FICTIEF · Sportdag/.test(t.opmerking || ''))) {
    await moet('POST', '/api/transport-taken', { type: 'transfer', datum: WEEKENDDAG, tijd: '09:00', opmerking: `${F} · Sportdag za 7 nov: 3 springkastelen`, van_locatie_id: stock.Rozenweg.id, naar_locatie_id: sportschuur.id, regels: [{ naam: 'Springkasteel', qty: 3, soort: 'attribuut' }] });
  }
  // 7. klaarzetten + rit-links
  const ritOut = [];
  for (const r of ritten) {
    await moet('POST', `/api/ritten/${r.id}/klaarzet`, {});
    const t = await moet('POST', `/api/ritten/${r.id}/token`);
    const info = (await moet('GET', `/api/ritten?week=${r.datum}`)).find((x) => x.id === r.id);
    ritOut.push({ id: r.id, titel: r.opmerking, datum: r.datum, vertrek: info.vertrek, chauffeur: info.chauffeur, voertuig: info.voertuig, capaciteit: info.voertuig_capaciteit,
      bezetting: info.bezetting, waarschuwingen: info.waarschuwingen, stops: info.taken.map((x) => `${x.tijd} ${x.slot === 'vrij' ? '◌' : '🔒'} #${x.id}`), rit_link: t.url, rit_token: t.token });
  }
  const vandaag = (await moet('GET', '/api/vandaag?datum=2026-11-02'));
  const overzicht = {
    doel: c.doel, base: c.base, gemaakt_op: new Date().toISOString(),
    periode: { id: per.id, naam: per.naam }, vorige_actieve_periode: vorige ? { id: vorige.id, naam: vorige.naam } : null,
    stockage: Object.fromEntries(STOCK.map((n) => [n, { id: stock[n].id, naam: stock[n].name }])),
    chauffeurs: chauffeurs.map((p) => ({ id: p.id, naam: p.naam })), kampmomenten: kms, ritten: ritOut,
    vandaag_2_nov: { beslissen: vandaag.beslissen.length, inplannen: vandaag.inplannen.length, nakijken: vandaag.nakijken.length, ritten_vandaag: vandaag.ritten_vandaag.length, deze_week: vandaag.deze_week.length, cijfers: vandaag.cijfers },
    gevonden,
  };
  fs.writeFileSync(LINKS, JSON.stringify(overzicht, null, 2));
  return overzicht;
}

// ── opruimen: alleen wat FICTIEF is, via de API ──
export async function opruimen(c, log = console.log) {
  const { A, moet } = c;
  const verslag = { verwijderd: {}, niet_mogelijk: [] };
  const tel = (k, n = 1) => { verslag.verwijderd[k] = (verslag.verwijderd[k] || 0) + n; };
  const meta = fs.existsSync(LINKS) ? JSON.parse(fs.readFileSync(LINKS, 'utf8')) : null;
  const periodes = await moet('GET', '/api/periodes');
  const per = periodes.find((p) => p.naam === PERIODE.naam);
  const kms = per ? (await moet('GET', '/api/kampmomenten')).filter((k) => k.periode_id === per.id) : [];
  const kmIds = new Set(kms.map((k) => k.id));
  // taken: van FICTIEF-kampmomenten, met FICTIEF in de opmerking, of rest/afgesplitst/spoed daarvan
  const alleTaken = await moet('GET', '/api/transport-taken');
  const ritten = (await moet('GET', '/api/ritten')).filter((r) => /FICTIEF/.test(r.opmerking || ''));
  const ritIds = new Set(ritten.map((r) => r.id));
  const fictTaken = alleTaken.filter((t) => kmIds.has(t.kampmoment_id) || /FICTIEF/.test(t.opmerking || '') || ritIds.has(t.rit_id) || (t.rest_van_rit_id && ritIds.has(t.rest_van_rit_id)));
  for (const t of fictTaken) {
    const r = await A('POST', '/api/transport-taken/bulk-delete', { ids: [t.id] });
    if (r.status === 200) tel('transport_taken'); else verslag.niet_mogelijk.push(`taak #${t.id}: ${r.status} ${r.json?.error || ''}`);
  }
  for (const r of await moet('GET', '/api/ritten')) {
    if (!ritIds.has(r.id) && !(r.opmerking || '').match(/aanvraag #/)) continue;
    if ((r.opmerking || '').match(/aanvraag #/) && r.taken.length) continue; // spoedrit met nog taken van iets anders
    if ((r.opmerking || '').match(/aanvraag #/) && !ritIds.has(r.id)) { const a = (r.opmerking.match(/aanvraag #(\d+)/) || [])[1]; if (!a) continue; }
    const d = await A('DELETE', `/api/ritten/${r.id}`); if (d.status === 200) tel('transport_ritten');
  }
  // GF1: volledig verwijderen — ook tellingen, aanvragen, checks en kalenderdagen van het kampmoment gaan mee.
  for (const k of kms) { const d = await A('POST', `/api/kampmomenten/${k.id}/volledig-verwijderen`); if (d.status === 200) tel('kampmomenten'); else verslag.niet_mogelijk.push(`kampmoment #${k.id}: ${d.status} ${d.json?.error || ''}`); }
  if (per) {
    const terug = meta?.vorige_actieve_periode?.id || periodes.find((p) => p.id !== per.id)?.id;
    if (terug) await A('POST', `/api/periodes/${terug}/activeer`);
    const d = await A('DELETE', `/api/periodes/${per.id}`); if (d.status === 200) tel('vakantieperiodes'); else verslag.niet_mogelijk.push(`periode #${per.id}: ${d.status} ${d.json?.error || ''}`);
  }
  for (const p of (await moet('GET', '/api/personeel')).filter((p) => /FICTIEF/.test(p.naam))) { const d = await A('DELETE', `/api/personeel/${p.id}`); if (d.status === 200) tel('personeel'); }
  for (const l of (await moet('GET', '/api/locaties')).filter((l) => /FICTIEF/.test(l.name))) { const d = await A('DELETE', `/api/locaties/${l.id}`); if (d.status === 200) tel('locaties'); }
  verslag.niet_via_api = []; // GF1: alles gaat via de API (logtabellen wijzigingen en activiteiten_log blijven bewust staan)
  log(`opgeruimd: ${JSON.stringify(verslag.verwijderd)}${verslag.niet_mogelijk.length ? ' · niet gelukt: ' + verslag.niet_mogelijk.join('; ') : ''}`);
  return verslag;
}

// ── uitvoeren vanaf de commandolijn ──
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').split('=')[1];
  const doel = arg('doel'), ruim = process.argv.includes('--opruimen');
  if (!['lokaal', 'prod'].includes(doel)) { console.error('Gebruik: node scripts/generale-repetitie.mjs --doel=lokaal|prod [--opruimen]'); process.exit(2); }
  const c = await verbind(doel, { vers: !ruim });
  try {
    if (ruim) await opruimen(c);
    else {
      const o = await opbouw(c);
      console.log('\n══ OVERZICHT ══');
      for (const k of o.kampmomenten) console.log(`  ${k.locatie.padEnd(24)} ${k.type.padEnd(8)} ${k.themas.join(' + ').slice(0, 70).padEnd(70)} KV ${k.kv}  ${c.base}${k.kv_link}`);
      for (const r of o.ritten) console.log(`  rit #${r.id} ${r.datum} ${r.vertrek} ${String(r.chauffeur).padEnd(22)} ${String(r.voertuig).padEnd(11)} ${r.bezetting}/${r.capaciteit ?? '?'} ${r.stops.length} stops ${r.waarschuwingen.length ? '⚠ ' + r.waarschuwingen.join('; ') : ''}  ${c.base}${r.rit_link}`);
      console.log(`  Vandaag 2 nov: ${JSON.stringify(o.vandaag_2_nov)}`);
      console.log(`  bewaard in ${LINKS}`);
    }
  } finally { await c.stop(); }
}
