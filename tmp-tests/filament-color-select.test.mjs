import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { filamentColorStyle } from '../utils/print3dFilamentInventory.mjs';
import { colorSampleStyle } from '../utils/colorAppearance.mjs';

function harness(props) {
  const values = []; let cursor = 0;
  const changes = [];
  const context = { exports: {}, require: name => {
    if (name === 'react') return {
      useEffect() {}, useRef: () => ({ current: null }),
      useState(initial) {
        const index = cursor++;
        if (!(index in values)) values[index] = initial;
        return [values[index], next => { values[index] = typeof next === 'function' ? next(values[index]) : next; }];
      }
    };
    if (name === 'react/jsx-runtime') return jsxRuntime;
    throw Error(name);
  }};
  runInNewContext(ts.transpileModule(readFileSync('components/ui/SearchableSelect.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
  }).outputText, context);
  const render = () => { cursor = 0; return context.exports.SearchableSelect({
    id: 'color', value: '', options: ['Azul', 'Dourado Translúcido', 'Preto'],
    onChange: value => changes.push(value), ...props
  }); };
  return { render, changes };
}
function nodes(tree, type) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, type));
  return [...(tree.type === type ? [tree] : []), ...nodes(tree.props?.children, type)];
}
test('pesquisa por nome ignora acentos e caixa, mas selecao entrega ID cadastrado', () => {
  const labels = { phone: 'Poco X8 Pró', cover: 'Capa para Poco X8' };
  const select = harness({ value: 'phone', options: Object.keys(labels), getOptionLabel: id => labels[id] || '' });
  assert.equal(nodes(select.render(), 'input')[0].props.value, 'Poco X8 Pró');
  nodes(select.render(), 'input')[0].props.onFocus();
  nodes(select.render(), 'input')[0].props.onChange({ target: { value: 'X8 PRO' } });
  const tree = select.render();
  assert.equal(nodes(tree, 'button').length, 1);
  nodes(tree, 'input')[0].props.onKeyDown({ key: 'Enter', preventDefault() {} });
  assert.deepEqual(select.changes, ['', 'phone']);
});
test('nomes iguais nao escolhem um ID arbitrario e texto livre nao vira modelo', () => {
  const select = harness({ options: ['first', 'second'], getOptionLabel: () => 'Modelo igual' });
  nodes(select.render(), 'input')[0].props.onFocus();
  nodes(select.render(), 'input')[0].props.onChange({ target: { value: 'Modelo igual' } });
  assert.deepEqual(select.changes, ['']);
  const tree = select.render();
  assert.equal(nodes(tree, 'button').length, 2);
  nodes(tree, 'button')[1].props.onClick();
  assert.deepEqual(select.changes, ['', 'second']);
});
const leading = name => React.createElement('i', {
  'data-swatch': name, style: filamentColorStyle(name, undefined, () => '#123456')
});

