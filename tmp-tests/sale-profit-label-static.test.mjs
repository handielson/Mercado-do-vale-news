import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const files = [
  'components/admin/sales/SaleDetailsModal.tsx',
  'pages/admin/sales/SalesPage.tsx',
];

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  assert.doesNotMatch(source, /Lucro Estimado/, `${file} must not show the old profit label`);
  assert.match(source, /Lucro Real/, `${file} must show the profit label as Lucro Real`);
}

console.log('sale profit label static checks passed');
