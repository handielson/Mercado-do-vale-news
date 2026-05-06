import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('vps_server.cjs', 'utf8');

assert.match(
  source,
  /function isAutoresponderProductAvailable\(product\)/,
  'expected a helper to decide if a product can be offered to the customer',
);

assert.match(
  source,
  /function filterAutoresponderAvailableProducts\(products\)/,
  'expected product replies to filter unavailable products before offering links',
);

assert.match(
  source,
  /function formatAutoresponderUnavailableProductReply\(keyword\)/,
  'expected a dedicated no-stock reply instead of sending an unavailable product link',
);

assert.match(
  source,
  /No momento nao encontrei esse produto disponivel em estoque/,
  'expected no-stock customer message',
);

assert.doesNotMatch(
  source,
  /disponivel em estoque\$\{suffix\}/,
  'no-stock message must not echo the searched term because it can be an internal SKU',
);

assert.match(
  source,
  /filterAutoresponderAvailableProducts\(safeProducts\)/,
  'expected search reply formatting to use only available products',
);

assert.match(
  source,
  /if \(!isAutoresponderProductAvailable\(product\)\) \{/,
  'expected detail replies to avoid links for unavailable products',
);

console.log('autoresponder out of stock reply static checks passed');
