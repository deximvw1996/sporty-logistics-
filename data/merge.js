// Voegt materiaallijst_foto1..10.json samen tot één materiaallijst_volledig.json.
// Thema's met exact dezelfde naam (o.a. die over 2 foto's lopen) worden samengevoegd:
// hun materiaal-arrays worden geconcateneerd en op (naam+locatie) ontdubbeld.
// Run:  node data/merge.js
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const out = path.join(dir, 'materiaallijst_volledig.json');

const themaMap = new Map();   // naam -> thema-object
const order = [];             // volgorde van eerste verschijning
const vrij = new Set();
let bronItems = 0;

for (let i = 1; i <= 10; i++) {
  const f = path.join(dir, `materiaallijst_foto${i}.json`);
  if (!fs.existsSync(f)) { console.warn('ontbreekt:', f); continue; }
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  (j.vrije_opslaglocaties || []).forEach(c => vrij.add(c));
  for (const t of (j.themas || [])) {
    bronItems += (t.materiaal || []).length;
    const key = t.naam.trim();
    if (!themaMap.has(key)) {
      themaMap.set(key, {
        naam: key,
        type: t.type || 'kamp',
        leeftijdsgroep: t.leeftijdsgroep || null,
        materiaal: []
      });
      order.push(key);
    }
    const dst = themaMap.get(key);
    // vul leeftijdsgroep aan als die eerst leeg was
    if (!dst.leeftijdsgroep && t.leeftijdsgroep) dst.leeftijdsgroep = t.leeftijdsgroep;
    // noten samenvoegen
    if (t.noot) dst.noot = dst.noot ? (dst.noot + ' | ' + t.noot) : t.noot;
    for (const m of (t.materiaal || [])) {
      const dup = dst.materiaal.some(x => x.naam === m.naam && (x.locatie || null) === (m.locatie || null));
      if (!dup) dst.materiaal.push({ naam: m.naam, locatie: m.locatie || null, ...(m.noot ? { noot: m.noot } : {}) });
    }
  }
}

const themas = order.map(k => themaMap.get(k)).sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
const totItems = themas.reduce((s, t) => s + t.materiaal.length, 0);

const result = {
  _meta: {
    bron: 'samenvoeging van materiaallijst_foto1..10.json',
    datum_merge: new Date().toISOString().slice(0, 10),
    aantal_themas: themas.length,
    aantal_materiaalitems: totItems,
    bron_materiaalitems_voor_dedup: bronItems,
    betrouwbaarheid: 'OCR uit fotos - controleer codes/aantallen tegen origineel'
  },
  vrije_opslaglocaties: [...vrij].sort(),
  themas
};

fs.writeFileSync(out, JSON.stringify(result, null, 2), 'utf8');
console.log(`OK -> ${out}`);
console.log(`${themas.length} unieke themas, ${totItems} materiaalitems (van ${bronItems} bron-items), ${vrij.size} vrije vakken`);
