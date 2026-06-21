import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const tab = readFileSync('components/customer/profile/DeliveryWorkerTab.tsx', 'utf8');
const service = readFileSync('services/customerDeliveryService.ts', 'utf8');
const servers = ['vps_server.js', 'vps_server.cjs'].map((file) => [file, readFileSync(file, 'utf8')]);

assert.match(tab, /const\s+\[paymentMethod,\s*setPaymentMethod\]/, 'delivery payment form must keep payment method state');
assert.match(tab, /Forma de pagamento/, 'delivery payment form and statement must expose payment method text');
assert.match(tab, /registerCustomerDeliveryPayment\(customer\.id,\s*\{[\s\S]*payment_method:\s*paymentMethod/, 'delivery payment submission must send payment method to API');
assert.match(tab, /deliveryStatementEntries/, 'DeliveryWorkerTab must build a unified bank-statement style list');
assert.match(tab, /Extrato do entregador/, 'DeliveryWorkerTab must render a delivery worker statement section');
assert.match(tab, /Saldo/, 'DeliveryWorkerTab statement must show running balance information');
assert.match(tab, /type:\s*'credit'/, 'DeliveryWorkerTab statement must include delivery earnings as credit entries');
assert.match(tab, /type:\s*'debit'/, 'DeliveryWorkerTab statement must include admin payments and offsets as debit entries');
assert.match(tab, /Pagamento admin|Pagamento do admin/, 'DeliveryWorkerTab statement must label admin payment entries');
assert.match(tab, /new Date\(.*\)\.toLocaleString\('pt-BR'/, 'DeliveryWorkerTab statement must show date and hour');
assert.match(tab, /Pedido \{entry\.orderNumber\}/, 'DeliveryWorkerTab statement must show order number for delivery credits');
assert.match(tab, /Cliente: \{entry\.customerName/, 'DeliveryWorkerTab statement must show customer name for delivery credits');

assert.match(service, /payment_method\?:\s*string/, 'customer delivery settlement type must expose payment_method');
assert.match(service, /input:\s*\{ amount: number; description: string; paid_at\?: string; payment_method\?: string \}/, 'registerCustomerDeliveryPayment must accept payment_method');

for (const [file, server] of servers) {
  assert.match(server, /payment_method VARCHAR\(40\) NULL/, `${file} must create customer_delivery_settlements.payment_method`);
  assert.match(server, /addColumnIfMissing\('customer_delivery_settlements', 'payment_method'/, `${file} must migrate existing settlement tables with payment_method`);
  assert.match(server, /const\s+paymentMethod\s*=\s*String\(req\.body\?\.payment_method/, `${file} delivery payment route must read payment_method`);
  assert.match(server, /INSERT INTO customer_delivery_settlements\s*\([^)]*payment_method[\s\S]*VALUES\s*\([^)]*\?\)/, `${file} delivery payment inserts must persist payment_method`);
  assert.match(server, /payment_method:\s*paymentMethod/, `${file} delivery payment response must include payment_method`);
}

console.log('delivery worker bank statement static checks passed');
