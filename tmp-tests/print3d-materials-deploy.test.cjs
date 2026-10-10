const test = require('node:test');
const assert = require('node:assert/strict');
const { patchEntry } = require('../scripts/deploy-print3d-materials.cjs');
const anchor = "fastify.get('/admin/preferences/:key', { preHandler: requireSyncKeyOrAdmin }, async (req, reply) => {";
test('selective materials deployment preserves remote code and is idempotent', () => {
  for (const newline of ['\n', '\r\n']) {
    const original = ['// remote customization', anchor, '});', '// remote ending'].join(newline);
    const patched = patchEntry(original);
    assert.ok(patched.startsWith('// remote customization' + newline));
    assert.ok(patched.endsWith('// remote ending'));
    assert.ok(patched.includes('registerPrint3dMaterialRoutes'));
    assert.equal(patchEntry(patched), patched);
    assert.equal(patched.replace(/require\('\.\/services\/print3dMaterialsServer.cjs'\).registerPrint3dMaterialRoutes\(fastify, \{ pool, requireAdminBearerToken \}\);\r?\n\r?\n/, ''), original);
  }
});
test('selective deployment refuses missing or ambiguous anchors and divergent hooks', () => {
  assert.throws(() => patchEntry('different server'));
  assert.throws(() => patchEntry(anchor + '\n' + anchor));
  assert.throws(() => patchEntry('registerPrint3dMaterialRoutes();\n' + anchor));
});
