const fs = require('fs'), path = require('path'), initSqlJs = require('sql.js');
initSqlJs().then(SQL => {
  const db = new SQL.Database(fs.readFileSync(path.join(__dirname,'..','sporty.db')));
  const vp = db.exec("SELECT id FROM locaties WHERE name='Verkeerspark Heverlee'");
  const wl = db.exec("SELECT id FROM locaties WHERE name='Woudlucht'");
  if (vp.length && wl.length) {
    const vpId = vp[0].values[0][0], wlId = wl[0].values[0][0];
    db.run('UPDATE kampmomenten SET locatie_id=? WHERE locatie_id=?', [vpId, wlId]);
    db.run("UPDATE locaties SET name='Woudlucht' WHERE id=?", [vpId]);
    db.run('DELETE FROM locaties WHERE id=?', [wlId]);
    console.log('Verkeerspark -> Woudlucht OK, id=' + vpId + ', dubbel (id=' + wlId + ') verwijderd');
  } else {
    console.log('Al OK of niet gevonden (vp=' + vp.length + ' wl=' + wl.length + ')');
  }
  fs.writeFileSync(path.join(__dirname,'..','sporty.db'), Buffer.from(db.export()));
  db.close();
});
