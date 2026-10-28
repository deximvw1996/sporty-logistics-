// routes/bakken.js — uit server.js geknipt (F1 deel 1). Gedrag ongewijzigd.
// Kopjes: THEMA BAKKEN, STOCK OVERZICHT, VASTE BAKKEN, ATTRIBUTEN, THEMABEHOEFTE POOL, BAK/ATTRIBUUT-STATUS, GEDEELD MATERIAAL, BAK FOTO'S
'use strict';
module.exports = function(ctx){
  const {app,db,get,all,run,ins,saveDb,backupDb,now,isoDate,_genToken,resolveItemTypeId,logAct,vereisRol,alleenKantoor,hashPin,checkSessie,_actieveLocatieConfig,_kvVerwacht,_kvKampmoment,_kvNaam,_bakItems,effectiefMateriaal,ensureGedeeldStock,DATA_DIR,DB_PATH,UPLOADS_DIR,BUNDELS_DIR,FRONTEND_PATH,ROOT_DIR,APP_PASSWORD,PORT,path,fs,express,crypto} = ctx;
  // ── THEMA BAKKEN (S2.1: uniforme bakken-tabel, deelbaar via thema_bak) ──
  function _rozenwegId(){
    const r=get("SELECT id FROM locaties WHERE name='Rozenweg' AND (parent_id IS NULL OR parent_id=0)")
      || get("SELECT id FROM locaties WHERE type='stockage' AND (parent_id IS NULL OR parent_id=0) ORDER BY id LIMIT 1");
    return r?r.id:null;
  }
  function _bakkenVanThema(thema_id){
    const bakken=all(`SELECT b.* FROM bakken b JOIN thema_bak tb ON tb.bak_id=b.id
      WHERE tb.thema_id=? AND b.soort='thema' ORDER BY b.volgorde,b.id`,[thema_id]);
    return bakken.map(b=>{
      const andereThemas=all(`SELECT t.id,t.name FROM thema_bak tb2 JOIN themas t ON t.id=tb2.thema_id
        WHERE tb2.bak_id=? AND tb2.thema_id!=?`,[b.id,thema_id]);
      return {...b,label:b.naam,items:all('SELECT * FROM bak_items WHERE bak_id=? ORDER BY verbruik,id',[b.id]),
        log:all('SELECT * FROM bak_nakijk_log WHERE bak_id=? ORDER BY tijdstip DESC LIMIT 5',[b.id]),
        gedeeld_met:andereThemas};
    });
  }
  app.get('/api/themas/:id/bakken',(req,res)=>res.json(_bakkenVanThema(req.params.id)));
  // Alle bakken van alle themas in één call (voor Themabakken-tab)
  app.get('/api/alle-bakken',(req,res)=>{
    const themas=all('SELECT * FROM themas ORDER BY name');
    res.json(themas.map(t=>({...t,bakken:_bakkenVanThema(t.id),attributen:_attributenVanThema(t.id),
      behoefte:all(`SELECT tb.*, b.naam AS bak_naam, b.code AS bak_code FROM thema_behoefte tb
        LEFT JOIN bakken b ON b.id=tb.bak_id WHERE tb.thema_id=? ORDER BY tb.vast_type`,[t.id]),
      materiaal:all('SELECT * FROM thema_materiaal WHERE thema_id=?',[t.id])})));
  });
  // POST: koppel een bestaande bak (bak_id) OF maak een nieuwe bak+koppel (label/code/...)
  app.post('/api/themas/:id/bakken',(req,res)=>{
    const{bak_id,label,code,leeftijdsgroep,volgorde}=req.body;
    let id=bak_id;
    if(!id){
      const dubbeleCode=code&&get('SELECT id FROM bakken WHERE code=? AND code!=\'\'',[code]);
      id=ins('INSERT INTO bakken (naam,code,soort,thuislocatie_id,huidige_locatie_id,status,volgorde) VALUES (?,?,?,?,?,?,?)',
        [label||'',code||'','thema',_rozenwegId(),_rozenwegId(),'thuis',volgorde||0]);
      if(dubbeleCode) console.warn(`  Waarschuwing: code "${code}" bestaat al op een andere bak/attribuut (niet-blokkerend)`);
    }
    const bestaat=get('SELECT id FROM thema_bak WHERE thema_id=? AND bak_id=?',[req.params.id,id]);
    if(!bestaat) ins('INSERT INTO thema_bak (thema_id,bak_id) VALUES (?,?)',[req.params.id,id]);
    const b=get('SELECT * FROM bakken WHERE id=?',[id]);
    res.json({...b,label:b.naam,items:[],log:[]});
  });
  // Ontkoppel een bak van een thema (bak zelf blijft bestaan, kan aan andere thema's hangen)
  app.delete('/api/themas/:themaId/bakken/:bakId',(req,res)=>{
    run('DELETE FROM thema_bak WHERE thema_id=? AND bak_id=?',[req.params.themaId,req.params.bakId]);
    res.json({ok:true});
  });
  app.put('/api/bakken/:id',(req,res)=>{
    const{label,naam,code,volgorde,vast_type,thuislocatie_id,status}=req.body;
    const cur=get('SELECT * FROM bakken WHERE id=?',[req.params.id]);
    if(!cur)return res.status(404).json({error:'Bak niet gevonden'});
    const nieuweNaam=(naam??label)??cur.naam;
    run('UPDATE bakken SET naam=?,code=?,volgorde=?,vast_type=?,thuislocatie_id=?,status=? WHERE id=?',
      [nieuweNaam,code??cur.code,volgorde??cur.volgorde,vast_type??cur.vast_type,thuislocatie_id??cur.thuislocatie_id,status??cur.status,req.params.id]);
    const b=get('SELECT * FROM bakken WHERE id=?',[req.params.id]);
    res.json({...b,label:b.naam});
  });
  app.delete('/api/bakken/:id',(req,res)=>{
    run('DELETE FROM bak_items WHERE bak_id=?',[req.params.id]);
    run('DELETE FROM bak_nakijk_log WHERE bak_id=?',[req.params.id]);
    run('DELETE FROM thema_bak WHERE bak_id=?',[req.params.id]);
    run('DELETE FROM bakken WHERE id=?',[req.params.id]);
    res.json({ok:true});
  });
  // Bak-items CRUD
  app.post('/api/bakken/:id/items',(req,res)=>{
    const{naam,qty,verbruik,qty_per_gebruik,eenheid,qty_stock,qty_minimum,notitie}=req.body;
    const item_type_id=resolveItemTypeId(naam);
    const id=ins('INSERT INTO bak_items (bak_id,naam,qty,verbruik,qty_per_gebruik,eenheid,qty_stock,qty_minimum,notitie,item_type_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [req.params.id,naam,qty||1,verbruik?1:0,qty_per_gebruik||1,eenheid||'stuks',qty_stock||0,qty_minimum||0,notitie||'',item_type_id]);
    res.json(get('SELECT * FROM bak_items WHERE id=?',[id]));
  });
  app.put('/api/bak-items/:id',(req,res)=>{
    const{naam,qty,verbruik,qty_per_gebruik,eenheid,qty_stock,qty_minimum,notitie}=req.body;
    const cur=get('SELECT * FROM bak_items WHERE id=?',[req.params.id]);
    if(!cur)return res.status(404).json({error:'Item niet gevonden'});
    const nieuweNaam=naam??cur.naam;
    const item_type_id=nieuweNaam!==cur.naam?resolveItemTypeId(nieuweNaam):cur.item_type_id;
    run('UPDATE bak_items SET naam=?,qty=?,verbruik=?,qty_per_gebruik=?,eenheid=?,qty_stock=?,qty_minimum=?,notitie=?,item_type_id=? WHERE id=?',
      [nieuweNaam,qty??cur.qty,verbruik!==undefined?(verbruik?1:0):cur.verbruik,
       qty_per_gebruik??cur.qty_per_gebruik,eenheid??cur.eenheid,
       qty_stock??cur.qty_stock,qty_minimum??cur.qty_minimum,notitie??cur.notitie,item_type_id,req.params.id]);
    res.json(get('SELECT * FROM bak_items WHERE id=?',[req.params.id]));
  });
  app.delete('/api/bak-items/:id',(req,res)=>{run('DELETE FROM bak_items WHERE id=?',[req.params.id]);res.json({ok:true});});
  // S5.4a: dit veld `id` = bak.id uit de `bakken`-tabel (zelfde als de thema-bakkenlijst
  // /api/themas/:id/bakken teruggeeft) — niet meer de legacy thema_bakken-tabel, die na
  // Migratie 53 niet meer bijgewerkt wordt zodra nieuwe bakken via /api/themas/:id/bakken ontstaan.
  app.get('/api/bakken/:id/items-detail',(req,res)=>{
    const b=get('SELECT * FROM bakken WHERE id=?',[req.params.id]);
    if(!b)return res.status(404).json({error:'Bak niet gevonden'});
    res.json(all('SELECT * FROM bak_items WHERE bak_id=? ORDER BY verbruik,id',[req.params.id]));
  });
  // Nakijk log
  app.post('/api/bakken/:id/nakijk',(req,res)=>{
    const b=get('SELECT * FROM bakken WHERE id=?',[req.params.id]);
    if(!b)return res.status(404).json({error:'Bak niet gevonden'});
    const{wie,resultaat,notitie,stock_updates}=req.body;
    const tid=ins('INSERT INTO bak_nakijk_log (bak_id,tijdstip,wie,resultaat,notitie) VALUES (?,?,?,?,?)',
      [req.params.id,now(),wie||'',resultaat||'ok',notitie||'']);
    // Stock updates: [{item_id, qty_stock}]
    if(Array.isArray(stock_updates)){
      stock_updates.forEach(u=>{
        if(u.item_id!=null&&u.qty_stock!=null)
          run('UPDATE bak_items SET qty_stock=? WHERE id=? AND bak_id=?',[u.qty_stock,u.item_id,req.params.id]);
      });
    }
    const themaId=get('SELECT thema_id FROM thema_bak WHERE bak_id=? LIMIT 1',[req.params.id])?.thema_id;
    res.json({ok:true,log_id:tid,bakken:themaId?_bakkenVanThema(themaId):[]});
  });

  // ── STOCK OVERZICHT (per item_type: bakken + voorraad) ──
  app.get('/api/stock-overzicht',(req,res)=>{
    const types=all('SELECT * FROM item_types ORDER BY categorie,naam');
    const bakItems=all(`SELECT bi.item_type_id, bi.naam, bi.qty, bi.verbruik, bi.qty_stock, bi.qty_minimum,
      b.naam as bak_label, b.code as bak_code, t.name as thema_naam, t.color as thema_color, t.id as thema_id
      FROM bak_items bi
      JOIN bakken b ON b.id=bi.bak_id
      JOIN thema_bak tb ON tb.bak_id=b.id
      JOIN themas t ON t.id=tb.thema_id
      WHERE bi.item_type_id IS NOT NULL`);
    const stockRows=all(`SELECT s.item_type_id, s.qty, s.minimum, it.eenheid,
      l.name as locatie_naam, l.id as locatie_id
      FROM item_type_stock s JOIN locaties l ON l.id=s.locatie_id JOIN item_types it ON it.id=s.item_type_id
      WHERE s.item_type_id IS NOT NULL`);
    res.json(types.map(t=>{
      const allBakken=[...bakItems].filter(b=>b.item_type_id===t.id);
      const stock=stockRows.filter(s=>s.item_type_id===t.id);
      const totaalStock=stock.reduce((s,r)=>s+r.qty,0);
      const totaalNodig=allBakken.reduce((s,b)=>s+b.qty,0);
      return {...t,bakken:allBakken,stock,totaal_stock:totaalStock,totaal_nodig:totaalNodig,tekort:totaalStock<totaalNodig};
    }));
  });

  // ── VASTE BAKKEN (S2.1: nu backed door de uniforme bakken-tabel, soort='vast') ──
  // Fysieke exemplaren (EHBO-koffer #1, #2...) gegroepeerd per vast_type. Geen itemlijst
  // (de oude vaste_bak_items-tabel/route blijft bestaan maar wordt hier niet meer gevoed).
  app.get('/api/vaste-bakken',(req,res)=>{
    res.json(all("SELECT * FROM bakken WHERE soort='vast' ORDER BY vast_type,volgorde,naam"));
  });
  // S4.6: foto's op pool-eenheden (o.a. springkasteel/waterstructuur) — opgeplooid + opgezet,
  // zelfde base64-in-SQLite-patroon als attributen.foto_data / bak_fotos.
  app.post('/api/vaste-bakken/:id/foto-slot',(req,res)=>{
    const{slot,foto_data}=req.body;
    if(!['opgeplooid','opgezet'].includes(slot))return res.status(400).json({error:"slot moet 'opgeplooid' of 'opgezet' zijn"});
    if(!foto_data)return res.status(400).json({error:'Geen foto data'});
    const cur=get("SELECT * FROM bakken WHERE id=? AND soort='vast'",[req.params.id]);
    if(!cur)return res.status(404).json({error:'Vaste bak niet gevonden'});
    const kolom=slot==='opgeplooid'?'foto_opgeplooid':'foto_opgezet';
    run(`UPDATE bakken SET ${kolom}=? WHERE id=?`,[foto_data,req.params.id]);
    res.json(get('SELECT * FROM bakken WHERE id=?',[req.params.id]));
  });
  app.delete('/api/vaste-bakken/:id/foto-slot/:slot',(req,res)=>{
    if(!['opgeplooid','opgezet'].includes(req.params.slot))return res.status(400).json({error:"ongeldig slot"});
    const kolom=req.params.slot==='opgeplooid'?'foto_opgeplooid':'foto_opgezet';
    run(`UPDATE bakken SET ${kolom}='' WHERE id=?`,[req.params.id]);
    res.json(get('SELECT * FROM bakken WHERE id=?',[req.params.id]));
  });
  app.post('/api/vaste-bakken',(req,res)=>{
    const{naam,code,vast_type,thuislocatie_id,is_bulk,aantal}=req.body;
    if(!naam?.trim())return res.status(400).json({error:'Naam vereist'});
    const thuis=thuislocatie_id||_rozenwegId();
    const id=ins('INSERT INTO bakken (naam,code,soort,vast_type,thuislocatie_id,huidige_locatie_id,status,is_bulk,aantal) VALUES (?,?,?,?,?,?,?,?,?)',
      [naam.trim(),code||'','vast',vast_type||'',thuis,thuis,'thuis',is_bulk?1:0,Math.max(1,parseInt(aantal)||1)]);
    if(is_bulk&&thuis)ins('INSERT OR IGNORE INTO bulk_spreiding (bak_id,locatie_id,aantal) VALUES (?,?,?)',[id,thuis,Math.max(1,parseInt(aantal)||1)]);
    res.json(get('SELECT * FROM bakken WHERE id=?',[id]));
  });
  app.put('/api/vaste-bakken/:id',(req,res)=>{
    const{naam,code,vast_type,thuislocatie_id,status,blazers_nodig,notitie,aantal}=req.body;
    const cur=get('SELECT * FROM bakken WHERE id=?',[req.params.id]);
    if(!cur)return res.status(404).json({error:'Niet gevonden'});
    run('UPDATE bakken SET naam=?,code=?,vast_type=?,thuislocatie_id=?,status=?,blazers_nodig=?,notitie=? WHERE id=?',
      [naam??cur.naam,code??cur.code,vast_type??cur.vast_type,thuislocatie_id??cur.thuislocatie_id,status??cur.status,blazers_nodig??cur.blazers_nodig,notitie??cur.notitie,req.params.id]);
    // Walkthrough Maxim 2026-08-04: totaal-aantal van bulk-materiaal aanpasbaar in de app.
    // Het verschil wordt op de thuislocatie bijgeboekt in bulk_spreiding (nooit onder 0).
    if(cur.is_bulk&&aantal!==undefined&&aantal!==null){
      const nieuw=Math.max(0,parseInt(aantal)||0);
      const delta=nieuw-(cur.aantal||0);
      run('UPDATE bakken SET aantal=? WHERE id=?',[nieuw,req.params.id]);
      const thuis=cur.thuislocatie_id;
      if(thuis&&delta!==0){
        const rij=get('SELECT * FROM bulk_spreiding WHERE bak_id=? AND locatie_id=?',[cur.id,thuis]);
        if(rij)run('UPDATE bulk_spreiding SET aantal=MAX(0,aantal+?) WHERE id=?',[delta,rij.id]);
        else ins('INSERT INTO bulk_spreiding (bak_id,locatie_id,aantal) VALUES (?,?,?)',[cur.id,thuis,Math.max(0,delta)]);
      }
    }
    res.json(get('SELECT * FROM bakken WHERE id=?',[req.params.id]));
  });
  app.delete('/api/vaste-bakken/:id',(req,res)=>{
    run('DELETE FROM bakken WHERE id=?',[req.params.id]);
    res.json({ok:true});
  });
  app.post('/api/vaste-bakken/:id/items',(req,res)=>{
    const{naam,qty,eenheid,is_verbruik,qty_minimum,notitie,item_type_id}=req.body;
    if(!naam?.trim())return res.status(400).json({error:'Naam vereist'});
    const maxOrd=(get('SELECT MAX(volgorde) as m FROM vaste_bak_items WHERE bak_id=?',[req.params.id])||{}).m||0;
    const resolvedTypeId=item_type_id||resolveItemTypeId(naam);
    const id=ins('INSERT INTO vaste_bak_items (bak_id,naam,qty,eenheid,is_verbruik,qty_minimum,notitie,item_type_id,volgorde) VALUES (?,?,?,?,?,?,?,?,?)',
      [req.params.id,naam.trim(),qty||1,eenheid||'stuk',is_verbruik?1:0,qty_minimum||0,notitie||'',resolvedTypeId,maxOrd+10]);
    res.json(get('SELECT * FROM vaste_bak_items WHERE id=?',[id]));
  });
  app.put('/api/vaste-bak-items/:id',(req,res)=>{
    const{naam,qty,eenheid,is_verbruik,qty_stock,qty_minimum,notitie}=req.body;
    const cur=get('SELECT * FROM vaste_bak_items WHERE id=?',[req.params.id]);
    if(!cur)return res.status(404).json({error:'Item niet gevonden'});
    const item_type_id=naam&&naam!==cur.naam?resolveItemTypeId(naam):cur.item_type_id;
    run('UPDATE vaste_bak_items SET naam=?,qty=?,eenheid=?,is_verbruik=?,qty_stock=?,qty_minimum=?,notitie=?,item_type_id=? WHERE id=?',
      [naam,qty||1,eenheid||'stuk',is_verbruik?1:0,qty_stock||0,qty_minimum||0,notitie||'',item_type_id,req.params.id]);
    res.json(get('SELECT * FROM vaste_bak_items WHERE id=?',[req.params.id]));
  });
  app.delete('/api/vaste-bak-items/:id',(req,res)=>{
    run('DELETE FROM vaste_bak_items WHERE id=?',[req.params.id]);
    res.json({ok:true});
  });

  // ── ATTRIBUTEN (S2.2: los concept naast bakken, geen itemlijst, deelbaar over thema's) ──
  function _attributenVanThema(thema_id){
    const attrs=all(`SELECT a.* FROM attributen a JOIN thema_attribuut ta ON ta.attribuut_id=a.id
      WHERE ta.thema_id=? ORDER BY a.naam`,[thema_id]);
    return attrs.map(a=>{
      const andereThemas=all(`SELECT t.id,t.name FROM thema_attribuut ta2 JOIN themas t ON t.id=ta2.thema_id
        WHERE ta2.attribuut_id=? AND ta2.thema_id!=?`,[a.id,thema_id]);
      return {...a,gedeeld_met:andereThemas};
    });
  }
  app.get('/api/attributen',(req,res)=>res.json(all('SELECT * FROM attributen ORDER BY naam')));
  app.get('/api/themas/:id/attributen',(req,res)=>res.json(_attributenVanThema(req.params.id)));
  app.post('/api/attributen',(req,res)=>{
    const{naam,code,thuislocatie_id,notitie,foto_data}=req.body;
    if(!naam?.trim())return res.status(400).json({error:'Naam vereist'});
    const dubbeleCode=code&&get('SELECT id FROM bakken WHERE code=? AND code!=\'\' UNION SELECT id FROM attributen WHERE code=? AND code!=\'\'',[code,code]);
    const thuis=thuislocatie_id||_rozenwegId();
    const id=ins('INSERT INTO attributen (naam,code,thuislocatie_id,huidige_locatie_id,status,foto_data,notitie) VALUES (?,?,?,?,?,?,?)',
      [naam.trim(),code||'',thuis,thuis,'thuis',foto_data||'',notitie||'']);
    if(dubbeleCode) console.warn(`  Waarschuwing: code "${code}" bestaat al op een andere bak/attribuut (niet-blokkerend)`);
    res.json(get('SELECT * FROM attributen WHERE id=?',[id]));
  });
  app.put('/api/attributen/:id',(req,res)=>{
    const{naam,code,thuislocatie_id,status,notitie,foto_data}=req.body;
    const cur=get('SELECT * FROM attributen WHERE id=?',[req.params.id]);
    if(!cur)return res.status(404).json({error:'Niet gevonden'});
    run('UPDATE attributen SET naam=?,code=?,thuislocatie_id=?,status=?,notitie=?,foto_data=? WHERE id=?',
      [naam??cur.naam,code??cur.code,thuislocatie_id??cur.thuislocatie_id,status??cur.status,notitie??cur.notitie,foto_data??cur.foto_data,req.params.id]);
    res.json(get('SELECT * FROM attributen WHERE id=?',[req.params.id]));
  });
  app.delete('/api/attributen/:id',(req,res)=>{
    run('DELETE FROM thema_attribuut WHERE attribuut_id=?',[req.params.id]);
    run('DELETE FROM attributen WHERE id=?',[req.params.id]);
    res.json({ok:true});
  });
  app.post('/api/themas/:id/attributen',(req,res)=>{
    const{attribuut_id}=req.body;
    if(!attribuut_id)return res.status(400).json({error:'attribuut_id vereist'});
    const bestaat=get('SELECT id FROM thema_attribuut WHERE thema_id=? AND attribuut_id=?',[req.params.id,attribuut_id]);
    if(!bestaat) ins('INSERT INTO thema_attribuut (thema_id,attribuut_id) VALUES (?,?)',[req.params.id,attribuut_id]);
    res.json({ok:true});
  });
  app.delete('/api/themas/:themaId/attributen/:attrId',(req,res)=>{
    run('DELETE FROM thema_attribuut WHERE thema_id=? AND attribuut_id=?',[req.params.themaId,req.params.attrId]);
    res.json({ok:true});
  });

  // ── S4.5a: THEMABEHOEFTE AAN POOL-MATERIAAL ──
  app.get('/api/themas/:id/behoefte',(req,res)=>{
    res.json(all(`SELECT tb.*, b.naam AS bak_naam, b.code AS bak_code FROM thema_behoefte tb
      LEFT JOIN bakken b ON b.id=tb.bak_id WHERE tb.thema_id=? ORDER BY tb.vast_type`,[req.params.id]));
  });
  app.post('/api/themas/:id/behoefte',(req,res)=>{
    if(req.body&&req.body.bak_id){
      const{bak_id,aantal,notitie}=req.body;
      const bak=get("SELECT * FROM bakken WHERE id=? AND soort='vast'",[bak_id]);
      if(!bak)return res.status(400).json({error:'Onbekend pool-exemplaar'});
      const id=ins('INSERT INTO thema_behoefte (thema_id,vast_type,aantal,notitie,bak_id) VALUES (?,?,?,?,?)',
        [req.params.id,bak.vast_type,aantal||1,notitie||'',bak_id]);
      return res.json(get(`SELECT tb.*, b.naam AS bak_naam FROM thema_behoefte tb LEFT JOIN bakken b ON b.id=tb.bak_id WHERE tb.id=?`,[id]));
    }
    const{vast_type,aantal,notitie}=req.body;
    if(!vast_type)return res.status(400).json({error:'vast_type verplicht'});
    const id=ins('INSERT INTO thema_behoefte (thema_id,vast_type,aantal,notitie) VALUES (?,?,?,?)',
      [req.params.id,vast_type,aantal||1,notitie||'']);
    res.json(get('SELECT * FROM thema_behoefte WHERE id=?',[id]));
  });
  app.put('/api/themas/:themaId/behoefte/:id',(req,res)=>{
    const cur=get('SELECT * FROM thema_behoefte WHERE id=? AND thema_id=?',[req.params.id,req.params.themaId]);
    if(!cur)return res.status(404).json({error:'Niet gevonden'});
    const{vast_type,aantal,notitie}=req.body;
    run('UPDATE thema_behoefte SET vast_type=?,aantal=?,notitie=? WHERE id=?',
      [vast_type??cur.vast_type,aantal??cur.aantal,notitie??cur.notitie,req.params.id]);
    res.json(get('SELECT * FROM thema_behoefte WHERE id=?',[req.params.id]));
  });
  app.delete('/api/themas/:themaId/behoefte/:id',(req,res)=>{
    run('DELETE FROM thema_behoefte WHERE id=? AND thema_id=?',[req.params.id,req.params.themaId]);
    res.json({ok:true});
  });

  // ── S2.4: BAK/ATTRIBUUT-STATUS, HANDMATIGE VERPLAATSING, ZOEKEN ──
  app.post('/api/bakken/:id/verplaats',(req,res)=>{
    const{naar_locatie_id,reden}=req.body;
    if(!naar_locatie_id||!reden?.trim())return res.status(400).json({error:'naar_locatie_id en reden zijn verplicht'});
    const b=get('SELECT * FROM bakken WHERE id=?',[req.params.id]);
    if(!b)return res.status(404).json({error:'Bak niet gevonden'});
    const nieuweStatus=naar_locatie_id==b.thuislocatie_id?'thuis':'op_locatie';
    run('UPDATE bakken SET huidige_locatie_id=?,status=? WHERE id=?',[naar_locatie_id,nieuweStatus,req.params.id]);
    const loc=get('SELECT name FROM locaties WHERE id=?',[naar_locatie_id]);
    logAct('bak','verplaatst',`Bak "${b.naam}" (${b.code||'-'}) handmatig verplaatst naar ${loc?.name||naar_locatie_id} — reden: ${reden.trim()}`,naar_locatie_id,loc?.name);
    res.json(get('SELECT * FROM bakken WHERE id=?',[req.params.id]));
  });
  app.post('/api/attributen/:id/verplaats',(req,res)=>{
    const{naar_locatie_id,reden}=req.body;
    if(!naar_locatie_id||!reden?.trim())return res.status(400).json({error:'naar_locatie_id en reden zijn verplicht'});
    const a=get('SELECT * FROM attributen WHERE id=?',[req.params.id]);
    if(!a)return res.status(404).json({error:'Attribuut niet gevonden'});
    const nieuweStatus=naar_locatie_id==a.thuislocatie_id?'thuis':'op_locatie';
    run('UPDATE attributen SET huidige_locatie_id=?,status=? WHERE id=?',[naar_locatie_id,nieuweStatus,req.params.id]);
    const loc=get('SELECT name FROM locaties WHERE id=?',[naar_locatie_id]);
    logAct('attribuut','verplaatst',`Attribuut "${a.naam}" (${a.code||'-'}) handmatig verplaatst naar ${loc?.name||naar_locatie_id} — reden: ${reden.trim()}`,naar_locatie_id,loc?.name);
    res.json(get('SELECT * FROM attributen WHERE id=?',[req.params.id]));
  });
  app.get('/api/waar-is',(req,res)=>{
    const q='%'+(req.query.q||'')+'%';
    const bakken=all("SELECT id,naam,code,'bak' as soort,huidige_locatie_id,status FROM bakken WHERE naam LIKE ? OR code LIKE ?",[q,q]);
    const attrs=all("SELECT id,naam,code,'attribuut' as soort,huidige_locatie_id,status FROM attributen WHERE naam LIKE ? OR code LIKE ?",[q,q]);
    const resultaten=[...bakken,...attrs].map(r=>{
      const loc=get('SELECT name FROM locaties WHERE id=?',[r.huidige_locatie_id]);
      const bewegingen=all(`SELECT * FROM activiteiten_log WHERE (type=? AND beschrijving LIKE ?) ORDER BY id DESC LIMIT 5`,
        [r.soort,'%"'+r.naam+'"%']);
      return {...r,huidige_locatie_naam:loc?.name||null,laatste_bewegingen:bewegingen};
    });
    res.json(resultaten);
  });

  // ── GEDEELD MATERIAAL ──
  app.get('/api/gedeeld', (req,res) => {
    const items = all('SELECT * FROM gedeeld_items ORDER BY cat, name');
    const gebruik = all('SELECT gg.*, t.name as thema_name FROM gedeeld_gebruik gg LEFT JOIN themas t ON t.id=gg.thema_id');
    // Calculate conflicts per week: for each week, sum qty needed across all themas active that week
    const kts = all('SELECT * FROM kampmoment_themas');
    const kms = all('SELECT * FROM kampmomenten');
    const locs = all('SELECT id,name,type FROM locaties');
    res.json(items.map(item => {
      const g = gebruik.filter(u => u.item_id === item.id);
      // Per week: which themas are active, how many of this item needed
      const weekConflicts = {};
      for (let week = 1; week <= 9; week++) {
        const activeKms = kms.filter(km => km.week === week);
        const activeThemas = new Set(kts.filter(kt => activeKms.some(km => km.id === kt.kampmoment_id)).map(kt => kt.thema_id));
        const needed = g.filter(u => activeThemas.has(u.thema_id)).reduce((sum, u) => sum + u.qty, 0);
        if (needed > 0) weekConflicts[week] = {needed, alarm: needed > item.totaal};
      }
      const stock = ensureGedeeldStock(item).map(s=>({...s,locatie_name:(locs.find(l=>l.id===s.locatie_id)||{}).name||'?'}));
      return {...item, gebruik: g, weekConflicts, stock};
    }));
  });
  // Voorraad per locatie zetten voor een gedeeld item
  app.post('/api/gedeeld/:id/stock', (req,res) => {
    const {locatie_id, qty} = req.body;
    if(!locatie_id) return res.status(400).json({error:'Locatie vereist'});
    run('INSERT OR REPLACE INTO gedeeld_stock(gedeeld_id,locatie_id,qty) VALUES(?,?,?)',[req.params.id,locatie_id,Math.max(0,qty||0)]);
    res.json(get('SELECT * FROM gedeeld_stock WHERE gedeeld_id=? AND locatie_id=?',[req.params.id,locatie_id]));
  });

  app.post('/api/gedeeld', (req,res) => {
    const {name, cat, totaal, notities, stockage_locatie_id} = req.body;
    if (!name) return res.status(400).json({error: 'Naam vereist'});
    const item_type_id=resolveItemTypeId(name,'gedeeld');
    const id = ins('INSERT INTO gedeeld_items (name,cat,totaal,notities,stockage_locatie_id,item_type_id) VALUES (?,?,?,?,?,?)', [name, cat||'gedeeld', totaal||1, notities||'', stockage_locatie_id||null, item_type_id]);
    res.json({...get('SELECT * FROM gedeeld_items WHERE id=?', [id]), gebruik: [], weekConflicts: {}});
  });
  app.put('/api/gedeeld/:id', (req,res) => {
    const {name,cat,totaal,notities,stockage_locatie_id} = req.body;
    const cur=get('SELECT * FROM gedeeld_items WHERE id=?',[req.params.id]);
    const item_type_id=name&&name!==cur?.name?resolveItemTypeId(name,'gedeeld'):cur?.item_type_id;
    run('UPDATE gedeeld_items SET name=?,cat=?,totaal=?,notities=?,stockage_locatie_id=?,item_type_id=? WHERE id=?', [name,cat||'gedeeld',totaal||1,notities||'',stockage_locatie_id||null,item_type_id,req.params.id]);
    res.json(get('SELECT * FROM gedeeld_items WHERE id=?', [req.params.id]));
  });
  app.delete('/api/gedeeld/:id', (req,res) => {
    run('DELETE FROM gedeeld_gebruik WHERE item_id=?', [req.params.id]);
    run('DELETE FROM gedeeld_stock WHERE gedeeld_id=?', [req.params.id]);
    run('DELETE FROM gedeeld_items WHERE id=?', [req.params.id]);
    res.json({ok:true});
  });

  // Gedeeld gebruik per thema
  app.post('/api/gedeeld/:id/gebruik', (req,res) => {
    const {thema_id, qty} = req.body;
    run('INSERT OR REPLACE INTO gedeeld_gebruik (item_id,thema_id,qty) VALUES (?,?,?)', [req.params.id, thema_id, qty||1]);
    res.json(get('SELECT gg.*, t.name as thema_name FROM gedeeld_gebruik gg LEFT JOIN themas t ON t.id=gg.thema_id WHERE gg.item_id=? AND gg.thema_id=?', [req.params.id, thema_id]));
  });
  app.delete('/api/gedeeld/:id/gebruik/:thema_id', (req,res) => {
    run('DELETE FROM gedeeld_gebruik WHERE item_id=? AND thema_id=?', [req.params.id, req.params.thema_id]);
    res.json({ok:true});
  });

  // ── BAK FOTO'S ──
  app.get('/api/bakken/:id/fotos',(req,res)=>{
    res.json(all('SELECT id,bak_id,tijdstip,wie,beschrijving FROM bak_fotos WHERE bak_id=? ORDER BY id DESC LIMIT 20',[req.params.id]));
  });
  app.post('/api/bakken/:id/foto',(req,res)=>{
    const{wie,beschrijving,foto_data}=req.body;
    if(!foto_data)return res.status(400).json({error:'Geen foto data'});
    const id=ins('INSERT INTO bak_fotos (bak_id,tijdstip,wie,beschrijving,foto_data) VALUES (?,?,?,?,?)',
      [req.params.id,now(),wie||'',beschrijving||'',foto_data]);
    res.json({ok:true,id});
  });
  app.get('/api/bak-fotos/:id',(req,res)=>{
    const f=get('SELECT * FROM bak_fotos WHERE id=?',[req.params.id]);
    if(!f)return res.status(404).json({error:'Niet gevonden'});
    res.json(f);
  });
  app.delete('/api/bak-fotos/:id',(req,res)=>{
    run('DELETE FROM bak_fotos WHERE id=?',[req.params.id]);
    res.json({ok:true});
  });

};
