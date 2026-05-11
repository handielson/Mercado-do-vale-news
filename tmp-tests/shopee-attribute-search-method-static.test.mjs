import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('api/shopee-catalog.ts', 'utf8');

assert.match(
  source,
  /async function shopeePost\(apiPath: string, creds: Creds, body: any, extraParams = ''\): Promise<any>/,
  'shopeePost must support query params for POST endpoints'
);

assert.match(
  source,
  /fetch\(`\$\{url\}\$\{extraParams\}`,\s*\{\s*method: 'POST'/,
  'shopeePost must append query params on the first request'
);

assert.match(
  source,
  /fetch\(`\$\{url2\}\$\{extraParams\}`,\s*\{\s*method: 'POST'/,
  'shopeePost must append query params after token refresh'
);

assert.match(
  source,
  /shopeePost\('\/api\/v2\/product\/search_attribute_value_list', creds, \{\}, `&\$\{params\}`\)/,
  'search_attribute_value_list must be called as POST with query params'
);

console.log('shopee-attribute-search-method-static.test.mjs: ok');
