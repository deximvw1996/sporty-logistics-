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
  // TF5 G10: één vorm voor elk tijdstip: "vrijdag 30 okt · 14:02" (ISO of "30/10/2026, 14:02").
  function tijdVorm(t) {
    var s = String(t || ''), m = /^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*(\d{2}):(\d{2})/.exec(s), d = null;
    if (m) d = new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]); else if (/^\d{4}-\d{2}-\d{2}T/.test(s)) d = new Date(s);
    if (!d || isNaN(d)) return s;
    return DAGEN[d.getDay()] + ' ' + d.getDate() + ' ' + MAANDEN[d.getMonth()] + ' · ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
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
  function telStand(data) { var r = rijen(data); return { klaar: r.filter(function (x) { return x.klaar; }).length, begonnen: r.filter(function (x) { return !x.klaar && x.type === 'bak' && x.ref.geteld > 0; }).length, totaal: r.length, rijen: r }; }
  // TF7: de waarschuwing volgt de rit: geen levering, op komst of voorbij maar nog niet afgewerkt.
  function leveringHint(data) {
    var l = data.levering; if (!l || l.status === 'gedaan' || !telStand(data).totaal || data.link_stand === 'lezen') return '';
    var n = new Date(), v = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
    return '<div class="hint">' + (l.datum && l.datum > v ? '⚠ Levering komt ' + esc(dagLang(l.datum)) + ': tel pas als alles er staat.' : '⚠ De levering staat nog niet op afgewerkt. Staat alles er? Dan mag je tellen.') + '</div>';
  }

  // ── Kop + tabbalk ──
  function kopOverzicht(data, titel, sub) {
    return '<div class="kopB"><b>' + esc(titel) + '</b><span>' + esc(sub) + '</span></div>';
  }
  function tabsHtml(data, actief, monitor) {
    var ts = telStand(data);
    var items = monitor ? [['tellen', '🧮', 'Tellen ' + ts.klaar + '/' + ts.totaal]]
      : [['overzicht', '🏠', 'Overzicht'], ['tellen', '🧮', 'Tellen ' + ts.klaar + '/' + ts.totaal], ['aanvragen', '📩', 'Aanvragen' + ((data.aanvragen || []).filter(function (a) { return a.status === 'nieuw'; }).length ? ' ' + (data.aanvragen || []).filter(function (a) { return a.status === 'nieuw'; }).length : '')], ['info', 'ℹ️', 'Info']];
    return '<div class="tabs">' + items.map(function (t) { return '<button type="button" class="' + (actief === t[0] ? 'act' : '') + '" data-act="tab" data-a="' + t[0] + '">' + t[1] + '<span>' + esc(t[2]) + '</span></button>'; }).join('') + '</div>';
  }

  // ── Overzicht ──
  function afwijkingTekst(b) {
    var d = [];
    var t = b.items.filter(function (i) { return i.aangetroffen != null && i.aangetroffen < i.gewenst; });
    if (t.length) d.push('tekort ' + String(t[0].naam).toLowerCase() + (t.length > 1 ? ' +' + (t.length - 1) : ''));
    var v = b.items.filter(function (i) { return i.aangetroffen != null && i.aangetroffen > i.gewenst; });
    if (v.length) d.push('te veel ' + String(v[0].naam).toLowerCase() + (v.length > 1 ? ' +' + (v.length - 1) : ''));
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
    var alleAfw = (data.bakken || []).filter(function (b) { return afwijkingTekst(b); }).map(function (b) { return (b.code || b.naam) + ': ' + afwijkingTekst(b); });
    var afw = alleAfw.slice(0, 2).concat(alleAfw.length > 2 ? ['+' + (alleAfw.length - 2) + ' bakken'] : []);
    var nog = ts.totaal - ts.klaar;
    var tellenS = afw.concat(nog ? [nog + ' ' + (ts.rijen.some(function (x) { return x.type === 'attr'; }) ? (nog === 1 ? 'stuk' : 'stuks') : (nog === 1 ? 'bak' : 'bakken')) + ' nog te tellen'] : []).join(' · ') || 'Alles geteld';
    var av = data.aanvragen || [], nieuw = av.filter(function (a) { return a.status === 'nieuw'; }).length;
    var telSt = function (st) { return av.filter(function (a) { return a.status === st; }).length; }, antw = [telSt('goedgekeurd') ? telSt('goedgekeurd') + ' goedgekeurd' : '', telSt('afgewezen') ? telSt('afgewezen') + ' afgewezen' : ''].filter(Boolean).join(', ');
    var avS = (antw ? antw + ' · ' : '') + av.slice(0, 2).map(function (a) { return esc(a.tekst) + (a.foto_url ? ' (foto)' : '') + (a.antwoord ? ' — ' + esc(a.antwoord) : ''); }).join(' · ') || 'Nog geen aanvragen';
    // TF1 G9: een herinnering of notitie van kantoor staat bovenaan de kaart Aanvragen.
    var mk = data.meldingen_kantoor || [];
    if (mk.length) avS = '<b>Bericht van kantoor: ' + esc(mk[0].tekst) + '</b>' + (av.length ? ' · ' + avS : '');
    var mc = data.meldingen_chauffeur || [], bs = data.boodschappen || [];
    var kaarten = leveringKaart('Levering', data.levering) + leveringKaart('Ophaling', data.ophaling)
      + '<button type="button" class="kaartB blauw" data-act="tab" data-a="tellen"><div class="t">Tellen · ' + ts.klaar + '/' + ts.totaal + (ts.rijen.some(function (x) { return x.type === 'attr'; }) ? ' stuks' : ' bakken') + '</div><div class="s">' + esc(tellenS) + '</div><div class="pijl">›</div></button>'
      + '<button type="button" class="kaartB' + (nieuw ? ' oranje' : '') + '" data-act="tab" data-a="aanvragen"><div class="t">Aanvragen' + (nieuw ? ' · ' + nieuw + ' wacht op kantoor' : '') + '</div><div class="s">' + avS + '</div><div class="pijl">›</div></button>'
      + (mc.length ? '<button type="button" class="kaartB" data-act="tab" data-a="aanvragen"><div class="t">Melding chauffeur</div><div class="s">' + esc(mc[0].tekst) + (mc[0].status === 'afgehandeld' ? ' · afgehandeld' : '') + '</div><div class="pijl">›</div></button>' : '')
      + (bs.length ? '<button type="button" class="kaartB" data-act="tab" data-a="info"><div class="t">Boodschappen · ' + bs.length + '</div><div class="s">' + bs.slice(0, 3).map(function (b) { return esc(b.naam) + (b.qty > 1 ? ' ' + b.qty : ''); }).join(' · ') + '</div><div class="pijl">›</div></button>' : '');
    var sub = [bereik(data.dagen), data.kvNaam ? kvL(data.kvNaam) : ''].filter(Boolean).join(' · ');
    return kopOverzicht(data, (data.kampLocatie || data.kampNaam) + ' · week ' + data.week, sub) + '<div class="body">' + nietGeleverdHtml(data) + kaarten + '</div>' + tabsHtml(data, 'overzicht', false);
  }

  // TF12: wat niet meekwam staat bovenaan; het hoeft niet geteld te worden.
  function nietGeleverdHtml(data, monitor) {
    var ng = data.niet_geleverd || [], na = data.nageleverd || [];
    return (ng.length ? '<div class="sec ngblok"><h3>Niet geleverd</h3>' + ng.map(function (n) { return '<div class="rij"><div class="nm">Niet geleverd: ' + esc(n.tekst) + '<b>' + esc(n.reden_tekst) + ' · ' + esc(n.stand) + '</b></div><button type="button" class="knop licht klein" data-act="toch-gevonden" data-a="' + n.check_id + '">Toch gevonden</button></div>'; }).join('') + '</div>' : '')
      + (na.length ? '<div class="sec nablok"><h3>Nageleverd · nog tellen</h3>' + na.map(function (n) { return '<div class="rij"><div class="nm">' + esc(n.tekst) + '</div></div>'; }).join('') + '</div>' : '');
  }
  // ── Tellen ──
  function tellenHtml(data, monitor) {
    var ts = telStand(data);
    var rijHtml = function (r) {
      var kl = KLEUR[r.status] || '';
      var sub;
      if (r.type === 'bak') {
        var b = r.ref, eerste = b.items.filter(function (i) { return i.status === 'tekort'; })[0];
        sub = b.aantal + (b.aantal === 1 ? ' soort' : ' soorten') + (eerste ? ' · ⚠ ' + esc(eerste.naam) + ' ' + eerste.aangetroffen + ' van ' + eerste.gewenst : (b.geteld > 0 && !r.klaar ? ' · ' + b.geteld + ' geteld' : ''));
      } else sub = 'attribuut';
      var rechts = r.status !== 'nog_niet' && PIL[r.status] ? '<span class="pil ' + PIL[r.status][0] + '">' + PIL[r.status][1] + '</span>' : '<span class="knop klein">Tellen</span>';
      // TF12: een hele bak in één tik; wat klaar is, heeft een zichtbaar Ongedaan maken.
      var snel = r.klaar ? (r.type === 'bak' && r.ref.kan_ongedaan ? '<div class="snel"><button type="button" class="knop licht" data-act="ongedaan" data-a="' + r.id + '">Ongedaan maken</button></div>' : '')
        : '<div class="snel"><button type="button" class="knop" data-act="' + (r.type === 'bak' ? 'klopt-helemaal' : 'attr-zet') + '" data-a="' + r.id + '"' + (r.type === 'bak' ? '' : ' data-b="aanwezig"') + '>Klopt helemaal</button><button type="button" class="knop licht" data-act="' + (r.type === 'bak' ? 'bak' : 'attr') + '" data-a="' + r.id + '">Iets klopt niet</button></div>';
      return '<div class="bakw">' + rijVast(r, kl, sub, rechts) + snel + '</div>';
    };
    var rijVast = function (r, kl, sub, rechts) {
      return '<div class="bak ' + kl + '" role="button" tabindex="0" data-act="' + (r.type === 'bak' ? 'bak' : 'attr') + '" data-a="' + r.id + '"><div class="code">' + esc(r.code || '—') + '</div><div class="nm">' + esc(r.naam) + '<b>' + sub + '</b></div>' + rechts + '</div>';
    };
    // TF5 G3: bij twee thema's staan de bakken per thema en groep.
    ts.rijen = ts.rijen.filter(function (r) { return !r.klaar; }).concat(ts.rijen.filter(function (r) { return r.klaar; })); // TF12: wat af is, zakt weg
    var koppen = {}, groepNaam = function (r) { return r.type === 'bak' && r.ref.thema ? r.ref.thema + (r.ref.groep ? ' · ' + r.ref.groep : '') : ''; };
    ts.rijen.forEach(function (r) { var g = groepNaam(r); if (g) koppen[g] = 1; });
    var lijst;
    if (Object.keys(koppen).length > 1) {
      lijst = Object.keys(koppen).concat(['']).map(function (g) { var rs = ts.rijen.filter(function (r) { return groepNaam(r) === g; }); return rs.length ? (g ? '<h3 class="groepkop" style="font-size:13px;margin:12px 0 6px">' + esc(g) + '</h3>' : '') + rs.map(rijHtml).join('') : ''; }).join('');
    } else lijst = ts.rijen.map(rijHtml).join('');
    // TF5 G5: kamp zonder bak: uitleg en kantoor (zonder nummer: geen nummer tonen).
    var tel = data.kantoor && data.kantoor.telefoon;
    if (!lijst) lijst = '<div class="leeg">Voor dit kamp staan er geen bakken op jouw lijst, dus er is niets te tellen. Klopt dat niet? Laat het kantoor weten.' + (tel ? '<br><a class="knop licht klein" style="margin-top:8px" href="tel:' + esc(String(tel).replace(/[^\d+]/g, '')) + '">📞 Bel kantoor · ' + esc(tel) + '</a>' : '') + '</div>';
    var nv = data.niet_verstuurd || 0;
    var lst = (data.niet_verstuurd_lijst || []).slice(0, 5).map(esc).join('<br>');
    var stand = monitor ? '' : (data.verstuurd ? '<div class="hint" style="margin-top:8px">✓ Verstuurd om ' + esc(tijdVorm(data.verstuurd.op)) + '</div>' : '') + (nv ? '<div class="hint" style="margin-top:8px;color:#c2410c;font-weight:700">' + nv + (nv === 1 ? ' wijziging' : ' wijzigingen') + ' nog niet verstuurd' + (lst ? '<br><span style="font-weight:400">' + lst + '</span>' : '') + '</div>' : '');
    var versturen = monitor || !ts.totaal ? '' : stand + '<button type="button" class="knop breed" data-act="versturen">Telling versturen (' + ts.klaar + '/' + ts.totaal + ')</button><div class="hint" style="margin-top:8px">Versturen kan ook als nog niet alles geteld is; kantoor ziet wat ontbreekt. Je mag altijd natellen en opnieuw versturen; alles blijft bewaard.</div>';
    return kopOverzicht(data, 'Tellen · ' + ts.klaar + '/' + ts.totaal + (ts.rijen.some(function (x) { return x.type === 'attr'; }) ? ' stuks' : ' bakken'), data.link_stand === 'lezen' || !ts.totaal ? '' : 'tik een bak om te tellen · natellen mag de hele week' + (ts.begonnen ? ' · ' + ts.begonnen + ' begonnen' : ''))
      + '<div class="body">' + nietGeleverdHtml(data, monitor) + voortgang(data) + leveringHint(data) + lijst + versturen + '</div>' + tabsHtml(data, 'tellen', monitor);
  }

  function voortgang(data) {
    var bk = data.bakken || [], tot = bk.reduce(function (a, b) { return a + (b.stuks || 0); }, 0), gd = bk.reduce(function (a, b) { return a + (b.stuks_geteld || 0); }, 0), af = bk.filter(function (b) { return b.aantal > 0 && b.geteld === b.aantal; }).length;
    var volgende = bk.filter(function (b) { return !(b.aantal > 0 && b.geteld === b.aantal); })[0];
    return bk.length ? '<div class="voortgang"><b>' + gd + ' van ' + tot + ' stuks · ' + af + ' van ' + bk.length + ' bakken</b>' + (volgende ? '<button type="button" class="knop licht" data-act="bak" data-a="' + volgende.id + '">Volgende bak</button>' : '') + '</div>' : '';
  }
  // ── Telscherm ──
  function itemHtml(b, it, st) {
    var kl = KLEUR[it.status] || '', open = st.open === it.id, afw = it.status === 'tekort' || it.status === 'kapot' || it.status === 'te_veel';
    // TF1 G13: toon álle afwijkingen van het stuk, met aantallen (bv. "kapot 1 · te veel 2").
    var afwTekst = [it.aangetroffen != null && it.aangetroffen < it.gewenst ? 'tekort ' + (it.gewenst - it.aangetroffen) : '', it.kapot_aantal > 0 ? 'kapot ' + it.kapot_aantal : '', it.te_veel > 0 ? 'te veel ' + it.te_veel : ''].filter(Boolean).join(' · ');
    var tweede = afw ? '<button type="button" class="act af" data-act="anders" data-a="' + it.id + '">' + esc(afwTekst || (it.status === 'te_veel' ? 'te veel' : it.status)) + '</button>'
      : '<button type="button" data-act="anders" data-a="' + it.id + '">anders</button>';
    // TF12: alles staat standaard in orde; alleen een afwijking aantikken.
    var eerste = afw ? '<button type="button" data-act="klopt" data-a="' + b.id + '" data-b="' + it.id + '">✓ ' + it.gewenst + '</button>' : '<button type="button" data-act="afw" data-a="' + it.id + '" data-b="minder">Minder</button><button type="button" data-act="afw" data-a="' + it.id + '" data-b="kapot">Kapot</button>';
    tweede = afw ? tweede : '<button type="button" data-act="afw" data-a="' + it.id + '" data-b="te_veel">Te veel</button>';
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
      + '<div class="body"><div class="hint">Alles staat op in orde. Tik alleen wat afwijkt: <b>Minder</b>, <b>Kapot</b> of <b>Te veel</b>. Daarna Bak klaar.</div>'
      + (b.items.map(function (it) { return itemHtml(b, it, st); }).join('') || '<div class="leeg">Deze bak heeft nog geen items.</div>') + '</div>'
      + (st.monitor ? '' : '<div class="body" style="padding-top:0"><button type="button" class="knop licht breed" data-act="sheet-open" data-a="kapot">💥 Kapot melden</button></div>')
      + '<div class="voet"><button type="button" class="knop" data-act="bak-klaar">Bak klaar · ' + b.items.reduce(function (a, i) { return a + (i.status === 'tekort' || i.status === 'kapot' || i.status === 'te_veel' ? 0 : i.gewenst); }, 0) + ' stuks in orde</button></div>';
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
      return '<div class="rij"><div class="nm">' + esc(a.tekst) + (a.foto_url ? ' (foto)' : '') + '<b>' + esc(tijdVorm(a.created_at)) + ' · ' + esc(a.antwoord || (a.status === 'nieuw' ? 'wacht op kantoor' : p[1])) + (a.komt ? ' · ' + esc(a.komt.gedaan ? 'geleverd' : a.komt.onderweg ? 'onderweg' : a.komt.datum ? 'komt ' + dagLang(a.komt.datum) + (a.komt.rit ? ' met de rit' : '') : 'nog niet ingepland') : '') + '</b></div><span class="pil ' + p[0] + '">' + p[1] + '</span></div>';
    }).join('') || '<div class="leeg">Nog geen aanvragen.</div>';
    var mc = (data.meldingen_chauffeur || []).map(function (m) {
      return '<div class="rij"><div class="nm">' + esc(m.tekst) + '<b>' + esc(tijdVorm(m.created_at)) + ' · ' + (m.status === 'afgehandeld' ? 'afgehandeld door kantoor' : m.status === 'nieuw' ? 'wacht op kantoor' : esc(m.status || '')) + '</b></div></div>';
    }).join('');
    var mk = (data.meldingen_kantoor || []).map(function (m) {
      return '<div class="rij"><div class="nm">' + esc(m.tekst) + '<b>' + esc(tijdVorm(m.created_at)) + ' · ' + (m.soort === 'herinnering_kv' ? 'herinnering van kantoor' : 'notitie van kantoor') + '</b></div></div>';
    }).join('');
    return kopOverzicht(data, 'Aanvragen', 'materiaal vragen of kapot melden · kantoor antwoordt hier')
      + '<div class="body"><div class="twee"><button type="button" class="knop" data-act="sheet-open" data-a="materiaal">📩 Materiaal vragen</button><button type="button" class="knop licht" data-act="sheet-open" data-a="kapot">💥 Kapot melden</button></div>'
      + '<div class="sec" style="margin-top:12px"><h3>Mijn aanvragen</h3>' + av + '</div>'
      + (mk ? '<div class="sec"><h3>Berichten van kantoor</h3>' + mk + '</div>' : '')
      + (mc ? '<div class="sec"><h3>Meldingen chauffeur</h3>' + mc + '</div>' : '') + '</div>' + tabsHtml(data, 'aanvragen', false);
  }
  function sheetHtml(data, sh) {
    var kapot = sh.soort === 'kapot';
    var stukken = [], eerst = sh.stuk ? String(sh.stuk).split(' · ').pop() : '';
    // TF7 N8: de bak waarin je zit staat bovenaan en is voorgekozen.
    (data.bakken || []).slice().sort(function (x, y) { return ((y.code || '(geen code)') === eerst) - ((x.code || '(geen code)') === eerst); }).forEach(function (b) { b.items.forEach(function (i) { stukken.push(i.naam + ' · ' + (b.code || '(geen code)')); }); });
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
    if (data.link_stand === 'lezen') return '<div class="alleenlezen"><style>.alleenlezen .ja,.alleenlezen .voet,.alleenlezen .twee,.alleenlezen [data-act=versturen],.alleenlezen [data-act=sheet-open],.alleenlezen .body>.hint{display:none}</style><div class="hint" style="background:#fff7ed;color:#9a3412;padding:12px;font-weight:700">Dit kamp is afgelopen. Je kan alles nog lezen, maar niets meer wijzigen. Je tellingen blijven bewaard.</div>' + basis + '</div>';
    return basis + (st.sheet && !mon ? sheetHtml(data, st.sheet) : '');
  }

  // ── Logica ──
  // deps: { token, monitor, fetch, toast(tekst,goed), mount(html), kiesFoto(), kopieer(tekst), host, bewaar, geladen }
  function createApp(deps) {
    var st = { scherm: deps.monitor ? 'tellen' : 'overzicht', bakId: null, attrId: null, open: null, draft: null, sheet: null, monitor: !!deps.monitor, bezig: false };
    var data = null, offlineGemeld = false;
    var base = '/api/kv/' + encodeURIComponent(deps.token);
    function teken() { if (data) deps.mount(schermHtml(data, st, deps.host || '')); }
    // TF2 G3: tijdens een deploy geeft de proxy 502/503/504 (of is de verbinding even weg): na 2 s en 5 s nog twee keer proberen.
    // POST's worden alleen herhaald bij 502/503/504 (de app is dan niet bereikt) en bij een netwerkfout als de aanroep idempotent is (idem=true).
    var herhaalMelding = false;
    async function haal(url, opts, idem) {
      var wacht = deps.wacht || function (ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); };
      var get = !opts || !opts.method || opts.method === 'GET', pauzes = [2000, 5000], r, fout;
      for (var i = 0; ; i++) {
        r = null; fout = null;
        try { r = await deps.fetch(url, opts); } catch (e) { fout = e; }
        var weg = fout ? (get || idem) : (r.status === 502 || r.status === 503 || r.status === 504);
        if (!weg || i >= pauzes.length) { if (fout) throw fout; return r; }
        if (!herhaalMelding) { deps.toast('Even geduld, de app wordt bijgewerkt…', true); herhaalMelding = true; }
        await wacht(pauzes[i]);
      }
    }
    async function aanroep(methode, pad, body) {
      var r;
      try { r = await haal(base + pad, { method: methode, headers: body !== undefined ? { 'Content-Type': 'application/json' } : {}, body: body !== undefined ? JSON.stringify(body) : undefined }, pad === '/versturen'); }
      catch (e) { deps.toast('Geen verbinding — probeer het zo opnieuw.', false); return null; }
      var j = null; try { j = await r.json(); } catch (e) { /* leeg */ }
      if (!r.ok) { deps.toast((j && j.error) || 'Dat lukte niet (' + r.status + ').', false); return null; }
      return j || {};
    }
    async function laad() {
      try {
        var r = await haal(base + '/data'), j = await r.json();
        if (!r.ok) { deps.toast(j.error || 'Laden mislukt.', false); if (j.link_stand === 'dicht') deps.mount('<div class="leeg" style="padding:24px">' + esc(j.error) + '</div>'); return false; }
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
          var rij = { item_id: st.open, aangetroffen: st.draft.geteld, kapot_aantal: st.draft.kapot, notitie: (function () { var it0 = bk3.items.filter(function (i) { return i.id === st.open; })[0]; return it0 && st.draft.notitie === it0.notitie && st.draft.geteld !== it0.aangetroffen ? '' : st.draft.notitie; })() }; // TF7 N7
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
        case 'bak-klaar': {
          var bk5 = st.scherm === 'bak' ? vindBak(st.bakId) : null, rest5 = bk5 ? bk5.items.filter(function (i) { return i.aangetroffen == null; }) : [];
          if (rest5.length) { var j5 = await stuur(bk5, rest5.map(function (i) { return { item_id: i.id, aangetroffen: i.gewenst }; })); if (!j5) return; }
          return ga('tellen');
        }
        case 'klopt-helemaal': { var j6 = await aanroep('POST', '/bakken/' + id + '/klopt-helemaal', {}); if (j6) await laad(); return; }
        case 'ongedaan': { var j7 = await aanroep('POST', '/bakken/' + id + '/ongedaan', {}); if (j7) { deps.toast('Teruggezet', true); await laad(); } return; }
        case 'toch-gevonden': { var j8 = await aanroep('POST', '/toch-gevonden', { check_id: id }); if (j8) deps.toast('Kantoor weet het: zij beslissen wat er gebeurt.', true); return; }
        case 'afw': {
          var bk9 = vindBak(st.bakId), it9 = bk9 && bk9.items.filter(function (i) { return i.id === id; })[0];
          if (!it9) return;
          st.open = id; st.draft = { geteld: b === 'minder' ? Math.max(0, it9.gewenst - 1) : b === 'te_veel' ? it9.gewenst + 1 : it9.gewenst, kapot: b === 'kapot' ? 1 : 0, notitie: it9.notitie || '', foto: '' };
          return teken();
        }
        case 'attr-zet': {
          var ja = await aanroep('POST', '/attributen/' + id + '/status', { status: b });
          if (ja) await laad();
          return;
        }
        case 'versturen': {
          var jv = await aanroep('POST', '/versturen', {});
          if (jv) { deps.toast(jv.verstuurd_op ? '✓ Telling verstuurd naar kantoor' : 'Niets nieuws: kantoor heeft dit al', true); await laad(); }
          return;
        }
        case 'sheet-open': { var bk8 = st.scherm === 'bak' && a === 'kapot' ? vindBak(st.bakId) : null; st.sheet = { soort: a, tekst: '', aantal: '', foto: '', stuk: bk8 && bk8.items[0] ? bk8.items[0].naam + ' · ' + (bk8.code || '(geen code)') : '', bezig: false }; return teken(); }
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
    if (root.addEventListener) root.addEventListener('sporty-live', function () { app.laad(); }); // RT1
    root.addEventListener('testklok-wissel', function () { app.laad(); }); // TK1: tekent opnieuw uit de staat, een open venster en getypte tekst blijven
    app.laad().then(function () { if (m) app.ga(m[1], +m[2]); else if (t && !monitor) app.ga(t[1]); });
  }
})(typeof window !== 'undefined' ? window : globalThis);
