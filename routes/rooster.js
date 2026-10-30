// routes/rooster.js — PL2 (chat C): Planning › Rooster (week + seizoen) en Planning › Gedeeld materiaal
// (design/mockup-planning-v3.html, design/mockup-gedeeld-materiaal.html).
// Werking (Maxim 30/10): elk thema bestaat één keer → zelfde thema, zelfde week, twee locaties = "dubbel" (⚠ rood);
// zelfde thema, zelfde locatie, twee opeenvolgende kampweken = "herhaald" (↻ oranje, op de tweede week);
// gedeeld materiaal: per week per stuk (vast_type of vaste bak uit thema_behoefte, bij meer dan één thema) nodig ↔ er zijn (Pool) →
// meer nodig = "gedeeld" (◐ paars) op alle betrokken thema's van die week. Meldingen zijn uitleg, nooit een verbod.
// "Zonder dit stuk aanvaarden" bewaart per periode/week/stuk/thema een rij in app_vlaggen (geen migratie; zie GEVONDEN in OVERLEG-c.md).
'use strict';
module.exports = function(ctx){
  const {app,get,all,run,updateMetLog,alleenKantoor,logAct,path,ROOT_DIR} = ctx;

  const pad=n=>String(n).padStart(2,'0');
  const d0=s=>new Date(s+'T12:00:00');
  const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const periodeVan=id=>(id&&get('SELECT * FROM vakantieperiodes WHERE id=?',[id]))||get('SELECT * FROM vakantieperiodes WHERE actief=1')||get('SELECT * FROM vakantieperiodes ORDER BY id DESC LIMIT 1');

  // Kampweek n van een periode: maandag = startdatum (naar maandag teruggezet) + 7·(n−1), vrijdag = +4.
  function weekInfo(per,nr){
    const s=d0(per.start_datum);s.setDate(s.getDate()-((s.getDay()+6)%7)+7*(nr-1));
    const e=new Date(s);e.setDate(e.getDate()+4);
    const van=iso(s),tot=iso(e);
    const kort=s.getMonth()===e.getMonth()?`${s.getDate()}–${e.getDate()}/${pad(e.getMonth()+1)}`:`${s.getDate()}/${pad(s.getMonth()+1)}–${e.getDate()}/${pad(e.getMonth()+1)}`;
    return {nr,van,tot,kort,label:`Week ${nr} · ${kort}`};
  }
  function aantalWeken(per){
    const m=(get('SELECT MAX(week) AS m FROM kampmomenten WHERE periode_id=?',[per.id])||{}).m||0;
    return Math.max(per.max_weken||0,m,1);
  }
  function huidigeWeek(per){
    const vandaag=iso(new Date()),n=aantalWeken(per);
    for(let w=1;w<=n;w++){const x=weekInfo(per,w);const zo=d0(x.van);zo.setDate(zo.getDate()+6);if(vandaag>=x.van&&vandaag<=iso(zo))return w;}
    return null;
  }
  const lgCode=s=>{const x=String(s||'').trim().toLowerCase();if(!x)return 'G';if(x==='kl'||x.startsWith('kleut'))return 'KL';if(x==='ls'||x.startsWith('lager'))return 'LS';return x.slice(0,2).toUpperCase();};
  const typeNaam=t=>String(t||'').replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());
  const dagTekst=d=>d==null||d===''?'ma–vr':(['ma','di','wo','do','vr'][+d]||`dag ${d}`); // kampmoment_themas.dag: 0 = maandag … 4 = vrijdag
  const aanvKey=(pid,w,key,tid)=>`pl2_gedeeld_aanvaard:${pid}:${w}:${key}:${tid}`;

  // ── gedeeld materiaal: welke stukken, hoeveel er zijn ──
  function stukkenDef(){
    const rijen=all('SELECT thema_id,vast_type,bak_id,aantal FROM thema_behoefte');
    const per={};
    rijen.forEach(r=>{
      const key=r.bak_id?'bak:'+r.bak_id:(r.vast_type?'vt:'+r.vast_type:null);if(!key)return;
      const s=per[key]=per[key]||{key,vast_type:r.vast_type||'',bak_id:r.bak_id||null,themas:{}};
      s.themas[r.thema_id]=(s.themas[r.thema_id]||0)+(r.aantal||1);
    });
    const uit={};
    Object.values(per).forEach(s=>{
      if(Object.keys(s.themas).length<2)return; // alleen wat bij meer dan één thema hoort is "gedeeld"
      let bakken;
      if(s.bak_id)bakken=all("SELECT * FROM bakken WHERE id=?",[s.bak_id]);
      else bakken=all("SELECT * FROM bakken WHERE soort='vast' AND vast_type=? ORDER BY id",[s.vast_type]);
      s.beschikbaar=bakken.reduce((n,b)=>n+(b.is_bulk?(b.aantal||0):1),0);
      s.naam=s.bak_id?(bakken[0]?bakken[0].naam:'bak #'+s.bak_id):(bakken.length===1?bakken[0].naam:typeNaam(s.vast_type));
      s.eenheid=bakken.some(b=>b.is_bulk)?'stuks':(s.beschikbaar===1?'bak':'bakken');
      uit[s.key]=s;
    });
    return uit;
  }

  // ── kernanalyse van een periode ──
  function analyse(per){
    const kms=all(`SELECT km.*,l.name AS loc,p.naam AS kv FROM kampmomenten km JOIN locaties l ON l.id=km.locatie_id LEFT JOIN personeel p ON p.id=km.kv_persoon_id
      WHERE km.periode_id=? ORDER BY km.week,l.name COLLATE NOCASE`,[per.id]);
    const kmById={};kms.forEach(k=>{kmById[k.id]=k;k.themas=[];});
    const kts=kms.length?all(`SELECT kt.id,kt.kampmoment_id,kt.thema_id,kt.dag,kt.leeftijdsgroep AS kt_lg,t.name,t.leeftijdsgroep AS t_lg FROM kampmoment_themas kt JOIN themas t ON t.id=kt.thema_id
      WHERE kt.kampmoment_id IN (${kms.map(()=>'?').join(',')}) ORDER BY kt.kampmoment_id,kt.id`,kms.map(k=>k.id)):[];
    // groepslabel: leeftijdsgroep + volgnummer binnen het kampmoment (KL1, KL2, LS1 …); KL vóór LS
    const volg={KL:0,LS:1};
    kts.forEach(t=>{t.lg=lgCode(t.kt_lg||t.t_lg);t.meldingen=[];kmById[t.kampmoment_id].themas.push(t);});
    kms.forEach(k=>{
      k.themas.sort((a,b)=>((volg[a.lg]??2)-(volg[b.lg]??2))||a.id-b.id);
      const n={};k.themas.forEach(t=>{n[t.lg]=(n[t.lg]||0)+1;t.groep=t.lg+n[t.lg];t.week=k.week;t.locatie=k.loc;t.locatie_id=k.locatie_id;t.kv=k.kv||'';});
    });
    // dubbel
    const perWeekThema={};
    kts.forEach(t=>{const k=t.week+':'+t.thema_id;(perWeekThema[k]=perWeekThema[k]||[]).push(t);});
    Object.values(perWeekThema).forEach(l=>{if(new Set(l.map(t=>t.kampmoment_id)).size>1)l.forEach(t=>{t.meldingen.push('dubbel');t.dubbel_met=l.filter(x=>x!==t).map(x=>x.locatie);});});
    // herhaald (de tweede van twee opeenvolgende weken)
    const opLoc={};kts.forEach(t=>{opLoc[t.locatie_id+':'+t.thema_id+':'+t.week]=t;});
    kts.forEach(t=>{const v=opLoc[t.locatie_id+':'+t.thema_id+':'+(t.week-1)];if(v){t.meldingen.push('herhaald');t.herhaald_van=v;}});
    // gedeeld materiaal
    const def=stukkenDef();
    const aanv=new Set(all("SELECT naam FROM app_vlaggen WHERE naam LIKE ?",[`pl2_gedeeld_aanvaard:${per.id}:%`]).map(r=>r.naam));
    const weken=[...new Set(kms.map(k=>k.week))];
    const gedeeld={}; // week → key → {nodig,waar[],aanvaard[]}
    weken.forEach(w=>{
      const g=gedeeld[w]={};
      kts.filter(t=>t.week===w).forEach(t=>{
        Object.values(def).forEach(s=>{
          const a=s.themas[t.thema_id];if(!a)return;
          const x=g[s.key]=g[s.key]||{nodig:0,waar:[],aanvaard:[]};
          if(aanv.has(aanvKey(per.id,w,s.key,t.thema_id))){x.aanvaard.push({t,aantal:a});return;}
          x.nodig+=a;x.waar.push({t,aantal:a});
        });
      });
      Object.entries(g).forEach(([key,x])=>{
        const s=def[key];x.stand=x.nodig===0?'niet_nodig':x.nodig>s.beschikbaar?'te_weinig':x.nodig===s.beschikbaar?'precies_op':'ok';
        if(x.stand==='te_weinig')x.waar.forEach(({t})=>{if(!t.meldingen.includes('gedeeld'))t.meldingen.push('gedeeld');(t.gedeeld=t.gedeeld||[]).push(key);});
      });
    });
    return {per,kms,kmById,kts,def,gedeeld,aantal:aantalWeken(per)};
  }

  const themaUit=t=>({kt_id:t.id,groep:t.groep,thema_id:t.thema_id,naam:t.name,dag:t.dag,meldingen:t.meldingen});
  function sportVan(per,locatie_id,week){
    try{return all(`SELECT DISTINCT si.name FROM sport_planning sp JOIN sport_sets ss ON ss.id=sp.set_id JOIN sport_items si ON si.id=ss.item_id
      WHERE sp.locatie_id=? AND sp.week=? AND (sp.periode_id=? OR sp.periode_id IS NULL) ORDER BY si.name`,[locatie_id,week,per.id]).map(r=>r.name);}catch(e){return [];}
  }
  function stukUit(A,w,key){
    const s=A.def[key],x=(A.gedeeld[w]||{})[key]||{nodig:0,waar:[],aanvaard:[],stand:'niet_nodig'};
    return {key,naam:s.naam,vast_type:s.vast_type,nodig:x.nodig,beschikbaar:s.beschikbaar,eenheid:s.eenheid,stand:x.stand,
      waar:x.waar.map(({t,aantal})=>({thema:t.name,thema_id:t.thema_id,kt_id:t.id,groep:t.groep,locatie:t.locatie,kampmoment_id:t.kampmoment_id,kv:t.kv,dag:dagTekst(t.dag),aantal})),
      aanvaard:x.aanvaard.map(({t})=>({thema:t.name,thema_id:t.thema_id,locatie:t.locatie,kampmoment_id:t.kampmoment_id}))};
  }
  const weekNr=(q,A)=>{const n=parseInt(q);if(n>=1)return n;return huidigeWeek(A.per)||(A.kms[0]?A.kms[0].week:1);};

  // ── punt 1: week ──
  app.get('/api/rooster/week',alleenKantoor,(req,res)=>{
    const per=periodeVan(parseInt(req.query.periode_id));if(!per)return res.status(404).json({error:'Er is nog geen vakantieperiode.'});
    const A=analyse(per),w=weekNr(req.query.week,A);
    const locaties=A.kms.filter(k=>k.week===w).map(k=>{
      const th=k.themas.map(themaUit);
      return {kampmoment_id:k.id,locatie_id:k.locatie_id,naam:k.loc,kv:k.kv||'',themas:th,sport:sportVan(per,k.locatie_id,w),
        meldingen_n:th.reduce((n,t)=>n+t.meldingen.length,0),zoek:[k.loc,k.kv,...th.map(t=>t.naam)].join(' ').toLowerCase()};
    });
    // tellers zoals de mockup: dubbel = thema's dubbel, herhaald = labels ↻, gedeeld = stukken te weinig (de chip filtert wel op locatie)
    const kw=A.kts.filter(t=>t.week===w);
    res.json({periode:{id:per.id,naam:per.naam},weken:A.aantal,week:weekInfo(per,w),
      tellers:{alle:locaties.length,dubbel:new Set(kw.filter(t=>t.meldingen.includes('dubbel')).map(t=>t.thema_id)).size,herhaald:kw.filter(t=>t.meldingen.includes('herhaald')).length,
        gedeeld:Object.values(A.gedeeld[w]||{}).filter(x=>x.stand==='te_weinig').length,geen_kv:locaties.filter(l=>!l.kv).length},
      n_themas:locaties.reduce((n,l)=>n+l.themas.length,0),locaties});
  });

  // ── punt 1: paneel kampmoment ──
  function letOpVan(A,t){
    const uit=[];
    if(t.meldingen.includes('dubbel'))uit.push({soort:'dubbel',kt_id:t.id,tekst:`⚠ ${t.groep} ${t.name} staat deze week ook in ${t.dubbel_met.join(' en ')}`,
      uitleg:'elk thema bestaat maar één keer · er is maar één set materiaal',locaties:[t.locatie,...t.dubbel_met],knop:'Wissel'});
    if(t.meldingen.includes('herhaald'))uit.push({soort:'herhaald',kt_id:t.id,tekst:`↻ ${t.groep} heeft 2 weken na elkaar ${t.name}`,
      uitleg:`week ${t.week-1} en ${t.week} · dezelfde kinderen?`,locaties:[t.locatie],knop:'Wissel'});
    (t.gedeeld||[]).forEach(key=>{const s=stukUit(A,t.week,key);uit.push({soort:'gedeeld',kt_id:t.id,key,tekst:`◐ ${s.naam}: ${s.nodig} nodig, ${s.beschikbaar} ${s.eenheid}`,
      uitleg:s.waar.map(x=>`${x.thema} (${x.locatie})`).join(' · '),locaties:[...new Set(s.waar.map(x=>x.locatie))],knop:'Toon'});});
    return uit;
  }
  app.get('/api/rooster/kampmoment/:id',alleenKantoor,(req,res)=>{
    const km=get('SELECT * FROM kampmomenten WHERE id=?',[req.params.id]);if(!km)return res.status(404).json({error:'Kampmoment niet gevonden'});
    const per=periodeVan(km.periode_id);const A=analyse(per);const k=A.kmById[km.id];const w=k.week;
    const opLocWeek=x=>A.kms.find(o=>o.locatie_id===k.locatie_id&&o.week===x);
    const voor=opLocWeek(w-1),na=opLocWeek(w+1);
    const groepen=[...new Set([...(voor?voor.themas:[]),...k.themas,...(na?na.themas:[])].map(t=>t.groep))]
      .sort((a,b)=>{const o={KL:0,LS:1};return ((o[a.replace(/\d+$/,'')]??2)-(o[b.replace(/\d+$/,'')]??2))||a.localeCompare(b,'nl',{numeric:true});})
      .map(g=>{const c=km2=>{const t=km2&&km2.themas.find(x=>x.groep===g);return t?{naam:t.name,thema_id:t.thema_id,kt_id:t.id,meldingen:t.meldingen}:null;};return {groep:g,voor:c(voor),deze:c(k),na:c(na)};});
    const let_op=k.themas.flatMap(t=>letOpVan(A,t));
    const taak=type=>{const x=get(`SELECT datum,rit_id FROM transport_taken WHERE kampmoment_id=? AND type=? AND status<>'geannuleerd' ORDER BY datum LIMIT 1`,[km.id,type]);return x?{datum:x.datum,rit_id:x.rit_id||null}:null;};
    const gedeeld=Object.keys(A.gedeeld[w]||{}).map(key=>stukUit(A,w,key)).filter(s=>s.waar.some(x=>x.kampmoment_id===km.id)||s.aanvaard.some(x=>x.kampmoment_id===km.id))
      .map(s=>({key:s.key,naam:s.naam,hier:s.waar.filter(x=>x.kampmoment_id===km.id).reduce((n,x)=>n+x.aantal,0),nodig:s.nodig,beschikbaar:s.beschikbaar,stand:s.stand,
        aanvaard:s.aanvaard.filter(x=>x.kampmoment_id===km.id).map(x=>x.thema)}));
    const zomer=A.kms.filter(o=>o.locatie_id===k.locatie_id).map(o=>({week:o.week,kampmoment_id:o.id,kv:o.kv||'',themas:o.themas.map(themaUit)}));
    const ktIds=all('SELECT id FROM kampmoment_themas WHERE kampmoment_id=?',[km.id]).map(r=>r.id);
    const historiek=all(`SELECT tijdstip,persoon_naam,tabel,actie,oud,nieuw FROM wijzigingen WHERE (tabel='kampmomenten' AND rij_id=?) OR (tabel='kampmoment_themas' AND (nieuw LIKE ? OR oud LIKE ?)) ORDER BY id DESC LIMIT 100`,
      [km.id,`%"kampmoment_id":${km.id},%`,`%"kampmoment_id":${km.id},%`]).map(h=>{
        const th=id=>id?((get('SELECT name FROM themas WHERE id=?',[id])||{}).name||'#'+id):'';
        let wat=`${h.tabel==='kampmomenten'?'kampmoment':'thema'} ${h.actie}`;
        try{const o=h.oud?JSON.parse(h.oud):null,n=h.nieuw?JSON.parse(h.nieuw):null;if(h.tabel==='kampmoment_themas'){if(o&&n&&o.thema_id!==n.thema_id)wat=`thema gewisseld: ${th(o.thema_id)} → ${th(n.thema_id)}`;else if(n&&!o)wat=`thema toegevoegd: ${th(n.thema_id)}`;else if(o&&!n)wat=`thema verwijderd: ${th(o.thema_id)}`;}}catch(e){}
        return {t:String(h.tijdstip||'').replace('T',' ').slice(0,16),wie:h.persoon_naam||'systeem',wat};
      });
    res.json({kampmoment:{id:km.id,locatie_id:k.locatie_id,locatie:k.loc,kv:k.kv||'',week:w,periode_id:per.id},week:weekInfo(per,w),weken:A.aantal,
      vorige_week:w>1?w-1:null,volgende_week:w<A.aantal?w+1:null,groepen,let_op,
      sport:sportVan(per,k.locatie_id,w),transport:{brengen:taak('levering'),halen:taak('ophaling')},gedeeld,zomer,historiek,kt_ids:ktIds});
  });

  // ── punt 1: seizoen ──
  function seizoen(A){
    const per=A.per,n=A.aantal;
    const perThema={};
    A.kts.forEach(t=>{(perThema[t.thema_id]=perThema[t.thema_id]||{thema_id:t.thema_id,naam:t.name,weken:{}}).weken[t.week]=(perThema[t.thema_id].weken[t.week]||[]).concat(t);});
    const rijen=Object.values(perThema).map(r=>{
      const weken=[];for(let w=1;w<=n;w++){const l=r.weken[w]||[];weken.push({week:w,locaties:l.map(t=>({naam:t.locatie,kampmoment_id:t.kampmoment_id,groep:t.groep,kt_id:t.id})),
        dubbel:l.some(t=>t.meldingen.includes('dubbel')),herhaald:l.some(t=>t.meldingen.includes('herhaald'))});}
      return {thema_id:r.thema_id,naam:r.naam,weken,dubbel:weken.some(x=>x.dubbel),herhaald:weken.some(x=>x.herhaald),n:weken.filter(x=>x.locaties.length).length};
    }).sort((a,b)=>a.naam.localeCompare(b.naam,'nl'));
    const gebruikt=new Set(rijen.map(r=>r.thema_id));
    const ongebruikt=all('SELECT id,name FROM themas ORDER BY name COLLATE NOCASE').filter(t=>!gebruikt.has(t.id)).map(t=>({thema_id:t.id,naam:t.name,weken:Array.from({length:n},(_,i)=>({week:i+1,locaties:[],dubbel:false,herhaald:false})),dubbel:false,herhaald:false,n:0}));
    return {periode:{id:per.id,naam:per.naam},weken:Array.from({length:n},(_,i)=>weekInfo(per,i+1)),huidige_week:huidigeWeek(per),
      tellers:{alle:rijen.length,dubbel:rijen.reduce((n,r)=>n+r.weken.filter(x=>x.dubbel).length,0),herhaald:rijen.reduce((n,r)=>n+r.weken.filter(x=>x.herhaald).length,0),niet_gebruikt:ongebruikt.length},themas:rijen,niet_gebruikt:ongebruikt};
  }
  app.get('/api/rooster/seizoen',alleenKantoor,(req,res)=>{
    const per=periodeVan(parseInt(req.query.periode_id));if(!per)return res.status(404).json({error:'Er is nog geen vakantieperiode.'});
    res.json(seizoen(analyse(per)));
  });

  // Voorstel: een thema dat die week nergens staat en nog niet eerder (deze periode) op die locatie stond; zelfde leeftijdsgroep eerst.
  function voorstellen(A,t,zonderKey){
    const bezet=new Set(A.kts.filter(x=>x.week===t.week).map(x=>x.thema_id));
    const eerder=new Set(A.kts.filter(x=>x.locatie_id===t.locatie_id&&x.week<=t.week+1).map(x=>x.thema_id));
    return all("SELECT id,name,leeftijdsgroep FROM themas WHERE COALESCE(categorie,'')<>'themadag' ORDER BY name COLLATE NOCASE")
      .filter(x=>!bezet.has(x.id)&&!eerder.has(x.id)&&!(zonderKey&&A.def[zonderKey]&&A.def[zonderKey].themas[x.id]))
      .map(x=>({thema_id:x.id,naam:x.name,zelfde_groep:lgCode(x.leeftijdsgroep)===t.lg}))
      .sort((a,b)=>(b.zelfde_groep-a.zelfde_groep));
  }
  app.get('/api/rooster/thema/:id',alleenKantoor,(req,res)=>{
    const th=get('SELECT * FROM themas WHERE id=?',[req.params.id]);if(!th)return res.status(404).json({error:'Thema niet gevonden'});
    const per=periodeVan(parseInt(req.query.periode_id));const A=analyse(per);
    const mijn=A.kts.filter(t=>t.thema_id===th.id).sort((a,b)=>a.week-b.week||a.locatie.localeCompare(b.locatie));
    const plaatsen=mijn.map(t=>{const rit=get(`SELECT rit_id FROM transport_taken WHERE kampmoment_id=? AND type='levering' AND status<>'geannuleerd' ORDER BY datum LIMIT 1`,[t.kampmoment_id]);
      return {week:t.week,locatie:t.locatie,kampmoment_id:t.kampmoment_id,kt_id:t.id,groep:t.groep,kv:t.kv,brengen_rit:rit&&rit.rit_id||null,meldingen:t.meldingen,
        uitleg:t.meldingen.includes('dubbel')?`${t.groep} · ook in ${t.dubbel_met.join(' en ')} dezelfde week`:t.meldingen.includes('herhaald')?`${t.groep} opnieuw · dezelfde kinderen 2 weken hetzelfde thema`:''};});
    const bezetteWeken=new Set(mijn.map(t=>t.week));
    const vrij=[];for(let w=1;w<=A.aantal;w++)if(!bezetteWeken.has(w))vrij.push(w);
    const probleem=mijn.find(t=>t.meldingen.length);
    let voorstel=null;
    if(probleem){const v=voorstellen(A,probleem)[0];if(v)voorstel={kt_id:probleem.id,kampmoment_id:probleem.kampmoment_id,nieuw_thema_id:v.thema_id,tekst:`${probleem.locatie} wk ${probleem.week} → ${v.naam} (vrij, niet eerder in ${probleem.locatie})`};}
    const bakken=all('SELECT COUNT(*) AS n FROM thema_bak WHERE thema_id=?',[th.id])[0];
    const gedeeld=Object.values(A.def).filter(s=>s.themas[th.id]).map(s=>({key:s.key,naam:s.naam,beschikbaar:s.beschikbaar,eenheid:s.eenheid,
      andere:Object.keys(s.themas).map(Number).filter(id=>id!==th.id).map(id=>(get('SELECT name FROM themas WHERE id=?',[id])||{}).name).filter(Boolean)}));
    res.json({thema:{id:th.id,naam:th.name,leeftijdsgroep:th.leeftijdsgroep||'',bakken:bakken?bakken.n:0},periode:{id:per.id,naam:per.naam},plaatsen,vrij,voorstel,gedeeld});
  });

  // Keuzelijst voor Wissel: eerst de voorgestelde thema's.
  app.get('/api/rooster/wissel-opties',alleenKantoor,(req,res)=>{
    const kt=get('SELECT kt.*,km.periode_id FROM kampmoment_themas kt JOIN kampmomenten km ON km.id=kt.kampmoment_id WHERE kt.id=?',[parseInt(req.query.kt_id)||0]);
    if(!kt)return res.status(404).json({error:'Groep niet gevonden'});
    const A=analyse(periodeVan(kt.periode_id));const t=A.kts.find(x=>x.id===kt.id);
    const v=voorstellen(A,t,req.query.zonder||null);const vs=new Set(v.map(x=>x.thema_id));
    const rest=all('SELECT id,name FROM themas ORDER BY name COLLATE NOCASE').filter(x=>!vs.has(x.id)&&x.id!==t.thema_id).map(x=>({thema_id:x.id,naam:x.name,voorgesteld:false}));
    res.json({groep:t.groep,huidig:{thema_id:t.thema_id,naam:t.name},locatie:t.locatie,week:t.week,opties:[...v.map(x=>({...x,voorgesteld:true})),...rest]});
  });

  // ── punt 1: wissel (optioneel ruil met een andere groep: "thema naar andere week") ──
  app.post('/api/rooster/wissel',alleenKantoor,(req,res)=>{
    const {kampmoment_id,groep_thema_id,nieuw_thema_id,ruil_met_kt_id}=req.body||{};
    const kt=get('SELECT * FROM kampmoment_themas WHERE id=?',[parseInt(groep_thema_id)||0]);
    if(!kt||(kampmoment_id&&kt.kampmoment_id!==Number(kampmoment_id)))return res.status(404).json({error:'Groep niet gevonden in dit kampmoment'});
    const oud=get('SELECT * FROM themas WHERE id=?',[kt.thema_id]),nieuw=get('SELECT * FROM themas WHERE id=?',[nieuw_thema_id]);
    if(!nieuw)return res.status(400).json({error:'Kies een thema'});
    if(nieuw.id===kt.thema_id)return res.status(400).json({error:'Dat is al het thema van deze groep'});
    const ruil=ruil_met_kt_id?get('SELECT * FROM kampmoment_themas WHERE id=?',[ruil_met_kt_id]):null;
    if(ruil_met_kt_id&&(!ruil||ruil.thema_id!==nieuw.id))return res.status(400).json({error:'De ruil past niet meer bij het rooster; laad opnieuw'});
    const botst=(kmId,thId,behalve)=>get('SELECT id FROM kampmoment_themas WHERE kampmoment_id=? AND thema_id=? AND id<>?',[kmId,thId,behalve]);
    if(botst(kt.kampmoment_id,nieuw.id,kt.id)||(ruil&&botst(ruil.kampmoment_id,oud.id,ruil.id)))return res.status(409).json({error:`${nieuw.name} staat al in dit kampmoment`});
    const km=get('SELECT km.*,l.name AS loc FROM kampmomenten km JOIN locaties l ON l.id=km.locatie_id WHERE km.id=?',[kt.kampmoment_id]);
    const ctxt=`rooster: wissel ${oud.name} → ${nieuw.name}`;
    updateMetLog(req,'kampmoment_themas',kt.id,{thema_id:nieuw.id},ctxt);
    if(ruil){const rk=get('SELECT km.week,l.name AS loc FROM kampmomenten km JOIN locaties l ON l.id=km.locatie_id WHERE km.id=?',[ruil.kampmoment_id]);
      updateMetLog(req,'kampmoment_themas',ruil.id,{thema_id:oud.id},`rooster: ruil ${nieuw.name} → ${oud.name}`);
      logAct('planning','wissel',`Rooster: ${km.loc} wk ${km.week} ${oud.name} ↔ ${rk.loc} wk ${rk.week} ${nieuw.name} (door ${req.persoon?req.persoon.naam:'?'})`,km.locatie_id,km.loc);}
    else logAct('planning','wissel',`Rooster: ${km.loc} wk ${km.week} thema ${oud.name} → ${nieuw.name} (door ${req.persoon?req.persoon.naam:'?'})`,km.locatie_id,km.loc);
    const A=analyse(periodeVan(km.periode_id));const t=A.kts.find(x=>x.id===kt.id);
    res.json({ok:true,oud:{thema_id:oud.id,naam:oud.name},nieuw:{thema_id:nieuw.id,naam:nieuw.name},groep:t.groep,meldingen:t.meldingen,let_op:letOpVan(A,t)});
  });

  // ── punt 2b: gedeeld materiaal ──
  app.get('/api/rooster/gedeeld',alleenKantoor,(req,res)=>{
    const per=periodeVan(parseInt(req.query.periode_id));if(!per)return res.status(404).json({error:'Er is nog geen vakantieperiode.'});
    const A=analyse(per),w=weekNr(req.query.week,A);
    const stukken=Object.keys(A.def).map(key=>stukUit(A,w,key)).sort((a,b)=>({te_weinig:0,precies_op:1,ok:2,niet_nodig:3}[a.stand]-{te_weinig:0,precies_op:1,ok:2,niet_nodig:3}[b.stand])||a.naam.localeCompare(b.naam,'nl'));
    stukken.forEach(s=>{s.zoek=[s.naam,s.vast_type,...s.waar.map(x=>x.thema+' '+x.locatie)].join(' ').toLowerCase();});
    res.json({periode:{id:per.id,naam:per.naam},weken:A.aantal,week:weekInfo(per,w),
      tellers:{nodig:stukken.filter(s=>s.nodig>0).length,alle:stukken.length,te_weinig:stukken.filter(s=>s.stand==='te_weinig').length,precies_op:stukken.filter(s=>s.stand==='precies_op').length},stukken});
  });
  app.get('/api/rooster/gedeeld/seizoen',alleenKantoor,(req,res)=>{
    const per=periodeVan(parseInt(req.query.periode_id));if(!per)return res.status(404).json({error:'Er is nog geen vakantieperiode.'});
    const A=analyse(per);
    const stukken=Object.values(A.def).map(s=>{
      const weken=[];for(let w=1;w<=A.aantal;w++){const x=stukUit(A,w,s.key);weken.push({week:w,nodig:x.nodig,stand:x.stand});}
      return {key:s.key,naam:s.naam,vast_type:s.vast_type,beschikbaar:s.beschikbaar,weken,gebruikt:weken.some(x=>x.nodig>0),te_weinig:weken.some(x=>x.stand==='te_weinig')};
    }).sort((a,b)=>(b.gebruikt-a.gebruikt)||a.naam.localeCompare(b.naam,'nl'));
    res.json({periode:{id:per.id,naam:per.naam},weken:Array.from({length:A.aantal},(_,i)=>weekInfo(per,i+1)),
      tellers:{gebruikt:stukken.filter(s=>s.gebruikt).length,alle:stukken.length,te_weinig:stukken.filter(s=>s.te_weinig).length},stukken});
  });
  app.get('/api/rooster/gedeeld/stuk',alleenKantoor,(req,res)=>{
    const per=periodeVan(parseInt(req.query.periode_id));if(!per)return res.status(404).json({error:'Er is nog geen vakantieperiode.'});const A=analyse(per);const key=String(req.query.key||'');
    const s=A.def[key];if(!s)return res.status(404).json({error:'Stuk niet gevonden'});
    const w=weekNr(req.query.week,A);const x=stukUit(A,w,key);
    const kort=ww=>{if(ww<1||ww>A.aantal)return null;const y=stukUit(A,ww,key);return {week:ww,nodig:y.nodig,beschikbaar:y.beschikbaar,locaties:[...new Set(y.waar.map(z=>z.locatie))],themas:[...new Set(y.waar.map(z=>z.thema))]};};
    // Voorstel 1: thema ruilen met hetzelfde kampmoment (zelfde locatie) een week ervoor/erna, als het stuk dan in beide weken past.
    const voorstellen=[];
    if(x.stand==='te_weinig'){
      const nodigIn=ww=>stukUit(A,ww,key).nodig;
      for(const k of [...x.waar].reverse()){
        const t=A.kts.find(z=>z.id===k.kt_id),a=s.themas[t.thema_id];
        for(const ww of [w+1,w-1]){
          const andere=A.kts.find(z=>z.locatie_id===t.locatie_id&&z.week===ww&&z.lg===t.lg&&!s.themas[z.thema_id]);
          if(!andere)continue;
          const elders=A.kts.some(z=>z.week===ww&&z.thema_id===t.thema_id)||A.kts.some(z=>z.week===w&&z.thema_id===andere.thema_id);
          if(elders||nodigIn(ww)+a>s.beschikbaar)continue;
          voorstellen.push({soort:'ruil',tekst:`${t.name} naar week ${ww}`,sub:`${s.naam} dan ${nodigIn(ww)+a} van ${s.beschikbaar} in gebruik · ${t.locatie} ${andere.groep} ${andere.name} komt naar week ${w}`,
            kampmoment_id:t.kampmoment_id,groep_thema_id:t.id,nieuw_thema_id:andere.thema_id,ruil_met_kt_id:andere.id});break;
        }
        voorstellen.push({soort:'aanvaard',tekst:`of ${t.name} zonder ${s.naam.toLowerCase()}`,sub:'alleen deze week, gelogd',thema_id:t.thema_id,kampmoment_id:t.kampmoment_id});
        if(voorstellen.length>=2)break;
      }
    }
    const themas=Object.entries(s.themas).map(([id,aantal])=>({thema_id:+id,naam:(get('SELECT name FROM themas WHERE id=?',[id])||{}).name||'#'+id,aantal}));
    const zomer=[];for(let ww=1;ww<=A.aantal;ww++){const y=stukUit(A,ww,key);if(y.nodig||y.aanvaard.length)zomer.push({week:ww,nodig:y.nodig,stand:y.stand,waar:y.waar.map(z=>`${z.locatie} (${z.thema})`)});}
    res.json({stuk:{...x,week:w},week:weekInfo(per,w),weken:A.aantal,vorige:kort(w-1),volgende:kort(w+1),voorstellen,themas,zomer});
  });
  app.post('/api/rooster/gedeeld/aanvaard',alleenKantoor,(req,res)=>{
    const {periode_id,week,key,thema_id,terug}=req.body||{};
    const per=periodeVan(parseInt(periode_id));const A=analyse(per);const s=A.def[key];
    if(!s||!s.themas[thema_id])return res.status(400).json({error:'Dit thema gebruikt dat stuk niet'});
    const naam=aanvKey(per.id,parseInt(week),key,parseInt(thema_id)),th=(get('SELECT name FROM themas WHERE id=?',[thema_id])||{}).name;
    const wie=req.persoon?req.persoon.naam:'?';
    if(terug)run('DELETE FROM app_vlaggen WHERE naam=?',[naam]);
    else run('INSERT OR REPLACE INTO app_vlaggen (naam,waarde) VALUES (?,?)',[naam,JSON.stringify({door:wie,op:new Date().toISOString()})]);
    logAct('planning','gedeeld',`Gedeeld materiaal: ${th} in week ${week} ${terug?'weer mét':'zonder'} ${s.naam} (door ${wie})`,null,null);
    res.json({ok:true,stuk:stukUit(analyse(per),parseInt(week),key)});
  });

  // Gebruikt door routes/periodes-overzicht.js ("Klaar voor de start?").
  ctx._roosterAnalyse=per=>analyse(per);
  ctx._roosterWeek=weekInfo;

  // ── pagina's (alleen kantoor) ──
  const paginaRol=(req,res,next)=>{const tk=req.headers['x-auth-token']||'';if(!tk)return next();req.persoon=ctx.checkSessie(tk);if(!req.persoon)return res.status(401).send('Niet ingelogd');return alleenKantoor(req,res,next);};
  app.get('/rooster',paginaRol,(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','rooster.html')));
  app.get('/gedeeld',paginaRol,(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','gedeeld.html')));
};
