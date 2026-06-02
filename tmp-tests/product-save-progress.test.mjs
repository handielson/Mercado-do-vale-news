import assert from 'node:assert/strict';
import { getProductSaveProgressPercent } from '../components/products/productSaveProgress.js';

assert.equal(getProductSaveProgressPercent(null), 0);
assert.equal(getProductSaveProgressPercent({ current: 0, total: 3 }), 8);
assert.equal(getProductSaveProgressPercent({ current: 1, total: 3 }), 33);
assert.equal(getProductSaveProgressPercent({ current: 3, total: 3 }), 100);
assert.equal(getProductSaveProgressPercent({ current: 5, total: 3 }), 100);
