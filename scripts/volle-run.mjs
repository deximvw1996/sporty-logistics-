// volle-run.mjs — draait alle scripts/test-*.mjs na elkaar (V1, chat B). Elk script in een eigen
// proces, eigen poort uit 3320–3339 (env TEST_POORT), timeout 10 min per test.
// Gebruik: node scripts/volle-run.mjs [--alleen keten-levering,veiligheid] [--vanaf keten-ophaling]
// Exitcode 1 als er iets rood of afgebroken is. Dit draait de hoofdchat bij elke keuring.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, '..');
const NM_FALLBACK = path.resolve(ROOT, '..', 'sporty-railway', 'node_modules');
const NODE_PATH = [process.env.NODE_PATH, fs.existsSync(path.join(ROOT, 'node_modules')) ? path.join(ROOT, 'node_modules') : null, NM_FALLBACK].filter(Boolean).join(path.delimiter);
const TIMEOUT_MS = 10 * 60 * 1000;

const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const kaal = (f) => f.replace(/^test-/, '').replace(/\.mjs$/, '');
let tests = fs.readdirSync(HIER).filter((f) => /^test-.*\.mjs$/.test(f)).sort();
const alleen = arg('--alleen');
if (alleen) { const w = alleen.split(',').map((s) => kaal(s.trim())); tests = tests.filter((f) => w.includes(kaal(f))); }
const vanaf = arg('--vanaf');
if (vanaf) { const i = tests.findIndex((f) => kaal(f) === kaal(vanaf)); tests = i >= 0 ? tests.slice(i) : []; }
if (!tests.length) { console.log('Geen tests gevonden voor deze selectie.'); process.exit(1); }

function draai(bestand, poort) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const p = spawn(process.execPath, [path.join(HIER, bestand)], { cwd: ROOT, env: { ...process.env, TEST_POORT: String(poort), NODE_PATH }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (out += d));
    const timer = setTimeout(() => { try { p.kill(); } catch {} resolve({ uitslag: 'AFGEBROKEN', reden: 'timeout 10 min', out, sec: (Date.now() - t0) / 1000 }); }, TIMEOUT_MS);
    p.on('exit', (code) => {
      clearTimeout(timer);
      const m = out.match(/(\d+) ok, (\d+) fout/gi);
      const laatste = m ? m[m.length - 1].match(/(\d+) ok, (\d+) fout/i) : null;
      const okN = laatste ? +laatste[1] : null, foutN = laatste ? +laatste[2] : null;
      let uitslag;
      if (code === 0 && /ALLES GROEN/.test(out)) uitslag = 'GROEN';
      else if (laatste && foutN > 0) uitslag = `ROOD (${foutN} fout)`;
      else uitslag = 'AFGEBROKEN';
      resolve({ uitslag, okN, foutN, code, out, sec: (Date.now() - t0) / 1000 });
    });
  });
}

const rijen = [];
let poort = 3320;
for (const t of tests) {
  const r = await draai(t, poort);
  poort = poort >= 3339 ? 3320 : poort + 1;
  rijen.push({ test: kaal(t), ...r });
  console.log(`${r.uitslag.padEnd(14)} ${kaal(t)}  (${r.sec.toFixed(1)} s${r.okN != null ? `, ${r.okN} ok / ${r.foutN} fout` : ''})`);
  if (r.uitslag === 'AFGEBROKEN') console.log(r.out.split('\n').slice(-15).map((l) => '    | ' + l).join('\n'));
}
console.log('\n| test | uitslag | ok | fout | tijd |\n|---|---|---|---|---|');
for (const r of rijen) console.log(`| ${r.test} | ${r.uitslag} | ${r.okN ?? '-'} | ${r.foutN ?? '-'} | ${r.sec.toFixed(1)} s |`);
const groen = rijen.filter((r) => r.uitslag === 'GROEN').length;
console.log(`\n${groen}/${rijen.length} groen`);
process.exit(groen === rijen.length ? 0 : 1);
