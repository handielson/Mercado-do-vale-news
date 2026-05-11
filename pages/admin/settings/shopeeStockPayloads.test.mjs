import assert from 'node:assert/strict';

import {
  applyShopeeStockFields,
  buildShopeeAddItemStockVariants,
  extractShopeeLocationIds,
  isShopeeSellerStockConstraintError,
} from './shopeeStockPayloads.js';

const variants = buildShopeeAddItemStockVariants({ stock: 3.8, locationIds: ['LOC-1', 'LOC-1', 'LOC-2'] });

assert.equal(variants.length, 4);
assert.equal(variants[0].stockFields.normal_stock, 3);
assert.deepEqual(variants[1].stockFields.stock_info, [{ stock_type: 'NORMAL', normal_stock: 3 }]);
assert.deepEqual(variants[2].stockFields.stock_info_v2.seller_stock, [
  { location_id: 'LOC-1', stock: 3 },
  { location_id: 'LOC-2', stock: 3 },
]);
assert.deepEqual(variants[3].stockFields.stock_info[0].seller_stock, [
  { location_id: 'LOC-1', stock: 3, allocated_stock: 0 },
  { location_id: 'LOC-2', stock: 3, allocated_stock: 0 },
]);

assert.deepEqual(
  applyShopeeStockFields(
    { item_name: 'Produto', normal_stock: 9, stock_info: [{ old: true }] },
    { stock_info_v2: { seller_stock: [{ stock: 1 }] } }
  ),
  { item_name: 'Produto', stock_info_v2: { seller_stock: [{ stock: 1 }] } }
);

assert.equal(
  isShopeeSellerStockConstraintError('invalid field seller_stock, value must Not Null'),
  true
);
assert.equal(isShopeeSellerStockConstraintError('outro erro qualquer'), false);

assert.deepEqual(
  extractShopeeLocationIds({
    response: {
      warehouse_list: [
        { warehouse_id: 'WH-1' },
        { warehouse_id: 'WH-2' },
        { warehouse_id: 'WH-1' },
      ],
    },
  }),
  ['WH-1', 'WH-2']
);

// shop/get_warehouse_detail returns response as a top-level array
assert.deepEqual(
  extractShopeeLocationIds({
    response: [
      { warehouse_id: 6, location_id: 'BRZ', address_id: 123 },
      { warehouse_id: 7, location_id: 'BRA', address_id: 124 },
    ],
  }),
  ['BRZ', 'BRA']
);

console.log('shopeeStockPayloads.test.mjs: ok');
