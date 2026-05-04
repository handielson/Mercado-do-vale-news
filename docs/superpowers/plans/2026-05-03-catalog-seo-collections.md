# Catalog SEO Collections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add lightweight, indexable catalog collection pages for Destaques, Mais recentes, and Mais vendidos while preserving the current `/produtos` behavior and catalog performance.

**Architecture:** Introduce a small catalog collection configuration helper, route the new URLs to the existing `CatalogPage`, and let `CatalogPage` derive SEO metadata, heading text, initial filters, and pagination path from the active route. The collection pages reuse `useCatalog`, `ProductGroupGrid`, compact VPS payloads, local cache, and `products_per_page`; home-only banners/sections stay off the collection pages.

**Tech Stack:** React 18, React Router 6, Vite, TypeScript/TSX, JavaScript helper tests with Node `assert`, React Helmet Async, existing catalog services.

---

## File Structure

- Create: `pages/catalog/catalogCollections.js`
  - Owns route-to-collection mapping, SEO metadata, headings, descriptions, and initial catalog filters.
- Create: `pages/catalog/catalogCollections.test.mjs`
  - Verifies collection lookup, fallback behavior, filters, and canonical URLs.
- Modify: `pages/catalog/index.tsx`
  - Reads the active collection from `location.pathname`, remounts catalog content by path, applies collection filters, sets route-specific Helmet metadata, heading text, and pagination path.
- Modify: `routes/index.tsx`
  - Adds `/produtos/destaques`, `/produtos/mais-recentes`, and `/produtos/mais-vendidos` routes using the existing `CatalogPage`.
- Modify: `pages/catalog/catalogPagination.test.mjs`
  - Adds one assertion that pagination keeps collection pathnames such as `/produtos/destaques?page=2`.

---

### Task 1: Catalog Collection Config

**Files:**
- Create: `pages/catalog/catalogCollections.js`
- Create: `pages/catalog/catalogCollections.test.mjs`

- [ ] **Step 1: Write the failing collection config test**

Create `pages/catalog/catalogCollections.test.mjs` with this content:

```js
import assert from 'node:assert/strict';
import {
  CATALOG_COLLECTIONS,
  getCatalogCollectionByPathname,
  getCatalogCollectionFilters,
  getCatalogSeoConfig,
  isCatalogCollectionPath,
} from './catalogCollections.js';

assert.equal(CATALOG_COLLECTIONS.length, 3);

const featured = getCatalogCollectionByPathname('/produtos/destaques');
assert.equal(featured?.key, 'featured');
assert.equal(featured?.path, '/produtos/destaques');
assert.deepEqual(getCatalogCollectionFilters(featured), {
  featuredOnly: true,
  sortBy: 'featured',
});

const recent = getCatalogCollectionByPathname('/produtos/mais-recentes');
assert.equal(recent?.key, 'recent');
assert.deepEqual(getCatalogCollectionFilters(recent), {
  sortBy: 'recent',
});

const bestSellers = getCatalogCollectionByPathname('/produtos/mais-vendidos');
assert.equal(bestSellers?.key, 'best-sellers');
assert.equal(bestSellers?.source, 'curated-featured-fallback');
assert.deepEqual(getCatalogCollectionFilters(bestSellers), {
  featuredOnly: true,
  sortBy: 'featured',
});

assert.equal(getCatalogCollectionByPathname('/produtos'), null);
assert.equal(getCatalogCollectionByPathname('/produto/iphone-15'), null);
assert.equal(isCatalogCollectionPath('/produtos/mais-vendidos'), true);
assert.equal(isCatalogCollectionPath('/produtos'), false);

const seo = getCatalogSeoConfig(bestSellers);
assert.equal(seo.title, 'Mais vendidos | Mercado do Vale em Petrolina-PE');
assert.equal(seo.canonical, 'https://mercadodovale.com.br/produtos/mais-vendidos');
assert.match(seo.description, /populares/i);

const defaultSeo = getCatalogSeoConfig(null);
assert.equal(defaultSeo.title, 'Mercado do Vale | Smartphones e Eletronicos em Petrolina-PE');
assert.equal(defaultSeo.canonical, 'https://mercadodovale.com.br/');

console.log('catalogCollections.test.mjs: ok');
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
node pages/catalog/catalogCollections.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` because `catalogCollections.js` does not exist yet.

- [ ] **Step 3: Create the collection helper**

Create `pages/catalog/catalogCollections.js` with this content:

