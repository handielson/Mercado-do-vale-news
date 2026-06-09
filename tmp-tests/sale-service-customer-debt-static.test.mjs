import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const saleService = readFileSync('services/saleService.ts', 'utf8');
const pdvPage = readFileSync('pages/pdv/PDVPage.tsx', 'utf8');

assert.match(
  saleService,
  /function\s+getAPrazoPayment/,
  'saleService must isolate the a_prazo payment used to create customer debt',
);

assert.match(
  saleService,
  /\/financial\/customer-debts\/from-sale/,
  'createSale must call the customer debt endpoint for a_prazo sales',
);

assert.match(
  saleService,
  /method\s*===\s*['"]a_prazo['"]/,
  'saleService must detect a_prazo payments',
);

assert.match(
  saleService,
  /valor_total:\s*aPrazoPayment\.amount/,
  'customer debt must use the a_prazo amount in cents',
);

assert.match(
  saleService,
  /data_vencimento:\s*aPrazoPayment\.due_date/,
  'customer debt must preserve the selected due date',
);

assert.match(
  pdvPage,
  /if \(hasAPrazoPayment\) updateFinalizeStep\('debt', 'done'\);/,
  'PDV finalize step must still reflect the debt creation handled by createSale',
);

console.log('sale service customer debt static checks passed');
