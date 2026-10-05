const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { normalizeSale, isSaleFreshForNotification } = require('../services/mobileSalesPushService.cjs');
const source = fs.readFileSync(require.resolve('../services/mercadoLivreServer.cjs'), 'utf8');
// Execute the actual converter and webhook processor without loading PDF/printing dependencies.
function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf('\n}', start) + 2;
  assert.ok(start >= 0 && end > start);
  return source.slice(source.slice(start - 6, start) === 'async ' ? start - 6 : start, end);
}
const converters = `${functionSource('mercadoLivreOrderToAdminSale')}\n${functionSource('mercadoLivrePaidOrderToMobileSale')}`;
const convert = vm.runInNewContext(`${converters}; mercadoLivrePaidOrderToMobileSale`);
const paid = { id: 'test-ml-sale', status: 'paid', date_closed: new Date().toISOString(), total_amount: 25.90,
  order_items: [{ quantity: 2, unit_price: 12.95, item: { title: 'produto teste', seller_sku: 'TESTE' } }] };

test('paid Mercado Livre order maps to the shared notification contract in cents', () => {
  const sale = normalizeSale(convert(paid));
  assert.equal(sale.channel, 'mercado_livre');
  assert.equal(sale.external_id, 'test-ml-sale');
  assert.equal(sale.total_cents, 2590);
  assert.equal(sale.details.items[0].unit_price_cents, 1295);
  assert.ok(isSaleFreshForNotification(sale));
});
test('unpaid, cancelled and undated orders do not become new sale notifications', () => {
  for (const status of ['cancelled', 'payment_required', 'payment_in_process']) assert.equal(convert({ ...paid, status }), null);
  assert.equal(convert({ ...paid, date_closed: null }), null);
  assert.equal(convert({ ...paid, date_closed: 'invalid-date' }), null);
  const old = normalizeSale(convert({ ...paid, date_closed: '2020-01-01T00:00:00Z' }));
  assert.equal(isSaleFreshForNotification(old), false);
});

test('order and shipment notifications share one sale key and send only once', async () => {
  const sent = [];
  const keys = new Set();
  const pushSource = fs.readFileSync(require.resolve('../services/mobileSalesPushService.cjs'), 'utf8');
  const context = { require, module: { exports: {} }, process, console, Date,
    fakeMessaging: { sendEachForMulticast: async payload => { sent.push(payload); return { successCount: 1, failureCount: 0, responses: [{ success: true }] }; } },
  };
  vm.runInNewContext(`${pushSource}\ngetFirebaseMessaging = () => fakeMessaging;`, context);
  const service = context.module.exports.createMobileSalesPushService({ logger: { info() {}, error() {} }, pool: {
    query: async (sql, args) => {
      if (sql.includes('INSERT IGNORE INTO mobile_sale_events')) {
        const duplicate = keys.has(args[1]); keys.add(args[1]);
        return [{ affectedRows: duplicate ? 0 : 1 }];
      }
      if (sql.includes('SELECT token')) return [[{ token: 'fake-token-never-sent' }]];
      return [[], []];
    },
  } });
  await service.recordSaleEvent(convert(paid));
  await service.recordSaleEvent(convert(paid));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].data.channel, 'mercado_livre');
  assert.equal(sent[0].data.notification_title, 'Nova venda • Mercado Livre');
  assert.match(sent[0].data.notification_body, /25,90/);
});

test('mobile list pages Mercado Livre and detail fetches the exact order', async () => {
  const requests = [];
  const load = vm.runInNewContext(`${converters}\n${functionSource('loadMercadoLivreSales')}; loadMercadoLivreSales`, {
    URLSearchParams,
    loadSettings: async () => ({ user_id: '123' }),
    mlRequest: async (_pool, path) => { requests.push(path); return { json: async () => path.startsWith('/orders/search')
      ? { results: [{ ...paid, id: requests.length }], paging: { total: 2 } } : { ...paid, id: '789' } }; },
  });
  const list = await load({}, 2, '', '2026-10-01', '2026-10-05');
  assert.equal(list.length, 2);
  assert.match(requests[0], /seller=123/);
  assert.match(requests[1], /offset=1/);
  assert.match(requests[0], /order.date_created.from=/);
  const single = await load({}, 1, '789');
  assert.equal(single[0].external_id, '789');
  assert.equal(requests.at(-1), '/orders/789');
  await assert.rejects(load({}, 1, '../bad'), /inválido/);
});

test('Android recognizes Mercado Livre for notification navigation and the sales card', () => {
  const root = '../android/admin-estoque/app/src/main/java/br/com/mercadodovale/adminestoque/';
  const model = fs.readFileSync(require.resolve(`${root}domain/SaleSummary.kt`), 'utf8');
  const activity = fs.readFileSync(require.resolve(`${root}MainActivity.kt`), 'utf8');
  assert.match(model, /MERCADO_LIVRE\("mercado_livre", "Mercado Livre"/);
  assert.match(activity, /salesChannelCard\(SalesChannel.MERCADO_LIVRE\)/);
  assert.match(activity, /SalesChannel.MERCADO_LIVRE -> Color/);
  for (const file of ['vps_server.js', 'vps_server.cjs']) {
    const server = fs.readFileSync(require.resolve(`../${file}`), 'utf8');
    assert.match(server, /sales = await loadMercadoLivreSales\(pool, limit, '', startDate, endDate\)/);
    assert.match(server, /sale = \(await loadMercadoLivreSales\(pool, 1, saleId\)\)/);
  }
});
test('sale callback runs even when shipment is not available yet', async () => {
  const seen = [];
  const process = vm.runInNewContext(`${converters}\n${functionSource('processNotification')}; processNotification`, {
    mlRequest: async () => ({ json: async () => paid }),
    autoLinkOrderItems: async () => { throw Error('must not reach printing before shipment'); },
  });
  const pool = { query: async () => [[], []] };
  await assert.rejects(process(pool, 'synthetic-event', { kind: 'order', resourceId: paid.id }, { onSale: async sale => seen.push(normalizeSale(sale)) }), /Pedido sem remessa/);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].channel, 'mercado_livre');
});
test('both server entrypoints wire Mercado Livre to the canonical push service', () => {
  for (const file of ['vps_server.js', 'vps_server.cjs']) {
    const server = fs.readFileSync(require.resolve(`../${file}`), 'utf8');
    assert.match(server, /registerMercadoLivreRoutes\(fastify,\s*\{[^}]*onSale:\s*\(sale\) => mobileSalesPushService.recordSaleEvent\(sale\)/);
  }
  assert.match(source, /processNotification\(pool, eventKey, parsed, \{ onSale \}\)/);
});

test('shipment events also record a paid order before printing work', async () => {
  const seen = [];
  const process = vm.runInNewContext(`${converters}\n${functionSource('processNotification')}; processNotification`, {
    mlRequest: async (_pool, path) => ({ json: async () => path.startsWith('/shipments/') ? { order_id: paid.id } : paid }),
    autoLinkOrderItems: async () => { throw Error('printing unavailable'); },
  });
  await assert.rejects(process({ query: async () => [[], []] }, 'test-shipment', { kind: 'shipment', resourceId: 'test' }, {
    onSale: async sale => seen.push(normalizeSale(sale)),
  }), /printing unavailable/);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].external_id, paid.id);
});
