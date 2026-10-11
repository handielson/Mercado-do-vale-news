import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { filamentColorStyle } from '../utils/print3dFilamentInventory.mjs';

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
