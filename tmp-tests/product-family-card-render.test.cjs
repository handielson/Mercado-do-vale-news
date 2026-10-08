const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const source = fs.readFileSync('components/products/ProductList.tsx', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
const mod = { exports: {} };
const icon = () => null;
vm.runInNewContext(compiled, { exports: mod.exports, module: mod, require(name) {
  if (name === 'react') return React;
  if (name === 'lucide-react') return { ChevronDown: icon, Copy: icon, Package: icon };
  if (name === 'sonner') return { toast: {} };
  if (name === './CatalogTitleEditor') return { CatalogTitleEditor: () => null };
  if (name === './ProductCard') return { ProductCard: props => React.createElement('section', { 'data-product': props.product.id }, props.product.name, props.familyVariants) };
  if (name.includes('modelProductAggregator')) return { getProductVariationSpecs: p => ({ color: p.specs.color, ram: p.specs.ram || '', storage: p.specs.storage || '' }) };
  throw new Error(`Unexpected dependency: ${name}`);
} });
const parent = { id: 'parent', name: 'Nome oficial do pai', sku: 'PAI', images: [], specs: {} };
const child = { id: 'child', name: 'Nome diferente do filho', sku: 'FILHO', parent_id: parent.id, images: ['filho.jpg'], stock_quantity: 3, specs: { color: 'Preto', ram: '8GB', storage: '256GB' } };
const group = { key: 'family', isFamily: true, parent, representative: child, familyProducts: [parent, child], totalStock: 3 };
function render(extra = {}) {
  return renderToStaticMarkup(React.createElement(mod.exports.ProductList, { products: [parent, child], groups: [group], isLoading: false, onEditProduct() {}, ...extra }));
}
test('família mantém o card completo do pai, sem substituir pela variação', () => {
  const html = render();
  assert.match(html, /Nome oficial do pai/);
  assert.match(html, /Pai: PAI/);
  assert.match(html, /Estoque da família: 3 un/);
  assert.match(html, /data-product="parent"/);
  assert.doesNotMatch(html, /data-product="child"|filho.jpg|Nome diferente do filho/);
});
test('detalhes usam o pai e mantêm seleção e edição explícitas dos filhos', () => {
  const html = render({ selectionMode: true, selectedIds: new Set(['child']), onToggleSelect() {} });
  assert.match(html, /data-product="parent"/);
  assert.doesNotMatch(html, /data-product="child"/);
  assert.match(html, /Selecionar SKU FILHO/);
  assert.match(html, /checked=""/);
  assert.match(html, /Editar somente Preto/);
  assert.match(html, /8GB RAM/);
});
test('todos os cards preservam mídia, atalhos, nome e SKU antes da expansão', () => {
  const card = fs.readFileSync('components/products/ProductCard.tsx', 'utf8');
  const cutoff = card.indexOf('<div id={detailsId} hidden={!showDetails}');
  assert.ok(cutoff > card.indexOf('SKU: {product.sku}'));
  assert.ok(cutoff > card.indexOf('title="Copiar nome"'));
  assert.ok(cutoff > card.indexOf('alt={product.name}'));
  assert.ok(cutoff < card.indexOf('<ProductPublicationChannels'));
  assert.ok(cutoff < card.indexOf('{familyVariants}', cutoff));
  assert.match(card, /useState\(false\)/);
  assert.match(card, /aria-expanded={showDetails}/);
  assert.match(card, /setDetailsExpanded\(value => !value\)/);
  assert.doesNotMatch(source, /showDetails &&|h-14 w-14/);
});
test('família órfã informa que falta vincular pai', () => {
  const html = render({ groups: [{ ...group, parent: null, familyProducts: [child] }] });
  assert.match(html, /Família sem pai vinculado/);
  assert.doesNotMatch(html, /Pai: FILHO/);
});
