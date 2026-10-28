// routes/themas.js — uit server.js geknipt (F1 deel 1). Gedrag ongewijzigd.
// Kopjes: THEMAS, THEMABUNDEL-PDF'S, PLANNING-IMPORT, MATERIAAL, THEMA CATEGORIEËN, ITEM TYPES, CATALOGUS ITEM DETAIL
'use strict';
module.exports = function(ctx){
  const {app,db,get,all,run,ins,saveDb,backupDb,now,isoDate,_genToken,resolveItemTypeId,logAct,vereisRol,alleenKantoor,hashPin,checkSessie,_actieveLocatieConfig,_kvVerwacht,_kvKampmoment,_kvNaam,_bakItems,effectiefMateriaal,ensureGedeeldStock,DATA_DIR,DB_PATH,UPLOADS_DIR,BUNDELS_DIR,FRONTEND_PATH,ROOT_DIR,APP_PASSWORD,PORT,path,fs,express,crypto} = ctx;
  const __dirname = ROOT_DIR;
  // ── THEMAS ──
  app.get('/api/themas',(req,res)=>{const t=all('SELECT * FROM themas ORDER BY name');const m=all('SELECT * FROM thema_materiaal');res.json(t.map(x=>({...x,materiaal:m.filter(y=>y.thema_id===x.id)})));});
  app.post('/api/themas',(req,res)=>{const{name,color,categorie,leeftijdsgroep,thema_type}=req.body;if(!name||!name.trim())return res.status(400).json({error:'Naam is verplicht'});const id=ins('INSERT INTO themas (name,color,categorie,leeftijdsgroep,thema_type) VALUES (?,?,?,?,?)',[name.trim(),color||'#1D9E75',categorie||'',leeftijdsgroep||'',thema_type||'eigen_materiaal']);res.json({...get('SELECT * FROM themas WHERE id=?',[id]),materiaal:[]});});
  app.put('/api/themas/:id',(req,res)=>{const cur=get('SELECT * FROM themas WHERE id=?',[req.params.id]);if(!cur)return res.status(404).json({error:'Thema niet gevonden'});const{name,color,categorie,leeftijdsgroep,thema_type}=req.body;const nm=(name!==undefined&&name!==null)?name:cur.name;if(!nm||!nm.trim())return res.status(400).json({error:'Naam is verplicht'});run('UPDATE themas SET name=?,color=?,categorie=?,leeftijdsgroep=?,thema_type=? WHERE id=?',[nm.trim(),color||cur.color||'#1D9E75',categorie!==undefined?categorie:(cur.categorie||''),leeftijdsgroep!==undefined?leeftijdsgroep:(cur.leeftijdsgroep||''),thema_type||cur.thema_type||'eigen_materiaal',req.params.id]);res.json(get('SELECT * FROM themas WHERE id=?',[req.params.id]));});
  app.delete('/api/themas/:id',(req,res)=>{run('DELETE FROM thema_materiaal WHERE thema_id=?',[req.params.id]);run('DELETE FROM thema_bundels WHERE thema_id=?',[req.params.id]);run('DELETE FROM themas WHERE id=?',[req.params.id]);res.json({ok:true});});
  app.post('/api/themas/:id/materiaal',(req,res)=>{const{name,qty,stockage_locatie_id,stockage_code}=req.body;const item_type_id=resolveItemTypeId(name);const id=ins('INSERT INTO thema_materiaal (thema_id,name,qty,stockage_locatie_id,stockage_code,item_type_id) VALUES (?,?,?,?,?,?)',[req.params.id,name,qty||1,stockage_locatie_id||null,stockage_code||'',item_type_id]);res.json(get('SELECT * FROM thema_materiaal WHERE id=?',[id]));});
  app.put('/api/themas/:tid/materiaal/:mid',(req,res)=>{const{name,qty,stockage_locatie_id,stockage_code}=req.body;const cur=get('SELECT * FROM thema_materiaal WHERE id=?',[req.params.mid]);run('UPDATE thema_materiaal SET name=?,qty=?,stockage_locatie_id=?,stockage_code=? WHERE id=? AND thema_id=?',[name,qty,stockage_locatie_id||null,stockage_code!==undefined?stockage_code:(cur?cur.stockage_code||'':''),req.params.mid,req.params.tid]);res.json(get('SELECT * FROM thema_materiaal WHERE id=?',[req.params.mid]));});
  app.delete('/api/themas/:tid/materiaal/:mid',(req,res)=>{run('DELETE FROM thema_materiaal WHERE id=? AND thema_id=?',[req.params.mid,req.params.tid]);res.json({ok:true});});

  // ── S4.7: THEMABUNDEL-PDF'S ──
  // Bestandsnamen komen letterlijk uit bundels/ (repo-map, meegedeployed) — geen upload-flow,
  // enkel koppelen aan wat daar al staat (dropdown, zie GET /api/bundels/bestanden).
  app.get('/api/bundels/bestanden',(req,res)=>{
    let bestanden=[];
    try{ bestanden=fs.readdirSync(BUNDELS_DIR).filter(f=>f.toLowerCase().endsWith('.pdf')).sort((a,b)=>a.localeCompare(b,'nl')); }
    catch(e){ bestanden=[]; }
    res.json(bestanden);
  });
  app.get('/api/themas/:id/bundels',(req,res)=>{
    res.json(all('SELECT * FROM thema_bundels WHERE thema_id=? ORDER BY volgorde,id',[req.params.id]));
  });
  app.post('/api/themas/:id/bundels',(req,res)=>{
    const{bestand,label}=req.body;
    if(!bestand||!bestand.trim())return res.status(400).json({error:'bestand is verplicht'});
    // Reviewfix Fable: alleen kale bestandsnamen uit de bundels-map zelf — geen padscheiders of
    // '..' (path-traversal: '..\\server.js' werd anders gewoon gekoppeld).
    if(bestand!==path.basename(bestand)||bestand.includes('..'))return res.status(400).json({error:'Ongeldige bestandsnaam'});
    if(!fs.existsSync(path.join(BUNDELS_DIR,bestand)))return res.status(400).json({error:'Dit bestand staat niet (meer) in de bundels-map'});
    const maxOrd=(get('SELECT MAX(volgorde) as m FROM thema_bundels WHERE thema_id=?',[req.params.id])||{}).m||0;
    const id=ins('INSERT INTO thema_bundels (thema_id,bestand,label,volgorde) VALUES (?,?,?,?)',[req.params.id,bestand,label||'',maxOrd+10]);
    res.json(get('SELECT * FROM thema_bundels WHERE id=?',[id]));
  });
  app.delete('/api/thema-bundels/:id',(req,res)=>{
    run('DELETE FROM thema_bundels WHERE id=?',[req.params.id]);
    res.json({ok:true});
  });

  // ── PLANNING-IMPORT (materiaallijst uit de foto's) ──
  // Leest data/materiaallijst_foto1..10.json server-side, voegt thema's met
  // exact dezelfde naam samen (ook die over 2 fotos lopen) en ontdubbelt
  // materiaal op naam+locatie. Idempotent: bestaande thema's (zelfde naam,
  // hoofdletterongevoelig) worden overgeslagen, dus herhaald importeren
  // dupliceert niets. Kleur: kamp=groen, themadag=blauw. Magazijncode -> stockage_code.
  function _laadImportThemas(){
    const fsx=require('fs'); const px=require('path');
    const dir=px.join(__dirname,'data');
    const map=new Map(); const order=[];
    for(let i=1;i<=10;i++){
      const f=px.join(dir,'materiaallijst_foto'+i+'.json');
      if(!fsx.existsSync(f)) continue;
      let j; try{ j=JSON.parse(fsx.readFileSync(f,'utf8')); }catch(e){ continue; }
      for(const t of (j.themas||[])){
        const key=(t.naam||'').trim(); if(!key) continue;
        if(!map.has(key)){ map.set(key,{naam:key,type:t.type||'kamp',leeftijdsgroep:t.leeftijdsgroep||'',materiaal:[]}); order.push(key); }
        const dst=map.get(key);
        if(!dst.leeftijdsgroep && t.leeftijdsgroep) dst.leeftijdsgroep=t.leeftijdsgroep;
        for(const m of (t.materiaal||[])){
          const dup=dst.materiaal.some(x=>x.naam===m.naam && (x.locatie||'')===(m.locatie||''));
          if(!dup) dst.materiaal.push({naam:m.naam,locatie:m.locatie||''});
        }
      }
    }
    return order.map(k=>map.get(k));
  }
  app.get('/api/import-themas/preview', alleenKantoor, (req,res)=>{
    return res.status(410).json({error:'Uitgeschakeld — wordt vervangen door de nieuwe thema-invoerflow (zie MASTERPLAN S4)'});
    try{
      const lijst=_laadImportThemas();
      const bestaand=new Set(all('SELECT name FROM themas').map(t=>(t.name||'').trim().toLowerCase()));
      let nieuw=0, bestaat=0, items=0;
      lijst.forEach(t=>{ if(bestaand.has(t.naam.toLowerCase())) bestaat++; else { nieuw++; items+=t.materiaal.length; } });
      res.json({totaal:lijst.length, nieuw, bestaat, materiaalitems:items});
    }catch(e){ res.status(500).json({error:e.message}); }
  });
  app.post('/api/import-themas', alleenKantoor, (req,res)=>{
    return res.status(410).json({error:'Uitgeschakeld — wordt vervangen door de nieuwe thema-invoerflow (zie MASTERPLAN S4)'});
    try{
      const lijst=_laadImportThemas();
      const bestaand=new Set(all('SELECT name FROM themas').map(t=>(t.name||'').trim().toLowerCase()));
      let aangemaakt=0, overgeslagen=0, items=0;
      lijst.forEach(t=>{
        if(bestaand.has(t.naam.toLowerCase())){ overgeslagen++; return; }
        const color=(t.type==='themadag')?'#2563EB':'#1D9E75';
        const tid=ins('INSERT INTO themas (name,color,categorie,leeftijdsgroep) VALUES (?,?,?,?)',[t.naam,color,'',t.leeftijdsgroep||'']);
        t.materiaal.forEach(m=>{ ins('INSERT INTO thema_materiaal (thema_id,name,qty,stockage_locatie_id,stockage_code) VALUES (?,?,?,?,?)',[tid,m.naam,1,null,m.locatie||'']); items++; });
        bestaand.add(t.naam.toLowerCase());
        aangemaakt++;
      });
      logAct('thema','import',`Planning-import: ${aangemaakt} thema's, ${items} materiaalitems (${overgeslagen} bestonden al)`,null,'');
      res.json({ok:true, aangemaakt, overgeslagen, materiaalitems:items});
    }catch(e){ res.status(500).json({error:e.message}); }
  });
  // Import uit een geupload bestand: body = {themas:[...]} (of een kale array).
  // Accepteert zowel het foto-formaat (naam/locatie) als app-export (name/stockage_code).
  function _mergeThemaLijst(raw){
    const map=new Map(); const order=[];
    for(const t of (raw||[])){
      const key=((t.naam||t.name||'')+'').trim(); if(!key) continue;
      if(!map.has(key)){ map.set(key,{naam:key,type:t.type||'kamp',leeftijdsgroep:t.leeftijdsgroep||'',materiaal:[]}); order.push(key); }
      const dst=map.get(key);
      if(!dst.leeftijdsgroep && t.leeftijdsgroep) dst.leeftijdsgroep=t.leeftijdsgroep;
      for(const m of (t.materiaal||[])){
        const mn=((m.naam||m.name||'')+'').trim(); if(!mn) continue;
        const loc=((m.locatie||m.stockage_code||'')+'').trim();
        if(!dst.materiaal.some(x=>x.naam===mn && x.locatie===loc)) dst.materiaal.push({naam:mn,locatie:loc});
      }
    }
    return order.map(k=>map.get(k));
  }
  app.post('/api/import-themas/data', alleenKantoor, (req,res)=>{
    return res.status(410).json({error:'Uitgeschakeld — wordt vervangen door de nieuwe thema-invoerflow (zie MASTERPLAN S4)'});
    try{
      const body=req.body||{};
      const raw=Array.isArray(body)?body:(body.themas||body.lijst||[]);
      const lijst=_mergeThemaLijst(raw);
      if(!lijst.length) return res.status(400).json({error:"Geen thema's in het bestand gevonden"});
      const bestaand=new Set(all('SELECT name FROM themas').map(t=>(t.name||'').trim().toLowerCase()));
      let aangemaakt=0, overgeslagen=0, items=0;
      lijst.forEach(t=>{
        if(bestaand.has(t.naam.toLowerCase())){ overgeslagen++; return; }
        const color=(t.type==='themadag')?'#2563EB':'#1D9E75';
        const tid=ins('INSERT INTO themas (name,color,categorie,leeftijdsgroep) VALUES (?,?,?,?)',[t.naam,color,'',t.leeftijdsgroep||'']);
        t.materiaal.forEach(m=>{ ins('INSERT INTO thema_materiaal (thema_id,name,qty,stockage_locatie_id,stockage_code) VALUES (?,?,?,?,?)',[tid,m.naam,1,null,m.locatie||'']); items++; });
        bestaand.add(t.naam.toLowerCase());
        aangemaakt++;
      });
      logAct('thema','import',`Bestand-import: ${aangemaakt} thema's, ${items} materiaalitems (${overgeslagen} bestonden al)`,null,'');
      res.json({ok:true, aangemaakt, overgeslagen, materiaalitems:items});
    }catch(e){ res.status(500).json({error:e.message}); }
  });

  // ── MATERIAAL ──
  app.get('/api/materiaal',(req,res)=>{const items=all('SELECT * FROM materiaal_items ORDER BY cat,name');const eenheden=all('SELECT * FROM materiaal_eenheden');res.json(items.map(i=>({...i,eenheden:eenheden.filter(e=>e.item_id===i.id)})));});
  app.post('/api/materiaal',(req,res)=>{const{name,tracking,cat}=req.body;const item_type_id=resolveItemTypeId(name);const id=ins('INSERT INTO materiaal_items (name,tracking,cat,created_at,item_type_id) VALUES (?,?,?,?,?)',[name,tracking||'per_type',cat||'andere',now(),item_type_id]);res.json({...get('SELECT * FROM materiaal_items WHERE id=?',[id]),eenheden:[]});});
  app.put('/api/materiaal/:id',(req,res)=>{const{name,tracking,cat}=req.body;const cur=get('SELECT * FROM materiaal_items WHERE id=?',[req.params.id]);const item_type_id=name&&name!==cur?.name?resolveItemTypeId(name):cur?.item_type_id;run('UPDATE materiaal_items SET name=?,tracking=?,cat=?,item_type_id=? WHERE id=?',[name,tracking,cat,item_type_id,req.params.id]);res.json(get('SELECT * FROM materiaal_items WHERE id=?',[req.params.id]));});
  app.delete('/api/materiaal/:id',(req,res)=>{const ee=all('SELECT id FROM materiaal_eenheden WHERE item_id=?',[req.params.id]);ee.forEach(e=>run('DELETE FROM verplaatsingen WHERE eenheid_id=?',[e.id]));run('DELETE FROM materiaal_eenheden WHERE item_id=?',[req.params.id]);run('DELETE FROM materiaal_items WHERE id=?',[req.params.id]);res.json({ok:true});});
  app.get('/api/overzicht',(req,res)=>{const locs=all('SELECT * FROM locaties ORDER BY type,name');const items=all('SELECT * FROM materiaal_items');const eenheden=all('SELECT * FROM materiaal_eenheden');res.json(locs.map(l=>({...l,eenheden:eenheden.filter(e=>e.locatie_id===l.id).map(e=>({...e,item:items.find(i=>i.id===e.item_id)||{}}))})));});

  // ── THEMA CATEGORIEËN ──
  app.get('/api/thema-categorieen',(req,res)=>res.json(all('SELECT * FROM thema_categorieen ORDER BY name')));
  app.post('/api/thema-categorieen',(req,res)=>{
    const{name}=req.body;if(!name||!name.trim())return res.status(400).json({error:'Naam vereist'});
    try{const id=ins('INSERT INTO thema_categorieen(name)VALUES(?)',[name.trim()]);res.json(get('SELECT * FROM thema_categorieen WHERE id=?',[id]));}
    catch(e){res.status(400).json({error:'Categorie bestaat al'});}
  });
  app.delete('/api/thema-categorieen/:id',(req,res)=>{
    run('DELETE FROM thema_categorieen WHERE id=?',[req.params.id]);res.json({ok:true});
  });

  // ── CHAUFFEURS/PLOEGPLANNING: S3.1 verwijderd, opgegaan in /api/personeel (rol='chauffeur')
  // + /api/personeel/:id/shifts + personeel_shifts. Zie Migratie 54 voor de datamigratie en
  // MASTERPLAN FASE S3 voor de achtergrond. De oude tabellen chauffeurs/ploeg_shifts blijven
  // in de database staan als archief maar worden vanuit code niet meer beschreven.

  // ── ITEM TYPES (centrale materiaalkatalogus) ──
  app.get('/api/item-types',(req,res)=>res.json(all('SELECT * FROM item_types ORDER BY categorie,naam')));
  app.post('/api/item-types',(req,res)=>{
    const{naam,eenheid,categorie,notities}=req.body;
    if(!naam?.trim())return res.status(400).json({error:'Naam vereist'});
    const id=ins('INSERT INTO item_types (naam,eenheid,categorie,notities) VALUES (?,?,?,?)',[naam.trim(),eenheid||'stuk',categorie||'',notities||'']);
    res.json(get('SELECT * FROM item_types WHERE id=?',[id]));
  });
  app.put('/api/item-types/:id',(req,res)=>{
    const{naam,eenheid,categorie,notities}=req.body;
    run('UPDATE item_types SET naam=?,eenheid=?,categorie=?,notities=? WHERE id=?',[naam,eenheid||'stuk',categorie||'',notities||'',req.params.id]);
    res.json(get('SELECT * FROM item_types WHERE id=?',[req.params.id]));
  });
  app.delete('/api/item-types/:id',(req,res)=>{
    run('DELETE FROM item_types WHERE id=?',[req.params.id]);
    res.json({ok:true});
  });
  // S4.5g: spreiding van een bulk-pool-rij over de locaties waar er exemplaren staan.
  app.get('/api/vaste-bakken/:id/spreiding',(req,res)=>{
    const bak=get('SELECT * FROM bakken WHERE id=?',[req.params.id]);
    if(!bak)return res.status(404).json({error:'Bak niet gevonden'});
    const rijen=all(`SELECT bs.locatie_id,bs.aantal,l.name AS locatie_naam FROM bulk_spreiding bs
      JOIN locaties l ON l.id=bs.locatie_id WHERE bs.bak_id=? AND bs.aantal>0 ORDER BY l.name`,[req.params.id]);
    res.json({bak_id:bak.id,naam:bak.naam,aantal:bak.aantal,is_bulk:!!bak.is_bulk,spreiding:rijen});
  });

  // ── CATALOGUS ITEM DETAIL ──
  app.get('/api/catalogus-item/:type/:id',(req,res)=>{
    const{type,id}=req.params;
    let item=null,extra={};
    if(type==='sport'){
      item=get('SELECT * FROM sport_items WHERE id=?',[id]);
      if(item){
        extra.sets=all('SELECT ss.*,l.name AS loc_naam FROM sport_sets ss LEFT JOIN locaties l ON ss.locatie_id=l.id WHERE ss.item_id=? ORDER BY ss.label',[id]);
      }
    } else if(type==='gedeeld'){
      item=get('SELECT * FROM gedeeld_items WHERE id=?',[id]);
      if(item){
        extra.stock=all('SELECT gs.*,l.name AS locatie_name FROM gedeeld_stock gs JOIN locaties l ON gs.locatie_id=l.id WHERE gs.gedeeld_id=? ORDER BY l.name',[id]);
      }
    } else if(type==='verbruik'){
      item=get('SELECT * FROM materiaal_items WHERE id=? AND tracking=?',[id,'verbruik']);
      if(item){
        extra.stock=all('SELECT vs.*,l.name AS locatie_name FROM verbruik_stock vs JOIN locaties l ON vs.locatie_id=l.id WHERE vs.item_id=? ORDER BY l.name',[id]);
        extra.log=all('SELECT vl.*,l.name AS loc_naam FROM verbruik_log vl LEFT JOIN locaties l ON vl.locatie_id=l.id WHERE vl.item_id=? ORDER BY vl.created_at DESC LIMIT 20',[id]);
      }
    }
    if(!item)return res.status(404).json({error:'Item niet gevonden'});
    // Transport check historiek op naam
    const naam=item.name||item.naam||'';
    extra.checks=naam?all(`
      SELECT vc.*,r.datum AS rit_datum,r.chauffeur,r.voertuig,
        GROUP_CONCAT(DISTINCT l.name) AS locaties
      FROM verhuis_checks vc
      JOIN transport_ritten r ON vc.rit_id=r.id
      LEFT JOIN transport_taken tt ON tt.rit_id=r.id
      LEFT JOIN locaties l ON (tt.van_locatie_id=l.id OR tt.naar_locatie_id=l.id)
      WHERE LOWER(vc.item_naam)=LOWER(?)
      GROUP BY vc.id ORDER BY r.datum DESC LIMIT 30
    `,[naam]):[];
    // Activiteiten log
    extra.activiteit=all(`SELECT * FROM activiteiten_log WHERE beschrijving LIKE ? ORDER BY id DESC LIMIT 10`,['%'+naam+'%']);
    res.json({...item,type,...extra});
  });

};
