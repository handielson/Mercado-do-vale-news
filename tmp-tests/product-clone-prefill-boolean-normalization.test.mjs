import assert from 'node:assert/strict';

const { buildProductClonePrefill } = await import('../services/productClonePrefill.js');

const clone = buildProductClonePrefill({
  id: 'prod-1',
  name: 'Athomics Inspire Lite',
  sku: 'RAIL',
  track_inventory: 1,
  is_gift: 0,
  is_combo: 0,
  is_virtual: 0,
  exclude_from_seo: 0,
  specs: '{"imei1":"123","serial":"ABC","color":"Preto"}',
});

assert.equal(clone.track_inventory, true, 'track_inventory must be boolean for productSchema');
assert.equal(clone.is_gift, false, 'is_gift must be boolean for productSchema');
assert.equal(clone.is_combo, false, 'is_combo must be boolean for productSchema');
assert.equal(clone.is_virtual, false, 'is_virtual must be boolean for productSchema');
assert.equal(clone.exclude_from_seo, false, 'exclude_from_seo must be boolean for productSchema');
assert.equal(clone.specs.imei1, '', 'serialized identity must be cleared when cloning');
assert.equal(clone.specs.serial, '', 'serialized identity must be cleared when cloning');

console.log('product clone prefill boolean normalization passed');
