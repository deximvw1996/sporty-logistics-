// lib/auth.js — S3.2 LOGIN / SESSIES + auth-poort uit server.js geknipt (F1 deel 1). Gedrag ongewijzigd.
'use strict';
module.exports = function(ctx){
  const {app,db,get,all,run,ins,saveDb,backupDb,now,isoDate,_genToken,resolveItemTypeId,logAct,logWijziging,insMetLog,updateMetLog,delMetLog,_actieveLocatieConfig,_kvVerwacht,_kvKampmoment,_kvNaam,_bakItems,effectiefMateriaal,ensureGedeeldStock,DATA_DIR,DB_PATH,UPLOADS_DIR,BUNDELS_DIR,FRONTEND_PATH,ROOT_DIR,APP_PASSWORD,PORT,path,fs,express,crypto} = ctx;
  // ── S3.2: LOGIN / SESSIES ──
  // Veiligheidsronde (DOORLICHTING-c #4): scrypt + salt per persoon. Opslagformaat 'scrypt$<salt hex>$<hash hex>'.
  // Oude opslag ('sha256$<hex>' na Migratie 56, of een kale 64-hex-hash) blijft inloggen en wordt
  // bij een geslaagde login omgezet (zie /api/login).
  const SCRYPT_OPTS={N:16384,r:8,p:1};
  function hashPin(pin){
    const salt=crypto.randomBytes(16).toString('hex');
    const hash=crypto.scryptSync(String(pin),salt,32,SCRYPT_OPTS).toString('hex');
    return `scrypt$${salt}$${hash}`;
  }
  function _sha256Pin(pin){ return crypto.createHash('sha256').update(String(pin)).digest('hex'); }
  function _veiligGelijk(a,b){ const ba=Buffer.from(String(a)), bb=Buffer.from(String(b)); return ba.length===bb.length && crypto.timingSafeEqual(ba,bb); }
  // Geeft {ok, legacy}: legacy=true betekent "klopt, maar nog in het oude formaat → herhashen".
  function verifieerPin(opgeslagen,pin){
    if(!opgeslagen) return {ok:false,legacy:false};
    if(opgeslagen.startsWith('scrypt$')){
      const [,salt,hash]=opgeslagen.split('$');
      if(!salt||!hash) return {ok:false,legacy:false};
      const kand=crypto.scryptSync(String(pin),salt,32,SCRYPT_OPTS).toString('hex');
      return {ok:_veiligGelijk(kand,hash),legacy:false};
    }
    const oud=opgeslagen.startsWith('sha256$')?opgeslagen.slice(7):opgeslagen;
    return {ok:_veiligGelijk(_sha256Pin(pin),oud.toLowerCase()),legacy:true};
  }
  // Veiligheidsronde (DOORLICHTING-c #4a): max 5 mislukte pogingen per persoon per 5 minuten → 429.
  // In-memory volstaat (één proces); herstart = teller leeg.
  const LOGIN_MAX_POGINGEN=5, LOGIN_VENSTER_MS=5*60*1000;
  const _loginPogingen=new Map(); // persoon_id (string) -> [tijdstippen van mislukte pogingen]
  function _loginGeblokkeerd(sleutel){
    const nu=Date.now();
    const lijst=(_loginPogingen.get(sleutel)||[]).filter(t=>nu-t<LOGIN_VENSTER_MS);
    _loginPogingen.set(sleutel,lijst);
    if(lijst.length<LOGIN_MAX_POGINGEN) return 0;
    return Math.max(1,Math.ceil((lijst[0]+LOGIN_VENSTER_MS-nu)/1000)); // wachttijd in seconden
  }
  function _loginMislukt(sleutel){ const l=_loginPogingen.get(sleutel)||[]; l.push(Date.now()); _loginPogingen.set(sleutel,l); }
  function genSessieToken(){ return crypto.randomBytes(24).toString('hex'); }
  const _sessieCache = new Map(); // token -> {token,persoon_id,naam,rol}  (snelheid; bron van waarheid is de sessies-tabel)
  // BH1: laatst_actief bij login en bij elke API-oproep met sessie, hoogstens 1× per 5 minuten per persoon.
  const _laatstGeschreven=new Map();
  const _isoNu=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;};
  function _zetLaatstActief(pid,altijd){
    const nu=Date.now();
    if(!altijd&&nu-(_laatstGeschreven.get(pid)||0)<5*60*1000)return;
    _laatstGeschreven.set(pid,nu);
    try{ run('UPDATE personeel SET laatst_actief=? WHERE id=?',[_isoNu(),pid]); }catch(e){}
  }
  // BH1: bij deactiveren of rolwissel moeten open sessies meteen vervallen (ook in de cache).
  function vergeetSessiesVan(pid){
    for(const [tok,s] of _sessieCache) if(String(s.persoon_id)===String(pid)) _sessieCache.delete(tok);
    run('DELETE FROM sessies WHERE persoon_id=?',[pid]);
  }
  function checkSessie(token){
    if(!token) return null;
    if(_sessieCache.has(token)) return _sessieCache.get(token);
    const s = get('SELECT s.token,s.persoon_id,p.naam,p.rol FROM sessies s JOIN personeel p ON p.id=s.persoon_id WHERE s.token=?',[token]);
    if(s) _sessieCache.set(token,s);
    return s||null;
  }

  // PUBLIEK (geen sessietoken vereist): login zelf, login-status/setup-vangnet, de personeelslijst
  // om het loginscherm te vullen, en /rit/:token + /kv/:token (die staan sowieso niet onder
  // /api/*, dus zijn vanzelf publiek). Hun onderliggende schrijf-/data-calls ONDER /api/ staan
  // wél achter deze poort en krijgen daarom een expliciete prefix-uitzondering hieronder — de
  // routes zelf doen daarna hun EIGEN validatie op het token (rit_token resp. kv_token), dus
  // "publiek bereikbaar" betekent hier niet "toegang tot alles", enkel "geen sessietoken nodig".
  const PUBLIEKE_API_PADEN = new Set(['/api/login','/api/login-status','/api/setup-eerste-pincode','/api/personeel-lijst-login','/api/eerste-pincode']);
  const PUBLIEKE_API_PREFIXEN = ['/api/rit-token/','/api/kv/'];

  app.post('/api/login',(req,res)=>{
    const {persoon_id,pincode}=req.body;
    if(!persoon_id||!pincode) return res.status(400).json({error:'persoon_id en pincode zijn vereist'});
    const sleutel=String(persoon_id);
    const wacht=_loginGeblokkeerd(sleutel);
    if(wacht){ res.set('Retry-After',String(wacht)); return res.status(429).json({error:`Te veel mislukte pogingen — probeer over ${wacht} seconden opnieuw`,wacht_seconden:wacht}); }
    const p=get('SELECT * FROM personeel WHERE id=?',[persoon_id]);
    if(!p||!p.pincode){ _loginMislukt(sleutel); return res.status(401).json({error:'Ongeldige login'}); }
    if(p.actief===0) return res.status(403).json({error:'Dit account is gedeactiveerd — vraag kantoor om het weer te activeren'}); // BH1
    const check=verifieerPin(p.pincode,pincode);
    if(!check.ok){ _loginMislukt(sleutel); return res.status(401).json({error:'Ongeldige pincode'}); }
    _loginPogingen.delete(sleutel);
    // Oud SHA-256-formaat → nu (pincode is bekend én klopt) omzetten naar scrypt. Geen dataverlies:
    // alleen bij een geslaagde controle, en de nieuwe hash wordt meteen gebruikt.
    if(check.legacy){ db.run('UPDATE personeel SET pincode=? WHERE id=?',[hashPin(pincode),p.id]); }
    const token=genSessieToken();
    ins('INSERT INTO sessies (token,persoon_id,created_at) VALUES (?,?,?)',[token,p.id,now()]);
    const sessie={token,persoon_id:p.id,naam:p.naam,rol:p.rol};
    _sessieCache.set(token,sessie);
    _zetLaatstActief(p.id,true); // BH1
    res.json({token,id:p.id,naam:p.naam,rol:p.rol});
  });
  app.get('/api/login-status',(req,res)=>{
    const n=get("SELECT COUNT(*) as n FROM personeel WHERE pincode IS NOT NULL AND pincode<>''").n;
    res.json({setup_nodig: n===0});
  });
  app.post('/api/setup-eerste-pincode',(req,res)=>{
    const n=get("SELECT COUNT(*) as n FROM personeel WHERE pincode IS NOT NULL AND pincode<>''").n;
    if(n>0) return res.status(400).json({error:'Setup is al voltooid — log in via het gewone loginscherm.'});
    const {persoon_id,pincode,naam}=req.body;
    if(!pincode||String(pincode).length<4) return res.status(400).json({error:'Een pincode van minstens 4 tekens is vereist'});
    // Bootstrap-gat gedicht (reviewfix): op een lege personeelstabel kan je anders nooit
    // binnenraken (personeel aanmaken vereist een token, een token vereist een persoon).
    // Is personeel leeg, dan mag de setup zelf de eerste kantoor-persoon aanmaken via `naam`.
    let p = persoon_id ? get('SELECT * FROM personeel WHERE id=?',[persoon_id]) : null;
    if(!p){
      const totaal=get('SELECT COUNT(*) as n FROM personeel').n;
      if(totaal===0 && naam && naam.trim()){
        const nieuwId=ins('INSERT INTO personeel (naam,rol) VALUES (?,?)',[naam.trim(),'kantoor']);
        p=get('SELECT * FROM personeel WHERE id=?',[nieuwId]);
      }
    }
    if(!p) return res.status(404).json({error:'Persoon niet gevonden (of geef bij een lege personeelslijst een naam op)'});
    run('UPDATE personeel SET rol=?, pincode=? WHERE id=?',['kantoor',hashPin(pincode),p.id]);
    res.json({ok:true,persoon_id:p.id});
  });
  app.get('/api/personeel-lijst-login',(req,res)=>{
    // Veiligheidsronde (DOORLICHTING-c #4c): KV werkt via de kv-link en hoort niet in het loginscherm.
    // BH1: coördinatoren en monitoren loggen ook in (mobiele app); inactieve personen niet.
    res.json(all("SELECT id,naam,rol,CASE WHEN pincode IS NULL OR pincode='' THEN 0 ELSE 1 END AS heeft_pincode FROM personeel WHERE rol IN ('kantoor','chauffeur','coordinator','monitor') AND COALESCE(actief,1)=1 ORDER BY rol,naam"));
  });
  // BH1: eerste pincode kiezen voor één persoon — alleen als kantoor die persoon uitnodigde (of de pincode resette),
  // de persoon actief is en nog geen pincode heeft. Zelfde regels als de bestaande setup (min. 4 tekens, scrypt).
  app.post('/api/eerste-pincode',(req,res)=>{
    const {persoon_id,pincode}=req.body||{};
    if(!pincode||String(pincode).length<4) return res.status(400).json({error:'Een pincode van minstens 4 tekens is vereist'});
    const p=persoon_id?get('SELECT * FROM personeel WHERE id=?',[persoon_id]):null;
    if(!p) return res.status(404).json({error:'Persoon niet gevonden'});
    if(p.pincode) return res.status(409).json({error:'Je hebt al een pincode — log gewoon in of vraag kantoor om een reset'});
    if(p.actief===0) return res.status(403).json({error:'Dit account is gedeactiveerd'});
    if(!p.uitnodiging_op) return res.status(403).json({error:'Kantoor moet je eerst uitnodigen om een pincode te kiezen'});
    run('UPDATE personeel SET pincode=?,pincode_gewijzigd_op=? WHERE id=?',[hashPin(pincode),_isoNu(),p.id]);
    logAct('personeel','pincode gekozen',`${p.naam} koos een eerste pincode`,null,null);
    res.json({ok:true,persoon_id:p.id});
  });

  // Auth-poort voor alle overige /api/*-routes. Zonder geldig token → 401. De bestaande
  // APP_PASSWORD-basic-auth (bovenaan dit bestand) blijft daarbuiten als buitenmuur staan.
  app.use((req,res,next)=>{
    if(!req.path.startsWith('/api/')) return next();
    if(PUBLIEKE_API_PADEN.has(req.path)) return next();
    if(PUBLIEKE_API_PREFIXEN.some(p=>req.path.startsWith(p))) return next();
    const token = req.headers['x-auth-token'] || (req.headers['authorization']||'').replace(/^Bearer\s+/i,'');
    const sessie = checkSessie(token);
    if(!sessie) return res.status(401).json({error:'Niet ingelogd'});
    req.persoon = sessie;
    _zetLaatstActief(sessie.persoon_id,false); // BH1
    // Veiligheidsronde (DOORLICHTING-c #2): rol kv heeft niets te zoeken op de admin-API — KV werkt via
    // de kv-link (/api/kv/:token/*, hierboven al publiek). Enkel wie-ben-ik en logout blijven open.
    if(sessie.rol==='kv' && req.path!=='/api/wie-ben-ik' && req.path!=='/api/logout')
      return res.status(403).json({error:'Geen toegang: deze actie is niet beschikbaar voor de rol kv'});
    next();
  });
  // Rolcontrole (DOORLICHTING-c #2): vereisRol('kantoor') op beheerroutes. Rollen: kantoor = alles;
  // chauffeur = lezen + eigen ritten (geen beheer); kv = niets op de admin-API (zie poort hierboven).
  function vereisRol(...rollen){
    return (req,res,next)=>{
      if(req.persoon && rollen.includes(req.persoon.rol)) return next();
      return res.status(403).json({error:`Geen toegang: hiervoor is de rol ${rollen.join(' of ')} vereist`});
    };
  }
  const alleenKantoor=vereisRol('kantoor');

  app.get('/api/wie-ben-ik',(req,res)=>{
    res.json({id:req.persoon.persoon_id,naam:req.persoon.naam,rol:req.persoon.rol});
  });
  app.post('/api/personeel/:id/pincode',(req,res)=>{
    const {pincode}=req.body;
    if(!pincode||String(pincode).length<4) return res.status(400).json({error:'Pincode van minstens 4 tekens vereist'});
    // Alleen je eigen pincode, of rol kantoor (DOORLICHTING-c #2).
    if(String(req.persoon.persoon_id)!==String(req.params.id) && req.persoon.rol!=='kantoor')
      return res.status(403).json({error:'Geen toegang: je kan alleen je eigen pincode wijzigen'});
    const p=get('SELECT * FROM personeel WHERE id=?',[req.params.id]);
    if(!p) return res.status(404).json({error:'Persoon niet gevonden'});
    run('UPDATE personeel SET pincode=?,pincode_gewijzigd_op=? WHERE id=?',[hashPin(pincode),_isoNu(),p.id]); // BH1: datum erbij
    res.json({ok:true});
  });
  app.post('/api/logout',(req,res)=>{
    const token = req.headers['x-auth-token'] || (req.headers['authorization']||'').replace(/^Bearer\s+/i,'');
    if(token){ run('DELETE FROM sessies WHERE token=?',[token]); _sessieCache.delete(token); }
    res.json({ok:true});
  });

  return { vereisRol, alleenKantoor, hashPin, checkSessie, vergeetSessiesVan };
};
