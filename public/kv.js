// KV-pagina (KV1) — exacte kopie van design/KV-DEFINITIEF.html op de data van GET /api/kv/:token/data.
// Tabs Overzicht · Tellen · Aanvragen · Info + telscherm per bak ("✓ <hoort>" / "anders"). Monitor-stand (/tel/:token): enkel Tellen.
// Pure HTML-bouwers + createApp(deps) zijn exporteerbaar (module.exports) zodat ze zonder browser te testen zijn.
(function (root) {
  'use strict';
  function kvL(n){return /^KV\s/i.test(n)?n:'KV '+n;}
  var DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
  var MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function isoDatum(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function dagLang(iso) { var d = isoDatum(iso); return d ? DAGEN[d.getDay()] + ' ' + d.getDate() + ' ' + MAANDEN[d.getMonth()] : esc(iso || ''); }
  function bereik(dagen) {
    var a = dagen && isoDatum(dagen.van), b = dagen && isoDatum(dagen.tot);
    if (!a || !b) return '';
    var mA = a.getMonth() === b.getMonth() ? '' : ' ' + MAANDEN[a.getMonth()];
    return DAGEN[a.getDay()].slice(0, 2) + ' ' + a.getDate() + mA + ' – ' + DAGEN[b.getDay()].slice(0, 2) + ' ' + b.getDate() + ' ' + MAANDEN[b.getMonth()];
  }
  var PIL = { ok: ['groen', '✓ ok'], tekort: ['rood', 'tekort'], te_veel: ['blauw', 'te veel'], kapot: ['oranje', 'kapot'] };
  var KLEUR = { ok: 'groen', tekort: 'rood', te_veel: 'blauw', kapot: 'oranje', nog_niet: '' };

  // Een "rij" in de lijst Tellen: een bak of een attribuut, met een gelijke vorm.
  function rijen(data) {
    var r = (data.bakken || []).map(function (b) {
      return { type: 'bak', id: b.id, code: b.code, naam: b.naam, status: b.status, klaar: b.aantal > 0 && b.geteld === b.aantal, ref: b };
    });
    return r.concat((data.attributen || []).map(function (a) {
      return { type: 'attr', id: a.id, code: a.code, naam: a.naam, status: a.uitslag === 'nog_niet' ? 'nog_niet' : a.uitslag, klaar: a.uitslag !== 'nog_niet', ref: a };
    }));
  }
  function telStand(data) { var r = rijen(data); return { klaar: r.filter(function (x) { return x.klaar; }).length, totaal: r.length, rijen: r }; }

  // ── Kop + tabbalk ──
  function kopOverzicht(data, titel, sub) {
    return '<div class="kopB"><b>' + esc(titel) + '</b><span>' + esc(sub) + '</span></div>';
  }
  function tabsHtml(data, actief, monitor) {
    var ts = telStand(data);
    var items = monitor ? [['tellen', '🧮', 'Tellen ' + ts.klaar + '/' + ts.totaal]]
      : [['overzicht', '🏠', 'Overzicht'], ['tellen', '🧮', 'Tellen ' + ts.klaar + '/' + ts.totaal], ['aanvragen', '📩', 'Aanvragen' + ((data.aanvragen || []).length ? ' ' + data.aanvragen.length : '')], ['info', 'ℹ️', 'Info']];
    return '<div class="tabs">' + items.map(function (t) { return '<button type="button" class="' + (actief === t[0] ? 'act' : '') + '" data-act="tab" data-a="' + t[0] + '">' + t[1] + '<span>' + esc(t[2]) + '</span></button>'; }).join('') + '</div>';
  }

  // ── Overzicht ──
  function afwijkingTekst(b) {
    var d = [];
    var t = b.items.filter(function (i) { return i.status === 'tekort'; })[0];
    if (t) d.push('tekort ' + String(t.naam).toLowerCase());
    var v = b.items.filter(function (i) { return i.aangetroffen != null && i.aangetroffen > i.gewenst; })[0];
    if (v) d.push('te veel ' + String(v.naam).toLowerCase());
    var k = b.items.filter(function (i) { return i.kapot_aantal > 0; });
    if (k.length) d.push(k.reduce(function (a, i) { return a + i.kapot_aantal; }, 0) + ' ' + String(k[0].naam).toLowerCase() + ' kapot');
    return d.join(', ');
  }
  function leveringKaart(titel, t) {
    if (!t) return '<div class="kaartB"><div class="t">' + titel + '</div><div class="s">nog niet gepland</div></div>';
    var klaar = t.status === 'gedaan';
    var wat = klaar ? (titel === 'Levering' ? '✓ geleverd' : '✓ opgehaald') : t.status === 'aangekomen' ? 'onderweg' : 'gepland';
    var s = [dagLang(t.datum), t.tijd, t.chauffeur, titel === 'Levering' && t.stuks ? t.stuks + ' stuks' : '', t.deel].filter(Boolean).map(esc).join(' · ');
    return '<div class="kaartB' + (klaar ? ' groen' : '') + '"><div class="t">' + titel + ' ' + wat + '</div><div class="s">' + s + '</div></div>';
  }
  function overzichtHtml(data) {
    var ts = telStand(data);
    var afw = (data.bakken || []).filter(function (b) { return afwijkingTekst(b); }).slice(0, 2).map(function (b) { return (b.code || b.naam) + ': ' + afwijkingTekst(b); });
    var nog = ts.totaal - ts.klaar;
    var tellenS = afw.concat(nog ? [nog + (nog === 1 ? ' bak' : ' bakken') + ' nog te tellen'] : []).join(' · ') || 'Alles geteld';
    var av = data.aanvragen || [], nieuw = av.filter(function (a) { return a.status === 'nieuw'; }).length;
    var avS = av.slice(0, 2).map(function (a) { return esc(a.tekst) + (a.foto_url ? ' (foto)' : '') + (a.antwoord ? ' — ' + esc(a.antwoord) : ''); }).join(' · ') || 'Nog geen aanvragen';
    var mc = data.meldingen_chauffeur || [], bs = data.boodschappen || [];
    var kaarten = leveringKaart('Levering', data.levering) + leveringKaart('Ophaling', data.ophaling)
      + '<button type="button" class="kaartB blauw" data-act="tab" data-a="tellen"><div class="t">Tellen · ' + ts.klaar + '/' + ts.totaal + ' bakken</div><div class="s">' + esc(tellenS) + '</div><div class="pijl">›</div></button>'
      + '<button type="button" class="kaartB' + (nieuw ? ' oranje' : '') + '" data-act="tab" data-a="aanvragen"><div class="t">Aanvragen' + (nieuw ? ' · ' + nieuw + ' wacht op kantoor' : '') + '</div><div class="s">' + avS + '</div><div class="pijl">›</div></button>'
      + (mc.length ? '<button type="button" class="kaartB" data-act="tab" data-a="aanvragen"><div class="t">Melding chauffeur</div><div class="s">' + esc(mc[0].tekst) + (mc[0].status === 'afgehandeld' ? ' · afgehandeld' : '') + '</div><div class="pijl">›</div></button>' : '')
      + (bs.length ? '<button type="button" class="kaartB" data-act="tab" data-a="info"><div class="t">Boodschappen · ' + bs.length + '</div><div class="s">' + bs.slice(0, 3).map(function (b) { return esc(b.naam) + (b.qty > 1 ? ' ' + b.qty : ''); }).join(' · ') + '</div><div class="pijl">›</div></button>' : '');
    var sub = [bereik(data.dagen), data.kvNaam ? kvL(data.kvNaam) : ''].filter(Boolean).join(' · ');
    return kopOverzicht(data, (data.kampLocatie || data.kampNaam) + ' · week ' + data.week, sub) + '<div class="body">' + kaarten + '</div>' + tabsHtml(data, 'overzicht', false);
  }

  // ── Tellen ──
  function tellenHtml(data, monitor) {
    var ts = telStand(data);
    var lijst = ts.rijen.map(function (r) {
      var kl = KLEUR[r.status] || '';
      var sub;
      if (r.type === 'bak') {
        var b = r.ref, eerste = b.items.filter(function (i) { return i.status === 'tekort'; })[0];
        sub = b.aantal + ' soorten' + (eerste ? ' · ⚠ ' + esc(eerste.naam) + ' ' + eerste.aangetroffen + ' van ' + eerste.gewenst : (b.geteld > 0 && !r.klaar ? ' · ' + b.geteld + ' geteld' : ''));
      } else sub = 'attribuut';
      var rechts = r.status !== 'nog_niet' && PIL[r.status] ? '<span class="pil ' + PIL[r.status][0] + '">' + PIL[r.status][1] + '</span>' : '<span class="knop klein">Tellen</span>';
      return '<div class="bak ' + kl + '" role="button" tabindex="0" data-act="' + (r.type === 'bak' ? 'bak' : 'attr') + '" data-a="' + r.id + '"><div class="code">' + esc(r.code || '—') + '</div><div class="nm">' + esc(r.naam) + '<b>' + sub + '</b></div>' + rechts + '</div>';
    }).join('') || '<div class="leeg">Nog geen bakken gekoppeld aan dit kampmoment.</div>';
    var versturen = monitor ? '' : '<button type="button" class="knop breed" data-act="versturen">Telling versturen (' + ts.klaar + '/' + ts.totaal + ')</button><div class="hint" style="margin-top:8px">Versturen kan ook als nog niet alles geteld is; kantoor ziet wat ontbreekt.</div>';
    return kopOverzicht(data, 'Tellen · ' + ts.klaar + '/' + ts.totaal + ' bakken', 'maandag nakijken · tik een bak om te tellen')
      + '<div class="body">' + lijst + versturen + '</div>' + tabsHtml(data, 'tellen', monitor);
  }

  // ── Telscherm ──
  function itemHtml(b, it, st) {
    var kl = KLEUR[it.status] || '', open = st.open === it.id, afw = it.status === 'tekort' || it.status === 'kapot' || it.status === 'te_veel';
    var tweede = afw ? '<button type="button" class="act af" data-act="anders" data-a="' + it.id + '">' + (it.status === 'te_veel' ? 'te veel' : it.status) + '</button>'
      : '<button type="button" data-act="anders" data-a="' + it.id + '">anders</button>';
    var eerste = '<button type="button" class="' + (it.status === 'ok' ? 'act' : '') + '" data-act="klopt" data-a="' + b.id + '" data-b="' + it.id + '">✓ ' + it.gewenst + '</button>';
    var ex = '';
    if (it.kapot_aantal > 0 || it.foto_url || it.notitie) {
      ex = '<div class="ex">' + (it.kapot_aantal > 0 ? '<span class="pil oranje">💥 ' + it.kapot_aantal + ' kapot</span>' : '')
        + (it.foto_url ? '<span class="thumb"><img src="' + esc(it.foto_url) + '" alt="" loading="lazy"></span>' : '')
        + (it.notitie ? '<span class="not">📝 ' + esc(it.notitie) + '</span>' : '') + '</div>';
    }
    var uitklap = '';
    if (open) {
      var d = st.draft, verschil = d.geteld - it.gewenst;
      uitklap = '<div class="uitklap"><div class="veld"><label>Geteld</label><div class="stp"><button type="button" data-act="stp" data-a="geteld" data-b="-1" aria-label="Minder">−</button><span>' + d.geteld + '</span><button type="button" data-act="stp" data-a="geteld" data-b="1" aria-label="Meer">+</button></div><i>' + (verschil < 0 ? 'tekort: ' + (-verschil) : verschil > 0 ? 'te veel: ' + verschil : 'klopt') + '</i></div>'
        + '<div class="veld"><label>Kapot</label><div class="stp"><button type="button" data-act="stp" data-a="kapot" data-b="-1" aria-label="Minder">−</button><span>' + d.kapot + '</span><button type="button" data-act="stp" data-a="kapot" data-b="1" aria-label="Meer">+</button></div>'
        + '<button type="button" class="knop licht klein" data-act="itemfoto" aria-label="Foto toevoegen">📷</button>'
        + (d.foto ? '<span class="thumb"><img src="' + esc(d.foto) + '" alt=""></span>' : it.foto_url ? '<span class="thumb"><img src="' + esc(it.foto_url) + '" alt=""></span>' : '') + '</div>'
        + '<div class="veld"><label>Notitie</label><input type="text" value="' + esc(d.notitie) + '" placeholder="optioneel" data-f="notitie" maxlength="500"></div>'
        + '<button type="button" class="knop klein breed" data-act="opslaan"' + (st.bezig ? ' disabled' : '') + '>Opslaan</button></div>';
    }
    return '<div class="it ' + kl + (open ? ' open' : '') + '"><div class="r1"><div class="nm">' + esc(it.naam) + ' <b>× ' + it.gewenst + '</b></div><div class="ja">' + eerste + tweede + '</div></div>' + ex + uitklap + '</div>';
  }
  function bakHtml(data, bakId, st) {
    var b = (data.bakken || []).filter(function (x) { return x.id === bakId; })[0];
    if (!b) return tellenHtml(data, st.monitor);
    var tek = b.items.filter(function (i) { return i.status === 'tekort'; }).length;
    var tv = b.items.filter(function (i) { return i.aangetroffen != null && i.aangetroffen > i.gewenst; }).length;
    var kp = b.items.filter(function (i) { return i.kapot_aantal > 0; }).length;
    var sub = [b.geteld + ' van ' + b.aantal + ' geteld', tek ? tek + ' tekort' : '', tv ? tv + ' te veel' : '', kp ? kp + ' kapot' : ''].filter(Boolean).join(' · ');
    return '<div class="kop2"><button type="button" class="terug" data-act="tab" data-a="tellen">‹ Tellen</button><div><b>' + esc(b.code || '') + (b.code ? ' · ' : '') + esc(b.naam) + '</b><span class="s">' + esc(sub) + '</span></div></div>'
      + '<div class="body"><div class="hint">Per stuk: tik <b>✓</b> als het aantal klopt. Anders het echte aantal (ook méér mag). 💥 kapot met foto, 📝 notitie.</div>'
      + (b.items.map(function (it) { return itemHtml(b, it, st); }).join('') || '<div class="leeg">Deze bak heeft nog geen items.</div>') + '</div>'
      + '<div class="voet"><button type="button" class="knop licht" data-act="rest-klopt">Rest klopt ✓</button><button type="button" class="knop" data-act="bak-klaar">Bak klaar</button></div>';
  }
  function attrHtml(data, attrId) {
    var a = (data.attributen || []).filter(function (x) { return x.id === attrId; })[0];
    if (!a) return tellenHtml(data, false);
    var kl = a.uitslag === 'ok' ? 'groen' : a.uitslag === 'kapot' ? 'oranje' : '';
    return '<div class="kop2"><button type="button" class="terug" data-act="tab" data-a="tellen">‹ Tellen</button><div><b>' + esc(a.code || '') + (a.code ? ' · ' : '') + esc(a.naam) + '</b><span class="s">attribuut</span></div></div>'
      + '<div class="body"><div class="hint">Staat het er en is het heel? Tik <b>✓</b>. Anders: beschadigd.</div>'
      + '<div class="it ' + kl + '"><div class="r1"><div class="nm">' + esc(a.naam) + ' <b>× 1</b></div><div class="ja"><button type="button" class="' + (a.uitslag === 'ok' ? 'act' : '') + '" data-act="attr-zet" data-a="' + a.id + '" data-b="aanwezig">✓ 1</button>'
      + '<button type="button" class="' + (a.uitslag === 'kapot' ? 'act af' : '') + '" data-act="attr-zet" data-a="' + a.id + '" data-b="beschadigd">' + (a.uitslag === 'kapot' ? 'kapot' : 'anders') + '</button></div></div></div></div>'
      + '<div class="voet"><button type="button" class="knop" data-act="bak-klaar">Bak klaar</button></div>';
  }

  // ── Aanvragen ──
  var AV_PIL = { nieuw: ['oranje', 'nieuw'], goedgekeurd: ['groen', 'goedgekeurd'], afgewezen: ['rood', 'afgewezen'], afgehandeld: ['', 'afgehandeld'] };
  function aanvragenHtml(data) {
    var av = (data.aanvragen || []).map(function (a) {
      var p = AV_PIL[a.status] || AV_PIL.nieuw;
      return '<div class="rij"><div class="nm">' + esc(a.tekst) + (a.foto_url ? ' (foto)' : '') + '<b>' + esc(a.created_at || '') + ' · ' + esc(a.antwoord || (a.status === 'nieuw' ? 'wacht op kantoor' : p[1])) + '</b></div><span class="pil ' + p[0] + '">' + p[1] + '</span></div>';
    }).join('') || '<div class="leeg">Nog geen aanvragen.</div>';
    var mc = (data.meldingen_chauffeur || []).map(function (m) {
      return '<div class="rij"><div class="nm">' + esc(m.tekst) + '<b>' + esc(m.created_at || '') + ' · ' + (m.status === 'afgehandeld' ? 'afgehandeld door kantoor' : m.status === 'nieuw' ? 'wacht op kantoor' : esc(m.status || '')) + '</b></div></div>';
    }).join('');
    var mk = (data.meldingen_kantoor || []).map(function (m) {
      return '<div class="rij"><div class="nm">' + esc(m.tekst) + '<b>' + esc(m.created_at || '') + ' · ' + (m.soort === 'herinnering_kv' ? 'herinnering van kantoor' : 'notitie van kantoor') + '</b></div></div>';
    }).join('');
    return kopOverzicht(data, 'Aanvragen', 'materiaal vragen of kapot melden · kantoor antwoordt hier')
      + '<div class="body"><div class="twee"><button type="button" class="knop" data-act="sheet-open" data-a="materiaal">📩 Materiaal vragen</button><button type="button" class="knop licht" data-act="sheet-open" data-a="kapot">💥 Kapot melden</button></div>'
      + '<div class="sec" style="margin-top:12px"><h3>Mijn aanvragen</h3>' + av + '</div>'
      + (mk ? '<div class="sec"><h3>Berichten van kantoor</h3>' + mk + '</div>' : '')
      + (mc ? '<div class="sec"><h3>Meldingen chauffeur</h3>' + mc + '</div>' : '') + '</div>' + tabsHtml(data, 'aanvragen', false);
  }
  function sheetHtml(data, sh) {
    var kapot = sh.soort === 'kapot';
    var stukken = [];
    (data.bakken || []).forEach(function (b) { b.items.forEach(function (i) { stukken.push((b.code ? b.code + ' · ' : '') + i.naam); }); });
    return '<div class="dim" data-act="sluit-bg"><div class="sheet" role="dialog" aria-modal="true"><h3>' + (kapot ? 'Kapot melden' : 'Materiaal vragen') + '</h3>'
      + '<p>' + (kapot ? 'Kies het stuk uit een bak of typ het zelf. Kantoor ziet het meteen.' : 'Wat heb je nodig? Kantoor ziet je aanvraag meteen.') + '</p>'
      + (kapot && stukken.length ? '<select data-f="stuk" aria-label="Stuk uit een bak"><option value="">— zelf typen —</option>' + stukken.map(function (s) { return '<option value="' + esc(s) + '"' + (sh.stuk === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select>' : '')
      + '<textarea placeholder="' + (kapot ? 'Wat is er kapot?' : 'Wat heb je nodig?') + '" data-f="tekst">' + esc(sh.tekst) + '</textarea>'
      + '<label class="lbl" for="sh-aantal">Aantal (optioneel)</label><input class="getal" id="sh-aantal" type="number" inputmode="numeric" min="1" value="' + esc(sh.aantal) + '" data-f="aantal">'
      + '<button type="button" class="foto' + (sh.foto ? ' ok' : '') + '" data-act="sheet-foto">' + (sh.foto ? '✓ Foto toegevoegd · tik om te wijzigen' : '📷 Foto toevoegen (optioneel)') + '</button>'
      + '<div class="knoppen"><button type="button" data-act="sheet-sluit">Annuleren</button><button type="button" class="prim" data-act="sheet-ok"' + (sh.bezig ? ' disabled' : '') + '>Versturen</button></div></div></div>';
  }

  // ── Info ──
  function infoHtml(data, hostUrl) {
    var bs = data.boodschappen || [];
    var url = (hostUrl || '') + (data.monitor_url || '');
    var kantoor = data.kantoor && data.kantoor.telefoon;
    var l = data.locatie || {};
    return kopOverzicht(data, 'Info', (data.kampLocatie || '') + ' · week ' + data.week)
      + '<div class="body">'
      + (bs.length ? '<div class="sec"><h3>Boodschappen (zelf kopen)</h3>' + bs.map(function (b) { return '<div class="rij"><div class="nm">' + esc(b.naam) + (b.qty > 1 ? ' ' + b.qty : '') + '</div></div>'; }).join('') + '</div>' : '')
      + (data.monitor_url ? '<div class="sec"><h3>Monitor-link</h3><div class="rij"><div class="nm">Alleen het telscherm, zonder aanvragen<b>' + esc(url) + '</b></div><button type="button" class="knop licht klein" data-act="kopieer">Kopieer</button></div></div>' : '')
      + (kantoor ? '<div class="sec"><h3>Kantoor</h3><div class="rij"><div class="nm">Sporty logistiek<b>📞 ' + esc(kantoor) + '</b></div><a class="knop licht klein" href="tel:' + esc(String(kantoor).replace(/[^\d+]/g, '')) + '">Bel</a></div></div>' : '')
      + '<div class="sec"><h3>Locatie</h3><div class="rij"><div class="nm">' + esc(l.naam || data.kampLocatie || '') + '<b>' + [l.adres, l.sleutel_info].filter(Boolean).map(esc).join(' · ') + '</b></div></div></div>'
      + '</div>' + tabsHtml(data, 'info', false);
  }

  function schermHtml(data, st, hostUrl) {
    var mon = !!st.monitor, basis;
    if (mon) basis = st.scherm === 'bak' ? bakHtml(data, st.bakId, st) : st.scherm === 'attr' ? attrHtml(data, st.attrId) : tellenHtml(data, true);
    else if (st.scherm === 'bak') basis = bakHtml(data, st.bakId, st);
    else if (st.scherm === 'attr') basis = attrHtml(data, st.attrId);
    else if (st.scherm === 'tellen') basis = tellenHtml(data, false);
    else if (st.scherm === 'aanvragen') basis = aanvragenHtml(data);
    else if (st.scherm === 'info') basis = infoHtml(data, hostUrl);
    else basis = overzichtHtml(data);
    return basis + (st.sheet && !mon ? sheetHtml(data, st.sheet) : '');
  }

  // ── Logica ──
  // deps: { token, monitor, fetch, toast(tekst,goed), mount(html), kiesFoto(), kopieer(tekst), host, bewaar, geladen }
  function createApp(deps) {
    var st = { scherm: deps.monitor ? 'tellen' : 'overzicht', bakId: null, attrId: null, open: null, draft: null, sheet: null, monitor: !!deps.monitor, bezig: false };
    var data = null, offlineGemeld = false;
    var base = '/api/kv/' + encodeURIComponent(deps.token);
    function teken() { if (data) deps.mount(schermHtml(data, st, deps.host || '')); }
    async function aanroep(methode, pad, body) {
      var r;
      try { r = await deps.fetch(base + pad, { method: methode, headers: body !== undefined ? { 'Content-Type': 'application/json' } : {}, body: body !== undefined ? JSON.stringify(body) : undefined }); }
      catch (e) { deps.toast('Geen verbinding — probeer het zo opnieuw.', false); return null; }
      var j = null; try { j = await r.json(); } catch (e) { /* leeg */ }
      if (!r.ok) { deps.toast((j && j.error) || 'Dat lukte niet (' + r.status + ').', false); return null; }
      return j || {};
    }
    async function laad() {
      try {
        var r = await deps.fetch(base + '/data'), j = await r.json();
        if (!r.ok) { deps.toast(j.error || 'Laden mislukt.', false); return false; }
        data = j; offlineGemeld = false;
        if (deps.bewaar) deps.bewaar(j);
        teken(); return true;
      } catch (e) {
        if (!data && deps.geladen) data = deps.geladen();
        if (!offlineGemeld) { deps.toast('Geen verbinding — laatste stand getoond.', false); offlineGemeld = true; }
        teken(); return false;
      }
    }
    function ga(scherm, id) {
      st.scherm = scherm; st.open = null; st.draft = null; st.sheet = null;
      if (scherm === 'bak') st.bakId = id; if (scherm === 'attr') st.attrId = id;
      if (deps.onNav) deps.onNav(scherm, id);
      teken();
    }
    var vindBak = function (id) { return (data.bakken || []).filter(function (b) { return b.id === id; })[0]; };
    async function stuur(bak, regels) {
      var j = await aanroep('POST', '/bakken/' + bak.id + '/tellen', { regels: regels });
      if (j) await laad();
      return j;
    }
    async function klik(act, a, b) {
      var id = a === '' || a == null || isNaN(+a) ? a : +a;
      switch (act) {
        case 'tab': return ga(a);
        case 'bak': return ga('bak', id);
        case 'attr': return ga('attr', id);
        case 'klopt': {
          var bk = vindBak(id), it = bk && bk.items.filter(function (i) { return i.id === +b; })[0];
          if (!it) return;
          st.open = null; st.draft = null;
          await stuur(bk, [{ item_id: it.id, aangetroffen: it.gewenst }]); return;
        }
        case 'anders': {
          var bk2 = vindBak(st.bakId), it2 = bk2 && bk2.items.filter(function (i) { return i.id === id; })[0];
          if (!it2) return;
          if (st.open === id) { st.open = null; st.draft = null; return teken(); }
          st.open = id;
          st.draft = { geteld: it2.aangetroffen != null ? it2.aangetroffen : it2.gewenst, kapot: it2.kapot_aantal || 0, notitie: it2.notitie || '', foto: '' };
          return teken();
        }
        case 'stp': {
          if (!st.draft) return;
          st.draft[a] = Math.max(0, st.draft[a] + (+b)); return teken();
        }
        case 'itemfoto': {
          if (!deps.kiesFoto || !st.draft) return;
          try { var f = await deps.kiesFoto(); if (f) { st.draft.foto = f; teken(); } } catch (e) { deps.toast('Foto kiezen mislukt.', false); }
          return;
        }
        case 'opslaan': {
          var bk3 = vindBak(st.bakId); if (!bk3 || st.open == null || !st.draft) return;
          var rij = { item_id: st.open, aangetroffen: st.draft.geteld, kapot_aantal: st.draft.kapot, notitie: st.draft.notitie };
          if (st.draft.foto) rij.foto_data = st.draft.foto;
          st.bezig = true; teken();
          var ok = await stuur(bk3, [rij]);
          st.bezig = false;
          if (ok) { st.open = null; st.draft = null; deps.toast('✓ Opgeslagen', true); }
          teken(); return;
        }
        case 'rest-klopt': {
          var bk4 = vindBak(st.bakId); if (!bk4) return;
          var rest = bk4.items.filter(function (i) { return i.aangetroffen == null; });
          if (!rest.length) { deps.toast('Alles in deze bak is al geteld.', true); return; }
          var jr = await stuur(bk4, rest.map(function (i) { return { item_id: i.id, aangetroffen: i.gewenst }; }));
          if (jr) deps.toast('✓ Rest klopt: ' + rest.length + (rest.length === 1 ? ' stuk' : ' stuks') + ' ingevuld', true);
          return;
        }
        case 'bak-klaar': return ga('tellen');
        case 'attr-zet': {
          var ja = await aanroep('POST', '/attributen/' + id + '/status', { status: b });
          if (ja) await laad();
          return;
        }
        case 'versturen': {
          var jv = await aanroep('POST', '/versturen', {});
          if (jv) { deps.toast('✓ Telling verstuurd naar kantoor', true); await laad(); }
          return;
        }
        case 'sheet-open': st.sheet = { soort: a, tekst: '', aantal: '', foto: '', stuk: '', bezig: false }; return teken();
        case 'sheet-sluit': case 'sluit-bg': st.sheet = null; return teken();
        case 'sheet-foto': {
          if (!deps.kiesFoto || !st.sheet) return;
          try { var f2 = await deps.kiesFoto(); if (f2) { st.sheet.foto = f2; teken(); } } catch (e) { deps.toast('Foto kiezen mislukt.', false); }
          return;
        }
        case 'sheet-ok': {
          var sh = st.sheet; if (!sh) return;
          var tekst = (sh.tekst || '').trim() || (sh.stuk || '');
          if (!tekst) { deps.toast(sh.soort === 'kapot' ? 'Vul in wat er kapot is.' : 'Vul in wat je nodig hebt.', false); return; }
          if (sh.soort === 'kapot' && sh.stuk && (sh.tekst || '').trim()) tekst = sh.stuk + ' — ' + sh.tekst.trim();
          var body = { tekst: tekst, foto_data: sh.foto || '' };
          var n = parseInt(sh.aantal, 10); if (n > 0) body.aantal = n;
          sh.bezig = true; teken();
          var js = await aanroep('POST', sh.soort === 'kapot' ? '/kapot' : '/aanvraag', body);
          st.sheet = null;
          if (js) { deps.toast('✓ Verstuurd naar kantoor', true); await laad(); } else teken();
          return;
        }
        case 'kopieer': {
          var url = (deps.host || '') + (data.monitor_url || '');
          try { await deps.kopieer(url); deps.toast('✓ Link gekopieerd', true); } catch (e) { deps.toast('Kopiëren lukte niet — houd de link ingedrukt.', false); }
          return;
        }
        default: return;
      }
    }
    function zet(veld, waarde) {
      if (st.sheet && ['tekst', 'aantal', 'stuk'].indexOf(veld) >= 0) { st.sheet[veld] = waarde; if (veld === 'stuk') teken(); }
      else if (st.draft && veld === 'notitie') st.draft.notitie = waarde;
    }
    return { laad: laad, klik: klik, zet: zet, ga: ga, staat: function () { return st; }, data: function () { return data; } };
  }

  var api = { esc: esc, dagLang: dagLang, bereik: bereik, telStand: telStand, overzichtHtml: overzichtHtml, tellenHtml: tellenHtml, bakHtml: bakHtml, attrHtml: attrHtml, aanvragenHtml: aanvragenHtml, infoHtml: infoHtml, sheetHtml: sheetHtml, schermHtml: schermHtml, createApp: createApp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.KvPagina = api;

  // ── Browser-opstart ──
  if (typeof document !== 'undefined' && root.__KV_TOKEN) {
    var token = root.__KV_TOKEN, monitor = !!root.__KV_MONITOR, opslag = 'kv-' + token;
    var app = createApp({
      token: token, monitor: monitor, host: root.location.origin,
      fetch: function (u, o) { return root.fetch(u, o); },
      toast: function (tekst, goed) {
        var t = document.getElementById('toast');
        t.textContent = tekst; t.className = 'toast ' + (goed ? '' : 'fout ') + 'zicht';
        clearTimeout(t._tm); t._tm = setTimeout(function () { t.classList.remove('zicht'); }, 3000);
      },
      mount: function (html) {
        var el = document.getElementById('app'), y = root.scrollY;
        el.innerHTML = html; root.scrollTo(0, y);
      },
      kopieer: function (tekst) {
        if (root.navigator.clipboard && root.navigator.clipboard.writeText) return root.navigator.clipboard.writeText(tekst);
        return new Promise(function (ok, nok) {
          var ta = document.createElement('textarea'); ta.value = tekst; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy') ? ok() : nok(); } catch (e) { nok(e); } finally { ta.remove(); }
        });
      },
      kiesFoto: function () {
        return new Promise(function (resolve, reject) {
          var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
          inp.onchange = function () {
            var f = inp.files && inp.files[0]; if (!f) return resolve('');
            var fr = new FileReader(); fr.onerror = reject;
            fr.onload = function () {
              var img = new Image(); img.onerror = reject;
              img.onload = function () {
                var m = 1280, k = Math.min(1, m / Math.max(img.width, img.height));
                var c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
                c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); resolve(c.toDataURL('image/jpeg', 0.8));
              };
              img.src = fr.result;
            };
            fr.readAsDataURL(f);
          };
          inp.click();
        });
      },
      onNav: function (sch, id) { try { root.history.replaceState(null, '', sch === 'bak' ? '#bak-' + id : sch === 'attr' ? '#attr-' + id : '#' + sch); } catch (e) { /* ignore */ } },
      bewaar: function (d) { try { root.localStorage.setItem(opslag, JSON.stringify(d)); } catch (e) { /* vol/uit */ } },
      geladen: function () { try { return JSON.parse(root.localStorage.getItem(opslag) || 'null'); } catch (e) { return null; } }
    });
    var host = document.getElementById('app');
    host.addEventListener('click', function (e) {
      var el = e.target.closest('[data-act]');
      if (!el || el.disabled) return;
      if (el.getAttribute('data-act') === 'sluit-bg' && e.target !== el) return;
      app.klik(el.getAttribute('data-act'), el.getAttribute('data-a'), el.getAttribute('data-b'));
    });
    host.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var el = e.target.closest('[role=button][data-act]');
      if (el) { e.preventDefault(); el.click(); }
    });
    host.addEventListener('input', function (e) { var f = e.target.getAttribute && e.target.getAttribute('data-f'); if (f) app.zet(f, e.target.value); });
    host.addEventListener('change', function (e) { var f = e.target.getAttribute && e.target.getAttribute('data-f'); if (f === 'stuk') app.zet(f, e.target.value); });
    var m = /^#(bak|attr)-(\d+)/.exec(root.location.hash || ''), t = /^#(overzicht|tellen|aanvragen|info)/.exec(root.location.hash || '');
    app.laad().then(function () { if (m) app.ga(m[1], +m[2]); else if (t && !monitor) app.ga(t[1]); });
  }
})(typeof window !== 'undefined' ? window : globalThis);
