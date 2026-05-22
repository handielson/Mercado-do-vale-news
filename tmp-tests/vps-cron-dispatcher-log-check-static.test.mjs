import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/vps-cron-dispatcher-log-check.cjs', 'utf8');

assert.match(source, /\/var\/log\/mdv-cron-dispatcher\.log/, 'checker must inspect the cron dispatcher log');
assert.match(source, /tail -n 80/, 'checker should only read a bounded log tail');
assert.match(source, /crontab -l/, 'checker should verify the installed cron entry');
assert.doesNotMatch(source, /crontab "\$tmp"|crontab\s+"\$tmp"|crontab\s+\$tmp|chmod \+x|mkdir -p/, 'checker must not install or alter cron files');
assert.doesNotMatch(source, /\/var\/www\/mdv-api\/\.env/, 'checker must not print or read the VPS .env file');
assert.match(source, /Bearer \[REDACTED\]/, 'checker must redact bearer tokens');
assert.match(source, /CRON_SECRET/, 'checker must include CRON_SECRET redaction');
assert.match(source, /lastLines\.slice\(-20\)/, 'checker should print only a small final tail');

console.log('vps-cron-dispatcher-log-check-static ok');
