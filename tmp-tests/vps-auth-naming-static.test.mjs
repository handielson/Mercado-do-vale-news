import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

assert.equal(existsSync('contexts/VpsAuthContext.tsx'), true, 'VPS auth context file should exist');
assert.equal(existsSync('hooks/useVpsAuth.ts'), true, 'VPS auth hook file should exist');
assert.equal(existsSync('components/VpsProtectedRoute.tsx'), true, 'VPS protected route file should exist');

for (const removedPath of [
  'contexts/SupabaseAuthContext.tsx',
  'hooks/useSupabaseAuth.ts',
  'components/SupabaseProtectedRoute.tsx',
]) {
  assert.equal(existsSync(removedPath), false, `${removedPath} should be removed after VPS auth rename`);
}

let matches = '';
try {
  matches = execFileSync(
    'rg',
    [
      '-n',
      'SupabaseAuth|useSupabaseAuth|SupabaseProtectedRoute|contexts/SupabaseAuthContext|hooks/useSupabaseAuth',
      'App.tsx',
      'contexts',
      'hooks',
      'components',
      'layouts',
      'pages',
      'routes',
    ],
    { encoding: 'utf8' },
  );
} catch (error) {
  if (error.status !== 1) throw error;
}

assert.equal(matches.trim(), '', 'admin and public UI should use VPS auth naming');

const app = readFileSync('App.tsx', 'utf8');
assert.match(app, /VpsAuthProvider/, 'App should mount the VPS auth provider');

console.log('VPS auth naming static checks passed');
