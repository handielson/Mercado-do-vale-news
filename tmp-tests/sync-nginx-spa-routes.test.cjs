const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spaBlock, withSpaBlock } = require('../scripts/sync-nginx-spa-routes.cjs');

test('generated SPA routes are idempotent for LF and CRLF Nginx files', () => {
  const routes = fs.readFileSync('routes/index.tsx', 'utf8');
  const source = fs.readFileSync('infra/nginx/mdv-site-production.conf', 'utf8');
  const block = spaBlock(routes);
  assert.equal(withSpaBlock(source, block), source);
  const crlf = source.replace(/\r?\n/g, '\r\n');
  assert.equal(withSpaBlock(crlf, block), crlf);
});
