import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/dataSyncService.ts', 'utf8');
const templateStart = source.indexOf('static async generateDynamicTemplate');
const importStart = source.slice(0, templateStart);
const templateEnd = source.indexOf('// --- IMPORTA', templateStart);
const templateSource = source.slice(templateStart, templateEnd === -1 ? undefined : templateEnd);

assert.ok(templateStart > -1, 'generateDynamicTemplate should exist');

assert.match(
  importStart,
  /import\s+\{\s*vpsApiService\s+\}\s+from\s+['"]\.\/vpsApiService['"]/,
  'DataSyncService should import vpsApiService for product reads',
);

assert.match(
  templateSource,
  /vpsApiService\.getProducts\(\s*\{[\s\S]*category:\s*categoryId[\s\S]*status:\s*['"]all['"][\s\S]*noCache:\s*true[\s\S]*\}\s*\)/,
  'generateDynamicTemplate should fetch category products from the VPS with noCache',
);

assert.doesNotMatch(
  templateSource,
  /\.from\(['"]products['"]\)[\s\S]*\.select\(['"]\*['"]\)[\s\S]*\.eq\(['"]category_id['"],\s*categoryId\)/,
  'generateDynamicTemplate should not read category products directly from Supabase',
);

console.log('data sync template VPS products static checks passed');
