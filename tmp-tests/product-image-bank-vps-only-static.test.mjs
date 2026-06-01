import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/admin/products/ProductImageBankPage.tsx', 'utf8');

assert.match(
  source,
  /import\s+\{\s*vpsApiService\s+\}\s+from\s+['"]\.\.\/\.\.\/\.\.\/services\/vpsApiService['"]/,
  'ProductImageBankPage should use vpsApiService for product image persistence',
);

assert.doesNotMatch(
  source,
  /import\s+\{\s*supabase\s+\}\s+from\s+['"]\.\.\/\.\.\/\.\.\/services\/supabase['"]/,
  'ProductImageBankPage should not import Supabase after product image sync moved to VPS',
);

assert.doesNotMatch(
  source,
  /supabase\s*\.[\s\S]*from\(['"]products['"]\)[\s\S]*update\(\s*\{\s*images:/,
  'ProductImageBankPage should not write product images directly to Supabase',
);

assert.ok(
  (source.match(/vpsApiService\.updateProductImagesBySku/g) || []).length >= 3,
  'ProductImageBankPage should persist upload, inline upload, and delete/sync image changes through VPS',
);

console.log('product image bank VPS-only static checks passed');
