import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../pages/admin/settings/ShopeePage.tsx', import.meta.url), 'utf8');

assert.match(
  source,
  /const explicitCategoryLockedRef = useRef\(false\);/,
  'Shopee sync modal should track when a category was explicitly selected from product/model/user input'
);

assert.match(
  source,
  /selectCategory\(\{\s*category_id: catId,[\s\S]*?\}, \{ lockCategory: true \}\);/,
  'Initial product/model Shopee category must lock the category selection'
);

assert.match(
  source,
  /if \(explicitCategoryLockedRef\.current && !bulkAutoPreset\?\.categoryId\) return;/,
  'Template category auto-selection must not override an explicit product/model category'
);

assert.match(
  source,
  /selectCategory\(templateCategory, \{ lockCategory: false \}\);/,
  'Template-driven category selection should remain available only as an unlocked automatic fallback'
);

console.log('shopee-sync-category-lock-static: ok');
