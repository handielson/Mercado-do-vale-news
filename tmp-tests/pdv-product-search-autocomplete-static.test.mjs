import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/pdv/ProductSearchSection.tsx', 'utf8');

assert.match(
  source,
  /type ProductSearchOptions = \{\s*autoAddSingle\?: boolean\s*\}/s,
  'Product search must expose an explicit auto-add option',
);

assert.match(
  source,
  /setTimeout\(\(\) => handleSearch\(\{ autoAddSingle: false \}\), 500\)/,
  'Debounced typing search must only list results, not auto-add or switch tabs',
);

assert.match(
  source,
  /if \(cards\.length === 1 && options\.autoAddSingle === true\)/,
  'Single-result auto-add must be limited to explicit actions',
);

assert.match(
  source,
  /if \(e\.key === 'Enter'\) handleSearch\(\{ autoAddSingle: true \}\)/,
  'Enter must keep the scanner/keyboard shortcut for explicit single-result add',
);

console.log('pdv product search autocomplete static checks passed');
