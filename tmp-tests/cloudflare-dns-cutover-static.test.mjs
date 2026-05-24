import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('tools/cloudflare-dns-cutover.mjs', 'utf8');

assert.match(source, /api\.cloudflare\.com\/client\/v4/, 'script must use Cloudflare v4 API');
assert.match(source, /CLOUDFLARE_API_TOKEN/, 'script must require a Cloudflare API token');
assert.match(source, /mercadodovale\.com\.br/, 'script must target the Mercado do Vale zone');
assert.match(source, /76\.13\.232\.162/, 'script must target the VPS IP');
assert.match(source, /APPLY_CLOUDFLARE_DNS_CUTOVER/, 'script must default to dry-run and require explicit apply');
assert.match(source, /I_UNDERSTAND_DNS_CUTOVER/, 'script must require deliberate confirmation');
assert.match(source, /cloudflare-dns-before-/, 'script must save a before-change backup report');
assert.match(source, /type:\s*'A'[\s\S]*content:\s*VPS_IP/, 'script must plan apex A record to VPS IP');
assert.match(source, /type:\s*'CNAME'[\s\S]*content:\s*ZONE_NAME/, 'script must plan www CNAME to apex');
assert.doesNotMatch(source, /Bearer\s+[A-Za-z0-9_-]{20,}/, 'script must not contain literal bearer tokens');
assert.doesNotMatch(source, /password\s*[:=]\s*['"][^'"]+['"]/i, 'script must not contain literal passwords');

console.log('cloudflare dns cutover static checks ok');
