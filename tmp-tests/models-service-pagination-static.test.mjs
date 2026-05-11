import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/models.ts', 'utf8');

assert.match(
  source,
  /import\s+\{\s*fetchAllModelRows\s*\}\s+from\s+['"]\.\/modelPagination['"]/,
  'models service must import the paginated model row loader',
);

assert.match(
  source,
  /const\s+rows\s*=\s*await\s+fetchAllModelRows\(\s*supabase,\s*\{\s*companyId\s*\}\s*\)/s,
  'list() must load all model pages instead of relying on Supabase default 1000-row cap',
);

assert.match(
  source,
  /const\s+rows\s*=\s*await\s+fetchAllModelRows\(\s*supabase,\s*\{\s*companyId,\s*brandId\s*\}\s*\)/s,
  'listByBrand() must load all model pages for the selected brand',
);

assert.doesNotMatch(
  source,
  /async function list\(\)[\s\S]*?\.from\('models'\)[\s\S]*?\.select\('\*'\)[\s\S]*?\.order\('name'\)/,
  'list() should not use a single unbounded Supabase select that caps at 1000 rows',
);

console.log('models service pagination static test ok');
