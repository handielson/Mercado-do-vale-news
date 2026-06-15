import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const catalogSource = readFileSync('pages/catalog/index.tsx', 'utf8');

assert.match(
  catalogSource,
  /import\s+\{\s*ProductGroupGrid\s*,\s*ProductCardSkeleton\s*\}\s+from\s+['"]@\/components\/catalog\/ProductGroupGrid['"]/,
  'catalog page should reuse the same product card skeleton used by product grids',
);

const placeholderIndex = catalogSource.indexOf('aria-label="Secoes do catalogo carregando"');
const realSectionsIndex = catalogSource.indexOf('!sectionsLoading && Array.isArray(sections)');
const allProductsHeadingIndex = catalogSource.indexOf('<h2 className="text-2xl font-bold text-gray-900">{catalogSeo.heading}</h2>');

assert.notEqual(
  placeholderIndex,
  -1,
  'catalog home should reserve vertical space while async catalog sections are loading',
);
assert.ok(
  placeholderIndex < realSectionsIndex,
  'the sections placeholder should live before the real async sections block',
);
assert.ok(
  placeholderIndex < allProductsHeadingIndex,
  'the sections placeholder should reserve space before the all-products grid can render',
);

assert.match(
  catalogSource,
  /isHomeCatalogPage\s*&&\s*sectionsLoading\s*&&[\s\S]*!filters\.categories\.length\s*&&\s*!hasActiveSearch/,
  'the sections placeholder should only render on the home catalog before category/search results',
);
assert.match(
  catalogSource,
  /Array\.from\(\{\s*length:\s*4\s*\}\)[\s\S]*<ProductCardSkeleton/,
  'the sections placeholder should reserve a mobile row of product cards',
);
