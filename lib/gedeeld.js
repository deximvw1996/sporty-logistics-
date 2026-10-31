// lib/gedeeld.js — hulpfuncties die door meer dan één routegebied gebruikt worden (F1 deel 1). Gedrag ongewijzigd.
// _actieveLocatieConfig (LOCATIECONFIG), _kvVerwacht/_kvKampmoment/_kvNaam/_bakItems (KV "wat hoort er te staan"),
// effectiefMateriaal (LOCATIE MATERIAAL), ensureGedeeldStock (GEDEELD MATERIAAL).
'use strict';
module.exports = function(ctx){
  const {app,db,get,all,run,ins,saveDb,backupDb,now,isoDate,_genToken,resolveItemTypeId,logAct,logWijziging,insMetLog,updateMetLog,delMetLog,vereisRol,alleenKantoor,hashPin,checkSessie,DATA_DIR,DB_PATH,UPLOADS_DIR,BUNDELS_DIR,FRONTEND_PATH,ROOT_DIR,APP_PASSWORD,PORT,path,fs,express,crypto} = ctx;
  // Bepaalt welke locatie_config-rijen actief zijn voor een kampmoment (conditie: altijd/leeftijdsgroep/kookthema)
  function _actieveLocatieConfig(km){
    if(!km)return[];
    const cfgs=all('SELECT * FROM locatie_config WHERE kamplocatie_id=?',[km.locatie_id]);
    const themas=all('SELECT t.* FROM themas t JOIN kampmoment_themas kt ON kt.thema_id=t.id WHERE kt.kampmoment_id=?',[km.id]);
    const leeftijden=new Set(themas.map(t=>t.leeftijdsgroep).filter(Boolean));
    const loc=get('SELECT * FROM locaties WHERE id=?',[km.locatie_id]);
    // GF1: kookdagen staan per kampmoment (PL1: kampmomenten.kookdagen); heeft de locatie geen eigen oven, dan moet de oven mee.
    const heeftKoken=themas.some(t=>t.heeft_kookactiviteit)||!!(String(km.kookdagen||'').trim()&&!(loc&&loc.heeft_eigen_oven));
    return cfgs.filter(c=>{
      if(c.conditie_type==='leeftijdsgroep') return leeftijden.has(c.conditie_waarde);
      if(c.conditie_type==='kookthema') return heeftKoken;
      if(c.conditie_type==='zelf_kuisen') return !!(loc&&loc.zelf_kuisen); // walkthrough Maxim 2026-08-04
      return true; // 'altijd'
    });
  }
  // ── S3.5: KV-scherm — wat hoort er te staan (zelfde logica als transport-genereer:
  // thema_bak/thema_attribuut van de kampmoment-thema's + actieve locatie_config-exemplaren,
  // maar hier enkel exemplaren die ECHT op deze locatie staan — de KV kan geen bak tellen
  // die nog in het magazijn ligt).
  function _kvVerwacht(km){
    const kts=all('SELECT thema_id FROM kampmoment_themas WHERE kampmoment_id=?',[km.id]);
    const themaIds=[...new Set(kts.map(k=>k.thema_id))];
    let themaBakken=[], themaAttrs=[];
    if(themaIds.length){
      const ph=themaIds.map(()=>'?').join(',');
      themaBakken=all(`SELECT DISTINCT b.* FROM bakken b JOIN thema_bak tb ON tb.bak_id=b.id WHERE tb.thema_id IN (${ph}) AND b.soort='thema'`,themaIds);
      themaAttrs=all(`SELECT DISTINCT a.* FROM attributen a JOIN thema_attribuut ta ON ta.attribuut_id=a.id WHERE ta.thema_id IN (${ph})`,themaIds);
    }
    const vastBakken=_actieveLocatieConfig(km).flatMap(cfg=>
      all("SELECT * FROM bakken WHERE soort='vast' AND vast_type=? AND huidige_locatie_id=? LIMIT ?",[cfg.vast_type,km.locatie_id,cfg.aantal||1]));
    return {bakken:[...themaBakken,...vastBakken], attributen:themaAttrs};
  }
  // TF12: wat uit een rit van dit kampmoment niet meekwam. Nageleverd = de rest-taak is gedaan; dan telt het stuk weer mee.
  const _schoon=n=>String(n||'').replace(/^\d+\s*×\s*/,'').replace(/\s*\([^)]*\)\s*$/,'').trim().toLowerCase();
  const REDEN={niet_gevonden:'niet gevonden bij het laden',past_niet:'paste niet in de wagen',kapot:'kapot bij het laden'};
  function _kvNietGeleverd(km){
    if(!km||!km.id)return [];
    return all("SELECT c.* FROM verhuis_checks c JOIN transport_taken t ON t.id=c.taak_id WHERE t.kampmoment_id=? AND c.niet_mee_reden IS NOT NULL AND c.niet_mee_reden<>'' ORDER BY c.id",[km.id]).map(c=>{
      const regel=c.rest_regel_id?get('SELECT taak_id FROM transport_regels WHERE id=?',[c.rest_regel_id]):null;
      const rest=regel?get('SELECT * FROM transport_taken WHERE id=?',[regel.taak_id]):null;
      const nu=get('SELECT status FROM nu_oplossen WHERE check_id=? ORDER BY id DESC LIMIT 1',[c.id]);
      const rit=rest&&rest.rit_id?get('SELECT datum FROM transport_ritten WHERE id=?',[rest.rit_id]):null;
      const bak=c.bak_id?get('SELECT is_bulk FROM bakken WHERE id=?',[c.bak_id]):null;
      const qty=c.niet_mee_aantal||c.qty||1,naam=String(c.item_naam||'').replace(/^\d+\s*×\s*/,'');
      const stand=nu&&nu.status==='afgeschreven'?'kantoor schreef dit af':rit?'komt met de rit van '+rit.datum:nu&&nu.status==='open'?'kantoor is ermee bezig':'kantoor plant dit opnieuw in';
      return {check_id:c.id,naam,qty,reden:c.niet_mee_reden,reden_tekst:REDEN[c.niet_mee_reden]||c.niet_mee_reden,bak_id:bak&&!bak.is_bulk?c.bak_id:null,attribuut_id:c.attribuut_id||null,
        nageleverd:!!(rest&&rest.status==='gedaan'),stand,rit_datum:rit?rit.datum:'',tekst:qty+' × '+naam};
    });
  }
  function _kvMinder(km,ng){ // per bak en stuk hoeveel er niet geleverd is
    const m={},los=ng.filter(n=>!n.bak_id&&!n.attribuut_id).map(n=>({...n,over:n.qty}));
    if(!los.length)return m;
    _kvVerwacht(km).bakken.forEach(b=>_bakItems(b).forEach(it=>{los.forEach(n=>{if(n.over>0&&_schoon(n.naam)===_schoon(it.naam)){const d=Math.min(n.over,it.qty||0);n.over-=d;m[b.id+':'+it.id]=(m[b.id+':'+it.id]||0)+d;}});}));
    return m;
  }
  // Wat de KV echt moet tellen: verwacht = wat geleverd is. Een hele bak of attribuut die niet meekwam, valt weg.
  const _kvBakWeg=(km,bak)=>_kvNietGeleverd(km).some(n=>!n.nageleverd&&n.bak_id===bak.id);
  const _kvAttrWeg=(km,id)=>_kvNietGeleverd(km).some(n=>!n.nageleverd&&n.attribuut_id===id);
  function _kvItems(km,bak){
    const items=_bakItems(bak),ng=_kvNietGeleverd(km).filter(n=>!n.nageleverd);
    if(!ng.length)return items;
    if(ng.some(n=>n.bak_id===bak.id))return [];
    const m=_kvMinder(km,ng);
    return items.map(it=>({...it,qty_origineel:it.qty,qty:(it.qty||0)-(m[bak.id+':'+it.id]||0)})).filter(it=>it.qty>0||!m[bak.id+':'+it.id]);
  }
  function _kvKampmoment(token){ return get('SELECT * FROM kampmomenten WHERE kv_token=?',[token]); }
  // TF5: laatste dag van het kampmoment (vrijdag van de week uit de periode). Tot 14 dagen erna alleen lezen, daarna dicht. Tellingen blijven altijd bewaard.
  function _kvEinde(km){
    const per=km&&km.periode_id?get('SELECT start_datum FROM vakantieperiodes WHERE id=?',[km.periode_id]):null;
    if(!per||!per.start_datum||!km.week)return '';
    const d=new Date(per.start_datum+'T12:00:00');d.setDate(d.getDate()+(km.week-1)*7+4);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function _kvLinkStand(km,vandaag){
    const eind=_kvEinde(km);if(!eind)return 'open';
    const n=vandaag||(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
    if(n<=eind)return 'open';
    return Math.round((new Date(n+'T12:00:00')-new Date(eind+'T12:00:00'))/864e5)<=14?'lezen':'dicht';
  }
  function _kvNaam(km){ const p=km.kv_persoon_id?get('SELECT naam FROM personeel WHERE id=?',[km.kv_persoon_id]):null; return p?p.naam:''; }
  function _bakItems(bak){
    return bak.soort==='thema'
      ? all('SELECT * FROM bak_items WHERE bak_id=? ORDER BY id',[bak.id])
      : all('SELECT * FROM vaste_bak_items WHERE bak_id=? ORDER BY volgorde,id',[bak.id]);
  }
  // ── LOCATIE MATERIAAL: basis (standaard, geldt voor elk kamp) + per-kamp afwijkingen + extra's ──
  // Effectieve lijst = basisitems (verborgen eruit, met evt. qty-override) + kamp-eigen extra's.
  function effectiefMateriaal(locatie_id){
    const basis = all('SELECT * FROM standaard_materiaal ORDER BY cat,name');
    const afw = {}; all('SELECT * FROM kamp_basis_afwijking WHERE locatie_id=?',[locatie_id]).forEach(a=>afw[a.standaard_id]=a);
    const out = basis.map(b=>{ const a=afw[b.id]; return {bron:'basis', standaard_id:b.id, name:b.name, cat:b.cat||'andere', qty:(a&&a.qty!=null)?a.qty:b.qty, qty_basis:b.qty, verborgen:(a&&a.verborgen)?1:0}; });
    all('SELECT * FROM locatie_materiaal WHERE locatie_id=? ORDER BY cat,name',[locatie_id]).forEach(e=>out.push({bron:'extra', id:e.id, name:e.name, cat:e.cat||'andere', qty:e.qty, verborgen:0}));
    return out;
  }
  // Zorg dat een gedeeld item per-locatie voorraad heeft; bij ontbreken staat alles op thuis-stockage
  function ensureGedeeldStock(item){
    const rows=all('SELECT * FROM gedeeld_stock WHERE gedeeld_id=?',[item.id]);
    if(!rows.length && item.stockage_locatie_id && (item.totaal||0)>0){
      run('INSERT OR IGNORE INTO gedeeld_stock(gedeeld_id,locatie_id,qty) VALUES(?,?,?)',[item.id,item.stockage_locatie_id,item.totaal]);
      return all('SELECT * FROM gedeeld_stock WHERE gedeeld_id=?',[item.id]);
    }
    return rows;
  }

  return { _kvNietGeleverd, _kvItems, _kvBakWeg, _kvAttrWeg, _actieveLocatieConfig, _kvVerwacht, _kvKampmoment, _kvEinde, _kvLinkStand, _kvNaam, _bakItems, effectiefMateriaal, ensureGedeeldStock };
};
