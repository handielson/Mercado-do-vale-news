'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isWarrantyLine,
  productFloorCents,
  verifyOrderTotals,
  guardCustomerOrderItems,
} = require('../services/orderTotalGuard.cjs');

const NOW = new Date('2026-11-09T12:00:00Z').getTime();
const PHONE = { id: 'p-phone', parent_id: null, price_retail: 200000, price_reseller: 180000, price_wholesale: 170000, price_promo: null, kits: null, discount_percentage: null };
const CASE = { id: 'p-case', parent_id: null, price_retail: 3000, price_reseller: 2500, price_wholesale: 2000, price_promo: null, kits: JSON.stringify([{ quantity: 3, price: 7500 }]), discount_percentage: null };
const WARRANTY_OPTIONS = [{ months: 12, percentage: 10, active: true }, { months: 6, percentage: 6, active: true }, { months: 24, percentage: 50, active: false }];

function line(product, quantity, unit) {
  return { product_id: product.id, product_name: `Produto ${product.id}`, quantity, unit_price: unit, subtotal: unit * quantity };
}

function order(items, extra = {}) {
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const coupon = extra.coupon_discount || 0;
  const coins = extra.coins_discount || 0;
  const shipping = extra.shipping_cost || 0;
  return { id: 'o1', customer_id: 'c1', subtotal, coupon_discount: coupon, coins_discount: coins, discount: coupon + coins, shipping_cost: shipping, total: subtotal - coupon - coins + shipping, delivery_type: 'pickup', ...extra };
}

function verify(items, extra = {}, opts = {}) {
  return verifyOrderTotals({ order: order(items, extra), items, productRows: opts.rows || [PHONE, CASE], customerType: opts.customerType || 'retail', coupon: opts.coupon || null, warrantyOptions: opts.warrantyOptions || WARRANTY_OPTIONS, now: NOW });
}

test('identifica a linha de garantia pelo nome usado no checkout e no orçamento', () => {
  assert.equal(isWarrantyLine({ product_name: 'Garantia Estendida +12m — Redmi Note 15' }), true);
  assert.equal(isWarrantyLine({ product_name: 'Capa com garantia estendida' }), false);
});

test('menor preço legítimo considera tipo de cliente, promoção, kit e variações', () => {
  assert.equal(productFloorCents({ rows: [PHONE], quantity: 1, customerType: 'retail', now: NOW }), 200000);
  assert.equal(productFloorCents({ rows: [PHONE], quantity: 1, customerType: 'wholesale', now: NOW }), 170000);
  assert.equal(productFloorCents({ rows: [CASE], quantity: 3, customerType: 'retail', now: NOW }), 2500);
  assert.equal(productFloorCents({ rows: [CASE], quantity: 2, customerType: 'retail', now: NOW }), 3000);
  const promo = { ...PHONE, price_promo: 189900, promo_start: '2026-11-01', promo_end: '2026-11-30' };
  assert.equal(productFloorCents({ rows: [promo], quantity: 1, customerType: 'retail', now: NOW }), 189900);
  const expired = { ...PHONE, price_promo: 150000, promo_start: '2026-10-01', promo_end: '2026-10-31' };
  assert.equal(productFloorCents({ rows: [expired], quantity: 1, customerType: 'retail', now: NOW }), 200000);
  const combo = { ...PHONE, discount_percentage: 10 };
  assert.equal(productFloorCents({ rows: [combo], quantity: 1, customerType: 'retail', now: NOW }), 180000);
  const child = { ...PHONE, id: 'p-phone-azul', parent_id: 'p-phone', price_retail: 195000 };
  assert.equal(productFloorCents({ rows: [PHONE, child], quantity: 1, customerType: 'retail', now: NOW }), 195000);
  assert.equal(productFloorCents({ rows: [{ id: 'x', price_retail: 0 }], quantity: 1, customerType: 'retail', now: NOW }), null);
});

test('pedido correto passa', () => {
  const result = verify([line(PHONE, 1, 200000), line(CASE, 2, 3000)], { shipping_cost: 1500 });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});

test('preço de produto adulterado é recusado', () => {
  const result = verify([line(PHONE, 1, 1000)]);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, 'item_below_price');
});

test('preço de revenda só vale para cliente de revenda', () => {
  assert.equal(verify([line(PHONE, 1, 180000)], {}, { customerType: 'resale' }).ok, true);
  assert.equal(verify([line(PHONE, 1, 180000)], {}, { customerType: 'retail' }).ok, false);
});

