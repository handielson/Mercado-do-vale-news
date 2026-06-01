import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('services/warrantyDocumentService.ts', 'utf8');

assert.doesNotMatch(
  service,
  /from ['"]\.\/supabase['"]|supabase\.from\('warranty_documents'\)/,
  'warranty_documents must not use Supabase after VPS migration',
);

assert.match(
  service,
  /\/table-data\/warranty_documents\?limit=\$\{pageSize\}&offset=\$\{offset\}/,
  'warranty document reads should use explicit paged VPS table-data',
);

assert.match(
  service,
  /vpsClient\.post<WarrantyDocument>\('\/table-data\/warranty_documents'/,
  'warranty document creation should use VPS table-data',
);

assert.match(
  service,
  /vpsClient\.patch<WarrantyDocument>\(`\/table-data\/warranty_documents\/\$\{id\}`/,
  'warranty document updates should use VPS table-data',
);

assert.match(
  service,
  /vpsClient\.delete\(`\/table-data\/warranty_documents\/\$\{id\}`/,
  'warranty document deletes should use VPS table-data',
);

console.log('warranty documents VPS static checks passed');
