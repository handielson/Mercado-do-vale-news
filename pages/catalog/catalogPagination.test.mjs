import assert from 'node:assert/strict';
import {
  buildCatalogPageHref,
  createCatalogReturnState,
  getCatalogPageSlice,
  getCatalogPaginationPathname,
  needsCatalogPageData,
  normalizeCatalogPage,
  shouldRestoreCatalogState,
} from './catalogPagination.js';

assert.equal(normalizeCatalogPage(undefined), 1);
assert.equal(normalizeCatalogPage('0'), 1);
assert.equal(normalizeCatalogPage('-3'), 1);
assert.equal(normalizeCatalogPage('2'), 2);

const slice = getCatalogPageSlice(['a', 'b', 'c', 'd', 'e'], 2, 2);
assert.deepEqual(slice.items, ['c', 'd']);
assert.equal(slice.startIndex, 2);
assert.equal(slice.endIndex, 4);

assert.equal(
  buildCatalogPageHref({
    pathname: '/',
    searchParams: new URLSearchParams('search=adaptador&categoria=tomadas&page=4'),
    page: 2,
  }),
  '/?search=adaptador&categoria=tomadas&page=2',
);

assert.equal(
  buildCatalogPageHref({
    pathname: '/',
    searchParams: new URLSearchParams('search=adaptador&categoria=tomadas&page=4'),
    page: 1,
  }),
  '/?search=adaptador&categoria=tomadas',
);

assert.equal(
  buildCatalogPageHref({
    pathname: '/produtos/destaques',
    searchParams: new URLSearchParams('page=1'),
    page: 2,
  }),
  '/produtos/destaques?page=2',
);

assert.equal(
  getCatalogPaginationPathname({
    pathname: '/',
    isAllProducts: true,
  }),
  '/produtos',
);

assert.equal(
  getCatalogPaginationPathname({
    pathname: '/',
    isAllProducts: false,
  }),
  '/',
);

assert.equal(
  needsCatalogPageData({
    loadedGroupCount: 10,
    currentPage: 2,
    pageSize: 12,
    hasMore: true,
    loading: false,
  }),
  true,
);

assert.equal(
  needsCatalogPageData({
    loadedGroupCount: 24,
    currentPage: 2,
    pageSize: 12,
    hasMore: true,
    loading: false,
  }),
  false,
);

const savedState = createCatalogReturnState({
  pathname: '/',
  search: '?search=adaptador&page=2',
  scrollY: 1480,
});

assert.equal(savedState.pathKey, '/?search=adaptador&page=2');
assert.equal(savedState.scrollY, 1480);

assert.equal(
  shouldRestoreCatalogState(savedState, {
    pathname: '/',
    search: '?search=adaptador&page=2',
  }),
  true,
);

assert.equal(
  shouldRestoreCatalogState(savedState, {
    pathname: '/',
    search: '?search=adaptador&page=3',
  }),
  false,
);

console.log('catalogPagination.test.mjs: ok');