```js
const SITE_ORIGIN = 'https://mercadodovale.com.br';

export const DEFAULT_CATALOG_SEO = {
  title: 'Mercado do Vale | Smartphones e Eletronicos em Petrolina-PE',
  description: 'Compre smartphones Xiaomi, Samsung, iPhones, tablets e eletronicos com os melhores precos em Petrolina-PE. Entrega rapida e garantia.',
  canonical: `${SITE_ORIGIN}/`,
  heading: 'Todos os Produtos',
  intro: '',
  ogTitle: 'Mercado do Vale | Smartphones e Eletronicos em Petrolina-PE',
  ogDescription: 'Smartphones, tablets e eletronicos com os melhores precos em Petrolina-PE.',
};

export const CATALOG_COLLECTIONS = [
  {
    key: 'featured',
    path: '/produtos/destaques',
    label: 'Destaques',
    heading: 'Produtos em destaque',
    intro: 'Aparelhos e eletronicos selecionados pela equipe do Mercado do Vale em Petrolina-PE.',
    title: 'Produtos em destaque | Mercado do Vale em Petrolina-PE',
    description: 'Veja smartphones, tablets e eletronicos em destaque no Mercado do Vale, com selecao especial, entrega rapida e garantia em Petrolina-PE.',
    filters: {
      featuredOnly: true,
      sortBy: 'featured',
    },
    source: 'featured',
  },
  {
    key: 'recent',
    path: '/produtos/mais-recentes',
    label: 'Mais recentes',
    heading: 'Produtos mais recentes',
    intro: 'Confira os ultimos smartphones, tablets e eletronicos cadastrados no catalogo.',
    title: 'Produtos mais recentes | Mercado do Vale em Petrolina-PE',
    description: 'Confira os produtos mais recentes do Mercado do Vale: smartphones, tablets e eletronicos adicionados ao catalogo em Petrolina-PE.',
    filters: {
      sortBy: 'recent',
    },
    source: 'recent',
  },
  {
    key: 'best-sellers',
    path: '/produtos/mais-vendidos',
    label: 'Mais vendidos',
    heading: 'Produtos mais vendidos',
    intro: 'Produtos populares e recomendados pela loja. Em breve esta pagina sera ordenada automaticamente pelo ranking real de vendas.',
    title: 'Mais vendidos | Mercado do Vale em Petrolina-PE',
    description: 'Conheca os produtos populares do Mercado do Vale em Petrolina-PE, com smartphones e eletronicos selecionados pela loja.',
    filters: {
      featuredOnly: true,
      sortBy: 'featured',
    },
    source: 'curated-featured-fallback',
  },
];

export function getCatalogCollectionByPathname(pathname = '') {
  return CATALOG_COLLECTIONS.find((collection) => collection.path === pathname) || null;
}

export function isCatalogCollectionPath(pathname = '') {
  return getCatalogCollectionByPathname(pathname) !== null;
}

export function getCatalogCollectionFilters(collection) {
  return collection?.filters ? { ...collection.filters } : {};
}

export function getCatalogSeoConfig(collection) {
  if (!collection) return DEFAULT_CATALOG_SEO;

  return {
    title: collection.title,
    description: collection.description,
    canonical: `${SITE_ORIGIN}${collection.path}`,
    heading: collection.heading,
    intro: collection.intro,
    ogTitle: collection.title,
    ogDescription: collection.description,
  };
}
```

- [ ] **Step 4: Run the collection config test**

Run:

```bash
node pages/catalog/catalogCollections.test.mjs
```

Expected: PASS with `catalogCollections.test.mjs: ok`.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add pages/catalog/catalogCollections.js pages/catalog/catalogCollections.test.mjs
git commit -m "feat(catalog): add seo collection config"
```

Expected: commit succeeds with only those two files.

---

### Task 2: Route New URLs To The Existing Catalog

**Files:**
- Modify: `routes/index.tsx`

- [ ] **Step 1: Add the collection routes**

In `routes/index.tsx`, locate the existing `/produtos` route:

```tsx
  {
    path: "/produtos",
    element: (
      <MaintenanceGuard>
        <CartProvider>
          <CatalogPage />
        </CartProvider>
      </MaintenanceGuard>
    )
  },
