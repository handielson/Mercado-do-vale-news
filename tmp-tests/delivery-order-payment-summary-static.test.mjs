import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync(new URL('../pages/delivery/DeliveryOperationPage.tsx', import.meta.url), 'utf8');
const service = fs.readFileSync(new URL('../services/customerDeliveryService.ts', import.meta.url), 'utf8');

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const server = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  assert.match(server, /payment_method: sale\.payment_method \|\| null/, `${file} must preserve the legacy payment method in the delivery snapshot`);
  assert.match(server, /payment_status: sale\.payment_status \|\| null/, `${file} must preserve the sale payment status in the delivery snapshot`);
}

assert.match(page, /Valor do pedido/);
assert.match(page, /Forma de pagamento/);
assert.match(page, /buildPaymentPresentation\(payment\)/);
assert.match(page, /Forma de pagamento nao informada/);
assert.match(service, /payment_methods\?: PaymentMethod\[\] \| string \| null/);

console.log('delivery order payment summary static test passed');
