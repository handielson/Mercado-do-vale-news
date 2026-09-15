import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const modal = readFileSync('components/admin/sales/SaleDetailsModal.tsx', 'utf8');
const service = readFileSync('services/saleService.ts', 'utf8');

assert.match(modal, /Estornar parte do pagamento/, 'completed sales must offer a separate partial-refund action');
assert.match(modal, /A venda permanecerá cancelada\/concluída e o estoque não será alterado/, 'UI must explain that partial refund keeps sale status and stock');
assert.match(modal, /partialRefundReason\.trim\(\)/, 'partial refund must require a reason');
assert.match(service, /\/sales\/\$\{encodeURIComponent\(id\)\}\/partial-refunds/, 'sale service must use the dedicated partial-refund API');

for (const serverFile of ['vps_server.js', 'vps_server.cjs']) {
  const server = readFileSync(serverFile, 'utf8');
  assert.match(server, /CREATE TABLE IF NOT EXISTS sale_partial_refunds/, `${serverFile} must persist partial refunds separately`);
  assert.match(server, /const saleStatus = String\(sale\.status \|\| ''\)\.trim\(\)\.toLowerCase\(\);[\s\S]*\['completed', 'cancelled', 'canceled'\]\.includes\(saleStatus\)/, `${serverFile} must allow partial refunds on cancelled sales and normalize legacy status values`);
  assert.match(server, /amountCents > paymentTotalCents - alreadyRefundedCents/, `${serverFile} must reject refunds above the payment balance`);
  assert.match(server, /paymentMethod === 'a_prazo'/, `${serverFile} must keep customer debt adjustments in the credit flow`);
  assert.match(server, /paymentMethod === 'pix'[\s\S]*mercadoPagoPaymentId[\s\S]*\/refunds/, `${serverFile} must refund linked Pix through Mercado Pago`);
  assert.match(server, /referenceType: 'sale_partial_refund'/, `${serverFile} must record partial refunds in the current cash session`);
  assert.doesNotMatch(server, /partial-refunds'[\s\S]{0,800}restoreCancelledSaleInventory/, `${serverFile} must not restore stock in a partial refund`);
}

console.log('sale partial refund static checks passed');
