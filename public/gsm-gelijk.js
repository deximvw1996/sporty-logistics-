/* public/gsm-gelijk.js — MOB3: gedeelde gsm-hulp voor alle pagina's onder 768 px.
   1. Export en + Nieuw uit de subbalk naar een eigen, altijd zichtbare rij.  2. Scrollbare balken tonen dat er meer is; de actieve chip scrolt in beeld.
   3. Eén tik op een element met title opent dezelfde uitleg (hover bestaat niet op gsm).  Geen eigen opslag. */
(function (root, fabriek) { var api = fabriek(root); if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GsmGelijk = api; })(typeof window !== 'undefined' ? window : globalThis, function (root) {
  var GSM = '(max-width:767px)';
  function isGsm() { return !!(root.matchMedia && root.matchMedia(GSM).matches); }
  // Uitlegtekst voor een element: eerste voorouder met title. Velden en knoppen/links met een eigen actie tellen niet mee (die doen hun werk); uitgeschakelde wel.
  function uitlegVoor(el) {
    for (var e = el; e && e.nodeType === 1; e = e.parentElement) {
      var t = e.getAttribute && e.getAttribute('title');
      if (!t || !t.trim()) continue;
      var tag = e.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return '';
      if ((tag === 'BUTTON' || tag === 'A') && !e.disabled && e.getAttribute('aria-disabled') !== 'true') return '';
      return t.trim();
    }
    return '';
  }
  var uitlegEl = null, uitlegTimer = null;
  function sluitUitleg() { if (uitlegEl && uitlegEl.parentNode) uitlegEl.parentNode.removeChild(uitlegEl); uitlegEl = null; clearTimeout(uitlegTimer); }
  function toonUitleg(tekst) {
    sluitUitleg(); var d = root.document.createElement('div'); d.className = 'gsm-uitleg'; d.setAttribute('role', 'status'); d.textContent = tekst;
    root.document.body.appendChild(d); uitlegEl = d; uitlegTimer = setTimeout(sluitUitleg, 6000);
  }
  // Verplaatst de actieknoppen uit .sub .r naar een eigen rij; op desktop terug.
  function plaatsActies(doc) {
    var r = doc.querySelector('.sub .r'); var rij = doc.querySelector('.gsm-acties');
    if (isGsm()) {
      if (!r || !r.children.length) return false;
      if (!rij) { rij = doc.createElement('div'); rij.className = 'gsm-acties'; r.closest('.sub').insertAdjacentElement('afterend', rij); rij._thuis = r; }
      while (r.firstChild) rij.appendChild(r.firstChild);
      return true;
    }
    if (rij && rij._thuis) { while (rij.firstChild) rij._thuis.appendChild(rij.firstChild); rij.parentNode.removeChild(rij); }
    return false;
  }
  function scrollHints(doc) {
    var lijst = doc.querySelectorAll('.sub, .filters, .chips, .weekrij');
    for (var i = 0; i < lijst.length; i++) (function (el) {
      if (!isGsm() || el.scrollWidth <= el.clientWidth + 4) { el.classList.remove('gsm-scroll'); return; }
      el.classList.add('gsm-scroll');
      var eind = function () { el.classList.toggle('gsm-eind', el.scrollLeft + el.clientWidth >= el.scrollWidth - 4); };
      if (!el._gsmHint) { el._gsmHint = true; el.addEventListener('scroll', eind, { passive: true }); }
      eind();
      var act = el.querySelector('.act, .on, .chip.sel');
      if (act && !el._gsmAct && act.scrollIntoView) { el._gsmAct = true; try { act.scrollIntoView({ inline: 'center', block: 'nearest' }); } catch (e) { /* oude browser */ } }
    })(lijst[i]);
  }
  function start() {
    var doc = root.document; if (!doc || !doc.body) return;
    var tik = function () { plaatsActies(doc); scrollHints(doc); };
    tik();
    if (root.MutationObserver) { var wacht; new root.MutationObserver(function () { clearTimeout(wacht); wacht = setTimeout(tik, 80); }).observe(doc.body, { childList: true, subtree: true }); }
    if (root.matchMedia) { var mq = root.matchMedia(GSM); if (mq.addEventListener) mq.addEventListener('change', tik); else if (mq.addListener) mq.addListener(tik); }
    doc.addEventListener('click', function (e) {
      if (!isGsm()) return;
      if (uitlegEl) sluitUitleg();
      var t = uitlegVoor(e.target); if (t) toonUitleg(t);
    }, true);
  }
  if (root.document && root.document.addEventListener) { if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start); else start(); }
  return { uitlegVoor: uitlegVoor, toonUitleg: toonUitleg, sluitUitleg: sluitUitleg, plaatsActies: plaatsActies, scrollHints: scrollHints, isGsm: isGsm };
});
