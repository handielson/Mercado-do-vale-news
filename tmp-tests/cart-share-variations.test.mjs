import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('utils/cartShareUtils.ts', 'utf8');

assert.match(
  source,
  /color[\s\S]*storage[\s\S]*ram[\s\S]*material/,
  'WhatsApp budget variations should keep common product option keys enabled',
);

assert.match(
  source,
  /vpsApiService\.getProducts\(\{\s*model_id:\s*modelId[\s\S]*status:\s*'active'[\s\S]*limit:\s*100/,
  'Sibling variations should be loaded from active VPS products by model_id',
);

assert.match(
  source,
  /stock_quantity\s*\?\?\s*row\?\.stock\s*\?\?\s*row\?\.available_stock/,
  'Sibling variations should only include rows with available stock from VPS fields',
);

assert.doesNotMatch(
  source,
  /from\('products'\)|supabase\s*\./,
  'Sibling variations must not query Supabase products directly',
);

console.log('cart share variations static checks passed');
