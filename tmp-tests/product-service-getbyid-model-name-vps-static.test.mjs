import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('services/products.ts', 'utf8');

assert(
  /import\s+\{\s*modelService\s+\}\s+from\s+['"]\.\/models['"]/.test(source),
  'productService should import modelService for model enrichment'
);

const getByIdMatch = source.match(/async function getById\(id: string\): Promise<Product \| null> \{[\s\S]*?\n\}/);
assert(getByIdMatch, 'productService should keep getById');

const getByIdSource = getByIdMatch[0];

assert(
  /modelService\.getById\(product\.model_id\)/.test(getByIdSource),
  'productService.getById should enrich model names through modelService/VPS'
);

assert(
  !/\.from\(['"]models['"]\)/.test(getByIdSource),
  'productService.getById should not read models directly from Supabase'
);

console.log('productService.getById model name enrichment uses VPS modelService');
