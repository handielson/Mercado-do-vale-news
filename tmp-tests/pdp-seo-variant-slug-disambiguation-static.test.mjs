import fs from 'node:fs';
import assert from 'node:assert/strict';

for (const file of ['vps_server.cjs', 'vps_server.js']) {
  const source = fs.readFileSync(file, 'utf8');

  assert.match(
    source,
    /const disambiguatedTarget = getPublicProductDisambiguatedRouteTargetVps\(product\)\.toLowerCase\(\);/,
    `${file} must calculate disambiguatedTarget in loadSeoProductBySlug`,
  );

  assert.match(
    source,
    /return variantTarget === currentSlug \|\| disambiguatedTarget === currentSlug;/,
    `${file} must accept either variantTarget or disambiguatedTarget when matching SEO product candidates`,
  );
}

console.log('pdp seo variant slug disambiguation static test passed');
