// routes/conflicten.js — uit server.js geknipt (F1 deel 1). Gedrag ongewijzigd.
// Kopjes: CONFLICTENDETECTOR
'use strict';
module.exports = function(ctx){
  const {app,db,get,all,run,ins,saveDb,backupDb,now,isoDate,_genToken,resolveItemTypeId,logAct,logWijziging,insMetLog,updateMetLog,delMetLog,vereisRol,alleenKantoor,hashPin,checkSessie,_actieveLocatieConfig,_kvVerwacht,_kvKampmoment,_kvNaam,_bakItems,effectiefMateriaal,ensureGedeeldStock,DATA_DIR,DB_PATH,UPLOADS_DIR,BUNDELS_DIR,FRONTEND_PATH,ROOT_DIR,APP_PASSWORD,PORT,path,fs,express,crypto} = ctx;
  // ── CONFLICTENDETECTOR ──
  app.get('/api/conflicten',(req,res)=>{
    // V2: alles binnen één periode (query ?periode_id=, standaard de actieve periode) — kampmomenten
    // van andere periodes met hetzelfde weeknummer mogen elkaar nooit "raken".
    const periodeId=parseInt(req.query.periode_id)||(get('SELECT id FROM vakantieperiodes WHERE actief=1')||{}).id||null;
    const conflicten=[];
    // Elke melding krijgt naast de (ongewijzigde) tekst gestructureerde velden; meta = {week, km:[kampmomenten]}.
    const melding=(c,meta={})=>{const kmsM=(meta.km||[]).filter(Boolean);conflicten.push({...c,week:meta.week??(kmsM[0]?.week??null),periode_id:periodeId,
      locatie_ids:[...new Set(kmsM.map(k=>k.locatie_id))],kampmoment_ids:[...new Set(kmsM.map(k=>k.id))]});};
    const locs=all('SELECT * FROM locaties');
    // 1. Zelfde thema op overlappende weken (op 2 locaties tegelijk)
    const kts=all(`SELECT kt.thema_id,kt.id AS kt_id,km.week,km.id AS km_id,km.locatie_id,l.name AS loc_nm
      FROM kampmoment_themas kt JOIN kampmomenten km ON kt.kampmoment_id=km.id JOIN locaties l ON km.locatie_id=l.id WHERE km.periode_id=?`,[periodeId]);
    const ktKm=r=>({id:r.km_id,locatie_id:r.locatie_id,week:r.week});
    const byThema={};
    kts.forEach(r=>{(byThema[r.thema_id]=byThema[r.thema_id]||[]).push(r);});
    Object.entries(byThema).forEach(([tid,rows])=>{
      for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
        if(rows[i].week===rows[j].week){
          const th=get('SELECT name FROM themas WHERE id=?',[tid]);
          melding({type:'dubbel_thema',ernst:'hoog',bericht:`Thema "${th?.name||'#'+tid}" is in week ${rows[i].week} ingepland op 2 locaties: ${rows[i].loc_nm} & ${rows[j].loc_nm}`},{week:rows[i].week,km:[ktKm(rows[i]),ktKm(rows[j])]});
        }
      }
    });
    // 2. Kampmoment zonder levering of ophaling
    const kampen=all('SELECT km.*,l.name AS loc_nm FROM kampmomenten km JOIN locaties l ON km.locatie_id=l.id WHERE km.periode_id=?',[periodeId]);
    // V2: kampmoment zonder thema (ernst laag) — vaak een vergeten koppeling.
    const kmMetThema=new Set(kts.map(r=>r.km_id));
    kampen.forEach(km=>{ if(!kmMetThema.has(km.id))melding({type:'geen_thema',ernst:'laag',bericht:`Week ${km.week} — ${km.loc_nm}: kampmoment zonder thema`},{km:[km]}); });
    kampen.forEach(km=>{
      const heeftLev=get('SELECT id FROM transport_taken WHERE kampmoment_id=? AND type=?',[km.id,'levering']);
      if(!heeftLev)melding({type:'geen_levering',ernst:'midden',bericht:`Week ${km.week} — ${km.loc_nm}: nog geen levering gepland`},{km:[km]});
      const heeftOph=get('SELECT id FROM transport_taken WHERE kampmoment_id=? AND type=?',[km.id,'ophaling']);
      if(!heeftOph)melding({type:'geen_ophaling',ernst:'laag',bericht:`Week ${km.week} — ${km.loc_nm}: nog geen ophaling gepland`},{km:[km]});
    });
    // 3. Materiaaltekort: als 2+ themas met dezelfde item_type_id-behoefte in dezelfde week
    // draaien, kan de totale vraag de beschikbare voorraad overschrijden (via item_types-koppeling,
    // nu mogelijk dankzij Migratie 47's consolidatie van bak_items/verbruik_stock naar item_types).
    {
      const bakBehoefte=all(`SELECT tb2.thema_id, bi.item_type_id, bi.qty, it.naam AS item_naam
        FROM bak_items bi JOIN bakken b ON b.id=bi.bak_id JOIN thema_bak tb2 ON tb2.bak_id=b.id JOIN item_types it ON it.id=bi.item_type_id
        WHERE bi.item_type_id IS NOT NULL`);
      const stockPerType={};
      all(`SELECT item_type_id, SUM(qty) AS totaal FROM item_type_stock WHERE item_type_id IS NOT NULL GROUP BY item_type_id`)
        .forEach(r=>{stockPerType[r.item_type_id]=r.totaal;});
      const maxWeek48=kampen.reduce((m,k)=>Math.max(m,k.week||0),0)||0;
      for(let week=1;week<=maxWeek48;week++){
        const kmsWeek=kampen.filter(k=>k.week===week);
        if(kmsWeek.length<2)continue; // tekort kan enkel ontstaan bij overlap van 2+ locaties/thema's
        const themaIdsWeek=new Set(kts.filter(r=>kmsWeek.some(km=>km.week===r.week)).map(r=>r.thema_id));
        const perType={};
        bakBehoefte.forEach(b=>{
          if(!themaIdsWeek.has(b.thema_id))return;
          perType[b.item_type_id]=perType[b.item_type_id]||{qty:0,naam:b.item_naam};
          perType[b.item_type_id].qty+=b.qty||0;
        });
        Object.entries(perType).forEach(([typeId,info])=>{
          const stock=stockPerType[typeId]||0;
          if(stock>0&&info.qty>stock){
            melding({type:'materiaal_tekort',ernst:'hoog',
              bericht:`Week ${week}: "${info.naam}" — ${info.qty} nodig over alle kampen samen, maar ${stock} op voorraad`},{week,km:kmsWeek});
          }
        });
      }
    }
    // 4. Dubbelboeking bak/attribuut: bak/attribuut nodig voor 2 kampen in dezelfde week
    // (via thema_bak/thema_attribuut + kampmoment_themas — een bak/attribuut kan bij meerdere
    // thema's horen, dus dit is onafhankelijk van conflict #1 "dubbel thema").
    {
      const bakLinks=all(`SELECT b.id AS bak_id, b.naam, b.code, tb.thema_id FROM bakken b JOIN thema_bak tb ON tb.bak_id=b.id WHERE b.soort='thema'`);
      const attrLinks=all(`SELECT a.id AS attr_id, a.naam, a.code, ta.thema_id FROM attributen a JOIN thema_attribuut ta ON ta.attribuut_id=a.id`);
      function weekBoekingen(links, idField){
        const perWeek={};
        links.forEach(l=>{
          kts.filter(kt=>kt.thema_id===l.thema_id).forEach(kt=>{
            const key=l[idField]+'|'+kt.week;
            const e=(perWeek[key]=perWeek[key]||{item:l,weeks:new Set(),week:kt.week,km:[]});e.weeks.add(kt.loc_nm+'@'+kt.week);e.km.push(ktKm(kt));
          });
        });
        return perWeek;
      }
      const bakWeek=weekBoekingen(bakLinks,'bak_id');
      Object.values(bakWeek).forEach(v=>{
        if(v.weeks.size>1){
          melding({type:'dubbelboeking_bak',ernst:'hoog',
            bericht:`Bak "${v.item.naam}" (${v.item.code||'-'}) is in dezelfde week nodig op meerdere plekken: ${[...v.weeks].join(', ')}`},{week:v.week,km:v.km});
        }
      });
      const attrWeek=weekBoekingen(attrLinks,'attr_id');
      Object.values(attrWeek).forEach(v=>{
        if(v.weeks.size>1){
          melding({type:'dubbelboeking_attribuut',ernst:'hoog',
            bericht:`Attribuut "${v.item.naam}" (${v.item.code||'-'}) is in dezelfde week nodig op meerdere plekken: ${[...v.weeks].join(', ')}`},{week:v.week,km:v.km});
        }
      });
    }
    // 5. S5.2b "elders nodig": per week heeft een locatie volgens haar locatie_config N
    // exemplaren van vast_type T nodig, maar er zijn onvoldoende VRIJE exemplaren (status=thuis,
    // dus niet geparkeerd op een andere — al dan niet tijdelijk gesloten — locatie). Enkel
    // waarschuwen, nooit automatisch weghalen (bindende regel S5).
    {
      const weken=[...new Set(kampen.map(k=>k.week).filter(w=>w!=null))].sort((a,b)=>a-b);
      const alleVastTypes=[...new Set(all("SELECT DISTINCT vast_type FROM bakken WHERE soort='vast' AND vast_type!=''").map(r=>r.vast_type))];
      weken.forEach(week=>{
        const kmsWeek=kampen.filter(k=>k.week===week);
        alleVastTypes.forEach(vt=>{
          let nodig=0;
          kmsWeek.forEach(km=>{ nodig+=_actieveLocatieConfig(km).filter(c=>c.vast_type===vt).reduce((s,c)=>s+(c.aantal||1),0); });
          if(!nodig)return;
          const alleExemplaren=all("SELECT * FROM bakken WHERE soort='vast' AND vast_type=?",[vt]);
          const vrij=alleExemplaren.filter(b=>b.status==='thuis').length;
          if(nodig>vrij){
            const bezet=alleExemplaren.filter(b=>b.status!=='thuis');
            const waar=bezet.map(b=>{const l=locs.find(l2=>l2.id===b.huidige_locatie_id);return `${b.naam} @ ${l?.name||'onbekende locatie'}`;}).join(', ')||'-';
            melding({type:'elders_nodig_vast',ernst:'hoog',
              bericht:`Week ${week}: ${nodig}× "${vt}" nodig, maar ${vrij} vrij (van ${alleExemplaren.length} totaal) — bezet: ${waar}`},{week,km:kmsWeek.filter(km=>_actieveLocatieConfig(km).some(c=>c.vast_type===vt))});
          }
        });
      });
    }
    // 6. S5.2b "elders nodig" voor kleurenborden: totale kleurbehoefte van alle open locaties
    // die week > voorraad (kleurenborden_stock) — enkel waarschuwen.
    {
      const weken=[...new Set(kampen.map(k=>k.week).filter(w=>w!=null))].sort((a,b)=>a-b);
      const kbStockTotaal={};
      all('SELECT kleur,SUM(aantal) AS totaal FROM kleurenborden_stock GROUP BY kleur').forEach(r=>{kbStockTotaal[r.kleur]=r.totaal||0;});
      const allKleurenConflict=all('SELECT * FROM locatie_kleuren WHERE periode_id=?',[periodeId]);
      weken.forEach(week=>{
        const kmsWeek=kampen.filter(k=>k.week===week);
        const behoefte={};
        kmsWeek.forEach(km=>{
          allKleurenConflict.filter(k=>k.locatie_id===km.locatie_id&&k.week===week).forEach(k=>{
            behoefte[k.kleur]=(behoefte[k.kleur]||0)+(k.aantal||0);
          });
        });
        Object.entries(behoefte).forEach(([kleur,nodig])=>{
          const voorraad=kbStockTotaal[kleur]||0;
          if(nodig>voorraad){
            melding({type:'elders_nodig_kleur',ernst:'midden',
              bericht:`Week ${week}: kleurenbord ${kleur} — ${nodig} nodig over alle open locaties samen, maar ${voorraad} op voorraad`},{week,km:kmsWeek.filter(km=>allKleurenConflict.some(k=>k.locatie_id===km.locatie_id&&k.week===week&&k.kleur===kleur))});
          }
        });
      });
    }
    // 7. S6.3(a) "ontbrekend transport": kampmoment met thema (kampmoment_themas) of sport
    // (sport_planning op locatie+week) gepland, maar helemaal geen transporttaak (levering NÓCH
    // ophaling) aangemaakt. Los van de bestaande #2 (die ook op lege kampmomenten vuurt) — dit
    // signaal geldt enkel als er ook echt iets moet vervoerd worden.
    {
      const sportWeken=all('SELECT DISTINCT locatie_id,week FROM sport_planning WHERE periode_id=?',[periodeId]);
      const kmThemaIds=all('SELECT DISTINCT kampmoment_id,thema_id FROM kampmoment_themas');
      const themaKmIds=new Set(kmThemaIds.map(r=>r.kampmoment_id));
      kampen.forEach(km=>{
        const heeftThema=themaKmIds.has(km.id);
        const heeftSport=sportWeken.some(sp=>sp.locatie_id===km.locatie_id&&sp.week===km.week);
        if(!heeftThema&&!heeftSport)return;
        // S6.3(a) uitzondering: materiaalloze thema's (uitstapkampen zoals "Op stap met Sporty",
        // "Beestenbende") hebben 0 bakken én 0 attributen — logischerwijs ook geen transport nodig.
        // Enkel skippen als ELK gekoppeld thema materiaalloos is en er ook geen sport gepland is.
        if(heeftThema&&!heeftSport){
          const themaIds=kmThemaIds.filter(r=>r.kampmoment_id===km.id).map(r=>r.thema_id);
          const alleMateriaalloos=themaIds.every(tid=>{
            const nBak=get('SELECT COUNT(*) AS n FROM thema_bak WHERE thema_id=?',[tid]).n;
            const nAttr=get('SELECT COUNT(*) AS n FROM thema_attribuut WHERE thema_id=?',[tid]).n;
            return (nBak+nAttr)===0;
          });
          if(alleMateriaalloos)return;
        }
        const heeftLev=get('SELECT id FROM transport_taken WHERE kampmoment_id=? AND type=?',[km.id,'levering']);
        const heeftOph=get('SELECT id FROM transport_taken WHERE kampmoment_id=? AND type=?',[km.id,'ophaling']);
        if(!heeftLev&&!heeftOph){
          melding({type:'ontbrekend_transport',ernst:'hoog',
            bericht:`Week ${km.week} — ${km.loc_nm}: thema/sport gepland maar geen enkele transporttaak (levering of ophaling) aangemaakt`},{km:[km]});
        }
      });
    }
    // 8. S6.3(b) "locatieconfig onvolledig": een locatie heeft deze week een kampmoment met
    // locatieconfig-regels (bv. 2× EHBO), maar er zijn niet genoeg vrije (status='thuis')
    // exemplaren van dat vast_type om aan déze locatie te leveren.
    {
      kampen.forEach(km=>{
        _actieveLocatieConfig(km).forEach(cfg=>{
          const alleExemplaren=all("SELECT * FROM bakken WHERE soort='vast' AND vast_type=?",[cfg.vast_type]);
          const vrij=alleExemplaren.filter(b=>b.status==='thuis').length;
          if(vrij<(cfg.aantal||1)){
            melding({type:'locatieconfig_onvolledig',ernst:'hoog',
              bericht:`Week ${km.week} — ${km.loc_nm}: locatieconfig vraagt ${cfg.aantal||1}× "${cfg.vast_type}", maar slechts ${vrij} vrij exemplaar/exemplaren beschikbaar (van ${alleExemplaren.length} totaal)`},{km:[km]});
          }
        });
      });
    }
    // 9. S4.5e "pool_tekort": totale themabehoefte (thema_behoefte) aan een vast_type over alle
    // geplande kampmomenten in dezelfde week > aantal beschikbare exemplaren in de pool. Los van
    // conflict #8 (locatieconfig_onvolledig), die enkel locatie_config-rijen leest — géén overlap
    // met dezelfde exemplaren want thema_behoefte en locatie_config zijn aparte tabellen/behoeftes.
    {
      const weken9=[...new Set(kampen.map(k=>k.week).filter(w=>w!=null))].sort((a,b)=>a-b);
      const alleBehoefteTypes=[...new Set(all('SELECT DISTINCT vast_type FROM thema_behoefte').map(r=>r.vast_type))];
      const alleKmThemas=all('SELECT kampmoment_id,thema_id FROM kampmoment_themas');
      weken9.forEach(week=>{
        const kmsWeek=kampen.filter(k=>k.week===week);
        alleBehoefteTypes.forEach(vt=>{
          let nodigTotaal=0; const perLocatie=[]; const kmTekort=[];
          kmsWeek.forEach(km=>{
            const themaIds=alleKmThemas.filter(r=>r.kampmoment_id===km.id).map(r=>r.thema_id);
            if(!themaIds.length)return;
            const ph=themaIds.map(()=>'?').join(',');
            const behoefteHier=all(`SELECT * FROM thema_behoefte WHERE vast_type=? AND thema_id IN (${ph})`,[vt,...themaIds]);
            const som=behoefteHier.reduce((s,b)=>s+(b.aantal||1),0);
            if(som>0){ nodigTotaal+=som; perLocatie.push(`${km.loc_nm}: ${som}`); kmTekort.push(km); }
          });
          if(!nodigTotaal)return;
          // S4.5g: SUM(aantal) i.p.v. COUNT(*) — voor bulk-materiaal (1 samengevouwen rij met
          // aantal=totaal) telt COUNT(*) verkeerd (1 i.p.v. het echte bezit); voor unieke rijen
          // (aantal altijd 1) is SUM(aantal)==COUNT(*), dus geen gedragswijziging daar.
          const beschikbaar=(get("SELECT COALESCE(SUM(aantal),0) AS n FROM bakken WHERE soort='vast' AND vast_type=?",[vt])||{}).n||0;
          if(nodigTotaal>beschikbaar){
            melding({type:'pool_tekort',ernst:'hoog',
              bericht:`Week ${week}: ${nodigTotaal}× "${vt}" themabehoefte (${perLocatie.join(', ')}), maar slechts ${beschikbaar} beschikbaar in de pool`},{week,km:kmTekort});
          }
        });
        // Blazer-piek (L18b): per locatie geldt de piek-gelijktijdigheid van de dagplanning; die
        // wordt hier niet gemodelleerd, dus de som van de gevraagde springkastelen/waterstructuren
        // (kleuterhindernisbaan telt dubbel) geldt als BOVENGRENS, met expliciete verfijningsmelding.
        const totaalBlazers=(get("SELECT COALESCE(SUM(aantal),0) AS n FROM bakken WHERE soort='vast' AND vast_type='blazer'")||{}).n||0;
        let blazersNodig=0; const blazerPerLoc=[]; const kmBlazer=[];
        kmsWeek.forEach(km=>{
          const themaIds=alleKmThemas.filter(r=>r.kampmoment_id===km.id).map(r=>r.thema_id);
          if(!themaIds.length)return;
          const ph=themaIds.map(()=>'?').join(',');
          const behoefteHier=all(`SELECT * FROM thema_behoefte WHERE vast_type IN ('springkasteel','waterstructuur') AND thema_id IN (${ph})`,themaIds);
          let som=0;
          behoefteHier.forEach(b=>{ const perStuk=/kleuterhindernisbaan/i.test(b.notitie||'')?2:1; som+=(b.aantal||1)*perStuk; });
          if(som>0){ blazersNodig+=som; blazerPerLoc.push(`${km.loc_nm}: ${som}`); kmBlazer.push(km); }
        });
        if(blazersNodig>totaalBlazers){
          melding({type:'pool_tekort',ernst:'hoog',
            bericht:`Week ${week}: blazers — ${blazersNodig} nodig (${blazerPerLoc.join(', ')}) tegenover ${totaalBlazers} beschikbaar (piek-gelijktijdigheid per locatie niet gemodelleerd — som van de kastelen als bovengrens; verfijn met dagplanning)`},{week,km:kmBlazer});
        }
      });
    }
    res.json(conflicten);
  });

};
