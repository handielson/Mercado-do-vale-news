import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const profile = readFileSync('components/customer/profile/PurchaseHistoryTab.tsx', 'utf8');
const coinsTab = readFileSync('components/customer/profile/CoinsTab.tsx', 'utf8');
const customerCoins = readFileSync('services/customerCoinService.ts', 'utf8');
const pdv = readFileSync('pages/pdv/PDVPage.tsx', 'utf8');

for (const serverFile of ['vps_server.js', 'vps_server.cjs']) {
  const server = readFileSync(serverFile, 'utf8');
  assert.match(server, /fastify\.get\('\/customer\/coins'[\s\S]*?getVpsBearerAuthContext\(req\)/);
  assert.match(server, /WHERE customer_id = \? ORDER BY created_at DESC LIMIT 100/);
  assert.match(server, /SELECT id, slug, images, image_url, stock_quantity FROM products WHERE id IN \(\?\)/);
  assert.match(server, /product_image_url: product\?\.image_url \|\| null/);
  assert.match(server, /coins_earned: Number\(coinsBySaleId\.get\(String\(sale\.id\)\) \|\| 0\)/);
  assert.match(server, /SELECT \* FROM sales WHERE id = \? LIMIT 1 FOR UPDATE/);
  assert.match(server, /type = 'earn_purchase' AND status <> 'cancelled'/);
  assert.match(server, /ON DUPLICATE KEY UPDATE[\s\S]*balance = balance \+ VALUES\(balance\)/);
  assert.match(server, /ensurePurchaseCoinsForSaleVps\(saleId, \{ apply: true \}\)/);
  assert.match(server, /fastify\.post\('\/admin\/cashback\/reconcile-sales'/);

  const coreMatch = server.match(/\/\/ PURCHASE_CASHBACK_CORE_START([\s\S]*?)\/\/ PURCHASE_CASHBACK_CORE_END/);
  assert.ok(coreMatch, 'cashback core block must remain extractable');
  const context = {};
  vm.runInNewContext(`${coreMatch[1]}; this.saleMoneyScaleForCashback = saleMoneyScaleForCashback;`, context);
  assert.equal(context.saleMoneyScaleForCashback({ total: 114000 }, [{ unit_price: 127566 }]), 1);
  assert.equal(context.saleMoneyScaleForCashback({ total: 1140 }, [{ unit_price: 1275.66 }]), 100);
}

assert.match(customerCoins, /'\/customer\/coins'/);
assert.match(coinsTab, /getCustomerCoinSnapshot\(\)/);
assert.doesNotMatch(coinsTab, /getCoinBalance\(|getCoinTransactions\(|getCashbackSettings\(/);
assert.match(profile, /item\.product_image_url/);
assert.match(profile, /toBrowserSafeMediaUrl\(item\.product_image_url\)/);
assert.match(profile, /item\.product_slug \|\| item\.product_id/);
assert.match(profile, /Crédito automático desta compra/);
assert.doesNotMatch(pdv, /earnCoinsForPurchase/);

console.log('customer purchase image and automatic coin safeguards passed');
