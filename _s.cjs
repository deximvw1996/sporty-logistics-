const init=require('sql.js');const fs=require('fs');
init().then(S=>{const db=new S.Database(fs.readFileSync(process.argv[2]));
const want=process.argv.slice(3);
const r=db.exec("SELECT name,sql FROM sqlite_master WHERE type='table'");
r[0].values.forEach(([n,s])=>{if(want.includes(n)){console.log(s.replace(/\s+/g,' '));const c=db.exec('SELECT COUNT(*) FROM '+n)[0].values[0][0];console.log('  rows',c);}});
});
