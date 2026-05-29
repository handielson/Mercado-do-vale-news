import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('services/brands.ts', 'utf8');

assert.match(
  source,
  /import \{ USE_VPS \} from ['"]\.\.\/config\/migration['"]/,
  'brandService must read the migration flag for brands'
);

assert.match(
  source,
  /async function loadVpsBrands\(\): Promise<any\[]> \{[\s\S]*?vpsApiService\.getBrands\(\)/,
  'brandService.list must load brands from the VPS when USE_VPS.brands is enabled'
);

assert.match(
  source,
  /\/api\/vps-proxy[\s\S]*encodeURIComponent\('\/brands'\)/,
  'brandService must fall back to the same-origin VPS proxy for brands so browser CORS/direct VPS settings cannot empty the selector'
);

assert.match(
  source,
  /activeValue !== false && activeValue !== 0 && activeValue !== '0'/,
  'brandService must map numeric VPS active flags correctly'
);

console.log('brand service vps source regression passed');
