import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['server.js', 'vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.doesNotMatch(
    source,
    /@supabase\/supabase-js/,
    `${file} should not require Supabase packages that are absent from the VPS runtime`
  );

  assert.match(
    source,
    /async function isAdminBearerToken\(request\)/,
    `${file} should validate direct browser uploads with a Supabase Bearer token`
  );

  assert.match(
    source,
    /process\.env\.SUPABASE_KEY/,
    `${file} should support the SUPABASE_KEY name already configured on the VPS`
  );

  assert.match(
    source,
    /\/rest\/v1\/customers\?select=customer_type[\s\S]*customer_type === 'ADMIN'/,
    `${file} should only accept admin Bearer tokens for direct Synology uploads`
  );

  assert.match(
    source,
    /fastify\.post\('\/synology\/upload', \{ preHandler: requireSyncKeyOrAdmin \}/,
    `${file} should allow /synology/upload with either sync key or admin Bearer auth`
  );
}

console.log('synology upload admin bearer regression ok');
