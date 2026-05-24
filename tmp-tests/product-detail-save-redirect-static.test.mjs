import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const filePath = path.resolve('pages/admin/products/ProductDetailPage.tsx');
const source = fs.readFileSync(filePath, 'utf8');

const submitMatch = source.match(
  /const handleProductSubmit = async \(data: ProductInput\) => \{[\s\S]*?\n    \};/
);

assert.ok(submitMatch, 'ProductDetailPage deve ter handleProductSubmit.');

const submitSource = submitMatch[0];

assert.match(
  submitSource,
  /toast\.success\('Produto atualizado com sucesso!'\);\s*navigate\('\/admin\/products'\);/,
  'Ao salvar produto com sucesso pela tela de detalhe, deve voltar para /admin/products.'
);

assert.doesNotMatch(
  submitSource,
  /await fetchProduct\(\);/,
  'Ao salvar com sucesso, a tela de detalhe nao deve recarregar o proprio produto.'
);

console.log('Product detail save redirect static checks passed');
