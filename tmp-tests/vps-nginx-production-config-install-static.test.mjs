import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = 'tmp-tests/vps-nginx-production-config-install.cjs';
const source = readFileSync(file, 'utf8');

assert.match(source, /infra\/nginx\/mdv-site-production\.conf/, 'installer must upload the production nginx config');
assert.match(source, /\.env\.vps\.local/, 'installer should load local VPS env values');
assert.match(source, /VPS_SITE_HOST/, 'installer must read VPS host from env');
assert.match(source, /VPS_SITE_USER/, 'installer must read VPS user from env');
assert.match(source, /VPS_SITE_PASSWORD|VPS_SITE_PRIVATE_KEY/, 'installer must use env-based SSH credentials');
assert.match(source, /CONFIRM_NGINX_PRODUCTION_INSTALL/, 'installer must require explicit confirmation');
assert.match(source, /I_UNDERSTAND_NGINX_PRODUCTION_INSTALL/, 'installer must use a deliberate confirmation phrase');
assert.match(source, /DRY_RUN/, 'installer must default to dry-run behavior');
assert.match(source, /sites-available\/mdv-site-production\.conf/, 'installer must install to sites-available');
assert.match(source, /sites-enabled\/mdv-site-production\.conf/, 'installer must enable the site');
assert.match(source, /nginx -t/, 'installer must test nginx before reload');
assert.match(source, /systemctl reload nginx|nginx -s reload/, 'installer must reload nginx after a successful test');
assert.match(source, /backup/, 'installer must create a remote backup before overwriting config');
assert.doesNotMatch(source, /76\.13\.232\.162.*@@@@|@@@@.*76\.13\.232\.162/, 'installer must not hardcode VPS credentials');
assert.doesNotMatch(source, /PASS\s*=\s*['"]|password:\s*['"][^'"]+['"]/, 'installer must not contain literal passwords');

console.log('vps nginx production config installer static checks ok');
