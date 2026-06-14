import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const receipt = readFileSync('utils/printSaleReceipt.ts', 'utf8');

assert.doesNotMatch(
  receipt,
  /paymentView\.details/,
  'customer sale receipt must not render internal payment details such as machine cost or fee percentages',
);

assert.match(
  receipt,
  /paymentView\.labelWithInstallments/,
  'customer sale receipt should still show the public payment method label',
);

assert.match(
  receipt,
  /paymentView\.totalWithFee/,
  'customer sale receipt should still show the amount paid for each payment method',
);

assert.match(
  receipt,
  /paymentView\.installments[\s\S]*paymentView\.installmentValue[\s\S]*paymentView\.totalWithFee/,
  'customer sale receipt must show public installment detail like 10x de R$ 97,40 = R$ 974,00',
);

assert.match(
  receipt,
  /\$\{paymentView\.installments\}x de \$\{fmt\(paymentView\.installmentValue\)\} = \$\{fmt\(paymentView\.totalWithFee\)\}/,
  'customer sale receipt installment detail must include installments, installment amount and charged total',
);

console.log('sale receipt internal payment detail checks passed');
