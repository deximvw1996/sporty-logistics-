// public/kampmomenten.js — PL1: Planning › Kampmomenten (design/mockup-planning.html) op het kantoorpatroon.
// Lijst uit GET /api/kampmomenten-overzicht, detail uit GET /api/kampmomenten/:id/detail; schrijven via de bestaande routes
// + PUT /velden, POST /kv-links, /genereer-transport, /verwijderen. Pure HTML-bouwers zijn exporteerbaar (tests); de browser-opstart staat onderaan.
(function (root) {
  'use strict';
  function kvL(n){return /^KV\s/i.test(n)?n:'KV '+n;}
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var DAG7 = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'], KOOK = ['ma', 'di', 'wo', 'do', 'vr'];
  var tijdTekst = function (s) {
    var d = /^\d{4}-\d{2}-\d{2}T/.test(s || '') ? new Date(s) : null;
    if (!d || isNaN(d)) return s || '';
    return d.toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '') + ' ' + d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
  };

  // ── Filters ──
  var FILTERS = {
    periode: function () { return true; },
    zonder_thema: function (k) { return !k.themas.length; },
    zonder_kv: function (k) { return !k.kv; },
    conflict: function (k) { return k.conflict || k.aandacht.some(function (a) { return /^thema dubbel/.test(a); }); }
  };
  function passeert(k, st) {
    var f = st.filter || 'periode';
    if (/^week:/.test(f)) { if (String(k.week) !== f.slice(5)) return false; }
    else if (FILTERS[f] && !FILTERS[f](k)) return false;
    var z = (st.zoek || '').trim().toLowerCase();
    return !z || k.zoek.indexOf(z) >= 0;
  }
  var zichtbaar = function (O, st) { return (O.kampmomenten || []).filter(function (k) { return passeert(k, st); }); };

  function chipsHtml(O, st) {
    var t = O.tellers || {}, f = st.filter || 'periode';
    var chip = function (key, tekst) { return '<span class="chip' + (f === key ? ' act' : '') + '" role="button" tabindex="0" data-f="' + key + '">' + tekst + '</span>'; };
    var weken = Object.keys(t.per_week || {}).sort(function (a, b) { return a - b; });
    return chip('periode', esc(O.periode ? O.periode.naam : 'Periode') + ' · ' + (t.totaal || 0))
      + weken.map(function (w) { return chip('week:' + w, 'Week ' + w + ' · ' + t.per_week[w]); }).join('')
      + chip('zonder_thema', '⚠ Zonder thema ' + (t.zonder_thema || 0)) + chip('zonder_kv', '⚠ Zonder KV ' + (t.zonder_kv || 0)) + chip('conflict', 'Conflict ' + (t.conflict || 0));
  }

  // TF10: wat er precies scheelt, per punt. Hover op desktop (title), tik op gsm (popover).
  var UITLEG = [[/^geen thema$/i, 'Geen thema gekoppeld: zonder thema kan de levering niet samengesteld worden'], [/^geen kv$/i, 'Geen KV gekoppeld: de KV telt de bakken en krijgt de link'], [/^thema dubbel: ?(.*)$/i, function (m) { return 'Thema ' + m[1] + ' staat die week op meer dan één locatie: dat geeft een materiaaltekort'; }], [/^levering zonder rit$/i, 'Er is een levering die nog op geen rit staat']];
  function aandachtPunten(lijst) { return (lijst || []).map(function (a) { for (var i = 0; i < UITLEG.length; i++) { var m = UITLEG[i][0].exec(a); if (m) return typeof UITLEG[i][1] === 'function' ? UITLEG[i][1](m) : UITLEG[i][1]; } return a.charAt(0).toUpperCase() + a.slice(1); }); }
  function tipAttr(lijst) { var p = aandachtPunten(lijst); return ' title="' + esc(p.map(function (x) { return '• ' + x; }).join('\n')) + '" tabindex="0" data-tip="' + esc(p.join('\n')) + '"'; }
  var aantalTekst = function (n) { return n === 1 ? '1 aandachtspunt' : n + ' aandachtspunten'; };
  // ── Lijst ──
  function lijstHtml(O, st) {
    var rijen = zichtbaar(O, st), sel = st.sel || new Set();
    return rijen.map(function (k) {
      var dubbel = k.aandacht.filter(function (a) { return /^thema dubbel/.test(a); })[0];
      var pil = k.status === 'ok' ? '<span class="pil groen">ok</span>' : '<span class="pil oranje"' + tipAttr(k.aandacht) + '>⚠ let op' + (k.aandacht.length > 1 ? ' · ' + k.aandacht.length : '') + '</span>';
      return '<div class="r' + (st.open === k.id ? ' act' : '') + '" role="button" tabindex="0" data-id="' + k.id + '"><span><input type="checkbox" data-sel="' + k.id + '"' + (sel.has(k.id) ? ' checked' : '') + ' aria-label="Selecteer"></span>'
        + '<span><b>' + esc(k.locatie.naam) + '</b></span><span>' + esc(k.dagen_tekst) + '</span><span>' + esc(k.thema_tekst) + '</span><span>' + (k.kv ? esc(k.kv.naam) : '— geen KV') + '</span>'
        + '<span>' + esc(k.transport_tekst) + (dubbel ? '<br><small>⚠ ' + esc(dubbel) + '</small>' : '') + '</span><span>' + pil + '</span></div>';
    }).join('') || '<div class="leeg">' + ((O.kampmomenten || []).length ? 'Niets voor deze filter.' : 'Nog geen kampmomenten in deze periode — maak er een met “+ Kampmoment”.') + '</div>';
  }

  // ── Detail ──
  function dagenHtml(D) { return '<span class="dagen">' + DAG7.map(function (d, i) { return '<button type="button" class="' + (D.dagen[i] ? 'act' : '') + '" data-dag="' + i + '" aria-pressed="' + (D.dagen[i] ? 'true' : 'false') + '">' + d + '</button>'; }).join('') + '</span>'; }
  function transportRijen(D) {
    return D.transport.map(function (t) {
      return '<div class="rij"><div class="nm">' + (t.type === 'ophaling' ? 'Ophaling' : t.type === 'levering' ? 'Levering' : esc(t.type)) + ' ' + esc(t.wanneer_tekst) + (t.rit ? ' · rit #' + t.rit.id + (t.rit.chauffeur ? ' ' + esc(t.rit.chauffeur) : '') : ' · zonder rit') + '<b>' + esc(t.wat) + ' · ' + (t.status === 'gedaan' ? 'gedaan ✓' : esc(t.status)) + '</b></div><button type="button" class="knop licht klein" data-open-taak="' + t.id + '">Open</button></div>';
    }).join('') || '<div class="leeg" style="padding:14px">Nog geen transport voor dit kampmoment.</div>';
  }
  function aandachtHtml(D) {
    var rijen = [];
    if (!D.themas.length) rijen.push('<div class="rij"><div class="nm">Geen thema gekoppeld<b>zonder thema kan de levering niet samengesteld worden</b></div><button type="button" class="knop klein" data-act="thema">Kies thema</button></div>');
    if (!D.kv) rijen.push('<div class="rij"><div class="nm">Geen KV gekoppeld<b>de KV telt de bakken en krijgt de link</b></div><button type="button" class="knop klein" data-act="kv-kies">KV koppelen</button></div>');
    D.aandacht.filter(function (a) { return /^thema dubbel/.test(a); }).forEach(function (a) { rijen.push('<div class="rij"><div class="nm">' + esc(a.charAt(0).toUpperCase() + a.slice(1)) + '<b>hetzelfde thema twee keer in één week geeft een materiaaltekort</b></div><button type="button" class="knop klein" data-act="thema">Kies thema</button></div>'); });
    D.conflicten.forEach(function (c) { rijen.push('<div class="rij"><div class="nm">' + esc(c.bericht) + '<b>' + esc(c.type.replace(/_/g, ' ')) + '</b></div><button type="button" class="knop licht klein" data-act="conflicten">Open</button></div>'); });
    D.transport.filter(function (t) { return t.type === 'levering' && !t.rit && t.status === 'gepland'; }).slice(0, 1).forEach(function (t) { rijen.push('<div class="rij"><div class="nm">Levering zonder rit<b>' + esc(t.wanneer_tekst) + '</b></div><button type="button" class="knop licht klein" data-open-taak="' + t.id + '">Open</button></div>'); });
    D.aanvragen_open.forEach(function (a) { rijen.push('<div class="rij"><div class="nm">' + esc(a.soort === 'kapot' ? 'Aanvraag (kapot): ' : a.soort === 'probleem_chauffeur' ? 'Melding chauffeur: ' : 'Aanvraag: ') + esc(a.tekst) + '<b>' + esc(a.created_at || '') + ' · wacht op kantoor</b></div><button type="button" class="knop licht klein" data-act="aanvragen">Open</button></div>'); });
    return rijen.join('') || '<div class="leeg" style="padding:14px">Niets om op te letten.</div>';
  }
  function histHtml(D) {
    return D.historiek.map(function (h) { return '<div class="rij"><div class="nm">' + esc(h.tekst) + '<b>' + esc(tijdTekst(h.tijd)) + (h.wie ? ' · ' + esc(h.wie) : '') + '</b></div></div>'; }).join('') || '<div class="leeg" style="padding:14px">Nog niets gelogd.</div>';
  }
  function groepHtml(D) {
    var g = D.groep, inp = function (n, v, l) { return '<label>' + l + ' <input type="number" min="0" data-veld="' + n + '" value="' + (v == null ? '' : v) + '"></label>'; };
    return '<span class="grp">' + inp('aantal_kinderen', g.kinderen, 'kinderen') + inp('aantal_kleuters', g.kleuters, 'waarvan kleuters') + (g.lager != null ? '<span>(lager ' + g.lager + ')</span>' : '') + inp('aantal_monitoren', g.monitoren, 'monitoren') + '</span>';
  }
  function gegevensHtml(D) {
    var besch = D.themas_beschikbaar.filter(function (t) { return !t.gekozen; }).slice(0, 4).map(function (t) { return esc(t.naam); }).join(', ');
    var bezet = D.themas_bezet.slice(0, 2).map(function (t) { return esc(t.naam) + ' zit bij ' + esc(t.bij); }).join(', ');
    var themaRegel = D.themas.length ? esc(D.thema_tekst) + ' <span class="pil pillkn" data-act="thema">wijzig</span>'
      : '— nog niet gekozen <span class="pil oranje pillkn" data-act="thema">kies</span>';
    var kv = D.kv ? esc(D.kv.naam) + (D.kv.telefoon ? ' · ' + esc(D.kv.telefoon) : '') + ' · ' + (D.kv.link_gestuurd ? '<span class="pil groen">KV-link gestuurd</span>' : '<span class="pil oranje pillkn" data-act="kv-link">KV-link nog niet gestuurd</span>') : '— geen KV <span class="pil oranje pillkn" data-act="kv-kies">koppel</span>';
    var kook = '<span class="dagen">' + KOOK.map(function (d) { return '<button type="button" class="' + (D.kookdagen.indexOf(d) >= 0 ? 'act' : '') + '" data-kook="' + d + '" aria-pressed="' + (D.kookdagen.indexOf(d) >= 0 ? 'true' : 'false') + '">' + d + '</button>'; }).join('') + '</span>'
      + (D.kookdagen.length ? ' <span style="font-weight:500;color:#64748b;font-size:12px">(oven nodig: eigen oven ' + (D.heeft_eigen_oven ? 'ja' : 'nee' + (D.oven_mee ? ' → oven mee' : '')) + ')</span>' : '');
    return '<div class="dgrid een"><div class="blok"><h4>Kampmoment</h4>'
      + '<div class="kv"><span>Dagen</span><b>' + dagenHtml(D) + '</b></div>'
      + '<div class="kv"><span>Thema</span><b>' + themaRegel + '</b></div>'
      + '<div class="kv"><span>KV</span><b>' + kv + '</b></div><div class="kv"><span>Groep</span><b>' + groepHtml(D) + '</b></div><div class="kv"><span>Kookdagen</span><b>' + kook + '</b></div>'
      + '<div class="kv"><span>Opmerking</span><b style="flex:1"><textarea data-veld="opmerking" placeholder="optioneel">' + esc(D.opmerking) + '</textarea></b></div>'
      + '<h4 style="margin-top:14px">Transport voor dit kampmoment</h4>' + transportRijen(D) + '</div>'
      + '<div class="rechtsKol" style="display:flex;flex-direction:column;gap:16px;min-width:0"><div class="blok"><h4>Conflicten &amp; aandacht</h4>' + aandachtHtml(D) + '</div><div class="blok" id="hist-kader"><h4>Historiek (alles gelogd)</h4>' + histHtml(D) + '</div></div></div>'; // TF10: Historiek is een eigen kader, met ruimte ertussen
  }
  function themaTabHtml(D) {
    return '<div class="dgrid" style="grid-template-columns:1fr"><div class="blok"><h4>Thema &amp; materiaal (alleen lezen)</h4>' + (D.materiaal.map(function (m) {
      return '<div class="kv"><span style="width:auto;font-weight:700;color:#1a1a1a">' + esc(m.thema) + '</span></div>' + (m.items.map(function (i) { return '<div class="rij"><div class="nm">' + esc(i.naam) + '<b>' + esc(i.code) + ' · ' + (i.soort === 'bak' ? 'bak' : 'attribuut') + '</b></div></div>'; }).join('') || '<div class="leeg" style="padding:10px">Dit thema heeft nog geen bakken of attributen.</div>');
    }).join('') || '<div class="leeg" style="padding:14px">Nog geen thema gekozen.</div>') + '</div></div>';
  }
  function detailHtml(D, st) {
    if (!D) return '<div class="leeg">Kies links een kampmoment.</div>';
    var tab = st.tab || 'gegevens';
    var sub = [D.dagen_tekst.replace(/^wk \d+ · /, ''), D.kv ? kvL(D.kv.naam) + (D.kv.telefoon ? ' (' + D.kv.telefoon + ')' : '') : 'geen KV', D.groep.kinderen != null ? D.groep.kinderen + ' kinderen' : '', D.groep.monitoren != null ? D.groep.monitoren + ' monitoren' : ''].filter(Boolean).map(esc).join(' · ');
    var pil = D.status === 'ok' ? '<span class="pil groen">ok</span>' : '<span class="pil oranje"' + tipAttr(D.aandacht) + '>⚠ ' + esc(D.aandacht.length === 1 && D.aandacht[0].length <= 40 ? D.aandacht[0] : aantalTekst(D.aandacht.length)) + '</span>';
    var inhoud = tab === 'thema' ? themaTabHtml(D)
      : tab === 'transport' ? '<div class="dgrid" style="grid-template-columns:1fr"><div class="blok"><h4>Transport voor dit kampmoment</h4>' + transportRijen(D) + '</div></div>'
      : tab === 'telling' ? '<div class="dgrid" style="grid-template-columns:1fr"><div class="blok"><h4>Telling door de KV</h4><div class="rij"><div class="nm">Vrijdagcontrole en nakijken<b>de telling van de bakken van dit kampmoment staat in Voorraad &amp; controles › Nakijken</b></div><button type="button" class="knop" data-act="telling">Open Nakijken</button></div></div></div>'
      : tab === 'historiek' ? '<div class="dgrid" style="grid-template-columns:1fr"><div class="blok"><h4>Historiek (alles gelogd)</h4>' + histHtml(D) + '</div></div>'
      : gegevensHtml(D);
    var t = function (k, l) { return '<a class="' + (tab === k ? 'act' : '') + '" role="button" tabindex="0" data-tab="' + k + '">' + l + '</a>'; };
    return '<div class="detail"><div class="dkop"><div><h2>' + esc(D.locatie.naam) + ' · week ' + esc(D.week) + '</h2><span>' + sub + ' · ' + pil + '</span></div>'
      + '<div class="acts"><button type="button" class="knop licht" data-act="bewerken">Bewerken</button><button type="button" class="knop licht" data-act="locatie">📍 Locatie</button><button type="button" class="knop licht" data-act="kv-link">KV-link</button><button type="button" class="knop" data-act="thema">Thema kiezen</button></div></div>'
      + '<div class="dtabs">' + t('gegevens', 'Gegevens') + t('thema', 'Thema &amp; materiaal') + t('transport', 'Transport ' + D.transport.length) + t('telling', 'Telling') + t('historiek', 'Historiek ' + D.historiek.length) + '</div>' + inhoud + '</div>';
  }
  var api = { esc: esc, chipsHtml: chipsHtml, lijstHtml: lijstHtml, detailHtml: detailHtml, gegevensHtml: gegevensHtml, zichtbaar: zichtbaar };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.KampmomentenPagina = api;

  // ── Browser ──
  if (typeof document === 'undefined') return;
  var TOKEN = root.localStorage.getItem('sporty-auth-token');
  if (!TOKEN) { root.location.href = '/'; return; }
  var $ = function (id) { return document.getElementById(id); };
  function toast(msg, type) {
    var t = document.createElement('div');
    t.style.background = { info: '#378ADD', error: '#E24B4A', success: '#1D9E75', warn: '#EF9F27' }[type || 'info'];
    t.textContent = msg; t.onclick = function () { t.remove(); }; $('toasts').appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 300); }, type === 'error' ? 5000 : 3000);
  }
  async function aanroep(methode, url, body) {
    var r, j = {};
    try { return await root.sportyApi(methode, url, body, { toast: function (m) { toast(m, 'info'); }, token: TOKEN }); }
    catch (e) { toast('Geen verbinding — probeer het zo opnieuw.', 'error'); return { ok: false, status: 0, json: {} }; }
  }
  // vraagModal (zelfde gedrag als index.html): null bij annuleren, anders wat lees() teruggeeft.
  function vraag(o) {
    return new Promise(function (resolve) {
      var bg = document.createElement('div'); bg.className = 'mbg';
      bg.innerHTML = '<div class="mbox ' + (o.breed ? 'vorm-groot' : '') + '" role="dialog" aria-modal="true"><h4>' + esc(o.titel) + '</h4>' + (o.tekst ? '<p>' + esc(o.tekst) + '</p>' : '') + '<form class="form" onsubmit="return false">' + (o.html || '') + '<div class="knoppen"><button type="button" class="knop licht" data-x="0">' + esc(o.annuleer || 'Annuleren') + '</button>' + (o.ok === false ? '' : '<button type="button" class="knop" data-x="1">' + esc(o.ok || 'Bevestigen') + '</button>') + '</div></form></div>';
      var sluit = function (v) { document.removeEventListener('keydown', toets, true); bg.remove(); resolve(v); };
      var toets = function (e) { if (e.key === 'Escape') { e.preventDefault(); sluit(null); } };
      document.addEventListener('keydown', toets, true);
      bg.addEventListener('mousedown', function (e) { if (e.target === bg) sluit(null); });
      bg.querySelector('[data-x="0"]').onclick = function () { sluit(null); };
      var okb = bg.querySelector('[data-x="1"]'); if (okb) okb.onclick = function () { var v = o.lees ? o.lees(bg.querySelector('form'), bg) : {}; if (v) sluit(v); };
      if (o.na) o.na(bg);
      document.body.appendChild(bg); (bg.querySelector('select,input,textarea') || bg.querySelector('[data-x]')).focus();
    });
  }

  var Q = new URLSearchParams(root.location.search);
  var O = null, D = null, ST = { filter: Q.get('week') ? 'week:' + Q.get('week') : 'periode', zoek: '', sel: new Set(), open: null, tab: 'gegevens' }, LOCS = null, PERSONEEL = null;
  function tekenChips() { $('chips').innerHTML = chipsHtml(O, ST); }
  function tekenLijst() {
    tekenChips();
    var rijen = zichtbaar(O, ST);
    $('lijst').innerHTML = lijstHtml(O, ST);
    $('n-km').textContent = rijen.length + ' kampmoment' + (rijen.length === 1 ? '' : 'en');
    $('n-sel').textContent = ST.sel.size + ' geselecteerd';
    $('voet').classList.toggle('sel', ST.sel.size > 0);
    $('alles').checked = rijen.length > 0 && rijen.every(function (k) { return ST.sel.has(k.id); });
  }
  function tekenDetail() { $('detail').innerHTML = detailHtml(D, ST); }
  window.addEventListener('sporty-live',()=>laad()); // RT1
  async function laad() {
    var r = await aanroep('GET', '/api/kampmomenten-overzicht' + (Q.get('periode_id') ? '?periode_id=' + Q.get('periode_id') : ''));
    if (r.status === 401 || r.status === 403) { root.location.href = '/'; return; }
    if (!r.ok) return toast(r.json.error || 'Kampmomenten laden mislukt', 'error');
    O = r.json;
    ST.sel = new Set(Array.from(ST.sel).filter(function (id) { return O.kampmomenten.some(function (k) { return k.id === id; }); }));
    tekenLijst();
    var b = $('b-planning'); var n = O.tellers.zonder_thema + O.tellers.zonder_kv; b.textContent = n; b.hidden = !n;
    if (D) await laadDetail(D.id, true);
  }
  async function laadDetail(id, stil) {
    var r = await aanroep('GET', '/api/kampmomenten/' + id + '/detail');
    if (!r.ok) { if (!stil) toast(r.json.error || 'Detail laden mislukt', 'error'); D = null; ST.open = null; tekenLijst(); tekenDetail(); return; }
    D = r.json; ST.open = id; tekenLijst(); tekenDetail();
  }
  async function locaties() { if (!LOCS) { var r = await aanroep('GET', '/api/locaties'); LOCS = r.ok ? r.json.filter(function (l) { return l.type === 'kamp'; }) : []; } return LOCS; }
  async function personeel() { if (!PERSONEEL) { var r = await aanroep('GET', '/api/personeel'); PERSONEEL = r.ok ? r.json : []; } return PERSONEEL; }

  async function bewaarVelden(body, melding) {
    var r = await aanroep('PUT', '/api/kampmomenten/' + D.id + '/velden', body);
    if (!r.ok) { toast(r.json.error || 'Opslaan mislukt', 'error'); await laadDetail(D.id, true); return false; }
    if (melding) toast(melding, 'success');
    await laad(); return true;
  }
  async function toonLinks(ids) {
    var r = await aanroep('POST', '/api/kampmomenten/kv-links', { ids: ids });
    if (!r.ok) return toast(r.json.error || 'Links maken mislukt', 'error');
    var l = r.json.links, f = r.json.fouten;
    await vraag({ titel: l.length + ' KV-link' + (l.length === 1 ? '' : 's') + ' klaar', tekst: 'Kopieer de link en stuur hem zelf naar de KV (sms of mail). De link werkt zonder login.', ok: false, annuleer: 'Sluiten', breed: true,
      html: '<div style="grid-column:1/-1">' + l.map(function (x) { return '<div class="linkrij"><span><b>' + esc(x.locatie) + ' wk ' + esc(x.week) + '</b> · ' + esc(x.kv_naam) + (x.telefoon ? ' · ' + esc(x.telefoon) : '') + '<br>' + esc(x.volledig) + '</span><button type="button" class="knop licht klein" data-kopieer="' + esc(x.volledig) + '">Kopieer</button></div>'; }).join('')
        + f.map(function (x) { return '<div class="linkrij"><span>⚠ ' + esc(x.locatie || '#' + x.id) + (x.week ? ' wk ' + esc(x.week) : '') + ': ' + esc(x.reden) + '</span></div>'; }).join('') + '</div>',
      na: function (bg) { bg.addEventListener('click', async function (e) { var b = e.target.closest('[data-kopieer]'); if (!b) return; try { await root.navigator.clipboard.writeText(b.getAttribute('data-kopieer')); toast('✓ Link gekopieerd', 'success'); } catch (x) { toast('Kopiëren lukte niet — selecteer de link en kopieer zelf.', 'warn'); } }); } });
    await laad();
  }
  async function kiesThema(ids) {
    // ids: één kampmoment (detail D) of een selectie
    var kms = ids.map(function (id) { return O.kampmomenten.filter(function (k) { return k.id === id; })[0]; }).filter(Boolean);
    var details = [];
    for (var i = 0; i < kms.length; i++) { var r = await aanroep('GET', '/api/kampmomenten/' + kms[i].id + '/detail'); if (r.ok) details.push(r.json); }
    if (!details.length) return;
    var enkel = details.length === 1 ? details[0] : null;
    var themadag = enkel && enkel.type === 'themadag';
    var gemeen = details[0].themas_beschikbaar.filter(function (t) { return details.every(function (d) { return d.themas_beschikbaar.some(function (x) { return x.id === t.id; }); }); });
    // TF4 G8: thema's die die week al elders staan blijven kiesbaar (onderaan, met waar ze staan): melden, niet verbieden
    var bezetMap = {}; details.forEach(function (d) { (d.themas_bezet || []).forEach(function (t) { if (!gemeen.some(function (g) { return g.id === t.id; })) { (bezetMap[t.id] = bezetMap[t.id] || { id: t.id, naam: t.naam, bij: [] }).bij.push(t.bij); } }); });
    var bezetLijst = Object.keys(bezetMap).map(function (k) { var t = bezetMap[k]; t.bij = t.bij.filter(function (x, i, a) { return a.indexOf(x) === i; }).join(', '); return t; });
    // TF6 N14: gewone thema's vóór themadagen, zodat je niet per ongeluk het themadag-thema kiest; plus een zoekveld in de lijst.
    var dagLast = function (a, b) { return (/themadag/i.test(a.naam) ? 1 : 0) - (/themadag/i.test(b.naam) ? 1 : 0); };
    gemeen = gemeen.slice().sort(dagLast); bezetLijst = bezetLijst.slice().sort(dagLast);
    var perLg = {}; gemeen.forEach(function (t) { (perLg[t.leeftijdsgroep || 'overig'] = perLg[t.leeftijdsgroep || 'overig'] || []).push(t); });
    var html;
    if (themadag) {
      var opties = '<option value="">— geen —</option>' + gemeen.map(function (t) { return '<option value="' + t.id + '">' + esc(t.naam) + '</option>'; }).join('') + bezetLijst.map(function (t) { return '<option value="' + t.id + '">' + esc(t.naam) + ' — staat al in ' + esc(t.bij) + '</option>'; }).join('');
      html = KOOK.map(function (d, i) { var huidig = enkel.themas.filter(function (t) { return t.dag === i; })[0]; return '<label>' + d + '<select name="dag' + i + '">' + opties.replace('value="' + (huidig ? huidig.id : '-') + '"', 'value="' + (huidig ? huidig.id : '-') + '" selected') + '</select></label>'; }).join('');
    } else {
      var huidigeIds = enkel ? enkel.themas.map(function (t) { return t.id; }) : [];
      html = '<div class="thema-lijst" style="grid-column:1/-1"><input type="search" placeholder="Zoek een thema…" aria-label="Thema zoeken" style="min-height:36px;margin-bottom:6px" oninput="var q=this.value.toLowerCase();this.parentNode.querySelectorAll(&quot;label.chk&quot;).forEach(function(l){l.hidden=l.textContent.toLowerCase().indexOf(q)<0})">' + Object.keys(perLg).map(function (lg) { return '<b style="font-size:11px;text-transform:uppercase;color:#64748b;margin-top:6px">' + esc(lg) + '</b>' + perLg[lg].map(function (t) { return '<label class="chk"><input type="checkbox" name="thema" value="' + t.id + '"' + (huidigeIds.indexOf(t.id) >= 0 ? ' checked' : '') + '> ' + esc(t.naam) + '</label>'; }).join(''); }).join('') + (gemeen.length ? '' : '<div class="leeg">Geen thema vrij in deze week.</div>') + (bezetLijst.length ? '<b style="font-size:11px;text-transform:uppercase;color:#64748b;margin-top:10px">Staat die week al elders (kiezen mag, je krijgt dan een melding)</b>' + bezetLijst.map(function (t) { return '<label class="chk bezet"><input type="checkbox" name="thema" value="' + t.id + '"' + (huidigeIds.indexOf(t.id) >= 0 ? ' checked' : '') + '> ' + esc(t.naam) + ' <small>— staat al in ' + esc(t.bij) + '</small></label>'; }).join('') : '') + '</div>';
    }
    var v = await vraag({ titel: enkel ? 'Thema kiezen — ' + enkel.locatie.naam + ' week ' + enkel.week : 'Thema toewijzen aan ' + details.length + ' kampmomenten', tekst: 'Vrije thema’s staan bovenaan; wat die week al elders staat, staat onderaan en mag ook (je krijgt dan een melding).', ok: 'Opslaan', breed: true, html: html,
      lees: function (f) { return themadag ? { dagen: KOOK.map(function (d, i) { return f['dag' + i].value; }) } : { themas: Array.prototype.slice.call(f.querySelectorAll('input[name=thema]:checked')).map(function (c) { return +c.value; }) }; } });
    if (!v) return;
    var fouten = 0, gedaan = 0;
    for (var j = 0; j < details.length; j++) {
      var d = details[j];
      if (themadag) {
        for (var k = 0; k < 5; k++) {
          var huidig = d.themas.filter(function (t) { return t.dag === k; })[0], nieuw = v.dagen[k] ? +v.dagen[k] : null;
          if (huidig && (!nieuw || huidig.id !== nieuw)) await aanroep('DELETE', '/api/kampmomenten/' + d.id + '/themas/' + huidig.kt_id);
          if (nieuw && (!huidig || huidig.id !== nieuw)) { var rr = await aanroep('POST', '/api/kampmomenten/' + d.id + '/themas', { thema_id: nieuw, dag: k }); if (!rr.ok) { fouten++; toast(rr.json.error || 'Thema koppelen mislukt', 'error'); } else gedaan++; }
        }
      } else {
        var nu = d.themas.map(function (t) { return t.id; });
        if (enkel) { for (var a = 0; a < d.themas.length; a++) if (v.themas.indexOf(d.themas[a].id) < 0) await aanroep('DELETE', '/api/kampmomenten/' + d.id + '/themas/' + d.themas[a].kt_id); }
        for (var b = 0; b < v.themas.length; b++) {
          if (nu.indexOf(v.themas[b]) >= 0) continue;
          var info = gemeen.filter(function (t) { return t.id === v.themas[b]; })[0];
          var r2 = await aanroep('POST', '/api/kampmomenten/' + d.id + '/themas', { thema_id: v.themas[b], leeftijdsgroep: info && info.leeftijdsgroep === 'overig' ? '' : (info ? info.leeftijdsgroep : '') });
          if (!r2.ok) { fouten++; toast(r2.json.error || 'Thema koppelen mislukt', 'error'); } else gedaan++;
        }
      }
    }
    if (gedaan && !fouten) toast('✓ Thema opgeslagen', 'success'); else if (!gedaan && !fouten) toast('Niets gewijzigd.', 'info');
    await laad();
  }
  async function kampmomentForm(bewerk) {
    var locs = await locaties(), weken = []; for (var w = 1; w <= (O.periode ? O.periode.max_weken : 9); w++) weken.push(w);
    var k = bewerk ? D : null;
    var v = await vraag({ titel: bewerk ? 'Kampmoment bewerken' : 'Nieuw kampmoment', ok: bewerk ? 'Opslaan' : 'Aanmaken', breed: true,
      html: '<label>Locatie<select name="locatie"' + (bewerk ? ' disabled' : '') + '>' + locs.map(function (l) { return '<option value="' + l.id + '"' + (k && k.locatie.id === l.id ? ' selected' : '') + '>' + esc(l.name) + '</option>'; }).join('') + '</select></label>'
        + '<label>Week<select name="week">' + weken.map(function (x) { return '<option value="' + x + '"' + (k && k.week === x ? ' selected' : '') + '>Week ' + x + '</option>'; }).join('') + '</select></label>'
        + '<label>Soort<select name="type"><option value="kamp"' + (k && k.type === 'kamp' ? ' selected' : '') + '>Themakamp (hele week)</option><option value="themadag"' + (k && k.type === 'themadag' ? ' selected' : '') + '>Themadagen</option></select></label>'
        + '<label>Kinderen<input type="number" min="0" name="kin" value="' + (k && k.groep.kinderen != null ? k.groep.kinderen : '') + '"></label><label>Waarvan kleuters<input type="number" min="0" name="kle" value="' + (k && k.groep.kleuters != null ? k.groep.kleuters : '') + '"></label><label>Monitoren<input type="number" min="0" name="mon" value="' + (k && k.groep.monitoren != null ? k.groep.monitoren : '') + '"></label>'
        + (bewerk ? '' : '<label style="grid-column:1/-1">Dagen<span class="dagen">' + DAG7.map(function (d, i) { return '<label class="chk" style="width:auto"><input type="checkbox" name="dag" value="' + i + '"' + (i < 5 ? ' checked' : '') + '> ' + d + '</label>'; }).join('') + '</span></label>'),
      lees: function (f) { return { locatie: +f.locatie.value, week: +f.week.value, type: f.type.value, kin: f.kin.value, kle: f.kle.value, mon: f.mon.value, dagen: bewerk ? null : DAG7.map(function (d, i) { var c = f.querySelector('input[name=dag][value="' + i + '"]'); return !!(c && c.checked); }) }; } });
    if (!v) return;
    var velden = { aantal_kinderen: v.kin, aantal_kleuters: v.kle, aantal_monitoren: v.mon };
    if (bewerk) {
      var r = await aanroep('PUT', '/api/kampmomenten/' + D.id, { week: v.week, type: v.type });
      if (!r.ok) return toast(r.json.error || 'Opslaan mislukt', 'error');
      await bewaarVelden(velden, '✓ Opgeslagen'); return;
    }
    var n = await aanroep('POST', '/api/kampmomenten', { locatie_id: v.locatie, week: v.week, periode_id: O.periode.id, type: v.type });
    if (!n.ok) { await vraag({ titel: 'Dit kampmoment kan niet', tekst: n.json.error || 'Aanmaken mislukt', ok: 'OK', annuleer: '', lees: function () { return {}; } }); return; } // TF8 N16: een blijvende uitleg, geen toast die verdwijnt
    var pv = await aanroep('PUT', '/api/kampmomenten/' + n.json.id + '/velden', Object.assign({ dagen: v.dagen }, velden));
    if (!pv.ok) toast(pv.json.error || 'Dagen/groep bewaren mislukt', 'error');
    toast('✓ Kampmoment aangemaakt', 'success'); await laad(); await laadDetail(n.json.id);
  }
  async function kiesKv() {
    var pers = (await personeel()).filter(function (p) { return /kv/i.test(p.rol || ''); });
    if (!pers.length) pers = await personeel();
    var v = await vraag({ titel: 'KV koppelen — ' + D.locatie.naam + ' week ' + D.week, tekst: 'Een eerder uitgegeven KV-link vervalt als de KV wijzigt.', ok: 'Koppelen',
      html: '<label>Kampverantwoordelijke<select name="kv">' + pers.map(function (p) { return '<option value="' + p.id + '">' + esc(p.naam) + '</option>'; }).join('') + '</select></label>', lees: function (f) { return { kv: +f.kv.value }; } });
    if (!v) return;
    var r = await aanroep('PUT', '/api/kampmomenten/' + D.id, { kv_persoon_id: v.kv });
    if (!r.ok) return toast(r.json.error || 'Koppelen mislukt', 'error');
    toast('✓ KV gekoppeld', 'success'); await laad();
  }
  async function genereer(ids) {
    var doel = ids.length ? ids.length + ' geselecteerde kampmoment' + (ids.length === 1 ? '' : 'en') : 'alle kampmomenten van ' + (O.periode ? O.periode.naam : 'de periode');
    if (!await vraag({ titel: 'Transport genereren', tekst: 'Maakt leveringen en ophalingen aan voor ' + doel + ' (bestaande generator). Wat er al is, wordt niet dubbel gemaakt; de taken staan daarna nog zonder rit in Transport › Taken.', ok: 'Genereren', lees: function () { return {}; } })) return;
    var r = await aanroep('POST', '/api/kampmomenten/genereer-transport', { ids: ids, periode_id: O.periode ? O.periode.id : undefined });
    if (!r.ok) return toast(r.json.error || 'Genereren mislukt', 'error');
    var tl = function (tekst, type) { toast(tekst, type); if (r.json.aangemaakt) { var t = $('toasts').lastChild; if (t) { var a = document.createElement('a'); a.href = '/taken?alle=1'; a.textContent = ' · Bekijk in Taken ›'; a.style.cssText = 'color:#fff;font-weight:700;margin-left:6px'; a.onclick = function (ev) { ev.stopPropagation(); }; t.appendChild(a); } } };
    tl(r.json.aangemaakt ? '✓ ' + r.json.aangemaakt + ' taken aangemaakt voor ' + r.json.kampmomenten + ' kampmoment' + (r.json.kampmomenten === 1 ? '' : 'en') + (r.json.overgeslagen ? ' (' + r.json.overgeslagen + ' bestonden al)' : '') : 'Niets nieuws te genereren' + (r.json.overgeslagen ? ' — ' + r.json.overgeslagen + ' bestonden al' : ''), r.json.aangemaakt ? 'success' : 'info');
    if (r.json.verleden && r.json.verleden.length) toast('⚠ ' + r.json.verleden.length + ' levering' + (r.json.verleden.length === 1 ? ' heeft' : 'en hebben') + ' een datum in het verleden (' + r.json.verleden.map(function (x) { return x.datum; }).filter(function (d, i, a) { return a.indexOf(d) === i; }).join(', ') + '). Controleer de datum in Taken.', 'warn');
    await laad();
  }

  // TF10: tik op een "let op" toont de punten (gsm heeft geen hover); een tweede tik of een tik elders sluit ze.
  document.addEventListener('click', function (e) {
    var oud = document.getElementById('tip-pop'); if (oud) oud.remove();
    var pil = e.target.closest && e.target.closest('[data-tip]');
    if (!pil) return;
    e.stopPropagation();
    if (oud && oud.dataset.van === pil.getAttribute('data-tip')) return;
    var b = pil.getBoundingClientRect(), d = document.createElement('div'); d.id = 'tip-pop'; d.dataset.van = pil.getAttribute('data-tip'); d.setAttribute('role', 'tooltip');
    d.style.cssText = 'position:fixed;z-index:2000;max-width:320px;background:#1e293b;color:#fff;border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.4;box-shadow:0 8px 24px rgba(0,0,0,.3);left:' + Math.max(8, Math.min(b.left, root.innerWidth - 336)) + 'px;top:' + (b.bottom + 6) + 'px';
    d.innerHTML = pil.getAttribute('data-tip').split('\n').map(function (x) { return '<div>• ' + esc(x) + '</div>'; }).join('');
    document.body.appendChild(d);
  }, true);
  document.addEventListener('click', async function (e) {
    var el = e.target;
    var cb = el.closest('input[data-sel]');
    if (cb) { var id0 = +cb.getAttribute('data-sel'); if (cb.checked) ST.sel.add(id0); else ST.sel.delete(id0); tekenLijst(); e.stopPropagation(); return; }
    var chip = el.closest('[data-f]'); if (chip && chip.classList.contains('chip')) { ST.filter = chip.getAttribute('data-f'); tekenLijst(); return; }
    var rij = el.closest('.r[data-id]'); if (rij) { await laadDetail(+rij.getAttribute('data-id')); return; }
    var tab = el.closest('[data-tab]'); if (tab) { ST.tab = tab.getAttribute('data-tab'); tekenDetail(); return; }
    var dag = el.closest('[data-dag]'); if (dag && D) { var dagen = D.dagen.slice(); var i = +dag.getAttribute('data-dag'); dagen[i] = !dagen[i]; await bewaarVelden({ dagen: dagen }); return; }
    var kook = el.closest('[data-kook]'); if (kook && D) { var d = kook.getAttribute('data-kook'); var k = D.kookdagen.indexOf(d) >= 0 ? D.kookdagen.filter(function (x) { return x !== d; }) : D.kookdagen.concat([d]); await bewaarVelden({ kookdagen: k }); return; }
    var ot = el.closest('[data-open-taak]'); if (ot) { root.location.href = '/taken?taak=' + ot.getAttribute('data-open-taak'); return; }
    var act = el.closest('[data-act]'); if (!act || !D) return;
    var a = act.getAttribute('data-act');
    if (a === 'thema') return kiesThema([D.id]);
    if (a === 'bewerken') return kampmomentForm(true);
    if (a === 'locatie') { root.location.href = '/locaties'; return; }
    if (a === 'kv-link') { if (!D.kv) return toast('Koppel eerst een kampverantwoordelijke aan dit kampmoment.', 'warn'); return toonLinks([D.id]); }
    if (a === 'kv-kies') return kiesKv();
    if (a === 'conflicten') { root.location.href = '/rooster'; return; }
    if (a === 'aanvragen') { root.location.href = '/vandaag'; return; }
    if (a === 'telling') { root.location.href = '/nakijken' + (D.maandag ? '?week=' + D.maandag : ''); return; }
  });
  document.addEventListener('change', async function (e) {
    var v = e.target.getAttribute && e.target.getAttribute('data-veld'); if (!v || !D) return;
    var body = {}; body[v] = v === 'opmerking' ? e.target.value : (e.target.value === '' ? null : +e.target.value);
    await bewaarVelden(body, '✓ Opgeslagen');
  });
  document.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role=button]')) { e.preventDefault(); e.target.click(); } });
  $('zoek').oninput = function (e) { ST.zoek = e.target.value; tekenLijst(); };
  $('alles').onchange = function (e) { zichtbaar(O, ST).forEach(function (k) { if (e.target.checked) ST.sel.add(k.id); else ST.sel.delete(k.id); }); tekenLijst(); };
  $('nieuw').onclick = function () { kampmomentForm(false); };
  $('genereer-alles').onclick = function () { genereer([]); };
  $('b-genereer').onclick = function () { genereer(Array.from(ST.sel)); };
  $('b-kvlinks').onclick = function () { toonLinks(Array.from(ST.sel)); };
  $('b-thema').onclick = function () { kiesThema(Array.from(ST.sel)); };
  $('b-weg').onclick = async function () {
    var ids = Array.from(ST.sel);
    // TF8 G6: eerst tonen wat er na het verwijderen zou blijven staan, met een keuze per soort. Tellingen en historiek blijven altijd bewaard.
    var vb = await aanroep('POST', '/api/kampmomenten/verwijder-voorbeeld', { ids: ids }); vb = vb.ok ? vb.json : { aanvullijst: 0, aanvragen: 0, ritten: [], tellingen: 0 };
    var vink = function (naam, tekst) { return '<label class="chk"><input type="checkbox" name="' + naam + '" checked> ' + tekst + '</label>'; };
    var restHtml = (vb.aanvullijst ? vink('aanvullijst', 'Ook de ' + vb.aanvullijst + ' regel' + (vb.aanvullijst === 1 ? '' : 's') + ' van de aanvullijst halen') : '')
      + (vb.aanvragen ? vink('aanvragen', 'Ook de ' + vb.aanvragen + ' open of goedgekeurde aanvra' + (vb.aanvragen === 1 ? 'ag' : 'gen') + ' afhandelen') : '')
      + (vb.ritten.length ? vink('ritten', 'Ook ' + vb.ritten.length + ' rit' + (vb.ritten.length === 1 ? '' : 'ten') + ' zonder taken verwijderen (' + vb.ritten.map(function (x) { return '#' + x.id; }).join(', ') + ')') : '');
    var keuze = await vraag({ titel: ids.length + ' kampmoment' + (ids.length === 1 ? '' : 'en') + ' verwijderen?', tekst: 'Ook de taken van die kampmomenten verdwijnen. Staat er al iets geladen, dan gebeurt er niets. Tellingen en historiek blijven bewaard (' + vb.tellingen + ' telling' + (vb.tellingen === 1 ? '' : 'en') + ').' + (restHtml ? ' Wat anders blijft staan, kies je hieronder.' : ''), ok: 'Verwijderen', html: restHtml,
      lees: function (f) { return { opruimen: { aanvullijst: !!(f.aanvullijst && f.aanvullijst.checked), aanvragen: !!(f.aanvragen && f.aanvragen.checked), ritten: !!(f.ritten && f.ritten.checked) } }; } });
    if (!keuze) return;
    var r = await aanroep('POST', '/api/kampmomenten/verwijderen', { ids: ids, opruimen: keuze.opruimen });
    if (!r.ok) return toast(r.json.error || 'Verwijderen mislukt', 'error');
    var bl = r.json.blijft || {}, blijft = [bl.aanvullijst ? bl.aanvullijst + (bl.aanvullijst === 1 ? ' aanvullijst-regel' : ' aanvullijst-regels') : '', bl.aanvragen ? bl.aanvragen + (bl.aanvragen === 1 ? ' aanvraag' : ' aanvragen') : '', bl.ritten ? bl.ritten + (bl.ritten === 1 ? ' lege rit' : ' lege ritten') : ''].filter(Boolean);
    toast('✓ ' + r.json.verwijderd + ' verwijderd' + (blijft.length ? ' · blijft staan: ' + blijft.join(', ') : ''), blijft.length ? 'warn' : 'success'); if (D && ST.sel.has(D.id)) { D = null; ST.open = null; tekenDetail(); } ST.sel.clear(); await laad();
  };
  $('export').onclick = async function () {
    var r = await root.fetch('/api/export', { headers: { 'x-auth-token': TOKEN } });
    if (!r.ok) return toast('Export mislukt', 'error');
    var a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = 'sporty-export.json'; a.click(); URL.revokeObjectURL(a.href);
  };
  async function kop() {
    var v = await aanroep('GET', '/api/vandaag');
    if (v.ok) { var tel = function (id, n) { var b = $(id); b.textContent = n; b.hidden = !n; }; tel('b-vandaag', v.json.beslissen.length); tel('b-transport', v.json.inplannen.length); $('wie').textContent = v.json.gebruiker.naam + ' · kantoor'; $('per-naam').textContent = v.json.periode ? v.json.periode.naam : 'geen periode'; }
    var p = await aanroep('GET', '/api/periodes'); if (!p.ok) return;
    var sel = $('per-kies'); sel.innerHTML = p.json.map(function (x) { return '<option value="' + x.id + '"' + (x.actief ? ' selected' : '') + '>' + esc(x.naam) + '</option>'; }).join('');
    sel.onchange = async function () { var a = await aanroep('POST', '/api/periodes/' + sel.value + '/activeer'); if (!a.ok) return toast(a.json.error || 'Periode wisselen mislukt', 'error'); root.location.href = '/kampmomenten'; };
  }
  (async function () { await laad(); kop(); var id = +Q.get('id'); if (id) await laadDetail(id); })();
})(typeof window !== 'undefined' ? window : globalThis);
