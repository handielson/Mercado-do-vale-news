import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');

const pdvPage = read('pages/pdv/PDVPage.tsx');
const paymentSection = read('components/pdv/PaymentSection.tsx');
const receiptPreview = read('components/pdv/ReceiptPreview.tsx');
const saleTypes = read('types/sale.ts');
const plan = read('docs/planos/android.md');

const requiredPdvPageSnippets = [
  "import { pdvDisplayService } from '../../services/pdvDisplayService'",
  'PdvPixPayment',
  'pdvPixPayment',
  'setPdvPixPayment',
  'handleCreatePdvPixPayment',
  'handleRefreshPdvPixPayment',
  'handleCancelPdvPixPayment',
  'pdvDisplayService.createPixPayment',
  'pdvDisplayService.refreshPixPaymentStatus',
  'pdvDisplayService.setActivePix',
  'pdvDisplayService.clearActivePix',
  "method: 'pix'",
  'pix_payment_id',
  'mercado_pago_payment_id',
  'pending',
  'approved',
  'toast.error',
  'pixPaymentPending',
  'if (pixPaymentPending)',
  'cashier_key',
  'display_id',
];

for (const snippet of requiredPdvPageSnippets) {
  assert.ok(pdvPage.includes(snippet), `PDVPage.tsx deve conter ${snippet}`);
}

const requiredPaymentSectionSnippets = [
  'pdvPixPayment',
  'onCreatePdvPixPayment',
  'onRefreshPdvPixPayment',
  'onCancelPdvPixPayment',
  'Gerar Pix Mercado Pago',
  'Atualizar pagamento',
  'Cancelar Pix',
  'Exibir no display',
  'qr_code',
  'qr_code_base64',
  'ticket_url',
  'pending',
  'approved',
  'creating',
  'disabled={Boolean(pdvPixPayment',
];

for (const snippet of requiredPaymentSectionSnippets) {
  assert.ok(paymentSection.includes(snippet), `PaymentSection.tsx deve conter ${snippet}`);
}

const requiredReceiptPreviewSnippets = [
  'hasPendingPixPayment',
  'Pix pendente',
  'disabled={!isComplete || isFinalizing || hasPendingPixPayment}',
];

for (const snippet of requiredReceiptPreviewSnippets) {
  assert.ok(receiptPreview.includes(snippet), `ReceiptPreview.tsx deve conter ${snippet}`);
}

const requiredSaleTypeSnippets = [
  'pix_payment_id?: string',
  'mercado_pago_payment_id?: string',
  'pix_status?:',
];

for (const snippet of requiredSaleTypeSnippets) {
  assert.ok(saleTypes.includes(snippet), `types/sale.ts deve conter ${snippet}`);
}

assert.ok(plan.includes('### 2026-06-04 - Bloco Fase 5 PDV Pix Mercado Pago'), 'android.md deve registrar inicio da Fase 5');

console.log('pdv pix payment static checks passed');
