import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const remote = readFileSync('tools/google-contacts-oauth-vps.cjs', 'utf8');
const tunnel = readFileSync('tmp-tests/google-contacts-oauth-vps-tunnel.cjs', 'utf8');
assert.match(remote, /GOOGLE_CONTACTS_REFRESH_TOKEN/, 'remote OAuth helper must update the VPS refresh token');
assert.match(remote, /fs\.writeFileSync\(ENV_FILE/, 'remote OAuth helper must keep the token on the VPS');
assert.doesNotMatch(remote, /console\.log\([^\n]*refreshToken/, 'remote OAuth helper must never print the refresh token');
assert.match(remote, /code_challenge_method', 'S256'/, 'remote OAuth helper must use PKCE');
assert.match(tunnel, /forwardOut[\s\S]*127\.0\.0\.1[\s\S]*LOCAL_PORT/, 'runner must use a local SSH tunnel');
assert.match(tunnel, /pm2 restart[\s\S]*--update-env/, 'runner must restart the API after installing the token');

console.log('Google Contacts VPS OAuth static checks passed');
