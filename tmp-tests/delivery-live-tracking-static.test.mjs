import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/delivery/DeliveryTrackingPage.tsx', 'utf8');
const operation = readFileSync('pages/delivery/DeliveryOperationPage.tsx', 'utf8');
const routes = readFileSync('routes/index.tsx', 'utf8');
const service = readFileSync('services/customerDeliveryService.ts', 'utf8');

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const server = readFileSync(file, 'utf8');
  assert.match(server, /tracking_token VARCHAR\(96\) NULL/);
  assert.match(server, /addUniqueIndexIfMissing\('customer_delivery_jobs', 'uniq_customer_delivery_jobs_tracking_token'/);
  assert.match(server, /fastify\.get\('\/delivery\/tracking\/:token'/);
  assert.match(server, /fastify\.post\('\/delivery\/app\/jobs\/:jobId\/location', \{ preHandler: requireSyncKeyOrCustomer/);
  assert.match(server, /job\.delivery_status !== 'in_route'/);
  assert.match(server, /String\(job\.delivery_person_customer_id\) !== String\(access\.customerId/);
  assert.match(server, /tracking_link: job\.tracking_token/);
  assert.doesNotMatch(server.match(/fastify\.get\('\/delivery\/tracking\/:token'[\s\S]*?\n\}\);/)?.[0] || '', /buyer_phone|buyer_name|receipt_snapshot_json|qr_code/);
}

assert.match(routes, /path: "\/acompanhar-entrega\/:token"/);
assert.match(service, /getPublicDeliveryTracking/);
assert.match(page, /Atualizacao automatica a cada 10 segundos/);
assert.match(page, /maps\.google\.com\/maps\?q=/);
assert.match(operation, /window\.MdvDelivery\?\.startTracking\(updated\.id\)/);
assert.match(operation, /window\.MdvDelivery\?\.stopTracking\(\)/);

console.log('Delivery live tracking static checks passed');
