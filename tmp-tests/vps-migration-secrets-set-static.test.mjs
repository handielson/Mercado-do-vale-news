import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/vps-migration-secrets-set.cjs', 'utf8');

assert.match(source, /CRON_SECRET/, 'script must manage CRON_SECRET');
assert.match(source, /TELEGRAM_WEBHOOK_SECRET/, 'script must manage TELEGRAM_WEBHOOK_SECRET');
assert.match(source, /crypto\.randomBytes\(32\)\.toString\('hex'\)/, 'script must generate strong random secrets');
assert.match(source, /\/var\/www\/mdv-api\/\.env/, 'script must target the VPS API env file');
assert.match(source, /\/var\/www\/mdv-api\/\.codex-backups\/\.env\.\$\{stamp\}\.bak/, 'script must back up remote env before writing');
assert.match(source, /pm2 restart mdv-api --update-env/, 'script must restart PM2 with updated env');
assert.match(source, /preserveExistingSecret/, 'script must preserve existing secrets by default');
assert.match(source, /secret_chars/, 'script may report only secret lengths');
assert.doesNotMatch(source, /secret_preview|slice\(0|slice\(-|console\.log\(.*secret/i, 'script must not print secret previews or values');
assert.doesNotMatch(source, /setWebhook|deleteWebhook/, 'script must not alter Telegram webhook registration');
assert.doesNotMatch(source, /crontab\s+-|cron-dispatcher/, 'script must not activate cron jobs');

console.log('vps migration secrets setter static checks ok');
