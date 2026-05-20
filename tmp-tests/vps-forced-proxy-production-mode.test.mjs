import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('services/vpsApiService.ts', 'utf8');

assert.match(
  source,
  /env\.MODE\s*===\s*['"]production['"]/,
  'forcedProxyUrl must treat MODE=production as production even when env.DEV is stale'
);

assert.doesNotMatch(
  source,
  /const proxyBase = env\.DEV \? '\/vps-proxy' : '\/api\/vps-proxy'/,
  'forcedProxyUrl must not route production fallbacks to the dev proxy just because env.DEV is true'
);

console.log('vps forced proxy production mode regression passed');
