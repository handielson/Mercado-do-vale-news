import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const file of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(file, 'utf8');
  const routeStart = source.indexOf("fastify.get('/products/by-slug/:slug'");
  const routeEnd = source.indexOf("fastify.get('/products/by-ean/:ean'", routeStart);
  const route = source.slice(routeStart, routeEnd);

  assert.match(route, /\(status = 'active'\) DESC/);
  assert.match(route, /\(sku NOT LIKE 'ARCH-%'\) DESC/);
  assert.match(route, /\(track_inventory = 0 OR stock_quantity > 0\) DESC/);
  assert.match(route, /LIMIT 1/);
  assert.match(route, /getPublicProductVariantRouteTargetVps\(product, routeCandidates\)/);
  assert.match(route, /WHERE \? LIKE CONCAT\(slug, '-%'\)/);
}

const modernCard = readFileSync('components/catalog/ModernProductCard.tsx', 'utf8');
assert.match(modernCard, /getPublicProductVariantRouteTarget/);
assert.match(modernCard, /productGroup\?\.variants\?\.flatMap\(variant => variant\.products\)/);

const adminCard = readFileSync('components/products/ProductCard.tsx', 'utf8');
assert.match(adminCard, /href=\{`\/produto\/\$\{product\.id\}`\}/);

const productPage = readFileSync('pages/store/PublicProductPage.tsx', 'utf8');
assert.match(productPage, /isUuid[\s\S]*getPublicProductDisambiguatedRouteTarget\(data\)/);
assert.match(productPage, /if \(canonicalRouteTarget && canonicalRouteTarget !== slug\)/);

console.log('duplicate product slug active priority regression: ok');
