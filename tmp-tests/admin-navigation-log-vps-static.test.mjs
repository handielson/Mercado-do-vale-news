import fs from 'node:fs';
import assert from 'node:assert/strict';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = fs.readFileSync(file, 'utf8');

  assert.match(
    source,
    /const ADMIN_NAVIGATION_LOG_LIMIT = 5000;/,
    `${file} must keep a high bounded navigation log limit.`
  );

  assert.match(
    source,
    /CREATE TABLE IF NOT EXISTS admin_navigation_logs/,
    `${file} must create the admin navigation log table when needed.`
  );

  assert.match(
    source,
    /fastify\.post\('\/admin\/navigation-log', \{ preHandler: requireSyncKeyOrAdmin \}/,
    `${file} must expose authenticated navigation log ingestion.`
  );

  assert.match(
    source,
    /fastify\.get\('\/admin\/navigation-log', \{ preHandler: requireSyncKeyOrAdmin \}/,
    `${file} must expose authenticated recent navigation log reads.`
  );

  assert.match(
    source,
    /DELETE FROM admin_navigation_logs[\s\S]*LIMIT \?/,
    `${file} must prune old navigation logs instead of growing forever.`
  );

  assert.match(
    source,
    /metadata_json/,
    `${file} must store optional diagnostic metadata safely as JSON.`
  );
}

console.log('ok - VPS admin navigation log routes are guarded and bounded');
