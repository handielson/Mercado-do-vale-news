import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /fastify\.all\('\/api\/shopee-webhook', handleShopeeWebhookVps\)/, `${file} must expose /api/shopee-webhook through Fastify`);
  assert.match(source, /async function handleShopeeWebhookVps/, `${file} must implement Shopee webhook handler`);
  assert.match(source, /Method Not Allowed/, `${file} must reject non-POST Shopee webhook requests`);
  assert.match(source, /payload\.code === 3/, `${file} must handle Shopee order status update code 3`);
  assert.match(source, /ordersn[\s\S]*status[\s\S]*payload\.data/, `${file} must read order sn and status from payload data`);
  assert.match(source, /select=n8n_webhook_url&limit=1/, `${file} must load n8n webhook URL from company_settings`);
  assert.match(source, /source: 'shopee'/, `${file} must relay Shopee source to n8n`);
  assert.match(source, /event: 'order_status_update'/, `${file} must relay Shopee order status event to n8n`);
  assert.match(source, /order_sn: ordersn/, `${file} must relay Shopee order sn to n8n`);
  assert.match(source, /shop_id: shopId/, `${file} must relay Shopee shop id to n8n`);
  assert.match(source, /return reply\.code\(200\)\.send\(\{ message: 'success' \}\)/, `${file} must always acknowledge successful webhook processing with Shopee success message`);
  assert.match(source, /return reply\.code\(200\)\.send\(\{ error: err\.message \}\)/, `${file} must avoid 500 retries on webhook exceptions`);
  assert.match(source, /buildCopyableDebug\('shopee-webhook'/, `${file} must include copyable debug for relay failures`);

  const debugPayloads = source.match(/buildCopyableDebug\('shopee-webhook',\s*(?:\{[\s\S]*?\n\s*\}|[^)]*)\)/g) || [];
  assert.ok(debugPayloads.length > 0, `${file} must include scoped Shopee webhook debug payloads`);
  for (const payload of debugPayloads) {
    assert.doesNotMatch(payload, /\b(authorization|access_token|refresh_token|partner_key|client_secret|payload)\b/i, `${file} must not expose secrets or raw webhook payloads in debug`);
  }
}

console.log('vps Shopee webhook Fastify static checks ok');
