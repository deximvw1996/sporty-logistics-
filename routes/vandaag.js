// routes/vandaag.js — KO1: kantoor-startscherm "Vandaag" (design/KANTOOR-DEFINITIEF.html).
// Eén databron GET /api/vandaag (alleen kantoor) + de pagina /vandaag + voorkeuren per gebruiker.
// Alles komt uit bestaande tabellen; conflicten en tekorten via de bestaande route-handlers zelf
// (geen tweede kopie van die logica).
'use strict';
// MOB1: wat staat op de NU-kaart. Een rit die onderweg is gaat altijd voor; dan aanvullen, dan de eerstvolgende rit of telling op tijd.
function kiesNu(ritten,aanvullen,tellen){
  const opTijd=(a,b)=>String(a.tijd||'99').localeCompare(String(b.tijd||'99'));
  const taken=[...ritten,...tellen].sort(opTijd);
  const onderweg=taken.find(t=>t.onderweg);
  const nu=onderweg||aanvullen||taken[0]||null;
  const rest=(aanvullen&&aanvullen!==nu?[aanvullen]:[]).concat(taken.filter(t=>t!==nu));
  return {nu:nu?{...nu,knop:nu.onderweg?'Verder ›':'Start ›'}:null,daarna:rest};
}
function kiesNuKantoor(groepen){return {nu:groepen[0]?{...groepen[0],knop:'Start ›'}:null,daarna:groepen.slice(1)};}
module.exports = function(ctx){
  const {kvL}=require('../lib/tijd');
  const {app,get,all,run,alleenKantoor,path,ROOT_DIR,_kvVerwacht,_bakItems,_genToken} = ctx;
  // Lokale datum (niet UTC): kort na middernacht mag 'vandaag' niet nog gisteren zijn.
  const isoDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  const DAGEN=['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'];
  const KORT=['zo','ma','di','wo','do','vr','za'];
  const MAANDEN=['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
  const d0=s=>new Date(s+'T12:00:00');
  const plus=(s,n)=>{const d=d0(s);d.setDate(d.getDate()+n);return isoDate(d);};
  const datumLang=s=>{const d=d0(s);return `${DAGEN[d.getDay()]} ${d.getDate()} ${MAANDEN[d.getMonth()]}`;};
  const datumKort=s=>{const d=d0(s);return `${DAGEN[d.getDay()]} ${d.getDate()} ${MAANDEN[d.getMonth()].slice(0,3)}`;};
  const isWeekend=s=>{const g=d0(s).getDay();return g===0||g===6;};

  // Roept de handler van een bestaande GET-route aan zonder netwerk (zelfde req.persoon), geeft de JSON terug.
  function _roep(pad,query,req){
    const laag=(app._router?.stack||[]).find(l=>l.route&&l.route.path===pad&&l.route.methods.get);
    if(!laag)return null;
    const h=laag.route.stack[laag.route.stack.length-1].handle;
    let uit=null;
    const res={statusCode:200,status(c){this.statusCode=c;return this;},json(o){uit=o;return this;},set(){return this;},send(o){uit=o;return this;}};
    try{h({query,params:{},body:{},persoon:req.persoon,headers:req.headers},res,()=>{});}catch(e){console.error('vandaag: '+pad+' faalde:',e.message);return null;}
    return res.statusCode===200?uit:null;
  }

  const _locNaam=id=>id?((get('SELECT name FROM locaties WHERE id=?',[id])||{}).name||'?'):'?';
  const _persNaam=id=>id?((get('SELECT naam FROM personeel WHERE id=?',[id])||{}).naam||''):'';
  const _stopLoc=t=>t.type==='ophaling'?(t.van_locatie_id||t.naar_locatie_id):(t.naar_locatie_id||t.van_locatie_id);
  // created_at is now() uit lib/db ("29/10/2026 16:40", nl-BE); oudere rijen kunnen ISO zijn.
  function _ts(ts){
    let m=/(\d{1,2})\/(\d{1,2})\/(\d{4})\D+(\d{1,2}):(\d{2})/.exec(ts||'');
    if(m)return {dag:`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`,uur:`${m[4].padStart(2,'0')}:${m[5]}`};
    m=/(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(ts||'');
    return m?{dag:m[1],uur:m[2]}:null;
  }
  function _wanneer(ts,datum){
    const t=_ts(ts);if(!t)return '';
    const dag=t.dag;
    if(dag===datum)return t.uur;
    if(dag===plus(datum,-1))return 'gisteren';
    const d=d0(dag);return `${d.getDate()}/${d.getMonth()+1}`;
  }

  function vandaagData(req){
    const datum=/^\d{4}-\d{2}-\d{2}$/.test(req.query.datum||'')?req.query.datum:isoDate(new Date());
    const periode=(req.query.periode_id&&get('SELECT * FROM vakantieperiodes WHERE id=?',[req.query.periode_id]))
      ||get('SELECT * FROM vakantieperiodes WHERE actief=1')||get('SELECT * FROM vakantieperiodes ORDER BY id DESC LIMIT 1')||null;
    // Kampweek: telt vanaf de startdatum van de periode, 7 dagen per week. Buiten de periode: kalenderweek ma–zo, week=null.
    let week=null,weekStart,weekEind;
    if(periode&&datum>=periode.start_datum&&datum<=periode.eind_datum){
      week=Math.floor((d0(datum)-d0(periode.start_datum))/(7*864e5))+1;
      weekStart=plus(periode.start_datum,(week-1)*7);weekEind=plus(weekStart,6);
    }else{
      const g=(d0(datum).getDay()+6)%7;weekStart=plus(datum,-g);weekEind=plus(weekStart,6);
    }
    const pid=periode?periode.id:null;
    const kmsWeek=week?all(`SELECT km.*,l.name AS loc_nm,l.contact_tel FROM kampmomenten km JOIN locaties l ON l.id=km.locatie_id
      WHERE km.periode_id=? AND km.week=? ORDER BY l.name`,[pid,week]):[];
    const kmWeekIds=new Set(kmsWeek.map(k=>k.id));

    // ── Beslissen: nieuwe aanvragen (materiaal/kapot) + meldingen van chauffeurs ──
    const beslissen=[];
    all(`SELECT a.*,km.locatie_id,km.kv_persoon_id,km.periode_id AS km_periode FROM aanvragen a LEFT JOIN kampmomenten km ON km.id=a.kampmoment_id
      WHERE a.status='nieuw' AND COALESCE(a.soort,'') NOT IN ('herinnering_kv','notitie_kantoor') ORDER BY a.created_at DESC,a.id DESC`).forEach(a=>{ // TF1 G8: berichten van kantoor zijn geen beslissing
      if(a.kampmoment_id&&a.km_periode!==pid)return;
      const loc=a.locatie_id?_locNaam(a.locatie_id):'';
      const wanneer=_wanneer(a.created_at,datum);
      const status=(s,label,primair)=>({label,primair,soort:'api',methode:'PUT',url:`/api/aanvragen/${a.id}/status`,body:s});
      if(a.soort==='probleem_chauffeur'){
        const t=a.tekst||'';
        const ico=/locatie gesloten/.test(t)?'🚪':/past niet in het lokaal/.test(t)?'📩':'💥';
        // De melding bewaart geen rit; de meest recente rit van deze chauffeur (op id of naam uit de tekst) geeft de status.
        const chNaam=(/^Chauffeur (.+?) bij /.exec(t)||[])[1]||'';
        const rit=get(`SELECT status FROM transport_ritten WHERE status<>'geannuleerd' AND ((personeel_id IS NOT NULL AND personeel_id=?) OR (chauffeur<>'' AND chauffeur=?)) ORDER BY id DESC`,[a.persoon_id||-1,chNaam]);
        const kv=_persNaam(a.kv_persoon_id);
        const tel=a.locatie_id?((get('SELECT contact_tel FROM locaties WHERE id=?',[a.locatie_id])||{}).contact_tel||''):'';
        const acties=[];
        if(tel)acties.push({label:'Bel conciërge',primair:false,soort:'tel',url:'tel:'+tel.replace(/[^\d+]/g,'')});
        acties.push(status({status:'afgehandeld'},'Afgehandeld',true));
        beslissen.push({id:a.id,bron:'melding',ico,kleur:'rood',titel:t,
          sub:['melding '+wanneer,rit?'rit '+rit.status:null,kv?`${kvL(kv)} ook verwittigd`:null].filter(Boolean).join(' · '),acties});
      }else{
        const kapot=a.soort==='kapot';
        const titel=(a.tekst||'')+(kapot&&(a.foto_data||a.foto_path)?' (foto)':'')+(loc?' · '+loc:'');
        // Spoed heeft enkel zin voor iets kapot of voor een kamp dat deze week loopt.
        const spoed=kapot||kmWeekIds.has(a.kampmoment_id);
        const kv=_persNaam(a.persoon_id)||_persNaam(a.kv_persoon_id);
        beslissen.push({id:a.id,bron:'aanvraag',ico:kapot?'💥':'📩',kleur:'rood',titel,
          sub:`aanvraag ${kv?kvL(kv):'KV ?'} · ${wanneer}`,
          acties:[{label:'Afwijzen',primair:false,soort:'afwijzen',methode:'PUT',url:`/api/aanvragen/${a.id}/status`,body:{status:'afgewezen'}},
            spoed?status({status:'goedgekeurd',maak_spoedtransport:true},'Goedkeuren + spoed',true):status({status:'goedgekeurd'},'Goedkeuren',true)]});
      }
    });

    // ── Inplannen ──
    const inplannen=[];
    const link=(label,url,primair=true)=>({label,primair,soort:'link',url}); // TF3: geen /#-adressen meer
    all(`SELECT * FROM transport_taken WHERE (rit_id IS NULL OR rit_id=0) AND status='gepland'
      AND ((datum>=? AND datum<=?) OR ((datum IS NULL OR datum='') AND week=?)) ORDER BY datum,tijd,id`,[weekStart,weekEind,week??-1]).forEach(t=>{
      const n=get('SELECT COALESCE(SUM(qty),0) AS q,COUNT(*) AS c FROM transport_regels WHERE taak_id=?',[t.id]);
      const stuks=n.c?`${n.q} ${n.q===1?'stuk':'stuks'}`:'';
      const rest=/^Rest van rit/.test(t.opmerking||'');
      const weekend=t.datum&&isWeekend(t.datum);
      let ico=t.aanvraag_id?'📩':t.type==='levering'?'📦':t.type==='ophaling'?'↩':'🔁';
      if(rest)ico='🚚';if(weekend)ico='🏃';
      const titel=rest?`${t.opmerking.split(':')[0]}: ${_locNaam(t.van_locatie_id)} → ${_locNaam(t.naar_locatie_id)}`
        :t.type==='levering'?`Levering: ${_locNaam(t.naar_locatie_id)}`
        :t.type==='ophaling'?`Ophaling ${_locNaam(t.van_locatie_id)}`
        :`${(t.opmerking||'Transfer').replace(/^🚨\s*/,'')}: ${_locNaam(t.van_locatie_id)} → ${_locNaam(t.naar_locatie_id)}`;
      inplannen.push({id:'taak-'+t.id,taak_id:t.id,ico,kleur:'oranje',titel,pil:weekend?'weekend':null,
        sub:[t.datum?datumKort(t.datum):null,stuks||null,weekend?'weekend = uitzondering':null,'nog geen rit'].filter(Boolean).join(' · '),
        acties:[{label:'Op een rit zetten',primair:true,soort:'link',url:'/ritplanning?taak='+t.id}]});
    });
    all(`SELECT * FROM transport_ritten WHERE datum>=? AND datum<=? AND status NOT IN ('gedaan','geannuleerd') ORDER BY datum,id`,[weekStart,weekEind]).forEach(r=>{
      const n=get(`SELECT COUNT(*) AS n FROM transport_taken WHERE rit_id=? AND status<>'geannuleerd'`,[r.id]).n;
      if(!n)return;
      const geenCh=!(r.chauffeur||'').trim()&&!r.personeel_id, geenVt=!(r.voertuig||'').trim();
      if(!geenCh&&!geenVt)return;
      inplannen.push({id:'rit-'+r.id,rit_id:r.id,ico:'🚐',kleur:'oranje',
        titel:`Rit #${r.id} heeft nog geen ${geenCh?'chauffeur':'voertuig'}`,
        sub:[datumKort(r.datum),geenCh?null:r.chauffeur,`${n} stop${n===1?'':'s'}`].filter(Boolean).join(' · '),
        acties:[{label:geenCh?'Chauffeur kiezen':'Voertuig kiezen',primair:true,soort:'link',url:'/ritplanning?rit='+r.id}]});
    });

    // ── Conflicten (bestaande detector) → capaciteit naar Inplannen, de rest naar Nakijken ──
    const nakijken=[];
    const conflicten=(pid&&_roep('/api/conflicten',{periode_id:String(pid)},req))||[];
    conflicten.filter(c=>c.week==null||week==null||c.week===week).forEach((c,i)=>{
      if(c.type==='pool_tekort'){
        inplannen.push({id:'conflict-'+i,ico:'🔥',kleur:'oranje',titel:c.bericht,sub:'capaciteitsconflict',acties:[link('Open conflict','/rooster',false)]});
        return;
      }
      const planning=['geen_thema','geen_levering','geen_ophaling','locatieconfig_onvolledig','ontbrekend_transport'].includes(c.type);
      nakijken.push({id:'conflict-'+i,ico:planning?'📋':'⚠',kleur:'blauw',titel:c.bericht,sub:planning?'planning':'conflict',acties:[link('Open',planning?'/kampmomenten':'/rooster',false)]});
    });
    const sessies=(pid&&_roep('/api/nakijk-tekorten',{periode_id:String(pid)},req))||[];
    let nOpen=0,nBesteld=0;
    sessies.forEach(s=>(s.tekorten||[]).forEach(r=>{nOpen++;if(r.tekort_status==='besteld')nBesteld++;}));
    if(nOpen)nakijken.push({id:'tekorten',ico:'🧮',kleur:'blauw',titel:`${nOpen} tekort${nOpen===1?'':'en'} open uit vrijdagcontroles · ${nBesteld} besteld`,sub:'voorraad',acties:[link('Open','/nakijken',false)]});

    // ── Ritten vandaag (en morgen: kantoor ziet op donderdag de leveringen van vrijdag) ──
    const rittenVan=(dag,enkelPersoon)=>all(`SELECT * FROM transport_ritten WHERE datum=? AND status<>'geannuleerd' ORDER BY id`,[dag]).filter(r=>!enkelPersoon||(r.personeel_id&&String(r.personeel_id)===String(enkelPersoon))).map(r=>{
      const taken=all(`SELECT * FROM transport_taken WHERE rit_id=? AND status<>'geannuleerd' ORDER BY COALESCE(volgorde,1000000),COALESCE(tijd,''),id`,[r.id]);
      const gedaan=taken.filter(t=>t.status==='gedaan').length;
      return {id:r.id,tijd:r.vertrek||taken.map(t=>t.tijd).filter(Boolean).sort()[0]||'',chauffeur:r.chauffeur||_persNaam(r.personeel_id)||'',voertuig:r.voertuig||'',
        status:r.status==='onderweg'||r.status==='gedaan'?r.status:'gepland',
        stop_huidig:taken.length?Math.min(gedaan+1,taken.length):0,stops_totaal:taken.length,
        stops:taken.map(t=>({naam:_locNaam(_stopLoc(t)),slot:t.slot==='vrij'?'vrij':'vast'}))};
    }).sort((a,b)=>(a.tijd||'99').localeCompare(b.tijd||'99'));
    const ritten_vandaag=rittenVan(datum),ritten_morgen=rittenVan(plus(datum,1));

    // ── Nakijken: de telling van de KV's (VC1) staat ook op Vandaag ──
    if(pid){
      const teKeuren=get(`SELECT COUNT(*) AS n FROM nakijk_sessies ns JOIN kampmomenten km ON km.id=ns.kampmoment_id WHERE ns.kv_status='ingediend'
        AND COALESCE(ns.kantoor_status,'') NOT IN ('nagekeken','verwerkt') AND COALESCE(ns.kantoor_afgerond_op,'')='' AND km.periode_id=?`,[pid]).n;
      if(teKeuren)nakijken.unshift({id:'tellingen-te-keuren',ico:'🧮',kleur:'blauw',titel:`${teKeuren} telling${teKeuren===1?'':'en'} te keuren`,sub:'ingediend door de KV, nog niet nagekeken',acties:[{label:'Open',primair:true,soort:'link',url:'/nakijken'}]});
      // Bakken van de afgelopen kampweek die niemand telde (ook bakken zonder sessie).
      const weken=all('SELECT DISTINCT week FROM kampmomenten WHERE periode_id=? AND week IS NOT NULL ORDER BY week',[pid]).map(r=>r.week)
        .filter(w=>plus(periode.start_datum,(w-1)*7+6)<datum);
      const vorige=weken.length?weken[weken.length-1]:null;
      if(vorige){
        let nietGeteld=0;
        all('SELECT * FROM kampmomenten WHERE periode_id=? AND week=?',[pid,vorige]).forEach(km=>{
          const v=_kvVerwacht(km);
          v.bakken.forEach(b=>{
            const veld=b.soort==='thema'?'thema_bak_id':'vaste_bak_id';
            const s=get(`SELECT id FROM nakijk_sessies WHERE bak_type=? AND ${veld}=? AND kampmoment_id=? AND kv_status IN ('bezig','ingediend') ORDER BY id DESC`,[b.soort,b.id,km.id]);
            const geteld=s?get('SELECT COUNT(*) AS n FROM nakijk_regels WHERE sessie_id=? AND aangetroffen IS NOT NULL',[s.id]).n:0;
            if(!geteld)nietGeteld++;
          });
          v.attributen.forEach(a=>{const s=get("SELECT id,notities FROM nakijk_sessies WHERE bak_type='attribuut' AND attribuut_id=? AND kampmoment_id=? ORDER BY id DESC",[a.id,km.id]);if(!s||!s.notities)nietGeteld++;});
        });
        if(nietGeteld)nakijken.unshift({id:'bakken-niet-geteld',ico:'📋',kleur:'blauw',titel:`${nietGeteld} bak${nietGeteld===1?'':'ken'} niet geteld van kampweek ${vorige}`,sub:'herinnering naar de KV sturen kan in Nakijken',acties:[{label:'Open',primair:false,soort:'link',url:'/nakijken'}]});
      }
    }

    // ── Deze week: open kampmomenten ──
    const weekLijst=kmsLijst=>kmsLijst.map(km=>{
      const th=all('SELECT t.name,t.heeft_kookactiviteit,kt.dag FROM kampmoment_themas kt JOIN themas t ON t.id=kt.thema_id WHERE kt.kampmoment_id=? ORDER BY kt.dag,t.name',[km.id]);
      const dagSet=th.every(t=>t.dag!=null)&&th.length?[...new Set(th.map(t=>t.dag))].sort():null;
      const dagen=!dagSet?'ma–vr':dagSet.length===1?KORT[dagSet[0]+1]:(dagSet[dagSet.length-1]-dagSet[0]===dagSet.length-1?`${KORT[dagSet[0]+1]}–${KORT[dagSet[dagSet.length-1]+1]}`:dagSet.map(x=>KORT[x+1]).join('/'));
      const mark=[];
      const ses=get('SELECT kv_status FROM nakijk_sessies WHERE kampmoment_id=? ORDER BY id DESC',[km.id]);
      if(ses)mark.push(ses.kv_status==='open'?'vrijdagcontrole gepland':'vrijdagcontrole ingediend');
      const kapot=get(`SELECT tekst FROM aanvragen WHERE kampmoment_id=? AND soort='kapot' AND status='nieuw' ORDER BY id DESC`,[km.id]);
      if(kapot)mark.push('⚠ '+(kapot.tekst||'kapot').split(/[\s(]/)[0].toLowerCase());
      if(!th.length)mark.push('⚠ geen thema');
      const kook=th.filter(t=>t.heeft_kookactiviteit);
      if(kook.length)mark.push(kook.every(t=>t.dag!=null)?'kookdagen '+[...new Set(kook.map(t=>KORT[t.dag+1]))].join('/'):'kookactiviteit');
      return {kampmoment_id:km.id,locatie:km.loc_nm,thema:th.map(t=>t.name).filter((v,i,a)=>a.indexOf(v)===i).join(', '),kv_naam:_persNaam(km.kv_persoon_id),dagen,markeringen:mark};
    });
    const deze_week=weekLijst(kmsWeek);
    // KD1: is deze week leeg (bv. donderdag vóór de kampweek), dan toont Vandaag de week erna.
    const volgNr=week?week+1:(periode&&datum<periode.start_datum&&periode.start_datum<=plus(weekEind,7)?1:null);
    const volgende_week=volgNr&&pid?weekLijst(all(`SELECT km.*,l.name AS loc_nm,l.contact_tel FROM kampmomenten km JOIN locaties l ON l.id=km.locatie_id
      WHERE km.periode_id=? AND km.week=? ORDER BY l.name`,[pid,volgNr])):[];
    const week_label=!deze_week.length&&volgende_week.length?'Volgende week':'Deze week';

    return {
      periode:periode?{id:periode.id,naam:periode.naam}:null,
      gebruiker:{naam:req.persoon?.naam||''},
      datum,datum_tekst:datumLang(datum),week,
      beslissen,inplannen,nakijken,ritten_vandaag,ritten_morgen,deze_week,volgende_week,week_label,
      cijfers:{ritten_onderweg:ritten_vandaag.filter(r=>r.status==='onderweg').length,locaties_open:deze_week.length}
    };
  }

  // ── MOB1: de gsm-weergave van Vandaag (design/MOBIEL-DEFINITIEF.html): NU-kaart, Daarna, meldingen, tellers van de tabbalk ──
  const ritTitel=r=>`Rit #${r.id}${r.voertuig?' · '+r.voertuig:''}`;
  const ritSub=r=>r.stops.map(s=>s.naam+(s.slot==='vrij'?' (vrij)':' 🔒')).join(' → ')+(r.bezetting?` · ${r.bezetting.n}/${r.bezetting.max} bakken${r.bezetting.n>r.bezetting.max?' ⚠':''}`:'');
  const ritItem=r=>({soort:'rit',ico:'🚚',tijd:r.tijd,titel:ritTitel(r),sub:ritSub(r),url:'/rit/'+r.token,onderweg:r.status==='onderweg'});
  // ME1: de ongelezen meldingen uit routes/meldingen.js, in de vorm die de gsm-weergave leest (titel, sub).
  const ongelezen=req=>ctx.meldingenVan(req.persoon,true).map(m=>({...m,sub:m.link?'tik om te openen':'',acties:[]}));
  function gsmVandaag(req,b,datum){
    const rol=req.persoon.rol;
    if(rol==='kantoor'){
      const v=vandaagData(req);
      const rij=(ico,naam,lijst,url)=>({soort:naam.toLowerCase(),ico,tijd:'',titel:`${naam} · ${lijst.length}`,sub:lijst.slice(0,3).map(x=>x.titel).join(' · '),url});
      const groepen=[v.beslissen.length&&rij('📩','Beslissen',v.beslissen,'/vandaag?tab=beslissen'),v.inplannen.length&&rij('🚚','Inplannen',v.inplannen,'/ritplanning'),v.nakijken.length&&rij('⚠','Nakijken',v.nakijken,'/nakijken'),
        v.ritten_vandaag.length&&{soort:'ritten',ico:'🚐',tijd:v.ritten_vandaag[0].tijd,titel:`Ritten vandaag · ${v.ritten_vandaag.length}`,sub:v.ritten_vandaag.slice(0,4).map(r=>`${r.chauffeur||'geen chauffeur'} ${r.status==='onderweg'?`onderweg (stop ${r.stop_huidig}/${r.stops_totaal})`:r.status}`).join(' · '),url:'/ritplanning'}].filter(Boolean);
      const kies=kiesNuKantoor(groepen);
      const wk=v.deze_week;
      const daarna=kies.daarna.concat(wk.length?[{soort:'week',ico:'🏫',tijd:'ma–vr',titel:`Deze week · ${wk.length} locatie${wk.length===1?'':'s'}`,sub:wk.slice(0,5).map(k=>k.locatie).join(', '),url:'/kampmomenten'}]:[]);
      const meldingen=ongelezen(req);
      return {nu:kies.nu,daarna,n_dingen:groepen.length,meldingen,beslissen:v.beslissen,periode:v.periode,
        tellers:{vandaag:v.beslissen.length,transport:v.inplannen.length,voorraad:v.nakijken.length,meldingen:meldingen.length}};
    }
    const naam=req.persoon.naam;
    const meld=ongelezen(req);
    // Tellen bij ophaling (coördinator): ophalingen van vandaag; de telling loopt via de KV-link van dat kampmoment.
    const tellen=rol!=='coordinator'?[]:all(`SELECT t.*,r.chauffeur,r.personeel_id,r.id AS rid,km.kv_token FROM transport_taken t JOIN transport_ritten r ON r.id=t.rit_id LEFT JOIN kampmomenten km ON km.id=t.kampmoment_id
      WHERE r.datum=? AND t.type='ophaling' AND t.status NOT IN ('gedaan','geannuleerd') AND r.status<>'geannuleerd' ORDER BY COALESCE(t.tijd,''),t.id`,[datum]).map(t=>{
        const n=get('SELECT COUNT(*) AS n FROM transport_regels WHERE taak_id=?',[t.id]).n,ch=t.chauffeur||_persNaam(t.personeel_id);
        return {soort:'tellen',ico:'📋',tijd:t.tijd||'',titel:`Tellen bij ophaling · ${_locNaam(_stopLoc(t))}`,sub:[`${n} stuks`,ch?`samen met ${ch} (rit #${t.rid})`:`rit #${t.rid}`].join(' · '),url:t.kv_token?'/kv/'+t.kv_token:'/vandaag?tab=ritten'};
      });
    const open=b.ritten_vandaag.filter(r=>r.status!=='gedaan');
    const aanvul=rol==='coordinator'&&b.aanvullen.open?{soort:'aanvullen',ico:'🧮',tijd:'',titel:'Aanvullen in de Rozenweg',sub:`${b.aanvullen.bakken} bak${b.aanvullen.bakken===1?'':'ken'} · ${b.aanvullen.open} handeling${b.aanvullen.open===1?'':'en'}`,url:'/aanvullijst-print'}:null;
    const kies=kiesNu(open.map(ritItem),aanvul,tellen);
    const volgend=kies.nu||!b.ritten_morgen.length?[]:b.ritten_morgen.map(r=>({...ritItem(r),tijd:'morgen '+r.tijd}));
    return {nu:kies.nu,daarna:kies.daarna.concat(volgend),n_dingen:(kies.nu?1:0)+kies.daarna.length,meldingen:meld,tellers:{ritten:open.length,meldingen:meld.length}};
  }

  // GF1: een coördinator (of chauffeur) ziet met ?mijn=1 enkel zijn eigen ritten en aanvul-handelingen; zonder mijn=1 blijft Vandaag kantoor.
  app.get('/api/vandaag',(req,res,next)=>{
    if(req.query.mijn==='1'&&req.persoon&&req.persoon.rol!=='kv'){
      const datum=/^\d{4}-\d{2}-\d{2}$/.test(req.query.datum||'')?req.query.datum:isoDate(new Date());
      // ME1: ook ritten met alleen een chauffeursnaam, als die naam bij precies één actieve persoon past en dat deze gebruiker is.
      const rit=dag=>all("SELECT * FROM transport_ritten WHERE datum=? AND status<>'geannuleerd' ORDER BY id",[dag]).filter(r=>r.personeel_id?r.personeel_id===req.persoon.persoon_id:((ctx.persoonOpNaam(r.chauffeur)||{}).id===req.persoon.persoon_id)).map(r=>{
        const taken=all("SELECT * FROM transport_taken WHERE rit_id=? AND status<>'geannuleerd' ORDER BY COALESCE(volgorde,1000000),COALESCE(tijd,''),id",[r.id]);
        let token=r.rit_token||'';if(!token){token=_genToken(10);run('UPDATE transport_ritten SET rit_token=? WHERE id=?',[token,r.id]);} // MOB1: de NU-kaart opent de rit-weergave
        let bez=null;try{const i=ctx._ritPlanInfo(r);if(r.voertuig_capaciteit)bez={n:i.bezetting,max:r.voertuig_capaciteit};}catch(e){}
        return {id:r.id,tijd:r.vertrek||taken.map(t=>t.tijd).filter(Boolean).sort()[0]||'',voertuig:r.voertuig||'',status:r.status,stops:taken.map(t=>({naam:_locNaam(_stopLoc(t)),slot:t.slot==='vrij'?'vrij':'vast',type:t.type,gedaan:t.status==='gedaan'})),token,bezetting:bez};
      });
      const lijst=_roep('/api/aanvullijst',{datum},req);
      const basis={mijn:true,gebruiker:{naam:req.persoon.naam,rol:req.persoon.rol},datum,datum_tekst:datumLang(datum),
        ritten_vandaag:rit(datum),ritten_morgen:rit(plus(datum,1)),aanvullen:{open:lijst&&lijst.tellers?lijst.tellers.totaal:0,bakken:lijst&&lijst.tellers?lijst.tellers.bakken:0}};
      return res.json({...basis,...gsmVandaag(req,basis,datum)});
    }
    return alleenKantoor(req,res,()=>res.json(vandaagData(req)));
  });

  // ── Voorkeuren per ingelogde gebruiker (JSON in personeel.voorkeuren) ──
  const _leesVk=id=>{try{return JSON.parse((get('SELECT voorkeuren FROM personeel WHERE id=?',[id])||{}).voorkeuren||'{}')||{};}catch(e){return {};}};
  app.get('/api/mij/voorkeuren',(req,res)=>res.json(_leesVk(req.persoon.persoon_id)));
  app.put('/api/mij/voorkeuren',(req,res)=>{
    const b=req.body||{};const vk=_leesVk(req.persoon.persoon_id);
    if(b.vandaag_weergave!==undefined){
      if(!['groot','compact'].includes(b.vandaag_weergave))return res.status(400).json({error:"vandaag_weergave moet 'groot' of 'compact' zijn"});
      vk.vandaag_weergave=b.vandaag_weergave;
    }
    run('UPDATE personeel SET voorkeuren=? WHERE id=?',[JSON.stringify(vk),req.persoon.persoon_id]);
    res.json(vk);
  });

  // De pagina zelf: login gebeurt client-side (token in localStorage), de pagina vraagt /api/vandaag
  // en stuurt niet-kantoor terug naar /.
  app.get('/vandaag',(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','vandaag.html')));
  app.get('/login',(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','login.html'))); // MOB1
  app.get('/meer',(req,res)=>res.sendFile(path.join(ROOT_DIR,'public','meer.html'))); // MOB1
};
module.exports.kiesNu=kiesNu;module.exports.kiesNuKantoor=kiesNuKantoor;
