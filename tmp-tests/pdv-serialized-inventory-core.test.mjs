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
  {
    id: 'prod-legacy-serial',
    name: 'Athomics Inspire Lite',
    sku: 'RAIL-LEGACY',
    track_inventory: true,
    stock_quantity: 1,
    price_retail: 45000,
    specs: { serial: 'AT2209900136' },
  },
];

const unitsByProduct = new Map([
  ['prod-athomics', [
    { id: 'unit-1', product_id: 'prod-athomics', status: 'available', imei_1: '', imei_2: '', serial_number: 'AT2209901430', condition: 'new', created: '', updated: '' },
    { id: 'unit-2', product_id: 'prod-athomics', status: 'available', imei_1: '', imei_2: '', serial_number: 'AT2209901450', condition: 'new', created: '', updated: '' },
    { id: 'unit-sold', product_id: 'prod-athomics', status: 'sold', imei_1: '', imei_2: '', serial_number: 'SOLD-SHOULD-NOT-SHOW', condition: 'new', created: '', updated: '' },
  ]],
  ['prod-cable', []],
  ['prod-legacy-serial', []],
]);

const cards = await mod.buildPdvSearchCards(products, {
  listUnitsByProduct: async (productId) => unitsByProduct.get(productId) || [],
});

assert.equal(cards.length, 3, 'serialized unit cards, one normal stock product card, and one legacy serial card');

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

const legacySerial = cards.find((card) => card.id === 'product:prod-legacy-serial:serialized');
assert.equal(legacySerial.kind, 'serialized-product');
assert.equal(legacySerial.stockLabel, '1 unidade disponivel');
assert.deepEqual(legacySerial.unitOptions.map((option) => option.label), ['Serial: AT2209900136']);
assert.equal(legacySerial.unitOptions[0].unitData.unitId, undefined);
assert.equal(legacySerial.unitOptions[0].unitData.serial, 'AT2209900136');

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
assert.equal(exactOption.label, 'IMEI 1: 860000000000001 | IMEI 2: 860000000000002 | Serial: AT2209901885');
assert.equal(exactOption.detail, '');
assert.equal(exactOption.unitData.unitId, 'unit-exact');
assert.equal(exactOption.unitData.imei1, '860000000000001');
assert.equal(exactOption.unitData.imei2, '860000000000002');
assert.equal(exactOption.unitData.serial, 'AT2209901885');

const hydratedCards = mod.fromHydratedPdvSearchPayload([
  {
    product: {
      id: 'prod-athomics-canonical',
      name: 'Athomics Inspire Lite',
      sku: 'RAIL',
      track_inventory: true,
      stock_quantity: 21,
      price_retail: 45000,
      specs: {},
    },
    available_units: [
      { id: 'unit-hydrated', product_id: 'prod-athomics-canonical', status: 'available', imei_1: '', imei_2: '', serial: 'AT2209901855', condition: 'new', created: '', updated: '' },
    ],
    has_unit_history: true,
  },
  {
    product: {
      id: 'prod-athomics-legacy-duplicate',
      name: 'Athomics Inspire Lite',
      sku: 'rail',
      track_inventory: true,
      stock_quantity: 21,
      price_retail: 45000,
      specs: { serial: 'AT2209900136' },
    },
    available_units: [],
    has_unit_history: true,
  },
]);

assert.equal(hydratedCards.length, 1, 'hydrated duplicate products with the same SKU must render one product card');
assert.equal(hydratedCards[0].id, 'product:prod-athomics-canonical:serialized');
assert.equal(hydratedCards[0].kind, 'serialized-product');
assert.deepEqual(hydratedCards[0].unitOptions.map((option) => option.label), ['Serial: AT2209901855']);
assert.ok(hydratedCards[0].unitOptions.every((option) => option.unitData.unitId), 'migrated groups must expose only real unit ids');

const soldOnlyCards = mod.fromHydratedPdvSearchPayload([{
  product: {
    id: 'prod-sold-only', name: 'Smartphone vendido', sku: 'SOLD-ONE', track_inventory: true,
    stock_quantity: 1, price_retail: 100000, specs: { imei1: '864812087937929' },
  },
  available_units: [],
  has_unit_history: true,
}]);
assert.deepEqual(soldOnlyCards, [], 'sold units in stale product specs must never return as available stock');

const smartphoneCards = mod.fromHydratedPdvSearchPayload([
  {
    product: {
      id: 'prod-redmi-legacy-duplicate',
      name: 'Redmi note 15 pró 4g',
      sku: 'XI-REDMINOTE15PRO4G-TI-8GB-256GB',
      model_id: 'model-redmi-15-pro',
      track_inventory: true,
      stock_quantity: 1,
      price_retail: 177000,
      specs: {
        ram: '8GB',
        storage: '256GB',
        color: 'Titânio',
        imei1: '865750085805988',
        imei2: '865750085805996',
      },
    },
    available_units: [],
    has_unit_history: true,
  },
  {
    product: {
      id: 'prod-redmi-canonical',
      name: 'Redmi Note 15 Pró 4G',
      sku: 'RN15P8256T',
      model_id: 'model-redmi-15-pro',
      track_inventory: true,
      stock_quantity: 2,
      price_retail: 177000,
      specs: {
        ram: '8GB',
        storage: '256GB',
        color: 'Titanio',
      },
    },
    available_units: [
      { id: 'unit-redmi-1', product_id: 'prod-redmi-canonical', status: 'available', imei_1: '865750085805988', imei_2: '865750085805996', serial: '72698/W5XJ03708', condition: 'new', created: '', updated: '' },
      { id: 'unit-redmi-2', product_id: 'prod-redmi-canonical', status: 'available', imei_1: '865750084601982', imei_2: '865750084601990', serial: '72698/W5XJ04308', condition: 'new', created: '', updated: '' },
    ],
    has_unit_history: true,
  },
  {
    product: {
      id: 'prod-redmi-preto',
      name: 'Redmi Note 15 Pró 4G',
      sku: 'RN15P8256P',
      model_id: 'model-redmi-15-pro',
      track_inventory: true,
      stock_quantity: 1,
      price_retail: 177000,
      specs: {
        ram: '8GB',
        storage: '256GB',
        color: 'Preto',
      },
    },
    available_units: [
      { id: 'unit-redmi-preto', product_id: 'prod-redmi-preto', status: 'available', imei_1: '865750081088886', imei_2: '865750081088894', serial: '71373/W5XH022', condition: 'new', created: '', updated: '' },
    ],
    has_unit_history: true,
  },
]);

assert.equal(smartphoneCards.length, 2, 'same smartphone model/spec/color must group even when duplicate SKUs differ');
const titanium = smartphoneCards.find((card) => card.id === 'product:prod-redmi-canonical:serialized');
assert.equal(titanium.kind, 'serialized-product');
assert.equal(titanium.stockLabel, '2 unidades disponiveis');
assert.deepEqual(
  titanium.unitOptions.map((option) => option.label),
  [
    'IMEI 1: 865750085805988 | IMEI 2: 865750085805996 | Serial: 72698/W5XJ03708',
    'IMEI 1: 865750084601982 | IMEI 2: 865750084601990 | Serial: 72698/W5XJ04308',
  ],
);
assert.ok(
  JSON.stringify(titanium).includes('XI-REDMINOTE15PRO4G-TI-8GB-256GB') === false,
  'legacy duplicate smartphone SKU must not leak into the grouped PDV card',
);
assert.ok(
  smartphoneCards.some((card) => card.id === 'product:prod-redmi-preto:serialized'),
  'different smartphone color must remain a separate product card',
);

console.log('pdv serialized inventory core checks passed');