test('cada opção exibe amostra antes do nome, inclusive translúcida com RGB personalizado', () => {
  const select = harness({ renderLeading: leading });
  nodes(select.render(), 'input')[0].props.onFocus();
  const tree = select.render();
  const buttons = nodes(tree, 'button');
  assert.equal(buttons.length, 3);
  for (const button of buttons) {
    const [sample, label] = button.props.children;
    assert.equal(sample.props['aria-hidden'], 'true');
    assert.equal(sample.props.children.props['data-swatch'], label.props.children);
    assert.match(button.props.className, /flex.*items-center gap-2/);
  }
  const html = renderToStaticMarkup(tree);
  assert.match(html, /conic-gradient/);
  assert.match(html, /#1234568c/);
  buttons[1].props.onClick();
  assert.deepEqual(select.changes, ['Dourado Translúcido']);
  assert.equal(nodes(select.render(), 'ul').length, 0);
});

test('cor selecionada tem amostra à esquerda sem cobrir texto; digitação filtra e teclado seleciona', () => {
  const select = harness({ value: 'Azul', renderLeading: leading });
  let tree = select.render();
  assert.match(nodes(tree, 'input')[0].props.className, /pl-10/);
  assert.match(renderToStaticMarkup(tree), /absolute left-3/);
  nodes(tree, 'input')[0].props.onFocus();
  tree = select.render();
  assert.doesNotMatch(renderToStaticMarkup(tree), /absolute left-3/);
  nodes(tree, 'input')[0].props.onChange({ target: { value: 'translucido' } });
  tree = select.render();
  assert.equal(nodes(tree, 'button').length, 1);
  assert.match(renderToStaticMarkup(tree), /Dourado Translúcido/);
  nodes(tree, 'input')[0].props.onKeyDown({ key: 'Enter', preventDefault() {} });
  assert.deepEqual(select.changes, ['', 'Dourado Translúcido']);
});

test('seletor sem amostras mantém marcas e valores bloqueados não abrem a lista', () => {
  const plain = harness({});
  const input = nodes(plain.render(), 'input')[0];
  assert(!input.props.className.includes('pl-10'));
  input.props.onFocus();
  assert.equal(nodes(plain.render(), 'button').length, 3);
  const locked = harness({ disabled: true, value: 'Cor antiga', renderLeading: leading });
  nodes(locked.render(), 'input')[0].props.onFocus();
  assert.equal(nodes(locked.render(), 'ul').length, 0);
  assert.equal(nodes(locked.render(), 'input')[0].props.disabled, true);
});

test('cor simples e as três cores do degradê usam a mesma lista e amostra, sem mudar contratos', () => {
  const ui = readFileSync('components/print3d/FilamentCatalog.tsx', 'utf8');
  assert.equal((ui.match(/renderLeading=\{name => colorPreview\(name\)\}/g) || []).length, 2);
  assert.match(ui, /<SearchableSelect id="filament-color"/);
  assert.match(ui, /<SearchableSelect id=\{`filament-color-\$\{index\}`\}/);
  assert.match(ui, /options=\{catalog.references.colors\}/);
  assert.match(ui, /name === color \|\| !editing.colorNames\?\.includes\(name\)/);
  assert.match(ui, /catalog\?\.references.color_hex\?\.\[color\] \|\| getColorHex\(color\)/);
  assert.match(ui, /save\(editing, catalog.version, receipt\)/);
  assert.doesNotMatch(ui, /<select id="filament-color"/);
});

async function productColorHarness(service, props = {}) {
  const values = []; let cursor = 0; let mounted = false;
  const effects = []; const changes = [];
  const SearchableSelect = () => null;
  const context = { exports: {}, console: { error() {} }, require: name => {
    if (name === 'react') return { ...React,
      useId: () => 'product-color',
      useEffect: effect => { if (!mounted) effects.push(effect); },
      useState(initial) {
        const index = cursor++;
        if (!(index in values)) values[index] = initial;
        return [values[index], next => { values[index] = typeof next === 'function' ? next(values[index]) : next; }];
      },
    };
    if (name === 'react/jsx-runtime') return jsxRuntime;
    if (name === 'lucide-react') return { Plus: () => null, RefreshCw: () => null };
    if (name.endsWith('/services/colors')) return { colorService: service };
    if (name.endsWith('/colorAppearance.mjs')) return { colorSampleStyle };
    if (name.endsWith('/SearchableSelect')) return { SearchableSelect };
    throw Error(name);
  }};
  runInNewContext(ts.transpileModule(readFileSync('components/products/selectors/ColorSelect.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  }).outputText, context);
  const render = () => { cursor = 0; return context.exports.ColorSelect({ value: '', onChange: value => changes.push(value), ...props }); };
  render(); mounted = true; effects.forEach(effect => effect());
  await new Promise(resolve => setImmediate(resolve));
  return { render, changes, selector: () => nodes(render(), SearchableSelect)[0] };
}

test('variações mostram amostras do cadastro no menu e selecionam o nome, sem trocar por UUID', async () => {
  const colors = [
    { id: 'solid-id', name: 'Roxo', hex_code: '#987654' },
    { id: 'translucent-id', name: 'Dourado Translúcido', hex_code: '#123456' },
  ];
  const product = await productColorHarness({ listActive: async () => colors, getColorHex: () => '#000000' });
  const props = product.selector().props;
  assert.deepEqual(Array.from(props.options), colors.map(color => color.name));
  const dropdown = harness(props);
  nodes(dropdown.render(), 'input')[0].props.onFocus();
  const tree = dropdown.render();
  const html = renderToStaticMarkup(tree);
  assert.match(html, /background-color:#987654/);
  assert.match(html, /#1234568c/);
  assert.match(html, /conic-gradient/);
  nodes(tree, 'button')[1].props.onClick();
  assert.deepEqual(product.changes, ['Dourado Translúcido']);
  assert.equal(nodes(dropdown.render(), 'ul').length, 0);
  nodes(dropdown.render(), 'input')[0].props.onClick();
  assert.equal(nodes(dropdown.render(), 'button').length, 2, 'Clicking the still-focused field must reopen all registered colors');
  const selected = await productColorHarness({ listActive: async () => colors, getColorHex: () => '#000000' }, { value: 'Roxo' });
  assert.match(renderToStaticMarkup(harness(selected.selector().props).render()), /background-color:#987654/);
});

test('atualizar cores mantém seleção e lista anterior quando consulta falha, e permite nova tentativa', async () => {
  let fail = true;
  const service = { listActive: async () => [{ id: 'solid-id', name: 'Roxo', hex_code: '#987654' }], getColorHex: () => '#000000',
    refreshActive: async () => { if (fail) throw Error('offline'); return [{ id: 'new-id', name: 'Azul', hex_code: '#123456' }]; } };
  const product = await productColorHarness(service, { value: 'Roxo' });
  const refresh = () => nodes(product.render(), 'button').find(button => button.props.title === 'Atualizar lista de cores');
  refresh().props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(Array.from(product.selector().props.options), ['Roxo']);
  assert.equal(product.selector().props.value, 'Roxo');
  assert.equal(product.changes.length, 0);
  assert.match(renderToStaticMarkup(product.render()), /role="alert"/);
  fail = false; refresh().props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(Array.from(product.selector().props.options), ['Azul']);
  assert.equal(product.selector().props.value, 'Roxo', 'Existing value remains intact after refresh');
  assert.doesNotMatch(renderToStaticMarkup(product.render()), /role="alert"/);
});
