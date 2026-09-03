import assert from 'node:assert/strict';
import { groupEquivalentSerializedProducts } from '../hooks/adminProductFilters';
import { ProductStatus } from '../utils/field-standards';

const base: any = {
  model_id: 'model-redmi-note-15',
  model: 'Redmi Note 15',
  category_id: 'smartphones',
  name: 'Redmi Note 15 8/256 Preto',
  sku: 'R158256P',
  specs: { ram: '8 GB', storage: '256 GB', color: 'Preto', version: 'Global' },
  eans: ['1234567890123'],
  bling_id: 123,
  images: [],
  status: ProductStatus.ACTIVE,
  track_inventory: true,
  created: '2026-01-01T00:00:00Z',
  updated: '2026-01-01T00:00:00Z',
};

const grouped = groupEquivalentSerializedProducts([
  { ...base, id: 'product-a', stock_quantity: 1 },
  { ...base, id: 'product-b', stock_quantity: 2, specs: { ...base.specs, ram: '8GB', storage: '256GB' } },
]);

assert.equal(grouped.length, 1, 'equivalent serialized products must render as one card');
assert.equal(grouped[0].stock_quantity, 3, 'the grouped card must sum available stock');
assert.deepEqual(new Set(grouped[0].equivalent_product_ids), new Set(['product-a', 'product-b']));

const differentColor = groupEquivalentSerializedProducts([
  { ...base, id: 'product-a', stock_quantity: 1 },
  { ...base, id: 'product-c', stock_quantity: 1, specs: { ...base.specs, color: 'Azul' } },
]);
assert.equal(differentColor.length, 2, 'different commercial variations must remain separate');

const ordinaryDuplicateSku = groupEquivalentSerializedProducts([
  { ...base, id: 'rail-a', model_id: 'rail', specs: {}, sku: 'RAIL', stock_quantity: 1 },
  { ...base, id: 'rail-b', model_id: 'rail', specs: {}, sku: 'RAIL', stock_quantity: 2 },
]);
assert.equal(ordinaryDuplicateSku.length, 2, 'ordinary inventory products must not be grouped as serialized phones');

const serializedReceiverBase = {
  ...base,
  model_id: 'model-athomics-inspire-lite',
  model: 'Athomics Inspire Lite',
  category_id: 'receptores',
  name: 'Athomics Inspire Lite',
  sku: 'RAIL',
  specs: {},
  bling_id: undefined,
};
const groupedSerializedReceiver = groupEquivalentSerializedProducts([
  {
    ...serializedReceiverBase,
    id: 'rail-current',
    status: ProductStatus.OUT_OF_STOCK,
    stock_quantity: 0,
    created: '2026-07-03T20:23:08Z',
    updated: '2026-07-03T20:32:11Z',
  },
  {
    ...serializedReceiverBase,
    id: 'rail-old-aggregate',
    status: ProductStatus.ACTIVE,
    stock_quantity: 3,
    created: '2026-06-01T23:37:32Z',
    updated: '2026-09-02T14:11:46Z',
  },
  {
    ...serializedReceiverBase,
    id: 'rail-legacy-a',
    sku: 'rail',
    specs: { serial: 'TEST-RAIL-SERIAL-A' },
    stock_quantity: 19,
    created: '2026-06-17T13:58:47Z',
  },
  {
    ...serializedReceiverBase,
    id: 'rail-legacy-b',
    specs: { serial_number: 'TEST-RAIL-SERIAL-B' },
    stock_quantity: 1,
    created: '2026-06-16T14:51:08Z',
  },
]);

assert.equal(groupedSerializedReceiver.length, 1, 'serialized receiver records must render as one administrative card');
assert.equal(groupedSerializedReceiver[0].id, 'rail-current', 'the current aggregate record must remain canonical');
assert.equal(groupedSerializedReceiver[0].stock_quantity, 0, 'legacy serialized stocks must not be added to the current aggregate stock');
assert.deepEqual(
  new Set(groupedSerializedReceiver[0].equivalent_product_ids),
  new Set(['rail-current', 'rail-old-aggregate', 'rail-legacy-a', 'rail-legacy-b']),
);

console.log('admin equivalent serialized product grouping tests passed');
