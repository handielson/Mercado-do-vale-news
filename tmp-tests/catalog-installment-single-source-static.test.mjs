import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const installmentCalculator = readFileSync('services/installmentCalculator.ts', 'utf8');
const publicProductPage = readFileSync('pages/store/PublicProductPage.tsx', 'utf8');
const catalogMessageGenerator = readFileSync('utils/catalogMessageGenerator.ts', 'utf8');
const catalogPdfGenerator = readFileSync('utils/catalogPDFGenerator.ts', 'utf8');

assert.match(
  installmentCalculator,
  /export function calculateInstallmentFromFees/,
  'installmentCalculator must expose the shared payment_fees calculation helper'
);

assert.match(
  installmentCalculator,
  /export function calculatePixPrice/,
  'installmentCalculator must expose the shared PIX discount calculation helper'
);

assert.doesNotMatch(
  publicProductPage,
  /sem juros/,
  'public product page must not label 12x as interest-free'
);

assert.match(
  publicProductPage,
  /calculateInstallmentFromFees\(Math\.round\(displayPrice \* 100\), paymentFees, 12\)/,
  'public product page must calculate 12x from the shared helper'
);

assert.match(
  publicProductPage,
  /pixDiscountPercent/,
  'public product page must calculate a dedicated PIX discount percentage'
);

assert.match(
  publicProductPage,
  /pixPriceCents/,
  'public product page must have a dedicated PIX cash price'
);

assert.match(
  publicProductPage,
  /À vista no PIX/,
  'public product page and share text must label the cash value as PIX'
);

assert.doesNotMatch(
  publicProductPage,
  /desconto direto no PIX/,
  'public product page must show the actual discounted PIX value instead of only a discount badge'
);

for (const [name, source] of [
  ['catalogMessageGenerator', catalogMessageGenerator],
  ['catalogPDFGenerator', catalogPdfGenerator],
]) {
  assert.doesNotMatch(
    source,
    /10x with 16% interest|interestRate = 0\.16|10x de/,
    `${name} must not use the old hardcoded 10x/16% installment rule`
  );
  assert.match(
    source,
    /calculateInstallmentFromFees/,
    `${name} must use the shared installment calculation helper`
  );
  assert.match(
    source,
    /calculatePixPrice/,
    `${name} must use the shared PIX discount calculation helper`
  );
}
