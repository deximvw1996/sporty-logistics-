// public/planning-ploeg.js — TF13 punt 4: de planning van de ploeg, alleen bekijken. Eigen planning bovenaan; Meehelpen voor vandaag en morgen.
(function () {
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var tok = ''; try { tok = localStorage.getItem('sporty-auth-token') || ''; } catch (e) { /* geen opslag */ }
  var DAG = '', $ = function (i) { return document.getElementById(i); };
  function itemHtml(x) {
    if (x.soort === 'afspraak') return '<div class="it af"><div class="nm"><b>' + esc(x.van) + (x.tot ? '–' + esc(x.tot) : '') + ' ' + esc(x.titel) + '</b><small>' + esc(x.voertuig || '') + (x.klaar ? ' · klaar' : '') + '</small></div></div>';
    return '<div class="it"><div class="nm"><b>' + esc(x.tijd) + (x.einde ? '–' + esc(x.einde) : '') + ' · opdracht #' + x.opdracht_id + '</b><small>' + esc([x.voertuig, x.stand, x.mensen.join(', ')].filter(Boolean).join(' · ')) + '</small><small>' + esc(x.stops.join(' → ')) + '</small></div>' + (x.kan_meehelpen ? '<a class="mee" href="/meehelpen/' + x.id + '">Meehelpen</a>' : '') + '</div>';
  }
  async function laad() {
    var r = await fetch('/api/planning-ploeg' + (DAG ? '?datum=' + DAG : ''), { headers: { 'x-auth-token': tok } });
    if (r.status === 401) { location.replace('/login?terug=/planning-ploeg'); return; }
    var j = await r.json(); if (!r.ok) { $('lijst').textContent = j.error || 'Laden mislukt'; return; }
    DAG = j.datum; $('dag').textContent = 'Planning ploeg · ' + new Date(DAG + 'T12:00:00').toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' });
    $('lijst').innerHTML = j.personen.map(function (p) { return '<div class="pers' + (p.eigen ? ' eigen' : '') + '"><h3>' + esc(p.naam) + (p.eigen ? ' (ik)' : '') + '</h3>' + (p.items.map(itemHtml).join('') || '<div class="leeg">niets gepland</div>') + '</div>'; }).join('') || '<div class="leeg">niets gepland</div>';
  }
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-d]'); if (!b) return; var d = new Date(DAG + 'T12:00:00'); d.setDate(d.getDate() + +b.dataset.d); DAG = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); laad(); });
  window.addEventListener('sporty-live', laad);
  laad();
})();
