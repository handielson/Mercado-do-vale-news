import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const deploy = readFileSync('deploy-vps-server-only.cjs', 'utf8');

[
  'services/autoresponder/engine',
  'state.js',
  'flows/delivery.js',
  'flows/product-search.js',
  'flows/purchase.js',
  'fallbacks.js',
  'messages.js',
  'types.js',
].forEach((needle) => {
  assert.ok(deploy.includes(needle), `deploy-vps-server-only.cjs must upload ${needle}`);
});

assert.match(
  deploy,
  /services\/autoresponder\/engine[\s\S]*services\/autoresponder\/engine\/flows/,
  'deploy must create remote autoresponder engine directories before uploading files',
);

console.log('autoresponder engine deploy files static checks passed');
