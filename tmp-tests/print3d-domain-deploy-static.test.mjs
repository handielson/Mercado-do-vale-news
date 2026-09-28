import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync('apps/print3d/main.tsx', 'utf8');
const html = readFileSync('apps/print3d/index.html', 'utf8');
const vite = readFileSync('vite.print3d.config.ts', 'utf8');
const nginx = readFileSync('infra/nginx/print3d-site-production.conf', 'utf8');
const deploy = readFileSync('scripts/deploy-vps-site.cjs', 'utf8');
const nginxInstall = readFileSync('scripts/install-print3d-site-nginx.cjs', 'utf8');

assert.match(main, /\/loja-3d\/produto\/:slug/);
assert.doesNotMatch(html, /noindex/i);
assert.match(html, /https:\/\/www\.3dmv\.com\.br\/loja-3d/);
assert.match(vite, /VITE_PRINT3D_PUBLIC_ORIGIN/);
assert.match(nginx, /server_name 3dmv\.com\.br/);
assert.match(nginx, /server_name www\.3dmv\.com\.br/);
assert.match(nginx, /root \/var\/www\/print3d-site\/current/);
assert.match(nginx, /api\/seo-produto-3d\?slug=\$1/);
assert.match(deploy, /dist-print3d/);
assert.match(deploy, /\/var\/www\/print3d-site/);
assert.match(nginxInstall, /nginx -t/);
assert.match(nginxInstall, /print3d-site-production\.conf/);

console.log('3D domain deploy static checks ok');
