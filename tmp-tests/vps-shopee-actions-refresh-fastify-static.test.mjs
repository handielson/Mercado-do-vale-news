import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /fastify\.all\('\/api\/shopee-actions', handleShopeeActionsVps\)/, `${file} must expose /api/shopee-actions through Fastify`);
  assert.match(source, /case 'refresh_token'/, `${file} must support explicit Shopee token refresh action`);
  assert.match(source, /refreshShopeeCatalogTokenVps\(creds\)/, `${file} must reuse central Shopee refresh helper`);
  assert.match(source, /success: true/, `${file} must preserve successful refresh response shape`);
  assert.match(source, /access_token: refreshedCreds\.accessToken/, `${file} must return refreshed access_token for frontend compatibility`);
  assert.match(source, /shopee_refresh_token: tokenData\.refresh_token/, `${file} must persist refresh token returned by Shopee`);
  assert.match(source, /\/api\/v2\/auth\/access_token\/get/, `${file} must call Shopee access_token refresh endpoint`);

  const debugPayloads = source.match(/buildCopyableDebug\('shopee-actions',\s*(?:\{[\s\S]*?\n\s*\}|[^)]*)\)/g) || [];
  assert.ok(debugPayloads.length > 0, `${file} must include scoped Shopee actions debug payloads`);
  for (const payload of debugPayloads) {
    assert.doesNotMatch(payload, /\b(access_token|refresh_token|partner_key|authorization|client_secret)\b/i, `${file} must not expose Shopee secrets in actions debug payloads`);
  }
}

console.log('vps Shopee actions refresh Fastify static checks ok');
