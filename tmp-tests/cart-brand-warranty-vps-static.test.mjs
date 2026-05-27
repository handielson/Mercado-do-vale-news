import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/store/CartPage.tsx', 'utf8');
const brandWarrantyStart = source.indexOf("if (wType === 'brand' && p.brand)");
const categoryWarrantyStart = source.indexOf("} else if (wType === 'category')", brandWarrantyStart);

assert(
  brandWarrantyStart >= 0 && categoryWarrantyStart > brandWarrantyStart,
  'CartPage should have a brand warranty branch',
);

const brandWarrantySource = source.slice(brandWarrantyStart, categoryWarrantyStart);

assert(
  /import\s+\{\s*brandService\s+\}\s+from\s+['"]@\/services\/brands['"]/.test(source),
  'CartPage should import brandService for brand warranty days',
);

assert(
  /brandService\.listActive\(\)/.test(brandWarrantySource),
  'CartPage should load brand warranty days through brandService/VPS',
);

assert(
  !/supabase\s*\.\s*from\('brands'\)|\.from\('brands'\)/.test(brandWarrantySource),
  'CartPage brand warranty branch must not read brands directly from Supabase',
);

assert(
  /brand\.name\s*===\s*p\.brand/.test(brandWarrantySource),
  'CartPage should match the cart product brand by name',
);

console.log('cart brand warranty VPS static checks passed');
