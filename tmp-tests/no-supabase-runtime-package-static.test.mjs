import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const packageJson = readFileSync('package.json', 'utf8');
assert.doesNotMatch(packageJson, /@supabase\/supabase-js/, 'runtime dependencies must not include the Supabase SDK');

const packageLock = readFileSync('package-lock.json', 'utf8');
assert.doesNotMatch(packageLock, /node_modules\/@supabase\/supabase-js/, 'package lock must not install the Supabase SDK');
assert.doesNotMatch(packageLock, /node_modules\/@supabase\/auth-js/, 'package lock must not install Supabase Auth');

const vpsProxyBase = readFileSync('services/vpsProxyBase.ts', 'utf8');
assert.doesNotMatch(vpsProxyBase, /const env = \([^)]*import\.meta[^)]*\)\.env/, 'VPS proxy config must not retain the whole import.meta.env object');

for (const retiredClient of ['services/supabase.ts', 'services/lazySupabase.ts']) {
  assert.equal(existsSync(retiredClient), false, `${retiredClient} must stay removed after the VPS auth cutover`);
}

const runtimeFiles = [
  'contexts',
  'components',
  'pages',
  'services',
  'hooks',
  'types',
];

console.log(`Supabase runtime package cutover static checks passed for ${runtimeFiles.join(', ')}`);
