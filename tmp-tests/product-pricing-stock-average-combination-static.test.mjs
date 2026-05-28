import fs from 'node:fs';

const source = fs.readFileSync('components/products/sections/ProductPricing.tsx', 'utf8');

const requiredSnippets = [
  'const SMARTPHONE_CATEGORY_LABEL =',
  'readSpecCandidate',
  "['ram', 'memoria_ram', 'memory_ram']",
  "['storage', 'armazenamento', 'memoria_interna', 'internal_storage']",
  'category: categoryId',
  'toPositiveNumber(p.stock_quantity)',
  'toPositiveNumber(p[field])',
  'matchesSmartphoneMemoryCombination(product, selectedRam, selectedStorage)',
];

const forbiddenSnippets = [
  'model_id: modelId',
];

const missing = requiredSnippets.filter((snippet) => !source.includes(snippet));
const forbidden = forbiddenSnippets.filter((snippet) => source.includes(snippet));

if (missing.length > 0 || forbidden.length > 0) {
  throw new Error([
    missing.length ? `missing: ${missing.join(', ')}` : '',
    forbidden.length ? `forbidden: ${forbidden.join(', ')}` : '',
  ].filter(Boolean).join(' | '));
}

console.log('product pricing stock average combination static check passed');
