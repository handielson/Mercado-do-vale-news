import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tmp-tests/n8n-enable-message-edit-webhook.cjs', 'utf8');
assert.match(source, /MESSAGES_UPDATE/);
assert.match(source, /\/webhook\/set\//);
assert.match(source, /\/webhook\/find\//);
assert.match(source, /requiredEvents\.every/);
assert.doesNotMatch(source, /docker service scale|docker service update|pm2 restart/, 'webhook setup must not restart production services');
console.log('n8n message edit webhook static checks passed');
