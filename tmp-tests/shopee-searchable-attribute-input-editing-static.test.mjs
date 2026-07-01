import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');

assert.match(
  page,
  /const\s+focusedRef\s*=\s*useRef\(false\)/,
  'Searchable Shopee attribute input must track focus so local edits are not overwritten.'
);

assert.match(
  page,
  /previousAttributeIdRef\s*=\s*useRef<number \| null>\(null\)/,
  'Searchable Shopee attribute input must still resync when rendering another attribute.'
);

assert.match(
  page,
  /const\s+attributeChanged\s*=\s*previousAttributeIdRef\.current\s*!==\s*attributeId[\s\S]*if\s*\(\s*focusedRef\.current\s*&&\s*!\s*attributeChanged\s*\)\s*return[\s\S]*setQuery\(getShopeeAttributeDisplayValue\(value\)\)/,
  'Searchable Shopee attribute input must not reset the typed text while the field is focused.'
);

assert.match(
  page,
  /const\s+handleFocus\s*=\s*\(\)\s*=>\s*\{[\s\S]*focusedRef\.current\s*=\s*true/,
  'Searchable Shopee attribute input must mark itself focused before searching.'
);

assert.match(
  page,
  /const\s+handleBlur\s*=\s*\(\)\s*=>\s*\{[\s\S]*focusedRef\.current\s*=\s*false/,
  'Searchable Shopee attribute input must clear focused state after editing.'
);

assert.match(
  page,
  /onBlur=\{handleBlur\}/,
  'Searchable Shopee attribute input must wire blur handling on the text field.'
);

console.log('shopee searchable attribute input editing static checks passed');
