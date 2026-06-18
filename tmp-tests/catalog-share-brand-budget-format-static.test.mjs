import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const catalogSource = readFileSync('utils/catalogMessageGenerator.ts', 'utf8');
const cartShareSource = readFileSync('utils/cartShareUtils.ts', 'utf8');

assert(
  catalogSource.includes('brand:') &&
    catalogSource.includes('groupCatalogItemsByBrand') &&
    catalogSource.includes('sort((a, b) => a.price - b.price'),
  'copied category message must group products by brand and sort each brand from cheapest to most expensive',
);

assert(
  /message \+= `\*[^`]*\$\{brand[^`]*\}\*\\n\\n`;/.test(catalogSource),
  'copied category message must print the brand name before its products',
);

assert(
  cartShareSource.includes("'📱 Orçamento'") || cartShareSource.includes("'ðŸ“± Orçamento'"),
  'copied budget header must be Orçamento instead of CATÁLOGO - SMARTPHONES',
);

assert(
  cartShareSource.includes('url: getProductUrl') &&
    cartShareSource.includes('lines.push(`   🔗 ${row.url}`)'),
  'copied budget must include each product link under the product details',
);

console.log('catalog share message groups by brand, budget header and product links are enforced');
