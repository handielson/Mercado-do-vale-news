import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /fastify\.all\('\/api\/telegram-webhook',\s*handleTelegramWebhookVps\)/, `${file} must expose /api/telegram-webhook through Fastify`);
  assert.match(source, /async function handleTelegramWebhookVps/, `${file} must implement Telegram webhook handler`);
  assert.match(source, /function isAuthorizedTelegramWebhookRequestVps/, `${file} must support webhook secret validation`);
  assert.match(source, /TELEGRAM_WEBHOOK_SECRET/, `${file} must read TELEGRAM_WEBHOOK_SECRET`);
  assert.match(source, /telegram_settings/, `${file} must load Telegram settings`);
  assert.match(source, /settings\.active/, `${file} must respect inactive Telegram settings`);
  assert.match(source, /settings\.bot_token/, `${file} must require bot_token`);
  assert.match(source, /https:\/\/api\.telegram\.org\/bot\$\{token\}\/sendMessage/, `${file} must send Telegram replies`);

  for (const command of ['/ping', '/ajuda', '/start', '/help', '/menu', '/vendas', '/relatorio', '/top10', '/estoque', '/preco', '/pedidos', '/clientes', '/modelo', '/categoria']) {
    assert.ok(source.includes(command), `${file} must support ${command}`);
  }

  for (const table of ['sales', 'sale_items', 'products', 'orders', 'customers', 'categories', 'models']) {
    assert.ok(source.includes(`'${table}'`) || source.includes(`"${table}"`), `${file} must query ${table}`);
  }

  assert.match(source, /message = update\?\.message \|\| update\?\.edited_message/, `${file} must accept edited_message updates`);
  assert.match(source, /command = parts\[0\]\.toLowerCase\(\)\.replace\(\/@\\w\+\/g, ''\)/, `${file} must strip bot mentions from commands`);
  assert.match(source, /Digite \/ajuda/, `${file} must reply to unknown commands`);
  assert.match(source, /funciona apenas com comandos/, `${file} must reply to free text`);

  const debugPayloads = source.match(/buildCopyableDebug\('telegram-webhook',\s*(?:\{[\s\S]*?\n\s*\}|[^)]*)\)/g) || [];
  for (const payload of debugPayloads) {
    assert.doesNotMatch(payload, /\b(bot_token|access_token|refresh_token|authorization|client_secret|service_role)\b/i, `${file} must not expose secrets in Telegram webhook debug payloads`);
  }
}

console.log('vps Telegram webhook Fastify static checks ok');
