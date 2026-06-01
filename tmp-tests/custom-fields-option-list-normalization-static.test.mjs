import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const service = fs.readFileSync(path.join(root, 'services/custom-fields.ts'), 'utf8');

assert.match(
  service,
  /function normalizeOptionList\(value: unknown\): string\[]/,
  'custom fields service must normalize option lists before fields reach model/product forms'
);

assert.match(
  service,
  /replace\(\s*\/\\\\r\\\\n\|\\\\n\|\\\\r\/g,\s*'\\n'\s*\)/,
  'option normalization must convert literal escaped newlines into real separators'
);

assert.match(
  service,
  /split\(\s*\/\[\\\\\\n\\r\]\+\/\s*\)/,
  'option normalization must split accidental backslash/newline separated values like Sim\\Nao\\Consulte'
);

assert.match(
  service,
  /options: normalizeOptionList\(row\.options\)/,
  'normalized fields must expose split options to select inputs'
);

console.log('custom fields option list normalization static checks passed');
