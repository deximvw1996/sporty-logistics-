// test-tf1-keten.mjs — TF1 (chat C): fixes uit testverslag T1 (G5, G6, G8, G9, G10, G12, G13, G14, G16).
// Per punt minstens één controle die vóór de fix rood was. Eigen server via _testhulp (poort 3341, herfst-test.db);
// de HTML-bouwers van public/kv.js, public/rit.js worden met de echte data-JSON aangeroepen.
import * as T from './_testhulp.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const POORT = parseInt(process.env.TEST_POORT || '3341');
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: POORT });
const BASIC = 'Basic ' + Buffer.from('sporty:' + T.APP_PASSWORD).toString('base64');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const tekst = (h) => h.replace(/<[^>]+>/g, '\n').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\n\s*\n+/g, '\n').trim().split('\n').join(' | ');
let initSqlJs; try { initSqlJs = require('sql.js'); } catch { initSqlJs = require(T.ROOT + '/../sporty-railway/node_modules/sql.js'); }
const SQL = await initSqlJs();
let tok;
async function db(sql, params = []) {
  const r = await fetch(srv.base + '/api/backup-db', { headers: { authorization: BASIC, 'x-auth-token': tok } });
  const d = new SQL.Database(Buffer.from(await r.arrayBuffer()));
  const st = d.prepare(sql); st.bind(params); const rows = []; while (st.step()) rows.push(st.getAsObject()); st.free(); d.close(); return rows;
}
try {
  tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const P = (m, p, b) => T.api(srv.base, null, m, p, b);
  const R = ijk.locaties.rozenweg, AB = ijk.locaties.abdijschool, BE = ijk.locaties.betekom, kmAB = ijk.kampmomenten.abdijschool, kmBE = ijk.kampmomenten.betekom;
  const KP = require(T.ROOT + '/public/kv.js'), RP = require(T.ROOT + '/public/rit.js');
  const bakN20 = (await A('GET', '/api/alle-bakken')).json.flatMap((t) => t.bakken || []).find((b) => b.code === 'N20');

  // ── G5: spoedrit zonder chauffeur ──
  const aanv = (await A('POST', '/api/aanvragen', { kampmoment_id: kmBE, soort: 'kapot', tekst: 'oven kapot' })).json.id;
  const g = (await A('PUT', `/api/aanvragen/${aanv}/status`, { status: 'goedgekeurd', maak_spoedtransport: true })).json;
  const spoedTaak = (await A('GET', '/api/transport-taken')).json.find((t) => t.id === g.spoed_taak_id);
  const spoedRit = spoedTaak.rit_id;
  let wk = (await A('GET', `/api/ritten?week=${spoedTaak.datum}`)).json.find((x) => x.id === spoedRit);
  T.check(wk.waarschuwingen.includes('geen chauffeur') && wk.waarschuwingen.includes('geen voertuig'), `G5 spoedrit #${spoedRit} (${spoedTaak.datum}): waarschuwingen ${JSON.stringify(wk.waarschuwingen)}`);
  const rpS = (await A('GET', `/api/ritplanning?week=${spoedTaak.datum}`)).json.dagen.flatMap((d) => d.ritten).find((x) => x.id === spoedRit);
  T.check(rpS.waarschuwingen.includes('geen chauffeur'), 'G5 ritplanning toont "geen chauffeur"');
  let v = (await A('GET', `/api/vandaag?datum=${spoedTaak.datum}`)).json;
  T.check(v.inplannen.some((i) => i.rit_id === spoedRit && i.titel === `Rit #${spoedRit} heeft nog geen chauffeur`), `G5 Vandaag › Inplannen: "${v.inplannen.find((i) => i.rit_id === spoedRit)?.titel}"`);
  const sp1 = (await A('POST', '/api/spoedtransport', { item: 'pionnen', qty: 3, datum: '2026-11-04', van_locatie_id: R, naar_locatie_id: AB })).json;
  const sp2 = (await A('POST', '/api/spoedtransport', { item: 'ballen', qty: 2, datum: '2026-11-04', van_locatie_id: R, naar_locatie_id: AB, personeel_id: 2, voertuig: 'Camionette' })).json;
  const rs = await db('SELECT id,chauffeur,personeel_id,voertuig FROM transport_ritten WHERE id IN (?,?)', [sp1.rit_id, sp2.rit_id]);
  const al = await db("SELECT beschrijving FROM activiteiten_log WHERE actie='spoedrit zonder chauffeur'");
  T.check(rs.find((r) => r.id === sp2.rit_id).chauffeur === 'Jeroen' && rs.find((r) => r.id === sp1.rit_id).chauffeur === '' && al.some((a) => a.beschrijving.includes(`#${sp1.rit_id}`)) && !al.some((a) => a.beschrijving.includes(`#${sp2.rit_id} `)),
    `G5 spoedroute: met chauffeur → "Jeroen"; zonder → leeg + log "${al.find((a) => a.beschrijving.includes('#' + sp1.rit_id))?.beschrijving}"`);

  // ── G6: stoptijden volgen het vertrek ──
  const mk = async (naar, tijd, extra = {}) => (await A('POST', '/api/transport-taken', { type: 'levering', datum: '2026-10-30', tijd, van_locatie_id: R, naar_locatie_id: naar, regels: [{ naam: 'Croquet doelen', qty: 1, soort: 'attribuut', attribuut_id: 4 }], ...extra })).json.id;
  const rest = await mk(AB, '08:45', { opmerking: 'Rest van rit #1: past niet' });
  let r = await A('POST', '/api/ritten', { datum: '2026-10-30', vertrek: '15:00', personeel_id: 3, voertuig: 'Camionette', taak_ids: [rest] });
  const rit15 = r.json;
  T.check(rit15.taken[0].tijd === '15:00', `G6 rit 15:00 met rest-taak (was 08:45) → stop ${rit15.taken[0].tijd}`);
  const t1 = await mk(AB, '09:00'), t2 = await mk(BE, ''), t3 = await mk(AB, '17:30');
  r = await A('POST', '/api/ritten', { datum: '2026-10-30', vertrek: '13:00', personeel_id: 1, voertuig: 'Camion', taak_ids: [t1, t2, t3] });
  T.check(r.json.taken.map((x) => x.tijd).join(',') === '13:00,13:45,17:30', `G6 drie stops vanaf 13:00: ${r.json.taken.map((x) => x.tijd).join(', ')} (latere 17:30 blijft)`);
  const t4 = await mk(BE, '07:00');
  await A('PUT', `/api/transport-taken/${t4}/rit`, { rit_id: rit15.id });
  const na = (await A('GET', `/api/ritten/${rit15.id}`)).json.taken;
  T.check(na.map((x) => x.tijd).join(',') === '15:00,15:45', `G6 "→ aan rit" (PUT /:id/rit): ${na.map((x) => x.tijd).join(', ')}`);
  v = (await A('GET', '/api/vandaag?datum=2026-10-30')).json;
  const rpV = (await A('GET', '/api/ritplanning?week=2026-10-30')).json.dagen.find((d) => d.datum === '2026-10-30').ritten.find((x) => x.id === rit15.id);
  T.check(v.ritten_vandaag.find((x) => x.id === rit15.id)?.tijd === '15:00' && rpV.vertrek === '15:00' && rpV.stops[0].tijd === '15:00', 'G6 Vandaag en Ritplanning tonen hetzelfde uur (15:00)');

  // ── G8 + G9: herinnering van kantoor ──
  await A('POST', `/api/kampmomenten/${kmAB}/themas`, { thema_id: 4082 });
  const kvtok = await T.kvToken(srv.base, tok, kmAB);
  r = await A('POST', '/api/nakijken/herinnering', { kampmoment_id: kmAB });
  v = (await A('GET', '/api/vandaag?datum=2026-11-02')).json;
  T.check(r.status === 200 && !v.beslissen.some((b) => b.id === r.json.id) && !v.beslissen.some((b) => /Kantoor vraagt je/.test(b.titel)), 'G8 herinnering staat niet in Vandaag › Beslissen');
  let kd = (await P('GET', `/api/kv/${kvtok}/data`)).json;
  const ov = tekst(KP.overzichtHtml(kd));
  T.check(kd.meldingen_kantoor.length === 1 && ov.includes('Bericht van kantoor: Kantoor vraagt je de bakken van Abdijschool Vlierbeek'), `G9 KV-overzicht: "${ov.match(/Aanvragen[^|]*\| [^|]*/)?.[0]}"`);

  // ── G10: levering nog niet aangekomen / ophaling van niet-geleverde stukken ──
  const lev = (await A('POST', '/api/transport-taken', { type: 'levering', datum: '2026-10-30', van_locatie_id: R, naar_locatie_id: AB, kampmoment_id: kmAB, regels: [{ naam: 'Bak N20', qty: 1, soort: 'thema', bak_id: bakN20.id }] })).json.id;
  kd = (await P('GET', `/api/kv/${kvtok}/data`)).json;
  const tel = tekst(KP.tellenHtml(kd, false));
  T.check(kd.levering && kd.levering.status === 'gepland' && tel.includes('Levering nog niet aangekomen: tel pas als alles er staat'), `G10 KV: levering.status "${kd.levering?.status}" → waarschuwing boven Tellen`);
  const oph = (await A('POST', '/api/transport-taken', { type: 'ophaling', datum: '2026-11-06', van_locatie_id: AB, naar_locatie_id: R, kampmoment_id: kmAB, regels: [{ naam: 'Bak N20', qty: 1, soort: 'thema', bak_id: bakN20.id }] })).json.id;
  const ophRit = (await A('POST', '/api/ritten', { datum: '2026-11-06', vertrek: '14:00', personeel_id: 2, voertuig: 'Camion', taak_ids: [oph] })).json.id;
  const otok = await T.ritToken(srv.base, tok, ophRit);
  const rd = (await P('GET', `/api/rit-token/${otok}/data`)).json;
  const regel = rd.stops[0].regels[0];
  T.check(regel.geleverd === false, `G10 rit-data ophaalstop: N20 geleverd=${regel.geleverd} (staat nog in de Rozenweg)`);
  T.check(tekst(RP.stopHtml(rd, oph)).includes('niet geleverd'), 'G10 rit-pagina toont de pil "niet geleverd"');
  r = await P('POST', `/api/rit-token/${otok}/checks/${regel.check_id}/laden`);
  T.check(r.status === 200, 'G10 laden blijft mogelijk (geen verbod)');

  // ── G16: rit-link-actie heeft een naam in het logboek ──
  const w = await db("SELECT persoon_naam,persoon_id,context FROM wijzigingen WHERE context='rit-link' ORDER BY id DESC LIMIT 1");
  T.check(w[0] && w[0].persoon_naam === 'Jeroen' && w[0].persoon_id === 2, `G16 rit-link-actie: persoon_naam "${w[0]?.persoon_naam}", persoon_id ${w[0]?.persoon_id}`);
  await P('POST', `/api/kv/${kvtok}/aanvraag`, { tekst: 'tape', aantal: 2 });
  const wk2 = await db("SELECT persoon_naam FROM wijzigingen WHERE context='kv-link' ORDER BY id DESC LIMIT 1");
  T.check(wk2.length === 1 && / \(KV\)$/.test(wk2[0].persoon_naam), `G16 KV-acties blijven "<naam> (KV)" ("${wk2[0]?.persoon_naam || '—'}")`);

  // ── G12: capaciteit ──
  const zwaar = (await A('POST', '/api/transport-taken', { type: 'levering', datum: '2026-10-29', tijd: '09:00', van_locatie_id: R, naar_locatie_id: BE, regels: [{ naam: 'Vaste bak sport', qty: 25, soort: 'vast' }] })).json.id;
  const zRit = (await A('POST', '/api/ritten', { datum: '2026-10-29', vertrek: '08:00', personeel_id: 1, voertuig: 'Camionette', taak_ids: [zwaar] })).json.id;
  wk = (await A('GET', '/api/ritten?week=2026-10-29')).json.find((x) => x.id === zRit);
  T.check(!wk.waarschuwingen.some((x) => /plaatsen/.test(x)), 'TF7: geen capaciteitswaarschuwing meer');
  r = await A('POST', `/api/ritten/${zRit}/klaarzet`, {});
  T.check(r.status === 200 && r.json.over_capaciteit === undefined, 'TF7: klaarzetten zonder berekening');
  const ztok = await T.ritToken(srv.base, tok, zRit);
  const zd = (await P('GET', `/api/rit-token/${ztok}/data`)).json;
  for (const s of zd.stops) { for (const g2 of s.regels) await P('POST', `/api/rit-token/${ztok}/checks/${g2.check_id}/laden`); await P('POST', `/api/rit-token/${ztok}/taken/${s.taak_id}/aangekomen`); for (const g2 of s.regels) await P('POST', `/api/rit-token/${ztok}/checks/${g2.check_id}/lossen`); }
  wk = (await A('GET', '/api/ritten?week=2026-10-29')).json.find((x) => x.id === zRit);
  const zp = (await A('GET', '/api/ritplanning?week=2026-10-29')).json.dagen.flatMap((d) => d.ritten).find((x) => x.id === zRit);
  T.check(wk.status === 'gedaan' && !wk.waarschuwingen.some((x) => /bakken op/.test(x)) && !zp.notitie, 'TF7: gedane rit zonder capaciteitsnotitie');
  const rpJs = require('node:fs').readFileSync(T.ROOT + '/public/ritplanning.js', 'utf8');
  T.check(!/capaciteit klaarzetten|bevestigd_over_capaciteit/.test(rpJs), 'TF7: ritplanning vraagt geen bevestiging meer');

  // ── G13: stuks i.p.v. regels; KV-lijst toont alle afwijkingen ──
  kd = (await P('GET', `/api/kv/${kvtok}/data`)).json;
  const kb = kd.bakken.find((b) => b.code === 'N20');
  const [i0, i1, i2] = kb.items;
  r = await P('POST', `/api/kv/${kvtok}/bakken/${kb.id}/tellen`, { regels: [
    { item_id: i0.id, aangetroffen: i0.gewenst, kapot_aantal: 1, foto_data: PNG },
    { item_id: i1.id, aangetroffen: i1.gewenst + 2 },
    { item_id: i2.id, aangetroffen: i2.gewenst - 3 }] });
  await P('POST', `/api/kv/${kvtok}/versturen`);
  const nk = (await A('GET', '/api/nakijken?week=2026-11-02')).json.bakken.find((b) => b.bak.code === 'N20' && b.kampmoment_id === kmAB);
  T.check(/tekort 3/.test(nk.uitslag_tekst) && /te veel 2/.test(nk.uitslag_tekst) && /kapot 1/.test(nk.uitslag_tekst), `G13 uitslag telt stuks: "${nk.uitslag_tekst}"`);
  r = await P('POST', `/api/kv/${kvtok}/bakken/${kb.id}/tellen`, { regels: [{ item_id: i1.id, aangetroffen: i1.gewenst + 2, kapot_aantal: 1 }] });
  kd = (await P('GET', `/api/kv/${kvtok}/data`)).json;
  const bh = tekst(KP.bakHtml(kd, kb.id, { open: null }));
  T.check(bh.includes('kapot 1 · te veel 2'), `G13 KV-lijst toont kapot én te veel op hetzelfde stuk ("${bh.match(/kapot 1 · te veel 2/)?.[0]}")`);

  // ── G14: actie zonder aantal → afwijkingsaantal ──
  const det = (await A('GET', `/api/nakijken/sessie/${nk.sessie_id}`)).json;
  const regels = det.items || det.regels || [];
  const rT = regels.find((x) => (x.naam || x.item_naam) === i2.naam), rV = regels.find((x) => (x.naam || x.item_naam) === i0.naam);
  const idT = rT.regel_id || rT.id, idK = rV.regel_id || rV.id;
  r = await A('PUT', `/api/nakijken/regel/${idT}`, { kantoor_actie: 'bestellen' });
  const r2 = await A('PUT', `/api/nakijken/regel/${idK}`, { kantoor_actie: 'afschrijven_bestellen' });
  T.check(r.json.kantoor_aantal === 3 && r2.json.kantoor_aantal === 1, `G14 zonder aantal: tekort → ${r.json.kantoor_aantal}, kapot → ${r2.json.kantoor_aantal} (was 0)`);
  r = await A('PUT', `/api/nakijken/regel/${idT}`, { kantoor_actie: 'bestellen', kantoor_aantal: 2 });
  T.check(r.json.kantoor_aantal === 2, 'G14 een meegegeven aantal blijft gelden');
} catch (e) { T.fout('onverwachte fout: ' + (e.stack || e)); }
await T.einde(srv);
