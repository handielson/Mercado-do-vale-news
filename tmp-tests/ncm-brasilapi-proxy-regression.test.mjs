import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const widgetSource = readFileSync('components/admin/NcmSearchWidget.tsx', 'utf8');
<<<<<<< Updated upstream
const vpsProxySource = readFileSync('api/vps-proxy.ts', 'utf8');
const vercelConfig = readFileSync('vercel.json', 'utf8');
=======
const proxySource = readFileSync('api/vps-proxy.ts', 'utf8');
>>>>>>> Stashed changes

assert.match(
  widgetSource,
  /fetchNcmResults/,
  'NcmSearchWidget should use a shared same-origin fetch helper'
);

assert.doesNotMatch(
  widgetSource,
  /fetch\(`https:\/\/brasilapi\.com\.br\/api\/ncm\/v1/,
  'NcmSearchWidget must not fetch BrasilAPI directly from the browser'
);

assert.match(
<<<<<<< Updated upstream
  vercelConfig,
  /"source":\s*"\/api\/brasilapi-ncm"[\s\S]*"destination":\s*"\/api\/vps-proxy\?brasilapi=ncm"/,
  'BrasilAPI NCM route should be rewritten to an existing serverless function'
);

assert.match(vpsProxySource, /brasilapi\.com\.br\/api\/ncm\/v1/, 'proxy handler should call BrasilAPI NCM upstream');
assert.match(vpsProxySource, /s-maxage/, 'proxy handler should define edge cache headers');

const apiFunctionCount = readdirSync('api', { withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.(?:ts|js|mjs|cjs)$/u.test(entry.name))
  .length;
assert.ok(apiFunctionCount <= 12, `Vercel Hobby plan supports at most 12 functions, found ${apiFunctionCount}`);
=======
  widgetSource,
  /\/api\/vps-proxy\?path=\/brasilapi-ncm/,
  'NcmSearchWidget should reuse vps-proxy for BrasilAPI NCM search'
);

assert.equal(existsSync('api/brasilapi-ncm.ts'), false, 'BrasilAPI NCM should not be a standalone Vercel function');
assert.match(proxySource, /brasilapi\.com\.br\/api\/ncm\/v1/, 'vps-proxy should call BrasilAPI NCM upstream');
assert.match(proxySource, /s-maxage/, 'vps-proxy NCM branch should define edge cache headers');
>>>>>>> Stashed changes

console.log('NCM BrasilAPI proxy regression ok');
