import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const sourcePath = resolve('pages/store/PublicProductPage.tsx');
const source = readFileSync(sourcePath, 'utf8');

assert.match(
  source,
  /<h1 className="text-3xl sm:text-4xl font-bold text-slate-900 leading-tight">/,
  'The PDP title should stay prominent without using font-extrabold.',
);

assert.doesNotMatch(
  source,
  /<h4 className="text-base font-extrabold text-slate-950">\{group\.memoryLabel\}<\/h4>/,
  'Variant memory labels should not use the extra-bold style.',
);

assert.match(
  source,
  /<h4 className="text-sm font-semibold text-slate-800">\{group\.memoryLabel\}<\/h4>/,
  'Variant memory labels should use a quieter semibold style.',
);

assert.doesNotMatch(
  source,
  /<div className="text-4xl font-extrabold text-slate-900">/,
  'The main PIX price should not use the largest extra-bold treatment.',
);

assert.match(
  source,
  /<div className="text-3xl sm:text-4xl font-bold text-slate-900">/,
  'The main PIX price should keep hierarchy with a slightly lighter responsive style.',
);

assert.match(
  source,
  /<h3 className="text-lg font-semibold text-slate-900[^"]*">\s*Descri..o do Produto\s*<\/h3>/,
  'Main PDP section headings should use text-lg font-semibold.',
);

assert.match(
  source,
  /<h4 className="font-semibold text-sm">\{g\.group\.label\}<\/h4>/,
  'Specification group headings should use a lighter small semibold style.',
);

assert.doesNotMatch(
  source,
  /font-black/,
  'The PDP should avoid font-black because it makes the page visually noisy.',
);

console.log('PDP typography weight guard passed.');
