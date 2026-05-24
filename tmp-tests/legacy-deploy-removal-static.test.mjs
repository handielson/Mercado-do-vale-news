import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const packageLock = existsSync('package-lock.json') ? readFileSync('package-lock.json', 'utf8') : '';

assert.equal(existsSync('vercel.json'), false, 'legacy platform config should be removed after VPS cutover');
assert.equal(existsSync('api'), false, 'legacy serverless api/ functions should be removed after VPS cutover');
assert.equal(packageJson.dependencies?.['@vercel/node'], undefined, 'legacy platform runtime should not remain as an app dependency');
assert.equal(packageLock.includes('"@vercel/node"'), false, 'package-lock should not retain legacy platform runtime');

const rootFiles = readdirSync('.', { withFileTypes: true }).map(entry => entry.name);
assert.equal(rootFiles.includes('vercel.json'), false, 'root should not contain legacy platform deployment config');
assert.equal(rootFiles.includes('.vercelignore'), false, 'root should not contain legacy platform ignore config');
assert.equal(rootFiles.includes('.vercel-build-trigger'), false, 'root should not contain legacy platform build trigger');
assert.equal(rootFiles.includes('diag-vercel.cjs'), false, 'root should not contain legacy platform diagnostic script');
assert.equal(rootFiles.includes('VERCEL_ENV_VARS.md'), false, 'root should not contain legacy platform environment runbook');

const server = existsSync('server.js') ? readFileSync('server.js', 'utf8') : '';
const vpsServer = readFileSync('vps_server.js', 'utf8');
const vpsServerCjs = readFileSync('vps_server.cjs', 'utf8');

assert.equal(server.includes('mercado-do-vale-news.vercel.app'), false, 'legacy standalone server CORS should not allow the old platform app');
assert.equal(vpsServer.includes('vercel-cron/1.0'), false, 'VPS API must not authorize jobs by legacy cron user-agent');
assert.equal(vpsServerCjs.includes('vercel-cron/1.0'), false, 'VPS CJS API must not authorize jobs by legacy cron user-agent');

console.log('legacy deploy removal static checks passed');
