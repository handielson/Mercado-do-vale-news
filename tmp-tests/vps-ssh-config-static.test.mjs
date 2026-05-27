import assert from 'node:assert/strict';
import fs from 'node:fs';

const deploy = fs.readFileSync('deploy.cjs', 'utf8');
const helper = fs.readFileSync('tmp-tests/vps-ssh-config.cjs', 'utf8');

assert.match(deploy, /VPS_SITE_HOST|VPS_HOST/, 'legacy deploy must read VPS host from env');
assert.match(deploy, /VPS_SITE_USER|VPS_USER/, 'legacy deploy must read VPS user from env');
assert.match(deploy, /VPS_SITE_PASSWORD|VPS_ROOT_PASSWORD|VPS_PASSWORD|VPS_SITE_PRIVATE_KEY/, 'legacy deploy must read VPS credentials from env');
assert.doesNotMatch(deploy, /const Vps(?:Host|User|Pass) = '[^']+'/i, 'legacy deploy must not hardcode VPS const values');
assert.doesNotMatch(deploy, /@@@@|76\.13\.232\.162/, 'legacy deploy must not contain the old literal VPS secret tuple');

assert.match(helper, /\.env\.vps\.local/, 'shared helper must load local ignored VPS env file');
assert.match(helper, /readLegacyVpsConst/, 'shared helper must preserve old script call sites during migration');
assert.doesNotMatch(helper, /@@@@|76\.13\.232\.162/, 'shared helper must not hardcode VPS credentials');

console.log('vps ssh config static checks ok');
