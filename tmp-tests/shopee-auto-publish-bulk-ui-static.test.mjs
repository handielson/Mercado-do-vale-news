import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');
const docs = readFileSync('Shopee.md', 'utf8');

assert.match(page, /evaluateShopeeAutoPublishReadiness/, 'bulk page should evaluate automatic publish readiness');
assert.match(page, /bulkAutoFilter/, 'bulk page should expose an automatic readiness filter');
assert.match(page, /Prontos para automatico/, 'bulk page should count products ready for automatic publish');
assert.match(page, /Precisam revisao/, 'bulk page should count products that need review');
assert.match(page, /Motivos/, 'bulk table should show readiness reasons');
assert.match(page, /Selecionar automaticos/, 'bulk page should select only automatic-ready products');
assert.match(page, /bulkRequiredAttributesByCategoryId/, 'bulk page should cache required Shopee attributes by category');
assert.match(page, /action=attributes&category_id=\$\{categoryId\}/, 'bulk page should fetch Shopee attributes for template categories');
assert.match(page, /logistics_channel_list/, 'bulk page should validate enabled logistics before automatic publish');
assert.match(page, /isBulkUpdateCandidate/, 'bulk page should detect items that already have a Shopee item id');
assert.match(page, /hasBulkPublishStock/, 'bulk page should centralize positive stock filtering');
assert.match(page, /bulkCandidates = products\.filter\(p => \(p\.status === 'not_synced' \|\| isBulkUpdateCandidate\(p\)\) && hasBulkPublishStock\(p\)\)/, 'bulk page should hide products without stock from publish/update candidates');
assert.match(page, /bulkSelectedIds[\s\S]*filter[\s\S]*hasBulkPublishStock\(p\)/, 'bulk start should discard stale selected ids for products without stock');
assert.match(page, /selectBulkReadyProducts[\s\S]*hasBulkPublishStock\(p\)[\s\S]*bulkReadinessById/, 'bulk ready selection should only select products with stock');
assert.match(page, /Atualiza(?:ção|cao|Ã§Ã£o) pronta/, 'bulk page should label already-sent items as update-ready');
assert.match(page, /Revisar atualiza(?:ção|cao|Ã§Ã£o)/, 'bulk page should label blocked already-sent items as update review');
assert.match(page, /Item ja enviado: sera atualizado na Shopee\./, 'bulk page should explain that linked items will be updated');
assert.match(page, /bg-sky-50\/50/, 'bulk update rows should use a distinct blue layout');
assert.match(docs, /Pre-validacao para envio automatico/, 'Shopee docs should document the automatic prevalidation phase');

console.log('shopee auto publish bulk UI static checks passed');
