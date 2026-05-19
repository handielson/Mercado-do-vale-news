import assert from 'node:assert/strict';

const {
  buildSerializedBatchPlan,
  findSerializedBatchDuplicates,
} = await import('../components/products/serializedBatch.js');

{
  const plan = buildSerializedBatchPlan(
    { name: 'Redmi A7 Pro', track_inventory: true, stock_quantity: undefined, specs: { color: 'Preto' } },
    [
      { imei1: '869084081597944', imei2: '869084081597951', serial: '74453;66NQ07676', color: 'Preto', storage: '128GB', ram: '4GB', version: 'Global', battery_health: '100% (Nova)' },
      { imei1: '869084081562781', imei2: '869084081562799', serial: '74453;66NQ07339', color: 'Preto', storage: '128GB', ram: '4GB', version: 'Global', battery_health: '100% (Nova)' },
    ],
  );

  assert.equal(plan.batchStockQuantity, 2);
  assert.equal(plan.items.length, 2);
  assert.deepEqual(plan.items.map((item) => item.stock_quantity), [1, 1]);
  assert.deepEqual(plan.items.map((item) => item.specs.imei1), ['869084081597944', '869084081562781']);
  assert.deepEqual(plan.items.map((item) => item.specs.color), ['Preto', 'Preto']);
  assert.deepEqual(plan.items.map((item) => item.specs.storage), ['128GB', '128GB']);
  assert.deepEqual(plan.items.map((item) => item.specs.ram), ['4GB', '4GB']);
  assert.deepEqual(plan.items.map((item) => item.specs.version), ['Global', 'Global']);
  assert.deepEqual(plan.items.map((item) => item.specs.battery_health), ['100% (Nova)', '100% (Nova)']);
}

{
  const duplicates = findSerializedBatchDuplicates([
    { imei1: '111111111111111', imei2: '222222222222222', serial: 'ABC' },
    { imei1: '111111111111111', imei2: '333333333333333', serial: 'DEF' },
    { imei1: '444444444444444', imei2: '222222222222222', serial: 'ABC' },
  ]);

  assert.deepEqual(duplicates, [
    'IMEI 1: 111111111111111',
    'IMEI 2: 222222222222222',
    'Serial: ABC',
  ]);
}

console.log('product-form-serialized-batch tests passed');
