import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('services/adminMarketplaceSalesService.ts', 'utf8');
const modal = readFileSync('components/admin/sales/MarketplaceSaleDetailsModal.tsx', 'utf8');
const receipt = readFileSync('utils/printMarketplaceSaleReceipt.ts', 'utf8');
const server = readFileSync('vps_server.cjs', 'utf8');

assert.match(service, /PROCESSED:\s*'Pedido processado'/);
assert.match(service, /PAID:\s*'Pago'/, 'Mercado Livre paid status must be translated');
assert.match(service, /PAYMENT_IN_PROCESS:\s*'Pagamento em processamento'/, 'Mercado Livre payment status must be translated');
assert.match(service, /PARTIALLY_REFUNDED:\s*'Reembolsado parcialmente'/, 'Mercado Livre refund status must be translated');
assert.match(service, /getMarketplaceSaleDetail/);
assert.match(service, /connection_id/);
assert.match(modal, /Situação no marketplace/);
assert.match(modal, /Imprimir comprovante/);
assert.match(modal, /SaleItemInventoryInfo/);
assert.match(modal, /sm:grid-cols-\[minmax\(0,1\.4fr\)_minmax\(0,1fr\)_auto\]/, 'marketplace summary must constrain all three columns');
assert.match(modal, /break-words font-medium text-slate-800 \[overflow-wrap:anywhere\]">\{sale\.customer_name\}/, 'long marketplace customer names must wrap inside their own column');
assert.match(modal, /whitespace-nowrap font-bold text-slate-900/, 'marketplace total must remain readable on one line');
assert.match(receipt, /receipt_width/);
assert.match(receipt, /window\.print/);
assert.match(server, /loadMobileShopeeSalesVps\(1, saleId, connectionId\)/);
console.log('marketplace sale details static checks passed');
