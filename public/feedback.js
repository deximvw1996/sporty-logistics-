// public/feedback.js — BW2 punt 5: feedback op "Rit afgerond" en via Meer; de lijst in Meldingen; afspraken op Vandaag.
(function () {
  var pad = location.pathname, m = /^\/rit\/([^/]+)/.exec(pad), tok = ''; try { tok = localStorage.getItem('sporty-auth-token') || ''; } catch (e) { /* geen opslag */ }
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var H = function () { return { 'Content-Type': 'application/json', 'x-auth-token': tok }; };
  var KN = 'min-height:52px;border-radius:12px;background:#fff;border:1px solid #cbd5e1;font-weight:700;display:flex;align-items:center;padding:0 14px;gap:8px;font-size:14px;cursor:pointer;width:100%;text-align:left';
  function openen() {
    var soort = 'rit', foto = '', d = document.createElement('div');
    d.setAttribute('role', 'dialog'); d.className = 'sheet'; d.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.35);display:flex;align-items:center;justify-content:center;z-index:2147482600';
    d.innerHTML = '<div style="background:#f5f5f5;border-radius:14px;padding:16px;width:min(420px,calc(100vw - 24px));max-height:90vh;overflow:auto;display:flex;flex-direction:column;gap:8px;font-family:inherit"><b style="font-size:16px">Feedback waarover?</b>' + [['rit', m ? '🚚 Deze rit' : '🚚 Een rit'], ['locatie', '📍 Een bezoek of locatie'], ['voertuig', '🚐 Het voertuig'], ['probleem', '⚠ Een probleem']].map(function (x) { return '<button type="button" data-k="' + x[0] + '" style="' + KN + '">' + x[1] + '</button>'; }).join('')
      + '<textarea id="fb-tekst" placeholder="bv. sleutel lag niet op zijn plaats, parking vol, band lijkt plat…" style="border:1px solid #cbd5e1;border-radius:12px;padding:10px;min-height:92px;font:inherit;font-size:14px"></textarea><label style="' + KN + '">📷 <span id="fb-fl">Foto toevoegen</span><input type="file" accept="image/*" id="fb-foto" hidden></label><button type="button" id="fb-ok" style="height:52px;border-radius:12px;background:#2563eb;color:#fff;font-weight:800;border:0;cursor:pointer">Versturen naar kantoor</button><button type="button" id="fb-weg" style="height:44px;border-radius:12px;background:#f1f5f9;border:0;cursor:pointer;font-weight:700">Annuleren</button></div>';
    document.body.appendChild(d);
    var kies = function (k) { soort = k; d.querySelectorAll('[data-k]').forEach(function (b) { var a = b.dataset.k === k; b.style.background = a ? '#1e3a8a' : '#fff'; b.style.color = a ? '#fff' : ''; }); }; kies('rit');
    d.addEventListener('click', function (e) { var b = e.target.closest('[data-k]'); if (b) kies(b.dataset.k); });
    d.querySelector('#fb-weg').onclick = function () { d.remove(); };
    d.querySelector('#fb-foto').onchange = function (e) { var f = e.target.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { foto = r.result; d.querySelector('#fb-fl').textContent = '✓ Foto toegevoegd'; }; r.readAsDataURL(f); };
    d.querySelector('#fb-ok').onclick = async function () {
      var tekst = d.querySelector('#fb-tekst').value.trim(); if (!tekst) { d.querySelector('#fb-tekst').focus(); return; }
      var r = await fetch(m ? '/api/rit-token/' + m[1] + '/feedback' : '/api/feedback', { method: 'POST', headers: H(), body: JSON.stringify({ soort: soort, tekst: tekst, foto_data: foto || undefined }) });
      if (r.ok) { d.innerHTML = '<div style="background:#fff;border-radius:14px;padding:24px;font-weight:700">✓ Verstuurd naar kantoor</div>'; setTimeout(function () { d.remove(); }, 1500); }
      else { var j = {}; try { j = await r.json(); } catch (x) { /* leeg */ } alert(j.error || 'Versturen mislukt'); }
    };
  }
  var knop = function () { var b = document.createElement('button'); b.type = 'button'; b.id = 'fb-open'; b.textContent = '💬 Feedback geven'; b.style.cssText = KN + ';margin:8px 0'; b.onclick = openen; return b; };
  if (m) { new MutationObserver(function () { var e = document.querySelector('.einde'); if (e && !e.querySelector('#fb-open')) e.appendChild(knop()); }).observe(document.documentElement, { childList: true, subtree: true }); return; }
  if (!tok) return;
  function zet() {
    if (pad === '/meer' && !document.getElementById('fb-open')) { var hier = document.getElementById('meer'); if (hier && hier.parentNode) hier.parentNode.insertBefore(knop(), hier.nextSibling); }
  }
  // Kantoor: lijst in Meldingen.
  async function lijst() {
    if (pad !== '/meldingen') return;
    var r = await fetch('/api/feedback', { headers: H() }); if (!r.ok) return; var j = await r.json(), e = document.getElementById('fb-lijst');
    if (!e) { e = document.createElement('section'); e.id = 'fb-lijst'; e.style.cssText = 'max-width:640px;margin:12px auto;padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;font-size:14px'; var d = document.getElementById('toasts'); (d && d.parentNode || document.body).insertBefore(e, d || null); }
    e.innerHTML = '<b>Feedback · ' + j.feedback.length + '</b>' + (j.feedback.map(function (f) { return '<div style="border-top:1px solid #eef2f7;padding:6px 0">' + (f.soort === 'probleem' ? '⚠ ' : '') + esc(f.tekst) + '<div style="font-size:12px;color:#64748b">' + esc([f.soort, f.rit_id ? 'rit #' + f.rit_id : '', f.locatie, f.voertuig, f.wie, String(f.created_at || '').slice(0, 10)].filter(Boolean).join(' · ')) + (f.foto_url ? ' · <a href="' + esc(f.foto_url) + '">foto</a>' : '') + '</div></div>'; }).join('') || '<div style="color:#64748b;padding:6px 0">Nog geen feedback.</div>');
  }
  // Afspraken op Vandaag, desktop en gsm.
  async function afspraken() {
    if (pad !== '/vandaag') return;
    var r = await fetch('/api/afspraken/vandaag', { headers: H() }); if (!r.ok) return; var j = await r.json(), e = document.getElementById('afspraken-blok');
    if (!e) { var g = document.getElementById('gsm'), k = document.querySelector('.kols'), doel = g && !g.hidden ? g : k; if (!doel) return; e = document.createElement('section'); e.id = 'afspraken-blok'; doel.parentNode.insertBefore(e, doel); }
    var open = j.afspraken.filter(function (a) { return a.status !== 'klaar'; }); e.hidden = !open.length;
    e.innerHTML = open.map(function (a) { return '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#fef3c7;color:#92400e;border-radius:10px;padding:8px 12px;margin:0 0 8px"><div style="flex:1;min-width:180px"><b>' + esc(a.van) + ' ' + esc(a.titel) + '</b><div style="font-size:12px">' + esc([a.voertuig, a.wie, a.waar, a.tot ? 'tot ' + a.tot : ''].filter(Boolean).join(' · ')) + '</div></div><button type="button" data-afsp="' + a.id + '" style="min-height:44px;padding:0 14px;border-radius:8px;border:0;background:#fff;color:#92400e;font-weight:700;cursor:pointer">Klaar</button></div>'; }).join('');
  }
  document.addEventListener('click', async function (e) { var b = e.target.closest && e.target.closest('[data-afsp]'); if (!b) return; b.disabled = true; await fetch('/api/afspraken/' + b.dataset.afsp + '/klaar', { method: 'POST', headers: H() }); afspraken(); });
  window.addEventListener('sporty-live', function () { lijst(); afspraken(); });
  setTimeout(function () { zet(); lijst(); afspraken(); }, 400);
})();
