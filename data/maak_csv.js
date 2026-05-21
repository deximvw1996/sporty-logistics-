// Zet materiaallijst_foto1..10.json om naar één CSV-bestand dat netjes in Excel opent
// (1 rij per materiaalitem). Kolommen: Thema | Type | Leeftijdsgroep | Materiaal | Locatie | Bron.
// Run:  node data/maak_csv.js   ->  data/materiaallijst.csv
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const rows = [['Thema', 'Type', 'Leeftijdsgroep', 'Materiaal', 'Locatie (magazijncode)', 'Bron foto']];

for (let i = 1; i <= 10; i++) {
  const f = path.join(dir, 'materiaallijst_foto' + i + '.json');
  if (!fs.existsSync(f)) { console.warn('ontbreekt:', f); continue; }
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const t of (j.themas || [])) {
    const mats = t.materiaal || [];
    if (!mats.length) {
      rows.push([t.naam, t.type || '', t.leeftijdsgroep || '', '', '', 'foto' + i]);
      continue;
    }
    for (const m of mats) {
      rows.push([t.naam, t.type || '', t.leeftijdsgroep || '', m.naam || '', m.locatie || '', 'foto' + i]);
    }
  }
}

function esc(v) {
  const s = String(v == null ? '' : v);
  return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// 'sep=;' vertelt Excel dat de scheidingsteken een puntkomma is (handig op nl-BE Excel).
// ﻿ = UTF-8 BOM zodat accenten (é, ï...) correct verschijnen.
const csv = 'sep=;\r\n' + rows.map(r => r.map(esc).join(';')).join('\r\n');
fs.writeFileSync(path.join(dir, 'materiaallijst.csv'), '﻿' + csv, 'utf8');
console.log('OK -> data/materiaallijst.csv  (' + (rows.length - 1) + ' rijen)');
