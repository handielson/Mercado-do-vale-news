import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('components/settings/ModelModal.tsx', 'utf8');

assert.match(
  source,
  /searchShopeeCategories/,
  'ModelModal should use Shopee category name search helpers'
);

assert.match(
  source,
  /\/api\/shopee-catalog\?action=categories/,
  'ModelModal should load Shopee categories from the catalog API'
);

assert.match(
  source,
  /Categoria Shopee/,
  'ModelModal should render a Categoria Shopee field near the model form'
);

assert.match(
  source,
  /setShopeeCategoryId\(Number\(category\.category_id\)\)/,
  'Selecting a Shopee category by name should store the category id internally'
);

assert.doesNotMatch(
  source,
  /<label className="block text-xs font-medium text-slate-600 mb-1">ID da Categoria Shopee<\/label>/,
  'The primary Shopee category flow should not ask the operator to type the category id'
);

console.log('model modal Shopee category name search static checks ok');
