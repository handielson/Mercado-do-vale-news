import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('services/documentService.ts', 'utf8');

assert.doesNotMatch(
  service,
  /\.from\('company_documents'\)/,
  'company_documents metadata must not use Supabase table calls after VPS migration',
);

assert.match(
  service,
  /\/table-data\/company_documents\?limit=\$\{pageSize\}&offset=\$\{offset\}/,
  'company document metadata reads should use explicit paged VPS table-data',
);

assert.match(
  service,
  /vpsClient\.post<CompanyDocumentRow>\('\/table-data\/company_documents'/,
  'company document metadata creation should use VPS table-data',
);

assert.match(
  service,
  /vpsClient\.delete\(`\/table-data\/company_documents\/\$\{id\}`/,
  'company document metadata deletion should use VPS table-data',
);

assert.doesNotMatch(
  service,
  /supabase\.storage|storage\.from\(/,
  'company document files must not use Supabase Storage after the Synology migration step',
);

assert.match(
  service,
  /vpsClient\.upload<[^>]+>\('\/synology\/upload\?folder=arquivos'/,
  'company document files should upload to Synology through the VPS',
);

assert.match(
  service,
  /vpsClient\.delete\(`\/synology\/file\?folder=arquivos&name=\$\{encodeURIComponent\(fileName\)\}`\)/,
  'company document deletion should remove the Synology file through the VPS',
);

console.log('company documents VPS static checks passed');
