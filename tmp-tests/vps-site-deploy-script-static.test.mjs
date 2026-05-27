import fs from 'node:fs';
import assert from 'node:assert/strict';

const scriptPath = 'scripts/deploy-vps-site.cjs';
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

assert(fs.existsSync(scriptPath), 'scripts/deploy-vps-site.cjs should exist');

const script = fs.readFileSync(scriptPath, 'utf8');

assert(/VPS_SITE_HOST/.test(script), 'script should read VPS_SITE_HOST from env');
assert(/VPS_SITE_USER/.test(script), 'script should read VPS_SITE_USER from env');
assert(/VPS_SITE_PASSWORD/.test(script), 'script should read VPS_SITE_PASSWORD from env');
assert(/VPS_SITE_ROOT/.test(script), 'script should read VPS_SITE_ROOT from env');
assert(!/76\.13\.232\.162/.test(script), 'script must not hardcode VPS IP');
assert(!/@@@@/.test(script), 'script must not hardcode SSH password');
assert(/releases/.test(script), 'script should upload into a releases directory');
assert(/current/.test(script), 'script should maintain current symlink');
assert(/previous/.test(script), 'script should maintain previous symlink');
assert(/dist/.test(script), 'script should upload Vite dist output');
assert(/npm run build/.test(script), 'script should run npm run build before upload');
assert(/shell:\s*process\.platform\s*===\s*'win32'/.test(script), 'script should run npm.cmd through shell on Windows');
assert(/VPS_SITE_SKIP_BUILD/.test(script), 'script should allow skipping build after a separately validated build');
assert(/rollback/.test(script), 'script should document rollback command output');
assert(pkg.scripts['deploy:vps-site'] === 'node scripts/deploy-vps-site.cjs', 'package.json should expose deploy:vps-site');

console.log('vps site deploy script static checks ok');
