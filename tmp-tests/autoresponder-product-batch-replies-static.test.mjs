import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('vps_server.cjs', 'utf8');

assert.match(
  source,
  /const AUTORESPONDER_MAX_PRODUCT_REPLY_MESSAGES = 10;/,
  'product replies must cap AutoResponder Pro messages at 10',
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
  /Math\.min\(Math\.max\(Number\(limit\) \|\| AUTORESPONDER_PRODUCT_PAGE_SIZE, 1\), AUTORESPONDER_PRODUCT_RESPONSE_LIMIT\)/,
  'product SQL queries must allow enough rows for up to 10 five-product messages',
);

console.log('autoresponder product batch replies static checks passed');
