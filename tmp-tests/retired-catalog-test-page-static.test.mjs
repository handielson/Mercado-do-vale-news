import { existsSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const retiredPage = 'pages/test/catalog-test.tsx';

assert.equal(
  existsSync(retiredPage),
  false,
  'legacy catalog test page should be removed after catalog reads moved to VPS'
);

const routes = readFileSync('routes/index.tsx', 'utf8');
assert.doesNotMatch(
  routes,
  /catalog-test|CatalogTest/,
  'routes must not expose the retired catalog Supabase test page'
);

console.log('retired catalog test page static checks passed');
