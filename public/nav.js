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
    { id: 'locaties', ico: '📍', naam: 'Locaties', href: '/#locaties' }, // LO1 bouwt het nieuwe scherm later: dan wordt dit '/locaties'
    { id: 'voorraad', ico: '🧮', naam: 'Voorraad & controles', href: '/nakijken', badge: 'b-nakijken' },
    { id: 'beheer', ico: '⚙️', naam: 'Beheer', href: '/personeel' }
  ];
  var SUB = {
    planning: [['Kampmomenten', '/kampmomenten'], ['Rooster', '/#kampplanner'], ['Periodes', '/#periodes'], ['Thema’s per week', '/#themas']],
    transport: [['Ritten', '/#transport'], ['Ritplanning', '/ritplanning'], ['Taken', '/taken'], ['Voertuigen', '/#voertuigen']],
    materiaal: [['Thema’s', '/#themas'], ['Bakken', '/bakken'], ['Pool', '/#pool'], ['Catalogus', '/#catalogus']],
    voorraad: [['Nakijken', '/nakijken'], ['Tekorten', '/#tekorten'], ['Bestellingen', '/#tekorten'], ['Voorraad', '/#voorraad']],
    beheer: [['Personeel', '/personeel'], ['Logboek', '/logboek'], ['Export & back-up', '/#beheer'], ['Instellingen', '/#beheer']]
  };
  // Welke pagina hoort bij welk onderdeel (en welke subknop).
  var PAGINA = { '/vandaag': 'vandaag', '/kampmomenten': 'planning', '/ritplanning': 'transport', '/taken': 'transport', '/bakken': 'materiaal', '/nakijken': 'voorraad', '/personeel': 'beheer', '/logboek': 'beheer' };
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
    if (!actief) return;
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
  var api = { BOVEN: BOVEN, SUB: SUB, PAGINA: PAGINA, boven: boven, sub: sub, teken: teken };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SportyNav = api;
  teken();
})(typeof window !== 'undefined' ? window : globalThis);