test('total do pedido diferente da soma dos itens é recusado', () => {
  const items = [line(PHONE, 1, 200000)];
  const result = verifyOrderTotals({ order: { ...order(items), total: 1000 }, items, productRows: [PHONE], customerType: 'retail', warrantyOptions: [], now: NOW });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.code === 'order_total_mismatch'));
});

test('subtotal do pedido diferente da soma das linhas é recusado', () => {
  const items = [line(PHONE, 1, 200000)];
  const bad = { ...order(items), subtotal: 1000, total: 1000 };
  assert.ok(verifyOrderTotals({ order: bad, items, productRows: [PHONE], customerType: 'retail', warrantyOptions: [], now: NOW }).errors.some((e) => e.code === 'order_subtotal_mismatch'));
});

test('produto inexistente é recusado', () => {
  assert.equal(verify([{ product_id: 'nao-existe', product_name: 'X', quantity: 1, unit_price: 100, subtotal: 100 }]).errors[0].code, 'unknown_product');
});

test('garantia dentro do limite passa com aviso; acima é recusada', () => {
  const phone = line(PHONE, 1, 200000);
  const ok = verify([phone, { product_id: PHONE.id, product_name: 'Garantia Estendida +12m — Phone', quantity: 1, unit_price: 20000, subtotal: 20000 }]);
  assert.equal(ok.ok, true, JSON.stringify(ok.errors));
  assert.ok(ok.warnings.some((w) => w.code === 'warranty_unverified'));
  const bad = verify([phone, { product_id: PHONE.id, product_name: 'Garantia Estendida +24m — Phone', quantity: 1, unit_price: 90000, subtotal: 90000 }]);
  assert.equal(bad.errors[0].code, 'warranty_above_limit');
});

test('garantia precisa estar ligada a um produto do pedido', () => {
  const result = verify([line(CASE, 1, 3000), { product_id: PHONE.id, product_name: 'Garantia Estendida +12m — Phone', quantity: 1, unit_price: 200, subtotal: 200 }]);
  assert.ok(result.errors.some((e) => e.code === 'warranty_without_base_item'));
});

test('garantia com subtotal diferente do unit_price (caso do checkout) não recusa pedido legítimo', () => {
  const phone = line(PHONE, 1, 200000);
  const result = verify([phone, { product_id: PHONE.id, product_name: 'Garantia Estendida +12m — Phone', quantity: 1, unit_price: 20000, subtotal: 0 }]);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});

test('cupom: desconto dentro do permitido passa; acima é recusado', () => {
  const coupon = { code: 'VALE10', type: 'percent', value: 10, min_order: 0, target_type: 'all' };
  const items = [line(PHONE, 1, 200000)];
  assert.equal(verify(items, { coupon_code: 'VALE10', coupon_discount: 20000 }, { coupon }).ok, true);
  assert.equal(verify(items, { coupon_code: 'VALE10', coupon_discount: 90000 }, { coupon }).errors[0].code, 'coupon_above_allowed');
});

test('cupom: desconto sem cupom cadastrado é recusado', () => {
  assert.equal(verify([line(PHONE, 1, 200000)], { coupon_code: 'FALSO', coupon_discount: 5000 }).errors[0].code, 'coupon_not_found');
});

test('cupom: pedido mínimo e tipo de cliente', () => {
  const coupon = { code: 'ATAC', type: 'fixed', value: 10, min_order: 50, target_type: 'atacado' };
  assert.ok(verify([line(PHONE, 1, 200000)], { coupon_code: 'ATAC', coupon_discount: 1000 }, { coupon }).errors.some((e) => e.code === 'coupon_customer_type'));
  assert.equal(verify([line(PHONE, 1, 170000)], { coupon_code: 'ATAC', coupon_discount: 1000 }, { coupon, customerType: 'wholesale' }).ok, true);
  assert.ok(verify([line(CASE, 1, 3000)], { coupon_code: 'ATAC', coupon_discount: 1000 }, { coupon: { ...coupon, target_type: 'all' } }).errors.some((e) => e.code === 'coupon_min_order'));
});

test('pedido com moedas continua passando', () => {
  assert.equal(verify([line(PHONE, 1, 200000)], { coins_spent: 500, coins_discount: 500 }).ok, true);
});

