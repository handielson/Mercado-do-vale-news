import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const widgetSource = readFileSync('components/admin/NcmSearchWidget.tsx', 'utf8');
const vpsServerSource = readFileSync('vps_server.cjs', 'utf8');

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
  widgetSource,
  /\/api\/vps-proxy\?path=\/brasilapi-ncm&search=/,
  'NcmSearchWidget should call the VPS proxy path for BrasilAPI NCM'
);

assert.equal(existsSync('vercel.json'), false, 'NCM proxy should not depend on Vercel rewrites');
assert.equal(existsSync('api'), false, 'NCM proxy should not depend on serverless api/ files');
assert.match(vpsServerSource, /BRASILAPI_NCM_URL = 'https:\/\/brasilapi\.com\.br\/api\/ncm\/v1'/, 'VPS handler should call BrasilAPI NCM upstream');
assert.match(vpsServerSource, /fastify\.get\('\/api\/brasilapi-ncm', handleBrasilapiNcmProxy\)/, 'VPS should expose /api/brasilapi-ncm directly');
assert.match(vpsServerSource, /s-maxage/, 'VPS handler should define cache headers');

console.log('NCM BrasilAPI VPS proxy regression ok');
