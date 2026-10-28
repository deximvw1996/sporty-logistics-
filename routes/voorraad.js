// routes/voorraad.js — uit server.js geknipt (F1 deel 1). Gedrag ongewijzigd.
// Kopjes: VERBRUIKSSTOCK, VOORRAAD NAKIJKEN, VOORRAAD/BESTELLIJST, NAKIJKEN, TEKORTEN PER BAK, TEKORTENDASHBOARD
'use strict';
module.exports = function(ctx){
  const {app,db,get,all,run,ins,saveDb,backupDb,now,isoDate,_genToken,resolveItemTypeId,logAct,vereisRol,alleenKantoor,hashPin,checkSessie,_actieveLocatieConfig,_kvVerwacht,_kvKampmoment,_kvNaam,_bakItems,effectiefMateriaal,ensureGedeeldStock,DATA_DIR,DB_PATH,UPLOADS_DIR,BUNDELS_DIR,FRONTEND_PATH,ROOT_DIR,APP_PASSWORD,PORT,path,fs,express,crypto} = ctx;
  // ── VERBRUIKSSTOCK ──
  app.get('/api/verbruik', (req,res)=>{
    const items = all("SELECT * FROM materiaal_items WHERE tracking='verbruik' ORDER BY cat,name");
    const stock = all('SELECT vs.*, l.name as locatie_name FROM verbruik_stock vs LEFT JOIN locaties l ON l.id=vs.locatie_id');
    const logs = all('SELECT vl.*, l.name as locatie_name FROM verbruik_log vl LEFT JOIN locaties l ON l.id=vl.locatie_id ORDER BY vl.created_at DESC LIMIT 500');
    res.json(items.map(item=>({
      ...item,
      stock: stock.filter(s=>s.item_id===item.id),
      totaal: stock.filter(s=>s.item_id===item.id).reduce((sum,s)=>sum+s.qty,0),
      alarm: stock.filter(s=>s.item_id===item.id).some(s=>s.qty<=s.minimum&&s.minimum>0),
      log: logs.filter(l=>l.item_id===item.id).slice(0,20)
    })));
  });

  // Set/update stock for item at location
  app.post('/api/verbruik/:id/stock', (req,res)=>{
    const{locatie_id,qty,minimum,eenheid}=req.body;
    run('INSERT OR REPLACE INTO verbruik_stock(item_id,locatie_id,qty,minimum,eenheid) VALUES(?,?,?,?,?)',
      [req.params.id,locatie_id,qty??0,minimum??0,eenheid||'stuks']);
    res.json(get('SELECT vs.*,l.name as locatie_name FROM verbruik_stock vs LEFT JOIN locaties l ON l.id=vs.locatie_id WHERE vs.item_id=? AND vs.locatie_id=?',[req.params.id,locatie_id]));
  });


  // ── VOORRAAD NAKIJKEN ──
  app.get('/api/voorraad/nakijken',(req,res)=>{
    const items=all(`
      SELECT bi.*,
        tb.label AS bak_label, tb.code AS bak_code, tb.leeftijdsgroep AS bak_lg,
        t.id AS thema_id, t.name AS thema_naam, t.color AS thema_color,
        (SELECT tijdstip FROM bak_nakijk_log WHERE bak_id=bi.bak_id ORDER BY tijdstip DESC LIMIT 1) AS laatste_nakijk
      FROM bak_items bi
      JOIN thema_bakken tb ON bi.bak_id=tb.id
      JOIN themas t ON tb.thema_id=t.id
      WHERE bi.verbruik=1
      ORDER BY t.name, tb.volgorde, tb.id, bi.id
    `);
    res.json(items);
  });

  // ── VOORRAAD / BESTELLIJST (S2.3) ──
  app.get('/api/voorraad',(req,res)=>{
    const rows=all(`SELECT s.*, it.naam as item_naam, it.eenheid, it.categorie, l.name as locatie_naam
      FROM item_type_stock s JOIN item_types it ON it.id=s.item_type_id JOIN locaties l ON l.id=s.locatie_id
      ORDER BY l.name, it.categorie, it.naam`);
    res.json(rows);
  });
  app.post('/api/voorraad',(req,res)=>{
    const{item_type_id,locatie_id,qty,minimum}=req.body;
    if(!item_type_id||!locatie_id)return res.status(400).json({error:'item_type_id en locatie_id vereist'});
    const cur=get('SELECT * FROM item_type_stock WHERE item_type_id=? AND locatie_id=?',[item_type_id,locatie_id]);
    if(cur){
      run('UPDATE item_type_stock SET qty=?,minimum=? WHERE id=?',[qty??cur.qty,minimum??cur.minimum,cur.id]);
    } else {
      ins('INSERT INTO item_type_stock (item_type_id,locatie_id,qty,minimum) VALUES (?,?,?,?)',[item_type_id,locatie_id,qty||0,minimum||0]);
    }
    res.json(get('SELECT * FROM item_type_stock WHERE item_type_id=? AND locatie_id=?',[item_type_id,locatie_id]));
  });
  app.get('/api/bestellijst',(req,res)=>{
    const rows=all(`SELECT s.*, it.naam as item_naam, it.eenheid, it.categorie, l.name as locatie_naam
      FROM item_type_stock s JOIN item_types it ON it.id=s.item_type_id JOIN locaties l ON l.id=s.locatie_id
      WHERE s.qty < s.minimum ORDER BY l.name, it.naam`);
    res.json(rows);
  });

  // ── NAKIJKEN ──
  // Haal alle open/recente sessies op met bak-info
  app.get('/api/nakijk',(req,res)=>{
    const sessies=all(`SELECT ns.*,
      tb.label as bak_label, tb.code as bak_code, t.name as thema_naam, t.color as thema_color, t.id as thema_id,
      vb.naam as vaste_bak_naam, vb.code as vaste_code,
      l.name as locatie_naam
      FROM nakijk_sessies ns
      LEFT JOIN thema_bakken tb ON tb.id=ns.thema_bak_id
      LEFT JOIN themas t ON t.id=tb.thema_id
      LEFT JOIN vaste_bakken vb ON vb.id=ns.vaste_bak_id
      LEFT JOIN locaties l ON l.id=ns.locatie_id
      ORDER BY ns.id DESC`);
    const regels=all('SELECT * FROM nakijk_regels ORDER BY sessie_id,id');
    res.json(sessies.map(s=>({...s,regels:regels.filter(r=>r.sessie_id===s.id)})));
  });
  // Urgentie: per thema_bak — wanneer is dit thema de komende weken gepland?
  app.get('/api/nakijk/urgentie',(req,res)=>{
    const bakken=all(`SELECT tb.id as bak_id, tb.label, tb.code, t.id as thema_id, t.name as thema_naam, t.color as thema_color,
      tb.leeftijdsgroep,
      MAX(ns.kv_tijdstip) as laatste_check,
      MAX(CASE WHEN ns.kv_status='ingediend' AND ns.kantoor_status='open' THEN 1 ELSE 0 END) as wacht_kantoor
      FROM thema_bakken tb
      JOIN themas t ON t.id=tb.thema_id
      LEFT JOIN nakijk_sessies ns ON ns.thema_bak_id=tb.id
      GROUP BY tb.id ORDER BY t.name,tb.volgorde`);
    const geplande=all(`SELECT DISTINCT kt.thema_id, km.week FROM kampmoment_themas kt JOIN kampmomenten km ON km.id=kt.kampmoment_id WHERE km.week IS NOT NULL ORDER BY km.week`);
    const huidigWeek=(get('SELECT MIN(week) as w FROM kampmomenten WHERE week IS NOT NULL')||{}).w||1;
    const themaBakken=bakken.map(b=>{
      const weken=geplande.filter(g=>g.thema_id===b.thema_id).map(g=>g.week).sort((a,z)=>a-z);
      const eersteVolgendeWeek=weken.find(w=>w>=huidigWeek)||null;
      return {...b,bak_soort:'thema',geplande_weken:weken,eerste_week:eersteVolgendeWeek,is_dringend:eersteVolgendeWeek!=null&&eersteVolgendeWeek<=huidigWeek+1};
    });
    // Vaste bakken: geen urgentie berekening, altijd zichtbaar
    const vasteBakken=all(`SELECT vb.id as bak_id, vb.naam as label, vb.code, vb.type, vb.notities,
      MAX(ns.kv_tijdstip) as laatste_check,
      MAX(CASE WHEN ns.kv_status='ingediend' AND ns.kantoor_status='open' THEN 1 ELSE 0 END) as wacht_kantoor
      FROM vaste_bakken vb
      LEFT JOIN nakijk_sessies ns ON ns.vaste_bak_id=vb.id
      GROUP BY vb.id ORDER BY vb.volgorde,vb.id`).map(b=>({...b,bak_soort:'vast',thema_naam:'Vaste bakken',thema_color:'#6B7280',is_dringend:false,geplande_weken:[],eerste_week:null}));
    res.json([...themaBakken,...vasteBakken]);
  });
  // Start een nieuwe nakijksessie voor een thema-bak
  app.post('/api/nakijk/start',(req,res)=>{
    const{bak_type,thema_bak_id,vaste_bak_id,sport_item_id,locatie_id,week,kv_wie}=req.body;
    const sessieId=ins(`INSERT INTO nakijk_sessies (bak_type,thema_bak_id,vaste_bak_id,sport_item_id,locatie_id,week,datum,kv_wie,kv_status,kantoor_status)
      VALUES (?,?,?,?,?,?,?,?,'open','open')`,[bak_type||'thema',thema_bak_id||null,vaste_bak_id||null,sport_item_id||null,locatie_id||null,week||null,now(),kv_wie||'']);
    // Auto-vul regels vanuit bak_items of vaste_bak_items
    if(thema_bak_id){
      const items=all('SELECT * FROM bak_items WHERE bak_id=? ORDER BY verbruik,id',[thema_bak_id]);
      items.forEach(i=>ins('INSERT INTO nakijk_regels (sessie_id,item_naam,item_id,verwacht) VALUES (?,?,?,?)',[sessieId,i.naam,i.id,i.qty]));
    } else if(vaste_bak_id){
      const items=all('SELECT * FROM vaste_bak_items WHERE bak_id=? ORDER BY volgorde,id',[vaste_bak_id]);
      items.forEach(i=>ins('INSERT INTO nakijk_regels (sessie_id,item_naam,item_id,verwacht) VALUES (?,?,?,?)',[sessieId,i.naam,i.id,i.qty]));
    }
    res.json({sessie_id:sessieId,regels:all('SELECT * FROM nakijk_regels WHERE sessie_id=?',[sessieId])});
  });
  // KV dient nakijk in
  app.put('/api/nakijk/:id/kv',(req,res)=>{
    const{kv_wie,regels,notities}=req.body;
    run('UPDATE nakijk_sessies SET kv_wie=?,kv_tijdstip=?,kv_status=?,notities=? WHERE id=?',[kv_wie||'',now(),'ingediend',notities||'',req.params.id]);
    if(Array.isArray(regels)){
      regels.forEach(r=>{
        const ontbreekt=Math.max(0,(r.verwacht||0)-(r.aangetroffen||0));
        run('UPDATE nakijk_regels SET aangetroffen=?,ontbreekt=?,is_kapot=?,opmerking=? WHERE id=? AND sessie_id=?',
          [r.aangetroffen||0,ontbreekt,r.is_kapot?1:0,r.opmerking||'',r.id,req.params.id]);
      });
      // Update qty_stock in bak_items voor thema-bak items
      regels.forEach(r=>{if(r.item_id&&r.aangetroffen!=null)run('UPDATE bak_items SET qty_stock=? WHERE id=?',[r.aangetroffen,r.item_id]);});
    }
    res.json({ok:true});
  });
  // Kantoor verwerkt nakijk
  app.put('/api/nakijk/:id/kantoor',(req,res)=>{
    const{kantoor_wie,regels,kantoor_status}=req.body;
    run('UPDATE nakijk_sessies SET kantoor_wie=?,kantoor_tijdstip=?,kantoor_status=? WHERE id=?',[kantoor_wie||'',now(),kantoor_status||'nagekeken',req.params.id]);
    if(Array.isArray(regels)){
      regels.forEach(r=>{run('UPDATE nakijk_regels SET besteld=?,opmerking=? WHERE id=? AND sessie_id=?',[r.besteld?1:0,r.opmerking||'',r.id,req.params.id]);});
    }
    res.json({ok:true});
  });
  app.delete('/api/nakijk/:id',(req,res)=>{
    run('DELETE FROM nakijk_sessies WHERE id=?',[req.params.id]);
    res.json({ok:true});
  });

  // ── S3.7: KANTOOR — TEKORTEN PER BAK ──
  // Werkscherm op ingediende KV-controles (kv_status='ingediend'): per bak de tekorten
  // (aangetroffen < verwacht) en kapot-markeringen, gegroepeerd zoals in het magazijn.
  // nakijk_sessies heeft geen kampmoment_id (ouder ontwerp, denormaliseert locatie_id+week
  // rechtstreeks) — kampmoment wordt hier afgeleid via de UNIQUE(locatie_id,week)-combinatie.
  app.get('/api/nakijk-tekorten',(req,res)=>{
    const sessies=all("SELECT * FROM nakijk_sessies WHERE kv_status='ingediend' ORDER BY kv_tijdstip DESC");
    const regels=all('SELECT * FROM nakijk_regels');
    const out=sessies.map(s=>{
      const bak=s.thema_bak_id?get('SELECT * FROM bakken WHERE id=?',[s.thema_bak_id]):null;
      const km=(s.locatie_id&&s.week)?get('SELECT * FROM kampmomenten WHERE locatie_id=? AND week=?',[s.locatie_id,s.week]):null;
      const loc=s.locatie_id?get('SELECT name FROM locaties WHERE id=?',[s.locatie_id]):null;
      const sRegels=regels.filter(r=>r.sessie_id===s.id).map(r=>{
        const bakItem=r.item_id?get('SELECT item_type_id FROM bak_items WHERE id=?',[r.item_id]):null;
        return {...r,item_type_id:bakItem?bakItem.item_type_id:null};
      });
      // S6.1: een tekortregel telt als "open" zolang hij niet aangevuld of genegeerd is —
      // 'besteld' (wacht op levering) blijft dus zichtbaar in tekorten, met tekort_status erbij
      // zodat de UI het onderscheid kan tonen.
      const tekorten=sRegels.filter(r=>(r.aangetroffen||0)<(r.verwacht||0)&&!['aangevuld','genegeerd'].includes(r.tekort_status));
      const kapotMeldingen=sRegels.filter(r=>r.is_kapot);
      return {
        ...s,
        bak_naam:bak?bak.naam:'',
        bak_code:bak?bak.code:'',
        bak_thuislocatie_id:bak?bak.thuislocatie_id:null,
        kampmoment_id:km?km.id:null,
        kampmoment_week:km?km.week:s.week,
        locatie_naam:loc?loc.name:'',
        regels:sRegels,
        tekorten,
        kapot_meldingen:kapotMeldingen,
      };
    });
    res.json(out);
  });
  // Aantal open controles voor de Materiaal-navbadge (ingediend, nog niet kantoor_status='verwerkt')
  app.get('/api/nakijk-tekorten/aantal-open',(req,res)=>{
    const n=get("SELECT COUNT(*) as n FROM nakijk_sessies WHERE kv_status='ingediend' AND kantoor_status!='verwerkt'").n;
    res.json({aantal:n});
  });
  // "✔ Aangevuld": vinkt de regel af EN boekt de aangevulde hoeveelheid af van item_type_stock
  // op de thuislocatie van de bak. Bestaat er geen voorraadrij, dan meldt dit dat expliciet
  // i.p.v. stil niets te doen (zie MASTERPLAN S3.7) — de UI biedt dan de knop hieronder aan.
  app.post('/api/nakijk-regels/:id/aanvullen',(req,res)=>{
    const aangevuld=Math.max(0,parseFloat(req.body?.aangevuld)||0);
    const regel=get('SELECT * FROM nakijk_regels WHERE id=?',[req.params.id]);
    if(!regel)return res.status(404).json({error:'Regel niet gevonden'});
    const sessie=get('SELECT * FROM nakijk_sessies WHERE id=?',[regel.sessie_id]);
    const bak=sessie&&sessie.thema_bak_id?get('SELECT * FROM bakken WHERE id=?',[sessie.thema_bak_id]):null;
    const bakItem=regel.item_id?get('SELECT * FROM bak_items WHERE id=?',[regel.item_id]):null;
    const itemTypeId=bakItem?bakItem.item_type_id:null;
    if(!itemTypeId)return res.status(400).json({error:'Geen catalogus-item gekoppeld aan dit item — kan voorraad niet afboeken.'});
    if(!bak||!bak.thuislocatie_id)return res.status(400).json({error:'Deze bak heeft geen thuislocatie ingesteld — kan voorraad niet afboeken.'});
    const stockRow=get('SELECT * FROM item_type_stock WHERE item_type_id=? AND locatie_id=?',[itemTypeId,bak.thuislocatie_id]);
    if(!stockRow)return res.status(400).json({error:`Geen voorraadrij voor "${bakItem.naam}" op de thuislocatie van deze bak — maak eerst een voorraadregel aan in Materiaal › Voorraad.`,item_type_id:itemTypeId,locatie_id:bak.thuislocatie_id,kan_aanmaken:true});
    const voorraad_voor=stockRow.qty;
    const voorraad_na=Math.max(0,voorraad_voor-aangevuld);
    run('UPDATE item_type_stock SET qty=? WHERE id=?',[voorraad_na,stockRow.id]);
    run("UPDATE nakijk_regels SET besteld=1,tekort_status='aangevuld' WHERE id=?",[regel.id]);
    res.json({ok:true,voorraad_voor,voorraad_na,regel:get('SELECT * FROM nakijk_regels WHERE id=?',[regel.id])});
  });
  // S6.1(b): maak de ontbrekende voorraadrij aan (qty 0, minimum 0) zodat de UI meteen daarna
  // opnieuw "aanvullen" kan proberen — voorkomt de omweg via Materiaal › Voorraad.
  app.post('/api/nakijk-regels/:id/voorraadrij-aanmaken',(req,res)=>{
    const regel=get('SELECT * FROM nakijk_regels WHERE id=?',[req.params.id]);
    if(!regel)return res.status(404).json({error:'Regel niet gevonden'});
    const sessie=get('SELECT * FROM nakijk_sessies WHERE id=?',[regel.sessie_id]);
    const bak=sessie&&sessie.thema_bak_id?get('SELECT * FROM bakken WHERE id=?',[sessie.thema_bak_id]):null;
    const bakItem=regel.item_id?get('SELECT * FROM bak_items WHERE id=?',[regel.item_id]):null;
    const itemTypeId=bakItem?bakItem.item_type_id:null;
    if(!itemTypeId)return res.status(400).json({error:'Geen catalogus-item gekoppeld aan dit item.'});
    if(!bak||!bak.thuislocatie_id)return res.status(400).json({error:'Deze bak heeft geen thuislocatie ingesteld.'});
    const bestaand=get('SELECT * FROM item_type_stock WHERE item_type_id=? AND locatie_id=?',[itemTypeId,bak.thuislocatie_id]);
    if(bestaand)return res.json(bestaand);
    const id=ins('INSERT INTO item_type_stock (item_type_id,locatie_id,qty,minimum) VALUES (?,?,0,0)',[itemTypeId,bak.thuislocatie_id]);
    res.json(get('SELECT * FROM item_type_stock WHERE id=?',[id]));
  });
  // S6.1(a): kantoor markeert een tekortregel als "besteld, wacht op levering" — nog niet
  // aangevuld/afgeboekt, maar wel uit de "nog te behandelen"-lijst zodra de sessie afgesloten wordt.
  app.post('/api/nakijk-regels/:id/besteld',(req,res)=>{
    const regel=get('SELECT * FROM nakijk_regels WHERE id=?',[req.params.id]);
    if(!regel)return res.status(404).json({error:'Regel niet gevonden'});
    run("UPDATE nakijk_regels SET tekort_status='besteld' WHERE id=?",[regel.id]);
    res.json(get('SELECT * FROM nakijk_regels WHERE id=?',[regel.id]));
  });
  // Negeren: kantoor beslist bewust dit tekort niet aan te vullen (bv. item vervalt).
  app.post('/api/nakijk-regels/:id/genegeerd',(req,res)=>{
    const regel=get('SELECT * FROM nakijk_regels WHERE id=?',[req.params.id]);
    if(!regel)return res.status(404).json({error:'Regel niet gevonden'});
    run("UPDATE nakijk_regels SET tekort_status='genegeerd' WHERE id=?",[regel.id]);
    res.json(get('SELECT * FROM nakijk_regels WHERE id=?',[regel.id]));
  });
  // Markeer een controle als volledig verwerkt (alle tekorten aangevuld / kapot-meldingen bekeken).
  // S6.1(c): mag pas als élke tekortregel aangevuld OF expliciet besteld/genegeerd is.
  app.put('/api/nakijk-sessies/:id/verwerkt',(req,res)=>{
    const sessie=get('SELECT * FROM nakijk_sessies WHERE id=?',[req.params.id]);
    if(!sessie)return res.status(404).json({error:'Sessie niet gevonden'});
    const regels=all('SELECT * FROM nakijk_regels WHERE sessie_id=?',[req.params.id]);
    const openTekorten=regels.filter(r=>(r.aangetroffen||0)<(r.verwacht||0)&&!['aangevuld','genegeerd','besteld'].includes(r.tekort_status));
    if(openTekorten.length)return res.status(400).json({error:`Nog ${openTekorten.length} tekortregel(s) niet aangevuld, besteld of genegeerd: ${openTekorten.map(r=>r.item_naam).join(', ')}`});
    const behandelaar=(req.persoon&&req.persoon.naam)||'';
    run("UPDATE nakijk_sessies SET kantoor_status='verwerkt',kantoor_wie=?,kantoor_tijdstip=? WHERE id=?",[behandelaar,now(),req.params.id]);
    res.json(get('SELECT * FROM nakijk_sessies WHERE id=?',[req.params.id]));
  });

  // ── S6.2: KANTOOR-TEKORTENDASHBOARD — alle open tekorten geaggregeerd per item_type,
  // over alle ingediende sessies (ongeacht kantoor_status), met voorraadstand/minimum en
  // per-bak/locatie-herkomst uitklapbaar. "Thema al gebruikt" = er bestaat al een nakijk_sessie
  // voor een thema_bak van dat thema (los van de huidige sessie) → KV-data is startpunt.
  app.get('/api/tekorten-dashboard',(req,res)=>{
    const sessies=all("SELECT * FROM nakijk_sessies WHERE kv_status='ingediend'");
    const regels=all('SELECT * FROM nakijk_regels');
    const perType={};
    sessies.forEach(s=>{
      const bak=s.thema_bak_id?get('SELECT * FROM bakken WHERE id=?',[s.thema_bak_id]):null;
      const loc=s.locatie_id?get('SELECT name FROM locaties WHERE id=?',[s.locatie_id]):null;
      const themaId=bak?(get('SELECT thema_id FROM thema_bak WHERE bak_id=?',[bak.id])||{}).thema_id:null;
      const thema=themaId?get('SELECT * FROM themas WHERE id=?',[themaId]):null;
      regels.filter(r=>r.sessie_id===s.id).forEach(r=>{
        const tekort=(r.verwacht||0)-(r.aangetroffen||0);
        if(tekort<=0)return;
        if(['aangevuld','genegeerd'].includes(r.tekort_status))return;
        const bakItem=r.item_id?get('SELECT item_type_id FROM bak_items WHERE id=?',[r.item_id]):null;
        const itemTypeId=bakItem?bakItem.item_type_id:null;
        const key=itemTypeId||('naam:'+r.item_naam);
        if(!perType[key]){
          const it=itemTypeId?get('SELECT * FROM item_types WHERE id=?',[itemTypeId]):null;
          perType[key]={
            item_type_id:itemTypeId, item_naam:it?it.naam:r.item_naam,
            totaal_tekort:0, bestel_status:'open', herkomst:[], thema_signalen:new Set(),
          };
        }
        perType[key].totaal_tekort+=tekort;
        if(r.tekort_status==='besteld'&&perType[key].bestel_status==='open')perType[key].bestel_status='besteld';
        perType[key].herkomst.push({
          sessie_id:s.id, regel_id:r.id, bak_naam:bak?bak.naam:'', bak_code:bak?bak.code:'',
          locatie_naam:loc?loc.name:'', week:s.week, tekort, tekort_status:r.tekort_status,
        });
        if(thema){
          // "thema al gebruikt": bestaan er nog andere (afgeronde) sessies voor ditzelfde thema?
          const anderTellingen=(get(`SELECT COUNT(*) as n FROM nakijk_sessies ns2 JOIN thema_bak tb2 ON tb2.bak_id=ns2.thema_bak_id
            WHERE tb2.thema_id=? AND ns2.id!=?`,[themaId,s.id])||{}).n||0;
          if(anderTellingen>0)perType[key].thema_signalen.add(thema.name);
        }
      });
    });
    const stockPerType={};
    all('SELECT item_type_id,SUM(qty) AS qty,SUM(minimum) AS minimum FROM item_type_stock GROUP BY item_type_id')
      .forEach(r=>{stockPerType[r.item_type_id]={qty:r.qty||0,minimum:r.minimum||0};});
    const out=Object.values(perType).map(v=>({
      item_type_id:v.item_type_id,
      item_naam:v.item_naam,
      totaal_tekort:v.totaal_tekort,
      voorraadstand:v.item_type_id?(stockPerType[v.item_type_id]?.qty||0):null,
      minimum:v.item_type_id?(stockPerType[v.item_type_id]?.minimum||0):null,
      bestel_status:v.bestel_status,
      herkomst:v.herkomst,
      thema_al_gebruikt:[...v.thema_signalen],
    })).sort((a,b)=>b.totaal_tekort-a.totaal_tekort);
    res.json(out);
  });

};
