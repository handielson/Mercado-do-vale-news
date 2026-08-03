import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const profile = readFileSync('components/customer/profile/PurchaseHistoryTab.tsx', 'utf8');
const service = readFileSync('services/customerDocumentService.ts', 'utf8');
const receipt = readFileSync('utils/printSaleReceipt.ts', 'utf8');
const onlineReceipt = readFileSync('utils/printOnlineOrderReceipt.ts', 'utf8');

for (const serverFile of ['vps_server.js', 'vps_server.cjs']) {
  const server = readFileSync(serverFile, 'utf8');
  assert.match(server, /fastify\.get\('\/customer\/document-settings'[\s\S]*?getVpsBearerAuthContext\(req\)/);
  assert.match(server, /fastify\.get\('\/customer\/sales\/:saleId\/warranty-documents'[\s\S]*?getVpsBearerAuthContext\(req\)/);
  assert.match(server, /String\(sale\.customer_id\) !== String\(auth\.customerId\)/);
  assert.match(server, /SELECT id, sale_id, serialized_unit_id, warranty_content, created_at[\s\S]*?FROM warranty_documents[\s\S]*?WHERE sale_id = \?/);
}

assert.match(service, /'\/customer\/document-settings'/);
assert.match(service, /`\/customer\/sales\/\$\{encodeURIComponent\(saleId\)\}\/warranty-documents`/);
assert.doesNotMatch(profile, /companySettingsService/);
assert.match(profile, /customerDocumentService\.getSettings\(\)/);
assert.match(profile, /customerDocumentService\.listWarrantyDocuments\(sale\.id\)/);
assert.match(profile, /title="Imprimir Termo de Garantia"[\s\S]*?Termo de Garantia[\s\S]*?<\/button>/);
assert.match(profile, /const printWindow = window\.open\('', '_blank'\)/);
assert.match(profile, /printSaleReceipt\(sale, settings, productSpecs, benefits, printWindow\)/);
assert.match(receipt, /printWindow \|\| window\.open\('', '_blank'\)/);
assert.match(onlineReceipt, /if \(printWindow\) printWindow\.location\.href = url/);

console.log('customer profile document routes and print actions are protected');
