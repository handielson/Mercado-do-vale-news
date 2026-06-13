import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const receipt = readFileSync('utils/printSaleReceipt.ts', 'utf8');

assert.doesNotMatch(
  receipt,
  /paymentView\.details/,
  'customer sale receipt must not render internal payment details such as machine cost or fee percentages',
);

assert.doesNotMatch(
  receipt,
  /details\.map\(escapeHtml\)/,
  'customer sale receipt must not map internal payment detail lines into the HTML',
);

assert.match(
  receipt,
  /paymentLabel\(p\.method,\s*p\.installments\)|labelWithInstallments/,
  'customer sale receipt should still show the public payment method label',
);

console.log('sale receipt internal payment detail checks passed');
