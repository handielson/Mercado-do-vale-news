import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const routeSource = readFileSync('routes/index.tsx', 'utf8');
const pageSource = readFileSync('pages/admin/settings/ShopeeTemplatesPage.tsx', 'utf8');
const shopeePageSource = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');

assert.match(routeSource, /ShopeeTemplatesPage/, 'routes should lazy-load ShopeeTemplatesPage');
assert.match(routeSource, /path:\s*"\/admin\/settings\/shopee\/templates"/, 'routes should expose Shopee templates page');

assert.match(pageSource, /Templates da Shopee/, 'page should have the expected title');
assert.match(pageSource, /Novo template/, 'page should allow creating templates');
assert.match(pageSource, /Titulo sugerido/, 'page should edit suggested title');
assert.match(pageSource, /Termos perigosos/, 'page should edit dangerous terms');
assert.match(pageSource, /shopeeTemplateService/, 'page should use template service');
assert.match(pageSource, /categoryService\.list/, 'page should load local categories for a real selector');
assert.match(pageSource, /ruleInputs/, 'rule CSV inputs should keep their raw text while editing');
assert.match(pageSource, /updateRuleInput/, 'rule CSV inputs should parse text without removing the typed comma from the field');
assert.doesNotMatch(pageSource, /value=\{listToCsv\(draft\.rules\.nameIncludes\)\}/, 'name rule input should not re-render from parsed array on each keypress');
assert.match(pageSource, /buildLocalCategoryGroups/, 'local categories should be grouped by parent category');
assert.match(pageSource, /localCategoryGroups/, 'local category selector should use grouped category data');
assert.match(pageSource, /<optgroup\s+key=\{group\.category\.id\}/, 'local category selector should render parent categories as option groups');
assert.match(pageSource, /category\.parent_id/, 'local category grouping should use parent_id relationships');
assert.doesNotMatch(pageSource, /localCategories\.map\(\(category\)\s*=>\s*\(/, 'local category selector should not render a flat category list');
assert.match(pageSource, /notifyShopeeTemplatesUpdated/, 'template page should notify other tabs after saving or deleting templates');
assert.match(pageSource, /shopee_templates_updated/, 'template update notification should use the shared storage event key');
assert.match(pageSource, /searchShopeeCategories/, 'page should search Shopee categories by name');
assert.match(pageSource, /buildCategoryTree/, 'page should load Shopee category tree for category search');
assert.match(pageSource, /action=categories/, 'page should fetch Shopee categories for template selection');
assert.match(pageSource, /handleSelectShopeeCategory/, 'page should select a Shopee category from search results');
assert.match(pageSource, /shopeeCategorySearchResults/, 'page should render Shopee category search results');
assert.match(pageSource, /shopeeCategoryId:\s*Number\(category\.category_id\)/, 'category selection should autofill Shopee category id');
assert.match(pageSource, /shopeeCategoryName:\s*category\.__pathLabel\s*\|\|\s*getCategoryPathLabel\(category\)/, 'category selection should autofill Shopee category name');
assert.match(pageSource, /action=attributes&category_id=\$\{draft\.shopeeCategoryId\}/, 'page should fetch all Shopee category attributes');
assert.match(pageSource, /Todos os campos da categoria/, 'page should render all Shopee fields, not a JSON-only editor');
assert.doesNotMatch(pageSource, /Atributos padrao em JSON/, 'page should not rely on raw JSON for Shopee attributes');

assert.match(shopeePageSource, /\/admin\/settings\/shopee\/templates/, 'Shopee settings page should link to templates page');

console.log('shopee templates page static checks passed');
