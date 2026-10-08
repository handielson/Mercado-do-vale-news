const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}
function fixture({ stockFailure = false, itemsFailure = false, notificationFailure = false } = {}) {
  const calls = []; const stockStarted = deferred(); const stockRelease = deferred();
  let storedSale;
  const modules = {
    '../utils/saleCalculations': {
      calculateSaleTotals: () => ({ subtotal: 10000, discount_total: 0, cost_total: 5000 }),
      calculateSalePaymentTotals: () => ({ total: 10000 }), prepareSalePayments: () => [],
    },
    '../utils/money': { moneyToCents: Number, moneyReaisToCents: value => Math.round(Number(value) * 100) },
    '../utils/referenceNumber': { formatReferenceNumber: () => 'TEST' },
    './promotionService': { promotionService: { getPromotionStatus: async () => ({ isActive: false }) } },
    './blingService': { syncStockToBling: async () => {} },
    './stockLocationService': { stockLocationService: { decrementStockByPriority: async payload => {
      calls.push({ path: 'stock-start', payload }); stockStarted.resolve();
      await stockRelease.promise;
      if (stockFailure) throw Error('Stock unavailable');
      calls.push({ path: 'stock-done' });
      return [{ deposit_is_default: true, location_is_default: true }];
    } } },
    './vpsClient': { vpsClient: {
      post: async (path, body) => {
        calls.push({ path, body });
        if (path === '/table-data/sales' || path === '/sales/finalize-serialized') {
          storedSale = path === '/table-data/sales' ? body : body.sale;
          return storedSale;
        }
        if (path === '/table-data/sale_items/bulk' && itemsFailure) throw Error('Items unavailable');
        if (path === '/whatsapp/automation/sale-completed') {
          if (notificationFailure) throw Error('Notification unavailable');
          return { status: 'sent' };
        }
        return {};
      },
      patch: async (path, body) => { calls.push({ path, body }); return { ...storedSale, ...body }; },
    } },
  };
  const context = { exports: {}, require: id => modules[id] || {}, console: { error() {}, warn() {}, log() {} },
    crypto: require('node:crypto').webcrypto };
  const code = ts.transpileModule(fs.readFileSync('services/saleService.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, context);
  return { create: items => context.exports.createSale({ items, payment_methods: [] }), calls, stockStarted, stockRelease };
}
const numeric = { product_id: 'numeric', quantity: 1, unit_price: 10000, total: 10000, track_inventory: true };
const serialized = { ...numeric, product_id: 'serialized', serialized_unit: { unitId: 'synthetic-unit' } };
for (const mixed of [false, true]) {
  test(`${mixed ? 'mixed' : 'numeric'} sale waits for local stock before notifying`, async () => {
    const f = fixture(); const work = f.create(mixed ? [serialized, numeric] : [numeric]);
    await f.stockStarted.promise;
    assert.ok(!f.calls.some(x => x.path.includes('/whatsapp/')));
    f.stockRelease.resolve(); const sale = await work;
    assert.equal(sale.finalization_status, 'success');
    assert.equal(f.calls.filter(x => x.path === '/whatsapp/automation/sale-completed').length, 1);
    assert.ok(f.calls.findIndex(x => x.path === 'stock-done') < f.calls.findIndex(x => x.path.includes('/whatsapp/')));
    assert.equal(f.calls.filter(x => x.path === 'stock-start').length, 1);
  });
}
test('failed stock blocks notification and keeps review audit', async () => {
  const f = fixture({ stockFailure: true }); f.stockRelease.resolve();
  const sale = await f.create([serialized, numeric]);
  assert.equal(sale.finalization_status, 'needs_review');
  assert.ok(!f.calls.some(x => x.path.includes('/whatsapp/')));
  const log = JSON.parse(sale.finalization_log);
  assert.ok(log.finalization_issues.some(x => x.step === 'stock_decrement'));
  assert.ok(log.finalization_warnings.some(x => x.details?.reason === 'inventory_not_finalized'));
});
test('failed item persistence blocks stock and notification', async () => {
  const f = fixture({ itemsFailure: true }); const sale = await f.create([numeric]);
  assert.equal(sale.finalization_status, 'needs_review');
  assert.ok(!f.calls.some(x => x.path === 'stock-start' || x.path.includes('/whatsapp/')));
});
test('notification failure after stock is a warning, with no stock retry', async () => {
  const f = fixture({ notificationFailure: true }); f.stockRelease.resolve();
  const sale = await f.create([numeric]);
  assert.equal(sale.finalization_status, 'success');
  assert.equal(f.calls.filter(x => x.path === 'stock-start').length, 1);
  assert.ok(JSON.parse(sale.finalization_log).finalization_warnings.some(x => x.step === 'sale_whatsapp'));
});
test('serialized-only and untracked sales keep confirmation without numeric decrement', async () => {
  for (const items of [[serialized], [{ ...numeric, track_inventory: false }]]) {
    const f = fixture(); const sale = await f.create(items);
    assert.equal(sale.finalization_status, 'success');
    assert.ok(!f.calls.some(x => x.path === 'stock-start'));
    assert.equal(f.calls.filter(x => x.path.includes('/whatsapp/')).length, 1);
  }
});
test('automatic warranty delivery is blocked for a sale requiring review', () => {
  const source = fs.readFileSync('pages/pdv/PDVPage.tsx', 'utf8');
  assert.match(source, /if \(sale.finalization_status === 'needs_review'\) \{\s*throw new Error\('Envio automatico do termo bloqueado:[\s\S]*?buildWarrantyTermData\(sale, selectedCustomer, cartItems\)/);
});
