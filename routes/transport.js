// routes/transport.js — uit server.js geknipt (F1 deel 1). Gedrag ongewijzigd.
// Kopjes: TRANSPORT, TRANSPORT RITTEN, VOERTUIGTYPES, VERHUIS CHECKS, chauffeurspagina vink-fases, TERUGKOMST, SPOEDTRANSPORT, CHAUFFEUR-VIEW, VOERTUIGBEZETTING, RETOUR STATUS
'use strict';
module.exports = function(ctx){
  const {app,db,get,all,run,ins,saveDb,backupDb,now,isoDate,_genToken,resolveItemTypeId,logAct,logWijziging,insMetLog,updateMetLog,delMetLog,vereisRol,alleenKantoor,hashPin,checkSessie,_actieveLocatieConfig,_kvVerwacht,_kvKampmoment,_kvNaam,_bakItems,effectiefMateriaal,ensureGedeeldStock,DATA_DIR,DB_PATH,UPLOADS_DIR,BUNDELS_DIR,FRONTEND_PATH,ROOT_DIR,APP_PASSWORD,PORT,path,fs,express,crypto} = ctx;
  const bulk=require('../lib/bulk')(ctx); // V3a punt 1
  // ── TRANSPORT ──
  app.get('/api/transport-taken',(req,res)=>{const taken=all('SELECT * FROM transport_taken ORDER BY datum,tijd');const regels=all('SELECT * FROM transport_regels');res.json(taken.map(t=>({...t,regels:regels.filter(r=>r.taak_id===t.id)})));});
  app.post('/api/transport-genereer',(req,res)=>{
    // v1: themadag-kampmomenten worden door deze generator overgeslagen voor
    // basis/thema-materiaal. Hun transport gaat handmatig via de transport-planner.
    // Sport-sets blijven wel werken (per locatie+week, niet per kampmoment-type).
    const kms=all('SELECT * FROM kampmomenten ORDER BY locatie_id, week');
    const locs=all('SELECT * FROM locaties');
    const themas=all('SELECT * FROM themas');
    // S2.6: chauffeur ziet bakken, geen inhoud. Eén transport_regel per BAK of ATTRIBUUT
    // die aan het thema gekoppeld is (niet meer per item). Van-locatie = de eigen
    // thuislocatie_id van de bak/het attribuut (niet meer hardcoded op naam).
    const themaBakken=all(`SELECT b.id AS bak_id, b.naam, b.code, b.thuislocatie_id, tb.thema_id
      FROM bakken b JOIN thema_bak tb ON tb.bak_id=b.id WHERE b.soort='thema'`);
    const themaAttrRegels=all(`SELECT a.id AS attr_id, a.naam, a.code, a.thuislocatie_id, ta.thema_id
      FROM attributen a JOIN thema_attribuut ta ON ta.attribuut_id=a.id`);
    const allLocMat=all('SELECT * FROM locatie_materiaal');
    const standaard=all('SELECT * FROM standaard_materiaal');
    const kts=all('SELECT * FROM kampmoment_themas');
    const kalDagen=all('SELECT * FROM kalender_dagen');
    const gelotenDagen=all('SELECT * FROM gesloten_dagen').map(g=>g.datum);
    const allKleuren=all('SELECT * FROM locatie_kleuren');
    const stockage=locs.filter(l=>l.type==='stockage');
    // Enkel top-level stockageplaatsen komen in aanmerking (sub-locaties zoals RGA-RGF,
    // Boven/Beneden/Naschoolse zijn kamers/codes BINNEN Kantoor of Rozenweg, geen aparte
    // ophaal-/leverbestemming op zich).
    const stockageTopLevel=stockage.filter(l=>!l.parent_id);

    // Typed stockage: basis/sport → Kantoor, alles met een code (themabakken/attributen) → Rozenweg.
    // Naam-match eerst (expliciete regel), stockage_rol als terugval voor toekomstige locaties.
    const sportStockageId=stockageTopLevel.find(l=>l.name==='Kantoor')?.id
      ||stockageTopLevel.find(l=>l.stockage_rol==='sport'||l.stockage_rol==='beide')?.id||stockageTopLevel[0]?.id||null;
    const themaStockageId=stockageTopLevel.find(l=>l.name==='Rozenweg')?.id
      ||stockageTopLevel.find(l=>l.stockage_rol==='thema'||l.stockage_rol==='beide')?.id||stockageTopLevel[0]?.id||null;

    const allPeriodes=all('SELECT * FROM vakantieperiodes');
    const defaultPeriode=allPeriodes[0]||{id:1,start_datum:'2026-06-29',eind_datum:'2026-09-06'};
    const voorstellen=[];

    // S4.5d: themabehoefte aan pool-materiaal (zoals locConfigRegels, maar thema-gedreven i.p.v.
    // locatie-gedreven — zelfde kiesmechanisme: vrije exemplaren status='thuis' bij levering,
    // 'op_locatie'-exemplaren (fallback 'thuis') bij ophaling). Springkasteel/waterstructuur ⇒
    // automatisch de blazers_nodig van het GEKOZEN exemplaar erbij + 1 verlengdraadkoffer per
    // levering (L18c: 1 per levering/locatie, ook bij meerdere springkastelen).
    function _themaBehoefteRegels(km,kmThemasSubset,terugnemen){
      const themaIds=[...new Set(kmThemasSubset.map(kt=>kt.thema_id))];
      if(!themaIds.length)return [];
      const ph=themaIds.map(()=>'?').join(',');
      const behoefte=all(`SELECT * FROM thema_behoefte WHERE thema_id IN (${ph})`,themaIds);
      const regels=[];
      let verlengdraadNodig=false;
      const gebruikteBlazerIds=new Set(); // voorkomt dat dezelfde fysieke blazer 2x wordt ingepland (unieke pool-tak)
      // S4.5g: bulk-materiaal krijgt EEN regel "N × naam" i.p.v. N losse "Bak naam"-regels — het
      // aantal komt uit thema_behoefte, beschikbaarheid uit bulk_spreiding (per locatie). Dit is
      // een PREVIEW (read-only): de spreiding zelf wordt pas bijgewerkt als de taak op 'gedaan'
      // gezet wordt (PUT /api/transport-taken/:id/status), analoog aan hoe unieke bakken hun
      // huidige_locatie_id ook pas dán krijgen — niet al bij het genereren van voorstellen.
      const _blazerReserve={}; // in-memory cache binnen 1 aanroep, voorkomt dubbele toewijzing
      function _bulkBeschikbaar(bakId,locatieId,useReserve){
        if(!useReserve){
          const rij=get('SELECT aantal FROM bulk_spreiding WHERE bak_id=? AND locatie_id=?',[bakId,locatieId]);
          return rij?rij.aantal:0;
        }
        const key=bakId+'@'+locatieId;
        if(!(key in _blazerReserve)){
          const rij=get('SELECT aantal FROM bulk_spreiding WHERE bak_id=? AND locatie_id=?',[bakId,locatieId]);
          _blazerReserve[key]=rij?rij.aantal:0;
        }
        return _blazerReserve[key];
      }
      function _bulkPreviewRegel(bak,aantalNodig,useReserve){
        let bronLoc=terugnemen?km.locatie_id:(bak.thuislocatie_id||sportStockageId);
        let beschikbaar=_bulkBeschikbaar(bak.id,bronLoc,useReserve);
        // Reviewfix-patroon (analoog S5.1 bij unieke exemplaren): bij "vooraf plannen" staat er
        // op de kamplocatie nog niets (de levering is nog niet 'gedaan' gezet) — val dan terug op
        // de thuislocatie-voorraad, anders ontbreekt de eind-ophaling in de preview.
        if(terugnemen&&beschikbaar<=0){
          bronLoc=bak.thuislocatie_id||sportStockageId;
          beschikbaar=_bulkBeschikbaar(bak.id,bronLoc,useReserve);
        }
        const n=Math.max(0,Math.min(aantalNodig,beschikbaar));
        if(n<=0)return null;
        if(useReserve)_blazerReserve[bak.id+'@'+bronLoc]-=n;
        return {naam:`${n} × ${bak.naam}`,qty:n,soort:'vast',stockage_id:bak.thuislocatie_id||sportStockageId,bak_id:bak.id};
      }
      // Blazers "zwaarste eerst": eerst 1500W opmaken, dan 1000W (S4.5g-opdracht).
      function _blazerRegels(nBlazers){
        const uit=[];let resterend=nBlazers;
        ['Blazer 1500W','Blazer 1000W'].forEach(naam=>{
          if(resterend<=0)return;
          const bak=get("SELECT * FROM bakken WHERE soort='vast' AND vast_type='blazer' AND naam=? AND is_bulk=1",[naam]);
          if(!bak)return;
          const r=_bulkPreviewRegel(bak,resterend,true);
          if(r){ uit.push(r); resterend-=r.qty; }
        });
        return uit;
      }
      behoefte.forEach(b=>{
        // Walkthrough-fix Maxim 2026-08-04: behoefte kan een SPECIFIEK exemplaar aanwijzen
        // (bak_id, bv. "Klein springkasteel - jungle") i.p.v. een generiek vast_type.
        if(b.bak_id){
          const spec=get("SELECT * FROM bakken WHERE id=? AND soort='vast'",[b.bak_id]);
          if(spec){
            if(spec.is_bulk){
              const r=_bulkPreviewRegel(spec,b.aantal||1,false);
              if(r)regels.push(r);
            } else {
              regels.push({naam:'Bak '+spec.naam+(spec.code?' ('+spec.code+')':''),qty:1,soort:'vast',stockage_id:spec.thuislocatie_id||sportStockageId,bak_id:spec.id});
              if(spec.vast_type==='springkasteel'||spec.vast_type==='waterstructuur'){
                verlengdraadNodig=true;
                regels.push(..._blazerRegels(spec.blazers_nodig||1));
              }
            }
            return;
          }
        }
        const bulkBak=get("SELECT * FROM bakken WHERE soort='vast' AND vast_type=? AND is_bulk=1",[b.vast_type]);
        if(bulkBak){
          // Bulk-materiaal is nooit springkasteel/waterstructuur (die blijven per stuk, S4.5d) —
          // dus geen blazer/verlengdraad-bijlevering hier nodig.
          const r=_bulkPreviewRegel(bulkBak,b.aantal||1,false);
          if(r)regels.push(r);
          return;
        }
        let exemplaren;
        if(terugnemen){
          exemplaren=all("SELECT * FROM bakken WHERE soort='vast' AND vast_type=? AND status='op_locatie' AND huidige_locatie_id=? LIMIT ?",[b.vast_type,km.locatie_id,b.aantal||1]);
          if(!exemplaren.length)exemplaren=all("SELECT * FROM bakken WHERE soort='vast' AND vast_type=? AND status='thuis' LIMIT ?",[b.vast_type,b.aantal||1]);
        } else {
          exemplaren=all("SELECT * FROM bakken WHERE soort='vast' AND vast_type=? AND status='thuis' ORDER BY volgorde,id LIMIT ?",[b.vast_type,b.aantal||1]);
        }
        exemplaren.forEach(ex=>{
          regels.push({naam:'Bak '+ex.naam+(ex.code?' ('+ex.code+')':''),qty:1,soort:'vast',stockage_id:ex.thuislocatie_id||sportStockageId,bak_id:ex.id});
          if(ex.vast_type==='springkasteel'||ex.vast_type==='waterstructuur'){
            verlengdraadNodig=true;
            const nBlazers=ex.blazers_nodig||1;
            regels.push(..._blazerRegels(nBlazers));
          }
        });
      });
      if(verlengdraadNodig){
        const vdBak=get("SELECT * FROM bakken WHERE soort='vast' AND vast_type='verlengdraadkoffer' AND is_bulk=1");
        if(vdBak){
          const r=_bulkPreviewRegel(vdBak,1,false);
          if(r)regels.push(r);
        } else {
          // Terugval als Migratie 63 nog niet liep (verlengdraadkoffer nog niet samengevouwen).
          const vd=terugnemen
            ? (()=>{let e=all("SELECT * FROM bakken WHERE soort='vast' AND vast_type='verlengdraadkoffer' AND status='op_locatie' AND huidige_locatie_id=? LIMIT 1",[km.locatie_id]);
                     if(!e.length)e=all("SELECT * FROM bakken WHERE soort='vast' AND vast_type='verlengdraadkoffer' AND status='thuis' LIMIT 1");return e;})()
            : all("SELECT * FROM bakken WHERE soort='vast' AND vast_type='verlengdraadkoffer' AND status='thuis' ORDER BY volgorde,id LIMIT 1");
          vd.forEach(v=>regels.push({naam:'Bak '+v.naam+(v.code?' ('+v.code+')':''),qty:1,soort:'vast',stockage_id:v.thuislocatie_id||sportStockageId,bak_id:v.id}));
        }
      }
      return regels;
    }

    function getOpenDagen(km){
      const periode=allPeriodes.find(p=>p.id===(km.periode_id||1))||defaultPeriode;
      const ws=new Date(periode.start_datum+'T12:00:00');ws.setDate(ws.getDate()+(km.week-1)*7);
      const eind=new Date(periode.eind_datum+'T23:59:59');
      const days=[];
      for(let i=0;i<5;i++){const d=new Date(ws);d.setDate(ws.getDate()+i);if(d>eind)continue;const iso=isoDate(d);if(gelotenDagen.includes(iso))continue;const dr=kalDagen.find(k=>k.locatie_id===km.locatie_id&&k.datum===iso);if(dr?dr.open==1:true)days.push(iso);}
      return days;
    }
    function prevWorkday(iso){const d=new Date(iso);d.setDate(d.getDate()-1);if(d.getDay()===0)d.setDate(d.getDate()-2);if(d.getDay()===6)d.setDate(d.getDate()-1);return isoDate(d);}
    function nextWorkday(iso){const d=new Date(iso);d.setDate(d.getDate()+1);if(d.getDay()===0)d.setDate(d.getDate()+1);if(d.getDay()===6)d.setDate(d.getDate()+2);return isoDate(d);}

    // ── PER LOCATIE: basis + thema transport ──
    const perLocatie={};
    kms.forEach(km=>{if(!perLocatie[km.locatie_id])perLocatie[km.locatie_id]=[];perLocatie[km.locatie_id].push(km);});

    Object.entries(perLocatie).forEach(([locId,kmListAll])=>{
      const loc=locs.find(l=>l.id==locId);if(!loc)return;
      const locMat=(allLocMat.filter(m=>m.locatie_id==locId).length?allLocMat.filter(m=>m.locatie_id==locId):standaard);

      // Filter themadag-kampmomenten weg vóór het itereren — anders breken
      // de prevKm/nextKm contiguïteits-checks (de themadag staat tussen 2 themakampen).
      const kmList=kmListAll.filter(k=>k.type!=='themadag').sort((a,b)=>a.week-b.week);
      // S5.2: basis-materiaal en kleurenborden volgen "periode-bereik per locatie" i.p.v.
      // "aansluitende weken" — enkel de EERSTE open week van de locatie in de periode levert,
      // enkel de LAATSTE haalt op; gap-weken (locatie tijdelijk dicht, later weer open) krijgen
      // GEEN ophaal-/herlevervoorstel — dat materiaal blijft gewoon staan. kleurenStand houdt per
      // kleur bij hoeveel er (cumulatief, enkel toenames) al effectief op de locatie staat, zodat
      // een latere open week alleen het positieve verschil bijgeleverd krijgt (nooit terugname).
      const kleurenOpenWeken=kmList.filter(km=>getOpenDagen(km).length);
      const kleurenStand={};
      kmList.forEach((km,idx)=>{
        const openDagen=getOpenDagen(km);
        if(!openDagen.length)return;
        const kmThemas=kts.filter(kt=>kt.kampmoment_id===km.id);
        const thNamen=kmThemas.map(kt=>themas.find(t=>t.id===kt.thema_id)?.name||'?').join(', ');
        const prevKm=kmList[idx-1];
        const nextKm=kmList[idx+1];
        const isOpvolgend=prevKm&&prevKm.week===km.week-1;
        const heeftOpvolger=nextKm&&nextKm.week===km.week+1;
        // S5.2: periode-bereik i.p.v. aansluitende weken — enkel voor basis/kleurenborden/locatieconfig.
        const idxOpen=kleurenOpenWeken.indexOf(km);
        const isEersteVanPeriode=idxOpen===0;
        const isLaatsteVanPeriode=idxOpen===kleurenOpenWeken.length-1;

        // S2.6: Thema-materiaal = één regel per BAK of ATTRIBUUT (chauffeur ziet bakken, geen inhoud).
        // Van-locatie = de eigen thuislocatie_id van de bak/het attribuut (fallback: themaStockageId).
        const themaMatRegels=kmThemas.flatMap(kt=>{
          const bakRegels=themaBakken.filter(b=>b.thema_id===kt.thema_id).map(b=>({naam:'Bak '+b.naam+(b.code?' ('+b.code+')':''),qty:1,soort:'thema',stockage_id:b.thuislocatie_id||themaStockageId,bak_id:b.bak_id}));
          const attrRegels=themaAttrRegels.filter(a=>a.thema_id===kt.thema_id).map(a=>({naam:'Attribuut '+a.naam+(a.code?' ('+a.code+')':''),qty:1,soort:'attribuut',stockage_id:a.thuislocatie_id||themaStockageId,attribuut_id:a.attr_id}));
          return [...bakRegels,...attrRegels];
        });
        // S5.1 (uitbreiding): een thema dat deze week op deze locatie START doordat het via een
        // directe transfer van een andere locatie komt (vorige week elders) wordt door het
        // "DIRECT THEMA-TRANSFER"-blok geleverd — hier NIET nog eens meesturen als "eerste
        // levering", anders krijg je zowel de transfer als een volledige stockage-levering voor
        // dezelfde bakken bij een locatie die voor het eerst in de kmList opduikt.
        const kmThemasNietViaDirecteTransfer=kmThemas.filter(kt=>{
          const komtDirectVanAndereLocatie=kts.some(kt2=>kt2.thema_id===kt.thema_id&&kt2.kampmoment_id!==km.id&&
            (()=>{const km2=kms.find(k=>k.id===kt2.kampmoment_id);return km2&&km2.week===km.week-1&&km2.locatie_id!==km.locatie_id;})());
          return !komtDirectVanAndereLocatie;
        });
        const themaMatRegelsEersteLevering=kmThemasNietViaDirecteTransfer.flatMap(kt=>{
          const bakRegels=themaBakken.filter(b=>b.thema_id===kt.thema_id).map(b=>({naam:'Bak '+b.naam+(b.code?' ('+b.code+')':''),qty:1,soort:'thema',stockage_id:b.thuislocatie_id||themaStockageId,bak_id:b.bak_id}));
          const attrRegels=themaAttrRegels.filter(a=>a.thema_id===kt.thema_id).map(a=>({naam:'Attribuut '+a.naam+(a.code?' ('+a.code+')':''),qty:1,soort:'attribuut',stockage_id:a.thuislocatie_id||themaStockageId,attribuut_id:a.attr_id}));
          return [...bakRegels,...attrRegels];
        });
        // Locatieconfig-exemplaren (S2.5/S2.6): bij de eerste levering van dit kampmoment de
        // vereiste vaste exemplaren (EHBO-koffer, adminkast...) meenemen als eigen transport_regel.
        const locConfigRegels=(isEersteVanPeriode)?_actieveLocatieConfig(km).flatMap(cfg=>{
          const vrij=all("SELECT * FROM bakken WHERE soort='vast' AND vast_type=? AND status='thuis' ORDER BY volgorde,id LIMIT ?",[cfg.vast_type,cfg.aantal||1]);
          return vrij.map(b=>({naam:'Bak '+b.naam+(b.code?' ('+b.code+')':''),qty:1,soort:'vast',stockage_id:b.thuislocatie_id||sportStockageId,bak_id:b.id}));
        }):[];
        // S4.5d: themabehoefte-exemplaren (springkasteel, verkeerskoffer, kookuitrusting...) bij de
        // eerste levering van dit kampmoment — zelfde timing als locConfigRegels.
        const themaBehoefteRegels=_themaBehoefteRegels(km,kmThemas,false);
        // Basis-materiaal met per-item stockage (fallback: sportStockageId)
        const basisRegels=locMat.map(m=>({naam:m.name,qty:m.qty,soort:'basis',stockage_id:m.stockage_locatie_id||sportStockageId}));

        // Groepeer regels per stockage-locatie en push één transport per groep
        function byStockage(regels){const g={};regels.forEach(r=>{if(!r.stockage_id)return;const k=r.stockage_id;if(!g[k])g[k]=[];g[k].push(r);});return g;}

        const prevD=prevWorkday(openDagen[0]);
        // Kleurenborden voor deze locatie+week: eerste open week van de periode = volledige
        // levering; latere open weken (aansluitend of na een gap) = enkel het positieve verschil
        // t.o.v. wat al staat (kleurenStand); nooit tussentijds terughalen.
        const kleurenHuidig=allKleuren.filter(k=>k.locatie_id==loc.id&&k.week===km.week);
        let kleurenRegels=[];
        if(isEersteVanPeriode){
          kleurenRegels=kleurenHuidig.map(k=>({naam:`Kleurenbord ${k.kleur} ×${k.aantal}`,qty:k.aantal,soort:'basis',stockage_id:sportStockageId}));
          kleurenHuidig.forEach(k=>{kleurenStand[k.kleur]=k.aantal;});
        } else {
          kleurenHuidig.forEach(k=>{
            const stand=kleurenStand[k.kleur]||0;
            const extra=k.aantal-stand;
            if(extra>0){
              kleurenRegels.push({naam:`Kleurenbord ${k.kleur} ×${extra} (bijlevering, staat al ${stand})`,qty:extra,soort:'basis',stockage_id:sportStockageId});
              kleurenStand[k.kleur]=k.aantal;
            }
          });
        }
        if(isEersteVanPeriode){
          // Eerste open week van de locatie in de periode: lever basis-materiaal + locatieconfig per stockage-groep
          const basisPlusKleuren=[...basisRegels,...kleurenRegels];
          Object.entries(byStockage(basisPlusKleuren)).forEach(([sid,mat])=>{
            const sLoc=locs.find(l=>l.id==sid);
            voorstellen.push({type:'levering',kampmoment_id:km.id,week:km.week,locatie:loc.name,locatie_id:loc.id,van_locatie_id:parseInt(sid),datum:prevD,tijd:'08:00',open_dagen:openDagen,materiaal:mat,opmerking:'Levering basis week '+km.week+' — '+loc.name+(sLoc?' (van '+sLoc.name+')':'')});
          });
        } else if(kleurenRegels.length){
          // Gap-week/latere open week: enkel het kleurenverschil bijleveren, geen basis-materiaal.
          Object.entries(byStockage(kleurenRegels)).forEach(([sid,mat])=>{
            const sLoc=locs.find(l=>l.id==sid);
            voorstellen.push({type:'levering',kampmoment_id:km.id,week:km.week,locatie:loc.name,locatie_id:loc.id,van_locatie_id:parseInt(sid),datum:prevD,tijd:'08:00',open_dagen:openDagen,materiaal:mat,opmerking:'Bijlevering kleurenverschil week '+km.week+' — '+loc.name});
          });
        }
        if(!isOpvolgend){
          Object.entries(byStockage([...themaMatRegelsEersteLevering,...locConfigRegels,...themaBehoefteRegels])).forEach(([sid,mat])=>{
            const sLoc=locs.find(l=>l.id==sid);
            voorstellen.push({type:'levering',kampmoment_id:km.id,week:km.week,locatie:loc.name,locatie_id:loc.id,van_locatie_id:parseInt(sid),datum:prevD,tijd:'09:00',open_dagen:openDagen,materiaal:mat,opmerking:'Levering thema week '+km.week+' — '+loc.name+' ('+thNamen+(sLoc?', van '+sLoc.name:'')+')'});
          });
        } else {
          // Opvolgende week: thema-wissel per stockage-groep
          const prevKmThemas=kts.filter(kt=>kt.kampmoment_id===prevKm.id);
          const prevThIds=new Set(prevKmThemas.map(kt=>kt.thema_id));
          const newThIds=new Set(kmThemas.map(kt=>kt.thema_id));
          const vertrekkendeAll=prevKmThemas.filter(kt=>!newThIds.has(kt.thema_id));
          const aankomende=kmThemas.filter(kt=>!prevThIds.has(kt.thema_id));

          // Aankomende thema's die direct van een andere locatie komen (A→B consecutive)
          // worden afgehandeld door het "DIRECT THEMA-TRANSFER" blok → hier overslaan.
          const aankomendeViaStockage=aankomende.filter(kt=>{
            const kwamVanAndereLocatie=kts.some(kt2=>kt2.thema_id===kt.thema_id&&kt2.kampmoment_id!==km.id&&
              (()=>{const km2=kms.find(k=>k.id===kt2.kampmoment_id);return km2&&km2.week===km.week-1&&km2.locatie_id!==km.locatie_id;})());
            return !kwamVanAndereLocatie;
          });
          // S5.1: symmetrische fix — een VERTREKKEND thema waarvoor een directe transfer bestaat
          // (zelfde thema, volgende week km.week, andere locatie) wordt hier NIET meer als
          // wissel-ophaling opgevoerd — dat wordt al door het "DIRECT THEMA-TRANSFER" blok gedaan.
          // Zonder deze filter kreeg je zowel de directe transfer als deze ophaling voor
          // dezelfde bakken (simulatie-bevinding 1). Eén thema-verplaatsing = precies één voorstel.
          const vertrekkende=vertrekkendeAll.filter(kt=>{
            const gaatDirectNaarAndereLocatie=kts.some(kt2=>kt2.thema_id===kt.thema_id&&kt2.kampmoment_id!==prevKm.id&&
              (()=>{const km2=kms.find(k=>k.id===kt2.kampmoment_id);return km2&&km2.week===prevKm.week+1&&km2.locatie_id!==prevKm.locatie_id;})());
            return !gaatDirectNaarAndereLocatie;
          });
          if(vertrekkende.length||aankomendeViaStockage.length){
            const ophaalMat=vertrekkende.flatMap(kt=>[
              ...themaBakken.filter(b=>b.thema_id===kt.thema_id).map(b=>({naam:'Bak '+b.naam+(b.code?' ('+b.code+')':''),qty:1,soort:'thema',stockage_id:b.thuislocatie_id||themaStockageId,bak_id:b.bak_id})),
              ...themaAttrRegels.filter(a=>a.thema_id===kt.thema_id).map(a=>({naam:'Attribuut '+a.naam+(a.code?' ('+a.code+')':''),qty:1,soort:'attribuut',stockage_id:a.thuislocatie_id||themaStockageId,attribuut_id:a.attr_id}))
            ]);
            const leverMat=aankomendeViaStockage.flatMap(kt=>[
              ...themaBakken.filter(b=>b.thema_id===kt.thema_id).map(b=>({naam:'Bak '+b.naam+(b.code?' ('+b.code+')':''),qty:1,soort:'thema',stockage_id:b.thuislocatie_id||themaStockageId,bak_id:b.bak_id})),
              ...themaAttrRegels.filter(a=>a.thema_id===kt.thema_id).map(a=>({naam:'Attribuut '+a.naam+(a.code?' ('+a.code+')':''),qty:1,soort:'attribuut',stockage_id:a.thuislocatie_id||themaStockageId,attribuut_id:a.attr_id}))
            ]);
            const prevOpen=getOpenDagen(prevKm);
            const wisseldatum=prevOpen.length?nextWorkday(prevOpen[prevOpen.length-1]):prevWorkday(openDagen[0]);
            Object.entries(byStockage(ophaalMat)).forEach(([sid,mat])=>{
              voorstellen.push({type:'ophaling',kampmoment_id:km.id,week:km.week,locatie:loc.name,locatie_id:loc.id,naar_locatie_id:parseInt(sid),datum:wisseldatum,tijd:'09:00',open_dagen:openDagen,materiaal:mat,opmerking:'Thema-wissel ophaling week '+km.week+' — '+loc.name});
            });
            Object.entries(byStockage(leverMat)).forEach(([sid,mat])=>{
              voorstellen.push({type:'levering',kampmoment_id:km.id,week:km.week,locatie:loc.name,locatie_id:loc.id,van_locatie_id:parseInt(sid),datum:wisseldatum,tijd:'11:00',open_dagen:openDagen,materiaal:mat,opmerking:'Thema-wissel levering week '+km.week+' — '+loc.name});
            });
          }
        }

        if(isLaatsteVanPeriode){
          // Laatste OPEN week van de locatie binnen de periode (definitief dicht daarna, of
          // laatste week van de vakantie): haal basis-materiaal, kleurenborden (alles wat
          // cumulatief effectief staat volgens kleurenStand) en locatieconfig-exemplaren op.
          const nextD=nextWorkday(openDagen[openDagen.length-1]);
          const kleurenOphaalRegels=Object.entries(kleurenStand).filter(([,q])=>q>0)
            .map(([kleur,aantal])=>({naam:`Kleurenbord ${kleur} ×${aantal}`,qty:aantal,soort:'basis',stockage_id:sportStockageId}));
          const basisPlusKleuren=[...basisRegels,...kleurenOphaalRegels];
          Object.entries(byStockage(basisPlusKleuren)).forEach(([sid,mat])=>{
            const sLoc=locs.find(l=>l.id==sid);
            voorstellen.push({type:'ophaling',kampmoment_id:km.id,week:km.week,locatie:loc.name,locatie_id:loc.id,naar_locatie_id:parseInt(sid),datum:nextD,tijd:'17:00',open_dagen:openDagen,materiaal:mat,opmerking:'Ophaling basis week '+km.week+' — '+loc.name+(sLoc?' (naar '+sLoc.name+')':'')});
          });
          // Locatieconfig-exemplaren gaan terug mee naar hun thuislocatie.
          // Reviewfix: bij vooraf plannen (alles in één keer genereren) staan de exemplaren nog
          // 'thuis' — val dan terug op dezelfde vrije exemplaren die de levering zou kiezen,
          // anders ontbreekt de eind-ophaling bij definitieve sluiting (bindende regel 1).
          const locConfigTerug=(_actieveLocatieConfig(km)).flatMap(cfg=>{
            let exemplaren=all("SELECT * FROM bakken WHERE soort='vast' AND vast_type=? AND status='op_locatie' AND huidige_locatie_id=? LIMIT ?",[cfg.vast_type,loc.id,cfg.aantal||1]);
            if(!exemplaren.length)
              exemplaren=all("SELECT * FROM bakken WHERE soort='vast' AND vast_type=? AND status='thuis' LIMIT ?",[cfg.vast_type,cfg.aantal||1]);
            return exemplaren.map(b=>({naam:'Bak '+b.naam+(b.code?' ('+b.code+')':''),qty:1,soort:'vast',stockage_id:b.thuislocatie_id||sportStockageId,bak_id:b.id}));
          });
          Object.entries(byStockage(locConfigTerug)).forEach(([sid,mat])=>{
            voorstellen.push({type:'ophaling',kampmoment_id:km.id,week:km.week,locatie:loc.name,locatie_id:loc.id,naar_locatie_id:parseInt(sid),datum:nextD,tijd:'17:00',open_dagen:openDagen,materiaal:mat,opmerking:'Ophaling vast materiaal week '+km.week+' — '+loc.name});
          });
          // S4.5d: themabehoefte-exemplaren (springkasteel+blazers+verlengdraadkoffer, kookuitrusting...)
          // gaan mee terug bij de laatste open week (sluitingsregels S5 gelden hier ook: dit blok
          // draait enkel op isLaatsteVanPeriode, dus tijdelijke sluiting = géén ophaling, zoals boven).
          const themaBehoefteTerug=_themaBehoefteRegels(km,kmThemas,true);
          Object.entries(byStockage(themaBehoefteTerug)).forEach(([sid,mat])=>{
            voorstellen.push({type:'ophaling',kampmoment_id:km.id,week:km.week,locatie:loc.name,locatie_id:loc.id,naar_locatie_id:parseInt(sid),datum:nextD,tijd:'17:00',open_dagen:openDagen,materiaal:mat,opmerking:'Ophaling themabehoefte-materiaal week '+km.week+' — '+loc.name});
          });
        }

        // Pauze-gedrag (Migratie 58, Maxim): config-regels met pauze_gedrag='ophalen' gaan wél
        // tijdelijk mee terug bij een pauze en worden herleverd bij heropening. Alles met
        // 'blijven' (default) volgt de bindende regel: laten staan tijdens tijdelijke sluiting.
        if(!heeftOpvolger && !isLaatsteVanPeriode){
          // Laatste open week vóór een pauze → ophaal van de 'ophalen'-types
          const nextD=nextWorkday(openDagen[openDagen.length-1]);
          const pauzeTerug=_actieveLocatieConfig(km).filter(cfg=>cfg.pauze_gedrag==='ophalen').flatMap(cfg=>{
            let exemplaren=all("SELECT * FROM bakken WHERE soort='vast' AND vast_type=? AND status='op_locatie' AND huidige_locatie_id=? LIMIT ?",[cfg.vast_type,loc.id,cfg.aantal||1]);
            if(!exemplaren.length)
              exemplaren=all("SELECT * FROM bakken WHERE soort='vast' AND vast_type=? AND status='thuis' ORDER BY volgorde,id LIMIT ?",[cfg.vast_type,cfg.aantal||1]);
            return exemplaren.map(b=>({naam:'Bak '+b.naam+(b.code?' ('+b.code+')':''),qty:1,soort:'vast',stockage_id:b.thuislocatie_id||sportStockageId,bak_id:b.id}));
          });
          Object.entries(byStockage(pauzeTerug)).forEach(([sid,mat])=>{
            voorstellen.push({type:'ophaling',kampmoment_id:km.id,week:km.week,locatie:loc.name,locatie_id:loc.id,naar_locatie_id:parseInt(sid),datum:nextD,tijd:'17:00',open_dagen:openDagen,materiaal:mat,opmerking:'Pauze-ophaling vast materiaal na week '+km.week+' — '+loc.name+' (heropent later)'});
          });
        }
        if(!isOpvolgend && !isEersteVanPeriode){
          // Eerste open week ná een pauze → herlevering van de 'ophalen'-types
          const pauzeLever=_actieveLocatieConfig(km).filter(cfg=>cfg.pauze_gedrag==='ophalen').flatMap(cfg=>{
            const vrij=all("SELECT * FROM bakken WHERE soort='vast' AND vast_type=? AND status='thuis' ORDER BY volgorde,id LIMIT ?",[cfg.vast_type,cfg.aantal||1]);
            return vrij.map(b=>({naam:'Bak '+b.naam+(b.code?' ('+b.code+')':''),qty:1,soort:'vast',stockage_id:b.thuislocatie_id||sportStockageId,bak_id:b.id}));
          });
          Object.entries(byStockage(pauzeLever)).forEach(([sid,mat])=>{
            voorstellen.push({type:'levering',kampmoment_id:km.id,week:km.week,locatie:loc.name,locatie_id:loc.id,van_locatie_id:parseInt(sid),datum:prevD,tijd:'08:30',open_dagen:openDagen,materiaal:mat,opmerking:'Herlevering vast materiaal week '+km.week+' — '+loc.name+' (na pauze)'});
          });
        }
        if(!heeftOpvolger){
          // Laatste week van deze aaneensluitende reeks (kan een gap-week zijn): thema volgt
          // zijn eigen gap-gedrag (via stockage) — niet aanraken, blijft ongewijzigd.
          const nextD=nextWorkday(openDagen[openDagen.length-1]);
          Object.entries(byStockage(themaMatRegels)).forEach(([sid,mat])=>{
            const sLoc=locs.find(l=>l.id==sid);
            voorstellen.push({type:'ophaling',kampmoment_id:km.id,week:km.week,locatie:loc.name,locatie_id:loc.id,naar_locatie_id:parseInt(sid),datum:nextD,tijd:'17:00',open_dagen:openDagen,materiaal:mat,opmerking:'Ophaling thema week '+km.week+' — '+loc.name+' ('+thNamen+(sLoc?', naar '+sLoc.name:'')+')'});
          });
        }
      });
    });

    // ── DIRECT THEMA-TRANSFER (A → B aaneensluitend) ──
    const allThemaIds=[...new Set(kts.map(kt=>kt.thema_id))];
    allThemaIds.forEach(thId=>{
      const kmsMetThema=kts.filter(kt=>kt.thema_id===thId)
        .map(kt=>kms.find(km=>km.id===kt.kampmoment_id))
        .filter(km=>km && km.type!=='themadag')
        .sort((a,b)=>a.week-b.week);
      for(let i=0;i<kmsMetThema.length-1;i++){
        const kmA=kmsMetThema[i],kmB=kmsMetThema[i+1];
        if(kmA.locatie_id===kmB.locatie_id)continue;
        if(kmB.week!==kmA.week+1)continue;
        const locA=locs.find(l=>l.id===kmA.locatie_id);
        const locB=locs.find(l=>l.id===kmB.locatie_id);
        if(!locA||!locB)continue;
        const openA=getOpenDagen(kmA);
        const openB=getOpenDagen(kmB);
        if(!openA.length||!openB.length)continue;
        const th=themas.find(t=>t.id===thId);
        const thMat=[
          ...themaBakken.filter(b=>b.thema_id===thId).map(b=>({naam:'Bak '+b.naam+(b.code?' ('+b.code+')':''),qty:1,soort:'thema',bak_id:b.bak_id})),
          ...themaAttrRegels.filter(a=>a.thema_id===thId).map(a=>({naam:'Attribuut '+a.naam+(a.code?' ('+a.code+')':''),qty:1,soort:'attribuut',attribuut_id:a.attr_id}))
        ];
        if(!thMat.length)continue;
        voorstellen.push({type:'levering',kampmoment_id:kmB.id,week:kmB.week,locatie:locB.name,locatie_id:locB.id,van_locatie_id:locA.id,datum:nextWorkday(openA[openA.length-1]),tijd:'10:00',materiaal:thMat,opmerking:'Thema-transfer: '+(th?.name||'?')+' van '+locA.name+' → '+locB.name});
      }
    });

    // ── SPORT SETS TRANSPORT ──
    // Gebruik per-item stockage_locatie_id; fallback naar sportStockageId
    const allSportSets=all('SELECT ss.*,si.name as item_naam,si.stockage_locatie_id as item_stockage_id FROM sport_sets ss LEFT JOIN sport_items si ON si.id=ss.item_id');
    const allSportPlanning=all('SELECT * FROM sport_planning ORDER BY set_id,week');

    allSportSets.forEach(set=>{
      const setPlanning=allSportPlanning.filter(p=>p.set_id===set.id).sort((a,b)=>a.week-b.week);
      if(!setPlanning.length)return;
      const homeStockageId=set.item_stockage_id||sportStockageId;
      if(!homeStockageId)return;
      const setNaam=(set.item_naam||'?')+' — '+set.label;

      // Levering vanuit home-stockage voor eerste geplande week
      const fp=setPlanning[0];
      const fKm=kms.find(km=>km.locatie_id===fp.locatie_id&&km.week===fp.week);
      if(fKm){const fo=getOpenDagen(fKm);if(fo.length){const fLoc=locs.find(l=>l.id===fp.locatie_id);voorstellen.push({type:'levering',locatie:fLoc?.name||'?',locatie_id:fp.locatie_id,van_locatie_id:homeStockageId,datum:prevWorkday(fo[0]),tijd:'08:30',materiaal:[{naam:setNaam,qty:1,soort:'sport'}],opmerking:'Sport levering: '+setNaam+' → '+(fLoc?.name||'?')+' (week '+fp.week+')'});}}

      // Transities tussen opeenvolgende geplande weken
      for(let i=0;i<setPlanning.length-1;i++){
        const pA=setPlanning[i],pB=setPlanning[i+1];
        if(pA.locatie_id===pB.locatie_id)continue; // zelfde locatie → geen transport
        const kmA=kms.find(km=>km.locatie_id===pA.locatie_id&&km.week===pA.week);
        if(!kmA)continue;
        const openA=getOpenDagen(kmA);if(!openA.length)continue;
        const locA=locs.find(l=>l.id===pA.locatie_id);
        const locB=locs.find(l=>l.id===pB.locatie_id);
        const transferDatum=nextWorkday(openA[openA.length-1]);

        if(pB.week===pA.week+1){
          // Aaneensluitend → directe transfer A→B (geen stockage tussenin)
          voorstellen.push({type:'levering',locatie:locB?.name||'?',locatie_id:pB.locatie_id,van_locatie_id:pA.locatie_id,datum:transferDatum,tijd:'10:00',materiaal:[{naam:setNaam,qty:1,soort:'sport'}],opmerking:'Sport direct: '+setNaam+' van '+(locA?.name||'?')+' → '+(locB?.name||'?')});
        } else {
          // Gap → via home-stockage: ophaling na week A, levering voor week B
          voorstellen.push({type:'ophaling',locatie:locA?.name||'?',locatie_id:pA.locatie_id,naar_locatie_id:homeStockageId,datum:transferDatum,tijd:'17:00',materiaal:[{naam:setNaam,qty:1,soort:'sport'}],opmerking:'Sport ophaling: '+setNaam+' ← '+(locA?.name||'?')});
          const kmB=kms.find(km=>km.locatie_id===pB.locatie_id&&km.week===pB.week);
          if(kmB){const openB=getOpenDagen(kmB);if(openB.length){voorstellen.push({type:'levering',locatie:locB?.name||'?',locatie_id:pB.locatie_id,van_locatie_id:homeStockageId,datum:prevWorkday(openB[0]),tijd:'08:30',materiaal:[{naam:setNaam,qty:1,soort:'sport'}],opmerking:'Sport levering: '+setNaam+' → '+(locB?.name||'?')+' (week '+pB.week+')'});}}
        }
      }

      // Ophaling naar home-stockage na laatste geplande week
      const lp=setPlanning[setPlanning.length-1];
      const lKm=kms.find(km=>km.locatie_id===lp.locatie_id&&km.week===lp.week);
      if(lKm){const lo=getOpenDagen(lKm);if(lo.length){const lLoc=locs.find(l=>l.id===lp.locatie_id);voorstellen.push({type:'ophaling',locatie:lLoc?.name||'?',locatie_id:lp.locatie_id,naar_locatie_id:homeStockageId,datum:nextWorkday(lo[lo.length-1]),tijd:'17:00',materiaal:[{naam:setNaam,qty:1,soort:'sport'}],opmerking:'Sport ophaling (einde): '+setNaam+' ← '+(lLoc?.name||'?')});}}
    });

    // Bundeling (Maxim 2026-08-02): voorstellen met hetzelfde type, dezelfde datum en dezelfde
    // route (locatie + van/naar) worden één voorstel met meerdere regels — anders krijg je bv.
    // 8 losse "Sport ophaling"-kaarten voor 2 locaties op dezelfde dag.
    const _gebundeld={};
    voorstellen.forEach(p=>{
      const sleutel=[p.type,p.datum,p.locatie_id||'',p.van_locatie_id||'',p.naar_locatie_id||''].join('|');
      if(!_gebundeld[sleutel]){ _gebundeld[sleutel]={...p,materiaal:[...(p.materiaal||[])],_bundelAantal:1,_bundelOpmerkingen:[p.opmerking]}; }
      else {
        const g=_gebundeld[sleutel];
        g.materiaal.push(...(p.materiaal||[]));
        g._bundelAantal++;
        g._bundelOpmerkingen.push(p.opmerking);
        if(p.tijd<g.tijd)g.tijd=p.tijd; // vroegste tijdstip wint
        if(!g.kampmoment_id&&p.kampmoment_id)g.kampmoment_id=p.kampmoment_id;
      }
    });
    const gebundeldeVoorstellen=Object.values(_gebundeld).map(g=>{
      if(g._bundelAantal>1){
        const alleSport=g._bundelOpmerkingen.every(o=>(o||'').startsWith('Sport '));
        g.opmerking=alleSport
          ? `Sport ${g.type==='ophaling'?'ophaling':'levering'} — ${g._bundelAantal} sets — ${g.locatie}`
          : `${g._bundelOpmerkingen[0]} (+${g._bundelAantal-1} gebundeld)`;
      }
      delete g._bundelAantal; delete g._bundelOpmerkingen;
      return g;
    });
    gebundeldeVoorstellen.sort((a,b)=>a.datum.localeCompare(b.datum)||a.tijd.localeCompare(b.tijd));
    res.json(gebundeldeVoorstellen);
  });
  // ── V3d punt 1: checks volgen hun taak (splitsen, taak aan andere rit hangen) ──
  // Een check hoort bij een taak (taak_id); zijn rit_id volgt altijd de rit van die taak.
  function _syncChecksRit(ritId){
    if(!ritId)return;
    run('UPDATE verhuis_checks SET rit_id=COALESCE((SELECT rit_id FROM transport_taken t WHERE t.id=verhuis_checks.taak_id),0) WHERE rit_id=? AND taak_id IS NOT NULL AND taak_id NOT IN (SELECT id FROM transport_taken WHERE rit_id=?)',[ritId,ritId]);
    run('UPDATE verhuis_checks SET rit_id=? WHERE taak_id IN (SELECT id FROM transport_taken WHERE rit_id=?) AND COALESCE(rit_id,0)<>?',[ritId,ritId,ritId]);
  }
  // Welke check hoort bij welke transportregel: zelfde bak, anders zelfde attribuut, anders zelfde naam.
  function _checksVanRegel(taakId,r){
    if(r.bak_id)return all('SELECT * FROM verhuis_checks WHERE taak_id=? AND bak_id=?',[taakId,r.bak_id]);
    if(r.attribuut_id)return all('SELECT * FROM verhuis_checks WHERE taak_id=? AND attribuut_id=?',[taakId,r.attribuut_id]);
    return all('SELECT * FROM verhuis_checks WHERE taak_id=? AND item_naam=? AND bak_id IS NULL AND attribuut_id IS NULL',[taakId,r.naam]);
  }
  // Delete-regel: een taak met regels die geladen maar nog niet gelost zijn, mag niet weg (409).
  function _geladenOpenRegels(taakId){
    return get('SELECT COUNT(*) AS n FROM verhuis_checks WHERE taak_id=? AND geladen=1 AND COALESCE(gelost,0)=0',[taakId]).n;
  }
  function _verwijderTaak(req,id){
    const t=get('SELECT * FROM transport_taken WHERE id=?',[id]);
    if(!t)return {status:404,fout:'Transport niet gevonden'};
    const n=_geladenOpenRegels(id);
    if(n)return {status:409,fout:`${n} regel${n===1?' is':'s zijn'} al geladen: los ze eerst of zet de taak terug op gepland`};
    run('DELETE FROM transport_regels WHERE taak_id=?',[id]);
    delMetLog(req,'DELETE FROM verhuis_checks WHERE taak_id=?',[id]);
    delMetLog(req,'DELETE FROM transport_taken WHERE id=?',[id]);
    if(t.rit_id){const rest=get('SELECT COUNT(*) as n FROM transport_taken WHERE rit_id=?',[t.rit_id]);
      if(rest&&rest.n===0){delMetLog(req,'DELETE FROM verhuis_checks WHERE rit_id=?',[t.rit_id]);delMetLog(req,'DELETE FROM transport_ritten WHERE id=?',[t.rit_id]);}}
    return {ok:true};
  }
  // Terugzetten op gepland: wat al geladen of verplaatst was gaat terug, laad/los-vinkjes gewist.
  // Bulk die al verplaatst was gaat via verplaatsBulk terug naar de van-locatie (te weinig daar → 409).
  function _zetTaakTerug(req,taakId){
    const taak=get('SELECT * FROM transport_taken WHERE id=?',[taakId]);
    if(!taak)return {status:404,fout:'Transport niet gevonden'};
    const regels=all('SELECT * FROM transport_regels WHERE taak_id=?',[taakId]);
    for(const r of regels){
      if(!r.bak_id||!r.verplaatsing_uitgevoerd)continue;
      const b=get('SELECT * FROM bakken WHERE id=?',[r.bak_id]);
      if(b&&b.is_bulk&&taak.naar_locatie_id){const f=bulk.controleerBulk(b.id,taak.naar_locatie_id,r.qty||1);if(f)return {status:409,fout:'Terugzetten kan niet: '+f};}
    }
    const ctxt='taak #'+taakId+' terug op gepland';
    const geladen=all('SELECT * FROM verhuis_checks WHERE taak_id=? AND (geladen=1 OR gelost=1)',[taakId]);
    regels.forEach(r=>{
      const isGeladen=_checksVanRegel(taakId,r).some(c=>c.geladen||c.gelost);
      if(r.bak_id){
        const b=get('SELECT * FROM bakken WHERE id=?',[r.bak_id]);
        if(b&&b.is_bulk){
          if(r.verplaatsing_uitgevoerd&&taak.naar_locatie_id)bulk.verplaatsBulk(req,b.id,taak.naar_locatie_id,taak.van_locatie_id||b.thuislocatie_id,r.qty||1,ctxt);
          else bulk.leidBulkStatusAf(req,b.id,ctxt);
        } else if(b&&(r.verplaatsing_uitgevoerd||isGeladen||b.status==='onderweg')){
          const loc=r.verplaatsing_uitgevoerd?(taak.van_locatie_id||b.thuislocatie_id):(b.huidige_locatie_id||b.thuislocatie_id);
          updateMetLog(req,'UPDATE bakken SET huidige_locatie_id=?,status=? WHERE id=?',[loc,loc==b.thuislocatie_id?'thuis':'op_locatie',b.id],ctxt);
        }
      }
      if(r.attribuut_id&&(r.verplaatsing_uitgevoerd||isGeladen)){
        const a=get('SELECT * FROM attributen WHERE id=?',[r.attribuut_id]);
        if(a){const loc=r.verplaatsing_uitgevoerd?(taak.van_locatie_id||a.thuislocatie_id):(a.huidige_locatie_id||a.thuislocatie_id);
          run('UPDATE attributen SET huidige_locatie_id=?,status=? WHERE id=?',[loc,loc==a.thuislocatie_id?'thuis':'op_locatie',a.id]);}
      }
      if(r.verplaatsing_uitgevoerd)run('UPDATE transport_regels SET verplaatsing_uitgevoerd=0 WHERE id=?',[r.id]);
    });
    geladen.forEach(c=>updateMetLog(req,"UPDATE verhuis_checks SET geladen=0,geladen_door='',geladen_op='',gelost=0,gelost_door='',gelost_op='' WHERE id=?",[c.id],ctxt));
    updateMetLog(req,"UPDATE transport_taken SET status='gepland' WHERE id=?",[taakId]);
    if(taak.rit_id){const rit=get('SELECT status FROM transport_ritten WHERE id=?',[taak.rit_id]);
      if(rit&&rit.status==='gedaan')updateMetLog(req,"UPDATE transport_ritten SET status='onderweg' WHERE id=?",[taak.rit_id]);}
    return {taak:get('SELECT * FROM transport_taken WHERE id=?',[taakId])};
  }
  // Bulk: ontkoppel van rit (zet rit_id=NULL)
  app.post('/api/transport-taken/bulk-ontkoppel',(req,res)=>{
    const{ids}=req.body;
    if(!Array.isArray(ids)||!ids.length)return res.status(400).json({error:'ids vereist'});
    ids.forEach(id=>updateMetLog(req,"UPDATE transport_taken SET rit_id=NULL,datum='',wie='' WHERE id=? AND COALESCE((SELECT spoed_kind FROM transport_taken WHERE id=?),'') != '1'",[id,id]));
    res.json({ok:true,count:ids.length});
  });
  // Bulk: verplaats naar andere rit
  app.post('/api/transport-taken/bulk-move',(req,res)=>{
    const{ids,rit_id}=req.body;
    if(!Array.isArray(ids)||!ids.length)return res.status(400).json({error:'ids vereist'});
    const rit=rit_id?get('SELECT * FROM transport_ritten WHERE id=?',[rit_id]):null;
    if(rit_id&&!rit)return res.status(404).json({error:'Rit niet gevonden'});
    ids.forEach(id=>{
      updateMetLog(req,'UPDATE transport_taken SET rit_id=?,datum=?,wie=? WHERE id=?',
        [rit_id||null,rit?rit.datum:'',rit?rit.chauffeur:'',id]);
    });
    res.json({ok:true,count:ids.length});
  });
  // Bulk: verwijder
  app.post('/api/transport-taken/bulk-delete',(req,res)=>{
    const{ids}=req.body;
    if(!Array.isArray(ids)||!ids.length)return res.status(400).json({error:'ids vereist'});
    // V3d: eerst alles controleren — één taak met geladen regels → niets verwijderd (409).
    for(const id of ids){const n=_geladenOpenRegels(id);if(n)return res.status(409).json({error:`Taak #${id}: ${n} regel${n===1?' is':'s zijn'} al geladen: los ze eerst of zet de taak terug op gepland`});}
    ids.forEach(id=>_verwijderTaak(req,id));
    res.json({ok:true});
  });
  // Splitsen (Maxim 2026-08-02): een deel van de regels (bakken/attributen) van een taak
  // verhuist naar een NIEUWE taak op een andere dag — bv. donderdag al de helft ophalen,
  // vrijdag de rest. Zo wordt het werk over meerdere dagen gespreid.
  app.post('/api/transport-taken/:id/splits',(req,res)=>{
    const{regel_ids,datum,tijd}=req.body;
    const taak=get('SELECT * FROM transport_taken WHERE id=?',[req.params.id]);
    if(!taak)return res.status(404).json({error:'Taak niet gevonden'});
    if(!Array.isArray(regel_ids)||!regel_ids.length)return res.status(400).json({error:'Kies minstens één regel om af te splitsen'});
    const alleRegels=all('SELECT * FROM transport_regels WHERE taak_id=?',[taak.id]);
    const teVerhuizen=alleRegels.filter(r=>regel_ids.includes(r.id));
    if(!teVerhuizen.length)return res.status(400).json({error:'Geen van de gekozen regels hoort bij deze taak'});
    if(teVerhuizen.length===alleRegels.length)return res.status(400).json({error:'Je kan niet álle regels afsplitsen — dan verplaats je beter de hele taak'});
    const nieuwId=insMetLog(req,`INSERT INTO transport_taken (type,datum,tijd,van_locatie_id,naar_locatie_id,opmerking,wie,kampmoment_id,status,created_at,rit_id,week)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [taak.type,datum||'',tijd||taak.tijd||'09:00',taak.van_locatie_id,taak.naar_locatie_id,
       (taak.opmerking||'')+' — afgesplitst deel',taak.wie||'',taak.kampmoment_id,'gepland',now(),null,taak.week]);
    // V3d: de checks van de afgesplitste regels verhuizen mee (met hun laadstatus); rit_id = 0 (kolom is NOT NULL:
    // 0 = nog geen rit) tot de nieuwe taak aan een rit hangt (_syncChecksRit zet hem dan goed).
    teVerhuizen.forEach(r=>{_checksVanRegel(taak.id,r).forEach(c=>updateMetLog(req,'UPDATE verhuis_checks SET taak_id=?,rit_id=0 WHERE id=?',[nieuwId,c.id],'splitsen taak #'+taak.id));
      run('UPDATE transport_regels SET taak_id=? WHERE id=?',[nieuwId,r.id]);});
    logAct('transport','gesplitst',`Taak #${taak.id}: ${teVerhuizen.length} regel(s) afgesplitst naar taak #${nieuwId}${datum?' ('+datum+')':''}`,taak.naar_locatie_id||taak.van_locatie_id,null);
    res.json({ok:true,nieuwe_taak_id:nieuwId,verplaatst:teVerhuizen.length});
  });
  app.post('/api/transport-taken',(req,res)=>{const{type,datum,tijd,van_locatie_id,naar_locatie_id,opmerking,wie,kampmoment_id,regels,rit_id,week}=req.body;const id=insMetLog(req,'INSERT INTO transport_taken (type,datum,tijd,van_locatie_id,naar_locatie_id,opmerking,wie,kampmoment_id,status,created_at,rit_id,week) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',[type,datum||'',tijd||'09:00',van_locatie_id||null,naar_locatie_id||null,opmerking||'',wie||'',kampmoment_id||null,'gepland',now(),rit_id||null,week||null]);if(regels&&regels.length)regels.forEach(r=>ins('INSERT INTO transport_regels (taak_id,naam,qty,soort,item_type_id,bak_id,attribuut_id) VALUES (?,?,?,?,?,?,?)',[id,r.naam,r.qty||1,r.soort||'andere',resolveItemTypeId(r.naam,undefined,false),r.bak_id||null,r.attribuut_id||null]));const taak=get('SELECT * FROM transport_taken WHERE id=?',[id]);const tr=all('SELECT * FROM transport_regels WHERE taak_id=?',[id]);res.json({...taak,regels:tr});});
  app.put('/api/transport-taken/:id',(req,res)=>{const{type,datum,tijd,van_locatie_id,naar_locatie_id,opmerking,wie,status}=req.body;const bestaand=get('SELECT * FROM transport_taken WHERE id=?',[req.params.id]);if(!bestaand)return res.status(404).json({error:'Transport niet gevonden'});const nieuweDatum=bestaand.rit_id?bestaand.datum:(datum!==undefined?datum||'':bestaand.datum||'');const nieuweWie=bestaand.rit_id?bestaand.wie:(wie!==undefined?wie||'':bestaand.wie||'');updateMetLog(req,'UPDATE transport_taken SET type=?,datum=?,tijd=?,van_locatie_id=?,naar_locatie_id=?,opmerking=?,wie=?,status=? WHERE id=?',[type,nieuweDatum,tijd||'09:00',van_locatie_id||null,naar_locatie_id||null,opmerking||'',nieuweWie,status||'gepland',req.params.id]);res.json(get('SELECT * FROM transport_taken WHERE id=?',[req.params.id]));});
  app.delete('/api/transport-taken/:id',(req,res)=>{const r=_verwijderTaak(req,req.params.id);if(r.fout)return res.status(r.status).json({error:r.fout});res.json({ok:true});});
  // ── V3a: ÉÉN afrond-functie voor een taak (knop "gedaan" in kantoor én laatste "gelost" via rit-token) ──
  // Controleert eerst alle bulk-regels (te weinig op de bronlocatie → fout, niets gewijzigd), dan:
  // status gedaan, spoed-effect, verbruik-deplétie (één keer), en per regel de verplaatsing
  // — elke regel max. één keer (transport_regels.verplaatsing_uitgevoerd = idempotent).
  function _controleerTaakAf(taak){
    if(!taak||!taak.naar_locatie_id)return null;
    const regels=all('SELECT * FROM transport_regels WHERE taak_id=? AND bak_id IS NOT NULL AND COALESCE(verplaatsing_uitgevoerd,0)=0',[taak.id]);
    for(const r of regels){
      const b=get('SELECT * FROM bakken WHERE id=?',[r.bak_id]);
      if(b&&b.is_bulk){const f=bulk.controleerBulk(b.id,taak.van_locatie_id||b.thuislocatie_id,r.qty||1);if(f)return f;}
    }
    return null;
  }
  function _rondTaakAf(req,taakId,context){
    const taak=get('SELECT * FROM transport_taken WHERE id=?',[taakId]);
    if(!taak)return {fout:'Transport niet gevonden',status:404};
    const fout=_controleerTaakAf(taak);
    if(fout)return {fout,status:409};
    const oudStatus=taak.status;
    if(oudStatus!=='gedaan')updateMetLog(req,"UPDATE transport_taken SET status='gedaan' WHERE id=?",[taak.id],context);
    _pasSpoedEffectToe(taak,req);
    // Stock-deplétie: trek verbruiksartikelen af bij levering
    if(taak.type==='levering'&&taak.kampmoment_id&&oudStatus!=='gedaan'){
      const kts=all('SELECT thema_id FROM kampmoment_themas WHERE kampmoment_id=?',[taak.kampmoment_id]);
      kts.forEach(kt=>{
        all('SELECT id FROM thema_bakken WHERE thema_id=?',[kt.thema_id]).forEach(b=>{
          all('SELECT * FROM bak_items WHERE bak_id=? AND verbruik=1',[b.id]).forEach(item=>{
            run('UPDATE bak_items SET qty_stock=? WHERE id=?',[Math.max(0,(item.qty_stock||0)-(item.qty_per_gebruik||1)),item.id]);
          });
        });
      });
    }
    // S2.4: bakken/attributen volgen mee naar naar_locatie_id; bulk via verplaatsBulk.
    if(taak.naar_locatie_id){
      const regels=all('SELECT * FROM transport_regels WHERE taak_id=? AND COALESCE(verplaatsing_uitgevoerd,0)=0',[taak.id]);
      const ritRow=taak.rit_id?get('SELECT * FROM transport_ritten WHERE id=?',[taak.rit_id]):null;
      const chauffeurNaam=(ritRow&&ritRow.chauffeur)||taak.wie||'onbekende chauffeur';
      const loc=get('SELECT name FROM locaties WHERE id=?',[taak.naar_locatie_id]);
      regels.forEach(r=>{
        if(r.bak_id){
          const b=get('SELECT * FROM bakken WHERE id=?',[r.bak_id]);
          if(b&&b.is_bulk){
            const n=r.qty||1;
            bulk.verplaatsBulk(req,b.id,taak.van_locatie_id||b.thuislocatie_id,taak.naar_locatie_id,n,context||('taak #'+taak.id));
            logAct('bak','gelost',`Bulk "${b.naam}" ×${n} gelost op ${loc?.name||'?'} (taak #${taak.id}) door ${chauffeurNaam}`,taak.naar_locatie_id,loc?.name);
          } else if(b){const st=taak.naar_locatie_id==b.thuislocatie_id?'thuis':'op_locatie';
            updateMetLog(req,'UPDATE bakken SET huidige_locatie_id=?,status=? WHERE id=?',[taak.naar_locatie_id,st,r.bak_id],context);
            logAct('bak','gelost',`Bak "${b.naam}" (${b.code||'-'}) gelost op ${loc?.name||'?'} (taak #${taak.id}) door ${chauffeurNaam}`,taak.naar_locatie_id,loc?.name);}
        }
        if(r.attribuut_id){
          const a=get('SELECT * FROM attributen WHERE id=?',[r.attribuut_id]);
          if(a){const st=taak.naar_locatie_id==a.thuislocatie_id?'thuis':'op_locatie';
            run('UPDATE attributen SET huidige_locatie_id=?,status=? WHERE id=?',[taak.naar_locatie_id,st,r.attribuut_id]);
            logAct('attribuut','gelost',`Attribuut "${a.naam}" (${a.code||'-'}) gelost op ${loc?.name||'?'} (taak #${taak.id}) door ${chauffeurNaam}`,taak.naar_locatie_id,loc?.name);}
        }
        if(r.bak_id||r.attribuut_id)run('UPDATE transport_regels SET verplaatsing_uitgevoerd=1 WHERE id=?',[r.id]);
      });
    }
    _sluitRitAlsKlaar(req,taak.rit_id,context);
    return {taak:get('SELECT * FROM transport_taken WHERE id=?',[taak.id])};
  }
  // V3a punt 2: alle taken van de rit gedaan → rit gedaan.
  function _sluitRitAlsKlaar(req,ritId,context){
    if(!ritId)return;
    const taken=all('SELECT status FROM transport_taken WHERE rit_id=?',[ritId]);
    const rit=get('SELECT status FROM transport_ritten WHERE id=?',[ritId]);
    if(rit&&taken.length&&taken.every(t=>t.status==='gedaan')&&rit.status!=='gedaan')
      updateMetLog(req,"UPDATE transport_ritten SET status='gedaan' WHERE id=?",[ritId],context);
  }
  app.put('/api/transport-taken/:id/status',(req,res)=>{
    if(req.body.status==='gedaan'){
      const r=_rondTaakAf(req,req.params.id);
      if(r.fout)return res.status(r.status).json({error:r.fout});
      return res.json(r.taak);
    }
    if(req.body.status==='gepland'){
      const r=_zetTaakTerug(req,req.params.id);
      if(r.fout)return res.status(r.status).json({error:r.fout});
      return res.json(r.taak);
    }
    updateMetLog(req,'UPDATE transport_taken SET status=? WHERE id=?',[req.body.status,req.params.id]);
    res.json(get('SELECT * FROM transport_taken WHERE id=?',[req.params.id]));
  });
  app.put('/api/transport-taken/:id/move',(req,res)=>{const{datum,tijd}=req.body;const t=get('SELECT * FROM transport_taken WHERE id=?',[req.params.id]);if(!t)return res.status(404).json({error:'Transport niet gevonden'});
    if(t.rit_id){
      // Verplaats de hele rit (datum + cascade naar alle leden)
      if(datum){updateMetLog(req,'UPDATE transport_ritten SET datum=? WHERE id=?',[datum,t.rit_id]);updateMetLog(req,'UPDATE transport_taken SET datum=? WHERE rit_id=?',[datum,t.rit_id]);}
      if(tijd)updateMetLog(req,'UPDATE transport_taken SET tijd=? WHERE id=?',[tijd,req.params.id]);
    } else {
      // Losse taak (nood) op een dag gesleept → maak een 1-op-1 rit
      const d=datum||t.datum||'';
      if(d){const nid=insMetLog(req,'INSERT INTO transport_ritten (datum,chauffeur,opmerking,status,created_at) VALUES (?,?,?,?,?)',[d,t.wie||'','','gepland',now()]);updateMetLog(req,'UPDATE transport_taken SET rit_id=?,datum=?,tijd=? WHERE id=?',[nid,d,tijd||t.tijd,req.params.id]);}
      else updateMetLog(req,'UPDATE transport_taken SET tijd=? WHERE id=?',[tijd||t.tijd,req.params.id]);
    }
    res.json(get('SELECT * FROM transport_taken WHERE id=?',[req.params.id]));});
  app.post('/api/transport-regels',(req,res)=>{const{taak_id,naam,qty,soort}=req.body;const item_type_id=resolveItemTypeId(naam,undefined,false);const id=ins('INSERT INTO transport_regels (taak_id,naam,qty,soort,item_type_id) VALUES (?,?,?,?,?)',[taak_id,naam,qty||1,soort||'andere',item_type_id]);res.json(get('SELECT * FROM transport_regels WHERE id=?',[id]));});
  app.delete('/api/transport-regels/:id',(req,res)=>{run('DELETE FROM transport_regels WHERE id=?',[req.params.id]);res.json({ok:true});});

  // ── TRANSPORT RITTEN ──
  function _bakkenVoorTaak(taak){
    // Tel het totaal aantal bakken voor een transport_taken op basis van gekoppelde thema's
    if(!taak.kampmoment_id) return 0;
    const kts=all('SELECT thema_id FROM kampmoment_themas WHERE kampmoment_id=?',[taak.kampmoment_id]);
    let tot=0;
    kts.forEach(kt=>{
      tot+=get('SELECT COUNT(*) as n FROM thema_bakken WHERE thema_id=?',[kt.thema_id])?.n||0;
    });
    return tot;
  }
  function _ritMetTaken(rit){
    if(!rit) return null;
    const taken=all('SELECT * FROM transport_taken WHERE rit_id=? ORDER BY tijd',[rit.id]);
    const regels=all('SELECT * FROM transport_regels');
    const takenMet=taken.map(t=>({...t, regels: regels.filter(r=>r.taak_id===t.id)}));
    const bakken_totaal=takenMet.reduce((s,t)=>s+_bakkenVoorTaak(t),0);
    return {...rit, taken: takenMet, bakken_totaal};
  }
  app.get('/api/ritten',(req,res)=>{
    const ritten=all('SELECT * FROM transport_ritten ORDER BY datum');
    res.json(ritten.map(_ritMetTaken));
  });
  app.post('/api/ritten',(req,res)=>{
    let {datum,chauffeur,personeel_id,opmerking,status,taak_ids}=req.body;
    if(!datum) return res.status(400).json({error:'Datum is verplicht'});
    // S3.1: UI kiest chauffeur voortaan uit personeel (rol='chauffeur'). We slaan personeel_id
    // op ÉN blijven de naam in het bestaande vrije-tekstveld chauffeur zetten, zodat alles wat
    // de naam toont (rit-kaartjes, /rit/:token, filters) blijft werken zonder aan te passen.
    if(personeel_id&&!chauffeur){const p=get('SELECT naam FROM personeel WHERE id=?',[personeel_id]);if(p)chauffeur=p.naam;}
    const id=insMetLog(req,'INSERT INTO transport_ritten (datum,chauffeur,personeel_id,opmerking,status,created_at) VALUES (?,?,?,?,?,?)',
      [datum,chauffeur||'',personeel_id||null,opmerking||'',status||'gepland',now()]);
    if(Array.isArray(taak_ids)) taak_ids.forEach(tid=>{
      updateMetLog(req,'UPDATE transport_taken SET rit_id=?,datum=?,wie=? WHERE id=?',[id,datum,chauffeur||'',tid]);
    });
    res.json(_ritMetTaken(get('SELECT * FROM transport_ritten WHERE id=?',[id])));
  });
  app.put('/api/ritten/:id',(req,res)=>{
    let {datum,chauffeur,personeel_id,opmerking,status,voertuig}=req.body;
    const rit=get('SELECT * FROM transport_ritten WHERE id=?',[req.params.id]);
    if(!rit) return res.status(404).json({error:'Rit niet gevonden'});
    if(personeel_id&&!chauffeur){const p=get('SELECT naam FROM personeel WHERE id=?',[personeel_id]);if(p)chauffeur=p.naam;}
    updateMetLog(req,'UPDATE transport_ritten SET datum=?,chauffeur=?,personeel_id=?,opmerking=?,status=?,voertuig=? WHERE id=?',
      [datum||rit.datum,
       chauffeur!==undefined?chauffeur:rit.chauffeur,
       personeel_id!==undefined?(personeel_id||null):rit.personeel_id,
       opmerking!==undefined?opmerking:rit.opmerking,
       status||rit.status,
       voertuig!==undefined?voertuig:(rit.voertuig||''),
       req.params.id]);
    if(datum&&datum!==rit.datum) updateMetLog(req,'UPDATE transport_taken SET datum=? WHERE rit_id=?',[datum,req.params.id]);
    if(chauffeur!==undefined&&chauffeur!==rit.chauffeur) updateMetLog(req,'UPDATE transport_taken SET wie=? WHERE rit_id=?',[chauffeur,req.params.id]);
    res.json(_ritMetTaken(get('SELECT * FROM transport_ritten WHERE id=?',[req.params.id])));
  });
  app.delete('/api/ritten/:id',(req,res)=>{
    const leden=all('SELECT * FROM transport_taken WHERE rit_id=?',[req.params.id]);
    leden.forEach(t=>{
      if(t.spoed_kind){
        // Spoedtransport mag geen datum verliezen → eigen verse rit
        const nid=insMetLog(req,'INSERT INTO transport_ritten (datum,chauffeur,opmerking,status,created_at) VALUES (?,?,?,?,?)',
          [t.datum,t.wie||'','Spoedtransport','gepland',now()]);
        updateMetLog(req,'UPDATE transport_taken SET rit_id=? WHERE id=?',[nid,t.id]);
      } else {
        updateMetLog(req,"UPDATE transport_taken SET rit_id=NULL,datum='',wie='' WHERE id=?",[t.id]);
      }
    });
    delMetLog(req,'DELETE FROM transport_ritten WHERE id=?',[req.params.id]);
    res.json({ok:true});
  });
  // ── VOERTUIGTYPES ──
  app.get('/api/voertuig-types',(req,res)=>res.json(all('SELECT * FROM voertuig_types ORDER BY capaciteit_bakken')));
  app.post('/api/voertuig-types',(req,res)=>{
    const{naam,capaciteit_bakken,capaciteit_label}=req.body;
    if(!naam)return res.status(400).json({error:'Naam is verplicht'});
    const id=ins('INSERT OR IGNORE INTO voertuig_types (naam,capaciteit_bakken,capaciteit_label) VALUES (?,?,?)',
      [naam,capaciteit_bakken||0,capaciteit_label||naam]);
    res.json(get('SELECT * FROM voertuig_types WHERE naam=?',[naam]));
  });
  app.put('/api/voertuig-types/:id',(req,res)=>{
    const{naam,capaciteit_bakken,capaciteit_label}=req.body;
    const vt=get('SELECT * FROM voertuig_types WHERE id=?',[req.params.id]);
    if(!vt)return res.status(404).json({error:'Niet gevonden'});
    run('UPDATE voertuig_types SET naam=?,capaciteit_bakken=?,capaciteit_label=? WHERE id=?',
      [naam||vt.naam,capaciteit_bakken!=null?capaciteit_bakken:vt.capaciteit_bakken,
       capaciteit_label||vt.capaciteit_label,req.params.id]);
    res.json(get('SELECT * FROM voertuig_types WHERE id=?',[req.params.id]));
  });
  app.delete('/api/voertuig-types/:id',(req,res)=>{run('DELETE FROM voertuig_types WHERE id=?',[req.params.id]);res.json({ok:true});});

  // ── VERHUIS CHECKS (persistente klaarzet-checklist per rit) ──
  app.get('/api/ritten/:id/checks',(req,res)=>{
    _syncChecksRit(parseInt(req.params.id));
    const checks=all('SELECT * FROM verhuis_checks WHERE rit_id=? ORDER BY item_soort,sort_order,id',[req.params.id]);
    const rit=get('SELECT klaarzet_status,klaarzet_door,klaarzet_op,voertuig FROM transport_ritten WHERE id=?',[req.params.id]);
    res.json({checks,klaarzet:rit||{}});
  });
  // Initialiseer checks vanuit de transport_regels van de rit
  app.post('/api/ritten/:id/checks/init',(req,res)=>{
    const rit_id=parseInt(req.params.id);
    const rit=get('SELECT * FROM transport_ritten WHERE id=?',[rit_id]);
    if(!rit)return res.status(404).json({error:'Rit niet gevonden'});
    const taken=all('SELECT * FROM transport_taken WHERE rit_id=?',[rit_id]);
    const alle_regels=[];
    taken.forEach(t=>{
      all('SELECT * FROM transport_regels WHERE taak_id=?',[t.id]).forEach(r=>alle_regels.push({...r,_taak_id:t.id,_taak_opmerking:t.opmerking,_taak_type:t.type}));
    });
    if(!alle_regels.length)return res.status(400).json({error:'Geen materiaalregels gevonden in deze rit'});
    _syncChecksRit(rit_id);
    run('DELETE FROM verhuis_checks WHERE rit_id=?',[rit_id]);
    alle_regels.forEach((r,i)=>{
      ins('INSERT INTO verhuis_checks (rit_id,item_naam,item_soort,qty,status,sort_order,item_type_id,bak_id,attribuut_id,taak_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [rit_id,r.naam,r.soort||'andere',r.qty||1,'wacht',i,r.item_type_id||resolveItemTypeId(r.naam,undefined,false),r.bak_id||null,r.attribuut_id||null,r._taak_id||null]);
    });
    const checks=all('SELECT * FROM verhuis_checks WHERE rit_id=? ORDER BY item_soort,sort_order',[rit_id]);
    res.json({ok:true,aangemaakt:checks.length,checks});
  });
  // Update één check (status, notitie, naam)
  app.get('/api/checks/item-historie',(req,res)=>{
    const naam=req.query.naam||'';
    if(!naam)return res.json([]);
    // Zoek alle checks met deze naam, joined met rit en locatie
    const rows=all(`
      SELECT vc.*,
        r.datum AS rit_datum, r.chauffeur, r.voertuig,
        GROUP_CONCAT(DISTINCT l.name) AS locaties
      FROM verhuis_checks vc
      JOIN transport_ritten r ON vc.rit_id=r.id
      LEFT JOIN transport_taken tt ON tt.rit_id=r.id
      LEFT JOIN locaties l ON (tt.van_locatie_id=l.id OR tt.naar_locatie_id=l.id)
      WHERE LOWER(vc.item_naam)=LOWER(?)
      GROUP BY vc.id
      ORDER BY r.datum DESC, vc.id DESC
      LIMIT 50
    `,[naam]);
    res.json(rows);
  });
  app.put('/api/checks/:id',(req,res)=>{
    const cur=get('SELECT * FROM verhuis_checks WHERE id=?',[req.params.id]);
    if(!cur)return res.status(404).json({error:'Check niet gevonden'});
    const status=req.body.status!==undefined?req.body.status:cur.status;
    const notitie=req.body.notitie!==undefined?req.body.notitie:cur.notitie;
    const door=req.body.aangevinkt_door!==undefined?req.body.aangevinkt_door:cur.aangevinkt_door;
    const op=(status!==cur.status)?now():cur.aangevinkt_op;
    run('UPDATE verhuis_checks SET status=?,notitie=?,aangevinkt_door=?,aangevinkt_op=? WHERE id=?',[status,notitie,door,op,req.params.id]);
    res.json(get('SELECT * FROM verhuis_checks WHERE id=?',[req.params.id]));
  });
  // Markeer rit als klaargezet
  app.post('/api/ritten/:id/klaarzet',(req,res)=>{
    const{naam}=req.body;
    if(!naam)return res.status(400).json({error:'Naam is verplicht'});
    const tijdstip=now();
    updateMetLog(req,'UPDATE transport_ritten SET klaarzet_status=?,klaarzet_door=?,klaarzet_op=? WHERE id=?',['klaar',naam,tijdstip,req.params.id]);
    res.json({ok:true,klaarzet_door:naam,klaarzet_op:tijdstip});
  });

  // ── S3.6: chauffeurspagina interactief — twee vink-fases per bak/attribuut ──
  // Werkt UITSLUITEND op het rit-token (publiek pad, geen sessietoken), en enkel op checks
  // die bij die specifieke rit horen — zie de auth-poort-uitzondering /api/rit-token/.
  function _pasBakAttribuutStatusToe(regels, veld, rit, req){
    // veld: 'onderweg' bij volledig geladen, of {naar_locatie_id} bij volledig gelost
    // S5.3: elke statuswijziging via transport wordt ook naar activiteiten_log geschreven,
    // zodat /api/waar-is de volledige reis toont (niet enkel handmatige verplaatsingen).
    const chauffeur=(rit&&rit.chauffeur)||'onbekende chauffeur';
    const ritNr=rit?rit.id:'?';
    regels.forEach(c=>{
      // V3a: bulk-rijen nooit rechtstreeks op 'onderweg' — hun status wordt afgeleid uit bulk_spreiding.
      const _bk=c.bak_id?get('SELECT is_bulk FROM bakken WHERE id=?',[c.bak_id]):null;
      if(c.bak_id&&!(_bk&&_bk.is_bulk)){
        if(veld==='onderweg'){
          updateMetLog(req,"UPDATE bakken SET status='onderweg' WHERE id=?",[c.bak_id],'rit-link');
          const b=get('SELECT * FROM bakken WHERE id=?',[c.bak_id]);
          if(b)logAct('bak','geladen',`Bak "${b.naam}" (${b.code||'-'}) geladen voor rit #${ritNr} door ${chauffeur}`,null,null);
        }else{
          const b=get('SELECT * FROM bakken WHERE id=?',[c.bak_id]);
          if(b){const st=veld.naar_locatie_id==b.thuislocatie_id?'thuis':'op_locatie';
            updateMetLog(req,'UPDATE bakken SET huidige_locatie_id=?,status=? WHERE id=?',[veld.naar_locatie_id,st,c.bak_id],'rit-link');
            const loc=get('SELECT name FROM locaties WHERE id=?',[veld.naar_locatie_id]);
            logAct('bak','gelost',`Bak "${b.naam}" (${b.code||'-'}) gelost op ${loc?.name||'?'} (rit #${ritNr}) door ${chauffeur}`,veld.naar_locatie_id,loc?.name);}
        }
      }
      if(c.attribuut_id){
        if(veld==='onderweg'){
          run("UPDATE attributen SET status='onderweg' WHERE id=?",[c.attribuut_id]);
          const a=get('SELECT * FROM attributen WHERE id=?',[c.attribuut_id]);
          if(a)logAct('attribuut','geladen',`Attribuut "${a.naam}" (${a.code||'-'}) geladen voor rit #${ritNr} door ${chauffeur}`,null,null);
        }else{
          const a=get('SELECT * FROM attributen WHERE id=?',[c.attribuut_id]);
          if(a){const st=veld.naar_locatie_id==a.thuislocatie_id?'thuis':'op_locatie';
            run('UPDATE attributen SET huidige_locatie_id=?,status=? WHERE id=?',[veld.naar_locatie_id,st,c.attribuut_id]);
            const loc=get('SELECT name FROM locaties WHERE id=?',[veld.naar_locatie_id]);
            logAct('attribuut','gelost',`Attribuut "${a.naam}" (${a.code||'-'}) gelost op ${loc?.name||'?'} (rit #${ritNr}) door ${chauffeur}`,veld.naar_locatie_id,loc?.name);}
        }
      }
    });
  }
  function _ritVanToken(token){ return get('SELECT * FROM transport_ritten WHERE rit_token=?',[token]); }
  app.post('/api/rit-token/:token/checks/:checkId/laden',(req,res)=>{
    const rit=_ritVanToken(req.params.token);
    if(!rit)return res.status(403).json({error:'Ongeldig of verlopen token'});
    const check=get('SELECT * FROM verhuis_checks WHERE id=?',[req.params.checkId]);
    if(!check||check.rit_id!==rit.id)return res.status(403).json({error:'Deze regel hoort niet bij deze rit'});
    const nieuw=check.geladen?0:1;
    run('UPDATE verhuis_checks SET geladen=?,geladen_door=?,geladen_op=? WHERE id=?',
      [nieuw,nieuw?(rit.chauffeur||''):'',nieuw?now():'',check.id]);
    // V3a punt 2: eerste stuk geladen → rit 'onderweg'
    if(nieuw&&(!rit.status||rit.status==='gepland'))updateMetLog(req,"UPDATE transport_ritten SET status='onderweg' WHERE id=?",[rit.id],'rit-link');
    if(check.taak_id){
      const groep=all('SELECT * FROM verhuis_checks WHERE taak_id=?',[check.taak_id]);
      const alleGeladen=groep.length>0 && groep.every(c=>c.id===check.id?nieuw:c.geladen);
      if(alleGeladen)_pasBakAttribuutStatusToe(groep,'onderweg',rit,req);
    }
    res.json(get('SELECT * FROM verhuis_checks WHERE id=?',[check.id]));
  });
  app.post('/api/rit-token/:token/checks/:checkId/lossen',(req,res)=>{
    const rit=_ritVanToken(req.params.token);
    if(!rit)return res.status(403).json({error:'Ongeldig of verlopen token'});
    const check=get('SELECT * FROM verhuis_checks WHERE id=?',[req.params.checkId]);
    if(!check||check.rit_id!==rit.id)return res.status(403).json({error:'Deze regel hoort niet bij deze rit'});
    const nieuw=check.gelost?0:1;
    // V3a: is dit het laatste stuk van de stop, dan eerst controleren of de taak af kan (bulk-voorraad
    // op de bron) — anders 409 en blijft het vinkje uit.
    let groep=[],taak=null,wordtVolledig=false;
    if(check.taak_id){
      taak=get('SELECT * FROM transport_taken WHERE id=?',[check.taak_id]);
      groep=all('SELECT * FROM verhuis_checks WHERE taak_id=?',[check.taak_id]);
      wordtVolledig=nieuw&&groep.length>0&&groep.every(c=>c.id===check.id?nieuw:c.gelost);
      if(wordtVolledig&&taak&&taak.status!=='gedaan'){const f=_controleerTaakAf(taak);if(f)return res.status(409).json({error:f});}
    }
    run('UPDATE verhuis_checks SET gelost=?,gelost_door=?,gelost_op=? WHERE id=?',
      [nieuw,nieuw?(rit.chauffeur||''):'',nieuw?now():'',check.id]);
    // Alle regels van de stop gelost → taak 'gedaan' met exact dezelfde boekhouding als de kantoorknop.
    // (Een vinkje terug uitzetten draait een afgeronde taak NIET terug — dat doet kantoor.)
    if(wordtVolledig&&taak&&taak.status!=='gedaan'){
      const r=_rondTaakAf(req,taak.id,'rit-link');
      if(r.fout){run('UPDATE verhuis_checks SET gelost=0,gelost_door=?,gelost_op=? WHERE id=?',['','',check.id]);return res.status(r.status).json({error:r.fout});}
    }
    res.json(get('SELECT * FROM verhuis_checks WHERE id=?',[check.id]));
  });
  // V3a punt 2: chauffeur meldt "aangekomen" per stop.
  app.post('/api/rit-token/:token/taken/:taakId/aangekomen',(req,res)=>{
    const rit=_ritVanToken(req.params.token);
    if(!rit)return res.status(403).json({error:'Ongeldig of verlopen token'});
    const taak=get('SELECT * FROM transport_taken WHERE id=?',[req.params.taakId]);
    if(!taak||taak.rit_id!==rit.id)return res.status(403).json({error:'Deze stop hoort niet bij deze rit'});
    if(taak.status!=='gedaan')updateMetLog(req,"UPDATE transport_taken SET status='aangekomen' WHERE id=?",[taak.id],'rit-link');
    if(!rit.status||rit.status==='gepland')updateMetLog(req,"UPDATE transport_ritten SET status='onderweg' WHERE id=?",[rit.id],'rit-link');
    res.json(get('SELECT * FROM transport_taken WHERE id=?',[taak.id]));
  });

  // ── TERUGKOMST ──
  app.post('/api/terugkomst',(req,res)=>{
    const{kampmoment_id,datum,notities,regels}=req.body;
    if(!kampmoment_id)return res.status(400).json({error:'kampmoment_id vereist'});
    const rid=ins('INSERT INTO terugkomst_rapporten (kampmoment_id,datum,notities,created_at) VALUES (?,?,?,?)',
      [kampmoment_id,datum||isoDate(new Date()),notities||'',now()]);
    (regels||[]).forEach(r=>{
      db.run('INSERT INTO terugkomst_regels (rapport_id,item_naam,set_id,status,opmerking) VALUES (?,?,?,?,?)',
        [rid,r.item_naam,r.set_id||null,r.status||'ok',r.opmerking||'']);
    });
    // Update sportset-locatie naar eigen stockage_locatie_id (of globale sport-stockage als fallback)
    const defaultSportStockage=get("SELECT id FROM locaties WHERE type='stockage' AND (stockage_rol='sport' OR stockage_rol='beide') ORDER BY id LIMIT 1");
    (regels||[]).filter(r=>r.set_id).forEach(r=>{
      // Gebruik de stockage_locatie_id van het sport_item; fallback naar globale sport-stockage
      const setItem=get('SELECT si.stockage_locatie_id FROM sport_sets ss LEFT JOIN sport_items si ON si.id=ss.item_id WHERE ss.id=?',[r.set_id]);
      const homeId=(setItem&&setItem.stockage_locatie_id)||defaultSportStockage?.id;
      if(homeId) run('UPDATE sport_sets SET locatie_id=? WHERE id=?',[homeId,r.set_id]);
    });
    const km=get('SELECT k.*,l.name as loc_naam FROM kampmomenten k LEFT JOIN locaties l ON l.id=k.locatie_id WHERE k.id=?',[kampmoment_id]);
    const schade=(regels||[]).filter(r=>r.status==='schade').length;
    const vermist=(regels||[]).filter(r=>r.status==='vermist').length;
    const extra=[schade?`${schade} beschadigd`:'',vermist?`${vermist} vermist`:''].filter(Boolean).join(', ');
    logAct('terugkomst','aangemaakt',
      `Terugkomst ${km?.loc_naam||'?'} week ${km?.week||'?'}`+(extra?` — ${extra}`:''),
      km?.locatie_id,km?.loc_naam);
    res.json(get('SELECT * FROM terugkomst_rapporten WHERE id=?',[rid]));
  });
  app.get('/api/terugkomst',(req,res)=>{
    const rapp=all('SELECT r.*,l.name as loc_naam FROM terugkomst_rapporten r LEFT JOIN kampmomenten k ON k.id=r.kampmoment_id LEFT JOIN locaties l ON l.id=k.locatie_id ORDER BY r.id DESC');
    res.json(rapp.map(r=>({...r,regels:all('SELECT * FROM terugkomst_regels WHERE rapport_id=?',[r.id])})));
  });

  // ── SPOEDTRANSPORT ──
  // Maakt een dringend transport. Voorraad wordt pas aangepast bij status "gedaan".
  app.post('/api/spoedtransport',(req,res)=>{
    const {datum,tijd,van_locatie_id,naar_locatie_id,item,qty,kind,ref_id} = req.body;
    const naam=(item||'').trim();
    if(!naam) return res.status(400).json({error:'Item is verplicht'});
    const aantal=Math.max(1,parseInt(qty)||1);
    const ts=now();
    const spoedDatum=datum||isoDate(new Date());
    // Eigen 1-op-1 rit zodat spoed uniform op de weekplanner verschijnt
    const ritId=insMetLog(req,'INSERT INTO transport_ritten (datum,chauffeur,opmerking,status,created_at) VALUES (?,?,?,?,?)',
      [spoedDatum,'','Spoedtransport','gepland',ts]);
    // spoed_effect_toegepast=0: wordt pas verwerkt wanneer status → "gedaan"
    const taakId=insMetLog(req,'INSERT INTO transport_taken (type,datum,tijd,van_locatie_id,naar_locatie_id,opmerking,wie,status,created_at,spoed_kind,spoed_ref_id,spoed_effect_toegepast,rit_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      ['extra',spoedDatum,tijd||'09:00',van_locatie_id||null,naar_locatie_id||null,'🚨 Spoed: '+naam,'','gepland',ts,kind||'',ref_id||0,0,ritId]);
    ins('INSERT INTO transport_regels (taak_id,naam,qty,soort,item_type_id) VALUES (?,?,?,?,?)',[taakId,naam,aantal,'spoed',resolveItemTypeId(naam,undefined,false)]);
    res.json(get('SELECT * FROM transport_taken WHERE id=?',[taakId]));
  });

  // Helper: pas spoed-voorraadeffect toe voor één transport
  function _pasSpoedEffectToe(taak,req) {
    if(!taak||taak.spoed_effect_toegepast||!taak.spoed_kind)return;
    const kind=taak.spoed_kind;
    const ref_id=taak.spoed_ref_id;
    const van=taak.van_locatie_id;
    const naar=taak.naar_locatie_id;
    const regels=all('SELECT * FROM transport_regels WHERE taak_id=? AND soort=\'spoed\'',[taak.id]);
    const aantal=regels.reduce((s,r)=>s+(parseInt(r.qty)||1),0)||1;
    if(kind==='verbruik'&&ref_id&&van){
      run('INSERT OR IGNORE INTO verbruik_stock(item_id,locatie_id,qty,minimum,eenheid) VALUES(?,?,0,0,\'stuks\')',[ref_id,van]);
      run('UPDATE verbruik_stock SET qty=MAX(0,qty-?) WHERE item_id=? AND locatie_id=?',[aantal,ref_id,van]);
      ins('INSERT INTO verbruik_log(item_id,locatie_id,delta,reden,wie,transport_id,datum,created_at) VALUES(?,?,?,?,?,?,?,?)',
        [ref_id,van,-aantal,'Spoedtransport (gedaan)','',taak.id,isoDate(new Date()),new Date().toISOString()]);
    } else if(kind==='gedeeld'&&ref_id){
      const gi=get('SELECT * FROM gedeeld_items WHERE id=?',[ref_id]);
      if(gi) ensureGedeeldStock(gi);
      if(van){
        run('INSERT OR IGNORE INTO gedeeld_stock(gedeeld_id,locatie_id,qty) VALUES(?,?,0)',[ref_id,van]);
        run('UPDATE gedeeld_stock SET qty=MAX(0,qty-?) WHERE gedeeld_id=? AND locatie_id=?',[aantal,ref_id,van]);
      }
      if(naar){
        run('INSERT OR IGNORE INTO gedeeld_stock(gedeeld_id,locatie_id,qty) VALUES(?,?,0)',[ref_id,naar]);
        run('UPDATE gedeeld_stock SET qty=qty+? WHERE gedeeld_id=? AND locatie_id=?',[aantal,ref_id,naar]);
      }
    }
    updateMetLog(req,'UPDATE transport_taken SET spoed_effect_toegepast=1 WHERE id=?',[taak.id]);
  }

  // ── CHAUFFEUR-VIEW ──
  app.post('/api/ritten/:id/token',(req,res)=>{
    const rit=get('SELECT * FROM transport_ritten WHERE id=?',[req.params.id]);
    if(!rit)return res.status(404).json({error:'Rit niet gevonden'});
    let tok=rit.rit_token;
    if(!tok){tok=_genToken(10);updateMetLog(req,'UPDATE transport_ritten SET rit_token=? WHERE id=?',[tok,req.params.id]); }
    res.json({token:tok,url:'/rit/'+tok});
  });
  // V3a punt 4: elke stop krijgt zijn bakkenlijst op de rit-pagina zonder "Klaarzetten".
  // Taken zonder checks krijgen ze hier uit hun regels; een (oude) ophaling zonder regels krijgt
  // eerst regels afgeleid uit wat volgens de db op die locatie staat voor dat kampmoment.
  function _leidOphaalRegelsAf(taak){
    const locId=taak.van_locatie_id;
    const km=taak.kampmoment_id?get('SELECT * FROM kampmomenten WHERE id=?',[taak.kampmoment_id]):null;
    if(!locId||!km)return 0;
    const {bakken,attributen}=_kvVerwacht(km);
    let n=0;
    bakken.forEach(b=>{
      if(b.is_bulk){
        const sp=get('SELECT aantal FROM bulk_spreiding WHERE bak_id=? AND locatie_id=?',[b.id,locId]);
        if(sp&&sp.aantal>0){ins('INSERT INTO transport_regels (taak_id,naam,qty,soort,item_type_id,bak_id) VALUES (?,?,?,?,?,?)',[taak.id,`${sp.aantal} × ${b.naam}`,sp.aantal,'vast',null,b.id]);n++;}
      } else if(b.huidige_locatie_id===locId){
        ins('INSERT INTO transport_regels (taak_id,naam,qty,soort,item_type_id,bak_id) VALUES (?,?,?,?,?,?)',[taak.id,`Bak ${b.naam}${b.code?' ('+b.code+')':''}`,1,b.soort==='thema'?'thema':'vast',null,b.id]);n++;
      }
    });
    attributen.filter(a=>a.huidige_locatie_id===locId).forEach(a=>{
      ins('INSERT INTO transport_regels (taak_id,naam,qty,soort,item_type_id,attribuut_id) VALUES (?,?,?,?,?,?)',[taak.id,`${a.naam}${a.code?' ('+a.code+')':''}`,1,'attribuut',null,a.id]);n++;
    });
    return n;
  }
  function _zorgVoorChecks(rit){
    _syncChecksRit(rit.id);
    const taken=all('SELECT * FROM transport_taken WHERE rit_id=?',[rit.id]);
    let volg=(get('SELECT MAX(sort_order) AS m FROM verhuis_checks WHERE rit_id=?',[rit.id])||{}).m;volg=volg==null?0:volg+1;
    taken.forEach(t=>{
      if(get('SELECT id FROM verhuis_checks WHERE taak_id=? LIMIT 1',[t.id]))return;
      let regels=all('SELECT * FROM transport_regels WHERE taak_id=?',[t.id]);
      if(!regels.length&&t.type==='ophaling'&&_leidOphaalRegelsAf(t))regels=all('SELECT * FROM transport_regels WHERE taak_id=?',[t.id]);
      regels.forEach(r=>ins('INSERT INTO verhuis_checks (rit_id,item_naam,item_soort,qty,status,sort_order,item_type_id,bak_id,attribuut_id,taak_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [rit.id,r.naam,r.soort||'andere',r.qty||1,'wacht',volg++,r.item_type_id||resolveItemTypeId(r.naam,undefined,false),r.bak_id||null,r.attribuut_id||null,t.id]));
    });
  }
  app.get('/rit/:token',(req,res)=>{
    const rit=get('SELECT * FROM transport_ritten WHERE rit_token=?',[req.params.token]);
    if(!rit)return res.status(404).send('<h2 style="font-family:system-ui;padding:2rem">Rit niet gevonden of link verlopen.</h2>');
    _zorgVoorChecks(rit);
    const taken=all(`SELECT tt.*,fl.name AS van_naam,tl.name AS naar_naam,km.week AS km_week
      FROM transport_taken tt
      LEFT JOIN locaties fl ON tt.van_locatie_id=fl.id
      LEFT JOIN locaties tl ON tt.naar_locatie_id=tl.id
      LEFT JOIN kampmomenten km ON tt.kampmoment_id=km.id
      WHERE tt.rit_id=? ORDER BY tt.tijd`,[rit.id]);
    const checks=all('SELECT * FROM verhuis_checks WHERE rit_id=? ORDER BY sort_order',[rit.id]);
    const typeIcon={levering:'📦',ophaling:'📤',transfer:'🔄'};
    const stops=taken.map(t=>`<div class="stop">
      <div class="type">${typeIcon[t.type]||'🚚'} ${t.type==='levering'?'Levering':t.type==='ophaling'?'Ophaling':'Transfer'}${t.km_week?' (week '+t.km_week+')':''}</div>
      <div class="nm">${t.opmerking||'(zonder naam)'}</div>
      <div class="rt">${t.van_naam||'Stockage'} → ${t.naar_naam||'Stockage'}</div>
      ${t.tijd?'<div class="ti">⏰ '+t.tijd+'</div>':''}
      <div class="fasebtns"><button type="button" class="fbtn ${t.status==='aangekomen'||t.status==='gedaan'?'done':''}" id="stop-${t.id}" onclick="aangekomen(${t.id})">${t.status==='gedaan'?'✅ Stop afgerond':t.status==='aangekomen'?'📍 Aangekomen':'📍 Ik ben aangekomen'}</button></div></div>`).join('');
    // Chauffeur ziet bakken, geen inhoud: groepeer per rek (eerste letter van de code in de naam)
    // zodat rek per rek gelopen kan worden.
    function _rekVan(c){const m=(c.item_naam||'').match(/\(([A-Za-z])[0-9]*\)/);return m?m[1].toUpperCase():null;}
    const chkByRek={};
    checks.forEach(c=>{const r=(c.item_soort==='thema'||c.item_soort==='attribuut'||c.item_soort==='vast')?(_rekVan(c)||'Overig'):'Overig';(chkByRek[r]=chkByRek[r]||[]).push(c);});
    const rekKeys=Object.keys(chkByRek).sort((a,b)=>a==='Overig'?1:b==='Overig'?-1:a.localeCompare(b));
    // S3.6: twee vink-fases per bak/attribuut (laden bij vertrek, lossen bij aankomst).
    // Alleen thema/attribuut/vast-regels (= bakken/attributen, geen basis-materiaal) krijgen
    // de fase-knoppen — basis-materiaal blijft de oude eenvoudige status-weergave.
    const chkRows=rekKeys.map(rek=>{
      const rows=chkByRek[rek].map(c=>{
        const isBak=c.item_soort==='thema'||c.item_soort==='attribuut'||c.item_soort==='vast';
        if(!isBak){
          return `<div class="chk ${c.status}">
            <span class="ico">${c.status==='ok'?'✅':c.status==='ontbreekt'?'❌':c.status==='deels'?'⚠️':'⬜'}</span>
            <span class="nm">${c.item_naam||''}</span>
            <span class="qty">×${c.qty}</span>
            ${c.notitie?'<div class="nt">'+c.notitie+'</div>':''}</div>`;
        }
        return `<div class="chk fase" id="chk-${c.id}">
          <span class="nm">${c.item_naam||''}</span>
          <span class="qty">×${c.qty}</span>
          <div class="fasebtns">
            <button type="button" class="fbtn b-laden ${c.geladen?'done':''}" onclick="tog(${c.id},'laden')">${c.geladen?'✅ Geladen':'⬆️ Laden'}</button>
            <button type="button" class="fbtn b-lossen ${c.gelost?'done':''}" onclick="tog(${c.id},'lossen')">${c.gelost?'✅ Gelost':'⬇️ Lossen'}</button>
          </div></div>`;
      }).join('');
      return (rek!=='Overig'?`<div class="rek">📍 Rek ${rek}</div>`:'')+rows;
    }).join('');
    res.send(`<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rit ${rit.datum}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;background:#f5f5f5;color:#1a1a1a}
.hdr{background:#2563eb;color:#fff;padding:14px 16px}.hdr h1{font-size:18px;font-weight:700}.hdr .sub{font-size:13px;opacity:.8;margin-top:2px}
.sec{padding:10px 16px 4px;font-size:11px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #e5e5e5;margin-top:8px}
.stop{background:#fff;border-left:4px solid #2563eb;margin:8px 10px;border-radius:6px;padding:12px 14px}
.stop .type{font-size:11px;color:#2563eb;font-weight:700;margin-bottom:2px}
.stop .nm{font-size:15px;font-weight:600}.stop .rt{font-size:12px;color:#666;margin-top:2px}.stop .ti{font-size:12px;color:#2563eb;margin-top:4px}
.chk{background:#fff;margin:6px 10px;border-radius:6px;padding:10px 12px;display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.chk.ok{background:#f0fff4;border-left:3px solid #22c55e}.chk.ontbreekt{background:#fff1f1;border-left:3px solid #ef4444}.chk.deels{background:#fffbeb;border-left:3px solid #f59e0b}
.chk .ico{font-size:18px;flex-shrink:0}.chk .nm{flex:1;font-size:14px}.chk .qty{font-size:12px;color:#888}.chk .nt{width:100%;font-size:11px;color:#888;font-style:italic}
.chk.fase{flex-direction:column;align-items:stretch}
.chk.fase .nm{flex:none}
.fasebtns{display:flex;gap:8px;margin-top:6px;width:100%}
.fbtn{flex:1;min-height:48px;border-radius:8px;border:1.5px solid #cbd5e1;background:#fff;color:#334155;font-size:14px;font-weight:600;font-family:inherit}
.fbtn.done{background:#dcfce7;border-color:#22c55e;color:#166534}
.rek{margin:10px 10px 2px;font-size:12px;font-weight:700;color:#2563eb}
.footer{padding:20px 16px;text-align:center;font-size:12px;color:#aaa}</style></head><body>
<div class="hdr"><h1>🚚 Rit ${rit.datum}</h1>
<div class="sub">${rit.chauffeur?'👤 '+rit.chauffeur:''}${rit.voertuig?' · 🚐 '+rit.voertuig:''} · ${taken.length} stop${taken.length!==1?'s':''}</div></div>
<div class="sec">Stops</div>${stops||'<div style="padding:16px;color:#888">Geen stops gepland.</div>'}
${checks.length?'<div class="sec">Materiaallijst ('+checks.length+' items)</div>'+chkRows:''}
<div class="footer">Sporty Logistics</div>
<script>
const TOKEN=${JSON.stringify(req.params.token)};
async function aangekomen(id){
  const b=document.getElementById('stop-'+id);b.disabled=true;
  try{const r=await fetch('/api/rit-token/'+TOKEN+'/taken/'+id+'/aangekomen',{method:'POST'});const t=await r.json();
    if(!r.ok){alert(t.error||'Fout bij opslaan');return;}
    b.textContent=t.status==='gedaan'?'✅ Stop afgerond':'📍 Aangekomen';b.classList.add('done');}
  catch(e){alert('Netwerkfout — probeer opnieuw.');}finally{b.disabled=false;}
}
async function tog(id,kind){
  const row=document.getElementById('chk-'+id);
  const btns=row.querySelectorAll('.fbtn');
  btns.forEach(b=>b.disabled=true);
  try{
    const r=await fetch('/api/rit-token/'+TOKEN+'/checks/'+id+'/'+kind,{method:'POST'});
    const c=await r.json();
    if(!r.ok){alert(c.error||'Fout bij opslaan');return;}
    const bl=row.querySelector('.b-laden'), bg=row.querySelector('.b-lossen');
    bl.textContent=c.geladen?'✅ Geladen':'⬆️ Laden'; bl.classList.toggle('done',!!c.geladen);
    bg.textContent=c.gelost?'✅ Gelost':'⬇️ Lossen'; bg.classList.toggle('done',!!c.gelost);
  }catch(e){alert('Netwerkfout — probeer opnieuw.');}
  finally{btns.forEach(b=>b.disabled=false);}
}
</script>
</body></html>`);
  });

  // ── VOERTUIGBEZETTING ──
  app.get('/api/voertuig-bezetting',(req,res)=>{
    const ritten=all('SELECT r.*,(SELECT COUNT(*) FROM transport_taken t WHERE t.rit_id=r.id) AS tak_count FROM transport_ritten r ORDER BY r.datum');
    const byWeek={};
    ritten.forEach(r=>{
      const d=r.datum?new Date(r.datum+'T12:00:00'):null;
      const key=d?`Week ${Math.ceil((d-new Date(d.getFullYear(),0,1))/(7*24*3600*1000))} (${r.datum.substring(0,7)})`:(r.datum||'Geen datum');
      if(!byWeek[key])byWeek[key]={label:key,ritten:[]};
      byWeek[key].ritten.push(r);
    });
    res.json(Object.values(byWeek));
  });

  // ── RETOUR STATUS ──
  app.put('/api/kampmoment-themas/:id/retour',(req,res)=>{
    const{retour_status}=req.body;
    run('UPDATE kampmoment_themas SET retour_status=? WHERE id=?',[retour_status||'',req.params.id]);
    res.json(get('SELECT * FROM kampmoment_themas WHERE id=?',[req.params.id]));
  });

};
