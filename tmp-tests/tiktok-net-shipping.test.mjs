import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { suggestTikTokFeesFromSummary } from '../utils/channelProfit.js';
const require = createRequire(import.meta.url);
const { buildTikTokSaleFinancials, tikTokNetShipping } = require('../services/marketplaceSaleFinancials.cjs');

const f = (key, total_cents) => ({ path: `statement_transactions[].${key}`, total_cents, orders: 5, pct_of_revenue: null });

test('sugestão usa o frete líquido, não o frete cheio sem subsídio', () => {
  const s = suggestTikTokFeesFromSummary({ revenue_cents: 100000, orders_with_statement: 5, fields: [
    f('platform_commission_amount', -6000), f('transaction_fee_amount', -2000), f('fee_amount', -8000),
    f('actual_shipping_fee_amount', -87000), f('platform_shipping_fee_discount_amount', 70000),
    f('customer_shipping_fee_amount', 12000), f('shipping_cost_amount', -5000),
  ] });
  assert.equal(s.shippingCents, 1000);
  assert.equal(s.commissionPct, 6);
  assert.equal(s.otherPct, 2);
});

test('sem shipping_cost_amount soma a abertura com sinal', () => {
  const s = suggestTikTokFeesFromSummary({ revenue_cents: 50000, orders_with_statement: 2, fields: [
    f('actual_shipping_fee_amount', -9000), f('platform_shipping_fee_discount_amount', 7000) ] });
  assert.equal(s.shippingCents, 1000);
  assert.equal(tikTokNetShipping({ a_shipping_amount: -3, b_shipping_amount: 5 }).amount, 2);
});

test('extrato do pedido mostra só o frete líquido e reconcilia com o repasse', () => {
  const r = buildTikTokSaleFinancials({ orderStatus: 'COMPLETED', statement: { statement_transactions: [{
    revenue_amount: '100.00', settlement_amount: '83.00', fee_amount: '-12.00', platform_commission_amount: '-12.00',
    actual_shipping_fee_amount: '-17.40', platform_shipping_fee_discount_amount: '12.40', shipping_cost_amount: '-5.00' }] } });
  const ship = r.fee_lines.filter((l) => /shipping/.test(l.key));
  assert.deepEqual(ship.map((l) => [l.key, l.amount_cents]), [['shipping_cost_amount', -500]]);
  assert.equal(r.fee_lines.some((l) => l.key === 'other_adjustments'), false);
});
