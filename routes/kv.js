// routes/kv.js — KV-API (/api/kv/:token/*) en de pagina's /kv/:token en /tel/:token (monitor). KV1: uitgebreid.
// Kopjes: KV-scherm API (/api/kv/:token/*), S3.5 KV-SCHERM pagina (/kv/:token)
'use strict';
module.exports = function(ctx){
  const {app,db,get,all,run,ins,saveDb,backupDb,now,isoDate,_genToken,resolveItemTypeId,logAct,logWijziging,insMetLog,updateMetLog,delMetLog,vereisRol,alleenKantoor,hashPin,checkSessie,_actieveLocatieConfig,_kvVerwacht,_kvKampmoment,_kvNaam,_bakItems,effectiefMateriaal,ensureGedeeldStock,DATA_DIR,DB_PATH,UPLOADS_DIR,BUNDELS_DIR,FRONTEND_PATH,ROOT_DIR,APP_PASSWORD,PORT,path,fs,express,crypto} = ctx;

  // KV1: toegang via kv_token (volledig) of monitor_token (enkel tellen). Resultaat {km,monitor} of null.
  const fotosKv=require('../lib/fotos')(ctx.UPLOADS_DIR);
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
    if(t.monitor&&alleenKv){res.status(403).json({error:'Met deze link kan je enkel tellen. Aanvragen en melden kan met de link van de kampverantwoordelijke.'});return null;}
    return t.km;
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
        const r=regels.find(r=>r.item_id===it.id);
        const aang=(r&&r.aangetroffen!=null)?r.aangetroffen:null;
        const kap=r?(r.kapot_aantal||0):0;
        return {id:it.id, naam:it.naam, gewenst:it.qty, aangetroffen:aang,
          te_veel:aang!=null&&aang>it.qty?aang-it.qty:0, kapot_aantal:kap, notitie:(r&&r.notitie)||'',
          foto_url:(r&&r.foto_path)?'/uploads/'+r.foto_path:null, status:_itemStatus(it.qty,r&&aang!=null?{aangetroffen:aang,kapot_aantal:kap}:null)};
      });
      const geteld=itemsOut.filter(i=>i.aangetroffen!=null).length;
      const st=itemsOut.map(i=>i.status);
      const afw=st.includes('tekort')?'tekort':st.includes('kapot')?'kapot':st.includes('te_veel')?'te_veel':null;
      const status=afw||(itemsOut.length&&geteld===itemsOut.length?'ok':'nog_niet');
      return {id:b.id, soort:b.soort, code:b.code, naam:b.naam, ingediend:sessie?sessie.kv_status==='ingediend':false,
        status, geteld, aantal:itemsOut.length, items:itemsOut};
    });
    const attrSessies=sessies.filter(s=>s.bak_type==='attribuut');
    const attributenOut=attributen.map(a=>{
      const s=attrSessies.find(s=>s.attribuut_id===a.id);
      const st=s?(s.notities||null):null;
      return {id:a.id, code:a.code, naam:a.naam, status:st, uitslag:st==='aanwezig'?'ok':st==='beschadigd'?'kapot':'nog_niet'};
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
      bakken:bakkenOut, attributen:attributenOut
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
    if(sessie){ sessieId=sessie.id; run('UPDATE nakijk_sessies SET kv_wie=?,kv_tijdstip=? WHERE id=?',[kvNaam,now(),sessieId]); }
    else {
      sessieId=ins(`INSERT INTO nakijk_sessies (bak_type,thema_bak_id,vaste_bak_id,locatie_id,week,kampmoment_id,datum,kv_wie,kv_status,kantoor_status) VALUES (?,?,?,?,?,?,?,?,?,?)`,
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
      const kapot=rin.kapot_aantal!=null?Math.max(0,parseFloat(rin.kapot_aantal)||0):(bestaand?(bestaand.kapot_aantal||0):0);
      const notitie=rin.notitie!=null?String(rin.notitie).slice(0,500):(bestaand?(bestaand.notitie||''):'');
      let fotoPad=bestaand?(bestaand.foto_path||''):'';
      if(fotoPaden.has(item.id)){ if(fotoPad)fotosKv.verwijderFoto(fotoPad); fotoPad=fotoPaden.get(item.id); }
      else if(rin.foto_data===''&&fotoPad){ fotosKv.verwijderFoto(fotoPad); fotoPad=''; }
      if(bestaand) run('UPDATE nakijk_regels SET aangetroffen=?,ontbreekt=?,verwacht=?,te_veel=?,kapot_aantal=?,is_kapot=?,notitie=?,foto_path=? WHERE id=?',
        [aangetroffen,ontbreekt,item.qty,teVeel,kapot,kapot>0?1:0,notitie,fotoPad,bestaand.id]);
      else ins('INSERT INTO nakijk_regels (sessie_id,item_naam,item_id,verwacht,aangetroffen,ontbreekt,te_veel,kapot_aantal,is_kapot,notitie,foto_path) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
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
    if(sessie) run('UPDATE nakijk_sessies SET notities=?,kv_wie=?,kv_tijdstip=? WHERE id=?',[status,kvNaam,now(),sessie.id]);
    else ins("INSERT INTO nakijk_sessies (bak_type,attribuut_id,locatie_id,week,kampmoment_id,datum,kv_wie,kv_status,kantoor_status,notities) VALUES ('attribuut',?,?,?,?,?,?,?,?,?)",
      [attr.id,km.locatie_id,km.week,km.id,now(),kvNaam,'bezig','open',status]);
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
        ins("INSERT INTO nakijk_regels (sessie_id,item_naam,item_id,verwacht,aangetroffen,ontbreekt,opmerking) VALUES (?,?,?,?,NULL,0,'niet geteld')",[s.id,it.naam,it.id,it.qty]);
      });
    });
    run("UPDATE nakijk_sessies SET kv_status='ingediend',kv_wie=?,kv_tijdstip=? WHERE kampmoment_id=? AND kv_status='bezig'",
      [kvNaam,now(),km.id]);
    res.json({ok:true});
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
    res.json(get('SELECT * FROM aanvragen WHERE id=?',[id]));
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
  app.get('/kv/:token',(req,res)=>{
    if(!_kvKampmoment(req.params.token))return res.status(404).send(_kvFoutPagina);
    _kvPagina(res,req.params.token,false);
  });
  app.get('/tel/:token',(req,res)=>{
    const t=_toegang(req.params.token);
    if(!t||!t.monitor)return res.status(404).send(_kvFoutPagina);
    _kvPagina(res,req.params.token,true);
  });

};
