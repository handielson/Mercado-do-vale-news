import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('services/models.ts', 'utf8');
const modal = readFileSync('components/settings/ModelModal.tsx', 'utf8');
const server = readFileSync('vps_server.js', 'utf8');

assert.match(
  service,
  /import\s+\{\s*vpsClient\s*\}\s+from\s+['"]\.\/vpsClient['"]/,
  'models service must use the VPS client for model operations',
);

assert.doesNotMatch(
  service,
  /from\s+['"]\.\/supabase['"]/,
  'models service must not write/read models directly through the frontend Supabase client',
);

assert.match(
  service,
  /async function create[\s\S]*vpsClient\.post<Model>\('\/models', input\)/,
  'model creation must go through POST /models on the VPS',
);

assert.match(
  service,
  /async function list\(\)[\s\S]*vpsClient\.get<Model\[\]>\('\/models'\)/,
  'model list must go through GET /models on the VPS',
);

assert.match(
  modal,
  /await onSave\(\);[\s\S]*toast\.success\(`Modelo "\$\{saved\.name\}" salvo com sucesso\.`\)/,
  'modal must await list reload and show a success toast after save',
);

assert.match(
  modal,
  /toast\.error\(message\)/,
  'modal must show a toast when save fails',
);

assert.match(
  server,
  /fastify\.post\('\/models', \{ preHandler: requireSyncKey \}/,
  'VPS must expose authenticated POST /models',
);

assert.match(
  server,
  /reply\.code\(409\)\.send\(\{ error: 'Ja existe um modelo com esse nome para esta marca\.' \}\)/,
  'VPS model creation must return a friendly duplicate error instead of silently reusing a row',
);

console.log('model save VPS feedback static checks passed');
