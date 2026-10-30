// routes/locaties-overzicht.js — LO1: Locaties op het standaardpagina-patroon (design/PATROON-DEFINITIEF.html is het
// Locaties-voorbeeld). Lezen: GET /api/locaties-overzicht en GET /api/locaties/:id/detail. Verwijderen met controle
// (409 bij kampmomenten of taken) en daarna de bestaande DELETE-route. Contact mailen = mailto-lijst (niets verstuurd).
// Een KV hoort bij een kampmoment, niet bij een locatie: de kolom "Deze periode (week · KV)" toont per kampmoment.
'use strict';
module.exports = function(ctx){
  const {app,get,all,alleenKantoor,path,ROOT_DIR} = ctx;

  const DAG=['zo','ma','di','wo','do','vr','za'],MND=['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
  const d12=s=>new Date(s+'T12:00:00');
  function alsDatum(s){
    let m=/(\d{1,2})\/(\d{1,2})\/(\d{4})\D+(\d{1,2}):(\d{2})/.exec(s||'');
    if(m)return new Date(+m[3],+m[2]-1,+m[1],+m[4],+m[5]);
    if(/^\d{4}-\d{2}-\d{2}T/.test(s||''))return new Date(s);
    m=/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/.exec(s||'');
    return m?new Date(+m[1],+m[2]-1,+m[3],+(m[4]||0),+(m[5]||0)):null;
  }
  const dagTekst=s=>{const d=alsDatum(s);return d&&!isNaN(d)?`${DAG[d.getDay()]} ${d.getDate()} ${MND[d.getMonth()]}`:'';};
  const tijdTekst=s=>{const d=alsDatum(s);return d&&!isNaN(d)?`${dagTekst(s)} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`:(s||'');};
  // Loopt dit kampmoment nu? (vandaag binnen ma–zo van de kampweek)
  function looptNu(per,week){
    if(!per)return false;const s=d12(per.start_datum);s.setDate(s.getDate()+(week-1)*7);const e=new Date(s);e.setDate(e.getDate()+6);
    const v=new Date();v.setHours(12,0,0,0);return v>=s&&v<=e;
  }
  const periodeVan=id=>(id&&get('SELECT * FROM vakantieperiodes WHERE id=?',[id]))||get('SELECT * FROM vakantieperiodes WHERE actief=1');

  function aandacht(l,kms){
    const a=[];
    if(l.type==='kamp'){
      if(!(l.contact_naam||'').trim()&&!(l.contact_tel||'').trim())a.push('geen contact');
      else if(!(l.contact_tel||'').trim())a.push('geen telefoon');
      if(!(l.sleutel_info||'').trim())a.push('geen sleutel-info');
      if(!(l.addr||'').trim())a.push('geen adres');
      kms.forEach(k=>{if(!k.kv_naam)a.push(`wk ${k.week} zonder KV`);if(!k.thema)a.push(`wk ${k.week} zonder thema`);});
    }
    return a;
  }
  function kmsVan(locId,per){
    if(!per)return [];
    return all(`SELECT km.id,km.week,p.naam AS kv_naam,(SELECT GROUP_CONCAT(DISTINCT t.name) FROM kampmoment_themas kt JOIN themas t ON t.id=kt.thema_id WHERE kt.kampmoment_id=km.id) AS thema
      FROM kampmomenten km LEFT JOIN personeel p ON p.id=km.kv_persoon_id WHERE km.locatie_id=? AND km.periode_id=? ORDER BY km.week`,[locId,per.id])
      .map(k=>({week:k.week,kv_naam:k.kv_naam||'',kampmoment_id:k.id,thema:k.thema||'',loopt_nu:looptNu(per,k.week)}));
  }

  app.get('/api/locaties-overzicht',alleenKantoor,(req,res)=>{
    const per=periodeVan(req.query.periode_id);
    const locaties=all('SELECT * FROM locaties ORDER BY type,name').map(l=>{
      const p=kmsVan(l.id,per),a=aandacht(l,p);
      return {id:l.id,naam:l.name,type:l.type,gemeente:l.gemeente||'',adres:l.addr||'',lat:l.lat==null||l.lat===''?null:+l.lat,lng:l.lng==null||l.lng===''?null:+l.lng,contact_naam:l.contact_naam||'',telefoon:l.contact_tel||'',
        periode_tekst:p.length?p.map(k=>`wk ${k.week}${k.kv_naam?' '+k.kv_naam:''}`).join(' · '):'—',periode:p.map(({thema,...k})=>k),status:a.length?'let':'ok',aandacht:a,
        zoek:[l.name,l.gemeente,l.addr,...p.map(k=>k.kv_naam)].join(' ').toLowerCase()};
    });
    const n=f=>locaties.filter(f).length;
    res.json({periode:per?{id:per.id,naam:per.naam}:null,
      tellers:{alle:locaties.length,kamp:n(l=>l.type==='kamp'),stockage:n(l=>l.type==='stockage'),let_op:n(l=>l.status==='let'),deze_periode:n(l=>l.periode.length),zonder_kaart:n(l=>l.lat==null||l.lng==null||isNaN(l.lat)||isNaN(l.lng))},locaties});
  });

  app.get('/api/locaties/:id/detail',alleenKantoor,(req,res)=>{
    const l=get('SELECT * FROM locaties WHERE id=?',[req.params.id]);
    if(!l)return res.status(404).json({error:'Locatie niet gevonden'});
    const per=periodeVan(null);
    const kampmomenten=all(`SELECT km.*,v.naam AS periode,v.start_datum,v.actief AS periode_actief,p.naam AS kv_naam FROM kampmomenten km JOIN vakantieperiodes v ON v.id=km.periode_id
      LEFT JOIN personeel p ON p.id=km.kv_persoon_id WHERE km.locatie_id=? ORDER BY v.start_datum DESC,km.week DESC`,[l.id]).map(k=>{
      const th=all('SELECT DISTINCT t.name FROM kampmoment_themas kt JOIN themas t ON t.id=kt.thema_id WHERE kt.kampmoment_id=?',[k.id]).map(x=>x.name).join(', ');
      // Levering/ophaling-stand uit de transporttaken van dit kampmoment.
      const stand=type=>{const t=get(`SELECT * FROM transport_taken WHERE kampmoment_id=? AND type=? AND status<>'geannuleerd' ORDER BY datum,id`,[k.id,type]);
        return t?`${type} ${t.datum?dagTekst(t.datum):'zonder datum'}${t.status==='gedaan'?' ✓':t.rit_id?'':' (nog geen rit)'}`:'';};
      return {kampmoment_id:k.id,periode:k.periode,periode_actief:!!k.periode_actief,week:k.week,type:k.type||'kamp',thema:th,kv_naam:k.kv_naam||'',
        loopt_nu:k.periode_actief?looptNu(per,k.week):false,transport:[stand('levering'),stand('ophaling')].filter(Boolean).join(' · ')||'nog geen transport'};
    });
    const fotos=all('SELECT * FROM locatie_fotos WHERE locatie_id=? ORDER BY id DESC',[l.id]).map(f=>({id:f.id,url:f.foto_path?'/uploads/'+f.foto_path:null,beschrijving:f.beschrijving||'',t:tijdTekst(f.tijdstip),wie:f.wie||''}));
    // Historiek: wijzigingen op de locatie (veldnamen leesbaar) en haar foto's + activiteitenlog op deze locatie.
    const parse=s=>{try{return JSON.parse(s||'{}')||{};}catch(e){return {};}};
    const hist=[];
    const fotoIds=all('SELECT rij_id FROM wijzigingen WHERE tabel=? AND (nieuw LIKE ? OR oud LIKE ?)',['locatie_fotos',`%"locatie_id":${l.id},%`,`%"locatie_id":${l.id},%`]).map(r=>r.rij_id);
    all(`SELECT * FROM wijzigingen WHERE (tabel='locaties' AND rij_id=?)${fotoIds.length?` OR (tabel='locatie_fotos' AND rij_id IN (${fotoIds.map(()=>'?').join(',')}))`:''} ORDER BY id DESC LIMIT 100`,[l.id,...fotoIds]).forEach(w=>{
      if(w.tabel==='locatie_fotos'){const f=parse(w.actie==='delete'?w.oud:w.nieuw);hist.push({t:tijdTekst(w.tijdstip),wie:w.persoon_naam||'',wat:`foto ${w.actie==='delete'?'verwijderd':'toegevoegd'}${f.beschrijving?' ('+f.beschrijving+')':''}`,wijziging_id:w.id,terugdraaibaar:false});return;}
      const o=parse(w.oud),n=parse(w.nieuw);
      const k=Object.keys(n).filter(x=>String(o[x]??'')!==String(n[x]??''));
      if(w.actie==='update'&&!k.length)return;
      const v=x=>x===null||x===undefined||x===''?'—':x;
      hist.push({t:tijdTekst(w.tijdstip),wie:w.persoon_naam||'',wat:w.actie==='insert'?'aangemaakt':k.map(x=>`${x==='contact_tel'?'contact_telefoon':x==='addr'?'adres':x}: ${v(o[x])} → ${v(n[x])}`).join(', '),wijziging_id:w.id,terugdraaibaar:false});
    });
    all('SELECT * FROM activiteiten_log WHERE locatie_id=? ORDER BY id DESC LIMIT 50',[l.id]).forEach(a=>hist.push({t:tijdTekst(a.tijdstip),wie:'',wat:a.beschrijving,wijziging_id:null,terugdraaibaar:false}));
    const per2=periodeVan(null),p=kmsVan(l.id,per2),a=aandacht(l,p);
    res.json({locatie:{id:l.id,naam:l.name,type:l.type,adres:l.addr||'',gemeente:l.gemeente||'',notities:l.notities||'',lat:l.lat,lng:l.lng,status:a.length?'let':'ok',aandacht:a,
        periode_tekst:p.length?p.map(k=>`wk ${k.week}${k.kv_naam?' '+k.kv_naam:''}`).join(' · '):'—'},
      contact:{naam:l.contact_naam||'',telefoon:l.contact_tel||''},sleutel_info:l.sleutel_info||'',wifi:l.wifi||'',
      ter_plaatse:{eigen_oven:!!l.heeft_eigen_oven,eigen_sportmateriaal:!!l.heeft_eigen_sportmateriaal,zelf_kuisen:!!l.zelf_kuisen},
      fotos,kampmomenten,historiek:hist});
  });

  // Verwijderen met controle, daarna de bestaande DELETE-route (zelfde log).
  app.delete('/api/locaties-overzicht/:id',alleenKantoor,(req,res)=>{
    const l=get('SELECT * FROM locaties WHERE id=?',[req.params.id]);
    if(!l)return res.status(404).json({error:'Locatie niet gevonden'});
    const km=get('SELECT COUNT(*) AS n FROM kampmomenten WHERE locatie_id=?',[l.id]).n;
    const tk=get("SELECT COUNT(*) AS n FROM transport_taken WHERE (van_locatie_id=? OR naar_locatie_id=?) AND status<>'geannuleerd'",[l.id,l.id]).n;
    const bk=get('SELECT COUNT(*) AS n FROM bakken WHERE huidige_locatie_id=? OR thuislocatie_id=?',[l.id,l.id]).n;
    if(km||tk||bk)return res.status(409).json({error:`${l.name} heeft nog ${[km?km+' kampmoment'+(km===1?'':'en'):'',tk?tk+' transporttaak'+(tk===1?'':'en'):'',bk?bk+' bak'+(bk===1?'':'ken')+' (thuis of nu daar)':''].filter(Boolean).join(', ')} — verwijderen kan niet`});
    const laag=(app._router?.stack||[]).find(x=>x.route&&x.route.path==='/api/locaties/:id'&&x.route.methods.delete);
    if(!laag)return res.status(500).json({error:'Verwijderroute niet gevonden'});
    laag.route.stack[laag.route.stack.length-1].handle(req,res,()=>{});
  });

  // Contact mailen: geeft mailto-links terug (geen mail versturen). Zonder e-mailadres van het contact → in "zonder".
  app.post('/api/locaties/contact-mail',alleenKantoor,(req,res)=>{
    const ids=Array.isArray(req.body?.ids)?req.body.ids.map(Number).filter(Boolean):[];
    if(!ids.length)return res.status(400).json({error:'Kies eerst een of meer locaties'});
    const mails=[],zonder=[];
    ids.forEach(id=>{
      const l=get('SELECT * FROM locaties WHERE id=?',[id]);if(!l)return;
      // locaties hebben geen e-mailveld; een adres in contact_naam of notities ("naam <x@y>" of los) wordt gebruikt.
      const m=/[\w.+-]+@[\w-]+\.[\w.-]+/.exec(`${l.contact_naam||''} ${l.notities||''}`);
      const onderwerp=`Sporty — ${l.name}`;
      if(m)mails.push({id:l.id,naam:l.name,contact:l.contact_naam||'',email:m[0],mailto:`mailto:${m[0]}?subject=${encodeURIComponent(onderwerp)}`});
      else zonder.push({id:l.id,naam:l.name,contact:l.contact_naam||'',telefoon:l.contact_tel||'',reden:'geen e-mailadres bij het contact'});
    });
    const alle=mails.map(x=>x.email);
    res.json({mails,zonder,alles:alle.length?`mailto:?bcc=${alle.join(',')}&subject=${encodeURIComponent('Sporty')}`:null});
  });

  app.get('/locaties',(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','locaties.html')));
};
