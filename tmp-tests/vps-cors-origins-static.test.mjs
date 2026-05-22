import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(
    source,
    /'https:\/\/staging\.mercadodovale\.com\.br'/,
    `${file} must allow the staging storefront origin in Fastify CORS`,
  );

  assert.match(
    source,
    /'https:\/\/www\.mercadodovale\.com\.br'/,
    `${file} must keep the production storefront origin in Fastify CORS`,
  );
}

console.log('vps CORS origins static checks ok');
