import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const helper = readFileSync('utils/paymentFeeCalculations.ts', 'utf8');
const calculator = readFileSync('components/pdv/InstallmentCalculator.tsx', 'utf8');
const paymentSection = readFileSync('components/pdv/PaymentSection.tsx', 'utf8');
const pdvPage = readFileSync('pages/pdv/PDVPage.tsx', 'utf8');

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
assert.match(
  paymentSection,
  /onSelectInstallment\?:\s*\(\s*installments:\s*number,\s*amount:\s*number,\s*feeAmount:\s*number,\s*operatorFeeAmount:\s*number,\s*operatorFeePercentage:\s*number,\s*appliedFeePercentage:\s*number\s*\)\s*=>\s*void/,
  'PaymentSection must keep operator fee values in the installment callback contract'
);
assert.match(
  pdvPage,
  /const handleSelectInstallment = \(\s*installments:\s*number,\s*amount:\s*number,\s*feeAmount:\s*number,\s*operatorFeeAmount:\s*number,\s*operatorFeePercentage:\s*number,\s*appliedFeePercentage:\s*number\s*\)/,
  'PDVPage must receive operator fee values when adding a credit installment payment'
);
assert.match(
  pdvPage,
  /operator_fee_amount:\s*operatorFeeAmount/,
  'PDV credit payment must persist the operator machine fee amount'
);
assert.match(
  pdvPage,
  /operator_fee_percentage:\s*operatorFeePercentage/,
  'PDV credit payment must persist the operator machine fee percentage'
);
assert.match(
  pdvPage,
  /fee_percentage:\s*appliedFeePercentage/,
  'PDV credit payment must persist the applied fee percentage from the selected plan'
);

console.log('payment fee credit selection static checks ok');
