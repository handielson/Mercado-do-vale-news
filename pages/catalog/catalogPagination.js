export const CATALOG_RETURN_STORAGE_KEY = 'mv_catalog_return_state';

export function normalizeCatalogPage(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function getCatalogPageSlice(items, page, pageSize) {
  const normalizedPage = normalizeCatalogPage(page);
  const normalizedPageSize = Math.max(1, Number.parseInt(String(pageSize ?? 1), 10) || 1);
  const startIndex = (normalizedPage - 1) * normalizedPageSize;
  const endIndex = startIndex + normalizedPageSize;

  return {
    page: normalizedPage,
    pageSize: normalizedPageSize,
    startIndex,
    endIndex,
    items: Array.isArray(items) ? items.slice(startIndex, endIndex) : [],
  };
}

export function buildCatalogPageHref({ pathname = '/', searchParams, page }) {
  const params = new URLSearchParams(searchParams);
  const normalizedPage = normalizeCatalogPage(page);

  if (normalizedPage <= 1) {
    params.delete('page');
  } else {
    params.set('page', String(normalizedPage));
  }

  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

export function getCatalogPaginationPathname({
  pathname = '/',
  isAllProducts = false,
  allProductsPathname = '/produtos',
}) {
  return isAllProducts ? allProductsPathname : pathname;
}

export function needsCatalogPageData({
  loadedGroupCount,
  currentPage,
  pageSize,
  hasMore,
  loading,
}) {
  if (loading || !hasMore) return false;

  const requiredItems = normalizeCatalogPage(currentPage) * Math.max(1, Number(pageSize) || 1);
  return Number(loadedGroupCount) < requiredItems;
}

export function createCatalogReturnState({ pathname = '/', search = '', scrollY = 0 }) {
  return {
    pathKey: `${pathname}${search || ''}`,
    scrollY: Number(scrollY) || 0,
  };
}

export function shouldRestoreCatalogState(savedState, { pathname = '/', search = '' }) {
  if (!savedState || typeof savedState !== 'object') return false;
  return savedState.pathKey === `${pathname}${search || ''}`;
}
