import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('vps_server.cjs', 'utf8');

assert.match(
  source,
  /const AUTORESPONDER_PRODUCT_PAGE_SIZE = 5;/,
  'expected autoresponder to keep five products per message',
);

assert.match(
  source,
  /async function countAutoresponderProductsByTokens\(tokens\)/,
  'expected token searches to count total related products',
);

assert.match(
  source,
  /async function countAutoresponderProductsByTag\(tagId\)/,
  'expected tag searches to count total related products',
);

assert.match(
  source,
  /function formatAutoresponderPaginationSummary\(/,
  'expected the legacy pagination summary helper to remain harmless',
);

assert.doesNotMatch(
  source,
  /Pagina \$\{page\} - encontramos \$\{safeTotal\} produtos relacionados/,
  'product replies must not show the page/total counter line',
);

assert.match(
  source,
  /return '';\s*\}\s*\n\s*const AUTORESPONDER_COMPLETE_PRODUCT_LIST_WORDS/s,
  'pagination summary helper should return an empty string before product list helpers',
);

assert.match(
  source,
  /Ver busca no site:/,
  'expected multi-result replies to include a site search link',
);

assert.doesNotMatch(
  source,
  /AUTORESPONDER_PRODUCT_PAGE_SIZE = 10/,
  'page size must not remain at 10',
);

console.log('autoresponder pagination count static checks passed');
