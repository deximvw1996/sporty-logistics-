// Prod-opschoning (V3c punt 3). Gebruik:  node scripts/opschoning-prod.mjs <sporty.db> [--doe]
// Zonder --doe: droogloop (db wordt niet gewijzigd). Met --doe: verwijdert en schrijft de db terug.
//  1. locatie_config-regels met aantal >= 50 (testrest, bv. "99× EHBO" op Abdijschool Vlierbeek)
//  2. rijen met naam 'undefined' of leeg in locaties / bakken / item_types / attributen
//     (verwijderd als er nergens naar verwezen wordt, anders alleen gemeld)
//  3. verweesde nakijk_regels / verhuis_checks / bulk_spreiding (ouder bestaat niet meer)
import { openDb, DOE, DBPAD } from './opschoning-gedeeld.mjs';
const { db, all, tabellen, verwijzers, aantalVerwijzingen, schrijf } = await openDb(DBPAD);
console.log(`Opschoning prod — ${DOE ? 'UITVOEREN (--doe)' : 'DROOGLOOP (niets wordt gewijzigd)'} — ${DBPAD}\n`);
const del = (sql, p = []) => db.run(sql, p);
const tel = { cfg: 0, naamweg: 0, naamblijft: 0, wezen: 0 };

// 1. locatie_config
console.log('── 1. locatie_config met aantal >= 50');
const cfg = all(`SELECT c.id, c.kamplocatie_id, l.name AS locatie, c.vast_type, c.aantal FROM locatie_config c LEFT JOIN locaties l ON l.id=c.kamplocatie_id WHERE c.aantal>=50`);
if (!cfg.length) console.log('   (geen)');
for (const r of cfg) { console.log(`   id ${r.id}: ${r.aantal}× ${r.vast_type} op "${r.locatie}" (locatie ${r.kamplocatie_id})`); if (DOE) del('DELETE FROM locatie_config WHERE id=?', [r.id]); tel.cfg++; }

// 2. 'undefined' / lege namen
console.log("\n── 2. rijen met naam 'undefined' of leeg");
const DOELEN = [
  ['locaties', 'name', /locatie_id$|^kamplocatie_id$/, [['locaties', 'parent_id']]],
  ['bakken', 'naam', /(^|_)bak_id$/, []],
  ['item_types', 'naam', /^item_type_id$/, []],
  ['attributen', 'naam', /^attribuut_id$/, []],
];
for (const [tabel, kol, regex, extra] of DOELEN) {
  if (!tabellen.includes(tabel)) continue;
  const refs = [...verwijzers(regex), ...extra].filter(([t, c]) => tabellen.includes(t));
  const rijen = all(`SELECT id, ${kol} AS n FROM ${tabel} WHERE ${kol} IS NULL OR TRIM(${kol})='' OR LOWER(TRIM(${kol}))='undefined'`);
  console.log(`   ${tabel}: ${rijen.length} rij(en)`);
  for (const r of rijen) {
    const { n, waar } = aantalVerwijzingen(r.id, refs.filter(([t, c]) => !(t === tabel && c === 'id')));
    if (n === 0) { console.log(`     id ${r.id} "${r.n ?? ''}" → geen verwijzingen: ${DOE ? 'VERWIJDERD' : 'zou verwijderen'}`); if (DOE) del(`DELETE FROM ${tabel} WHERE id=?`, [r.id]); tel.naamweg++; }
    else { console.log(`     id ${r.id} "${r.n ?? ''}" → BLIJFT, nog ${n} verwijzing(en): ${waar.join(', ')}`); tel.naamblijft++; }
  }
}

// 3. wezen
console.log('\n── 3. verweesde rijen');
const WEZEN = [
  ['nakijk_regels', 'sessie_id NOT IN (SELECT id FROM nakijk_sessies)'],
  ['verhuis_checks', 'rit_id NOT IN (SELECT id FROM transport_ritten)'],
  ['bulk_spreiding', 'bak_id NOT IN (SELECT id FROM bakken) OR locatie_id NOT IN (SELECT id FROM locaties)'],
];
for (const [t, waar] of WEZEN) {
  if (!tabellen.includes(t)) continue;
  const rijen = all(`SELECT id FROM ${t} WHERE ${waar}`);
  console.log(`   ${t}: ${rijen.length} verweesd${rijen.length ? ' (ids ' + rijen.slice(0, 15).map((r) => r.id).join(',') + (rijen.length > 15 ? ',…' : '') + ')' : ''}`);
  if (DOE && rijen.length) del(`DELETE FROM ${t} WHERE ${waar}`);
  tel.wezen += rijen.length;
}
console.log(`\nSamenvatting: locatie_config ${tel.cfg} · naam-rijen ${DOE ? 'verwijderd' : 'te verwijderen'} ${tel.naamweg}, blijven (verwijzingen) ${tel.naamblijft} · wezen ${tel.wezen}`);
if (DOE) { schrijf(); console.log('Database herschreven.'); } else console.log('Droogloop klaar — niets gewijzigd. Draai met --doe om uit te voeren.');
