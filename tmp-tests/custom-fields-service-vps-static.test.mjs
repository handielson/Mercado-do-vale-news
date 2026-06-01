import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('services/custom-fields.ts', 'utf8');
const libraryPage = readFileSync('pages/admin/settings/CustomFieldsLibraryPage.tsx', 'utf8');
const productPage = readFileSync('pages/store/PublicProductPage.tsx', 'utf8');

assert.doesNotMatch(
  service,
  /from\('custom_fields'\)|supabase\.from\('custom_fields'\)/,
  'customFieldsService must not use Supabase for custom_fields after VPS migration',
);

assert.match(
  service,
  /vpsClient\.get<TableDataResponse<CustomField>>\(\s*`\/table-data\/custom_fields\?limit=\$\{pageSize\}&offset=\$\{offset\}`/,
  'customFieldsService should page custom_fields through VPS table-data',
);

assert.match(
  service,
  /vpsClient\.post<CustomField>\('\/table-data\/custom_fields'/,
  'customFieldsService should create custom_fields through VPS table-data',
);

assert.match(
  service,
  /vpsClient\.patch<CustomField>\(\s*`\/table-data\/custom_fields\/\$\{id\}`/,
  'customFieldsService should update custom_fields through VPS table-data',
);

assert.match(
  service,
  /vpsClient\.delete\(`\/table-data\/custom_fields\/\$\{id\}`\)/,
  'customFieldsService should delete custom_fields through VPS table-data',
);

assert.doesNotMatch(
  libraryPage,
  /from\('custom_fields'\)|supabase\.from\('custom_fields'\)|services\/supabase/,
  'CustomFieldsLibraryPage must use customFieldsService instead of Supabase custom_fields',
);

assert.doesNotMatch(
  productPage,
  /from\('custom_fields'\)|supabase\.from\('custom_fields'\)|@\/services\/supabase/,
  'PublicProductPage must load custom field labels without direct Supabase custom_fields calls',
);

console.log('custom fields VPS static checks passed');
