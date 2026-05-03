import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildDerivativePlan,
  classifyImageAsset,
  collectImageAssets,
  summarizeAssets,
} from '../tools/audit-image-assets.mjs';

const product = classifyImageAsset('uploads/products/SKU/img-1.png', 817000);
assert.equal(product.kind, 'product');
assert.equal(product.shouldOptimize, true);
assert.equal(product.extension, '.png');

const productPlan = buildDerivativePlan(product);
assert.deepEqual(
  productPlan.map((item) => `${item.format}:${item.width}`),
  ['webp:320', 'webp:480', 'webp:800', 'avif:320', 'avif:480', 'avif:800'],
);
assert.deepEqual(productPlan.map((item) => item.outputPath), [
  'uploads/products/SKU/img-1-320.webp',
  'uploads/products/SKU/img-1-480.webp',
  'uploads/products/SKU/img-1-800.webp',
  'uploads/products/SKU/img-1-320.avif',
  'uploads/products/SKU/img-1-480.avif',
  'uploads/products/SKU/img-1-800.avif',
]);

const banner = classifyImageAsset('uploads/banners/1774302661895.png', 651500);
assert.equal(banner.kind, 'banner');
assert.deepEqual(
  buildDerivativePlan(banner).map((item) => `${item.format}:${item.width}`),
  ['webp:768', 'webp:1280', 'avif:768', 'avif:1280'],
);

const alreadyWebp = classifyImageAsset('uploads/products/SKU/img-1.webp', 42000);
assert.equal(alreadyWebp.shouldOptimize, true);
assert.match(buildDerivativePlan(alreadyWebp)[0].outputPath, /img-1-320\.webp$/);

const alreadyAvif = classifyImageAsset('uploads/products/SKU/img-1.avif', 32000);
assert.equal(alreadyAvif.shouldOptimize, true);
assert.match(buildDerivativePlan(alreadyAvif)[0].outputPath, /img-1-320\.webp$/);

const generatedDerivative = classifyImageAsset('uploads/products/SKU/img-1-320.webp', 22000);
assert.equal(generatedDerivative.shouldOptimize, false);
assert.deepEqual(buildDerivativePlan(generatedDerivative), []);

const legacyExternal = classifyImageAsset('uploads/legacy/external/external/e3771d34b703c814.png', 447796);
assert.equal(legacyExternal.kind, 'product');
assert.equal(legacyExternal.shouldOptimize, true);

const summary = summarizeAssets([product, banner, alreadyWebp, alreadyAvif, generatedDerivative, legacyExternal]);
assert.equal(summary.totalImages, 6);
assert.equal(summary.optimizableImages, 5);
assert.equal(summary.byKind.product.count, 5);
assert.equal(summary.byKind.banner.count, 1);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mdv-image-audit-'));
const tempProductDir = path.join(tempRoot, 'products', 'SKU');
fs.mkdirSync(tempProductDir, { recursive: true });
fs.writeFileSync(path.join(tempProductDir, 'existing.avif'), 'avif');
assert.equal(
  collectImageAssets(tempRoot).some((asset) => asset.extension === '.avif'),
  true,
  'audit collection must count existing AVIF derivatives',
);
