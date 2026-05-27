import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('components/products/LabelPrintModal.tsx', 'utf8');

assert.match(
  source,
  /const handleCopiesChange = \(value: string\) => \{/,
  'LabelPrintModal must use a controlled copy-count change handler.'
);

assert.match(
  source,
  /const adjustCopies = \(delta: number\) => \{/,
  'LabelPrintModal must expose minus/plus copy adjustment.'
);

assert.match(
  source,
  /type="text"\s+inputMode="numeric"\s+pattern="\[0-9\]\*"/s,
  'Copy count input must be text with numeric input mode to avoid native number arrows.'
);

assert.match(
  source,
  /onFocus=\{\(e\) => e\.currentTarget\.select\(\)\}\s+onClick=\{\(e\) => e\.currentTarget\.select\(\)\}/s,
  'Copy count input must select all content on focus and click.'
);

assert.match(
  source,
  /onClick=\{\(\) => adjustCopies\(-1\)\}[\s\S]*>[\s\r\n]*-[\s\r\n]*<\/button>[\s\S]*onClick=\{\(\) => adjustCopies\(1\)\}[\s\S]*>[\s\r\n]*\+[\s\r\n]*<\/button>/,
  'Copy count control must render - and + buttons.'
);

console.log('ok - label copy count uses minus/plus stepper and select-all input');
