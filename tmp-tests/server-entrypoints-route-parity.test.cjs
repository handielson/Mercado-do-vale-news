// O servidor publicado é o server.js, copiado de vps_server.js. Rota registrada só em
// vps_server.cjs não existe em produção (foi o que quebrou o "Complemento do título no site",
// que respondia 404). Este teste trava rota nova que entre só num dos dois arquivos.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const js = read('vps_server.js');
const cjs = read('vps_server.cjs');

const registrations = source => new Set(source.match(/require\('\.\/services\/[\w]+\.cjs'\)\.register\w+/g) || []);
const directRoutes = source => new Set(source.match(/fastify\.(?:get|post|put|patch|delete)\('[^']*'/g) || []);

// Diferenças conhecidas em 06/11/2026, que já existiam antes desta correção. Ao levar uma delas
// para o vps_server.js, tire-a daqui.
const KNOWN_ONLY_IN_CJS = new Set([
  "require('./services/print3dFilamentsServer.cjs').registerPrint3dFilamentRoutes",
  "fastify.post('/products/:id/family-inheritance'",
]);

test('complemento do título no site está registrado no servidor publicado', () => {
  assert.match(js, /require\('\.\/services\/catalogTitleServer\.cjs'\)\.registerCatalogTitleRoutes\(fastify, \{ pool, requireSyncKeyOrAdmin \}\)/);
  assert.match(js, /addColumnIfMissing\('products', 'catalog_title_complement', "VARCHAR\(120\) NULL"\)/);
});

test('nenhuma rota nova só no vps_server.cjs', () => {
  const missing = [...registrations(cjs), ...directRoutes(cjs)]
    .filter(entry => !registrations(js).has(entry) && !directRoutes(js).has(entry))
    .filter(entry => !KNOWN_ONLY_IN_CJS.has(entry));
  assert.deepEqual(missing, [], 'Registre também no vps_server.js (é ele que vira o server.js na VPS).');
});
