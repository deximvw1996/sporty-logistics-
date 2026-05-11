# Sporty vzw Logistiek

## Lokaal starten (Windows)
Dubbelklik op `start.bat`  
Of: `cd backend && npm install && node server.js`  
Open browser: http://localhost:3001

## Railway deployment

### Eenmalig instellen
1. Maak account op [railway.app](https://railway.app)
2. New Project → Deploy from GitHub repo
3. Verbind deze repository
4. Voeg een Volume toe: Settings → Volumes → Add Volume → Mount op `/data`
5. De app draait automatisch

### Database backup
De database staat op `/data/sporty.db` op de Railway server.
Download via: Railway dashboard → Volume → Browse files
