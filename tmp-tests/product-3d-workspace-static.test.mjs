import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = path => fs.readFileSync(path, 'utf8');

test('produto 3D usa um fluxo único entre cadastro, produção e sites', () => {
  const nav = read('components/products/ProductWorkspaceNav.tsx');
  assert.match(nav, /1\. Cadastro/);
  assert.match(nav, /2\. Produção 3D/);
  assert.match(nav, /3\. Sites e preços/);
  assert.match(nav, /product_id=/);

  const form = read('components/products/ProductForm.tsx');
  assert.match(form, /Arquivos e ficha de produção/);
  assert.match(form, /onBatchComplete\?\.\(savedProduct \|\| undefined\)/);

  const page = read('pages/admin/products/ProductFormPage.tsx');
  assert.match(page, /savedProduct\?\.is_print3d/);
  assert.match(page, /calculadora\?product_id=/);
});

test('produção abre pelo produto e mantém origem e arquivos na revisão', () => {
  const source = read('pages/admin/products/Print3dCostPage.tsx');
  assert.match(source, /searchParams\.get\('product_id'\)/);
  assert.match(source, /productService\.getById\(selectedProductId\)/);
  assert.match(source, /Link de origem do projeto/);
  assert.match(source, /sourceUrl/);
  assert.match(source, /Arquivos privados desta revisão/);
  assert.match(source, /print3dRecipeFilesService\.upload/);
});
