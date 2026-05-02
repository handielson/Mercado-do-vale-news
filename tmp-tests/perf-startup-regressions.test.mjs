import fs from 'node:fs';
import assert from 'node:assert/strict';

const shareButton = fs.readFileSync('components/catalog/ShareCatalogButton.tsx', 'utf8');
const useCatalog = fs.readFileSync('hooks/useCatalog.ts', 'utf8');
const paymentFees = fs.readFileSync('services/payment-fees.ts', 'utf8');
const ratingBadge = fs.readFileSync('components/catalog/ProductRatingBadge.tsx', 'utf8');
const cashbackBadge = fs.readFileSync('components/catalog/CashbackBadge.tsx', 'utf8');

assert(
  !/import\s*\{[^}]*generate(?:FullCatalog|Category)PDF[^}]*\}\s*from\s*['"]@\/utils\/catalogPDFGenerator['"]/.test(shareButton),
  'ShareCatalogButton must not statically import catalogPDFGenerator/jsPDF into the public catalog startup bundle',
);

assert(
  /if\s*\(\s*settingsLoading\s*\)\s*\{\s*return;\s*\}/s.test(useCatalog),
  'useCatalog must wait for catalog settings before the first product request to avoid duplicate startup payloads',
);

assert(
  /let\s+feesRequest:\s*Promise<PaymentFee\[\]>\s*\|\s*null\s*=\s*null/.test(paymentFees) &&
    /if\s*\(\s*feesRequest\s*\)\s*\{\s*return\s+feesRequest;\s*\}/s.test(paymentFees),
  'paymentFeesService.list must share one in-flight /payment-fees request across product cards',
);

assert(
  /const\s+scheduleIdle\s*=/.test(ratingBadge) &&
    /const\s+STARTUP_RATING_DELAY_MS\s*=\s*7000/.test(ratingBadge) &&
    /const\s+cancelIdle\s*=\s*scheduleIdle\(fetchRating\)/.test(ratingBadge),
  'ProductRatingBadge must delay and then idle per-card review requests so they are not startup-critical',
);

assert(
  /const\s+STARTUP_CASHBACK_DELAY_MS\s*=\s*7000/.test(cashbackBadge) &&
    /const\s+cancelIdle\s*=\s*scheduleIdle\(loadSettings\)/.test(cashbackBadge),
  'CashbackBadge must delay and then idle cashback_settings so it is not startup-critical',
);

console.log('perf startup regressions passed');
