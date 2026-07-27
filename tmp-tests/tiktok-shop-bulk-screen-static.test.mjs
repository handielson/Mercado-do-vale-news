import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('pages/admin/settings/TikTokShopPage.tsx', 'utf8');
const bulk = readFileSync('pages/admin/settings/components/TikTokShopBulkPreparation.tsx', 'utf8');

assert.match(page, /TikTokShopBulkPreparation/, 'TikTok page must mount the bulk screen');
assert.match(bulk, /Envio em massa/, 'bulk screen must be visible');
assert.match(bulk, /Diagnostico/, 'bulk screen must show diagnostics');
assert.match(bulk, /Criar rascunhos/, 'bulk screen must expose draft creation');
assert.match(bulk, /Publicar rascunhos/, 'bulk screen must expose draft publishing');
assert.match(bulk, /Reenviar rascunhos/, 'bulk screen must expose resending');
assert.match(bulk, /Atualizar anuncios/, 'bulk screen must expose updates');
assert.match(bulk, /getProductLinks/, 'bulk screen must load TikTok links');
assert.match(bulk, /publishDraft/, 'bulk screen must use the real publish endpoint');
assert.match(bulk, /Buscar por nome, SKU, categoria ou marca/, 'bulk screen must offer text filtering');
assert.match(bulk, /Selecionar prontos filtrados/, 'bulk screen must select all eligible filtered products');

console.log('TikTok Shop bulk screen static checks passed');
