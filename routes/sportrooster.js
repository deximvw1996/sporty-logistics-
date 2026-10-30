// routes/sportrooster.js — PL3: Planning › Sportrooster per dag en per soort sport (design/mockup-planning-v3.html, schermen "Sport · Week" en "Sport · Seizoen").
// Sportpakketten van dezelfde sport zijn uitwisselbaar: kantoor plant een SOORT sport op een locatie voor een reeks dagen (ma–vr) van een week,
// het systeem kiest de set. Een set die midden in de week van plek wisselt krijgt een verhuistaak op Transport › Taken (avond vóór de eerste nieuwe dag).
// Te weinig sets = rode melding met voorstel, nooit een verbod. Alles gelogd (wijzigingen-log). Data (JSON) en weergave (public/sportrooster.*) zijn gescheiden.
'use strict';
module.exports = function(ctx){
  const {app,get,all,insMetLog,updateMetLog,delMetLog,alleenKantoor,path,ROOT_DIR,logAct} = ctx;

  const DAGEN=['ma','di','wo','do','vr'];
  const DAGLANG=['maandag','dinsdag','woensdag','donderdag','vrijdag'];
  const d0=s=>new Date(s+'T12:00:00');
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const plusDagen=(s,n)=>{const d=d0(s);d.setDate(d.getDate()+n);return iso(d);};
  const kort=s=>{const d=d0(s);return `${d.getDate()}/${d.getMonth()+1}`;};
  const kort2=s=>{const d=d0(s);return `${d.getDate()}/${String(d.getMonth()+1).padStart(2,'0')}`;};
  // Soort = itemnaam zonder de laatste letter/cijfer-aanduiding ("Archery tag A" → "Archery tag", "Hockey 3" → "Hockey"); "Kinball Abdij" blijft een eigen soort.
  const soortVan=n=>String(n||'').replace(/ +([A-Za-z]|[0-9]+)$/,'').trim()||String(n||'');
  const dagTekst=(a,b)=>a===b?DAGEN[a-1]:`${DAGEN[a-1]}–${DAGEN[b-1]}`;

  function periodeVan(q){
    const id=parseInt(q)||(get('SELECT id FROM vakantieperiodes WHERE actief=1')||{}).id||(get('SELECT id FROM vakantieperiodes ORDER BY id LIMIT 1')||{}).id;
    return id?get('SELECT * FROM vakantieperiodes WHERE id=?',[id]):null;
  }
  const aantalWeken=per=>per.max_weken||9;
  const weekStart=(per,week)=>plusDagen(per.start_datum,(week-1)*7);
  const dagDatum=(per,week,dag)=>plusDagen(weekStart(per,week),dag-1);
  const weekLabel=(per,week)=>`Week ${week} · ${d0(weekStart(per,week)).getDate()}–${kort2(dagDatum(per,week,5))}`;
  // Zonder ?week= de week van vandaag als die in de periode valt, anders week 1.
  const weekVan=(per,q)=>{
    const w=parseInt(q);if(w>=1&&w<=aantalWeken(per))return w;
    const n=Math.floor((d0(iso(new Date()))-d0(per.start_datum))/(7*86400000))+1;
    return n>=1&&n<=aantalWeken(per)?n:1;
  };

  // Alle sets (per soort) en alle planning van één periode in het geheugen: de rooster-sommen zijn klein (±110 sets).
  function laad(per){
    const sets=all('SELECT ss.id,ss.label,ss.item_id,si.name AS item,si.stockage_locatie_id FROM sport_sets ss JOIN sport_items si ON si.id=ss.item_id ORDER BY si.name COLLATE NOCASE,ss.label,ss.id');
    const soorten=new Map(),setSoort=new Map(),setInfo=new Map();
    sets.forEach(s=>{const k=soortVan(s.item);if(!soorten.has(k))soorten.set(k,{soort:k,sets:[]});soorten.get(k).sets.push(s);setSoort.set(s.id,k);setInfo.set(s.id,s);});
    const locNaam=new Map(all('SELECT id,name FROM locaties').map(l=>[l.id,l.name]));
    const rijen=all('SELECT * FROM sport_planning WHERE periode_id=? ORDER BY id',[per.id]).map(r=>({...r,dag_van:r.dag_van||1,dag_tot:r.dag_tot||5,
      soort_eff:setSoort.get(r.set_id)||r.soort||'',loc:locNaam.get(r.locatie_id)||'?'}));
    return {soorten,setSoort,setInfo,rijen,locNaam};
  }
  const dekt=(r,d)=>r.dag_van<=d&&r.dag_tot>=d;

  // Per dag ma–vr: hoeveel rijen (plekken waar een set nodig is) dekken die dag, tegenover het aantal sets van die soort.
  function dagenVan(c,soort,week){
    const n=(c.soorten.get(soort)||{sets:[]}).sets.length;
    const rs=c.rijen.filter(r=>r.soort_eff===soort&&r.week===week);
    return {n,rijen:rs,dagen:[1,2,3,4,5].map(d=>{const g=rs.filter(r=>dekt(r,d)).length;return {in_gebruik:g,sets:n,te_weinig:g>n};})};
  }
  // De rijen die op een dag "te veel" zijn: de laatst ingeplande voorbij het aantal sets.
  function overRijen(c,soort,week){
    const {n,rijen}=dagenVan(c,soort,week);const over=new Map();
    for(let d=1;d<=5;d++){rijen.filter(r=>dekt(r,d)).sort((a,b)=>a.id-b.id).slice(n).forEach(r=>{(over.get(r.id)||over.set(r.id,new Set()).get(r.id)).add(d);});}
    return over;
  }

  // Verhuizen midden in de week: dezelfde set staat op twee opeenvolgende plekken in één week. Gebundeld per soort, route en dag.
  function verhuizen(c,per,week,soort){
    const perSet=new Map();
    c.rijen.filter(r=>r.week===week&&(!soort||r.soort_eff===soort)).forEach(r=>{(perSet.get(r.set_id)||perSet.set(r.set_id,[]).get(r.set_id)).push(r);});
    const groepen=new Map();
    perSet.forEach((rs,setId)=>{
      rs.sort((a,b)=>a.dag_van-b.dag_van||a.id-b.id);
      for(let i=0;i<rs.length-1;i++){
        const A=rs[i],B=rs[i+1];if(A.locatie_id===B.locatie_id||B.dag_van<=A.dag_van)continue;
        const datum=dagDatum(per,week,Math.max(1,B.dag_van-1));
        const sleutel=`sv:${per.id}:${week}:${A.soort_eff}:${A.locatie_id}:${B.locatie_id}:${datum}`;
        const g=groepen.get(sleutel)||groepen.set(sleutel,{sleutel,soort:A.soort_eff,week,van_id:A.locatie_id,naar_id:B.locatie_id,van:A.loc,naar:B.loc,datum,eerste_dag:B.dag_van,sets:[]}).get(sleutel);
        g.sets.push((c.setInfo.get(setId)||{}).label||'?');
      }
    });
    return [...groepen.values()];
  }
  // Houdt de verhuistaken in transport_taken gelijk aan de planning van (periode, week, soort): ontbrekende aanmaken, verouderde (nog niet op een rit) weghalen.
  function syncVerhuizen(req,per,soort,week){
    const c=laad(per);const gewenst=verhuizen(c,per,week,soort);const prefix=`sv:${per.id}:${week}:${soort}:`;
    const bestaand=all("SELECT * FROM transport_taken WHERE categorie LIKE 'sv:%'").filter(t=>t.categorie.startsWith(prefix));
    let nieuw=0,weg=0;
    const gebruikt=new Set();
    gewenst.forEach(g=>{const bij=bestaand.find(t=>t.categorie===g.sleutel);if(bij)gebruikt.add(bij.id);});
    gewenst.forEach(g=>{
      const tekst=`Sport verhuis: ${g.soort} (${g.sets.join(', ')}) van ${g.van} → ${g.naar}, vóór ${DAGEN[g.eerste_dag-1]} ${kort(dagDatum(per,week,g.eerste_dag))}`;
      let bij=bestaand.find(t=>t.categorie===g.sleutel);
      // Dagen verschoven: dezelfde route in dezelfde week neemt de bestaande taak over (met de gekozen verhuizer) i.p.v. een nieuwe te maken.
      if(!bij){bij=bestaand.find(t=>!gebruikt.has(t.id)&&t.categorie.startsWith(`${prefix}${g.van_id}:${g.naar_id}:`));if(bij)gebruikt.add(bij.id);}
      if(bij){if(bij.opmerking!==tekst||bij.categorie!==g.sleutel||bij.datum!==g.datum)updateMetLog(req,'transport_taken',bij.id,{opmerking:tekst,categorie:g.sleutel,datum:g.datum},'sportrooster');return;}
      insMetLog(req,'transport_taken',['type','datum','tijd','van_locatie_id','naar_locatie_id','opmerking','wie','status','created_at','categorie','week'],
        ['levering',g.datum,'17:00',g.van_id,g.naar_id,tekst,'','gepland',new Date().toISOString(),g.sleutel,week],'sportrooster');nieuw++;
    });
    bestaand.filter(t=>!gebruikt.has(t.id)&&!t.rit_id).forEach(t=>{delMetLog(req,'transport_taken',t.id,'sportrooster');weg++;});
    return {nieuw,weg};
  }

  // Welke set krijgt de plek? Eerst een set die vrij is op die dagen; bij voorkeur die de dag ervoor al op deze locatie (of elders in de buurt) stond.
  function kiesSet(c,soort,week,dagVan,dagTot,locId){
    const sets=(c.soorten.get(soort)||{sets:[]}).sets;if(!sets.length)return null;
    const overl=r=>r.dag_van<=dagTot&&r.dag_tot>=dagVan;
    const belasting=s=>c.rijen.filter(r=>r.set_id===s.id&&r.week===week&&overl(r)).length;
    const gisteren=s=>{
      const rs=dagVan>1?c.rijen.filter(r=>r.set_id===s.id&&r.week===week&&r.dag_tot===dagVan-1)
                       :c.rijen.filter(r=>r.set_id===s.id&&r.week===week-1&&r.dag_tot===5);
      return rs.length?(rs.some(r=>r.locatie_id===locId)?0:1):2;
    };
    const botst=s=>c.rijen.some(r=>r.set_id===s.id&&r.week===week&&r.dag_van===dagVan&&r.locatie_id===locId);
    const kand=sets.filter(s=>!botst(s)).map(s=>({s,b:belasting(s),g:gisteren(s)}));
    if(!kand.length)return null;
    const vrij=kand.filter(k=>k.b===0);
    const pool=vrij.length?vrij:kand;
    pool.sort((x,y)=>(vrij.length?0:x.b-y.b)||x.g-y.g||x.s.id-y.s.id);
    return {set:pool[0].s,vrij:vrij.length>0};
  }
  function plan(req,per,{soort,week,locatie_id,dag_van,dag_tot}){
    const c=laad(per);
    if(!c.soorten.has(soort))return {fout:'Onbekende sport',status:400};
    const loc=get('SELECT id,name FROM locaties WHERE id=?',[locatie_id]);if(!loc)return {fout:'Onbekende locatie',status:400};
    const k=kiesSet(c,soort,week,dag_van,dag_tot,loc.id);
    if(!k)return {fout:'Deze sport staat die dagen al op deze locatie ingepland',status:409};
    const id=insMetLog(req,'sport_planning',['set_id','locatie_id','week','periode_id','dag_van','dag_tot','soort'],[k.set.id,loc.id,week,per.id,dag_van,dag_tot,soort],'sportrooster');
    logAct('sport','gepland',`${soort} (${k.set.label}) → ${loc.name}, week ${week} ${dagTekst(dag_van,dag_tot)}`,loc.id,loc.name);
    const na=dagenVan(laad(per),soort,week);
    const tw=na.dagen.map((x,i)=>x.te_weinig?i+1:0).filter(Boolean).filter(d=>d>=dag_van&&d<=dag_tot);
    const sv=syncVerhuizen(req,per,soort,week);
    return {ok:true,id,set_id:k.set.id,set:k.set.label,locatie:loc.name,te_weinig:tw.length>0,te_weinig_dagen:tw.map(d=>DAGEN[d-1]),verhuistaken_nieuw:sv.nieuw};
  }
  const geldigeDagen=(a,b)=>Number.isInteger(a)&&Number.isInteger(b)&&a>=1&&b<=5&&a<=b;

  // ── Voorstel bij te weinig sets: een andere sport die die dagen vrij is ──
  function voorstellen(c,per,soort,week){
    const over=overRijen(c,soort,week);const uit=[];
    over.forEach((dagen,rijId)=>{
      const r=c.rijen.find(x=>x.id===rijId);const ds=[...dagen].sort((a,b)=>a-b);const a=ds[0],b=ds[ds.length-1];
      let beste=null;
      c.soorten.forEach((sv,naam)=>{
        if(naam===soort)return;
        const di=dagenVan(c,naam,week);let vrij=Infinity;
        for(let d=a;d<=b;d++)vrij=Math.min(vrij,di.n-di.dagen[d-1].in_gebruik);
        if(vrij>=1&&(!beste||vrij>beste.vrij||(vrij===beste.vrij&&naam.localeCompare(beste.soort)<0)))beste={soort:naam,vrij};
      });
      uit.push({rij_id:rijId,locatie_id:r.locatie_id,locatie:r.loc,dag_van:a,dag_tot:b,
        tekst:beste?`${r.loc} ${dagTekst(a,b)} ${beste.soort} (${beste.vrij} vrij)`:`${r.loc} ${dagTekst(a,b)}: geen andere sport vrij`,
        voorstel:beste?{soort:beste.soort,vrij:beste.vrij}:null});
    });
    return uit;
  }

  // ── Weekoverzicht: alle soorten (of enkel de ingeplande) met vijf dagvakjes ──
  app.get('/api/sportrooster/week',alleenKantoor,(req,res)=>{
    const per=periodeVan(req.query.periode_id);if(!per)return res.status(404).json({error:'Geen periode'});
    const week=weekVan(per,req.query.week);const c=laad(per);
    const vm=verhuizen(c,per,week);
    const sporten=[...c.soorten.values()].sort((a,b)=>a.soort.localeCompare(b.soort,'nl')).map(s=>{
      const di=dagenVan(c,s.soort,week);
      return {soort:s.soort,sets:s.sets.length,ingepland:di.rijen.length>0,dagen:di.dagen,te_weinig:di.dagen.some(x=>x.te_weinig),verhuis:vm.filter(m=>m.soort===s.soort).length};
    });
    res.json({periode:{id:per.id,naam:per.naam},week,weken:aantalWeken(per),label:weekLabel(per,week),
      tellers:{ingepland:sporten.filter(s=>s.ingepland).length,alle:sporten.length,te_weinig:sporten.filter(s=>s.te_weinig).length,verhuis:vm.length},
      sporten,locaties:all("SELECT id,name AS naam FROM locaties WHERE COALESCE(type,'')<>'stockage' ORDER BY name COLLATE NOCASE")});
  });

  // ── Paneel van één soort: raster, let op, verhuizen, hele zomer, sets ──
  app.get('/api/sportrooster/soort/:soort',alleenKantoor,(req,res)=>{
    const per=periodeVan(req.query.periode_id);if(!per)return res.status(404).json({error:'Geen periode'});
    const week=weekVan(per,req.query.week);const c=laad(per);const soort=req.params.soort;
    const s=c.soorten.get(soort);if(!s)return res.status(404).json({error:'Sport niet gevonden'});
    const di=dagenVan(c,soort,week);const over=overRijen(c,soort,week);
    const locs=new Map();
    di.rijen.forEach(r=>{
      const l=locs.get(r.locatie_id)||locs.set(r.locatie_id,{locatie_id:r.locatie_id,naam:r.loc,dagen:['','','','',''],rijen:[]}).get(r.locatie_id);
      for(let d=r.dag_van;d<=r.dag_tot;d++)l.dagen[d-1]=(over.get(r.id)||new Set()).has(d)?'ov':(l.dagen[d-1]==='ov'?'ov':'on');
      l.rijen.push({id:r.id,set:(c.setInfo.get(r.set_id)||{}).label||'?',dag_van:r.dag_van,dag_tot:r.dag_tot});
    });
    const raster=[...locs.values()].sort((a,b)=>a.naam.localeCompare(b.naam,'nl')).map(l=>({...l,te_weinig:l.dagen.includes('ov')}));
    const tw=di.dagen.map((x,i)=>x.te_weinig?i+1:0).filter(Boolean);
    const letOp=tw.length?[{tekst:`${dagTekst(tw[0],tw[tw.length-1])} ${Math.max(...di.dagen.map(x=>x.in_gebruik))} nodig, ${di.n} sets`,voorstellen:voorstellen(c,per,soort,week)}]:[];
    const tak=new Map(all('SELECT * FROM transport_taken WHERE categorie LIKE ?',[`sv:${per.id}:${week}:%`]).map(t=>[t.categorie,t]));
    const verhuis=verhuizen(c,per,week,soort).map(g=>{const t=tak.get(g.sleutel);
      return {wanneer:`${DAGEN[Math.max(0,g.eerste_dag-2)]} ${kort(g.datum)} avond`,van:g.van,naar:g.naar,sets:g.sets,taak_id:t?t.id:null,wie:t?t.wie||'':'',datum:g.datum};});
    // Hele zomer: per week de drukste dag en de locaties (verhuizen als A→B).
    const zomer=[];
    for(let w=1;w<=aantalWeken(per);w++){
      const dw=dagenVan(c,soort,w);if(!dw.rijen.length)continue;
      const mv=verhuizen(c,per,w,soort);const verhuisd=new Set();mv.forEach(m=>{verhuisd.add(m.van_id);verhuisd.add(m.naar_id);});
      const namen=[...new Set(dw.rijen.map(r=>r.loc))];
      const delen=[...new Set(mv.map(m=>`${m.van}→${m.naar}`)),...[...new Set(dw.rijen.filter(r=>!verhuisd.has(r.locatie_id)).map(r=>r.loc))]];
      const maxg=Math.max(...dw.dagen.map(x=>x.in_gebruik));
      const twd=dw.dagen.map((x,i)=>x.te_weinig?i+1:0).filter(Boolean);
      zomer.push({week:w,label:weekLabel(per,w),gebruik:maxg,sets:dw.n,te_weinig:twd.length>0,te_weinig_dagen:twd.length?dagTekst(twd[0],twd[twd.length-1]):'',locaties:delen.length?delen:namen});
    }
    const setsLijst=s.sets.map(x=>{
      const rs=di.rijen.filter(r=>r.set_id===x.id);
      return {id:x.id,label:x.label,item:x.item,stockage:x.stockage_locatie_id?(c.locNaam.get(x.stockage_locatie_id)||''):'',
        deze_week:rs.map(r=>`${r.loc} ${dagTekst(r.dag_van,r.dag_tot)}`).join(' · ')||'vrij'};
    });
    const personeel=all("SELECT id,naam,rol FROM personeel WHERE rol IN ('chauffeur','coordinator','kv') AND COALESCE(actief,1)=1 ORDER BY naam COLLATE NOCASE");
    const ingepl=zomer.length,tekort=zomer.filter(z=>z.te_weinig).length;
    res.json({soort,week,label:weekLabel(per,week),weken:aantalWeken(per),sets:s.sets.length,dagen:di.dagen,raster,let_op:letOp,verhuis,hele_zomer:zomer,sets_lijst:setsLijst,personeel,
      samenvatting:{week:tw.length?`${s.sets.length} sets · ${dagTekst(tw[0],tw[tw.length-1])} ${Math.max(...di.dagen.map(x=>x.in_gebruik))} nodig`:`${s.sets.length} sets`,
        zomer:`${s.sets.length} sets · ${ingepl} week${ingepl===1?'':'en'} ingepland${tekort?` · ${tekort} tekort`:''}`}});
  });

  // Voor Periodes › Klaar voor de start (hoofdchat-reviewfix PL2/PL3)
  ctx.sportTeWeinig=function(pid){const per=periodeVan(pid);if(!per)return null;const c=laad(per);const N=aantalWeken(per);let n=0;
    for(const s of c.soorten.values())for(let w=1;w<=N;w++){if(dagenVan(c,s.soort,w).dagen.some(x=>x.te_weinig))n++;}return n;};

  // ── Seizoen: per soort × week de drukste dag ──
  app.get('/api/sportrooster/seizoen',alleenKantoor,(req,res)=>{
    const per=periodeVan(req.query.periode_id);if(!per)return res.status(404).json({error:'Geen periode'});
    const c=laad(per);const N=aantalWeken(per);let totaal=0;
    const sporten=[...c.soorten.values()].sort((a,b)=>a.soort.localeCompare(b.soort,'nl')).map(s=>{
      const weken=[];
      for(let w=1;w<=N;w++){const di=dagenVan(c,s.soort,w);const g=Math.max(0,...di.dagen.map(x=>x.in_gebruik));const tw=di.dagen.some(x=>x.te_weinig);if(tw)totaal++;
        weken.push({week:w,gebruik:g,sets:di.n,leeg:!di.rijen.length,te_weinig:tw});}
      return {soort:s.soort,sets:s.sets.length,ingepland:weken.some(x=>!x.leeg),te_weinig:weken.some(x=>x.te_weinig),weken};
    });
    res.json({periode:{id:per.id,naam:per.naam},weken:N,week_labels:Array.from({length:N},(_,i)=>weekLabel(per,i+1)),
      tellers:{ingepland:sporten.filter(s=>s.ingepland).length,alle:sporten.length,te_weinig:sporten.filter(s=>s.te_weinig).length},te_weinig_totaal:totaal,sporten});
  });

  // ── Schrijven ──
  app.post('/api/sportrooster/plan',alleenKantoor,(req,res)=>{
    const b=req.body||{};const per=periodeVan(b.periode_id);if(!per)return res.status(404).json({error:'Geen periode'});
    const week=parseInt(b.week),dv=b.dag_van==null?1:parseInt(b.dag_van),dt=b.dag_tot==null?5:parseInt(b.dag_tot),loc=parseInt(b.locatie_id);
    if(!(week>=1&&week<=aantalWeken(per)))return res.status(400).json({error:'Week buiten de periode'});
    if(!geldigeDagen(dv,dt))return res.status(400).json({error:'Dagen ma–vr (1–5), van ≤ tot'});
    if(!b.soort||!loc)return res.status(400).json({error:'Sport en locatie vereist'});
    const r=plan(req,per,{soort:String(b.soort),week,locatie_id:loc,dag_van:dv,dag_tot:dt});
    if(r.fout)return res.status(r.status).json({error:r.fout});
    res.json(r);
  });
  app.put('/api/sportrooster/plan/:id',alleenKantoor,(req,res)=>{
    const r=get('SELECT * FROM sport_planning WHERE id=?',[req.params.id]);if(!r)return res.status(404).json({error:'Niet gevonden'});
    const b=req.body||{};const dv=b.dag_van==null?r.dag_van||1:parseInt(b.dag_van),dt=b.dag_tot==null?r.dag_tot||5:parseInt(b.dag_tot),loc=b.locatie_id==null?r.locatie_id:parseInt(b.locatie_id);
    if(!geldigeDagen(dv,dt))return res.status(400).json({error:'Dagen ma–vr (1–5), van ≤ tot'});
    if(!get('SELECT id FROM locaties WHERE id=?',[loc]))return res.status(400).json({error:'Onbekende locatie'});
    const per=get('SELECT * FROM vakantieperiodes WHERE id=?',[r.periode_id]);
    try{updateMetLog(req,'sport_planning',r.id,{dag_van:dv,dag_tot:dt,locatie_id:loc},'sportrooster');}
    catch(e){return res.status(409).json({error:'Die set staat die dag al op deze locatie ingepland'});}
    const soort=r.soort||soortVan((get('SELECT si.name FROM sport_sets ss JOIN sport_items si ON si.id=ss.item_id WHERE ss.id=?',[r.set_id])||{}).name);
    const sv=per?syncVerhuizen(req,per,soort,r.week):{nieuw:0,weg:0};
    res.json({ok:true,verhuistaken_nieuw:sv.nieuw,verhuistaken_weg:sv.weg});
  });
  app.delete('/api/sportrooster/plan/:id',alleenKantoor,(req,res)=>{
    const r=get('SELECT * FROM sport_planning WHERE id=?',[req.params.id]);if(!r)return res.status(404).json({error:'Niet gevonden'});
    const per=get('SELECT * FROM vakantieperiodes WHERE id=?',[r.periode_id]);
    delMetLog(req,'sport_planning',r.id,'sportrooster');
    const soort=r.soort||soortVan((get('SELECT si.name FROM sport_sets ss JOIN sport_items si ON si.id=ss.item_id WHERE ss.id=?',[r.set_id])||{}).name);
    const sv=per?syncVerhuizen(req,per,soort,r.week):{nieuw:0,weg:0};
    res.json({ok:true,verhuistaken_weg:sv.weg});
  });
  // Voorstel toepassen: de te veel geplande rij (alleen de tekortdagen) wordt een andere sport.
  app.post('/api/sportrooster/toepassen',alleenKantoor,(req,res)=>{
    const b=req.body||{};const r=get('SELECT * FROM sport_planning WHERE id=?',[b.rij_id]);if(!r)return res.status(404).json({error:'Rij niet gevonden'});
    const per=get('SELECT * FROM vakantieperiodes WHERE id=?',[r.periode_id]);const c=laad(per);
    const soort=c.setSoort.get(r.set_id)||r.soort;const v=voorstellen(c,per,soort,r.week).find(x=>x.rij_id===r.id);
    if(!v)return res.status(409).json({error:'Er is geen tekort meer voor deze plek'});
    const alt=String(b.soort||(v.voorstel&&v.voorstel.soort)||'');if(!alt)return res.status(409).json({error:'Geen andere sport vrij voor deze dagen'});
    const dv=v.dag_van,dt=v.dag_tot;
    if(r.dag_van<dv)updateMetLog(req,'sport_planning',r.id,{dag_tot:dv-1},'sportrooster');
    else if(r.dag_tot>dt)updateMetLog(req,'sport_planning',r.id,{dag_van:dt+1},'sportrooster');
    else delMetLog(req,'sport_planning',r.id,'sportrooster');
    syncVerhuizen(req,per,soort,r.week);
    const p=plan(req,per,{soort:alt,week:r.week,locatie_id:r.locatie_id,dag_van:dv,dag_tot:dt});
    if(p.fout)return res.status(p.status).json({error:p.fout});
    res.json({...p,nu:alt});
  });
  // Wie doet de verhuis: een chauffeur of coördinator.
  app.put('/api/sportrooster/verhuis/:taakId',alleenKantoor,(req,res)=>{
    const t=get("SELECT * FROM transport_taken WHERE id=? AND categorie LIKE 'sv:%'",[req.params.taakId]);if(!t)return res.status(404).json({error:'Verhuistaak niet gevonden'});
    const p=get("SELECT id,naam,rol FROM personeel WHERE id=? AND rol IN ('chauffeur','coordinator','kv')",[req.body&&req.body.wie_id]);
    if(!p)return res.status(400).json({error:'Kies een chauffeur of coördinator'});
    updateMetLog(req,'transport_taken',t.id,{wie:p.naam},'sportrooster');
    res.json({ok:true,wie:p.naam});
  });

  app.get('/api/sportrooster/export',alleenKantoor,(req,res)=>{
    const per=periodeVan(req.query.periode_id);if(!per)return res.status(404).json({error:'Geen periode'});
    const c=laad(per);const q=v=>`"${String(v==null?'':v).replace(/"/g,'""')}"`;
    const regels=[['Periode','Week','Sport','Set','Locatie','Dagen'].map(q).join(';')];
    c.rijen.slice().sort((a,b)=>a.week-b.week||a.soort_eff.localeCompare(b.soort_eff,'nl')||a.dag_van-b.dag_van).forEach(r=>
      regels.push([per.naam,r.week,r.soort_eff,(c.setInfo.get(r.set_id)||{}).label||'',r.loc,dagTekst(r.dag_van,r.dag_tot)].map(q).join(';')));
    res.set('Content-Type','text/csv; charset=utf-8').set('Content-Disposition','attachment; filename="sportrooster.csv"').send('﻿'+regels.join('\r\n'));
  });

  app.get('/sportrooster',(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','sportrooster.html')));
};
