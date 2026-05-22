import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/vps-cron-dispatcher-install.cjs', 'utf8');

assert.match(source, /\/var\/www\/mdv-api\/cron\/cron-dispatcher\.sh/, 'installer must manage the VPS cron wrapper path');
assert.match(source, /CRON_SECRET/, 'wrapper must use CRON_SECRET');
assert.match(source, /Authorization: Bearer \\\$\{CRON_SECRET\}/, 'wrapper must send CRON_SECRET as Bearer auth');
assert.match(source, /https:\/\/api\.xiaomipetrolina\.com\.br\/api\/cron-dispatcher/, 'wrapper must call the VPS cron-dispatcher URL');
assert.match(source, /0 22 \* \* \*/, 'installer must preserve Vercel cron schedule');
assert.match(source, /crontab -l/, 'installer must read existing crontab');
assert.match(source, /crontab -/, 'installer must install updated crontab');
assert.match(source, /grep -v '\/api\/cron-dispatcher'/, 'installer must remove legacy cron-dispatcher URL entries');
assert.match(source, /CRON_DISPATCHER_CRON_APPLY === '1'/, 'installer must require explicit apply gate');
assert.match(source, /chmod \+x/, 'installer must make wrapper executable');
assert.match(source, /curl -fsS/, 'wrapper must fail on bad HTTP responses');
assert.doesNotMatch(source, /secret_preview|console\.log\(.*CRON_SECRET|console\.log\(.*secret/i, 'installer must not print secret values');
assert.doesNotMatch(source, /TELEGRAM_WEBHOOK_SECRET|setWebhook|deleteWebhook/, 'installer must not alter Telegram webhook');

console.log('vps cron dispatcher installer static checks ok');
