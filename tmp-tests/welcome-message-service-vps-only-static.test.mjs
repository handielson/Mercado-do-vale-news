import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const servicePath = 'services/welcomeMessageService.ts';

assert.ok(existsSync(servicePath), 'welcomeMessageService should exist');

const source = readFileSync(servicePath, 'utf8');

assert.doesNotMatch(
  source,
  /from ['"]\.\/supabase['"]/,
  'welcomeMessageService must not import Supabase',
);

assert.doesNotMatch(
  source,
  /supabase\.auth\.getUser\(\)/,
  'welcomeMessageService must not require Supabase auth for welcome template settings',
);

assert.doesNotMatch(
  source,
  /\.from\(['"]catalog_settings['"]\)/,
  'welcomeMessageService must not read or write catalog_settings through Supabase',
);

assert.match(
  source,
  /vpsApiService\.getCatalogSettings\(\)/,
  'welcomeMessageService should read welcome_message_template from VPS catalog settings',
);

assert.match(
  source,
  /vpsApiService\.syncCatalogSettings\(\{\s*welcome_message_template: template\s*\}\)/s,
  'welcomeMessageService should save welcome_message_template through VPS catalog settings',
);

console.log('welcome message service VPS-only static checks passed');
