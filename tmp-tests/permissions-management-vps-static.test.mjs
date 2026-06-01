import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/admin/settings/PermissionsManagementPage.tsx', 'utf8');

assert.match(
  source,
  /import\s+\{\s*vpsClient\s+\}\s+from\s+['"]\.\.\/\.\.\/\.\.\/services\/vpsClient['"]/,
  'permissions page should use vpsClient for table-data access',
);

assert.match(
  source,
  /\/table-data\/user_permissions/,
  'permissions page should load and mutate user_permissions through VPS table-data',
);

assert.match(
  source,
  /\/table-data\/user_permissions\/bulk/,
  'permissions page should save permissions through VPS bulk insert',
);

assert.doesNotMatch(
  source,
  /from\(['"]user_permissions['"]\)/,
  'permissions page must not read or mutate user_permissions directly through Supabase',
);

console.log('permissions management VPS static checks passed');
