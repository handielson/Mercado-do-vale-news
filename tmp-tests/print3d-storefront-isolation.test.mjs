import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('a API pública separa a consulta e a elegibilidade de cada storefront', () => {
  const source = read('services/productStorefrontOffersServer.cjs');
  assert.match(source, /o\.storefront = \?/);
  assert.match(source, /if \(storefront === 'loja_3d'\) return "o\.publication_status = 'published' AND p\.is_print3d = 1/);
  assert.match(source, /storefront,\s+publication_status: legacyMdv/);
});

test('as páginas 3D não renderizam itens fora do storefront loja_3d', () => {
  for (const file of ['pages/store/Print3dStorePage.tsx', 'pages/store/Print3dProductPage.tsx']) {
    const source = read(file);
    assert.match(source, /filter\(isPrint3dStorefrontProduct\)/);
    assert.match(source, /isolated\.length !== \(rows \|\| \[\]\)\.length/);
    assert.match(source, /setError\(true\)/);
  }
  const productPage = read('pages/store/Print3dProductPage.tsx');
  assert.doesNotMatch(productPage, /parentDescriptions|vpsClient\.get/);
  assert.match(productPage, /sanitizeCatalogHtml\(product\?\.description\)/);
  assert.match(productPage, /dangerouslySetInnerHTML={{ __html: descriptionHtml }}/);
});
