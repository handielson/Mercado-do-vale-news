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
    /supabaseRestSelect\('payment_integrations'/,
    `${file} must load the Mercado Pago integration from Supabase`,
  );

  assert.match(
    source,
    /supabaseRestPatch\('orders'/,
    `${file} must update the matching order through Supabase REST`,
  );

  assert.match(
    source,
    /buildCopyableDebug\('mercadopago-webhook'/,
    `${file} must return copyable debug details on webhook failures`,
  );
}

console.log('mercadopago webhook Fastify static checks ok');
