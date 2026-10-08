const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchProductReadPrivacy } = require('../scripts/deploy-product-read-privacy.cjs');
test('selective patch preserves remote integrations and is idempotent on each entrypoint', () => {
  for (const file of ['server.js', 'vps_server.js', 'vps_server.cjs']) {
    const local = fs.readFileSync(file, 'utf8');
    const before = local.replace(/\s*customerType: customer\?\.customer_type \|\| null,/, '')
      .replace(/require\('\.\/services\/productReadPrivacy.cjs'\)\.registerProductReadPrivacy\(fastify, \{\s*getAuth: getVpsBearerAuthContext,\s*\}\);\s*/, '') + '\n// remote integration preserved\n';
    const patched = patchProductReadPrivacy(before);
    assert.equal(patchProductReadPrivacy(patched), patched);
    assert.ok(patched.replace(/\r\n/g, '\n').endsWith('// remote integration preserved\n'));
    assert.equal((patched.match(/registerProductReadPrivacy/g) || []).length, 1);
    assert.ok(patched.includes('customerType: customer?.customer_type || null,'));
  }
  assert.throws(() => patchProductReadPrivacy('unexpected runtime'), /Missing auth anchors/);
});
