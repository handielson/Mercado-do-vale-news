import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const source = fs.readFileSync(path.join(root, 'pages/store/PublicProductPage.tsx'), 'utf8');

assert.match(
  source,
  /try\s*{\s*const fieldsData = await customFieldsService\.list\(\);/s,
  'public product page should load custom field labels inside an optional try block'
);

assert.match(
  source,
  /Dicionario de campos customizados indisponivel para visitante publico/,
  'public product page should treat custom field dictionary failures as non-fatal'
);

assert.doesNotMatch(
  source,
  /setLoading\(true\);\s*try\s*{\s*\/\/ Fetch dictionary of custom fields to get readable labels\s*const fieldsData = await customFieldsService\.list\(\);/s,
  'custom field lookup must not be the first fail-fast operation in the product fetch try block'
);

assert.match(
  source,
  /let criticalProductLoaded = false;[\s\S]*setProduct\(formattedProduct as unknown as CatalogProduct\);\s*criticalProductLoaded = true;/,
  'public product page should mark the product as loaded before non-critical recommendation requests continue'
);

assert.match(
  source,
  /catch \(err\) {\s*console\.error\('\[PublicProductPage\] Error fetching product:', err\);\s*if \(!criticalProductLoaded\) {\s*navigate\('\/'\);\s*}\s*}/,
  'public product page should redirect only when the critical product fetch failed'
);

console.log('public product custom fields optional static checks passed');
