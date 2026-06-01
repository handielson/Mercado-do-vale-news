import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/catalog/CoinsInfoPage.tsx', 'utf8');

assert.doesNotMatch(
  source,
  /services\/supabase|supabase\.from\('customers'\)|supabase\.auth\.getUser\(\)/,
  'CoinsInfoPage must not query Supabase customers directly for referral code',
);

assert.match(
  source,
  /useSupabaseAuth/,
  'CoinsInfoPage should reuse the already loaded auth customer context',
);

assert.match(
  source,
  /customer\?\.referral_code/,
  'CoinsInfoPage should read referral_code from the customer context',
);

console.log('coins info page customer context static checks passed');
