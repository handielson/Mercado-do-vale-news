import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const serverSource = readFileSync(path.join(repoRoot, 'vps_server.js'), 'utf8');

assert.doesNotMatch(
  serverSource,
  /fastify\.register\(require\('@fastify\/multipart'\),\s*\{\s*limits:\s*\{\s*fileSize:\s*5\s*\*\s*1024\s*\*\s*1024\s*\}/,
  'global multipart limit must not cap Synology video uploads at 5 MB',
);

assert.match(
  serverSource,
  /req\.parts\(\{\s*limits:\s*\{\s*fileSize:\s*500\s*\*\s*1024\s*\*\s*1024\s*\}/,
  'Synology video upload route must explicitly allow large video files',
);

console.log('synology video upload limit ok');
