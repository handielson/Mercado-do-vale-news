// Parte 3: telas da devolução de itens.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = f => readFileSync(f, 'utf8');
const modal = read('components/admin/sales/SaleReturnModal.tsx');
const details = read('components/admin/sales/SaleDetailsModal.tsx');
const page = read('pages/admin/sales/SaleReturnsPage.tsx');
const pdf = read('utils/saleReturnReceiptPdf.ts');
const service = read('services/saleReturnService.ts');
const routes = read('routes/index.tsx');
const layout = read('layouts/AdminLayout.tsx');

assert.match(details, /Devolver itens/);
assert.match(details, /<SaleReturnModal/);
assert.match(details, /Devoluções desta venda/);
for (const text of ['Mesma forma em que entrou', 'Outra forma', 'Motivo da devolução', 'Enviar no WhatsApp', 'Imprimir recibo', 'Recibo assinado', 'Comprovante']) assert.match(modal, new RegExp(text), text);
assert.match(modal, /previewSaleReturn\(/);
assert.match(modal, /createSaleReturn\(/);
assert.match(modal, /resolveRefundCashSessionId|getOpenCashSessionId/);
assert.match(pdf, /Declaro que recebi de/);
assert.match(pdf, /Assinatura da cliente/);
assert.match(service, /operation: 'E'/);
assert.match(page, /Devoluções pendentes/);
assert.match(routes, /path: "\/admin\/devolucoes"/);
assert.match(layout, /to: '\/admin\/devolucoes'/);
console.log('sale-return-ui static checks passed');
