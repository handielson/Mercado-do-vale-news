import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/publicCompanySettings.ts', 'utf8');

assert.doesNotMatch(
  source,
  /USE_VPS\.company/,
  'publicCompanySettings must not branch back to Supabase based on USE_VPS.company',
);

assert.doesNotMatch(
  source,
  /from ['"]\.\/supabase['"]/,
  'publicCompanySettings must not dynamically import Supabase',
);

assert.doesNotMatch(
  source,
  /\.from\(['"]company_settings['"]\)/,
  'publicCompanySettings must not read company_settings through Supabase',
);

assert.match(
  source,
  /loadFromPublicVps/,
  'publicCompanySettings must keep using the public VPS route',
);

assert.match(
  source,
  /PUBLIC_COMPANY_SETTINGS_PATH = '\/public\/company-settings'/,
  'publicCompanySettings must read the public company settings route',
);

console.log('publicCompanySettings VPS-only static checks ok');
