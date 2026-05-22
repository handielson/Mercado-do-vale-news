import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const apiSource = readFileSync('api/bling.ts', 'utf8');
const vpsSource = readFileSync('vps_server.js', 'utf8');
const vpsCjsSource = readFileSync('vps_server.cjs', 'utf8');

const ignoredResourceLiterals = new Set(['nfe']);

function extractResources(source) {
  const resources = new Set();
  const re = /resource === '([^']+)'/g;
  for (const match of source.matchAll(re)) {
    if (!ignoredResourceLiterals.has(match[1])) resources.add(match[1]);
  }
  return resources;
}

const apiResources = extractResources(apiSource);
const vpsResources = extractResources(vpsSource);
const vpsCjsResources = extractResources(vpsCjsSource);

for (const resource of apiResources) {
  assert.ok(vpsResources.has(resource), `vps_server.js must migrate api/bling.ts resource: ${resource}`);
  assert.ok(vpsCjsResources.has(resource), `vps_server.cjs must migrate api/bling.ts resource: ${resource}`);
}

assert.match(vpsSource, /resource === 'nfe' \|\| resource === 'nfce'/, 'vps_server.js must support nfe and nfce combined route');
assert.match(vpsCjsSource, /resource === 'nfe' \|\| resource === 'nfce'/, 'vps_server.cjs must support nfe and nfce combined route');

const migratedList = vpsSource.match(/Migrated on VPS: ([^']+)/)?.[1] || '';
for (const resource of apiResources) {
  assert.ok(migratedList.includes(resource), `invalid-resource message must list migrated resource: ${resource}`);
}
assert.ok(migratedList.includes('nfce'), 'invalid-resource message must list migrated nfce');

console.log('vps Bling resource parity static checks ok');
