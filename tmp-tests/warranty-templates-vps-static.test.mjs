import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const service = readFileSync('services/warrantyTemplates.ts', 'utf8');
const files = [
  'components/admin/sales/SaleDetailsModal.tsx',
  'components/catalog/ProductDetailsModal.tsx',
  'pages/store/CartPage.tsx',
  'pages/pdv/PDVPage.tsx',
  'pages/customers/CustomerDetailsPage.tsx',
].map(file => [file, readFileSync(file, 'utf8')]);

assert.doesNotMatch(
  service,
  /\.from\('warranty_templates'\)|supabase\.from\('warranty_templates'\)/,
  'warranty template service must not use Supabase',
);

for (const [file, source] of files) {
  assert.doesNotMatch(
    source,
    /\.from\('warranty_templates'\)|supabase\.from\('warranty_templates'\)/,
    `${file} must not query warranty_templates through Supabase`,
  );
}

assert.match(
  service,
  /\/table-data\/warranty_templates\?limit=\$\{pageSize\}&offset=\$\{offset\}/,
  'warranty templates must be listed through paged VPS table-data',
);

assert.match(
  service,
  /vpsClient\.post<WarrantyTemplate>\('\/table-data\/warranty_templates'/,
  'warranty template creation must use VPS table-data',
);

assert.match(
  service,
  /vpsClient\.patch<WarrantyTemplate>\(`\/table-data\/warranty_templates\/\$\{id\}`/,
  'warranty template updates must use VPS table-data',
);

assert.match(
  service,
  /vpsClient\.delete\(`\/table-data\/warranty_templates\/\$\{id\}`/,
  'warranty template removal must use VPS table-data',
);

console.log('warranty templates VPS static checks passed');
