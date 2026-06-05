import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('vps_server.cjs', 'utf8');

assert.match(
  source,
  /const AUTORESPONDER_MAX_PRODUCT_REPLY_MESSAGES = 10;/,
  'normal product replies must keep the 10-message cap',
);

assert.match(
  source,
  /const AUTORESPONDER_PRODUCT_REPLY_DELAY_SECONDS = 3;/,
  'product replies must include a small delay between Pro messages',
);

assert.match(
  source,
  /async function formatAutoresponderProductSearchReplies\(/,
  'product searches must support multiple reply messages',
);

assert.match(
  source,
  /chunkAutoresponderArray\(groupedProducts, AUTORESPONDER_PRODUCT_PAGE_SIZE\)/,
  'product replies must be chunked in groups of five products per message',
);

assert.match(
  source,
  /function sortAutoresponderProductGroupsByBrand\(/,
  'product replies must sort smartphone groups by brand and model name',
);

assert.match(
  source,
  /function formatAutoresponderProductBrandHeading\(/,
  'product replies must render a brand heading before each brand section',
);

assert.match(
  source,
  /🏷️ \$\{brandName\}/,
  'brand headings must include an emoji before the brand name',
);

assert.match(
  source,
  /const groupedProducts = sortAutoresponderProductGroupsByBrand\(groupAutoresponderProductsByModel\(availableProducts\)\)/,
  'product search replies must sort grouped products before chunking and numbering',
);

assert.match(
  source,
  /formatAutoresponderProductBrandHeading\(brandName\)/,
  'product search replies must insert brand headings in the WhatsApp list',
);

assert.match(
  source,
  /const chunks = chunkAutoresponderArray\(groupedProducts, AUTORESPONDER_PRODUCT_PAGE_SIZE\);\s*const visibleChunks = pagination\?\.completeList/s,
  'complete device lists must keep every five-product message instead of slicing to the normal cap',
);

const proRepliesBody = source.match(/function formatAutoresponderProReplies\([\s\S]*?\n}\n\nfunction formatAutoresponderReplies/)?.[0] || '';
assert.doesNotMatch(
  proRepliesBody,
  /\.slice\(0, AUTORESPONDER_MAX_PRODUCT_REPLY_MESSAGES\)/,
  'final Pro reply packaging must not cut complete lists after they are formatted',
);

assert.match(
  source,
  /formatAutoresponderProReplies\(replyMessages\)/,
  'product reply messages must be converted to Pro replies with delay metadata',
);

assert.match(
  source,
  /delaySeconds: index \* AUTORESPONDER_PRODUCT_REPLY_DELAY_SECONDS/,
  'each product reply after the first must carry incremental delay metadata',
);

assert.match(
  source,
  /function getAutoresponderProductQueryLimit\(limit\)/,
  'product SQL queries must use the shared product limit helper',
);

assert.match(
  source,
  /AUTORESPONDER_COMPLETE_PRODUCT_RESPONSE_LIMIT = 500/,
  'complete device lists must allow more than the normal 50-product response cap',
);

assert.match(
  source,
  /function isAutoresponderCompleteProductListKeyword\(/,
  'expected a helper to detect complete-list device keywords',
);

assert.match(
  source,
  /celulares[\s\S]*smartphones[\s\S]*tabltes[\s\S]*receptores/,
  'complete-list keywords must include celulares, smartphones, typo tabltes, and receptores',
);

assert.match(
  source,
  /isAutoresponderCompleteProductListKeyword\(text\)\) return null/,
  'generic device terms should continue into product/category listing instead of refinement prompt',
);

assert.match(
  source,
  /completeList:\s*isAutoresponderCompleteProductListKeyword\(selectedCategory\.name\)/,
  'category listings for device families must request complete product replies',
);

assert.match(
  source,
  /completeList:\s*isAutoresponderCompleteProductListKeyword\(searchKeyword\)/,
  'search listings for device families must request complete product replies',
);

console.log('autoresponder product batch replies static checks passed');
