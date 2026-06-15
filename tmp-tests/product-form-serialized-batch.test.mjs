import assert from 'node:assert/strict';

const {
  buildSerializedBatchPlan,
  findSerializedBatchDuplicates,
  findSerializedBatchInvalidImeis,
  isValidImeiValue,
  resolveSerializedBatchItemImages,
} = await import('../components/products/serializedBatch.js');

{
  const plan = buildSerializedBatchPlan(
    { name: 'Redmi A7 Pro', track_inventory: true, stock_quantity: undefined, specs: { color: 'Preto' } },
    [
      { sku: 'RN-A7-PRETO-1', eans: ['7891111111111'], bling_id: 101, bling_parent_id: 100, imei1: '869084081597944', imei2: '869084081597951', serial: '74453;66NQ07676', color: 'Preto', storage: '128GB', ram: '4GB', version: 'Global', battery_health: '100% (Nova)' },
      { sku: 'RN-A7-PRETO-2', eans: ['7892222222222'], bling_id: 102, bling_parent_id: 100, imei1: '869084081562781', imei2: '869084081562799', serial: '74453;66NQ07339', color: 'Preto', storage: '128GB', ram: '4GB', version: 'Global', battery_health: '100% (Nova)' },
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
  assert.deepEqual(plan.items.map((item) => item.sku), ['RN-A7-PRETO-1', 'RN-A7-PRETO-2']);
  assert.deepEqual(plan.items.map((item) => item.eans), [['7891111111111'], ['7892222222222']]);
  assert.deepEqual(plan.items.map((item) => item.bling_id), [101, 102]);
  assert.deepEqual(plan.items.map((item) => item.bling_parent_id), [100, 100]);
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

{
  assert.equal(isValidImeiValue('123456789012345'), true, 'IMEI com 15 numeros deve ser valido');
  assert.equal(isValidImeiValue('12345678901234'), false, 'IMEI com menos de 15 numeros deve ser invalido');
  assert.equal(isValidImeiValue('1234567890123456'), false, 'IMEI com mais de 15 numeros deve ser invalido');
  assert.equal(isValidImeiValue('12345678901234A'), false, 'IMEI com letras deve ser invalido');
  assert.deepEqual(
    findSerializedBatchInvalidImeis([{ sku: 'RN148256P', imei1: '123456789012345', imei2: '1850401003276' }]),
    ['RN148256P: IMEI 2 deve ter exatamente 15 numeros'],
  );
}

{
  assert.deepEqual(
    resolveSerializedBatchItemImages({
      itemImages: ['item-1.jpg'],
      colorImages: ['color-1.jpg'],
      fallbackImages: ['form-1.jpg'],
    }),
    ['item-1.jpg'],
  );

  assert.deepEqual(
    resolveSerializedBatchItemImages({
      itemImages: [],
      colorImages: ['color-1.jpg'],
      fallbackImages: ['form-1.jpg'],
    }),
    ['color-1.jpg'],
  );

  assert.deepEqual(
    resolveSerializedBatchItemImages({
      itemImages: undefined,
      colorImages: [],
      fallbackImages: ['form-1.jpg'],
    }),
    ['form-1.jpg'],
  );
}

console.log('product-form-serialized-batch tests passed');
