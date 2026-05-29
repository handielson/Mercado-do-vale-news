import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/catalog/CategoryNav.tsx', 'utf8');

assert.doesNotMatch(
  source,
  /Todos\s*\(\{allCategories\.find/,
  'Subcategory pills should not show the root category product count'
);

assert.doesNotMatch(
  source,
  /\{child\.name\}\s*\{child\.count > 0 && `\(\$\{child\.count\}\)`\}/,
  'Subcategory pills should render the child name without a product count suffix'
);

assert.doesNotMatch(
  source,
  /category\.count !== undefined && category\.count > 0/,
  'Root category cards should not render product count badges'
);

assert.doesNotMatch(
  source,
  /\{category\.count\}/,
  'CategoryNav should not render category product counts anywhere'
);

assert.doesNotMatch(
  source,
  /Ver mais categorias \(\{hiddenCategories\.length\}\)/,
  'The category expand button should not render a visible counter'
);

console.log('category nav hides subcategory counts static checks ok');
