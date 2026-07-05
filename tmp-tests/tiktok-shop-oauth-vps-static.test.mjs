import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['server.js', 'vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /dotenv'\)\.config\(\{ path: path\.join\(__dirname, '\.env\.tiktok\.local'\), override: false \}\)/, `${file} must optionally load local TikTok env without overriding production env`);
  assert.match(source, /async function handleTikTokShopOAuthAuthVps\(/, `${file} must expose TikTok Shop auth URL handler`);
  assert.match(source, /async function handleTikTokShopOAuthCallbackVps\(/, `${file} must expose TikTok Shop callback handler`);
  assert.match(source, /fastify\.get\('\/api\/tiktok-shop\/oauth\/auth', handleTikTokShopOAuthAuthVps\)/, `${file} must register TikTok auth URL route`);
  assert.match(source, /fastify\.get\('\/api\/tiktok-shop\/oauth\/callback', handleTikTokShopOAuthCallbackVps\)/, `${file} must register TikTok callback route`);
  assert.match(source, /verifyTikTokShopOAuthStateVps\(query\.state, settings\.appSecret\)/, `${file} must verify OAuth state`);
  assert.match(source, /grant_type', 'authorized_code'/, `${file} must use TikTok token grant_type authorized_code`);
  assert.match(source, /https:\/\/auth\.tiktok-shops\.com\/api\/v2\/token\/get/, `${file} must call the official TikTok Shop token endpoint`);
  assert.match(source, /tiktok_access_token/, `${file} must store TikTok access token metadata`);
  assert.match(source, /tiktok_refresh_token/, `${file} must store TikTok refresh token metadata`);
  assert.doesNotMatch(source, /console\.(?:log|warn|error)\([\s\S]{0,200}appSecret/, `${file} must not log TikTok app secret`);
  assert.doesNotMatch(source, /buildCopyableDebug\('tiktok/, `${file} must not create copyable debug payloads with TikTok secrets`);
}

const page = readFileSync('pages/admin/settings/TikTokShopPage.tsx', 'utf8');
assert.match(page, /fetch\('\/api\/tiktok-shop\/oauth\/auth'/, 'TikTokShopPage must start OAuth through the backend auth route');
assert.match(page, /Conectar com TikTok Shop/, 'TikTokShopPage must show a connect button');

console.log('TikTok Shop OAuth VPS static checks ok');
