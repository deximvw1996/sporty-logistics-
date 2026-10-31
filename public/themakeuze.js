// public/themakeuze.js — BW1 punt 2: de themakeuze (design/mockup-opdracht-kampmoment.html, tab 2). Eén dialoog voor het nieuwe kampmoment, het kampmoment zelf en het rooster.
// Tabs Kampen / Themadagen (themas.categorie), filters per leeftijd en eigenschap, zoeken, kolommen thema · eigen of firma · soort · locatie · al ingepland · deze week.
// Een thema dat elders staat geeft een melding ("deze week al in X"), nooit een verbod. Lege info toont "—"; de chip "Zonder info" vindt wat nog niet is ingevuld.
// Pure bouwers en filters zijn exporteerbaar (module.exports) zodat de test ze zonder browser aanroept.
'use strict';
(function (root) {
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var LEEFTIJD = [['lagere school', 'Lagere school'], ['kleuters', 'Kleuters'], ['tieners', 'Tieners']];
  var EIGENSCHAP = [['vrij', 'Vrij deze week'], ['eigen', 'Eigen'], ['extern', 'Extern'], ['kook', 'Kook'], ['zwem', 'Zwem'], ['binnen', 'Binnen nodig'], ['onbekend', 'Zonder info']];
  var LOCATIE_TEKST = { binnen: 'binnen nodig', buiten: 'buiten', beide: 'binnen+buiten' };
  function soortTekst(t) { return [t.heeft_kook ? 'kook' : '', t.is_zwem ? 'zwem' : ''].filter(Boolean); }
  // Heeft dit thema nog geen eigenschappen ingevuld? Dan weten we niet of het kook/zwem/binnen is: "onbekend", niet "nee".
  function ontbrekendeInfo(t) { return !t.locatie_nodig; }
  function filterThemas(lijst, st) {
    var q = String(st.zoek || '').toLowerCase().trim();
    return lijst.filter(function (t) {
      if (t.categorie !== st.tab) return false;
      if (q && (t.naam + ' ' + t.extern_firma).toLowerCase().indexOf(q) < 0) return false;
      var lg = Object.keys(st.leeftijd || {}).filter(function (k) { return st.leeftijd[k]; });
      if (lg.length && lg.indexOf(t.leeftijdsgroep) < 0) return false;
      var e = st.eigenschap || {};
      if (e.vrij && (t.elders && t.elders.length)) return false;
      if (e.eigen && !t.eigen) return false;
      if (e.extern && t.eigen) return false;
      if (e.kook && !t.heeft_kook) return false;
      if (e.zwem && !t.is_zwem) return false;
      if (e.binnen && t.locatie_nodig !== 'binnen' && t.locatie_nodig !== 'beide') return false;
      if (e.onbekend && !ontbrekendeInfo(t)) return false;
      return true;
    });
  }
  function tellers(lijst, tab) {
    var n = {}; lijst.filter(function (t) { return t.categorie === tab; }).forEach(function (t) { var k = t.leeftijdsgroep || 'onbekend'; n[k] = (n[k] || 0) + 1; });
    return n;
  }
  function dezeWeek(t) {
    if (t.hier) return '<span class="pil blauw">staat al hier</span>';
    if (t.elders && t.elders.length) return '<span class="pil oranje">deze week al in ' + esc(t.elders.join(', ')) + '</span>';
    return '<span class="pil groen">vrij</span>';
  }
  function rijHtml(t, st) {
    var soort = soortTekst(t).map(function (s) { return '<span class="pil paars">' + s + '</span>'; }).join(' ') || '<span class="opt">—</span>';
    var inp = st.enkel ? '<input type="radio" name="tkz-thema" value="' + t.id + '"' + (st.gekozen[t.id] ? ' checked' : '') + ' aria-label="Kies ' + esc(t.naam) + '">' : '<input type="checkbox" data-id="' + t.id + '"' + (st.gekozen[t.id] ? ' checked' : '') + ' aria-label="Kies ' + esc(t.naam) + '">';
    var firma = t.eigen ? 'eigen' : 'extern: ' + esc(t.extern_firma);
    return '<div class="tr tkz-r" data-id="' + t.id + '" style="grid-template-columns:' + kolommen(st) + '">' + inp + '<b>' + esc(t.naam) + '<small class="k"> ' + esc(t.leeftijdsgroep || '') + '</small></b><span>' + firma + '</span>' + '<span>' + soort + '</span>'
      + '<span>' + (LOCATIE_TEKST[t.locatie_nodig] ? esc(LOCATIE_TEKST[t.locatie_nodig]) : '<span class="opt">—</span>') + '</span>'
      + (st.toonIngepland ? '<span>' + (t.ingepland_n ? t.ingepland_n + '× in ' + esc(st.periodeNaam || 'de periode') : '<span class="opt">—</span>') + '</span>' : '')
      + '<span>' + dezeWeek(t) + '</span></div>';
  }
  function kolommen(st) { return st.toonIngepland ? '30px 1.6fr 1fr 80px 1fr 1fr 1.2fr' : '30px 1.8fr 1.1fr 90px 1.1fr 1.4fr'; }
  function kop(st) { return '<div class="th tkz-h" style="grid-template-columns:' + kolommen(st) + '"><span></span><span>Thema</span><span>Eigen of firma</span><span>Soort</span><span>Locatie</span>' + (st.toonIngepland ? '<span>Al ingepland</span>'.replace('ingepland', 'ingepland') : '') + '<span>Deze week</span></div>'; }
  function dialoogHtml(data, st) {
    var n = tellers(data, st.tab);
    var lg = LEEFTIJD.map(function (l) { return '<span class="chip' + (st.leeftijd[l[0]] ? ' act' : '') + '" role="button" tabindex="0" data-lg="' + l[0] + '">' + l[1] + ' ' + (n[l[0]] || 0) + '</span>'; }).join('');
    var ei = EIGENSCHAP.map(function (e) { return '<span class="chip' + (st.eigenschap[e[0]] ? ' act' : '') + '" role="button" tabindex="0" data-ei="' + e[0] + '">' + e[1] + '</span>'; }).join('');
    var lijst = filterThemas(data, st);
    var rijen = lijst.map(function (t) { return rijHtml(t, st); }).join('');
    var leeg = !lijst.length ? '<div class="leeg tkz-leeg">' + (st.eigenschap.onbekend || st.eigenschap.kook || st.eigenschap.zwem || st.eigenschap.binnen ? 'Geen thema’s met deze eigenschap. Let op: ' + data.filter(function (t) { return t.categorie === st.tab && ontbrekendeInfo(t); }).length + ' thema’s hebben nog geen info (—); vul die aan in Materiaal › Thema’s.' : 'Geen thema’s voor deze keuze.') + '</div>' : '';
    var aantal = Object.keys(st.gekozen).filter(function (k) { return st.gekozen[k]; }).length;
    return '<div class="tkz-box" role="dialog" aria-modal="true" aria-label="Thema kiezen"><h2>' + esc(st.titel) + '</h2>'
      + '<div class="tab2"><a class="' + (st.tab === 'kamp' ? 'act' : '') + '" role="button" tabindex="0" data-tab="kamp">Kampen</a><a class="' + (st.tab === 'themadag' ? 'act' : '') + '" role="button" tabindex="0" data-tab="themadag">Themadagen</a></div>'
      + '<div class="filters tkz-f"><input type="search" id="tkz-zoek" placeholder="🔍 Zoek thema…" value="' + esc(st.zoek || '') + '" aria-label="Thema zoeken">' + lg + '<span class="tkz-sp"></span>' + ei + '</div>'
      + kop(st) + '<div class="scroll tkz-lijst">' + rijen + leeg + '</div>'
      + '<div class="tkz-voet"><span class="tkz-tel">' + aantal + ' gekozen' + (st.toonIngepland ? '' : ' · "al ingepland" verschijnt bij een periode langer dan 2 weken') + ' · info bewerk je in Materiaal › Thema’s</span><span class="tkz-knoppen"><button type="button" class="knop licht" data-act="annuleer">Annuleren</button><button type="button" class="knop" data-act="ok">Toevoegen</button></span></div></div>';
  }
  var CSS = '.tkz-bg{position:fixed;inset:0;z-index:3000;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px}'
    + '.tkz-box{background:#fff;border-radius:14px;padding:20px 24px;box-shadow:0 20px 50px rgba(0,0,0,.3);display:flex;flex-direction:column;min-height:0;width:min(1180px,100%);height:min(760px,calc(100vh - var(--tk-h,0px) - 32px));margin-top:var(--tk-h,0px)}'
    + '.tkz-box h2{font-size:22px;font-weight:800}.tkz-box .tab2{display:flex;gap:4px;margin:10px 0;border-bottom:1px solid #e2e8f0}.tkz-box .tab2 a{height:44px;padding:0 16px;display:flex;align-items:center;font-size:14px;font-weight:700;color:#64748b;cursor:pointer;border-bottom:2px solid transparent}.tkz-box .tab2 a.act{color:#1d4ed8;border-bottom-color:#1d4ed8}'
    + '.tkz-f{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:10px}.tkz-f input{height:44px;border:1px solid #e2e8f0;border-radius:8px;padding:0 12px;font:inherit;min-width:150px;flex:0 1 300px}.tkz-sp{width:12px}'
    + '.tkz-box .chip{height:36px;padding:0 12px;border-radius:999px;background:#f1f5f9;font-size:13px;font-weight:600;display:inline-flex;align-items:center;cursor:pointer;white-space:nowrap}.tkz-box .chip.act{background:#1e3a8a;color:#fff}'
    + '.tkz-box .th{display:grid;gap:10px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;padding:0 0 6px}.tkz-box .tr{display:grid;align-items:center;gap:10px;min-height:44px;border-top:1px solid #eef2f7;font-size:13px;cursor:pointer}'
    + '.tkz-box .tr input{width:20px;height:20px}.tkz-box .k{color:#64748b;font-weight:500;font-size:11px}.tkz-box .opt{color:#94a3b8}.tkz-lijst{overflow-y:auto;min-height:0;flex:1}'
    + '.tkz-box .pil{font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;background:#e2e8f0;color:#334155;white-space:nowrap}.tkz-box .pil.groen{background:#dcfce7;color:#15803d}.tkz-box .pil.oranje{background:#ffedd5;color:#c2410c}.tkz-box .pil.blauw{background:#dbeafe;color:#1e3a8a}.tkz-box .pil.paars{background:#ede9fe;color:#5b21b6}'
    + '.tkz-voet{display:flex;justify-content:space-between;align-items:center;gap:10px;padding-top:10px;flex-wrap:wrap}.tkz-tel{font-size:13px;color:#64748b}.tkz-knoppen{display:flex;gap:8px}.tkz-box .knop{height:44px;padding:0 16px;border-radius:8px;background:#2563eb;color:#fff;font-weight:700;font-size:13px;border:0;cursor:pointer}.tkz-box .knop.licht{background:#f1f5f9;color:#1e3a8a}'
    + '.tkz-leeg{padding:30px;text-align:center;color:#64748b;font-size:14px}'
    + '@media (max-width:767px){.tkz-box{padding:14px;height:calc(100vh - var(--tk-h,0px) - 16px)}.tkz-box .th{display:none}.tkz-box .tr{grid-template-columns:30px 1fr!important;row-gap:2px;padding:8px 0}.tkz-box .tr>span{grid-column:2;font-size:12px}}';
  function open(opt) {
    return new Promise(function (resolve) {
      var doc = root.document, TOKEN = root.localStorage.getItem('sporty-auth-token') || '';
      var q = '/api/themakeuze?' + (opt.periode_id ? 'periode_id=' + opt.periode_id + '&' : '') + (opt.week ? 'week=' + opt.week + '&' : '') + (opt.locatie_id ? 'locatie_id=' + opt.locatie_id : '');
      root.sportyApi('GET', q, undefined, { toast: function () { }, token: TOKEN }).then(function (r) {
        if (!r.ok) { resolve(null); return; }
        var data = r.json.themas, gekozen = {};
        (opt.gekozen || []).forEach(function (id) { gekozen[id] = true; });
        var st = { tab: opt.tab || 'kamp', zoek: '', leeftijd: {}, eigenschap: {}, gekozen: gekozen, enkel: !!opt.enkel, toonIngepland: !!r.json.toon_ingepland, periodeNaam: r.json.periode && r.json.periode.naam, titel: opt.titel || 'Thema kiezen' };
        if (!doc.getElementById('tkz-css')) { var s = doc.createElement('style'); s.id = 'tkz-css'; s.textContent = CSS; doc.head.appendChild(s); }
        var bg = doc.createElement('div'); bg.className = 'tkz-bg'; doc.body.appendChild(bg);
        var sluit = function (v) { doc.removeEventListener('keydown', toets, true); bg.remove(); resolve(v); };
        var toets = function (e) { if (e.key === 'Escape') { e.preventDefault(); sluit(null); } };
        doc.addEventListener('keydown', toets, true);
        function teken() { var zoekFocus = doc.activeElement && doc.activeElement.id === 'tkz-zoek'; bg.innerHTML = dialoogHtml(data, st); if (zoekFocus) { var z = bg.querySelector('#tkz-zoek'); z.focus(); z.setSelectionRange(z.value.length, z.value.length); } }
        teken();
        bg.addEventListener('mousedown', function (e) { if (e.target === bg) sluit(null); });
        bg.addEventListener('input', function (e) { if (e.target.id === 'tkz-zoek') { st.zoek = e.target.value; teken(); } });
        bg.addEventListener('click', function (e) {
          var el = e.target;
          var tab = el.closest('[data-tab]'); if (tab) { st.tab = tab.getAttribute('data-tab'); return teken(); }
          var lg = el.closest('[data-lg]'); if (lg) { var k = lg.getAttribute('data-lg'); st.leeftijd[k] = !st.leeftijd[k]; return teken(); }
          var ei = el.closest('[data-ei]'); if (ei) { var k2 = ei.getAttribute('data-ei'); st.eigenschap[k2] = !st.eigenschap[k2]; return teken(); }
          var act = el.closest('[data-act]');
          if (act && act.getAttribute('data-act') === 'annuleer') return sluit(null);
          if (act && act.getAttribute('data-act') === 'ok') {
            var ids = Object.keys(st.gekozen).filter(function (k3) { return st.gekozen[k3]; }).map(Number);
            return sluit(ids.map(function (id) { return data.filter(function (t) { return t.id === id; })[0]; }).filter(Boolean));
          }
          var rij = el.closest('.tkz-r');
          if (rij) {
            var id = +rij.getAttribute('data-id');
            if (st.enkel) { st.gekozen = {}; st.gekozen[id] = true; } else if (el.tagName !== 'INPUT') st.gekozen[id] = !st.gekozen[id]; else st.gekozen[id] = el.checked;
            teken();
          }
        });
      }).catch(function () { resolve(null); });
    });
  }
  var api = { open: open, filterThemas: filterThemas, tellers: tellers, rijHtml: rijHtml, dialoogHtml: dialoogHtml, ontbrekendeInfo: ontbrekendeInfo, EIGENSCHAP: EIGENSCHAP, LEEFTIJD: LEEFTIJD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ThemaKeuze = api;
})(typeof window !== 'undefined' ? window : globalThis);