test('guardCustomerOrderItems carrega do banco e recusa item adulterado com 409', async () => {
  const calls = [];
  const pool = {
    async query(sql, params) {
      calls.push(sql);
      if (sql.startsWith('SELECT * FROM orders')) return [[order([line(PHONE, 1, 1000)])]];
      if (sql.startsWith('SELECT * FROM order_items')) return [[]];
      if (sql.includes('FROM product_storefront_offers')) return [[]];
      if (sql.includes('FROM products')) return [[PHONE]];
      if (sql.startsWith('SELECT customer_type')) return [[{ customer_type: 'retail' }]];
      throw new Error(`SQL não previsto: ${sql}`);
    },
  };
  const silent = { warn() {}, info() {} };
  const result = await guardCustomerOrderItems(pool, [{ order_id: 'o1', ...line(PHONE, 1, 1000) }], { now: NOW, logger: silent });
  assert.equal(result.ok, false);
  assert.equal(result.status, 409);
  assert.equal(result.body.code, 'item_below_price');
});

test('guardCustomerOrderItems aceita pedido correto e recusa itens de pedidos misturados', async () => {
  const items = [line(PHONE, 1, 200000)];
  const pool = {
    async query(sql) {
      if (sql.startsWith('SELECT * FROM orders')) return [[order(items)]];
      if (sql.startsWith('SELECT * FROM order_items')) return [[]];
      if (sql.includes('FROM product_storefront_offers')) return [[]];
      if (sql.includes('FROM products')) return [[PHONE]];
      if (sql.startsWith('SELECT customer_type')) return [[{ customer_type: 'retail' }]];
      throw new Error(`SQL não previsto: ${sql}`);
    },
  };
  const silent = { warn() {}, info() {} };
  assert.equal((await guardCustomerOrderItems(pool, [{ order_id: 'o1', ...items[0] }], { now: NOW, logger: silent })).ok, true);
  const mixed = await guardCustomerOrderItems(pool, [{ order_id: 'o1', ...items[0] }, { order_id: 'o2', ...items[0] }], { now: NOW, logger: silent });
  assert.equal(mixed.status, 400);
});

test('itens já gravados entram na conta (não dá para somar itens depois)', async () => {
  const first = line(PHONE, 1, 200000);
  const pool = {
    async query(sql) {
      if (sql.startsWith('SELECT * FROM orders')) return [[order([first])]];
      if (sql.startsWith('SELECT * FROM order_items')) return [[{ order_id: 'o1', ...first }]];
      if (sql.includes('FROM product_storefront_offers')) return [[]];
      if (sql.includes('FROM products')) return [[PHONE]];
      if (sql.startsWith('SELECT customer_type')) return [[{ customer_type: 'retail' }]];
      throw new Error(`SQL não previsto: ${sql}`);
    },
  };
  const result = await guardCustomerOrderItems(pool, [{ order_id: 'o1', ...first }], { now: NOW, logger: { warn() {}, info() {} } });
  assert.equal(result.ok, false);
  assert.equal(result.body.code, 'order_subtotal_mismatch');
});

test('preço publicado por site entra como preço legítimo', async () => {
  const items = [line(PHONE, 1, 185000)];
  const pool = {
    async query(sql) {
      if (sql.startsWith('SELECT * FROM orders')) return [[order(items)]];
      if (sql.startsWith('SELECT * FROM order_items')) return [[]];
      if (sql.includes('FROM product_storefront_offers')) return [[{ product_id: PHONE.id, price_retail: 185000, price_reseller: null, price_wholesale: null, price_promo: null }]];
      if (sql.includes('FROM products')) return [[PHONE]];
      if (sql.startsWith('SELECT customer_type')) return [[{ customer_type: 'retail' }]];
      throw new Error(`SQL não previsto: ${sql}`);
    },
  };
  const result = await guardCustomerOrderItems(pool, [{ order_id: 'o1', ...items[0] }], { now: NOW, logger: { warn() {}, info() {} } });
  assert.equal(result.ok, true);
});

test('tabela de ofertas por site ausente não derruba a trava', async () => {
  const items = [line(PHONE, 1, 200000)];
  const pool = {
    async query(sql) {
      if (sql.startsWith('SELECT * FROM orders')) return [[order(items)]];
      if (sql.startsWith('SELECT * FROM order_items')) return [[]];
      if (sql.includes('FROM product_storefront_offers')) { const e = new Error('no table'); e.code = 'ER_NO_SUCH_TABLE'; throw e; }
      if (sql.includes('FROM products')) return [[PHONE]];
      if (sql.startsWith('SELECT customer_type')) return [[{ customer_type: 'retail' }]];
      throw new Error(`SQL não previsto: ${sql}`);
    },
  };
  assert.equal((await guardCustomerOrderItems(pool, [{ order_id: 'o1', ...items[0] }], { now: NOW, logger: { warn() {}, info() {} } })).ok, true);
});
