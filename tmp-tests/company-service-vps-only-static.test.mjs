import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/companyService.ts', 'utf8');

assert.doesNotMatch(
  source,
  /from ['"]\.\/supabase['"]/,
  'companyService must not import Supabase for company_settings',
);

assert.doesNotMatch(
  source,
  /\.from\(['"]company_settings['"]\)/,
  'companyService must not read/write company_settings through Supabase',
);

assert.doesNotMatch(
  source,
  /USE_VPS\.company/,
  'companyService must be VPS-only instead of keeping a Supabase fallback branch',
);

assert.match(
  source,
  /vpsClient\.get<any>\('\/company-settings'\)/,
  'getCompanyData must read company settings from the VPS',
);

assert.match(
  source,
  /vpsClient\.patch\('\/company-settings', row\)/,
  'saveCompanyData must write company settings to the VPS',
);

console.log('companyService VPS-only static checks ok');
