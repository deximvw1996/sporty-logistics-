// public/live.js — RT1: live-kanaal in elke pagina. Stuurt 'sporty-live' naar de laadfunctie van de pagina, nooit midden in iemands werk.
(function (root) {
  var doc = root.document, pad = root.location.pathname, tok = '';
  try { tok = root.localStorage.getItem('sporty-auth-token') || ''; } catch (e) { /* geen opslag */ }
  var m = /^\/(rit|kv|tel)\/([^/]+)/.exec(pad), url = '/api/live', hdr = {};
  if (m) url += '?' + (m[1] === 'rit' ? 'rit=' : 'kv=') + encodeURIComponent(m[2]); else if (tok) hdr['x-auth-token'] = tok; else return;
  var balk = null, wacht = false, bezigDruk = false, tm = null, geluid = true;
  // ── werk niet verliezen ──
  var isOverlay = function () { return !!doc.querySelector('[role=dialog],.mbg,.dim,.meld,.sheet,.schaduw,.modal,dialog[open]'); };
  var isVuil = function () {
    var a = doc.activeElement; if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !(a.closest && a.closest('#tk-balk'))) return true;
    return Array.prototype.some.call(doc.querySelectorAll('textarea,input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file])'), function (e) { return !(e.closest && e.closest('#tk-balk')) && e.value !== e.defaultValue; });
  };
  var bezig = function () { return bezigDruk || isOverlay() || isVuil(); };
  doc.addEventListener('pointerdown', function () { bezigDruk = true; }, true);
  doc.addEventListener('pointerup', function () { bezigDruk = false; }, true);
  function toonBalk(aan) {
    if (aan && !balk) { balk = doc.createElement('button'); balk.type = 'button'; balk.id = 'live-balk'; balk.textContent = 'Nieuwe gegevens · bijwerken'; balk.style.cssText = 'position:fixed;top:48px;left:50%;transform:translateX(-50%);z-index:2147482000;background:#1e3a8a;color:#fff;border:0;border-radius:999px;padding:8px 16px;min-height:44px;font-weight:700;cursor:pointer'; balk.onclick = function () { nu(); }; doc.body.appendChild(balk); }
    if (balk) balk.hidden = !aan;
  }
  function nu() {
    wacht = false; toonBalk(false);
    var y = root.scrollY, sc = []; Array.prototype.forEach.call(doc.querySelectorAll('[id]'), function (e) { if (e.scrollTop) sc.push([e.id, e.scrollTop]); });
    root.dispatchEvent(new Event('sporty-live'));
    [150, 500].forEach(function (t) { setTimeout(function () { root.scrollTo(0, y); sc.forEach(function (x) { var e = doc.getElementById(x[0]); if (e) e.scrollTop = x[1]; }); }, t); });
  }
  function sein() { clearTimeout(tm); tm = setTimeout(function () { if (bezig()) { wacht = true; toonBalk(true); } else nu(); }, 250); }
  setInterval(function () { if (wacht && !bezig()) nu(); }, 1000);
  // ── melding ──
  function toon(x) {
    if (x.niveau !== 'nu') return; // vandaag = alleen de teller; info = stil
    var c = doc.getElementById('live-toast'); if (!c) { c = doc.createElement('div'); c.id = 'live-toast'; c.style.cssText = 'position:fixed;top:52px;right:12px;left:auto;z-index:2147482500;display:flex;flex-direction:column;gap:8px;max-width:min(420px,calc(100vw - 24px))'; doc.body.appendChild(c); }
    var t = doc.createElement('a'); t.href = x.link || '/meldingen'; t.textContent = x.tekst; t.style.cssText = 'background:#dc2626;color:#fff;font-weight:700;padding:12px 14px;border-radius:10px;text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,.3)';
    c.appendChild(t); setTimeout(function () { t.remove(); }, 12000);
    if (geluid) piep();
    if (doc.hidden && root.Notification && Notification.permission === 'granted') { try { var n = new Notification('Sporty: nu oplossen', { body: x.tekst, tag: 'm' + x.id }); n.onclick = function () { root.focus(); root.location.href = x.link || '/meldingen'; }; } catch (e) { /* gsm: via de service worker */ } }
  }
  function piep() { try { var A = new (root.AudioContext || root.webkitAudioContext)(); [880, 660, 880].forEach(function (f, i) { var o = A.createOscillator(), g = A.createGain(); o.frequency.value = f; o.connect(g); g.connect(A.destination); g.gain.value = 0.15; o.start(A.currentTime + i * 0.18); o.stop(A.currentTime + i * 0.18 + 0.14); }); } catch (e) { /* geluid mag nog niet */ } }
  // ── kanaal met herverbinden; terugval: elke 30 s verversen zolang het kanaal dicht is ──
  var open = false;
  setInterval(function () { if (!open) sein(); }, 30000);
  function verbind() {
    root.fetch(url, { headers: hdr }).then(function (r) {
      if (!r.ok || !r.body) throw new Error('dicht');
      open = true; var rd = r.body.getReader(), dec = new TextDecoder(), buf = '';
      var lees = function () { return rd.read().then(function (d) {
        if (d.done) throw new Error('einde');
        buf += dec.decode(d.value, { stream: true }); var i;
        while ((i = buf.indexOf('\n\n')) >= 0) { var blok = buf.slice(0, i); buf = buf.slice(i + 2); var l = /^data: (.*)$/m.exec(blok); if (!l) continue; var x = JSON.parse(l[1]); if (x.t === 'hallo') continue; if (x.t === 'melding') toon(x); sein(); }
        return lees();
      }); };
      return lees();
    }).catch(function () { open = false; setTimeout(verbind, 3000); });
  }
  verbind();
  // ── Instellingen in Meer en Meldingen ──
  function api(me, p, b) { return root.fetch(p, { method: me, headers: { 'Content-Type': 'application/json', 'x-auth-token': tok }, body: b ? JSON.stringify(b) : undefined }).then(function (r) { return r.json(); }); }
  var b64 = function (s) { s = (s + '='.repeat((4 - s.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/'); return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); };
  function pushZet(v, sleutel) {
    if (!('serviceWorker' in navigator) || !root.PushManager) return Promise.resolve();
    return navigator.serviceWorker.register('/sw.js').then(function (reg) { return reg.pushManager.getSubscription().then(function (s) {
      if (v === 'uit') return s ? api('POST', '/api/push/uitschrijven', { endpoint: s.endpoint }).then(function () { return s.unsubscribe(); }) : null;
      return Notification.requestPermission().then(function (p) { if (p !== 'granted' || !sleutel) return; return (s ? Promise.resolve(s) : reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(sleutel) })).then(function (n) { return api('POST', '/api/push/inschrijven', n.toJSON()); }); });
    }); });
  }
  function instellingen(v) {
    if (pad !== '/meer' && pad !== '/meldingen') return;
    var d = doc.createElement('div'); d.id = 'live-instellingen'; d.style.cssText = 'max-width:640px;margin:12px auto 90px;padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;font-size:14px';
    var ios = /iPhone|iPad/.test(navigator.userAgent), los = root.navigator.standalone || root.matchMedia('(display-mode: standalone)').matches;
    d.innerHTML = '<b>Meldingen op dit toestel</b><div style="display:flex;flex-wrap:wrap;gap:8px;margin:8px 0;align-items:center"><button type="button" id="li-aan" style="min-height:44px;padding:0 12px">Meldingen aanzetten</button><label style="min-height:44px;display:flex;align-items:center;gap:6px"><input type="checkbox" id="li-gel"' + (v.geluid ? ' checked' : '') + '> Geluid</label><label style="display:flex;align-items:center;gap:6px">Push <select id="li-push" style="min-height:44px"' + (v.push_kan ? '' : ' disabled') + '><option value="alles">alles</option><option value="nu">alleen Nu oplossen</option><option value="uit">uit</option></select></label></div>' + (v.push_kan ? '' : '<div style="color:#64748b;font-size:12px">Push staat op deze server nog niet aan.</div>') + (ios && !los ? '<div style="color:#334155;font-size:13px">iPhone: open deze site in Safari, tik op Delen en kies "Zet op beginscherm". Open Sporty daarna via dat icoon en zet hier de meldingen aan. Zonder dat geeft een iPhone geen push.</div>' : '');
    var doel = doc.getElementById('toasts'); if (doel && doel.parentNode) doel.parentNode.insertBefore(d, doel); else doc.body.appendChild(d);
    doc.getElementById('li-push').value = v.push;
    doc.getElementById('li-aan').onclick = function () { if (root.Notification) Notification.requestPermission().then(function () { if (v.push_kan && v.push !== 'uit') pushZet(v.push, v.sleutel); }); };
    doc.getElementById('li-gel').onchange = function (e) { geluid = e.target.checked; api('PUT', '/api/meldingen/voorkeur', { geluid: geluid }); };
    doc.getElementById('li-push').onchange = function (e) { v.push = e.target.value; api('PUT', '/api/meldingen/voorkeur', { push: v.push }); pushZet(v.push, v.sleutel); };
  }
  if (!m && tok) doc.addEventListener('DOMContentLoaded', go); if (!m && tok && doc.readyState !== 'loading') go();
  var gedaan = false;
  function go() { if (gedaan) return; gedaan = true; api('GET', '/api/meldingen/voorkeur').then(function (v) { if (v && v.push) { geluid = !!v.geluid; instellingen(v); } }).catch(function () {}); }
})(window);
