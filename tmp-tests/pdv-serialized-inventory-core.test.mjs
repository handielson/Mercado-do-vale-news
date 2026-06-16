import assert from 'node:assert/strict';

const mod = await import('../services/pdvSerializedInventory.ts');

const products = [
  {
    id: 'prod-athomics',
    name: 'Athomics Inspire Lite',
    sku: 'rail',
    track_inventory: true,
    stock_quantity: 3,
    price_retail: 45000,
    specs: { serial: 'LEGACY-SHOULD-NOT-RENDER' },
  },
  {
    id: 'prod-cable',
    name: 'Cabo USB-C',
    sku: 'CABO-USB',
    track_inventory: true,
    stock_quantity: 3,
    price_retail: 2500,
    specs: {},
  },
];

const unitsByProduct = new Map([
  ['prod-athomics', [
    { id: 'unit-1', product_id: 'prod-athomics', status: 'available', imei_1: '', imei_2: '', serial_number: 'AT2209901430', condition: 'new', created: '', updated: '' },
    { id: 'unit-2', product_id: 'prod-athomics', status: 'available', imei_1: '', imei_2: '', serial_number: 'AT2209901450', condition: 'new', created: '', updated: '' },
    { id: 'unit-sold', product_id: 'prod-athomics', status: 'sold', imei_1: '', imei_2: '', serial_number: 'SOLD-SHOULD-NOT-SHOW', condition: 'new', created: '', updated: '' },
  ]],
  ['prod-cable', []],
]);

const cards = await mod.buildPdvSearchCards(products, {
  listUnitsByProduct: async (productId) => unitsByProduct.get(productId) || [],
});

assert.equal(cards.length, 2, 'one serialized product card plus one normal stock product card');

const serialized = cards.find((card) => card.id === 'product:prod-athomics:serialized');
assert.equal(serialized.kind, 'serialized-product');
assert.equal(serialized.stockLabel, '2 unidades disponiveis');
assert.equal(serialized.quantityLocked, true);
assert.equal(serialized.unitOptions.length, 2);
assert.deepEqual(
  serialized.unitOptions.map((option) => option.label),
  ['Serial: AT2209901430', 'Serial: AT2209901450'],
);
assert.deepEqual(
  serialized.unitOptions.map((option) => option.unitData.unitId),
  ['unit-1', 'unit-2'],
);
assert.ok(
  serialized.unitOptions.every((option) => !option.label.includes('SOLD-SHOULD-NOT-SHOW')),
  'sold units must not be selectable',
);
assert.ok(
  JSON.stringify(serialized).includes('LEGACY-SHOULD-NOT-RENDER') === false,
  'legacy specs identifiers must not render in PDV search cards',
);

const cable = cards.find((card) => card.id === 'product:prod-cable:stock');
assert.equal(cable.kind, 'stock-product');
assert.equal(cable.subtitle, 'SKU: CABO-USB');
assert.equal(cable.quantityLocked, false);
assert.equal(cable.maxQuantity, 3);
assert.equal(cable.stockLabel, '3 disponiveis');

const exactOption = mod.buildPdvUnitOption({
  id: 'unit-exact',
  product_id: 'prod-athomics',
  status: 'available',
  imei_1: '860000000000001',
  imei_2: '860000000000002',
  serial_number: 'AT2209901885',
  condition: 'new',
  created: '',
  updated: '',
});

assert.equal(exactOption.id, 'unit:unit-exact');
assert.equal(exactOption.label, 'IMEI 1: 860000000000001');
assert.equal(exactOption.detail, 'IMEI 2: 860000000000002 | Serial: AT2209901885');
assert.equal(exactOption.unitData.unitId, 'unit-exact');
assert.equal(exactOption.unitData.imei1, '860000000000001');
assert.equal(exactOption.unitData.imei2, '860000000000002');
assert.equal(exactOption.unitData.serial, 'AT2209901885');

console.log('pdv serialized inventory core checks passed');
