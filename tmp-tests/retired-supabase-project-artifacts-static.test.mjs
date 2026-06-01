import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const retiredPaths = [
  'supabase',
  'tools/migrate-stock-locations-supabase-to-vps.cjs',
  'check-db.mjs',
  'checkDb.ts',
  'check_db.mjs',
  'check_name.ts',
  'check_p3dp.ts',
  'check_product.ts',
  'check_stock.ts',
  'create_shopee_products.mjs',
  'debug-group.cjs',
  'debug2.cjs',
  'delete-empty-sku.cjs',
  'delete-null-sku.mjs',
  'delete_orders.js',
  'delete_orders.ts',
  'diagnose_shipping.js',
  'diagnostico-vps.cjs',
  'fetchTest.cjs',
  'find-null-skus.mjs',
  'fix-missing-skus.cjs',
  'fix-null-slugs.cjs',
  'fix-rls.mjs',
  'fix-rls.ts',
  'fix_vps_products.cjs',
  'full_sync.ts',
  'listar-orfaos-bling.cjs',
  'migrate-categories-to-vps.cjs',
  'migrate-products-to-vps.cjs',
  'migrate-products-to-vps.js',
  'query.cjs',
  'queryCompany.cjs',
  'queryDB.cjs',
  'queryFinal.cjs',
  'queryPocoM3.cjs',
  'queryPocoM3.mjs',
  'querySettings.cjs',
  'queryValid.cjs',
  'recuperar-orfaos-bling.cjs',
];

for (const retiredPath of retiredPaths) {
  assert.equal(
    existsSync(retiredPath),
    false,
    `${retiredPath} should be removed after the VPS cutover because it can run against Supabase directly`,
  );
}

const scanRoots = ['.', 'scripts', 'tools'];
const forbidden = /@supabase\/supabase-js|SUPABASE_|VITE_SUPABASE|supabase\.co|\/rest\/v1|supabaseRest/i;
const allowedFiles = new Set([
  'tmp-tests/retired-supabase-project-artifacts-static.test.mjs',
]);

function walk(dir) {
  if (!existsSync(dir)) return [];
  const entries = [];
  for (const item of readdirSync(dir)) {
    if (['.git', '.worktrees', 'dist', 'node_modules', 'reports', 'tmp-tests'].includes(item)) continue;
    const path = join(dir, item).replace(/\\/g, '/');
    const stat = statSync(path);
    if (stat.isDirectory()) entries.push(...walk(path));
    else entries.push(path.replace(/^\.\//, ''));
  }
  return entries;
}

const offenders = [];
for (const root of scanRoots) {
  for (const file of walk(root)) {
    if (allowedFiles.has(file)) continue;
    if (!/\.(cjs|mjs|js|ts|tsx|json|bat|sql)$/.test(file)) continue;
    const source = readFileSync(file, 'utf8');
    if (forbidden.test(source)) offenders.push(file);
  }
}

assert.deepEqual(offenders.sort(), [], 'executable project artifacts should not keep Supabase runtime hooks');

console.log('retired Supabase project artifacts static checks passed');
