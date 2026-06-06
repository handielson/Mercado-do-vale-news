import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readBotWhatsappDoc } from '../tools/autoresponder-bot-doc.cjs';

const root = process.cwd();
const serverPath = path.join(root, 'vps_server.cjs');

const server = fs.readFileSync(serverPath, 'utf8');
const bot = readBotWhatsappDoc(root);

for (const token of [
  'const AUTORESPONDER_STORE_STATUS_CACHE_TTL_MS = 60 * 1000',
  'let autoresponderStoreStatusCache = null',
  'async function getCachedAutoresponderStoreStatus',
  'function clearAutoresponderStoreStatusCache',
  'expiresAt',
  'Date.now()',
  "SELECT business_hours, holiday_overrides, local_holidays FROM company_settings LIMIT 1",
]) {
  assert.ok(server.includes(token), `vps_server.cjs should include ${token}`);
}

const cacheFunctionStart = server.indexOf('async function getCachedAutoresponderStoreStatus');
assert.ok(cacheFunctionStart >= 0, 'cache function should exist');
const cacheFunction = server.slice(cacheFunctionStart, server.indexOf('async function getAutoresponderReplyCount', cacheFunctionStart));
assert.ok(cacheFunction.includes('autoresponderStoreStatusCache'), 'cache function should use cache object');
assert.ok(cacheFunction.includes('pool.query'), 'cache function should query company_settings on cache miss');
assert.ok(cacheFunction.includes('getAutoresponderStoreStatus(companyRows[0] || null)'), 'cache function should reuse existing status parser');

const storeStatusRouteStart = server.indexOf("fastify.get('/autoresponder/store-status'");
assert.ok(storeStatusRouteStart >= 0, 'store status route should exist');
const storeStatusRoute = server.slice(storeStatusRouteStart, server.indexOf('async function buildAutoresponderTestReply', storeStatusRouteStart));
assert.ok(storeStatusRoute.includes('getCachedAutoresponderStoreStatus()'), 'store status route should use cached helper');
assert.ok(!storeStatusRoute.includes('pool.query'), 'store status route should not query company_settings directly');

const humanRequestStart = server.indexOf('if (detectedIntent.humanRequest)');
assert.ok(humanRequestStart >= 0, 'human request branch should exist');
const humanRequestBranch = server.slice(humanRequestStart, server.indexOf('const matchedRule = await findAutoresponderRuleMatch', humanRequestStart));
assert.ok(humanRequestBranch.includes('getCachedAutoresponderStoreStatus()'), 'human request branch should use cached helper');
assert.ok(!humanRequestBranch.includes('company_settings LIMIT 1'), 'human request branch should not query company_settings directly');

const companySettingsPatchStart = server.indexOf("fastify.patch('/company-settings'");
assert.ok(companySettingsPatchStart >= 0, 'company settings patch route should exist');
const companySettingsPatch = server.slice(companySettingsPatchStart, server.indexOf("fastify.post('/company-settings", companySettingsPatchStart));
assert.ok(companySettingsPatch.includes('clearAutoresponderStoreStatusCache()'), 'company settings patch should clear store status cache');

assert.ok(bot.includes('- [x] Implementar `getCachedStoreStatus()` com cache em memória de 60s'), 'Bot_Whatsapp.md should mark getCachedStoreStatus as done');
assert.ok(bot.includes('Fase 1O local'), 'Bot_Whatsapp.md should document Fase 1O');

console.log('autoresponder store status cache static checks passed');
