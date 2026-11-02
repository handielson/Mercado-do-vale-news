const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchUnitReadPrivacy } = require('../scripts/deploy-unit-read-privacy.cjs');

// Leitura de aparelhos (IMEI, custo) só para administrador ou chave interna.
for (const file of ['vps_server.cjs', 'vps_server.js', 'server.js']) {
  const source = fs.readFileSync(file, 'utf8');
  test(`${file}: rotas de leitura de units protegidas`, () => {
    assert.match(source, /fastify\.get\('\/units', \{ preHandler: requireSyncKeyOrAdmin \}, async/);
    assert.match(source, /fastify\.get\('\/units\/by-identifier\/:q', \{ preHandler: requireSyncKeyOrAdmin \}, async/);
    assert.equal(patchUnitReadPrivacy(source), source, 'patch é idempotente');
  });
  test(`${file}: proxy do site trata /units como sensível`, () => {
    const body = source.match(/function isVpsProxySensitiveGetPath\(proxyPath\) \{[\s\S]*?\n\}/)[0];
    const fn = new Function(`${body}; return isVpsProxySensitiveGetPath;`)();
    assert.equal(fn('/units?company_id=x&status=all'), true);
    assert.equal(fn('/units/by-identifier/490154203237518'), true);
    assert.equal(fn('/smartphone-photo-intakes?status=all'), true);
    assert.equal(fn('/smartphone-brand-margins'), true);
    assert.equal(fn('/smartphone-photo-color-mappings'), true);
    assert.equal(fn('/products/abc'), false, 'leitura pública de produto continua aberta');
  });
}

test('patch aplica nas rotas antigas e preserva CRLF', () => {
  const old = "async function requireSyncKeyOrAdmin(request, reply) {}\r\nfunction isVpsProxySensitiveGetPath(proxyPath) {\r\n  return (\r\n    proxyPath.startsWith('/company-settings') ||\r\n    false\r\n  );\r\n}\r\nfastify.get('/units', async (req, reply) => {\r\n});\r\nfastify.get('/units/by-identifier/:q', async (req, reply) => {\r\n});\r\n";
  const patched = patchUnitReadPrivacy(old);
  assert.match(patched, /preHandler: requireSyncKeyOrAdmin \}, async \(req, reply\) => \{\r\n\}\);\r\nfastify\.get\('\/units\/by-identifier/);
  assert.match(patched, /proxyPath\.startsWith\('\/units'\) \|\|\r\n/);
  assert.match(patched, /proxyPath\.startsWith\('\/smartphone-'\) \|\|\r\n/);
  assert.equal(patched.split('\r\n').length, old.split('\r\n').length + 2);
});

test('patch recusa servidor sem requireSyncKeyOrAdmin', () => {
  assert.throws(() => patchUnitReadPrivacy("fastify.get('/units', async (req, reply) => {"), /requireSyncKeyOrAdmin/);
});
