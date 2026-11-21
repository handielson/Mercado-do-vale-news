// PDV: termo de garantia reconhece o aparelho pela categoria do produto ou por uma categoria acima dela
// (bug de 21/11/2026: categoria "Smartphones" dentro de "Celulares" ficava sem termo e o botão não fazia nada).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { isWarrantyTermCategoryValue, isWarrantyTermCategoryTree } = await import('../utils/warrantyTermCategory.ts');

for (const v of ['Smartphones', 'smartphones', 'Smartphone', 'Celulares', 'celular', 'Smartphones e Tablets', 'smartphones-e-tablet']) assert.equal(isWarrantyTermCategoryValue(v), true, v);
for (const v of ['Smartwatch', 'Suporte para Celulares', 'Para Smart TV', '', null]) assert.equal(isWarrantyTermCategoryValue(v), false, String(v));

const cats = {
  smart: { id: 'smart', name: 'Smartphones', slug: 'smartphones', parent_id: 'cel' },
  cel: { id: 'cel', name: 'Celulares', slug: 'celulares', parent_id: null },
  sub: { id: 'sub', name: 'Linha Poco', slug: 'linha-poco', parent_id: 'cel' },
  sup: { id: 'sup', name: 'Suporte para Celulares', slug: 'suporte-para-celulares', parent_id: 'aces' },
  aces: { id: 'aces', name: 'Acessórios', slug: 'acessorios', parent_id: null },
  loop: { id: 'loop', name: 'X', slug: 'x', parent_id: 'loop' },
};
const getById = async id => cats[id] || null;
assert.equal(await isWarrantyTermCategoryTree('smart', getById), true);
assert.equal(await isWarrantyTermCategoryTree('sub', getById), true, 'subcategoria de Celulares');
assert.equal(await isWarrantyTermCategoryTree('sup', getById), false);
assert.equal(await isWarrantyTermCategoryTree('loop', getById), false, 'ciclo não trava');
assert.equal(await isWarrantyTermCategoryTree(null, getById), false);

const pdv = readFileSync(new URL('../pages/pdv/PDVPage.tsx', import.meta.url), 'utf8');
assert.ok(pdv.includes('isWarrantyTermCategoryTree('), 'PDV usa a árvore de categorias');
assert.ok(!/console\.warn\('Template de garantia não configurado ou venda sem aparelho elegível'\);\s*return;/.test(pdv), 'botão não fica mudo');

console.log('pdv warranty term category ok');
