import fs from 'node:fs';
import assert from 'node:assert/strict';

const configPath = 'infra/nginx/mdv-site-staging.conf';

assert(fs.existsSync(configPath), 'infra/nginx/mdv-site-staging.conf should exist');

const config = fs.readFileSync(configPath, 'utf8');

assert(/server_name\s+staging\.mercadodovale\.com\.br/.test(config), 'staging server_name should be documented');
assert(/root\s+\/var\/www\/mdv-site\/current/.test(config), 'Nginx root should point to VPS current symlink');
assert(/try_files\s+\$uri\s+\$uri\/\s+\/index\.html/.test(config), 'SPA fallback should route unknown paths to index.html');
assert(/location\s+\/assets\//.test(config), 'assets location should be configured');
assert(/max-age=31536000/.test(config), 'hashed assets should have long cache');
assert(/location\s+\/api\//.test(config), 'API proxy location should be configured');
assert(/location\s+=\s+\/api\/status/.test(config), '/api/status compatibility route should be configured before the generic API proxy');
assert(/proxy_pass\s+http:\/\/127\.0\.0\.1:4000\/status/.test(config), '/api/status should map to Fastify /status');
assert(/location\s+=\s+\/vps-proxy/.test(config), 'legacy /vps-proxy route should be reserved before SPA fallback');
assert(/proxy_pass\s+http:\/\/127\.0\.0\.1:4000\/api\/vps-proxy/.test(config), 'legacy /vps-proxy should proxy to Fastify /api/vps-proxy');
assert(/proxy_pass\s+http:\/\/127\.0\.0\.1:4000/.test(config), 'API proxy should target local Fastify port 4000');
assert(/client_max_body_size\s+500M/.test(config), 'large uploads should be allowed for later migrated routes');
assert(/location\s+=\s+\/sitemap\.xml/.test(config), 'sitemap route should be reserved before SPA fallback');
assert(/location\s+~\s+\^\/produto\/\(\[\^\/\]\+\)\$/.test(config), 'product SEO route should be reserved before SPA fallback');
assert(!/76\.13\.232\.162/.test(config), 'Nginx config should not hardcode VPS IP');
assert(!/@@@@/.test(config), 'Nginx config should not contain secrets');

console.log('vps nginx staging config static checks ok');
