import fs from 'node:fs';
import assert from 'node:assert/strict';

const configPath = 'infra/nginx/mdv-site-production.conf';

assert(fs.existsSync(configPath), 'infra/nginx/mdv-site-production.conf should exist');

const config = fs.readFileSync(configPath, 'utf8');

assert(/server_name\s+mercadodovale\.com\.br/.test(config), 'root production host should be documented');
assert(/server_name\s+www\.mercadodovale\.com\.br/.test(config), 'www production host should be documented');
assert(/return\s+301\s+https:\/\/www\.mercadodovale\.com\.br\$request_uri/.test(config), 'root host should redirect to canonical www host');
assert(/listen\s+443\s+ssl/.test(config), 'production hosts must handle Cloudflare origin HTTPS on port 443');
assert(/ssl_certificate\s+\/etc\/letsencrypt\/live\/api\.xiaomipetrolina\.com\.br\/fullchain\.pem/.test(config), 'temporary origin SSL certificate should be configured until a dedicated site cert exists');
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
assert(/proxy_set_header\s+Host\s+\$host/.test(config), 'Fastify must receive the production Host header for canonicals');
assert(/proxy_set_header\s+X-Forwarded-Proto\s+\$scheme/.test(config), 'Fastify must receive forwarded protocol');
assert(!/staging\.mercadodovale\.com\.br/.test(config), 'production config must not reuse staging hostname');
assert(!/76\.13\.232\.162/.test(config), 'Nginx config should not hardcode VPS IP');
assert(!/@@@@/.test(config), 'Nginx config should not contain secrets');

console.log('vps nginx production config static checks ok');
