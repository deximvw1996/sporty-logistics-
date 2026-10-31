// public/kampmoment-nieuw.js — BW1 punt 1: het dialoog "Nieuw kampmoment" (design/mockup-opdracht-kampmoment.html, tab 1).
// Alles is optioneel behalve locatie en minstens één week (zonder die twee bestaat er geen kampmoment): weken (meerdere = één kampmoment per week),
// dagen, KV, thema's met het aantal groepen en het vinkje standaardmateriaal. Kinderen, kleuters en monitoren staan hier niet. Een thema dat elders
// staat geeft een melding, nooit een verbod. De pure bouwers zijn exporteerbaar (module.exports); het dialoog zelf draait enkel in de browser.
'use strict';
(function (root) {
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var DAGEN = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'], MND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  function weekLabel(per, w) {
    if (!per || !per.start_datum) return 'wk ' + w;
    var a = new Date(per.start_datum + 'T12:00:00'); a.setDate(a.getDate() + (w - 1) * 7); var b = new Date(a); b.setDate(b.getDate() + 4);
    return 'wk ' + w + ' · ' + a.getDate() + (a.getMonth() === b.getMonth() ? '' : ' ' + MND[a.getMonth()]) + '–' + b.getDate() + ' ' + MND[b.getMonth()];
  }
  function knopTekst(st) { var n = st.weken.length; return 'Kampmoment maken' + (n ? ' (' + n + ' ' + (n === 1 ? 'week' : 'weken') + ')' : ''); }
  function themaRij(t, st) {
    var melding = t.elders && t.elders.length ? '<span class="pil oranje">ook in ' + esc(t.elders.join(', ')) + (st.weken.length === 1 ? ', wk ' + st.weken[0] : '') + '</span>' : '<span class="pil groen">vrij</span>';
    var soort = [t.leeftijdsgroep || '', t.categorie === 'themadag' ? 'themadag' : 'kamp'].filter(Boolean).join(' · ');
    return '<div class="tr" style="grid-template-columns:1.5fr 1.1fr 110px 90px 1.2fr 44px"><b>' + esc(t.naam) + '</b><span class="k">' + esc(soort) + '</span>'
      + '<span class="stapje"><button type="button" data-grp="-1" data-id="' + t.id + '" aria-label="Minder groepen">−</button><b>' + t.groepen + '</b><button type="button" data-grp="1" data-id="' + t.id + '" aria-label="Meer groepen">+</button></span>'
      + '<span class="k">groepen</span><span>' + melding + '</span><button type="button" class="x" data-weg="' + t.id + '" aria-label="Thema weghalen">✕</button></div>';
  }
  function dialoogHtml(st) {
    var weekChips = st.weekLijst.map(function (w) { var aan = st.weken.indexOf(w) >= 0; return '<span class="chip' + (aan ? ' act' : '') + '" role="button" tabindex="0" data-wk="' + w + '" aria-pressed="' + aan + '">' + esc(weekLabel(st.periode, w)) + (aan ? ' ✕' : '') + '</span>'; }).join('');
    var dagk = DAGEN.map(function (d, i) { return '<button type="button" class="dagk' + (st.dagen[i] ? '' : ' uit') + '" data-dag="' + i + '" aria-pressed="' + !!st.dagen[i] + '">' + d + '</button>'; }).join('');
    var totaal = st.themas.reduce(function (n, t) { return n + t.groepen; }, 0);
    var themaHtml = st.themas.length ? st.themas.map(function (t) { return themaRij(t, st); }).join('') + '<div class="tr" style="grid-template-columns:1fr"><span class="k">Totaal ' + totaal + ' groep' + (totaal === 1 ? '' : 'en') + ' op deze locatie. Te veel of te weinig voor de locatie is een melding, geen verbod.</span></div>' : '<div class="leeg">Nog geen thema gekozen. Dat mag later.</div>';
    return '<div class="kn-box" role="dialog" aria-modal="true" aria-label="Nieuw kampmoment"><h2>Nieuw kampmoment</h2><div class="kn-sub">Alles is optioneel: vul nu in wat je weet, de rest kan later. Kinderen en kleuters tellen hoeft hier niet.</div>'
      + '<div class="kn-g2"><div><label class="lbl" for="kn-loc">Locatie</label><select id="kn-loc" class="veld"><option value="">— kies een locatie —</option>' + st.locs.map(function (l) { return '<option value="' + l.id + '"' + (st.locatie === l.id ? ' selected' : '') + '>' + esc(l.name) + '</option>'; }).join('') + '</select></div>'
      + '<div><span class="lbl">Weken <span class="opt">(meerdere mag: maakt één kampmoment per week)</span></span><div class="kn-weken">' + weekChips + '</div></div></div>'
      + '<div class="kn-r"><div><span class="lbl">Dagen</span><div class="kn-dagen">' + dagk + '</div></div><div style="flex:1"><label class="lbl" for="kn-kv">Kampverantwoordelijke <span class="opt">(optioneel)</span></label><select id="kn-kv" class="veld"><option value="">— nog niet gekend —</option>' + st.kvs.map(function (k) { return '<option value="' + k.id + '"' + (st.kv === k.id ? ' selected' : '') + '>' + esc(k.naam) + '</option>'; }).join('') + '</select></div></div>'
      + '<div class="blok kn-themas"><h4>Thema’s en groepen <button type="button" class="knop klein" data-act="thema">+ Thema kiezen</button></h4><div class="kn-tl">' + themaHtml + '</div></div>'
      + '<label class="kn-std"><input type="checkbox" id="kn-std"' + (st.std ? ' checked' : '') + '> Standaardmateriaal van deze locatie mee leveren bij opening en ophalen bij sluiting ' + (st.stdStuks == null ? '' : '<a class="pil" href="/standaardmateriaal?locatie=' + st.locatie + '" target="_blank" rel="noopener">' + st.stdStuks + ' stuks · bewerken</a>') + '</label>'
      + (st.fout ? '<div class="kn-fout" role="alert">' + esc(st.fout) + '</div>' : '')
      + '<div class="kn-knoppen"><button type="button" class="knop licht" data-act="annuleer">Annuleren</button><button type="button" class="knop licht" data-act="leeg">Leeg kampmoment maken</button><button type="button" class="knop" data-act="maak">' + esc(knopTekst(st)) + '</button></div></div>';
  }
  var CSS = '.kn-bg{position:fixed;inset:0;z-index:2900;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px}'
    + '.kn-box{background:#fff;border-radius:14px;padding:20px 24px;box-shadow:0 20px 50px rgba(0,0,0,.3);display:flex;flex-direction:column;min-height:0;width:min(1040px,100%);height:min(760px,calc(100vh - var(--tk-h,0px) - 32px));margin-top:var(--tk-h,0px);overflow-y:auto}'
    + '.kn-box h2{font-size:22px;font-weight:800}.kn-sub{font-size:13px;color:#64748b;margin:2px 0 14px}.kn-g2{display:grid;grid-template-columns:1fr 1fr;gap:16px}.kn-r{display:flex;gap:30px;margin:14px 0;flex-wrap:wrap}'
    + '.kn-box .lbl{font-size:12px;font-weight:700;color:#64748b;display:block;margin:0 0 4px}.kn-box .opt{color:#94a3b8;font-weight:500}.kn-box .veld{height:44px;border:1px solid #cbd5e1;border-radius:8px;padding:0 12px;font:inherit;font-size:14px;background:#fff;width:100%}'
    + '.kn-weken{display:flex;gap:6px;flex-wrap:wrap}.kn-box .chip{height:36px;padding:0 12px;border-radius:999px;background:#f1f5f9;font-size:13px;font-weight:600;display:inline-flex;align-items:center;cursor:pointer;white-space:nowrap}.kn-box .chip.act{background:#dbeafe;color:#1e3a8a}'
    + '.kn-dagen{display:flex;gap:5px}.kn-box .dagk{width:44px;height:44px;border-radius:8px;background:#1e3a8a;color:#fff;font-weight:700;font-size:13px;border:0;cursor:pointer}.kn-box .dagk.uit{background:#e2e8f0;color:#64748b}'
    + '.kn-themas{flex:1;min-height:120px;display:flex;flex-direction:column;background:#f8fafc;border-radius:10px;padding:12px}.kn-themas h4{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;display:flex;align-items:center}.kn-themas h4 .knop{margin-left:auto}.kn-tl{flex:1;overflow:auto}'
    + '.kn-box .tr{display:grid;align-items:center;gap:10px;min-height:44px;border-top:1px solid #eef2f7;font-size:13px}.kn-box .k{color:#64748b}.kn-box .leeg{padding:16px;color:#64748b;font-size:13px}'
    + '.kn-box .stapje{display:inline-flex;gap:4px;align-items:center}.kn-box .stapje button{width:36px;height:36px;border-radius:8px;background:#f1f5f9;color:#1e3a8a;font-weight:800;border:0;cursor:pointer}.kn-box .stapje b{min-width:22px;text-align:center}.kn-box .x{background:none;border:0;color:#94a3b8;font-size:16px;cursor:pointer;width:44px;height:44px}'
    + '.kn-box .pil{font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;background:#e2e8f0;color:#334155;white-space:nowrap;text-decoration:none}.kn-box .pil.groen{background:#dcfce7;color:#15803d}.kn-box .pil.oranje{background:#ffedd5;color:#c2410c}'
    + '.kn-std{display:flex;gap:8px;align-items:center;font-size:14px;margin:12px 0;flex-wrap:wrap}.kn-std input{width:20px;height:20px}.kn-fout{background:#fee2e2;color:#b91c1c;border-radius:8px;padding:8px 12px;font-size:13px;margin-bottom:8px}'
    + '.kn-knoppen{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}.kn-box .knop{height:44px;padding:0 16px;border-radius:8px;background:#2563eb;color:#fff;font-weight:700;font-size:13px;border:0;cursor:pointer}.kn-box .knop.licht{background:#f1f5f9;color:#1e3a8a}.kn-box .knop.klein{height:36px;padding:0 10px;font-size:12px}'
    + '@media (max-width:767px){.kn-box{padding:14px}.kn-g2{grid-template-columns:1fr}.kn-box .tr{grid-template-columns:1fr 110px 44px!important;row-gap:2px}.kn-box .tr>.k,.kn-box .tr>span:nth-child(5){grid-column:1/-1}.kn-knoppen .knop{flex:1}}';
  function open(opt) {
    return new Promise(function (resolve) {
      var doc = root.document, api = function (m, u, b) { return root.sportyApi(m, u, b, { toast: function () { }, token: root.localStorage.getItem('sporty-auth-token') || '' }); };
      var per = opt.periode, weekLijst = []; for (var w = 1; w <= (per && per.max_weken || 9); w++) weekLijst.push(w);
      var st = { periode: per, weekLijst: weekLijst, locs: opt.locs || [], kvs: opt.kvs || [], locatie: opt.locatie || 0, weken: opt.week ? [opt.week] : [], dagen: [true, true, true, true, true, false, false], kv: 0, themas: [], std: true, stdStuks: null, fout: '' };
      if (!doc.getElementById('kn-css')) { var s = doc.createElement('style'); s.id = 'kn-css'; s.textContent = CSS; doc.head.appendChild(s); }
      var bg = doc.createElement('div'); bg.className = 'kn-bg'; doc.body.appendChild(bg);
      var sluit = function (v) { doc.removeEventListener('keydown', toets, true); bg.remove(); resolve(v); };
      var toets = function (e) { if (e.key === 'Escape' && !doc.querySelector('.tkz-bg')) { e.preventDefault(); sluit(null); } };
      doc.addEventListener('keydown', toets, true);
      function teken() { var f = doc.activeElement && doc.activeElement.id; bg.innerHTML = dialoogHtml(st); if (f) { var e = bg.querySelector('#' + f); if (e) e.focus(); } }
      async function laadStd() { st.stdStuks = null; if (st.locatie) { var r = await api('GET', '/api/standaardmateriaal/' + st.locatie); if (r.ok) st.stdStuks = r.json.ingesteld ? r.json.stuks : r.json.algemeen_stuks; } teken(); }
      async function elders() { // melding per thema als het die week elders staat (nooit een verbod)
        for (var i = 0; i < st.themas.length; i++) st.themas[i].elders = [];
        if (st.weken.length !== 1 || !st.themas.length) return;
        var r = await api('GET', '/api/themakeuze?' + (per ? 'periode_id=' + per.id + '&' : '') + 'week=' + st.weken[0] + '&locatie_id=' + (st.locatie || ''));
        if (r.ok) st.themas.forEach(function (t) { var x = r.json.themas.filter(function (y) { return y.id === t.id; })[0]; t.elders = x ? x.elders : []; });
      }
      teken(); if (st.locatie) laadStd();
      bg.addEventListener('mousedown', function (e) { if (e.target === bg) sluit(null); });
      bg.addEventListener('change', async function (e) {
        if (e.target.id === 'kn-loc') { st.locatie = +e.target.value || 0; await laadStd(); }
        if (e.target.id === 'kn-kv') st.kv = +e.target.value || 0;
        if (e.target.id === 'kn-std') st.std = e.target.checked;
      });
      async function maak(leeg) {
        st.fout = '';
        if (!st.locatie) { st.fout = 'Kies eerst een locatie.'; return teken(); }
        if (!st.weken.length) { st.fout = 'Kies minstens één week.'; return teken(); }
        var body = { periode_id: per && per.id, locatie_id: st.locatie, weken: st.weken, dagen: st.dagen, kv_persoon_id: st.kv || null, standaard_materiaal: st.std,
          themas: leeg ? [] : st.themas.map(function (t) { return { thema_id: t.id, groepen: t.groepen }; }) };
        var r = await api('POST', '/api/kampmomenten/nieuw', body);
        if (!r.ok) { st.fout = (r.json && r.json.error) || 'Aanmaken mislukt.'; return teken(); }
        sluit(r.json);
      }
      bg.addEventListener('click', async function (e) {
        var el = e.target;
        var wk = el.closest('[data-wk]'); if (wk) { var n = +wk.getAttribute('data-wk'), i = st.weken.indexOf(n); if (i >= 0) st.weken.splice(i, 1); else st.weken.push(n); st.weken.sort(function (a, b) { return a - b; }); await elders(); return teken(); }
        var dg = el.closest('[data-dag]'); if (dg) { var d = +dg.getAttribute('data-dag'); st.dagen[d] = !st.dagen[d]; return teken(); }
        var gp = el.closest('[data-grp]'); if (gp) { var t = st.themas.filter(function (x) { return x.id === +gp.getAttribute('data-id'); })[0]; if (t) t.groepen = Math.max(1, Math.min(20, t.groepen + +gp.getAttribute('data-grp'))); return teken(); }
        var weg = el.closest('[data-weg]'); if (weg) { st.themas = st.themas.filter(function (x) { return x.id !== +weg.getAttribute('data-weg'); }); return teken(); }
        var act = el.closest('[data-act]'); if (!act) return;
        var a = act.getAttribute('data-act');
        if (a === 'annuleer') return sluit(null);
        if (a === 'leeg') return maak(true);
        if (a === 'maak') return maak(false);
        if (a === 'thema') {
          var gek = await root.ThemaKeuze.open({ periode_id: per && per.id, week: st.weken.length === 1 ? st.weken[0] : null, locatie_id: st.locatie || null, gekozen: st.themas.map(function (x) { return x.id; }),
            titel: 'Thema kiezen — ' + ((st.locs.filter(function (l) { return l.id === st.locatie; })[0] || {}).name || 'nieuw kampmoment') + (st.weken.length === 1 ? ' · week ' + st.weken[0] : '') });
          if (!gek) return;
          var oud = {}; st.themas.forEach(function (x) { oud[x.id] = x; });
          st.themas = gek.map(function (x) { return { id: x.id, naam: x.naam, leeftijdsgroep: x.leeftijdsgroep, categorie: x.categorie, groepen: oud[x.id] ? oud[x.id].groepen : 1, elders: x.elders || [] }; });
          await elders(); teken();
        }
      });
    });
  }
  var api = { open: open, dialoogHtml: dialoogHtml, themaRij: themaRij, weekLabel: weekLabel, knopTekst: knopTekst };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.KampNieuw = api;
})(typeof window !== 'undefined' ? window : globalThis);
