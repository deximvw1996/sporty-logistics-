// routes/nakijken.js — VC1: kantoor-spiegel van het KV-telscherm (Voorraad & controles › Nakijken) en de aanvullijst voor de Rozenweg.
// Databronnen: nakijk_sessies/nakijk_regels (KV1: te_veel, kapot_aantal, notitie, foto_path) + de verwachte bakken van het kampmoment
// (_kvVerwacht). Pagina's: /nakijken (alleen kantoor) en /aanvullijst-print (ingelogd). De gsm-versie van de aanvullijst gebruikt dezelfde API.
'use strict';
module.exports = function(ctx){
  const {kvL}=require('../lib/tijd');
  const {app,get,all,run,ins,now,logAct,updateMetLog,insMetLog,alleenKantoor,_kvVerwacht,_kvNaam,_bakItems,path,ROOT_DIR} = ctx;
  const fotos=require('../lib/fotos')(ctx.UPLOADS_DIR);
  const {fmtDatumTijd,zonderHaakjes}=require('../lib/tijd');

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
      // TF1 G13: tel stuks, geen regels ("te veel 2" als er 2 te veel zijn).
      if(r.aangetroffen<it.qty)tekort+=it.qty-r.aangetroffen;
      else if(r.aangetroffen>it.qty)teVeel+=r.aangetroffen-it.qty;
      kapot+=(r.kapot_aantal||0);
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
  const _nagekeken=s=>!!s&&(['nagekeken','verwerkt'].includes(s.kantoor_status)||(!!s.kantoor_afgerond_op&&s.kantoor_status!=='open')); // AV2: een heropende keuring (open) houdt haar afrondtijd, zodat de aanvullijst blijft werken
  const _locNaam=id=>id?((get('SELECT name FROM locaties WHERE id=?',[id])||{}).name||''):'';

  // Eén lijstrij (bak of attribuut) van een kampmoment.
  function _rij(km,bak,sessieVast){
    const loc=_locNaam(km.locatie_id),kvNaam=_kvNaam(km);
    const sessie=sessieVast||_sessieVan(km,bak);
    let geteld=0,totaal=1,tekst='niet geteld',tekort=0,kapot=0;
    if(bak.soort==='attribuut'){
      const st=sessie?sessie.notities:'';
      if(st==='aanwezig'){geteld=1;tekst='✓ alles klopt';}
      else if(st==='beschadigd'){geteld=1;tekst='kapot';kapot=1;}
    }else if(bak.soort==='melding'){
      totaal=sessie?all("SELECT id FROM nakijk_regels WHERE sessie_id=? AND gemeld_soort<>''",[sessie.id]).length:0;tekst='';
    }else{
      const items=_bakItems(bak),regels=sessie?all('SELECT * FROM nakijk_regels WHERE sessie_id=?',[sessie.id]):[];
      const u=_uitslag(items,regels);geteld=u.geteld;totaal=items.length;tekst=u.tekst;tekort=u.tekort;kapot=u.kapot;
      if(sessie&&sessie.kv_status==='bezig'&&geteld>0)tekst='KV is bezig · '+geteld+'/'+totaal+' geteld';
    }
    const gemeld=sessie?all("SELECT * FROM nakijk_regels WHERE sessie_id=? AND gemeld_soort<>''",[sessie.id]):[];
    const gemeldOpen=gemeld.length&&!_nagekeken(sessie);
    let status='niet_geteld';
    // KD1: de KV is nog niet aan deze bak begonnen (geen sessie) → eigen status, zodat kantoor het verschil ziet met "sessie zonder tellingen".
    if(!sessie){status='nog_niet';tekst='nog niet geteld';}
    else if(_nagekeken(sessie))status='nagekeken';
    else if(sessie&&sessie.kv_status==='ingediend'&&(geteld>0||gemeldOpen))status='te_keuren';
    if(bak.soort==='melding'&&!gemeldOpen)tekst='✓ afgehandeld';
    if(gemeldOpen){kapot+=gemeld.filter(g=>g.gemeld_soort==='kapot').length;tekort+=gemeld.filter(g=>g.gemeld_soort==='weg').length;tekst=(geteld?tekst+' · ':'')+gemeld.length+' gemeld door stockage';}
    return {sessie_id:sessie?sessie.id:null,kampmoment_id:km.id,locatie:loc,week:km.week,kv_naam:kvNaam,
      bak:{id:bak.id,code:bak.code||'',naam:bak.naam||bak.label||'',soort:bak.soort},geteld,totaal,uitslag_tekst:tekst,
      met_tekort:tekort>0,met_kapot:kapot>0,status,gemeld:gemeldOpen?gemeld.length:0,gemeld_op:bak.soort==='melding'&&sessie?(sessie.datum||''):'',
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
    // AV2: losse meldingen van de aanvuller (zonder bak) staan ook als rij in de lijst
    all("SELECT * FROM nakijk_sessies WHERE bak_type='melding' AND id IN (SELECT sessie_id FROM nakijk_regels WHERE gemeld_soort<>'')").forEach(s=>{
      const pseudo={id:s.id,soort:'melding',naam:'Losse melding',code:''};
      const rij=_rij({id:null,locatie_id:s.locatie_id,week:s.week,periode_id:null,kv_persoon_id:null},pseudo,s);
      rij.kampmoment_id=null;rij.locatie=_locNaam(s.locatie_id)||'stockage';rij.bak={id:s.id,code:'',naam:'Losse melding',soort:'melding'};bakken.push(rij);
    });
    bakken.sort((a,b)=>(b.gemeld>0)-(a.gemeld>0)); // TF4 G14: wat de aanvuller meldde staat bovenaan (stabiele volgorde verder)
    const tellers={te_keuren:0,niet_geteld:0,nog_niet:0,met_tekort:0,met_kapot:0,nagekeken:0,gemeld:0};
    bakken.forEach(b=>{
      if(b.gemeld>0)tellers.gemeld++;
      if(b.status==='te_keuren')tellers.te_keuren++;
      if(b.status==='niet_geteld')tellers.niet_geteld++;
      if(b.status==='nog_niet')tellers.nog_niet++;
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
    const melding=bak.soort==='melding';
    const rij=_rij(km,bak,melding?sessie:undefined);
    let items=[];
    if(bak.soort==='attribuut'){
      const st=sessie?sessie.notities:'';
      // TB1: een beschadigd attribuut heeft een nakijk-regel (door de KV-route aangemaakt) waaraan kantoor een actie hangt.
      const ar=sessie&&st==='beschadigd'?get('SELECT * FROM nakijk_regels WHERE sessie_id=? AND item_naam=?',[sessie.id,bak.naam]):null;
      items=[{regel_id:ar?ar.id:null,naam:bak.naam,verwacht:1,aangetroffen:st?1:null,te_veel:0,kapot_aantal:st==='beschadigd'?1:0,notitie:'',foto_url:null,
        afwijking:!st?'niet_geteld':st==='beschadigd'?'kapot':'klopt',kantoor_actie:ar?(ar.kantoor_actie||''):'',kantoor_aantal:ar&&ar.kantoor_aantal?ar.kantoor_aantal:(st==='beschadigd'?1:0),kantoor_notitie:ar?(ar.kantoor_notitie||''):'',
        aangevuld:ar?(ar.aangevuld||0):0,tekort_status:ar?(ar.tekort_status||''):'',aantal_afwijking:st==='beschadigd'?1:0,
        acties:st==='beschadigd'?ACTIES.kapot.map(([waarde,label])=>({waarde,label})):[]}];
    }else{
      const regels=sessie?all('SELECT * FROM nakijk_regels WHERE sessie_id=?',[sessie.id]):[];
      items=(melding?[]:_bakItems(bak)).map(it=>{
        const r=regels.find(x=>x.item_id===it.id);
        const afw=_afwijking(r,it.qty);
        const aantal=afw==='tekort'?it.qty-r.aangetroffen:afw==='te_veel'?r.aangetroffen-it.qty:afw==='kapot'?(r.kapot_aantal||0):0;
        const opties=ACTIES[afw]||[];
        // MOB2: voorraad van dit artikel (gsm toont "Rozenweg 40 · minimum 100" bij de regel)
        const vrd=it.item_type_id?all('SELECT l.name,s.qty,s.minimum FROM item_type_stock s JOIN locaties l ON l.id=s.locatie_id WHERE s.item_type_id=? AND (s.qty>0 OR s.minimum>0) ORDER BY l.name',[it.item_type_id]):[];
        const voorraad_tekst=vrd.map(x=>`${x.name} ${Math.round(x.qty*100)/100}${x.minimum>0?' · minimum '+x.minimum:''}`).join(' · ');
        return {voorraad_tekst,item_id:it.id,regel_id:r?r.id:null,naam:it.naam,verwacht:it.qty,aangetroffen:r&&r.aangetroffen!=null?r.aangetroffen:null,te_veel:r&&r.aangetroffen>it.qty?r.aangetroffen-it.qty:0,
          kapot_aantal:r?(r.kapot_aantal||0):0,notitie:r?(r.notitie||''):'',foto_url:r&&r.foto_path?'/uploads/'+r.foto_path:null,afwijking:afw,
          kantoor_actie:r?(r.kantoor_actie||''):'',kantoor_aantal:r&&r.kantoor_aantal?r.kantoor_aantal:aantal,kantoor_notitie:r?(r.kantoor_notitie||''):'',
          aangevuld:r?(r.aangevuld||0):0,tekort_status:r?(r.tekort_status||''):'',aantal_afwijking:aantal,
          acties:opties.map(([waarde,label])=>({waarde,label}))};
      });
    }
    // AV2: wat de aanvuller zelf meldde (kapot of weg) staat als extra regel met herkomst; kantoor beslist hier.
    if(sessie)all("SELECT * FROM nakijk_regels WHERE sessie_id=? AND gemeld_soort<>'' ORDER BY id",[sessie.id]).forEach(r=>{
      const kapot=r.gemeld_soort==='kapot',n=r.kantoor_aantal||0;
      items.push({regel_id:r.id,naam:r.item_naam,verwacht:kapot?0:(r.gedaan_aantal||0)+n,aangetroffen:kapot?null:(r.gedaan_aantal||0),te_veel:0,kapot_aantal:kapot?(r.kapot_aantal||n):0,notitie:r.notitie||'',foto_url:r.foto_path?'/uploads/'+r.foto_path:null,
        afwijking:kapot?'kapot':'tekort',kantoor_actie:r.kantoor_actie||'',kantoor_aantal:n,kantoor_notitie:r.kantoor_notitie||'',aangevuld:r.aangevuld||0,tekort_status:r.tekort_status||'',aantal_afwijking:n,
        gemeld_door:r.gemeld_door||'',herkomst:'gemeld door '+(r.gemeld_door||'de aanvuller')+' · stockage',voorraad_tekst:'',
        acties:(kapot?ACTIES.kapot:ACTIES.tekort).map(([waarde,label])=>({waarde,label}))});
    });
    if(melding)return {sessie_id:sessie?sessie.id:null,kampmoment_id:km.id||null,locatie:loc,week:km.week||null,maandag:null,bak:rij.bak,geteld:0,totaal:items.length,uitslag_tekst:rij.uitslag_tekst,status:rij.status,kv_naam:'',ingediend_op:'',nagekeken_op:rij.nagekeken_op,
      afwijkingen:{tekort:items.filter(i=>i.afwijking==='tekort').length,te_veel:0,kapot:items.filter(i=>i.afwijking==='kapot').length},items,foto_s:items.filter(i=>i.foto_url).map(i=>({url:i.foto_url,stuk:i.naam})),vorige_tellingen:[],historiek:[],contact:{kv_naam:'',kv_telefoon:''}};
    // TF5: alle tellingen per stuk, nieuwste eerst, uit de onwisbare kv_telling_versies.
    const _tv=sessie?all('SELECT * FROM kv_telling_versies WHERE sessie_id=? ORDER BY id DESC',[sessie.id]):[];
    const _tvUit=v=>({op:fmtDatumTijd(v.op),wie:v.wie||'',via:v.via||'',geteld:v.geteld,kapot:v.kapot||0,te_veel:v.te_veel||0,status:v.status||'',notitie:v.notitie||'',foto_url:v.foto_path?'/uploads/'+v.foto_path:null});
    items.forEach(i=>{if(i.gemeld_door)return;const eig=_tv.filter(v=>bak.soort==='attribuut'?true:v.item_id===i.item_id).map(_tvUit);i.laatste_telling=eig[0]||null;i.eerdere_tellingen=eig.slice(1);});
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
      if(sessie.kv_status==='ingediend')hist.push({tekst:`telling ingediend (${rij.geteld}/${totaal})`,wie:sessie.kv_wie?kvL(sessie.kv_wie):'KV',sorteer:_ts(sessie.kv_tijdstip),tijd:sessie.kv_tijdstip||''});
      items.filter(it=>!it.gemeld_door).forEach(it=>{
        if(it.kapot_aantal>0)hist.push({tekst:`${it.naam.toLowerCase()}: ${it.kapot_aantal} kapot${it.foto_url?' + foto':''}`,wie:sessie.kv_wie?kvL(sessie.kv_wie):'KV',sorteer:_ts(sessie.kv_tijdstip),tijd:sessie.kv_tijdstip||''});
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
      afwijkingen:{tekort:items.filter(i=>i.afwijking==='tekort').reduce((n,i)=>n+(i.aantal_afwijking||0),0),te_veel:items.filter(i=>i.afwijking==='te_veel').reduce((n,i)=>n+(i.aantal_afwijking||0),0),kapot:items.reduce((n,i)=>n+(i.kapot_aantal||0),0)},
      items,foto_s:fotoUrls,vorige_tellingen:vorige,historiek:hist.map(({sorteer,...h})=>({...h,tijd:fmtDatumTijd(h.tijd)})),
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
    const km=s.bak_type==='melding'?{id:null,locatie_id:s.locatie_id,week:s.week,periode_id:null,kv_persoon_id:null}:s.kampmoment_id?get('SELECT * FROM kampmomenten WHERE id=?',[s.kampmoment_id]):null;
    if(!km)return res.status(404).json({error:'Deze telling hoort niet bij een kampmoment.'});
    if(s.bak_type==='melding')return res.json(_detail(km,{id:s.id,soort:'melding',naam:'Losse melding',code:''},s));
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
    // TF1 G14: zonder kantoor_aantal het afwijkingsaantal van de actie (zoals _afronden), niet stil 0.
    const AFW={bestellen:'tekort',uit_pool:'tekort',naar_pool:'te_veel',laten_staan:'te_veel',afschrijven_bestellen:'kapot',herstellen:'kapot'};
    const afwAantal=soort=>soort==='tekort'?Math.max(0,(r.verwacht||0)-(r.aangetroffen||0)):soort==='te_veel'?Math.max(0,(r.aangetroffen||0)-(r.verwacht||0)):soort==='kapot'?(r.kapot_aantal||0):0;
    const aantal=b.kantoor_aantal!==undefined&&b.kantoor_aantal!==null&&b.kantoor_aantal!==''?parseFloat(b.kantoor_aantal)
      :(b.kantoor_actie!==undefined&&actie?afwAantal(AFW[actie]||_afwijking(r,r.verwacht||0)):(r.kantoor_aantal||0));
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
      const afw=r.gemeld_soort==='kapot'?'kapot':r.gemeld_soort==='weg'?'tekort':_afwijking(r,it?it.qty:(r.verwacht||0));
      let actie=r.kantoor_actie||'';
      let aantal=r.kantoor_aantal||0;
      if(!actie&&ACTIES[afw]){
        actie=ACTIES[afw][0][0];
        aantal=r.gemeld_soort?(r.kantoor_aantal||0):afw==='tekort'?(r.verwacht||0)-r.aangetroffen:afw==='te_veel'?r.aangetroffen-(r.verwacht||0):(r.kapot_aantal||0);
        updateMetLog(req,'nakijk_regels',r.id,{kantoor_actie:actie,kantoor_aantal:aantal},'nakijken');
      }
      if(actie==='bestellen'||actie==='afschrijven_bestellen'){
        // Bestaande tekorten/bestel-logica (routes/voorraad.js): tekort_status 'besteld' + besteld=1. TF4: alleen de nieuwe tellen mee.
        if(!r.besteld){updateMetLog(req,'nakijk_regels',r.id,{besteld:1,tekort_status:r.tekort_status==='binnen'?'binnen':'besteld'},'nakijken');bestel++;if(actie==='afschrijven_bestellen')afschrijf++;}
      }
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
    logAct('nakijken',soort,`${soort==='herinnering_kv'?'Herinnering':'Notitie'} naar ${_kvNaam(km)?kvL(_kvNaam(km)):'KV'} (${_locNaam(km.locatie_id)}): ${tekst}`,km.locatie_id,_locNaam(km.locatie_id));
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
    bestellen:r=>r.tekort_status==='binnen'?'bestelling · binnen, klaar om te plaatsen':'bestelling · wacht op levering',herstellen:r=>[r.notitie,'herstellen'].filter(Boolean).join(' · ')
  };
  function _aanvullijst(datum,alles){
    const sessies=all("SELECT * FROM nakijk_sessies WHERE (kantoor_afgerond_op<>'' AND kantoor_afgerond_op IS NOT NULL) OR id IN (SELECT sessie_id FROM nakijk_regels WHERE gemeld_soort<>'' AND COALESCE(kantoor_actie,'')='') ORDER BY kantoor_afgerond_op,id");
    const groepen=[];
    sessies.forEach(s=>{
      if(datum&&s.kantoor_afgerond_op&&(s.kantoor_afgerond_op||'').slice(0,10)>datum)return;
      const km=s.kampmoment_id?get('SELECT * FROM kampmomenten WHERE id=?',[s.kampmoment_id]):null;
      let bak=null;
      if(s.bak_type==='attribuut')bak=get('SELECT * FROM attributen WHERE id=?',[s.attribuut_id]);
      else if(s.bak_type==='melding')bak={id:s.id,code:'',naam:'Losse melding'};
      else bak=get('SELECT * FROM bakken WHERE id=?',[s.bak_type==='thema'?s.thema_bak_id:s.vaste_bak_id]);
      if(!bak)return;
      const items=s.bak_type==='attribuut'||s.bak_type==='melding'?[]:_bakItems(bak);
      const handelingen=[];
      all('SELECT * FROM nakijk_regels WHERE sessie_id=? ORDER BY id',[s.id]).forEach(r=>{
        const it=items.find(x=>x.id===r.item_id);
        let soort='',waar='',aantal=r.kantoor_aantal||0;
        const gedaanN=r.gedaan_aantal||0;
        if(r.gemeld_soort&&(!r.kantoor_actie||!_nagekeken(s))){
          // AV2: gemeld door de aanvuller, kantoor heeft nog niet beslist (of de keuring is nog niet afgerond): zichtbaar maar niet af te vinken.
          handelingen.push({regel_id:r.id,stuk:zonderHaakjes(r.item_naam||''),aantal,soort:'melding',waar_tekst:(r.gemeld_soort==='kapot'?'kapot':'weg')+' gemeld door '+(r.gemeld_door||'?')+' · wacht op kantoor',aangevuld:0,binnen:false,kan_afvinken:false,gemeld:1,wacht_op_kantoor:true,gemeld_soort:r.gemeld_soort,gemeld_door:r.gemeld_door||'',gedaan:gedaanN,totaal:gedaanN+aantal});
          return;
        }
        if(r.aangetroffen==null&&!r.gemeld_soort){soort='nakijken';waar='KV telde niet · zelf tellen';aantal=it?it.qty:(r.verwacht||0);}
        else if(SOORT[r.kantoor_actie]){soort=SOORT[r.kantoor_actie];waar=WAAR[r.kantoor_actie](r);if(r.kantoor_notitie)waar=(waar?waar+' · ':'')+r.kantoor_notitie;}
        else return;
        if(r.aangevuld&&!alles)return;
        if(r.tekort_status==='genegeerd')return; // TB2: genegeerd op Tekorten → niet meer op de aanvullijst
        const binnen=soort!=='bestelling'||r.tekort_status==='binnen'||!!r.aangevuld; // G15: een bestelling is pas af te vinken als ze binnen is
        handelingen.push({regel_id:r.id,stuk:zonderHaakjes(r.item_naam||''),aantal,soort,waar_tekst:waar,aangevuld:r.aangevuld?1:0,binnen,kan_afvinken:binnen,actie:r.kantoor_actie||'',gedaan:gedaanN,totaal:gedaanN+aantal,gemeld:r.gemeld_soort?1:0,gemeld_door:r.gemeld_door||''});
      });
      if(s.bak_type==='attribuut'&&s.notities==='beschadigd'&&!alles){
        // attribuut kapot: geen regel; toon één handeling zonder vinkje-regel (alleen informatief).
      }
      const inhoud=s.bak_type==='attribuut'||s.bak_type==='melding'?[]:[...new Set(items.map(i=>zonderHaakjes(i.naam||'')).filter(Boolean))];
      const leegMeldbaar=!handelingen.length&&alles&&inhoud.length&&!!s.kantoor_afgerond_op; // TF4 G24: ook een bak zonder handelingen is meldbaar
      if(!handelingen.length&&!leegMeldbaar)return;
      const vertrek=km?((get("SELECT MIN(datum) AS d FROM transport_taken WHERE kampmoment_id=? AND type='levering' AND COALESCE(status,'')<>'geannuleerd' AND datum<>''",[km.id])||{}).d||''):'';
      groepen.push({inhoud,leeg:!handelingen.length,vertrek,sessie_id:s.id,bak:{id:bak.id,code:bak.code||'',naam:bak.naam||'',soort:s.bak_type},locatie:km?_locNaam(km.locatie_id):_locNaam(s.locatie_id),week:km?km.week:s.week,
        plaats:s.bak_type==='melding'?{rek:'',plank:'',tekst:''}:_plaats(bak),afgerond_op:s.kantoor_afgerond_op||'',handelingen});
    });
    const alle=groepen.flatMap(g=>g.handelingen).filter(h=>!h.wacht_op_kantoor); // TF4 G26: een melding die op kantoor wacht is nog geen handeling
    const alleMeld=groepen.flatMap(g=>g.handelingen).filter(h=>h.wacht_op_kantoor);
    return {datum,tellers:{totaal:alle.length,uit_pool:alle.filter(h=>h.soort==='uit_pool').length,bestelling:alle.filter(h=>h.soort==='bestelling').length,klaar:alle.filter(h=>h.aangevuld).length,gemeld:alleMeld.length,bakken:groepen.filter(g=>!g.leeg).length},bakken:groepen};
  }
  app.get('/api/aanvullijst',(req,res)=>{
    const datum=/^\d{4}-\d{2}-\d{2}$/.test(req.query.datum||'')?req.query.datum:isoLokaal(new Date());
    res.json({..._aanvullijst(datum,req.query.alles==='1'),afgedrukt_door:wie(req),kantoor:ctx.kantoorContact?ctx.kantoorContact():null}); // BH2: kantoornummer onderaan de print
  });
  // AV2: de aanvuller meldt zelf dat iets kapot of weg is. Een melding is geen beslissing: ze wordt een nakijk-regel
  // waar kantoor in Nakijken over beslist; de voorraad verandert pas via de gewone keten.
  app.post('/api/aanvullijst/melding',(req,res)=>{
    const p=req.persoon||{};
    if(!['kantoor','coordinator','chauffeur'].includes(p.rol))return res.status(403).json({error:'Alleen kantoor, coördinator of chauffeur kan iets melden.'});
    const b=req.body||{};
    const naam=String(b.item_naam||'').trim().slice(0,80),soort=b.soort,aantal=parseFloat(b.aantal);
    if(!naam)return res.status(400).json({error:'Vul in welk stuk het is.'});
    if(soort!=='kapot'&&soort!=='weg')return res.status(400).json({error:'Kies kapot of weg.'});
    if(!(aantal>=1))return res.status(400).json({error:'Het aantal moet minstens 1 zijn.'});
    const heeftFoto=typeof b.foto_data==='string'&&!!b.foto_data;
    if(soort==='kapot'&&!heeftFoto)return res.status(400).json({error:'Kapot melden vraagt een foto van het stuk.'});
    const notitie=String(b.notitie||'').trim().slice(0,300);
    // sessie zoeken: expliciet, via kampmoment+bak, de laatste van die bak, of een losse melding zonder bak
    let s=null,km=null;
    const bakSoort=['thema','vast','attribuut'].includes(b.bak_soort)?b.bak_soort:null,bakId=parseInt(b.bak_id)||0;
    if(parseInt(b.sessie_id)){s=get('SELECT * FROM nakijk_sessies WHERE id=?',[parseInt(b.sessie_id)]);if(!s)return res.status(404).json({error:'Deze keuring bestaat niet (meer).'});}
    else if(bakId){
      const kmId=parseInt(b.kampmoment_id)||0;
      if(kmId){
        km=get('SELECT * FROM kampmomenten WHERE id=?',[kmId]);if(!km)return res.status(404).json({error:'Kampmoment niet gevonden'});
        const bk=_bakUit(km,(bakSoort||'thema')+':'+bakId)||(!bakSoort&&_bakUit(km,'vast:'+bakId))||null;
        if(!bk)return res.status(404).json({error:'Deze bak hoort niet bij dit kampmoment.'});
        s=_sessieVan(km,bk);
        if(!s){
          const sid=insMetLog(req,'INSERT INTO nakijk_sessies (bak_type,thema_bak_id,vaste_bak_id,attribuut_id,locatie_id,week,datum,kv_status,kampmoment_id,kantoor_status) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [bk.soort,bk.soort==='thema'?bk.id:null,bk.soort==='vast'?bk.id:null,bk.soort==='attribuut'?bk.id:null,km.locatie_id,km.week,isoLokaal(new Date()),'ingediend',km.id,'open'],'aanvuller meldt');
          s=get('SELECT * FROM nakijk_sessies WHERE id=?',[sid]);
        }
      }else{
        const w=bakSoort?"bak_type=? AND "+(bakSoort==='thema'?'thema_bak_id':bakSoort==='vast'?'vaste_bak_id':'attribuut_id')+"=?":"((bak_type='thema' AND thema_bak_id=?) OR (bak_type='vast' AND vaste_bak_id=?))";
        s=get('SELECT * FROM nakijk_sessies WHERE '+w+' AND kampmoment_id IS NOT NULL ORDER BY id DESC',bakSoort?[bakSoort,bakId]:[bakId,bakId]);
        if(!s)return res.status(404).json({error:'Voor deze bak is geen keuring gevonden. Geef een kampmoment mee of meld zonder bak.'});
      }
    }else{
      const loc=parseInt(b.locatie_id)||null;
      s=get("SELECT * FROM nakijk_sessies WHERE bak_type='melding' AND kantoor_status='open' AND COALESCE(locatie_id,0)=? ORDER BY id DESC",[loc||0]);
      if(!s){
        const sid=insMetLog(req,'INSERT INTO nakijk_sessies (bak_type,locatie_id,datum,kv_status,kantoor_status) VALUES (?,?,?,?,?)',['melding',loc,isoLokaal(new Date()),'ingediend','open'],'aanvuller meldt');
        s=get('SELECT * FROM nakijk_sessies WHERE id=?',[sid]);
      }
    }
    if(!km&&s.kampmoment_id)km=get('SELECT * FROM kampmomenten WHERE id=?',[s.kampmoment_id]);
    let fp='';
    if(heeftFoto){try{fp=fotos.bewaarFoto(b.foto_data,'nakijken');}catch(e){return res.status(e.status||400).json({error:e.status?e.message:'Foto opslaan mislukt'});}}
    const heropend=_nagekeken(s)&&s.bak_type!=='melding';
    const bestaand=get("SELECT * FROM nakijk_regels WHERE sessie_id=? AND gemeld_soort=? AND lower(item_naam)=lower(?) AND COALESCE(kantoor_actie,'')='' ORDER BY id DESC",[s.id,soort,naam]);
    let regelId,dubbel=false;
    if(bestaand){
      dubbel=true;regelId=bestaand.id;
      updateMetLog(req,'nakijk_regels',bestaand.id,{kantoor_aantal:(bestaand.kantoor_aantal||0)+aantal,kapot_aantal:soort==='kapot'?(bestaand.kapot_aantal||0)+aantal:0,
        notitie:[bestaand.notitie,notitie].filter(Boolean).join(' · ').slice(0,500),foto_path:bestaand.foto_path||fp},'aanvuller meldt (erbij)');
    }else{
      regelId=insMetLog(req,'INSERT INTO nakijk_regels (sessie_id,item_naam,item_id,verwacht,aangetroffen,kapot_aantal,notitie,foto_path,kantoor_aantal,gemeld_soort,gemeld_door,tekort_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        [s.id,naam,null,0,null,soort==='kapot'?aantal:0,notitie,fp,aantal,soort,p.naam||'','open'],'aanvuller meldt');
    }
    if(heropend)updateMetLog(req,'nakijk_sessies',s.id,{kantoor_status:'open'},'aanvuller meldt: keuring heropend');
    const plaats=km?_locNaam(km.locatie_id):_locNaam(s.locatie_id),wiem=p.naam||'de aanvuller';
    logAct('nakijken','gemeld',`${naam}: ${aantal} ${soort==='kapot'?'kapot':'weg'} gemeld door ${wiem} (stockage)${dubbel?' — erbij op een bestaande melding':''}${heropend?' — keuring heropend':''}${fp?' (foto '+fp+')':''}`,s.locatie_id||(km?km.locatie_id:null),plaats);
    const nm=bestaand?bestaand.item_naam:naam;
    const meldTekst=n=>`${nm} (${n}×) is ${soort==='kapot'?'kapot':'weg'}, gemeld vanuit de stockage — beslis in Nakijken`;
    if(!dubbel&&ctx.melding)ctx.melding(req,{voor_rol:'kantoor',van_naam:wiem,tekst:meldTekst(aantal),link:'/nakijken'});
    else if(dubbel&&ctx.melding){
      // TF4 G22: de kantoormelding krijgt het nieuwe totaal (en staat weer ongelezen); is ze weg of al verwerkt, dan komt er een nieuwe
      const nieuwN=(bestaand.kantoor_aantal||0)+aantal;
      const oud=get("SELECT * FROM meldingen WHERE voor_rol='kantoor' AND tekst LIKE ? ORDER BY id DESC",[nm+' (%×) is '+(soort==='kapot'?'kapot':'weg')+', gemeld vanuit de stockage%']);
      if(oud){updateMetLog(req,'meldingen',oud.id,{tekst:meldTekst(nieuwN),gelezen_op:null},'melding bijgewerkt (opgeteld)');run('DELETE FROM meldingen_gelezen WHERE melding_id=?',[oud.id]);}
      else ctx.melding(req,{voor_rol:'kantoor',van_naam:wiem,tekst:meldTekst(nieuwN),link:'/nakijken'});
    }
    res.json({ok:true,regel_id:regelId,sessie_id:s.id,dubbel,heropend,foto:fp?'/uploads/'+fp:null});
  });
  // G15: kantoor meldt dat de bestelling geleverd is; pas daarna kan de handeling "aangevuld" worden.
  app.post('/api/nakijken/regel/:id/binnen',alleenKantoor,(req,res)=>{
    const r=get('SELECT * FROM nakijk_regels WHERE id=?',[req.params.id]);
    if(!r)return res.status(404).json({error:'Deze regel bestaat niet (meer).'});
    if(SOORT[r.kantoor_actie]!=='bestelling')return res.status(409).json({error:'Dit is geen bestelling.'});
    const s=get('SELECT * FROM nakijk_sessies WHERE id=?',[r.sessie_id]);
    const binnen=!(req.body&&(req.body.binnen===false||req.body.binnen===0||req.body.binnen==='0'));
    updateMetLog(req,'nakijk_regels',r.id,{tekort_status:binnen?'binnen':'open'},'nakijken');
    logAct('nakijken',binnen?'bestelling_binnen':'bestelling_terug',`${r.item_naam}: bestelling ${binnen?'is binnen':'teruggezet op wacht op levering'} (${wie(req)||'kantoor'})`,s?s.locatie_id:null,s?_locNaam(s.locatie_id):'');
    res.json({ok:true,regel_id:r.id,tekort_status:binnen?'binnen':'open'});
  });
  app.post('/api/aanvullijst/:regelId/aangevuld',(req,res)=>{
    const r=get('SELECT * FROM nakijk_regels WHERE id=?',[req.params.regelId]);
    if(!r)return res.status(404).json({error:'Deze handeling bestaat niet (meer).'});
    const s=get('SELECT * FROM nakijk_sessies WHERE id=?',[r.sessie_id]);
    if(!s||!s.kantoor_afgerond_op)return res.status(409).json({error:'Deze keuring is nog niet afgerond door kantoor.'});
    const aan=req.body?.aangevuld===false||req.body?.aangevuld===0||req.body?.aangevuld==='0'?0:1;
    if(aan&&r.gemeld_soort&&!r.kantoor_actie)return res.status(409).json({error:'Dit is gemeld en wacht op kantoor — kantoor beslist eerst in Nakijken.'});
    if(aan&&SOORT[r.kantoor_actie]==='bestelling'&&r.tekort_status!=='binnen'&&!r.aangevuld)return res.status(409).json({error:'Deze bestelling is nog niet binnen — zet ze eerst op "Bestelling binnen".'});
    // AV1: afschrijven vraagt altijd een foto van het kapotte stuk (bewijs); zonder foto geen afvinken.
    const heeftFoto=typeof req.body?.foto_data==='string'&&!!req.body.foto_data;
    if(aan&&!r.aangevuld&&r.kantoor_actie==='afschrijven_bestellen'&&!heeftFoto)return res.status(400).json({error:'Afschrijven vraagt een foto van het kapotte stuk.'});
    // AV1: minder gevonden dan nodig → alleen dat aantal telt nu (voorraad daalt met dat aantal), de rest blijft open en wordt gelogd.
    const gedaan=parseInt(req.body?.aantal),totaalN=r.kantoor_aantal||0;
    if(aan&&!r.aangevuld&&gedaan>=0&&Number.isFinite(gedaan)&&totaalN>0&&gedaan<totaalN&&req.body&&req.body.aantal!==undefined){
      if(gedaan<1)return res.status(400).json({error:'Vul in hoeveel je aangevuld hebt (minstens 1), of laat het vakje leeg.'});
      let fp='';
      if(heeftFoto){try{fp=fotos.bewaarFoto(req.body.foto_data,'aanvullen');}catch(e){return res.status(e.status||400).json({error:e.status?e.message:'Foto opslaan mislukt'});}}
      if(['uit_pool','bestellen','afschrijven_bestellen','naar_pool'].includes(r.kantoor_actie)){
        const bi=r.item_id?get('SELECT item_type_id FROM bak_items WHERE id=?',[r.item_id]):null;
        const typeId=(bi&&bi.item_type_id)||((get('SELECT id FROM item_types WHERE lower(naam)=lower(?) ORDER BY id LIMIT 1',[zonderHaakjes(r.item_naam||'').trim()])||{}).id);
        const roz=get("SELECT id FROM locaties WHERE name='Rozenweg' AND (parent_id IS NULL OR parent_id=0) ORDER BY id LIMIT 1");
        const st=typeId&&roz?get('SELECT * FROM item_type_stock WHERE item_type_id=? AND locatie_id=?',[typeId,roz.id]):null;
        const dl=(r.kantoor_actie==='naar_pool'?1:-1)*gedaan;
        if(st)updateMetLog(req,'item_type_stock',st.id,{qty:Math.max(0,(st.qty||0)+dl)},'aanvullen (deels): '+zonderHaakjes(r.item_naam||''));
        else if(typeId&&roz&&dl>0)insMetLog(req,'INSERT INTO item_type_stock (item_type_id,locatie_id,qty,minimum) VALUES (?,?,?,0)',[typeId,roz.id,dl],'aanvullen (deels)');
      }
      updateMetLog(req,'nakijk_regels',r.id,{kantoor_aantal:totaalN-gedaan,gedaan_aantal:(r.gedaan_aantal||0)+gedaan},'aanvullen (deels)');
      logAct('nakijken','aangevuld_deels',`${r.item_naam}: ${gedaan} van ${totaalN} aangevuld door ${wie(req)||'?'} — ${totaalN-gedaan} blijven open${fp?' (foto '+fp+')':''}`,s.locatie_id,_locNaam(s.locatie_id));
      return res.json({ok:true,regel_id:r.id,aangevuld:0,gedaan,open:totaalN-gedaan,foto:fp?'/uploads/'+fp:null});
    }
    let fotoPad='';
    if(aan&&typeof req.body?.foto_data==='string'&&req.body.foto_data){
      try{fotoPad=fotos.bewaarFoto(req.body.foto_data,'aanvullen');}catch(e){return res.status(e.status||400).json({error:e.status?e.message:'Foto opslaan mislukt'});}
    }
    updateMetLog(req,'nakijk_regels',r.id,{aangevuld:aan,aangevuld_door:aan?wie(req):'',aangevuld_op:aan?isoNu():''},'aanvullen');
    // TB2: aanvullen uit de stockage verlaagt item_type_stock (Rozenweg) pas nu, bij het afvinken; terugzetten zet het terug.
    if(['uit_pool','bestellen','afschrijven_bestellen','naar_pool'].includes(r.kantoor_actie)&&(r.kantoor_aantal||0)>0&&aan!==(r.aangevuld?1:0)){
      const bi=r.item_id?get('SELECT item_type_id FROM bak_items WHERE id=?',[r.item_id]):null;
      const typeId=(bi&&bi.item_type_id)||((get('SELECT id FROM item_types WHERE lower(naam)=lower(?) ORDER BY id LIMIT 1',[zonderHaakjes(r.item_naam||'').trim()])||{}).id);
      const roz=get("SELECT id FROM locaties WHERE name='Rozenweg' AND (parent_id IS NULL OR parent_id=0) ORDER BY id LIMIT 1");
      const st=typeId&&roz?get('SELECT * FROM item_type_stock WHERE item_type_id=? AND locatie_id=?',[typeId,roz.id]):null;
      const dl=(aan?1:-1)*(r.kantoor_actie==='naar_pool'?1:-1)*r.kantoor_aantal;
      if(st)updateMetLog(req,'item_type_stock',st.id,{qty:Math.max(0,(st.qty||0)+dl)},'aanvullen: '+zonderHaakjes(r.item_naam||''));
      else if(typeId&&roz&&dl>0)insMetLog(req,'INSERT INTO item_type_stock (item_type_id,locatie_id,qty,minimum) VALUES (?,?,?,0)',[typeId,roz.id,dl],'aanvullen');
    }
    logAct('nakijken',aan?'aangevuld':'aangevuld_terug',`${r.item_naam}: ${aan?'aangevuld':'teruggezet naar open'} door ${wie(req)||'?'}${fotoPad?' (foto '+fotoPad+')':''}`,s.locatie_id,_locNaam(s.locatie_id));
    res.json({ok:true,regel_id:r.id,aangevuld:aan,foto:fotoPad?'/uploads/'+fotoPad:null});
  });

  // ── Pagina's ──
  app.get('/nakijken',(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','nakijken.html')));
  // AV1: de aanvuller-pagina (gsm én desktop); de gegevens komen uit /api/aanvullijst
  app.get('/aanvullen',(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','aanvullen.html')));
  app.get('/aanvullijst-print',(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','aanvullijst-print.html')));
};
