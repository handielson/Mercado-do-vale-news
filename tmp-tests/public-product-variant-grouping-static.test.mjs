import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'pages/store/PublicProductPage.tsx'), 'utf8');

assert.match(
  source,
  /const groupedVariantOptions = Array\.from\(uniqueVariants\.reduce/,
  'public product page should group variant options before rendering'
);

assert.match(
  source,
  /const shouldShowVariantOptions = uniqueVariants\.length > 1 \|\| uniqueVariants\.some/,
  'public product page should show variant choices even when there is only one meaningful option'
);

assert.match(
  source,
  /<h4 className="text-sm font-semibold text-slate-800">\{group\.memoryLabel\}<\/h4>/,
  'variant UI should render a RAM/storage heading for each group'
);

assert.doesNotMatch(
  source,
  /Variações de cor/,
  'variant UI should not render the demonstration label as visible copy'
);

assert.doesNotMatch(
  source,
  /return uniqueVariants\.map\(\(sib\) =>/,
  'variant UI should not render one mixed flat list'
);

assert.doesNotMatch(
  source,
  /uniqueVariants\.length > 1 && \(/,
  'variant UI should not hide the selector when there is only one color option'
);

console.log('public product variant grouping static checks passed');
