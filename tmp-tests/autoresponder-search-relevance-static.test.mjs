import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('vps_server.cjs', 'utf8');

assert.match(
  source,
  /function buildAutoresponderProductSearchScoreSql\(tokens\)/,
  'expected helper to build search relevance score',
);

assert.match(
  source,
  /AS search_score/,
  'expected product search query to select a search_score',
);

assert.match(
  source,
  /LOWER\(COALESCE\(sku, ''\)\) = \?/,
  'expected exact SKU matches to receive highest relevance',
);

assert.match(
  source,
  /LOWER\(COALESCE\(CAST\(specs AS CHAR\), ''\)\) LIKE \?/,
  'expected product specs such as color to participate in search',
);

assert.doesNotMatch(
  source,
  /LOWER\(COALESCE\(model_id, ''\)\) LIKE \?/,
  'customer search must not match UUID model_id fragments such as "14"',
);

assert.match(
  source,
  /ORDER BY stock_quantity > 0 DESC, search_score DESC, updated_at DESC/,
  'expected available products to be sorted by relevance before recency',
);

console.log('autoresponder search relevance static checks passed');