```

Insert these routes immediately after it:

```tsx
  {
    path: "/produtos/destaques",
    element: (
      <MaintenanceGuard>
        <CartProvider>
          <CatalogPage />
        </CartProvider>
      </MaintenanceGuard>
    )
  },
  {
    path: "/produtos/mais-recentes",
    element: (
      <MaintenanceGuard>
        <CartProvider>
          <CatalogPage />
        </CartProvider>
      </MaintenanceGuard>
    )
  },
  {
    path: "/produtos/mais-vendidos",
    element: (
      <MaintenanceGuard>
        <CartProvider>
          <CatalogPage />
        </CartProvider>
      </MaintenanceGuard>
    )
  },
```

- [ ] **Step 2: Run a build check**

Run:

```bash
npm run build
```

Expected: PASS. The routes compile even though they still render the default catalog behavior.

- [ ] **Step 3: Commit Task 2**

Run:

```bash
git add routes/index.tsx
git commit -m "feat(catalog): add seo collection routes"
```

Expected: commit succeeds with only `routes/index.tsx`.

---

### Task 3: Apply Collection Filters, Metadata, And Headings

**Files:**
- Modify: `pages/catalog/index.tsx`

- [ ] **Step 1: Add imports**

In `pages/catalog/index.tsx`, extend the helper imports near `catalogPagination.js` by adding:

```tsx
import {
    CATALOG_COLLECTIONS,
    getCatalogCollectionByPathname,
    getCatalogCollectionFilters,
    getCatalogSeoConfig,
} from './catalogCollections.js';
```

- [ ] **Step 2: Derive active collection and initial filters**

Inside `CatalogContent`, after `const isAllProductsPage = location.pathname === '/produtos';`, add:

```tsx
    const activeCollection = getCatalogCollectionByPathname(location.pathname);
    const catalogSeo = getCatalogSeoConfig(activeCollection);
    const isCollectionPage = !!activeCollection;
    const isHomeCatalogPage = location.pathname === '/';
```

Then update the `useCatalog` call from:

```tsx
    } = useCatalog({
        pageSize: 150, // Alto, pois ao agrupar os cards, 150 produtos brutos podem virar apenas 10 ou 15 cards Ãºnicos
        initialSearchQuery,
        initialCategory,
        bypassCache
    });
```

to:

```tsx
    } = useCatalog({
        pageSize: 150, // Alto, pois ao agrupar os cards, 150 produtos brutos podem virar apenas 10 ou 15 cards unicos
        initialFilters: getCatalogCollectionFilters(activeCollection),
        initialSearchQuery,
        initialCategory,
        bypassCache
    });
```

- [ ] **Step 3: Make Helmet route-specific**

Replace the current Helmet block:

```tsx
            <Helmet>
                <title>Mercado do Vale | Smartphones e EletrÃ´nicos em Petrolina-PE</title>
                <meta name="description" content="Compre smartphones Xiaomi, Samsung, iPhones, tablets e eletrÃ´nicos com os melhores preÃ§os em Petrolina-PE. Entrega rÃ¡pida e garantia." />
                <link rel="canonical" href="https://mercadodovale.com.br/" />
                <meta property="og:title" content="Mercado do Vale | Smartphones e EletrÃ´nicos em Petrolina-PE" />
                <meta property="og:description" content="Smartphones, tablets e eletrÃ´nicos com os melhores preÃ§os em Petrolina-PE." />
                <meta property="og:type" content="website" />
                <meta property="og:url" content="https://mercadodovale.com.br/" />
            </Helmet>
```

with:

```tsx
            <Helmet>
                <title>{catalogSeo.title}</title>
                <meta name="description" content={catalogSeo.description} />
                <link rel="canonical" href={catalogSeo.canonical} />
                <meta property="og:title" content={catalogSeo.ogTitle} />
                <meta property="og:description" content={catalogSeo.ogDescription} />
                <meta property="og:type" content="website" />
                <meta property="og:url" content={catalogSeo.canonical} />
            </Helmet>
```

- [ ] **Step 4: Make H1 route-specific**

Replace:

```tsx
            <h1 className="sr-only">Mercado do Vale â€” Smartphones e EletrÃ´nicos em Petrolina-PE</h1>
```

with:

```tsx
            <h1 className="sr-only">{catalogSeo.heading}</h1>
