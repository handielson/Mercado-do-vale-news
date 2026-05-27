import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('components/catalog/QuoteModal.tsx'), 'utf8');

assert(
  /vpsApiService\.getProducts/.test(source),
  'QuoteModal should load available variant colors from VPS products',
);

assert(
  /model_id:\s*product\.model_id/.test(source),
  'QuoteModal VPS lookup should keep the model_id filter when available',
);

assert(
  /stock_quantity\s*\?\?\s*row\.stock\s*\?\?\s*row\.available_stock/.test(source),
  'QuoteModal should filter available colors by VPS stock fields',
);

assert(
  !/from\('products'\)|supabase\s*\.\s*from\('products'\)/.test(source),
  'QuoteModal must not read products directly from Supabase',
);

console.log('quote modal VPS colors static checks passed');
