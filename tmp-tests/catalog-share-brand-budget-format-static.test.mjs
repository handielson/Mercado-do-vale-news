import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const catalogSource = readFileSync('utils/catalogMessageGenerator.ts', 'utf8');
const cartShareSource = readFileSync('utils/cartShareUtils.ts', 'utf8');
const specUtilsSource = readFileSync('utils/productSpecUtils.ts', 'utf8');

assert(
  catalogSource.includes('brand:') &&
    catalogSource.includes('groupCatalogItemsByBrand') &&
    catalogSource.includes("a.name.localeCompare(b.name, 'pt-BR') || a.price - b.price"),
  'copied category message must group products by brand, sort products alphabetically, then cheapest to most expensive',
);

assert(
  catalogSource.includes("import { getMemorySpecs } from '@/utils/productSpecUtils'") &&
    catalogSource.includes('getMemorySpecs(product)'),
  'copied category message must use the shared memory spec reader so products do not show N/A/N/A when memory exists',
);

assert(
  specUtilsSource.includes("RAM_SPEC_KEYS = ['ram', 'memoria_ram', 'memory_ram']") &&
    specUtilsSource.includes("'storage'") &&
    specUtilsSource.includes("'armazenamento'") &&
    specUtilsSource.includes("'capacidade'") &&
    specUtilsSource.includes("'memoria_interna'") &&
    specUtilsSource.includes("'internal_storage'"),
  'memory spec aliases must live in the shared product spec utility',
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
