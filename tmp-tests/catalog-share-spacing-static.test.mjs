import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../utils/catalogMessageGenerator.ts', import.meta.url), 'utf8');

assert.match(source, /const brandBlocks = groupedByBrand\.map\(\(\{ brand, items \}\) =>/);
assert.match(source, /productBlocks\.join\('\\n━━━━━━━━━━━━━━━━━━━━━━\\n'\)/);
assert.match(source, /brandBlocks\.join\('\\n\\n━━━━━━━━━━━━━━━━━━━━━━\\n\\n'\)/);
assert.match(source, /const lines = \[`\$\{productIndex\+\+\}\. \*\$\{item\.name\}\*`\];/);
assert.doesNotMatch(source, /message \+= `\$\{buildSharedColorLines\(item\.colors\)\.join\('\n'\)\}\\n`;/);

console.log('catalog share spacing static checks passed');
