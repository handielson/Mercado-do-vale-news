import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('vps_server.js', 'utf8');
const serverCjs = fs.readFileSync('vps_server.cjs', 'utf8');
const service = fs.readFileSync('services/whatsappStatusCampaignService.ts', 'utf8');
const panel = fs.readFileSync('pages/admin/settings/marketing/WhatsAppStatusCampaignPanel.tsx', 'utf8');

for (const source of [server, serverCjs]) {
  assert.match(source, /CREATE TABLE IF NOT EXISTS whatsapp_status_campaigns/);
  assert.match(source, /CREATE TABLE IF NOT EXISTS whatsapp_status_campaign_logs/);
  assert.match(source, /MAX_WHATSAPP_STATUS_PRODUCTS_PER_RUN = 10/);
  assert.match(source, /\/message\/sendStatus\/\$\{encodeURIComponent\(instance\)\}/);
  assert.match(source, /WHATSAPP_STATUS_SEND_DEBUG/);
  assert.match(source, /slot_index/);
  assert.match(source, /product_ids JSON NULL/);
  assert.match(source, /parseWhatsAppStatusProductIds/);
  assert.match(source, /WHERE id IN \(\$\{placeholders\}\)/);
  assert.match(source, /groupWhatsAppStatusProductsByVariation/);
  assert.match(source, /Cores disponiveis/);
  assert.match(source, /specs, custom_fields/);
  assert.match(source, /sameWhatsAppStatusMemoryVariation/);
  assert.match(source, /runDueWhatsAppStatusCampaigns/);
  assert.match(source, /\/whatsapp\/status-campaigns\/:id\/send-now/);
  assert.match(source, /\/whatsapp\/status-campaigns\/run-due/);
  assert.match(source, /apikey\\s\*\[:=\]/);
}

assert.match(service, /sendNow\(id: string\)/);
assert.match(service, /product_ids\?: string\[\] \| string \| null/);
assert.match(service, /\/whatsapp\/status-campaigns\/\$\{encodeURIComponent\(id\)\}\/send-now/);
assert.match(service, /daily_limit: Math\.max\(1, Math\.min\(10/);

assert.match(panel, /Status WhatsApp/);
assert.match(panel, /Enviar agora/);
assert.match(panel, /Copiar ultimo erro/);
assert.match(panel, /max=\{10\}/);
assert.match(panel, /formatProductOptionLabel/);
assert.match(panel, /memoria_interna/);
assert.match(panel, /Preview do Status/);
assert.match(panel, /StatusPreviewCard/);
assert.match(panel, /Produto para adicionar/);
assert.match(panel, /selectedProductIds\.length >= 10/);
assert.match(panel, /Adicionar produto/);
assert.match(panel, /ChevronLeft/);
assert.match(panel, /ChevronRight/);
assert.match(panel, /buildStatusCaption/);
assert.match(panel, /buildStatusPayload/);
assert.match(panel, /groupStatusProductsByVariation/);
assert.match(panel, /categories: \[form\.category_id\]/);

console.log('whatsapp-status-campaign-vps-static.test.mjs: ok');
