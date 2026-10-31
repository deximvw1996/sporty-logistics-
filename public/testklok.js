// public/testklok.js — TK1: wordt alleen in de HTML gezet met SPORTY_TESTKLOK=1 en laadt vóór elk ander script.
// Verschuift Date in de browser en tekent de vaste klok met ⟲ bovenaan. Een wissel laat open vensters en ingevulde velden staan.
(function (root) {
  'use strict';
  var Echt = root.Date, v = root.__TESTKLOK_VERSCHIL || 0;
  function K() {
    var a = [].slice.call(arguments);
    if (!new.target) return new Echt(Echt.now() + v).toString();
    return a.length ? new (Function.prototype.bind.apply(Echt, [null].concat(a)))() : new Echt(Echt.now() + v);
  }
  K.prototype = Echt.prototype; K.now = function () { return Echt.now() + v; }; K.parse = Echt.parse; K.UTC = Echt.UTC;
  root.Date = K;
  root.__testklokZet = function (x) { v = x; };
  var doc = root.document; if (!doc || !doc.createElement) return;

  var echteFetch = root.fetch && root.fetch.bind(root), DAG = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'], MND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  var z = function (n) { return String(n).padStart(2, '0'); };
  var tekst = function () { var d = new Echt(Echt.now() + v); return DAG[d.getDay()] + ' ' + d.getDate() + ' ' + MND[d.getMonth()] + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()); };
  var st = doc.createElement('style');
  st.textContent = 'html{--tk-h:40px;padding-top:var(--tk-h,40px)}#tk-balk{position:fixed;top:0;left:0;right:0;height:var(--tk-h,40px);z-index:2147483000;display:flex;align-items:center;justify-content:flex-end;gap:6px;padding:2px 8px;box-sizing:border-box;background:#e2e8f0;color:#334155;font:700 13px system-ui;white-space:nowrap;overflow:hidden}#tk-balk.verzet{background:#ea580c;color:#fff}#tk-balk button{font:inherit;color:inherit;background:rgba(255,255,255,.3);border:1px solid rgba(0,0,0,.2);border-radius:8px;height:36px;min-width:36px;padding:0 8px;cursor:pointer}#tk-balk button:disabled{opacity:.4;cursor:default}#tk-ververs{margin-right:auto}#tk-venster{position:fixed;top:var(--tk-h,40px);right:8px;z-index:2147483001;background:#fff;color:#111;border:1px solid #94a3b8;border-radius:12px;padding:12px;width:min(320px,calc(100vw - 16px));box-sizing:border-box;box-shadow:0 8px 24px rgba(0,0,0,.25);font:14px system-ui;display:grid;grid-template-columns:1fr 1fr;gap:8px}#tk-venster input{min-height:44px;font:16px system-ui;border:1px solid #cbd5e1;border-radius:8px;padding:0 6px;min-width:0;width:100%;box-sizing:border-box}#tk-venster button{min-height:44px;font:700 13px system-ui;border:0;border-radius:8px;background:#dbeafe;color:#1e3a8a;cursor:pointer}#tk-venster .tk-z{grid-column:1/3;background:#1e3a8a;color:#fff}@media (max-width:767px){:root{--tk-h:48px}#tk-balk button{height:44px;min-width:44px}}@media print{html{padding-top:0!important}#tk-balk,#tk-venster{display:none!important}}';
  (doc.head || doc.documentElement).appendChild(st);

  var balk, klokKnop, terug, ververs, venster = null, vuil = false;
  function teken() {
    if (!balk) return;
    balk.classList.toggle('verzet', v !== 0);
    klokKnop.textContent = '🕐 ' + (v !== 0 ? tekst() : tekst() + ' · echt');
    terug.disabled = v === 0;
  }
  var isOverlay = function () { return !!doc.querySelector('[role=dialog],.mbg,.dim,.meld,.sheet'); };
  // Vaste en plakkende onderdelen schuiven onder de klokbalk, ook een overlay over het volledige scherm.
  function schuif() {
    var h = balk ? balk.offsetHeight : 0; if (!h) return;
    [].forEach.call(doc.body.querySelectorAll('*'), function (e) {
      if (e === balk || e === venster || balk.contains(e)) return;
      var c = root.getComputedStyle(e);
      if (c.position === 'fixed' && e.getBoundingClientRect().top < h && c.top !== 'auto') e.style.top = h + 'px';
      else if (c.position === 'sticky' && parseFloat(c.top) < h) e.style.top = h + 'px';
    });
  }
  // Na een wissel: de pagina ververst zelf als ze dat kan (rit, KV); anders herladen, behalve bij werk dat open staat: dan een knop.
  function naWissel() {
    teken();
    var eigen = !!(root.__RIT_TOKEN || root.__KV_TOKEN);
    root.dispatchEvent(new Event('testklok-wissel'));
    if (eigen) return;
    if (isOverlay() || vuil) { ververs.hidden = false; return; }
    root.location.reload();
  }
  function zet(body) {
    body.via = root.location.pathname;
    var h = { 'Content-Type': 'application/json' }, t = null; try { t = root.localStorage.getItem('sporty-auth-token'); } catch (e) { /* geen opslag */ }
    if (t) h['x-auth-token'] = t;
    return echteFetch('/api/testklok', { method: 'POST', headers: h, body: JSON.stringify(body) }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error); v = j.verschil; naWissel(); }); }).catch(function (e) { root.alert(e.message || 'Klok wisselen mislukt'); });
  }
  function toggleVenster() {
    if (venster) { venster.remove(); venster = null; return; }
    var d = new Echt(Echt.now() + v);
    venster = doc.createElement('div'); venster.id = 'tk-venster'; venster.setAttribute('data-testklok', '1');
    venster.innerHTML = '<input type="date" id="tk-d" aria-label="Datum" value="' + d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + '"><input type="time" id="tk-u" aria-label="Uur" value="' + z(d.getHours()) + ':' + z(d.getMinutes()) + '"><button type="button" class="tk-z" data-tk="zet">Zetten</button><button type="button" data-tk="plus_uur">+1 uur</button><button type="button" data-tk="plus_dag">+1 dag</button><button type="button" data-tk="maandag">Volgende maandag 08:00</button><button type="button" data-tk="vrijdag">Volgende vrijdag 16:00</button>';
    ['click', 'mousedown', 'keydown', 'input', 'change', 'pointerdown'].forEach(function (n) { venster.addEventListener(n, function (e) { e.stopPropagation(); }); });
    venster.addEventListener('click', function (e) {
      var k = e.target.getAttribute && e.target.getAttribute('data-tk'); if (!k) return;
      zet(k === 'zet' ? { datum: venster.querySelector('#tk-d').value, uur: venster.querySelector('#tk-u').value } : { actie: k }).then(function () { if (venster) { venster.remove(); venster = null; } });
    });
    doc.documentElement.appendChild(venster);
  }
  function start() {
    balk = doc.createElement('div'); balk.id = 'tk-balk'; balk.setAttribute('data-testklok', '1');
    ververs = doc.createElement('button'); ververs.id = 'tk-ververs'; ververs.type = 'button'; ververs.textContent = 'Gegevens verversen'; ververs.hidden = true; ververs.onclick = function () { root.location.reload(); };
    klokKnop = doc.createElement('button'); klokKnop.id = 'tk-klok'; klokKnop.type = 'button'; klokKnop.onclick = toggleVenster;
    terug = doc.createElement('button'); terug.id = 'tk-echt'; terug.type = 'button'; terug.textContent = '⟲'; terug.title = 'Naar de echte tijd'; terug.setAttribute('aria-label', 'Naar de echte tijd'); terug.onclick = function () { zet({ actie: 'echt' }); };
    balk.appendChild(ververs); balk.appendChild(klokKnop); balk.appendChild(terug);
    ['click', 'mousedown', 'pointerdown'].forEach(function (n) { balk.addEventListener(n, function (e) { e.stopPropagation(); }); });
    doc.documentElement.appendChild(balk);
    doc.addEventListener('input', function (e) { if (!(e.target.closest && e.target.closest('[data-testklok]'))) vuil = true; }, true);
    teken(); schuif();
    var tm = null; new root.MutationObserver(function () { clearTimeout(tm); tm = setTimeout(schuif, 80); }).observe(doc.body, { childList: true, subtree: true });
    root.addEventListener('resize', schuif);
    setInterval(teken, 20000);
    var kijk = function () { echteFetch('/api/testklok').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.verschil !== v) { v = j.verschil; naWissel(); } }).catch(function () { /* geen verbinding */ }); };
    setInterval(kijk, 30000);
    doc.addEventListener('visibilitychange', function () { if (!doc.hidden) kijk(); });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})(typeof window !== 'undefined' ? window : globalThis);
