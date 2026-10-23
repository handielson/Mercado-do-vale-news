import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('nova variação escolhe RAM e armazenamento das listas ativas', () => {
  const editor = readFileSync(new URL('../components/products/ProductFamilyEditor.tsx', import.meta.url), 'utf8');
  const selector = readFileSync(new URL('../components/products/selectors/CapacitySelect.tsx', import.meta.url), 'utf8');

  assert.match(editor, /attribute\.key === 'ram' \|\| attribute\.key === 'storage' \? <CapacitySelect/);
  assert.match(editor, /type=\{attribute\.key\} value=\{attribute\.value\}/);
  assert.match(selector, /ramService\.listActive\(\)/);
  assert.match(selector, /storageService\.listActive\(\)/);
  assert.match(selector, /value && !capacities\.some\(capacity => capacity\.label === value\)/);
});
