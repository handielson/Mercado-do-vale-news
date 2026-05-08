import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('layouts/AdminLayout.tsx', 'utf8');

assert.match(
  source,
  /const\s+activeItemPath\s*=\s*useMemo\(/,
  'AdminLayout must compute one most-specific active menu path',
);

assert.match(
  source,
  /sort\(\(a,\s*b\)\s*=>\s*b\.to\.length\s*-\s*a\.to\.length\)/,
  'active route selection must prefer the longest matching path',
);

assert.match(
  source,
  /active=\{activeItemPath\s*===\s*item\.to\}/,
  'NavItem active state must use the single active menu path',
);

assert.doesNotMatch(
  source,
  /active=\{location\.pathname\s*===\s*item\.to\s*\|\|\s*\(item\.to\s*!==\s*['"]\/admin['"]\s*&&\s*location\.pathname\.startsWith\(item\.to\)\)\}/,
  'NavItem must not mark every prefix match as active',
);

console.log('admin layout specific active route static test ok');
