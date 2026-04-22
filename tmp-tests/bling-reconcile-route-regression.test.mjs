import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const blingApiPath = path.resolve(__dirname, '../api/bling.ts');
const cronScriptPath = path.resolve(__dirname, '../scripts/bling-reconcile-cron.sh');

const blingApiSource = readFileSync(blingApiPath, 'utf8');
const cronScriptSource = readFileSync(cronScriptPath, 'utf8');

assert.match(
  blingApiSource,
  /import\s+\{\s*buildBlingReconcilePlan\s*\}\s+from\s+'\.\/_lib\/bling-reconcile-core\.js';/,
  'the unified Bling API must keep the reconcile helper wired in',
);

assert.match(
  blingApiSource,
  /if\s*\(\s*resource\s*===\s*'reconcile'\s*\)/,
  'the unified Bling API must expose the reconcile resource so the Hobby plan stays within the serverless function limit',
);

assert.match(
  blingApiSource,
  /patchVpsForReconcile\(\s*'\/products\/stock'/,
  'the reconcile flow must keep syncing stock changes to the VPS',
);

assert.match(
  blingApiSource,
  /patchVpsForReconcile\(\s*'\/products\/name'/,
  'the reconcile flow must keep syncing name changes to the VPS',
);

assert.match(
  cronScriptSource,
  /api\/bling\?resource=reconcile/,
  'the VPS cron script must call the unified Bling endpoint instead of creating a new serverless function',
);

console.log('bling reconcile route regression ok');
