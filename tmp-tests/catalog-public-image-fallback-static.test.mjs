import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const source = fs.readFileSync(path.join(root, 'services/catalogService.ts'), 'utf8');

assert.match(
  source,
  /Promise\.allSettled\(\[\s*modelColorImagesService\.getByModelIds\(modelIds\)/s,
  'public catalog image fallback must not reject the whole catalog when model-color images are unavailable'
);

assert.match(
  source,
  /Fallback de imagens por modelo\/cor indisponivel/,
  'public catalog should log optional image fallback failures explicitly'
);

assert.doesNotMatch(
  source,
  /const \[modelImages, colorRows\] = await Promise\.all\(/,
  'public catalog must not use fail-fast Promise.all for optional image fallback dependencies'
);

console.log('catalog public image fallback static checks passed');
