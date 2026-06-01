import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pageSource = readFileSync('pages/admin/settings/BlingPage.tsx', 'utf8');
const callbackSource = readFileSync('pages/admin/settings/BlingCallbackPage.tsx', 'utf8');
const serviceSource = readFileSync('services/blingService.ts', 'utf8');

for (const [label, source] of [
  ['BlingPage', pageSource],
  ['BlingCallbackPage', callbackSource],
  ['blingService', serviceSource],
]) {
  assert.doesNotMatch(
    source,
    /\.from\(['"]company_settings['"]\)/,
    `${label} must not read or write company_settings through Supabase`,
  );
}

assert.match(
  pageSource,
  /companySettingsService\.get\(\)/,
  'BlingPage must load Bling credentials through VPS company settings',
);

assert.match(
  pageSource,
  /companySettingsService\.update\(/,
  'BlingPage must save Bling credentials through VPS company settings',
);

assert.match(
  pageSource,
  /\/api\/auth\/callback\/bling/,
  'BlingPage must present the public VPS Bling OAuth callback URL',
);

assert.doesNotMatch(
  pageSource,
  /\/admin\/settings\/bling\/callback/,
  'BlingPage must not suggest the protected legacy admin callback URL for Bling',
);

assert.match(
  callbackSource,
  /companySettingsService\.get\(\)/,
  'BlingCallbackPage must load Bling credentials through VPS company settings',
);

assert.match(
  callbackSource,
  /companySettingsService\.update\(/,
  'BlingCallbackPage must save Bling tokens through VPS company settings',
);

assert.doesNotMatch(
  callbackSource,
  /\/admin\/settings\/bling\/callback/,
  'BlingCallbackPage fallback must not use the protected legacy admin callback URL',
);

assert.match(
  serviceSource,
  /companySettingsService\.get\(\)/,
  'blingService must load Bling tokens through VPS company settings',
);

assert.match(
  serviceSource,
  /companySettingsService\.update\(/,
  'blingService must persist refreshed Bling tokens through VPS company settings',
);

console.log('Bling company settings VPS static checks ok');
