/* public/gsm-lijst.js — MOB4: één gedeeld gsm-patroon voor de lijstpagina's (design/mockup-gsm-lijsten.html).
   Onder 768 px: kop met titel + ⬇ + "+", zoeken, chips met pijltje, een kaart per rij, tik = detail als volgend scherm (‹ terug),
   vinkje (aanraakgebied 44 px) en onderaan "n gekozen · Acties" met alle bulkacties als grote knoppen (gevaarlijke rood).
   Geen eigen gegevens: de kaarten worden gelezen uit de desktoplijst van dezelfde pagina (zelfde API, zelfde filters, zelfde selectie,
   zelfde live-verversing via RT1); elke tik wordt doorgegeven aan het bestaande element van de pagina. Boven 767 px doet dit bestand niets. */
(function (root, fabriek) { var api = fabriek(root); if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GsmLijst = api; })(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var ont = function (s) { return String(s || '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'); };
  var tekst = function (h) { return ont(String(h || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim(); };
  var LEEG = function (t) { return !t || t === '—' || t === '-' || t === '–'; };

  // ── Rij uit de desktoplijst lezen (pure tekst, dus ook in node te testen) ──
  // Directe kind-<span>'s van de rij = cellen; een <span class="pil …"> in een cel wordt een pil.
  function splitsCellen(rijHtml) {
    var s = String(rijHtml || ''), i = s.indexOf('>') + 1, einde = s.lastIndexOf('</div>'); if (einde < i) einde = s.length;
    var b = s.slice(i, einde), cellen = [], re = /<span\b[^>]*>|<\/span>/g, m, diep = 0, start = -1;
    while ((m = re.exec(b))) {
      if (m[0].charAt(1) !== '/') { if (diep === 0) start = m.index; diep++; }
      else { diep--; if (diep === 0 && start >= 0) { cellen.push(b.slice(start, re.lastIndex)); start = -1; } }
    }
    return cellen.map(function (c) {
      var pillen = [], p, pr = /<span\b[^>]*class="([^"]*\bpil\b[^"]*)"[^>]*>([\s\S]*?)<\/span>/g;
      while ((p = pr.exec(c))) pillen.push({ t: tekst(p[2]), k: pilKlasse(p[1]) });
      var zonder = c.replace(/<span\b[^>]*class="[^"]*\bpil\b[^"]*"[^>]*>[\s\S]*?<\/span>/g, ' ');
      return { t: tekst(zonder), alle: tekst(c), pillen: pillen, checkbox: /type="checkbox"/.test(c) };
    });
  }
  function pilKlasse(c) { return /groen/.test(c) ? 'gr' : /oranje/.test(c) ? 'or' : /rood/.test(c) ? 'ro' : /blauw/.test(c) ? 'bl' : ''; }
  var rijId = function (rijHtml) { var m = /data-(?:id|k|key)="([^"]*)"/.exec(String(rijHtml || '').slice(0, 200)); return m ? m[1] : ''; };
  var pilVan = function (c) { return (c && c.pillen) || []; };
  var tekstPil = function (c, k) { return c && !LEEG(c.t) ? [{ t: c.t, k: k || '' }] : []; };
  var deel = function () { return Array.prototype.slice.call(arguments).filter(function (x) { return !LEEG(x); }).join(' · '); };

  // ── Per pagina: wat staat er op de kaart (volgens de mockup). Cellen: [vinkje, …kolommen van de desktoplijst]. ──
  var PAGINA = {
    '/kampmomenten': { titel: 'Kampmomenten', zoek: 'Locatie, thema, KV…', noun: 'kampmoment', nouns: 'kampmomenten', kaart: function (c) {
      var kv = LEEG(c[4].t) || /geen kv/i.test(c[4].t) ? 'Geen KV' : 'KV ' + c[4].t.replace(/^KV\s+/i, '');
      return { titel: c[1].t, regels: [c[2].t, deel(kv, LEEG(c[3].t) || /^geen thema/i.test(c[3].t) ? 'nog geen thema' : c[3].t)], pills: tekstPil(c[5], 'gr').concat(pilVan(c[6])) }; } },
    '/taken': { titel: 'Taken', zoek: 'Route, inhoud, rit…', noun: 'taak', nouns: 'taken', kaart: function (c) {
      return { titel: deel(c[1].t, c[2].t), regels: [c[3].t, c[4].t], pills: LEEG(c[5].t) && !pilVan(c[5]).length ? [{ t: 'zonder rit', k: 'or' }] : (pilVan(c[5]).length ? pilVan(c[5]) : tekstPil(c[5], 'bl')) }; } },
    '/bakken': { titel: 'Bakken', zoek: 'Code of naam…', noun: 'bak', nouns: 'bakken', kaart: function (c) {
      return { titel: c[1].t, regels: [deel(c[2].t, c[4].t), c[3].t], pills: tekstPil(c[5], 'bl').concat(pilVan(c[6])) }; } },
    '/personeel': { titel: 'Personeel', zoek: 'Naam, rol…', noun: 'persoon', nouns: 'personen', kaart: function (c) {
      return { titel: c[1].t, regels: [deel(c[2].t, c[3].t), LEEG(c[4].t) ? '' : 'Laatst actief ' + c[4].t], pills: pilVan(c[5]).length ? pilVan(c[5]) : tekstPil(c[5]) }; } },
    '/logboek': { titel: 'Logboek', zoek: 'Wie, wat, locatie…', noun: 'regel', nouns: 'regels', geenVinkje: true, geenNieuw: true, kaart: function (c) {
      return { titel: (LEEG(c[1].t) ? '' : c[1].t + ': ') + c[2].t, regels: [deel(c[3].t, c[0].t, c[4].t)], pills: [], klein: true }; } },
    '/themas': { titel: 'Thema’s', zoek: 'Thema, soort…', noun: 'thema', nouns: 'thema’s', kaart: function (c) {
      return { titel: c[1].t, regels: [c[2].t, deel(c[3].t, c[4].t)], pills: pilVan(c[5]) }; } },
    '/pool': { titel: 'Pool', zoek: 'Poolstuk…', noun: 'poolstuk', nouns: 'poolstukken', kaart: function (c) {
      return { titel: c[1].t, regels: [deel(c[2].t + ' stuks', c[3].t), LEEG(c[4].t) ? '' : 'Nodig: ' + c[4].t], pills: pilVan(c[5]) }; } },
    '/catalogus': { titel: 'Catalogus', zoek: 'Artikel…', noun: 'artikel', nouns: 'artikels', kaart: function (c) {
      return { titel: c[1].t, regels: [deel(c[2].t, c[3].t), deel(LEEG(c[4].t) ? '' : 'Rozenweg ' + c[4].t, LEEG(c[5].t) ? '' : 'Kantoor ' + c[5].t)], pills: pilVan(c[6]) }; } },
    '/locaties': { titel: 'Locaties', zoek: 'Naam, gemeente…', noun: 'locatie', nouns: 'locaties', kaart: function (c) {
      return { titel: c[1].t, regels: [deel(c[2].t, c[3].t), c[4].t], pills: pilVan(c[5]) }; } }
  };
  function maakKaart(cfg, rijHtml) {
    var c = splitsCellen(rijHtml), blank = { t: '', alle: '', pillen: [] };
    for (var i = 0; i < 8; i++) if (!c[i]) c[i] = blank;
    var k = cfg.kaart(c); k.id = rijId(rijHtml); k.heeftVinkje = !cfg.geenVinkje && !!(c[0] && c[0].checkbox);
    k.regels = (k.regels || []).filter(function (x) { return !LEEG(x); });
    return k;
  }

  // ── HTML-bouwers (pure functies) ──
  function kaartHtml(k, gekozen) {
    var v = k.heeftVinkje ? '<button type="button" class="gl-v' + (gekozen ? ' x' : '') + '" role="checkbox" aria-checked="' + (!!gekozen) + '" aria-label="Kies ' + esc(k.titel) + '" data-gl="vink" data-id="' + esc(k.id) + '"><i></i></button>' : '';
    return '<div class="gl-o' + (k.heeftVinkje ? '' : ' gl-een') + (k.klein ? ' gl-klein' : '') + '" role="button" tabindex="0" data-gl="open" data-id="' + esc(k.id) + '">' + v
      + '<div class="gl-t"><b>' + esc(k.titel) + '</b>' + k.regels.map(function (r) { return '<small>' + esc(r) + '</small>'; }).join('')
      + (k.pills.length ? '<div class="gl-p">' + k.pills.map(function (p) { return '<span class="p' + (p.k ? ' ' + p.k : '') + '">' + esc(p.t) + '</span>'; }).join('') + '</div>' : '') + '</div><div class="gl-g" aria-hidden="true">›</div></div>';
  }
  function kopHtml(cfg) {
    return '<div class="gl-k"><b>' + esc(cfg.titel) + '</b><button type="button" class="gl-ik" data-gl="export" aria-label="Exporteren">⬇</button>'
      + (cfg.geenNieuw ? '' : '<button type="button" class="gl-ik b" data-gl="nieuw" aria-label="Nieuw">+</button>') + '</div>';
  }
  function chipsHtml(chips) {
    return chips.map(function (c) { return '<button type="button" class="gl-c' + (c.act ? ' a' : '') + '" data-gl="chip" data-f="' + esc(c.key) + '" aria-pressed="' + (!!c.act) + '">' + esc(c.label) + '</button>'; }).join('');
  }
  function balkHtml(n, nouns) { return n ? '<span>' + n + ' gekozen</span><button type="button" class="gl-alles" data-gl="alles">Alles</button><button type="button" class="gl-acties" data-gl="acties">Acties</button>' : ''; }
  var GEVAAR = /verwijder|deactiveer|wissen/i;
  function sheetHtml(n, cfg, acties) {
    return '<div class="gl-sh" role="dialog" aria-label="Acties"><div class="gl-sht">Acties voor ' + n + ' ' + (n === 1 ? cfg.noun : cfg.nouns) + '</div>'
      + acties.map(function (a, i) { return '<button type="button" class="gl-b' + (a.gevaar ? ' r' : '') + '" data-gl="actie" data-i="' + i + '"' + (a.uit ? ' disabled' : '') + '>' + esc(a.label) + (a.gevaar && !/…$/.test(a.label) ? '…' : '') + '</button>'; }).join('')
      + '<button type="button" class="gl-b gl-annuleer" data-gl="sluit">Annuleren</button></div>';
  }
  var acti = function (knoppen) { return knoppen.map(function (b) { var l = String(b.label).replace(/\s+/g, ' ').trim(); return { label: l, gevaar: GEVAAR.test(l), uit: !!b.uit }; }); };

  // ── Browser ──
  function start() {
    var doc = root.document, loc = root.location; if (!doc || !loc) return;
    var cfg = PAGINA[loc.pathname.replace(/\/$/, '')]; if (!cfg) return;
    var MQ = root.matchMedia ? root.matchMedia('(max-width:767px)') : { matches: false };
    var $ = function (id) { return doc.getElementById(id); };
    var gl = doc.createElement('div'); gl.id = 'gl'; gl.setAttribute('aria-label', cfg.titel);
    gl.innerHTML = kopHtml(cfg) + '<div class="gl-z"><input type="search" id="gl-zoek" placeholder="🔍 ' + esc(cfg.zoek) + '" aria-label="Zoeken" autocomplete="off"></div>'
      + (cfg.loggen ? '' : '') + '<div class="gl-cw"><div class="gl-cs" id="gl-chips"></div></div><div class="gl-l" id="gl-lijst"></div><div class="gl-ba" id="gl-ba" hidden></div>';
    var terug = doc.createElement('div'); terug.id = 'gl-terug'; terug.innerHTML = '<button type="button" data-gl="terug" aria-label="Terug">‹ <span id="gl-terug-t"></span></button>';
    var sheet = doc.createElement('div'); sheet.id = 'gl-sheet'; sheet.hidden = true;
    doc.body.appendChild(gl); doc.body.appendChild(terug); doc.body.appendChild(sheet);
    var logboek = loc.pathname === '/logboek', open = false, laatsteTitel = '';
    var wie = function () { return doc.querySelector('#detail'); };
    var host = function () { var d = wie(); return d ? (d.classList.contains('kaart') ? d : (d.closest('.kaart') || d)) : null; };
    function zet() {
      var aan = !!MQ.matches; doc.body.classList.toggle('gl', aan);
      var h = host(); if (h) h.classList.add('gl-host');
      if (!aan) { doc.body.classList.remove('gl-detail'); open = false; }
    }
    // chips: gespiegeld uit de desktop-chips (zelfde tellers), of voor het logboek vaste voorinstellingen
    function chipsLezen() {
      if (logboek) {
        var v = $('f-van') && $('f-van').value, t = $('f-tot') && $('f-tot').value, vandaag = dag(0), wk = dag(-((new Date().getDay() + 6) % 7));
        var leeg = !v && !t;
        return [{ key: 'vandaag', label: 'Vandaag', act: v === vandaag && t === vandaag }, { key: 'week', label: 'Week', act: v === wk && !t }, { key: 'alles', label: 'Alles', act: leeg }];
      }
      return Array.prototype.slice.call(doc.querySelectorAll('.filters .chip')).map(function (e) { return { key: e.getAttribute('data-f') || '', label: tekst(e.innerHTML), act: e.classList.contains('act') }; }).filter(function (c) { return c.key; });
    }
    function dag(delta) { var d = new Date(); d.setDate(d.getDate() + delta); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    function zetVeld(el, waarde, gebeurtenis) { if (!el) return; el.value = waarde; el.dispatchEvent(new root.Event(gebeurtenis, { bubbles: true })); }
    var rijen = function () { return Array.prototype.slice.call(doc.querySelectorAll('#lijst > .r')); };
    var vink = function (id) { return Array.prototype.slice.call(doc.querySelectorAll('#lijst input[data-sel]')).filter(function (e) { return e.getAttribute('data-sel') === id; })[0]; };
    var gekozenIds = function () { return Array.prototype.slice.call(doc.querySelectorAll('#lijst input[data-sel]:checked')).map(function (e) { return e.getAttribute('data-sel'); }); };
    var bulk = function () { return Array.prototype.slice.call(doc.querySelectorAll('.bulk button')); };
    function teken() {
      if (!MQ.matches) return;
      var lst = $('gl-lijst'), y = lst.scrollTop, gek = new Set(gekozenIds());
      var kaarten = rijen().map(function (r) { try { return maakKaart(cfg, r.outerHTML); } catch (e) { return null; } }).filter(Boolean);
      lst.innerHTML = kaarten.length ? kaarten.map(function (k) { return kaartHtml(k, gek.has(k.id)); }).join('') : '<div class="gl-leeg">' + esc(tekst((doc.querySelector('#lijst .leeg') || { innerHTML: 'Niets gevonden' }).innerHTML)) + '</div>';
      lst.scrollTop = y;
      var ch = $('gl-chips'), cs = chipsLezen(), sx = ch.scrollLeft; ch.innerHTML = chipsHtml(cs); ch.scrollLeft = sx; pijl();
      var n = gek.size, ba = $('gl-ba'); ba.hidden = !n; ba.innerHTML = balkHtml(n, cfg.nouns); doc.body.classList.toggle('gl-sel', !!n);
      // eigen filters van het logboek: wie en tabel
      var zo = $('gl-zoek'); if (doc.activeElement !== zo) { var bron = logboek ? $('f-zoek') : $('zoek'); if (bron && zo.value !== bron.value && !zo._eigen) zo.value = bron.value; }
      var pe = $('gl-ac'); if (pe && !sheet.hidden) bijwerkenSheet();
      zet();
    }
    function pijl() { var cw = doc.querySelector('.gl-cw'), cs = $('gl-chips'); cw.classList.toggle('meer', cs.scrollWidth - cs.scrollLeft - cs.clientWidth > 4); var a = cs.querySelector('.a'); if (a && !cs._eerst) { cs._eerst = true; try { a.scrollIntoView({ inline: 'center', block: 'nearest' }); } catch (e) { /* oud */ } } }
    var wacht = null, plan = function () { clearTimeout(wacht); wacht = setTimeout(teken, 40); };
    var lijstEl = $('lijst'); if (lijstEl && root.MutationObserver) new root.MutationObserver(plan).observe(lijstEl, { childList: true, subtree: true });
    var fl = doc.querySelector('.filters'); if (fl && root.MutationObserver) new root.MutationObserver(plan).observe(fl, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    if (root.addEventListener) root.addEventListener('sporty-live', function () { setTimeout(plan, 300); });
    if (MQ.addEventListener) MQ.addEventListener('change', function () { zet(); plan(); });
    function toonDetail(id, titel) {
      var r = rijen().filter(function (x) { return rijId(x.outerHTML) === id; })[0]; if (!r) return;
      r.click(); open = true; laatsteTitel = titel; $('gl-terug-t').textContent = titel; doc.body.classList.add('gl-detail');
      try { root.history.pushState({ gl: 1 }, ''); } catch (e) { /* geen history */ }
      if (root.scrollTo) root.scrollTo(0, 0);
    }
    function sluitDetail() { open = false; doc.body.classList.remove('gl-detail'); plan(); }
    root.addEventListener('popstate', function () { if (open) sluitDetail(); });
    var acties = [];
    function bijwerkenSheet() { var n = gekozenIds().length; if (!n) { sheet.hidden = true; return; } acties = acti(bulk().map(function (b) { return { label: b.textContent, uit: b.disabled }; })); sheet.innerHTML = '<div class="gl-bg" data-gl="sluit"></div>' + sheetHtml(n, cfg, acties); }
    function exporteer() {
      var b = $('export'); if (b && !logboek) { b.click(); return; }
      var kaarten = rijen().map(function (r) { return maakKaart(cfg, r.outerHTML); }), csv = 'titel;regels\r\n' + kaarten.map(function (k) { return '"' + k.titel.replace(/"/g, '""') + '";"' + k.regels.join(' | ').replace(/"/g, '""') + '"'; }).join('\r\n');
      var a = doc.createElement('a'); a.href = root.URL.createObjectURL(new root.Blob([csv], { type: 'text/csv' })); a.download = cfg.titel.toLowerCase() + '.csv'; a.click();
    }
    doc.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-gl]'); if (!t) return; var a = t.getAttribute('data-gl'), id = t.getAttribute('data-id') || '';
      if (a === 'vink') { e.stopPropagation(); var c = vink(id); if (c) c.click(); return; }
      if (a === 'open') { var k = t.querySelector('b'); return toonDetail(id, k ? k.textContent : cfg.titel); }
      if (a === 'terug') { return root.history.state && root.history.state.gl ? root.history.back() : sluitDetail(); }
      if (a === 'nieuw') { var n = $('nieuw'); if (n) n.click(); return; }
      if (a === 'export') return exporteer();
      if (a === 'alles') { var al = $('alles'); if (al) al.click(); return; }
      if (a === 'acties') { sheet.hidden = false; bijwerkenSheet(); return; }
      if (a === 'sluit') { sheet.hidden = true; return; }
      if (a === 'actie') { var ac = acties[+t.getAttribute('data-i')]; if (!ac || ac.uit) return; var b = bulk()[+t.getAttribute('data-i')]; sheet.hidden = true; if (b) b.click(); return; }
      if (a === 'chip') {
        var f = t.getAttribute('data-f');
        if (logboek) { if (f === 'vandaag') { zetVeld($('f-van'), dag(0), 'change'); zetVeld($('f-tot'), dag(0), 'change'); } else if (f === 'week') { zetVeld($('f-van'), dag(-((new Date().getDay() + 6) % 7)), 'change'); zetVeld($('f-tot'), '', 'change'); } else { zetVeld($('f-van'), '', 'change'); zetVeld($('f-tot'), '', 'change'); } return setTimeout(plan, 300); }
        var d = Array.prototype.slice.call(doc.querySelectorAll('.filters .chip')).filter(function (x) { return x.getAttribute('data-f') === f; })[0]; if (d) d.click(); return;
      }
    });
    doc.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.gl-o')) { e.preventDefault(); e.target.click(); } });
    $('gl-zoek').addEventListener('input', function (e) { var z = e.target; z._eigen = true; var bron = logboek ? $('f-zoek') : $('zoek'); zetVeld(bron, z.value, 'input'); setTimeout(function () { z._eigen = false; plan(); }, 300); });
    $('gl-chips').addEventListener('scroll', pijl, { passive: true });
    zet(); teken(); setTimeout(teken, 800); setTimeout(teken, 2500);
  }
  if (root.document && root.document.addEventListener) { if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start); else start(); }
  return { splitsCellen: splitsCellen, maakKaart: maakKaart, kaartHtml: kaartHtml, kopHtml: kopHtml, chipsHtml: chipsHtml, balkHtml: balkHtml, sheetHtml: sheetHtml, acti: acti, PAGINA: PAGINA, pilKlasse: pilKlasse, tekst: tekst, rijId: rijId };
});
