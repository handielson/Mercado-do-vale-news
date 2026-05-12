import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const page = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');
const docs = readFileSync('Shopee.md', 'utf8');

assert.match(page, /type Tab = 'config' \| 'products' \| 'bulk'/, 'Shopee tab union must include bulk');
assert.match(page, /label: 'Envio em massa'/, 'Shopee tabs must expose the bulk export page');
assert.match(page, /const \[bulkSelectedIds, setBulkSelectedIds\]/, 'Bulk export must track selected product ids');
assert.match(page, /const \[bulkQueueIds, setBulkQueueIds\]/, 'Bulk export must track queue ids');
assert.match(page, /const startBulkAssistedSync = \(\) =>/, 'Bulk export must start an assisted queue');
assert.match(page, /const handleBulkModalSuccess = \(\) =>/, 'Bulk export must advance after a successful publish');
assert.match(page, /<ShopeeSyncModal[\s\S]*product=\{bulkActiveProduct\}[\s\S]*onSuccess=\{handleBulkModalSuccess\}/, 'Bulk export must reuse the validated Shopee sync modal');
assert.match(page, /products\.filter\(p => p\.status === 'not_synced'\)/, 'Bulk export must only list unsynced products');

assert.match(docs, /## Envio em massa Shopee/, 'Shopee docs must document bulk export');
assert.match(docs, /## Variacoes no mesmo anuncio Shopee/, 'Shopee docs must document variation strategy');
assert.match(docs, /O primeiro lote nao agrupa variacoes no mesmo anuncio/, 'Docs must keep variations out of the first bulk delivery');

console.log('Shopee bulk export static checks passed');
