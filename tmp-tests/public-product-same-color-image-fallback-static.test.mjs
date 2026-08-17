import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../pages/store/PublicProductPage.tsx', import.meta.url), 'utf8');

assert.match(source, /modelColorImagesService\.get\(String\(modelId\), String\(color\.id\)\)/);
assert.match(source, /model_id: String\(modelId\),[\s\S]*status: 'active'/);
assert.match(source, /siblingColor === normalizedColor/);
assert.match(source, /sameColorSibling\.images\.filter\(Boolean\)/);

console.log('OK: página pública faz fallback por variação do mesmo modelo e mesma cor.');
