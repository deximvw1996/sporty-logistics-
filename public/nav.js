// public/nav.js — NAV1: ÉÉN tabel voor de bovenbalk (7 onderdelen) en de subbalken; elke nieuwe pagina laadt dit bestand vóór zijn eigen script
// en tekent daarmee zijn bovenbalk en subbalk. De actieve knoppen volgen de URL. Alleen de <a>'s worden vervangen: logo, periode-kiezer,
// naam, de knoppen rechts in de subbalk (Export, Genereer…) en alle ids blijven van de pagina zelf.
// Links met /#… zijn oude tabbladen (index.html) voor schermen die nog niet vernieuwd zijn; zodra er een nieuw scherm is, verandert enkel deze tabel.
(function (root) {
  'use strict';
  var BOVEN = [
    { id: 'vandaag', ico: '🏠', naam: 'Vandaag', href: '/vandaag', badge: 'b-vandaag' },
    { id: 'planning', ico: '📅', naam: 'Planning', href: '/kampmomenten', badge: 'b-planning' },
    { id: 'transport', ico: '🚚', naam: 'Transport', href: '/ritplanning', badge: 'b-transport' },
    { id: 'materiaal', ico: '📦', naam: 'Materiaal', href: '/bakken' },
    { id: 'locaties', ico: '📍', naam: 'Locaties', href: '/locaties' }, // LO1 gebouwd (30/10): nieuw scherm
    { id: 'voorraad', ico: '🧮', naam: 'Voorraad & controles', href: '/nakijken', badge: 'b-nakijken' },
    { id: 'beheer', ico: '⚙️', naam: 'Beheer', href: '/personeel' }
  ];
  var SUB = {
    planning: [['Kampmomenten', '/kampmomenten'], ['Rooster', '/rooster'], ['Sportrooster', '/sportrooster'], ['Gedeeld materiaal', '/gedeeld'], ['Periodes', '/periodes']], // PL2/PL3
    transport: [['Ritplanning', '/ritplanning'], ['Taken', '/taken'], ['Voertuigen', '/voertuigen']],
    materiaal: [['Thema’s', '/themas'], ['Bakken', '/bakken'], ['Pool', '/pool'], ['Catalogus', '/catalogus']],
    voorraad: [['Nakijken', '/nakijken'], ['Tekorten & bestellingen', '/tekorten'], ['Aanvullijst', '/aanvullijst-print']], // TB2: Voorraad gaat op in Materiaal › Catalogus
    beheer: [['Personeel', '/personeel'], ['Logboek', '/logboek'], ['Back-up & export', '/backup'], ['Instellingen', '/instellingen']] // BH2
  };
  // Welke pagina hoort bij welk onderdeel (en welke subknop).
  var PAGINA = { '/vandaag': 'vandaag', '/kampmomenten': 'planning', '/rooster': 'planning', '/sportrooster': 'planning', '/gedeeld': 'planning', '/periodes': 'planning', '/ritplanning': 'transport', '/taken': 'transport', '/voertuigen': 'transport', '/bakken': 'materiaal', '/themas': 'materiaal', '/pool': 'materiaal', '/catalogus': 'materiaal', '/nakijken': 'voorraad', '/tekorten': 'voorraad', '/personeel': 'beheer', '/logboek': 'beheer', '/backup': 'beheer', '/instellingen': 'beheer' };
  // MOB1: gsm-schil (< 768 px). Tabbalk per rol (design/MOBIEL-DEFINITIEF.html); dezelfde URL's als op desktop.
  var TABS = {
    kantoor: [['vandaag', '🏠', 'Vandaag', '/vandaag'], ['transport', '🚚', 'Transport', '/ritplanning'], ['voorraad', '🧮', 'Voorraad', '/nakijken'], ['meldingen', '🔔', 'Meldingen', '/vandaag?tab=meldingen'], ['meer', '☰', 'Meer', '/meer']],
    ploeg: [['vandaag', '🏠', 'Vandaag', '/vandaag'], ['ritten', '🚚', 'Ritten', '/vandaag?tab=ritten'], ['stockage', '📦', 'Stockage', '/aanvullijst-print'], ['meldingen', '🔔', 'Meldingen', '/vandaag?tab=meldingen'], ['meer', '☰', 'Meer', '/meer']]
  };
  var tabsVan = function (rol) { return rol === 'kantoor' ? TABS.kantoor : TABS.ploeg; };
  // Welke tab is actief: volgt de PAGINA-tabel; de onderdelen zonder eigen tab vallen onder Meer.
  function actieveTab(rol, pad, zoek) {
    var q = /[?&]tab=(\w+)/.exec(zoek || ''), onderdeel = PAGINA[pad];
    if (pad === '/vandaag') return q && (q[1] === 'meldingen' || q[1] === 'ritten') ? q[1] : 'vandaag';
    if (pad === '/meer') return 'meer';
    if (rol === 'kantoor' && (onderdeel === 'transport' || onderdeel === 'voorraad')) return onderdeel;
    return 'meer';
  }
  function tabbalk(rol, pad, zoek, tellers) {
    var act = actieveTab(rol, pad, zoek); tellers = tellers || {};
    return tabsVan(rol).map(function (t) {
      var n = tellers[t[0]];
      return '<a data-tab="' + t[0] + '"' + (t[0] === act ? ' class="act"' : '') + ' href="' + t[3] + '">' + t[1] + '<span>' + esc(t[2]) + (n ? ' <em>' + n + '</em>' : '') + '</span></a>';
    }).join('');
  }
  var isGsm = function () { return !!(root.matchMedia && root.matchMedia('(max-width:767px)').matches); };
  var naarLogin = function () { root.location.replace('/login?terug=' + encodeURIComponent(root.location.pathname + root.location.search)); };
  function tekenSchil(pad, tok) {
    var rol = null; try { rol = root.localStorage.getItem('sporty-rol'); } catch (e) { /* geen opslag */ }
    if (!document.querySelector('link[href="/public/app-schil.css"]')) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/public/app-schil.css'; document.head.appendChild(l); }
    var balk = document.createElement('nav'); balk.className = 'app-tabs'; balk.setAttribute('aria-label', 'Hoofdmenu');
    var zet = function (t) { balk.innerHTML = tabbalk(rol, pad, root.location.search, t); };
    zet(); document.body.classList.add('heeft-tabs'); document.body.appendChild(balk);
    if (tok && isGsm() && root.fetch) root.fetch('/api/vandaag?mijn=1', { headers: { 'x-auth-token': tok } }).then(function (r) { return r.ok ? r.json() : null; }).then(function (v) {
      if (!v) return; rol = v.gebruiker.rol; try { root.localStorage.setItem('sporty-rol', rol); } catch (e) { /* geen opslag */ }
      zet(v.tellers);
    }).catch(function () { /* geen tellers */ });
  }
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  function boven(actief) {
    return BOVEN.map(function (o) {
      return '<a' + (o.id === actief ? ' class="act"' : '') + ' href="' + o.href + '">' + o.ico + ' ' + esc(o.naam) + (o.badge ? ' <span class="b" id="' + o.badge + '" hidden></span>' : '') + '</a>';
    }).join('');
  }
  function sub(actief, pad) {
    return (SUB[actief] || []).map(function (s) { return '<a' + (s[1] === pad ? ' class="act"' : '') + ' href="' + s[1] + '">' + esc(s[0]) + '</a>'; }).join('');
  }
  function teken(pad) {
    if (typeof document === 'undefined') return;
    pad = pad || root.location.pathname;
    var actief = PAGINA[pad];
    var eigenBalk = pad === '/meer' || pad === '/locaties'; // /locaties tekent zijn balken zelf (LO1); hij krijgt alleen de schil
    if (!actief && !eigenBalk) return;
    // MOB1: niet ingelogd op een personeelspagina op gsm → /login?terug=. De rest van de pagina (die zelf naar / zou sturen) wordt niet meer gelezen.
    var tok0 = null; try { tok0 = root.localStorage.getItem('sporty-auth-token'); } catch (e) { /* geen opslag */ }
    if (!tok0 && isGsm()) { document.write('<plaintext style="display:none">'); naarLogin(); return; }
    if (eigenBalk) { tekenSchil(pad, tok0); return; }
    var top = document.querySelector('.top');
    if (top) {
      Array.prototype.filter.call(top.children, function (e) { return e.tagName === 'A'; }).forEach(function (e) { e.remove(); });
      var logo = top.querySelector('.logo');
      (logo || top).insertAdjacentHTML(logo ? 'afterend' : 'afterbegin', boven(actief));
    }
    var sb = document.querySelector('.sub');
    if (sb) {
      Array.prototype.filter.call(sb.children, function (e) { return e.tagName === 'A'; }).forEach(function (e) { e.remove(); });
      sb.insertAdjacentHTML('afterbegin', sub(actief, pad));
    }
    tekenSchil(pad, tok0);
    // Tellers (kantoor): Vandaag = te beslissen, Transport = in te plannen, Voorraad = tellingen te keuren. Pagina's mogen dezelfde ids ook zelf zetten.
    var tok = null; try { tok = root.localStorage.getItem('sporty-auth-token'); } catch (e) { /* geen opslag */ }
    if (tok && root.fetch) {
      root.fetch('/api/vandaag', { headers: { 'x-auth-token': tok } }).then(function (r) { return r.ok ? r.json() : null; }).then(function (v) {
        if (!v) return;
        var zet = function (id, n) { var b = document.getElementById(id); if (b) { b.textContent = n; b.hidden = !n; } };
        zet('b-vandaag', (v.beslissen || []).length); zet('b-transport', (v.inplannen || []).length);
        var tk = (v.nakijken || []).filter(function (x) { return /^\d+ telling/.test(x.titel); })[0];
        zet('b-nakijken', tk ? parseInt(tk.titel, 10) : 0);
      }).catch(function () { /* geen tellers */ });
    }
  }
  // AF1: gedeelde aanroep voor alle kantoorpagina's, met dezelfde herpoging als haal() in rit.js/kv.js (TF2 G3).
  // Bij 502/503/504 (de app wordt net bijgewerkt) na 2 s en 5 s opnieuw, één toast; GET ook bij een netwerkfout, POST/PUT/DELETE niet.
  // Teruggave {status, ok, json}; na de laatste poging komt gewoon het laatste antwoord terug (of de netwerkfout wordt gegooid).
  var herhaalMelding = false;
  function melding(msg) {
    if (typeof document === 'undefined') return;
    var c = document.getElementById('toasts');
    if (!c) { c = document.createElement('div'); c.id = 'toasts'; c.style.cssText = 'position:fixed;bottom:20px;right:20px;display:flex;flex-direction:column;gap:8px;z-index:100;font:14px system-ui;color:#fff'; document.body.appendChild(c); }
    var t = document.createElement('div');
    t.style.cssText = 'padding:12px 16px;border-radius:10px;font-weight:600;background:#378ADD;cursor:pointer'; t.textContent = msg; t.onclick = function () { t.remove(); };
    c.appendChild(t); setTimeout(function () { t.remove(); }, 6000);
  }
  async function sportyApi(methode, url, body, deps) {
    deps = deps || {};
    var f = deps.fetch || root.fetch.bind(root);
    var wacht = deps.wacht || function (ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); };
    var tok = deps.token; if (tok === undefined) { try { tok = root.localStorage.getItem('sporty-auth-token'); } catch (e) { tok = null; } }
    var get = !methode || methode === 'GET', pauzes = [2000, 5000], r, fout;
    var opts = { method: methode || 'GET', headers: { 'Content-Type': 'application/json', 'x-auth-token': tok || '' }, body: body ? JSON.stringify(body) : undefined };
    for (var i = 0; ; i++) {
      r = null; fout = null;
      try { r = await f(url, opts); } catch (e) { fout = e; }
      var weg = fout ? get : (r.status === 502 || r.status === 503 || r.status === 504);
      if (!weg || i >= pauzes.length) { if (fout) throw fout; break; }
      if (!herhaalMelding) { (deps.toast || melding)('Even geduld, de app wordt bijgewerkt…'); herhaalMelding = true; }
      await wacht(pauzes[i]);
    }
    herhaalMelding = false;
    if (r.status === 401 && typeof document !== 'undefined' && isGsm() && document.querySelector('.app-tabs')) { // MOB1: verlopen sessie op gsm (rit- en KV-pagina hebben geen tabbalk)
      try { root.localStorage.removeItem('sporty-auth-token'); } catch (e) { /* geen opslag */ }
      naarLogin(); return new Promise(function () {});
    }
    var j = {}; try { j = await r.json(); } catch (e) { j = {}; }
    return { status: r.status, ok: r.ok, json: j };
  }
  var api = { TABS: TABS, tabsVan: tabsVan, actieveTab: actieveTab, tabbalk: tabbalk, BOVEN: BOVEN, SUB: SUB, PAGINA: PAGINA, boven: boven, sub: sub, teken: teken, sportyApi: sportyApi };
  root.sportyApi = sportyApi;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SportyNav = api;
  teken();
})(typeof window !== 'undefined' ? window : globalThis);
