const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function fixture() {
  const state = { loads: 0, changed: null, noCache: null };
  const source = fs.readFileSync(require.resolve('../components/products/CategorySelect.tsx'), 'utf8');
  const context = { exports: {}, console, require(name) {
    if (name === 'react') return { ...React, useState: initial => [Array.isArray(initial) ? [{ id: '3d', name: '3D' }] : initial, () => {}], useEffect: () => {}, useMemo: fn => fn() };
    if (name === 'lucide-react') return { Plus: () => null, RefreshCw: () => null, X: () => null };
    if (name.endsWith('/categories')) return { categoryService: { list: async noCache => { state.loads++; state.noCache = noCache; return []; }, create: () => assert.fail('shortcut must not create categories') } };
    if (name.endsWith('/categorySelectTree')) return { buildCategorySelectGroups: items => items.map(item => ({ ...item, options: [{ ...item, depth: 0, path: item.name }] })) };
    throw Error('Unexpected import ' + name);
  } };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, context);
  const tree = context.exports.CategorySelect({ value: '3d', onChange: value => { state.changed = value; } });
  const elements = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    elements.push(node);
    visit(node.props?.children);
  }
  visit(tree);
  return { state, tree, elements };
}

test('category shortcut opens the complete new-category route in another tab without submitting the product', () => {
  const { tree, elements } = fixture();
  const shortcut = elements.find(node => node.type === 'a' && node.props.href === '/admin/settings/categories/new');
  assert.ok(shortcut, 'new category must link to canonical creation page');
  assert.equal(shortcut.props.target, '_blank');
  assert.match(shortcut.props.rel, /noopener/);
  assert.match(shortcut.props['aria-label'], /Nova categoria/);
  assert.ok(!elements.some(node => node.type === 'form'), 'no nested category form');
  const html = renderToStaticMarkup(tree);
  assert.match(html, /value="3d" selected=""/);
  const routes = fs.readFileSync(require.resolve('../routes/index.tsx'), 'utf8');
  assert.ok(routes.includes('path: "/admin/settings/categories/new"'));
});

test('refresh reloads categories and selection still passes the original category ID', async () => {
  const { state, elements } = fixture();
  const refresh = elements.find(node => node.type === 'button' && node.props.title === 'Atualizar lista de categorias');
  assert.equal(refresh.props.type, 'button');
  await refresh.props.onClick();
  assert.equal(state.loads, 1);
  assert.equal(state.noCache, true);
  elements.find(node => node.type === 'select').props.onChange({ target: { value: 'child-id' } });
  assert.equal(state.changed, 'child-id');
});
