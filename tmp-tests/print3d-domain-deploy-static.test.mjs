import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync('apps/print3d/main.tsx', 'utf8');
const html = readFileSync('apps/print3d/index.html', 'utf8');
const vite = readFileSync('vite.print3d.config.ts', 'utf8');
const nginx = readFileSync('infra/nginx/print3d-site-production.conf', 'utf8');
const deploy = readFileSync('scripts/deploy-vps-site.cjs', 'utf8');
const nginxInstall = readFileSync('scripts/install-print3d-site-nginx.cjs', 'utf8');
const print3dDeploy = readFileSync('scripts/deploy-vps-print3d-site.cjs', 'utf8');

assert.match(main, /\/loja-3d\/produto\/:slug/);
assert.doesNotMatch(html, /noindex/i);
assert.match(html, /https:\/\/www\.gcode3d\.com\.br\/loja-3d/);
assert.match(vite, /VITE_PRINT3D_PUBLIC_ORIGIN/);
assert.match(nginx, /server_name 3dmv\.com\.br/);
assert.match(nginx, /server_name www\.gcode3d\.com\.br/);
assert.match(nginx, /server_name 3dmv\.com\.br www\.3dmv\.com\.br;[\s\S]*?return 301 https:\/\/www\.gcode3d\.com\.br\$request_uri/);
assert.match(nginx, /letsencrypt\/live\/gcode3d\.com\.br\/fullchain\.pem/);
assert.match(nginx, /root \/var\/www\/print3d-site\/current/);
assert.match(nginx, /api\/seo-produto-3d\?slug=\$1/);
assert.match(nginx, /location = \/robots\.txt/);
assert.match(nginx, /Sitemap: https:\/\/www\.gcode3d\.com\.br\/sitemap\.xml/);
assert.match(deploy, /dist-print3d/);
assert.match(deploy, /\/var\/www\/print3d-site/);
assert.match(print3dDeploy, /VPS_SITE_ROOT[\s\S]*\/var\/www\/print3d-site/);
assert.match(nginxInstall, /nginx -t/);
assert.match(nginxInstall, /print3d-site-production\.conf/);

for (const runtime of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(runtime, 'utf8');
  assert.match(source, /print3dDomain = \/\(\^\|\\\.\)gcode3d\\\.com\\\.br\$\/i/);
  assert.doesNotMatch(source,/3dmv\.com\.br|3dmv\\\.com\\\.br/);
  assert.match(source, /if \(print3dDomain\)[\s\S]*print3dProductUrls[\s\S]*send\(print3dXml\.trim\(\)\)/);
}
for (const file of ['apps/print3d/index.html','vite.print3d.config.ts','pages/store/Print3dAccountActionPage.tsx','pages/admin/print3d/Print3dSettingsPage.tsx','services/print3dStorefrontSettingsServer.cjs']) {
  assert.doesNotMatch(readFileSync(file,'utf8'),/3dmv\.com\.br/,`${file} must not depend on the retired hostname`);
  assert.match(readFileSync(file,'utf8'),/gcode3d\.com\.br/);
}

console.log('3D domain deploy static checks ok');
