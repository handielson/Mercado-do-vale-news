import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/products.ts', 'utf8');

assert.match(
  source,
  /import\s+\{\s*modelService\s+\}\s+from\s+['"]\.\/models['"]/,
  'productService must import modelService for VPS model reads',
);

const createStart = source.indexOf('async function create(input: ProductInput)');
const updateStart = source.indexOf('async function update(id: string, input: ProductInput)');
assert.ok(createStart >= 0, 'productService must keep create');
assert.ok(updateStart > createStart, 'productService must keep update after create');

const createBlock = source.slice(createStart, updateStart);
const updateBlock = source.slice(updateStart, source.indexOf('async function deleteProduct', updateStart));

assert.match(
  createBlock,
  /modelService\.getById\(input\.model_id\)/,
  'productService.create must load selected model through modelService/VPS',
);

assert.doesNotMatch(
  createBlock,
  /\.from\(['"]models['"]\)/,
  'productService.create must not read models directly from Supabase',
);

assert.match(
  updateBlock,
  /modelService\.getById\(effectiveModelId\)/,
  'productService.update must load effective model through modelService/VPS',
);

assert.doesNotMatch(
  updateBlock,
  /\.from\(['"]models['"]\)/,
  'productService.update must not read models directly from Supabase',
);

assert.match(
  updateBlock,
  /Modelo \$\{effectiveModelId\} n(?:ã|Ã£|a)o encontrado/,
  'productService.update must preserve the legacy-model warning path when a preserved model is missing',
);

console.log('productService create/update model enrichment uses VPS modelService');
