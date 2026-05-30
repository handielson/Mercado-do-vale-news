import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('services/bannerService.ts', 'utf8');

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(
    source,
    /fastify\.get\('\/banners\/:id'/,
    `${file} must expose GET /banners/:id for duplicated/admin banner reads`,
  );

  assert.match(
    source,
    /const allowedBannerFields\s*=\s*\[/,
    `${file} must patch banners with an allowlisted partial update`,
  );

  assert.doesNotMatch(
    source,
    /UPDATE banners SET title=\?,image_url=\?,link_url=\?,active=\?,display_order=\?,start_date=\?,end_date=\?/,
    `${file} must not overwrite omitted banner fields during PATCH /banners/:id`,
  );

  assert.match(
    source,
    /SELECT \* FROM banners WHERE id=\?/,
    `${file} must return the saved banner row after create/update/detail reads`,
  );
}

assert.doesNotMatch(
  service,
  /from\s*\(\s*['"]catalog_banners['"]\s*\)/,
  'bannerService must not keep direct Supabase catalog_banners fallback after VPS CRUD migration',
);

console.log('banner VPS CRUD contract static checks ok');
