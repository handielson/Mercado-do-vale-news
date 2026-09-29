import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../scripts/shopee-vps-tunnel.cjs', import.meta.url), 'utf8');

assert.match(source, /server\.listen\(localPort, '127\.0\.0\.1'/);
assert.match(source, /ssh\.forwardOut\('127\.0\.0\.1', 0, '127\.0\.0\.1', remotePort/);
assert.match(source, /VPS_SITE_PRIVATE_KEY/);
assert.match(source, /keepaliveInterval/);
assert.match(source, /MDV_VPS_API_PORT \|\| 4000/);
assert.match(source, /socket\.on\('error'/);
assert.doesNotMatch(source, /0\.0\.0\.0/);

console.log('shopee VPS tunnel static checks passed');
