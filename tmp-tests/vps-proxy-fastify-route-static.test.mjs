import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(
    source,
    /fastify\.all\('\/api\/vps-proxy'/,
    `${file} must expose the Vercel-compatible /api/vps-proxy route on Fastify`,
  );

  assert.match(
    source,
    /fastify\.get\('\/api\/brasilapi-ncm'/,
    `${file} must expose /api/brasilapi-ncm directly for the existing rewrite contract`,
  );

  assert.match(
    source,
    /function\s+isVpsProxyPublicPath\(/,
    `${file} must keep an explicit public path allowlist for the VPS proxy`,
  );

  assert.match(
    source,
    /function\s+extractVpsProxyFavoritesCustomerId\(/,
    `${file} must protect customer favorites by customer id`,
  );

  assert.match(
    source,
    /vpsProxyTargetPath\s*===\s*'\/cart\/sync'/,
    `${file} must keep cart sync scoped to the authenticated customer`,
  );

  assert.match(
    source,
    /headers\['x-sync-key'\]\s*=\s*process\.env\.SYNC_SECRET/,
    `${file} must add the VPS sync key to protected proxy requests`,
  );

  assert.match(
    source,
    /normalizedMethod\s*===\s*'POST'[\s\S]*pathname\s*===\s*'\/pdv\/displays\/pair'/,
    `${file} must allow public Android display pairing through the VPS proxy without admin auth`,
  );

  assert.match(
    source,
    /normalizedMethod\s*===\s*'GET'[\s\S]*pathname\s*===\s*'\/pdv\/display-state'/,
    `${file} must allow public Android display state polling through the VPS proxy without admin auth`,
  );

  assert.match(
    source,
    /!isPublicPath\s*&&\s*\(isWrite\s*\|\|\s*isVpsProxySensitiveGetPath\(vpsProxyTargetPath\)\)\s*&&\s*!auth\.isAdmin/,
    `${file} must not require admin auth for public write proxy paths such as banner tracking`,
  );

  assert.match(
    source,
    /fastify\.inject\(\{[\s\S]*url:\s*vpsProxyTargetPath/,
    `${file} must forward protected proxy requests internally with the VPS sync key`,
  );
}

console.log('vps proxy Fastify route static checks ok');
