import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('services/vpsApiService.ts', 'utf8');

assert.match(
  source,
  /function forcedProxyUrl\(path: string\): string \{[\s\S]*?\/api\/vps-proxy[\s\S]*?encodeURIComponent\(path\)/,
  'vpsApiService must have a forced relative proxy URL for fallback reads'
);

assert.match(
  source,
  /const urls = primaryUrl === fallbackUrl \? \[primaryUrl\] : \[primaryUrl, fallbackUrl\]/,
  'fetchSafe must try the normal URL and then the forced proxy URL'
);

assert.match(
  source,
  /console\.error\('\[vpsApiService\.fetchSafe\] GET failed'/,
  'fetchSafe must log diagnostic information when a VPS read fails'
);

assert.match(
  source,
  /status: res\.status[\s\S]*statusText: res\.statusText[\s\S]*body/,
  'fetchSafe diagnostics must include HTTP status and response body sample'
);

console.log('vps fetchSafe diagnostics regression passed');
