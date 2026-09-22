import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('utils/catalogMessageGenerator.ts', 'utf8');

assert.match(source, /const ram = rawRam;\s*const storage = rawStorage;/,
  'catalog sharing must preserve missing memory fields as empty values');
assert.match(source, /const memoryLabel = \[item\.variant\.ram, item\.variant\.storage\]\.filter\(Boolean\)\.join\('\/'\);/,
  'catalog sharing must build a memory label only from available fields');
assert.match(source, /if \(memoryLabel\) \{[\s\S]*message \+= `\s+📱 \$\{memoryLabel\}\\n`;/,
  'catalog sharing must omit the smartphone line when both fields are absent');
assert.doesNotMatch(source, /const ram = rawRam \|\| 'N\/A'/,
  'catalog sharing must not default RAM to N/A');
assert.doesNotMatch(source, /const storage = rawStorage \|\| 'N\/A'/,
  'catalog sharing must not default storage to N/A');

console.log('catalog share optional memory regression: ok');
