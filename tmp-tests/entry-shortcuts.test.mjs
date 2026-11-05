import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { entryAddUnitsPath, entryNewVariationPath } from '../services/entryShortcuts.js';

// entrada-atalhos-v1: "+ peças", "Incluir peças", "Adicionar Unidade" e "Nova variação" abrem a Entrada.
test('entryAddUnitsPath leva para a Entrada com a variação fixa', () => {
  assert.equal(entryAddUnitsPath('p1'), '/admin/entrada?variacao=p1');
  assert.equal(entryAddUnitsPath('a b/c'), '/admin/entrada?variacao=a%20b%2Fc', 'id vai codificado');
  assert.equal(entryAddUnitsPath(42), '/admin/entrada?variacao=42');
  assert.equal(entryAddUnitsPath(''), null, 'sem id não há atalho');
  assert.equal(entryAddUnitsPath(null), null);
  assert.equal(entryAddUnitsPath(undefined), null);
});

test('entryNewVariationPath usa o modelo do pai; sem modelo fica no fluxo antigo', () => {
  assert.equal(entryNewVariationPath({ model_id: 'm1' }), '/admin/entrada?aba=manual&modelo=m1');
  assert.equal(entryNewVariationPath({ id: 'p', model_id: 'm 2' }), '/admin/entrada?aba=manual&modelo=m%202');
  assert.equal(entryNewVariationPath({ id: 'p' }), null, 'pai importado do Bling sem model_id');
  assert.equal(entryNewVariationPath({ model_id: '' }), null);
  assert.equal(entryNewVariationPath({ model_id: null }), null);
  assert.equal(entryNewVariationPath(null), null);
  assert.equal(entryNewVariationPath(undefined), null);
});

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(name)) out.push(full);
  }
  return out;
}

const detailPath = join('pages', 'admin', 'products', 'ProductDetailPage.tsx');

test('nenhum atalho monta mais addUnit=1; só a Página do Produto lê o link antigo', () => {
  const offenders = [];
  for (const file of [...walk('pages'), ...walk('components')]) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (!/addUnit\b/.test(line)) return;
      const isRedirectReader = file === detailPath && /get\('addUnit'\) === '1'/.test(line);
      const isComment = /^\s*(\/\/|\*|\{\/\*)/.test(line);
      if (!isRedirectReader && !isComment) offenders.push(`${file}:${index + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(offenders, [], 'atalhos devem usar entryAddUnitsPath');
});

test('Página do Produto: addUnit=1 redireciona; Adicionar Unidade e nova variação vão para a Entrada', () => {
  const detail = readFileSync(detailPath, 'utf8');
  assert.match(detail, /get\('addUnit'\) === '1'/, 'continua lendo o link antigo');
  assert.match(detail, /navigate\(entryAddUnitsPath\(id\)[^)]*, \{ replace: true \}\)/, 'link antigo redireciona com replace');
  assert.doesNotMatch(detail, /<UnitForm\b/, 'formulário embutido saiu');
  assert.doesNotMatch(detail, /handleUnitSubmit|showUnitForm/, 'estado do formulário embutido saiu');
  assert.match(detail, /entryAddUnitsPath\(product\.id\)/, 'Adicionar Unidade abre a Entrada');
  assert.match(detail, />\s*Adicionar Unidade\s*</, 'rótulo mantido');
  assert.match(detail, /entryNewVariationPath\(product\)/, 'nova variação usa o modelo do pai');
  assert.match(detail, /getFamilyChildState\(product\)/, 'pai sem modelo continua no fluxo antigo');
});

test('todos os botões usam as funções da Entrada', () => {
  const read = (file) => readFileSync(file, 'utf8');
  const store = read('pages/store/PublicProductPage.tsx');
  assert.match(store, /const addUnitsUrl = isAdmin && sib\.id\s*\?\s*entryAddUnitsPath\(sib\.id\)/);

  const list = read('components/products/ProductList.tsx');
  assert.match(list, /navigate\(entryAddUnitsPath\(product\.id\)/, 'ProductList "+ peças"');

  const form = read('components/products/ProductForm.tsx');
  assert.match(form, /entryAddUnitsPath\(variant\.id\)/, 'ProductForm "+ peças"');
  assert.match(form, /entryNewVariationPath\(modelFamily\.parent\)/, 'ProductForm "Criar nova variação nesta família"');
  assert.match(form, /getFamilyChildState\(modelFamily\.parent\)/, 'ProductForm: pai sem modelo no fluxo antigo');

  const aggregator = read('pages/admin/products/ModelProductAggregatorPage.tsx');
  assert.match(aggregator, /entryAddUnitsPath\(/, 'ModelProductAggregator "Incluir peças"');
  assert.match(aggregator, /entryNewVariationPath\(familyParent\)/, 'ModelProductAggregator "Nova variação"');
  assert.match(aggregator, /getFamilyChildState\(familyParent\)/, 'ModelProductAggregator: pai sem modelo no fluxo antigo');

  const listPage = read('pages/admin/products/ProductListPage.tsx');
  assert.match(listPage, /entryNewVariationPath\(parent\)/, 'ProductListPage onAddVariation');
  assert.match(listPage, /getFamilyChildState\(parent\)/, 'ProductListPage: pai sem modelo no fluxo antigo');
});
