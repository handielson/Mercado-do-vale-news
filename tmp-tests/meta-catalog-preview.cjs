'use strict';
// Read-only validation against the same public API the storefront consumes.
const fs = require('node:fs/promises');
const path = require('node:path');
const { buildMetaCatalogFeed } = require('../services/metaCatalogFeedServer.cjs');
async function read(route) {
  const response = await fetch('https://api.xiaomipetrolina.com.br' + route, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error('Public API returned ' + response.status);
  return response.json();
}
(async () => {
  const settings = await read('/catalog-settings');
  const products = [];
  for (let offset = 0; ; offset += 2000) {
    const rows = await read('/products?compact=true&limit=2000&offset=' + offset);
    if (!Array.isArray(rows)) throw new Error('Unexpected public product response');
    products.push(...rows);
    if (rows.length < 2000) break;
  }
  const categories = await read('/categories');
  const feed = buildMetaCatalogFeed(products, settings, new Date(), categories);
  const target = path.resolve(process.argv[2] || path.join(require('node:os').tmpdir(), 'mdv-meta-catalog-preview.xml'));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, feed.body);
  console.log(JSON.stringify({ readOnly: true, sourceProducts: products.length, feedProducts: feed.count,
    missingBrand: products.filter(p => !String(p.brand || '').trim()).length,
    output: target, bytes: Buffer.byteLength(feed.body) }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
