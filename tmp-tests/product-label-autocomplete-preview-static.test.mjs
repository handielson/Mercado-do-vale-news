import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/admin/products/ProductLabelPrintPage.tsx', 'utf8');

assert.match(
  source,
  /const\s+\[suggestions,\s*setSuggestions\]\s*=\s*useState<Product\[\]>\(\[\]\)/,
  'label page must keep dynamic autocomplete suggestions',
);

assert.match(
  source,
  /setTimeout\(async\s*\(\)\s*=>[\s\S]*productService\.search\(query\)/,
  'label page must debounce product name/SKU/EAN suggestions while typing',
);

assert.match(
  source,
  /filterInStockProducts/,
  'label page must filter suggestions/results to products currently in stock',
);

assert.match(
  source,
  /handleSelectSuggestion\(product: Product\)/,
  'label page must have a dedicated handler for choosing an autocomplete product',
);

assert.match(
  source,
  /setPreviewProduct\(product\)/,
  'choosing a suggestion must show a product preview instead of immediately printing',
);

assert.match(
  source,
  /Produto selecionado/,
  'label page must render a selected product preview panel',
);

assert.match(
  source,
  /Abrir impressão/,
  'selected product preview must expose a print action',
);

assert.match(
  source,
  /img\s+src=\{previewProduct\.images\?\.\[0\]\}/,
  'selected product preview must show the main product photo',
);

console.log('product label autocomplete preview static test ok');
