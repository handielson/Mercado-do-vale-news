import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['server.js', 'vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /dotenv'\)\.config\(\{ path: path\.join\(__dirname, '\.env\.tiktok\.local'\), override: false \}\)/, `${file} must optionally load local TikTok env without overriding production env`);
  assert.match(source, /async function handleTikTokShopOAuthAuthVps\(/, `${file} must expose TikTok Shop auth URL handler`);
  assert.match(source, /async function handleTikTokShopOAuthCallbackVps\(/, `${file} must expose TikTok Shop callback handler`);
  assert.match(source, /fastify\.get\('\/api\/tiktok-shop\/settings', \{ preHandler: requireSyncKeyOrAdmin \}/, `${file} must protect TikTok settings`);
  assert.match(source, /fastify\.patch\('\/api\/tiktok-shop\/settings', \{ preHandler: requireSyncKeyOrAdmin \}/, `${file} must protect TikTok settings updates`);
  assert.match(source, /fastify\.get\('\/api\/tiktok-shop\/oauth\/auth', \{ preHandler: requireSyncKeyOrAdmin \}/, `${file} must protect TikTok auth URL route`);
  assert.match(source, /fastify\.get\('\/api\/tiktok-shop\/oauth\/callback', handleTikTokShopOAuthCallbackVps\)/, `${file} must register TikTok callback route`);
  assert.match(source, /fastify\.get\('\/api\/tiktok-shop\/shops', \{ preHandler: requireSyncKeyOrAdmin \}/, `${file} must protect shop discovery`);
  assert.match(source, /verifyTikTokShopOAuthStateVps\(query\.state, settings\.appSecret\)/, `${file} must verify OAuth state`);
  assert.match(source, /tiktokShopOAuthStateNoncesVps\.delete\(nonce\)/, `${file} must consume OAuth state nonce`);
  assert.match(source, /grant_type', 'authorized_code'/, `${file} must use TikTok token grant_type authorized_code`);
  assert.match(source, /TIKTOK_SHOP_AUTH_API_ORIGIN.*https:\/\/auth\.tiktok-shops\.com/, `${file} must define the official auth API origin`);
  assert.match(source, /\/api\/v2\/token\/get/, `${file} must call the official TikTok Shop token endpoint`);
  assert.match(source, /\/api\/v2\/token\/refresh/, `${file} must support token refresh`);
  assert.match(source, /\/authorization\/202309\/shops/, `${file} must use the authorized shops endpoint`);
  assert.match(source, /'x-tts-access-token': authorized\.accessToken/, `${file} must send the access token header`);
  assert.match(source, /crypto\.createHmac\('sha256', appSecret\)/, `${file} must sign API requests with HMAC-SHA256`);
  assert.match(source, /async function callTikTokShopOpenApiVps\(/, `${file} must share a signed Open API client`);
  assert.match(source, /\/product\/202309\/products\/\$\{encodeURIComponent\(productId\)\}\/prices\/update/, `${file} must use the official update price endpoint`);
  assert.match(source, /fastify\.post\('\/api\/tiktok-shop\/products\/price', \{ preHandler: requireSyncKeyOrAdmin \}/, `${file} must protect price synchronization`);
  assert.match(source, /amount: \(amountCents \/ 100\)\.toFixed\(2\)/, `${file} must send a decimal price amount`);
  assert.match(source, /currency,/, `${file} must send the price currency`);
  assert.match(source, /delete safe\.tiktok_app_secret/, `${file} must redact the app secret`);
  assert.match(source, /delete safe\.tiktok_access_token/, `${file} must redact the access token`);
  assert.match(source, /delete safe\.tiktok_refresh_token/, `${file} must redact the refresh token`);
  assert.match(source, /delete safe\.tiktok_shop_cipher/, `${file} must redact the shop cipher`);
  assert.match(source, /tiktok_access_token/, `${file} must store TikTok access token metadata`);
  assert.match(source, /tiktok_refresh_token/, `${file} must store TikTok refresh token metadata`);
  assert.doesNotMatch(source, /console\.(?:log|warn|error)\([\s\S]{0,200}appSecret/, `${file} must not log TikTok app secret`);
  assert.doesNotMatch(source, /buildCopyableDebug\('tiktok/, `${file} must not create copyable debug payloads with TikTok secrets`);
}

const page = readFileSync('pages/admin/settings/TikTokShopPage.tsx', 'utf8');
assert.match(page, /tiktokShopService\.getAuthorizationUrl\(\)/, 'TikTokShopPage must start OAuth through the protected service');
assert.match(page, /Conectar com TikTok Shop/, 'TikTokShopPage must show a connect button');
assert.match(page, /Consultar lojas/, 'TikTokShopPage must expose authorized shop discovery');

console.log('TikTok Shop OAuth VPS static checks ok');
