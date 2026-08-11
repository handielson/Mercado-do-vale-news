import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync(new URL('../vps_server.cjs', import.meta.url), 'utf8');
const serverJs = fs.readFileSync(new URL('../vps_server.js', import.meta.url), 'utf8');
const push = fs.readFileSync(new URL('../services/mobileSalesPushService.cjs', import.meta.url), 'utf8');
const admin = fs.readFileSync(new URL('../layouts/AdminLayout.tsx', import.meta.url), 'utf8');
const android = fs.readFileSync(new URL('../android/admin-estoque/app/src/main/java/br/com/mercadodovale/adminestoque/push/SalesMessagingService.kt', import.meta.url), 'utf8');
const watchdog = fs.readFileSync(new URL('../ops/evolution-watchdog.sh', import.meta.url), 'utf8');
const timer = fs.readFileSync(new URL('../ops/systemd/mdv-evolution-watchdog.timer', import.meta.url), 'utf8');

assert.equal(server, serverJs, 'vps_server.js and .cjs must stay identical');
assert.match(server, /N8N_FAILURE_THRESHOLD[\s\S]*consecutiveFailures[\s\S]*sendOperationalAlert/);
assert.match(server, /fastify\.get\('\/admin\/bot-health'/);
assert.match(server, /startN8nBotHealthMonitorVps\(\)/);
assert.match(push, /OPERATIONAL_CHANNELS[\s\S]*'n8n'/);
assert.match(push, /operational_alert: 'true'/, 'installed app versions must receive the operational push');
assert.match(admin, /botHealth\?\.status === 'offline'[\s\S]*Bot do WhatsApp fora do ar/);
assert.match(android, /operational_alert[\s\S]*isOperationalAlert/);
assert.match(watchdog, /container="evolution_api"/);
assert.match(watchdog, /\[uncaughtException\][\s\S]*TypeError: terminated[\s\S]*UND_ERR_SOCKET\|other side closed/);
assert.match(watchdog, /flock -n/);
assert.match(timer, /OnUnitActiveSec=60s/);
console.log('n8n health monitor static checks passed');
