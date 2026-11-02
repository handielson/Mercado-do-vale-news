import assert from 'node:assert/strict';
import fs from 'node:fs';

const serverCjs = fs.readFileSync('vps_server.cjs', 'utf8');
const serverJs = fs.readFileSync('vps_server.js', 'utf8');
const productForm = fs.readFileSync('components/products/ProductForm.tsx', 'utf8');
const marketingPage = fs.readFileSync('pages/admin/settings/MarketingPage.tsx', 'utf8');
const whatsappPage = fs.readFileSync('pages/admin/settings/WhatsAppPage.tsx', 'utf8');

for (const server of [serverCjs, serverJs]) {
  assert.match(server, /CREATE TABLE IF NOT EXISTS whatsapp_broadcast_topics/);
  assert.match(server, /CREATE TABLE IF NOT EXISTS whatsapp_broadcast_subscriptions/);
  assert.match(server, /fastify\.post\('\/whatsapp\/broadcast\/invite'/);
  assert.match(server, /fastify\.post\('\/whatsapp\/broadcast\/topics\/:id\/send'/);
  assert.match(server, /isWhatsAppBroadcastOptOutMessage/);
  assert.match(server, /responda SAIR/);
  assert.match(server, /const marketingVideo = String\(product\?\.marketing_video_url/);
  // Status do WhatsApp: agrupado por cor; em cada cor o vídeo de marketing vem antes do vídeo normal.
  const statusStart = server.indexOf('function buildWhatsAppStatusVideoCandidates');
  const statusFn = server.slice(statusStart, server.indexOf('\n}\n', statusStart));
  assert.ok(statusStart > 0, 'status video candidates builder must exist');
  assert.match(statusFn, /const marketingVideo = String\(item\?\.marketing_video_url/);
  assert.match(statusFn, /const fallbackVideo = String\(item\?\.video_url/);
  assert.match(statusFn, /candidates: Array\.from\(new Set\(\[\.\.\.group\.marketing, \.\.\.group\.fallback\]\)\)/, 'marketing video must be evaluated before the regular product video');
  assert.match(server, /addColumnIfMissing\('products', 'marketing_background_url'/);
  assert.match(server, /addColumnIfMissing\('products', 'marketing_video_url'/);
}

assert.match(productForm, /Mídia de Marketing \(Opcional\)/);
assert.match(productForm, /marketing_background_url/);
assert.match(productForm, /marketing_video_url/);
// O Gerador de Artes grava a arte pronta no produto (com e sem preço); o status do WhatsApp usa essa arte.
assert.match(marketingPage, /const targetField = showPrice \? 'marketing_background_url' : 'marketing_background_no_price_url';/);
const statusPanel = fs.readFileSync('pages/admin/settings/marketing/WhatsAppStatusCampaignPanel.tsx', 'utf8');
assert.match(statusPanel, /product\.marketing_background_url/);
assert.match(whatsappPage, /<WhatsAppBroadcastPanel \/>/);

console.log('whatsapp broadcast and marketing media static regression: ok');
