// routes/vandaag.js — KO1: kantoor-startscherm "Vandaag" (design/KANTOOR-DEFINITIEF.html).
// Eén databron GET /api/vandaag (alleen kantoor) + de pagina /vandaag + voorkeuren per gebruiker.
// Alles komt uit bestaande tabellen; conflicten en tekorten via de bestaande route-handlers zelf
// (geen tweede kopie van die logica).
'use strict';
module.exports = function(ctx){
  const {app,get,all,run,alleenKantoor,path,ROOT_DIR} = ctx;
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
      WHERE a.status='nieuw' ORDER BY a.created_at DESC,a.id DESC`).forEach(a=>{
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
          sub:['melding '+wanneer,rit?'rit '+rit.status:null,kv?`KV ${kv} ook verwittigd`:null].filter(Boolean).join(' · '),acties});
      }else{
        const kapot=a.soort==='kapot';
        const titel=(a.tekst||'')+(kapot&&(a.foto_data||a.foto_path)?' (foto)':'')+(loc?' · '+loc:'');
        // Spoed heeft enkel zin voor iets kapot of voor een kamp dat deze week loopt.
        const spoed=kapot||kmWeekIds.has(a.kampmoment_id);
        const kv=_persNaam(a.persoon_id)||_persNaam(a.kv_persoon_id);
        beslissen.push({id:a.id,bron:'aanvraag',ico:kapot?'💥':'📩',kleur:'rood',titel,
          sub:`aanvraag KV ${kv||'?'} · ${wanneer}`,
          acties:[{label:'Afwijzen',primair:false,soort:'afwijzen',methode:'PUT',url:`/api/aanvragen/${a.id}/status`,body:{status:'afgewezen'}},
            spoed?status({status:'goedgekeurd',maak_spoedtransport:true},'Goedkeuren + spoed',true):status({status:'goedgekeurd'},'Goedkeuren',true)]});
      }
    });

    // ── Inplannen ──
    const inplannen=[];
    const link=(label,hash,primair=true)=>({label,primair,soort:'link',url:'/#'+hash});
    all(`SELECT * FROM transport_taken WHERE (rit_id IS NULL OR rit_id=0) AND status='gepland'
      AND ((datum>=? AND datum<=?) OR ((datum IS NULL OR datum='') AND week=?)) ORDER BY datum,tijd,id`,[weekStart,weekEind,week??-1]).forEach(t=>{
      const n=get('SELECT COALESCE(SUM(qty),0) AS q,COUNT(*) AS c FROM transport_regels WHERE taak_id=?',[t.id]);
      const stuks=n.c?`${n.q} stuks`:'';
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
        inplannen.push({id:'conflict-'+i,ico:'🔥',kleur:'oranje',titel:c.bericht,sub:'capaciteitsconflict',acties:[link('Open conflict','overzicht?conflicten',false)]});
        return;
      }
      const planning=['geen_thema','geen_levering','geen_ophaling','locatieconfig_onvolledig','ontbrekend_transport'].includes(c.type);
      nakijken.push({id:'conflict-'+i,ico:planning?'📋':'⚠',kleur:'blauw',titel:c.bericht,sub:planning?'planning':'conflict',acties:[link('Open','overzicht?conflicten',false)]});
    });
    const sessies=(pid&&_roep('/api/nakijk-tekorten',{periode_id:String(pid)},req))||[];
    let nOpen=0,nBesteld=0;
    sessies.forEach(s=>(s.tekorten||[]).forEach(r=>{nOpen++;if(r.tekort_status==='besteld')nBesteld++;}));
    if(nOpen)nakijken.push({id:'tekorten',ico:'🧮',kleur:'blauw',titel:`${nOpen} tekort${nOpen===1?'':'en'} open uit vrijdagcontroles · ${nBesteld} besteld`,sub:'voorraad',acties:[link('Open','materiaal?tekorten',false)]});

    // ── Ritten vandaag ──
    const ritten_vandaag=all(`SELECT * FROM transport_ritten WHERE datum=? AND status<>'geannuleerd' ORDER BY id`,[datum]).map(r=>{
      const taken=all(`SELECT * FROM transport_taken WHERE rit_id=? AND status<>'geannuleerd' ORDER BY COALESCE(volgorde,1000000),COALESCE(tijd,''),id`,[r.id]);
      const gedaan=taken.filter(t=>t.status==='gedaan').length;
      return {id:r.id,tijd:taken.map(t=>t.tijd).filter(Boolean).sort()[0]||'',chauffeur:r.chauffeur||_persNaam(r.personeel_id)||'',voertuig:r.voertuig||'',
        status:r.status==='onderweg'||r.status==='gedaan'?r.status:'gepland',
        stop_huidig:taken.length?Math.min(gedaan+1,taken.length):0,stops_totaal:taken.length,
        stops:taken.map(t=>({naam:_locNaam(_stopLoc(t)),slot:t.slot==='vrij'?'vrij':'vast'}))};
    }).sort((a,b)=>(a.tijd||'99').localeCompare(b.tijd||'99'));

    // ── Deze week: open kampmomenten ──
    const deze_week=kmsWeek.map(km=>{
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

    return {
      periode:periode?{id:periode.id,naam:periode.naam}:null,
      gebruiker:{naam:req.persoon?.naam||''},
      datum,datum_tekst:datumLang(datum),week,
      beslissen,inplannen,nakijken,ritten_vandaag,deze_week,
      cijfers:{ritten_onderweg:ritten_vandaag.filter(r=>r.status==='onderweg').length,locaties_open:deze_week.length}
    };
  }

  app.get('/api/vandaag',alleenKantoor,(req,res)=>res.json(vandaagData(req)));

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
};
