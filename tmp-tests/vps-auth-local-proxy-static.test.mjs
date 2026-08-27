import assert from 'node:assert/strict';
import fs from 'node:fs';

const service = fs.readFileSync('services/vpsAuthService.ts', 'utf8');

assert.match(service, /import \{ buildVpsUrl, VPS_DIRECT_BASE_URL \} from '\.\/vpsProxyBase'/);
assert.match(service, /function buildAuthRequestUrl\(path: string, method: string = 'GET'\)/);
assert.match(service, /return buildVpsUrl\(normalizedPath, \{ method \}\)/);
assert.match(service, /fetch\(buildAuthRequestUrl\(path, options\.method \|\| 'GET'\)/);
assert.match(service, /startGoogleSignIn[\s\S]{0,300}buildAuthUrl\('\/auth\/google\/start'\)/);
assert.match(service, /const compactSession: StoredVpsAuthSession = \{[\s\S]{0,120}token: session\.token,[\s\S]{0,80}user: session\.user/);
assert.match(service, /window\.sessionStorage\?\.setItem\(STORAGE_KEY, serializedSession\)/);
assert.doesNotMatch(service, /setItem\(STORAGE_KEY, JSON\.stringify\(session\)\)/);

console.log('vps-auth-local-proxy-static.test.mjs: ok');
