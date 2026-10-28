// test-keten-aanvraag.mjs — bewaakt WERKLIJST 11, 12 · DOORLICHTING-b F8 · D-#1/T-G1.
// Gewenst (DRAAIBOEK 2.8/4.5/5.2): KV vraagt aan via de kv-link → kantoor keurt goed met spoedtransport
// → de spoedtaak heeft een bron (stockageplaats), bestemming (kamplocatie van het kampmoment), een datum
// binnen de kampweek en het gevraagde aantal. Afwijzen daarna annuleert die spoedtaak.
import * as T from './_testhulp.mjs';
const POORT = parseInt(process.env.TEST_POORT || '3323');
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: POORT });
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const kmId = ijk.kampmomenten.betekom, betekom = ijk.locaties.betekom;
  const kvTok = await T.kvToken(srv.base, tok, kmId);
  T.ok('kv-link voor het Betekom-kampmoment opgehaald');

  const aan = await T.api(srv.base, null, 'POST', `/api/kv/${kvTok}/aanvraag`, { tekst: '3 rollen tape' });
  T.check(aan.status === 200 && aan.json?.id, `KV dient aanvraag in via kv-link → 200 (kreeg ${aan.status})`);
  const aid = aan.json?.id;
  T.check(aan.json?.kampmoment_id === kmId, `aanvraag hangt aan kampmoment ${kmId} (kreeg ${aan.json?.kampmoment_id})`);

  const gk = await A('PUT', `/api/aanvragen/${aid}/status`, { status: 'goedgekeurd', maak_spoedtransport: true, spoedtransport: { item: 'Tape', qty: 3 } });
  T.check(gk.status === 200 && gk.json?.status === 'goedgekeurd' && gk.json?.spoed_taak_id, `kantoor keurt goed met spoedtransport → spoedtaak (kreeg ${gk.status}, taak ${gk.json?.spoed_taak_id})`);
  const taakId = gk.json?.spoed_taak_id;
  const taken = (await A('GET', '/api/transport-taken')).json || [];
  const st = taken.find((x) => x.id === taakId);
  const locs = (await A('GET', '/api/locaties')).json || [];
  const bron = locs.find((l) => l.id === st?.van_locatie_id);
  T.check(bron && bron.type === 'stockage', `spoedtaak heeft een bron = stockageplaats (kreeg van_locatie_id ${st?.van_locatie_id}${bron ? ' ' + bron.name + '/' + bron.type : ''})`);
  T.check(st?.naar_locatie_id === betekom, `spoedtaak gaat naar de kamplocatie Betekom (${betekom}) (kreeg ${st?.naar_locatie_id})`);
  const d = st?.datum || '';
  T.check(d >= ijk.periode.start && d <= ijk.periode.eind, `spoedtaak-datum ligt in de kampweek ${ijk.periode.start}..${ijk.periode.eind} (kreeg '${d}')`);
  const qty = (st?.regels || []).reduce((s, r) => s + (r.qty || 0), 0);
  T.check(qty === 3, `spoedtaak draagt het gevraagde aantal 3 (kreeg ${qty})`);
  T.check(st?.kampmoment_id === kmId, `spoedtaak hangt aan het kampmoment (kreeg ${st?.kampmoment_id})`);

  // ── Afwijzen na goedkeuring: de spoedtaak mag niet meer gepland staan ──
  const af = await A('PUT', `/api/aanvragen/${aid}/status`, { status: 'afgewezen', reden: 'toch niet nodig' });
  T.check(af.status === 200 && af.json?.status === 'afgewezen', `kantoor wijst daarna af → 200 afgewezen (kreeg ${af.status} ${af.json?.status})`);
  const na = ((await A('GET', '/api/transport-taken')).json || []).find((x) => x.id === taakId);
  T.check(!na || ['geannuleerd', 'geannuleerd_aanvraag'].includes(na.status), `spoedtaak #${taakId} is na afwijzen geannuleerd/verwijderd (kreeg ${na ? "status '" + na.status + "'" : 'verwijderd'})`);
  const kvData = (await T.api(srv.base, null, 'GET', `/api/kv/${kvTok}/data`)).json;
  const zicht = (kvData?.aanvragen || []).find((x) => x.id === aid);
  T.check(zicht?.status === 'afgewezen' && zicht?.reden === 'toch niet nodig', `KV ziet 'afgewezen' mét reden (kreeg ${zicht?.status} / ${zicht?.reden})`);
} catch (e) { T.fout('onverwachte fout: ' + (e.stack || e)); }
await T.einde(srv);
