import * as T from './_testhulp.mjs';
const ijk=T.leesIjk();const srv=await T.startServer({poort:3303,appPassword:''});const tok=await T.login(srv.base);const A=(m,p,b)=>T.api(srv.base,tok,m,p,b);
const m=async n=>(await A('POST','/api/personeel',{naam:n,rol:'chauffeur'})).json.id;const a=await m('Jeroen'),b=await m('Jesse');
const d=new Date(),dag=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const o=(await A('POST','/api/opdrachten',{datum:dag,vertrek:'08:00',personeel_id:a})).json,r=o.wagens[0].rit_id;await A('POST',`/api/wagens/${r}/personen`,{personeel_id:b});
const t=(await A('POST',`/api/ritten/${r}/stops`,{type:'levering',van_locatie_id:ijk.locaties.rozenweg,naar_locatie_id:ijk.locaties.abdijschool,tijd:'09:00'})).json.taak_id;
for(const n of ['Prints agenten','Krijt','Touw','Linten','Pionnen'])await A('POST',`/api/transport-taken/${t}/regels`,{bron:'tekst',naam:n,qty:2});
await A('POST',`/api/opdrachten/${o.id}/klaarzet`);await A('POST','/api/afspraken',{soort:'garage',personeel_id:a,datum:dag,van:'07:00',tot:'08:00'});
const k=(await A('POST',`/api/ritten/${r}/token`)).json.token;console.log(JSON.stringify({tok,k}));setInterval(()=>{},1e6);
