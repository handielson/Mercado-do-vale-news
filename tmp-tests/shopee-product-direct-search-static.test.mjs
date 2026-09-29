import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../pages/admin/settings/ShopeePage.tsx', import.meta.url), 'utf8');

test('Shopee product search falls back to the VPS catalog when pagination omitted a SKU', () => {
  assert.match(source, /const \[remoteSearchProducts, setRemoteSearchProducts\]/);
  assert.match(source, /search:\s*query/);
  assert.match(source, /status:\s*'all'/);
  assert.match(source, /shopeeProductService\.getByProductIds/);
  assert.match(source, /toShopeeProductFromVpsProduct/);
});

test('direct search remains scoped to the selected Shopee connection', () => {
  assert.match(source, /normalizeShopeeConnectionId\(link\.connection_id\) === selectedConnectionId/);
  assert.match(source, /selectedConnectionId,\s*\n\s*\)/);
});
