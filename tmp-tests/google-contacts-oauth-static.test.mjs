import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync('tools/google-contacts-oauth.cjs', 'utf8');

assert.match(source, /https:\/\/www\.googleapis\.com\/auth\/contacts/, 'OAuth script must request Google Contacts scope');
assert.match(source, /https:\/\/www\.googleapis\.com\/auth\/contacts\.other\.readonly/, 'OAuth script must request Other Contacts read scope');
assert.match(source, /access_type', 'offline'/, 'OAuth script must request offline access');
assert.match(source, /prompt', 'consent'/, 'OAuth script must force consent so a refresh token is returned');
assert.match(source, /code_challenge_method', 'S256'/, 'OAuth script must use PKCE S256');
assert.match(source, /http:\/\/127\.0\.0\.1:\$\{PORT\}\/oauth2callback/, 'OAuth script must use loopback redirect');
assert.match(source, /GOOGLE_CONTACTS_REFRESH_TOKEN/, 'OAuth script must print the VPS refresh token variable');

console.log('google contacts oauth static checks passed');
