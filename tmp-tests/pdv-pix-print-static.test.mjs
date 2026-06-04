import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');
const exists = (path) => fs.existsSync(path);

assert.ok(exists('utils/printPixQr.ts'), 'utils/printPixQr.ts deve existir');

const printPixQr = read('utils/printPixQr.ts');
const pdvPage = read('pages/pdv/PDVPage.tsx');
const paymentSection = read('components/pdv/PaymentSection.tsx');
const plan = read('docs/planos/android.md');

const requiredPrintSnippets = [
  'export function printPixQr',
  'PdvPixPrintData',
  'window.open',
  'window.print',
  'QR Code Pix',
  'Pix copia e cola',
  'copyPasteCode',
  'qrCodeBase64',
  'amount',
  'storeName',
  '@page',
  '80mm',
  'api.qrserver.com',
  'encodeURIComponent',
];

for (const snippet of requiredPrintSnippets) {
  assert.ok(printPixQr.includes(snippet), `printPixQr.ts deve conter ${snippet}`);
}

const requiredPdvSnippets = [
  "import { printPixQr } from '../../utils/printPixQr'",
  'buildPdvPixPrintData',
  'handlePrintPdvPixQr',
  'printPixQr(',
  'pdvPixPayment',
  'cartItems',
  'onPrintPdvPixQr={handlePrintPdvPixQr}',
];

for (const snippet of requiredPdvSnippets) {
  assert.ok(pdvPage.includes(snippet), `PDVPage.tsx deve conter ${snippet}`);
}

const requiredPaymentSectionSnippets = [
  'onPrintPdvPixQr',
  'Imprimir QR',
  'disabled={!pdvPixPayment',
];

for (const snippet of requiredPaymentSectionSnippets) {
  assert.ok(paymentSection.includes(snippet), `PaymentSection.tsx deve conter ${snippet}`);
}

assert.ok(plan.includes('### 2026-06-04 - Bloco Fase 6 Impressao Termica Do QR Pix'), 'android.md deve registrar inicio da Fase 6');

console.log('pdv pix print static checks passed');
