// test-tf2-afwerking.mjs — TF2 (chat D): G2 tijdzone, G3 herpoging 502, G4 wissel-hint, G7 bakcodes, G11 draaiboek, G15 bestelling binnen,
// G17 datumformaat, G18 "KV KV", G19 teksten, G20 bakcode in kapot-lijst. Eigen server via _testhulp (poort 3349, herfst-test.db).
import * as T from './_testhulp.mjs';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ijk = T.leesIjk();
const srv = await T.startServer({ poort: parseInt(process.env.TEST_POORT || '3349') });
const lees = (p) => fs.readFileSync(T.ROOT + '/' + p, 'utf8');
try {
  const tok = await T.login(srv.base);
  const A = (m, p, b) => T.api(srv.base, tok, m, p, b);
  const P = (m, p, b) => T.api(srv.base, null, m, p, b);
  const TJ = require(T.ROOT + '/lib/tijd.js');

  // ── G2: Belgische tijd ──
  T.check(TJ.fmtDatumTijd('2026-10-29T19:40:21.246Z') === '29/10/2026, 20:40' && TJ.fmtDatumTijd('2026-07-01T10:00:00Z') === '01/07/2026, 12:00', 'G2: fmtDatumTijd zet UTC om naar Europe/Brussels (winter +1, zomer +2)');
  T.check(TJ.fmtTijd('2026-10-29T19:43:00Z') === '20:43', 'G2: fmtTijd 19:43Z → 20:43');
  T.check(/^process\.env\.TZ = 'Europe\/Brussels'/.test(lees('server.js')), "G2: server.js zet TZ='Europe/Brussels' vóór al het andere");
  const uur = execFileSync(process.execPath, ['-e', "process.env.TZ='Europe/Brussels';console.log(new Date('2026-10-29T19:40:00Z').getHours()+':'+String(new Date('2026-10-29T19:40:00Z').getMinutes()).padStart(2,'0'))"]).toString().trim();
  T.check(uur === '20:40', `G2: met TZ=Europe/Brussels geven getHours()/now() 20:40 voor 19:40Z (kreeg ${uur})`);

  // ── G3: herpoging ──
  const maak = (mod, antwoorden, opts) => {
    const calls = [], toasts = [], waits = [];
    const deps = { token: 'tok', fetch: async (u, o) => { calls.push([u, o && o.method || 'GET']); const a = antwoorden[Math.min(calls.length - 1, antwoorden.length - 1)]; if (a === 'net') throw new Error('netwerk'); return { ok: a === 200, status: a, json: async () => ({ rit: { id: 1, datum: '2026-11-02', chauffeur: '', voertuig: '', status: 'gepland' }, voortgang: { stops: 0, stops_gedaan: 0, stuks: 0, geladen: 0, gelost: 0 }, stops: [], bakken: [], attributen: [], aanvragen: [], kvNaam: '', dagen: null }) }; },
      toast: (t) => toasts.push(t), mount: () => {}, wacht: (ms) => { waits.push(ms); return Promise.resolve(); }, bewaar: () => {}, geladen: () => null, ...opts };
    return { app: mod.createApp(deps), calls, toasts, waits };
  };
  const RIT = require(T.ROOT + '/public/rit.js'), KVM = require(T.ROOT + '/public/kv.js');
  for (const [naam, mod] of [['rit.js', RIT], ['kv.js', KVM]]) {
    let h = maak(mod, [503, 502, 200]); const ok = await h.app.laad();
    T.check(ok === true && h.calls.length === 3 && h.waits.join() === '2000,5000' && h.toasts.filter((t) => /Even geduld, de app wordt bijgewerkt/.test(t)).length === 1, `G3 ${naam}: 503 → 502 → 200: 3 pogingen na 2 s en 5 s, 1× toast "Even geduld…"`);
    h = maak(mod, [503, 503, 503]); await h.app.laad();
    T.check(h.calls.length === 3 && h.toasts.some((t) => /Rit laden mislukt|Laden mislukt|Dat lukte niet|Geen verbinding/.test(t)), `G3 ${naam}: na 2 herpogingen stopt het (3 aanroepen) en komt de gewone foutafhandeling`);
    h = maak(mod, ['net', 200]); const ok2 = await h.app.laad();
    T.check(ok2 === true && h.calls.length === 2, `G3 ${naam}: netwerkfout op een GET wordt herhaald`);
  }
  const kvSrc = lees('public/kv.js'), ritSrc = lees('public/rit.js');
  T.check(/pad === '\/versturen'/.test(kvSrc) && /\}, false\); \}/.test(ritSrc), "G3: netwerkfout-herhaling voor POST alleen bij /versturen (idempotent: de server telt enkel sessies met kv_status='bezig'); rit-POST's enkel bij 502/503/504");
  const vers = lees('routes/kv.js');
  T.check(/kv_status='bezig' AND bak_type IN/.test(vers) && /kv_status='ingediend',kv_wie=\?,kv_tijdstip=\? WHERE kampmoment_id=\? AND kv_status='bezig'/.test(vers), 'G3: "telling versturen" is herhaalbaar (WHERE kv_status=\'bezig\': tweede keer verandert niets)');

  // ── G4: wissel-hint ──
  T.check(ritSrc.includes('wisselt alleen met een aangrenzende vrije stop') && lees('routes/transport.js').includes('wisselt alleen met een aangrenzende vrije stop'), 'G4: hint op de rit-pagina én 409-tekst van de server zeggen "aangrenzende vrije stop"');

  // ── G18 + G19 teksten ──
  T.check(TJ.kvL('KV Noor') === 'KV Noor' && TJ.kvL('Noor (FICTIEF)') === 'KV Noor (FICTIEF)' && !/KV KV/.test(TJ.kvL('KV Noor FICTIEF')), 'G18: kvL zet "KV " niet dubbel');
  T.check(/const naam = `\$\{n\} \(\$\{F\}\)`/.test(lees('scripts/generale-repetitie.mjs')), 'G18: seed-script noemt fictieve KV\'s "Noor (FICTIEF)" zonder KV-voorvoegsel');
  const nm = TJ.zonderHaakjes;
  T.check(nm('Bak GPS-toestellen (gedeeld; mogelijk 2e exemplaar — verifiëren)') === 'Bak GPS-toestellen' && nm('Games of empire (set — geen baklabel op fiche)') === 'Games of empire' && nm('Themabak 1/4 (kleuterbak)') === 'Themabak 1/4 (kleuterbak)', 'G19: interne notities weg, "(kleuterbak)" blijft');
  T.check(TJ.namenKort(['Apenstreken', '1001 ballen', 'Apero go', 'X', 'Y']) === 'Apenstreken, 1001 ballen, Apero go +2' && TJ.namenKort(['A', 'B']) === 'A, B', 'G19: themadag-namen, afgekort na 3');
  T.check(lees('routes/vandaag.js').includes("n.q===1?'stuk':'stuks'") && lees('routes/bakken-overzicht.js').includes("n.s===1?'soort':'soorten'") && kvSrc.includes("b.aantal === 1 ? ' soort' : ' soorten'"), 'G19: enkelvoud/meervoud (stuk/stuks, soort/soorten)');
  const kvDat = (bakken, attr) => ({ kampNaam: 'X', kampLocatie: 'X', week: 1, dagen: null, kvNaam: 'KV Noor', monitor: false, bakken, attributen: attr || [], aanvragen: [], boodschappen: [], levering: null, ophaling: null, kantoor: {}, locatie: {}, meldingen_chauffeur: [], meldingen_kantoor: [] });
  const bakj = (id, code, naam, items) => ({ id, soort: 'vast', code, naam, ingediend: false, status: 'nog_niet', geteld: 0, aantal: items.length, items: items.map((n, i) => ({ id: id * 10 + i, naam: n, gewenst: 2, aangetroffen: null, te_veel: 0, kapot_aantal: 0, notitie: '', foto_url: null, status: 'nog_niet' })) });
  const oz1 = KVM.overzichtHtml(kvDat([bakj(1, 'N12', 'Bak A', ['Dominoblokjes'])], [])), oz2 = KVM.overzichtHtml(kvDat([bakj(1, 'N12', 'Bak A', ['Dominoblokjes'])], [{ id: 5, code: 'A1', naam: 'Tent', status: null, uitslag: 'nog_niet' }]));
  T.check(/Tellen · 0\/1 bakken/.test(oz1) && /Tellen · 0\/2 stuks/.test(oz2) && /KV Noor/.test(oz1) && !/KV KV/.test(oz1), 'G19/G18: "bakken" bij enkel bakken, "stuks" zodra attributen meetellen; KV-kop zonder dubbel KV');
  const ritD = { rit: { id: 1, datum: '2026-11-02', chauffeur: 'X', voertuig: 'Y', status: 'gepland' }, voortgang: { stops: 1, stops_gedaan: 0, huidige_stop: 1, stuks: 1, geladen: 0, gelost: 0 }, stops: [{ taak_id: 7, volgorde: 1, slot: 'vast', tijd: '09:00', type: 'levering', status: 'gepland', opmerking: '', van: { id: 1, naam: 'Rozenweg' }, naar: { id: 2, naam: 'Kraal' }, locatie: { id: 2, naam: 'Kraal' }, kv: null,
    regels: [{ check_id: 1, code: 'L1', naam: 'Kleinmateriaal', qty: 1, soort: 'vast', rek: 'L', geladen: false, gelost: false, is_bulk: false, niet_mee: { reden: 'past_niet', opmerking: '', aantal: 0 } }] }] };
  const stopH = RIT.stopHtml(ritD, 7);
  T.check(!/Rek L<\/span><span>0 van 0 geladen/.test(stopH), 'G19: "Rek L · 0 van 0 geladen" wordt niet getoond als niets in dat rek mee kan');

  // ── G20: bakcode in kapot-lijst ──
  const kapotH = KVM.sheetHtml(kvDat([bakj(1, 'N12', 'Bak A', ['Dominoblokjes']), bakj(2, '', 'Bak B', ['Dominoblokjes'])]), { soort: 'kapot', stuk: '', tekst: '' });
  T.check(/Dominoblokjes · N12/.test(kapotH) && /Dominoblokjes · \(geen code\)/.test(kapotH), 'G20: keuzelijst Kapot melden toont "Dominoblokjes · N12" en "· (geen code)"');

  // ── G7: bakcodes ──
  const thema = ijk.themas.alles_op_wieltjes;
  const bk = async (label, code) => (await A('POST', `/api/themas/${thema}/bakken`, { label, code })).json;
  const d1 = await bk('Dubbel een', 'ZZ99'), d2 = await bk('Dubbel twee', 'zz99'), l1 = await bk('Zonder code', '');
  const ov = (await A('GET', '/api/bakken-overzicht')).json;
  const rijD = ov.bakken.filter((b) => b.soort === 'thema' && String(b.code).toUpperCase() === 'ZZ99'), rijL = ov.bakken.find((b) => b.id === l1.id && b.soort === 'thema');
  T.check(rijD.length === 2 && rijD.every((b) => b.code_dubbel && b.aandacht.includes('code_dubbel')) && rijL && rijL.code_leeg && rijL.aandacht.includes('code_leeg'), 'G7: dubbele (hoofdletterongevoelig) en lege codes krijgen code_dubbel/code_leeg + aandacht');
  T.check(ov.tellers.code_dubbel === ov.bakken.filter((b) => b.code_dubbel).length && ov.tellers.code_dubbel >= 2 && ov.tellers.code_leeg === ov.bakken.filter((b) => b.code_leeg).length && ov.tellers.code_leeg >= 1, `G7: tellers.code_dubbel=${ov.tellers.code_dubbel}, code_leeg=${ov.tellers.code_leeg}`);
  const bh = await fetch(srv.base + '/bakken', { headers: { Authorization: 'Basic ' + Buffer.from('sporty:' + T.APP_PASSWORD).toString('base64') } }).then((r) => r.text());
  T.check(/data-f="code_dubbel">⚠ Code dubbel/.test(bh) && /data-f="code_leeg">Geen code/.test(bh) && /code_dubbel:b=>b\.code_dubbel/.test(lees('public/bakken.js')), 'G7: chips "⚠ Code dubbel" en "Geen code" in /bakken, met filter');
  T.check(ov.bakken.find((b) => b.id === d1.id).code === 'ZZ99' && ov.bakken.find((b) => b.id === d2.id).code.toUpperCase() === 'ZZ99', 'G7: geen automatische hernummering (codes ongewijzigd)');

  // ── G15: bestelling pas aangevuld na "binnen" ──
  const km = ijk.kampmomenten.abdijschool;
  const bx = await bk('Bestel bak', 'BS01'); await A('POST', `/api/bakken/${bx.id}/items`, { naam: 'Lasso', qty: 4 });
  await A('POST', `/api/kampmomenten/${km}/themas`, { thema_id: thema });
  const kvtok = await T.kvToken(srv.base, tok, km), kv = (m, p, b) => P(m, `/api/kv/${kvtok}${p}`, b);
  const d0 = (await kv('GET', '/data')).json, kbb = d0.bakken.find((b) => b.code === 'BS01'), it = kbb.items[0];
  await kv('POST', `/bakken/${kbb.id}/tellen`, { regels: [{ item_id: it.id, aangetroffen: 1 }] });
  await kv('POST', '/versturen');
  const nk = (await A('GET', '/api/nakijken')).json.bakken.find((b) => b.kampmoment_id === km && b.bak.code === 'BS01');
  const det = (await A('GET', `/api/nakijken/sessie/${nk.sessie_id}`)).json, reg = det.items.find((i) => i.naam === 'Lasso');
  await A('PUT', `/api/nakijken/regel/${reg.regel_id}`, { kantoor_actie: 'bestellen', kantoor_aantal: 3 });
  await A('POST', `/api/nakijken/sessie/${nk.sessie_id}/afronden`);
  const lijst = () => A('GET', '/api/aanvullijst?alles=1').then((r) => r.json.bakken.flatMap((g) => g.handelingen).find((h) => h.regel_id === reg.regel_id));
  let h0 = await lijst();
  T.check(h0 && h0.soort === 'bestelling' && h0.kan_afvinken === false && /wacht op levering/.test(h0.waar_tekst), 'G15: bestelling staat in de aanvullijst als "wacht op levering" en is nog niet af te vinken');
  let r = await A('POST', `/api/aanvullijst/${reg.regel_id}/aangevuld`, { aangevuld: true });
  T.check(r.status === 409 && /nog niet binnen/.test(r.json.error), `G15: afvinken vóór levering → 409 (${r.json.error})`);
  r = await A('POST', `/api/nakijken/regel/${reg.regel_id}/binnen`);
  h0 = await lijst();
  T.check(r.status === 200 && h0.kan_afvinken === true && /binnen/.test(h0.waar_tekst), 'G15: POST /api/nakijken/regel/:id/binnen (kantoor) → afvinkbaar');
  const niet = await P('POST', `/api/nakijken/regel/${reg.regel_id}/binnen`);
  T.check(niet.status === 401 || niet.status === 403, 'G15: "binnen" zonder kantoor-login wordt geweigerd');
  r = await A('POST', `/api/aanvullijst/${reg.regel_id}/aangevuld`, { aangevuld: true });
  T.check(r.status === 200 && r.json.aangevuld === 1, 'G15: na "binnen" lukt aangevuld');

  // ── G17: één datumformaat in de historiek ──
  const det2 = (await A('GET', `/api/nakijken/sessie/${nk.sessie_id}`)).json;
  const tijden = (det2.historiek || []).map((x) => x.tijd).filter(Boolean);
  T.check(tijden.length > 0 && tijden.every((t) => /^\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}$/.test(t)), `G17: alle historiek-tijden in één formaat dd/mm/jjjj, uu:mm (${tijden.slice(0, 2).join(' | ')})`);

  // ── G11: draaiboek ──
  const db = lees('GENERALE-REPETITIE.md');
  T.check(/stop 1 \*\*én\*\* stop 2 op vrij/.test(db) && /Ze staat er/.test(db) && !/gat #2|gat #7/.test(db) && /Ritplanning/.test(db.split('Conflicten')[1] || '') && db.split(/\s+/).length < 1200, 'G11: draaiboek: stap 2 (stops 1 én 2 vrij; rest-taak staat er), stap 8 (conflicten → Ritplanning), max ~2 pagina\'s');
} catch (e) {
  T.fout('test crashte: ' + (e.stack || e));
}
await T.einde(srv);
