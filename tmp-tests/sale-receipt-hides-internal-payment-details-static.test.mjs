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
  /import\s*\{\s*buildPaymentPresentation\s*\}\s*from\s*['"]\.\/salePresentation['"]/,
  'customer sale receipt must import buildPaymentPresentation before using it at runtime',
);

assert.match(
  receipt,
  /import\s+type\s*\{\s*BenefitStatus\s*\}\s*from\s*['"]\.\.\/services\/benefitService['"]/,
  'customer sale receipt must import BenefitStatus for extra page benefit tags',
);

assert.match(
  receipt,
  /function\s+escapeHtml\(/,
  'customer sale receipt must define escapeHtml before escaping payment labels',
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
