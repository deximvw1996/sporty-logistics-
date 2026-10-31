// routes/meldingen.js — ME1 punt 1: meldingen met echte bronnen. Tabel meldingen (voor_persoon_id leeg = iedereen met die rol).
// Andere routes schrijven via ctx.melding(req,{...}); dezelfde ongelezen melding voor dezelfde ontvanger wordt niet dubbel gemaakt.
// Gelezen: persoonlijke melding in meldingen.gelezen_op; een melding voor een hele rol per persoon in meldingen_gelezen,
// zodat de ene coördinator ze niet wegleest voor de andere. Alles gelogd (wijzigingen).
'use strict';
module.exports = function(ctx){
  const {app,get,all,run,now,insMetLog,updateMetLog,alleenKantoor,logAct,path,ROOT_DIR,_genToken} = ctx;
  const ROLLEN=['kantoor','chauffeur','coordinator','monitor'];
  const isoNu=()=>new Date().toISOString();

  function melding(req,{voor_rol,voor_persoon_id,van_naam,tekst,link}){
    try{
      const pid=voor_persoon_id||null,rol=pid?'':(voor_rol||'');
      if(!tekst||(!pid&&!rol))return null;
      const dubbel=get("SELECT id FROM meldingen WHERE tekst=? AND COALESCE(voor_rol,'')=? AND voor_persoon_id IS ? AND gelezen_op IS NULL",[tekst,rol,pid]);
      if(dubbel)return dubbel.id;
      return insMetLog(req||null,'INSERT INTO meldingen (voor_rol,voor_persoon_id,van_naam,tekst,link,created_at) VALUES (?,?,?,?,?,?)',[rol,pid,van_naam||'',String(tekst),link||'',isoNu()],'melding');
    }catch(e){console.error('Melding mislukt:',e.message);return null;} // een melding mag de echte actie nooit blokkeren
  }
  // Rit-bestuurder: gekoppeld personeelslid, anders exact één actieve persoon met die naam (hoofdletterongevoelig).
  function persoonOpNaam(naam){
    const n=String(naam||'').trim().toLowerCase();if(!n)return null;
    const l=all('SELECT id,naam FROM personeel WHERE COALESCE(actief,1)=1').filter(p=>String(p.naam||'').trim().toLowerCase()===n);
    return l.length===1?l[0]:null;
  }
  // ── TF3 punt 3: meldingen over een rit aan de bestuurder ──
  const KORT=['zo','ma','di','wo','do','vr','za'],SAMEN_MS=2*60*1000;
  const pidVan=r=>r.personeel_id||(persoonOpNaam(r.chauffeur)||{}).id||null;
  function ritWanneer(r){ // "vr 30/10 om 10:15"
    if(!/^\d{4}-\d{2}-\d{2}$/.test(r.datum||''))return '';
    const d=new Date(r.datum+'T12:00:00');let uur=r.vertrek||'';try{uur=ctx._ritPlanInfo(r).vertrek||uur;}catch(e){}
    return `${KORT[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}${uur?' om '+String(uur).slice(0,5):''}`;
  }
  const ritKop=r=>{const w=ritWanneer(r);return `Rit #${r.id}${w?' ('+w+')':''}`;};
  function ritLink(r){
    let t=r.rit_token;if(!t&&_genToken){t=_genToken(10);run('UPDATE transport_ritten SET rit_token=? WHERE id=?',[t,r.id]);r.rit_token=t;}
    return t?'/rit/'+t:'/vandaag?tab=ritten';
  }
  const zelf=(req,pid)=>!pid||(req&&req.persoon&&req.persoon.persoon_id===pid);
  // Tien snelle wijzigingen = één melding: de ongelezen melding van de laatste 2 minuten voor dezelfde rit en persoon wordt bijgewerkt.
  function ritGewijzigd(req,ritOfId,wat){
    const r=get('SELECT * FROM transport_ritten WHERE id=?',[ritOfId&&ritOfId.id||ritOfId]);
    if(!r||(r.klaarzet_status!=='klaar'&&r.status!=='onderweg')||['gedaan','geannuleerd'].includes(r.status))return; // TF5 G4: een gestarte rit krijgt altijd een melding
    const pid=pidVan(r);if(zelf(req,pid))return;
    const prefix=`Rit #${r.id} `,recent=all('SELECT * FROM meldingen WHERE voor_persoon_id=? AND gelezen_op IS NULL ORDER BY id DESC LIMIT 20',[pid]).find(m=>m.tekst.startsWith(prefix)&&m.tekst.includes(' is gewijzigd: ')&&Date.now()-new Date(m.created_at).getTime()<SAMEN_MS);
    const oud=recent?recent.tekst.split(' is gewijzigd: ')[1].split(', '):[];
    const tekst=`${ritKop(r)} is gewijzigd: ${[...new Set([...oud,wat])].join(', ')}`;
    try{
      if(recent)updateMetLog(req,'meldingen',recent.id,{tekst,created_at:isoNu()},'melding bijgewerkt');
      else melding(req,{voor_persoon_id:pid,van_naam:'Kantoor',tekst,link:ritLink(r)});
    }catch(e){console.error('Ritmelding mislukt:',e.message);}
  }
  function ritKlaar(req,ritId){
    const r=get('SELECT * FROM transport_ritten WHERE id=?',[ritId]);if(!r)return;
    const pid=pidVan(r);if(zelf(req,pid))return;
    melding(req,{voor_persoon_id:pid,van_naam:'Kantoor',tekst:`${ritKop(r)} ${all('SELECT id FROM meldingen WHERE voor_persoon_id=? AND tekst LIKE ?',[pid,`Rit #${r.id} %staat niet meer klaar%`]).length?'staat weer klaar':'staat voor je klaar'}`,link:ritLink(r)});
  }
  function ritNietKlaar(req,r){const pid=pidVan(r);if(!zelf(req,pid))melding(req,{voor_persoon_id:pid,van_naam:'Kantoor',tekst:`${ritKop(r)} staat niet meer klaar: kantoor past ze nog aan`,link:'/vandaag?tab=ritten'});}
  // Bestuurderswissel na klaarzetten: de oude én de nieuwe krijgen er één. Geeft true als er gewisseld is.
  function ritBestuurder(req,voor,ritId){
    const r=get('SELECT * FROM transport_ritten WHERE id=?',[ritId]);if(!r)return false;
    const oud=pidVan(voor),nw=pidVan(r);
    if(oud===nw||(r.klaarzet_status!=='klaar'&&r.status!=='onderweg'))return false;
    if(!zelf(req,oud))melding(req,{voor_persoon_id:oud,van_naam:'Kantoor',tekst:`${ritKop(r)} rijd je niet meer: een andere bestuurder neemt ze over. ${(get('SELECT COUNT(*) AS n FROM verhuis_checks WHERE rit_id=? AND geladen=1 AND COALESCE(gelost,0)=0',[r.id])||{}).n?'Wat je al geladen hebt: zet het terug in de stockage of bel kantoor.':'Je hoeft niets meer te doen.'}`,link:'/vandaag?tab=ritten'});
    if(!zelf(req,nw))melding(req,{voor_persoon_id:nw,van_naam:'Kantoor',tekst:`${ritKop(r)} is aan jou toegewezen`,link:ritLink(r)});
    return true;
  }
  const voorWhere="(voor_persoon_id=? OR (voor_persoon_id IS NULL AND voor_rol=?))";
  function vanPersoon(p,alleenOngelezen){
    const gel=new Set(all('SELECT melding_id FROM meldingen_gelezen WHERE persoon_id=?',[p.persoon_id]).map(r=>r.melding_id));
    return all(`SELECT * FROM meldingen WHERE ${voorWhere} ORDER BY id DESC LIMIT 200`,[p.persoon_id,p.rol])
      .map(m=>({id:m.id,van_naam:m.van_naam||'',tekst:m.tekst,titel:(m.van_naam&&!m.tekst.includes(m.van_naam)?m.van_naam+': ':'')+m.tekst,link:m.link||'',created_at:m.created_at,voor_rol:m.voor_rol||'',voor_persoon_id:m.voor_persoon_id,gelezen:!!(m.gelezen_op||gel.has(m.id))}))
      .filter(m=>!alleenOngelezen||!m.gelezen);
  }
  function leesVoor(req,m){
    if(m.voor_persoon_id)updateMetLog(req,'meldingen',m.id,{gelezen_op:isoNu()},'melding gelezen');
    else if(!get('SELECT id FROM meldingen_gelezen WHERE melding_id=? AND persoon_id=?',[m.id,req.persoon.persoon_id]))
      insMetLog(req,'INSERT INTO meldingen_gelezen (melding_id,persoon_id,gelezen_op) VALUES (?,?,?)',[m.id,req.persoon.persoon_id,isoNu()],'melding gelezen');
  }
  Object.assign(ctx,{melding,meldingenVan:vanPersoon,persoonOpNaam,meldRitGewijzigd:ritGewijzigd,meldRitKlaar:ritKlaar,meldRitBestuurder:ritBestuurder,meldRitNietKlaar:ritNietKlaar});

  app.get('/api/meldingen',(req,res)=>{const l=vanPersoon(req.persoon,false);res.json({meldingen:l,ongelezen:l.filter(m=>!m.gelezen).length});});
  app.get('/api/meldingen/ontvangers',alleenKantoor,(req,res)=>res.json({rollen:ROLLEN,personen:all("SELECT id,naam,rol FROM personeel WHERE COALESCE(actief,1)=1 AND rol<>'kv' ORDER BY naam")}));
  app.post('/api/meldingen/alles-gelezen',(req,res)=>{
    const ids=vanPersoon(req.persoon,true);ids.forEach(x=>leesVoor(req,get('SELECT * FROM meldingen WHERE id=?',[x.id])));res.json({ok:true,gelezen:ids.length});
  });
  app.post('/api/meldingen/:id/gelezen',(req,res)=>{
    const m=get(`SELECT * FROM meldingen WHERE id=? AND ${voorWhere}`,[req.params.id,req.persoon.persoon_id,req.persoon.rol]);
    if(!m)return res.status(404).json({error:'Melding niet gevonden'});
    leesVoor(req,m);res.json({ok:true});
  });
  app.post('/api/meldingen',alleenKantoor,(req,res)=>{
    const b=req.body||{},tekst=String(b.tekst||'').trim(),pid=parseInt(b.voor_persoon_id)||null,rol=b.voor_rol||'';
    if(!tekst)return res.status(400).json({error:'Tekst is verplicht'});
    if(pid){if(!get('SELECT id FROM personeel WHERE id=?',[pid]))return res.status(400).json({error:'Onbekende persoon'});}
    else if(!ROLLEN.includes(rol))return res.status(400).json({error:'Kies een persoon of een rol'});
    const link=/^\/(?![\/\\])/.test(b.link||'')?b.link:'';
    const id=melding(req,{voor_rol:rol,voor_persoon_id:pid,van_naam:req.persoon.naam,tekst,link});
    logAct('melding','bericht',`Bericht van ${req.persoon.naam} aan ${pid?(get('SELECT naam FROM personeel WHERE id=?',[pid])||{}).naam:rol}: ${tekst}`,null,null);
    res.json({ok:true,id});
  });
  // ── TF5 punt 6: coördinator zoekt op. Smalle leesroutes: alleen de velden hieronder, geen personeelsgegevens. Eén schrijfroute: bericht aan kantoor. ──
  const _zoek=req=>String(req.query.q||'').trim().toLowerCase();
  const _vandaag=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const _ln=id=>id?(get('SELECT name FROM locaties WHERE id=?',[id])||{}).name||'':'';
  app.get('/api/opzoeken/bakken',(req,res)=>{
    const q=_zoek(req);if(q.length<1)return res.json({bakken:[]});
    res.json({bakken:all('SELECT id,code,naam,huidige_locatie_id,thuislocatie_id,status,rek,plank,is_bulk FROM bakken ORDER BY code,naam').filter(b=>(String(b.code||'')+' '+String(b.naam||'')).toLowerCase().includes(q)).slice(0,30).map(b=>{
      const rit=get("SELECT tr.id,tr.datum,tr.vertrek,t.type FROM transport_regels r JOIN transport_taken t ON t.id=r.taak_id JOIN transport_ritten tr ON tr.id=t.rit_id WHERE r.bak_id=? AND t.status NOT IN ('gedaan','geannuleerd') AND tr.status NOT IN ('gedaan','geannuleerd') AND tr.datum>=? ORDER BY tr.datum,tr.vertrek LIMIT 1",[b.id,_vandaag()]);
      const rek=b.rek||(/^[A-Za-z]/.test(b.code||'')?String(b.code)[0].toUpperCase():'');
      return {id:b.id,code:b.code||'',naam:b.naam||'',locatie:_ln(b.huidige_locatie_id||b.thuislocatie_id),status:b.status||'',plaats:[rek?'rek '+rek:'',b.plank?'plank '+b.plank:''].filter(Boolean).join(' · '),rit:rit?{id:rit.id,datum:rit.datum,vertrek:rit.vertrek||'',type:rit.type||''}:null};
    })});
  });
  app.get('/api/opzoeken/artikelen',(req,res)=>{
    const q=_zoek(req),id=parseInt(req.query.id)||0;if(!q&&!id)return res.json({artikelen:[]});
    res.json({artikelen:all('SELECT id,naam,eenheid,pool_plaats FROM item_types ORDER BY naam').filter(a=>id?a.id===id:String(a.naam||'').toLowerCase().includes(q)).slice(0,30).map(a=>({id:a.id,naam:a.naam,eenheid:a.eenheid||'',plaats:a.pool_plaats||'',
      voorraad:all('SELECT l.name AS stockage,s.qty FROM item_type_stock s JOIN locaties l ON l.id=s.locatie_id WHERE s.item_type_id=? ORDER BY l.name',[a.id]),
      bakken:all('SELECT b.code,b.naam FROM bak_items i JOIN bakken b ON b.id=i.bak_id WHERE i.item_type_id=? ORDER BY b.code LIMIT 10',[a.id])}))});
  });
  app.get('/api/opzoeken/locaties',(req,res)=>{
    const q=_zoek(req);if(!q)return res.json({locaties:[]});
    res.json({locaties:all('SELECT id,name,addr,gemeente,type,contact_naam,contact_tel,sleutel_info,lat,lng FROM locaties ORDER BY name').filter(l=>(String(l.name||'')+' '+String(l.addr||'')+' '+String(l.gemeente||'')).toLowerCase().includes(q)).slice(0,30).map(l=>({id:l.id,naam:l.name,adres:l.addr||'',type:l.type||'',contact_naam:l.contact_naam||'',contact_telefoon:l.contact_tel||'',sleutel_info:l.sleutel_info||'',
      kaart:l.lat&&l.lng?`https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}`:l.addr?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.addr)}`:''}))});
  });
  app.get('/api/opzoeken/kantoor',(req,res)=>res.json({telefoon:(get("SELECT waarde FROM app_vlaggen WHERE naam='kantoor_telefoon'")||{}).waarde||''}));
  app.post('/api/bericht-kantoor',(req,res)=>{
    const tekst=String(req.body?.tekst||'').trim().slice(0,500);
    if(!tekst)return res.status(400).json({error:'Schrijf eerst een korte tekst'});
    const id=melding(req,{voor_rol:'kantoor',van_naam:req.persoon.naam,tekst});
    logAct('melding','bericht',`Bericht van ${req.persoon.naam} aan kantoor: ${tekst}`,null,null);
    res.json({ok:true,id});
  });
  app.get('/zoeken',(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','zoeken.html')));
  app.get('/meldingen',(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','meldingen.html')));
};
