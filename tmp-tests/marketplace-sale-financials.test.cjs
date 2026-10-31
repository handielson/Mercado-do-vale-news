const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildShopeeSaleFinancials,
  shopeeCostLookupItems,
  resolveShopeeItemCosts,
  createShopeeSaleFinancialsLoader,
} = require('../services/marketplaceSaleFinancials.cjs');

const escrow = {
  order_sn: '2610313CVAXERH',
  order_income: {
    original_price: 12.9,
    seller_discount: 0,
    voucher_from_seller: 0,
    commission_fee: 1.81,
    service_fee: 0,
    seller_transaction_fee: 0,
    buyer_total_amount: 13.53,
    escrow_amount: 7.09,
    escrow_amount_pri: 7.09,
    items: [{ item_id: 111, model_id: 222, item_name: 'Adaptador Micro Usb', model_name: 'Preto', model_sku: 'ADV8PRE', quantity_purchased: 1 }],
  },
};

test('reconciles every line with the Shopee payout', () => {
  const result = buildShopeeSaleFinancials({
    escrowResponse: escrow,
    orderStatus: 'PROCESSED',
    costItems: [{ name: 'Adaptador', quantity: 1, unit_cost_cents: 300, total_cost_cents: 300 }],
  });
  assert.equal(result.state, 'estimated');
  assert.equal(result.product_revenue_cents, 1290);
  assert.equal(result.payout_cents, 709);
  const feeTotal = result.fee_lines.reduce((sum, line) => sum + line.amount_cents, 0);
  assert.equal(result.product_revenue_cents + feeTotal, result.payout_cents);
  assert.deepEqual(result.fee_lines.map((line) => line.key), ['commission_fee', 'other_adjustments']);
  assert.equal(result.fee_lines[1].amount_cents, -400);
  assert.equal(result.marketplace_deductions_cents, 581);
  assert.equal(result.profit_cents, 409);
  assert.equal(result.cost.complete, true);
  assert.ok(result.raw_fields.every((field) => !field.key.endsWith('_pri')));
});

test('completed orders are final and seller discounts reduce revenue', () => {
  const result = buildShopeeSaleFinancials({
    escrowResponse: { order_income: { original_price: 100, seller_discount: 10, voucher_from_seller: -5, commission_fee: 17, escrow_amount: 68 } },
    orderStatus: 'COMPLETED',
    costItems: [],
  });
  assert.equal(result.state, 'final');
  assert.equal(result.product_revenue_cents, 8500);
  assert.equal(result.fee_lines.find((line) => line.key === 'commission_fee').amount_cents, -1700);
  assert.equal(result.fee_lines.some((line) => line.key === 'other_adjustments'), false);
  assert.equal(result.cost.complete, false);
});

test('missing escrow keeps the modal informative', () => {
  assert.equal(buildShopeeSaleFinancials({ escrowResponse: null, orderStatus: 'CANCELLED' }).state, 'cancelled');
  const unavailable = buildShopeeSaleFinancials({ escrowResponse: null, orderStatus: 'READY_TO_SHIP', error: 'boom' });
  assert.equal(unavailable.state, 'unavailable');
  assert.equal(unavailable.note, 'boom');
  assert.equal(unavailable.profit_cents, null);
});

test('cost lookup prefers the Shopee listing link, then a unique SKU', async () => {
  const queries = [];
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (/FROM shopee_products/.test(sql)) return [[{ product_id: 'p-linked', shopee_item_id: 111, shopee_model_id: 222 }]];
      return [[
        { id: 'p-linked', name: 'Adaptador Preto', sku: 'ADV8PRE', price_cost: 350 },
        { id: 'p-sku', name: 'Cabo', sku: 'CABO1', price_cost: '120' },
      ]];
    },
  };
  const items = [
    ...shopeeCostLookupItems(escrow),
    { name: 'Cabo', sku: 'cabo1', item_id: '999', model_id: '0', quantity: 2 },
    { name: 'Sem cadastro', sku: '', item_id: '', model_id: '', quantity: 1 },
  ];
  const costs = await resolveShopeeItemCosts(pool, 'primary', items);
  assert.equal(queries[0].params[0], 'primary');
  assert.deepEqual(costs.map((item) => [item.product_id, item.matched_by, item.total_cost_cents]), [
    ['p-linked', 'shopee_link', 350],
    ['p-sku', 'sku', 240],
    [null, null, 0],
  ]);
});

test('loader survives Shopee errors and returns unavailable state', async () => {
  const load = createShopeeSaleFinancialsLoader({
    pool: { query: async () => [[]] },
    fetchEscrow: async () => ({ error: 'error_param', message: 'order not found' }),
  });
  const result = await load({ external_id: 'X', status: 'READY_TO_SHIP', details: { items: [{ name: 'A', sku: 'A1', quantity: 1 }] } });
  assert.equal(result.state, 'unavailable');
  assert.equal(result.note, 'order not found');
  assert.equal(result.cost.items.length, 1);
});
