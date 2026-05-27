import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('components/cart/NewOrderModal.tsx'), 'utf8');

assert(
  !/from\s+['"]@\/services\/supabase['"]/.test(source),
  'NewOrderModal must not import Supabase directly',
);

assert(
  !/from\('products'\)|supabase\s*\./.test(source),
  'NewOrderModal must not read product variations directly from Supabase',
);

assert(
  /vpsApiService\.getProducts/.test(source),
  'NewOrderModal should load sibling product variations from VPS',
);

assert(
  /model_id:\s*modelId/.test(source),
  'NewOrderModal VPS lookup should keep the model_id filter',
);

console.log('new order modal VPS variation static checks passed');
