import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/brands.ts', 'utf8');

assert.doesNotMatch(
  source,
  /services\/supabase|\.from\('brands'\)|\.from\('products'\)|USE_VPS/,
  'brandService must not keep Supabase or migration-flag fallbacks after the VPS-only migration',
);

assert.match(
  source,
  /async function loadVpsBrands\(\): Promise<any\[]> \{[\s\S]*?vpsApiService\.getBrands\(\)/,
  'brandService should load brands from the VPS API',
);

assert.match(
  source,
  /\/api\/vps-proxy[\s\S]*encodeURIComponent\('\/brands'\)/,
  'brandService should retain same-origin VPS proxy fallback for browser reliability',
);

assert.match(
  source,
  /vpsApiService\.syncBrand\(payload\)/,
  'brandService should create brands through the VPS API',
);

assert.match(
  source,
  /vpsApiService\.updateBrand\(id, payload\)/,
  'brandService should update brands through the VPS API',
);

assert.match(
  source,
  /vpsApiService\.deleteBrand\(id\)/,
  'brandService should delete brands through the VPS API',
);

assert.match(
  source,
  /return \(await list\(\)\)\.filter\(brand => brand\.active\)/,
  'brandService.listActive should filter active rows after VPS normalization',
);

console.log('brand service VPS-only static checks passed');
