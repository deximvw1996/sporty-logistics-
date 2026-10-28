// lib/bulk.js — V3a punt 1: ÉÉN verplaatsfunctie voor bulk-materiaal (werklijst 13; B-F4, B-F5).
// Bron van waarheid voor bulk = bulk_spreiding (per locatie). Invariant: som(spreiding) = bakken.aantal.
// bakken.status/huidige_locatie_id van een bulk-rij wordt hier AFGELEID, nooit elders rechtstreeks gezet.
'use strict';
module.exports = function(ctx){
  const {get,all,run,ins,logWijziging,updateMetLog} = ctx;

  function _locNaam(id){ const l=id?get('SELECT name FROM locaties WHERE id=?',[id]):null; return l?l.name:('locatie #'+id); }

  // Afgeleide status: 'op_locatie' als er ergens buiten thuis iets staat (huidige = grootste
  // buiten-thuis-plek), anders 'thuis'.
  function leidBulkStatusAf(req, bakId, context){
    const b=get('SELECT * FROM bakken WHERE id=?',[bakId]);
    if(!b||!b.is_bulk)return;
    const buiten=get('SELECT locatie_id FROM bulk_spreiding WHERE bak_id=? AND aantal>0 AND locatie_id<>? ORDER BY aantal DESC,locatie_id LIMIT 1',[bakId,b.thuislocatie_id||0]);
    const status=buiten?'op_locatie':'thuis';
    const huidig=buiten?buiten.locatie_id:b.thuislocatie_id;
    if(b.status!==status||b.huidige_locatie_id!==huidig)
      updateMetLog(req,'UPDATE bakken SET status=?,huidige_locatie_id=? WHERE id=?',[status,huidig,bakId],context);
  }

  // Controle zonder schrijven — geeft een foutmelding (tekst) of null.
  function controleerBulk(bakId, vanLocatieId, aantal){
    const b=get('SELECT * FROM bakken WHERE id=?',[bakId]);
    if(!b)return 'Bulk-materiaal #'+bakId+' bestaat niet';
    const van=vanLocatieId||b.thuislocatie_id;
    const n=parseInt(aantal)||0;
    if(n<=0)return `Ongeldig aantal (${aantal}) voor "${b.naam}"`;
    const bron=get('SELECT aantal FROM bulk_spreiding WHERE bak_id=? AND locatie_id=?',[bakId,van]);
    const daar=bron?bron.aantal:0;
    if(daar<n)return `Op ${_locNaam(van)} staan maar ${daar} × "${b.naam}" — kan er geen ${n} verplaatsen`;
    return null;
  }

  // verplaatsBulk: gooit een Error (met duidelijke tekst, err.status=409) als er op `van` te weinig staat.
  function verplaatsBulk(req, bakId, vanLocatieId, naarLocatieId, aantal, context){
    const b=get('SELECT * FROM bakken WHERE id=?',[bakId]);
    if(!b||!b.is_bulk){const e=new Error('Geen bulk-materiaal: #'+bakId);e.status=400;throw e;}
    const van=vanLocatieId||b.thuislocatie_id;
    const naar=naarLocatieId||b.thuislocatie_id;
    const fout=controleerBulk(bakId,van,aantal);
    if(fout){const e=new Error(fout);e.status=409;throw e;}
    const n=parseInt(aantal);
    if(van===naar)return {bak_id:bakId,van,naar,aantal:0};
    const bron=get('SELECT * FROM bulk_spreiding WHERE bak_id=? AND locatie_id=?',[bakId,van]);
    run('UPDATE bulk_spreiding SET aantal=aantal-? WHERE id=?',[n,bron.id]);
    logWijziging(req,'bulk_spreiding',bron.id,'update',bron,get('SELECT * FROM bulk_spreiding WHERE id=?',[bron.id]),context);
    const doel=get('SELECT * FROM bulk_spreiding WHERE bak_id=? AND locatie_id=?',[bakId,naar]);
    if(doel){
      run('UPDATE bulk_spreiding SET aantal=aantal+? WHERE id=?',[n,doel.id]);
      logWijziging(req,'bulk_spreiding',doel.id,'update',doel,get('SELECT * FROM bulk_spreiding WHERE id=?',[doel.id]),context);
    } else {
      const id=ins('INSERT INTO bulk_spreiding (bak_id,locatie_id,aantal) VALUES (?,?,?)',[bakId,naar,n]);
      logWijziging(req,'bulk_spreiding',id,'insert',null,get('SELECT * FROM bulk_spreiding WHERE id=?',[id]),context);
    }
    leidBulkStatusAf(req,bakId,context);
    return {bak_id:bakId,van,naar,aantal:n};
  }

  function spreidingSom(bakId){ return (get('SELECT COALESCE(SUM(aantal),0) AS s FROM bulk_spreiding WHERE bak_id=?',[bakId])||{}).s||0; }

  return {verplaatsBulk, controleerBulk, leidBulkStatusAf, spreidingSom};
};
