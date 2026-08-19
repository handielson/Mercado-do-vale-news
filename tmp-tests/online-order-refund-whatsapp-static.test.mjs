import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const servers = ['vps_server.cjs', 'vps_server.js'].map((file) => [file, readFileSync(file, 'utf8')]);
const service = readFileSync('services/orderService.ts', 'utf8');
const page = readFileSync('pages/admin/orders/OnlineOrdersPage.tsx', 'utf8');
const templates = readFileSync('services/whatsappAutomationTemplateService.ts', 'utf8');
const types = readFileSync('types/order.ts', 'utf8');

for (const [file, source] of servers) {
  assert.match(source, /fastify\.post\('\/orders\/:orderId\/payments\/mercado-pago\/refund'[\s\S]*?requireSyncKeyOrAdmin/, `${file}: refund must require admin authentication`);
  assert.match(source, /String\(order\.status \|\| ''\) !== 'cancelled'/, `${file}: refund must require prior cancellation`);
  assert.match(source, /String\(order\.payment_status \|\| ''\) !== 'paid'/, `${file}: refund must require a paid order`);
  assert.match(source, /gateway_name = 'mercado_pago' AND is_active = 1 AND company_id = \? LIMIT 1/, `${file}: refund must use the order company credential`);
  assert.match(source, /\/v1\/payments\/\$\{encodeURIComponent\(paymentId\)\}\/refunds/, `${file}: refund must call the Mercado Pago payment refund endpoint`);
  assert.match(source, /'X-Idempotency-Key': `order-refund-/, `${file}: refund must be idempotent`);
  assert.match(source, /body: '\{\}'/, `${file}: full refund must omit an amount`);
  assert.match(source, /externalReference && externalReference !== String\(order\.id\)/, `${file}: refund must verify payment ownership`);
  assert.match(source, /SET payment_status = 'refunded'/, `${file}: successful refund must persist the financial status`);
  assert.match(source, /fastify\.post\('\/orders\/:orderId\/status-notification'[\s\S]*?requireSyncKeyOrAdmin/, `${file}: status notification must require admin authentication`);
  assert.match(source, /notifyOnlineOrderStatusWhatsAppVps/, `${file}: status changes must reuse the WhatsApp automation channel`);
  assert.match(source, /templateKey: 'order_status_updated'/, `${file}: status message must use the editable template`);
}

assert.match(service, /export async function refundOrderPayment[\s\S]*?\/payments\/mercado-pago\/refund/, 'order service must expose the refund action');
assert.match(service, /export async function notifyOrderStatusWhatsApp[\s\S]*?\/status-notification/, 'order service must expose status notification');
assert.match(page, /order\.status === 'cancelled'[\s\S]*?order\.payment_status === 'paid'[\s\S]*?Estornar pagamento/, 'refund button must only appear for cancelled paid orders');
assert.match(page, /window\.confirm\([\s\S]*?nao podera ser desfeito/, 'refund must require explicit operator confirmation');
assert.match(page, /await notifyOrderStatusWhatsApp\(orderId\)/, 'status changes must notify the customer');
assert.match(page, /payment_status: 'refunded'/, 'successful refund must update the card state');
assert.match(templates, /template_key: 'order_status_updated'[\s\S]*?link_pedido/, 'template center must expose the order status template');
assert.match(types, /OrderRefundResult/, 'refund response must have a typed contract');

console.log('online order refund and WhatsApp static checks passed');
