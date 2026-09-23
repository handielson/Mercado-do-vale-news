import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('services/tiktokShopPrintServer.cjs', 'utf8');
const localAgent = fs.readFileSync('scripts/shopee-auto-print.cjs', 'utf8');
const api = fs.readFileSync('vps_server.cjs', 'utf8');

assert.match(server, /invoice_label:\s*'true'/);
assert.match(server, /print-jobs\/order\/:orderId/);
assert.match(server, /status='printed'/);
assert.match(localAgent, /print-jobs\/sync/);
assert.match(localAgent, /print-jobs\/order\//);
assert.match(localAgent, /impressão confirmada pelo sistema/);
assert.match(api, /tiktokFulfillment\.processOrder/);
assert.match(api, /tiktokPrint\.syncOrder/);

console.log('TikTok Shop print flow static test: OK');
