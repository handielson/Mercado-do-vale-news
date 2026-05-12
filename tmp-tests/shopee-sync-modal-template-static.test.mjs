import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');

assert.match(source, /shopeeTemplateService/, 'ShopeeSyncModal should load saved Shopee templates');
assert.match(source, /resolveBestShopeeTemplate/, 'ShopeeSyncModal should resolve an automatic template suggestion');
assert.match(source, /applyShopeeTemplateToProduct/, 'ShopeeSyncModal should apply template defaults');
assert.match(source, /analyzeShopeeTitleSafety/, 'ShopeeSyncModal should analyze dangerous title terms');
assert.match(source, /selectedTemplateId/, 'ShopeeSyncModal should keep selected template state');
assert.match(source, /Nome final na Shopee/, 'ShopeeSyncModal should expose editable final title');
assert.match(source, /Aplicar titulo sugerido/, 'ShopeeSyncModal should let user apply safe title');
assert.match(source, /titleSafety\.hasBlocks/, 'ShopeeSyncModal should block publish when title has blocking terms');

console.log('shopee sync modal template static checks passed');
