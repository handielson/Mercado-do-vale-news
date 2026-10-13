import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

for (const fileName of ['vps_server.js', 'vps_server.cjs']) {
  const source = fs.readFileSync(path.join(root, fileName), 'utf8');
  const statusSource = source.match(/function tiktokOrderRestoresMarketplaceInventoryVps\(status\) \{[\s\S]*?\n\}/)?.[0];
  const skuSource = source.match(/function tiktokOrderSellerSkusVps\(sale\) \{[\s\S]*?\n\}/)?.[0];
  const replaySource = source.match(/async function replayTikTokAuthoritativeStockAfterRestockVps\(sale\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(statusSource, `${fileName}: missing restock status classifier`);
  assert.ok(skuSource, `${fileName}: missing seller SKU collector`);
  assert.ok(replaySource, `${fileName}: missing authoritative stock replay`);

  const context = {};
  vm.runInNewContext(`${statusSource}; ${skuSource}; this.classify=tiktokOrderRestoresMarketplaceInventoryVps; this.collect=tiktokOrderSellerSkusVps;`, context);
  assert.equal(context.classify('CANCELLED'), true);
  assert.equal(context.classify('RETURNED'), true);
  assert.equal(context.classify('REFUND_COMPLETED'), true);
  assert.equal(context.classify('AWAITING_COLLECTION'), false);
  assert.deepEqual(
    [...context.collect({ details: { items: [{ sku: ' tt370c ' }, { sku: 'TT370C' }, { sku: '' }] } })],
    ['TT370C'],
  );

  const calls = [];
  const replayContext = {
    pool: { query: async (_sql, values) => { calls.push(['query', values]); return [[{ id: 'local-product-id' }]]; } },
    getShopeeStockTargetsForProductIds: async (ids) => { calls.push(['targets', ids]); return [{ id: ids[0], stock_quantity: 0 }]; },
    syncTikTokStockFromBlingTargetsVps: async (targets) => { calls.push(['sync', targets]); return { ok: true, updated: 1, errors: [] }; },
  };
  vm.runInNewContext(`${skuSource}; ${replaySource}; this.replay=replayTikTokAuthoritativeStockAfterRestockVps;`, replayContext);
  const replayResult = await replayContext.replay({ details: { items: [{ sku: 'tt370c' }] } });
  assert.equal(replayResult.ok, true);
  assert.deepEqual([...calls[0][1]], ['TT370C']);
  assert.deepEqual([...calls[1][1]], ['local-product-id']);
  assert.equal(calls[2][1][0].stock_quantity, 0);

  assert.match(source, /replayTikTokAuthoritativeStockAfterRestockVps\(sale\)/);
  assert.match(source, /return syncTikTokStockFromBlingTargetsVps\(stockTargets\)/);
  assert.match(source, /if \(tiktokOrderRestoresMarketplaceInventoryVps\(sale\.status\)\)/);
  const recordSource = source.match(/async function recordMobileTikTokSaleVps\(orderId\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.doesNotMatch(
    recordSource,
    /if \(!sale \|\| \/CANCEL\|UNPAID\|REFUND\|RETURN\/i\.test\(sale\.status\)\) return null/,
  );
}

console.log('TikTok cancellation stock replay checks passed.');
