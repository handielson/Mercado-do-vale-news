import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const script = readFileSync('scripts/publish-vps-plan.cjs', 'utf8');

assert.match(script, /git status --short/, 'Plan must inspect the short git status.');
assert.match(script, /git diff --name-only/, 'Plan must inspect tracked changed files.');
assert.match(script, /git ls-files --others --exclude-standard/, 'Plan must inspect untracked files.');

assert.match(script, /public\/VERSION\.json/, 'Plan must include VERSION.json versioning guidance.');
assert.match(script, /VERSAO_ATUAL\.md/, 'Plan must include VERSAO_ATUAL.md versioning guidance.');
assert.match(script, /docs\/versoes/, 'Plan must include release notes guidance.');
assert.match(script, /VPS_SITE_RELEASE_NAME/, 'Plan must suggest a fixed VPS site release name.');

assert.match(script, /deploy:vps-site/, 'Plan must suggest the site deploy command when needed.');
assert.match(script, /deploy-vps-server-only\.cjs/, 'Plan must suggest the API deploy command when needed.');
assert.match(script, /vps_server\.js/, 'Plan must know the main API server file.');
assert.match(script, /pages\//, 'Plan must know frontend page paths.');

assert.doesNotMatch(script, /git add \./, 'Plan must never suggest git add .');

const selfTestOutput = execFileSync(process.execPath, ['scripts/publish-vps-plan.cjs', '--self-test'], {
  encoding: 'utf8',
});

assert.match(selfTestOutput, /self-test passed/, 'Plan script self-test must pass.');

const jsonOutput = execFileSync(process.execPath, [
  'scripts/publish-vps-plan.cjs',
  '--json',
  '--mock-files',
  'pages/admin/settings/ShopeePage.tsx,vps_server.js,public/VERSION.json',
  '--slug',
  'shopee-sync',
], {
  encoding: 'utf8',
});

const plan = JSON.parse(jsonOutput);
assert.equal(plan.target, 'both', 'Mixed frontend/API files must classify as both.');
assert.equal(plan.needs.site, true, 'Frontend/version files must require site deploy.');
assert.equal(plan.needs.api, true, 'API files must require API deploy.');
assert.ok(
  plan.deployCommands.some((command) => command.includes('deploy:vps-site')),
  'Plan must include site deploy command for site changes.'
);
assert.ok(
  plan.deployCommands.some((command) => command.includes('deploy-vps-server-only.cjs')),
  'Plan must include API deploy command for API changes.'
);

console.log('publish VPS plan static checks passed');
