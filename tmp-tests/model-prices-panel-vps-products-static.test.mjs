import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('components/settings/ModelPricesPanel.tsx'), 'utf8');

assert(
  /vpsApiService\.getProducts/.test(source),
  'ModelPricesPanel should load active model products from VPS',
);

assert(
  /model_id:\s*modelId/.test(source),
  'ModelPricesPanel VPS lookup should keep the model_id filter',
);

assert(
  /status:\s*'active'/.test(source),
  'ModelPricesPanel VPS lookup should keep the active status filter',
);

assert(
  !/from\('products'\)|supabase\s*\.\s*from\('products'\)/.test(source),
  'ModelPricesPanel must not read products directly from Supabase',
);

console.log('model prices panel VPS products static checks passed');
