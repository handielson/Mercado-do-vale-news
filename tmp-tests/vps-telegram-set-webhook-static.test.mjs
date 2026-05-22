import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/vps-telegram-set-webhook.cjs', 'utf8');

assert.match(source, /TELEGRAM_WEBHOOK_SECRET/, 'script must read TELEGRAM_WEBHOOK_SECRET on VPS');
assert.match(source, /telegram_settings/, 'script must read Telegram settings from Supabase');
assert.match(source, /getWebhookInfo/, 'script must inspect current Telegram webhook before changing it');
assert.match(source, /setWebhook/, 'script must set the Telegram webhook');
assert.match(source, /secret_token/, 'script must register Telegram secret_token');
assert.match(source, /https:\/\/api\.xiaomipetrolina\.com\.br\/api\/telegram-webhook/, 'script must point Telegram to VPS webhook URL');
assert.match(source, /allowed_updates/, 'script must restrict allowed update types');
assert.match(source, /sanitizeTelegramWebhookInfo/, 'script must sanitize Telegram output');
assert.doesNotMatch(source, /bot_token.*console|console\.log\(.*token|secret_preview|TELEGRAM_WEBHOOK_SECRET.*console/i, 'script must not print token or secret');
assert.doesNotMatch(source, /deleteWebhook/, 'script must not delete Telegram webhook');
assert.doesNotMatch(source, /crontab\s+-|cron-dispatcher/, 'script must not alter cron jobs');

console.log('vps Telegram setWebhook static checks ok');
