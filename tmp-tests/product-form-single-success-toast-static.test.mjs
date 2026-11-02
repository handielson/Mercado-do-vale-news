import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('components/products/ProductForm.tsx', 'utf8');

assert.match(
  source,
  // "isNewRegistration" = produto novo ou rascunho ainda sem id (rascunho automático); edição de produto existente fica de fora.
  /await onSubmit\(mergedData\) as Product \| undefined;[\s\S]*if \(isNewRegistration\) \{\s*toast\.success\('Produto cadastrado com sucesso!'\);\s*\}\s*registrationCompletedRef\.current = \{ savedProductId: savedProduct\?\.id \};\s*await onBatchComplete\?\.\(savedProduct \|\| undefined, captureDraftSnapshot\(\)\);/s,
  'ProductForm must only show the single-product creation success toast when creating a new product, so edit flow keeps only the update toast from ProductFormPage.'
);

assert.match(source, /const isNewRegistration = !initialData \|\| Boolean\(initialDraft && !initialData\.id\);/, 'isNewRegistration nunca inclui produto existente');
console.log('ok - ProductForm single-product success toast is create-only');
