import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const printAgent = readFileSync('scripts/shopee-auto-print.cjs', 'utf8');
const ordersTab = readFileSync('pages/admin/settings/components/ShopeeOrdersTab.tsx', 'utf8');
const shopeePage = readFileSync('pages/admin/settings/ShopeePage.tsx', 'utf8');

for (const serverFile of ['vps_server.cjs', 'vps_server.js']) {
  const server = readFileSync(serverFile, 'utf8');
  assert.match(server, /seller_type VARCHAR\(20\) NOT NULL DEFAULT 'individual'/,
    `${serverFile} must persist additional Shopee stores as individual sellers by default`);
  assert.match(server, /SELECT id, display_name, seller_type, shopee_shop_id/,
    `${serverFile} must expose seller type without exposing tokens`);
}

assert.match(printAgent, /getShopeePrintConnections/,
  'printer agent must enumerate every connected Shopee store');
assert.match(printAgent, /sellerType: 'business'/,
  'primary Mercado do Vale store must retain the PJ invoice flow');
assert.match(printAgent, /seller_type \|\| 'individual'/,
  'additional G store must use the PF flow by default');
assert.match(printAgent, /connection_id: connectionId/,
  'all printer API actions must be scoped to the selected Shopee connection');
assert.match(printAgent, /if \(!isIndividual\) \{[\s\S]*?'upload_invoice'/,
  'only business Shopee stores may upload the Bling NF-e');
assert.match(printAgent, /conta PF, etapa de NF-e\/Bling não executada/,
  'PF flow must explicitly skip Bling invoice issuance');
assert.match(printAgent, /personal_document[\s\S]*?Não emita NF-e pelo Bling para esta conta/,
  'a Shopee document requirement on G must stop for manual review instead of issuing a company invoice');
assert.match(printAgent, /createMercadoLivreSummaryPdf\(summaryData\)/,
  'PF Shopee receipt must reuse the approved Mercado Livre receipt layout');
assert.match(printAgent, /prepareMercadoLivreSummaryPrinter/,
  'PF receipt must use the same exact 90x100 printer preparation as Mercado Livre');
assert.match(printAgent, /orderPrintStatePaths\(orderSn, connection\.id\)/,
  'print markers must be isolated by Shopee account');
assert.match(ordersTab, /connection_id: connectionId/,
  'manual print must identify the selected Shopee account');
assert.match(shopeePage, /Pessoa física · Comprovante/,
  'connected G account must visibly identify the PF receipt flow');

console.log('Shopee personal-account print flow static checks passed');
