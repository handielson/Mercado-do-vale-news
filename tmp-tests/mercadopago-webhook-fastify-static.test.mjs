import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(
    source,
    /fastify\.post\('\/api\/mercadopago-webhook'/,
    `${file} must expose /api/mercadopago-webhook on Fastify`,
  );

  assert.match(
    source,
    /function\s+isMercadoPagoWebhookPayload\(/,
    `${file} must detect Mercado Pago payment webhook payloads explicitly`,
  );

  assert.match(
    source,
    /async function\s+handleMercadoPagoWebhookVps\(/,
    `${file} must handle Mercado Pago webhook inside the VPS server`,
  );

  assert.match(
    source,
    /https:\/\/api\.mercadopago\.com\/v1\/payments\/\$\{encodeURIComponent\(paymentId\)\}/,
    `${file} must verify the real payment with Mercado Pago before updating orders`,
  );

  assert.match(
    source,
    /SELECT access_token, is_active FROM payment_integrations/,
    `${file} must load the Mercado Pago integration from the VPS database`,
  );

  assert.match(
    source,
    /SELECT \* FROM orders WHERE gateway_payment_id = \?[\s\S]*?SELECT \* FROM orders WHERE id = \?/,
    `${file} must recover an order by external_reference when the initial gateway id write failed`,
  );

  assert.match(
    source,
    /SET gateway_payment_id = \?, payment_gateway = 'mercado_pago'[\s\S]*?status = \?, payment_status = 'paid'/,
    `${file} must persist both the gateway id and valid operational/financial statuses`,
  );

  assert.match(
    source,
    /nextOrderStatus = finalStatuses\.includes[\s\S]*?\? order\.status : 'confirmed'/,
    `${file} must use confirmed instead of the invalid paid order status`,
  );

  assert.match(
    source,
    /processOrderReservation\(order\.id, 'consume',[\s\S]*?webhook do Mercado Pago/,
    `${file} must consume the stock reservation idempotently after approval`,
  );

  assert.match(
    source,
    /buildCopyableDebug\('mercadopago-webhook'/,
    `${file} must return copyable debug details on webhook failures`,
  );
}

console.log('mercadopago webhook Fastify static checks ok');
