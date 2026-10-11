'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { patchEntry } = require('../scripts/deploy-product-auto-sku.cjs');
const before = `// remote-only integration\nfastify.post('/products/batch', {}, async () => {\n      await withSmartphonePriceWrite(pool, p, async (priceDb, controlledProduct) => {\n        writeProduct();\n      }, { transactional: true });\n      results.upserted++;\n  return results;\n});\n// another remote integration`;
test('deploy SKU altera somente batch, preserva drift e é idempotente', () => {
  for (const source of [before, before.replace(/\n/g, '\r\n')]) {
    const updated = patchEntry(source);
    assert.match(updated, /withProductSku\(pool, p/);
    assert.match(updated, /withSmartphonePriceWrite\(skuDb, p/);
    assert.ok(updated.startsWith('// remote-only integration'));
    assert.ok(updated.endsWith('// another remote integration'));
    assert.equal(patchEntry(updated), updated);
    assert.equal(updated.includes('\r\n'), source.includes('\r\n'));
  }
});
test('deploy SKU recusa âncoras ambíguas ou implementação divergente', () => {
  assert.throws(() => patchEntry(before + before), /Unexpected/);
  assert.throws(() => patchEntry(before.replace('withSmartphonePriceWrite(pool', 'changedWrite(pool')), /Unexpected/);
  assert.throws(() => patchEntry(patchEntry(before).replace('withSmartphonePriceWrite(skuDb', 'changedWrite(skuDb')), /Unexpected/);
});
