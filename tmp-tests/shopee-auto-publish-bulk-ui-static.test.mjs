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
assert.match(page, /hasShopeeBulkPublishStock/, 'bulk page should centralize positive stock filtering');
assert.match(page, /bulkCandidates = products\.filter\(p => p\.status === 'not_synced' && !p\.shopee_item_id && hasShopeeBulkPublishStock\(p\)\)/, 'bulk page must exclude every linked product from new publication candidates');
assert.match(page, /bulkSelectedIds[\s\S]*filter[\s\S]*p\.status === 'not_synced' && !p\.shopee_item_id/, 'bulk start should discard stale selected ids for linked products');
assert.match(page, /Anúncios já vinculados — não serão reenviados/, 'bulk page should visibly separate linked listings');
assert.match(page, /Varrer antes de enviar/, 'bulk page should require a catalog scan');
assert.match(page, /if \(!linkScanSummary\)/, 'bulk start must be blocked until the scan succeeds');
assert.match(page, /scanShopeeCatalogLinks/, 'bulk page should reconcile item and variation SKUs');
assert.match(docs, /Pre-validacao para envio automatico/, 'Shopee docs should document the automatic prevalidation phase');

console.log('shopee auto publish bulk UI static checks passed');
