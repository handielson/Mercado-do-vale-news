const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { patchModule, patchEntry, schemaReady, setRecipeFlag, MODULES } = require('../scripts/deploy-product-registration.cjs');
test('registration publisher rejects unknown drift; accepts only reviewed baseline or its release', () => {
  assert.equal(patchModule('old\r\n', 'new\n', 'old\n'), 'new\n');
  assert.equal(patchModule('new\n', 'new\n', 'old\n'), 'new\n');
  assert.throws(() => patchModule('unknown', 'new', 'old'), /differs/);
  assert.throws(() => patchModule('', 'new', 'old'), /Missing/);
  assert.equal(patchModule('', 'new', ''), 'new');
  assert(!MODULES.some(p => /Payments|Checkout|Filament|Shipping|shopee/.test(p)));
});
test('entry patch preserves existing integrations and is idempotent in both API entrypoints', () => {
  // All three deployed entries use this reviewed baseline helper. The legacy
  // local .js does not; the publisher deliberately patches remote sources.
  for (const source of [require('node:child_process').execFileSync('git',['show','7555d8eb:vps_server.cjs'],{encoding:'utf8',maxBuffer:8*1024*1024}), fs.readFileSync('vps_server.cjs','utf8')]) {
    const patched = patchEntry(source);
    assert.match(patched, /AS parent_images/);
    assert.equal(patchEntry(patched), patched);
    assert.equal((patched.match(/registerPrint3dRecipeRoutes/g)||[]).length, 1);
    assert.equal((patched.match(/registerPrint3dRecipeFileRoutes/g)||[]).length, 1);
    assert.equal((patched.match(/registerPrint3dActiveRecipeRoutes/g)||[]).length, 1);
    assert(patched.includes('uploadPrivate:'));
  }
  assert.throws(() => patchEntry('unknown entry'), /batch/);
});
test('activation only changes recipe flag, rejecting duplicates and incomplete schema', () => {
  const original = 'SECRET=untouched\nMDV_PRINT3D_PRODUCTION_ENABLED=0\nMDV_PRINT3D_SHIPPING_ENABLED=1\n';
  assert.equal(setRecipeFlag(original), original+'MDV_PRINT3D_RECIPES_ENABLED=1');
  assert.equal(setRecipeFlag(setRecipeFlag(original)), setRecipeFlag(original));
  assert.throws(() => setRecipeFlag('MDV_PRINT3D_RECIPES_ENABLED=0\nMDV_PRINT3D_RECIPES_ENABLED=1'), /Duplicate/);
  assert.throws(() => schemaReady({}), /Missing/);
});
