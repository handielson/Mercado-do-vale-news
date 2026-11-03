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
  if (name === 'lucide-react') return { ChevronDown: icon, Copy: icon, Package: icon, Pencil: icon, Plus: icon };
  if (name === 'react-router-dom') return { useNavigate: () => () => {} };
  if (name === 'sonner') return { toast: {} };
  if (name === './CatalogTitleEditor') return { CatalogTitleEditor: () => null };
  if (name === './ProductCard') return { ProductCard: props => React.createElement('section', { 'data-product': props.product.id }, props.product.name, props.familyStockSummary, props.familyVariants) };
  if (name.includes('modelProductAggregator')) return { getProductVariationSpecs: p => ({ color: p.specs.color, ram: p.specs.ram || '', storage: p.specs.storage || '' }) };
  throw new Error(`Unexpected dependency: ${name}`);
} });
const parent = { id: 'parent', name: 'Nome oficial do pai', sku: 'PAI', images: [], specs: {} };
const child = { id: 'child', name: 'Nome diferente do filho', sku: 'FILHO', parent_id: parent.id, images: ['filho.jpg'], stock_quantity: 3, specs: { color: 'Preto', ram: '8GB', storage: '256GB' } };
const group = { key: 'family', isFamily: true, parent, representative: child, familyProducts: [parent, child], matchedProducts: [], totalStock: 3 };
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
  assert.match(html, /aria-label="Editar variação Preto · FILHO"/);
  assert.doesNotMatch(html, /Editar somente/);
  assert.match(html, /8GB RAM/);
});
test('resumo lista cada cor com atalho "+ peças" (inclusive zerada) e fica antes dos detalhes da família', () => {
  const empty = { ...child, id: 'empty', sku: 'ZERADO', stock_quantity: 0, specs: { ...child.specs, color: 'Azul' } };
  const html = render({ groups: [{ ...group, familyProducts: [parent, child, empty] }] });
  const summary = html.slice(html.indexOf('aria-label="Estoque disponível para venda"'), html.indexOf('aria-label="SKUs da família"'));
  assert.match(summary, /Disponível para vender: 3 un/, 'o total soma so estoque positivo');
  assert.match(summary, /Preto \(3 un\.\)/);
  assert.match(summary, /8GB\/256GB/);
  assert.match(summary, /class="text-slate-400">Azul \(0 un\.\)/, 'cor zerada aparece apagada para poder receber pecas');
  assert.match(summary, /aria-label="Incluir mais peças de Preto · 8GB RAM · 256GB armazenamento"/);
  assert.match(summary, /aria-label="Incluir mais peças de Azul · 8GB RAM · 256GB armazenamento"/);
  assert.doesNotMatch(summary, /Nova variação/, 'sem pai marcado como familia nao oferece nova variacao');
  const familyParent = { ...parent, is_parent: 1 };
  const withParent = render({ groups: [{ ...group, parent: familyParent, familyProducts: [familyParent, child] }], onAddVariation() {} });
  assert.match(withParent, /Nova variação \(cor\/memória\)/);
});
test('todos os cards preservam mídia, atalhos, nome e SKU antes da expansão', () => {
  const card = fs.readFileSync('components/products/ProductCard.tsx', 'utf8');
  const cutoff = card.indexOf('<div id={detailsId} hidden={!showDetails}');
  assert.ok(cutoff > card.indexOf('SKU: {product.sku}'));
  const titleEditor = card.indexOf('<CatalogTitleEditor product={product} inline />');
  assert.ok(titleEditor > card.indexOf('</h3>'));
  assert.ok(titleEditor < card.indexOf('SKU: {product.sku}'));
  assert.equal(card.match(/<CatalogTitleEditor /g).length, 1);
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
