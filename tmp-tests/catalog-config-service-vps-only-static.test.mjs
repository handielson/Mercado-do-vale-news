import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const servicePath = 'services/catalogConfigService.ts';
const apiPath = 'services/vpsApiService.ts';
const serverPath = 'vps_server.js';
const serverCjsPath = 'vps_server.cjs';

for (const path of [servicePath, apiPath, serverPath, serverCjsPath]) {
  assert.ok(existsSync(path), `${path} should exist`);
}

const serviceSource = readFileSync(servicePath, 'utf8');
const apiSource = readFileSync(apiPath, 'utf8');
const serverSource = readFileSync(serverPath, 'utf8');
const serverCjsSource = readFileSync(serverCjsPath, 'utf8');

assert.doesNotMatch(
  serviceSource,
  /\.from\(['"]catalog_settings['"]\)/,
  'catalogConfigService must not read or write catalog_settings through Supabase',
);

assert.doesNotMatch(
  serviceSource,
  /supabase\.auth\.getUser\(\)/,
  'catalogConfigService.saveSettings must not require Supabase auth for catalog settings writes',
);

assert.match(
  serviceSource,
  /vpsApiService\.getCatalogSettings\(\)/,
  'catalogConfigService.getSettings should read catalog settings from the VPS API',
);

assert.match(
  serviceSource,
  /vpsApiService\.syncCatalogSettings\(/,
  'catalogConfigService.saveSettings should write catalog settings through the VPS API',
);

assert.match(
  apiSource,
  /async syncCatalogSettings\(settings: any\): Promise<boolean>/,
  'vpsApiService should expose a catalog settings write helper',
);

assert.match(
  apiSource,
  /writeSafe\('PATCH', '\/catalog-settings', settings\)/,
  'catalog settings write helper should PATCH /catalog-settings',
);

for (const [path, source] of [[serverPath, serverSource], [serverCjsPath, serverCjsSource]]) {
  assert.match(
    source,
    /fastify\.patch\('\/catalog-settings', \{ preHandler: requireSyncKey \}/,
    `${path} should expose authenticated PATCH /catalog-settings`,
  );

  assert.match(
    source,
    /DESCRIBE catalog_settings/,
    `${path} should discover catalog_settings columns before writing`,
  );
}

console.log('catalog config service VPS-only static checks passed');
