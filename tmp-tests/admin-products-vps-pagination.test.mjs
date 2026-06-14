import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('hooks/useProducts.ts', 'utf8');

assert.match(
  source,
  /async function fetchAllAdminVpsProducts\(\)[\s\S]*for\s*\(\s*let offset = 0;[\s\S]*offset \+= pageSize[\s\S]*limit: pageSize[\s\S]*offset[\s\S]*page\.length < pageSize/s,
  'admin product list should page through VPS products instead of relying on one fixed cap',
);

assert.match(
  source,
  /const pageSize = 500;/,
  'admin product list should use 500-item VPS pages to reduce sequential round trips',
);

assert.match(
  source,
  /vpsApiService\.getProducts\(\{[\s\S]*compact:\s*true,[\s\S]*noCache:\s*true/s,
  'admin product list should request compact VPS products to avoid heavy image payloads',
);

assert.doesNotMatch(
  source,
  /vpsApiService\.getProducts\(\{\s*status:\s*'all',\s*limit:\s*2000\s*\}\)/,
  'admin product list must not cap the first VPS load at 2000 products',
);

console.log('ok');
