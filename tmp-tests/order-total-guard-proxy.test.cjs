'use strict';

// order-total-guard-v1: roda o /api/vps-proxy real (recortado) para conferir que a trava de
// total vale para itens gravados por CLIENTE e não atrapalha o admin.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function slice(src, start, end) {
  const from = src.indexOf(start);
  assert.ok(from >= 0, `trecho nao encontrado: ${start}`);
  return src.slice(from, src.indexOf(end, from + start.length));
}

function fakeReply() {
  return {
    statusCode: 200, payload: undefined, headers: {},
    code(c) { this.statusCode = c; return this; },
    header(k, v) { this.headers[k] = v; return this; },
    send(p) { this.payload = p; return this; },
  };
}

const PHONE = { id: 'p-phone', parent_id: null, price_retail: 200000, price_reseller: null, price_wholesale: null, price_promo: null, kits: null, discount_percentage: null };

function loadProxy(file, { isAdmin, orderTotal }) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  const injected = [];
  const pool = {
    async query(sql) {
      if (sql.startsWith('SELECT * FROM orders')) return [[{ id: 'o1', customer_id: 'c1', subtotal: orderTotal, discount: 0, coupon_discount: 0, coins_discount: 0, shipping_cost: 0, total: orderTotal }]];
      if (sql.startsWith('SELECT * FROM order_items')) return [[]];
      if (sql.includes('FROM product_storefront_offers')) return [[]];
      if (sql.includes('FROM products')) return [[PHONE]];
      if (sql.startsWith('SELECT customer_type')) return [[{ customer_type: 'retail' }]];
      throw new Error(`SQL não previsto: ${sql}`);
    },
  };
  const handlers = {};
  const context = {
    fastify: {
      all: (url, h) => { handlers[url] = h; },
      inject: async (opts) => { injected.push(opts); return { statusCode: 201, headers: {}, rawPayload: '{}' }; },
    },
    pool,
    process: { env: { SYNC_SECRET: 'x' } },
    console: { warn() {}, info() {}, log() {}, error() {} },
    require: (id) => require(id.startsWith('./') ? path.join(root, id) : id),
    handleBrasilapiNcmProxy: async () => {},
    normalizeVpsProxyPath: (p) => p,
    getVpsBearerAuthContext: async () => ({ userId: 'u1', customerId: 'c1', isAdmin }),
    isVpsProxyPublicPath: () => false,
    extractVpsProxyFavoritesCustomerId: () => null,
    isVpsProxyCustomerFinancialPath: () => false,
    isVpsProxyCustomerOrderWritePath: () => true,
    isVpsProxyCustomerSelfServicePath: () => false,
    assertVpsProxyCustomerOrderWriteAllowed: async () => true,
    isVpsProxyAccountantDocumentPath: () => false,
    isVpsProxySensitiveGetPath: () => false,
    isVpsProxyPublicTableDataReadPath: () => false,
    verificationClientIp: () => '127.0.0.1',
    buildVpsProxyPayload: (r) => JSON.stringify(r.body),
  };
  vm.createContext(context);
  vm.runInContext(slice(src, "fastify.all('/api/vps-proxy',", 'const jsonStr ='), context);
  return { handler: handlers['/api/vps-proxy'], injected };
}

function request(items) {
  return { method: 'POST', query: { path: '/table-data/order_items/bulk' }, headers: { 'content-type': 'application/json' }, body: items };
}

const ADULTERATED = [{ order_id: 'o1', product_id: 'p-phone', product_name: 'Phone', quantity: 1, unit_price: 1000, subtotal: 1000 }];
const CORRECT = [{ order_id: 'o1', product_id: 'p-phone', product_name: 'Phone', quantity: 1, unit_price: 200000, subtotal: 200000 }];

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  test(`${file}: cliente com item adulterado recebe 409 e os itens não são gravados`, async () => {
    const { handler, injected } = loadProxy(file, { isAdmin: false, orderTotal: 1000 });
    const reply = fakeReply();
    await handler(request(ADULTERATED), reply);
    assert.equal(reply.statusCode, 409);
    assert.equal(reply.payload.code, 'item_below_price');
    assert.equal(injected.length, 0);
  });

  test(`${file}: cliente com pedido correto segue normalmente`, async () => {
    const { handler, injected } = loadProxy(file, { isAdmin: false, orderTotal: 200000 });
    const reply = fakeReply();
    await handler(request(CORRECT), reply);
    assert.equal(reply.statusCode, 201);
    assert.equal(injected.length, 1);
  });

  test(`${file}: admin pode gravar com preço negociado (sem trava)`, async () => {
    const { handler, injected } = loadProxy(file, { isAdmin: true, orderTotal: 1000 });
    const reply = fakeReply();
    await handler(request(ADULTERATED), reply);
    assert.equal(reply.statusCode, 201);
    assert.equal(injected.length, 1);
  });
}
