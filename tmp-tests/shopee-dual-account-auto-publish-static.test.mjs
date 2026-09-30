import assert from 'node:assert/strict';
import fs from 'node:fs';

const productCard = fs.readFileSync(new URL('../components/products/ProductCard.tsx', import.meta.url), 'utf8');
const shopeePage = fs.readFileSync(new URL('../pages/admin/settings/ShopeePage.tsx', import.meta.url), 'utf8');

assert.match(productCard, /Publicar tambem na outra conta/);
assert.match(productCard, /publishToBothShopeeStores/);
assert.match(productCard, /getOtherShopeeStore/);
assert.match(productCard, /getItemIdByProductId\(product\.id, otherStore\.connectionId\)/);
assert.match(productCard, /ja possui vinculo com este produto[\s\S]*segundo envio foi ignorado/);
assert.match(productCard, /autoPublish=\{shopeeMirrorAutoPublish\}/);
assert.match(productCard, /bulkAutoPreset=\{shopeeMirrorPreset\}/);
assert.match(productCard, /onPublished=\{\(\) => void finishShopeePublication\(\)\}/);
assert.match(productCard, /key=\{selectedShopeeConnectionId\}/);
assert.match(shopeePage, /export type ShopeeBulkAutoPreset/);
assert.match(shopeePage, /onPublished\?\.\(syncedProductIds\)/);

console.log('shopee dual-account auto-publish static checks passed');
