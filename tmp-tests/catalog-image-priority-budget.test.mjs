import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const catalogPage = fs.readFileSync(path.join(root, 'pages/catalog/index.tsx'), 'utf8');
const catalogSection = fs.readFileSync(path.join(root, 'components/catalog/CatalogSection.tsx'), 'utf8');
const modernProductCard = fs.readFileSync(path.join(root, 'components/catalog/ModernProductCard.tsx'), 'utf8');

assert.equal(
  /priorityImageCount=\{[3-9]\}/.test(catalogPage),
  false,
  'catalog page should not mark 3+ product-card images as eager/high priority per grid',
);

assert.equal(
  /priorityImage=\{index < [3-9]\}/.test(catalogSection),
  false,
  'catalog sections should not mark 3+ product-card images as eager/high priority per section',
);

assert.match(
  catalogPage,
  /priorityImageCount=\{isAllProductsListing \? 1 : 0\}/,
  'all-products page should reserve high priority for only the first product image',
);

assert.equal(
  /decoding=\{priorityImage \? 'sync' : 'async'\}/.test(modernProductCard),
  false,
  'product-card images should decode async even when they are fetched eagerly',
);
