import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/catalog/ProductDetailsModal.tsx', 'utf8');

const warrantyStart = source.indexOf('// Fetch warranty days from brand, category or custom template');
const warrantyEnd = source.indexOf('    if (!isOpen) return null;', warrantyStart);
const modelTemplateStart = source.indexOf('// Fetch model template_values when modal opens');
const modelTemplateEnd = source.indexOf('// Fetch warranty days from brand, category or custom template', modelTemplateStart);

assert(
  warrantyStart >= 0 && warrantyEnd > warrantyStart,
  'ProductDetailsModal should keep a warranty-loading block',
);

assert(
  modelTemplateStart >= 0 && modelTemplateEnd > modelTemplateStart,
  'ProductDetailsModal should keep a model template-loading block',
);

const warrantySource = source.slice(warrantyStart, warrantyEnd);
const modelTemplateSource = source.slice(modelTemplateStart, modelTemplateEnd);

assert(
  /import\s+\{\s*modelService\s+\}\s+from\s+['"]@\/services\/models['"]/.test(source),
  'ProductDetailsModal should import modelService for model template values',
);

assert(
  /import\s+\{\s*brandService\s+\}\s+from\s+['"]@\/services\/brands['"]/.test(source),
  'ProductDetailsModal should import brandService for brand warranty days',
);

assert(
  /import\s+\{\s*categoryService\s+\}\s+from\s+['"]@\/services\/categories['"]/.test(source),
  'ProductDetailsModal should import categoryService for category warranty days',
);

assert(
  /brandService\.listActive\(\)/.test(warrantySource),
  'ProductDetailsModal should load brand warranty days through brandService/VPS',
);

assert(
  /categoryService\.getById\(categoryId\)/.test(warrantySource),
  'ProductDetailsModal should load category warranty days through categoryService/VPS',
);

assert(
  /modelService\.getById\(product\.model_id\)/.test(modelTemplateSource),
  'ProductDetailsModal should load model template values through modelService/VPS',
);

assert(
  !/supabase\s*\.\s*from\('models'\)|\.from\('models'\)/.test(modelTemplateSource),
  'ProductDetailsModal template branch must not read models directly from Supabase',
);

assert(
  !/supabase\s*\.\s*from\('brands'\)|\.from\('brands'\)/.test(warrantySource),
  'ProductDetailsModal brand warranty branch must not read brands directly from Supabase',
);

assert(
  !/supabase\s*\.\s*from\('categories'\)|\.from\('categories'\)/.test(warrantySource),
  'ProductDetailsModal category warranty branch must not read categories directly from Supabase',
);

console.log('product details modal warranty VPS static checks passed');
