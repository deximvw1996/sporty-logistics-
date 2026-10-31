// lib/testklok.js — TK1: testklok. Staat helemaal vooraan in server.js. Alleen met SPORTY_TESTKLOK=1 vervangt ze Date en Date.now door echte tijd + verschil,
// zodat alle bestaande code de ingestelde tijd volgt. Zonder de variabele verandert er niets en wordt een opgeslagen verschil genegeerd.
// Echte tijd blijft via EchteDate en echteNu: pincodeblokkering, back-ups. Timers (setTimeout/setInterval) staan los van Date.
'use strict';
const EchteDate = Date;
const AAN = process.env.SPORTY_TESTKLOK === '1';
let verschil = 0;
function KlokDate(...a) {
  if (!new.target) return new EchteDate(EchteDate.now() + verschil).toString();
  return a.length ? new EchteDate(...a) : new EchteDate(EchteDate.now() + verschil);
}
KlokDate.prototype = EchteDate.prototype;
KlokDate.now = () => EchteDate.now() + verschil;
KlokDate.parse = EchteDate.parse;
KlokDate.UTC = EchteDate.UTC;
if (AAN) global.Date = KlokDate;

const VLAG = 'testklok_verschil';
function laad({ get }) { if (!AAN) return; const r = get('SELECT waarde FROM app_vlaggen WHERE naam=?', [VLAG]); verschil = r ? (parseInt(r.waarde, 10) || 0) : 0; }
function zet(ms, { run }) { if (!AAN) return; verschil = ms; run('INSERT OR REPLACE INTO app_vlaggen (naam,waarde) VALUES (?,?)', [VLAG, String(ms)]); }

// De browser krijgt het verschil vóór elk ander script. Zonder variabele blijft de HTML onaangeroerd.
const invoeg = () => `<script>window.__TESTKLOK_VERSCHIL=${verschil};</script><script src="/public/testklok.js"></script>`;
function zetInHtml(html) {
  if (html.includes('/public/testklok.js')) return html;
  const m = /<head[^>]*>/i.exec(html);
  if (m) return html.slice(0, m.index + m[0].length) + invoeg() + html.slice(m.index + m[0].length);
  return /<html|<!doctype/i.test(html) ? invoeg() + html : html;
}
function middleware(fs) {
  return (req, res, next) => {
    if (!AAN || req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
    const send = res.send.bind(res), sendFile = res.sendFile.bind(res);
    res.send = (b) => { if (typeof b === 'string' && /<html|<head|<!doctype/i.test(b)) { res.type('html'); return send(zetInHtml(b)); } return send(b); };
    res.sendFile = (p, ...rest) => { if (/\.html$/i.test(String(p))) { try { res.type('html'); return send(zetInHtml(fs.readFileSync(p, 'utf8'))); } catch (e) { /* gewone foutafhandeling */ } } return sendFile(p, ...rest); };
    next();
  };
}
module.exports = { AAN, EchteDate, echteNu: () => EchteDate.now(), verschil: () => verschil, laad, zet, middleware };
