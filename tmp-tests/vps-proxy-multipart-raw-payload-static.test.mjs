import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const files = ['vps_server.cjs', 'vps_server.js', 'server.js'];

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  assert.match(
    content,
    /function buildVpsProxyPayload[\s\S]*?multipart\/form-data[\s\S]*?return request\.raw/,
    `${file} deve repassar request.raw para requisições multipart/form-data no buildVpsProxyPayload`,
  );
}

console.log('vps-proxy multipart raw payload regression checks passed.');
