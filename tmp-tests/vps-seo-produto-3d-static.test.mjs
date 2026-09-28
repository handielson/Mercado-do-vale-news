import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');

  assert.match(source, /fastify\.get\('\/api\/seo-produto-3d'/, `${file} must expose the 3D product SEO route`);
  assert.match(source, /'https:\/\/www\.3dmv\.com\.br'/, `${file} must allow the canonical 3DMV browser origin`);
  assert.match(source, /'https:\/\/3dmv\.com\.br'/, `${file} must allow the redirecting 3DMV browser origin`);
  assert.match(source, /function\s+readPrint3dSeoIndexHtml\(/, `${file} must have an isolated 3DMV HTML loader`);
  assert.match(source, /\/var\/www\/print3d-site\/current\/index\.html/, `${file} must render 3D SEO with the 3DMV bundle`);
  assert.match(source, /fastify\.get\('\/api\/seo-produto-3d'[\s\S]*const baseHtml = readPrint3dSeoIndexHtml\(\)/, `${file} must not render 3D SEO with the Mercado do Vale index`);
  assert.match(source, /async function\s+loadPrint3dSeoProductByRouteTarget\(/, `${file} must resolve published 3D products`);
  assert.match(source, /o\.storefront = 'loja_3d'[\s\S]*o\.publication_status = 'published'/, `${file} must restrict SEO to published Loja 3D offers`);
  assert.match(source, /function\s+getPrint3dSeoRouteTarget\(/, `${file} must generate stable product URLs`);
  assert.match(source, /product\.parent_sku \|\| product\.sku/, `${file} must use the parent SKU in family URLs`);
  assert.match(source, /print3dSeoBaseProductName/, `${file} must remove color suffixes from family titles`);
  assert.match(source, /\/loja-3d\/produto\/\$\{encodeURIComponent\(canonicalTarget\)\}/, `${file} must emit a canonical Loja 3D URL`);
  assert.match(source, /name="robots" content="index, follow, max-image-preview:large"/, `${file} must make published product pages indexable`);
  assert.match(source, /https:\/\/schema\.org\/PreOrder/, `${file} must represent printable preorders in structured data`);
  assert.match(source, /print3dProductUrls/, `${file} must include published 3D products in the sitemap`);
  assert.match(source, /new Map\(print3dProducts\.map/, `${file} must emit one sitemap URL per family`);
  assert.match(source, /available_stock \?\? product\.stock_quantity/, `${file} must use sellable stock for SEO availability`);
}

for (const file of ['infra/nginx/mdv-site-production.conf', 'infra/nginx/mdv-site-staging.conf']) {
  const source = readFileSync(file, 'utf8');
  assert.match(source, /location ~ \^\/loja-3d\/produto\/\(\[\^\/\]\+\)\$/, `${file} must route public 3D product pages before the SPA fallback`);
  assert.match(source, /api\/seo-produto-3d\?slug=\$1/, `${file} must proxy 3D product pages to Fastify SEO rendering`);
}

console.log('3D product SEO static checks ok');
