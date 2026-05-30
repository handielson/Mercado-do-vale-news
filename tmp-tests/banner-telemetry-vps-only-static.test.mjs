import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('services/bannerService.ts', 'utf8');
const reorderBody = source.match(/reorderBanners:\s*async[\s\S]*?\n    \},/);

assert.ok(reorderBody, 'banner service should expose reorderBanners');

assert.match(
  reorderBody[0],
  /vpsClient\.patch\(`\/banners\/\$\{u\.id\}`, \{\s*display_order:\s*u\.display_order\s*\}\)/,
  'banner reordering must write display_order through the VPS endpoint'
);

assert.doesNotMatch(
  reorderBody[0],
  /supabase[\s\S]*catalog_banners/,
  'banner reordering must not write catalog_banners directly in Supabase after VPS migration'
);

assert.match(
  source,
  /vpsClient\.post\(`\/banners\/\$\{bannerId\}\/click`, \{\}\)/,
  'banner click tracking must use the VPS endpoint'
);

assert.match(
  source,
  /vpsClient\.post\(`\/banners\/\$\{bannerId\}\/view`, \{\}\)/,
  'banner view tracking must use the VPS endpoint'
);

assert.doesNotMatch(
  source,
  /increment_banner_(?:clicks|views)/,
  'banner telemetry must not keep Supabase RPC fallback after VPS migration'
);

console.log('banner telemetry VPS-only static checks ok');
