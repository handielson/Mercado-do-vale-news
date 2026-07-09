import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');

const pdvPage = read('pages/pdv/PDVPage.tsx');
const paymentSection = read('components/pdv/PaymentSection.tsx');
const receiptPreview = read('components/pdv/ReceiptPreview.tsx');
const saleTypes = read('types/sale.ts');
const saleCalculations = read('utils/saleCalculations.ts');
const plan = read('docs/planos/android.md');
const vpsServer = read('vps_server.js');

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
  'PDV_PIX_STATUS_POLLING_MS',
  'pollPdvPixStatus',
  'handleApprovedPdvPixPayment',
  'pdvDisplayService.setActivePix',
  'pdvDisplayService.clearActivePix',
  'pdvDisplayService.listDisplays',
  'setPdvPixDisplays',
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
  'cashierDisplayOptions',
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
  'pdvPixDisplays',
  '<select',
  'Selecione um display',
  'value={display.id}',
  'data:image/png;base64,',
  'alt="QR Code Pix"',
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
  'pix_paid_at?: string',
];

for (const snippet of requiredSaleTypeSnippets) {
  assert.ok(saleTypes.includes(snippet), `types/sale.ts deve conter ${snippet}`);
}

assert.ok(plan.includes('### 2026-06-04 - Bloco Fase 5 PDV Pix Mercado Pago'), 'android.md deve registrar inicio da Fase 5');

assert.doesNotMatch(
  paymentSection,
  /<input[\s\S]{0,400}placeholder="opcional"/,
  'PaymentSection.tsx nao deve permitir digitar Display ID livremente'
);
assert.match(
  saleCalculations,
  /a_prazo:\s*['"]A Prazo['"]/,
  'utils/saleCalculations.ts deve exibir a_prazo como A Prazo'
);
assert.match(
  paymentSection,
  /pdvPixPayment\.status !== ['"]approved['"]/,
  'PaymentSection.tsx deve ocultar QR/copia-e-cola quando o Pix for aprovado'
);
assert.match(
  pdvPage,
  /pix_paid_at:\s*payment\.approved_at\s*\|\|\s*payment\.updated_at\s*\|\|\s*new Date\(\)\.toISOString\(\)/,
  'PDVPage.tsx deve guardar approved_at como hora da aprovacao do Pix Mercado Pago no pagamento da venda'
);

assert.match(
  pdvPage,
  /window\.setInterval\(pollPdvPixStatus, PDV_PIX_STATUS_POLLING_MS\)/,
  'PDVPage.tsx deve monitorar automaticamente o status do Pix pendente'
);
assert.match(
  pdvPage,
  /description:\s*`Venda PDV Mercado do Vale - Pedido \$\{customerReference\}`/,
  'PDVPage.tsx deve enviar a referencia do pedido na descricao do Pix PDV'
);
assert.match(
  vpsServer,
  /const pdvOrderReference = String\(body\.sale_draft_id \|\| localReference\.replace\([^)]*\) \|\| id\)/,
  'vps_server.js deve resolver o numero/referencia do pedido PDV antes de montar o payload Mercado Pago'
);
assert.match(
  vpsServer,
  /description:\s*`Venda PDV Mercado do Vale - Pedido \$\{pdvOrderReference\}`\.slice\(0,\s*120\)/,
  'vps_server.js deve exibir o numero/referencia do pedido na descricao da venda do Mercado Pago'
);
assert.match(
  vpsServer,
  /first_name:\s*'Cliente'[\s\S]*last_name:\s*'Balcão'/,
  'vps_server.js deve enviar Cliente Balcão como pagador do Pix PDV'
);

console.log('pdv pix payment static checks passed');
