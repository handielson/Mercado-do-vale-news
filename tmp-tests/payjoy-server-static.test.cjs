const assert = require('node:assert/strict');
const fs = require('node:fs');

const server = fs.readFileSync('vps_server.cjs', 'utf8');
assert.match(server, /payjoy_analysis_url: \(v\) => normalizePayJoyAnalysisUrl\(v\)/);
assert.match(server, /url\.protocol !== 'https:' \|\| !\/\(\^\|\\\.\)payjoy\\\.com\$\/i\.test\(url\.hostname\)/);
assert.match(server, /fastify\.get\('\/n8n-bot\/payjoy\/config', \{ preHandler: requireSyncKey \}/);
assert.match(server, /fastify\.post\('\/n8n-bot\/payjoy\/followups\/schedule', \{ preHandler: requireSyncKey \}/);
assert.match(server, /const delayMinutes = kind === 'analysis_check' \? 30 : 15 \* 24 \* 60/);
assert.match(server, /retry_check: 'Oi! Passando para saber se você gostaria de verificar se já é possível/);
assert.match(server, /followup_kind IN \('analysis_check','retry_check'\)/);
assert.match(server, /human_handoff_active/);
assert.match(server, /jobs\.followup_kind='phone_catalog' OR later\.direction='inbound'/);
assert.match(server, /isAutoresponderStoreInHumanHours\(await getCachedAutoresponderStoreStatus\(\)\)/);
assert.match(server, /store_maps_url: storeAddress \?/);
console.log('PayJoy server contract checks passed');
