import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const page = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');
const docs = readFileSync('Shopee.md', 'utf8');

assert.match(page, /type Tab = 'config' \| 'products' \| 'bulk'/, 'Shopee tab union must include bulk');
assert.match(page, /label: 'Envio em massa'/, 'Shopee tabs must expose the bulk export page');
assert.match(page, /const \[bulkSelectedIds, setBulkSelectedIds\]/, 'Bulk export must track selected product ids');
assert.match(page, /const \[bulkQueueIds, setBulkQueueIds\]/, 'Bulk export must track queue ids');
assert.match(page, /const startBulkAssistedSync = \(\) =>/, 'Bulk export must start an assisted queue');
assert.match(page, /const handleBulkModalSuccess = \(publishedProductIds\?: string\[\]\) =>/, 'Bulk export must advance after a successful publish');
assert.match(page, /selectBulkVisibleProducts/, 'Bulk export must provide a select-all-visible action');
assert.match(page, /Selecionar todos/, 'Bulk export UI must expose a Selecionar todos button');
assert.match(page, /grid-cols-1 xl:grid-cols-\[minmax\(360px,1fr\)_auto\]/, 'Bulk toolbar must let search use its own row before wide desktop');
assert.match(page, /min-w-\[320px\]/, 'Bulk search field must keep enough width for full search text');
assert.match(page, /<ShopeeSyncModal[\s\S]*product=\{bulkActiveProduct\}[\s\S]*onSuccess=\{handleBulkModalSuccess\}/, 'Bulk export must reuse the validated Shopee sync modal');
assert.match(page, /products\.filter\(p => p\.status === 'not_synced'\)/, 'Bulk export must only list unsynced products');

assert.match(docs, /## Envio em massa Shopee/, 'Shopee docs must document bulk export');
assert.match(docs, /## Variacoes no mesmo anuncio Shopee/, 'Shopee docs must document variation strategy');
assert.match(docs, /Selecionar todos/, 'Docs must document the select-all-visible bulk action');
assert.match(docs, /PATCH \/products\/variation-group/, 'Docs must document persistent variation group creation on the VPS');

console.log('Shopee bulk export static checks passed');
