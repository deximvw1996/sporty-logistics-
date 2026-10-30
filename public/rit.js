// Rit-pagina chauffeur (CH2) — exacte kopie van design/CHAUFFEUR-DEFINITIEF.html op de data van
// GET /api/rit-token/:token/data. Alles wordt uit die data getekend; geen lokale toestand die kan afwijken.
// Pure HTML-bouwers + createApp(deps) zijn exporteerbaar (module.exports) zodat ze zonder browser te testen zijn.
(function (root) {
  'use strict';
  var DAGEN = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  var MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  function datumKort(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    if (!m) return esc(iso || '');
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return DAGEN[d.getDay()] + ' ' + (+m[3]) + ' ' + MAANDEN[+m[2] - 1];
  }
  function typeLabel(t) { return { levering: 'levering', ophaling: 'ophaling', transfer: 'transfer', extra: 'extra' }[t] || (t || 'stop'); }
  function stopNaam(s) { return (s.locatie && s.locatie.naam) || (s.naar && s.naar.naam) || (s.van && s.van.naam) || s.opmerking || 'Stop'; }
  // "Bak Themabak 1/4 (kleuterbak) (N20)" → "Themabak 1/4 (kleuterbak)"
  function schoonNaam(naam, code) {
    var n = String(naam || '').replace(/^Bak\s+/i, '');
    if (code) n = n.replace(new RegExp('\\s*\\(' + String(code).replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&') + '\\)\\s*$'), '');
    return n.trim();
  }
  var meeStuks = function (s) { return s.regels.filter(function (r) { return !isNietMee(r); }).reduce(function (a, r) { return a + (r.qty || 1); }, 0); };
  // "niet mee" van een gesplitste bulkregel (qty = wat wel mee gaat) telt als gewoon laadbaar stuk met een rest-melding.
  function isGesplitst(r) { return !!(r.is_bulk && r.niet_mee && r.niet_mee.aantal > 0); }
  function isNietMee(r) { return !!(r.niet_mee && !isGesplitst(r)); }
  var stuksWoord = function (n) { return n + ' ' + (n === 1 ? 'stuk' : 'stuks'); };
  var REDEN_TEKST = { past_niet: 'past niet', niet_gevonden: 'niet gevonden', kapot: 'kapot' };

  function kopSub(data) {
    var r = data.rit, v = data.voortgang;
    var delen = [r.chauffeur, r.voertuig].filter(Boolean);
    delen.push(v.stops + ' ' + (v.stops === 1 ? 'stop' : 'stops'));
    delen.push(v.geladen + ' van ' + v.stuks + ' stuks geladen');
    return delen.join(' · ');
  }
  function pilRit(status) {
    var cls = status === 'gedaan' ? ' groen' : status === 'gepland' ? ' grijs' : '';
    return '<span class="pil' + cls + '">' + esc(String(status || '').toUpperCase()) + '</span>';
  }

  // ── Dag-scherm ──
  function dagHtml(data) {
    var stops = data.stops, huidig = data.voortgang.huidige_stop;
    var tl = stops.map(function (s, i) {
      var klaar = s.status === 'gedaan', nu = s.volgorde === huidig && !klaar;
      var chip = klaar ? 'klaar' : s.status === 'aangekomen' ? 'bezig' : nu ? 'volgende' : 'gepland';
      var kv = s.kv && s.kv.naam ? ' · KV ' + esc(s.kv.naam) : '';
      var rechts;
      if (s.slot === 'vrij') {
        var vorige = stops[i - 1], volgende = stops[i + 1];
        var omhoogUit = !vorige || vorige.slot !== 'vrij', omlaagUit = !volgende || volgende.slot !== 'vrij';
        rechts = '<div class="pijlen"><button type="button" data-act="wissel" data-a="' + s.taak_id + '" data-b="omhoog" aria-label="Eerder in de rit"' + (omhoogUit ? ' disabled' : '') + '>▲</button>'
          + '<button type="button" data-act="wissel" data-a="' + s.taak_id + '" data-b="omlaag" aria-label="Later in de rit"' + (omlaagUit ? ' disabled' : '') + '>▼</button></div>';
      } else rechts = '<div class="slot" aria-label="Vast door kantoor">🔒</div>';
      return '<div class="ts' + (klaar ? ' klaar' : nu ? ' nu' : '') + '"><div class="tijd">' + esc(s.tijd || '') + '</div><div class="dot"></div>'
        + '<div class="box" role="button" tabindex="0" data-act="stop" data-a="' + s.taak_id + '"><div class="nm">' + esc(stopNaam(s)) + '<b>' + esc(typeLabel(s.type)) + ' · ' + stuksWoord(meeStuks(s)) + kv + '</b></div>'
        + '<span class="chip">' + chip + '</span>' + rechts + '</div></div>';
    }).join('');
    var vasten = stops.filter(function (s) { return s.slot !== 'vrij'; }), heeftVrij = stops.some(function (s) { return s.slot === 'vrij'; });
    var uitleg = !stops.length ? '<div class="uitleg leeg">Geen stops gepland.</div>'
      : heeftVrij ? '<div class="uitleg">▲▼ wisselt alleen met een aangrenzende vrije stop' + (vasten.length ? ' · ' + esc(vasten.map(stopNaam).join(', ')) + (vasten.length === 1 ? ' staat' : ' staan') + ' vast door kantoor' : '') + '</div>' : '';
    var h = stops.filter(function (s) { return s.volgorde === huidig && s.status !== 'gedaan'; })[0];
    var nr = h ? stops.indexOf(h) + 1 : 0;
    var prim = h ? '<button type="button" class="prim" data-act="stop" data-a="' + h.taak_id + '">Open stop ' + nr + ': ' + esc(stopNaam(h)) + ' →</button>'
      : '<button type="button" disabled>' + (stops.length ? 'Rit afgerond ✓' : 'Geen stops') + '</button>';
    var probleemStop = h || stops[0];
    return '<div class="scherm"><div class="kop"><div class="t"><span>Rit ' + datumKort(data.rit.datum) + '</span>' + pilRit(data.rit.status) + '</div><div class="s">' + esc(kopSub(data)) + '</div>' + (data.kantoor && data.kantoor.telefoon ? '<a class="belkantoor" href="tel:' + esc(data.kantoor.telefoon.replace(/[^+0-9]/g, '')) + '" style="display:inline-flex;align-items:center;min-height:44px;font-weight:700;color:#1d4ed8">📞 Bel kantoor · ' + esc(data.kantoor.telefoon) + '</a>' : '') + '</div>'
      + '<div class="legenda"><span>🔒 <b>vast</b> door kantoor</span><span>▲▼ <b>vrij</b>: wissel van plaats</span></div>'
      + '<div class="tl">' + tl + '</div>' + uitleg + '<div style="height:12px"></div></div>'
      + '<div class="nav"><button type="button" class="rood" data-act="probleem-open" data-a="' + (probleemStop ? probleemStop.taak_id : '') + '" aria-label="Probleem melden"' + (probleemStop ? '' : ' disabled') + '>⚠</button>' + prim + '</div>';
  }

  // ── Stop-scherm ──
  function rekGroepen(regels) {
    var g = {}, volgorde = [];
    regels.forEach(function (r) {
      var k = r.rek ? 'REK ' + r.rek : (r.is_bulk || r.soort === 'pool' ? 'POOL' : 'OVERIG');
      if (!g[k]) { g[k] = []; volgorde.push(k); }
      g[k].push(r);
    });
    var rang = function (k) { return /^REK /.test(k) ? 0 : k === 'POOL' ? 1 : 2; };
    volgorde.sort(function (a, b) { return rang(a) - rang(b) || a.localeCompare(b); });
    return volgorde.map(function (k) { return { naam: k, regels: g[k] }; });
  }
  function eenheden(r) { return r.is_bulk ? (r.aantal_geladen || 0) : (r.geladen ? (r.qty || 1) : 0); }
  function stukHtml(r) {
    var nm = schoonNaam(r.naam, r.code), nietMee = isNietMee(r), gespl = isGesplitst(r);
    var emoji = r.soort === 'attribuut' ? '🎭' : r.soort === 'vast' ? '🧰' : r.is_bulk ? '🚲' : '📦';
    var ph = '<div class="ph">' + (r.foto_url ? '<img src="' + esc(r.foto_url) + '" alt="" loading="lazy" onerror="this.replaceWith(document.createTextNode(\'' + emoji + '\'))">' : emoji) + '</div>';
    var totaal = r.qty + (gespl ? r.niet_mee.aantal : 0);
    var sub = r.is_bulk ? eenheden(r) + ' van ' + totaal + ' geladen · tik voor aantal' : (r.code ? esc(r.code) + ' · ' : '') + '×' + r.qty;
    if (r.is_bulk && r.code) sub = esc(r.code) + ' · ' + sub;
    if (r.geleverd === false) sub += ' <span class="pil" style="background:#ffedd5;color:#c2410c">niet geleverd</span>'; // TF1 G10
    var melding = nietMee ? '<i>' + esc(REDEN_TEKST[r.niet_mee.reden] || 'niet mee') + ' → blijft open als nieuwe taak</i>'
      : gespl ? '<i>' + r.niet_mee.aantal + ' ' + esc(REDEN_TEKST[r.niet_mee.reden] || 'niet mee') + ' → blijven open als nieuwe taak</i>' : '';
    var k1 = nietMee ? '<button type="button" class="k rood" data-act="nietmee-terug" data-a="' + r.check_id + '" aria-label="Terugdraaien"><span>✕</span>' + esc(REDEN_TEKST[r.niet_mee.reden] || 'niet mee') + '</button>'
      : '<button type="button" class="k' + (r.geladen ? ' aan' : '') + '" data-act="laden" data-a="' + r.check_id + '"><span>' + (r.geladen ? (r.is_bulk ? eenheden(r) : '✓') : '↑') + '</span>' + (r.geladen ? 'geladen' : 'laden') + '</button>';
    var k2 = '<button type="button" class="k' + (r.gelost ? ' aan' : '') + '" data-act="lossen" data-a="' + r.check_id + '"><span>' + (r.gelost ? '✓' : '↓') + '</span>' + (r.gelost ? 'gelost' : 'lossen') + '</button>';
    return '<div class="stuk' + (nietMee ? ' past' : '') + '">' + ph + '<div class="nm" role="button" tabindex="0" data-act="nietmee-open" data-a="' + r.check_id + '">' + esc(nm) + '<b>' + sub + '</b>' + melding + '</div>' + k1 + k2 + '</div>';
  }
  function stopHtml(data, taakId) {
    var idx = -1;
    data.stops.forEach(function (s, i) { if (s.taak_id === taakId) idx = i; });
    if (idx < 0) return dagHtml(data);
    var s = data.stops[idx], r = data.rit, n = data.stops.length;
    var sub = [r.chauffeur, r.voertuig].filter(Boolean);
    var soort = typeLabel(s.type).replace(/^./, function (c) { return c.toUpperCase(); }) + (s.tijd ? ' · ' + esc(s.tijd) : '') + ' · ' + (s.slot === 'vrij' ? '↕ vrij' : '🔒 vast');
    var van = s.type === 'ophaling' ? (s.naar && s.naar.naam ? 'naar ' + esc(s.naar.naam) : '') : (s.van && s.van.naam ? 'van ' + esc(s.van.naam) : '');
    var adres = s.locatie && s.locatie.adres ? esc(s.locatie.adres) : '';
    var regelKop = [van, adres].filter(Boolean).join(' · ');
    var contacten = '';
    if (s.kv && (s.kv.naam || s.kv.telefoon)) contacten += belblok(s.kv.naam ? esc(s.kv.naam) + ' (KV)' : 'KV', s.kv.telefoon);
    if (s.locatie && (s.locatie.contact_naam || s.locatie.contact_telefoon)) contacten += belblok('Sleutel' + (s.locatie.contact_naam ? ' · ' + esc(s.locatie.contact_naam) : ''), s.locatie.contact_telefoon);
    var sleutel = s.locatie && s.locatie.sleutel_info ? '<div class="sleutel">🔑 ' + esc(s.locatie.sleutel_info) + '</div>' : '';
    var kaart = '<div class="kaart"><div class="soort">' + soort + '</div><div class="naar">' + esc(stopNaam(s)) + '</div>' + (regelKop ? '<div class="van">' + regelKop + '</div>' : '') + sleutel
      + (contacten ? '<div class="contact">' + contacten + '</div>' : '') + '</div>';
    var aan = s.status === 'aangekomen' || s.status === 'gedaan';
    var groot = aan ? '<button type="button" class="groot klaar" disabled>' + (s.status === 'gedaan' ? '✓ Stop afgerond' : '✓ Aangekomen') + '</button>'
      : '<button type="button" class="groot" data-act="aangekomen" data-a="' + s.taak_id + '">📍 Ik ben aangekomen</button>';
    var groepen = rekGroepen(s.regels).map(function (g) {
      var mee = g.regels.filter(function (x) { return !isNietMee(x); });
      var tot = mee.reduce(function (a, x) { return a + (x.qty || 1); }, 0), gel = mee.reduce(function (a, x) { return a + eenheden(x); }, 0);
      return (tot > 0 ? '<div class="rek"><span>' + esc(g.naam) + '</span><span>' + gel + ' van ' + tot + ' geladen</span></div>' : '') + g.regels.map(stukHtml).join('');
    }).join('');
    var volgende = data.stops[idx + 1];
    var prim = volgende ? '<button type="button" class="prim" data-act="stop" data-a="' + volgende.taak_id + '">Stop ' + (idx + 2) + ' →</button>'
      : '<button type="button" class="prim" data-act="dag">Terug naar dag</button>';
    return '<div class="scherm"><div class="kop"><div class="t"><button type="button" class="terug" data-act="dag">← Dag</button><span class="pil">STOP ' + (idx + 1) + ' VAN ' + n + '</span></div>'
      + '<div class="s">Rit ' + datumKort(r.datum) + (sub.length ? ' · ' + esc(sub.join(' · ')) : '') + '</div></div>'
      + kaart + groot + groepen + '<div style="height:12px"></div></div>'
      + '<div class="nav"><button type="button" class="rood" data-act="probleem-open" data-a="' + s.taak_id + '" aria-label="Probleem melden">⚠</button>'
      + '<button type="button" data-act="hint-nietmee">Past niet / niet gevonden</button>' + prim + '</div>';
  }
  function belblok(titel, tel) {
    var nr = String(tel || '').replace(/[^\d+]/g, '');
    if (!tel) return '<div><b>' + titel + '</b>geen nummer</div>';
    return '<a href="tel:' + esc(nr) + '"><b>' + titel + '</b>📞 ' + esc(tel) + '</a>';
  }

  // ── Overlays ──
  function vindRegel(data, checkId) {
    var res = null;
    data.stops.forEach(function (s) { s.regels.forEach(function (r) { if (r.check_id === checkId) res = { regel: r, stop: s }; }); });
    return res;
  }
  var NM_OPTS = [['past_niet', '🚚', 'Past niet meer in de wagen'], ['niet_gevonden', '🔍', 'Niet gevonden in de stockage'], ['kapot', '💥', 'Kapot / niet bruikbaar']];
  var PR_OPTS = [['gesloten', '🚪', 'Locatie gesloten / geen sleutel'], ['past_niet_lokaal', '📦', 'Materiaal past niet in het lokaal'], ['anders', '⚠', 'Iets anders']];
  function optsHtml(opts, gekozen, act) {
    return opts.map(function (o) { return '<button type="button" class="opt' + (o[0] === gekozen ? ' gekozen' : '') + '" data-act="' + act + '" data-a="' + o[0] + '">' + o[1] + ' ' + o[2] + '</button>'; }).join('');
  }
  function pastNietHtml(data, sheet) {
    var f = vindRegel(data, sheet.checkId);
    if (!f) return '';
    var r = f.regel;
    var bulk = r.is_bulk && (r.qty + (isGesplitst(r) ? r.niet_mee.aantal : 0)) > 1;
    var totaal = r.qty + (isGesplitst(r) ? r.niet_mee.aantal : 0);
    return '<div class="dim" data-act="sluit-bg"><div class="sheet" role="dialog" aria-modal="true"><h3>' + esc(schoonNaam(r.naam, r.code)) + (r.code ? ' (' + esc(r.code) + ')' : '') + ' niet mee</h3>'
      + '<p>Wat is er aan de hand? Kantoor maakt er een nieuwe taak van.</p>'
      + optsHtml(NM_OPTS, sheet.reden, 'nietmee-reden')
      + (bulk ? '<label class="lbl" for="nm-aantal">Hoeveel gaan NIET mee? (van ' + totaal + ')</label><input class="getal" id="nm-aantal" type="number" inputmode="numeric" min="1" max="' + totaal + '" value="' + esc(sheet.aantal) + '" data-f="aantal">' : '')
      + '<textarea placeholder="Opmerking (optioneel)" data-f="opmerking">' + esc(sheet.opmerking) + '</textarea>'
      + '<div class="knoppen"><button type="button" data-act="sluit">Annuleren</button><button type="button" class="rood" data-act="nietmee-ok"' + (sheet.bezig ? ' disabled' : '') + '>Markeer: blijft open</button></div></div></div>';
  }
  function probleemHtml(data, sheet) {
    var s = data.stops.filter(function (x) { return x.taak_id === sheet.taakId; })[0];
    if (!s) return '';
    var kv = s.kv && s.kv.naam ? s.kv.naam : '';
    return '<div class="dim" data-act="sluit-bg"><div class="sheet" role="dialog" aria-modal="true"><h3>Probleem bij ' + esc(stopNaam(s)) + '</h3>'
      + '<p>Gaat naar kantoor' + (kv ? ' en naar KV ' + esc(kv) : '') + '.</p>'
      + optsHtml(PR_OPTS, sheet.soort, 'probleem-soort')
      + '<textarea placeholder="Wat is er aan de hand?" data-f="tekst">' + esc(sheet.tekst) + '</textarea>'
      + '<button type="button" class="foto' + (sheet.foto ? ' ok' : '') + '" data-act="foto">' + (sheet.foto ? '✓ Foto toegevoegd · tik om te wijzigen' : '📷 Foto toevoegen') + '</button>'
      + '<div class="knoppen"><button type="button" data-act="sluit">Annuleren</button><button type="button" class="prim" data-act="probleem-ok"' + (sheet.bezig ? ' disabled' : '') + '>Versturen</button></div></div></div>';
  }
  function schermHtml(data, st) {
    var basis = st.scherm === 'stop' ? stopHtml(data, st.taakId) : dagHtml(data);
    var sheet = '';
    if (st.sheet && st.sheet.type === 'nietmee') sheet = pastNietHtml(data, st.sheet);
    else if (st.sheet && st.sheet.type === 'probleem') sheet = probleemHtml(data, st.sheet);
    return basis + sheet;
  }

  // ── Logica ──
  // deps: { token, fetch(url,opts), toast(tekst,goed), mount(html), kiesFoto():Promise<dataURL>, onNav(scherm,taakId), bewaar(data), geladen():data|null }
  function createApp(deps) {
    var st = { scherm: 'dag', taakId: null, sheet: null }, data = null, offlineGemeld = false;
    var base = '/api/rit-token/' + encodeURIComponent(deps.token);
    function teken() { if (data) deps.mount(schermHtml(data, st)); }
    // TF2 G3: tijdens een deploy geeft de proxy 502/503/504 (of is de verbinding even weg): na 2 s en 5 s nog twee keer proberen.
    // POST's worden alleen herhaald bij 502/503/504 (de app is dan niet bereikt) en bij een netwerkfout als de aanroep idempotent is (idem=true).
    var herhaalMelding = false;
    async function haal(url, opts, idem) {
      var wacht = deps.wacht || function (ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); };
      var get = !opts || !opts.method || opts.method === 'GET', pauzes = [2000, 5000], r, fout;
      for (var i = 0; ; i++) {
        r = null; fout = null;
        try { r = await deps.fetch(url, opts); } catch (e) { fout = e; }
        var weg = fout ? (get || idem) : (r.status === 502 || r.status === 503 || r.status === 504);
        if (!weg || i >= pauzes.length) { if (fout) throw fout; return r; }
        if (!herhaalMelding) { deps.toast('Even geduld, de app wordt bijgewerkt…', true); herhaalMelding = true; }
        await wacht(pauzes[i]);
      }
    }
    async function post(pad, body) {
      var r;
      try { r = await haal(base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }, false); }
      catch (e) { deps.toast('Geen verbinding — probeer het zo opnieuw.', false); return null; }
      var j = null; try { j = await r.json(); } catch (e) { /* leeg antwoord */ }
      if (!r.ok) { deps.toast((j && j.error) || 'Dat lukte niet (' + r.status + ').', false); return null; }
      return j || {};
    }
    async function laad() {
      try {
        var r = await haal(base + '/data');
        var j = await r.json();
        if (!r.ok) { deps.toast(j.error || 'Rit laden mislukt.', false); return false; }
        data = j; offlineGemeld = false;
        if (deps.bewaar) deps.bewaar(j);
        if (st.scherm === 'stop' && !data.stops.some(function (s) { return s.taak_id === st.taakId; })) st.scherm = 'dag';
        teken(); return true;
      } catch (e) {
        if (!data && deps.geladen) data = deps.geladen();
        if (!offlineGemeld) { deps.toast('Geen verbinding — laatste stand getoond.', false); offlineGemeld = true; }
        teken(); return false;
      }
    }
    function ga(scherm, taakId) { st.scherm = scherm; st.taakId = taakId || null; st.sheet = null; if (deps.onNav) deps.onNav(scherm, st.taakId); teken(); }
    async function klik(act, a, b) {
      var id = a === '' || a == null ? null : (isNaN(+a) ? a : +a);
      switch (act) {
        case 'dag': return ga('dag');
        case 'stop': return ga('stop', id);
        case 'wissel': {
          var j = await post('/taken/' + id + '/wissel', { richting: b });
          if (j) { await laad(); }
          return;
        }
        case 'aangekomen': {
          var ja = await post('/taken/' + id + '/aangekomen');
          if (ja) { deps.toast('✓ Aankomst doorgegeven', true); await laad(); }
          return;
        }
        case 'laden': case 'lossen': {
          var jl = await post('/checks/' + id + '/' + act);
          if (jl) { await laad(); }
          return;
        }
        case 'hint-nietmee': deps.toast('Tik op de naam van het stuk dat niet mee kan', true); return;
        case 'nietmee-open': {
          var f = vindRegel(data, id);
          if (!f) return;
          if (isNietMee(f.regel)) { deps.toast('Dit stuk staat op niet mee — tik rechts op ✕ om terug te draaien', true); return; }
          st.sheet = { type: 'nietmee', checkId: id, reden: 'past_niet', opmerking: '', aantal: 1 }; return teken();
        }
        case 'nietmee-reden': st.sheet.reden = a; return teken();
        case 'nietmee-ok': {
          var sh = st.sheet, fr = vindRegel(data, sh.checkId);
          var body = { reden: sh.reden, opmerking: (sh.opmerking || '').trim() };
          if (fr && fr.regel.is_bulk) {
            var totaal = fr.regel.qty + (isGesplitst(fr.regel) ? fr.regel.niet_mee.aantal : 0), niet = parseInt(sh.aantal, 10);
            if (isNaN(niet) || niet < 1 || niet > totaal) { deps.toast('Geef een aantal tussen 1 en ' + totaal + '.', false); return; }
            if (niet < totaal) body.aantal = totaal - niet; // server: aantal = wat WEL mee gaat
          }
          sh.bezig = true; teken();
          var jn = await post('/checks/' + sh.checkId + '/niet-mee', body);
          st.sheet = null;
          if (jn) deps.toast('✓ Gemarkeerd: blijft open voor kantoor', true);
          await laad(); teken(); return;
        }
        case 'nietmee-terug': {
          var jt = await post('/checks/' + id + '/niet-mee', { reden: null });
          if (jt) { deps.toast('✓ Teruggedraaid', true); await laad(); }
          return;
        }
        case 'probleem-open': if (id == null) return; st.sheet = { type: 'probleem', taakId: id, soort: 'gesloten', tekst: '', foto: '' }; return teken();
        case 'probleem-soort': st.sheet.soort = a; return teken();
        case 'foto': {
          if (!deps.kiesFoto) return;
          try { var d = await deps.kiesFoto(); if (d) { st.sheet.foto = d; teken(); } } catch (e) { deps.toast('Foto kiezen mislukt.', false); }
          return;
        }
        case 'probleem-ok': {
          var p = st.sheet, kies = p.soort || 'gesloten';
          if (kies === 'anders' && !(p.tekst || '').trim()) { deps.toast('Beschrijf kort wat er mis is.', false); return; }
          p.bezig = true; teken();
          var stop = data.stops.filter(function (s) { return s.taak_id === p.taakId; })[0];
          var jp = await post('/taken/' + p.taakId + '/probleem', { soort: kies, tekst: (p.tekst || '').trim(), foto_data: p.foto || '' });
          st.sheet = null;
          if (jp) deps.toast('✓ Gemeld aan kantoor' + (stop && stop.kv && stop.kv.naam ? ' en ' + stop.kv.naam : ''), true);
          teken(); return;
        }
        case 'sluit': st.sheet = null; return teken();
        default: return;
      }
    }
    function zet(veld, waarde) { if (st.sheet) st.sheet[veld] = waarde; }
    return { laad: laad, klik: klik, zet: zet, ga: ga, staat: function () { return st; }, data: function () { return data; } };
  }
  var api = { esc: esc, datumKort: datumKort, schoonNaam: schoonNaam, dagHtml: dagHtml, stopHtml: stopHtml, pastNietHtml: pastNietHtml, probleemHtml: probleemHtml, schermHtml: schermHtml, createApp: createApp, isNietMee: isNietMee, isGesplitst: isGesplitst };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RitPagina = api;

  // ── Browser-opstart ──
  if (typeof document !== 'undefined' && root.__RIT_TOKEN) {
    var token = root.__RIT_TOKEN, opslag = 'rit-' + token;
    var app = createApp({
      token: token,
      fetch: function (u, o) { return root.fetch(u, o); },
      toast: function (tekst, goed) {
        var t = document.getElementById('toast');
        t.textContent = tekst; t.className = 'toast ' + (goed ? '' : 'fout ') + 'zicht';
        clearTimeout(t._tm); t._tm = setTimeout(function () { t.classList.remove('zicht'); }, 3000);
      },
      mount: function (html) {
        var el = document.getElementById('app'), sc = el.querySelector('.scherm'), y = sc ? root.scrollY : 0;
        el.innerHTML = html; root.scrollTo(0, y);
      },
      kiesFoto: function () {
        return new Promise(function (resolve, reject) {
          var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
          inp.onchange = function () {
            var f = inp.files && inp.files[0]; if (!f) return resolve('');
            var fr = new FileReader();
            fr.onerror = reject;
            fr.onload = function () {
              var img = new Image();
              img.onerror = reject;
              img.onload = function () {
                var m = 1280, w = img.width, h = img.height, k = Math.min(1, m / Math.max(w, h));
                var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
                c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                resolve(c.toDataURL('image/jpeg', 0.8));
              };
              img.src = fr.result;
            };
            fr.readAsDataURL(f);
          };
          inp.click();
        });
      },
      onNav: function (sch, id) { try { root.history.replaceState(null, '', sch === 'stop' ? '#stop-' + id : root.location.pathname + root.location.search); } catch (e) { /* ignore */ } },
      bewaar: function (d) { try { root.localStorage.setItem(opslag, JSON.stringify(d)); } catch (e) { /* vol/uit */ } },
      geladen: function () { try { return JSON.parse(root.localStorage.getItem(opslag) || 'null'); } catch (e) { return null; } }
    });
    var host = document.getElementById('app');
    host.addEventListener('click', function (e) {
      var el = e.target.closest('[data-act]');
      if (!el || el.disabled) return;
      if (el.getAttribute('data-act') === 'sluit-bg' && e.target !== el) return; // enkel klik naast de sheet
      app.klik(el.getAttribute('data-act') === 'sluit-bg' ? 'sluit' : el.getAttribute('data-act'), el.getAttribute('data-a'), el.getAttribute('data-b'));
    });
    host.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var el = e.target.closest('[role=button][data-act]');
      if (el) { e.preventDefault(); el.click(); }
    });
    host.addEventListener('input', function (e) { var f = e.target.getAttribute && e.target.getAttribute('data-f'); if (f) app.zet(f, e.target.value); });
    var m = /^#stop-(\d+)/.exec(root.location.hash || '');
    app.laad().then(function () { if (m) app.ga('stop', +m[1]); });
  }
})(typeof window !== 'undefined' ? window : globalThis);
