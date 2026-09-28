'use strict';

const path = require('node:path');
const { spawn } = require('node:child_process');
const dotenv = require('dotenv');
const { createLocalCatalogPreviewServer } = require('../services/localCatalogPreviewServer.cjs');

const root = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(root, '.env.local'), quiet: true });

const preview = createLocalCatalogPreviewServer({
  remoteOrigin: process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br',
  syncKey: process.env.VITE_VPS_SYNC_KEY || '',
  port: Number(process.env.VITE_LOCAL_PREVIEW_API_PORT || 3101),
});

let vite;
let stopping = false;

async function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  if (vite && !vite.killed) vite.kill('SIGTERM');
  await preview.close();
  process.exit(exitCode);
}

async function main() {
  await preview.start();
  console.log('[Prévia local] Rascunhos do catálogo em http://127.0.0.1:3101');
  vite = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), ...process.argv.slice(2)], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
  vite.once('exit', (code) => { void stop(code || 0); });
  process.once('SIGINT', () => { void stop(0); });
  process.once('SIGTERM', () => { void stop(0); });
}

main().catch((error) => {
  console.error('[Prévia local] Não foi possível iniciar:', error.message);
  process.exit(1);
});
