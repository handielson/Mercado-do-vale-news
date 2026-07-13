import assert from 'node:assert/strict';
import {
  CATALOG_COLLECTIONS,
  getCatalogCollectionByPathname,
  getCatalogCollectionFilters,
  getCatalogSeoConfig,
  getEnabledCatalogCollections,
  isCatalogCollectionPath,
} from './catalogCollections.js';

assert.equal(CATALOG_COLLECTIONS.length, 3);
assert.equal(getEnabledCatalogCollections().length, 3);
assert.ok(getEnabledCatalogCollections().some((c) => c.key === 'best-sellers'));

const featured = getCatalogCollectionByPathname('/produtos/destaques');
assert.equal(featured?.key, 'featured');
assert.equal(featured?.path, '/produtos/destaques');
assert.deepEqual(getCatalogCollectionFilters(featured), {
  sortBy: 'featured',
});
assert.equal(featured?.source, 'featured-first');

const recent = getCatalogCollectionByPathname('/produtos/mais-recentes');
assert.equal(recent?.key, 'recent');
assert.deepEqual(getCatalogCollectionFilters(recent), {
  sortBy: 'recent',
});

const bestSellers = getCatalogCollectionByPathname('/produtos/mais-vendidos');
assert.equal(bestSellers?.key, 'best-sellers');
assert.equal(bestSellers?.source, 'curated-featured-first-fallback');
assert.notEqual(bestSellers?.enabled, false);
assert.deepEqual(getCatalogCollectionFilters(bestSellers), {
  sortBy: 'featured',
});

assert.equal(getCatalogCollectionByPathname('/produtos'), null);
assert.equal(getCatalogCollectionByPathname('/produto/iphone-15'), null);
assert.equal(isCatalogCollectionPath('/produtos/mais-vendidos'), true);
assert.equal(isCatalogCollectionPath('/produtos'), false);

const seo = getCatalogSeoConfig(bestSellers);
assert.equal(seo.title, 'Mais vendidos | Mercado do Vale em Petrolina-PE');
assert.equal(seo.canonical, 'https://www.mercadodovale.com.br/produtos/mais-vendidos');
assert.match(seo.description, /populares/i);

const defaultSeo = getCatalogSeoConfig(null);
assert.equal(defaultSeo.title, 'Mercado do Vale | Smartphones e Eletronicos em Petrolina-PE');
assert.equal(defaultSeo.canonical, 'https://www.mercadodovale.com.br/');

console.log('catalogCollections.test.mjs: ok');
