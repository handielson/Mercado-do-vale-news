import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/catalog/CompareModal.tsx', 'utf8');

const fetchStart = source.indexOf('// Fetch template_values');
const fetchEnd = source.indexOf('    const specKeys = collectSpecKeys', fetchStart);

assert(
  fetchStart >= 0 && fetchEnd > fetchStart,
  'CompareModal should keep a template-loading block',
);

const fetchSource = source.slice(fetchStart, fetchEnd);

assert(
  /import\s+\{\s*modelService\s+\}\s+from\s+['"]\.\.\/\.\.\/services\/models['"]/.test(source),
  'CompareModal should import modelService for model template values',
);

assert(
  /modelService\.getById\(p\.model_id\)/.test(fetchSource),
  'CompareModal should load compared model templates through modelService/VPS',
);

assert(
  !/supabase\s*\.\s*from\('models'\)|\.from\('models'\)/.test(fetchSource),
  'CompareModal template branch must not read models directly from Supabase',
);

console.log('compare modal model template VPS static checks passed');
