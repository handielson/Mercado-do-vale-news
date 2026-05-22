import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /fastify\.(?:all|get)\('\/api\/bling'/, `${file} must expose /api/bling on Fastify`);
  assert.match(source, /fastify\.get\('\/api\/auth\/callback\/bling'/, `${file} must preserve the public Bling callback path`);
  assert.match(source, /async function\s+handleBlingApiVps\(/, `${file} must centralize Bling API routing`);
  assert.match(source, /async function\s+handleBlingOAuthCallbackVps\(/, `${file} must handle Bling OAuth callback`);
  assert.match(source, /resource === 'oauth-callback' \|\| query\?\.code/, `${file} must route oauth-callback and code query to the callback handler`);
  assert.match(source, /\/admin\/settings\/bling\?error=missing_code/, `${file} must redirect missing OAuth code safely`);
  assert.match(source, /select=id,bling_client_id,bling_client_secret,bling_callback_url/, `${file} must load Bling OAuth credentials from company_settings`);
  assert.match(source, /https:\/\/www\.bling\.com\.br\/Api\/v3\/oauth\/token/, `${file} must call the Bling token endpoint`);
  assert.match(source, /grant_type', 'authorization_code'/, `${file} must exchange OAuth authorization codes`);
  assert.match(source, /bling_access_token[\s\S]*bling_refresh_token[\s\S]*bling_token_expires_at/, `${file} must persist Bling tokens`);
  assert.match(source, /resource === 'exchange'/, `${file} must support the exchange resource`);
  assert.match(source, /grant_type', 'refresh_token'/, `${file} must support Bling refresh token exchange`);
  assert.match(source, /buildCopyableDebug\('bling-oauth'/, `${file} must return copyable debug for non-redirect exchange failures`);
  assert.doesNotMatch(source, /buildCopyableDebug\('bling-oauth'[\s\S]{0,250}(request\.body|body,|client_secret)/i, `${file} must not expose Bling request bodies or client secrets in debug payloads`);
}

console.log('vps Bling OAuth Fastify static checks ok');
