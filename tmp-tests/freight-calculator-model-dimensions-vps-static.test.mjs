import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/shipping/FreightCalculator.tsx', 'utf8');

const loadStart = source.indexOf('async function loadProducts()');
const loadEnd = source.indexOf('    // ── Filtro de busca', loadStart);

assert(
  loadStart >= 0 && loadEnd > loadStart,
  'FreightCalculator should keep a product-loading block',
);

const loadSource = source.slice(loadStart, loadEnd);

assert(
  /import\s+\{\s*modelService\s+\}\s+from\s+['"]\.\.\/\.\.\/services\/models['"]/.test(source),
  'FreightCalculator should import modelService for model dimensions',
);

assert(
  /modelService\.getById\(modelId\)/.test(loadSource),
  'FreightCalculator should load model template dimensions through modelService/VPS',
);

assert(
  !/supabase\s*\.\s*from\('models'\)|\.from\('models'\)/.test(loadSource),
  'FreightCalculator product loading must not read models directly from Supabase',
);

console.log('freight calculator model dimensions VPS static checks passed');
