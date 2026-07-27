import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const vpsClient = readFileSync('services/vpsClient.ts', 'utf8');
const vpsServer = readFileSync('vps_server.js', 'utf8');

const buildHeadersBlock = vpsClient.match(/async function buildHeaders[\s\S]*?\n}/)?.[0] || '';

assert.ok(buildHeadersBlock, 'vpsClient must keep a centralized header builder');
assert.doesNotMatch(
  buildHeadersBlock,
  /X-MDV-Client/i,
  'public VPS reads must not send the device marker globally because it triggers a CORS preflight unsupported by production',
);
assert.match(
  vpsServer,
  /req\.headers\['x-mdv-client'\]\s*\|\|\s*'web'/,
  'stock transfers must continue to classify browser requests as web when the optional device header is absent',
);

console.log('VPS public payment-fees CORS regression checks passed');
