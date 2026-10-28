const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;
// Railway: gebruik DATA_DIR env var voor persistent volume, anders lokaal
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR || __dirname;
const DB_PATH = path.join(DATA_DIR, 'sporty.db');
console.log('Database pad:', DB_PATH);
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
try { if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch(e) { console.warn('Uploads map aanmaken mislukt:', e.message); }
// Veiligheidsronde (DOORLICHTING-c #5): /uploads wordt pas NA de Basic-auth-muur gemount (zie verderop),
// net als /bundels — anders staan geüploade foto's op productie zonder wachtwoord open.
// S4.7: themabundel-PDF's staan IN de repo (__dirname, niet het DATA_DIR-volume) zodat ze
// gewoon meegedeployed worden bij een git push — dit is geen runtime-upload-map.
const BUNDELS_DIR = path.join(__dirname, 'bundels');
try { if (!fs.existsSync(BUNDELS_DIR)) fs.mkdirSync(BUNDELS_DIR, { recursive: true }); } catch(e) { console.warn('Bundels-map aanmaken mislukt:', e.message); }
// Reviewfix Fable: /bundels wordt pas NA de Basic-auth-muur gemount (zie verderop) — anders
// staan alle themabundel-PDF's op productie zonder wachtwoord open.

// ── PROCES-FOUTAFHANDELING ──
// Vangt onverwachte fouten op zodat de server niet stil crasht.
process.on('uncaughtException', (err) => {
  console.error('Onverwachte fout (uncaughtException):', err);
  try { dbx.flush(); } catch (e) { console.error('Flush na uncaughtException mislukt:', e.message); }
});
process.on('unhandledRejection', (reason) => {
  console.error('Onafgehandelde promise-fout (unhandledRejection):', reason);
});

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// ── BEVEILIGING: wachtwoord via HTTP Basic Auth ──
// Stel APP_PASSWORD in als omgevingsvariabele in Railway om de app te beveiligen.
// Niet ingesteld = app blijft open (handig voor lokaal testen).
const APP_PASSWORD = process.env.APP_PASSWORD || '';
if (!APP_PASSWORD) {
  console.warn('WAARSCHUWING: APP_PASSWORD is niet ingesteld - de app is NIET beveiligd. Stel APP_PASSWORD in bij Railway > Variables.');
}
app.use((req, res, next) => {
  if (!APP_PASSWORD) return next();              // geen wachtwoord ingesteld = open
  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    let decoded = '';
    try { decoded = Buffer.from(encoded, 'base64').toString('utf8'); } catch (e) {}
    const pwd = decoded.includes(':') ? decoded.slice(decoded.indexOf(':') + 1) : decoded;
    if (pwd === APP_PASSWORD) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Sporty Logistiek"');
  return res.status(401).send('Wachtwoord vereist');
});
// Reviewfix Fable (S4.7): bundel-PDF's achter de Basic-auth-buitenmuur serveren.
app.use('/bundels', express.static(BUNDELS_DIR));
// Veiligheidsronde (DOORLICHTING-c #5): uploads achter de muur + nosniff, zodat een bestand nooit
// als HTML/script geïnterpreteerd wordt (de upload-route laat sowieso enkel jpg/jpeg/png/webp toe).
app.use('/uploads', express.static(UPLOADS_DIR, { setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff') }));
// Zoek frontend: eerst ../frontend (lokaal), dan zelfde map (Railway flat deploy)
let FRONTEND_PATH = path.join(__dirname, '../frontend');
if (!fs.existsSync(path.join(FRONTEND_PATH, 'index.html'))) {
  FRONTEND_PATH = __dirname;
}
console.log('Frontend pad:', FRONTEND_PATH);
app.use(express.static(FRONTEND_PATH));

const dbx = require('./lib/db')(DATA_DIR, DB_PATH);
const { saveDb, flush, backupDb, run, get, all, ins, now, isoDate, _genToken, resolveItemTypeId, logAct } = dbx;

// ── F1 deel 2: schrijf-batching ──
// run/ins zetten alleen een vuil-vlag; hier wordt per request (na het antwoord), elke 5 s, en bij
// SIGTERM/SIGINT geflusht. flush() schrijft atomair (sporty.db.tmp → rename) en alleen als er iets wijzigde.
function veiligFlush(waar) { try { flush(); } catch (e) { console.error('Flush mislukt (' + waar + '):', e.message); } }
app.use((req, res, next) => { res.on('finish', () => veiligFlush('request ' + req.method + ' ' + req.path)); next(); });
setInterval(() => veiligFlush('timer'), 5000).unref();
let _afsluiten = false;
function afsluiten(signaal) {
  if (_afsluiten) return; _afsluiten = true;
  console.log(signaal + ' ontvangen — database wegschrijven en stoppen');
  veiligFlush(signaal);
  process.exit(0);
}
process.on('SIGTERM', () => afsluiten('SIGTERM'));
process.on('SIGINT', () => afsluiten('SIGINT'));

async function startServer() {
  const db = await dbx.open();

  const ctx = { app, db, get, all, run, ins, saveDb, backupDb, now, isoDate, _genToken, resolveItemTypeId, logAct,
    logWijziging: dbx.logWijziging, insMetLog: dbx.insMetLog, updateMetLog: dbx.updateMetLog, delMetLog: dbx.delMetLog,
    DATA_DIR, DB_PATH, UPLOADS_DIR, BUNDELS_DIR, FRONTEND_PATH, ROOT_DIR: __dirname, APP_PASSWORD, PORT, path, fs, express, crypto };

  // ── SCHEMA MIGRATIONS (lib/migraties.js) ──
  require('./lib/migraties')(dbx, ctx);

  // ── S3.2: LOGIN / SESSIES + auth-poort (lib/auth.js) — publieke routes, dan de poort, dan de rest ──
  Object.assign(ctx, require('./lib/auth')(ctx));

  // ── Gedeelde hulpfuncties (lib/gedeeld.js) ──
  Object.assign(ctx, require('./lib/gedeeld')(ctx));

  // ── Routegebieden, in de volgorde van de oorspronkelijke kopjes ──
  for (const naam of ['locaties','kv','themas','planning','aanvragen','voorraad','transport','bakken','beheer','personeel','sport','conflicten'])
    require('./routes/' + naam)(ctx);

  // Testhaak (ALLEEN met env SPORTY_TESTHOOK=1, nooit in productie): laat een testscript de SIGTERM-handler
  // uitlokken, want op Windows is child.kill('SIGTERM') een harde TerminateProcess zonder handler.
  if (process.env.SPORTY_TESTHOOK === '1') {
    app.post('/api/_test/sigterm', (req, res) => { res.json({ ok: true }); res.on('finish', () => setTimeout(() => process.emit('SIGTERM'), 50)); });
    app.get('/api/_test/schrijfacties', (req, res) => res.json({ schrijfacties: dbx.aantalSchrijfacties(), vuil: dbx.isVuil() }));
  }

  app.get('*',(req,res)=>res.sendFile(path.join(FRONTEND_PATH,'index.html')));

  // ── GLOBALE FOUTAFHANDELING ──
  // Vangt fouten op die in een API-route gegooid worden, zodat 1 fout
  // niet de hele server of het verzoek laat vastlopen.
  app.use((err, req, res, next) => {
    console.error('API-fout:', req.method, req.path, '-', err && err.message ? err.message : err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: 'Er ging iets mis op de server. Probeer het opnieuw.' });
  });

  app.listen(PORT,()=>console.log(`Sporty vzw logistiek draait op http://localhost:${PORT}`));
}
startServer().catch(err=>{console.error('Fatal startup error:',err);process.exit(1);});
