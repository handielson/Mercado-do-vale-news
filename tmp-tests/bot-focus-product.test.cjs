// bot-focus-product-v1/v2
const test = require('node:test');
const assert = require('node:assert/strict');
const { createBotFocusProduct } = require('../services/botFocusProduct.cjs');
function pool(focusId, stock) {
  return { query: async (sql) => {
    if (/FROM admin_preferences/.test(sql)) return [[{ value_json: JSON.stringify({ product_id: focusId }) }]];
    if (/COALESCE\(SUM/.test(sql)) return [[{ category_id: 'cel', stock }]];
    throw new Error(sql);
  } };
}
const rows = () => [{ id: 'A', category_id: 'cel', stock_quantity: 3 }, { id: 'B', category_id: 'cel', stock_quantity: 9 }, { id: 'C', category_id: 'acc', stock_quantity: 50 }];
test('foco na lista: marca ele', async () => {
  const r = await createBotFocusProduct({ pool: pool('A', 3) }).mark(rows());
  assert.deepEqual(r.filter((x) => x.bot_focus).map((x) => x.id), ['A']);
});
test('foco sem estoque: marca o de mais estoque da mesma categoria', async () => {
  const r = await createBotFocusProduct({ pool: pool('Z', 0) }).mark(rows());
  assert.deepEqual(r.filter((x) => x.bot_focus).map((x) => x.id), ['B']);
});
test('foco com estoque mas fora desta lista: não marca nada', async () => {
  const r = await createBotFocusProduct({ pool: pool('Z', 4) }).mark(rows());
  assert.equal(r.filter((x) => x.bot_focus).length, 0);
});
