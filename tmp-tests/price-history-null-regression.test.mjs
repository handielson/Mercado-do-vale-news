import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const source = readFileSync(path.join(repoRoot, 'services', 'priceHistoryService.ts'), 'utf8');

assert.match(
  source,
  /function\s+normalizePriceValue\(/,
  'price history service must normalize nullable price values before inserting into NOT NULL columns',
);

assert.match(
  source,
  /price_cost:\s*normalizePriceValue\(prices\.price_cost\)/,
  'logPriceChange must not insert null price_cost into product_price_history',
);

assert.match(
  source,
  /price_retail:\s*normalizePriceValue\(prices\.price_retail\)/,
  'logPriceChange must normalize price_retail consistently',
);

console.log('price history null regression ok');
