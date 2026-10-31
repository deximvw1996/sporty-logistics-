// public/locatie-dossier.js — MT2: tabs Weekkaart, Dossier, Leveren, Ruimtes en Feedback in het locatiedetail. Op gsm volgen ze het bestaande detailscherm.
(function (root) {
  'use strict';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var STAND = { kamp_open: ['groen', 'kamp open'], binnen: ['blauw', 'dicht, wij kunnen binnen'], geen_toegang: ['rood', 'dicht, geen toegang'], onbekend: ['', 'onbekend'] };
  var DAGEN = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'], VELD = [['sleutel_info', 'Sleutel'], ['wie_opent', 'Wie opent'], ['concierge', 'Conciërge'], ['parking', 'Parking of laadzone'], ['wifi', 'Wifi'], ['binnenruimte', 'Binnenruimte'], ['kuisen_info', 'Kuisen']];
  var inp = function (n, v, t) { return '<input class="dv" name="' + n + '" type="' + (t || 'text') + '" value="' + esc(v || '') + '">'; };
  var veld = function (l, h) { return '<label class="dvl"><span>' + esc(l) + '</span>' + h + '</label>'; };
  function balk(d) { if (!d || !d.ontbreekt.length) return ''; return '<div class="dosbalk">Dossier onvolledig: nog ' + d.ontbreekt.map(esc).join(', ') + '</div>'; }
  function weekkaart(d) {
    var w = d.wk || { weken: [] };
    return '<div class="blok"><h4>Weekkaart · ' + esc(w.periode ? w.periode.naam : 'geen periode') + '</h4>' + w.weken.map(function (x) { var p = STAND[x.stand] || STAND.onbekend; return '<label class="rij wk"><input type="checkbox" data-wk="' + x.week + '"' + (x.stand === 'kamp_open' ? ' title="Kamp open volgt uit het kampmoment"' : '') + '><div class="nm">Week ' + x.week + ' <span class="pil ' + p[0] + '">' + p[1] + '</span><b>' + esc([x.reden, x.materiaal_mag_blijven ? 'materiaal mag blijven' : '', x.ruimte, x.notitie].filter(Boolean).join(' · ')) + '</b></div></label>'; }).join('') + '</div>'
      + '<div class="blok"><h4>Op de gekozen weken</h4>' + veld('Stand', '<select class="dv" name="wk_stand"><option value="">Niet ingevuld</option><option value="binnen">Dicht, wij kunnen binnen</option><option value="geen_toegang">Dicht, geen toegang</option></select>') + veld('Reden', '<select class="dv" name="wk_reden"><option value="">—</option><option>Verhuurd aan een firma</option><option>Geen sleutel</option><option>Andere</option></select>') + '<label class="rij"><input type="checkbox" name="wk_blijft"> Materiaal mag blijven liggen</label>' + veld('Welke ruimte', inp('wk_ruimte')) + veld('Notitie', inp('wk_notitie')) + '<button class="knop" data-dos="wk-ok">Toepassen</button><div class="hint">De app rekent niet of het past. Een week met een kampmoment blijft "kamp open".</div></div>';
  }
  function dossier(d) {
    return '<div class="blok"><h4>Toegang en ter plaatse</h4>' + VELD.map(function (v) { return veld(v[1], inp('d_' + v[0], d.velden[v[0]])); }).join('') + '<label class="rij"><input type="checkbox" name="d_oven"' + (d.heeft_eigen_oven ? ' checked' : '') + '> Eigen oven</label><label class="rij"><input type="checkbox" name="d_kuis"' + (d.zelf_kuisen ? ' checked' : '') + '> Zelf kuisen</label><button class="knop" data-dos="dos-ok">Bewaren</button></div>'
      + '<div class="blok"><h4>Code</h4><div class="hint">Alleen voor kantoor en wie er die dag een stop heeft. Nooit in een export; elke opvraging staat in het log.</div><div id="code-toon" class="hint">' + (d.heeft_code ? 'Er is een code.' : 'Nog geen code.') + '</div>' + (d.heeft_code ? '<button class="knop licht" data-dos="code-toon">Code tonen</button>' : '') + veld('Nieuwe code', '<input class="dv" name="d_code" autocomplete="off">') + '<button class="knop licht" data-dos="code-ok">Code bewaren</button></div>'
      + '<div class="blok"><h4>Contactpersonen</h4>' + (d.contact.naam || d.contact.telefoon ? '<div class="rij"><div class="nm">' + esc(d.contact.naam) + '<b>hoofdcontact</b></div>' + (d.contact.telefoon ? '<a class="knop licht" href="tel:' + esc(d.contact.telefoon) + '">📞 ' + esc(d.contact.telefoon) + '</a>' : '') + '</div>' : '') + d.contacten.map(function (c) { return '<div class="rij"><div class="nm">' + esc(c.naam) + '<b>' + esc(c.rol) + '</b></div>' + (c.telefoon ? '<a class="knop licht" href="tel:' + esc(c.telefoon) + '">📞 ' + esc(c.telefoon) + '</a>' : '') + '<button class="knop licht" data-dos="contact-weg" data-i="' + c.id + '" aria-label="Verwijderen">✕</button></div>'; }).join('') + veld('Naam', inp('c_naam')) + veld('Rol', inp('c_rol')) + veld('Telefoon', inp('c_tel', '', 'tel')) + '<button class="knop licht" data-dos="contact-ok">+ Contact</button></div>';
  }
  function leveren(d) {
    var periode = function (l, s) { return l.map(function (x) { return '<div class="rij"><div class="nm">' + esc(x.van) + ' t/m ' + esc(x.tot) + '<b>' + esc(x.tekst) + '</b></div><button class="knop licht" data-dos="weg-' + s + '" data-i="' + x.id + '" aria-label="Verwijderen">✕</button></div>'; }).join(''); };
    var form = function (s, t) { return veld('Van', inp(s + '_van', '', 'date')) + veld('Tot', inp(s + '_tot', '', 'date')) + veld('Tekst', inp(s + '_tekst')) + '<button class="knop licht" data-dos="' + s + '-ok">' + t + '</button>'; };
    return '<div class="blok"><h4>Type en uren</h4>' + veld('Type', '<select class="dv" name="l_type"><option value="">Niet ingevuld</option>' + [['openbaar', 'Openbaar gebouw met openingsuren'], ['school', 'School met sleutel'], ['anders', 'Anders']].map(function (o) { return '<option value="' + o[0] + '"' + (d.lever.type === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>')
      + DAGEN.map(function (g) { var u = d.lever.uren[g] || {}; return '<div class="urij"><b>' + g + '</b>' + inp('u_' + g + '_van', u.van, 'time') + inp('u_' + g + '_tot', u.tot, 'time') + '</div>'; }).join('') + '<button class="knop" data-dos="lever-ok">Bewaren</button><div class="hint">Lege uren overal = geen urenmelding.</div></div>'
      + '<div class="blok"><h4>Andere firma aanwezig: niet storen</h4>' + periode(d.niet_storen, 'ns') + form('ns', '+ Periode') + '</div><div class="blok"><h4>Afspraken</h4>' + periode(d.afspraken, 'af') + form('af', '+ Afspraak') + '</div>';
  }
  function ruimtes(d) {
    return '<div class="blok"><h4>Ruimtes</h4>' + (d.ruimtes.map(function (r) { return '<div class="rij"><div class="nm">' + esc(r.naam) + '<b>' + esc(r.notitie) + '</b>' + r.beperkingen.map(function (b) { return '<small class="bp">niet bruikbaar ' + esc(b.datum_van) + (b.datum_tot !== b.datum_van ? ' t/m ' + esc(b.datum_tot) : '') + (b.reden ? ': ' + esc(b.reden) : '') + ' <button class="knop licht" data-dos="bp-weg" data-i="' + b.id + '" aria-label="Verwijderen">✕</button></small>'; }).join('') + '</div><button class="knop licht" data-dos="bp-nieuw" data-i="' + r.id + '">+ Dag</button><button class="knop licht" data-dos="ruimte-weg" data-i="' + r.id + '" aria-label="Verwijderen">✕</button></div>'; }).join('') || '<div class="hint">Nog geen ruimtes.</div>') + veld('Naam', inp('r_naam')) + veld('Notitie', inp('r_notitie')) + '<button class="knop licht" data-dos="ruimte-ok">+ Ruimte</button></div>'
      + '<div class="blok"><h4>Niet bruikbaar op</h4>' + veld('Van', inp('b_van', '', 'date')) + veld('Tot', inp('b_tot', '', 'date')) + veld('Reden', inp('b_reden')) + '<div class="hint">Vul in en tik bij de ruimte op + Dag. In Rooster en Kampmoment komt een melding, nooit een verbod.</div></div>';
  }
  function feedback(d) { return '<div class="blok"><h4>Feedback</h4>' + ((d.fb || []).map(function (f) { return '<div class="rij"><div class="nm">' + esc(f.tekst) + '<b>' + esc([f.soort, f.wie, String(f.created_at || '').slice(0, 10)].join(' · ')) + '</b></div></div>'; }).join('') || '<div class="hint">Nog geen feedback.</div>') + '</div>'; }
  var api = { TABS: [['weekkaart', 'Weekkaart'], ['dossier', 'Dossier'], ['leveren', 'Leveren'], ['ruimtes', 'Ruimtes'], ['feedback', 'Feedback']], balk: balk,
    html: function (d, tab) { if (!d) return '<div class="hint">Laden…</div>'; return ({ weekkaart: weekkaart, dossier: dossier, leveren: leveren, ruimtes: ruimtes, feedback: feedback }[tab] || function () { return ''; })(d); } };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.DOSSIER = api;
  var A = function (m, u, b) { return root.sportyApi(m, u, b, { token: localStorage.getItem('sporty-auth-token') }); };
  var waarde = function (n) { var e = document.querySelector('[name="' + n + '"]'); return e ? (e.type === 'checkbox' ? e.checked : e.value) : ''; };
  api.laad = async function (id) {
    var r = await Promise.all([A('GET', '/api/locaties/' + id + '/dossier'), A('GET', '/api/locaties/' + id + '/weekkaart'), A('GET', '/api/feedback?locatie=' + id)]);
    var d = r[0].json || {}; d.wk = r[1].json; d.fb = r[2].ok ? r[2].json.feedback : []; return d;
  };
  document.addEventListener('click', async function (e) {
    var b = e.target.closest && e.target.closest('[data-dos]'); if (!b || !root.__locId) return;
    var a = b.dataset.dos, id = root.__locId(), i = b.dataset.i, r = null, L = '/api/locaties/' + id;
    var periodeBody = function (s) { return { van: waarde(s + '_van'), tot: waarde(s + '_tot'), tekst: waarde(s + '_tekst') }; };
    if (a === 'code-toon') { r = await A('GET', L + '/code'); if (r.ok) document.getElementById('code-toon').textContent = 'Code: ' + (r.json.code || '—'); return; }
    if (a === 'wk-ok') { var w = Array.prototype.map.call(document.querySelectorAll('[data-wk]:checked'), function (x) { return +x.dataset.wk; }); r = await A('PUT', L + '/weekkaart', { weken: w, stand: waarde('wk_stand'), reden: waarde('wk_reden'), materiaal_mag_blijven: waarde('wk_blijft'), ruimte: waarde('wk_ruimte'), notitie: waarde('wk_notitie') }); }
    if (a === 'dos-ok') { var v = { heeft_eigen_oven: waarde('d_oven'), zelf_kuisen: waarde('d_kuis') }; VELD.forEach(function (x) { v[x[0]] = waarde('d_' + x[0]); }); r = await A('PUT', L + '/dossier', v); }
    if (a === 'code-ok') r = await A('PUT', L + '/code', { code: waarde('d_code') });
    if (a === 'contact-ok') r = await A('POST', L + '/contacten', { naam: waarde('c_naam'), rol: waarde('c_rol'), telefoon: waarde('c_tel') });
    if (a === 'contact-weg') r = await A('DELETE', '/api/locatie-contacten/' + i);
    if (a === 'lever-ok') { var u = {}; DAGEN.forEach(function (g) { if (waarde('u_' + g + '_van')) u[g] = { van: waarde('u_' + g + '_van'), tot: waarde('u_' + g + '_tot') }; }); r = await A('PUT', L + '/lever', { type: waarde('l_type'), uren: u }); }
    if (a === 'ns-ok') r = await A('POST', L + '/niet-storen', periodeBody('ns'));
    if (a === 'af-ok') r = await A('POST', L + '/locatie-afspraken', periodeBody('af'));
    if (a === 'weg-ns') r = await A('DELETE', '/api/niet-storen/' + i);
    if (a === 'weg-af') r = await A('DELETE', '/api/locatie-afspraken/' + i);
    if (a === 'ruimte-ok') r = await A('POST', L + '/ruimtes', { naam: waarde('r_naam'), notitie: waarde('r_notitie') });
    if (a === 'ruimte-weg') r = await A('DELETE', '/api/ruimtes/' + i);
    if (a === 'bp-nieuw') r = await A('POST', '/api/ruimtes/' + i + '/beperkingen', { datum_van: waarde('b_van'), datum_tot: waarde('b_tot'), reden: waarde('b_reden') });
    if (a === 'bp-weg') r = await A('DELETE', '/api/ruimte-beperkingen/' + i);
    if (r) { if (!r.ok && root.__locToast) root.__locToast(r.json.error || 'Bewaren mislukt', 'error'); else if (root.__locToast) root.__locToast('Bewaard', 'success'); root.__locHerteken(); }
  });
})(typeof window !== 'undefined' ? window : globalThis);
