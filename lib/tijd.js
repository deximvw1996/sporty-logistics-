// lib/tijd.js — TF2 G2/G17: alle getoonde tijden in Belgische tijd; opslag blijft ISO/UTC.
'use strict';
const TZ = 'Europe/Brussels';
const dl = new Intl.DateTimeFormat('nl-BE', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const tl = new Intl.DateTimeFormat('nl-BE', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
const deel = (f, d) => { const o = {}; f.formatToParts(d).forEach(p => { o[p.type] = p.value; }); return o; };
// '2026-10-29T19:40:21Z' of een Date → '29/10/2026, 20:40'; al-opgemaakte tekst (nl-BE) blijft ongewijzigd.
function fmtDatumTijd(x) {
  const d = x instanceof Date ? x : (/^\d{4}-\d{2}-\d{2}T/.test(String(x || '')) ? new Date(x) : null);
  if (!d || isNaN(d)) return x == null ? '' : String(x);
  const p = deel(dl, d);
  return `${p.day}/${p.month}/${p.year}, ${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
}
function fmtTijd(x) { const d = x instanceof Date ? x : new Date(x); if (isNaN(d)) return ''; const p = deel(tl, d); return `${p.hour === '24' ? '00' : p.hour}:${p.minute}`; }
// Enkelvoud/meervoud: telw(1,'soort','soorten') → '1 soort'
function telw(n, een, veel) { return `${n} ${Number(n) === 1 ? een : veel}`; }
// Interne notitie tussen haakjes aan het eind weghalen: 'Bak GPS (gedeeld; …)' → 'Bak GPS'
// Alleen echte notities (met ';' of ' — ', of beginnend met gedeeld/set/mogelijk) — niet '(kleuterbak)' of '(curver)'.
function zonderHaakjes(s) {
  return String(s == null ? '' : s).replace(/\s*\(([^()]*)\)/g, (m, i) => (/[;]|\s—\s|^(gedeeld|set|mogelijk|verifi)/i.test(i) ? '' : m)).replace(/\s{2,}/g, ' ').trim();
}
// '3 themadagen' → namen, afgekort na 3: 'A, B, C +2'
function namenKort(namen, max) {
  const u = [...new Set((namen || []).filter(Boolean))]; max = max || 3;
  return u.length > max ? u.slice(0, max).join(', ') + ' +' + (u.length - max) : u.join(', ');
}
// G18: label 'KV ' niet dubbel zetten
function kvL(n) { return /^KV\s/i.test(n) ? n : 'KV ' + n; }
module.exports = { kvL, namenKort, TZ, fmtDatumTijd, fmtTijd, telw, zonderHaakjes };
