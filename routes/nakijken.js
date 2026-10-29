// routes/nakijken.js — VC1: kantoor-spiegel van het KV-telscherm (Voorraad & controles › Nakijken) en de aanvullijst voor de Rozenweg.
// Databronnen: nakijk_sessies/nakijk_regels (KV1: te_veel, kapot_aantal, notitie, foto_path) + de verwachte bakken van het kampmoment
// (_kvVerwacht). Pagina's: /nakijken (alleen kantoor) en /aanvullijst-print (ingelogd). De gsm-versie van de aanvullijst gebruikt dezelfde API.
'use strict';
module.exports = function(ctx){
  const {app,get,all,run,ins,now,logAct,updateMetLog,insMetLog,alleenKantoor,_kvVerwacht,_kvNaam,_bakItems,path,ROOT_DIR} = ctx;
  const fotos=require('../lib/fotos')(ctx.UPLOADS_DIR);

  const ACTIES={
    tekort:[['bestellen','Bestellen'],['uit_pool','Uit pool aanvullen'],['aanvaarden','Aanvaarden']],
    te_veel:[['naar_pool','Terug naar pool'],['laten_staan','Laten staan']],
    kapot:[['afschrijven_bestellen','Afschrijven + bestellen'],['herstellen','Herstellen'],['aanvaarden','Aanvaarden']]
  };
  const ALLE_ACTIES=['','bestellen','uit_pool','aanvaarden','naar_pool','laten_staan','afschrijven_bestellen','herstellen'];
  const isoLokaal=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const d12=s=>new Date(s+'T12:00:00');
  const plusDagen=(s,n)=>{const d=d12(s);d.setDate(d.getDate()+n);return isoLokaal(d);};
  const isoNu=()=>{const d=new Date();return `${isoLokaal(d)} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;};
  const wie=req=>(req.persoon&&req.persoon.naam)||'';
  // now() ("29/10/2026, 16:54"), ISO-met-T of "YYYY-MM-DD HH:MM" → "YYYY-MM-DD HH:MM" (sorteerbaar), anders ''.
  function _ts(ts){
    let m=/(\d{1,2})\/(\d{1,2})\/(\d{4})\D+(\d{1,2}):(\d{2})/.exec(ts||'');
    if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')} ${m[4].padStart(2,'0')}:${m[5]}`;
    m=/(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(ts||'');
    return m?`${m[1]} ${m[2]}`:'';
  }
  const _rek=code=>{const m=/^([A-Za-z])/.exec(code||'');return m?m[1].toUpperCase():'';};
  // MA1: echte plaats uit bakken.rek/plank (werklijst 82); zonder rek de oude afleiding uit de code.
  const _plaats=bak=>{const rek=(bak.rek||'')||_rek(bak.code),plank=bak.plank||'';
    return {rek,plank,tekst:[rek?'rek '+rek:'',plank?'plank '+plank:''].filter(Boolean).join(' · ')};};

  // Maandag van een kampweek: periode.start_datum + (week-1)*7 dagen.
  function _maandag(km){
    const per=km.periode_id?get('SELECT * FROM vakantieperiodes WHERE id=?',[km.periode_id]):null;
    return per&&per.start_datum&&km.week?plusDagen(per.start_datum,(km.week-1)*7):null;
  }
  // Kampmomenten van de week waarin `datum` valt; zonder treffer (en zonder expliciete ?week) het dichtstbijzijnde week met kampmomenten.
  function _kampmomentenVanWeek(datum,expliciet){
    const kms=all('SELECT * FROM kampmomenten').map(km=>({km,ma:_maandag(km)})).filter(x=>x.ma);
    const rond=d=>kms.filter(x=>x.ma<=d&&d<=plusDagen(x.ma,6));
    let gekozen=rond(datum),fallback=false;
    if(!gekozen.length&&!expliciet&&kms.length){
      const sort=kms.slice().sort((a,b)=>Math.abs(d12(a.ma)-d12(datum))-Math.abs(d12(b.ma)-d12(datum)));
      const ma=sort[0].ma;gekozen=kms.filter(x=>x.ma===ma);fallback=true;
    }
    const ma=gekozen[0]?gekozen[0].ma:null;
    return {kms:gekozen.map(x=>x.km),maandag:ma,fallback};
  }

  // Alle regels van één bak in één sessie samenvatten.
  function _afwijking(r,gewenst){
    if(!r||r.aangetroffen==null)return 'niet_geteld';
    if(r.aangetroffen<gewenst)return 'tekort';
    if((r.kapot_aantal||0)>0)return 'kapot';
    if(r.aangetroffen>gewenst)return 'te_veel';
    return 'klopt';
  }
  function _uitslag(items,regels){
    const geteld=items.filter(it=>{const r=regels.find(x=>x.item_id===it.id);return r&&r.aangetroffen!=null;}).length;
    let tekort=0,teVeel=0,kapot=0;
    items.forEach(it=>{
      const r=regels.find(x=>x.item_id===it.id);
      if(!r||r.aangetroffen==null)return;
      if(r.aangetroffen<it.qty)tekort++;
      else if(r.aangetroffen>it.qty)teVeel++;
      if((r.kapot_aantal||0)>0)kapot++;
    });
    const niet=items.length-geteld;
    if(geteld===0)return {geteld,tekort,teVeel,kapot,tekst:'niet geteld'};
    const delen=[];
    if(tekort)delen.push('tekort '+tekort);if(teVeel)delen.push('te veel '+teVeel);if(kapot)delen.push('kapot '+kapot);
    if(niet)delen.push(niet+' niet geteld');
    return {geteld,tekort,teVeel,kapot,tekst:delen.length?delen.join(' · '):'✓ alles klopt'};
  }
  function _sessieVan(km,bak){
    if(bak.soort==='attribuut')return get("SELECT * FROM nakijk_sessies WHERE bak_type='attribuut' AND attribuut_id=? AND kampmoment_id=? AND kv_status IN ('bezig','ingediend') ORDER BY id DESC",[bak.id,km.id]);
    const veld=bak.soort==='thema'?'thema_bak_id':'vaste_bak_id';
    return get(`SELECT * FROM nakijk_sessies WHERE bak_type=? AND ${veld}=? AND kampmoment_id=? AND kv_status IN ('bezig','ingediend') ORDER BY id DESC`,[bak.soort,bak.id,km.id]);
  }
  const _nagekeken=s=>!!s&&(['nagekeken','verwerkt'].includes(s.kantoor_status)||!!s.kantoor_afgerond_op);
  const _locNaam=id=>id?((get('SELECT name FROM locaties WHERE id=?',[id])||{}).name||''):'';

  // Eén lijstrij (bak of attribuut) van een kampmoment.
  function _rij(km,bak){
    const loc=_locNaam(km.locatie_id),kvNaam=_kvNaam(km);
    const sessie=_sessieVan(km,bak);
    let geteld=0,totaal=1,tekst='niet geteld',tekort=0,kapot=0;
    if(bak.soort==='attribuut'){
      const st=sessie?sessie.notities:'';
      if(st==='aanwezig'){geteld=1;tekst='✓ alles klopt';}
      else if(st==='beschadigd'){geteld=1;tekst='kapot';kapot=1;}
    }else{
      const items=_bakItems(bak),regels=sessie?all('SELECT * FROM nakijk_regels WHERE sessie_id=?',[sessie.id]):[];
      const u=_uitslag(items,regels);geteld=u.geteld;totaal=items.length;tekst=u.tekst;tekort=u.tekort;kapot=u.kapot;
      if(sessie&&sessie.kv_status==='bezig'&&geteld>0)tekst='KV is bezig · '+geteld+'/'+totaal+' geteld';
    }
    let status='niet_geteld';
    if(sessie&&_nagekeken(sessie))status='nagekeken';
    else if(sessie&&sessie.kv_status==='ingediend'&&geteld>0)status='te_keuren';
    return {sessie_id:sessie?sessie.id:null,kampmoment_id:km.id,locatie:loc,week:km.week,kv_naam:kvNaam,
      bak:{id:bak.id,code:bak.code||'',naam:bak.naam||bak.label||'',soort:bak.soort},geteld,totaal,uitslag_tekst:tekst,
      met_tekort:tekort>0,met_kapot:kapot>0,status,
      ingediend_op:sessie&&sessie.kv_status==='ingediend'?(sessie.kv_tijdstip||''):'',nagekeken_op:sessie&&_nagekeken(sessie)?(sessie.kantoor_afgerond_op||sessie.kantoor_tijdstip||''):''};
  }

  app.get('/api/nakijken',alleenKantoor,(req,res)=>{
    const datum=/^\d{4}-\d{2}-\d{2}$/.test(req.query.week||'')?req.query.week:isoLokaal(new Date());
    const {kms,maandag,fallback}=_kampmomentenVanWeek(datum,!!req.query.week);
    const bakken=[];
    kms.forEach(km=>{
      const v=_kvVerwacht(km);
      v.bakken.forEach(b=>bakken.push(_rij(km,b)));
      v.attributen.forEach(a=>bakken.push(_rij(km,{...a,soort:'attribuut'})));
    });
    const tellers={te_keuren:0,niet_geteld:0,met_tekort:0,met_kapot:0,nagekeken:0};
    bakken.forEach(b=>{
      if(b.status==='te_keuren')tellers.te_keuren++;
      if(b.status==='niet_geteld')tellers.niet_geteld++;
      if(b.status==='nagekeken')tellers.nagekeken++;
      if(b.met_tekort)tellers.met_tekort++;
      if(b.met_kapot)tellers.met_kapot++;
    });
    const periode=kms[0]&&kms[0].periode_id?get('SELECT id,naam FROM vakantieperiodes WHERE id=?',[kms[0].periode_id]):null;
    res.json({week:{maandag,van:maandag,tot:maandag?plusDagen(maandag,4):null,weeknummer:kms[0]?kms[0].week:null,fallback},periode,tellers,bakken});
  });

  // Detail van één bak: ?sessie=ID (via pad) of ?kampmoment_id=&bak=<soort>:<id> voor een bak zonder sessie.
  function _detail(km,bak,sessie){
    const loc=_locNaam(km.locatie_id),kvNaam=_kvNaam(km);
    const kvP=km.kv_persoon_id?get('SELECT telefoon FROM personeel WHERE id=?',[km.kv_persoon_id]):null;
    const rij=_rij(km,bak);
    let items=[];
    if(bak.soort==='attribuut'){
      const st=sessie?sessie.notities:'';
      // TB1: een beschadigd attribuut heeft een nakijk-regel (door de KV-route aangemaakt) waaraan kantoor een actie hangt.
      const ar=sessie&&st==='beschadigd'?get('SELECT * FROM nakijk_regels WHERE sessie_id=? AND item_naam=?',[sessie.id,bak.naam]):null;
      items=[{regel_id:ar?ar.id:null,naam:bak.naam,verwacht:1,aangetroffen:st?1:null,te_veel:0,kapot_aantal:st==='beschadigd'?1:0,notitie:'',foto_url:null,
        afwijking:!st?'niet_geteld':st==='beschadigd'?'kapot':'klopt',kantoor_actie:ar?(ar.kantoor_actie||''):'',kantoor_aantal:ar&&ar.kantoor_aantal?ar.kantoor_aantal:(st==='beschadigd'?1:0),kantoor_notitie:ar?(ar.kantoor_notitie||''):'',
        aangevuld:ar?(ar.aangevuld||0):0,aantal_afwijking:st==='beschadigd'?1:0,
        acties:st==='beschadigd'?ACTIES.kapot.map(([waarde,label])=>({waarde,label})):[]}];
    }else{
      const regels=sessie?all('SELECT * FROM nakijk_regels WHERE sessie_id=?',[sessie.id]):[];
      items=_bakItems(bak).map(it=>{
        const r=regels.find(x=>x.item_id===it.id);
        const afw=_afwijking(r,it.qty);
        const aantal=afw==='tekort'?it.qty-r.aangetroffen:afw==='te_veel'?r.aangetroffen-it.qty:afw==='kapot'?(r.kapot_aantal||0):0;
        const opties=ACTIES[afw]||[];
        return {regel_id:r?r.id:null,naam:it.naam,verwacht:it.qty,aangetroffen:r&&r.aangetroffen!=null?r.aangetroffen:null,te_veel:r&&r.aangetroffen>it.qty?r.aangetroffen-it.qty:0,
          kapot_aantal:r?(r.kapot_aantal||0):0,notitie:r?(r.notitie||''):'',foto_url:r&&r.foto_path?'/uploads/'+r.foto_path:null,afwijking:afw,
          kantoor_actie:r?(r.kantoor_actie||''):'',kantoor_aantal:r&&r.kantoor_aantal?r.kantoor_aantal:aantal,kantoor_notitie:r?(r.kantoor_notitie||''):'',
          aangevuld:r?(r.aangevuld||0):0,aantal_afwijking:aantal,
          acties:opties.map(([waarde,label])=>({waarde,label}))};
      });
    }
    // Vorige tellingen van dezelfde bak in andere kampmomenten.
    const veld=bak.soort==='attribuut'?'attribuut_id':bak.soort==='thema'?'thema_bak_id':'vaste_bak_id';
    const andere=all(`SELECT * FROM nakijk_sessies WHERE bak_type=? AND ${veld}=? ${sessie?'AND id<>?':''} ORDER BY id DESC LIMIT 12`,sessie?[bak.soort,bak.id,sessie.id]:[bak.soort,bak.id]);
    const vorige=andere.map(s=>{
      const k2=s.kampmoment_id?get('SELECT * FROM kampmomenten WHERE id=?',[s.kampmoment_id]):null;
      let tekst='';
      if(bak.soort==='attribuut')tekst=s.notities==='aanwezig'?'✓ alles klopt':s.notities==='beschadigd'?'kapot':'niet geteld';
      else tekst=_uitslag(_bakItems(bak),all('SELECT * FROM nakijk_regels WHERE sessie_id=?',[s.id])).tekst;
      return {sessie_id:s.id,datum:s.kv_tijdstip||s.datum||'',locatie:k2?_locNaam(k2.locatie_id):_locNaam(s.locatie_id),week:k2?k2.week:s.week,uitslag:tekst,kv_naam:s.kv_wie||''};
    });
    // Historiek: telling + afwijkingen (KV), wijzigingen op regels/sessie, rit-checks laden/lossen van deze bak.
    const hist=[];
    if(sessie){
      const totaal=rij.totaal;
      if(sessie.kv_status==='ingediend')hist.push({tekst:`telling ingediend (${rij.geteld}/${totaal})`,wie:sessie.kv_wie?'KV '+sessie.kv_wie:'KV',sorteer:_ts(sessie.kv_tijdstip),tijd:sessie.kv_tijdstip||''});
      items.forEach(it=>{
        if(it.kapot_aantal>0)hist.push({tekst:`${it.naam.toLowerCase()}: ${it.kapot_aantal} kapot${it.foto_url?' + foto':''}`,wie:sessie.kv_wie?'KV '+sessie.kv_wie:'KV',sorteer:_ts(sessie.kv_tijdstip),tijd:sessie.kv_tijdstip||''});
      });
      const regelIds=items.map(i=>i.regel_id).filter(Boolean);
      const wz=all(`SELECT * FROM wijzigingen WHERE (tabel='nakijk_sessies' AND rij_id=?) ${regelIds.length?`OR (tabel='nakijk_regels' AND rij_id IN (${regelIds.map(()=>'?').join(',')}))`:''} ORDER BY id DESC LIMIT 80`,[sessie.id,...regelIds]);
      wz.forEach(w=>{
        let nieuw=null,oud=null;try{nieuw=JSON.parse(w.nieuw||'null');oud=JSON.parse(w.oud||'null');}catch(e){}
        if(w.context==='kv-link'&&w.tabel==='nakijk_regels'&&nieuw){
          // GF1: de tellingen van de KV staan in de log (wie = de KV) en dus in de historiek.
          const nm=String(nieuw.item_naam||'stuk').toLowerCase();
          const tekst=nieuw.aangetroffen==null?`${nm}: niet geteld`:oud&&oud.aangetroffen!=null&&oud.aangetroffen!==nieuw.aangetroffen?`${nm}: geteld ${oud.aangetroffen} → ${nieuw.aangetroffen}`:`${nm}: geteld ${nieuw.aangetroffen}${nieuw.kapot_aantal>0?` (${nieuw.kapot_aantal} kapot)`:''}`;
          hist.push({tekst,wie:w.persoon_naam||'KV',sorteer:_ts(w.tijdstip),tijd:w.tijdstip});
        }
        else if(w.context==='kv-link'&&w.tabel==='nakijk_sessies'&&nieuw&&nieuw.kv_status==='ingediend'&&(!oud||oud.kv_status!=='ingediend'))
          hist.push({tekst:'telling verstuurd door de KV',wie:w.persoon_naam||'KV',sorteer:_ts(w.tijdstip),tijd:w.tijdstip});
        else if(w.tabel==='nakijk_regels'&&nieuw&&oud&&nieuw.kantoor_actie!==oud.kantoor_actie)
          hist.push({tekst:`${(nieuw.item_naam||'stuk').toLowerCase()}: actie ${nieuw.kantoor_actie||'(leeg)'}`,wie:w.persoon_naam||'kantoor',sorteer:_ts(w.tijdstip),tijd:w.tijdstip});
        else if(w.tabel==='nakijk_sessies'&&nieuw&&nieuw.kantoor_status==='nagekeken')
          hist.push({tekst:'keuring afgerond',wie:w.persoon_naam||'kantoor',sorteer:_ts(w.tijdstip),tijd:w.tijdstip});
        else if(w.tabel==='nakijk_regels'&&nieuw&&oud&&nieuw.aangevuld!==oud.aangevuld)
          hist.push({tekst:`${(nieuw.item_naam||'stuk').toLowerCase()}: ${nieuw.aangevuld?'aangevuld':'aangevuld teruggezet'}`,wie:w.persoon_naam||'',sorteer:_ts(w.tijdstip),tijd:w.tijdstip});
      });
    }
    if(bak.soort!=='attribuut'){
      const ck=all('SELECT * FROM verhuis_checks WHERE bak_id=? ORDER BY id DESC LIMIT 20',[bak.id]);
      ck.forEach(c=>{
        const rit=c.rit_id?get('SELECT chauffeur FROM transport_ritten WHERE id=?',[c.rit_id]):null;
        const who=`${(rit&&rit.chauffeur)||c.geladen_door||'chauffeur'} (rit #${c.rit_id})`;
        if(c.geladen_op)hist.push({tekst:'bak geladen in Rozenweg',wie:who,sorteer:_ts(c.geladen_op),tijd:c.geladen_op});
        if(c.gelost_op)hist.push({tekst:'bak gelost op '+loc,wie:who,sorteer:_ts(c.gelost_op),tijd:c.gelost_op});
      });
    }
    hist.sort((a,b)=>(b.sorteer||'').localeCompare(a.sorteer||''));
    const fotoUrls=items.filter(i=>i.foto_url).map(i=>({url:i.foto_url,stuk:i.naam}));
    return {sessie_id:sessie?sessie.id:null,kampmoment_id:km.id,locatie:loc,week:km.week,maandag:_maandag(km),
      bak:rij.bak,geteld:rij.geteld,totaal:rij.totaal,uitslag_tekst:rij.uitslag_tekst,status:rij.status,
      kv_naam:kvNaam,ingediend_op:rij.ingediend_op,nagekeken_op:rij.nagekeken_op,
      afwijkingen:{tekort:items.filter(i=>i.afwijking==='tekort').length,te_veel:items.filter(i=>i.afwijking==='te_veel').length,kapot:items.filter(i=>i.kapot_aantal>0||i.afwijking==='kapot').length},
      items,foto_s:fotoUrls,vorige_tellingen:vorige,historiek:hist.map(({sorteer,...h})=>h),
      contact:{kv_naam:kvNaam,kv_telefoon:(kvP&&kvP.telefoon)||''}};
  }
  // Bak uit "soort:id" voor een bak zonder sessie.
  function _bakUit(km,sleutel){
    const m=/^(thema|vast|attribuut):(\d+)$/.exec(sleutel||'');if(!m)return null;
    const v=_kvVerwacht(km);
    if(m[1]==='attribuut'){const a=v.attributen.find(x=>x.id===+m[2]);return a?{...a,soort:'attribuut'}:null;}
    return v.bakken.find(b=>b.soort===m[1]&&b.id===+m[2])||null;
  }
  app.get('/api/nakijken/sessie/:id',alleenKantoor,(req,res)=>{
    const s=get('SELECT * FROM nakijk_sessies WHERE id=?',[req.params.id]);
    if(!s)return res.status(404).json({error:'Deze telling bestaat niet (meer).'});
    const km=s.kampmoment_id?get('SELECT * FROM kampmomenten WHERE id=?',[s.kampmoment_id]):null;
    if(!km)return res.status(404).json({error:'Deze telling hoort niet bij een kampmoment.'});
    let bak=null;
    if(s.bak_type==='attribuut'){const a=get('SELECT * FROM attributen WHERE id=?',[s.attribuut_id]);bak=a?{...a,soort:'attribuut'}:null;}
    else bak=get('SELECT * FROM bakken WHERE id=?',[s.bak_type==='thema'?s.thema_bak_id:s.vaste_bak_id]);
    if(!bak)return res.status(404).json({error:'De bak van deze telling bestaat niet meer.'});
    res.json(_detail(km,bak,s));
  });
  app.get('/api/nakijken/bak',alleenKantoor,(req,res)=>{
    const km=get('SELECT * FROM kampmomenten WHERE id=?',[parseInt(req.query.kampmoment_id)||0]);
    if(!km)return res.status(404).json({error:'Kampmoment niet gevonden'});
    const bak=_bakUit(km,req.query.bak);
    if(!bak)return res.status(404).json({error:'Deze bak hoort niet bij dit kampmoment'});
    res.json(_detail(km,bak,_sessieVan(km,bak)));
  });

  app.put('/api/nakijken/regel/:id',alleenKantoor,(req,res)=>{
    const r=get('SELECT * FROM nakijk_regels WHERE id=?',[req.params.id]);
    if(!r)return res.status(404).json({error:'Deze regel bestaat niet (meer).'});
    const b=req.body||{};
    const actie=b.kantoor_actie===undefined?r.kantoor_actie:String(b.kantoor_actie||'');
    if(!ALLE_ACTIES.includes(actie))return res.status(400).json({error:'Onbekende actie: '+actie});
    const aantal=b.kantoor_aantal===undefined?(r.kantoor_aantal||0):parseFloat(b.kantoor_aantal);
    if(isNaN(aantal)||aantal<0)return res.status(400).json({error:'Het aantal moet 0 of meer zijn.'});
    const notitie=b.kantoor_notitie===undefined?(r.kantoor_notitie||''):String(b.kantoor_notitie||'').slice(0,500);
    updateMetLog(req,'nakijk_regels',r.id,{kantoor_actie:actie,kantoor_aantal:aantal,kantoor_notitie:notitie},'nakijken');
    res.json(get('SELECT * FROM nakijk_regels WHERE id=?',[r.id]));
  });

  // Keuring afronden: standaardactie per afwijking invullen, sessie op nagekeken, bestellen → bestaande "besteld"-markering.
  function _afronden(req,s){
    const km=s.kampmoment_id?get('SELECT * FROM kampmomenten WHERE id=?',[s.kampmoment_id]):null;
    let bak=null;
    if(s.bak_type==='attribuut')bak=get('SELECT * FROM attributen WHERE id=?',[s.attribuut_id]);
    else bak=get('SELECT * FROM bakken WHERE id=?',[s.bak_type==='thema'?s.thema_bak_id:s.vaste_bak_id]);
    const items=bak&&s.bak_type!=='attribuut'?_bakItems(bak):[];
    let bestel=0,afschrijf=0;
    all('SELECT * FROM nakijk_regels WHERE sessie_id=?',[s.id]).forEach(r=>{
      const it=items.find(x=>x.id===r.item_id);
      const afw=_afwijking(r,it?it.qty:(r.verwacht||0));
      let actie=r.kantoor_actie||'';
      let aantal=r.kantoor_aantal||0;
      if(!actie&&ACTIES[afw]){
        actie=ACTIES[afw][0][0];
        aantal=afw==='tekort'?(r.verwacht||0)-r.aangetroffen:afw==='te_veel'?r.aangetroffen-(r.verwacht||0):(r.kapot_aantal||0);
        updateMetLog(req,'nakijk_regels',r.id,{kantoor_actie:actie,kantoor_aantal:aantal},'nakijken');
      }
      if(actie==='bestellen'||actie==='afschrijven_bestellen'){
        // Bestaande tekorten/bestel-logica (routes/voorraad.js): tekort_status 'besteld' + besteld=1.
        updateMetLog(req,'nakijk_regels',r.id,{besteld:1,tekort_status:'besteld'},'nakijken');bestel++;
      }
      if(actie==='afschrijven_bestellen')afschrijf++;
    });
    updateMetLog(req,'nakijk_sessies',s.id,{kantoor_status:'nagekeken',kantoor_afgerond_op:isoNu(),kantoor_door:wie(req),kantoor_wie:wie(req),kantoor_tijdstip:now()},'nakijken');
    logAct('nakijken','afgerond',`Keuring afgerond: ${(bak&&(bak.code||bak.naam))||'bak'} · ${km?_locNaam(km.locatie_id):''} (${bestel} bestelling${bestel===1?'':'en'}, ${afschrijf} afschrijving${afschrijf===1?'':'en'}) door ${wie(req)||'kantoor'}`,km?km.locatie_id:null,km?_locNaam(km.locatie_id):null);
    return {sessie_id:s.id,bestellingen:bestel,afschrijvingen:afschrijf};
  }
  app.post('/api/nakijken/sessie/:id/afronden',alleenKantoor,(req,res)=>{
    const s=get('SELECT * FROM nakijk_sessies WHERE id=?',[req.params.id]);
    if(!s)return res.status(404).json({error:'Deze telling bestaat niet (meer).'});
    if(s.kv_status!=='ingediend')return res.status(409).json({error:'De kampverantwoordelijke heeft deze telling nog niet verstuurd.'});
    res.json({ok:true,...(_afronden(req,s))});
  });
  // Bulk: afronden voor meerdere sessies; wat niet kan (nog niet verstuurd) komt apart terug.
  app.post('/api/nakijken/afronden',alleenKantoor,(req,res)=>{
    const ids=Array.isArray(req.body?.sessie_ids)?req.body.sessie_ids.map(Number).filter(Boolean):[];
    if(!ids.length)return res.status(400).json({error:'Kies eerst een of meer bakken.'});
    const gedaan=[],overgeslagen=[];
    ids.forEach(id=>{
      const s=get('SELECT * FROM nakijk_sessies WHERE id=?',[id]);
      if(!s||s.kv_status!=='ingediend')overgeslagen.push({sessie_id:id,reden:!s?'bestaat niet':'nog niet verstuurd door de KV'});
      else gedaan.push(_afronden(req,s));
    });
    res.json({ok:true,afgerond:gedaan,overgeslagen});
  });

  // Herinnering en notitie naar de KV: aanvragen-rij die in de kv-data verschijnt (meldingen_kantoor).
  function _naarKv(req,res,soort,tekstFn){
    const km=get('SELECT * FROM kampmomenten WHERE id=?',[parseInt(req.body?.kampmoment_id)||0]);
    if(!km)return res.status(404).json({error:'Kampmoment niet gevonden'});
    const tekst=tekstFn(km);
    if(!tekst)return res.status(400).json({error:'Schrijf eerst een notitie.'});
    const id=insMetLog(req,'INSERT INTO aanvragen (kampmoment_id,persoon_id,soort,tekst,status,created_at) VALUES (?,?,?,?,?,?)',[km.id,(req.persoon&&req.persoon.persoon_id)||null,soort,tekst,'nieuw',now()],'nakijken');
    logAct('nakijken',soort,`${soort==='herinnering_kv'?'Herinnering':'Notitie'} naar KV ${_kvNaam(km)||''} (${_locNaam(km.locatie_id)}): ${tekst}`,km.locatie_id,_locNaam(km.locatie_id));
    res.json(get('SELECT * FROM aanvragen WHERE id=?',[id]));
  }
  app.post('/api/nakijken/herinnering',alleenKantoor,(req,res)=>_naarKv(req,res,'herinnering_kv',km=>`Kantoor vraagt je de bakken van ${_locNaam(km.locatie_id)} (week ${km.week}) te tellen en te versturen.`));
  app.post('/api/nakijken/notitie',alleenKantoor,(req,res)=>_naarKv(req,res,'notitie_kantoor',()=>String(req.body?.tekst||'').trim().slice(0,500)));

  // ── Aanvullijst (Rozenweg) ──
  const SOORT={uit_pool:'uit_pool',naar_pool:'naar_pool',afschrijven_bestellen:'afschrijven',bestellen:'bestelling',herstellen:'nakijken'};
  const _poolPlaats=r=>{const it=r.item_id?get('SELECT t.pool_plaats FROM bak_items bi JOIN item_types t ON t.id=bi.item_type_id WHERE bi.id=?',[r.item_id]):null;return it&&it.pool_plaats?' ('+it.pool_plaats+')':'';};
  const WAAR={
    // MA1: pool-stukken met hun vaste plaats (item_types.pool_plaats, bv. 'rek P · bak P-03') als die gekend is.
    uit_pool:r=>'uit de pool'+_poolPlaats(r),naar_pool:r=>'terug naar de pool'+_poolPlaats(r),afschrijven_bestellen:r=>[r.notitie,'afschrijven · nieuwe via bestelling'].filter(Boolean).join(' · '),
    bestellen:r=>'bestelling · wacht op levering',herstellen:r=>[r.notitie,'herstellen'].filter(Boolean).join(' · ')
  };
  function _aanvullijst(datum,alles){
    const sessies=all("SELECT * FROM nakijk_sessies WHERE kantoor_afgerond_op<>'' AND kantoor_afgerond_op IS NOT NULL ORDER BY kantoor_afgerond_op,id");
    const groepen=[];
    sessies.forEach(s=>{
      if(datum&&(s.kantoor_afgerond_op||'').slice(0,10)>datum)return;
      const km=s.kampmoment_id?get('SELECT * FROM kampmomenten WHERE id=?',[s.kampmoment_id]):null;
      let bak=null;
      if(s.bak_type==='attribuut')bak=get('SELECT * FROM attributen WHERE id=?',[s.attribuut_id]);
      else bak=get('SELECT * FROM bakken WHERE id=?',[s.bak_type==='thema'?s.thema_bak_id:s.vaste_bak_id]);
      if(!bak)return;
      const items=s.bak_type==='attribuut'?[]:_bakItems(bak);
      const handelingen=[];
      all('SELECT * FROM nakijk_regels WHERE sessie_id=? ORDER BY id',[s.id]).forEach(r=>{
        const it=items.find(x=>x.id===r.item_id);
        let soort='',waar='',aantal=r.kantoor_aantal||0;
        if(r.aangetroffen==null){soort='nakijken';waar='KV telde niet · zelf tellen';aantal=it?it.qty:(r.verwacht||0);}
        else if(SOORT[r.kantoor_actie]){soort=SOORT[r.kantoor_actie];waar=WAAR[r.kantoor_actie](r);if(r.kantoor_notitie)waar=(waar?waar+' · ':'')+r.kantoor_notitie;}
        else return;
        if(r.aangevuld&&!alles)return;
        handelingen.push({regel_id:r.id,stuk:r.item_naam,aantal,soort,waar_tekst:waar,aangevuld:r.aangevuld?1:0});
      });
      if(s.bak_type==='attribuut'&&s.notities==='beschadigd'&&!alles){
        // attribuut kapot: geen regel; toon één handeling zonder vinkje-regel (alleen informatief).
      }
      if(!handelingen.length)return;
      groepen.push({sessie_id:s.id,bak:{id:bak.id,code:bak.code||'',naam:bak.naam||'',soort:s.bak_type},locatie:km?_locNaam(km.locatie_id):_locNaam(s.locatie_id),week:km?km.week:s.week,
        plaats:_plaats(bak),afgerond_op:s.kantoor_afgerond_op||'',handelingen});
    });
    const alle=groepen.flatMap(g=>g.handelingen);
    return {datum,tellers:{totaal:alle.length,uit_pool:alle.filter(h=>h.soort==='uit_pool').length,bestelling:alle.filter(h=>h.soort==='bestelling').length,klaar:alle.filter(h=>h.aangevuld).length,bakken:groepen.length},bakken:groepen};
  }
  app.get('/api/aanvullijst',(req,res)=>{
    const datum=/^\d{4}-\d{2}-\d{2}$/.test(req.query.datum||'')?req.query.datum:isoLokaal(new Date());
    res.json({..._aanvullijst(datum,req.query.alles==='1'),afgedrukt_door:wie(req)});
  });
  app.post('/api/aanvullijst/:regelId/aangevuld',(req,res)=>{
    const r=get('SELECT * FROM nakijk_regels WHERE id=?',[req.params.regelId]);
    if(!r)return res.status(404).json({error:'Deze handeling bestaat niet (meer).'});
    const s=get('SELECT * FROM nakijk_sessies WHERE id=?',[r.sessie_id]);
    if(!s||!s.kantoor_afgerond_op)return res.status(409).json({error:'Deze keuring is nog niet afgerond door kantoor.'});
    const aan=req.body?.aangevuld===false||req.body?.aangevuld===0||req.body?.aangevuld==='0'?0:1;
    let fotoPad='';
    if(aan&&typeof req.body?.foto_data==='string'&&req.body.foto_data){
      try{fotoPad=fotos.bewaarFoto(req.body.foto_data,'aanvullen');}catch(e){return res.status(e.status||400).json({error:e.status?e.message:'Foto opslaan mislukt'});}
    }
    updateMetLog(req,'nakijk_regels',r.id,{aangevuld:aan,aangevuld_door:aan?wie(req):'',aangevuld_op:aan?isoNu():''},'aanvullen');
    logAct('nakijken',aan?'aangevuld':'aangevuld_terug',`${r.item_naam}: ${aan?'aangevuld':'teruggezet naar open'} door ${wie(req)||'?'}${fotoPad?' (foto '+fotoPad+')':''}`,s.locatie_id,_locNaam(s.locatie_id));
    res.json({ok:true,regel_id:r.id,aangevuld:aan,foto:fotoPad?'/uploads/'+fotoPad:null});
  });

  // ── Pagina's ──
  app.get('/nakijken',(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','nakijken.html')));
  app.get('/aanvullijst-print',(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','aanvullijst-print.html')));
};
