import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const publicPage = readFileSync('pages/store/PublicProductPage.tsx', 'utf8');
const servers = ['server.js', 'vps_server.js', 'vps_server.cjs'].map((file) => ({
  file,
  source: readFileSync(file, 'utf8'),
}));

assert.match(
  publicPage,
  /const productSlug = getPublicProductRouteTarget\(product\);/,
  'public product page must derive a named route target from the product',
);
assert.match(
  publicPage,
  /window\.history\.replaceState\(null, '', `\/produto\/\$\{encodeURIComponent\(canonicalRouteTarget\)\}`\);/,
  'opening a product by id must replace the address bar with the canonical named product URL',
);
assert.doesNotMatch(
  publicPage,
  /mercadodovale\.com\.br\/produto\/\$\{encodeURIComponent\(product\.slug \|\| product\.id\)\}/,
  'public share links must not fall back directly to product id',
);

for (const { file, source } of servers) {
  assert.match(
    source,
    /function getPublicProductRouteTargetVps\(product\)/,
    `${file} must expose a public route helper for server-generated product links`,
  );
  assert.match(
    source,
    /slugifyPublicProductRouteTargetVps\(product\?\.name\) \|\| String\(product\?\.id \|\| ''\)\.trim\(\)/,
    `${file} must derive a readable slug from the product name before falling back to id`,
  );
  assert.match(
    source,
    /\/produto\/\$\{encodeURIComponent\(routeTarget\)\}/,
    `${file} must URL-encode the named route target in product links`,
  );
}

console.log('public product named URL static checks passed');
