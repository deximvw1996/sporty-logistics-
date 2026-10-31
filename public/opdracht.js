// public/opdracht.js — BW2: dag-agenda links, opdracht rechts met wagens naast elkaar (mockup tabs 4 en 5). Gsm: scherm per wagen, ▲▼.
(function (root) {
  'use strict';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var min = function (s) { var m = /^(\d{1,2}):(\d{2})/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : null; };
  var PX = 58 / 60, DAGEN = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'], MAAND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  var SOORTEN = [['autokeuring', '🛠 Autokeuring'], ['garage', '🔧 Garage'], ['carwash', '🧽 Carwash'], ['tanken', '⛽ Tanken'], ['winkel', '📦 Ophalen winkel'], ['andere', '+ Andere']];
  function dagKop(d) { var x = new Date(d + 'T12:00:00'); return DAGEN[x.getDay()] + ' ' + x.getDate() + ' ' + MAAND[x.getMonth()]; }
  function bereik(P) {
    var a = 360, b = 900;
    P.opdrachten.forEach(function (o) { o.wagens.forEach(function (w) { var v = min(w.vertrek), e = min(w.einde); if (v != null) { a = Math.min(a, v); b = Math.max(b, v + 30); } if (e != null) b = Math.max(b, e); }); });
    P.afspraken.forEach(function (x) { var v = min(x.van), e = min(x.tot); if (v != null) { a = Math.min(a, v); b = Math.max(b, v + 30); } if (e != null) b = Math.max(b, e); });
    return { a: Math.floor(a / 60) * 60, b: Math.min(1440, Math.ceil(b / 60) * 60) };
  }
  // Blokken die tegelijk lopen staan naast elkaar.
  function agendaBlokken(P, as, gekozen) {
    var l = [];
    P.opdrachten.forEach(function (o) {
      var vs = o.wagens.map(function (w) { return min(w.vertrek); }).filter(function (x) { return x != null; }), es = o.wagens.map(function (w) { return min(w.einde); }).filter(function (x) { return x != null; });
      var v = vs.length ? Math.min.apply(null, vs) : as.a + 120, e = min(o.meting.geschat) || (es.length ? Math.max.apply(null, es) : v + 60);
      var mens = o.wagens.reduce(function (n, w) { return n + w.mensen.length; }, 0), plek = [];
      o.wagens.forEach(function (w) { w.stops.forEach(function (s) { if (plek.indexOf(s.locatie) < 0) plek.push(s.locatie); }); });
      l.push({ v: v, e: Math.max(e, v + 30), html: 'Opdracht #' + o.id + ' · ' + o.wagens.length + (o.wagens.length === 1 ? ' wagen' : ' wagens') + (mens ? ' · ' + mens + (mens === 1 ? ' mens' : ' mensen') : '') + '<span>' + esc(plek.slice(0, 3).join(', ')) + (o.meting.geschat ? ' · geschat tot ' + esc(o.meting.geschat) : '') + '</span>', k: 'o' + (o.id === gekozen ? ' act' : ''), attr: 'data-a="kies" data-o="' + o.id + '"' });
    });
    P.afspraken.forEach(function (x) {
      var v = min(x.van), e = min(x.tot) || v + 60;
      l.push({ v: v, e: Math.max(e, v + 30), html: esc(x.titel) + (x.status === 'klaar' ? ' ✓' : '') + '<span>' + esc([x.voertuig, x.wie].filter(Boolean).join(' · ')) + '</span>', k: x.status === 'klaar' ? 'g' : 'a', attr: 'data-a="afspraak" data-i="' + x.id + '"' });
    });
    l.sort(function (x, y) { return x.v - y.v; });
    var banen = []; l.forEach(function (b) { var i = 0; while (banen[i] != null && banen[i] > b.v) i++; banen[i] = b.e; b.baan = i; });
    var n = Math.max(1, banen.length), br = 100 / n;
    return l.map(function (b) { return '<div class="bl ' + b.k + '" role="button" tabindex="0" ' + b.attr + ' style="top:' + Math.round((b.v - as.a) * PX) + 'px;height:' + Math.round((b.e - b.v) * PX) + 'px;left:calc(' + b.baan * br + '% + 4px);width:calc(' + br + '% - 8px)">' + b.html + '</div>'; }).join('');
  }
  function agendaHtml(P, gekozen) {
    var as = bereik(P), uren = '';
    for (var m = as.a; m < as.b; m += 60) uren += '<div class="u">' + String(m / 60).padStart(2, '0') + ':00</div>';
    return '<h3><button class="knop licht klein" data-a="dag" data-d="-1" aria-label="Vorige dag">‹</button>' + esc(dagKop(P.datum)) + '<button class="knop licht klein" data-a="dag" data-d="1" aria-label="Volgende dag">›</button><span style="margin-left:auto;display:flex;gap:6px"><button class="knop licht klein" data-a="afspraak-nieuw">+ Afspraak</button><button class="knop klein" data-a="opdracht-nieuw">+ Opdracht</button></span></h3>'
      + '<div class="ag"><div class="h">uur</div><div class="h">Opdrachten en afspraken</div><div>' + uren + '</div><div class="c" style="height:' + Math.round((as.b - as.a) * PX) + 'px">' + agendaBlokken(P, as, gekozen) + '</div></div>'
      + '<div class="onder">De dag past zich aan: een rit om 05:30 of 21:00 verschijnt gewoon.</div>';
  }
  var STAND = { concept: 'oranje', klaargezet: 'blauw', onderweg: 'blauw', gedaan: 'groen' };
  function wagenHtml(w, P, i, act) {
    var ladTxt = w.lading && w.lading.tekst && !/^0 bakken \+ 0 losse/.test(w.lading.tekst) ? w.lading.tekst : 'geen lading';
    var vt = '<select data-a="voertuig" data-w="' + w.rit_id + '" aria-label="Voertuig"><option value="">Kies voertuig</option>' + P.voertuigen.map(function (v) { return '<option value="' + v.id + '"' + (v.id === w.voertuig.id ? ' selected' : '') + '>' + esc(v.naam) + '</option>'; }).join('') + '</select>';
    var mens = w.mensen.map(function (m) { return '<span class="mens">' + esc(m.naam) + (m.id ? '<button data-a="mens-weg" data-w="' + w.rit_id + '" data-p="' + m.id + '" aria-label="Verwijderen">×</button>' : '') + '</span>'; }).join('') + '<span class="mens plus" role="button" tabindex="0" data-a="mens" data-w="' + w.rit_id + '">+ persoon</span>';
    var laad = w.laadstops.map(function (l, n) { return '<div class="stop lade"><span class="t">' + esc(l.tijd || '') + '</span><b>' + esc(l.locatie) + '</b><div class="lad">' + esc(l.lad) + '</div>' + (w.laadstops.length > 1 ? '<div class="acties"><button data-a="laad-om" data-w="' + w.rit_id + '" data-n="' + n + '">Volgorde omdraaien</button></div>' : '') + '</div>'; }).join('');
    var stops = w.stops.map(function (s, n) {
      return '<div class="stop' + (s.samen.length ? ' ged' : '') + '"><span class="t">' + esc(s.tijd) + (s.samen.length ? ' · samen' : '') + '</span><b>' + esc(s.locatie) + '</b><div class="lad">' + esc(s.lad) + '</div>'
        + '<div class="acties"><button data-a="stop-op" data-w="' + w.rit_id + '" data-n="' + n + '" aria-label="Hoger">▲</button><button data-a="stop-neer" data-w="' + w.rit_id + '" data-n="' + n + '" aria-label="Lager">▼</button><button data-a="materiaal" data-t="' + s.taak_id + '">+ Materiaal</button>' + (P.__wagens > 1 ? '<button data-a="stop-wagen" data-t="' + s.taak_id + '">Andere wagen</button>' + (s.regels.length ? '<button data-a="stuk-wagen" data-t="' + s.taak_id + '">Stuk verplaatsen</button>' : '') : '') + '</div></div>';
    }).join('');
    var wr = w.waarschuwingen.length ? '<div class="waarsch">' + w.waarschuwingen.map(function (x) { return '⚠ ' + esc(x); }).join('<br>') + '</div>' : '';
    return '<div class="wagen' + (act ? ' act' : '') + '"><div class="wkop">' + vt + '<span class="pil" style="margin-left:auto">' + esc(ladTxt) + '</span></div><div style="display:flex;gap:4px;flex-wrap:wrap">' + mens + '</div>' + wr + laad + stops + '<button class="knop licht klein" data-a="stop" data-w="' + w.rit_id + '">+ Stop</button></div>';
  }
  function opdrachtHtml(o, P, gw) {
    if (!o) return '<div class="leeg">Kies links een opdracht, of maak er een.</div>';
    P.__wagens = o.wagens.length;
    var kolom = Math.max(o.wagens.length, 3), i0 = Math.min(gw || 0, o.wagens.length - 1);
    return '<div class="dkop"><div><h2>Opdracht #' + o.id + ' <span class="pil ' + (STAND[o.status] || '') + '">' + esc(o.status) + '</span></h2><span>' + (o.wagens.length === 1 ? 'Eén chauffeur of ploeg, één wagen.' : o.wagens.length + ' wagens. Paars = dezelfde stop, ze helpen er samen.') + '</span></div><div style="margin-left:auto;display:flex;gap:8px"><button class="knop licht" data-a="wagen">+ Wagen</button><button class="knop" data-a="klaarzet"' + (o.status === 'concept' ? '' : ' disabled') + '>Klaarzetten</button></div></div>'
      + '<div style="display:flex;gap:18px;align-items:center;font-size:13px;margin-bottom:10px;flex-wrap:wrap"><span>Start <b>' + esc(o.start || '—') + '</b></span><span>Geschatte eindtijd <input type="time" class="veld" style="width:96px" data-a="einde" value="' + esc(o.meting.geschat) + '" aria-label="Geschatte eindtijd"></span><span style="color:#64748b">' + (o.meting.echt_start ? esc(o.meting.tekst) : 'na afloop: echt') + (o.meting.vorig ? ' · eerder geschat ' + esc(o.meting.vorig) : '') + '</span></div>'
      + '<div class="gsmtabs">' + o.wagens.map(function (w, i) { return '<button class="' + (i === i0 ? 'act' : '') + '" data-a="gsmwagen" data-i="' + i + '">' + esc(w.voertuig.naam || 'Wagen ' + (i + 1)) + '</button>'; }).join('') + '</div>'
      + '<div class="grid3" style="grid-template-columns:repeat(' + kolom + ',minmax(220px,1fr))">' + o.wagens.map(function (w, i) { return wagenHtml(w, P, i, i === i0); }).join('') + '</div>'
      + '<div class="onder">Elke persoon ziet op de gsm alleen zijn eigen wagen en stops, plus wie er op een gedeelde stop meewerkt. Eén chauffeur alleen = dezelfde opdracht met één wagen.</div>';
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { agendaHtml: agendaHtml, opdrachtHtml: opdrachtHtml, bereik: bereik };
  if (typeof document === 'undefined') return;
  var q = new URLSearchParams(location.search), iso = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var DAG = q.get('datum') || iso(new Date()), RIT = +q.get('rit') || 0, OID = 0, GW = 0, P = null;
  var $ = function (i) { return document.getElementById(i); };
  var api = function (m, u, b) { return root.sportyApi ? root.sportyApi(m, u, b) : null; };
  var toast = function (t, k) { if (root.sportyToast) root.sportyToast(t, k); else { var c = $('toasts'), e = document.createElement('div'); e.style.cssText = 'position:fixed;right:16px;bottom:16px;padding:12px 16px;border-radius:10px;font-weight:600;color:#fff;z-index:60;background:' + (k === 'error' ? '#dc2626' : k === 'warn' ? '#d97706' : '#16a34a'); e.textContent = t; c.appendChild(e); setTimeout(function () { e.remove(); }, 5000); } };
  var A = async function (m, u, b) { var tok = ''; try { tok = localStorage.getItem('sporty-auth-token') || ''; } catch (e) { /* geen opslag */ } var r = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json', 'x-auth-token': tok }, body: b ? JSON.stringify(b) : undefined }); var j = {}; try { j = await r.json(); } catch (e) { /* leeg */ } if (r.status === 401) location.href = '/login?terug=' + encodeURIComponent(location.pathname + location.search); return { ok: r.ok, status: r.status, json: j }; };
  var O = function () { return P && P.opdrachten.filter(function (o) { return o.id === OID; })[0]; };
  function teken() { $('agenda').innerHTML = agendaHtml(P, OID); $('opdracht').innerHTML = opdrachtHtml(O(), P, GW); }
  async function laad() {
    var r = await A('GET', '/api/opdrachten?datum=' + DAG); if (!r.ok) return toast(r.json.error || 'Laden mislukt', 'error');
    P = r.json;
    if (RIT) { var h = P.opdrachten.filter(function (o) { return o.wagens.some(function (w) { return w.rit_id === RIT; }); })[0]; if (h) OID = h.id; RIT = 0; }
    if (!O()) OID = P.opdrachten[0] ? P.opdrachten[0].id : 0;
    teken();
  }
  // Eenvoudig venster; geeft de ingevulde waarden terug.
  function vraag(titel, html, okTekst) {
    return new Promise(function (ok) {
      $('overlay').innerHTML = '<div class="modal" role="dialog" aria-modal="true"><div class="mbox"><h3>' + esc(titel) + '</h3>' + html + '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px"><button class="knop licht" data-v="nee">Annuleren</button><button class="knop" data-v="ja">' + esc(okTekst || 'Bewaren') + '</button></div></div></div>';
      $('overlay').onclick = function (e) {
        var c = e.target.closest('.chip[data-s]'); if (c) { $('overlay').querySelectorAll('.chip[data-s]').forEach(function (x) { x.classList.remove('act'); }); c.classList.add('act'); return; }
        var b = e.target.closest('[data-v]'); if (!b) return;
        var uit = null; if (b.dataset.v === 'ja') { uit = {}; $('overlay').querySelectorAll('[name]').forEach(function (i) { uit[i.name] = i.value; }); var k = $('overlay').querySelector('.chip.act[data-s]'); if (k) uit.soort = k.dataset.s; }
        $('overlay').innerHTML = ''; $('overlay').onclick = null; ok(uit);
      };
    });
  }
  var sel = function (naam, lijst, leeg, gekozen) { return '<select class="veld" name="' + naam + '">' + (leeg ? '<option value="">' + esc(leeg) + '</option>' : '') + lijst.map(function (x) { return '<option value="' + x.id + '"' + (x.id === gekozen ? ' selected' : '') + '>' + esc(x.naam) + '</option>'; }).join('') + '</select>'; };
  var lbl = function (t, h) { return '<label><span class="lbl">' + esc(t) + '</span>' + h + '</label>'; };
  document.addEventListener('click', async function (e) {
    var el = e.target.closest('[data-a]'); if (!el || el.tagName === 'SELECT' || el.tagName === 'INPUT') return;
    var a = el.dataset.a, o = O(), wid = +el.dataset.w, r;
    var meld = function (x) { if (!x.ok) toast(x.json.error || 'Dat lukte niet', 'error'); else if (x.json.melding) toast(x.json.melding, 'warn'); return x.ok; };
    if (a === 'dag') { var d = new Date(DAG + 'T12:00:00'); d.setDate(d.getDate() + +el.dataset.d); DAG = iso(d); OID = 0; return laad(); }
    if (a === 'kies') { OID = +el.dataset.o; GW = 0; return teken(); }
    if (a === 'gsmwagen') { GW = +el.dataset.i; return teken(); }
    if (a === 'opdracht-nieuw') {
      var v = await vraag('Nieuwe opdracht', lbl('Vertrek', '<input class="veld" type="time" name="vertrek" value="08:00">') + lbl('Geschatte eindtijd', '<input class="veld" type="time" name="einde">') + lbl('Wie', sel('personeel_id', P.personeel, 'Nog niemand')) + lbl('Voertuig', sel('voertuig_id', P.voertuigen, 'Nog geen')), 'Maken'); if (!v) return;
      r = await A('POST', '/api/opdrachten', { datum: DAG, vertrek: v.vertrek, einde: v.einde, personeel_id: v.personeel_id || null, voertuig_id: v.voertuig_id || null }); if (meld(r)) { OID = r.json.id; await laad(); } return;
    }
    if (a === 'afspraak-nieuw') {
      var v2 = await vraag('+ Afspraak in de agenda', '<span class="lbl">Soort</span><div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">' + SOORTEN.map(function (s, i) { return '<span class="chip' + (i === 1 ? ' act' : '') + '" data-s="' + s[0] + '" role="button" tabindex="0">' + s[1] + '</span>'; }).join('') + '</div>' + lbl('Voertuig', sel('voertuig_id', P.voertuigen, 'Geen')) + lbl('Wie', sel('personeel_id', P.personeel, 'Niemand'))
        + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">' + lbl('Datum', '<input class="veld" type="date" name="datum" value="' + DAG + '">') + lbl('Van', '<input class="veld" type="time" name="van" value="08:00">') + lbl('Tot (geschat)', '<input class="veld" type="time" name="tot" value="09:30">') + '</div>' + lbl('Waar en notitie', '<input class="veld" name="waar">')
        + '<div style="font-size:13px;color:#92400e;background:#fef3c7;border-radius:8px;padding:8px 10px;margin-bottom:12px">Het voertuig staat op dat moment als bezet: een rit ermee geeft een melding.</div>', 'In agenda zetten'); if (!v2) return;
      r = await A('POST', '/api/afspraken', v2); if (meld(r)) await laad(); return;
    }
    if (a === 'afspraak') {
      var af = P.afspraken.filter(function (x) { return x.id === +el.dataset.i; })[0]; if (!af) return;
      var v3 = await vraag(af.titel, '<p style="font-size:14px;margin:0 0 8px">' + esc([af.van + (af.tot ? '–' + af.tot : ''), af.voertuig, af.wie, af.waar].filter(Boolean).join(' · ')) + (af.echte_einde ? '<br>echt klaar ' + esc(af.echte_einde) : '') + '</p>', af.status === 'klaar' ? 'Sluiten' : 'Klaar'); if (!v3) return;
      if (af.status !== 'klaar') { r = await A('POST', '/api/afspraken/' + af.id + '/klaar'); if (meld(r)) await laad(); } return;
    }
    if (!o) return;
    if (a === 'wagen') { r = await A('POST', '/api/opdrachten/' + o.id + '/wagens', { vertrek: o.start }); if (meld(r)) await laad(); return; }
    if (a === 'klaarzet') { r = await A('POST', '/api/opdrachten/' + o.id + '/klaarzet'); if (meld(r)) { toast(r.json.klaargezet + ' wagen(s) klaargezet', 'success'); await laad(); } return; }
    if (a === 'mens') { var v4 = await vraag('+ persoon', lbl('Wie', sel('personeel_id', P.personeel))); if (!v4) return; r = await A('POST', '/api/wagens/' + wid + '/personen', v4); if (meld(r)) await laad(); return; }
    if (a === 'mens-weg') { r = await A('DELETE', '/api/wagens/' + wid + '/personen/' + el.dataset.p); if (meld(r)) await laad(); return; }
    if (a === 'stop') {
      var v5 = await vraag('+ Stop', lbl('Soort', '<select class="veld" name="type"><option value="levering">Lossen of helpen</option><option value="ophaling">Ophalen</option></select>') + lbl('Laden in (van)', '<select class="veld" name="van"><option value="">Geen lading</option>' + P.stockages.map(function (s) { return '<option value="' + s.id + '">' + esc(s.naam) + '</option>'; }).join('') + '</select>') + lbl('Locatie', sel('naar', P.locaties)) + lbl('Tijd', '<input class="veld" type="time" name="tijd" value="' + esc(o.start || '') + '">'), 'Stop toevoegen'); if (!v5) return;
      r = await A('POST', '/api/ritten/' + wid + '/stops', { type: v5.type, van_locatie_id: +v5.van || +v5.naar, naar_locatie_id: +v5.naar, tijd: v5.tijd }); if (meld(r)) await laad(); return;
    }
    if (a === 'stop-op' || a === 'stop-neer') {
      var w = o.wagens.filter(function (x) { return x.rit_id === wid; })[0], ids = w.stops.map(function (s) { return s.taak_id; }), n = +el.dataset.n, m = a === 'stop-op' ? n - 1 : n + 1; if (m < 0 || m >= ids.length) return;
      var t0 = ids[n]; ids[n] = ids[m]; ids[m] = t0; r = await A('PUT', '/api/ritten/' + wid + '/stops/volgorde', { taak_ids: ids }); if (meld(r)) await laad(); return;
    }
    if (a === 'laad-om') { var w2 = o.wagens.filter(function (x) { return x.rit_id === wid; })[0]; r = await A('PUT', '/api/wagens/' + wid + '/laadvolgorde', { locatie_ids: w2.laadstops.map(function (l) { return l.locatie_id; }).reverse() }); if (meld(r)) await laad(); return; }
    var wagenNamen = o.wagens.map(function (x, i) { return { id: x.rit_id, naam: (x.voertuig.naam || 'Wagen ' + (i + 1)) + (x.mensen.length ? ' · ' + x.mensen[0].naam : '') }; });
    if (a === 'stop-wagen') { var v6 = await vraag('Stop naar een andere wagen', lbl('Wagen', sel('rit_id', wagenNamen))); if (!v6) return; r = await A('POST', '/api/transport-taken/' + el.dataset.t + '/naar-wagen', { rit_id: +v6.rit_id }); if (meld(r)) await laad(); return; }
    if (a === 'stuk-wagen') {
      var bron = null, alle = []; o.wagens.forEach(function (x, i) { x.stops.forEach(function (s) { if (s.taak_id === +el.dataset.t) bron = s; else alle.push({ id: s.taak_id, naam: (x.voertuig.naam || 'Wagen ' + (i + 1)) + ' · ' + s.locatie }); }); });
      if (!alle.length) return toast('Maak eerst een stop op de andere wagen', 'warn');
      var v7 = await vraag('Stuk verplaatsen', lbl('Stuk', sel('regel', bron.regels.map(function (g) { return { id: g.id, naam: g.naam }; }))) + lbl('Naar stop', sel('taak_id', alle))); if (!v7) return;
      r = await A('POST', '/api/transport-regels/' + v7.regel + '/naar-stop', { taak_id: +v7.taak_id }); if (meld(r)) await laad(); return;
    }
    if (a === 'materiaal') {
      var v8 = await vraag('+ Materiaal', lbl('Vrije tekst of naam', '<input class="veld" name="naam">') + lbl('Aantal', '<input class="veld" type="number" min="1" name="qty" value="1">'), 'Toevoegen'); if (!v8 || !v8.naam.trim()) return;
      var z = await A('GET', '/api/rit-materiaal?q=' + encodeURIComponent(v8.naam.trim())), hit = z.ok && z.json.resultaten.filter(function (x) { return x.naam.toLowerCase().indexOf(v8.naam.trim().toLowerCase()) >= 0; })[0];
      r = await A('POST', '/api/transport-taken/' + el.dataset.t + '/regels', hit ? { bron: hit.bron, id: hit.id, qty: +v8.qty || 1 } : { bron: 'tekst', naam: v8.naam.trim(), qty: +v8.qty || 1 }); if (meld(r)) await laad(); return;
    }
  });
  document.addEventListener('change', async function (e) {
    var el = e.target, a = el.dataset && el.dataset.a; if (!a) return;
    var r = a === 'voertuig' ? await A('PUT', '/api/ritten/' + el.dataset.w, { voertuig_id: el.value ? +el.value : null }) : a === 'einde' ? await A('PUT', '/api/opdrachten/' + OID, { einde: el.value }) : null;
    if (r) { if (!r.ok) toast(r.json.error || 'Bewaren mislukt', 'error'); el.blur(); await laad(); }
  });
  root.addEventListener('sporty-live', laad);
  laad();
})(typeof window !== 'undefined' ? window : globalThis);
