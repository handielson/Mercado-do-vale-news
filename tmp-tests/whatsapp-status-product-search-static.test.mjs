import assert from 'node:assert/strict';
import fs from 'node:fs';

const panel = fs.readFileSync('pages/admin/settings/marketing/WhatsAppStatusCampaignPanel.tsx', 'utf8');
const routes = fs.readFileSync('routes/index.tsx', 'utf8');
const layout = fs.readFileSync('layouts/AdminLayout.tsx', 'utf8');

assert.match(
  panel,
  /catalogService\.getProducts\(\s*query \? \{ search: query, inStockOnly: true \} : \{ inStockOnly: true \}/,
  'Status WhatsApp product picker must search products server-side instead of filtering only the initially loaded page',
);
assert.match(panel, /Buscar por nome, SKU ou EAN/);
assert.match(panel, /Buscando produtos/);
assert.doesNotMatch(panel, /filteredProducts/, 'legacy local-only product filtering should not return');

assert.doesNotMatch(routes, /memoria-ia/);
assert.doesNotMatch(routes, /WhatsAppAiMemoryPage/);
assert.doesNotMatch(layout, /Memoria IA/);
assert.doesNotMatch(layout, /\/admin\/whatsapp\/memoria-ia/);

for (const removedPath of [
  'pages/admin/whatsapp/AiMemoryPage.tsx',
  'components/whatsapp/WhatsAppAiMemoryPanel.tsx',
  'components/whatsapp/WhatsAppAiTeachingPanel.tsx',
]) {
  assert.equal(fs.existsSync(removedPath), false, `${removedPath} should be removed`);
}

console.log('whatsapp-status-product-search-static.test.mjs: ok');
