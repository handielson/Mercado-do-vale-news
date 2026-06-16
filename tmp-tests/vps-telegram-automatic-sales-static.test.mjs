import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /CREATE TABLE IF NOT EXISTS telegram_notification_log/, `${file} must create a Telegram notification log for dedupe`);
  assert.match(source, /async function notifyTelegramOnlineOrderPaidVps/, `${file} must implement server-side paid online order notifications`);
  assert.match(source, /async function notifyTelegramPdvSaleVps/, `${file} must implement server-side PDV sale notifications`);
  assert.match(source, /online_order_paid_template/, `${file} must use the configured paid online order template`);
  assert.match(source, /sale_template/, `${file} must use the configured PDV sale template`);
  assert.match(source, /order_items[\s\S]*order_id = \?/, `${file} must load order_items for paid order notifications`);
  assert.match(source, /sale_items[\s\S]*sale_id = \?/, `${file} must load sale_items for PDV sale notifications`);
  assert.match(source, /await notifyTelegramOnlineOrderPaidVps\(order\.id/, `${file} Mercado Pago webhook must notify Telegram after payment confirmation`);
  assert.match(source, /if \(name === 'sale_items'\)[\s\S]*notifyTelegramPdvSaleVps/, `${file} sale_items bulk insert must notify Telegram after PDV sale items are persisted`);
  assert.match(source, /telegram_notification_log[\s\S]*event_key/, `${file} must dedupe Telegram notifications by event_key`);

  const debugPayloads = source.match(/buildCopyableDebug\('(?:telegram-sales|mercadopago-webhook)',\s*(?:\{[\s\S]*?\n\s*\}|[^)]*)\)/g) || [];
  for (const payload of debugPayloads) {
    assert.doesNotMatch(payload, /\b(bot_token|access_token|refresh_token|authorization|client_secret|service_role)\b/i, `${file} must not expose secrets in Telegram sales debug payloads`);
  }
}

console.log('vps Telegram automatic sales static checks ok');
