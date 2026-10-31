// test-tf7-voertuigen.mjs — TF7 punt 4: echte voertuigen en aanhangwagens. Migratie op een kopie van herfst-test.db, twee keer starten, waarschuwingen.
import * as T from './_testhulp.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const RP = require(T.ROOT + '/public/rit.js');
const ijk = T.leesIjk();
const POORT = Number(process.env.TEST_POORT) || 3377;
let srv = await T.startServer({ poort: POORT });
try {
  let tok = await T.login(srv.base);
  let A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const iso = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const db = (q, p) => T.leesDb(srv.dbPad, q, p);
  const wacht = () => new Promise((r) => setTimeout(r, 700));
  await wacht();
  const v = await db('SELECT * FROM voertuigen');
  const naam = (n) => v.find((x) => x.naam === n);
  T.check(['Camion met laadklep', 'Camionette', 'Citroën Jumpy (2010)', 'Citroën Berlingo grijs', 'Citroën Berlingo rood'].every(naam), 'vijf voertuigen toegevoegd');
  T.check([1, 2, 3, 4].every((i) => naam('Aanhangwagen ' + i)?.aard === 'aanhangwagen' && naam('Aanhangwagen ' + i).notitie === 'gesloten'), 'vier gesloten aanhangwagens');
  const cam = naam('Camion met laadklep'), jump = naam('Camionette');
  T.check(cam.trekhaak === 0 && cam.laadklep === 1 && cam.rijbewijs === 'B' && cam.notitie === 'Peugeot Boxer bakwagen', 'Camion: geen trekhaak, laadklep, rijbewijs B, Boxer');
  T.check(jump.trekhaak === 1 && jump.notitie === 'Citroën Jumper' && naam('Citroën Berlingo rood').trekhaak === 1, 'trekhaak volgens de lijst');
  T.check(v.filter((x) => x.created_at && (x.aard === 'aanhangwagen' || x.naam === 'Camionette')).every((x) => x.plaatsen == null && !x.nummerplaat), 'plaatsen en nummerplaat leeg');
  const rz = ijk.locaties.rozenweg;
  T.check(cam.standplaats_locatie_id === rz, 'standplaats Rozenweg');
  const oud = v.filter((x) => /^(Camion|Camionette) \d+$/.test(x.naam));
  T.check(oud.length > 0, `oude voorbeeldvoertuigen bestaan nog: ${oud.map((x) => x.naam + ':' + x.actief)}`);
  const oudRit = (await db("SELECT r.id,r.voertuig,r.voertuig_id FROM transport_ritten r WHERE r.voertuig_id IS NOT NULL LIMIT 1"))[0];
  if (oudRit) { const kop = oud.find((x) => x.id === oudRit.voertuig_id); T.check(!!kop && oudRit.voertuig !== '', `oude rit #${oudRit.id} houdt ${oudRit.voertuig}`); }
  else T.info('testdb heeft geen oude rit met voertuig_id');
  const lg = await db("SELECT COUNT(*) AS n FROM activiteiten_log WHERE beschrijving LIKE '%migratie 93%'");
  T.check(lg[0].n >= 9, `migratie gelogd (${lg[0].n})`);

  // Tweede start
  const n0 = (await db('SELECT COUNT(*) AS n FROM voertuigen'))[0].n;
  await srv.stop();
  srv = await T.startServer({ poort: POORT, verseMap: false });
  tok = await T.login(srv.base); A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  T.check((await T.leesDb(srv.dbPad, 'SELECT COUNT(*) AS n FROM voertuigen'))[0].n === n0, 'twee keer starten: niets dubbel');

  // Overzicht
  const dag = iso(1);
  const ov = (await A('GET', `/api/voertuigen-overzicht?week=${dag}`)).json;
  T.check(ov.voertuigen.every((x) => x.aard !== 'aanhangwagen') && ov.aanhangwagens.length === 4 && /geen trekhaak/.test(ov.voertuigen.find((x) => x.id === cam.id).sub) && /laadklep/.test(ov.voertuigen.find((x) => x.id === cam.id).sub), 'pagina: aparte blokken met trekhaak en laadklep');
  const a1 = naam('Aanhangwagen 1').id;
  T.check((await A('PUT', `/api/voertuigen/${jump.id}`, { rijbewijs: 'B' })).status === 200, 'te bewerken');

  // Waarschuwingen
  const R = rz, AB = (await A('GET', '/api/locaties')).json.find((l) => /abdij/i.test(l.name)).id;
  const r1 = (await A('POST', '/api/ritten', { datum: dag, vertrek: '09:00', voertuig_id: cam.id, aanhangwagen_id: a1, chauffeur: 'x' })).json;
  await A('POST', '/api/transport-taken', { type: 'levering', datum: dag, tijd: '09:30', van_locatie_id: R, naar_locatie_id: AB, rit_id: r1.id, regels: [{ naam: 'Doos', qty: 3 }] });
  const w = async (id) => (await A('GET', `/api/ritplanning?week=${dag}`)).json.dagen.flatMap((d) => d.ritten).find((x) => x.id === id);
  let p = await w(r1.id);
  T.check(p.aanhangwagen_id === a1 && p.waarschuwingen.some((x) => /Camion met laadklep heeft geen trekhaak/.test(x)), `camion + aanhangwagen: ${p.waarschuwingen}`);
  T.check((await A('PUT', `/api/ritten/${r1.id}`, { voertuig_id: jump.id })).status === 200, 'geen verbod; wisselen naar Camionette');
  p = await w(r1.id);
  T.check(!p.waarschuwingen.some((x) => /trekhaak/.test(x)), 'waarschuwing verdwijnt na wissel');
  const r2 = (await A('POST', '/api/ritten', { datum: dag, vertrek: '15:00', voertuig_id: naam('Citroën Jumpy (2010)').id, aanhangwagen_id: a1, chauffeur: 'y' })).json;
  p = await w(r2.id);
  T.check(p.waarschuwingen.some((x) => x.includes(`aanhangwagen dubbel: Aanhangwagen 1 ook op rit #${r1.id}`)), 'dubbel gepland op dezelfde dag, ook op een ander uur');
  const det = (await A('GET', `/api/voertuigen/${a1}/detail?week=${dag}`)).json;
  T.check(det.week.dagen.find((d) => d.datum === dag).status === 'dubbel', 'weekstrook werkt voor een aanhangwagen');
  await A('PUT', `/api/ritten/${r2.id}`, { aanhangwagen_id: naam('Aanhangwagen 2').id });
  p = await w(r2.id);
  T.check(!p.waarschuwingen.some((x) => /dubbel/.test(x)), 'dubbel verdwijnt na oplossen');
  const on = await A('POST', `/api/voertuigen/${naam('Aanhangwagen 2').id}/onderhoud`, { datum_van: dag, datum_tot: dag, reden: 'band' });
  p = await w(r2.id);
  T.check(on.status === 200 && p.waarschuwingen.some((x) => /aanhangwagen in onderhoud/.test(x)), 'onderhoud van een aanhangwagen');
  await A('DELETE', `/api/voertuigen/${naam('Aanhangwagen 2').id}/onderhoud/${on.json.id}`);
  T.check(!(await w(r2.id)).waarschuwingen.some((x) => /onderhoud/.test(x)), 'verdwijnt na oplossen');
  T.check((await A('PUT', `/api/ritten/${r2.id}`, { voertuig_id: a1 })).status === 400, 'een aanhangwagen is geen voertuig');
  T.check((await A('PUT', `/api/ritten/${r2.id}`, { aanhangwagen_id: jump.id })).status === 400, 'een voertuig is geen aanhangwagen');
  T.check((await w(r1.id)).lading.tekst === '0 bakken + 3 losse stuks', 'telling blijft');
  // Chauffeur
  await A('POST', `/api/ritten/${r1.id}/klaarzet`, {});
  const tk = (await A('POST', `/api/ritten/${r1.id}/token`)).json.token, dt = (await T.api(srv.base, null, 'GET', `/api/rit-token/${tk}/data`)).json;
  T.check(dt.rit.aanhangwagen === 'Aanhangwagen 1' && /met Aanhangwagen 1/.test(RP.dagHtml(dt)) && /met Aanhangwagen 1/.test(RP.stopHtml(dt, dt.stops[0].taak_id)), 'ritscherm toont welke aanhangwagen mee moet');
  await A('PUT', `/api/ritten/${r1.id}`, { aanhangwagen_id: null });
  T.check(!(await w(r1.id)).aanhangwagen_id, 'aanhangwagen is optioneel');
} catch (e) { T.fout('uitzondering: ' + e.message + ' ' + e.stack); console.log(srv.log().slice(-1200)); }
await T.einde(srv);
