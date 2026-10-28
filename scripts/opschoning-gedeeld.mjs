// Gedeelde hulp voor scripts/opschoning-*.mjs (V3c): sql.js-db openen/schrijven + verwijzingen opsporen.
// Droogloop is de standaard; alleen mét --doe wordt het db-bestand (atomair: tmp + rename) herschreven.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

export async function openDb(pad) {
  if (!pad || !fs.existsSync(pad)) { console.error('Gebruik: node scripts/opschoning-*.mjs <pad-naar-sporty.db> [--doe]'); process.exit(2); }
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(pad));
  const all = (sql, p = []) => { const s = db.prepare(sql); s.bind(p); const r = []; while (s.step()) r.push(s.getAsObject()); s.free(); return r; };
  const get = (sql, p = []) => all(sql, p)[0] || null;
  const tabellen = all("SELECT name FROM sqlite_master WHERE type='table'").map((r) => r.name);
  const kolommen = (t) => (tabellen.includes(t) ? all(`PRAGMA table_info(${t})`).map((c) => c.name) : []);
  // Alle (tabel,kolom) die naar een ouder verwijzen, op kolomnaam-patroon.
  const verwijzers = (kolRegex, uitsluit = []) => {
    const res = [];
    for (const t of tabellen) for (const c of kolommen(t)) if (kolRegex.test(c) && !uitsluit.includes(t + '.' + c)) res.push([t, c]);
    return res;
  };
  const aantalVerwijzingen = (id, refs) => {
    let n = 0; const waar = [];
    for (const [t, c] of refs) { const k = get(`SELECT COUNT(*) n FROM ${t} WHERE ${c}=?`, [id]).n; if (k) { n += k; waar.push(`${t}.${c}×${k}`); } }
    return { n, waar };
  };
  const schrijf = () => {
    const tmp = pad + '.tmp';
    fs.writeFileSync(tmp, Buffer.from(db.export()));
    fs.renameSync(tmp, pad);
  };
  return { db, all, get, tabellen, kolommen, verwijzers, aantalVerwijzingen, schrijf };
}
export const DOE = process.argv.includes('--doe');
export const DBPAD = process.argv.slice(2).find((a) => !a.startsWith('--'));
