// public/nakijken.js — VC1: Voorraad & controles › Nakijken (design/mockup-voorraad-nakijken.html) + A4-printlijst (design/mockup-aanvullen-gsm.html, rechts).
// Pure HTML-bouwers (lijstHtml, detailHtml, printRijenHtml, …) zijn exporteerbaar; de browser-opstart staat onderaan.
(function (root) {
  'use strict';
  function kvL(n){return /^KV\s/i.test(n)?n:'KV '+n;}
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
  var MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  function dagLang(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); if (!m) return esc(iso || ''); var d = new Date(+m[1], +m[2] - 1, +m[3]); return DAGEN[d.getDay()].slice(0, 2) + ' ' + d.getDate() + ' ' + MAANDEN[d.getMonth()].slice(0, 3) + ' ' + d.getFullYear(); }

  var FILTERS = [['te_keuren', 'Te keuren'], ['niet_geteld', 'Niet geteld'], ['met_tekort', 'Met tekort'], ['met_kapot', 'Met kapot'], ['nagekeken', 'Nagekeken']];
  var PIL = { te_keuren: ['oranje', 'te keuren'], niet_geteld: ['', 'niet geteld'], nagekeken: ['groen', 'nagekeken'] };
  var sleutel = function (b) { return b.kampmoment_id + ':' + b.bak.soort + ':' + b.bak.id; };

  function passeert(b, st) {
    var f = st.filter;
    if (f === 'te_keuren' || f === 'niet_geteld' || f === 'nagekeken') { if (b.status !== f) return false; }
    else if (f === 'met_tekort') { if (!b.met_tekort) return false; }
    else if (f === 'met_kapot') { if (!b.met_kapot) return false; }
    var z = (st.zoek || '').trim().toLowerCase();
    if (z && [b.locatie, b.kv_naam, b.bak.code, b.bak.naam, b.uitslag_tekst].join(' ').toLowerCase().indexOf(z) < 0) return false;
    return true;
  }
  function zichtbaar(data, st) { return (data.bakken || []).filter(function (b) { return passeert(b, st); }); }

  // ── Lijst (links) ──
  function lijstHtml(data, st) {
    var t = data.tellers || {};
    var chips = FILTERS.map(function (f) { return '<span class="chip' + (st.filter === f[0] ? ' act' : '') + '" role="button" tabindex="0" data-act="filter" data-a="' + f[0] + '">' + f[1] + ' ' + (t[f[0]] || 0) + '</span>'; }).join('')
      + '<span class="wk"><span class="chip" role="button" tabindex="0" data-act="week" data-a="-1" aria-label="Vorige week">‹</span><span class="chip">Week ' + esc(data.week && data.week.weeknummer != null ? data.week.weeknummer : '—') + '</span><span class="chip" role="button" tabindex="0" data-act="week" data-a="1" aria-label="Volgende week">›</span></span>';
    var rijen = zichtbaar(data, st);
    var sel = st.geselecteerd || new Set();
    var alleSel = rijen.length && rijen.every(function (b) { return b.sessie_id && sel.has(b.sessie_id); });
    var body = rijen.map(function (b) {
      var p = PIL[b.status] || PIL.niet_geteld;
      var kan = !!b.sessie_id;
      return '<div class="r l' + (st.open === sleutel(b) ? ' act' : '') + '" role="button" tabindex="0" data-act="open" data-a="' + esc(sleutel(b)) + '"><span><input type="checkbox" data-act="vink" data-a="' + (b.sessie_id || '') + '"' + (kan ? '' : ' disabled') + (kan && sel.has(b.sessie_id) ? ' checked' : '') + ' aria-label="Selecteer"></span>'
        + '<span><b>' + esc(b.locatie) + '</b><br><small>wk ' + esc(b.week) + (b.kv_naam ? ' · ' + esc(b.kv_naam) : '') + '</small></span>'
        + '<span>' + esc(b.bak.code) + ' ' + esc(b.bak.naam) + '</span><span>' + b.geteld + '/' + b.totaal + (b.bak.soort === 'attribuut' ? '' : ' geteld') + '</span><span>' + esc(b.uitslag_tekst) + '</span><span><span class="pil ' + p[0] + '">' + p[1] + '</span></span></div>';
    }).join('') || '<div class="leeg">' + ((data.bakken || []).length ? 'Niets in deze filter.' : 'Geen kampmomenten in deze week — kies een andere week.') + '</div>';
    return '<div class="filters"><input type="search" id="zoek" placeholder="🔍 Zoek locatie, bak, KV, stuk…" value="' + esc(st.zoek || '') + '" data-f="zoek">' + chips + '</div>'
      + '<div class="kopr l"><span><input type="checkbox" data-act="vink-alles"' + (alleSel ? ' checked' : '') + ' aria-label="Alles selecteren"></span><span>Locatie · KV</span><span>Bak</span><span>Geteld</span><span>Uitslag</span><span>Status</span></div>'
      + '<div class="scroll">' + body + '</div>'
      + '<div class="voet' + (sel.size ? ' sel' : '') + '" id="voet"><span>' + rijen.length + ' bak' + (rijen.length === 1 ? '' : 'ken') + (sel.size ? ' · <span class="n">' + sel.size + ' geselecteerd</span>' : '') + '</span>'
      + '<span class="bulk"><button type="button" class="knop klein" data-act="bulk-afronden">Keuring afronden</button><button type="button" class="knop licht klein" data-act="bulk-herinnering">Herinnering naar KV</button><button type="button" class="knop licht klein" data-act="printlijst">Printlijst</button></span></div>';
  }

  // ── Detail (rechts) ──
  var LABEL = {
    bestellen: function (n) { return 'Bestellen (' + n + ')'; }, uit_pool: function () { return 'Uit pool aanvullen'; }, aanvaarden: function () { return 'Aanvaarden'; },
    naar_pool: function (n) { return 'Terug naar pool (' + n + ')'; }, laten_staan: function () { return 'Laten staan'; },
    afschrijven_bestellen: function (n) { return 'Afschrijven (' + n + ') + bestellen'; }, herstellen: function () { return 'Herstellen'; }
  };
  var actieLabel = function (a, n) { return (LABEL[a] || function () { return a; })(n); };
  function afwPil(it) {
    if (it.afwijking === 'tekort') return '<span class="pil rood">−' + (it.verwacht - it.aangetroffen) + '</span>';
    if (it.afwijking === 'te_veel') return '<span class="pil blauw">+' + (it.aangetroffen - it.verwacht) + '</span>';
    if (it.afwijking === 'kapot') return '<span class="pil oranje">💥 ' + it.kapot_aantal + '</span>';
    if (it.afwijking === 'niet_geteld') return '<span class="pil">niet geteld</span>';
    return '<span class="pil groen">klopt</span>';
  }
  var KLEUR = { tekort: 'rood', te_veel: 'blauw', kapot: 'oranje', klopt: 'groen', niet_geteld: '' };
  function actieCel(it) {
    if (it.afwijking === 'klopt') return '<span class="pil groen">✓</span>';
    if (it.afwijking === 'niet_geteld' || !it.acties.length) return '<span class="not">—</span>';
    var gekozen = it.kantoor_actie || it.acties[0].waarde, n = it.kantoor_aantal || it.aantal_afwijking;
    return '<select data-act="actie" data-a="' + (it.regel_id || '') + '" data-n="' + esc(it.aantal_afwijking) + '" aria-label="Actie kantoor voor ' + esc(it.naam) + '"' + (it.regel_id ? '' : ' disabled') + '>' + it.acties.map(function (o) { return '<option value="' + esc(o.waarde) + '"' + (o.waarde === gekozen ? ' selected' : '') + '>' + esc(actieLabel(o.waarde, n)) + '</option>'; }).join('') + '</select>';
  }
  function telTabel(det) {
    var rijen = det.items.map(function (it) {
      return '<div class="r tel ' + (KLEUR[it.afwijking] || '') + '"><span><b>' + esc(it.naam) + '</b>' + (it.foto_url ? ' 📷' : '') + '</span><span>' + it.verwacht + '</span><span><b>' + (it.aangetroffen == null ? '—' : it.aangetroffen) + '</b></span><span>' + afwPil(it) + '</span><span class="not">' + (it.notitie ? esc(it.notitie) : '—') + '</span><span>' + actieCel(it) + '</span></div>';
    }).join('') || '<div class="leeg">Deze bak heeft geen stukken.</div>';
    var afw = det.items.filter(function (i) { return i.afwijking !== 'klopt' && i.afwijking !== 'niet_geteld'; });
    var gekozen = function (i) { return i.kantoor_actie || (i.acties[0] && i.acties[0].waarde) || ''; };
    var bestel = afw.filter(function (i) { return gekozen(i) === 'bestellen' || gekozen(i) === 'afschrijven_bestellen'; }).length;
    var afschr = afw.filter(function (i) { return gekozen(i) === 'afschrijven_bestellen'; }).length;
    return '<div class="blok"><h4>Telling KV vs. verwacht · kies per afwijking wat kantoor doet</h4><div class="kopr tel"><span>Stuk</span><span>Hoort</span><span>Geteld</span><span>Afwijking</span><span>Notitie KV</span><span>Actie kantoor</span></div>'
      + rijen + '<div class="onder"><span>' + afw.length + ' afwijking' + (afw.length === 1 ? '' : 'en') + ' · ' + bestel + ' bestelling' + (bestel === 1 ? '' : 'en') + ' klaar om te plaatsen · ' + afschr + ' afschrijving' + (afschr === 1 ? '' : 'en') + '</span>'
      + '<button type="button" class="knop licht klein" data-act="notitie-open">Notitie aan KV</button></div></div>';
  }
  function histBlok(det, titel) {
    var h = det.historiek || [];
    return '<div class="blok"><h4>' + titel + '</h4>' + (h.map(function (x) { return '<div class="rij"><div class="nm">' + esc(x.tekst) + '<b>' + esc(x.tijd ? tijdKort(x.tijd) : '') + (x.wie ? ' · ' + esc(x.wie) : '') + '</b></div></div>'; }).join('') || '<div class="leeg" style="padding:12px">Nog niets gelogd.</div>') + '</div>';
  }
  function tijdKort(t) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(t || '');
    if (m) { var d = new Date(t); if (!isNaN(d)) return DAGEN[d.getDay()].slice(0, 2) + ' ' + d.getDate() + ' ' + MAANDEN[d.getMonth()].slice(0, 3) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
    return t;
  }
  function detailHtml(det, st) {
    if (!det) return '<div class="leeg">Kies links een bak om na te kijken.</div>';
    var a = det.afwijkingen || {};
    var pils = [a.tekort ? '<span class="pil rood">tekort ' + a.tekort + '</span>' : '', a.te_veel ? '<span class="pil blauw">te veel ' + a.te_veel + '</span>' : '', a.kapot ? '<span class="pil oranje">kapot ' + a.kapot + '</span>' : ''].filter(Boolean).join(' ');
    var wie = det.kv_naam ? (det.ingediend_op ? 'geteld door ' + esc(kvL(det.kv_naam)) + ', ingediend ' + esc(det.ingediend_op) : esc(kvL(det.kv_naam)) + ' heeft nog niet verstuurd') : 'nog geen KV gekoppeld';
    var fotos = det.foto_s || [];
    var tel = det.contact && det.contact.kv_telefoon ? 'tel:' + esc(String(det.contact.kv_telefoon).replace(/[^\d+]/g, '')) : '';
    var kanAfronden = det.sessie_id && det.status === 'te_keuren';
    var tab = st.tab || 'telling';
    var inhoud;
    if (tab === 'vorige') inhoud = '<div class="dgrid" style="grid-template-columns:1fr"><div class="blok"><h4>Vorige tellingen van deze bak</h4>' + ((det.vorige_tellingen || []).map(function (v) { return '<div class="rij"><div class="nm">' + esc(v.locatie) + ' · week ' + esc(v.week) + '<b>' + esc(v.datum) + (v.kv_naam ? ' · KV ' + esc(v.kv_naam) : '') + '</b></div><span class="pil">' + esc(v.uitslag) + '</span></div>'; }).join('') || '<div class="leeg" style="padding:12px">Geen eerdere tellingen.</div>') + '</div></div>';
    else if (tab === 'historiek') inhoud = '<div class="dgrid" style="grid-template-columns:1fr">' + histBlok(det, 'Historiek (alles gelogd)') + '</div>';
    else inhoud = '<div class="dgrid een">' + telTabel(det) + histBlok(det, 'Historiek (alles gelogd)') + '</div>';
    return '<div class="detail"><div class="dkop"><div><h2>' + esc(det.bak.code) + (det.bak.code ? ' · ' : '') + esc(det.bak.naam) + ' · ' + esc(det.locatie) + '</h2><span>week ' + esc(det.week) + ' · ' + wie + ' · ' + det.geteld + ' van ' + det.totaal + ' stuks ' + pils + '</span></div>'
      + '<div class="acts"><button type="button" class="knop licht" data-act="bak-openen">Bak openen</button><button type="button" class="knop licht" data-act="fotos"' + (fotos.length ? '' : ' disabled') + '>Foto\'s ' + fotos.length + '</button>'
      + (tel ? '<a class="knop licht" href="' + tel + '">KV bellen</a>' : '<button type="button" class="knop licht" disabled>KV bellen</button>')
      + '<button type="button" class="knop" data-act="afronden"' + (kanAfronden ? '' : ' disabled') + '>Keuring afronden ✓</button></div></div>'
      + '<div class="dtabs"><a class="' + (tab === 'telling' ? 'act' : '') + '" data-act="tab" data-a="telling" role="button" tabindex="0">Telling</a><a class="' + (tab === 'vorige' ? 'act' : '') + '" data-act="tab" data-a="vorige" role="button" tabindex="0">Vorige tellingen ' + (det.vorige_tellingen || []).length + '</a><a class="' + (tab === 'historiek' ? 'act' : '') + '" data-act="tab" data-a="historiek" role="button" tabindex="0">Historiek ' + (det.historiek || []).length + '</a></div>'
      + inhoud + '</div>';
  }
  function fotoOverlayHtml(det) {
    return '<div class="dim" data-act="sluit-bg"><div class="dlg" role="dialog" aria-modal="true"><h3>Foto\'s van de telling</h3><div class="fotogrid">' + (det.foto_s || []).map(function (f) { return '<figure><img src="' + esc(f.url) + '" alt=""><figcaption>' + esc(f.stuk) + '</figcaption></figure>'; }).join('') + '</div><div class="knoppen"><button type="button" class="knop licht" data-act="sluit">Sluiten</button></div></div></div>';
  }
  function notitieOverlayHtml(det, tekst) {
    return '<div class="dim" data-act="sluit-bg"><div class="dlg" role="dialog" aria-modal="true"><h3>Notitie aan KV ' + esc(det.kv_naam || '') + '</h3><p>De KV ziet dit in zijn scherm bij ' + esc(det.locatie) + '.</p><textarea id="notitie-tekst" placeholder="Wat wil je de KV laten weten?" data-f="notitie">' + esc(tekst || '') + '</textarea><div class="knoppen"><button type="button" class="knop licht" data-act="sluit">Annuleren</button><button type="button" class="knop" data-act="notitie-ok">Versturen</button></div></div></div>';
  }

  // ── Printlijst (A4) ──
  var WAT = { uit_pool: 'uit pool', naar_pool: 'naar pool', afschrijven: 'afschrijven', bestelling: 'bestelling', nakijken: 'nakijken' };
  function printRijenHtml(lijst) {
    var out = '';
    (lijst.bakken || []).forEach(function (g) {
      g.handelingen.forEach(function (h, i) {
        out += '<tr><td class="box">☐</td><td>' + (i === 0 ? '<b>' + esc(g.bak.code) + '</b><br><small>' + esc(g.plaats && g.plaats.tekst ? g.plaats.tekst : '') + (g.locatie ? ' · ' + esc(g.locatie) + ' wk ' + esc(g.week) : '') + '</small>' : '') + '</td><td>' + esc(h.stuk) + '</td><td class="c">' + esc(h.aantal) + '</td><td>' + esc(WAT[h.soort] || h.soort) + '</td><td>' + esc(h.waar_tekst) + '</td><td class="lijn"></td></tr>';
      });
    });
    return out || '<tr><td colspan="7" style="padding:24px;text-align:center;color:#555">Er is niets aan te vullen.</td></tr>';
  }
  function printSubtekst(lijst, naam) {
    var nu = new Date(), uur = String(nu.getHours()).padStart(2, '0') + ':' + String(nu.getMinutes()).padStart(2, '0');
    var dagen = {}; (lijst.bakken || []).forEach(function (g) { if (g.afgerond_op) dagen[g.afgerond_op.slice(0, 10)] = 1; });
    var uit = Object.keys(dagen).sort().map(dagLang).join(', ');
    return dagLang(lijst.datum) + (uit ? ' · uit Nakijken ' + uit : '') + ' · afgedrukt ' + uur + (naam ? ' door ' + naam : '') + ' · ' + (lijst.tellers ? lijst.tellers.totaal : 0) + ' handelingen';
  }

  var api = { esc: esc, lijstHtml: lijstHtml, detailHtml: detailHtml, telTabel: telTabel, fotoOverlayHtml: fotoOverlayHtml, notitieOverlayHtml: notitieOverlayHtml, printRijenHtml: printRijenHtml, printSubtekst: printSubtekst, zichtbaar: zichtbaar, sleutel: sleutel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NakijkenPagina = api;

  // ── Browser ──
  if (typeof document === 'undefined') return;
  var TOKEN = root.localStorage.getItem('sporty-auth-token');
  var $ = function (id) { return document.getElementById(id); };
  function toast(msg, type) {
    if (!$('toasts')) { var c = document.createElement('div'); c.id = 'toasts'; c.style.cssText = 'position:fixed;bottom:20px;right:20px;display:flex;flex-direction:column;gap:8px;z-index:100;font:14px system-ui;color:#fff'; document.body.appendChild(c); }
    var t = document.createElement('div');
    t.style.cssText = 'padding:12px 16px;border-radius:10px;font-weight:600;cursor:pointer';
    t.style.background = { info: '#378ADD', error: '#E24B4A', success: '#1D9E75', warn: '#EF9F27' }[type || 'info']; t.textContent = msg; t.onclick = function () { t.remove(); };
    $('toasts').appendChild(t); setTimeout(function () { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 300); }, type === 'error' ? 5000 : 3000);
  }
  async function aanroep(methode, url, body) {
    var r, j = {};
    try { r = await root.fetch(url, { method: methode, headers: { 'Content-Type': 'application/json', 'x-auth-token': TOKEN || '' }, body: body ? JSON.stringify(body) : undefined }); }
    catch (e) { toast('Geen verbinding — probeer het zo opnieuw.', 'error'); return { ok: false, status: 0, json: {} }; }
    try { j = await r.json(); } catch (e) { /* leeg */ }
    return { ok: r.ok, status: r.status, json: j };
  }
  async function download() {
    var r = await aanroep('GET', '/api/export');
    if (!r.ok) { toast(r.json.error || 'Export mislukt', 'error'); return; }
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(r.json, null, 1)], { type: 'application/json' })); a.download = 'sporty-export.json'; a.click();
  }

  // Printpagina (/aanvullijst-print)
  if ($('print-blad')) {
    if (!TOKEN) { root.location.href = '/'; return; }
    var q = new URLSearchParams(root.location.search), datum = q.get('datum') || '';
    (async function () {
      var r = await aanroep('GET', '/api/aanvullijst' + (datum ? '?datum=' + encodeURIComponent(datum) : ''));
      if (r.status === 401 || r.status === 403) { root.location.href = '/'; return; }
      if (!r.ok) { $('print-blad').innerHTML = '<p>' + esc(r.json.error || 'De lijst kon niet geladen worden.') + '</p>'; return; }
      $('pk-sub').textContent = printSubtekst(r.json, r.json.afgedrukt_door); $('rijen').innerHTML = printRijenHtml(r.json);
      $('print-knop').onclick = function () { root.print(); };
    })();
    return;
  }
  if (!$('nk-app')) return;
  if (!TOKEN) { root.location.href = '/'; return; }

  var DATA = null, DETAIL = null, ST = { filter: 'te_keuren', zoek: '', geselecteerd: new Set(), open: null, tab: 'telling', week: new URLSearchParams(root.location.search).get('week') || '' };
  var verschuiving = 0;
  function tekenLijst() {
    var zoekEl = document.activeElement && document.activeElement.id === 'zoek' ? document.activeElement : null;
    var pos = zoekEl ? zoekEl.selectionStart : 0;
    $('lijst').innerHTML = lijstHtml(DATA, ST);
    if (zoekEl) { var z = $('zoek'); z.focus(); z.setSelectionRange(pos, pos); }
  }
  function tekenDetail() { $('detail').innerHTML = detailHtml(DETAIL, ST); }
  function tekenAlles() { tekenLijst(); tekenDetail(); }
  async function laadLijst() {
    var r = await aanroep('GET', '/api/nakijken' + (ST.week ? '?week=' + ST.week : ''));
    if (r.status === 401 || r.status === 403) { root.location.href = '/'; return; }
    if (!r.ok) { toast(r.json.error || 'Nakijken laden mislukt', 'error'); return; }
    DATA = r.json;
    if (!ST.weekGezet && DATA.week && DATA.week.maandag) { ST.week = DATA.week.maandag; }
    var t = DATA.tellers;
    if (!ST.startFilterGezet) { ST.startFilterGezet = true; if (!t.te_keuren) ST.filter = ''; }
    $('b-nakijken').textContent = t.te_keuren; $('b-nakijken').hidden = !t.te_keuren;
    $('printlijst').href = '/aanvullijst-print';
    tekenLijst();
  }
  async function laadDetail(sleutelStr) {
    var b = (DATA.bakken || []).filter(function (x) { return sleutel(x) === sleutelStr; })[0];
    if (!b) return;
    ST.open = sleutelStr;
    var r = b.sessie_id ? await aanroep('GET', '/api/nakijken/sessie/' + b.sessie_id) : await aanroep('GET', '/api/nakijken/bak?kampmoment_id=' + b.kampmoment_id + '&bak=' + b.bak.soort + ':' + b.bak.id);
    if (!r.ok) { toast(r.json.error || 'Detail laden mislukt', 'error'); return; }
    DETAIL = r.json; tekenAlles();
  }
  async function laadBovenaan() {
    var s = await aanroep('GET', '/api/nakijk-tekorten');
    if (s.ok && Array.isArray(s.json)) {
      var open = 0, besteld = 0;
      s.json.forEach(function (x) { (x.tekorten || []).forEach(function (r) { open++; if (r.tekort_status === 'besteld') besteld++; }); });
      $('s-tekorten').textContent = 'Tekorten ' + open; $('s-bestellingen').textContent = 'Bestellingen ' + besteld;
    }
    var p = await aanroep('GET', '/api/periodes');
    if (p.ok && Array.isArray(p.json)) { var a = p.json.filter(function (x) { return x.actief; })[0] || p.json[0]; if (a) $('per-naam').textContent = a.naam; }
    try { var u = JSON.parse(root.localStorage.getItem('sporty-auth-user') || '{}'); $('wie').textContent = (u.naam || '') + (u.rol ? ' · ' + u.rol : ''); } catch (e) { /* ignore */ }
  }
  async function ververs() { var open = ST.open; await laadLijst(); if (open) await laadDetail(open); laadBovenaan(); }
  var weekVan = function (n) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ST.week || ''); if (!m) return ''; var d = new Date(+m[1], +m[2] - 1, +m[3] + 7 * n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  document.addEventListener('click', async function (e) {
    var el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
    var act = el.getAttribute('data-act'), a = el.getAttribute('data-a');
    if (act === 'vink') { var id = +a; if (!id) return; if (el.checked) ST.geselecteerd.add(id); else ST.geselecteerd.delete(id); tekenLijst(); e.stopPropagation(); return; }
    if (e.target.matches('input[type=checkbox]') || e.target.tagName === 'SELECT' || e.target.tagName === 'OPTION') return;
    if (act === 'vink-alles') { var rijen = zichtbaar(DATA, ST); var alle = rijen.length && rijen.every(function (b) { return b.sessie_id && ST.geselecteerd.has(b.sessie_id); }); rijen.forEach(function (b) { if (b.sessie_id) { if (alle) ST.geselecteerd.delete(b.sessie_id); else ST.geselecteerd.add(b.sessie_id); } }); tekenLijst(); return; }
    if (act === 'filter') { ST.filter = ST.filter === a ? '' : a; tekenLijst(); return; }
    if (act === 'week') { var nw = weekVan(+a); if (!nw) return; ST.week = nw; ST.weekGezet = true; ST.geselecteerd = new Set(); ST.open = null; DETAIL = null; await laadLijst(); tekenDetail(); return; }
    if (act === 'open') { await laadDetail(a); return; }
    if (act === 'tab') { ST.tab = a; tekenDetail(); return; }
    if (act === 'fotos') { $('overlay').innerHTML = fotoOverlayHtml(DETAIL); return; }
    if (act === 'sluit' || (act === 'sluit-bg' && e.target === el)) { $('overlay').innerHTML = ''; return; }
    if (act === 'notitie-open') { $('overlay').innerHTML = notitieOverlayHtml(DETAIL, ''); $('notitie-tekst').focus(); return; }
    if (act === 'notitie-ok') {
      var tekst = ($('notitie-tekst').value || '').trim();
      if (!tekst) { toast('Schrijf eerst een notitie.', 'warn'); return; }
      var r = await aanroep('POST', '/api/nakijken/notitie', { kampmoment_id: DETAIL.kampmoment_id, tekst: tekst });
      if (!r.ok) { toast(r.json.error || 'Versturen mislukt', 'error'); return; }
      $('overlay').innerHTML = ''; toast('✓ Notitie naar de KV verstuurd', 'success'); return;
    }
    if (act === 'bak-openen') { root.location.href = '/#materiaal?bak=' + DETAIL.bak.id; return; }
    if (act === 'afronden') {
      var r2 = await aanroep('POST', '/api/nakijken/sessie/' + DETAIL.sessie_id + '/afronden');
      if (!r2.ok) { toast(r2.json.error || 'Afronden mislukt', 'error'); return; }
      toast('✓ Keuring afgerond' + (r2.json.bestellingen ? ' · ' + r2.json.bestellingen + ' bestelling(en)' : ''), 'success'); await ververs(); return;
    }
    if (act === 'bulk-afronden') {
      var r3 = await aanroep('POST', '/api/nakijken/afronden', { sessie_ids: Array.from(ST.geselecteerd) });
      if (!r3.ok) { toast(r3.json.error || 'Afronden mislukt', 'error'); return; }
      var n = r3.json.afgerond.length, o = r3.json.overgeslagen.length;
      toast('✓ ' + n + ' keuring' + (n === 1 ? '' : 'en') + ' afgerond' + (o ? ' · ' + o + ' overgeslagen (KV heeft niet verstuurd)' : ''), o ? 'warn' : 'success'); ST.geselecteerd = new Set(); await ververs(); return;
    }
    if (act === 'bulk-herinnering') {
      var kms = {}; (DATA.bakken || []).forEach(function (b) { if (b.sessie_id && ST.geselecteerd.has(b.sessie_id)) kms[b.kampmoment_id] = 1; });
      var ids = Object.keys(kms); if (!ids.length) { toast('Selecteer eerst een bak met een telling.', 'warn'); return; }
      var gedaan = 0; for (var i = 0; i < ids.length; i++) { var rr = await aanroep('POST', '/api/nakijken/herinnering', { kampmoment_id: +ids[i] }); if (rr.ok) gedaan++; else toast(rr.json.error || 'Herinnering mislukt', 'error'); }
      if (gedaan) toast('✓ Herinnering naar ' + gedaan + ' KV' + (gedaan === 1 ? '' : "'s") + ' verstuurd', 'success'); return;
    }
    if (act === 'printlijst') { root.open('/aanvullijst-print', '_blank'); return; }
  });
  document.addEventListener('change', async function (e) {
    var el = e.target; if (el.getAttribute && el.getAttribute('data-act') === 'actie') {
      var id = +el.getAttribute('data-a'); if (!id) return;
      var r = await aanroep('PUT', '/api/nakijken/regel/' + id, { kantoor_actie: el.value, kantoor_aantal: +el.getAttribute('data-n') || 0 });
      if (!r.ok) { toast(r.json.error || 'Opslaan mislukt', 'error'); await laadDetail(ST.open); return; }
      toast('✓ Opgeslagen', 'success'); await laadDetail(ST.open);
    }
  });
  document.addEventListener('input', function (e) { if (e.target.getAttribute && e.target.getAttribute('data-f') === 'zoek') { ST.zoek = e.target.value; tekenLijst(); } });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') $('overlay').innerHTML = '';
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role=button][data-act]')) { e.preventDefault(); e.target.click(); }
  });
  $('export').addEventListener('click', function (e) { e.preventDefault(); download(); });
  (async function () {
    var q = new URLSearchParams(root.location.search), s = q.get('sessie'), km = q.get('kampmoment_id'), bk = q.get('bak');
    if (s || (km && bk)) {
      var v = await aanroep('GET', s ? '/api/nakijken/sessie/' + encodeURIComponent(s) : '/api/nakijken/bak?kampmoment_id=' + encodeURIComponent(km) + '&bak=' + encodeURIComponent(bk));
      if (v.ok && v.json.maandag) { ST.week = v.json.maandag; ST.weekGezet = true; }
    }
    await laadLijst(); laadBovenaan(); tekenDetail();
    var doel = null;
    if (s) doel = (DATA.bakken || []).filter(function (b) { return String(b.sessie_id) === s; })[0];
    else if (km && bk) doel = (DATA.bakken || []).filter(function (b) { return String(b.kampmoment_id) === km && b.bak.soort + ':' + b.bak.id === bk; })[0];
    if (doel) { ST.filter = ''; tekenLijst(); await laadDetail(sleutel(doel)); }
    else if (s || (km && bk)) toast('Die bak staat niet in deze week.', 'warn');
  })();
})(typeof window !== 'undefined' ? window : globalThis);
