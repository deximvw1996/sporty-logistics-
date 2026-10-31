// public/nuoplossen.js — RT1: rood blok bovenaan Vandaag, één blok per rit. Alleen kantoor (anders 403 en niets).
(function () {
  var tok = function () { try { return localStorage.getItem('sporty-auth-token') || ''; } catch (e) { return ''; } };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var AK = { gevonden: 'Gevonden', inplannen: 'Toch inplannen', afschrijven: 'Afschrijven', opgelost: 'Opgelost' };
  function plek() {
    var el = document.getElementById('nu-oplossen'); if (el) return el;
    el = document.createElement('section'); el.id = 'nu-oplossen';
    var g = document.getElementById('gsm'), k = document.querySelector('.kols'), doel = g && !g.hidden ? g : k;
    if (!doel) return null; doel.parentNode.insertBefore(el, doel); return el;
  }
  function teken(l) {
    var el = plek(); if (!el) return;
    el.hidden = !l.length;
    el.innerHTML = l.length ? '<h2 style="color:#b91c1c;font-size:17px;margin:8px 0">Nu oplossen · ' + l.length + '</h2>' + l.map(function (r) {
      return '<div style="border:2px solid #dc2626;background:#fef2f2;border-radius:10px;padding:10px 12px;margin-bottom:10px"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b style="flex:1;min-width:180px">' + esc(r.chauffeur) + ' · rit #' + r.rit_id + ' · ' + esc(r.locatie) + '</b>' +
        (r.telefoon ? '<a href="tel:' + esc(r.telefoon) + '" style="background:#dc2626;color:#fff;border-radius:8px;padding:0 14px;min-height:44px;display:inline-flex;align-items:center;font-weight:700;text-decoration:none">📞 Bel ' + esc(r.chauffeur) + '</a>' : '<span style="color:#7f1d1d;font-size:12px">geen telefoonnummer</span>') + '</div>' +
        r.items.map(function (x) {
          return '<div style="border-top:1px solid #fecaca;margin-top:8px;padding-top:8px"><b>' + esc(x.titel) + '</b><div style="font-size:12px;color:#475569">Normaal: ' + esc(x.waar_normaal) + ' · laatste rit: ' + esc(x.laatste_rit) + ' · laatste telling: ' + esc(x.laatste_telling) + '</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">' +
            x.acties.map(function (a) { return '<button type="button" data-nu="' + x.id + '" data-a="' + a + '" style="min-height:44px;padding:0 12px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;font-weight:600;cursor:pointer">' + AK[a] + '</button>'; }).join('') + '</div></div>';
        }).join('') + '</div>';
    }).join('') : '';
  }
  function laad() {
    fetch('/api/nu-oplossen', { headers: { 'x-auth-token': tok() } }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j) teken(j.ritten); }).catch(function () {});
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-nu]'); if (!b) return; b.disabled = true;
    fetch('/api/nu-oplossen/' + b.dataset.nu, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': tok() }, body: JSON.stringify({ actie: b.dataset.a }) }).then(laad);
  });
  window.addEventListener('sporty-live', laad);
  setTimeout(laad, 300);
})();
