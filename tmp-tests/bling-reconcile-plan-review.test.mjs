import assert from 'node:assert/strict';
import { buildReview, renderMarkdown } from '../tools/review-bling-reconcile-plan.mjs';

const plan = {
  planned: { stockChanges: 2, nameChanges: 2 },
  details: {
    stockChanges: [
      { sku: 'ABC', previousStock: 2, nextStock: 0 },
      { sku: 'XYZ', previousStock: 1, nextStock: 4 },
    ],
    nameChanges: [
      { sku: 'SAFE', previousName: 'Produto', nextName: 'Produto, Azul' },
      { sku: 'RISK', previousName: 'Produto A', nextName: 'Outro Produto' },
    ],
  },
};

const review = buildReview(plan, 'details.json', 'abc123');

assert.equal(review.summary.stockChanges, 2);
assert.equal(review.summary.stockIncreases, 1);
assert.equal(review.summary.stockDecreases, 1);
assert.equal(review.summary.stockZeroing, 1);
assert.equal(review.summary.stockTotalDelta, 1);
assert.equal(review.summary.stockMaxAbsDelta, 3);
assert.equal(review.summary.nameChanges, 2);
assert.equal(review.summary.safeNameChanges, 1);
assert.equal(review.summary.unsafeNameChanges, 1);
assert.deepEqual(review.riskFlags, ['stock_zeroing_present', 'name_changes_not_limited_to_color_suffix']);
assert.deepEqual(review.samples.stockZeroing, ['ABC']);
assert.deepEqual(review.samples.unsafeRenames, ['RISK']);

const markdown = renderMarkdown(review);
assert.match(markdown, /CONFIRM_BLING_RECONCILE_SOURCE_SHA256=abc123/);
assert.match(markdown, /CONFIRM_BLING_RECONCILE_ZEROING_SKUS=ABC/);
assert.match(markdown, /CONFIRM_BLING_RECONCILE_UNSAFE_RENAME_SKUS=RISK/);

console.log('bling reconcile plan review ok');
