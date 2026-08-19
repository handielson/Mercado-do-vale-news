import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const service = read('services/orderService.ts');
const templates = read('services/whatsappAutomationTemplateService.ts');

assert.match(
  service,
  /await vpsClient\.post\(`\/orders\/\$\{encodeURIComponent\(order\.id\)\}\/purchase-notification`, \{\}\)/,
  'checkout must request the purchase notification after completing the order',
);
assert.match(
  service,
  /purchase-notification[\s\S]*?catch \(notificationError\)/,
  'a WhatsApp failure must not roll back an otherwise completed order',
);
assert.match(templates, /template_key: 'online_order_created'/, 'template center must expose the purchase message');
assert.match(templates, /'itens'[\s\S]*?'situacao_pagamento'[\s\S]*?'frete'[\s\S]*?'endereco_entrega'/, 'template must expose purchase details');

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const source = read(file);
  assert.match(source, /async function notifyOnlineOrderCreatedWhatsAppVps\(orderId\)/, `${file}: purchase notifier is required`);
  assert.match(source, /FROM order_items WHERE order_id = \?/, `${file}: notifier must load the actual order items`);
  assert.match(source, /LEFT JOIN customers c ON c\.id = o\.customer_id/, `${file}: notifier must fall back to the registered customer phone`);
  assert.match(source, /phone: order\.customer_phone \|\| order\.registered_customer_phone/, `${file}: order phone must take precedence over profile phone`);
  assert.match(source, /templateKey: 'online_order_created'/, `${file}: notifier must use the dedicated editable template`);
  assert.match(source, /template_key = 'online_order_created'[\s\S]*?status = 'sent'/, `${file}: notifier must suppress an already-sent message`);
  assert.match(source, /subtotal: formatAutomationMoney\(order\.subtotal/, `${file}: message must include subtotal`);
  assert.match(source, /frete: formatAutomationMoney\(order\.shipping_cost/, `${file}: message must include freight`);
  assert.match(source, /endereco_entrega: deliveryAddress/, `${file}: message must include delivery details`);
  assert.match(source, /situacao_pagamento: ONLINE_ORDER_PAYMENT_STATUS_LABELS_VPS/, `${file}: message must include current payment status`);
  assert.match(source, /fastify\.post\('\/orders\/:orderId\/purchase-notification', \{ preHandler: requireSyncKeyOrCustomer \}/, `${file}: endpoint must accept authenticated customers`);
  assert.match(source, /purchase-notification\$\/u\.test\(pathname\)[\s\S]*?assertVpsProxyOrdersBelongToCustomer/, `${file}: proxy must enforce order ownership`);
}

console.log('online order purchase WhatsApp static checks passed');
