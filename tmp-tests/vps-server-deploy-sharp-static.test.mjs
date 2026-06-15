import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const deploy = readFileSync('deploy-vps-server-only.cjs', 'utf8');

assert.match(
  deploy,
  /async function ensureRemoteSharpDependency\(appDir\)/,
  'server deploy should verify the remote sharp dependency before restarting PM2',
);

assert.match(
  deploy,
  /require\.resolve\('sharp'\)/,
  'server deploy should check whether sharp is already resolvable in the remote app',
);

assert.match(
  deploy,
  /npm install sharp --omit=dev/,
  'server deploy should install sharp remotely when it is missing',
);

assert.match(
  deploy,
  /await ensureRemoteSharpDependency\(appDir\)[\s\S]*pm2 restart/,
  'server deploy should ensure sharp before restarting the API process',
);

console.log('vps server deploy sharp dependency static checks passed');
