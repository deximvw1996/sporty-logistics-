// routes/locaties.js — uit server.js geknipt (F1 deel 1). Gedrag ongewijzigd.
// Kopjes: LOCATIES, LOCATIECONFIG, locaties delete/geocode, STANDAARD MATERIAAL, LOCATIE MATERIAAL, KLEURENBORDEN
'use strict';
module.exports = function(ctx){
  const {app,db,get,all,run,ins,saveDb,backupDb,now,isoDate,_genToken,resolveItemTypeId,logAct,logWijziging,insMetLog,updateMetLog,delMetLog,vereisRol,alleenKantoor,hashPin,checkSessie,_actieveLocatieConfig,_kvVerwacht,_kvKampmoment,_kvNaam,_bakItems,effectiefMateriaal,ensureGedeeldStock,DATA_DIR,DB_PATH,UPLOADS_DIR,BUNDELS_DIR,FRONTEND_PATH,ROOT_DIR,APP_PASSWORD,PORT,path,fs,express,crypto} = ctx;
  // ── LOCATIES ──
  // CH1: contact_telefoon/adres als leesbare aliassen naast contact_tel/addr.
  app.get('/api/locaties',(req,res)=>res.json(all('SELECT * FROM locaties ORDER BY type,name').map(l=>({...l,contact_telefoon:l.contact_tel||'',adres:l.addr||''}))));
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
    // CH1: contact_telefoon/adres = aliassen van de bestaande kolommen contact_tel/addr; sleutel_info nieuw.
    // Contactgegevens en sleutel-info wijzigt alleen kantoor.
    const b=req.body||{};
    const cur0=get('SELECT * FROM locaties WHERE id=?',[req.params.id]);
    if(!cur0)return res.status(404).json({error:'Locatie niet gevonden'});
    // Alias wint als hij iets nieuws zegt (een client kan het hele GET-object met beide namen terugsturen).
    if(b.contact_telefoon!==undefined&&(b.contact_tel===undefined||b.contact_telefoon!==(cur0.contact_tel||'')))b.contact_tel=b.contact_telefoon;
    if(b.adres!==undefined&&(b.addr===undefined||b.adres!==(cur0.addr||'')))b.addr=b.adres;
    const raaktContact=['contact_naam','contact_tel','sleutel_info'].some(k=>b[k]!==undefined&&(b[k]||'')!==(cur0[k]||''));
    if(raaktContact&&(!req.persoon||req.persoon.rol!=='kantoor'))return res.status(403).json({error:'Contactgegevens en sleutel-info van een locatie wijzigt alleen kantoor'});
    if(b.sleutel_info!==undefined)run('UPDATE locaties SET sleutel_info=? WHERE id=?',[(b.sleutel_info||'').toString(),req.params.id]);
    // Reviewfix Fable (CH2-keuring): een gedeeltelijke PUT (bv. enkel contact) vult de rest aan uit de huidige rij,
    // anders werd name=undefined weggeschreven (500) terwijl sleutel_info al was bijgewerkt.
    const{name,addr,type,contact_naam,contact_tel,notities,lat,lng,stockage_rol,parent_id,heeft_eigen_sportmateriaal,heeft_eigen_oven,zelf_kuisen,wifi,gemeente}={...cur0,...b};
    // LO1: wifi en gemeente erbij; de wijziging gaat nu via updateMetLog (oud/nieuw in wijzigingen, omkeerbaar).
    updateMetLog(req,'UPDATE locaties SET name=?,addr=?,type=?,contact_naam=?,contact_tel=?,notities=?,lat=?,lng=?,stockage_rol=?,parent_id=?,heeft_eigen_sportmateriaal=?,heeft_eigen_oven=?,zelf_kuisen=?,wifi=?,gemeente=? WHERE id=?',
      [name,addr||'',type||'kamp',contact_naam||'',contact_tel||'',notities||'',lat||null,lng||null,stockage_rol||'beide',parent_id||null,heeft_eigen_sportmateriaal?1:0,heeft_eigen_oven?1:0,zelf_kuisen?1:0,(wifi||'').toString().slice(0,200),(gemeente||'').toString().slice(0,100),req.params.id],'locatie');
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
  // LO1: foto's per locatie (ingang, lokaal, berging…) als bestand via lib/fotos.js; gelogd.
  const fotos=require('../lib/fotos')(ctx.UPLOADS_DIR);
  app.post('/api/locaties/:id/foto',alleenKantoor,(req,res)=>{
    const loc=get('SELECT * FROM locaties WHERE id=?',[req.params.id]);
    if(!loc)return res.status(404).json({error:'Locatie niet gevonden'});
    if(!req.body?.foto_data)return res.status(400).json({error:'Geen foto meegegeven'});
    let f;try{f=fotos.verwerkWaarde(req.body.foto_data,'','locatie');}catch(e){return res.status(e.status||500).json({error:e.status?e.message:'Foto opslaan mislukt'});}
    const id=insMetLog(req,'INSERT INTO locatie_fotos (locatie_id,tijdstip,wie,beschrijving,foto_path) VALUES (?,?,?,?,?)',
      [loc.id,now(),(req.persoon&&req.persoon.naam)||'',String(req.body.beschrijving||'').slice(0,100),f.pad],'locatie: foto');
    logAct('locatie','foto',`Foto toegevoegd bij "${loc.name}"${req.body.beschrijving?' ('+req.body.beschrijving+')':''}`,loc.id,loc.name);
    res.json({id,url:f.url});
  });
  app.delete('/api/locaties/:id/foto/:fotoId',alleenKantoor,(req,res)=>{
    const f=get('SELECT * FROM locatie_fotos WHERE id=? AND locatie_id=?',[req.params.fotoId,req.params.id]);
    if(!f)return res.status(404).json({error:'Foto niet gevonden'});
    delMetLog(req,'DELETE FROM locatie_fotos WHERE id=?',[f.id],'locatie: foto');
    if(f.foto_path)fotos.verwijderFoto(f.foto_path);
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
  // V2: kleurenborden horen bij een periode (?periode_id= of body.periode_id, standaard de actieve).
  const _kbPeriode=(v)=>parseInt(v)||(get('SELECT id FROM vakantieperiodes WHERE actief=1')||{}).id||null;
  app.get('/api/kleurenborden',(req,res)=>{
    res.json(all('SELECT kb.*,l.name as locatie_naam FROM locatie_kleuren kb LEFT JOIN locaties l ON l.id=kb.locatie_id WHERE kb.periode_id=? ORDER BY kb.locatie_id,kb.week,kb.kleur',[_kbPeriode(req.query.periode_id)]));
  });
  app.post('/api/kleurenborden',(req,res)=>{
    const{locatie_id,week,kleur,aantal}=req.body;
    if(!locatie_id||!week||!kleur)return res.status(400).json({error:'locatie_id, week en kleur zijn verplicht'});
    try{const id=ins('INSERT INTO locatie_kleuren (locatie_id,week,kleur,aantal,periode_id) VALUES (?,?,?,?,?)',[locatie_id,week,(kleur+'').toUpperCase(),aantal||1,_kbPeriode(req.body.periode_id)]);res.json(get('SELECT * FROM locatie_kleuren WHERE id=?',[id]));}
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
    const pid=_kbPeriode(req.body.periode_id);
    run('DELETE FROM locatie_kleuren WHERE locatie_id=? AND week=? AND periode_id=?',[locatie_id,week,pid]);
    kleuren.filter(k=>k.kleur&&k.aantal>0).forEach(k=>{
      ins('INSERT INTO locatie_kleuren (locatie_id,week,kleur,aantal,periode_id) VALUES (?,?,?,?,?)',[locatie_id,week,(k.kleur+'').toUpperCase(),k.aantal,pid]);
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

  // (PUT /api/transport-taken/:id/rit staat sinds TB1 in routes/transport.js — ontkoppelen wist daar geen datum meer.)
};
