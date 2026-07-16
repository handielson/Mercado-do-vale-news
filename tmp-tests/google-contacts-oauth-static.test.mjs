import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('tools/google-contacts-oauth.cjs', 'utf8');

assert.match(source, /https:\/\/www\.googleapis\.com\/auth\/contacts/, 'OAuth script must request Google Contacts scope');
assert.match(source, /access_type', 'offline'/, 'OAuth script must request offline access');
assert.match(source, /prompt', 'consent'/, 'OAuth script must force consent so a refresh token is returned');
assert.match(source, /code_challenge_method', 'S256'/, 'OAuth script must use PKCE S256');
assert.match(source, /http:\/\/127\.0\.0\.1:\$\{PORT\}\/oauth2callback/, 'OAuth script must use loopback redirect');
assert.match(source, /refreshToken/, 'OAuth script must capture the refresh token for secure installation');
assert.match(source, /GOOGLE_CONTACTS_OAUTH_OUTPUT/, 'OAuth script must support secret-safe token output');
assert.match(source, /fs\.writeFileSync\(OUTPUT_FILE/, 'OAuth script must persist the token without printing it');
assert.doesNotMatch(source, /console\.log\(`GOOGLE_CONTACTS_REFRESH_TOKEN=\$\{refreshToken\}`\)/, 'OAuth script must not print the refresh token');

console.log('google contacts oauth static checks passed');
