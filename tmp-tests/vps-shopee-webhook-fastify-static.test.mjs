import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');
  const forbidden = ['n', '8', 'n'].join('');
  const handler = source.match(/async function handleShopeeWebhookVps[\s\S]*?[\r\n]}[\r\n]+function generateShopeeShopSignVps/);

  assert.match(source, /fastify\.all\('\/api\/shopee-webhook', handleShopeeWebhookVps\)/, `${file} must expose /api/shopee-webhook through Fastify`);
  assert.match(source, /async function handleShopeeWebhookVps/, `${file} must implement Shopee webhook handler`);
  assert.ok(handler, `${file} must keep Shopee webhook handler scoped before Shopee signing helper`);
  assert.match(source, /Method Not Allowed/, `${file} must reject non-POST Shopee webhook requests`);
  assert.match(source, /return reply\.code\(200\)\.send\(\{ message: 'success' \}\)/, `${file} must always acknowledge successful webhook processing with Shopee success message`);
  assert.match(source, /return reply\.code\(200\)\.send\(\{ error: err\.message \}\)/, `${file} must avoid 500 retries on webhook exceptions`);
  assert.match(source, /buildCopyableDebug\('shopee-webhook'/, `${file} must include copyable debug for relay failures`);
  assert.doesNotMatch(source.toLowerCase(), new RegExp(forbidden), `${file} must not relay Shopee webhooks to removed automation tooling`);
  assert.doesNotMatch(handler[0], /select=.*webhook_url|order_status_update|order_sn:|shop_id: shopId/, `${file} must not keep removed external automation relay payloads`);

  const debugPayloads = source.match(/buildCopyableDebug\('shopee-webhook',\s*(?:\{[\s\S]*?\n\s*\}|[^)]*)\)/g) || [];
  assert.ok(debugPayloads.length > 0, `${file} must include scoped Shopee webhook debug payloads`);
  for (const payload of debugPayloads) {
    assert.doesNotMatch(payload, /\b(authorization|access_token|refresh_token|partner_key|client_secret|payload)\b/i, `${file} must not expose secrets or raw webhook payloads in debug`);
  }
}

console.log('vps Shopee webhook Fastify static checks ok');
