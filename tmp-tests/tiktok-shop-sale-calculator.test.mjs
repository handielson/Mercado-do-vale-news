import assert from 'node:assert/strict';
import { calculateTikTokShopSaleCost } from '../utils/tiktokShopSaleCalculator.js';

const result = calculateTikTokShopSaleCost({
  salePriceCents: 20000,
  productCostCents: 10000,
  commissionPct: 8,
  transactionFeePct: 2,
  taxPct: 4,
  adsPct: 1,
  fixedFeeCents: 200,
  shippingCostCents: 1500,
  shippingSubsidyCents: 500,
  packagingCostCents: 300,
  targetMarginPct: 20,
});

assert.equal(result.ratePct, 15);
assert.equal(result.variableFeesCents, 3000);
assert.equal(result.effectiveShippingCents, 1000);
assert.equal(result.totalCostCents, 14500);
assert.equal(result.netProfitCents, 5500);
assert.equal(result.marginPct, 27.5);
assert.equal(result.breakEvenPriceCents, 13530);
assert.equal(result.suggestedPriceCents, 17693);

const impossible = calculateTikTokShopSaleCost({
  productCostCents: 1000,
  commissionPct: 70,
  targetMarginPct: 40,
});
assert.equal(impossible.suggestedPriceCents, null);

console.log('TikTok Shop sale calculator checks ok');
