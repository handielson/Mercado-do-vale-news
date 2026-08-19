import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const between = (text, start, end) => text.slice(text.indexOf(start), text.indexOf(end, text.indexOf(start)));

const apiModule = read('services/customerSelfServiceServer.cjs');
const orderService = read('services/orderService.ts');
const createOrder = between(orderService, 'export async function createOrder', 'export async function getOrderById');
const checkinService = read('services/checkinService.ts');
const reviews = read('services/reviews.ts');
const benefits = read('services/benefitService.ts');
const typeUpgrade = read('services/typeUpgradeRequests.ts');
const feedback = read('services/feedbackService.ts');
const upload = read('services/uploadService.ts');
const quoteModal = read('components/catalog/QuoteModal.tsx');
const deploy = read('deploy-vps-server-only.cjs');
const migration = read('migrations/015_customer_self_service_permissions_mysql.sql');

for (const serverPath of ['vps_server.cjs', 'vps_server.js']) {
  const server = read(serverPath);
  assert.match(server, /registerCustomerSelfServiceRoutes\(fastify,/);
  assert.match(server, /ensureCustomerSelfServiceTables\(pool\)/);
  assert.ok(server.includes('mercado-pago\\/(?:card|pix|preference)'));
  assert.match(server, /fastify\.post\('\/orders\/:orderId\/payments\/mercado-pago\/pix'/);
  assert.match(server, /fastify\.post\('\/orders\/:orderId\/payments\/mercado-pago\/preference'/);
  assert.match(server, /markOnlineOrderPaymentFailed/);
  assert.match(server, /fastify\.post\('\/synology\/upload', \{ preHandler: requireSyncKeyOrCustomer \}/);
  assert.match(server, /public\\\/products\\\/\[\^\/\]\+\\\/reviews/);
  assert.match(server, /Avatar filename does not match authenticated customer/);
}

assert.match(apiModule, /fastify\.post\('\/customer\/checkin'/);
assert.match(apiModule, /CREATE TABLE IF NOT EXISTS customer_type_requests/);
assert.match(apiModule, /CREATE TABLE IF NOT EXISTS benefit_redemptions/);
assert.match(apiModule, /CREATE TABLE IF NOT EXISTS customer_feedbacks/);
assert.match(apiModule, /beginTransaction\(\)/);
assert.match(apiModule, /WHERE customer_id = \?/);
assert.match(apiModule, /fastify\.post\('\/customer\/reviews'/);
assert.match(apiModule, /status\) VALUES \(\?, \?, \?, \?, \?, 'pending'\)/);
assert.match(apiModule, /fastify\.post\('\/customer\/type-upgrade'/);
assert.match(apiModule, /fastify\.post\('\/public\/feedback'/);
assert.match(apiModule, /fastify\.post\('\/customer\/orders\/:orderId\/pending-coins'/);
assert.match(apiModule, /SELECT \* FROM orders WHERE id = \? LIMIT 1 FOR UPDATE/);
assert.match(apiModule, /String\(order\.customer_id\).*String\(access\.customerId/);

assert.match(createOrder, /\/payments\/mercado-pago\/pix/);
assert.match(createOrder, /\/payments\/mercado-pago\/preference/);
assert.match(createOrder, /\/pending-coins/);
assert.doesNotMatch(createOrder, /paymentIntegrationService|mercadoPagoProvider/);
assert.doesNotMatch(createOrder, /patchOrder\(order\.id, \{ status: 'payment_failed'/);

assert.match(checkinService, /\/customer\/checkin/);
assert.doesNotMatch(checkinService, /table-data\/checkin_logs/);
assert.match(reviews, /\/customer\/reviews/);
assert.match(reviews, /\/public\/products\/\$\{encodeURIComponent\(productId\)\}\/reviews/);
assert.match(benefits, /\/customer\/benefits\?customer_id=/);
assert.match(typeUpgrade, /\/customer\/type-upgrade/);
assert.match(feedback, /\/public\/feedback/);
assert.match(upload, /synology\/upload\?folder=imagens&scope=avatar/);
assert.doesNotMatch(between(upload, 'uploadAvatar:', 'deleteBannerImage:'), /getVpsSyncHeaders/);
assert.match(quoteModal, /getPublicCheckoutIntegrations\(\)/);
assert.match(deploy, /customerSelfServiceServer\.cjs/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS customer_type_requests/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS benefit_redemptions/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS customer_feedbacks/);

console.log('customer self-service permission boundaries: ok');
