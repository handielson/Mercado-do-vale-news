import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/vps-telegram-webhook-ping.cjs', 'utf8');

assert.match(source, /TELEGRAM_WEBHOOK_SECRET/, 'script must read webhook secret on VPS');
assert.match(source, /telegram_settings/, 'script must read Telegram settings');
assert.match(source, /chat_id/, 'script must use configured chat_id');
assert.match(source, /\/api\/telegram-webhook/, 'script must call the VPS Telegram webhook');
assert.match(source, /x-telegram-bot-api-secret-token/, 'script must send Telegram secret-token header');
assert.match(source, /"\/ping"/, 'script must simulate /ping command');
assert.match(source, /sanitizeTelegramPingResult/, 'script must sanitize response output');
assert.doesNotMatch(source, /bot_token.*console|console\.log\(.*token|secret_preview|TELEGRAM_WEBHOOK_SECRET.*console|chat_id.*console/i, 'script must not print token, secret, or chat_id');
assert.doesNotMatch(source, /setWebhook|deleteWebhook|crontab\s+-/, 'script must not alter webhook registration or cron');

console.log('vps Telegram webhook ping static checks ok');
