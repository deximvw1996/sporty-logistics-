// Hulp voor tests (CH2): de rit-pagina tekent zich in de browser uit GET /api/rit-token/:token/data.
// ritTekst(data) geeft de HTML terug die de pagina daaruit bouwt (Dag + elke Stop), zodat tests erop kunnen zoeken.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const RP = require(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'rit.js'));
export function ritTekst(data) {
  if (!data || !data.stops) return '';
  return RP.dagHtml(data) + data.stops.map((s) => RP.stopHtml(data, s.taak_id)).join('');
}
