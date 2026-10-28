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
    const heeftKoken=themas.some(t=>t.heeft_kookactiviteit);
    const leeftijden=new Set(themas.map(t=>t.leeftijdsgroep).filter(Boolean));
    const loc=get('SELECT * FROM locaties WHERE id=?',[km.locatie_id]);
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
  function _kvKampmoment(token){ return get('SELECT * FROM kampmomenten WHERE kv_token=?',[token]); }
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

  return { _actieveLocatieConfig, _kvVerwacht, _kvKampmoment, _kvNaam, _bakItems, effectiefMateriaal, ensureGedeeldStock };
};
