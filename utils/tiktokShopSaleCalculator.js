function asFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asNonNegativeCents(value) {
  return Math.max(0, Math.round(asFiniteNumber(value)));
}

function asRate(value) {
  return Math.min(100, Math.max(0, asFiniteNumber(value)));
}

function roundRate(value) {
  return Math.round(value * 10000) / 10000;
}

export function calculateTikTokShopSaleCost(input = {}) {
  const salePriceCents = asNonNegativeCents(input.salePriceCents);
  const productCostCents = asNonNegativeCents(input.productCostCents);
  const fixedFeeCents = asNonNegativeCents(input.fixedFeeCents);
  const shippingCostCents = asNonNegativeCents(input.shippingCostCents);
  const packagingCostCents = asNonNegativeCents(input.packagingCostCents);
  const shippingSubsidyCents = asNonNegativeCents(input.shippingSubsidyCents);
  const targetMarginPct = Math.min(95, asRate(input.targetMarginPct));
  const ratePct =
    asRate(input.commissionPct) +
    asRate(input.transactionFeePct) +
    asRate(input.taxPct) +
    asRate(input.adsPct);
  const variableFeesCents = Math.round(salePriceCents * (ratePct / 100));
  const effectiveShippingCents = Math.max(0, shippingCostCents - shippingSubsidyCents);
  const totalCostCents =
    productCostCents +
    fixedFeeCents +
    effectiveShippingCents +
    packagingCostCents +
    variableFeesCents;
  const netProfitCents = salePriceCents - totalCostCents;
  const marginPct = salePriceCents > 0 ? roundRate((netProfitCents / salePriceCents) * 100) : 0;
  const markupPct = productCostCents > 0 ? roundRate((netProfitCents / productCostCents) * 100) : 0;
  const fixedBaseCents =
    productCostCents +
    fixedFeeCents +
    effectiveShippingCents +
    packagingCostCents;
  const breakEvenDivisor = 1 - ratePct / 100;
  const targetDivisor = 1 - ratePct / 100 - targetMarginPct / 100;

  return {
    salePriceCents,
    productCostCents,
    ratePct,
    variableFeesCents,
    effectiveShippingCents,
    totalCostCents,
    netProfitCents,
    marginPct,
    markupPct,
    breakEvenPriceCents:
      breakEvenDivisor > 0 ? Math.ceil(fixedBaseCents / breakEvenDivisor) : null,
    suggestedPriceCents:
      targetDivisor > 0 ? Math.ceil(fixedBaseCents / targetDivisor) : null,
  };
}
