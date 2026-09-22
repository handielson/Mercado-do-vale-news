const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Exercise the production route and helpers without starting the server or touching data.
async function run(file) {
  const source = fs.readFileSync(file, 'utf8');
  const extract = name => {
    const match = source.match(new RegExp('(async )?function ' + name + '\\b[\\s\\S]*?\\n}'));
    assert.ok(match, name);
    return match[0];
  };
  const local = { id: 'local', sku: 'Lii-S12', bling_id: '16693307529', stock_quantity: 2 };
  let patches = 0, sends = 0, serial = 0, failure = false, stocks = true;
  const ctx = vm.createContext({
    request: { method: 'POST', body: {} },
    query: { sku: 'Lii-S12' },
    reply: { status: 200, code(n) { this.status = n; return this; }, send(body) { return body; } },
    isBlingReconcileAuthorizedVps: () => true,
    getValidBlingAccessTokenForReconcileVps: async () => 'fake',
    fetchAllLocalProductsForReconcileVps: async () => [local, { id: 'other', sku: 'other', bling_id: 8, stock_quantity: 0 }],
    fetchAllBlingStocksForReconcileVps: async () => stocks ? [{ produto: { id: 16693307529 }, saldoFisicoTotal: 2 }] : [],
    fetchAllBlingProductsForReconcileVps: async () => { throw Error('targeted run should not fetch all products'); },
    syncBlingSerialSalesFromRecentOrdersVps: async () => { serial++; },
    patchVpsForReconcileVps: async () => { patches++; return true; },
    getShopeeStockTargetsForProductIds: async ids => {
      assert.equal(JSON.stringify(ids), '["local"]');
      return [{ ...local, stock_quantity: 2 }];
    },
    syncMarketplaceStockFromBlingTargetsVps: async targets => {
      assert.equal(targets[0].stock_quantity, 2); sends++;
      return { ok: !failure, shopee: { ok: !failure }, tiktok: { ok: true } };
    },
    summarizeBlingReconcilePlanDetailsVps: p => p,
    buildCopyableDebug: () => ({}),
  });
  for (const name of ['normalizeReconcileIntegerVps', 'getRemoteStockProductIdVps', 'getRemoteStockEntryValueVps', 'buildBlingReconcilePlanVps', 'applyReconcileStockChangesVps']) vm.runInContext(extract(name), ctx);
  const start = source.indexOf("if (resource === 'reconcile') {");
  const end = source.indexOf("if (resource === 'serial-sales-sync')", start);
  const route = '(async()=>{const resource="reconcile";' + source.slice(start, end) + '})()';
  ctx.query.dryRun = 'true';
  let result = await vm.runInContext(route, ctx);
  assert.equal(result.ok, true); assert.equal(sends, 0); assert.equal(patches, 0); assert.equal(serial, 0);
  ctx.query.dryRun = 'false';
  result = await vm.runInContext(route, ctx);
  assert.equal(result.ok, true); assert.equal(sends, 1); assert.equal(patches, 0);
  failure = true;
  result = await vm.runInContext(route, ctx);
  assert.equal(result.ok, false); assert.equal(result.failed[0].type, 'marketplace_stock');
  failure = false; local.stock_quantity = 0;
  result = await vm.runInContext(route, ctx);
  // Mock canonical endpoint readback reflects the persisted total.
  assert.equal(patches, 1);
  assert.equal(result.ok, true); assert.equal(sends, 3);
  stocks = false; const before = sends;
  result = await vm.runInContext(route, ctx);
  assert.equal(result.ok, false); assert.equal(ctx.reply.status, 422); assert.equal(sends, before);
  console.log(file + ': targeted replay, dry-run, missing stock and failure reporting passed');
}
(async () => { for (const file of ['vps_server.cjs', 'vps_server.js']) await run(file); })().catch(e => { console.error(e); process.exitCode = 1; });
