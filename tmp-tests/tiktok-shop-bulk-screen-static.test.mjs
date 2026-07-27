import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/settings/TikTokShopPage.tsx', 'utf8');
const bulk = readFileSync('pages/admin/settings/components/TikTokShopBulkPreparation.tsx', 'utf8');
const vpsServer = readFileSync('vps_server.cjs', 'utf8');

assert.match(page, /TikTokShopBulkPreparation/, 'TikTok page must mount the bulk screen');
assert.match(bulk, /Envio em massa/, 'bulk screen must be visible');
assert.match(bulk, /Diagnostico/, 'bulk screen must show diagnostics');
assert.match(bulk, /Criar rascunhos/, 'bulk screen must expose draft creation');
assert.match(bulk, /Publicar rascunhos/, 'bulk screen must expose draft publishing');
assert.match(bulk, /Reenviar rascunhos/, 'bulk screen must expose resending');
assert.match(bulk, /Atualizar anuncios/, 'bulk screen must expose updates');
assert.match(bulk, /getProductLinks/, 'bulk screen must load TikTok links');
assert.match(bulk, /publishDraft/, 'bulk screen must use the real publish endpoint');
assert.match(bulk, /startDraftJob/, 'bulk screen must create every selected draft through the queue');
assert.match(bulk, /setLinks\(\(current\)[\s\S]*tiktok_product_id/, 'completed draft jobs must refresh their TikTok link before publishing');
assert.match(bulk, /Buscar por nome, SKU, categoria ou marca/, 'bulk screen must offer text filtering');
assert.match(bulk, /Selecionar prontos filtrados/, 'bulk screen must select all eligible filtered products');
assert.match(bulk, /useState\('positive'\)/, 'bulk screen must default to products with stock');
assert.match(bulk, /useState\('NOT_SENT'\)/, 'bulk screen must default to products not yet sent');
assert.match(bulk, /Atualizar/, 'bulk screen must expose update state for sent products');
assert.match(bulk, /titleNeedsCompatibilityWording/, 'bulk screen must identify titles that need compatibility wording');
assert.match(bulk, /Titulo ajustado/, 'bulk screen must show when a title will be corrected');
assert.match(bulk, /ref=\{progressRef\}/, 'bulk screen must anchor automatic progress scrolling');
assert.match(bulk, /scrollIntoView/, 'bulk screen must scroll to progress after sending');
assert.match(bulk, /bg-emerald-50/, 'completed drafts must have a distinct success state');
assert.match(vpsServer, /function cleanTikTokDraftTitleVps/, 'API must normalize the TikTok draft title');
assert.match(vpsServer, /replace\(\/\\bpara\\b\/gi, 'Compatível com'\)/, 'API must use compatibility wording in TikTok titles');
assert.match(vpsServer, /cleanTikTokDraftTitleVps\(product\.name\)/, 'TikTok draft creation must use the normalized title');

console.log('TikTok Shop bulk screen static checks passed');
