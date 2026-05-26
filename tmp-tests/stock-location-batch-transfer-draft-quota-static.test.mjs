import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const page = fs.readFileSync(path.join(root, 'pages/admin/inventory/StockLocationsPage.tsx'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertIncludes(source, snippet, label) {
  assert(source.includes(snippet), `${label}: missing ${snippet}`);
}

assertIncludes(page, 'type BatchDraftItem =', 'batch draft should use a compact persisted item type');
assertIncludes(page, 'const serializeBatchDraftItem = (item: BatchItem): BatchDraftItem =>', 'batch draft should serialize items before localStorage');
assertIncludes(page, 'const hydrateBatchDraftItem = (item: BatchDraftItem): BatchItem | null =>', 'batch draft should hydrate compact items on restore');
assertIncludes(page, 'images: item.product.images?.slice(0, 1) || null', 'batch draft should not persist every product image');
assertIncludes(page, 'deposit: source.deposit ? {', 'batch draft should keep only minimal deposit display data');
assertIncludes(page, 'location: source.location ? {', 'batch draft should keep only minimal location display data');
assertIncludes(page, 'items: batchItems.map(serializeBatchDraftItem)', 'batch draft should not write raw batchItems to localStorage');
assert(!page.includes('items: batchItems,'), 'batch draft must not persist raw batchItems');
assertIncludes(page, 'try {', 'batch draft persistence should catch localStorage quota errors');
assertIncludes(page, 'window.localStorage.setItem(BATCH_TRANSFER_STORAGE_KEY, JSON.stringify(batchDraft));', 'batch draft should write the compact payload');
assertIncludes(page, "toast.warning('A lista ficou grande demais para manter salva neste navegador. Continue a transferencia sem recarregar a pagina.');", 'quota errors should show a non-crashing warning');

console.log('stock location batch transfer draft quota static checks passed');
