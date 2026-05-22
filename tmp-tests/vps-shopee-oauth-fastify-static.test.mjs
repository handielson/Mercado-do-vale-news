import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /fastify\.all\('\/api\/shopee', handleShopeeOAuthVps\)/, `${file} must expose /api/shopee through Fastify`);
  assert.match(source, /function getShopeeBaseUrlVps/, `${file} must choose Shopee sandbox/live base URL`);
  assert.match(source, /partner\.test-stable\.shopeemobile\.com/, `${file} must preserve Shopee sandbox URL`);
  assert.match(source, /partner\.shopeemobile\.com/, `${file} must preserve Shopee live URL`);
  assert.match(source, /function generateShopeePublicSignVps/, `${file} must generate Shopee public HMAC signatures`);
  assert.match(source, /crypto\.createHmac\('sha256', partnerKey\)/, `${file} must sign Shopee requests with SHA256 HMAC`);
  assert.match(source, /buildShopeeCallbackUrlVps/, `${file} must build Shopee callback URL on VPS`);
  assert.match(source, /\/api\/shopee\?action=callback/, `${file} must keep the callback path stable`);

  assert.match(source, /action === 'auth'/, `${file} must support Shopee auth action`);
  assert.match(source, /select=shopee_partner_id,shopee_partner_key&limit=1/, `${file} must load Shopee OAuth credentials from Supabase`);
  assert.match(source, /Shopee Partner ID e Key/, `${file} must validate missing Shopee credentials`);
  assert.match(source, /\/api\/v2\/shop\/auth_partner/, `${file} must generate Shopee auth_partner URL`);
  assert.match(source, /redirect=\$\{encodeURIComponent\(redirectUrl\)\}/, `${file} must include encoded callback redirect`);

  assert.match(source, /action === 'callback'/, `${file} must support Shopee callback action`);
  assert.match(source, /Parâmetros ausentes \(code, shop_id\)/, `${file} must validate missing callback parameters`);
  assert.match(source, /select=id,shopee_partner_id,shopee_partner_key&limit=1/, `${file} must load settings row for callback`);
  assert.match(source, /\/api\/v2\/auth\/token\/get/, `${file} must exchange callback code for token`);
  assert.match(source, /shopee_shop_id: activeShopId\.toString\(\)/, `${file} must store Shopee shop id`);
  assert.match(source, /shopee_access_token: tokenData\.access_token/, `${file} must store Shopee access token`);
  assert.match(source, /shopee_refresh_token: tokenData\.refresh_token/, `${file} must store Shopee refresh token`);
  assert.match(source, /\/admin\/settings\/shopee/, `${file} must redirect user back to Shopee settings`);
  assert.match(source, /Route not found or missing action/, `${file} must preserve unknown action response`);
  assert.match(source, /buildCopyableDebug\('shopee-oauth'/, `${file} must return copyable debug details for Shopee OAuth failures`);

  const debugPayloads = source.match(/buildCopyableDebug\('shopee-oauth',\s*(?:\{[\s\S]*?\n\s*\}|[^)]*)\)/g) || [];
  assert.ok(debugPayloads.length > 0, `${file} must include scoped Shopee OAuth debug payloads`);
  for (const payload of debugPayloads) {
    assert.doesNotMatch(payload, /\b(access_token|refresh_token|partner_key|authorization|client_secret)\b/i, `${file} must not expose Shopee secrets in OAuth debug payloads`);
  }
}

console.log('vps Shopee OAuth Fastify static checks ok');
