import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/store/PublicProductPage.tsx', 'utf8');

assert.match(
  source,
  /const getMemoryGroupLabel = \(parts: \{ storage: string; ram: string \}\) =>/,
  'PDP must build a memory group label from RAM plus storage',
);

assert.match(
  source,
  /\$\{parts\.ram\} de Ram \| \$\{parts\.storage\} de armazenamento/,
  'PDP memory group label must render "X de Ram | X de armazenamento"',
);

assert.match(
  source,
  /const key = getMemoryGroupLabel\(parts\);/,
  'PDP variant grouping must use RAM plus storage as the group key',
);

assert.match(
  source,
  /<h4 className="text-sm font-semibold text-slate-800">\{group\.memoryLabel\}<\/h4>/,
  'PDP variant UI must show the RAM/storage combination heading',
);

assert.match(
  source,
  /style=\{\{\s*borderColor: getVariantColorBorder\(color\)/,
  'PDP color variation buttons must tint the border according to the color name',
);

assert.match(
  source,
  /const buttonLabel = color;/,
  'PDP color buttons must render only the color under the memory combination heading',
);

assert.doesNotMatch(
  source,
  /const key = parts\.storage;/,
  'PDP variant grouping must not group only by storage',
);

console.log('PDP RAM/storage/color variation static checks passed');
