import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const files = [
  'services/modelProductAggregator.js',
  'pages/admin/products/ModelProductAggregatorPage.tsx',
];

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /supabase|VITE_SUPABASE|SUPABASE|@supabase\/supabase-js/i, `${file} must not use Supabase`);
  assert.doesNotMatch(source, /vercel|\/api\/.*model.*aggregator/i, `${file} must not add Vercel runtime dependency`);
}

console.log('model aggregator no legacy runtime checks passed');
