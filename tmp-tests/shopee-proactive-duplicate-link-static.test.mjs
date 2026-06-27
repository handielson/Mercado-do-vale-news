import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');

assert.match(
  source,
  /const persistShopeeProductLink = async \(shopeeItemId: number \| string \| null \| undefined\)/,
  'Shopee sync must centralize local link persistence so duplicate recovery and successful publish share the same contract',
);

const duplicateResolutionStart = source.indexOf('const resolvedExistingProductItemId = publishWithVariations');
const publishCallStart = source.indexOf('const data = variationPayloadParts', duplicateResolutionStart);
assert.ok(duplicateResolutionStart > 0 && publishCallStart > duplicateResolutionStart, 'test setup should find duplicate resolution before publish call');

const beforePublishCall = source.slice(duplicateResolutionStart, publishCallStart);

assert.match(
  beforePublishCall,
  /if \(resolvedExistingProductItemId && !existingProductItemId\) \{[\s\S]*await persistShopeeProductLink\(resolvedExistingProductItemId\);[\s\S]*\}/,
  'A proactive duplicate item must be linked locally before update_item, so the admin card shows it as Shopee-linked even if attribute update fails',
);

assert.doesNotMatch(
  beforePublishCall,
  /update_item:existing_item[\s\S]*persistShopeeProductLink\(resolvedExistingProductItemId\)/,
  'The local duplicate link must be saved before calling update_item, not only after Shopee accepts the update',
);

const finalSaveStart = source.indexOf("setSyncStepRunning('save_link', 'Gravando vinculo Shopee no sistema')");
assert.ok(finalSaveStart > 0, 'test setup should find the final save_link step');
const finalSaveSlice = source.slice(finalSaveStart, finalSaveStart + 700);

assert.match(
  finalSaveSlice,
  /await persistShopeeProductLink\(shopeeItemId\);/,
  'Successful publish/update should reuse the same Shopee link persistence helper',
);

console.log('shopee proactive duplicate link static ok');
