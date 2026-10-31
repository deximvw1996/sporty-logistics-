// public/standaardmateriaal.js — BW1 punt 3: Locaties › Standaardmateriaal (design/mockup-opdracht-kampmoment.html, tab 3), op locatie_materiaal.
// Per locatie vink je aan wat standaard meegaat en hoeveel. Het gaat mee bij de opening, blijft staan tot de sluiting en wordt dan opgehaald.
// Wijzigt het tijdens de open weken, dan stelt het scherm een taak voor om bij te leveren of op te halen (na bevestiging). De voorraadmelding is een melding, geen verbod.
// De pure bouwers (BOUW) zijn exporteerbaar zodat de test ze met echte data-JSON kan aanroepen.
'use strict';
(function (root) {
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var BOUW = {
    lijst: function (L, st) {
      var q = String(st.zoek || '').toLowerCase();
      return L.locaties.filter(function (l) { return !q || l.naam.toLowerCase().indexOf(q) >= 0; }).map(function (l) {
        return '<div class="r' + (st.open === l.id ? ' act' : '') + '" role="button" tabindex="0" data-id="' + l.id + '" style="grid-template-columns:1.5fr 80px 1fr"><b>' + esc(l.naam) + '</b><span>' + l.stuks + ' stuks</span><span class="k">' + esc(l.open_tekst) + (l.ingesteld ? '' : ' · nog niet ingesteld') + '</span></div>';
      }).join('') || '<div class="leeg">Geen locaties gevonden.</div>';
    },
    voorraad: function (v) {
      if (!v) return '<span style="color:#64748b"></span>';
      return v.tekort ? '<span class="pil oranje">' + esc(v.tekst) + '</span>' : '<span style="color:#64748b">' + esc(v.tekst) + '</span>';
    },
    rij: function (r) {
      var stap = r.aan ? '<span class="stapje"><button type="button" data-qty="-1" data-t="' + r.item_type_id + '" data-n="' + r.qty + '" aria-label="Minder ' + esc(r.naam) + '">−</button><b>' + r.qty + '</b><button type="button" data-qty="1" data-t="' + r.item_type_id + '" data-n="' + r.qty + '" aria-label="Meer ' + esc(r.naam) + '">+</button></span>' : '<span class="opt">—</span>';
      return '<div class="tr" style="grid-template-columns:30px 1.8fr 80px 130px 1.2fr"><input type="checkbox" data-aan="' + r.item_type_id + '"' + (r.aan ? ' checked' : '') + ' aria-label="' + esc(r.naam) + ' meegeven"><b style="' + (r.aan ? '' : 'font-weight:500;color:#64748b') + '">' + esc(r.naam) + '</b><span style="color:#64748b">' + esc(r.eenheid) + '</span>' + stap + (r.aan ? BOUW.voorraad(r.voorraad) : '<span></span>') + '</div>';
    },
    detail: function (D, st) {
      var rijen = st.filter === 'alles' ? D.aangevinkt_rijen.concat(D.overige_rijen) : D.aangevinkt_rijen;
      var terug = D.valt_terug_op_algemeen ? '<div class="blok" style="margin-bottom:10px;background:#fffbeb"><b>Nog niet ingesteld.</b> Zolang hier niets staat, gebruikt het transport het algemene standaardmateriaal (' + D.algemeen_stuks + ' stuks). Vink aan wat deze locatie echt nodig heeft, of <button type="button" class="knop licht klein" data-act="template">neem het algemene materiaal over</button></div>' : '';
      return '<a class="terug" data-act="terug">‹ terug naar de lijst</a><div class="dkop"><div><h2>' + esc(D.locatie.naam) + '</h2><span>Dit gaat mee bij de opening, blijft staan tot de sluiting en wordt dan opgehaald. Wijzigt het tijdens de open weken: kantoor krijgt een taak om bij te leveren of op te halen.</span></div></div>'
        + terug + '<div class="filters"><input id="cat" type="search" placeholder="🔍 Zoek in de catalogus om toe te voegen…" value="' + esc(st.q || '') + '" aria-label="Zoek in de catalogus"><span class="chip' + (st.filter === 'aan' ? ' act' : '') + '" role="button" tabindex="0" data-f="aan">Aangevinkt ' + D.aangevinkt + '</span><span class="chip' + (st.filter === 'alles' ? ' act' : '') + '" role="button" tabindex="0" data-f="alles">Alles</span><button type="button" class="knop licht klein" style="margin-left:auto" data-act="kopieer">Kopieer van locatie…</button></div>'
        + '<div class="th" style="grid-template-columns:30px 1.8fr 80px 130px 1.2fr"><span></span><span>Materiaal</span><span>Eenheid</span><span>Aantal</span><span>Voorraad</span></div><div class="scroll" id="rijen">' + (rijen.map(BOUW.rij).join('') || '<div class="leeg">' + (st.filter === 'aan' ? 'Nog niets aangevinkt. Zoek hierboven in de catalogus of kies "Alles".' : 'Niets gevonden.') + '</div>') + '</div>';
    }
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = BOUW; return; }

  var TOKEN = root.localStorage.getItem('sporty-auth-token');
  if (!TOKEN) { root.location.href = '/login'; return; }
  var $ = function (id) { return root.document.getElementById(id); };
  function toast(msg, type) {
    var t = root.document.createElement('div'); t.style.background = { info: '#378ADD', error: '#E24B4A', success: '#1D9E75', warn: '#EF9F27' }[type || 'info']; t.textContent = msg; t.onclick = function () { t.remove(); }; $('toasts').appendChild(t);
    setTimeout(function () { t.remove(); }, type === 'error' ? 5000 : 3500);
  }
  var api = function (m, u, b) { return root.sportyApi(m, u, b, { toast: function (x) { toast(x); }, token: TOKEN }); };
  function vraag(titel, tekst, ok, htmlEx, lees) {
    return new Promise(function (resolve) {
      var d = root.document, bg = d.createElement('div'); bg.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px';
      bg.innerHTML = '<div role="dialog" aria-modal="true" style="background:#fff;border-radius:14px;padding:20px 24px;max-width:480px;width:100%;box-shadow:0 20px 50px rgba(0,0,0,.3)"><h3 style="font-size:18px;margin-bottom:6px">' + esc(titel) + '</h3><p style="font-size:14px;color:#475569;margin-bottom:12px">' + esc(tekst) + '</p>' + (htmlEx || '') + '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap"><button type="button" class="knop licht" data-x="0" style="min-height:44px">Nee, niet nu</button><button type="button" class="knop" data-x="1" style="min-height:44px">' + esc(ok) + '</button></div></div>';
      d.body.appendChild(bg);
      bg.addEventListener('click', function (e) { var b = e.target.closest('[data-x]'); if (!b && e.target !== bg) return; var j = b && b.getAttribute('data-x') === '1'; var v = j ? (lees ? lees(bg) : true) : null; bg.remove(); resolve(v); });
    });
  }
  var L = null, D = null, ST = { open: 0, zoek: '', filter: 'aan', q: '' };
  async function laadLijst() { var r = await api('GET', '/api/standaardmateriaal'); if (!r.ok) return toast(r.json.error || 'Laden mislukt', 'error'); L = r.json; if ($('per-naam') && L.periode) $('per-naam').textContent = L.periode.naam; tekenLijst(); }
  function tekenLijst() { $('lijst').innerHTML = BOUW.lijst(L, ST); }
  async function laadDetail(id, stil) {
    ST.open = id; var r = await api('GET', '/api/standaardmateriaal/' + id + (ST.q ? '?q=' + encodeURIComponent(ST.q) : ''));
    if (!r.ok) return toast(r.json.error || 'Laden mislukt', 'error');
    D = r.json; if (ST.q && ST.filter === 'aan') ST.filter = 'alles';
    $('detail').innerHTML = BOUW.detail(D, ST); $('body').classList.add('toon-detail'); tekenLijst();
    if (ST.q) { var c = $('cat'); c.focus(); c.setSelectionRange(c.value.length, c.value.length); }
    try { root.history.replaceState(null, '', '/standaardmateriaal?locatie=' + id); } catch (e) { /* ignore */ }
  }
  async function wijzig(typeId, body) {
    var r = await api('PUT', '/api/standaardmateriaal/' + ST.open + '/' + typeId, body);
    if (!r.ok) { toast(r.json.error || 'Opslaan mislukt', 'error'); return laadDetail(ST.open); }
    var tv = r.json.taak_voorstel;
    await laadDetail(ST.open); await laadLijst();
    if (r.json.voorraad && r.json.voorraad.tekort && r.json.delta > 0) toast('Let op: ' + r.json.voorraad.tekst + '. Dit blijft een melding, geen verbod.', 'warn');
    if (tv) {
      var ja = await vraag('Deze locatie is nu open', tv.tekst + ' Een taak aanmaken voor kantoor?', 'Taak aanmaken');
      if (ja) { var t = await api('POST', '/api/standaardmateriaal/' + ST.open + '/taak', { item_type_id: tv.item_type_id, delta: tv.delta }); if (t.ok) toast('✓ Taak #' + t.json.taak_id + ' aangemaakt voor ' + t.json.datum + ' — te plannen in Transport › Taken', 'success'); else toast(t.json.error || 'Taak aanmaken mislukt', 'error'); }
    }
  }
  root.document.addEventListener('click', async function (e) {
    var t = e.target;
    var rij = t.closest('.r[data-id]'); if (rij) return laadDetail(+rij.getAttribute('data-id'));
    var ch = t.closest('[data-f]'); if (ch) { ST.filter = ch.getAttribute('data-f'); if (ST.filter === 'aan') ST.q = ''; return laadDetail(ST.open); }
    var q = t.closest('[data-qty]'); if (q) return wijzig(+q.getAttribute('data-t'), { aan: true, qty: Math.max(1, +q.getAttribute('data-n') + +q.getAttribute('data-qty')) });
    var a = t.closest('[data-act]'); if (!a) return;
    var act = a.getAttribute('data-act');
    if (act === 'terug') { $('body').classList.remove('toon-detail'); return; }
    if (act === 'template') { var r = await api('POST', '/api/locaties/' + ST.open + '/materiaal-van-template', {}); if (r.ok) toast('✓ ' + (r.json.length || 0) + ' regels overgenomen', 'success'); await laadLijst(); return laadDetail(ST.open); }
    if (act === 'kopieer') {
      var bron = L.locaties.filter(function (l) { return l.id !== ST.open && l.stuks > 0; });
      if (!bron.length) return toast('Geen andere locatie heeft standaardmateriaal om te kopiëren.', 'warn');
      var v = await vraag('Kopieer van locatie', 'Wat de gekozen locatie heeft, wordt toegevoegd; aantallen die verschillen worden overgenomen. Niets wordt weggehaald.', 'Kopiëren',
        '<label style="display:block;font-size:12px;font-weight:700;color:#64748b;margin-bottom:4px" for="kop-van">Van locatie</label><select id="kop-van" style="height:44px;width:100%;border:1px solid #cbd5e1;border-radius:8px;margin-bottom:12px">' + bron.map(function (l) { return '<option value="' + l.id + '">' + esc(l.naam) + ' · ' + l.stuks + ' stuks</option>'; }).join('') + '</select>', function (bg) { return { van: +bg.querySelector('#kop-van').value }; });
      if (!v) return;
      var k = await api('POST', '/api/standaardmateriaal/' + ST.open + '/kopieer', { van_locatie_id: v.van });
      if (!k.ok) return toast(k.json.error || 'Kopiëren mislukt', 'error');
      toast('✓ ' + k.json.nieuw + ' nieuw, ' + k.json.gewijzigd + ' aantal aangepast', 'success'); await laadLijst(); return laadDetail(ST.open);
    }
  });
  root.document.addEventListener('change', function (e) { var c = e.target; if (c.hasAttribute && c.hasAttribute('data-aan')) wijzig(+c.getAttribute('data-aan'), { aan: c.checked, qty: c.checked ? 1 : undefined }); });
  var tm = null;
  root.document.addEventListener('input', function (e) {
    if (e.target.id === 'zoek') { ST.zoek = e.target.value; tekenLijst(); }
    if (e.target.id === 'cat') { clearTimeout(tm); var v = e.target.value; tm = setTimeout(function () { ST.q = v.trim(); laadDetail(ST.open); }, 250); }
  });
  root.document.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role=button]')) { e.preventDefault(); e.target.click(); } });
  (async function () {
    await laadLijst();
    var id = +new URLSearchParams(root.location.search).get('locatie'); if (id) laadDetail(id);
  })();
})(typeof window !== 'undefined' ? window : globalThis);
