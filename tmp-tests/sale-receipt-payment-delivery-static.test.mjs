import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const receipt = readFileSync('utils/printSaleReceipt.ts', 'utf8');

assert.match(
  receipt,
  /paymentView\.labelWithInstallments/,
  'customer receipt must render payment as a public description, not as internal fee details'
);

assert.doesNotMatch(
  receipt,
  /<td[^>]*>\$\{fmt\(paymentTotal\(p\)\)\}<\/td>/,
  'customer receipt payment section must not repeat the payment total in a right column'
);

assert.match(
  receipt,
  /deliveryReceiptHtml/,
  'customer receipt must include a dedicated delivery or pickup section'
);

assert.match(
  receipt,
  /Retirada na Loja/,
  'customer receipt must be able to show store pickup'
);

assert.match(
  receipt,
  /Custo da entrega/,
  'customer receipt must show the customer-facing delivery cost'
);

console.log('sale receipt payment and delivery static checks passed');
