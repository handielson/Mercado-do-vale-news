import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('services/tiktokShopPrintServer.cjs', 'utf8');
const localAgent = fs.readFileSync('scripts/shopee-auto-print.cjs', 'utf8');
const api = fs.readFileSync('vps_server.cjs', 'utf8');
const page = fs.readFileSync('pages/admin/settings/TikTokShopPage.tsx', 'utf8');
const service = fs.readFileSync('services/tiktokShopService.ts', 'utf8');

assert.match(server, /invoice_label:\s*'true'/);
assert.match(server, /print-jobs\/order\/:orderId/);
assert.match(server, /print-jobs\/order\/:orderId', \{ preHandler: requireSyncKeyOrAdmin \}/);
assert.match(server, /status='printed'/);
assert.match(localAgent, /print-jobs\/sync/);
assert.match(localAgent, /print-jobs\/order\//);
assert.match(localAgent, /impressão confirmada pelo sistema/);
assert.match(api, /tiktokFulfillment\.processOrder/);
assert.match(api, /tiktokPrint\.syncOrder/);
assert.doesNotMatch(page, /127\.0\.0\.1:8081\/print-tiktok-order/);
assert.match(page, /getPrintJobs\(orderId\)/);
assert.match(page, /status === 'intervention'/);
assert.match(server, /fastify\.post\('\/tiktok-shop\/print-jobs\/sync'/);
assert.match(server, /fastify\.get\('\/tiktok-shop\/print-jobs\/order\/:orderId'/);
assert.match(api, /fastify\.post\('\/tiktok-shop\/orders\/:orderId\/fulfill'/);
assert.match(service, /vpsClient\.post\('\/tiktok-shop\/print-jobs\/sync'/);
assert.doesNotMatch(service, /vpsClient\.(?:get|post)\(`?\/api\/tiktok-shop\/print-jobs/);

console.log('TikTok Shop print flow static test: OK');
