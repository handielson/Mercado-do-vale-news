import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const buttonSource = readFileSync('components/catalog/ShareCatalogButton.tsx', 'utf8');
const pageSource = readFileSync('pages/catalog/index.tsx', 'utf8');
const messageSource = readFileSync('utils/catalogMessageGenerator.ts', 'utf8');
const pdfSource = readFileSync('utils/catalogPDFGenerator.ts', 'utf8');

assert(
  buttonSource.includes('Resultados filtrados') &&
    buttonSource.includes("categoryId ? 'Categoria completa' : 'Catálogo completo'"),
  'the share menu must offer filtered results and the complete category as separate scopes',
);

assert(
  buttonSource.includes("generateFilteredCatalogMessage(filteredScope, 'retail')") &&
    buttonSource.includes("generateCategoryMessage(categoryId, 'retail')"),
  'copy and WhatsApp sharing must support both filtered and complete-category messages',
);

assert(
  buttonSource.includes("await import('@/utils/catalogPDFGenerator')") &&
    buttonSource.includes("generateFilteredCatalogPDF(filteredScope, 'retail')") &&
    buttonSource.includes("generateCategoryPDF(categoryId, 'retail')"),
  'PDF sharing must support both scopes while keeping the PDF generator lazy-loaded',
);

assert(
  messageSource.includes('catalogService.getProducts(filters, 1, 5000, true)') &&
    messageSource.includes('applyShareFilters(result.products as Product[], filters)') &&
    messageSource.includes('buildFilteredCatalogUrl()'),
  'filtered sharing must use the active catalog filters and preserve the filtered URL',
);

assert(
  pdfSource.includes('getFilteredCatalogShareData(filters)') &&
    pdfSource.includes("categoryName ? `${categoryName} — Filtrados` : 'Resultados filtrados'"),
  'the filtered PDF must be built from the same filtered product set',
);

assert(
  pageSource.includes('const catalogShareFilters = useMemo<CatalogShareFilters>') &&
    pageSource.includes('search: searchQuery.trim()') &&
    pageSource.includes('brands: filters.brands') &&
    pageSource.includes('priceRange: filters.priceRange') &&
    pageSource.includes('filteredScope={catalogShareFilters}'),
  'the catalog page must pass its current search and filters to the share control',
);

console.log('catalog filtered and complete sharing scopes are enforced');
