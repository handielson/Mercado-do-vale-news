import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('contexts/AuthContext.tsx', 'utf8');

assert.doesNotMatch(
  source,
  /\.from\('customers'\)/,
  'legacy AuthContext must not read customers directly from Supabase',
);

assert.match(
  source,
  /useVpsAuth/,
  'legacy AuthContext should delegate to the shared VPS auth context',
);

assert.match(
  source,
  /logout: signOut/,
  'legacy AuthContext should expose VPS signOut as logout',
);

console.log('auth context VPS customer static checks passed');
