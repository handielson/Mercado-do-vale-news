import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const sourcePath = 'utils/whatsappMessageGenerator.ts';

assert.ok(existsSync(sourcePath), 'whatsappMessageGenerator should exist');

const source = readFileSync(sourcePath, 'utf8');

assert.doesNotMatch(
  source,
  /@\/services\/supabase/,
  'WhatsApp message generator must not import Supabase just to read company phone',
);

assert.doesNotMatch(
  source,
  /\.from\(['"]company_settings['"]\)/,
  'WhatsApp message generator must not read company_settings through Supabase',
);

assert.match(
  source,
  /publicCompanySettingsService/,
  'WhatsApp message generator should use public company settings service',
);

assert.match(
  source,
  /publicCompanySettingsService\.get\(\)/,
  'generateWhatsAppLink should fetch company phone through public company settings',
);

console.log('WhatsApp message generator VPS company phone static checks passed');
