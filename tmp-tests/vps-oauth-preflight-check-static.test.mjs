import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = 'tmp-tests/vps-oauth-preflight-check.cjs';
const source = readFileSync(file, 'utf8');

assert.match(source, /https:\/\/api\.xiaomipetrolina\.com\.br/, 'script must default to the public VPS API base URL');
assert.match(source, /OAUTH_PREFLIGHT_LIVE/, 'script must require an explicit live-read flag');
assert.match(source, /\/api\/auth\/callback\/bling/, 'script must validate Bling callback path');
assert.match(source, /\/api\/bling\?resource=exchange/, 'script must validate Bling exchange validation path');
assert.match(source, /\/api\/shopee\?action=callback/, 'script must validate Shopee callback validation path');
assert.match(source, /\/api\/shopee\?action=auth/, 'script must validate Shopee auth URL generation path');
assert.match(source, /sanitizeOAuthPreflightResult/, 'script must sanitize OAuth preflight results');
assert.match(source, /has_auth_url/, 'script must report auth URL presence without printing it');
assert.match(source, /auth_host/, 'script must report only auth URL host');
assert.match(source, /live_read:\s*false/, 'script must report no live read for skipped/dry-run paths');
assert.doesNotMatch(source, /code=REAL|shop_id=REAL|client_secret|access_token|refresh_token|partner_key/i, 'script must not embed or print OAuth secrets/tokens');
assert.doesNotMatch(source, /method:\s*'POST'[\s\S]*token\/get|auth\/token\/get/, 'script must not exchange real OAuth codes');

console.log('vps OAuth preflight static checks ok');
