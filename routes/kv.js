// routes/kv.js — uit server.js geknipt (F1 deel 1). Gedrag ongewijzigd.
// Kopjes: KV-scherm API (/api/kv/:token/*), S3.5 KV-SCHERM pagina (/kv/:token)
'use strict';
module.exports = function(ctx){
  const {app,db,get,all,run,ins,saveDb,backupDb,now,isoDate,_genToken,resolveItemTypeId,logAct,logWijziging,insMetLog,updateMetLog,delMetLog,vereisRol,alleenKantoor,hashPin,checkSessie,_actieveLocatieConfig,_kvVerwacht,_kvKampmoment,_kvNaam,_bakItems,effectiefMateriaal,ensureGedeeldStock,DATA_DIR,DB_PATH,UPLOADS_DIR,BUNDELS_DIR,FRONTEND_PATH,ROOT_DIR,APP_PASSWORD,PORT,path,fs,express,crypto} = ctx;

  app.get('/api/kv/:token/data',(req,res)=>{
    const km=_kvKampmoment(req.params.token);
    if(!km)return res.status(403).json({error:'Ongeldige of verlopen link'});
    const loc=get('SELECT * FROM locaties WHERE id=?',[km.locatie_id]);
    const {bakken,attributen}=_kvVerwacht(km);
    // V2b: sessies horen bij DIT kampmoment (niet meer locatie+week: dat ving de zomer-sessie van dezelfde week mee).
    const sessies=all("SELECT * FROM nakijk_sessies WHERE kampmoment_id=? AND kv_status IN ('bezig','ingediend')",[km.id]);
    const regelsAll=all('SELECT * FROM nakijk_regels');
    const bakkenOut=bakken.map(b=>{
      const items=_bakItems(b);
      const sessie=sessies.find(s=>s.bak_type===b.soort&&(b.soort==='thema'?s.thema_bak_id===b.id:s.vaste_bak_id===b.id));
      const regels=sessie?regelsAll.filter(r=>r.sessie_id===sessie.id):[];
      return {
        id:b.id, soort:b.soort, code:b.code, naam:b.naam,
        ingediend:sessie?sessie.kv_status==='ingediend':false,
        items:items.map(it=>{
          const r=regels.find(r=>r.item_id===it.id);
          return {id:it.id, naam:it.naam, gewenst:it.qty, aangetroffen:(r&&r.aangetroffen!=null)?r.aangetroffen:null};
        })
      };
    });
    const attrSessies=sessies.filter(s=>s.bak_type==='attribuut');
    const attributenOut=attributen.map(a=>{
      const s=attrSessies.find(s=>s.attribuut_id===a.id);
      return {id:a.id, code:a.code, naam:a.naam, status:s?(s.notities||null):null};
    });
    const aanvragen=all("SELECT * FROM aanvragen WHERE kampmoment_id=? AND soort='materiaal' ORDER BY id DESC",[km.id]);
    // S4.8: KV-boodschappenlijst — "KV: "-regels van de gekoppelde thema's (verse waren die
    // de kampverantwoordelijke zelf koopt, interim opgeslagen in thema_materiaal met prefix).
    const ktsKm=all('SELECT thema_id FROM kampmoment_themas WHERE kampmoment_id=?',[km.id]);
    const themaIdsKm=[...new Set(ktsKm.map(k=>k.thema_id))];
    let boodschappen=[];
    if(themaIdsKm.length){
      const ph=themaIdsKm.map(()=>'?').join(',');
      boodschappen=all(`SELECT id,name,qty FROM thema_materiaal WHERE thema_id IN (${ph}) AND name LIKE 'KV:%'`,themaIdsKm)
        .map(r=>({id:r.id,naam:r.name.replace(/^KV:\s*/,''),qty:r.qty}));
    }
    res.json({
      kampNaam:(loc?loc.name:'?')+' — week '+km.week,
      kvNaam:_kvNaam(km),
      bakken:bakkenOut, attributen:attributenOut, aanvragen, boodschappen
    });
  });

  app.post('/api/kv/:token/bakken/:bakId/tellen',(req,res)=>{
    const km=_kvKampmoment(req.params.token);
    if(!km)return res.status(403).json({error:'Ongeldige of verlopen link'});
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
      return !itemIdOk||!aangetroffenOk;
    });
    if(ongeldig)return res.status(400).json({error:'Elke regel heeft een geldig item_id en aangetroffen (≥0) nodig'});
    const kvNaam=_kvNaam(km);
    const veldNaam=bak.soort==='thema'?'thema_bak_id':'vaste_bak_id';
    let sessie=get(`SELECT * FROM nakijk_sessies WHERE bak_type=? AND ${veldNaam}=? AND kampmoment_id=? AND kv_status IN ('bezig','ingediend')`,
      [bak.soort,bak.id,km.id]);
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
      const bestaand=get('SELECT * FROM nakijk_regels WHERE sessie_id=? AND item_id=?',[sessieId,item.id]);
      if(bestaand) run('UPDATE nakijk_regels SET aangetroffen=?,ontbreekt=?,verwacht=? WHERE id=?',[aangetroffen,ontbreekt,item.qty,bestaand.id]);
      else ins('INSERT INTO nakijk_regels (sessie_id,item_naam,item_id,verwacht,aangetroffen,ontbreekt) VALUES (?,?,?,?,?,?)',[sessieId,item.naam,item.id,item.qty,aangetroffen,ontbreekt]);
    });
    res.json({ok:true});
  });

  app.post('/api/kv/:token/attributen/:attrId/status',(req,res)=>{
    const km=_kvKampmoment(req.params.token);
    if(!km)return res.status(403).json({error:'Ongeldige of verlopen link'});
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
    const km=_kvKampmoment(req.params.token);
    if(!km)return res.status(403).json({error:'Ongeldige of verlopen link'});
    const kvNaam=_kvNaam(km);
    run("UPDATE nakijk_sessies SET kv_status='ingediend',kv_wie=?,kv_tijdstip=? WHERE kampmoment_id=? AND kv_status='bezig'",
      [kvNaam,now(),km.id]);
    res.json({ok:true});
  });

  app.post('/api/kv/:token/aanvraag',(req,res)=>{
    const km=_kvKampmoment(req.params.token);
    if(!km)return res.status(403).json({error:'Ongeldige of verlopen link'});
    const tekst=(req.body?.tekst||'').trim();
    if(!tekst)return res.status(400).json({error:'Tekst is verplicht'});
    const id=insMetLog(req,'INSERT INTO aanvragen (kampmoment_id,persoon_id,soort,tekst,status,created_at) VALUES (?,?,?,?,?,?)',
      [km.id,km.kv_persoon_id||null,'materiaal',tekst,'nieuw',now()],'kv-link');
    res.json(get('SELECT * FROM aanvragen WHERE id=?',[id]));
  });

  app.post('/api/kv/:token/kapot',(req,res)=>{
    const km=_kvKampmoment(req.params.token);
    if(!km)return res.status(403).json({error:'Ongeldige of verlopen link'});
    const tekst=(req.body?.tekst||'').trim();
    if(!tekst)return res.status(400).json({error:'Omschrijving is verplicht'});
    let f={pad:'',url:''};
    if(req.body?.foto_data){try{f=require('../lib/fotos')(ctx.UPLOADS_DIR).verwerkWaarde(req.body.foto_data,'','aanvraag');}catch(e){return res.status(e.status||500).json({error:e.status?e.message:'Foto opslaan mislukt'});}}
    const id=insMetLog(req,'INSERT INTO aanvragen (kampmoment_id,persoon_id,soort,tekst,foto_data,foto_path,status,created_at) VALUES (?,?,?,?,?,?,?,?)',
      [km.id,km.kv_persoon_id||null,'kapot',tekst,f.url,f.pad,'nieuw',now()],'kv-link');
    res.json(get('SELECT * FROM aanvragen WHERE id=?',[id]));
  });

  // ── S3.5: KV-SCHERM ── (bindende UI-spec: design-mockups/kv-scherm/KV-scherm.dc.html)
  // Zelfstandige mobiel-eerste pagina, geen deel van de admin-SPA — zelfde patroon als
  // /rit/:token. Alle data komt via /api/kv/:token/* (publiek, gevalideerd op kv_token).
  app.get('/kv/:token',(req,res)=>{
    const km=_kvKampmoment(req.params.token);
    if(!km)return res.status(404).send('<h2 style="font-family:system-ui;padding:2rem">Link niet gevonden of verlopen.</h2>');
    res.send(`<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>KV-scherm</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#f5f5f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a18;-webkit-font-smoothing:antialiased;padding-bottom:4px}
input,textarea,button{font-family:inherit}
input::placeholder,textarea::placeholder{color:#9a9a95}
.code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;font-weight:600;background:#f5f5f3;border:.5px solid rgba(0,0,0,.2);border-radius:5px;padding:3px 7px;flex-shrink:0}
.card{background:#fff;border:.5px solid rgba(0,0,0,.11);border-radius:12px}
.pill{font-size:11px;font-weight:600;padding:4px 9px;border-radius:999px;flex-shrink:0}
.tabpill{flex-shrink:0;font-size:12px;font-weight:500;padding:7px 12px;border-radius:999px;background:#f5f5f3;color:#6b6b67;text-decoration:none;border:none;cursor:pointer}
.tabpill.actief{background:#E1F5EE;color:#085041;font-weight:600}
.bloktitel{font-size:20px;font-weight:600;letter-spacing:-.01em}
.blokintro{font-size:13px;color:#6b6b67;margin-top:4px;line-height:1.45}
.seclabel{font-size:11px;font-weight:700;color:#6b6b67;text-transform:uppercase;letter-spacing:.06em}
.rowbtn{display:flex;align-items:center;flex-shrink:0;border:1.5px solid rgba(0,0,0,.2);border-radius:10px;background:#fff;overflow:hidden}
.rowbtn button{width:44px;height:46px;border:none;background:transparent;font-size:22px;line-height:1;color:#1a1a18;cursor:pointer}
.rowbtn input{width:46px;height:46px;border:none;background:transparent;text-align:center;font-size:17px;font-weight:600;color:#1a1a18;outline:none;padding:0}
.bigbtn{width:100%;height:50px;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer}
.textarea{width:100%;border:.5px solid rgba(0,0,0,.2);border-radius:10px;padding:12px;font-size:15px;line-height:1.45;color:#1a1a18;background:#fff;resize:none;outline:none}
</style></head><body>

<div style="position:sticky;top:0;z-index:20;background:#fff;border-bottom:.5px solid rgba(0,0,0,.11)">
  <div style="display:flex;align-items:center;gap:10px;padding:12px 16px">
    <div style="width:30px;height:30px;background:#1D9E75;border-radius:8px;flex-shrink:0"></div>
    <div style="flex:1;min-width:0">
      <div id="kv-kampnaam" style="font-size:15px;font-weight:600;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Laden…</div>
      <div id="kv-kvregel" style="font-size:12px;color:#6b6b67;margin-top:1px"></div>
    </div>
  </div>
  <div id="kv-tabs" style="display:flex;gap:6px;padding:0 16px 10px;overflow-x:auto"></div>
</div>

<div id="kv-blok1" style="padding:20px 16px 0"></div>
<div id="kv-blok2" style="padding:28px 16px 0;display:none"></div>
<div id="kv-blok3" style="padding:28px 16px 0;display:none"></div>
<div id="kv-blok4" style="padding:28px 16px 0;display:none"></div>
<div id="kv-blok5" style="padding:28px 16px 0;display:none"></div>
<div style="height:24px"></div>

<div id="kv-footer" style="display:none;position:sticky;bottom:0;z-index:20;background:#fff;border-top:.5px solid rgba(0,0,0,.11);padding:12px 16px calc(12px + env(safe-area-inset-bottom))">
  <div style="display:flex;align-items:center;gap:10px">
    <div style="flex:1;min-width:0">
      <div id="kv-voortgang-tekst" style="font-size:14px;font-weight:600;line-height:1.2"></div>
      <div id="kv-balk-subtekst" style="font-size:12px;color:#6b6b67;margin-top:2px"></div>
    </div>
    <button id="kv-versturen-btn" class="bigbtn" style="flex-shrink:0;width:auto;height:52px;padding:0 22px;color:#fff" onclick="verstuurControle()">Versturen</button>
  </div>
</div>

<script>
const TOKEN=${JSON.stringify(req.params.token)};
let DATA=null, ACTIEF='blok1', OPEN_BAK=null, LOCAL={}, ATTR_LOCAL={}, KAPOT_OPEN=false, KAPOT_FOTO=null, BOODSCHAP_VINK={};
let TABS=[['blok1','Wat moet er staan'],['blok2','Vrijdagcontrole'],['blok3','Iets nodig?'],['blok4','Iets kapot?']];

function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
async function kvApi(method,path,body){
  const r=await fetch('/api/kv/'+TOKEN+path,{method,headers:body!==undefined?{'Content-Type':'application/json'}:{},body:body!==undefined?JSON.stringify(body):undefined});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||'Er ging iets mis');
  return d;
}

async function init(){
  try{ DATA=await kvApi('GET','/data'); }
  catch(e){ document.body.innerHTML='<div style="padding:2rem;font-family:system-ui"><h2>Link niet gevonden of verlopen.</h2></div>'; return; }
  // S4.8: enkel een 5de tabblad "Boodschappen" tonen als dit kampmoment KV-boodschappen heeft.
  if((DATA.boodschappen||[]).length)TABS=[...TABS,['blok5','Boodschappen']];
  renderHeader();
  renderTabs();
  renderAll();
}
function renderHeader(){
  document.getElementById('kv-kampnaam').textContent=DATA.kampNaam;
  document.getElementById('kv-kvregel').textContent=(DATA.kvNaam||'—')+' · kampverantwoordelijke';
}
function renderTabs(){
  const el=document.getElementById('kv-tabs');
  el.innerHTML=TABS.map(([id,label])=>'<button class="tabpill'+(ACTIEF===id?' actief':'')+'" onclick="gaNaar(\\''+id+'\\')">'+label+'</button>').join('');
}
function gaNaar(blok){
  ACTIEF=blok;
  TABS.forEach(([id])=>{document.getElementById('kv-'+id).style.display=(id===blok)?'':'none';});
  document.getElementById('kv-footer').style.display=(blok==='blok2')?'flex':'none';
  renderTabs();
  window.scrollTo({top:0});
  renderAll();
}

// ── Voortgangsberekening (merged: lokale bewerking > laatst opgeslagen serverwaarde) ──
function waardeVan(bakId,itemId,serverVal){
  const lok=LOCAL[bakId];
  if(lok&&Object.prototype.hasOwnProperty.call(lok,itemId))return lok[itemId];
  return serverVal;
}
function attrStatusVan(attrId,serverStatus){
  return Object.prototype.hasOwnProperty.call(ATTR_LOCAL,attrId)?ATTR_LOCAL[attrId]:serverStatus;
}
function voortgang(){
  let geteld=0,tekortTotaal=0;
  (DATA.bakken||[]).forEach(b=>{
    const compleet=b.items.every(it=>typeof waardeVan(b.id,it.id,it.aangetroffen)==='number');
    if(compleet)geteld++;
    b.items.forEach(it=>{const v=waardeVan(b.id,it.id,it.aangetroffen);if(typeof v==='number'&&v<it.gewenst)tekortTotaal++;});
  });
  const attrGedaan=(DATA.attributen||[]).filter(a=>attrStatusVan(a.id,a.status)).length;
  const totBakken=(DATA.bakken||[]).length||1;
  return {geteld,tekortTotaal,attrGedaan,totAttr:(DATA.attributen||[]).length,totBakken,
    klaar:geteld===(DATA.bakken||[]).length&&attrGedaan===(DATA.attributen||[]).length};
}

function renderAll(){
  if(ACTIEF==='blok1')renderBlok1();
  if(ACTIEF==='blok2')renderBlok2();
  if(ACTIEF==='blok3')renderBlok3();
  if(ACTIEF==='blok4')renderBlok4();
  if(ACTIEF==='blok5')renderBlok5();
  if(ACTIEF==='blok2')renderFooter();
}

function renderBlok1(){
  const el=document.getElementById('kv-blok1');
  const bakRows=(DATA.bakken||[]).map(b=>'<div style="display:flex;align-items:center;gap:10px;padding:11px 14px;border-top:.5px solid rgba(0,0,0,.11)">'
    +'<span class="code">'+esc(b.code||'—')+'</span>'
    +'<div style="flex:1;min-width:0;font-size:14px">'+esc(b.naam)+'</div>'
    +'<div style="font-size:12px;color:#9a9a95;flex-shrink:0">'+b.items.length+' items</div></div>').join('');
  const attrRows=(DATA.attributen||[]).map(a=>'<div style="display:flex;align-items:center;gap:10px;padding:11px 14px;border-top:.5px solid rgba(0,0,0,.11)">'
    +'<span class="code">'+esc(a.code||'—')+'</span>'
    +'<div style="flex:1;min-width:0;font-size:14px">'+esc(a.naam)+'</div></div>').join('');
  el.innerHTML=
    '<div class="seclabel" style="margin-bottom:6px">Blok 1</div>'
    +'<div class="bloktitel">Wat moet er staan</div>'
    +'<div class="blokintro">Dit is wat de chauffeur lost op de locatie. Even nakijken of alles er staat — je hoeft hier niets in te vullen.</div>'
    +'<div class="card" style="margin-top:12px;overflow:hidden">'
    +'<div style="font-size:11px;font-weight:600;color:#6b6b67;text-transform:uppercase;letter-spacing:.05em;padding:12px 14px 8px">'+(DATA.bakken||[]).length+' bakken</div>'
    +(bakRows||'<div style="padding:11px 14px;color:#9a9a95;font-size:13px;border-top:.5px solid rgba(0,0,0,.11)">Nog geen bakken gekoppeld.</div>')
    +'</div>'
    +'<div class="card" style="margin-top:10px;overflow:hidden">'
    +'<div style="font-size:11px;font-weight:600;color:#6b6b67;text-transform:uppercase;letter-spacing:.05em;padding:12px 14px 8px">'+(DATA.attributen||[]).length+' attributen</div>'
    +(attrRows||'<div style="padding:11px 14px;color:#9a9a95;font-size:13px;border-top:.5px solid rgba(0,0,0,.11)">Geen attributen.</div>')
    +'</div>'
    +'<div style="font-size:12px;color:#6b6b67;margin-top:10px;line-height:1.5">Staat er iets niet? Meld het onderaan bij <strong style="font-weight:600;color:#1a1a18">Iets nodig?</strong></div>';
}

function renderBlok2(){
  const el=document.getElementById('kv-blok2');
  const v=voortgang();
  const bakHtml=(DATA.bakken||[]).map(b=>{
    const open=OPEN_BAK===b.id;
    const compleet=b.items.every(it=>typeof waardeVan(b.id,it.id,it.aangetroffen)==='number');
    const tekorten=b.items.filter(it=>{const val=waardeVan(b.id,it.id,it.aangetroffen);return typeof val==='number'&&val<it.gewenst;}).length;
    const geteldAantal=b.items.filter(it=>typeof waardeVan(b.id,it.id,it.aangetroffen)==='number').length;
    let pilTekst='Nog te tellen',pilBg='#f5f5f3',pilKleur='#6b6b67';
    if(compleet&&tekorten>0){pilTekst=tekorten+' te weinig';pilBg='#FAEEDA';pilKleur='#633806';}
    else if(compleet){pilTekst='Geteld';pilBg='#E1F5EE';pilKleur='#085041';}
    else if(geteldAantal>0){pilTekst=geteldAantal+'/'+b.items.length;pilBg='#E6F1FB';pilKleur='#0C447C';}
    const itemsHtml=open?b.items.map(it=>{
      const val=waardeVan(b.id,it.id,it.aangetroffen);
      const heeft=typeof val==='number';
      const tekort=heeft&&val<it.gewenst, teveel=heeft&&val>it.gewenst;
      let sub=it.gewenst+' gewenst',subKleur='#6b6b67';
      if(tekort){sub=(it.gewenst-val)+' te weinig · '+it.gewenst+' gewenst';subKleur='#633806';}
      else if(teveel){sub=(val-it.gewenst)+' te veel · '+it.gewenst+' gewenst';subKleur='#0C447C';}
      else if(heeft){sub='Klopt · '+it.gewenst+' gewenst';subKleur='#085041';}
      const rand=tekort?'#EF9F27':(heeft?'#5DCAA5':'rgba(0,0,0,.2)');
      const veldBg=tekort?'#FAEEDA':(heeft?'#E1F5EE':'#fff');
      return '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:.5px solid rgba(0,0,0,.08)">'
        +'<div style="flex:1;min-width:0"><div style="font-size:15px;line-height:1.3">'+esc(it.naam)+'</div>'
        +'<div style="font-size:12px;margin-top:3px;color:'+subKleur+'">'+esc(sub)+'</div></div>'
        +'<div class="rowbtn" style="border-color:'+rand+';background:'+veldBg+'">'
        +'<button onclick="stel('+b.id+','+it.id+',Math.max(0,('+(heeft?val:0)+')-1))">−</button>'
        +'<input value="'+(heeft?val:'')+'" inputmode="numeric" placeholder="—" onchange="stelUitInput('+b.id+','+it.id+',this.value)">'
        +'<button onclick="stel('+b.id+','+it.id+',('+(heeft?val:0)+')+1)">+</button></div></div>';
    }).join('')+'<button class="bigbtn" style="margin-top:12px;border:.5px solid rgba(0,0,0,.2);background:#fff;color:#1a1a18" onclick="bakAfsluiten('+b.id+')">Bak afsluiten</button>':'';
    return '<div class="card" style="margin-top:10px;overflow:hidden">'
      +'<button onclick="toggleBak('+b.id+')" style="display:flex;align-items:center;gap:10px;width:100%;padding:14px;background:#fff;border:none;cursor:pointer;text-align:left;min-height:60px">'
      +'<span class="code">'+esc(b.code||'—')+'</span>'
      +'<span style="flex:1;min-width:0"><span style="display:block;font-size:15px;font-weight:500;line-height:1.25">'+esc(b.naam)+'</span>'
      +'<span style="display:block;font-size:12px;color:#6b6b67;margin-top:2px">'+b.items.length+' items</span></span>'
      +'<span class="pill" style="background:'+pilBg+';color:'+pilKleur+'">'+pilTekst+'</span>'
      +'<span style="font-size:11px;color:#9a9a95;flex-shrink:0;width:12px;text-align:center">'+(open?'▲':'▼')+'</span></button>'
      +(open?'<div style="padding:0 14px 14px;border-top:.5px solid rgba(0,0,0,.11)">'+itemsHtml+'</div>':'')
      +'</div>';
  }).join('');
  const attrHtml=(DATA.attributen||[]).map(a=>{
    const st=attrStatusVan(a.id,a.status);
    const aRand=st==='aanwezig'?'#1D9E75':'rgba(0,0,0,.15)', aBg=st==='aanwezig'?'#E1F5EE':'#fff', aKleur=st==='aanwezig'?'#085041':'#6b6b67';
    const bRand=st==='beschadigd'?'#E24B4A':'rgba(0,0,0,.15)', bBg=st==='beschadigd'?'#FCEBEB':'#fff', bKleur=st==='beschadigd'?'#791F1F':'#6b6b67';
    return '<div style="padding:12px 14px;border-bottom:.5px solid rgba(0,0,0,.08)">'
      +'<div style="display:flex;align-items:center;gap:10px"><span class="code">'+esc(a.code||'—')+'</span>'
      +'<div style="flex:1;min-width:0;font-size:15px;line-height:1.3">'+esc(a.naam)+'</div></div>'
      +'<div style="display:flex;gap:8px;margin-top:10px">'
      +'<button onclick="zetAttr('+a.id+',\\'aanwezig\\')" style="flex:1;height:46px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;border:1.5px solid '+aRand+';background:'+aBg+';color:'+aKleur+'">Aanwezig</button>'
      +'<button onclick="zetAttr('+a.id+',\\'beschadigd\\')" style="flex:1;height:46px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;border:1.5px solid '+bRand+';background:'+bBg+';color:'+bKleur+'">Beschadigd</button></div></div>';
  }).join('');
  el.innerHTML=
    '<div class="seclabel" style="margin-bottom:6px">Blok 2</div>'
    +'<div class="bloktitel">Vrijdagcontrole</div>'
    +'<div class="blokintro">Tel op vrijdag alles na wat er staat. Eén bak per keer — je werk blijft bewaard, ook als je tussendoor stopt.</div>'
    +'<div class="card" style="padding:14px;margin-top:12px">'
    +'<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">'
    +'<div style="font-size:15px;font-weight:600">'+v.geteld+' van '+v.totBakken+' bakken geteld</div>'
    +'<div style="font-size:12px;color:#6b6b67">'+(v.tekortTotaal===0?'Geen tekorten':v.tekortTotaal+(v.tekortTotaal===1?' tekort':' tekorten'))+'</div></div>'
    +'<div style="height:8px;border-radius:999px;background:#eceae4;margin-top:10px;overflow:hidden">'
    +'<div style="height:8px;border-radius:999px;background:#1D9E75;width:'+Math.round(v.geteld/v.totBakken*100)+'%"></div></div></div>'
    +bakHtml
    +'<div class="seclabel" style="margin:22px 0 8px">Attributen</div>'
    +'<div class="card" style="overflow:hidden">'+(attrHtml||'<div style="padding:12px 14px;color:#9a9a95;font-size:13px">Geen attributen.</div>')+'</div>';
}
function toggleBak(id){ OPEN_BAK=(OPEN_BAK===id)?null:id; renderBlok2(); renderFooter(); }
function stel(bakId,itemId,val){
  if(!LOCAL[bakId])LOCAL[bakId]={};
  LOCAL[bakId][itemId]=Math.max(0,val);
  renderBlok2(); renderFooter();
}
function stelUitInput(bakId,itemId,raw){
  const digits=(raw||'').replace(/[^0-9]/g,'');
  if(!LOCAL[bakId])LOCAL[bakId]={};
  if(digits==='')delete LOCAL[bakId][itemId]; else LOCAL[bakId][itemId]=Math.min(999,parseInt(digits,10));
  renderBlok2(); renderFooter();
}
async function bakAfsluiten(bakId){
  const bak=(DATA.bakken||[]).find(b=>b.id===bakId); if(!bak)return;
  const regels=bak.items.filter(it=>typeof waardeVan(bakId,it.id,it.aangetroffen)==='number')
    .map(it=>({item_id:it.id,aangetroffen:waardeVan(bakId,it.id,it.aangetroffen)}));
  try{
    await kvApi('POST','/bakken/'+bakId+'/tellen',{regels});
    bak.items.forEach(it=>{const v=waardeVan(bakId,it.id,it.aangetroffen);if(typeof v==='number')it.aangetroffen=v;});
    delete LOCAL[bakId];
    OPEN_BAK=null;
    renderBlok2(); renderFooter();
  }catch(e){ alert(e.message); }
}
async function zetAttr(attrId,klik){
  const attr=(DATA.attributen||[]).find(a=>a.id===attrId); if(!attr)return;
  const huidig=attrStatusVan(attrId,attr.status);
  const nieuw=huidig===klik?null:klik;
  ATTR_LOCAL[attrId]=nieuw;
  renderBlok2(); renderFooter();
  try{ await kvApi('POST','/attributen/'+attrId+'/status',{status:nieuw}); attr.status=nieuw; delete ATTR_LOCAL[attrId]; }
  catch(e){ alert(e.message); delete ATTR_LOCAL[attrId]; renderBlok2(); renderFooter(); }
}
function renderFooter(){
  const v=voortgang();
  document.getElementById('kv-voortgang-tekst').textContent=v.geteld+' van '+v.totBakken+' bakken geteld';
  document.getElementById('kv-balk-subtekst').textContent=v.klaar?'Alles nagekeken — klaar om te versturen':(v.attrGedaan+' van '+v.totAttr+' attributen afgevinkt');
  document.getElementById('kv-versturen-btn').style.background=v.klaar?'#1D9E75':'#9a9a95';
}
async function verstuurControle(){
  try{ await kvApi('POST','/versturen',{}); alert('Controle verstuurd. Bedankt!'); }
  catch(e){ alert(e.message); }
}

function renderBlok3(){
  const el=document.getElementById('kv-blok3');
  const rows=(DATA.aanvragen||[]).map(a=>{
    const map={nieuw:['#E6F1FB','#0C447C','Nieuw'],goedgekeurd:['#E1F5EE','#085041','Goedgekeurd'],afgewezen:['#FCEBEB','#791F1F','Afgewezen'],afgehandeld:['#f5f5f3','#6b6b67','Afgehandeld']};
    const c=map[a.status]||map.nieuw;
    return '<div class="card" style="padding:13px 14px;margin-bottom:8px">'
      +'<div style="display:flex;align-items:flex-start;gap:10px">'
      +'<div style="flex:1;min-width:0;font-size:15px;line-height:1.35">'+esc(a.tekst)+'</div>'
      +'<span class="pill" style="background:'+c[0]+';color:'+c[1]+'">'+c[2]+'</span></div>'
      +'<div style="font-size:12px;color:#9a9a95;margin-top:5px">'+esc((a.created_at||'').split(',')[0]||a.created_at||'')+'</div>'
      +(a.reden?'<div style="font-size:13px;line-height:1.45;color:#791F1F;background:#FCEBEB;border-radius:8px;padding:9px 11px;margin-top:9px">'+esc(a.reden)+'</div>':'')
      +'</div>';
  }).join('');
  el.innerHTML=
    '<div class="seclabel" style="margin-bottom:6px">Blok 3</div>'
    +'<div class="bloktitel">Iets nodig?</div>'
    +'<div class="blokintro">Vraag materiaal aan tijdens de week. Het kantoor ziet je aanvraag meteen.</div>'
    +'<div class="card" style="padding:14px;margin-top:12px">'
    +'<textarea id="kv-aanvraag-tekst" class="textarea" rows="3" placeholder="Wat heb je nodig? Bv. 10 hesjes maat S — de onze zijn te groot voor de kleuters."></textarea>'
    +'<button class="bigbtn" style="margin-top:10px;background:#1D9E75;color:#fff" onclick="verstuurAanvraag()">Aanvraag versturen</button></div>'
    +'<div class="seclabel" style="margin:20px 0 8px">Eerdere aanvragen</div>'
    +(rows||'<div style="color:#9a9a95;font-size:13px">Nog geen aanvragen.</div>');
}
async function verstuurAanvraag(){
  const ta=document.getElementById('kv-aanvraag-tekst');
  const tekst=(ta.value||'').trim(); if(!tekst)return;
  try{
    const a=await kvApi('POST','/aanvraag',{tekst});
    DATA.aanvragen.unshift(a);
    renderBlok3();
  }catch(e){ alert(e.message); }
}

function renderBlok4(){
  const el=document.getElementById('kv-blok4');
  el.innerHTML=
    '<div class="seclabel" style="margin-bottom:6px">Blok 4</div>'
    +'<div class="bloktitel">Iets kapot?</div>'
    +'<div class="blokintro">Los van de vrijdagcontrole. Meld het meteen, dan kan het kantoor vervanging klaarzetten.</div>'
    +(!KAPOT_OPEN
      ? '<button class="bigbtn" style="margin-top:12px;border:1.5px solid #F09595;background:#fff;color:#791F1F" onclick="KAPOT_OPEN=true;renderBlok4()">Kapot materiaal melden</button>'
      : '<div class="card" style="border-left:3px solid #E24B4A;padding:14px;margin-top:12px">'
        +'<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px">'
        +'<div style="font-size:15px;font-weight:600">Kapotmelding</div>'
        +'<button onclick="KAPOT_OPEN=false;renderBlok4()" style="border:none;background:transparent;font-size:20px;line-height:1;color:#6b6b67;cursor:pointer;padding:6px 8px">×</button></div>'
        +'<label style="display:block;font-size:12px;font-weight:600;color:#6b6b67;margin-bottom:6px">Wat is er kapot?</label>'
        +'<textarea id="kv-kapot-tekst" class="textarea" rows="3" placeholder="Bv. Muziekbox A01 — luidspreker kraakt, doet het niet meer op batterij."></textarea>'
        +'<label style="display:block;font-size:12px;font-weight:600;color:#6b6b67;margin:14px 0 6px">Foto</label>'
        +'<input type="file" accept="image/*" capture="environment" id="kv-kapot-file" style="display:none" onchange="kvKapotFotoGekozen(this)">'
        +'<button type="button" style="width:100%;min-height:88px;border:1.5px dashed rgba(0,0,0,.2);border-radius:10px;background:#f5f5f3;color:#6b6b67;font-size:14px;font-weight:500;cursor:pointer;padding:14px" onclick="document.getElementById(\\'kv-kapot-file\\').click()">'
        +(KAPOT_FOTO?'Foto toegevoegd — tik om een andere te nemen':'Tik om een foto te nemen')+'</button>'
        +'<button class="bigbtn" style="margin-top:12px;background:#E24B4A;color:#fff" onclick="verstuurKapot()">Melding versturen</button></div>');
}
function kvKapotFotoGekozen(inp){
  const f=inp.files&&inp.files[0]; if(!f)return;
  const reader=new FileReader();
  reader.onload=e=>{ KAPOT_FOTO=e.target.result; renderBlok4(); };
  reader.readAsDataURL(f);
}
async function verstuurKapot(){
  const ta=document.getElementById('kv-kapot-tekst');
  const tekst=(ta.value||'').trim();
  if(!tekst){alert('Vul eerst in wat er kapot is.');return;}
  try{
    await kvApi('POST','/kapot',{tekst,foto_data:KAPOT_FOTO||''});
    KAPOT_OPEN=false; KAPOT_FOTO=null;
    renderBlok4();
    alert('Kapotmelding verstuurd.');
  }catch(e){ alert(e.message); }
}

// S4.8: KV-boodschappenlijst — enkel lokaal in de sessie afvinkbaar (geen persistentie nodig).
function renderBlok5(){
  const el=document.getElementById('kv-blok5');
  const lijst=DATA.boodschappen||[];
  const gevinkt=lijst.filter(b=>BOODSCHAP_VINK[b.id]).length;
  const rijen=lijst.map(b=>{
    const aan=!!BOODSCHAP_VINK[b.id];
    return '<label style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:.5px solid rgba(0,0,0,.08);cursor:pointer">'
      +'<input type="checkbox" '+(aan?'checked':'')+' onchange="toggleBoodschap('+b.id+')" style="width:22px;height:22px;flex-shrink:0">'
      +'<span style="flex:1;font-size:15px;line-height:1.35;'+(aan?'text-decoration:line-through;color:#9a9a95':'')+'">'+esc(b.naam)+(b.qty>1?' <span style="color:#6b6b67">×'+b.qty+'</span>':'')+'</span>'
      +'</label>';
  }).join('');
  el.innerHTML=
    '<div class="seclabel" style="margin-bottom:6px">Blok 5</div>'
    +'<div class="bloktitel">Boodschappen</div>'
    +'<div class="blokintro">Verse waren die je zelf koopt voor dit thema. Afvinken helpt tijdens het winkelen — dit wordt niet bewaard.</div>'
    +'<div class="card" style="padding:14px;margin-top:12px">'
    +'<div style="font-size:13px;font-weight:600;color:#6b6b67;margin-bottom:4px">'+gevinkt+' van '+lijst.length+' afgevinkt</div>'
    +'<div>'+(rijen||'<div style="color:#9a9a95;font-size:13px">Geen boodschappen.</div>')+'</div></div>'
    +'<div style="font-size:12px;color:#6b6b67;margin-top:16px;line-height:1.5;text-align:center">Vraag een factuur: Sporty Creactief, E. Solvaystraat 2, 3010 Kessel-Lo (geen BTW-nummer)</div>';
}
function toggleBoodschap(id){ BOODSCHAP_VINK[id]=!BOODSCHAP_VINK[id]; renderBlok5(); }

init();
</script>
</body></html>`);
  });

};
