'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const entrypoints = ['server.js', 'vps_server.js', 'vps_server.cjs'];
const visibilityHandlers = entrypoints.map(file => {
  const source = read(file);
  const route = source.match(/fastify\.put\('\/units\/:id',[\s\S]*?const allowed = \[/);
  assert.ok(route, `${file} must register the unit update route`);
  const handler = route[0].match(/if \('visibility_action' in u\) \{[\s\S]*?\n  \}/);
  assert.ok(handler, `${file} must route visibility actions before the generic field whitelist`);
  assert.match(handler[0], /require\('\.\/services\/unitVisibility\.cjs'\)\.setUnitVisibility/);
  assert.match(handler[0], /pool, syncProductStock, id: req\.params\.id, action: u\.visibility_action, reason: u\.reason/);
  return handler[0];
});

assert.equal(new Set(visibilityHandlers).size, 1, 'all deployed API entrypoints must use the same visibility handler');

const client = read('services/units.ts');
assert.match(client, /async setVisibility\([\s\S]*?visibility_action: hidden \? 'hide' : 'restore', reason/);

const deploy = read('deploy-vps-server-only.cjs');
for (const helper of ['unitVisibility.cjs', 'unitStatusSchema.cjs']) {
  assert.ok(deploy.includes(`await upload(path.join(__dirname, 'services/${helper}')`),
    `full API publication must include ${helper}`);
}

console.log('Unit visibility client, API entrypoints and publication contract passed');
