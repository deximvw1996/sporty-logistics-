// routes/tekorten-overzicht.js — TB2: Voorraad & controles › Tekorten & bestellingen (design/mockup-tekorten.html, standaardpatroon).
// Eén rij per artikel: alle regels die kantoor in Nakijken goedkeurde om aan te vullen of te bestellen (kantoor_actie uit_pool /
// bestellen / afschrijven_bestellen), samengeteld over de bakken van de periode. Aanvaarde en nog niet gekeurde meldingen staan hier
// niet; die laatste telt de chip "Te beslissen" (keuren gebeurt in /nakijken). Het systeem stelt "uit voorraad" of "te bestellen"
// voor; kantoor kan dat per artikel omdraaien (tekort_bestellingen.stand_kantoor, migratie 83). Een bestelling is altijd een keuze.
'use strict';
module.exports = function(ctx){
  const {app,get,all,now,logAct,updateMetLog,insMetLog,alleenKantoor,vereisRol} = ctx;
  // Aanvulling Maxim 30/10: coördinatoren mogen de pagina zien en bestellen / binnen melden; keuren (Nakijken), negeren en melden blijft kantoor.
  const kantoorOfCoord=vereisRol('kantoor','coordinator');
  const {zonderHaakjes}=require('../lib/tijd');

  const GOED=['uit_pool','bestellen','afschrijven_bestellen'];
  const BESTEL_ACTIE=a=>a==='bestellen'||a==='afschrijven_bestellen';
  const DAG=['zo','ma','di','wo','do','vr','za'],MND=['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
  const isoLokaal=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const isoNu=()=>{const d=new Date();return `${isoLokaal(d)} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;};
  const tijdTekst=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(s||'');if(!m)return s||'';const d=new Date(+m[1],+m[2]-1,+m[3]);return `${DAG[d.getDay()]} ${d.getDate()} ${MND[d.getMonth()]} ${m[4]}:${m[5]}`;};
  const wie=req=>(req.persoon&&req.persoon.naam)||'kantoor';
  const norm=s=>zonderHaakjes(String(s||'')).toLowerCase().replace(/\s+/g,' ').trim();
  const fmt=n=>{const x=Math.round((+n||0)*100)/100;return x.toLocaleString('nl-BE');};
  const locNaam=id=>id?((get('SELECT name FROM locaties WHERE id=?',[id])||{}).name||''):'';
  const stockage=naam=>get("SELECT id FROM locaties WHERE name=? AND (parent_id IS NULL OR parent_id=0) ORDER BY id LIMIT 1",[naam]);
  const periodeVan=id=>(id&&get('SELECT * FROM vakantieperiodes WHERE id=?',[id]))||get('SELECT * FROM vakantieperiodes WHERE actief=1');

  // Alle nakijk-regels met hun sessie, kampmoment en artikel (item_type via het bak-item, anders op naam in de catalogus).
  function regelsVan(per){
    const rijen=all(`SELECT r.*,s.kampmoment_id,s.bak_type,s.thema_bak_id,s.vaste_bak_id,s.attribuut_id,s.locatie_id AS s_loc,s.week AS s_week,s.datum AS s_datum,
        s.kv_wie,s.kv_status,s.kantoor_status,s.kantoor_afgerond_op,s.notities AS s_notities,bi.item_type_id AS bi_type,
        km.periode_id,km.locatie_id AS km_loc,km.week AS km_week
      FROM nakijk_regels r JOIN nakijk_sessies s ON s.id=r.sessie_id LEFT JOIN bak_items bi ON bi.id=r.item_id LEFT JOIN kampmomenten km ON km.id=s.kampmoment_id`);
    const types=all('SELECT id,naam,eenheid FROM item_types');
    const opNaam=new Map();types.forEach(t=>{const k=norm(t.naam);if(!opNaam.has(k))opNaam.set(k,t);});
    return rijen.filter(r=>{
      if(!per)return true;
      if(r.periode_id)return r.periode_id===per.id;
      if(r.s_notities==='kantoor-melding')return true; // + Tekort melden zonder kampmoment: hoort bij de periode waarin het gemeld werd (actief)
      const d=String(r.s_datum||'').slice(0,10);return !d||(d>=per.start_datum&&d<=per.eind_datum);
    }).map(r=>{
      const t=r.bi_type?types.find(x=>x.id===r.bi_type):opNaam.get(norm(r.item_naam));
      return {...r,item_type_id:t?t.id:null,artikel_id:t?String(t.id):'n:'+norm(r.item_naam),artikel_naam:t?t.naam:zonderHaakjes(r.item_naam||''),eenheid:t?(t.eenheid||'stuk'):'stuk'};
    });
  }
  const isOpen=r=>!r.aangevuld&&r.tekort_status!=='genegeerd';
  const goedgekeurd=r=>GOED.includes(r.kantoor_actie)&&(r.kantoor_aantal||0)>0;
  // Nog te beslissen in Nakijken: verstuurde telling, niet nagekeken, regel met tekort of kapot zonder kantoor-actie.
  const teBeslissen=r=>r.kv_status==='ingediend'&&!['nagekeken','verwerkt'].includes(r.kantoor_status)&&!r.kantoor_afgerond_op&&!r.kantoor_actie
    &&r.aangetroffen!=null&&((r.aangetroffen<(r.verwacht||0))||(r.kapot_aantal||0)>0);

  function bakVan(r){
    if(r.bak_type==='attribuut'){const a=get('SELECT code,naam FROM attributen WHERE id=?',[r.attribuut_id]);return a?{code:a.code||'',naam:a.naam||''}:{code:'',naam:''};}
    const id=r.bak_type==='thema'?r.thema_bak_id:r.vaste_bak_id;
    const b=id?get('SELECT code,naam FROM bakken WHERE id=?',[id]):null;return b?{code:b.code||'',naam:b.naam||''}:{code:'',naam:''};
  }
  const regelLoc=r=>locNaam(r.km_loc||r.s_loc);
  function voorraadVan(typeId){
    if(!typeId)return null;
    const st=naam=>{const l=stockage(naam);return l?get('SELECT qty,minimum FROM item_type_stock WHERE item_type_id=? AND locatie_id=?',[typeId,l.id]):null;};
    const r=st('Rozenweg'),k=st('Kantoor');
    return {rozenweg:r?(r.qty||0):0,kantoor:k?(k.qty||0):null,minimum:r?(r.minimum||0):0};
  }
  // Voorstel: genoeg voorraad (Rozenweg + Kantoor) én na aanvullen nog ≥ minimum → uit voorraad; anders bestellen tot het minimum.
  function voorstel(tekort,v){
    const vr=v?(v.rozenweg||0)+(v.kantoor||0):0,min=v?(v.minimum||0):0;
    if(tekort<=vr&&vr-tekort>=min)return {stand:'uit_voorraad',bestel_voorstel:0};
    return {stand:'te_bestellen',bestel_voorstel:Math.max(Math.ceil(tekort-vr+min),Math.ceil(tekort-vr),1)};
  }
  const bestellingVan=(sleutel,per)=>/^b:\d+$/.test(sleutel)?get('SELECT * FROM tekort_bestellingen WHERE id=?',[+sleutel.slice(2)]):get('SELECT * FROM tekort_bestellingen WHERE artikel_sleutel=? AND periode_id=? AND COALESCE(los,0)=0 ORDER BY id DESC LIMIT 1',[sleutel,per?per.id:0]);

  function artikels(per){
    const regels=regelsVan(per);
    const groepen=new Map();
    regels.filter(goedgekeurd).forEach(r=>{let g=groepen.get(r.artikel_id);if(!g)groepen.set(r.artikel_id,g={artikel_id:r.artikel_id,naam:r.artikel_naam,eenheid:r.eenheid,item_type_id:r.item_type_id,regels:[]});g.regels.push(r);});
    const lijst=[...groepen.values()].map(g=>{
      const open=g.regels.filter(isOpen),basis=open.length?open:g.regels;
      const tekort=basis.reduce((s,r)=>s+(r.kantoor_aantal||0),0);
      const locs=[...new Set(basis.map(regelLoc).filter(Boolean))];
      const v=voorraadVan(g.item_type_id),vs=voorstel(tekort,v),b=bestellingVan(g.artikel_id,per);
      let stand;
      if(!open.length)stand='afgehandeld';
      else if(b&&b.binnen_op&&!b.extra)stand='binnen';
      else if(b&&b.besteld_op&&!b.extra)stand='besteld';
      else stand=(b&&b.stand_kantoor)||vs.stand;
      const kort=n=>n.replace(/\s+(Vlierbeek|basisschool)$/i,'');
      return {artikel_id:g.artikel_id,item_type_id:g.item_type_id,naam:g.naam,eenheid:g.eenheid,tekort,n_bakken:new Set(basis.filter(r=>r.bak_type!=='melding').map(r=>r.sessie_id)).size,n_locaties:locs.length,
        waar_tekst:locs.length>2?`${locs.length} locaties`:locs.map(kort).join(' · '),voorraad:v,stand,stand_voorstel:vs.stand,bestel_voorstel:vs.bestel_voorstel,
        stand_bron:b&&b.stand_kantoor&&!b.besteld_op?'kantoor':'voorstel',
        bestelling:b&&(b.besteld_op||b.aantal)?{aantal:b.aantal||0,binnen_aantal:b.binnen_aantal||0,waar_kopen:b.waar_kopen||'',besteld_op:b.besteld_op||'',binnen_op:b.binnen_op||'',besteld_door:b.besteld_door||'',extra:!!b.extra,leveren_aan:locNaam(b.leveren_aan_id)||'Rozenweg'}:null,
        open_regels:open.length,regel_ids:basis.map(r=>r.id),
        zoek:norm([g.naam,locs.join(' '),...basis.map(r=>{const bk=bakVan(r);return bk.code+' '+bk.naam;})].join(' '))};
    }).sort((a,b)=>{const o=['te_bestellen','besteld','binnen','uit_voorraad','afgehandeld'];return o.indexOf(a.stand)-o.indexOf(b.stand)||b.tekort-a.tekort||a.naam.localeCompare(b.naam);});
    // "+ Bestelling" zonder tekort: eigen rij (artikel_id "b:<id>"), stand besteld → binnen; verhoogt bij binnen alleen de voorraad.
    all("SELECT * FROM tekort_bestellingen WHERE los=1 AND periode_id=? ORDER BY id DESC",[per?per.id:0]).forEach(b=>{
      const t=b.item_type_id?get('SELECT naam,eenheid FROM item_types WHERE id=?',[b.item_type_id]):null;
      lijst.push({artikel_id:'b:'+b.id,item_type_id:b.item_type_id,naam:(t&&t.naam)||b.naam,eenheid:(t&&t.eenheid)||'stuk',tekort:0,n_bakken:0,n_locaties:0,
        waar_tekst:'bestelling zonder tekort'+(b.reden?' · '+b.reden:''),voorraad:voorraadVan(b.item_type_id),stand:b.binnen_op?'binnen':'besteld',stand_voorstel:'te_bestellen',bestel_voorstel:b.aantal,stand_bron:'kantoor',los:true,
        bestelling:{aantal:b.aantal,binnen_aantal:b.binnen_aantal||0,waar_kopen:b.waar_kopen||'',besteld_op:b.besteld_op||'',binnen_op:b.binnen_op||'',besteld_door:b.besteld_door||'',leveren_aan:locNaam(b.leveren_aan_id)||'Rozenweg',reden:b.reden||''},
        open_regels:0,regel_ids:[],zoek:norm([(t&&t.naam)||b.naam,b.waar_kopen,b.reden].join(' '))});
    });
    const tel=s=>lijst.filter(a=>a.stand===s).length;
    const tellers={open:lijst.filter(a=>a.stand!=='afgehandeld').length,te_beslissen:regels.filter(teBeslissen).length,
      te_bestellen:tel('te_bestellen'),besteld:tel('besteld'),binnen:tel('binnen'),uit_voorraad:tel('uit_voorraad'),afgehandeld:tel('afgehandeld')};
    return {lijst,tellers,regels};
  }
  const CHIPS={open:a=>a.stand!=='afgehandeld',te_bestellen:a=>a.stand==='te_bestellen',besteld:a=>a.stand==='besteld',binnen:a=>a.stand==='binnen',uit_voorraad:a=>a.stand==='uit_voorraad',afgehandeld:a=>a.stand==='afgehandeld'};

  app.get('/api/tekorten-overzicht',kantoorOfCoord,(req,res)=>{
    const per=periodeVan(parseInt(req.query.periode_id));
    const {lijst,tellers}=artikels(per);
    const f=CHIPS[req.query.chip]||null;
    res.json({periode:per?{id:per.id,naam:per.naam}:null,tellers,artikels:(f?lijst.filter(f):lijst).map(({regel_ids,...a})=>a)});
  });

  // ── Detail ──
  function detail(per,artikelId){
    const {lijst,regels}=artikels(per);
    const a=lijst.find(x=>x.artikel_id===artikelId);
    if(!a)return null;
    const mijn=regels.filter(r=>a.regel_ids.includes(r.id));
    const uitV=a.stand==='uit_voorraad'||(a.stand==='afgehandeld'&&!a.bestelling);
    const stappen=['gemeld door KV','gekeurd',...(uitV?['uit voorraad']:['bestellen','besteld','binnen']),'aangevuld'];
    const nu={uit_voorraad:'uit voorraad',te_bestellen:'bestellen',besteld:'binnen',binnen:'aangevuld',afgehandeld:null}[a.stand];
    const iNu=nu?stappen.indexOf(nu):stappen.length;
    const tijdlijn=stappen.map((s,i)=>({stap:s,stand:i<iNu?'ok':i===iNu?'nu':''}));
    const regelsUit=mijn.map(r=>{const bk=bakVan(r);
      return {regel_id:r.id,code:bk.code,bak:bk.naam,locatie:regelLoc(r),week:r.km_week||r.s_week||null,kv:r.s_notities==='kantoor-melding'?'kantoor':(r.kv_wie||''),
        geteld:r.aangetroffen,gewenst:r.verwacht,notitie:r.notitie||r.kantoor_notitie||'',kantoor_actie:r.kantoor_actie,aantal:r.kantoor_aantal||0,
        status:r.aangevuld?'aangevuld':r.tekort_status==='genegeerd'?'genegeerd':r.tekort_status==='binnen'?'binnen':r.tekort_status==='besteld'?'besteld':'open'};});
    const perStockage=a.item_type_id?all('SELECT s.qty,s.minimum,l.name FROM item_type_stock s JOIN locaties l ON l.id=s.locatie_id WHERE s.item_type_id=? ORDER BY l.name',[a.item_type_id]).map(x=>({locatie:x.name,qty:x.qty||0,minimum:x.minimum||0})):[];
    const v=a.voorraad,na=v?v.rozenweg-a.tekort:null;
    const open=regelsUit.filter(r=>r.status!=='aangevuld'&&r.status!=='genegeerd');
    const besteldAantal=a.bestelling?a.bestelling.aantal:a.bestel_voorstel;
    // TF8: pas "nu al afvinkbaar" als er echt voor uit voorraad gekozen is; vóór de keuze is het alleen een voorstel.
    const gekozenUitV=open.length>0&&open.every(r=>r.kantoor_actie==='uit_pool');
    const naLevering={aanvullijst:open.length?`${open.length} handeling${open.length===1?'':'en'} (${open.map(r=>r.code||r.bak||'#'+r.regel_id).join(', ')}) ${gekozenUitV?'nu al afvinkbaar (uit voorraad)':uitV?(open.length===1?'wordt':'worden')+' afvinkbaar zodra je "Aanvullen uit voorraad" kiest':(open.length===1?'wordt':'worden')+' afvinkbaar zodra "binnen"'}`:'niets meer open',
      rest:!uitV&&besteldAantal>a.tekort?`${fmt(besteldAantal-a.tekort)} naar voorraad Rozenweg`:'—'};
    // Historiek: wijzigingen op de bestelling en op de regels van dit artikel.
    const b=bestellingVan(a.artikel_id,per);
    const ids=mijn.map(r=>r.id);
    const wz=all(`SELECT * FROM wijzigingen WHERE ${b?"(tabel='tekort_bestellingen' AND rij_id=?) OR ":''}(tabel='nakijk_regels' AND rij_id IN (${ids.map(()=>'?').join(',')||'0'})) ORDER BY id DESC LIMIT 100`,[...(b?[b.id]:[]),...ids]);
    const historiek=[];
    wz.forEach(w=>{let n=null,o=null;try{n=JSON.parse(w.nieuw||'null');o=JSON.parse(w.oud||'null');}catch(e){}
      let wat='';
      if(w.tabel==='tekort_bestellingen'){
        if(w.actie==='insert'||!o)wat=n&&n.besteld_op?`besteld: ${fmt(n.aantal)}${n.waar_kopen?' bij '+n.waar_kopen:''}`:n&&n.stand_kantoor?`stand gekozen: ${n.stand_kantoor.replace('_',' ')}`:'bestelling aangemaakt';
        else if(n.binnen_op&&!o.binnen_op)wat='bestelling binnen';
        else if(n.besteld_op&&!o.besteld_op)wat=`besteld: ${fmt(n.aantal)}${n.waar_kopen?' bij '+n.waar_kopen:''}`;
        else if(n.stand_kantoor!==o.stand_kantoor)wat=n.stand_kantoor?`stand omgedraaid: ${n.stand_kantoor.replace('_',' ')} (voorstel was ${String(o.stand_kantoor||a.stand_voorstel).replace('_',' ')})`:'stand terug naar het voorstel';
      }else if(n&&o){
        const bk=bakVan(mijn.find(r=>r.id===w.rij_id)||{});
        if(n.kantoor_actie!==o.kantoor_actie)wat=`${bk.code||'regel'}: actie ${n.kantoor_actie||'(leeg)'}`;
        else if(n.tekort_status!==o.tekort_status)wat=`${bk.code||'regel'}: ${n.tekort_status}`;
        else if(n.aangevuld!==o.aangevuld)wat=`${bk.code||'regel'}: ${n.aangevuld?'aangevuld':'aangevuld teruggezet'}`;
      }else if(w.actie==='insert'&&n)wat=`gemeld: ${fmt(n.kantoor_aantal||n.verwacht)} ${zonderHaakjes(n.item_naam||'')}`;
      if(wat)historiek.push({t:tijdTekst(w.tijdstip),wie:w.persoon_naam||'',wat,wijziging_id:w.id});
    });
    return {artikel:a,tijdlijn,regels:regelsUit,voorraad:{...(v||{rozenweg:null,kantoor:null,minimum:0}),na_aanvullen:na,onder_minimum:na!=null&&na<(v?v.minimum:0),per_stockage:perStockage},
      voorstel:{stand:a.stand_voorstel,bestel:a.bestel_voorstel,tekst:a.stand_voorstel==='uit_voorraad'?`aanvullen uit voorraad (${fmt(a.tekort)} van ${fmt(v?v.rozenweg+(v.kantoor||0):0)})`
        :`bestel ${fmt(a.bestel_voorstel)} (${fmt(a.tekort)} tekort${v&&a.bestel_voorstel>a.tekort-(v.rozenweg+(v.kantoor||0))?` + ${fmt(a.bestel_voorstel-Math.max(0,a.tekort-(v.rozenweg+(v.kantoor||0))))} tot minimum`:''})`},
      bestelling:a.bestelling?{...a.bestelling,leveren_aan:'Rozenweg'}:null,na_levering:naLevering,historiek};
  }
  app.get('/api/tekorten/bestellijst',kantoorOfCoord,(req,res)=>res.json(bestellijst(periodeVan(parseInt(req.query.periode_id)))));
  app.get('/api/tekorten/:artikel_id/detail',kantoorOfCoord,(req,res)=>{
    const d=detail(periodeVan(parseInt(req.query.periode_id)),req.params.artikel_id);
    if(!d)return res.status(404).json({error:'Dit artikel heeft geen goedgekeurde tekorten (meer) in deze periode.'});
    res.json(d);
  });

  // ── Acties (alle gelogd) ──
  function zetBestelling(req,per,a,velden,context){
    const b=bestellingVan(a.artikel_id,per);
    if(b){updateMetLog(req,'tekort_bestellingen',b.id,velden,context);return b.id;}
    const v={artikel_sleutel:a.artikel_id,periode_id:per?per.id:0,naam:a.naam,item_type_id:a.item_type_id||null,created_at:now(),...velden};
    return insMetLog(req,'tekort_bestellingen',Object.keys(v),Object.values(v),context);
  }
  const openRegels=(regels,a)=>regels.filter(r=>a.regel_ids.includes(r.id)&&isOpen(r));
  function stockPlus(req,typeId,delta,context,locId){
    const l=locId?{id:locId}:stockage('Rozenweg');if(!typeId||!l||!delta)return;
    const s=get('SELECT * FROM item_type_stock WHERE item_type_id=? AND locatie_id=?',[typeId,l.id]);
    if(s)updateMetLog(req,'item_type_stock',s.id,{qty:Math.max(0,(s.qty||0)+delta)},context);
    else insMetLog(req,'item_type_stock',['item_type_id','locatie_id','qty','minimum'],[typeId,l.id,Math.max(0,delta),0],context);
  }
  // TF6 G11: "Bestelling binnen" gaat naar de andere kant dan wie het zelf deed (coördinator → kantoor, kantoor → coördinatoren), nooit naar jezelf.
  function meldBinnen(req,tekst){
    if(!ctx.melding)return;
    const rol=(req.persoon&&req.persoon.rol)||'';
    ctx.melding(req,{voor_rol:rol==='coordinator'?'kantoor':'coordinator',van_naam:wie(req),tekst,link:'/tekorten'}); // ME1
  }
  const ACTIE={
    stand(req,per,a,regels,b){
      const stand=b.stand;if(!['uit_voorraad','te_bestellen'].includes(stand))return {status:400,error:'stand moet uit_voorraad of te_bestellen zijn'};
      if(a.los)return {status:409,error:'Een bestelling zonder tekort heeft geen stand om te kiezen'};
      zetBestelling(req,per,a,{stand_kantoor:stand===a.stand_voorstel?'':stand},'tekorten');
      openRegels(regels,a).forEach(r=>{
        const actie=stand==='uit_voorraad'?'uit_pool':(r.kantoor_actie==='afschrijven_bestellen'?'afschrijven_bestellen':'bestellen');
        if(actie!==r.kantoor_actie)updateMetLog(req,'nakijk_regels',r.id,{kantoor_actie:actie},'tekorten');
      });
      logAct('tekorten','stand',`${a.naam}: ${stand==='uit_voorraad'?'uit voorraad':'te bestellen'}${stand!==a.stand_voorstel?' (voorstel was '+a.stand_voorstel.replace('_',' ')+')':''} — ${wie(req)}`,null,null);
      return {ok:true};
    },
    besteld(req,per,a,regels,b){
      const aantal=b.aantal!=null&&b.aantal!==''?parseFloat(b.aantal):(a.bestel_voorstel||a.tekort);
      if(!(aantal>0))return {status:400,error:'Het aantal moet groter dan 0 zijn.'};
      // Aanvulling 30/10: bestellen mag altijd. Bij "uit voorraad" (of al afgehandeld) is het een extra aankoop: het aanvullen blijft uit voorraad.
      const extra=a.stand==='uit_voorraad'||a.stand==='afgehandeld'||a.stand==='binnen';
      zetBestelling(req,per,a,{stand_kantoor:extra?(a.stand==='uit_voorraad'?'uit_voorraad':''):'te_bestellen',aantal,waar_kopen:String(b.waar_kopen||'').slice(0,200),besteld_op:isoNu(),besteld_door:wie(req),binnen_op:'',binnen_door:'',extra:extra?1:0},'tekorten');
      if(!extra)openRegels(regels,a).forEach(r=>updateMetLog(req,'nakijk_regels',r.id,{kantoor_actie:BESTEL_ACTIE(r.kantoor_actie)?r.kantoor_actie:'bestellen',tekort_status:'besteld',besteld:1},'tekorten'));
      logAct('tekorten','besteld',`${a.naam}: ${fmt(aantal)} besteld${b.waar_kopen?' bij '+b.waar_kopen:''}${extra?' (extra, aanvullen blijft uit voorraad)':''} — ${wie(req)}`,null,null);
      return {ok:true};
    },
    // TF6 (T2-G13): "Bestelling binnen" vraagt een aantal (standaard wat er nog te verwachten is). De voorraad stijgt met dat aantal;
    // de rest blijft open ("3 van 5 binnen"). Pas als alles binnen is, wordt de bestelling "binnen".
    binnen(req,per,a,regels,body){
      const b0=bestellingVan(a.artikel_id,per);
      if(b0&&b0.binnen_op)return {status:409,error:'Deze bestelling is al binnen (de voorraad werd al verhoogd)'};
      if(a.stand==='afgehandeld'&&!(b0&&b0.besteld_op))return {status:409,error:'Er staat geen bestelling open voor dit artikel'};
      const best=b0;
      const totaal=best&&best.aantal?best.aantal:(a.bestel_voorstel||a.tekort);
      const eerder=(best&&best.binnen_aantal)||0,rest=Math.max(0,totaal-eerder);
      const gevraagd=body&&body.aantal!=null&&body.aantal!==''?parseFloat(body.aantal):rest;
      if(!(gevraagd>0))return {status:400,error:'Het aantal dat binnen is moet groter dan 0 zijn.'};
      if(gevraagd>rest+1e-9)return {status:409,error:`Er is nog maar ${fmt(rest)} te verwachten (besteld ${fmt(totaal)}, al binnen ${fmt(eerder)}).`};
      const n=gevraagd,nieuwBinnen=eerder+n,volledig=nieuwBinnen>=totaal-1e-9;
      const tekst=`Bestelling binnen: ${fmt(n)} × ${a.naam}${volledig?'':` (${fmt(nieuwBinnen)} van ${fmt(totaal)})`}`;
      if(best&&(best.los||best.extra)){
        updateMetLog(req,'tekort_bestellingen',best.id,{binnen_aantal:nieuwBinnen,...(volledig?{binnen_op:isoNu(),binnen_door:wie(req)}:{})},'tekorten');
        stockPlus(req,best.item_type_id,n,'tekorten: bestelling binnen',best.leveren_aan_id);
        // TF4 G4: een extra bestelling (artikel stond op "uit voorraad") zet de nakijk-regels met actie bestellen ook op binnen, anders blijft Bak klaar eeuwig op "wacht op levering".
        if(best.extra&&volledig)openRegels(regels,a).filter(r=>BESTEL_ACTIE(r.kantoor_actie)&&r.tekort_status!=='binnen').forEach(r=>updateMetLog(req,'nakijk_regels',r.id,{tekort_status:'binnen'},'tekorten'));
        logAct('tekorten','binnen',`${a.naam}: ${fmt(n)} binnen${volledig?'':` (${fmt(nieuwBinnen)} van ${fmt(totaal)})`} → voorraad ${locNaam(best.leveren_aan_id)||'Rozenweg'} — ${wie(req)}`,null,null);
        meldBinnen(req,tekst);
        return {ok:true,binnen:nieuwBinnen,totaal,volledig};
      }
      zetBestelling(req,per,a,{stand_kantoor:'te_bestellen',aantal:totaal,besteld_op:(best&&best.besteld_op)||isoNu(),besteld_door:(best&&best.besteld_door)||wie(req),binnen_aantal:nieuwBinnen,...(volledig?{binnen_op:isoNu(),binnen_door:wie(req)}:{})},'tekorten');
      meldBinnen(req,tekst);
      // Zelfde logica als POST /api/nakijken/regel/:id/binnen (G15): tekort_status 'binnen' → de aanvullijst-handeling wordt afvinkbaar.
      // Deels binnen: het binnengekomen aantal wordt over de open regels verdeeld; een regel is "binnen" als zijn eigen aantal gedekt is.
      let over=n;
      openRegels(regels,a).forEach(r=>{
        const v={};if(!BESTEL_ACTIE(r.kantoor_actie))v.kantoor_actie='bestellen';
        const totR=(r.kantoor_aantal||0)+(r.gedaan_aantal||0),nodig=Math.max(0,totR-(r.binnen_aantal||0)),geef=volledig?nodig:Math.min(nodig,over);
        over-=geef;
        if(geef>0||volledig)v.binnen_aantal=(r.binnen_aantal||0)+geef;
        if(volledig||(r.binnen_aantal||0)+geef>=totR-1e-9)v.tekort_status='binnen';
        if(Object.keys(v).length)updateMetLog(req,'nakijk_regels',r.id,v,'tekorten');
      });
      stockPlus(req,a.item_type_id,n,'tekorten: bestelling binnen');
      logAct('tekorten','binnen',`${a.naam}: ${fmt(n)} binnen${volledig?'':` (${fmt(nieuwBinnen)} van ${fmt(totaal)})`} → voorraad Rozenweg — ${wie(req)}`,null,null);
      return {ok:true,binnen:nieuwBinnen,totaal,volledig};
    },
    negeren(req,per,a,regels,b){
      const reden=String(b.reden||'').trim().slice(0,300);
      openRegels(regels,a).forEach(r=>updateMetLog(req,'nakijk_regels',r.id,{tekort_status:'genegeerd',kantoor_notitie:[r.kantoor_notitie,reden?'genegeerd: '+reden:'genegeerd'].filter(Boolean).join(' · ')},'tekorten'));
      logAct('tekorten','negeren',`${a.naam}: genegeerd${reden?' ('+reden+')':''} — ${wie(req)}`,null,null);
      return {ok:true};
    }
  };
  function doe(soort,req,artikelIds){
    const per=periodeVan(parseInt(req.query.periode_id||req.body?.periode_id));
    const {lijst,regels}=artikels(per);
    const gedaan=[],fouten=[],res=[];
    artikelIds.forEach(id=>{
      const a=lijst.find(x=>x.artikel_id===String(id));
      if(!a){fouten.push({artikel_id:id,error:'niet gevonden'});return;}
      const r=ACTIE[soort](req,per,a,regels,req.body||{});
      if(r.error)fouten.push({artikel_id:id,status:r.status,error:r.error});else{gedaan.push(id);res.push(r);}
    });
    return {gedaan,fouten,res};
  }
  app.put('/api/tekorten/:artikel_id/stand',kantoorOfCoord,(req,res)=>{const r=doe('stand',req,[req.params.artikel_id]);if(r.fouten.length)return res.status(r.fouten[0].status||404).json({error:r.fouten[0].error});res.json({ok:true});});
  ['besteld','binnen','negeren'].forEach(soort=>{
    const mag=soort==='negeren'?alleenKantoor:kantoorOfCoord;
    app.post(`/api/tekorten/bulk/${soort}`,mag,(req,res)=>{
      const ids=Array.isArray(req.body?.artikel_ids)?req.body.artikel_ids:[];
      if(!ids.length)return res.status(400).json({error:'Kies eerst een of meer artikels.'});
      res.json({ok:true,...doe(soort,req,ids)});
    });
    app.post(`/api/tekorten/:artikel_id/${soort}`,mag,(req,res)=>{const r=doe(soort,req,[req.params.artikel_id]);if(r.fouten.length)return res.status(r.fouten[0].status||404).json({error:r.fouten[0].error});res.json({...(r.res[0]||{}),ok:true});});
  });
  // Bulk "Op bestellijst" = stand te bestellen.
  app.post('/api/tekorten/bulk/stand',kantoorOfCoord,(req,res)=>{
    const ids=Array.isArray(req.body?.artikel_ids)?req.body.artikel_ids:[];
    if(!ids.length)return res.status(400).json({error:'Kies eerst een of meer artikels.'});
    res.json({ok:true,...doe('stand',req,ids)});
  });

  // + Tekort melden: een goedgekeurde regel op naam van kantoor (eigen sessie, meteen nagekeken → ook op de aanvullijst als er een bak is).
  app.post('/api/tekorten/melden',alleenKantoor,(req,res)=>{
    const b=req.body||{};
    const t=b.item_type_id?get('SELECT * FROM item_types WHERE id=?',[b.item_type_id]):null;
    const naam=t?t.naam:String(b.naam||'').trim();
    const aantal=parseFloat(b.aantal);
    if(!naam)return res.status(400).json({error:'Kies of typ een artikel.'});
    if(!(aantal>0))return res.status(400).json({error:'Het aantal moet groter dan 0 zijn.'});
    const bak=b.bak_id?get('SELECT * FROM bakken WHERE id=?',[b.bak_id]):null;
    const item=bak?get('SELECT * FROM bak_items WHERE bak_id=? AND (item_type_id=? OR lower(naam)=lower(?)) ORDER BY id LIMIT 1',[bak.id,t?t.id:-1,naam]):null;
    const locId=parseInt(b.locatie_id)||(bak?bak.huidige_locatie_id:null)||null;
    const per=periodeVan();
    const km=locId&&per?get('SELECT * FROM kampmomenten WHERE locatie_id=? AND periode_id=? ORDER BY week LIMIT 1',[locId,per.id]):null;
    const reden=String(b.reden||'').trim().slice(0,300);
    const sid=insMetLog(req,'nakijk_sessies',['bak_type','thema_bak_id','vaste_bak_id','locatie_id','week','datum','kv_wie','kv_tijdstip','kv_status','kantoor_wie','kantoor_tijdstip','kantoor_status','kantoor_afgerond_op','kantoor_door','kampmoment_id','notities'],
      [bak?(bak.soort==='thema'?'thema':'vast'):'melding',bak&&bak.soort==='thema'?bak.id:null,bak&&bak.soort!=='thema'?bak.id:null,locId,km?km.week:null,isoLokaal(new Date()),wie(req),now(),'ingediend',wie(req),now(),'nagekeken',isoNu(),wie(req),km?km.id:null,'kantoor-melding'],'tekorten');
    const rid=insMetLog(req,'nakijk_regels',['sessie_id','item_naam','item_id','verwacht','aangetroffen','ontbreekt','notitie','kantoor_actie','kantoor_aantal','kantoor_notitie','tekort_status'],
      [sid,naam,item?item.id:null,aantal,0,aantal,reden,'uit_pool',aantal,reden?'gemeld door kantoor: '+reden:'gemeld door kantoor','open'],'tekorten');
    logAct('tekorten','gemeld',`Tekort gemeld door ${wie(req)}: ${fmt(aantal)} ${naam}${bak?' ('+(bak.code||bak.naam)+')':''}${reden?' — '+reden:''}`,locId,locNaam(locId));
    res.json({ok:true,regel_id:rid,sessie_id:sid,artikel_id:t?String(t.id):(regelsVan(null).find(r=>r.id===rid)||{}).artikel_id});
  });

  // + Bestelling zonder tekort (aanvulling 30/10): artikel uit de catalogus, aantal, waar kopen, leveren aan, reden. Hangt niet aan een melding.
  app.post('/api/tekorten/bestelling',kantoorOfCoord,(req,res)=>{
    const b=req.body||{};
    const t=b.item_type_id?get('SELECT * FROM item_types WHERE id=?',[b.item_type_id]):null;
    const naam=t?t.naam:String(b.naam||'').trim(),aantal=parseFloat(b.aantal);
    if(!naam)return res.status(400).json({error:'Kies een artikel uit de catalogus.'});
    if(!(aantal>0))return res.status(400).json({error:'Het aantal moet groter dan 0 zijn.'});
    const naar=parseInt(b.leveren_aan_id)||(stockage('Rozenweg')||{}).id||null;
    const per=periodeVan();
    const v={artikel_sleutel:t?String(t.id):'n:'+norm(naam),periode_id:per?per.id:0,naam,item_type_id:t?t.id:null,created_at:now(),los:1,aantal,waar_kopen:String(b.waar_kopen||'').slice(0,200),
      leveren_aan_id:naar,reden:String(b.reden||'').slice(0,300),besteld_op:isoNu(),besteld_door:wie(req),stand_kantoor:'te_bestellen'};
    const id=insMetLog(req,'tekort_bestellingen',Object.keys(v),Object.values(v),'tekorten');
    logAct('tekorten','bestelling',`Bestelling zonder tekort: ${fmt(aantal)} ${naam}${v.waar_kopen?' bij '+v.waar_kopen:''} → ${locNaam(naar)}${v.reden?' ('+v.reden+')':''} — ${wie(req)}`,naar,locNaam(naar));
    res.json({ok:true,artikel_id:'b:'+id});
  });

  // ── Bestellijst (te bestellen + besteld maar nog niet binnen) ──
  function bestellijst(per){
    const {lijst}=artikels(per);
    const rijen=lijst.filter(a=>a.stand==='te_bestellen'||a.stand==='besteld'||(a.bestelling&&a.bestelling.besteld_op&&!a.bestelling.binnen_op)).map(a=>({artikel_id:a.artikel_id,naam:a.naam,eenheid:a.eenheid,stand:a.stand,
      aantal:a.bestelling&&a.bestelling.aantal?a.bestelling.aantal:a.bestel_voorstel,waar_kopen:a.bestelling?a.bestelling.waar_kopen:'',besteld_op:a.bestelling?a.bestelling.besteld_op:'',tekort:a.tekort,waar_tekst:a.waar_tekst}));
    return {periode:per?{id:per.id,naam:per.naam}:null,datum:isoLokaal(new Date()),artikels:rijen};
  }
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  // A4-printpagina, ook leesbaar op gsm (in de winkel): één kaart per artikel, groot aantal, vinkvak.
  function bestellijstHtml(B){
    return `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bestellijst — Sporty logistiek</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#1a1a1a;background:#fff;padding:16px;max-width:820px;margin:0 auto}
h1{font-size:22px;font-weight:800;color:#1e3a8a}.sub{font-size:13px;color:#64748b;margin:4px 0 14px}.knoppen{display:flex;gap:8px;margin-bottom:14px}.knoppen button,.knoppen a{min-height:44px;padding:0 16px;border-radius:8px;border:0;background:#2563eb;color:#fff;font:inherit;font-weight:700;display:inline-flex;align-items:center;text-decoration:none}.knoppen a{background:#f1f5f9;color:#1e3a8a}
.r{display:grid;grid-template-columns:36px 1fr auto;gap:12px;align-items:center;padding:12px 4px;border-bottom:1px solid #e2e8f0;break-inside:avoid}
.vak{width:28px;height:28px;border:2px solid #334155;border-radius:6px}.nm{font-size:16px;font-weight:700;line-height:1.3}.nm b{display:block;font-size:13px;font-weight:500;color:#64748b}
.n{font-size:22px;font-weight:800;text-align:right;white-space:nowrap}.n small{display:block;font-size:11px;font-weight:600;color:#64748b}.pil{font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:#dbeafe;color:#1d4ed8}
.leeg{padding:30px 0;color:#64748b}@media print{.knoppen{display:none}body{padding:0}}</style></head><body>
<h1>Bestellijst</h1><div class="sub">${esc(B.periode?B.periode.naam:'')} · ${esc(B.datum)} · ${B.artikels.length} artikel${B.artikels.length===1?'':'s'} · leveren aan Rozenweg</div>
<div class="knoppen"><button onclick="print()">🖨 Afdrukken</button><a href="/tekorten">‹ Tekorten</a></div>
${B.artikels.map(a=>`<div class="r"><span class="vak"></span><div class="nm">${esc(a.naam)}${a.stand==='besteld'?' <span class="pil">📦 besteld</span>':''}<b>${esc([a.waar_kopen?'bij '+a.waar_kopen:'',a.tekort?`tekort ${fmt(a.tekort)} · ${a.waar_tekst}`:a.waar_tekst].filter(Boolean).join(' · '))}</b></div><div class="n">${fmt(a.aantal)}<small>${esc(a.eenheid||'stuk')}</small></div></div>`).join('')||'<div class="leeg">Niets te bestellen.</div>'}
</body></html>`;
  }
  ctx._tekortenBestellijstHtml=bestellijstHtml;
  // Pagina's: buiten /api/ zet de auth-poort req.persoon niet. Een browser-navigatie (of window.open) stuurt geen token mee: dan opent
  // de pagina (de basic-auth-buitenmuur blijft); met een token van een andere rol dan kantoor/coördinator → 403.
  const paginaRol=(req,res,next)=>{const tk=req.headers['x-auth-token']||'';if(!tk)return next();req.persoon=ctx.checkSessie(tk);if(!req.persoon)return res.status(401).send('Niet ingelogd');return kantoorOfCoord(req,res,next);};
  app.get('/tekorten/bestellijst',paginaRol,(req,res)=>res.type('html').send(bestellijstHtml(bestellijst(periodeVan(parseInt(req.query.periode_id))))));
  app.get('/tekorten',paginaRol,(req,res)=>res.sendFile(ctx.path.join(ctx.ROOT_DIR,'public','tekorten.html')));
};
