import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');
const docs = readFileSync('Shopee.md', 'utf8');

assert.match(page, /type BulkRunItemStatus = 'queued' \| 'active' \| 'published' \| 'skipped' \| 'failed'/, 'bulk run must track per-item statuses');
assert.match(page, /const \[bulkRunItems, setBulkRunItems\]/, 'bulk run must keep a visible progress history');
assert.match(page, /const skipBulkActiveProduct = \(\) =>/, 'bulk run must allow skipping the current product');
assert.match(page, /const handleBulkModalError = \(message: string\) =>/, 'bulk run must record modal publish failures');
assert.match(page, /onError=\{handleBulkModalError\}/, 'bulk modal must report failures to the bulk history');
assert.match(page, /Publicados[\s\S]*Pulados[\s\S]*Falhas/, 'bulk page must show published, skipped and failed counters');
assert.match(page, /Historico do lote|Hist.rico do lote/, 'bulk page must render the batch history');
assert.match(page, /bulkProcessedCount/, 'bulk page must calculate processed items for a real progress bar');
assert.match(page, /bulkProgressPercent/, 'bulk page must calculate percent progress');
assert.match(page, /Progresso do envio/, 'bulk page must render a named import progress section');
assert.match(page, /aria-label="Progresso do envio em massa Shopee"/, 'bulk progress bar must be accessible');
assert.match(page, /width: `\$\{bulkProgressPercent\}%`/, 'bulk progress fill must reflect the computed percentage');
assert.match(page, /bulkPendingCount/, 'bulk page must show pending queue count');

assert.match(docs, /historico do lote/i, 'Shopee docs must mention batch history');
assert.match(docs, /publicado, pulado ou falhou/i, 'Shopee docs must describe per-item outcomes');

console.log('Shopee bulk progress static checks passed');
