import fs from 'node:fs';
import assert from 'node:assert/strict';

const files = ['server.js', 'vps_server.cjs', 'vps_server.js'];

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  assert.match(
    source,
    /fastify\.post\('\/models\/generate-json',\s*\{\s*preHandler:\s*requireSyncKey\s*\}/,
    `${file} must expose protected POST /models/generate-json`
  );
  assert.match(
    source,
    /upstream_status:\s*response\.status/,
    `${file} must return upstream status when AI JSON generation fails`
  );
  assert.match(
    source,
    /raw_error:\s*rawText\.slice\(0,\s*2000\)/,
    `${file} must preserve non-JSON upstream errors for diagnostics`
  );
}

console.log('model AI generate-json route static checks passed');
