import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/companySettingsService.ts', 'utf8');

assert.doesNotMatch(
  source,
  /from ['"]\.\/supabase['"]/,
  'companySettingsService must not import Supabase for company_settings',
);

assert.doesNotMatch(
  source,
  /\.from\(['"]company_settings['"]\)/,
  'companySettingsService must not read/write company_settings through Supabase',
);

assert.doesNotMatch(
  source,
  /USE_VPS\.company/,
  'companySettingsService must be VPS-only instead of keeping a Supabase fallback branch',
);

assert.match(
  source,
  /vpsClient\.get<CompanySettings>\('\/company-settings'\)/,
  'companySettingsService.get must read company settings from the VPS',
);

assert.match(
  source,
  /vpsClient\.patch<CompanySettings>\('\/company-settings', settings\)/,
  'companySettingsService.update must write company settings to the VPS',
);

console.log('companySettingsService VPS-only static checks ok');
