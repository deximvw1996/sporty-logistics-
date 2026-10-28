// routes/locaties.js — uit server.js geknipt (F1 deel 1). Gedrag ongewijzigd.
// Kopjes: LOCATIES, LOCATIECONFIG, locaties delete/geocode, STANDAARD MATERIAAL, LOCATIE MATERIAAL, KLEURENBORDEN
'use strict';
module.exports = function(ctx){
  const {app,db,get,all,run,ins,saveDb,backupDb,now,isoDate,_genToken,resolveItemTypeId,logAct,vereisRol,alleenKantoor,hashPin,checkSessie,_actieveLocatieConfig,_kvVerwacht,_kvKampmoment,_kvNaam,_bakItems,effectiefMateriaal,ensureGedeeldStock,DATA_DIR,DB_PATH,UPLOADS_DIR,BUNDELS_DIR,FRONTEND_PATH,ROOT_DIR,APP_PASSWORD,PORT,path,fs,express,crypto} = ctx;
  // ── LOCATIES ──
  app.get('/api/locaties',(req,res)=>res.json(all('SELECT * FROM locaties ORDER BY type,name')));
  app.post('/api/locaties',(req,res)=>{
    const{name,addr,type,contact_naam,contact_tel,notities,lat,lng,stockage_rol,parent_id}=req.body;
    if(!name||!name.trim())return res.status(400).json({error:'Naam is verplicht'});
    const id=ins('INSERT INTO locaties (name,addr,type,contact_naam,contact_tel,notities,lat,lng,stockage_rol,parent_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [name.trim(),addr||'',type||'kamp',contact_naam||'',contact_tel||'',notities||'',lat||null,lng||null,stockage_rol||'beide',parent_id||null]);
    const loc=get('SELECT * FROM locaties WHERE id=?',[id]);
    logAct('locatie','aangemaakt',`Locatie "${loc.name}" aangemaakt`+(addr?` (${addr})`:''),id,loc.name);
    res.json(loc);
  });
  app.put('/api/locaties/:id',(req,res)=>{
    const{name,addr,type,contact_naam,contact_tel,notities,lat,lng,stockage_rol,parent_id,heeft_eigen_sportmateriaal,heeft_eigen_oven,zelf_kuisen}=req.body;
    run('UPDATE locaties SET name=?,addr=?,type=?,contact_naam=?,contact_tel=?,notities=?,lat=?,lng=?,stockage_rol=?,parent_id=?,heeft_eigen_sportmateriaal=?,heeft_eigen_oven=?,zelf_kuisen=? WHERE id=?',
      [name,addr||'',type||'kamp',contact_naam||'',contact_tel||'',notities||'',lat||null,lng||null,stockage_rol||'beide',parent_id||null,heeft_eigen_sportmateriaal?1:0,heeft_eigen_oven?1:0,zelf_kuisen?1:0,req.params.id]);
    const loc=get('SELECT * FROM locaties WHERE id=?',[req.params.id]);
    logAct('locatie','bewerkt',`Locatie "${loc.name}" bewerkt`,loc.id,loc.name);
    res.json(loc);
  });

  // ── S2.5: LOCATIECONFIG (vaste exemplaren per kamplocatie, vervangt standaard_dozen/locatie_doos_config/kampmoment-dozen) ──
  app.get('/api/vast-types',(req,res)=>{
    res.json(all("SELECT DISTINCT vast_type FROM bakken WHERE soort='vast' AND vast_type!='' ORDER BY vast_type").map(r=>r.vast_type));
  });
  app.get('/api/locatie-config/:locatie_id',(req,res)=>{
    res.json(all('SELECT * FROM locatie_config WHERE kamplocatie_id=? ORDER BY vast_type',[req.params.locatie_id]));
  });
  app.post('/api/locatie-config',(req,res)=>{
    const{kamplocatie_id,vast_type,aantal,conditie_type,conditie_waarde,pauze_gedrag}=req.body;
    if(!kamplocatie_id||!vast_type)return res.status(400).json({error:'kamplocatie_id en vast_type verplicht'});
    const pg=(pauze_gedrag==='ophalen')?'ophalen':'blijven';
    const bestaat=get('SELECT id FROM locatie_config WHERE kamplocatie_id=? AND vast_type=?',[kamplocatie_id,vast_type]);
    if(bestaat){
      run('UPDATE locatie_config SET aantal=?,conditie_type=?,conditie_waarde=?,pauze_gedrag=? WHERE id=?',
        [aantal||1,conditie_type||'altijd',conditie_waarde||'',pg,bestaat.id]);
    } else {
      ins('INSERT INTO locatie_config (kamplocatie_id,vast_type,aantal,conditie_type,conditie_waarde,pauze_gedrag) VALUES (?,?,?,?,?,?)',
        [kamplocatie_id,vast_type,aantal||1,conditie_type||'altijd',conditie_waarde||'',pg]);
    }
    res.json(all('SELECT * FROM locatie_config WHERE kamplocatie_id=? ORDER BY vast_type',[kamplocatie_id]));
  });
  app.delete('/api/locatie-config/:id',(req,res)=>{
    run('DELETE FROM locatie_config WHERE id=?',[req.params.id]);
    res.json({ok:true});
  });

  app.delete('/api/locaties/:id',(req,res)=>{
    const loc=get('SELECT * FROM locaties WHERE id=?',[req.params.id]);
    run('DELETE FROM locaties WHERE id=?',[req.params.id]);
    if(loc) logAct('locatie','verwijderd',`Locatie "${loc.name}" verwijderd`,null,loc.name);
    res.json({ok:true});
  });
  // Geocodeer adressen -> lat/lng via OpenStreetMap Nominatim (gratis, geen sleutel).
  // Standaard enkel locaties zonder coordinaten; ?force=1 hergeocodeert alles.
  app.post('/api/locaties/geocode', async (req,res)=>{
    const force = req.query.force==='1' || req.body?.force===true;
    const todo = all(force
      ? "SELECT * FROM locaties WHERE addr IS NOT NULL AND TRIM(addr)<>''"
      : "SELECT * FROM locaties WHERE addr IS NOT NULL AND TRIM(addr)<>'' AND (lat IS NULL OR lng IS NULL)");
    const sleep = ms => new Promise(r=>setTimeout(r,ms));
    const gedaan=[], mislukt=[];
    for(const loc of todo){
      try{
        let q = String(loc.addr).trim();
        if(!/belgi|belgium/i.test(q)) q += ', België';
        const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=be&q=' + encodeURIComponent(q);
        const resp = await fetch(url, { headers: { 'User-Agent': 'sporty-logistics/1.0 (logistiek app)', 'Accept-Language': 'nl' } });
        const arr = await resp.json();
        if(Array.isArray(arr) && arr.length){
          const lat = parseFloat(arr[0].lat), lng = parseFloat(arr[0].lon);
          run('UPDATE locaties SET lat=?,lng=? WHERE id=?',[lat,lng,loc.id]);
          gedaan.push({ id:loc.id, name:loc.name, lat, lng });
        } else {
          mislukt.push({ id:loc.id, name:loc.name, reden:'geen resultaat' });
        }
      }catch(e){ mislukt.push({ id:loc.id, name:loc.name, reden:e.message }); }
      await sleep(1100); // Nominatim policy: max 1 verzoek/seconde
    }
    res.json({ gevraagd:todo.length, gelukt:gedaan.length, mislukt:mislukt.length, details:{ gedaan, mislukt } });
  });

  // ── STANDAARD MATERIAAL (globale template) ──
  app.get('/api/standaard',(req,res)=>res.json(all('SELECT * FROM standaard_materiaal ORDER BY cat,name')));
  app.post('/api/standaard',(req,res)=>{const{name,qty,cat,stockage_locatie_id}=req.body;const item_type_id=resolveItemTypeId(name);const id=ins('INSERT INTO standaard_materiaal (name,qty,cat,stockage_locatie_id,item_type_id) VALUES (?,?,?,?,?)',[name,qty||1,cat||'andere',stockage_locatie_id||null,item_type_id]);res.json(get('SELECT * FROM standaard_materiaal WHERE id=?',[id]));});
  app.put('/api/standaard/:id',(req,res)=>{const{name,qty,cat,stockage_locatie_id}=req.body;run('UPDATE standaard_materiaal SET name=?,qty=?,cat=?,stockage_locatie_id=? WHERE id=?',[name,qty,cat,stockage_locatie_id||null,req.params.id]);res.json(get('SELECT * FROM standaard_materiaal WHERE id=?',[req.params.id]));});
  app.delete('/api/standaard/:id',(req,res)=>{run('DELETE FROM standaard_materiaal WHERE id=?',[req.params.id]);res.json({ok:true});});

  // Volledige lijst incl. verborgen basisitems (gemarkeerd) zodat de editor alles toont; voor weergave filter je verborgen eruit.
  app.get('/api/locaties/:id/materiaal',(req,res)=>res.json(effectiefMateriaal(req.params.id)));
  // Per-kamp afwijking op een basisitem: verbergen en/of aantal overschrijven (qty=null => terug naar basis-aantal).
  app.post('/api/locaties/:id/basis/:sid',(req,res)=>{
    const {verborgen, qty} = req.body;
    const cur = get('SELECT * FROM kamp_basis_afwijking WHERE locatie_id=? AND standaard_id=?',[req.params.id, req.params.sid]);
    const v = (verborgen===undefined||verborgen===null) ? (cur?cur.verborgen:0) : (verborgen?1:0);
    const q = (qty===undefined) ? (cur?cur.qty:null) : (qty===null?null:Math.max(1,parseInt(qty)||1));
    if(cur){ run('UPDATE kamp_basis_afwijking SET verborgen=?, qty=? WHERE id=?',[v,q,cur.id]); }
    else { ins('INSERT INTO kamp_basis_afwijking (locatie_id,standaard_id,verborgen,qty) VALUES (?,?,?,?)',[req.params.id,req.params.sid,v,q]); }
    res.json({ok:true, verborgen:v, qty:q});
  });
  app.post('/api/locaties/:id/materiaal',(req,res)=>{
    const{name,qty,cat}=req.body;
    const item_type_id=resolveItemTypeId(name);
    const id=ins('INSERT INTO locatie_materiaal (locatie_id,name,qty,cat,item_type_id) VALUES (?,?,?,?,?)',[req.params.id,name,qty||1,cat||'andere',item_type_id]);
    res.json(get('SELECT * FROM locatie_materiaal WHERE id=?',[id]));
  });
  app.put('/api/locatie-materiaal/:id',(req,res)=>{
    const{name,qty,cat}=req.body;
    const cur=get('SELECT * FROM locatie_materiaal WHERE id=?',[req.params.id]);
    const item_type_id=name&&name!==cur?.name?resolveItemTypeId(name):cur?.item_type_id;
    run('UPDATE locatie_materiaal SET name=?,qty=?,cat=?,item_type_id=? WHERE id=?',[name,qty||1,cat||'andere',item_type_id,req.params.id]);
    res.json(get('SELECT * FROM locatie_materiaal WHERE id=?',[req.params.id]));
  });
  app.delete('/api/locatie-materiaal/:id',(req,res)=>{
    run('DELETE FROM locatie_materiaal WHERE id=?',[req.params.id]);
    res.json({ok:true});
  });
  // Kopieer template naar locatie (vanuit standaard_materiaal)
  app.post('/api/locaties/:id/materiaal-van-template',(req,res)=>{
    const std=all('SELECT * FROM standaard_materiaal');
    const existing=all('SELECT name FROM locatie_materiaal WHERE locatie_id=?',[req.params.id]).map(r=>r.name);
    const added=[];
    std.forEach(s=>{
      if(!existing.includes(s.name)){
        const item_type_id=s.item_type_id||resolveItemTypeId(s.name);
        const id=ins('INSERT INTO locatie_materiaal (locatie_id,name,qty,cat,item_type_id) VALUES (?,?,?,?,?)',[req.params.id,s.name,s.qty,s.cat||'andere',item_type_id]);
        added.push(get('SELECT * FROM locatie_materiaal WHERE id=?',[id]));
      }
    });
    res.json(added);
  });

  // ── KLEURENBORDEN PER LOCATIE EN WEEK ──
  app.get('/api/kleurenborden',(req,res)=>{
    res.json(all('SELECT kb.*,l.name as locatie_naam FROM locatie_kleuren kb LEFT JOIN locaties l ON l.id=kb.locatie_id ORDER BY kb.locatie_id,kb.week,kb.kleur'));
  });
  app.post('/api/kleurenborden',(req,res)=>{
    const{locatie_id,week,kleur,aantal}=req.body;
    if(!locatie_id||!week||!kleur)return res.status(400).json({error:'locatie_id, week en kleur zijn verplicht'});
    try{const id=ins('INSERT INTO locatie_kleuren (locatie_id,week,kleur,aantal) VALUES (?,?,?,?)',[locatie_id,week,(kleur+'').toUpperCase(),aantal||1]);res.json(get('SELECT * FROM locatie_kleuren WHERE id=?',[id]));}
    catch(e){res.status(400).json({error:'Combinatie bestaat al'});}
  });
  app.put('/api/kleurenborden/:id',(req,res)=>{
    run('UPDATE locatie_kleuren SET aantal=? WHERE id=?',[req.body.aantal||1,req.params.id]);
    res.json(get('SELECT * FROM locatie_kleuren WHERE id=?',[req.params.id]));
  });
  app.delete('/api/kleurenborden/:id',(req,res)=>{
    run('DELETE FROM locatie_kleuren WHERE id=?',[req.params.id]);
    res.json({ok:true});
  });
  // Bulk upsert: vervang de hele set voor locatie × week in één call
  app.post('/api/kleurenborden/bulk',(req,res)=>{
    const{locatie_id,week,kleuren}=req.body;
    if(!locatie_id||!week||!Array.isArray(kleuren))return res.status(400).json({error:'locatie_id, week en kleuren[] zijn verplicht'});
    run('DELETE FROM locatie_kleuren WHERE locatie_id=? AND week=?',[locatie_id,week]);
    kleuren.filter(k=>k.kleur&&k.aantal>0).forEach(k=>{
      ins('INSERT INTO locatie_kleuren (locatie_id,week,kleur,aantal) VALUES (?,?,?,?)',[locatie_id,week,(k.kleur+'').toUpperCase(),k.aantal]);
    });
    res.json({ok:true,opgeslagen:kleuren.length});
  });

  // Kleurenborden stock per stockagelocatie
  app.get('/api/kleurenborden-stock/:locatie_id',(req,res)=>{
    res.json(all('SELECT * FROM kleurenborden_stock WHERE locatie_id=? ORDER BY kleur',[req.params.locatie_id]));
  });
  app.post('/api/kleurenborden-stock/:locatie_id',(req,res)=>{
    const{kleuren}=req.body;
    if(!Array.isArray(kleuren))return res.status(400).json({error:'kleuren[] vereist'});
    run('DELETE FROM kleurenborden_stock WHERE locatie_id=?',[req.params.locatie_id]);
    kleuren.filter(k=>k.kleur&&k.aantal>0).forEach(k=>{
      ins('INSERT INTO kleurenborden_stock (locatie_id,kleur,aantal) VALUES (?,?,?)',[req.params.locatie_id,(k.kleur+'').toUpperCase(),k.aantal]);
    });
    res.json({ok:true});
  });

  // Koppel een taak aan een rit (getal), of ontkoppel → nood (null)
  app.put('/api/transport-taken/:id/rit',(req,res)=>{
    const {rit_id}=req.body;
    const t=get('SELECT * FROM transport_taken WHERE id=?',[req.params.id]);
    if(!t) return res.status(404).json({error:'Transport niet gevonden'});
    if(rit_id===null||rit_id===undefined||rit_id===''){
      run("UPDATE transport_taken SET rit_id=NULL,datum='',wie='' WHERE id=?",[req.params.id]);
    } else {
      const rit=get('SELECT * FROM transport_ritten WHERE id=?',[rit_id]);
      if(!rit) return res.status(404).json({error:'Rit niet gevonden'});
      run('UPDATE transport_taken SET rit_id=?,datum=?,wie=? WHERE id=?',[rit_id,rit.datum,rit.chauffeur||'',req.params.id]);
    }
    const taak=get('SELECT * FROM transport_taken WHERE id=?',[req.params.id]);
    const regels=all('SELECT * FROM transport_regels WHERE taak_id=?',[req.params.id]);
    res.json({...taak,regels});
  });
};
