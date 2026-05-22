import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /fastify\.all\('\/api\/cron-dispatcher',\s*handleCronDispatcherVps\)/, `${file} must expose /api/cron-dispatcher through Fastify`);
  assert.match(source, /async function handleCronDispatcherVps/, `${file} must implement the cron dispatcher handler`);
  assert.match(source, /function isAuthorizedCronDispatcherRequestVps/, `${file} must guard cron dispatcher execution`);
  assert.match(source, /process\.env\.CRON_SECRET/, `${file} must use CRON_SECRET for cron dispatcher auth`);
  assert.match(source, /telegram_settings/, `${file} must load Telegram settings`);
  assert.match(source, /settings\.active/, `${file} must respect inactive Telegram settings`);
  assert.match(source, /settings\.bot_token/, `${file} must require bot_token`);
  assert.match(source, /settings\.chat_id/, `${file} must require chat_id`);
  assert.match(source, /forceTemplateId/, `${file} must support forced template dispatch`);
  assert.match(source, /America\/Sao_Paulo/, `${file} must schedule using Brazil timezone`);
  assert.match(source, /company_settings/, `${file} must load company variables`);
  assert.match(source, /sales/, `${file} must load daily sales variables`);
  assert.match(source, /products/, `${file} must load stock variables`);
  assert.match(source, /instagram_schedule/, `${file} must support Instagram agenda variables/reminders`);
  assert.match(source, /system_tags/, `${file} must support custom system tags`);
  assert.match(source, /resolveCronDispatcherTagInlineVps/, `${file} must resolve custom inline tags`);
  assert.match(source, /https:\/\/api\.telegram\.org\/bot\$\{settings\.bot_token\}\/sendMessage/, `${file} must send messages through Telegram`);

  const debugPayloads = source.match(/buildCopyableDebug\('cron-dispatcher',\s*(?:\{[\s\S]*?\n\s*\}|[^)]*)\)/g) || [];
  for (const payload of debugPayloads) {
    assert.doesNotMatch(payload, /\b(bot_token|access_token|refresh_token|authorization|client_secret|service_role)\b/i, `${file} must not expose secrets in cron dispatcher debug payloads`);
  }
}

console.log('vps cron dispatcher Fastify static checks ok');
