import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /fastify\.all\('\/api\/bling-webhook', handleBlingWebhookVps\)/, `${file} must expose the dedicated Bling webhook route`);
  assert.match(source, /resource === 'webhook'/, `${file} must preserve legacy /api/bling?resource=webhook compatibility`);
  assert.match(source, /resource === 'webhook-logs'/, `${file} must migrate webhook-logs diagnostics`);
  assert.match(source, /accepts: 'POST'/, `${file} must answer GET webhook health checks`);
  assert.match(source, /safeInsertBlingWebhookLogVps/, `${file} must persist webhook_logs safely`);
  assert.match(source, /source: source[\s\S]*payload: storedPayload[\s\S]*received_at/, `${file} must store route source, payload and received_at in webhook_logs`);

  assert.match(source, /isMercadoPagoWebhookPayload\(request\.body\)/, `${file} must keep Mercado Pago payload dispatch compatibility`);
  assert.match(source, /handleMercadoPagoWebhookVps\(request\.body\)/, `${file} must reuse existing Mercado Pago webhook core`);

  assert.match(source, /event\.includes\('stock'\)[\s\S]*event\.includes\('estoque'\)[\s\S]*event\.includes\('movimentacao'\)/, `${file} must handle stock webhook events`);
  assert.match(source, /fetchBlingStockForWebhookVps/, `${file} must fetch Bling stock when a token is available`);
  assert.match(source, /payload_api_fallback/, `${file} must keep non-zero payload fallback when Bling stock fetch fails`);
  assert.match(source, /refusing to zero stock incorrectly/, `${file} must avoid zeroing stock when API fails and payload is zero or absent`);
  assert.match(source, /patchVpsJsonForWebhookVps\(\s*request,\s*'\/products\/stock'/, `${file} must update VPS stock endpoint`);
  assert.match(source, /vpsDbPatch\('products'[\s\S]*stock_quantity/, `${file} must update local product stock as legacy did`);

  assert.match(source, /event\.includes\('product'\)[\s\S]*event\.includes\('produto'\)/, `${file} must handle product webhook events`);
  assert.match(source, /fetchBlingProductDetailForWebhookVps/, `${file} must fetch product detail when payload lacks sku or name`);
  assert.match(source, /price_retail = Math\.round\(Number\(preco\) \* 100\)/, `${file} must convert Bling price to cents`);
  assert.match(source, /buildBlingPriceStockPayloadVps/, `${file} must fan out product price-stock payloads`);
  assert.match(source, /patchVpsJsonForWebhookVps\(\s*request,\s*'\/products\/prices-stock'/, `${file} must update VPS prices-stock endpoint`);
  assert.match(source, /patchVpsJsonForWebhookVps\(\s*request,\s*'\/products\/name'/, `${file} must update VPS name endpoint`);

  assert.match(source, /select=id, source, payload, received_at&order=received_at.desc&limit=20/, `${file} must expose last webhook logs`);
  assert.match(source, /webhook\|webhook-logs/, `${file} must list migrated webhook resources`);

  const debugPayloads = source.match(/buildCopyableDebug\('bling-webhook',\s*(?:\{[\s\S]*?\n\s*\}|[^)]*)\)/g) || [];
  assert.ok(debugPayloads.length > 0, `${file} must include scoped Bling webhook debug payloads`);
  for (const payload of debugPayloads) {
    assert.doesNotMatch(payload, /\b(authorization|access_token|refresh_token|client_secret|body|payload)\b/i, `${file} must not expose secrets or raw webhook bodies in debug payloads`);
  }
}

console.log('vps Bling webhook Fastify static checks ok');
