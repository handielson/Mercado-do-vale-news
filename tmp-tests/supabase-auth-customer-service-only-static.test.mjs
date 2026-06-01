import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('contexts/VpsAuthContext.tsx', 'utf8');

assert.doesNotMatch(
  source,
  /\.from\('customers'\)/,
  'VpsAuthContext must not read or write customers directly through the retired provider',
);

assert.match(
  source,
  /vpsAuthService\.getSession\(/,
  'auth context should restore the linked customer through VPS auth',
);

assert.match(
  source,
  /vpsAuthService\.createAccount\(/,
  'signup customer creation should go through VPS auth',
);

assert.match(
  source,
  /customerService\.update\(/,
  'profile, activation, and admin preview updates should go through the VPS customer service',
);

console.log('VpsAuthContext customer service only static checks passed');
