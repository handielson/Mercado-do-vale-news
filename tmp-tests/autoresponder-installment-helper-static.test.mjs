import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('vps_server.cjs', 'utf8');

assert.match(
  source,
  /async function calculateAutoresponderMaxInstallment\(priceCents, maxInstallments = 12\)/,
  'expected an async helper to calculate max installments',
);

assert.match(
  source,
  /FROM payment_fees/,
  'expected installment helper to read payment_fees',
);

assert.match(
  source,
  /installments BETWEEN 2 AND \?/,
  'expected helper to ignore cash/pix row and cap installments',
);

assert.match(
  source,
  /applied_fee_pct/,
  'expected helper to use applied fee percent',
);

assert.match(
  source,
  /Math\.round\(priceCents \* \(1 \+ appliedFeePct \/ 100\)\)/,
  'expected helper to apply payment fee before splitting installments',
);

assert.match(
  source,
  /function formatAutoresponderInstallmentLine\(plan\)/,
  'expected a formatter for the installment line',
);

assert.match(
  source,
  /Parcelamento:/,
  'expected product replies to include a parcelamento label',
);

assert.match(
  source,
  /async function formatAutoresponderProductCaption\(product, group = null\)/,
  'expected product caption to await installment data',
);

assert.match(
  source,
  /await calculateAutoresponderMaxInstallment/,
  'expected product caption to use the installment helper',
);

assert.match(
  source,
  /formatAutoresponderProductCardLine\(group, firstNumber \+ index\)/,
  'expected product search replies to await async catalog card formatting',
);

assert.match(
  source,
  /await formatAutoresponderProductSearchReply/,
  'expected webhook branches to await async product replies',
);

console.log('autoresponder installment helper static checks passed');
