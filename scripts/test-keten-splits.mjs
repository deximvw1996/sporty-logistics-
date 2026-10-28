// test-keten-splits.mjs — bewaakt WERKLIJST 18 · DOORLICHTING-b F6/F7.
// Gewenst (DRAAIBOEK 3.3 "splitsen over 2 voertuigen", 4.2 "alles traceerbaar"):
// (a) een taak met checks splitsen ⇒ elke taak heeft zijn eigen checks; de laadstatus van de oude
//     taak hangt niet meer af van afgesplitste regels; (b) een taak verwijderen na laden laat geen
//     bakken eeuwig 'onderweg' — aanvaardbaar: terug 'thuis' OF de API weigert met een duidelijke fout.
import * as T from './_testhulp.mjs';
const POORT = parseInt(process.env.TEST_POORT || '3324');
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: POORT });
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const kmId = ijk.kampmomenten.abdijschool;
  const gen = (await A('POST', '/api/transport-genereer')).json || [];
  const v = gen.find((x) => x.kampmoment_id === kmId && x.type === 'levering' && x.materiaal.filter((m) => m.bak_id && !/^\d+ × /.test(m.naam)).length >= 2);
  T.check(!!v, `leveringsvoorstel voor Abdijschool (km ${kmId}) met ≥2 unieke stuks`);
  if (!v) await T.einde(srv);
  const { taakId, ritId } = await T.voorstelNaarRit(srv.base, tok, v);
  const rtok = await T.ritToken(srv.base, tok, ritId);
  const init = (await A('POST', `/api/ritten/${ritId}/checks/init`)).json;
  T.check(init?.aangemaakt === v.materiaal.length, `checks/init: ${v.materiaal.length} checks (kreeg ${init?.aangemaakt})`);
  const regels = ((await A('GET', '/api/transport-taken')).json || []).find((x) => x.id === taakId).regels;
  const uniek = regels.filter((r) => r.bak_id && !/^\d+ × /.test(r.naam));
  const weg = uniek[0];                       // deze regel gaat met een ander voertuig/dag
  const blijft = uniek[1];
  T.info(`afsplitsen: "${weg.naam}" — blijft: "${blijft.naam}"`);

  // ── (a) splitsen ──
  const sp = await A('POST', `/api/transport-taken/${taakId}/splits`, { regel_ids: [weg.id], datum: '2026-10-31' });
  T.check(sp.status === 200 && sp.json?.nieuwe_taak_id, `splitsen → 200 met nieuwe taak (kreeg ${sp.status})`);
  const nieuweTaak = sp.json?.nieuwe_taak_id;
  let ch = (await A('GET', `/api/ritten/${ritId}/checks`)).json?.checks || [];
  const nogOud = ch.filter((c) => c.item_naam === weg.naam);
  T.check(nogOud.length === 0, `de afgesplitste regel staat niet meer in de checklist van de oude rit (kreeg ${nogOud.length}×, taak_id ${nogOud.map((c) => c.taak_id).join(',')})`);
  T.check(ch.every((c) => c.taak_id === taakId), `alle checks van de oude rit horen bij taak #${taakId} (kreeg taak_ids ${[...new Set(ch.map((c) => c.taak_id))].join(',')})`);
  // Afgesplitste taak inplannen → eigen rit met eigen checks
  const mv = (await A('PUT', `/api/transport-taken/${nieuweTaak}/move`, { datum: '2026-10-31', tijd: '10:00' })).json;
  const ch2 = mv?.rit_id ? (await A('POST', `/api/ritten/${mv.rit_id}/checks/init`)).json?.checks || [] : [];
  T.check(mv?.rit_id && mv.rit_id !== ritId && ch2.length === 1 && ch2[0].item_naam === weg.naam && ch2[0].taak_id === nieuweTaak,
    `afgesplitste taak krijgt een eigen rit met precies zijn eigen check (rit ${mv?.rit_id}, ${ch2.length} checks)`);

  // Laadstatus van de oude taak: alles wat nog op de oude rit staat laden ⇒ onderweg
  ch = (await A('GET', `/api/ritten/${ritId}/checks`)).json?.checks || [];
  for (const c of ch.filter((c) => c.item_naam !== weg.naam)) await T.ritActie(srv.base, rtok, c.id, 'laden');
  const vb = (await A('GET', '/api/vaste-bakken')).json || [];
  const b = vb.find((x) => x.id === blijft.bak_id);
  T.check(b?.status === 'onderweg', `"${blijft.naam}" is 'onderweg' zodra alles van de oude rit geladen is (kreeg '${b?.status}')`);

  // ── (b) verwijderen na laden ──
  // Zorg dat er echt iets 'onderweg' staat (vandaag pas als óók de afgesplitste check van de oude
  // rit geladen is — zie (a)); anders zou deze controle vacuüm groen zijn.
  for (const c of ch.filter((c) => c.item_naam === weg.naam && !c.geladen)) await T.ritActie(srv.base, rtok, c.id, 'laden');
  const bVoor = ((await A('GET', '/api/vaste-bakken')).json || []).find((x) => x.id === blijft.bak_id);
  T.check(bVoor?.status === 'onderweg', `uitgangspunt (b): "${blijft.naam}" staat 'onderweg' vóór het verwijderen (kreeg '${bVoor?.status}')`);
  const del = await A('DELETE', `/api/transport-taken/${taakId}`);
  const vbNa = (await A('GET', '/api/vaste-bakken')).json || [];
  const bNa = vbNa.find((x) => x.id === blijft.bak_id);
  const geweigerd = del.status >= 400 && del.status < 500 && !!del.json?.error;
  const teruggezet = del.status === 200 && bNa?.status === 'thuis';
  T.info(geweigerd ? `verwijderen geweigerd: ${del.status} "${del.json.error}"` : teruggezet ? 'verwijderen toegelaten, bak teruggezet naar thuis' : `verwijderen ${del.status}, bak staat '${bNa?.status}'`);
  T.check(geweigerd || teruggezet, `taak verwijderen na laden laat geen bak eeuwig 'onderweg' (kreeg ${del.status}, bak '${bNa?.status}')`);
  if (del.status === 200) {
    const wees = (await A('GET', `/api/ritten/${ritId}/checks`)).json?.checks || [];
    T.check(wees.length === 0, `na verwijderen blijven er geen verweesde checks achter (kreeg ${wees.length})`);
  }
} catch (e) { T.fout('onverwachte fout: ' + (e.stack || e)); }
await T.einde(srv);
