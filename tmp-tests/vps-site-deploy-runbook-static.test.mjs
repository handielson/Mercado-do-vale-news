import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const doc = readFileSync('migração_VPS.md', 'utf8');

assert.match(doc, /## Fluxo de Deploy do Site na VPS/, 'migration doc must have an explicit site deploy runbook');
assert.match(doc, /npm run build/, 'site deploy runbook must include the frontend build command');
assert.match(doc, /npm run deploy:vps-site/, 'site deploy runbook must include the VPS site deploy command');
assert.match(doc, /\/var\/www\/mdv-site\/releases/, 'site deploy runbook must document versioned releases');
assert.match(doc, /\/var\/www\/mdv-site\/current/, 'site deploy runbook must document the current symlink');
assert.match(doc, /\/var\/www\/mdv-site\/previous/, 'site deploy runbook must document the previous symlink');
assert.match(doc, /Nginx[\s\S]*\/api\/\*/, 'site deploy runbook must document Nginx proxying API routes');
assert.match(doc, /Rollback[\s\S]*current[\s\S]*previous/, 'site deploy runbook must document rollback through symlinks');
assert.match(doc, /Vercel[\s\S]*fallback/, 'site deploy runbook must say how Vercel remains as temporary fallback');

console.log('vps site deploy runbook static checks ok');
