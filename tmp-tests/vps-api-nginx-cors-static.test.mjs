import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const nginx = readFileSync('infra/nginx/mdv-api-ssl.conf', 'utf8');
const installer = readFileSync('scripts/install-vps-api-nginx.cjs', 'utf8');
const fullMethods = "Access-Control-Allow-Methods' 'GET, POST, PUT, PATCH, DELETE, OPTIONS";

assert.equal(
  nginx.split(fullMethods).length - 1,
  4,
  'HTTP and HTTPS preflight/response headers must expose every API method used by the application',
);
assert.match(nginx, /if \(\$request_method = OPTIONS\)[\s\S]*?return 204;/, 'preflight must terminate with 204');
assert.match(nginx, /Access-Control-Allow-Headers' 'Accept, Content-Type, Authorization, X-Sync-Key'/, 'authenticated JSON calls must be allowed');
assert.match(nginx, /\(mercadodovale\\\.com\\\.br\|xiaomipetrolina\\\.com\\\.br\)/, 'CORS must remain restricted to the approved domains');

assert.match(installer, /infra', 'nginx', 'mdv-api-ssl\.conf/, 'installer must use the versioned API config');
assert.match(installer, /CONFIRM_MDV_API_NGINX_INSTALL/, 'installer must require explicit confirmation');
assert.match(installer, /DRY_RUN/, 'installer must default to dry-run');
assert.match(installer, /backup\.\$\(date \+%Y%m%d%H%M%S\)/, 'installer must back up the active config');
assert.match(installer, /nginx -t/, 'installer must validate Nginx before reloading');
assert.match(installer, /systemctl reload nginx \|\| nginx -s reload/, 'installer must reload only after validation');
assert.doesNotMatch(installer, /password:\s*['"][^'"]+['"]/, 'installer must not hardcode credentials');

console.log('VPS API Nginx CORS checks passed');
