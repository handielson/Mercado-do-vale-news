import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const helper = readFileSync('utils/paymentFeeCalculations.ts', 'utf8');
const calculator = readFileSync('components/pdv/InstallmentCalculator.tsx', 'utf8');
const paymentSection = readFileSync('components/pdv/PaymentSection.tsx', 'utf8');

assert.match(
  helper,
  /export function getBestCreditFeeByInstallment/,
  'payment fee helper must expose credit fee selection'
);
assert.match(
  helper,
  /scorePaymentFeeForCredit[\s\S]*applied_fee[\s\S]*operator_fee/,
  'credit fee selection must prioritize non-zero applied/operator fees over legacy zero rows'
);
assert.match(
  helper,
  /channel === 'presencial'/,
  'credit fee selection must include legacy presencial rows with null payment_method'
);
assert.match(
  calculator,
  /getCreditInstallmentOptions/,
  'InstallmentCalculator must use the shared credit installment helper'
);
assert.doesNotMatch(
  calculator,
  /arr\.findIndex\(f => f\.installments === fee\.installments\)/,
  'InstallmentCalculator must not keep the first duplicate 1x fee row'
);
assert.match(
  paymentSection,
  /getBestCreditFeeByInstallment\(paymentFees,\s*12\)/,
  'PaymentSection 12x preview must use the same credit fee selector'
);

console.log('payment fee credit selection static checks ok');
