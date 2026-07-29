import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeSale } = require('../services/mobileSalesPushService.cjs');

const normalized = normalizeSale({
  channel: 'PDV',
  external_id: 'sale-1',
  status: 'completed',
  customer_name: 'Cliente',
  total_cents: 1490.4,
  occurred_at: '2026-07-28T12:00:00.000Z',
  details: { items: [{ name: 'Produto', quantity: 1 }] },
});
assert.equal(normalized.channel, 'pdv');
assert.equal(normalized.external_id, 'sale-1');
assert.equal(normalized.total_cents, 1490);
assert.equal(normalized.details.items[0].name, 'Produto');
assert.throws(() => normalizeSale({ channel: 'outro', external_id: '1' }));

const server = fs.readFileSync(new URL('../vps_server.js', import.meta.url), 'utf8');
const mirror = fs.readFileSync(new URL('../vps_server.cjs', import.meta.url), 'utf8');
assert.equal(server, mirror, 'vps_server.js e vps_server.cjs devem permanecer espelhados');
for (const contract of [
  "fastify.post('/admin/mobile-push/devices'",
  "fastify.delete('/admin/mobile-push/devices'",
  "fastify.get('/admin/mobile-sales'",
  "fastify.get('/admin/mobile-sales/:channel/:saleId'",
  "fastify.all('/api/tiktok-shop/webhook'",
  "fastify.put('/api/tiktok-shop/webhooks/order-status'",
  'recordMobileOnlineSaleVps(order.id)',
  'recordMobilePdvSaleVps(saleId)',
]) {
  assert.ok(server.includes(contract), `Contrato ausente: ${contract}`);
}

const service = fs.readFileSync(
  new URL('../services/mobileSalesPushService.cjs', import.meta.url),
  'utf8',
);
assert.match(service, /FIREBASE_SERVICE_ACCOUNT_(?:JSON|BASE64|PATH)/);
assert.match(service, /sendEachForMulticast/);
assert.match(service, /UNIQUE KEY uniq_mobile_sale_event/);
assert.match(service, /UNIQUE KEY uniq_mobile_push_token/);
assert.match(server, /event_type:\s*'ORDER_STATUS_CHANGE'/);
assert.match(server, /pathname:\s*'\/event\/202309\/webhooks'/);
assert.match(server, /COALESCE\(s\.finalization_status, 'success'\) = 'success'/);
assert.doesNotMatch(
  server.match(/async function loadMobilePdvSalesVps[\s\S]*?async function loadMobileOnlineSalesVps/)?.[0] || '',
  /s\.status/,
);
assert.match(
  server.match(/async function loadMobileOnlineSalesVps[\s\S]*?function normalizeMobileShopeeOrderVps/)?.[0] || '',
  /WHERE 1 = 1/,
  'a lista Online deve incluir pendentes e canceladas para os filtros do aplicativo',
);
assert.match(server, /payment_details:\s*mobileSalesPaymentDetailsVps/);
assert.match(server, /total_with_fee_cents/);
assert.match(server, /operator_fee_amount_cents/);
const shopeeLoader = server.match(
  /async function loadMobileShopeeSalesVps[\s\S]*?function normalizeMobileTikTokOrderVps/,
)?.[0] || '';
assert.match(shopeeLoader, /14 \* 24 \* 60 \* 60/);
assert.match(shopeeLoader, /listed\?\.data\?\.response/);
assert.match(shopeeLoader, /detail\?\.data\?\.response\?\.order_list/);
assert.match(shopeeLoader, /response\.more && response\.next_cursor/);
assert.doesNotMatch(shopeeLoader, /30 \* 24 \* 60 \* 60/);

const deploy = fs.readFileSync(
  new URL('../deploy-vps-server-only.cjs', import.meta.url),
  'utf8',
);
assert.match(deploy, /uploadMobileSalesPushFiles/);
assert.match(deploy, /ensureRemoteFirebaseCredentials/);
assert.match(deploy, /npm install firebase-admin@13\.10\.0 --omit=dev/);
assert.match(deploy, /chmod 600/);

console.log('mobile-sales-push-static: ok');
