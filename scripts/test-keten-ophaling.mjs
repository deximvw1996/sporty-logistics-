// test-keten-ophaling.mjs — bewaakt WERKLIJST 15 · T-G6.
// Gewenst (DRAAIBOEK 3.5/4.1): de chauffeur opent de rit-link van een ophaalrit en ziet per stop
// meteen de bakkenlijst met codes — zonder dat iemand op kantoor eerst "Klaarzetten" (checks/init) deed.
import * as T from './_testhulp.mjs';
import { ritTekst } from './_rit-render.mjs';
const POORT = parseInt(process.env.TEST_POORT || '3322');
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: POORT });
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const kmId = ijk.kampmomenten.betekom;
  const chauffeur = { id: ijk.personen.chauffeur, naam: 'Test Chauffeur harnas' };

  const gen = (await A('POST', '/api/transport-genereer')).json || [];
  const lev = gen.find((x) => x.kampmoment_id === kmId && x.type === 'levering');
  const oph = gen.find((x) => x.kampmoment_id === kmId && x.type === 'ophaling');
  T.check(!!lev && !!oph, `generator geeft levering én ophaling voor km ${kmId}`);
  if (!lev || !oph) await T.einde(srv);

  // Levering eerst afwerken (zoals in het echt): rit, laden, lossen, taak gedaan.
  const L = await T.voorstelNaarRit(srv.base, tok, lev, { chauffeur });
  const ltok = await T.ritToken(srv.base, tok, L.ritId);
  const li = (await A('POST', `/api/ritten/${L.ritId}/checks/init`)).json?.checks || [];
  for (const c of li) { await T.ritActie(srv.base, ltok, c.id, 'laden'); await T.ritActie(srv.base, ltok, c.id, 'lossen'); }
  await A('PUT', `/api/transport-taken/${L.taakId}/status`, { status: 'gedaan' });

  // Ophaalrit: GEEN checks/init, GEEN klaarzet.
  const O = await T.voorstelNaarRit(srv.base, tok, oph, { chauffeur });
  const otok = await T.ritToken(srv.base, tok, O.ritId);
  const pagina = await A('GET', `/rit/${otok}`);
  // CH2: de pagina tekent zich in de browser uit de rit-data; we zoeken in de HTML die rit.js daaruit bouwt.
  const ritData = async () => ({ text: ritTekst((await T.api(srv.base, null, 'GET', `/api/rit-token/${otok}/data`)).json) });
  pagina.text = (await ritData()).text;
  T.check(pagina.status === 200, `rit-link ophaalrit → 200 (kreeg ${pagina.status})`);
  const codes = oph.materiaal.map((m) => (m.naam.match(/\(([A-Z][0-9]+[^)]*)\)/) || [])[1]).filter(Boolean);
  T.info(`ophaalvoorstel: ${oph.materiaal.length} regels, codes ${codes.join(', ') || '—'}`);
  T.check(codes.length > 0, 'het ophaalvoorstel bevat minstens één bak met magazijncode');
  for (const c of codes) T.check(pagina.text.includes(c), `rit-pagina toont bak met code ${c} zonder klaarzetten`);
  const regelsZichtbaar = oph.materiaal.filter((m) => pagina.text.includes(m.naam.replace(/^Bak /, '').replace(/ \([^)]*\)$/, ''))).length;
  T.check(regelsZichtbaar === oph.materiaal.length, `rit-pagina toont alle ${oph.materiaal.length} op te halen stuks (zag er ${regelsZichtbaar})`);
  const checks = (await A('GET', `/api/ritten/${O.ritId}/checks`)).json?.checks || [];
  T.info(`checks op de ophaalrit zonder klaarzetten: ${checks.length}`);
  T.check(checks.length === oph.materiaal.length, `ophaalrit heeft meteen ${oph.materiaal.length} afvinkbare checks (kreeg ${checks.length})`);
  // Controle op het script zelf: mét klaarzetten moet de pagina de codes wél tonen (anders zoekt de test verkeerd).
  await A('POST', `/api/ritten/${O.ritId}/checks/init`);
  const na = await ritData();
  T.check(codes.every((c) => na.text.includes(c)), `controle: na klaarzetten toont de rit-pagina ${codes.join(', ')} (zoekmethode van deze test klopt)`);
} catch (e) { T.fout('onverwachte fout: ' + (e.stack || e)); }
await T.einde(srv);
