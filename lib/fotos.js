// lib/fotos.js — foto's als bestanden i.p.v. base64 in sqlite (V3c punt 1).
// Eén waarheid voor de upload-hardening van V0: alleen jpeg/png/webp (magic bytes, niet de opgegeven extensie),
// max 2 MB na decodering, bestandsnaam volledig server-side (random), pad-check binnen UPLOADS_DIR.
// Opslag: uploads/<soort>/<jaar>/<random>.<ext>; in de db staat het RELATIEVE pad (kolom foto_path) en de
// legacy-kolom (foto_data / foto_opgeplooid / foto_opgezet) krijgt de URL '/uploads/<pad>', zodat elke bestaande
// lezer (index.html <img src>, kv-pagina, export) zonder wijziging een bruikbare URL ziet.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

module.exports = function(UPLOADS_DIR){
  const ROOT = path.resolve(UPLOADS_DIR);
  const FOTO_MAX_BYTES = 2 * 1024 * 1024;
  const SOORTEN = /^[a-z][a-z0-9_]{0,30}$/;

  function fout(msg){ const e = new Error(msg); e.status = 400; return e; }

  // Magic bytes → 'jpg' | 'png' | 'webp' | null
  function detecteer(buf){
    if(!buf || buf.length < 12) return null;
    if(buf[0]===0xFF && buf[1]===0xD8 && buf[2]===0xFF) return 'jpg';
    if(buf.slice(0,8).equals(Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]))) return 'png';
    if(buf.slice(0,4).toString('latin1')==='RIFF' && buf.slice(8,12).toString('latin1')==='WEBP') return 'webp';
    return null;
  }
  function decodeer(invoer){
    if(Buffer.isBuffer(invoer)) return invoer;
    if(typeof invoer !== 'string' || !invoer) return null;
    const b64 = invoer.replace(/^data:[^;]+;base64,/, '');
    if(!/^[A-Za-z0-9+/=\s]+$/.test(b64)) return null;
    return Buffer.from(b64, 'base64');
  }
  // Pad (relatief) → absoluut, alleen binnen UPLOADS_DIR; anders null.
  function veiligPad(rel){
    if(!rel || typeof rel !== 'string') return null;
    const abs = path.resolve(ROOT, rel);
    return abs.startsWith(ROOT + path.sep) ? abs : null;
  }

  // bewaarFoto(base64OfBuffer, soort) → relatief pad. Gooit Error met .status=400 bij ongeldige foto.
  function bewaarFoto(invoer, soort){
    if(!SOORTEN.test(soort || '')) throw fout('Ongeldige foto-soort');
    const buf = decodeer(invoer);
    if(!buf || !buf.length) throw fout('Afbeeldingsdata is geen geldige base64');
    if(buf.length > FOTO_MAX_BYTES) throw fout(`Foto te groot (max ${FOTO_MAX_BYTES/1024/1024} MB)`);
    const ext = detecteer(buf);
    if(!ext) throw fout('Ongeldig bestandstype — alleen jpg, png of webp');
    const rel = `${soort}/${new Date().getFullYear()}/${crypto.randomBytes(12).toString('hex')}.${ext}`;
    const abs = veiligPad(rel);
    if(!abs) throw fout('Ongeldige bestandsnaam');
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, buf);
    return rel;
  }
  function verwijderFoto(rel){
    const abs = veiligPad(rel);
    if(!abs) return false;
    try { fs.unlinkSync(abs); return true; } catch(e){ return false; }
  }
  const url = (rel) => rel ? '/uploads/' + rel : '';
  const isUrl = (s) => typeof s === 'string' && s.startsWith('/uploads/');
  const relVanUrl = (s) => isUrl(s) ? s.slice('/uploads/'.length) : '';

  // Verwerkt de waarde die een client voor een fotoveld stuurt, tegenover de huidige rij:
  //  undefined/null   → ongewijzigd
  //  '/uploads/…'     → ongewijzigd (client stuurt de URL terug die hij eerder kreeg)
  //  ''               → foto verwijderen
  //  base64/data-URL  → nieuw bestand bewaren, oud verwijderen
  // Geeft { pad, url } terug (de nieuwe waarden voor foto_path en legacy-kolom). Gooit bij ongeldige foto.
  function verwerkWaarde(nieuw, huidigPad, soort){
    if(nieuw === undefined || nieuw === null || isUrl(nieuw)) return { pad: huidigPad || '', url: url(huidigPad), gewijzigd: false };
    if(nieuw === ''){ if(huidigPad) verwijderFoto(huidigPad); return { pad: '', url: '', gewijzigd: !!huidigPad }; }
    const pad = bewaarFoto(nieuw, soort);
    if(huidigPad) verwijderFoto(huidigPad);
    return { pad, url: url(pad), gewijzigd: true };
  }

  return { FOTO_MAX_BYTES, detecteer, bewaarFoto, verwijderFoto, veiligPad, url, isUrl, relVanUrl, verwerkWaarde };
};
