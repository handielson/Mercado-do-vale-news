import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { selectCatalogCardProduct } from '../components/catalog/modernProductCardState.js';
import {
  getPublicProductDisambiguatedRouteTarget,
  getPublicProductRouteTarget,
  getPublicProductVariantRouteTarget,
} from '../pages/store/productRouteTarget.js';

const greenVariant = {
  id: '0e381a4b-fcdd-4989-9dee-c73ed0f12f77',
  sku: 'PC858256V',
  slug: 'poco-c85',
  specs: { color: 'Verde', ram: '8GB', storage: '256GB' },
};

const purpleVariant = {
  id: '030b8a2e-85a9-47aa-a4a3-bd1d2e66b565',
  sku: 'PC858256R',
  slug: 'poco-c85',
  specs: { color: 'Roxo', ram: '8GB', storage: '256GB' },
};

assert.equal(
  getPublicProductRouteTarget(greenVariant),
  'poco-c85',
  'catalog links must keep the readable slug even when duplicate records share it',
);

assert.equal(
  getPublicProductVariantRouteTarget(greenVariant, [greenVariant, purpleVariant]),
  'poco-c85-verde-8gb-256gb',
  'variant navigation must use a readable unique URL when another product shares the same slug',
);

assert.equal(
  getPublicProductDisambiguatedRouteTarget({
    id: 'efbf25ff-c705-4034-8d37-766be5a8c0fa',
    sku: 'PX85G12512A',
    slug: 'poco-x8-pro',
    specs: { color: 'Amarelo', ram: '12GB', storage: '512GB' },
  }),
  'poco-x8-pro-amarelo-12gb-512gb',
  'UUID routes must be replaceable with the readable selected-variation URL',
);

assert.equal(
  getPublicProductRouteTarget({ id: 'single-id', slug: 'redmi-note-15' }, []),
  'redmi-note-15',
  'single products should keep their SEO slug',
);

assert.equal(
  getPublicProductRouteTarget({ id: 'no-slug-id', name: 'Athomics Inspire Lite' }),
  'athomics-inspire-lite',
  'products without a saved slug should derive one from the product name',
);

// Execute the actual card handler with a filtered group that cannot know about
// the other color sharing its slug, rather than duplicating the URL expression.
const require = createRequire(import.meta.url);
const ts = require('typescript');
const cardSource = readFileSync('components/catalog/ModernProductCard.tsx', 'utf8');
const cardAst = ts.createSourceFile('ModernProductCard.tsx', cardSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let titleHandler;
function findTitleHandler(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(cardAst) === 'handleTitleClick') {
    titleHandler = node.initializer.getText(cardAst);
  }
  ts.forEachChild(node, findTitleHandler);
}
findTitleHandler(cardAst);
assert.ok(titleHandler, 'catalog title click handler must exist');
const handlerJs = ts.transpileModule(`const click = ${titleHandler};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

const black = {
  id: '2d48d982-7692-4335-ae98-87ef3c9cf537', sku: 'RN15P8256P',
  slug: 'redmi-note-15-pro-4g', specs: { color: 'Preto', ram: '8GB', storage: '256GB' },
};
const titanium = {
  ...black, id: 'f36851c8-935f-4051-87ea-45c719524465', sku: 'RN15P8256T',
  specs: { ...black.specs, color: 'Titânio' },
};
for (const fixture of [
  { product: black, products: [black], colors: [{ name: 'Preto' }], colorIndex: 0, expected: black },
  { product: black, products: [black, titanium], colors: [{ name: 'Preto' }, { name: 'Titânio' }], colorIndex: 1, expected: titanium },
  { product: { ...black, slug: '' }, products: [], colors: [], colorIndex: -1, expected: black },
]) {
  const selectedVariant = { products: fixture.products, colors: fixture.colors };
  const currentProduct = selectCatalogCardProduct({ product: fixture.product, selectedVariant, currentColorIndex: fixture.colorIndex });
  let navigated;
  let propagationStopped = false;
  vm.runInNewContext(`${handlerJs}\nclick({ stopPropagation() { stopped(); } });`, {
    product: fixture.product, currentProduct,
    productGroup: { variants: [selectedVariant] }, relatedProducts: [],
    navigate: (url) => { navigated = url; },
    stopped: () => { propagationStopped = true; },
    getPublicProductVariantRouteTarget,
  });
  assert.equal(navigated, `/produto/${fixture.expected.id}`, 'navigation must resolve the exact selected SKU, regardless of filtered peers or missing slug');
  assert.equal(propagationStopped, true);
}
assert.equal(getPublicProductDisambiguatedRouteTarget(black), 'redmi-note-15-pro-4g-preto-8gb-256gb');

console.log('public product route target checks passed');
