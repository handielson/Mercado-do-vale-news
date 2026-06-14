import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('services/saleService.ts', 'utf8');

assert.match(
  source,
  /return\s+\{\s*sale,\s*rawItems,\s*saleRow\s*\};/,
  'getSales must keep the raw saleRow available for item money normalization',
);

assert.match(
  source,
  /\.map\(\(\{\s*sale,\s*rawItems,\s*saleRow\s*\}\)\s*=>\s*\(\{/,
  'getSales item normalization map must receive saleRow from the previous step',
);

console.log('sale-list-sale-row-scope-static.test.mjs: ok');
