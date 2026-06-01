import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const legacyApi = readFileSync('services/legacyAPI.ts', 'utf8');
const server = readFileSync('vps_server.cjs', 'utf8');

assert.doesNotMatch(
  legacyApi,
  /SUPABASE|supabase\.co|apikey|Authorization.*Bearer|\/rest\/v1/i,
  'legacyAPI must not keep Supabase URL/key or REST headers after the VPS cutover',
);

assert.match(
  legacyApi,
  /from ['"]\.\/vpsClient['"]/,
  'legacyAPI should load legacy rows through the VPS client',
);

assert.match(
  legacyApi,
  /\/legacy\/\$\{resource\}/,
  'legacyAPI should build requests against the VPS legacy endpoint',
);

assert.match(
  legacyApi,
  /requestRows<LegacyCustomer>\('customers'/,
  'legacyAPI customers must come from the VPS legacy customers resource',
);

assert.match(
  legacyApi,
  /requestRows<LegacySale>\('sales'/,
  'legacyAPI sales must come from the VPS legacy sales resource',
);

assert.match(
  server,
  /fastify\.get\('\/legacy\/:resource'/,
  'VPS server must expose a protected legacy data endpoint',
);

assert.match(
  server,
  /legacy_customers|legacy_phones|legacy_sales/,
  'VPS server legacy endpoint should default to local legacy tables',
);

console.log('legacy API VPS-only static checks passed');
