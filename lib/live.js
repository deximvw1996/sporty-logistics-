// lib/live.js — RT1: het live-kanaal. Alleen kleine berichten: wat wijzigde, nooit data van een andere locatie.
'use strict';
const clients=new Set();
let resolve=()=>null; // vertaalt een schrijfpad naar {rit_id} of {km_id}; gezet door routes/live.js
const zetResolve=f=>{resolve=f;};
function stuur(c,msg){try{c.res.write('data: '+JSON.stringify(msg)+'\n\n');}catch(e){clients.delete(c);}}
function voeg(res,info){
  res.set({'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform',Connection:'keep-alive','X-Accel-Buffering':'no'});
  res.flushHeaders();res.write('retry: 3000\n\n');
  const c={res,...info};clients.add(c);stuur(c,{t:'hallo'});
  const hb=setInterval(()=>{try{res.write(': hart\n\n');}catch(e){}},25000); // proxy's (Railway) sluiten een stille verbinding
  res.on('close',()=>{clearInterval(hb);clients.delete(c);});
  return c;
}
const GEEN=/^\/api\/(login|logout|testklok|push|eerste-pincode|setup-eerste-pincode|live)|\/gelezen$/;
function seintje(pad){
  const b=resolve(pad)||{},isKv=pad.startsWith('/api/kv/'),isRit=pad.startsWith('/api/rit-token/');
  clients.forEach(c=>{
    if(c.soort==='sessie')return stuur(c,c.rol==='kantoor'?{t:'ververs',wat:pad.split('/').slice(2,3).join('')}:{t:'ververs'});
    // KV: een andere KV-link stuurt niets; kantoor stuurt een kaal sein zonder inhoud. Rit idem.
    if(c.soort==='kv'){if(isKv?b.km_id===c.km_id:!isRit)stuur(c,{t:'ververs'});return;}
    if(c.soort==='rit'){if(isRit?b.rit_id===c.rit_id:!isKv)stuur(c,{t:'ververs'});}
  });
}
const seintjes=(req,res,next)=>{
  if(req.method==='GET'||!req.path.startsWith('/api/')||GEEN.test(req.path))return next();
  res.on('finish',()=>{if(res.statusCode<400)try{seintje(req.path);}catch(e){console.error('Live-seintje:',e.message);}});
  next();
};
function melding(m,rolPersonen){ // m: {id,tekst,link,niveau,voor_persoon_id,voor_rol}
  const msg={t:'melding',id:m.id,tekst:m.tekst,link:m.link||'',niveau:m.niveau};
  clients.forEach(c=>{
    if(c.soort==='sessie'&&(m.voor_persoon_id?c.persoon_id===m.voor_persoon_id:c.rol===m.voor_rol&&c.persoon_id!==m.van_persoon_id))stuur(c,msg);
    else if(c.soort==='rit'&&m.voor_persoon_id&&c.personeel_id===m.voor_persoon_id)stuur(c,msg);
  });
}
function zetIn(h){
  const tag='<link rel="manifest" href="/manifest.json"><meta name="theme-color" content="#1e3a8a"><link rel="apple-touch-icon" href="/public/icon-192.png"><script src="/public/live.js" defer></script>';
  return /<\/head>/i.test(h)?h.replace(/<\/head>/i,tag+'</head>'):h;
}
const htmlMiddleware=fs=>(req,res,next)=>{
  if(req.path.startsWith('/api/')||req.path.startsWith('/uploads/')||/print|login/.test(req.path))return next();
  const send=res.send.bind(res),sendFile=res.sendFile.bind(res);
  res.sendFile=(p,...rest)=>{if(/\.html$/i.test(String(p))){try{res.type('html');return send(zetIn(fs.readFileSync(p,'utf8')));}catch(e){}}return sendFile(p,...rest);};
  next();
};
module.exports={voeg,seintjes,seintje,melding,zetResolve,htmlMiddleware,clients};
