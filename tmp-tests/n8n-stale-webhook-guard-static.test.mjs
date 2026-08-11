import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./n8n-apply-stale-webhook-guard.cjs', import.meta.url), 'utf8');
assert.match(source, /staleWebhookReplayGuardV226/);
assert.match(source, /eventNameV226 === 'messages\.upsert'/);
assert.match(source, /eventAgeMsV226 > 20 \* 60 \* 1000/);
assert.match(source, /if \(isStaleReplayV226\) return \[\];/);
assert.match(source, /workflow_entity[\s\S]*workflow_history/);
assert.match(source, /status='canceled'/);
assert.match(source, /16:21:00\+00/, 'incident cleanup must stay bounded and never cancel future executions');
console.log('n8n stale webhook replay guard static checks passed');
