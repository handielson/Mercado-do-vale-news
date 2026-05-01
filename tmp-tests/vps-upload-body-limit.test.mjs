import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['server.js', 'vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');
  assert.match(
    source,
    /require\('fastify'\)\(\{\s*logger:\s*false,\s*bodyLimit:\s*500\s*\*\s*1024\s*\*\s*1024\s*\}/s,
    `${file} should set Fastify bodyLimit to 500MB so large multipart uploads are not rejected before route limits`
  );
}

console.log('vps upload body limit ok');