```

- [ ] **Step 5: Keep banners and catalog sections home-only**

Replace:

```tsx
            {!isAllProductsPage && (
```

with:

```tsx
            {isHomeCatalogPage && (
```

Replace the catalog sections condition:

```tsx
                {!isAllProductsPage && !sectionsLoading && Array.isArray(sections) && sections.length > 0 && !filters.categories.length && !searchQuery && (
```

with:

```tsx
                {isHomeCatalogPage && !sectionsLoading && Array.isArray(sections) && sections.length > 0 && !filters.categories.length && !searchQuery && (
```

- [ ] **Step 6: Render collection headings**

Replace:

```tsx
                {!filters.categories.length && !searchQuery && (
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">Todos os Produtos</h2>
                    </div>
                )}
```

with:

```tsx
                {!filters.categories.length && !searchQuery && (
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">{catalogSeo.heading}</h2>
                        {isCollectionPage && catalogSeo.intro && (
                            <p className="mt-2 max-w-3xl text-sm text-slate-600">{catalogSeo.intro}</p>
                        )}
                    </div>
                )}
```

- [ ] **Step 7: Add real shortcut links for collection names**

In `pages/catalog/index.tsx`, inside the main content header `<div className="mb-6">`, place this block after the search/filter controls and before the active filter chips:

```tsx
                    <nav
                        aria-label="Colecoes de produtos"
                        className="mt-4 flex flex-wrap gap-2"
                    >
                        <Link
                            to="/produtos"
                            className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                                !isCollectionPage && isAllProductsPage
                                    ? 'border-slate-900 bg-slate-900 text-white'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                        >
                            Todos os Produtos
                        </Link>
                        {CATALOG_COLLECTIONS.map((collection) => (
                            <Link
                                key={collection.key}
                                to={collection.path}
                                className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                                    activeCollection?.key === collection.key
                                        ? 'border-slate-900 bg-slate-900 text-white'
                                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                            >
                                {collection.label}
                            </Link>
                        ))}
                    </nav>
```

This creates explicit, crawlable internal links for `Destaques`, `Mais recentes`, and `Mais vendidos` without waiting for admin section titles to match those names.

- [ ] **Step 8: Keep collection path during pagination**

Replace:

```tsx
    const paginationPathname = getCatalogPaginationPathname({
        pathname: location.pathname,
        isAllProducts: isAllProductsListing,
    });
```

with:

```tsx
    const paginationPathname = getCatalogPaginationPathname({
        pathname: location.pathname,
        isAllProducts: isAllProductsListing && !isCollectionPage,
    });
```

- [ ] **Step 9: Remount catalog content when the pathname changes**

At the bottom of `pages/catalog/index.tsx`, replace:

```tsx
export default function CatalogPage() {
    return (
        <QuoteCartProvider>
            <CatalogContent />
        </QuoteCartProvider>
    );
}
```

with:

```tsx
export default function CatalogPage() {
    const location = useLocation();

    return (
        <QuoteCartProvider>
            <CatalogContent key={location.pathname} />
        </QuoteCartProvider>
    );
}
```

This makes collection initial filters reliable when navigating between `/produtos`, `/produtos/destaques`, `/produtos/mais-recentes`, and `/produtos/mais-vendidos` without a full browser reload.

- [ ] **Step 10: Run build check**

Run:

```bash
npm run build
```

Expected: PASS. If TypeScript complains that imported JS helpers have implicit `any`, keep the import as JS; the current repo already imports `.js` helpers from TSX in this page.

- [ ] **Step 11: Commit Task 3**

Run:

```bash
git add pages/catalog/index.tsx
git commit -m "feat(catalog): render seo collection pages"
```

Expected: commit succeeds with only `pages/catalog/index.tsx`.

---

### Task 4: Preserve Collection Pagination In Tests

**Files:**
- Modify: `pages/catalog/catalogPagination.test.mjs`

- [ ] **Step 1: Add pagination assertion**

In `pages/catalog/catalogPagination.test.mjs`, after the existing `buildCatalogPageHref` assertions, add:

```js
assert.equal(
  buildCatalogPageHref({
    pathname: '/produtos/destaques',
    searchParams: new URLSearchParams('page=1'),
    page: 2,
  }),
  '/produtos/destaques?page=2',
);
```

- [ ] **Step 2: Run pagination and collection tests**

Run:

```bash
node pages/catalog/catalogPagination.test.mjs
node pages/catalog/catalogCollections.test.mjs
```

Expected:

```text
catalogPagination.test.mjs: ok
catalogCollections.test.mjs: ok
```

- [ ] **Step 3: Commit Task 4**

Run:

```bash
git add pages/catalog/catalogPagination.test.mjs
git commit -m "test(catalog): cover collection pagination links"
```

Expected: commit succeeds with only `pages/catalog/catalogPagination.test.mjs`.

---

### Task 5: Browser And Final Verification

**Files:**
- No source changes expected unless verification reveals a defect.

- [ ] **Step 1: Run full build**

Run:

```bash
npm run build
```

Expected: PASS with Vite build output and no TypeScript errors.

- [ ] **Step 2: Start local dev server**

Run:

```bash
npm run dev -- --host 127.0.0.1 --port 5181 --strictPort
```

Expected: Vite starts at `http://127.0.0.1:5181/`. If port 5181 is busy, use port 5173 and note the changed URL in the final handoff.

- [ ] **Step 3: Verify the four catalog URLs in browser**

Open each route:

```text
http://127.0.0.1:5181/produtos
http://127.0.0.1:5181/produtos/destaques
http://127.0.0.1:5181/produtos/mais-recentes
http://127.0.0.1:5181/produtos/mais-vendidos
```

Expected:

- `/produtos` shows `Todos os Produtos`.
- `/produtos/destaques` shows `Produtos em destaque`.
- `/produtos/mais-recentes` shows `Produtos mais recentes`.
- `/produtos/mais-vendidos` shows `Produtos mais vendidos`.
- Collection pages do not show the home banner carousel or home catalog sections.
- The shortcut row contains links for `Todos os Produtos`, `Destaques`, `Mais recentes`, and `Mais vendidos`.
- Product cards render in the existing grid and pagination remains visible when enough products exist.

- [ ] **Step 4: Verify metadata in browser console**

On each collection route, run:

```js
({
  title: document.title,
  description: document.querySelector('meta[name="description"]')?.content,
  canonical: document.querySelector('link[rel="canonical"]')?.href,
  h1: document.querySelector('h1')?.textContent,
})
```

Expected for `/produtos/destaques`:

```js
{
  title: 'Produtos em destaque | Mercado do Vale em Petrolina-PE',
  description: 'Veja smartphones, tablets e eletronicos em destaque no Mercado do Vale, com selecao especial, entrega rapida e garantia em Petrolina-PE.',
  canonical: 'https://mercadodovale.com.br/produtos/destaques',
  h1: 'Produtos em destaque'
}
```

Expected for `/produtos/mais-recentes`:

```js
{
  title: 'Produtos mais recentes | Mercado do Vale em Petrolina-PE',
  description: 'Confira os produtos mais recentes do Mercado do Vale: smartphones, tablets e eletronicos adicionados ao catalogo em Petrolina-PE.',
  canonical: 'https://mercadodovale.com.br/produtos/mais-recentes',
  h1: 'Produtos mais recentes'
}
```

Expected for `/produtos/mais-vendidos`:

```js
{
  title: 'Mais vendidos | Mercado do Vale em Petrolina-PE',
  description: 'Conheca os produtos populares do Mercado do Vale em Petrolina-PE, com smartphones e eletronicos selecionados pela loja.',
  canonical: 'https://mercadodovale.com.br/produtos/mais-vendidos',
  h1: 'Produtos mais vendidos'
}
```

- [ ] **Step 5: Verify collection pagination URLs**

If pagination is visible on a collection page, click page `2`.

Expected: the browser path remains under the collection, such as:

```text
/produtos/destaques?page=2
```

It must not rewrite to `/produtos?page=2`.

- [ ] **Step 6: Check final git status**

Run:

```bash
git status --short
```

Expected: only pre-existing unrelated files remain unstaged. The files changed by this plan are committed.

---

## Self-Review

Spec coverage:

- Stable SEO URLs: Tasks 1, 2, and 3.
- Reuse current catalog: Task 3 modifies `CatalogPage` instead of creating separate page implementations.
- Names as shortcuts: Task 3 renders explicit React Router links for `Destaques`, `Mais recentes`, and `Mais vendidos`.
- Quantity per page: Task 3 keeps existing `products_per_page` and pagination logic.
- "Mais vendidos" future ranking: Task 1 marks `source: 'curated-featured-fallback'` and uses featured products as temporary source.
- Performance: Task 3 keeps home banners/sections off collection routes and reuses compact catalog loading.
- Validation: Tasks 4 and 5 cover tests, build, browser routes, metadata, and pagination path.

Placeholder scan:

- No `TBD`, `TODO`, or undefined implementation names are used.
- Every helper referenced in later tasks is defined in Task 1.

Type consistency:

- Collection filter keys match the existing `FilterState` used by `useCatalog`: `featuredOnly` and `sortBy`.
- `sortBy: 'featured'` already exists in the current `FilterState` type.
- Route paths match the approved spec exactly.
