import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('pages/admin/products/ProductCombosPage.tsx', 'utf8');

assert.match(
  page,
  /childSearchResults/,
  'offer modal must keep remote product search results separate from initial local catalog',
);
assert.match(
  page,
  /getProducts\(\{\s*search:\s*childSearchTerm\.trim\(\),\s*status:\s*'all',\s*limit:\s*80,\s*noCache:\s*true\s*\}\)/,
  'offer modal product search must query VPS with a broad search instead of relying only on the initial page',
);
assert.doesNotMatch(
  page,
  /filteredProductsToSelect[\s\S]*\.slice\(0,\s*20\)/,
  'offer modal product search must not silently cap visible results at 20',
);
assert.match(
  page,
  /Embalagem do kit/,
  'offer modal must show the package dimensions and weight being used',
);
assert.match(
  page,
  /packageMode/,
  'offer modal must track whether package values are calculated or manually edited',
);
assert.match(
  page,
  /handlePackageFieldChange/,
  'offer modal must allow editing package weight and dimensions',
);
assert.match(
  page,
  /Recalcular pelos itens/,
  'offer modal must let the operator restore package values from selected items',
);
assert.match(
  page,
  /weight_kg:\s*packageValues\.weight_kg/,
  'saved offer payload must use the visible package weight',
);
assert.match(
  page,
  /width_cm:\s*packageValues\.width_cm/,
  'saved offer payload must use the visible package width',
);

console.log('product offer search/package static checks passed');
