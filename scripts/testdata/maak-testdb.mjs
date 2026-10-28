// maak-testdb.mjs — bouwt de vaste herfst-testsituatie (V1, chat B) VIA DE API bovenop een
// kopie van sporty.db, en schrijft het resultaat weg als scripts/testdata/herfst-test.db
// (ijkstandaard, hoort in git) + herfst-test.json (aangemaakte ids).
// Gebruik: node scripts/testdata/maak-testdb.mjs [--bron <pad naar sporty.db>] [--poort 3319]
// Deterministisch: dezelfde bron geeft dezelfde ids (2× draaien → identieke json).
import fs from 'node:fs';
import path from 'node:path';
import * as T from '../_testhulp.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const BRON = path.resolve(arg('--bron', path.join(T.ROOT, 'sporty.db')));
const POORT = parseInt(arg('--poort', '3319'));

const srv = await T.startServer({ poort: POORT, dbBron: BRON });
const tok = await T.login(srv.base);
const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
const moet = (r, wat) => { if (r.status !== 200) throw new Error(`${wat}: ${r.status} ${r.text.slice(0, 300)}`); return r.json; };

try {
  // ── Periode "Herfst TEST" (2–8 nov 2026). "Actief" bestaat (nog) niet als backend-begrip:
  // we proberen het te zetten zodat de ijk-db het meteen heeft zodra werklijst 7 het kent.
  const per = moet(await A('POST', '/api/periodes', { naam: 'Herfst TEST', start_datum: '2026-11-02', eind_datum: '2026-11-08' }), 'periode');
  await A('PUT', `/api/periodes/${per.id}`, { naam: 'Herfst TEST', start_datum: '2026-11-02', eind_datum: '2026-11-08', actief: 1 });

  const locs = moet(await A('GET', '/api/locaties'), 'locaties');
  const loc = (naam) => { const l = locs.find((x) => x.name === naam); if (!l) throw new Error('locatie ontbreekt: ' + naam); return l; };
  const abdij = loc('Abdijschool Vlierbeek'), betekom = loc('Betekom');
  const rozenweg = loc('Rozenweg');

  const themas = moet(await A('GET', '/api/themas'), 'themas');
  const thema = (naam) => { const t = themas.find((x) => x.name === naam); if (!t) throw new Error('thema ontbreekt: ' + naam); return t; };
  const wieltjes = thema('Alles op wieltjes');   // bakken (F40) + poolbehoefte (bulk-voertuigen, koffer, springkasteel)
  const holder = thema('Holderdebolder');        // geen bakken, enkel poolbehoefte (springkastelen, WESCO)

  // ── Personen: één chauffeur, één KV per kampmoment ──
  const nieuwePersoon = async (naam, rol) => moet(await A('POST', '/api/personeel', { naam, rol }), 'persoon ' + naam);
  const chauffeur = await nieuwePersoon('Test Chauffeur harnas', 'chauffeur');
  const kvA = await nieuwePersoon('Test KV Abdijschool', 'kv');
  const kvB = await nieuwePersoon('Test KV Betekom', 'kv');

  // ── Kampmomenten week 1 + thema + KV ──
  const maakKm = async (l, th, kv) => {
    const km = moet(await A('POST', '/api/kampmomenten', { locatie_id: l.id, week: 1, periode_id: per.id, type: 'kamp' }), 'kampmoment ' + l.name);
    moet(await A('POST', `/api/kampmomenten/${km.id}/themas`, { thema_id: th.id, dag: null }), 'thema koppelen ' + l.name);
    moet(await A('PUT', `/api/kampmomenten/${km.id}`, { kv_persoon_id: kv.id }), 'kv koppelen ' + l.name);
    return km.id;
  };
  const kmBetekom = await maakKm(betekom, wieltjes, kvB);
  const kmAbdij = await maakKm(abdij, holder, kvA);

  const uit = {
    bron: path.basename(BRON),
    periode: { id: per.id, naam: 'Herfst TEST', start: '2026-11-02', eind: '2026-11-08' },
    locaties: { abdijschool: abdij.id, betekom: betekom.id, rozenweg: rozenweg.id },
    themas: { alles_op_wieltjes: wieltjes.id, holderdebolder: holder.id },
    personen: { chauffeur: chauffeur.id, kv_abdijschool: kvA.id, kv_betekom: kvB.id, api: T.API_PERSOON },
    kampmomenten: { betekom: kmBetekom, abdijschool: kmAbdij },
  };
  // Controle: wat er terug te lezen valt via de API (geen SQL), zodat de ijk-db zeker klopt.
  const kms = moet(await A('GET', '/api/kampmomenten'), 'kampmomenten');
  for (const [k, id] of Object.entries(uit.kampmomenten)) {
    const km = kms.find((x) => x.id === id);
    if (!km || km.periode_id !== per.id || km.week !== 1 || !km.kv_persoon_id || !(km.themas || []).length) throw new Error('controle kampmoment ' + k + ' faalt');
  }
  await new Promise((r) => setTimeout(r, 600)); // laatste flush (F1: atomaire schrijving per request)
  await srv.stop();
  fs.mkdirSync(T.TESTDATA, { recursive: true });
  fs.copyFileSync(srv.dbPad, T.IJK_DB);
  fs.writeFileSync(T.IJK_JSON, JSON.stringify(uit, null, 2) + '\n');
  console.log('herfst-test.db geschreven (' + Math.round(fs.statSync(T.IJK_DB).size / 1024) + ' kB)');
  console.log(JSON.stringify(uit));
  process.exit(0);
} catch (e) {
  console.log('FOUT  ' + (e.stack || e));
  console.log(srv.log().slice(-2000));
  await srv.stop();
  process.exit(1);
}
