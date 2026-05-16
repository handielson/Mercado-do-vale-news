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
  /top-full[\s\S]*max-h-60[\s\S]*overflow-y-auto/,
  'offer modal product search results must expand inline instead of using an internal scroll dropdown',
);
assert.match(
  page,
  /item\(ns\) incluso\(s\) no combo/,
  'offer modal must keep the included combo items visible while products are selected',
);
assert.match(
  page,
  /handleToggleSearchProductSelection/,
  'offer modal must expose a checkbox-style handler that adds/removes products from the combo',
);
assert.match(
  page,
  /Marcar um produto na busca já inclui ele nesta lista/,
  'offer modal must clarify that checked search results are already included in the combo',
);
assert.match(
  page,
  /handleAddProductFamily/,
  'offer modal must allow adding all variations from a parent product',
);
assert.match(
  page,
  /filteredProductFamiliesToSelect/,
  'offer modal must group matching products by parent/family before adding variations',
);
assert.match(
  page,
  /getProductsByParentId\(parentId\)/,
  'offer modal must fetch variation siblings by parent id instead of requiring one-by-one selection',
);
assert.match(
  page,
  /Famílias encontradas/,
  'offer modal must render a dedicated parent/family selection area',
);
assert.match(
  page,
  /Selecionar PAI e incluir família/,
  'offer modal must expose a clear parent selection action that adds the full family',
);
assert.match(
  page,
  /Incluir todos visíveis/,
  'offer modal must render a clear action for adding all visible search results',
);
assert.match(
  page,
  /Adicionar familia/,
  'offer modal must render a clear action for adding a product family',
);
assert.match(
  page,
  /const packageValues = packageMode === 'manual' && packageDraft \? packageDraft : calculatedPackage;/,
  'offer modal package fields must have visible default values even before products are selected',
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
