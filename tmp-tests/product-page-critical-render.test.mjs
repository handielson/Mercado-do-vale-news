import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../pages/store/PublicProductPage.tsx', import.meta.url), 'utf8');

const setProductIndex = source.indexOf('setProduct(formattedProduct as unknown as CatalogProduct)');
const releaseLoadingIndex = source.indexOf('setLoading(false)', setProductIndex);
const siblingFetchIndex = source.indexOf('// -- Siblings', setProductIndex);
const relatedFetchIndex = source.indexOf('// -- Relacionados', setProductIndex);
const crossSellFetchIndex = source.indexOf('// -- Cross-sells', setProductIndex);

assert.notEqual(setProductIndex, -1, 'product page should set the critical product');
assert.notEqual(releaseLoadingIndex, -1, 'product page should release loading after setting the product');
assert.notEqual(siblingFetchIndex, -1, 'product page should still load sibling variants');
assert.ok(
  releaseLoadingIndex < siblingFetchIndex &&
    releaseLoadingIndex < relatedFetchIndex &&
    releaseLoadingIndex < crossSellFetchIndex,
  'critical product render must be released before non-critical product enrichments',
);

console.log('product page critical render gate ok');
