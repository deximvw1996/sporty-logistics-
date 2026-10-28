// Catalogus-opschoning (V3c punt 2). Gebruik:  node scripts/opschoning-catalogus.mjs <sporty.db> [--doe]
// Zonder --doe: toont alleen. Met --doe: verwijdert, en schrijft de db terug.
// Kandidaten:
//  A. vervuilde transport-types: naam begint met "Bak ", "Attribuut ", "Kleurenbord " of bevat " × "
//  B. informatie-types: naam begint met "KV:" of "INFO:" (informatie, geen materiaal)
// Een kandidaat wordt ALLEEN verwijderd als hij nergens gebruikt wordt: geen enkele kolom item_type_id in
// bak_items / item_type_stock / standaard_materiaal / sport_items / … verwijst ernaar. Gebruikt = blijft (en wordt getoond).
// Zachte verwijzingen (transport_regels, verhuis_checks: eigen naam-kolom) tellen niet mee; bij --doe worden die
// item_type_id's op NULL gezet zodat er geen dode verwijzing achterblijft.
import { openDb, DOE, DBPAD } from './opschoning-gedeeld.mjs';
const { db, all, get, tabellen, verwijzers, aantalVerwijzingen, schrijf } = await openDb(DBPAD);
const ZACHT = ['transport_regels.item_type_id', 'verhuis_checks.item_type_id'];
const hard = verwijzers(/^item_type_id$/).filter(([t, c]) => !ZACHT.includes(t + '.' + c));
const zacht = verwijzers(/^item_type_id$/).filter(([t, c]) => ZACHT.includes(t + '.' + c));
console.log(`Opschoning catalogus — ${DOE ? 'UITVOEREN (--doe)' : 'DROOGLOOP (niets wordt gewijzigd)'} — ${DBPAD}`);
console.log(`Harde verwijzers: ${hard.map(([t, c]) => t + '.' + c).join(', ')}\n`);
const totaalVoor = get('SELECT COUNT(*) n FROM item_types').n;

const groepen = [
  ['A. vervuilde transport-types (Bak / Attribuut / Kleurenbord / " × ")', "naam LIKE 'Bak %' OR naam LIKE 'Attribuut %' OR naam LIKE 'Kleurenbord %' OR naam LIKE '% × %'"],
  ['B. informatie-types (KV: / INFO:)', "naam LIKE 'KV:%' OR naam LIKE 'INFO:%'"],
];
let weg = 0, blijft = 0; const teWissen = new Set();
for (const [titel, waar] of groepen) {
  const rijen = all(`SELECT id, naam FROM item_types WHERE ${waar} ORDER BY id`);
  let gw = 0, gb = 0; const blijven = [];
  for (const r of rijen) {
    const { n, waar: w } = aantalVerwijzingen(r.id, hard);
    if (n === 0) { teWissen.add(r.id); gw++; } else { gb++; blijven.push(`id ${r.id} "${r.naam.slice(0, 60)}" ← ${w.join(', ')}`); }
  }
  console.log(`── ${titel}\n   kandidaten ${rijen.length} · ongebruikt (te verwijderen) ${gw} · gebruikt (blijft) ${gb}`);
  for (const r of rijen.filter((x) => teWissen.has(x.id)).slice(0, 12)) console.log(`     weg: id ${r.id} "${r.naam.slice(0, 70)}"`);
  if (gw > 12) console.log(`     … en nog ${gw - 12}`);
  for (const b of blijven.slice(0, 40)) console.log(`     blijft: ${b}`);
  if (gb > 40) console.log(`     … en nog ${gb - 40} die blijven`);
  weg += gw; blijft += gb;
}
if (DOE && teWissen.size) {
  for (const id of teWissen) {
    for (const [t, c] of zacht) db.run(`UPDATE ${t} SET ${c}=NULL WHERE ${c}=?`, [id]);
    db.run('DELETE FROM item_types WHERE id=?', [id]);
    if (tabellen.includes('item_type_stock')) db.run('DELETE FROM item_type_stock WHERE item_type_id=?', [id]); // staat hier nooit, want 'hard' had hem al geblokkeerd
  }
  schrijf();
}
const totaalNa = DOE ? get('SELECT COUNT(*) n FROM item_types').n : totaalVoor;
console.log(`\nSamenvatting: item_types ${totaalVoor} → ${DOE ? totaalNa : totaalVoor - weg + ' (na --doe)'} · ${DOE ? 'verwijderd' : 'te verwijderen'} ${weg} · blijven omdat in gebruik ${blijft}`);
if (!DOE) console.log('Droogloop klaar — niets gewijzigd. Draai met --doe om uit te voeren.'); else console.log('Database herschreven.');
