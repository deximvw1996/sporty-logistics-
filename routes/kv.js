// routes/kv.js — KV-API (/api/kv/:token/*) en de pagina's /kv/:token en /tel/:token (monitor). KV1: uitgebreid.
// Kopjes: KV-scherm API (/api/kv/:token/*), S3.5 KV-SCHERM pagina (/kv/:token)
'use strict';
module.exports = function(ctx){
  const {zonderHaakjes}=require('../lib/tijd');
  const {app,db,get,all,run,ins,saveDb,backupDb,now,isoDate,_genToken,resolveItemTypeId,logAct,logWijziging,insMetLog,updateMetLog,delMetLog,vereisRol,alleenKantoor,hashPin,checkSessie,_actieveLocatieConfig,_kvVerwacht,_kvKampmoment,_kvNaam,_kvEinde,_kvLinkStand,_bakItems,effectiefMateriaal,ensureGedeeldStock,DATA_DIR,DB_PATH,UPLOADS_DIR,BUNDELS_DIR,FRONTEND_PATH,ROOT_DIR,APP_PASSWORD,PORT,path,fs,express,crypto} = ctx;

  // KV1: toegang via kv_token (volledig) of monitor_token (enkel tellen). Resultaat {km,monitor} of null.
  const fotosKv=require('../lib/fotos')(ctx.UPLOADS_DIR);
  // GF1: elke KV-schrijfactie loopt via de log-helpers (tabel wijzigingen, context kv-link, wie = de KV) → omkeerbaar en zichtbaar in Nakijken › Historiek.
  const _ins=(req,sql,p)=>insMetLog(req,sql,p,'kv-link');
  const _upd=(req,sql,p)=>updateMetLog(req,sql,p,'kv-link');
  const _del=(req,sql,p)=>ctx.delMetLog(req,sql,p,'kv-link');
  const isoNu=()=>new Date().toISOString();
  const _wieIsKv=(req,km,monitor)=>{ req.persoon={persoon_id:null,naam:(monitor?'monitor ':'')+(_kvNaam(km)||'KV')+' (KV)',rol:'kv'}; };
  function _toegang(token){
    if(!token)return null;
    let km=_kvKampmoment(token);
    if(km)return {km,monitor:false};
    km=get("SELECT * FROM kampmomenten WHERE monitor_token=? AND monitor_token<>''",[token]);
    return km?{km,monitor:true}:null;
  }
  // Geeft het kampmoment, of beantwoordt de aanvraag met 403 (ongeldig token, of monitor-token op een route die enkel de KV mag).
  function _kmVan(req,res,alleenKv){
    const t=_toegang(req.params.token);
    if(!t){res.status(403).json({error:'Ongeldige of verlopen link'});return null;}
    _wieIsKv(req,t.km,t.monitor);
    const stand=_kvLinkStand(t.km);
    if(stand!=='open'){res.status(403).json({error:stand==='dicht'?'Dit kamp is afgelopen: de link is gesloten. Je tellingen blijven bewaard.':'Dit kamp is afgelopen: je kan alles nog lezen maar niets meer wijzigen. Je tellingen blijven bewaard.',link_stand:stand});return null;}
    if(t.monitor&&alleenKv){res.status(403).json({error:'Met deze link kan je enkel tellen. Aanvragen en melden kan met de link van de kampverantwoordelijke.'});return null;}
    return t.km;
  }
  // ── TF5 punt 1: tellingen zijn onwisbaar ──
  // Elke telling = een rij in kv_telling_versies, elke keer versturen = een rij in kv_verstuurd (triggers weigeren wijzigen en wissen).
  // nakijk_regels blijft de stand waarop kantoor beslist: tellen in een sessie die nog 'bezig' is schrijft er meteen in; natellen na versturen pas bij het volgende versturen.
  const _laatsteVerstuurd=kmId=>get('SELECT * FROM kv_verstuurd WHERE kampmoment_id=? ORDER BY id DESC LIMIT 1',[kmId]);
  const _vSleutel=v=>v.attribuut_id?'a'+v.attribuut_id:'s'+v.sessie_id+':'+v.item_id;
  const _zelfde=(a,b)=>a&&b&&(a.geteld??null)===(b.geteld??null)&&(a.kapot||0)===(b.kapot||0)&&(a.status||'')===(b.status||'')&&(a.notitie||'')===(b.notitie||'')&&(a.foto_path||'')===(b.foto_path||'');
  function _laatsteVersies(kmId,totId){
    const m=new Map();all('SELECT * FROM kv_telling_versies WHERE kampmoment_id=? ORDER BY id',[kmId]).forEach(v=>{if(totId==null||v.id<=totId)m.set(_vSleutel(v),v);});
    return m;
  }
  function _wijzigingen(kmId){
    const l=_laatsteVerstuurd(kmId),tot=l?l.tot_versie:0,oud=_laatsteVersies(kmId,tot),nu=_laatsteVersies(kmId);
    const uit=[];nu.forEach((v,k)=>{if(v.id<=tot)return;const o=oud.get(k);if(_zelfde(o,v))return;uit.push({oud:o||null,nieuw:v});});
    return uit;
  }
  const _waarde=v=>!v?'—':v.status||(v.geteld==null?'—':String(v.geteld));
  const _wijzigTekst=w=>{const v=w.nieuw,n=w.oud,kap=(v.kapot||0)!==((n&&n.kapot)||0)&&v.kapot?', '+v.kapot+' kapot':'';
    return (v.code?v.code+': ':'')+zonderHaakjes(v.item_naam)+' '+_waarde(n)+' → '+_waarde(v)+kap+(v.notitie&&(!n||n.notitie!==v.notitie)?", '"+v.notitie+"'":'');};
  const _nagekeken=s=>['nagekeken','verwerkt'].includes(s.kantoor_status)||(!!s.kantoor_afgerond_op&&s.kantoor_status!=='open');
  // Een regel waarop kantoor al besliste blijft staan zoals hij is. Is het tekort of het aantal kapot groter dan waarop besloten is, dan komt het verschil
  // als gemelde regel (dezelfde weg als de melding van de aanvuller), opgeteld bij een open regel van dat stuk. Afwijkingen die kleiner worden, staan alleen in de historiek en de melding.
  function _gemeldErbij(req,sessieId,naam,soort,n,kvNaam){
    const open=get("SELECT * FROM nakijk_regels WHERE sessie_id=? AND gemeld_soort=? AND lower(item_naam)=lower(?) AND COALESCE(kantoor_actie,'')='' ORDER BY id DESC",[sessieId,soort,naam]);
    if(open)updateMetLog(req,'nakijk_regels',open.id,{kantoor_aantal:(open.kantoor_aantal||0)+n,kapot_aantal:soort==='kapot'?(open.kapot_aantal||0)+n:0},'KV natelling (erbij)');
    else insMetLog(req,'INSERT INTO nakijk_regels (sessie_id,item_naam,item_id,verwacht,aangetroffen,kapot_aantal,kantoor_aantal,gemeld_soort,gemeld_door,tekort_status) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [sessieId,naam,null,0,null,soort==='kapot'?n:0,n,soort,kvNaam?kvNaam+' (KV)':'KV','open'],'KV natelling');
  }
  // Geeft true als dit een afwijking is die kantoor nog moet zien.
  function _pasNatellingToe(req,s,v,kvNaam){
    if(v.attribuut_id){
      const regel=get('SELECT * FROM nakijk_regels WHERE sessie_id=? AND item_naam=?',[s.id,v.item_naam]);
      updateMetLog(req,'UPDATE nakijk_sessies SET notities=? WHERE id=?',[v.status,s.id],'KV natelling');
      if(v.status==='beschadigd'){
        if(regel&&regel.kantoor_actie)return false;
        if(regel)updateMetLog(req,'UPDATE nakijk_regels SET aangetroffen=1,verwacht=1,kapot_aantal=1,is_kapot=1,ontbreekt=0 WHERE id=?',[regel.id],'KV natelling');
        else insMetLog(req,'INSERT INTO nakijk_regels (sessie_id,item_naam,item_id,verwacht,aangetroffen,ontbreekt,is_kapot,kapot_aantal) VALUES (?,?,NULL,1,1,0,1,1)',[s.id,v.item_naam],'KV natelling');
        return true;
      }
      if(regel)updateMetLog(req,'UPDATE nakijk_regels SET kapot_aantal=0,is_kapot=0 WHERE id=?',[regel.id],'KV natelling');
      return false;
    }
    const r=get('SELECT * FROM nakijk_regels WHERE sessie_id=? AND item_id=?',[s.id,v.item_id]);
    const verwacht=v.verwacht||0,tekort=Math.max(0,verwacht-v.geteld),teVeel=Math.max(0,v.geteld-verwacht),kapot=v.kapot||0;
    if(r&&r.kantoor_actie){
      const som=soort=>(get("SELECT COALESCE(SUM(kantoor_aantal),0) AS n FROM nakijk_regels WHERE sessie_id=? AND gemeld_soort=? AND lower(item_naam)=lower(?)",[s.id,soort,r.item_naam])||{}).n||0;
      const erbijT=tekort-Math.max(0,(r.verwacht||0)-(r.aangetroffen||0))-som('weg'),erbijK=kapot-(r.kapot_aantal||0)-som('kapot');
      if(erbijT>0)_gemeldErbij(req,s.id,r.item_naam,'weg',erbijT,kvNaam);
      if(erbijK>0)_gemeldErbij(req,s.id,r.item_naam,'kapot',erbijK,kvNaam);
      return erbijT>0||erbijK>0;
    }
    if(r)updateMetLog(req,'UPDATE nakijk_regels SET aangetroffen=?,ontbreekt=?,verwacht=?,te_veel=?,kapot_aantal=?,is_kapot=?,notitie=?,foto_path=? WHERE id=?',[v.geteld,tekort,verwacht,teVeel,kapot,kapot>0?1:0,v.notitie||'',v.foto_path||'',r.id],'KV natelling');
    else insMetLog(req,'INSERT INTO nakijk_regels (sessie_id,item_naam,item_id,verwacht,aangetroffen,ontbreekt,te_veel,kapot_aantal,is_kapot,notitie,foto_path) VALUES (?,?,?,?,?,?,?,?,?,?,?)',[s.id,v.item_naam,v.item_id,verwacht,v.geteld,tekort,teVeel,kapot,kapot>0?1:0,v.notitie||'',v.foto_path||''],'KV natelling');
    return tekort>0||teVeel>0||kapot>0;
  }
  const _num=v=>{const n=parseFloat(v);return isNaN(n)?null:n;};
  function _itemStatus(gewenst,r){
    if(!r||r.aangetroffen==null)return 'nog_niet';
    if(r.aangetroffen<gewenst)return 'tekort';
    if((r.kapot_aantal||0)>0)return 'kapot';
    if(r.aangetroffen>gewenst)return 'te_veel';
    return 'ok';
  }
  function _taakInfo(t){
    if(!t)return null;
    const rit=t.rit_id?get('SELECT chauffeur,status FROM transport_ritten WHERE id=?',[t.rit_id]):null;
    const stuks=(get('SELECT COALESCE(SUM(qty),0) AS n FROM transport_regels WHERE taak_id=?',[t.id])||{}).n||0;
    return {datum:t.datum||'',tijd:t.tijd||'',chauffeur:(rit&&rit.chauffeur)||t.wie||'',stuks,status:t.status||'gepland',opmerking:t.opmerking||''};
  }

  app.get('/api/kv/:token/data',(req,res)=>{
    const t=_toegang(req.params.token);
    if(!t)return res.status(403).json({error:'Ongeldige of verlopen link'});
    const km=t.km, monitor=t.monitor;
    const linkStand=_kvLinkStand(km);
    if(linkStand==='dicht')return res.status(403).json({error:'Dit kamp is afgelopen: de link is gesloten. Je tellingen blijven bewaard.',link_stand:'dicht'});
    const versies=_laatsteVersies(km.id);
    const loc=get('SELECT * FROM locaties WHERE id=?',[km.locatie_id]);
    const {bakken,attributen}=_kvVerwacht(km);
    // V2b: sessies horen bij DIT kampmoment (niet meer locatie+week: dat ving de zomer-sessie van dezelfde week mee).
    const sessies=all("SELECT * FROM nakijk_sessies WHERE kampmoment_id=? AND kv_status IN ('bezig','ingediend')",[km.id]);
    const regelsAll=sessies.length?all(`SELECT * FROM nakijk_regels WHERE sessie_id IN (${sessies.map(()=>'?').join(',')})`,sessies.map(s=>s.id)):[];
    const bakkenOut=bakken.map(b=>{
      const items=_bakItems(b);
      const sessie=sessies.find(s=>s.bak_type===b.soort&&(b.soort==='thema'?s.thema_bak_id===b.id:s.vaste_bak_id===b.id));
      const regels=sessie?regelsAll.filter(r=>r.sessie_id===sessie.id):[];
      const itemsOut=items.map(it=>{
        const r0=regels.find(r=>r.item_id===it.id),v=sessie?versies.get('s'+sessie.id+':'+it.id):null; // TF5: de KV ziet zijn laatste telling, ook als die nog niet verstuurd is
        const r=v?{aangetroffen:v.geteld,kapot_aantal:v.kapot,notitie:v.notitie,foto_path:v.foto_path}:r0;
        const aang=(r&&r.aangetroffen!=null)?r.aangetroffen:null;
        const kap=r?(r.kapot_aantal||0):0;
        return {id:it.id, naam:zonderHaakjes(it.naam), gewenst:it.qty, aangetroffen:aang,
          te_veel:aang!=null&&aang>it.qty?aang-it.qty:0, kapot_aantal:kap, notitie:(r&&r.notitie)||'',
          foto_url:(r&&r.foto_path)?'/uploads/'+r.foto_path:null, status:_itemStatus(it.qty,r&&aang!=null?{aangetroffen:aang,kapot_aantal:kap}:null)};
      });
      const geteld=itemsOut.filter(i=>i.aangetroffen!=null).length;
      const st=itemsOut.map(i=>i.status);
      const afw=st.includes('tekort')?'tekort':st.includes('kapot')?'kapot':st.includes('te_veel')?'te_veel':null;
      const status=afw||(itemsOut.length&&geteld===itemsOut.length?'ok':'nog_niet');
      const th=b.soort==='thema'?(get('SELECT t.name,t.leeftijdsgroep FROM thema_bak tb JOIN themas t ON t.id=tb.thema_id JOIN kampmoment_themas kt ON kt.thema_id=t.id AND kt.kampmoment_id=? WHERE tb.bak_id=? ORDER BY t.id LIMIT 1',[km.id,b.id])||get('SELECT t.name,t.leeftijdsgroep FROM thema_bak tb JOIN themas t ON t.id=tb.thema_id WHERE tb.bak_id=? ORDER BY t.id LIMIT 1',[b.id])):null;
      const bn=zonderHaakjes(b.naam);
      return {id:b.id, soort:b.soort, code:b.code, naam:th&&/^Themabak/i.test(bn)?th.name+' · '+bn:bn, ingediend:sessie?sessie.kv_status==='ingediend':false,thema:th?th.name:'',groep:th?(th.leeftijdsgroep||''):'',
        status, geteld, aantal:itemsOut.length, items:itemsOut};
    });
    const attrSessies=sessies.filter(s=>s.bak_type==='attribuut');
    const attributenOut=attributen.map(a=>{
      const s=attrSessies.find(s=>s.attribuut_id===a.id);
      const va=versies.get('a'+a.id),st=va?va.status:s?(s.notities||null):null;
      return {id:a.id, code:a.code, naam:zonderHaakjes(a.naam), status:st, uitslag:st==='aanwezig'?'ok':st==='beschadigd'?'kapot':'nog_niet'};
    });
    // Datums van de kampweek (ma–vr) uit de periode.
    let dagen=null;
    const per=km.periode_id?get('SELECT * FROM vakantieperiodes WHERE id=?',[km.periode_id]):null;
    if(per&&per.start_datum&&km.week){
      const d0=new Date(per.start_datum+'T12:00:00');d0.setDate(d0.getDate()+(km.week-1)*7);
      const d4=new Date(d0);d4.setDate(d4.getDate()+4);
      const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      dagen={van:iso(d0),tot:iso(d4)};
    }
    const basis={
      kampNaam:(loc?loc.name:'?')+' — week '+km.week,
      kampLocatie:loc?loc.name:'', week:km.week, dagen, kvNaam:_kvNaam(km), monitor,
      bakken:bakkenOut, attributen:attributenOut, link_stand:linkStand, einde:_kvEinde(km),
      verstuurd:(l=>l?{op:l.op,wie:l.wie}:null)(_laatsteVerstuurd(km.id)), niet_verstuurd:_wijzigingen(km.id).length
    };
    if(monitor)return res.json(basis); // monitor-stand: enkel het telscherm
    // Monitor-link voor dit kampmoment (lazy aangemaakt, zelfde opzet als kv_token).
    let mtok=km.monitor_token;
    if(!mtok){mtok=_genToken(12);run('UPDATE kampmomenten SET monitor_token=? WHERE id=?',[mtok,km.id]);saveDb();}
    const aanvragen=all("SELECT * FROM aanvragen WHERE kampmoment_id=? AND soort IN ('materiaal','kapot') ORDER BY id DESC",[km.id])
      .map(a=>({...a,antwoord:a.reden||'',foto_url:a.foto_data||null}));
    // S4.8: KV-boodschappenlijst — "KV: "-regels van de gekoppelde thema's.
    const ktsKm=all('SELECT thema_id FROM kampmoment_themas WHERE kampmoment_id=?',[km.id]);
    const themaIdsKm=[...new Set(ktsKm.map(k=>k.thema_id))];
    let boodschappen=[];
    if(themaIdsKm.length){
      const ph=themaIdsKm.map(()=>'?').join(',');
      boodschappen=all(`SELECT id,name,qty FROM thema_materiaal WHERE thema_id IN (${ph}) AND name LIKE 'KV:%'`,themaIdsKm)
        .map(r=>({id:r.id,naam:r.name.replace(/^KV:\s*/,''),qty:r.qty}));
    }
    const levTaak=get("SELECT * FROM transport_taken WHERE kampmoment_id=? AND type='levering' AND status<>'geannuleerd' ORDER BY datum,COALESCE(tijd,''),id LIMIT 1",[km.id]);
    const ophTaak=get("SELECT * FROM transport_taken WHERE kampmoment_id=? AND type='ophaling' AND status<>'geannuleerd' ORDER BY datum DESC,COALESCE(tijd,'') DESC,id DESC LIMIT 1",[km.id]);
    const lev=_taakInfo(levTaak), oph=_taakInfo(ophTaak);
    if(oph){oph.deel=/deel/i.test(oph.opmerking)?'deelophaling':'';}
    if(lev)delete lev.opmerking; if(oph)delete oph.opmerking;
    const kantoorTel=(get("SELECT waarde FROM app_vlaggen WHERE naam='kantoor_telefoon'")||{}).waarde||'';
    res.json({
      ...basis,
      aanvragen, boodschappen,
      // CH1: problemen die de chauffeur bij deze locatie meldde (zelfde rij als in kantoor-aanvragen).
      meldingen_chauffeur:all("SELECT id,tekst,status,created_at,foto_data FROM aanvragen WHERE kampmoment_id=? AND soort='probleem_chauffeur' ORDER BY id DESC",[km.id]),
      // VC1: herinneringen en notities van kantoor aan de KV (nakijken).
      meldingen_kantoor:all("SELECT id,soort,tekst,status,created_at FROM aanvragen WHERE kampmoment_id=? AND soort IN ('herinnering_kv','notitie_kantoor') ORDER BY id DESC",[km.id]),
      levering:lev, ophaling:oph,
      kantoor:{telefoon:kantoorTel},
      locatie:{naam:loc?loc.name:'',adres:loc?(loc.addr||''):'',sleutel_info:loc?(loc.sleutel_info||''):''},
      monitor_url:'/tel/'+mtok
    });
  });

  app.post('/api/kv/:token/bakken/:bakId/tellen',(req,res)=>{
    const km=_kmVan(req,res,false);
    if(!km)return;
    const {bakken}=_kvVerwacht(km);
    const bak=bakken.find(b=>b.id===parseInt(req.params.bakId));
    if(!bak)return res.status(403).json({error:'Deze bak hoort niet bij dit kampmoment'});
    // S5.4b: weiger lege/misvormde payload i.p.v. stil ok:true teruggeven.
    const regelsIn=Array.isArray(req.body?.regels)?req.body.regels:null;
    if(!regelsIn||!regelsIn.length)return res.status(400).json({error:'regels is verplicht en mag niet leeg zijn'});
    const items0=_bakItems(bak);
    const ongeldig=regelsIn.some(rin=>{
      const itemIdOk=rin&&rin.item_id!=null&&items0.some(i=>i.id===rin.item_id);
      const aangetroffenOk=rin&&rin.aangetroffen!=null&&!isNaN(parseFloat(rin.aangetroffen))&&parseFloat(rin.aangetroffen)>=0;
      const kapotOk=rin&&(rin.kapot_aantal==null||(!isNaN(parseFloat(rin.kapot_aantal))&&parseFloat(rin.kapot_aantal)>=0));
      return !itemIdOk||!aangetroffenOk||!kapotOk;
    });
    if(ongeldig)return res.status(400).json({error:'Elke regel heeft een geldig item_id en aangetroffen (≥0) nodig; kapot_aantal mag niet negatief zijn'});
    const kvNaam=_kvNaam(km);
    const veldNaam=bak.soort==='thema'?'thema_bak_id':'vaste_bak_id';
    let sessie=get(`SELECT * FROM nakijk_sessies WHERE bak_type=? AND ${veldNaam}=? AND kampmoment_id=? AND kv_status IN ('bezig','ingediend')`,
      [bak.soort,bak.id,km.id]);
    // Foto's eerst valideren, zodat een slechte foto niets half bewaart.
    const fotoPaden=new Map();
    try{
      regelsIn.forEach(rin=>{
        if(typeof rin.foto_data!=='string'||!rin.foto_data||fotosKv.isUrl(rin.foto_data))return;
        fotoPaden.set(rin.item_id,fotosKv.bewaarFoto(rin.foto_data,'nakijk'));
      });
    }catch(e){ fotoPaden.forEach(p=>fotosKv.verwijderFoto(p)); return res.status(e.status||400).json({error:e.status?e.message:'Foto opslaan mislukt'}); }
    let sessieId;
    if(sessie){ sessieId=sessie.id; if(sessie.kv_status==='bezig')_upd(req,'UPDATE nakijk_sessies SET kv_wie=?,kv_tijdstip=? WHERE id=?',[kvNaam,now(),sessieId]); }
    else {
      sessieId=_ins(req,`INSERT INTO nakijk_sessies (bak_type,thema_bak_id,vaste_bak_id,locatie_id,week,kampmoment_id,datum,kv_wie,kv_status,kantoor_status) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [bak.soort, bak.soort==='thema'?bak.id:null, bak.soort==='vast'?bak.id:null, km.locatie_id, km.week, km.id, now(), kvNaam, 'bezig', 'open']);
    }
    const items=_bakItems(bak);
    regelsIn.forEach(rin=>{
      const item=items.find(i=>i.id===rin.item_id);
      if(!item)return;
      const aangetroffen=Math.max(0,parseFloat(rin.aangetroffen)||0);
      const ontbreekt=Math.max(0,(item.qty||0)-aangetroffen);
      const teVeel=Math.max(0,aangetroffen-(item.qty||0));
      const bestaand=get('SELECT * FROM nakijk_regels WHERE sessie_id=? AND item_id=?',[sessieId,item.id]);
      const vorige=get('SELECT * FROM kv_telling_versies WHERE sessie_id=? AND item_id=? ORDER BY id DESC LIMIT 1',[sessieId,item.id]);
      const kapot=rin.kapot_aantal!=null?Math.max(0,parseFloat(rin.kapot_aantal)||0):(vorige?(vorige.kapot||0):bestaand?(bestaand.kapot_aantal||0):0);
      const notitie=rin.notitie!=null?String(rin.notitie).slice(0,500):(vorige?(vorige.notitie||''):bestaand?(bestaand.notitie||''):'');
      // TF5: een oude foto blijft op schijf: eerdere versies wijzen ernaar.
      let fotoPad=vorige?(vorige.foto_path||''):bestaand?(bestaand.foto_path||''):'';
      if(fotoPaden.has(item.id))fotoPad=fotoPaden.get(item.id);
      else if(rin.foto_data==='')fotoPad='';
      ins("INSERT INTO kv_telling_versies (kampmoment_id,sessie_id,item_id,code,item_naam,verwacht,geteld,kapot,te_veel,notitie,foto_path,wie,via,op) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [km.id,sessieId,item.id,bak.code||'',item.naam,item.qty,aangetroffen,kapot,teVeel,notitie,fotoPad,req.persoon.naam,_toegang(req.params.token).monitor?'monitor-link':'kv-link',isoNu()]);
      if(sessie&&sessie.kv_status==='ingediend')return; // natelling: telt pas in Nakijken bij het volgende versturen
      if(bestaand) _upd(req,'UPDATE nakijk_regels SET aangetroffen=?,ontbreekt=?,verwacht=?,te_veel=?,kapot_aantal=?,is_kapot=?,notitie=?,foto_path=? WHERE id=?',
        [aangetroffen,ontbreekt,item.qty,teVeel,kapot,kapot>0?1:0,notitie,fotoPad,bestaand.id]);
      else _ins(req,'INSERT INTO nakijk_regels (sessie_id,item_naam,item_id,verwacht,aangetroffen,ontbreekt,te_veel,kapot_aantal,is_kapot,notitie,foto_path) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        [sessieId,item.naam,item.id,item.qty,aangetroffen,ontbreekt,teVeel,kapot,kapot>0?1:0,notitie,fotoPad]);
    });
    res.json({ok:true});
  });

  app.post('/api/kv/:token/attributen/:attrId/status',(req,res)=>{
    const km=_kmVan(req,res,false);
    if(!km)return;
    const {attributen}=_kvVerwacht(km);
    const attr=attributen.find(a=>a.id===parseInt(req.params.attrId));
    if(!attr)return res.status(403).json({error:'Dit attribuut hoort niet bij dit kampmoment'});
    // S5.4b: weiger een ongeldige status i.p.v. ze stil te vervangen door ''.
    if(!['aanwezig','beschadigd'].includes(req.body?.status))
      return res.status(400).json({error:"status moet 'aanwezig' of 'beschadigd' zijn"});
    const status=req.body.status;
    const kvNaam=_kvNaam(km);
    let sessie=get("SELECT * FROM nakijk_sessies WHERE bak_type='attribuut' AND attribuut_id=? AND kampmoment_id=? AND kv_status IN ('bezig','ingediend')",
      [attr.id,km.id]);
    let sessieId;
    const _versie=sid=>ins("INSERT INTO kv_telling_versies (kampmoment_id,sessie_id,attribuut_id,code,item_naam,verwacht,geteld,kapot,status,wie,via,op) VALUES (?,?,?,?,?,1,1,?,?,?,?,?)",
      [km.id,sid,attr.id,attr.code||'',attr.naam,status==='beschadigd'?1:0,status,req.persoon.naam,_toegang(req.params.token).monitor?'monitor-link':'kv-link',isoNu()]);
    if(sessie&&sessie.kv_status==='ingediend'){_versie(sessie.id);return res.json({ok:true,status});} // TF5: natelling telt bij het volgende versturen
    if(sessie){ _upd(req,'UPDATE nakijk_sessies SET notities=?,kv_wie=?,kv_tijdstip=? WHERE id=?',[status,kvNaam,now(),sessie.id]); sessieId=sessie.id; }
    else sessieId=_ins(req,"INSERT INTO nakijk_sessies (bak_type,attribuut_id,locatie_id,week,kampmoment_id,datum,kv_wie,kv_status,kantoor_status,notities) VALUES ('attribuut',?,?,?,?,?,?,?,?,?)",
      [attr.id,km.locatie_id,km.week,km.id,now(),kvNaam,'bezig','open',status]);
    _versie(sessieId);
    // TB1: een beschadigd attribuut krijgt een nakijk-regel (aanwezig, 1 kapot) zodat kantoor er een actie aan kan hangen en de
    // aanvullijst het toont; terug op "aanwezig" ruimt die regel weer op (enkel als kantoor er nog niets mee deed).
    const regel=get('SELECT * FROM nakijk_regels WHERE sessie_id=? AND item_naam=?',[sessieId,attr.naam]);
    if(status==='beschadigd'){
      if(regel)_upd(req,'UPDATE nakijk_regels SET aangetroffen=1,verwacht=1,kapot_aantal=1,is_kapot=1,ontbreekt=0 WHERE id=?',[regel.id]);
      else _ins(req,'INSERT INTO nakijk_regels (sessie_id,item_naam,item_id,verwacht,aangetroffen,ontbreekt,is_kapot,kapot_aantal) VALUES (?,?,NULL,1,1,0,1,1)',[sessieId,attr.naam]);
    }else if(regel){
      if(regel.kantoor_actie)_upd(req,'UPDATE nakijk_regels SET kapot_aantal=0,is_kapot=0 WHERE id=?',[regel.id]);
      else _del(req,'DELETE FROM nakijk_regels WHERE id=?',[regel.id]);
    }
    res.json({ok:true,status});
  });

  app.post('/api/kv/:token/versturen',(req,res)=>{
    const km=_kmVan(req,res,true);
    if(!km)return;
    const kvNaam=_kvNaam(km);
    // KV1: ook een onvolledige telling mag. Items die nog niet geteld zijn krijgen een regel zonder aantal
    // (aangetroffen = NULL, opmerking "niet geteld") zodat kantoor ziet wat ontbreekt i.p.v. niets.
    all("SELECT * FROM nakijk_sessies WHERE kampmoment_id=? AND kv_status='bezig' AND bak_type IN ('thema','vast')",[km.id]).forEach(s=>{
      const bak=s.bak_type==='thema'?get('SELECT * FROM bakken WHERE id=?',[s.thema_bak_id]):get('SELECT * FROM bakken WHERE id=?',[s.vaste_bak_id]);
      if(!bak)return;
      _bakItems(bak).forEach(it=>{
        if(get('SELECT id FROM nakijk_regels WHERE sessie_id=? AND item_id=?',[s.id,it.id]))return;
        _ins(req,"INSERT INTO nakijk_regels (sessie_id,item_naam,item_id,verwacht,aangetroffen,ontbreekt,opmerking) VALUES (?,?,?,?,NULL,0,'niet geteld')",[s.id,it.naam,it.id,it.qty]);
      });
    });
    const _kvLoc=(get('SELECT name FROM locaties WHERE id=?',[km.locatie_id])||{}).name||'';
    // TF5: natellingen in al verstuurde sessies gaan nu naar Nakijken; een afgeronde keuring heropent bij een afwijking. Wat kantoor besliste blijft staan.
    const wijz=_wijzigingen(km.id),vorigeKeer=_laatsteVerstuurd(km.id),nieuweBak=!!get("SELECT id FROM nakijk_sessies WHERE kampmoment_id=? AND kv_status='bezig' LIMIT 1",[km.id]);
    wijz.forEach(w=>{
      const s=get('SELECT * FROM nakijk_sessies WHERE id=?',[w.nieuw.sessie_id]);
      if(!s||s.kv_status!=='ingediend')return;
      const open=_pasNatellingToe(req,s,w.nieuw,kvNaam);
      if(open&&_nagekeken(s))updateMetLog(req,'nakijk_sessies',s.id,{kantoor_status:'open'},'KV natelling: keuring heropend');
    });
    if(ctx.melding&&(wijz.length||nieuweBak)){
      const lijst=vorigeKeer?wijz.map(_wijzigTekst):[];
      const tekst=lijst.length?`Telling bijgewerkt · ${_kvLoc}: ${lijst.slice(0,5).join(' · ')}${lijst.length>5?` · en ${lijst.length-5} meer`:''}`:`Telling verstuurd · ${_kvLoc}`;
      ctx.melding(req,{voor_rol:'kantoor',van_naam:kvNaam||'KV',tekst,link:'/nakijken'}); // ME1
    }
    _upd(req,"UPDATE nakijk_sessies SET kv_status='ingediend',kv_wie=?,kv_tijdstip=? WHERE kampmoment_id=? AND kv_status='bezig'",
      [kvNaam,now(),km.id]);
    if(!wijz.length&&!nieuweBak)return res.json({ok:true,gewijzigd:0});
    const op=isoNu(),tot=(get('SELECT MAX(id) AS m FROM kv_telling_versies WHERE kampmoment_id=?',[km.id])||{}).m||0;
    ins('INSERT INTO kv_verstuurd (kampmoment_id,op,wie,aantal,samenvatting,tot_versie) VALUES (?,?,?,?,?,?)',[km.id,op,kvNaam||'KV',wijz.length,wijz.map(_wijzigTekst).join(' · ').slice(0,2000),tot]);
    res.json({ok:true,gewijzigd:wijz.length,verstuurd_op:op});
  });

  app.post('/api/kv/:token/aanvraag',(req,res)=>{
    const km=_kmVan(req,res,true);
    if(!km)return;
    const tekst=(req.body?.tekst||'').trim();
    if(!tekst)return res.status(400).json({error:'Tekst is verplicht'});
    const aantal=_num(req.body?.aantal);
    let f={pad:'',url:''};
    if(req.body?.foto_data){try{f=fotosKv.verwerkWaarde(req.body.foto_data,'','aanvraag');}catch(e){return res.status(e.status||500).json({error:e.status?e.message:'Foto opslaan mislukt'});}}
    const volledig=aantal&&aantal>0?aantal+' × '+tekst:tekst;
    const id=insMetLog(req,'INSERT INTO aanvragen (kampmoment_id,persoon_id,soort,tekst,foto_data,foto_path,status,created_at) VALUES (?,?,?,?,?,?,?,?)',
      [km.id,km.kv_persoon_id||null,'materiaal',volledig,f.url,f.pad,'nieuw',now()],'kv-link');
    if(ctx.melding)ctx.melding(req,{voor_rol:'kantoor',van_naam:_kvNaam(km)||'KV',tekst:`Aanvraag: ${volledig} · ${(get('SELECT name FROM locaties WHERE id=?',[km.locatie_id])||{}).name||''}`,link:'/vandaag?tab=beslissen'}); // ME1
    res.json(get('SELECT * FROM aanvragen WHERE id=?',[id]));
  });

  app.post('/api/kv/:token/kapot',(req,res)=>{
    const km=_kmVan(req,res,true);
    if(!km)return;
    const tekst=(req.body?.tekst||'').trim();
    if(!tekst)return res.status(400).json({error:'Omschrijving is verplicht'});
    let f={pad:'',url:''};
    if(req.body?.foto_data){try{f=fotosKv.verwerkWaarde(req.body.foto_data,'','aanvraag');}catch(e){return res.status(e.status||500).json({error:e.status?e.message:'Foto opslaan mislukt'});}}
    const aantal=_num(req.body?.aantal);
    const volledig=aantal&&aantal>0?aantal+' × '+tekst:tekst;
    const id=insMetLog(req,'INSERT INTO aanvragen (kampmoment_id,persoon_id,soort,tekst,foto_data,foto_path,status,created_at) VALUES (?,?,?,?,?,?,?,?)',
      [km.id,km.kv_persoon_id||null,'kapot',volledig,f.url,f.pad,'nieuw',now()],'kv-link');
    if(ctx.melding)ctx.melding(req,{voor_rol:'kantoor',van_naam:_kvNaam(km)||'KV',tekst:`Kapot: ${volledig} · ${(get('SELECT name FROM locaties WHERE id=?',[km.locatie_id])||{}).name||''}`,link:'/vandaag?tab=beslissen'}); // ME1
    res.json(get('SELECT * FROM aanvragen WHERE id=?',[id]));
  });

  // GF1: kampmoment VOLLEDIG verwijderen — ook wat er aan hangt (taken + regels + checks, KV-tellingen, aanvragen en meldingen, kalenderdagen
  // van die week). 409 als er al iets geladen is. De gewone DELETE /api/kampmomenten/:id laat dit restant staan.
  app.post('/api/kampmomenten/:id/volledig-verwijderen',alleenKantoor,(req,res)=>{
    const km=get('SELECT * FROM kampmomenten WHERE id=?',[req.params.id]);
    if(!km)return res.status(404).json({error:'Dit kampmoment bestaat niet (meer).'});
    const loc=get('SELECT name FROM locaties WHERE id=?',[km.locatie_id])||{};
    const geladen=get('SELECT COUNT(*) AS n FROM verhuis_checks vc JOIN transport_taken t ON t.id=vc.taak_id WHERE t.kampmoment_id=? AND vc.geladen=1',[km.id]).n;
    if(geladen)return res.status(409).json({error:`${loc.name||'Dit kampmoment'} week ${km.week}: ${geladen} stuk${geladen===1?' is':'ken zijn'} al geladen — verwijderen kan pas als dat teruggedraaid is. Er is niets verwijderd.`});
    const telling={taken:0,sessies:0,aanvragen:0,kalenderdagen:0};
    all('SELECT id FROM transport_taken WHERE kampmoment_id=?',[km.id]).forEach(t=>{
      run('DELETE FROM transport_regels WHERE taak_id=?',[t.id]);
      delMetLog(req,'DELETE FROM verhuis_checks WHERE taak_id=?',[t.id],'volledig-verwijderen');
      delMetLog(req,'DELETE FROM transport_taken WHERE id=?',[t.id],'volledig-verwijderen');telling.taken++;
    });
    all('SELECT id FROM nakijk_sessies WHERE kampmoment_id=?',[km.id]).forEach(s=>{
      // TF5: de foto's blijven op schijf; kv_telling_versies wijst ernaar en wordt nooit gewist.
      delMetLog(req,'DELETE FROM nakijk_regels WHERE sessie_id=?',[s.id],'volledig-verwijderen');
      delMetLog(req,'DELETE FROM nakijk_sessies WHERE id=?',[s.id],'volledig-verwijderen');telling.sessies++;
    });
    all('SELECT foto_path FROM aanvragen WHERE kampmoment_id=? AND foto_path<>\'\'',[km.id]).forEach(r=>{try{fotosKv.verwijderFoto(r.foto_path);}catch(e){}});
    telling.aanvragen=delMetLog(req,'DELETE FROM aanvragen WHERE kampmoment_id=?',[km.id],'volledig-verwijderen');
    const per=get('SELECT * FROM vakantieperiodes WHERE id=?',[km.periode_id]);
    if(per&&per.start_datum&&km.week){
      for(let i=0;i<7;i++){const d=new Date(per.start_datum+'T12:00:00');d.setDate(d.getDate()+(km.week-1)*7+i);
        const iso=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
        const n=get('SELECT COUNT(*) AS n FROM kalender_dagen WHERE locatie_id=? AND datum=?',[km.locatie_id,iso]).n;
        if(n){run('DELETE FROM kalender_dagen WHERE locatie_id=? AND datum=?',[km.locatie_id,iso]);telling.kalenderdagen+=n;}}
    }
    run('DELETE FROM kampmoment_themas WHERE kampmoment_id=?',[km.id]);
    delMetLog(req,'DELETE FROM kampmomenten WHERE id=?',[km.id],'volledig-verwijderen');
    logAct('kampmoment','volledig verwijderd',`Week ${km.week} — ${loc.name||'?'} volledig verwijderd (${telling.taken} taken, ${telling.sessies} tellingen, ${telling.aanvragen} aanvragen) door ${(req.persoon&&req.persoon.naam)||'kantoor'}`,km.locatie_id,loc.name||null);
    res.json({ok:true,verwijderd:telling});
  });

  // KV1: de pagina's staan in public/kv.{html,css,js} (exacte kopie van design/KV-DEFINITIEF.html) en tekenen zich uit
  // GET /api/kv/:token/data. /kv/:token = volledige KV-pagina, /tel/:token = monitor-stand (enkel tellen).
  const _kvBestand=n=>fs.readFileSync(path.join(__dirname,'..','public',n),'utf8');
  function _kvPagina(res,token,monitor){
    let html;
    try{ html=_kvBestand('kv.html'); }
    catch(e){ return res.status(500).send('<h2 style="font-family:system-ui;padding:2rem">De pagina kon niet geladen worden. Probeer het zo opnieuw.</h2>'); }
    const veilig=t=>t.replace(/<\/(script|style)/gi,'<\\/$1');
    res.set('Cache-Control','no-store').send(html
      .replace('{{TITEL}}',()=>monitor?'Tellen':'KV-scherm')
      .replace('{{CSS}}',()=>veilig(_kvBestand('kv.css')))
      .replace('{{TOKEN}}',()=>JSON.stringify(token).replace(/</g,'\\u003c'))
      .replace('{{MONITOR}}',()=>monitor?'true':'false')
      .replace('{{JS}}',()=>veilig(_kvBestand('kv.js'))));
  }
  const _kvFoutPagina='<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Link niet gevonden</title></head><body><h2 style="font-family:system-ui;padding:2rem">Link niet gevonden of verlopen.</h2></body></html>';
  const _kvDichtPagina='<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kamp afgelopen</title></head><body style="font-family:system-ui;padding:2rem;max-width:480px;margin:0 auto"><h2>Dit kamp is afgelopen</h2><p>De link is gesloten. Je tellingen en aanvragen blijven bewaard bij Sporty. Heb je nog een vraag? Neem contact op met kantoor.</p></body></html>';
  app.get('/kv/:token',(req,res)=>{
    const km0=_kvKampmoment(req.params.token);
    if(!km0)return res.status(404).send(_kvFoutPagina);
    if(_kvLinkStand(km0)==='dicht')return res.status(410).send(_kvDichtPagina);
    _kvPagina(res,req.params.token,false);
  });
  app.get('/tel/:token',(req,res)=>{
    const t=_toegang(req.params.token);
    if(!t||!t.monitor)return res.status(404).send(_kvFoutPagina);
    if(_kvLinkStand(t.km)==='dicht')return res.status(410).send(_kvDichtPagina);
    _kvPagina(res,req.params.token,true);
  });

};
