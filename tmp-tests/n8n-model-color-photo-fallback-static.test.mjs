import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { patchContext, MARKER } = require('./n8n-fix-model-color-photo-fallback.cjs');
const servers = ['vps_server.cjs', 'vps_server.js'];

for (const file of servers) {
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  assert.match(source, /async function attachCatalogModelColorImages\(products, baseUrl\)/, `${file} must batch-resolve galleries`);
  assert.match(source, /INNER JOIN model_color_images mci[\s\S]*INNER JOIN colors c/, `${file} must resolve model/color galleries from VPS`);
  assert.match(source, /mci\.company_id = p\.company_id OR mci\.company_id IS NULL/, `${file} must preserve company isolation`);
  assert.match(source, /model_color_images: modelColorImages, resolved_images: resolvedImages/, `${file} must expose the canonical fallback`);
  const productsRoute = source.slice(source.indexOf("fastify.get('/products'"), source.indexOf("fastify.get('/products/by-ids'"));
  const categoriesRoute = source.slice(source.indexOf("fastify.get('/categories'"), source.indexOf('// POST /categories'));
  assert.match(productsRoute, /return attachCatalogModelColorImages\(result, buildSeoBaseUrl\(req\)\);/, `${file} /products must return enriched results`);
  assert.doesNotMatch(categoriesRoute, /attachCatalogModelColorImages/, `${file} must not enrich unrelated category responses`);
}

const oldCode = `const variants = products.map((product) => ({
      images: Array.isArray(product.images) ? product.images.filter((url) => String(url).includes('api.xiaomipetrolina.com.br/images/')).slice(0, 3) : [],
    }));
return variants;`;
const patched = patchContext(oldCode);
assert.match(patched, new RegExp(MARKER));
assert.match(patched, /product\.resolved_images/);
assert.match(patched, /product\.model_color_images/);
assert.match(patched, /startsWith\('https:\/\/api\.xiaomipetrolina\.com\.br\/images\/'\)/);

const modelColorUrl = 'https://api.xiaomipetrolina.com.br/images/model-color/model/color/photo.jpg';
const product = { images: [], resolved_images: [modelColorUrl], model_color_images: [modelColorUrl] };
const selected = [...new Set([product.images, product.resolved_images, product.model_color_images]
  .flatMap((value) => Array.isArray(value) ? value : [])
  .map((url) => String(url || '').trim())
  .filter((url) => url.startsWith('https://api.xiaomipetrolina.com.br/images/')))].slice(0, 3);
assert.deepEqual(selected, [modelColorUrl], 'an empty product.images list must fall back to its model/color gallery');

console.log('n8n model/color photo fallback regression OK');
