import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = 'tmp-tests/vps-staging-frontend-proxy-check.cjs';
const source = readFileSync(file, 'utf8');

assert.match(source, /http:\/\/76\.13\.232\.162/, 'script must default to the VPS public IP');
assert.match(source, /staging\.mercadodovale\.com\.br/, 'script must send the staging Host header');
assert.match(source, /STAGING_FRONTEND_PROXY_LIVE/, 'script must require an explicit live-read flag');
assert.match(source, /\/admin\/products/, 'script must validate the admin SPA fallback route');
assert.match(source, /\/api\/vps-proxy\?path=%2Fstatus/, 'script must validate vps-proxy status path');
assert.match(source, /\/api\/vps-proxy\?path=%2Fproducts%3Flimit%3D1/, 'script must validate product read through vps-proxy');
assert.match(source, /\/api\/vps-proxy\?path=%2Fcompany-settings/, 'script must validate protected settings remain blocked without session');
assert.match(source, /expected_status/, 'script must report expected statuses');
assert.match(source, /live_read:\s*false/, 'script must report no live read for skipped/dry-run paths');
assert.doesNotMatch(source, /method:\s*'POST'|method:\s*"POST"/, 'script must never use POST');
assert.doesNotMatch(source, /headers:\s*\{[^}]*Authorization|process\.env\.[A-Z0-9_]*(?:TOKEN|SYNC|SECRET|PASSWORD)/s, 'script must not use secrets or auth headers');

console.log('vps staging frontend/proxy static checks ok');
