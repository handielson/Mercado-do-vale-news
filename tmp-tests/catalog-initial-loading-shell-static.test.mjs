import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('App.tsx', 'utf8');
const section = readFileSync('components/catalog/CatalogSection.tsx', 'utf8');
const grid = readFileSync('components/catalog/ProductGroupGrid.tsx', 'utf8');

assert.match(
  app,
  /function\s+isCatalogRouteFallback\(\)/,
  'App fallback must detect public catalog routes before rendering a route skeleton',
);

assert.match(
  app,
  /CatalogRouteFallback/,
  'App fallback must include a catalog-specific loading shell',
);

assert.match(
  app,
  /aspect-\[21\/9\]/,
  'catalog loading shell must reserve the public banner aspect ratio',
);

assert.doesNotMatch(
  app,
  /<React\.Suspense fallback=\{<AppRouteFallback \/>\}>/,
  'RouterProvider must not always use the generic PDP-like fallback',
);

assert.match(
  grid,
  /export\s+function\s+ProductCardSkeleton/,
  'ProductCardSkeleton must be exported so catalog section loading can share the final card geometry',
);

assert.match(
  section,
  /ProductCardSkeleton/,
  'CatalogSection loading must use the same card skeleton as the product grid',
);

assert.doesNotMatch(
  section,
  /<div key=\{i\} className="h-64 bg-gray-200 rounded"/,
  'CatalogSection loading must not use short anonymous blocks that collapse differently than product cards',
);
