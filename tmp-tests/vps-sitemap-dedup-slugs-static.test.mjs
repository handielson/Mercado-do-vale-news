import fs from 'node:fs';
import assert from 'node:assert/strict';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = fs.readFileSync(file, 'utf8');
  const routeMatch = source.match(/fastify\.get\('\/api\/sitemap'[\s\S]*?const baseUrl = buildSitemapBaseUrl\(request\);/);

  assert(routeMatch, `${file} must keep the /api/sitemap route`);
  assert.match(routeMatch[0], /GROUP BY\s+slug/i, `${file} sitemap query must deduplicate product URLs by slug`);
  assert.match(routeMatch[0], /MAX\(updated_at\)\s+AS\s+updated_at/i, `${file} sitemap query must keep a stable lastmod for duplicate slugs`);
  assert.doesNotMatch(routeMatch[0], /SELECT\s+slug,\s+name,\s+updated_at/i, `${file} sitemap query must not emit one URL per product row`);
}

console.log('vps sitemap deduplicates product slugs');
