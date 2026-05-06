import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('vps_server.cjs', 'utf8');

const captionBody = source.match(/async function formatAutoresponderProductCaption[\s\S]*?\n}\n\nasync function formatAutoresponderProductSearchReply/)?.[0] || '';
const listBody = source.match(/function formatAutoresponderProductListReply[\s\S]*?\n}\n\nfunction getAutoresponderNumberedChoice/)?.[0] || '';
const detailBody = source.match(/async function formatAutoresponderProductDetailReply[\s\S]*?\n}\n\nconst AUTORESPONDER_PRODUCT_SEARCH_STOPWORDS/)?.[0] || '';

assert.doesNotMatch(
  captionBody,
  /SKU:/,
  'autoresponder product list caption must not include SKU lines',
);

assert.doesNotMatch(
  listBody,
  /SKU:/,
  'autoresponder numbered product list must not include SKU lines',
);

assert.match(
  detailBody,
  /SKU: \$\{product\.sku\}/,
  'autoresponder individual product detail must include SKU when available',
);

assert.match(
  source,
  /name LIKE \? OR sku LIKE \?/,
  'autoresponder search should still be able to find products by SKU internally',
);

console.log('autoresponder hide sku static checks passed');
